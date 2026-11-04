-- Only PostgreSQL catalog data; includes existing broad AS PERMISSIVE rules.
WITH rows(k,v) AS (
 SELECT 'policy/'||polname, jsonb_build_array(polcmd,polpermissive,ARRAY(SELECT CASE WHEN x=0 THEN 'PUBLIC' ELSE pg_get_userbyid(x)::text END FROM unnest(polroles) x ORDER BY 1),pg_get_expr(polqual,polrelid),pg_get_expr(polwithcheck,polrelid))
 FROM pg_policy WHERE polrelid='storage.objects'::regclass
 UNION ALL SELECT 'function/'||s,to_jsonb(pg_get_functiondef(to_regprocedure(s))) FROM unnest(ARRAY[
  'public.current_client_id()','public.current_portal_type()','public.current_role_key()','public.current_portal_account_id()',
  'public.current_tenant_id()','public.is_client_portal_rls_context(uuid)','account_security.allowed_session()','auth.uid()']) s
 UNION ALL SELECT 'table/'||c.oid::regclass::text,jsonb_build_array(c.relrowsecurity,
  (SELECT jsonb_agg(jsonb_build_array(a.attname,format_type(a.atttypid,a.atttypmod),a.attnotnull) ORDER BY a.attnum)
    FROM pg_attribute a WHERE a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped))
 FROM pg_class c WHERE c.oid=ANY(ARRAY['storage.objects'::regclass,'public.client_portal_access'::regclass,'public.client_portal_codes'::regclass,
  'public.assist_visits'::regclass,'public.assist_visit_proofs'::regclass,'public.assist_visit_signatures'::regclass])
)
SELECT encode(sha256(convert_to(jsonb_agg(jsonb_build_array(k,v) ORDER BY k COLLATE "C")::text,'UTF8')),'hex') AS digest FROM rows;
