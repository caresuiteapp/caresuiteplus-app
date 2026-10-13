-- LOCAL REVIEW DRAFT, NOT APPLIED. Requires verified identity/helper contracts.
-- Restrictive ceilings defeat permissive tenant-only policies for owned private
-- paths. Assist/proof and other buckets/paths are outside this draft and remain
-- separate release gates; returning true outside its scope is NOT a security
-- assessment of those paths. Storage metadata cannot prove actual blob bytes.
BEGIN;
CREATE OR REPLACE FUNCTION public.workflow_managed_document_object(p_bucket text,p_name text)
 RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path=pg_catalog AS $$ SELECT
 p_bucket IN ('caresuite-documents','caresuite-signatures') OR (p_bucket='office-documents' AND
  (split_part(p_name,'/',3) IN ('portal','employees','clientdocs') OR
   (split_part(p_name,'/',3)='clients' AND split_part(p_name,'/',5) IN ('portal-uploads','documents')))) $$;
CREATE OR REPLACE FUNCTION public.workflow_document_object_readable(p_bucket text,p_name text)
 RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE v_tenant uuid:=public.current_tenant_id();d public.portal_signature_documents%ROWTYPE;
BEGIN
 IF auth.uid() IS NULL OR v_tenant IS NULL OR p_name ~ '(\.\.|[\\%?#])'
  OR p_name LIKE '%//%' OR split_part(p_name,'/',1)<>'tenant' OR split_part(p_name,'/',2)<>v_tenant::text THEN RETURN false; END IF;
 PERFORM public.workflow_current_verified_profile(v_tenant);
 -- Personnel references take precedence across buckets, including old aliases.
 IF EXISTS(SELECT 1 FROM public.employee_documents e WHERE e.tenant_id=v_tenant AND e.storage_path=p_name) THEN
  RETURN EXISTS(SELECT 1 FROM public.employee_documents e WHERE e.tenant_id=v_tenant AND e.storage_path=p_name AND (
   (public.is_internal_tenant_actor(v_tenant) AND public.has_permission('office.employees.view')
    AND ((e.sensitive IS FALSE AND lower(coalesce(e.category,'')) NOT IN ('background_check','warning','termination','confidentiality')) OR public.is_tenant_admin()))
   OR (e.employee_id=public.resolve_current_employee_id() AND e.employee_id IS NOT NULL AND e.released_to_portal AND e.sensitive IS FALSE
    AND lower(coalesce(e.category,'')) NOT IN ('background_check','warning','termination','confidentiality')
    AND (public.is_employee_portal_rls_context(v_tenant) OR (public.current_role_key() IN ('caregiver','nurse') AND public.is_internal_tenant_actor(v_tenant))))));
 END IF;
 IF p_bucket IN ('caresuite-documents','caresuite-signatures') THEN
  RETURN public.is_internal_tenant_actor(v_tenant) AND
   (CASE WHEN p_bucket='caresuite-signatures' THEN public.has_permission('office.documents.signatures.view') ELSE public.has_permission('office.documents.view') END);
 END IF;
 IF split_part(p_name,'/',3)='portal' THEN
  SELECT * INTO d FROM public.portal_signature_documents x WHERE x.tenant_id=v_tenant AND
   (x.storage_path=p_name OR x.final_storage_path=p_name OR EXISTS(SELECT 1 FROM public.portal_signature_captures c
     WHERE c.tenant_id=v_tenant AND c.document_id=x.id AND c.storage_path=p_name));
  IF NOT FOUND AND split_part(p_name,'/',4)='signatures' THEN
   SELECT * INTO d FROM public.portal_signature_documents x WHERE x.tenant_id=v_tenant
    AND x.id::text=split_part(p_name,'/',5) AND x.status NOT IN ('withdrawn','expired');
  END IF;
  IF NOT FOUND THEN RETURN public.is_internal_tenant_actor(v_tenant) AND public.has_permission('office.documents.signatures.manage'); END IF;
  IF public.is_internal_tenant_actor(v_tenant) AND public.has_permission('office.documents.signatures.view') THEN RETURN true; END IF;
  RETURN d.status NOT IN ('withdrawn','expired') AND (
   ((public.is_employee_portal_rls_context(v_tenant) OR (public.current_role_key() IN ('caregiver','nurse') AND public.is_internal_tenant_actor(v_tenant)))
    AND d.employee_id=public.resolve_current_employee_id() AND d.employee_id IS NOT NULL AND d.recipient_type='employee') OR
   (public.is_client_portal_rls_context(v_tenant) AND d.client_id=public.current_client_id() AND d.client_id IS NOT NULL AND d.recipient_type='client'));
 END IF;
 IF split_part(p_name,'/',3)='employees' THEN
  IF public.is_internal_tenant_actor(v_tenant) AND public.has_permission('office.employees.view') THEN
   RETURN NOT EXISTS(SELECT 1 FROM public.employee_documents e WHERE e.tenant_id=v_tenant AND e.storage_path=p_name
    AND (e.sensitive IS NOT FALSE OR lower(coalesce(e.category,'')) IN ('background_check','warning','termination','confidentiality')))
    OR public.is_tenant_admin();
  END IF;
  IF NOT(public.is_employee_portal_rls_context(v_tenant) OR (public.current_role_key() IN ('caregiver','nurse') AND public.is_internal_tenant_actor(v_tenant)))
   OR split_part(p_name,'/',4) IS DISTINCT FROM public.resolve_current_employee_id()::text THEN RETURN false; END IF;
  IF split_part(p_name,'/',5)='portal-uploads' THEN RETURN true; END IF;
  RETURN EXISTS(SELECT 1 FROM public.employee_documents e WHERE e.tenant_id=v_tenant
   AND e.employee_id=public.resolve_current_employee_id() AND e.storage_path=p_name AND e.released_to_portal
   AND e.sensitive IS FALSE AND lower(coalesce(e.category,'')) NOT IN ('background_check','warning','termination','confidentiality'));
 END IF;
 IF split_part(p_name,'/',3) IN ('clients','clientdocs') THEN
  IF public.is_internal_tenant_actor(v_tenant) AND public.has_permission('office.documents.view') THEN RETURN true; END IF;
  IF NOT public.is_client_portal_rls_context(v_tenant) OR public.current_client_id() IS NULL THEN RETURN false; END IF;
  IF split_part(p_name,'/',3)='clients' AND split_part(p_name,'/',4)=public.current_client_id()::text
   AND split_part(p_name,'/',5)='portal-uploads' THEN RETURN true; END IF;
  RETURN EXISTS(SELECT 1 FROM public.client_documents c WHERE c.tenant_id=v_tenant AND c.client_id=public.current_client_id()
   AND c.storage_path=p_name AND c.portal_visible AND c.status<>'gesperrt' AND c.sensitivity='care');
 END IF;
 RETURN false;
END $$;
CREATE OR REPLACE FUNCTION public.workflow_document_object_insertable(p_bucket text,p_name text,p_owner text)
 RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE v_tenant uuid:=public.current_tenant_id();d public.portal_signature_documents%ROWTYPE;
BEGIN
 IF auth.uid() IS NULL OR p_owner IS DISTINCT FROM auth.uid()::text OR v_tenant IS NULL
  OR p_name ~ '(\.\.|[\\%?#])' OR p_name LIKE '%//%' OR split_part(p_name,'/',1)<>'tenant'
  OR split_part(p_name,'/',2)<>v_tenant::text THEN RETURN false; END IF;
 PERFORM public.workflow_current_verified_profile(v_tenant);
 IF p_bucket IN ('caresuite-documents','caresuite-signatures') THEN RETURN public.is_internal_tenant_actor(v_tenant)
  AND public.has_permission('office.documents.upload'); END IF;
 IF split_part(p_name,'/',3)='portal' THEN
  IF public.is_internal_tenant_actor(v_tenant) AND public.has_permission('office.documents.signatures.manage') THEN RETURN true; END IF;
  IF split_part(p_name,'/',4)<>'signatures' OR p_name !~ ('^tenant/'||v_tenant||'/portal/signatures/[0-9a-f-]{36}/([0-9a-f-]{36}\.png|versions/[1-9][0-9]*/final-[0-9a-f]{64}\.pdf)$') THEN RETURN false; END IF;
  SELECT * INTO d FROM public.portal_signature_documents x WHERE x.tenant_id=v_tenant AND x.id::text=split_part(p_name,'/',5)
   AND x.status IN ('open','in_progress','partially_signed','fully_signed');
  IF NOT FOUND OR d.document_source_type='pdf_upload' THEN RETURN false; END IF;
  RETURN (d.employee_id IS NOT NULL AND d.employee_id=public.resolve_current_employee_id() AND d.recipient_type='employee'
   AND (public.is_employee_portal_rls_context(v_tenant) OR (public.current_role_key() IN ('caregiver','nurse') AND public.is_internal_tenant_actor(v_tenant))))
   OR (public.current_role_key()='client_portal' AND public.is_client_portal_rls_context(v_tenant)
    AND d.client_id=public.current_client_id() AND d.client_id IS NOT NULL AND d.recipient_type='client');
 END IF;
 IF split_part(p_name,'/',3)='employees' AND split_part(p_name,'/',5)='portal-uploads' THEN
  RETURN (public.is_internal_tenant_actor(v_tenant) AND public.has_permission('office.employees.edit')) OR
   (split_part(p_name,'/',4)=public.resolve_current_employee_id()::text AND public.resolve_current_employee_id() IS NOT NULL
    AND (public.is_employee_portal_rls_context(v_tenant) OR (public.current_role_key() IN ('caregiver','nurse') AND public.is_internal_tenant_actor(v_tenant))));
 END IF;
 IF split_part(p_name,'/',3)='clients' AND split_part(p_name,'/',5)='portal-uploads' THEN
  RETURN (public.is_internal_tenant_actor(v_tenant) AND public.has_permission('office.documents.upload')) OR
   (public.is_client_portal_rls_context(v_tenant) AND split_part(p_name,'/',4)=public.current_client_id()::text AND public.current_client_id() IS NOT NULL);
 END IF;
 RETURN public.is_internal_tenant_actor(v_tenant) AND public.has_permission('office.documents.upload');
END $$;
REVOKE ALL ON FUNCTION public.workflow_document_object_readable(text,text),public.workflow_document_object_insertable(text,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.workflow_document_object_readable(text,text),public.workflow_document_object_insertable(text,text,text) TO authenticated;
DROP POLICY IF EXISTS workflow_private_document_select_ceiling ON storage.objects;
CREATE POLICY workflow_private_document_select_ceiling ON storage.objects AS RESTRICTIVE FOR SELECT TO authenticated
 USING(NOT public.workflow_managed_document_object(bucket_id,name) OR public.workflow_document_object_readable(bucket_id,name));
DROP POLICY IF EXISTS workflow_private_document_insert_ceiling ON storage.objects;
CREATE POLICY workflow_private_document_insert_ceiling ON storage.objects AS RESTRICTIVE FOR INSERT TO authenticated
 WITH CHECK(NOT public.workflow_managed_document_object(bucket_id,name) OR public.workflow_document_object_insertable(bucket_id,name,owner_id));
DROP POLICY IF EXISTS workflow_private_document_update_ceiling ON storage.objects;
CREATE POLICY workflow_private_document_update_ceiling ON storage.objects AS RESTRICTIVE FOR UPDATE TO authenticated
 USING(NOT public.workflow_managed_document_object(bucket_id,name)) WITH CHECK(NOT public.workflow_managed_document_object(bucket_id,name));
DROP POLICY IF EXISTS workflow_private_document_delete_ceiling ON storage.objects;
CREATE POLICY workflow_private_document_delete_ceiling ON storage.objects AS RESTRICTIVE FOR DELETE TO authenticated
 USING(NOT public.workflow_managed_document_object(bucket_id,name));
-- No portal/browser may replace or delete a private original, capture or final
-- object. Supabase Storage owner/internal service semantics need staging proof;
-- in particular any service-role renderer and retention job must be audited.
COMMIT;
