-- ==========================================================================
-- CareSuite+ — Migration 0014: Vorlagen, Kataloge & Dropdowns (Paket F)
-- Status: VORBEREITET — manuell via `supabase db push` oder SQL Editor
-- Keine destruktiven Befehle (DROP/TRUNCATE/DELETE auf Produktionsdaten).
-- ==========================================================================

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

ALTER TABLE public.templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.template_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.template_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.catalog_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.template_usage_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_template_settings ENABLE ROW LEVEL SECURITY;

-- Mandant sieht Systemvorlagen (tenant_id NULL) + eigene Vorlagen
DROP POLICY IF EXISTS "templates_select_tenant" ON public.templates;
CREATE POLICY "templates_select_tenant"
  ON public.templates FOR SELECT
  USING (
    tenant_id IS NULL
    OR tenant_id = public.current_tenant_id()
  );

DROP POLICY IF EXISTS "templates_insert_tenant" ON public.templates;
CREATE POLICY "templates_insert_tenant"
  ON public.templates FOR INSERT
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND scope = 'tenant'
  );

DROP POLICY IF EXISTS "templates_update_tenant" ON public.templates;
CREATE POLICY "templates_update_tenant"
  ON public.templates FOR UPDATE
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS "catalog_entries_select_tenant" ON public.catalog_entries;
CREATE POLICY "catalog_entries_select_tenant"
  ON public.catalog_entries FOR SELECT
  USING (
    tenant_id IS NULL
    OR tenant_id = public.current_tenant_id()
  );

DROP POLICY IF EXISTS "catalog_entries_insert_tenant" ON public.catalog_entries;
CREATE POLICY "catalog_entries_insert_tenant"
  ON public.catalog_entries FOR INSERT
  WITH CHECK (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS "catalog_entries_update_tenant" ON public.catalog_entries;
CREATE POLICY "catalog_entries_update_tenant"
  ON public.catalog_entries FOR UPDATE
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS "template_usage_logs_select_tenant" ON public.template_usage_logs;
CREATE POLICY "template_usage_logs_select_tenant"
  ON public.template_usage_logs FOR SELECT
  USING (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS "template_usage_logs_insert_tenant" ON public.template_usage_logs;
CREATE POLICY "template_usage_logs_insert_tenant"
  ON public.template_usage_logs FOR INSERT
  WITH CHECK (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS "tenant_template_settings_select" ON public.tenant_template_settings;
CREATE POLICY "tenant_template_settings_select"
  ON public.tenant_template_settings FOR SELECT
  USING (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS "tenant_template_settings_upsert" ON public.tenant_template_settings;
CREATE POLICY "tenant_template_settings_upsert"
  ON public.tenant_template_settings FOR ALL
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS "template_categories_select" ON public.template_categories;
CREATE POLICY "template_categories_select"
  ON public.template_categories FOR SELECT
  USING (
    tenant_id IS NULL
    OR tenant_id = public.current_tenant_id()
  );

DROP POLICY IF EXISTS "template_versions_select" ON public.template_versions;
CREATE POLICY "template_versions_select"
  ON public.template_versions FOR SELECT
  USING (
    template_id IN (
      SELECT id FROM public.templates
      WHERE tenant_id IS NULL OR tenant_id = public.current_tenant_id()
    )
  );

COMMENT ON TABLE public.templates IS 'CareSuite+ zentrale Vorlagen — System (tenant_id NULL) und Mandant';
COMMENT ON TABLE public.catalog_entries IS 'Dropdown-Katalogwerte für alle Module';
