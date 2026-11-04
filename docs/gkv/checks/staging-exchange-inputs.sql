-- Catalog only. Set search_path=pg_catalog,public for stable deparsing.
WITH rels AS (
 SELECT s,to_regclass(s) oid FROM unnest(ARRAY['public.tenants','public.invoices','public.roles','public.role_permissions','public.profiles','public.employee_portal_accounts','public.assist_visits','public.assignments','public.assist_visit_tasks','public.assignment_tasks']) s
), items(k,v) AS (
 SELECT s||'/table',jsonb_build_array(c.relkind,c.relrowsecurity,c.relforcerowsecurity) FROM rels JOIN pg_class c USING(oid)
 UNION ALL SELECT s||'/column/'||a.attnum,jsonb_build_array(a.attname,format_type(a.atttypid,a.atttypmod),a.attnotnull,pg_get_expr(d.adbin,d.adrelid))
 FROM rels JOIN pg_attribute a ON a.attrelid=rels.oid AND a.attnum>0 AND NOT a.attisdropped LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum
 UNION ALL SELECT s||'/constraint/'||k.conname,to_jsonb(pg_get_constraintdef(k.oid,false)) FROM rels JOIN pg_constraint k ON k.conrelid=rels.oid
 UNION ALL SELECT s||'/policy/'||p.polname,jsonb_build_array(p.polcmd,p.polpermissive,ARRAY(SELECT CASE WHEN x=0 THEN 'PUBLIC' ELSE pg_get_userbyid(x)::text END FROM unnest(p.polroles) x ORDER BY 1),pg_get_expr(p.polqual,p.polrelid),pg_get_expr(p.polwithcheck,p.polrelid)) FROM rels JOIN pg_policy p ON p.polrelid=rels.oid
 UNION ALL SELECT 'function/'||s,to_jsonb(pg_get_functiondef(p.oid)) FROM unnest(ARRAY['auth.uid()','public.current_tenant_id()','public.current_portal_type()','public.current_portal_account_id()','public.resolve_current_employee_id()','care_security.office_actor(uuid,text)','account_security.allowed_session()','account_security.original_current_tenant_id()']) s JOIN pg_proc p ON p.oid=to_regprocedure(s)
)
SELECT (SELECT encode(sha256(convert_to(string_agg(version::text,E'\n' ORDER BY version::text COLLATE "C"),'UTF8')),'hex') FROM supabase_migrations.schema_migrations) AS history,
 encode(sha256(convert_to(jsonb_agg(jsonb_build_array(k,v) ORDER BY k COLLATE "C")::text,'UTF8')),'hex') AS layout FROM items;
