BEGIN;
CREATE SCHEMA IF NOT EXISTS care_security;
REVOKE ALL ON SCHEMA care_security FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA care_security TO authenticated, service_role;

CREATE OR REPLACE FUNCTION care_security.office_actor(p_tenant uuid, p_permission text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog AS $body$
  SELECT auth.uid() IS NOT NULL AND p_tenant = public.current_tenant_id()
    AND EXISTS (
      SELECT 1 FROM public.profiles p JOIN public.roles r ON r.id = p.role_id
      WHERE (p.auth_user_id = auth.uid() OR (p.auth_user_id IS NULL AND p.id = auth.uid()))
        AND p.tenant_id = p_tenant AND p.status::text = 'active' AND p.is_active
        AND (to_jsonb(r)->>'tenant_id' IS NULL OR to_jsonb(r)->>'tenant_id' = p_tenant::text)
        AND r.key NOT IN ('employee_portal', 'client_portal', 'family_portal')
        AND (coalesce(r.is_admin_role, false)
          OR r.key IN ('owner', 'admin', 'management', 'geschaeftsfuehrung', 'business_admin')
          OR public.has_permission(p_permission))
    )
$body$;
REVOKE ALL ON FUNCTION care_security.office_actor(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION care_security.office_actor(uuid,text) TO authenticated, service_role;

-- A column revoke alone would not override an existing table-level grant.
REVOKE UPDATE ON public.profiles FROM PUBLIC, anon, authenticated;
DO $body$
DECLARE column_name text;
BEGIN
  FOR column_name IN SELECT a.attname FROM pg_attribute a
    WHERE a.attrelid = 'public.profiles'::regclass AND a.attnum > 0 AND NOT a.attisdropped LOOP
    EXECUTE format('REVOKE UPDATE (%I) ON public.profiles FROM PUBLIC, anon, authenticated', column_name);
  END LOOP;
  FOR column_name IN SELECT a.attname FROM pg_attribute a
    WHERE a.attrelid = 'public.profiles'::regclass AND a.attnum > 0 AND NOT a.attisdropped
      AND a.attname = ANY(ARRAY['first_name','last_name','full_name','display_name','phone','avatar_url',
        'preferred_product_key','theme_preference','locale','timezone','last_login_at']) LOOP
    EXECUTE format('GRANT UPDATE (%I) ON public.profiles TO authenticated', column_name);
  END LOOP;
END
$body$;

CREATE OR REPLACE FUNCTION care_security.client_reader(p_tenant uuid,p_client uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog AS $body$
  SELECT p_tenant = public.current_tenant_id() AND auth.uid() IS NOT NULL AND (
    care_security.office_actor(p_tenant,'office.clients.view')
    OR p_client = public.current_client_id()
    OR (public.resolve_current_employee_id() IS NOT NULL AND (
      EXISTS (SELECT 1 FROM public.assignments a WHERE a.tenant_id=p_tenant AND a.client_id=p_client
        AND a.employee_id=public.resolve_current_employee_id())
      OR EXISTS (SELECT 1 FROM public.assist_visits v WHERE v.tenant_id=p_tenant AND v.client_id=p_client
        AND v.employee_id=public.resolve_current_employee_id()
        AND v.employee_portal_visible IS TRUE AND v.planning_status::text <> 'draft')
    ))
  )
$body$;
REVOKE ALL ON FUNCTION care_security.client_reader(uuid,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION care_security.client_reader(uuid,uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS care_security_read_ceiling ON public.clients;
CREATE POLICY care_security_read_ceiling ON public.clients AS RESTRICTIVE FOR SELECT TO authenticated
  USING(care_security.client_reader(tenant_id,id));
DROP POLICY IF EXISTS care_security_read_ceiling ON public.employees;
CREATE POLICY care_security_read_ceiling ON public.employees AS RESTRICTIVE FOR SELECT TO authenticated
  USING(tenant_id=public.current_tenant_id() AND auth.uid() IS NOT NULL AND (
    id=public.resolve_current_employee_id() OR care_security.office_actor(tenant_id,'office.employees.view')
    OR care_security.office_actor(tenant_id,'assist.assignments.manage')));
DROP POLICY IF EXISTS care_security_read_ceiling ON public.employee_documents;
CREATE POLICY care_security_read_ceiling ON public.employee_documents AS RESTRICTIVE FOR SELECT TO authenticated
  USING(tenant_id=public.current_tenant_id() AND auth.uid() IS NOT NULL AND (
    care_security.office_actor(tenant_id,'office.employees.view')
    OR (employee_id=public.resolve_current_employee_id() AND released_to_portal IS TRUE AND sensitive IS FALSE)));
DROP POLICY IF EXISTS care_security_insert_ceiling ON public.employee_documents;
CREATE POLICY care_security_insert_ceiling ON public.employee_documents AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK(care_security.office_actor(tenant_id,'office.employees.edit'));
DROP POLICY IF EXISTS care_security_update_ceiling ON public.employee_documents;
CREATE POLICY care_security_update_ceiling ON public.employee_documents AS RESTRICTIVE FOR UPDATE TO authenticated
  USING(care_security.office_actor(tenant_id,'office.employees.edit'))
  WITH CHECK(care_security.office_actor(tenant_id,'office.employees.edit'));
DROP POLICY IF EXISTS care_security_delete_ceiling ON public.employee_documents;
CREATE POLICY care_security_delete_ceiling ON public.employee_documents AS RESTRICTIVE FOR DELETE TO authenticated
  USING(care_security.office_actor(tenant_id,'office.employees.edit'));
COMMIT;
