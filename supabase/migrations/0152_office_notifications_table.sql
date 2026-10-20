-- ==========================================================================
-- CareSuite+ — Migration 0095: Office Notification Bell (office_notifications)
-- Production hat bereits Legacy-Tabelle `notifications` (Enum-Schema).
-- Migration 0094 konnte CREATE TABLE notifications nicht anwenden (IF NOT EXISTS).
-- Neue Glocken-Benachrichtigungen laufen über office_notifications.
-- ==========================================================================

-- --------------------------------------------------------------------------
-- office_notifications
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.office_notifications (
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
  CONSTRAINT office_notifications_recipient_present CHECK (
    recipient_user_id IS NOT NULL OR recipient_employee_id IS NOT NULL
  )
);

-- --------------------------------------------------------------------------
-- notification_attachments: Verknüpfung mit office_notifications
-- --------------------------------------------------------------------------
ALTER TABLE public.notification_attachments
  ADD COLUMN IF NOT EXISTS office_notification_id UUID;

DO $$ BEGIN
  ALTER TABLE public.notification_attachments
    ADD CONSTRAINT notification_attachments_office_notification_fk
    FOREIGN KEY (office_notification_id) REFERENCES public.office_notifications(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE public.notification_attachments
  DROP CONSTRAINT IF EXISTS notification_attachments_target;

ALTER TABLE public.notification_attachments
  ADD CONSTRAINT notification_attachments_target CHECK (
    broadcast_id IS NOT NULL
    OR notification_id IS NOT NULL
    OR office_notification_id IS NOT NULL
  );

-- --------------------------------------------------------------------------
-- Indexes
-- --------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_office_notifications_recipient_user
  ON public.office_notifications (tenant_id, recipient_user_id, created_at DESC)
  WHERE recipient_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_office_notifications_recipient_employee
  ON public.office_notifications (tenant_id, recipient_employee_id, created_at DESC)
  WHERE recipient_employee_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_office_notifications_unread
  ON public.office_notifications (tenant_id, is_read, created_at DESC);

-- --------------------------------------------------------------------------
-- RLS
-- --------------------------------------------------------------------------
ALTER TABLE public.office_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS office_notifications_own_select ON public.office_notifications;
CREATE POLICY office_notifications_own_select ON public.office_notifications
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND (
      recipient_user_id = auth.uid()
      OR recipient_employee_id = public.resolve_current_employee_id()
    )
  );

DROP POLICY IF EXISTS office_notifications_own_update ON public.office_notifications;
CREATE POLICY office_notifications_own_update ON public.office_notifications
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

DROP POLICY IF EXISTS office_notifications_office_insert ON public.office_notifications;
CREATE POLICY office_notifications_office_insert ON public.office_notifications
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND public.has_permission('messages.broadcast.create')
  );

-- notification_attachments: Office-Glocke lesen
DROP POLICY IF EXISTS notification_attachments_select ON public.notification_attachments;
CREATE POLICY notification_attachments_select ON public.notification_attachments
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND (
      public.has_permission('messages.broadcast.create')
      OR EXISTS (
        SELECT 1 FROM public.office_notifications n
        WHERE n.id = notification_attachments.office_notification_id
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

GRANT SELECT, INSERT, UPDATE ON public.office_notifications TO authenticated;

-- Realtime für Badge-Updates
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.office_notifications;
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_object THEN NULL;
END $$;

COMMENT ON TABLE public.office_notifications IS 'Office-Glocken-Benachrichtigungen (Broadcast, Chat, System) — getrennt von Legacy notifications';
