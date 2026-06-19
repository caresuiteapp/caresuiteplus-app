-- ==========================================================================
-- CareSuite+ — Migration 0103: Portal document uploads (Assist)
-- Client portal → Supabase Storage → office review → client_documents
-- ==========================================================================

DO $$ BEGIN
  CREATE TYPE public.portal_upload_status AS ENUM (
    'hochgeladen',
    'wird_geprueft',
    'freigegeben',
    'abgelehnt'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.portal_uploads (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  client_id           UUID        NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  portal_user_id      UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  portal_request_id   UUID        REFERENCES public.portal_requests(id) ON DELETE SET NULL,
  storage_path        TEXT        NOT NULL,
  file_name           TEXT        NOT NULL,
  mime_type           TEXT        NOT NULL,
  size_bytes          BIGINT,
  category            TEXT,
  message             TEXT,
  status              public.portal_upload_status NOT NULL DEFAULT 'hochgeladen',
  reviewed_by         UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at         TIMESTAMPTZ,
  review_note         TEXT,
  client_document_id  UUID        REFERENCES public.client_documents(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_portal_uploads_tenant_client
  ON public.portal_uploads (tenant_id, client_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_portal_uploads_pending
  ON public.portal_uploads (tenant_id, status)
  WHERE status IN ('hochgeladen', 'wird_geprueft');

CREATE INDEX IF NOT EXISTS idx_portal_uploads_request
  ON public.portal_uploads (portal_request_id)
  WHERE portal_request_id IS NOT NULL;

-- --------------------------------------------------------------------------
-- Storage: portal uploads under tenant/{tenantId}/clients/{clientId}/portal-uploads/…
-- --------------------------------------------------------------------------
DROP POLICY IF EXISTS "portal_uploads_insert" ON storage.objects;
CREATE POLICY "portal_uploads_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'office-documents'
    AND (storage.foldername(name))[1] = 'tenant'
    AND (storage.foldername(name))[2] = public.current_tenant_id()::text
    AND (storage.foldername(name))[3] = 'clients'
    AND (storage.foldername(name))[4] = public.current_client_id()::text
    AND (storage.foldername(name))[5] = 'portal-uploads'
    AND public.current_client_id() IS NOT NULL
  );

DROP POLICY IF EXISTS "portal_uploads_select_portal" ON storage.objects;
CREATE POLICY "portal_uploads_select_portal"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'office-documents'
    AND (storage.foldername(name))[1] = 'tenant'
    AND (storage.foldername(name))[2] = public.current_tenant_id()::text
    AND (storage.foldername(name))[3] = 'clients'
    AND (storage.foldername(name))[4] = public.current_client_id()::text
    AND (storage.foldername(name))[5] = 'portal-uploads'
    AND public.current_client_id() IS NOT NULL
  );

DROP POLICY IF EXISTS "portal_uploads_select_office" ON storage.objects;
CREATE POLICY "portal_uploads_select_office"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'office-documents'
    AND (storage.foldername(name))[1] = 'tenant'
    AND (storage.foldername(name))[2] = public.current_tenant_id()::text
    AND (storage.foldername(name))[5] = 'portal-uploads'
    AND public.has_permission('office.access')
  );

-- --------------------------------------------------------------------------
-- RLS: portal_uploads
-- --------------------------------------------------------------------------
ALTER TABLE public.portal_uploads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS portal_uploads_portal_select ON public.portal_uploads;
CREATE POLICY portal_uploads_portal_select ON public.portal_uploads
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND client_id = public.current_client_id()
    AND public.current_client_id() IS NOT NULL
  );

DROP POLICY IF EXISTS portal_uploads_portal_insert ON public.portal_uploads;
CREATE POLICY portal_uploads_portal_insert ON public.portal_uploads
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND client_id = public.current_client_id()
    AND public.current_client_id() IS NOT NULL
  );

DROP POLICY IF EXISTS portal_uploads_office_select ON public.portal_uploads;
CREATE POLICY portal_uploads_office_select ON public.portal_uploads
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND public.has_permission('office.access')
  );

DROP POLICY IF EXISTS portal_uploads_office_update ON public.portal_uploads;
CREATE POLICY portal_uploads_office_update ON public.portal_uploads
  FOR UPDATE TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND public.has_permission('office.access')
  )
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND public.has_permission('office.access')
  );

GRANT SELECT, INSERT ON public.portal_uploads TO authenticated;
GRANT UPDATE ON public.portal_uploads TO authenticated;

COMMENT ON TABLE public.portal_uploads IS
  'Documents uploaded by client portal users; office reviews and assigns to client_documents.';
