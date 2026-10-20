-- ==========================================================================
-- CareSuite+ — Migration 0018: Auth/Portal Remote E2E Fixes
-- Schema drift (tenants.slug/industry), service_role GRANTs for Edge Functions.
-- Keine destruktiven Befehle (DROP/TRUNCATE/DELETE).
-- ==========================================================================

-- --------------------------------------------------------------------------
-- tenants: fehlende Spalten aus CareSuite-0016-Edge-Flow (FlutterFlow-Basis)
-- --------------------------------------------------------------------------
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS slug TEXT,
  ADD COLUMN IF NOT EXISTS industry TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS tenants_slug_unique
  ON public.tenants (slug)
  WHERE slug IS NOT NULL;

-- --------------------------------------------------------------------------
-- Normalisierte Adress-/Kontakt-Tabellen (optional, Edge Fn dual-write)
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tenant_addresses (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  street      TEXT        NOT NULL,
  zip         TEXT        NOT NULL,
  city        TEXT        NOT NULL,
  state       TEXT,
  country     TEXT        NOT NULL DEFAULT 'Deutschland',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.tenant_contacts (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  first_name  TEXT        NOT NULL,
  last_name   TEXT        NOT NULL,
  role        TEXT        NOT NULL,
  phone       TEXT,
  email       TEXT        NOT NULL,
  is_primary  BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.tenant_addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_contacts ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'tenant_addresses'
      AND policyname = 'tenant_addresses_tenant'
  ) THEN
    CREATE POLICY tenant_addresses_tenant ON public.tenant_addresses
      FOR ALL USING (tenant_id = public.current_tenant_id())
      WITH CHECK (tenant_id = public.current_tenant_id());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'tenant_contacts'
      AND policyname = 'tenant_contacts_tenant'
  ) THEN
    CREATE POLICY tenant_contacts_tenant ON public.tenant_contacts
      FOR ALL USING (tenant_id = public.current_tenant_id())
      WITH CHECK (tenant_id = public.current_tenant_id());
  END IF;
END $$;

-- --------------------------------------------------------------------------
-- service_role GRANTs — Edge Functions nutzen getServiceClient() (= service_role)
-- Ohne table-level GRANTs liefert Postgres „permission denied“ vor RLS.
-- --------------------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tenants TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tenant_users TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tenant_products TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tenant_subscriptions TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tenant_addresses TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tenant_contacts TO service_role;
GRANT SELECT ON public.products TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.roles TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.employee_portal_accounts TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_portal_codes TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.relative_portal_codes TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.portal_sessions TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.login_audit_events TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.password_reset_events TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.access_block_events TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.portal_access_permissions TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.role_permission_sets TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_module_permissions TO service_role;

GRANT SELECT, INSERT, UPDATE ON public.tenant_addresses TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.tenant_contacts TO authenticated;

-- Hash-Sicherheit (0017): authenticated liest nur mgmt-Views, service_role voller Zugriff
REVOKE SELECT ON public.employee_portal_accounts FROM authenticated;
REVOKE SELECT ON public.client_portal_codes FROM authenticated;
REVOKE SELECT ON public.relative_portal_codes FROM authenticated;

GRANT INSERT, UPDATE ON public.employee_portal_accounts TO authenticated;
GRANT INSERT, UPDATE ON public.client_portal_codes TO authenticated;
GRANT INSERT, UPDATE ON public.relative_portal_codes TO authenticated;

GRANT SELECT ON public.employee_portal_accounts_mgmt TO authenticated;
GRANT SELECT ON public.client_portal_codes_mgmt TO authenticated;
GRANT SELECT ON public.relative_portal_codes_mgmt TO authenticated;
