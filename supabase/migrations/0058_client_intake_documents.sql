-- Client intake documents: system templates, tenant overrides, signatures, consent tracking
-- Pattern aligned with 0057_cost_carrier_rls_grants.sql (RLS + GRANTs)

-- --------------------------------------------------------------------------
-- 1. intake_document_system_templates
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.intake_document_system_templates (
  id                              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_key                    TEXT NOT NULL UNIQUE,
  title                           TEXT NOT NULL,
  document_type                   TEXT NOT NULL
    CHECK (document_type IN ('privacy_consent', 'assignment_declaration', 'client_contract', 'additional_consent')),
  service_type                    TEXT,
  version                         INTEGER NOT NULL DEFAULT 1,
  is_system_template              BOOLEAN NOT NULL DEFAULT TRUE,
  is_required                     BOOLEAN NOT NULL DEFAULT FALSE,
  is_active                       BOOLEAN NOT NULL DEFAULT TRUE,
  requires_client_signature       BOOLEAN NOT NULL DEFAULT FALSE,
  requires_employee_signature     BOOLEAN NOT NULL DEFAULT FALSE,
  requires_representative_signature BOOLEAN NOT NULL DEFAULT FALSE,
  allows_custom_template          BOOLEAN NOT NULL DEFAULT TRUE,
  html_content                    TEXT NOT NULL,
  plain_text_content              TEXT NOT NULL,
  placeholder_schema              JSONB NOT NULL DEFAULT '{}'::jsonb,
  signature_slots                 JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at                      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_intake_doc_system_templates_type
  ON public.intake_document_system_templates (document_type, service_type, is_active);

-- --------------------------------------------------------------------------
-- 2. tenant_document_templates — Mandantenvorlagen (System bleibt unverändert)
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tenant_document_templates (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  system_template_id  UUID REFERENCES public.intake_document_system_templates(id) ON DELETE SET NULL,
  template_key        TEXT NOT NULL,
  title               TEXT,
  document_type       TEXT NOT NULL,
  service_type        TEXT,
  html_content        TEXT,
  is_default          BOOLEAN NOT NULL DEFAULT FALSE,
  is_active           BOOLEAN NOT NULL DEFAULT TRUE,
  created_by          UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_by          UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, template_key)
);

CREATE INDEX IF NOT EXISTS idx_tenant_document_templates_tenant
  ON public.tenant_document_templates (tenant_id, template_key, is_active);

-- --------------------------------------------------------------------------
-- 3. client_intake_documents
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.client_intake_documents (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  client_id               UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  template_key            TEXT NOT NULL,
  document_type           TEXT NOT NULL,
  title                   TEXT NOT NULL,
  status                  TEXT NOT NULL DEFAULT 'not_started'
    CHECK (status IN (
      'not_started', 'preview_open', 'pending_signature', 'signed', 'declined',
      'skipped_optional', 'finalized', 'revoked', 'replaced'
    )),
  is_required             BOOLEAN NOT NULL DEFAULT FALSE,
  version                 INTEGER NOT NULL DEFAULT 1,
  source                  TEXT NOT NULL DEFAULT 'system' CHECK (source IN ('system', 'tenant')),
  tenant_template_id      UUID REFERENCES public.tenant_document_templates(id) ON DELETE SET NULL,
  preview_html            TEXT,
  finalized_html          TEXT,
  rendered_pdf_path       TEXT,
  missing_placeholders    JSONB NOT NULL DEFAULT '[]'::jsonb,
  preview_opened_at       TIMESTAMPTZ,
  finalized_at            TIMESTAMPTZ,
  updated_by              UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, client_id, template_key)
);

CREATE INDEX IF NOT EXISTS idx_client_intake_documents_client
  ON public.client_intake_documents (tenant_id, client_id, status);

-- --------------------------------------------------------------------------
-- 4. client_document_signatures
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.client_document_signatures (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  client_id       UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  document_id     UUID NOT NULL REFERENCES public.client_intake_documents(id) ON DELETE CASCADE,
  signer_role     TEXT NOT NULL CHECK (signer_role IN ('client', 'employee', 'legal_representative')),
  signature_data  TEXT NOT NULL,
  signed_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  signer_name     TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (document_id, signer_role)
);

-- --------------------------------------------------------------------------
-- 5. client_document_events
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.client_document_events (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  client_id           UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  document_id         UUID REFERENCES public.client_intake_documents(id) ON DELETE CASCADE,
  event_type          TEXT NOT NULL,
  summary             TEXT NOT NULL,
  metadata_json       JSONB NOT NULL DEFAULT '{}'::jsonb,
  actor_profile_id    UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_client_document_events_client
  ON public.client_document_events (tenant_id, client_id, created_at DESC);

-- --------------------------------------------------------------------------
-- 6. client_contract_selection
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.client_contract_selection (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  client_id               UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  contract_type           TEXT NOT NULL,
  selected_template_key   TEXT,
  updated_by              UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, client_id)
);

-- --------------------------------------------------------------------------
-- 7. client_consent_status
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.client_consent_status (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  client_id               UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  privacy_status          TEXT NOT NULL DEFAULT 'not_started',
  contract_status         TEXT NOT NULL DEFAULT 'not_started',
  assignment_status       TEXT NOT NULL DEFAULT 'not_started',
  privacy_finalized_at    TIMESTAMPTZ,
  contract_finalized_at   TIMESTAMPTZ,
  updated_by              UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, client_id)
);

-- --------------------------------------------------------------------------
-- RLS
-- --------------------------------------------------------------------------
ALTER TABLE public.intake_document_system_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_document_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_intake_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_document_signatures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_document_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_contract_selection ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_consent_status ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS intake_doc_system_templates_read ON public.intake_document_system_templates;
CREATE POLICY intake_doc_system_templates_read ON public.intake_document_system_templates
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS intake_doc_system_templates_service ON public.intake_document_system_templates;
CREATE POLICY intake_doc_system_templates_service ON public.intake_document_system_templates
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS tenant_document_templates_select ON public.tenant_document_templates;
CREATE POLICY tenant_document_templates_select ON public.tenant_document_templates
  FOR SELECT TO authenticated
  USING (tenant_id = public.caresuite_current_tenant_id());

DROP POLICY IF EXISTS tenant_document_templates_write ON public.tenant_document_templates;
CREATE POLICY tenant_document_templates_write ON public.tenant_document_templates
  FOR ALL TO authenticated
  USING (tenant_id = public.caresuite_current_tenant_id())
  WITH CHECK (tenant_id = public.caresuite_current_tenant_id());

DROP POLICY IF EXISTS client_intake_documents_tenant ON public.client_intake_documents;
CREATE POLICY client_intake_documents_tenant ON public.client_intake_documents
  FOR ALL TO authenticated
  USING (tenant_id = public.caresuite_current_tenant_id())
  WITH CHECK (tenant_id = public.caresuite_current_tenant_id());

DROP POLICY IF EXISTS client_document_signatures_tenant ON public.client_document_signatures;
CREATE POLICY client_document_signatures_tenant ON public.client_document_signatures
  FOR ALL TO authenticated
  USING (tenant_id = public.caresuite_current_tenant_id())
  WITH CHECK (tenant_id = public.caresuite_current_tenant_id());

DROP POLICY IF EXISTS client_document_events_tenant ON public.client_document_events;
CREATE POLICY client_document_events_tenant ON public.client_document_events
  FOR ALL TO authenticated
  USING (tenant_id = public.caresuite_current_tenant_id())
  WITH CHECK (tenant_id = public.caresuite_current_tenant_id());

DROP POLICY IF EXISTS client_contract_selection_tenant ON public.client_contract_selection;
CREATE POLICY client_contract_selection_tenant ON public.client_contract_selection
  FOR ALL TO authenticated
  USING (tenant_id = public.caresuite_current_tenant_id())
  WITH CHECK (tenant_id = public.caresuite_current_tenant_id());

DROP POLICY IF EXISTS client_consent_status_tenant ON public.client_consent_status;
CREATE POLICY client_consent_status_tenant ON public.client_consent_status
  FOR ALL TO authenticated
  USING (tenant_id = public.caresuite_current_tenant_id())
  WITH CHECK (tenant_id = public.caresuite_current_tenant_id());

-- --------------------------------------------------------------------------
-- GRANTs
-- --------------------------------------------------------------------------
GRANT SELECT ON public.intake_document_system_templates TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.tenant_document_templates TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.client_intake_documents TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.client_document_signatures TO authenticated;
GRANT SELECT, INSERT ON public.client_document_events TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.client_contract_selection TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.client_consent_status TO authenticated;

-- --------------------------------------------------------------------------
-- System template seeds (German legal content — Systemvorlage)
-- --------------------------------------------------------------------------
INSERT INTO public.intake_document_system_templates (
  template_key, title, document_type, service_type, is_required,
  requires_client_signature, requires_employee_signature,
  html_content, plain_text_content, placeholder_schema, signature_slots
) VALUES
(
  'privacy_consent_default',
  'Datenschutz-Einwilligung',
  'privacy_consent',
  NULL,
  TRUE,
  TRUE,
  FALSE,
  '<h1>Einwilligung zur Verarbeitung personenbezogener Daten (DSGVO)</h1><p>Mandant: {{tenant.name}}</p><p>Klient:in: {{client.full_name}}, geb. {{client.date_of_birth}}</p><p>Ich willige ein, dass meine personenbezogenen Daten — einschließlich Gesundheitsdaten, soweit erforderlich — zum Zweck der Leistungserbringung, Dokumentation und Abrechnung verarbeitet werden.</p><p>Ort/Datum: {{document.location}}, {{document.date}}</p><p>{{signature.client}}</p>',
  'Datenschutz-Einwilligung gemäß DSGVO.',
  '{"tenant.name":{"label":"Mandant","required":true},"client.full_name":{"label":"Name","required":true},"client.date_of_birth":{"label":"Geburtsdatum","required":true},"document.date":{"label":"Datum","required":true},"document.location":{"label":"Ort","required":true}}'::jsonb,
  '[{"role":"client","placeholder":"{{signature.client}}","required":true}]'::jsonb
),
(
  'assignment_declaration_care_health_insurance',
  'Abtretungserklärung / Direktabrechnung',
  'assignment_declaration',
  NULL,
  FALSE,
  TRUE,
  FALSE,
  '<h1>Abtretungserklärung</h1><p>Ich, {{client.full_name}}, trete Ansprüche gegenüber der Pflegekasse {{cost_carrier.care_fund_name}} (IK {{cost_carrier.care_fund_ik}}) an {{tenant.name}} ab.</p><p>Versichertennummer: {{client.insurance_number}} · Pflegegrad: {{care.level}}</p><p>{{signature.client}}</p>',
  'Abtretungserklärung für Direktabrechnung.',
  '{"client.full_name":{"label":"Name","required":true},"cost_carrier.care_fund_name":{"label":"Pflegekasse","required":true},"client.insurance_number":{"label":"Versichertennummer","required":true},"care.level":{"label":"Pflegegrad","required":true}}'::jsonb,
  '[{"role":"client","placeholder":"{{signature.client}}","required":true}]'::jsonb
),
(
  'client_contract_assist',
  'Kundenvertrag Alltagsbegleitung',
  'client_contract',
  'assist',
  TRUE,
  TRUE,
  TRUE,
  '<h1>Versorgungsvertrag Alltagsbegleitung</h1><p>Zwischen {{tenant.name}} und {{client.full_name}}. Leistungsbeginn: {{contract.service_start}}.</p><p>{{signature.client}} {{signature.employee}}</p>',
  'Versorgungsvertrag Alltagsbegleitung.',
  '{"tenant.name":{"label":"Mandant","required":true},"client.full_name":{"label":"Name","required":true},"contract.service_start":{"label":"Leistungsbeginn","required":true}}'::jsonb,
  '[{"role":"client","placeholder":"{{signature.client}}","required":true},{"role":"employee","placeholder":"{{signature.employee}}","required":true}]'::jsonb
),
(
  'client_contract_ambulatory_care',
  'Kundenvertrag Ambulante Pflege',
  'client_contract',
  'ambulatory_care',
  TRUE,
  TRUE,
  TRUE,
  '<h1>Versorgungsvertrag Ambulante Pflege</h1><p>{{client.full_name}} · Pflegegrad {{care.level}} · Pflegekasse {{cost_carrier.care_fund_name}}</p><p>{{signature.client}} {{signature.employee}}</p>',
  'Versorgungsvertrag ambulante Pflege.',
  '{"client.full_name":{"label":"Name","required":true},"care.level":{"label":"Pflegegrad","required":true},"cost_carrier.care_fund_name":{"label":"Pflegekasse","required":true}}'::jsonb,
  '[{"role":"client","placeholder":"{{signature.client}}","required":true},{"role":"employee","placeholder":"{{signature.employee}}","required":true}]'::jsonb
),
(
  'client_contract_stationary_care',
  'Kundenvertrag Stationäre Pflege',
  'client_contract',
  'stationary_care',
  TRUE,
  TRUE,
  TRUE,
  '<h1>Versorgungsvertrag Stationäre Pflege</h1><p>{{client.full_name}} · Einrichtung {{facility.name}} · Zimmer {{facility.room_number}}</p><p>{{signature.client}} {{signature.employee}}</p>',
  'Versorgungsvertrag stationäre Pflege.',
  '{"client.full_name":{"label":"Name","required":true},"facility.name":{"label":"Einrichtung","required":true},"care.level":{"label":"Pflegegrad","required":true}}'::jsonb,
  '[{"role":"client","placeholder":"{{signature.client}}","required":true},{"role":"employee","placeholder":"{{signature.employee}}","required":true}]'::jsonb
),
(
  'client_contract_care_consulting',
  'Kundenvertrag Pflegeberatung',
  'client_contract',
  'care_consulting',
  TRUE,
  TRUE,
  TRUE,
  '<h1>Beratungsvereinbarung § 7a SGB XI</h1><p>{{client.full_name}} · Anlass: {{consulting.reason}}</p><p>{{signature.client}} {{signature.employee}}</p>',
  'Beratungsvereinbarung Pflegeberatung.',
  '{"client.full_name":{"label":"Name","required":true},"consulting.reason":{"label":"Beratungsanlass","required":true}}'::jsonb,
  '[{"role":"client","placeholder":"{{signature.client}}","required":true},{"role":"employee","placeholder":"{{signature.employee}}","required":true}]'::jsonb
),
(
  'client_contract_day_care',
  'Kundenvertrag Tagespflege',
  'client_contract',
  'day_care',
  TRUE,
  TRUE,
  TRUE,
  '<h1>Versorgungsvertrag Tagespflege</h1><p>{{client.full_name}} · Pflegegrad {{care.level}}</p><p>{{signature.client}} {{signature.employee}}</p>',
  'Versorgungsvertrag Tagespflege.',
  '{"client.full_name":{"label":"Name","required":true},"care.level":{"label":"Pflegegrad","required":true}}'::jsonb,
  '[{"role":"client","placeholder":"{{signature.client}}","required":true},{"role":"employee","placeholder":"{{signature.employee}}","required":true}]'::jsonb
),
(
  'client_contract_relief_services',
  'Kundenvertrag Entlastungsleistungen',
  'client_contract',
  'relief_services',
  TRUE,
  TRUE,
  TRUE,
  '<h1>Versorgungsvertrag Entlastungsleistungen § 45b SGB XI</h1><p>{{client.full_name}} · Pflegegrad {{care.level}}</p><p>{{signature.client}} {{signature.employee}}</p>',
  'Versorgungsvertrag Entlastungsleistungen.',
  '{"client.full_name":{"label":"Name","required":true},"care.level":{"label":"Pflegegrad","required":true}}'::jsonb,
  '[{"role":"client","placeholder":"{{signature.client}}","required":true},{"role":"employee","placeholder":"{{signature.employee}}","required":true}]'::jsonb
),
(
  'confidentiality_release_default',
  'Schweigepflichtentbindung',
  'additional_consent',
  NULL,
  FALSE,
  TRUE,
  FALSE,
  '<h1>Schweigepflichtentbindung</h1><p>{{client.full_name}} entbindet {{tenant.name}} gegenüber {{consulting.family_doctor}}.</p><p>{{signature.client}}</p>',
  'Schweigepflichtentbindung.',
  '{"client.full_name":{"label":"Name","required":true}}'::jsonb,
  '[{"role":"client","placeholder":"{{signature.client}}","required":true}]'::jsonb
),
(
  'communication_consent_default',
  'Kommunikationseinwilligung',
  'additional_consent',
  NULL,
  FALSE,
  TRUE,
  FALSE,
  '<h1>Kommunikationseinwilligung</h1><p>Kontakt über {{client.phone}} / {{client.email}}.</p><p>{{signature.client}}</p>',
  'Einwilligung zur Kommunikation.',
  '{"client.full_name":{"label":"Name","required":true}}'::jsonb,
  '[{"role":"client","placeholder":"{{signature.client}}","required":true}]'::jsonb
),
(
  'photo_media_consent_default',
  'Foto- und Medien-Einwilligung',
  'additional_consent',
  NULL,
  FALSE,
  TRUE,
  FALSE,
  '<h1>Foto-/Medieneinwilligung</h1><p>Dokumentationsrelevante Fotos dürfen gespeichert werden.</p><p>{{signature.client}}</p>',
  'Foto- und Medieneinwilligung.',
  '{"client.full_name":{"label":"Name","required":true}}'::jsonb,
  '[{"role":"client","placeholder":"{{signature.client}}","required":true}]'::jsonb
),
(
  'emergency_contact_consent_default',
  'Einwilligung Notfallkontakt',
  'additional_consent',
  NULL,
  FALSE,
  TRUE,
  FALSE,
  '<h1>Notfallkontakt</h1><p>Kontakt: {{emergency.name}} · {{emergency.phone}}</p><p>{{signature.client}}</p>',
  'Einwilligung Notfallkontakt.',
  '{"emergency.name":{"label":"Notfallkontakt","required":true},"emergency.phone":{"label":"Telefon","required":true}}'::jsonb,
  '[{"role":"client","placeholder":"{{signature.client}}","required":true}]'::jsonb
)
ON CONFLICT (template_key) DO NOTHING;
