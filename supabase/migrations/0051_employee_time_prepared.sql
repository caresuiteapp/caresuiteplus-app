-- ==========================================================================
-- CareSuite+ — Migration 0051: Employee Time / Payroll Export (prepared)
-- Arbeitszeit, Fahrzeit, Pausen, Lohnexport-Vorbereitung
-- Keine produktiven Provider-Transfers ohne Connect-Konfiguration.
-- ==========================================================================

-- --------------------------------------------------------------------------
-- 1. employee_time_entries — berechnete/korrigierte Zeiteinträge
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.employee_time_entries (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  employee_id           UUID        NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  assignment_id         UUID,
  entry_type            TEXT        NOT NULL
    CHECK (entry_type IN (
      'assignment_time', 'travel_time', 'break_time', 'admin_time',
      'training_time', 'sick_time', 'vacation_time', 'standby_time', 'correction_time'
    )),
  period_date           DATE        NOT NULL,
  started_at            TIMESTAMPTZ,
  ended_at              TIMESTAMPTZ,
  gross_minutes         INTEGER     NOT NULL DEFAULT 0 CHECK (gross_minutes >= 0),
  pause_minutes         INTEGER     NOT NULL DEFAULT 0 CHECK (pause_minutes >= 0),
  net_minutes           INTEGER     NOT NULL DEFAULT 0 CHECK (net_minutes >= 0),
  travel_minutes        INTEGER     NOT NULL DEFAULT 0 CHECK (travel_minutes >= 0),
  paid_minutes          INTEGER     NOT NULL DEFAULT 0 CHECK (paid_minutes >= 0),
  unpaid_minutes        INTEGER     NOT NULL DEFAULT 0 CHECK (unpaid_minutes >= 0),
  planned_minutes       INTEGER     CHECK (planned_minutes IS NULL OR planned_minutes >= 0),
  deviation_minutes     INTEGER,
  status                TEXT        NOT NULL DEFAULT 'draft'
    CHECK (status IN (
      'draft', 'calculated', 'employee_review', 'correction_requested',
      'corrected', 'management_review', 'approved', 'exported', 'locked', 'rejected'
    )),
  plausibility_flags    JSONB       NOT NULL DEFAULT '[]'::jsonb,
  trace_reference       TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_employee_time_entries_tenant_employee
  ON public.employee_time_entries (tenant_id, employee_id, period_date DESC);

CREATE INDEX IF NOT EXISTS idx_employee_time_entries_assignment
  ON public.employee_time_entries (tenant_id, assignment_id)
  WHERE assignment_id IS NOT NULL;

-- --------------------------------------------------------------------------
-- 2. employee_time_periods — Tages-/Wochen-/Monats-/Abrechnungsperioden
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.employee_time_periods (
  id                        UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                 UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  employee_id               UUID        NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  period_kind               TEXT        NOT NULL
    CHECK (period_kind IN ('daily', 'weekly', 'monthly', 'payroll_custom')),
  period_start              TIMESTAMPTZ NOT NULL,
  period_end                TIMESTAMPTZ NOT NULL,
  total_assignment_minutes  INTEGER     NOT NULL DEFAULT 0 CHECK (total_assignment_minutes >= 0),
  total_travel_minutes      INTEGER     NOT NULL DEFAULT 0 CHECK (total_travel_minutes >= 0),
  total_break_minutes       INTEGER     NOT NULL DEFAULT 0 CHECK (total_break_minutes >= 0),
  total_paid_minutes        INTEGER     NOT NULL DEFAULT 0 CHECK (total_paid_minutes >= 0),
  total_unpaid_minutes      INTEGER     NOT NULL DEFAULT 0 CHECK (total_unpaid_minutes >= 0),
  status                    TEXT        NOT NULL DEFAULT 'draft'
    CHECK (status IN (
      'draft', 'calculated', 'employee_review', 'correction_requested',
      'corrected', 'management_review', 'approved', 'exported', 'locked', 'rejected'
    )),
  approved_by               UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  approved_at               TIMESTAMPTZ,
  exported_at               TIMESTAMPTZ,
  locked_at                 TIMESTAMPTZ,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT employee_time_periods_range CHECK (period_end > period_start)
);

CREATE INDEX IF NOT EXISTS idx_employee_time_periods_tenant
  ON public.employee_time_periods (tenant_id, employee_id, period_start DESC);

-- --------------------------------------------------------------------------
-- 3. employee_time_corrections — manuelle Korrekturen mit Begründung
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.employee_time_corrections (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  employee_id           UUID        NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  time_entry_id         UUID        NOT NULL REFERENCES public.employee_time_entries(id) ON DELETE CASCADE,
  corrected_start_at    TIMESTAMPTZ,
  corrected_end_at      TIMESTAMPTZ,
  correction_reason     TEXT        NOT NULL CHECK (length(trim(correction_reason)) > 0),
  corrected_by          UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  corrected_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  previous_status       TEXT        NOT NULL,
  audit_event_id        UUID        NOT NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_employee_time_corrections_entry
  ON public.employee_time_corrections (tenant_id, time_entry_id);

-- --------------------------------------------------------------------------
-- 4. assignment_pause_events — nachvollziehbare Pausen je Einsatz
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.assignment_pause_events (
  id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  assignment_id           UUID        NOT NULL,
  pause_start_at          TIMESTAMPTZ NOT NULL,
  pause_end_at            TIMESTAMPTZ,
  pause_duration_minutes  INTEGER     CHECK (pause_duration_minutes IS NULL OR pause_duration_minutes >= 0),
  pause_reason            TEXT,
  source                  TEXT        NOT NULL DEFAULT 'assignment_execution'
    CHECK (source IN ('assignment_execution', 'manual')),
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_assignment_pause_events_assignment
  ON public.assignment_pause_events (tenant_id, assignment_id, pause_start_at);

-- --------------------------------------------------------------------------
-- 5. travel_time_entries — Fahrzeiten je Einsatz/Mitarbeiter
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.travel_time_entries (
  id                        UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                 UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  employee_id               UUID        NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  assignment_id               UUID,
  route_started_at          TIMESTAMPTZ,
  route_finished_at         TIMESTAMPTZ,
  estimated_travel_minutes  INTEGER     CHECK (estimated_travel_minutes IS NULL OR estimated_travel_minutes >= 0),
  actual_travel_minutes     INTEGER     CHECK (actual_travel_minutes IS NULL OR actual_travel_minutes >= 0),
  distance_km               NUMERIC(8,2) CHECK (distance_km IS NULL OR distance_km >= 0),
  counts_as_work_time       BOOLEAN     NOT NULL DEFAULT FALSE,
  km_billable               BOOLEAN     NOT NULL DEFAULT FALSE,
  source                    TEXT        NOT NULL DEFAULT 'status_times'
    CHECK (source IN ('route_provider', 'manual', 'status_times')),
  trace_reference           TEXT,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_travel_time_entries_tenant
  ON public.travel_time_entries (tenant_id, employee_id, created_at DESC);

-- --------------------------------------------------------------------------
-- 6. mileage_log_entries — Fahrtenbuch (Lohn/Abrechnung, GPS optional)
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.mileage_log_entries (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  employee_id           UUID        NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  assignment_id         UUID,
  travel_time_entry_id  UUID        REFERENCES public.travel_time_entries(id) ON DELETE SET NULL,
  trip_date             DATE        NOT NULL,
  start_address         TEXT,
  end_address           TEXT,
  distance_km           NUMERIC(8,2) CHECK (distance_km IS NULL OR distance_km >= 0),
  purpose_category      TEXT,
  service_type          TEXT,
  km_billable           BOOLEAN     NOT NULL DEFAULT FALSE,
  gps_captured          BOOLEAN     NOT NULL DEFAULT FALSE,
  route_provider_used   BOOLEAN     NOT NULL DEFAULT FALSE,
  source                TEXT        NOT NULL DEFAULT 'assignment_sync'
    CHECK (source IN ('manual', 'route_calculation', 'assignment_sync')),
  status                TEXT        NOT NULL DEFAULT 'prepared'
    CHECK (status IN ('prepared', 'confirmed', 'exported')),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mileage_log_entries_tenant
  ON public.mileage_log_entries (tenant_id, employee_id, trip_date DESC);

-- --------------------------------------------------------------------------
-- 7. payroll_export_batches — Lohnexport-Läufe (kein Transfer ohne Connect)
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payroll_export_batches (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  provider_key          TEXT        NOT NULL
    CHECK (provider_key IN ('datev', 'lexware', 'agenda', 'csv', 'generic')),
  export_format         TEXT        NOT NULL
    CHECK (export_format IN ('csv', 'datev', 'lexware', 'agenda', 'generic')),
  status                TEXT        NOT NULL DEFAULT 'not_ready'
    CHECK (status IN (
      'not_ready', 'ready', 'exported', 'export_failed',
      'corrected_after_export', 'locked'
    )),
  period_start          TIMESTAMPTZ NOT NULL,
  period_end            TIMESTAMPTZ NOT NULL,
  employee_count        INTEGER     NOT NULL DEFAULT 0 CHECK (employee_count >= 0),
  item_count            INTEGER     NOT NULL DEFAULT 0 CHECK (item_count >= 0),
  external_transfer     BOOLEAN     NOT NULL DEFAULT FALSE,
  prepared_at           TIMESTAMPTZ,
  exported_at           TIMESTAMPTZ,
  locked_at             TIMESTAMPTZ,
  error_summary         TEXT,
  initiated_by          UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT payroll_export_batches_range CHECK (period_end > period_start)
);

CREATE INDEX IF NOT EXISTS idx_payroll_export_batches_tenant
  ON public.payroll_export_batches (tenant_id, created_at DESC);

-- --------------------------------------------------------------------------
-- 8. payroll_export_items — Exportpositionen je Mitarbeiter/Periode
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payroll_export_items (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  batch_id              UUID        NOT NULL REFERENCES public.payroll_export_batches(id) ON DELETE CASCADE,
  employee_id           UUID        NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  period_id             UUID        REFERENCES public.employee_time_periods(id) ON DELETE SET NULL,
  time_entry_ids        JSONB       NOT NULL DEFAULT '[]'::jsonb,
  payload_reference     TEXT        NOT NULL,
  total_paid_minutes    INTEGER     NOT NULL DEFAULT 0 CHECK (total_paid_minutes >= 0),
  status                TEXT        NOT NULL DEFAULT 'not_ready'
    CHECK (status IN (
      'not_ready', 'ready', 'exported', 'export_failed',
      'corrected_after_export', 'locked'
    )),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payroll_export_items_batch
  ON public.payroll_export_items (tenant_id, batch_id);

-- --------------------------------------------------------------------------
-- 9. payroll_export_audit_events — Audit für Lohnexport
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payroll_export_audit_events (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  batch_id              UUID        REFERENCES public.payroll_export_batches(id) ON DELETE SET NULL,
  action                TEXT        NOT NULL,
  actor_id              UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  summary               TEXT        NOT NULL,
  metadata              JSONB       NOT NULL DEFAULT '{}'::jsonb,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payroll_export_audit_tenant
  ON public.payroll_export_audit_events (tenant_id, created_at DESC);

-- --------------------------------------------------------------------------
-- RLS — mandantenisoliert
-- --------------------------------------------------------------------------
ALTER TABLE public.employee_time_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_time_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_time_corrections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignment_pause_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.travel_time_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mileage_log_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_export_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_export_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_export_audit_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS employee_time_entries_tenant ON public.employee_time_entries;
CREATE POLICY employee_time_entries_tenant ON public.employee_time_entries
  FOR ALL USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS employee_time_periods_tenant ON public.employee_time_periods;
CREATE POLICY employee_time_periods_tenant ON public.employee_time_periods
  FOR ALL USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS employee_time_corrections_tenant ON public.employee_time_corrections;
CREATE POLICY employee_time_corrections_tenant ON public.employee_time_corrections
  FOR ALL USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS assignment_pause_events_tenant ON public.assignment_pause_events;
CREATE POLICY assignment_pause_events_tenant ON public.assignment_pause_events
  FOR ALL USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS travel_time_entries_tenant ON public.travel_time_entries;
CREATE POLICY travel_time_entries_tenant ON public.travel_time_entries
  FOR ALL USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS mileage_log_entries_tenant ON public.mileage_log_entries;
CREATE POLICY mileage_log_entries_tenant ON public.mileage_log_entries
  FOR ALL USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS payroll_export_batches_tenant ON public.payroll_export_batches;
CREATE POLICY payroll_export_batches_tenant ON public.payroll_export_batches
  FOR ALL USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS payroll_export_items_tenant ON public.payroll_export_items;
CREATE POLICY payroll_export_items_tenant ON public.payroll_export_items
  FOR ALL USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS payroll_export_audit_events_tenant ON public.payroll_export_audit_events;
CREATE POLICY payroll_export_audit_events_tenant ON public.payroll_export_audit_events
  FOR ALL USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

COMMENT ON TABLE public.employee_time_entries IS 'Berechnete Arbeitszeiten — keine Fake-Zeiten, trace_reference auf Quellen';
COMMENT ON TABLE public.payroll_export_batches IS 'Lohnexport vorbereitet — external_transfer nur mit Connect-Konfiguration';
