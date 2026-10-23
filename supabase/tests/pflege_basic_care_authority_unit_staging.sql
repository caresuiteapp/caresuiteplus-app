-- Supplementary authority unit: original-core session/scope/rights/client/actual-Auth assertions; larger fixtures unchanged.
-- Synthetic SQL only, before intent; no HTTP/browser/clinical/concurrency claim. Full nested+outer rollback.
BEGIN;
SET LOCAL statement_timeout='15s';
SET LOCAL lock_timeout='5s';
DO $unit$
DECLARE
 f_t uuid:=gen_random_uuid();f_c uuid:=gen_random_uuid();f_u uuid:=gen_random_uuid();f_r uuid:=gen_random_uuid();f_s uuid:=gen_random_uuid();
 f_plan uuid:=gen_random_uuid();f_v uuid:=gen_random_uuid();f_i uuid:=gen_random_uuid();f_tr uuid:=gen_random_uuid();f_st uuid:=gen_random_uuid();f_br uuid:=gen_random_uuid();f_req uuid:=gen_random_uuid();
 f_day date:=(clock_timestamp()at time zone 'Europe/Berlin')::date-1;f_at text;f_n jsonb;f_ip jsonb;f_b jsonb;f_e jsonb;f_p jsonb;f_r0 jsonb;f_rc jsonb;f_done boolean:=false;f_c2 uuid:=gen_random_uuid();f_a2 uuid:=gen_random_uuid();f_s2 uuid:=gen_random_uuid();f_j jsonb;f_ok boolean:=false;
BEGIN
 BEGIN
  IF to_regclass('care_private.basic_care_binding_intents')IS NOT NULL THEN RAISE EXCEPTION 'Run this supplementary baseline unit before the binding-intent followup';END IF;
  INSERT INTO public.tenants(id,name)VALUES(f_t,'Synthetic isolated BasicCare receipt unit');
  INSERT INTO public.roles(id,key,name)VALUES(f_r,'synthetic_basic_unit_'||f_r,'Synthetic native planning author');
  INSERT INTO public.role_permissions(role_id,permission_key)SELECT f_r,unnest(ARRAY['pflege.plans.view','pflege.plans.manage','pflege.documentation.view','pflege.documentation.create']);
  INSERT INTO auth.users(id,email,raw_user_meta_data,raw_app_meta_data)VALUES(f_u,f_u||'@example.invalid','{}','{}');
  UPDATE public.profiles SET tenant_id=f_t,role_id=f_r,role_key='pfleger',is_active=true,status='active',display_name='Synthetic unit author'WHERE id=f_u;
  INSERT INTO auth.sessions(id,user_id,not_after)VALUES(f_s,f_u,clock_timestamp()+interval '1 hour');
  INSERT INTO public.clients(id,tenant_id,first_name,last_name,status,lifecycle_status)VALUES(f_c,f_t,'Synthetic','Receipt unit client','aktiv','aktiv');
  INSERT INTO public.client_module_assignments(tenant_id,client_id,module_key,status,is_active)VALUES(f_t,f_c,'pflege','active',true);
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',f_u,'role','authenticated','session_id',f_s,'exp',extract(epoch from clock_timestamp()+interval '1 hour')::bigint)::text,true);
  IF auth.uid()IS DISTINCT FROM f_u OR public.resolve_current_profile_id()IS DISTINCT FROM f_u OR public.current_tenant_id()IS DISTINCT FROM f_t THEN RAISE EXCEPTION 'Synthetic own Auth/session/profile/tenant was not actually established';END IF;
  PERFORM care_private.basic_care_actor(f_t,f_c,f_u,true);
  INSERT INTO public.care_plans(id,tenant_id,client_id,title,status,valid_from,valid_until)VALUES(f_plan,f_t,f_c,'Synthetic native individual planning unit','aktiv',f_day-1,f_day+7);
  INSERT INTO public.care_plan_items(id,tenant_id,care_plan_id,category,title,intervention,status,sort_order,created_by,updated_by)VALUES(f_i,f_t,f_plan,'body_care','Synthetic explicitly planned partial body care','Synthetic individual planned assistance','active',1,f_u,f_u);
  INSERT INTO public.care_plan_versions(id,tenant_id,care_plan_id,version,snapshot,reason,actor_id,actor_name)
   SELECT f_v,f_t,f_plan,1,jsonb_build_object('plan',to_jsonb(p),'items',(SELECT jsonb_agg(to_jsonb(i)ORDER BY i.id)FROM public.care_plan_items i WHERE i.care_plan_id=f_plan)),'Synthetic full native snapshot authored explicitly',f_u,'Synthetic unit author'FROM public.care_plans p WHERE p.id=f_plan;
  INSERT INTO public.care_tours(id,tenant_id,tour_date,name,status,created_by,updated_by)VALUES(f_tr,f_t,f_day,'Synthetic published receipt-unit tour','published',f_u,f_u);
  INSERT INTO public.care_tour_stops(id,tenant_id,tour_id,sequence_no,client_id,client_name_snapshot,planned_start,planned_end,status)VALUES(f_st,f_t,f_tr,1,f_c,'Synthetic client','08:15:30.123456','08:45:30.123456','planned');
  f_n:=care_private.basic_care_native_sources(f_t,f_c,f_v,f_i,f_st);
  f_at:=to_char(((f_day+time '08:15:30.123456')at time zone 'Europe/Berlin')at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"');
  f_ip:=jsonb_build_object('schemaVersion','1','requestId',f_br,'tenantId',f_t,'clientId',f_c,'actorId',f_u,'planVersionId',f_v,'measureId',f_i,'visitId',f_st,'plannedAt',f_at,'timeZone','Europe/Berlin','secondPersonRequired',false,'reason','Synthetic explicit planned selection without an actual care claim','sources',f_n);
  f_b:=public.web_issue_basic_care_binding(f_ip);
  f_e:=jsonb_build_object('kind','body_care','title',f_b#>'{plan,title}','plannedAt',f_at,'occurredAt',null,'planVersionId',f_v,'measureId',f_i,'visitId',f_st,'planSnapshotSha256',f_b#>'{plan,planSnapshotSha256}',
   'consent','{"state":"not_asked","recordedAt":null,"statedReason":"","consultation":""}'::jsonb,
   'assistance',jsonb_build_object('level','prompting','secondPersonRequired',false,'helpers',jsonb_build_array(f_u),'aids','[]'::jsonb,'technique','Synthetic expressly planned verbal assistance'),
   'observation','{"baseline":"Synthetic explicit individual planning situation","skin":"","mobility":"","oral":"","tolerance":"","oralAbnormality":false,"skinChange":false}'::jsonb,
   'execution','{"outcome":"planned","bodyScope":"partial","performedBy":[],"interventions":[],"result":"","deviation":""}'::jsonb,
   'prevention','{"risk":"","professionalBasis":"","individualMeasure":"","reviewAt":null,"fallOccurred":false,"incidentId":null,"reassessmentId":null}'::jsonb,
   'followUp','{"required":false,"reason":"","responsibleProfileId":null,"dueAt":null,"taskId":null,"state":"not_required","closureEvidence":""}'::jsonb,'lifecycle','open');
  f_p:=jsonb_build_object('schemaVersion','1','action','create','requestId',f_req,'tenantId',f_t,'clientId',f_c,'actorId',f_u,'expectedHeadId',null,'expectedRevision',0,'entry',f_e,'reason','','original',null,'pressureOriginals',null,'fallOriginals',null);
  f_r0:=public.web_commit_basic_care_packet(p_packet=>f_p);
  IF f_r0->'packet'IS DISTINCT FROM f_p OR f_r0#>>'{original,recordedBy}'IS DISTINCT FROM f_u::text THEN RAISE EXCEPTION 'Actual own planning receipt not established';END IF;
  f_j:=auth.jwt();
  BEGIN PERFORM set_config('request.jwt.claims','{}',true);PERFORM public.web_confirm_basic_care_packet(f_t,f_c,f_u,f_req,f_p);RAISE EXCEPTION 'Missing actual Auth/session accepted';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
  BEGIN PERFORM set_config('request.jwt.claims',(f_j-'session_id')::text,true);PERFORM public.web_confirm_basic_care_packet(f_t,f_c,f_u,f_req,f_p);RAISE EXCEPTION 'Missing session identity accepted';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
  BEGIN PERFORM set_config('request.jwt.claims',jsonb_set(f_j,'{exp}',to_jsonb(extract(epoch from clock_timestamp()-interval '1 second')::bigint))::text,true);PERFORM public.web_confirm_basic_care_packet(f_t,f_c,f_u,f_req,f_p);RAISE EXCEPTION 'Expired claimed session accepted';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
  BEGIN UPDATE auth.sessions SET not_after=clock_timestamp()-interval '1 second'WHERE id=f_s;PERFORM public.web_confirm_basic_care_packet(f_t,f_c,f_u,f_req,f_p);RAISE EXCEPTION 'Ended real Auth session accepted';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
  BEGIN DELETE FROM public.role_permissions WHERE role_id=f_r AND permission_key='pflege.documentation.create';PERFORM public.web_commit_basic_care_packet(f_p);RAISE EXCEPTION 'Write replay ignored own current create right';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
  BEGIN DELETE FROM public.role_permissions WHERE role_id=f_r AND permission_key='pflege.plans.manage';PERFORM public.web_issue_basic_care_binding(f_ip);RAISE EXCEPTION 'Issuer replay ignored current own planner right';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
  BEGIN DELETE FROM public.role_permissions WHERE role_id=f_r AND permission_key='pflege.documentation.view';PERFORM public.web_confirm_basic_care_packet(f_t,f_c,f_u,f_req,f_p);RAISE EXCEPTION 'Confirmation ignored own read right';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
  BEGIN INSERT INTO public.role_permission_sets(tenant_id,role_key,permission_key)SELECT f_t,r.key,'pflege.plans.view'FROM public.roles r WHERE r.id=f_r;PERFORM public.web_confirm_basic_care_packet(f_t,f_c,f_u,f_req,f_p);RAISE EXCEPTION 'Tenant own permission set fell back to role grants';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
  BEGIN UPDATE public.clients SET archived_at=clock_timestamp()WHERE id=f_c;PERFORM public.web_confirm_basic_care_packet(f_t,f_c,f_u,f_req,f_p);RAISE EXCEPTION 'Archived own client accepted';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
  BEGIN UPDATE public.client_module_assignments SET is_active=false WHERE tenant_id=f_t AND client_id=f_c;PERFORM public.web_confirm_basic_care_packet(f_t,f_c,f_u,f_req,f_p);RAISE EXCEPTION 'Lost active Pflege assignment accepted';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
  BEGIN UPDATE public.profiles SET is_active=false WHERE id=f_u;PERFORM public.web_confirm_basic_care_packet(f_t,f_c,f_u,f_req,f_p);RAISE EXCEPTION 'Inactive own profile accepted';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
  BEGIN PERFORM public.web_confirm_basic_care_packet(gen_random_uuid(),f_c,f_u,f_req,f_p);RAISE EXCEPTION 'Foreign requested tenant accepted';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
  BEGIN PERFORM public.web_confirm_basic_care_packet(f_t,f_c,gen_random_uuid(),f_req,f_p);RAISE EXCEPTION 'Different requested profile accepted';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
  INSERT INTO public.clients(id,tenant_id,first_name,last_name,status,lifecycle_status)VALUES(f_c2,f_t,'Synthetic','Other active own client','aktiv','aktiv');INSERT INTO public.client_module_assignments(tenant_id,client_id,module_key,status,is_active)VALUES(f_t,f_c2,'pflege','active',true);PERFORM care_private.basic_care_actor(f_t,f_c2,f_u,false);
  BEGIN PERFORM public.web_confirm_basic_care_packet(f_t,f_c2,f_u,f_req,f_p);RAISE EXCEPTION 'Different authorized client adopted own receipt';EXCEPTION WHEN SQLSTATE 'P0F02'THEN NULL;END;
  BEGIN PERFORM public.web_read_basic_care_page(f_t,f_c2,f_u,(f_r0#>>'{original,recordedAt}')::timestamptz,(f_r0#>>'{original,headId}')::uuid,1);RAISE EXCEPTION 'Different authorized client adopted own cursor';EXCEPTION WHEN serialization_failure THEN NULL;END;
  BEGIN
   INSERT INTO auth.users(id,email,raw_user_meta_data,raw_app_meta_data)VALUES(f_a2,f_a2||'@example.invalid','{}','{}');DELETE FROM public.profiles WHERE id=f_a2;UPDATE public.profiles SET auth_user_id=f_a2 WHERE id=f_u;INSERT INTO auth.sessions(id,user_id,not_after)VALUES(f_s2,f_a2,clock_timestamp()+interval '1 hour');PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',f_a2,'role','authenticated','session_id',f_s2,'exp',extract(epoch from clock_timestamp()+interval '1 hour')::bigint)::text,true);
   IF auth.uid()IS DISTINCT FROM f_a2 OR public.resolve_current_profile_id()IS DISTINCT FROM f_u OR public.current_tenant_id()IS DISTINCT FROM f_t THEN RAISE EXCEPTION 'Different actual Auth did not resolve same internal profile/tenant';END IF;PERFORM care_private.basic_care_actor(f_t,f_c,f_u,true);
   BEGIN PERFORM public.web_issue_basic_care_binding(f_ip);RAISE EXCEPTION 'Different actual Auth replayed issuer original';EXCEPTION WHEN serialization_failure THEN NULL;END;
   BEGIN PERFORM public.web_commit_basic_care_packet(f_p);RAISE EXCEPTION 'Different actual Auth replayed care original';EXCEPTION WHEN serialization_failure THEN NULL;END;
   BEGIN PERFORM public.web_confirm_basic_care_packet(f_t,f_c,f_u,f_req,f_p);RAISE EXCEPTION 'Different actual Auth confirmed care original';EXCEPTION WHEN SQLSTATE 'P0F02'THEN NULL;END;
   f_ok:=true;RAISE EXCEPTION USING ERRCODE='Z0002';EXCEPTION WHEN SQLSTATE 'Z0002'THEN NULL;END;
  IF f_ok IS DISTINCT FROM true OR auth.uid()IS DISTINCT FROM f_u OR EXISTS(SELECT 1 FROM auth.users WHERE id=f_a2)OR EXISTS(SELECT 1 FROM auth.sessions WHERE id=f_s2)OR EXISTS(SELECT 1 FROM public.profiles WHERE id=f_a2)THEN RAISE EXCEPTION 'Actual owner relink rollback failed';END IF;
  f_rc:=public.web_confirm_basic_care_packet(f_t,f_c,f_u,f_req,f_p);
  IF f_rc IS DISTINCT FROM f_r0 OR public.web_issue_basic_care_binding(f_ip)IS DISTINCT FROM f_b OR(SELECT count(*)FROM public.basic_care_events WHERE tenant_id=f_t)IS DISTINCT FROM 1 OR(SELECT count(*)FROM public.basic_care_receipts WHERE tenant_id=f_t)IS DISTINCT FROM 1 OR care_private.basic_care_native_sources(f_t,f_c,f_v,f_i,f_st)IS DISTINCT FROM f_n THEN RAISE EXCEPTION 'Negative scope/session paths left data or changed own original/native sources';END IF;
  f_done:=true;RAISE EXCEPTION USING ERRCODE='Z0001';
 EXCEPTION WHEN SQLSTATE 'Z0001'THEN NULL;END;
 IF f_done IS DISTINCT FROM true OR EXISTS(SELECT 1 FROM public.tenants WHERE id=f_t)OR EXISTS(SELECT 1 FROM auth.users WHERE id IN(f_u,f_a2))OR EXISTS(SELECT 1 FROM auth.sessions WHERE id IN(f_s,f_s2))OR EXISTS(SELECT 1 FROM public.profiles WHERE id=f_u)OR EXISTS(SELECT 1 FROM public.roles WHERE id=f_r)OR EXISTS(SELECT 1 FROM public.role_permissions WHERE role_id=f_r)OR EXISTS(SELECT 1 FROM public.role_permission_sets WHERE tenant_id=f_t)OR EXISTS(SELECT 1 FROM public.clients WHERE tenant_id=f_t)OR EXISTS(SELECT 1 FROM public.client_module_assignments WHERE tenant_id=f_t)OR EXISTS(SELECT 1 FROM public.care_plans WHERE id=f_plan)OR EXISTS(SELECT 1 FROM public.care_plan_versions WHERE id=f_v)OR EXISTS(SELECT 1 FROM public.care_plan_items WHERE id=f_i)OR EXISTS(SELECT 1 FROM public.care_tours WHERE id=f_tr)OR EXISTS(SELECT 1 FROM public.care_tour_stops WHERE id=f_st)OR EXISTS(SELECT 1 FROM care_private.basic_care_binding_requests WHERE tenant_id=f_t)OR EXISTS(SELECT 1 FROM public.basic_care_plan_bindings WHERE tenant_id=f_t)OR EXISTS(SELECT 1 FROM public.basic_care_roots WHERE tenant_id=f_t)OR EXISTS(SELECT 1 FROM public.basic_care_events WHERE tenant_id=f_t)OR EXISTS(SELECT 1 FROM public.basic_care_receipts WHERE tenant_id=f_t)OR EXISTS(SELECT 1 FROM public.basic_care_review_roots WHERE tenant_id=f_t)OR EXISTS(SELECT 1 FROM public.basic_care_review_events WHERE tenant_id=f_t)OR EXISTS(SELECT 1 FROM public.basic_care_review_receipts WHERE tenant_id=f_t)THEN RAISE EXCEPTION 'Supplementary isolated unit full rollback cleanup failed';END IF;
 PERFORM set_config('cp365.basic_authority_unit',jsonb_build_object('expected',jsonb_build_object('tenantId',f_t,'clientId',f_c,'authorId',f_u,'planVersionId',f_v,'measureId',f_i,'visitId',f_st,'issueRequestId',f_br,'createRequestId',f_req),'issuePacket',f_ip,'issueReceipt',f_b,'packet',f_p,'receipt',f_r0,'confirmedReceipt',f_rc,'sameProfileDifferentAuthReplayDenied',f_ok,'authorityUnit',true,'rollbackCleanupPassed',true)::text,true);
END
$unit$;
SELECT current_setting('cp365.basic_authority_unit',true)::jsonb AS synthetic_evidence;
ROLLBACK;
