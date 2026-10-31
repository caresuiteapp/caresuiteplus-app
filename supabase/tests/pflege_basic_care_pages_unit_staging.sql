-- Supplementary page/state unit: mapping to reconstructed core complete heads/tail, exact cursors, historical-head rejection and native state fingerprint.
-- Existing larger fixtures remain unchanged, including their separate cross-binding/cross-kind checks.
-- Privileged synthetic Auth/native sources only; no HTTP, browser, concurrency or clinical approval claim.
-- Requires the applied base+DTO before the binding-intent followup. All writes roll back.
BEGIN;
SET LOCAL statement_timeout='15s';
SET LOCAL lock_timeout='5s';
DO $unit$
DECLARE
 f_t uuid:=gen_random_uuid();f_c uuid:=gen_random_uuid();f_u uuid:=gen_random_uuid();f_r uuid:=gen_random_uuid();f_s uuid:=gen_random_uuid();
 f_plan uuid:=gen_random_uuid();f_v uuid:=gen_random_uuid();f_i uuid:=gen_random_uuid();f_tr uuid:=gen_random_uuid();f_st uuid:=gen_random_uuid();f_br uuid:=gen_random_uuid();f_req uuid:=gen_random_uuid();
 f_day date:=(clock_timestamp()at time zone 'Europe/Berlin')::date-1;f_at text;f_src jsonb;f_issue jsonb;f_b jsonb;f_e0 jsonb;f_p0 jsonb;f_r0 jsonb;f_confirmed jsonb;f_done boolean:=false;f_rq uuid:=gen_random_uuid();f_cq uuid:=gen_random_uuid();f_oq uuid:=gen_random_uuid();f_nv uuid;f_actual text;f_e1 jsonb;f_rp jsonb;f_rr jsonb;f_cp jsonb;f_cr jsonb;f_op jsonb;f_or jsonb;f_p1 jsonb;f_p2 jsonb;f_tail jsonb;f_value jsonb;
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
  f_src:=care_private.basic_care_native_sources(f_t,f_c,f_v,f_i,f_st);
  f_at:=to_char(((f_day+time '08:15:30.123456')at time zone 'Europe/Berlin')at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"');
  f_issue:=jsonb_build_object('schemaVersion','1','requestId',f_br,'tenantId',f_t,'clientId',f_c,'actorId',f_u,'planVersionId',f_v,'measureId',f_i,'visitId',f_st,'plannedAt',f_at,'timeZone','Europe/Berlin','secondPersonRequired',false,'reason','Synthetic explicit planned selection without an actual care claim','sources',f_src);
  f_b:=public.web_issue_basic_care_binding(f_issue);
  f_e0:=jsonb_build_object('kind','body_care','title',f_b#>'{plan,title}','plannedAt',f_at,'occurredAt',null,'planVersionId',f_v,'measureId',f_i,'visitId',f_st,'planSnapshotSha256',f_b#>'{plan,planSnapshotSha256}',
   'consent','{"state":"not_asked","recordedAt":null,"statedReason":"","consultation":""}'::jsonb,
   'assistance',jsonb_build_object('level','prompting','secondPersonRequired',false,'helpers',jsonb_build_array(f_u),'aids','[]'::jsonb,'technique','Synthetic expressly planned verbal assistance'),
   'observation','{"baseline":"Synthetic explicit individual planning situation","skin":"","mobility":"","oral":"","tolerance":"","oralAbnormality":false,"skinChange":false}'::jsonb,
   'execution','{"outcome":"planned","bodyScope":"partial","performedBy":[],"interventions":[],"result":"","deviation":""}'::jsonb,
   'prevention','{"risk":"","professionalBasis":"","individualMeasure":"","reviewAt":null,"fallOccurred":false,"incidentId":null,"reassessmentId":null}'::jsonb,
   'followUp','{"required":false,"reason":"","responsibleProfileId":null,"dueAt":null,"taskId":null,"state":"not_required","closureEvidence":""}'::jsonb,'lifecycle','open');
  f_p0:=jsonb_build_object('schemaVersion','1','action','create','requestId',f_req,'tenantId',f_t,'clientId',f_c,'actorId',f_u,'expectedHeadId',null,'expectedRevision',0,'entry',f_e0,'reason','','original',null,'pressureOriginals',null,'fallOriginals',null);
  f_r0:=public.web_commit_basic_care_packet(p_packet=>f_p0);
  f_rp:=f_p0||jsonb_build_object('action','revise','requestId',f_rq,'expectedHeadId',f_r0#>'{original,headId}','expectedRevision',1,'original',f_r0->'original','entry',jsonb_set(f_e0,'{observation,baseline}','"Synthetic revised planned individual baseline"'),'reason','Synthetic explicit planning correction retains immutable prior history');f_rr:=public.web_commit_basic_care_packet(f_rp);
  f_op:=f_p0||jsonb_build_object('requestId',f_oq);f_or:=public.web_commit_basic_care_packet(f_op);
  f_p1:=public.web_read_basic_care_page(f_t,f_c,f_u,null,null,1);f_p2:=public.web_read_basic_care_page(f_t,f_c,f_u,(f_p1->>'nextCursorRecordedAt')::timestamptz,(f_p1->>'nextCursorId')::uuid,1);f_tail:=public.web_read_basic_care_page(f_t,f_c,f_u,(f_p2->>'nextCursorRecordedAt')::timestamptz,(f_p2->>'nextCursorId')::uuid,1);
  IF length(f_p1->>'stateFingerprint')IS DISTINCT FROM 71 OR(f_p1->>'stateFingerprint'~'^sha256:[a-f0-9]{64}$')IS NOT TRUE OR f_p1->'rows'IS DISTINCT FROM jsonb_build_array(f_or->'original')OR f_p2->'rows'IS DISTINCT FROM jsonb_build_array(f_rr->'original')OR f_tail->'rows'IS DISTINCT FROM '[]'::jsonb OR f_tail->'nextCursorId'IS DISTINCT FROM 'null'::jsonb OR f_tail->'nextCursorRecordedAt'IS DISTINCT FROM 'null'::jsonb OR f_p1->>'stateFingerprint'IS DISTINCT FROM f_p2->>'stateFingerprint'OR f_tail->>'stateFingerprint'IS DISTINCT FROM f_p1->>'stateFingerprint'THEN RAISE EXCEPTION 'Whole current-head page/tail/state proof failed';END IF;
  BEGIN PERFORM public.web_read_basic_care_page(f_t,f_c,f_u,null,(f_p1->>'nextCursorId')::uuid,1);RAISE EXCEPTION 'Partial cursor accepted';EXCEPTION WHEN check_violation THEN NULL;END;
  BEGIN PERFORM public.web_read_basic_care_page(f_t,f_c,f_u,null,null,null);RAISE EXCEPTION 'Null page size accepted';EXCEPTION WHEN check_violation THEN NULL;END;
  BEGIN PERFORM public.web_read_basic_care_page(f_t,f_c,f_u,(f_p1->>'nextCursorRecordedAt')::timestamptz+interval '1 microsecond',(f_p1->>'nextCursorId')::uuid,1);RAISE EXCEPTION 'One-microsecond wrong cursor accepted';EXCEPTION WHEN serialization_failure THEN NULL;END;
  BEGIN PERFORM public.web_read_basic_care_page(f_t,f_c,f_u,(f_r0#>>'{original,recordedAt}')::timestamptz,(f_r0#>>'{original,id}')::uuid,1);RAISE EXCEPTION 'Historical nonhead cursor accepted';EXCEPTION WHEN serialization_failure THEN NULL;END;
  BEGIN UPDATE public.care_tour_stops SET notes='Synthetic off-page native source drift'WHERE id=f_st;f_value:=public.web_read_basic_care_page(f_t,f_c,f_u,null,null,1);IF f_value->>'stateFingerprint'IS NOT DISTINCT FROM f_p1->>'stateFingerprint'OR f_value->'rows'IS DISTINCT FROM f_p1->'rows'THEN RAISE EXCEPTION 'State token omitted native drift or rewrote immutable projected original';END IF;RAISE EXCEPTION USING ERRCODE='Z0002';EXCEPTION WHEN SQLSTATE 'Z0002'THEN NULL;END;
  IF(SELECT count(*)FROM public.basic_care_roots WHERE tenant_id=f_t)IS DISTINCT FROM 2 OR(SELECT count(*)FROM public.basic_care_events WHERE tenant_id=f_t)IS DISTINCT FROM 3 OR(SELECT count(*)FROM public.basic_care_receipts WHERE tenant_id=f_t)IS DISTINCT FROM 3 OR EXISTS(SELECT 1 FROM public.basic_care_review_events WHERE tenant_id=f_t)OR care_private.basic_care_native_sources(f_t,f_c,f_v,f_i,f_st)IS DISTINCT FROM f_src THEN RAISE EXCEPTION 'Page/cursor cases changed native source or left data';END IF;
  f_done:=true;RAISE EXCEPTION USING ERRCODE='Z0001';
 EXCEPTION WHEN SQLSTATE 'Z0001'THEN NULL;END;
 IF f_done IS DISTINCT FROM true OR EXISTS(SELECT 1 FROM public.tenants WHERE id=f_t)OR EXISTS(SELECT 1 FROM auth.users WHERE id=f_u)OR EXISTS(SELECT 1 FROM auth.sessions WHERE id=f_s)OR EXISTS(SELECT 1 FROM public.profiles WHERE id=f_u)OR EXISTS(SELECT 1 FROM public.roles WHERE id=f_r)OR EXISTS(SELECT 1 FROM public.role_permissions WHERE role_id=f_r)OR EXISTS(SELECT 1 FROM public.role_permission_sets WHERE tenant_id=f_t)OR EXISTS(SELECT 1 FROM public.clients WHERE id=f_c)OR EXISTS(SELECT 1 FROM public.client_module_assignments WHERE tenant_id=f_t)OR EXISTS(SELECT 1 FROM public.care_plans WHERE id=f_plan)OR EXISTS(SELECT 1 FROM public.care_plan_versions WHERE tenant_id=f_t)OR EXISTS(SELECT 1 FROM public.care_plan_items WHERE id=f_i)OR EXISTS(SELECT 1 FROM public.care_tours WHERE id=f_tr)OR EXISTS(SELECT 1 FROM public.care_tour_stops WHERE id=f_st)OR EXISTS(SELECT 1 FROM care_private.basic_care_binding_requests WHERE tenant_id=f_t)OR EXISTS(SELECT 1 FROM public.basic_care_plan_bindings WHERE tenant_id=f_t)OR EXISTS(SELECT 1 FROM public.basic_care_roots WHERE tenant_id=f_t)OR EXISTS(SELECT 1 FROM public.basic_care_events WHERE tenant_id=f_t)OR EXISTS(SELECT 1 FROM public.basic_care_receipts WHERE tenant_id=f_t)OR EXISTS(SELECT 1 FROM public.basic_care_review_roots WHERE tenant_id=f_t)OR EXISTS(SELECT 1 FROM public.basic_care_review_events WHERE tenant_id=f_t)OR EXISTS(SELECT 1 FROM public.basic_care_review_receipts WHERE tenant_id=f_t)THEN RAISE EXCEPTION 'Supplementary isolated unit full rollback cleanup failed';END IF;
 PERFORM set_config('cp365.basic_pages_unit',jsonb_build_object('expected',jsonb_build_object('tenantId',f_t,'clientId',f_c,'authorId',f_u,'planVersionId',f_v,'measureId',f_i,'visitId',f_st,'issueRequestId',f_br,'createRequestId',f_req,'revisionRequestId',f_rq,'otherRequestId',f_oq),'issuePacket',f_issue,'issueReceipt',f_b,'packet',f_p0,'receipt',f_r0,'revisionPacket',f_rp,'revisionReceipt',f_rr,'otherPacket',f_op,'otherReceipt',f_or,'page1',f_p1,'page2',f_p2,'tail',f_tail,'pagesUnit',true,'rollbackCleanupPassed',true)::text,true);
END
$unit$;
SELECT current_setting('cp365.basic_pages_unit',true)::jsonb AS synthetic_evidence;
ROLLBACK;
