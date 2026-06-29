-- ASSIST.PERMISSIONS.2b — Dual-role portal RLS repair (owner + employee_portal same auth user).
-- Root cause: current_role_key() returned office profile role (e.g. owner) before portal JWT /
-- employee_portal_accounts fallback, blocking consent bundle + portal-scoped writes.

-- --------------------------------------------------------------------------
-- Helpers — active portal actor even when profiles.role = owner/admin
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_active_employee_portal_actor(p_tenant_id UUID DEFAULT NULL)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.employee_portal_accounts epa
    WHERE epa.auth_user_id = auth.uid()
      AND epa.tenant_id = COALESCE(p_tenant_id, public.current_tenant_id())
      AND epa.status IN ('active', 'pending_first_login')
  );
$$;

COMMENT ON FUNCTION public.is_active_employee_portal_actor(UUID) IS
  'ASSIST.PERMISSIONS.2b — true when auth user has an active employee portal account for tenant.';

GRANT EXECUTE ON FUNCTION public.is_active_employee_portal_actor(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.is_employee_portal_rls_context(p_tenant_id UUID DEFAULT NULL)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.current_role_key() = 'employee_portal'
    OR (
      public.is_active_employee_portal_actor(p_tenant_id)
      AND public.resolve_current_employee_id() IS NOT NULL
    );
$$;

COMMENT ON FUNCTION public.is_employee_portal_rls_context(UUID) IS
  'ASSIST.PERMISSIONS.2b — portal employee RLS context (JWT role or linked portal account).';

GRANT EXECUTE ON FUNCTION public.is_employee_portal_rls_context(UUID) TO authenticated;

-- JWT portal role must win over office profile role (same auth user, dual login).
CREATE OR REPLACE FUNCTION public.current_role_key()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    NULLIF(auth.jwt()->'app_metadata'->>'role_key', ''),
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
    )
  )
$$;

COMMENT ON FUNCTION public.current_role_key() IS
  'ASSIST.PERMISSIONS.2b — JWT app_metadata role_key first, then profile, portal account fallbacks.';

-- --------------------------------------------------------------------------
-- Consent + permission onboarding (0205–0207)
-- --------------------------------------------------------------------------
DROP POLICY IF EXISTS employee_location_consents_portal_employee_all ON public.employee_location_consents;
CREATE POLICY employee_location_consents_portal_employee_all ON public.employee_location_consents
  FOR ALL TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND public.is_employee_portal_rls_context(tenant_id)
    AND employee_id = public.resolve_current_employee_id()
  )
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND public.is_employee_portal_rls_context(tenant_id)
    AND employee_id = public.resolve_current_employee_id()
  );

DROP POLICY IF EXISTS employee_consent_bundle_portal_employee_all ON public.employee_consent_bundle;
CREATE POLICY employee_consent_bundle_portal_employee_all ON public.employee_consent_bundle
  FOR ALL TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND public.is_employee_portal_rls_context(tenant_id)
    AND employee_id = public.resolve_current_employee_id()
  )
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND public.is_employee_portal_rls_context(tenant_id)
    AND employee_id = public.resolve_current_employee_id()
  );

DROP POLICY IF EXISTS employee_permission_states_portal_employee_all ON public.employee_permission_states;
CREATE POLICY employee_permission_states_portal_employee_all ON public.employee_permission_states
  FOR ALL TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND public.is_employee_portal_rls_context(tenant_id)
    AND employee_id = public.resolve_current_employee_id()
  )
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND public.is_employee_portal_rls_context(tenant_id)
    AND employee_id = public.resolve_current_employee_id()
  );

-- --------------------------------------------------------------------------
-- Visit execution state (markArrived upsert)
-- --------------------------------------------------------------------------
DROP POLICY IF EXISTS assist_visit_execution_state_portal_employee ON public.assist_visit_execution_state;
CREATE POLICY assist_visit_execution_state_portal_employee ON public.assist_visit_execution_state
  FOR ALL TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND public.is_employee_portal_rls_context(tenant_id)
    AND visit_id IN (SELECT public.portal_employee_assigned_visit_ids(tenant_id))
  )
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND public.is_employee_portal_rls_context(tenant_id)
    AND visit_id IN (SELECT public.portal_employee_assigned_visit_ids(tenant_id))
  );

-- --------------------------------------------------------------------------
-- Tracking / time events (0202)
-- --------------------------------------------------------------------------
DROP POLICY IF EXISTS assist_tracking_sessions_portal_employee_all ON public.assist_tracking_sessions;
CREATE POLICY assist_tracking_sessions_portal_employee_all ON public.assist_tracking_sessions
  FOR ALL TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND public.is_employee_portal_rls_context(tenant_id)
    AND employee_id = public.resolve_current_employee_id()
  )
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND public.is_employee_portal_rls_context(tenant_id)
    AND employee_id = public.resolve_current_employee_id()
    AND visit_id IN (SELECT public.portal_employee_assigned_visit_ids(tenant_id))
  );

DROP POLICY IF EXISTS assist_tracking_sessions_portal_employee_select ON public.assist_tracking_sessions;
CREATE POLICY assist_tracking_sessions_portal_employee_select ON public.assist_tracking_sessions
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND public.is_employee_portal_rls_context(tenant_id)
    AND visit_id IN (SELECT public.portal_employee_assigned_visit_ids(tenant_id))
  );

DROP POLICY IF EXISTS assist_time_events_portal_employee_insert ON public.assist_time_events;
CREATE POLICY assist_time_events_portal_employee_insert ON public.assist_time_events
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND public.is_employee_portal_rls_context(tenant_id)
    AND visit_id IN (SELECT public.portal_employee_assigned_visit_ids(tenant_id))
  );

DROP POLICY IF EXISTS assist_time_events_portal_employee_select ON public.assist_time_events;
CREATE POLICY assist_time_events_portal_employee_select ON public.assist_time_events
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND public.is_employee_portal_rls_context(tenant_id)
    AND visit_id IN (SELECT public.portal_employee_assigned_visit_ids(tenant_id))
  );

-- --------------------------------------------------------------------------
-- Assignments / visits portal scope (0189)
-- --------------------------------------------------------------------------
DROP POLICY IF EXISTS employees_portal_self_select ON public.employees;
CREATE POLICY employees_portal_self_select ON public.employees
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND id = public.resolve_current_employee_id()
    AND public.is_employee_portal_rls_context(tenant_id)
  );

DROP POLICY IF EXISTS assignments_portal_employee_select ON public.assignments;
CREATE POLICY assignments_portal_employee_select ON public.assignments
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND employee_id = public.resolve_current_employee_id()
    AND public.is_employee_portal_rls_context(tenant_id)
  );

DROP POLICY IF EXISTS assignments_portal_employee_update ON public.assignments;
CREATE POLICY assignments_portal_employee_update ON public.assignments
  FOR UPDATE TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND employee_id = public.resolve_current_employee_id()
    AND public.is_employee_portal_rls_context(tenant_id)
  )
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND employee_id = public.resolve_current_employee_id()
  );

DROP POLICY IF EXISTS assist_visits_portal_employee_select ON public.assist_visits;
CREATE POLICY assist_visits_portal_employee_select ON public.assist_visits
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND public.is_employee_portal_rls_context(tenant_id)
    AND employee_id = public.resolve_current_employee_id()
    AND planning_status <> 'draft'
  );
