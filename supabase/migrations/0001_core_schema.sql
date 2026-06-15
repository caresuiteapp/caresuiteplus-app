-- ==========================================================================
-- CareSuite+ — Migration 0001: Kern-Schema (Arbeitspaket 010)
-- Status: VORBEREITET — manuell via `supabase db push` oder SQL Editor
-- Keine destruktiven Befehle (DROP/TRUNCATE/DELETE auf Produktionsdaten).
-- ==========================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- --------------------------------------------------------------------------
-- tenants
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tenants (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT        NOT NULL,
  slug        TEXT        UNIQUE,
  legal_form  TEXT,
  industry    TEXT,
  phone       TEXT,
  email       TEXT,
  website     TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- --------------------------------------------------------------------------
-- tenant_addresses
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

-- --------------------------------------------------------------------------
-- tenant_contacts
-- --------------------------------------------------------------------------
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

-- --------------------------------------------------------------------------
-- roles — entspricht src/types/core/auth.ts RoleKey
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.roles (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  key         TEXT        NOT NULL UNIQUE,
  name        TEXT        NOT NULL,
  description TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.roles (key, name, description) VALUES
  ('business_admin',   'Geschäftsführung / Admin', 'Voller Zugriff auf Unternehmenskonto und Module'),
  ('business_manager', 'Bereichsleitung',          'Verwaltung von Teams und Einsatzplanung'),
  ('billing',          'Abrechnung',               'Rechnungen und Abrechnung'),
  ('dispatch',         'Einsatzplanung',           'Einsatzplanung und Touren'),
  ('nurse',            'Pflegefachkraft',          'Pflegefachliche Dokumentation'),
  ('caregiver',        'Alltagsbegleiter:in',      'Alltagsbegleitung und Betreuung'),
  ('counselor',        'Beratungskraft',           'Beratungsfälle und Protokolle'),
  ('akademie_admin',   'Akademie-Admin',           'Kurse und Schulungen verwalten'),
  ('employee_portal',  'Mitarbeiterportal',        'Mitarbeiterportal-Zugang'),
  ('client_portal',    'Klient:innenportal',       'Klient:innenportal-Zugang'),
  ('family_portal',    'Angehörigenportal',        'Angehörigenportal-Zugang')
ON CONFLICT (key) DO NOTHING;

-- --------------------------------------------------------------------------
-- role_permissions — entspricht src/types/permissions PermissionKey
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.role_permissions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id         UUID NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  permission_key  TEXT NOT NULL,
  UNIQUE (role_id, permission_key)
);

-- Office-Vollzugriff (Admin + Manager)
INSERT INTO public.role_permissions (role_id, permission_key)
SELECT r.id, p.key
FROM public.roles r
CROSS JOIN (
  VALUES
    ('dashboard.view'),
    ('office.access'),
    ('office.clients.view'),
    ('office.clients.create'),
    ('office.clients.edit'),
    ('office.clients.status_change'),
    ('office.clients.archive'),
    ('office.clients.view_sensitive'),
    ('office.clients.manage_consents'),
    ('business.modules.manage')
) AS p(key)
WHERE r.key IN ('business_admin', 'business_manager')
ON CONFLICT (role_id, permission_key) DO NOTHING;

-- Lesen + sensible Daten (Büro-Fachrollen)
INSERT INTO public.role_permissions (role_id, permission_key)
SELECT r.id, p.key
FROM public.roles r
CROSS JOIN (
  VALUES
    ('dashboard.view'),
    ('office.access'),
    ('office.clients.view'),
    ('office.clients.view_sensitive')
) AS p(key)
WHERE r.key IN ('billing', 'dispatch', 'nurse', 'counselor')
ON CONFLICT (role_id, permission_key) DO NOTHING;

-- Alltagsbegleiter:in — ohne sensible Gesundheitsdaten
INSERT INTO public.role_permissions (role_id, permission_key)
SELECT r.id, p.key
FROM public.roles r
CROSS JOIN (
  VALUES
    ('dashboard.view'),
    ('office.access'),
    ('office.clients.view')
) AS p(key)
WHERE r.key = 'caregiver'
ON CONFLICT (role_id, permission_key) DO NOTHING;

-- Akademie-Admin — nur Dashboard
INSERT INTO public.role_permissions (role_id, permission_key)
SELECT r.id, 'dashboard.view'
FROM public.roles r
WHERE r.key = 'akademie_admin'
ON CONFLICT (role_id, permission_key) DO NOTHING;

-- --------------------------------------------------------------------------
-- profiles (1:1 auth.users)
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id            UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id     UUID        REFERENCES public.tenants(id) ON DELETE SET NULL,
  role_id       UUID        REFERENCES public.roles(id) ON DELETE SET NULL,
  role_key      TEXT,
  display_name  TEXT,
  email         TEXT,
  phone         TEXT,
  avatar_url    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- --------------------------------------------------------------------------
-- products + tenant_products + tenant_subscriptions
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.products (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  key         TEXT        NOT NULL UNIQUE,
  name        TEXT        NOT NULL,
  description TEXT,
  is_active   BOOLEAN     NOT NULL DEFAULT TRUE,
  sort_order  INTEGER     NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.products (key, name, description, sort_order) VALUES
  ('office',     'CareSuite+ Office',     'Verwaltung, Klient:innen, Rechnungen', 1),
  ('assist',     'CareSuite+ Assist',     'Alltagsbegleitung und Einsätze', 2),
  ('pflege',     'CareSuite+ Pflege',     'Pflegeplanung und Vitalwerte', 3),
  ('stationaer', 'CareSuite+ Stationär',  'Bewohner:innen und Übergaben', 4),
  ('beratung',   'CareSuite+ Beratung',   'Beratungsfälle und Protokolle', 5),
  ('akademie',   'CareSuite+ Akademie',   'Kurse und Zertifikate', 6)
ON CONFLICT (key) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.tenant_products (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  product_id   UUID        NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  is_active    BOOLEAN     NOT NULL DEFAULT TRUE,
  activated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, product_id)
);

CREATE TABLE IF NOT EXISTS public.tenant_subscriptions (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id            UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  status               TEXT        NOT NULL DEFAULT 'trialing'
                                   CHECK (status IN ('active','trialing','past_due','canceled','inactive')),
  plan_key             TEXT,
  trial_ends_at        TIMESTAMPTZ,
  current_period_start TIMESTAMPTZ,
  current_period_end   TIMESTAMPTZ,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- --------------------------------------------------------------------------
-- Trigger: Profil bei Registrierung
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role_id UUID;
BEGIN
  SELECT id INTO v_role_id FROM public.roles WHERE key = 'business_admin';

  INSERT INTO public.profiles (id, email, display_name, role_id, role_key)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(
      NEW.raw_user_meta_data->>'display_name',
      NEW.raw_user_meta_data->>'full_name',
      NEW.email
    ),
    v_role_id,
    'business_admin'
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- --------------------------------------------------------------------------
-- Trigger: updated_at
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_tenants_updated_at ON public.tenants;
CREATE TRIGGER set_tenants_updated_at
  BEFORE UPDATE ON public.tenants
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_profiles_updated_at ON public.profiles;
CREATE TRIGGER set_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_tenant_subscriptions_updated_at ON public.tenant_subscriptions;
CREATE TRIGGER set_tenant_subscriptions_updated_at
  BEFORE UPDATE ON public.tenant_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- --------------------------------------------------------------------------
-- RLS aktivieren (Basis-Policies)
-- --------------------------------------------------------------------------
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenants_select_own"
  ON public.tenants FOR SELECT
  USING (id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "tenants_update_own"
  ON public.tenants FOR UPDATE
  USING (id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "tenant_addresses_tenant"
  ON public.tenant_addresses FOR ALL
  USING (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()))
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "tenant_contacts_tenant"
  ON public.tenant_contacts FOR ALL
  USING (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()))
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "profiles_select_own"
  ON public.profiles FOR SELECT
  USING (id = auth.uid());

CREATE POLICY "profiles_update_own"
  ON public.profiles FOR UPDATE
  USING (id = auth.uid());

CREATE POLICY "roles_select_auth"
  ON public.roles FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "role_permissions_select_auth"
  ON public.role_permissions FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "products_select_auth"
  ON public.products FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "tenant_products_select_tenant"
  ON public.tenant_products FOR SELECT
  USING (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "tenant_subscriptions_select_tenant"
  ON public.tenant_subscriptions FOR SELECT
  USING (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));

-- --------------------------------------------------------------------------
-- Indizes
-- --------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_profiles_tenant_id ON public.profiles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_profiles_role_key ON public.profiles(role_key);
CREATE INDEX IF NOT EXISTS idx_tenant_products_tenant_id ON public.tenant_products(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_subscriptions_tenant_id ON public.tenant_subscriptions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_role_id ON public.role_permissions(role_id);
CREATE INDEX IF NOT EXISTS idx_products_key ON public.products(key);
