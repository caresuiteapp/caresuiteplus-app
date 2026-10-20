-- ==========================================================================
-- CareSuite+ — Migration 0091: Office Messaging Phase 2B
-- Attachments storage, portal write policies, participant portal select
-- ==========================================================================

-- --------------------------------------------------------------------------
-- Storage bucket: message-attachments
-- Pfad: tenant/{tenant_id}/threads/{thread_id}/{attachment_id}/{file_name}
-- --------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'message-attachments',
  'message-attachments',
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

-- SELECT: Mandant + Thread-Pfad
DROP POLICY IF EXISTS "message_attachments_select" ON storage.objects;
CREATE POLICY "message_attachments_select"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'message-attachments'
    AND (storage.foldername(name))[1] = 'tenant'
    AND (storage.foldername(name))[2] = public.current_tenant_id()::text
  );

-- INSERT: Office oder Portal (Mandant-Pfad)
DROP POLICY IF EXISTS "message_attachments_insert" ON storage.objects;
CREATE POLICY "message_attachments_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'message-attachments'
    AND (storage.foldername(name))[1] = 'tenant'
    AND (storage.foldername(name))[2] = public.current_tenant_id()::text
    AND (storage.foldername(name))[3] = 'threads'
  );

-- DELETE: Office-Berechtigung
DROP POLICY IF EXISTS "message_attachments_delete" ON storage.objects;
CREATE POLICY "message_attachments_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'message-attachments'
    AND (storage.foldername(name))[1] = 'tenant'
    AND (storage.foldername(name))[2] = public.current_tenant_id()::text
    AND public.has_permission('office.access')
  );

-- --------------------------------------------------------------------------
-- Portal write: Klient:innen-Threads
-- --------------------------------------------------------------------------
DROP POLICY IF EXISTS message_threads_portal_client_insert ON public.message_threads;
CREATE POLICY message_threads_portal_client_insert ON public.message_threads
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND thread_type = 'client'
    AND client_id IS NOT NULL
    AND employee_id IS NULL
  );

DROP POLICY IF EXISTS message_threads_portal_employee_insert ON public.message_threads;
CREATE POLICY message_threads_portal_employee_insert ON public.message_threads
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND thread_type = 'employee'
    AND employee_id IS NOT NULL
    AND client_id IS NULL
  );

-- Portal: Nachrichten senden (kein is_internal_note)
DROP POLICY IF EXISTS messages_portal_insert ON public.messages;
CREATE POLICY messages_portal_insert ON public.messages
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND is_internal_note = FALSE
    AND (
      sender_client_id IS NOT NULL
      OR sender_employee_id IS NOT NULL
    )
  );

-- Portal: interne Chats nur für Teilnehmer (SELECT)
DROP POLICY IF EXISTS message_threads_portal_internal_select ON public.message_threads;
CREATE POLICY message_threads_portal_internal_select ON public.message_threads
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND thread_type = 'internal'
    AND EXISTS (
      SELECT 1
      FROM public.message_thread_participants p
      JOIN public.profiles pr ON pr.id = p.profile_id
      WHERE p.thread_id = message_threads.id
        AND p.is_active = TRUE
        AND pr.auth_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS message_thread_participants_portal_select ON public.message_thread_participants;
CREATE POLICY message_thread_participants_portal_select ON public.message_thread_participants
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND profile_id IN (
      SELECT id FROM public.profiles WHERE auth_user_id = auth.uid()
    )
  );

COMMENT ON TABLE public.message_attachments IS 'Office-Messenger-Anhänge — Storage-Pfad tenant/{tenant_id}/threads/{thread_id}/…';
