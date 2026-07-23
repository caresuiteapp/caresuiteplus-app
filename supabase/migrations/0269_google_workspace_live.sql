-- ============================================================================
-- CareSuite HealthOS — Google Workspace live integration
-- OAuth/PKCE state, encrypted server-side tokens, capabilities and audit.
-- No Google secret or token is readable by authenticated clients.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.google_workspace_connections (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  integration_id        UUID REFERENCES public.tenant_connect_integrations(id) ON DELETE SET NULL,
  connected_user_id     UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  google_subject        TEXT,
  primary_email         TEXT,
  hosted_domain         TEXT,
  display_name          TEXT,
  connection_status     TEXT NOT NULL DEFAULT 'not_connected'
    CHECK (connection_status IN ('not_connected','authorizing','connected','degraded','revoked','error')),
  granted_scopes        TEXT[] NOT NULL DEFAULT '{}',
  access_token_cipher   TEXT,
  refresh_token_cipher  TEXT,
  token_expires_at      TIMESTAMPTZ,
  capabilities          JSONB NOT NULL DEFAULT '{}'::jsonb,
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

CREATE INDEX IF NOT EXISTS idx_google_workspace_connection_status
  ON public.google_workspace_connections (tenant_id, connection_status);

CREATE TABLE IF NOT EXISTS public.google_workspace_oauth_states (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  integration_id        UUID REFERENCES public.tenant_connect_integrations(id) ON DELETE SET NULL,
  initiated_by          UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  state_hash            TEXT NOT NULL UNIQUE,
  pkce_verifier_cipher  TEXT NOT NULL,
  requested_scopes      TEXT[] NOT NULL DEFAULT '{}',
  return_url            TEXT NOT NULL,
  expires_at            TIMESTAMPTZ NOT NULL,
  consumed_at           TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_google_workspace_oauth_state_expiry
  ON public.google_workspace_oauth_states (expires_at)
  WHERE consumed_at IS NULL;

CREATE TABLE IF NOT EXISTS public.google_workspace_audit_events (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  connection_id         UUID REFERENCES public.google_workspace_connections(id) ON DELETE SET NULL,
  actor_user_id         UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  service_key           TEXT NOT NULL,
  action_key            TEXT NOT NULL,
  resource_type         TEXT,
  resource_external_id  TEXT,
  result_status         TEXT NOT NULL CHECK (result_status IN ('success','blocked','failed')),
  http_status           INTEGER,
  request_fingerprint   TEXT,
  error_code            TEXT,
  error_message         TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_google_workspace_audit_tenant_created
  ON public.google_workspace_audit_events (tenant_id, created_at DESC);

ALTER TABLE public.google_workspace_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.google_workspace_oauth_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.google_workspace_audit_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS google_workspace_audit_admin_read ON public.google_workspace_audit_events;
CREATE POLICY google_workspace_audit_admin_read
  ON public.google_workspace_audit_events FOR SELECT TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND public.current_role_key() IN ('business_admin','business_manager')
  );

-- Token/state tables are written only through service-role Edge Functions.
REVOKE ALL ON public.google_workspace_oauth_states FROM authenticated, anon;
REVOKE ALL ON public.google_workspace_connections FROM authenticated, anon;
REVOKE ALL ON public.google_workspace_audit_events FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.google_workspace_audit_events FROM authenticated;
GRANT SELECT ON public.google_workspace_audit_events TO authenticated;

INSERT INTO public.connect_providers (
  provider_key, name, category, description, website_url, provider_type, status,
  supports_sandbox, supports_production, requires_contract, requires_avv,
  requires_health_data_processing, requires_admin_approval
)
VALUES (
  'google_workspace', 'Google Workspace', 'communication_channels',
  'Gmail, Kalender, Meet, Drive, Docs, Sheets, Slides, Chat, Tasks und Kontakte',
  'https://workspace.google.com/', 'communication', 'active',
  TRUE, TRUE, FALSE, TRUE, TRUE, TRUE
)
ON CONFLICT (provider_key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  website_url = EXCLUDED.website_url,
  status = 'active',
  supports_production = TRUE,
  updated_at = NOW();

WITH provider AS (
  SELECT id FROM public.connect_providers WHERE provider_key = 'google_workspace'
)
INSERT INTO public.connect_provider_capabilities (
  provider_id, capability_key, title, description, data_direction,
  sensitive_data_level, requires_permission, status
)
SELECT provider.id, capability_key, title, description, direction, sensitivity, permission, 'active'
FROM provider
CROSS JOIN (VALUES
  ('gmail', 'Gmail', 'E-Mails lesen, suchen, entwerfen, senden, beantworten, weiterleiten und archivieren', 'bidirectional', 'special_category', 'Gmail-Berechtigung'),
  ('calendar', 'Google Kalender', 'Kalender, Serienereignisse, Teilnehmende und Erinnerungen synchronisieren', 'bidirectional', 'personal', 'Kalender-Berechtigung'),
  ('meet', 'Google Meet', 'Meet-Konferenzen über Kalendertermine erstellen und verknüpfen', 'out', 'personal', 'Kalender-Berechtigung'),
  ('drive', 'Google Drive', 'Dateien und mandantenbezogene Ordner lesen, erstellen, hochladen und verknüpfen', 'bidirectional', 'special_category', 'Drive-Berechtigung'),
  ('docs', 'Google Docs', 'Dokumente aus CareSuite-Vorlagen erstellen', 'out', 'special_category', 'Drive-Berechtigung'),
  ('sheets', 'Google Sheets', 'Tabellen und Auswertungen erstellen', 'out', 'special_category', 'Drive-Berechtigung'),
  ('slides', 'Google Slides', 'Präsentationen und Schulungsunterlagen erstellen', 'out', 'personal', 'Drive-Berechtigung'),
  ('tasks', 'Google Tasks', 'Aufgaben lesen, erstellen und aktualisieren', 'bidirectional', 'personal', 'Tasks-Berechtigung'),
  ('contacts', 'Google Kontakte', 'Kontakte mit Vorschau und Duplikatkontrolle austauschen', 'bidirectional', 'personal', 'Kontakte-Berechtigung'),
  ('chat', 'Google Chat', 'Spaces lesen und bestätigte Nachrichten senden', 'bidirectional', 'special_category', 'Chat-Berechtigung')
) AS caps(capability_key, title, description, direction, sensitivity, permission)
ON CONFLICT (provider_id, capability_key) DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  data_direction = EXCLUDED.data_direction,
  sensitive_data_level = EXCLUDED.sensitive_data_level,
  requires_permission = EXCLUDED.requires_permission,
  status = 'active',
  updated_at = NOW();

COMMENT ON TABLE public.google_workspace_connections IS
  'Mandantenbezogene Google-Workspace-Verbindung; Token ausschließlich verschlüsselt und serverseitig verarbeitet.';
COMMENT ON TABLE public.google_workspace_oauth_states IS
  'Kurzlebiger OAuth-State mit verschlüsseltem PKCE-Verifier; niemals aus dem Client lesbar.';
COMMENT ON TABLE public.google_workspace_audit_events IS
  'Revisionsspur aller Google-Workspace-Aktionen ohne Nachrichten- oder Dokumentinhalte.';
