DO $check$
DECLARE f oid;
BEGIN
 FOREACH f IN ARRAY ARRAY['care_security.gkv_portal_snapshot_matches(jsonb,text)'::regprocedure::oid,'care_security.gkv_portal_signature_matches(jsonb,uuid,uuid,text)'::regprocedure::oid] LOOP
  IF has_function_privilege('anon',f,'EXECUTE') OR has_function_privilege('authenticated',f,'EXECUTE') OR has_function_privilege('service_role',f,'EXECUTE')
    OR (SELECT prosecdef FROM pg_proc WHERE oid=f) THEN RAISE EXCEPTION 'Evidence helper exposed'; END IF;
 END LOOP;
 FOREACH f IN ARRAY ARRAY['public.employee_portal_release_deferred_signature(uuid,uuid,uuid,text,jsonb,text)'::regprocedure::oid,
 'public.client_portal_finalize_assist_proof(uuid,uuid,uuid,text,text,text,text)'::regprocedure::oid] LOOP
  IF has_function_privilege('anon',f,'EXECUTE') OR NOT has_function_privilege('authenticated',f,'EXECUTE') OR has_function_privilege('service_role',f,'EXECUTE') THEN
    RAISE EXCEPTION 'Unexpected portal action grants'; END IF;
 END LOOP;
END $check$;
