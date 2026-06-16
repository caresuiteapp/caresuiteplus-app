-- ==========================================================================
-- CareSuite+ — Migration 0047: Connect Dokumente & Signaturen (prepared)
-- DocuSign, Adobe Sign, Skribble, FP Sign, OCR-Anbieter, PDF/A, Archiv
-- Keine echten Signaturen, kein OCR-Transfer, kein GoBD-Claim ohne Schutzlogik.
-- NICHT auf Remote pushen — nur lokale Migration vorbereiten.
-- ==========================================================================

-- --------------------------------------------------------------------------
-- 1. document_provider_configs — Signatur-, OCR-, PDF- und Archiv-Anbieter
-- credential_vault_ref = Vault-Referenz only (kein Klartext)
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.document_provider_configs (
  id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  provider_key            TEXT        NOT NULL
    CHECK (provider_key IN (
      'docusign', 'adobe_sign', 'skribble', 'fp_sign',
      'google_vision', 'azure_document_intelligence', 'aws_textract',
      'abbyy', 'klippa', 'mindee',
      'generic_pdf', 'internal_archive', 'none'
    )),
  provider_category       TEXT        NOT NULL
    CHECK (provider_category IN ('signature', 'ocr', 'pdf', 'archive')),
  config_status           TEXT        NOT NULL DEFAULT 'not_configured'
    CHECK (config_status IN (
      'not_configured', 'requested', 'configured', 'sandbox', 'production',
      'disabled', 'error'
    )),
  environment             TEXT
    CHECK (environment IS NULL OR environment IN ('sandbox', 'production')),
  is_active               BOOLEAN     NOT NULL DEFAULT FALSE,
  ocr_external_approved   BOOLEAN     NOT NULL DEFAULT FALSE,
  health_data_ocr_approved BOOLEAN    NOT NULL DEFAULT FALSE,
  credential_vault_ref    TEXT,
  settings_json           JSONB       NOT NULL DEFAULT '{}'::jsonb,
  configured_by           UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  configured_at           TIMESTAMPTZ,
  notes                   TEXT,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, provider_key),
  CONSTRAINT document_provider_configs_vault_not_empty
    CHECK (credential_vault_ref IS NULL OR length(trim(credential_vault_ref)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_document_provider_configs_tenant
  ON public.document_provider_configs (tenant_id, provider_category, is_active);

-- --------------------------------------------------------------------------
-- 2. document_templates — Verträge, Rechnungen, Leistungsnachweise
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.document_templates (
  id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  template_key            TEXT        NOT NULL,
  template_type           TEXT        NOT NULL
    CHECK (template_type IN ('contract', 'invoice', 'leistungsnachweis', 'generic')),
  label                   TEXT        NOT NULL,
  description             TEXT,
  content_schema_json     JSONB       NOT NULL DEFAULT '{}'::jsonb,
  is_active               BOOLEAN     NOT NULL DEFAULT TRUE,
  version                 INTEGER     NOT NULL DEFAULT 1,
  created_by              UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, template_key, version)
);

CREATE INDEX IF NOT EXISTS idx_document_templates_tenant
  ON public.document_templates (tenant_id, template_type, is_active);

-- --------------------------------------------------------------------------
-- 3. generated_documents — erzeugte Dokumente (mandantenspezifisch)
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.generated_documents (
  id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  template_id             UUID        REFERENCES public.document_templates(id) ON DELETE SET NULL,
  document_type           TEXT        NOT NULL
    CHECK (document_type IN ('contract', 'invoice', 'leistungsnachweis', 'generic')),
  title                   TEXT        NOT NULL,
  status                  TEXT        NOT NULL DEFAULT 'draft'
    CHECK (status IN (
      'draft', 'generated', 'sent', 'signed', 'rejected', 'archived',
      'corrected', 'cancelled', 'export_ready', 'exported',
      'ocr_pending', 'ocr_completed', 'ocr_failed'
    )),
  current_version         INTEGER     NOT NULL DEFAULT 1,
  contains_health_data    BOOLEAN     NOT NULL DEFAULT FALSE,
  client_id               UUID        REFERENCES public.clients(id) ON DELETE SET NULL,
  invoice_id              UUID,
  storage_reference       TEXT,
  content_hash            TEXT,
  pdf_a_prepared          BOOLEAN     NOT NULL DEFAULT FALSE,
  is_archived             BOOLEAN     NOT NULL DEFAULT FALSE,
  archived_at             TIMESTAMPTZ,
  correction_of_id        UUID        REFERENCES public.generated_documents(id) ON DELETE SET NULL,
  metadata_json           JSONB       NOT NULL DEFAULT '{}'::jsonb,
  created_by              UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_generated_documents_tenant
  ON public.generated_documents (tenant_id, status, document_type);

CREATE INDEX IF NOT EXISTS idx_generated_documents_tenant_client
  ON public.generated_documents (tenant_id, client_id)
  WHERE client_id IS NOT NULL;

-- --------------------------------------------------------------------------
-- 4. document_versions — jede PDF-Änderung versioniert
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.document_versions (
  id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  document_id             UUID        NOT NULL REFERENCES public.generated_documents(id) ON DELETE CASCADE,
  version_number          INTEGER     NOT NULL,
  storage_reference       TEXT        NOT NULL,
  content_hash            TEXT        NOT NULL,
  change_reason           TEXT,
  is_correction           BOOLEAN     NOT NULL DEFAULT FALSE,
  created_by              UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, document_id, version_number)
);

CREATE INDEX IF NOT EXISTS idx_document_versions_document
  ON public.document_versions (tenant_id, document_id, version_number DESC);

-- --------------------------------------------------------------------------
-- 5. document_signing_requests — Signatur vorbereitet, kein Live-Versand
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.document_signing_requests (
  id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  document_id             UUID        NOT NULL REFERENCES public.generated_documents(id) ON DELETE CASCADE,
  document_version_id     UUID        NOT NULL REFERENCES public.document_versions(id) ON DELETE CASCADE,
  provider_key            TEXT        NOT NULL
    CHECK (provider_key IN ('docusign', 'adobe_sign', 'skribble', 'fp_sign')),
  status                  TEXT        NOT NULL DEFAULT 'prepared'
    CHECK (status IN (
      'prepared', 'blocked', 'queued', 'sent', 'signed', 'rejected',
      'expired', 'cancelled', 'failed'
    )),
  external_request_id     TEXT,
  external_transfer       BOOLEAN     NOT NULL DEFAULT FALSE,
  signers_json            JSONB       NOT NULL DEFAULT '[]'::jsonb,
  initiated_by            UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  initiated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at            TIMESTAMPTZ,
  error_summary           TEXT,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_document_signing_requests_tenant
  ON public.document_signing_requests (tenant_id, document_id, status);

-- --------------------------------------------------------------------------
-- 6. document_ocr_jobs — OCR vorbereitet, kein externer Transfer ohne Freigabe
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.document_ocr_jobs (
  id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  document_id             UUID        NOT NULL REFERENCES public.generated_documents(id) ON DELETE CASCADE,
  document_version_id     UUID        REFERENCES public.document_versions(id) ON DELETE SET NULL,
  provider_key            TEXT        NOT NULL
    CHECK (provider_key IN (
      'google_vision', 'azure_document_intelligence', 'aws_textract',
      'abbyy', 'klippa', 'mindee', 'internal'
    )),
  status                  TEXT        NOT NULL DEFAULT 'prepared'
    CHECK (status IN (
      'prepared', 'blocked', 'pending_approval', 'queued', 'processing',
      'completed', 'failed', 'cancelled'
    )),
  contains_health_data    BOOLEAN     NOT NULL DEFAULT FALSE,
  external_transfer       BOOLEAN     NOT NULL DEFAULT FALSE,
  approval_required       BOOLEAN     NOT NULL DEFAULT FALSE,
  approved_by             UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  approved_at             TIMESTAMPTZ,
  classification_json     JSONB       NOT NULL DEFAULT '{}'::jsonb,
  result_json             JSONB       NOT NULL DEFAULT '{}'::jsonb,
  error_summary           TEXT,
  initiated_by            UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  started_at              TIMESTAMPTZ,
  finished_at             TIMESTAMPTZ,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_document_ocr_jobs_tenant
  ON public.document_ocr_jobs (tenant_id, document_id, status);

-- --------------------------------------------------------------------------
-- 7. document_audit_events — append-only Audit-Trail
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.document_audit_events (
  id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  document_id             UUID        REFERENCES public.generated_documents(id) ON DELETE SET NULL,
  document_version_id     UUID        REFERENCES public.document_versions(id) ON DELETE SET NULL,
  signing_request_id      UUID        REFERENCES public.document_signing_requests(id) ON DELETE SET NULL,
  ocr_job_id              UUID        REFERENCES public.document_ocr_jobs(id) ON DELETE SET NULL,
  actor_user_id           UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  event_type              TEXT        NOT NULL
    CHECK (event_type IN (
      'document_created', 'document_generated', 'version_created', 'edit_blocked',
      'correction_started', 'signing_prepared', 'signing_blocked', 'signing_sent',
      'signing_completed', 'signing_rejected', 'ocr_prepared', 'ocr_blocked',
      'ocr_approval_required', 'ocr_completed', 'ocr_failed', 'pdf_a_prepared',
      'archive_prepared', 'archive_created', 'status_changed', 'export_prepared'
    )),
  summary                 TEXT        NOT NULL,
  old_status              TEXT,
  new_status              TEXT,
  metadata_json           JSONB       NOT NULL DEFAULT '{}'::jsonb,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_document_audit_events_tenant
  ON public.document_audit_events (tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_document_audit_events_document
  ON public.document_audit_events (tenant_id, document_id, created_at DESC)
  WHERE document_id IS NOT NULL;

-- --------------------------------------------------------------------------
-- 8. document_archive_entries — Erweiterung aus 0046 (Connect + Rechnungen)
-- --------------------------------------------------------------------------
ALTER TABLE public.document_archive_entries
  ADD COLUMN IF NOT EXISTS generated_document_id UUID
    REFERENCES public.generated_documents(id) ON DELETE SET NULL;

ALTER TABLE public.document_archive_entries
  ALTER COLUMN invoice_id DROP NOT NULL;

ALTER TABLE public.document_archive_entries
  DROP CONSTRAINT IF EXISTS document_archive_entries_document_type_check;

ALTER TABLE public.document_archive_entries
  ADD CONSTRAINT document_archive_entries_document_type_check
  CHECK (document_type IN (
    'invoice', 'correction', 'storno', 'steuerberater_package',
    'contract', 'leistungsnachweis', 'generic'
  ));

ALTER TABLE public.document_archive_entries
  ADD COLUMN IF NOT EXISTS archive_status TEXT NOT NULL DEFAULT 'prepared';

ALTER TABLE public.document_archive_entries
  DROP CONSTRAINT IF EXISTS document_archive_entries_archive_status_check;

ALTER TABLE public.document_archive_entries
  ADD CONSTRAINT document_archive_entries_archive_status_check
  CHECK (archive_status IN ('prepared', 'archived', 'blocked', 'gobd_pending'));

ALTER TABLE public.document_archive_entries
  ADD COLUMN IF NOT EXISTS gobd_protection_active BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_document_archive_entries_generated
  ON public.document_archive_entries (tenant_id, generated_document_id)
  WHERE generated_document_id IS NOT NULL;

-- --------------------------------------------------------------------------
-- updated_at Trigger
-- --------------------------------------------------------------------------
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'document_provider_configs',
    'document_templates',
    'generated_documents',
    'document_signing_requests',
    'document_ocr_jobs'
  ]
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS set_%I_updated_at ON public.%I', t, t);
    EXECUTE format(
      'CREATE TRIGGER set_%I_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()',
      t, t
    );
  END LOOP;
END $$;

-- --------------------------------------------------------------------------
-- RLS aktivieren
-- --------------------------------------------------------------------------
ALTER TABLE public.document_provider_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.generated_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_signing_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_ocr_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_audit_events ENABLE ROW LEVEL SECURITY;

-- --------------------------------------------------------------------------
-- RLS: document_provider_configs — nur Tenant-Admin (Secrets geschützt)
-- --------------------------------------------------------------------------
DROP POLICY IF EXISTS document_provider_configs_admin ON public.document_provider_configs;
CREATE POLICY document_provider_configs_admin ON public.document_provider_configs
  FOR ALL
  TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND public.is_connect_tenant_admin()
  )
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND public.is_connect_tenant_admin()
  );

-- --------------------------------------------------------------------------
-- RLS: document_templates — Mandant lesen; Schreiben Tenant-Admin
-- --------------------------------------------------------------------------
DROP POLICY IF EXISTS document_templates_tenant_select ON public.document_templates;
CREATE POLICY document_templates_tenant_select ON public.document_templates
  FOR SELECT
  TO authenticated
  USING (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS document_templates_tenant_write ON public.document_templates;
CREATE POLICY document_templates_tenant_write ON public.document_templates
  FOR ALL
  TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND public.is_connect_tenant_admin()
  )
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND public.is_connect_tenant_admin()
  );

-- --------------------------------------------------------------------------
-- RLS: generated_documents — Mandant lesen; Schreiben Tenant-Admin
-- --------------------------------------------------------------------------
DROP POLICY IF EXISTS generated_documents_tenant_select ON public.generated_documents;
CREATE POLICY generated_documents_tenant_select ON public.generated_documents
  FOR SELECT
  TO authenticated
  USING (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS generated_documents_tenant_write ON public.generated_documents;
CREATE POLICY generated_documents_tenant_write ON public.generated_documents
  FOR ALL
  TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND public.is_connect_tenant_admin()
  )
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND public.is_connect_tenant_admin()
  );

-- --------------------------------------------------------------------------
-- RLS: document_versions — Mandant lesen; Insert Tenant-Admin
-- --------------------------------------------------------------------------
DROP POLICY IF EXISTS document_versions_tenant_select ON public.document_versions;
CREATE POLICY document_versions_tenant_select ON public.document_versions
  FOR SELECT
  TO authenticated
  USING (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS document_versions_tenant_insert ON public.document_versions;
CREATE POLICY document_versions_tenant_insert ON public.document_versions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND public.is_connect_tenant_admin()
  );

-- --------------------------------------------------------------------------
-- RLS: document_signing_requests — Mandant lesen; Schreiben Tenant-Admin
-- --------------------------------------------------------------------------
DROP POLICY IF EXISTS document_signing_requests_tenant_select ON public.document_signing_requests;
CREATE POLICY document_signing_requests_tenant_select ON public.document_signing_requests
  FOR SELECT
  TO authenticated
  USING (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS document_signing_requests_tenant_write ON public.document_signing_requests;
CREATE POLICY document_signing_requests_tenant_write ON public.document_signing_requests
  FOR ALL
  TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND public.is_connect_tenant_admin()
  )
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND public.is_connect_tenant_admin()
  );

-- --------------------------------------------------------------------------
-- RLS: document_ocr_jobs — Mandant lesen; Schreiben Tenant-Admin
-- --------------------------------------------------------------------------
DROP POLICY IF EXISTS document_ocr_jobs_tenant_select ON public.document_ocr_jobs;
CREATE POLICY document_ocr_jobs_tenant_select ON public.document_ocr_jobs
  FOR SELECT
  TO authenticated
  USING (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS document_ocr_jobs_tenant_write ON public.document_ocr_jobs;
CREATE POLICY document_ocr_jobs_tenant_write ON public.document_ocr_jobs
  FOR ALL
  TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND public.is_connect_tenant_admin()
  )
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND public.is_connect_tenant_admin()
  );

-- --------------------------------------------------------------------------
-- RLS: document_audit_events — Mandant lesen; append-only Insert
-- --------------------------------------------------------------------------
DROP POLICY IF EXISTS document_audit_events_tenant_select ON public.document_audit_events;
CREATE POLICY document_audit_events_tenant_select ON public.document_audit_events
  FOR SELECT
  TO authenticated
  USING (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS document_audit_events_tenant_insert ON public.document_audit_events;
CREATE POLICY document_audit_events_tenant_insert ON public.document_audit_events
  FOR INSERT
  TO authenticated
  WITH CHECK (tenant_id = public.current_tenant_id());

-- --------------------------------------------------------------------------
-- GRANTs — credential_vault_ref nur über Admin-Policy sichtbar
-- --------------------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE ON public.document_provider_configs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.document_templates TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.generated_documents TO authenticated;
GRANT SELECT, INSERT ON public.document_versions TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.document_signing_requests TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.document_ocr_jobs TO authenticated;
GRANT SELECT, INSERT ON public.document_audit_events TO authenticated;

-- --------------------------------------------------------------------------
-- Kommentare
-- --------------------------------------------------------------------------
COMMENT ON TABLE public.document_provider_configs IS
  'Dokument-Anbieter je Mandant — credential_vault_ref only, kein Klartext-API-Key';

COMMENT ON TABLE public.generated_documents IS
  'Erzeugte Dokumente — archivierte Dokumente nicht direkt überschreibbar';

COMMENT ON TABLE public.document_versions IS
  'PDF-Versionierung — jede Manipulation erzeugt neue Version';

COMMENT ON TABLE public.document_signing_requests IS
  'Signaturanfragen — external_transfer=false bis echter Provider-Versand';

COMMENT ON TABLE public.document_ocr_jobs IS
  'OCR-Jobs — external_transfer=false ohne Freigabe; Gesundheitsdaten extra markiert';

COMMENT ON TABLE public.document_audit_events IS
  'Dokument-Audit-Trail — append-only, mandantenspezifisch';

COMMENT ON COLUMN public.document_archive_entries.gobd_protection_active IS
  'Nur TRUE wenn revisionssichere Schutzlogik aktiv — sonst kein GoBD-Claim';

COMMENT ON COLUMN public.document_signing_requests.external_transfer IS
  'Nur TRUE wenn tatsächlicher Versand an Signatur-Anbieter nachweisbar';

COMMENT ON COLUMN public.document_ocr_jobs.external_transfer IS
  'Nur TRUE wenn tatsächlicher Transfer an OCR-Anbieter nach Freigabe';
