-- LT.GMAPS.3 — Production DB repair (additive).
-- Root cause: current_role_key() returned NULL for employee/client portal JWTs because
-- portal profiles lack role_id and roles table has no employee_portal row.

CREATE OR REPLACE FUNCTION public.current_role_key()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      SELECT r.key
      FROM public.profiles p
      JOIN public.roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() OR p.auth_user_id = auth.uid()
      LIMIT 1
    ),
    (
      SELECT 'employee_portal'::text
      FROM public.employee_portal_accounts epa
      WHERE epa.auth_user_id = auth.uid()
        AND epa.tenant_id = public.current_tenant_id()
        AND epa.status IN ('active', 'pending_first_login')
      LIMIT 1
    ),
    (
      SELECT 'client_portal'::text
      FROM public.client_portal_access cpa
      WHERE cpa.auth_user_id = auth.uid()
        AND cpa.tenant_id = public.current_tenant_id()
        AND cpa.portal_enabled = TRUE
      LIMIT 1
    ),
    (
      SELECT 'client_portal'::text
      FROM public.client_portal_codes cpc
      WHERE cpc.auth_user_id = auth.uid()
        AND cpc.tenant_id = public.current_tenant_id()
      LIMIT 1
    ),
    NULLIF(auth.jwt()->'app_metadata'->>'role_key', '')
  )
$$;

COMMENT ON FUNCTION public.current_role_key() IS
  'LT.GMAPS.3 — role from profile/roles, portal account linkage, or JWT app_metadata.';

-- Idempotent profile/auth linkage for employee portal accounts
UPDATE public.profiles p
SET
  auth_user_id = epa.auth_user_id,
  updated_at = NOW()
FROM public.employee_portal_accounts epa
WHERE epa.auth_user_id IS NOT NULL
  AND p.id = epa.auth_user_id
  AND (p.auth_user_id IS DISTINCT FROM epa.auth_user_id);

CREATE INDEX IF NOT EXISTS idx_client_contacts_tenant_client_emergency
  ON public.client_contacts (tenant_id, client_id)
  WHERE is_emergency_contact = TRUE;
