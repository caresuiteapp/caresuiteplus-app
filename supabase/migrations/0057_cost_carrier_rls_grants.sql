-- Cost carrier system templates + tenant/client assignments: RLS + table grants
-- Fixes 42501 for authenticated users calling search_cost_carrier_system_templates.

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
