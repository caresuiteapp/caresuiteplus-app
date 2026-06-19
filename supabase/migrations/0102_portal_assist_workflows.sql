-- ==========================================================================
-- CareSuite+ — Migration 0102: Portal Assist workflows
-- portal_requests, activities, budget snapshots + Assist feature/nav seeds
-- ==========================================================================

-- --------------------------------------------------------------------------
-- Enums
-- --------------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE public.portal_request_status AS ENUM (
    'offen',
    'in_bearbeitung',
    'erledigt',
    'abgelehnt',
    'zurueckgestellt'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.portal_request_type AS ENUM (
    'termin_aendern',
    'zusatztermin',
    'rueckruf',
    'nachricht',
    'upload',
    'nachweise',
    'sonstiges'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.portal_activity_type AS ENUM (
    'request_created',
    'request_updated',
    'request_completed',
    'document_uploaded',
    'message_sent',
    'appointment_viewed',
    'budget_viewed',
    'system'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.portal_budget_type AS ENUM ('paragraph_45b', 'paragraph_45a');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- --------------------------------------------------------------------------
-- portal_requests
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.portal_requests (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  client_id       UUID        NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  portal_user_id  UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  module_key      TEXT        NOT NULL DEFAULT 'assist',
  request_type    public.portal_request_type NOT NULL,
  status          public.portal_request_status NOT NULL DEFAULT 'offen',
  title           TEXT        NOT NULL,
  description     TEXT,
  payload         JSONB       NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_portal_requests_tenant_client
  ON public.portal_requests (tenant_id, client_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_portal_requests_status
  ON public.portal_requests (tenant_id, status)
  WHERE status IN ('offen', 'in_bearbeitung');

-- --------------------------------------------------------------------------
-- portal_request_status_history
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.portal_request_status_history (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  request_id      UUID        NOT NULL REFERENCES public.portal_requests(id) ON DELETE CASCADE,
  from_status     public.portal_request_status,
  to_status       public.portal_request_status NOT NULL,
  changed_by      UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  note            TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_portal_request_status_history_request
  ON public.portal_request_status_history (request_id, created_at DESC);

-- --------------------------------------------------------------------------
-- portal_activities
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.portal_activities (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  client_id       UUID        NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  portal_user_id  UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  module_key      TEXT        NOT NULL DEFAULT 'assist',
  activity_type   public.portal_activity_type NOT NULL,
  title           TEXT        NOT NULL,
  description     TEXT,
  metadata        JSONB       NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_portal_activities_client
  ON public.portal_activities (tenant_id, client_id, created_at DESC);

-- --------------------------------------------------------------------------
-- portal_budget_snapshots
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.portal_budget_snapshots (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  client_id       UUID        NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  budget_type     public.portal_budget_type NOT NULL,
  period_start    DATE        NOT NULL,
  period_end      DATE        NOT NULL,
  total_amount    NUMERIC(12, 2) NOT NULL DEFAULT 0,
  used_amount     NUMERIC(12, 2) NOT NULL DEFAULT 0,
  remaining_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  currency        TEXT        NOT NULL DEFAULT 'EUR',
  metadata        JSONB       NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, client_id, budget_type, period_start, period_end)
);

CREATE INDEX IF NOT EXISTS idx_portal_budget_snapshots_client
  ON public.portal_budget_snapshots (tenant_id, client_id, period_end DESC);

-- --------------------------------------------------------------------------
-- Extend portal feature matrix — Assist nav items
-- --------------------------------------------------------------------------
INSERT INTO public.portal_feature_matrix (module_key, feature_key, label, description, nav_group, sort_order)
VALUES
  ('assist', 'betreuung',  'Betreuung',   'Ihr Assist-Betreuungsteam',           'module', 15),
  ('assist', 'budget',     'Budget',      'Entlastungs- und Verhinderungspflege', 'module', 55),
  ('assist', 'nachweise',  'Nachweise',   'Leistungsnachweise und Belege',        'module', 60),
  ('assist', 'anfragen',   'Anfragen',    'Ihre Portal-Anfragen',                 'module', 65),
  ('assist', 'hilfe',      'Hilfe',       'Hilfe und Kontakt zum Pflegebüro',     'module', 70)
ON CONFLICT (module_key, feature_key) DO UPDATE SET
  label = EXCLUDED.label,
  description = EXCLUDED.description,
  nav_group = EXCLUDED.nav_group,
  sort_order = EXCLUDED.sort_order;

-- Rename client-facing trips label: Fahrten → Begleitungen
UPDATE public.portal_feature_matrix
SET label = 'Begleitungen', description = 'Geplante Assist-Begleitungen'
WHERE module_key = 'assist' AND feature_key = 'trips';

UPDATE public.portal_widget_registry
SET title = 'Begleitungen', description = 'Geplante Begleitungen', empty_state = 'Keine Begleitungen geplant.'
WHERE module_key = 'assist' AND widget_key = 'assist_trips';

-- Assist overview widgets
INSERT INTO public.portal_widget_registry (module_key, widget_key, title, description, empty_state, priority, feature_key, sort_order)
VALUES
  ('assist', 'assist_budget',      'Budget',        '§45b / §45a Übersicht',           'Budget noch nicht freigegeben.',              45, 'budget',    30),
  ('assist', 'assist_proofs',      'Nachweise',     'Offene Nachweise',                'Keine Nachweise offen.',                      40, 'nachweise', 35),
  ('assist', 'assist_requests',    'Anfragen',      'Offene Portal-Anfragen',          'Keine offenen Anfragen.',                     35, 'anfragen',  40),
  ('assist', 'assist_activities',  'Aktivitäten',   'Letzte Portal-Aktivitäten',       'Noch keine Aktivitäten.',                     30, NULL,        45),
  ('assist', 'assist_signatures',  'Unterschriften','Ausstehende Unterschriften',      'Keine Unterschriften ausstehend.',            25, 'documents', 50)
ON CONFLICT (module_key, widget_key) DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  empty_state = EXCLUDED.empty_state,
  priority = EXCLUDED.priority,
  feature_key = EXCLUDED.feature_key,
  sort_order = EXCLUDED.sort_order;

-- --------------------------------------------------------------------------
-- RLS
-- --------------------------------------------------------------------------
ALTER TABLE public.portal_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portal_request_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portal_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portal_budget_snapshots ENABLE ROW LEVEL SECURITY;

-- Portal users: own client requests
DROP POLICY IF EXISTS portal_requests_portal_select ON public.portal_requests;
CREATE POLICY portal_requests_portal_select ON public.portal_requests
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND client_id = public.current_client_id()
    AND public.current_client_id() IS NOT NULL
  );

DROP POLICY IF EXISTS portal_requests_portal_insert ON public.portal_requests;
CREATE POLICY portal_requests_portal_insert ON public.portal_requests
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND client_id = public.current_client_id()
    AND public.current_client_id() IS NOT NULL
  );

-- Office: read/update all tenant requests
DROP POLICY IF EXISTS portal_requests_office_select ON public.portal_requests;
CREATE POLICY portal_requests_office_select ON public.portal_requests
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND public.has_permission('office.access')
  );

DROP POLICY IF EXISTS portal_requests_office_update ON public.portal_requests;
CREATE POLICY portal_requests_office_update ON public.portal_requests
  FOR UPDATE TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND public.has_permission('office.access')
  )
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND public.has_permission('office.access')
  );

-- Status history: portal read own, office read/write
DROP POLICY IF EXISTS portal_request_status_history_portal_select ON public.portal_request_status_history;
CREATE POLICY portal_request_status_history_portal_select ON public.portal_request_status_history
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND EXISTS (
      SELECT 1 FROM public.portal_requests pr
      WHERE pr.id = request_id
        AND pr.client_id = public.current_client_id()
    )
  );

DROP POLICY IF EXISTS portal_request_status_history_office_all ON public.portal_request_status_history;
CREATE POLICY portal_request_status_history_office_all ON public.portal_request_status_history
  FOR ALL TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND public.has_permission('office.access')
  )
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND public.has_permission('office.access')
  );

-- Activities: portal read own client
DROP POLICY IF EXISTS portal_activities_portal_select ON public.portal_activities;
CREATE POLICY portal_activities_portal_select ON public.portal_activities
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND client_id = public.current_client_id()
    AND public.current_client_id() IS NOT NULL
  );

DROP POLICY IF EXISTS portal_activities_portal_insert ON public.portal_activities;
CREATE POLICY portal_activities_portal_insert ON public.portal_activities
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND client_id = public.current_client_id()
    AND public.current_client_id() IS NOT NULL
  );

DROP POLICY IF EXISTS portal_activities_office_select ON public.portal_activities;
CREATE POLICY portal_activities_office_select ON public.portal_activities
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND public.has_permission('office.access')
  );

-- Budget snapshots: portal read own, office manage
DROP POLICY IF EXISTS portal_budget_snapshots_portal_select ON public.portal_budget_snapshots;
CREATE POLICY portal_budget_snapshots_portal_select ON public.portal_budget_snapshots
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND client_id = public.current_client_id()
    AND public.current_client_id() IS NOT NULL
  );

DROP POLICY IF EXISTS portal_budget_snapshots_office_all ON public.portal_budget_snapshots;
CREATE POLICY portal_budget_snapshots_office_all ON public.portal_budget_snapshots
  FOR ALL TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND public.has_permission('office.access')
  )
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND public.has_permission('office.access')
  );

GRANT SELECT, INSERT ON public.portal_requests TO authenticated;
GRANT UPDATE ON public.portal_requests TO authenticated;
GRANT SELECT, INSERT ON public.portal_request_status_history TO authenticated;
GRANT SELECT, INSERT ON public.portal_activities TO authenticated;
GRANT SELECT ON public.portal_budget_snapshots TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.portal_budget_snapshots TO authenticated;

COMMENT ON TABLE public.portal_requests IS 'Client portal requests (Terminänderung, Rückruf, etc.) scoped per tenant/client.';
COMMENT ON TABLE public.portal_activities IS 'Portal activity feed for client overview.';
COMMENT ON TABLE public.portal_budget_snapshots IS 'Read-only budget snapshots for §45b/§45a portal display.';
