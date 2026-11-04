-- No tenant, user, session or business data. Must also run after installation.
BEGIN READ ONLY;
SET LOCAL statement_timeout='10s';
SET LOCAL search_path=pg_catalog,public;
SET LOCAL request.jwt.claims='{}';
DO $internal$
BEGIN
 IF public.workflow_record_actor_allowed(NULL,NULL) IS NOT FALSE
   OR public.workflow_tasks_match(NULL,NULL,NULL,NULL,NULL) IS NOT FALSE THEN
   RAISE EXCEPTION 'Proof checks accepted missing scope'; END IF;
 IF public.workflow_canonical_json('{"z":[null,"Grüße"],"a":{"s":1,"b":true}}'::jsonb)
   IS DISTINCT FROM '{"a":{"b":true,"s":1},"z":[null,"Grüße"]}' THEN RAISE EXCEPTION 'Canonical proof differs'; END IF;
END $internal$;
SET LOCAL ROLE authenticated;
DO $no_session$
BEGIN
 IF auth.uid() IS NOT NULL OR public.gkv_exchange_export_allowed(NULL) IS NOT FALSE THEN RAISE EXCEPTION 'Unexpected export access'; END IF;
 BEGIN
   PERFORM public.gkv_exchange_command(NULL,NULL,'save','{}'::jsonb);
   RAISE EXCEPTION 'Missing user accepted'; EXCEPTION WHEN insufficient_privilege THEN
   IF SQLERRM<>'Abrechnungszugriff erforderlich' THEN RAISE; END IF;
 END;
 BEGIN
   PERFORM public.gkv_exchange_copy_revision(NULL,NULL,'{}'::jsonb);
   RAISE EXCEPTION 'Missing user accepted'; EXCEPTION WHEN insufficient_privilege THEN
   IF SQLERRM<>'Abrechnungszugriff erforderlich' THEN RAISE; END IF;
 END;
END $no_session$;
SELECT 'passed' AS staging_exchange_no_session;
ROLLBACK;
