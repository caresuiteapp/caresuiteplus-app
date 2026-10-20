-- P0.1 — WFM assist mirror: portal-safe tenant authorization for sync_assist_visit_times_to_wfm.
-- Root cause (production): strict p_tenant_id = current_tenant_id() guard rejects portal finalize
-- when JWT/profile tenant resolution diverges from client ctx.tenantId (budget RPC masked via direct fallback).

CREATE OR REPLACE FUNCTION public.sync_assist_visit_times_to_wfm(
  p_tenant_id UUID,
  p_visit_id  UUID
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_employee_id UUID;
  v_auth_user_id UUID;
  v_work_date DATE;
  v_session_id UUID;
  v_inserted INTEGER := 0;
  r RECORD;
  v_wfm_type TEXT;
  v_session_status TEXT;
  v_display_status TEXT;
BEGIN
  IF p_tenant_id IS NULL OR p_visit_id IS NULL THEN
    RAISE EXCEPTION 'sync_assist_visit_times_to_wfm: missing required parameters';
  END IF;

  IF NOT (
    p_tenant_id IS NOT DISTINCT FROM public.current_tenant_id()
    OR (
      auth.uid() IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM public.employee_portal_accounts epa
        WHERE epa.tenant_id = p_tenant_id
          AND epa.auth_user_id = auth.uid()
          AND epa.status = 'active'
      )
    )
    OR public.is_tenant_admin()
    OR public.has_permission('time.tracking.admin.correct')
  ) THEN
    RAISE EXCEPTION 'sync_assist_visit_times_to_wfm: tenant access denied';
  END IF;

  IF public.is_employee_portal_rls_context(p_tenant_id) THEN
    v_employee_id := public.resolve_current_employee_id();
    IF v_employee_id IS NULL THEN
      RAISE EXCEPTION 'sync_assist_visit_times_to_wfm: portal context without employee link';
    END IF;
  ELSIF NOT (
    public.has_permission('time.tracking.admin.correct')
    OR public.has_permission('time.tracking.own.start')
    OR public.is_tenant_admin()
  ) THEN
    RAISE EXCEPTION 'sync_assist_visit_times_to_wfm: insufficient permissions';
  END IF;

  IF v_employee_id IS NULL THEN
    SELECT COALESCE(av.employee_id, a.employee_id)
    INTO v_employee_id
    FROM public.assist_visits av
    FULL OUTER JOIN public.assignments a
      ON a.id = p_visit_id AND a.tenant_id = p_tenant_id
    WHERE (av.id = p_visit_id AND av.tenant_id = p_tenant_id)
       OR (a.id = p_visit_id AND a.tenant_id = p_tenant_id)
    LIMIT 1;
  END IF;

  IF v_employee_id IS NULL THEN
    RAISE EXCEPTION 'sync_assist_visit_times_to_wfm: employee not resolved for visit';
  END IF;

  IF public.is_employee_portal_rls_context(p_tenant_id) THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public.assignments a
      WHERE a.tenant_id = p_tenant_id
        AND a.id = p_visit_id
        AND a.employee_id = v_employee_id
    ) AND NOT EXISTS (
      SELECT 1
      FROM public.assist_visits av
      WHERE av.tenant_id = p_tenant_id
        AND av.id = p_visit_id
        AND av.employee_id = v_employee_id
    ) THEN
      RAISE EXCEPTION 'sync_assist_visit_times_to_wfm: visit not assigned to current employee';
    END IF;
  END IF;

  SELECT epa.auth_user_id INTO v_auth_user_id
  FROM public.employee_portal_accounts epa
  WHERE epa.tenant_id = p_tenant_id
    AND epa.employee_id = v_employee_id
  LIMIT 1;

  IF v_auth_user_id IS NULL THEN
    SELECT e.profile_id INTO v_auth_user_id
    FROM public.employees e
    WHERE e.tenant_id = p_tenant_id AND e.id = v_employee_id
    LIMIT 1;
  END IF;

  FOR r IN
    SELECT event_type, occurred_at
    FROM public.assist_time_events
    WHERE tenant_id = p_tenant_id
      AND visit_id = p_visit_id
    ORDER BY occurred_at ASC
  LOOP
    v_wfm_type := CASE r.event_type
      WHEN 'drive_start'   THEN 'visit_drive_start'
      WHEN 'drive_end'     THEN 'travel_end'
      WHEN 'arrive'        THEN 'visit_arrived'
      WHEN 'service_start' THEN 'visit_started'
      WHEN 'service_end'   THEN 'visit_ended'
      WHEN 'pause_start'   THEN 'pause_start'
      WHEN 'pause_end'     THEN 'pause_end'
      WHEN 'depart'        THEN 'visit_ended'
      ELSE NULL
    END;

    IF v_wfm_type IS NULL THEN
      CONTINUE;
    END IF;

    IF EXISTS (
      SELECT 1 FROM public.workforce_time_events e
      WHERE e.tenant_id = p_tenant_id
        AND e.employee_id = v_employee_id
        AND e.event_type = v_wfm_type
        AND e.reference_type = 'visit'
        AND e.reference_id = p_visit_id
    ) THEN
      CONTINUE;
    END IF;

    v_work_date := (r.occurred_at AT TIME ZONE 'Europe/Berlin')::date;

    SELECT ws.id INTO v_session_id
    FROM public.workforce_work_sessions ws
    WHERE ws.tenant_id = p_tenant_id
      AND ws.employee_id = v_employee_id
      AND ws.work_date = v_work_date
    LIMIT 1;

    v_session_status := CASE r.event_type
      WHEN 'drive_start'   THEN 'driving'
      WHEN 'arrive'        THEN 'on_visit'
      WHEN 'service_start' THEN 'on_visit'
      WHEN 'pause_start'   THEN 'paused'
      WHEN 'pause_end'     THEN 'on_visit'
      WHEN 'service_end'   THEN 'clocked_in'
      WHEN 'depart'        THEN 'clocked_in'
      WHEN 'drive_end'     THEN 'clocked_in'
      ELSE 'on_visit'
    END;

    v_display_status := CASE r.event_type
      WHEN 'drive_start'   THEN 'unterwegs'
      WHEN 'arrive'        THEN 'im_einsatz'
      WHEN 'service_start' THEN 'im_einsatz'
      WHEN 'pause_start'   THEN 'pause'
      WHEN 'pause_end'     THEN 'im_einsatz'
      WHEN 'service_end'   THEN 'buero'
      WHEN 'depart'        THEN 'buero'
      WHEN 'drive_end'     THEN 'buero'
      ELSE 'im_einsatz'
    END;

    IF v_session_id IS NULL THEN
      v_session_id := gen_random_uuid();
      INSERT INTO public.workforce_work_sessions (
        id, tenant_id, employee_id, user_id, work_date,
        status, work_mode, display_status,
        started_at, last_event_at, is_online,
        gross_minutes, net_minutes, pause_minutes, current_visit_id
      ) VALUES (
        v_session_id, p_tenant_id, v_employee_id, v_auth_user_id, v_work_date,
        v_session_status, 'field', v_display_status,
        r.occurred_at, r.occurred_at, r.event_type NOT IN ('service_end', 'depart'),
        0, 0, 0, p_visit_id
      );
    ELSE
      UPDATE public.workforce_work_sessions
      SET
        status = v_session_status,
        display_status = v_display_status,
        last_event_at = r.occurred_at,
        is_online = r.event_type NOT IN ('service_end', 'depart'),
        current_visit_id = COALESCE(current_visit_id, p_visit_id),
        updated_at = NOW()
      WHERE id = v_session_id;
    END IF;

    INSERT INTO public.workforce_time_events (
      id, tenant_id, employee_id, user_id,
      event_type, work_mode, source, occurred_at,
      session_id, reference_type, reference_id
    ) VALUES (
      gen_random_uuid(), p_tenant_id, v_employee_id, v_auth_user_id,
      v_wfm_type, 'field', 'assist', r.occurred_at,
      v_session_id, 'visit', p_visit_id
    );

    v_inserted := v_inserted + 1;
  END LOOP;

  RETURN v_inserted;
END;
$$;

COMMENT ON FUNCTION public.sync_assist_visit_times_to_wfm(UUID, UUID) IS
  'P0.1 — Idempotent Assist→WFM mirror; portal tenant via employee_portal_accounts when JWT tenant diverges.';
