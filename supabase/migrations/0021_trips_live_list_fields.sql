-- ==========================================================================
-- CareSuite+ — Migration 0021: trips Live-Listen-Felder
-- Erweitert public.trips für Assist Fahrtenbuch (Sprint 22/23 Live-Mapping).
-- Keine destruktiven Befehle (DROP/TRUNCATE/DELETE).
-- ==========================================================================

ALTER TABLE public.trips
  ADD COLUMN IF NOT EXISTS employee_name TEXT,
  ADD COLUMN IF NOT EXISTS vehicle_label TEXT,
  ADD COLUMN IF NOT EXISTS purpose TEXT,
  ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ended_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_trips_tenant_started
  ON public.trips (tenant_id, started_at DESC NULLS LAST);

COMMENT ON COLUMN public.trips.employee_name IS 'Anzeigename Fahrer:in für Live-Fahrtenliste';
COMMENT ON COLUMN public.trips.vehicle_label IS 'Fahrzeugbezeichnung für Live-Fahrtenliste';
COMMENT ON COLUMN public.trips.purpose IS 'Fahrtzweck: einsatz, dienstfahrt, material, sonstiges';
COMMENT ON COLUMN public.trips.started_at IS 'Fahrtbeginn für Live-Fahrtenliste';
COMMENT ON COLUMN public.trips.ended_at IS 'Fahrtende (optional)';
