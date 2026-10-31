-- Supplementary6b: exact review-root cursors; full suite unchanged. Before intents.
BEGIN;
SET LOCAL statement_timeout='15s';
SET LOCAL lock_timeout='5s';
DO $unit$
DECLARE
f_t uuid:=gen_random_uuid();f_c uuid:=gen_random_uuid();f_u uuid:=gen_random_uuid();f_r uuid:=gen_random_uuid();f_s uuid:=gen_random_uuid();
f_v uuid:=gen_random_uuid();f_vr uuid:=gen_random_uuid();f_vs uuid:=gen_random_uuid();f_employee uuid:=gen_random_uuid();f_document uuid:=gen_random_uuid();f_qual uuid:=gen_random_uuid();f_scope uuid:=gen_random_uuid();
f_plan uuid:=gen_random_uuid();f_version uuid:=gen_random_uuid();f_item uuid:=gen_random_uuid();f_tour uuid:=gen_random_uuid();f_stop uuid:=gen_random_uuid();f_bind_request uuid:=gen_random_uuid();f_care_request uuid:=gen_random_uuid();f_request uuid:=gen_random_uuid();f_accept uuid:=gen_random_uuid();
f_day date:=(clock_timestamp()at time zone 'Europe/Berlin')::date-1;f_planned timestamptz;f_at text;f_claims jsonb;f_vclaims jsonb;f_native jsonb;f_issue jsonb;f_binding jsonb;f_entry jsonb;f_packet jsonb;f_receipt jsonb;
f_rpacket jsonb;f_rr jsonb;f_apacket jsonb;f_ar jsonb;f_q jsonb;f_page jsonb;f_tail jsonb;f_value jsonb;f_table text;f_dirty boolean;f_done boolean:=false;
BEGIN
BEGIN
IF to_regclass('care_private.basic_care_binding_intents')IS NOT NULL OR to_regclass('care_private.basic_care_native_author_proofs')IS NOT NULL THEN RAISE EXCEPTION 'Baseline must precede intent/authorship';END IF;
INSERT INTO public.tenants(id,name)VALUES(f_t,'Synthetic BasicCare review unit');
INSERT INTO public.roles(id,key,name)VALUES(f_r,'synthetic_basic_u4_'||f_r,'Synthetic care author'),(f_vr,'synthetic_basic_v4_'||f_vr,'Synthetic reviewer');
INSERT INTO public.role_permissions(role_id,permission_key)SELECT f_r,unnest(ARRAY['pflege.plans.view','pflege.plans.manage','pflege.documentation.view','pflege.documentation.create']);
INSERT INTO public.role_permissions(role_id,permission_key)SELECT f_vr,unnest(ARRAY['pflege.plans.view','pflege.documentation.view','pflege.documentation.sign']);
INSERT INTO auth.users(id,email,raw_user_meta_data,raw_app_meta_data)VALUES(f_u,f_u||'@example.invalid','{}','{}'),(f_v,f_v||'@example.invalid','{}','{}');
UPDATE public.profiles SET tenant_id=f_t,role_id=f_r,role_key='pfleger',is_active=true,status='active',display_name='Synthetic author'WHERE id=f_u;
UPDATE public.profiles SET tenant_id=f_t,role_id=f_vr,role_key='pfleger',is_active=true,status='active',display_name='Synthetic reviewer'WHERE id=f_v;
INSERT INTO auth.sessions(id,user_id,not_after)VALUES(f_s,f_u,clock_timestamp()+interval '1 hour'),(f_vs,f_v,clock_timestamp()+interval '1 hour');
INSERT INTO public.clients(id,tenant_id,first_name,last_name,status,lifecycle_status)VALUES(f_c,f_t,'Synthetic','Review unit client','aktiv','aktiv');
INSERT INTO public.client_module_assignments(tenant_id,client_id,module_key,status,is_active)VALUES(f_t,f_c,'pflege','active',true);
f_claims:=jsonb_build_object('sub',f_u,'role','authenticated','session_id',f_s,'exp',extract(epoch from clock_timestamp()+interval '1 hour')::bigint);
f_vclaims:=jsonb_build_object('sub',f_v,'role','authenticated','session_id',f_vs,'exp',extract(epoch from clock_timestamp()+interval '1 hour')::bigint);
PERFORM set_config('request.jwt.claims',f_claims::text,true);PERFORM care_private.basic_care_actor(f_t,f_c,f_u,true);
INSERT INTO public.care_plans(id,tenant_id,client_id,title,status,valid_from,valid_until)VALUES(f_plan,f_t,f_c,'Synthetic native review plan','aktiv',f_day-1,f_day+7);
INSERT INTO public.care_plan_items(id,tenant_id,care_plan_id,category,title,intervention,status,sort_order,created_by,updated_by)VALUES(f_item,f_t,f_plan,'body_care','Synthetic body care','Synthetic assistance','active',1,f_u,f_u);
INSERT INTO public.care_plan_versions(id,tenant_id,care_plan_id,version,snapshot,reason,actor_id,actor_name)
SELECT f_version,f_t,f_plan,1,jsonb_build_object('plan',to_jsonb(p),'items',(SELECT jsonb_agg(to_jsonb(i)ORDER BY i.id)FROM public.care_plan_items i WHERE i.care_plan_id=f_plan)),'Synthetic source',f_u,'Synthetic author'FROM public.care_plans p WHERE p.id=f_plan;
INSERT INTO public.care_tours(id,tenant_id,tour_date,name,status,created_by,updated_by)VALUES(f_tour,f_t,f_day,'Synthetic tour','published',f_u,f_u);
INSERT INTO public.care_tour_stops(id,tenant_id,tour_id,sequence_no,client_id,client_name_snapshot,planned_start,planned_end,status)VALUES(f_stop,f_t,f_tour,1,f_c,'Synthetic client','08:15:30.123456','08:45:30.123456','planned');
f_native:=care_private.basic_care_native_sources(f_t,f_c,f_version,f_item,f_stop);
f_planned:=(f_day+time '08:15:30.123456')at time zone 'Europe/Berlin';f_at:=to_char(f_planned at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"');
f_issue:=jsonb_build_object('schemaVersion','1','requestId',f_bind_request,'tenantId',f_t,'clientId',f_c,'actorId',f_u,'planVersionId',f_version,'measureId',f_item,'visitId',f_stop,'plannedAt',f_at,'timeZone','Europe/Berlin','secondPersonRequired',false,'reason','Synthetic explicit selection','sources',f_native);
f_binding:=public.web_issue_basic_care_binding(p_packet=>f_issue);
f_entry:=jsonb_build_object('kind','body_care','title',f_binding#>'{plan,title}','plannedAt',f_at,'occurredAt',to_char((f_planned+interval '1 minute')at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),'planVersionId',f_version,'measureId',f_item,'visitId',f_stop,'planSnapshotSha256',f_binding#>'{plan,planSnapshotSha256}',
'consent',jsonb_build_object('state','consented','recordedAt',to_char((f_planned+interval '59 seconds')at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),'statedReason','','consultation','Synthetic consent'),
'assistance',jsonb_build_object('level','prompting','secondPersonRequired',false,'helpers',jsonb_build_array(f_u),'aids','[]'::jsonb,'technique','Synthetic individual assistance'),
'observation','{"baseline":"Synthetic individual baseline","skin":"","mobility":"","oral":"","tolerance":"","oralAbnormality":false,"skinChange":false}'::jsonb,
'execution',jsonb_build_object('outcome','performed','bodyScope','partial','performedBy',jsonb_build_array(f_u),'interventions',jsonb_build_array('Synthetic body care'),'result','Synthetic result','deviation',''),
'prevention','{"risk":"","professionalBasis":"","individualMeasure":"","reviewAt":null,"fallOccurred":false,"incidentId":null,"reassessmentId":null}'::jsonb,
'followUp','{"required":false,"reason":"","responsibleProfileId":null,"dueAt":null,"taskId":null,"state":"not_required","closureEvidence":""}'::jsonb,'lifecycle','completed');
f_packet:=jsonb_build_object('schemaVersion','1','action','create','requestId',f_care_request,'tenantId',f_t,'clientId',f_c,'actorId',f_u,'expectedHeadId',null,'expectedRevision',0,'entry',f_entry,'reason','','original',null,'pressureOriginals',null,'fallOriginals',null);
f_receipt:=public.web_commit_basic_care_packet(p_packet=>f_packet);
IF f_binding->'packet'IS DISTINCT FROM f_issue OR f_receipt->'packet'IS DISTINCT FROM f_packet OR f_receipt#>'{original,payload}'IS DISTINCT FROM f_entry THEN RAISE EXCEPTION 'Care receipt mismatch';END IF;
f_rpacket:=jsonb_build_object('schemaVersion','1','action','request','requestId',f_request,'tenantId',f_t,'clientId',f_c,'actorId',f_u,'occurredAt',to_char(clock_timestamp()at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),'expectedReviewHeadId',null,'expectedReviewRevision',0,'careOriginal',f_receipt->'original','reviewOriginal',null,'reason','Synthetic care review request','requiredChange','','rationale','');
f_rr:=public.web_commit_basic_care_review(p_packet=>f_rpacket);
IF f_rr->'packet'IS DISTINCT FROM f_rpacket OR f_rr#>>'{original,status}'IS DISTINCT FROM 'requested'OR f_rr#>>'{original,revision}'IS DISTINCT FROM '1'OR f_rr#>>'{original,rootId}'IS DISTINCT FROM f_rr#>>'{original,history,0,id}'THEN RAISE EXCEPTION 'Review request/root mismatch';END IF;
f_apacket:=f_rpacket||jsonb_build_object('action','accept','requestId',f_accept,'actorId',f_v,'occurredAt',to_char(clock_timestamp()at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),'expectedReviewHeadId',f_rr#>'{original,headId}','expectedReviewRevision',1,'reviewOriginal',f_rr->'original','reason','','rationale','Synthetic independent review');
PERFORM set_config('request.jwt.claims',f_vclaims::text,true);PERFORM care_private.basic_care_actor(f_t,f_c,f_v,false);
IF auth.uid()IS DISTINCT FROM f_v OR public.resolve_current_profile_id()IS DISTINCT FROM f_v OR f_u=f_v THEN RAISE EXCEPTION 'Own reviewer missing';END IF;
INSERT INTO public.employees(id,tenant_id,profile_id,first_name,last_name,status,start_date)VALUES(f_employee,f_t,f_v,'Synthetic','Unit reviewer','aktiv',f_day-30);
INSERT INTO public.employee_employment_details(tenant_id,employee_id,employment_status)VALUES(f_t,f_employee,'active');
INSERT INTO public.employee_documents(id,tenant_id,employee_id,category,title,file_name,storage_path,valid_until)VALUES(f_document,f_t,f_employee,'qualification','Synthetic family credential','synthetic.pdf','synthetic-only/'||f_document||'.pdf',f_day+30);
INSERT INTO public.employee_qualifications(id,tenant_id,employee_id,qualification_type,title,issued_at,valid_until,document_id,verified_by,verified_at,status)VALUES(f_qual,f_t,f_employee,'synthetic_basic_care_review','Synthetic family qualification',f_day-30,f_day+30,f_document,'Synthetic privileged provisioner',f_planned-interval '1 day','valid');
INSERT INTO care_private.basic_care_review_scopes(id,tenant_id,employee_id,qualification_id,kind,qualification_fingerprint,document_fingerprint,approved_by,approved_at,valid_until)
SELECT f_scope,f_t,f_employee,f_qual,'basic_care_review',care_private.basic_care_fingerprint(to_jsonb(q)),care_private.basic_care_fingerprint(to_jsonb(d)),f_u,f_planned-interval '1 hour',clock_timestamp()+interval '1 day'FROM public.employee_qualifications q JOIN public.employee_documents d ON d.id=q.document_id WHERE q.id=f_qual;
f_q:=care_private.basic_care_review_qualification(f_t,f_v);
IF f_q->>'profileId'IS DISTINCT FROM f_v::text OR f_q->>'scopeKind'IS DISTINCT FROM 'basic_care_review'OR f_q->>'scopeId'IS DISTINCT FROM f_scope::text THEN RAISE EXCEPTION 'Qualification unbound';END IF;
f_apacket:=f_apacket||jsonb_build_object('occurredAt',to_char(clock_timestamp()at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'));f_ar:=public.web_commit_basic_care_review(f_apacket);
f_page:=public.web_read_basic_care_review_page(f_t,f_c,f_v,null,null,1);f_tail:=public.web_read_basic_care_review_page(f_t,f_c,f_v,(f_page->>'nextCursorRecordedAt')::timestamptz,(f_page->>'nextCursorId')::uuid,1);
IF f_ar#>>'{original,status}'IS DISTINCT FROM 'accepted'OR f_page->'rows'IS DISTINCT FROM jsonb_build_array(f_ar->'original')OR f_tail->'rows'IS DISTINCT FROM '[]'::jsonb OR f_tail->'nextCursorId'IS DISTINCT FROM 'null'::jsonb OR f_tail->'nextCursorRecordedAt'IS DISTINCT FROM 'null'::jsonb OR(f_page->>'stateFingerprint'~'^sha256:[a-f0-9]{64}$')IS NOT TRUE OR f_tail->>'stateFingerprint'IS DISTINCT FROM f_page->>'stateFingerprint'OR f_page->>'nextCursorId'IS DISTINCT FROM f_ar#>>'{original,rootId}'OR f_page->>'nextCursorRecordedAt'IS DISTINCT FROM f_rr#>>'{original,history,0,recordedAt}'OR f_ar#>>'{original,headId}'IS NOT DISTINCT FROM f_page->>'nextCursorId'THEN RAISE EXCEPTION 'Exact root cursor/page/state/tail mismatch';END IF;
BEGIN PERFORM public.web_read_basic_care_review_page(f_t,f_c,f_v,null,null,null);RAISE EXCEPTION 'Null size accepted';EXCEPTION WHEN check_violation THEN NULL;END;
BEGIN PERFORM public.web_read_basic_care_review_page(f_t,f_c,f_v,null,(f_page->>'nextCursorId')::uuid,1);RAISE EXCEPTION 'Partial cursor accepted';EXCEPTION WHEN check_violation THEN NULL;END;
BEGIN PERFORM public.web_read_basic_care_review_page(f_t,f_c,f_v,(f_page->>'nextCursorRecordedAt')::timestamptz+interval '1 microsecond',(f_page->>'nextCursorId')::uuid,1);RAISE EXCEPTION 'Rounded root cursor accepted';EXCEPTION WHEN serialization_failure THEN NULL;END;
BEGIN PERFORM public.web_read_basic_care_review_page(f_t,f_c,f_v,(f_ar#>>'{original,history,1,recordedAt}')::timestamptz,(f_ar#>>'{original,headId}')::uuid,1);RAISE EXCEPTION 'Head cursor replaced root cursor';EXCEPTION WHEN serialization_failure THEN NULL;END;
BEGIN UPDATE public.care_tour_stops SET notes='Synthetic off-page drift'WHERE id=f_stop;f_value:=public.web_read_basic_care_review_page(f_t,f_c,f_v,null,null,1);IF f_value->>'stateFingerprint'IS NOT DISTINCT FROM f_page->>'stateFingerprint'OR f_value->'rows'IS DISTINCT FROM f_page->'rows'THEN RAISE EXCEPTION 'Native drift omitted or original rewritten';END IF;RAISE EXCEPTION USING ERRCODE='Z0002';EXCEPTION WHEN SQLSTATE 'Z0002'THEN NULL;END;
IF(SELECT count(*)FROM public.basic_care_review_events WHERE tenant_id=f_t)IS DISTINCT FROM 2 OR(SELECT count(*)FROM public.basic_care_review_receipts WHERE tenant_id=f_t)IS DISTINCT FROM 2 OR care_private.basic_care_native_sources(f_t,f_c,f_version,f_item,f_stop)IS DISTINCT FROM f_native THEN RAISE EXCEPTION 'Pages changed ledger/native data';END IF;
f_done:=true;RAISE EXCEPTION USING ERRCODE='Z0001';
EXCEPTION WHEN SQLSTATE 'Z0001'THEN NULL;END;
IF f_done IS DISTINCT FROM true OR EXISTS(SELECT 1 FROM public.tenants WHERE id=f_t)OR EXISTS(SELECT 1 FROM auth.users WHERE id IN(f_u,f_v))OR EXISTS(SELECT 1 FROM auth.sessions WHERE id IN(f_s,f_vs))OR EXISTS(SELECT 1 FROM public.roles WHERE id IN(f_r,f_vr))OR EXISTS(SELECT 1 FROM public.role_permissions WHERE role_id IN(f_r,f_vr))THEN RAISE EXCEPTION 'Own rollback incomplete';END IF;
FOREACH f_table IN ARRAY ARRAY['public.profiles','public.role_permission_sets','public.clients','public.client_module_assignments','public.care_plans','public.care_plan_versions','public.care_plan_items','public.care_tours','public.care_tour_stops','public.employees','public.employee_employment_details','public.employee_documents','public.employee_qualifications','care_private.basic_care_review_scopes','care_private.basic_care_binding_requests','public.basic_care_plan_bindings','public.basic_care_roots','public.basic_care_events','public.basic_care_receipts','public.basic_care_review_roots','public.basic_care_review_events','public.basic_care_review_receipts']LOOP
EXECUTE format('SELECT EXISTS(SELECT 1 FROM %s WHERE tenant_id=$1)',f_table)INTO f_dirty USING f_t;IF f_dirty IS DISTINCT FROM false THEN RAISE EXCEPTION 'Scoped rollback incomplete: %',f_table;END IF;
END LOOP;
PERFORM set_config('cp365.basic_review_pages_unit',jsonb_build_object('expected',jsonb_build_object('tenantId',f_t,'clientId',f_c,'authorId',f_u,'reviewerId',f_v,'createRequestId',f_care_request,'reviewRequestId',f_request,'decisionRequestId',f_accept),'packet',f_packet,'receipt',f_receipt,'reviewPacket',f_rpacket,'reviewReceipt',f_rr,'decisionPacket',f_apacket,'decisionReceipt',f_ar,'rollbackCleanupPassed',true,'reviewPagesUnit',true,'page1',f_page,'tail',f_tail)::text,true);
END
$unit$;
SELECT current_setting('cp365.basic_review_pages_unit',true)::jsonb AS synthetic_evidence;
ROLLBACK;
