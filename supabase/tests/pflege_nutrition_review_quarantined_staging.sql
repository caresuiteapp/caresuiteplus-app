-- NEW independent Nutrition review rollback fixture; synthetic claims, no HTTP/clinical release.
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
 v43 uuid:=gen_random_uuid();v41 uuid:=gen_random_uuid();v3e uuid:=gen_random_uuid();v37 uuid:=gen_random_uuid();v38 uuid:=gen_random_uuid();
 f_c uuid:=('a'||substr(gen_random_uuid()::text,2))::uuid;v23 uuid:=gen_random_uuid();v2b uuid:=gen_random_uuid();v56 uuid:=('a'||substr(gen_random_uuid()::text,2))::uuid;
 v20 uuid:=('a'||substr(gen_random_uuid()::text,2))::uuid;v4f uuid:=gen_random_uuid();v57 uuid:=('a'||substr(gen_random_uuid()::text,2))::uuid;v28 uuid:=gen_random_uuid();
 v2 uuid:=('a'||substr(gen_random_uuid()::text,2))::uuid;v4e uuid:=gen_random_uuid();v3 uuid:=gen_random_uuid();v4d uuid:=gen_random_uuid();
 
 v1b uuid:=gen_random_uuid();v1a uuid:=gen_random_uuid();v14 uuid:=gen_random_uuid();v33 uuid:=gen_random_uuid();v13 uuid:=gen_random_uuid();v47 uuid:=gen_random_uuid();
 vc uuid:=gen_random_uuid();v24 uuid:=gen_random_uuid();v11 uuid:=gen_random_uuid();v44 uuid:=gen_random_uuid();v25 uuid:=gen_random_uuid();v40 uuid:=gen_random_uuid();
 f_day date:=(clock_timestamp() AT TIME ZONE 'Europe/Berlin')::date-1;v2f timestamptz;v0 timestamptz;v30 text;v1 text;
 vd jsonb;v3b jsonb;v48 jsonb;v22 jsonb;v21 jsonb;
 ve jsonb;v7 jsonb;va jsonb;vb jsonb;v8 jsonb;v9 jsonb;
 v49 jsonb;v31 jsonb;v16 jsonb;v29 jsonb;v35 jsonb;v39 jsonb;v3a jsonb;v26 jsonb;v27 jsonb;
 v58 boolean;
 v18 jsonb;v19 jsonb;v3c jsonb;v3f jsonb;v2e jsonb;v2d jsonb;
 v51 text:=repeat(chr(128167),250);
 fx_page1 jsonb;fx_page2 jsonb;v3d jsonb;v42 jsonb;v17 jsonb;v15 jsonb;
 v55 jsonb;f_bad jsonb;v10 jsonb;v1c jsonb;vf jsonb;f_key text;v1e text;v45 text;v4b text;
 v2a boolean:=false;v6 boolean:=false;v2c boolean:=false;
BEGIN
 BEGIN
  v58:=EXISTS(SELECT 1 FROM public.vital_sign_catalog WHERE key='weight');
  INSERT INTO public.tenants(id,name) VALUES(f_t,'CP365 synthetic Nutrition rollback fixture');
  INSERT INTO public.roles(id,key,name) VALUES(f_r,'cp365_nutrition_'||f_r,'Synthetic Nutrition author'),(v3e,'cp365_nutrition_review_'||v3e,'Synthetic independent Nutrition reader');
  INSERT INTO public.role_permissions(role_id,permission_key)
   SELECT own.role_id,p.permission_key FROM unnest(ARRAY[f_r,v3e]) own(role_id)
   CROSS JOIN unnest(ARRAY['pflege.plans.view','pflege.plans.manage','pflege.documentation.view','pflege.documentation.create','pflege.documentation.sign','pflege.vitals.view']) p(permission_key);
  INSERT INTO auth.users(id,email,raw_user_meta_data,raw_app_meta_data) VALUES(f_u,f_u||'@example.invalid','{}','{}'),(v43,v43||'@example.invalid','{}','{}');
  UPDATE public.profiles SET tenant_id=f_t,role_id=f_r,role_key='pfleger',is_active=true,status='active',display_name='Synthetic Nutrition Author' WHERE id=f_u;
  UPDATE public.profiles SET tenant_id=f_t,role_id=v3e,role_key='pfleger',is_active=true,status='active',display_name='Synthetic independent Nutrition reader' WHERE id=v43;
  INSERT INTO auth.sessions(id,user_id,not_after) VALUES(f_s,f_u,clock_timestamp()+interval '2 hours'),(v41,v43,clock_timestamp()+interval '2 hours');
  INSERT INTO public.clients(id,tenant_id,first_name,last_name,status,lifecycle_status) VALUES(f_c,f_t,'Synthetic','Nutrition case','aktiv','aktiv'),(v23,f_t,'Synthetic','Other Nutrition case','aktiv','aktiv');
  INSERT INTO public.client_module_assignments(tenant_id,client_id,module_key,status,is_active) VALUES(f_t,f_c,'pflege','active',true),(f_t,v23,'pflege','active',true);
  vd:=jsonb_build_object('sub',f_u,'role','authenticated','session_id',f_s,'exp',extract(epoch FROM clock_timestamp()+interval '1 hour')::bigint);
  v3b:=jsonb_build_object('sub',v43,'role','authenticated','session_id',v41,'exp',extract(epoch FROM clock_timestamp()+interval '1 hour')::bigint);
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
   VALUES(v20,f_t,v2b,'drink_protocol','Synthetic explicitly planned drink support','Synthetic authored planning only; no actual drink asserted','active',1,f_u,f_u);
  SELECT jsonb_build_object('plan',to_jsonb(p),'items',(SELECT jsonb_agg(to_jsonb(i) ORDER BY i.id) FROM public.care_plan_items i WHERE i.tenant_id=f_t AND i.care_plan_id=v2b)) INTO v48 FROM public.care_plans p WHERE p.id=v2b;
  INSERT INTO public.care_plan_versions(id,tenant_id,care_plan_id,version,snapshot,reason,actor_id,actor_name) VALUES(v56,f_t,v2b,1,v48,'Synthetic explicit native plan version',f_u,'Synthetic Nutrition Author');
  INSERT INTO public.care_tours(id,tenant_id,tour_date,name,status,created_by,updated_by) VALUES(v4f,f_t,f_day,'Synthetic published Nutrition tour','published',f_u,f_u);
  INSERT INTO public.care_tour_stops(id,tenant_id,tour_id,sequence_no,client_id,client_name_snapshot,planned_start,planned_end,status)
   VALUES(v57,f_t,v4f,1,f_c,'Synthetic Nutrition case','12:15:30.123456','12:45:30.123456','planned'),(v28,f_t,v4f,2,f_c,'Synthetic Nutrition case','13:15:30.654321','13:45:30.654321','planned');
  INSERT INTO public.care_assessments(id,tenant_id,subject_type,subject_id,subject_name_snapshot,variant,status,version,assessor_profile_id,assessor_name_snapshot,created_by,updated_by)
   VALUES(v2,f_t,'client',f_c,'Synthetic Nutrition case','ambulant','draft',1,f_u,'Synthetic Nutrition Author',f_u,f_u);
  INSERT INTO public.care_assessment_topics(id,tenant_id,assessment_id,topic_key,professional_assessment) VALUES(v4e,f_t,v2,'self_care','Synthetic explicit draft assessment; no clinical conclusion');
  INSERT INTO public.care_assessment_measures(id,tenant_id,assessment_id,title,personal_goal,intervention,timing,frequency,responsible_role,evaluation_criteria,status)
   VALUES(v3,f_t,v2,'Synthetic draft Nutrition measure','Synthetic goal','Synthetic planned support','Synthetic explicit noon visit','Synthetic individual frequency','Synthetic role','Synthetic review criteria','planned');
  v2f:=(f_day+time '12:15:30.123456') AT TIME ZONE 'Europe/Berlin';v0:=v2f+interval '1 minute 0.111111 second';
  v30:=to_char(v2f AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"');v1:=to_char(v0 AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"');
  INSERT INTO public.care_operations_tasks(id,tenant_id,client_id,title,description,due_on,status,created_by) VALUES(v4d,f_t,f_c,'Synthetic date-only follow-up','Date is not an actual instant',f_day,'open',f_u);
  ve:=public.web_read_nutrition_elimination_binding_context(f_t,f_c,f_u,v56,v20,v57,v2);
  SELECT jsonb_build_object('plan',(SELECT to_jsonb(x) FROM public.care_plans x WHERE x.id=v2b),'planVersion',(SELECT to_jsonb(x) FROM public.care_plan_versions x WHERE x.id=v56),'measure',(SELECT to_jsonb(x) FROM public.care_plan_items x WHERE x.id=v20),'visit',(SELECT to_jsonb(x) FROM public.care_tour_stops x WHERE x.id=v57),'tour',(SELECT to_jsonb(x) FROM public.care_tours x WHERE x.id=v4f),'assessment',(SELECT to_jsonb(x) FROM public.care_assessments x WHERE x.id=v2),
   'assessmentTopics',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.id),'[]'::jsonb) FROM public.care_assessment_topics x WHERE x.tenant_id=f_t AND x.assessment_id=v2),'assessmentRisks',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.id),'[]'::jsonb) FROM public.care_assessment_risks x WHERE x.tenant_id=f_t AND x.assessment_id=v2),'assessmentMeasures',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.id),'[]'::jsonb) FROM public.care_assessment_measures x WHERE x.tenant_id=f_t AND x.assessment_id=v2),'instrumentSelection',null,'model',null,'instruments','[]'::jsonb) INTO v22;
  IF ve->'nativeOriginals' IS DISTINCT FROM v22 OR (ve->>'planSnapshotSha256'~'^sha256:[a-f0-9]{64}$') IS NOT TRUE THEN RAISE EXCEPTION 'Full native context differs from independently selected originals';END IF;
  IF ve#>'{nativeOriginals,instrumentSelection}' IS DISTINCT FROM 'null'::jsonb OR ve#>'{nativeOriginals,model}' IS DISTINCT FROM 'null'::jsonb OR ve#>'{nativeOriginals,instruments}' IS DISTINCT FROM '[]'::jsonb OR ve#>'{sources,devices}' IS DISTINCT FROM '[]'::jsonb OR jsonb_array_length(ve#>'{sources,tasks}') IS DISTINCT FROM 1 OR ve#>'{sources,tasks,0,dueAt}' IS DISTINCT FROM 'null'::jsonb THEN RAISE EXCEPTION 'Unknown instruments/devices/date-only deadline were inferred';END IF;
  va:=jsonb_build_object('schemaVersion','1','requestId',vc,'tenantId',f_t,'clientId',f_c,'actorId',f_u,'planVersionId',v56,'measureId',v20,'visitId',v57,'assessmentId',v2,'kind','drink_protocol','title','Synthetic explicitly planned drink support','plannedAt',v30,'nativeOriginals',ve->'nativeOriginals','sources',ve->'sources');
  vb:=public.web_capture_nutrition_elimination_plan_binding(va);
  IF vb->'packet' IS DISTINCT FROM va OR vb->>'requestId' IS DISTINCT FROM vc::text OR vb#>'{binding,nativeOriginals}' IS DISTINCT FROM v22 OR vb#>'{binding,sources}' IS DISTINCT FROM ve->'sources' OR vb#>'{binding,planSnapshotSha256}' IS DISTINCT FROM ve->'planSnapshotSha256' OR vb#>>'{binding,capturedBy}' IS DISTINCT FROM f_u::text OR (vb#>>'{binding,plannedAt}')::timestamptz IS DISTINCT FROM v2f THEN RAISE EXCEPTION 'Capture own original lost native scope/hash/time';END IF;
  FOREACH f_key IN ARRAY ARRAY['tenantId','clientId','planVersionId','measureId','visitId','assessmentId','kind','title'] LOOP IF vb#>ARRAY['binding',f_key] IS DISTINCT FROM va->f_key THEN RAISE EXCEPTION 'Capture receipt identity changed: %',f_key;END IF;END LOOP;
  IF public.web_capture_nutrition_elimination_plan_binding(va) IS DISTINCT FROM vb OR public.web_confirm_nutrition_elimination_plan_binding(f_t,f_c,f_u,vc,va) IS DISTINCT FROM vb THEN RAISE EXCEPTION 'Exact capture replay/confirm changed';END IF;
  PERFORM pg_temp.cp365_nutrition_expect(f_t,'capture',jsonb_build_object('p',va||jsonb_build_object('title','Changed same request')),ARRAY['40001'],'Capture changed same request accepted');
  PERFORM pg_temp.cp365_nutrition_expect(f_t,'capture_confirm',jsonb_build_object('t',f_t,'c',f_c,'u',f_u,'r',vc,'p',va||jsonb_build_object('title','Changed confirm')),ARRAY['P0G02'],'Changed capture confirmation accepted');
  v7:=public.web_read_nutrition_elimination_binding_context(f_t,f_c,f_u,v56,v20,v28,v2);
  v8:=va||jsonb_build_object('requestId',v24,'visitId',v28,'plannedAt',to_char(((f_day+time '13:15:30.654321') AT TIME ZONE 'Europe/Berlin') AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),'nativeOriginals',v7->'nativeOriginals','sources',v7->'sources');
  v9:=public.web_capture_nutrition_elimination_plan_binding(v8);
  IF v9#>'{binding,planSnapshotSha256}' IS DISTINCT FROM v7->'planSnapshotSha256' OR v9#>'{binding,nativeOriginals}' IS DISTINCT FROM v7->'nativeOriginals' OR public.web_confirm_nutrition_elimination_plan_binding(f_t,f_c,f_u,v24,v8) IS DISTINCT FROM v9 THEN RAISE EXCEPTION 'Second capture detached from independent original context';END IF;
  v31:=public.web_read_nutrition_elimination_prerequisites(f_t,f_c,f_u);
  IF jsonb_array_length(v31->'plans') IS DISTINCT FROM 2 OR (v31->>'stateFingerprint'~'^sha256:[a-f0-9]{64}$') IS NOT TRUE THEN RAISE EXCEPTION 'Captured prerequisites/proof unavailable or legacy fake binding exposed';END IF;
  v49:=ve->'sources';
  v16:=jsonb_build_object('kind','drink_protocol','title',va->'title','plannedAt',vb#>'{binding,plannedAt}','occurredAt',null,'planVersionId',v56,'measureId',v20,'visitId',v57,'assessmentId',v2,'planSnapshotSha256',vb#>'{binding,planSnapshotSha256}',
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
  v29:=jsonb_build_object('schemaVersion','1','action','create','requestId',v11,'tenantId',f_t,'clientId',f_c,'actorId',f_u,'expectedHeadId',null,'expectedRevision',0,'entry',v16,'reason','','original',null,'sources',v49);
  v35:=public.web_commit_nutrition_elimination_packet(v29);
  IF v35->'packet' IS DISTINCT FROM v29 OR v35#>'{original,payload}' IS DISTINCT FROM v16 OR v35#>>'{original,revision}' IS DISTINCT FROM '1' OR v35#>>'{original,recordedBy}' IS DISTINCT FROM f_u::text OR v35#>>'{original,tenantId}' IS DISTINCT FROM f_t::text OR v35#>>'{original,clientId}' IS DISTINCT FROM f_c::text OR v35#>'{original,rootId}' IS DISTINCT FROM v35#>'{original,history,0,id}' OR v35#>'{original,payload,occurredAt}' IS DISTINCT FROM 'null'::jsonb OR v35#>'{original,payload,intake,actual}' IS DISTINCT FROM 'null'::jsonb THEN RAISE EXCEPTION 'Planned own receipt invented facts or lost its own root';END IF;
  IF public.web_commit_nutrition_elimination_packet(v29) IS DISTINCT FROM v35 OR public.web_confirm_nutrition_elimination_packet(f_t,f_c,f_u,v11,v29) IS DISTINCT FROM v35 THEN RAISE EXCEPTION 'Exact care replay/confirmation differs';END IF;
  PERFORM pg_temp.cp365_nutrition_expect(f_t,'care',jsonb_build_object('p',jsonb_set(v29,'{entry,title}','"Changed same request"')),ARRAY['40001'],'Same care request changed facts');
  PERFORM pg_temp.cp365_nutrition_expect(f_t,'care_confirm',jsonb_build_object('t',f_t,'c',f_c,'u',f_u,'r',gen_random_uuid(),'p',v29),ARRAY['P0G02'],'Missing care confirmation became success');
  v39:=v29||jsonb_build_object('action','revise','requestId',v44,'expectedHeadId',v35#>'{original,headId}','expectedRevision',1,'original',v35->'original','reason','Synthetic explicitly revised planning for technical inspection','entry',jsonb_set(v16,'{assistance,details}','"Synthetic explicitly authored planning clarification"'));
  v3a:=public.web_commit_nutrition_elimination_packet(v39);
  IF v3a#>>'{original,revision}' IS DISTINCT FROM '2' OR v3a#>'{original,history,0}' IS DISTINCT FROM v35#>'{original,history,0}' THEN RAISE EXCEPTION 'Review fixture current planning history detached';END IF;
  v26:=v29||jsonb_build_object('requestId',v25,'sources',v7->'sources','entry',v16||jsonb_build_object('visitId',v28,'plannedAt',v9#>'{binding,plannedAt}','planSnapshotSha256',v9#>'{binding,planSnapshotSha256}'));
  v27:=public.web_commit_nutrition_elimination_packet(v26);
  fx_page1:=public.web_read_nutrition_elimination_page(f_t,f_c,f_u,null,null,1);
  -- Privileged historical synthetic actual is readable; this does not enable new G actual writes.
  v18:=v16||jsonb_build_object('occurredAt',v1,'decision',jsonb_build_object('state','consented','recordedAt',v1,'reason','','consultation','Synthetic historical consent field only'),'intake',jsonb_build_object('offered','0.300','actual','0.100','unit','ml','item','Synthetic historical water','dietForm','','target',null,'targetUnit','none'),'execution',jsonb_build_object('outcome','performed','performedBy',jsonb_build_array(f_u),'result','Synthetic historical result; provenance remains unverified','deviation',''),'lifecycle','completed');
  INSERT INTO public.nutrition_elimination_roots(id,tenant_id,client_id,kind,plan_binding_id,created_at) VALUES(v1b,f_t,f_c,'drink_protocol',(vb#>>'{binding,id}')::uuid,v0);
  INSERT INTO public.nutrition_elimination_events(id,tenant_id,client_id,root_id,revision,previous_id,request_id,actor_id,actor_name,recorded_at,reason,payload,content_fingerprint,packet)
   VALUES(v1b,f_t,f_c,v1b,1,null,v1a,f_u,'Synthetic historical Nutrition author',v0,'',v18,'sha256:'||encode(extensions.digest(convert_to(v18::text,'UTF8'),'sha256'),'hex'),'{}');
  v19:=care_private.nutrition_elimination_original(v1b);
  IF v19#>>'{payload,intake,actual}' IS DISTINCT FROM '0.100' OR v19#>>'{payload,occurredAt}' IS DISTINCT FROM v1 OR v19#>>'{history,0,id}' IS DISTINCT FROM v1b::text THEN RAISE EXCEPTION 'Historical exact actual decimal/time/root changed';END IF;
  v55:=public.web_read_nutrition_elimination_page(f_t,f_c,f_u,null,null,1);
  IF v55#>'{rows,0}' IS DISTINCT FROM fx_page1#>'{rows,0}' OR v55->'stateFingerprint' IS NOT DISTINCT FROM fx_page1->'stateFingerprint' THEN RAISE EXCEPTION 'Older off-page insertion escaped ledger proof';END IF;
  v3c:=jsonb_build_object('schemaVersion','1','action','request','requestId',v40,'tenantId',f_t,'clientId',f_c,'actorId',f_u,'expectedHeadId',null,'expectedRevision',0,'careOriginal',v19,'reviewOriginal',null,'reason','Synthetic explicit historical evidence review request','requiredChange','','rationale','');
  BEGIN UPDATE public.profiles SET display_name=repeat(chr(160),3) WHERE id=f_u;PERFORM pg_temp.cp365_nutrition_expect(f_t,'review',jsonb_build_object('p',v3c||jsonb_build_object('requestId',gen_random_uuid())),ARRAY['42501'],'NBSP review author accepted');RAISE EXCEPTION USING ERRCODE='Z0006';EXCEPTION WHEN SQLSTATE 'Z0006' THEN NULL;END;
  BEGIN UPDATE public.profiles SET display_name=repeat(chr(128167),251) WHERE id=f_u;PERFORM pg_temp.cp365_nutrition_expect(f_t,'review',jsonb_build_object('p',v3c||jsonb_build_object('requestId',gen_random_uuid())),ARRAY['42501'],'UTF16 oversized review author accepted');RAISE EXCEPTION USING ERRCODE='Z0006';EXCEPTION WHEN SQLSTATE 'Z0006' THEN NULL;END;
  BEGIN UPDATE public.profiles SET display_name=repeat('R',501) WHERE id=f_u;PERFORM pg_temp.cp365_nutrition_expect(f_t,'review',jsonb_build_object('p',v3c||jsonb_build_object('requestId',gen_random_uuid())),ARRAY['42501'],'ASCII oversized review author accepted');RAISE EXCEPTION USING ERRCODE='Z0006';EXCEPTION WHEN SQLSTATE 'Z0006' THEN NULL;END;
  PERFORM pg_temp.cp365_nutrition_expect(f_t,'review',jsonb_build_object('p',v3c||jsonb_build_object('requestId',gen_random_uuid())||jsonb_build_object('schemaVersion',1)),ARRAY['23514'],'Numeric review schema accepted');
  FOREACH f_key IN ARRAY ARRAY['requestId','tenantId','clientId','actorId'] LOOP
   f_bad:=v3c||jsonb_build_object('requestId',('a'||substr(gen_random_uuid()::text,2))::uuid);
   IF (f_bad->>f_key)~'[a-f]' IS NOT TRUE THEN RAISE EXCEPTION 'Uppercase review test has no differing bytes';END IF;
   f_bad:=jsonb_set(f_bad,ARRAY[f_key],to_jsonb(upper(f_bad->>f_key)));
  PERFORM pg_temp.cp365_nutrition_expect(f_t,'review',jsonb_build_object('p',f_bad),ARRAY['23514'],'Uppercase review UUID accepted');
  END LOOP;v6:=true;
  v3f:=public.web_commit_nutrition_review(v3c);
  IF v3f->'packet' IS DISTINCT FROM v3c OR v3f#>>'{original,status}' IS DISTINCT FROM 'requested' OR v3f#>'{original,rootId}' IS DISTINCT FROM v3f#>'{original,history,0,id}' OR v3f#>'{original,history,0,qualification}' IS DISTINCT FROM 'null'::jsonb OR public.web_commit_nutrition_review(v3c) IS DISTINCT FROM v3f OR public.web_confirm_nutrition_review(f_t,f_c,f_u,v40,v3c) IS DISTINCT FROM v3f THEN RAISE EXCEPTION 'Own historical review request lost original/root or invented a decision';END IF;
  PERFORM pg_temp.cp365_nutrition_expect(f_t,'review',jsonb_build_object('p',v3c||jsonb_build_object('reason','Changed same review request')),ARRAY['40001'],'Changed same review request accepted');
  PERFORM pg_temp.cp365_nutrition_expect(f_t,'review',jsonb_build_object('p',jsonb_set(v3c||jsonb_build_object('requestId',gen_random_uuid()),'{careOriginal,payload,intake,actual}','"0.200"')),ARRAY['40001'],'Review substituted historical actual');
  -- Explicit independent qualification/scope still cannot close missing native execution provenance.
  INSERT INTO public.employees(id,tenant_id,profile_id,first_name,last_name,status,start_date) VALUES(v14,f_t,v43,'Synthetic','Nutrition reviewer','aktiv',f_day-30);
  INSERT INTO public.employee_employment_details(tenant_id,employee_id,employment_status) VALUES(f_t,v14,'active');
  INSERT INTO public.employee_documents(id,tenant_id,employee_id,category,title,file_name,storage_path,valid_until) VALUES(v13,f_t,v14,'qualification','Synthetic Nutrition qualification document','synthetic.pdf','synthetic-only/'||v13||'.pdf',f_day+30);
  INSERT INTO public.employee_qualifications(id,tenant_id,employee_id,qualification_type,title,issued_at,valid_until,document_id,verified_by,verified_at,status) VALUES(v33,f_t,v14,'synthetic_nutrition_review','Synthetic Nutrition scope qualification',f_day-30,f_day+30,v13,'Synthetic fixture provisioner',v0-interval '1 day','valid');
  INSERT INTO care_private.nutrition_review_scopes(id,tenant_id,employee_id,qualification_id,kind,qualification_fingerprint,document_fingerprint,approved_by,approved_at,valid_until)
   SELECT v47,f_t,v14,v33,'drink_protocol','sha256:'||encode(extensions.digest(convert_to(to_jsonb(q)::text,'UTF8'),'sha256'),'hex'),'sha256:'||encode(extensions.digest(convert_to(to_jsonb(d)::text,'UTF8'),'sha256'),'hex'),f_u,v0-interval '1 hour',clock_timestamp()+interval '1 day' FROM public.employee_qualifications q JOIN public.employee_documents d ON d.id=q.document_id WHERE q.id=v33;
  IF (SELECT count(*) FROM care_private.nutrition_review_scopes WHERE id=v47 AND tenant_id=f_t) IS DISTINCT FROM 1 THEN RAISE EXCEPTION 'Explicit independent scope fixture missing';END IF;
  PERFORM set_config('request.jwt.claims',v3b::text,true);
  FOREACH v1e IN ARRAY ARRAY['return','accept'] LOOP
   f_bad:=v3c||jsonb_build_object('action',v1e,'requestId',gen_random_uuid(),'actorId',v43,'expectedHeadId',v3f#>'{original,headId}','expectedRevision',1,'reviewOriginal',v3f->'original','reason',CASE WHEN v1e='return' THEN 'Synthetic explicit unmet evidence' ELSE '' END,'requiredChange',CASE WHEN v1e='return' THEN 'Synthetic concrete missing actual provenance' ELSE '' END,'rationale',CASE WHEN v1e='accept' THEN 'Synthetic proposal cannot establish actual clinical provenance' ELSE '' END);
  PERFORM pg_temp.cp365_nutrition_expect(f_t,'review',jsonb_build_object('p',f_bad),ARRAY['42501'],'Qualified clinical review decision enabled');
  END LOOP;
  PERFORM pg_temp.cp365_nutrition_expect(f_t,'review_confirm',jsonb_build_object('t',f_t,'c',f_c,'u',v43,'r',v40,'p',v3c),ARRAY['P0G03'],'Independent reader claimed own review receipt');
  PERFORM set_config('request.jwt.claims',vd::text,true);
  v1c:=pg_temp.cp365_nutrition_counts(f_t);
  BEGIN
   v2e:=jsonb_build_object('schemaVersion','1','action','request','requestId',gen_random_uuid(),'tenantId',f_t,'clientId',f_c,'actorId',f_u,'expectedHeadId',null,'expectedRevision',0,'careOriginal',v3a->'original','reviewOriginal',null,'reason','Synthetic technical inspection of the explicit open plan only','requiredChange','','rationale','');
   v2d:=public.web_commit_nutrition_review(v2e);
   IF v2d->'packet' IS DISTINCT FROM v2e OR v2d#>>'{original,status}' IS DISTINCT FROM 'requested' OR v2d#>'{original,careHeadId}' IS DISTINCT FROM v3a#>'{original,headId}' OR v2d#>'{original,history,0,qualification}' IS DISTINCT FROM 'null'::jsonb OR public.web_commit_nutrition_review(v2e) IS DISTINCT FROM v2d OR public.web_confirm_nutrition_review(f_t,f_c,f_u,(v2e->>'requestId')::uuid,v2e) IS DISTINCT FROM v2d THEN RAISE EXCEPTION 'Technical plan inspection lost full own original or invented clinical approval';END IF;
   PERFORM set_config('request.jwt.claims',v3b::text,true);
   FOREACH v1e IN ARRAY ARRAY['return','accept'] LOOP
    f_bad:=v2e||jsonb_build_object('action',v1e,'requestId',gen_random_uuid(),'actorId',v43,'expectedHeadId',v2d#>'{original,headId}','expectedRevision',1,'reviewOriginal',v2d->'original','reason',CASE WHEN v1e='return' THEN 'Synthetic technical planning issue' ELSE '' END,'requiredChange',CASE WHEN v1e='return' THEN 'Synthetic proposed planning clarification' ELSE '' END,'rationale',CASE WHEN v1e='accept' THEN 'Technical inspection cannot establish clinical execution' ELSE '' END);
  PERFORM pg_temp.cp365_nutrition_expect(f_t,'review',jsonb_build_object('p',f_bad),ARRAY['42501'],'Technical inspection enabled clinical decision');
  END LOOP;
  PERFORM pg_temp.cp365_nutrition_expect(f_t,'review_confirm',jsonb_build_object('t',f_t,'c',f_c,'u',v43,'r',(v2e->>'requestId')::uuid,'p',v2e),ARRAY['P0G03'],'Independent reader claimed planned own receipt');
   v2c:=true;RAISE EXCEPTION USING ERRCODE='Z0004';
  EXCEPTION WHEN SQLSTATE 'Z0004' THEN NULL;END;
  vf:=pg_temp.cp365_nutrition_counts(f_t);
  IF v2c IS NOT TRUE OR vf IS DISTINCT FROM v1c OR auth.uid() IS DISTINCT FROM f_u THEN RAISE EXCEPTION 'Technical inspection isolated rollback failed';END IF;
  v3d:=public.web_read_nutrition_review_page(f_t,f_c,f_u,null,null,1);
  v42:=public.web_read_nutrition_review_page(f_t,f_c,f_u,(v3d->>'nextCursorRecordedAt')::timestamptz,(v3d->>'nextCursorId')::uuid,1);
  v17:=public.web_read_nutrition_elimination_page(f_t,f_c,f_u,null,null,100);
  v31:=public.web_read_nutrition_elimination_prerequisites(f_t,f_c,f_u);
  IF v3d#>'{rows,0}' IS DISTINCT FROM v3f->'original' OR v42->'rows' IS DISTINCT FROM '[]'::jsonb OR jsonb_array_length(v17->'rows') IS DISTINCT FROM 3 OR v3d->'stateFingerprint' IS DISTINCT FROM v42->'stateFingerprint' OR v3d->'stateFingerprint' IS DISTINCT FROM v17->'stateFingerprint' OR v3d->'stateFingerprint' IS DISTINCT FROM v31->'stateFingerprint' THEN RAISE EXCEPTION 'Prerequisites/care/review complete current ledger proof differs';END IF;
  PERFORM pg_temp.cp365_nutrition_expect(f_t,'review_page',jsonb_build_object('t',f_t,'c',f_c,'u',f_u,'at',clock_timestamp(),'id',null,'n',1),ARRAY['22023'],'Partial review cursor accepted');
  PERFORM pg_temp.cp365_nutrition_expect(f_t,'review_page',jsonb_build_object('t',f_t,'c',f_c,'u',f_u,'at',clock_timestamp(),'id',gen_random_uuid(),'n',1),ARRAY['22023'],'Unretained review cursor accepted');
  v10:=pg_temp.cp365_nutrition_counts(f_t);
  BEGIN UPDATE public.nutrition_elimination_events SET reason='Changed original' WHERE request_id=v11;RAISE EXCEPTION 'Care original mutable';EXCEPTION WHEN check_violation THEN NULL;END;
  vf:=pg_temp.cp365_nutrition_counts(f_t);
  IF vf IS DISTINCT FROM v10 THEN RAISE EXCEPTION 'Rejected operation left a binding, root, event or receipt';END IF;
  v10:=pg_temp.cp365_nutrition_counts(f_t);
  BEGIN DELETE FROM public.nutrition_elimination_receipts WHERE request_id=v11;RAISE EXCEPTION 'Care receipt deletable';EXCEPTION WHEN check_violation THEN NULL;END;
  vf:=pg_temp.cp365_nutrition_counts(f_t);
  IF vf IS DISTINCT FROM v10 THEN RAISE EXCEPTION 'Rejected operation left a binding, root, event or receipt';END IF;
  v10:=pg_temp.cp365_nutrition_counts(f_t);
  BEGIN UPDATE public.nutrition_elimination_plan_bindings SET title='Changed binding' WHERE id=(vb#>>'{binding,id}')::uuid;RAISE EXCEPTION 'Binding mutable';EXCEPTION WHEN check_violation THEN NULL;END;
  vf:=pg_temp.cp365_nutrition_counts(f_t);
  IF vf IS DISTINCT FROM v10 THEN RAISE EXCEPTION 'Rejected operation left a binding, root, event or receipt';END IF;
  v10:=pg_temp.cp365_nutrition_counts(f_t);
  BEGIN DELETE FROM care_private.nutrition_binding_captures WHERE tenant_id=f_t AND request_id=vc;RAISE EXCEPTION 'Capture receipt deletable';EXCEPTION WHEN check_violation THEN NULL;END;
  vf:=pg_temp.cp365_nutrition_counts(f_t);
  IF vf IS DISTINCT FROM v10 THEN RAISE EXCEPTION 'Rejected operation left a binding, root, event or receipt';END IF;
  v10:=pg_temp.cp365_nutrition_counts(f_t);
  BEGIN UPDATE public.nutrition_review_events SET rationale='Changed original' WHERE request_id=v40;RAISE EXCEPTION 'Review original mutable';EXCEPTION WHEN check_violation THEN NULL;END;
  vf:=pg_temp.cp365_nutrition_counts(f_t);
  IF vf IS DISTINCT FROM v10 THEN RAISE EXCEPTION 'Rejected operation left a binding, root, event or receipt';END IF;
  v10:=pg_temp.cp365_nutrition_counts(f_t);
  BEGIN DELETE FROM public.nutrition_review_receipts WHERE request_id=v40;RAISE EXCEPTION 'Review receipt deletable';EXCEPTION WHEN check_violation THEN NULL;END;
  vf:=pg_temp.cp365_nutrition_counts(f_t);
  IF vf IS DISTINCT FROM v10 THEN RAISE EXCEPTION 'Rejected operation left a binding, root, event or receipt';END IF;
  v21:=public.web_read_nutrition_elimination_binding_context(f_t,f_c,f_u,v56,v20,v57,v2)->'nativeOriginals';
  IF v21 IS DISTINCT FROM v22 OR EXISTS(SELECT 1 FROM public.care_protocol_events WHERE tenant_id=f_t) OR EXISTS(SELECT 1 FROM public.vital_sign_measurements WHERE tenant_id=f_t) THEN RAISE EXCEPTION 'Prepared fixture changed native originals';END IF;
  v15:=public.web_read_nutrition_elimination_page(f_t,v23,f_u,null,null,100);
  IF v15->'rows' IS DISTINCT FROM '[]'::jsonb OR v15->'nextCursorId' IS DISTINCT FROM 'null'::jsonb OR v15->'nextCursorRecordedAt' IS DISTINCT FROM 'null'::jsonb OR (v15->>'stateFingerprint'~'^sha256:[a-f0-9]{64}$') IS NOT TRUE THEN RAISE EXCEPTION 'Empty scoped read lacks complete proof';END IF;
  IF EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname IN('public','care_private') AND p.proname LIKE '%nutrition%' AND (has_function_privilege('anon',p.oid,'EXECUTE') OR has_function_privilege('authenticated',p.oid,'EXECUTE') OR has_function_privilege('service_role',p.oid,'EXECUTE'))) THEN RAISE EXCEPTION 'Nutrition RPC execute quarantine widened';END IF;
  FOREACH v4b IN ARRAY ARRAY['nutrition_elimination_plan_bindings','nutrition_elimination_roots','nutrition_elimination_events','nutrition_elimination_receipts','nutrition_review_roots','nutrition_review_events','nutrition_review_receipts'] LOOP
   FOREACH v45 IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
    IF has_table_privilege(v45,'public.'||v4b,'SELECT,INSERT,UPDATE,DELETE') THEN RAISE EXCEPTION 'Nutrition original table privilege widened: % %',v45,v4b;END IF;
   END LOOP;
   IF NOT EXISTS(SELECT 1 FROM pg_class p JOIN pg_namespace n ON n.oid=p.relnamespace WHERE n.nspname='public' AND p.relname=v4b AND p.relrowsecurity) THEN RAISE EXCEPTION 'Nutrition RLS missing: %',v4b;END IF;
  END LOOP;
  FOREACH v4b IN ARRAY ARRAY['nutrition_binding_captures','nutrition_review_scopes'] LOOP
   FOREACH v45 IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP IF has_table_privilege(v45,'care_private.'||v4b,'SELECT,INSERT,UPDATE,DELETE') THEN RAISE EXCEPTION 'Private Nutrition capture/scope privilege widened';END IF;END LOOP;
  END LOOP;
  v2a:=true;RAISE EXCEPTION USING ERRCODE='Z0001';
 EXCEPTION WHEN SQLSTATE 'Z0001' THEN NULL;END;
 IF v2a IS NOT TRUE OR
  EXISTS(SELECT 1 FROM auth.users WHERE id IN(f_u,v43,v37)) OR
  EXISTS(SELECT 1 FROM auth.sessions WHERE id IN(f_s,v41,v38)) OR
  EXISTS(SELECT 1 FROM public.roles WHERE id IN(f_r,v3e)) OR
  EXISTS(SELECT 1 FROM public.employee_employment_details WHERE employee_id=v14) OR
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
  EXISTS(SELECT 1 FROM care_private.nutrition_review_scopes WHERE tenant_id=f_t) OR EXISTS(SELECT 1 FROM public.profiles WHERE id IN(f_u,v43,v37)) OR EXISTS(SELECT 1 FROM public.role_permissions WHERE role_id IN(f_r,v3e)) THEN RAISE EXCEPTION 'Nutrition full inner rollback cleanup failed';END IF;
 PERFORM set_config('cp365.nutrition_workspace_test_evidence',jsonb_build_object('schemaVersion',1,'fixtureKind','review','cleanupConfirmed',true,'expected',jsonb_build_object('tenantId',f_t,'clientId',f_c,'actorId',f_u,'reviewerId',v43),'context',ve,'otherCaptureContext',v7,'capturePacket',va,'captureReceipt',vb,'otherCapturePacket',v8,'otherCaptureReceipt',v9,'prerequisites',v31,'carePacket',v29,'careReceipt',v35,'revisionPacket',v39,'revisionReceipt',v3a,'otherCarePacket',v26,'otherCareReceipt',v27,'historicalOriginal',v19,'reviewPacket',v3c,'reviewReceipt',v3f,'plannedReviewPacket',v2e,'plannedReviewReceipt',v2d,'plannedInspectionPassed',v2c,'reviewPage',v3d,'reviewTail',v42,'canonicalIdsBlocked',v6,'finalCarePage',v17,'emptyPage',v15,'clinicalDecisionsBlocked',true)::text,true);
END $test$;
SELECT current_setting('cp365.nutrition_workspace_test_evidence',true)::jsonb AS evidence;
ROLLBACK;
