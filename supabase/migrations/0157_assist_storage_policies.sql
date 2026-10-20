-- ==========================================================================
-- CareSuite+ — Migration 0157: Assist execution Storage policies
-- Signatures + proof snapshots under office-documents bucket (Pattern 0103).
-- Additive only — tenant-safe paths tenant/{tenantId}/assist/visits/{visitId}/…
-- Fresh-DB: storage.objects gehört supabase_storage_admin — Policies ggf. übersprungen
-- ==========================================================================

DO $assist_storage$
BEGIN
  DROP POLICY IF EXISTS "assist_execution_storage_insert" ON storage.objects;
  CREATE POLICY "assist_execution_storage_insert"
    ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (
      bucket_id = 'office-documents'
      AND (storage.foldername(name))[1] = 'tenant'
      AND (storage.foldername(name))[2] = public.current_tenant_id()::text
      AND (storage.foldername(name))[3] = 'assist'
      AND (storage.foldername(name))[4] = 'visits'
      AND public.is_tenant_member(public.current_tenant_id())
    );

  DROP POLICY IF EXISTS "assist_execution_storage_select" ON storage.objects;
  CREATE POLICY "assist_execution_storage_select"
    ON storage.objects FOR SELECT TO authenticated
    USING (
      bucket_id = 'office-documents'
      AND (storage.foldername(name))[1] = 'tenant'
      AND (storage.foldername(name))[2] = public.current_tenant_id()::text
      AND (storage.foldername(name))[3] = 'assist'
      AND (storage.foldername(name))[4] = 'visits'
      AND public.is_tenant_member(public.current_tenant_id())
    );
EXCEPTION
  WHEN insufficient_privilege THEN
    RAISE NOTICE '0157: assist storage policies skipped (not owner of storage.objects)';
END
$assist_storage$;
