-- Guards the first (not repeatable) staging installation. A different target,
-- revised catalog or changed history needs a fresh comparison, never a bypass.
DO $target$
DECLARE history text; layout text; signature text;
BEGIN
  SELECT encode(sha256(convert_to(string_agg(version::text,E'\n' ORDER BY version::text COLLATE "C"),'UTF8')),'hex')
    INTO history FROM supabase_migrations.schema_migrations;
  IF history IS DISTINCT FROM '06da88f899c0e84fb1a18b6c073d0a8271f1b1b3c9f9cc789ec5497a29faab19' THEN
    RAISE EXCEPTION 'Staging migration history has changed; review the target again';
  END IF;
  SELECT q.digest INTO layout FROM (
WITH rels AS (SELECT s,to_regclass(s) oid FROM unnest(ARRAY['public.tenants','public.profiles','public.assignments','public.assist_visits','public.assist_visit_proofs','public.assist_visit_signatures','public.assist_visit_execution_state','public.client_documents','storage.objects']) s),
items(k,v) AS (
 SELECT s||'/table',jsonb_build_array(c.relkind,c.relrowsecurity,c.relforcerowsecurity) FROM rels JOIN pg_class c USING(oid)
 UNION ALL SELECT s||'/column/'||a.attnum,jsonb_build_array(a.attname,format_type(a.atttypid,a.atttypmod),a.attnotnull,pg_get_expr(d.adbin,d.adrelid),a.attidentity,a.attgenerated) FROM rels JOIN pg_attribute a ON a.attrelid=rels.oid AND a.attnum>0 AND NOT a.attisdropped LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum
 UNION ALL SELECT s||'/constraint/'||k.conname,to_jsonb(pg_get_constraintdef(k.oid,false)) FROM rels JOIN pg_constraint k ON k.conrelid=rels.oid
 UNION ALL SELECT s||'/trigger/'||g.tgname,jsonb_build_array(pg_get_triggerdef(g.oid,false),g.tgenabled) FROM rels JOIN pg_trigger g ON g.tgrelid=rels.oid AND NOT g.tgisinternal
 UNION ALL SELECT s||'/policy/'||p.polname,jsonb_build_array(p.polcmd,p.polpermissive,ARRAY(SELECT CASE WHEN r=0 THEN 'PUBLIC' ELSE pg_get_userbyid(r)::text END FROM unnest(p.polroles) r ORDER BY 1),pg_get_expr(p.polqual,p.polrelid),pg_get_expr(p.polwithcheck,p.polrelid)) FROM rels JOIN pg_policy p ON p.polrelid=rels.oid
 UNION ALL SELECT 'function/'||s,to_jsonb(pg_get_functiondef(p.oid)) FROM unnest(ARRAY['auth.uid()','public.current_tenant_id()','public.is_employee_portal_rls_context(uuid)','public.is_client_portal_rls_context(uuid)','public.resolve_current_employee_id()','public.resolve_current_profile_id()','public.current_client_id()']) s JOIN pg_proc p ON p.oid=to_regprocedure(s)
) SELECT encode(sha256(convert_to(jsonb_agg(jsonb_build_array(k,v) ORDER BY k COLLATE "C")::text,'UTF8')),'hex') digest FROM items
  ) q;
  IF layout IS DISTINCT FROM '227f99b2c54f48f6a4314111ac95f5cc61df19afbd9d0437962ed12be8f747cb' THEN
    RAISE EXCEPTION 'Staging portal schema or authorization functions have changed; review the target again';
  END IF;
  IF to_regclass('public.audit_logs') IS NOT NULL OR to_regtype('public.audit_action_type') IS NOT NULL THEN
    RAISE EXCEPTION 'Existing audit schema must not be replaced';
  END IF;
  IF (SELECT array_agg(e.enumlabel::text ORDER BY e.enumlabel::text COLLATE "C") FROM pg_enum e
    WHERE e.enumtypid=to_regtype('public.product_key')) IS DISTINCT FROM
    ARRAY['akademie','assist','beratung','office','pflege','stationaer'] THEN
    RAISE EXCEPTION 'Unexpected product_key type';
  END IF;
  FOREACH signature IN ARRAY ARRAY[
    'public.employee_portal_release_deferred_signature(uuid,uuid,uuid,text,jsonb,text)',
    'public.client_portal_finalize_assist_proof(uuid,uuid,uuid,text,text,text,text)',
    'public.client_portal_can_read_assist_signature(text)','public.client_portal_can_upload_proof_recovery(text)'
  ] LOOP
    IF to_regprocedure(signature) IS NOT NULL THEN RAISE EXCEPTION 'Refusing to replace %',signature; END IF;
  END LOOP;
  IF EXISTS(SELECT FROM pg_policy WHERE polrelid='storage.objects'::regclass
    AND polname IN ('assist_signature_client_read','assist_proof_client_recovery_insert')) THEN
    RAISE EXCEPTION 'Existing storage policy must not be replaced';
  END IF;
END
$target$;
