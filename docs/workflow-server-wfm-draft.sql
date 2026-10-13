-- REVIEW DRAFT ONLY; never applied remotely; not a migration.
-- Catalogs: workflow-server-write-rpc-metadata-20261011.json and
-- workflow-server-wfm-metadata-20261011.json. Requires the reviewed identity
-- helpers. Atomic projection receipt remains the existing integer RPC result.
-- Source event identity replaces (Visit,event_type) deduplication. Existing
-- matching legacy mirrors are adopted; no historical business rows are deleted.
BEGIN;
CREATE UNIQUE INDEX IF NOT EXISTS workflow_wfm_assist_source_event_unique
  ON public.workforce_time_events(tenant_id,(metadata->>'assist_source_event_id'))
  WHERE source='assist' AND metadata->>'assist_source_event_id' IS NOT NULL;

-- Internal helper: union real recorded intervals across clock/Visit channels.
-- An office work block and its Visit overlap once; gaps between standalone
-- Visits are not invented working time. Every completed pause is retained.
CREATE OR REPLACE FUNCTION public.workflow_recalculate_wfm_day(p_session uuid)
RETURNS jsonb LANGUAGE plpgsql SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE
  s public.workforce_work_sessions%ROWTYPE;
  r record; k text; st jsonb; states jsonb := '{}';
  v_work tstzmultirange := '{}'; v_pause tstzmultirange := '{}';
  v_from timestamptz; v_to timestamptz; v_start timestamptz; v_end timestamptz;
  v_now timestamptz := clock_timestamp(); v_active boolean := FALSE;
  v_gross integer; v_pauses integer; v_last timestamptz;
BEGIN
  SELECT * INTO STRICT s FROM public.workforce_work_sessions WHERE id=p_session FOR UPDATE;
  IF EXISTS (SELECT 1 FROM public.workforce_time_events e WHERE e.session_id=s.id
    AND (e.correction_of_id IS NOT NULL OR e.event_type='manual_correction')) THEN
    RAISE EXCEPTION 'Korrigierte Arbeitszeit benötigt geprüfte Neuabstimmung.' USING ERRCODE='55000';
  END IF;
  v_start := s.work_date::timestamp AT TIME ZONE 'Europe/Berlin';
  v_end := (s.work_date+1)::timestamp AT TIME ZONE 'Europe/Berlin';
  FOR r IN SELECT e.* FROM public.workforce_time_events e
    WHERE e.tenant_id=s.tenant_id AND e.employee_id=s.employee_id AND e.occurred_at<v_end
      AND (e.source<>'assist' OR e.reference_id IN (
        SELECT x.reference_id FROM public.workforce_time_events x
        WHERE x.tenant_id=s.tenant_id AND x.employee_id=s.employee_id AND x.source='assist'
          AND x.occurred_at>=v_start AND x.occurred_at<v_end))
    ORDER BY e.occurred_at,e.id
  LOOP
    IF r.occurred_at>v_now THEN RAISE EXCEPTION 'Zukünftiges Arbeitszeitereignis.' USING ERRCODE='22023'; END IF;
    k := CASE WHEN r.source='assist' AND r.reference_id IS NOT NULL THEN 'visit:'||r.reference_id::text ELSE 'clock' END;
    st := COALESCE(states->k,jsonb_build_object('at',r.occurred_at,'working',FALSE,'paused',FALSE));
    v_from := greatest((st->>'at')::timestamptz,v_start);
    v_to := least(r.occurred_at,v_end,v_now);
    IF (st->>'working')::boolean AND v_to>v_from THEN
      v_work := v_work+tstzmultirange(tstzrange(v_from,v_to,'[)'));
      IF (st->>'paused')::boolean THEN v_pause:=v_pause+tstzmultirange(tstzrange(v_from,v_to,'[)')); END IF;
    END IF;
    st:=st||jsonb_build_object('at',r.occurred_at);
    IF (k<>'clock' AND r.event_type IN ('visit_started','visit_drive_start'))
      OR (k='clock' AND r.event_type IN ('clock_in','office_check_in','homeoffice_start','standby_start','training_start','meeting_start','travel_start')) THEN
      st:=st||jsonb_build_object('working',TRUE,'kind',CASE WHEN r.event_type='visit_drive_start' THEN 'drive' ELSE 'service' END);
    ELSIF (k<>'clock' AND (r.event_type='visit_ended' OR (st->>'kind'='drive' AND r.event_type IN ('visit_arrived','travel_end'))))
      OR (k='clock' AND r.event_type='clock_out') THEN
      st:=st||jsonb_build_object('working',FALSE,'paused',FALSE);
    ELSIF r.event_type='pause_start' AND (st->>'working')::boolean THEN st:=st||jsonb_build_object('paused',TRUE);
    ELSIF r.event_type='pause_end' THEN st:=st||jsonb_build_object('paused',FALSE); END IF;
    states:=jsonb_set(states,ARRAY[k],st);
    IF r.occurred_at>=v_start THEN v_last:=r.occurred_at; END IF;
  END LOOP;
  FOR k,st IN SELECT key,value FROM jsonb_each(states) LOOP
    IF NOT (st->>'working')::boolean THEN CONTINUE; END IF;
    IF s.work_date<>(v_now AT TIME ZONE 'Europe/Berlin')::date THEN
      RAISE EXCEPTION 'Nicht beendete historische Arbeitszeit: Abschluss prüfen.' USING ERRCODE='55000';
    END IF;
    v_active:=TRUE; v_from:=greatest((st->>'at')::timestamptz,v_start); v_to:=least(v_now,v_end);
    IF v_to>v_from THEN
      v_work:=v_work+tstzmultirange(tstzrange(v_from,v_to,'[)'));
      IF (st->>'paused')::boolean THEN v_pause:=v_pause+tstzmultirange(tstzrange(v_from,v_to,'[)')); END IF;
    END IF;
  END LOOP;
  SELECT COALESCE(round(sum(extract(epoch FROM upper(x)-lower(x)))/60),0)::integer INTO v_gross FROM unnest(v_work) x;
  SELECT COALESCE(round(sum(extract(epoch FROM upper(x)-lower(x)))/60),0)::integer INTO v_pauses FROM unnest(v_pause*v_work) x;
  UPDATE public.workforce_work_sessions SET gross_minutes=v_gross,pause_minutes=least(v_gross,v_pauses),
    net_minutes=greatest(0,v_gross-v_pauses),is_online=v_active,
    ended_at=CASE WHEN v_active THEN NULL ELSE v_last END,
    status=CASE WHEN v_active THEN 'clocked_in' ELSE 'ended' END,
    last_event_at=v_last,updated_at=v_now,
    metadata=COALESCE(metadata,'{}')||jsonb_build_object('assist_projection_version',2)
    WHERE id=s.id AND tenant_id=s.tenant_id AND employee_id=s.employee_id;
  RETURN jsonb_build_object('grossMinutes',v_gross,'pauseMinutes',v_pauses,'netMinutes',greatest(0,v_gross-v_pauses));
END $$;
REVOKE ALL ON FUNCTION public.workflow_recalculate_wfm_day(uuid) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.sync_assist_visit_times_to_wfm(p_tenant_id uuid,p_visit_id uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE
  v_employee uuid; v_own uuid; v_source_visit uuid; v_auth_user uuid;
  v_session uuid; v_day date; v_inserted integer:=0; v_event_id uuid; v_existing uuid;
  v_type text; v_count integer; r record; v_portal boolean;
  v_days date[] := '{}';
BEGIN
  IF auth.uid() IS NULL OR p_tenant_id IS NULL OR p_visit_id IS NULL
    OR p_tenant_id IS DISTINCT FROM public.current_tenant_id() THEN
    RAISE EXCEPTION 'WFM: Anmeldung und aktueller Mandant erforderlich.' USING ERRCODE='42501';
  END IF;
  v_portal:=COALESCE(public.current_portal_type(),'')='employee'; v_own:=public.resolve_current_employee_id();
  IF v_portal THEN
    IF v_own IS NULL OR NOT EXISTS (SELECT 1 FROM public.employee_portal_accounts e
      WHERE e.id=public.current_portal_account_id() AND e.auth_user_id=auth.uid()
        AND e.tenant_id=p_tenant_id AND e.employee_id=v_own AND e.status='active') THEN
      RAISE EXCEPTION 'WFM: aktives Mitarbeitendenkonto erforderlich.' USING ERRCODE='42501'; END IF;
  ELSIF COALESCE(public.current_portal_type(),'business')<>'business'
    OR NOT COALESCE(public.is_internal_tenant_actor(p_tenant_id),FALSE)
    OR NOT (COALESCE(public.has_permission('time.tracking.admin.correct'),FALSE)
      OR COALESCE(public.has_permission('time.tracking.own.start'),FALSE)) THEN
    RAISE EXCEPTION 'WFM: keine Berechtigung.' USING ERRCODE='42501';
  END IF;
  SELECT count(*) INTO v_count FROM public.assist_visits v
    WHERE v.tenant_id=p_tenant_id AND (v.id=p_visit_id OR v.legacy_assignment_id=p_visit_id);
  IF v_count>1 THEN RAISE EXCEPTION 'WFM: mehrdeutiger Legacy-Einsatz.' USING ERRCODE='22023'; END IF;
  IF v_count=1 THEN
    SELECT v.id,v.employee_id INTO v_source_visit,v_employee FROM public.assist_visits v
      WHERE v.tenant_id=p_tenant_id AND (v.id=p_visit_id OR v.legacy_assignment_id=p_visit_id) FOR UPDATE;
  ELSE
    SELECT a.id,a.employee_id INTO v_source_visit,v_employee FROM public.assignments a
      WHERE a.tenant_id=p_tenant_id AND a.id=p_visit_id FOR UPDATE;
  END IF;
  IF v_employee IS NULL OR (v_portal AND v_employee IS DISTINCT FROM v_own)
    OR (NOT v_portal AND NOT COALESCE(public.has_permission('time.tracking.admin.correct'),FALSE)
      AND v_employee IS DISTINCT FROM v_own) THEN
    RAISE EXCEPTION 'WFM: Einsatz nicht zugeordnet.' USING ERRCODE='42501';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_tenant_id::text||':'||v_employee::text,20261011));
  SELECT e.auth_user_id INTO v_auth_user FROM public.employee_portal_accounts e
    WHERE e.tenant_id=p_tenant_id AND e.employee_id=v_employee AND e.status='active'
      AND EXISTS(SELECT 1 FROM auth.users u WHERE u.id=e.auth_user_id)
    ORDER BY e.id LIMIT 1;
  IF v_auth_user IS NULL THEN
    SELECT p.auth_user_id INTO v_auth_user FROM public.employees e
      JOIN public.profiles p ON p.id=e.profile_id AND p.tenant_id=e.tenant_id
      JOIN auth.users u ON u.id=p.auth_user_id
      WHERE e.tenant_id=p_tenant_id AND e.id=v_employee AND p.is_active=TRUE AND p.status='active';
  END IF;
  FOR r IN SELECT e.* FROM public.assist_time_events e
    WHERE e.tenant_id=p_tenant_id AND e.visit_id=v_source_visit ORDER BY e.occurred_at,e.id
  LOOP
    v_type:=CASE r.event_type WHEN 'drive_start' THEN 'visit_drive_start' WHEN 'drive_end' THEN 'travel_end'
      WHEN 'arrive' THEN 'visit_arrived' WHEN 'arrived_manual' THEN 'visit_arrived' WHEN 'arrived_without_gps' THEN 'visit_arrived'
      WHEN 'service_start' THEN 'visit_started' WHEN 'service_end' THEN 'visit_ended'
      WHEN 'pause_start' THEN 'pause_start' WHEN 'pause_end' THEN 'pause_end' WHEN 'depart' THEN 'visit_ended' ELSE NULL END;
    IF v_type IS NULL THEN CONTINUE; END IF;
    IF r.occurred_at IS NULL OR r.occurred_at>clock_timestamp() THEN
      RAISE EXCEPTION 'WFM: ungültiges Quellereignis.' USING ERRCODE='22023'; END IF;
    IF EXISTS (SELECT 1 FROM public.workforce_time_events e
      WHERE e.tenant_id=p_tenant_id AND e.metadata->>'assist_source_event_id'=r.id::text
        AND (e.employee_id IS DISTINCT FROM v_employee OR e.reference_id IS DISTINCT FROM v_source_visit
          OR e.event_type IS DISTINCT FROM v_type OR e.occurred_at IS DISTINCT FROM r.occurred_at OR e.source<>'assist')) THEN
      RAISE EXCEPTION 'WFM: geändertes Quellereignis benötigt geprüfte Neuabstimmung.' USING ERRCODE='55000';
    END IF;
    v_day:=(r.occurred_at AT TIME ZONE 'Europe/Berlin')::date;
    IF NOT v_day=ANY(v_days) THEN v_days:=array_append(v_days,v_day); END IF;
    INSERT INTO public.workforce_work_sessions(tenant_id,employee_id,user_id,work_date,status,work_mode,display_status,started_at,last_event_at,is_online)
      VALUES(p_tenant_id,v_employee,v_auth_user,v_day,'offline','field','buero',r.occurred_at,r.occurred_at,FALSE)
      ON CONFLICT(tenant_id,employee_id,work_date) DO NOTHING;
    SELECT id INTO STRICT v_session FROM public.workforce_work_sessions
      WHERE tenant_id=p_tenant_id AND employee_id=v_employee AND work_date=v_day FOR UPDATE;
    UPDATE public.workforce_work_sessions SET user_id=v_auth_user,
      started_at=least(COALESCE(started_at,r.occurred_at),r.occurred_at)
      WHERE id=v_session AND tenant_id=p_tenant_id AND employee_id=v_employee;
    -- Adopt an exact legacy mirror once. Distinct pauses at different times
    -- are separate source events, even when their event_type is identical.
    SELECT id INTO v_existing FROM public.workforce_time_events e
      WHERE e.tenant_id=p_tenant_id AND e.employee_id=v_employee AND e.source='assist'
        AND e.reference_id=v_source_visit AND e.event_type=v_type AND e.occurred_at=r.occurred_at
        AND e.metadata->>'assist_source_event_id' IS NULL ORDER BY e.id LIMIT 1 FOR UPDATE;
    IF v_existing IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.workforce_time_events e
      WHERE e.tenant_id=p_tenant_id AND e.metadata->>'assist_source_event_id'=r.id::text) THEN
      UPDATE public.workforce_time_events SET metadata=COALESCE(metadata,'{}')||jsonb_build_object('assist_source_event_id',r.id::text),
        user_id=v_auth_user,session_id=v_session WHERE id=v_existing;
    ELSE
      INSERT INTO public.workforce_time_events(tenant_id,employee_id,user_id,event_type,work_mode,source,occurred_at,session_id,reference_type,reference_id,metadata)
        VALUES(p_tenant_id,v_employee,v_auth_user,v_type,'field','assist',r.occurred_at,v_session,'visit',v_source_visit,jsonb_build_object('assist_source_event_id',r.id::text))
        ON CONFLICT(tenant_id,(metadata->>'assist_source_event_id')) WHERE source='assist' AND metadata->>'assist_source_event_id' IS NOT NULL DO NOTHING
        RETURNING id INTO v_event_id;
      IF v_event_id IS NOT NULL THEN v_inserted:=v_inserted+1; END IF;
    END IF;
  END LOOP;
  FOREACH v_day IN ARRAY v_days LOOP
    SELECT id INTO STRICT v_session FROM public.workforce_work_sessions WHERE tenant_id=p_tenant_id AND employee_id=v_employee AND work_date=v_day;
    PERFORM public.workflow_recalculate_wfm_day(v_session);
  END LOOP;
  RETURN v_inserted;
END $$;
REVOKE ALL ON FUNCTION public.sync_assist_visit_times_to_wfm(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.sync_assist_visit_times_to_wfm(uuid,uuid) TO authenticated,service_role;
COMMIT;
