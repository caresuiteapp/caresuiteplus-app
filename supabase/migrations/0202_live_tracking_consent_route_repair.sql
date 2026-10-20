-- LT.GMAPS.4 — Consent loop + route context repair (additive).
-- Root cause: tracking RLS visit_id subquery missed assignments→assist_visits bridge rows.

CREATE OR REPLACE FUNCTION public.portal_employee_assigned_visit_ids(p_tenant_id UUID)
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT v.id
  FROM public.assist_visits v
  WHERE v.tenant_id = p_tenant_id
    AND v.employee_id = public.resolve_current_employee_id()
    AND v.planning_status <> 'draft'
  UNION
  SELECT v.id
  FROM public.assignments a
  JOIN public.assist_visits v
    ON v.tenant_id = a.tenant_id
    AND (v.legacy_assignment_id = a.id OR v.id = a.id)
  WHERE a.tenant_id = p_tenant_id
    AND a.employee_id = public.resolve_current_employee_id()
$$;

COMMENT ON FUNCTION public.portal_employee_assigned_visit_ids(UUID) IS
  'LT.GMAPS.4 — visit ids an employee portal user may write tracking/consent for.';

GRANT EXECUTE ON FUNCTION public.portal_employee_assigned_visit_ids(UUID) TO authenticated;

-- --------------------------------------------------------------------------
-- Tracking / location / time RLS: use unified visit scope
-- --------------------------------------------------------------------------
DROP POLICY IF EXISTS assist_tracking_sessions_portal_employee_all ON public.assist_tracking_sessions;
CREATE POLICY assist_tracking_sessions_portal_employee_all ON public.assist_tracking_sessions
  FOR ALL TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND public.current_role_key() = 'employee_portal'
    AND employee_id = public.resolve_current_employee_id()
  )
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND public.current_role_key() = 'employee_portal'
    AND employee_id = public.resolve_current_employee_id()
    AND visit_id IN (SELECT public.portal_employee_assigned_visit_ids(tenant_id))
  );

DROP POLICY IF EXISTS assist_location_points_portal_employee_insert ON public.assist_location_points;
CREATE POLICY assist_location_points_portal_employee_insert ON public.assist_location_points
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND public.current_role_key() = 'employee_portal'
    AND visit_id IN (SELECT public.portal_employee_assigned_visit_ids(tenant_id))
  );

DROP POLICY IF EXISTS assist_location_points_portal_employee_select ON public.assist_location_points;
CREATE POLICY assist_location_points_portal_employee_select ON public.assist_location_points
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND public.current_role_key() = 'employee_portal'
    AND visit_id IN (SELECT public.portal_employee_assigned_visit_ids(tenant_id))
  );

DROP POLICY IF EXISTS assist_time_events_portal_employee_insert ON public.assist_time_events;
CREATE POLICY assist_time_events_portal_employee_insert ON public.assist_time_events
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND public.current_role_key() = 'employee_portal'
    AND visit_id IN (SELECT public.portal_employee_assigned_visit_ids(tenant_id))
  );

DROP POLICY IF EXISTS assist_time_events_portal_employee_select ON public.assist_time_events;
CREATE POLICY assist_time_events_portal_employee_select ON public.assist_time_events
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND public.current_role_key() = 'employee_portal'
    AND visit_id IN (SELECT public.portal_employee_assigned_visit_ids(tenant_id))
  );

-- Allow portal employee to read consent on ended sessions (reload recognition)
DROP POLICY IF EXISTS assist_tracking_sessions_portal_employee_select ON public.assist_tracking_sessions;
CREATE POLICY assist_tracking_sessions_portal_employee_select ON public.assist_tracking_sessions
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND public.current_role_key() = 'employee_portal'
    AND visit_id IN (SELECT public.portal_employee_assigned_visit_ids(tenant_id))
  );
