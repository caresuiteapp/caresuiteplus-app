-- ==========================================================================
-- CareSuite+ — Migration 0002: RLS-Verfeinerungen & GRANTs (Arbeitspaket 010)
-- Voraussetzung: 0001_core_schema.sql
-- ==========================================================================

-- Ersteinrichtung: Mandant anlegen wenn Profil noch ohne tenant_id
DROP POLICY IF EXISTS "tenants_insert_onboarding" ON public.tenants;
CREATE POLICY "tenants_insert_onboarding"
  ON public.tenants FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.profiles WHERE id = auth.uid() AND tenant_id IS NOT NULL
    )
  );

DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
CREATE POLICY "profiles_insert_own"
  ON public.profiles FOR INSERT
  WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "tenant_products_insert_admin" ON public.tenant_products;
CREATE POLICY "tenant_products_insert_admin"
  ON public.tenant_products FOR INSERT
  WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM public.profiles
      WHERE id = auth.uid() AND role_key IN ('business_admin', 'business_manager')
    )
  );

DROP POLICY IF EXISTS "tenant_products_update_admin" ON public.tenant_products;
CREATE POLICY "tenant_products_update_admin"
  ON public.tenant_products FOR UPDATE
  USING (
    tenant_id IN (
      SELECT tenant_id FROM public.profiles
      WHERE id = auth.uid() AND role_key IN ('business_admin', 'business_manager')
    )
  );

DROP POLICY IF EXISTS "tenant_subscriptions_insert_admin" ON public.tenant_subscriptions;
CREATE POLICY "tenant_subscriptions_insert_admin"
  ON public.tenant_subscriptions FOR INSERT
  WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM public.profiles
      WHERE id = auth.uid() AND role_key IN ('business_admin', 'business_manager')
    )
  );

-- --------------------------------------------------------------------------
-- Hilfsfunktionen für RLS & RPCs (SECURITY DEFINER, search_path gesetzt)
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.current_tenant_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT tenant_id FROM public.profiles WHERE id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.current_role_key()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role_key FROM public.profiles WHERE id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.has_permission(p_permission_key TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles pr
    JOIN public.role_permissions rp ON rp.role_id = pr.role_id
    WHERE pr.id = auth.uid()
      AND rp.permission_key = p_permission_key
  )
$$;

-- --------------------------------------------------------------------------
-- GRANTs für authenticated
-- --------------------------------------------------------------------------
GRANT USAGE ON SCHEMA public TO authenticated;

GRANT SELECT ON public.products TO authenticated;
GRANT SELECT ON public.roles TO authenticated;
GRANT SELECT ON public.role_permissions TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.tenants TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.tenant_addresses TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.tenant_contacts TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.tenant_products TO authenticated;
GRANT SELECT, INSERT ON public.tenant_subscriptions TO authenticated;

GRANT EXECUTE ON FUNCTION public.current_tenant_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_role_key() TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_permission(TEXT) TO authenticated;

-- --------------------------------------------------------------------------
-- Zusätzliche Indizes
-- --------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_tenants_slug ON public.tenants(slug);
CREATE INDEX IF NOT EXISTS idx_tenant_products_active ON public.tenant_products(tenant_id, is_active);
CREATE INDEX IF NOT EXISTS idx_tenant_products_product_id ON public.tenant_products(product_id);
