-- ==========================================================================
-- CareSuite+ — Migration 0121: CSV Import / Export (Klient:innen & Mitarbeitende)
-- ==========================================================================

CREATE TABLE IF NOT EXISTS public.csv_import_logs (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id           UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  import_type       TEXT        NOT NULL CHECK (import_type IN ('clients', 'employees')),
  file_name         TEXT,
  file_size         BIGINT,
  total_rows        INT         NOT NULL DEFAULT 0,
  valid_rows        INT         NOT NULL DEFAULT 0,
  invalid_rows      INT         NOT NULL DEFAULT 0,
  imported_rows     INT         NOT NULL DEFAULT 0,
  skipped_rows      INT         NOT NULL DEFAULT 0,
  updated_rows      INT         NOT NULL DEFAULT 0,
  failed_rows       INT         NOT NULL DEFAULT 0,
  status            TEXT        NOT NULL CHECK (status IN (
    'uploaded', 'validated', 'failed_validation', 'imported',
    'partially_imported', 'failed', 'cancelled'
  )),
  raw_mapping       JSONB,
  validation_result JSONB,
  error_summary     TEXT,
  started_at        TIMESTAMPTZ,
  finished_at       TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_csv_import_logs_tenant ON public.csv_import_logs(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_csv_import_logs_user ON public.csv_import_logs(user_id);

CREATE TABLE IF NOT EXISTS public.csv_import_row_errors (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  import_log_id  UUID        NOT NULL REFERENCES public.csv_import_logs(id) ON DELETE CASCADE,
  tenant_id      UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  row_number     INT         NOT NULL,
  field_name     TEXT,
  error_code     TEXT,
  error_message  TEXT,
  raw_value      TEXT,
  severity       TEXT        NOT NULL DEFAULT 'error' CHECK (severity IN ('info', 'warning', 'error')),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_csv_import_row_errors_log ON public.csv_import_row_errors(import_log_id);

CREATE TABLE IF NOT EXISTS public.csv_export_logs (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id             UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  export_type         TEXT        NOT NULL CHECK (export_type IN ('clients', 'employees')),
  filters             JSONB,
  number_of_records   INT         NOT NULL DEFAULT 0,
  file_name           TEXT,
  ip_address          TEXT,
  user_agent          TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_csv_export_logs_tenant ON public.csv_export_logs(tenant_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.csv_import_templates (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id          UUID        REFERENCES public.tenants(id) ON DELETE CASCADE,
  template_type      TEXT        NOT NULL CHECK (template_type IN ('clients', 'employees')),
  template_name      TEXT        NOT NULL,
  description        TEXT,
  columns            JSONB       NOT NULL DEFAULT '[]'::jsonb,
  required_fields    JSONB       NOT NULL DEFAULT '[]'::jsonb,
  example_row        JSONB,
  version            TEXT        NOT NULL DEFAULT '1.0',
  is_system_template BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_csv_import_templates_type ON public.csv_import_templates(template_type);

-- RLS
ALTER TABLE public.csv_import_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.csv_import_row_errors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.csv_export_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.csv_import_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS csv_import_logs_select ON public.csv_import_logs;
CREATE POLICY csv_import_logs_select ON public.csv_import_logs
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND (
      public.has_permission('tenant.settings.csv.logs.view')
      OR public.is_tenant_admin()
    )
  );

DROP POLICY IF EXISTS csv_import_logs_insert ON public.csv_import_logs;
CREATE POLICY csv_import_logs_insert ON public.csv_import_logs
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND user_id = auth.uid()
    AND (
      (import_type = 'clients' AND public.has_permission('tenant.settings.csv.import.clients'))
      OR (import_type = 'employees' AND public.has_permission('tenant.settings.csv.import.employees'))
      OR public.is_tenant_admin()
    )
  );

DROP POLICY IF EXISTS csv_import_row_errors_select ON public.csv_import_row_errors;
CREATE POLICY csv_import_row_errors_select ON public.csv_import_row_errors
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND (
      public.has_permission('tenant.settings.csv.logs.view')
      OR public.is_tenant_admin()
    )
  );

DROP POLICY IF EXISTS csv_import_row_errors_insert ON public.csv_import_row_errors;
CREATE POLICY csv_import_row_errors_insert ON public.csv_import_row_errors
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND (
      public.has_permission('tenant.settings.csv.import.clients')
      OR public.has_permission('tenant.settings.csv.import.employees')
      OR public.is_tenant_admin()
    )
  );

DROP POLICY IF EXISTS csv_export_logs_select ON public.csv_export_logs;
CREATE POLICY csv_export_logs_select ON public.csv_export_logs
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND (
      public.has_permission('tenant.settings.csv.logs.view')
      OR public.is_tenant_admin()
    )
  );

DROP POLICY IF EXISTS csv_export_logs_insert ON public.csv_export_logs;
CREATE POLICY csv_export_logs_insert ON public.csv_export_logs
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND user_id = auth.uid()
    AND (
      (export_type = 'clients' AND public.has_permission('tenant.settings.csv.export.clients'))
      OR (export_type = 'employees' AND public.has_permission('tenant.settings.csv.export.employees'))
      OR public.is_tenant_admin()
    )
  );

DROP POLICY IF EXISTS csv_import_templates_select ON public.csv_import_templates;
CREATE POLICY csv_import_templates_select ON public.csv_import_templates
  FOR SELECT TO authenticated
  USING (
    is_system_template = TRUE
    OR tenant_id = public.current_tenant_id()
  );

GRANT SELECT, INSERT ON public.csv_import_logs TO authenticated;
GRANT SELECT, INSERT ON public.csv_import_row_errors TO authenticated;
GRANT SELECT, INSERT ON public.csv_export_logs TO authenticated;
GRANT SELECT ON public.csv_import_templates TO authenticated;

-- Permissions seed
INSERT INTO public.role_permissions (role_id, permission_key)
SELECT r.id, p.key
FROM public.roles r
CROSS JOIN (
  VALUES
    ('tenant.settings.csv.view'),
    ('tenant.settings.csv.import.clients'),
    ('tenant.settings.csv.export.clients'),
    ('tenant.settings.csv.import.employees'),
    ('tenant.settings.csv.export.employees'),
    ('tenant.settings.csv.logs.view'),
    ('tenant.settings.csv.templates.download'),
    ('office.employees.view_sensitive')
) AS p(key)
WHERE r.key IN (
  'business_admin',
  'business_manager',
  'owner',
  'admin',
  'management',
  'geschaeftsfuehrung',
  'office'
)
ON CONFLICT (role_id, permission_key) DO NOTHING;

-- office_lead / team_lead: view + export + logs only
INSERT INTO public.role_permissions (role_id, permission_key)
SELECT r.id, p.key
FROM public.roles r
CROSS JOIN (
  VALUES
    ('tenant.settings.csv.view'),
    ('tenant.settings.csv.export.clients'),
    ('tenant.settings.csv.export.employees'),
    ('tenant.settings.csv.logs.view'),
    ('tenant.settings.csv.templates.download')
) AS p(key)
WHERE r.key IN ('team_lead', 'pdl', 'planning')
ON CONFLICT (role_id, permission_key) DO NOTHING;
