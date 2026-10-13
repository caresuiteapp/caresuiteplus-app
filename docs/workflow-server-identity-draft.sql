-- REVIEW DRAFT ONLY; never applied remotely.
-- Catalog proof: workflow-server-permission-metadata-20261011.json.
-- Apply only with the registration trigger and completion/Storage drafts reviewed
-- and authenticated staging workflows verified. No business data repair is attempted.
-- Global role templates remain readable but cannot be mutated by tenant actors.
BEGIN;

CREATE OR REPLACE FUNCTION public.current_tenant_id()
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$SELECT CASE WHEN public.platform_tenant_access_allowed(v.tenant_id,false) THEN v.tenant_id ELSE NULL END FROM (
  SELECT CASE public.current_portal_type()
    WHEN 'employee' THEN (
      SELECT epa.tenant_id
      FROM public.employee_portal_accounts epa
      WHERE epa.id = public.current_portal_account_id()
        AND epa.auth_user_id = auth.uid()
        AND epa.status IN ('active', 'pending_first_login', 'password_reset_required')
      LIMIT 1
    )
    WHEN 'client' THEN COALESCE(
      (
        SELECT cpa.tenant_id
        FROM public.client_portal_access cpa
        WHERE cpa.id = public.current_portal_account_id()
          AND cpa.auth_user_id = auth.uid()
          AND cpa.portal_enabled = TRUE
          AND cpa.status = 'aktiv'
        LIMIT 1
      ),
      (
        SELECT cpc.tenant_id
        FROM public.client_portal_codes cpc
        WHERE cpc.id = public.current_portal_account_id()
          AND cpc.auth_user_id = auth.uid()
          AND cpc.status = 'active'
          AND (cpc.expires_at IS NULL OR cpc.expires_at > NOW())
        LIMIT 1
      )
    )
    WHEN 'relative' THEN (
      SELECT rpc.tenant_id
      FROM public.relative_portal_codes rpc
      WHERE rpc.id = public.current_portal_account_id()
        AND rpc.auth_user_id = auth.uid()
        AND rpc.status = 'active'
        AND (rpc.expires_at IS NULL OR rpc.expires_at > NOW())
      LIMIT 1
    )
    ELSE CASE
      WHEN public.current_portal_type() IS NULL OR public.current_portal_type() = 'business'
      THEN COALESCE(
        (
          SELECT p.tenant_id
          FROM public.profiles p
          WHERE p.auth_user_id = auth.uid() OR (p.auth_user_id IS NULL AND p.id = auth.uid())
          ORDER BY (p.id = auth.uid()) DESC
          LIMIT 1
        ),
        CASE
          WHEN COALESCE(auth.jwt()->'app_metadata'->>'tenant_id', '') ~*
            '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
          THEN (auth.jwt()->'app_metadata'->>'tenant_id')::uuid
          ELSE NULL
        END
      )
      ELSE NULL
    END
  END
) v(tenant_id)$function$;

CREATE OR REPLACE FUNCTION public.current_role_key()
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT CASE public.current_portal_type()
    WHEN 'employee' THEN CASE WHEN EXISTS (
      SELECT 1
      FROM public.employee_portal_accounts epa
      WHERE epa.id = public.current_portal_account_id()
        AND epa.auth_user_id = auth.uid()
        AND epa.status IN ('active', 'pending_first_login', 'password_reset_required')
    ) THEN 'employee_portal'::text ELSE NULL END
    WHEN 'client' THEN CASE WHEN EXISTS (
      SELECT 1
      FROM public.client_portal_access cpa
      WHERE cpa.id = public.current_portal_account_id()
        AND cpa.auth_user_id = auth.uid()
        AND cpa.portal_enabled = TRUE
        AND cpa.status = 'aktiv'
    ) OR EXISTS (
      SELECT 1
      FROM public.client_portal_codes cpc
      WHERE cpc.id = public.current_portal_account_id()
        AND cpc.auth_user_id = auth.uid()
        AND cpc.status = 'active'
        AND (cpc.expires_at IS NULL OR cpc.expires_at > NOW())
    ) THEN 'client_portal'::text ELSE NULL END
    WHEN 'relative' THEN CASE WHEN EXISTS (
      SELECT 1
      FROM public.relative_portal_codes rpc
      WHERE rpc.id = public.current_portal_account_id()
        AND rpc.auth_user_id = auth.uid()
        AND rpc.status = 'active'
        AND (rpc.expires_at IS NULL OR rpc.expires_at > NOW())
    ) THEN 'family_portal'::text ELSE NULL END
    ELSE CASE
      WHEN public.current_portal_type() IS NULL OR public.current_portal_type() = 'business'
      THEN COALESCE(
        (
          SELECT r.key
          FROM public.profiles p
          JOIN public.roles r ON r.id = p.role_id
          WHERE p.auth_user_id = auth.uid() OR (p.auth_user_id IS NULL AND p.id = auth.uid())
          ORDER BY (p.id = auth.uid()) DESC
          LIMIT 1
        ),
        NULLIF(auth.jwt()->'app_metadata'->>'role_key', '')
      )
      ELSE NULL
    END
  END
$function$;

CREATE OR REPLACE FUNCTION public.resolve_current_profile_id()
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT p.id
  FROM public.profiles p
  WHERE p.auth_user_id = auth.uid()
     OR (p.auth_user_id IS NULL AND p.id = auth.uid())
  ORDER BY CASE WHEN p.id = auth.uid() THEN 0 ELSE 1 END
  LIMIT 1
$function$;


CREATE OR REPLACE FUNCTION public.is_tenant_admin() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT auth.uid() IS NOT NULL
    AND COALESCE(public.current_portal_type(), 'business') = 'business'
    AND public.current_tenant_id() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.profiles p JOIN public.roles r ON r.id=p.role_id
      WHERE (p.auth_user_id=auth.uid() OR (p.auth_user_id IS NULL AND p.id=auth.uid()))
        AND p.tenant_id=public.current_tenant_id()
        AND p.status IN ('active','invited') AND p.is_active=TRUE
        AND NOT EXISTS (SELECT 1 FROM public.tenant_users u
          WHERE u.auth_user_id=auth.uid() AND u.tenant_id=p.tenant_id
            AND (u.status<>'active' OR u.must_change_password OR NOT u.first_login_completed))
        AND (r.tenant_id=p.tenant_id OR r.tenant_id IS NULL)
        AND (COALESCE(r.is_admin_role,FALSE) OR r.key IN
          ('owner','admin','management','geschaeftsfuehrung','business_admin'))
    )
$$;
REVOKE ALL ON FUNCTION public.is_tenant_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_tenant_admin() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.has_permission(p_permission_key text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT auth.uid() IS NOT NULL
  AND COALESCE(public.current_portal_type(), 'business') = 'business'
  AND public.current_tenant_id() IS NOT NULL
  AND (EXISTS (
    SELECT 1
    FROM public.profiles pr
    JOIN public.roles r ON r.id = pr.role_id
    JOIN public.role_permissions rp ON rp.role_id = r.id
    WHERE (pr.auth_user_id = auth.uid() OR (pr.auth_user_id IS NULL AND pr.id = auth.uid()))
      AND pr.tenant_id = public.current_tenant_id()
      AND pr.status IN ('active', 'invited') AND pr.is_active = TRUE
      AND NOT EXISTS (SELECT 1 FROM public.tenant_users u
        WHERE u.auth_user_id=auth.uid() AND u.tenant_id=pr.tenant_id
          AND (u.status<>'active' OR u.must_change_password OR NOT u.first_login_completed))
      AND (r.tenant_id = pr.tenant_id OR r.tenant_id IS NULL)
      AND rp.tenant_id IS NOT DISTINCT FROM r.tenant_id
      AND (
        rp.permission_key = p_permission_key
        OR (
          rp.permission_key = split_part(p_permission_key, '.', 2)
          AND (
            (p_permission_key LIKE '%.view' AND COALESCE(rp.can_view, FALSE))
            OR (p_permission_key LIKE '%.create' AND COALESCE(rp.can_create, FALSE))
            OR (p_permission_key LIKE '%.upload' AND COALESCE(rp.can_create, FALSE))
            OR (
              (p_permission_key LIKE '%.edit' OR p_permission_key LIKE '%.update')
              AND COALESCE(rp.can_update, FALSE)
            )
            OR (p_permission_key LIKE '%.delete' AND COALESCE(rp.can_delete, FALSE))
            OR (
              p_permission_key LIKE '%.manage'
              AND COALESCE(rp.can_update, FALSE)
            )
          )
        )
        OR (
          p_permission_key LIKE 'communication.%'
          AND rp.permission_key = 'messages'
          AND (
            (p_permission_key LIKE '%.view%' AND COALESCE(rp.can_view, FALSE))
            OR (
              p_permission_key NOT LIKE '%.view%'
              AND COALESCE(rp.can_create, FALSE)
            )
          )
        )
      )
  )
  OR (
    p_permission_key = 'business.tenant.manage'
    AND public.is_tenant_admin()
  )
  OR (
    p_permission_key = 'messages.broadcast.create'
    AND public.is_tenant_admin()
  ))
$function$;

REVOKE ALL ON FUNCTION public.has_permission(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_permission(text) TO authenticated, service_role;

-- Invoker trigger: current_user sees the actual role of a direct API write.
-- Trusted server writers keep provisioning/first-login workflows. Ordinary
-- authenticated callers cannot change identity, tenancy, security or lifecycle.
CREATE OR REPLACE FUNCTION public.workflow_guard_profile_write() RETURNS trigger
LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE
  v_admin boolean;
  v_allowed text[] := ARRAY['first_name','last_name','full_name','display_name',
    'phone','avatar_url','preferred_product_key','theme_preference','locale',
    'timezone','updated_at'];
BEGIN
  IF current_user IN ('postgres','service_role','supabase_auth_admin') THEN
    IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
  END IF;
  IF current_user <> 'authenticated' OR auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Profile write requires authenticated actor' USING ERRCODE='42501';
  END IF;
  v_admin := COALESCE(public.is_tenant_admin(),FALSE);
  IF TG_OP='DELETE' THEN
    IF NOT v_admin OR OLD.tenant_id IS DISTINCT FROM public.current_tenant_id() THEN
      RAISE EXCEPTION 'Profile deletion requires tenant administrator' USING ERRCODE='42501';
    END IF;
    RETURN OLD;
  END IF;
  IF TG_OP='INSERT' THEN
    IF NOT v_admin OR NEW.tenant_id IS DISTINCT FROM public.current_tenant_id() THEN
      RAISE EXCEPTION 'Profile creation requires tenant administrator' USING ERRCODE='42501';
    END IF;
  ELSE
    IF NEW.id IS DISTINCT FROM OLD.id
      OR NEW.auth_user_id IS DISTINCT FROM OLD.auth_user_id
      OR NEW.tenant_id IS DISTINCT FROM OLD.tenant_id
      OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
      RAISE EXCEPTION 'Profile identity is immutable for direct API writes' USING ERRCODE='42501';
    END IF;
    IF NOT v_admin AND (
      NOT COALESCE(OLD.auth_user_id=auth.uid() OR (OLD.auth_user_id IS NULL AND OLD.id=auth.uid()),FALSE)
      OR OLD.tenant_id IS DISTINCT FROM public.current_tenant_id()
      OR (to_jsonb(NEW)-v_allowed) IS DISTINCT FROM (to_jsonb(OLD)-v_allowed)
    ) THEN
      RAISE EXCEPTION 'Only personal profile fields may be changed' USING ERRCODE='42501';
    END IF;
  END IF;
  IF NEW.role_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.roles r WHERE r.id=NEW.role_id
      AND (r.tenant_id=NEW.tenant_id OR r.tenant_id IS NULL)
  ) THEN
    RAISE EXCEPTION 'Profile role belongs to another tenant' USING ERRCODE='42501';
  END IF;
  RETURN NEW;
END
$$;
REVOKE ALL ON FUNCTION public.workflow_guard_profile_write() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS workflow_guard_profile_write ON public.profiles;
CREATE TRIGGER workflow_guard_profile_write BEFORE INSERT OR UPDATE OR DELETE
  ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.workflow_guard_profile_write();

DROP POLICY IF EXISTS workflow_profile_update_ceiling ON public.profiles;
CREATE POLICY workflow_profile_update_ceiling ON public.profiles AS RESTRICTIVE
  FOR UPDATE TO authenticated
  USING (tenant_id IS NOT DISTINCT FROM public.current_tenant_id()
    AND (auth_user_id=auth.uid() OR (auth_user_id IS NULL AND id=auth.uid()) OR public.is_tenant_admin()))
  WITH CHECK (tenant_id IS NOT DISTINCT FROM public.current_tenant_id()
    AND (auth_user_id=auth.uid() OR (auth_user_id IS NULL AND id=auth.uid()) OR public.is_tenant_admin()));

-- Restrictive policies cannot be OR-bypassed by existing permissive rules.
DO $$
DECLARE t text; op text;
BEGIN
  FOREACH t IN ARRAY ARRAY['profiles','roles','role_permissions','tenant_users'] LOOP
    FOREACH op IN ARRAY ARRAY['INSERT','UPDATE','DELETE'] LOOP
      IF t='profiles' AND op='UPDATE' THEN CONTINUE; END IF;
      EXECUTE format('DROP POLICY IF EXISTS workflow_identity_%s_ceiling ON public.%I',lower(op),t);
      EXECUTE format(
        'CREATE POLICY workflow_identity_%s_ceiling ON public.%I AS RESTRICTIVE FOR %s TO authenticated %s %s',
        lower(op),t,op,
        CASE WHEN op='INSERT' THEN '' ELSE
          'USING (tenant_id=public.current_tenant_id() AND public.is_tenant_admin())' END,
        CASE WHEN op='DELETE' THEN '' ELSE
          'WITH CHECK (tenant_id=public.current_tenant_id() AND public.is_tenant_admin())' END
      );
    END LOOP;
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.workflow_guard_role_permission_scope() RETURNS trigger
LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  IF NEW.role_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.roles r WHERE r.id=NEW.role_id
      AND r.tenant_id IS NOT DISTINCT FROM NEW.tenant_id
  ) THEN
    RAISE EXCEPTION 'Role permission tenant must match role tenant' USING ERRCODE='42501';
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.workflow_guard_role_permission_scope() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS workflow_guard_role_permission_scope ON public.role_permissions;
CREATE TRIGGER workflow_guard_role_permission_scope BEFORE INSERT OR UPDATE
 ON public.role_permissions FOR EACH ROW EXECUTE FUNCTION public.workflow_guard_role_permission_scope();

-- Direct Office account management remains possible. Service-role Edge login
-- and password updates bypass these ceilings; portal actors cannot create codes,
-- rebind Auth IDs or change another user's credentials through the table API.
DO $$
DECLARE t text; predicate text; op text;
BEGIN
  FOREACH t IN ARRAY ARRAY['employee_portal_accounts','client_portal_codes',
    'relative_portal_codes','client_portal_access'] LOOP
    predicate := CASE WHEN t='employee_portal_accounts' THEN
      '(public.has_permission(''office.employees.edit'') OR public.is_tenant_admin())'
      ELSE '(public.has_permission(''office.clients.edit'') OR public.is_tenant_admin())' END;
    FOREACH op IN ARRAY ARRAY['INSERT','UPDATE','DELETE'] LOOP
      EXECUTE format('DROP POLICY IF EXISTS workflow_account_%s_ceiling ON public.%I',lower(op),t);
      EXECUTE format(
        'CREATE POLICY workflow_account_%s_ceiling ON public.%I AS RESTRICTIVE FOR %s TO authenticated %s %s',
        lower(op),t,op,
        CASE WHEN op='INSERT' THEN '' ELSE
          format('USING (tenant_id=public.current_tenant_id() AND %s)',predicate) END,
        CASE WHEN op='DELETE' THEN '' ELSE
          format('WITH CHECK (tenant_id=public.current_tenant_id() AND %s)',predicate) END
      );
    END LOOP;
  END LOOP;
END $$;
COMMIT;

