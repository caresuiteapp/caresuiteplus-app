-- Tenant admins (owner/admin/…) with Live-Rollen-Matrix: legacy `messages` module maps to Communication Center RLS.
-- Pattern: 0096 messages.broadcast.create via is_tenant_admin().

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
        OR (
          p_permission_key LIKE 'communication.%'
          AND rp.permission_key = 'messages'
          AND (
            (p_permission_key LIKE '%.view%' AND COALESCE(rp.can_view, FALSE))
            OR (
              p_permission_key NOT LIKE '%.view%'
              AND COALESCE(rp.can_create, FALSE)
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
