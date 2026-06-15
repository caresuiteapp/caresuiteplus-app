-- ==========================================================================
-- CareSuite+ — Migration 0012: Communication RLS (fehlende Tabellen) + Storage
-- Ergänzt 0011_communication_center.sql
-- Keine destruktiven Operationen (kein DROP TABLE / TRUNCATE / DELETE)
-- ==========================================================================

-- --------------------------------------------------------------------------
-- RLS: communication_participants
-- --------------------------------------------------------------------------
DROP POLICY IF EXISTS "communication_participants_select" ON public.communication_participants;
CREATE POLICY "communication_participants_select"
  ON public.communication_participants FOR SELECT
  USING (tenant_id = public.current_tenant_id() AND public.has_permission('communication.view_center'));

DROP POLICY IF EXISTS "communication_participants_write" ON public.communication_participants;
CREATE POLICY "communication_participants_write"
  ON public.communication_participants FOR ALL
  USING (tenant_id = public.current_tenant_id() AND public.has_permission('communication.create_thread'))
  WITH CHECK (tenant_id = public.current_tenant_id() AND public.has_permission('communication.create_thread'));

-- --------------------------------------------------------------------------
-- RLS: communication_attachments
-- --------------------------------------------------------------------------
DROP POLICY IF EXISTS "communication_attachments_select" ON public.communication_attachments;
CREATE POLICY "communication_attachments_select"
  ON public.communication_attachments FOR SELECT
  USING (tenant_id = public.current_tenant_id() AND public.has_permission('communication.view_center'));

DROP POLICY IF EXISTS "communication_attachments_write" ON public.communication_attachments;
CREATE POLICY "communication_attachments_write"
  ON public.communication_attachments FOR ALL
  USING (tenant_id = public.current_tenant_id() AND public.has_permission('communication.upload_attachment'))
  WITH CHECK (tenant_id = public.current_tenant_id() AND public.has_permission('communication.upload_attachment'));

-- --------------------------------------------------------------------------
-- RLS: communication_reactions
-- --------------------------------------------------------------------------
DROP POLICY IF EXISTS "communication_reactions_select" ON public.communication_reactions;
CREATE POLICY "communication_reactions_select"
  ON public.communication_reactions FOR SELECT
  USING (tenant_id = public.current_tenant_id() AND public.has_permission('communication.view_center'));

DROP POLICY IF EXISTS "communication_reactions_write" ON public.communication_reactions;
CREATE POLICY "communication_reactions_write"
  ON public.communication_reactions FOR ALL
  USING (tenant_id = public.current_tenant_id() AND public.has_permission('communication.react'))
  WITH CHECK (tenant_id = public.current_tenant_id() AND public.has_permission('communication.react'));

-- --------------------------------------------------------------------------
-- RLS: communication_assignments
-- --------------------------------------------------------------------------
DROP POLICY IF EXISTS "communication_assignments_select" ON public.communication_assignments;
CREATE POLICY "communication_assignments_select"
  ON public.communication_assignments FOR SELECT
  USING (tenant_id = public.current_tenant_id() AND public.has_permission('communication.view_center'));

DROP POLICY IF EXISTS "communication_assignments_write" ON public.communication_assignments;
CREATE POLICY "communication_assignments_write"
  ON public.communication_assignments FOR ALL
  USING (tenant_id = public.current_tenant_id() AND public.has_permission('communication.assign_thread'))
  WITH CHECK (tenant_id = public.current_tenant_id() AND public.has_permission('communication.assign_thread'));

-- --------------------------------------------------------------------------
-- RLS: communication_read_receipts
-- --------------------------------------------------------------------------
DROP POLICY IF EXISTS "communication_read_receipts_select" ON public.communication_read_receipts;
CREATE POLICY "communication_read_receipts_select"
  ON public.communication_read_receipts FOR SELECT
  USING (tenant_id = public.current_tenant_id() AND public.has_permission('communication.view_center'));

DROP POLICY IF EXISTS "communication_read_receipts_write" ON public.communication_read_receipts;
CREATE POLICY "communication_read_receipts_write"
  ON public.communication_read_receipts FOR ALL
  USING (tenant_id = public.current_tenant_id() AND public.has_permission('communication.send_message'))
  WITH CHECK (tenant_id = public.current_tenant_id() AND public.has_permission('communication.send_message'));

-- --------------------------------------------------------------------------
-- RLS: communication_notifications
-- --------------------------------------------------------------------------
DROP POLICY IF EXISTS "communication_notifications_select" ON public.communication_notifications;
CREATE POLICY "communication_notifications_select"
  ON public.communication_notifications FOR SELECT
  USING (tenant_id = public.current_tenant_id() AND public.has_permission('communication.view_center'));

DROP POLICY IF EXISTS "communication_notifications_write" ON public.communication_notifications;
CREATE POLICY "communication_notifications_write"
  ON public.communication_notifications FOR ALL
  USING (tenant_id = public.current_tenant_id() AND public.has_permission('communication.view_center'))
  WITH CHECK (tenant_id = public.current_tenant_id() AND public.has_permission('communication.view_center'));

-- --------------------------------------------------------------------------
-- Storage Buckets (Kommunikation + Office-Dokumente)
-- Ausführen via Supabase Dashboard oder: supabase storage policies apply
-- Pfade: tenant/{tenant_id}/threads/{thread_id}/attachments/{attachment_id}/{filename}
-- --------------------------------------------------------------------------

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('communication-attachments', 'communication-attachments', false, 26214400, ARRAY['application/pdf','image/jpeg','image/png','image/webp']::text[]),
  ('communication-voice', 'communication-voice', false, 10485760, ARRAY['audio/mpeg','audio/wav','audio/webm','audio/ogg']::text[]),
  ('communication-images', 'communication-images', false, 10485760, ARRAY['image/jpeg','image/png','image/webp','image/gif']::text[]),
  ('office-documents', 'office-documents', false, 52428800, ARRAY['application/pdf','image/jpeg','image/png','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document']::text[])
ON CONFLICT (id) DO NOTHING;

-- communication-attachments: SELECT + INSERT + UPDATE (upsert)
DROP POLICY IF EXISTS "comm_attachments_select" ON storage.objects;
CREATE POLICY "comm_attachments_select"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'communication-attachments'
    AND (storage.foldername(name))[1] = 'tenant'
    AND (storage.foldername(name))[2] = public.current_tenant_id()::text
  );

DROP POLICY IF EXISTS "comm_attachments_insert" ON storage.objects;
CREATE POLICY "comm_attachments_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'communication-attachments'
    AND (storage.foldername(name))[1] = 'tenant'
    AND (storage.foldername(name))[2] = public.current_tenant_id()::text
    AND public.has_permission('communication.upload_attachment')
  );

DROP POLICY IF EXISTS "comm_attachments_update" ON storage.objects;
CREATE POLICY "comm_attachments_update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'communication-attachments'
    AND (storage.foldername(name))[2] = public.current_tenant_id()::text
  )
  WITH CHECK (
    bucket_id = 'communication-attachments'
    AND (storage.foldername(name))[2] = public.current_tenant_id()::text
  );

-- office-documents
DROP POLICY IF EXISTS "office_docs_select" ON storage.objects;
CREATE POLICY "office_docs_select"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'office-documents'
    AND (storage.foldername(name))[1] = 'tenant'
    AND (storage.foldername(name))[2] = public.current_tenant_id()::text
  );

DROP POLICY IF EXISTS "office_docs_insert" ON storage.objects;
CREATE POLICY "office_docs_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'office-documents'
    AND (storage.foldername(name))[1] = 'tenant'
    AND (storage.foldername(name))[2] = public.current_tenant_id()::text
    AND public.has_permission('office.documents.upload')
  );

DROP POLICY IF EXISTS "office_docs_update" ON storage.objects;
CREATE POLICY "office_docs_update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'office-documents'
    AND (storage.foldername(name))[2] = public.current_tenant_id()::text
  )
  WITH CHECK (
    bucket_id = 'office-documents'
    AND (storage.foldername(name))[2] = public.current_tenant_id()::text
  );
