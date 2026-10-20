-- ==========================================================================
-- CareSuite+ — Migration 0168: Dokumenten-Engine Master (Foundation + Spec)
-- Erweitert 0047/0048 oder legt Kern-Tabellen idempotent an.
-- Keine destruktiven Befehle. NICHT blind auf Remote pushen.
-- ==========================================================================

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

-- --------------------------------------------------------------------------
-- Bootstrap: document_templates (falls 0047 noch nicht angewendet)
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.document_templates (
  id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               UUID        REFERENCES public.tenants(id) ON DELETE CASCADE,
  template_key            TEXT        NOT NULL,
  template_type           TEXT        NOT NULL DEFAULT 'generic',
  label                   TEXT        NOT NULL,
  description             TEXT,
  content_schema_json     JSONB       NOT NULL DEFAULT '{}'::jsonb,
  is_active               BOOLEAN     NOT NULL DEFAULT TRUE,
  version                 INTEGER     NOT NULL DEFAULT 1,
  created_by              UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

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
  version_status          TEXT        NOT NULL DEFAULT 'draft',
  created_by              UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  activated_by            UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  activated_at            TIMESTAMPTZ,
  finalized_at            TIMESTAMPTZ,
  archived_at             TIMESTAMPTZ,
  UNIQUE (tenant_id, template_id, version_number)
);

CREATE TABLE IF NOT EXISTS public.generated_documents (
  id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  template_id             UUID        REFERENCES public.document_templates(id) ON DELETE SET NULL,
  document_type           TEXT        NOT NULL DEFAULT 'generic',
  title                   TEXT        NOT NULL,
  status                  TEXT        NOT NULL DEFAULT 'draft',
  current_version         INTEGER     NOT NULL DEFAULT 1,
  client_id               UUID        REFERENCES public.clients(id) ON DELETE SET NULL,
  metadata_json           JSONB       NOT NULL DEFAULT '{}'::jsonb,
  created_by              UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

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

CREATE TABLE IF NOT EXISTS public.document_render_jobs (
  id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  template_id             UUID        REFERENCES public.document_templates(id) ON DELETE SET NULL,
  template_version_id     UUID        REFERENCES public.document_template_versions(id) ON DELETE SET NULL,
  related_entity_table    TEXT,
  related_entity_id       UUID,
  job_type                TEXT        NOT NULL DEFAULT 'pdf',
  job_status              TEXT        NOT NULL DEFAULT 'queued',
  html_output             TEXT,
  pdf_path                TEXT,
  error_message           TEXT,
  started_at              TIMESTAMPTZ,
  finished_at             TIMESTAMPTZ,
  created_by              UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- --------------------------------------------------------------------------
-- document_templates — Spec-Erweiterung (§8.1)
-- --------------------------------------------------------------------------
ALTER TABLE public.document_templates
  ALTER COLUMN tenant_id DROP NOT NULL;

ALTER TABLE public.document_templates
  ADD COLUMN IF NOT EXISTS template_name TEXT,
  ADD COLUMN IF NOT EXISTS module_scope TEXT[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS template_number INTEGER,
  ADD COLUMN IF NOT EXISTS short_name TEXT,
  ADD COLUMN IF NOT EXISTS category TEXT,
  ADD COLUMN IF NOT EXISTS subcategory TEXT,
  ADD COLUMN IF NOT EXISTS purpose TEXT,
  ADD COLUMN IF NOT EXISTS document_kind TEXT,
  ADD COLUMN IF NOT EXISTS layout_kind TEXT NOT NULL DEFAULT 'premium',
  ADD COLUMN IF NOT EXISTS template_status TEXT NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS is_system_template BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_tenant_template BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS is_imported_template BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_editable BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS is_fillable BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS is_pdf_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS is_docx_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_email_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS is_fax_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS is_signature_required BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_client_signature_required BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_employee_signature_required BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_representative_signature_allowed BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_office_signature_required BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_billable_relevant BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_care_related BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_assist_allowed BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_medical_or_treatment_related BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS requires_professional_role BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS required_permission TEXT,
  ADD COLUMN IF NOT EXISTS visibility_scope TEXT NOT NULL DEFAULT 'tenant',
  ADD COLUMN IF NOT EXISTS target_record_type TEXT,
  ADD COLUMN IF NOT EXISTS default_storage_area TEXT,
  ADD COLUMN IF NOT EXISTS default_file_name_pattern TEXT,
  ADD COLUMN IF NOT EXISTS tags TEXT[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS content_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS form_schema_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS variable_schema_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS mapping_schema_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS validation_rules_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS print_settings_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS send_settings_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS archive_settings_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS current_version_id UUID,
  ADD COLUMN IF NOT EXISTS document_category TEXT,
  ADD COLUMN IF NOT EXISTS is_default BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

UPDATE public.document_templates
SET template_name = COALESCE(template_name, label)
WHERE template_name IS NULL AND label IS NOT NULL;

-- --------------------------------------------------------------------------
-- generated_documents — Spec-Erweiterung (§8.3)
-- --------------------------------------------------------------------------
ALTER TABLE public.generated_documents
  ADD COLUMN IF NOT EXISTS template_version_id UUID REFERENCES public.document_template_versions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS template_version INTEGER,
  ADD COLUMN IF NOT EXISTS module_scope TEXT,
  ADD COLUMN IF NOT EXISTS record_type TEXT,
  ADD COLUMN IF NOT EXISTS employee_id UUID REFERENCES public.employees(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS assignment_id UUID,
  ADD COLUMN IF NOT EXISTS invoice_id UUID,
  ADD COLUMN IF NOT EXISTS contract_id UUID,
  ADD COLUMN IF NOT EXISTS vehicle_id UUID,
  ADD COLUMN IF NOT EXISTS course_id UUID,
  ADD COLUMN IF NOT EXISTS consultation_id UUID,
  ADD COLUMN IF NOT EXISTS document_number TEXT,
  ADD COLUMN IF NOT EXISTS file_name TEXT,
  ADD COLUMN IF NOT EXISTS generated_content_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS autofill_snapshot_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS manual_overrides_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS pdf_file_id UUID,
  ADD COLUMN IF NOT EXISTS docx_file_id UUID,
  ADD COLUMN IF NOT EXISTS signed_file_id UUID,
  ADD COLUMN IF NOT EXISTS preview_file_id UUID,
  ADD COLUMN IF NOT EXISTS pdf_path TEXT,
  ADD COLUMN IF NOT EXISTS html_output TEXT,
  ADD COLUMN IF NOT EXISTS signature_status TEXT NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS email_status TEXT NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS fax_status TEXT NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS archived_in_area TEXT,
  ADD COLUMN IF NOT EXISTS finalized_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS finalized_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS locked_at TIMESTAMPTZ;

-- --------------------------------------------------------------------------
-- document_template_fields (§8.4)
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.document_template_fields (
  id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  template_id             UUID        NOT NULL REFERENCES public.document_templates(id) ON DELETE CASCADE,
  field_key               TEXT        NOT NULL,
  label                   TEXT        NOT NULL,
  description             TEXT,
  field_type              TEXT        NOT NULL DEFAULT 'text',
  variable_path           TEXT,
  default_value           TEXT,
  placeholder             TEXT,
  required                BOOLEAN     NOT NULL DEFAULT FALSE,
  editable_after_autofill BOOLEAN     NOT NULL DEFAULT TRUE,
  visible_in_preview      BOOLEAN     NOT NULL DEFAULT TRUE,
  visible_in_pdf          BOOLEAN     NOT NULL DEFAULT TRUE,
  validation_rule_json    JSONB       NOT NULL DEFAULT '{}'::jsonb,
  options_source          TEXT,
  options_json            JSONB       NOT NULL DEFAULT '[]'::jsonb,
  sort_order              INTEGER     NOT NULL DEFAULT 0,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, template_id, field_key)
);

CREATE INDEX IF NOT EXISTS idx_document_template_fields_template
  ON public.document_template_fields (tenant_id, template_id, sort_order);

-- --------------------------------------------------------------------------
-- document_template_bindings (§8.5)
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.document_template_bindings (
  id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  template_id             UUID        NOT NULL REFERENCES public.document_templates(id) ON DELETE CASCADE,
  target_module           TEXT        NOT NULL,
  target_area             TEXT        NOT NULL,
  target_component        TEXT,
  trigger_event           TEXT,
  binding_type            TEXT        NOT NULL DEFAULT 'optional',
  is_default              BOOLEAN     NOT NULL DEFAULT FALSE,
  is_required             BOOLEAN     NOT NULL DEFAULT FALSE,
  is_active               BOOLEAN     NOT NULL DEFAULT TRUE,
  conditions_json         JSONB       NOT NULL DEFAULT '{}'::jsonb,
  sort_order              INTEGER     NOT NULL DEFAULT 0,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_document_template_bindings_lookup
  ON public.document_template_bindings (tenant_id, target_module, target_area, is_active);

-- --------------------------------------------------------------------------
-- document_send_logs (§8.6)
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.document_send_logs (
  id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  document_id             UUID        NOT NULL REFERENCES public.generated_documents(id) ON DELETE CASCADE,
  send_channel            TEXT        NOT NULL CHECK (send_channel IN ('email', 'fax')),
  recipient_type          TEXT,
  recipient_name          TEXT,
  recipient_email         TEXT,
  recipient_fax           TEXT,
  subject                 TEXT,
  message                 TEXT,
  integration_provider    TEXT,
  status                  TEXT        NOT NULL DEFAULT 'pending',
  error_message           TEXT,
  sent_by                 UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  sent_at                 TIMESTAMPTZ,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_document_send_logs_document
  ON public.document_send_logs (tenant_id, document_id, created_at DESC);

-- --------------------------------------------------------------------------
-- document_audit_log (§8.7) — append-only
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.document_audit_log (
  id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  actor_user_id           UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  actor_role              TEXT,
  action                  TEXT        NOT NULL,
  entity_type             TEXT        NOT NULL,
  entity_id               UUID        NOT NULL,
  old_value_json          JSONB,
  new_value_json          JSONB,
  ip_address              TEXT,
  user_agent              TEXT,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_document_audit_log_tenant
  ON public.document_audit_log (tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_document_audit_log_entity
  ON public.document_audit_log (tenant_id, entity_type, entity_id);

-- Intake bridge
ALTER TABLE public.client_intake_documents
  ADD COLUMN IF NOT EXISTS generated_document_id UUID REFERENCES public.generated_documents(id) ON DELETE SET NULL;

-- --------------------------------------------------------------------------
-- RLS
-- --------------------------------------------------------------------------
ALTER TABLE public.document_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_template_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.generated_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_template_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_template_bindings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_send_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_document_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_render_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS document_templates_select ON public.document_templates;
CREATE POLICY document_templates_select ON public.document_templates
  FOR SELECT TO authenticated
  USING (
    tenant_id IS NULL
    OR tenant_id = public.current_tenant_id()
  );

DROP POLICY IF EXISTS document_templates_write ON public.document_templates;
CREATE POLICY document_templates_write ON public.document_templates
  FOR ALL TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND public.is_document_module_admin()
  )
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND public.is_document_module_admin()
  );

DROP POLICY IF EXISTS document_template_versions_tenant ON public.document_template_versions;
CREATE POLICY document_template_versions_tenant ON public.document_template_versions
  FOR ALL TO authenticated
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS generated_documents_tenant ON public.generated_documents;
CREATE POLICY generated_documents_tenant ON public.generated_documents
  FOR ALL TO authenticated
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS document_template_fields_tenant ON public.document_template_fields;
CREATE POLICY document_template_fields_tenant ON public.document_template_fields
  FOR ALL TO authenticated
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS document_template_bindings_tenant ON public.document_template_bindings;
CREATE POLICY document_template_bindings_tenant ON public.document_template_bindings
  FOR ALL TO authenticated
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS document_send_logs_tenant ON public.document_send_logs;
CREATE POLICY document_send_logs_tenant ON public.document_send_logs
  FOR ALL TO authenticated
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS document_audit_log_select ON public.document_audit_log;
CREATE POLICY document_audit_log_select ON public.document_audit_log
  FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS document_audit_log_insert ON public.document_audit_log;
CREATE POLICY document_audit_log_insert ON public.document_audit_log
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS tenant_document_settings_tenant ON public.tenant_document_settings;
CREATE POLICY tenant_document_settings_tenant ON public.tenant_document_settings
  FOR ALL TO authenticated
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS document_render_jobs_tenant ON public.document_render_jobs;
CREATE POLICY document_render_jobs_tenant ON public.document_render_jobs
  FOR ALL TO authenticated
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.document_templates TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.document_template_versions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.generated_documents TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.document_template_fields TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.document_template_bindings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.document_send_logs TO authenticated;
GRANT SELECT, INSERT ON public.document_audit_log TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tenant_document_settings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.document_render_jobs TO authenticated;

COMMENT ON TABLE public.document_template_fields IS 'Normalisierte Formularfelder je HTML-Dokumentvorlage';
COMMENT ON TABLE public.document_template_bindings IS 'Modul-/UI-Bindings für Dokumentvorlagen';
COMMENT ON TABLE public.document_send_logs IS 'Versandprotokoll E-Mail/Fax für erzeugte Dokumente';
COMMENT ON TABLE public.document_audit_log IS 'Append-only Audit für Vorlagen- und Dokumenten-Engine';
