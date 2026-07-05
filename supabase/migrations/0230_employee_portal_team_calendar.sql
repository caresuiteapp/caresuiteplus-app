-- Employee portal team calendar + colleague visibility (read-only).
-- Enables Mitarbeiterportal Kalender to show all employee_portal_visible visits.

DROP POLICY IF EXISTS assist_visits_portal_employee_team_select ON public.assist_visits;
CREATE POLICY assist_visits_portal_employee_team_select ON public.assist_visits
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND public.is_employee_portal_rls_context(tenant_id)
    AND employee_portal_visible = TRUE
    AND planning_status <> 'draft'
  );

DROP POLICY IF EXISTS employees_portal_team_select ON public.employees;
CREATE POLICY employees_portal_team_select ON public.employees
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND public.is_employee_portal_rls_context(tenant_id)
  );

DROP POLICY IF EXISTS calendar_events_portal_employee_team_select ON public.calendar_events;
CREATE POLICY calendar_events_portal_employee_team_select ON public.calendar_events
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND public.is_employee_portal_rls_context(tenant_id)
    AND is_employee_portal_visible = TRUE
    AND archived_at IS NULL
  );

DROP POLICY IF EXISTS clients_portal_employee_team_calendar_select ON public.clients;
CREATE POLICY clients_portal_employee_team_calendar_select ON public.clients
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND public.is_employee_portal_rls_context(tenant_id)
    AND id IN (
      SELECT v.client_id
      FROM public.assist_visits v
      WHERE v.tenant_id = public.current_tenant_id()
        AND v.employee_portal_visible = TRUE
        AND v.planning_status <> 'draft'
    )
  );

COMMENT ON POLICY assist_visits_portal_employee_team_select ON public.assist_visits IS
  'Employee portal team calendar — read all portal-visible colleague visits in tenant.';

COMMENT ON POLICY employees_portal_team_select ON public.employees IS
  'Employee portal — read colleague names for team calendar labels.';

COMMENT ON POLICY calendar_events_portal_employee_team_select ON public.calendar_events IS
  'Employee portal team calendar — read all portal-visible calendar events in tenant.';

COMMENT ON POLICY clients_portal_employee_team_calendar_select ON public.clients IS
  'Employee portal team calendar — read client names on visible team visits.';
