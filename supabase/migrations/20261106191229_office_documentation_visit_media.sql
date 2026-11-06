-- Employee photos/videos remain in their original visit folder; Office reads them automatically.
BEGIN;
CREATE TABLE IF NOT EXISTS public.assist_visit_attachments (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL REFERENCES public.tenants(id),
 visit_id uuid NOT NULL REFERENCES public.assist_visits(id),employee_id uuid REFERENCES public.employees(id),
 storage_path text NOT NULL,file_name text NOT NULL,mime_type text NOT NULL DEFAULT 'application/octet-stream',
 size_bytes bigint,media_kind text NOT NULL CHECK(media_kind IN ('image','video','audio','document')),
 upload_source text NOT NULL CHECK(upload_source IN ('employee_portal','office','recovered')),
 created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(tenant_id,storage_path)
);
ALTER TABLE public.assist_visit_attachments ENABLE ROW LEVEL SECURITY;
GRANT SELECT,INSERT ON public.assist_visit_attachments TO authenticated;
CREATE INDEX IF NOT EXISTS documentation_visit_files_lookup ON public.assist_visit_attachments(tenant_id,visit_id);
-- Preserve older allowed file types while restricting new employee media to photo/video.
CREATE TABLE care_security.documentation_legacy_visit_files(storage_object_id uuid PRIMARY KEY);
ALTER TABLE care_security.documentation_legacy_visit_files ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON care_security.documentation_legacy_visit_files FROM PUBLIC,anon,authenticated;
INSERT INTO care_security.documentation_legacy_visit_files(storage_object_id)
 SELECT id FROM storage.objects WHERE bucket_id='office-documents' AND name ~ '^tenant/[0-9a-f-]{36}/assist/visits/[0-9a-f-]{36}/attachments/[^/]+$';

CREATE FUNCTION care_security.documentation_visit_media_writer(p_tenant uuid,p_visit uuid)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE v_employee uuid;v_allowed boolean;
BEGIN
 IF p_tenant IS DISTINCT FROM public.current_tenant_id() OR NOT care_security.documentation_actor(p_tenant) THEN RETURN false; END IF;
 IF care_security.documentation_profile(p_tenant) IS NOT NULL THEN RETURN true; END IF;
 v_employee:=care_security.documentation_employee(p_tenant);
 IF v_employee IS NULL THEN RETURN false; END IF;
 IF to_regprocedure('public.portal_employee_assigned_visit_ids(uuid)') IS NOT NULL THEN
  EXECUTE 'SELECT EXISTS(SELECT 1 FROM public.portal_employee_assigned_visit_ids($1) AS allowed(visit_id) WHERE allowed.visit_id=$2)' INTO v_allowed USING p_tenant,p_visit;
  RETURN coalesce(v_allowed,false);
 END IF;
 RETURN EXISTS(SELECT 1 FROM public.assist_visits WHERE id=p_visit AND tenant_id=p_tenant AND employee_id=v_employee);
END $$;
CREATE FUNCTION care_security.documentation_visit_media_storage(p_path text,p_operation text)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE v_tenant uuid;v_visit uuid;
BEGIN
 IF p_path !~ '^tenant/[0-9a-f-]{36}/assist/visits/[0-9a-f-]{36}/attachments/[^/]+$' THEN RETURN false; END IF;
 v_tenant:=split_part(p_path,'/',2)::uuid;v_visit:=split_part(p_path,'/',5)::uuid;
 IF p_operation='read' THEN
  RETURN care_security.documentation_actor(v_tenant) AND (EXISTS(SELECT 1 FROM care_security.office_documentation_feed WHERE tenant_id=v_tenant AND source='visit' AND visit_id=v_visit) OR care_security.documentation_visit_media_writer(v_tenant,v_visit));
 END IF;
 IF p_operation<>'insert' OR NOT care_security.documentation_visit_media_writer(v_tenant,v_visit) THEN RETURN false; END IF;
 IF care_security.documentation_profile(v_tenant) IS NOT NULL THEN RETURN true; END IF;
 RETURN lower(p_path) ~ '\.(jpe?g|png|webp|gif|heic|heif|avif|mp4|mov|webm|mpeg|mpg|3gp)$';
EXCEPTION WHEN invalid_text_representation THEN RETURN false;
END $$;
CREATE FUNCTION care_security.documentation_visit_media_metadata(p_tenant uuid,p_visit uuid,p_employee uuid,p_path text,p_mime text,p_size bigint,p_source text)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 IF NOT care_security.documentation_visit_media_writer(p_tenant,p_visit)
 OR NOT care_security.documentation_visit_media_storage(p_path,'insert')
 OR p_path NOT LIKE 'tenant/'||p_tenant::text||'/assist/visits/'||p_visit::text||'/attachments/%' THEN RETURN false; END IF;
 IF care_security.documentation_profile(p_tenant) IS NULL AND (p_employee IS DISTINCT FROM care_security.documentation_employee(p_tenant)
 OR p_source NOT IN ('employee_portal','recovered') OR p_mime NOT IN ('image/jpeg','image/png','image/webp','image/gif','image/heic','image/heif','image/avif','video/mp4','video/quicktime','video/webm','video/mpeg','video/3gpp')) THEN RETURN false; END IF;
 RETURN p_size BETWEEN 1 AND CASE WHEN p_mime LIKE 'image/%' THEN 15728640 ELSE 52428800 END
 AND EXISTS(SELECT 1 FROM storage.objects o WHERE o.bucket_id='office-documents' AND o.name=p_path
 AND coalesce(o.owner_id,o.owner::text)=auth.uid()::text AND (o.metadata->>'size')::bigint=p_size
 AND lower(split_part(o.metadata->>'mimetype',';',1))=p_mime);
END $$;
REVOKE ALL ON FUNCTION care_security.documentation_visit_media_writer(uuid,uuid),care_security.documentation_visit_media_storage(text,text),care_security.documentation_visit_media_metadata(uuid,uuid,uuid,text,text,bigint,text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION care_security.documentation_visit_media_storage(text,text),care_security.documentation_visit_media_metadata(uuid,uuid,uuid,text,text,bigint,text),care_security.documentation_visit_media_writer(uuid,uuid) TO authenticated;
CREATE POLICY documentation_visit_metadata_read ON public.assist_visit_attachments FOR SELECT TO authenticated USING(care_security.documentation_actor(tenant_id) AND (care_security.documentation_profile(tenant_id) IS NOT NULL OR care_security.documentation_visit_media_writer(tenant_id,visit_id)));
CREATE POLICY documentation_visit_metadata_read_guard ON public.assist_visit_attachments AS RESTRICTIVE FOR SELECT TO authenticated USING(care_security.documentation_actor(tenant_id) AND (care_security.documentation_profile(tenant_id) IS NOT NULL OR care_security.documentation_visit_media_writer(tenant_id,visit_id)));
CREATE POLICY documentation_visit_metadata_insert ON public.assist_visit_attachments FOR INSERT TO authenticated WITH CHECK(care_security.documentation_visit_media_metadata(tenant_id,visit_id,employee_id,storage_path,mime_type,size_bytes,upload_source));
CREATE POLICY documentation_visit_metadata_insert_guard ON public.assist_visit_attachments AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK(care_security.documentation_visit_media_metadata(tenant_id,visit_id,employee_id,storage_path,mime_type,size_bytes,upload_source));
CREATE POLICY documentation_visit_media_insert ON storage.objects FOR INSERT TO authenticated WITH CHECK(bucket_id='office-documents' AND care_security.documentation_visit_media_storage(name,'insert'));
CREATE POLICY documentation_visit_media_insert_guard ON storage.objects AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK(bucket_id<>'office-documents' OR name NOT LIKE 'tenant/%/assist/visits/%/attachments/%' OR care_security.documentation_visit_media_storage(name,'insert'));
CREATE POLICY documentation_visit_media_read_guard ON storage.objects AS RESTRICTIVE FOR SELECT TO authenticated USING(bucket_id<>'office-documents' OR name NOT LIKE 'tenant/%/assist/visits/%/attachments/%' OR care_security.documentation_visit_media_storage(name,'read'));
CREATE POLICY documentation_visit_media_read ON storage.objects FOR SELECT TO authenticated USING(bucket_id='office-documents' AND care_security.documentation_visit_media_storage(name,'read'));

CREATE FUNCTION care_security.documentation_visit_files(p_tenant uuid,p_entry uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',o.id,'storage_bucket','office-documents','storage_path',o.name,
 'file_name',coalesce(a.file_name,split_part(o.name,'/',7)),'mime_type',lower(split_part(o.metadata->>'mimetype',';',1)),
 'size_bytes',(o.metadata->>'size')::bigint,'created_at',coalesce(a.created_at,o.created_at)) ORDER BY o.created_at,o.id),'[]')
 FROM care_security.office_documentation_feed f JOIN storage.objects o ON o.bucket_id='office-documents'
 AND starts_with(o.name,'tenant/'||f.tenant_id::text||'/assist/visits/'||f.visit_id::text||'/attachments/')
 AND strpos(substr(o.name,length('tenant/'||f.tenant_id::text||'/assist/visits/'||f.visit_id::text||'/attachments/')+1),'/')=0
 LEFT JOIN public.assist_visit_attachments a ON a.tenant_id=f.tenant_id AND a.visit_id=f.visit_id AND a.storage_path=o.name
 WHERE f.tenant_id=p_tenant AND f.id=p_entry AND f.source='visit' AND care_security.documentation_actor(p_tenant)
 AND (o.metadata->>'size')::bigint>0 AND o.metadata->>'mimetype' IS NOT NULL
 AND (a.id IS NOT NULL OR lower(split_part(o.metadata->>'mimetype',';',1)) IN ('image/jpeg','image/png','image/webp','image/gif','image/heic','image/heif','image/avif','video/mp4','video/quicktime','video/webm','video/mpeg','video/3gpp')
 OR EXISTS(SELECT 1 FROM care_security.documentation_legacy_visit_files l WHERE l.storage_object_id=o.id))
$$;
REVOKE ALL ON FUNCTION care_security.documentation_visit_files(uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
CREATE OR REPLACE FUNCTION care_security.documentation_attachments(p_tenant_id uuid,p_entry_id uuid,p_source text,p_action text DEFAULT 'list',p_payload jsonb DEFAULT '{}')
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE f care_security.documentation_files; v_id uuid; v_name text; v_mime text; v_size bigint; v_upload boolean;
BEGIN
 IF NOT coalesce(care_security.documentation_actor(p_tenant_id),false) THEN RAISE EXCEPTION 'Active staff access required' USING ERRCODE='42501'; END IF;
 IF NOT EXISTS(SELECT 1 FROM care_security.office_documentation_feed e WHERE e.tenant_id=p_tenant_id AND e.id=p_entry_id AND e.source=p_source) THEN RAISE EXCEPTION 'Entry unavailable' USING ERRCODE='42501'; END IF;
 v_upload:=care_security.documentation_profile(p_tenant_id) IS NOT NULL;
 IF p_action='list' THEN
  RETURN jsonb_build_object('canUpload',v_upload,'items',coalesce((SELECT jsonb_agg(jsonb_build_object('id',a.id,'file_name',a.file_name,'mime_type',a.mime_type,'size_bytes',a.size_bytes,'storage_bucket','office-documentation','storage_path',a.storage_path,'created_at',a.created_at) ORDER BY a.created_at,a.id) FROM care_security.documentation_files a WHERE a.tenant_id=p_tenant_id AND a.entry_id=p_entry_id AND a.source=p_source AND a.state='ready'),'[]') || CASE WHEN p_source='visit' THEN care_security.documentation_visit_files(p_tenant_id,p_entry_id) ELSE '[]'::jsonb END);
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
NOTIFY pgrst,'reload schema';
COMMIT;
