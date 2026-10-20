-- Reviewed deployment patch; apply through the normal migration release after approval.
-- Replaces only wfm_apply_clock_action. No existing time records are changed.
BEGIN;

CREATE OR REPLACE FUNCTION public.wfm_apply_clock_action(
  p_tenant_id UUID,
  p_employee_id UUID,
  p_action TEXT,
  p_work_mode TEXT,
  p_session_status TEXT,
  p_display_status TEXT,
  p_event_type TEXT,
  p_source TEXT DEFAULT 'portal',
  p_occurred_at TIMESTAMPTZ DEFAULT now()
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_session public.workforce_work_sessions%ROWTYPE;
  v_work_date DATE := (p_occurred_at AT TIME ZONE 'Europe/Berlin')::DATE;
  v_last_clock_out TIMESTAMPTZ;
  v_block_started_at TIMESTAMPTZ;
  v_pause_started_at TIMESTAMPTZ;
  v_pause_ended_at TIMESTAMPTZ;
  v_pause_minutes INTEGER;
  v_gross_minutes INTEGER;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Anmeldung erforderlich.' USING ERRCODE = '42501';
  END IF;

  IF p_employee_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.employees e
    WHERE e.id = p_employee_id AND e.tenant_id = p_tenant_id
  ) THEN
    RAISE EXCEPTION 'Mitarbeitendenzuordnung ist ungültig.' USING ERRCODE = '42501';
  END IF;

  IF p_tenant_id IS DISTINCT FROM public.current_tenant_id() THEN
    RAISE EXCEPTION 'Mandant stimmt nicht mit der Sitzung überein.';
  END IF;

  IF p_action IS NULL OR p_action NOT IN ('clock_in', 'pause', 'resume', 'switch', 'clock_out') THEN
    RAISE EXCEPTION 'Unbekannte Arbeitszeitaktion.';
  END IF;

  IF p_source IS NULL OR p_source NOT IN ('portal', 'office', 'assist', 'system', 'import', 'correction') THEN
    RAISE EXCEPTION 'Unzulässige Quelle.';
  END IF;

  -- Portal accounts have their own authenticated employee link, not an Office profile.
  -- Keep Office's explicit action permissions; portal actors can only stamp for themselves.
  IF (CASE WHEN public.current_portal_type() IS NOT NULL
                 OR public.is_employee_portal_rls_context(p_tenant_id) THEN
    p_source = 'portal'
    AND public.is_employee_portal_rls_context(p_tenant_id)
    AND p_employee_id = public.resolve_current_employee_id()
  ELSE
    (
      p_employee_id = public.resolve_current_employee_id()
      AND (
        (p_action = 'clock_in' AND public.has_permission('time.tracking.own.start'))
        OR (p_action = 'pause' AND public.has_permission('time.tracking.own.pause'))
        OR (p_action = 'resume' AND public.has_permission('time.tracking.own.resume'))
        OR (p_action = 'switch' AND public.has_permission('time.tracking.own.switch'))
        OR (p_action = 'clock_out' AND public.has_permission('time.tracking.own.close'))
      )
    )
    OR public.has_permission('time.tracking.admin.correct')
    OR public.is_tenant_admin()
  END) IS NOT TRUE THEN
    RAISE EXCEPTION 'Keine Berechtigung für diese Arbeitszeitaktion.' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.workforce_work_sessions (
    tenant_id, employee_id, user_id, work_date, status, work_mode,
    display_status, started_at, ended_at, last_event_at, is_online
  )
  SELECT
    p_tenant_id, p_employee_id, auth.uid(), v_work_date,
    'offline', 'none', 'offline',
    NULL, NULL, NULL, FALSE
  WHERE p_action = 'clock_in'
  ON CONFLICT (tenant_id, employee_id, work_date) DO NOTHING;

  SELECT * INTO v_session
  FROM public.workforce_work_sessions
  WHERE tenant_id = p_tenant_id
    AND employee_id = p_employee_id
    AND work_date = v_work_date
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Kein Arbeitstag für diese Aktion vorhanden.';
  END IF;

  IF p_action = 'clock_in' AND v_session.status NOT IN ('offline', 'ended') THEN
    RAISE EXCEPTION 'Es läuft bereits ein Arbeitstag.';
  ELSIF p_action = 'pause' AND v_session.status IN ('offline', 'ended', 'paused') THEN
    RAISE EXCEPTION 'Kein aktiver Arbeitstag zum Pausieren.';
  ELSIF p_action = 'resume' AND v_session.status <> 'paused' THEN
    RAISE EXCEPTION 'Kein pausierter Arbeitstag zum Fortsetzen.';
  ELSIF p_action = 'switch' AND v_session.status IN ('offline', 'ended', 'paused') THEN
    RAISE EXCEPTION 'Kein aktiver Arbeitstag für den Tätigkeitswechsel.';
  ELSIF p_action = 'clock_out' AND v_session.status IN ('offline', 'ended') THEN
    RAISE EXCEPTION 'Kein Arbeitstag zum Abschließen.';
  END IF;

  INSERT INTO public.workforce_time_events (
    tenant_id, employee_id, user_id, event_type, work_mode, source,
    occurred_at, session_id, created_by, metadata
  ) VALUES (
    p_tenant_id, p_employee_id, auth.uid(), p_event_type, p_work_mode, p_source,
    p_occurred_at, v_session.id, auth.uid(),
    jsonb_build_object('atomic_action', p_action, 'integrity_release', 'WFM-R1')
  );

  IF p_action = 'clock_in' THEN
    UPDATE public.workforce_work_sessions
    SET status = p_session_status,
        work_mode = p_work_mode,
        display_status = p_display_status,
        started_at = coalesce(started_at, p_occurred_at),
        ended_at = NULL,
        last_event_at = p_occurred_at,
        is_online = TRUE,
        updated_at = now()
    WHERE id = v_session.id;

  ELSIF p_action = 'pause' THEN
    UPDATE public.workforce_work_sessions
    SET status = 'paused',
        display_status = 'pause',
        last_event_at = p_occurred_at,
        is_online = TRUE,
        updated_at = now()
    WHERE id = v_session.id;

  ELSIF p_action = 'resume' THEN
    SELECT max(occurred_at) FILTER (WHERE event_type = 'pause_start'),
           max(occurred_at) FILTER (WHERE event_type = 'pause_end')
    INTO v_pause_started_at, v_pause_ended_at
    FROM public.workforce_time_events
    WHERE tenant_id = p_tenant_id AND session_id = v_session.id;

    v_pause_minutes := v_session.pause_minutes;
    IF v_pause_started_at IS NOT NULL
       AND (v_pause_ended_at IS NULL OR v_pause_started_at < v_pause_ended_at) THEN
      v_pause_minutes := v_pause_minutes + greatest(
        0,
        floor(extract(epoch FROM (p_occurred_at - v_pause_started_at)) / 60)::INTEGER
      );
    END IF;

    UPDATE public.workforce_work_sessions
    SET status = p_session_status,
        work_mode = p_work_mode,
        display_status = p_display_status,
        pause_minutes = v_pause_minutes,
        last_event_at = p_occurred_at,
        is_online = TRUE,
        updated_at = now()
    WHERE id = v_session.id;

  ELSIF p_action = 'switch' THEN
    UPDATE public.workforce_work_sessions
    SET status = p_session_status,
        work_mode = p_work_mode,
        display_status = p_display_status,
        last_event_at = p_occurred_at,
        is_online = TRUE,
        updated_at = now()
    WHERE id = v_session.id;

  ELSIF p_action = 'clock_out' THEN
    SELECT max(occurred_at) INTO v_last_clock_out
    FROM public.workforce_time_events
    WHERE tenant_id = p_tenant_id
      AND session_id = v_session.id
      AND event_type = 'clock_out'
      AND occurred_at < p_occurred_at;

    SELECT min(occurred_at) INTO v_block_started_at
    FROM public.workforce_time_events
    WHERE tenant_id = p_tenant_id
      AND session_id = v_session.id
      AND event_type IN (
        'clock_in', 'office_check_in', 'homeoffice_start', 'visit_started',
        'standby_start', 'training_start', 'meeting_start', 'travel_start'
      )
      AND (v_last_clock_out IS NULL OR occurred_at > v_last_clock_out)
      AND occurred_at <= p_occurred_at;

    v_gross_minutes := v_session.gross_minutes + greatest(
      0,
      floor(extract(epoch FROM (p_occurred_at - coalesce(v_block_started_at, v_session.last_event_at, p_occurred_at))) / 60)::INTEGER
    );
    v_pause_minutes := v_session.pause_minutes;

    IF v_session.status = 'paused' THEN
      SELECT max(occurred_at) INTO v_pause_started_at
      FROM public.workforce_time_events
      WHERE tenant_id = p_tenant_id
        AND session_id = v_session.id
        AND event_type = 'pause_start'
        AND occurred_at <= p_occurred_at;
      IF v_pause_started_at IS NOT NULL THEN
        v_pause_minutes := v_pause_minutes + greatest(
          0,
          floor(extract(epoch FROM (p_occurred_at - v_pause_started_at)) / 60)::INTEGER
        );
      END IF;
    END IF;

    v_pause_minutes := least(v_pause_minutes, v_gross_minutes);
    UPDATE public.workforce_work_sessions
    SET status = 'ended',
        display_status = 'feierabend',
        ended_at = p_occurred_at,
        last_event_at = p_occurred_at,
        is_online = FALSE,
        gross_minutes = v_gross_minutes,
        pause_minutes = v_pause_minutes,
        net_minutes = greatest(0, v_gross_minutes - v_pause_minutes),
        updated_at = now()
    WHERE id = v_session.id;
  END IF;

  RETURN jsonb_build_object('ok', TRUE, 'session_id', v_session.id, 'work_date', v_work_date);
END;
$$;

REVOKE ALL ON FUNCTION public.wfm_apply_clock_action(UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.wfm_apply_clock_action(UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ) TO authenticated;
NOTIFY pgrst, 'reload schema';
COMMIT;
