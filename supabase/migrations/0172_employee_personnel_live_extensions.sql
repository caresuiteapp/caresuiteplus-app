-- ==========================================================================
-- CareSuite+ — Migration 0172: Employee Personalakte live extensions
-- Home-office override, personnel audit log, grants for live Personalakte.
-- Work materials reuse inventory_assignments (0135).
-- ==========================================================================

-- --------------------------------------------------------------------------
-- 1. employee_work_settings — per-employee Homeoffice override
--    home_office_enabled NULL = derive from role permissions
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.employee_work_settings (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  employee_id         UUID        NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  home_office_enabled BOOLEAN,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, employee_id)
);

CREATE INDEX IF NOT EXISTS idx_employee_work_settings_tenant_employee
  ON public.employee_work_settings (tenant_id, employee_id);

-- --------------------------------------------------------------------------
-- 2. employee_audit_events — Personalakte Verlauf (if not yet applied via 0132)
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.employee_audit_events (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  employee_id     UUID        NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  action          TEXT        NOT NULL,
  actor_id        UUID,
  actor_role      TEXT,
  summary         TEXT        NOT NULL,
  field_changes   JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_employee_audit_events_tenant_employee
  ON public.employee_audit_events (tenant_id, employee_id, created_at DESC);

-- --------------------------------------------------------------------------
-- updated_at triggers
-- --------------------------------------------------------------------------
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['employee_work_settings', 'employee_audit_events']
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS set_%I_updated_at ON public.%I', tbl, tbl);
    EXECUTE format(
      'CREATE TRIGGER set_%I_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()',
      tbl, tbl
    );
  END LOOP;
END $$;

-- --------------------------------------------------------------------------
-- RLS
-- --------------------------------------------------------------------------
ALTER TABLE public.employee_work_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_audit_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS employee_work_settings_tenant ON public.employee_work_settings;
CREATE POLICY employee_work_settings_tenant ON public.employee_work_settings
  FOR ALL TO authenticated
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS employee_audit_events_tenant ON public.employee_audit_events;
CREATE POLICY employee_audit_events_tenant ON public.employee_audit_events
  FOR ALL TO authenticated
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

-- --------------------------------------------------------------------------
-- GRANTs
-- --------------------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE ON public.employee_work_settings TO authenticated;
GRANT SELECT, INSERT ON public.employee_audit_events TO authenticated;

COMMENT ON TABLE public.employee_work_settings IS 'Personalakte — Homeoffice-Zeiterfassung Override pro Mitarbeiter';
COMMENT ON TABLE public.employee_audit_events IS 'Personalakte — Audit-Verlauf (append-only via App)';
