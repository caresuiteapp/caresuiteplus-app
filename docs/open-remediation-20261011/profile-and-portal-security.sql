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
        'preferred_product_key','theme_preference','locale','timezone','last_login_at','updated_at']) LOOP
    EXECUTE format('GRANT UPDATE (%I) ON public.profiles TO authenticated', column_name);
  END LOOP;
END
$body$;

-- Keep authorized role administration available after identity-column revocation.
CREATE OR REPLACE FUNCTION public.care_security_set_profile_role(p_tenant uuid,p_profile uuid,p_role uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $body$
DECLARE v_actor uuid; v_role_scope text; v_updated uuid;
BEGIN
  IF auth.uid() IS NULL OR (SELECT count(*) FROM public.profiles p
    WHERE p.auth_user_id=auth.uid() OR (p.auth_user_id IS NULL AND p.id=auth.uid())) <> 1 THEN
    RAISE EXCEPTION 'Verified profile required' USING ERRCODE='42501';
  END IF;
  SELECT p.id INTO v_actor FROM public.profiles p JOIN public.roles r ON r.id=p.role_id
    WHERE (p.auth_user_id=auth.uid() OR (p.auth_user_id IS NULL AND p.id=auth.uid()))
      AND p.tenant_id=p_tenant AND p.is_active IS TRUE AND p.status::text='active'
      AND (to_jsonb(r)->>'tenant_id' IS NULL OR to_jsonb(r)->>'tenant_id'=p_tenant::text)
      AND r.key NOT IN ('employee_portal','client_portal','family_portal','employee','client','family','relative','caregiver','nurse')
      AND (coalesce(r.is_admin_role,false) OR r.key IN ('owner','admin','business_admin')
        OR coalesce((to_jsonb(r)->>'can_manage_roles')::boolean,false));
  IF v_actor IS NULL THEN RAISE EXCEPTION 'Role administration denied' USING ERRCODE='42501'; END IF;
  SELECT to_jsonb(r)->>'tenant_id' INTO v_role_scope FROM public.roles r WHERE r.id=p_role;
  IF NOT FOUND OR (v_role_scope IS NOT NULL AND v_role_scope <> p_tenant::text) THEN
    RAISE EXCEPTION 'Role scope mismatch' USING ERRCODE='42501';
  END IF;
  UPDATE public.profiles SET role_id=p_role,updated_at=now()
    WHERE id=p_profile AND tenant_id=p_tenant RETURNING id INTO v_updated;
  IF v_updated IS NULL THEN RAISE EXCEPTION 'Profile scope mismatch' USING ERRCODE='42501'; END IF;
  RETURN jsonb_build_object('tenant_id',p_tenant,'profile_id',v_updated,'role_id',p_role);
END
$body$;
REVOKE ALL ON FUNCTION public.care_security_set_profile_role(uuid,uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.care_security_set_profile_role(uuid,uuid,uuid) TO authenticated;

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

-- Newly generated immutable PDFs cannot inherit the old tenant-wide storage rules.
CREATE OR REPLACE FUNCTION care_security.generated_pdf_reader(p_path text)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $body$
DECLARE v_tenant uuid:=public.current_tenant_id(); v_payroll boolean:=false;
BEGIN
  IF auth.uid() IS NULL OR v_tenant IS NULL
    OR p_path NOT LIKE 'tenant/'||v_tenant::text||'/generated/%' THEN RETURN false; END IF;
  IF care_security.office_actor(v_tenant,'office.documents.view')
    OR care_security.office_actor(v_tenant,'documents.finalize') THEN RETURN true; END IF;
  IF EXISTS(SELECT 1 FROM public.client_documents d WHERE d.tenant_id=v_tenant AND d.storage_path=p_path
    AND d.client_id=public.current_client_id() AND d.portal_visible IS TRUE
    AND d.status::text IN ('aktiv','abgeschlossen','bestaetigt')
    AND d.sensitivity NOT IN ('internal','restricted')) THEN RETURN true; END IF;
  IF EXISTS(SELECT 1 FROM public.employee_documents d WHERE d.tenant_id=v_tenant AND d.storage_path=p_path
    AND d.employee_id=public.resolve_current_employee_id() AND d.released_to_portal IS TRUE
    AND d.sensitive IS FALSE) THEN RETURN true; END IF;
  -- Stage has not installed payroll tables yet; the remaining floor still applies.
  IF to_regclass('public.payroll_month_statements') IS NOT NULL THEN
    EXECUTE 'SELECT EXISTS(SELECT 1 FROM public.payroll_month_statements s WHERE s.tenant_id=$1 AND s.pdf_path=$2 AND s.employee_id=$3)'
      INTO v_payroll USING v_tenant,p_path,public.resolve_current_employee_id();
  END IF;
  RETURN v_payroll;
END
$body$;
REVOKE ALL ON FUNCTION care_security.generated_pdf_reader(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION care_security.generated_pdf_reader(text) TO authenticated,service_role;
DROP POLICY IF EXISTS care_security_generated_pdf_read ON storage.objects;
CREATE POLICY care_security_generated_pdf_read ON storage.objects AS RESTRICTIVE FOR SELECT TO authenticated
  USING(bucket_id <> 'office-documents' OR (storage.foldername(name))[1] IS DISTINCT FROM 'tenant'
    OR (storage.foldername(name))[3] IS DISTINCT FROM 'generated' OR care_security.generated_pdf_reader(name));
DROP POLICY IF EXISTS care_security_generated_pdf_insert ON storage.objects;
CREATE POLICY care_security_generated_pdf_insert ON storage.objects AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK(bucket_id <> 'office-documents' OR (storage.foldername(name))[1] IS DISTINCT FROM 'tenant'
    OR (storage.foldername(name))[3] IS DISTINCT FROM 'generated');
DROP POLICY IF EXISTS care_security_generated_pdf_update ON storage.objects;
CREATE POLICY care_security_generated_pdf_update ON storage.objects AS RESTRICTIVE FOR UPDATE TO authenticated
  USING(bucket_id <> 'office-documents' OR (storage.foldername(name))[1] IS DISTINCT FROM 'tenant'
    OR (storage.foldername(name))[3] IS DISTINCT FROM 'generated')
  WITH CHECK(bucket_id <> 'office-documents' OR (storage.foldername(name))[1] IS DISTINCT FROM 'tenant'
    OR (storage.foldername(name))[3] IS DISTINCT FROM 'generated');
DROP POLICY IF EXISTS care_security_generated_pdf_delete ON storage.objects;
CREATE POLICY care_security_generated_pdf_delete ON storage.objects AS RESTRICTIVE FOR DELETE TO authenticated
  USING(bucket_id <> 'office-documents' OR (storage.foldername(name))[1] IS DISTINCT FROM 'tenant'
    OR (storage.foldername(name))[3] IS DISTINCT FROM 'generated');

CREATE OR REPLACE FUNCTION public.care_security_pdf_upload_ready()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $body$
  SELECT auth.uid() IS NOT NULL
    AND (SELECT count(*)=6 AND bool_and(NOT has_column_privilege('authenticated','public.profiles',a.attname,'UPDATE'))
      FROM pg_attribute a WHERE a.attrelid='public.profiles'::regclass AND NOT a.attisdropped
      AND a.attname IN ('id','tenant_id','role_id','auth_user_id','status','is_active'))
    AND (SELECT count(*)=4 FROM pg_policy p WHERE p.polrelid='storage.objects'::regclass
      AND NOT p.polpermissive AND p.polname IN ('care_security_generated_pdf_read','care_security_generated_pdf_insert',
        'care_security_generated_pdf_update','care_security_generated_pdf_delete'))
    AND to_regprocedure('public.care_security_set_profile_role(uuid,uuid,uuid)') IS NOT NULL
    AND to_regprocedure('care_security.generated_pdf_reader(text)') IS NOT NULL
$body$;
REVOKE ALL ON FUNCTION public.care_security_pdf_upload_ready() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.care_security_pdf_upload_ready() TO authenticated,service_role;
COMMIT;
