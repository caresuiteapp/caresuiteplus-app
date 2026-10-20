-- CareSuite HealthOS R14-C — portal app security hardening.
-- Fail closed for disabled portal identities and keep credential material out of RLS reads.

CREATE OR REPLACE FUNCTION public.current_portal_account_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN COALESCE(auth.jwt()->'app_metadata'->>'portal_account_id', '') ~*
      '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    THEN (auth.jwt()->'app_metadata'->>'portal_account_id')::uuid
    ELSE NULL
  END
$$;

CREATE OR REPLACE FUNCTION public.current_portal_type()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NULLIF(auth.jwt()->'app_metadata'->>'portal_type', '')
$$;

GRANT EXECUTE ON FUNCTION public.current_portal_account_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_portal_type() TO authenticated;

CREATE OR REPLACE FUNCTION public.current_tenant_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE public.current_portal_type()
    WHEN 'employee' THEN (
      SELECT epa.tenant_id
      FROM public.employee_portal_accounts epa
      WHERE epa.id = public.current_portal_account_id()
        AND epa.auth_user_id = auth.uid()
        AND epa.status IN ('active', 'pending_first_login', 'password_reset_required')
      LIMIT 1
    )
    WHEN 'client' THEN COALESCE(
      (
        SELECT cpa.tenant_id
        FROM public.client_portal_access cpa
        WHERE cpa.id = public.current_portal_account_id()
          AND cpa.auth_user_id = auth.uid()
          AND cpa.portal_enabled = TRUE
          AND cpa.status = 'aktiv'
        LIMIT 1
      ),
      (
        SELECT cpc.tenant_id
        FROM public.client_portal_codes cpc
        WHERE cpc.id = public.current_portal_account_id()
          AND cpc.auth_user_id = auth.uid()
          AND cpc.status = 'active'
          AND (cpc.expires_at IS NULL OR cpc.expires_at > NOW())
        LIMIT 1
      )
    )
    WHEN 'relative' THEN (
      SELECT rpc.tenant_id
      FROM public.relative_portal_codes rpc
      WHERE rpc.id = public.current_portal_account_id()
        AND rpc.auth_user_id = auth.uid()
        AND rpc.status = 'active'
        AND (rpc.expires_at IS NULL OR rpc.expires_at > NOW())
      LIMIT 1
    )
    ELSE CASE
      WHEN public.current_portal_type() IS NULL OR public.current_portal_type() = 'business'
      THEN COALESCE(
        (
          SELECT p.tenant_id
          FROM public.profiles p
          WHERE p.id = auth.uid() OR p.auth_user_id = auth.uid()
          ORDER BY (p.id = auth.uid()) DESC
          LIMIT 1
        ),
        CASE
          WHEN COALESCE(auth.jwt()->'app_metadata'->>'tenant_id', '') ~*
            '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
          THEN (auth.jwt()->'app_metadata'->>'tenant_id')::uuid
          ELSE NULL
        END
      )
      ELSE NULL
    END
  END
$$;

CREATE OR REPLACE FUNCTION public.current_role_key()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE public.current_portal_type()
    WHEN 'employee' THEN CASE WHEN EXISTS (
      SELECT 1
      FROM public.employee_portal_accounts epa
      WHERE epa.id = public.current_portal_account_id()
        AND epa.auth_user_id = auth.uid()
        AND epa.status IN ('active', 'pending_first_login', 'password_reset_required')
    ) THEN 'employee_portal'::text ELSE NULL END
    WHEN 'client' THEN CASE WHEN EXISTS (
      SELECT 1
      FROM public.client_portal_access cpa
      WHERE cpa.id = public.current_portal_account_id()
        AND cpa.auth_user_id = auth.uid()
        AND cpa.portal_enabled = TRUE
        AND cpa.status = 'aktiv'
    ) OR EXISTS (
      SELECT 1
      FROM public.client_portal_codes cpc
      WHERE cpc.id = public.current_portal_account_id()
        AND cpc.auth_user_id = auth.uid()
        AND cpc.status = 'active'
        AND (cpc.expires_at IS NULL OR cpc.expires_at > NOW())
    ) THEN 'client_portal'::text ELSE NULL END
    WHEN 'relative' THEN CASE WHEN EXISTS (
      SELECT 1
      FROM public.relative_portal_codes rpc
      WHERE rpc.id = public.current_portal_account_id()
        AND rpc.auth_user_id = auth.uid()
        AND rpc.status = 'active'
        AND (rpc.expires_at IS NULL OR rpc.expires_at > NOW())
    ) THEN 'family_portal'::text ELSE NULL END
    ELSE CASE
      WHEN public.current_portal_type() IS NULL OR public.current_portal_type() = 'business'
      THEN COALESCE(
        (
          SELECT r.key
          FROM public.profiles p
          JOIN public.roles r ON r.id = p.role_id
          WHERE p.id = auth.uid() OR p.auth_user_id = auth.uid()
          ORDER BY (p.id = auth.uid()) DESC
          LIMIT 1
        ),
        NULLIF(auth.jwt()->'app_metadata'->>'role_key', '')
      )
      ELSE NULL
    END
  END
$$;

CREATE OR REPLACE FUNCTION public.current_employee_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN public.current_portal_type() = 'employee' THEN (
      SELECT epa.employee_id
      FROM public.employee_portal_accounts epa
      WHERE epa.id = public.current_portal_account_id()
        AND epa.auth_user_id = auth.uid()
        AND epa.status IN ('active', 'pending_first_login', 'password_reset_required')
      LIMIT 1
    )
    WHEN public.current_portal_type() IS NOT NULL THEN NULL
    ELSE (
      SELECT epa.employee_id
      FROM public.employee_portal_accounts epa
      WHERE epa.auth_user_id = auth.uid()
        AND epa.tenant_id = public.current_tenant_id()
        AND epa.status IN ('active', 'pending_first_login', 'password_reset_required')
      ORDER BY epa.updated_at DESC NULLS LAST
      LIMIT 1
    )
  END
$$;

CREATE OR REPLACE FUNCTION public.resolve_current_employee_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN public.current_portal_type() IS NOT NULL THEN public.current_employee_id()
    ELSE COALESCE(public.current_employee_id(), public.current_employee_id_from_profile())
  END
$$;

CREATE OR REPLACE FUNCTION public.current_client_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE public.current_portal_type()
    WHEN 'client' THEN COALESCE(
      (
        SELECT cpa.client_id
        FROM public.client_portal_access cpa
        WHERE cpa.id = public.current_portal_account_id()
          AND cpa.auth_user_id = auth.uid()
          AND cpa.portal_enabled = TRUE
          AND cpa.status = 'aktiv'
        LIMIT 1
      ),
      (
        SELECT cpc.client_id
        FROM public.client_portal_codes cpc
        WHERE cpc.id = public.current_portal_account_id()
          AND cpc.auth_user_id = auth.uid()
          AND cpc.status = 'active'
          AND (cpc.expires_at IS NULL OR cpc.expires_at > NOW())
        LIMIT 1
      )
    )
    WHEN 'relative' THEN (
      SELECT rpc.client_id
      FROM public.relative_portal_codes rpc
      WHERE rpc.id = public.current_portal_account_id()
        AND rpc.auth_user_id = auth.uid()
        AND rpc.status = 'active'
        AND (rpc.expires_at IS NULL OR rpc.expires_at > NOW())
      LIMIT 1
    )
    WHEN 'employee' THEN NULL
    ELSE COALESCE(
      (
        SELECT cpa.client_id
        FROM public.client_portal_access cpa
        WHERE cpa.auth_user_id = auth.uid()
          AND cpa.tenant_id = public.current_tenant_id()
          AND cpa.portal_enabled = TRUE
          AND cpa.status = 'aktiv'
        LIMIT 1
      ),
      (
        SELECT cpc.client_id
        FROM public.client_portal_codes cpc
        WHERE cpc.auth_user_id = auth.uid()
          AND cpc.tenant_id = public.current_tenant_id()
          AND cpc.status = 'active'
          AND (cpc.expires_at IS NULL OR cpc.expires_at > NOW())
        LIMIT 1
      ),
      (
        SELECT rpc.client_id
        FROM public.relative_portal_codes rpc
        WHERE rpc.auth_user_id = auth.uid()
          AND rpc.tenant_id = public.current_tenant_id()
          AND rpc.status = 'active'
          AND (rpc.expires_at IS NULL OR rpc.expires_at > NOW())
        LIMIT 1
      )
    )
  END
$$;

CREATE OR REPLACE FUNCTION public.is_active_employee_portal_actor(p_tenant_id UUID DEFAULT NULL)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.current_portal_type() = 'employee'
    AND public.current_employee_id() IS NOT NULL
    AND public.current_tenant_id() = COALESCE(p_tenant_id, public.current_tenant_id())
$$;

CREATE OR REPLACE FUNCTION public.is_employee_portal_rls_context(p_tenant_id UUID DEFAULT NULL)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.current_role_key() = 'employee_portal'
    AND public.is_active_employee_portal_actor(p_tenant_id)
$$;

CREATE OR REPLACE FUNCTION public.is_client_portal_rls_context(p_tenant_id UUID DEFAULT NULL)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.current_role_key() IN ('client_portal', 'family_portal')
    AND public.current_client_id() IS NOT NULL
    AND public.current_tenant_id() = COALESCE(p_tenant_id, public.current_tenant_id())
$$;

GRANT EXECUTE ON FUNCTION public.current_tenant_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_role_key() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_employee_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_current_employee_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_client_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_active_employee_portal_actor(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_employee_portal_rls_context(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_client_portal_rls_context(UUID) TO authenticated;

-- Bearer-equivalent session hashes are service-only. Authenticated tenant users
-- must never be able to enumerate another portal user's session record.
DROP POLICY IF EXISTS portal_sessions_select_own_tenant ON public.portal_sessions;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.portal_sessions FROM authenticated, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.portal_sessions TO service_role;

COMMENT ON COLUMN public.portal_sessions.session_token IS
  'R14-C: SHA-256 digest of the opaque portal session token for all newly issued sessions; never expose through RLS.';

-- Keep the client access hash out of self/office SELECT while preserving the
-- fields required by management and portal profile screens.
REVOKE SELECT ON public.client_portal_access FROM authenticated, anon;
GRANT SELECT (
  id, tenant_id, client_id, contact_id, email, status, last_login_at, invited_at,
  modules_enabled, two_factor_enabled, created_at, updated_at, portal_username,
  portal_enabled, code_created_at, code_rotated_at, auth_user_id
) ON public.client_portal_access TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_portal_access TO service_role;

COMMENT ON COLUMN public.client_portal_access.portal_access_code_hash IS
  'R14-C: PBKDF2-SHA256 credential hash with per-record random salt; legacy SHA-256 is upgraded after successful login.';
COMMENT ON COLUMN public.employee_portal_accounts.temporary_password_hash IS
  'R14-C: PBKDF2-SHA256 credential hash with per-record random salt; legacy SHA-256 is upgraded after successful login.';
