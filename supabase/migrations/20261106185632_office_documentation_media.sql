-- Private, immutable documentation attachments. No client/family portal access.
BEGIN;
CREATE TABLE care_security.documentation_files (
 id uuid PRIMARY KEY, tenant_id uuid NOT NULL REFERENCES public.tenants(id),
 entry_id uuid NOT NULL, source text NOT NULL CHECK(source IN ('manual','visit')),
 file_name text NOT NULL CHECK(length(file_name) BETWEEN 1 AND 240),
 mime_type text NOT NULL CHECK(length(mime_type) BETWEEN 1 AND 150),
 size_bytes bigint NOT NULL CHECK(size_bytes BETWEEN 1 AND 52428800),
 storage_path text NOT NULL UNIQUE, author_user_id uuid NOT NULL,
 state text NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','ready','discarded')),
 created_at timestamptz NOT NULL DEFAULT now(), completed_at timestamptz
);
ALTER TABLE care_security.documentation_files ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON care_security.documentation_files FROM PUBLIC,anon,authenticated;
CREATE INDEX documentation_files_entry ON care_security.documentation_files(tenant_id,source,entry_id,state);
INSERT INTO storage.buckets(id,name,public,file_size_limit)
 VALUES('office-documentation','office-documentation',false,52428800)
 ON CONFLICT(id) DO UPDATE SET public=false,file_size_limit=52428800;

CREATE FUNCTION care_security.documentation_file_access(p_path text,p_operation text)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE f care_security.documentation_files;
BEGIN
 SELECT * INTO f FROM care_security.documentation_files WHERE storage_path=p_path;
 IF f.id IS NULL OR NOT care_security.documentation_actor(f.tenant_id)
 OR NOT EXISTS(SELECT 1 FROM care_security.office_documentation_feed e WHERE e.tenant_id=f.tenant_id AND e.id=f.entry_id AND e.source=f.source) THEN RETURN false; END IF;
 IF p_operation='read' THEN RETURN f.state='ready' OR (f.state IN ('pending','discarded') AND f.author_user_id=auth.uid() AND care_security.documentation_profile(f.tenant_id) IS NOT NULL); END IF;
 IF care_security.documentation_profile(f.tenant_id) IS NULL OR f.author_user_id<>auth.uid() THEN RETURN false; END IF;
 RETURN (p_operation='insert' AND f.state='pending') OR (p_operation='delete' AND f.state IN ('pending','discarded'));
END $$;
REVOKE ALL ON FUNCTION care_security.documentation_file_access(text,text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION care_security.documentation_file_access(text,text) TO authenticated;

-- Restrictive guards prevent broader existing Storage policies from granting access.
CREATE POLICY documentation_file_read ON storage.objects FOR SELECT TO authenticated USING(bucket_id='office-documentation' AND care_security.documentation_file_access(name,'read'));
CREATE POLICY documentation_file_read_guard ON storage.objects AS RESTRICTIVE FOR SELECT TO authenticated USING(bucket_id<>'office-documentation' OR care_security.documentation_file_access(name,'read'));
CREATE POLICY documentation_file_insert ON storage.objects FOR INSERT TO authenticated WITH CHECK(bucket_id='office-documentation' AND care_security.documentation_file_access(name,'insert'));
CREATE POLICY documentation_file_insert_guard ON storage.objects AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK(bucket_id<>'office-documentation' OR care_security.documentation_file_access(name,'insert'));
CREATE POLICY documentation_file_delete ON storage.objects FOR DELETE TO authenticated USING(bucket_id='office-documentation' AND care_security.documentation_file_access(name,'delete'));
CREATE POLICY documentation_file_delete_guard ON storage.objects AS RESTRICTIVE FOR DELETE TO authenticated USING(bucket_id<>'office-documentation' OR care_security.documentation_file_access(name,'delete'));
CREATE POLICY documentation_file_update_guard ON storage.objects AS RESTRICTIVE FOR UPDATE TO authenticated USING(bucket_id<>'office-documentation') WITH CHECK(bucket_id<>'office-documentation');

CREATE FUNCTION care_security.documentation_attachments(p_tenant_id uuid,p_entry_id uuid,p_source text,p_action text DEFAULT 'list',p_payload jsonb DEFAULT '{}')
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE f care_security.documentation_files; v_id uuid; v_name text; v_mime text; v_size bigint; v_upload boolean;
BEGIN
 IF NOT coalesce(care_security.documentation_actor(p_tenant_id),false) THEN RAISE EXCEPTION 'Active staff access required' USING ERRCODE='42501'; END IF;
 IF NOT EXISTS(SELECT 1 FROM care_security.office_documentation_feed e WHERE e.tenant_id=p_tenant_id AND e.id=p_entry_id AND e.source=p_source) THEN RAISE EXCEPTION 'Entry unavailable' USING ERRCODE='42501'; END IF;
 v_upload:=care_security.documentation_profile(p_tenant_id) IS NOT NULL;
 IF p_action='list' THEN
  RETURN jsonb_build_object('canUpload',v_upload,'items',coalesce((SELECT jsonb_agg(jsonb_build_object('id',a.id,'file_name',a.file_name,'mime_type',a.mime_type,'size_bytes',a.size_bytes,'storage_path',a.storage_path,'created_at',a.created_at) ORDER BY a.created_at,a.id) FROM care_security.documentation_files a WHERE a.tenant_id=p_tenant_id AND a.entry_id=p_entry_id AND a.source=p_source AND a.state='ready'),'[]'));
 END IF;
 IF NOT v_upload THEN RAISE EXCEPTION 'Office staff access required for attachments' USING ERRCODE='42501'; END IF;
 v_id:=(p_payload->>'id')::uuid;
 IF v_id IS NULL THEN RAISE EXCEPTION 'Invalid attachment' USING ERRCODE='22023'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_tenant_id::text||p_source||p_entry_id::text,0));
 SELECT * INTO f FROM care_security.documentation_files WHERE id=v_id FOR UPDATE;
 IF f.id IS NOT NULL AND (f.tenant_id<>p_tenant_id OR f.entry_id<>p_entry_id OR f.source<>p_source OR f.author_user_id<>auth.uid()) THEN RAISE EXCEPTION 'Attachment identity conflict' USING ERRCODE='42501'; END IF;
 IF p_action='prepare' THEN
  v_name:=btrim(p_payload->>'name'); v_mime:=lower(split_part(p_payload->>'mime',';',1)); v_size:=(p_payload->>'size')::bigint;
  IF v_name IS NULL OR length(v_name) NOT BETWEEN 1 AND 240 OR v_name ~ '[[:cntrl:]/\\]' OR v_mime IS NULL OR length(v_mime) NOT BETWEEN 1 AND 150 OR v_size IS NULL OR v_size NOT BETWEEN 1 AND 52428800 THEN RAISE EXCEPTION 'Invalid attachment metadata' USING ERRCODE='22023'; END IF;
  IF f.id IS NOT NULL THEN
   IF f.file_name<>v_name OR f.mime_type<>v_mime OR f.size_bytes<>v_size OR f.state='discarded' THEN RAISE EXCEPTION 'Attachment identity already used' USING ERRCODE='40001'; END IF;
  ELSE
   IF (SELECT count(*) FROM care_security.documentation_files WHERE tenant_id=p_tenant_id AND entry_id=p_entry_id AND source=p_source AND state IN ('pending','ready'))>=10 THEN RAISE EXCEPTION 'At most ten attachments per entry' USING ERRCODE='22023'; END IF;
   INSERT INTO care_security.documentation_files(id,tenant_id,entry_id,source,file_name,mime_type,size_bytes,storage_path,author_user_id)
   VALUES(v_id,p_tenant_id,p_entry_id,p_source,v_name,v_mime,v_size,p_tenant_id::text||'/'||p_source||'/'||p_entry_id::text||'/'||v_id::text,auth.uid()) RETURNING * INTO f;
  END IF;
 ELSIF p_action='complete' THEN
  IF f.id IS NULL OR f.state='discarded' THEN RAISE EXCEPTION 'Attachment unavailable' USING ERRCODE='22023'; END IF;
  IF NOT EXISTS(SELECT 1 FROM storage.objects o WHERE o.bucket_id='office-documentation' AND o.name=f.storage_path AND coalesce(o.owner_id,o.owner::text)=auth.uid()::text AND (o.metadata->>'size')::bigint=f.size_bytes AND lower(split_part(o.metadata->>'mimetype',';',1))=f.mime_type) THEN RAISE EXCEPTION 'Uploaded original missing or inconsistent' USING ERRCODE='22023'; END IF;
  UPDATE care_security.documentation_files SET state='ready',completed_at=coalesce(completed_at,now()) WHERE id=f.id RETURNING * INTO f;
 ELSIF p_action='discard' THEN
  IF f.id IS NULL THEN RETURN jsonb_build_object('discarded',true); END IF;
  IF f.state='ready' THEN RAISE EXCEPTION 'Saved originals are immutable' USING ERRCODE='42501'; END IF;
  UPDATE care_security.documentation_files SET state='discarded' WHERE id=f.id RETURNING * INTO f;
 ELSE RAISE EXCEPTION 'Unknown attachment operation' USING ERRCODE='22023'; END IF;
 RETURN jsonb_build_object('id',f.id,'storage_path',f.storage_path,'state',f.state);
END $$;
CREATE FUNCTION public.office_documentation_attachments(p_tenant_id uuid,p_entry_id uuid,p_source text,p_action text DEFAULT 'list',p_payload jsonb DEFAULT '{}')
RETURNS jsonb LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path=pg_catalog AS $$
 SELECT care_security.documentation_attachments(p_tenant_id,p_entry_id,p_source,p_action,p_payload)
$$;
REVOKE ALL ON FUNCTION care_security.documentation_attachments(uuid,uuid,text,text,jsonb),public.office_documentation_attachments(uuid,uuid,text,text,jsonb) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION care_security.documentation_attachments(uuid,uuid,text,text,jsonb),public.office_documentation_attachments(uuid,uuid,text,text,jsonb) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
