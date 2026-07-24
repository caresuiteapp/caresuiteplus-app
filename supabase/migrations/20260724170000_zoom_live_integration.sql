-- ============================================================================
-- CareSuite HealthOS — Zoom live integration
-- Mandantenfähiges OAuth, Meetings, Teilnahme, Webhooks, Aufzeichnungen, Audit.
-- Tokens, Start-URLs, Beitritts-URLs und Kenncodes sind ausschließlich
-- verschlüsselt und werden nie direkt für authenticated/anon freigegeben.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.zoom_connections (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  connected_user_id     UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  zoom_account_id       TEXT,
  zoom_user_id          TEXT,
  primary_email         TEXT,
  display_name          TEXT,
  account_type          INTEGER,
  connection_status     TEXT NOT NULL DEFAULT 'not_connected'
    CHECK (connection_status IN ('not_connected','authorizing','connected','degraded','revoked','error')),
  granted_scopes        TEXT[] NOT NULL DEFAULT '{}',
  access_token_cipher   TEXT,
  refresh_token_cipher  TEXT,
  token_expires_at      TIMESTAMPTZ,
  capabilities          JSONB NOT NULL DEFAULT '{}'::jsonb,
  settings              JSONB NOT NULL DEFAULT jsonb_build_object(
    'waitingRoom', TRUE,
    'joinBeforeHost', FALSE,
    'recordingMode', 'none',
    'muteUponEntry', TRUE,
    'participantVideo', FALSE,
    'hostVideo', TRUE
  ),
  last_health_check_at  TIMESTAMPTZ,
  last_sync_at          TIMESTAMPTZ,
  last_error_code       TEXT,
  last_error_message    TEXT,
  connected_at          TIMESTAMPTZ,
  revoked_at            TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_zoom_connections_tenant_status
  ON public.zoom_connections (tenant_id, connection_status);

CREATE TABLE IF NOT EXISTS public.zoom_oauth_states (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  initiated_by          UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  state_hash            TEXT NOT NULL UNIQUE,
  pkce_verifier_cipher  TEXT NOT NULL,
  requested_scopes      TEXT[] NOT NULL DEFAULT '{}',
  return_url            TEXT NOT NULL,
  expires_at            TIMESTAMPTZ NOT NULL,
  consumed_at           TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_zoom_oauth_states_expiry
  ON public.zoom_oauth_states (expires_at)
  WHERE consumed_at IS NULL;

CREATE TABLE IF NOT EXISTS public.zoom_meetings (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  connection_id         UUID NOT NULL REFERENCES public.zoom_connections(id) ON DELETE CASCADE,
  created_by            UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  host_profile_id       UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  zoom_meeting_id       TEXT NOT NULL,
  zoom_uuid             TEXT,
  topic                 TEXT NOT NULL,
  agenda                TEXT,
  start_time            TIMESTAMPTZ NOT NULL,
  duration_minutes      INTEGER NOT NULL DEFAULT 30 CHECK (duration_minutes BETWEEN 1 AND 1440),
  timezone              TEXT NOT NULL DEFAULT 'Europe/Berlin',
  meeting_type          INTEGER NOT NULL DEFAULT 2,
  status                TEXT NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('scheduled','started','ended','cancelled','failed')),
  join_url_cipher       TEXT,
  start_url_cipher      TEXT,
  passcode_cipher       TEXT,
  settings              JSONB NOT NULL DEFAULT '{}'::jsonb,
  client_id             UUID,
  employee_id           UUID,
  assignment_id         UUID,
  calendar_event_id     UUID,
  consultation_id       UUID,
  external_reference    TEXT,
  portal_released       BOOLEAN NOT NULL DEFAULT FALSE,
  portal_join_from      TIMESTAMPTZ,
  portal_join_until     TIMESTAMPTZ,
  recording_allowed     BOOLEAN NOT NULL DEFAULT FALSE,
  consent_required      BOOLEAN NOT NULL DEFAULT TRUE,
  consent_status        TEXT NOT NULL DEFAULT 'not_requested'
    CHECK (consent_status IN ('not_required','not_requested','requested','granted','declined','withdrawn')),
  zoom_created_at       TIMESTAMPTZ,
  zoom_updated_at       TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, zoom_meeting_id)
);

CREATE INDEX IF NOT EXISTS idx_zoom_meetings_tenant_start
  ON public.zoom_meetings (tenant_id, start_time DESC);
CREATE INDEX IF NOT EXISTS idx_zoom_meetings_assignment
  ON public.zoom_meetings (tenant_id, assignment_id)
  WHERE assignment_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_zoom_meetings_client
  ON public.zoom_meetings (tenant_id, client_id)
  WHERE client_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_zoom_meetings_employee
  ON public.zoom_meetings (tenant_id, employee_id)
  WHERE employee_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.zoom_meeting_participants (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  meeting_id            UUID NOT NULL REFERENCES public.zoom_meetings(id) ON DELETE CASCADE,
  participant_type      TEXT NOT NULL DEFAULT 'external'
    CHECK (participant_type IN ('profile','employee','client','external')),
  profile_id            UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  employee_id           UUID,
  client_id             UUID,
  external_email        TEXT,
  display_name          TEXT,
  invitation_status     TEXT NOT NULL DEFAULT 'pending'
    CHECK (invitation_status IN ('pending','sent','accepted','declined','cancelled','failed')),
  can_start             BOOLEAN NOT NULL DEFAULT FALSE,
  can_join              BOOLEAN NOT NULL DEFAULT TRUE,
  invited_at            TIMESTAMPTZ,
  responded_at          TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_zoom_participants_meeting
  ON public.zoom_meeting_participants (tenant_id, meeting_id);

CREATE TABLE IF NOT EXISTS public.zoom_meeting_attendance (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  meeting_id            UUID NOT NULL REFERENCES public.zoom_meetings(id) ON DELETE CASCADE,
  zoom_participant_id   TEXT,
  zoom_user_id          TEXT,
  display_name          TEXT,
  email                 TEXT,
  joined_at             TIMESTAMPTZ,
  left_at               TIMESTAMPTZ,
  duration_seconds      INTEGER,
  source_event_id       TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_zoom_attendance_meeting
  ON public.zoom_meeting_attendance (tenant_id, meeting_id, joined_at DESC);

CREATE TABLE IF NOT EXISTS public.zoom_recordings (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  meeting_id            UUID NOT NULL REFERENCES public.zoom_meetings(id) ON DELETE CASCADE,
  zoom_recording_id     TEXT NOT NULL,
  recording_type        TEXT,
  file_type             TEXT,
  file_size             BIGINT,
  status                TEXT NOT NULL DEFAULT 'available'
    CHECK (status IN ('processing','available','deleted','expired','blocked')),
  download_url_cipher   TEXT,
  play_url_cipher       TEXT,
  recording_start       TIMESTAMPTZ,
  recording_end         TIMESTAMPTZ,
  retention_until       TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, zoom_recording_id)
);

CREATE TABLE IF NOT EXISTS public.zoom_webhook_events (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_fingerprint     TEXT NOT NULL UNIQUE,
  zoom_account_id       TEXT,
  event_type            TEXT NOT NULL,
  event_timestamp       TIMESTAMPTZ,
  tenant_id             UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  meeting_id            UUID REFERENCES public.zoom_meetings(id) ON DELETE SET NULL,
  payload               JSONB NOT NULL,
  processing_status     TEXT NOT NULL DEFAULT 'received'
    CHECK (processing_status IN ('received','processed','ignored','failed')),
  error_message         TEXT,
  processed_at          TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_zoom_webhook_events_processing
  ON public.zoom_webhook_events (processing_status, created_at);

CREATE TABLE IF NOT EXISTS public.zoom_consent_records (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  meeting_id            UUID NOT NULL REFERENCES public.zoom_meetings(id) ON DELETE CASCADE,
  subject_type          TEXT NOT NULL CHECK (subject_type IN ('profile','employee','client','external')),
  subject_id            UUID,
  decision              TEXT NOT NULL CHECK (decision IN ('granted','declined','withdrawn')),
  purpose               TEXT NOT NULL,
  version               TEXT NOT NULL,
  captured_by           UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  captured_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata              JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS public.zoom_audit_events (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  connection_id         UUID REFERENCES public.zoom_connections(id) ON DELETE SET NULL,
  meeting_id            UUID REFERENCES public.zoom_meetings(id) ON DELETE SET NULL,
  actor_user_id         UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  action_key            TEXT NOT NULL,
  result_status         TEXT NOT NULL CHECK (result_status IN ('success','blocked','failed')),
  resource_external_id  TEXT,
  http_status           INTEGER,
  request_fingerprint   TEXT,
  error_code            TEXT,
  error_message         TEXT,
  metadata              JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_zoom_audit_tenant_created
  ON public.zoom_audit_events (tenant_id, created_at DESC);

ALTER TABLE public.zoom_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.zoom_oauth_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.zoom_meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.zoom_meeting_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.zoom_meeting_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.zoom_recordings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.zoom_webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.zoom_consent_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.zoom_audit_events ENABLE ROW LEVEL SECURITY;

-- Sämtliche Zoom-Datenzugriffe laufen über service-role Edge Functions.
REVOKE ALL ON public.zoom_connections FROM authenticated, anon;
REVOKE ALL ON public.zoom_oauth_states FROM authenticated, anon;
REVOKE ALL ON public.zoom_meetings FROM authenticated, anon;
REVOKE ALL ON public.zoom_meeting_participants FROM authenticated, anon;
REVOKE ALL ON public.zoom_meeting_attendance FROM authenticated, anon;
REVOKE ALL ON public.zoom_recordings FROM authenticated, anon;
REVOKE ALL ON public.zoom_webhook_events FROM authenticated, anon;
REVOKE ALL ON public.zoom_consent_records FROM authenticated, anon;
REVOKE ALL ON public.zoom_audit_events FROM authenticated, anon;

COMMENT ON TABLE public.zoom_connections IS
  'Mandantenbezogene Zoom-OAuth-Verbindung; Token ausschließlich AES-GCM-verschlüsselt und serverseitig verarbeitet.';
COMMENT ON TABLE public.zoom_meetings IS
  'CareSuite-SSOT-Verknüpfung zu Zoom-Meetings; geheime URLs und Kenncodes bleiben verschlüsselt.';
COMMENT ON TABLE public.zoom_webhook_events IS
  'Idempotente, signaturgeprüfte Zoom-Ereignisse für Status-, Teilnahme- und Aufzeichnungssynchronisation.';
COMMENT ON TABLE public.zoom_audit_events IS
  'Revisionsspur aller Zoom-Aktionen ohne Gesprächs-, Audio-, Video- oder Dokumentinhalte.';
