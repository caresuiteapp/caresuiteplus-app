-- ==========================================================================
-- CareSuite+ — Migration 0034: trip_gps_events (GPS Backend Prep)
-- Vorbereitung für Echtzeit-GPS-Ortung pro Fahrt (Sprint 79).
-- Keine destruktiven Befehle (DROP/TRUNCATE/DELETE).
-- isGpsTrackingLiveReady() bleibt false bis App + Backend-Streaming aktiv.
-- ==========================================================================

CREATE TABLE IF NOT EXISTS public.trip_gps_events (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  trip_id         UUID        NOT NULL,
  latitude        DOUBLE PRECISION NOT NULL,
  longitude       DOUBLE PRECISION NOT NULL,
  accuracy_meters DOUBLE PRECISION,
  recorded_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  source          TEXT        NOT NULL DEFAULT 'device',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_trip_gps_events_tenant_trip
  ON public.trip_gps_events (tenant_id, trip_id, recorded_at DESC);

ALTER TABLE public.trip_gps_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY trip_gps_events_tenant_isolation ON public.trip_gps_events
  FOR ALL
  USING (tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()))
  WITH CHECK (tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));

COMMENT ON TABLE public.trip_gps_events IS 'GPS-Ortungsereignisse pro Fahrt — Backend-Prep (Sprint 79, preparedOnly bis Live-Flip)';
COMMENT ON COLUMN public.trip_gps_events.source IS 'device | geofence | manual';
