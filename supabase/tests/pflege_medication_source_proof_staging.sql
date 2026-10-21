-- Staging only. Synthetic fixtures are rolled back and cleanup is asserted.
-- Staging only. Synthetic JWT claims and database session; no Auth HTTP login.
-- All synthetic data is rolled back inside the anonymous block.
DO $test$ DECLARE t uuid:=gen_random_uuid();u uuid:=gen_random_uuid();s uuid:=gen_random_uuid();r uuid:=gen_random_uuid();e uuid:=gen_random_uuid();c uuid:=gen_random_uuid();tr uuid:=gen_random_uuid();st uuid:=gen_random_uuid();v jsonb;p jsonb;receipt jsonb;replay jsonb;revised jsonb;old_packet jsonb;doc uuid:=gen_random_uuid();src uuid:=gen_random_uuid();arc uuid:=gen_random_uuid();h text:='ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad';mr jsonb;dr jsonb;passed boolean:=false;BEGIN BEGIN
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
v:=care_private.prepare_medication_source_proof(src);
IF v->>'verificationState'<>'bytes_not_verified' OR v->>'archiveId' IS NOT NULL OR v->>'sha256'<>h OR v->>'sourceFingerprint' !~ '^sha256:[0-9a-f]{64}$' OR v->>'orderFingerprint' !~ '^sha256:[0-9a-f]{64}$' OR v->>'documentFingerprint' !~ '^sha256:[0-9a-f]{64}$' THEN RAISE EXCEPTION 'Preparation contract invalid';END IF;
BEGIN UPDATE public.medications SET prescribed_dose='2' WHERE id=tr;PERFORM care_private.prepare_medication_source_proof(src);RAISE EXCEPTION 'Invalid source case 1 accepted';EXCEPTION WHEN check_violation THEN NULL;END;
BEGIN UPDATE public.client_documents SET title='Changed' WHERE id=doc;PERFORM care_private.prepare_medication_source_proof(src);RAISE EXCEPTION 'Invalid source case 2 accepted';EXCEPTION WHEN check_violation THEN NULL;END;
BEGIN UPDATE public.medication_order_sources SET document_snapshot=jsonb_set(document_snapshot,'{updated_at}',to_jsonb(((dr->>'updated_at')::timestamptz+interval '1 microsecond'))) WHERE id=src;PERFORM care_private.prepare_medication_source_proof(src);RAISE EXCEPTION 'Invalid source case 3 accepted';EXCEPTION WHEN check_violation THEN NULL;END;
BEGIN UPDATE public.client_documents SET status='archiviert' WHERE id=doc;PERFORM care_private.prepare_medication_source_proof(src);RAISE EXCEPTION 'Invalid source case 4 accepted';EXCEPTION WHEN check_violation THEN NULL;END;
BEGIN UPDATE public.client_documents SET size_bytes=4 WHERE id=doc;PERFORM care_private.prepare_medication_source_proof(src);RAISE EXCEPTION 'Invalid source case 5 accepted';EXCEPTION WHEN check_violation THEN NULL;END;
BEGIN UPDATE public.medication_order_sources SET document_snapshot=document_snapshot-'content_sha256' WHERE id=src;PERFORM care_private.prepare_medication_source_proof(src);RAISE EXCEPTION 'Invalid source case 6 accepted';EXCEPTION WHEN check_violation THEN NULL;END;
BEGIN UPDATE public.medication_order_sources SET document_snapshot=jsonb_set(document_snapshot,'{content_size}','3.5') WHERE id=src;PERFORM care_private.prepare_medication_source_proof(src);RAISE EXCEPTION 'Invalid source case 7 accepted';EXCEPTION WHEN check_violation THEN NULL;END;
BEGIN UPDATE public.medication_order_sources SET payload=jsonb_set(payload,'{contentSha256}',to_jsonb(repeat('0',64))) WHERE id=src;PERFORM care_private.prepare_medication_source_proof(src);RAISE EXCEPTION 'Invalid source case 8 accepted';EXCEPTION WHEN check_violation THEN NULL;END;
BEGIN UPDATE public.medication_order_sources SET order_snapshot=order_snapshot-'prescribed_dose' WHERE id=src;PERFORM care_private.prepare_medication_source_proof(src);RAISE EXCEPTION 'Invalid source case 9 accepted';EXCEPTION WHEN check_violation THEN NULL;END;
BEGIN UPDATE public.medication_order_sources SET document_snapshot=jsonb_set(document_snapshot,'{content_fingerprint_origin}','"server_verified"') WHERE id=src;PERFORM care_private.prepare_medication_source_proof(src);RAISE EXCEPTION 'Invalid source case 10 accepted';EXCEPTION WHEN check_violation THEN NULL;END;

INSERT INTO public.medication_source_archives(id,tenant_id,source_id,client_id,medication_id,document_id,document_version,original_path,archive_path,content_sha256,content_size,recorded_by,status,finalized_by,created_at,finalized_at)
VALUES(arc,t,src,c,tr,doc,(dr->>'updated_at')::timestamptz,dr->>'storage_path','tenant/'||t||'/clients/'||c||'/medication-sources/'||src||'/'||h||'.bin',h,3,u,'ready',u,clock_timestamp()-interval '1 second',clock_timestamp());
v:=care_private.prepare_medication_source_proof(src);
IF v->>'archiveId'<>arc::text OR v->>'verificationState'<>'bytes_not_verified' THEN RAISE EXCEPTION 'Ready metadata falsely proved file bytes';END IF;
BEGIN UPDATE public.medication_source_archives SET archive_path='wrong' WHERE id=arc;PERFORM care_private.prepare_medication_source_proof(src);RAISE EXCEPTION 'Invalid archive case 1 accepted';EXCEPTION WHEN check_violation THEN NULL;END;
BEGIN UPDATE public.medication_source_archives SET content_size=4 WHERE id=arc;PERFORM care_private.prepare_medication_source_proof(src);RAISE EXCEPTION 'Invalid archive case 2 accepted';EXCEPTION WHEN check_violation THEN NULL;END;
BEGIN UPDATE public.medication_source_archives SET finalized_at=null WHERE id=arc;PERFORM care_private.prepare_medication_source_proof(src);RAISE EXCEPTION 'Invalid archive case 3 accepted';EXCEPTION WHEN check_violation THEN NULL;END;

BEGIN PERFORM care_private.prepare_medication_source_proof(gen_random_uuid());RAISE EXCEPTION 'Unknown source accepted';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
UPDATE public.profiles SET role_id=null,role_key='unassigned' WHERE id=u;
BEGIN PERFORM care_private.prepare_medication_source_proof(src);RAISE EXCEPTION 'Withdrawn permission accepted';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
IF has_function_privilege('authenticated','public.prepare_ambulatory_medication_source_proof(uuid)','EXECUTE') OR has_function_privilege('anon','public.prepare_ambulatory_medication_source_proof(uuid)','EXECUTE') THEN RAISE EXCEPTION 'Quarantine missing';END IF;
passed:=true;RAISE EXCEPTION USING ERRCODE='Z0001';
EXCEPTION WHEN SQLSTATE 'Z0001' THEN NULL;END;
IF NOT passed OR EXISTS(SELECT 1 FROM public.tenants WHERE id=t) OR EXISTS(SELECT 1 FROM auth.users WHERE id=u) THEN RAISE EXCEPTION 'Test or cleanup failed';END IF;
END $test$;


