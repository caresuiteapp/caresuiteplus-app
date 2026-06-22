-- ==========================================================================
-- CareSuite+ — Migration 0046: Zahlungsanbieter (Vorbereitung)
-- Stripe, Mollie, GoCardless, PayPal — mandantenfähig, keine Klartext-Secrets.
-- Keine echten Zahlungen, keine Kreditkartendaten, Webhooks nur vorbereitet.
-- NICHT auf Remote pushen — nur lokale Migration vorbereiten.
-- ==========================================================================

-- --------------------------------------------------------------------------
-- Hilfsfunktion (RLS)
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_payment_tenant_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.current_role_key() IN ('business_admin', 'business_manager')
$$;

GRANT EXECUTE ON FUNCTION public.is_payment_tenant_admin() TO authenticated;

-- --------------------------------------------------------------------------
-- 1. payment_provider_configs — Mandanten-Konfiguration je Anbieter
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payment_provider_configs (
  id                          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                   UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  provider_key                TEXT        NOT NULL
    CHECK (provider_key IN ('stripe', 'mollie', 'gocardless', 'paypal', 'none')),
  environment                 TEXT        NOT NULL DEFAULT 'sandbox'
    CHECK (environment IN ('sandbox', 'production')),
  is_active                   BOOLEAN     NOT NULL DEFAULT FALSE,
  sepa_enabled                BOOLEAN     NOT NULL DEFAULT FALSE,
  subscription_billing_enabled BOOLEAN    NOT NULL DEFAULT FALSE,
  webhook_secret_reference    TEXT,
  api_credential_reference    TEXT,
  webhook_status              TEXT        NOT NULL DEFAULT 'not_configured'
    CHECK (webhook_status IN (
      'not_configured', 'pending', 'verified', 'failed', 'disabled'
    )),
  webhook_last_received_at    TIMESTAMPTZ,
  webhook_last_error          TEXT,
  configured_by               UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  configured_at               TIMESTAMPTZ,
  notes                       TEXT,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, provider_key),
  CONSTRAINT payment_provider_configs_credential_not_plaintext
    CHECK (
      api_credential_reference IS NULL
      OR (api_credential_reference NOT LIKE 'sk_%'
          AND api_credential_reference NOT LIKE 'pk_%'
          AND length(trim(api_credential_reference)) > 0)
    )
);

CREATE INDEX IF NOT EXISTS idx_payment_provider_configs_tenant
  ON public.payment_provider_configs (tenant_id, is_active);

-- --------------------------------------------------------------------------
-- 2. payment_customers — Provider-Kundenreferenzen (keine Zahlungsdaten)
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payment_customers (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  client_id             UUID        REFERENCES public.clients(id) ON DELETE SET NULL,
  provider_key          TEXT        NOT NULL
    CHECK (provider_key IN ('stripe', 'mollie', 'gocardless', 'paypal')),
  external_customer_id  TEXT,
  email_hash            TEXT,
  metadata              JSONB       NOT NULL DEFAULT '{}'::jsonb,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, provider_key, client_id)
);

CREATE INDEX IF NOT EXISTS idx_payment_customers_tenant
  ON public.payment_customers (tenant_id, provider_key);

-- --------------------------------------------------------------------------
-- 3. payment_methods — gespeicherte Zahlungsmethoden (Referenzen only)
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payment_methods (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  customer_id           UUID        NOT NULL REFERENCES public.payment_customers(id) ON DELETE CASCADE,
  provider_key          TEXT        NOT NULL
    CHECK (provider_key IN ('stripe', 'mollie', 'gocardless', 'paypal')),
  method_type           TEXT        NOT NULL
    CHECK (method_type IN (
      'invoice', 'sepa_direct_debit', 'credit_card', 'paypal',
      'subscription', 'one_time'
    )),
  external_method_id    TEXT,
  last4                 TEXT,
  brand                 TEXT,
  expiry_month          SMALLINT,
  expiry_year           SMALLINT,
  iban_last4            TEXT,
  is_default            BOOLEAN     NOT NULL DEFAULT FALSE,
  status                TEXT        NOT NULL DEFAULT 'pending'
    CHECK (status IN (
      'unpaid', 'pending', 'processing', 'paid', 'failed', 'refunded',
      'partially_refunded', 'disputed', 'cancelled', 'chargeback',
      'mandate_pending', 'mandate_active', 'mandate_failed'
    )),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_methods_tenant_customer
  ON public.payment_methods (tenant_id, customer_id);

-- --------------------------------------------------------------------------
-- 4. payment_mandates — SEPA-Mandate (Status nur nach Provider-Bestätigung)
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payment_mandates (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  customer_id           UUID        NOT NULL REFERENCES public.payment_customers(id) ON DELETE CASCADE,
  payment_method_id     UUID        REFERENCES public.payment_methods(id) ON DELETE SET NULL,
  provider_key          TEXT        NOT NULL
    CHECK (provider_key IN ('stripe', 'mollie', 'gocardless', 'paypal')),
  external_mandate_id   TEXT,
  mandate_reference     TEXT,
  status                TEXT        NOT NULL DEFAULT 'mandate_pending'
    CHECK (status IN (
      'mandate_pending', 'mandate_active', 'mandate_failed',
      'cancelled', 'expired'
    )),
  provider_confirmed_at TIMESTAMPTZ,
  signed_at             TIMESTAMPTZ,
  cancelled_at          TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_mandates_tenant_status
  ON public.payment_mandates (tenant_id, status);

-- --------------------------------------------------------------------------
-- 5. payment_transactions — Zahlungsvorgänge (keine Kartendaten)
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payment_transactions (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  invoice_id            UUID        REFERENCES public.invoices(id) ON DELETE SET NULL,
  customer_id           UUID        REFERENCES public.payment_customers(id) ON DELETE SET NULL,
  payment_method_id     UUID        REFERENCES public.payment_methods(id) ON DELETE SET NULL,
  mandate_id            UUID        REFERENCES public.payment_mandates(id) ON DELETE SET NULL,
  provider_key          TEXT        NOT NULL
    CHECK (provider_key IN ('stripe', 'mollie', 'gocardless', 'paypal')),
  method_type           TEXT        NOT NULL
    CHECK (method_type IN (
      'invoice', 'sepa_direct_debit', 'credit_card', 'paypal',
      'subscription', 'one_time'
    )),
  external_transaction_id TEXT,
  payment_link_url      TEXT,
  amount_cents          INTEGER     NOT NULL DEFAULT 0 CHECK (amount_cents >= 0),
  currency              TEXT        NOT NULL DEFAULT 'EUR',
  status                TEXT        NOT NULL DEFAULT 'unpaid'
    CHECK (status IN (
      'unpaid', 'pending', 'processing', 'paid', 'failed', 'refunded',
      'partially_refunded', 'disputed', 'cancelled', 'chargeback',
      'mandate_pending', 'mandate_active', 'mandate_failed'
    )),
  provider_status       TEXT,
  provider_confirmed_paid BOOLEAN   NOT NULL DEFAULT FALSE,
  idempotency_key       TEXT,
  metadata              JSONB       NOT NULL DEFAULT '{}'::jsonb,
  initiated_by          UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  paid_at               TIMESTAMPTZ,
  failed_at             TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_payment_transactions_tenant_invoice
  ON public.payment_transactions (tenant_id, invoice_id, status);

CREATE INDEX IF NOT EXISTS idx_payment_transactions_tenant_status
  ON public.payment_transactions (tenant_id, status, created_at DESC);

-- --------------------------------------------------------------------------
-- 6. payment_webhook_events — Webhook-Protokoll (Hash only, kein Voll-Payload)
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payment_webhook_events (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID        REFERENCES public.tenants(id) ON DELETE SET NULL,
  provider_key          TEXT        NOT NULL
    CHECK (provider_key IN ('stripe', 'mollie', 'gocardless', 'paypal')),
  event_type            TEXT        NOT NULL,
  external_event_id     TEXT,
  signature_valid       BOOLEAN,
  payload_hash          TEXT        NOT NULL,
  processing_status     TEXT        NOT NULL DEFAULT 'received'
    CHECK (processing_status IN (
      'received', 'processing', 'processed', 'rejected', 'failed', 'duplicate'
    )),
  error_message         TEXT,
  received_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at          TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (provider_key, external_event_id)
);

CREATE INDEX IF NOT EXISTS idx_payment_webhook_events_tenant
  ON public.payment_webhook_events (tenant_id, received_at DESC)
  WHERE tenant_id IS NOT NULL;

-- --------------------------------------------------------------------------
-- 7. payment_reconciliation_events — Abgleich offener Posten
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payment_reconciliation_events (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  transaction_id        UUID        NOT NULL REFERENCES public.payment_transactions(id) ON DELETE CASCADE,
  invoice_id            UUID        REFERENCES public.invoices(id) ON DELETE SET NULL,
  reconciliation_type   TEXT        NOT NULL DEFAULT 'manual'
    CHECK (reconciliation_type IN ('manual', 'automatic', 'webhook', 'import')),
  matched_amount_cents  INTEGER     NOT NULL DEFAULT 0 CHECK (matched_amount_cents >= 0),
  status                TEXT        NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'matched', 'partial', 'unmatched', 'disputed')),
  notes                 TEXT,
  reconciled_by         UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  reconciled_at         TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_reconciliation_tenant
  ON public.payment_reconciliation_events (tenant_id, transaction_id);

-- --------------------------------------------------------------------------
-- 8. subscription_billing_events — Abo-Abrechnungsereignisse
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.subscription_billing_events (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  customer_id           UUID        NOT NULL REFERENCES public.payment_customers(id) ON DELETE CASCADE,
  transaction_id        UUID        REFERENCES public.payment_transactions(id) ON DELETE SET NULL,
  provider_key          TEXT        NOT NULL
    CHECK (provider_key IN ('stripe', 'mollie', 'gocardless', 'paypal')),
  external_subscription_id TEXT,
  billing_period_start  TIMESTAMPTZ,
  billing_period_end    TIMESTAMPTZ,
  amount_cents          INTEGER     NOT NULL DEFAULT 0 CHECK (amount_cents >= 0),
  currency              TEXT        NOT NULL DEFAULT 'EUR',
  status                TEXT        NOT NULL DEFAULT 'pending'
    CHECK (status IN (
      'pending', 'processing', 'paid', 'failed', 'cancelled', 'refunded'
    )),
  event_type            TEXT        NOT NULL DEFAULT 'invoice_created'
    CHECK (event_type IN (
      'invoice_created', 'payment_succeeded', 'payment_failed',
      'subscription_cancelled', 'subscription_renewed'
    )),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscription_billing_tenant
  ON public.subscription_billing_events (tenant_id, customer_id, created_at DESC);

-- --------------------------------------------------------------------------
-- updated_at Trigger
-- --------------------------------------------------------------------------
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'payment_provider_configs',
    'payment_customers',
    'payment_methods',
    'payment_mandates',
    'payment_transactions'
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
ALTER TABLE public.payment_provider_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_mandates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_reconciliation_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_billing_events ENABLE ROW LEVEL SECURITY;

-- --------------------------------------------------------------------------
-- RLS: payment_provider_configs — Mandant lesen; Schreiben Tenant-Admin
-- Kein SELECT auf api_credential_reference/webhook_secret_reference für Client
-- (Spalten bleiben in DB; App maskiert serverseitig)
-- --------------------------------------------------------------------------
DROP POLICY IF EXISTS payment_provider_configs_tenant_select ON public.payment_provider_configs;
CREATE POLICY payment_provider_configs_tenant_select ON public.payment_provider_configs
  FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS payment_provider_configs_tenant_write ON public.payment_provider_configs;
CREATE POLICY payment_provider_configs_tenant_write ON public.payment_provider_configs
  FOR ALL TO authenticated
  USING (tenant_id = public.current_tenant_id() AND public.is_payment_tenant_admin())
  WITH CHECK (tenant_id = public.current_tenant_id() AND public.is_payment_tenant_admin());

-- --------------------------------------------------------------------------
-- RLS: payment_customers, payment_methods, payment_mandates, payment_transactions
-- --------------------------------------------------------------------------
DROP POLICY IF EXISTS payment_customers_tenant ON public.payment_customers;
CREATE POLICY payment_customers_tenant ON public.payment_customers
  FOR ALL TO authenticated
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS payment_methods_tenant ON public.payment_methods;
CREATE POLICY payment_methods_tenant ON public.payment_methods
  FOR ALL TO authenticated
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS payment_mandates_tenant ON public.payment_mandates;
CREATE POLICY payment_mandates_tenant ON public.payment_mandates
  FOR ALL TO authenticated
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS payment_transactions_tenant ON public.payment_transactions;
CREATE POLICY payment_transactions_tenant ON public.payment_transactions
  FOR ALL TO authenticated
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

-- --------------------------------------------------------------------------
-- RLS: payment_webhook_events — Mandant-Admin lesen; Insert nur service_role
-- --------------------------------------------------------------------------
DROP POLICY IF EXISTS payment_webhook_events_tenant_select ON public.payment_webhook_events;
CREATE POLICY payment_webhook_events_tenant_select ON public.payment_webhook_events
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND public.is_payment_tenant_admin()
  );

-- --------------------------------------------------------------------------
-- RLS: payment_reconciliation_events, subscription_billing_events
-- --------------------------------------------------------------------------
DROP POLICY IF EXISTS payment_reconciliation_events_tenant ON public.payment_reconciliation_events;
CREATE POLICY payment_reconciliation_events_tenant ON public.payment_reconciliation_events
  FOR ALL TO authenticated
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS subscription_billing_events_tenant ON public.subscription_billing_events;
CREATE POLICY subscription_billing_events_tenant ON public.subscription_billing_events
  FOR ALL TO authenticated
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

-- --------------------------------------------------------------------------
-- GRANTs — Webhook-Insert nur service_role
-- --------------------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_provider_configs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_customers TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_methods TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_mandates TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_transactions TO authenticated;
GRANT SELECT ON public.payment_webhook_events TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.payment_reconciliation_events TO authenticated;
GRANT SELECT, INSERT ON public.subscription_billing_events TO authenticated;

GRANT ALL ON public.payment_webhook_events TO service_role;

-- --------------------------------------------------------------------------
-- Kommentare
-- --------------------------------------------------------------------------
COMMENT ON TABLE public.payment_provider_configs IS
  'CareSuite+ Zahlungen — Mandanten-Konfiguration; Secrets nur als Vault-Referenz';

COMMENT ON COLUMN public.payment_provider_configs.api_credential_reference IS
  'Vault-Referenz — niemals Klartext-API-Key';

COMMENT ON COLUMN public.payment_provider_configs.webhook_secret_reference IS
  'Vault-Referenz für Webhook-Signatur — serverseitig only';

COMMENT ON COLUMN public.payment_transactions.provider_confirmed_paid IS
  'TRUE nur nach verifiziertem Provider-Webhook — niemals blind setzen';

COMMENT ON COLUMN public.payment_mandates.status IS
  'mandate_active nur nach provider_confirmed_at — niemals ohne Provider-Bestätigung';

COMMENT ON COLUMN public.payment_webhook_events.payload_hash IS
  'SHA-256 Hash — keine vollständigen sensiblen Webhook-Payloads persistieren';
