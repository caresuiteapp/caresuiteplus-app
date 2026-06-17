-- ==========================================================================
-- CareSuite+ — Migration 0074: Mitarbeitenden-Profilbilder (avatar_url + Storage)
-- Pfad: tenant/{tenant_id}/employees/{employee_id}/avatar.{ext}
-- Bucket: employee-avatars (öffentlich lesbar für Anzeige)
-- ==========================================================================

ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS avatar_url TEXT;

COMMENT ON COLUMN public.employees.avatar_url IS 'Öffentliche URL des Profilbilds in Supabase Storage (Bucket employee-avatars).';

-- --------------------------------------------------------------------------
-- Storage-Bucket
-- --------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'employee-avatars',
  'employee-avatars',
  TRUE,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- --------------------------------------------------------------------------
-- SELECT — Mandanten-isoliert (authenticated)
-- --------------------------------------------------------------------------
DROP POLICY IF EXISTS "employee_avatars_select_tenant" ON storage.objects;
CREATE POLICY "employee_avatars_select_tenant"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'employee-avatars'
    AND (storage.foldername(name))[1] = 'tenant'
    AND (storage.foldername(name))[2] = public.current_tenant_id()::text
  );

-- --------------------------------------------------------------------------
-- INSERT — Anlegen/Bearbeiten mit HR-Berechtigung
-- --------------------------------------------------------------------------
DROP POLICY IF EXISTS "employee_avatars_insert_tenant" ON storage.objects;
CREATE POLICY "employee_avatars_insert_tenant"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'employee-avatars'
    AND (storage.foldername(name))[1] = 'tenant'
    AND (storage.foldername(name))[2] = public.current_tenant_id()::text
    AND (
      public.has_permission('office.employees.create')
      OR public.has_permission('office.employees.edit')
    )
  );

-- --------------------------------------------------------------------------
-- UPDATE — Upsert beim erneuten Upload
-- --------------------------------------------------------------------------
DROP POLICY IF EXISTS "employee_avatars_update_tenant" ON storage.objects;
CREATE POLICY "employee_avatars_update_tenant"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'employee-avatars'
    AND (storage.foldername(name))[1] = 'tenant'
    AND (storage.foldername(name))[2] = public.current_tenant_id()::text
    AND (
      public.has_permission('office.employees.create')
      OR public.has_permission('office.employees.edit')
    )
  )
  WITH CHECK (
    bucket_id = 'employee-avatars'
    AND (storage.foldername(name))[1] = 'tenant'
    AND (storage.foldername(name))[2] = public.current_tenant_id()::text
  );

-- --------------------------------------------------------------------------
-- DELETE — Bild entfernen
-- --------------------------------------------------------------------------
DROP POLICY IF EXISTS "employee_avatars_delete_tenant" ON storage.objects;
CREATE POLICY "employee_avatars_delete_tenant"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'employee-avatars'
    AND (storage.foldername(name))[1] = 'tenant'
    AND (storage.foldername(name))[2] = public.current_tenant_id()::text
    AND public.has_permission('office.employees.edit')
  );
