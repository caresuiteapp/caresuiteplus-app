-- Staging only. Synthetic fixtures are rolled back and cleanup is asserted.
-- Staging only. Synthetic JWT claims and database session; no Auth HTTP login.
-- All synthetic data is rolled back inside the anonymous block.
DO $test$ DECLARE t uuid:=gen_random_uuid();u uuid:=gen_random_uuid();s uuid:=gen_random_uuid();r uuid:=gen_random_uuid();e uuid:=gen_random_uuid();c uuid:=gen_random_uuid();tr uuid:=gen_random_uuid();st uuid:=gen_random_uuid();v jsonb;p jsonb;receipt jsonb;replay jsonb;revised jsonb;old_packet jsonb;doc uuid:=gen_random_uuid();src uuid:=gen_random_uuid();arc uuid:=gen_random_uuid();h text:='ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad';mr jsonb;dr jsonb;claims jsonb;worker_claims jsonb:='{"role":"service_role"}'::jsonb;req uuid:=gen_random_uuid();result_id uuid;wp jsonb;captured jsonb;revision_id uuid;other_revision uuid;reviewer_id uuid:=gen_random_uuid();auth_id uuid:=gen_random_uuid();apply_req uuid:=gen_random_uuid();candidate jsonb;proposal_packet jsonb;apply_packet jsonb;page1 jsonb;page2 jsonb;grant_row care_private.medication_order_review_authorizations%rowtype;actor_name text;reviewer_session uuid:=gen_random_uuid();review_claims jsonb;review_request_packet jsonb;review_decision_packet jsonb;review_receipt jsonb;review_item jsonb;review_request_id uuid;revoke_packet jsonb;context_before jsonb;context_after jsonb;passed boolean:=false;BEGIN BEGIN
INSERT INTO public.tenants(id,name) VALUES(t,'CP365 medication page test');
INSERT INTO public.roles(id,key,name) VALUES(r,'cp365_'||r::text,'CP365 isolated test');
INSERT INTO public.role_permissions(role_id,permission_key) SELECT r,unnest(ARRAY['pflege.medications.view','pflege.medications.manage','pflege.medications.administer','office.documents.view','office.clients.view_sensitive']);
INSERT INTO auth.users(id,email,raw_user_meta_data,raw_app_meta_data) VALUES(u,u::text||'@example.invalid','{}','{}');
UPDATE public.profiles SET tenant_id=t,role_id=r,role_key='pfleger',is_active=true,status='active',display_name='CP365 Test' WHERE id=u;
INSERT INTO auth.sessions(id,user_id,not_after) VALUES(s,u,clock_timestamp()+interval '1 hour');
INSERT INTO public.clients(id,tenant_id,first_name,last_name,status) VALUES(c,t,'CP365','Test','aktiv');
INSERT INTO public.client_module_assignments(tenant_id,client_id,module_key,status,is_active) VALUES(t,c,'pflege','active',true);
INSERT INTO public.medications(id,tenant_id,client_id,name,status,is_prn) VALUES(tr,t,c,'Unvollständiges Original','active',null);
PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated','session_id',s,'exp',extract(epoch from clock_timestamp()+interval '1 hour')::bigint)::text,true);


INSERT INTO public.client_documents(id,tenant_id,client_id,title,file_name,mime_type,storage_path,size_bytes) VALUES(doc,t,c,'Verordnung','original.pdf','application/pdf','tenant/'||t||'/clients/'||c||'/documents/original.pdf',3);
SELECT to_jsonb(m) INTO mr FROM public.medications m WHERE id=tr;
SELECT to_jsonb(d) INTO dr FROM public.client_documents d WHERE id=doc;
claims:=auth.jwt();req:=gen_random_uuid();
BEGIN PERFORM care_private.medication_native_order(mr);RAISE EXCEPTION 'Incomplete native order became clinically complete';EXCEPTION WHEN check_violation THEN NULL;END;
p:=jsonb_build_object('documentId',doc,'documentUpdatedAt',dr->'updated_at','expectedUpdatedAt',mr->'updated_at','reason','Dokumentiertes unvollständiges Original','contentSha256',h,'contentSize',3);
src:=care_private.capture_medication_source(tr,req,p);v:=care_private.prepare_medication_source_proof(src);
wp:=jsonb_build_object('schemaVersion',1,'requestId',gen_random_uuid(),'record',(v-'archiveId'-'verificationState')||jsonb_build_object('archivePath','tenant/'||t||'/clients/'||c||'/medication-sources/'||src||'/'||h||'.bin'),'caller',claims,'verifiedSha256',h,'verifiedSize',3);
PERFORM set_config('request.jwt.claims',worker_claims::text,true);arc:=care_private.commit_medication_source_proof(wp);PERFORM set_config('request.jwt.claims',claims::text,true);
SELECT to_jsonb(m) INTO v FROM public.medications m WHERE id=tr;IF v IS DISTINCT FROM mr THEN RAISE EXCEPTION 'Technical archive filled native unknowns';END IF;
v:=care_private.read_medication_order_revision_context(tr);IF v->'order' IS DISTINCT FROM mr OR jsonb_array_length(v->'sources')<>1 THEN RAISE EXCEPTION 'Revision context omitted raw facts or proof source';END IF;
candidate:='{"medicationName":"Metamizol","activeIngredient":"Metamizol-Natrium","strength":"500 mg","form":"Tablette","dose":"1.000","unit":"Tablette","route":"oral","prescriber":"Dokumentierte verordnende Person","validFrom":"2026-10-01","validUntil":null,"indication":"Dokumentierte Schmerzindikation","isPrn":false,"minimumIntervalMinutes":null,"maximumDose":null,"maximumDoseUnit":"","maximumPeriodHours":null}'::jsonb;
proposal_packet:=jsonb_build_object('schemaVersion',1,'requestId',gen_random_uuid(),'tenantId',t,'clientId',c,'medicationId',tr,'actorId',u,'expectedUpdatedAt',mr->'updated_at','sourceId',src,'reason','Manuelle Übertragung aus dem gesicherten Original','order',candidate);
BEGIN PERFORM care_private.propose_medication_order_revision(jsonb_set(proposal_packet,'{order,dose}','"0"'));RAISE EXCEPTION 'Zero candidate accepted';EXCEPTION WHEN check_violation THEN NULL;END;
BEGIN PERFORM care_private.propose_medication_order_revision(jsonb_set(proposal_packet,'{sourceId}',to_jsonb(gen_random_uuid())));RAISE EXCEPTION 'Foreign source accepted';EXCEPTION WHEN check_violation THEN NULL;END;
receipt:=care_private.propose_medication_order_revision(proposal_packet);revision_id:=(receipt->>'id')::uuid;
IF receipt->>'state'<>'proposed' OR receipt->'application'<>'null'::jsonb OR receipt->'before_snapshot' IS DISTINCT FROM mr OR receipt->'proposed_order' IS DISTINCT FROM candidate THEN RAISE EXCEPTION 'Proposal fabricated native transfer';END IF;
SELECT to_jsonb(m) INTO v FROM public.medications m WHERE id=tr;IF v IS DISTINCT FROM mr THEN RAISE EXCEPTION 'Proposal changed clinical facts';END IF;
IF care_private.confirm_medication_order_revision(revision_id,(proposal_packet->>'requestId')::uuid) IS DISTINCT FROM receipt OR care_private.propose_medication_order_revision(proposal_packet) IS DISTINCT FROM receipt THEN RAISE EXCEPTION 'Own proposal replay mismatch';END IF;
BEGIN PERFORM care_private.propose_medication_order_revision(jsonb_set(proposal_packet,'{order,dose}','"2"'));RAISE EXCEPTION 'Conflicting proposal replay accepted';EXCEPTION WHEN check_violation THEN NULL;END;

-- Creator requests under its own session. Browser cannot select another creator/session.
review_request_packet:=jsonb_build_object('schemaVersion',1,'requestId',gen_random_uuid(),'tenantId',t,'clientId',c,'medicationId',tr,'actorId',u,'action','request','revisionId',revision_id,'reason','Getrennte technische Übertragungsprüfung anfordern');
review_receipt:=care_private.commit_medication_order_review(review_request_packet);review_request_id:=(review_receipt#>>'{item,request,id}')::uuid;
IF review_receipt->>'action'<>'request' OR review_receipt#>'{item,decision}'<>'null'::jsonb OR review_receipt#>'{item,authorization}'<>'null'::jsonb OR review_receipt#>'{item,request,revision,before_snapshot}' IS DISTINCT FROM mr THEN RAISE EXCEPTION 'Request invented review/complete native facts';END IF;
IF review_receipt::text LIKE '%creator_session_id%' OR review_receipt::text LIKE '%'||s::text||'%' THEN RAISE EXCEPTION 'Creator session leaked into review receipt';END IF;
IF care_private.confirm_medication_order_review((review_request_packet->>'requestId')::uuid) IS DISTINCT FROM review_receipt OR care_private.commit_medication_order_review(review_request_packet) IS DISTINCT FROM review_receipt THEN RAISE EXCEPTION 'Own request replay mismatch';END IF;
BEGIN PERFORM care_private.commit_medication_order_review(jsonb_set(review_request_packet,'{reason}','"Different original request reason"'));RAISE EXCEPTION 'Conflicting request replay accepted';EXCEPTION WHEN check_violation THEN NULL;END;
BEGIN PERFORM care_private.commit_medication_order_review(review_request_packet||jsonb_build_object('creatorSessionId',s));RAISE EXCEPTION 'Browser chose creator session';EXCEPTION WHEN check_violation THEN NULL;END;
INSERT INTO public.role_permissions(role_id,permission_key) VALUES(r,'pflege.documentation.sign');
review_decision_packet:=jsonb_build_object('schemaVersion',1,'requestId',gen_random_uuid(),'tenantId',t,'clientId',c,'medicationId',tr,'actorId',u,'action','authorize','reviewRequestId',review_request_id,'reviewReference','Dokumentierter technischer Originalabgleich');
BEGIN PERFORM care_private.commit_medication_order_review(review_decision_packet);RAISE EXCEPTION 'Creator self authorized';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
INSERT INTO auth.users(id,email,raw_user_meta_data,raw_app_meta_data) VALUES(reviewer_id,reviewer_id::text||'@example.invalid','{}','{}');
UPDATE public.profiles SET tenant_id=t,role_id=r,role_key='pfleger',is_active=true,status='active',display_name='Unabhängige technische Testprüfung' WHERE id=reviewer_id;
INSERT INTO auth.sessions(id,user_id,not_after) VALUES(reviewer_session,reviewer_id,clock_timestamp()+interval '1 hour');
review_claims:=jsonb_build_object('sub',reviewer_id,'role','authenticated','session_id',reviewer_session,'exp',extract(epoch from clock_timestamp()+interval '1 hour')::bigint);
PERFORM set_config('request.jwt.claims',review_claims::text,true);
review_decision_packet:=review_decision_packet||jsonb_build_object('actorId',reviewer_id);
BEGIN UPDATE auth.sessions SET not_after=clock_timestamp()-interval '1 minute' WHERE id=s;PERFORM care_private.commit_medication_order_review(review_decision_packet);RAISE EXCEPTION 'Ended creator session authorized';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
BEGIN DELETE FROM public.role_permissions WHERE role_id=r AND permission_key='pflege.documentation.sign';PERFORM care_private.commit_medication_order_review(review_decision_packet);RAISE EXCEPTION 'Reviewer missing own sign right authorized';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
BEGIN UPDATE public.medications SET dosage='Changed native original' WHERE id=tr;PERFORM care_private.commit_medication_order_review(review_decision_packet);RAISE EXCEPTION 'Changed whole native row authorized';EXCEPTION WHEN check_violation THEN NULL;END;
BEGIN UPDATE public.medication_source_archives SET content_size=4 WHERE id=arc;PERFORM care_private.commit_medication_order_review(review_decision_packet);RAISE EXCEPTION 'Changed archive authorized';EXCEPTION WHEN check_violation THEN NULL;END;
BEGIN
 INSERT INTO care_private.medication_order_review_requests(tenant_id,client_id,medication_id,revision_id,creator_id,creator_session_id,request_id,created_at,expires_at,reason,proposal_snapshot,packet)
 SELECT expired_source.tenant_id,expired_source.client_id,expired_source.medication_id,expired_source.revision_id,expired_source.creator_id,expired_source.creator_session_id,gen_random_uuid(),clock_timestamp()-interval '2 hours',clock_timestamp()-interval '1 hour',expired_source.reason,expired_source.proposal_snapshot,expired_source.packet FROM care_private.medication_order_review_requests expired_source WHERE expired_source.id=review_request_id RETURNING id INTO e;
 PERFORM care_private.commit_medication_order_review(jsonb_set(review_decision_packet,'{reviewRequestId}',to_jsonb(e)));RAISE EXCEPTION 'Expired review request authorized';
EXCEPTION WHEN insufficient_privilege THEN NULL;END;
context_before:=care_private.read_medication_order_review_context(tr,null,null,1);
review_receipt:=care_private.commit_medication_order_review(review_decision_packet);auth_id:=(review_receipt#>>'{item,authorization,id}')::uuid;
IF review_receipt#>>'{item,decision,action}'<>'authorize' OR review_receipt#>>'{item,authorization,actorId}'<>u::text OR review_receipt#>>'{item,authorization,reviewedBy}'<>reviewer_id::text THEN RAISE EXCEPTION 'Independent authorization identity mismatch';END IF;
IF NOT EXISTS(SELECT 1 FROM care_private.medication_order_review_authorizations WHERE id=auth_id AND actor_id=u AND session_id=s AND reviewed_by=reviewer_id AND proposal_fingerprint=care_private.medication_json_fingerprint((SELECT to_jsonb(z) FROM care_private.medication_order_revisions z WHERE z.id=(review_receipt#>>'{item,request,revisionId}')::uuid))) THEN RAISE EXCEPTION 'Authorization original/session fingerprint mismatch';END IF;
IF care_private.confirm_medication_order_review((review_decision_packet->>'requestId')::uuid) IS DISTINCT FROM review_receipt OR care_private.commit_medication_order_review(review_decision_packet) IS DISTINCT FROM review_receipt THEN RAISE EXCEPTION 'Decision replay mismatch';END IF;
context_after:=care_private.read_medication_order_review_context(tr,null,null,1);IF context_before->'stateFingerprint'=context_after->'stateFingerprint' THEN RAISE EXCEPTION 'Ledger head failed to change for old request decision';END IF;
BEGIN PERFORM care_private.confirm_medication_order_review((review_request_packet->>'requestId')::uuid);RAISE EXCEPTION 'Reviewer confirmed creator write as own';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
BEGIN PERFORM care_private.commit_medication_order_review(review_decision_packet||jsonb_build_object('requestId',gen_random_uuid(),'action','reject'));RAISE EXCEPTION 'Second decision accepted';EXCEPTION WHEN check_violation THEN NULL;END;
BEGIN UPDATE care_private.medication_order_review_requests SET reason='Changed' WHERE id=review_request_id;RAISE EXCEPTION 'Review request mutable';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
BEGIN UPDATE care_private.medication_order_review_writes SET original='{}' WHERE request_id=(review_decision_packet->>'requestId')::uuid;RAISE EXCEPTION 'Review receipt mutable';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
revoke_packet:=review_decision_packet||jsonb_build_object('requestId',gen_random_uuid(),'action','revoke','reviewReference','Technische Übertragungsberechtigung vor Nutzung widerrufen');
receipt:=care_private.commit_medication_order_review(revoke_packet);
IF receipt#>'{item,authorization,revokedAt}'='null'::jsonb OR receipt#>>'{item,revocation,action}'<>'revoke' THEN RAISE EXCEPTION 'Revocation missing';END IF;
IF care_private.commit_medication_order_review(revoke_packet) IS DISTINCT FROM receipt THEN RAISE EXCEPTION 'Revocation exact retry mismatch';END IF;
IF care_private.confirm_medication_order_review((review_decision_packet->>'requestId')::uuid) IS DISTINCT FROM review_receipt THEN RAISE EXCEPTION 'Historical own decision receipt changed after revoke';END IF;
PERFORM set_config('request.jwt.claims',claims::text,true);
apply_packet:=jsonb_build_object('requestId',gen_random_uuid(),'revisionId',revision_id,'authorizationId',auth_id,'reason','Explizite technische Übernahme geprüfter Angaben');
BEGIN PERFORM care_private.apply_medication_order_revision(apply_packet);RAISE EXCEPTION 'Revoked issued authorization applied';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
-- A rejected review has no authorization; a fresh review can be requested under the creator session.
review_request_packet:=review_request_packet||jsonb_build_object('requestId',gen_random_uuid());receipt:=care_private.commit_medication_order_review(review_request_packet);e:=(receipt#>>'{item,request,id}')::uuid;
PERFORM set_config('request.jwt.claims',review_claims::text,true);
receipt:=care_private.commit_medication_order_review(review_decision_packet||jsonb_build_object('requestId',gen_random_uuid(),'reviewRequestId',e,'action','reject','reviewReference','Übertragungsangaben benötigen erneuten Originalabgleich'));
IF receipt#>>'{item,decision,action}'<>'reject' OR receipt#>'{item,authorization}'<>'null'::jsonb THEN RAISE EXCEPTION 'Rejected request minted authorization';END IF;
PERFORM set_config('request.jwt.claims',claims::text,true);
review_request_packet:=review_request_packet||jsonb_build_object('requestId',gen_random_uuid());receipt:=care_private.commit_medication_order_review(review_request_packet);e:=(receipt#>>'{item,request,id}')::uuid;
PERFORM set_config('request.jwt.claims',review_claims::text,true);
receipt:=care_private.commit_medication_order_review(review_decision_packet||jsonb_build_object('requestId',gen_random_uuid(),'reviewRequestId',e));auth_id:=(receipt#>>'{item,authorization,id}')::uuid;
-- Pagination is complete and foreign cursor remains rejected.
page1:=care_private.read_medication_order_review_context(tr,null,null,1);page2:=care_private.read_medication_order_review_context(tr,(page1#>>'{nextCursor,at}')::timestamptz,(page1#>>'{nextCursor,id}')::uuid,1);
IF jsonb_array_length(page1->'items')<>1 OR jsonb_array_length(page2->'items')<>1 OR page1#>>'{items,0,request,id}'=page2#>>'{items,0,request,id}' OR page1->'stateFingerprint'<>page2->'stateFingerprint' THEN RAISE EXCEPTION 'Review pagination lost originals';END IF;
BEGIN PERFORM care_private.read_medication_order_review_context(tr,clock_timestamp(),gen_random_uuid(),1);RAISE EXCEPTION 'Foreign cursor accepted';EXCEPTION WHEN check_violation THEN NULL;END;
PERFORM set_config('request.jwt.claims',claims::text,true);
apply_packet:=apply_packet||jsonb_build_object('requestId',gen_random_uuid(),'authorizationId',auth_id);
receipt:=care_private.apply_medication_order_revision(apply_packet);
IF receipt->'before_snapshot' IS DISTINCT FROM mr OR care_private.medication_native_order(receipt->'after_snapshot') IS DISTINCT FROM candidate OR receipt#>>'{after_snapshot,status}'<>'active' THEN RAISE EXCEPTION 'Issued authorization changed unrelated native facts';END IF;
IF care_private.apply_medication_order_revision(apply_packet) IS DISTINCT FROM receipt THEN RAISE EXCEPTION 'Issued authorization applied twice';END IF;
BEGIN PERFORM care_private.commit_medication_order_review(review_request_packet||jsonb_build_object('requestId',gen_random_uuid()));RAISE EXCEPTION 'Already applied revision requested again';EXCEPTION WHEN check_violation THEN NULL;END;
IF EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname IN('commit_ambulatory_medication_order_review','confirm_ambulatory_medication_order_review','read_ambulatory_medication_order_review_context') AND (has_function_privilege('anon',p.oid,'EXECUTE') OR has_function_privilege('authenticated',p.oid,'EXECUTE') OR has_function_privilege('service_role',p.oid,'EXECUTE'))) THEN RAISE EXCEPTION 'Review quarantine missing';END IF;
passed:=true;RAISE EXCEPTION USING ERRCODE='Z0001';
EXCEPTION WHEN SQLSTATE 'Z0001' THEN NULL;END;
IF NOT passed OR EXISTS(SELECT 1 FROM public.tenants WHERE id=t) OR EXISTS(SELECT 1 FROM auth.users WHERE id in(u,reviewer_id)) OR EXISTS(SELECT 1 FROM care_private.medication_order_review_requests WHERE tenant_id=t) OR EXISTS(SELECT 1 FROM care_private.medication_order_review_writes WHERE tenant_id=t) THEN RAISE EXCEPTION 'Review workflow test or rollback cleanup failed';END IF;
END $test$;
