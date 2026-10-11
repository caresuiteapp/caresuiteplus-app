-- REVIEW DRAFT ONLY, never applied to production/staging.
-- Depends on workflow-server-identity-draft.sql. Existing Office grants remain;
-- restrictive policies close broad permissive tenant-only personnel policies.
-- Own role/config reads are allowed, own permission/lifecycle writes are not.
BEGIN;
CREATE OR REPLACE FUNCTION public.workflow_is_employee_actor(p_tenant_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT p_tenant_id=public.current_tenant_id() AND auth.uid() IS NOT NULL
 AND public.resolve_current_employee_id() IS NOT NULL
 AND (
  (public.current_portal_type()='employee' AND public.is_employee_portal_rls_context(p_tenant_id))
  OR (public.current_portal_type() IS NULL AND public.current_role_key() IN
       ('employee','employee_portal','caregiver','nurse')
    AND EXISTS (
      SELECT 1 FROM public.employees e JOIN public.profiles p ON p.id=e.profile_id
      WHERE e.id=public.resolve_current_employee_id() AND e.tenant_id=p_tenant_id
       AND p.tenant_id=e.tenant_id AND (p.auth_user_id=auth.uid() OR (p.auth_user_id IS NULL AND p.id=auth.uid()))
       AND p.status='active' AND p.is_active AND e.status='active'
    ))
 )
$$;
REVOKE ALL ON FUNCTION public.workflow_is_employee_actor(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.workflow_is_employee_actor(uuid) TO authenticated,service_role;

CREATE OR REPLACE FUNCTION public.workflow_personnel_can_read(p_table text,p_tenant uuid,p_employee uuid)
RETURNS boolean LANGUAGE sql STABLE SET search_path=public,pg_temp AS $$
 SELECT p_tenant=public.current_tenant_id()
 AND (
  (public.has_permission('office.employees.view') OR public.is_tenant_admin())
  AND (p_table NOT IN ('employee_background_checks','employee_offboarding_sessions',
    'employee_offboarding_steps','employee_offboarding_checks','employee_access_revocations',
    'employee_final_clearance') OR public.is_tenant_admin())
  OR (p_table IN ('employee_data_scopes','employee_role_assignments',
       'employee_permission_overrides','employee_work_settings')
    AND public.workflow_is_employee_actor(p_tenant)
    AND p_employee=public.resolve_current_employee_id())
 )
$$;
REVOKE ALL ON FUNCTION public.workflow_personnel_can_read(text,uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.workflow_personnel_can_read(text,uuid,uuid) TO authenticated,service_role;

CREATE OR REPLACE FUNCTION public.workflow_guard_personnel_scope() RETURNS trigger
LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
BEGIN
 IF NEW.employee_id IS NULL OR NOT EXISTS (
   SELECT 1 FROM public.employees e WHERE e.id=NEW.employee_id AND e.tenant_id=NEW.tenant_id
 ) THEN RAISE EXCEPTION 'Personnel employee tenant mismatch' USING ERRCODE='42501'; END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.workflow_guard_personnel_scope() FROM PUBLIC,anon,authenticated;
DO $$
DECLARE t text; op text; predicate text;
BEGIN
 FOREACH t IN ARRAY ARRAY['employee_absences','employee_data_scopes','employee_audit_events',
 'employee_background_checks','employee_permission_overrides','employee_qualifications',
 'employee_role_assignments','employee_work_settings','employee_offboarding_sessions',
 'employee_offboarding_steps','employee_offboarding_checks','employee_access_revocations',
 'employee_final_clearance'] LOOP
  EXECUTE format('DROP POLICY IF EXISTS workflow_personnel_read_ceiling ON public.%I',t);
  EXECUTE format('CREATE POLICY workflow_personnel_read_ceiling ON public.%I AS RESTRICTIVE
    FOR SELECT TO authenticated USING (public.workflow_personnel_can_read(%L,tenant_id,employee_id))',t,t);
  predicate := 'tenant_id=public.current_tenant_id() AND ' ||
   CASE WHEN t IN ('employee_data_scopes','employee_permission_overrides','employee_role_assignments',
    'employee_offboarding_sessions','employee_offboarding_steps','employee_offboarding_checks',
    'employee_access_revocations','employee_final_clearance','employee_background_checks')
   THEN 'public.is_tenant_admin()'
   ELSE '(public.has_permission(''office.employees.edit'') OR public.is_tenant_admin())' END;
  FOREACH op IN ARRAY ARRAY['INSERT','UPDATE','DELETE'] LOOP
   EXECUTE format('DROP POLICY IF EXISTS workflow_personnel_%s_ceiling ON public.%I',lower(op),t);
   EXECUTE format('CREATE POLICY workflow_personnel_%s_ceiling ON public.%I AS RESTRICTIVE FOR %s TO authenticated %s %s',
    lower(op),t,op,CASE WHEN op='INSERT' THEN '' ELSE format('USING (%s)',predicate) END,
    CASE WHEN op='DELETE' THEN '' ELSE format('WITH CHECK (%s)',predicate) END);
  END LOOP;
  EXECUTE format('DROP TRIGGER IF EXISTS workflow_guard_personnel_scope ON public.%I',t);
  EXECUTE format('CREATE TRIGGER workflow_guard_personnel_scope BEFORE INSERT OR UPDATE ON public.%I
    FOR EACH ROW EXECUTE FUNCTION public.workflow_guard_personnel_scope()',t);
 END LOOP;
END $$;
-- Supersede the previous personal-document read ceiling: verified legacy
-- employee IDs work, and actual owner/admin role keys permit sensitive reads.
DROP POLICY IF EXISTS employee_documents_release_read_ceiling ON public.employee_documents;
CREATE POLICY employee_documents_release_read_ceiling ON public.employee_documents AS RESTRICTIVE
 FOR SELECT TO authenticated USING (
 tenant_id=public.current_tenant_id() AND (
  ((public.has_permission('office.employees.view') OR public.is_tenant_admin())
    AND ((sensitive IS FALSE AND lower(COALESCE(category,'')) NOT IN
      ('background_check','warning','termination','confidentiality')) OR public.is_tenant_admin()))
  OR (public.workflow_is_employee_actor(tenant_id) AND employee_id=public.resolve_current_employee_id()
    AND released_to_portal IS TRUE AND sensitive IS FALSE
    AND lower(COALESCE(category,'')) NOT IN ('background_check','warning','termination','confidentiality'))
 ));
COMMIT;

