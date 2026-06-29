-- LT.GMAPS.2 — Employee portal live tracking producer repair (additive).
-- Adds last_location_at, active-session uniqueness, portal client read scope, assignment task read fix.

-- --------------------------------------------------------------------------
-- assist_tracking_sessions.last_location_at — session heartbeat for Office/Client
-- --------------------------------------------------------------------------
ALTER TABLE public.assist_tracking_sessions
  ADD COLUMN IF NOT EXISTS last_location_at TIMESTAMPTZ;

COMMENT ON COLUMN public.assist_tracking_sessions.last_location_at IS
  'LT.GMAPS.2 — timestamp of last assist_location_points write for this session.';

CREATE INDEX IF NOT EXISTS idx_assist_tracking_sessions_tenant_active_last_loc
  ON public.assist_tracking_sessions (tenant_id, is_active, last_location_at DESC NULLS LAST)
  WHERE is_active = TRUE;

-- One active session per visit (employee portal producer)
CREATE UNIQUE INDEX IF NOT EXISTS uq_assist_tracking_sessions_active_visit
  ON public.assist_tracking_sessions (tenant_id, visit_id)
  WHERE is_active = TRUE;

-- --------------------------------------------------------------------------
-- Employee portal: read client address for assigned visits only (narrower than own_tenant)
-- --------------------------------------------------------------------------
DROP POLICY IF EXISTS clients_portal_employee_assignment_select ON public.clients;
CREATE POLICY clients_portal_employee_assignment_select ON public.clients
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND public.current_role_key() = 'employee_portal'
    AND id IN (
      SELECT a.client_id
      FROM public.assignments a
      WHERE a.tenant_id = public.current_tenant_id()
        AND a.employee_id = public.resolve_current_employee_id()
    )
  );

-- --------------------------------------------------------------------------
-- assist_tracking_sessions: allow UPDATE last_location_at for portal employee
-- (0199 FOR ALL already covers — reinforce WITH CHECK for assignment/visit bridge)
-- --------------------------------------------------------------------------
DROP POLICY IF EXISTS assist_tracking_sessions_portal_employee_update ON public.assist_tracking_sessions;
CREATE POLICY assist_tracking_sessions_portal_employee_update ON public.assist_tracking_sessions
  FOR UPDATE TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND public.current_role_key() = 'employee_portal'
    AND employee_id = public.resolve_current_employee_id()
  )
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND public.current_role_key() = 'employee_portal'
    AND employee_id = public.resolve_current_employee_id()
  );

-- --------------------------------------------------------------------------
-- resolve_live_assignment: add employee scope parameter (optional filter)
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.resolve_live_assignment(
  p_tenant_id UUID,
  p_raw_id UUID,
  p_employee_id UUID DEFAULT NULL
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
    AND (p_employee_id IS NULL OR a.employee_id = p_employee_id)
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
    AND (p_employee_id IS NULL OR v.employee_id = p_employee_id)
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
    AND (p_employee_id IS NULL OR v.employee_id = p_employee_id)
  LIMIT 1;
END;
$$;

GRANT EXECUTE ON FUNCTION public.resolve_live_assignment(UUID, UUID, UUID) TO authenticated;

COMMENT ON FUNCTION public.resolve_live_assignment(UUID, UUID, UUID) IS
  'LT.GMAPS.2 — resolves assignment/visit ids; optional employee scope for portal producer.';
