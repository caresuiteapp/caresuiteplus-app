-- Allow authenticated users to read their own profile on login bootstrap
-- (required before current_tenant_id() can resolve tenant context).

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'profiles'
      AND policyname = 'profiles_select_own_auth_user'
  ) THEN
    CREATE POLICY profiles_select_own_auth_user
      ON public.profiles
      FOR SELECT
      TO authenticated
      USING (auth_user_id = auth.uid() OR id = auth.uid());
  END IF;
END
$$;
