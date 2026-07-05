-- Employee portal Klientenakten — dual-role RLS repair + client_addresses read scope.

DROP POLICY IF EXISTS clients_portal_employee_assignment_select ON public.clients;
CREATE POLICY clients_portal_employee_assignment_select ON public.clients
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND public.is_employee_portal_rls_context(tenant_id)
    AND id IN (
      SELECT v.client_id
      FROM public.assist_visits v
      WHERE v.tenant_id = public.current_tenant_id()
        AND v.employee_id = public.resolve_current_employee_id()
        AND v.planning_status <> 'draft'
      UNION
      SELECT a.client_id
      FROM public.assignments a
      WHERE a.tenant_id = public.current_tenant_id()
        AND a.employee_id = public.resolve_current_employee_id()
    )
  );

DROP POLICY IF EXISTS client_addresses_portal_employee_select ON public.client_addresses;
CREATE POLICY client_addresses_portal_employee_select ON public.client_addresses
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND public.is_employee_portal_rls_context(tenant_id)
    AND client_id IN (
      SELECT v.client_id
      FROM public.assist_visits v
      WHERE v.tenant_id = public.current_tenant_id()
        AND v.employee_id = public.resolve_current_employee_id()
        AND v.planning_status <> 'draft'
      UNION
      SELECT a.client_id
      FROM public.assignments a
      WHERE a.tenant_id = public.current_tenant_id()
        AND a.employee_id = public.resolve_current_employee_id()
    )
  );

DROP POLICY IF EXISTS client_contacts_portal_employee_emergency_select ON public.client_contacts;
CREATE POLICY client_contacts_portal_employee_emergency_select ON public.client_contacts
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND public.is_employee_portal_rls_context(tenant_id)
    AND is_emergency_contact = TRUE
    AND client_id IN (
      SELECT v.client_id
      FROM public.assist_visits v
      WHERE v.tenant_id = public.current_tenant_id()
        AND v.employee_id = public.resolve_current_employee_id()
        AND v.planning_status <> 'draft'
      UNION
      SELECT a.client_id
      FROM public.assignments a
      WHERE a.tenant_id = public.current_tenant_id()
        AND a.employee_id = public.resolve_current_employee_id()
    )
  );

COMMENT ON POLICY clients_portal_employee_assignment_select ON public.clients IS
  'Employee portal Klientenakten — read clients on own assist_visits/assignments (dual-role safe).';

COMMENT ON POLICY client_addresses_portal_employee_select ON public.client_addresses IS
  'Employee portal — access_notes for assigned client addresses.';

COMMENT ON POLICY client_contacts_portal_employee_emergency_select ON public.client_contacts IS
  'Employee portal — emergency contacts for assigned clients (is_emergency_contact column).';
