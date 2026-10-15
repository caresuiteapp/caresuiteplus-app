-- Reconcile legacy company owners whose completed sign-in was never reflected
-- in profiles.status. Keep company_profile's active-only authorization intact.
-- Invitations without verified sign-in evidence must remain invitations.
BEGIN;

UPDATE public.profiles AS p
SET status = 'active',
    activated_at = coalesce(p.activated_at, u.last_sign_in_at)
FROM auth.users AS u, public.roles AS r, public.tenants AS t
WHERE p.auth_user_id = u.id
  AND p.role_id = r.id
  AND p.tenant_id = t.id
  AND r.tenant_id = p.tenant_id
  AND r.key = 'owner'
  AND t.status::text IN ('active', 'trial')
  AND p.status::text = 'invited'
  AND p.is_active IS TRUE
  AND p.locked_at IS NULL
  AND u.email_confirmed_at IS NOT NULL
  AND u.last_sign_in_at IS NOT NULL
  -- An older login must not accept a later invitation or profile change.
  AND u.last_sign_in_at >= greatest(p.created_at, p.updated_at, u.email_confirmed_at)
  AND u.banned_until IS NULL
  AND u.deleted_at IS NULL
  AND u.is_anonymous IS FALSE
  AND coalesce(u.raw_app_meta_data->>'portal', '') = ''
  AND coalesce(u.raw_app_meta_data->>'portal_type', '') = ''
  AND lower(coalesce(u.raw_app_meta_data->>'role_key', ''))
      IN ('', 'owner', 'admin', 'business_admin')
  AND coalesce(nullif(u.raw_app_meta_data->>'tenant_id', ''), p.tenant_id::text) = p.tenant_id::text
  AND (SELECT count(*) FROM public.profiles AS linked
       WHERE linked.auth_user_id = u.id OR linked.id = u.id) = 1;

COMMIT;
