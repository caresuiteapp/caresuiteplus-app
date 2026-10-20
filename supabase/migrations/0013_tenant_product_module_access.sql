-- ==========================================================================
-- CareSuite+ — Migration 0013: Modul-Zugriffsquelle (Office Basis-Modul)
-- Status: VORBEREITET — manuell via `supabase db push` oder SQL Editor
-- Keine destruktiven Befehle (DROP/TRUNCATE/DELETE auf Produktionsdaten).
--
-- Hinweis: Die App modelliert Mandanten-Module in `tenant_products`
-- (nicht `tenant_modules`). Spalten werden dort ergänzt.
-- ==========================================================================

ALTER TABLE public.tenant_products
  ADD COLUMN IF NOT EXISTS access_source TEXT NOT NULL DEFAULT 'purchased'
    CHECK (access_source IN (
      'purchased',
      'included_base',
      'trial',
      'admin_granted',
      'demo',
      'expired',
      'disabled'
    ));

ALTER TABLE public.tenant_products
  ADD COLUMN IF NOT EXISTS included_by_module_key TEXT
    REFERENCES public.products(key);

ALTER TABLE public.tenant_products
  ADD COLUMN IF NOT EXISTS is_base_included BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.tenant_products
  ADD COLUMN IF NOT EXISTS billing_status TEXT NOT NULL DEFAULT 'billable'
    CHECK (billing_status IN ('billable', 'included', 'not_billed'));

COMMENT ON COLUMN public.tenant_products.access_source IS
  'Wie das Modul freigeschaltet wurde: purchased, included_base (Office via Fachmodul), trial, admin_granted, demo, expired, disabled';

COMMENT ON COLUMN public.tenant_products.included_by_module_key IS
  'Bei included_base: welches Fachmodul Office automatisch enthält';

COMMENT ON COLUMN public.tenant_products.is_base_included IS
  'TRUE wenn Office als Basis-Modul ohne eigene Abrechnung enthalten ist';

COMMENT ON COLUMN public.tenant_products.billing_status IS
  'Abrechnungsstatus: billable, included (keine Doppelabrechnung), not_billed';

CREATE INDEX IF NOT EXISTS idx_tenant_products_access_source
  ON public.tenant_products(access_source);

CREATE INDEX IF NOT EXISTS idx_tenant_products_billing_status
  ON public.tenant_products(billing_status);

-- Bestehende Demo-/Pilot-Zeilen: Office als purchased markieren (kein Datenverlust)
UPDATE public.tenant_products tp
SET
  access_source = 'purchased',
  is_base_included = FALSE,
  billing_status = 'billable'
FROM public.products p
WHERE tp.product_id = p.id
  AND p.key = 'office'
  AND tp.access_source = 'purchased';
