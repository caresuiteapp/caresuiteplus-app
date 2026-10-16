-- Document layout logos reuse the existing public tenant-branding bucket.
-- This adds one INSERT grant for catalog editors; existing branding policies,
-- bucket limits, and UPDATE/DELETE permissions are intentionally unchanged.
-- Clients must upload to a fresh UUID path with upsert=false, then persist the
-- public URL in tenant_document_settings rather than tenant_branding.
BEGIN;

DROP POLICY IF EXISTS tenant_document_logos_insert ON storage.objects;
CREATE POLICY tenant_document_logos_insert
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'tenant-branding'
    AND name ~ $path$^tenant/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/document-logos/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(png|jpg|webp)$$path$
    AND split_part(name, '/', 2) = (SELECT public.current_tenant_id())::text
    AND care_security.company_actor(
      (SELECT public.current_tenant_id()), 'office.catalogs.edit'
    )
  );

COMMIT;
