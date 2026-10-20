-- ==========================================================================
-- CareSuite+ — Migration 0159: Client Core K.0–K.3
-- Service types (multi-select steering), budget, portal settings, intake mapping.
-- Additive only — CREATE IF NOT EXISTS, idempotent seeds, office.clients RLS.
-- ==========================================================================

-- --------------------------------------------------------------------------
-- tenant_client_service_types — Mandanten-Leistungsarten (Steuerdimension)
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tenant_client_service_types (
  id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID          NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  service_type_key    TEXT          NOT NULL,
  care_context_key    TEXT          NOT NULL,
  name                TEXT          NOT NULL,
  description         TEXT,
  module_keys         TEXT[]        NOT NULL DEFAULT '{}'::text[],
  color_key           TEXT,
  icon_key            TEXT,
  is_active           BOOLEAN       NOT NULL DEFAULT TRUE,
  is_system_template  BOOLEAN       NOT NULL DEFAULT FALSE,
  sort_order          INT           NOT NULL DEFAULT 0,
  metadata            JSONB         NOT NULL DEFAULT '{}'::jsonb,
  created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  CONSTRAINT tenant_client_service_types_key_nonempty
    CHECK (char_length(trim(service_type_key)) > 0),
  CONSTRAINT tenant_client_service_types_care_context_check
    CHECK (care_context_key IN (
      'daily_assistance', 'support_care', 'companionship',
      'ambulatory_care', 'stationary_care', 'consulting', 'academy_prepared'
    )),
  UNIQUE (tenant_id, service_type_key)
);

CREATE INDEX IF NOT EXISTS idx_tenant_client_service_types_tenant
  ON public.tenant_client_service_types (tenant_id, sort_order, is_active);

COMMENT ON TABLE public.tenant_client_service_types IS
  'Mandanten-Leistungsarten für Klient:innen Core — Steuerdimension K.0 (Migration 0159)';

-- --------------------------------------------------------------------------
-- client_service_profiles — Klient:innen-Leistungsprofile (Multi-Select)
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.client_service_profiles (
  id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID          NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  client_id           UUID          NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  service_type_id     UUID          NOT NULL REFERENCES public.tenant_client_service_types(id) ON DELETE RESTRICT,
  is_primary          BOOLEAN       NOT NULL DEFAULT FALSE,
  status              TEXT          NOT NULL DEFAULT 'active',
  started_on          DATE,
  ended_on            DATE,
  notes               TEXT,
  metadata            JSONB         NOT NULL DEFAULT '{}'::jsonb,
  created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  CONSTRAINT client_service_profiles_status_check
    CHECK (status IN ('active', 'paused', 'ended')),
  UNIQUE (tenant_id, client_id, service_type_id)
);

CREATE INDEX IF NOT EXISTS idx_client_service_profiles_client
  ON public.client_service_profiles (tenant_id, client_id, status);

-- --------------------------------------------------------------------------
-- tenant_service_type_rules — Regeln pro Leistungsart
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tenant_service_type_rules (
  id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID          NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  service_type_id     UUID          NOT NULL REFERENCES public.tenant_client_service_types(id) ON DELETE CASCADE,
  rule_key            TEXT          NOT NULL,
  rule_value          JSONB         NOT NULL DEFAULT '{}'::jsonb,
  is_active           BOOLEAN       NOT NULL DEFAULT TRUE,
  sort_order          INT           NOT NULL DEFAULT 0,
  created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, service_type_id, rule_key)
);

CREATE INDEX IF NOT EXISTS idx_tenant_service_type_rules_type
  ON public.tenant_service_type_rules (tenant_id, service_type_id);

-- --------------------------------------------------------------------------
-- tenant_service_task_catalog — Aufgaben/Leistungen pro Leistungsart
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tenant_service_task_catalog (
  id                      UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               UUID          NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  service_type_id         UUID          NOT NULL REFERENCES public.tenant_client_service_types(id) ON DELETE CASCADE,
  task_key                TEXT          NOT NULL,
  label                   TEXT          NOT NULL,
  description             TEXT,
  category                TEXT,
  default_duration_minutes INT,
  is_billable             BOOLEAN       NOT NULL DEFAULT TRUE,
  is_active               BOOLEAN       NOT NULL DEFAULT TRUE,
  sort_order              INT           NOT NULL DEFAULT 0,
  metadata                JSONB         NOT NULL DEFAULT '{}'::jsonb,
  created_at              TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, service_type_id, task_key)
);

CREATE INDEX IF NOT EXISTS idx_tenant_service_task_catalog_type
  ON public.tenant_service_task_catalog (tenant_id, service_type_id, sort_order);

-- --------------------------------------------------------------------------
-- tenant_service_visit_types — Besuchs-/Einsatztypen pro Leistungsart
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tenant_service_visit_types (
  id                      UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               UUID          NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  service_type_id         UUID          NOT NULL REFERENCES public.tenant_client_service_types(id) ON DELETE CASCADE,
  visit_type_key          TEXT          NOT NULL,
  label                   TEXT          NOT NULL,
  description             TEXT,
  default_duration_minutes INT,
  requires_signature      BOOLEAN       NOT NULL DEFAULT TRUE,
  requires_proof          BOOLEAN       NOT NULL DEFAULT TRUE,
  is_active               BOOLEAN       NOT NULL DEFAULT TRUE,
  sort_order              INT           NOT NULL DEFAULT 0,
  metadata                JSONB         NOT NULL DEFAULT '{}'::jsonb,
  created_at              TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, service_type_id, visit_type_key)
);

CREATE INDEX IF NOT EXISTS idx_tenant_service_visit_types_type
  ON public.tenant_service_visit_types (tenant_id, service_type_id, sort_order);

-- --------------------------------------------------------------------------
-- tenant_service_proof_templates — Nachweisvorlagen pro Leistungsart
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tenant_service_proof_templates (
  id                      UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               UUID          NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  service_type_id         UUID          NOT NULL REFERENCES public.tenant_client_service_types(id) ON DELETE CASCADE,
  template_key            TEXT          NOT NULL,
  label                   TEXT          NOT NULL,
  document_template_key   TEXT,
  is_default              BOOLEAN       NOT NULL DEFAULT FALSE,
  is_active               BOOLEAN       NOT NULL DEFAULT TRUE,
  metadata                JSONB         NOT NULL DEFAULT '{}'::jsonb,
  created_at              TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, service_type_id, template_key)
);

CREATE INDEX IF NOT EXISTS idx_tenant_service_proof_templates_type
  ON public.tenant_service_proof_templates (tenant_id, service_type_id);

-- --------------------------------------------------------------------------
-- tenant_service_intake_sections — Aufnahme-Abschnitte pro Leistungsart
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tenant_service_intake_sections (
  id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID          NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  service_type_id     UUID          NOT NULL REFERENCES public.tenant_client_service_types(id) ON DELETE CASCADE,
  section_key         TEXT          NOT NULL,
  is_required         BOOLEAN       NOT NULL DEFAULT FALSE,
  is_visible          BOOLEAN       NOT NULL DEFAULT TRUE,
  sort_order          INT           NOT NULL DEFAULT 0,
  created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, service_type_id, section_key)
);

CREATE INDEX IF NOT EXISTS idx_tenant_service_intake_sections_type
  ON public.tenant_service_intake_sections (tenant_id, service_type_id, sort_order);

-- --------------------------------------------------------------------------
-- tenant_budget_years — Budgetjahre (Mandant)
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tenant_budget_years (
  id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID          NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  budget_year         INT           NOT NULL,
  label               TEXT,
  is_active           BOOLEAN       NOT NULL DEFAULT TRUE,
  created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, budget_year)
);

CREATE INDEX IF NOT EXISTS idx_tenant_budget_years_tenant
  ON public.tenant_budget_years (tenant_id, budget_year DESC);

-- --------------------------------------------------------------------------
-- tenant_budget_types — Budgetarten (Entlastung, Verhinderung, …)
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tenant_budget_types (
  id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID          NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  budget_type_key     TEXT          NOT NULL,
  name                TEXT          NOT NULL,
  description         TEXT,
  period              TEXT          NOT NULL DEFAULT 'yearly',
  currency            TEXT          NOT NULL DEFAULT 'EUR',
  is_active           BOOLEAN       NOT NULL DEFAULT TRUE,
  sort_order          INT           NOT NULL DEFAULT 0,
  created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  CONSTRAINT tenant_budget_types_period_check
    CHECK (period IN ('monthly', 'yearly', 'quarterly')),
  UNIQUE (tenant_id, budget_type_key)
);

CREATE INDEX IF NOT EXISTS idx_tenant_budget_types_tenant
  ON public.tenant_budget_types (tenant_id, sort_order);

-- --------------------------------------------------------------------------
-- tenant_service_type_budget_rules — Leistungsart ↔ Budgetart
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tenant_service_type_budget_rules (
  id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID          NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  service_type_id     UUID          NOT NULL REFERENCES public.tenant_client_service_types(id) ON DELETE CASCADE,
  budget_type_id      UUID          NOT NULL REFERENCES public.tenant_budget_types(id) ON DELETE CASCADE,
  allocation_pct      NUMERIC(5, 2),
  is_default          BOOLEAN       NOT NULL DEFAULT FALSE,
  metadata            JSONB         NOT NULL DEFAULT '{}'::jsonb,
  created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, service_type_id, budget_type_id)
);

CREATE INDEX IF NOT EXISTS idx_tenant_service_type_budget_rules_type
  ON public.tenant_service_type_budget_rules (tenant_id, service_type_id);

-- --------------------------------------------------------------------------
-- tenant_budget_defaults — Mandanten-Budget-Vorgaben (editierbar, kein TS-Hardcode)
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tenant_budget_defaults (
  id                      UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               UUID          NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  budget_year_id          UUID          NOT NULL REFERENCES public.tenant_budget_years(id) ON DELETE CASCADE,
  budget_type_id          UUID          NOT NULL REFERENCES public.tenant_budget_types(id) ON DELETE CASCADE,
  amount_cents            BIGINT        NOT NULL DEFAULT 0,
  conversion_rate_pct     NUMERIC(5, 2),
  monthly_amount_cents      BIGINT,
  yearly_amount_cents     BIGINT,
  notes                   TEXT,
  metadata                JSONB         NOT NULL DEFAULT '{}'::jsonb,
  created_at              TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, budget_year_id, budget_type_id)
);

CREATE INDEX IF NOT EXISTS idx_tenant_budget_defaults_tenant
  ON public.tenant_budget_defaults (tenant_id, budget_year_id);

-- --------------------------------------------------------------------------
-- client_budget_settings — Klient:innen-Budget je Jahr/Art
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.client_budget_settings (
  id                      UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               UUID          NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  client_id               UUID          NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  budget_year_id          UUID          NOT NULL REFERENCES public.tenant_budget_years(id) ON DELETE CASCADE,
  budget_type_id          UUID          NOT NULL REFERENCES public.tenant_budget_types(id) ON DELETE CASCADE,
  allocated_cents         BIGINT        NOT NULL DEFAULT 0,
  used_cents              BIGINT        NOT NULL DEFAULT 0,
  reserved_cents          BIGINT        NOT NULL DEFAULT 0,
  conversion_rate_pct     NUMERIC(5, 2),
  monthly_limit_cents     BIGINT,
  yearly_limit_cents      BIGINT,
  notes                   TEXT,
  metadata                JSONB         NOT NULL DEFAULT '{}'::jsonb,
  created_at              TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, client_id, budget_year_id, budget_type_id)
);

CREATE INDEX IF NOT EXISTS idx_client_budget_settings_client
  ON public.client_budget_settings (tenant_id, client_id, budget_year_id);

-- --------------------------------------------------------------------------
-- client_budget_movements — Budget-Bewegungen (Ledger)
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.client_budget_movements (
  id                      UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               UUID          NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  client_id               UUID          NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  budget_setting_id       UUID          NOT NULL REFERENCES public.client_budget_settings(id) ON DELETE CASCADE,
  movement_type           TEXT          NOT NULL,
  amount_cents            BIGINT        NOT NULL,
  reference_type          TEXT,
  reference_id            UUID,
  note                    TEXT,
  created_by              UUID          REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at              TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  CONSTRAINT client_budget_movements_type_check
    CHECK (movement_type IN ('allocation', 'usage', 'reservation', 'release', 'adjustment'))
);

CREATE INDEX IF NOT EXISTS idx_client_budget_movements_setting
  ON public.client_budget_movements (tenant_id, budget_setting_id, created_at DESC);

-- --------------------------------------------------------------------------
-- tenant_client_portal_defaults — Mandanten-Portal-Defaults (nicht alles sichtbar)
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tenant_client_portal_defaults (
  id                      UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               UUID          NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE UNIQUE,
  portal_enabled          BOOLEAN       NOT NULL DEFAULT FALSE,
  show_appointments       BOOLEAN       NOT NULL DEFAULT FALSE,
  show_messages           BOOLEAN       NOT NULL DEFAULT TRUE,
  show_documents          BOOLEAN       NOT NULL DEFAULT FALSE,
  show_proofs             BOOLEAN       NOT NULL DEFAULT FALSE,
  show_budget             BOOLEAN       NOT NULL DEFAULT FALSE,
  show_visit_tracking     BOOLEAN       NOT NULL DEFAULT FALSE,
  allow_access_requests   BOOLEAN       NOT NULL DEFAULT TRUE,
  metadata                JSONB         NOT NULL DEFAULT '{}'::jsonb,
  created_at              TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

COMMENT ON COLUMN public.tenant_client_portal_defaults.show_visit_tracking IS
  'Kein GPS-Tracking im Klientenportal — bleibt FALSE (Migration 0159)';

-- --------------------------------------------------------------------------
-- tenant_service_type_portal_rules — Portal-Features pro Leistungsart
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tenant_service_type_portal_rules (
  id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID          NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  service_type_id     UUID          NOT NULL REFERENCES public.tenant_client_service_types(id) ON DELETE CASCADE,
  feature_key         TEXT          NOT NULL,
  is_visible          BOOLEAN       NOT NULL DEFAULT FALSE,
  sort_order          INT           NOT NULL DEFAULT 0,
  metadata            JSONB         NOT NULL DEFAULT '{}'::jsonb,
  created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, service_type_id, feature_key)
);

CREATE INDEX IF NOT EXISTS idx_tenant_service_type_portal_rules_type
  ON public.tenant_service_type_portal_rules (tenant_id, service_type_id);

-- --------------------------------------------------------------------------
-- client_portal_settings — Klient:innen-Portal-Override
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.client_portal_settings (
  id                      UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               UUID          NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  client_id               UUID          NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  portal_enabled          BOOLEAN,
  inherit_tenant_defaults BOOLEAN       NOT NULL DEFAULT TRUE,
  show_appointments       BOOLEAN,
  show_messages           BOOLEAN,
  show_documents          BOOLEAN,
  show_proofs             BOOLEAN,
  show_budget             BOOLEAN,
  show_visit_tracking     BOOLEAN       NOT NULL DEFAULT FALSE,
  metadata                JSONB         NOT NULL DEFAULT '{}'::jsonb,
  created_at              TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, client_id)
);

CREATE INDEX IF NOT EXISTS idx_client_portal_settings_client
  ON public.client_portal_settings (tenant_id, client_id);

-- --------------------------------------------------------------------------
-- client_service_portal_settings — Portal je Leistungsart/Klient:in
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.client_service_portal_settings (
  id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID          NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  client_id           UUID          NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  service_type_id     UUID          NOT NULL REFERENCES public.tenant_client_service_types(id) ON DELETE CASCADE,
  feature_key         TEXT          NOT NULL,
  is_visible          BOOLEAN       NOT NULL DEFAULT FALSE,
  created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, client_id, service_type_id, feature_key)
);

CREATE INDEX IF NOT EXISTS idx_client_service_portal_settings_client
  ON public.client_service_portal_settings (tenant_id, client_id);

-- --------------------------------------------------------------------------
-- client_portal_access_requests — Portal-Zugangsanfragen
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.client_portal_access_requests (
  id                      UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               UUID          NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  client_id               UUID          NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  requested_by_contact_id UUID,
  requester_name          TEXT          NOT NULL,
  requester_email         TEXT,
  requester_phone         TEXT,
  request_type            TEXT          NOT NULL DEFAULT 'portal_access',
  status                  TEXT          NOT NULL DEFAULT 'pending',
  requested_features      JSONB         NOT NULL DEFAULT '[]'::jsonb,
  review_note             TEXT,
  reviewed_by             UUID          REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at             TIMESTAMPTZ,
  created_at              TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  CONSTRAINT client_portal_access_requests_status_check
    CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled'))
);

CREATE INDEX IF NOT EXISTS idx_client_portal_access_requests_client
  ON public.client_portal_access_requests (tenant_id, client_id, status);

-- --------------------------------------------------------------------------
-- updated_at triggers
-- --------------------------------------------------------------------------
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'tenant_client_service_types',
    'client_service_profiles',
    'tenant_service_type_rules',
    'tenant_service_task_catalog',
    'tenant_service_visit_types',
    'tenant_service_proof_templates',
    'tenant_service_intake_sections',
    'tenant_budget_years',
    'tenant_budget_types',
    'tenant_service_type_budget_rules',
    'tenant_budget_defaults',
    'client_budget_settings',
    'tenant_client_portal_defaults',
    'tenant_service_type_portal_rules',
    'client_portal_settings',
    'client_service_portal_settings',
    'client_portal_access_requests'
  ]
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS set_%I_updated_at ON public.%I', tbl, tbl);
    EXECUTE format(
      'CREATE TRIGGER set_%I_updated_at BEFORE UPDATE ON public.%I
       FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()', tbl, tbl
    );
  END LOOP;
END $$;

-- --------------------------------------------------------------------------
-- RLS — office.clients pattern (current_tenant_id + has_permission)
-- --------------------------------------------------------------------------
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'tenant_client_service_types',
    'client_service_profiles',
    'tenant_service_type_rules',
    'tenant_service_task_catalog',
    'tenant_service_visit_types',
    'tenant_service_proof_templates',
    'tenant_service_intake_sections',
    'tenant_budget_years',
    'tenant_budget_types',
    'tenant_service_type_budget_rules',
    'tenant_budget_defaults',
    'client_budget_settings',
    'client_budget_movements',
    'tenant_client_portal_defaults',
    'tenant_service_type_portal_rules',
    'client_portal_settings',
    'client_service_portal_settings',
    'client_portal_access_requests'
  ]
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);

    EXECUTE format('DROP POLICY IF EXISTS "%s_select_tenant" ON public.%I', tbl, tbl);
    EXECUTE format(
      'CREATE POLICY "%s_select_tenant" ON public.%I FOR SELECT TO authenticated USING (
        tenant_id = public.current_tenant_id()
        AND public.has_permission(''office.clients.view'')
      )', tbl, tbl
    );

    EXECUTE format('DROP POLICY IF EXISTS "%s_write_tenant" ON public.%I', tbl, tbl);
    EXECUTE format(
      'CREATE POLICY "%s_write_tenant" ON public.%I FOR ALL TO authenticated USING (
        tenant_id = public.current_tenant_id()
        AND public.has_permission(''office.clients.edit'')
      ) WITH CHECK (
        tenant_id = public.current_tenant_id()
        AND public.has_permission(''office.clients.edit'')
      )', tbl, tbl
    );
  END LOOP;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON
  public.tenant_client_service_types,
  public.client_service_profiles,
  public.tenant_service_type_rules,
  public.tenant_service_task_catalog,
  public.tenant_service_visit_types,
  public.tenant_service_proof_templates,
  public.tenant_service_intake_sections,
  public.tenant_budget_years,
  public.tenant_budget_types,
  public.tenant_service_type_budget_rules,
  public.tenant_budget_defaults,
  public.client_budget_settings,
  public.client_budget_movements,
  public.tenant_client_portal_defaults,
  public.tenant_service_type_portal_rules,
  public.client_portal_settings,
  public.client_service_portal_settings,
  public.client_portal_access_requests
TO authenticated;

-- --------------------------------------------------------------------------
-- Seed function — 6 Leistungsarten + 2026 Budget-Vorlagen (idempotent)
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.seed_tenant_client_core_templates(p_tenant_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_type_id UUID;
  v_year_id UUID;
  v_budget_type_id UUID;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.tenant_client_service_types WHERE tenant_id = p_tenant_id
  ) THEN
    INSERT INTO public.tenant_client_service_types (
      tenant_id, service_type_key, care_context_key, name, description,
      module_keys, is_system_template, sort_order
    ) VALUES
      (p_tenant_id, 'alltagsbegleitung', 'daily_assistance',
       'Alltagsbegleitung', 'Individuelle Alltagsbegleitung im häuslichen Umfeld',
       ARRAY['assist', 'office'], TRUE, 10),
      (p_tenant_id, 'betreuung', 'support_care',
       'Betreuung', 'Betreuungsleistungen und Entlastung',
       ARRAY['assist', 'office'], TRUE, 20),
      (p_tenant_id, 'begleitung', 'companionship',
       'Begleitung', 'Begleitung zu Terminen und Aktivitäten',
       ARRAY['assist', 'office'], TRUE, 30),
      (p_tenant_id, 'ambulante_pflege', 'ambulatory_care',
       'Ambulante Pflege', 'Pflegefachliche Leistungen im häuslichen Umfeld',
       ARRAY['pflege', 'assist', 'office'], TRUE, 40),
      (p_tenant_id, 'stationaere_pflege', 'stationary_care',
       'Stationäre Pflege', 'Pflege in stationärer Einrichtung',
       ARRAY['stationaer', 'pflege', 'office'], TRUE, 50),
      (p_tenant_id, 'beratung', 'consulting',
       'Beratung', 'Pflegeberatung und Fallsteuerung',
       ARRAY['beratung', 'office'], TRUE, 60)
    ON CONFLICT (tenant_id, service_type_key) DO NOTHING;
  END IF;

  -- Intake sections per service type (only when missing for that type)
  FOR v_type_id IN
    SELECT id FROM public.tenant_client_service_types WHERE tenant_id = p_tenant_id
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM public.tenant_service_intake_sections
      WHERE tenant_id = p_tenant_id AND service_type_id = v_type_id
    ) THEN
      INSERT INTO public.tenant_service_intake_sections (
        tenant_id, service_type_id, section_key, is_required, is_visible, sort_order
      ) VALUES
        (p_tenant_id, v_type_id, 'leistungsart', TRUE, TRUE, 10),
        (p_tenant_id, v_type_id, 'stammdaten', TRUE, TRUE, 20),
        (p_tenant_id, v_type_id, 'adresse_kontakt', TRUE, TRUE, 30),
        (p_tenant_id, v_type_id, 'kostentraeger', FALSE, TRUE, 40),
        (p_tenant_id, v_type_id, 'angehoerige', FALSE, TRUE, 50),
        (p_tenant_id, v_type_id, 'notfall_zugang', FALSE, TRUE, 60),
        (p_tenant_id, v_type_id, 'vertraege_einwilligungen', TRUE, TRUE, 70),
        (p_tenant_id, v_type_id, 'dokumente', FALSE, TRUE, 80),
        (p_tenant_id, v_type_id, 'module', FALSE, TRUE, 90),
        (p_tenant_id, v_type_id, 'pruefung', TRUE, TRUE, 100)
      ON CONFLICT (tenant_id, service_type_id, section_key) DO NOTHING;
    END IF;
  END LOOP;

  -- Portal defaults (conservative — not all visible)
  INSERT INTO public.tenant_client_portal_defaults (
    tenant_id, portal_enabled, show_appointments, show_messages,
    show_documents, show_proofs, show_budget, show_visit_tracking, allow_access_requests
  ) VALUES (
    p_tenant_id, FALSE, FALSE, TRUE, FALSE, FALSE, FALSE, FALSE, TRUE
  )
  ON CONFLICT (tenant_id) DO NOTHING;

  -- Budget year 2026
  INSERT INTO public.tenant_budget_years (tenant_id, budget_year, label, is_active)
  VALUES (p_tenant_id, 2026, 'Budgetjahr 2026', TRUE)
  ON CONFLICT (tenant_id, budget_year) DO NOTHING;

  SELECT id INTO v_year_id
  FROM public.tenant_budget_years
  WHERE tenant_id = p_tenant_id AND budget_year = 2026;

  IF NOT EXISTS (
    SELECT 1 FROM public.tenant_budget_types WHERE tenant_id = p_tenant_id
  ) THEN
    INSERT INTO public.tenant_budget_types (
      tenant_id, budget_type_key, name, description, period, sort_order
    ) VALUES
      (p_tenant_id, 'entlastung_45b', 'Entlastungsbudget § 45b SGB XI',
       'Monatliches Entlastungsbudget nach § 45b SGB XI', 'monthly', 10),
      (p_tenant_id, 'verhinderungspflege_39', 'Verhinderungspflege § 39 SGB XI',
       'Jährliches Verhinderungspflege-Budget', 'yearly', 20)
    ON CONFLICT (tenant_id, budget_type_key) DO NOTHING;
  END IF;

  SELECT id INTO v_budget_type_id
  FROM public.tenant_budget_types
  WHERE tenant_id = p_tenant_id AND budget_type_key = 'entlastung_45b';

  IF v_year_id IS NOT NULL AND v_budget_type_id IS NOT NULL THEN
    INSERT INTO public.tenant_budget_defaults (
      tenant_id, budget_year_id, budget_type_id,
      amount_cents, conversion_rate_pct, monthly_amount_cents, yearly_amount_cents,
      notes
    ) VALUES (
      p_tenant_id, v_year_id, v_budget_type_id,
      353900, 40.00, 13100, 353900,
      'Vorlage 2026: 131 EUR monatlich, 40% Umrechnung, 3539 EUR jährlich — editierbar'
    )
    ON CONFLICT (tenant_id, budget_year_id, budget_type_id) DO NOTHING;
  END IF;

  -- Link support service types to entlastung budget
  FOR v_type_id IN
    SELECT id FROM public.tenant_client_service_types
    WHERE tenant_id = p_tenant_id
      AND service_type_key IN ('alltagsbegleitung', 'betreuung', 'begleitung')
  LOOP
    IF v_budget_type_id IS NOT NULL THEN
      INSERT INTO public.tenant_service_type_budget_rules (
        tenant_id, service_type_id, budget_type_id, is_default
      ) VALUES (p_tenant_id, v_type_id, v_budget_type_id, TRUE)
      ON CONFLICT (tenant_id, service_type_id, budget_type_id) DO NOTHING;
    END IF;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.seed_tenant_client_core_templates(UUID) TO authenticated;

-- Seed existing tenants (idempotent — does not overwrite tenant edits)
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT id FROM public.tenants LOOP
    PERFORM public.seed_tenant_client_core_templates(r.id);
  END LOOP;
END;
$$;

COMMENT ON FUNCTION public.seed_tenant_client_core_templates IS
  'Idempotente Klient:innen-Core-Vorlagen — 6 Leistungsarten + 2026 Budget (Migration 0159)';
