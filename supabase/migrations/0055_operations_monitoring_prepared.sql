-- ==========================================================================
-- CareSuite+ — Migration 0055: Betrieb, Backup, Monitoring (prepared)
-- Prompt — Systemstatus, Fehlerlogs, Incidents, Backup/Wiederherstellung vorbereitet
-- NICHT remote pushen bis Live-Infrastruktur bereit ist.
-- ==========================================================================

CREATE TABLE IF NOT EXISTS public.system_health_checks (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  component           TEXT        NOT NULL,
  status              TEXT        NOT NULL DEFAULT 'unknown' CHECK (status IN (
    'healthy', 'degraded', 'unhealthy', 'unknown', 'prepared'
  )),
  last_checked_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  message             TEXT        NOT NULL DEFAULT '',
  prepared_only       BOOLEAN     NOT NULL DEFAULT TRUE,
  availability_note   TEXT        NOT NULL DEFAULT 'Kein 24/7-Betriebsversprechen.',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_system_health_checks_tenant
  ON public.system_health_checks (tenant_id, component, last_checked_at DESC);

CREATE TABLE IF NOT EXISTS public.system_error_logs (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  source              TEXT        NOT NULL,
  category            TEXT        NOT NULL DEFAULT 'general' CHECK (category IN (
    'general', 'sync', 'edge_function', 'connect', 'auth', 'database'
  )),
  severity            TEXT        NOT NULL DEFAULT 'error' CHECK (severity IN (
    'info', 'warning', 'error', 'critical'
  )),
  message             TEXT        NOT NULL,
  error_code          TEXT,
  correlation_id      TEXT,
  metadata            JSONB       NOT NULL DEFAULT '{}'::jsonb,
  acknowledged_at     TIMESTAMPTZ,
  incident_ticket_id  UUID,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_system_error_logs_tenant
  ON public.system_error_logs (tenant_id, category, created_at DESC);

CREATE TABLE IF NOT EXISTS public.incident_tickets (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  ticket_number       TEXT        NOT NULL,
  title               TEXT        NOT NULL,
  description         TEXT        NOT NULL DEFAULT '',
  status              TEXT        NOT NULL DEFAULT 'detected' CHECK (status IN (
    'detected', 'triaged', 'in_progress', 'mitigated', 'resolved',
    'postmortem_required', 'archived'
  )),
  severity            TEXT        NOT NULL DEFAULT 'error' CHECK (severity IN (
    'info', 'warning', 'error', 'critical'
  )),
  source_error_log_id UUID        REFERENCES public.system_error_logs(id) ON DELETE SET NULL,
  internal_task_id    TEXT,
  detected_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  triaged_at          TIMESTAMPTZ,
  resolved_at         TIMESTAMPTZ,
  postmortem_required BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, ticket_number)
);

CREATE INDEX IF NOT EXISTS idx_incident_tickets_tenant
  ON public.incident_tickets (tenant_id, status, detected_at DESC);

CREATE TABLE IF NOT EXISTS public.backup_status_records (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  scope               TEXT        NOT NULL CHECK (scope IN (
    'database', 'storage', 'edge_functions', 'full'
  )),
  status              TEXT        NOT NULL DEFAULT 'not_configured' CHECK (status IN (
    'not_configured', 'prepared', 'unknown'
  )),
  last_backup_at      TIMESTAMPTZ,
  retention_days      INTEGER,
  prepared_only       BOOLEAN     NOT NULL DEFAULT TRUE,
  message             TEXT        NOT NULL DEFAULT 'Backup-Pipeline nicht aktiv.',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_backup_status_records_tenant
  ON public.backup_status_records (tenant_id, scope);

CREATE TABLE IF NOT EXISTS public.restore_test_records (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  scope               TEXT        NOT NULL CHECK (scope IN ('database', 'storage', 'full')),
  status              TEXT        NOT NULL DEFAULT 'prepared' CHECK (status IN (
    'prepared', 'not_run', 'passed', 'failed'
  )),
  tested_at           TIMESTAMPTZ,
  prepared_only       BOOLEAN     NOT NULL DEFAULT TRUE,
  message             TEXT        NOT NULL DEFAULT 'Restore-Test vorbereitet.',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_restore_test_records_tenant
  ON public.restore_test_records (tenant_id, scope);

CREATE TABLE IF NOT EXISTS public.maintenance_windows (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  title               TEXT        NOT NULL,
  description         TEXT        NOT NULL DEFAULT '',
  scheduled_start     TIMESTAMPTZ NOT NULL,
  scheduled_end       TIMESTAMPTZ NOT NULL,
  status              TEXT        NOT NULL DEFAULT 'prepared' CHECK (status IN (
    'scheduled', 'active', 'completed', 'cancelled', 'prepared'
  )),
  prepared_only       BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_maintenance_windows_tenant
  ON public.maintenance_windows (tenant_id, scheduled_start DESC);

CREATE TABLE IF NOT EXISTS public.release_notes (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  version             TEXT        NOT NULL,
  title               TEXT        NOT NULL,
  body                TEXT        NOT NULL DEFAULT '',
  published_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  prepared_only       BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_release_notes_tenant
  ON public.release_notes (tenant_id, published_at DESC);

CREATE TABLE IF NOT EXISTS public.operations_audit_events (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  action              TEXT        NOT NULL,
  entity_type         TEXT        NOT NULL,
  entity_id           UUID,
  actor_user_id       UUID,
  actor_role_key      TEXT,
  details             TEXT        NOT NULL DEFAULT '',
  metadata            JSONB       NOT NULL DEFAULT '{}'::jsonb,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_operations_audit_events_tenant
  ON public.operations_audit_events (tenant_id, created_at DESC);

ALTER TABLE public.system_health_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_error_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incident_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.backup_status_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restore_test_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maintenance_windows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.release_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operations_audit_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS system_health_checks_tenant ON public.system_health_checks;
CREATE POLICY system_health_checks_tenant ON public.system_health_checks
  FOR ALL USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS system_error_logs_tenant ON public.system_error_logs;
CREATE POLICY system_error_logs_tenant ON public.system_error_logs
  FOR ALL USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS incident_tickets_tenant ON public.incident_tickets;
CREATE POLICY incident_tickets_tenant ON public.incident_tickets
  FOR ALL USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS backup_status_records_tenant ON public.backup_status_records;
CREATE POLICY backup_status_records_tenant ON public.backup_status_records
  FOR ALL USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS restore_test_records_tenant ON public.restore_test_records;
CREATE POLICY restore_test_records_tenant ON public.restore_test_records
  FOR ALL USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS maintenance_windows_tenant ON public.maintenance_windows;
CREATE POLICY maintenance_windows_tenant ON public.maintenance_windows
  FOR ALL USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS release_notes_tenant ON public.release_notes;
CREATE POLICY release_notes_tenant ON public.release_notes
  FOR ALL USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS operations_audit_events_tenant ON public.operations_audit_events;
CREATE POLICY operations_audit_events_tenant ON public.operations_audit_events
  FOR ALL USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

GRANT SELECT, INSERT, UPDATE ON public.system_health_checks TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.system_error_logs TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.incident_tickets TO authenticated;
GRANT SELECT ON public.backup_status_records TO authenticated;
GRANT SELECT ON public.restore_test_records TO authenticated;
GRANT SELECT ON public.maintenance_windows TO authenticated;
GRANT SELECT ON public.release_notes TO authenticated;
GRANT SELECT, INSERT ON public.operations_audit_events TO authenticated;

COMMENT ON TABLE public.system_health_checks IS 'Betrieb & Monitoring — letzter Systemcheck, kein 24/7-Versprechen (prepared)';
COMMENT ON TABLE public.system_error_logs IS 'Mandantenspezifische Fehlerprotokollierung — ohne sensible Daten';
COMMENT ON TABLE public.incident_tickets IS 'Incident Management — verknüpft mit internal_tasks (Prompt 69)';
COMMENT ON TABLE public.backup_status_records IS 'Backupstatus preparedOnly — keine aktive Backup-Pipeline';
COMMENT ON TABLE public.restore_test_records IS 'Wiederherstellungstests preparedOnly';
COMMENT ON TABLE public.maintenance_windows IS 'Wartungsfenster preparedOnly';
COMMENT ON TABLE public.release_notes IS 'Release Notes je Mandant';
COMMENT ON TABLE public.operations_audit_events IS 'Audit-Trail für Betrieb & Monitoring';
