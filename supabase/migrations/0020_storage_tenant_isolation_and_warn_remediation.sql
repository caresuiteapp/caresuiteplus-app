-- ==========================================================================
-- CareSuite+ — Migration 0020: Storage Tenant-Isolation & WARN Remediation
-- Ersetzt breite caresuite-* Storage-Policies durch tenant/{tenant_id}/…-Isolation.
-- service_role für Edge Functions. Keine DROP TABLE/COLUMN/TRUNCATE/DELETE.
-- ==========================================================================
--
-- Tenant-Pfad-Standard (App + Storage):
--   tenant/{tenant_id}/<bereich>/<…>/<dateiname>
-- Beispiele:
--   tenant/{id}/documents/{docId}/{filename}           → office-documents / caresuite-documents
--   tenant/{id}/threads/{threadId}/attachments/…       → communication-attachments
--   tenant/{id}/communication/{threadId}/voice/…       → communication-voice
--   tenant/{id}/exports/{jobId}/{filename}             → caresuite-exports
--   tenant/{id}/imports/{batchId}/{filename}           → caresuite-imports
--   tenant/{id}/media/{assetId}/{filename}             → caresuite-media
--   tenant/{id}/signatures/{recordId}/{filename}         → caresuite-signatures
--   tenant/{id}/support/{ticketId}/{filename}          → caresuite-support
--   tenant/{id}/branding/{asset}                        → caresuite-public-assets (Mandant)
--   public/branding/{asset}                             → caresuite-public-assets (global, kein PII)
--
-- Ersetzte Policies (DROP):
--   caresuite_authenticated_read_private_buckets
--   caresuite_authenticated_upload_private_buckets
--   caresuite_authenticated_update_own_objects
-- ==========================================================================

-- --------------------------------------------------------------------------
-- caresuite-* private Buckets: SELECT — nur eigener Mandanten-Pfad
-- --------------------------------------------------------------------------
DROP POLICY IF EXISTS "caresuite_authenticated_read_private_buckets" ON storage.objects;
DROP POLICY IF EXISTS "caresuite_tenant_select" ON storage.objects;
CREATE POLICY "caresuite_tenant_select"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = ANY(ARRAY[
      'caresuite-documents',
      'caresuite-signatures',
      'caresuite-exports',
      'caresuite-imports',
      'caresuite-media',
      'caresuite-support'
    ]::text[])
    AND (storage.foldername(name))[1] = 'tenant'
    AND (storage.foldername(name))[2] = public.current_tenant_id()::text
  );

-- --------------------------------------------------------------------------
-- caresuite-public-assets: SELECT — global public/ ODER Mandanten-branding
-- Bucket bleibt public=true (CDN-Branding); Schreibzugriff nur tenant/{id}/…
-- --------------------------------------------------------------------------
DROP POLICY IF EXISTS "caresuite_public_assets_select" ON storage.objects;
CREATE POLICY "caresuite_public_assets_select"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'caresuite-public-assets'
    AND (
      (storage.foldername(name))[1] = 'public'
      OR (
        (storage.foldername(name))[1] = 'tenant'
        AND (storage.foldername(name))[2] = public.current_tenant_id()::text
      )
    )
  );

-- --------------------------------------------------------------------------
-- caresuite-* INSERT — Mandanten-Pfad + bereichsspezifische Berechtigung
-- --------------------------------------------------------------------------
DROP POLICY IF EXISTS "caresuite_authenticated_upload_private_buckets" ON storage.objects;
DROP POLICY IF EXISTS "caresuite_tenant_insert" ON storage.objects;
CREATE POLICY "caresuite_tenant_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    (storage.foldername(name))[1] = 'tenant'
    AND (storage.foldername(name))[2] = public.current_tenant_id()::text
    AND (
      (
        bucket_id = 'caresuite-documents'
        AND (
          public.has_permission('office.documents.upload')
          OR public.has_permission('qm.create_document')
        )
      )
      OR (
        bucket_id = 'caresuite-exports'
        AND public.has_permission('qm.export_qm_documents')
      )
      OR (
        bucket_id = 'caresuite-imports'
        AND public.is_tenant_admin()
      )
      OR (
        bucket_id = 'caresuite-media'
        AND public.has_permission('office.documents.upload')
      )
      OR (bucket_id = 'caresuite-signatures')
      OR (
        bucket_id = 'caresuite-support'
        AND public.has_permission('communication.view_center')
      )
      OR (
        bucket_id = 'caresuite-public-assets'
        AND public.is_tenant_admin()
      )
    )
  );

-- --------------------------------------------------------------------------
-- caresuite-* UPDATE — Mandanten-Pfad (Upsert)
-- --------------------------------------------------------------------------
DROP POLICY IF EXISTS "caresuite_authenticated_update_own_objects" ON storage.objects;
DROP POLICY IF EXISTS "caresuite_tenant_update" ON storage.objects;
CREATE POLICY "caresuite_tenant_update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = ANY(ARRAY[
      'caresuite-documents',
      'caresuite-signatures',
      'caresuite-exports',
      'caresuite-imports',
      'caresuite-media',
      'caresuite-support',
      'caresuite-public-assets'
    ]::text[])
    AND (storage.foldername(name))[1] = 'tenant'
    AND (storage.foldername(name))[2] = public.current_tenant_id()::text
  )
  WITH CHECK (
    bucket_id = ANY(ARRAY[
      'caresuite-documents',
      'caresuite-signatures',
      'caresuite-exports',
      'caresuite-imports',
      'caresuite-media',
      'caresuite-support',
      'caresuite-public-assets'
    ]::text[])
    AND (storage.foldername(name))[1] = 'tenant'
    AND (storage.foldername(name))[2] = public.current_tenant_id()::text
  );

-- --------------------------------------------------------------------------
-- Communication/Office UPDATE — tenant-Prefix in USING ergänzen (0019-Lücke)
-- --------------------------------------------------------------------------
DROP POLICY IF EXISTS "comm_attachments_update" ON storage.objects;
CREATE POLICY "comm_attachments_update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'communication-attachments'
    AND (storage.foldername(name))[1] = 'tenant'
    AND (storage.foldername(name))[2] = public.current_tenant_id()::text
  )
  WITH CHECK (
    bucket_id = 'communication-attachments'
    AND (storage.foldername(name))[1] = 'tenant'
    AND (storage.foldername(name))[2] = public.current_tenant_id()::text
  );

DROP POLICY IF EXISTS "comm_voice_update" ON storage.objects;
CREATE POLICY "comm_voice_update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'communication-voice'
    AND (storage.foldername(name))[1] = 'tenant'
    AND (storage.foldername(name))[2] = public.current_tenant_id()::text
  )
  WITH CHECK (
    bucket_id = 'communication-voice'
    AND (storage.foldername(name))[1] = 'tenant'
    AND (storage.foldername(name))[2] = public.current_tenant_id()::text
  );

DROP POLICY IF EXISTS "comm_images_update" ON storage.objects;
CREATE POLICY "comm_images_update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'communication-images'
    AND (storage.foldername(name))[1] = 'tenant'
    AND (storage.foldername(name))[2] = public.current_tenant_id()::text
  )
  WITH CHECK (
    bucket_id = 'communication-images'
    AND (storage.foldername(name))[1] = 'tenant'
    AND (storage.foldername(name))[2] = public.current_tenant_id()::text
  );

DROP POLICY IF EXISTS "office_docs_update" ON storage.objects;
CREATE POLICY "office_docs_update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'office-documents'
    AND (storage.foldername(name))[1] = 'tenant'
    AND (storage.foldername(name))[2] = public.current_tenant_id()::text
  )
  WITH CHECK (
    bucket_id = 'office-documents'
    AND (storage.foldername(name))[1] = 'tenant'
    AND (storage.foldername(name))[2] = public.current_tenant_id()::text
  );

-- --------------------------------------------------------------------------
-- service_role — Edge Functions / Hintergrund-Jobs (alle Buckets)
-- --------------------------------------------------------------------------
DROP POLICY IF EXISTS "storage_service_role_all" ON storage.objects;
CREATE POLICY "storage_service_role_all"
  ON storage.objects FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);
