-- CP222 / S-10: read-only reconciliation of an uncertain care-stop write.
-- This function never repeats a write.  It confirms only an original row whose
-- request id, operation, actor and fingerprint match the frozen request.

CREATE OR REPLACE FUNCTION care_private.reconcile_stop_write(
 p_operation text,p_request_id uuid,p_frozen_payload jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
 t uuid:=public.current_tenant_id(); expected_fingerprint text; candidate_count integer;
 candidate record; checked_at timestamptz:=clock_timestamp();
BEGIN
 IF t IS NULL OR auth.uid() IS NULL THEN
  RAISE EXCEPTION 'Keine Berechtigung.' USING ERRCODE='42501';
 END IF;
 IF p_request_id IS NULL OR jsonb_typeof(p_frozen_payload) IS DISTINCT FROM 'object'
  OR p_operation NOT IN('emergency_open','emergency_event','stop_completion') THEN
  RAISE EXCEPTION 'Anfrage-ID, Vorgangsart und unveränderte Nutzdaten sind erforderlich.' USING ERRCODE='23514';
 END IF;

 CASE p_operation
  WHEN 'emergency_open' THEN
   IF COALESCE(p_frozen_payload->>'stopId','')='' OR COALESCE(p_frozen_payload->>'expectedStopUpdatedAt','')=''
    OR COALESCE(p_frozen_payload->>'observedFacts','')='' OR COALESCE(p_frozen_payload->>'severity','')=''
    OR COALESCE(p_frozen_payload->>'immediateMeasure','')='' THEN
    RAISE EXCEPTION 'Die eingefrorene Notfallanfrage ist unvollständig.' USING ERRCODE='23514';
   END IF;
   expected_fingerprint:=md5(jsonb_build_object(
    'stopId',(p_frozen_payload->>'stopId')::uuid,
    'expected',(p_frozen_payload->>'expectedStopUpdatedAt')::timestamptz,
    'facts',btrim(p_frozen_payload->>'observedFacts'),
    'severity',p_frozen_payload->>'severity',
    'measure',btrim(p_frozen_payload->>'immediateMeasure'))::text);
  WHEN 'emergency_event' THEN
   IF COALESCE(p_frozen_payload->>'incidentId','')='' OR COALESCE(p_frozen_payload->>'kind','')=''
    OR COALESCE(p_frozen_payload->>'detail','')='' THEN
    RAISE EXCEPTION 'Das eingefrorene Notfallereignis ist unvollständig.' USING ERRCODE='23514';
   END IF;
   expected_fingerprint:=md5(jsonb_build_object(
    'incidentId',(p_frozen_payload->>'incidentId')::uuid,
    'kind',p_frozen_payload->>'kind','detail',btrim(p_frozen_payload->>'detail'),
    'channel',NULLIF(p_frozen_payload->>'channel',''),
    'target',NULLIF(btrim(COALESCE(p_frozen_payload->>'targetLabel','')),''),
    'reference',NULLIF(p_frozen_payload->>'referenceEventId','')::uuid,
    'outcome',NULLIF(p_frozen_payload->>'outcome',''),
    'recipient',NULLIF(btrim(COALESCE(p_frozen_payload->>'recipientName','')),''),
    'role',NULLIF(btrim(COALESCE(p_frozen_payload->>'recipientRole','')),''),
    'responsibility',NULLIF(btrim(COALESCE(p_frozen_payload->>'responsibility','')),''),
    'confirmation',NULLIF(btrim(COALESCE(p_frozen_payload->>'confirmation','')),''),
    'assignee',NULLIF(btrim(COALESCE(p_frozen_payload->>'assigneeLabel','')),''),
    'dueAt',NULLIF(p_frozen_payload->>'dueAt','')::timestamptz,
    'noHandoverReason',NULLIF(btrim(COALESCE(p_frozen_payload->>'noHandoverReason','')),''))::text);
  WHEN 'stop_completion' THEN
   IF COALESCE(p_frozen_payload->>'stopId','')='' OR COALESCE(p_frozen_payload->>'expectedStopUpdatedAt','')=''
    OR COALESCE(p_frozen_payload->>'documentation','')='' OR COALESCE(p_frozen_payload->>'riskState','')=''
    OR COALESCE((p_frozen_payload->>'mandatoryConfirmed')::boolean,false)=false THEN
    RAISE EXCEPTION 'Die eingefrorene Abschlussanfrage ist unvollständig.' USING ERRCODE='23514';
   END IF;
   expected_fingerprint:=md5(jsonb_build_object(
    'stopId',(p_frozen_payload->>'stopId')::uuid,
    'expectedStopUpdatedAt',(p_frozen_payload->>'expectedStopUpdatedAt')::timestamptz,
    'documentation',btrim(p_frozen_payload->>'documentation'),'mandatoryConfirmed',true,
    'riskState',p_frozen_payload->>'riskState',
    'riskDetail',NULLIF(btrim(COALESCE(p_frozen_payload->>'riskDetail','')),''),
    'riskAction',NULLIF(btrim(COALESCE(p_frozen_payload->>'riskAction','')),''),
    'followUp',NULLIF(btrim(COALESCE(p_frozen_payload->>'followUp','')),''))::text);
 END CASE;

 SELECT count(*) INTO candidate_count FROM (
  SELECT 'emergency_open' operation FROM public.care_tour_stop_emergencies
   WHERE tenant_id=t AND client_request_id=p_request_id AND opened_by=auth.uid()
  UNION ALL
  SELECT 'emergency_event' operation FROM public.care_tour_stop_emergency_events
   WHERE tenant_id=t AND client_request_id=p_request_id AND recorded_by=auth.uid()
  UNION ALL
  SELECT 'stop_completion' operation FROM public.care_tour_stop_completions
   WHERE tenant_id=t AND client_request_id=p_request_id AND completed_by=auth.uid()
 ) matches;
 IF candidate_count=0 THEN
  RETURN jsonb_build_object('state','not_found','operation',p_operation,'requestId',p_request_id,
   'serverCheckedAt',checked_at,'message','Zum Serverzeitpunkt liegt kein passender Originalbeleg vor; die Anfrage bleibt ungeklärt.');
 END IF;
 IF candidate_count<>1 THEN
  RETURN jsonb_build_object('state','conflict','operation',p_operation,'requestId',p_request_id,
   'serverCheckedAt',checked_at,'message','Die Anfrage-ID ist nicht eindeutig. Nicht erneut senden.');
 END IF;

 SELECT * INTO candidate FROM (
  SELECT 'emergency_open'::text operation,id record_id,stop_id,request_fingerprint,opened_at recorded_at
   FROM public.care_tour_stop_emergencies
   WHERE tenant_id=t AND client_request_id=p_request_id AND opened_by=auth.uid()
  UNION ALL
  SELECT 'emergency_event',id,stop_id,request_fingerprint,recorded_at
   FROM public.care_tour_stop_emergency_events
   WHERE tenant_id=t AND client_request_id=p_request_id AND recorded_by=auth.uid()
  UNION ALL
  SELECT 'stop_completion',id,stop_id,request_fingerprint,completed_at
   FROM public.care_tour_stop_completions
   WHERE tenant_id=t AND client_request_id=p_request_id AND completed_by=auth.uid()
 ) matches LIMIT 1;
 IF candidate.operation IS DISTINCT FROM p_operation OR candidate.request_fingerprint IS DISTINCT FROM expected_fingerprint THEN
  RETURN jsonb_build_object('state','conflict','operation',p_operation,'requestId',p_request_id,
   'serverCheckedAt',checked_at,'message','Anfrage-ID, Vorgangsart oder unveränderte Nutzdaten stimmen nicht überein. Nicht erneut senden.');
 END IF;
 RETURN jsonb_build_object('state','confirmed','operation',candidate.operation,'requestId',p_request_id,
  'recordId',candidate.record_id,'stopId',candidate.stop_id,'recordedAt',candidate.recorded_at,
  'serverCheckedAt',checked_at,'requestFingerprint',candidate.request_fingerprint,
  'message','Der ursprüngliche Serverbeleg ist eindeutig bestätigt; keine zweite Leistung anlegen.');
END $$;

CREATE OR REPLACE FUNCTION public.reconcile_ambulatory_care_stop_write(
 p_operation text,p_request_id uuid,p_frozen_payload jsonb
) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$
 SELECT care_private.reconcile_stop_write(p_operation,p_request_id,p_frozen_payload)
$$;

REVOKE ALL ON FUNCTION care_private.reconcile_stop_write(text,uuid,jsonb),public.reconcile_ambulatory_care_stop_write(text,uuid,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION care_private.reconcile_stop_write(text,uuid,jsonb),public.reconcile_ambulatory_care_stop_write(text,uuid,jsonb) TO authenticated;
