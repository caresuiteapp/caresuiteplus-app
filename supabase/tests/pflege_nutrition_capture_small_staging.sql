-- NEW supplementary unit; larger Nutrition fixtures remain unchanged.
-- Privileged synthetic claims only, no HTTP/RLS/browser/clinical acceptance claim.
-- Applied Nutrition base only; no canonical/planned-inspection followup required.
BEGIN;
SET LOCAL statement_timeout='15s';
SET LOCAL lock_timeout='5s';
DO $unit$
DECLARE
 t uuid:=gen_random_uuid();c uuid:=gen_random_uuid();u uuid:=gen_random_uuid();r uuid:=gen_random_uuid();s uuid:=gen_random_uuid();
 plan_id uuid:=gen_random_uuid();version_id uuid:=gen_random_uuid();item_id uuid:=gen_random_uuid();tour_id uuid:=gen_random_uuid();stop_id uuid:=gen_random_uuid();assessment_id uuid:=gen_random_uuid();
 capture_id uuid:=gen_random_uuid();care_id uuid:=gen_random_uuid();
 day date:=(clock_timestamp()AT TIME ZONE 'Europe/Berlin')::date-1;instant timestamptz;at_text text;
 context jsonb;native_before jsonb;capture_packet jsonb;capture_receipt jsonb;capture_confirmed jsonb;
 entry jsonb;packet jsonb;receipt jsonb;confirmed jsonb;field text;finished boolean:=false;
BEGIN
 BEGIN
  INSERT INTO public.tenants(id,name)VALUES(t,'Synthetic Nutrition small capture unit');
  INSERT INTO public.roles(id,key,name)VALUES(r,'synthetic_nutrition_small_'||r,'Synthetic Nutrition planning author');
  INSERT INTO public.role_permissions(role_id,permission_key)SELECT r,unnest(ARRAY['pflege.plans.view','pflege.plans.manage','pflege.documentation.view','pflege.documentation.create','pflege.vitals.view']);
  INSERT INTO auth.users(id,email,raw_user_meta_data,raw_app_meta_data)VALUES(u,u||'@example.invalid','{}','{}');
  UPDATE public.profiles SET tenant_id=t,role_id=r,role_key='pfleger',is_active=true,status='active',display_name='Synthetic Nutrition small author'WHERE id=u;
  INSERT INTO auth.sessions(id,user_id,not_after)VALUES(s,u,clock_timestamp()+interval '1 hour');
  INSERT INTO public.clients(id,tenant_id,first_name,last_name,status,lifecycle_status)VALUES(c,t,'Synthetic','Nutrition small case','aktiv','aktiv');
  INSERT INTO public.client_module_assignments(tenant_id,client_id,module_key,status,is_active)VALUES(t,c,'pflege','active',true);
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated','session_id',s,'exp',extract(epoch FROM clock_timestamp()+interval '1 hour')::bigint)::text,true);
  IF auth.uid()IS DISTINCT FROM u OR public.resolve_current_profile_id()IS DISTINCT FROM u OR public.current_tenant_id()IS DISTINCT FROM t THEN RAISE EXCEPTION 'Synthetic actual own Auth/profile/tenant not established';END IF;
  INSERT INTO public.care_plans(id,tenant_id,client_id,title,status,valid_from,valid_until)VALUES(plan_id,t,c,'Synthetic explicit Nutrition planning','aktiv',day-1,day+7);
  INSERT INTO public.care_plan_items(id,tenant_id,care_plan_id,category,title,intervention,status,sort_order,created_by,updated_by)
   VALUES(item_id,t,plan_id,'drink_protocol','Synthetic explicitly planned drink support','Synthetic authored planning, no actual intake','active',1,u,u);
  INSERT INTO public.care_plan_versions(id,tenant_id,care_plan_id,version,snapshot,reason,actor_id,actor_name)
   SELECT version_id,t,plan_id,1,jsonb_build_object('plan',to_jsonb(p),'items',(SELECT jsonb_agg(to_jsonb(i)ORDER BY i.id)FROM public.care_plan_items i WHERE i.care_plan_id=plan_id)),'Synthetic exact full native plan snapshot',u,'Synthetic Nutrition small author'FROM public.care_plans p WHERE p.id=plan_id;
  INSERT INTO public.care_tours(id,tenant_id,tour_date,name,status,created_by,updated_by)VALUES(tour_id,t,day,'Synthetic published Nutrition small tour','published',u,u);
  INSERT INTO public.care_tour_stops(id,tenant_id,tour_id,sequence_no,client_id,client_name_snapshot,planned_start,planned_end,status)
   VALUES(stop_id,t,tour_id,1,c,'Synthetic Nutrition small case','12:15:30.123456','12:45:30.123456','planned');
  INSERT INTO public.care_assessments(id,tenant_id,subject_type,subject_id,subject_name_snapshot,variant,status,version,assessor_profile_id,assessor_name_snapshot,created_by,updated_by)
   VALUES(assessment_id,t,'client',c,'Synthetic Nutrition small case','ambulant','draft',1,u,'Synthetic Nutrition small author',u,u);
  instant:=(day+time '12:15:30.123456')AT TIME ZONE 'Europe/Berlin';
  at_text:=to_char(instant AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"');
  context:=public.web_read_nutrition_elimination_binding_context(t,c,u,version_id,item_id,stop_id,assessment_id);
  SELECT jsonb_build_object('plan',(SELECT to_jsonb(x)FROM public.care_plans x WHERE x.id=plan_id),'planVersion',(SELECT to_jsonb(x)FROM public.care_plan_versions x WHERE x.id=version_id),'measure',(SELECT to_jsonb(x)FROM public.care_plan_items x WHERE x.id=item_id),'visit',(SELECT to_jsonb(x)FROM public.care_tour_stops x WHERE x.id=stop_id),'tour',(SELECT to_jsonb(x)FROM public.care_tours x WHERE x.id=tour_id),'assessment',(SELECT to_jsonb(x)FROM public.care_assessments x WHERE x.id=assessment_id),'assessmentTopics','[]'::jsonb,'assessmentRisks','[]'::jsonb,'assessmentMeasures','[]'::jsonb,'instrumentSelection',null,'model',null,'instruments','[]'::jsonb)INTO native_before;
  IF context->'nativeOriginals'IS DISTINCT FROM native_before OR(context->>'planSnapshotSha256'~'^sha256:[a-f0-9]{64}$')IS NOT TRUE OR context#>'{sources,devices}'IS DISTINCT FROM '[]'::jsonb OR context#>'{sources,protocols}'IS DISTINCT FROM '[]'::jsonb OR context#>'{sources,weights}'IS DISTINCT FROM '[]'::jsonb OR context#>'{sources,tasks}'IS DISTINCT FROM '[]'::jsonb OR context#>>'{sources,assessment,id}'IS DISTINCT FROM assessment_id::text THEN RAISE EXCEPTION 'Actual context lost full independent originals or inferred clinical sources';END IF;
  capture_packet:=jsonb_build_object('schemaVersion','1','requestId',capture_id,'tenantId',t,'clientId',c,'actorId',u,'planVersionId',version_id,'measureId',item_id,'visitId',stop_id,'assessmentId',assessment_id,'kind','drink_protocol','title','Synthetic explicitly planned drink support','plannedAt',at_text,'nativeOriginals',context->'nativeOriginals','sources',context->'sources');
  capture_receipt:=public.web_capture_nutrition_elimination_plan_binding(capture_packet);
  IF capture_receipt->'packet'IS DISTINCT FROM capture_packet OR capture_receipt->>'requestId'IS DISTINCT FROM capture_id::text OR capture_receipt#>'{binding,nativeOriginals}'IS DISTINCT FROM native_before OR capture_receipt#>'{binding,sources}'IS DISTINCT FROM context->'sources'OR capture_receipt#>'{binding,planSnapshotSha256}'IS DISTINCT FROM context->'planSnapshotSha256'OR capture_receipt#>>'{binding,capturedBy}'IS DISTINCT FROM u::text OR(capture_receipt#>>'{binding,plannedAt}')::timestamptz IS DISTINCT FROM instant THEN RAISE EXCEPTION 'Capture own receipt lost exact original context SHA, actor or actual microseconds';END IF;
  FOREACH field IN ARRAY ARRAY['tenantId','clientId','planVersionId','measureId','visitId','assessmentId','kind','title']LOOP
   IF capture_receipt#>ARRAY['binding',field]IS DISTINCT FROM capture_packet->field THEN RAISE EXCEPTION 'Capture receipt changed selected identity: %',field;END IF;
  END LOOP;
  capture_confirmed:=public.web_confirm_nutrition_elimination_plan_binding(t,c,u,capture_id,capture_packet);
  IF capture_confirmed IS DISTINCT FROM capture_receipt OR public.web_capture_nutrition_elimination_plan_binding(capture_packet)IS DISTINCT FROM capture_receipt THEN RAISE EXCEPTION 'Capture own confirmation or immutable replay changed';END IF;
  BEGIN PERFORM public.web_confirm_nutrition_elimination_plan_binding(t,c,u,gen_random_uuid(),capture_packet);RAISE EXCEPTION 'Unknown capture request adopted another receipt';EXCEPTION WHEN SQLSTATE 'P0G02'THEN NULL;END;
  entry:=jsonb_build_object('kind','drink_protocol','title',capture_packet->'title','plannedAt',at_text,'occurredAt',null,'planVersionId',version_id,'measureId',item_id,'visitId',stop_id,'assessmentId',assessment_id,'planSnapshotSha256',context->'planSnapshotSha256',
   'decision','{"state":"not_asked","recordedAt":null,"reason":"","consultation":""}'::jsonb,
   'assistance','{"level":"independent","helpers":[],"aids":[],"details":""}'::jsonb,
   'intake','{"offered":null,"actual":null,"unit":"none","item":"Synthetic planned water support","dietForm":"","target":null,"targetUnit":"none"}'::jsonb,
   'elimination','{"input":null,"output":null,"unit":"none","complete":false,"profileId":null,"support":"","stool":"","observation":""}'::jsonb,
   'swallowing','{"approvedDiet":"","instruction":"","deviation":"","escalation":""}'::jsonb,
   'enteral','{"deviceId":null,"prescriptionId":null,"product":"","amount":null,"unit":"none","durationMinutes":null,"flushMl":null,"positionCheck":"","skin":"","tolerance":""}'::jsonb,
   'device','{"deviceId":null,"changeBasisId":null,"type":"none","materialChange":"","skin":"","positionCheck":"","output":"","complication":""}'::jsonb,
   'weight','{"value":null,"unit":"none","measurementId":null,"instrumentVersion":"","conditions":"","professionalAssessment":"","reaction":"","reviewAt":null}'::jsonb,
   'execution','{"outcome":"planned","performedBy":[],"result":"","deviation":""}'::jsonb,
   'followUp','{"required":false,"reason":"","responsibleProfileId":null,"dueAt":null,"taskId":null,"state":"not_required","closureEvidence":""}'::jsonb,'lifecycle','open');
  packet:=jsonb_build_object('schemaVersion','1','action','create','requestId',care_id,'tenantId',t,'clientId',c,'actorId',u,'expectedHeadId',null,'expectedRevision',0,'entry',entry,'reason','','original',null,'sources',context->'sources');
  receipt:=public.web_commit_nutrition_elimination_packet(packet);
  IF receipt->'packet'IS DISTINCT FROM packet OR receipt->>'requestId'IS DISTINCT FROM care_id::text OR receipt#>'{original,payload}'IS DISTINCT FROM entry OR receipt#>>'{original,tenantId}'IS DISTINCT FROM t::text OR receipt#>>'{original,clientId}'IS DISTINCT FROM c::text OR receipt#>>'{original,recordedBy}'IS DISTINCT FROM u::text OR receipt#>>'{original,revision}'IS DISTINCT FROM '1'OR receipt#>>'{original,id}'IS DISTINCT FROM receipt#>>'{original,headId}'OR receipt#>>'{original,rootId}'IS DISTINCT FROM receipt#>>'{original,headId}'OR jsonb_array_length(receipt#>'{original,history}')IS DISTINCT FROM 1 OR receipt#>>'{original,history,0,id}'IS DISTINCT FROM receipt#>>'{original,headId}'OR receipt#>'{original,history,0,payload}'IS DISTINCT FROM entry THEN RAISE EXCEPTION 'Planned G own original or retained first history identity changed';END IF;
  confirmed:=public.web_confirm_nutrition_elimination_packet(t,c,u,care_id,packet);
  IF confirmed IS DISTINCT FROM receipt OR public.web_commit_nutrition_elimination_packet(packet)IS DISTINCT FROM receipt THEN RAISE EXCEPTION 'Planned G own confirmation or retry changed immutable receipt';END IF;
  BEGIN PERFORM public.web_confirm_nutrition_elimination_packet(t,c,u,gen_random_uuid(),packet);RAISE EXCEPTION 'Unknown G request adopted another receipt';EXCEPTION WHEN SQLSTATE 'P0G02'THEN NULL;END;
  IF(SELECT count(*)FROM public.nutrition_elimination_plan_bindings WHERE tenant_id=t)IS DISTINCT FROM 1 OR(SELECT count(*)FROM care_private.nutrition_binding_captures WHERE tenant_id=t)IS DISTINCT FROM 1 OR(SELECT count(*)FROM public.nutrition_elimination_roots WHERE tenant_id=t)IS DISTINCT FROM 1 OR(SELECT count(*)FROM public.nutrition_elimination_events WHERE tenant_id=t)IS DISTINCT FROM 1 OR(SELECT count(*)FROM public.nutrition_elimination_receipts WHERE tenant_id=t)IS DISTINCT FROM 1 OR EXISTS(SELECT 1 FROM public.nutrition_review_roots WHERE tenant_id=t)OR EXISTS(SELECT 1 FROM public.care_protocol_roots WHERE tenant_id=t)OR EXISTS(SELECT 1 FROM public.vital_sign_measurements WHERE tenant_id=t)OR public.web_read_nutrition_elimination_binding_context(t,c,u,version_id,item_id,stop_id,assessment_id)IS DISTINCT FROM context THEN RAISE EXCEPTION 'Retries duplicated data, invented actuals or changed full native context';END IF;
  finished:=true;RAISE EXCEPTION USING ERRCODE='Z0001';
 EXCEPTION WHEN SQLSTATE 'Z0001'THEN NULL;END;
 IF finished IS DISTINCT FROM true OR EXISTS(SELECT 1 FROM public.tenants WHERE id=t)OR EXISTS(SELECT 1 FROM auth.users WHERE id=u)OR EXISTS(SELECT 1 FROM auth.sessions WHERE id=s)OR EXISTS(SELECT 1 FROM public.profiles WHERE id=u)OR EXISTS(SELECT 1 FROM public.roles WHERE id=r)OR EXISTS(SELECT 1 FROM public.role_permissions WHERE role_id=r)OR EXISTS(SELECT 1 FROM public.role_permission_sets WHERE tenant_id=t)OR EXISTS(SELECT 1 FROM public.clients WHERE id=c)OR EXISTS(SELECT 1 FROM public.client_module_assignments WHERE tenant_id=t)OR EXISTS(SELECT 1 FROM public.care_plans WHERE id=plan_id)OR EXISTS(SELECT 1 FROM public.care_plan_items WHERE id=item_id)OR EXISTS(SELECT 1 FROM public.care_plan_versions WHERE id=version_id)OR EXISTS(SELECT 1 FROM public.care_tours WHERE id=tour_id)OR EXISTS(SELECT 1 FROM public.care_tour_stops WHERE id=stop_id)OR EXISTS(SELECT 1 FROM public.care_assessments WHERE id=assessment_id)OR EXISTS(SELECT 1 FROM public.care_assessment_topics WHERE tenant_id=t)OR EXISTS(SELECT 1 FROM public.care_assessment_risks WHERE tenant_id=t)OR EXISTS(SELECT 1 FROM public.care_assessment_measures WHERE tenant_id=t)OR EXISTS(SELECT 1 FROM public.nutrition_elimination_plan_bindings WHERE tenant_id=t)OR EXISTS(SELECT 1 FROM care_private.nutrition_binding_captures WHERE tenant_id=t)OR EXISTS(SELECT 1 FROM public.nutrition_elimination_roots WHERE tenant_id=t)OR EXISTS(SELECT 1 FROM public.nutrition_elimination_events WHERE tenant_id=t)OR EXISTS(SELECT 1 FROM public.nutrition_elimination_receipts WHERE tenant_id=t)OR EXISTS(SELECT 1 FROM public.nutrition_review_roots WHERE tenant_id=t)OR EXISTS(SELECT 1 FROM public.nutrition_review_events WHERE tenant_id=t)OR EXISTS(SELECT 1 FROM public.nutrition_review_receipts WHERE tenant_id=t)THEN RAISE EXCEPTION 'Supplementary Nutrition full inner rollback cleanup failed';END IF;
 PERFORM set_config('cp365.nutrition_capture_small',jsonb_build_object('schemaVersion',1,'supplementaryRuntimeUnit',true,'cleanupConfirmed',true,'expected',jsonb_build_object('tenantId',t,'clientId',c,'actorId',u,'planVersionId',version_id,'measureId',item_id,'visitId',stop_id,'assessmentId',assessment_id,'captureRequestId',capture_id,'careRequestId',care_id),'context',context,'capturePacket',capture_packet,'captureReceipt',capture_receipt,'captureConfirmed',capture_confirmed,'carePacket',packet,'careReceipt',receipt,'careConfirmed',confirmed)::text,true);
END $unit$;
SELECT current_setting('cp365.nutrition_capture_small',true)::jsonb AS synthetic_evidence;
ROLLBACK;
