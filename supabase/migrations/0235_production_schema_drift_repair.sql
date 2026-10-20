-- ==========================================================================
-- CareSuite+ — Migration 0235: Production schema drift repair
-- Restores module-access columns, table grants, and environment RLS missing
-- on production despite earlier migration history entries.
-- ==========================================================================

-- tenant_products: restore module-access columns expected by the app
ALTER TABLE public.tenant_products
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN,
  ADD COLUMN IF NOT EXISTS activated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS access_source TEXT,
  ADD COLUMN IF NOT EXISTS included_by_module_key TEXT,
  ADD COLUMN IF NOT EXISTS is_base_included BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS billing_status TEXT,
  ADD COLUMN IF NOT EXISTS access_type TEXT,
  ADD COLUMN IF NOT EXISTS price_cents INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS premium_ready BOOLEAN NOT NULL DEFAULT FALSE;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tenant_products' AND column_name = 'status'
  ) THEN
    UPDATE public.tenant_products tp
    SET
      is_active = COALESCE(tp.is_active, tp.status IN ('active', 'trial')),
      activated_at = COALESCE(tp.activated_at, NOW()),
      access_source = COALESCE(
        tp.access_source,
        CASE WHEN tp.status IN ('active', 'trial') THEN 'free_active' ELSE 'free_available' END
      ),
      billing_status = COALESCE(
        tp.billing_status,
        CASE WHEN tp.status IN ('active', 'trial') THEN 'free_active' ELSE 'free_available' END
      ),
      access_type = COALESCE(tp.access_type, 'free'),
      price_cents = COALESCE(tp.price_cents, 0)
    WHERE tp.is_active IS NULL
       OR tp.activated_at IS NULL
       OR tp.access_source IS NULL
       OR tp.billing_status IS NULL
       OR tp.access_type IS NULL;

    UPDATE public.tenant_products
    SET is_active = COALESCE(is_active, status IN ('active', 'trial'))
    WHERE is_active IS NULL;
  ELSE
    UPDATE public.tenant_products tp
    SET
      is_active = COALESCE(tp.is_active, TRUE),
      activated_at = COALESCE(tp.activated_at, NOW()),
      access_source = COALESCE(tp.access_source, 'free_active'),
      billing_status = COALESCE(tp.billing_status, 'free_active'),
      access_type = COALESCE(tp.access_type, 'free'),
      price_cents = COALESCE(tp.price_cents, 0)
    WHERE tp.is_active IS NULL
       OR tp.activated_at IS NULL
       OR tp.access_source IS NULL
       OR tp.billing_status IS NULL
       OR tp.access_type IS NULL;

    UPDATE public.tenant_products
    SET is_active = COALESCE(is_active, TRUE)
    WHERE is_active IS NULL;
  END IF;
END $$;

ALTER TABLE public.tenant_products
  ALTER COLUMN is_active SET DEFAULT TRUE,
  ALTER COLUMN activated_at SET DEFAULT NOW();

ALTER TABLE public.tenant_products
  ALTER COLUMN is_active SET NOT NULL;

-- employee_location_consents: RLS exists but authenticated lacked table grants
GRANT SELECT, INSERT, UPDATE ON public.employee_location_consents TO authenticated;

-- tenant_environment_settings: enable tenant-scoped reads for authenticated users
GRANT SELECT ON public.tenant_environment_settings TO authenticated;

DROP POLICY IF EXISTS tenant_environment_settings_tenant_select ON public.tenant_environment_settings;
CREATE POLICY tenant_environment_settings_tenant_select ON public.tenant_environment_settings
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    OR public.is_tenant_member(tenant_id)
  );

COMMENT ON POLICY tenant_environment_settings_tenant_select ON public.tenant_environment_settings IS
  '0235 — Mandanten-Umgebungsmodus für eingeloggte Nutzer lesbar.';
