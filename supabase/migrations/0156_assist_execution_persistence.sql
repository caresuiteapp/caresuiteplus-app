-- ==========================================================================
-- CareSuite+ — Migration 0156: Assist Execution Persistence
-- Signatures, proofs, tracking sessions, location points, time events,
-- geofence events, driving log (+ proof attachments metadata).
-- RLS: is_tenant_member(tenant_id) — Pattern 0116/0114
-- Keine destruktiven Befehle (DROP/TRUNCATE/destructive DELETE).
-- Nicht remote angewendet — nur Repo-Vorbereitung (Assist Phase 3).
-- ==========================================================================

-- --------------------------------------------------------------------------
-- assist_visit_signatures — Payload-Hash + Storage-Pfad (kein Base64 in DB)
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.assist_visit_signatures (
  id                      UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               UUID          NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  visit_id                UUID          NOT NULL REFERENCES public.assist_visits(id) ON DELETE CASCADE,
  signer_name             TEXT          NOT NULL,
  signer_role             TEXT          NOT NULL,
  storage_path            TEXT          NOT NULL,
  payload_hash            TEXT          NOT NULL,
  signature_hash          TEXT          NOT NULL,
  signed_at               TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  signed_by_profile_id    UUID          REFERENCES public.profiles(id) ON DELETE SET NULL,
  is_valid                BOOLEAN       NOT NULL DEFAULT TRUE,
  invalidated_at          TIMESTAMPTZ,
  invalidation_reason     TEXT,
  metadata                JSONB         NOT NULL DEFAULT '{}'::jsonb,
  created_by              UUID          REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_by              UUID          REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at              TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  CONSTRAINT assist_visit_signatures_signer_name_nonempty
    CHECK (char_length(trim(signer_name)) > 0),
  CONSTRAINT assist_visit_signatures_storage_path_nonempty
    CHECK (char_length(trim(storage_path)) > 0),
  CONSTRAINT assist_visit_signatures_payload_hash_nonempty
    CHECK (char_length(trim(payload_hash)) > 0),
  CONSTRAINT assist_visit_signatures_signature_hash_nonempty
    CHECK (char_length(trim(signature_hash)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_assist_visit_signatures_tenant_visit
  ON public.assist_visit_signatures (tenant_id, visit_id, signed_at DESC);

CREATE INDEX IF NOT EXISTS idx_assist_visit_signatures_tenant_valid
  ON public.assist_visit_signatures (tenant_id, visit_id)
  WHERE is_valid = TRUE;

COMMENT ON TABLE public.assist_visit_signatures IS
  'Assist Einsatz-Signaturen — Bild in Storage, Hashes in DB (Migration 0156)';
COMMENT ON COLUMN public.assist_visit_signatures.storage_path IS
  'Supabase Storage Pfad (z. B. tenant/{tenantId}/assist/visits/{visitId}/signatures/…) — kein Base64';
COMMENT ON COLUMN public.assist_visit_signatures.payload_hash IS
  'SHA-256 kanonischer Visit-Payload zum Signierzeitpunkt';
COMMENT ON COLUMN public.assist_visit_signatures.signature_hash IS
  'SHA-256 der Signaturdatei oder Stroke-Daten';

-- --------------------------------------------------------------------------
-- assist_visit_proofs — Leistungsnachweis-Snapshot + optional PDF-Pfad
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.assist_visit_proofs (
  id                      UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               UUID          NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  visit_id                UUID          NOT NULL REFERENCES public.assist_visits(id) ON DELETE CASCADE,
  signature_id            UUID          REFERENCES public.assist_visit_signatures(id) ON DELETE SET NULL,
  proof_number            TEXT,
  status                  TEXT          NOT NULL DEFAULT 'draft',
  storage_path            TEXT,
  payload_snapshot        JSONB         NOT NULL DEFAULT '{}'::jsonb,
  payload_hash            TEXT,
  generated_at            TIMESTAMPTZ,
  generated_by            UUID          REFERENCES public.profiles(id) ON DELETE SET NULL,
  approved_at             TIMESTAMPTZ,
  approved_by             UUID          REFERENCES public.profiles(id) ON DELETE SET NULL,
  billing_released        BOOLEAN       NOT NULL DEFAULT FALSE,
  metadata                JSONB         NOT NULL DEFAULT '{}'::jsonb,
  created_by              UUID          REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_by              UUID          REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at              TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  CONSTRAINT assist_visit_proofs_status_check
    CHECK (status IN ('draft', 'pending_review', 'approved', 'exported', 'archived'))
);

CREATE INDEX IF NOT EXISTS idx_assist_visit_proofs_tenant_visit
  ON public.assist_visit_proofs (tenant_id, visit_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_assist_visit_proofs_tenant_status
  ON public.assist_visit_proofs (tenant_id, status);

COMMENT ON TABLE public.assist_visit_proofs IS
  'Assist Leistungsnachweise — Snapshot + optional PDF in Storage (Migration 0156)';

-- --------------------------------------------------------------------------
-- assist_proof_attachments — Metadaten zu Nachweis-Anhängen (Storage-Pattern 0103)
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.assist_proof_attachments (
  id                      UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               UUID          NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  proof_id                UUID          NOT NULL REFERENCES public.assist_visit_proofs(id) ON DELETE CASCADE,
  storage_path            TEXT          NOT NULL,
  file_name               TEXT          NOT NULL,
  mime_type               TEXT          NOT NULL,
  size_bytes              BIGINT,
  attachment_type         TEXT          NOT NULL DEFAULT 'document',
  created_by              UUID          REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at              TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  CONSTRAINT assist_proof_attachments_storage_path_nonempty
    CHECK (char_length(trim(storage_path)) > 0),
  CONSTRAINT assist_proof_attachments_type_check
    CHECK (attachment_type IN ('photo', 'document', 'signature_copy'))
);

CREATE INDEX IF NOT EXISTS idx_assist_proof_attachments_proof
  ON public.assist_proof_attachments (tenant_id, proof_id, created_at DESC);

COMMENT ON TABLE public.assist_proof_attachments IS
  'Metadaten zu Leistungsnachweis-Anhängen — Datei in Storage (Migration 0156)';

-- --------------------------------------------------------------------------
-- assist_tracking_sessions — GPS nur session-scoped, Consent erforderlich
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.assist_tracking_sessions (
  id                      UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               UUID          NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  visit_id                UUID          NOT NULL REFERENCES public.assist_visits(id) ON DELETE CASCADE,
  employee_id             UUID          REFERENCES public.employees(id) ON DELETE SET NULL,
  consent_granted_at      TIMESTAMPTZ   NOT NULL,
  consent_explained_at    TIMESTAMPTZ,
  started_at              TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  ended_at                TIMESTAMPTZ,
  end_reason              TEXT,
  source                  TEXT          NOT NULL DEFAULT 'employee_portal',
  is_active               BOOLEAN       NOT NULL DEFAULT TRUE,
  metadata                JSONB         NOT NULL DEFAULT '{}'::jsonb,
  created_at              TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  CONSTRAINT assist_tracking_sessions_source_check
    CHECK (source IN ('employee_portal', 'device', 'manual')),
  CONSTRAINT assist_tracking_sessions_end_reason_check
    CHECK (
      end_reason IS NULL
      OR end_reason IN ('completed', 'cancelled', 'timeout', 'manual_stop', 'status_change')
    )
);

CREATE INDEX IF NOT EXISTS idx_assist_tracking_sessions_tenant_visit
  ON public.assist_tracking_sessions (tenant_id, visit_id, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_assist_tracking_sessions_tenant_active
  ON public.assist_tracking_sessions (tenant_id, is_active)
  WHERE is_active = TRUE;

COMMENT ON TABLE public.assist_tracking_sessions IS
  'Assist GPS-Tracking-Sessions — nur Mitarbeiterportal, Consent Pflicht (Migration 0156)';

-- --------------------------------------------------------------------------
-- assist_location_points — Standortverlauf pro Session (append-only)
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.assist_location_points (
  id                      UUID             PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               UUID             NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  session_id              UUID             NOT NULL REFERENCES public.assist_tracking_sessions(id) ON DELETE CASCADE,
  visit_id                UUID             NOT NULL REFERENCES public.assist_visits(id) ON DELETE CASCADE,
  latitude                DOUBLE PRECISION NOT NULL,
  longitude               DOUBLE PRECISION NOT NULL,
  accuracy_meters         DOUBLE PRECISION,
  altitude_meters         DOUBLE PRECISION,
  speed_mps               DOUBLE PRECISION,
  heading_degrees         DOUBLE PRECISION,
  recorded_at             TIMESTAMPTZ      NOT NULL DEFAULT NOW(),
  source                  TEXT             NOT NULL DEFAULT 'device',
  created_at              TIMESTAMPTZ      NOT NULL DEFAULT NOW(),
  CONSTRAINT assist_location_points_lat_range
    CHECK (latitude >= -90 AND latitude <= 90),
  CONSTRAINT assist_location_points_lng_range
    CHECK (longitude >= -180 AND longitude <= 180),
  CONSTRAINT assist_location_points_source_check
    CHECK (source IN ('device', 'geofence', 'manual'))
);

CREATE INDEX IF NOT EXISTS idx_assist_location_points_session
  ON public.assist_location_points (tenant_id, session_id, recorded_at DESC);

CREATE INDEX IF NOT EXISTS idx_assist_location_points_visit
  ON public.assist_location_points (tenant_id, visit_id, recorded_at DESC);

COMMENT ON TABLE public.assist_location_points IS
  'Assist Standortpunkte — session-gebunden, append-only (Migration 0156)';

-- --------------------------------------------------------------------------
-- assist_time_events — Fahrt/Einsatz/Pause-Zeitstempel
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.assist_time_events (
  id                      UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               UUID          NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  visit_id                UUID          NOT NULL REFERENCES public.assist_visits(id) ON DELETE CASCADE,
  session_id              UUID          REFERENCES public.assist_tracking_sessions(id) ON DELETE SET NULL,
  event_type              TEXT          NOT NULL,
  occurred_at             TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  recorded_by             UUID          REFERENCES public.profiles(id) ON DELETE SET NULL,
  duration_seconds        INTEGER,
  metadata                JSONB         NOT NULL DEFAULT '{}'::jsonb,
  created_at              TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  CONSTRAINT assist_time_events_type_check
    CHECK (event_type IN (
      'drive_start', 'drive_end', 'service_start', 'service_end',
      'pause_start', 'pause_end', 'arrive', 'depart'
    )),
  CONSTRAINT assist_time_events_duration_nonneg
    CHECK (duration_seconds IS NULL OR duration_seconds >= 0)
);

CREATE INDEX IF NOT EXISTS idx_assist_time_events_tenant_visit
  ON public.assist_time_events (tenant_id, visit_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_assist_time_events_session
  ON public.assist_time_events (tenant_id, session_id, occurred_at DESC)
  WHERE session_id IS NOT NULL;

COMMENT ON TABLE public.assist_time_events IS
  'Assist Zeit-Events — Fahrt, Einsatz, Pause (Migration 0156)';

-- --------------------------------------------------------------------------
-- assist_geofence_events — Weicher Geofence-Check bei Ankunft (Audit)
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.assist_geofence_events (
  id                      UUID             PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               UUID             NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  visit_id                UUID             NOT NULL REFERENCES public.assist_visits(id) ON DELETE CASCADE,
  session_id              UUID             REFERENCES public.assist_tracking_sessions(id) ON DELETE SET NULL,
  check_type              TEXT             NOT NULL DEFAULT 'arrival',
  latitude                DOUBLE PRECISION,
  longitude               DOUBLE PRECISION,
  target_latitude         DOUBLE PRECISION,
  target_longitude        DOUBLE PRECISION,
  distance_meters         DOUBLE PRECISION,
  tolerance_meters        INTEGER          NOT NULL DEFAULT 150,
  inside_tolerance        BOOLEAN          NOT NULL DEFAULT TRUE,
  overridden              BOOLEAN          NOT NULL DEFAULT FALSE,
  override_reason         TEXT,
  warning_text            TEXT,
  checked_at              TIMESTAMPTZ      NOT NULL DEFAULT NOW(),
  created_at              TIMESTAMPTZ      NOT NULL DEFAULT NOW(),
  CONSTRAINT assist_geofence_events_check_type
    CHECK (check_type IN ('arrival', 'departure', 'periodic')),
  CONSTRAINT assist_geofence_events_tolerance_range
    CHECK (tolerance_meters >= 50 AND tolerance_meters <= 250)
);

CREATE INDEX IF NOT EXISTS idx_assist_geofence_events_tenant_visit
  ON public.assist_geofence_events (tenant_id, visit_id, checked_at DESC);

COMMENT ON TABLE public.assist_geofence_events IS
  'Assist Geofence-Prüfungen — weich, mit Override-Audit (Migration 0156)';

-- --------------------------------------------------------------------------
-- assist_driving_log — Fahrtenbuch-Einträge (Visit/Trip/Session-Verknüpfung)
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.assist_driving_log (
  id                      UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               UUID          NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  visit_id                UUID          REFERENCES public.assist_visits(id) ON DELETE SET NULL,
  trip_id                 UUID          REFERENCES public.trips(id) ON DELETE SET NULL,
  session_id              UUID          REFERENCES public.assist_tracking_sessions(id) ON DELETE SET NULL,
  employee_id             UUID          REFERENCES public.employees(id) ON DELETE SET NULL,
  purpose                 TEXT,
  started_at              TIMESTAMPTZ,
  ended_at                TIMESTAMPTZ,
  start_odometer_km       NUMERIC(10, 2),
  end_odometer_km         NUMERIC(10, 2),
  distance_km             NUMERIC(8, 2),
  start_address           TEXT,
  end_address             TEXT,
  correction_reason       TEXT,
  corrected_by            UUID          REFERENCES public.profiles(id) ON DELETE SET NULL,
  corrected_at            TIMESTAMPTZ,
  status                  TEXT          NOT NULL DEFAULT 'open',
  notes                   TEXT,
  created_by              UUID          REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_by              UUID          REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at              TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  CONSTRAINT assist_driving_log_status_check
    CHECK (status IN ('open', 'completed', 'corrected', 'cancelled')),
  CONSTRAINT assist_driving_log_distance_nonneg
    CHECK (distance_km IS NULL OR distance_km >= 0)
);

CREATE INDEX IF NOT EXISTS idx_assist_driving_log_tenant_employee
  ON public.assist_driving_log (tenant_id, employee_id, started_at DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS idx_assist_driving_log_tenant_visit
  ON public.assist_driving_log (tenant_id, visit_id)
  WHERE visit_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_assist_driving_log_tenant_trip
  ON public.assist_driving_log (tenant_id, trip_id)
  WHERE trip_id IS NOT NULL;

COMMENT ON TABLE public.assist_driving_log IS
  'Assist Fahrtenbuch-Log — ergänzt public.trips 0114 mit Visit/Session-Bezug (Migration 0156)';

-- --------------------------------------------------------------------------
-- updated_at triggers
-- --------------------------------------------------------------------------
DROP TRIGGER IF EXISTS set_assist_visit_signatures_updated_at ON public.assist_visit_signatures;
CREATE TRIGGER set_assist_visit_signatures_updated_at
  BEFORE UPDATE ON public.assist_visit_signatures
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_assist_visit_proofs_updated_at ON public.assist_visit_proofs;
CREATE TRIGGER set_assist_visit_proofs_updated_at
  BEFORE UPDATE ON public.assist_visit_proofs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_assist_tracking_sessions_updated_at ON public.assist_tracking_sessions;
CREATE TRIGGER set_assist_tracking_sessions_updated_at
  BEFORE UPDATE ON public.assist_tracking_sessions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_assist_driving_log_updated_at ON public.assist_driving_log;
CREATE TRIGGER set_assist_driving_log_updated_at
  BEFORE UPDATE ON public.assist_driving_log
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- --------------------------------------------------------------------------
-- RLS — is_tenant_member(tenant_id)
-- --------------------------------------------------------------------------
ALTER TABLE public.assist_visit_signatures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assist_visit_proofs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assist_proof_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assist_tracking_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assist_location_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assist_time_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assist_geofence_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assist_driving_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS assist_visit_signatures_tenant ON public.assist_visit_signatures;
CREATE POLICY assist_visit_signatures_tenant ON public.assist_visit_signatures
  FOR ALL TO authenticated
  USING (public.is_tenant_member(tenant_id))
  WITH CHECK (public.is_tenant_member(tenant_id));

DROP POLICY IF EXISTS assist_visit_proofs_tenant ON public.assist_visit_proofs;
CREATE POLICY assist_visit_proofs_tenant ON public.assist_visit_proofs
  FOR ALL TO authenticated
  USING (public.is_tenant_member(tenant_id))
  WITH CHECK (public.is_tenant_member(tenant_id));

DROP POLICY IF EXISTS assist_proof_attachments_tenant ON public.assist_proof_attachments;
CREATE POLICY assist_proof_attachments_tenant ON public.assist_proof_attachments
  FOR ALL TO authenticated
  USING (public.is_tenant_member(tenant_id))
  WITH CHECK (public.is_tenant_member(tenant_id));

DROP POLICY IF EXISTS assist_tracking_sessions_tenant ON public.assist_tracking_sessions;
CREATE POLICY assist_tracking_sessions_tenant ON public.assist_tracking_sessions
  FOR ALL TO authenticated
  USING (public.is_tenant_member(tenant_id))
  WITH CHECK (public.is_tenant_member(tenant_id));

DROP POLICY IF EXISTS assist_location_points_tenant ON public.assist_location_points;
CREATE POLICY assist_location_points_tenant ON public.assist_location_points
  FOR ALL TO authenticated
  USING (public.is_tenant_member(tenant_id))
  WITH CHECK (public.is_tenant_member(tenant_id));

DROP POLICY IF EXISTS assist_time_events_tenant ON public.assist_time_events;
CREATE POLICY assist_time_events_tenant ON public.assist_time_events
  FOR ALL TO authenticated
  USING (public.is_tenant_member(tenant_id))
  WITH CHECK (public.is_tenant_member(tenant_id));

DROP POLICY IF EXISTS assist_geofence_events_tenant ON public.assist_geofence_events;
CREATE POLICY assist_geofence_events_tenant ON public.assist_geofence_events
  FOR ALL TO authenticated
  USING (public.is_tenant_member(tenant_id))
  WITH CHECK (public.is_tenant_member(tenant_id));

DROP POLICY IF EXISTS assist_driving_log_tenant ON public.assist_driving_log;
CREATE POLICY assist_driving_log_tenant ON public.assist_driving_log
  FOR ALL TO authenticated
  USING (public.is_tenant_member(tenant_id))
  WITH CHECK (public.is_tenant_member(tenant_id));

-- --------------------------------------------------------------------------
-- Grants
-- --------------------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE ON public.assist_visit_signatures TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.assist_visit_proofs TO authenticated;
GRANT SELECT, INSERT ON public.assist_proof_attachments TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.assist_tracking_sessions TO authenticated;
GRANT SELECT, INSERT ON public.assist_location_points TO authenticated;
GRANT SELECT, INSERT ON public.assist_time_events TO authenticated;
GRANT SELECT, INSERT ON public.assist_geofence_events TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.assist_driving_log TO authenticated;
