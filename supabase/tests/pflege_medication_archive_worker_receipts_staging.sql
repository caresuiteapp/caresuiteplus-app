-- Staging only. Synthetic fixtures are rolled back and cleanup is asserted.
-- Staging only. Synthetic JWT claims and database session; no Auth HTTP login.
-- All synthetic data is rolled back inside the anonymous block.
DO $test$ DECLARE t uuid:=gen_random_uuid();u uuid:=gen_random_uuid();s uuid:=gen_random_uuid();r uuid:=gen_random_uuid();e uuid:=gen_random_uuid();c uuid:=gen_random_uuid();tr uuid:=gen_random_uuid();st uuid:=gen_random_uuid();v jsonb;p jsonb;receipt jsonb;replay jsonb;revised jsonb;old_packet jsonb;doc uuid:=gen_random_uuid();src uuid:=gen_random_uuid();arc uuid:=gen_random_uuid();h text:='ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad';mr jsonb;dr jsonb;claims jsonb;worker_claims jsonb:='{"role":"service_role"}'::jsonb;req uuid:=gen_random_uuid();result_id uuid;passed boolean:=false;BEGIN BEGIN
INSERT INTO public.tenants(id,name) VALUES(t,'CP365 medication page test');
INSERT INTO public.roles(id,key,name) VALUES(r,'cp365_'||r::text,'CP365 isolated test');
INSERT INTO public.role_permissions(role_id,permission_key) SELECT r,unnest(ARRAY['pflege.medications.view','pflege.medications.manage','pflege.medications.administer','office.documents.view','office.clients.view_sensitive']);
INSERT INTO auth.users(id,email,raw_user_meta_data,raw_app_meta_data) VALUES(u,u::text||'@example.invalid','{}','{}');
UPDATE public.profiles SET tenant_id=t,role_id=r,role_key='pfleger',is_active=true,status='active',display_name='CP365 Test' WHERE id=u;
INSERT INTO auth.sessions(id,user_id,not_after) VALUES(s,u,clock_timestamp()+interval '1 hour');
INSERT INTO public.clients(id,tenant_id,first_name,last_name,status) VALUES(c,t,'CP365','Test','aktiv');
INSERT INTO public.client_module_assignments(tenant_id,client_id,module_key,status,is_active) VALUES(t,c,'pflege','active',true);
INSERT INTO public.medications(id,tenant_id,client_id,name,status,is_prn,active_ingredient,strength,form,prescribed_dose,dose_unit,route,prescribed_by,start_date,indication) VALUES(tr,t,c,'Metamizol','active',false,'Metamizol-Natrium','500 mg','Tablette','1','Tablette','oral','Ärztliche Verordnung','2026-10-01','Dokumentierte Schmerzindikation');
PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated','session_id',s,'exp',extract(epoch from clock_timestamp()+interval '1 hour')::bigint)::text,true);


INSERT INTO public.client_documents(id,tenant_id,client_id,title,file_name,mime_type,storage_path,size_bytes) VALUES(doc,t,c,'Verordnung','original.pdf','application/pdf','tenant/'||t||'/clients/'||c||'/documents/original.pdf',3);
SELECT to_jsonb(m) INTO mr FROM public.medications m WHERE id=tr;
SELECT to_jsonb(d) INTO dr FROM public.client_documents d WHERE id=doc;
INSERT INTO public.medication_order_sources(id,tenant_id,medication_id,client_id,document_id,request_id,payload,document_snapshot,order_snapshot,reason,recorded_by,recorded_by_name)
VALUES(src,t,tr,c,doc,gen_random_uuid(),jsonb_build_object('documentId',doc,'documentUpdatedAt',dr->'updated_at','expectedUpdatedAt',mr->'updated_at','contentSha256',h,'contentSize',3),dr||jsonb_build_object('content_sha256',h,'content_size',3,'content_fingerprint_origin','client_observed'),mr,'Synthetischer Integritätstest',u,'Test');
v:=care_private.prepare_medication_source_proof(src);claims:=auth.jwt();
p:=jsonb_build_object('schemaVersion',1,'requestId',req,'record',(v-'archiveId'-'verificationState')||jsonb_build_object('archivePath','tenant/'||t||'/clients/'||c||'/medication-sources/'||src||'/'||h||'.bin'),'caller',claims,'verifiedSha256',h,'verifiedSize',3);
BEGIN PERFORM care_private.commit_medication_source_proof(p);RAISE EXCEPTION 'Browser minted worker receipt';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
PERFORM set_config('request.jwt.claims',worker_claims::text,true);
BEGIN PERFORM care_private.commit_medication_source_proof(jsonb_set(p,'{verifiedSha256}',to_jsonb(repeat('0',64))));RAISE EXCEPTION 'Invalid worker case 1 accepted';EXCEPTION WHEN check_violation THEN NULL;END;
IF auth.jwt() IS DISTINCT FROM worker_claims THEN RAISE EXCEPTION 'Claims not restored after failure';END IF;
BEGIN PERFORM care_private.commit_medication_source_proof(jsonb_set(p,'{verifiedSize}','4'));RAISE EXCEPTION 'Invalid worker case 2 accepted';EXCEPTION WHEN check_violation THEN NULL;END;
IF auth.jwt() IS DISTINCT FROM worker_claims THEN RAISE EXCEPTION 'Claims not restored after failure';END IF;
BEGIN PERFORM care_private.commit_medication_source_proof(jsonb_set(p,'{record,orderFingerprint}',to_jsonb('sha256:'||repeat('0',64))));RAISE EXCEPTION 'Invalid worker case 3 accepted';EXCEPTION WHEN check_violation THEN NULL;END;
IF auth.jwt() IS DISTINCT FROM worker_claims THEN RAISE EXCEPTION 'Claims not restored after failure';END IF;
BEGIN PERFORM care_private.commit_medication_source_proof(jsonb_set(p,'{record,documentVersion}',to_jsonb('2026-10-01T00:00:00Z'::text)));RAISE EXCEPTION 'Invalid worker case 4 accepted';EXCEPTION WHEN check_violation THEN NULL;END;
IF auth.jwt() IS DISTINCT FROM worker_claims THEN RAISE EXCEPTION 'Claims not restored after failure';END IF;
BEGIN PERFORM care_private.commit_medication_source_proof(jsonb_set(p,'{record,archivePath}','"other"'));RAISE EXCEPTION 'Invalid worker case 5 accepted';EXCEPTION WHEN check_violation THEN NULL;END;
IF auth.jwt() IS DISTINCT FROM worker_claims THEN RAISE EXCEPTION 'Claims not restored after failure';END IF;
BEGIN PERFORM care_private.commit_medication_source_proof(jsonb_set(p,'{record,actorId}',to_jsonb(gen_random_uuid())));RAISE EXCEPTION 'Invalid worker case 6 accepted';EXCEPTION WHEN check_violation THEN NULL;END;
IF auth.jwt() IS DISTINCT FROM worker_claims THEN RAISE EXCEPTION 'Claims not restored after failure';END IF;
BEGIN PERFORM care_private.commit_medication_source_proof(jsonb_set(p,'{caller,session_id}',to_jsonb(gen_random_uuid())));RAISE EXCEPTION 'Invalid worker case 7 accepted';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
IF auth.jwt() IS DISTINCT FROM worker_claims THEN RAISE EXCEPTION 'Claims not restored after failure';END IF;
BEGIN PERFORM care_private.commit_medication_source_proof(jsonb_set(p,'{caller,exp}','0'));RAISE EXCEPTION 'Invalid worker case 8 accepted';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
IF auth.jwt() IS DISTINCT FROM worker_claims THEN RAISE EXCEPTION 'Claims not restored after failure';END IF;
BEGIN PERFORM care_private.commit_medication_source_proof(jsonb_set(p,'{caller,role}','"service_role"'));RAISE EXCEPTION 'Invalid worker case 9 accepted';EXCEPTION WHEN check_violation THEN NULL;END;
IF auth.jwt() IS DISTINCT FROM worker_claims THEN RAISE EXCEPTION 'Claims not restored after failure';END IF;
BEGIN PERFORM care_private.commit_medication_source_proof(p||'{"unexpected":true}'::jsonb);RAISE EXCEPTION 'Invalid worker case 10 accepted';EXCEPTION WHEN check_violation THEN NULL;END;
IF auth.jwt() IS DISTINCT FROM worker_claims THEN RAISE EXCEPTION 'Claims not restored after failure';END IF;
IF EXISTS(SELECT 1 FROM public.medication_source_archives WHERE source_id=src) OR EXISTS(SELECT 1 FROM care_private.medication_archive_proof_receipts WHERE tenant_id=t) THEN RAISE EXCEPTION 'Rejected proof persisted data';END IF;
result_id:=care_private.commit_medication_source_proof(p);
IF result_id<>req OR auth.jwt() IS DISTINCT FROM worker_claims OR NOT EXISTS(SELECT 1 FROM public.medication_source_archives WHERE id=req AND status='ready' AND finalized_by=u) OR NOT EXISTS(SELECT 1 FROM care_private.medication_archive_proof_receipts WHERE request_id=req AND packet=p-'caller' AND actor_id=u) THEN RAISE EXCEPTION 'Atomic receipt incomplete or caller claims retained';END IF;
IF care_private.commit_medication_source_proof(p)<>result_id OR (SELECT count(*) FROM care_private.medication_archive_proof_receipts WHERE tenant_id=t)<>1 THEN RAISE EXCEPTION 'Replay duplicated receipt';END IF;
IF care_private.commit_medication_source_proof(jsonb_set(p,'{caller,exp}',to_jsonb(extract(epoch from clock_timestamp()+interval '2 hours')::bigint)))<>result_id THEN RAISE EXCEPTION 'Refreshed session claims broke same request';END IF;
BEGIN UPDATE care_private.medication_archive_proof_receipts SET packet='{}' WHERE tenant_id=t;RAISE EXCEPTION 'Receipt rewrite accepted';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
BEGIN DELETE FROM care_private.medication_archive_proof_receipts WHERE tenant_id=t;RAISE EXCEPTION 'Receipt deletion accepted';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
BEGIN UPDATE public.medications SET prescribed_dose='2' WHERE id=tr;PERFORM care_private.commit_medication_source_proof(p);RAISE EXCEPTION 'Stale order replay accepted';EXCEPTION WHEN check_violation THEN NULL;END;
BEGIN UPDATE public.client_documents SET title='Changed' WHERE id=doc;PERFORM care_private.commit_medication_source_proof(p);RAISE EXCEPTION 'Stale document replay accepted';EXCEPTION WHEN check_violation THEN NULL;END;
-- Even when current native metadata and the captured source are consistently updated,
-- the old request ID cannot be reused for the new fingerprint.
BEGIN
 UPDATE public.client_documents SET title='New consistent source version' WHERE id=doc;
 UPDATE public.medication_order_sources SET document_snapshot=jsonb_set(document_snapshot,'{title}','"New consistent source version"') WHERE id=src;
 PERFORM set_config('request.jwt.claims',claims::text,true);v:=care_private.prepare_medication_source_proof(src);
 PERFORM set_config('request.jwt.claims',worker_claims::text,true);
 revised:=jsonb_set(p,'{record}',(v-'archiveId'-'verificationState')||jsonb_build_object('archivePath',p#>>'{record,archivePath}'));
 PERFORM care_private.commit_medication_source_proof(revised);RAISE EXCEPTION 'Conflicting same-ID request accepted';
EXCEPTION WHEN check_violation THEN NULL;END;
-- A fresh worker request can attest the same ready bytes without replacing the archive.
st:=care_private.commit_medication_source_proof(jsonb_set(p,'{requestId}',to_jsonb(gen_random_uuid())));
IF st<>result_id OR (SELECT count(*) FROM public.medication_source_archives WHERE source_id=src)<>1 OR (SELECT count(*) FROM care_private.medication_archive_proof_receipts WHERE tenant_id=t)<>2 THEN RAISE EXCEPTION 'Ready reuse replaced archive or lost receipt';END IF;
UPDATE public.profiles SET role_id=null,role_key='unassigned' WHERE id=u;
BEGIN PERFORM care_private.commit_medication_source_proof(p);RAISE EXCEPTION 'Replay bypassed revoked permission';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
IF has_function_privilege('authenticated','public.commit_ambulatory_medication_source_proof(jsonb)','EXECUTE') OR has_function_privilege('anon','public.commit_ambulatory_medication_source_proof(jsonb)','EXECUTE') OR has_function_privilege('service_role','public.commit_ambulatory_medication_source_proof(jsonb)','EXECUTE') OR has_table_privilege('authenticated','care_private.medication_archive_proof_receipts','INSERT') THEN RAISE EXCEPTION 'Quarantine missing';END IF;
passed:=true;RAISE EXCEPTION USING ERRCODE='Z0001';
EXCEPTION WHEN SQLSTATE 'Z0001' THEN NULL;END;
IF NOT passed OR EXISTS(SELECT 1 FROM public.tenants WHERE id=t) OR EXISTS(SELECT 1 FROM auth.users WHERE id=u) THEN RAISE EXCEPTION 'Test or cleanup failed';END IF;
END $test$;


