-- Employee portal live data: self-read RLS for profile, scoped assignments/tasks.

DROP POLICY IF EXISTS employees_portal_self_select ON public.employees;
CREATE POLICY employees_portal_self_select ON public.employees
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND id = public.resolve_current_employee_id()
    AND public.current_role_key() = 'employee_portal'
  );

DROP POLICY IF EXISTS assignments_portal_employee_select ON public.assignments;
CREATE POLICY assignments_portal_employee_select ON public.assignments
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND employee_id = public.resolve_current_employee_id()
    AND public.current_role_key() = 'employee_portal'
  );

DROP POLICY IF EXISTS assignments_portal_employee_update ON public.assignments;
CREATE POLICY assignments_portal_employee_update ON public.assignments
  FOR UPDATE TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND employee_id = public.resolve_current_employee_id()
    AND public.current_role_key() = 'employee_portal'
  )
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND employee_id = public.resolve_current_employee_id()
  );

DROP POLICY IF EXISTS assignment_tasks_portal_employee_select ON public.assignment_tasks;
CREATE POLICY assignment_tasks_portal_employee_select ON public.assignment_tasks
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND public.current_role_key() = 'employee_portal'
    AND assignment_id IN (
      SELECT a.id
      FROM public.assignments a
      WHERE a.tenant_id = public.current_tenant_id()
        AND a.employee_id = public.resolve_current_employee_id()
    )
  );

DROP POLICY IF EXISTS assignment_tasks_portal_employee_update ON public.assignment_tasks;
CREATE POLICY assignment_tasks_portal_employee_update ON public.assignment_tasks
  FOR UPDATE TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND public.current_role_key() = 'employee_portal'
    AND assignment_id IN (
      SELECT a.id
      FROM public.assignments a
      WHERE a.tenant_id = public.current_tenant_id()
        AND a.employee_id = public.resolve_current_employee_id()
    )
  )
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND public.current_role_key() = 'employee_portal'
  );

DROP POLICY IF EXISTS client_contacts_portal_employee_emergency_select ON public.client_contacts;
CREATE POLICY client_contacts_portal_employee_emergency_select ON public.client_contacts
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND public.current_role_key() = 'employee_portal'
    AND is_emergency_contact = TRUE
    AND client_id IN (
      SELECT a.client_id
      FROM public.assignments a
      WHERE a.tenant_id = public.current_tenant_id()
        AND a.employee_id = public.resolve_current_employee_id()
    )
  );

COMMENT ON POLICY employees_portal_self_select ON public.employees IS
  'Employee portal users read their own employee record for profile view.';
COMMENT ON POLICY assignments_portal_employee_select ON public.assignments IS
  'Employee portal users read assignments assigned to them.';
COMMENT ON POLICY assignments_portal_employee_update ON public.assignments IS
  'Employee portal users update status on their own assignments during execution.';
