-- Authoritative company access. Apply before organization/resources.
BEGIN;
CREATE SCHEMA IF NOT EXISTS care_security;
REVOKE ALL ON SCHEMA care_security FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA care_security TO authenticated, service_role;

-- Never derive Office authority from caller-supplied IDs or user_metadata.
CREATE OR REPLACE FUNCTION care_security.company_profile(p_tenant uuid)
RETURNS uuid LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $body$
DECLARE v_profile uuid; v_count integer; v_claim text;
BEGIN
  IF auth.uid() IS NULL OR p_tenant IS DISTINCT FROM public.current_tenant_id() THEN RETURN NULL; END IF;
  v_claim:=lower(coalesce(auth.jwt()->'app_metadata'->>'role_key',''));
  IF v_claim IN ('employee_portal','client_portal','family_portal','employee','client','family','relative','caregiver','nurse')
    OR lower(coalesce(auth.jwt()->'app_metadata'->>'portal','')) IN ('employee','client','family')
    OR lower(coalesce(auth.jwt()->'app_metadata'->>'portal_type','')) IN ('employee','client','family') THEN RETURN NULL; END IF;
  SELECT count(*),(array_agg(p.id))[1] INTO v_count,v_profile
  FROM public.profiles p JOIN public.roles r ON r.id=p.role_id
  WHERE (p.auth_user_id=auth.uid() OR (p.auth_user_id IS NULL AND p.id=auth.uid()))
    AND p.tenant_id=p_tenant AND p.status::text='active' AND p.is_active IS TRUE
    AND (to_jsonb(r)->>'tenant_id' IS NULL OR to_jsonb(r)->>'tenant_id'=p_tenant::text)
    AND lower(r.key) NOT IN ('employee_portal','client_portal','family_portal','employee','client','family','relative','caregiver','nurse');
  IF v_count<>1 THEN RETURN NULL; END IF;
  -- Duplicate/inactive personnel links must not silently discard an override.
  IF (SELECT count(*) FROM public.employees e WHERE e.profile_id=v_profile)>1
    OR EXISTS(SELECT 1 FROM public.employees e WHERE e.profile_id=v_profile
      AND (e.tenant_id IS DISTINCT FROM p_tenant OR e.status::text NOT IN ('active','aktiv'))) THEN RETURN NULL; END IF;
  RETURN v_profile;
END $body$;

-- Restrict writes to the permission sources before any new helper trusts them.
-- Existing personnel readers retain SELECT. Role administration stays an
-- explicit authority of the verified primary role, not a self-assigned grant.
CREATE OR REPLACE FUNCTION care_security.company_rbac_administrator(p_tenant uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $body$
  SELECT EXISTS(SELECT 1 FROM public.profiles p JOIN public.roles r ON r.id=p.role_id
    WHERE p.id=care_security.company_profile(p_tenant)
      AND (coalesce((to_jsonb(r)->>'is_admin_role')::boolean,false)
        OR coalesce((to_jsonb(r)->>'can_manage_roles')::boolean,false)
        OR lower(r.key) IN ('owner','admin','business_admin')))
$body$;

-- Tenant role sets replace the role's default list. An explicitly populated
-- role list is authoritative, even when it omits company management.
CREATE OR REPLACE FUNCTION care_security.company_role_permission(p_tenant uuid,p_role uuid,p_permission text)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $body$
DECLARE v_role public.roles%ROWTYPE;
BEGIN
  SELECT * INTO v_role FROM public.roles WHERE id=p_role;
  IF NOT FOUND OR (to_jsonb(v_role)->>'tenant_id' IS NOT NULL AND to_jsonb(v_role)->>'tenant_id'<>p_tenant::text)
    OR lower(v_role.key) IN ('employee_portal','client_portal','family_portal','employee','client','family','relative','caregiver','nurse') THEN RETURN false; END IF;
  IF EXISTS(SELECT 1 FROM public.role_permission_sets s WHERE s.tenant_id=p_tenant AND s.role_key=v_role.key) THEN
    RETURN EXISTS(SELECT 1 FROM public.role_permission_sets s WHERE s.tenant_id=p_tenant AND s.role_key=v_role.key AND s.permission_key=p_permission);
  END IF;
  IF EXISTS(SELECT 1 FROM public.role_permissions rp WHERE rp.role_id=p_role
    AND (to_jsonb(rp)->>'tenant_id' IS NULL OR to_jsonb(rp)->>'tenant_id'=p_tenant::text)) THEN
    -- Exact keys are grants in the established runtime contract. Legacy
    -- can_view defaults to false even on seeded exact management keys; those
    -- flags belong to coarse legacy modules, not removal of an exact grant.
    RETURN EXISTS(SELECT 1 FROM public.role_permissions rp WHERE rp.role_id=p_role AND rp.permission_key=p_permission
      AND (to_jsonb(rp)->>'tenant_id' IS NULL OR to_jsonb(rp)->>'tenant_id'=p_tenant::text));
  END IF;
  RETURN coalesce((to_jsonb(v_role)->>'is_admin_role')::boolean,false)
    OR lower(v_role.key) IN ('owner','admin','management','geschaeftsfuehrung','business_admin');
END $body$;

-- Permission evaluation without record scope; callers must apply scope before
-- returning any data. Kept private so it cannot become a broader table policy.
CREATE OR REPLACE FUNCTION care_security.company_permission(p_tenant uuid,p_permission text)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $body$
DECLARE v_profile uuid:=care_security.company_profile(p_tenant); v_employee uuid; v_role uuid;
BEGIN
  IF v_profile IS NULL OR p_permission IS NULL OR length(p_permission)>150 THEN RETURN false; END IF;
  SELECT role_id INTO v_role FROM public.profiles WHERE id=v_profile;
  SELECT id INTO v_employee FROM public.employees WHERE tenant_id=p_tenant AND profile_id=v_profile;
  IF v_employee IS NOT NULL THEN
    IF EXISTS(SELECT 1 FROM public.employee_permission_overrides o WHERE o.tenant_id=p_tenant AND o.employee_id=v_employee
      AND o.permission_key=p_permission AND o.allowed IS FALSE
      AND (o.valid_from IS NULL OR o.valid_from<=now()) AND (o.valid_until IS NULL OR o.valid_until>=now())) THEN RETURN false; END IF;
    IF EXISTS(SELECT 1 FROM public.employee_permission_overrides o WHERE o.tenant_id=p_tenant AND o.employee_id=v_employee
      AND o.permission_key=p_permission AND o.allowed IS TRUE
      AND (o.valid_from IS NULL OR o.valid_from<=now()) AND (o.valid_until IS NULL OR o.valid_until>=now())) THEN RETURN true; END IF;
    IF EXISTS(SELECT 1 FROM public.employee_role_assignments a JOIN public.role_templates t ON t.id=a.role_template_id
      JOIN public.role_template_permissions tp ON tp.role_template_id=t.id
      WHERE a.tenant_id=p_tenant AND a.employee_id=v_employee AND (t.tenant_id IS NULL OR t.tenant_id=p_tenant)
      AND tp.permission_key=p_permission AND tp.allowed IS TRUE
      AND lower(t.role_key) NOT IN ('employee_portal','client_portal','family_portal','employee','client','family','relative','caregiver','nurse')) THEN RETURN true; END IF;
    IF EXISTS(SELECT 1 FROM public.employee_role_assignments a JOIN public.roles r ON r.key=a.role_key
      WHERE a.tenant_id=p_tenant AND a.employee_id=v_employee
      AND care_security.company_role_permission(p_tenant,r.id,p_permission)) THEN RETURN true; END IF;
  END IF;
  RETURN care_security.company_role_permission(p_tenant,v_role,p_permission);
END $body$;

CREATE OR REPLACE FUNCTION care_security.company_unrestricted_scope(p_tenant uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $body$
  SELECT care_security.company_profile(p_tenant) IS NOT NULL AND NOT EXISTS(
    SELECT 1 FROM public.employee_data_scopes s JOIN public.employees e ON e.id=s.employee_id AND e.tenant_id=s.tenant_id
    WHERE s.tenant_id=p_tenant AND e.profile_id=care_security.company_profile(p_tenant)
      AND lower(btrim(s.module)) IN ('office','business','company','unternehmen','all','*','')
      AND (s.scope_type<>'tenant' OR nullif(btrim(s.scope_value),'') IS NOT NULL AND btrim(s.scope_value)<>p_tenant::text))
$body$;

CREATE OR REPLACE FUNCTION care_security.company_actor(p_tenant uuid,p_permission text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $body$
  SELECT care_security.company_permission(p_tenant,p_permission) AND care_security.company_unrestricted_scope(p_tenant)
$body$;

-- The row API is stable for organization/resources. Unmapped legacy free-text
-- scopes fail closed; adding a location label never grants company-wide access.
CREATE OR REPLACE FUNCTION care_security.company_record_access(p_tenant uuid,p_permission text,
  p_entity uuid DEFAULT NULL,p_site uuid DEFAULT NULL,p_department uuid DEFAULT NULL)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $body$
  SELECT care_security.company_actor(p_tenant,p_permission)
$body$;

CREATE OR REPLACE FUNCTION care_security.company_can_read(p_tenant uuid,p_permission text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $body$
  SELECT care_security.company_actor(p_tenant,p_permission)
$body$;

DO $body$
DECLARE v_table text; v_operation text;
BEGIN
  FOREACH v_table IN ARRAY ARRAY['employee_role_assignments','employee_permission_overrides','employee_data_scopes','role_permission_sets','role_templates'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',v_table);
    FOREACH v_operation IN ARRAY ARRAY['INSERT','UPDATE','DELETE'] LOOP
      EXECUTE format('DROP POLICY IF EXISTS company_rbac_%s_ceiling ON public.%I',lower(v_operation),v_table);
      EXECUTE format('CREATE POLICY company_rbac_%s_ceiling ON public.%I AS RESTRICTIVE FOR %s TO authenticated %s %s',
        lower(v_operation),v_table,v_operation,
        CASE WHEN v_operation<>'INSERT' THEN 'USING(care_security.company_rbac_administrator(tenant_id))' ELSE '' END,
        CASE WHEN v_operation<>'DELETE' THEN 'WITH CHECK(care_security.company_rbac_administrator(tenant_id))' ELSE '' END);
    END LOOP;
    EXECUTE format('REVOKE TRUNCATE,REFERENCES,TRIGGER ON public.%I FROM PUBLIC,anon,authenticated',v_table);
  END LOOP;
END $body$;
ALTER TABLE public.role_template_permissions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS company_template_insert_ceiling ON public.role_template_permissions;
CREATE POLICY company_template_insert_ceiling ON public.role_template_permissions AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK(EXISTS(SELECT 1 FROM public.role_templates t WHERE t.id=role_template_id AND care_security.company_rbac_administrator(t.tenant_id)));
DROP POLICY IF EXISTS company_template_update_ceiling ON public.role_template_permissions;
CREATE POLICY company_template_update_ceiling ON public.role_template_permissions AS RESTRICTIVE FOR UPDATE TO authenticated
  USING(EXISTS(SELECT 1 FROM public.role_templates t WHERE t.id=role_template_id AND care_security.company_rbac_administrator(t.tenant_id)))
  WITH CHECK(EXISTS(SELECT 1 FROM public.role_templates t WHERE t.id=role_template_id AND care_security.company_rbac_administrator(t.tenant_id)));
DROP POLICY IF EXISTS company_template_delete_ceiling ON public.role_template_permissions;
CREATE POLICY company_template_delete_ceiling ON public.role_template_permissions AS RESTRICTIVE FOR DELETE TO authenticated
  USING(EXISTS(SELECT 1 FROM public.role_templates t WHERE t.id=role_template_id AND care_security.company_rbac_administrator(t.tenant_id)));
REVOKE TRUNCATE,REFERENCES,TRIGGER ON public.role_template_permissions FROM PUBLIC,anon,authenticated;

-- The primary role and identity links are trust roots, not tenant-editable grants.
REVOKE INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON public.roles,public.role_permissions FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION care_security.company_employee_identity_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $body$
DECLARE v_changed boolean; v_manager_link boolean;
BEGIN
  v_changed:=(TG_OP='INSERT' AND NEW.profile_id IS NOT NULL)
    OR (TG_OP='UPDATE' AND (NEW.profile_id IS DISTINCT FROM OLD.profile_id OR NEW.tenant_id IS DISTINCT FROM OLD.tenant_id OR NEW.id IS DISTINCT FROM OLD.id));
  IF auth.uid() IS NOT NULL AND v_changed AND NOT care_security.company_rbac_administrator(NEW.tenant_id) THEN
    -- Managers may complete ordinary onboarding. Rebinding one's own identity,
    -- a privileged access, or personnel with permission assignments stays role administration.
    v_manager_link:=NEW.profile_id IS NOT NULL AND NEW.profile_id IS DISTINCT FROM care_security.company_profile(NEW.tenant_id)
      AND (TG_OP='INSERT' OR (NEW.tenant_id=OLD.tenant_id AND NEW.id=OLD.id AND OLD.profile_id IS NULL))
      AND (care_security.company_actor(NEW.tenant_id,'office.employees.create') OR care_security.company_actor(NEW.tenant_id,'office.employees.edit'))
      AND NOT EXISTS(SELECT 1 FROM public.employee_role_assignments a WHERE a.tenant_id=NEW.tenant_id AND a.employee_id=NEW.id)
      AND NOT EXISTS(SELECT 1 FROM public.employee_permission_overrides o WHERE o.tenant_id=NEW.tenant_id AND o.employee_id=NEW.id)
      AND NOT EXISTS(SELECT 1 FROM public.employee_data_scopes s WHERE s.tenant_id=NEW.tenant_id AND s.employee_id=NEW.id)
      AND NOT EXISTS(SELECT 1 FROM public.employees e WHERE e.profile_id=NEW.profile_id AND e.id<>NEW.id)
      AND EXISTS(SELECT 1 FROM public.profiles p JOIN public.roles r ON r.id=p.role_id WHERE p.id=NEW.profile_id AND p.tenant_id=NEW.tenant_id
        AND NOT coalesce((to_jsonb(r)->>'is_admin_role')::boolean,false) AND NOT coalesce((to_jsonb(r)->>'can_manage_roles')::boolean,false)
        AND lower(r.key) NOT IN ('owner','admin','business_admin','management','geschaeftsfuehrung'));
    IF NOT coalesce(v_manager_link,false) THEN RAISE EXCEPTION 'Personnel identity changes require role administration' USING ERRCODE='42501'; END IF;
  END IF;
  IF NEW.profile_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=NEW.profile_id AND p.tenant_id=NEW.tenant_id) THEN
    RAISE EXCEPTION 'Personnel profile must belong to the same tenant' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $body$;
DROP TRIGGER IF EXISTS company_employee_identity_guard ON public.employees;
CREATE TRIGGER company_employee_identity_guard BEFORE INSERT OR UPDATE OF profile_id,tenant_id,id ON public.employees
  FOR EACH ROW EXECUTE FUNCTION care_security.company_employee_identity_guard();

CREATE OR REPLACE FUNCTION public.company_access_permissions(p_tenant_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path=pg_catalog AS $body$
  SELECT jsonb_build_object('permissions',coalesce(jsonb_agg(p ORDER BY p),'[]'::jsonb),
    'scopeLimited',NOT care_security.company_unrestricted_scope(p_tenant_id),
    'canManageScopes',care_security.company_actor(p_tenant_id,'business.tenant.manage') AND care_security.company_rbac_administrator(p_tenant_id))
  FROM unnest(ARRAY[
    'business.tenant.manage','inventory.view','inventory.manage_items','inventory.issue','inventory.return_manage','inventory.report_damage','inventory.offboarding','inventory.audit_view',
    'office.employees.view','office.employees.edit','office.documents.view']) p
  WHERE care_security.company_can_read(p_tenant_id,p)
$body$;

REVOKE ALL ON FUNCTION care_security.company_profile(uuid),care_security.company_rbac_administrator(uuid),care_security.company_role_permission(uuid,uuid,text),
  care_security.company_permission(uuid,text),care_security.company_unrestricted_scope(uuid),care_security.company_actor(uuid,text),
  care_security.company_record_access(uuid,text,uuid,uuid,uuid),care_security.company_can_read(uuid,text),care_security.company_employee_identity_guard(),public.company_access_permissions(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION care_security.company_profile(uuid),care_security.company_rbac_administrator(uuid),care_security.company_actor(uuid,text),
  care_security.company_record_access(uuid,text,uuid,uuid,uuid),care_security.company_unrestricted_scope(uuid),care_security.company_can_read(uuid,text),public.company_access_permissions(uuid) TO authenticated;
COMMIT;
