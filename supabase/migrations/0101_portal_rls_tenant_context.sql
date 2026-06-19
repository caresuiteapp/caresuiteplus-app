-- Portal RLS: resolve tenant/client context when profile.tenant_id is missing (live portal users).
-- Root cause: portal auth profile upsert used legacy columns; profiles kept tenant_id NULL,
-- so current_tenant_id() returned NULL and client_module_assignments_portal_select blocked reads.

CREATE OR REPLACE FUNCTION public.current_tenant_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      SELECT p.tenant_id
      FROM public.profiles p
      WHERE p.id = auth.uid() OR p.auth_user_id = auth.uid()
      LIMIT 1
    ),
    NULLIF(auth.jwt()->'app_metadata'->>'tenant_id', '')::uuid
  )
$$;

CREATE OR REPLACE FUNCTION public.current_client_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      SELECT cpa.client_id
      FROM public.client_portal_access cpa
      WHERE cpa.auth_user_id = auth.uid()
        AND cpa.tenant_id = public.current_tenant_id()
      LIMIT 1
    ),
    (
      SELECT cpc.client_id
      FROM public.client_portal_codes cpc
      WHERE cpc.auth_user_id = auth.uid()
        AND cpc.tenant_id = public.current_tenant_id()
      LIMIT 1
    ),
    (
      SELECT rpc.client_id
      FROM public.relative_portal_codes rpc
      WHERE rpc.auth_user_id = auth.uid()
        AND rpc.tenant_id = public.current_tenant_id()
      LIMIT 1
    )
  )
$$;

-- Backfill portal profiles from linked client records (fixes greeting + tenant context).
UPDATE public.profiles p
SET
  tenant_id = cpa.tenant_id,
  first_name = c.first_name,
  last_name = c.last_name,
  updated_at = NOW()
FROM public.client_portal_access cpa
JOIN public.clients c ON c.id = cpa.client_id AND c.tenant_id = cpa.tenant_id
WHERE p.auth_user_id = cpa.auth_user_id
  AND cpa.auth_user_id IS NOT NULL
  AND cpa.portal_enabled = TRUE
  AND (
    p.tenant_id IS NULL
    OR lower(trim(coalesce(p.first_name, ''))) = lower(cpa.portal_username)
    OR lower(trim(coalesce(p.last_name, ''))) = lower(cpa.portal_username)
  );
