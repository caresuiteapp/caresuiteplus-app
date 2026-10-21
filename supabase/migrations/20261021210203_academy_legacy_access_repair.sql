-- Translate an established, unrestricted legacy Academy grant into the exact
-- permissions consumed by the published Academy RPC. This does not infer
-- authority from an administrator label or change runtime authorization.
BEGIN;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='30s';

WITH legacy_roles AS MATERIALIZED (
  SELECT r.id, r.tenant_id, r.key, academy.can_create, academy.can_update, academy.can_approve
  FROM public.roles r
  JOIN public.role_permissions academy ON academy.role_id=r.id AND academy.permission_key='academy'
  WHERE r.tenant_id IS NOT NULL AND r.is_admin_role IS TRUE AND r.key IN ('owner','admin')
    AND academy.can_view IS TRUE
    AND EXISTS (
      SELECT 1 FROM public.role_permissions p
      WHERE p.role_id=r.id AND p.permission_key='office.access'
        AND (p.tenant_id IS NULL OR p.tenant_id=r.tenant_id)
        AND coalesce(p.restrictions,'{}'::jsonb)='{}'::jsonb
    )
    -- Both raw and mapped replacement sets express deliberate tenant policy.
    AND NOT EXISTS (
      SELECT 1 FROM public.role_permission_sets s
      WHERE s.tenant_id=r.tenant_id AND s.role_key IN (r.key,'business_admin')
    )
    -- An existing Academy-specific list is not a missing legacy conversion.
    -- This also makes a repeated migration unable to restore a removed key.
    AND NOT EXISTS (
      SELECT 1 FROM public.role_permissions p WHERE p.role_id=r.id AND (
        lower(btrim(p.permission_key)) IN ('akademie','training')
        OR lower(btrim(p.permission_key)) LIKE 'akademie.%'
        OR lower(btrim(p.permission_key)) LIKE 'academy.%'
        OR lower(btrim(p.permission_key)) LIKE 'training.%'
      )
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.role_permissions p WHERE p.role_id=r.id AND (
        coalesce(p.restrictions,'{}'::jsonb)<>'{}'::jsonb
        OR p.tenant_id IS NOT NULL AND p.tenant_id<>r.tenant_id
      )
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.profiles p WHERE p.role_id=r.id AND p.tenant_id IS DISTINCT FROM r.tenant_id
    )
    AND EXISTS (
      SELECT 1 FROM public.profiles p WHERE p.role_id=r.id AND p.tenant_id=r.tenant_id
        AND p.status::text='active' AND p.is_active IS TRUE
    )
), affected_people AS MATERIALIZED (
  SELECT r.id role_id,r.tenant_id,p.id profile_id,e.id employee_id
  FROM legacy_roles r
  JOIN public.profiles p ON p.role_id=r.id AND p.tenant_id=r.tenant_id
  LEFT JOIN public.employees e ON e.profile_id=p.id
  UNION
  -- A secondary role has the same inheritance path as a primary role.
  SELECT r.id,r.tenant_id,e.profile_id,e.id
  FROM legacy_roles r
  JOIN public.employee_role_assignments a ON a.tenant_id=r.tenant_id AND a.role_key=r.key
  JOIN public.employees e ON e.id=a.employee_id
), eligible_roles AS MATERIALIZED (
  SELECT r.* FROM legacy_roles r
  WHERE NOT EXISTS (
    SELECT 1 FROM affected_people person
    JOIN public.employee_permission_overrides o ON o.employee_id=person.employee_id
    WHERE person.role_id=r.id AND o.allowed IS FALSE AND (
      lower(btrim(o.permission_key)) IN ('*','all','office','office.access','business','company','unternehmen','academy','akademie','training')
      OR lower(btrim(o.permission_key)) LIKE 'akademie.%'
      OR lower(btrim(o.permission_key)) LIKE 'academy.%'
      OR lower(btrim(o.permission_key)) LIKE 'training.%'
    )
    -- Include expired and future denials; conversion must not outlive them.
  )
  AND NOT EXISTS (
    SELECT 1 FROM affected_people person
    LEFT JOIN public.profiles p ON p.id=person.profile_id
    LEFT JOIN public.employees e ON e.id=person.employee_id
    WHERE person.role_id=r.id AND (
      p.id IS NULL OR p.tenant_id IS DISTINCT FROM r.tenant_id
      OR person.employee_id IS NOT NULL AND (
        e.tenant_id IS DISTINCT FROM r.tenant_id
        OR coalesce(e.status::text,'') NOT IN ('active','aktiv')
        OR e.deleted_at IS NOT NULL OR e.profile_id IS DISTINCT FROM person.profile_id
      )
      OR EXISTS (
        SELECT 1 FROM public.employees duplicate WHERE duplicate.profile_id=person.profile_id
          AND duplicate.id IS DISTINCT FROM person.employee_id
      )
    )
  )
  AND NOT EXISTS (
    SELECT 1 FROM affected_people person
    JOIN public.employee_data_scopes s ON s.employee_id=person.employee_id
    WHERE person.role_id=r.id AND (
      s.tenant_id IS DISTINCT FROM r.tenant_id OR s.scope_type IS DISTINCT FROM 'tenant'
      OR nullif(btrim(s.scope_value),'') IS NOT NULL AND btrim(s.scope_value)<>r.tenant_id::text
    )
  )
  AND NOT EXISTS (
    SELECT 1 FROM affected_people person
    JOIN public.company_scope_profiles s ON s.profile_id=person.profile_id
    WHERE person.role_id=r.id AND (s.scope_limited IS TRUE OR s.tenant_id IS DISTINCT FROM r.tenant_id)
  )
), translated_keys AS (
  SELECT r.id role_id,r.tenant_id,k.permission_key,k.write_access,k.approval_access
  FROM eligible_roles r
  CROSS JOIN LATERAL (VALUES
    ('akademie.access'::text,false,false,true),
    ('akademie.courses.view',false,false,true),
    ('akademie.courses.manage',true,false,r.can_create IS TRUE AND r.can_update IS TRUE),
    ('akademie.enrollments.assign',true,false,r.can_create IS TRUE AND r.can_update IS TRUE),
    ('akademie.enrollments.review',true,true,r.can_create IS TRUE AND r.can_update IS TRUE AND r.can_approve IS TRUE)
  ) k(permission_key,write_access,approval_access,allowed)
  WHERE k.allowed
)
INSERT INTO public.role_permissions (
  tenant_id,role_id,permission_key,product_key,
  can_view,can_create,can_update,can_delete,can_export,can_approve,restrictions
)
SELECT tenant_id,role_id,permission_key,'akademie',
  true,write_access,write_access,false,false,approval_access,'{}'::jsonb
FROM translated_keys
ON CONFLICT(role_id,permission_key) DO NOTHING;
COMMIT;
