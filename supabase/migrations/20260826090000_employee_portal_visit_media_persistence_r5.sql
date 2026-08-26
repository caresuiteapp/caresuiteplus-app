-- ==========================================================================
-- CareSuite HealthOS — Mitarbeiterportal Einsatzmedien Persistenz R5
-- Dauerhafte Metadaten, Wiederaufruf nach Sitzungsende und Portal-RLS.
-- ==========================================================================

CREATE TABLE IF NOT EXISTS public.assist_visit_attachments (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  visit_id          UUID        NOT NULL REFERENCES public.assist_visits(id) ON DELETE CASCADE,
  employee_id       UUID        REFERENCES public.employees(id) ON DELETE SET NULL,
  storage_path      TEXT        NOT NULL,
  file_name         TEXT        NOT NULL,
  mime_type         TEXT        NOT NULL DEFAULT 'application/octet-stream',
  size_bytes        BIGINT,
  media_kind        TEXT        NOT NULL DEFAULT 'document',
  upload_source     TEXT        NOT NULL DEFAULT 'employee_portal',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT assist_visit_attachments_path_nonempty
    CHECK (char_length(trim(storage_path)) > 0),
  CONSTRAINT assist_visit_attachments_file_name_nonempty
    CHECK (char_length(trim(file_name)) > 0),
  CONSTRAINT assist_visit_attachments_size_nonnegative
    CHECK (size_bytes IS NULL OR size_bytes >= 0),
  CONSTRAINT assist_visit_attachments_media_kind_check
    CHECK (media_kind IN ('image', 'video', 'audio', 'document')),
  CONSTRAINT assist_visit_attachments_upload_source_check
    CHECK (upload_source IN ('employee_portal', 'office', 'recovered')),
  CONSTRAINT assist_visit_attachments_tenant_path_unique
    UNIQUE (tenant_id, storage_path)
);

CREATE INDEX IF NOT EXISTS idx_assist_visit_attachments_visit_created
  ON public.assist_visit_attachments (tenant_id, visit_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_assist_visit_attachments_employee
  ON public.assist_visit_attachments (tenant_id, employee_id, created_at DESC)
  WHERE employee_id IS NOT NULL;

DROP TRIGGER IF EXISTS set_assist_visit_attachments_updated_at
  ON public.assist_visit_attachments;
CREATE TRIGGER set_assist_visit_attachments_updated_at
  BEFORE UPDATE ON public.assist_visit_attachments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.assist_visit_attachments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS assist_visit_attachments_office_all
  ON public.assist_visit_attachments;
CREATE POLICY assist_visit_attachments_office_all
  ON public.assist_visit_attachments
  FOR ALL TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND public.is_tenant_member(tenant_id)
    AND NOT public.is_employee_portal_rls_context(tenant_id)
  )
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND public.is_tenant_member(tenant_id)
    AND NOT public.is_employee_portal_rls_context(tenant_id)
  );

DROP POLICY IF EXISTS assist_visit_attachments_portal_select
  ON public.assist_visit_attachments;
CREATE POLICY assist_visit_attachments_portal_select
  ON public.assist_visit_attachments
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND public.is_employee_portal_rls_context(tenant_id)
    AND employee_id = public.resolve_current_employee_id()
    AND visit_id IN (SELECT public.portal_employee_assigned_visit_ids(tenant_id))
  );

DROP POLICY IF EXISTS assist_visit_attachments_portal_insert
  ON public.assist_visit_attachments;
CREATE POLICY assist_visit_attachments_portal_insert
  ON public.assist_visit_attachments
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND public.is_employee_portal_rls_context(tenant_id)
    AND employee_id = public.resolve_current_employee_id()
    AND visit_id IN (SELECT public.portal_employee_assigned_visit_ids(tenant_id))
  );

GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.assist_visit_attachments TO authenticated;

COMMENT ON TABLE public.assist_visit_attachments IS
  'Dauerhafte Metadaten interner Einsatzfotos, Videos, Audios und Dokumente.';

-- Speicherpfade: tenant/{tenant}/assist/visits/{visit}/attachments/{file}
DROP POLICY IF EXISTS "assist_execution_storage_portal_insert" ON storage.objects;
CREATE POLICY "assist_execution_storage_portal_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'office-documents'
    AND (storage.foldername(name))[1] = 'tenant'
    AND (storage.foldername(name))[2] = public.current_tenant_id()::text
    AND (storage.foldername(name))[3] = 'assist'
    AND (storage.foldername(name))[4] = 'visits'
    AND (storage.foldername(name))[5]::uuid IN (
      SELECT public.portal_employee_assigned_visit_ids(public.current_tenant_id())
    )
    AND (storage.foldername(name))[6] IN ('attachments', 'signatures', 'proofs')
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
    AND (storage.foldername(name))[5]::uuid IN (
      SELECT public.portal_employee_assigned_visit_ids(public.current_tenant_id())
    )
    AND (storage.foldername(name))[6] IN ('attachments', 'signatures', 'proofs')
    AND public.is_employee_portal_rls_context(public.current_tenant_id())
  );
