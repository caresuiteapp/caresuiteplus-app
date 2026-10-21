-- CP220 / S-08: transactional stop completion. Apply only after opening, task and time-event patches.
CREATE TABLE IF NOT EXISTS public.care_tour_stop_completions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES public.tenants(id),
 tour_id uuid NOT NULL REFERENCES public.care_tours(id), stop_id uuid NOT NULL UNIQUE REFERENCES public.care_tour_stops(id) ON DELETE RESTRICT,
 client_id uuid NOT NULL REFERENCES public.clients(id), opening_id uuid NOT NULL REFERENCES public.care_tour_stop_openings(id) ON DELETE RESTRICT,
 documentation_entry_id uuid NOT NULL REFERENCES public.clinical_documentation_entries(id) ON DELETE RESTRICT,
 actual_started_at timestamptz NOT NULL, actual_ended_at timestamptz NOT NULL,
 documentation_snapshot jsonb NOT NULL, task_state_snapshot jsonb NOT NULL, time_event_snapshot jsonb NOT NULL,
 open_risk_snapshot jsonb NOT NULL, release_state text NOT NULL DEFAULT 'pending' CHECK(release_state='pending'),
 client_request_id uuid NOT NULL, request_fingerprint text NOT NULL CHECK(request_fingerprint~'^[0-9a-f]{32}$'),
 completed_by uuid NOT NULL REFERENCES auth.users(id), completed_by_name text NOT NULL,
 completed_at timestamptz NOT NULL DEFAULT clock_timestamp(), UNIQUE(tenant_id,client_request_id),
 CHECK(actual_ended_at>=actual_started_at)
);
CREATE INDEX IF NOT EXISTS care_stop_completions_tenant_client ON public.care_tour_stop_completions(tenant_id,client_id,completed_at DESC,id);
ALTER TABLE public.care_tour_stop_completions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.care_tour_stop_completions FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.care_tour_stop_completions TO authenticated;
DROP POLICY IF EXISTS care_stop_completions_read ON public.care_tour_stop_completions;
CREATE POLICY care_stop_completions_read ON public.care_tour_stop_completions FOR SELECT TO authenticated
 USING(tenant_id=public.current_tenant_id() AND public.has_permission('pflege.plans.view'));

CREATE OR REPLACE FUNCTION care_private.stop_completion_context(p_stop_id uuid) RETURNS jsonb
 LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE t uuid:=public.current_tenant_id(); s public.care_tour_stops; tr public.care_tours; o public.care_tour_stop_openings; planned integer; documented integer; deviations integer;
BEGIN
 IF t IS NULL OR auth.uid() IS NULL THEN RAISE EXCEPTION 'Keine Berechtigung.' USING ERRCODE='42501'; END IF;
 SELECT * INTO s FROM public.care_tour_stops WHERE id=p_stop_id AND tenant_id=t;
 IF NOT FOUND THEN RAISE EXCEPTION 'Einsatz nicht gefunden.' USING ERRCODE='42501'; END IF;
 SELECT * INTO tr FROM public.care_tours WHERE id=s.tour_id AND tenant_id=t;
 IF NOT FOUND OR NOT care_private.stop_opening_allowed(tr) OR NOT public.has_permission('pflege.plans.manage') THEN RAISE EXCEPTION 'Keine Berechtigung.' USING ERRCODE='42501'; END IF;
 SELECT * INTO o FROM public.care_tour_stop_openings WHERE stop_id=s.id AND tenant_id=t;
 IF NOT FOUND OR tr.status<>'in_progress' OR s.status<>'in_progress' OR s.actual_started_at IS NULL THEN RAISE EXCEPTION 'Einsatz ist nicht in dokumentierbarer Durchführung.' USING ERRCODE='40001'; END IF;
 planned:=jsonb_array_length(o.plan_items_snapshot);
 SELECT count(*),count(*) FILTER(WHERE e.has_deviation OR e.outcome<>'performed') INTO documented,deviations
 FROM public.care_tour_stop_task_bindings b JOIN public.care_tour_stop_task_executions e ON e.binding_id=b.id
 WHERE b.tenant_id=t AND b.stop_id=s.id AND b.opening_id=o.id;
 RETURN jsonb_build_object('stopId',s.id,'stopUpdatedAt',s.updated_at,'actualStartedAt',s.actual_started_at,'stopStatus',s.status,
  'plannedTaskCount',planned,'documentedTaskCount',documented,'openTaskCount',planned-documented,'deviationCount',deviations,'releaseState','pending');
END $$;

CREATE OR REPLACE FUNCTION care_private.complete_stop(
 p_stop_id uuid,p_expected_stop_updated_at timestamptz,p_documentation text,p_mandatory_confirmed boolean,
 p_risk_state text,p_risk_detail text,p_risk_action text,p_follow_up text,p_request_id uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE t uuid:=public.current_tenant_id(); s public.care_tour_stops; tr public.care_tours; o public.care_tour_stop_openings;
 existing public.care_tour_stop_completions; doc public.clinical_documentation_entries; fingerprint text; planned integer; documented integer; deviations integer;
 task_snapshot jsonb; time_snapshot jsonb; actual_time timestamptz; actor_name text; completion_id uuid;
BEGIN
 IF t IS NULL OR auth.uid() IS NULL OR p_request_id IS NULL OR p_expected_stop_updated_at IS NULL OR COALESCE(p_mandatory_confirmed,false)=false
  OR length(btrim(COALESCE(p_documentation,''))) NOT BETWEEN 10 AND 8000 OR p_risk_state NOT IN('none','documented')
  OR (p_risk_state='documented' AND (length(btrim(COALESCE(p_risk_detail,'')))<5 OR length(btrim(COALESCE(p_risk_action,'')))<5 OR length(btrim(COALESCE(p_follow_up,'')))<5))
  OR (p_risk_state='none' AND concat(COALESCE(p_risk_detail,''),COALESCE(p_risk_action,''),COALESCE(p_follow_up,''))<>'')
 THEN RAISE EXCEPTION 'Pflichtdokumentation, Risikostatus und Folgeauftrag vollständig angeben.' USING ERRCODE='23514'; END IF;
 fingerprint:=md5(jsonb_build_object('stopId',p_stop_id,'expectedStopUpdatedAt',p_expected_stop_updated_at,'documentation',btrim(p_documentation),'mandatoryConfirmed',true,'riskState',p_risk_state,'riskDetail',NULLIF(btrim(COALESCE(p_risk_detail,'')),''),'riskAction',NULLIF(btrim(COALESCE(p_risk_action,'')),''),'followUp',NULLIF(btrim(COALESCE(p_follow_up,'')),''))::text);
 PERFORM pg_advisory_xact_lock(hashtext(t::text),hashtext(p_request_id::text));
 SELECT * INTO existing FROM public.care_tour_stop_completions WHERE tenant_id=t AND client_request_id=p_request_id;
 IF FOUND THEN
  IF existing.completed_by IS DISTINCT FROM auth.uid() OR existing.request_fingerprint IS DISTINCT FROM fingerprint THEN RAISE EXCEPTION 'Diese Abschlussanfrage wurde bereits mit anderen Angaben verwendet.' USING ERRCODE='40001'; END IF;
  RETURN jsonb_build_object('completionId',existing.id,'stopId',existing.stop_id,'actualStartedAt',existing.actual_started_at,'actualEndedAt',existing.actual_ended_at,'releaseState',existing.release_state,'duplicate',true);
 END IF;
 SELECT * INTO s FROM public.care_tour_stops WHERE id=p_stop_id AND tenant_id=t FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Einsatz nicht gefunden.' USING ERRCODE='42501'; END IF;
 SELECT * INTO tr FROM public.care_tours WHERE id=s.tour_id AND tenant_id=t FOR UPDATE;
 IF NOT FOUND OR NOT care_private.stop_opening_allowed(tr) OR NOT public.has_permission('pflege.plans.manage') THEN RAISE EXCEPTION 'Keine Berechtigung.' USING ERRCODE='42501'; END IF;
 SELECT * INTO o FROM public.care_tour_stop_openings WHERE stop_id=s.id AND tenant_id=t FOR SHARE;
 IF NOT FOUND OR tr.status<>'in_progress' OR s.status<>'in_progress' OR s.actual_started_at IS NULL OR s.actual_ended_at IS NOT NULL OR s.updated_at IS DISTINCT FROM p_expected_stop_updated_at THEN RAISE EXCEPTION 'Einsatz wurde zwischenzeitlich geändert. Abschlussvoraussetzungen neu laden.' USING ERRCODE='40001'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.care_tour_stop_time_events WHERE tenant_id=t AND stop_id=s.id AND event_kind='start') OR EXISTS(SELECT 1 FROM public.care_tour_stop_time_events WHERE tenant_id=t AND stop_id=s.id AND event_kind='end') THEN RAISE EXCEPTION 'Tatsächlicher Zeitverlauf ist nicht eindeutig offen.' USING ERRCODE='23514'; END IF;
 planned:=jsonb_array_length(o.plan_items_snapshot);
 SELECT count(*),count(*) FILTER(WHERE e.has_deviation OR e.outcome<>'performed'),COALESCE(jsonb_agg(jsonb_build_object('bindingId',b.id,'planItemId',b.plan_item_id,'plannedTask',b.planned_task_snapshot,'execution',to_jsonb(e)) ORDER BY COALESCE((b.planned_task_snapshot->>'sortOrder')::integer,0),b.id),'[]'::jsonb)
 INTO documented,deviations,task_snapshot FROM public.care_tour_stop_task_bindings b JOIN public.care_tour_stop_task_executions e ON e.binding_id=b.id WHERE b.tenant_id=t AND b.stop_id=s.id AND b.opening_id=o.id;
 IF documented<>planned THEN RAISE EXCEPTION 'Alle beim Beginn gebundenen Planaufgaben müssen einzeln dokumentiert sein.' USING ERRCODE='23514'; END IF;
 IF deviations>0 AND p_risk_state<>'documented' THEN RAISE EXCEPTION 'Abweichungen oder Nichtdurchführungen erfordern eine ausdrückliche Risiko- und Folgedokumentation.' USING ERRCODE='23514'; END IF;
 actual_time:=clock_timestamp();actor_name:=COALESCE(NULLIF(public.clinical_actor_name(),''),NULLIF(tr.employee_name_snapshot,''),'Unbekannt');
 SELECT * INTO doc FROM public.create_clinical_documentation(s.client_id,'visit','Ambulanter Einsatz: '||s.service_summary,btrim(p_documentation),jsonb_build_object('interventions',task_snapshot,'openRisk',jsonb_build_object('state',p_risk_state,'detail',NULLIF(btrim(COALESCE(p_risk_detail,'')),''),'action',NULLIF(btrim(COALESCE(p_risk_action,'')),''),'followUp',NULLIF(btrim(COALESCE(p_follow_up,'')),''))));
 UPDATE public.care_tour_stops SET status='completed',documentation_entry_id=doc.id,actual_ended_at=actual_time,notes=btrim(p_documentation),updated_at=actual_time WHERE id=s.id;
 SELECT COALESCE(jsonb_agg(to_jsonb(e) ORDER BY e.occurred_at,e.id),'[]'::jsonb) INTO time_snapshot FROM public.care_tour_stop_time_events e WHERE e.tenant_id=t AND e.stop_id=s.id;
 INSERT INTO public.care_tour_stop_completions(tenant_id,tour_id,stop_id,client_id,opening_id,documentation_entry_id,actual_started_at,actual_ended_at,documentation_snapshot,task_state_snapshot,time_event_snapshot,open_risk_snapshot,release_state,client_request_id,request_fingerprint,completed_by,completed_by_name,completed_at)
 VALUES(t,tr.id,s.id,s.client_id,o.id,doc.id,s.actual_started_at,actual_time,jsonb_build_object('text',btrim(p_documentation),'mandatoryConfirmed',true),task_snapshot,time_snapshot,jsonb_build_object('state',p_risk_state,'detail',NULLIF(btrim(COALESCE(p_risk_detail,'')),''),'action',NULLIF(btrim(COALESCE(p_risk_action,'')),''),'followUp',NULLIF(btrim(COALESCE(p_follow_up,'')),'')),'pending',p_request_id,fingerprint,auth.uid(),actor_name,actual_time) RETURNING id INTO completion_id;
 INSERT INTO public.care_tour_events(tenant_id,tour_id,stop_id,actor_id,actor_name,action,note) VALUES(t,tr.id,s.id,auth.uid(),actor_name,'in_progress→completed','Pflichtangaben vollständig; Freigabe ausstehend.');
 RETURN jsonb_build_object('completionId',completion_id,'stopId',s.id,'actualStartedAt',s.actual_started_at,'actualEndedAt',actual_time,'releaseState','pending','duplicate',false);
END $$;

CREATE OR REPLACE FUNCTION public.get_ambulatory_care_stop_completion_context(p_stop_id uuid) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$SELECT care_private.stop_completion_context(p_stop_id)$$;
CREATE OR REPLACE FUNCTION public.complete_ambulatory_care_stop(p_stop_id uuid,p_expected_stop_updated_at timestamptz,p_documentation text,p_mandatory_confirmed boolean,p_risk_state text,p_risk_detail text,p_risk_action text,p_follow_up text,p_request_id uuid) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$SELECT care_private.complete_stop(p_stop_id,p_expected_stop_updated_at,p_documentation,p_mandatory_confirmed,p_risk_state,p_risk_detail,p_risk_action,p_follow_up,p_request_id)$$;
REVOKE ALL ON FUNCTION care_private.stop_completion_context(uuid),care_private.complete_stop(uuid,timestamptz,text,boolean,text,text,text,text,uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.get_ambulatory_care_stop_completion_context(uuid),public.complete_ambulatory_care_stop(uuid,timestamptz,text,boolean,text,text,text,text,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION care_private.stop_completion_context(uuid),care_private.complete_stop(uuid,timestamptz,text,boolean,text,text,text,text,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_ambulatory_care_stop_completion_context(uuid),public.complete_ambulatory_care_stop(uuid,timestamptz,text,boolean,text,text,text,text,uuid) TO authenticated;

