-- Continuation of the rolled-back portal fixture. Use the actual role, policies,
-- row expressions, helper functions and grants on this database. Supply synthetic
-- storage.objects composite values; do not create, list or fetch any stored object.
DO $second$
DECLARE f jsonb:=current_setting('gkv_qa.pr')::jsonb;z jsonb:=current_setting('gkv_qa.client')::jsonb;t uuid:=(f->>'t')::uuid;
 c2 uuid:=gen_random_uuid();v2 uuid:=gen_random_uuid();p2 uuid:=gen_random_uuid();s2 uuid:=gen_random_uuid();
 base text:='tenant/'||t||'/assist/visits/'; dir text:=base||(f->>'v')||'/'; otherdir text:=base||v2||'/'; s1 uuid:=(z->>'sg')::uuid;
BEGIN
 INSERT INTO public.clients(id,tenant_id,first_name,last_name) VALUES(c2,t,'Zweiter','Testklient');
 INSERT INTO public.assist_visits(id,tenant_id,client_id,employee_id,title,assignment_date,planned_start_at,planned_end_at,planning_status)
 VALUES(v2,t,c2,(f->>'emp')::uuid,'Zweiter Prüfeinsatz',current_date,current_date,current_date+interval '1 hour','published');
 INSERT INTO public.assist_visit_proofs(id,tenant_id,visit_id,portal_visible,portal_release_status,payload_hash)
 VALUES(p2,t,v2,true,'pending_client_signature','sha256:'||repeat('c',64));
 INSERT INTO public.assist_visit_signatures(id,tenant_id,visit_id,signer_name,signer_role,storage_path,payload_hash,signature_hash,signed_at,is_valid,metadata)
 VALUES(s2,t,v2,'Zweite Testperson','client',otherdir||'signatures/'||s2||'.png','sha256:'||repeat('d',64),'sha256:'||repeat('e',64),now(),true,
 jsonb_build_object('proofId',p2,'signedVia','client_portal','proofPayloadHash','sha256:'||repeat('c',64)));
 PERFORM set_config('gkv_qa.paths',jsonb_build_object('own',dir||'signatures/'||s1||'.png','new',dir||'signatures/'||gen_random_uuid()||'.png','pending',z->>'path',
   'other',otherdir||'signatures/'||s2||'.png','otherpdf',otherdir||'proofs/'||p2||'-'||s2||'-a.pdf','wrongproof',dir||'proofs/'||p2||'-'||s1||'-a.pdf',
   'server',dir||'server-proofs/'||(f->>'p')||'-'||repeat('b',64)||'.pdf')::text,true);
END $second$;
SET LOCAL ROLE authenticated;
DO $evaluate$
DECLARE f jsonb:=current_setting('gkv_qa.pr')::jsonb;z jsonb:=current_setting('gkv_qa.client')::jsonb;paths jsonb:=current_setting('gkv_qa.paths')::jsonb;
 sample record; val boolean; perm text;rest text; cmd text; observed jsonb:='{}'; enforce boolean:=to_regprocedure('care_security.gkv_portal_object_allowed(text,text,text)') IS NOT NULL;
BEGIN
 IF public.current_client_id() IS DISTINCT FROM (f->>'c')::uuid OR current_user<>'authenticated' OR
   NOT (SELECT relrowsecurity FROM pg_class WHERE oid='storage.objects'::regclass) OR (SELECT rolbypassrls FROM pg_roles WHERE rolname=current_user) THEN RAISE EXCEPTION 'Invalid RLS fixture'; END IF;
 FOR sample IN SELECT * FROM (VALUES ('r','own',true),('r','pending',true),('r','other',false),('r','otherpdf',false),('r','wrongproof',false),('r','server',false),
  ('a','new',true),('a','pending',true),('a','otherpdf',false),('a','server',false),
  ('w','own',false),('w','other',false),('w','pending',false),('d','own',false)
 ) AS cases(op,k,expected) LOOP
  cmd:=CASE sample.op WHEN 'r' THEN 'SELECT' WHEN 'a' THEN 'INSERT' WHEN 'w' THEN 'UPDATE' ELSE 'DELETE' END;
  SELECT string_agg('('||expr||')',' OR ') FILTER(WHERE polpermissive),string_agg('('||expr||')',' AND ') FILTER(WHERE NOT polpermissive)
   INTO perm,rest FROM (
   SELECT polpermissive,COALESCE(CASE WHEN sample.op='a' THEN pg_get_expr(polwithcheck,polrelid) END,pg_get_expr(polqual,polrelid),'true') expr
    FROM pg_policy WHERE polrelid='storage.objects'::regclass AND polcmd::text IN (sample.op,'*')
    AND EXISTS(SELECT FROM unnest(polroles) ro WHERE CASE WHEN ro=0 THEN true ELSE pg_has_role(current_user,ro,'USAGE') END)
   ) applicable;
  EXECUTE 'SELECT COALESCE(('||coalesce(perm,'false')||') AND ('||coalesce(rest,'true')||'),false)
    FROM jsonb_populate_record(NULL::storage.objects,jsonb_build_object(''id'',gen_random_uuid(),''bucket_id'',''office-documents'',''name'',$1::text)) AS objects'
   INTO val USING paths->>sample.k;
  val:=val AND has_table_privilege(current_user,'storage.objects',cmd);
  observed:=observed||jsonb_build_object(sample.op||'_'||sample.k,val);
  IF enforce AND val IS DISTINCT FROM sample.expected THEN RAISE EXCEPTION 'Effective % policy on % = %, expected %',cmd,sample.k,val,sample.expected; END IF;
 END LOOP;
 PERFORM set_config('gkv_qa.policy_result',observed::text,true);
END $evaluate$;
RESET ROLE;
SELECT current_setting('gkv_qa.policy_result')::jsonb AS synthetic_effective_storage_rules;
