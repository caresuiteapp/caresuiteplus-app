-- ASSIST.LIVE.1 — Assist live monitoring read path (idempotent repair).
-- Ensures Office/Assist tenant members can read LT.GMAPS persistence for monitoring.

-- assist_visits: realtime for live status sidebar/main sync
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'assist_visits'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.assist_visits;
  END IF;
END $$;

-- Office/Assist read-only SELECT on tracking persistence (tenant members, not portal roles)
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

COMMENT ON POLICY assist_tracking_sessions_office_assist_select ON public.assist_tracking_sessions IS
  'ASSIST.LIVE.1 — Assist/Office read-only monitoring of active GPS sessions.';
COMMENT ON POLICY assist_location_points_office_assist_select ON public.assist_location_points IS
  'ASSIST.LIVE.1 — Assist/Office read latest location snapshots for live map.';
COMMENT ON POLICY assist_time_events_office_assist_select ON public.assist_time_events IS
  'ASSIST.LIVE.1 — Assist/Office read drive/service timers for live status cards.';
