-- ==========================================================================
-- CareSuite+ — Migration 0050: Live Monitor, Notifications, Management Tasks
-- Prompt 60 — Live-Status, Benachrichtigungen, Audit, Verwaltungsmonitor
-- ==========================================================================

CREATE TABLE IF NOT EXISTS public.assignment_status_events (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  assignment_id   UUID        NOT NULL,
  actor_user_id   UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  actor_role      TEXT,
  old_status      TEXT,
  new_status      TEXT,
  event_type      TEXT        NOT NULL,
  event_time      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  source          TEXT        NOT NULL DEFAULT 'system',
  metadata        JSONB       NOT NULL DEFAULT '{}'::jsonb,
  ip_address      INET,
  device_id       TEXT,
  location_note   TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_assignment_status_events_tenant
  ON public.assignment_status_events (tenant_id, assignment_id, event_time DESC);

CREATE TABLE IF NOT EXISTS public.live_operation_events (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  assignment_id   UUID        NOT NULL,
  actor_user_id   UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  actor_role      TEXT,
  old_status      TEXT,
  new_status      TEXT,
  event_type      TEXT        NOT NULL,
  event_time      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  source          TEXT        NOT NULL DEFAULT 'system',
  metadata        JSONB       NOT NULL DEFAULT '{}'::jsonb,
  ip_address      INET,
  device_id       TEXT,
  location_note   TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_live_operation_events_tenant
  ON public.live_operation_events (tenant_id, event_time DESC);

CREATE TABLE IF NOT EXISTS public.monitor_notifications (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  assignment_id   UUID,
  recipient_type  TEXT        NOT NULL CHECK (recipient_type IN ('admin', 'employee', 'client')),
  recipient_id    UUID,
  channel         TEXT        NOT NULL DEFAULT 'in_app',
  priority        TEXT        NOT NULL DEFAULT 'normal',
  event_type      TEXT        NOT NULL,
  title           TEXT        NOT NULL,
  body            TEXT        NOT NULL,
  read_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_monitor_notifications_tenant
  ON public.monitor_notifications (tenant_id, recipient_type, created_at DESC);

CREATE TABLE IF NOT EXISTS public.notification_preferences (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id         UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  channel         TEXT        NOT NULL,
  event_type      TEXT        NOT NULL,
  enabled         BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, user_id, channel, event_type)
);

CREATE TABLE IF NOT EXISTS public.notification_deliveries (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id UUID        NOT NULL REFERENCES public.monitor_notifications(id) ON DELETE CASCADE,
  channel         TEXT        NOT NULL,
  status          TEXT        NOT NULL DEFAULT 'pending',
  attempted_at    TIMESTAMPTZ,
  error_message   TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.management_tasks (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  assignment_id   UUID        NOT NULL,
  task_type       TEXT        NOT NULL,
  status          TEXT        NOT NULL DEFAULT 'open',
  title           TEXT        NOT NULL,
  description     TEXT        NOT NULL DEFAULT '',
  priority        TEXT        NOT NULL DEFAULT 'normal',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at     TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_management_tasks_tenant
  ON public.management_tasks (tenant_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS public.problem_reports (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  assignment_id   UUID        NOT NULL,
  employee_id     UUID        NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  report_type     TEXT        NOT NULL,
  description     TEXT        NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.emergency_reports (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  assignment_id       UUID        NOT NULL,
  employee_id         UUID        NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  description         TEXT        NOT NULL,
  protocol_prepared   BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.correction_requests (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  assignment_id   UUID        NOT NULL,
  requested_by    UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reason          TEXT        NOT NULL,
  status          TEXT        NOT NULL DEFAULT 'open',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at    TIMESTAMPTZ
);

-- RLS
ALTER TABLE public.assignment_status_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.live_operation_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monitor_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.management_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.problem_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.emergency_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.correction_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS assignment_status_events_tenant ON public.assignment_status_events;
CREATE POLICY assignment_status_events_tenant ON public.assignment_status_events
  FOR ALL USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS live_operation_events_tenant ON public.live_operation_events;
CREATE POLICY live_operation_events_tenant ON public.live_operation_events
  FOR ALL USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS monitor_notifications_tenant ON public.monitor_notifications;
CREATE POLICY monitor_notifications_tenant ON public.monitor_notifications
  FOR ALL USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS notification_preferences_tenant ON public.notification_preferences;
CREATE POLICY notification_preferences_tenant ON public.notification_preferences
  FOR ALL USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS notification_deliveries_tenant ON public.notification_deliveries;
CREATE POLICY notification_deliveries_tenant ON public.notification_deliveries
  FOR ALL USING (
    notification_id IN (
      SELECT id FROM public.monitor_notifications WHERE tenant_id = public.current_tenant_id()
    )
  );

DROP POLICY IF EXISTS management_tasks_tenant ON public.management_tasks;
CREATE POLICY management_tasks_tenant ON public.management_tasks
  FOR ALL USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS problem_reports_tenant ON public.problem_reports;
CREATE POLICY problem_reports_tenant ON public.problem_reports
  FOR ALL USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS emergency_reports_tenant ON public.emergency_reports;
CREATE POLICY emergency_reports_tenant ON public.emergency_reports
  FOR ALL USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS correction_requests_tenant ON public.correction_requests;
CREATE POLICY correction_requests_tenant ON public.correction_requests
  FOR ALL USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

GRANT SELECT, INSERT ON public.assignment_status_events TO authenticated;
GRANT SELECT, INSERT ON public.live_operation_events TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.monitor_notifications TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.notification_preferences TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.notification_deliveries TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.management_tasks TO authenticated;
GRANT SELECT, INSERT ON public.problem_reports TO authenticated;
GRANT SELECT, INSERT ON public.emergency_reports TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.correction_requests TO authenticated;

COMMENT ON TABLE public.live_operation_events IS 'Live-Ereignisse für Verwaltungsmonitor (Prompt 60)';
COMMENT ON TABLE public.management_tasks IS 'Automatische Verwaltungsaufgaben aus Einsatz-Ereignissen';
