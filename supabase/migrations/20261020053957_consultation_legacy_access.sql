-- Carry forward existing consultation entitlements for pre-platform workspaces.
-- This is a one-time backfill, not a runtime permission fallback.
BEGIN;

INSERT INTO public.platform_tenant_modules (
  tenant_id, module_key, status, enabled_at, starts_at, ends_at, is_trial, trial_ends_at
)
SELECT tp.tenant_id, 'consulting',
  CASE WHEN tp.status::text = 'trial' THEN 'trial' ELSE 'enabled' END,
  now(), tp.starts_at, tp.ends_at, tp.status::text = 'trial',
  CASE WHEN tp.status::text = 'trial' THEN tp.trial_ends_at ELSE NULL END
FROM public.tenant_products tp
JOIN public.products p ON p.id = tp.product_id AND p.product_key = tp.product_key
WHERE tp.product_key::text = 'beratung'
  AND tp.is_active IS TRUE AND p.is_active IS TRUE
  AND tp.status::text IN ('active', 'trial')
  AND (tp.starts_at IS NULL OR tp.starts_at <= now())
  AND (tp.ends_at IS NULL OR tp.ends_at > now())
  AND (tp.status::text <> 'trial' OR tp.trial_ends_at > now())
  AND tp.billing_status IS DISTINCT FROM 'admin_disabled'
  AND tp.access_source IS DISTINCT FROM 'disabled'
  AND EXISTS (SELECT 1 FROM public.platform_modules m
    WHERE m.module_key = 'consulting' AND m.status = 'available')
  -- Any explicit platform decision, including a lock or expiry, wins.
  AND NOT EXISTS (SELECT 1 FROM public.platform_tenant_modules m
    WHERE m.tenant_id = tp.tenant_id AND m.module_key = 'consulting')
ON CONFLICT (tenant_id, module_key) DO NOTHING;

-- Only unconverted, unrestricted tenant roles with an existing Beratung grant.
-- Custom role sets and roles with any granular Beratung keys are authoritative.
WITH legacy_roles AS MATERIALIZED (
  SELECT r.id, r.tenant_id, r.key, r.is_admin_role,
    rp.can_view, rp.can_create, rp.can_update, rp.can_approve
  FROM public.roles r
  JOIN public.role_permissions rp ON rp.role_id = r.id AND rp.permission_key = 'beratung'
  WHERE r.tenant_id IS NOT NULL
    AND (rp.tenant_id IS NULL OR rp.tenant_id = r.tenant_id)
    AND rp.can_view IS TRUE
    AND coalesce(rp.restrictions, '{}'::jsonb) = '{}'::jsonb
    AND lower(r.key) NOT IN (
      'employee_portal', 'client_portal', 'family_portal', 'employee',
      'client', 'family', 'relative', 'caregiver', 'nurse'
    )
    AND NOT EXISTS (SELECT 1 FROM public.role_permission_sets s
      WHERE s.tenant_id = r.tenant_id AND s.role_key = r.key)
    AND NOT EXISTS (SELECT 1 FROM public.role_permissions exact
      WHERE exact.role_id = r.id AND exact.permission_key LIKE 'beratung.%')
)
INSERT INTO public.role_permissions (tenant_id, role_id, permission_key, product_key, can_view)
SELECT r.tenant_id, r.id, permission.key, 'beratung', true
FROM legacy_roles r
CROSS JOIN (VALUES
  ('beratung.access'), ('beratung.cases.view'), ('beratung.cases.manage'),
  ('beratung.cases.review'), ('beratung.qualifications.manage')
) AS permission(key)
WHERE permission.key IN ('beratung.access', 'beratung.cases.view')
  OR (permission.key = 'beratung.cases.manage' AND r.can_create IS TRUE AND r.can_update IS TRUE)
  OR (permission.key = 'beratung.cases.review' AND r.can_approve IS TRUE)
  OR (permission.key = 'beratung.qualifications.manage'
    AND r.can_update IS TRUE AND r.can_approve IS TRUE
    AND (r.is_admin_role IS TRUE OR lower(r.key) IN ('owner', 'admin', 'business_admin')))
ON CONFLICT (role_id, permission_key) DO NOTHING;

COMMIT;
