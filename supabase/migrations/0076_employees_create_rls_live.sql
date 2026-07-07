-- ==========================================================================
-- CareSuite+ — Migration 0076: Mitarbeitenden-Anlage RLS auf Live
-- POST /employees → 403 (42501): nur employees_admin_manage_own_tenant
-- (is_tenant_admin + status=active). Invited owners (Helferhasen+) scheitern.
-- Pattern: 0060_intake_completion_rls_grants.sql
-- ==========================================================================

-- --------------------------------------------------------------------------
-- Fresh-DB: Spalten fehlen (Live-Schema-Drift, hier minimal nachgezogen)
-- --------------------------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS auth_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';

ALTER TABLE public.roles
  ADD COLUMN IF NOT EXISTS is_admin_role BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.role_permissions
  ADD COLUMN IF NOT EXISTS can_view BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS can_create BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS can_update BOOLEAN NOT NULL DEFAULT FALSE;

-- --------------------------------------------------------------------------
-- has_permission: CareSuite+-Keys + Live-Matrix (permission_key + can_*)
-- office.employees.create → employees.can_create
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
          )
        )
      )
  )
$$;

GRANT EXECUTE ON FUNCTION public.has_permission(TEXT) TO authenticated;

-- --------------------------------------------------------------------------
-- is_tenant_admin: invited owners/admins (Onboarding) nicht ausschließen
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_tenant_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    JOIN public.roles r ON r.id = p.role_id
    WHERE p.auth_user_id = auth.uid()
      AND p.status IN ('active', 'invited')
      AND (
        r.is_admin_role = TRUE
        OR r.key IN ('owner', 'admin', 'management', 'geschaeftsfuehrung')
      )
  )
$$;

GRANT EXECUTE ON FUNCTION public.is_tenant_admin() TO authenticated;

-- --------------------------------------------------------------------------
-- employees: permission-based write (OR neben admin policy)
-- --------------------------------------------------------------------------
DROP POLICY IF EXISTS "employees_insert_tenant" ON public.employees;
CREATE POLICY "employees_insert_tenant"
  ON public.employees FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND public.has_permission('office.employees.create')
  );

DROP POLICY IF EXISTS "employees_update_tenant" ON public.employees;
CREATE POLICY "employees_update_tenant"
  ON public.employees FOR UPDATE TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND public.has_permission('office.employees.edit')
  )
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND public.has_permission('office.employees.edit')
  );

GRANT SELECT, INSERT, UPDATE ON public.employees TO authenticated;
