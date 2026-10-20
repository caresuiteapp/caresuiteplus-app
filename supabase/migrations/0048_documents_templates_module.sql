-- ==========================================================================
-- CareSuite+ — Migration 0048: Modul „Vorlagen & Dokumente“
-- Erweitert 0014 (Template Center / templates, template_versions Paket F)
-- und 0047 (Connect Dokumente: document_templates, generated_documents, …)
--
-- WICHTIG:
-- - Nur vorbereiten — NICHT blind auf Remote pushen.
-- - Keine GoBD-Konformität behaupten — nur Audit-/Archivstruktur vorbereiten.
-- - Keine destruktiven Befehle (DROP/TRUNCATE/DELETE auf Produktionsdaten).
-- - template_versions (0014) bleibt für Textvorlagen (templates) — Dokument-
--   vorlagen-Versionen heißen document_template_versions (Namenskollision).
-- ==========================================================================

-- --------------------------------------------------------------------------
-- Hilfsfunktion: Admin/Verwaltung für Vorlagen & Dokumente
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_document_module_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.current_role_key() IN ('business_admin', 'business_manager')
$$;

GRANT EXECUTE ON FUNCTION public.is_document_module_admin() TO authenticated;

COMMENT ON FUNCTION public.is_document_module_admin() IS
  'Admin/Verwaltung für Modul Vorlagen & Dokumente — Vorlagen bearbeiten, CI-Einstellungen';

-- --------------------------------------------------------------------------
-- 1. document_templates — Erweiterung aus 0047
-- --------------------------------------------------------------------------
ALTER TABLE public.document_templates
  ALTER COLUMN tenant_id DROP NOT NULL;

ALTER TABLE public.document_templates
  ADD COLUMN IF NOT EXISTS template_name TEXT,
  ADD COLUMN IF NOT EXISTS document_category TEXT,
  ADD COLUMN IF NOT EXISTS current_version_id UUID,
  ADD COLUMN IF NOT EXISTS template_status TEXT NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS is_system_template BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_default BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

-- Backfill template_name aus label (bestehende 0047-Zeilen)
UPDATE public.document_templates
SET template_name = label
WHERE template_name IS NULL AND label IS NOT NULL;

ALTER TABLE public.document_templates
  DROP CONSTRAINT IF EXISTS document_templates_template_type_check;

ALTER TABLE public.document_templates
  ADD CONSTRAINT document_templates_template_type_check
  CHECK (template_type IN (
    'contract', 'invoice', 'leistungsnachweis', 'generic',
    'business_letter', 'credit_note', 'cancellation_invoice', 'offer',
    'service_record', 'care_documentation', 'consultation_record',
    'employee_contract', 'termination_letter', 'warning_letter',
    'client_admission', 'power_of_attorney', 'data_protection_consent',
    'confidentiality_agreement', 'dunning_letter', 'payment_reminder',
    'internal_instruction', 'protocol', 'checklist', 'report'
  ));

ALTER TABLE public.document_templates
  DROP CONSTRAINT IF EXISTS document_templates_template_status_check;

ALTER TABLE public.document_templates
  ADD CONSTRAINT document_templates_template_status_check
  CHECK (template_status IN ('draft', 'active', 'inactive', 'archived', 'deprecated'));

ALTER TABLE public.document_templates
  DROP CONSTRAINT IF EXISTS document_templates_system_tenant_check;

ALTER TABLE public.document_templates
  ADD CONSTRAINT document_templates_system_tenant_check
  CHECK (
    (is_system_template = TRUE AND tenant_id IS NULL)
    OR (is_system_template = FALSE AND tenant_id IS NOT NULL)
  );

CREATE INDEX IF NOT EXISTS idx_document_templates_tenant_type_status
  ON public.document_templates (tenant_id, template_type, template_status);

CREATE INDEX IF NOT EXISTS idx_document_templates_category
  ON public.document_templates (tenant_id, document_category)
  WHERE document_category IS NOT NULL;

-- --------------------------------------------------------------------------
-- 2. document_template_versions — HTML/CSS-Vorlagenversionen
--    (≠ public.template_versions aus 0014 — dort FK auf templates)
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.document_template_versions (
  id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  template_id             UUID        NOT NULL REFERENCES public.document_templates(id) ON DELETE CASCADE,
  version_number          INTEGER     NOT NULL,
  html_template           TEXT        NOT NULL DEFAULT '',
  css_template            TEXT        NOT NULL DEFAULT '',
  json_schema             JSONB       NOT NULL DEFAULT '{}'::jsonb,
  placeholder_schema      JSONB       NOT NULL DEFAULT '{}'::jsonb,
  required_fields         JSONB       NOT NULL DEFAULT '[]'::jsonb,
  layout_settings         JSONB       NOT NULL DEFAULT '{}'::jsonb,
  page_settings           JSONB       NOT NULL DEFAULT '{}'::jsonb,
  header_settings         JSONB       NOT NULL DEFAULT '{}'::jsonb,
  footer_settings         JSONB       NOT NULL DEFAULT '{}'::jsonb,
  watermark_settings      JSONB       NOT NULL DEFAULT '{}'::jsonb,
  signature_settings      JSONB       NOT NULL DEFAULT '{}'::jsonb,
  validation_rules        JSONB       NOT NULL DEFAULT '{}'::jsonb,
  version_status          TEXT        NOT NULL DEFAULT 'draft'
    CHECK (version_status IN ('draft', 'active', 'inactive', 'archived', 'deprecated')),
  created_by              UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  activated_by            UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  activated_at            TIMESTAMPTZ,
  finalized_at            TIMESTAMPTZ,
  archived_at             TIMESTAMPTZ,
  UNIQUE (tenant_id, template_id, version_number)
);

CREATE INDEX IF NOT EXISTS idx_document_template_versions_template
  ON public.document_template_versions (tenant_id, template_id, version_number DESC);

CREATE INDEX IF NOT EXISTS idx_document_template_versions_status
  ON public.document_template_versions (tenant_id, version_status);

-- FK current_version_id (nach Anlegen der Versionstabelle)
ALTER TABLE public.document_templates
  DROP CONSTRAINT IF EXISTS document_templates_current_version_id_fkey;

ALTER TABLE public.document_templates
  ADD CONSTRAINT document_templates_current_version_id_fkey
  FOREIGN KEY (current_version_id) REFERENCES public.document_template_versions(id) ON DELETE SET NULL;

-- --------------------------------------------------------------------------
-- 3. template_placeholders — Platzhalter-Registry (System + Mandant)
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.template_placeholders (
  id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               UUID        REFERENCES public.tenants(id) ON DELETE CASCADE,
  placeholder_key         TEXT        NOT NULL,
  placeholder_group       TEXT        NOT NULL,
  label                   TEXT        NOT NULL,
  description             TEXT,
  data_path               TEXT,
  example_value           TEXT,
  required_context        JSONB       NOT NULL DEFAULT '[]'::jsonb,
  data_type               TEXT        NOT NULL DEFAULT 'string'
    CHECK (data_type IN ('string', 'number', 'date', 'datetime', 'boolean', 'currency', 'json')),
  is_sensitive            BOOLEAN     NOT NULL DEFAULT FALSE,
  is_system               BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT template_placeholders_system_tenant_check
    CHECK (
      (is_system = TRUE AND tenant_id IS NULL)
      OR (is_system = FALSE AND tenant_id IS NOT NULL)
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_template_placeholders_system_key
  ON public.template_placeholders (placeholder_key)
  WHERE is_system = TRUE AND tenant_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_template_placeholders_tenant_key
  ON public.template_placeholders (tenant_id, placeholder_key)
  WHERE tenant_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_template_placeholders_group
  ON public.template_placeholders (placeholder_group, is_system);

-- --------------------------------------------------------------------------
-- 4. template_required_fields — Pflichtfelder je Vorlagenversion
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.template_required_fields (
  id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  template_version_id     UUID        NOT NULL REFERENCES public.document_template_versions(id) ON DELETE CASCADE,
  field_key               TEXT        NOT NULL,
  label                   TEXT        NOT NULL,
  data_path               TEXT,
  validation_type         TEXT        NOT NULL DEFAULT 'required'
    CHECK (validation_type IN (
      'required', 'email', 'phone', 'date', 'currency', 'iban', 'regex', 'min_length', 'max_length'
    )),
  error_message           TEXT,
  is_required             BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, template_version_id, field_key)
);

CREATE INDEX IF NOT EXISTS idx_template_required_fields_version
  ON public.template_required_fields (tenant_id, template_version_id);

-- --------------------------------------------------------------------------
-- 5. template_blocks — wiederverwendbare HTML/CSS-Bausteine
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.template_blocks (
  id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               UUID        REFERENCES public.tenants(id) ON DELETE CASCADE,
  block_key               TEXT        NOT NULL,
  block_category          TEXT        NOT NULL,
  title                   TEXT        NOT NULL,
  description             TEXT,
  html_snippet            TEXT        NOT NULL DEFAULT '',
  css_snippet             TEXT        NOT NULL DEFAULT '',
  placeholder_schema      JSONB       NOT NULL DEFAULT '{}'::jsonb,
  is_system               BOOLEAN     NOT NULL DEFAULT FALSE,
  block_status            TEXT        NOT NULL DEFAULT 'active'
    CHECK (block_status IN ('draft', 'active', 'inactive', 'archived')),
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT template_blocks_system_tenant_check
    CHECK (
      (is_system = TRUE AND tenant_id IS NULL)
      OR (is_system = FALSE AND tenant_id IS NOT NULL)
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_template_blocks_system_key
  ON public.template_blocks (block_key)
  WHERE is_system = TRUE AND tenant_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_template_blocks_tenant_key
  ON public.template_blocks (tenant_id, block_key)
  WHERE tenant_id IS NOT NULL;

-- --------------------------------------------------------------------------
-- 6. template_categories — Erweiterung aus 0014 (key=category_key, label=title)
-- --------------------------------------------------------------------------
ALTER TABLE public.template_categories
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS category_status TEXT NOT NULL DEFAULT 'active';

ALTER TABLE public.template_categories
  DROP CONSTRAINT IF EXISTS template_categories_category_status_check;

ALTER TABLE public.template_categories
  ADD CONSTRAINT template_categories_category_status_check
  CHECK (category_status IN ('active', 'inactive', 'archived'));

COMMENT ON COLUMN public.template_categories.key IS
  'category_key — eindeutiger Schlüssel der Dokumentkategorie';
COMMENT ON COLUMN public.template_categories.label IS
  'title — Anzeigename der Kategorie';

-- --------------------------------------------------------------------------
-- 7. tenant_document_settings — CI / Briefpapier / Standardtexte
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tenant_document_settings (
  id                              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                       UUID        NOT NULL UNIQUE REFERENCES public.tenants(id) ON DELETE CASCADE,
  logo_url                        TEXT,
  primary_color                   TEXT,
  secondary_color                 TEXT,
  accent_color                    TEXT,
  font_family                     TEXT,
  header_layout                   JSONB       NOT NULL DEFAULT '{}'::jsonb,
  footer_layout                   JSONB       NOT NULL DEFAULT '{}'::jsonb,
  default_page_margin_left_mm     NUMERIC(6, 2),
  default_page_margin_right_mm    NUMERIC(6, 2),
  default_page_margin_top_mm      NUMERIC(6, 2),
  default_page_margin_bottom_mm   NUMERIC(6, 2),
  default_payment_terms_days      INTEGER,
  default_tax_notice              TEXT,
  default_contract_clauses        TEXT,
  default_dunning_terms           TEXT,
  default_document_language       TEXT        NOT NULL DEFAULT 'de-DE',
  bank_name                       TEXT,
  iban                            TEXT,
  bic                             TEXT,
  created_at                      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by                      UUID        REFERENCES public.profiles(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_tenant_document_settings_tenant
  ON public.tenant_document_settings (tenant_id);

-- --------------------------------------------------------------------------
-- 8. document_preview_sessions — Live-Vorschau (kein PDF-Claim)
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.document_preview_sessions (
  id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  template_id             UUID        REFERENCES public.document_templates(id) ON DELETE SET NULL,
  template_version_id     UUID        REFERENCES public.document_template_versions(id) ON DELETE SET NULL,
  related_entity_table    TEXT,
  related_entity_id       UUID,
  preview_context         JSONB       NOT NULL DEFAULT '{}'::jsonb,
  rendered_html           TEXT,
  validation_status       TEXT        NOT NULL DEFAULT 'pending'
    CHECK (validation_status IN ('pending', 'passed', 'failed', 'skipped')),
  validation_errors       JSONB       NOT NULL DEFAULT '[]'::jsonb,
  previewed_by            UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  previewed_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_document_preview_sessions_tenant
  ON public.document_preview_sessions (tenant_id, previewed_at DESC);

CREATE INDEX IF NOT EXISTS idx_document_preview_sessions_entity
  ON public.document_preview_sessions (tenant_id, related_entity_table, related_entity_id)
  WHERE related_entity_id IS NOT NULL;

-- --------------------------------------------------------------------------
-- 9. document_render_jobs — HTML/PDF/XML-Jobs (async vorbereitet)
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.document_render_jobs (
  id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  template_id             UUID        REFERENCES public.document_templates(id) ON DELETE SET NULL,
  template_version_id     UUID        REFERENCES public.document_template_versions(id) ON DELETE SET NULL,
  related_entity_table    TEXT,
  related_entity_id       UUID,
  job_type                TEXT        NOT NULL
    CHECK (job_type IN ('preview', 'pdf', 'xml', 'pdf_a', 'package')),
  job_status              TEXT        NOT NULL DEFAULT 'queued'
    CHECK (job_status IN ('queued', 'processing', 'completed', 'failed', 'cancelled')),
  html_output             TEXT,
  pdf_path                TEXT,
  xml_path                TEXT,
  error_message           TEXT,
  started_at              TIMESTAMPTZ,
  finished_at             TIMESTAMPTZ,
  created_by              UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_document_render_jobs_tenant_status
  ON public.document_render_jobs (tenant_id, job_status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_document_render_jobs_entity
  ON public.document_render_jobs (tenant_id, related_entity_table, related_entity_id)
  WHERE related_entity_id IS NOT NULL;

-- --------------------------------------------------------------------------
-- 10. generated_documents — Erweiterung aus 0047
-- --------------------------------------------------------------------------
ALTER TABLE public.generated_documents
  ADD COLUMN IF NOT EXISTS template_version_id UUID
    REFERENCES public.document_template_versions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS related_entity_table TEXT,
  ADD COLUMN IF NOT EXISTS related_entity_id UUID,
  ADD COLUMN IF NOT EXISTS document_number TEXT,
  ADD COLUMN IF NOT EXISTS html_output TEXT,
  ADD COLUMN IF NOT EXISTS pdf_path TEXT,
  ADD COLUMN IF NOT EXISTS xml_path TEXT,
  ADD COLUMN IF NOT EXISTS json_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS previewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS finalized_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS corrected_from_document_id UUID
    REFERENCES public.generated_documents(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS cancelled_from_document_id UUID
    REFERENCES public.generated_documents(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS locked_at TIMESTAMPTZ;

COMMENT ON COLUMN public.generated_documents.content_hash IS
  'hash — Inhalts-Hash des erzeugten Dokuments (Vorbereitung für revisionssichere Ablage)';

ALTER TABLE public.generated_documents
  DROP CONSTRAINT IF EXISTS generated_documents_status_check;

ALTER TABLE public.generated_documents
  ADD CONSTRAINT generated_documents_status_check
  CHECK (status IN (
    'draft', 'preview', 'validation_failed', 'ready_to_finalize', 'finalized',
    'sent', 'archived', 'corrected', 'cancelled',
    'generated', 'signed', 'rejected', 'export_ready', 'exported',
    'ocr_pending', 'ocr_completed', 'ocr_failed'
  ));

CREATE INDEX IF NOT EXISTS idx_generated_documents_template_version
  ON public.generated_documents (tenant_id, template_version_id)
  WHERE template_version_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_generated_documents_entity
  ON public.generated_documents (tenant_id, related_entity_table, related_entity_id)
  WHERE related_entity_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_generated_documents_document_number
  ON public.generated_documents (tenant_id, document_number)
  WHERE document_number IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_generated_documents_locked
  ON public.generated_documents (tenant_id, locked_at)
  WHERE locked_at IS NOT NULL;

-- --------------------------------------------------------------------------
-- 11. document_validation_results — Prüfberichte vor Finalisierung
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.document_validation_results (
  id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  generated_document_id   UUID        REFERENCES public.generated_documents(id) ON DELETE SET NULL,
  template_version_id     UUID        REFERENCES public.document_template_versions(id) ON DELETE SET NULL,
  validation_context      JSONB       NOT NULL DEFAULT '{}'::jsonb,
  validation_status       TEXT        NOT NULL DEFAULT 'pending'
    CHECK (validation_status IN ('pending', 'passed', 'failed', 'warning')),
  errors                  JSONB       NOT NULL DEFAULT '[]'::jsonb,
  warnings                JSONB       NOT NULL DEFAULT '[]'::jsonb,
  checked_by              UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  checked_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_document_validation_results_tenant
  ON public.document_validation_results (tenant_id, checked_at DESC);

CREATE INDEX IF NOT EXISTS idx_document_validation_results_document
  ON public.document_validation_results (tenant_id, generated_document_id)
  WHERE generated_document_id IS NOT NULL;

-- --------------------------------------------------------------------------
-- 12. template_text_blocks — Textbausteine (≠ template_blocks HTML)
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.template_text_blocks (
  id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               UUID        REFERENCES public.tenants(id) ON DELETE CASCADE,
  block_key               TEXT        NOT NULL,
  category                TEXT        NOT NULL,
  title                   TEXT        NOT NULL,
  content                 TEXT        NOT NULL DEFAULT '',
  is_system               BOOLEAN     NOT NULL DEFAULT FALSE,
  text_block_status       TEXT        NOT NULL DEFAULT 'active'
    CHECK (text_block_status IN ('draft', 'active', 'inactive', 'archived')),
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT template_text_blocks_system_tenant_check
    CHECK (
      (is_system = TRUE AND tenant_id IS NULL)
      OR (is_system = FALSE AND tenant_id IS NOT NULL)
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_template_text_blocks_system_key
  ON public.template_text_blocks (block_key)
  WHERE is_system = TRUE AND tenant_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_template_text_blocks_tenant_key
  ON public.template_text_blocks (tenant_id, block_key)
  WHERE tenant_id IS NOT NULL;

-- --------------------------------------------------------------------------
-- 13. document_audit_events — Erweiterung aus 0047 (append-only)
-- --------------------------------------------------------------------------
ALTER TABLE public.document_audit_events
  ADD COLUMN IF NOT EXISTS template_id UUID
    REFERENCES public.document_templates(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS template_version_id UUID
    REFERENCES public.document_template_versions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS action TEXT,
  ADD COLUMN IF NOT EXISTS entity_type TEXT,
  ADD COLUMN IF NOT EXISTS entity_id UUID,
  ADD COLUMN IF NOT EXISTS old_value_hash TEXT,
  ADD COLUMN IF NOT EXISTS new_value_hash TEXT,
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS ip_address INET,
  ADD COLUMN IF NOT EXISTS user_agent TEXT;

-- generated_document_id als Alias-Spalte (document_id bleibt aus 0047)
COMMENT ON COLUMN public.document_audit_events.document_id IS
  'generated_document_id — erzeugtes Dokument (Legacy-Name document_id)';

CREATE INDEX IF NOT EXISTS idx_document_audit_events_template
  ON public.document_audit_events (tenant_id, template_id, created_at DESC)
  WHERE template_id IS NOT NULL;

-- --------------------------------------------------------------------------
-- Schutz: Finalisierte/gesperrte Dokumente nicht direkt änderbar
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.prevent_locked_generated_document_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF OLD.locked_at IS NOT NULL
       OR OLD.status IN ('finalized', 'archived')
       OR (OLD.finalized_at IS NOT NULL AND NEW.status IS DISTINCT FROM OLD.status AND NEW.status NOT IN ('corrected', 'cancelled'))
    THEN
      RAISE EXCEPTION 'Finalisiertes oder gesperrtes Dokument kann nicht direkt geändert werden — Korrektur nur über neuen Beleg.'
        USING ERRCODE = 'P0001';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_locked_generated_document_update ON public.generated_documents;
CREATE TRIGGER trg_prevent_locked_generated_document_update
  BEFORE UPDATE ON public.generated_documents
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_locked_generated_document_update();

COMMENT ON FUNCTION public.prevent_locked_generated_document_update() IS
  'Technische Sperre für finalisierte/archivierte generated_documents — kein GoBD-Claim';

-- --------------------------------------------------------------------------
-- updated_at Trigger
-- --------------------------------------------------------------------------
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'document_template_versions',
    'template_placeholders',
    'template_blocks',
    'tenant_document_settings',
    'template_text_blocks'
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
-- RLS aktivieren (neue Tabellen)
-- --------------------------------------------------------------------------
ALTER TABLE public.document_template_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.template_placeholders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.template_required_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.template_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_document_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_preview_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_render_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_validation_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.template_text_blocks ENABLE ROW LEVEL SECURITY;

-- --------------------------------------------------------------------------
-- RLS: document_templates — System lesbar, Mandant eigene; Schreiben Admin
-- (Policies aus 0047 ersetzen/ergänzen für Systemvorlagen)
-- --------------------------------------------------------------------------
DROP POLICY IF EXISTS document_templates_tenant_select ON public.document_templates;
CREATE POLICY document_templates_tenant_select ON public.document_templates
  FOR SELECT TO authenticated
  USING (
    tenant_id IS NULL
    OR tenant_id = public.current_tenant_id()
  );

DROP POLICY IF EXISTS document_templates_tenant_write ON public.document_templates;
CREATE POLICY document_templates_tenant_write ON public.document_templates
  FOR ALL TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND public.is_document_module_admin()
  )
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND public.is_document_module_admin()
    AND is_system_template = FALSE
  );

DROP POLICY IF EXISTS document_templates_system_write ON public.document_templates;
CREATE POLICY document_templates_system_insert ON public.document_templates
  FOR INSERT TO authenticated
  WITH CHECK (
    is_system_template = TRUE
    AND tenant_id IS NULL
    AND public.is_document_module_admin()
  );

-- --------------------------------------------------------------------------
-- RLS: document_template_versions
-- --------------------------------------------------------------------------
DROP POLICY IF EXISTS document_template_versions_select ON public.document_template_versions;
CREATE POLICY document_template_versions_select ON public.document_template_versions
  FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS document_template_versions_write ON public.document_template_versions;
CREATE POLICY document_template_versions_write ON public.document_template_versions
  FOR ALL TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND public.is_document_module_admin()
  )
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND public.is_document_module_admin()
  );

-- --------------------------------------------------------------------------
-- RLS: template_placeholders — System global lesbar
-- --------------------------------------------------------------------------
DROP POLICY IF EXISTS template_placeholders_select ON public.template_placeholders;
CREATE POLICY template_placeholders_select ON public.template_placeholders
  FOR SELECT TO authenticated
  USING (
    tenant_id IS NULL
    OR tenant_id = public.current_tenant_id()
  );

DROP POLICY IF EXISTS template_placeholders_write ON public.template_placeholders;
CREATE POLICY template_placeholders_write ON public.template_placeholders
  FOR ALL TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND public.is_document_module_admin()
  )
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND public.is_document_module_admin()
  );

-- --------------------------------------------------------------------------
-- RLS: template_required_fields, template_blocks, template_text_blocks
-- --------------------------------------------------------------------------
DROP POLICY IF EXISTS template_required_fields_tenant ON public.template_required_fields;
CREATE POLICY template_required_fields_tenant ON public.template_required_fields
  FOR ALL TO authenticated
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND public.is_document_module_admin()
  );

DROP POLICY IF EXISTS template_blocks_select ON public.template_blocks;
CREATE POLICY template_blocks_select ON public.template_blocks
  FOR SELECT TO authenticated
  USING (tenant_id IS NULL OR tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS template_blocks_write ON public.template_blocks;
CREATE POLICY template_blocks_write ON public.template_blocks
  FOR ALL TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND public.is_document_module_admin()
  )
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND public.is_document_module_admin()
  );

DROP POLICY IF EXISTS template_text_blocks_select ON public.template_text_blocks;
CREATE POLICY template_text_blocks_select ON public.template_text_blocks
  FOR SELECT TO authenticated
  USING (tenant_id IS NULL OR tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS template_text_blocks_write ON public.template_text_blocks;
CREATE POLICY template_text_blocks_write ON public.template_text_blocks
  FOR ALL TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND public.is_document_module_admin()
  )
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND public.is_document_module_admin()
  );

-- --------------------------------------------------------------------------
-- RLS: tenant_document_settings — Mandant lesen; Admin schreiben
-- --------------------------------------------------------------------------
DROP POLICY IF EXISTS tenant_document_settings_select ON public.tenant_document_settings;
CREATE POLICY tenant_document_settings_select ON public.tenant_document_settings
  FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS tenant_document_settings_write ON public.tenant_document_settings;
CREATE POLICY tenant_document_settings_write ON public.tenant_document_settings
  FOR ALL TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND public.is_document_module_admin()
  )
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND public.is_document_module_admin()
  );

-- --------------------------------------------------------------------------
-- RLS: generated_documents — lesen Mandant; schreiben Admin; Update-Lock via Trigger
-- --------------------------------------------------------------------------
DROP POLICY IF EXISTS generated_documents_tenant_select ON public.generated_documents;
CREATE POLICY generated_documents_tenant_select ON public.generated_documents
  FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS generated_documents_tenant_write ON public.generated_documents;
CREATE POLICY generated_documents_tenant_write ON public.generated_documents
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND public.is_document_module_admin()
  );

DROP POLICY IF EXISTS generated_documents_tenant_update ON public.generated_documents;
CREATE POLICY generated_documents_tenant_update ON public.generated_documents
  FOR UPDATE TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND public.is_document_module_admin()
  )
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND public.is_document_module_admin()
  );

-- --------------------------------------------------------------------------
-- RLS: document_preview_sessions, document_render_jobs, document_validation_results
-- --------------------------------------------------------------------------
DROP POLICY IF EXISTS document_preview_sessions_tenant ON public.document_preview_sessions;
CREATE POLICY document_preview_sessions_tenant ON public.document_preview_sessions
  FOR ALL TO authenticated
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS document_render_jobs_tenant ON public.document_render_jobs;
CREATE POLICY document_render_jobs_tenant ON public.document_render_jobs
  FOR ALL TO authenticated
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS document_validation_results_tenant ON public.document_validation_results;
CREATE POLICY document_validation_results_tenant ON public.document_validation_results
  FOR ALL TO authenticated
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

-- --------------------------------------------------------------------------
-- RLS: document_audit_events — append-only (SELECT + INSERT, kein DELETE)
-- --------------------------------------------------------------------------
DROP POLICY IF EXISTS document_audit_events_tenant_select ON public.document_audit_events;
CREATE POLICY document_audit_events_tenant_select ON public.document_audit_events
  FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS document_audit_events_tenant_insert ON public.document_audit_events;
CREATE POLICY document_audit_events_tenant_insert ON public.document_audit_events
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.current_tenant_id());

-- Keine UPDATE/DELETE Policies → append-only

-- --------------------------------------------------------------------------
-- GRANTs — keine Secrets in diesen Tabellen
-- --------------------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE, DELETE ON public.document_template_versions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.template_placeholders TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.template_required_fields TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.template_blocks TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.template_text_blocks TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tenant_document_settings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.document_preview_sessions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.document_render_jobs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.document_validation_results TO authenticated;
GRANT SELECT, INSERT ON public.document_audit_events TO authenticated;

-- --------------------------------------------------------------------------
-- Kommentare
-- --------------------------------------------------------------------------
COMMENT ON TABLE public.document_template_versions IS
  'HTML/CSS-Vorlagenversionen für Modul Vorlagen & Dokumente — getrennt von template_versions (0014 Paket F)';

COMMENT ON TABLE public.tenant_document_settings IS
  'Mandanten-CI für Dokumente — Logo, Farben, Ränder, Bankdaten; kein GoBD-Claim';

COMMENT ON TABLE public.document_preview_sessions IS
  'Live-Vorschau — HTML only, kein produktives PDF';

COMMENT ON TABLE public.document_render_jobs IS
  'Render-Jobs — pdf_path erst nach serverseitiger Erzeugung befüllen';

COMMENT ON TABLE public.generated_documents IS
  'Erzeugte Dokumente — locked_at/finalized_at sperren direkte Änderung';

COMMENT ON TABLE public.document_validation_results IS
  'Validierungsergebnisse vor Finalisierung — Pflichtfelder, Steuer, Nummernkreis';

COMMENT ON TABLE public.document_audit_events IS
  'Append-only Audit — keine Löschung; GoBD-Vorbereitung, kein Konformitäts-Claim';

COMMENT ON TABLE public.template_placeholders IS
  'Platzhalter-Registry — is_sensitive markiert personenbezogene Felder';
