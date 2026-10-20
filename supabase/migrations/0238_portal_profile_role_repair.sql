-- Repair portal profiles stuck on owner role (upsertPortalProfile omitted role_id).
-- Ensures bootstrap and RLS role resolution match JWT app_metadata.role_key.

UPDATE profiles p
SET
  role_id = r.id,
  updated_at = now()
FROM client_portal_access cpa
JOIN roles r ON r.key = 'client_portal'
WHERE p.auth_user_id = cpa.auth_user_id
  AND cpa.portal_enabled IS TRUE
  AND cpa.auth_user_id IS NOT NULL
  AND (p.role_id IS DISTINCT FROM r.id);

UPDATE profiles p
SET
  role_id = r.id,
  updated_at = now()
FROM employee_portal_accounts epa
JOIN roles r ON r.key = 'employee_portal'
WHERE p.auth_user_id = epa.auth_user_id
  AND epa.status NOT IN ('archived', 'blocked')
  AND epa.auth_user_id IS NOT NULL
  AND (p.role_id IS DISTINCT FROM r.id);

UPDATE profiles p
SET
  role_id = r.id,
  updated_at = now()
FROM relative_portal_codes rpc
JOIN roles r ON r.key = 'family_portal'
WHERE p.auth_user_id = rpc.auth_user_id
  AND rpc.auth_user_id IS NOT NULL
  AND (p.role_id IS DISTINCT FROM r.id);
