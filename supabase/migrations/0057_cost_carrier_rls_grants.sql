-- Cost carrier system templates + tenant/client assignments: RLS + table grants
-- Fixes 42501 for authenticated users calling search_cost_carrier_system_templates.

-- --------------------------------------------------------------------------
-- Schema + helpers (production drift — tables existed before RLS migration)
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.caresuite_current_tenant_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT p.tenant_id
  FROM public.profiles p
  WHERE p.id = auth.uid()
  LIMIT 1
$$;

CREATE TABLE IF NOT EXISTS public.cost_carrier_system_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_key text NOT NULL UNIQUE,
  carrier_type text NOT NULL
    CHECK (carrier_type IN (
      'care_insurance', 'health_insurance', 'private_insurance',
      'social_welfare_office', 'employers_liability_insurance', 'accident_insurance'
    )),
  ui_label text NOT NULL,
  name text NOT NULL,
  legal_name text,
  short_name text,
  ik_number text,
  additional_ik_numbers jsonb,
  street text,
  postal_code text,
  city text,
  federal_state text,
  country text NOT NULL DEFAULT 'DE',
  phone text,
  fax text,
  email text,
  website text,
  source_name text,
  source_url text,
  source_last_checked_at date,
  validity_status text NOT NULL DEFAULT 'active'
    CHECK (validity_status IN ('active', 'inactive', 'deprecated', 'merged', 'unknown', 'needs_review')),
  data_status text NOT NULL DEFAULT 'source_based',
  notes text,
  search_text text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_system_template boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.tenant_cost_carrier_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  system_template_id uuid REFERENCES public.cost_carrier_system_templates(id) ON DELETE SET NULL,
  carrier_type text NOT NULL,
  custom_name text,
  custom_ik_number text,
  custom_address_line_1 text,
  custom_postal_code text,
  custom_city text,
  custom_contact_name text,
  custom_phone text,
  custom_email text,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.client_cost_carrier_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  carrier_type text NOT NULL,
  system_template_id uuid REFERENCES public.cost_carrier_system_templates(id) ON DELETE SET NULL,
  tenant_override_id uuid REFERENCES public.tenant_cost_carrier_overrides(id) ON DELETE SET NULL,
  name_snapshot text NOT NULL,
  ik_number_snapshot text,
  address_snapshot jsonb,
  policy_number text,
  insurance_number text,
  care_level_relevant boolean NOT NULL DEFAULT false,
  billing_relevant boolean NOT NULL DEFAULT false,
  is_primary boolean NOT NULL DEFAULT false,
  valid_from date,
  valid_until date,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  archived_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.cost_carrier_audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
  actor_user_id uuid,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  old_value_hash text,
  new_value_hash text,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.cost_carrier_import_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_name text NOT NULL,
  source_url text,
  imported_by uuid,
  imported_at timestamptz NOT NULL DEFAULT now(),
  records_total integer NOT NULL DEFAULT 0,
  records_created integer NOT NULL DEFAULT 0,
  records_updated integer NOT NULL DEFAULT 0,
  records_skipped integer NOT NULL DEFAULT 0,
  records_failed integer NOT NULL DEFAULT 0,
  status text NOT NULL,
  error_summary text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE OR REPLACE FUNCTION public.search_cost_carrier_system_templates(
  p_carrier_type text,
  p_query text DEFAULT NULL,
  p_limit integer DEFAULT 20
)
RETURNS TABLE(
  id uuid,
  template_key text,
  carrier_type text,
  ui_label text,
  name text,
  legal_name text,
  short_name text,
  ik_number text,
  street text,
  postal_code text,
  city text,
  federal_state text,
  country text,
  phone text,
  fax text,
  email text,
  website text,
  data_status text,
  notes text
)
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT
    c.id, c.template_key, c.carrier_type, c.ui_label, c.name, c.legal_name, c.short_name,
    c.ik_number, c.street, c.postal_code, c.city, c.federal_state, c.country,
    c.phone, c.fax, c.email, c.website, c.data_status, c.notes
  FROM public.cost_carrier_system_templates c
  WHERE c.validity_status = 'active'
    AND c.carrier_type = p_carrier_type
    AND (
      p_query IS NULL
      OR trim(p_query) = ''
      OR c.search_text ILIKE '%' || p_query || '%'
      OR c.name ILIKE '%' || p_query || '%'
      OR c.city ILIKE '%' || p_query || '%'
      OR c.postal_code ILIKE '%' || p_query || '%'
      OR c.ik_number ILIKE '%' || p_query || '%'
    )
  ORDER BY
    CASE WHEN p_query IS NOT NULL AND c.name ILIKE p_query || '%' THEN 0 ELSE 1 END,
    c.name ASC,
    c.city ASC
  LIMIT least(greatest(coalesce(p_limit, 20), 1), 50);
$$;

-- --------------------------------------------------------------------------
-- RLS (idempotent — tables already exist in live)
-- --------------------------------------------------------------------------
ALTER TABLE public.cost_carrier_system_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_cost_carrier_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_cost_carrier_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cost_carrier_audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cost_carrier_import_batches ENABLE ROW LEVEL SECURITY;

-- Global read-only catalog for all authenticated users
DROP POLICY IF EXISTS "cost carrier templates readable authenticated" ON public.cost_carrier_system_templates;
CREATE POLICY "cost carrier templates readable authenticated"
  ON public.cost_carrier_system_templates
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "cost carrier templates service role writes" ON public.cost_carrier_system_templates;
CREATE POLICY "cost carrier templates service role writes"
  ON public.cost_carrier_system_templates
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- Tenant-scoped overrides
DROP POLICY IF EXISTS "tenant overrides own tenant select" ON public.tenant_cost_carrier_overrides;
CREATE POLICY "tenant overrides own tenant select"
  ON public.tenant_cost_carrier_overrides
  FOR SELECT TO authenticated
  USING (tenant_id = public.caresuite_current_tenant_id());

DROP POLICY IF EXISTS "tenant overrides own tenant insert" ON public.tenant_cost_carrier_overrides;
CREATE POLICY "tenant overrides own tenant insert"
  ON public.tenant_cost_carrier_overrides
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.caresuite_current_tenant_id());

DROP POLICY IF EXISTS "tenant overrides own tenant update" ON public.tenant_cost_carrier_overrides;
CREATE POLICY "tenant overrides own tenant update"
  ON public.tenant_cost_carrier_overrides
  FOR UPDATE TO authenticated
  USING (tenant_id = public.caresuite_current_tenant_id())
  WITH CHECK (tenant_id = public.caresuite_current_tenant_id());

-- Client assignments (tenant-scoped)
DROP POLICY IF EXISTS "client carrier assignments own tenant select" ON public.client_cost_carrier_assignments;
CREATE POLICY "client carrier assignments own tenant select"
  ON public.client_cost_carrier_assignments
  FOR SELECT TO authenticated
  USING (tenant_id = public.caresuite_current_tenant_id());

DROP POLICY IF EXISTS "client carrier assignments own tenant insert" ON public.client_cost_carrier_assignments;
CREATE POLICY "client carrier assignments own tenant insert"
  ON public.client_cost_carrier_assignments
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.caresuite_current_tenant_id());

DROP POLICY IF EXISTS "client carrier assignments own tenant update" ON public.client_cost_carrier_assignments;
CREATE POLICY "client carrier assignments own tenant update"
  ON public.client_cost_carrier_assignments
  FOR UPDATE TO authenticated
  USING (tenant_id = public.caresuite_current_tenant_id())
  WITH CHECK (tenant_id = public.caresuite_current_tenant_id());

-- Audit events (tenant-scoped or global)
DROP POLICY IF EXISTS "audit own tenant select" ON public.cost_carrier_audit_events;
CREATE POLICY "audit own tenant select"
  ON public.cost_carrier_audit_events
  FOR SELECT TO authenticated
  USING (tenant_id IS NULL OR tenant_id = public.caresuite_current_tenant_id());

DROP POLICY IF EXISTS "audit insert authenticated own tenant" ON public.cost_carrier_audit_events;
CREATE POLICY "audit insert authenticated own tenant"
  ON public.cost_carrier_audit_events
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id IS NULL OR tenant_id = public.caresuite_current_tenant_id());

-- Import batches: service role only
DROP POLICY IF EXISTS "import batches service role only" ON public.cost_carrier_import_batches;
CREATE POLICY "import batches service role only"
  ON public.cost_carrier_import_batches
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- --------------------------------------------------------------------------
-- Table grants (root cause: policies existed but SELECT/INSERT/UPDATE were missing)
-- --------------------------------------------------------------------------
GRANT SELECT ON public.cost_carrier_system_templates TO authenticated;

GRANT SELECT, INSERT, UPDATE ON public.tenant_cost_carrier_overrides TO authenticated;

GRANT SELECT, INSERT, UPDATE ON public.client_cost_carrier_assignments TO authenticated;

GRANT SELECT, INSERT ON public.cost_carrier_audit_events TO authenticated;

GRANT EXECUTE ON FUNCTION public.search_cost_carrier_system_templates(text, text, integer) TO authenticated;
