-- ==========================================================================
-- CareSuite+ — Migration 0054: Monatsabschluss, Rechnungslauf, Mahnwesen (vorbereitet)
-- billing_runs, receivables, dunning_runs, payment_allocations, billing_audit_events.
-- Ergänzt invoice_drafts aus 0050. Keine produktive Kassenabrechnung ohne Validierung.
-- NICHT pushen.
-- ==========================================================================

-- --------------------------------------------------------------------------
-- 1. billing_runs — Monatsabschluss / Rechnungslauf
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.billing_runs (
  id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  billing_month           TEXT        NOT NULL,
  title                   TEXT        NOT NULL DEFAULT '',
  status                  TEXT        NOT NULL DEFAULT 'draft'
                          CHECK (status IN ('draft', 'prepared', 'checked', 'completed', 'cancelled')),
  prepared_at             TIMESTAMPTZ,
  prepared_by             UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  checked_at              TIMESTAMPTZ,
  checked_by              UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  completed_at            TIMESTAMPTZ,
  completed_by            UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  service_records_count   INTEGER     NOT NULL DEFAULT 0,
  invoices_count          INTEGER     NOT NULL DEFAULT 0,
  total_amount_cents      INTEGER     NOT NULL DEFAULT 0,
  notes                   TEXT,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, billing_month)
);

CREATE INDEX IF NOT EXISTS idx_billing_runs_tenant_month
  ON public.billing_runs (tenant_id, billing_month DESC);

-- --------------------------------------------------------------------------
-- 2. billing_run_items — Positionen je Rechnungslauf
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.billing_run_items (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  billing_run_id      UUID        NOT NULL REFERENCES public.billing_runs(id) ON DELETE CASCADE,
  billable_item_id    UUID        NOT NULL REFERENCES public.billable_items(id) ON DELETE RESTRICT,
  client_id           UUID        NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  status              TEXT        NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending', 'draft_created', 'blocked', 'skipped', 'invoiced')),
  invoice_draft_id    UUID        REFERENCES public.invoice_drafts(id) ON DELETE SET NULL,
  invoice_id          UUID,
  blocked_reason      TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (billing_run_id, billable_item_id)
);

CREATE INDEX IF NOT EXISTS idx_billing_run_items_run
  ON public.billing_run_items (tenant_id, billing_run_id);

-- --------------------------------------------------------------------------
-- 3. care_billing_invoices — Finalisierte Rechnungen (Pflege-Abrechnung)
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.care_billing_invoices (
  id                          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                   UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  client_id                   UUID        NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  invoice_draft_id            UUID        NOT NULL REFERENCES public.invoice_drafts(id) ON DELETE RESTRICT,
  billing_run_id              UUID        REFERENCES public.billing_runs(id) ON DELETE SET NULL,
  invoice_number              TEXT,
  status                      TEXT        NOT NULL DEFAULT 'draft'
                              CHECK (status IN ('draft', 'validated', 'finalized', 'sent_prepared', 'cancelled')),
  tax_mode                    TEXT        NOT NULL DEFAULT 'ustg_4_16_exempt',
  service_period_from         DATE        NOT NULL,
  service_period_to           DATE        NOT NULL,
  recipient_type              TEXT        NOT NULL,
  recipient_name              TEXT        NOT NULL,
  cost_carrier_name           TEXT,
  cost_carrier_ik             TEXT,
  net_total_cents             INTEGER     NOT NULL DEFAULT 0,
  tax_total_cents             INTEGER     NOT NULL DEFAULT 0,
  gross_total_cents           INTEGER     NOT NULL DEFAULT 0,
  validation_run_id           UUID,
  due_date                    DATE        NOT NULL,
  sent_prepared_at            TIMESTAMPTZ,
  is_statutory_prepared_only  BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_care_billing_invoices_tenant
  ON public.care_billing_invoices (tenant_id, client_id, status);

-- --------------------------------------------------------------------------
-- 4. care_billing_invoice_items — Rechnungspositionen
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.care_billing_invoice_items (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  invoice_id          UUID        NOT NULL REFERENCES public.care_billing_invoices(id) ON DELETE CASCADE,
  billable_item_id    UUID        NOT NULL REFERENCES public.billable_items(id) ON DELETE RESTRICT,
  description         TEXT        NOT NULL,
  net_total_cents     INTEGER     NOT NULL DEFAULT 0,
  tax_total_cents     INTEGER     NOT NULL DEFAULT 0,
  gross_total_cents   INTEGER     NOT NULL DEFAULT 0,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_care_billing_invoice_items_invoice
  ON public.care_billing_invoice_items (tenant_id, invoice_id);

-- --------------------------------------------------------------------------
-- 5. receivables — Forderungsmanagement
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.receivables (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  client_id           UUID        NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  invoice_id          UUID        NOT NULL REFERENCES public.care_billing_invoices(id) ON DELETE RESTRICT,
  invoice_number      TEXT        NOT NULL,
  gross_total_cents   INTEGER     NOT NULL DEFAULT 0,
  open_amount_cents   INTEGER     NOT NULL DEFAULT 0,
  paid_amount_cents   INTEGER     NOT NULL DEFAULT 0,
  due_date            DATE        NOT NULL,
  dunning_status      TEXT        NOT NULL DEFAULT 'not_due'
                      CHECK (dunning_status IN (
                        'not_due', 'due', 'overdue', 'reminder_sent',
                        'first_dunning_sent', 'final_dunning_sent', 'collection_prepared',
                        'paid', 'disputed', 'written_off'
                      )),
  last_dunning_at     TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, invoice_id)
);

CREATE INDEX IF NOT EXISTS idx_receivables_tenant_status
  ON public.receivables (tenant_id, dunning_status, due_date);

-- --------------------------------------------------------------------------
-- 6. dunning_runs — Mahnläufe
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.dunning_runs (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  status              TEXT        NOT NULL DEFAULT 'draft'
                      CHECK (status IN ('draft', 'prepared', 'completed', 'cancelled')),
  run_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  receivable_count    INTEGER     NOT NULL DEFAULT 0,
  prepared_by         UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  notes               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dunning_runs_tenant
  ON public.dunning_runs (tenant_id, run_at DESC);

-- --------------------------------------------------------------------------
-- 7. dunning_letters — Mahnschreiben (vorbereitet)
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.dunning_letters (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  dunning_run_id      UUID        NOT NULL REFERENCES public.dunning_runs(id) ON DELETE CASCADE,
  receivable_id       UUID        NOT NULL REFERENCES public.receivables(id) ON DELETE RESTRICT,
  invoice_id          UUID        NOT NULL REFERENCES public.care_billing_invoices(id) ON DELETE RESTRICT,
  letter_level        TEXT        NOT NULL
                      CHECK (letter_level IN ('reminder', 'first', 'final', 'collection')),
  open_amount_cents   INTEGER     NOT NULL DEFAULT 0,
  status              TEXT        NOT NULL DEFAULT 'prepared'
                      CHECK (status IN ('prepared', 'sent_prepared')),
  prepared_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dunning_letters_run
  ON public.dunning_letters (tenant_id, dunning_run_id);

-- --------------------------------------------------------------------------
-- 8. payment_allocations — Zahlungszuordnungen
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payment_allocations (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  receivable_id       UUID        NOT NULL REFERENCES public.receivables(id) ON DELETE RESTRICT,
  invoice_id          UUID        NOT NULL REFERENCES public.care_billing_invoices(id) ON DELETE RESTRICT,
  amount_cents        INTEGER     NOT NULL,
  payment_reference   TEXT        NOT NULL DEFAULT '',
  allocated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_allocations_receivable
  ON public.payment_allocations (tenant_id, receivable_id, allocated_at DESC);

-- --------------------------------------------------------------------------
-- 9. billing_audit_events — Audit-Trail Abrechnungszyklus
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.billing_audit_events (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  action              TEXT        NOT NULL,
  entity_type         TEXT        NOT NULL,
  entity_id           UUID,
  summary             TEXT        NOT NULL DEFAULT '',
  actor_id            UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_billing_audit_events_tenant
  ON public.billing_audit_events (tenant_id, created_at DESC);

-- --------------------------------------------------------------------------
-- RLS aktivieren
-- --------------------------------------------------------------------------
ALTER TABLE public.billing_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_run_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.care_billing_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.care_billing_invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receivables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dunning_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dunning_letters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_audit_events ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'billing_runs', 'billing_run_items', 'care_billing_invoices', 'care_billing_invoice_items',
    'receivables', 'dunning_runs', 'dunning_letters', 'payment_allocations', 'billing_audit_events'
  ]
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I_tenant ON public.%I', t, t);
    EXECUTE format(
      'CREATE POLICY %I_tenant ON public.%I FOR ALL TO authenticated USING (tenant_id = public.current_tenant_id()) WITH CHECK (tenant_id = public.current_tenant_id())',
      t, t
    );
  END LOOP;
END $$;

COMMENT ON TABLE public.billing_runs IS
  'Monatsabschluss/Rechnungslauf — vorbereitet, auditierbar, mandantenisoliert';

COMMENT ON TABLE public.receivables IS
  'Forderungsmanagement — offene Posten mit Mahnstatus';

COMMENT ON TABLE public.dunning_runs IS
  'Mahnläufe — nur bei offenen fälligen Forderungen';

COMMENT ON TABLE public.care_billing_invoices IS
  'Pflege-Rechnungen — Kassenabrechnung nur sent_prepared ohne produktiven Versand';
