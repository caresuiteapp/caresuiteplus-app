-- Real roles, temporary synthetic identity, no sign-in, no Storage rows/files. Run as a single rollback transaction.
BEGIN;
SET LOCAL lock_timeout='3s'; SET LOCAL statement_timeout='15s'; SET LOCAL search_path=pg_catalog,public;
DO $seed$ DECLARE t uuid:=gen_random_uuid(); u uuid:=gen_random_uuid(); se uuid:=gen_random_uuid(); emp uuid:=gen_random_uuid(); snap jsonb;
 ac uuid:=gen_random_uuid(); c uuid:=gen_random_uuid(); v uuid:=gen_random_uuid(); p uuid:=gen_random_uuid();
BEGIN
 IF NOT EXISTS(SELECT FROM supabase_migrations.schema_migrations WHERE version='20261104083006' AND name='gkv_staging_exchange_revisions_and_proof_helpers'
   AND encode(sha256(convert_to(statements[1],'UTF8')),'hex')='3406ec5c77968673ec05e8a6ae81da71b454eb0944eb0e46a6b8f4d9061b0af0') THEN RAISE EXCEPTION 'Wrong staging target'; END IF;
 IF (SELECT fingerprint FROM (WITH callbacks AS (
 SELECT n.nspname||'.'||c.relname AS rel,t.tgname,pg_get_triggerdef(t.oid,false) def,t.tgenabled,pg_get_functiondef(t.tgfoid) body
 FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE NOT t.tgisinternal AND t.tgrelid=ANY(ARRAY['auth.users'::regclass,'auth.sessions'::regclass,'public.profiles'::regclass,'public.tenants'::regclass,'public.roles'::regclass,'public.role_permissions'::regclass,'public.employees'::regclass,'public.employee_portal_accounts'::regclass,'public.clients'::regclass,'public.client_documents'::regclass,'public.assist_visits'::regclass,'public.assignments'::regclass,'public.assist_visit_proofs'::regclass])
) SELECT encode(sha256(convert_to(jsonb_agg(to_jsonb(hook) ORDER BY rel COLLATE "C",tgname COLLATE "C")::text,'UTF8')),'hex') fingerprint FROM callbacks hook) callbacks) IS DISTINCT FROM '9aed7be1184262d3933150775c920a8b0fb0e4f300dd3e634e257926f348993a' THEN RAISE EXCEPTION 'Review trigger side effects before running employee fixture'; END IF;
 INSERT INTO public.tenants(id,name) VALUES(t,'GKV-Portalpruefung');
 INSERT INTO auth.users(id,email,aud,role) VALUES(u,u||'@example.invalid','authenticated','authenticated');
 UPDATE public.profiles SET tenant_id=t,role_id=(SELECT id FROM public.roles WHERE key='employee_portal'),role_key='employee_portal',auth_user_id=u,status='active',is_active=true WHERE id=u;
 INSERT INTO auth.sessions(id,user_id,aal,created_at,updated_at,not_after) VALUES(se,u,'aal1',now(),now(),now()+interval '3 minutes');
 INSERT INTO public.employees(id,tenant_id,first_name,last_name,profile_id) VALUES(emp,t,'Synthetisch','Prüfung',u);
 INSERT INTO public.employee_portal_accounts(id,tenant_id,employee_id,username,auth_user_id,status,must_change_password,first_login_completed)
 VALUES(ac,t,emp,'gkv_qa_'||u,u,'blocked',false,true);
 INSERT INTO public.clients(id,tenant_id,first_name,last_name) VALUES(c,t,'Synthetisch','Prüfung');
 INSERT INTO public.assist_visits(id,tenant_id,client_id,employee_id,title,assignment_date,planned_start_at,planned_end_at,planning_status)
 VALUES(v,t,c,emp,'Prüfeinsatz',current_date,current_date,current_date+interval '1 hour','draft');
 INSERT INTO public.assist_visit_proofs(id,tenant_id,visit_id) VALUES(p,t,v);
 snap:=jsonb_build_object('visitId',v,'clientId',c,'employeeId',emp,'title','Pflegeprüfung','documentationNote','Synthetische Prüfung',
   'tasks','[]'::jsonb,'plannedStartAt','2025-11-04T10:00:00.000Z','plannedEndAt','2025-11-04T11:00:00.000Z',
   'signature',null,'signedAt',null,'signerName',null,'signatureDeferredToClientPortal',true);
 PERFORM set_config('gkv_qa.pr',jsonb_build_object('snap',snap,'h','sha256:'||encode(sha256(convert_to(public.workflow_canonical_json(snap),'UTF8')),'hex'),'t',t,'u',u,'se',se,'emp',emp,'ac',ac,'c',c,'v',v,'p',p)::text,true);
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',u,'session_id',se,'role','authenticated','aal','aal1','app_metadata',jsonb_build_object('portal_type','employee','portal_account_id',ac,'role_key','employee_portal'))::text,true);
END $seed$;
SET LOCAL ROLE authenticated;
DO $denied$ DECLARE f jsonb:=current_setting('gkv_qa.pr')::jsonb;
BEGIN
 IF public.is_employee_portal_rls_context((f->>'t')::uuid) IS NOT TRUE THEN RAISE EXCEPTION 'Fixture must reproduce the still-valid portal role'; END IF;
 BEGIN
  PERFORM public.employee_portal_release_deferred_signature((f->>'t')::uuid,(f->>'p')::uuid,(f->>'c')::uuid,'Prüfung',f->'snap',f->>'h');
  RAISE EXCEPTION 'A blocked personal account released a proof'; EXCEPTION WHEN insufficient_privilege THEN
  IF SQLERRM<>'employee_portal_release_deferred_signature: active personal portal account required' THEN RAISE; END IF;
 END;
END $denied$;
RESET ROLE;
DO $enable$ DECLARE f jsonb:=current_setting('gkv_qa.pr')::jsonb;
BEGIN
 IF EXISTS(SELECT FROM public.client_documents WHERE tenant_id=(f->>'t')::uuid AND id=(f->>'p')::uuid)
  OR (SELECT portal_visible FROM public.assist_visit_proofs WHERE tenant_id=(f->>'t')::uuid AND id=(f->>'p')::uuid) IS NOT FALSE THEN RAISE EXCEPTION 'Failed release made a document visible'; END IF;
 UPDATE public.employee_portal_accounts SET status='active' WHERE id=(f->>'ac')::uuid AND tenant_id=(f->>'t')::uuid;
END $enable$;
SET LOCAL ROLE authenticated;
DO $active$ DECLARE f jsonb:=current_setting('gkv_qa.pr')::jsonb; original jsonb:=current_setting('request.jwt.claims')::jsonb; result uuid;
BEGIN
 PERFORM set_config('request.jwt.claims',jsonb_set(original,'{app_metadata,portal_account_id}',to_jsonb(gen_random_uuid()))::text,true);
 BEGIN
  PERFORM public.employee_portal_release_deferred_signature((f->>'t')::uuid,(f->>'p')::uuid,(f->>'c')::uuid,'Prüfung',f->'snap',f->>'h');
  RAISE EXCEPTION 'Wrong portal account released a proof'; EXCEPTION WHEN insufficient_privilege THEN
  IF SQLERRM<>'employee_portal_release_deferred_signature: active personal portal account required' THEN RAISE; END IF;
 END;
 PERFORM set_config('request.jwt.claims',original::text,true);
 result:=public.employee_portal_release_deferred_signature((f->>'t')::uuid,(f->>'p')::uuid,(f->>'c')::uuid,'Prüfung',f->'snap',f->>'h');
 IF result IS DISTINCT FROM (f->>'p')::uuid THEN RAISE EXCEPTION 'Active employee could not release own assigned proof'; END IF;
END $active$;
RESET ROLE;
DO $check$ DECLARE f jsonb:=current_setting('gkv_qa.pr')::jsonb;
BEGIN
 IF NOT EXISTS(SELECT FROM public.client_documents WHERE id=(f->>'p')::uuid AND tenant_id=(f->>'t')::uuid
  AND client_id=(f->>'c')::uuid AND signature_required AND portal_visible AND signed_at IS NULL AND uploaded_by=(f->>'u')::uuid)
  OR NOT EXISTS(SELECT FROM public.assist_visit_proofs WHERE id=(f->>'p')::uuid AND tenant_id=(f->>'t')::uuid
  AND signature_id IS NULL AND portal_release_status='pending_client_signature' AND portal_visible) THEN RAISE EXCEPTION 'Release not written atomically'; END IF;
END $check$;
SELECT 'passed' AS staging_employee_account_release_rolled_back;
ROLLBACK;
