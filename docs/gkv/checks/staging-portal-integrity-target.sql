-- Read catalog and migration history only. Prepend to the forward patch on the reviewed staging target.
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='30s';
SET LOCAL search_path=pg_catalog,public;
DO $gate$
DECLARE row record; proc oid;
BEGIN
 IF NOT EXISTS(SELECT FROM supabase_migrations.schema_migrations WHERE version='20261104084820'
   AND encode(sha256(convert_to(statements[1],'UTF8')),'hex')='85f68ed33f768e360c1fa05fa40f06d097b7f68e800c993fa11c94ea2b125631') THEN
   RAISE EXCEPTION 'Incorrect staging baseline'; END IF;
 FOR row IN SELECT * FROM (VALUES
   ('public.employee_portal_release_deferred_signature(uuid,uuid,uuid,text,jsonb,text)','91ccab50c9bf157b70628bc7bafeeade932091899ad5c73d7fac5fb3719ddac6',true),
   ('public.client_portal_finalize_assist_proof(uuid,uuid,uuid,text,text,text,text)','87647e6f35097a25c28c3739ffa06f6537fc06474ee19cc0fb0b8415cf479304',true),
   ('public.workflow_canonical_json(jsonb)','91bc458219251903eaac0a679c5d9d9b94d5f64f607c1c34ec2054f973865203',false)) AS x(sig,digest,portal) LOOP
    proc:=to_regprocedure(row.sig);
    IF proc IS NULL OR encode(sha256(convert_to(pg_get_functiondef(proc),'UTF8')),'hex') IS DISTINCT FROM row.digest
      OR has_function_privilege('authenticated',proc,'EXECUTE') IS DISTINCT FROM row.portal
      OR has_function_privilege('anon',proc,'EXECUTE') OR has_function_privilege('service_role',proc,'EXECUTE') THEN
      RAISE EXCEPTION 'Changed staging function or grants: %',row.sig; END IF;
 END LOOP;
 IF to_regprocedure('care_security.gkv_portal_snapshot_matches(jsonb,text)') IS NOT NULL
 OR to_regprocedure('care_security.gkv_portal_signature_matches(jsonb,uuid,uuid,text)') IS NOT NULL THEN
    RAISE EXCEPTION 'Refusing to replace existing evidence functions'; END IF;
END $gate$;
