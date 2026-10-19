-- CP253 / W-03: Employee portal client records are own-assignment scoped.
-- Prepared only. Apply and verify exclusively in an isolated Supabase test project.

DROP POLICY IF EXISTS clients_portal_employee_team_records_select ON public.clients;
DROP POLICY IF EXISTS clients_portal_employee_team_calendar_select ON public.clients;
DROP POLICY IF EXISTS clients_portal_employee_assigned_select ON public.clients;
DROP POLICY IF EXISTS clients_portal_employee_assignment_select ON public.clients;
CREATE POLICY clients_portal_employee_assignment_select ON public.clients
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND public.is_employee_portal_rls_context(tenant_id)
    AND status = 'active'
    AND deleted_at IS NULL
    AND id IN (
      SELECT visit.client_id
      FROM public.assist_visits AS visit
      WHERE visit.tenant_id = public.current_tenant_id()
        AND visit.employee_id = public.resolve_current_employee_id()
        AND visit.employee_portal_visible = TRUE
        AND visit.planning_status <> 'draft'
    )
  );

DROP POLICY IF EXISTS client_addresses_portal_employee_team_records_select ON public.client_addresses;
DROP POLICY IF EXISTS client_addresses_portal_employee_select ON public.client_addresses;
CREATE POLICY client_addresses_portal_employee_select ON public.client_addresses
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND public.is_employee_portal_rls_context(tenant_id)
    AND client_id IN (
      SELECT visit.client_id
      FROM public.assist_visits AS visit
      WHERE visit.tenant_id = public.current_tenant_id()
        AND visit.employee_id = public.resolve_current_employee_id()
        AND visit.employee_portal_visible = TRUE
        AND visit.planning_status <> 'draft'
    )
  );

DROP POLICY IF EXISTS client_contacts_portal_employee_team_records_select ON public.client_contacts;
DROP POLICY IF EXISTS client_contacts_portal_employee_emergency_select ON public.client_contacts;
DROP POLICY IF EXISTS client_contacts_portal_employee_select ON public.client_contacts;
CREATE POLICY client_contacts_portal_employee_select ON public.client_contacts
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND public.is_employee_portal_rls_context(tenant_id)
    AND (is_primary_contact = TRUE OR is_emergency_contact = TRUE)
    AND client_id IN (
      SELECT visit.client_id
      FROM public.assist_visits AS visit
      WHERE visit.tenant_id = public.current_tenant_id()
        AND visit.employee_id = public.resolve_current_employee_id()
        AND visit.employee_portal_visible = TRUE
        AND visit.planning_status <> 'draft'
    )
  );

DROP POLICY IF EXISTS assist_visits_portal_employee_team_select ON public.assist_visits;
DROP POLICY IF EXISTS assist_visits_portal_employee_select ON public.assist_visits;
CREATE POLICY assist_visits_portal_employee_select ON public.assist_visits
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND public.is_employee_portal_rls_context(tenant_id)
    AND employee_id = public.resolve_current_employee_id()
    AND employee_portal_visible = TRUE
    AND planning_status <> 'draft'
  );

DROP POLICY IF EXISTS client_documents_portal_employee_select ON public.client_documents;
CREATE POLICY client_documents_portal_employee_select ON public.client_documents
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND public.is_employee_portal_rls_context(tenant_id)
    AND portal_visible = TRUE
    AND status IN ('aktiv', 'abgeschlossen', 'bestaetigt')
    AND sensitivity NOT IN ('internal', 'restricted')
    AND client_id IN (
      SELECT visit.client_id
      FROM public.assist_visits AS visit
      WHERE visit.tenant_id = public.current_tenant_id()
        AND visit.employee_id = public.resolve_current_employee_id()
        AND visit.employee_portal_visible = TRUE
        AND visit.planning_status <> 'draft'
    )
  );

DROP POLICY IF EXISTS client_intake_documents_portal_employee_select ON public.client_intake_documents;
CREATE POLICY client_intake_documents_portal_employee_select ON public.client_intake_documents
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND public.is_employee_portal_rls_context(tenant_id)
    AND client_id IN (
      SELECT visit.client_id
      FROM public.assist_visits AS visit
      WHERE visit.tenant_id = public.current_tenant_id()
        AND visit.employee_id = public.resolve_current_employee_id()
        AND visit.employee_portal_visible = TRUE
        AND visit.planning_status <> 'draft'
    )
  );

COMMENT ON POLICY clients_portal_employee_assignment_select ON public.clients IS
  'CP253: employee portal reads active client records only through its own visible non-draft visit assignments.';
COMMENT ON POLICY client_addresses_portal_employee_select ON public.client_addresses IS
  'CP253: employee portal reads address details only for its own assigned clients.';
COMMENT ON POLICY client_contacts_portal_employee_select ON public.client_contacts IS
  'CP253: employee portal reads only primary or emergency contacts for its own assigned clients.';
COMMENT ON POLICY assist_visits_portal_employee_select ON public.assist_visits IS
  'CP253: employee portal reads only its own visible non-draft visits.';
COMMENT ON POLICY client_documents_portal_employee_select ON public.client_documents IS
  'CP253: employee portal reads released non-sensitive documents only for its own assigned clients.';
COMMENT ON POLICY client_intake_documents_portal_employee_select ON public.client_intake_documents IS
  'CP253: employee portal reads intake previews only for its own assigned clients.';
