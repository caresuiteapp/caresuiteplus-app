-- Additive Web RPC: preserve existing RLS and commit start status + event together.
BEGIN;
CREATE OR REPLACE FUNCTION public.web_start_assist_visit_service(
  p_tenant_id UUID,
  p_visit_id UUID,
  p_employee_id UUID,
  p_started_at TIMESTAMPTZ,
  p_justification TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
SET lock_timeout = '5s'
AS $$
DECLARE
  v public.assist_visits%ROWTYPE;
  v_start TIMESTAMPTZ;
  v_arrival TIMESTAMPTZ;
  v_event_id UUID;
  v_event_start TIMESTAMPTZ;
  v_events JSONB;
  v_existing BOOLEAN;
BEGIN
  IF auth.uid() IS NULL OR p_tenant_id IS DISTINCT FROM public.current_tenant_id()
     OR NOT (coalesce(public.is_internal_tenant_actor(p_tenant_id), FALSE)
       OR (coalesce(public.is_employee_portal_rls_context(p_tenant_id), FALSE)
         AND p_employee_id = public.resolve_current_employee_id())) THEN
    RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='Keine Berechtigung für diesen Einsatzstart.';
  END IF;

  -- The visit lock serializes repeated taps. INVOKER retains all table RLS.
  SELECT * INTO v FROM public.assist_visits
  WHERE tenant_id=p_tenant_id AND id=p_visit_id AND employee_id=p_employee_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='Dieser Einsatz ist nicht zugänglich oder nicht zugeordnet.';
  END IF;
  IF v.planning_status IN ('draft','cancelled')
     OR v.canonical_status IN ('completed','cancelled','no_show','finished','documentation_open','signature_open','paused')
     OR v.actual_end_at IS NOT NULL OR v.finished_at IS NOT NULL
     OR EXISTS (SELECT 1 FROM public.assist_visit_execution_state s
       WHERE s.tenant_id=v.tenant_id AND s.visit_id=v.id AND s.finalized_at IS NOT NULL)
     OR EXISTS (SELECT 1 FROM public.assignments a
       WHERE a.tenant_id=v.tenant_id AND a.id=coalesce(v.legacy_assignment_id,v.id)
         AND a.status::text IN ('completed','cancelled','no_show','finished','paused'))
     OR EXISTS (SELECT 1 FROM public.assist_time_events e
       WHERE e.tenant_id=v.tenant_id AND e.visit_id=v.id AND e.event_type='service_end') THEN
    RAISE EXCEPTION USING ERRCODE='P0S02', MESSAGE='Der Einsatz ist beendet, pausiert oder gesperrt. Bitte den aktuellen Status öffnen.';
  END IF;

  SELECT e.id,e.occurred_at INTO v_event_id,v_event_start
  FROM public.assist_time_events e
  WHERE e.tenant_id=v.tenant_id AND e.visit_id=v.id AND e.event_type='service_start'
  ORDER BY e.occurred_at LIMIT 1;
  v_start := coalesce(v_event_start,v.actual_start_at);
  v_existing := v_start IS NOT NULL;
  SELECT max(e.occurred_at) INTO v_arrival FROM public.assist_time_events e
  WHERE e.tenant_id=v.tenant_id AND e.visit_id=v.id
    AND e.event_type IN ('arrive','arrived_manual','arrived_without_gps','drive_end');
  v_arrival := coalesce(v_arrival,v.arrived_at);

  IF NOT v_existing THEN
    IF v.canonical_status='started' OR v.execution_status IN ('in_progress','started') THEN
      RAISE EXCEPTION USING ERRCODE='P0S04', MESSAGE='Für den bereits gestarteten Einsatz fehlt die tatsächliche Anfangszeit. Bitte Zeiten nachtragen oder bearbeiten.';
    END IF;
    IF v_arrival IS NULL OR coalesce(v.canonical_status,'') NOT IN ('arrived','on_the_way') THEN
      RAISE EXCEPTION USING ERRCODE='P0S01', MESSAGE='Bitte zuerst die Ankunft bestätigen.';
    END IF;
    IF p_started_at IS NULL OR NOT isfinite(p_started_at)
       OR p_started_at < clock_timestamp() - INTERVAL '5 minutes'
       OR p_started_at > clock_timestamp() + INTERVAL '30 seconds'
       OR p_started_at < v_arrival THEN
      RAISE EXCEPTION USING ERRCODE='P0S05', MESSAGE='Die Startzeit passt nicht zum aktuellen Einsatz. Bitte Gerätezeit und gespeicherte Ankunft prüfen; vergangene Zeiten über Zeiten nachtragen oder bearbeiten erfassen.';
    END IF;
    v_start := p_started_at;
    IF v.planned_start_at IS NOT NULL
       AND round(abs(extract(epoch FROM (v_start-v.planned_start_at)))/60) > 10
       AND length(btrim(coalesce(p_justification,''))) < 10 THEN
      RAISE EXCEPTION USING ERRCODE='P0S03', MESSAGE='Bitte die Abweichung zur geplanten Startzeit mit mindestens 10 Zeichen begründen.';
    END IF;
  END IF;

  IF v.canonical_status IS DISTINCT FROM 'started'
     OR v.actual_start_at IS DISTINCT FROM v_start
     OR v.execution_status IS DISTINCT FROM 'in_progress' THEN
    UPDATE public.assist_visits SET canonical_status='started',execution_status='in_progress',
      actual_start_at=v_start,updated_at=clock_timestamp()
    WHERE tenant_id=v.tenant_id AND id=v.id AND employee_id=p_employee_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='Der Server hat den Einsatzstart nicht freigegeben.';
    END IF;
  END IF;
  IF v_event_id IS NULL THEN
    INSERT INTO public.assist_time_events(tenant_id,visit_id,event_type,occurred_at,recorded_by,metadata)
    VALUES(v.tenant_id,v.id,'service_start',v_start,public.resolve_current_profile_id(),
      jsonb_build_object('source','web_atomic_service_start','deviation_phase','start',
        'deviation_justification',nullif(btrim(p_justification),'')))
    RETURNING id INTO v_event_id;
  END IF;
  SELECT coalesce(jsonb_agg(jsonb_build_object('eventType',e.event_type,'occurredAt',e.occurred_at)
    ORDER BY e.occurred_at),'[]'::JSONB) INTO v_events
  FROM public.assist_time_events e WHERE e.tenant_id=v.tenant_id AND e.visit_id=v.id;
  RETURN jsonb_build_object('visitId',v.id,'employeeId',v.employee_id,'status','started',
    'startedAt',v_start,'arrivedAt',v_arrival,'eventId',v_event_id,'alreadyStarted',v_existing,'events',v_events);
END;
$$;
REVOKE ALL ON FUNCTION public.web_start_assist_visit_service(UUID,UUID,UUID,TIMESTAMPTZ,TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.web_start_assist_visit_service(UUID,UUID,UUID,TIMESTAMPTZ,TEXT) TO authenticated;
COMMIT;
