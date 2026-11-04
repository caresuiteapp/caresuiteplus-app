-- Staging upgrade only. Verify the reviewed source and preceding staging installation.
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='15s';
SET LOCAL search_path=pg_catalog,public;
DO $target$ DECLARE sig regprocedure:='public.employee_portal_release_deferred_signature(uuid,uuid,uuid,text,jsonb,text)'::regprocedure;
BEGIN
 IF NOT EXISTS(SELECT FROM supabase_migrations.schema_migrations WHERE version='20261104083006'
 AND name='gkv_staging_exchange_revisions_and_proof_helpers' AND encode(sha256(convert_to(statements[1],'UTF8')),'hex')=
 '3406ec5c77968673ec05e8a6ae81da71b454eb0944eb0e46a6b8f4d9061b0af0') THEN RAISE EXCEPTION 'Unexpected staging history'; END IF;
 IF encode(sha256(convert_to(pg_get_functiondef(sig),'UTF8')),'hex') IS DISTINCT FROM 'd1a1ad37427111a0bcb0479064b3b560cdf2cfcbc9932755e472784d368149e4'
 OR has_function_privilege('anon',sig,'EXECUTE') OR has_function_privilege('service_role',sig,'EXECUTE')
 OR NOT has_function_privilege('authenticated',sig,'EXECUTE') THEN RAISE EXCEPTION 'Unexpected release function or grants'; END IF;
END $target$;
