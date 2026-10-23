-- Staging only. Synthetic fixtures are rolled back and cleanup is asserted.
-- Staging only. Synthetic JWT claims and database session; no Auth HTTP login.
-- All synthetic data is rolled back inside the anonymous block.
DO $test$ DECLARE t uuid:=gen_random_uuid();u uuid:=gen_random_uuid();s uuid:=gen_random_uuid();r uuid:=gen_random_uuid();e uuid:=gen_random_uuid();c uuid:=gen_random_uuid();tr uuid:=gen_random_uuid();st uuid:=gen_random_uuid();v jsonb;p jsonb;receipt jsonb;replay jsonb;revised jsonb;old_packet jsonb;doc uuid:=gen_random_uuid();src uuid:=gen_random_uuid();arc uuid:=gen_random_uuid();h text:='ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad';mr jsonb;dr jsonb;claims jsonb;worker_claims jsonb:='{"role":"service_role"}'::jsonb;req uuid:=gen_random_uuid();result_id uuid;wp jsonb;captured jsonb;passed boolean:=false;BEGIN BEGIN
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
claims:=auth.jwt();req:=gen_random_uuid();
p:=jsonb_build_object('documentId',doc,'documentUpdatedAt',replace(dr->>'updated_at','T',' '),'expectedUpdatedAt',replace(mr->>'updated_at','T',' '),'reason',' Originalbeleg für Quellenbindung ','contentSha256',h,'contentSize',3);
BEGIN PERFORM care_private.capture_medication_source(tr,req,p-'documentId');RAISE EXCEPTION 'Invalid capture case 1 accepted';EXCEPTION WHEN check_violation THEN NULL;END;
BEGIN PERFORM care_private.capture_medication_source(tr,req,p||'{"extra":true}'::jsonb);RAISE EXCEPTION 'Invalid capture case 2 accepted';EXCEPTION WHEN check_violation THEN NULL;END;
BEGIN PERFORM care_private.capture_medication_source(tr,req,jsonb_set(p,'{reason}','"   "'));RAISE EXCEPTION 'Invalid capture case 3 accepted';EXCEPTION WHEN check_violation THEN NULL;END;
BEGIN PERFORM care_private.capture_medication_source(tr,req,jsonb_set(p,'{contentSha256}','"invalid"'));RAISE EXCEPTION 'Invalid capture case 4 accepted';EXCEPTION WHEN check_violation THEN NULL;END;
BEGIN PERFORM care_private.capture_medication_source(tr,req,jsonb_set(p,'{contentSize}','3.5'));RAISE EXCEPTION 'Invalid capture case 5 accepted';EXCEPTION WHEN check_violation THEN NULL;END;
BEGIN PERFORM care_private.capture_medication_source(tr,req,jsonb_set(p,'{contentSize}','4'));RAISE EXCEPTION 'Invalid capture case 6 accepted';EXCEPTION WHEN check_violation THEN NULL;END;
BEGIN PERFORM care_private.capture_medication_source(tr,req,jsonb_set(p,'{documentUpdatedAt}',to_jsonb('2026-01-01T00:00:00Z'::text)));RAISE EXCEPTION 'Invalid capture case 7 accepted';EXCEPTION WHEN check_violation THEN NULL;END;
BEGIN PERFORM care_private.capture_medication_source(tr,req,jsonb_set(p,'{expectedUpdatedAt}',to_jsonb('2026-01-01T00:00:00Z'::text)));RAISE EXCEPTION 'Invalid capture case 8 accepted';EXCEPTION WHEN check_violation THEN NULL;END;
BEGIN PERFORM care_private.capture_medication_source(tr,req,jsonb_set(p,'{documentId}',to_jsonb(gen_random_uuid())));RAISE EXCEPTION 'Invalid capture case 9 accepted';EXCEPTION WHEN check_violation THEN NULL;END;
IF EXISTS(SELECT 1 FROM public.medication_order_sources WHERE tenant_id=t) OR EXISTS(SELECT 1 FROM care_private.medication_source_capture_receipts WHERE tenant_id=t) THEN RAISE EXCEPTION 'Rejected capture persisted data';END IF;
src:=care_private.capture_medication_source(tr,req,p);
captured:=care_private.confirm_medication_source_capture(src,req);
IF captured->>'id'<>src::text OR captured->'payload' IS DISTINCT FROM p OR captured->'order_snapshot' IS DISTINCT FROM mr OR ((captured->'document_snapshot')-'content_sha256'-'content_size'-'content_fingerprint_origin') IS DISTINCT FROM dr OR captured->>'reason'<>btrim(p->>'reason') OR captured->>'recorded_by'<>u::text THEN RAISE EXCEPTION 'Full original not confirmed';END IF;
IF care_private.capture_medication_source(tr,req,p)<>src OR (SELECT count(*) FROM public.medication_order_sources WHERE tenant_id=t)<>1 THEN RAISE EXCEPTION 'Capture replay duplicated original';END IF;
BEGIN PERFORM care_private.capture_medication_source(tr,req,jsonb_set(p,'{reason}','"Different request"'));RAISE EXCEPTION 'Conflicting request accepted';EXCEPTION WHEN check_violation THEN NULL;END;
BEGIN UPDATE public.medication_order_sources SET reason='mutated' WHERE id=src;RAISE EXCEPTION 'Captured original changed';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
BEGIN DELETE FROM public.medication_order_sources WHERE id=src;RAISE EXCEPTION 'Captured original deleted';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
BEGIN UPDATE care_private.medication_source_capture_receipts SET payload='{}' WHERE source_id=src;RAISE EXCEPTION 'Capture receipt changed';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
BEGIN DELETE FROM care_private.medication_source_capture_receipts WHERE source_id=src;RAISE EXCEPTION 'Capture receipt deleted';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
BEGIN UPDATE public.medications SET prescribed_dose='2' WHERE id=tr;
 IF care_private.capture_medication_source(tr,req,p)<>src OR care_private.confirm_medication_source_capture(src,req)->'order_snapshot' IS DISTINCT FROM mr THEN RAISE EXCEPTION 'Historical own receipt not recoverable';END IF;
 PERFORM care_private.prepare_medication_source_proof(src);RAISE EXCEPTION 'Historical source became current proof';EXCEPTION WHEN check_violation THEN NULL;END;
BEGIN UPDATE public.client_documents SET category='vertrag' WHERE id=doc;PERFORM care_private.prepare_medication_source_proof(src);RAISE EXCEPTION 'Changed complete document snapshot accepted';EXCEPTION WHEN check_violation THEN NULL;END;
BEGIN UPDATE public.client_module_assignments SET is_active=false WHERE tenant_id=t AND client_id=c;PERFORM care_private.confirm_medication_source_capture(src,req);RAISE EXCEPTION 'Inactive care scope accepted';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
BEGIN UPDATE public.clients SET lifecycle_status='archiviert' WHERE id=c;PERFORM care_private.capture_medication_source(tr,req,p);RAISE EXCEPTION 'Archived client replay accepted';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
BEGIN UPDATE auth.sessions SET not_after=clock_timestamp()-interval '1 second' WHERE id=s;PERFORM care_private.confirm_medication_source_capture(src,req);RAISE EXCEPTION 'Ended session accepted';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
BEGIN PERFORM care_private.confirm_medication_source_capture(src,gen_random_uuid());RAISE EXCEPTION 'Other request confirmed';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
-- Same captured source then passes the native source binding and atomic worker receipt path.
v:=care_private.prepare_medication_source_proof(src);
wp:=jsonb_build_object('schemaVersion',1,'requestId',gen_random_uuid(),'record',(v-'archiveId'-'verificationState')||jsonb_build_object('archivePath','tenant/'||t||'/clients/'||c||'/medication-sources/'||src||'/'||h||'.bin'),'caller',claims,'verifiedSha256',h,'verifiedSize',3);
PERFORM set_config('request.jwt.claims',worker_claims::text,true);arc:=care_private.commit_medication_source_proof(wp);
PERFORM set_config('request.jwt.claims',claims::text,true);
v:=care_private.prepare_medication_source_proof(src);
IF v->>'archiveId'<>arc::text OR (SELECT count(*) FROM care_private.medication_archive_proof_receipts WHERE source_id=src)<>1 OR care_private.confirm_medication_source_capture(src,req) IS DISTINCT FROM captured THEN RAISE EXCEPTION 'Capture/archive connected SQL flow failed';END IF;
IF care_private.recover_medication_source_proof(src,(wp->>'requestId')::uuid)->>'archiveId'<>arc::text THEN RAISE EXCEPTION 'Own committed archive receipt not recoverable';END IF;
BEGIN
 UPDATE public.medications SET prescribed_dose='2' WHERE id=tr;
 UPDATE public.client_documents SET title='Later document version' WHERE id=doc;
 v:=care_private.recover_medication_source_proof(src,(wp->>'requestId')::uuid);
 IF v->>'archiveId'<>arc::text OR v->>'verificationState'<>'recorded_worker_receipt' OR v->>'sourceFingerprint'<>wp#>>'{record,sourceFingerprint}' THEN RAISE EXCEPTION 'Historical exact request not recovered';END IF;
 PERFORM care_private.prepare_medication_source_proof(src);RAISE EXCEPTION 'Historical receipt promoted to current source';
EXCEPTION WHEN check_violation THEN NULL;END;
BEGIN UPDATE public.medication_source_archives SET content_sha256=repeat('0',64) WHERE id=arc;PERFORM care_private.recover_medication_source_proof(src,(wp->>'requestId')::uuid);RAISE EXCEPTION 'Corrupted recovered archive accepted';EXCEPTION WHEN check_violation THEN NULL;END;
BEGIN PERFORM care_private.recover_medication_source_proof(gen_random_uuid(),(wp->>'requestId')::uuid);RAISE EXCEPTION 'Wrong source recovered';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
IF care_private.recover_medication_source_proof(src,gen_random_uuid()) IS NOT NULL THEN RAISE EXCEPTION 'Unknown archive request invented';END IF;
UPDATE public.profiles SET role_id=null,role_key='unassigned' WHERE id=u;
BEGIN PERFORM care_private.capture_medication_source(tr,req,p);RAISE EXCEPTION 'Capture replay bypassed revoked role';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
BEGIN PERFORM care_private.confirm_medication_source_capture(src,req);RAISE EXCEPTION 'Confirmation bypassed revoked role';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
BEGIN PERFORM care_private.recover_medication_source_proof(src,(wp->>'requestId')::uuid);RAISE EXCEPTION 'Recovery bypassed revoked role';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
IF has_function_privilege('authenticated','public.capture_ambulatory_medication_source(uuid,uuid,jsonb)','EXECUTE') OR has_function_privilege('service_role','public.confirm_ambulatory_medication_source_capture(uuid,uuid)','EXECUTE') THEN RAISE EXCEPTION 'Capture quarantine missing';END IF;
passed:=true;RAISE EXCEPTION USING ERRCODE='Z0001';
EXCEPTION WHEN SQLSTATE 'Z0001' THEN NULL;END;
IF NOT passed OR EXISTS(SELECT 1 FROM public.tenants WHERE id=t) OR EXISTS(SELECT 1 FROM auth.users WHERE id=u) THEN RAISE EXCEPTION 'Test or cleanup failed';END IF;
END $test$;


