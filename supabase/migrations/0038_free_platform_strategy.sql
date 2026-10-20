-- ==========================================================================
-- CareSuite+ — Migration 0038: Free Platform Strategy
-- Non-destructive: access_type, price_cents=0, billing_status extensions,
-- premium_ready, free_platform_enabled — preparedOnly, RLS unchanged.
-- ==========================================================================

ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS free_platform_enabled BOOLEAN NOT NULL DEFAULT TRUE;

COMMENT ON COLUMN public.tenants.free_platform_enabled IS
  'CareSuite+ Free Platform: alle Hauptmodule kostenlos, Premium nur vorbereitet';

ALTER TABLE public.tenant_products
  ADD COLUMN IF NOT EXISTS access_type TEXT NOT NULL DEFAULT 'free'
    CHECK (access_type IN ('free', 'premium_prepared', 'admin_disabled', 'legacy_paid'));

ALTER TABLE public.tenant_products
  ADD COLUMN IF NOT EXISTS price_cents INTEGER NOT NULL DEFAULT 0;

ALTER TABLE public.tenant_products
  ADD COLUMN IF NOT EXISTS premium_ready BOOLEAN NOT NULL DEFAULT FALSE;

-- billing_status erweitern (0013-Constraint ersetzen)
ALTER TABLE public.tenant_products
  DROP CONSTRAINT IF EXISTS tenant_products_billing_status_check;

ALTER TABLE public.tenant_products
  ADD CONSTRAINT tenant_products_billing_status_check
  CHECK (billing_status IN (
    'billable',
    'included',
    'not_billed',
    'free_active',
    'free_available',
    'premium_prepared',
    'admin_disabled'
  ));

-- access_source erweitern (0013-Constraint ersetzen)
ALTER TABLE public.tenant_products
  DROP CONSTRAINT IF EXISTS tenant_products_access_source_check;

ALTER TABLE public.tenant_products
  ADD CONSTRAINT tenant_products_access_source_check
  CHECK (access_source IN (
    'purchased',
    'included_base',
    'trial',
    'admin_granted',
    'demo',
    'expired',
    'disabled',
    'free_active',
    'free_available'
  ));

-- tenant_subscriptions: free_active Status
ALTER TABLE public.tenant_subscriptions
  DROP CONSTRAINT IF EXISTS tenant_subscriptions_status_check;

ALTER TABLE public.tenant_subscriptions
  ADD CONSTRAINT tenant_subscriptions_status_check
  CHECK (status IN (
    'active',
    'trialing',
    'past_due',
    'canceled',
    'inactive',
    'free_active'
  ));

-- Bestehende Mandanten: Free Platform aktivieren, Preise auf 0
UPDATE public.tenants
SET free_platform_enabled = TRUE
WHERE free_platform_enabled IS DISTINCT FROM TRUE;

UPDATE public.tenant_products
SET
  price_cents = 0,
  access_type = CASE
    WHEN is_active THEN 'free'
    ELSE access_type
  END,
  billing_status = CASE
    WHEN is_active AND billing_status IN ('billable', 'included', 'not_billed') THEN 'free_active'
    WHEN NOT is_active AND billing_status = 'not_billed' THEN 'free_available'
    ELSE billing_status
  END,
  access_source = CASE
    WHEN is_active AND access_source IN ('purchased', 'trial', 'demo', 'admin_granted') THEN 'free_active'
    WHEN NOT is_active AND access_source = 'disabled' THEN 'free_available'
    ELSE access_source
  END
WHERE price_cents IS DISTINCT FROM 0
   OR billing_status IN ('billable', 'included', 'not_billed')
   OR access_source IN ('purchased', 'trial', 'demo', 'admin_granted', 'disabled');

UPDATE public.tenant_subscriptions
SET
  status = 'free_active',
  plan_key = COALESCE(plan_key, 'free_platform')
WHERE status IN ('trialing', 'active');

CREATE INDEX IF NOT EXISTS idx_tenant_products_free_platform
  ON public.tenant_products (tenant_id, billing_status)
  WHERE billing_status IN ('free_active', 'free_available', 'premium_prepared');

COMMENT ON COLUMN public.tenant_products.access_type IS
  'free | premium_prepared | admin_disabled | legacy_paid — Free Platform Strategy';
COMMENT ON COLUMN public.tenant_products.price_cents IS
  'Modulpreis in Cent — Free Platform: immer 0 für Hauptmodule';
COMMENT ON COLUMN public.tenant_products.premium_ready IS
  'Premium-Connector vorbereitet (DATEV, KIM etc.) — noch nicht monetarisiert';
