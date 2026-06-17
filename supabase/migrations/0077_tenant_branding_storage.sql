-- ==========================================================================
-- CareSuite+ — Migration 0077: Mandanten-Logo (tenant_branding + Storage)
-- Pfad: tenant/{tenant_id}/logo.{ext}
-- Bucket: tenant-branding (öffentlich lesbar für Anzeige)
-- ==========================================================================

-- --------------------------------------------------------------------------
-- Storage-Bucket
-- --------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'tenant-branding',
  'tenant-branding',
  TRUE,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- --------------------------------------------------------------------------
-- SELECT — Mandanten-isoliert (authenticated)
-- --------------------------------------------------------------------------
DROP POLICY IF EXISTS "tenant_branding_select_tenant" ON storage.objects;
CREATE POLICY "tenant_branding_select_tenant"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'tenant-branding'
    AND (storage.foldername(name))[1] = 'tenant'
    AND (storage.foldername(name))[2] = public.current_tenant_id()::text
  );

-- --------------------------------------------------------------------------
-- INSERT — Mandanten-Admin
-- --------------------------------------------------------------------------
DROP POLICY IF EXISTS "tenant_branding_insert_tenant" ON storage.objects;
CREATE POLICY "tenant_branding_insert_tenant"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'tenant-branding'
    AND (storage.foldername(name))[1] = 'tenant'
    AND (storage.foldername(name))[2] = public.current_tenant_id()::text
    AND public.has_permission('business.tenant.manage')
  );

-- --------------------------------------------------------------------------
-- UPDATE — Upsert beim erneuten Upload
-- --------------------------------------------------------------------------
DROP POLICY IF EXISTS "tenant_branding_update_tenant" ON storage.objects;
CREATE POLICY "tenant_branding_update_tenant"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'tenant-branding'
    AND (storage.foldername(name))[1] = 'tenant'
    AND (storage.foldername(name))[2] = public.current_tenant_id()::text
    AND public.has_permission('business.tenant.manage')
  )
  WITH CHECK (
    bucket_id = 'tenant-branding'
    AND (storage.foldername(name))[1] = 'tenant'
    AND (storage.foldername(name))[2] = public.current_tenant_id()::text
  );

-- --------------------------------------------------------------------------
-- DELETE — Logo entfernen
-- --------------------------------------------------------------------------
DROP POLICY IF EXISTS "tenant_branding_delete_tenant" ON storage.objects;
CREATE POLICY "tenant_branding_delete_tenant"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'tenant-branding'
    AND (storage.foldername(name))[1] = 'tenant'
    AND (storage.foldername(name))[2] = public.current_tenant_id()::text
    AND public.has_permission('business.tenant.manage')
  );
