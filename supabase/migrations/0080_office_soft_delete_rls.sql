-- ==========================================================================
-- CareSuite+ — Migration 0080: Soft-Delete RLS & Spalten (nach 0079 Enums)
-- ==========================================================================

ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_clients_deleted
  ON public.clients (tenant_id, deleted_at)
  WHERE deleted_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_employees_deleted
  ON public.employees (tenant_id, deleted_at)
  WHERE deleted_at IS NOT NULL;

COMMENT ON COLUMN public.clients.deleted_at IS 'Soft-Delete — falsch angelegte Klient:innen ausblenden';
COMMENT ON COLUMN public.employees.deleted_at IS 'Soft-Delete — falsch angelegte Mitarbeitende ausblenden';

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
            OR (p_permission_key LIKE '%.delete' AND COALESCE(rp.can_delete, FALSE))
          )
        )
      )
  )
$$;

GRANT EXECUTE ON FUNCTION public.has_permission(TEXT) TO authenticated;

INSERT INTO public.role_permissions (role_id, permission_key)
SELECT r.id, p.key
FROM public.roles r
CROSS JOIN (
  VALUES
    ('office.clients.delete'),
    ('office.employees.delete')
) AS p(key)
WHERE r.key IN ('business_admin', 'business_manager', 'owner', 'admin', 'management', 'geschaeftsfuehrung')
ON CONFLICT (role_id, permission_key) DO NOTHING;

DROP POLICY IF EXISTS "clients_soft_delete_tenant" ON public.clients;
CREATE POLICY "clients_soft_delete_tenant"
  ON public.clients FOR UPDATE TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND (
      public.has_permission('office.clients.delete')
      OR public.is_tenant_admin()
    )
  )
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND status = 'deleted'
    AND (
      public.has_permission('office.clients.delete')
      OR public.is_tenant_admin()
    )
  );

DROP POLICY IF EXISTS "employees_soft_delete_tenant" ON public.employees;
CREATE POLICY "employees_soft_delete_tenant"
  ON public.employees FOR UPDATE TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND (
      public.has_permission('office.employees.delete')
      OR public.is_tenant_admin()
    )
  )
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND status = 'deleted'
    AND (
      public.has_permission('office.employees.delete')
      OR public.is_tenant_admin()
    )
  );
