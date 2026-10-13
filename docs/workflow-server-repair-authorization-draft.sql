-- REVIEW DRAFT ONLY. No deployment, backfill or productive write performed.
-- Source RPC: workflow-server-write-rpc-metadata-20261011.json.
-- Review/apply together with workflow-server-identity-draft.sql and
-- workflow-server-execution-regression-draft.sql. This replaces the exact
-- existing signature, not a new API. Authenticated staging/JWT/RLS and real
-- PDF completion remain separate release gates.
-- Repair only mirrors existing scoped evidence. It never creates a time event,
-- document, signature, proof, PDF or a new terminal state. Contradictory terminal
-- mirrors need the separately reviewed, version-bound completion/correction RPC.
BEGIN;

DO $$ BEGIN
  IF obj_description('public.guard_assist_execution_state_regression()'::regprocedure,'pg_proc')
      IS DISTINCT FROM 'caresuite:workflow-execution-regression-v1-review' THEN
    RAISE EXCEPTION 'Der geprüfte monotone Execution-Guard muss zuerst vorliegen.';
  END IF;
END; $$;

CREATE OR REPLACE FUNCTION public.repair_assist_visit_workflow_status(
  p_tenant_id uuid, p_assignment_id uuid, p_target_status text,
  p_reason text DEFAULT 'workflow_repair', p_actor_employee_id uuid DEFAULT NULL,
  p_allow_service_without_timestamp boolean DEFAULT false
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE
  a public.assignments%ROWTYPE;
  v public.assist_visits%ROWTYPE;
  s public.assist_visit_execution_state%ROWTYPE;
  actor public.profiles%ROWTYPE;
  v_tenant uuid := public.current_tenant_id();
  v_employee uuid;
  v_employee_portal boolean;
  v_count integer;
  v_drive timestamptz; v_arrived timestamptz; v_started timestamptz; v_ended timestamptz;
  v_pause text;
  v_documented boolean;
  v_target text; v_requested text; v_step text; v_execution text;
  v_assignment_status public.assignment_status;
  v_reason text := COALESCE(NULLIF(trim(p_reason),''),'workflow_repair');
  v_changed boolean;
BEGIN
  IF auth.uid() IS NULL OR v_tenant IS NULL OR p_tenant_id IS DISTINCT FROM v_tenant THEN
    RAISE EXCEPTION 'Anmeldung und aktueller Sitzungsmandant erforderlich.' USING ERRCODE='42501';
  END IF;
  IF p_assignment_id IS NULL OR p_target_status IS NULL OR length(v_reason)>1000
      OR COALESCE(p_allow_service_without_timestamp,false) THEN
    RAISE EXCEPTION 'Reparatur benötigt einen Einsatz und vorhandene Zeitbelege; Zeitkorrektur separat prüfen.' USING ERRCODE='22023';
  END IF;
  IF obj_description('public.guard_assist_execution_state_regression()'::regprocedure,'pg_proc')
      IS DISTINCT FROM 'caresuite:workflow-execution-regression-v1-review'
      OR NOT EXISTS(SELECT 1 FROM pg_catalog.pg_trigger
        WHERE tgrelid='public.assist_visit_execution_state'::regclass
          AND tgfoid='public.guard_assist_execution_state_regression()'::regprocedure
          AND tgenabled IN ('O','A') AND NOT tgisinternal) THEN
    RAISE EXCEPTION 'Der geprüfte monotone Execution-Guard ist nicht aktiv.' USING ERRCODE='55000';
  END IF;
  BEGIN
    SELECT * INTO STRICT actor FROM public.profiles p
      WHERE p.tenant_id=v_tenant AND p.status::text='active' AND p.is_active
        AND (p.auth_user_id=auth.uid() OR (p.auth_user_id IS NULL AND p.id=auth.uid()))
        AND NOT EXISTS(SELECT 1 FROM public.tenant_users u
          WHERE u.tenant_id=p.tenant_id AND u.auth_user_id=auth.uid()
            AND (u.status::text<>'active' OR u.must_change_password OR NOT u.first_login_completed))
      FOR SHARE;
  EXCEPTION WHEN NO_DATA_FOUND OR TOO_MANY_ROWS THEN
    RAISE EXCEPTION 'Ein eindeutig zugeordnetes aktives Authprofil ist erforderlich.' USING ERRCODE='42501';
  END;
  v_employee_portal := COALESCE(public.current_portal_type()='employee',false);
  IF v_employee_portal THEN
    v_employee := public.resolve_current_employee_id();
    PERFORM 1 FROM public.employee_portal_accounts e
      WHERE e.id=public.current_portal_account_id() AND e.tenant_id=v_tenant
        AND e.auth_user_id=auth.uid() AND e.employee_id=v_employee AND e.status::text='active'
        AND NOT e.must_change_password AND e.first_login_completed
      FOR SHARE;
    IF NOT FOUND OR v_employee IS NULL OR NOT EXISTS(SELECT 1 FROM public.employees e
      WHERE e.tenant_id=v_tenant AND e.id=v_employee AND e.deleted_at IS NULL AND e.portal_enabled) THEN
      RAISE EXCEPTION 'Aktives eigenes Mitarbeitendenkonto erforderlich.' USING ERRCODE='42501';
    END IF;
  ELSIF COALESCE(public.current_portal_type(),'business')<>'business'
      OR NOT COALESCE(public.is_internal_tenant_actor(v_tenant),false)
      OR NOT (COALESCE(public.has_permission('assist.execution.manage'),false)
        OR COALESCE(public.is_tenant_admin(),false)) THEN
    RAISE EXCEPTION 'Keine Berechtigung zur Einsatzreparatur.' USING ERRCODE='42501';
  END IF;

  SELECT * INTO a FROM public.assignments WHERE tenant_id=v_tenant AND id=p_assignment_id FOR UPDATE;
  IF NOT FOUND OR (v_employee_portal AND a.employee_id IS DISTINCT FROM v_employee)
      OR (p_actor_employee_id IS NOT NULL AND p_actor_employee_id IS DISTINCT FROM
        CASE WHEN v_employee_portal THEN v_employee ELSE a.employee_id END) THEN
    RAISE EXCEPTION 'Einsatz oder Mitarbeiter ist nicht Ihnen zugeordnet.' USING ERRCODE='42501';
  END IF;
  -- Never arbitrarily pick the latest recurrence or mutate every linked Visit.
  SELECT count(*) INTO v_count FROM public.assist_visits av
    WHERE av.tenant_id=v_tenant AND (av.id=a.id OR av.legacy_assignment_id=a.id);
  IF v_count<>1 THEN RAISE EXCEPTION 'Die kanonische Visitzuordnung ist nicht eindeutig.' USING ERRCODE='55000'; END IF;
  SELECT * INTO v FROM public.assist_visits av
    WHERE av.tenant_id=v_tenant AND (av.id=a.id OR av.legacy_assignment_id=a.id) FOR UPDATE;
  IF v.employee_id IS DISTINCT FROM a.employee_id OR v.client_id IS DISTINCT FROM a.client_id
      OR (v_employee_portal AND v.employee_id IS DISTINCT FROM v_employee) THEN
    RAISE EXCEPTION 'Die kanonische Einsatzzuordnung stimmt nicht überein.' USING ERRCODE='42501';
  END IF;
  SELECT * INTO s FROM public.assist_visit_execution_state WHERE tenant_id=v_tenant AND visit_id=v.id FOR UPDATE;

  v_requested := CASE lower(trim(p_target_status))
    WHEN 'geplant' THEN 'planned' WHEN 'bestaetigt' THEN 'confirmed'
    WHEN 'unterwegs' THEN 'on_the_way' WHEN 'en_route' THEN 'on_the_way' WHEN 'angekommen' THEN 'arrived'
    WHEN 'gestartet' THEN 'started' WHEN 'in_service' THEN 'started' WHEN 'in_progress' THEN 'started'
    WHEN 'pausiert' THEN 'paused' WHEN 'beendet' THEN 'finished'
    WHEN 'dokumentation_offen' THEN 'documentation_pending' WHEN 'documentation_open' THEN 'documentation_pending'
    WHEN 'unterschrift_offen' THEN 'signature_pending' WHEN 'signature_open' THEN 'signature_pending'
    WHEN 'abgeschlossen' THEN 'completed' WHEN 'storniert' THEN 'cancelled' WHEN 'nicht_erschienen' THEN 'no_show'
    ELSE lower(trim(p_target_status)) END;
  IF a.status::text IN ('completed','cancelled','no_show')
      OR v.canonical_status::text IN ('completed','cancelled','no_show')
      OR s.assignment_status IN ('abgeschlossen','storniert','nicht_erschienen') OR s.finalized_at IS NOT NULL THEN
    IF a.status::text=v.canonical_status::text AND v_requested=v.canonical_status::text
      AND s.assignment_status=(CASE v_requested WHEN 'completed' THEN 'abgeschlossen'
        WHEN 'cancelled' THEN 'storniert' WHEN 'no_show' THEN 'nicht_erschienen' END) THEN RETURN; END IF;
    RAISE EXCEPTION 'Terminale Einsatzfassung bleibt gesperrt; beleggebundene Abschluss-/PDFkorrektur erforderlich.' USING ERRCODE='55000';
  END IF;

  SELECT min(occurred_at) FILTER(WHERE event_type::text='drive_start'),
    min(occurred_at) FILTER(WHERE event_type::text='arrive'),
    min(occurred_at) FILTER(WHERE event_type::text='service_start'),
    max(occurred_at) FILTER(WHERE event_type::text='service_end')
    INTO v_drive,v_arrived,v_started,v_ended FROM public.assist_time_events
    WHERE tenant_id=v_tenant AND visit_id=v.id;
  v_drive:=COALESCE(v.on_the_way_at,v_drive); v_arrived:=COALESCE(v.arrived_at,v_arrived);
  v_started:=COALESCE(v.actual_start_at,v_started); v_ended:=COALESCE(v.actual_end_at,v_ended);
  IF (v_ended IS NOT NULL AND (v_started IS NULL OR v_ended<v_started))
      OR (v_arrived IS NOT NULL AND v_drive IS NOT NULL AND v_arrived<v_drive)
      OR GREATEST(v_drive,v_arrived,v_started,v_ended)>clock_timestamp() THEN
    RAISE EXCEPTION 'Die tatsächlichen Zeitbelege sind widersprüchlich.' USING ERRCODE='55000';
  END IF;
  SELECT event_type::text INTO v_pause FROM public.assist_time_events
    WHERE tenant_id=v_tenant AND visit_id=v.id
      AND event_type::text IN ('pause_start','pause_end') AND occurred_at>=v_started
      AND occurred_at<=clock_timestamp()
    ORDER BY occurred_at DESC, CASE event_type::text WHEN 'pause_end' THEN 0 ELSE 1 END LIMIT 1;
  SELECT EXISTS(SELECT 1 FROM public.assist_visit_documentation d
    WHERE d.tenant_id=v_tenant AND d.visit_id=v.id AND d.submitted_at IS NOT NULL
      AND NULLIF(trim(d.short_description),'') IS NOT NULL) INTO v_documented;
  v_target := CASE
    WHEN v_ended IS NOT NULL AND v_documented THEN 'signature_pending'
    WHEN v_ended IS NOT NULL AND v.canonical_status::text IN ('documentation_pending','documentation_open') THEN 'documentation_pending'
    WHEN v_ended IS NOT NULL THEN 'finished'
    WHEN v_started IS NOT NULL AND v_pause='pause_start' THEN 'paused'
    WHEN v_started IS NOT NULL THEN 'started'
    WHEN v_arrived IS NOT NULL THEN 'arrived'
    WHEN v_drive IS NOT NULL THEN 'on_the_way'
    WHEN v.canonical_status::text='confirmed' THEN 'confirmed' ELSE 'planned' END;
  IF v_requested IS DISTINCT FROM v_target THEN
    RAISE EXCEPTION 'Der gewünschte Status ist nicht durch die aktuelle Einsatzfassung belegt.' USING ERRCODE='55000';
  END IF;
  v_assignment_status := CASE v_target WHEN 'documentation_pending' THEN 'documentation_open'::public.assignment_status
    WHEN 'signature_pending' THEN 'signature_open'::public.assignment_status ELSE v_target::public.assignment_status END;
  v_step := CASE v_target WHEN 'on_the_way' THEN 'en_route' WHEN 'arrived' THEN 'arrived'
    WHEN 'started' THEN 'in_service' WHEN 'paused' THEN 'paused'
    WHEN 'finished' THEN 'documentation' WHEN 'documentation_pending' THEN 'documentation'
    WHEN 'signature_pending' THEN 'signature' ELSE 'consent' END;
  v_execution := CASE v_target WHEN 'on_the_way' THEN 'on_way' WHEN 'arrived' THEN 'arrived'
    WHEN 'started' THEN 'in_progress' WHEN 'paused' THEN 'paused'
    WHEN 'finished' THEN 'completed' WHEN 'documentation_pending' THEN 'completed'
    WHEN 'signature_pending' THEN 'completed' ELSE 'pending' END;
  v_changed := a.status IS DISTINCT FROM v_assignment_status OR v.canonical_status::text IS DISTINCT FROM v_target
    OR v.execution_status::text IS DISTINCT FROM v_execution OR s.current_step IS DISTINCT FROM v_step
    OR s.workflow_consistency_status IS DISTINCT FROM 'consistent'
    OR s.travel_started_at IS DISTINCT FROM v_drive OR s.travel_ended_at IS DISTINCT FROM v_arrived
    OR s.service_started_at IS DISTINCT FROM v_started OR s.service_ended_at IS DISTINCT FROM v_ended;
  IF NOT v_changed THEN RETURN; END IF;
  UPDATE public.assignments SET status=v_assignment_status,updated_by=actor.id,updated_at=clock_timestamp()
    WHERE tenant_id=v_tenant AND id=a.id;
  UPDATE public.assist_visits SET canonical_status=v_target,execution_status=v_execution,
    on_the_way_at=v_drive,arrived_at=v_arrived,actual_start_at=v_started,actual_end_at=v_ended,
    updated_by=actor.id,updated_at=clock_timestamp() WHERE tenant_id=v_tenant AND id=v.id;
  INSERT INTO public.assist_visit_execution_state(tenant_id,visit_id,current_step,assignment_status,
    travel_started_at,travel_ended_at,service_started_at,service_ended_at,
    workflow_consistency_status,last_auto_repair_at,last_repair_reason,updated_at)
  VALUES(v_tenant,v.id,v_step,CASE v_target WHEN 'planned' THEN 'geplant' WHEN 'confirmed' THEN 'bestaetigt'
    WHEN 'on_the_way' THEN 'unterwegs' WHEN 'arrived' THEN 'angekommen' WHEN 'started' THEN 'gestartet'
    WHEN 'paused' THEN 'pausiert' WHEN 'finished' THEN 'beendet' WHEN 'documentation_pending' THEN 'dokumentation_offen'
    ELSE 'unterschrift_offen' END,v_drive,v_arrived,v_started,v_ended,'consistent',clock_timestamp(),v_reason,clock_timestamp())
  ON CONFLICT(tenant_id,visit_id) DO UPDATE SET current_step=EXCLUDED.current_step,assignment_status=EXCLUDED.assignment_status,
    travel_started_at=EXCLUDED.travel_started_at,travel_ended_at=EXCLUDED.travel_ended_at,
    service_started_at=EXCLUDED.service_started_at,service_ended_at=EXCLUDED.service_ended_at,
    workflow_consistency_status=EXCLUDED.workflow_consistency_status,
    last_auto_repair_at=EXCLUDED.last_auto_repair_at,last_repair_reason=EXCLUDED.last_repair_reason;
  INSERT INTO public.assignment_audit_events(tenant_id,assignment_id,action,actor_profile_id,actor_name,
    from_status,to_status,details,created_at)
  VALUES(v_tenant,a.id,'workflow_repair',actor.id,COALESCE(NULLIF(trim(actor.display_name),''),NULLIF(trim(actor.full_name),''),'Portal'),
    a.status::text,v_assignment_status::text,v_reason,clock_timestamp());
END;
$$;

REVOKE ALL ON FUNCTION public.repair_assist_visit_workflow_status(uuid,uuid,text,text,uuid,boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.repair_assist_visit_workflow_status(uuid,uuid,text,text,uuid,boolean) TO authenticated;
COMMIT;
