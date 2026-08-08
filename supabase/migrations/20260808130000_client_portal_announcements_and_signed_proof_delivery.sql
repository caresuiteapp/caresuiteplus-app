-- CareSuite+ — Client portal announcements and signed proof delivery

ALTER TABLE public.notification_broadcasts
  ADD COLUMN IF NOT EXISTS show_in_client_portal BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE public.notification_broadcasts
SET show_in_client_portal = TRUE
WHERE (metadata ->> 'audienceSegment') = 'clients'
  AND show_in_employee_portal = TRUE;

DO $$
DECLARE
  constraint_name TEXT;
BEGIN
  FOR constraint_name IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.notification_broadcasts'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%audience%'
  LOOP
    EXECUTE format(
      'ALTER TABLE public.notification_broadcasts DROP CONSTRAINT IF EXISTS %I',
      constraint_name
    );
  END LOOP;
END $$;

ALTER TABLE public.notification_broadcasts
  ADD CONSTRAINT notification_broadcasts_audience_check
  CHECK (audience IN (
    'employees',
    'selected_employees',
    'role',
    'team',
    'location',
    'clients',
    'internal'
  ));

DROP POLICY IF EXISTS notification_broadcasts_client_portal_select
  ON public.notification_broadcasts;
CREATE POLICY notification_broadcasts_client_portal_select
  ON public.notification_broadcasts
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND audience = 'clients'
    AND show_in_client_portal = TRUE
    AND status = 'sent'
    AND (expires_at IS NULL OR expires_at > NOW())
    AND EXISTS (
      SELECT 1
      FROM public.notifications notification
      WHERE notification.tenant_id = notification_broadcasts.tenant_id
        AND notification.related_broadcast_id = notification_broadcasts.id
        AND notification.recipient_user_id = auth.uid()
    )
  );

COMMENT ON COLUMN public.notification_broadcasts.show_in_client_portal IS
  'Broadcast is visible only to explicitly addressed client portal accounts.';
