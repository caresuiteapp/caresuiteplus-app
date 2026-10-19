-- CareSuite+ ambulant: S-02 — tatsächliche Einsatzzeiten als append-only Ereignisse.
-- Planzeiten, Originalereignisse, Korrekturen und fachlicher Abschluss bleiben getrennt.

CREATE TABLE IF NOT EXISTS public.care_tour_stop_time_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  tour_id uuid NOT NULL REFERENCES public.care_tours(id) ON DELETE RESTRICT,
  stop_id uuid NOT NULL REFERENCES public.care_tour_stops(id) ON DELETE RESTRICT,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE RESTRICT,
  event_kind text NOT NULL CHECK (event_kind IN ('start','pause','resume','end','correction')),
  location_context jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(location_context)='object'),
  client_request_id uuid,
  request_fingerprint text,
  corrects_event_id uuid REFERENCES public.care_tour_stop_time_events(id) ON DELETE RESTRICT,
  corrected_occurred_at timestamptz,
  correction_reason text,
  recorded_by uuid NOT NULL,
  recorded_by_name text NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CHECK ((event_kind='correction')=(corrects_event_id IS NOT NULL)),
  CHECK ((event_kind='correction')=(corrected_occurred_at IS NOT NULL)),
  CHECK ((event_kind='correction')=(NULLIF(btrim(correction_reason),'') IS NOT NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS care_stop_time_events_request_unique
  ON public.care_tour_stop_time_events(tenant_id,stop_id,client_request_id)
  WHERE client_request_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS care_stop_time_events_one_start
  ON public.care_tour_stop_time_events(stop_id) WHERE event_kind='start';
CREATE UNIQUE INDEX IF NOT EXISTS care_stop_time_events_one_end
  ON public.care_tour_stop_time_events(stop_id) WHERE event_kind='end';
CREATE INDEX IF NOT EXISTS care_stop_time_events_timeline
  ON public.care_tour_stop_time_events(tenant_id,stop_id,occurred_at,id);
ALTER TABLE public.care_tour_stop_time_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.care_tour_stop_time_events FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION care_private.capture_stop_actual_time() RETURNS trigger
 LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid:=auth.uid(); actor_name text:=COALESCE(NULLIF(public.clinical_actor_name(),''),'Unbekannt');
BEGIN
 IF actor IS NULL THEN RETURN NEW; END IF;
 IF OLD.actual_started_at IS NULL AND NEW.actual_started_at IS NOT NULL THEN
  INSERT INTO public.care_tour_stop_time_events(tenant_id,tour_id,stop_id,client_id,event_kind,location_context,recorded_by,recorded_by_name,occurred_at)
  VALUES(NEW.tenant_id,NEW.tour_id,NEW.id,NEW.client_id,'start',jsonb_build_object('captureMode','status_transition','provided',false),actor,actor_name,NEW.actual_started_at)
  ON CONFLICT (stop_id) WHERE event_kind='start' DO NOTHING;
 ELSIF OLD.actual_started_at IS NOT NULL AND NEW.actual_started_at IS DISTINCT FROM OLD.actual_started_at THEN
  NEW.actual_started_at:=OLD.actual_started_at;
 END IF;
 IF OLD.actual_ended_at IS NULL AND NEW.actual_ended_at IS NOT NULL THEN
  INSERT INTO public.care_tour_stop_time_events(tenant_id,tour_id,stop_id,client_id,event_kind,location_context,recorded_by,recorded_by_name,occurred_at)
  VALUES(NEW.tenant_id,NEW.tour_id,NEW.id,NEW.client_id,'end',jsonb_build_object('captureMode','status_transition','provided',false),actor,actor_name,NEW.actual_ended_at)
  ON CONFLICT (stop_id) WHERE event_kind='end' DO NOTHING;
 ELSIF OLD.actual_ended_at IS NOT NULL AND NEW.actual_ended_at IS DISTINCT FROM OLD.actual_ended_at THEN
  NEW.actual_ended_at:=OLD.actual_ended_at;
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS care_stop_actual_time_capture ON public.care_tour_stops;
CREATE TRIGGER care_stop_actual_time_capture BEFORE UPDATE OF actual_started_at,actual_ended_at ON public.care_tour_stops
 FOR EACH ROW EXECUTE FUNCTION care_private.capture_stop_actual_time();

CREATE OR REPLACE FUNCTION care_private.stop_time_context(p_stop_id uuid) RETURNS jsonb
 LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE t uuid:=public.current_tenant_id(); s public.care_tour_stops; tr public.care_tours; last_kind text;
BEGIN
 IF t IS NULL OR auth.uid() IS NULL THEN RAISE EXCEPTION 'Keine Berechtigung.' USING ERRCODE='42501'; END IF;
 SELECT * INTO s FROM public.care_tour_stops WHERE id=p_stop_id AND tenant_id=t;
 IF NOT FOUND THEN RAISE EXCEPTION 'Einsatz nicht gefunden.' USING ERRCODE='42501'; END IF;
 SELECT * INTO tr FROM public.care_tours WHERE id=s.tour_id AND tenant_id=t;
 IF NOT FOUND OR NOT care_private.stop_opening_allowed(tr) THEN RAISE EXCEPTION 'Keine Berechtigung.' USING ERRCODE='42501'; END IF;
 SELECT event_kind INTO last_kind FROM public.care_tour_stop_time_events
  WHERE stop_id=s.id AND tenant_id=t AND event_kind<>'correction' ORDER BY occurred_at DESC,id DESC LIMIT 1;
 RETURN jsonb_build_object('stopId',s.id,'tourId',tr.id,'clientId',s.client_id,'stopStatus',s.status,
  'plannedStart',s.planned_start,'plannedEnd',s.planned_end,'expectedStopUpdatedAt',s.updated_at,
  'state',CASE last_kind WHEN 'start' THEN 'running' WHEN 'resume' THEN 'running' WHEN 'pause' THEN 'paused' WHEN 'end' THEN 'ended' ELSE 'not_started' END,
  'events',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',e.id,'kind',e.event_kind,'occurredAt',e.occurred_at,
   'locationContext',e.location_context,'recordedByName',e.recorded_by_name,'correctsEventId',e.corrects_event_id,
   'correctedOccurredAt',e.corrected_occurred_at,'correctionReason',e.correction_reason) ORDER BY e.occurred_at,e.id)
   FROM public.care_tour_stop_time_events e WHERE e.stop_id=s.id AND e.tenant_id=t),'[]'::jsonb));
END $$;

CREATE OR REPLACE FUNCTION care_private.record_stop_time_event(
 p_stop_id uuid,p_event_kind text,p_request_id uuid,p_expected_stop_updated_at timestamptz,p_location_context jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE t uuid:=public.current_tenant_id(); s public.care_tour_stops; tr public.care_tours; existing public.care_tour_stop_time_events;
 last_kind text; fingerprint text; event_id uuid; actual_time timestamptz; actor_name text;
BEGIN
 IF t IS NULL OR auth.uid() IS NULL OR p_request_id IS NULL OR p_event_kind NOT IN('pause','resume','end')
  OR jsonb_typeof(COALESCE(p_location_context,'{}'::jsonb))<>'object' THEN RAISE EXCEPTION 'Ungültiges Zeitereignis.' USING ERRCODE='23514'; END IF;
 fingerprint:=md5(jsonb_build_object('kind',p_event_kind,'location',COALESCE(p_location_context,'{}'::jsonb))::text);
 SELECT * INTO s FROM public.care_tour_stops WHERE id=p_stop_id AND tenant_id=t FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Einsatz nicht gefunden.' USING ERRCODE='42501'; END IF;
 SELECT * INTO tr FROM public.care_tours WHERE id=s.tour_id AND tenant_id=t FOR UPDATE;
 IF NOT FOUND OR NOT care_private.stop_opening_allowed(tr) THEN RAISE EXCEPTION 'Keine Berechtigung.' USING ERRCODE='42501'; END IF;
 SELECT * INTO existing FROM public.care_tour_stop_time_events WHERE tenant_id=t AND stop_id=s.id AND client_request_id=p_request_id;
 IF FOUND THEN
  IF existing.request_fingerprint IS DISTINCT FROM fingerprint THEN RAISE EXCEPTION 'Diese Ereignisanfrage wurde bereits mit anderen Angaben verwendet.' USING ERRCODE='40001'; END IF;
  RETURN jsonb_build_object('id',existing.id,'occurredAt',existing.occurred_at,'duplicate',true);
 END IF;
 IF tr.status<>'in_progress' OR s.status<>'in_progress' OR s.updated_at IS DISTINCT FROM p_expected_stop_updated_at THEN
  RAISE EXCEPTION 'Einsatz wurde zwischenzeitlich geändert. Bitte Zeitverlauf neu laden.' USING ERRCODE='40001';
 END IF;
 SELECT event_kind INTO last_kind FROM public.care_tour_stop_time_events
  WHERE stop_id=s.id AND tenant_id=t AND event_kind<>'correction' ORDER BY occurred_at DESC,id DESC LIMIT 1;
 IF (p_event_kind='pause' AND last_kind NOT IN('start','resume')) OR
    (p_event_kind='resume' AND last_kind<>'pause') OR
    (p_event_kind='end' AND last_kind NOT IN('start','resume')) THEN
  RAISE EXCEPTION 'Zeitereignis passt nicht zum tatsächlichen Einsatzverlauf.' USING ERRCODE='23514';
 END IF;
 actual_time:=clock_timestamp(); actor_name:=COALESCE(NULLIF(public.clinical_actor_name(),''),NULLIF(tr.employee_name_snapshot,''),'Unbekannt');
 INSERT INTO public.care_tour_stop_time_events(tenant_id,tour_id,stop_id,client_id,event_kind,location_context,client_request_id,request_fingerprint,recorded_by,recorded_by_name,occurred_at)
 VALUES(t,tr.id,s.id,s.client_id,p_event_kind,COALESCE(p_location_context,'{}'::jsonb),p_request_id,fingerprint,auth.uid(),actor_name,actual_time) RETURNING id INTO event_id;
 UPDATE public.care_tour_stops SET actual_ended_at=CASE WHEN p_event_kind='end' THEN actual_time ELSE actual_ended_at END,updated_at=actual_time WHERE id=s.id;
 RETURN jsonb_build_object('id',event_id,'occurredAt',actual_time,'duplicate',false);
END $$;

CREATE OR REPLACE FUNCTION care_private.correct_stop_time_event(
 p_event_id uuid,p_request_id uuid,p_corrected_occurred_at timestamptz,p_reason text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE t uuid:=public.current_tenant_id(); target public.care_tour_stop_time_events; tr public.care_tours;
 existing public.care_tour_stop_time_events; fingerprint text; correction_id uuid; actor_name text;
BEGIN
 IF t IS NULL OR auth.uid() IS NULL OR p_request_id IS NULL OR p_corrected_occurred_at IS NULL OR COALESCE(btrim(p_reason),'')='' THEN
  RAISE EXCEPTION 'Korrekturzeit und Korrekturgrund sind erforderlich.' USING ERRCODE='23514'; END IF;
 SELECT * INTO target FROM public.care_tour_stop_time_events WHERE id=p_event_id AND tenant_id=t FOR SHARE;
 IF NOT FOUND OR target.event_kind='correction' THEN RAISE EXCEPTION 'Originalereignis nicht gefunden.' USING ERRCODE='42501'; END IF;
 SELECT * INTO tr FROM public.care_tours WHERE id=target.tour_id AND tenant_id=t;
 IF NOT FOUND OR NOT care_private.stop_opening_allowed(tr) THEN RAISE EXCEPTION 'Keine Berechtigung.' USING ERRCODE='42501'; END IF;
 fingerprint:=md5(jsonb_build_object('eventId',target.id,'correctedOccurredAt',p_corrected_occurred_at,'reason',btrim(p_reason))::text);
 SELECT * INTO existing FROM public.care_tour_stop_time_events WHERE tenant_id=t AND stop_id=target.stop_id AND client_request_id=p_request_id;
 IF FOUND THEN
  IF existing.request_fingerprint IS DISTINCT FROM fingerprint THEN RAISE EXCEPTION 'Diese Korrekturanfrage wurde bereits mit anderen Angaben verwendet.' USING ERRCODE='40001'; END IF;
  RETURN jsonb_build_object('id',existing.id,'duplicate',true);
 END IF;
 actor_name:=COALESCE(NULLIF(public.clinical_actor_name(),''),NULLIF(tr.employee_name_snapshot,''),'Unbekannt');
 INSERT INTO public.care_tour_stop_time_events(tenant_id,tour_id,stop_id,client_id,event_kind,location_context,client_request_id,request_fingerprint,corrects_event_id,corrected_occurred_at,correction_reason,recorded_by,recorded_by_name)
 VALUES(t,target.tour_id,target.stop_id,target.client_id,'correction','{}'::jsonb,p_request_id,fingerprint,target.id,p_corrected_occurred_at,btrim(p_reason),auth.uid(),actor_name)
 RETURNING id INTO correction_id;
 RETURN jsonb_build_object('id',correction_id,'duplicate',false);
END $$;

CREATE OR REPLACE FUNCTION public.get_ambulatory_care_stop_time_context(p_stop_id uuid) RETURNS jsonb
 LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$SELECT care_private.stop_time_context(p_stop_id)$$;
CREATE OR REPLACE FUNCTION public.record_ambulatory_care_stop_time_event(p_stop_id uuid,p_event_kind text,p_request_id uuid,p_expected_stop_updated_at timestamptz,p_location_context jsonb) RETURNS jsonb
 LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$SELECT care_private.record_stop_time_event(p_stop_id,p_event_kind,p_request_id,p_expected_stop_updated_at,p_location_context)$$;
CREATE OR REPLACE FUNCTION public.correct_ambulatory_care_stop_time_event(p_event_id uuid,p_request_id uuid,p_corrected_occurred_at timestamptz,p_reason text) RETURNS jsonb
 LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$SELECT care_private.correct_stop_time_event(p_event_id,p_request_id,p_corrected_occurred_at,p_reason)$$;
REVOKE ALL ON FUNCTION care_private.capture_stop_actual_time(),care_private.stop_time_context(uuid),care_private.record_stop_time_event(uuid,text,uuid,timestamptz,jsonb),care_private.correct_stop_time_event(uuid,uuid,timestamptz,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.get_ambulatory_care_stop_time_context(uuid),public.record_ambulatory_care_stop_time_event(uuid,text,uuid,timestamptz,jsonb),public.correct_ambulatory_care_stop_time_event(uuid,uuid,timestamptz,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION care_private.stop_time_context(uuid),care_private.record_stop_time_event(uuid,text,uuid,timestamptz,jsonb),care_private.correct_stop_time_event(uuid,uuid,timestamptz,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_ambulatory_care_stop_time_context(uuid),public.record_ambulatory_care_stop_time_event(uuid,text,uuid,timestamptz,jsonb),public.correct_ambulatory_care_stop_time_event(uuid,uuid,timestamptz,text) TO authenticated;
