-- ==========================================================================
-- CareSuite+ — Migration 0030: assist_tracking_dashboard Live-Snapshot
-- Mandantenbezogener Live-Tracking-Dashboard-Snapshot (Sprint 37 Live-Mapping).
-- Keine destruktiven Befehle (DROP/TRUNCATE/DELETE).
-- ==========================================================================

CREATE TABLE IF NOT EXISTS public.assist_tracking_dashboard (
  tenant_id              UUID        PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
  active_trips           INTEGER     NOT NULL DEFAULT 0,
  employees_on_route     INTEGER     NOT NULL DEFAULT 0,
  geofence_alerts_today  INTEGER     NOT NULL DEFAULT 0,
  positions              JSONB       NOT NULL DEFAULT '[]'::jsonb,
  recent_events          JSONB       NOT NULL DEFAULT '[]'::jsonb,
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.assist_tracking_dashboard ENABLE ROW LEVEL SECURITY;

CREATE POLICY assist_tracking_dashboard_tenant_isolation ON public.assist_tracking_dashboard
  FOR ALL
  USING (tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()))
  WITH CHECK (tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));

COMMENT ON TABLE public.assist_tracking_dashboard IS 'Live-Tracking-Dashboard-Snapshot pro Mandant (Sprint 37)';
COMMENT ON COLUMN public.assist_tracking_dashboard.positions IS 'Aktuelle Fahrzeug-/Mitarbeiter-Positionen als JSON-Array';
COMMENT ON COLUMN public.assist_tracking_dashboard.recent_events IS 'Geofence-Ereignisse als JSON-Array';
