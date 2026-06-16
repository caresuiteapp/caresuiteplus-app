-- ==========================================================================
-- CareSuite+ — Migration 0054: Buchhaltung Bankabgleich & Zahlungsimport (prepared)
-- Ergänzt 0046_accounting_connect_prepared — nicht produktiv pushen.
-- Keine API-Keys im Klartext. Kein „bezahlt" ohne Zahlungsbeleg.
-- ==========================================================================

-- --------------------------------------------------------------------------
-- accounting_export_batches — Sicht auf accounting_exports (0046)
-- --------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.accounting_export_batches AS
SELECT
  id,
  tenant_id,
  provider_key,
  export_type,
  export_format,
  status,
  external_transfer,
  item_count,
  error_summary,
  package_label,
  initiated_by,
  started_at,
  finished_at,
  created_at,
  updated_at
FROM public.accounting_exports;

COMMENT ON VIEW public.accounting_export_batches IS
  'Alias auf accounting_exports — Export-Batches für Connect Buchhaltung (prepared)';

-- --------------------------------------------------------------------------
-- tax_advisor_packages — Steuerberater-ZIP vorbereitet
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tax_advisor_packages (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  package_label         TEXT        NOT NULL,
  formats_json          JSONB       NOT NULL DEFAULT '[]'::jsonb,
  status                TEXT        NOT NULL DEFAULT 'prepared'
    CHECK (status IN ('prepared', 'blocked', 'failed', 'cancelled')),
  item_count            INTEGER     NOT NULL DEFAULT 0,
  zip_reference         TEXT,
  external_transfer     BOOLEAN     NOT NULL DEFAULT FALSE,
  error_summary         TEXT,
  prepared_by           UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  prepared_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tax_advisor_packages_tenant
  ON public.tax_advisor_packages (tenant_id, created_at DESC);

-- --------------------------------------------------------------------------
-- bank_transaction_imports — CSV-Zahlungsimport vorbereitet
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.bank_transaction_imports (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  file_name             TEXT        NOT NULL,
  import_format         TEXT        NOT NULL DEFAULT 'csv'
    CHECK (import_format IN ('csv', 'camt', 'mt940')),
  status                TEXT        NOT NULL DEFAULT 'prepared'
    CHECK (status IN ('prepared', 'parsed', 'blocked', 'failed', 'cancelled')),
  row_count             INTEGER     NOT NULL DEFAULT 0,
  error_summary         TEXT,
  imported_by           UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bank_transaction_imports_tenant
  ON public.bank_transaction_imports (tenant_id, created_at DESC);

-- --------------------------------------------------------------------------
-- bank_transactions — Einzelbuchungen aus Import
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.bank_transactions (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  import_id             UUID        NOT NULL REFERENCES public.bank_transaction_imports(id) ON DELETE CASCADE,
  booking_date          DATE        NOT NULL,
  amount_cents          BIGINT      NOT NULL,
  counterparty          TEXT,
  reference_text        TEXT,
  match_status          TEXT        NOT NULL DEFAULT 'unmatched'
    CHECK (match_status IN (
      'unmatched', 'suggested', 'match_blocked', 'confirmed_blocked', 'reconciled_prepared'
    )),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bank_transactions_tenant
  ON public.bank_transactions (tenant_id, import_id);

CREATE INDEX IF NOT EXISTS idx_bank_transactions_match
  ON public.bank_transactions (tenant_id, match_status);

-- --------------------------------------------------------------------------
-- payment_matching_suggestions — Abgleichsvorschläge (kein auto-bezahlt)
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payment_matching_suggestions (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  bank_transaction_id   UUID        NOT NULL REFERENCES public.bank_transactions(id) ON DELETE CASCADE,
  invoice_id            UUID        NOT NULL,
  confidence_score      NUMERIC(5, 2) NOT NULL DEFAULT 0,
  status                TEXT        NOT NULL DEFAULT 'prepared'
    CHECK (status IN ('prepared', 'accepted_prepared', 'rejected', 'blocked')),
  requires_receipt      BOOLEAN     NOT NULL DEFAULT TRUE,
  receipt_reference     TEXT,
  error_message         TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_matching_suggestions_tenant
  ON public.payment_matching_suggestions (tenant_id, bank_transaction_id);

-- --------------------------------------------------------------------------
-- accounting_audit_events — allgemeiner Buchhaltungs-Audit (append-only)
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.accounting_audit_events (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  invoice_id            UUID,
  export_id             UUID        REFERENCES public.accounting_exports(id) ON DELETE SET NULL,
  import_id             UUID        REFERENCES public.bank_transaction_imports(id) ON DELETE SET NULL,
  actor_user_id         UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  event_type            TEXT        NOT NULL
    CHECK (event_type IN (
      'export_prepared', 'export_blocked', 'belegpaket_prepared',
      'steuerberater_package_prepared', 'payment_import_prepared',
      'payment_import_blocked', 'bank_reconciliation_prepared',
      'payment_match_suggested', 'payment_confirm_blocked',
      'status_changed', 'error_logged'
    )),
  summary               TEXT        NOT NULL,
  metadata_json         JSONB       NOT NULL DEFAULT '{}'::jsonb,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_accounting_audit_events_tenant
  ON public.accounting_audit_events (tenant_id, created_at DESC);

-- --------------------------------------------------------------------------
-- updated_at Trigger
-- --------------------------------------------------------------------------
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'tax_advisor_packages',
    'bank_transaction_imports',
    'payment_matching_suggestions'
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
ALTER TABLE public.tax_advisor_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_transaction_imports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_matching_suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounting_audit_events ENABLE ROW LEVEL SECURITY;

-- --------------------------------------------------------------------------
-- RLS: Mandant lesen; Schreiben Tenant-Admin
-- --------------------------------------------------------------------------
DROP POLICY IF EXISTS tax_advisor_packages_tenant_select ON public.tax_advisor_packages;
CREATE POLICY tax_advisor_packages_tenant_select ON public.tax_advisor_packages
  FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS tax_advisor_packages_tenant_write ON public.tax_advisor_packages;
CREATE POLICY tax_advisor_packages_tenant_write ON public.tax_advisor_packages
  FOR ALL TO authenticated
  USING (tenant_id = public.current_tenant_id() AND public.is_connect_tenant_admin())
  WITH CHECK (tenant_id = public.current_tenant_id() AND public.is_connect_tenant_admin());

DROP POLICY IF EXISTS bank_transaction_imports_tenant_select ON public.bank_transaction_imports;
CREATE POLICY bank_transaction_imports_tenant_select ON public.bank_transaction_imports
  FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS bank_transaction_imports_tenant_write ON public.bank_transaction_imports;
CREATE POLICY bank_transaction_imports_tenant_write ON public.bank_transaction_imports
  FOR ALL TO authenticated
  USING (tenant_id = public.current_tenant_id() AND public.is_connect_tenant_admin())
  WITH CHECK (tenant_id = public.current_tenant_id() AND public.is_connect_tenant_admin());

DROP POLICY IF EXISTS bank_transactions_tenant_select ON public.bank_transactions;
CREATE POLICY bank_transactions_tenant_select ON public.bank_transactions
  FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS bank_transactions_tenant_write ON public.bank_transactions;
CREATE POLICY bank_transactions_tenant_write ON public.bank_transactions
  FOR ALL TO authenticated
  USING (tenant_id = public.current_tenant_id() AND public.is_connect_tenant_admin())
  WITH CHECK (tenant_id = public.current_tenant_id() AND public.is_connect_tenant_admin());

DROP POLICY IF EXISTS payment_matching_suggestions_tenant_select ON public.payment_matching_suggestions;
CREATE POLICY payment_matching_suggestions_tenant_select ON public.payment_matching_suggestions
  FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS payment_matching_suggestions_tenant_write ON public.payment_matching_suggestions;
CREATE POLICY payment_matching_suggestions_tenant_write ON public.payment_matching_suggestions
  FOR ALL TO authenticated
  USING (tenant_id = public.current_tenant_id() AND public.is_connect_tenant_admin())
  WITH CHECK (tenant_id = public.current_tenant_id() AND public.is_connect_tenant_admin());

DROP POLICY IF EXISTS accounting_audit_events_tenant_select ON public.accounting_audit_events;
CREATE POLICY accounting_audit_events_tenant_select ON public.accounting_audit_events
  FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS accounting_audit_events_tenant_insert ON public.accounting_audit_events;
CREATE POLICY accounting_audit_events_tenant_insert ON public.accounting_audit_events
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.current_tenant_id());

-- --------------------------------------------------------------------------
-- GRANTs
-- --------------------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE ON public.tax_advisor_packages TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.bank_transaction_imports TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bank_transactions TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.payment_matching_suggestions TO authenticated;
GRANT SELECT, INSERT ON public.accounting_audit_events TO authenticated;

COMMENT ON TABLE public.payment_matching_suggestions IS
  'Zahlungsabgleich — requires_receipt=true; kein automatisches „bezahlt" ohne Beleg';

COMMENT ON TABLE public.accounting_audit_events IS
  'Buchhaltungs-Audit append-only — Export, Import, Abgleich, Fehler';
