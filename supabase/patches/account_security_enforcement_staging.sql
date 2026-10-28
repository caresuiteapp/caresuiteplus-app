-- STAGING ONLY: controlled test explicitly approved by the user on 28.10.2026.
-- No production rollout, messages or business data writes are authorized by this file.
-- Preserve the exact deployed identity resolvers. The existing function OIDs,
-- grants and original tenant/portal/permission checks remain in place.
DO $migration$
DECLARE name text; definition text; target text; signature text; returns_type text; arguments text; call_arguments text;
BEGIN
 FOR name,signature,returns_type,arguments,call_arguments IN VALUES
  ('current_profile_id','public.current_profile_id()','uuid','',''),
  ('current_tenant_id','public.current_tenant_id()','uuid','',''),
  ('current_role_key','public.current_role_key()','text','',''),
  ('has_permission','public.has_permission(text)','boolean','p_permission_key text','p_permission_key')
 LOOP
  -- Staging has no current_profile_id; do not invent a missing identity resolver.
  IF to_regprocedure(signature) IS NULL THEN CONTINUE; END IF;
  IF to_regprocedure('account_security.original_'||name||'('||CASE WHEN name='has_permission' THEN 'text' ELSE '' END||')') IS NOT NULL THEN
   RAISE EXCEPTION 'An identity resolver is already wrapped; review before applying again';
  END IF;
  definition:=pg_get_functiondef(signature::regprocedure);
  target:='account_security.original_'||name;
  definition:=replace(definition,'FUNCTION public.'||name||'(', 'FUNCTION '||target||'(');
  EXECUTE definition;
  EXECUTE format('REVOKE ALL ON FUNCTION %s(%s) FROM PUBLIC,anon,authenticated,service_role',target,arguments);
  EXECUTE format('ALTER FUNCTION %s(%s) SET search_path=public,pg_temp',target,arguments);
  EXECUTE format('CREATE OR REPLACE FUNCTION public.%I(%s) RETURNS %s LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,account_security AS %L',name,arguments,returns_type,
   'SELECT CASE WHEN (current_setting(''role'',true)=''service_role'' AND auth.jwt()->>''role''=''service_role'') OR account_security.allowed_session() THEN '||target||'('||call_arguments||') ELSE '||CASE WHEN returns_type='boolean' THEN 'false' ELSE 'NULL' END||' END');
 END LOOP;
END $migration$;

-- RLS is an additional restriction, never an access grant. Keep prior policies
-- on all exposed application tables and private Storage objects intact.
DO $policies$
DECLARE row record;
BEGIN
 FOR row IN SELECT n.nspname,c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE c.relkind IN ('r','p') AND c.relrowsecurity AND (n.nspname='public' OR (n.nspname='storage' AND c.relname='objects'))
 LOOP
  EXECUTE format('CREATE POLICY account_security_session_guard ON %I.%I AS RESTRICTIVE FOR ALL TO authenticated USING ((SELECT account_security.allowed_session())) WITH CHECK ((SELECT account_security.allowed_session()))',row.nspname,row.relname);
 END LOOP;
END $policies$;

