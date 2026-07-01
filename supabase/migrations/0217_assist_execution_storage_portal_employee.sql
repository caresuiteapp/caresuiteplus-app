-- Portal employee may upload assist execution artifacts (signatures, proof snapshots).
-- Root cause: 0157 policy required is_tenant_member only — pure employee_portal actors blocked proof JSON upload.

DROP POLICY IF EXISTS "assist_execution_storage_portal_insert" ON storage.objects;
CREATE POLICY "assist_execution_storage_portal_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'office-documents'
    AND (storage.foldername(name))[1] = 'tenant'
    AND (storage.foldername(name))[2] = public.current_tenant_id()::text
    AND (storage.foldername(name))[3] = 'assist'
    AND (storage.foldername(name))[4] = 'visits'
    AND public.is_employee_portal_rls_context(public.current_tenant_id())
  );

DROP POLICY IF EXISTS "assist_execution_storage_portal_select" ON storage.objects;
CREATE POLICY "assist_execution_storage_portal_select"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'office-documents'
    AND (storage.foldername(name))[1] = 'tenant'
    AND (storage.foldername(name))[2] = public.current_tenant_id()::text
    AND (storage.foldername(name))[3] = 'assist'
    AND (storage.foldername(name))[4] = 'visits'
    AND public.is_employee_portal_rls_context(public.current_tenant_id())
  );
