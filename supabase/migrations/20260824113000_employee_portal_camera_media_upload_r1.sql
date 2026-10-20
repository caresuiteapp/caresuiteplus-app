-- ==========================================================================
-- CareSuite HealthOS — Mitarbeiterportal Kamera/Medien-Upload R1
-- 1. Erlaubt reale Smartphone-Foto-, Video-, Audio- und Nachweisformate.
-- 2. Repariert die Storage-Policies ohne stilles Überspringen bei Fehlern.
-- 3. Stellt Mitarbeiter-, Klienten- und Einsatzpfade mandantengetrennt sicher.
-- ==========================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'office-documents',
  'office-documents',
  false,
  52428800,
  ARRAY[
    'application/pdf',
    'application/json',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'image/heic',
    'image/heif',
    'image/avif',
    'video/mp4',
    'video/quicktime',
    'video/webm',
    'video/mpeg',
    'video/3gpp',
    'audio/webm',
    'audio/ogg',
    'audio/mpeg',
    'audio/mp3',
    'audio/wav',
    'audio/mp4',
    'audio/x-m4a',
    'audio/m4a'
  ]::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'message-attachments',
  'message-attachments',
  false,
  52428800,
  ARRAY[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'image/heic',
    'image/heif',
    'image/avif',
    'video/mp4',
    'video/quicktime',
    'video/webm',
    'video/mpeg',
    'video/3gpp',
    'audio/webm',
    'audio/ogg',
    'audio/mpeg',
    'audio/mp3',
    'audio/wav',
    'audio/mp4',
    'audio/x-m4a',
    'audio/m4a'
  ]::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Eigene Dokumente: tenant/{tenant}/employees/{employee}/portal-uploads/…
DROP POLICY IF EXISTS "portal_uploads_employee_insert" ON storage.objects;
CREATE POLICY "portal_uploads_employee_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'office-documents'
    AND (storage.foldername(name))[1] = 'tenant'
    AND (storage.foldername(name))[2] = public.current_tenant_id()::text
    AND (storage.foldername(name))[3] = 'employees'
    AND (storage.foldername(name))[4] = public.resolve_current_employee_id()::text
    AND (storage.foldername(name))[5] = 'portal-uploads'
    AND public.is_employee_portal_rls_context(public.current_tenant_id())
    AND public.resolve_current_employee_id() IS NOT NULL
  );

DROP POLICY IF EXISTS "portal_uploads_employee_select" ON storage.objects;
CREATE POLICY "portal_uploads_employee_select"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'office-documents'
    AND (storage.foldername(name))[1] = 'tenant'
    AND (storage.foldername(name))[2] = public.current_tenant_id()::text
    AND (storage.foldername(name))[3] = 'employees'
    AND (storage.foldername(name))[4] = public.resolve_current_employee_id()::text
    AND (storage.foldername(name))[5] = 'portal-uploads'
    AND public.is_employee_portal_rls_context(public.current_tenant_id())
    AND public.resolve_current_employee_id() IS NOT NULL
  );

-- Klientendokumente durch zugeordnete Mitarbeitende.
DROP POLICY IF EXISTS "portal_uploads_employee_client_insert" ON storage.objects;
CREATE POLICY "portal_uploads_employee_client_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'office-documents'
    AND (storage.foldername(name))[1] = 'tenant'
    AND (storage.foldername(name))[2] = public.current_tenant_id()::text
    AND (storage.foldername(name))[3] = 'clients'
    AND (storage.foldername(name))[5] = 'portal-uploads'
    AND public.is_employee_portal_rls_context(public.current_tenant_id())
    AND public.resolve_current_employee_id() IS NOT NULL
    AND (storage.foldername(name))[4]::uuid IN (
      SELECT assignment.client_id
      FROM public.assignments AS assignment
      WHERE assignment.tenant_id = public.current_tenant_id()
        AND assignment.employee_id = public.resolve_current_employee_id()
    )
  );

DROP POLICY IF EXISTS "portal_uploads_employee_client_select" ON storage.objects;
CREATE POLICY "portal_uploads_employee_client_select"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'office-documents'
    AND (storage.foldername(name))[1] = 'tenant'
    AND (storage.foldername(name))[2] = public.current_tenant_id()::text
    AND (storage.foldername(name))[3] = 'clients'
    AND (storage.foldername(name))[5] = 'portal-uploads'
    AND public.is_employee_portal_rls_context(public.current_tenant_id())
    AND public.resolve_current_employee_id() IS NOT NULL
    AND (storage.foldername(name))[4]::uuid IN (
      SELECT assignment.client_id
      FROM public.assignments AS assignment
      WHERE assignment.tenant_id = public.current_tenant_id()
        AND assignment.employee_id = public.resolve_current_employee_id()
    )
  );

-- Einsatzmedien: tenant/{tenant}/assist/visits/{visit}/attachments/…
DROP POLICY IF EXISTS "assist_execution_storage_portal_insert" ON storage.objects;
CREATE POLICY "assist_execution_storage_portal_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'office-documents'
    AND (storage.foldername(name))[1] = 'tenant'
    AND (storage.foldername(name))[2] = public.current_tenant_id()::text
    AND (storage.foldername(name))[3] = 'assist'
    AND (storage.foldername(name))[4] = 'visits'
    AND (storage.foldername(name))[5]::uuid IN (
      SELECT public.portal_employee_assigned_visit_ids(public.current_tenant_id())
    )
    AND (storage.foldername(name))[6] IN ('attachments', 'signatures', 'proofs')
    AND public.is_employee_portal_rls_context(public.current_tenant_id())
  );

DROP POLICY IF EXISTS "assist_execution_storage_portal_select" ON storage.objects;
CREATE POLICY "assist_execution_storage_portal_select"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'office-documents'
    AND (storage.foldername(name))[1] = 'tenant'
    AND (storage.foldername(name))[2] = public.current_tenant_id()::text
    AND (storage.foldername(name))[3] = 'assist'
    AND (storage.foldername(name))[4] = 'visits'
    AND (storage.foldername(name))[5]::uuid IN (
      SELECT public.portal_employee_assigned_visit_ids(public.current_tenant_id())
    )
    AND (storage.foldername(name))[6] IN ('attachments', 'signatures', 'proofs')
    AND public.is_employee_portal_rls_context(public.current_tenant_id())
  );

-- Tabellen-RLS erneut deterministisch herstellen.
DROP POLICY IF EXISTS portal_uploads_employee_portal_select ON public.portal_uploads;
CREATE POLICY portal_uploads_employee_portal_select ON public.portal_uploads
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND public.is_employee_portal_rls_context(tenant_id)
    AND employee_id = public.resolve_current_employee_id()
  );

DROP POLICY IF EXISTS portal_uploads_employee_portal_insert ON public.portal_uploads;
CREATE POLICY portal_uploads_employee_portal_insert ON public.portal_uploads
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND public.is_employee_portal_rls_context(tenant_id)
    AND employee_id = public.resolve_current_employee_id()
    AND (
      (upload_context = 'mitarbeiter' AND client_id IS NULL)
      OR (
        upload_context = 'klient'
        AND client_id IS NOT NULL
        AND client_id IN (
          SELECT assignment.client_id
          FROM public.assignments AS assignment
          WHERE assignment.tenant_id = public.current_tenant_id()
            AND assignment.employee_id = public.resolve_current_employee_id()
        )
      )
    )
  );

GRANT SELECT, INSERT ON public.portal_uploads TO authenticated;

COMMENT ON POLICY "assist_execution_storage_portal_insert" ON storage.objects IS
  'Mitarbeiterportal darf mandantengetrennte Einsatzmedien, Signaturen und Nachweise hochladen.';
