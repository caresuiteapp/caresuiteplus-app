-- Office Modulzuordnungen: tables + RLS + GRANTs for live mode
-- Remote project lacked migration 0037; idempotent create + permission-based SELECT.

CREATE TABLE IF NOT EXISTS public.client_module_assignments (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  client_id             UUID        NOT NULL,
  module_key            TEXT        NOT NULL,
  assigned_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status                TEXT        NOT NULL DEFAULT 'prepared',
  primary_employee_id   UUID,
  notes                 TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.employee_module_assignments (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  employee_id     UUID        NOT NULL,
  module_key      TEXT        NOT NULL,
  role_in_module  TEXT        NOT NULL DEFAULT '',
  assigned_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status          TEXT        NOT NULL DEFAULT 'prepared',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.module_service_catalog (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  module_key        TEXT        NOT NULL,
  service_code      TEXT        NOT NULL,
  service_name      TEXT        NOT NULL,
  billing_category  TEXT        NOT NULL DEFAULT '',
  unit_price_cents  INTEGER     NOT NULL DEFAULT 0,
  status            TEXT        NOT NULL DEFAULT 'prepared',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.module_billing_sources (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  module_key        TEXT        NOT NULL,
  source_label      TEXT        NOT NULL,
  source_type       TEXT        NOT NULL DEFAULT 'office_invoice',
  linked_invoice_id UUID,
  status            TEXT        NOT NULL DEFAULT 'prepared',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.module_document_visibility (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  module_key      TEXT        NOT NULL,
  document_id     UUID        NOT NULL,
  document_title  TEXT        NOT NULL DEFAULT '',
  visibility      TEXT        NOT NULL DEFAULT 'module_only',
  status          TEXT        NOT NULL DEFAULT 'prepared',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.module_template_assignments (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  module_key        TEXT        NOT NULL,
  template_id       UUID        NOT NULL,
  template_name     TEXT        NOT NULL DEFAULT '',
  template_category TEXT        NOT NULL DEFAULT '',
  status            TEXT        NOT NULL DEFAULT 'prepared',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.module_permission_profiles (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  module_key   TEXT        NOT NULL,
  profile_name TEXT        NOT NULL,
  role_key     TEXT        NOT NULL,
  can_view     BOOLEAN     NOT NULL DEFAULT FALSE,
  can_edit     BOOLEAN     NOT NULL DEFAULT FALSE,
  can_export   BOOLEAN     NOT NULL DEFAULT FALSE,
  status       TEXT        NOT NULL DEFAULT 'prepared',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_client_module_assignments_tenant
  ON public.client_module_assignments (tenant_id, module_key, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_employee_module_assignments_tenant
  ON public.employee_module_assignments (tenant_id, module_key, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_module_service_catalog_tenant
  ON public.module_service_catalog (tenant_id, module_key);

CREATE INDEX IF NOT EXISTS idx_module_billing_sources_tenant
  ON public.module_billing_sources (tenant_id, module_key);

CREATE INDEX IF NOT EXISTS idx_module_document_visibility_tenant
  ON public.module_document_visibility (tenant_id, module_key);

CREATE INDEX IF NOT EXISTS idx_module_template_assignments_tenant
  ON public.module_template_assignments (tenant_id, module_key);

CREATE INDEX IF NOT EXISTS idx_module_permission_profiles_tenant
  ON public.module_permission_profiles (tenant_id, module_key);

ALTER TABLE public.client_module_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_module_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.module_service_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.module_billing_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.module_document_visibility ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.module_template_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.module_permission_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS client_module_assignments_tenant ON public.client_module_assignments;
DROP POLICY IF EXISTS client_module_assignments_select ON public.client_module_assignments;
CREATE POLICY client_module_assignments_select ON public.client_module_assignments
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND public.has_permission('office.access')
  );

DROP POLICY IF EXISTS employee_module_assignments_tenant ON public.employee_module_assignments;
DROP POLICY IF EXISTS employee_module_assignments_select ON public.employee_module_assignments;
CREATE POLICY employee_module_assignments_select ON public.employee_module_assignments
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND public.has_permission('office.access')
  );

DROP POLICY IF EXISTS module_service_catalog_tenant ON public.module_service_catalog;
DROP POLICY IF EXISTS module_service_catalog_select ON public.module_service_catalog;
CREATE POLICY module_service_catalog_select ON public.module_service_catalog
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND public.has_permission('office.access')
  );

DROP POLICY IF EXISTS module_billing_sources_tenant ON public.module_billing_sources;
DROP POLICY IF EXISTS module_billing_sources_select ON public.module_billing_sources;
CREATE POLICY module_billing_sources_select ON public.module_billing_sources
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND public.has_permission('office.access')
  );

DROP POLICY IF EXISTS module_document_visibility_tenant ON public.module_document_visibility;
DROP POLICY IF EXISTS module_document_visibility_select ON public.module_document_visibility;
CREATE POLICY module_document_visibility_select ON public.module_document_visibility
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND public.has_permission('office.access')
  );

DROP POLICY IF EXISTS module_template_assignments_tenant ON public.module_template_assignments;
DROP POLICY IF EXISTS module_template_assignments_select ON public.module_template_assignments;
CREATE POLICY module_template_assignments_select ON public.module_template_assignments
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND public.has_permission('office.access')
  );

DROP POLICY IF EXISTS module_permission_profiles_tenant ON public.module_permission_profiles;
DROP POLICY IF EXISTS module_permission_profiles_select ON public.module_permission_profiles;
CREATE POLICY module_permission_profiles_select ON public.module_permission_profiles
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND public.has_permission('office.access')
  );

GRANT SELECT ON public.client_module_assignments TO authenticated;
GRANT SELECT ON public.employee_module_assignments TO authenticated;
GRANT SELECT ON public.module_service_catalog TO authenticated;
GRANT SELECT ON public.module_billing_sources TO authenticated;
GRANT SELECT ON public.module_document_visibility TO authenticated;
GRANT SELECT ON public.module_template_assignments TO authenticated;
GRANT SELECT ON public.module_permission_profiles TO authenticated;

COMMENT ON TABLE public.client_module_assignments IS 'OfficeCore Klient:innen-Modulzuordnung';
COMMENT ON TABLE public.employee_module_assignments IS 'OfficeCore Mitarbeitende-Modulzuordnung';
COMMENT ON TABLE public.module_service_catalog IS 'Leistungskatalog je Fachmodul';
