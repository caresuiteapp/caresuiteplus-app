-- NEW supplementary access-only unit. Full authority fixture remains unchanged/unconfirmed.
-- Covers four isolated access revocations, NOT same-profile Auth relinking or HTTP/concurrency.
BEGIN;SET LOCAL statement_timeout='15s';SET LOCAL lock_timeout='5s';
DO $unit$
DECLARE
 t uuid:=gen_random_uuid();c uuid:=gen_random_uuid();u uuid:=gen_random_uuid();r uuid:=gen_random_uuid();s uuid:=gen_random_uuid();a uuid:=gen_random_uuid();topic uuid:=gen_random_uuid();risk uuid:=gen_random_uuid();measure uuid:=gen_random_uuid();raw_b uuid:=gen_random_uuid();session_b uuid:=gen_random_uuid();
 at text:=to_char((clock_timestamp()-interval'10 minutes')at time zone'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"');future text:=to_char((clock_timestamp()+interval'1 day')at time zone'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"');
 ar jsonb;tr jsonb;rr jsonb;mr jsonb;base jsonb;cmd jsonb;assessment_packet jsonb;assessment_receipt jsonb;native_before jsonb;claims jsonb;new_receipt jsonb;rel_link boolean:=false;done boolean:=false;check_count integer:=0;final_context jsonb;
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
  INSERT INTO public.care_assessment_topics(id,tenant_id,assessment_id,topic_key,resources,professional_assessment)VALUES(topic,t,a,'mobility','Synthetic explicitly recorded native resource','Synthetic retained native planning finding');
  INSERT INTO public.care_assessment_risks(id,tenant_id,assessment_id,risk_key)VALUES(risk,t,a,'fall');
  INSERT INTO public.care_assessment_measures(id,tenant_id,assessment_id,title,related_topic_key,related_risk_key,personal_goal,intervention)VALUES(measure,t,a,'Synthetic explicitly authored individual measure','mobility','fall','Synthetic personal planning goal','Synthetic proposed support');
  ar:=jsonb_build_object('kind','care_assessment','id',a,'snapshot',(SELECT to_jsonb(x)FROM public.care_assessments x WHERE x.id=a));
  tr:=jsonb_build_object('kind','assessment_topic','id',topic,'snapshot',(SELECT to_jsonb(x)FROM public.care_assessment_topics x WHERE x.id=topic));
  rr:=jsonb_build_object('kind','assessment_risk','id',risk,'snapshot',(SELECT to_jsonb(x)FROM public.care_assessment_risks x WHERE x.id=risk));
  mr:=jsonb_build_object('kind','assessment_measure','id',measure,'snapshot',(SELECT to_jsonb(x)FROM public.care_assessment_measures x WHERE x.id=measure));native_before:=jsonb_build_array(ar,tr,rr,mr);
  base:=jsonb_build_object('version','assessment-path-workspace-v2','requestId',gen_random_uuid(),'eventId',gen_random_uuid(),'tenantId',t,'assessmentId',a,'actorId',u,'expectedHeadId',null,'kind','measure_plan_revision','occurredAt',at,'note','Synthetic explicit technical planning record','payload',jsonb_build_object('assessment',ar,'risk',rr,'measure',mr,'goal','Synthetic individual goal','action','Synthetic authored proposal','frequency','Synthetic explicit planning frequency','responsibility','Synthetic planned professional role','dueAt',future));
  assessment_packet:=base;assessment_receipt:=public.web_commit_assessment_path_v2_event(base);
  IF assessment_receipt->'command'IS DISTINCT FROM base OR assessment_receipt#>'{event,command}'IS DISTINCT FROM base OR assessment_receipt#>>'{event,id}'IS DISTINCT FROM base->>'eventId'OR assessment_receipt#>>'{event,actorId}'IS DISTINCT FROM u::text OR public.web_commit_assessment_path_v2_event(base)IS DISTINCT FROM assessment_receipt OR public.web_confirm_assessment_path_v2_event(t,a,u,(base->>'requestId')::uuid,base)IS DISTINCT FROM assessment_receipt THEN RAISE EXCEPTION 'Assessment exact own commit/replay/confirmation failed';END IF;
  BEGIN PERFORM public.web_confirm_assessment_path_v2_event(t,a,u,gen_random_uuid(),base);RAISE EXCEPTION 'Unknown request adopted receipt';EXCEPTION WHEN SQLSTATE'P0P01'THEN NULL;END;

  claims:=auth.jwt();
  -- Losing create/manage rights must block retries but preserve exact read-authorized own confirmation.
  BEGIN
   DELETE FROM public.role_permissions WHERE role_id=r AND permission_key='pflege.assessments.manage';
   IF public.web_confirm_assessment_path_v2_event(t,a,u,(base->>'requestId')::uuid,base)IS DISTINCT FROM assessment_receipt THEN RAISE EXCEPTION 'Read-only own confirmation lost';END IF;
   BEGIN PERFORM public.web_commit_assessment_path_v2_event(base);RAISE EXCEPTION 'Manage right loss accepted retry';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
   check_count:=check_count+1;RAISE EXCEPTION USING ERRCODE='Z0002';
  EXCEPTION WHEN SQLSTATE'Z0002'THEN NULL;END;
  -- Exact tenant own-role override wins over default role permissions.
  BEGIN
   INSERT INTO public.role_permission_sets(tenant_id,role_key,permission_key)SELECT t,x.key,'pflege.plans.view'FROM public.roles x WHERE x.id=r;
   IF public.web_confirm_assessment_path_v2_event(t,a,u,(base->>'requestId')::uuid,base)IS DISTINCT FROM assessment_receipt THEN RAISE EXCEPTION 'Own override read confirmation failed';END IF;
   BEGIN PERFORM public.web_commit_assessment_path_v2_event(base);RAISE EXCEPTION 'Override revoked manage right leaked';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
   check_count:=check_count+1;RAISE EXCEPTION USING ERRCODE='Z0002';
  EXCEPTION WHEN SQLSTATE'Z0002'THEN NULL;END;
  BEGIN
   UPDATE public.client_module_assignments SET is_active=false WHERE tenant_id=t;
   BEGIN PERFORM public.web_confirm_assessment_path_v2_event(t,a,u,(base->>'requestId')::uuid,base);RAISE EXCEPTION 'Inactive Pflege assignment confirmed';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
   check_count:=check_count+1;RAISE EXCEPTION USING ERRCODE='Z0002';
  EXCEPTION WHEN SQLSTATE'Z0002'THEN NULL;END;
  BEGIN
   UPDATE auth.sessions SET not_after=clock_timestamp()-interval'1 second'WHERE id=s;
   BEGIN PERFORM public.web_assessment_path_v2_context(t,a,u);RAISE EXCEPTION 'Ended actual session read';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
   BEGIN PERFORM public.web_confirm_assessment_path_v2_event(t,a,u,(base->>'requestId')::uuid,base);RAISE EXCEPTION 'Ended actual session confirmed';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
   check_count:=check_count+1;RAISE EXCEPTION USING ERRCODE='Z0002';
  EXCEPTION WHEN SQLSTATE'Z0002'THEN NULL;END;
  IF auth.uid()IS DISTINCT FROM u OR public.resolve_current_profile_id()IS DISTINCT FROM u OR public.current_tenant_id()IS DISTINCT FROM t OR public.web_confirm_assessment_path_v2_event(t,a,u,(base->>'requestId')::uuid,base)IS DISTINCT FROM assessment_receipt OR(SELECT count(*)FROM assessment_planning_v2_private.assessment_events WHERE tenant_id=t)<>1 OR check_count<>4 THEN RAISE EXCEPTION 'Four isolated access cases failed restoration';END IF;
  final_context:=public.web_assessment_path_v2_context(t,a,u);
  IF final_context#>>'{history,headId}'IS DISTINCT FROM base->>'eventId'OR final_context#>'{history,count}'IS DISTINCT FROM '1'::jsonb THEN RAISE EXCEPTION 'Final own complete context lost original head';END IF;
  done:=true;RAISE EXCEPTION USING ERRCODE='Z0001';
 EXCEPTION WHEN SQLSTATE'Z0001'THEN NULL;END;
 IF done IS NOT TRUE OR EXISTS(SELECT 1 FROM public.tenants WHERE id=t)OR EXISTS(SELECT 1 FROM public.roles WHERE id=r)OR EXISTS(SELECT 1 FROM public.role_permissions WHERE role_id=r)OR EXISTS(SELECT 1 FROM public.role_permission_sets WHERE tenant_id=t)OR EXISTS(SELECT 1 FROM auth.users WHERE id IN(u,raw_b))OR EXISTS(SELECT 1 FROM auth.sessions WHERE id IN(s,session_b))OR EXISTS(SELECT 1 FROM public.profiles WHERE id IN(u,raw_b))OR EXISTS(SELECT 1 FROM public.clients WHERE id=c)OR EXISTS(SELECT 1 FROM public.client_module_assignments WHERE tenant_id=t)OR EXISTS(SELECT 1 FROM public.care_assessments WHERE id=a)OR EXISTS(SELECT 1 FROM public.care_assessment_topics WHERE id=topic)OR EXISTS(SELECT 1 FROM public.care_assessment_risks WHERE id=risk)OR EXISTS(SELECT 1 FROM public.care_assessment_measures WHERE id=measure)OR EXISTS(SELECT 1 FROM assessment_planning_v2_private.assessment_roots WHERE tenant_id=t)OR EXISTS(SELECT 1 FROM assessment_planning_v2_private.assessment_events WHERE tenant_id=t)THEN RAISE EXCEPTION 'Authority unit full rollback cleanup failed';END IF;
 PERFORM set_config('cp365.assessment_planning_access',jsonb_build_object('schemaVersion',1,'partialAccessUnit',true,'expected',jsonb_build_object('tenantId',t,'assessmentId',a,'actorId',u,'subjectId',c),'packet',assessment_packet,'receipt',assessment_receipt,'context',final_context,'authorityCaseCount',check_count,'sameProfileRelinkCovered',false,'rollbackCleanupPassed',true)::text,true);
END$unit$;
SELECT current_setting('cp365.assessment_planning_access',true)::jsonb AS synthetic_evidence;
ROLLBACK;
