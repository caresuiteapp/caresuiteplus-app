-- ==========================================================================
-- CareSuite+ — Migration 0050: Pflege/Betreuungs-Abrechnung (vorbereitet)
-- Budget, Leistungsarten, Stundensätze, billable_items, Rechnungsentwürfe.
-- Keine produktive Kassenabrechnung ohne DTA/Validierung. NICHT pushen.
-- ==========================================================================

-- --------------------------------------------------------------------------
-- 1. care_levels — Pflegegrade je Klient (Erweiterung client_care_levels)
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.care_levels (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  client_id           UUID        NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  grade               TEXT        NOT NULL
                      CHECK (grade IN ('pg1','pg2','pg3','pg4','pg5')),
  valid_from          DATE        NOT NULL,
  valid_until         DATE,
  care_fund_name      TEXT,
  care_fund_ik        TEXT,
  notes               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_care_levels_tenant_client
  ON public.care_levels (tenant_id, client_id, valid_from DESC);

-- --------------------------------------------------------------------------
-- 2. client_budgets — Budget-Stammdaten je Klient/Jahr
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.client_budgets_v2 (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  client_id           UUID        NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  budget_type         TEXT        NOT NULL
                      CHECK (budget_type IN (
                        'paragraph_45b', 'umwandlungsanspruch',
                        'jahres_sonderbudget', 'selbstzahler'
                      )),
  year                INTEGER     NOT NULL,
  total_amount_cents  INTEGER     NOT NULL DEFAULT 0,
  notes               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_client_budgets_v2_tenant
  ON public.client_budgets_v2 (tenant_id, client_id, year);

-- --------------------------------------------------------------------------
-- 3. client_budget_periods — Monats-/Jahresperioden mit Status
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.client_budget_periods (
  id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  client_id               UUID        NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  client_budget_id        UUID        REFERENCES public.client_budgets_v2(id) ON DELETE CASCADE,
  budget_type             TEXT        NOT NULL
                          CHECK (budget_type IN (
                            'paragraph_45b', 'umwandlungsanspruch',
                            'jahres_sonderbudget', 'selbstzahler'
                          )),
  year                    INTEGER     NOT NULL,
  month                   INTEGER     CHECK (month IS NULL OR (month >= 1 AND month <= 12)),
  total_amount_cents      INTEGER     NOT NULL DEFAULT 0,
  used_amount_cents       INTEGER     NOT NULL DEFAULT 0,
  reserved_amount_cents   INTEGER     NOT NULL DEFAULT 0,
  status                  TEXT        NOT NULL DEFAULT 'unbekannt'
                          CHECK (status IN (
                            'nicht_genutzt', 'beantragt', 'genehmigt', 'aktiv',
                            'ausgeschoepft', 'abgelehnt', 'unbekannt'
                          )),
  umwandlung_max_percent  NUMERIC(5,2),
  valid_from              DATE        NOT NULL,
  valid_until             DATE        NOT NULL,
  notes                   TEXT,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_client_budget_periods_tenant
  ON public.client_budget_periods (tenant_id, client_id, year, month);

-- --------------------------------------------------------------------------
-- 4. budget_transactions — Auditierbare Budgetbewegungen
-- --------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'budget_transactions'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'budget_transactions'
      AND column_name = 'budget_period_id'
  ) THEN
    ALTER TABLE public.budget_transactions RENAME TO budget_transactions_legacy_0010;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.budget_transactions (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  client_id           UUID        NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  budget_period_id    UUID        NOT NULL REFERENCES public.client_budget_periods(id) ON DELETE CASCADE,
  billable_item_id    UUID,
  invoice_draft_id    UUID,
  amount_cents        INTEGER     NOT NULL,
  transaction_type    TEXT        NOT NULL
                      CHECK (transaction_type IN ('reserve', 'consume', 'release', 'correction')),
  description         TEXT        NOT NULL DEFAULT '',
  booked_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_budget_transactions_period
  ON public.budget_transactions (tenant_id, budget_period_id, booked_at DESC);

-- --------------------------------------------------------------------------
-- 5. service_catalog_items — Leistungskatalog (Pflege/Betreuung)
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.care_service_catalog_items (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  service_area_key    TEXT        NOT NULL
                      CHECK (service_area_key IN (
                        'entlastungsleistungen', 'alltagsbegleitung', 'hauswirtschaft',
                        'betreuung', 'pflegeberatung', 'pflegeleistungen',
                        'selbstzahlerleistungen', 'fahrtkosten', 'zusatzleistungen'
                      )),
  code                TEXT        NOT NULL,
  label               TEXT        NOT NULL,
  is_billable         BOOLEAN     NOT NULL DEFAULT TRUE,
  is_prepared_only    BOOLEAN     NOT NULL DEFAULT FALSE,
  default_billing_unit TEXT       NOT NULL DEFAULT 'hour'
                      CHECK (default_billing_unit IN ('hour', 'visit', 'flat', 'minute')),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, code)
);

CREATE INDEX IF NOT EXISTS idx_care_service_catalog_tenant
  ON public.care_service_catalog_items (tenant_id, service_area_key);

-- --------------------------------------------------------------------------
-- 6. tenant_service_rates — Stundensätze je Mandant/Leistungsart
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tenant_service_rates (
  id                          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                   UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  service_area_key            TEXT        NOT NULL,
  hourly_rate_net_cents       INTEGER     NOT NULL DEFAULT 0,
  hourly_rate_gross_cents     INTEGER     NOT NULL DEFAULT 0,
  tax_rate_percent            NUMERIC(5,2) NOT NULL DEFAULT 0,
  tax_mode                    TEXT        NOT NULL DEFAULT 'ustg_4_16_exempt'
                              CHECK (tax_mode IN (
                                'ustg_4_16_exempt', 'standard_vat_19', 'kleinunternehmer_19'
                              )),
  valid_from                  DATE        NOT NULL,
  valid_to                    DATE,
  billing_unit                TEXT        NOT NULL DEFAULT 'hour'
                              CHECK (billing_unit IN ('hour', 'visit', 'flat', 'minute')),
  rounding_rule               TEXT        NOT NULL DEFAULT 'none'
                              CHECK (rounding_rule IN (
                                'none', 'up_to_quarter_hour', 'up_to_half_hour', 'commercial'
                              )),
  minimum_duration_minutes    INTEGER     NOT NULL DEFAULT 0,
  travel_cost_rule            TEXT        NOT NULL DEFAULT 'none'
                              CHECK (travel_cost_rule IN (
                                'none', 'per_km', 'flat_per_visit', 'prepared'
                              )),
  is_active                   BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tenant_service_rates_lookup
  ON public.tenant_service_rates (tenant_id, service_area_key, valid_from DESC);

-- --------------------------------------------------------------------------
-- 7. cost_carrier_profiles — Kostenträger je Klient
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.cost_carrier_profiles (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  client_id           UUID        NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  name                TEXT        NOT NULL,
  ik_number           TEXT,
  type                TEXT        NOT NULL DEFAULT 'pflegekasse'
                      CHECK (type IN ('pflegekasse', 'krankenkasse', 'beihilfe', 'sonstige')),
  is_primary          BOOLEAN     NOT NULL DEFAULT FALSE,
  valid_from          DATE,
  valid_to            DATE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cost_carrier_profiles_client
  ON public.cost_carrier_profiles (tenant_id, client_id);

-- --------------------------------------------------------------------------
-- 8. billing_recipient_profiles — Rechnungsempfänger je Klient
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.billing_recipient_profiles (
  id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  client_id               UUID        NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  recipient_type          TEXT        NOT NULL
                          CHECK (recipient_type IN (
                            'pflegekasse', 'legal_guardian', 'self_payer', 'relative', 'unclear'
                          )),
  full_name               TEXT        NOT NULL,
  street                  TEXT        NOT NULL DEFAULT '',
  zip                     TEXT        NOT NULL DEFAULT '',
  city                    TEXT        NOT NULL DEFAULT '',
  email                   TEXT,
  phone                   TEXT,
  is_primary              BOOLEAN     NOT NULL DEFAULT FALSE,
  cost_carrier_profile_id UUID        REFERENCES public.cost_carrier_profiles(id) ON DELETE SET NULL,
  notes                   TEXT,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_billing_recipient_profiles_client
  ON public.billing_recipient_profiles (tenant_id, client_id);

-- --------------------------------------------------------------------------
-- 9. billable_items — Abrechenbare Positionen aus Leistungsnachweisen
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.billable_items (
  id                          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                   UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  client_id                   UUID        NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  service_proof_id            TEXT        NOT NULL,
  service_record_id           UUID,
  service_area_key            TEXT        NOT NULL,
  service_period_from         DATE        NOT NULL,
  service_period_to           DATE        NOT NULL,
  duration_minutes            INTEGER     NOT NULL DEFAULT 0,
  billable_minutes            INTEGER     NOT NULL DEFAULT 0,
  hourly_rate_net_cents       INTEGER     NOT NULL DEFAULT 0,
  net_amount_cents            INTEGER     NOT NULL DEFAULT 0,
  tax_mode                    TEXT        NOT NULL DEFAULT 'ustg_4_16_exempt',
  tax_amount_cents            INTEGER     NOT NULL DEFAULT 0,
  gross_amount_cents          INTEGER     NOT NULL DEFAULT 0,
  budget_type                 TEXT,
  budget_period_id            UUID        REFERENCES public.client_budget_periods(id) ON DELETE SET NULL,
  self_payer_amount_cents     INTEGER     NOT NULL DEFAULT 0,
  cost_carrier_profile_id     UUID        REFERENCES public.cost_carrier_profiles(id) ON DELETE SET NULL,
  billing_recipient_profile_id UUID       REFERENCES public.billing_recipient_profiles(id) ON DELETE SET NULL,
  invoice_draft_id            UUID,
  invoice_id                  UUID,
  status                      TEXT        NOT NULL DEFAULT 'missing_data'
                              CHECK (status IN (
                                'not_billable', 'missing_data', 'ready',
                                'included_in_invoice_draft', 'invoiced',
                                'cancelled', 'corrected', 'rejected'
                              )),
  validation_run_id           UUID,
  description                 TEXT        NOT NULL DEFAULT '',
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT billable_items_require_proof
    CHECK (service_proof_id IS NOT NULL AND length(trim(service_proof_id)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_billable_items_tenant_client
  ON public.billable_items (tenant_id, client_id, status);

-- --------------------------------------------------------------------------
-- 10. billing_validation_results — Erweiterte Pflege-Abrechnungsprüfung
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.care_billing_validation_results (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  validation_run_id UUID        NOT NULL,
  client_id         UUID,
  billable_item_id  UUID,
  invoice_draft_id  UUID,
  check_key         TEXT        NOT NULL
                    CHECK (check_key IN (
                      'klient', 'pflegegrad', 'leistungsnachweis', 'leistungsart',
                      'leistungszeitraum', 'stundensatz', 'kostentraeger_selbstzahler',
                      'rechnungsempfaenger', 'budget', 'steuerlogik'
                    )),
  status            TEXT        NOT NULL
                    CHECK (status IN ('passed', 'failed', 'warning', 'skipped')),
  message           TEXT        NOT NULL DEFAULT '',
  checked_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_care_billing_validation_tenant
  ON public.care_billing_validation_results (tenant_id, validation_run_id);

-- --------------------------------------------------------------------------
-- 11. invoice_drafts — Rechnungsentwürfe (Pflege/Betreuung)
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.invoice_drafts (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  client_id           UUID        NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  draft_number        TEXT,
  status              TEXT        NOT NULL DEFAULT 'draft'
                      CHECK (status IN ('draft', 'validated', 'blocked', 'finalized', 'cancelled')),
  tax_mode            TEXT        NOT NULL DEFAULT 'ustg_4_16_exempt',
  service_period_from DATE        NOT NULL,
  service_period_to   DATE        NOT NULL,
  recipient_type      TEXT        NOT NULL,
  recipient_name      TEXT        NOT NULL,
  recipient_street    TEXT        NOT NULL DEFAULT '',
  recipient_zip       TEXT        NOT NULL DEFAULT '',
  recipient_city      TEXT        NOT NULL DEFAULT '',
  cost_carrier_name   TEXT,
  cost_carrier_ik     TEXT,
  net_total_cents     INTEGER     NOT NULL DEFAULT 0,
  tax_total_cents     INTEGER     NOT NULL DEFAULT 0,
  gross_total_cents   INTEGER     NOT NULL DEFAULT 0,
  tax_notice          TEXT        NOT NULL DEFAULT '',
  validation_run_id   UUID,
  finalized_invoice_id UUID,
  preview_confirmed   BOOLEAN     NOT NULL DEFAULT FALSE,
  notes               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invoice_drafts_tenant
  ON public.invoice_drafts (tenant_id, client_id, status);

-- --------------------------------------------------------------------------
-- 12. invoice_draft_items — Positionen je Rechnungsentwurf
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.invoice_draft_items (
  id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  invoice_draft_id        UUID        NOT NULL REFERENCES public.invoice_drafts(id) ON DELETE CASCADE,
  billable_item_id        UUID        NOT NULL REFERENCES public.billable_items(id) ON DELETE RESTRICT,
  description             TEXT        NOT NULL,
  quantity                NUMERIC(10,4) NOT NULL DEFAULT 1,
  unit                    TEXT        NOT NULL DEFAULT 'Std.',
  unit_price_net_cents    INTEGER     NOT NULL DEFAULT 0,
  net_total_cents         INTEGER     NOT NULL DEFAULT 0,
  tax_rate_percent        NUMERIC(5,2) NOT NULL DEFAULT 0,
  tax_total_cents         INTEGER     NOT NULL DEFAULT 0,
  gross_total_cents       INTEGER     NOT NULL DEFAULT 0,
  budget_type             TEXT,
  self_payer_amount_cents INTEGER     NOT NULL DEFAULT 0,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invoice_draft_items_draft
  ON public.invoice_draft_items (tenant_id, invoice_draft_id);

-- --------------------------------------------------------------------------
-- RLS aktivieren
-- --------------------------------------------------------------------------
ALTER TABLE public.care_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_budgets_v2 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_budget_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budget_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.care_service_catalog_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_service_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cost_carrier_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_recipient_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billable_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.care_billing_validation_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_draft_items ENABLE ROW LEVEL SECURITY;

-- --------------------------------------------------------------------------
-- RLS Policies (Mandantenisolation)
-- --------------------------------------------------------------------------
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'care_levels', 'client_budgets_v2', 'client_budget_periods', 'budget_transactions',
    'care_service_catalog_items', 'tenant_service_rates', 'cost_carrier_profiles',
    'billing_recipient_profiles', 'billable_items', 'care_billing_validation_results',
    'invoice_drafts', 'invoice_draft_items'
  ]
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I_tenant ON public.%I', t, t);
    EXECUTE format(
      'CREATE POLICY %I_tenant ON public.%I FOR ALL TO authenticated USING (tenant_id = public.current_tenant_id()) WITH CHECK (tenant_id = public.current_tenant_id())',
      t, t
    );
  END LOOP;
END $$;

-- --------------------------------------------------------------------------
-- Kommentare
-- --------------------------------------------------------------------------
COMMENT ON TABLE public.client_budget_periods IS
  'Pflege-Abrechnung — Budgetperioden mit §45b/Umwandlung/Jahresbudget (vorbereitet)';

COMMENT ON TABLE public.billable_items IS
  'Pflege-Abrechnung — Positionen aus Leistungsnachweisen; kein Eintrag ohne Nachweis';

COMMENT ON TABLE public.invoice_drafts IS
  'Pflege-Abrechnung — Rechnungsentwürfe; Finalisierung nur mit vollständigen Pflichtdaten';

COMMENT ON TABLE public.tenant_service_rates IS
  'Pflege-Abrechnung — Stundensätze je Mandant/Leistungsart inkl. Steuerlogik';
