-- ==========================================================================
-- CareSuite+ — Migration 0046: Geo, Routes, GPS & Fahrtenbuch (preparedOnly)
-- Karten, Routing, Geofencing, Einsatz-Ortung und Fahrtenbuch — Schema-Prep.
-- Keine destruktiven Befehle. isGeoLiveReady() bleibt false bis Freigabe.
-- Datenschutz: zweckgebunden, mandantenspezifisch, auditierbar, Löschfristen.
-- ==========================================================================

CREATE TABLE IF NOT EXISTS public.geo_provider_configs (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  provider_key          TEXT        NOT NULL,
  label                 TEXT        NOT NULL,
  status                TEXT        NOT NULL DEFAULT 'prepared'
    CHECK (status IN ('prepared', 'configured', 'active', 'disabled')),
  credential_reference  TEXT,
  allowed_purposes      TEXT[]      NOT NULL DEFAULT ARRAY['address_validation', 'routing', 'geocoding'],
  external_data_allowed BOOLEAN     NOT NULL DEFAULT FALSE,
  retention_days        INTEGER     NOT NULL DEFAULT 90,
  configured_at         TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, provider_key)
);

CREATE TABLE IF NOT EXISTS public.geocoded_addresses (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  input_hash        TEXT        NOT NULL,
  raw_input         TEXT        NOT NULL,
  formatted_address TEXT,
  latitude          DOUBLE PRECISION,
  longitude         DOUBLE PRECISION,
  provider_key      TEXT        NOT NULL,
  confidence        TEXT        NOT NULL DEFAULT 'unknown'
    CHECK (confidence IN ('unknown', 'low', 'medium', 'high')),
  validated         BOOLEAN     NOT NULL DEFAULT FALSE,
  purpose           TEXT        NOT NULL DEFAULT 'address_validation',
  retention_until   TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_geocoded_addresses_tenant_hash
  ON public.geocoded_addresses (tenant_id, input_hash);

CREATE TABLE IF NOT EXISTS public.route_calculations (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  assignment_id       UUID,
  origin_address      TEXT        NOT NULL,
  destination_address TEXT        NOT NULL,
  provider_key        TEXT        NOT NULL,
  distance_km         DOUBLE PRECISION,
  duration_minutes    INTEGER,
  polyline            TEXT,
  purpose             TEXT        NOT NULL DEFAULT 'assignment_route',
  calculated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  retention_until     TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_route_calculations_tenant_assignment
  ON public.route_calculations (tenant_id, assignment_id, calculated_at DESC);

CREATE TABLE IF NOT EXISTS public.assignment_location_events (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  assignment_id       UUID        NOT NULL,
  employee_profile_id UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  event_type          TEXT        NOT NULL
    CHECK (event_type IN (
      'position_snapshot', 'unterwegs', 'angekommen', 'einsatz_gestartet',
      'status_plausibility', 'live_tracking_start', 'live_tracking_stop'
    )),
  latitude            DOUBLE PRECISION,
  longitude           DOUBLE PRECISION,
  accuracy_meters     DOUBLE PRECISION,
  purpose             TEXT        NOT NULL,
  consent_verified    BOOLEAN     NOT NULL DEFAULT FALSE,
  live_tracking       BOOLEAN     NOT NULL DEFAULT FALSE,
  recorded_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  retention_until     TIMESTAMPTZ,
  client_portal_visible_from  TIMESTAMPTZ,
  client_portal_visible_until TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_assignment_location_events_tenant
  ON public.assignment_location_events (tenant_id, assignment_id, recorded_at DESC);

CREATE TABLE IF NOT EXISTS public.geofence_events (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  assignment_id       UUID,
  geofence_label      TEXT        NOT NULL,
  event_type          TEXT        NOT NULL CHECK (event_type IN ('enter', 'exit', 'dwell')),
  latitude            DOUBLE PRECISION,
  longitude           DOUBLE PRECISION,
  validated           BOOLEAN     NOT NULL DEFAULT FALSE,
  proof_eligible      BOOLEAN     NOT NULL DEFAULT FALSE,
  purpose             TEXT        NOT NULL DEFAULT 'geofence_check',
  recorded_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  retention_until     TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_geofence_events_tenant
  ON public.geofence_events (tenant_id, assignment_id, recorded_at DESC);

CREATE TABLE IF NOT EXISTS public.mileage_log_entries (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  trip_id             UUID,
  assignment_id       UUID,
  employee_profile_id UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  start_address       TEXT,
  end_address         TEXT,
  distance_km         DOUBLE PRECISION,
  purpose             TEXT        NOT NULL DEFAULT 'business_trip',
  source              TEXT        NOT NULL DEFAULT 'manual'
    CHECK (source IN ('manual', 'route_calculation', 'gps_prepared')),
  status              TEXT        NOT NULL DEFAULT 'prepared'
    CHECK (status IN ('prepared', 'confirmed', 'exported', 'archived')),
  recorded_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  retention_until     TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mileage_log_entries_tenant
  ON public.mileage_log_entries (tenant_id, recorded_at DESC);

CREATE TABLE IF NOT EXISTS public.location_audit_events (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  actor_profile_id UUID       REFERENCES public.profiles(id) ON DELETE SET NULL,
  action          TEXT        NOT NULL,
  entity_type     TEXT        NOT NULL,
  entity_id       UUID,
  purpose         TEXT        NOT NULL,
  provider_key    TEXT,
  blocked_reason  TEXT,
  metadata        JSONB       NOT NULL DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_location_audit_events_tenant
  ON public.location_audit_events (tenant_id, created_at DESC);

ALTER TABLE public.geo_provider_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.geocoded_addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.route_calculations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignment_location_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.geofence_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mileage_log_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.location_audit_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY geo_provider_configs_tenant ON public.geo_provider_configs
  FOR ALL
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

CREATE POLICY geocoded_addresses_tenant ON public.geocoded_addresses
  FOR ALL
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

CREATE POLICY route_calculations_tenant ON public.route_calculations
  FOR ALL
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

CREATE POLICY assignment_location_events_tenant ON public.assignment_location_events
  FOR ALL
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

CREATE POLICY geofence_events_tenant ON public.geofence_events
  FOR ALL
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

CREATE POLICY mileage_log_entries_tenant ON public.mileage_log_entries
  FOR ALL
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

CREATE POLICY location_audit_events_tenant ON public.location_audit_events
  FOR ALL
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

GRANT SELECT, INSERT, UPDATE ON public.geo_provider_configs TO authenticated;
GRANT SELECT, INSERT ON public.geocoded_addresses TO authenticated;
GRANT SELECT, INSERT ON public.route_calculations TO authenticated;
GRANT SELECT, INSERT ON public.assignment_location_events TO authenticated;
GRANT SELECT, INSERT ON public.geofence_events TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.mileage_log_entries TO authenticated;
GRANT SELECT, INSERT ON public.location_audit_events TO authenticated;

COMMENT ON TABLE public.geo_provider_configs IS 'Mandanten-Kartenprovider — preparedOnly, external_data_allowed erst nach Freigabe';
COMMENT ON TABLE public.geocoded_addresses IS 'Geocodierte Adressen — zweckgebunden, mit Löschfrist';
COMMENT ON TABLE public.route_calculations IS 'Routenberechnungen — ohne Live-Tracking-Dauerüberwachung';
COMMENT ON TABLE public.assignment_location_events IS 'Einsatz-Ortungsereignisse — kein Dauertracking, nur Fenster + Zweck';
COMMENT ON TABLE public.geofence_events IS 'Geofence-Ereignisse — validated=false bis manuell/automatisch geprüft, kein Beweis ohne Validierung';
COMMENT ON TABLE public.mileage_log_entries IS 'Fahrtenbuch-Einträge — mandantenspezifisch, auditierbar';
COMMENT ON TABLE public.location_audit_events IS 'Audit-Trail für alle Standort-/Geo-Aktionen';
