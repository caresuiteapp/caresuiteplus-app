-- ==========================================================================
-- CareSuite+ — Migration 0191: Employee mobility settings (transport + routes)
-- Per-employee transport mode and default route endpoints for Google travel time.
-- ==========================================================================

CREATE TABLE IF NOT EXISTS public.employee_mobility_settings (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  employee_id           UUID        NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  transport_mode        TEXT        NOT NULL DEFAULT 'car'
                        CHECK (transport_mode IN ('car', 'transit', 'bicycle', 'escooter', 'walking')),
  route_start_type      TEXT        NOT NULL DEFAULT 'home'
                        CHECK (route_start_type IN ('home', 'office', 'last_assignment', 'custom')),
  route_end_type        TEXT        NOT NULL DEFAULT 'home'
                        CHECK (route_end_type IN ('home', 'office', 'custom')),
  route_start_address   TEXT,
  route_end_address     TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, employee_id)
);

CREATE INDEX IF NOT EXISTS idx_employee_mobility_settings_tenant_employee
  ON public.employee_mobility_settings (tenant_id, employee_id);

DROP TRIGGER IF EXISTS set_employee_mobility_settings_updated_at ON public.employee_mobility_settings;
CREATE TRIGGER set_employee_mobility_settings_updated_at
  BEFORE UPDATE ON public.employee_mobility_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.employee_mobility_settings ENABLE ROW LEVEL SECURITY;

-- Employee portal: read/write own mobility settings
DROP POLICY IF EXISTS employee_mobility_settings_portal_self ON public.employee_mobility_settings;
CREATE POLICY employee_mobility_settings_portal_self ON public.employee_mobility_settings
  FOR ALL TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND employee_id = public.resolve_current_employee_id()
    AND public.current_role_key() = 'employee_portal'
  )
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND employee_id = public.resolve_current_employee_id()
    AND public.current_role_key() = 'employee_portal'
  );

-- Office: tenant-scoped read/write for personnel administration
DROP POLICY IF EXISTS employee_mobility_settings_office ON public.employee_mobility_settings;
CREATE POLICY employee_mobility_settings_office ON public.employee_mobility_settings
  FOR ALL TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND public.has_permission('office.employees.view')
  )
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND public.has_permission('office.employees.view')
  );

GRANT SELECT, INSERT, UPDATE ON public.employee_mobility_settings TO authenticated;

COMMENT ON TABLE public.employee_mobility_settings IS
  'Mitarbeiter-Mobilität: Verkehrsmittel und Standard-Routenpunkte für Google-Fahrzeit.';
COMMENT ON COLUMN public.employee_mobility_settings.transport_mode IS
  'car | transit | bicycle | escooter | walking';
COMMENT ON COLUMN public.employee_mobility_settings.route_start_type IS
  'Startpunkt zur nächsten Tour: home | office | last_assignment | custom';
COMMENT ON COLUMN public.employee_mobility_settings.route_end_type IS
  'Ziel nach Einsatz: home | office | custom';
