-- PostgREST 14 retries SQLSTATE 40001 indefinitely, including deliberate
-- application conflicts. Keep private SQL contracts, map the reviewed public
-- JSON RPC boundaries to explicit HTTP 409 without changing authorization.
-- https://supabase.com/kb/troubleshooting/high-cpu-and-infinite-transaction-retries-when-using-custom-error-codes-in-rpc-functions-77326b
DO $migration$
DECLARE name text; f record; expression text;
BEGIN
 FOREACH name IN ARRAY ARRAY[
  'gkv_assist_amend_description','gkv_assist_amendment_state','gkv_assist_original_context','gkv_assist_original_seal',
  'gkv_employee_command','gkv_employee_request_status','gkv_employee_workspace',
  'gkv_monthly_authority_command','gkv_monthly_clients','gkv_monthly_proof_command','gkv_monthly_request_status',
  'gkv_monthly_sources','gkv_monthly_worker_command','gkv_monthly_workspace','office_invoice_mutation'
 ] LOOP
  IF (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname=name)<>1 THEN
   RAISE EXCEPTION 'Unreviewed RPC overload: %',name; END IF;
  SELECT p.*,l.lanname INTO f FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace JOIN pg_language l ON l.oid=p.prolang
   WHERE n.nspname='public' AND p.proname=name;
  IF f.prosecdef OR f.lanname<>'sql' OR f.prorettype<>'jsonb'::regtype OR f.proretset
   OR btrim(f.prosrc,E' \t\r\n') !~ ('^SELECT care_security[.]'||name||'[(][a-z_ ,]*[)]$') THEN
   RAISE EXCEPTION 'Unreviewed RPC implementation: %',name; END IF;
  expression:=btrim(f.prosrc,E' \t\r\n');
  EXECUTE format('CREATE OR REPLACE FUNCTION public.%I(%s) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS %L',
   name,pg_get_function_arguments(f.oid),
   'BEGIN RETURN ('||expression||'); EXCEPTION WHEN serialization_failure THEN RAISE SQLSTATE ''PT409'' USING MESSAGE=SQLERRM; END');
 END LOOP;
END $migration$;
NOTIFY pgrst,'reload schema';
