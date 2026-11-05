-- Employees may submit their own unfinished time for Office review. They cannot
-- approve it, change ownership, rewrite signed visits, or alter exported work.
CREATE SCHEMA IF NOT EXISTS care_time_private;
REVOKE ALL ON SCHEMA care_time_private FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA care_time_private TO authenticated;

CREATE OR REPLACE FUNCTION care_time_private.submit_employee_time_correction(
  p_work_date date, p_entry_kind text, p_reference_id uuid, p_entry_id text,
  p_started_at timestamptz, p_ended_at timestamptz, p_pause_minutes integer, p_reason text,
  p_expected_review_updated_at timestamptz, p_expected_source_updated_at timestamptz
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  t uuid := public.current_tenant_id(); e uuid := public.resolve_current_employee_id();
  r public.workforce_time_entry_reviews; saved public.workforce_time_entry_reviews;
  s public.workforce_work_sessions; v public.assist_visits;
  k text; old_snapshot jsonb; snapshot jsonb; source_updated_at timestamptz;
  employee_name text; client_label text; work_kind text; gross integer;
  planned_start timestamptz; planned_end timestamptz; v_visit_id uuid; v_session_id uuid;
  event_start timestamptz; event_end timestamptz;
  source_complete boolean := false; is_new boolean := false;
BEGIN
  IF auth.uid() IS NULL OR t IS NULL OR e IS NULL OR NOT public.is_employee_portal_rls_context(t) THEN
    RAISE EXCEPTION 'Mitarbeitendenanmeldung erforderlich.' USING ERRCODE='42501';
  END IF;
  IF p_entry_kind IS NULL OR p_entry_kind NOT IN ('session','visit','manual')
    OR p_reference_id IS NULL OR p_work_date IS NULL OR p_entry_id IS NULL
    OR p_work_date > (clock_timestamp() AT TIME ZONE 'Europe/Berlin')::date
    OR nullif(btrim(p_reason),'') IS NULL OR length(p_reason)>4000 THEN
    RAISE EXCEPTION 'Buchung und Begründung müssen vollständig sein.' USING ERRCODE='22023';
  END IF;
  IF p_started_at IS NULL OR p_ended_at IS NULL OR NOT isfinite(p_started_at) OR NOT isfinite(p_ended_at)
    OR p_ended_at<=p_started_at OR p_ended_at>clock_timestamp()
    OR (p_started_at AT TIME ZONE 'Europe/Berlin')::date IS DISTINCT FROM p_work_date
    OR p_pause_minutes IS NULL OR p_pause_minutes<0
    OR p_pause_minutes>round(extract(epoch FROM (p_ended_at-p_started_at))/60) THEN
    RAISE EXCEPTION 'Beginn, Ende und Pause müssen zum ursprünglichen Arbeitstag passen und abgeschlossen sein.' USING ERRCODE='22023';
  END IF;
  gross:=round(extract(epoch FROM (p_ended_at-p_started_at))/60);
  k:=concat_ws(':',t,e,p_work_date,p_entry_kind,p_reference_id);
  -- Publication claims the same employee lock across every month.
  PERFORM pg_advisory_xact_lock(hashtextextended(concat_ws(':','payroll-office-time',t,e),0));
  -- Same lock and order as the Office review/correction RPCs.
  PERFORM pg_advisory_xact_lock(hashtextextended(k,0));
  SELECT * INTO r FROM public.workforce_time_entry_reviews WHERE tenant_id=t AND reference_key=k FOR UPDATE;
  IF r.updated_at IS DISTINCT FROM p_expected_review_updated_at THEN
    RAISE EXCEPTION 'Die Buchung wurde inzwischen geändert. Bitte erneut laden.' USING ERRCODE='40001';
  END IF;
  IF r.id IS NOT NULL AND (r.employee_id IS DISTINCT FROM e OR r.work_date IS DISTINCT FROM p_work_date
    OR r.entry_kind IS DISTINCT FROM p_entry_kind OR r.reference_id IS DISTINCT FROM p_reference_id) THEN
    RAISE EXCEPTION 'Die Buchungszuordnung stimmt nicht überein.' USING ERRCODE='42501';
  END IF;
  IF r.review_status IN ('locked','superseded') OR r.export_status IN ('exported','changed_after_export') THEN
    RAISE EXCEPTION 'Exportierte oder gesperrte Zeiten muss die Verwaltung korrigieren.' USING ERRCODE='55000';
  END IF;
  old_snapshot:=r.metadata->'office_time_entry';

  IF p_entry_kind='session' THEN
    SELECT * INTO s FROM public.workforce_work_sessions WHERE tenant_id=t AND employee_id=e
      AND id=p_reference_id AND work_date=p_work_date FOR SHARE;
    IF NOT FOUND OR p_entry_id IS DISTINCT FROM 'session:'||s.id::text THEN
      RAISE EXCEPTION 'Eigene Arbeitszeitbuchung nicht gefunden.' USING ERRCODE='42501';
    END IF;
    IF EXISTS(SELECT 1 FROM public.workforce_time_events WHERE tenant_id=t AND employee_id=e
      AND session_id=s.id AND event_type='visit_started') THEN
      RAISE EXCEPTION 'Diese Arbeitszeit wird über die einzelnen Einsätze nachbearbeitet.' USING ERRCODE='55000';
    END IF;
    source_updated_at:=s.updated_at; v_session_id:=s.id;
    source_complete:=s.started_at IS NOT NULL AND s.ended_at>s.started_at AND s.ended_at<=clock_timestamp()
      AND s.pause_minutes>=0 AND s.net_minutes>=0;
    work_kind:=CASE WHEN s.work_mode='field' THEN 'einsatz' WHEN s.work_mode='homeoffice' THEN 'homeoffice'
      WHEN s.work_mode='office' THEN 'buero' ELSE 'sonstige' END;
  ELSIF p_entry_kind='visit' THEN
    SELECT * INTO v FROM public.assist_visits WHERE tenant_id=t AND employee_id=e AND id=p_reference_id FOR SHARE;
    IF NOT FOUND THEN
      IF (SELECT count(*) FROM public.assist_visits WHERE tenant_id=t AND employee_id=e AND legacy_assignment_id=p_reference_id
        AND (planned_start_at AT TIME ZONE 'Europe/Berlin')::date=p_work_date)<>1 THEN
        RAISE EXCEPTION 'Einsatz konnte nicht eindeutig zugeordnet werden.' USING ERRCODE='42501';
      END IF;
      SELECT * INTO v FROM public.assist_visits WHERE tenant_id=t AND employee_id=e AND legacy_assignment_id=p_reference_id
        AND (planned_start_at AT TIME ZONE 'Europe/Berlin')::date=p_work_date FOR SHARE;
    END IF;
    IF (v.planned_start_at AT TIME ZONE 'Europe/Berlin')::date IS DISTINCT FROM p_work_date
      OR v.planning_status IN ('draft','cancelled') OR v.canonical_status IN ('cancelled','no_show')
      OR p_entry_id NOT IN ('visit:'||p_reference_id::text||':'||p_work_date::text,'planned:'||p_reference_id::text||':'||p_work_date::text) THEN
      RAISE EXCEPTION 'Dieser Einsatz ist nicht zur Zeitnachbearbeitung freigegeben.' USING ERRCODE='42501';
    END IF;
    source_updated_at:=v.updated_at; v_visit_id:=v.id; work_kind:='einsatz';
    planned_start:=v.planned_start_at; planned_end:=v.planned_end_at;
    source_complete:=v.actual_start_at IS NOT NULL AND v.actual_end_at>v.actual_start_at AND v.actual_end_at<=clock_timestamp();
    IF p_entry_id='visit:'||p_reference_id::text||':'||p_work_date::text THEN
      SELECT session.* INTO s FROM public.workforce_work_sessions session
        WHERE session.tenant_id=t AND session.employee_id=e AND session.work_date=p_work_date
          AND EXISTS(SELECT 1 FROM public.workforce_time_events event WHERE event.tenant_id=t AND event.employee_id=e
            AND event.session_id=session.id AND coalesce(event.reference_id,session.current_visit_id)=p_reference_id AND event.event_type='visit_started')
        ORDER BY session.id LIMIT 1 FOR SHARE;
      IF NOT FOUND THEN RAISE EXCEPTION 'Die ursprüngliche Einsatzbuchung ist nicht verfügbar. Bitte neu laden.' USING ERRCODE='40001'; END IF;
      SELECT min(occurred_at) FILTER(WHERE event_type='visit_started'),min(occurred_at) FILTER(WHERE event_type='visit_ended')
        INTO event_start,event_end FROM public.workforce_time_events WHERE tenant_id=t AND employee_id=e AND session_id=s.id
          AND coalesce(reference_id,s.current_visit_id)=p_reference_id;
      source_complete:=event_start IS NOT NULL AND event_end>event_start AND event_end<=clock_timestamp();
      v_session_id:=s.id;
    END IF;
    SELECT nullif(concat_ws(' ',first_name,last_name),'') INTO client_label FROM public.clients WHERE tenant_id=t AND id=v.client_id;
  ELSE
    IF r.id IS NULL OR jsonb_typeof(old_snapshot) IS DISTINCT FROM 'object' OR old_snapshot->>'id' IS DISTINCT FROM p_entry_id
      OR old_snapshot->>'tenantId' IS DISTINCT FROM t::text OR old_snapshot->>'employeeId' IS DISTINCT FROM e::text
      OR old_snapshot->>'workDate' IS DISTINCT FROM p_work_date::text THEN
      RAISE EXCEPTION 'Eigene manuelle Arbeitszeitbuchung nicht gefunden.' USING ERRCODE='42501';
    END IF;
    source_updated_at:=r.updated_at; work_kind:=old_snapshot->>'workKind';
    source_complete:=nullif(old_snapshot->>'actualStartAt','') IS NOT NULL AND nullif(old_snapshot->>'actualEndAt','') IS NOT NULL;
  END IF;
  IF source_updated_at IS NULL OR source_updated_at IS DISTINCT FROM p_expected_source_updated_at THEN
    RAISE EXCEPTION 'Die ursprünglichen Zeiten wurden inzwischen geändert. Bitte erneut laden.' USING ERRCODE='40001';
  END IF;
  IF jsonb_typeof(old_snapshot)='object' AND old_snapshot->>'source' IN ('correction','manual_addition') THEN
    source_complete:=
    nullif(old_snapshot->>'actualStartAt','') IS NOT NULL AND nullif(old_snapshot->>'actualEndAt','') IS NOT NULL
    AND (old_snapshot->>'actualEndAt')::timestamptz>(old_snapshot->>'actualStartAt')::timestamptz
    AND (old_snapshot->>'actualEndAt')::timestamptz<=clock_timestamp()
    AND coalesce((old_snapshot->>'pauseMinutes')::numeric,-1)>=0 AND coalesce((old_snapshot->>'netMinutes')::numeric,-1)>=0;
  END IF;
  IF r.review_status='approved' AND source_complete THEN
    RAISE EXCEPTION 'Diese Zeit ist bereits vollständig freigegeben. Bitte die Verwaltung kontaktieren.' USING ERRCODE='55000';
  END IF;
  IF EXISTS(SELECT 1 FROM public.payroll_month_statements ps CROSS JOIN LATERAL
    jsonb_array_elements(CASE WHEN jsonb_typeof(ps.snapshot_json->'catchUpTimeEntries')='array' THEN ps.snapshot_json->'catchUpTimeEntries' ELSE '[]'::jsonb END) item
    WHERE ps.tenant_id=t AND ps.employee_id=e AND ps.status<>'draft' AND (item->>'sourceEntryId'=p_entry_id
      OR item->>'entryId'=p_entry_id OR p_entry_kind='visit' AND item->>'workDate'=p_work_date::text AND (
        item->>'visitId' IN (v_visit_id::text,v.legacy_assignment_id::text,p_reference_id::text)
        OR item->>'assignmentId' IN (v_visit_id::text,v.legacy_assignment_id::text,p_reference_id::text)))) THEN
    RAISE EXCEPTION 'Diese Zeit wurde bereits nachberechnet. Bitte die Verwaltung kontaktieren.' USING ERRCODE='55000';
  END IF;
  SELECT concat_ws(' ',first_name,last_name) INTO employee_name FROM public.employees WHERE tenant_id=t AND id=e;
  IF employee_name IS NULL THEN RAISE EXCEPTION 'Mitarbeitendenzuordnung fehlt.' USING ERRCODE='42501'; END IF;
  -- Fixed identity and review status; the client supplies no approval or ownership fields.
  snapshot:=coalesce(old_snapshot,'{}'::jsonb)||jsonb_build_object(
    'id',p_entry_id,'tenantId',t,'employeeId',e,'employeeName',employee_name,'workDate',p_work_date,
    'assignmentId',CASE WHEN p_entry_kind='visit' THEN p_reference_id ELSE NULL END,
    'visitId',v_visit_id,'sessionId',v_session_id,'clientLabel',client_label,
    'assignmentTitle',coalesce(v.service_name,v.title,'Arbeitszeit'),'assignmentStatus',v.canonical_status,
    'plannedStartAt',planned_start,'plannedEndAt',planned_end,
    'actualStartAt',p_started_at,'actualEndAt',p_ended_at,'pauseMinutes',p_pause_minutes,
    'grossMinutes',gross,'netMinutes',greatest(0,gross-p_pause_minutes),'travelMinutes',NULL,
    'source','correction','workKind',coalesce(work_kind,'sonstige'),'flags','[]'::jsonb,
    'status','pending_review','reviewStatus','pending_review','exportStatus','not_exported',
    'officeComment',btrim(p_reason),'hasOpenOfficeMessage',false);
  IF r.id IS NULL THEN
    INSERT INTO public.workforce_time_entry_reviews(tenant_id,employee_id,work_date,entry_kind,reference_id,reference_key,
      review_status,export_blocking,export_status) VALUES(t,e,p_work_date,p_entry_kind,p_reference_id,k,'open',true,'not_exported')
      ON CONFLICT ON CONSTRAINT workforce_time_entry_reviews_tenant_reference_key_unique DO NOTHING RETURNING * INTO r;
    IF r.id IS NULL THEN RAISE EXCEPTION 'Die Buchung wurde inzwischen geändert. Bitte erneut laden.' USING ERRCODE='40001'; END IF;
    is_new:=true;
  END IF;
  UPDATE public.workforce_time_entry_reviews SET review_status='pending_review',export_blocking=true,export_status='not_exported',
    review_note=btrim(p_reason),office_comment=btrim(p_reason),reviewed_at=NULL,reviewed_by=NULL,
    metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object('office_time_entry',snapshot,'office_time_entry_version',2,
      'employee_time_follow_up',jsonb_build_object('submittedAt',clock_timestamp(),'submittedBy',auth.uid(),'reason',btrim(p_reason))),
    updated_at=clock_timestamp() WHERE tenant_id=t AND id=r.id RETURNING * INTO saved;
  INSERT INTO public.workforce_time_review_actions(tenant_id,entry_review_id,action,prev_status,new_status,reason,comment,
    old_value,new_value,actor_id,source,metadata) VALUES(t,saved.id,'review_corrected',CASE WHEN is_new THEN NULL ELSE r.review_status END,
    'pending_review',btrim(p_reason),btrim(p_reason),jsonb_build_object('office_time_entry',old_snapshot,'source_visit',to_jsonb(v),'source_session',to_jsonb(s)),snapshot,auth.uid(),'portal',
    jsonb_build_object('source','employee_time_follow_up','sourceUpdatedAt',source_updated_at));
  RETURN jsonb_build_object('ok',true,'review_id',saved.id,'entry_id',p_entry_id,'review_status',saved.review_status,'updated_at',saved.updated_at);
END;
$$;
REVOKE ALL ON FUNCTION care_time_private.submit_employee_time_correction(date,text,uuid,text,timestamptz,timestamptz,integer,text,timestamptz,timestamptz) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION care_time_private.submit_employee_time_correction(date,text,uuid,text,timestamptz,timestamptz,integer,text,timestamptz,timestamptz) TO authenticated;
CREATE OR REPLACE FUNCTION public.employee_portal_submit_time_correction(
  p_work_date date, p_entry_kind text, p_reference_id uuid, p_entry_id text,
  p_started_at timestamptz, p_ended_at timestamptz, p_pause_minutes integer, p_reason text,
  p_expected_review_updated_at timestamptz, p_expected_source_updated_at timestamptz
) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$
  SELECT care_time_private.submit_employee_time_correction(p_work_date,p_entry_kind,p_reference_id,p_entry_id,
    p_started_at,p_ended_at,p_pause_minutes,p_reason,p_expected_review_updated_at,p_expected_source_updated_at);
$$;
REVOKE ALL ON FUNCTION public.employee_portal_submit_time_correction(date,text,uuid,text,timestamptz,timestamptz,integer,text,timestamptz,timestamptz) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.employee_portal_submit_time_correction(date,text,uuid,text,timestamptz,timestamptz,integer,text,timestamptz,timestamptz) TO authenticated;
NOTIFY pgrst, 'reload schema';
