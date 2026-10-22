-- NEW independent Nutrition authority rollback fixture; synthetic claims, no HTTP/clinical release.
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
 f_read_only_confirmed boolean:=false;
 f_t uuid:=('a'||substr(gen_random_uuid()::text,2))::uuid;f_u uuid:=('a'||substr(gen_random_uuid()::text,2))::uuid;f_s uuid:=gen_random_uuid();f_r uuid:=gen_random_uuid();
 v3d uuid:=gen_random_uuid();v3b uuid:=gen_random_uuid();v38 uuid:=gen_random_uuid();v31 uuid:=gen_random_uuid();v32 uuid:=gen_random_uuid();
 f_c uuid:=('a'||substr(gen_random_uuid()::text,2))::uuid;v1d uuid:=gen_random_uuid();v25 uuid:=gen_random_uuid();v4f uuid:=('a'||substr(gen_random_uuid()::text,2))::uuid;
 v1a uuid:=('a'||substr(gen_random_uuid()::text,2))::uuid;v48 uuid:=gen_random_uuid();v50 uuid:=('a'||substr(gen_random_uuid()::text,2))::uuid;v22 uuid:=gen_random_uuid();
 v2 uuid:=('a'||substr(gen_random_uuid()::text,2))::uuid;v47 uuid:=gen_random_uuid();v3 uuid:=gen_random_uuid();v46 uuid:=gen_random_uuid();
 
 v17 uuid:=gen_random_uuid();v16 uuid:=gen_random_uuid();v10 uuid:=gen_random_uuid();
 vb uuid:=gen_random_uuid();v1e uuid:=gen_random_uuid();ve uuid:=gen_random_uuid();v3e uuid:=gen_random_uuid();v1f uuid:=gen_random_uuid();v3a uuid:=gen_random_uuid();
 f_day date:=(clock_timestamp() AT TIME ZONE 'Europe/Berlin')::date-1;v29 timestamptz;v0 timestamptz;v2a text;v1 text;
 vc jsonb;v35 jsonb;v2f jsonb;v41 jsonb;v1c jsonb;v1b jsonb;
 vd jsonb;v6 jsonb;v9 jsonb;va jsonb;v7 jsonb;v8 jsonb;
 v42 jsonb;v2b jsonb;v12 jsonb;v23 jsonb;v2e jsonb;v33 jsonb;v34 jsonb;v20 jsonb;v21 jsonb;
 v51 boolean;
 v14 jsonb;v15 jsonb;v36 jsonb;v39 jsonb;
 v4a text:=repeat(chr(128167),250);
 fx_page1 jsonb;fx_page2 jsonb;v37 jsonb;v13 jsonb;v11 jsonb;
 v4e jsonb;f_key text;v3f text;v44 text;
 v24 boolean:=false;v30 boolean:=false;
BEGIN
 BEGIN
  v51:=EXISTS(SELECT 1 FROM public.vital_sign_catalog WHERE key='weight');
  INSERT INTO public.tenants(id,name) VALUES(f_t,'CP365 synthetic Nutrition rollback fixture');
  INSERT INTO public.roles(id,key,name) VALUES(f_r,'cp365_nutrition_'||f_r,'Synthetic Nutrition author'),(v38,'cp365_nutrition_review_'||v38,'Synthetic independent Nutrition reader');
  INSERT INTO public.role_permissions(role_id,permission_key)
   SELECT own.role_id,p.permission_key FROM unnest(ARRAY[f_r,v38]) own(role_id)
   CROSS JOIN unnest(ARRAY['pflege.plans.view','pflege.plans.manage','pflege.documentation.view','pflege.documentation.create','pflege.documentation.sign','pflege.vitals.view']) p(permission_key);
  INSERT INTO auth.users(id,email,raw_user_meta_data,raw_app_meta_data) VALUES(f_u,f_u||'@example.invalid','{}','{}'),(v3d,v3d||'@example.invalid','{}','{}');
  UPDATE public.profiles SET tenant_id=f_t,role_id=f_r,role_key='pfleger',is_active=true,status='active',display_name='Synthetic Nutrition Author' WHERE id=f_u;
  UPDATE public.profiles SET tenant_id=f_t,role_id=v38,role_key='pfleger',is_active=true,status='active',display_name='Synthetic independent Nutrition reader' WHERE id=v3d;
  INSERT INTO auth.sessions(id,user_id,not_after) VALUES(f_s,f_u,clock_timestamp()+interval '2 hours'),(v3b,v3d,clock_timestamp()+interval '2 hours');
  INSERT INTO public.clients(id,tenant_id,first_name,last_name,status,lifecycle_status) VALUES(f_c,f_t,'Synthetic','Nutrition case','aktiv','aktiv'),(v1d,f_t,'Synthetic','Other Nutrition case','aktiv','aktiv');
  INSERT INTO public.client_module_assignments(tenant_id,client_id,module_key,status,is_active) VALUES(f_t,f_c,'pflege','active',true),(f_t,v1d,'pflege','active',true);
  vc:=jsonb_build_object('sub',f_u,'role','authenticated','session_id',f_s,'exp',extract(epoch FROM clock_timestamp()+interval '1 hour')::bigint);
  v35:=jsonb_build_object('sub',v3d,'role','authenticated','session_id',v3b,'exp',extract(epoch FROM clock_timestamp()+interval '1 hour')::bigint);
  PERFORM set_config('request.jwt.claims',vc::text,true);
  -- Exact ECMAScript trim and UTF-16 length, preserving accepted bytes.
  IF care_private.nutrition_text(to_jsonb(chr(160)||chr(65279)),1,300) IS NOT FALSE
   OR care_private.nutrition_text(to_jsonb(chr(133)),1,1) IS NOT TRUE
   OR care_private.nutrition_text(to_jsonb(repeat(chr(128167),2)),4,4) IS NOT TRUE
   OR care_private.nutrition_text(to_jsonb(repeat(chr(128167),2)),0,3) IS NOT FALSE
   OR care_private.nutrition_text(to_jsonb(repeat(chr(128167),150)),3,300) IS NOT TRUE
   OR care_private.nutrition_text(to_jsonb(repeat(chr(128167),151)),3,300) IS NOT FALSE
   OR care_private.nutrition_text(to_jsonb(v4a),1,500) IS NOT TRUE
   OR care_private.nutrition_text(to_jsonb(repeat(chr(128167),251)),1,500) IS NOT FALSE THEN RAISE EXCEPTION 'ECMAScript whitespace/UTF-16 contract differs';END IF;
  INSERT INTO public.care_plans(id,tenant_id,client_id,title,status,valid_from,valid_until) VALUES(v25,f_t,f_c,'Synthetic explicit Nutrition plan','aktiv',f_day-10,f_day+30);
  INSERT INTO public.care_plan_items(id,tenant_id,care_plan_id,category,title,intervention,status,sort_order,created_by,updated_by)
   VALUES(v1a,f_t,v25,'drink_protocol','Synthetic explicitly planned drink support','Synthetic authored planning only; no actual drink asserted','active',1,f_u,f_u);
  SELECT jsonb_build_object('plan',to_jsonb(p),'items',(SELECT jsonb_agg(to_jsonb(i) ORDER BY i.id) FROM public.care_plan_items i WHERE i.tenant_id=f_t AND i.care_plan_id=v25)) INTO v41 FROM public.care_plans p WHERE p.id=v25;
  INSERT INTO public.care_plan_versions(id,tenant_id,care_plan_id,version,snapshot,reason,actor_id,actor_name) VALUES(v4f,f_t,v25,1,v41,'Synthetic explicit native plan version',f_u,'Synthetic Nutrition Author');
  INSERT INTO public.care_tours(id,tenant_id,tour_date,name,status,created_by,updated_by) VALUES(v48,f_t,f_day,'Synthetic published Nutrition tour','published',f_u,f_u);
  INSERT INTO public.care_tour_stops(id,tenant_id,tour_id,sequence_no,client_id,client_name_snapshot,planned_start,planned_end,status)
   VALUES(v50,f_t,v48,1,f_c,'Synthetic Nutrition case','12:15:30.123456','12:45:30.123456','planned'),(v22,f_t,v48,2,f_c,'Synthetic Nutrition case','13:15:30.654321','13:45:30.654321','planned');
  INSERT INTO public.care_assessments(id,tenant_id,subject_type,subject_id,subject_name_snapshot,variant,status,version,assessor_profile_id,assessor_name_snapshot,created_by,updated_by)
   VALUES(v2,f_t,'client',f_c,'Synthetic Nutrition case','ambulant','draft',1,f_u,'Synthetic Nutrition Author',f_u,f_u);
  INSERT INTO public.care_assessment_topics(id,tenant_id,assessment_id,topic_key,professional_assessment) VALUES(v47,f_t,v2,'self_care','Synthetic explicit draft assessment; no clinical conclusion');
  INSERT INTO public.care_assessment_measures(id,tenant_id,assessment_id,title,personal_goal,intervention,timing,frequency,responsible_role,evaluation_criteria,status)
   VALUES(v3,f_t,v2,'Synthetic draft Nutrition measure','Synthetic goal','Synthetic planned support','Synthetic explicit noon visit','Synthetic individual frequency','Synthetic role','Synthetic review criteria','planned');
  v29:=(f_day+time '12:15:30.123456') AT TIME ZONE 'Europe/Berlin';v0:=v29+interval '1 minute 0.111111 second';
  v2a:=to_char(v29 AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"');v1:=to_char(v0 AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"');
  INSERT INTO public.care_operations_tasks(id,tenant_id,client_id,title,description,due_on,status,created_by) VALUES(v46,f_t,f_c,'Synthetic date-only follow-up','Date is not an actual instant',f_day,'open',f_u);
  vd:=public.web_read_nutrition_elimination_binding_context(f_t,f_c,f_u,v4f,v1a,v50,v2);
  SELECT jsonb_build_object('plan',(SELECT to_jsonb(x) FROM public.care_plans x WHERE x.id=v25),'planVersion',(SELECT to_jsonb(x) FROM public.care_plan_versions x WHERE x.id=v4f),'measure',(SELECT to_jsonb(x) FROM public.care_plan_items x WHERE x.id=v1a),'visit',(SELECT to_jsonb(x) FROM public.care_tour_stops x WHERE x.id=v50),'tour',(SELECT to_jsonb(x) FROM public.care_tours x WHERE x.id=v48),'assessment',(SELECT to_jsonb(x) FROM public.care_assessments x WHERE x.id=v2),
   'assessmentTopics',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.id),'[]'::jsonb) FROM public.care_assessment_topics x WHERE x.tenant_id=f_t AND x.assessment_id=v2),'assessmentRisks',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.id),'[]'::jsonb) FROM public.care_assessment_risks x WHERE x.tenant_id=f_t AND x.assessment_id=v2),'assessmentMeasures',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.id),'[]'::jsonb) FROM public.care_assessment_measures x WHERE x.tenant_id=f_t AND x.assessment_id=v2),'instrumentSelection',null,'model',null,'instruments','[]'::jsonb) INTO v1c;
  IF vd->'nativeOriginals' IS DISTINCT FROM v1c OR (vd->>'planSnapshotSha256'~'^sha256:[a-f0-9]{64}$') IS NOT TRUE THEN RAISE EXCEPTION 'Full native context differs from independently selected originals';END IF;
  IF vd#>'{nativeOriginals,instrumentSelection}' IS DISTINCT FROM 'null'::jsonb OR vd#>'{nativeOriginals,model}' IS DISTINCT FROM 'null'::jsonb OR vd#>'{nativeOriginals,instruments}' IS DISTINCT FROM '[]'::jsonb OR vd#>'{sources,devices}' IS DISTINCT FROM '[]'::jsonb OR jsonb_array_length(vd#>'{sources,tasks}') IS DISTINCT FROM 1 OR vd#>'{sources,tasks,0,dueAt}' IS DISTINCT FROM 'null'::jsonb THEN RAISE EXCEPTION 'Unknown instruments/devices/date-only deadline were inferred';END IF;
  v9:=jsonb_build_object('schemaVersion','1','requestId',vb,'tenantId',f_t,'clientId',f_c,'actorId',f_u,'planVersionId',v4f,'measureId',v1a,'visitId',v50,'assessmentId',v2,'kind','drink_protocol','title','Synthetic explicitly planned drink support','plannedAt',v2a,'nativeOriginals',vd->'nativeOriginals','sources',vd->'sources');
  va:=public.web_capture_nutrition_elimination_plan_binding(v9);
  IF va->'packet' IS DISTINCT FROM v9 OR va->>'requestId' IS DISTINCT FROM vb::text OR va#>'{binding,nativeOriginals}' IS DISTINCT FROM v1c OR va#>'{binding,sources}' IS DISTINCT FROM vd->'sources' OR va#>'{binding,planSnapshotSha256}' IS DISTINCT FROM vd->'planSnapshotSha256' OR va#>>'{binding,capturedBy}' IS DISTINCT FROM f_u::text OR (va#>>'{binding,plannedAt}')::timestamptz IS DISTINCT FROM v29 THEN RAISE EXCEPTION 'Capture own original lost native scope/hash/time';END IF;
  FOREACH f_key IN ARRAY ARRAY['tenantId','clientId','planVersionId','measureId','visitId','assessmentId','kind','title'] LOOP IF va#>ARRAY['binding',f_key] IS DISTINCT FROM v9->f_key THEN RAISE EXCEPTION 'Capture receipt identity changed: %',f_key;END IF;END LOOP;
  IF public.web_capture_nutrition_elimination_plan_binding(v9) IS DISTINCT FROM va OR public.web_confirm_nutrition_elimination_plan_binding(f_t,f_c,f_u,vb,v9) IS DISTINCT FROM va THEN RAISE EXCEPTION 'Exact capture replay/confirm changed';END IF;
  PERFORM pg_temp.cp365_nutrition_expect(f_t,'capture',jsonb_build_object('p',v9||jsonb_build_object('title','Changed same request')),ARRAY['40001'],'Capture changed same request accepted');
  PERFORM pg_temp.cp365_nutrition_expect(f_t,'capture_confirm',jsonb_build_object('t',f_t,'c',f_c,'u',f_u,'r',vb,'p',v9||jsonb_build_object('title','Changed confirm')),ARRAY['P0G02'],'Changed capture confirmation accepted');
  v6:=public.web_read_nutrition_elimination_binding_context(f_t,f_c,f_u,v4f,v1a,v22,v2);
  v7:=v9||jsonb_build_object('requestId',v1e,'visitId',v22,'plannedAt',to_char(((f_day+time '13:15:30.654321') AT TIME ZONE 'Europe/Berlin') AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),'nativeOriginals',v6->'nativeOriginals','sources',v6->'sources');
  v8:=public.web_capture_nutrition_elimination_plan_binding(v7);
  IF v8#>'{binding,planSnapshotSha256}' IS DISTINCT FROM v6->'planSnapshotSha256' OR v8#>'{binding,nativeOriginals}' IS DISTINCT FROM v6->'nativeOriginals' OR public.web_confirm_nutrition_elimination_plan_binding(f_t,f_c,f_u,v1e,v7) IS DISTINCT FROM v8 THEN RAISE EXCEPTION 'Second capture detached from independent original context';END IF;
  v2b:=public.web_read_nutrition_elimination_prerequisites(f_t,f_c,f_u);
  IF jsonb_array_length(v2b->'plans') IS DISTINCT FROM 2 OR (v2b->>'stateFingerprint'~'^sha256:[a-f0-9]{64}$') IS NOT TRUE THEN RAISE EXCEPTION 'Captured prerequisites/proof unavailable or legacy fake binding exposed';END IF;
  v42:=vd->'sources';
  v12:=jsonb_build_object('kind','drink_protocol','title',v9->'title','plannedAt',va#>'{binding,plannedAt}','occurredAt',null,'planVersionId',v4f,'measureId',v1a,'visitId',v50,'assessmentId',v2,'planSnapshotSha256',va#>'{binding,planSnapshotSha256}',
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
  v23:=jsonb_build_object('schemaVersion','1','action','create','requestId',ve,'tenantId',f_t,'clientId',f_c,'actorId',f_u,'expectedHeadId',null,'expectedRevision',0,'entry',v12,'reason','','original',null,'sources',v42);
  v2e:=public.web_commit_nutrition_elimination_packet(v23);
  IF v2e->'packet' IS DISTINCT FROM v23 OR v2e#>'{original,payload}' IS DISTINCT FROM v12 OR v2e#>>'{original,revision}' IS DISTINCT FROM '1' OR v2e#>>'{original,recordedBy}' IS DISTINCT FROM f_u::text OR v2e#>>'{original,tenantId}' IS DISTINCT FROM f_t::text OR v2e#>>'{original,clientId}' IS DISTINCT FROM f_c::text OR v2e#>'{original,rootId}' IS DISTINCT FROM v2e#>'{original,history,0,id}' OR v2e#>'{original,payload,occurredAt}' IS DISTINCT FROM 'null'::jsonb OR v2e#>'{original,payload,intake,actual}' IS DISTINCT FROM 'null'::jsonb THEN RAISE EXCEPTION 'Planned own receipt invented facts or lost its own root';END IF;
  IF public.web_commit_nutrition_elimination_packet(v23) IS DISTINCT FROM v2e OR public.web_confirm_nutrition_elimination_packet(f_t,f_c,f_u,ve,v23) IS DISTINCT FROM v2e THEN RAISE EXCEPTION 'Exact care replay/confirmation differs';END IF;
  PERFORM pg_temp.cp365_nutrition_expect(f_t,'care',jsonb_build_object('p',jsonb_set(v23,'{entry,title}','"Changed same request"')),ARRAY['40001'],'Same care request changed facts');
  PERFORM pg_temp.cp365_nutrition_expect(f_t,'care_confirm',jsonb_build_object('t',f_t,'c',f_c,'u',f_u,'r',gen_random_uuid(),'p',v23),ARRAY['P0G02'],'Missing care confirmation became success');
  v33:=v23||jsonb_build_object('action','revise','requestId',v3e,'expectedHeadId',v2e#>'{original,headId}','expectedRevision',1,'original',v2e->'original','reason','Synthetic explicitly revised planning for technical inspection','entry',jsonb_set(v12,'{assistance,details}','"Synthetic explicitly authored planning clarification"'));
  v34:=public.web_commit_nutrition_elimination_packet(v33);
  IF v34#>>'{original,revision}' IS DISTINCT FROM '2' OR v34#>'{original,history,0}' IS DISTINCT FROM v2e#>'{original,history,0}' THEN RAISE EXCEPTION 'Review fixture current planning history detached';END IF;
  v20:=v23||jsonb_build_object('requestId',v1f,'sources',v6->'sources','entry',v12||jsonb_build_object('visitId',v22,'plannedAt',v8#>'{binding,plannedAt}','planSnapshotSha256',v8#>'{binding,planSnapshotSha256}'));
  v21:=public.web_commit_nutrition_elimination_packet(v20);
  fx_page1:=public.web_read_nutrition_elimination_page(f_t,f_c,f_u,null,null,1);
  -- Privileged historical synthetic actual is readable; this does not enable new G actual writes.
  v14:=v12||jsonb_build_object('occurredAt',v1,'decision',jsonb_build_object('state','consented','recordedAt',v1,'reason','','consultation','Synthetic historical consent field only'),'intake',jsonb_build_object('offered','0.300','actual','0.100','unit','ml','item','Synthetic historical water','dietForm','','target',null,'targetUnit','none'),'execution',jsonb_build_object('outcome','performed','performedBy',jsonb_build_array(f_u),'result','Synthetic historical result; provenance remains unverified','deviation',''),'lifecycle','completed');
  INSERT INTO public.nutrition_elimination_roots(id,tenant_id,client_id,kind,plan_binding_id,created_at) VALUES(v17,f_t,f_c,'drink_protocol',(va#>>'{binding,id}')::uuid,v0);
  INSERT INTO public.nutrition_elimination_events(id,tenant_id,client_id,root_id,revision,previous_id,request_id,actor_id,actor_name,recorded_at,reason,payload,content_fingerprint,packet)
   VALUES(v17,f_t,f_c,v17,1,null,v16,f_u,'Synthetic historical Nutrition author',v0,'',v14,'sha256:'||encode(extensions.digest(convert_to(v14::text,'UTF8'),'sha256'),'hex'),'{}');
  v15:=care_private.nutrition_elimination_original(v17);
  IF v15#>>'{payload,intake,actual}' IS DISTINCT FROM '0.100' OR v15#>>'{payload,occurredAt}' IS DISTINCT FROM v1 OR v15#>>'{history,0,id}' IS DISTINCT FROM v17::text THEN RAISE EXCEPTION 'Historical exact actual decimal/time/root changed';END IF;
  v4e:=public.web_read_nutrition_elimination_page(f_t,f_c,f_u,null,null,1);
  IF v4e#>'{rows,0}' IS DISTINCT FROM fx_page1#>'{rows,0}' OR v4e->'stateFingerprint' IS NOT DISTINCT FROM fx_page1->'stateFingerprint' THEN RAISE EXCEPTION 'Older off-page insertion escaped ledger proof';END IF;
  v36:=jsonb_build_object('schemaVersion','1','action','request','requestId',v3a,'tenantId',f_t,'clientId',f_c,'actorId',f_u,'expectedHeadId',null,'expectedRevision',0,'careOriginal',v15,'reviewOriginal',null,'reason','Synthetic explicit historical evidence review request','requiredChange','','rationale','');
  v39:=public.web_commit_nutrition_review(v36);
  IF v39->'packet' IS DISTINCT FROM v36 OR v39#>>'{original,status}' IS DISTINCT FROM 'requested' OR v39#>'{original,rootId}' IS DISTINCT FROM v39#>'{original,history,0,id}' OR v39#>'{original,history,0,qualification}' IS DISTINCT FROM 'null'::jsonb OR public.web_commit_nutrition_review(v36) IS DISTINCT FROM v39 OR public.web_confirm_nutrition_review(f_t,f_c,f_u,v3a,v36) IS DISTINCT FROM v39 THEN RAISE EXCEPTION 'Own historical review request lost original/root or invented a decision';END IF;
  PERFORM pg_temp.cp365_nutrition_expect(f_t,'review',jsonb_build_object('p',v36||jsonb_build_object('reason','Changed same review request')),ARRAY['40001'],'Changed same review request accepted');
  PERFORM pg_temp.cp365_nutrition_expect(f_t,'review',jsonb_build_object('p',jsonb_set(v36||jsonb_build_object('requestId',gen_random_uuid()),'{careOriginal,payload,intake,actual}','"0.200"')),ARRAY['40001'],'Review substituted historical actual');
  -- Historical own confirmation requires current source read authority, not new-write rights.
  BEGIN
   DELETE FROM public.role_permissions WHERE role_id=f_r AND permission_key IN('pflege.documentation.create','pflege.plans.manage');
   IF public.web_confirm_nutrition_elimination_plan_binding(f_t,f_c,f_u,vb,v9) IS DISTINCT FROM va OR public.web_confirm_nutrition_elimination_packet(f_t,f_c,f_u,ve,v23) IS DISTINCT FROM v2e OR public.web_confirm_nutrition_review(f_t,f_c,f_u,v3a,v36) IS DISTINCT FROM v39 THEN RAISE EXCEPTION 'Current read-only authority lost exact own historical confirmation';END IF;
   f_read_only_confirmed:=true;RAISE EXCEPTION USING ERRCODE='Z0007';
  EXCEPTION WHEN SQLSTATE 'Z0007' THEN NULL;END;
  IF f_read_only_confirmed IS NOT TRUE THEN RAISE EXCEPTION 'Read-only historical confirmations not proved';END IF;
  -- Real raw-account relink, preserving current internal profile and session authority.
  -- A second account is not permitted to inherit old own-request confirmations.
  BEGIN
   INSERT INTO auth.users(id,email,raw_user_meta_data,raw_app_meta_data) VALUES(v31,v31||'@example.invalid','{}','{}');
   DELETE FROM public.profiles WHERE id=v31;
   INSERT INTO auth.sessions(id,user_id,not_after) VALUES(v32,v31,clock_timestamp()+interval '1 hour');
   UPDATE public.profiles SET auth_user_id=v31 WHERE id=f_u;
   v2f:=jsonb_build_object('sub',v31,'role','authenticated','session_id',v32,'exp',extract(epoch FROM clock_timestamp()+interval '1 hour')::bigint);
   PERFORM set_config('request.jwt.claims',v2f::text,true);
   IF auth.uid() IS DISTINCT FROM v31 OR public.resolve_current_profile_id() IS DISTINCT FROM f_u OR public.current_tenant_id() IS DISTINCT FROM f_t THEN RAISE EXCEPTION 'Relink did not retain exact internal current owner';END IF;
   PERFORM care_private.nutrition_elimination_actor(f_t,f_c,f_u,true);
  PERFORM pg_temp.cp365_nutrition_expect(f_t,'capture',jsonb_build_object('p',v9),ARRAY['42501'],'Relink inherited capture replay');
  PERFORM pg_temp.cp365_nutrition_expect(f_t,'care',jsonb_build_object('p',v23),ARRAY['42501'],'Relink inherited care replay');
  PERFORM pg_temp.cp365_nutrition_expect(f_t,'review',jsonb_build_object('p',v36),ARRAY['42501'],'Relink inherited review replay');
  PERFORM pg_temp.cp365_nutrition_expect(f_t,'capture_confirm',jsonb_build_object('t',f_t,'c',f_c,'u',f_u,'r',vb,'p',v9),ARRAY['P0G02'],'Relink inherited capture confirm');
  PERFORM pg_temp.cp365_nutrition_expect(f_t,'care_confirm',jsonb_build_object('t',f_t,'c',f_c,'u',f_u,'r',ve,'p',v23),ARRAY['P0G02'],'Relink inherited care confirm');
  PERFORM pg_temp.cp365_nutrition_expect(f_t,'review_confirm',jsonb_build_object('t',f_t,'c',f_c,'u',f_u,'r',v3a,'p',v36),ARRAY['P0G03'],'Relink inherited review confirm');
   v30:=true;RAISE EXCEPTION USING ERRCODE='Z0002';
  EXCEPTION WHEN SQLSTATE 'Z0002' THEN NULL;END;
  IF v30 IS NOT TRUE OR auth.uid() IS DISTINCT FROM f_u OR public.resolve_current_profile_id() IS DISTINCT FROM f_u OR EXISTS(SELECT 1 FROM auth.users WHERE id=v31) OR EXISTS(SELECT 1 FROM auth.sessions WHERE id=v32) THEN RAISE EXCEPTION 'Raw account relink isolated rollback failed';END IF;
  BEGIN DELETE FROM public.role_permissions WHERE role_id=f_r AND permission_key='pflege.plans.view';PERFORM pg_temp.cp365_nutrition_expect(f_t,'prerequisites',jsonb_build_object('t',f_t,'c',f_c,'u',f_u),ARRAY['42501'],'Missing own pflege.plans.view accepted');RAISE EXCEPTION USING ERRCODE='Z0006';EXCEPTION WHEN SQLSTATE 'Z0006' THEN NULL;END;
  BEGIN DELETE FROM public.role_permissions WHERE role_id=f_r AND permission_key='pflege.documentation.view';PERFORM pg_temp.cp365_nutrition_expect(f_t,'prerequisites',jsonb_build_object('t',f_t,'c',f_c,'u',f_u),ARRAY['42501'],'Missing own pflege.documentation.view accepted');RAISE EXCEPTION USING ERRCODE='Z0006';EXCEPTION WHEN SQLSTATE 'Z0006' THEN NULL;END;
  BEGIN DELETE FROM public.role_permissions WHERE role_id=f_r AND permission_key='pflege.vitals.view';PERFORM pg_temp.cp365_nutrition_expect(f_t,'prerequisites',jsonb_build_object('t',f_t,'c',f_c,'u',f_u),ARRAY['42501'],'Missing own pflege.vitals.view accepted');RAISE EXCEPTION USING ERRCODE='Z0006';EXCEPTION WHEN SQLSTATE 'Z0006' THEN NULL;END;
  BEGIN DELETE FROM public.role_permissions WHERE role_id=f_r AND permission_key='pflege.documentation.create';PERFORM pg_temp.cp365_nutrition_expect(f_t,'care',jsonb_build_object('p',v23),ARRAY['42501'],'Read-only replay borrowed create right');RAISE EXCEPTION USING ERRCODE='Z0006';EXCEPTION WHEN SQLSTATE 'Z0006' THEN NULL;END;
  BEGIN DELETE FROM public.role_permissions WHERE role_id=f_r AND permission_key='pflege.plans.manage';PERFORM pg_temp.cp365_nutrition_expect(f_t,'capture',jsonb_build_object('p',v9),ARRAY['42501'],'Capture replay borrowed manage right');RAISE EXCEPTION USING ERRCODE='Z0006';EXCEPTION WHEN SQLSTATE 'Z0006' THEN NULL;END;
  BEGIN INSERT INTO public.role_permission_sets(tenant_id,role_key,permission_key) VALUES(f_t,'cp365_nutrition_'||f_r,'pflege.documentation.view');PERFORM pg_temp.cp365_nutrition_expect(f_t,'prerequisites',jsonb_build_object('t',f_t,'c',f_c,'u',f_u),ARRAY['42501'],'Own role override borrowed global source rights');RAISE EXCEPTION USING ERRCODE='Z0006';EXCEPTION WHEN SQLSTATE 'Z0006' THEN NULL;END;
  BEGIN UPDATE auth.sessions SET not_after=clock_timestamp()-interval '1 minute' WHERE id=f_s;PERFORM pg_temp.cp365_nutrition_expect(f_t,'prerequisites',jsonb_build_object('t',f_t,'c',f_c,'u',f_u),ARRAY['42501'],'Expired real session accepted');RAISE EXCEPTION USING ERRCODE='Z0006';EXCEPTION WHEN SQLSTATE 'Z0006' THEN NULL;END;
  BEGIN PERFORM set_config('request.jwt.claims',(vc||jsonb_build_object('exp',extract(epoch FROM clock_timestamp()-interval '1 minute')::bigint))::text,true);PERFORM pg_temp.cp365_nutrition_expect(f_t,'prerequisites',jsonb_build_object('t',f_t,'c',f_c,'u',f_u),ARRAY['42501'],'Expired token accepted');RAISE EXCEPTION USING ERRCODE='Z0006';EXCEPTION WHEN SQLSTATE 'Z0006' THEN NULL;END;
  BEGIN UPDATE public.profiles SET is_active=false WHERE id=f_u;PERFORM pg_temp.cp365_nutrition_expect(f_t,'prerequisites',jsonb_build_object('t',f_t,'c',f_c,'u',f_u),ARRAY['42501'],'Inactive own profile accepted');RAISE EXCEPTION USING ERRCODE='Z0006';EXCEPTION WHEN SQLSTATE 'Z0006' THEN NULL;END;
  BEGIN UPDATE public.clients SET lifecycle_status='archiviert' WHERE id=f_c;PERFORM pg_temp.cp365_nutrition_expect(f_t,'prerequisites',jsonb_build_object('t',f_t,'c',f_c,'u',f_u),ARRAY['42501'],'Archived client accepted');RAISE EXCEPTION USING ERRCODE='Z0006';EXCEPTION WHEN SQLSTATE 'Z0006' THEN NULL;END;
  BEGIN UPDATE public.client_module_assignments SET is_active=false WHERE tenant_id=f_t AND client_id=f_c AND module_key='pflege';PERFORM pg_temp.cp365_nutrition_expect(f_t,'prerequisites',jsonb_build_object('t',f_t,'c',f_c,'u',f_u),ARRAY['42501'],'Inactive Pflege module accepted');RAISE EXCEPTION USING ERRCODE='Z0006';EXCEPTION WHEN SQLSTATE 'Z0006' THEN NULL;END;
  PERFORM pg_temp.cp365_nutrition_expect(f_t,'context',jsonb_build_object('t',f_t,'c',v1d,'u',f_u,'v',v4f,'m',v1a,'s',v50,'a',v2),ARRAY['42501'],'Cross-client native context accepted');
  PERFORM pg_temp.cp365_nutrition_expect(f_t,'prerequisites',jsonb_build_object('t',gen_random_uuid(),'c',f_c,'u',f_u),ARRAY['42501'],'Foreign tenant accepted');
  PERFORM pg_temp.cp365_nutrition_expect(f_t,'prerequisites',jsonb_build_object('t',f_t,'c',f_c,'u',v3d),ARRAY['42501'],'Foreign actor parameter accepted');
  v1b:=public.web_read_nutrition_elimination_binding_context(f_t,f_c,f_u,v4f,v1a,v50,v2)->'nativeOriginals';
  IF v1b IS DISTINCT FROM v1c OR EXISTS(SELECT 1 FROM public.care_protocol_events WHERE tenant_id=f_t) OR EXISTS(SELECT 1 FROM public.vital_sign_measurements WHERE tenant_id=f_t) THEN RAISE EXCEPTION 'Prepared fixture changed native originals';END IF;
  v13:=public.web_read_nutrition_elimination_page(f_t,f_c,f_u,null,null,100);
  v2b:=public.web_read_nutrition_elimination_prerequisites(f_t,f_c,f_u);
  v37:=public.web_read_nutrition_review_page(f_t,f_c,f_u,null,null,100);
  v11:=public.web_read_nutrition_elimination_page(f_t,v1d,f_u,null,null,100);
  IF v11->'rows' IS DISTINCT FROM '[]'::jsonb OR v11->'nextCursorId' IS DISTINCT FROM 'null'::jsonb OR v11->'nextCursorRecordedAt' IS DISTINCT FROM 'null'::jsonb OR (v11->>'stateFingerprint'~'^sha256:[a-f0-9]{64}$') IS NOT TRUE THEN RAISE EXCEPTION 'Empty scoped read lacks complete proof';END IF;
  IF EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname IN('public','care_private') AND p.proname LIKE '%nutrition%' AND (has_function_privilege('anon',p.oid,'EXECUTE') OR has_function_privilege('authenticated',p.oid,'EXECUTE') OR has_function_privilege('service_role',p.oid,'EXECUTE'))) THEN RAISE EXCEPTION 'Nutrition RPC execute quarantine widened';END IF;
  FOREACH v44 IN ARRAY ARRAY['nutrition_elimination_plan_bindings','nutrition_elimination_roots','nutrition_elimination_events','nutrition_elimination_receipts','nutrition_review_roots','nutrition_review_events','nutrition_review_receipts'] LOOP
   FOREACH v3f IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
    IF has_table_privilege(v3f,'public.'||v44,'SELECT,INSERT,UPDATE,DELETE') THEN RAISE EXCEPTION 'Nutrition original table privilege widened: % %',v3f,v44;END IF;
   END LOOP;
   IF NOT EXISTS(SELECT 1 FROM pg_class p JOIN pg_namespace n ON n.oid=p.relnamespace WHERE n.nspname='public' AND p.relname=v44 AND p.relrowsecurity) THEN RAISE EXCEPTION 'Nutrition RLS missing: %',v44;END IF;
  END LOOP;
  FOREACH v44 IN ARRAY ARRAY['nutrition_binding_captures','nutrition_review_scopes'] LOOP
   FOREACH v3f IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP IF has_table_privilege(v3f,'care_private.'||v44,'SELECT,INSERT,UPDATE,DELETE') THEN RAISE EXCEPTION 'Private Nutrition capture/scope privilege widened';END IF;END LOOP;
  END LOOP;
  v24:=true;RAISE EXCEPTION USING ERRCODE='Z0001';
 EXCEPTION WHEN SQLSTATE 'Z0001' THEN NULL;END;
 IF v24 IS NOT TRUE OR
  EXISTS(SELECT 1 FROM auth.users WHERE id IN(f_u,v3d,v31)) OR
  EXISTS(SELECT 1 FROM auth.sessions WHERE id IN(f_s,v3b,v32)) OR
  EXISTS(SELECT 1 FROM public.roles WHERE id IN(f_r,v38)) OR
  EXISTS(SELECT 1 FROM public.employee_employment_details WHERE employee_id=v10) OR
  (v51 IS NOT TRUE AND EXISTS(SELECT 1 FROM public.vital_sign_catalog WHERE key='weight')) OR
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
  EXISTS(SELECT 1 FROM care_private.nutrition_review_scopes WHERE tenant_id=f_t) OR EXISTS(SELECT 1 FROM public.profiles WHERE id IN(f_u,v3d,v31)) OR EXISTS(SELECT 1 FROM public.role_permissions WHERE role_id IN(f_r,v38)) THEN RAISE EXCEPTION 'Nutrition full inner rollback cleanup failed';END IF;
 PERFORM set_config('cp365.nutrition_workspace_test_evidence',jsonb_build_object('schemaVersion',1,'fixtureKind','authority','cleanupConfirmed',true,'expected',jsonb_build_object('tenantId',f_t,'clientId',f_c,'actorId',f_u,'reviewerId',v3d),'context',vd,'otherCaptureContext',v6,'capturePacket',v9,'captureReceipt',va,'otherCapturePacket',v7,'otherCaptureReceipt',v8,'prerequisites',v2b,'carePacket',v23,'careReceipt',v2e,'revisionPacket',v33,'revisionReceipt',v34,'otherCarePacket',v20,'otherCareReceipt',v21,'historicalOriginal',v15,'reviewPacket',v36,'reviewReceipt',v39,'readOnlyConfirmationsPassed',f_read_only_confirmed,'rawAccountRelinkBlocked',v30,'finalCarePage',v13,'reviewPage',v37,'emptyPage',v11)::text,true);
END $test$;
SELECT current_setting('cp365.nutrition_workspace_test_evidence',true)::jsonb AS evidence;
ROLLBACK;
