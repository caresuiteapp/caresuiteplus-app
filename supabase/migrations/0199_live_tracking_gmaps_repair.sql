-- LT.GMAPS.1 — Live tracking + Google Maps browser key runtime repair (additive).
-- Fixes: portal assignment resolution, tracking RLS circular deps, tenant membership for portal users.

-- --------------------------------------------------------------------------
-- tenant_runtime_settings — browser-safe config (no secrets in repo)
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tenant_runtime_settings (
  tenant_id               UUID          NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  setting_key             TEXT          NOT NULL,
  setting_value           TEXT,
  updated_at              TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_by              UUID          REFERENCES public.profiles(id) ON DELETE SET NULL,
  PRIMARY KEY (tenant_id, setting_key),
  CONSTRAINT tenant_runtime_settings_key_nonempty
    CHECK (char_length(trim(setting_key)) > 0)
);

COMMENT ON TABLE public.tenant_runtime_settings IS
  'Tenant-scoped runtime config (e.g. google_maps_browser_key override). Server secrets stay in Supabase vault.';

ALTER TABLE public.tenant_runtime_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_runtime_settings_tenant_read ON public.tenant_runtime_settings;
CREATE POLICY tenant_runtime_settings_tenant_read ON public.tenant_runtime_settings
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND public.is_tenant_member(tenant_id)
  );

DROP POLICY IF EXISTS tenant_runtime_settings_tenant_manage ON public.tenant_runtime_settings;
CREATE POLICY tenant_runtime_settings_tenant_manage ON public.tenant_runtime_settings
  FOR ALL TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND public.is_tenant_admin()
  )
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND public.is_tenant_admin()
  );

GRANT SELECT ON public.tenant_runtime_settings TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.tenant_runtime_settings TO authenticated;

-- --------------------------------------------------------------------------
-- is_tenant_member: include portal users (employee + client portal accounts)
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_tenant_member(p_tenant_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.tenant_memberships tm
    WHERE tm.tenant_id = p_tenant_id
      AND tm.user_id = auth.uid()
      AND tm.is_active = TRUE
  )
  OR EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE (p.id = auth.uid() OR p.auth_user_id = auth.uid())
      AND p.tenant_id = p_tenant_id
  )
  OR EXISTS (
    SELECT 1
    FROM public.employee_portal_accounts epa
    WHERE epa.auth_user_id = auth.uid()
      AND epa.tenant_id = p_tenant_id
      AND epa.status = 'active'
  )
  OR EXISTS (
    SELECT 1
    FROM public.client_portal_access cpa
    WHERE cpa.auth_user_id = auth.uid()
      AND cpa.tenant_id = p_tenant_id
      AND cpa.portal_enabled = TRUE
  );
$$;

-- --------------------------------------------------------------------------
-- assist_visits: employee portal scoped read (fallback when assignments mirror missing)
-- --------------------------------------------------------------------------
DROP POLICY IF EXISTS assist_visits_portal_employee_select ON public.assist_visits;
CREATE POLICY assist_visits_portal_employee_select ON public.assist_visits
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND public.current_role_key() = 'employee_portal'
    AND employee_id = public.resolve_current_employee_id()
    AND planning_status <> 'draft'
  );

DROP POLICY IF EXISTS assist_visit_tasks_portal_employee_select ON public.assist_visit_tasks;
CREATE POLICY assist_visit_tasks_portal_employee_select ON public.assist_visit_tasks
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND public.current_role_key() = 'employee_portal'
    AND visit_id IN (
      SELECT v.id
      FROM public.assist_visits v
      WHERE v.tenant_id = public.current_tenant_id()
        AND v.employee_id = public.resolve_current_employee_id()
        AND v.planning_status <> 'draft'
    )
  );

-- --------------------------------------------------------------------------
-- Tracking RLS: break circular dependency (visit_id via assist_visits OR assignments)
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
    AND visit_id IN (
      SELECT v.id
      FROM public.assist_visits v
      WHERE v.tenant_id = public.current_tenant_id()
        AND v.employee_id = public.resolve_current_employee_id()
        AND v.planning_status <> 'draft'
    )
  );

DROP POLICY IF EXISTS assist_location_points_portal_employee_insert ON public.assist_location_points;
CREATE POLICY assist_location_points_portal_employee_insert ON public.assist_location_points
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND public.current_role_key() = 'employee_portal'
    AND visit_id IN (
      SELECT v.id
      FROM public.assist_visits v
      WHERE v.tenant_id = public.current_tenant_id()
        AND v.employee_id = public.resolve_current_employee_id()
        AND v.planning_status <> 'draft'
    )
  );

DROP POLICY IF EXISTS assist_location_points_portal_employee_select ON public.assist_location_points;
CREATE POLICY assist_location_points_portal_employee_select ON public.assist_location_points
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND public.current_role_key() = 'employee_portal'
    AND visit_id IN (
      SELECT v.id
      FROM public.assist_visits v
      WHERE v.tenant_id = public.current_tenant_id()
        AND v.employee_id = public.resolve_current_employee_id()
        AND v.planning_status <> 'draft'
    )
  );

DROP POLICY IF EXISTS assist_time_events_portal_employee_insert ON public.assist_time_events;
CREATE POLICY assist_time_events_portal_employee_insert ON public.assist_time_events
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND public.current_role_key() = 'employee_portal'
    AND visit_id IN (
      SELECT v.id
      FROM public.assist_visits v
      WHERE v.tenant_id = public.current_tenant_id()
        AND v.employee_id = public.resolve_current_employee_id()
        AND v.planning_status <> 'draft'
    )
  );

DROP POLICY IF EXISTS assist_time_events_portal_employee_select ON public.assist_time_events;
CREATE POLICY assist_time_events_portal_employee_select ON public.assist_time_events
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND public.current_role_key() = 'employee_portal'
    AND visit_id IN (
      SELECT v.id
      FROM public.assist_visits v
      WHERE v.tenant_id = public.current_tenant_id()
        AND v.employee_id = public.resolve_current_employee_id()
        AND v.planning_status <> 'draft'
    )
  );

-- Office/Assist: read-only SELECT on active tracking (tenant members)
DROP POLICY IF EXISTS assist_tracking_sessions_office_assist_select ON public.assist_tracking_sessions;
CREATE POLICY assist_tracking_sessions_office_assist_select ON public.assist_tracking_sessions
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND public.is_tenant_member(tenant_id)
    AND public.current_role_key() <> 'employee_portal'
    AND public.current_role_key() <> 'client_portal'
  );

DROP POLICY IF EXISTS assist_location_points_office_assist_select ON public.assist_location_points;
CREATE POLICY assist_location_points_office_assist_select ON public.assist_location_points
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND public.is_tenant_member(tenant_id)
    AND public.current_role_key() <> 'employee_portal'
    AND public.current_role_key() <> 'client_portal'
  );

DROP POLICY IF EXISTS assist_time_events_office_assist_select ON public.assist_time_events;
CREATE POLICY assist_time_events_office_assist_select ON public.assist_time_events
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND public.is_tenant_member(tenant_id)
    AND public.current_role_key() <> 'employee_portal'
    AND public.current_role_key() <> 'client_portal'
  );

-- --------------------------------------------------------------------------
-- resolve_live_assignment RPC — SECURITY DEFINER bridge for portal reads
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.resolve_live_assignment(
  p_tenant_id UUID,
  p_raw_id UUID
)
RETURNS TABLE (
  assignment_id UUID,
  visit_id UUID,
  client_id UUID,
  employee_id UUID,
  source TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_tenant_id IS NULL OR p_raw_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    a.id,
    COALESCE(v.id, a.id),
    a.client_id,
    a.employee_id,
    'assignments'::TEXT
  FROM public.assignments a
  LEFT JOIN public.assist_visits v
    ON v.tenant_id = a.tenant_id
    AND (v.id = a.id OR v.legacy_assignment_id = a.id)
  WHERE a.tenant_id = p_tenant_id
    AND a.id = p_raw_id
  LIMIT 1;

  IF FOUND THEN RETURN; END IF;

  RETURN QUERY
  SELECT
    COALESCE(v.legacy_assignment_id, v.id),
    v.id,
    v.client_id,
    v.employee_id,
    'assist_visits'::TEXT
  FROM public.assist_visits v
  WHERE v.tenant_id = p_tenant_id
    AND v.id = p_raw_id
    AND v.planning_status <> 'draft'
  LIMIT 1;

  IF FOUND THEN RETURN; END IF;

  RETURN QUERY
  SELECT
    p_raw_id,
    v.id,
    v.client_id,
    v.employee_id,
    'legacy_bridge'::TEXT
  FROM public.assist_visits v
  WHERE v.tenant_id = p_tenant_id
    AND v.legacy_assignment_id = p_raw_id
    AND v.planning_status <> 'draft'
  LIMIT 1;
END;
$$;

GRANT EXECUTE ON FUNCTION public.resolve_live_assignment(UUID, UUID) TO authenticated;

-- --------------------------------------------------------------------------
-- Indexes for live tracking queries
-- --------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_assist_tracking_sessions_tenant_employee_active
  ON public.assist_tracking_sessions (tenant_id, employee_id, started_at DESC)
  WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS idx_assist_location_points_tenant_visit_recorded
  ON public.assist_location_points (tenant_id, visit_id, recorded_at DESC);

CREATE INDEX IF NOT EXISTS idx_assignments_tenant_employee_date
  ON public.assignments (tenant_id, employee_id, assignment_date DESC)
  WHERE employee_id IS NOT NULL;

-- --------------------------------------------------------------------------
-- Realtime publication for tracking tables
-- --------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.assist_tracking_sessions;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.assist_location_points;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.assist_time_events;
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_object THEN NULL;
END $$;

COMMENT ON FUNCTION public.resolve_live_assignment(UUID, UUID) IS
  'LT.GMAPS.1 — resolves assignment/visit ids for employee, office, assist and client portals.';
