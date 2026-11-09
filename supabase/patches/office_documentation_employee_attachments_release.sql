-- Targeted release for the employee documentation editor.
BEGIN;
SELECT pg_advisory_xact_lock(hashtextextended('caresuite-documentation-employee-attachments-20261109072535',0));
DO $cs_release$
BEGIN
 IF to_regprocedure('care_security.documentation_visit_files(uuid,uuid)') IS NULL
 OR to_regprocedure('public.office_documentation_attachments(uuid,uuid,text,text,jsonb)') IS NULL
 OR NOT EXISTS(SELECT 1 FROM storage.buckets WHERE id='office-documentation' AND public=false) THEN
  RAISE EXCEPTION 'Der private Dateibereich der Dokumentation muss bereits eingerichtet sein.';
 END IF;
 IF EXISTS(SELECT 1 FROM supabase_migrations.schema_migrations
   WHERE version='20261109072535' AND name IS DISTINCT FROM 'office_documentation_employee_attachments') THEN
  RAISE EXCEPTION 'Die Migrationsversion 20261109072535 ist bereits anderweitig belegt.';
 END IF;
 IF NOT EXISTS(SELECT 1 FROM supabase_migrations.schema_migrations WHERE version='20261109072535') THEN
  EXECUTE $cs_migration$-- Attachments for employee-authored free documentation and surname-first selectors.
-- Employee portal users can attach media only to free entries they authored.
CREATE FUNCTION care_security.documentation_employee_attachment_writer(p_tenant uuid,p_entry uuid,p_source text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT coalesce(p_source='manual' AND auth.uid() IS NOT NULL
  AND care_security.documentation_employee(p_tenant) IS NOT NULL
  AND EXISTS(SELECT 1 FROM care_security.office_documentation_entries e
    WHERE e.id=p_entry AND e.tenant_id=p_tenant AND e.author_user_id=auth.uid()),false)
$$;
CREATE FUNCTION care_security.documentation_employee_attachment_mime(p_mime text)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path=pg_catalog AS $$
 SELECT coalesce(p_mime IN (
  'image/jpeg','image/png','image/webp','image/gif','image/heic','image/heif','image/avif',
  'video/mp4','video/quicktime','video/webm','video/mpeg','video/3gpp','application/pdf'),false)
$$;
REVOKE ALL ON FUNCTION care_security.documentation_employee_attachment_writer(uuid,uuid,text),
 care_security.documentation_employee_attachment_mime(text) FROM PUBLIC,anon,authenticated,service_role;

-- Keep existing restrictive policies and replace their access check.
CREATE OR REPLACE FUNCTION care_security.documentation_file_access(p_path text,p_operation text)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE f care_security.documentation_files; v_office boolean;
BEGIN
 SELECT * INTO f FROM care_security.documentation_files WHERE storage_path=p_path;
 IF f.id IS NULL OR NOT care_security.documentation_actor(f.tenant_id)
 OR NOT EXISTS(SELECT 1 FROM care_security.office_documentation_feed e WHERE e.tenant_id=f.tenant_id AND e.id=f.entry_id AND e.source=f.source) THEN RETURN false; END IF;
 IF p_operation='read' AND f.state='ready' THEN RETURN true; END IF;
 v_office:=care_security.documentation_profile(f.tenant_id) IS NOT NULL;
 IF f.author_user_id IS DISTINCT FROM auth.uid()
 OR (NOT v_office AND NOT care_security.documentation_employee_attachment_writer(f.tenant_id,f.entry_id,f.source)) THEN RETURN false; END IF;
 RETURN (p_operation IN ('read','delete') AND f.state IN ('pending','discarded'))
  OR (p_operation='insert' AND f.state='pending'
      AND (v_office OR care_security.documentation_employee_attachment_mime(f.mime_type)));
END $$;

CREATE OR REPLACE FUNCTION care_security.documentation_attachments(p_tenant_id uuid,p_entry_id uuid,p_source text,p_action text DEFAULT 'list',p_payload jsonb DEFAULT '{}')
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE f care_security.documentation_files; v_id uuid; v_name text; v_mime text; v_size bigint; v_upload boolean; v_office boolean;
BEGIN
 IF NOT coalesce(care_security.documentation_actor(p_tenant_id),false) THEN RAISE EXCEPTION 'Active staff access required' USING ERRCODE='42501'; END IF;
 IF NOT EXISTS(SELECT 1 FROM care_security.office_documentation_feed e WHERE e.tenant_id=p_tenant_id AND e.id=p_entry_id AND e.source=p_source) THEN RAISE EXCEPTION 'Entry unavailable' USING ERRCODE='42501'; END IF;
 v_office:=care_security.documentation_profile(p_tenant_id) IS NOT NULL;
 v_upload:=v_office OR care_security.documentation_employee_attachment_writer(p_tenant_id,p_entry_id,p_source);
 IF p_action='list' THEN
  RETURN jsonb_build_object('canUpload',v_upload,'items',coalesce((SELECT jsonb_agg(jsonb_build_object('id',a.id,'file_name',a.file_name,'mime_type',a.mime_type,'size_bytes',a.size_bytes,'storage_bucket','office-documentation','storage_path',a.storage_path,'created_at',a.created_at) ORDER BY a.created_at,a.id) FROM care_security.documentation_files a WHERE a.tenant_id=p_tenant_id AND a.entry_id=p_entry_id AND a.source=p_source AND a.state='ready'),'[]') || CASE WHEN p_source='visit' THEN care_security.documentation_visit_files(p_tenant_id,p_entry_id) ELSE '[]'::jsonb END);
 END IF;
 IF NOT v_upload THEN RAISE EXCEPTION 'Upload access for this documentation entry required' USING ERRCODE='42501'; END IF;
 v_id:=(p_payload->>'id')::uuid;
 IF v_id IS NULL THEN RAISE EXCEPTION 'Invalid attachment' USING ERRCODE='22023'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_tenant_id::text||p_source||p_entry_id::text,0));
 SELECT * INTO f FROM care_security.documentation_files WHERE id=v_id FOR UPDATE;
 IF f.id IS NOT NULL AND (f.tenant_id<>p_tenant_id OR f.entry_id<>p_entry_id OR f.source<>p_source OR f.author_user_id<>auth.uid()) THEN RAISE EXCEPTION 'Attachment identity conflict' USING ERRCODE='42501'; END IF;
 IF p_action='prepare' THEN
  v_name:=btrim(p_payload->>'name'); v_mime:=lower(split_part(p_payload->>'mime',';',1)); v_size:=(p_payload->>'size')::bigint;
  IF v_name IS NULL OR length(v_name) NOT BETWEEN 1 AND 240 OR v_name ~ '[[:cntrl:]/\\]' OR v_mime IS NULL OR length(v_mime) NOT BETWEEN 1 AND 150 OR v_size IS NULL OR v_size NOT BETWEEN 1 AND 52428800 THEN RAISE EXCEPTION 'Invalid attachment metadata' USING ERRCODE='22023'; END IF;
  IF NOT v_office AND NOT care_security.documentation_employee_attachment_mime(v_mime) THEN
   RAISE EXCEPTION 'Employees may attach photos, videos and PDF files' USING ERRCODE='22023'; END IF;
  IF f.id IS NOT NULL THEN
   IF f.file_name<>v_name OR f.mime_type<>v_mime OR f.size_bytes<>v_size OR f.state='discarded' THEN RAISE EXCEPTION 'Attachment identity already used' USING ERRCODE='40001'; END IF;
  ELSE
   IF (SELECT count(*) FROM care_security.documentation_files WHERE tenant_id=p_tenant_id AND entry_id=p_entry_id AND source=p_source AND state IN ('pending','ready'))>=10 THEN RAISE EXCEPTION 'At most ten attachments per entry' USING ERRCODE='22023'; END IF;
   INSERT INTO care_security.documentation_files(id,tenant_id,entry_id,source,file_name,mime_type,size_bytes,storage_path,author_user_id)
   VALUES(v_id,p_tenant_id,p_entry_id,p_source,v_name,v_mime,v_size,p_tenant_id::text||'/'||p_source||'/'||p_entry_id::text||'/'||v_id::text,auth.uid()) RETURNING * INTO f;
  END IF;
 ELSIF p_action='complete' THEN
  IF f.id IS NULL OR f.state='discarded' THEN RAISE EXCEPTION 'Attachment unavailable' USING ERRCODE='22023'; END IF;
  IF NOT v_office AND NOT care_security.documentation_employee_attachment_mime(f.mime_type) THEN
   RAISE EXCEPTION 'Employees may attach photos, videos and PDF files' USING ERRCODE='22023'; END IF;
  IF NOT EXISTS(SELECT 1 FROM storage.objects o WHERE o.bucket_id='office-documentation' AND o.name=f.storage_path AND coalesce(o.owner_id,o.owner::text)=auth.uid()::text AND (o.metadata->>'size')::bigint=f.size_bytes AND lower(split_part(o.metadata->>'mimetype',';',1))=f.mime_type) THEN RAISE EXCEPTION 'Uploaded original missing or inconsistent' USING ERRCODE='22023'; END IF;
  UPDATE care_security.documentation_files SET state='ready',completed_at=coalesce(completed_at,now()) WHERE id=f.id RETURNING * INTO f;
 ELSIF p_action='discard' THEN
  IF f.id IS NULL THEN RETURN jsonb_build_object('discarded',true); END IF;
  IF f.state='ready' THEN RAISE EXCEPTION 'Saved originals are immutable' USING ERRCODE='42501'; END IF;
  UPDATE care_security.documentation_files SET state='discarded' WHERE id=f.id RETURNING * INTO f;
 ELSE RAISE EXCEPTION 'Unknown attachment operation' USING ERRCODE='22023'; END IF;
 RETURN jsonb_build_object('id',f.id,'storage_path',f.storage_path,'state',f.state);
END $$;

CREATE OR REPLACE FUNCTION care_security.documentation_workspace(p_tenant_id uuid,p_filters jsonb DEFAULT '{}')
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE v_filters jsonb:=coalesce(p_filters,'{}'); v_offset integer; v_month text;
 v_client uuid; v_employee uuid; v_items jsonb; v_total bigint; v_months jsonb;
 v_start timestamptz; v_end timestamptz;
BEGIN
 IF NOT coalesce(care_security.documentation_actor(p_tenant_id),false) THEN
  RAISE EXCEPTION 'Active staff access required' USING ERRCODE='42501'; END IF;
 v_offset:=coalesce((v_filters->>'offset')::integer,0);
 IF v_offset<0 OR v_offset>1000000 OR length(coalesce(v_filters->>'query',''))>200 THEN
  RAISE EXCEPTION 'Invalid filter' USING ERRCODE='22023'; END IF;
 v_month:=nullif(v_filters->>'month','');
 IF v_month IS NOT NULL THEN
  IF v_month !~ '^[0-9]{4}-(0[1-9]|1[0-2])$' THEN
   RAISE EXCEPTION 'Invalid month' USING ERRCODE='22023'; END IF;
  v_start:=(v_month||'-01')::timestamp AT TIME ZONE 'Europe/Berlin';
  v_end:=((v_month||'-01')::date+interval '1 month')::timestamp AT TIME ZONE 'Europe/Berlin';
 END IF;
 v_client:=nullif(v_filters->>'clientId','')::uuid;
 v_employee:=nullif(v_filters->>'employeeId','')::uuid;
 WITH filtered AS (
 SELECT f.* FROM care_security.office_documentation_feed f
 WHERE f.tenant_id=p_tenant_id
 AND (v_month IS NULL OR (f.occurred_at>=v_start AND f.occurred_at<v_end))
 AND (nullif(v_filters->>'area','') IS NULL OR f.area=v_filters->>'area')
 AND (v_client IS NULL OR f.client_id=v_client)
 AND (v_employee IS NULL OR f.employee_id=v_employee)
 AND (nullif(v_filters->>'category','') IS NULL OR f.category=v_filters->>'category')
 AND (nullif(v_filters->>'source','') IS NULL OR f.source=v_filters->>'source')
 AND (nullif(v_filters->>'priority','') IS NULL OR f.priority=v_filters->>'priority')
 AND (nullif(btrim(v_filters->>'query'),'') IS NULL OR
  strpos(lower(concat_ws(' ',f.title,f.body,f.author_name,f.client_name,f.employee_name)),
         lower(btrim(v_filters->>'query')))>0)
 ), paged AS (SELECT * FROM filtered ORDER BY occurred_at DESC,source,id LIMIT 50 OFFSET v_offset)
 SELECT (SELECT count(*) FROM filtered),
 coalesce((SELECT jsonb_agg(to_jsonb(paged) ORDER BY occurred_at DESC,source,id) FROM paged),'[]')
 INTO v_total,v_items;
 SELECT coalesce(jsonb_agg(m.entry_month ORDER BY m.entry_month DESC),'[]') INTO v_months
 FROM (SELECT DISTINCT to_char(occurred_at AT TIME ZONE 'Europe/Berlin','YYYY-MM') AS entry_month
 FROM care_security.office_documentation_feed WHERE tenant_id=p_tenant_id) m;
 RETURN jsonb_build_object('items',v_items,'total',v_total,'months',v_months,
 'clients',coalesce((SELECT jsonb_agg(jsonb_build_object('id',c.id,'name',concat_ws(', ',nullif(btrim(c.last_name),''),nullif(btrim(c.first_name),'')))
 ORDER BY c.last_name,c.first_name,c.id) FROM public.clients c
 WHERE c.tenant_id=p_tenant_id AND c.deleted_at IS NULL AND c.status::text IN ('active','paused','inactive','archived','deceased','blocked')),'[]'),
 'employees',coalesce((SELECT jsonb_agg(jsonb_build_object('id',e.id,'name',concat_ws(', ',nullif(btrim(e.last_name),''),nullif(btrim(e.first_name),'')))
 ORDER BY e.last_name,e.first_name,e.id) FROM public.employees e
 WHERE e.tenant_id=p_tenant_id AND e.deleted_at IS NULL AND e.status::text<>'deleted'),'[]'));
END $$;

NOTIFY pgrst,'reload schema';$cs_migration$;
  INSERT INTO supabase_migrations.schema_migrations(version,name,statements)
   VALUES('20261109072535','office_documentation_employee_attachments',ARRAY[$cs_migration$-- Attachments for employee-authored free documentation and surname-first selectors.
-- Employee portal users can attach media only to free entries they authored.
CREATE FUNCTION care_security.documentation_employee_attachment_writer(p_tenant uuid,p_entry uuid,p_source text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT coalesce(p_source='manual' AND auth.uid() IS NOT NULL
  AND care_security.documentation_employee(p_tenant) IS NOT NULL
  AND EXISTS(SELECT 1 FROM care_security.office_documentation_entries e
    WHERE e.id=p_entry AND e.tenant_id=p_tenant AND e.author_user_id=auth.uid()),false)
$$;
CREATE FUNCTION care_security.documentation_employee_attachment_mime(p_mime text)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path=pg_catalog AS $$
 SELECT coalesce(p_mime IN (
  'image/jpeg','image/png','image/webp','image/gif','image/heic','image/heif','image/avif',
  'video/mp4','video/quicktime','video/webm','video/mpeg','video/3gpp','application/pdf'),false)
$$;
REVOKE ALL ON FUNCTION care_security.documentation_employee_attachment_writer(uuid,uuid,text),
 care_security.documentation_employee_attachment_mime(text) FROM PUBLIC,anon,authenticated,service_role;

-- Keep existing restrictive policies and replace their access check.
CREATE OR REPLACE FUNCTION care_security.documentation_file_access(p_path text,p_operation text)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE f care_security.documentation_files; v_office boolean;
BEGIN
 SELECT * INTO f FROM care_security.documentation_files WHERE storage_path=p_path;
 IF f.id IS NULL OR NOT care_security.documentation_actor(f.tenant_id)
 OR NOT EXISTS(SELECT 1 FROM care_security.office_documentation_feed e WHERE e.tenant_id=f.tenant_id AND e.id=f.entry_id AND e.source=f.source) THEN RETURN false; END IF;
 IF p_operation='read' AND f.state='ready' THEN RETURN true; END IF;
 v_office:=care_security.documentation_profile(f.tenant_id) IS NOT NULL;
 IF f.author_user_id IS DISTINCT FROM auth.uid()
 OR (NOT v_office AND NOT care_security.documentation_employee_attachment_writer(f.tenant_id,f.entry_id,f.source)) THEN RETURN false; END IF;
 RETURN (p_operation IN ('read','delete') AND f.state IN ('pending','discarded'))
  OR (p_operation='insert' AND f.state='pending'
      AND (v_office OR care_security.documentation_employee_attachment_mime(f.mime_type)));
END $$;

CREATE OR REPLACE FUNCTION care_security.documentation_attachments(p_tenant_id uuid,p_entry_id uuid,p_source text,p_action text DEFAULT 'list',p_payload jsonb DEFAULT '{}')
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE f care_security.documentation_files; v_id uuid; v_name text; v_mime text; v_size bigint; v_upload boolean; v_office boolean;
BEGIN
 IF NOT coalesce(care_security.documentation_actor(p_tenant_id),false) THEN RAISE EXCEPTION 'Active staff access required' USING ERRCODE='42501'; END IF;
 IF NOT EXISTS(SELECT 1 FROM care_security.office_documentation_feed e WHERE e.tenant_id=p_tenant_id AND e.id=p_entry_id AND e.source=p_source) THEN RAISE EXCEPTION 'Entry unavailable' USING ERRCODE='42501'; END IF;
 v_office:=care_security.documentation_profile(p_tenant_id) IS NOT NULL;
 v_upload:=v_office OR care_security.documentation_employee_attachment_writer(p_tenant_id,p_entry_id,p_source);
 IF p_action='list' THEN
  RETURN jsonb_build_object('canUpload',v_upload,'items',coalesce((SELECT jsonb_agg(jsonb_build_object('id',a.id,'file_name',a.file_name,'mime_type',a.mime_type,'size_bytes',a.size_bytes,'storage_bucket','office-documentation','storage_path',a.storage_path,'created_at',a.created_at) ORDER BY a.created_at,a.id) FROM care_security.documentation_files a WHERE a.tenant_id=p_tenant_id AND a.entry_id=p_entry_id AND a.source=p_source AND a.state='ready'),'[]') || CASE WHEN p_source='visit' THEN care_security.documentation_visit_files(p_tenant_id,p_entry_id) ELSE '[]'::jsonb END);
 END IF;
 IF NOT v_upload THEN RAISE EXCEPTION 'Upload access for this documentation entry required' USING ERRCODE='42501'; END IF;
 v_id:=(p_payload->>'id')::uuid;
 IF v_id IS NULL THEN RAISE EXCEPTION 'Invalid attachment' USING ERRCODE='22023'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_tenant_id::text||p_source||p_entry_id::text,0));
 SELECT * INTO f FROM care_security.documentation_files WHERE id=v_id FOR UPDATE;
 IF f.id IS NOT NULL AND (f.tenant_id<>p_tenant_id OR f.entry_id<>p_entry_id OR f.source<>p_source OR f.author_user_id<>auth.uid()) THEN RAISE EXCEPTION 'Attachment identity conflict' USING ERRCODE='42501'; END IF;
 IF p_action='prepare' THEN
  v_name:=btrim(p_payload->>'name'); v_mime:=lower(split_part(p_payload->>'mime',';',1)); v_size:=(p_payload->>'size')::bigint;
  IF v_name IS NULL OR length(v_name) NOT BETWEEN 1 AND 240 OR v_name ~ '[[:cntrl:]/\\]' OR v_mime IS NULL OR length(v_mime) NOT BETWEEN 1 AND 150 OR v_size IS NULL OR v_size NOT BETWEEN 1 AND 52428800 THEN RAISE EXCEPTION 'Invalid attachment metadata' USING ERRCODE='22023'; END IF;
  IF NOT v_office AND NOT care_security.documentation_employee_attachment_mime(v_mime) THEN
   RAISE EXCEPTION 'Employees may attach photos, videos and PDF files' USING ERRCODE='22023'; END IF;
  IF f.id IS NOT NULL THEN
   IF f.file_name<>v_name OR f.mime_type<>v_mime OR f.size_bytes<>v_size OR f.state='discarded' THEN RAISE EXCEPTION 'Attachment identity already used' USING ERRCODE='40001'; END IF;
  ELSE
   IF (SELECT count(*) FROM care_security.documentation_files WHERE tenant_id=p_tenant_id AND entry_id=p_entry_id AND source=p_source AND state IN ('pending','ready'))>=10 THEN RAISE EXCEPTION 'At most ten attachments per entry' USING ERRCODE='22023'; END IF;
   INSERT INTO care_security.documentation_files(id,tenant_id,entry_id,source,file_name,mime_type,size_bytes,storage_path,author_user_id)
   VALUES(v_id,p_tenant_id,p_entry_id,p_source,v_name,v_mime,v_size,p_tenant_id::text||'/'||p_source||'/'||p_entry_id::text||'/'||v_id::text,auth.uid()) RETURNING * INTO f;
  END IF;
 ELSIF p_action='complete' THEN
  IF f.id IS NULL OR f.state='discarded' THEN RAISE EXCEPTION 'Attachment unavailable' USING ERRCODE='22023'; END IF;
  IF NOT v_office AND NOT care_security.documentation_employee_attachment_mime(f.mime_type) THEN
   RAISE EXCEPTION 'Employees may attach photos, videos and PDF files' USING ERRCODE='22023'; END IF;
  IF NOT EXISTS(SELECT 1 FROM storage.objects o WHERE o.bucket_id='office-documentation' AND o.name=f.storage_path AND coalesce(o.owner_id,o.owner::text)=auth.uid()::text AND (o.metadata->>'size')::bigint=f.size_bytes AND lower(split_part(o.metadata->>'mimetype',';',1))=f.mime_type) THEN RAISE EXCEPTION 'Uploaded original missing or inconsistent' USING ERRCODE='22023'; END IF;
  UPDATE care_security.documentation_files SET state='ready',completed_at=coalesce(completed_at,now()) WHERE id=f.id RETURNING * INTO f;
 ELSIF p_action='discard' THEN
  IF f.id IS NULL THEN RETURN jsonb_build_object('discarded',true); END IF;
  IF f.state='ready' THEN RAISE EXCEPTION 'Saved originals are immutable' USING ERRCODE='42501'; END IF;
  UPDATE care_security.documentation_files SET state='discarded' WHERE id=f.id RETURNING * INTO f;
 ELSE RAISE EXCEPTION 'Unknown attachment operation' USING ERRCODE='22023'; END IF;
 RETURN jsonb_build_object('id',f.id,'storage_path',f.storage_path,'state',f.state);
END $$;

CREATE OR REPLACE FUNCTION care_security.documentation_workspace(p_tenant_id uuid,p_filters jsonb DEFAULT '{}')
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE v_filters jsonb:=coalesce(p_filters,'{}'); v_offset integer; v_month text;
 v_client uuid; v_employee uuid; v_items jsonb; v_total bigint; v_months jsonb;
 v_start timestamptz; v_end timestamptz;
BEGIN
 IF NOT coalesce(care_security.documentation_actor(p_tenant_id),false) THEN
  RAISE EXCEPTION 'Active staff access required' USING ERRCODE='42501'; END IF;
 v_offset:=coalesce((v_filters->>'offset')::integer,0);
 IF v_offset<0 OR v_offset>1000000 OR length(coalesce(v_filters->>'query',''))>200 THEN
  RAISE EXCEPTION 'Invalid filter' USING ERRCODE='22023'; END IF;
 v_month:=nullif(v_filters->>'month','');
 IF v_month IS NOT NULL THEN
  IF v_month !~ '^[0-9]{4}-(0[1-9]|1[0-2])$' THEN
   RAISE EXCEPTION 'Invalid month' USING ERRCODE='22023'; END IF;
  v_start:=(v_month||'-01')::timestamp AT TIME ZONE 'Europe/Berlin';
  v_end:=((v_month||'-01')::date+interval '1 month')::timestamp AT TIME ZONE 'Europe/Berlin';
 END IF;
 v_client:=nullif(v_filters->>'clientId','')::uuid;
 v_employee:=nullif(v_filters->>'employeeId','')::uuid;
 WITH filtered AS (
 SELECT f.* FROM care_security.office_documentation_feed f
 WHERE f.tenant_id=p_tenant_id
 AND (v_month IS NULL OR (f.occurred_at>=v_start AND f.occurred_at<v_end))
 AND (nullif(v_filters->>'area','') IS NULL OR f.area=v_filters->>'area')
 AND (v_client IS NULL OR f.client_id=v_client)
 AND (v_employee IS NULL OR f.employee_id=v_employee)
 AND (nullif(v_filters->>'category','') IS NULL OR f.category=v_filters->>'category')
 AND (nullif(v_filters->>'source','') IS NULL OR f.source=v_filters->>'source')
 AND (nullif(v_filters->>'priority','') IS NULL OR f.priority=v_filters->>'priority')
 AND (nullif(btrim(v_filters->>'query'),'') IS NULL OR
  strpos(lower(concat_ws(' ',f.title,f.body,f.author_name,f.client_name,f.employee_name)),
         lower(btrim(v_filters->>'query')))>0)
 ), paged AS (SELECT * FROM filtered ORDER BY occurred_at DESC,source,id LIMIT 50 OFFSET v_offset)
 SELECT (SELECT count(*) FROM filtered),
 coalesce((SELECT jsonb_agg(to_jsonb(paged) ORDER BY occurred_at DESC,source,id) FROM paged),'[]')
 INTO v_total,v_items;
 SELECT coalesce(jsonb_agg(m.entry_month ORDER BY m.entry_month DESC),'[]') INTO v_months
 FROM (SELECT DISTINCT to_char(occurred_at AT TIME ZONE 'Europe/Berlin','YYYY-MM') AS entry_month
 FROM care_security.office_documentation_feed WHERE tenant_id=p_tenant_id) m;
 RETURN jsonb_build_object('items',v_items,'total',v_total,'months',v_months,
 'clients',coalesce((SELECT jsonb_agg(jsonb_build_object('id',c.id,'name',concat_ws(', ',nullif(btrim(c.last_name),''),nullif(btrim(c.first_name),'')))
 ORDER BY c.last_name,c.first_name,c.id) FROM public.clients c
 WHERE c.tenant_id=p_tenant_id AND c.deleted_at IS NULL AND c.status::text IN ('active','paused','inactive','archived','deceased','blocked')),'[]'),
 'employees',coalesce((SELECT jsonb_agg(jsonb_build_object('id',e.id,'name',concat_ws(', ',nullif(btrim(e.last_name),''),nullif(btrim(e.first_name),'')))
 ORDER BY e.last_name,e.first_name,e.id) FROM public.employees e
 WHERE e.tenant_id=p_tenant_id AND e.deleted_at IS NULL AND e.status::text<>'deleted'),'[]'));
END $$;

NOTIFY pgrst,'reload schema';$cs_migration$]);
 END IF;
 IF to_regprocedure('care_security.documentation_employee_attachment_writer(uuid,uuid,text)') IS NULL THEN
  RAISE EXCEPTION 'Die Upload-Freigabe konnte nicht bestätigt werden.';
 END IF;
END $cs_release$;
NOTIFY pgrst,'reload schema';
COMMIT;
SELECT jsonb_build_object('status','ready','release','employee-documentation-attachments-20261109') AS documentation_release;
