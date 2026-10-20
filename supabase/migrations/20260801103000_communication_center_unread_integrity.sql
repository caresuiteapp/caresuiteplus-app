-- CareSuite HealthOS · Kommunikationszentrum R22
-- Atomare, mandantengetrennte Unread-Zähler für den produktiven Office-/Portal-Messenger.

CREATE OR REPLACE FUNCTION public.caresuite_message_unread_contribution(
  p_sender_profile_id UUID,
  p_sender_client_id UUID,
  p_sender_employee_id UUID,
  p_is_internal_note BOOLEAN,
  p_is_system_message BOOLEAN,
  p_read_at TIMESTAMPTZ,
  OUT office_unread INTEGER,
  OUT portal_unread INTEGER
)
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT
    CASE
      WHEN p_read_at IS NULL
       AND NOT COALESCE(p_is_internal_note, FALSE)
       AND NOT COALESCE(p_is_system_message, FALSE)
       AND (p_sender_client_id IS NOT NULL OR p_sender_employee_id IS NOT NULL)
      THEN 1 ELSE 0
    END,
    CASE
      WHEN p_read_at IS NULL
       AND NOT COALESCE(p_is_internal_note, FALSE)
       AND NOT COALESCE(p_is_system_message, FALSE)
       AND p_sender_profile_id IS NOT NULL
      THEN 1 ELSE 0
    END
$$;

CREATE OR REPLACE FUNCTION public.caresuite_sync_message_thread_unread_counters()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  old_office INTEGER := 0;
  old_portal INTEGER := 0;
  new_office INTEGER := 0;
  new_portal INTEGER := 0;
  target_thread_id UUID;
  target_tenant_id UUID;
BEGIN
  IF TG_OP <> 'INSERT' THEN
    SELECT office_unread, portal_unread
      INTO old_office, old_portal
      FROM public.caresuite_message_unread_contribution(
        OLD.sender_profile_id,
        OLD.sender_client_id,
        OLD.sender_employee_id,
        OLD.is_internal_note,
        OLD.is_system_message,
        OLD.read_at
      );
  END IF;

  IF TG_OP <> 'DELETE' THEN
    SELECT office_unread, portal_unread
      INTO new_office, new_portal
      FROM public.caresuite_message_unread_contribution(
        NEW.sender_profile_id,
        NEW.sender_client_id,
        NEW.sender_employee_id,
        NEW.is_internal_note,
        NEW.is_system_message,
        NEW.read_at
      );
  END IF;

  target_thread_id := COALESCE(NEW.thread_id, OLD.thread_id);
  target_tenant_id := COALESCE(NEW.tenant_id, OLD.tenant_id);

  UPDATE public.message_threads
     SET office_unread_count = GREATEST(0, office_unread_count + new_office - old_office),
         portal_unread_count = GREATEST(0, portal_unread_count + new_portal - old_portal),
         updated_at = NOW()
   WHERE id = target_thread_id
     AND tenant_id = target_tenant_id;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS caresuite_message_unread_counters ON public.messages;
CREATE TRIGGER caresuite_message_unread_counters
AFTER INSERT OR DELETE OR UPDATE OF
  read_at,
  sender_profile_id,
  sender_client_id,
  sender_employee_id,
  is_internal_note,
  is_system_message
ON public.messages
FOR EACH ROW
EXECUTE FUNCTION public.caresuite_sync_message_thread_unread_counters();

-- Bestehende Zähler einmalig aus den tatsächlichen ungelesenen Nachrichten reparieren.
WITH calculated AS (
  SELECT
    mt.id AS thread_id,
    COUNT(m.id) FILTER (
      WHERE m.read_at IS NULL
        AND NOT COALESCE(m.is_internal_note, FALSE)
        AND NOT COALESCE(m.is_system_message, FALSE)
        AND (m.sender_client_id IS NOT NULL OR m.sender_employee_id IS NOT NULL)
    )::INTEGER AS office_unread,
    COUNT(m.id) FILTER (
      WHERE m.read_at IS NULL
        AND NOT COALESCE(m.is_internal_note, FALSE)
        AND NOT COALESCE(m.is_system_message, FALSE)
        AND m.sender_profile_id IS NOT NULL
    )::INTEGER AS portal_unread
  FROM public.message_threads mt
  LEFT JOIN public.messages m
    ON m.thread_id = mt.id
   AND m.tenant_id = mt.tenant_id
  GROUP BY mt.id
)
UPDATE public.message_threads mt
   SET office_unread_count = calculated.office_unread,
       portal_unread_count = calculated.portal_unread,
       updated_at = NOW()
  FROM calculated
 WHERE calculated.thread_id = mt.id;

ALTER TABLE public.message_threads
  DROP CONSTRAINT IF EXISTS message_threads_office_unread_nonnegative;
ALTER TABLE public.message_threads
  ADD CONSTRAINT message_threads_office_unread_nonnegative
  CHECK (office_unread_count >= 0);

ALTER TABLE public.message_threads
  DROP CONSTRAINT IF EXISTS message_threads_portal_unread_nonnegative;
ALTER TABLE public.message_threads
  ADD CONSTRAINT message_threads_portal_unread_nonnegative
  CHECK (portal_unread_count >= 0);

COMMENT ON FUNCTION public.caresuite_sync_message_thread_unread_counters() IS
  'Keeps Office and portal unread counters atomically aligned with messages.';

-- --------------------------------------------------------------------------
-- Rollen- und Teilnehmertrennung innerhalb eines Mandanten
-- --------------------------------------------------------------------------
-- Die historischen Office-Policies waren nur mandantenweit eingeschränkt.
-- Da PostgreSQL permissive Policies mit OR verknüpft, konnten sie dadurch die
-- engeren Portal-Policies aushebeln. Office-Zugriffe benötigen nun explizit
-- office.access; Portale bleiben auf die eigene Akte bzw. Mitarbeitenden-ID
-- und freigegebene Gruppenmitgliedschaften begrenzt.

DROP POLICY IF EXISTS message_threads_office_select ON public.message_threads;
CREATE POLICY message_threads_office_select ON public.message_threads
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND public.has_permission('office.access')
  );

DROP POLICY IF EXISTS message_threads_office_write ON public.message_threads;
CREATE POLICY message_threads_office_write ON public.message_threads
  FOR ALL TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND public.has_permission('office.access')
  )
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND public.has_permission('office.access')
  );

DROP POLICY IF EXISTS message_threads_portal_client_insert ON public.message_threads;
CREATE POLICY message_threads_portal_client_insert ON public.message_threads
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND thread_type = 'client'::public.message_thread_type
    AND client_id = public.current_client_id()
    AND public.current_client_id() IS NOT NULL
    AND employee_id IS NULL
  );

DROP POLICY IF EXISTS message_threads_portal_employee_insert ON public.message_threads;
CREATE POLICY message_threads_portal_employee_insert ON public.message_threads
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND thread_type = 'employee'::public.message_thread_type
    AND employee_id = public.resolve_current_employee_id()
    AND public.resolve_current_employee_id() IS NOT NULL
    AND client_id IS NULL
  );

DROP POLICY IF EXISTS message_threads_portal_employee_update ON public.message_threads;
CREATE POLICY message_threads_portal_employee_update ON public.message_threads
  FOR UPDATE TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND (
      (
        thread_type = 'employee'::public.message_thread_type
        AND employee_id = public.resolve_current_employee_id()
      )
      OR (
        thread_type = 'employee_group'::public.message_thread_type
        AND EXISTS (
          SELECT 1
          FROM public.message_thread_employee_participants participant
          WHERE participant.thread_id = message_threads.id
            AND participant.tenant_id = message_threads.tenant_id
            AND participant.employee_id = public.resolve_current_employee_id()
            AND participant.is_active = TRUE
        )
      )
    )
  )
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND (
      (
        thread_type = 'employee'::public.message_thread_type
        AND employee_id = public.resolve_current_employee_id()
      )
      OR (
        thread_type = 'employee_group'::public.message_thread_type
        AND EXISTS (
          SELECT 1
          FROM public.message_thread_employee_participants participant
          WHERE participant.thread_id = message_threads.id
            AND participant.tenant_id = message_threads.tenant_id
            AND participant.employee_id = public.resolve_current_employee_id()
            AND participant.is_active = TRUE
        )
      )
    )
  );

DROP POLICY IF EXISTS messages_office_select ON public.messages;
CREATE POLICY messages_office_select ON public.messages
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND public.has_permission('office.access')
  );

DROP POLICY IF EXISTS messages_office_write ON public.messages;
CREATE POLICY messages_office_write ON public.messages
  FOR ALL TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND public.has_permission('office.access')
  )
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND public.has_permission('office.access')
  );

DROP POLICY IF EXISTS messages_portal_delete_own ON public.messages;
CREATE POLICY messages_portal_delete_own ON public.messages
  FOR DELETE TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND is_internal_note = FALSE
    AND (
      sender_client_id = public.current_client_id()
      OR sender_employee_id = public.resolve_current_employee_id()
    )
  );

DROP POLICY IF EXISTS message_thread_employee_participants_tenant
  ON public.message_thread_employee_participants;
DROP POLICY IF EXISTS message_thread_employee_participants_office
  ON public.message_thread_employee_participants;
CREATE POLICY message_thread_employee_participants_office
  ON public.message_thread_employee_participants
  FOR ALL TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND public.has_permission('office.access')
  )
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND public.has_permission('office.access')
  );

DROP POLICY IF EXISTS message_thread_employee_participants_portal_self
  ON public.message_thread_employee_participants;
CREATE POLICY message_thread_employee_participants_portal_self
  ON public.message_thread_employee_participants
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND employee_id = public.resolve_current_employee_id()
    AND public.resolve_current_employee_id() IS NOT NULL
  );

DROP POLICY IF EXISTS message_attachments_tenant ON public.message_attachments;
DROP POLICY IF EXISTS message_attachments_office ON public.message_attachments;
CREATE POLICY message_attachments_office ON public.message_attachments
  FOR ALL TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND public.has_permission('office.access')
  )
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND public.has_permission('office.access')
  );

DROP POLICY IF EXISTS message_attachments_portal_select ON public.message_attachments;
CREATE POLICY message_attachments_portal_select ON public.message_attachments
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND EXISTS (
      SELECT 1
      FROM public.messages portal_message
      JOIN public.message_threads portal_thread ON portal_thread.id = portal_message.thread_id
      WHERE portal_message.id = message_attachments.message_id
        AND portal_message.tenant_id = message_attachments.tenant_id
        AND portal_message.is_internal_note = FALSE
        AND portal_message.is_system_message = FALSE
        AND (
          portal_thread.client_id = public.current_client_id()
          OR portal_thread.employee_id = public.resolve_current_employee_id()
          OR EXISTS (
            SELECT 1
            FROM public.message_thread_employee_participants participant
            WHERE participant.thread_id = portal_thread.id
              AND participant.tenant_id = portal_thread.tenant_id
              AND participant.employee_id = public.resolve_current_employee_id()
              AND participant.is_active = TRUE
          )
        )
    )
  );

DROP POLICY IF EXISTS message_attachments_portal_insert ON public.message_attachments;
CREATE POLICY message_attachments_portal_insert ON public.message_attachments
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND EXISTS (
      SELECT 1
      FROM public.messages portal_message
      JOIN public.message_threads portal_thread ON portal_thread.id = portal_message.thread_id
      WHERE portal_message.id = message_attachments.message_id
        AND portal_message.tenant_id = message_attachments.tenant_id
        AND portal_message.is_internal_note = FALSE
        AND (
          portal_message.sender_client_id = public.current_client_id()
          OR portal_message.sender_employee_id = public.resolve_current_employee_id()
        )
        AND (
          portal_thread.client_id = public.current_client_id()
          OR portal_thread.employee_id = public.resolve_current_employee_id()
          OR EXISTS (
            SELECT 1
            FROM public.message_thread_employee_participants participant
            WHERE participant.thread_id = portal_thread.id
              AND participant.tenant_id = portal_thread.tenant_id
              AND participant.employee_id = public.resolve_current_employee_id()
              AND participant.is_active = TRUE
          )
        )
    )
  );

DROP POLICY IF EXISTS "message_attachments_select" ON storage.objects;
CREATE POLICY "message_attachments_select"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'message-attachments'
    AND (storage.foldername(name))[1] = 'tenant'
    AND (storage.foldername(name))[2] = public.current_tenant_id()::text
    AND (storage.foldername(name))[3] = 'threads'
    AND EXISTS (
      SELECT 1
      FROM public.message_threads accessible_thread
      WHERE accessible_thread.id::text = (storage.foldername(name))[4]
        AND accessible_thread.tenant_id = public.current_tenant_id()
        AND (
          public.has_permission('office.access')
          OR accessible_thread.client_id = public.current_client_id()
          OR accessible_thread.employee_id = public.resolve_current_employee_id()
          OR EXISTS (
            SELECT 1
            FROM public.message_thread_employee_participants participant
            WHERE participant.thread_id = accessible_thread.id
              AND participant.tenant_id = accessible_thread.tenant_id
              AND participant.employee_id = public.resolve_current_employee_id()
              AND participant.is_active = TRUE
          )
        )
    )
  );

DROP POLICY IF EXISTS "message_attachments_insert" ON storage.objects;
CREATE POLICY "message_attachments_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'message-attachments'
    AND (storage.foldername(name))[1] = 'tenant'
    AND (storage.foldername(name))[2] = public.current_tenant_id()::text
    AND (storage.foldername(name))[3] = 'threads'
    AND EXISTS (
      SELECT 1
      FROM public.message_threads accessible_thread
      WHERE accessible_thread.id::text = (storage.foldername(name))[4]
        AND accessible_thread.tenant_id = public.current_tenant_id()
        AND (
          public.has_permission('office.access')
          OR accessible_thread.client_id = public.current_client_id()
          OR accessible_thread.employee_id = public.resolve_current_employee_id()
          OR EXISTS (
            SELECT 1
            FROM public.message_thread_employee_participants participant
            WHERE participant.thread_id = accessible_thread.id
              AND participant.tenant_id = accessible_thread.tenant_id
              AND participant.employee_id = public.resolve_current_employee_id()
              AND participant.is_active = TRUE
          )
        )
    )
  );

-- Die Schalter sind keine Dekoration: Portale dürfen die aktive Mandanten-
-- konfiguration lesen; ändern darf sie weiterhin nur die Verwaltung.
DROP POLICY IF EXISTS "communication_settings_select" ON public.communication_settings;
CREATE POLICY "communication_settings_select"
  ON public.communication_settings FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id());
