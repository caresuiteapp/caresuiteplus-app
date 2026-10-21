-- CareSuite+ ambulant: S-03 — geplante Aufgaben und tatsächliche Einzeldokumentation.
-- Ein Planpunkt oder Häkchen wird nie als Durchführung, Abschluss oder Freigabe ausgelegt.

ALTER TABLE public.care_tour_stop_openings
  ADD COLUMN IF NOT EXISTS plan_items_snapshot jsonb NOT NULL DEFAULT '[]'::jsonb;

CREATE TABLE IF NOT EXISTS public.care_tour_stop_task_bindings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  tour_id uuid NOT NULL REFERENCES public.care_tours(id) ON DELETE RESTRICT,
  stop_id uuid NOT NULL REFERENCES public.care_tour_stops(id) ON DELETE RESTRICT,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE RESTRICT,
  opening_id uuid NOT NULL REFERENCES public.care_tour_stop_openings(id) ON DELETE RESTRICT,
  care_plan_id uuid NOT NULL REFERENCES public.care_plans(id) ON DELETE RESTRICT,
  care_plan_version integer NOT NULL,
  plan_item_id uuid NOT NULL,
  plan_item_updated_at timestamptz NOT NULL,
  planned_task_snapshot jsonb NOT NULL CHECK (jsonb_typeof(planned_task_snapshot)='object'),
  bound_by uuid NOT NULL,
  bound_by_name text NOT NULL,
  bound_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE UNIQUE INDEX IF NOT EXISTS care_stop_task_bindings_item_unique
  ON public.care_tour_stop_task_bindings(stop_id,plan_item_id);
CREATE INDEX IF NOT EXISTS care_stop_task_bindings_timeline
  ON public.care_tour_stop_task_bindings(tenant_id,stop_id,bound_at,id);

CREATE TABLE IF NOT EXISTS public.care_tour_stop_task_executions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  tour_id uuid NOT NULL REFERENCES public.care_tours(id) ON DELETE RESTRICT,
  stop_id uuid NOT NULL REFERENCES public.care_tour_stops(id) ON DELETE RESTRICT,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE RESTRICT,
  binding_id uuid NOT NULL REFERENCES public.care_tour_stop_task_bindings(id) ON DELETE RESTRICT,
  outcome text NOT NULL CHECK (outcome IN ('performed','not_performed','refused')),
  result_detail text NOT NULL CHECK (length(btrim(result_detail)) BETWEEN 5 AND 4000),
  has_deviation boolean NOT NULL,
  deviation_reason text,
  observation text,
  client_request_id uuid NOT NULL,
  request_fingerprint text NOT NULL,
  recorded_by uuid NOT NULL,
  recorded_by_name text NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CHECK ((has_deviation OR outcome<>'performed')=(NULLIF(btrim(deviation_reason),'') IS NOT NULL)),
  CHECK (deviation_reason IS NULL OR length(deviation_reason)<=2000),
  CHECK (observation IS NULL OR length(observation)<=4000)
);
CREATE UNIQUE INDEX IF NOT EXISTS care_stop_task_executions_binding_unique
  ON public.care_tour_stop_task_executions(binding_id);
CREATE UNIQUE INDEX IF NOT EXISTS care_stop_task_executions_request_unique
  ON public.care_tour_stop_task_executions(tenant_id,stop_id,client_request_id);
ALTER TABLE public.care_tour_stop_task_bindings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.care_tour_stop_task_executions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.care_tour_stop_task_bindings,public.care_tour_stop_task_executions FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION care_private.stop_task_context(p_stop_id uuid) RETURNS jsonb
 LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE t uuid:=public.current_tenant_id(); s public.care_tour_stops; tr public.care_tours; o public.care_tour_stop_openings; task_count integer;
BEGIN
 IF t IS NULL OR auth.uid() IS NULL THEN RAISE EXCEPTION 'Keine Berechtigung.' USING ERRCODE='42501'; END IF;
 SELECT * INTO s FROM public.care_tour_stops WHERE id=p_stop_id AND tenant_id=t;
 IF NOT FOUND THEN RAISE EXCEPTION 'Einsatz nicht gefunden.' USING ERRCODE='42501'; END IF;
 SELECT * INTO tr FROM public.care_tours WHERE id=s.tour_id AND tenant_id=t;
 IF NOT FOUND OR NOT care_private.stop_opening_allowed(tr) THEN RAISE EXCEPTION 'Keine Berechtigung.' USING ERRCODE='42501'; END IF;
 SELECT * INTO o FROM public.care_tour_stop_openings WHERE stop_id=s.id AND tenant_id=t;
 SELECT count(*) INTO task_count FROM public.care_tour_stop_task_bindings WHERE stop_id=s.id AND tenant_id=t;
 RETURN jsonb_build_object('stopId',s.id,'tourId',tr.id,'clientId',s.client_id,'stopStatus',s.status,
  'openingId',o.id,'prepared',task_count>0,'availableTaskCount',COALESCE(jsonb_array_length(o.plan_items_snapshot),0),
  'tasks',COALESCE((SELECT jsonb_agg(jsonb_build_object(
    'bindingId',b.id,'planItemId',b.plan_item_id,'planItemUpdatedAt',b.plan_item_updated_at,
    'plannedTask',b.planned_task_snapshot,'boundAt',b.bound_at,
    'execution',CASE WHEN e.id IS NULL THEN NULL ELSE jsonb_build_object('id',e.id,'outcome',e.outcome,
      'resultDetail',e.result_detail,'hasDeviation',e.has_deviation,'deviationReason',e.deviation_reason,
      'observation',e.observation,'recordedByName',e.recorded_by_name,'recordedAt',e.recorded_at) END)
   ORDER BY COALESCE((b.planned_task_snapshot->>'sortOrder')::integer,0),b.plan_item_id)
   FROM public.care_tour_stop_task_bindings b LEFT JOIN public.care_tour_stop_task_executions e ON e.binding_id=b.id
   WHERE b.stop_id=s.id AND b.tenant_id=t),'[]'::jsonb));
END $$;

CREATE OR REPLACE FUNCTION care_private.prepare_stop_tasks(p_stop_id uuid) RETURNS jsonb
 LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE t uuid:=public.current_tenant_id(); s public.care_tour_stops; tr public.care_tours; o public.care_tour_stop_openings; item jsonb; actor_name text; expected_count integer; actual_count integer;
BEGIN
 IF t IS NULL OR auth.uid() IS NULL THEN RAISE EXCEPTION 'Keine Berechtigung.' USING ERRCODE='42501'; END IF;
 SELECT * INTO s FROM public.care_tour_stops WHERE id=p_stop_id AND tenant_id=t FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Einsatz nicht gefunden.' USING ERRCODE='42501'; END IF;
 SELECT * INTO tr FROM public.care_tours WHERE id=s.tour_id AND tenant_id=t FOR UPDATE;
 IF NOT FOUND OR NOT care_private.stop_opening_allowed(tr) THEN RAISE EXCEPTION 'Keine Berechtigung.' USING ERRCODE='42501'; END IF;
 SELECT * INTO o FROM public.care_tour_stop_openings WHERE stop_id=s.id AND tenant_id=t FOR SHARE;
 IF NOT FOUND OR tr.status<>'in_progress' OR s.status<>'in_progress' THEN
  RAISE EXCEPTION 'Aufgaben können erst nach bestätigtem Versorgungsbeginn gebunden werden.' USING ERRCODE='23514';
 END IF;
 expected_count:=jsonb_array_length(o.plan_items_snapshot);
 IF expected_count=0 THEN RAISE EXCEPTION 'Beim Versorgungsbeginn wurden keine offenen Planaufgaben gebunden.' USING ERRCODE='23514'; END IF;
 actor_name:=COALESCE(NULLIF(public.clinical_actor_name(),''),NULLIF(tr.employee_name_snapshot,''),'Unbekannt');
 FOR item IN SELECT value FROM jsonb_array_elements(o.plan_items_snapshot) LOOP
  IF NULLIF(item->>'id','') IS NULL OR NULLIF(item->>'updatedAt','') IS NULL OR NULLIF(btrim(item->>'title'),'') IS NULL THEN
   RAISE EXCEPTION 'Der ursprüngliche Planaufgabenbezug ist unvollständig.' USING ERRCODE='23514';
  END IF;
  INSERT INTO public.care_tour_stop_task_bindings(tenant_id,tour_id,stop_id,client_id,opening_id,care_plan_id,care_plan_version,plan_item_id,plan_item_updated_at,planned_task_snapshot,bound_by,bound_by_name)
  VALUES(t,tr.id,s.id,s.client_id,o.id,o.care_plan_id,o.care_plan_version,(item->>'id')::uuid,(item->>'updatedAt')::timestamptz,item,auth.uid(),actor_name)
  ON CONFLICT (stop_id,plan_item_id) DO NOTHING;
 END LOOP;
 SELECT count(*) INTO actual_count FROM public.care_tour_stop_task_bindings WHERE stop_id=s.id AND tenant_id=t AND opening_id=o.id;
 IF actual_count<>expected_count THEN RAISE EXCEPTION 'Planaufgabenbindung ist unvollständig.' USING ERRCODE='40001'; END IF;
 RETURN care_private.stop_task_context(s.id);
END $$;

CREATE OR REPLACE FUNCTION care_private.record_stop_task_execution(
 p_binding_id uuid,p_outcome text,p_result_detail text,p_has_deviation boolean,
 p_deviation_reason text,p_observation text,p_request_id uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE t uuid:=public.current_tenant_id(); b public.care_tour_stop_task_bindings; s public.care_tour_stops; tr public.care_tours;
 existing public.care_tour_stop_task_executions; last_kind text; fingerprint text; execution_id uuid; actual_time timestamptz; actor_name text;
BEGIN
 IF t IS NULL OR auth.uid() IS NULL OR p_request_id IS NULL OR p_outcome NOT IN('performed','not_performed','refused')
  OR length(btrim(COALESCE(p_result_detail,''))) NOT BETWEEN 5 AND 4000
  OR ((COALESCE(p_has_deviation,false) OR p_outcome<>'performed') AND length(btrim(COALESCE(p_deviation_reason,''))) NOT BETWEEN 5 AND 2000)
  OR (NOT COALESCE(p_has_deviation,false) AND p_outcome='performed' AND NULLIF(btrim(COALESCE(p_deviation_reason,'')),'') IS NOT NULL)
  OR length(COALESCE(p_observation,''))>4000 THEN RAISE EXCEPTION 'Ergebnis und erforderliche Abweichung müssen fachlich beschrieben werden.' USING ERRCODE='23514'; END IF;
 fingerprint:=md5(jsonb_build_object('bindingId',p_binding_id,'outcome',p_outcome,'result',btrim(p_result_detail),
  'hasDeviation',COALESCE(p_has_deviation,false),'deviation',NULLIF(btrim(COALESCE(p_deviation_reason,'')),''),
  'observation',NULLIF(btrim(COALESCE(p_observation,'')),''))::text);
 SELECT * INTO b FROM public.care_tour_stop_task_bindings WHERE id=p_binding_id AND tenant_id=t FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Gebundene Planaufgabe nicht gefunden.' USING ERRCODE='42501'; END IF;
 SELECT * INTO s FROM public.care_tour_stops WHERE id=b.stop_id AND tenant_id=t FOR UPDATE;
 SELECT * INTO tr FROM public.care_tours WHERE id=b.tour_id AND tenant_id=t FOR UPDATE;
 IF NOT FOUND OR NOT care_private.stop_opening_allowed(tr) THEN RAISE EXCEPTION 'Keine Berechtigung.' USING ERRCODE='42501'; END IF;
 SELECT * INTO existing FROM public.care_tour_stop_task_executions WHERE tenant_id=t AND stop_id=b.stop_id AND client_request_id=p_request_id;
 IF FOUND THEN
  IF existing.recorded_by IS DISTINCT FROM auth.uid() OR existing.request_fingerprint IS DISTINCT FROM fingerprint THEN
   RAISE EXCEPTION 'Diese Aufgabenanfrage wurde bereits mit anderen Angaben verwendet.' USING ERRCODE='40001';
  END IF;
  RETURN jsonb_build_object('id',existing.id,'recordedAt',existing.recorded_at,'duplicate',true);
 END IF;
 IF tr.status<>'in_progress' OR s.status<>'in_progress' THEN RAISE EXCEPTION 'Einsatz ist nicht mehr in Durchführung.' USING ERRCODE='40001'; END IF;
 IF EXISTS(SELECT 1 FROM public.care_tour_stop_task_executions WHERE binding_id=b.id) THEN
  RAISE EXCEPTION 'Für diese Planaufgabe liegt bereits eine Originaldokumentation vor.' USING ERRCODE='40001';
 END IF;
 SELECT event_kind INTO last_kind FROM public.care_tour_stop_time_events WHERE tenant_id=t AND stop_id=s.id AND event_kind<>'correction' ORDER BY occurred_at DESC,id DESC LIMIT 1;
 IF last_kind IS NULL OR last_kind='end' THEN RAISE EXCEPTION 'Aufgaben dürfen nur innerhalb des tatsächlichen Einsatzzeitverlaufs dokumentiert werden.' USING ERRCODE='23514'; END IF;
 actual_time:=clock_timestamp(); actor_name:=COALESCE(NULLIF(public.clinical_actor_name(),''),NULLIF(tr.employee_name_snapshot,''),'Unbekannt');
 INSERT INTO public.care_tour_stop_task_executions(tenant_id,tour_id,stop_id,client_id,binding_id,outcome,result_detail,has_deviation,deviation_reason,observation,client_request_id,request_fingerprint,recorded_by,recorded_by_name,recorded_at)
 VALUES(t,tr.id,s.id,s.client_id,b.id,p_outcome,btrim(p_result_detail),COALESCE(p_has_deviation,false),NULLIF(btrim(COALESCE(p_deviation_reason,'')),''),NULLIF(btrim(COALESCE(p_observation,'')),''),p_request_id,fingerprint,auth.uid(),actor_name,actual_time)
 RETURNING id INTO execution_id;
 RETURN jsonb_build_object('id',execution_id,'recordedAt',actual_time,'duplicate',false);
END $$;

CREATE OR REPLACE FUNCTION public.get_ambulatory_care_stop_task_context(p_stop_id uuid) RETURNS jsonb
 LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$SELECT care_private.stop_task_context(p_stop_id)$$;
CREATE OR REPLACE FUNCTION public.prepare_ambulatory_care_stop_tasks(p_stop_id uuid) RETURNS jsonb
 LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$SELECT care_private.prepare_stop_tasks(p_stop_id)$$;
CREATE OR REPLACE FUNCTION public.record_ambulatory_care_stop_task_execution(p_binding_id uuid,p_outcome text,p_result_detail text,p_has_deviation boolean,p_deviation_reason text,p_observation text,p_request_id uuid) RETURNS jsonb
 LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$SELECT care_private.record_stop_task_execution(p_binding_id,p_outcome,p_result_detail,p_has_deviation,p_deviation_reason,p_observation,p_request_id)$$;
REVOKE ALL ON FUNCTION care_private.stop_task_context(uuid),care_private.prepare_stop_tasks(uuid),care_private.record_stop_task_execution(uuid,text,text,boolean,text,text,uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.get_ambulatory_care_stop_task_context(uuid),public.prepare_ambulatory_care_stop_tasks(uuid),public.record_ambulatory_care_stop_task_execution(uuid,text,text,boolean,text,text,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION care_private.stop_task_context(uuid),care_private.prepare_stop_tasks(uuid),care_private.record_stop_task_execution(uuid,text,text,boolean,text,text,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_ambulatory_care_stop_task_context(uuid),public.prepare_ambulatory_care_stop_tasks(uuid),public.record_ambulatory_care_stop_task_execution(uuid,text,text,boolean,text,text,uuid) TO authenticated;
