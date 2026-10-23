-- NEW synthetic Staging unit; no HTTP/browser/concurrency or clinical approval claim.
-- Requires ambulatory_assessment_planning_v2_quarantined.sql. All synthetic writes roll back.
BEGIN;
SET LOCAL statement_timeout='20s';SET LOCAL lock_timeout='5s';
DO $unit$
DECLARE
 t uuid:=gen_random_uuid();c uuid:=gen_random_uuid();u uuid:=gen_random_uuid();r uuid:=gen_random_uuid();s uuid:=gen_random_uuid();a uuid:=gen_random_uuid();topic uuid:=gen_random_uuid();risk uuid:=gen_random_uuid();measure uuid:=gen_random_uuid();
 at text:=to_char((clock_timestamp()-interval'10 minutes')at time zone'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"');future text:=to_char((clock_timestamp()+interval'1 day')at time zone'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"');
 ar jsonb;tr jsonb;rr jsonb;mr jsonb;base jsonb;cmd jsonb;receipt jsonb;confirmed jsonb;ctx jsonb;before_context jsonb;assessment_packet jsonb;assessment_receipt jsonb;instrument jsonb;lifecycle jsonb;goal jsonb;plan jsonb;routine jsonb;schedule jsonb;packets jsonb:='[]';receipts jsonb:='[]';native_before jsonb;step integer;head uuid;done boolean:=false;n integer;
BEGIN
 BEGIN
  INSERT INTO public.tenants(id,name)VALUES(t,'Synthetic Assessment planning runtime unit');
  INSERT INTO public.roles(id,key,name)VALUES(r,'synthetic_assessment_'||r,'Synthetic own technical planner');
  INSERT INTO public.role_permissions(role_id,permission_key)SELECT r,unnest(array['pflege.plans.view','pflege.assessments.manage']);
  INSERT INTO auth.users(id,email,raw_user_meta_data,raw_app_meta_data)VALUES(u,u||'@example.invalid','{}','{}');
  UPDATE public.profiles SET tenant_id=t,role_id=r,role_key='pfleger',is_active=true,status='active',display_name='Synthetic technical assessment author'WHERE id=u;
  INSERT INTO auth.sessions(id,user_id,not_after)VALUES(s,u,clock_timestamp()+interval'1 hour');
  INSERT INTO public.clients(id,tenant_id,first_name,last_name,status,lifecycle_status)VALUES(c,t,'Synthetic','Assessment client','aktiv','aktiv');
  INSERT INTO public.client_module_assignments(tenant_id,client_id,module_key,status,is_active)VALUES(t,c,'pflege','active',true);
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated','session_id',s,'exp',extract(epoch from clock_timestamp()+interval'1 hour')::bigint)::text,true);
  IF auth.uid()IS DISTINCT FROM u OR public.resolve_current_profile_id()IS DISTINCT FROM u OR public.current_tenant_id()IS DISTINCT FROM t THEN RAISE EXCEPTION 'Actual own synthetic Auth/profile/tenant not established';END IF;
  INSERT INTO public.care_assessments(id,tenant_id,subject_type,subject_id,subject_name_snapshot,variant,status,assessor_profile_id,assessor_name_snapshot,created_by,updated_by)VALUES(a,t,'client',c,'Synthetic Assessment client','ambulant','draft',u,'Synthetic technical assessment author',u,u);
  INSERT INTO care_private.assessment_models(model_key,title,model_version,claim,status,source_revision)VALUES('synthetic_'||a,'Synthetic explicit test model','unit-1','product_model','active','unit-1');
  INSERT INTO care_private.assessment_instrument_selections(tenant_id,assessment_id,subject_id,model_key,model_version,catalog_revision,selected_originals,updated_by)VALUES(t,a,c,'synthetic_'||a,'unit-1','synthetic-retained-catalog','[]',u);
  INSERT INTO public.care_assessment_topics(id,tenant_id,assessment_id,topic_key,resources,professional_assessment)VALUES(topic,t,a,'mobility','Synthetic explicitly recorded native resource','Synthetic retained native planning finding');
  INSERT INTO public.care_assessment_risks(id,tenant_id,assessment_id,risk_key)VALUES(risk,t,a,'fall');
  INSERT INTO public.care_assessment_measures(id,tenant_id,assessment_id,title,related_topic_key,related_risk_key,personal_goal,intervention)VALUES(measure,t,a,'Synthetic explicitly authored individual measure','mobility','fall','Synthetic personal planning goal','Synthetic proposed support');
  ar:=jsonb_build_object('kind','care_assessment','id',a,'snapshot',(SELECT to_jsonb(x)FROM public.care_assessments x WHERE x.id=a));
  tr:=jsonb_build_object('kind','assessment_topic','id',topic,'snapshot',(SELECT to_jsonb(x)FROM public.care_assessment_topics x WHERE x.id=topic));
  rr:=jsonb_build_object('kind','assessment_risk','id',risk,'snapshot',(SELECT to_jsonb(x)FROM public.care_assessment_risks x WHERE x.id=risk));
  mr:=jsonb_build_object('kind','assessment_measure','id',measure,'snapshot',(SELECT to_jsonb(x)FROM public.care_assessment_measures x WHERE x.id=measure));native_before:=jsonb_build_array(ar,tr,rr,mr);
  ctx:=public.web_assessment_path_v2_context(t,a,u);
  IF ctx->'supportedWriteKinds'IS DISTINCT FROM '["measure_plan_revision","correction"]'::jsonb OR (ctx->>'stateFingerprint'~'^sha256:[0-9a-f]{64}$')IS NOT TRUE OR ctx#>>'{history,count}'IS DISTINCT FROM '0'OR EXISTS(SELECT 1 FROM jsonb_array_elements(ctx#>'{sources,rows}')x WHERE x->>'kind'IN('care_observation','person_statement','care_execution','care_visit','care_plan_path_event','assessment_model','assessment_instrument_catalog'))OR NOT(ctx#>'{sources,rows}'@>native_before)THEN RAISE EXCEPTION 'Actual complete sources/proof/technical policy invalid';END IF;
  base:=jsonb_build_object('version','assessment-path-workspace-v2','requestId',gen_random_uuid(),'eventId',gen_random_uuid(),'tenantId',t,'assessmentId',a,'actorId',u,'expectedHeadId',null,'kind','measure_plan_revision','occurredAt',at,'note','Synthetic explicit technical planning record','payload',jsonb_build_object('assessment',ar,'risk',rr,'measure',mr,'goal','Synthetic individual goal','action','Synthetic authored proposal','frequency','Synthetic explicit planning frequency','responsibility','Synthetic planned professional role','dueAt',future));
  assessment_packet:=base;assessment_receipt:=public.web_commit_assessment_path_v2_event(base);
  IF assessment_receipt->'command'IS DISTINCT FROM base OR assessment_receipt#>'{event,command}'IS DISTINCT FROM base OR assessment_receipt#>>'{event,id}'IS DISTINCT FROM base->>'eventId'OR assessment_receipt#>>'{event,actorId}'IS DISTINCT FROM u::text OR public.web_commit_assessment_path_v2_event(base)IS DISTINCT FROM assessment_receipt OR public.web_confirm_assessment_path_v2_event(t,a,u,(base->>'requestId')::uuid,base)IS DISTINCT FROM assessment_receipt THEN RAISE EXCEPTION 'Assessment exact own commit/replay/confirmation failed';END IF;
  BEGIN PERFORM public.web_confirm_assessment_path_v2_event(t,a,u,gen_random_uuid(),base);RAISE EXCEPTION 'Unknown request adopted receipt';EXCEPTION WHEN SQLSTATE'P0P01'THEN NULL;END;
  FOR step IN 1..6 LOOP
   cmd:=base||jsonb_build_object('version','care-plan-path-workspace-v2','requestId',gen_random_uuid(),'eventId',gen_random_uuid(),'expectedHeadId',head);
   IF step=1 THEN cmd:=cmd||jsonb_build_object('kind','goal_plan','payload',jsonb_build_object('assessment',ar,'finding',tr,'goal',mr,'outcome','Synthetic observable planned outcome','baseline','Synthetic retained baseline','priority','Synthetic agreed planning priority','reviewAt',future));
   ELSIF step=2 THEN cmd:=cmd||jsonb_build_object('kind','measure_plan','payload',jsonb_build_object('goal',goal,'measure',mr,'action','Synthetic explicit action','frequency','Synthetic explicit frequency','aids','Synthetic explicitly selected planning aids','responsibleRole','Synthetic planned professional role'));
   ELSIF step=3 THEN cmd:=cmd||jsonb_build_object('kind','daily_routine','payload',jsonb_build_object('assessment',ar,'plan',goal,'timeWindow','Synthetic explicit planned time window','ritual','Synthetic authored ritual','preference','Synthetic individual preference','dependency','Synthetic explicit dependency'));
   ELSIF step=4 THEN cmd:=cmd||jsonb_build_object('kind','support_boundary','payload',jsonb_build_object('plan',goal,'finding',tr,'supportLevel','guidance','ownContribution','Synthetic individual own contribution','professionalBoundary','Synthetic explicit professional support boundary'));
   ELSIF step=5 THEN cmd:=cmd||jsonb_build_object('kind','schedule_commitment','payload',jsonb_build_object('measure',plan,'routine',routine,'startsAt',at,'dueAt',future,'frequency','Synthetic explicit frequency','exceptionRule','Synthetic authored exception rule'));
   ELSE cmd:=cmd||jsonb_build_object('kind','plan_review_request','payload',jsonb_build_object('assessment',ar,'goal',goal,'measure',plan,'schedule',schedule,'reason','Synthetic technical inspection request only','packetSha256',repeat('a',64)));END IF;
   receipt:=public.web_commit_care_plan_path_v2_event(cmd);confirmed:=public.web_confirm_care_plan_path_v2_event(t,a,u,(cmd->>'requestId')::uuid,cmd);
   IF receipt->'command'IS DISTINCT FROM cmd OR receipt#>'{event,command}'IS DISTINCT FROM cmd OR receipt#>>'{event,id}'IS DISTINCT FROM cmd->>'eventId'OR receipt#>>'{event,sequence}'IS DISTINCT FROM step::text OR receipt#>>'{event,actorId}'IS DISTINCT FROM u::text OR confirmed IS DISTINCT FROM receipt OR public.web_commit_care_plan_path_v2_event(cmd)IS DISTINCT FROM receipt THEN RAISE EXCEPTION 'Exact technical plan chain/own receipt failed at %',step;END IF;
   head:=(cmd->>'eventId')::uuid;packets:=packets||jsonb_build_array(cmd);receipts:=receipts||jsonb_build_array(receipt);
   IF step=1 THEN goal:=jsonb_build_object('kind','care_plan_path_event','id',head,'snapshot',receipt->'event');ELSIF step=2 THEN plan:=jsonb_build_object('kind','care_plan_path_event','id',head,'snapshot',receipt->'event');ELSIF step=3 THEN routine:=jsonb_build_object('kind','care_plan_path_event','id',head,'snapshot',receipt->'event');ELSIF step=5 THEN schedule:=jsonb_build_object('kind','care_plan_path_event','id',head,'snapshot',receipt->'event');END IF;
  END LOOP;
  ctx:=public.web_care_plan_path_v2_context(t,a,u);
  IF ctx#>>'{history,count}'IS DISTINCT FROM '6'OR ctx#>>'{history,headId}'IS DISTINCT FROM head::text OR ctx->'supportedWriteKinds'IS DISTINCT FROM '["goal_plan","measure_plan","daily_routine","support_boundary","schedule_commitment","plan_review_request","correction"]'::jsonb THEN RAISE EXCEPTION 'Full final technical plan history/policy missing';END IF;
  BEFORE_CONTEXT:=ctx;
  cmd:=cmd||jsonb_build_object('requestId',gen_random_uuid(),'eventId',gen_random_uuid(),'expectedHeadId',head,'kind','plan_release_decision');
  BEGIN PERFORM public.web_commit_care_plan_path_v2_event(cmd);RAISE EXCEPTION 'Technical planning admitted unproven clinical release';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
  BEGIN
  UPDATE public.care_assessment_topics SET wishes='Synthetic hidden native change at unchanged updated_at'WHERE id=topic;
  ctx:=public.web_care_plan_path_v2_context(t,a,u);
  IF ctx->'stateFingerprint'IS NOT DISTINCT FROM before_context->'stateFingerprint'OR ctx->'history'IS DISTINCT FROM before_context->'history'THEN RAISE EXCEPTION 'Hidden native change escaped complete-state proof or rewrote history';END IF;
  cmd:=(packets->1)||jsonb_build_object('requestId',gen_random_uuid(),'eventId',gen_random_uuid(),'expectedHeadId',head);
  BEGIN PERFORM public.web_commit_care_plan_path_v2_event(cmd);RAISE EXCEPTION 'Stale indirect full native source chain accepted';EXCEPTION WHEN serialization_failure THEN NULL;END;
  IF public.web_confirm_care_plan_path_v2_event(t,a,u,(packets#>>'{0,requestId}')::uuid,packets->0)IS DISTINCT FROM receipts->0 THEN RAISE EXCEPTION 'Historical exact own receipt changed after native edit';END IF;
  RAISE EXCEPTION USING ERRCODE='Z0002';
  EXCEPTION WHEN SQLSTATE'Z0002'THEN NULL;END;
  IF public.web_care_plan_path_v2_context(t,a,u)->'stateFingerprint'IS DISTINCT FROM before_context->'stateFingerprint'THEN RAISE EXCEPTION 'Restored exact native state did not restore proof';END IF;
  lifecycle:=public.web_read_plan_lifecycle_v2_packet(t,a,c,u);
  instrument:=public.web_read_assessment_instrument_v2_packet(t,a,c,u);
  IF lifecycle->>'packetRevision'IS DISTINCT FROM '0'OR lifecycle#>>'{measureOriginals,0,id}'IS DISTINCT FROM measure::text OR lifecycle->'stateFingerprint'IS DISTINCT FROM instrument->'stateFingerprint'OR lifecycle->'stateFingerprint'IS DISTINCT FROM before_context->'stateFingerprint'THEN RAISE EXCEPTION 'Actual native read packets do not bind the same complete scope';END IF;
  SELECT count(*)INTO n FROM pg_proc p JOIN pg_namespace z ON z.oid=p.pronamespace WHERE(z.nspname='assessment_planning_v2_private'OR(z.nspname='public'AND p.proname IN('web_assessment_path_v2_context','web_commit_assessment_path_v2_event','web_confirm_assessment_path_v2_event','web_care_plan_path_v2_context','web_commit_care_plan_path_v2_event','web_confirm_care_plan_path_v2_event','web_read_assessment_instrument_v2_packet','web_read_plan_lifecycle_v2_packet')))AND(has_function_privilege('authenticated',p.oid,'EXECUTE')OR has_function_privilege('anon',p.oid,'EXECUTE')OR has_function_privilege('service_role',p.oid,'EXECUTE'));
  IF n<>0 OR(SELECT count(*)FROM assessment_planning_v2_private.assessment_events WHERE tenant_id=t)<>1 OR(SELECT count(*)FROM assessment_planning_v2_private.plan_events WHERE tenant_id=t)<>6 OR(SELECT to_jsonb(x)FROM public.care_assessments x WHERE x.id=a)IS DISTINCT FROM ar->'snapshot'OR(SELECT to_jsonb(x)FROM public.care_assessment_measures x WHERE x.id=measure)IS DISTINCT FROM mr->'snapshot'THEN RAISE EXCEPTION 'Quarantine, exact counts or untouched native source failed';END IF;
  done:=true;RAISE EXCEPTION USING ERRCODE='Z0001';
 EXCEPTION WHEN SQLSTATE'Z0001'THEN NULL;END;
 IF EXISTS(SELECT 1 FROM care_private.assessment_models WHERE model_key='synthetic_'||a)OR EXISTS(SELECT 1 FROM care_private.assessment_instrument_selections WHERE assessment_id=a)THEN RAISE EXCEPTION 'Synthetic catalog selection survived rollback';END IF;
 IF done IS DISTINCT FROM true OR EXISTS(SELECT 1 FROM public.tenants WHERE id=t)OR EXISTS(SELECT 1 FROM auth.users WHERE id=u)OR EXISTS(SELECT 1 FROM auth.sessions WHERE id=s)OR EXISTS(SELECT 1 FROM public.profiles WHERE id=u)OR EXISTS(SELECT 1 FROM public.roles WHERE id=r)OR EXISTS(SELECT 1 FROM public.care_assessments WHERE id=a)OR EXISTS(SELECT 1 FROM assessment_planning_v2_private.assessment_roots WHERE tenant_id=t)OR EXISTS(SELECT 1 FROM assessment_planning_v2_private.assessment_events WHERE tenant_id=t)OR EXISTS(SELECT 1 FROM assessment_planning_v2_private.plan_roots WHERE tenant_id=t)OR EXISTS(SELECT 1 FROM assessment_planning_v2_private.plan_events WHERE tenant_id=t)THEN RAISE EXCEPTION 'Synthetic outer cleanup failed';END IF;
 PERFORM set_config('cp365.assessment_planning_unit',jsonb_build_object('expected',jsonb_build_object('tenantId',t,'assessmentId',a,'actorId',u,'subjectId',c),'assessmentPacket',assessment_packet,'assessmentReceipt',assessment_receipt,'planPackets',packets,'planReceipts',receipts,'context',before_context,'instrument',instrument,'lifecycle',lifecycle,'rollbackCleanupPassed',true,'technicalPlanningOnly',true)::text,true);
END$unit$;
SELECT current_setting('cp365.assessment_planning_unit',true)::jsonb AS synthetic_evidence;
ROLLBACK;
