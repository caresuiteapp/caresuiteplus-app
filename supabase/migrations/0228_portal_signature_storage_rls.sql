-- Portal signature storage: employee portal upload + tenant read for office-documents bucket.
-- Fresh-DB: storage.objects gehört supabase_storage_admin — Policies ggf. übersprungen

DO $portal_signature_storage$
BEGIN
  DROP POLICY IF EXISTS "portal_signature_storage_portal_insert" ON storage.objects;
  CREATE POLICY "portal_signature_storage_portal_insert"
    ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (
      bucket_id = 'office-documents'
      AND (storage.foldername(name))[1] = 'tenant'
      AND (storage.foldername(name))[2] = public.current_tenant_id()::text
      AND (storage.foldername(name))[3] = 'portal'
      AND (storage.foldername(name))[4] = 'signatures'
      AND public.is_employee_portal_rls_context(public.current_tenant_id())
    );

  DROP POLICY IF EXISTS "portal_signature_storage_portal_select" ON storage.objects;
  CREATE POLICY "portal_signature_storage_portal_select"
    ON storage.objects FOR SELECT TO authenticated
    USING (
      bucket_id = 'office-documents'
      AND (storage.foldername(name))[1] = 'tenant'
      AND (storage.foldername(name))[2] = public.current_tenant_id()::text
      AND (storage.foldername(name))[3] = 'portal'
      AND (storage.foldername(name))[4] = 'signatures'
      AND (
        public.is_tenant_member(public.current_tenant_id())
        OR public.is_employee_portal_rls_context(public.current_tenant_id())
      )
    );

  DROP POLICY IF EXISTS "portal_signature_storage_staff_upsert" ON storage.objects;
  CREATE POLICY "portal_signature_storage_staff_upsert"
    ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (
      bucket_id = 'office-documents'
      AND (storage.foldername(name))[1] = 'tenant'
      AND (storage.foldername(name))[2] = public.current_tenant_id()::text
      AND (storage.foldername(name))[3] = 'portal'
      AND (storage.foldername(name))[4] = 'signatures'
      AND public.is_tenant_member(public.current_tenant_id())
      AND public.current_role_key() NOT IN ('employee_portal', 'client_portal', 'family_portal')
    );

  DROP POLICY IF EXISTS "portal_signature_storage_staff_update" ON storage.objects;
  CREATE POLICY "portal_signature_storage_staff_update"
    ON storage.objects FOR UPDATE TO authenticated
    USING (
      bucket_id = 'office-documents'
      AND (storage.foldername(name))[1] = 'tenant'
      AND (storage.foldername(name))[2] = public.current_tenant_id()::text
      AND (storage.foldername(name))[3] = 'portal'
      AND public.is_tenant_member(public.current_tenant_id())
    );
EXCEPTION
  WHEN insufficient_privilege THEN
    RAISE NOTICE '0228: portal signature storage policies skipped (not owner of storage.objects)';
END
$portal_signature_storage$;
