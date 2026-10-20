-- CareSuite HealthOS R23
-- Employee portal: tenant-wide, read-only client records and team calendar.
-- The boundary remains the authenticated tenant; no write permissions are added.

DROP POLICY IF EXISTS clients_portal_employee_assignment_select ON public.clients;
DROP POLICY IF EXISTS clients_portal_employee_assigned_select ON public.clients;
DROP POLICY IF EXISTS clients_portal_employee_team_calendar_select ON public.clients;
DROP POLICY IF EXISTS clients_portal_employee_team_records_select ON public.clients;

CREATE POLICY clients_portal_employee_team_records_select ON public.clients
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND public.is_employee_portal_rls_context(tenant_id)
    AND COALESCE(status::text, '') <> 'deleted'
    AND deleted_at IS NULL
  );

DROP POLICY IF EXISTS client_addresses_portal_employee_select ON public.client_addresses;
DROP POLICY IF EXISTS client_addresses_portal_employee_team_records_select ON public.client_addresses;
CREATE POLICY client_addresses_portal_employee_team_records_select ON public.client_addresses
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND public.is_employee_portal_rls_context(tenant_id)
  );

DROP POLICY IF EXISTS client_contacts_portal_employee_emergency_select ON public.client_contacts;
DROP POLICY IF EXISTS client_contacts_portal_employee_team_records_select ON public.client_contacts;
CREATE POLICY client_contacts_portal_employee_team_records_select ON public.client_contacts
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND public.is_employee_portal_rls_context(tenant_id)
  );

DROP POLICY IF EXISTS assist_visits_portal_employee_team_select ON public.assist_visits;
CREATE POLICY assist_visits_portal_employee_team_select ON public.assist_visits
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND public.is_employee_portal_rls_context(tenant_id)
    AND employee_portal_visible = TRUE
    AND COALESCE(planning_status::text, '') <> 'draft'
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
    AND COALESCE(status::text, '') <> 'cancelled'
  );

GRANT SELECT ON public.clients TO authenticated;
GRANT SELECT ON public.client_addresses TO authenticated;
GRANT SELECT ON public.client_contacts TO authenticated;
GRANT SELECT ON public.assist_visits TO authenticated;
GRANT SELECT ON public.employees TO authenticated;
GRANT SELECT ON public.calendar_events TO authenticated;

COMMENT ON POLICY clients_portal_employee_team_records_select ON public.clients IS
  'R23: employee portal reads all non-deleted client records in its own tenant; read-only.';
COMMENT ON POLICY calendar_events_portal_employee_team_select ON public.calendar_events IS
  'R23: employee portal team calendar reads all portal-visible, non-archived tenant events.';
