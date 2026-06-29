-- ASSIST.PERMISSIONS.2c — markArrived production repair (portal write gaps).
-- Root cause: geofence/driving_log/visit UPDATE lacked portal-employee RLS;
-- persistEmployeePortalStatusTransition treated ancillary write failures as fatal.

-- --------------------------------------------------------------------------
-- assist_visits — portal employee may update own assigned visits (status sync)
-- --------------------------------------------------------------------------
DROP POLICY IF EXISTS assist_visits_portal_employee_update ON public.assist_visits;
CREATE POLICY assist_visits_portal_employee_update ON public.assist_visits
  FOR UPDATE TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND public.is_employee_portal_rls_context(tenant_id)
    AND employee_id = public.resolve_current_employee_id()
    AND planning_status <> 'draft'
  )
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND public.is_employee_portal_rls_context(tenant_id)
    AND employee_id = public.resolve_current_employee_id()
    AND planning_status <> 'draft'
  );

-- --------------------------------------------------------------------------
-- assist_geofence_events — portal insert at arrival (soft geofence check)
-- --------------------------------------------------------------------------
DROP POLICY IF EXISTS assist_geofence_events_portal_employee_insert ON public.assist_geofence_events;
CREATE POLICY assist_geofence_events_portal_employee_insert ON public.assist_geofence_events
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND public.is_employee_portal_rls_context(tenant_id)
    AND visit_id IN (SELECT public.portal_employee_assigned_visit_ids(tenant_id))
  );

DROP POLICY IF EXISTS assist_geofence_events_portal_employee_select ON public.assist_geofence_events;
CREATE POLICY assist_geofence_events_portal_employee_select ON public.assist_geofence_events
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND public.is_employee_portal_rls_context(tenant_id)
    AND visit_id IN (SELECT public.portal_employee_assigned_visit_ids(tenant_id))
  );

GRANT SELECT, INSERT ON public.assist_geofence_events TO authenticated;

-- --------------------------------------------------------------------------
-- assist_driving_log — portal insert/update for assigned visits
-- --------------------------------------------------------------------------
DROP POLICY IF EXISTS assist_driving_log_portal_employee_all ON public.assist_driving_log;
CREATE POLICY assist_driving_log_portal_employee_all ON public.assist_driving_log
  FOR ALL TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND public.is_employee_portal_rls_context(tenant_id)
    AND (
      visit_id IN (SELECT public.portal_employee_assigned_visit_ids(tenant_id))
      OR employee_id = public.resolve_current_employee_id()
    )
  )
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND public.is_employee_portal_rls_context(tenant_id)
    AND (
      visit_id IN (SELECT public.portal_employee_assigned_visit_ids(tenant_id))
      OR employee_id = public.resolve_current_employee_id()
    )
  );

GRANT SELECT, INSERT, UPDATE ON public.assist_driving_log TO authenticated;

-- --------------------------------------------------------------------------
-- assist_visit_status_history — portal insert when employee updates visit status
-- --------------------------------------------------------------------------
DROP POLICY IF EXISTS assist_visit_status_history_portal_employee_insert ON public.assist_visit_status_history;
CREATE POLICY assist_visit_status_history_portal_employee_insert ON public.assist_visit_status_history
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND public.is_employee_portal_rls_context(tenant_id)
    AND visit_id IN (SELECT public.portal_employee_assigned_visit_ids(tenant_id))
  );

GRANT SELECT, INSERT ON public.assist_visit_status_history TO authenticated;
