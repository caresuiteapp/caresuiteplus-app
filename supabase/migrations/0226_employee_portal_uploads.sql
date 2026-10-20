-- ==========================================================================
-- CareSuite+ — Migration 0226: Employee portal document uploads
-- Mitarbeitende reichen Dokumente ein → Office-Prüfung (portal_uploads)
-- ==========================================================================

ALTER TABLE public.portal_uploads
  ADD COLUMN IF NOT EXISTS employee_id UUID REFERENCES public.employees(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS upload_context TEXT NOT NULL DEFAULT 'klient';

ALTER TABLE public.portal_uploads
  ALTER COLUMN client_id DROP NOT NULL;

DO $$ BEGIN
  ALTER TABLE public.portal_uploads
    ADD CONSTRAINT portal_uploads_context_check
    CHECK (upload_context IN ('mitarbeiter', 'klient'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_portal_uploads_employee
  ON public.portal_uploads (tenant_id, employee_id, created_at DESC)
  WHERE employee_id IS NOT NULL;

-- Storage: employee self-uploads under tenant/{tenantId}/employees/{employeeId}/portal-uploads/…
-- Fresh-DB: storage.objects gehört supabase_storage_admin — Policies ggf. übersprungen
DO $portal_uploads_storage$
BEGIN
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
      AND public.current_role_key() = 'employee_portal'
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
      AND public.current_role_key() = 'employee_portal'
      AND public.resolve_current_employee_id() IS NOT NULL
    );

  DROP POLICY IF EXISTS "portal_uploads_employee_client_insert" ON storage.objects;
  CREATE POLICY "portal_uploads_employee_client_insert"
    ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (
      bucket_id = 'office-documents'
      AND (storage.foldername(name))[1] = 'tenant'
      AND (storage.foldername(name))[2] = public.current_tenant_id()::text
      AND (storage.foldername(name))[3] = 'clients'
      AND (storage.foldername(name))[5] = 'portal-uploads'
      AND public.current_role_key() = 'employee_portal'
      AND public.resolve_current_employee_id() IS NOT NULL
      AND (storage.foldername(name))[4]::uuid IN (
        SELECT a.client_id
        FROM public.assignments a
        WHERE a.tenant_id = public.current_tenant_id()
          AND a.employee_id = public.resolve_current_employee_id()
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
      AND public.current_role_key() = 'employee_portal'
      AND public.resolve_current_employee_id() IS NOT NULL
      AND (storage.foldername(name))[4]::uuid IN (
        SELECT a.client_id
        FROM public.assignments a
        WHERE a.tenant_id = public.current_tenant_id()
          AND a.employee_id = public.resolve_current_employee_id()
      )
    );
EXCEPTION
  WHEN insufficient_privilege THEN
    RAISE NOTICE '0226: portal upload storage policies skipped (not owner of storage.objects)';
END
$portal_uploads_storage$;

-- RLS: employee portal uploads
DROP POLICY IF EXISTS portal_uploads_employee_portal_select ON public.portal_uploads;
CREATE POLICY portal_uploads_employee_portal_select ON public.portal_uploads
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND public.current_role_key() = 'employee_portal'
    AND employee_id = public.resolve_current_employee_id()
  );

DROP POLICY IF EXISTS portal_uploads_employee_portal_insert ON public.portal_uploads;
CREATE POLICY portal_uploads_employee_portal_insert ON public.portal_uploads
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND public.current_role_key() = 'employee_portal'
    AND employee_id = public.resolve_current_employee_id()
    AND (
      (upload_context = 'mitarbeiter' AND client_id IS NULL)
      OR (
        upload_context = 'klient'
        AND client_id IS NOT NULL
        AND client_id IN (
          SELECT a.client_id
          FROM public.assignments a
          WHERE a.tenant_id = public.current_tenant_id()
            AND a.employee_id = public.resolve_current_employee_id()
        )
      )
    )
  );

COMMENT ON COLUMN public.portal_uploads.employee_id IS 'Mitarbeitende:r, der das Dokument eingereicht hat';
COMMENT ON COLUMN public.portal_uploads.upload_context IS 'mitarbeiter = eigenes Dokument; klient = im Auftrag der Klient:in';
