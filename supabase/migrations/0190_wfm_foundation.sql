-- ==========================================================================
-- CareSuite+ — Migration 0190: WFM Foundation
-- Zentrale Workforce-Zeiterfassung: time_events, work_sessions, absences,
-- approvals, time_accounts. RLS: tenant + employee self + office admin.
--
-- ⚠️  ENTWURF — Nur nach expliziter Freigabe anwenden (supabase db push / MCP).
-- ⚠️  Ergänzt bestehende Silo-Tabellen (0161 homeoffice, 0156 assist) — ersetzt
--     sie nicht sofort; Sync-Adapter in Phase 1 erforderlich.
-- ==========================================================================

-- --------------------------------------------------------------------------
-- 1. workforce_time_events — append-only Zeitstempel (Single Source of Truth)
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.workforce_time_events (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  employee_id       UUID        NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  user_id           UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  event_type        TEXT        NOT NULL CHECK (event_type IN (
    'clock_in', 'clock_out',
    'pause_start', 'pause_end',
    'homeoffice_start', 'homeoffice_end',
    'office_check_in', 'office_check_out',
    'visit_drive_start', 'visit_arrived', 'visit_started', 'visit_ended', 'visit_paused',
    'mode_switch', 'correction', 'manual_booking',
    'standby_start', 'standby_end',
    'training_start', 'training_end',
    'meeting_start', 'meeting_end',
    'travel_start', 'travel_end'
  )),
  work_mode         TEXT        CHECK (work_mode IS NULL OR work_mode IN (
    'field', 'office', 'homeoffice', 'hybrid', 'standby', 'training', 'travel', 'none'
  )),
  source            TEXT        NOT NULL DEFAULT 'portal' CHECK (source IN (
    'portal', 'office', 'assist', 'system', 'import', 'correction'
  )),
  occurred_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  recorded_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  session_id        UUID,
  reference_type    TEXT        CHECK (reference_type IS NULL OR reference_type IN (
    'visit', 'assignment', 'homeoffice_workday', 'absence', 'correction'
  )),
  reference_id      UUID,
  correction_of_id  UUID        REFERENCES public.workforce_time_events(id) ON DELETE SET NULL,
  note              TEXT,
  metadata          JSONB       NOT NULL DEFAULT '{}'::jsonb,
  created_by        UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_workforce_time_events_tenant_employee_time
  ON public.workforce_time_events (tenant_id, employee_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_workforce_time_events_tenant_type
  ON public.workforce_time_events (tenant_id, event_type, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_workforce_time_events_session
  ON public.workforce_time_events (session_id)
  WHERE session_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_workforce_time_events_reference
  ON public.workforce_time_events (tenant_id, reference_type, reference_id)
  WHERE reference_id IS NOT NULL;

COMMENT ON TABLE public.workforce_time_events IS
  'WFM zentrale Zeitstempel — append-only (Migration 0190 PROPOSAL)';

-- --------------------------------------------------------------------------
-- 2. workforce_work_sessions — aggregierte Tages-/Schicht-Session
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.workforce_work_sessions (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  employee_id           UUID        NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  user_id               UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  work_date             DATE        NOT NULL,
  status                TEXT        NOT NULL DEFAULT 'offline' CHECK (status IN (
    'offline', 'clocked_in', 'paused', 'on_visit', 'driving', 'homeoffice',
    'office', 'standby', 'training', 'ended'
  )),
  work_mode             TEXT        NOT NULL DEFAULT 'none' CHECK (work_mode IN (
    'field', 'office', 'homeoffice', 'hybrid', 'standby', 'training', 'travel', 'none'
  )),
  display_status        TEXT        CHECK (display_status IS NULL OR display_status IN (
    'im_einsatz', 'buero', 'homeoffice', 'pause', 'unterwegs', 'feierabend',
    'krank', 'urlaub', 'offline'
  )),
  started_at            TIMESTAMPTZ,
  ended_at              TIMESTAMPTZ,
  last_event_at         TIMESTAMPTZ,
  gross_minutes         INTEGER     NOT NULL DEFAULT 0 CHECK (gross_minutes >= 0),
  net_minutes           INTEGER     NOT NULL DEFAULT 0 CHECK (net_minutes >= 0),
  pause_minutes         INTEGER     NOT NULL DEFAULT 0 CHECK (pause_minutes >= 0),
  current_visit_id      UUID        REFERENCES public.assist_visits(id) ON DELETE SET NULL,
  current_assignment_id UUID,
  location_label        TEXT,
  gps_status            TEXT        CHECK (gps_status IS NULL OR gps_status IN (
    'granted', 'denied', 'unavailable', 'not_requested'
  )),
  is_online             BOOLEAN     NOT NULL DEFAULT FALSE,
  metadata              JSONB       NOT NULL DEFAULT '{}'::jsonb,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, employee_id, work_date)
);

CREATE INDEX IF NOT EXISTS idx_workforce_work_sessions_tenant_date
  ON public.workforce_work_sessions (tenant_id, work_date DESC);

CREATE INDEX IF NOT EXISTS idx_workforce_work_sessions_tenant_status
  ON public.workforce_work_sessions (tenant_id, status, work_date)
  WHERE status NOT IN ('offline', 'ended');

CREATE INDEX IF NOT EXISTS idx_workforce_work_sessions_employee_open
  ON public.workforce_work_sessions (tenant_id, employee_id)
  WHERE ended_at IS NULL;

COMMENT ON TABLE public.workforce_work_sessions IS
  'WFM Live-Session pro Mitarbeiter/Tag — Realtime-fähig (Migration 0190 PROPOSAL)';

-- FK from events to sessions (deferred — session may be created after event in same txn)
ALTER TABLE public.workforce_time_events
  DROP CONSTRAINT IF EXISTS workforce_time_events_session_id_fkey;

ALTER TABLE public.workforce_time_events
  ADD CONSTRAINT workforce_time_events_session_id_fkey
  FOREIGN KEY (session_id) REFERENCES public.workforce_work_sessions(id) ON DELETE SET NULL;

-- --------------------------------------------------------------------------
-- 2b. Legacy employee_absences (FK target; remote had 0051 in history without table)
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.employee_absences (
  id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  employee_id             UUID        NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  absence_type            TEXT        NOT NULL CHECK (absence_type IN (
    'vacation', 'sick_leave', 'child_sick_leave', 'unpaid_leave', 'training',
    'public_holiday', 'blocked_time', 'appointment', 'no_availability', 'suspension', 'other'
  )),
  status                  TEXT        NOT NULL DEFAULT 'requested' CHECK (status IN (
    'requested', 'approved', 'rejected', 'cancelled', 'active', 'completed', 'requires_review', 'archived'
  )),
  starts_at               TIMESTAMPTZ NOT NULL,
  ends_at                 TIMESTAMPTZ NOT NULL,
  all_day                 BOOLEAN     NOT NULL DEFAULT TRUE,
  internal_notes          TEXT        NOT NULL DEFAULT '',
  employee_visible_note   TEXT        NOT NULL DEFAULT '',
  sick_details            TEXT,
  au_document_id          UUID,
  certificate_document_id UUID,
  replacement_required    BOOLEAN     NOT NULL DEFAULT FALSE,
  hide_details_from_admin BOOLEAN     NOT NULL DEFAULT FALSE,
  requested_days          NUMERIC(5,1),
  approved_by             UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  approved_at             TIMESTAMPTZ,
  rejected_by             UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  rejected_at             TIMESTAMPTZ,
  rejection_reason        TEXT,
  cancelled_at            TIMESTAMPTZ,
  qualification_updated   BOOLEAN     NOT NULL DEFAULT FALSE,
  created_by              UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_by              UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_employee_absences_tenant_employee
  ON public.employee_absences (tenant_id, employee_id, starts_at);

CREATE INDEX IF NOT EXISTS idx_employee_absences_tenant_status
  ON public.employee_absences (tenant_id, status, starts_at);

ALTER TABLE public.employee_absences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS employee_absences_tenant ON public.employee_absences;
CREATE POLICY employee_absences_tenant ON public.employee_absences
  FOR ALL
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());



-- --------------------------------------------------------------------------
-- 3. workforce_absences — canonical Abwesenheit (sync employee_absences Phase 2)
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.workforce_absences (
  id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  employee_id             UUID        NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  absence_type            TEXT        NOT NULL CHECK (absence_type IN (
    'vacation', 'sick_leave', 'child_sick_leave', 'unpaid_leave', 'training',
    'school', 'maternity', 'parental_leave', 'special_leave', 'business_trip',
    'public_holiday', 'blocked_time', 'other'
  )),
  status                  TEXT        NOT NULL DEFAULT 'requested' CHECK (status IN (
    'requested', 'approved', 'rejected', 'cancelled', 'active', 'completed'
  )),
  starts_at               TIMESTAMPTZ NOT NULL,
  ends_at                 TIMESTAMPTZ NOT NULL,
  all_day                 BOOLEAN     NOT NULL DEFAULT TRUE,
  requested_days          NUMERIC(5,1),
  employee_note           TEXT        NOT NULL DEFAULT '',
  internal_note           TEXT        NOT NULL DEFAULT '',
  legacy_absence_id       UUID        REFERENCES public.employee_absences(id) ON DELETE SET NULL,
  created_by              UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_workforce_absences_tenant_employee
  ON public.workforce_absences (tenant_id, employee_id, starts_at);

CREATE INDEX IF NOT EXISTS idx_workforce_absences_tenant_status
  ON public.workforce_absences (tenant_id, status, starts_at);

-- --------------------------------------------------------------------------
-- 4. workforce_approvals — unified Genehmigungsworkflow
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.workforce_approvals (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  employee_id       UUID        NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  approval_type     TEXT        NOT NULL CHECK (approval_type IN (
    'vacation', 'absence', 'homeoffice', 'time_correction', 'shift_swap', 'training'
  )),
  status            TEXT        NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'approved', 'rejected', 'cancelled'
  )),
  reference_type    TEXT        CHECK (reference_type IS NULL OR reference_type IN (
    'workforce_absence', 'workforce_time_event', 'homeoffice_correction_request'
  )),
  reference_id      UUID,
  requested_by      UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reviewed_by       UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at       TIMESTAMPTZ,
  rejection_reason  TEXT,
  payload           JSONB       NOT NULL DEFAULT '{}'::jsonb,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_workforce_approvals_tenant_status
  ON public.workforce_approvals (tenant_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_workforce_approvals_employee
  ON public.workforce_approvals (tenant_id, employee_id, created_at DESC);

-- --------------------------------------------------------------------------
-- 5. workforce_time_accounts — monatliche Snapshots
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.workforce_time_accounts (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  employee_id         UUID        NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  period_year         INTEGER     NOT NULL CHECK (period_year BETWEEN 2000 AND 2100),
  period_month        INTEGER     NOT NULL CHECK (period_month BETWEEN 1 AND 12),
  target_minutes      INTEGER     NOT NULL DEFAULT 0 CHECK (target_minutes >= 0),
  actual_minutes      INTEGER     NOT NULL DEFAULT 0 CHECK (actual_minutes >= 0),
  overtime_minutes    INTEGER     NOT NULL DEFAULT 0,
  undertime_minutes   INTEGER     NOT NULL DEFAULT 0 CHECK (undertime_minutes >= 0),
  pause_minutes       INTEGER     NOT NULL DEFAULT 0 CHECK (pause_minutes >= 0),
  absence_minutes     INTEGER     NOT NULL DEFAULT 0 CHECK (absence_minutes >= 0),
  field_minutes       INTEGER     NOT NULL DEFAULT 0 CHECK (field_minutes >= 0),
  office_minutes      INTEGER     NOT NULL DEFAULT 0 CHECK (office_minutes >= 0),
  homeoffice_minutes  INTEGER     NOT NULL DEFAULT 0 CHECK (homeoffice_minutes >= 0),
  travel_minutes      INTEGER     NOT NULL DEFAULT 0 CHECK (travel_minutes >= 0),
  vacation_days_used  NUMERIC(5,1) NOT NULL DEFAULT 0,
  sick_days           NUMERIC(5,1) NOT NULL DEFAULT 0,
  traffic_light       TEXT        CHECK (traffic_light IS NULL OR traffic_light IN ('green', 'yellow', 'red')),
  is_closed           BOOLEAN     NOT NULL DEFAULT FALSE,
  closed_at           TIMESTAMPTZ,
  closed_by           UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  metadata            JSONB       NOT NULL DEFAULT '{}'::jsonb,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, employee_id, period_year, period_month)
);

CREATE INDEX IF NOT EXISTS idx_workforce_time_accounts_tenant_period
  ON public.workforce_time_accounts (tenant_id, period_year, period_month);

-- --------------------------------------------------------------------------
-- 6. workforce_audit_log — revisionssichere Änderungen
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.workforce_audit_log (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  entity_type   TEXT        NOT NULL,
  entity_id     UUID        NOT NULL,
  action        TEXT        NOT NULL,
  actor_id      UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  summary       TEXT        NOT NULL,
  metadata      JSONB       NOT NULL DEFAULT '{}'::jsonb,
  prev_hash     TEXT,
  entry_hash    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_workforce_audit_log_tenant
  ON public.workforce_audit_log (tenant_id, created_at DESC);

-- --------------------------------------------------------------------------
-- Helper: resolve employee_id for current auth user within tenant
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.workforce_current_employee_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT e.id
  FROM public.employees e
  INNER JOIN public.profiles p ON p.id = e.profile_id
  WHERE p.id = auth.uid()
    AND e.tenant_id = public.current_tenant_id()
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.workforce_current_employee_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.workforce_current_employee_id() TO authenticated;

-- --------------------------------------------------------------------------
-- RLS
-- --------------------------------------------------------------------------
ALTER TABLE public.workforce_time_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workforce_work_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workforce_absences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workforce_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workforce_time_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workforce_audit_log ENABLE ROW LEVEL SECURITY;

-- time_events: insert own; select own / team / admin; NO update/delete
DROP POLICY IF EXISTS wfm_events_select ON public.workforce_time_events;
CREATE POLICY wfm_events_select ON public.workforce_time_events
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND (
      employee_id = public.workforce_current_employee_id()
      OR public.has_permission('time.tracking.team.view')
      OR public.has_permission('time.tracking.admin.view')
      OR public.has_permission('time.audit.view')
      OR public.is_tenant_admin()
    )
  );

DROP POLICY IF EXISTS wfm_events_insert ON public.workforce_time_events;
CREATE POLICY wfm_events_insert ON public.workforce_time_events
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND (
      (
        employee_id = public.workforce_current_employee_id()
        AND public.has_permission('time.tracking.own.start')
      )
      OR public.has_permission('time.tracking.admin.correct')
      OR public.is_tenant_admin()
    )
  );

-- work_sessions: select team; insert/update own or admin
DROP POLICY IF EXISTS wfm_sessions_select ON public.workforce_work_sessions;
CREATE POLICY wfm_sessions_select ON public.workforce_work_sessions
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND (
      employee_id = public.workforce_current_employee_id()
      OR public.has_permission('time.tracking.team.view')
      OR public.has_permission('time.tracking.admin.view')
      OR public.is_tenant_admin()
    )
  );

DROP POLICY IF EXISTS wfm_sessions_insert ON public.workforce_work_sessions;
CREATE POLICY wfm_sessions_insert ON public.workforce_work_sessions
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND (
      employee_id = public.workforce_current_employee_id()
      OR public.has_permission('time.tracking.admin.correct')
      OR public.is_tenant_admin()
    )
  );

DROP POLICY IF EXISTS wfm_sessions_update ON public.workforce_work_sessions;
CREATE POLICY wfm_sessions_update ON public.workforce_work_sessions
  FOR UPDATE TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND (
      employee_id = public.workforce_current_employee_id()
      OR public.has_permission('time.tracking.admin.correct')
      OR public.is_tenant_admin()
    )
  );

-- absences
DROP POLICY IF EXISTS wfm_absences_select ON public.workforce_absences;
CREATE POLICY wfm_absences_select ON public.workforce_absences
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND (
      employee_id = public.workforce_current_employee_id()
      OR public.has_permission('office.employees.absences.view')
      OR public.has_permission('portal.employee.absences.view')
      OR public.is_tenant_admin()
    )
  );

DROP POLICY IF EXISTS wfm_absences_insert ON public.workforce_absences;
CREATE POLICY wfm_absences_insert ON public.workforce_absences
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND (
      (
        employee_id = public.workforce_current_employee_id()
        AND public.has_permission('portal.employee.absences.request')
      )
      OR public.has_permission('office.employees.absences.manage')
      OR public.is_tenant_admin()
    )
  );

DROP POLICY IF EXISTS wfm_absences_update ON public.workforce_absences;
CREATE POLICY wfm_absences_update ON public.workforce_absences
  FOR UPDATE TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND (
      public.has_permission('office.employees.absences.manage')
      OR public.has_permission('office.employees.absences.approve')
      OR public.is_tenant_admin()
    )
  );

-- approvals
DROP POLICY IF EXISTS wfm_approvals_select ON public.workforce_approvals;
CREATE POLICY wfm_approvals_select ON public.workforce_approvals
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND (
      requested_by = auth.uid()
      OR employee_id = public.workforce_current_employee_id()
      OR public.has_permission('office.employees.absences.approve')
      OR public.has_permission('time.tracking.admin.view')
      OR public.is_tenant_admin()
    )
  );

DROP POLICY IF EXISTS wfm_approvals_insert ON public.workforce_approvals;
CREATE POLICY wfm_approvals_insert ON public.workforce_approvals
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND requested_by = auth.uid()
  );

DROP POLICY IF EXISTS wfm_approvals_update ON public.workforce_approvals;
CREATE POLICY wfm_approvals_update ON public.workforce_approvals
  FOR UPDATE TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND (
      public.has_permission('office.employees.absences.approve')
      OR public.has_permission('time.tracking.admin.correct')
      OR public.is_tenant_admin()
    )
  );

-- time_accounts
DROP POLICY IF EXISTS wfm_accounts_select ON public.workforce_time_accounts;
CREATE POLICY wfm_accounts_select ON public.workforce_time_accounts
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND (
      employee_id = public.workforce_current_employee_id()
      OR public.has_permission('time.tracking.team.view')
      OR public.has_permission('time.tracking.admin.view')
      OR public.is_tenant_admin()
    )
  );

DROP POLICY IF EXISTS wfm_accounts_manage ON public.workforce_time_accounts;
CREATE POLICY wfm_accounts_manage ON public.workforce_time_accounts
  FOR ALL TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND (
      public.has_permission('time.tracking.admin.correct')
      OR public.is_tenant_admin()
    )
  )
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND (
      public.has_permission('time.tracking.admin.correct')
      OR public.is_tenant_admin()
    )
  );

-- audit_log
DROP POLICY IF EXISTS wfm_audit_select ON public.workforce_audit_log;
CREATE POLICY wfm_audit_select ON public.workforce_audit_log
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND (
      public.has_permission('time.audit.view')
      OR public.has_permission('time.tracking.admin.view')
      OR public.is_tenant_admin()
    )
  );

DROP POLICY IF EXISTS wfm_audit_insert ON public.workforce_audit_log;
CREATE POLICY wfm_audit_insert ON public.workforce_audit_log
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.current_tenant_id());

-- --------------------------------------------------------------------------
-- GRANTs
-- --------------------------------------------------------------------------
GRANT SELECT, INSERT ON public.workforce_time_events TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.workforce_work_sessions TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.workforce_absences TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.workforce_approvals TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.workforce_time_accounts TO authenticated;
GRANT SELECT, INSERT ON public.workforce_audit_log TO authenticated;

-- --------------------------------------------------------------------------
-- Permission seeds (optional WFM-specific keys — reuse time.* for Phase 1)
-- --------------------------------------------------------------------------
-- INSERT INTO public.role_permissions (role_id, permission_key)
-- SELECT r.id, 'wfm.live.view'
-- FROM public.roles r
-- WHERE r.key IN ('business_admin', 'management', 'pdl', 'planning', 'office')
-- ON CONFLICT DO NOTHING;

COMMENT ON SCHEMA public IS 'WFM 0190 foundation tables added as PROPOSAL — not applied without approval';
