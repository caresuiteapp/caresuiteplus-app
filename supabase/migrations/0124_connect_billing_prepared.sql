-- ==========================================================================
-- CareSuite+ — Migration 0046: Connect Abrechnung (vorbereitet)
-- GKV, Pflegekassen, SGB XI/V, Kostenträger, IK-Profile, Abrechnungszentren.
-- Keine produktive DTA-Abrechnung. Keine Fake-IK-Daten. Mandantenspezifisch.
-- NICHT pushen — nur Schema-Vorbereitung.
-- ==========================================================================

-- --------------------------------------------------------------------------
-- 1. tenant_ik_profiles — Mandanten-IK und Abrechnungseinstellungen
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tenant_ik_profiles (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  ik_number           TEXT,
  bank_account_holder TEXT,
  bank_iban           TEXT,
  bank_bic            TEXT,
  approval_status     TEXT        NOT NULL DEFAULT 'pending'
    CHECK (approval_status IN ('pending', 'submitted', 'approved', 'rejected', 'expired')),
  service_areas       JSONB       NOT NULL DEFAULT '[]'::jsonb,
  billing_type        TEXT
    CHECK (billing_type IS NULL OR billing_type IN (
      'sgb_xi', 'sgb_v', 'gkv', 'selbstzahler', 'mixed', 'other'
    )),
  billing_mode        TEXT        NOT NULL DEFAULT 'leistungsnachweise_export'
    CHECK (billing_mode IN (
      'selbst_abrechnen',
      'ueber_abrechnungszentrum',
      'leistungsnachweise_export',
      'rechnung_dta_nachweise_vorbereiten',
      'direktabrechnung_spaeter'
    )),
  verification_status TEXT        NOT NULL DEFAULT 'unverified'
    CHECK (verification_status IN ('unverified', 'pending', 'verified', 'failed')),
  verified_at         TIMESTAMPTZ,
  notes               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_tenant_ik_profiles_tenant
  ON public.tenant_ik_profiles (tenant_id);

-- --------------------------------------------------------------------------
-- 2. cost_carriers — Kostenträger-Stammdaten (mandantenspezifisch importiert)
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.cost_carriers (
  id                            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                     UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  cost_carrier_id               TEXT        NOT NULL,
  name                          TEXT        NOT NULL,
  type                          TEXT        NOT NULL DEFAULT 'other'
    CHECK (type IN (
      'pflegekasse', 'krankenkasse', 'beihilfe', 'sonstige', 'abrechnungszentrum', 'other'
    )),
  ik_number                     TEXT,
  billing_address               JSONB,
  electronic_billing_supported  BOOLEAN     NOT NULL DEFAULT FALSE,
  dta_supported                 BOOLEAN     NOT NULL DEFAULT FALSE,
  contact_data                  JSONB,
  valid_from                    DATE,
  valid_to                      DATE,
  source                        TEXT        NOT NULL DEFAULT 'manual'
    CHECK (source IN ('manual', 'kostentraegerdatei', 'import', 'api')),
  last_checked_at               TIMESTAMPTZ,
  created_at                    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, cost_carrier_id)
);

CREATE INDEX IF NOT EXISTS idx_cost_carriers_tenant_name
  ON public.cost_carriers (tenant_id, name);

CREATE INDEX IF NOT EXISTS idx_cost_carriers_tenant_ik
  ON public.cost_carriers (tenant_id, ik_number)
  WHERE ik_number IS NOT NULL;

-- --------------------------------------------------------------------------
-- 3. billing_provider_configs — Abrechnungszentren (vorbereitet)
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.billing_provider_configs (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  provider_key    TEXT        NOT NULL
    CHECK (provider_key IN ('opta_data', 'dmrz', 'rzh', 'davaso', 'generic_export')),
  status          TEXT        NOT NULL DEFAULT 'vorbereitet'
    CHECK (status IN (
      'vorbereitet', 'nicht_konfiguriert', 'export_moeglich', 'api_spaeter', 'deaktiviert'
    )),
  environment     TEXT        NOT NULL DEFAULT 'preparation'
    CHECK (environment IN ('preparation', 'sandbox', 'production')),
  is_active       BOOLEAN     NOT NULL DEFAULT FALSE,
  export_format   TEXT,
  api_ready       BOOLEAN     NOT NULL DEFAULT FALSE,
  configured_at   TIMESTAMPTZ,
  configured_by   UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, provider_key)
);

CREATE INDEX IF NOT EXISTS idx_billing_provider_configs_tenant
  ON public.billing_provider_configs (tenant_id, status);

-- --------------------------------------------------------------------------
-- 4. billing_validation_results — Prüfprotokoll je Abrechnungsvorbereitung
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.billing_validation_results (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  validation_run_id UUID        NOT NULL,
  client_id         UUID,
  invoice_id        UUID,
  check_key         TEXT        NOT NULL
    CHECK (check_key IN (
      'pflegegrad', 'abtretung_einwilligung', 'leistungsnachweis', 'unterschrift',
      'kostentraeger', 'ik', 'leistungszeitraum', 'budget', 'stundensatz',
      'rechnungsnummer', 'leistungsart'
    )),
  status            TEXT        NOT NULL
    CHECK (status IN ('passed', 'failed', 'warning', 'skipped')),
  message           TEXT        NOT NULL DEFAULT '',
  checked_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by        UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_billing_validation_results_tenant_run
  ON public.billing_validation_results (tenant_id, validation_run_id, checked_at DESC);

CREATE INDEX IF NOT EXISTS idx_billing_validation_results_tenant_client
  ON public.billing_validation_results (tenant_id, client_id, checked_at DESC)
  WHERE client_id IS NOT NULL;

-- --------------------------------------------------------------------------
-- 5. billing_export_batches — Exportpakete (nicht als eingereicht markierbar ohne Provider)
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.billing_export_batches (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  batch_number    TEXT        NOT NULL,
  billing_mode    TEXT        NOT NULL
    CHECK (billing_mode IN (
      'selbst_abrechnen',
      'ueber_abrechnungszentrum',
      'leistungsnachweise_export',
      'rechnung_dta_nachweise_vorbereiten',
      'direktabrechnung_spaeter'
    )),
  provider_key    TEXT
    CHECK (provider_key IS NULL OR provider_key IN (
      'opta_data', 'dmrz', 'rzh', 'davaso', 'generic_export'
    )),
  status          TEXT        NOT NULL DEFAULT 'prepared'
    CHECK (status IN (
      'prepared', 'export_ready', 'exported', 'submission_blocked', 'not_submitted'
    )),
  export_format   TEXT        NOT NULL DEFAULT 'preparation_package',
  item_count      INTEGER     NOT NULL DEFAULT 0,
  prepared_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  prepared_by     UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  submitted_at    TIMESTAMPTZ,
  notes           TEXT        NOT NULL DEFAULT 'Vorbereitung — kein produktiver DTA-Versand.',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, batch_number),
  CONSTRAINT billing_export_batches_no_fake_submission
    CHECK (
      submitted_at IS NULL
      OR (provider_key IS NOT NULL AND status = 'exported')
    )
);

CREATE INDEX IF NOT EXISTS idx_billing_export_batches_tenant
  ON public.billing_export_batches (tenant_id, prepared_at DESC);

-- --------------------------------------------------------------------------
-- 6. billing_export_items — Positionen je Exportpaket
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.billing_export_items (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  batch_id          UUID        NOT NULL REFERENCES public.billing_export_batches(id) ON DELETE CASCADE,
  client_id         UUID,
  invoice_id        UUID,
  item_type         TEXT        NOT NULL DEFAULT 'leistungsnachweis'
    CHECK (item_type IN (
      'leistungsnachweis', 'rechnung', 'dta_vorbereitung', 'nachweis_anhang', 'other'
    )),
  payload_reference TEXT,
  status            TEXT        NOT NULL DEFAULT 'prepared'
    CHECK (status IN ('prepared', 'included', 'excluded', 'error')),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_billing_export_items_batch
  ON public.billing_export_items (tenant_id, batch_id);

-- --------------------------------------------------------------------------
-- 7. billing_clearing_events — Clearing-Vorbereitung (kein Live-Clearing)
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.billing_clearing_events (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  export_batch_id UUID        REFERENCES public.billing_export_batches(id) ON DELETE SET NULL,
  event_type      TEXT        NOT NULL
    CHECK (event_type IN (
      'export_prepared', 'validation_completed', 'package_created',
      'clearing_simulated', 'provider_handoff_prepared'
    )),
  event_status    TEXT        NOT NULL DEFAULT 'prepared'
    CHECK (event_status IN ('prepared', 'simulated', 'blocked', 'completed')),
  amount_cents    INTEGER,
  reference       TEXT,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_billing_clearing_events_tenant
  ON public.billing_clearing_events (tenant_id, created_at DESC);

-- --------------------------------------------------------------------------
-- 8. rejection_management_cases — Rückläufer/Absetzung (vorbereitet)
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.rejection_management_cases (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  export_batch_id UUID        REFERENCES public.billing_export_batches(id) ON DELETE SET NULL,
  export_item_id  UUID        REFERENCES public.billing_export_items(id) ON DELETE SET NULL,
  case_type       TEXT        NOT NULL
    CHECK (case_type IN ('ruecklaeufer', 'absetzung')),
  status          TEXT        NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'in_review', 'resolved', 'closed')),
  reason_code     TEXT,
  reason_text     TEXT        NOT NULL DEFAULT '',
  resolved_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rejection_management_cases_tenant
  ON public.rejection_management_cases (tenant_id, status, created_at DESC);

-- --------------------------------------------------------------------------
-- updated_at Trigger
-- --------------------------------------------------------------------------
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'tenant_ik_profiles',
    'cost_carriers',
    'billing_provider_configs',
    'billing_export_batches',
    'rejection_management_cases'
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
ALTER TABLE public.tenant_ik_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cost_carriers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_provider_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_validation_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_export_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_export_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_clearing_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rejection_management_cases ENABLE ROW LEVEL SECURITY;

-- --------------------------------------------------------------------------
-- RLS: Mandant + Tenant-Admin für Schreiben; Mandant lesen
-- --------------------------------------------------------------------------
DROP POLICY IF EXISTS tenant_ik_profiles_tenant_select ON public.tenant_ik_profiles;
CREATE POLICY tenant_ik_profiles_tenant_select ON public.tenant_ik_profiles
  FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS tenant_ik_profiles_tenant_write ON public.tenant_ik_profiles;
CREATE POLICY tenant_ik_profiles_tenant_write ON public.tenant_ik_profiles
  FOR ALL TO authenticated
  USING (tenant_id = public.current_tenant_id() AND public.is_connect_tenant_admin())
  WITH CHECK (tenant_id = public.current_tenant_id() AND public.is_connect_tenant_admin());

DROP POLICY IF EXISTS cost_carriers_tenant_select ON public.cost_carriers;
CREATE POLICY cost_carriers_tenant_select ON public.cost_carriers
  FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS cost_carriers_tenant_write ON public.cost_carriers;
CREATE POLICY cost_carriers_tenant_write ON public.cost_carriers
  FOR ALL TO authenticated
  USING (tenant_id = public.current_tenant_id() AND public.is_connect_tenant_admin())
  WITH CHECK (tenant_id = public.current_tenant_id() AND public.is_connect_tenant_admin());

DROP POLICY IF EXISTS billing_provider_configs_tenant_select ON public.billing_provider_configs;
CREATE POLICY billing_provider_configs_tenant_select ON public.billing_provider_configs
  FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS billing_provider_configs_tenant_write ON public.billing_provider_configs;
CREATE POLICY billing_provider_configs_tenant_write ON public.billing_provider_configs
  FOR ALL TO authenticated
  USING (tenant_id = public.current_tenant_id() AND public.is_connect_tenant_admin())
  WITH CHECK (tenant_id = public.current_tenant_id() AND public.is_connect_tenant_admin());

DROP POLICY IF EXISTS billing_validation_results_tenant_select ON public.billing_validation_results;
CREATE POLICY billing_validation_results_tenant_select ON public.billing_validation_results
  FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS billing_validation_results_tenant_insert ON public.billing_validation_results;
CREATE POLICY billing_validation_results_tenant_insert ON public.billing_validation_results
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.current_tenant_id() AND public.is_connect_tenant_admin());

DROP POLICY IF EXISTS billing_export_batches_tenant_select ON public.billing_export_batches;
CREATE POLICY billing_export_batches_tenant_select ON public.billing_export_batches
  FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS billing_export_batches_tenant_write ON public.billing_export_batches;
CREATE POLICY billing_export_batches_tenant_write ON public.billing_export_batches
  FOR ALL TO authenticated
  USING (tenant_id = public.current_tenant_id() AND public.is_connect_tenant_admin())
  WITH CHECK (tenant_id = public.current_tenant_id() AND public.is_connect_tenant_admin());

DROP POLICY IF EXISTS billing_export_items_tenant_select ON public.billing_export_items;
CREATE POLICY billing_export_items_tenant_select ON public.billing_export_items
  FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS billing_export_items_tenant_write ON public.billing_export_items;
CREATE POLICY billing_export_items_tenant_write ON public.billing_export_items
  FOR ALL TO authenticated
  USING (tenant_id = public.current_tenant_id() AND public.is_connect_tenant_admin())
  WITH CHECK (tenant_id = public.current_tenant_id() AND public.is_connect_tenant_admin());

DROP POLICY IF EXISTS billing_clearing_events_tenant_select ON public.billing_clearing_events;
CREATE POLICY billing_clearing_events_tenant_select ON public.billing_clearing_events
  FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS billing_clearing_events_tenant_insert ON public.billing_clearing_events;
CREATE POLICY billing_clearing_events_tenant_insert ON public.billing_clearing_events
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.current_tenant_id() AND public.is_connect_tenant_admin());

DROP POLICY IF EXISTS rejection_management_cases_tenant_select ON public.rejection_management_cases;
CREATE POLICY rejection_management_cases_tenant_select ON public.rejection_management_cases
  FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS rejection_management_cases_tenant_write ON public.rejection_management_cases;
CREATE POLICY rejection_management_cases_tenant_write ON public.rejection_management_cases
  FOR ALL TO authenticated
  USING (tenant_id = public.current_tenant_id() AND public.is_connect_tenant_admin())
  WITH CHECK (tenant_id = public.current_tenant_id() AND public.is_connect_tenant_admin());

-- --------------------------------------------------------------------------
-- GRANTs
-- --------------------------------------------------------------------------
GRANT SELECT ON public.tenant_ik_profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tenant_ik_profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cost_carriers TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.billing_provider_configs TO authenticated;
GRANT SELECT, INSERT ON public.billing_validation_results TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.billing_export_batches TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.billing_export_items TO authenticated;
GRANT SELECT, INSERT ON public.billing_clearing_events TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rejection_management_cases TO authenticated;

-- --------------------------------------------------------------------------
-- Kommentare
-- --------------------------------------------------------------------------
COMMENT ON TABLE public.tenant_ik_profiles IS
  'Connect Abrechnung — Mandanten-IK-Profil und Abrechnungsmodus (vorbereitet, nicht produktiv)';

COMMENT ON TABLE public.cost_carriers IS
  'Connect Abrechnung — Kostenträger-Stammdaten je Mandant; keine generierten Fake-IKs';

COMMENT ON TABLE public.billing_provider_configs IS
  'Connect Abrechnung — Abrechnungszentren vorbereitet; API später';

COMMENT ON TABLE public.billing_export_batches IS
  'Connect Abrechnung — Exportpakete; submitted_at nur mit konfiguriertem Provider';

COMMENT ON TABLE public.billing_validation_results IS
  'Connect Abrechnung — Prüfprotokoll je Validierungslauf (auditierbar)';

COMMENT ON TABLE public.rejection_management_cases IS
  'Connect Abrechnung — Rückläufer/Absetzung vorbereitet';
