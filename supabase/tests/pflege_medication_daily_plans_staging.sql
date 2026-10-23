-- Staging only. Real private SQL functions with synthetic Auth claims/sessions.
-- No application grants, HTTP login, parallel-transaction or clinical-approval claim.
-- Every fixture and negative-case mutation is rolled back; cleanup is asserted.
DO $test$
DECLARE
 t uuid:=gen_random_uuid();u uuid:=gen_random_uuid();s uuid:=gen_random_uuid();r uuid:=gen_random_uuid();
 reviewer uuid:=gen_random_uuid();review_session uuid:=gen_random_uuid();review_role uuid:=gen_random_uuid();
 c uuid:=gen_random_uuid();med uuid:=gen_random_uuid();doc uuid:=gen_random_uuid();src uuid;arc uuid;
 source_req uuid:=gen_random_uuid();authorization_id_value uuid:=gen_random_uuid();revision uuid;application uuid;
 plan1 uuid;plan2 uuid;entry1 uuid:=gen_random_uuid();entry2 uuid:=gen_random_uuid();request1 uuid;request2 uuid;withdraw_request uuid;
 original_request uuid:=gen_random_uuid();second_request uuid:=gen_random_uuid();review_req1 uuid:=gen_random_uuid();review_req2 uuid:=gen_random_uuid();
 approve_req1 uuid:=gen_random_uuid();approve_req2 uuid:=gen_random_uuid();withdraw_req uuid:=gen_random_uuid();withdraw_approve uuid:=gen_random_uuid();
 prior_actual uuid:=gen_random_uuid();next_actual uuid:=gen_random_uuid();boundary_actual uuid:=gen_random_uuid();
 claims jsonb;review_claims jsonb;native jsonb;document jsonb;candidate jsonb;source_packet jsonb;proof jsonb;worker_packet jsonb;
 proposal jsonb;apply_packet jsonb;plan_packet jsonb;plan_packet2 jsonb;auth_packet jsonb;withdraw_packet jsonb;assessment_packet jsonb;
 value jsonb;regular_packet jsonb;regular_assessment jsonb;prn_assessment jsonb;prn_context jsonb;original_plan jsonb;first_review jsonb;second_review jsonb;before_page jsonb;after_page jsonb;page2 jsonb;context_before jsonb;context_after jsonb;
 plan_row care_private.medication_daily_plans%rowtype;request_row care_private.medication_daily_plan_review_requests%rowtype;
 message text;bad jsonb;actual_at timestamptz;regular_at timestamptz;today date:=(clock_timestamp() at time zone 'Europe/Berlin')::date;
 sha text:='ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad';passed boolean:=false;
BEGIN
 BEGIN
  INSERT INTO public.tenants(id,name) VALUES(t,'CP365 daily-plan isolated fixture');
  INSERT INTO public.roles(id,key,name) VALUES(r,'cp365_plan_'||r,'Daily-plan creator fixture'),(review_role,'cp365_review_'||review_role,'Daily-plan reviewer fixture');
  INSERT INTO public.role_permissions(role_id,permission_key) SELECT role_ids.role_id,required_permissions.permission_key FROM unnest(ARRAY[r,review_role]) AS role_ids(role_id) CROSS JOIN unnest(ARRAY['pflege.medications.view','pflege.medications.manage','pflege.medications.administer','office.documents.view','office.clients.view_sensitive','pflege.documentation.sign']) AS required_permissions(permission_key);
  INSERT INTO auth.users(id,email,raw_user_meta_data,raw_app_meta_data) VALUES(u,u||'@example.invalid','{}','{}'),(reviewer,reviewer||'@example.invalid','{}','{}');
  UPDATE public.profiles SET tenant_id=t,role_id=r,role_key='pfleger',is_active=true,status='active',display_name='Synthetic plan creator' WHERE id=u;
  UPDATE public.profiles SET tenant_id=t,role_id=review_role,role_key='pfleger',is_active=true,status='active',display_name='Synthetic independent reviewer' WHERE id=reviewer;
  INSERT INTO auth.sessions(id,user_id,not_after) VALUES(s,u,clock_timestamp()+interval '1 hour'),(review_session,reviewer,clock_timestamp()+interval '1 hour');
  INSERT INTO public.clients(id,tenant_id,first_name,last_name,status) VALUES(c,t,'CP365','Plan fixture','aktiv');
  INSERT INTO public.client_module_assignments(tenant_id,client_id,module_key,status,is_active) VALUES(t,c,'pflege','active',true);
  INSERT INTO public.medications(id,tenant_id,client_id,name,status,is_prn) VALUES(med,t,c,'Incomplete original','active',null);
  claims:=jsonb_build_object('sub',u,'role','authenticated','session_id',s,'exp',extract(epoch from clock_timestamp()+interval '1 hour')::bigint);
  review_claims:=jsonb_build_object('sub',reviewer,'role','authenticated','session_id',review_session,'exp',extract(epoch from clock_timestamp()+interval '1 hour')::bigint);
  PERFORM set_config('request.jwt.claims',claims::text,true);
  INSERT INTO public.client_documents(id,tenant_id,client_id,title,file_name,mime_type,storage_path,size_bytes) VALUES(doc,t,c,'Synthetic original prescription','original.pdf','application/pdf','tenant/'||t||'/clients/'||c||'/documents/original.pdf',3);
  SELECT to_jsonb(m) INTO native FROM public.medications m WHERE m.id=med;
  SELECT to_jsonb(d) INTO document FROM public.client_documents d WHERE d.id=doc;
  source_packet:=jsonb_build_object('documentId',doc,'documentUpdatedAt',document->'updated_at','expectedUpdatedAt',native->'updated_at','reason','Synthetic source preserving incomplete native facts','contentSha256',sha,'contentSize',3);
  src:=care_private.capture_medication_source(med,source_req,source_packet);proof:=care_private.prepare_medication_source_proof(src);
  worker_packet:=jsonb_build_object('schemaVersion',1,'requestId',gen_random_uuid(),'record',(proof-'archiveId'-'verificationState')||jsonb_build_object('archivePath','tenant/'||t||'/clients/'||c||'/medication-sources/'||src||'/'||sha||'.bin'),'caller',claims,'verifiedSha256',sha,'verifiedSize',3);
  PERFORM set_config('request.jwt.claims','{"role":"service_role"}',true);arc:=care_private.commit_medication_source_proof(worker_packet);PERFORM set_config('request.jwt.claims',claims::text,true);
  candidate:=jsonb_build_object('medicationName','Synthetic medicine','activeIngredient','Original ingredient','strength','500 mg','form','Tablette','dose','1.000','unit','Tablette','route','oral','prescriber','Documented original prescriber','validFrom',(today-30)::text,'validUntil',null,'indication','Documented original indication','isPrn',false,'minimumIntervalMinutes',null,'maximumDose',null,'maximumDoseUnit','','maximumPeriodHours',null);
  proposal:=jsonb_build_object('schemaVersion',1,'requestId',gen_random_uuid(),'tenantId',t,'clientId',c,'medicationId',med,'actorId',u,'expectedUpdatedAt',native->'updated_at','sourceId',src,'reason','Explicit synthetic transcription from retained archive','order',candidate);
  value:=care_private.propose_medication_order_revision(proposal);revision:=(value->>'id')::uuid;
  -- Privileged synthetic seed only: independently tested review-issuing workflow has its own fixture.
  INSERT INTO care_private.medication_order_review_authorizations(id,tenant_id,revision_id,actor_id,session_id,reviewed_by,review_reference,proposal_fingerprint,native_before_fingerprint,source_fingerprint,archive_fingerprint,expires_at)
   SELECT authorization_id_value,t,z.id,u,s,reviewer,'Synthetic independent original check',care_private.medication_json_fingerprint(to_jsonb(z)),care_private.medication_json_fingerprint(z.before_snapshot),care_private.medication_json_fingerprint(z.source_snapshot),care_private.medication_json_fingerprint(z.archive_snapshot),clock_timestamp()+interval '1 hour' FROM care_private.medication_order_revisions z WHERE z.id=revision;
  apply_packet:=jsonb_build_object('requestId',gen_random_uuid(),'revisionId',revision,'authorizationId',authorization_id_value,'reason','Explicit synthetic technical transcription');
  value:=care_private.apply_medication_order_revision(apply_packet);application:=(value->>'id')::uuid;native:=value->'after_snapshot';
  IF care_private.current_medication_order_application(t,c,med)->>'id' IS DISTINCT FROM application::text THEN RAISE EXCEPTION 'Native application binding missing';END IF;

  context_before:=care_private.read_medication_daily_plan_context(med);
  IF context_before->'order' IS DISTINCT FROM native OR context_before#>>'{orderApplication,id}' IS DISTINCT FROM application::text OR context_before->>'ledgerFingerprint'!~'^sha256:[0-9a-f]{64}$' THEN RAISE EXCEPTION 'Plan context lost exact native/source binding';END IF;
  plan_packet:=jsonb_build_object('schemaVersion',1,'requestId',original_request,'tenantId',t,'clientId',c,'medicationId',med,'actorId',u,'expectedUpdatedAt',native->'updated_at','orderApplicationId',application,'sourceId',src,'reason','Explicit two-window regular medication plan','effectiveFrom',(today-1)::text,'effectiveUntil',null,'timezone','Europe/Berlin','entries',jsonb_build_array(jsonb_build_object('id',entry1,'time','08:00','dose','1.000','unit','Tablette','route','oral'),jsonb_build_object('id',entry2,'time','20:00','dose','1.000','unit','Tablette','route','oral')));
  original_plan:=care_private.propose_medication_daily_plan(plan_packet);plan1:=(original_plan->>'id')::uuid;
  IF original_plan->>'state' IS DISTINCT FROM 'proposed' OR original_plan->'authorization' IS DISTINCT FROM 'null'::jsonb OR original_plan->'native_snapshot' IS DISTINCT FROM native OR original_plan->'entries' IS DISTINCT FROM plan_packet->'entries' OR original_plan::text LIKE '%creator_session_id%' OR original_plan::text LIKE '%'||s||'%' THEN RAISE EXCEPTION 'Proposal omitted original facts, invented authorization or exposed session';END IF;
  IF care_private.propose_medication_daily_plan(plan_packet) IS DISTINCT FROM original_plan OR care_private.confirm_medication_daily_plan(plan1,original_request) IS DISTINCT FROM original_plan THEN RAISE EXCEPTION 'Plan proposal/own confirmation replay differs';END IF;
  IF (SELECT to_jsonb(m) FROM public.medications m WHERE m.id=med) IS DISTINCT FROM native OR EXISTS(SELECT 1 FROM public.medication_administrations WHERE tenant_id=t) THEN RAISE EXCEPTION 'Plan proposal changed native medication or created an actual';END IF;
  BEGIN PERFORM care_private.propose_medication_daily_plan(jsonb_set(plan_packet,'{reason}','"Conflicting reused original request"'));RAISE EXCEPTION 'Conflicting plan retry accepted';EXCEPTION WHEN check_violation THEN NULL;END;
  BEGIN PERFORM care_private.propose_medication_daily_plan(plan_packet||jsonb_build_object('requestId',gen_random_uuid(),'sourceId',gen_random_uuid()));RAISE EXCEPTION 'Foreign archived source accepted';EXCEPTION WHEN check_violation THEN NULL;END;
  BEGIN PERFORM care_private.propose_medication_daily_plan(jsonb_set(plan_packet||jsonb_build_object('requestId',gen_random_uuid()),'{entries,0,dose}','"1"'));RAISE EXCEPTION 'Raw original decimal silently normalized';EXCEPTION WHEN check_violation THEN NULL;END;
  BEGIN PERFORM care_private.propose_medication_daily_plan(jsonb_set(plan_packet||jsonb_build_object('requestId',gen_random_uuid()),'{entries,1,time}','"08:00"'));RAISE EXCEPTION 'Duplicate daily time accepted';EXCEPTION WHEN check_violation THEN NULL;END;
  BEGIN UPDATE public.medications SET dosage='Unrelated concurrent native edit' WHERE id=med;PERFORM care_private.propose_medication_daily_plan(plan_packet||jsonb_build_object('requestId',gen_random_uuid()));RAISE EXCEPTION 'Full native application drift accepted';EXCEPTION WHEN check_violation THEN NULL;END;
  first_review:=care_private.request_medication_daily_plan_review(plan1,review_req1);request1:=(first_review#>>'{request,id}')::uuid;
  IF first_review->>'state' IS DISTINCT FROM 'pending' OR first_review->'canReview' IS DISTINCT FROM 'false'::jsonb OR care_private.confirm_medication_daily_plan_review_request(request1,review_req1) IS DISTINCT FROM first_review OR care_private.request_medication_daily_plan_review(plan1,review_req1) IS DISTINCT FROM first_review THEN RAISE EXCEPTION 'Own pending review request/confirmation mismatch';END IF;
  auth_packet:=jsonb_build_object('planId',plan1,'reviewRequestId',request1,'requestId',approve_req1,'reviewReference','Separate explicit original and plan check','expectedReviewFingerprint',first_review->>'reviewFingerprint');
  BEGIN PERFORM care_private.authorize_medication_daily_plan(auth_packet);RAISE EXCEPTION 'Plan creator self-approved';EXCEPTION WHEN insufficient_privilege THEN GET STACKED DIAGNOSTICS message=MESSAGE_TEXT;IF message NOT LIKE 'Anfrage und unabhängige Prüfung%' THEN RAISE EXCEPTION 'Self-review case failed before distinct-actor guard: %',message;END IF;END;

  -- The newest review stays unchanged while an older off-page review is decided.
  plan_packet2:=plan_packet||jsonb_build_object('requestId',second_request,'effectiveFrom',(today+1)::text,'reason','Explicit replacement plan after prospective termination');
  value:=care_private.propose_medication_daily_plan(plan_packet2);plan2:=(value->>'id')::uuid;
  second_review:=care_private.request_medication_daily_plan_review(plan2,review_req2);request2:=(second_review#>>'{request,id}')::uuid;
  before_page:=care_private.read_medication_daily_plans(med,null,null,1);page2:=care_private.read_medication_daily_plans(med,(before_page#>>'{nextCursor,at}')::timestamptz,(before_page#>>'{nextCursor,id}')::uuid,1);
  IF jsonb_array_length(before_page->'items') IS DISTINCT FROM 1 OR jsonb_array_length(page2->'items') IS DISTINCT FROM 1 OR before_page#>>'{items,0,id}'=page2#>>'{items,0,id}' OR page2->'nextCursor' IS DISTINCT FROM 'null'::jsonb OR before_page->'ledgerFingerprint' IS DISTINCT FROM page2->'ledgerFingerprint' THEN RAISE EXCEPTION 'Plan pagination omitted original or ledger identity';END IF;
  BEGIN PERFORM care_private.read_medication_daily_plans(med,clock_timestamp(),gen_random_uuid(),1);RAISE EXCEPTION 'Foreign plan cursor accepted';EXCEPTION WHEN check_violation THEN NULL;END;
  BEGIN PERFORM care_private.read_medication_daily_plans(med,null,plan1,1);RAISE EXCEPTION 'Partial plan cursor accepted';EXCEPTION WHEN check_violation THEN NULL;END;
  PERFORM set_config('request.jwt.claims',review_claims::text,true);
  first_review:=care_private.medication_daily_plan_review_json(request1);
  IF first_review->'canReview' IS DISTINCT FROM 'true'::jsonb THEN RAISE EXCEPTION 'Distinct active reviewer could not inspect pending plan';END IF;
  auth_packet:=auth_packet||jsonb_build_object('expectedReviewFingerprint',first_review->>'reviewFingerprint');
  BEGIN UPDATE auth.sessions SET not_after=clock_timestamp()-interval '1 minute' WHERE id=s;value:=care_private.medication_daily_plan_review_json(request1);IF value->'canReview' IS DISTINCT FROM 'false'::jsonb THEN RAISE EXCEPTION 'Ended creator session still reviewable';END IF;PERFORM care_private.authorize_medication_daily_plan(auth_packet);RAISE EXCEPTION 'Ended creator session authorized plan';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
  BEGIN DELETE FROM public.role_permissions WHERE role_id=r AND permission_key='pflege.medications.manage';value:=care_private.medication_daily_plan_review_json(request1);IF value->'canReview' IS DISTINCT FROM 'false'::jsonb THEN RAISE EXCEPTION 'Creator source-right loss still reviewable';END IF;PERFORM care_private.authorize_medication_daily_plan(auth_packet);RAISE EXCEPTION 'Creator source-right loss authorized plan';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
  BEGIN DELETE FROM public.role_permissions WHERE role_id=review_role AND permission_key='pflege.documentation.sign';PERFORM care_private.authorize_medication_daily_plan(auth_packet);RAISE EXCEPTION 'Reviewer sign-right loss authorized plan';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
  BEGIN UPDATE public.medications SET dosage='Concurrent native row drift' WHERE id=med;PERFORM care_private.authorize_medication_daily_plan(auth_packet);RAISE EXCEPTION 'Native plan snapshot drift authorized';EXCEPTION WHEN check_violation THEN NULL;END;
  BEGIN UPDATE public.medication_source_archives SET content_size=4 WHERE id=arc;PERFORM care_private.authorize_medication_daily_plan(auth_packet);RAISE EXCEPTION 'Archive drift authorized plan';EXCEPTION WHEN check_violation THEN NULL;END;
  BEGIN PERFORM care_private.authorize_medication_daily_plan(auth_packet||jsonb_build_object('expectedReviewFingerprint','sha256:'||repeat('0',64)));RAISE EXCEPTION 'Stale review fingerprint authorized';EXCEPTION WHEN check_violation THEN NULL;END;
  SELECT q.* INTO request_row FROM care_private.medication_daily_plan_review_requests q WHERE q.id=request1;
  BEGIN
   INSERT INTO care_private.medication_daily_plan_review_requests(tenant_id,plan_id,request_id,actor_id,creator_session_id,action,plan_fingerprint,recorded_at,expires_at) VALUES(t,plan1,gen_random_uuid(),u,s,'authorize',request_row.plan_fingerprint,clock_timestamp()-interval '2 hours',clock_timestamp()-interval '1 hour') RETURNING id INTO withdraw_request;
   value:=care_private.medication_daily_plan_review_json(withdraw_request);IF value->>'state' IS DISTINCT FROM 'expired' OR value->'canReview' IS DISTINCT FROM 'false'::jsonb THEN RAISE EXCEPTION 'Expired review projected current';END IF;
   PERFORM care_private.authorize_medication_daily_plan(auth_packet||jsonb_build_object('reviewRequestId',withdraw_request,'expectedReviewFingerprint',value->>'reviewFingerprint'));RAISE EXCEPTION 'Expired plan review authorized';
  EXCEPTION WHEN insufficient_privilege THEN NULL;END;
  before_page:=care_private.read_medication_daily_plan_reviews(med,null,null,1);
  value:=care_private.authorize_medication_daily_plan(auth_packet);
  IF value->>'state' IS DISTINCT FROM 'authorized' OR value#>>'{authorization,reviewed_by}' IS DISTINCT FROM reviewer::text OR value->'native_snapshot' IS DISTINCT FROM native THEN RAISE EXCEPTION 'Authorized plan lost independent original';END IF;
  authorization_id_value:=(value#>>'{authorization,id}')::uuid;
  IF care_private.authorize_medication_daily_plan(auth_packet) IS DISTINCT FROM value OR care_private.confirm_medication_daily_plan_authorization(authorization_id_value,approve_req1) IS DISTINCT FROM value THEN RAISE EXCEPTION 'Own plan authorization replay mismatch';END IF;
  after_page:=care_private.read_medication_daily_plan_reviews(med,null,null,1);
  IF before_page->'items' IS DISTINCT FROM after_page->'items' OR before_page->'ledgerFingerprint' IS NOT DISTINCT FROM after_page->'ledgerFingerprint' THEN RAISE EXCEPTION 'Off-page review decision failed complete-ledger change detection';END IF;
  BEGIN PERFORM care_private.confirm_medication_daily_plan_review_request(request1,review_req1);RAISE EXCEPTION 'Reviewer confirmed creator request as own';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
  BEGIN PERFORM care_private.authorize_medication_daily_plan(auth_packet||jsonb_build_object('reviewReference','Different same-request review text'));RAISE EXCEPTION 'Conflicting authorization retry accepted';EXCEPTION WHEN check_violation THEN NULL;END;
  second_review:=care_private.medication_daily_plan_review_json(request2);
  BEGIN PERFORM care_private.authorize_medication_daily_plan(jsonb_build_object('planId',plan2,'reviewRequestId',request2,'requestId',approve_req2,'reviewReference','Independent overlapping-plan original check','expectedReviewFingerprint',second_review->>'reviewFingerprint'));RAISE EXCEPTION 'Overlapping authorized daily plans accepted';EXCEPTION WHEN check_violation THEN GET STACKED DIAGNOSTICS message=MESSAGE_TEXT;IF message NOT LIKE 'Für diesen Zeitraum%' THEN RAISE EXCEPTION 'Overlap case failed before intended guard: %',message;END IF;END;

  PERFORM set_config('request.jwt.claims',claims::text,true);
  regular_at:=((today-1)::text||' 08:00:00')::timestamp at time zone 'Europe/Berlin';
  assessment_packet:=jsonb_build_object('schemaVersion',1,'requestId',gen_random_uuid(),'tenantId',t,'clientId',c,'medicationId',med,'actorId',u,'expectedUpdatedAt',native->'updated_at','orderApplicationId',application,'kind','regular','planId',plan1,'entryId',entry1,'occurredAt',regular_at,'actualDose','1.000','unit','Tablette','route','oral','prnIndication','');
  value:=care_private.assess_medication_execution(assessment_packet);
  IF value->>'state' IS DISTINCT FROM 'blocked' OR value->'executionAllowed' IS DISTINCT FROM 'false'::jsonb OR value#>'{checks,slotMatched}' IS DISTINCT FROM 'true'::jsonb OR value#>'{checks,historyComplete}' IS DISTINCT FROM 'true'::jsonb OR NOT(value->'violations'?'legacy_execution_writers_unclosed') OR NOT(value->'violations'?'clinical_execution_acceptance_unproven') OR value->>'fingerprint' IS DISTINCT FROM care_private.medication_json_fingerprint(value-'fingerprint') THEN RAISE EXCEPTION 'Regular assessment invented execution permission or lost exact plan binding';END IF;
  regular_packet:=assessment_packet;regular_assessment:=value;
  BEGIN PERFORM care_private.commit_medication_execution(assessment_packet);RAISE EXCEPTION 'Assessment-only path executed an administration';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
  value:=care_private.assess_medication_execution(assessment_packet||jsonb_build_object('occurredAt',regular_at-interval '1 day'));
  IF value#>'{checks,slotMatched}' IS DISTINCT FROM 'false'::jsonb OR NOT(value->'violations'?'regular_plan_slot_not_confirmed') THEN RAISE EXCEPTION 'Regular plan extended beyond explicit effective dates';END IF;
  withdraw_packet:=jsonb_build_object('planId',plan1,'requestId',withdraw_req,'effectiveFrom',(today+1)::text,'reason','Prospective termination preserves every earlier plan position');
  BEGIN PERFORM care_private.request_medication_daily_plan_withdrawal(withdraw_packet||jsonb_build_object('effectiveFrom',today::text));RAISE EXCEPTION 'Today/past plan withdrawal accepted';EXCEPTION WHEN check_violation THEN NULL;END;
  value:=care_private.request_medication_daily_plan_withdrawal(withdraw_packet);withdraw_request:=(value#>>'{request,id}')::uuid;
  IF value#>>'{request,action}' IS DISTINCT FROM 'withdraw' OR care_private.confirm_medication_daily_plan_review_request(withdraw_request,withdraw_req) IS DISTINCT FROM value OR care_private.request_medication_daily_plan_withdrawal(withdraw_packet) IS DISTINCT FROM value THEN RAISE EXCEPTION 'Prospective withdrawal request/replay mismatch';END IF;
  PERFORM set_config('request.jwt.claims',review_claims::text,true);
  value:=care_private.medication_daily_plan_review_json(withdraw_request);
  auth_packet:=jsonb_build_object('planId',plan1,'reviewRequestId',withdraw_request,'requestId',withdraw_approve,'reviewReference','Independent prospective termination check','expectedReviewFingerprint',value->>'reviewFingerprint');
  value:=care_private.authorize_medication_daily_plan(auth_packet);
  IF value#>>'{withdrawal,effective_from}' IS DISTINCT FROM (today+1)::text OR value#>>'{withdrawal,reason}' IS DISTINCT FROM withdraw_packet->>'reason' OR value->'entries' IS DISTINCT FROM original_plan->'entries' OR value->'native_snapshot' IS DISTINCT FROM native THEN RAISE EXCEPTION 'Withdrawal rewrote original plan/history';END IF;
  IF care_private.authorize_medication_daily_plan(auth_packet) IS DISTINCT FROM value OR care_private.confirm_medication_daily_plan_authorization((value#>>'{withdrawal,id}')::uuid,withdraw_approve) IS DISTINCT FROM value THEN RAISE EXCEPTION 'Own withdrawal confirmation/replay mismatch';END IF;
  second_review:=care_private.medication_daily_plan_review_json(request2);
  value:=care_private.authorize_medication_daily_plan(jsonb_build_object('planId',plan2,'reviewRequestId',request2,'requestId',approve_req2,'reviewReference','Independent non-overlapping replacement-plan check','expectedReviewFingerprint',second_review->>'reviewFingerprint'));
  IF value->>'state' IS DISTINCT FROM 'authorized' OR value->>'effective_from' IS DISTINCT FROM (today+1)::text OR value->'withdrawal' IS DISTINCT FROM 'null'::jsonb THEN RAISE EXCEPTION 'Prospective replacement plan not authorized';END IF;
  PERFORM set_config('request.jwt.claims',claims::text,true);
  value:=care_private.assess_medication_execution(assessment_packet);IF value#>'{checks,slotMatched}' IS DISTINCT FROM 'true'::jsonb THEN RAISE EXCEPTION 'Withdrawal erased earlier historical plan position';END IF;
  BEGIN UPDATE care_private.medication_daily_plans SET reason='Changed' WHERE id=plan1;RAISE EXCEPTION 'Plan original mutable';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
  BEGIN DELETE FROM care_private.medication_daily_plan_review_requests WHERE id=request1;RAISE EXCEPTION 'Review request history deletable';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
  BEGIN UPDATE care_private.medication_daily_plan_authorizations SET review_reference='Changed' WHERE plan_id=plan1;RAISE EXCEPTION 'Plan authorization mutable';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
  BEGIN DELETE FROM care_private.medication_daily_plan_withdrawals WHERE plan_id=plan1;RAISE EXCEPTION 'Withdrawal history deletable';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
  BEGIN PERFORM care_private.read_medication_daily_plan_reviews(med,clock_timestamp(),gen_random_uuid(),1);RAISE EXCEPTION 'Foreign review cursor accepted';EXCEPTION WHEN check_violation THEN NULL;END;
  BEGIN UPDATE auth.sessions SET not_after=clock_timestamp()-interval '1 minute' WHERE id=s;PERFORM care_private.confirm_medication_daily_plan(plan1,original_request);RAISE EXCEPTION 'Ended own session read plan';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
  BEGIN DELETE FROM public.role_permissions WHERE role_id=r AND permission_key='pflege.medications.manage';PERFORM care_private.confirm_medication_daily_plan(plan1,original_request);RAISE EXCEPTION 'Revoked own role read plan';EXCEPTION WHEN insufficient_privilege THEN NULL;END;

  -- An explicitly transcribed PRN revision is a new immutable native binding.
  -- Earlier regular-plan originals stay retained, never transformed into PRN facts.
  candidate:=candidate||jsonb_build_object('dose','0.100','isPrn',true,'minimumIntervalMinutes','30','maximumDose','0.300','maximumDoseUnit','Tablette','maximumPeriodHours','2.000');
  proposal:=proposal||jsonb_build_object('requestId',gen_random_uuid(),'expectedUpdatedAt',native->'updated_at','order',candidate,'reason','Explicit synthetic PRN prescription transcription');
  value:=care_private.propose_medication_order_revision(proposal);revision:=(value->>'id')::uuid;authorization_id_value:=gen_random_uuid();
  INSERT INTO care_private.medication_order_review_authorizations(id,tenant_id,revision_id,actor_id,session_id,reviewed_by,review_reference,proposal_fingerprint,native_before_fingerprint,source_fingerprint,archive_fingerprint,expires_at)
   SELECT authorization_id_value,t,z.id,u,s,reviewer,'Synthetic independent PRN original check',care_private.medication_json_fingerprint(to_jsonb(z)),care_private.medication_json_fingerprint(z.before_snapshot),care_private.medication_json_fingerprint(z.source_snapshot),care_private.medication_json_fingerprint(z.archive_snapshot),clock_timestamp()+interval '1 hour' FROM care_private.medication_order_revisions z WHERE z.id=revision;
  value:=care_private.apply_medication_order_revision(jsonb_build_object('requestId',gen_random_uuid(),'revisionId',revision,'authorizationId',authorization_id_value,'reason','Explicit synthetic PRN technical transcription'));application:=(value->>'id')::uuid;native:=value->'after_snapshot';
  actual_at:=date_trunc('second',clock_timestamp())-interval '12 hours'+interval '0.123456 seconds';
  INSERT INTO public.medication_administrations(id,tenant_id,medication_id,client_id,status,administered_at,occurred_at,administered_dose,route,administered_by,creation_payload,prn_reason) VALUES
   (prior_actual,t,med,c,'administered',actual_at-interval '2 hours',actual_at-interval '2 hours','0.100','oral',u,'{"unit":"Tablette"}','Synthetic observed PRN reason'),
   (next_actual,t,med,c,'administered',actual_at+interval '30 minutes',actual_at+interval '30 minutes','0.100','oral',u,'{"unit":"Tablette"}','Synthetic observed PRN reason'),
   (boundary_actual,t,med,c,'administered',actual_at+interval '2 hours',actual_at+interval '2 hours','0.100','oral',u,'{"unit":"Tablette"}','Synthetic observed PRN reason');
  assessment_packet:=jsonb_build_object('schemaVersion',1,'requestId',gen_random_uuid(),'tenantId',t,'clientId',c,'medicationId',med,'actorId',u,'expectedUpdatedAt',native->'updated_at','orderApplicationId',application,'kind','prn','planId',null,'entryId',null,'occurredAt',actual_at,'actualDose','0.100','unit','Tablette','route','oral','prnIndication','Explicit observed PRN indication');
  value:=care_private.assess_medication_execution(assessment_packet);
  IF value#>'{checks,historyComplete}' IS DISTINCT FROM 'true'::jsonb OR value#>'{checks,intervalSatisfied}' IS DISTINCT FROM 'true'::jsonb OR value#>'{checks,cumulativeSatisfied}' IS DISTINCT FROM 'true'::jsonb OR (value#>>'{checks,rollingDose}')::numeric IS DISTINCT FROM 0.200 OR (value#>>'{checks,maximumObservedWindowDose}')::numeric IS DISTINCT FROM 0.300 OR value#>>'{checks,precedingActualId}' IS DISTINCT FROM prior_actual::text OR value#>>'{checks,followingActualId}' IS DISTINCT FROM next_actual::text OR value#>>'{checks,intervalBeforeMicroseconds}' IS DISTINCT FROM '7200000000' OR value#>>'{checks,intervalAfterMicroseconds}' IS DISTINCT FROM '1800000000' OR jsonb_array_length(value->'actuals') IS DISTINCT FROM 3 OR value->'executionAllowed' IS DISTINCT FROM 'false'::jsonb THEN RAISE EXCEPTION 'Exact inclusive PRN windows, following actual or decimal arithmetic failed';END IF;
  prn_assessment:=value;prn_context:=care_private.read_medication_daily_plan_context(med);
  BEGIN
   INSERT INTO public.medication_administrations(tenant_id,medication_id,client_id,status,administered_at,occurred_at,administered_dose,route,administered_by,creation_payload,prn_reason) VALUES(t,med,c,'administered',actual_at+interval '30 minutes'-interval '1 microsecond',actual_at+interval '30 minutes'-interval '1 microsecond','0.100','oral',u,'{"unit":"Tablette"}','Synthetic observed PRN reason');
   value:=care_private.assess_medication_execution(assessment_packet);IF value#>'{checks,intervalSatisfied}' IS DISTINCT FROM 'false'::jsonb OR value#>>'{checks,intervalAfterMicroseconds}' IS DISTINCT FROM '1799999999' OR NOT(value->'violations'?'minimum_interval_not_satisfied') THEN RAISE EXCEPTION 'One-microsecond short PRN interval accepted';END IF;
   RAISE EXCEPTION USING ERRCODE='Z0002';
  EXCEPTION WHEN SQLSTATE 'Z0002' THEN NULL;END;
  BEGIN
   INSERT INTO public.medication_administrations(tenant_id,medication_id,client_id,status,administered_at,occurred_at,administered_dose,route,administered_by,creation_payload,prn_reason) VALUES(t,med,c,'administered',actual_at+interval '1 hour',actual_at+interval '1 hour','0.100','oral',u,'{"unit":"Tablette"}','Synthetic observed PRN reason');
   value:=care_private.assess_medication_execution(assessment_packet);IF value#>'{checks,intervalSatisfied}' IS DISTINCT FROM 'true'::jsonb OR value#>'{checks,cumulativeSatisfied}' IS DISTINCT FROM 'false'::jsonb OR (value#>>'{checks,maximumObservedWindowDose}')::numeric IS DISTINCT FROM 0.400 OR NOT(value->'violations'?'rolling_maximum_not_satisfied') THEN RAISE EXCEPTION 'Retroactive candidate ignored later rolling-window overdose';END IF;
   RAISE EXCEPTION USING ERRCODE='Z0002';
  EXCEPTION WHEN SQLSTATE 'Z0002' THEN NULL;END;
  FOR bad IN SELECT bad_rows.item FROM jsonb_array_elements('[{"dose":"1 Tablette","at":"known","payload":{"unit":"Tablette"},"violation":"actual_dose_not_structured"},{"dose":"0.100","at":null,"payload":{"unit":"Tablette"},"violation":"actual_time_or_outcome_unknown"},{"dose":"0.100","at":"known","payload":{"unit":"mg"},"violation":"actual_unit_or_route_unconfirmed"}]'::jsonb) AS bad_rows(item) LOOP
   BEGIN
    INSERT INTO public.medication_administrations(tenant_id,medication_id,client_id,status,administered_at,occurred_at,administered_dose,route,administered_by,creation_payload,prn_reason) VALUES(t,med,c,'administered',actual_at,CASE WHEN bad->>'at' IS NULL THEN NULL ELSE actual_at END,bad->>'dose','oral',u,bad->'payload','Synthetic observed PRN reason');
    value:=care_private.assess_medication_execution(assessment_packet);IF value#>'{checks,historyComplete}' IS DISTINCT FROM 'false'::jsonb OR value#>'{checks,intervalSatisfied}' IS DISTINCT FROM 'null'::jsonb OR value#>'{checks,cumulativeSatisfied}' IS DISTINCT FROM 'null'::jsonb OR value#>'{checks,intervalBeforeMicroseconds}' IS DISTINCT FROM 'null'::jsonb OR value#>'{checks,intervalAfterMicroseconds}' IS DISTINCT FROM 'null'::jsonb OR NOT(value->'violations'?(bad->>'violation')) OR jsonb_array_length(value->'actuals') IS DISTINCT FROM 4 THEN RAISE EXCEPTION 'Malformed legacy actual became known-safe: %',bad;END IF;
    RAISE EXCEPTION USING ERRCODE='Z0002';
   EXCEPTION WHEN SQLSTATE 'Z0002' THEN NULL;END;
  END LOOP;
  BEGIN
   INSERT INTO public.medication_administrations(tenant_id,medication_id,client_id,status,administered_dose,creation_payload) VALUES(t,med,c,'scheduled','0.100','{}');
   value:=care_private.assess_medication_execution(assessment_packet);IF value#>'{checks,historyComplete}' IS DISTINCT FROM 'false'::jsonb OR NOT(value->'violations'?'non_actual_row_contains_dose') THEN RAISE EXCEPTION 'Scheduled row with an actual dose silently ignored';END IF;
   RAISE EXCEPTION USING ERRCODE='Z0002';
  EXCEPTION WHEN SQLSTATE 'Z0002' THEN NULL;END;
  BEGIN PERFORM care_private.commit_medication_execution(assessment_packet);RAISE EXCEPTION 'PRN assessment permitted actual commit';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
  IF (SELECT count(*) FROM public.medication_administrations WHERE tenant_id=t) IS DISTINCT FROM 3 OR (SELECT count(*) FROM care_private.medication_daily_plans WHERE tenant_id=t) IS DISTINCT FROM 2 OR (SELECT to_jsonb(m) FROM public.medications m WHERE m.id=med) IS DISTINCT FROM native THEN RAISE EXCEPTION 'Assessment/replay mutated actuals, plan originals or native order';END IF;
  IF EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname IN('propose_ambulatory_medication_daily_plan','confirm_ambulatory_medication_daily_plan','read_ambulatory_medication_daily_plan_context','read_ambulatory_medication_daily_plans','request_ambulatory_medication_daily_plan_review','authorize_ambulatory_medication_daily_plan','request_ambulatory_medication_daily_plan_withdrawal','confirm_ambulatory_medication_daily_plan_review_request','read_ambulatory_medication_daily_plan_review_context','read_ambulatory_medication_daily_plan_reviews','confirm_ambulatory_medication_daily_plan_authorization','assess_ambulatory_medication_execution','commit_ambulatory_medication_execution') AND (has_function_privilege('anon',p.oid,'EXECUTE') OR has_function_privilege('authenticated',p.oid,'EXECUTE') OR has_function_privilege('service_role',p.oid,'EXECUTE'))) THEN RAISE EXCEPTION 'Daily-plan/assessment quarantine missing';END IF;
  IF has_table_privilege('authenticated','care_private.medication_daily_plans','INSERT') OR has_table_privilege('service_role','care_private.medication_daily_plan_authorizations','INSERT') THEN RAISE EXCEPTION 'Private plan record grants widened';END IF;
  passed:=true;RAISE EXCEPTION USING ERRCODE='Z0001';
 EXCEPTION WHEN SQLSTATE 'Z0001' THEN NULL;END;
 IF NOT passed OR EXISTS(SELECT 1 FROM public.tenants WHERE id=t) OR EXISTS(SELECT 1 FROM auth.users WHERE id IN(u,reviewer)) OR EXISTS(SELECT 1 FROM care_private.medication_daily_plans WHERE tenant_id=t) OR EXISTS(SELECT 1 FROM care_private.medication_daily_plan_review_requests WHERE tenant_id=t) OR EXISTS(SELECT 1 FROM care_private.medication_daily_plan_authorizations WHERE tenant_id=t) OR EXISTS(SELECT 1 FROM care_private.medication_daily_plan_withdrawals WHERE tenant_id=t) OR EXISTS(SELECT 1 FROM public.medication_administrations WHERE tenant_id=t) THEN RAISE EXCEPTION 'Daily-plan test or complete rollback cleanup failed';END IF;
 PERFORM set_config('cp365.daily_plan_test_evidence',jsonb_build_object('regularPacket',regular_packet,'regularAssessment',regular_assessment,'prnPacket',assessment_packet,'prnAssessment',prn_assessment,'context',prn_context,'plan',regular_assessment->'plan')::text,true);
END $test$;
-- Synthetic response evidence is emitted only after every fixture is rolled back.
SELECT current_setting('cp365.daily_plan_test_evidence',true)::jsonb AS evidence;

