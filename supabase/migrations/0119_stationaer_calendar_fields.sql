-- ==========================================================================
-- CareSuite+ — Migration 0119: Stationär Kalender-Felder + Indexe
-- Erweitert care_records für Stationär-Kalenderentitäten und indexiert calendar_events.
-- ==========================================================================

ALTER TABLE public.care_records
  ADD COLUMN IF NOT EXISTS starts_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ends_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS related_resident_id UUID,
  ADD COLUMN IF NOT EXISTS related_ward_id UUID,
  ADD COLUMN IF NOT EXISTS related_employee_id UUID REFERENCES public.employees(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS location_type TEXT,
  ADD COLUMN IF NOT EXISTS location_name TEXT,
  ADD COLUMN IF NOT EXISTS is_client_portal_visible BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_employee_portal_visible BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_relative_portal_visible BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_care_records_stationaer_calendar
  ON public.care_records (tenant_id, record_type, starts_at)
  WHERE record_type IN (
    'stationary_appointment',
    'resident_appointment',
    'stationary_activity',
    'resident_visit',
    'physician_visit',
    'therapy_appointment',
    'family_meeting',
    'ward_meeting',
    'admission_appointment',
    'resident_document_deadline',
    'stationary_task_deadline'
  );

CREATE INDEX IF NOT EXISTS idx_calendar_events_stationaer_module
  ON public.calendar_events (tenant_id, module_key, start_at)
  WHERE module_key = 'stationaer' AND archived_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_calendar_events_stationaer_ward
  ON public.calendar_events (tenant_id, related_ward_id, start_at)
  WHERE module_key = 'stationaer' AND archived_at IS NULL;

COMMENT ON COLUMN public.care_records.starts_at IS 'Kalender-Start für Stationär-Events (care_records record_type)';
COMMENT ON COLUMN public.care_records.ends_at IS 'Kalender-Ende für Stationär-Events (care_records record_type)';
