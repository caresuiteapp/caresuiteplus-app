-- ==========================================================================
-- CareSuite+ — Migration 0054: GKV/Pflegekassenabrechnung (vorbereitet)
-- SGB XI/SGB V, DTA-Export, Kostenträgerdateien, Prüfprotokolle.
-- Keine produktive DTA-Abrechnung ohne Validator/Provider. NICHT pushen.
-- ==========================================================================

-- --------------------------------------------------------------------------
-- 1. gkv_billing_profiles — Mandanten-IK und GKV-Abrechnungseinstellungen
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.gkv_billing_profiles (
  id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  ik_number               TEXT,
  bank_account_holder     TEXT,
  bank_iban               TEXT,
  bank_bic                TEXT,
  statutory_sector        TEXT
    CHECK (statutory_sector IS NULL OR statutory_sector IN ('sgb_xi', 'sgb_v', 'mixed')),
  billing_mode            TEXT        NOT NULL DEFAULT 'leistungsnachweise_export'
    CHECK (billing_mode IN (
      'leistungsnachweise_export', 'dta_vorbereitung',
      'abrechnungszentrum_export', 'direktabrechnung_spaeter'
    )),
  verification_status     TEXT        NOT NULL DEFAULT 'unverified'
    CHECK (verification_status IN ('unverified', 'pending', 'verified', 'failed')),
  verified_at             TIMESTAMPTZ,
  dta_validator_configured BOOLEAN    NOT NULL DEFAULT FALSE,
  notes                   TEXT,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_gkv_billing_profiles_tenant
  ON public.gkv_billing_profiles (tenant_id);

-- --------------------------------------------------------------------------
-- 2. gkv_cost_carriers — Kostenträger-Stammdaten (Kostenträgerdatei/manuell)
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.gkv_cost_carriers (
  id                            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                     UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  cost_carrier_id               TEXT        NOT NULL,
  name                          TEXT        NOT NULL,
  type                          TEXT        NOT NULL DEFAULT 'sonstige'
    CHECK (type IN ('pflegekasse', 'krankenkasse', 'beihilfe', 'abrechnungszentrum', 'sonstige')),
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

CREATE INDEX IF NOT EXISTS idx_gkv_cost_carriers_tenant_name
  ON public.gkv_cost_carriers (tenant_id, name);

CREATE INDEX IF NOT EXISTS idx_gkv_cost_carriers_tenant_ik
  ON public.gkv_cost_carriers (tenant_id, ik_number)
  WHERE ik_number IS NOT NULL;

-- --------------------------------------------------------------------------
-- 3. gkv_export_batches — Export-Batches (DTA/Leistungsnachweise)
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.gkv_export_batches (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  batch_number      TEXT        NOT NULL,
  billing_mode      TEXT        NOT NULL,
  statutory_sector  TEXT
    CHECK (statutory_sector IS NULL OR statutory_sector IN ('sgb_xi', 'sgb_v', 'mixed')),
  status            TEXT        NOT NULL DEFAULT 'draft'
    CHECK (status IN (
      'draft', 'validation_pending', 'validation_failed', 'validation_passed',
      'export_ready', 'exported', 'submitted_prepared', 'rejected', 'corrected', 'archived'
    )),
  export_format     TEXT        NOT NULL DEFAULT 'leistungsnachweise_package',
  item_count        INTEGER     NOT NULL DEFAULT 0,
  dta_validated     BOOLEAN     NOT NULL DEFAULT FALSE,
  prepared_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  prepared_by       UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  exported_at       TIMESTAMPTZ,
  notes             TEXT        NOT NULL DEFAULT '',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, batch_number)
);

CREATE INDEX IF NOT EXISTS idx_gkv_export_batches_tenant_status
  ON public.gkv_export_batches (tenant_id, status, prepared_at DESC);

-- --------------------------------------------------------------------------
-- 4. gkv_export_items — Einzelpositionen je Export-Batch
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.gkv_export_items (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  batch_id            UUID        NOT NULL REFERENCES public.gkv_export_batches(id) ON DELETE CASCADE,
  client_id           UUID        REFERENCES public.clients(id) ON DELETE SET NULL,
  billable_item_id    UUID,
  invoice_id          UUID,
  item_type           TEXT        NOT NULL DEFAULT 'leistungsnachweis'
    CHECK (item_type IN (
      'leistungsnachweis', 'rechnung', 'dta_vorbereitung',
      'pruefprotokoll', 'kostentraeger_stamm', 'other'
    )),
  payload_reference   TEXT,
  status              TEXT        NOT NULL DEFAULT 'prepared'
    CHECK (status IN ('prepared', 'included', 'excluded', 'error')),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gkv_export_items_batch
  ON public.gkv_export_items (tenant_id, batch_id);

-- --------------------------------------------------------------------------
-- 5. gkv_validation_results — Prüfprotokoll je Validierungslauf
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.gkv_validation_results (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  validation_run_id UUID        NOT NULL,
  batch_id          UUID        REFERENCES public.gkv_export_batches(id) ON DELETE SET NULL,
  client_id         UUID        REFERENCES public.clients(id) ON DELETE SET NULL,
  check_key         TEXT        NOT NULL
    CHECK (check_key IN (
      'pflegegrad', 'abtretung_einwilligung', 'leistungsnachweis', 'unterschrift',
      'kostentraeger', 'ik', 'ik_verification', 'leistungszeitraum', 'budget',
      'stundensatz', 'rechnungsart', 'sgb_sector', 'dta_validator'
    )),
  status            TEXT        NOT NULL
    CHECK (status IN ('passed', 'failed', 'warning', 'skipped')),
  message           TEXT        NOT NULL,
  checked_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gkv_validation_results_tenant_run
  ON public.gkv_validation_results (tenant_id, validation_run_id);

-- --------------------------------------------------------------------------
-- 6. gkv_submission_records — Einreichungsprotokoll (nur Vorbereitung)
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.gkv_submission_records (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  batch_id        UUID        NOT NULL REFERENCES public.gkv_export_batches(id) ON DELETE CASCADE,
  status          TEXT        NOT NULL DEFAULT 'prepared'
    CHECK (status IN (
      'prepared', 'blocked_no_provider', 'blocked_no_validator', 'blocked_not_enabled'
    )),
  provider_key    TEXT,
  submitted_at    TIMESTAMPTZ,
  blocked_reason  TEXT,
  notes           TEXT        NOT NULL DEFAULT '',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gkv_submission_records_tenant
  ON public.gkv_submission_records (tenant_id, batch_id);

-- --------------------------------------------------------------------------
-- 7. gkv_rejection_cases — Rückläufer/Absetzungen/Rückforderungen
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.gkv_rejection_cases (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  export_batch_id UUID        REFERENCES public.gkv_export_batches(id) ON DELETE SET NULL,
  export_item_id  UUID        REFERENCES public.gkv_export_items(id) ON DELETE SET NULL,
  case_type       TEXT        NOT NULL
    CHECK (case_type IN ('ruecklaeufer', 'absetzung', 'chargeback')),
  status          TEXT        NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'in_review', 'resolved', 'closed')),
  reason_code     TEXT,
  reason_text     TEXT        NOT NULL,
  resolved_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gkv_rejection_cases_tenant
  ON public.gkv_rejection_cases (tenant_id, status);

-- --------------------------------------------------------------------------
-- 8. gkv_billing_audit_events — Audit-Trail
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.gkv_billing_audit_events (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  action      TEXT        NOT NULL,
  entity_type TEXT        NOT NULL,
  entity_id   UUID,
  summary     TEXT        NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gkv_billing_audit_tenant
  ON public.gkv_billing_audit_events (tenant_id, created_at DESC);

-- --------------------------------------------------------------------------
-- RLS (vorbereitet — Policies folgen bei Live-Aktivierung)
-- --------------------------------------------------------------------------
ALTER TABLE public.gkv_billing_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gkv_cost_carriers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gkv_export_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gkv_export_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gkv_validation_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gkv_submission_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gkv_rejection_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gkv_billing_audit_events ENABLE ROW LEVEL SECURITY;
