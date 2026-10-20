-- P0 portal identity / tenant-context repair.
-- Safe properties:
--   * never changes clients, employees, assignments, visits, documents or signatures
--   * repairs profiles only when an auth user has one unambiguous portal tenant
--   * all helper functions validate auth.uid() against the linked portal account

-- ---------------------------------------------------------------------------
-- Repair stale/missing profile tenant context from unambiguous portal links.
-- ---------------------------------------------------------------------------
WITH portal_links AS (
  SELECT auth_user_id, tenant_id
  FROM public.client_portal_access
  WHERE auth_user_id IS NOT NULL
    AND portal_enabled = TRUE
  UNION ALL
  SELECT auth_user_id, tenant_id
  FROM public.employee_portal_accounts
  WHERE auth_user_id IS NOT NULL
    AND status IN ('active', 'pending_first_login', 'password_reset_required')
),
unambiguous AS (
  SELECT auth_user_id, MIN(tenant_id::text)::uuid AS tenant_id
  FROM portal_links
  GROUP BY auth_user_id
  HAVING COUNT(DISTINCT tenant_id) = 1
)
UPDATE public.profiles p
SET tenant_id = u.tenant_id, updated_at = NOW()
FROM unambiguous u
WHERE (p.id = u.auth_user_id OR p.auth_user_id = u.auth_user_id)
  AND p.tenant_id IS DISTINCT FROM u.tenant_id;

-- ---------------------------------------------------------------------------
-- Tenant resolution: a validated portal_account_id wins over a stale profile.
-- The auth-user predicates prevent a caller from selecting another account.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.current_tenant_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      SELECT epa.tenant_id
      FROM public.employee_portal_accounts epa
      WHERE epa.id = CASE
        WHEN COALESCE(auth.jwt()->'app_metadata'->>'portal_account_id', '') ~*
          '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        THEN (auth.jwt()->'app_metadata'->>'portal_account_id')::uuid
        ELSE NULL
      END
        AND epa.auth_user_id = auth.uid()
        AND epa.status IN ('active', 'pending_first_login', 'password_reset_required')
      LIMIT 1
    ),
    (
      SELECT cpa.tenant_id
      FROM public.client_portal_access cpa
      WHERE cpa.id = CASE
        WHEN COALESCE(auth.jwt()->'app_metadata'->>'portal_account_id', '') ~*
          '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        THEN (auth.jwt()->'app_metadata'->>'portal_account_id')::uuid
        ELSE NULL
      END
        AND cpa.auth_user_id = auth.uid()
        AND cpa.portal_enabled = TRUE
      LIMIT 1
    ),
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
$$;

GRANT EXECUTE ON FUNCTION public.current_tenant_id() TO authenticated;

-- ---------------------------------------------------------------------------
-- Portal actor resolution without circular RLS dependencies.
-- ---------------------------------------------------------------------------
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
      WHERE cpa.id = CASE
        WHEN COALESCE(auth.jwt()->'app_metadata'->>'portal_account_id', '') ~*
          '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        THEN (auth.jwt()->'app_metadata'->>'portal_account_id')::uuid
        ELSE NULL
      END
        AND cpa.auth_user_id = auth.uid()
        AND cpa.portal_enabled = TRUE
      LIMIT 1
    ),
    (
      SELECT cpa.client_id
      FROM public.client_portal_access cpa
      WHERE cpa.auth_user_id = auth.uid()
        AND cpa.tenant_id = public.current_tenant_id()
        AND cpa.portal_enabled = TRUE
      ORDER BY cpa.updated_at DESC NULLS LAST
      LIMIT 1
    )
  )
$$;

CREATE OR REPLACE FUNCTION public.current_employee_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      SELECT epa.employee_id
      FROM public.employee_portal_accounts epa
      WHERE epa.id = CASE
        WHEN COALESCE(auth.jwt()->'app_metadata'->>'portal_account_id', '') ~*
          '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        THEN (auth.jwt()->'app_metadata'->>'portal_account_id')::uuid
        ELSE NULL
      END
        AND epa.auth_user_id = auth.uid()
        AND epa.status IN ('active', 'pending_first_login', 'password_reset_required')
      LIMIT 1
    ),
    (
      SELECT epa.employee_id
      FROM public.employee_portal_accounts epa
      WHERE epa.auth_user_id = auth.uid()
        AND epa.tenant_id = public.current_tenant_id()
        AND epa.status IN ('active', 'pending_first_login', 'password_reset_required')
      ORDER BY epa.updated_at DESC NULLS LAST
      LIMIT 1
    )
  )
$$;

-- Keep the office-profile fallback self-contained. Some production databases
-- were created before migration 0092 was tracked in the migration history.
CREATE OR REPLACE FUNCTION public.current_employee_id_from_profile()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT e.id
  FROM public.employees e
  INNER JOIN public.profiles p ON p.id = e.profile_id
  WHERE (p.id = auth.uid() OR p.auth_user_id = auth.uid())
    AND e.tenant_id = public.current_tenant_id()
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.resolve_current_employee_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(public.current_employee_id(), public.current_employee_id_from_profile())
$$;

GRANT EXECUTE ON FUNCTION public.current_client_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_employee_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_employee_id_from_profile() TO authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_current_employee_id() TO authenticated;

-- ---------------------------------------------------------------------------
-- Bootstrap access to the caller's own link rows.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS client_portal_access_portal_self_select ON public.client_portal_access;
CREATE POLICY client_portal_access_portal_self_select ON public.client_portal_access
  FOR SELECT TO authenticated
  USING (auth_user_id = auth.uid() AND portal_enabled = TRUE);

DROP POLICY IF EXISTS employee_portal_accounts_self_select ON public.employee_portal_accounts;
CREATE POLICY employee_portal_accounts_self_select ON public.employee_portal_accounts
  FOR SELECT TO authenticated
  USING (
    auth_user_id = auth.uid()
    AND status IN ('active', 'pending_first_login', 'password_reset_required')
  );

-- ---------------------------------------------------------------------------
-- Core employee-portal reads used by dashboard, assignments and work time.
-- Existing office policies remain in place.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS employees_portal_self_select ON public.employees;
CREATE POLICY employees_portal_self_select ON public.employees
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND id = public.resolve_current_employee_id()
  );

DROP POLICY IF EXISTS assignments_portal_employee_select ON public.assignments;
CREATE POLICY assignments_portal_employee_select ON public.assignments
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND employee_id = public.resolve_current_employee_id()
  );

DROP POLICY IF EXISTS assist_visits_portal_employee_select ON public.assist_visits;
CREATE POLICY assist_visits_portal_employee_select ON public.assist_visits
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND employee_id = public.resolve_current_employee_id()
    AND planning_status <> 'draft'
  );

-- Client profile and own records.
DROP POLICY IF EXISTS clients_portal_self_select ON public.clients;
CREATE POLICY clients_portal_self_select ON public.clients
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND id = public.current_client_id()
    AND public.current_client_id() IS NOT NULL
  );

COMMENT ON FUNCTION public.current_tenant_id() IS
  'P0 2026-07-30: validated portal-account tenant first, profile/JWT fallbacks.';
COMMENT ON FUNCTION public.current_client_id() IS
  'P0 2026-07-30: non-circular client portal actor resolution.';
COMMENT ON FUNCTION public.current_employee_id() IS
  'P0 2026-07-30: non-circular employee portal actor resolution.';

-- ---------------------------------------------------------------------------
-- Internal client master-data writes.
-- Production role matrices are not uniform across older tenants, therefore
-- accept either the explicit permission or an established management role.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.can_manage_clients_for_current_tenant()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    JOIN public.roles r ON r.id = p.role_id
    LEFT JOIN public.role_permissions rp
      ON rp.role_id = p.role_id
     AND rp.permission_key IN ('office.clients.edit', 'clients')
    WHERE (p.id = auth.uid() OR p.auth_user_id = auth.uid())
      AND p.tenant_id = public.current_tenant_id()
      AND (
        r.key IN (
          'owner', 'admin', 'management', 'geschaeftsfuehrung',
          'business_admin', 'business_manager'
        )
        OR rp.permission_key = 'office.clients.edit'
        OR (
          rp.permission_key = 'clients'
          AND COALESCE(rp.can_update, FALSE)
        )
      )
  )
$$;

GRANT EXECUTE ON FUNCTION public.can_manage_clients_for_current_tenant() TO authenticated;

DROP POLICY IF EXISTS "clients_update_tenant" ON public.clients;
CREATE POLICY "clients_update_tenant" ON public.clients
  FOR UPDATE TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND public.can_manage_clients_for_current_tenant()
  )
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND public.can_manage_clients_for_current_tenant()
  );

GRANT SELECT, INSERT, UPDATE ON public.clients TO authenticated;

DO $$
DECLARE
  table_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'client_care_contexts',
    'client_support_preferences',
    'client_addresses',
    'client_care_levels',
    'client_billing_profiles',
    'client_insurance_profiles',
    'client_contacts',
    'client_ambulatory_details',
    'client_stationary_details',
    'client_cost_carrier_assignments',
    'client_contract_selection',
    'client_consent_status'
  ]
  LOOP
    IF to_regclass('public.' || table_name) IS NOT NULL THEN
      EXECUTE format(
        'DROP POLICY IF EXISTS p0_office_client_write ON public.%I',
        table_name
      );
      EXECUTE format(
        'CREATE POLICY p0_office_client_write ON public.%I
           FOR ALL TO authenticated
           USING (
             tenant_id = public.current_tenant_id()
             AND public.can_manage_clients_for_current_tenant()
           )
           WITH CHECK (
             tenant_id = public.current_tenant_id()
             AND public.can_manage_clients_for_current_tenant()
           )',
        table_name
      );
      EXECUTE format(
        'GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated',
        table_name
      );
    END IF;
  END LOOP;
END $$;
