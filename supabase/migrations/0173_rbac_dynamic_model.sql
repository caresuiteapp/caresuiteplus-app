-- ==========================================================================
-- CareSuite+ — Migration 0173: Dynamic RBAC model (Rollen & Rechte expansion)
-- permission_catalog, role_templates, assignments, overrides, scopes, audit
-- ==========================================================================

-- --------------------------------------------------------------------------
-- 1. permission_catalog — canonical permission metadata for UI + enforcement
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.permission_catalog (
  key             TEXT        PRIMARY KEY,
  module          TEXT        NOT NULL,
  category        TEXT        NOT NULL DEFAULT 'general',
  label           TEXT        NOT NULL,
  description     TEXT,
  risk_level      TEXT        NOT NULL DEFAULT 'low'
    CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
  requires_audit  BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_permission_catalog_module
  ON public.permission_catalog (module, category);

-- --------------------------------------------------------------------------
-- 2. role_templates — system + tenant-scoped role definitions
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.role_templates (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID        REFERENCES public.tenants(id) ON DELETE CASCADE,
  role_key        TEXT        NOT NULL,
  name            TEXT        NOT NULL,
  description     TEXT,
  level           INTEGER     NOT NULL DEFAULT 0,
  is_system_role  BOOLEAN     NOT NULL DEFAULT FALSE,
  is_editable     BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_role_templates_system_role_key
  ON public.role_templates (role_key)
  WHERE tenant_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_role_templates_tenant_role_key
  ON public.role_templates (tenant_id, role_key)
  WHERE tenant_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_role_templates_tenant
  ON public.role_templates (tenant_id);

-- --------------------------------------------------------------------------
-- 3. role_template_permissions
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.role_template_permissions (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  role_template_id UUID       NOT NULL REFERENCES public.role_templates(id) ON DELETE CASCADE,
  permission_key  TEXT        NOT NULL REFERENCES public.permission_catalog(key) ON DELETE CASCADE,
  allowed         BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (role_template_id, permission_key)
);

CREATE INDEX IF NOT EXISTS idx_role_template_permissions_template
  ON public.role_template_permissions (role_template_id);

-- --------------------------------------------------------------------------
-- 4. employee_role_assignments — multi-role support
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.employee_role_assignments (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  employee_id     UUID        NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  role_template_id UUID        REFERENCES public.role_templates(id) ON DELETE CASCADE,
  role_key        TEXT,
  is_primary      BOOLEAN     NOT NULL DEFAULT FALSE,
  assigned_by     UUID,
  assigned_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (role_template_id IS NOT NULL OR role_key IS NOT NULL)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_employee_role_assignments_template
  ON public.employee_role_assignments (tenant_id, employee_id, role_template_id)
  WHERE role_template_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_employee_role_assignments_role_key
  ON public.employee_role_assignments (tenant_id, employee_id, role_key)
  WHERE role_key IS NOT NULL AND role_template_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_employee_role_assignments_employee
  ON public.employee_role_assignments (tenant_id, employee_id);

-- --------------------------------------------------------------------------
-- 5. employee_permission_overrides — Sonderrechte
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.employee_permission_overrides (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  employee_id     UUID        NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  permission_key  TEXT        NOT NULL REFERENCES public.permission_catalog(key) ON DELETE CASCADE,
  allowed         BOOLEAN     NOT NULL,
  reason          TEXT,
  valid_from      TIMESTAMPTZ,
  valid_until     TIMESTAMPTZ,
  created_by      UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, employee_id, permission_key)
);

CREATE INDEX IF NOT EXISTS idx_employee_permission_overrides_employee
  ON public.employee_permission_overrides (tenant_id, employee_id);

-- --------------------------------------------------------------------------
-- 6. employee_data_scopes
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.employee_data_scopes (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  employee_id     UUID        NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  module          TEXT        NOT NULL,
  scope_type      TEXT        NOT NULL,
  scope_value     TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_employee_data_scopes_employee
  ON public.employee_data_scopes (tenant_id, employee_id, module);

-- --------------------------------------------------------------------------
-- 7. permission_audit_log — RBAC change audit (separate from employee_audit_events)
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.permission_audit_log (
  id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  actor_id                UUID,
  actor_role              TEXT,
  target_employee_id      UUID        REFERENCES public.employees(id) ON DELETE SET NULL,
  target_role_template_id UUID        REFERENCES public.role_templates(id) ON DELETE SET NULL,
  action                  TEXT        NOT NULL,
  old_value               JSONB,
  new_value               JSONB,
  reason                  TEXT,
  ip_address              TEXT,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_permission_audit_log_tenant_created
  ON public.permission_audit_log (tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_permission_audit_log_target_employee
  ON public.permission_audit_log (tenant_id, target_employee_id, created_at DESC);

-- --------------------------------------------------------------------------
-- 8. employee_work_settings — time tracking mode
-- --------------------------------------------------------------------------
ALTER TABLE public.employee_work_settings
  ADD COLUMN IF NOT EXISTS time_tracking_mode TEXT;

COMMENT ON COLUMN public.employee_work_settings.time_tracking_mode IS
  'none | field | homeoffice | hybrid | office — overrides role-derived default';

-- --------------------------------------------------------------------------
-- updated_at triggers
-- --------------------------------------------------------------------------
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'permission_catalog',
    'role_templates',
    'role_template_permissions',
    'employee_role_assignments',
    'employee_permission_overrides',
    'employee_data_scopes'
  ]
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
ALTER TABLE public.permission_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_template_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_role_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_permission_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_data_scopes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permission_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS permission_catalog_read ON public.permission_catalog;
CREATE POLICY permission_catalog_read ON public.permission_catalog
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS role_templates_tenant ON public.role_templates;
CREATE POLICY role_templates_tenant ON public.role_templates
  FOR ALL TO authenticated
  USING (tenant_id IS NULL OR tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id IS NULL OR tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS role_template_permissions_via_template ON public.role_template_permissions;
CREATE POLICY role_template_permissions_via_template ON public.role_template_permissions
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.role_templates rt
      WHERE rt.id = role_template_id
        AND (rt.tenant_id IS NULL OR rt.tenant_id = public.current_tenant_id())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.role_templates rt
      WHERE rt.id = role_template_id
        AND (rt.tenant_id IS NULL OR rt.tenant_id = public.current_tenant_id())
    )
  );

DROP POLICY IF EXISTS employee_role_assignments_tenant ON public.employee_role_assignments;
CREATE POLICY employee_role_assignments_tenant ON public.employee_role_assignments
  FOR ALL TO authenticated
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS employee_permission_overrides_tenant ON public.employee_permission_overrides;
CREATE POLICY employee_permission_overrides_tenant ON public.employee_permission_overrides
  FOR ALL TO authenticated
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS employee_data_scopes_tenant ON public.employee_data_scopes;
CREATE POLICY employee_data_scopes_tenant ON public.employee_data_scopes
  FOR ALL TO authenticated
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS permission_audit_log_tenant ON public.permission_audit_log;
CREATE POLICY permission_audit_log_tenant ON public.permission_audit_log
  FOR ALL TO authenticated
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

-- --------------------------------------------------------------------------
-- GRANTs
-- --------------------------------------------------------------------------
GRANT SELECT ON public.permission_catalog TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.role_templates TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.role_template_permissions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.employee_role_assignments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.employee_permission_overrides TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.employee_data_scopes TO authenticated;
GRANT SELECT, INSERT ON public.permission_audit_log TO authenticated;

COMMENT ON TABLE public.permission_catalog IS 'RBAC — Katalog aller Berechtigungsschlüssel mit UI-Labels';
COMMENT ON TABLE public.role_templates IS 'RBAC — System- und Mandantenrollen-Vorlagen';
COMMENT ON TABLE public.employee_role_assignments IS 'RBAC — Mehrfach-Rollenzuweisung pro Mitarbeiter';
COMMENT ON TABLE public.employee_permission_overrides IS 'RBAC — Individuelle Sonderrechte';
COMMENT ON TABLE public.permission_audit_log IS 'RBAC — Audit-Log für Rechteänderungen';
