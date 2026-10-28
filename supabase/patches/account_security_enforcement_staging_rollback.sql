-- STAGING ONLY: restore captured helper definitions and remove only this rollout's added policies.
BEGIN;
DO $rollback$ DECLARE r record; BEGIN FOR r IN SELECT schemaname,tablename FROM pg_policies WHERE policyname='account_security_session_guard' AND schemaname IN ('public','storage') LOOP EXECUTE format('DROP POLICY account_security_session_guard ON %I.%I',r.schemaname,r.tablename); END LOOP; END $rollback$;
CREATE OR REPLACE FUNCTION public.current_role_key()
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT COALESCE(
    NULLIF(auth.jwt()->'app_metadata'->>'role_key', ''),
    (
      SELECT r.key
      FROM public.profiles p
      JOIN public.roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() OR p.auth_user_id = auth.uid()
      LIMIT 1
    ),
    (
      SELECT 'employee_portal'::text
      FROM public.employee_portal_accounts epa
      WHERE epa.auth_user_id = auth.uid()
        AND epa.tenant_id = public.current_tenant_id()
        AND epa.status IN ('active', 'pending_first_login')
      LIMIT 1
    ),
    (
      SELECT 'client_portal'::text
      FROM public.client_portal_access cpa
      WHERE cpa.auth_user_id = auth.uid()
        AND cpa.tenant_id = public.current_tenant_id()
        AND cpa.portal_enabled = TRUE
      LIMIT 1
    ),
    (
      SELECT 'client_portal'::text
      FROM public.client_portal_codes cpc
      WHERE cpc.auth_user_id = auth.uid()
        AND cpc.tenant_id = public.current_tenant_id()
      LIMIT 1
    )
  )
$function$
;
DROP FUNCTION account_security.original_current_role_key();
CREATE OR REPLACE FUNCTION public.current_tenant_id()
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT COALESCE(
    (
      SELECT p.tenant_id
      FROM public.profiles p
      WHERE p.id = auth.uid() OR p.auth_user_id = auth.uid()
      LIMIT 1
    ),
    (
      SELECT cpa.tenant_id
      FROM public.client_portal_access cpa
      WHERE cpa.auth_user_id = auth.uid()
      LIMIT 1
    ),
    (
      SELECT epa.tenant_id
      FROM public.employee_portal_accounts epa
      WHERE epa.auth_user_id = auth.uid()
      LIMIT 1
    ),
    NULLIF(auth.jwt()->'app_metadata'->>'tenant_id', '')::uuid
  )
$function$
;
DROP FUNCTION account_security.original_current_tenant_id();
CREATE OR REPLACE FUNCTION public.has_permission(p_permission_key text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles pr
    JOIN public.role_permissions rp ON rp.role_id = pr.role_id
    WHERE (pr.id = auth.uid() OR pr.auth_user_id = auth.uid())
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
  )
$function$
;
DROP FUNCTION account_security.original_has_permission(text);
COMMIT;

