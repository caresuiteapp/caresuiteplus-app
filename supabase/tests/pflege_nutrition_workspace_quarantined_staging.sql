-- NEW independent Nutrition workspace rollback fixture; synthetic claims, no HTTP/clinical release.
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
 v44 uuid:=gen_random_uuid();v42 uuid:=gen_random_uuid();v40 uuid:=gen_random_uuid();v39 uuid:=gen_random_uuid();v3a uuid:=gen_random_uuid();
 f_c uuid:=('a'||substr(gen_random_uuid()::text,2))::uuid;v21 uuid:=gen_random_uuid();v2b uuid:=gen_random_uuid();v56 uuid:=('a'||substr(gen_random_uuid()::text,2))::uuid;
 v1e uuid:=('a'||substr(gen_random_uuid()::text,2))::uuid;v4f uuid:=gen_random_uuid();v57 uuid:=('a'||substr(gen_random_uuid()::text,2))::uuid;v27 uuid:=gen_random_uuid();
 v2 uuid:=('a'||substr(gen_random_uuid()::text,2))::uuid;v4e uuid:=gen_random_uuid();v3 uuid:=gen_random_uuid();v4d uuid:=gen_random_uuid();
 v32 uuid:=gen_random_uuid();v34 uuid:=gen_random_uuid();v1c uuid:=gen_random_uuid();
 v1a uuid:=gen_random_uuid();v19 uuid:=gen_random_uuid();v13 uuid:=gen_random_uuid();
 vc uuid:=gen_random_uuid();v22 uuid:=gen_random_uuid();v11 uuid:=gen_random_uuid();v45 uuid:=gen_random_uuid();v24 uuid:=gen_random_uuid();
 f_day date:=(clock_timestamp() AT TIME ZONE 'Europe/Berlin')::date-1;v2f timestamptz;v0 timestamptz;v30 text;v1 text;
 vd jsonb;v3d jsonb;v48 jsonb;v20 jsonb;v1f jsonb;
 ve jsonb;v23 jsonb;v7 jsonb;va jsonb;vb jsonb;v8 jsonb;v9 jsonb;
 v49 jsonb;v31 jsonb;v15 jsonb;v29 jsonb;v37 jsonb;v3b jsonb;v3c jsonb;v25 jsonb;v26 jsonb;
 v33 jsonb;v35 jsonb;v1d jsonb;v58 boolean;
 v17 jsonb;v18 jsonb;
 v51 text:=repeat(chr(128167),250);v52 jsonb;v54 jsonb;
 fx_page1 jsonb;fx_page2 jsonb;v4c jsonb;v16 jsonb;v14 jsonb;
 v55 jsonb;f_bad jsonb;v10 jsonb;vf jsonb;f_key text;v28 text;v46 text;v4b text;
 v2a boolean:=false;v53 boolean:=false;v6 boolean:=false;
BEGIN
 BEGIN
  v58:=EXISTS(SELECT 1 FROM public.vital_sign_catalog WHERE key='weight');
  INSERT INTO public.tenants(id,name) VALUES(f_t,'CP365 synthetic Nutrition rollback fixture');
  INSERT INTO public.roles(id,key,name) VALUES(f_r,'cp365_nutrition_'||f_r,'Synthetic Nutrition author'),(v40,'cp365_nutrition_review_'||v40,'Synthetic independent Nutrition reader');
  INSERT INTO public.role_permissions(role_id,permission_key)
   SELECT own.role_id,p.permission_key FROM unnest(ARRAY[f_r,v40]) own(role_id)
   CROSS JOIN unnest(ARRAY['pflege.plans.view','pflege.plans.manage','pflege.documentation.view','pflege.documentation.create','pflege.documentation.sign','pflege.vitals.view']) p(permission_key);
  INSERT INTO auth.users(id,email,raw_user_meta_data,raw_app_meta_data) VALUES(f_u,f_u||'@example.invalid','{}','{}'),(v44,v44||'@example.invalid','{}','{}');
  UPDATE public.profiles SET tenant_id=f_t,role_id=f_r,role_key='pfleger',is_active=true,status='active',display_name='Synthetic Nutrition Author' WHERE id=f_u;
  UPDATE public.profiles SET tenant_id=f_t,role_id=v40,role_key='pfleger',is_active=true,status='active',display_name='Synthetic independent Nutrition reader' WHERE id=v44;
  INSERT INTO auth.sessions(id,user_id,not_after) VALUES(f_s,f_u,clock_timestamp()+interval '2 hours'),(v42,v44,clock_timestamp()+interval '2 hours');
  INSERT INTO public.clients(id,tenant_id,first_name,last_name,status,lifecycle_status) VALUES(f_c,f_t,'Synthetic','Nutrition case','aktiv','aktiv'),(v21,f_t,'Synthetic','Other Nutrition case','aktiv','aktiv');
  INSERT INTO public.client_module_assignments(tenant_id,client_id,module_key,status,is_active) VALUES(f_t,f_c,'pflege','active',true),(f_t,v21,'pflege','active',true);
  vd:=jsonb_build_object('sub',f_u,'role','authenticated','session_id',f_s,'exp',extract(epoch FROM clock_timestamp()+interval '1 hour')::bigint);
  v3d:=jsonb_build_object('sub',v44,'role','authenticated','session_id',v42,'exp',extract(epoch FROM clock_timestamp()+interval '1 hour')::bigint);
  PERFORM set_config('request.jwt.claims',vd::text,true);
  -- Exact ECMAScript trim and UTF-16 length, preserving accepted bytes.
  IF care_private.nutrition_text(to_jsonb(chr(160)||chr(65279)),1,300) IS NOT FALSE
   OR care_private.nutrition_text(to_jsonb(chr(133)),1,1) IS NOT TRUE
   OR care_private.nutrition_text(to_jsonb(repeat(chr(128167),2)),4,4) IS NOT TRUE
   OR care_private.nutrition_text(to_jsonb(repeat(chr(128167),2)),0,3) IS NOT FALSE
   OR care_private.nutrition_text(to_jsonb(repeat(chr(128167),150)),3,300) IS NOT TRUE
   OR care_private.nutrition_text(to_jsonb(repeat(chr(128167),151)),3,300) IS NOT FALSE
   OR care_private.nutrition_text(to_jsonb(v51),1,500) IS NOT TRUE
   OR care_private.nutrition_text(to_jsonb(repeat(chr(128167),251)),1,500) IS NOT FALSE THEN RAISE EXCEPTION 'ECMAScript whitespace/UTF-16 contract differs';END IF;
  INSERT INTO public.care_plans(id,tenant_id,client_id,title,status,valid_from,valid_until) VALUES(v2b,f_t,f_c,'Synthetic explicit Nutrition plan','aktiv',f_day-10,f_day+30);
  INSERT INTO public.care_plan_items(id,tenant_id,care_plan_id,category,title,intervention,status,sort_order,created_by,updated_by)
   VALUES(v1e,f_t,v2b,'drink_protocol','Synthetic explicitly planned drink support','Synthetic authored planning only; no actual drink asserted','active',1,f_u,f_u);
  SELECT jsonb_build_object('plan',to_jsonb(p),'items',(SELECT jsonb_agg(to_jsonb(i) ORDER BY i.id) FROM public.care_plan_items i WHERE i.tenant_id=f_t AND i.care_plan_id=v2b)) INTO v48 FROM public.care_plans p WHERE p.id=v2b;
  INSERT INTO public.care_plan_versions(id,tenant_id,care_plan_id,version,snapshot,reason,actor_id,actor_name) VALUES(v56,f_t,v2b,1,v48,'Synthetic explicit native plan version',f_u,'Synthetic Nutrition Author');
  INSERT INTO public.care_tours(id,tenant_id,tour_date,name,status,created_by,updated_by) VALUES(v4f,f_t,f_day,'Synthetic published Nutrition tour','published',f_u,f_u);
  INSERT INTO public.care_tour_stops(id,tenant_id,tour_id,sequence_no,client_id,client_name_snapshot,planned_start,planned_end,status)
   VALUES(v57,f_t,v4f,1,f_c,'Synthetic Nutrition case','12:15:30.123456','12:45:30.123456','planned'),(v27,f_t,v4f,2,f_c,'Synthetic Nutrition case','13:15:30.654321','13:45:30.654321','planned');
  INSERT INTO public.care_assessments(id,tenant_id,subject_type,subject_id,subject_name_snapshot,variant,status,version,assessor_profile_id,assessor_name_snapshot,created_by,updated_by)
   VALUES(v2,f_t,'client',f_c,'Synthetic Nutrition case','ambulant','draft',1,f_u,'Synthetic Nutrition Author',f_u,f_u);
  INSERT INTO public.care_assessment_topics(id,tenant_id,assessment_id,topic_key,professional_assessment) VALUES(v4e,f_t,v2,'self_care','Synthetic explicit draft assessment; no clinical conclusion');
  INSERT INTO public.care_assessment_measures(id,tenant_id,assessment_id,title,personal_goal,intervention,timing,frequency,responsible_role,evaluation_criteria,status)
   VALUES(v3,f_t,v2,'Synthetic draft Nutrition measure','Synthetic goal','Synthetic planned support','Synthetic explicit noon visit','Synthetic individual frequency','Synthetic role','Synthetic review criteria','planned');
  v2f:=(f_day+time '12:15:30.123456') AT TIME ZONE 'Europe/Berlin';v0:=v2f+interval '1 minute 0.111111 second';
  v30:=to_char(v2f AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"');v1:=to_char(v0 AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"');
  INSERT INTO public.care_operations_tasks(id,tenant_id,client_id,title,description,due_on,status,created_by) VALUES(v4d,f_t,f_c,'Synthetic date-only follow-up','Date is not an actual instant',f_day,'open',f_u);
  ve:=public.web_read_nutrition_elimination_binding_context(f_t,f_c,f_u,v56,v1e,v57,v2);
  SELECT jsonb_build_object('plan',(SELECT to_jsonb(x) FROM public.care_plans x WHERE x.id=v2b),'planVersion',(SELECT to_jsonb(x) FROM public.care_plan_versions x WHERE x.id=v56),'measure',(SELECT to_jsonb(x) FROM public.care_plan_items x WHERE x.id=v1e),'visit',(SELECT to_jsonb(x) FROM public.care_tour_stops x WHERE x.id=v57),'tour',(SELECT to_jsonb(x) FROM public.care_tours x WHERE x.id=v4f),'assessment',(SELECT to_jsonb(x) FROM public.care_assessments x WHERE x.id=v2),
   'assessmentTopics',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.id),'[]'::jsonb) FROM public.care_assessment_topics x WHERE x.tenant_id=f_t AND x.assessment_id=v2),'assessmentRisks',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.id),'[]'::jsonb) FROM public.care_assessment_risks x WHERE x.tenant_id=f_t AND x.assessment_id=v2),'assessmentMeasures',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.id),'[]'::jsonb) FROM public.care_assessment_measures x WHERE x.tenant_id=f_t AND x.assessment_id=v2),'instrumentSelection',null,'model',null,'instruments','[]'::jsonb) INTO v20;
  IF ve->'nativeOriginals' IS DISTINCT FROM v20 OR (ve->>'planSnapshotSha256'~'^sha256:[a-f0-9]{64}$') IS NOT TRUE THEN RAISE EXCEPTION 'Full native context differs from independently selected originals';END IF;
  IF ve#>'{nativeOriginals,instrumentSelection}' IS DISTINCT FROM 'null'::jsonb OR ve#>'{nativeOriginals,model}' IS DISTINCT FROM 'null'::jsonb OR ve#>'{nativeOriginals,instruments}' IS DISTINCT FROM '[]'::jsonb OR ve#>'{sources,devices}' IS DISTINCT FROM '[]'::jsonb OR jsonb_array_length(ve#>'{sources,tasks}') IS DISTINCT FROM 1 OR ve#>'{sources,tasks,0,dueAt}' IS DISTINCT FROM 'null'::jsonb THEN RAISE EXCEPTION 'Unknown instruments/devices/date-only deadline were inferred';END IF;
  va:=jsonb_build_object('schemaVersion','1','requestId',vc,'tenantId',f_t,'clientId',f_c,'actorId',f_u,'planVersionId',v56,'measureId',v1e,'visitId',v57,'assessmentId',v2,'kind','drink_protocol','title','Synthetic explicitly planned drink support','plannedAt',v30,'nativeOriginals',ve->'nativeOriginals','sources',ve->'sources');
  vb:=public.web_capture_nutrition_elimination_plan_binding(va);
  IF vb->'packet' IS DISTINCT FROM va OR vb->>'requestId' IS DISTINCT FROM vc::text OR vb#>'{binding,nativeOriginals}' IS DISTINCT FROM v20 OR vb#>'{binding,sources}' IS DISTINCT FROM ve->'sources' OR vb#>'{binding,planSnapshotSha256}' IS DISTINCT FROM ve->'planSnapshotSha256' OR vb#>>'{binding,capturedBy}' IS DISTINCT FROM f_u::text OR (vb#>>'{binding,plannedAt}')::timestamptz IS DISTINCT FROM v2f THEN RAISE EXCEPTION 'Capture own original lost native scope/hash/time';END IF;
  FOREACH f_key IN ARRAY ARRAY['tenantId','clientId','planVersionId','measureId','visitId','assessmentId','kind','title'] LOOP IF vb#>ARRAY['binding',f_key] IS DISTINCT FROM va->f_key THEN RAISE EXCEPTION 'Capture receipt identity changed: %',f_key;END IF;END LOOP;
  IF public.web_capture_nutrition_elimination_plan_binding(va) IS DISTINCT FROM vb OR public.web_confirm_nutrition_elimination_plan_binding(f_t,f_c,f_u,vc,va) IS DISTINCT FROM vb THEN RAISE EXCEPTION 'Exact capture replay/confirm changed';END IF;
  PERFORM pg_temp.cp365_nutrition_expect(f_t,'capture',jsonb_build_object('p',va||jsonb_build_object('title','Changed same request')),ARRAY['40001'],'Capture changed same request accepted');
  PERFORM pg_temp.cp365_nutrition_expect(f_t,'capture_confirm',jsonb_build_object('t',f_t,'c',f_c,'u',f_u,'r',vc,'p',va||jsonb_build_object('title','Changed confirm')),ARRAY['P0G02'],'Changed capture confirmation accepted');
  v7:=public.web_read_nutrition_elimination_binding_context(f_t,f_c,f_u,v56,v1e,v27,v2);
  v8:=va||jsonb_build_object('requestId',v22,'visitId',v27,'plannedAt',to_char(((f_day+time '13:15:30.654321') AT TIME ZONE 'Europe/Berlin') AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),'nativeOriginals',v7->'nativeOriginals','sources',v7->'sources');
  v9:=public.web_capture_nutrition_elimination_plan_binding(v8);
  IF v9#>'{binding,planSnapshotSha256}' IS DISTINCT FROM v7->'planSnapshotSha256' OR v9#>'{binding,nativeOriginals}' IS DISTINCT FROM v7->'nativeOriginals' OR public.web_confirm_nutrition_elimination_plan_binding(f_t,f_c,f_u,v22,v8) IS DISTINCT FROM v9 THEN RAISE EXCEPTION 'Second capture detached from independent original context';END IF;
  v31:=public.web_read_nutrition_elimination_prerequisites(f_t,f_c,f_u);
  IF jsonb_array_length(v31->'plans') IS DISTINCT FROM 2 OR (v31->>'stateFingerprint'~'^sha256:[a-f0-9]{64}$') IS NOT TRUE THEN RAISE EXCEPTION 'Captured prerequisites/proof unavailable or legacy fake binding exposed';END IF;
  v49:=ve->'sources';
  v15:=jsonb_build_object('kind','drink_protocol','title',va->'title','plannedAt',vb#>'{binding,plannedAt}','occurredAt',null,'planVersionId',v56,'measureId',v1e,'visitId',v57,'assessmentId',v2,'planSnapshotSha256',vb#>'{binding,planSnapshotSha256}',
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
  v29:=jsonb_build_object('schemaVersion','1','action','create','requestId',v11,'tenantId',f_t,'clientId',f_c,'actorId',f_u,'expectedHeadId',null,'expectedRevision',0,'entry',v15,'reason','','original',null,'sources',v49);
  PERFORM pg_temp.cp365_nutrition_expect(f_t,'care',jsonb_build_object('p',v29||jsonb_build_object('requestId',gen_random_uuid())||jsonb_build_object('unexpected',true)),ARRAY['23514'],'Unknown care key accepted');
  PERFORM pg_temp.cp365_nutrition_expect(f_t,'care',jsonb_build_object('p',v29||jsonb_build_object('requestId',gen_random_uuid())||jsonb_build_object('schemaVersion',1)),ARRAY['23514'],'Numeric care schema accepted');
  PERFORM pg_temp.cp365_nutrition_expect(f_t,'care',jsonb_build_object('p',jsonb_set(v29||jsonb_build_object('requestId',gen_random_uuid()),'{entry,title}','"Replaced native title"')),ARRAY['23514'],'Native title replaced');
  PERFORM pg_temp.cp365_nutrition_expect(f_t,'care',jsonb_build_object('p',(v29||jsonb_build_object('requestId',gen_random_uuid()))-'sources'),ARRAY['23514'],'Missing full sources accepted');
  PERFORM pg_temp.cp365_nutrition_expect(f_t,'care',jsonb_build_object('p',jsonb_set(v29||jsonb_build_object('requestId',gen_random_uuid()),'{entry,intake,actual}','"0.100"')),ARRAY['23514'],'Planned actual intake invented');
  BEGIN UPDATE public.care_tours SET notes='Synthetic hidden tour mutation' WHERE id=v4f;PERFORM pg_temp.cp365_nutrition_expect(f_t,'care',jsonb_build_object('p',v29||jsonb_build_object('requestId',gen_random_uuid())),ARRAY['40001'],'Hidden tour mutation ignored');RAISE EXCEPTION USING ERRCODE='Z0006';EXCEPTION WHEN SQLSTATE 'Z0006' THEN NULL;END;
  BEGIN UPDATE public.profiles SET display_name=repeat(chr(160),3) WHERE id=f_u;PERFORM pg_temp.cp365_nutrition_expect(f_t,'care',jsonb_build_object('p',v29||jsonb_build_object('requestId',gen_random_uuid())),ARRAY['42501'],'NBSP author accepted');RAISE EXCEPTION USING ERRCODE='Z0006';EXCEPTION WHEN SQLSTATE 'Z0006' THEN NULL;END;
  BEGIN UPDATE public.profiles SET display_name=repeat(chr(128167),251) WHERE id=f_u;PERFORM pg_temp.cp365_nutrition_expect(f_t,'care',jsonb_build_object('p',v29||jsonb_build_object('requestId',gen_random_uuid())),ARRAY['42501'],'UTF16 oversized author accepted');RAISE EXCEPTION USING ERRCODE='Z0006';EXCEPTION WHEN SQLSTATE 'Z0006' THEN NULL;END;
  BEGIN UPDATE public.profiles SET display_name=repeat('N',501) WHERE id=f_u;PERFORM pg_temp.cp365_nutrition_expect(f_t,'care',jsonb_build_object('p',v29||jsonb_build_object('requestId',gen_random_uuid())),ARRAY['42501'],'ASCII oversized author accepted');RAISE EXCEPTION USING ERRCODE='Z0006';EXCEPTION WHEN SQLSTATE 'Z0006' THEN NULL;END;
  FOREACH f_key IN ARRAY ARRAY['requestId','tenantId','clientId','actorId','entry.planVersionId','entry.measureId','entry.visitId','entry.assessmentId'] LOOP
   f_bad:=v29||jsonb_build_object('requestId',('a'||substr(gen_random_uuid()::text,2))::uuid);
   IF (f_bad#>>string_to_array(f_key,'.'))~'[a-f]' IS NOT TRUE THEN RAISE EXCEPTION 'Uppercase G test has no differing bytes';END IF;
   f_bad:=jsonb_set(f_bad,string_to_array(f_key,'.'),to_jsonb(upper(f_bad#>>string_to_array(f_key,'.'))));
  PERFORM pg_temp.cp365_nutrition_expect(f_t,'care',jsonb_build_object('p',f_bad),ARRAY['23514'],'Uppercase care UUID accepted');
  END LOOP;
  PERFORM pg_temp.cp365_nutrition_expect(f_t,'care',jsonb_build_object('p',jsonb_set(v29||jsonb_build_object('requestId',gen_random_uuid()),'{entry,assistance,helpers}',jsonb_build_array(upper(f_u::text)))),ARRAY['23514'],'Uppercase active helper accepted');
  PERFORM pg_temp.cp365_nutrition_expect(f_t,'care',jsonb_build_object('p',jsonb_set(v29||jsonb_build_object('requestId',gen_random_uuid()),'{entry,followUp}',jsonb_build_object('required',true,'reason','Explicit planned follow-up','responsibleProfileId',upper(f_u::text),'dueAt',to_char((v0+interval '2 days') AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),'taskId',null,'state','open','closureEvidence',''))),ARRAY['23514'],'Uppercase valid follow-up responsible profile accepted');
  v10:=pg_temp.cp365_nutrition_counts(f_t);
  BEGIN
   UPDATE public.profiles SET display_name=v51 WHERE id=f_u;
   v52:=v29||jsonb_build_object('requestId',gen_random_uuid());
   v54:=public.web_commit_nutrition_elimination_packet(v52);
   IF v54->'packet' IS DISTINCT FROM v52 OR v54#>>'{original,recordedByName}' IS DISTINCT FROM v51 OR v54#>>'{original,history,0,recordedByName}' IS DISTINCT FROM v51 OR public.web_confirm_nutrition_elimination_packet(f_t,f_c,f_u,(v52->>'requestId')::uuid,v52) IS DISTINCT FROM v54 THEN RAISE EXCEPTION 'Accepted 500-unit Unicode identity was changed or truncated';END IF;
   v53:=true;RAISE EXCEPTION USING ERRCODE='Z0003';
  EXCEPTION WHEN SQLSTATE 'Z0003' THEN NULL;END;
  vf:=pg_temp.cp365_nutrition_counts(f_t);
  IF v53 IS NOT TRUE OR vf IS DISTINCT FROM v10 OR (SELECT display_name FROM public.profiles WHERE id=f_u) IS DISTINCT FROM 'Synthetic Nutrition Author' THEN RAISE EXCEPTION 'Unicode isolated positive rollback failed';END IF;
  v37:=public.web_commit_nutrition_elimination_packet(v29);
  IF v37->'packet' IS DISTINCT FROM v29 OR v37#>'{original,payload}' IS DISTINCT FROM v15 OR v37#>>'{original,revision}' IS DISTINCT FROM '1' OR v37#>>'{original,recordedBy}' IS DISTINCT FROM f_u::text OR v37#>>'{original,tenantId}' IS DISTINCT FROM f_t::text OR v37#>>'{original,clientId}' IS DISTINCT FROM f_c::text OR v37#>'{original,rootId}' IS DISTINCT FROM v37#>'{original,history,0,id}' OR v37#>'{original,payload,occurredAt}' IS DISTINCT FROM 'null'::jsonb OR v37#>'{original,payload,intake,actual}' IS DISTINCT FROM 'null'::jsonb THEN RAISE EXCEPTION 'Planned own receipt invented facts or lost its own root';END IF;
  IF public.web_commit_nutrition_elimination_packet(v29) IS DISTINCT FROM v37 OR public.web_confirm_nutrition_elimination_packet(f_t,f_c,f_u,v11,v29) IS DISTINCT FROM v37 THEN RAISE EXCEPTION 'Exact care replay/confirmation differs';END IF;
  PERFORM pg_temp.cp365_nutrition_expect(f_t,'care',jsonb_build_object('p',jsonb_set(v29,'{entry,title}','"Changed same request"')),ARRAY['40001'],'Same care request changed facts');
  PERFORM pg_temp.cp365_nutrition_expect(f_t,'care_confirm',jsonb_build_object('t',f_t,'c',f_c,'u',f_u,'r',gen_random_uuid(),'p',v29),ARRAY['P0G02'],'Missing care confirmation became success');
  -- Preserve native observed/measured quantities and microsecond actual time separately.
  v33:=jsonb_build_object('action','record','reason','','entry',jsonb_build_object('kind','drink','occurredAt',v1,'source','observed','reportedBy','','observation','Synthetic explicit observed amount','reaction','Synthetic no reaction observed','reviewState','not_required','reviewAt','','reviewReason','Synthetic no separate review requested','description','Synthetic measured water','outcome','taken','support','provided','offered',jsonb_build_object('state','measured','value','0.300','unit','ml','basis','Synthetic actual graduated vessel'),'actual',jsonb_build_object('state','measured','value','0.100','unit','ml','basis','Synthetic actual graduated vessel before and after'),'reason',''));
  v35:=jsonb_build_object('version','2026-10-09.1','clientId',f_c,'rootId',v32,'expectedHeadId','','draft',v33);
  INSERT INTO public.care_protocol_roots(id,tenant_id,client_id,version,kind,created_at,recorded_by) VALUES(v32,f_t,f_c,'2026-10-09.1','drink',v0,f_u);
  INSERT INTO public.care_protocol_events(id,tenant_id,client_id,root_id,sequence,previous_id,actor_id,actor_name,request_id,recorded_at,draft,request_payload)
   VALUES(v34,f_t,f_c,v32,1,null,f_u,'Synthetic Nutrition Author',gen_random_uuid(),v0+interval '1 second',v33,v35);
  v55:=public.web_read_nutrition_elimination_binding_context(f_t,f_c,f_u,v56,v1e,v57,v2);
  IF jsonb_array_length(v55#>'{sources,protocols}') IS DISTINCT FROM 1 OR v55->'planSnapshotSha256' IS DISTINCT FROM ve->'planSnapshotSha256' OR v55#>'{sources,assessment,fingerprint}' IS NOT DISTINCT FROM ve#>'{sources,assessment,fingerprint}' THEN RAISE EXCEPTION 'Dynamic native source lost or immutable foundation rewritten';END IF;
  IF public.web_confirm_nutrition_elimination_plan_binding(f_t,f_c,f_u,vc,va) IS DISTINCT FROM vb OR public.web_confirm_nutrition_elimination_packet(f_t,f_c,f_u,v11,v29) IS DISTINCT FROM v37 THEN RAISE EXCEPTION 'Native drift rewrote an original own receipt';END IF;
  v58:=EXISTS(SELECT 1 FROM public.vital_sign_catalog WHERE key='weight');
  IF v58 IS NOT TRUE THEN INSERT INTO public.vital_sign_catalog(key,category,label,short_label,default_unit,components,default_enabled,is_active,sort_order) VALUES('weight','basis','Synthetic fixture weight','Synthetic','kg','["value"]',true,true,9999);END IF;
  INSERT INTO public.vital_sign_measurements(id,tenant_id,client_id,vital_key,values,display_value,unit,context,note,source,flag_status,recorded_by,recorded_by_name,measured_at,occurred_at)
   VALUES(v1c,f_t,f_c,'weight','{"value":70.100}','70.100','kg','{"conditions":"Synthetic explicit legacy conditions"}','Synthetic capture without known observation time','import','unrated',f_u,'Synthetic Nutrition Author',v0,null);
  SELECT to_jsonb(m) INTO v1d FROM public.vital_sign_measurements m WHERE m.id=v1c;
  v23:=v55;v55:=public.web_read_nutrition_elimination_binding_context(f_t,f_c,f_u,v56,v1e,v57,v2);
  IF v55#>'{sources,weights}' IS DISTINCT FROM '[]'::jsonb OR v55#>'{sources,assessment,fingerprint}' IS NOT DISTINCT FROM v23#>'{sources,assessment,fingerprint}' OR v55->'nativeOriginals' IS DISTINCT FROM v20 THEN RAISE EXCEPTION 'Unknown actual weight time was inferred or raw source omitted from CAS';END IF;
  v3b:=v29||jsonb_build_object('action','revise','requestId',v45,'expectedHeadId',v37#>'{original,headId}','expectedRevision',1,'original',v37->'original','reason','Synthetic explicit planned support clarification','entry',jsonb_set(v15,'{assistance,details}','"Synthetic explicitly authored planning clarification"'));
  PERFORM pg_temp.cp365_nutrition_expect(f_t,'care',jsonb_build_object('p',v3b),ARRAY['40001'],'Stale complete native source pool accepted');
  v3b:=v3b||jsonb_build_object('sources',v55->'sources');
  BEGIN UPDATE public.care_protocol_events SET actor_name='Synthetic changed hidden protocol field' WHERE id=v34;PERFORM pg_temp.cp365_nutrition_expect(f_t,'care',jsonb_build_object('p',v3b||jsonb_build_object('requestId',gen_random_uuid())),ARRAY['40001'],'Hidden native protocol mutation ignored');RAISE EXCEPTION USING ERRCODE='Z0006';EXCEPTION WHEN SQLSTATE 'Z0006' THEN NULL;END;
  IF (v3b->>'expectedHeadId')~'[a-f]' IS NOT TRUE THEN RAISE EXCEPTION 'Uppercase CAS negative has no differing bytes';END IF;
  PERFORM pg_temp.cp365_nutrition_expect(f_t,'care',jsonb_build_object('p',jsonb_set(v3b||jsonb_build_object('requestId',gen_random_uuid()),'{expectedHeadId}',to_jsonb(upper(v3b->>'expectedHeadId')))),ARRAY['23514','40001'],'Uppercase CAS accepted');
  v3c:=public.web_commit_nutrition_elimination_packet(v3b);
  IF v3c#>>'{original,revision}' IS DISTINCT FROM '2' OR jsonb_array_length(v3c#>'{original,history}') IS DISTINCT FROM 2 OR v3c#>'{original,history,0}' IS DISTINCT FROM v37#>'{original,history,0}' OR v3c#>'{original,history,1,previousId}' IS DISTINCT FROM v37#>'{original,headId}' OR v3c#>'{original,payload}' IS DISTINCT FROM v3b->'entry' THEN RAISE EXCEPTION 'Append-only correction replaced original facts';END IF;
  IF public.web_commit_nutrition_elimination_packet(v3b) IS DISTINCT FROM v3c OR public.web_confirm_nutrition_elimination_packet(f_t,f_c,f_u,v45,v3b) IS DISTINCT FROM v3c OR public.web_confirm_nutrition_elimination_packet(f_t,f_c,f_u,v11,v29) IS DISTINCT FROM v37 THEN RAISE EXCEPTION 'Revision/earlier own confirmations differ';END IF;
  PERFORM pg_temp.cp365_nutrition_expect(f_t,'care',jsonb_build_object('p',v3b||jsonb_build_object('requestId',gen_random_uuid())),ARRAY['40001'],'Stale revision accepted');
  FOREACH v28 IN ARRAY ARRAY['offered','performed','partial','refused','not_performed'] LOOP
   f_bad:=v3b||jsonb_build_object('requestId',gen_random_uuid(),'expectedHeadId',v3c#>'{original,headId}','expectedRevision',2,'original',v3c->'original','entry',v3c#>'{original,payload}');
   f_bad:=jsonb_set(jsonb_set(f_bad,'{entry,execution,outcome}',to_jsonb(v28)),'{entry,occurredAt}',to_jsonb(v1));
  PERFORM pg_temp.cp365_nutrition_expect(f_t,'care',jsonb_build_object('p',f_bad),ARRAY['42501'],'Unproven actual G outcome accepted');
  END LOOP;
  v23:=public.web_read_nutrition_elimination_binding_context(f_t,f_c,f_u,v56,v1e,v27,v2);
  v25:=v29||jsonb_build_object('requestId',v24,'sources',v23->'sources','entry',v15||jsonb_build_object('visitId',v27,'plannedAt',v9#>'{binding,plannedAt}','planSnapshotSha256',v9#>'{binding,planSnapshotSha256}'));
  v26:=public.web_commit_nutrition_elimination_packet(v25);
  fx_page1:=public.web_read_nutrition_elimination_page(f_t,f_c,f_u,null,null,1);
  fx_page2:=public.web_read_nutrition_elimination_page(f_t,f_c,f_u,(fx_page1->>'nextCursorRecordedAt')::timestamptz,(fx_page1->>'nextCursorId')::uuid,1);
  v4c:=public.web_read_nutrition_elimination_page(f_t,f_c,f_u,(fx_page2->>'nextCursorRecordedAt')::timestamptz,(fx_page2->>'nextCursorId')::uuid,1);
  IF jsonb_array_length(fx_page1->'rows') IS DISTINCT FROM 1 OR jsonb_array_length(fx_page2->'rows') IS DISTINCT FROM 1 OR jsonb_array_length(v4c->'rows') IS DISTINCT FROM 0 OR fx_page1#>'{rows,0,rootId}' IS NOT DISTINCT FROM fx_page2#>'{rows,0,rootId}' OR fx_page1->'stateFingerprint' IS DISTINCT FROM fx_page2->'stateFingerprint' OR fx_page1->'stateFingerprint' IS DISTINCT FROM v4c->'stateFingerprint' OR (fx_page1->>'stateFingerprint'~'^sha256:[a-f0-9]{64}$') IS NOT TRUE THEN RAISE EXCEPTION 'Complete care pagination/proof failed';END IF;
  PERFORM pg_temp.cp365_nutrition_expect(f_t,'care_page',jsonb_build_object('t',f_t,'c',f_c,'u',f_u,'at',clock_timestamp(),'id',null,'n',1),ARRAY['22023'],'Partial care cursor accepted');
  PERFORM pg_temp.cp365_nutrition_expect(f_t,'care_page',jsonb_build_object('t',f_t,'c',f_c,'u',f_u,'at',null,'id',null,'n',0),ARRAY['22023'],'Zero care page accepted');
  PERFORM pg_temp.cp365_nutrition_expect(f_t,'care_page',jsonb_build_object('t',f_t,'c',f_c,'u',f_u,'at',clock_timestamp(),'id',gen_random_uuid(),'n',1),ARRAY['22023'],'Unretained care cursor accepted');
  -- Privileged historical synthetic actual is readable; this does not enable new G actual writes.
  v17:=v15||jsonb_build_object('occurredAt',v1,'decision',jsonb_build_object('state','consented','recordedAt',v1,'reason','','consultation','Synthetic historical consent field only'),'intake',jsonb_build_object('offered','0.300','actual','0.100','unit','ml','item','Synthetic historical water','dietForm','','target',null,'targetUnit','none'),'execution',jsonb_build_object('outcome','performed','performedBy',jsonb_build_array(f_u),'result','Synthetic historical result; provenance remains unverified','deviation',''),'lifecycle','completed');
  INSERT INTO public.nutrition_elimination_roots(id,tenant_id,client_id,kind,plan_binding_id,created_at) VALUES(v1a,f_t,f_c,'drink_protocol',(vb#>>'{binding,id}')::uuid,v0);
  INSERT INTO public.nutrition_elimination_events(id,tenant_id,client_id,root_id,revision,previous_id,request_id,actor_id,actor_name,recorded_at,reason,payload,content_fingerprint,packet)
   VALUES(v1a,f_t,f_c,v1a,1,null,v19,f_u,'Synthetic historical Nutrition author',v0,'',v17,'sha256:'||encode(extensions.digest(convert_to(v17::text,'UTF8'),'sha256'),'hex'),'{}');
  v18:=care_private.nutrition_elimination_original(v1a);
  IF v18#>>'{payload,intake,actual}' IS DISTINCT FROM '0.100' OR v18#>>'{payload,occurredAt}' IS DISTINCT FROM v1 OR v18#>>'{history,0,id}' IS DISTINCT FROM v1a::text THEN RAISE EXCEPTION 'Historical exact actual decimal/time/root changed';END IF;
  v55:=public.web_read_nutrition_elimination_page(f_t,f_c,f_u,null,null,1);
  IF v55#>'{rows,0}' IS DISTINCT FROM fx_page1#>'{rows,0}' OR v55->'stateFingerprint' IS NOT DISTINCT FROM fx_page1->'stateFingerprint' THEN RAISE EXCEPTION 'Older off-page insertion escaped ledger proof';END IF;
  v6:=true;
  v1f:=public.web_read_nutrition_elimination_binding_context(f_t,f_c,f_u,v56,v1e,v57,v2)->'nativeOriginals';
  IF v1f IS DISTINCT FROM v20 OR (SELECT draft FROM public.care_protocol_events WHERE id=v34) IS DISTINCT FROM v33 OR (SELECT request_payload FROM public.care_protocol_events WHERE id=v34) IS DISTINCT FROM v35 OR (SELECT to_jsonb(m) FROM public.vital_sign_measurements m WHERE m.id=v1c) IS DISTINCT FROM v1d OR (SELECT count(*) FROM public.care_protocol_events WHERE root_id=v32) IS DISTINCT FROM 1 THEN RAISE EXCEPTION 'Prepared planning/review mutated native originals';END IF;
  v16:=public.web_read_nutrition_elimination_page(f_t,f_c,f_u,null,null,100);
  v31:=public.web_read_nutrition_elimination_prerequisites(f_t,f_c,f_u);
  v14:=public.web_read_nutrition_elimination_page(f_t,v21,f_u,null,null,100);
  IF v14->'rows' IS DISTINCT FROM '[]'::jsonb OR v14->'nextCursorId' IS DISTINCT FROM 'null'::jsonb OR v14->'nextCursorRecordedAt' IS DISTINCT FROM 'null'::jsonb OR (v14->>'stateFingerprint'~'^sha256:[a-f0-9]{64}$') IS NOT TRUE THEN RAISE EXCEPTION 'Empty scoped read lacks complete proof';END IF;
  IF EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname IN('public','care_private') AND p.proname LIKE '%nutrition%' AND (has_function_privilege('anon',p.oid,'EXECUTE') OR has_function_privilege('authenticated',p.oid,'EXECUTE') OR has_function_privilege('service_role',p.oid,'EXECUTE'))) THEN RAISE EXCEPTION 'Nutrition RPC execute quarantine widened';END IF;
  FOREACH v4b IN ARRAY ARRAY['nutrition_elimination_plan_bindings','nutrition_elimination_roots','nutrition_elimination_events','nutrition_elimination_receipts','nutrition_review_roots','nutrition_review_events','nutrition_review_receipts'] LOOP
   FOREACH v46 IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
    IF has_table_privilege(v46,'public.'||v4b,'SELECT,INSERT,UPDATE,DELETE') THEN RAISE EXCEPTION 'Nutrition original table privilege widened: % %',v46,v4b;END IF;
   END LOOP;
   IF NOT EXISTS(SELECT 1 FROM pg_class p JOIN pg_namespace n ON n.oid=p.relnamespace WHERE n.nspname='public' AND p.relname=v4b AND p.relrowsecurity) THEN RAISE EXCEPTION 'Nutrition RLS missing: %',v4b;END IF;
  END LOOP;
  FOREACH v4b IN ARRAY ARRAY['nutrition_binding_captures','nutrition_review_scopes'] LOOP
   FOREACH v46 IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP IF has_table_privilege(v46,'care_private.'||v4b,'SELECT,INSERT,UPDATE,DELETE') THEN RAISE EXCEPTION 'Private Nutrition capture/scope privilege widened';END IF;END LOOP;
  END LOOP;
  v2a:=true;RAISE EXCEPTION USING ERRCODE='Z0001';
 EXCEPTION WHEN SQLSTATE 'Z0001' THEN NULL;END;
 IF v2a IS NOT TRUE OR
  EXISTS(SELECT 1 FROM auth.users WHERE id IN(f_u,v44,v39)) OR
  EXISTS(SELECT 1 FROM auth.sessions WHERE id IN(f_s,v42,v3a)) OR
  EXISTS(SELECT 1 FROM public.roles WHERE id IN(f_r,v40)) OR
  EXISTS(SELECT 1 FROM public.employee_employment_details WHERE employee_id=v13) OR
  (v58 IS NOT TRUE AND EXISTS(SELECT 1 FROM public.vital_sign_catalog WHERE key='weight')) OR
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
  EXISTS(SELECT 1 FROM care_private.nutrition_review_scopes WHERE tenant_id=f_t) OR EXISTS(SELECT 1 FROM public.profiles WHERE id IN(f_u,v44,v39)) OR EXISTS(SELECT 1 FROM public.role_permissions WHERE role_id IN(f_r,v40)) THEN RAISE EXCEPTION 'Nutrition full inner rollback cleanup failed';END IF;
 PERFORM set_config('cp365.nutrition_workspace_test_evidence',jsonb_build_object('schemaVersion',1,'fixtureKind','core','cleanupConfirmed',true,'expected',jsonb_build_object('tenantId',f_t,'clientId',f_c,'actorId',f_u,'reviewerId',v44),'context',ve,'otherCaptureContext',v7,'capturePacket',va,'captureReceipt',vb,'otherCapturePacket',v8,'otherCaptureReceipt',v9,'prerequisites',v31,'carePacket',v29,'careReceipt',v37,'revisionPacket',v3b,'revisionReceipt',v3c,'otherCarePacket',v25,'otherCareReceipt',v26,'unicodeName',v51,'unicodeCarePacket',v52,'unicodeCareReceipt',v54,'unicodeCasesPassed',v53,'canonicalIdsBlocked',v6,'nativeProtocolRequest',v35,'legacyWeight',v1d,'historicalOriginal',v18,'carePage1',fx_page1,'carePage2',fx_page2,'careTail',v4c,'finalCarePage',v16,'emptyPage',v14,'actualWritesBlocked',true)::text,true);
END $test$;
SELECT current_setting('cp365.nutrition_workspace_test_evidence',true)::jsonb AS evidence;
ROLLBACK;
