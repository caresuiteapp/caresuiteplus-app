-- LIVE.TRACKING.R12 — distinguish measured GPS kilometres from Google fallback.
ALTER TABLE public.employee_logbook_trips
  ADD COLUMN IF NOT EXISTS distance_source TEXT NOT NULL DEFAULT 'gps',
  ADD COLUMN IF NOT EXISTS google_route_distance_km NUMERIC(10,3),
  ADD COLUMN IF NOT EXISTS google_route_duration_minutes INTEGER,
  ADD COLUMN IF NOT EXISTS google_route_polyline TEXT,
  ADD COLUMN IF NOT EXISTS google_route_captured_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS route_quality_status TEXT NOT NULL DEFAULT 'measured';

ALTER TABLE public.employee_logbook_trips
  DROP CONSTRAINT IF EXISTS employee_logbook_trips_distance_source_check;
ALTER TABLE public.employee_logbook_trips
  ADD CONSTRAINT employee_logbook_trips_distance_source_check
  CHECK (distance_source IN ('gps','google_fallback','manual','office_corrected'));

ALTER TABLE public.employee_logbook_trips
  DROP CONSTRAINT IF EXISTS employee_logbook_trips_route_quality_check;
ALTER TABLE public.employee_logbook_trips
  ADD CONSTRAINT employee_logbook_trips_route_quality_check
  CHECK (route_quality_status IN ('measured','estimated_due_to_gps_gap','manual','corrected'));

COMMENT ON COLUMN public.employee_logbook_trips.google_route_distance_km IS
  'Google Directions reference captured when the employee opens navigation; never presented as measured GPS.';
COMMENT ON COLUMN public.employee_logbook_trips.distance_source IS
  'Auditable source of distance_final_km. Google fallback is used only for an incomplete GPS recording.';
