-- Assert the actual grants (including role membership and project default ACLs).
DO $acl$
DECLARE r text; rel text; privilege text; f text; app_call boolean; read_ok boolean;
BEGIN
 IF NOT has_schema_privilege('authenticated','care_security','USAGE') THEN
   RAISE EXCEPTION 'Caller cannot reach the scoped authorization functions'; END IF;
 FOREACH rel IN ARRAY ARRAY['public.gkv_exchange_batches','public.gkv_exchange_settings','public.gkv_exchange_directories',
    'public.gkv_exchange_events','public.gkv_exchange_revisions','care_security.gkv_exchange_requests'] LOOP
   IF (SELECT relrowsecurity FROM pg_class WHERE oid=rel::regclass) IS NOT TRUE THEN RAISE EXCEPTION 'Missing RLS: %',rel; END IF;
   IF (SELECT count(*) FROM pg_policy WHERE polrelid=rel::regclass)<>(CASE WHEN rel LIKE 'public.%' THEN 1 ELSE 0 END)
     OR (rel LIKE 'public.%' AND NOT EXISTS(SELECT FROM pg_policy WHERE polrelid=rel::regclass AND polname='gkv_exchange_read'
      AND polcmd='r' AND polroles=ARRAY['authenticated'::regrole::oid] AND pg_get_expr(polqual,polrelid) LIKE '%gkv_exchange_actor(tenant_id,%office.invoices.view%')) THEN
     RAISE EXCEPTION 'Unexpected RLS policy: %',rel; END IF;
   FOREACH r IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
     FOREACH privilege IN ARRAY ARRAY['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER','MAINTAIN'] LOOP
       read_ok:=(rel LIKE 'public.%' AND r='authenticated' AND privilege='SELECT');
       IF has_table_privilege(r,rel,privilege) IS DISTINCT FROM read_ok THEN
         RAISE EXCEPTION 'Unexpected effective grant: % % %',r,rel,privilege; END IF;
     END LOOP;
   END LOOP;
 END LOOP;
 FOREACH f IN ARRAY ARRAY['public.gkv_exchange_command(uuid,uuid,text,jsonb)','public.gkv_exchange_export_allowed(uuid)',
 'public.gkv_exchange_copy_revision(uuid,uuid,jsonb)','care_security.gkv_exchange_actor(uuid,text)',
 'care_security.gkv_exchange_command(uuid,uuid,text,jsonb)','care_security.gkv_exchange_copy_revision(uuid,uuid,jsonb)',
 'care_security.gkv_exchange_capture_revision()','public.workflow_record_actor_allowed(uuid,uuid)','public.workflow_task_state(text)',
 'public.workflow_tasks_match(jsonb,uuid,uuid,uuid,boolean)','public.workflow_canonical_json(jsonb)'] LOOP
   app_call:=f NOT LIKE 'public.workflow_%' AND f<>'care_security.gkv_exchange_capture_revision()';
   IF NOT EXISTS(SELECT FROM pg_proc WHERE oid=f::regprocedure AND proconfig @> ARRAY['search_path=pg_catalog']) THEN
     RAISE EXCEPTION 'Unexpected function search path: %',f; END IF;
   FOREACH r IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
     IF has_function_privilege(r,f,'EXECUTE') IS DISTINCT FROM (r='authenticated' AND app_call) THEN
       RAISE EXCEPTION 'Unexpected execution: % %',r,f; END IF;
   END LOOP;
 END LOOP;
END $acl$;
