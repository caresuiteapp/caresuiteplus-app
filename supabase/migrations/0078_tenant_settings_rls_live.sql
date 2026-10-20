-- ==========================================================================
-- CareSuite+ — Migration 0078: Mandanten-Stammdaten RLS auf Live
-- /settings/tenant → 400/42501 beim Logo-Upload (tenant-branding Storage)
-- und ggf. tenant_branding upsert: has_permission('business.tenant.manage')
-- mappt nicht auf Live-Matrix; Owner (invited) brauchen is_tenant_admin().
-- Pattern: 0076_employees_create_rls_live.sql, 0077_tenant_branding_storage.sql
-- ==========================================================================

-- --------------------------------------------------------------------------
-- has_permission: .manage + business.tenant.manage für Mandanten-Admins
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.has_permission(p_permission_key TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles pr
    JOIN public.role_permissions rp ON rp.role_id = pr.role_id
    WHERE pr.auth_user_id = auth.uid()
      AND (
        rp.permission_key = p_permission_key
        OR (
          rp.permission_key = split_part(p_permission_key, '.', 2)
          AND (
            (p_permission_key LIKE '%.view' AND COALESCE(rp.can_view, FALSE))
            OR (p_permission_key LIKE '%.create' AND COALESCE(rp.can_create, FALSE))
            OR (
              (p_permission_key LIKE '%.edit' OR p_permission_key LIKE '%.update')
              AND COALESCE(rp.can_update, FALSE)
            )
            OR (
              p_permission_key LIKE '%.manage'
              AND COALESCE(rp.can_update, FALSE)
            )
          )
        )
      )
  )
  OR (
    p_permission_key = 'business.tenant.manage'
    AND public.is_tenant_admin()
  )
$$;

GRANT EXECUTE ON FUNCTION public.has_permission(TEXT) TO authenticated;

-- --------------------------------------------------------------------------
-- tenants: permission-based UPDATE (OR neben admin policy)
-- --------------------------------------------------------------------------
DROP POLICY IF EXISTS "tenants_update_manage" ON public.tenants;
CREATE POLICY "tenants_update_manage"
  ON public.tenants FOR UPDATE TO authenticated
  USING (
    id = public.current_tenant_id()
    AND public.has_permission('business.tenant.manage')
  )
  WITH CHECK (
    id = public.current_tenant_id()
    AND public.has_permission('business.tenant.manage')
  );

-- --------------------------------------------------------------------------
-- tenant_branding: permission-based INSERT/UPDATE (OR neben admin policy)
-- --------------------------------------------------------------------------
DROP POLICY IF EXISTS "tenant_branding_insert_manage" ON public.tenant_branding;
CREATE POLICY "tenant_branding_insert_manage"
  ON public.tenant_branding FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND public.has_permission('business.tenant.manage')
  );

DROP POLICY IF EXISTS "tenant_branding_update_manage" ON public.tenant_branding;
CREATE POLICY "tenant_branding_update_manage"
  ON public.tenant_branding FOR UPDATE TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND public.has_permission('business.tenant.manage')
  )
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND public.has_permission('business.tenant.manage')
  );

GRANT SELECT, INSERT, UPDATE ON public.tenant_branding TO authenticated;

-- --------------------------------------------------------------------------
-- Storage tenant-branding: is_tenant_admin als Fallback (Upsert = INSERT+UPDATE)
-- --------------------------------------------------------------------------
DROP POLICY IF EXISTS "tenant_branding_insert_tenant" ON storage.objects;
CREATE POLICY "tenant_branding_insert_tenant"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'tenant-branding'
    AND (storage.foldername(name))[1] = 'tenant'
    AND (storage.foldername(name))[2] = public.current_tenant_id()::text
    AND (
      public.has_permission('business.tenant.manage')
      OR public.is_tenant_admin()
    )
  );

DROP POLICY IF EXISTS "tenant_branding_update_tenant" ON storage.objects;
CREATE POLICY "tenant_branding_update_tenant"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'tenant-branding'
    AND (storage.foldername(name))[1] = 'tenant'
    AND (storage.foldername(name))[2] = public.current_tenant_id()::text
    AND (
      public.has_permission('business.tenant.manage')
      OR public.is_tenant_admin()
    )
  )
  WITH CHECK (
    bucket_id = 'tenant-branding'
    AND (storage.foldername(name))[1] = 'tenant'
    AND (storage.foldername(name))[2] = public.current_tenant_id()::text
  );

DROP POLICY IF EXISTS "tenant_branding_delete_tenant" ON storage.objects;
CREATE POLICY "tenant_branding_delete_tenant"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'tenant-branding'
    AND (storage.foldername(name))[1] = 'tenant'
    AND (storage.foldername(name))[2] = public.current_tenant_id()::text
    AND (
      public.has_permission('business.tenant.manage')
      OR public.is_tenant_admin()
    )
  );
