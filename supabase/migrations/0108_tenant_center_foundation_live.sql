-- ==========================================================================
-- CareSuite+ — Migration 0108: Tenant Center Foundation (Profiles, Catalog, Custom Fields)
-- Mandanten-Settings-Hub: Profile, Leistungskatalog, Custom Fields
-- Pattern: 0078_tenant_settings_rls_live.sql, 0084_tenant_billing_settings_rls_live.sql
-- ==========================================================================

-- --------------------------------------------------------------------------
-- 1:1 Profile-Erweiterungen (tenants enthält bereits Kern-Stammdaten)
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tenant_legal_profiles (
  tenant_id                 UUID PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
  liability_insurance       TEXT,
  liability_insurer         TEXT,
  liability_policy_number   TEXT,
  chamber_membership        TEXT,
  professional_association  TEXT,
  legal_notes               TEXT,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.tenant_tax_profiles (
  tenant_id                 UUID PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
  tax_office                TEXT,
  kleinunternehmer          BOOLEAN NOT NULL DEFAULT FALSE,
  tax_scheme                TEXT NOT NULL DEFAULT 'standard'
    CHECK (tax_scheme IN ('standard', 'kleinunternehmer', 'exempt')),
  reverse_charge            BOOLEAN NOT NULL DEFAULT FALSE,
  tax_notes                 TEXT,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.tenant_register_profiles (
  tenant_id                 UUID PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
  register_type             TEXT,
  register_date             DATE,
  share_capital             TEXT,
  register_notes            TEXT,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- --------------------------------------------------------------------------
-- Multi-Row: Vertretung & Bankverbindungen
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tenant_representatives (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  salutation    TEXT,
  first_name    TEXT NOT NULL DEFAULT '',
  last_name     TEXT NOT NULL DEFAULT '',
  position      TEXT,
  email         TEXT,
  phone         TEXT,
  is_primary    BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order    INT NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tenant_representatives_tenant
  ON public.tenant_representatives(tenant_id, sort_order);

CREATE TABLE IF NOT EXISTS public.tenant_bank_accounts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  label           TEXT,
  account_holder  TEXT,
  bank_name       TEXT,
  iban            TEXT,
  bic             TEXT,
  is_primary      BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order      INT NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tenant_bank_accounts_tenant
  ON public.tenant_bank_accounts(tenant_id, sort_order);

-- --------------------------------------------------------------------------
-- Modul-Toggles (Leistungsbereiche)
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tenant_module_settings (
  tenant_id           UUID PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
  assist_enabled      BOOLEAN NOT NULL DEFAULT TRUE,
  pflege_enabled      BOOLEAN NOT NULL DEFAULT FALSE,
  stationaer_enabled  BOOLEAN NOT NULL DEFAULT FALSE,
  beratung_enabled    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- --------------------------------------------------------------------------
-- Leistungskatalog
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tenant_service_catalog (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  module_key    TEXT NOT NULL
    CHECK (module_key IN ('assist', 'pflege', 'stationaer', 'beratung')),
  service_key   TEXT NOT NULL,
  name          TEXT NOT NULL,
  description   TEXT,
  unit          TEXT NOT NULL DEFAULT 'hour'
    CHECK (unit IN ('hour', 'visit', 'day', 'flat', 'km', 'percent')),
  category      TEXT NOT NULL DEFAULT 'service'
    CHECK (category IN ('service', 'travel', 'surcharge')),
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order    INT NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, service_key)
);

CREATE INDEX IF NOT EXISTS idx_tenant_service_catalog_tenant_module
  ON public.tenant_service_catalog(tenant_id, module_key, sort_order);

CREATE TABLE IF NOT EXISTS public.tenant_service_prices (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  catalog_id    UUID NOT NULL REFERENCES public.tenant_service_catalog(id) ON DELETE CASCADE,
  price_net     NUMERIC(10, 2) NOT NULL DEFAULT 0,
  tax_rate      NUMERIC(5, 2) NOT NULL DEFAULT 0,
  tax_mode      TEXT NOT NULL DEFAULT 'exempt_4_16'
    CHECK (tax_mode IN ('exempt_4_16', 'standard_19', 'kleinunternehmer_19', 'none')),
  valid_from    DATE NOT NULL DEFAULT CURRENT_DATE,
  valid_to      DATE,
  is_default    BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tenant_service_prices_catalog
  ON public.tenant_service_prices(catalog_id, valid_from DESC);

CREATE TABLE IF NOT EXISTS public.tenant_service_price_versions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  price_id        UUID NOT NULL REFERENCES public.tenant_service_prices(id) ON DELETE CASCADE,
  price_net       NUMERIC(10, 2) NOT NULL,
  tax_rate        NUMERIC(5, 2) NOT NULL DEFAULT 0,
  tax_mode        TEXT NOT NULL,
  valid_from      DATE NOT NULL,
  valid_to        DATE,
  changed_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  changed_by      UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  change_reason   TEXT,
  snapshot        JSONB
);

CREATE INDEX IF NOT EXISTS idx_tenant_service_price_versions_price
  ON public.tenant_service_price_versions(price_id, changed_at DESC);

-- --------------------------------------------------------------------------
-- Custom Fields
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tenant_custom_field_groups (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  sort_order    INT NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tenant_custom_field_groups_tenant
  ON public.tenant_custom_field_groups(tenant_id, sort_order);

CREATE TABLE IF NOT EXISTS public.tenant_custom_field_definitions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  group_id        UUID REFERENCES public.tenant_custom_field_groups(id) ON DELETE SET NULL,
  field_key       TEXT NOT NULL,
  label           TEXT NOT NULL,
  data_type       TEXT NOT NULL DEFAULT 'text'
    CHECK (data_type IN ('text', 'number', 'date', 'boolean', 'select', 'multiline')),
  module_key      TEXT,
  function_key    TEXT,
  visibility      JSONB NOT NULL DEFAULT '{}'::jsonb,
  validation      JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order      INT NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, field_key)
);

CREATE INDEX IF NOT EXISTS idx_tenant_custom_field_definitions_tenant
  ON public.tenant_custom_field_definitions(tenant_id, is_active, sort_order);

CREATE TABLE IF NOT EXISTS public.tenant_custom_field_values (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  definition_id   UUID NOT NULL REFERENCES public.tenant_custom_field_definitions(id) ON DELETE CASCADE,
  value           JSONB NOT NULL DEFAULT 'null'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, definition_id)
);

-- --------------------------------------------------------------------------
-- Seed-Funktion: Assist-Standardleistungen + Preis aus billing settings
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.seed_tenant_assist_service_catalog(p_tenant_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_rate NUMERIC(10, 2);
  v_catalog_id UUID;
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.tenant_service_catalog
    WHERE tenant_id = p_tenant_id AND module_key = 'assist'
  ) THEN
    RETURN;
  END IF;

  SELECT default_hourly_rate INTO v_rate
  FROM public.tenant_billing_settings
  WHERE tenant_id = p_tenant_id;

  v_rate := COALESCE(v_rate, 38.00);

  INSERT INTO public.tenant_service_catalog (
    tenant_id, module_key, service_key, name, description, unit, category, sort_order
  ) VALUES
    (p_tenant_id, 'assist', 'assist.alltagsbegleitung', 'Alltagsbegleitung',
     'Individuelle Alltagsbegleitung und Betreuung', 'hour', 'service', 10),
    (p_tenant_id, 'assist', 'assist.entlastung_45b', 'Entlastungsleistung §45b SGB XI',
     'Entlastungsleistung nach § 45b SGB XI', 'hour', 'service', 20),
    (p_tenant_id, 'assist', 'assist.verhinderungspflege_39', 'Verhinderungspflege §39 SGB XI',
     'Verhinderungspflege nach § 39 SGB XI', 'hour', 'service', 30),
    (p_tenant_id, 'assist', 'assist.haushaltshilfe_38', 'Haushaltshilfe §38 SGB V',
     'Haushaltshilfe nach § 38 SGB V', 'hour', 'service', 40),
    (p_tenant_id, 'assist', 'assist.travel.km', 'Fahrtkosten (km)',
     'Kilometerpauschale Assist-Fahrten', 'km', 'travel', 100),
    (p_tenant_id, 'assist', 'assist.surcharge.weekend', 'Wochenend-Zuschlag',
     'Zuschlag für Leistungen am Wochenende', 'percent', 'surcharge', 110)
  ON CONFLICT (tenant_id, service_key) DO NOTHING;

  SELECT id INTO v_catalog_id
  FROM public.tenant_service_catalog
  WHERE tenant_id = p_tenant_id AND service_key = 'assist.alltagsbegleitung';

  IF v_catalog_id IS NOT NULL THEN
    INSERT INTO public.tenant_service_prices (
      tenant_id, catalog_id, price_net, tax_rate, tax_mode, valid_from, is_default
    ) VALUES (
      p_tenant_id, v_catalog_id, v_rate, 0, 'exempt_4_16', CURRENT_DATE, TRUE
    )
    ON CONFLICT DO NOTHING;
  END IF;
END;
$$;

-- Seed für bestehende Mandanten (inkl. Helferhasen+ wenn vorhanden)
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT id FROM public.tenants LOOP
    PERFORM public.seed_tenant_assist_service_catalog(r.id);
  END LOOP;
END;
$$;

-- Default module settings für alle Mandanten
INSERT INTO public.tenant_module_settings (tenant_id)
SELECT t.id FROM public.tenants t
ON CONFLICT (tenant_id) DO NOTHING;

-- --------------------------------------------------------------------------
-- RLS — alle neuen Tabellen mandantenspezifisch
-- --------------------------------------------------------------------------
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'tenant_legal_profiles',
    'tenant_tax_profiles',
    'tenant_register_profiles',
    'tenant_representatives',
    'tenant_bank_accounts',
    'tenant_module_settings',
    'tenant_service_catalog',
    'tenant_service_prices',
    'tenant_service_price_versions',
    'tenant_custom_field_groups',
    'tenant_custom_field_definitions',
    'tenant_custom_field_values'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);

    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', tbl || '_select_tenant', tbl);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (tenant_id = public.current_tenant_id())',
      tbl || '_select_tenant', tbl
    );

    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', tbl || '_insert_manage', tbl);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (tenant_id = public.current_tenant_id() AND public.has_permission(''business.tenant.manage''))',
      tbl || '_insert_manage', tbl
    );

    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', tbl || '_update_manage', tbl);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (tenant_id = public.current_tenant_id() AND public.has_permission(''business.tenant.manage'')) WITH CHECK (tenant_id = public.current_tenant_id() AND public.has_permission(''business.tenant.manage''))',
      tbl || '_update_manage', tbl
    );

    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', tbl || '_delete_manage', tbl);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING (tenant_id = public.current_tenant_id() AND public.has_permission(''business.tenant.manage''))',
      tbl || '_delete_manage', tbl
    );

    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', tbl);
  END LOOP;
END;
$$;

-- tenant_contacts: manage policies (bestehende Tabelle)
ALTER TABLE public.tenant_contacts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_contacts_select_tenant" ON public.tenant_contacts;
CREATE POLICY "tenant_contacts_select_tenant"
  ON public.tenant_contacts FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS "tenant_contacts_insert_manage" ON public.tenant_contacts;
CREATE POLICY "tenant_contacts_insert_manage"
  ON public.tenant_contacts FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND public.has_permission('business.tenant.manage')
  );

DROP POLICY IF EXISTS "tenant_contacts_update_manage" ON public.tenant_contacts;
CREATE POLICY "tenant_contacts_update_manage"
  ON public.tenant_contacts FOR UPDATE TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND public.has_permission('business.tenant.manage')
  )
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND public.has_permission('business.tenant.manage')
  );

DROP POLICY IF EXISTS "tenant_contacts_delete_manage" ON public.tenant_contacts;
CREATE POLICY "tenant_contacts_delete_manage"
  ON public.tenant_contacts FOR DELETE TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND public.has_permission('business.tenant.manage')
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tenant_contacts TO authenticated;

-- audit_logs: Lesen für Mandanten-Admins
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "audit_logs_select_tenant_manage" ON public.audit_logs;
CREATE POLICY "audit_logs_select_tenant_manage"
  ON public.audit_logs FOR SELECT TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND public.has_permission('business.tenant.manage')
  );

GRANT SELECT ON public.audit_logs TO authenticated;

GRANT EXECUTE ON FUNCTION public.seed_tenant_assist_service_catalog(UUID) TO authenticated;
