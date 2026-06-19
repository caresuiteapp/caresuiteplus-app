-- ==========================================================================
-- CareSuite+ — Migration 0099: Adaptive Klient:innenportal Engine
-- Extends client_module_assignments, portal feature matrix, widget registry,
-- visibility rules, and portal-user RLS for module assignments.
-- ==========================================================================

-- Extend existing client_module_assignments for portal engine semantics
ALTER TABLE public.client_module_assignments
  ADD COLUMN IF NOT EXISTS is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_active  BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS assigned_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Backfill is_active from legacy status column when present
UPDATE public.client_module_assignments
SET is_active = (status IS DISTINCT FROM 'inactive' AND status IS DISTINCT FROM 'deactivated')
WHERE is_active IS TRUE AND status IN ('inactive', 'deactivated');

UPDATE public.client_module_assignments
SET is_primary = TRUE
WHERE is_primary = FALSE
  AND id IN (
    SELECT DISTINCT ON (tenant_id, client_id) id
    FROM public.client_module_assignments
    WHERE is_active = TRUE
    ORDER BY tenant_id, client_id, assigned_at ASC
  );

CREATE UNIQUE INDEX IF NOT EXISTS idx_client_module_assignments_client_module
  ON public.client_module_assignments (tenant_id, client_id, module_key);

CREATE INDEX IF NOT EXISTS idx_client_module_assignments_client_active
  ON public.client_module_assignments (tenant_id, client_id)
  WHERE is_active = TRUE;

-- --------------------------------------------------------------------------
-- Portal feature matrix (global catalog — not tenant-scoped)
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.portal_feature_matrix (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  module_key    TEXT        NOT NULL,
  feature_key   TEXT        NOT NULL,
  label         TEXT        NOT NULL,
  description   TEXT        NOT NULL DEFAULT '',
  nav_group     TEXT        NOT NULL DEFAULT 'module',
  sort_order    INTEGER     NOT NULL DEFAULT 0,
  is_active     BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (module_key, feature_key)
);

-- --------------------------------------------------------------------------
-- Portal widget registry (global dashboard widget catalog)
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.portal_widget_registry (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  module_key      TEXT        NOT NULL,
  widget_key      TEXT        NOT NULL,
  title           TEXT        NOT NULL,
  description     TEXT        NOT NULL DEFAULT '',
  empty_state     TEXT        NOT NULL DEFAULT '',
  priority        INTEGER     NOT NULL DEFAULT 50,
  feature_key     TEXT,
  sort_order      INTEGER     NOT NULL DEFAULT 0,
  is_active       BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (module_key, widget_key)
);

-- --------------------------------------------------------------------------
-- Portal visibility rules (tenant-scoped role + feature permissions)
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.portal_visibility_rules (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  module_key      TEXT        NOT NULL,
  feature_key     TEXT        NOT NULL,
  portal_role     TEXT        NOT NULL,
  is_visible      BOOLEAN     NOT NULL DEFAULT TRUE,
  requires_release BOOLEAN    NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, module_key, feature_key, portal_role)
);

CREATE INDEX IF NOT EXISTS idx_portal_visibility_rules_tenant
  ON public.portal_visibility_rules (tenant_id, module_key);

-- --------------------------------------------------------------------------
-- Seed: feature matrix
-- --------------------------------------------------------------------------
INSERT INTO public.portal_feature_matrix (module_key, feature_key, label, description, nav_group, sort_order)
VALUES
  ('assist',     'appointments',  'Termine',           'Assist-Termine und Besuche',              'module', 10),
  ('assist',     'messages',      'Nachrichten',       'Nachrichten an das Assist-Team',          'global', 20),
  ('assist',     'documents',     'Dokumente',         'Freigegebene Assist-Dokumente',           'global', 30),
  ('assist',     'trips',         'Fahrten',           'Geplante Assist-Fahrten',                 'module', 40),
  ('assist',     'care_team',     'Betreuungsteam',    'Ihr Assist-Betreuungsteam',               'module', 50),
  ('pflege',     'appointments',  'Termine',           'Pflege-Termine und Hausbesuche',          'module', 10),
  ('pflege',     'care_plan',     'Pflegeplan',        'Aktueller Pflegeplan',                    'module', 20),
  ('pflege',     'vitals',        'Vitalwerte',        'Freigegebene Vitalwerte',                 'module', 30),
  ('pflege',     'medications',   'Medikation',        'Medikationsplan',                         'module', 40),
  ('pflege',     'messages',      'Nachrichten',       'Nachrichten an die Pflege',               'global', 50),
  ('pflege',     'documents',     'Dokumente',         'Pflege-Dokumente',                        'global', 60),
  ('stationaer', 'appointments',  'Bewohnertermine',   'Termine in der Einrichtung',              'module', 10),
  ('stationaer', 'meals',         'Verpflegung',       'Speiseplan und Essenswünsche',            'module', 20),
  ('stationaer', 'activities',    'Aktivitäten',       'Freizeit- und Gruppenangebote',          'module', 30),
  ('stationaer', 'room',          'Zimmer',            'Zimmer- und Wohnbereichsinformationen',   'module', 40),
  ('stationaer', 'messages',      'Nachrichten',       'Nachrichten an die Einrichtung',          'global', 50),
  ('stationaer', 'documents',     'Dokumente',         'Einrichtungs-Dokumente',                  'global', 60),
  ('beratung',   'consultations', 'Beratungstermine',  'Geplante Beratungsgespräche',             'module', 10),
  ('beratung',   'cases',         'Beratungsfälle',    'Laufende Beratungsfälle',                 'module', 20),
  ('beratung',   'follow_ups',    'Nachsorge',         'Follow-up-Termine',                       'module', 30),
  ('beratung',   'messages',      'Nachrichten',       'Nachrichten an die Beratung',             'global', 40),
  ('beratung',   'documents',     'Dokumente',         'Beratungs-Dokumente',                     'global', 50)
ON CONFLICT (module_key, feature_key) DO NOTHING;

-- --------------------------------------------------------------------------
-- Seed: widget registry
-- --------------------------------------------------------------------------
INSERT INTO public.portal_widget_registry (module_key, widget_key, title, description, empty_state, priority, feature_key, sort_order)
VALUES
  ('global',     'messages_kpi',       'Nachrichten',         'Offene Nachrichten',              'Noch keine Nachrichten.',                    100, 'messages',     10),
  ('global',     'documents_kpi',      'Dokumente',           'Freigegebene Dokumente',          'Noch keine Dokumente freigegeben.',          90,  'documents',    20),
  ('global',     'appointments_kpi',   'Termine',             'Anstehende Termine',              'Keine Termine geplant.',                      80,  'appointments', 30),
  ('assist',     'assist_next_visit',  'Nächster Assist-Termin', 'Ihr nächster geplanter Besuch', 'Noch kein Assist-Termin geplant.',           60,  'appointments', 10),
  ('assist',     'assist_trips',       'Assist-Fahrten',      'Geplante Fahrten',                'Keine Fahrten geplant.',                      50,  'trips',        20),
  ('pflege',     'pflege_care_plan',   'Pflegeplan',          'Aktueller Pflegeplan',            'Pflegeplan noch nicht freigegeben.',          10,  'care_plan',    10),
  ('pflege',     'pflege_vitals',      'Vitalwerte',          'Letzte Vitalwerte',               'Noch keine Vitalwerte freigegeben.',          20,  'vitals',       20),
  ('pflege',     'pflege_medications', 'Medikation',          'Medikationsübersicht',            'Medikationsplan noch nicht freigegeben.',     30,  'medications',  30),
  ('stationaer', 'stationaer_meals',   'Speiseplan',          'Heutiger Speiseplan',             'Speiseplan noch nicht verfügbar.',            40,  'meals',        10),
  ('stationaer', 'stationaer_activities', 'Aktivitäten',      'Anstehende Aktivitäten',          'Keine Aktivitäten geplant.',                  45,  'activities',   20),
  ('beratung',   'beratung_next_session', 'Nächste Beratung', 'Ihr nächstes Beratungsgespräch',  'Noch kein Beratungstermin geplant.',          55,  'consultations', 10),
  ('beratung',   'beratung_cases',     'Beratungsfälle',      'Laufende Beratungsfälle',         'Keine aktiven Beratungsfälle.',               50,  'cases',        20)
ON CONFLICT (module_key, widget_key) DO NOTHING;

-- --------------------------------------------------------------------------
-- RLS
-- --------------------------------------------------------------------------
ALTER TABLE public.portal_feature_matrix ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portal_widget_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portal_visibility_rules ENABLE ROW LEVEL SECURITY;

-- Global catalogs: readable by all authenticated users
DROP POLICY IF EXISTS portal_feature_matrix_select ON public.portal_feature_matrix;
CREATE POLICY portal_feature_matrix_select ON public.portal_feature_matrix
  FOR SELECT TO authenticated USING (is_active = TRUE);

DROP POLICY IF EXISTS portal_widget_registry_select ON public.portal_widget_registry;
CREATE POLICY portal_widget_registry_select ON public.portal_widget_registry
  FOR SELECT TO authenticated USING (is_active = TRUE);

-- Visibility rules: office staff + portal users for their tenant
DROP POLICY IF EXISTS portal_visibility_rules_select ON public.portal_visibility_rules;
CREATE POLICY portal_visibility_rules_select ON public.portal_visibility_rules
  FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS portal_visibility_rules_office_write ON public.portal_visibility_rules;
CREATE POLICY portal_visibility_rules_office_write ON public.portal_visibility_rules
  FOR ALL TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND public.has_permission('office.access')
  )
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND public.has_permission('office.access')
  );

-- Portal users: read own client's module assignments
DROP POLICY IF EXISTS client_module_assignments_portal_select ON public.client_module_assignments;
CREATE POLICY client_module_assignments_portal_select ON public.client_module_assignments
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND is_active = TRUE
    AND client_id = public.current_client_id()
    AND public.current_client_id() IS NOT NULL
  );

-- Office: full CRUD on client module assignments
DROP POLICY IF EXISTS client_module_assignments_office_insert ON public.client_module_assignments;
CREATE POLICY client_module_assignments_office_insert ON public.client_module_assignments
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND public.has_permission('office.clients.edit')
  );

DROP POLICY IF EXISTS client_module_assignments_office_update ON public.client_module_assignments;
CREATE POLICY client_module_assignments_office_update ON public.client_module_assignments
  FOR UPDATE TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND public.has_permission('office.clients.edit')
  )
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND public.has_permission('office.clients.edit')
  );

DROP POLICY IF EXISTS client_module_assignments_office_delete ON public.client_module_assignments;
CREATE POLICY client_module_assignments_office_delete ON public.client_module_assignments
  FOR DELETE TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND public.has_permission('office.clients.edit')
  );

GRANT SELECT ON public.portal_feature_matrix TO authenticated;
GRANT SELECT ON public.portal_widget_registry TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.portal_visibility_rules TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.client_module_assignments TO authenticated;

COMMENT ON TABLE public.portal_feature_matrix IS 'Global portal feature catalog per care module (assist/pflege/stationaer/beratung).';
COMMENT ON TABLE public.portal_widget_registry IS 'Global portal dashboard widget catalog with module priority ordering.';
COMMENT ON TABLE public.portal_visibility_rules IS 'Tenant-scoped portal feature visibility by portal role.';
COMMENT ON COLUMN public.client_module_assignments.is_primary IS 'Primary module drives portal terminology and dashboard priority.';
COMMENT ON COLUMN public.client_module_assignments.is_active IS 'Inactive assignments are hidden from portal resolution.';
COMMENT ON COLUMN public.client_module_assignments.assigned_by IS 'Office profile that assigned the module.';
