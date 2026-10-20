-- CareSuite+ 0255 — administrative Nachbearbeitung fälliger Assist-Einsätze.
-- Additiv und transaktional: assist_visits/assist_time_events bleiben Assist-SSOT,
-- sync_assist_visit_times_to_wfm spiegelt idempotent in die vorhandenen workforce_*-Tabellen.

CREATE TABLE IF NOT EXISTS public.assist_visit_admin_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  visit_id uuid NOT NULL REFERENCES public.assist_visits(id) ON DELETE CASCADE,
  action text NOT NULL,
  previous_value jsonb,
  new_value jsonb,
  reason text NOT NULL CHECK (length(trim(reason)) > 0),
  actor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS assist_visit_admin_audit_visit_idx
  ON public.assist_visit_admin_audit(tenant_id, visit_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.assist_visit_signature_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  visit_id uuid NOT NULL REFERENCES public.assist_visits(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  proof_id uuid REFERENCES public.assist_visit_proofs(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','signed','revoked','expired')),
  service_date date NOT NULL,
  service_name text NOT NULL,
  planned_start_at timestamptz NOT NULL,
  planned_end_at timestamptz NOT NULL,
  actual_start_at timestamptz,
  actual_end_at timestamptz,
  proof_preview jsonb NOT NULL DEFAULT '{}'::jsonb,
  requested_by uuid REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT auth.uid(),
  requested_at timestamptz NOT NULL DEFAULT now(),
  signed_by_profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  signed_at timestamptz,
  signature_id uuid REFERENCES public.assist_visit_signatures(id) ON DELETE SET NULL,
  revoked_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  revoked_at timestamptz,
  revocation_reason text
);
CREATE UNIQUE INDEX IF NOT EXISTS assist_visit_signature_requests_one_open
  ON public.assist_visit_signature_requests(tenant_id, visit_id) WHERE status = 'open';

ALTER TABLE public.assist_visit_admin_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assist_visit_signature_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS assist_admin_audit_office ON public.assist_visit_admin_audit;
CREATE POLICY assist_admin_audit_office ON public.assist_visit_admin_audit FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id() AND
    (public.has_permission('assist.execution.view') OR public.has_permission('time.audit.view')));
DROP POLICY IF EXISTS signature_requests_office_select ON public.assist_visit_signature_requests;
CREATE POLICY signature_requests_office_select ON public.assist_visit_signature_requests FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id() AND public.has_permission('assist.execution.view'));
DROP POLICY IF EXISTS signature_requests_client_select ON public.assist_visit_signature_requests;
CREATE POLICY signature_requests_client_select ON public.assist_visit_signature_requests FOR SELECT TO authenticated
  USING (status = 'open' AND tenant_id = public.current_tenant_id()
    AND client_id = public.current_client_id() AND public.current_client_id() IS NOT NULL);

REVOKE ALL ON public.assist_visit_admin_audit, public.assist_visit_signature_requests FROM PUBLIC, anon;
GRANT SELECT ON public.assist_visit_admin_audit, public.assist_visit_signature_requests TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_correct_assist_visit_times(
  p_visit_id uuid, p_on_the_way_at timestamptz, p_arrived_at timestamptz,
  p_started_at timestamptz, p_ended_at timestamptz, p_pause_minutes integer,
  p_travel_minutes integer, p_reason text, p_confirm_overlap boolean DEFAULT false
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v public.assist_visits%ROWTYPE; v_old jsonb; v_overlap integer; v_net integer;
BEGIN
  IF NOT (public.has_permission('assist.execution.manage') AND public.has_permission('time.tracking.admin.correct')) THEN
    RAISE EXCEPTION 'Keine Berechtigung für administrative Zeitkorrekturen';
  END IF;
  IF length(trim(coalesce(p_reason,''))) = 0 THEN RAISE EXCEPTION 'Begründung ist erforderlich'; END IF;
  SELECT * INTO v FROM public.assist_visits
   WHERE id = p_visit_id AND tenant_id = public.current_tenant_id() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Einsatz nicht gefunden'; END IF;
  IF v.employee_id IS NULL THEN RAISE EXCEPTION 'Mitarbeitenden-Zuordnung fehlt'; END IF;
  IF p_started_at IS NULL OR p_ended_at IS NULL OR p_started_at >= p_ended_at
    OR coalesce(p_pause_minutes, 0) < 0 OR coalesce(p_travel_minutes, 0) < 0
    OR (p_on_the_way_at IS NOT NULL AND p_arrived_at IS NOT NULL AND p_on_the_way_at > p_arrived_at)
    OR (p_arrived_at IS NOT NULL AND p_arrived_at > p_started_at) THEN
    RAISE EXCEPTION 'Ungültige Zeitfolge';
  END IF;
  v_net := floor(extract(epoch FROM (p_ended_at - p_started_at)) / 60)::integer - coalesce(p_pause_minutes, 0);
  IF v_net < 0 THEN RAISE EXCEPTION 'Pausen überschreiten die Einsatzdauer'; END IF;
  SELECT count(*) INTO v_overlap FROM public.assist_visits x
   WHERE x.tenant_id = v.tenant_id AND x.employee_id = v.employee_id AND x.id <> v.id
     AND coalesce(x.actual_start_at,x.planned_start_at) < p_ended_at
     AND coalesce(x.actual_end_at,x.planned_end_at) > p_started_at
     AND x.execution_status NOT IN ('cancelled','no_show');
  IF v_overlap > 0 AND NOT p_confirm_overlap THEN
    RETURN jsonb_build_object('ok',false,'overlap',true,'count',v_overlap);
  END IF;

  v_old := to_jsonb(v);
  UPDATE public.assist_visits SET on_the_way_at = p_on_the_way_at, arrived_at = p_arrived_at,
    actual_start_at = p_started_at, actual_end_at = p_ended_at, finished_at = p_ended_at,
    duration_minutes = v_net, updated_by = auth.uid(), updated_at = now() WHERE id = v.id;

  DELETE FROM public.assist_time_events
   WHERE tenant_id = v.tenant_id AND visit_id = v.id
     AND metadata->>'source' = 'administrative_follow_up';
  INSERT INTO public.assist_time_events(tenant_id,visit_id,event_type,occurred_at,recorded_by,metadata)
  SELECT v.tenant_id,v.id,e.event_type,e.occurred_at,auth.uid(),
    jsonb_build_object('source','administrative_follow_up','reason',p_reason)
  FROM (VALUES ('drive_start'::text,p_on_the_way_at),('arrive',p_arrived_at),
               ('service_start',p_started_at),('service_end',p_ended_at)) e(event_type,occurred_at)
  WHERE e.occurred_at IS NOT NULL;

  PERFORM public.sync_assist_visit_times_to_wfm(v.tenant_id, v.id);
  DELETE FROM public.workforce_time_events
   WHERE tenant_id = v.tenant_id AND reference_type = 'visit' AND reference_id = v.id
     AND event_type = 'correction' AND metadata->>'source' = 'administrative_follow_up';
  INSERT INTO public.workforce_time_events(
    tenant_id,employee_id,user_id,event_type,work_mode,source,occurred_at,
    reference_type,reference_id,note,metadata,created_by)
  VALUES(v.tenant_id,v.employee_id,auth.uid(),'correction','field','correction',now(),
    'visit',v.id,p_reason,jsonb_build_object('source','administrative_follow_up',
      'actual_start_at',p_started_at,'actual_end_at',p_ended_at,'pause_minutes',p_pause_minutes,
      'travel_minutes',p_travel_minutes,'net_minutes',v_net),auth.uid());

  INSERT INTO public.assist_visit_admin_audit(tenant_id,visit_id,action,previous_value,new_value,reason)
  VALUES(v.tenant_id,v.id,'times_corrected',v_old,
    jsonb_build_object('on_the_way_at',p_on_the_way_at,'arrived_at',p_arrived_at,
      'actual_start_at',p_started_at,'actual_end_at',p_ended_at,
      'pause_minutes',p_pause_minutes,'travel_minutes',p_travel_minutes,'net_minutes',v_net),p_reason);
  RETURN jsonb_build_object('ok',true,'net_minutes',v_net,'overlap_confirmed',v_overlap > 0);
END $$;

CREATE OR REPLACE FUNCTION public.admin_request_assist_visit_signature(p_visit_id uuid, p_reason text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v public.assist_visits%ROWTYPE; v_request_id uuid;
BEGIN
  IF NOT public.has_permission('assist.execution.manage') THEN RAISE EXCEPTION 'Keine Berechtigung'; END IF;
  IF length(trim(coalesce(p_reason,''))) = 0 THEN RAISE EXCEPTION 'Begründung ist erforderlich'; END IF;
  SELECT * INTO v FROM public.assist_visits WHERE id=p_visit_id AND tenant_id=public.current_tenant_id() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Einsatz nicht gefunden'; END IF;
  SELECT id INTO v_request_id FROM public.assist_visit_signature_requests
   WHERE tenant_id=v.tenant_id AND visit_id=v.id AND status='open';
  IF v_request_id IS NULL THEN
    INSERT INTO public.assist_visit_signature_requests(
      tenant_id,visit_id,client_id,service_date,service_name,planned_start_at,planned_end_at,
      actual_start_at,actual_end_at,proof_preview)
    VALUES(v.tenant_id,v.id,v.client_id,v.assignment_date,coalesce(nullif(v.service_name,''),v.title),
      v.planned_start_at,v.planned_end_at,v.actual_start_at,v.actual_end_at,
      jsonb_build_object('visit_id',v.id,'service_date',v.assignment_date,'service',coalesce(nullif(v.service_name,''),v.title),
        'planned_start_at',v.planned_start_at,'planned_end_at',v.planned_end_at,
        'actual_start_at',v.actual_start_at,'actual_end_at',v.actual_end_at)) RETURNING id INTO v_request_id;
    UPDATE public.assist_visits SET proof_status='pending', updated_by=auth.uid(), updated_at=now() WHERE id=v.id;
    INSERT INTO public.assist_visit_admin_audit(tenant_id,visit_id,action,new_value,reason)
    VALUES(v.tenant_id,v.id,'signature_requested',jsonb_build_object('request_id',v_request_id),p_reason);
  END IF;
  RETURN v_request_id;
END $$;

CREATE OR REPLACE FUNCTION public.admin_append_assist_visit_documentation(p_visit_id uuid, p_content text, p_reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v public.assist_visits%ROWTYPE; v_old text;
BEGIN
  IF NOT public.has_permission('assist.execution.manage') THEN RAISE EXCEPTION 'Keine Berechtigung'; END IF;
  IF length(trim(coalesce(p_content,'')))=0 OR length(trim(coalesce(p_reason,'')))=0 THEN RAISE EXCEPTION 'Dokumentation und Begründung sind erforderlich'; END IF;
  SELECT * INTO v FROM public.assist_visits WHERE id=p_visit_id AND tenant_id=public.current_tenant_id() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Einsatz nicht gefunden'; END IF;
  SELECT short_description INTO v_old FROM public.assist_visit_documentation WHERE tenant_id=v.tenant_id AND visit_id=v.id FOR UPDATE;
  INSERT INTO public.assist_visit_documentation(tenant_id,visit_id,short_description,special_notes,submitted_at,submitted_by,metadata)
  VALUES(v.tenant_id,v.id,p_content,p_content,now(),auth.uid(),jsonb_build_object('administrative_reason',p_reason))
  ON CONFLICT(tenant_id,visit_id) DO UPDATE SET
    special_notes=concat_ws(E'\n\n',public.assist_visit_documentation.special_notes,
      '[Administrative Ergänzung '||to_char(now(),'YYYY-MM-DD HH24:MI')||'] '||p_content),
    metadata=public.assist_visit_documentation.metadata || jsonb_build_object('last_administrative_reason',p_reason), updated_at=now();
  UPDATE public.assist_visits SET documentation_status='complete',updated_by=auth.uid(),updated_at=now() WHERE id=v.id;
  INSERT INTO public.assist_visit_admin_audit(tenant_id,visit_id,action,previous_value,new_value,reason)
  VALUES(v.tenant_id,v.id,'documentation_appended',jsonb_build_object('short_description',v_old),jsonb_build_object('content',p_content),p_reason);
END $$;

CREATE OR REPLACE FUNCTION public.admin_update_assist_visit_task(p_visit_id uuid, p_task_id uuid, p_status text, p_reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_tenant uuid; v_old text;
BEGIN
  IF NOT public.has_permission('assist.execution.manage') THEN RAISE EXCEPTION 'Keine Berechtigung'; END IF;
  IF p_status NOT IN ('open','done','partial','not_requested','not_possible','cancelled','deferred') THEN RAISE EXCEPTION 'Ungültiger Aufgabenstatus'; END IF;
  IF length(trim(coalesce(p_reason,'')))=0 THEN RAISE EXCEPTION 'Begründung ist erforderlich'; END IF;
  SELECT v.tenant_id,t.status INTO v_tenant,v_old FROM public.assist_visits v JOIN public.assist_visit_tasks t
    ON t.visit_id=v.id AND t.tenant_id=v.tenant_id WHERE v.id=p_visit_id AND t.id=p_task_id
    AND v.tenant_id=public.current_tenant_id() FOR UPDATE OF t;
  IF NOT FOUND THEN RAISE EXCEPTION 'Aufgabe nicht gefunden'; END IF;
  UPDATE public.assist_visit_tasks SET status=p_status,
    not_done_reason=CASE WHEN p_status='done' THEN NULL ELSE p_reason END,
    completed_at=CASE WHEN p_status='done' THEN now() ELSE NULL END,updated_at=now() WHERE id=p_task_id AND tenant_id=v_tenant;
  INSERT INTO public.assist_visit_admin_audit(tenant_id,visit_id,action,previous_value,new_value,reason)
  VALUES(v_tenant,p_visit_id,'task_updated',jsonb_build_object('task_id',p_task_id,'status',v_old),jsonb_build_object('task_id',p_task_id,'status',p_status),p_reason);
END $$;

CREATE OR REPLACE FUNCTION public.admin_complete_assist_visit_follow_up(p_visit_id uuid, p_reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v public.assist_visits%ROWTYPE;
BEGIN
  IF NOT public.has_permission('assist.execution.manage') THEN RAISE EXCEPTION 'Keine Berechtigung'; END IF;
  IF length(trim(coalesce(p_reason,'')))=0 THEN RAISE EXCEPTION 'Begründung ist erforderlich'; END IF;
  SELECT * INTO v FROM public.assist_visits WHERE id=p_visit_id AND tenant_id=public.current_tenant_id() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Einsatz nicht gefunden'; END IF;
  IF v.actual_start_at IS NULL OR v.actual_end_at IS NULL OR coalesce(v.duration_minutes,0)<=0 THEN RAISE EXCEPTION 'Gültige Ist-Zeiten fehlen'; END IF;
  IF EXISTS (SELECT 1 FROM public.assist_visit_tasks WHERE tenant_id=v.tenant_id AND visit_id=v.id AND is_required AND status='open') THEN RAISE EXCEPTION 'Pflichtaufgaben sind noch offen'; END IF;
  IF v.documentation_status <> 'complete' THEN RAISE EXCEPTION 'Dokumentation ist nicht vollständig'; END IF;
  IF v.proof_status NOT IN ('signed','verified') THEN RAISE EXCEPTION 'Signatur oder verifizierter Nachweis fehlt'; END IF;
  UPDATE public.assist_visits SET execution_status='completed',canonical_status='completed',billing_status='ready',finished_at=coalesce(finished_at,actual_end_at),updated_by=auth.uid(),updated_at=now() WHERE id=v.id;
  INSERT INTO public.assist_visit_admin_audit(tenant_id,visit_id,action,previous_value,new_value,reason)
  VALUES(v.tenant_id,v.id,'follow_up_completed',jsonb_build_object('canonical_status',v.canonical_status),jsonb_build_object('canonical_status','completed'),p_reason);
END $$;

REVOKE ALL ON FUNCTION public.admin_correct_assist_visit_times(uuid,timestamptz,timestamptz,timestamptz,timestamptz,integer,integer,text,boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_request_assist_visit_signature(uuid,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_append_assist_visit_documentation(uuid,text,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_update_assist_visit_task(uuid,uuid,text,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_complete_assist_visit_follow_up(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_correct_assist_visit_times(uuid,timestamptz,timestamptz,timestamptz,timestamptz,integer,integer,text,boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_request_assist_visit_signature(uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_append_assist_visit_documentation(uuid,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_assist_visit_task(uuid,uuid,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_complete_assist_visit_follow_up(uuid,text) TO authenticated;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.assist_visit_signature_requests;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
