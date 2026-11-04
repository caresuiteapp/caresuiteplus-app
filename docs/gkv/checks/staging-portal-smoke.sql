-- Real PostgreSQL / deployed staging RPCs. No identity, no application rows.
-- A forbidden action must fail for the expected reason; unexpected errors propagate.
BEGIN READ ONLY;
SET LOCAL search_path=pg_catalog, public;
SET LOCAL statement_timeout='10s';
SET LOCAL request.jwt.claims='{}';
DO $acl$
DECLARE f regprocedure; r text; p text;
BEGIN
  FOREACH f IN ARRAY ARRAY[
   'public.employee_portal_release_deferred_signature(uuid,uuid,uuid,text,jsonb,text)'::regprocedure,
   'public.client_portal_finalize_assist_proof(uuid,uuid,uuid,text,text,text,text)'::regprocedure,
   'public.client_portal_can_read_assist_signature(text)'::regprocedure,
   'public.client_portal_can_upload_proof_recovery(text)'::regprocedure
  ] LOOP
    IF NOT has_function_privilege('authenticated',f,'EXECUTE') OR has_function_privilege('anon',f,'EXECUTE')
      OR has_function_privilege('service_role',f,'EXECUTE') THEN RAISE EXCEPTION 'Unexpected execute permission: %',f; END IF;
  END LOOP;
  IF NOT (SELECT c.relrowsecurity FROM pg_class c WHERE c.oid='public.audit_logs'::regclass)
    OR NOT (SELECT c.relrowsecurity FROM pg_class c WHERE c.oid='storage.objects'::regclass)
    OR (SELECT count(*) FROM pg_policy p WHERE p.polrelid='storage.objects'::regclass AND p.polroles=ARRAY['authenticated'::regrole::oid]
      AND ((p.polname='assist_signature_client_read' AND p.polcmd='r') OR (p.polname='assist_proof_client_recovery_insert' AND p.polcmd='a')))<>2 THEN
    RAISE EXCEPTION 'Expected portal row-security policies are missing';
  END IF;
  FOREACH r IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
    FOREACH p IN ARRAY ARRAY['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER','MAINTAIN'] LOOP
      IF has_table_privilege(r,'public.audit_logs',p) THEN RAISE EXCEPTION 'Unexpected audit access: % %',r,p; END IF;
    END LOOP;
  END LOOP;
END $acl$;
SET LOCAL ROLE authenticated;
DO $no_session$
BEGIN
  IF auth.uid() IS NOT NULL THEN RAISE EXCEPTION 'Smoke check requires a session without a user'; END IF;
  BEGIN
    PERFORM public.employee_portal_release_deferred_signature(NULL,NULL,NULL,NULL,NULL,NULL);
    RAISE EXCEPTION 'Employee RPC accepted missing identity' USING ERRCODE='XX000';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'employee_portal_release_deferred_signature: authentication required' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM public.client_portal_finalize_assist_proof(NULL,NULL,NULL,NULL,NULL,NULL,NULL);
    RAISE EXCEPTION 'Client RPC accepted missing identity' USING ERRCODE='XX000';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'Keine Berechtigung für diese Unterschrift' THEN RAISE; END IF;
  END;
  IF public.client_portal_can_read_assist_signature('synthetic/not-an-object') IS NOT FALSE
    OR public.client_portal_can_upload_proof_recovery('synthetic/not-an-object') IS NOT FALSE THEN
    RAISE EXCEPTION 'Storage accepted a request without a user';
  END IF;
END $no_session$;
SELECT 'passed' AS staging_portal_acl_and_no_session_check;
ROLLBACK;
