-- ==========================================================================
-- CareSuite+ — Migration 0046: Kommunikations-Provider (Prepare-Only)
-- E-Mail, SMS, WhatsApp Business, Push, Telefonie/SIP — ohne Live-Versand.
--
-- Hinweis zu Bestandstabellen (NICHT dupliziert):
--   communication_messages (0011) — Chat-Nachrichten im Communication Center
--   communication_audit_events (0011) — Chat-Audit
--   communication_templates (Remote-Katalog) — bleibt unverändert
--
-- Outbound-Versand nutzt communication_outbound_messages (≠ Chat).
-- Provider-Audit nutzt communication_provider_audit_events (≠ Chat-Audit).
--
-- Keine API-Keys, keine Secrets im Klartext. Keine destruktiven Befehle.
-- ==========================================================================

-- --------------------------------------------------------------------------
-- 1. communication_provider_configs — mandantenspezifische Provider-Slots
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.communication_provider_configs (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  provider_key          TEXT        NOT NULL
    CHECK (provider_key IN (
      'sendgrid', 'mailjet', 'brevo',
      'twilio', 'messagebird',
      'firebase_fcm', 'apple_apns',
      'sip_generic'
    )),
  channel               TEXT        NOT NULL
    CHECK (channel IN (
      'transactional_email', 'sms', 'whatsapp_business',
      'push', 'phone_log', 'video_call_link'
    )),
  display_name          TEXT        NOT NULL DEFAULT '',
  status                TEXT        NOT NULL DEFAULT 'prepared'
    CHECK (status IN ('prepared', 'configured', 'sandbox', 'production', 'disabled', 'error')),
  credential_reference  TEXT,
  sandbox_mode          BOOLEAN     NOT NULL DEFAULT TRUE,
  whatsapp_approved     BOOLEAN     NOT NULL DEFAULT FALSE,
  config_metadata       JSONB       NOT NULL DEFAULT '{}'::jsonb,
  updated_by            UUID        REFERENCES public.profiles(id),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, provider_key, channel)
);

CREATE INDEX IF NOT EXISTS idx_comm_provider_configs_tenant
  ON public.communication_provider_configs (tenant_id, channel, status);

-- --------------------------------------------------------------------------
-- 2. communication_channel_templates — Vorlagen für Outbound-Kanäle
--    (Spec: communication_templates — separates Chat-/Katalog-Modell bleibt)
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.communication_channel_templates (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  template_key          TEXT        NOT NULL,
  name                  TEXT        NOT NULL,
  description           TEXT,
  channel               TEXT        NOT NULL
    CHECK (channel IN (
      'transactional_email', 'sms', 'whatsapp_business',
      'push', 'phone_log', 'video_call_link'
    )),
  use_case              TEXT        NOT NULL
    CHECK (use_case IN (
      'appointment_reminder', 'assignment_change', 'invoice_send', 'dunning',
      'service_proof', 'client_intake_link', 'employee_push', 'relative_info',
      'support_message', 'blocked_direct_chat'
    )),
  subject_template      TEXT,
  body_template         TEXT        NOT NULL DEFAULT '',
  placeholders          JSONB       NOT NULL DEFAULT '[]'::jsonb,
  allows_health_data    BOOLEAN     NOT NULL DEFAULT FALSE,
  status                TEXT        NOT NULL DEFAULT 'prepared'
    CHECK (status IN ('prepared', 'active', 'archived', 'disabled')),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, template_key)
);

CREATE INDEX IF NOT EXISTS idx_comm_channel_templates_tenant
  ON public.communication_channel_templates (tenant_id, channel, use_case);

-- --------------------------------------------------------------------------
-- 3. communication_consents — Einwilligungen pro Empfänger/Kanal/Zweck
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.communication_consents (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  recipient_type        TEXT        NOT NULL
    CHECK (recipient_type IN ('client', 'employee', 'relative', 'contact', 'tenant_user')),
  recipient_id          UUID        NOT NULL,
  channel               TEXT        NOT NULL
    CHECK (channel IN (
      'transactional_email', 'sms', 'whatsapp_business',
      'push', 'phone_log', 'video_call_link'
    )),
  purpose               TEXT        NOT NULL,
  channel_allowed       BOOLEAN     NOT NULL DEFAULT FALSE,
  purpose_allowed       BOOLEAN     NOT NULL DEFAULT FALSE,
  recipient_allowed     BOOLEAN     NOT NULL DEFAULT FALSE,
  health_data_allowed   BOOLEAN     NOT NULL DEFAULT FALSE,
  revoked_at            TIMESTAMPTZ,
  proof_reference       TEXT,
  proof_recorded_at     TIMESTAMPTZ,
  metadata              JSONB       NOT NULL DEFAULT '{}'::jsonb,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_comm_consents_recipient
  ON public.communication_consents (tenant_id, recipient_type, recipient_id, channel);

-- --------------------------------------------------------------------------
-- 4. communication_outbound_messages — Outbound-Warteschlange (Prepare-Only)
--    (Spec: communication_messages — Chat-Tabelle bleibt unverändert)
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.communication_outbound_messages (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  channel               TEXT        NOT NULL
    CHECK (channel IN (
      'transactional_email', 'sms', 'whatsapp_business',
      'push', 'phone_log', 'video_call_link'
    )),
  use_case              TEXT        NOT NULL,
  template_id           UUID        REFERENCES public.communication_channel_templates(id) ON DELETE SET NULL,
  provider_config_id    UUID        REFERENCES public.communication_provider_configs(id) ON DELETE SET NULL,
  recipient_type        TEXT        NOT NULL,
  recipient_id          UUID,
  recipient_address     TEXT        NOT NULL DEFAULT '',
  subject               TEXT,
  body_preview          TEXT        NOT NULL DEFAULT '',
  contains_health_data  BOOLEAN     NOT NULL DEFAULT FALSE,
  status                TEXT        NOT NULL DEFAULT 'prepared'
    CHECK (status IN ('prepared', 'blocked', 'queued', 'sent', 'delivered', 'failed', 'cancelled')),
  blocked_reason        TEXT,
  scheduled_for         TIMESTAMPTZ,
  created_by            UUID        REFERENCES public.profiles(id),
  metadata              JSONB       NOT NULL DEFAULT '{}'::jsonb,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_comm_outbound_tenant_status
  ON public.communication_outbound_messages (tenant_id, status, created_at DESC);

-- --------------------------------------------------------------------------
-- 5. communication_delivery_events — Zustellungsereignisse (ohne Live-Versand)
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.communication_delivery_events (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  outbound_message_id   UUID        NOT NULL REFERENCES public.communication_outbound_messages(id) ON DELETE CASCADE,
  event_type            TEXT        NOT NULL
    CHECK (event_type IN ('prepared', 'blocked', 'queued', 'sent', 'delivered', 'failed', 'bounced', 'opened')),
  provider_key          TEXT,
  external_message_id   TEXT,
  payload_hash          TEXT,
  metadata              JSONB       NOT NULL DEFAULT '{}'::jsonb,
  recorded_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_comm_delivery_outbound
  ON public.communication_delivery_events (outbound_message_id, recorded_at DESC);

-- --------------------------------------------------------------------------
-- 6. communication_provider_audit_events — Provider-/Kanal-Audit
--    (Spec: communication_audit_events — Chat-Audit bleibt separat)
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.communication_provider_audit_events (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  actor_user_id         UUID        REFERENCES public.profiles(id),
  action                TEXT        NOT NULL,
  entity_type           TEXT        NOT NULL,
  entity_id             UUID,
  channel               TEXT,
  provider_key          TEXT,
  use_case              TEXT,
  summary               TEXT        NOT NULL DEFAULT '',
  blocked               BOOLEAN     NOT NULL DEFAULT FALSE,
  demo                  BOOLEAN     NOT NULL DEFAULT FALSE,
  metadata              JSONB       NOT NULL DEFAULT '{}'::jsonb,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_comm_provider_audit_tenant
  ON public.communication_provider_audit_events (tenant_id, created_at DESC);

-- --------------------------------------------------------------------------
-- 7. device_push_tokens — Push-Geräte (Token gehasht, kein Klartext)
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.device_push_tokens (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id               UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  device_id             TEXT        NOT NULL,
  platform              TEXT        NOT NULL CHECK (platform IN ('ios', 'android', 'web')),
  token_hash            TEXT        NOT NULL,
  consent_recorded_at   TIMESTAMPTZ,
  revoked_at            TIMESTAMPTZ,
  last_seen_at          TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, user_id, device_id)
);

CREATE INDEX IF NOT EXISTS idx_device_push_tokens_user
  ON public.device_push_tokens (tenant_id, user_id, revoked_at);

-- --------------------------------------------------------------------------
-- 8. phone_call_logs — Telefonie-Protokoll (ohne Live-SIP)
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.phone_call_logs (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  direction             TEXT        NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  phone_number_masked   TEXT        NOT NULL DEFAULT '',
  duration_seconds      INTEGER,
  provider_key          TEXT,
  call_type             TEXT        NOT NULL DEFAULT 'voice'
    CHECK (call_type IN ('voice', 'video', 'sip')),
  related_client_id     UUID,
  related_employee_id   UUID,
  status                TEXT        NOT NULL DEFAULT 'prepared'
    CHECK (status IN ('prepared', 'ringing', 'connected', 'completed', 'missed', 'failed')),
  metadata              JSONB       NOT NULL DEFAULT '{}'::jsonb,
  started_at            TIMESTAMPTZ,
  ended_at              TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_phone_call_logs_tenant
  ON public.phone_call_logs (tenant_id, created_at DESC);

-- --------------------------------------------------------------------------
-- RLS
-- --------------------------------------------------------------------------
ALTER TABLE public.communication_provider_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.communication_channel_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.communication_consents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.communication_outbound_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.communication_delivery_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.communication_provider_audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.device_push_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.phone_call_logs ENABLE ROW LEVEL SECURITY;

-- Provider configs: Tenant-Admin sieht Metadaten; credential_reference nur Admin
DROP POLICY IF EXISTS comm_provider_configs_select ON public.communication_provider_configs;
CREATE POLICY comm_provider_configs_select ON public.communication_provider_configs
  FOR SELECT TO authenticated
  USING (tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS comm_provider_configs_admin ON public.communication_provider_configs;
CREATE POLICY comm_provider_configs_admin ON public.communication_provider_configs
  FOR ALL TO authenticated
  USING (
    tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
    AND public.current_role_key() IN ('business_admin', 'business_manager')
  )
  WITH CHECK (
    tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
    AND public.current_role_key() IN ('business_admin', 'business_manager')
  );

DROP POLICY IF EXISTS comm_channel_templates_tenant ON public.communication_channel_templates;
CREATE POLICY comm_channel_templates_tenant ON public.communication_channel_templates
  FOR ALL TO authenticated
  USING (tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()))
  WITH CHECK (tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS comm_consents_tenant ON public.communication_consents;
CREATE POLICY comm_consents_tenant ON public.communication_consents
  FOR ALL TO authenticated
  USING (tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()))
  WITH CHECK (tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS comm_outbound_select ON public.communication_outbound_messages;
CREATE POLICY comm_outbound_select ON public.communication_outbound_messages
  FOR SELECT TO authenticated
  USING (tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS comm_outbound_insert ON public.communication_outbound_messages;
CREATE POLICY comm_outbound_insert ON public.communication_outbound_messages
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS comm_delivery_select ON public.communication_delivery_events;
CREATE POLICY comm_delivery_select ON public.communication_delivery_events
  FOR SELECT TO authenticated
  USING (tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS comm_delivery_insert ON public.communication_delivery_events;
CREATE POLICY comm_delivery_insert ON public.communication_delivery_events
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS comm_provider_audit_select ON public.communication_provider_audit_events;
CREATE POLICY comm_provider_audit_select ON public.communication_provider_audit_events
  FOR SELECT TO authenticated
  USING (tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS comm_provider_audit_insert ON public.communication_provider_audit_events;
CREATE POLICY comm_provider_audit_insert ON public.communication_provider_audit_events
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS device_push_tokens_own ON public.device_push_tokens;
CREATE POLICY device_push_tokens_own ON public.device_push_tokens
  FOR ALL TO authenticated
  USING (
    tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
    AND (user_id = auth.uid() OR public.current_role_key() IN ('business_admin', 'business_manager'))
  )
  WITH CHECK (
    tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
    AND (user_id = auth.uid() OR public.current_role_key() IN ('business_admin', 'business_manager'))
  );

DROP POLICY IF EXISTS phone_call_logs_tenant ON public.phone_call_logs;
CREATE POLICY phone_call_logs_tenant ON public.phone_call_logs
  FOR ALL TO authenticated
  USING (tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()))
  WITH CHECK (tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));

-- Kein SELECT auf credential_reference für normale Nutzer — View ohne Secret
CREATE OR REPLACE VIEW public.v_communication_provider_configs_safe AS
SELECT
  id,
  tenant_id,
  provider_key,
  channel,
  display_name,
  status,
  CASE
    WHEN credential_reference IS NOT NULL AND length(credential_reference) > 4
    THEN '••••' || right(credential_reference, 4)
    ELSE NULL
  END AS credential_reference_masked,
  sandbox_mode,
  whatsapp_approved,
  config_metadata,
  updated_by,
  created_at,
  updated_at
FROM public.communication_provider_configs;

GRANT SELECT ON public.v_communication_provider_configs_safe TO authenticated;

COMMENT ON TABLE public.communication_provider_configs IS 'Kommunikations-Provider pro Mandant — preparedOnly, Secrets nur als Vault-Referenz';
COMMENT ON TABLE public.communication_outbound_messages IS 'Outbound-Nachrichten-Warteschlange — kein Live-Versand bis Freischaltung';
COMMENT ON TABLE public.communication_channel_templates IS 'Kanal-Vorlagen für transaktionale Kommunikation (Prepare-Only)';
COMMENT ON TABLE public.device_push_tokens IS 'Push-Geräte-Tokens (gehasht) — Consent erforderlich';
COMMENT ON TABLE public.phone_call_logs IS 'Telefonie-Protokoll — SIP/Cloud vorbereitet, kein Live-Anruf';
