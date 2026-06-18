-- ==========================================================================
-- CareSuite+ — Migration 0094: Office Broadcast & Notification Center
-- Mandanten-Broadcasts an Mitarbeitende, Glocken-Benachrichtigungen, RLS
-- ==========================================================================

-- --------------------------------------------------------------------------
-- message_threads: optional Broadcast-Rückfrage-Verknüpfung
-- --------------------------------------------------------------------------
ALTER TABLE public.message_threads
  ADD COLUMN IF NOT EXISTS source_broadcast_id UUID;

-- --------------------------------------------------------------------------
-- notification_broadcasts
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.notification_broadcasts (
  id                        UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                 UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  created_by_user_id        UUID        NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  title                     TEXT        NOT NULL,
  body                      TEXT        NOT NULL,
  category                  TEXT        NOT NULL,
  priority                  TEXT        NOT NULL DEFAULT 'normal'
                            CHECK (priority IN ('normal', 'important', 'urgent', 'critical')),
  audience                  TEXT        NOT NULL DEFAULT 'employees'
                            CHECK (audience IN ('employees', 'selected_employees', 'role', 'team', 'location')),
  allow_replies             BOOLEAN     NOT NULL DEFAULT FALSE,
  require_acknowledgement   BOOLEAN     NOT NULL DEFAULT FALSE,
  show_in_employee_portal   BOOLEAN     NOT NULL DEFAULT TRUE,
  status                    TEXT        NOT NULL DEFAULT 'sent'
                            CHECK (status IN ('draft', 'scheduled', 'sent', 'archived')),
  scheduled_at              TIMESTAMPTZ,
  sent_at                   TIMESTAMPTZ,
  archived_at               TIMESTAMPTZ,
  expires_at                TIMESTAMPTZ,
  metadata                  JSONB       NOT NULL DEFAULT '{}'::jsonb,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS set_notification_broadcasts_updated_at ON public.notification_broadcasts;
CREATE TRIGGER set_notification_broadcasts_updated_at
  BEFORE UPDATE ON public.notification_broadcasts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DO $$ BEGIN
  ALTER TABLE public.message_threads
    ADD CONSTRAINT message_threads_source_broadcast_fk
    FOREIGN KEY (source_broadcast_id) REFERENCES public.notification_broadcasts(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- --------------------------------------------------------------------------
-- notification_broadcast_recipients
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.notification_broadcast_recipients (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  broadcast_id      UUID        NOT NULL REFERENCES public.notification_broadcasts(id) ON DELETE CASCADE,
  employee_id       UUID        NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  user_id           UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  delivered_at      TIMESTAMPTZ,
  read_at           TIMESTAMPTZ,
  acknowledged_at   TIMESTAMPTZ,
  archived_at       TIMESTAMPTZ,
  is_read           BOOLEAN     NOT NULL DEFAULT FALSE,
  is_acknowledged   BOOLEAN     NOT NULL DEFAULT FALSE,
  reply_thread_id   UUID        REFERENCES public.message_threads(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (broadcast_id, employee_id)
);

-- --------------------------------------------------------------------------
-- notifications (Glocken-Benachrichtigungen — getrennt von communication_notifications)
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.notifications (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  recipient_user_id     UUID        REFERENCES auth.users(id) ON DELETE CASCADE,
  recipient_employee_id UUID        REFERENCES public.employees(id) ON DELETE CASCADE,
  notification_type     TEXT        NOT NULL
                        CHECK (notification_type IN ('broadcast', 'message', 'system', 'task', 'appointment')),
  title                 TEXT        NOT NULL,
  body_preview          TEXT,
  priority              TEXT        NOT NULL DEFAULT 'normal'
                        CHECK (priority IN ('normal', 'important', 'urgent', 'critical')),
  related_broadcast_id  UUID        REFERENCES public.notification_broadcasts(id) ON DELETE CASCADE,
  related_thread_id     UUID        REFERENCES public.message_threads(id) ON DELETE SET NULL,
  related_message_id    UUID,
  related_task_id       UUID,
  is_read               BOOLEAN     NOT NULL DEFAULT FALSE,
  read_at               TIMESTAMPTZ,
  delivered_at          TIMESTAMPTZ,
  action_url            TEXT,
  metadata              JSONB       NOT NULL DEFAULT '{}'::jsonb,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT notifications_recipient_present CHECK (
    recipient_user_id IS NOT NULL OR recipient_employee_id IS NOT NULL
  )
);

-- --------------------------------------------------------------------------
-- notification_attachments
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.notification_attachments (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  broadcast_id        UUID        REFERENCES public.notification_broadcasts(id) ON DELETE CASCADE,
  notification_id     UUID        REFERENCES public.notifications(id) ON DELETE CASCADE,
  file_name           TEXT,
  file_path           TEXT,
  mime_type           TEXT,
  file_size           BIGINT,
  uploaded_by_user_id UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT notification_attachments_target CHECK (
    broadcast_id IS NOT NULL OR notification_id IS NOT NULL
  )
);

-- --------------------------------------------------------------------------
-- broadcast_audit_events
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.broadcast_audit_events (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  actor_user_id UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  action        TEXT        NOT NULL,
  entity_type   TEXT        NOT NULL DEFAULT 'notification_broadcast',
  entity_id     UUID        NOT NULL,
  metadata      JSONB       NOT NULL DEFAULT '{}'::jsonb,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- --------------------------------------------------------------------------
-- Indexes
-- --------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_notification_broadcasts_tenant_sent
  ON public.notification_broadcasts (tenant_id, sent_at DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS idx_notification_broadcast_recipients_broadcast
  ON public.notification_broadcast_recipients (broadcast_id);

CREATE INDEX IF NOT EXISTS idx_notification_broadcast_recipients_employee
  ON public.notification_broadcast_recipients (tenant_id, employee_id);

CREATE INDEX IF NOT EXISTS idx_notifications_recipient_user
  ON public.notifications (tenant_id, recipient_user_id, created_at DESC)
  WHERE recipient_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_notifications_recipient_employee
  ON public.notifications (tenant_id, recipient_employee_id, created_at DESC)
  WHERE recipient_employee_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_notifications_unread
  ON public.notifications (tenant_id, is_read, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_broadcast_audit_tenant
  ON public.broadcast_audit_events (tenant_id, created_at DESC);

-- --------------------------------------------------------------------------
-- Permission: messages.broadcast.create
-- --------------------------------------------------------------------------
INSERT INTO public.role_permissions (role_id, permission_key)
SELECT r.id, 'messages.broadcast.create'
FROM public.roles r
WHERE r.key IN ('business_admin', 'business_manager', 'billing', 'dispatch')
ON CONFLICT (role_id, permission_key) DO NOTHING;

-- --------------------------------------------------------------------------
-- Storage bucket: broadcast-attachments
-- Pfad: tenant/{tenant_id}/broadcasts/{broadcast_id}/{attachment_id}/{file_name}
-- --------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'broadcast-attachments',
  'broadcast-attachments',
  false,
  10485760,
  ARRAY[
    'image/jpeg', 'image/png', 'image/webp', 'image/gif',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain'
  ]::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "broadcast_attachments_select" ON storage.objects;
CREATE POLICY "broadcast_attachments_select"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'broadcast-attachments'
    AND (storage.foldername(name))[1] = 'tenant'
    AND (storage.foldername(name))[2] = public.current_tenant_id()::text
  );

DROP POLICY IF EXISTS "broadcast_attachments_insert" ON storage.objects;
CREATE POLICY "broadcast_attachments_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'broadcast-attachments'
    AND (storage.foldername(name))[1] = 'tenant'
    AND (storage.foldername(name))[2] = public.current_tenant_id()::text
    AND public.has_permission('messages.broadcast.create')
  );

-- --------------------------------------------------------------------------
-- RLS
-- --------------------------------------------------------------------------
ALTER TABLE public.notification_broadcasts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_broadcast_recipients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.broadcast_audit_events ENABLE ROW LEVEL SECURITY;

-- notification_broadcasts: Office mit Broadcast-Berechtigung
DROP POLICY IF EXISTS notification_broadcasts_office_select ON public.notification_broadcasts;
CREATE POLICY notification_broadcasts_office_select ON public.notification_broadcasts
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND public.has_permission('messages.broadcast.create')
  );

DROP POLICY IF EXISTS notification_broadcasts_office_insert ON public.notification_broadcasts;
CREATE POLICY notification_broadcasts_office_insert ON public.notification_broadcasts
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND public.has_permission('messages.broadcast.create')
    AND created_by_user_id = auth.uid()
  );

DROP POLICY IF EXISTS notification_broadcasts_office_update ON public.notification_broadcasts;
CREATE POLICY notification_broadcasts_office_update ON public.notification_broadcasts
  FOR UPDATE TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND public.has_permission('messages.broadcast.create')
  )
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND public.has_permission('messages.broadcast.create')
  );

-- notification_broadcast_recipients: Office Statistik
DROP POLICY IF EXISTS notification_broadcast_recipients_office_select ON public.notification_broadcast_recipients;
CREATE POLICY notification_broadcast_recipients_office_select ON public.notification_broadcast_recipients
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND public.has_permission('messages.broadcast.create')
  );

DROP POLICY IF EXISTS notification_broadcast_recipients_office_insert ON public.notification_broadcast_recipients;
CREATE POLICY notification_broadcast_recipients_office_insert ON public.notification_broadcast_recipients
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND public.has_permission('messages.broadcast.create')
  );

-- notification_broadcast_recipients: Mitarbeitende nur eigene Zeile
DROP POLICY IF EXISTS notification_broadcast_recipients_employee_select ON public.notification_broadcast_recipients;
CREATE POLICY notification_broadcast_recipients_employee_select ON public.notification_broadcast_recipients
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND employee_id = public.resolve_current_employee_id()
  );

DROP POLICY IF EXISTS notification_broadcast_recipients_employee_update ON public.notification_broadcast_recipients;
CREATE POLICY notification_broadcast_recipients_employee_update ON public.notification_broadcast_recipients
  FOR UPDATE TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND employee_id = public.resolve_current_employee_id()
  )
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND employee_id = public.resolve_current_employee_id()
  );

-- notifications: eigene Benachrichtigungen
DROP POLICY IF EXISTS notifications_own_select ON public.notifications;
CREATE POLICY notifications_own_select ON public.notifications
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND (
      recipient_user_id = auth.uid()
      OR recipient_employee_id = public.resolve_current_employee_id()
    )
  );

DROP POLICY IF EXISTS notifications_own_update ON public.notifications;
CREATE POLICY notifications_own_update ON public.notifications
  FOR UPDATE TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND (
      recipient_user_id = auth.uid()
      OR recipient_employee_id = public.resolve_current_employee_id()
    )
  )
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND (
      recipient_user_id = auth.uid()
      OR recipient_employee_id = public.resolve_current_employee_id()
    )
  );

DROP POLICY IF EXISTS notifications_office_insert ON public.notifications;
CREATE POLICY notifications_office_insert ON public.notifications
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND public.has_permission('messages.broadcast.create')
  );

-- notification_attachments
DROP POLICY IF EXISTS notification_attachments_select ON public.notification_attachments;
CREATE POLICY notification_attachments_select ON public.notification_attachments
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND (
      public.has_permission('messages.broadcast.create')
      OR EXISTS (
        SELECT 1 FROM public.notifications n
        WHERE n.id = notification_attachments.notification_id
          AND n.tenant_id = notification_attachments.tenant_id
          AND (
            n.recipient_user_id = auth.uid()
            OR n.recipient_employee_id = public.resolve_current_employee_id()
          )
      )
      OR EXISTS (
        SELECT 1 FROM public.notification_broadcast_recipients r
        WHERE r.broadcast_id = notification_attachments.broadcast_id
          AND r.tenant_id = notification_attachments.tenant_id
          AND r.employee_id = public.resolve_current_employee_id()
      )
    )
  );

DROP POLICY IF EXISTS notification_attachments_insert ON public.notification_attachments;
CREATE POLICY notification_attachments_insert ON public.notification_attachments
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND public.has_permission('messages.broadcast.create')
  );

-- broadcast_audit_events
DROP POLICY IF EXISTS broadcast_audit_events_select ON public.broadcast_audit_events;
CREATE POLICY broadcast_audit_events_select ON public.broadcast_audit_events
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND public.has_permission('messages.broadcast.create')
  );

DROP POLICY IF EXISTS broadcast_audit_events_insert ON public.broadcast_audit_events;
CREATE POLICY broadcast_audit_events_insert ON public.broadcast_audit_events
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND (
      public.has_permission('messages.broadcast.create')
      OR actor_user_id = auth.uid()
    )
  );

GRANT SELECT, INSERT, UPDATE ON public.notification_broadcasts TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.notification_broadcast_recipients TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.notifications TO authenticated;
GRANT SELECT, INSERT ON public.notification_attachments TO authenticated;
GRANT SELECT, INSERT ON public.broadcast_audit_events TO authenticated;

-- Realtime für Badge-Updates
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_object THEN NULL;
END $$;

COMMENT ON TABLE public.notification_broadcasts IS 'Office-Broadcasts an Mitarbeitende (kein Gruppenchat)';
COMMENT ON TABLE public.notification_broadcast_recipients IS 'Empfänger pro Mitarbeiter:in — Lesestatus isoliert';
COMMENT ON TABLE public.notifications IS 'Glocken-Benachrichtigungen (Broadcast, Chat, System)';
COMMENT ON TABLE public.notification_attachments IS 'Anhänge für Broadcasts und Benachrichtigungen';
