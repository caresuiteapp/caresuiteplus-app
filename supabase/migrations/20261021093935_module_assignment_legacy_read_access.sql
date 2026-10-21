-- Repair missing read keys for established, tenant-bound legacy owner/admin roles.
-- No runtime administrator fallback, policy change, or write permission.
-- Shared legacy roles may include inactive profiles. Guard these three read keys
-- at the contributing profile so the repair never enables an inactive identity.
-- Existing personal denials exclude the repair, including future/expired rules:
-- the legacy has_permission evaluator does not evaluate personal overrides.
BEGIN;

-- Preserve the existing coarse and communication mappings and administrator
-- branches. Only the three repaired read keys require an active, tenant-bound
-- contributing profile with an unambiguous legacy or current auth link.
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
        p_permission_key NOT IN ('office.employees.view', 'office.invoices.view', 'office.catalogs.view')
        OR (
          pr.status::text = 'active'
          AND pr.is_active IS TRUE
          AND pr.tenant_id = public.current_tenant_id()
          AND (pr.auth_user_id = auth.uid() OR (pr.auth_user_id IS NULL AND pr.id = auth.uid()))
        )
      )
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


WITH legacy_roles AS MATERIALIZED (
  SELECT r.id, r.tenant_id, r.key
  FROM public.roles r
  WHERE r.tenant_id IS NOT NULL
    AND r.is_admin_role IS TRUE
    AND r.key IN ('owner', 'admin')
    AND EXISTS (
      SELECT 1 FROM public.role_permissions rp
      WHERE rp.role_id = r.id AND rp.permission_key = 'office.access'
        AND (rp.tenant_id IS NULL OR rp.tenant_id = r.tenant_id)
        AND coalesce(rp.restrictions, '{}'::jsonb) = '{}'::jsonb
    )
    -- A customized raw or mapped role list is a deliberate policy, not a seed gap.
    AND NOT EXISTS (
      SELECT 1 FROM public.role_permission_sets s
      WHERE s.tenant_id = r.tenant_id AND s.role_key IN (r.key, 'business_admin')
    )
    -- Do not convert restricted or internally inconsistent legacy role records.
    AND NOT EXISTS (
      SELECT 1 FROM public.role_permissions rp WHERE rp.role_id = r.id
        AND (coalesce(rp.restrictions, '{}'::jsonb) <> '{}'::jsonb
          OR rp.tenant_id IS NOT NULL AND rp.tenant_id <> r.tenant_id)
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.role_id = r.id AND p.tenant_id IS DISTINCT FROM r.tenant_id
    )
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.role_id = r.id AND p.tenant_id = r.tenant_id
        AND p.status::text = 'active' AND p.is_active IS TRUE
    )
), affected_people AS MATERIALIZED (
  SELECT r.id AS role_id, r.tenant_id, p.id AS profile_id, e.id AS employee_id
  FROM legacy_roles r
  JOIN public.profiles p ON p.role_id = r.id AND p.tenant_id = r.tenant_id
  LEFT JOIN public.employees e ON e.profile_id = p.id
  UNION
  -- A secondary role can inherit these rows too. Its personal restrictions count.
  SELECT r.id, r.tenant_id, e.profile_id, e.id
  FROM legacy_roles r
  JOIN public.employee_role_assignments a ON a.tenant_id = r.tenant_id AND a.role_key = r.key
  JOIN public.employees e ON e.id = a.employee_id
), eligible_roles AS MATERIALIZED (
  SELECT r.* FROM legacy_roles r
  WHERE NOT EXISTS (
    SELECT 1 FROM affected_people person
    JOIN public.employee_permission_overrides o ON o.employee_id = person.employee_id
    WHERE person.role_id = r.id AND o.allowed IS FALSE
      AND lower(btrim(o.permission_key)) IN (
        'office', 'employees', 'clients', 'billing', 'catalog', 'catalogs',
        'office.access', 'office.employees.view', 'office.invoices.view', 'office.catalogs.view'
      )
    -- Intentionally include past/future denials: conversion must not outlive them.
  )
  AND NOT EXISTS (
    SELECT 1 FROM affected_people person
    LEFT JOIN public.profiles p ON p.id = person.profile_id
    LEFT JOIN public.employees e ON e.id = person.employee_id
    WHERE person.role_id = r.id AND (
      p.id IS NULL OR p.tenant_id IS DISTINCT FROM r.tenant_id
      OR person.employee_id IS NOT NULL AND (
        e.tenant_id IS DISTINCT FROM r.tenant_id
        OR coalesce(e.status::text, '') NOT IN ('active', 'aktiv')
        OR e.deleted_at IS NOT NULL
        OR e.profile_id IS DISTINCT FROM person.profile_id
      )
      OR EXISTS (
        SELECT 1 FROM public.employees duplicate
        WHERE duplicate.profile_id = person.profile_id
          AND duplicate.id IS DISTINCT FROM person.employee_id
      )
    )
  )
  AND NOT EXISTS (
    SELECT 1 FROM affected_people person
    JOIN public.employee_data_scopes s ON s.employee_id = person.employee_id
    WHERE person.role_id = r.id
      AND (s.tenant_id IS DISTINCT FROM r.tenant_id OR s.scope_type <> 'tenant'
        OR nullif(btrim(s.scope_value), '') IS NOT NULL AND btrim(s.scope_value) <> r.tenant_id::text)
  )
  AND NOT EXISTS (
    SELECT 1 FROM affected_people person
    JOIN public.company_scope_profiles s ON s.profile_id = person.profile_id
    WHERE person.role_id = r.id AND s.scope_limited IS TRUE
  )
), missing_read_keys AS (
  -- Explicit legacy personnel and billing read grants translate directly.
  SELECT r.id AS role_id, r.tenant_id, 'office.employees.view'::text AS permission_key
  FROM eligible_roles r
  WHERE EXISTS (
    SELECT 1 FROM public.role_permissions rp
    WHERE rp.role_id = r.id AND rp.permission_key = 'employees' AND rp.can_view IS TRUE
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.role_permissions rp WHERE rp.role_id = r.id
      AND rp.permission_key = 'office.employees.view'
  )
  UNION ALL
  SELECT r.id, r.tenant_id, 'office.invoices.view'
  FROM eligible_roles r
  WHERE EXISTS (
    SELECT 1 FROM public.role_permissions rp
    WHERE rp.role_id = r.id AND rp.permission_key = 'billing' AND rp.can_view IS TRUE
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.role_permissions rp WHERE rp.role_id = r.id
      AND rp.permission_key = 'office.invoices.view'
  )
  UNION ALL
  -- Catalog read access repairs the established owner/admin -> business_admin
  -- application default. It is NOT inferred from one unrelated coarse grant.
  -- Require the complete unrestricted legacy owner matrix and no catalog policy.
  SELECT r.id, r.tenant_id, 'office.catalogs.view'
  FROM eligible_roles r
  WHERE (
    SELECT count(*) FROM public.role_permissions rp
    WHERE rp.role_id = r.id AND rp.permission_key IN ('clients', 'employees', 'billing')
      AND rp.can_view IS TRUE AND rp.can_create IS TRUE AND rp.can_update IS TRUE
  ) = 3
  AND NOT EXISTS (
    SELECT 1 FROM public.role_permissions rp WHERE rp.role_id = r.id
      AND (rp.permission_key IN ('catalog', 'catalogs') OR rp.permission_key LIKE 'office.catalogs.%')
  )
)
INSERT INTO public.role_permissions (
  tenant_id, role_id, permission_key, product_key,
  can_view, can_create, can_update, can_delete, can_export, can_approve, restrictions
)
SELECT tenant_id, role_id, permission_key, 'office',
  true, false, false, false, false, false, '{}'::jsonb
FROM missing_read_keys
ON CONFLICT (role_id, permission_key) DO NOTHING;

COMMIT;
