-- Unit7: qualified synthetic review receipt, same profile/different Auth.
-- Base+DTO BEFORE intents/authorship. Full rollback; no real clinical, HTTP/browser,
-- concurrency or production proof.
BEGIN;
SET LOCAL statement_timeout='15s';
SET LOCAL lock_timeout='5s';
DO $unit$
DECLARE
t uuid:=gen_random_uuid();c uuid:=gen_random_uuid();u uuid:=gen_random_uuid();r uuid:=gen_random_uuid();s uuid:=gen_random_uuid();x uuid:=gen_random_uuid();xs uuid:=gen_random_uuid();
v uuid:=gen_random_uuid();vr uuid:=gen_random_uuid();vs uuid:=gen_random_uuid();emp uuid:=gen_random_uuid();doc uuid:=gen_random_uuid();qref uuid:=gen_random_uuid();qscope uuid:=gen_random_uuid();
p_ref uuid:=gen_random_uuid();ver uuid:=gen_random_uuid();item_ref uuid:=gen_random_uuid();tour_ref uuid:=gen_random_uuid();stop_ref uuid:=gen_random_uuid();bind_req uuid:=gen_random_uuid();care_req uuid:=gen_random_uuid();req uuid:=gen_random_uuid();dec_req uuid:=gen_random_uuid();
day_ref date:=(clock_timestamp()at time zone 'Europe/Berlin')::date-1;planned timestamptz;at_ref text;claims jsonb;vclaims jsonb;xclaims jsonb;native_ref jsonb;issue_packet jsonb;binding jsonb;entry_ref jsonb;packet jsonb;receipt jsonb;
rp jsonb;rr jsonb;dp jsonb;dr jsonb;dc jsonb;qvalue jsonb;tbl text;dirty boolean;done boolean:=false;relinked boolean:=false;
BEGIN
BEGIN
IF to_regclass('care_private.basic_care_binding_intents')IS NOT NULL OR to_regclass('care_private.basic_care_native_author_proofs')IS NOT NULL THEN RAISE EXCEPTION 'Baseline must precede intent/authorship';END IF;
INSERT INTO public.tenants(id,name)VALUES(t,'Synthetic Auth-relink unit');
INSERT INTO public.roles(id,key,name)VALUES(r,'synthetic_basic_u7_'||r,'Synthetic care author'),(vr,'synthetic_basic_v7_'||vr,'Synthetic reviewer');
INSERT INTO public.role_permissions(role_id,permission_key)SELECT r,unnest(ARRAY['pflege.plans.view','pflege.plans.manage','pflege.documentation.view','pflege.documentation.create']);
INSERT INTO public.role_permissions(role_id,permission_key)SELECT vr,unnest(ARRAY['pflege.plans.view','pflege.documentation.view','pflege.documentation.sign']);
INSERT INTO auth.users(id,email,raw_user_meta_data,raw_app_meta_data)VALUES(u,u||'@example.invalid','{}','{}'),(v,v||'@example.invalid','{}','{}'),(x,x||'@example.invalid','{}','{}');
UPDATE public.profiles SET tenant_id=t,role_id=r,role_key='pfleger',is_active=true,status='active',display_name='Synthetic unit author'WHERE id=u;
UPDATE public.profiles SET tenant_id=t,role_id=vr,role_key='pfleger',is_active=true,status='active',display_name='Synthetic reviewer'WHERE id=v;
INSERT INTO auth.sessions(id,user_id,not_after)VALUES(s,u,clock_timestamp()+interval '1 hour'),(vs,v,clock_timestamp()+interval '1 hour'),(xs,x,clock_timestamp()+interval '1 hour');
INSERT INTO public.clients(id,tenant_id,first_name,last_name,status,lifecycle_status)VALUES(c,t,'Synthetic','Review unit client','aktiv','aktiv');
INSERT INTO public.client_module_assignments(tenant_id,client_id,module_key,status,is_active)VALUES(t,c,'pflege','active',true);
claims:=jsonb_build_object('sub',u,'role','authenticated','session_id',s,'exp',extract(epoch from clock_timestamp()+interval '1 hour')::bigint);
vclaims:=jsonb_build_object('sub',v,'role','authenticated','session_id',vs,'exp',extract(epoch from clock_timestamp()+interval '1 hour')::bigint);
xclaims:=jsonb_build_object('sub',x,'role','authenticated','session_id',xs,'exp',extract(epoch from clock_timestamp()+interval '1 hour')::bigint);
PERFORM set_config('request.jwt.claims',claims::text,true);PERFORM care_private.basic_care_actor(t,c,u,true);
INSERT INTO public.care_plans(id,tenant_id,client_id,title,status,valid_from,valid_until)VALUES(p_ref,t,c,'Synthetic native plan','aktiv',day_ref-1,day_ref+7);
INSERT INTO public.care_plan_items(id,tenant_id,care_plan_id,category,title,intervention,status,sort_order,created_by,updated_by)VALUES(item_ref,t,p_ref,'body_care','Synthetic partial body care','Synthetic planned assistance','active',1,u,u);
INSERT INTO public.care_plan_versions(id,tenant_id,care_plan_id,version,snapshot,reason,actor_id,actor_name)
SELECT ver,t,p_ref,1,jsonb_build_object('plan',to_jsonb(p),'items',(SELECT jsonb_agg(to_jsonb(i)ORDER BY i.id)FROM public.care_plan_items i WHERE i.care_plan_id=p_ref)),'Synthetic native snapshot',u,'Synthetic unit author'FROM public.care_plans p WHERE p.id=p_ref;
INSERT INTO public.care_tours(id,tenant_id,tour_date,name,status,created_by,updated_by)VALUES(tour_ref,t,day_ref,'Synthetic native tour','published',u,u);
INSERT INTO public.care_tour_stops(id,tenant_id,tour_id,sequence_no,client_id,client_name_snapshot,planned_start,planned_end,status)VALUES(stop_ref,t,tour_ref,1,c,'Synthetic client','08:15:30.123456','08:45:30.123456','planned');
native_ref:=care_private.basic_care_native_sources(t,c,ver,item_ref,stop_ref);
planned:=(day_ref+time '08:15:30.123456')at time zone 'Europe/Berlin';at_ref:=to_char(planned at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"');
issue_packet:=jsonb_build_object('schemaVersion','1','requestId',bind_req,'tenantId',t,'clientId',c,'actorId',u,'planVersionId',ver,'measureId',item_ref,'visitId',stop_ref,'plannedAt',at_ref,'timeZone','Europe/Berlin','secondPersonRequired',false,'reason','Synthetic own selection','sources',native_ref);
binding:=public.web_issue_basic_care_binding(p_packet=>issue_packet);
entry_ref:=jsonb_build_object('kind','body_care','title',binding#>'{plan,title}','plannedAt',at_ref,'occurredAt',to_char((planned+interval '1 minute')at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),'planVersionId',ver,'measureId',item_ref,'visitId',stop_ref,'planSnapshotSha256',binding#>'{plan,planSnapshotSha256}',
'consent',jsonb_build_object('state','consented','recordedAt',to_char((planned+interval '59 seconds')at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),'statedReason','','consultation','Synthetic recorded consent'),
'assistance',jsonb_build_object('level','prompting','secondPersonRequired',false,'helpers',jsonb_build_array(u),'aids','[]'::jsonb,'technique','Synthetic assistance'),
'observation','{"baseline":"Synthetic individual situation","skin":"","mobility":"","oral":"","tolerance":"","oralAbnormality":false,"skinChange":false}'::jsonb,
'execution',jsonb_build_object('outcome','performed','bodyScope','partial','performedBy',jsonb_build_array(u),'interventions',jsonb_build_array('Synthetic documented care'),'result','Synthetic observed result','deviation',''),
'prevention','{"risk":"","professionalBasis":"","individualMeasure":"","reviewAt":null,"fallOccurred":false,"incidentId":null,"reassessmentId":null}'::jsonb,
'followUp','{"required":false,"reason":"","responsibleProfileId":null,"dueAt":null,"taskId":null,"state":"not_required","closureEvidence":""}'::jsonb,'lifecycle','completed');
packet:=jsonb_build_object('schemaVersion','1','action','create','requestId',care_req,'tenantId',t,'clientId',c,'actorId',u,'expectedHeadId',null,'expectedRevision',0,'entry',entry_ref,'reason','','original',null,'pressureOriginals',null,'fallOriginals',null);
receipt:=public.web_commit_basic_care_packet(p_packet=>packet);
IF receipt->'packet'IS DISTINCT FROM packet OR receipt#>'{original,payload}'IS DISTINCT FROM entry_ref THEN RAISE EXCEPTION 'Care receipt mismatch';END IF;
rp:=jsonb_build_object('schemaVersion','1','action','request','requestId',req,'tenantId',t,'clientId',c,'actorId',u,'occurredAt',to_char(clock_timestamp()at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),'expectedReviewHeadId',null,'expectedReviewRevision',0,'careOriginal',receipt->'original','reviewOriginal',null,'reason','Synthetic review request','requiredChange','','rationale','');
rr:=public.web_commit_basic_care_review(p_packet=>rp);
IF rr->'packet'IS DISTINCT FROM rp OR rr#>>'{original,status}'IS DISTINCT FROM 'requested'THEN RAISE EXCEPTION 'Request mismatch';END IF;
dp:=rp||jsonb_build_object('action','accept','requestId',dec_req,'actorId',v,'occurredAt',to_char(clock_timestamp()at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),'expectedReviewHeadId',rr#>'{original,headId}','expectedReviewRevision',1,'reviewOriginal',rr->'original','reason','','rationale','Synthetic independent review');
PERFORM set_config('request.jwt.claims',vclaims::text,true);PERFORM care_private.basic_care_actor(t,c,v,false);
IF auth.uid()IS DISTINCT FROM v OR public.resolve_current_profile_id()IS DISTINCT FROM v OR u=v THEN RAISE EXCEPTION 'Distinct actual reviewer missing';END IF;
INSERT INTO public.employees(id,tenant_id,profile_id,first_name,last_name,status,start_date)VALUES(emp,t,v,'Synthetic','Unit reviewer','aktiv',day_ref-30);
INSERT INTO public.employee_employment_details(tenant_id,employee_id,employment_status)VALUES(t,emp,'active');
INSERT INTO public.employee_documents(id,tenant_id,employee_id,category,title,file_name,storage_path,valid_until)VALUES(doc,t,emp,'qualification','Synthetic family credential','synthetic.pdf','synthetic-only/'||doc||'.pdf',day_ref+30);
INSERT INTO public.employee_qualifications(id,tenant_id,employee_id,qualification_type,title,issued_at,valid_until,document_id,verified_by,verified_at,status)VALUES(qref,t,emp,'synthetic_basic_care_review','Synthetic qualification',day_ref-30,day_ref+30,doc,'Synthetic provisioner',planned-interval '1 day','valid');
INSERT INTO care_private.basic_care_review_scopes(id,tenant_id,employee_id,qualification_id,kind,qualification_fingerprint,document_fingerprint,approved_by,approved_at,valid_until)
SELECT qscope,t,emp,qref,'basic_care_review',care_private.basic_care_fingerprint(to_jsonb(q)),care_private.basic_care_fingerprint(to_jsonb(d)),u,planned-interval '1 hour',clock_timestamp()+interval '1 day'FROM public.employee_qualifications q JOIN public.employee_documents d ON d.id=q.document_id WHERE q.id=qref;
qvalue:=care_private.basic_care_review_qualification(t,v);
IF qvalue->>'profileId'IS DISTINCT FROM v::text OR qvalue->>'scopeKind'IS DISTINCT FROM 'basic_care_review'OR qvalue->>'scopeId'IS DISTINCT FROM qscope::text THEN RAISE EXCEPTION 'Qualification unbound';END IF;
dp:=dp||jsonb_build_object('occurredAt',to_char(clock_timestamp()at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'));
dr:=public.web_commit_basic_care_review(p_packet=>dp);
IF dr->'packet'IS DISTINCT FROM dp OR dr#>>'{original,status}'IS DISTINCT FROM 'accepted'OR dr#>>'{original,revision}'IS DISTINCT FROM '2'OR dr#>'{original,history,1,qualificationOriginal}'IS DISTINCT FROM qvalue THEN RAISE EXCEPTION 'Acceptance mismatch';END IF;
-- The unused alternate auto-profile is removed only inside this rollback. No proof is forged.
BEGIN
DELETE FROM public.profiles WHERE id=x;
IF EXISTS(SELECT 1 FROM public.profiles WHERE id=x)THEN RAISE EXCEPTION 'Unused profile retained';END IF;
UPDATE public.profiles SET auth_user_id=x WHERE id=v AND tenant_id=t;
PERFORM set_config('request.jwt.claims',xclaims::text,true);
IF auth.uid()IS DISTINCT FROM x OR x=v OR public.resolve_current_profile_id()IS DISTINCT FROM v OR public.current_tenant_id()IS DISTINCT FROM t THEN RAISE EXCEPTION 'Alternate Auth unproven';END IF;
PERFORM care_private.basic_care_actor(t,c,v,false);
IF care_private.basic_care_has('pflege.documentation.sign')IS NOT TRUE OR care_private.basic_care_review_qualification(t,v)IS DISTINCT FROM qvalue THEN RAISE EXCEPTION 'Alternate authority not proven';END IF;
BEGIN PERFORM public.web_commit_basic_care_review(dp);RAISE EXCEPTION 'Different Auth replay accepted';EXCEPTION WHEN serialization_failure THEN NULL;END;
BEGIN PERFORM public.web_confirm_basic_care_review(t,c,v,dec_req,dp);RAISE EXCEPTION 'Different Auth confirmed';EXCEPTION WHEN SQLSTATE 'P0F02'THEN NULL;END;
relinked:=true;RAISE EXCEPTION USING ERRCODE='Z0002';
EXCEPTION WHEN SQLSTATE 'Z0002'THEN NULL;END;
IF relinked IS DISTINCT FROM true THEN RAISE EXCEPTION 'Relink not tested';END IF;
PERFORM set_config('request.jwt.claims',vclaims::text,true);
IF auth.uid()IS DISTINCT FROM v OR public.resolve_current_profile_id()IS DISTINCT FROM v OR NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=x)THEN RAISE EXCEPTION 'Account rollback failed';END IF;
PERFORM care_private.basic_care_actor(t,c,v,false);
IF public.web_commit_basic_care_review(dp)IS DISTINCT FROM dr THEN RAISE EXCEPTION 'Own replay changed';END IF;
dc:=public.web_confirm_basic_care_review(t,c,v,dec_req,dp);
IF dc IS DISTINCT FROM dr THEN RAISE EXCEPTION 'Own confirmation changed';END IF;
IF(SELECT count(*)FROM public.basic_care_events WHERE tenant_id=t)IS DISTINCT FROM 1 OR(SELECT count(*)FROM public.basic_care_review_roots WHERE tenant_id=t)IS DISTINCT FROM 1 OR(SELECT count(*)FROM public.basic_care_review_events WHERE tenant_id=t)IS DISTINCT FROM 2 OR(SELECT count(*)FROM public.basic_care_review_receipts WHERE tenant_id=t)IS DISTINCT FROM 2 OR care_private.basic_care_native_sources(t,c,ver,item_ref,stop_ref)IS DISTINCT FROM native_ref THEN RAISE EXCEPTION 'Counts/native drift';END IF;
done:=true;RAISE EXCEPTION USING ERRCODE='Z0001';
EXCEPTION WHEN SQLSTATE 'Z0001'THEN NULL;END;
IF done IS DISTINCT FROM true OR EXISTS(SELECT 1 FROM public.tenants WHERE id=t)OR EXISTS(SELECT 1 FROM public.profiles WHERE id IN(u,v,x))OR EXISTS(SELECT 1 FROM auth.users WHERE id IN(u,v,x))OR EXISTS(SELECT 1 FROM auth.sessions WHERE id IN(s,vs,xs))OR EXISTS(SELECT 1 FROM public.roles WHERE id IN(r,vr))OR EXISTS(SELECT 1 FROM public.role_permissions WHERE role_id IN(r,vr))THEN RAISE EXCEPTION 'Own/Auth rollback incomplete';END IF;
FOREACH tbl IN ARRAY ARRAY['public.profiles','public.role_permission_sets','public.clients','public.client_module_assignments','public.care_plans','public.care_plan_versions','public.care_plan_items','public.care_tours','public.care_tour_stops','public.employees','public.employee_employment_details','public.employee_documents','public.employee_qualifications','care_private.basic_care_review_scopes','care_private.basic_care_binding_requests','public.basic_care_plan_bindings','public.basic_care_roots','public.basic_care_events','public.basic_care_receipts','public.basic_care_review_roots','public.basic_care_review_events','public.basic_care_review_receipts']LOOP
EXECUTE format('SELECT EXISTS(SELECT 1 FROM %s WHERE tenant_id=$1)',tbl)INTO dirty USING t;IF dirty IS DISTINCT FROM false THEN RAISE EXCEPTION 'Rollback incomplete: %',tbl;END IF;
END LOOP;
PERFORM set_config('cp365.basic_review_auth_relink_unit',jsonb_build_object('expected',jsonb_build_object('tenantId',t,'clientId',c,'authorId',u,'reviewerId',v,'createRequestId',care_req,'reviewRequestId',req,'decisionRequestId',dec_req),'packet',packet,'receipt',receipt,'reviewPacket',rp,'reviewReceipt',rr,'decisionPacket',dp,'decisionReceipt',dr,'decisionConfirmedReceipt',dc,'rollbackCleanupPassed',true,'supplementaryReviewAuthRelinkUnit',true,'sameProfileDifferentAuthQualified',relinked,'differentAuthReplayDenied',true,'differentAuthConfirmDenied',true)::text,true);
END
$unit$;
SELECT current_setting('cp365.basic_review_auth_relink_unit',true)::jsonb AS synthetic_evidence;
ROLLBACK;
