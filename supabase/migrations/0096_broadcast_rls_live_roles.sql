-- ==========================================================================
-- CareSuite+ — Migration 0096: Broadcast RLS für Live-Rollen (Helferhasen+)
-- Ursache: 0094 seedete messages.broadcast.create nur für business_admin,
-- business_manager, billing, dispatch — Live-Mandanten nutzen owner, admin,
-- management, office, planning. Kevin Reinhardt (owner) → RLS 42501.
-- Zusätzlich: has_permission nur auth_user_id, nicht Legacy profiles.id.
-- Pattern: 0076/0087 has_permission, 0083 owner permissions, 0093 current_tenant_id
-- ==========================================================================

-- --------------------------------------------------------------------------
-- profiles.auth_user_id backfill (Legacy: id = auth.users.id)
-- --------------------------------------------------------------------------
UPDATE public.profiles
SET auth_user_id = id
WHERE auth_user_id IS NULL
  AND id IN (SELECT id FROM auth.users);

-- --------------------------------------------------------------------------
-- has_permission: Profil über id ODER auth_user_id (0093-Parität)
-- Tenant-Admins dürfen Broadcasts senden (wie business.tenant.manage)
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
    WHERE (pr.id = auth.uid() OR pr.auth_user_id = auth.uid())
      AND (
        rp.permission_key = p_permission_key
        OR (
          rp.permission_key = split_part(p_permission_key, '.', 2)
          AND (
            (p_permission_key LIKE '%.view' AND COALESCE(rp.can_view, FALSE))
            OR (p_permission_key LIKE '%.create' AND COALESCE(rp.can_create, FALSE))
            OR (p_permission_key LIKE '%.upload' AND COALESCE(rp.can_create, FALSE))
            OR (
              (p_permission_key LIKE '%.edit' OR p_permission_key LIKE '%.update')
              AND COALESCE(rp.can_update, FALSE)
            )
            OR (p_permission_key LIKE '%.delete' AND COALESCE(rp.can_delete, FALSE))
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
  OR (
    p_permission_key = 'messages.broadcast.create'
    AND public.is_tenant_admin()
  )
$$;

GRANT EXECUTE ON FUNCTION public.has_permission(TEXT) TO authenticated;

-- --------------------------------------------------------------------------
-- is_tenant_admin: Profil über id ODER auth_user_id
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
    WHERE (p.id = auth.uid() OR p.auth_user_id = auth.uid())
      AND p.status IN ('active', 'invited')
      AND (
        COALESCE(r.is_admin_role, FALSE) = TRUE
        OR r.key IN (
          'owner',
          'admin',
          'management',
          'geschaeftsfuehrung',
          'business_admin'
        )
      )
  )
$$;

GRANT EXECUTE ON FUNCTION public.is_tenant_admin() TO authenticated;

-- --------------------------------------------------------------------------
-- Permission: messages.broadcast.create — Live-Rollen + CareSuite+-Keys
-- --------------------------------------------------------------------------
INSERT INTO public.role_permissions (role_id, permission_key)
SELECT r.id, 'messages.broadcast.create'
FROM public.roles r
WHERE r.key IN (
  -- Live-Matrix (Produktion)
  'owner',
  'admin',
  'management',
  'office',
  'planning',
  'billing',
  -- CareSuite+ Canonical
  'business_admin',
  'business_manager',
  'dispatch',
  'geschaeftsfuehrung'
)
ON CONFLICT (role_id, permission_key) DO NOTHING;
