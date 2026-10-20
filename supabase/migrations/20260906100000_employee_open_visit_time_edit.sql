-- Own open visits only. Existing booking reconciliation is reused without granting admin access.
BEGIN;
CREATE OR REPLACE FUNCTION public.employee_portal_correct_open_visit_times(
  p_visit_id UUID,
  p_on_the_way_at TIMESTAMPTZ,
  p_arrived_at TIMESTAMPTZ,
  p_started_at TIMESTAMPTZ,
  p_ended_at TIMESTAMPTZ,
  p_pause_minutes INTEGER,
  p_travel_minutes INTEGER,
  p_reason TEXT,
  p_confirm_overlap BOOLEAN DEFAULT FALSE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v public.assist_visits%ROWTYPE;
  v_old JSONB;
  v_overlap INTEGER := 0;
  v_net INTEGER;
  v_profile_id UUID;
  v_auth_user_id UUID;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_employee_portal_rls_context(public.current_tenant_id())
     OR public.resolve_current_employee_id() IS NULL THEN
    RAISE EXCEPTION 'Mitarbeitendenanmeldung erforderlich.';
  END IF;

  IF length(trim(coalesce(p_reason, ''))) = 0 THEN
    RAISE EXCEPTION 'Begründung ist erforderlich';
  END IF;

  SELECT *
  INTO v
  FROM public.assist_visits
  WHERE id = p_visit_id
    AND tenant_id = public.current_tenant_id()
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Einsatz nicht gefunden';
  END IF;

  IF v.employee_id IS DISTINCT FROM public.resolve_current_employee_id() THEN
    RAISE EXCEPTION 'Dieser Einsatz ist Ihnen nicht zugeordnet.';
  END IF;
  PERFORM 1 FROM public.assist_visit_execution_state
    WHERE tenant_id = v.tenant_id AND visit_id = v.id FOR UPDATE;
  IF v.canonical_status IN ('completed','cancelled','no_show')
     OR v.planning_status IN ('cancelled','draft')
     OR EXISTS (SELECT 1 FROM public.assist_visit_execution_state es
       WHERE es.tenant_id=v.tenant_id AND es.visit_id=v.id AND es.finalized_at IS NOT NULL)
     OR EXISTS (SELECT 1 FROM public.assignments a
       WHERE a.tenant_id=v.tenant_id AND a.id=v.legacy_assignment_id
         AND a.status::text IN ('completed','cancelled','no_show')) THEN
    RAISE EXCEPTION 'Dieser Einsatz ist bereits abgeschlossen oder nicht zur Bearbeitung freigegeben.';
  END IF;


  IF p_started_at IS NULL
     OR p_ended_at IS NULL
     OR NOT isfinite(p_started_at) OR NOT isfinite(p_ended_at)
     OR (p_on_the_way_at IS NOT NULL AND (NOT isfinite(p_on_the_way_at) OR p_on_the_way_at > p_started_at))
     OR (p_arrived_at IS NOT NULL AND NOT isfinite(p_arrived_at))
     OR p_started_at >= p_ended_at
     OR coalesce(p_pause_minutes, 0) < 0
     OR coalesce(p_travel_minutes, 0) < 0
     OR (
       p_on_the_way_at IS NOT NULL
       AND p_arrived_at IS NOT NULL
       AND p_on_the_way_at > p_arrived_at
     )
     OR (
       p_arrived_at IS NOT NULL
       AND p_arrived_at > p_started_at
     ) THEN
    RAISE EXCEPTION 'Ungültige Zeitfolge';
  END IF;

  v_net :=
    floor(extract(epoch FROM (p_ended_at - p_started_at)) / 60)::INTEGER
    - coalesce(p_pause_minutes, 0);

  IF v_net <= 0 THEN
    RAISE EXCEPTION 'Pausen überschreiten die Einsatzdauer';
  END IF;

  SELECT count(*)
  INTO v_overlap
  FROM public.assist_visits x
  WHERE x.tenant_id = v.tenant_id
    AND x.employee_id = v.employee_id
    AND x.id <> v.id
    AND coalesce(x.actual_start_at, x.planned_start_at) < p_ended_at
    AND coalesce(x.actual_end_at, x.planned_end_at) > p_started_at
    AND x.execution_status NOT IN ('cancelled', 'no_show');

  IF v_overlap > 0 AND NOT p_confirm_overlap THEN
    RETURN jsonb_build_object(
      'ok', FALSE,
      'overlap', TRUE,
      'count', v_overlap
    );
  END IF;

  v_old := to_jsonb(v) || jsonb_build_object('time_events',
    (SELECT coalesce(jsonb_agg(to_jsonb(e)), '[]'::jsonb) FROM public.assist_time_events e
      WHERE e.tenant_id=v.tenant_id AND e.visit_id=v.id),
    'workforce_events',(SELECT coalesce(jsonb_agg(to_jsonb(w)), '[]'::jsonb)
      FROM public.workforce_time_events w WHERE w.tenant_id=v.tenant_id
      AND w.employee_id=v.employee_id AND w.reference_type='visit' AND w.reference_id=v.id));
  v_profile_id := public.resolve_current_profile_id();

  SELECT coalesce(epa.auth_user_id, p.auth_user_id)
  INTO v_auth_user_id
  FROM public.employees employee
  LEFT JOIN public.employee_portal_accounts epa
    ON epa.tenant_id = employee.tenant_id
   AND epa.employee_id = employee.id
   AND epa.status = 'active'
  LEFT JOIN public.profiles p
    ON p.id = employee.profile_id
  WHERE employee.tenant_id = v.tenant_id
    AND employee.id = v.employee_id
  LIMIT 1;

  v_auth_user_id := coalesce(v_auth_user_id, auth.uid());

  -- Keep the signed evidence; changing times invalidates its use for the next completion.
  UPDATE public.assist_visit_signatures SET is_valid=FALSE, invalidated_at=now(),
    invalidation_reason='Zeiten vom Mitarbeitenden vor Abschluss korrigiert: ' || trim(p_reason), updated_at=now()
    WHERE tenant_id=v.tenant_id AND visit_id=v.id AND is_valid;
  UPDATE public.assist_visit_proofs SET signature_id=NULL, portal_release_status='none',
    portal_visible=FALSE, updated_at=now() WHERE tenant_id=v.tenant_id AND visit_id=v.id;

  UPDATE public.assist_visits
  SET
    canonical_status = 'finished',
    execution_status = 'completed',
    is_incomplete = TRUE,
    proof_status = 'pending',
    on_the_way_at = p_on_the_way_at,
    arrived_at = p_arrived_at,
    actual_start_at = p_started_at,
    actual_end_at = p_ended_at,
    finished_at = p_ended_at,
    duration_minutes = v_net,
    updated_by = v_profile_id,
    updated_at = NOW()
  WHERE id = v.id
    AND tenant_id = v.tenant_id;

  DELETE FROM public.assist_time_events
  WHERE tenant_id = v.tenant_id
    AND visit_id = v.id
    AND event_type IN ('drive_start','drive_end','arrive','arrived_manual','arrived_without_gps','service_start','service_end');

  INSERT INTO public.assist_time_events (
    tenant_id,
    visit_id,
    event_type,
    occurred_at,
    recorded_by,
    metadata
  )
  SELECT
    v.tenant_id,
    v.id,
    e.event_type,
    e.occurred_at,
    v_profile_id,
    jsonb_build_object(
      'source', 'administrative_follow_up',
      'reason', trim(p_reason),
      'actor_kind', 'employee_open_visit_edit',
      'corrected_at', NOW()
    )
  FROM (
    VALUES
      ('drive_start'::TEXT, p_on_the_way_at),
      ('arrive'::TEXT, p_arrived_at),
      ('service_start'::TEXT, p_started_at),
      ('service_end'::TEXT, p_ended_at)
  ) AS e(event_type, occurred_at)
  WHERE e.occurred_at IS NOT NULL;

  DELETE FROM public.assist_time_events WHERE tenant_id=v.tenant_id AND visit_id=v.id
    AND event_type IN ('pause_start','pause_end');
  IF coalesce(p_pause_minutes,0) > 0 THEN
    INSERT INTO public.assist_time_events(tenant_id,visit_id,event_type,occurred_at,recorded_by,metadata)
    VALUES
      (v.tenant_id,v.id,'pause_start',p_started_at,v_profile_id,jsonb_build_object('source','employee_open_visit_edit','reason',trim(p_reason))),
      (v.tenant_id,v.id,'pause_end',p_started_at+make_interval(mins=>p_pause_minutes),v_profile_id,jsonb_build_object('source','employee_open_visit_edit','reason',trim(p_reason)));
  END IF;
  INSERT INTO public.assist_visit_execution_state(tenant_id,visit_id,current_step,assignment_status,
    travel_started_at,travel_ended_at,service_started_at,service_ended_at,signature_complete,proof_generated,updated_at)
  VALUES(v.tenant_id,v.id,'documentation','beendet',p_on_the_way_at,p_arrived_at,p_started_at,p_ended_at,FALSE,FALSE,now())
  ON CONFLICT(tenant_id,visit_id) DO UPDATE SET current_step='documentation',assignment_status='beendet',
    travel_started_at=excluded.travel_started_at,travel_ended_at=excluded.travel_ended_at,
    service_started_at=excluded.service_started_at,service_ended_at=excluded.service_ended_at,
    signature_complete=FALSE,proof_generated=FALSE,updated_at=now();

  UPDATE public.assignments SET status='finished',actual_start_at=p_started_at,actual_end_at=p_ended_at,
    on_the_way_at=p_on_the_way_at,arrived_at=p_arrived_at,finished_at=p_ended_at,updated_at=now()
    WHERE tenant_id=v.tenant_id AND (id=v.id OR id=v.legacy_assignment_id);

  -- Bereits vorhandene WFM-Ereignisse müssen auf die korrigierten Zeiten
  -- verschoben werden. Der ältere Sync war nur insert-idempotent und ließ
  -- vorhandene, aber falsche Zeitstempel unverändert.
  DELETE FROM public.workforce_time_events WHERE tenant_id=v.tenant_id AND employee_id=v.employee_id
    AND reference_type='visit' AND reference_id=v.id
    AND ((event_type='visit_drive_start' AND p_on_the_way_at IS NULL)
      OR (event_type='visit_arrived' AND p_arrived_at IS NULL));

  UPDATE public.workforce_time_events
  SET
    occurred_at = CASE event_type
      WHEN 'visit_drive_start' THEN coalesce(p_on_the_way_at, occurred_at)
      WHEN 'visit_arrived' THEN coalesce(p_arrived_at, occurred_at)
      WHEN 'visit_started' THEN p_started_at
      WHEN 'visit_ended' THEN p_ended_at
      ELSE occurred_at
    END,
    note = trim(p_reason),
    metadata = coalesce(metadata, '{}'::JSONB)
      || jsonb_build_object(
        'source', 'administrative_follow_up',
        'pause_minutes', coalesce(p_pause_minutes, 0),
        'travel_minutes', coalesce(p_travel_minutes, 0),
        'net_minutes', v_net
      )
  WHERE tenant_id = v.tenant_id
    AND employee_id = v.employee_id
    AND reference_type = 'visit'
    AND reference_id = v.id
    AND event_type IN (
      'visit_drive_start',
      'visit_arrived',
      'visit_started',
      'visit_ended'
    );

  INSERT INTO public.workforce_time_events (
    tenant_id,
    employee_id,
    user_id,
    event_type,
    work_mode,
    source,
    occurred_at,
    reference_type,
    reference_id,
    note,
    metadata,
    created_by
  )
  SELECT
    v.tenant_id,
    v.employee_id,
    v_auth_user_id,
    e.event_type,
    'field',
    'assist',
    e.occurred_at,
    'visit',
    v.id,
    trim(p_reason),
    jsonb_build_object(
      'source', 'administrative_follow_up',
      'pause_minutes', coalesce(p_pause_minutes, 0),
      'travel_minutes', coalesce(p_travel_minutes, 0),
      'net_minutes', v_net
    ),
    auth.uid()
  FROM (
    VALUES
      ('visit_drive_start'::TEXT, p_on_the_way_at),
      ('visit_arrived'::TEXT, p_arrived_at),
      ('visit_started'::TEXT, p_started_at),
      ('visit_ended'::TEXT, p_ended_at)
  ) AS e(event_type, occurred_at)
  WHERE e.occurred_at IS NOT NULL
    AND NOT EXISTS (
      SELECT 1
      FROM public.workforce_time_events existing
      WHERE existing.tenant_id = v.tenant_id
        AND existing.employee_id = v.employee_id
        AND existing.reference_type = 'visit'
        AND existing.reference_id = v.id
        AND existing.event_type = e.event_type
    );

  INSERT INTO public.workforce_time_events (
    tenant_id,
    employee_id,
    user_id,
    event_type,
    work_mode,
    source,
    occurred_at,
    reference_type,
    reference_id,
    note,
    metadata,
    created_by
  )
  VALUES (
    v.tenant_id,
    v.employee_id,
    auth.uid(),
    'correction',
    'field',
    'correction',
    NOW(),
    'visit',
    v.id,
    trim(p_reason),
    jsonb_build_object(
      'source', 'administrative_follow_up',
      'actual_start_at', p_started_at,
      'actual_end_at', p_ended_at,
      'pause_minutes', coalesce(p_pause_minutes, 0),
      'travel_minutes', coalesce(p_travel_minutes, 0),
      'net_minutes', v_net
    ),
    auth.uid()
  );

  INSERT INTO public.assist_visit_admin_audit (
    tenant_id,
    visit_id,
    action,
    previous_value,
    new_value,
    reason
  )
  VALUES (
    v.tenant_id,
    v.id,
    'times_corrected',
    v_old,
    jsonb_build_object(
      'on_the_way_at', p_on_the_way_at,
      'arrived_at', p_arrived_at,
      'actual_start_at', p_started_at,
      'actual_end_at', p_ended_at,
      'pause_minutes', coalesce(p_pause_minutes, 0),
      'travel_minutes', coalesce(p_travel_minutes, 0),
      'net_minutes', v_net,
      'actor_kind', 'employee_open_visit_edit',
      'overlap_confirmed', v_overlap > 0
    ),
    trim(p_reason)
  );

  RETURN jsonb_build_object(
    'ok', TRUE,
    'overlap', FALSE,
    'net_minutes', v_net,
    'overlap_confirmed', v_overlap > 0
  );
END;
$$;

REVOKE ALL ON FUNCTION public.employee_portal_correct_open_visit_times(uuid,timestamptz,timestamptz,timestamptz,timestamptz,integer,integer,text,boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.employee_portal_correct_open_visit_times(uuid,timestamptz,timestamptz,timestamptz,timestamptz,integer,integer,text,boolean) TO authenticated;
-- A resubmitted documentation remains editable while the visit is open. Its old
-- signature is evidence for the old content and must not authorize a new proof.
CREATE OR REPLACE FUNCTION public.guard_employee_open_visit_documentation()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v public.assist_visits%ROWTYPE;
BEGIN
  IF TG_OP = 'UPDATE' AND (NEW.tenant_id IS DISTINCT FROM OLD.tenant_id
      OR NEW.visit_id IS DISTINCT FROM OLD.visit_id OR NEW.id IS DISTINCT FROM OLD.id) THEN
    IF public.is_employee_portal_rls_context(OLD.tenant_id) THEN
      RAISE EXCEPTION 'Die Dokumentation darf keinem anderen Einsatz zugeordnet werden.';
    END IF;
  END IF;
  IF NOT public.is_employee_portal_rls_context(NEW.tenant_id) THEN RETURN NEW; END IF;
  -- A pure lock/metadata update is not a new employee submission.
  IF TG_OP = 'UPDATE' AND
    (to_jsonb(NEW)-ARRAY['updated_at','locked','metadata']) IS NOT DISTINCT FROM
    (to_jsonb(OLD)-ARRAY['updated_at','locked','metadata']) THEN RETURN NEW; END IF;
  SELECT * INTO v FROM public.assist_visits WHERE id=NEW.visit_id
    AND tenant_id=NEW.tenant_id AND tenant_id=public.current_tenant_id() FOR UPDATE;
  IF NOT FOUND OR v.employee_id IS DISTINCT FROM public.resolve_current_employee_id() THEN
    RAISE EXCEPTION 'Dieser Einsatz ist Ihnen nicht zugeordnet.';
  END IF;
  IF v.canonical_status IN ('completed','cancelled','no_show') OR v.planning_status IN ('cancelled','draft')
    OR EXISTS (SELECT 1 FROM public.assist_visit_execution_state es WHERE es.tenant_id=v.tenant_id
      AND es.visit_id=v.id AND es.finalized_at IS NOT NULL)
    OR EXISTS (SELECT 1 FROM public.assignments a WHERE a.tenant_id=v.tenant_id
      AND a.id=v.legacy_assignment_id AND a.status::text IN ('completed','cancelled','no_show')) THEN
    RAISE EXCEPTION 'Dieser Einsatz ist bereits abgeschlossen oder nicht zur Bearbeitung freigegeben.';
  END IF;
  UPDATE public.assist_visit_signatures SET is_valid=FALSE,invalidated_at=now(),
    invalidation_reason='Dokumentation vor Einsatzabschluss erneut gespeichert.',updated_at=now()
    WHERE tenant_id=v.tenant_id AND visit_id=v.id AND is_valid;
  UPDATE public.assist_visit_proofs SET signature_id=NULL,portal_visible=FALSE,
    portal_release_status='none',updated_at=now() WHERE tenant_id=v.tenant_id AND visit_id=v.id;
  UPDATE public.assist_visit_execution_state SET signature_complete=FALSE,proof_generated=FALSE,updated_at=now()
    WHERE tenant_id=v.tenant_id AND visit_id=v.id;
  IF TG_OP='UPDATE' THEN
    INSERT INTO public.assist_visit_admin_audit(tenant_id,visit_id,action,previous_value,new_value,reason)
    VALUES(v.tenant_id,v.id,'documentation_updated',to_jsonb(OLD),
      to_jsonb(NEW)||jsonb_build_object('actor_kind','employee_open_visit_edit'),
      'Dokumentation vom Mitarbeitenden vor Abschluss erneut gespeichert.');
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS guard_employee_open_visit_documentation ON public.assist_visit_documentation;
CREATE TRIGGER guard_employee_open_visit_documentation BEFORE INSERT OR UPDATE ON public.assist_visit_documentation
FOR EACH ROW EXECUTE FUNCTION public.guard_employee_open_visit_documentation();
NOTIFY pgrst, 'reload schema';
COMMIT;
