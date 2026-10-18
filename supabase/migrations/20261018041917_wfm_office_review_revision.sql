-- Additive Web review endpoint. Existing mobile RPCs and historical rows stay untouched.
-- The live review/action tables already grant authenticated SELECT/INSERT/UPDATE
-- through tenant-scoped policies; this endpoint deliberately keeps SECURITY INVOKER.
CREATE OR REPLACE FUNCTION public.wfm_review_office_time_entry(
  p_tenant_id UUID, p_employee_id UUID, p_work_date DATE,
  p_entry_kind TEXT, p_reference_id UUID, p_reference_key TEXT,
  p_review_status TEXT, p_review_note TEXT DEFAULT NULL,
  p_expected_updated_at TIMESTAMPTZ DEFAULT NULL, p_office_entry JSONB DEFAULT NULL
)
RETURNS SETOF public.workforce_time_entry_reviews
LANGUAGE plpgsql SECURITY INVOKER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_previous public.workforce_time_entry_reviews%ROWTYPE;
  v_review public.workforce_time_entry_reviews%ROWTYPE;
  v_inserted BOOLEAN := FALSE;
  v_start TIMESTAMPTZ;
  v_end TIMESTAMPTZ;
  v_pause NUMERIC;
  v_gross NUMERIC;
  v_snapshot JSONB;
  v_action TEXT;
  v_export_status TEXT;
  v_source_exists BOOLEAN := FALSE;
  v_source_start TIMESTAMPTZ;
  v_source_end TIMESTAMPTZ;
  v_source_pause NUMERIC := 0;
  v_source_gross NUMERIC;
  v_source_net NUMERIC;
  v_saved_snapshot JSONB;
  v_session public.workforce_work_sessions%ROWTYPE;
  v_visit public.assist_visits%ROWTYPE;
  v_assignment public.assignments%ROWTYPE;
  v_execution public.assist_visit_execution_state%ROWTYPE;
  v_meeting public.workforce_team_meetings%ROWTYPE;
  v_event RECORD;
  v_pause_start TIMESTAMPTZ;
  v_pause_seconds NUMERIC := 0;
  v_mirror_allowed BOOLEAN := TRUE;
  v_cancelled BOOLEAN := FALSE;
  v_source_work_kind TEXT;
  v_source_from_visit_actual BOOLEAN := FALSE;
BEGIN
  IF auth.uid() IS NULL OR p_tenant_id IS DISTINCT FROM public.current_tenant_id()
    OR NOT (public.has_permission('time.tracking.admin.correct') OR public.is_tenant_admin()) THEN
    RAISE EXCEPTION 'Keine Berechtigung zur Arbeitszeitprüfung in diesem Mandanten' USING ERRCODE = '42501';
  END IF;
  IF p_entry_kind IS NULL OR p_entry_kind NOT IN ('session','visit','manual','meeting')
    OR p_review_status IS NULL OR p_review_status NOT IN ('approved','rejected','needs_clarification','open','locked')
    OR p_reference_id IS NULL OR p_employee_id IS NULL OR p_work_date IS NULL
    OR p_reference_key IS DISTINCT FROM concat_ws(':',p_tenant_id,p_employee_id,p_work_date,p_entry_kind,p_reference_id) THEN
    RAISE EXCEPTION 'Ungültige Prüfungsreferenz oder Entscheidung' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.employees WHERE tenant_id = p_tenant_id AND id = p_employee_id) THEN
    RAISE EXCEPTION 'Mitarbeiterprofil gehört nicht zu diesem Mandanten' USING ERRCODE = '23503';
  END IF;
  IF p_review_status IN ('rejected','needs_clarification') AND NULLIF(btrim(p_review_note),'') IS NULL THEN
    RAISE EXCEPTION 'Eine Begründung ist erforderlich' USING ERRCODE = '22023';
  END IF;
  v_export_status := CASE WHEN p_review_status = 'approved' THEN 'export_ready' ELSE 'not_exported' END;
  IF p_review_status = 'approved' THEN
    IF jsonb_typeof(p_office_entry) IS DISTINCT FROM 'object'
      OR NULLIF(p_office_entry->>'id','') IS NULL
      OR p_office_entry->>'tenantId' IS DISTINCT FROM p_tenant_id::text
      OR p_office_entry->>'employeeId' IS DISTINCT FROM p_employee_id::text
      OR p_office_entry->>'workDate' IS DISTINCT FROM p_work_date::text
      OR jsonb_typeof(p_office_entry->'flags') IS DISTINCT FROM 'array'
      OR COALESCE(p_office_entry->>'source','') NOT IN ('portal','office','system','correction','manual_addition')
      OR COALESCE(p_office_entry->>'workKind','') NOT IN ('einsatz','buero','homeoffice','fahrt','pause','korrektur','nachtrag','sonstige') THEN
      RAISE EXCEPTION 'Vollständige Zeitwerte gehören zu jeder Genehmigung' USING ERRCODE = '22023';
    END IF;
    v_start := (p_office_entry->>'actualStartAt')::timestamptz;
    v_end := (p_office_entry->>'actualEndAt')::timestamptz;
    v_pause := (p_office_entry->>'pauseMinutes')::numeric;
    IF v_start IS NULL OR v_end IS NULL OR NOT isfinite(v_start) OR NOT isfinite(v_end)
      OR v_end <= v_start OR v_end > clock_timestamp() OR v_pause IS NULL
      OR v_pause <> trunc(v_pause) OR v_pause < 0
      OR v_pause > round(extract(epoch FROM (v_end-v_start))/60) THEN
      RAISE EXCEPTION 'Nur vollständige abgeschlossene Zeitwerte mit gültiger Pause können genehmigt werden' USING ERRCODE = '22023';
    END IF;
    v_gross := round(extract(epoch FROM (v_end-v_start))/60);
    v_snapshot := (p_office_entry - 'officeRevision') || jsonb_build_object(
      'grossMinutes',v_gross,'netMinutes',greatest(0,v_gross-v_pause),
      'status','approved','reviewStatus','approved','exportStatus','export_ready');
  ELSIF p_office_entry IS NOT NULL THEN
    RAISE EXCEPTION 'Zeitwerte dürfen nur zusammen mit einer Genehmigung übergeben werden' USING ERRCODE = '22023';
  END IF;

  -- Same key as the correction RPC; SELECT FOR UPDATE also serializes legacy row edits.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_reference_key,0));
  SELECT * INTO v_previous FROM public.workforce_time_entry_reviews
    WHERE tenant_id = p_tenant_id AND reference_key = p_reference_key FOR UPDATE;
  -- Approving is not a correction: resolve the actual values from persisted
  -- data while holding the review/source locks, then compare the submitted view.
  -- An existing reasoned Office correction/addition is itself the saved source.
  v_saved_snapshot := v_previous.metadata->'office_time_entry';
  IF jsonb_typeof(v_saved_snapshot) = 'object'
    AND v_saved_snapshot->>'tenantId' = p_tenant_id::text
    AND v_saved_snapshot->>'employeeId' = p_employee_id::text
    AND v_saved_snapshot->>'workDate' = p_work_date::text
    AND v_saved_snapshot->>'source' IN ('correction','manual_addition') THEN
    v_source_exists := TRUE;
    v_source_start := (v_saved_snapshot->>'actualStartAt')::timestamptz;
    v_source_end := (v_saved_snapshot->>'actualEndAt')::timestamptz;
    v_source_pause := (v_saved_snapshot->>'pauseMinutes')::numeric;
    v_source_gross := round(extract(epoch FROM (v_source_end-v_source_start))/60);
    v_source_net := greatest(0,v_source_gross-v_source_pause);
  ELSIF p_entry_kind = 'session' THEN
    v_saved_snapshot := NULL;
    SELECT * INTO v_session FROM public.workforce_work_sessions
      WHERE tenant_id=p_tenant_id AND employee_id=p_employee_id AND work_date=p_work_date
        AND id=p_reference_id FOR SHARE;
    v_source_exists := FOUND;
    v_source_start := v_session.started_at;
    v_source_end := v_session.ended_at;
    v_source_pause := v_session.pause_minutes;
    -- Session totals preserve clock-out gaps between multiple work blocks.
    v_source_gross := v_session.gross_minutes;
    v_source_net := v_session.net_minutes;
    v_source_work_kind := CASE
      WHEN v_session.status='on_visit' OR v_session.work_mode='field' THEN 'einsatz'
      WHEN v_session.status='homeoffice' OR v_session.display_status='homeoffice' THEN 'homeoffice'
      WHEN v_session.status='office' OR v_session.display_status='buero' THEN 'buero'
      WHEN v_session.status='driving' THEN 'fahrt' WHEN v_session.status='paused' THEN 'pause'
      ELSE 'sonstige' END;
    IF p_review_status='approved' AND p_office_entry->>'id' IS DISTINCT FROM 'session:' || p_reference_id::text THEN
      RAISE EXCEPTION 'Die Buchungs-ID passt nicht zur Sitzung' USING ERRCODE='22023';
    END IF;
  ELSIF p_entry_kind = 'visit' THEN
    v_saved_snapshot := NULL;
    v_source_work_kind := 'einsatz';
    SELECT session.* INTO v_session FROM public.workforce_work_sessions session
      WHERE session.tenant_id=p_tenant_id AND session.employee_id=p_employee_id AND session.work_date=p_work_date
        AND EXISTS (SELECT 1 FROM public.workforce_time_events event
          WHERE event.tenant_id=p_tenant_id AND event.employee_id=p_employee_id AND event.session_id=session.id
            AND COALESCE(event.reference_id,session.current_visit_id)=p_reference_id AND event.event_type='visit_started')
      ORDER BY session.id LIMIT 1 FOR SHARE;
    IF FOUND THEN
      v_source_exists := TRUE;
      SELECT min(occurred_at) FILTER (WHERE event_type='visit_started'),
             min(occurred_at) FILTER (WHERE event_type='visit_ended')
        INTO v_source_start,v_source_end FROM public.workforce_time_events
        WHERE tenant_id=p_tenant_id AND employee_id=p_employee_id AND session_id=v_session.id
          AND COALESCE(reference_id,v_session.current_visit_id)=p_reference_id;
      -- Only pauses overlapping this visit belong to it, not every pause of the day.
      v_source_pause := 0;
      v_pause_start := NULL;
      FOR v_event IN SELECT event_type,occurred_at FROM public.workforce_time_events
        WHERE tenant_id=p_tenant_id AND employee_id=p_employee_id AND session_id=v_session.id
          AND event_type IN ('pause_start','pause_end','clock_out') ORDER BY occurred_at,id
      LOOP
        IF v_event.event_type='pause_start' AND v_pause_start IS NULL THEN
          v_pause_start := v_event.occurred_at;
        ELSIF v_event.event_type IN ('pause_end','clock_out') AND v_pause_start IS NOT NULL THEN
          v_pause_seconds := v_pause_seconds + greatest(0,extract(epoch FROM
            (least(v_event.occurred_at,v_source_end)-greatest(v_pause_start,v_source_start))));
          v_pause_start := NULL;
        END IF;
      END LOOP;
      IF v_pause_start IS NOT NULL AND v_source_end IS NOT NULL THEN
        v_pause_seconds := v_pause_seconds + greatest(0,extract(epoch FROM
          (v_source_end-greatest(v_pause_start,v_source_start))));
      END IF;
      v_source_pause := round(v_pause_seconds/60);
    ELSE
      v_source_from_visit_actual := TRUE;
      SELECT * INTO v_visit FROM public.assist_visits
        WHERE tenant_id=p_tenant_id AND employee_id=p_employee_id AND id=p_reference_id
          AND COALESCE((planned_start_at AT TIME ZONE 'Europe/Berlin')::date,assignment_date)=p_work_date FOR SHARE;
      IF FOUND THEN
        v_source_exists := TRUE;
        -- A repeated occurrence must never borrow its series master's actuals.
        IF NULLIF(v_visit.recurrence_json->>'parentSeriesId','') IS NOT NULL THEN
          v_mirror_allowed := EXISTS (SELECT 1 FROM public.assist_visits parent
            WHERE parent.tenant_id=p_tenant_id AND parent.id::text=v_visit.recurrence_json->>'parentSeriesId'
              AND parent.legacy_assignment_id IS DISTINCT FROM v_visit.legacy_assignment_id);
        END IF;
        IF v_mirror_allowed AND v_visit.legacy_assignment_id IS NOT NULL THEN
          SELECT * INTO v_assignment FROM public.assignments WHERE tenant_id=p_tenant_id
            AND employee_id=p_employee_id AND id=v_visit.legacy_assignment_id FOR SHARE;
        END IF;
        SELECT * INTO v_execution FROM public.assist_visit_execution_state
          WHERE tenant_id=p_tenant_id AND visit_id=v_visit.id FOR SHARE;
        IF NOT FOUND AND v_mirror_allowed AND v_assignment.id IS NOT NULL THEN
          SELECT * INTO v_execution FROM public.assist_visit_execution_state
            WHERE tenant_id=p_tenant_id AND visit_id=v_assignment.id FOR SHARE;
        END IF;
        v_source_start := COALESCE(v_execution.service_started_at,v_visit.actual_start_at,v_assignment.actual_start_at);
        v_source_end := COALESCE(v_execution.service_ended_at,v_visit.actual_end_at,v_visit.finished_at,v_assignment.actual_end_at,v_assignment.finished_at);
        v_cancelled := COALESCE(v_visit.planning_status,'') IN ('cancelled','canceled','storniert','no_show','nicht_erschienen','draft')
          OR COALESCE(v_visit.execution_status,'') IN ('cancelled','canceled','storniert','no_show','nicht_erschienen')
          OR COALESCE(v_visit.canonical_status,'') IN ('cancelled','canceled','storniert','no_show','nicht_erschienen');
      ELSE
        SELECT * INTO v_assignment FROM public.assignments WHERE tenant_id=p_tenant_id
          AND employee_id=p_employee_id AND id=p_reference_id
          AND COALESCE((planned_start_at AT TIME ZONE 'Europe/Berlin')::date,assignment_date)=p_work_date FOR SHARE;
        v_source_exists := FOUND;
        IF v_source_exists THEN
          SELECT * INTO v_execution FROM public.assist_visit_execution_state
            WHERE tenant_id=p_tenant_id AND visit_id=v_assignment.id FOR SHARE;
          v_source_start := COALESCE(v_execution.service_started_at,v_assignment.actual_start_at);
          v_source_end := COALESCE(v_execution.service_ended_at,v_assignment.actual_end_at,v_assignment.finished_at);
        END IF;
      END IF;
      v_cancelled := v_cancelled OR COALESCE(v_execution.assignment_status,'') IN ('cancelled','canceled','storniert','no_show','nicht_erschienen')
        OR COALESCE(v_assignment.status::text,'') IN ('cancelled','canceled','storniert','no_show','nicht_erschienen');
    END IF;
    v_source_gross := round(extract(epoch FROM (v_source_end-v_source_start))/60);
    v_source_pause := least(v_source_pause,v_source_gross);
    v_source_net := greatest(0,v_source_gross-v_source_pause);
    IF p_review_status='approved' AND p_office_entry->>'id' NOT IN (
      'visit:' || p_reference_id::text || ':' || p_work_date::text,
      'planned:' || p_reference_id::text || ':' || p_work_date::text) THEN
      RAISE EXCEPTION 'Die Buchungs-ID passt nicht zum Einsatz' USING ERRCODE='22023';
    END IF;
  ELSIF p_entry_kind = 'meeting' THEN
    v_saved_snapshot := NULL;
    SELECT meeting.* INTO v_meeting FROM public.workforce_team_meetings meeting
      WHERE meeting.tenant_id=p_tenant_id AND meeting.id=p_reference_id
        AND (meeting.starts_at AT TIME ZONE 'Europe/Berlin')::date=p_work_date
        AND EXISTS (SELECT 1 FROM public.workforce_team_meeting_attendees attendee
          WHERE attendee.tenant_id=p_tenant_id AND attendee.employee_id=p_employee_id AND attendee.meeting_id=meeting.id)
      FOR SHARE;
    v_source_exists := FOUND;
    v_source_start := v_meeting.starts_at;
    v_source_end := v_meeting.ends_at;
    v_source_gross := round(extract(epoch FROM (v_source_end-v_source_start))/60);
    v_source_net := v_source_gross;
    v_cancelled := v_meeting.status IS DISTINCT FROM 'completed' OR v_meeting.counts_as_work_time IS DISTINCT FROM TRUE;
  ELSE
    v_saved_snapshot := NULL;
  END IF;
  IF NOT v_source_exists THEN
    RAISE EXCEPTION 'Die ursprüngliche Buchung ist nicht verfügbar. Bitte neu laden oder einen begründeten Nachtrag erfassen.' USING ERRCODE='22023';
  END IF;
  IF p_review_status='approved' THEN
    IF v_cancelled OR v_source_start IS NULL OR v_source_end IS NULL OR v_source_end<=v_source_start
      OR v_source_end>clock_timestamp() OR v_source_gross IS NULL OR v_source_pause IS NULL OR v_source_net IS NULL
      OR v_source_gross<0 OR v_source_pause<0 OR v_source_pause>v_source_gross
      OR v_source_net<>greatest(0,v_source_gross-v_source_pause) THEN
      RAISE EXCEPTION 'Die gespeicherte Arbeitszeit ist nicht vollständig genehmigungsfähig. Bitte neu laden oder korrigieren.' USING ERRCODE='22023';
    END IF;
    IF v_start IS DISTINCT FROM v_source_start OR v_end IS DISTINCT FROM v_source_end OR v_pause IS DISTINCT FROM v_source_pause
      OR (p_office_entry->>'grossMinutes')::numeric IS DISTINCT FROM v_source_gross
      OR (p_office_entry->>'netMinutes')::numeric IS DISTINCT FROM v_source_net
      OR (v_saved_snapshot IS NULL AND v_source_work_kind IS NOT NULL AND p_office_entry->>'workKind' IS DISTINCT FROM v_source_work_kind)
      OR (v_saved_snapshot IS NULL AND p_office_entry->>'source'='manual_addition')
      OR (v_saved_snapshot IS NULL AND NOT v_source_from_visit_actual AND p_office_entry->>'source'='correction')
      OR (v_saved_snapshot IS NOT NULL AND (
        p_office_entry->>'id' IS DISTINCT FROM v_saved_snapshot->>'id'
        OR p_office_entry->>'workKind' IS DISTINCT FROM v_saved_snapshot->>'workKind'
        OR p_office_entry->>'source' IS DISTINCT FROM v_saved_snapshot->>'source')) THEN
      RAISE EXCEPTION 'Die Zeitwerte wurden inzwischen geändert. Bitte neu laden; Änderungen benötigen eine begründete Korrektur.' USING ERRCODE='40001';
    END IF;
    v_snapshot := (COALESCE(v_saved_snapshot,p_office_entry)-'officeRevision') || jsonb_build_object(
      'actualStartAt',v_source_start,'actualEndAt',v_source_end,'pauseMinutes',v_source_pause,
      'grossMinutes',v_source_gross,'netMinutes',v_source_net,
      'status','approved','reviewStatus','approved','exportStatus','export_ready');
  END IF;

  IF v_previous.id IS NULL AND p_expected_updated_at IS NULL THEN
    -- The unique key also protects a simultaneous first insert from an older client.
    INSERT INTO public.workforce_time_entry_reviews (
      tenant_id,employee_id,work_date,entry_kind,reference_id,reference_key,
      review_status,export_blocking,export_status,metadata
    ) VALUES (
      p_tenant_id,p_employee_id,p_work_date,p_entry_kind,p_reference_id,p_reference_key,
      'open',TRUE,'not_exported','{}'::jsonb
    ) ON CONFLICT ON CONSTRAINT workforce_time_entry_reviews_tenant_reference_key_unique DO NOTHING
    RETURNING * INTO v_previous;
    v_inserted := FOUND;
    IF NOT v_inserted THEN
      SELECT * INTO v_previous FROM public.workforce_time_entry_reviews
        WHERE tenant_id = p_tenant_id AND reference_key = p_reference_key FOR UPDATE;
    END IF;
  END IF;
  IF v_previous.id IS NULL OR (NOT v_inserted AND v_previous.updated_at IS DISTINCT FROM p_expected_updated_at) THEN
    RAISE EXCEPTION 'Die Buchung wurde inzwischen geändert. Bitte erneut laden.' USING ERRCODE = '40001';
  END IF;
  IF v_previous.employee_id IS DISTINCT FROM p_employee_id OR v_previous.work_date IS DISTINCT FROM p_work_date
    OR v_previous.entry_kind IS DISTINCT FROM p_entry_kind OR v_previous.reference_id IS DISTINCT FROM p_reference_id THEN
    RAISE EXCEPTION 'Die Prüfungsreferenz stimmt nicht mit der Buchung überein' USING ERRCODE = '22023';
  END IF;
  IF v_previous.review_status IN ('locked','superseded')
    OR v_previous.export_status IN ('exported','changed_after_export') THEN
    RAISE EXCEPTION 'Exportierte oder gesperrte Buchungen benötigen den gesonderten Korrekturablauf' USING ERRCODE = '55000';
  END IF;
  IF p_review_status IN ('approved','rejected','needs_clarification')
    AND v_previous.review_status NOT IN ('open','pending_review','needs_clarification','corrected') THEN
    RAISE EXCEPTION 'Bitte diese Buchung zuerst erneut zur Prüfung öffnen' USING ERRCODE = '55000';
  END IF;

  UPDATE public.workforce_time_entry_reviews SET
    review_status = p_review_status, export_blocking = p_review_status <> 'approved', export_status = v_export_status,
    review_note = NULLIF(btrim(p_review_note),''),
    office_comment = COALESCE(NULLIF(btrim(p_review_note),''),office_comment),
    reviewed_at = CASE WHEN p_review_status = 'open' THEN NULL ELSE clock_timestamp() END,
    reviewed_by = CASE WHEN p_review_status = 'open' THEN NULL ELSE auth.uid() END,
    metadata = COALESCE(metadata,'{}'::jsonb) || CASE WHEN v_snapshot IS NOT NULL
      THEN jsonb_build_object('office_time_entry',v_snapshot,'office_time_entry_version',2)
      ELSE '{}'::jsonb END,
    updated_at = clock_timestamp()
    WHERE tenant_id = p_tenant_id AND id = v_previous.id RETURNING * INTO STRICT v_review;
  v_action := CASE p_review_status
    WHEN 'approved' THEN 'review_approved' WHEN 'rejected' THEN 'review_rejected'
    WHEN 'needs_clarification' THEN 'clarification_requested' WHEN 'locked' THEN 'locked'
    ELSE 'review_reopened' END;
  INSERT INTO public.workforce_time_review_actions (
    tenant_id,entry_review_id,action,prev_status,new_status,comment,reason,
    old_value,new_value,actor_id,source,metadata
  ) VALUES (
    p_tenant_id,v_review.id,v_action,CASE WHEN v_inserted THEN NULL ELSE v_previous.review_status END,
    p_review_status,NULLIF(btrim(p_review_note),''),NULLIF(btrim(p_review_note),''),
    v_previous.metadata->'office_time_entry',v_snapshot,auth.uid(),'office',
    jsonb_build_object('source','wfm_office_web_review_v1','expectedUpdatedAt',p_expected_updated_at));
  RETURN NEXT v_review;
END;
$$;
REVOKE ALL ON FUNCTION public.wfm_review_office_time_entry(UUID,UUID,DATE,TEXT,UUID,TEXT,TEXT,TEXT,TIMESTAMPTZ,JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.wfm_review_office_time_entry(UUID,UUID,DATE,TEXT,UUID,TEXT,TEXT,TEXT,TIMESTAMPTZ,JSONB) TO authenticated;
