-- ==========================================================================
-- CareSuite+ — Migration 0110: Message templates & catalog entries (Live)
-- Creates central templates + catalog_entries from Paket F (0014) if missing.
-- Seeds message_category catalog and default communication message templates.
-- Pattern: 0092_office_messaging_phase3.sql, 0014_templates_catalogs_and_dropdowns.sql
-- ==========================================================================

-- --------------------------------------------------------------------------
-- Core template tables (idempotent — from 0014)
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.template_categories (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID        REFERENCES public.tenants(id) ON DELETE CASCADE,
  key         TEXT        NOT NULL,
  label       TEXT        NOT NULL,
  module_key  TEXT        NOT NULL,
  sort_order  INT         NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.templates (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID        REFERENCES public.tenants(id) ON DELETE CASCADE,
  scope           TEXT        NOT NULL DEFAULT 'tenant'
    CHECK (scope IN ('system', 'tenant')),
  module_key      TEXT        NOT NULL,
  template_type   TEXT        NOT NULL,
  status          TEXT        NOT NULL DEFAULT 'draft'
    CHECK (status IN ('active', 'draft', 'archived', 'disabled')),
  title           TEXT        NOT NULL,
  description     TEXT,
  category_key    TEXT,
  content         TEXT        NOT NULL DEFAULT '',
  variables       JSONB       NOT NULL DEFAULT '[]'::jsonb,
  tags            JSONB       NOT NULL DEFAULT '[]'::jsonb,
  sort_order      INT         NOT NULL DEFAULT 0,
  is_default      BOOLEAN     NOT NULL DEFAULT FALSE,
  is_required     BOOLEAN     NOT NULL DEFAULT FALSE,
  created_by      UUID        REFERENCES public.profiles(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.template_versions (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id     UUID        NOT NULL REFERENCES public.templates(id) ON DELETE CASCADE,
  version_number  INT         NOT NULL DEFAULT 1,
  content         TEXT        NOT NULL,
  variables       JSONB       NOT NULL DEFAULT '[]'::jsonb,
  created_by      UUID        REFERENCES public.profiles(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.catalog_entries (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID        REFERENCES public.tenants(id) ON DELETE CASCADE,
  catalog_type  TEXT        NOT NULL,
  value_key     TEXT        NOT NULL,
  label         TEXT        NOT NULL,
  description   TEXT,
  module_key    TEXT        NOT NULL,
  is_system     BOOLEAN     NOT NULL DEFAULT FALSE,
  is_active     BOOLEAN     NOT NULL DEFAULT TRUE,
  sort_order    INT         NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.template_usage_logs (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  template_id   UUID        NOT NULL REFERENCES public.templates(id) ON DELETE CASCADE,
  module_key    TEXT        NOT NULL,
  context       TEXT,
  used_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.tenant_template_settings (
  tenant_id               UUID        PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
  allow_tenant_overrides  BOOLEAN     NOT NULL DEFAULT TRUE,
  default_locale          TEXT        NOT NULL DEFAULT 'de-DE',
  show_system_templates   BOOLEAN     NOT NULL DEFAULT TRUE,
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_templates_tenant_id ON public.templates(tenant_id);
CREATE INDEX IF NOT EXISTS idx_templates_module_key ON public.templates(module_key);
CREATE INDEX IF NOT EXISTS idx_templates_template_type ON public.templates(template_type);
CREATE INDEX IF NOT EXISTS idx_templates_status ON public.templates(status);
CREATE INDEX IF NOT EXISTS idx_catalog_entries_catalog_type ON public.catalog_entries(catalog_type);
CREATE INDEX IF NOT EXISTS idx_catalog_entries_tenant_id ON public.catalog_entries(tenant_id);
CREATE INDEX IF NOT EXISTS idx_template_usage_logs_tenant_id ON public.template_usage_logs(tenant_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_catalog_entries_system_unique
  ON public.catalog_entries (catalog_type, value_key)
  WHERE tenant_id IS NULL;

-- --------------------------------------------------------------------------
-- RLS + grants (Live pattern)
-- --------------------------------------------------------------------------
ALTER TABLE public.templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.template_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.template_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.catalog_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.template_usage_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_template_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS templates_select_tenant ON public.templates;
CREATE POLICY templates_select_tenant ON public.templates
  FOR SELECT TO authenticated
  USING (tenant_id IS NULL OR tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS templates_insert_tenant ON public.templates;
CREATE POLICY templates_insert_tenant ON public.templates
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.current_tenant_id() AND scope = 'tenant');

DROP POLICY IF EXISTS templates_update_tenant ON public.templates;
CREATE POLICY templates_update_tenant ON public.templates
  FOR UPDATE TO authenticated
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS catalog_entries_select_tenant ON public.catalog_entries;
CREATE POLICY catalog_entries_select_tenant ON public.catalog_entries
  FOR SELECT TO authenticated
  USING (tenant_id IS NULL OR tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS catalog_entries_insert_tenant ON public.catalog_entries;
CREATE POLICY catalog_entries_insert_tenant ON public.catalog_entries
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS catalog_entries_update_tenant ON public.catalog_entries;
CREATE POLICY catalog_entries_update_tenant ON public.catalog_entries
  FOR UPDATE TO authenticated
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS template_usage_logs_select_tenant ON public.template_usage_logs;
CREATE POLICY template_usage_logs_select_tenant ON public.template_usage_logs
  FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS template_usage_logs_insert_tenant ON public.template_usage_logs;
CREATE POLICY template_usage_logs_insert_tenant ON public.template_usage_logs
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS tenant_template_settings_select ON public.tenant_template_settings;
CREATE POLICY tenant_template_settings_select ON public.tenant_template_settings
  FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS tenant_template_settings_upsert ON public.tenant_template_settings;
CREATE POLICY tenant_template_settings_upsert ON public.tenant_template_settings
  FOR ALL TO authenticated
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS template_categories_select ON public.template_categories;
CREATE POLICY template_categories_select ON public.template_categories
  FOR SELECT TO authenticated
  USING (tenant_id IS NULL OR tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS template_versions_select ON public.template_versions;
CREATE POLICY template_versions_select ON public.template_versions
  FOR SELECT TO authenticated
  USING (
    template_id IN (
      SELECT id FROM public.templates
      WHERE tenant_id IS NULL OR tenant_id = public.current_tenant_id()
    )
  );

GRANT SELECT, INSERT, UPDATE ON public.templates TO authenticated;
GRANT SELECT ON public.template_versions TO authenticated;
GRANT SELECT ON public.template_categories TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.catalog_entries TO authenticated;
GRANT SELECT, INSERT ON public.template_usage_logs TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.tenant_template_settings TO authenticated;

-- --------------------------------------------------------------------------
-- System seeds: message_category + communication message templates
-- --------------------------------------------------------------------------
INSERT INTO public.catalog_entries (
  id, tenant_id, catalog_type, value_key, label, module_key, is_system, is_active, sort_order
) VALUES
  ('b0000001-0001-4001-8001-000000000001', NULL, 'message_category', 'intern', 'Intern', 'communication', TRUE, TRUE, 1),
  ('b0000001-0001-4001-8001-000000000002', NULL, 'message_category', 'klient', 'Klient:in', 'communication', TRUE, TRUE, 2),
  ('b0000001-0001-4001-8001-000000000003', NULL, 'message_category', 'mitarbeiter', 'Mitarbeiter:in', 'communication', TRUE, TRUE, 3)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.templates (
  id, tenant_id, scope, module_key, template_type, status, title, content, is_default, sort_order, category_key
) VALUES
  (
    'a0000001-0001-4001-8001-000000000001',
    NULL, 'system', 'communication', 'message', 'active',
    'Standardantwort',
    'Guten Tag {{clientName}}, vielen Dank für Ihre Nachricht. Wir melden uns zeitnah bei Ihnen.',
    TRUE, 1, 'intern'
  ),
  (
    'a0000001-0001-4001-8001-000000000002',
    NULL, 'system', 'communication', 'message', 'active',
    'Terminbestätigung',
    'Ihr Termin am {{date}} um {{time}} ist bestätigt. Bei Rückfragen erreichen Sie uns unter {{phone}}.',
    FALSE, 2, 'klient'
  ),
  (
    'a0000001-0001-4001-8001-000000000003',
    NULL, 'system', 'communication', 'message', 'active',
    'Team-Info',
    'Interne Information: {{info}} — {{employeeName}}, {{date}}.',
    FALSE, 3, 'mitarbeiter'
  )
ON CONFLICT (id) DO NOTHING;

COMMENT ON TABLE public.templates IS 'CareSuite+ zentrale Vorlagen — System (tenant_id NULL) und Mandant';
COMMENT ON TABLE public.catalog_entries IS 'Dropdown-Katalogwerte für alle Module';
