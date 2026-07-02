-- P0.1 — WFM RLS alignment with portal employee resolution.
-- Root cause: workforce_current_employee_id() only resolves profiles→employees;
-- portal users use employee_portal_accounts via resolve_current_employee_id().
-- Also: portal MA lacks time.tracking.own.start — allow assist-sourced WFM mirror inserts.

-- --------------------------------------------------------------------------
-- workforce_time_events
-- --------------------------------------------------------------------------
DROP POLICY IF EXISTS wfm_events_select ON public.workforce_time_events;
CREATE POLICY wfm_events_select ON public.workforce_time_events
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND (
      employee_id = public.resolve_current_employee_id()
      OR public.has_permission('time.tracking.team.view')
      OR public.has_permission('time.tracking.admin.view')
      OR public.has_permission('time.audit.view')
      OR public.is_tenant_admin()
    )
  );

DROP POLICY IF EXISTS wfm_events_insert ON public.workforce_time_events;
CREATE POLICY wfm_events_insert ON public.workforce_time_events
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND (
      (
        employee_id = public.resolve_current_employee_id()
        AND (
          public.has_permission('time.tracking.own.start')
          OR (
            public.is_employee_portal_rls_context(tenant_id)
            AND source = 'assist'
          )
        )
      )
      OR public.has_permission('time.tracking.admin.correct')
      OR public.is_tenant_admin()
    )
  );

-- --------------------------------------------------------------------------
-- workforce_work_sessions
-- --------------------------------------------------------------------------
DROP POLICY IF EXISTS wfm_sessions_select ON public.workforce_work_sessions;
CREATE POLICY wfm_sessions_select ON public.workforce_work_sessions
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND (
      employee_id = public.resolve_current_employee_id()
      OR public.has_permission('time.tracking.team.view')
      OR public.has_permission('time.tracking.admin.view')
      OR public.is_tenant_admin()
    )
  );

DROP POLICY IF EXISTS wfm_sessions_insert ON public.workforce_work_sessions;
CREATE POLICY wfm_sessions_insert ON public.workforce_work_sessions
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND (
      (
        employee_id = public.resolve_current_employee_id()
        AND (
          public.has_permission('time.tracking.own.start')
          OR public.is_employee_portal_rls_context(tenant_id)
        )
      )
      OR public.has_permission('time.tracking.admin.correct')
      OR public.is_tenant_admin()
    )
  );

DROP POLICY IF EXISTS wfm_sessions_update ON public.workforce_work_sessions;
CREATE POLICY wfm_sessions_update ON public.workforce_work_sessions
  FOR UPDATE TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND (
      employee_id = public.resolve_current_employee_id()
      OR public.has_permission('time.tracking.admin.correct')
      OR public.is_tenant_admin()
    )
  );

-- --------------------------------------------------------------------------
-- workforce_time_accounts (select own via portal resolution)
-- --------------------------------------------------------------------------
DROP POLICY IF EXISTS wfm_accounts_select ON public.workforce_time_accounts;
CREATE POLICY wfm_accounts_select ON public.workforce_time_accounts
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND (
      employee_id = public.resolve_current_employee_id()
      OR public.has_permission('time.tracking.team.view')
      OR public.has_permission('time.tracking.admin.view')
      OR public.is_tenant_admin()
    )
  );

-- --------------------------------------------------------------------------
-- workforce_rule_violations (0194 — align employee resolution)
-- --------------------------------------------------------------------------
DROP POLICY IF EXISTS wfm_rule_violations_select ON public.workforce_rule_violations;
CREATE POLICY wfm_rule_violations_select ON public.workforce_rule_violations
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND (
      employee_id = public.resolve_current_employee_id()
      OR public.has_permission('time.tracking.team.view')
      OR public.has_permission('time.tracking.admin.view')
      OR public.is_tenant_admin()
    )
  );

DROP POLICY IF EXISTS wfm_rule_violations_insert ON public.workforce_rule_violations;
CREATE POLICY wfm_rule_violations_insert ON public.workforce_rule_violations
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND (
      employee_id = public.resolve_current_employee_id()
      OR public.has_permission('time.tracking.admin.correct')
      OR public.is_tenant_admin()
    )
  );

DROP POLICY IF EXISTS wfm_rule_violations_update ON public.workforce_rule_violations;
CREATE POLICY wfm_rule_violations_update ON public.workforce_rule_violations
  FOR UPDATE TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND (
      employee_id = public.resolve_current_employee_id()
      OR public.has_permission('time.tracking.admin.correct')
      OR public.is_tenant_admin()
    )
  );

-- --------------------------------------------------------------------------
-- workforce_approvals (select — portal actor can see own)
-- --------------------------------------------------------------------------
DROP POLICY IF EXISTS wfm_approvals_select ON public.workforce_approvals;
CREATE POLICY wfm_approvals_select ON public.workforce_approvals
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND (
      requested_by = auth.uid()
      OR employee_id = public.resolve_current_employee_id()
      OR public.has_permission('office.employees.absences.approve')
      OR public.has_permission('time.tracking.admin.view')
      OR public.is_tenant_admin()
    )
  );

DROP POLICY IF EXISTS wfm_absences_select ON public.workforce_absences;
CREATE POLICY wfm_absences_select ON public.workforce_absences
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND (
      employee_id = public.resolve_current_employee_id()
      OR public.has_permission('office.employees.absences.view')
      OR public.has_permission('portal.employee.absences.view')
      OR public.is_tenant_admin()
    )
  );

DROP POLICY IF EXISTS wfm_absences_insert ON public.workforce_absences;
CREATE POLICY wfm_absences_insert ON public.workforce_absences
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND (
      (
        employee_id = public.resolve_current_employee_id()
        AND public.has_permission('portal.employee.absences.request')
      )
      OR public.has_permission('office.employees.absences.manage')
      OR public.is_tenant_admin()
    )
  );

COMMENT ON POLICY wfm_events_insert ON public.workforce_time_events IS
  'P0.1 — portal assist mirror may insert own events without time.tracking.own.start.';
