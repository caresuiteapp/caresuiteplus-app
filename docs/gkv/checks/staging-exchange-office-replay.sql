-- Staging only. Entire SQL capability must be sent as ONE transaction, including ROLLBACK.
-- Generated identifiers, no passwords, no credentials, email, file or network transport.
-- Real auth.uid(), session/tenant checks, application role, office_actor, RLS and triggers.
BEGIN;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='20s';
SET LOCAL search_path=pg_catalog,public;
DO $setup$
DECLARE h text; t uuid:=gen_random_uuid(); t2 uuid:=gen_random_uuid(); u uuid:=gen_random_uuid(); u2 uuid:=gen_random_uuid();
 se uuid:=gen_random_uuid(); se2 uuid:=gen_random_uuid(); ro uuid:=gen_random_uuid(); batch uuid:=gen_random_uuid(); rkey text:='gkv_fixture_'||ro;
BEGIN
 IF NOT EXISTS(SELECT FROM supabase_migrations.schema_migrations WHERE version='20261104083006'
   AND name='gkv_staging_exchange_revisions_and_proof_helpers'
   AND encode(sha256(convert_to(statements[1],'UTF8')),'hex')='3406ec5c77968673ec05e8a6ae81da71b454eb0944eb0e46a6b8f4d9061b0af0') THEN
   RAISE EXCEPTION 'Unexpected migration target'; END IF;
 SELECT fingerprint INTO h FROM (WITH callbacks AS (
 SELECT n.nspname||'.'||c.relname AS rel,t.tgname,pg_get_triggerdef(t.oid,false) def,t.tgenabled,pg_get_functiondef(t.tgfoid) body
 FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE NOT t.tgisinternal AND t.tgrelid=ANY(ARRAY['auth.users'::regclass,'auth.sessions'::regclass,'public.profiles'::regclass,'public.tenants'::regclass,'public.roles'::regclass,'public.role_permissions'::regclass,'public.gkv_exchange_batches'::regclass,'public.gkv_exchange_events'::regclass,'public.gkv_exchange_revisions'::regclass,'care_security.gkv_exchange_requests'::regclass])
) SELECT encode(sha256(convert_to(jsonb_agg(to_jsonb(c) ORDER BY rel COLLATE "C",tgname COLLATE "C")::text,'UTF8')),'hex') fingerprint FROM callbacks c) c;
 IF h IS DISTINCT FROM '03f3e68f13c3d6901ac70f07e516961c51287877478e256815f6a8415f9cdfef' THEN RAISE EXCEPTION 'Review trigger side effects before replay'; END IF;
 INSERT INTO public.tenants(id,name) VALUES(t,'GKV-SQL-Prüfung A'),(t2,'GKV-SQL-Prüfung B');
 INSERT INTO public.roles(id,key,name,is_admin_role) VALUES(ro,rkey,'GKV-Prüfrolle',false);
 INSERT INTO public.role_permissions(role_id,permission_key,can_view) VALUES(ro,'office.invoices.view',true),(ro,'office.invoices.create',true);
 INSERT INTO auth.users(id,email,aud,role) VALUES(u,u||'@example.invalid','authenticated','authenticated'),(u2,u2||'@example.invalid','authenticated','authenticated');
 UPDATE public.profiles SET tenant_id=CASE WHEN id=u THEN t ELSE t2 END,auth_user_id=id,role_id=ro,role_key=rkey,status='active',is_active=true WHERE id IN (u,u2);
 IF NOT FOUND OR (SELECT count(*) FROM public.profiles WHERE id IN (u,u2) AND role_id=ro)<>2 THEN RAISE EXCEPTION 'Test profile missing'; END IF;
 INSERT INTO auth.sessions(id,user_id,aal,created_at,updated_at,not_after) VALUES
   (se,u,'aal1',now(),now(),now()+interval '5 minutes'),(se2,u2,'aal1',now(),now(),now()+interval '5 minutes');
 PERFORM set_config('gkv_qa.fixture',jsonb_build_object('t',t,'t2',t2,'u',u,'u2',u2,'s',se,'s2',se2,'b',batch)::text,true);
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',u,'session_id',se,'role','authenticated','aal','aal1','app_metadata',jsonb_build_object('portal_type','business'))::text,true);
END $setup$;
SET LOCAL ROLE authenticated;
DO $business$
DECLARE f jsonb:=current_setting('gkv_qa.fixture')::jsonb; t uuid:=(f->>'t')::uuid; t2 uuid:=(f->>'t2')::uuid;
 b uuid:=(f->>'b')::uuid; req uuid:=gen_random_uuid(); copied uuid:=gen_random_uuid(); input jsonb; saved jsonb; receipt jsonb;
BEGIN
 IF auth.uid() IS DISTINCT FROM (f->>'u')::uuid OR public.current_tenant_id() IS DISTINCT FROM t
   OR public.gkv_exchange_export_allowed(t) IS NOT TRUE OR public.gkv_exchange_export_allowed(t2) IS NOT FALSE THEN
   RAISE EXCEPTION 'Office identity is not tenant scoped'; END IF;
 input:=jsonb_build_object('new_id',b,'draft',jsonb_build_object(
  'profile','{"providerIk":"","senderIk":"","name":"Prüfprofil","billingCode":"","tariffCode":"","fundType":"EK","stateCode":"05","taxExemptionCode":"","ambulatoryProvider":false,"employeeNumberRequired":true}'::jsonb,
  'mode','test','channel','classic','serviceType','09','payerIk','','insuranceIk','','receiverIk','','physicalReceiverIk','',
  'month','2026-11','createdAt','2026-11-04T00:00:00Z','sequence',1,'transferNumber',1,'interchangeReference',1,'correction',0,'cases','[]'::jsonb));
 saved:=public.gkv_exchange_command(t,req,'save',input);
 IF saved->>'id' IS DISTINCT FROM b::text OR saved->>'status' IS DISTINCT FROM 'draft' OR saved->>'revision' IS DISTINCT FROM '1'
   OR saved IS DISTINCT FROM public.gkv_exchange_command(t,req,'save',input) THEN RAISE EXCEPTION 'Draft or replay differs'; END IF;
 BEGIN
   PERFORM public.gkv_exchange_command(t,gen_random_uuid(),'cancel',jsonb_build_object('id',b,'revision',0));
   RAISE EXCEPTION 'Stale revision accepted'; EXCEPTION WHEN serialization_failure THEN NULL;
 END;
 -- A manual note must not set an insurer's acceptance or receipt, even if asked to.
 PERFORM public.gkv_exchange_command(t,gen_random_uuid(),'feedback_note',jsonb_build_object('id',b,'revision',1,'text','Prüfvermerk','status','accepted','verified',true));
 SELECT details INTO STRICT receipt FROM public.gkv_exchange_events WHERE tenant_id=t AND batch_id=b AND event_type='feedback_note';
 IF receipt->'verified' IS DISTINCT FROM 'false'::jsonb THEN RAISE EXCEPTION 'Manual note marked as verified'; END IF;
 saved:=public.gkv_exchange_copy_revision(t,gen_random_uuid(),jsonb_build_object('batch_id',b,'expected_revision',1,'source_revision',1,'new_id',copied,'reason','Erneute Prüfung'));
 IF saved->>'origin_batch_id' IS DISTINCT FROM b::text OR saved->>'status' IS DISTINCT FROM 'draft'
   OR (SELECT count(*) FROM public.gkv_exchange_revisions WHERE tenant_id=t AND batch_id IN (b,copied) AND recorded_by=auth.uid())<>2
   OR (SELECT status FROM public.gkv_exchange_batches WHERE id=b) IS DISTINCT FROM 'draft' THEN RAISE EXCEPTION 'Revision record or provenance differs'; END IF;
 BEGIN
   UPDATE public.gkv_exchange_batches SET status='accepted' WHERE tenant_id=t AND id=b;
   RAISE EXCEPTION 'Direct write accepted'; EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',f->>'u2','session_id',f->>'s2','role','authenticated','aal','aal1','app_metadata',jsonb_build_object('portal_type','business'))::text,true);
 IF public.current_tenant_id() IS DISTINCT FROM t2 OR public.gkv_exchange_export_allowed(t2) IS NOT TRUE OR public.gkv_exchange_export_allowed(t) IS NOT FALSE
   OR EXISTS(SELECT FROM public.gkv_exchange_batches WHERE id IN (b,copied))
   OR EXISTS(SELECT FROM public.gkv_exchange_events WHERE batch_id=b)
   OR EXISTS(SELECT FROM public.gkv_exchange_revisions WHERE batch_id=b) THEN RAISE EXCEPTION 'Foreign records visible'; END IF;
 BEGIN
   PERFORM public.gkv_exchange_command(t,req,'save',input);
   RAISE EXCEPTION 'Foreign replay accepted'; EXCEPTION WHEN insufficient_privilege THEN
   IF SQLERRM<>'Abrechnungszugriff erforderlich' THEN RAISE; END IF;
 END;
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',f->>'u','session_id',f->>'s2','role','authenticated','aal','aal1')::text,true);
 IF public.current_tenant_id() IS NOT NULL OR public.gkv_exchange_export_allowed(t) IS NOT FALSE THEN RAISE EXCEPTION 'Session belongs to another user'; END IF;
END $business$;
SELECT 'passed' AS staging_office_two_tenants_rolled_back;
ROLLBACK;
