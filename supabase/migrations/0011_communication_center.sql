-- ==========================================================================
-- CareSuite+ — Migration 0011: Communication Center (Core Platform)
-- Entspricht src/features/communication/
-- RLS: tenant_id + has_permission() auf allen Tabellen
-- ==========================================================================

-- --------------------------------------------------------------------------
-- communication_threads
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.communication_threads (
  id                          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                   UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  thread_type                 TEXT        NOT NULL,
  status                      TEXT        NOT NULL DEFAULT 'open',
  priority                    TEXT        NOT NULL DEFAULT 'normal',
  subject                     TEXT,
  title                       TEXT        NOT NULL,
  preview_text                TEXT,
  module_key                  TEXT,
  client_id                   UUID,
  employee_id                 UUID,
  relative_contact_id         UUID,
  assignment_id               UUID,
  document_id                 UUID,
  invoice_id                  UUID,
  consultation_case_id        UUID,
  course_id                   UUID,
  support_ticket_id           UUID,
  created_by_user_id          UUID,
  created_by_portal_session_id UUID,
  last_message_id             UUID,
  last_message_at             TIMESTAMPTZ,
  last_message_by_display_name TEXT,
  unread_count_business       INTEGER     NOT NULL DEFAULT 0,
  unread_count_employee       INTEGER     NOT NULL DEFAULT 0,
  unread_count_client         INTEGER     NOT NULL DEFAULT 0,
  unread_count_relative       INTEGER     NOT NULL DEFAULT 0,
  is_internal_only            BOOLEAN     NOT NULL DEFAULT FALSE,
  is_portal_visible           BOOLEAN     NOT NULL DEFAULT TRUE,
  allow_client_replies        BOOLEAN     NOT NULL DEFAULT FALSE,
  allow_employee_replies      BOOLEAN     NOT NULL DEFAULT FALSE,
  allow_relative_replies      BOOLEAN     NOT NULL DEFAULT FALSE,
  archived_at                 TIMESTAMPTZ,
  archived_by                 UUID,
  deleted_at                  TIMESTAMPTZ,
  deleted_by                  UUID,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- --------------------------------------------------------------------------
-- communication_messages
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.communication_messages (
  id                          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                   UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  thread_id                   UUID        NOT NULL REFERENCES public.communication_threads(id) ON DELETE CASCADE,
  sender_type                 TEXT        NOT NULL,
  sender_user_id              UUID,
  sender_portal_session_id    UUID,
  sender_display_name         TEXT        NOT NULL,
  content_type                TEXT        NOT NULL DEFAULT 'text',
  body_text                   TEXT,
  has_attachments             BOOLEAN     NOT NULL DEFAULT FALSE,
  has_voice                   BOOLEAN     NOT NULL DEFAULT FALSE,
  emoji_reactions_count       INTEGER     NOT NULL DEFAULT 0,
  status                      TEXT        NOT NULL DEFAULT 'sent',
  is_internal_note            BOOLEAN     NOT NULL DEFAULT FALSE,
  is_visible_to_business      BOOLEAN     NOT NULL DEFAULT TRUE,
  is_visible_to_employee      BOOLEAN     NOT NULL DEFAULT FALSE,
  is_visible_to_client        BOOLEAN     NOT NULL DEFAULT FALSE,
  is_visible_to_relative      BOOLEAN     NOT NULL DEFAULT FALSE,
  sent_at                     TIMESTAMPTZ,
  delivered_at                TIMESTAMPTZ,
  read_at                     TIMESTAMPTZ,
  edited_at                   TIMESTAMPTZ,
  edited_by                   UUID,
  deleted_at                  TIMESTAMPTZ,
  deleted_by                  UUID,
  delete_reason               TEXT,
  reply_to_message_id         UUID,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- --------------------------------------------------------------------------
-- communication_participants
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.communication_participants (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  thread_id           UUID        NOT NULL REFERENCES public.communication_threads(id) ON DELETE CASCADE,
  participant_type    TEXT        NOT NULL,
  participant_id      UUID,
  display_name        TEXT        NOT NULL,
  avatar_url          TEXT,
  role                TEXT        NOT NULL DEFAULT 'member',
  can_read            BOOLEAN     NOT NULL DEFAULT TRUE,
  can_write           BOOLEAN     NOT NULL DEFAULT FALSE,
  can_upload          BOOLEAN     NOT NULL DEFAULT FALSE,
  can_voice_message   BOOLEAN     NOT NULL DEFAULT FALSE,
  can_archive         BOOLEAN     NOT NULL DEFAULT FALSE,
  can_delete          BOOLEAN     NOT NULL DEFAULT FALSE,
  can_assign          BOOLEAN     NOT NULL DEFAULT FALSE,
  last_read_message_id UUID,
  last_read_at        TIMESTAMPTZ,
  muted               BOOLEAN     NOT NULL DEFAULT FALSE,
  pinned              BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- --------------------------------------------------------------------------
-- communication_attachments
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.communication_attachments (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  thread_id           UUID        NOT NULL REFERENCES public.communication_threads(id) ON DELETE CASCADE,
  message_id          UUID        NOT NULL REFERENCES public.communication_messages(id) ON DELETE CASCADE,
  attachment_type     TEXT        NOT NULL,
  filename            TEXT        NOT NULL,
  mime_type           TEXT        NOT NULL,
  size_bytes          BIGINT      NOT NULL DEFAULT 0,
  storage_path        TEXT        NOT NULL,
  public_url          TEXT,
  scan_status         TEXT        NOT NULL DEFAULT 'pending',
  duration_seconds    INTEGER,
  waveform_preview    JSONB,
  linked_document_id  UUID,
  uploaded_by         UUID,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- --------------------------------------------------------------------------
-- communication_reactions
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.communication_reactions (
  id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  thread_id               UUID        NOT NULL REFERENCES public.communication_threads(id) ON DELETE CASCADE,
  message_id              UUID        NOT NULL REFERENCES public.communication_messages(id) ON DELETE CASCADE,
  emoji                   TEXT        NOT NULL,
  reacted_by_type         TEXT        NOT NULL,
  reacted_by_id           UUID,
  reacted_by_display_name TEXT        NOT NULL,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- --------------------------------------------------------------------------
-- communication_assignments
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.communication_assignments (
  id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  thread_id               UUID        NOT NULL REFERENCES public.communication_threads(id) ON DELETE CASCADE,
  message_id              UUID        REFERENCES public.communication_messages(id) ON DELETE SET NULL,
  target_type             TEXT        NOT NULL,
  target_id               UUID,
  suggested_target_id     UUID,
  suggestion_confidence   NUMERIC(5,4),
  status                  TEXT        NOT NULL DEFAULT 'open',
  assigned_by             UUID,
  assigned_at             TIMESTAMPTZ,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- --------------------------------------------------------------------------
-- communication_read_receipts
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.communication_read_receipts (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  thread_id   UUID        NOT NULL REFERENCES public.communication_threads(id) ON DELETE CASCADE,
  message_id  UUID        NOT NULL REFERENCES public.communication_messages(id) ON DELETE CASCADE,
  reader_type TEXT        NOT NULL,
  reader_id   UUID,
  read_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- --------------------------------------------------------------------------
-- communication_notifications
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.communication_notifications (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  type        TEXT        NOT NULL,
  thread_id   UUID        REFERENCES public.communication_threads(id) ON DELETE SET NULL,
  message_id  UUID        REFERENCES public.communication_messages(id) ON DELETE SET NULL,
  title       TEXT        NOT NULL,
  body        TEXT        NOT NULL,
  read_at     TIMESTAMPTZ,
  action_route TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- --------------------------------------------------------------------------
-- communication_audit_events
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.communication_audit_events (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id           UUID,
  portal_session_id UUID,
  action            TEXT        NOT NULL,
  entity_type       TEXT        NOT NULL,
  entity_id         UUID        NOT NULL,
  thread_id         UUID,
  message_id        UUID,
  client_id         UUID,
  employee_id       UUID,
  result            TEXT        NOT NULL DEFAULT 'success',
  metadata          JSONB,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- --------------------------------------------------------------------------
-- communication_settings
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.communication_settings (
  id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               UUID        NOT NULL UNIQUE REFERENCES public.tenants(id) ON DELETE CASCADE,
  center_enabled          BOOLEAN     NOT NULL DEFAULT TRUE,
  client_portal_enabled   BOOLEAN     NOT NULL DEFAULT TRUE,
  employee_portal_enabled BOOLEAN     NOT NULL DEFAULT TRUE,
  relative_portal_enabled BOOLEAN     NOT NULL DEFAULT TRUE,
  voice_messages_enabled  BOOLEAN     NOT NULL DEFAULT TRUE,
  attachments_enabled     BOOLEAN     NOT NULL DEFAULT TRUE,
  emojis_enabled          BOOLEAN     NOT NULL DEFAULT TRUE,
  reactions_enabled       BOOLEAN     NOT NULL DEFAULT TRUE,
  internal_notes_enabled  BOOLEAN     NOT NULL DEFAULT TRUE,
  auto_archive_months     INTEGER,
  max_file_size_mb        INTEGER     NOT NULL DEFAULT 25,
  allowed_file_types      JSONB       NOT NULL DEFAULT '["pdf","jpg","png"]'::jsonb,
  push_enabled            BOOLEAN     NOT NULL DEFAULT FALSE,
  email_enabled           BOOLEAN     NOT NULL DEFAULT TRUE,
  sms_enabled             BOOLEAN     NOT NULL DEFAULT FALSE,
  realtime_enabled        BOOLEAN     NOT NULL DEFAULT TRUE,
  show_read_receipts      BOOLEAN     NOT NULL DEFAULT TRUE,
  show_typing_indicator   BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- --------------------------------------------------------------------------
-- RLS
-- --------------------------------------------------------------------------
ALTER TABLE public.communication_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.communication_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.communication_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.communication_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.communication_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.communication_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.communication_read_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.communication_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.communication_audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.communication_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "communication_threads_select" ON public.communication_threads;
CREATE POLICY "communication_threads_select"
  ON public.communication_threads FOR SELECT
  USING (tenant_id = public.current_tenant_id() AND public.has_permission('communication.view_center'));

DROP POLICY IF EXISTS "communication_threads_write" ON public.communication_threads;
CREATE POLICY "communication_threads_write"
  ON public.communication_threads FOR ALL
  USING (tenant_id = public.current_tenant_id() AND public.has_permission('communication.create_thread'))
  WITH CHECK (tenant_id = public.current_tenant_id() AND public.has_permission('communication.create_thread'));

DROP POLICY IF EXISTS "communication_messages_select" ON public.communication_messages;
CREATE POLICY "communication_messages_select"
  ON public.communication_messages FOR SELECT
  USING (tenant_id = public.current_tenant_id() AND public.has_permission('communication.view_center'));

DROP POLICY IF EXISTS "communication_messages_write" ON public.communication_messages;
CREATE POLICY "communication_messages_write"
  ON public.communication_messages FOR ALL
  USING (tenant_id = public.current_tenant_id() AND public.has_permission('communication.send_message'))
  WITH CHECK (tenant_id = public.current_tenant_id() AND public.has_permission('communication.send_message'));

DROP POLICY IF EXISTS "communication_audit_select" ON public.communication_audit_events;
CREATE POLICY "communication_audit_select"
  ON public.communication_audit_events FOR SELECT
  USING (tenant_id = public.current_tenant_id() AND public.has_permission('communication.view_deleted_messages'));

DROP POLICY IF EXISTS "communication_audit_insert" ON public.communication_audit_events;
CREATE POLICY "communication_audit_insert"
  ON public.communication_audit_events FOR INSERT
  WITH CHECK (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS "communication_settings_select" ON public.communication_settings;
CREATE POLICY "communication_settings_select"
  ON public.communication_settings FOR SELECT
  USING (tenant_id = public.current_tenant_id() AND public.has_permission('communication.manage_settings'));

DROP POLICY IF EXISTS "communication_settings_write" ON public.communication_settings;
CREATE POLICY "communication_settings_write"
  ON public.communication_settings FOR ALL
  USING (tenant_id = public.current_tenant_id() AND public.has_permission('communication.manage_settings'))
  WITH CHECK (tenant_id = public.current_tenant_id() AND public.has_permission('communication.manage_settings'));

-- --------------------------------------------------------------------------
-- GRANTs
-- --------------------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE ON public.communication_threads TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.communication_messages TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.communication_participants TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.communication_attachments TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.communication_reactions TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.communication_assignments TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.communication_read_receipts TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.communication_notifications TO authenticated;
GRANT SELECT, INSERT ON public.communication_audit_events TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.communication_settings TO authenticated;

-- --------------------------------------------------------------------------
-- Indizes
-- --------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_comm_threads_tenant ON public.communication_threads(tenant_id, last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_comm_threads_status ON public.communication_threads(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_comm_threads_type ON public.communication_threads(tenant_id, thread_type);
CREATE INDEX IF NOT EXISTS idx_comm_threads_module ON public.communication_threads(tenant_id, module_key);
CREATE INDEX IF NOT EXISTS idx_comm_threads_client ON public.communication_threads(tenant_id, client_id);
CREATE INDEX IF NOT EXISTS idx_comm_threads_employee ON public.communication_threads(tenant_id, employee_id);
CREATE INDEX IF NOT EXISTS idx_comm_messages_thread ON public.communication_messages(thread_id, created_at);
CREATE INDEX IF NOT EXISTS idx_comm_messages_tenant ON public.communication_messages(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_comm_participants_thread ON public.communication_participants(thread_id);
CREATE INDEX IF NOT EXISTS idx_comm_assignments_tenant ON public.communication_assignments(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_comm_audit_tenant ON public.communication_audit_events(tenant_id, created_at DESC);

-- --------------------------------------------------------------------------
-- Storage Buckets (Kommentar — via Supabase Dashboard / separate Migration)
-- communication-attachments, communication-voice, communication-images, communication-exports
-- Pfade: tenant/{tenant_id}/threads/{thread_id}/attachments/{attachment_id}/{filename}
-- --------------------------------------------------------------------------
