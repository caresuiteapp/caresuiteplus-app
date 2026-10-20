-- ==========================================================================
-- CareSuite+ — Migration 0088: Benutzer-Profilbilder (avatar_url + Storage)
-- Pfad: tenant/{tenant_id}/users/{auth_user_id}/avatar.{ext}
-- Bucket: user-avatars (öffentlich lesbar für Anzeige)
-- ==========================================================================

COMMENT ON COLUMN public.profiles.avatar_url IS
  'Öffentliche URL des Benutzer-Profilbilds in Supabase Storage (Bucket user-avatars).';

-- --------------------------------------------------------------------------
-- Storage-Bucket
-- --------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'user-avatars',
  'user-avatars',
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
DROP POLICY IF EXISTS "user_avatars_select_tenant" ON storage.objects;
CREATE POLICY "user_avatars_select_tenant"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'user-avatars'
    AND (storage.foldername(name))[1] = 'tenant'
    AND (storage.foldername(name))[2] = public.current_tenant_id()::text
  );

-- --------------------------------------------------------------------------
-- INSERT — eigenes Profilbild
-- --------------------------------------------------------------------------
DROP POLICY IF EXISTS "user_avatars_insert_own" ON storage.objects;
CREATE POLICY "user_avatars_insert_own"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'user-avatars'
    AND (storage.foldername(name))[1] = 'tenant'
    AND (storage.foldername(name))[2] = public.current_tenant_id()::text
    AND (storage.foldername(name))[3] = 'users'
    AND (storage.foldername(name))[4] = auth.uid()::text
  );

-- --------------------------------------------------------------------------
-- UPDATE — Upsert beim erneuten Upload
-- --------------------------------------------------------------------------
DROP POLICY IF EXISTS "user_avatars_update_own" ON storage.objects;
CREATE POLICY "user_avatars_update_own"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'user-avatars'
    AND (storage.foldername(name))[1] = 'tenant'
    AND (storage.foldername(name))[2] = public.current_tenant_id()::text
    AND (storage.foldername(name))[3] = 'users'
    AND (storage.foldername(name))[4] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'user-avatars'
    AND (storage.foldername(name))[1] = 'tenant'
    AND (storage.foldername(name))[2] = public.current_tenant_id()::text
    AND (storage.foldername(name))[3] = 'users'
    AND (storage.foldername(name))[4] = auth.uid()::text
  );

-- --------------------------------------------------------------------------
-- DELETE — Bild entfernen
-- --------------------------------------------------------------------------
DROP POLICY IF EXISTS "user_avatars_delete_own" ON storage.objects;
CREATE POLICY "user_avatars_delete_own"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'user-avatars'
    AND (storage.foldername(name))[1] = 'tenant'
    AND (storage.foldername(name))[2] = public.current_tenant_id()::text
    AND (storage.foldername(name))[3] = 'users'
    AND (storage.foldername(name))[4] = auth.uid()::text
  );

-- --------------------------------------------------------------------------
-- profiles UPDATE — eigenes Profil (auth_user_id oder Legacy id)
-- --------------------------------------------------------------------------
DROP POLICY IF EXISTS "profiles_update_own_auth_user" ON public.profiles;
CREATE POLICY "profiles_update_own_auth_user"
  ON public.profiles FOR UPDATE TO authenticated
  USING (auth_user_id = auth.uid() OR id = auth.uid())
  WITH CHECK (auth_user_id = auth.uid() OR id = auth.uid());
