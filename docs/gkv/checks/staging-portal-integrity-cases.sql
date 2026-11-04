-- Continuation of the employee rollback fixture: generate a separate real client-role
-- database session. No email, passwords, real user data or Storage writes.
DO $setup$
DECLARE f jsonb:=current_setting('gkv_qa.pr')::jsonb; t uuid:=(f->>'t')::uuid;c uuid:=(f->>'c')::uuid;
 v uuid:=(f->>'v')::uuid;p uuid:=(f->>'p')::uuid;
 u uuid:=gen_random_uuid();sess uuid:=gen_random_uuid();acc uuid:=gen_random_uuid();sg uuid:=gen_random_uuid();
 snap jsonb:=f->'snap'; signed jsonb; at_time timestamptz:=date_trunc('milliseconds',clock_timestamp()); iso text;
 claims jsonb; image_path text:='tenant/'||t||'/assist/visits/'||v||'/signatures/'||sg||'.png';
BEGIN
 IF EXISTS(SELECT FROM pg_trigger tg WHERE NOT tg.tgisinternal
   AND tg.tgrelid=ANY(ARRAY['public.client_portal_access'::regclass,'public.assist_visit_signatures'::regclass,
     'public.assist_visit_execution_state'::regclass,'public.audit_logs'::regclass])
   AND (tg.tgfoid<>'public.set_updated_at()'::regprocedure OR pg_get_functiondef(tg.tgfoid) NOT LIKE '%NEW.updated_at = NOW();%')) THEN
   RAISE EXCEPTION 'Review trigger side effects before using fixture'; END IF;
 INSERT INTO auth.users(id,email,aud,role) VALUES(u,u||'@example.invalid','authenticated','authenticated');
 UPDATE public.profiles SET tenant_id=t,auth_user_id=u,role_key='client_portal',role_id=(SELECT id FROM public.roles WHERE key='client_portal'),
 status='active',is_active=true WHERE id=u;
 INSERT INTO auth.sessions(id,user_id,aal,created_at,updated_at,not_after) VALUES(sess,u,'aal1',now(),now(),now()+interval '3 minutes');
 INSERT INTO public.client_portal_access(id,tenant_id,client_id,portal_enabled,status,auth_user_id) VALUES(acc,t,c,true,'aktiv',u);
 UPDATE public.assist_visits SET planning_status='published' WHERE id=v AND tenant_id=t;
 iso:=to_char(at_time AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
 signed:=snap||jsonb_build_object('signatureDeferredToClientPortal',false,'clientPortalSignedAt',iso,'signedViaClientPortal',true,'clientPortalPdfSignatureId',sg,
   'signerName','Testperson','signedAt',iso,'signature',jsonb_build_object('signerName','Testperson','signedAt',iso,'signerRole','client'));
 INSERT INTO public.assist_visit_signatures(id,tenant_id,visit_id,signer_name,signer_role,storage_path,payload_hash,signature_hash,signed_at,is_valid,metadata)
 VALUES(sg,t,v,'Testperson','client',image_path,'sha256:'||encode(sha256(convert_to(public.workflow_canonical_json(jsonb_build_object('visitId',v,'clientId',c,
  'employeeId',f->>'emp','plannedStartAt',snap->>'plannedStartAt','plannedEndAt',snap->>'plannedEndAt','taskStatuses','[]'::jsonb,'documentationNote',snap->>'documentationNote')),'UTF8')),'hex'),
  'sha256:'||repeat('f',64),at_time,true,jsonb_build_object('proofId',p,'signedVia','client_portal','proofPayloadHash',f->>'h'));
 claims:=jsonb_build_object('sub',u,'session_id',sess,'role','authenticated','aal','aal1',
  'app_metadata',jsonb_build_object('portal_account_id',acc,'portal_type','client','role_key','client_portal'));
 PERFORM set_config('gkv_qa.client',jsonb_build_object('sg',sg,'claims',claims,'finalHash','sha256:'||encode(sha256(convert_to(public.workflow_canonical_json(signed),'UTF8')),'hex'),
   'path','tenant/'||t||'/assist/visits/'||v||'/proofs/'||p||'-'||sg||'-fixture.pdf')::text,true);
END $setup$;
SET LOCAL ROLE authenticated;
DO $cases$
DECLARE f jsonb:=current_setting('gkv_qa.pr')::jsonb; z jsonb:=current_setting('gkv_qa.client')::jsonb;
 t uuid:=(f->>'t')::uuid;p uuid:=(f->>'p')::uuid;c uuid:=(f->>'c')::uuid; sg uuid:=(z->>'sg')::uuid;
BEGIN
 BEGIN
  PERFORM public.employee_portal_release_deferred_signature(t,p,c,'Falscher Hash',f->'snap',repeat('a',64));
  RAISE EXCEPTION 'A forged employee hash was accepted';
 EXCEPTION WHEN invalid_parameter_value THEN
  IF SQLERRM NOT LIKE 'Nachweisinhalt, Prüfsumme%' THEN RAISE; END IF;
 END;
 PERFORM set_config('request.jwt.claims',(z->'claims')::text,true);
 IF public.current_client_id() IS DISTINCT FROM c OR public.is_client_portal_rls_context(t) IS NOT TRUE THEN RAISE EXCEPTION 'Wrong client identity'; END IF;
 BEGIN
  PERFORM public.client_portal_finalize_assist_proof(t,p,sg,f->>'h',repeat('a',64),z->>'path',repeat('f',64));
  RAISE EXCEPTION 'A forged final hash was accepted';
 EXCEPTION WHEN invalid_parameter_value THEN
  IF SQLERRM NOT LIKE 'Prüfsumme der unterschriebenen%' THEN RAISE; END IF;
 END;
 BEGIN
  PERFORM public.client_portal_finalize_assist_proof(t,p,sg,f->>'h',z->>'finalHash',z->>'path',repeat('f',64));
  RAISE EXCEPTION 'A proof completed without stored bytes';
 EXCEPTION WHEN raise_exception THEN
  IF SQLERRM<>'Nachweisdatei wurde noch nicht übertragen' THEN RAISE; END IF;
 END;
END $cases$;
RESET ROLE;
DO $unchanged$
DECLARE f jsonb:=current_setting('gkv_qa.pr')::jsonb;p uuid:=(f->>'p')::uuid;t uuid:=(f->>'t')::uuid;
BEGIN
 IF NOT EXISTS(SELECT FROM public.assist_visit_proofs WHERE id=p AND tenant_id=t AND portal_release_status='pending_client_signature'
    AND signature_id IS NULL AND pdf_storage_path IS NULL AND payload_hash=f->>'h' AND payload_snapshot=f->'snap')
 OR NOT EXISTS(SELECT FROM public.client_documents WHERE id=p AND tenant_id=t AND signature_required AND signed_at IS NULL AND storage_path IS NULL)
 OR EXISTS(SELECT FROM public.audit_logs WHERE tenant_id=t AND table_name='assist_visit_proofs' AND record_id=p AND action='signature')
 THEN RAISE EXCEPTION 'A rejected request changed proof, document or audit'; END IF;
END $unchanged$;
SELECT 'passed' AS staging_employee_client_integrity_rolled_back;
