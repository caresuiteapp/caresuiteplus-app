-- NEW independent Nutrition capture rollback fixture; synthetic claims, no HTTP/clinical release.
-- Local variable map: fixtures/nutrition_reconstructed_variable_map.json
BEGIN;
CREATE FUNCTION pg_temp.cp365_nutrition_counts(scope_tenant uuid) RETURNS jsonb
LANGUAGE sql SECURITY INVOKER SET search_path='' AS $counts$
 SELECT jsonb_build_object(
  'bindings',(SELECT count(*) FROM public.nutrition_elimination_plan_bindings WHERE tenant_id=scope_tenant),
  'captures',(SELECT count(*) FROM care_private.nutrition_binding_captures WHERE tenant_id=scope_tenant),
  'careRoots',(SELECT count(*) FROM public.nutrition_elimination_roots WHERE tenant_id=scope_tenant),
  'careEvents',(SELECT count(*) FROM public.nutrition_elimination_events WHERE tenant_id=scope_tenant),
  'careReceipts',(SELECT count(*) FROM public.nutrition_elimination_receipts WHERE tenant_id=scope_tenant),
  'reviewRoots',(SELECT count(*) FROM public.nutrition_review_roots WHERE tenant_id=scope_tenant),
  'reviewEvents',(SELECT count(*) FROM public.nutrition_review_events WHERE tenant_id=scope_tenant),
  'reviewReceipts',(SELECT count(*) FROM public.nutrition_review_receipts WHERE tenant_id=scope_tenant));
$counts$;
CREATE FUNCTION pg_temp.cp365_nutrition_expect(scope_tenant uuid,op text,args jsonb,states text[],label text)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $expect$
DECLARE before_counts jsonb;code text;
BEGIN
 before_counts:=pg_temp.cp365_nutrition_counts(scope_tenant);
 BEGIN
  CASE op
   WHEN 'capture' THEN PERFORM public.web_capture_nutrition_elimination_plan_binding(args->'p');
   WHEN 'care' THEN PERFORM public.web_commit_nutrition_elimination_packet(args->'p');
   WHEN 'review' THEN PERFORM public.web_commit_nutrition_review(args->'p');
   WHEN 'capture_confirm' THEN PERFORM public.web_confirm_nutrition_elimination_plan_binding((args->>'t')::uuid,(args->>'c')::uuid,(args->>'u')::uuid,(args->>'r')::uuid,args->'p');
   WHEN 'care_confirm' THEN PERFORM public.web_confirm_nutrition_elimination_packet((args->>'t')::uuid,(args->>'c')::uuid,(args->>'u')::uuid,(args->>'r')::uuid,args->'p');
   WHEN 'review_confirm' THEN PERFORM public.web_confirm_nutrition_review((args->>'t')::uuid,(args->>'c')::uuid,(args->>'u')::uuid,(args->>'r')::uuid,args->'p');
   WHEN 'context' THEN PERFORM public.web_read_nutrition_elimination_binding_context((args->>'t')::uuid,(args->>'c')::uuid,(args->>'u')::uuid,(args->>'v')::uuid,(args->>'m')::uuid,(args->>'s')::uuid,(args->>'a')::uuid);
   WHEN 'prerequisites' THEN PERFORM public.web_read_nutrition_elimination_prerequisites((args->>'t')::uuid,(args->>'c')::uuid,(args->>'u')::uuid);
   WHEN 'care_page' THEN PERFORM public.web_read_nutrition_elimination_page((args->>'t')::uuid,(args->>'c')::uuid,(args->>'u')::uuid,(args->>'at')::timestamptz,(args->>'id')::uuid,(args->>'n')::integer);
   WHEN 'review_page' THEN PERFORM public.web_read_nutrition_review_page((args->>'t')::uuid,(args->>'c')::uuid,(args->>'u')::uuid,(args->>'at')::timestamptz,(args->>'id')::uuid,(args->>'n')::integer);
   ELSE RAISE EXCEPTION 'Unknown fixture operation' USING ERRCODE='Z0005';
  END CASE;
  RAISE EXCEPTION 'Expected rejection was accepted: %',label USING ERRCODE='Z0005';
 EXCEPTION WHEN OTHERS THEN
  GET STACKED DIAGNOSTICS code=RETURNED_SQLSTATE;
  IF code='Z0005' OR NOT(code=ANY(states)) THEN RAISE EXCEPTION 'Unexpected SQLSTATE % for %',code,label USING ERRCODE='Z0005';END IF;
 END;
 IF pg_temp.cp365_nutrition_counts(scope_tenant) IS DISTINCT FROM before_counts THEN RAISE EXCEPTION 'Rejected operation left prepared rows: %',label;END IF;
END $expect$;
DO $test$
<<fixture>>
DECLARE
 f_t uuid:=('a'||substr(gen_random_uuid()::text,2))::uuid;f_u uuid:=('a'||substr(gen_random_uuid()::text,2))::uuid;f_s uuid:=gen_random_uuid();f_r uuid:=gen_random_uuid();
 v3a uuid:=gen_random_uuid();v38 uuid:=gen_random_uuid();v36 uuid:=gen_random_uuid();v2f uuid:=gen_random_uuid();v30 uuid:=gen_random_uuid();
 f_c uuid:=('a'||substr(gen_random_uuid()::text,2))::uuid;v1d uuid:=gen_random_uuid();v24 uuid:=gen_random_uuid();v4a uuid:=('a'||substr(gen_random_uuid()::text,2))::uuid;
 v1a uuid:=('a'||substr(gen_random_uuid()::text,2))::uuid;v44 uuid:=gen_random_uuid();v4b uuid:=('a'||substr(gen_random_uuid()::text,2))::uuid;v21 uuid:=gen_random_uuid();
 v2 uuid:=('a'||substr(gen_random_uuid()::text,2))::uuid;v43 uuid:=gen_random_uuid();v3 uuid:=gen_random_uuid();v42 uuid:=gen_random_uuid();
 v18 uuid:=gen_random_uuid();
 v11 uuid:=gen_random_uuid();
 vc uuid:=gen_random_uuid();v1e uuid:=gen_random_uuid();vf uuid:=gen_random_uuid();
 f_day date:=(clock_timestamp() AT TIME ZONE 'Europe/Berlin')::date-1;v28 timestamptz;v0 timestamptz;v29 text;v1 text;
 vd jsonb;v33 jsonb;v3d jsonb;v1c jsonb;v1b jsonb;
 ve jsonb;v7 jsonb;va jsonb;vb jsonb;v8 jsonb;v9 jsonb;
 v3e jsonb;v2a jsonb;v13 jsonb;v22 jsonb;
 v4c boolean;
 
 v46 text:=repeat(chr(128167),250);
 fx_page1 jsonb;fx_page2 jsonb;v12 jsonb;
 f_bad jsonb;f_key text;v17 text;v3b text;v40 text;
 v23 boolean:=false;v6 boolean:=false;
BEGIN
 BEGIN
  v4c:=EXISTS(SELECT 1 FROM public.vital_sign_catalog WHERE key='weight');
  INSERT INTO public.tenants(id,name) VALUES(f_t,'CP365 synthetic Nutrition rollback fixture');
  INSERT INTO public.roles(id,key,name) VALUES(f_r,'cp365_nutrition_'||f_r,'Synthetic Nutrition author'),(v36,'cp365_nutrition_review_'||v36,'Synthetic independent Nutrition reader');
  INSERT INTO public.role_permissions(role_id,permission_key)
   SELECT own.role_id,p.permission_key FROM unnest(ARRAY[f_r,v36]) own(role_id)
   CROSS JOIN unnest(ARRAY['pflege.plans.view','pflege.plans.manage','pflege.documentation.view','pflege.documentation.create','pflege.documentation.sign','pflege.vitals.view']) p(permission_key);
  INSERT INTO auth.users(id,email,raw_user_meta_data,raw_app_meta_data) VALUES(f_u,f_u||'@example.invalid','{}','{}'),(v3a,v3a||'@example.invalid','{}','{}');
  UPDATE public.profiles SET tenant_id=f_t,role_id=f_r,role_key='pfleger',is_active=true,status='active',display_name='Synthetic Nutrition Author' WHERE id=f_u;
  UPDATE public.profiles SET tenant_id=f_t,role_id=v36,role_key='pfleger',is_active=true,status='active',display_name='Synthetic independent Nutrition reader' WHERE id=v3a;
  INSERT INTO auth.sessions(id,user_id,not_after) VALUES(f_s,f_u,clock_timestamp()+interval '2 hours'),(v38,v3a,clock_timestamp()+interval '2 hours');
  INSERT INTO public.clients(id,tenant_id,first_name,last_name,status,lifecycle_status) VALUES(f_c,f_t,'Synthetic','Nutrition case','aktiv','aktiv'),(v1d,f_t,'Synthetic','Other Nutrition case','aktiv','aktiv');
  INSERT INTO public.client_module_assignments(tenant_id,client_id,module_key,status,is_active) VALUES(f_t,f_c,'pflege','active',true),(f_t,v1d,'pflege','active',true);
  vd:=jsonb_build_object('sub',f_u,'role','authenticated','session_id',f_s,'exp',extract(epoch FROM clock_timestamp()+interval '1 hour')::bigint);
  v33:=jsonb_build_object('sub',v3a,'role','authenticated','session_id',v38,'exp',extract(epoch FROM clock_timestamp()+interval '1 hour')::bigint);
  PERFORM set_config('request.jwt.claims',vd::text,true);
  -- Exact ECMAScript trim and UTF-16 length, preserving accepted bytes.
  IF care_private.nutrition_text(to_jsonb(chr(160)||chr(65279)),1,300) IS NOT FALSE
   OR care_private.nutrition_text(to_jsonb(chr(133)),1,1) IS NOT TRUE
   OR care_private.nutrition_text(to_jsonb(repeat(chr(128167),2)),4,4) IS NOT TRUE
   OR care_private.nutrition_text(to_jsonb(repeat(chr(128167),2)),0,3) IS NOT FALSE
   OR care_private.nutrition_text(to_jsonb(repeat(chr(128167),150)),3,300) IS NOT TRUE
   OR care_private.nutrition_text(to_jsonb(repeat(chr(128167),151)),3,300) IS NOT FALSE
   OR care_private.nutrition_text(to_jsonb(v46),1,500) IS NOT TRUE
   OR care_private.nutrition_text(to_jsonb(repeat(chr(128167),251)),1,500) IS NOT FALSE THEN RAISE EXCEPTION 'ECMAScript whitespace/UTF-16 contract differs';END IF;
  INSERT INTO public.care_plans(id,tenant_id,client_id,title,status,valid_from,valid_until) VALUES(v24,f_t,f_c,'Synthetic explicit Nutrition plan','aktiv',f_day-10,f_day+30);
  INSERT INTO public.care_plan_items(id,tenant_id,care_plan_id,category,title,intervention,status,sort_order,created_by,updated_by)
   VALUES(v1a,f_t,v24,'drink_protocol','Synthetic explicitly planned drink support','Synthetic authored planning only; no actual drink asserted','active',1,f_u,f_u);
  SELECT jsonb_build_object('plan',to_jsonb(p),'items',(SELECT jsonb_agg(to_jsonb(i) ORDER BY i.id) FROM public.care_plan_items i WHERE i.tenant_id=f_t AND i.care_plan_id=v24)) INTO v3d FROM public.care_plans p WHERE p.id=v24;
  INSERT INTO public.care_plan_versions(id,tenant_id,care_plan_id,version,snapshot,reason,actor_id,actor_name) VALUES(v4a,f_t,v24,1,v3d,'Synthetic explicit native plan version',f_u,'Synthetic Nutrition Author');
  INSERT INTO public.care_tours(id,tenant_id,tour_date,name,status,created_by,updated_by) VALUES(v44,f_t,f_day,'Synthetic published Nutrition tour','published',f_u,f_u);
  INSERT INTO public.care_tour_stops(id,tenant_id,tour_id,sequence_no,client_id,client_name_snapshot,planned_start,planned_end,status)
   VALUES(v4b,f_t,v44,1,f_c,'Synthetic Nutrition case','12:15:30.123456','12:45:30.123456','planned'),(v21,f_t,v44,2,f_c,'Synthetic Nutrition case','13:15:30.654321','13:45:30.654321','planned');
  INSERT INTO public.care_assessments(id,tenant_id,subject_type,subject_id,subject_name_snapshot,variant,status,version,assessor_profile_id,assessor_name_snapshot,created_by,updated_by)
   VALUES(v2,f_t,'client',f_c,'Synthetic Nutrition case','ambulant','draft',1,f_u,'Synthetic Nutrition Author',f_u,f_u);
  INSERT INTO public.care_assessment_topics(id,tenant_id,assessment_id,topic_key,professional_assessment) VALUES(v43,f_t,v2,'self_care','Synthetic explicit draft assessment; no clinical conclusion');
  INSERT INTO public.care_assessment_measures(id,tenant_id,assessment_id,title,personal_goal,intervention,timing,frequency,responsible_role,evaluation_criteria,status)
   VALUES(v3,f_t,v2,'Synthetic draft Nutrition measure','Synthetic goal','Synthetic planned support','Synthetic explicit noon visit','Synthetic individual frequency','Synthetic role','Synthetic review criteria','planned');
  v28:=(f_day+time '12:15:30.123456') AT TIME ZONE 'Europe/Berlin';v0:=v28+interval '1 minute 0.111111 second';
  v29:=to_char(v28 AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"');v1:=to_char(v0 AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"');
  INSERT INTO public.care_operations_tasks(id,tenant_id,client_id,title,description,due_on,status,created_by) VALUES(v42,f_t,f_c,'Synthetic date-only follow-up','Date is not an actual instant',f_day,'open',f_u);
  ve:=public.web_read_nutrition_elimination_binding_context(f_t,f_c,f_u,v4a,v1a,v4b,v2);
  SELECT jsonb_build_object('plan',(SELECT to_jsonb(x) FROM public.care_plans x WHERE x.id=v24),'planVersion',(SELECT to_jsonb(x) FROM public.care_plan_versions x WHERE x.id=v4a),'measure',(SELECT to_jsonb(x) FROM public.care_plan_items x WHERE x.id=v1a),'visit',(SELECT to_jsonb(x) FROM public.care_tour_stops x WHERE x.id=v4b),'tour',(SELECT to_jsonb(x) FROM public.care_tours x WHERE x.id=v44),'assessment',(SELECT to_jsonb(x) FROM public.care_assessments x WHERE x.id=v2),
   'assessmentTopics',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.id),'[]'::jsonb) FROM public.care_assessment_topics x WHERE x.tenant_id=f_t AND x.assessment_id=v2),'assessmentRisks',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.id),'[]'::jsonb) FROM public.care_assessment_risks x WHERE x.tenant_id=f_t AND x.assessment_id=v2),'assessmentMeasures',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.id),'[]'::jsonb) FROM public.care_assessment_measures x WHERE x.tenant_id=f_t AND x.assessment_id=v2),'instrumentSelection',null,'model',null,'instruments','[]'::jsonb) INTO v1c;
  IF ve->'nativeOriginals' IS DISTINCT FROM v1c OR (ve->>'planSnapshotSha256'~'^sha256:[a-f0-9]{64}$') IS NOT TRUE THEN RAISE EXCEPTION 'Full native context differs from independently selected originals';END IF;
  IF ve#>'{nativeOriginals,instrumentSelection}' IS DISTINCT FROM 'null'::jsonb OR ve#>'{nativeOriginals,model}' IS DISTINCT FROM 'null'::jsonb OR ve#>'{nativeOriginals,instruments}' IS DISTINCT FROM '[]'::jsonb OR ve#>'{sources,devices}' IS DISTINCT FROM '[]'::jsonb OR jsonb_array_length(ve#>'{sources,tasks}') IS DISTINCT FROM 1 OR ve#>'{sources,tasks,0,dueAt}' IS DISTINCT FROM 'null'::jsonb THEN RAISE EXCEPTION 'Unknown instruments/devices/date-only deadline were inferred';END IF;
  va:=jsonb_build_object('schemaVersion','1','requestId',vc,'tenantId',f_t,'clientId',f_c,'actorId',f_u,'planVersionId',v4a,'measureId',v1a,'visitId',v4b,'assessmentId',v2,'kind','drink_protocol','title','Synthetic explicitly planned drink support','plannedAt',v29,'nativeOriginals',ve->'nativeOriginals','sources',ve->'sources');
  PERFORM pg_temp.cp365_nutrition_expect(f_t,'capture',jsonb_build_object('p',va||jsonb_build_object('requestId',gen_random_uuid())||jsonb_build_object('schemaVersion',1)),ARRAY['23514'],'Numeric capture schema accepted');
  PERFORM pg_temp.cp365_nutrition_expect(f_t,'capture',jsonb_build_object('p',va||jsonb_build_object('requestId',gen_random_uuid())-'nativeOriginals'),ARRAY['23514'],'Missing native originals accepted');
  PERFORM pg_temp.cp365_nutrition_expect(f_t,'capture',jsonb_build_object('p',va||jsonb_build_object('requestId',gen_random_uuid())||jsonb_build_object('unexpected',true)),ARRAY['23514'],'Unknown capture key accepted');
  PERFORM pg_temp.cp365_nutrition_expect(f_t,'capture',jsonb_build_object('p',va||jsonb_build_object('requestId',gen_random_uuid())||jsonb_build_object('kind','meal_support')),ARRAY['23514'],'Wrong native category accepted');
  PERFORM pg_temp.cp365_nutrition_expect(f_t,'capture',jsonb_build_object('p',va||jsonb_build_object('requestId',gen_random_uuid())||jsonb_build_object('title','Synthetic substituted title')),ARRAY['23514'],'Substituted native title accepted');
  PERFORM pg_temp.cp365_nutrition_expect(f_t,'capture',jsonb_build_object('p',va||jsonb_build_object('requestId',gen_random_uuid())||jsonb_build_object('title',repeat(chr(160),3))),ARRAY['23514'],'NBSP-only capture title accepted');
  PERFORM pg_temp.cp365_nutrition_expect(f_t,'capture',jsonb_build_object('p',va||jsonb_build_object('requestId',gen_random_uuid())||jsonb_build_object('title',repeat(chr(128167),151))),ARRAY['23514'],'UTF16 oversized capture title accepted');
  PERFORM pg_temp.cp365_nutrition_expect(f_t,'capture',jsonb_build_object('p',va||jsonb_build_object('requestId',gen_random_uuid())||jsonb_build_object('plannedAt',left(v29,17)||'60.123456Z')),ARRAY['23514'],'Leap second silently normalized');
  PERFORM pg_temp.cp365_nutrition_expect(f_t,'capture',jsonb_build_object('p',va||jsonb_build_object('requestId',gen_random_uuid())||jsonb_build_object('plannedAt',to_char((v28-interval '1 microsecond') AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'))),ARRAY['23514'],'Before visit microsecond accepted');
  PERFORM pg_temp.cp365_nutrition_expect(f_t,'capture',jsonb_build_object('p',va||jsonb_build_object('requestId',gen_random_uuid())||jsonb_build_object('plannedAt',to_char(((f_day+time '12:45:30.123456') AT TIME ZONE 'Europe/Berlin') AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'))),ARRAY['23514'],'Excluded visit end accepted');
  FOREACH v17 IN ARRAY ARRAY['enteral_nutrition','fluid_balance','continence_support','catheter_care','stoma_care','tube_observation'] LOOP
  PERFORM pg_temp.cp365_nutrition_expect(f_t,'capture',jsonb_build_object('p',va||jsonb_build_object('requestId',gen_random_uuid())||jsonb_build_object('kind',v17)),ARRAY['42501'],'Unsupported clinical prerequisite accepted');
  END LOOP;
  BEGIN UPDATE public.care_plan_items SET notes='Synthetic hidden native measure mutation' WHERE id=v1a;PERFORM pg_temp.cp365_nutrition_expect(f_t,'capture',jsonb_build_object('p',va||jsonb_build_object('requestId',gen_random_uuid())),ARRAY['40001'],'Hidden full measure mutation ignored');RAISE EXCEPTION USING ERRCODE='Z0006';EXCEPTION WHEN SQLSTATE 'Z0006' THEN NULL;END;
  BEGIN UPDATE public.care_assessment_topics SET person_perspective='Synthetic hidden child mutation' WHERE id=v43;PERFORM pg_temp.cp365_nutrition_expect(f_t,'capture',jsonb_build_object('p',va||jsonb_build_object('requestId',gen_random_uuid())),ARRAY['40001'],'Hidden assessment child mutation ignored');RAISE EXCEPTION USING ERRCODE='Z0006';EXCEPTION WHEN SQLSTATE 'Z0006' THEN NULL;END;
  FOREACH f_key IN ARRAY ARRAY['requestId','tenantId','clientId','actorId','planVersionId','measureId','visitId','assessmentId'] LOOP
   f_bad:=va||jsonb_build_object('requestId',('a'||substr(gen_random_uuid()::text,2))::uuid);
   IF (f_bad->>f_key)~'[a-f]' IS NOT TRUE THEN RAISE EXCEPTION 'Uppercase test has no differing bytes';END IF;
   f_bad:=jsonb_set(f_bad,ARRAY[f_key],to_jsonb(upper(f_bad->>f_key)));
  PERFORM pg_temp.cp365_nutrition_expect(f_t,'capture',jsonb_build_object('p',f_bad),ARRAY['23514'],'Uppercase capture UUID accepted');
  END LOOP;
  vb:=public.web_capture_nutrition_elimination_plan_binding(va);
  IF vb->'packet' IS DISTINCT FROM va OR vb->>'requestId' IS DISTINCT FROM vc::text OR vb#>'{binding,nativeOriginals}' IS DISTINCT FROM v1c OR vb#>'{binding,sources}' IS DISTINCT FROM ve->'sources' OR vb#>'{binding,planSnapshotSha256}' IS DISTINCT FROM ve->'planSnapshotSha256' OR vb#>>'{binding,capturedBy}' IS DISTINCT FROM f_u::text OR (vb#>>'{binding,plannedAt}')::timestamptz IS DISTINCT FROM v28 THEN RAISE EXCEPTION 'Capture own original lost native scope/hash/time';END IF;
  FOREACH f_key IN ARRAY ARRAY['tenantId','clientId','planVersionId','measureId','visitId','assessmentId','kind','title'] LOOP IF vb#>ARRAY['binding',f_key] IS DISTINCT FROM va->f_key THEN RAISE EXCEPTION 'Capture receipt identity changed: %',f_key;END IF;END LOOP;
  IF public.web_capture_nutrition_elimination_plan_binding(va) IS DISTINCT FROM vb OR public.web_confirm_nutrition_elimination_plan_binding(f_t,f_c,f_u,vc,va) IS DISTINCT FROM vb THEN RAISE EXCEPTION 'Exact capture replay/confirm changed';END IF;
  PERFORM pg_temp.cp365_nutrition_expect(f_t,'capture',jsonb_build_object('p',va||jsonb_build_object('title','Changed same request')),ARRAY['40001'],'Capture changed same request accepted');
  PERFORM pg_temp.cp365_nutrition_expect(f_t,'capture_confirm',jsonb_build_object('t',f_t,'c',f_c,'u',f_u,'r',vc,'p',va||jsonb_build_object('title','Changed confirm')),ARRAY['P0G02'],'Changed capture confirmation accepted');
  v7:=public.web_read_nutrition_elimination_binding_context(f_t,f_c,f_u,v4a,v1a,v21,v2);
  v8:=va||jsonb_build_object('requestId',v1e,'visitId',v21,'plannedAt',to_char(((f_day+time '13:15:30.654321') AT TIME ZONE 'Europe/Berlin') AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),'nativeOriginals',v7->'nativeOriginals','sources',v7->'sources');
  v9:=public.web_capture_nutrition_elimination_plan_binding(v8);
  IF v9#>'{binding,planSnapshotSha256}' IS DISTINCT FROM v7->'planSnapshotSha256' OR v9#>'{binding,nativeOriginals}' IS DISTINCT FROM v7->'nativeOriginals' OR public.web_confirm_nutrition_elimination_plan_binding(f_t,f_c,f_u,v1e,v8) IS DISTINCT FROM v9 THEN RAISE EXCEPTION 'Second capture detached from independent original context';END IF;
  INSERT INTO public.nutrition_elimination_plan_bindings(id,tenant_id,client_id,plan_version_id,measure_id,visit_id,assessment_id,kind,title,planned_at,plan_snapshot_sha256,source_originals,plan_original)
   VALUES(v18,f_t,f_c,v4a,v1a,v4b,v2,'meal_support','Synthetic explicitly planned drink support',v28,ve->>'planSnapshotSha256',ve->'sources',ve->'nativeOriginals');
  v2a:=public.web_read_nutrition_elimination_prerequisites(f_t,f_c,f_u);
  IF jsonb_array_length(v2a->'plans') IS DISTINCT FROM 2 OR (v2a->>'stateFingerprint'~'^sha256:[a-f0-9]{64}$') IS NOT TRUE THEN RAISE EXCEPTION 'Captured prerequisites/proof unavailable or legacy fake binding exposed';END IF;
  v3e:=ve->'sources';
  v13:=jsonb_build_object('kind','drink_protocol','title',va->'title','plannedAt',vb#>'{binding,plannedAt}','occurredAt',null,'planVersionId',v4a,'measureId',v1a,'visitId',v4b,'assessmentId',v2,'planSnapshotSha256',vb#>'{binding,planSnapshotSha256}',
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
  v22:=jsonb_build_object('schemaVersion','1','action','create','requestId',vf,'tenantId',f_t,'clientId',f_c,'actorId',f_u,'expectedHeadId',null,'expectedRevision',0,'entry',v13,'reason','','original',null,'sources',v3e);
  PERFORM pg_temp.cp365_nutrition_expect(f_t,'care',jsonb_build_object('p',jsonb_set(v22||jsonb_build_object('requestId',gen_random_uuid()),'{entry,kind}','"meal_support"')),ARRAY['40001'],'Legacy fake binding authorized care');
  v6:=true;
  v1b:=public.web_read_nutrition_elimination_binding_context(f_t,f_c,f_u,v4a,v1a,v4b,v2)->'nativeOriginals';
  IF v1b IS DISTINCT FROM v1c OR EXISTS(SELECT 1 FROM public.care_protocol_events WHERE tenant_id=f_t) OR EXISTS(SELECT 1 FROM public.vital_sign_measurements WHERE tenant_id=f_t) THEN RAISE EXCEPTION 'Prepared fixture changed native originals';END IF;
  v12:=public.web_read_nutrition_elimination_page(f_t,v1d,f_u,null,null,100);
  IF v12->'rows' IS DISTINCT FROM '[]'::jsonb OR v12->'nextCursorId' IS DISTINCT FROM 'null'::jsonb OR v12->'nextCursorRecordedAt' IS DISTINCT FROM 'null'::jsonb OR (v12->>'stateFingerprint'~'^sha256:[a-f0-9]{64}$') IS NOT TRUE THEN RAISE EXCEPTION 'Empty scoped read lacks complete proof';END IF;
  IF EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname IN('public','care_private') AND p.proname LIKE '%nutrition%' AND (has_function_privilege('anon',p.oid,'EXECUTE') OR has_function_privilege('authenticated',p.oid,'EXECUTE') OR has_function_privilege('service_role',p.oid,'EXECUTE'))) THEN RAISE EXCEPTION 'Nutrition RPC execute quarantine widened';END IF;
  FOREACH v40 IN ARRAY ARRAY['nutrition_elimination_plan_bindings','nutrition_elimination_roots','nutrition_elimination_events','nutrition_elimination_receipts','nutrition_review_roots','nutrition_review_events','nutrition_review_receipts'] LOOP
   FOREACH v3b IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
    IF has_table_privilege(v3b,'public.'||v40,'SELECT,INSERT,UPDATE,DELETE') THEN RAISE EXCEPTION 'Nutrition original table privilege widened: % %',v3b,v40;END IF;
   END LOOP;
   IF NOT EXISTS(SELECT 1 FROM pg_class p JOIN pg_namespace n ON n.oid=p.relnamespace WHERE n.nspname='public' AND p.relname=v40 AND p.relrowsecurity) THEN RAISE EXCEPTION 'Nutrition RLS missing: %',v40;END IF;
  END LOOP;
  FOREACH v40 IN ARRAY ARRAY['nutrition_binding_captures','nutrition_review_scopes'] LOOP
   FOREACH v3b IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP IF has_table_privilege(v3b,'care_private.'||v40,'SELECT,INSERT,UPDATE,DELETE') THEN RAISE EXCEPTION 'Private Nutrition capture/scope privilege widened';END IF;END LOOP;
  END LOOP;
  v23:=true;RAISE EXCEPTION USING ERRCODE='Z0001';
 EXCEPTION WHEN SQLSTATE 'Z0001' THEN NULL;END;
 IF v23 IS NOT TRUE OR
  EXISTS(SELECT 1 FROM auth.users WHERE id IN(f_u,v3a,v2f)) OR
  EXISTS(SELECT 1 FROM auth.sessions WHERE id IN(f_s,v38,v30)) OR
  EXISTS(SELECT 1 FROM public.roles WHERE id IN(f_r,v36)) OR
  EXISTS(SELECT 1 FROM public.employee_employment_details WHERE employee_id=v11) OR
  (v4c IS NOT TRUE AND EXISTS(SELECT 1 FROM public.vital_sign_catalog WHERE key='weight')) OR
  EXISTS(SELECT 1 FROM public.tenants WHERE id=f_t) OR
  EXISTS(SELECT 1 FROM public.clients WHERE tenant_id=f_t) OR
  EXISTS(SELECT 1 FROM public.client_module_assignments WHERE tenant_id=f_t) OR
  EXISTS(SELECT 1 FROM public.role_permission_sets WHERE tenant_id=f_t) OR
  EXISTS(SELECT 1 FROM public.employees WHERE tenant_id=f_t) OR
  EXISTS(SELECT 1 FROM public.employee_documents WHERE tenant_id=f_t) OR
  EXISTS(SELECT 1 FROM public.employee_qualifications WHERE tenant_id=f_t) OR
  EXISTS(SELECT 1 FROM public.care_plans WHERE tenant_id=f_t) OR
  EXISTS(SELECT 1 FROM public.care_plan_items WHERE tenant_id=f_t) OR
  EXISTS(SELECT 1 FROM public.care_plan_versions WHERE tenant_id=f_t) OR
  EXISTS(SELECT 1 FROM public.care_tours WHERE tenant_id=f_t) OR
  EXISTS(SELECT 1 FROM public.care_tour_stops WHERE tenant_id=f_t) OR
  EXISTS(SELECT 1 FROM public.care_assessments WHERE tenant_id=f_t) OR
  EXISTS(SELECT 1 FROM public.care_assessment_topics WHERE tenant_id=f_t) OR
  EXISTS(SELECT 1 FROM public.care_assessment_risks WHERE tenant_id=f_t) OR
  EXISTS(SELECT 1 FROM public.care_assessment_measures WHERE tenant_id=f_t) OR
  EXISTS(SELECT 1 FROM public.care_operations_tasks WHERE tenant_id=f_t) OR
  EXISTS(SELECT 1 FROM public.care_protocol_roots WHERE tenant_id=f_t) OR
  EXISTS(SELECT 1 FROM public.care_protocol_events WHERE tenant_id=f_t) OR
  EXISTS(SELECT 1 FROM public.vital_sign_measurements WHERE tenant_id=f_t) OR
  EXISTS(SELECT 1 FROM public.nutrition_elimination_plan_bindings WHERE tenant_id=f_t) OR
  EXISTS(SELECT 1 FROM care_private.nutrition_binding_captures WHERE tenant_id=f_t) OR
  EXISTS(SELECT 1 FROM public.nutrition_elimination_roots WHERE tenant_id=f_t) OR
  EXISTS(SELECT 1 FROM public.nutrition_elimination_events WHERE tenant_id=f_t) OR
  EXISTS(SELECT 1 FROM public.nutrition_elimination_receipts WHERE tenant_id=f_t) OR
  EXISTS(SELECT 1 FROM public.nutrition_review_roots WHERE tenant_id=f_t) OR
  EXISTS(SELECT 1 FROM public.nutrition_review_events WHERE tenant_id=f_t) OR
  EXISTS(SELECT 1 FROM public.nutrition_review_receipts WHERE tenant_id=f_t) OR
  EXISTS(SELECT 1 FROM care_private.nutrition_review_scopes WHERE tenant_id=f_t) OR EXISTS(SELECT 1 FROM public.profiles WHERE id IN(f_u,v3a,v2f)) OR EXISTS(SELECT 1 FROM public.role_permissions WHERE role_id IN(f_r,v36)) THEN RAISE EXCEPTION 'Nutrition full inner rollback cleanup failed';END IF;
 PERFORM set_config('cp365.nutrition_workspace_test_evidence',jsonb_build_object('schemaVersion',1,'fixtureKind','capture','cleanupConfirmed',true,'expected',jsonb_build_object('tenantId',f_t,'clientId',f_c,'actorId',f_u,'reviewerId',v3a),'context',ve,'otherCaptureContext',v7,'capturePacket',va,'captureReceipt',vb,'otherCapturePacket',v8,'otherCaptureReceipt',v9,'prerequisites',v2a,'canonicalIdsBlocked',v6)::text,true);
END $test$;
SELECT current_setting('cp365.nutrition_workspace_test_evidence',true)::jsonb AS evidence;
ROLLBACK;
