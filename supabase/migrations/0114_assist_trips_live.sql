-- ==========================================================================
-- CareSuite+ — Migration 0114: Assist Fahrtenbuch (trips) auf Live
-- Live-Projekt euagyyztvmemuaiumvxm: public.trips fehlte (0007 nie angewendet).
-- Konsolidiert Basis (0007), Listen-Felder (0021), Detail-Felder (0022),
-- Tracking-Dashboard (0030) und GPS-Events-Prep (0034).
-- RLS: is_tenant_member(tenant_id) — Pattern 0113_voicecore_ai.sql
-- Keine destruktiven Befehle (DROP/TRUNCATE/DELETE auf Daten).
-- ==========================================================================

-- --------------------------------------------------------------------------
-- trips — Assist Fahrtenbuch
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.trips (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID          NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  title           TEXT          NOT NULL,
  status          TEXT          NOT NULL DEFAULT 'entwurf',
  distance_km     NUMERIC(8, 2),
  employee_name   TEXT,
  vehicle_label   TEXT,
  purpose         TEXT,
  started_at      TIMESTAMPTZ,
  ended_at        TIMESTAMPTZ,
  start_address   TEXT,
  end_address     TEXT,
  notes           TEXT,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

ALTER TABLE public.trips
  ADD COLUMN IF NOT EXISTS employee_name TEXT,
  ADD COLUMN IF NOT EXISTS vehicle_label TEXT,
  ADD COLUMN IF NOT EXISTS purpose TEXT,
  ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ended_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS start_address TEXT,
  ADD COLUMN IF NOT EXISTS end_address TEXT,
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS distance_km NUMERIC(8, 2);

CREATE INDEX IF NOT EXISTS idx_trips_tenant_status
  ON public.trips (tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_trips_tenant_started
  ON public.trips (tenant_id, started_at DESC NULLS LAST);

COMMENT ON TABLE public.trips IS 'Assist Fahrtenbuch — Live (Migration 0114, konsolidiert 0007/0021/0022)';
COMMENT ON COLUMN public.trips.employee_name IS 'Anzeigename Fahrer:in für Live-Fahrtenliste';
COMMENT ON COLUMN public.trips.vehicle_label IS 'Fahrzeugbezeichnung für Live-Fahrtenliste';
COMMENT ON COLUMN public.trips.purpose IS 'Fahrtzweck: einsatz, dienstfahrt, material, sonstiges';
COMMENT ON COLUMN public.trips.started_at IS 'Fahrtbeginn für Live-Fahrtenliste';
COMMENT ON COLUMN public.trips.ended_at IS 'Fahrtende (optional)';
COMMENT ON COLUMN public.trips.start_address IS 'Startadresse für Live-Fahrtdetail';
COMMENT ON COLUMN public.trips.end_address IS 'Zieladresse für Live-Fahrtdetail (optional bei laufender Fahrt)';
COMMENT ON COLUMN public.trips.notes IS 'Notizen zur Fahrt (optional)';

-- --------------------------------------------------------------------------
-- assist_tracking_dashboard — Live-Tracking Snapshot
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.assist_tracking_dashboard (
  tenant_id              UUID        PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
  active_trips           INTEGER     NOT NULL DEFAULT 0,
  employees_on_route     INTEGER     NOT NULL DEFAULT 0,
  geofence_alerts_today  INTEGER     NOT NULL DEFAULT 0,
  positions              JSONB       NOT NULL DEFAULT '[]'::jsonb,
  recent_events          JSONB       NOT NULL DEFAULT '[]'::jsonb,
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.assist_tracking_dashboard IS 'Live-Tracking-Dashboard-Snapshot pro Mandant (Sprint 37)';

-- --------------------------------------------------------------------------
-- trip_gps_events — GPS Backend Prep
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.trip_gps_events (
  id              UUID             PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID             NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  trip_id         UUID             NOT NULL,
  latitude        DOUBLE PRECISION NOT NULL,
  longitude       DOUBLE PRECISION NOT NULL,
  accuracy_meters DOUBLE PRECISION,
  recorded_at     TIMESTAMPTZ      NOT NULL DEFAULT NOW(),
  source          TEXT             NOT NULL DEFAULT 'device',
  created_at      TIMESTAMPTZ      NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_trip_gps_events_tenant_trip
  ON public.trip_gps_events (tenant_id, trip_id, recorded_at DESC);

COMMENT ON TABLE public.trip_gps_events IS 'GPS-Ortungsereignisse pro Fahrt — Backend-Prep (Sprint 79)';

-- --------------------------------------------------------------------------
-- updated_at Trigger
-- --------------------------------------------------------------------------
DROP TRIGGER IF EXISTS set_trips_updated_at ON public.trips;
CREATE TRIGGER set_trips_updated_at
  BEFORE UPDATE ON public.trips
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- --------------------------------------------------------------------------
-- RLS — is_tenant_member(tenant_id)
-- --------------------------------------------------------------------------
ALTER TABLE public.trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assist_tracking_dashboard ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trip_gps_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS trips_tenant ON public.trips;
CREATE POLICY trips_tenant ON public.trips
  FOR ALL TO authenticated
  USING (public.is_tenant_member(tenant_id))
  WITH CHECK (public.is_tenant_member(tenant_id));

DROP POLICY IF EXISTS assist_tracking_dashboard_tenant ON public.assist_tracking_dashboard;
CREATE POLICY assist_tracking_dashboard_tenant ON public.assist_tracking_dashboard
  FOR ALL TO authenticated
  USING (public.is_tenant_member(tenant_id))
  WITH CHECK (public.is_tenant_member(tenant_id));

DROP POLICY IF EXISTS trip_gps_events_tenant ON public.trip_gps_events;
CREATE POLICY trip_gps_events_tenant ON public.trip_gps_events
  FOR ALL TO authenticated
  USING (public.is_tenant_member(tenant_id))
  WITH CHECK (public.is_tenant_member(tenant_id));

GRANT SELECT, INSERT, UPDATE ON public.trips TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.assist_tracking_dashboard TO authenticated;
GRANT SELECT, INSERT ON public.trip_gps_events TO authenticated;
