-- ==========================================================================
-- CareSuite+ — Migration 0164: Assist Catalog & Template Foundation
-- C.ASSIST-OFFICE-TEMPLATE.1 — hierarchisches Katalogmodell für Office/Assist
-- Keine destruktiven Befehle (DROP/TRUNCATE/destructive DELETE).
-- ==========================================================================

-- --------------------------------------------------------------------------
-- catalog_groups — übergeordnete Gruppen
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.catalog_groups (
  id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID          REFERENCES public.tenants(id) ON DELETE CASCADE,
  module_scope        TEXT          NOT NULL DEFAULT 'assist',
  group_key           TEXT          NOT NULL,
  name                TEXT          NOT NULL,
  description         TEXT,
  icon                TEXT,
  color               TEXT,
  sort_order          INTEGER       NOT NULL DEFAULT 0,
  is_system_default   BOOLEAN       NOT NULL DEFAULT FALSE,
  is_active           BOOLEAN       NOT NULL DEFAULT TRUE,
  created_by          UUID          REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_by          UUID          REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_catalog_groups_system_key
  ON public.catalog_groups (group_key)
  WHERE tenant_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_catalog_groups_tenant_key
  ON public.catalog_groups (tenant_id, group_key)
  WHERE tenant_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_catalog_groups_tenant_module
  ON public.catalog_groups (tenant_id, module_scope, sort_order);

COMMENT ON TABLE public.catalog_groups IS
  'Übergeordnete Kataloggruppen (Assist Einsatz, Neuaufnahme, …) — Migration 0164';

-- --------------------------------------------------------------------------
-- catalog_definitions — Katalog-Metadaten (Spec: catalogs)
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.catalog_definitions (
  id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID          REFERENCES public.tenants(id) ON DELETE CASCADE,
  group_id            UUID          REFERENCES public.catalog_groups(id) ON DELETE SET NULL,
  module_scope        TEXT          NOT NULL DEFAULT 'assist',
  catalog_key         TEXT          NOT NULL,
  name                TEXT          NOT NULL,
  description         TEXT,
  catalog_type        TEXT          NOT NULL DEFAULT 'single_select',
  selection_mode      TEXT          NOT NULL DEFAULT 'dropdown',
  visibility_scope    TEXT          NOT NULL DEFAULT 'assist',
  required_permission TEXT,
  is_system_default   BOOLEAN       NOT NULL DEFAULT FALSE,
  is_editable         BOOLEAN       NOT NULL DEFAULT TRUE,
  is_active           BOOLEAN       NOT NULL DEFAULT TRUE,
  sort_order          INTEGER       NOT NULL DEFAULT 0,
  created_by          UUID          REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_by          UUID          REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_catalog_definitions_system_key
  ON public.catalog_definitions (catalog_key)
  WHERE tenant_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_catalog_definitions_tenant_key
  ON public.catalog_definitions (tenant_id, catalog_key)
  WHERE tenant_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_catalog_definitions_group
  ON public.catalog_definitions (group_id, sort_order);

COMMENT ON TABLE public.catalog_definitions IS
  'Katalog-Metadaten (Spec catalogs) — Migration 0164; nicht Akademie-catalogs';

-- --------------------------------------------------------------------------
-- catalog_items — Auswahlwerte, Bausteine, Aufgabenpakete
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.catalog_items (
  id                          UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                   UUID          REFERENCES public.tenants(id) ON DELETE CASCADE,
  catalog_id                  UUID          NOT NULL REFERENCES public.catalog_definitions(id) ON DELETE CASCADE,
  parent_item_id              UUID          REFERENCES public.catalog_items(id) ON DELETE CASCADE,
  item_key                    TEXT          NOT NULL,
  label                       TEXT          NOT NULL,
  short_label                 TEXT,
  description                 TEXT,
  helper_text                 TEXT,
  tags                        JSONB         NOT NULL DEFAULT '[]'::jsonb,
  icon                        TEXT,
  color                       TEXT,
  sort_order                  INTEGER       NOT NULL DEFAULT 0,
  is_system_default           BOOLEAN       NOT NULL DEFAULT FALSE,
  is_active                   BOOLEAN       NOT NULL DEFAULT TRUE,
  is_billable_relevant        BOOLEAN       NOT NULL DEFAULT FALSE,
  is_documentation_required   BOOLEAN       NOT NULL DEFAULT FALSE,
  is_signature_relevant       BOOLEAN       NOT NULL DEFAULT FALSE,
  is_risk_relevant            BOOLEAN       NOT NULL DEFAULT FALSE,
  default_duration_minutes    INTEGER,
  default_price_hint          NUMERIC(12, 2),
  default_unit                TEXT,
  payload_json                JSONB         NOT NULL DEFAULT '{}'::jsonb,
  created_by                  UUID          REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_by                  UUID          REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at                  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_catalog_items_system_key
  ON public.catalog_items (catalog_id, item_key)
  WHERE tenant_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_catalog_items_tenant_key
  ON public.catalog_items (tenant_id, catalog_id, item_key)
  WHERE tenant_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_catalog_items_catalog_sort
  ON public.catalog_items (catalog_id, sort_order);

CREATE INDEX IF NOT EXISTS idx_catalog_items_parent
  ON public.catalog_items (parent_item_id, sort_order)
  WHERE parent_item_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_catalog_items_payload_gin
  ON public.catalog_items USING GIN (payload_json);

COMMENT ON TABLE public.catalog_items IS
  'Katalog-Einträge inkl. Aufgabenpakete und Child-Tasks — Migration 0164';

-- --------------------------------------------------------------------------
-- catalog_item_deactivations — Mandant deaktiviert Systemeinträge
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.catalog_item_deactivations (
  tenant_id           UUID          NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  catalog_item_id     UUID          NOT NULL REFERENCES public.catalog_items(id) ON DELETE CASCADE,
  deactivated_by      UUID          REFERENCES public.profiles(id) ON DELETE SET NULL,
  deactivated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  PRIMARY KEY (tenant_id, catalog_item_id)
);

COMMENT ON TABLE public.catalog_item_deactivations IS
  'Mandant-spezifische Deaktivierung von System-Katalogeinträgen — Migration 0164';

-- --------------------------------------------------------------------------
-- template_bindings — Vorlagen/Kataloge an UI-Stellen binden
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.template_bindings (
  id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID          REFERENCES public.tenants(id) ON DELETE CASCADE,
  template_id         UUID          REFERENCES public.templates(id) ON DELETE CASCADE,
  catalog_id          UUID          REFERENCES public.catalog_definitions(id) ON DELETE CASCADE,
  target_module       TEXT          NOT NULL DEFAULT 'assist',
  target_area         TEXT          NOT NULL,
  target_component    TEXT,
  target_field        TEXT,
  binding_type        TEXT          NOT NULL DEFAULT 'catalog',
  is_required         BOOLEAN       NOT NULL DEFAULT FALSE,
  is_default          BOOLEAN       NOT NULL DEFAULT FALSE,
  sort_order          INTEGER       NOT NULL DEFAULT 0,
  conditions_json     JSONB         NOT NULL DEFAULT '{}'::jsonb,
  created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  CONSTRAINT template_bindings_ref_check CHECK (
    template_id IS NOT NULL OR catalog_id IS NOT NULL
  )
);

CREATE INDEX IF NOT EXISTS idx_template_bindings_tenant_area
  ON public.template_bindings (tenant_id, target_module, target_area, sort_order);

CREATE INDEX IF NOT EXISTS idx_template_bindings_catalog
  ON public.template_bindings (catalog_id)
  WHERE catalog_id IS NOT NULL;

COMMENT ON TABLE public.template_bindings IS
  'Bindings Katalog/Vorlage → Assist/Office UI-Felder — Migration 0164';

-- --------------------------------------------------------------------------
-- catalog_audit_events — append-only Änderungsprotokoll
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.catalog_audit_events (
  id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID          REFERENCES public.tenants(id) ON DELETE CASCADE,
  entity_type         TEXT          NOT NULL,
  entity_id           UUID          NOT NULL,
  action              TEXT          NOT NULL,
  module_scope        TEXT          NOT NULL DEFAULT 'assist',
  actor_user_id       UUID          REFERENCES public.profiles(id) ON DELETE SET NULL,
  old_value_json      JSONB,
  new_value_json      JSONB,
  summary             TEXT,
  ip_address          TEXT,
  user_agent          TEXT,
  created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_catalog_audit_events_tenant_created
  ON public.catalog_audit_events (tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_catalog_audit_events_entity
  ON public.catalog_audit_events (entity_type, entity_id, created_at DESC);

COMMENT ON TABLE public.catalog_audit_events IS
  'Audit-Log für Katalog-/Vorlagenänderungen (append-only) — Migration 0164';

-- --------------------------------------------------------------------------
-- templates — Erweiterung für template_area / Schemas
-- --------------------------------------------------------------------------
ALTER TABLE public.templates
  ADD COLUMN IF NOT EXISTS template_area TEXT,
  ADD COLUMN IF NOT EXISTS field_schema_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS rules_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS version_number INTEGER NOT NULL DEFAULT 1;

-- --------------------------------------------------------------------------
-- tenant_template_settings — Leistungsnachweis-Einstellungen
-- --------------------------------------------------------------------------
ALTER TABLE public.tenant_template_settings
  ADD COLUMN IF NOT EXISTS assist_proof_settings_json JSONB NOT NULL DEFAULT '{}'::jsonb;

-- --------------------------------------------------------------------------
-- assist_visits — Katalog-Felder
-- --------------------------------------------------------------------------
ALTER TABLE public.assist_visits
  ADD COLUMN IF NOT EXISTS subject_key TEXT,
  ADD COLUMN IF NOT EXISTS assignment_type_key TEXT,
  ADD COLUMN IF NOT EXISTS service_category_key TEXT,
  ADD COLUMN IF NOT EXISTS task_package_id UUID REFERENCES public.catalog_items(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS billing_budget_source_key TEXT,
  ADD COLUMN IF NOT EXISTS priority_key TEXT,
  ADD COLUMN IF NOT EXISTS recurrence_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS documentation_template_key TEXT,
  ADD COLUMN IF NOT EXISTS proof_template_key TEXT,
  ADD COLUMN IF NOT EXISTS risk_flag_keys JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS catalog_snapshot_json JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_assist_visits_subject_key
  ON public.assist_visits (tenant_id, subject_key)
  WHERE subject_key IS NOT NULL;

-- --------------------------------------------------------------------------
-- assist_visit_tasks — erweiterte Task-Metadaten
-- --------------------------------------------------------------------------
ALTER TABLE public.assist_visit_tasks
  ADD COLUMN IF NOT EXISTS catalog_item_id UUID REFERENCES public.catalog_items(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS item_key TEXT,
  ADD COLUMN IF NOT EXISTS not_completed_reason_key TEXT,
  ADD COLUMN IF NOT EXISTS note TEXT,
  ADD COLUMN IF NOT EXISTS is_optional BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS payload_json JSONB NOT NULL DEFAULT '{}'::jsonb;

-- --------------------------------------------------------------------------
-- RLS
-- --------------------------------------------------------------------------
ALTER TABLE public.catalog_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.catalog_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.catalog_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.catalog_item_deactivations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.template_bindings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.catalog_audit_events ENABLE ROW LEVEL SECURITY;

-- catalog_groups
DROP POLICY IF EXISTS catalog_groups_select ON public.catalog_groups;
CREATE POLICY catalog_groups_select ON public.catalog_groups
  FOR SELECT TO authenticated
  USING (tenant_id IS NULL OR tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS catalog_groups_insert ON public.catalog_groups;
CREATE POLICY catalog_groups_insert ON public.catalog_groups
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND is_system_default = FALSE
    AND public.has_permission('office.catalogs.edit')
  );

DROP POLICY IF EXISTS catalog_groups_update ON public.catalog_groups;
CREATE POLICY catalog_groups_update ON public.catalog_groups
  FOR UPDATE TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND is_system_default = FALSE
    AND public.has_permission('office.catalogs.edit')
  )
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND is_system_default = FALSE
  );

-- catalog_definitions
DROP POLICY IF EXISTS catalog_definitions_select ON public.catalog_definitions;
CREATE POLICY catalog_definitions_select ON public.catalog_definitions
  FOR SELECT TO authenticated
  USING (tenant_id IS NULL OR tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS catalog_definitions_insert ON public.catalog_definitions;
CREATE POLICY catalog_definitions_insert ON public.catalog_definitions
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND is_system_default = FALSE
    AND public.has_permission('office.catalogs.edit')
  );

DROP POLICY IF EXISTS catalog_definitions_update ON public.catalog_definitions;
CREATE POLICY catalog_definitions_update ON public.catalog_definitions
  FOR UPDATE TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND is_system_default = FALSE
    AND public.has_permission('office.catalogs.edit')
  )
  WITH CHECK (tenant_id = public.current_tenant_id() AND is_system_default = FALSE);

-- catalog_items
DROP POLICY IF EXISTS catalog_items_select ON public.catalog_items;
CREATE POLICY catalog_items_select ON public.catalog_items
  FOR SELECT TO authenticated
  USING (tenant_id IS NULL OR tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS catalog_items_insert ON public.catalog_items;
CREATE POLICY catalog_items_insert ON public.catalog_items
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND is_system_default = FALSE
    AND public.has_permission('office.catalogs.edit')
  );

DROP POLICY IF EXISTS catalog_items_update ON public.catalog_items;
CREATE POLICY catalog_items_update ON public.catalog_items
  FOR UPDATE TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND is_system_default = FALSE
    AND public.has_permission('office.catalogs.edit')
  )
  WITH CHECK (tenant_id = public.current_tenant_id() AND is_system_default = FALSE);

-- catalog_item_deactivations
DROP POLICY IF EXISTS catalog_item_deactivations_select ON public.catalog_item_deactivations;
CREATE POLICY catalog_item_deactivations_select ON public.catalog_item_deactivations
  FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS catalog_item_deactivations_insert ON public.catalog_item_deactivations;
CREATE POLICY catalog_item_deactivations_insert ON public.catalog_item_deactivations
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND public.has_permission('office.catalogs.edit')
  );

DROP POLICY IF EXISTS catalog_item_deactivations_delete ON public.catalog_item_deactivations;
CREATE POLICY catalog_item_deactivations_delete ON public.catalog_item_deactivations
  FOR DELETE TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND public.has_permission('office.catalogs.edit')
  );

-- template_bindings
DROP POLICY IF EXISTS template_bindings_select ON public.template_bindings;
CREATE POLICY template_bindings_select ON public.template_bindings
  FOR SELECT TO authenticated
  USING (tenant_id IS NULL OR tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS template_bindings_write ON public.template_bindings;
CREATE POLICY template_bindings_write ON public.template_bindings
  FOR ALL TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND public.has_permission('office.catalogs.edit')
  )
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND public.has_permission('office.catalogs.edit')
  );

-- catalog_audit_events — append-only
DROP POLICY IF EXISTS catalog_audit_events_select ON public.catalog_audit_events;
CREATE POLICY catalog_audit_events_select ON public.catalog_audit_events
  FOR SELECT TO authenticated
  USING (tenant_id IS NULL OR tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS catalog_audit_events_insert ON public.catalog_audit_events;
CREATE POLICY catalog_audit_events_insert ON public.catalog_audit_events
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.current_tenant_id());

-- --------------------------------------------------------------------------
-- GRANTs
-- --------------------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE ON public.catalog_groups TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.catalog_definitions TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.catalog_items TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.catalog_item_deactivations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.template_bindings TO authenticated;
GRANT SELECT, INSERT ON public.catalog_audit_events TO authenticated;
