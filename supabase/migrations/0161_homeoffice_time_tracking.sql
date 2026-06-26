-- ==========================================================================
-- CareSuite+ — Migration 0161: Homeoffice-Arbeitszeit & Tätigkeitsnachweis
-- Metadata-only activity signals, tenant-isolated, append-only audit log.
-- ==========================================================================

-- --------------------------------------------------------------------------
-- 1. tenant_time_tracking_settings
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tenant_time_tracking_settings (
  id                          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                   UUID        NOT NULL UNIQUE REFERENCES public.tenants(id) ON DELETE CASCADE,
  module_enabled              BOOLEAN     NOT NULL DEFAULT TRUE,
  require_privacy_consent     BOOLEAN     NOT NULL DEFAULT TRUE,
  inactivity_trigger_minutes  INTEGER     NOT NULL DEFAULT 5 CHECK (inactivity_trigger_minutes BETWEEN 1 AND 60),
  inactivity_response_minutes INTEGER     NOT NULL DEFAULT 2 CHECK (inactivity_response_minutes BETWEEN 1 AND 30),
  warning_threshold_per_day   INTEGER     NOT NULL DEFAULT 3 CHECK (warning_threshold_per_day BETWEEN 1 AND 20),
  allow_manual_corrections    BOOLEAN     NOT NULL DEFAULT TRUE,
  integration_microsoft       BOOLEAN     NOT NULL DEFAULT FALSE,
  integration_google          BOOLEAN     NOT NULL DEFAULT FALSE,
  integration_phone_metadata  BOOLEAN     NOT NULL DEFAULT FALSE,
  default_activity_type_id    UUID,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tenant_time_tracking_settings_tenant
  ON public.tenant_time_tracking_settings (tenant_id);

-- --------------------------------------------------------------------------
-- 2. tenant_work_organizations
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tenant_work_organizations (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  code        TEXT        NOT NULL,
  name        TEXT        NOT NULL,
  is_active   BOOLEAN     NOT NULL DEFAULT TRUE,
  sort_order  INTEGER     NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, code)
);

CREATE INDEX IF NOT EXISTS idx_tenant_work_organizations_tenant
  ON public.tenant_work_organizations (tenant_id, is_active, sort_order);

-- --------------------------------------------------------------------------
-- 3. tenant_cost_centers
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tenant_cost_centers (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  organization_id UUID        REFERENCES public.tenant_work_organizations(id) ON DELETE SET NULL,
  code            TEXT        NOT NULL,
  name            TEXT        NOT NULL,
  is_active       BOOLEAN     NOT NULL DEFAULT TRUE,
  sort_order      INTEGER     NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, code)
);

CREATE INDEX IF NOT EXISTS idx_tenant_cost_centers_tenant
  ON public.tenant_cost_centers (tenant_id, is_active, sort_order);

-- --------------------------------------------------------------------------
-- 4. tenant_projects
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tenant_projects (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  cost_center_id  UUID        REFERENCES public.tenant_cost_centers(id) ON DELETE SET NULL,
  code            TEXT        NOT NULL,
  name            TEXT        NOT NULL,
  is_active       BOOLEAN     NOT NULL DEFAULT TRUE,
  sort_order      INTEGER     NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, code)
);

CREATE INDEX IF NOT EXISTS idx_tenant_projects_tenant
  ON public.tenant_projects (tenant_id, is_active, sort_order);

-- --------------------------------------------------------------------------
-- 5. tenant_activity_types
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tenant_activity_types (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  code        TEXT        NOT NULL,
  name        TEXT        NOT NULL,
  category    TEXT        NOT NULL DEFAULT 'office'
    CHECK (category IN ('office', 'care_planning', 'administration', 'training', 'other')),
  is_active   BOOLEAN     NOT NULL DEFAULT TRUE,
  sort_order  INTEGER     NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, code)
);

CREATE INDEX IF NOT EXISTS idx_tenant_activity_types_tenant
  ON public.tenant_activity_types (tenant_id, is_active, sort_order);

ALTER TABLE public.tenant_time_tracking_settings
  DROP CONSTRAINT IF EXISTS tenant_time_tracking_settings_default_activity_type_id_fkey;

ALTER TABLE public.tenant_time_tracking_settings
  ADD CONSTRAINT tenant_time_tracking_settings_default_activity_type_id_fkey
  FOREIGN KEY (default_activity_type_id) REFERENCES public.tenant_activity_types(id) ON DELETE SET NULL;

-- --------------------------------------------------------------------------
-- 6. homeoffice_workdays (distinct from legacy Assist GPS time_entries)
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.homeoffice_workdays (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id               UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  employee_id           UUID        REFERENCES public.employees(id) ON DELETE SET NULL,
  work_date             DATE        NOT NULL,
  status                TEXT        NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'active', 'paused', 'closed', 'submitted')),
  started_at            TIMESTAMPTZ,
  ended_at              TIMESTAMPTZ,
  privacy_consent_at    TIMESTAMPTZ,
  active_session_id     TEXT,
  closure_note          TEXT,
  traffic_light         TEXT        CHECK (traffic_light IN ('green', 'yellow', 'red')),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, user_id, work_date)
);

CREATE INDEX IF NOT EXISTS idx_homeoffice_workdays_tenant_date
  ON public.homeoffice_workdays (tenant_id, work_date DESC);
CREATE INDEX IF NOT EXISTS idx_homeoffice_workdays_user
  ON public.homeoffice_workdays (tenant_id, user_id, work_date DESC);
CREATE INDEX IF NOT EXISTS idx_homeoffice_workdays_status
  ON public.homeoffice_workdays (tenant_id, status);

-- --------------------------------------------------------------------------
-- 7. homeoffice_time_entries — multiple blocks per day (no fixed Mischzeit)
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.homeoffice_time_entries (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  workday_id          UUID        NOT NULL REFERENCES public.homeoffice_workdays(id) ON DELETE CASCADE,
  user_id             UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  activity_type_id    UUID        REFERENCES public.tenant_activity_types(id) ON DELETE SET NULL,
  organization_id     UUID        REFERENCES public.tenant_work_organizations(id) ON DELETE SET NULL,
  cost_center_id      UUID        REFERENCES public.tenant_cost_centers(id) ON DELETE SET NULL,
  project_id          UUID        REFERENCES public.tenant_projects(id) ON DELETE SET NULL,
  block_index         INTEGER     NOT NULL DEFAULT 1 CHECK (block_index >= 1),
  status              TEXT        NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'paused', 'closed')),
  started_at          TIMESTAMPTZ NOT NULL,
  ended_at            TIMESTAMPTZ,
  pause_started_at    TIMESTAMPTZ,
  net_minutes         INTEGER     CHECK (net_minutes IS NULL OR net_minutes >= 0),
  note                TEXT,
  is_unclear          BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_homeoffice_time_entries_workday
  ON public.homeoffice_time_entries (workday_id, block_index);
CREATE INDEX IF NOT EXISTS idx_homeoffice_time_entries_tenant_user
  ON public.homeoffice_time_entries (tenant_id, user_id, started_at DESC);

-- --------------------------------------------------------------------------
-- 8. homeoffice_activity_events — metadata only, no content
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.homeoffice_activity_events (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  workday_id    UUID        REFERENCES public.homeoffice_workdays(id) ON DELETE SET NULL,
  user_id       UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type    TEXT        NOT NULL
    CHECK (event_type IN (
      'navigation', 'module_open', 'form_save', 'integration_signal',
      'workday_start', 'workday_pause', 'workday_resume', 'activity_switch',
      'workday_close', 'inactivity_prompt', 'inactivity_response'
    )),
  module_key    TEXT,
  resource_id   TEXT,
  occurred_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata      JSONB       NOT NULL DEFAULT '{}'::jsonb,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_homeoffice_activity_events_workday
  ON public.homeoffice_activity_events (workday_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_homeoffice_activity_events_tenant_user
  ON public.homeoffice_activity_events (tenant_id, user_id, occurred_at DESC);

-- --------------------------------------------------------------------------
-- 9. homeoffice_inactivity_checks
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.homeoffice_inactivity_checks (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  workday_id      UUID        NOT NULL REFERENCES public.homeoffice_workdays(id) ON DELETE CASCADE,
  user_id         UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  triggered_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  responded_at    TIMESTAMPTZ,
  status          TEXT        NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'responded', 'timed_out', 'unclear')),
  response_action TEXT
    CHECK (response_action IS NULL OR response_action IN ('continue', 'pause', 'switch', 'unclear')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_homeoffice_inactivity_checks_workday
  ON public.homeoffice_inactivity_checks (workday_id, triggered_at DESC);

-- --------------------------------------------------------------------------
-- 10. homeoffice_warnings
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.homeoffice_warnings (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  workday_id    UUID        NOT NULL REFERENCES public.homeoffice_workdays(id) ON DELETE CASCADE,
  user_id       UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  warning_type  TEXT        NOT NULL
    CHECK (warning_type IN ('inactivity_threshold', 'unclear_time', 'manual')),
  message       TEXT        NOT NULL,
  check_count   INTEGER,
  acknowledged  BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_homeoffice_warnings_workday
  ON public.homeoffice_warnings (workday_id, created_at DESC);

-- --------------------------------------------------------------------------
-- 11. homeoffice_correction_requests
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.homeoffice_correction_requests (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  workday_id          UUID        NOT NULL REFERENCES public.homeoffice_workdays(id) ON DELETE CASCADE,
  time_entry_id       UUID        REFERENCES public.homeoffice_time_entries(id) ON DELETE SET NULL,
  requested_by        UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status              TEXT        NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  reason              TEXT        NOT NULL,
  proposed_started_at TIMESTAMPTZ,
  proposed_ended_at   TIMESTAMPTZ,
  proposed_activity_type_id UUID  REFERENCES public.tenant_activity_types(id) ON DELETE SET NULL,
  reviewed_by         UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at         TIMESTAMPTZ,
  review_note         TEXT,
  counter_entry_id    UUID        REFERENCES public.homeoffice_time_entries(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_homeoffice_correction_requests_tenant
  ON public.homeoffice_correction_requests (tenant_id, status, created_at DESC);

-- --------------------------------------------------------------------------
-- 12. homeoffice_audit_logs — append-only with optional hash chain
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.homeoffice_audit_logs (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  workday_id      UUID        REFERENCES public.homeoffice_workdays(id) ON DELETE SET NULL,
  entity_type     TEXT        NOT NULL,
  entity_id       UUID        NOT NULL,
  action          TEXT        NOT NULL,
  actor_id        UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  summary         TEXT        NOT NULL,
  metadata        JSONB       NOT NULL DEFAULT '{}'::jsonb,
  prev_hash       TEXT,
  entry_hash      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_homeoffice_audit_logs_tenant
  ON public.homeoffice_audit_logs (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_homeoffice_audit_logs_workday
  ON public.homeoffice_audit_logs (workday_id, created_at DESC);

-- --------------------------------------------------------------------------
-- RLS
-- --------------------------------------------------------------------------
ALTER TABLE public.tenant_time_tracking_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_work_organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_cost_centers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_activity_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.homeoffice_workdays ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.homeoffice_time_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.homeoffice_activity_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.homeoffice_inactivity_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.homeoffice_warnings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.homeoffice_correction_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.homeoffice_audit_logs ENABLE ROW LEVEL SECURITY;

-- Settings: admin manage, all authenticated read own tenant
DROP POLICY IF EXISTS time_settings_select ON public.tenant_time_tracking_settings;
CREATE POLICY time_settings_select ON public.tenant_time_tracking_settings
  FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS time_settings_manage ON public.tenant_time_tracking_settings;
CREATE POLICY time_settings_manage ON public.tenant_time_tracking_settings
  FOR ALL TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND (public.has_permission('time.settings.manage') OR public.is_tenant_admin())
  )
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND (public.has_permission('time.settings.manage') OR public.is_tenant_admin())
  );

-- Catalogs
DROP POLICY IF EXISTS time_catalogs_select ON public.tenant_work_organizations;
CREATE POLICY time_catalogs_select ON public.tenant_work_organizations
  FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS time_catalogs_manage_org ON public.tenant_work_organizations;
CREATE POLICY time_catalogs_manage_org ON public.tenant_work_organizations
  FOR ALL TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND (public.has_permission('time.settings.manage') OR public.is_tenant_admin())
  )
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND (public.has_permission('time.settings.manage') OR public.is_tenant_admin())
  );

DROP POLICY IF EXISTS time_cost_centers_select ON public.tenant_cost_centers;
CREATE POLICY time_cost_centers_select ON public.tenant_cost_centers
  FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS time_cost_centers_manage ON public.tenant_cost_centers;
CREATE POLICY time_cost_centers_manage ON public.tenant_cost_centers
  FOR ALL TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND (public.has_permission('time.settings.manage') OR public.is_tenant_admin())
  )
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND (public.has_permission('time.settings.manage') OR public.is_tenant_admin())
  );

DROP POLICY IF EXISTS time_projects_select ON public.tenant_projects;
CREATE POLICY time_projects_select ON public.tenant_projects
  FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS time_projects_manage ON public.tenant_projects;
CREATE POLICY time_projects_manage ON public.tenant_projects
  FOR ALL TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND (public.has_permission('time.settings.manage') OR public.is_tenant_admin())
  )
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND (public.has_permission('time.settings.manage') OR public.is_tenant_admin())
  );

DROP POLICY IF EXISTS time_activity_types_select ON public.tenant_activity_types;
CREATE POLICY time_activity_types_select ON public.tenant_activity_types
  FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS time_activity_types_manage ON public.tenant_activity_types;
CREATE POLICY time_activity_types_manage ON public.tenant_activity_types
  FOR ALL TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND (public.has_permission('time.settings.manage') OR public.is_tenant_admin())
  )
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND (public.has_permission('time.settings.manage') OR public.is_tenant_admin())
  );

-- Workdays: own or team/admin view
DROP POLICY IF EXISTS time_workdays_select ON public.homeoffice_workdays;
CREATE POLICY time_workdays_select ON public.homeoffice_workdays
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND (
      user_id = auth.uid()
      OR public.has_permission('time.tracking.team.view')
      OR public.has_permission('time.tracking.admin.view')
      OR public.has_permission('time.audit.view')
      OR public.is_tenant_admin()
    )
  );

DROP POLICY IF EXISTS time_workdays_insert ON public.homeoffice_workdays;
CREATE POLICY time_workdays_insert ON public.homeoffice_workdays
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND user_id = auth.uid()
    AND public.has_permission('time.tracking.own.start')
  );

DROP POLICY IF EXISTS time_workdays_update ON public.homeoffice_workdays;
CREATE POLICY time_workdays_update ON public.homeoffice_workdays
  FOR UPDATE TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND (
      (user_id = auth.uid() AND (
        public.has_permission('time.tracking.own.pause')
        OR public.has_permission('time.tracking.own.resume')
        OR public.has_permission('time.tracking.own.switch')
        OR public.has_permission('time.tracking.own.close')
      ))
      OR public.has_permission('time.tracking.admin.correct')
      OR public.is_tenant_admin()
    )
  );

-- Time entries
DROP POLICY IF EXISTS time_entries_select ON public.homeoffice_time_entries;
CREATE POLICY time_entries_select ON public.homeoffice_time_entries
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND (
      user_id = auth.uid()
      OR public.has_permission('time.tracking.team.view')
      OR public.has_permission('time.tracking.admin.view')
      OR public.has_permission('time.audit.view')
      OR public.is_tenant_admin()
    )
  );

DROP POLICY IF EXISTS time_entries_insert ON public.homeoffice_time_entries;
CREATE POLICY time_entries_insert ON public.homeoffice_time_entries
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND user_id = auth.uid()
    AND public.has_permission('time.tracking.own.start')
  );

DROP POLICY IF EXISTS time_entries_update ON public.homeoffice_time_entries;
CREATE POLICY time_entries_update ON public.homeoffice_time_entries
  FOR UPDATE TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND (
      (user_id = auth.uid() AND (
        public.has_permission('time.tracking.own.pause')
        OR public.has_permission('time.tracking.own.resume')
        OR public.has_permission('time.tracking.own.switch')
        OR public.has_permission('time.tracking.own.close')
      ))
      OR public.has_permission('time.tracking.admin.correct')
      OR public.is_tenant_admin()
    )
  );

-- Activity events — insert own, select own or admin
DROP POLICY IF EXISTS time_activity_events_select ON public.homeoffice_activity_events;
CREATE POLICY time_activity_events_select ON public.homeoffice_activity_events
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND (
      user_id = auth.uid()
      OR public.has_permission('time.tracking.team.view')
      OR public.has_permission('time.audit.view')
      OR public.is_tenant_admin()
    )
  );

DROP POLICY IF EXISTS time_activity_events_insert ON public.homeoffice_activity_events;
CREATE POLICY time_activity_events_insert ON public.homeoffice_activity_events
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND user_id = auth.uid()
  );

-- Inactivity checks
DROP POLICY IF EXISTS time_inactivity_select ON public.homeoffice_inactivity_checks;
CREATE POLICY time_inactivity_select ON public.homeoffice_inactivity_checks
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND (
      user_id = auth.uid()
      OR public.has_permission('time.tracking.team.view')
      OR public.has_permission('time.audit.view')
      OR public.is_tenant_admin()
    )
  );

DROP POLICY IF EXISTS time_inactivity_insert ON public.homeoffice_inactivity_checks;
CREATE POLICY time_inactivity_insert ON public.homeoffice_inactivity_checks
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.current_tenant_id() AND user_id = auth.uid());

DROP POLICY IF EXISTS time_inactivity_update ON public.homeoffice_inactivity_checks;
CREATE POLICY time_inactivity_update ON public.homeoffice_inactivity_checks
  FOR UPDATE TO authenticated
  USING (tenant_id = public.current_tenant_id() AND user_id = auth.uid());

-- Warnings
DROP POLICY IF EXISTS time_warnings_select ON public.homeoffice_warnings;
CREATE POLICY time_warnings_select ON public.homeoffice_warnings
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND (
      user_id = auth.uid()
      OR public.has_permission('time.tracking.team.view')
      OR public.has_permission('time.audit.view')
      OR public.is_tenant_admin()
    )
  );

DROP POLICY IF EXISTS time_warnings_insert ON public.homeoffice_warnings;
CREATE POLICY time_warnings_insert ON public.homeoffice_warnings
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.current_tenant_id());

-- Corrections
DROP POLICY IF EXISTS time_corrections_select ON public.homeoffice_correction_requests;
CREATE POLICY time_corrections_select ON public.homeoffice_correction_requests
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND (
      requested_by = auth.uid()
      OR public.has_permission('time.tracking.admin.view')
      OR public.has_permission('time.audit.view')
      OR public.is_tenant_admin()
    )
  );

DROP POLICY IF EXISTS time_corrections_insert ON public.homeoffice_correction_requests;
CREATE POLICY time_corrections_insert ON public.homeoffice_correction_requests
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND requested_by = auth.uid()
    AND public.has_permission('time.tracking.own.view')
  );

DROP POLICY IF EXISTS time_corrections_update ON public.homeoffice_correction_requests;
CREATE POLICY time_corrections_update ON public.homeoffice_correction_requests
  FOR UPDATE TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND (
      public.has_permission('time.tracking.admin.correct')
      OR public.is_tenant_admin()
    )
  );

-- Audit logs — append-only (insert + select, no update/delete)
DROP POLICY IF EXISTS time_audit_logs_select ON public.homeoffice_audit_logs;
CREATE POLICY time_audit_logs_select ON public.homeoffice_audit_logs
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND (
      public.has_permission('time.audit.view')
      OR public.has_permission('time.tracking.admin.view')
      OR public.is_tenant_admin()
    )
  );

DROP POLICY IF EXISTS time_audit_logs_insert ON public.homeoffice_audit_logs;
CREATE POLICY time_audit_logs_insert ON public.homeoffice_audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.current_tenant_id());

-- GRANTs
GRANT SELECT, INSERT, UPDATE ON public.tenant_time_tracking_settings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tenant_work_organizations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tenant_cost_centers TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tenant_projects TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tenant_activity_types TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.homeoffice_workdays TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.homeoffice_time_entries TO authenticated;
GRANT SELECT, INSERT ON public.homeoffice_activity_events TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.homeoffice_inactivity_checks TO authenticated;
GRANT SELECT, INSERT ON public.homeoffice_warnings TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.homeoffice_correction_requests TO authenticated;
GRANT SELECT, INSERT ON public.homeoffice_audit_logs TO authenticated;

-- Permission seeds
INSERT INTO public.role_permissions (role_id, permission_key)
SELECT r.id, p.key
FROM public.roles r
CROSS JOIN (
  VALUES
    ('time.tracking.own.start'),
    ('time.tracking.own.pause'),
    ('time.tracking.own.resume'),
    ('time.tracking.own.switch'),
    ('time.tracking.own.close'),
    ('time.tracking.own.view'),
    ('time.tracking.team.view'),
    ('time.tracking.admin.view'),
    ('time.tracking.admin.correct'),
    ('time.tracking.admin.export'),
    ('time.audit.view'),
    ('time.settings.manage')
) AS p(key)
WHERE r.key IN ('business_admin', 'business_manager', 'owner', 'admin', 'management', 'geschaeftsfuehrung')
ON CONFLICT (role_id, permission_key) DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_key)
SELECT r.id, p.key
FROM public.roles r
CROSS JOIN (
  VALUES
    ('time.tracking.own.start'),
    ('time.tracking.own.pause'),
    ('time.tracking.own.resume'),
    ('time.tracking.own.switch'),
    ('time.tracking.own.close'),
    ('time.tracking.own.view'),
    ('time.tracking.team.view'),
    ('time.tracking.admin.view'),
    ('time.tracking.admin.correct')
) AS p(key)
WHERE r.key IN ('office', 'team_lead', 'pdl', 'planning')
ON CONFLICT (role_id, permission_key) DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_key)
SELECT r.id, p.key
FROM public.roles r
CROSS JOIN (
  VALUES
    ('time.tracking.own.start'),
    ('time.tracking.own.pause'),
    ('time.tracking.own.resume'),
    ('time.tracking.own.switch'),
    ('time.tracking.own.close'),
    ('time.tracking.own.view')
) AS p(key)
WHERE r.key IN ('nurse', 'caregiver', 'counselor', 'dispatch', 'employee_portal')
ON CONFLICT (role_id, permission_key) DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_key)
SELECT r.id, p.key
FROM public.roles r
CROSS JOIN (
  VALUES
    ('time.tracking.team.view'),
    ('time.tracking.admin.view'),
    ('time.audit.view')
) AS p(key)
WHERE r.key IN ('billing')
ON CONFLICT (role_id, permission_key) DO NOTHING;
