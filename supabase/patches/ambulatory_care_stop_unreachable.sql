-- CareSuite+ ambulant: S-04 — Klient:in nicht erreichbar.
-- Kontaktversuch, Risikoeinschaetzung, Rueckmeldung und Folgeauftrag bleiben
-- append-only und werden nie als erbrachte Leistung oder positiver Nachweis ausgelegt.

CREATE TABLE IF NOT EXISTS public.care_tour_stop_contact_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  tour_id uuid NOT NULL REFERENCES public.care_tours(id) ON DELETE RESTRICT,
  stop_id uuid NOT NULL REFERENCES public.care_tour_stops(id) ON DELETE RESTRICT,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE RESTRICT,
  channel text NOT NULL CHECK (channel IN ('doorbell','phone','contact_person','office','emergency_service','other')),
  target_label text NOT NULL CHECK (length(btrim(target_label)) BETWEEN 2 AND 200),
  outcome text NOT NULL CHECK (outcome IN ('no_answer','failed','reached')),
  detail text NOT NULL CHECK (length(btrim(detail)) BETWEEN 5 AND 2000),
  response_detail text,
  client_request_id uuid NOT NULL,
  request_fingerprint text NOT NULL,
  recorded_by uuid NOT NULL,
  recorded_by_name text NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CHECK ((outcome='reached')=(NULLIF(btrim(response_detail),'') IS NOT NULL)),
  CHECK (response_detail IS NULL OR length(response_detail)<=2000)
);
CREATE UNIQUE INDEX IF NOT EXISTS care_stop_contact_attempt_request_unique
  ON public.care_tour_stop_contact_attempts(tenant_id,client_request_id);
CREATE INDEX IF NOT EXISTS care_stop_contact_attempt_timeline
  ON public.care_tour_stop_contact_attempts(tenant_id,stop_id,recorded_at,id);

CREATE TABLE IF NOT EXISTS public.care_tour_stop_unreachable_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  tour_id uuid NOT NULL REFERENCES public.care_tours(id) ON DELETE RESTRICT,
  stop_id uuid NOT NULL REFERENCES public.care_tour_stops(id) ON DELETE RESTRICT,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE RESTRICT,
  circumstances text NOT NULL CHECK (length(btrim(circumstances)) BETWEEN 5 AND 4000),
  risk_level text NOT NULL CHECK (risk_level IN ('no_acute_indication','unclear','urgent')),
  risk_detail text NOT NULL CHECK (length(btrim(risk_detail)) BETWEEN 5 AND 2000),
  feedback_state text NOT NULL CHECK (feedback_state IN ('none','client','contact_person','office','emergency_service')),
  feedback_detail text,
  service_outcome text NOT NULL DEFAULT 'not_delivered' CHECK (service_outcome='not_delivered'),
  client_request_id uuid NOT NULL,
  request_fingerprint text NOT NULL,
  recorded_by uuid NOT NULL,
  recorded_by_name text NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CHECK ((feedback_state<>'none')=(NULLIF(btrim(feedback_detail),'') IS NOT NULL)),
  CHECK (feedback_detail IS NULL OR length(feedback_detail)<=2000)
);
CREATE UNIQUE INDEX IF NOT EXISTS care_stop_unreachable_report_stop_unique
  ON public.care_tour_stop_unreachable_reports(stop_id);
CREATE UNIQUE INDEX IF NOT EXISTS care_stop_unreachable_report_request_unique
  ON public.care_tour_stop_unreachable_reports(tenant_id,client_request_id);

CREATE TABLE IF NOT EXISTS public.care_tour_stop_unreachable_follow_ups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  tour_id uuid NOT NULL REFERENCES public.care_tours(id) ON DELETE RESTRICT,
  stop_id uuid NOT NULL REFERENCES public.care_tour_stops(id) ON DELETE RESTRICT,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE RESTRICT,
  report_id uuid NOT NULL UNIQUE REFERENCES public.care_tour_stop_unreachable_reports(id) ON DELETE RESTRICT,
  action text NOT NULL CHECK (length(btrim(action)) BETWEEN 5 AND 2000),
  assignee_label text NOT NULL CHECK (length(btrim(assignee_label)) BETWEEN 2 AND 200),
  priority text NOT NULL CHECK (priority IN ('routine','today','urgent')),
  due_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status='open'),
  created_by uuid NOT NULL,
  created_by_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX IF NOT EXISTS care_stop_unreachable_follow_up_open
  ON public.care_tour_stop_unreachable_follow_ups(tenant_id,status,due_at,id);

ALTER TABLE public.care_tour_stop_contact_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.care_tour_stop_unreachable_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.care_tour_stop_unreachable_follow_ups ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.care_tour_stop_contact_attempts,public.care_tour_stop_unreachable_reports,public.care_tour_stop_unreachable_follow_ups FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION care_private.stop_unreachable_context(p_stop_id uuid) RETURNS jsonb
 LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE t uuid:=public.current_tenant_id(); s public.care_tour_stops; tr public.care_tours; r public.care_tour_stop_unreachable_reports; f public.care_tour_stop_unreachable_follow_ups;
BEGIN
 IF t IS NULL OR auth.uid() IS NULL THEN RAISE EXCEPTION 'Keine Berechtigung.' USING ERRCODE='42501'; END IF;
 SELECT * INTO s FROM public.care_tour_stops WHERE id=p_stop_id AND tenant_id=t;
 IF NOT FOUND THEN RAISE EXCEPTION 'Einsatz nicht gefunden.' USING ERRCODE='42501'; END IF;
 SELECT * INTO tr FROM public.care_tours WHERE id=s.tour_id AND tenant_id=t;
 IF NOT FOUND OR NOT care_private.stop_opening_allowed(tr) THEN RAISE EXCEPTION 'Keine Berechtigung.' USING ERRCODE='42501'; END IF;
 SELECT * INTO r FROM public.care_tour_stop_unreachable_reports WHERE stop_id=s.id AND tenant_id=t;
 IF r.id IS NOT NULL THEN SELECT * INTO f FROM public.care_tour_stop_unreachable_follow_ups WHERE report_id=r.id AND tenant_id=t; END IF;
 RETURN jsonb_build_object('stopId',s.id,'tourId',tr.id,'clientId',s.client_id,'stopStatus',s.status,
  'stopUpdatedAt',s.updated_at,'actualStartedAt',s.actual_started_at,
  'canRecord',tr.status='in_progress' AND s.status IN('planned','arrived') AND s.actual_started_at IS NULL AND r.id IS NULL,
  'attempts',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',a.id,'channel',a.channel,'targetLabel',a.target_label,
   'outcome',a.outcome,'detail',a.detail,'responseDetail',a.response_detail,'recordedByName',a.recorded_by_name,'recordedAt',a.recorded_at)
   ORDER BY a.recorded_at,a.id) FROM public.care_tour_stop_contact_attempts a WHERE a.stop_id=s.id AND a.tenant_id=t),'[]'::jsonb),
  'report',CASE WHEN r.id IS NULL THEN NULL ELSE jsonb_build_object('id',r.id,'circumstances',r.circumstances,
   'riskLevel',r.risk_level,'riskDetail',r.risk_detail,'feedbackState',r.feedback_state,'feedbackDetail',r.feedback_detail,
   'serviceOutcome',r.service_outcome,'recordedByName',r.recorded_by_name,'recordedAt',r.recorded_at) END,
  'followUp',CASE WHEN f.id IS NULL THEN NULL ELSE jsonb_build_object('id',f.id,'action',f.action,'assigneeLabel',f.assignee_label,
   'priority',f.priority,'dueAt',f.due_at,'status',f.status,'createdByName',f.created_by_name,'createdAt',f.created_at) END);
END $$;

CREATE OR REPLACE FUNCTION care_private.record_stop_contact_attempt(
 p_stop_id uuid,p_channel text,p_target_label text,p_outcome text,p_detail text,p_response_detail text,p_request_id uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE t uuid:=public.current_tenant_id(); s public.care_tour_stops; tr public.care_tours; existing public.care_tour_stop_contact_attempts;
 fingerprint text; attempt_id uuid; actual_time timestamptz; actor_name text;
BEGIN
 IF t IS NULL OR auth.uid() IS NULL OR p_request_id IS NULL OR p_channel NOT IN('doorbell','phone','contact_person','office','emergency_service','other')
  OR p_outcome NOT IN('no_answer','failed','reached') OR length(btrim(COALESCE(p_target_label,''))) NOT BETWEEN 2 AND 200
  OR length(btrim(COALESCE(p_detail,''))) NOT BETWEEN 5 AND 2000
  OR ((p_outcome='reached')<>(NULLIF(btrim(COALESCE(p_response_detail,'')),'') IS NOT NULL))
  OR length(COALESCE(p_response_detail,''))>2000 THEN
  RAISE EXCEPTION 'Kontaktweg, Ziel, Ergebnis und gegebenenfalls Rueckmeldung muessen vollstaendig dokumentiert werden.' USING ERRCODE='23514';
 END IF;
 fingerprint:=md5(jsonb_build_object('stopId',p_stop_id,'channel',p_channel,'target',btrim(p_target_label),'outcome',p_outcome,
  'detail',btrim(p_detail),'response',NULLIF(btrim(COALESCE(p_response_detail,'')),''))::text);
 SELECT * INTO existing FROM public.care_tour_stop_contact_attempts WHERE tenant_id=t AND client_request_id=p_request_id;
 IF FOUND THEN
  IF existing.stop_id IS DISTINCT FROM p_stop_id OR existing.recorded_by IS DISTINCT FROM auth.uid() OR existing.request_fingerprint IS DISTINCT FROM fingerprint THEN
   RAISE EXCEPTION 'Diese Kontaktanfrage wurde bereits mit anderen Angaben verwendet.' USING ERRCODE='40001';
  END IF;
  RETURN jsonb_build_object('id',existing.id,'recordedAt',existing.recorded_at,'duplicate',true);
 END IF;
 SELECT * INTO s FROM public.care_tour_stops WHERE id=p_stop_id AND tenant_id=t FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Einsatz nicht gefunden.' USING ERRCODE='42501'; END IF;
 SELECT * INTO tr FROM public.care_tours WHERE id=s.tour_id AND tenant_id=t FOR UPDATE;
 IF NOT FOUND OR NOT care_private.stop_opening_allowed(tr) THEN RAISE EXCEPTION 'Keine Berechtigung.' USING ERRCODE='42501'; END IF;
 IF tr.status<>'in_progress' OR s.status NOT IN('planned','arrived') OR s.actual_started_at IS NOT NULL
  OR EXISTS(SELECT 1 FROM public.care_tour_stop_openings WHERE tenant_id=t AND stop_id=s.id)
  OR EXISTS(SELECT 1 FROM public.care_tour_stop_time_events WHERE tenant_id=t AND stop_id=s.id AND event_kind='start')
  OR EXISTS(SELECT 1 FROM public.care_tour_stop_unreachable_reports WHERE tenant_id=t AND stop_id=s.id) THEN
  RAISE EXCEPTION 'Kontaktversuche fuer einen Nichtbesuch sind nur vor dem tatsaechlichen Versorgungsbeginn zulaessig.' USING ERRCODE='40001';
 END IF;
 actual_time:=clock_timestamp(); actor_name:=COALESCE(NULLIF(public.clinical_actor_name(),''),NULLIF(tr.employee_name_snapshot,''),'Unbekannt');
 INSERT INTO public.care_tour_stop_contact_attempts(tenant_id,tour_id,stop_id,client_id,channel,target_label,outcome,detail,response_detail,client_request_id,request_fingerprint,recorded_by,recorded_by_name,recorded_at)
 VALUES(t,tr.id,s.id,s.client_id,p_channel,btrim(p_target_label),p_outcome,btrim(p_detail),NULLIF(btrim(COALESCE(p_response_detail,'')),''),p_request_id,fingerprint,auth.uid(),actor_name,actual_time)
 RETURNING id INTO attempt_id;
 RETURN jsonb_build_object('id',attempt_id,'recordedAt',actual_time,'duplicate',false);
END $$;

CREATE OR REPLACE FUNCTION care_private.report_stop_unreachable(
 p_stop_id uuid,p_expected_stop_updated_at timestamptz,p_circumstances text,p_risk_level text,p_risk_detail text,
 p_feedback_state text,p_feedback_detail text,p_follow_up_action text,p_follow_up_assignee text,p_follow_up_priority text,
 p_follow_up_due_at timestamptz,p_request_id uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE t uuid:=public.current_tenant_id(); s public.care_tour_stops; tr public.care_tours; existing public.care_tour_stop_unreachable_reports;
 existing_follow_up public.care_tour_stop_unreachable_follow_ups; fingerprint text; report_id uuid; follow_up_id uuid; actual_time timestamptz; actor_name text;
BEGIN
 IF t IS NULL OR auth.uid() IS NULL OR p_request_id IS NULL OR p_expected_stop_updated_at IS NULL
  OR length(btrim(COALESCE(p_circumstances,''))) NOT BETWEEN 5 AND 4000
  OR p_risk_level NOT IN('no_acute_indication','unclear','urgent') OR length(btrim(COALESCE(p_risk_detail,''))) NOT BETWEEN 5 AND 2000
  OR p_feedback_state NOT IN('none','client','contact_person','office','emergency_service')
  OR ((p_feedback_state<>'none')<>(NULLIF(btrim(COALESCE(p_feedback_detail,'')),'') IS NOT NULL))
  OR length(COALESCE(p_feedback_detail,''))>2000 OR length(btrim(COALESCE(p_follow_up_action,''))) NOT BETWEEN 5 AND 2000
  OR length(btrim(COALESCE(p_follow_up_assignee,''))) NOT BETWEEN 2 AND 200
  OR p_follow_up_priority NOT IN('routine','today','urgent') OR p_follow_up_due_at IS NULL
  OR (p_risk_level='urgent' AND p_follow_up_priority<>'urgent') THEN
  RAISE EXCEPTION 'Umstaende, Risiko, Rueckmeldung und konkreter Folgeauftrag muessen vollstaendig dokumentiert werden.' USING ERRCODE='23514';
 END IF;
 fingerprint:=md5(jsonb_build_object('stopId',p_stop_id,'expectedUpdatedAt',p_expected_stop_updated_at,'circumstances',btrim(p_circumstances),
  'riskLevel',p_risk_level,'riskDetail',btrim(p_risk_detail),'feedbackState',p_feedback_state,
  'feedbackDetail',NULLIF(btrim(COALESCE(p_feedback_detail,'')),''),'followUpAction',btrim(p_follow_up_action),
  'followUpAssignee',btrim(p_follow_up_assignee),'followUpPriority',p_follow_up_priority,'followUpDueAt',p_follow_up_due_at)::text);
 SELECT * INTO existing FROM public.care_tour_stop_unreachable_reports WHERE tenant_id=t AND client_request_id=p_request_id;
 IF FOUND THEN
  IF existing.stop_id IS DISTINCT FROM p_stop_id OR existing.recorded_by IS DISTINCT FROM auth.uid() OR existing.request_fingerprint IS DISTINCT FROM fingerprint THEN
   RAISE EXCEPTION 'Diese Nichtbesuchsanfrage wurde bereits mit anderen Angaben verwendet.' USING ERRCODE='40001';
  END IF;
  SELECT * INTO existing_follow_up FROM public.care_tour_stop_unreachable_follow_ups WHERE report_id=existing.id AND tenant_id=t;
  RETURN jsonb_build_object('id',existing.id,'followUpId',existing_follow_up.id,'recordedAt',existing.recorded_at,'duplicate',true,'serviceOutcome',existing.service_outcome);
 END IF;
 SELECT * INTO s FROM public.care_tour_stops WHERE id=p_stop_id AND tenant_id=t FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Einsatz nicht gefunden.' USING ERRCODE='42501'; END IF;
 SELECT * INTO tr FROM public.care_tours WHERE id=s.tour_id AND tenant_id=t FOR UPDATE;
 IF NOT FOUND OR NOT care_private.stop_opening_allowed(tr) THEN RAISE EXCEPTION 'Keine Berechtigung.' USING ERRCODE='42501'; END IF;
 IF tr.status<>'in_progress' OR s.status NOT IN('planned','arrived') OR s.actual_started_at IS NOT NULL
  OR EXISTS(SELECT 1 FROM public.care_tour_stop_openings WHERE tenant_id=t AND stop_id=s.id)
  OR EXISTS(SELECT 1 FROM public.care_tour_stop_time_events WHERE tenant_id=t AND stop_id=s.id AND event_kind='start') THEN
  RAISE EXCEPTION 'Ein Nichtbesuch darf keinen bereits begonnenen oder abgeschlossenen Einsatz ersetzen.' USING ERRCODE='40001';
 END IF;
 IF s.updated_at IS DISTINCT FROM p_expected_stop_updated_at THEN RAISE EXCEPTION 'Der Einsatz wurde parallel veraendert. Bitte neu laden.' USING ERRCODE='40001'; END IF;
 IF EXISTS(SELECT 1 FROM public.care_tour_stop_unreachable_reports WHERE tenant_id=t AND stop_id=s.id) THEN
  RAISE EXCEPTION 'Fuer diesen Einsatz liegt bereits ein unveraenderlicher Nichtbesuchsbericht vor.' USING ERRCODE='40001';
 END IF;
 IF NOT EXISTS(SELECT 1 FROM public.care_tour_stop_contact_attempts WHERE tenant_id=t AND stop_id=s.id AND outcome IN('no_answer','failed')) THEN
  RAISE EXCEPTION 'Mindestens ein erfolgloser tatsaechlicher Kontaktversuch ist erforderlich.' USING ERRCODE='23514';
 END IF;
 IF (p_feedback_state='none')<>(NOT EXISTS(SELECT 1 FROM public.care_tour_stop_contact_attempts WHERE tenant_id=t AND stop_id=s.id AND outcome='reached')) THEN
  RAISE EXCEPTION 'Rueckmeldestatus und tatsaechlich dokumentierte erreichte Kontakte stimmen nicht ueberein.' USING ERRCODE='23514';
 END IF;
 actual_time:=clock_timestamp(); actor_name:=COALESCE(NULLIF(public.clinical_actor_name(),''),NULLIF(tr.employee_name_snapshot,''),'Unbekannt');
 INSERT INTO public.care_tour_stop_unreachable_reports(tenant_id,tour_id,stop_id,client_id,circumstances,risk_level,risk_detail,feedback_state,feedback_detail,service_outcome,client_request_id,request_fingerprint,recorded_by,recorded_by_name,recorded_at)
 VALUES(t,tr.id,s.id,s.client_id,btrim(p_circumstances),p_risk_level,btrim(p_risk_detail),p_feedback_state,NULLIF(btrim(COALESCE(p_feedback_detail,'')),''),'not_delivered',p_request_id,fingerprint,auth.uid(),actor_name,actual_time)
 RETURNING id INTO report_id;
 INSERT INTO public.care_tour_stop_unreachable_follow_ups(tenant_id,tour_id,stop_id,client_id,report_id,action,assignee_label,priority,due_at,status,created_by,created_by_name,created_at)
 VALUES(t,tr.id,s.id,s.client_id,report_id,btrim(p_follow_up_action),btrim(p_follow_up_assignee),p_follow_up_priority,p_follow_up_due_at,'open',auth.uid(),actor_name,actual_time)
 RETURNING id INTO follow_up_id;
 UPDATE public.care_tour_stops SET status='cancelled',updated_at=actual_time WHERE id=s.id;
 RETURN jsonb_build_object('id',report_id,'followUpId',follow_up_id,'recordedAt',actual_time,'duplicate',false,'serviceOutcome','not_delivered');
END $$;

CREATE OR REPLACE FUNCTION public.get_ambulatory_care_stop_unreachable_context(p_stop_id uuid) RETURNS jsonb
 LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$SELECT care_private.stop_unreachable_context(p_stop_id)$$;
CREATE OR REPLACE FUNCTION public.record_ambulatory_care_stop_contact_attempt(p_stop_id uuid,p_channel text,p_target_label text,p_outcome text,p_detail text,p_response_detail text,p_request_id uuid) RETURNS jsonb
 LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$SELECT care_private.record_stop_contact_attempt(p_stop_id,p_channel,p_target_label,p_outcome,p_detail,p_response_detail,p_request_id)$$;
CREATE OR REPLACE FUNCTION public.report_ambulatory_care_stop_unreachable(p_stop_id uuid,p_expected_stop_updated_at timestamptz,p_circumstances text,p_risk_level text,p_risk_detail text,p_feedback_state text,p_feedback_detail text,p_follow_up_action text,p_follow_up_assignee text,p_follow_up_priority text,p_follow_up_due_at timestamptz,p_request_id uuid) RETURNS jsonb
 LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$SELECT care_private.report_stop_unreachable(p_stop_id,p_expected_stop_updated_at,p_circumstances,p_risk_level,p_risk_detail,p_feedback_state,p_feedback_detail,p_follow_up_action,p_follow_up_assignee,p_follow_up_priority,p_follow_up_due_at,p_request_id)$$;
REVOKE ALL ON FUNCTION care_private.stop_unreachable_context(uuid),care_private.record_stop_contact_attempt(uuid,text,text,text,text,text,uuid),care_private.report_stop_unreachable(uuid,timestamptz,text,text,text,text,text,text,text,text,timestamptz,uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.get_ambulatory_care_stop_unreachable_context(uuid),public.record_ambulatory_care_stop_contact_attempt(uuid,text,text,text,text,text,uuid),public.report_ambulatory_care_stop_unreachable(uuid,timestamptz,text,text,text,text,text,text,text,text,timestamptz,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION care_private.stop_unreachable_context(uuid),care_private.record_stop_contact_attempt(uuid,text,text,text,text,text,uuid),care_private.report_stop_unreachable(uuid,timestamptz,text,text,text,text,text,text,text,text,timestamptz,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_ambulatory_care_stop_unreachable_context(uuid),public.record_ambulatory_care_stop_contact_attempt(uuid,text,text,text,text,text,uuid),public.report_ambulatory_care_stop_unreachable(uuid,timestamptz,text,text,text,text,text,text,text,text,timestamptz,uuid) TO authenticated;
