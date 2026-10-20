BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '60s';

-- No extension or per-bucket size restriction. The project's Storage limit still applies.
-- Every format is transported as opaque bytes, never served as executable HTML/SVG.
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
VALUES ('tenant-data-transfers','tenant-data-transfers',false,NULL,ARRAY['application/octet-stream']);

CREATE TABLE public.tenant_data_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  created_by uuid NOT NULL,
  state text NOT NULL DEFAULT 'open' CHECK(state IN ('open','submitted','processed','cancelled')),
  message text NOT NULL CHECK(length(message) BETWEEN 1 AND 2000),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT now() + interval '30 days',
  submitted_at timestamptz,
  submitted_by uuid,
  processed_at timestamptz,
  UNIQUE(id,tenant_id)
);
CREATE UNIQUE INDEX tenant_data_requests_one_open ON public.tenant_data_requests(tenant_id) WHERE state='open';
CREATE INDEX tenant_data_requests_inbox ON public.tenant_data_requests(tenant_id,created_at DESC,id);

CREATE TABLE public.tenant_data_files (
  id uuid PRIMARY KEY,
  request_id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  created_by uuid NOT NULL,
  name text NOT NULL CHECK(length(name) BETWEEN 1 AND 255 AND name !~ '[[:cntrl:]]'),
  size bigint NOT NULL CHECK(size BETWEEN 0 AND 9007199254740991),
  object_path text NOT NULL UNIQUE,
  state text NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','ready','discarded')),
  created_at timestamptz NOT NULL DEFAULT now(),
  uploaded_at timestamptz,
  FOREIGN KEY(request_id,tenant_id) REFERENCES public.tenant_data_requests(id,tenant_id)
);
CREATE INDEX tenant_data_files_request ON public.tenant_data_files(request_id,state,created_at,id);
CREATE INDEX tenant_data_files_tenant ON public.tenant_data_files(tenant_id);
ALTER TABLE public.tenant_data_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_data_files ENABLE ROW LEVEL SECURITY;
-- All metadata mutations are transactional, audited RPCs. No client table writes.
REVOKE ALL ON public.tenant_data_requests,public.tenant_data_files FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.tenant_data_requests,public.tenant_data_files TO service_role;

CREATE SCHEMA IF NOT EXISTS private;
CREATE FUNCTION private.data_transfer_operator() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT auth.uid() IS NOT NULL AND EXISTS(SELECT 1 FROM public.platform_users
    WHERE user_id=auth.uid() AND role='platform_owner' AND status='active');
$$;
CREATE FUNCTION private.data_transfer_member(p_tenant_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT auth.uid() IS NOT NULL
    AND public.platform_tenant_access_allowed(p_tenant_id,false)
    AND EXISTS(SELECT 1 FROM public.tenant_users u JOIN public.tenants t ON t.id=u.tenant_id
      WHERE u.tenant_id=p_tenant_id AND u.auth_user_id=auth.uid()
        AND u.role_key IN ('owner','admin','business_admin') AND u.employee_id IS NULL
        AND u.status='active' AND u.archived_at IS NULL AND t.status IN ('active','trial'));
$$;

-- Restrictive policy also prevents older, broad storage policies from granting access
-- to this bucket. No platform read policy: downloads must pass through the Edge API.
CREATE FUNCTION private.data_transfer_storage_allowed(p_path text,p_operation text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT auth.uid() IS NOT NULL AND EXISTS(
    SELECT 1 FROM public.tenant_data_files f JOIN public.tenant_data_requests r ON r.id=f.request_id
    WHERE f.object_path=p_path AND f.created_by=auth.uid()
      AND private.data_transfer_member(f.tenant_id)
      AND ((p_operation='insert' AND f.state='pending' AND r.state='open' AND r.expires_at>now())
        OR (p_operation='select' AND f.state IN ('pending','ready') AND r.state='open' AND r.expires_at>now())
        OR (p_operation='delete' AND f.state='discarded')));
$$;
CREATE POLICY data_transfer_insert ON storage.objects FOR INSERT TO authenticated
  WITH CHECK(bucket_id='tenant-data-transfers' AND private.data_transfer_storage_allowed(name,'insert'));
CREATE POLICY data_transfer_select ON storage.objects FOR SELECT TO authenticated
  USING(bucket_id='tenant-data-transfers' AND (private.data_transfer_storage_allowed(name,'select') OR private.data_transfer_storage_allowed(name,'delete')));
CREATE POLICY data_transfer_delete ON storage.objects FOR DELETE TO authenticated
  USING(bucket_id='tenant-data-transfers' AND private.data_transfer_storage_allowed(name,'delete'));
CREATE POLICY data_transfer_insert_guard ON storage.objects AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK(bucket_id<>'tenant-data-transfers' OR private.data_transfer_storage_allowed(name,'insert'));
CREATE POLICY data_transfer_select_guard ON storage.objects AS RESTRICTIVE FOR SELECT TO authenticated
  USING(bucket_id<>'tenant-data-transfers' OR private.data_transfer_storage_allowed(name,'select') OR private.data_transfer_storage_allowed(name,'delete'));
CREATE POLICY data_transfer_update_guard ON storage.objects AS RESTRICTIVE FOR UPDATE TO authenticated
  USING(bucket_id<>'tenant-data-transfers') WITH CHECK(bucket_id<>'tenant-data-transfers');
CREATE POLICY data_transfer_delete_guard ON storage.objects AS RESTRICTIVE FOR DELETE TO authenticated
  USING(bucket_id<>'tenant-data-transfers' OR private.data_transfer_storage_allowed(name,'delete'));
CREATE POLICY data_transfer_anon_guard ON storage.objects AS RESTRICTIVE FOR ALL TO anon
  USING(bucket_id<>'tenant-data-transfers') WITH CHECK(bucket_id<>'tenant-data-transfers');

CREATE FUNCTION private.data_transfer_action(
  p_action text,p_tenant_id uuid,p_request_id uuid,p_file_id uuid,p_name text,p_size bigint,p_offset integer
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  v_operator boolean:=private.data_transfer_operator();
  v_member boolean:=private.data_transfer_member(p_tenant_id);
  v_request public.tenant_data_requests%ROWTYPE;
  v_file public.tenant_data_files%ROWTYPE;
  v_metadata jsonb;
  v_result jsonb;
  v_total bigint;
BEGIN
  IF auth.uid() IS NULL OR p_tenant_id IS NULL OR NOT(v_operator OR v_member)
    THEN RAISE EXCEPTION 'transfer_forbidden' USING ERRCODE='42501'; END IF;
  IF p_offset IS NULL OR p_offset<0 OR p_offset>1000000 THEN RAISE EXCEPTION 'transfer_invalid'; END IF;
  IF p_action='open' THEN
    IF NOT v_member THEN RAISE EXCEPTION 'transfer_forbidden' USING ERRCODE='42501'; END IF;
    SELECT * INTO v_request FROM public.tenant_data_requests
      WHERE tenant_id=p_tenant_id AND state='open' AND expires_at>now();
    RETURN jsonb_build_object('request',CASE WHEN v_request.id IS NULL THEN NULL ELSE to_jsonb(v_request) END);
  ELSIF p_action='create' THEN
    IF NOT v_operator THEN RAISE EXCEPTION 'transfer_forbidden' USING ERRCODE='42501'; END IF;
    -- Serialize creation and allow retry after a lost response without duplicate prompts.
    PERFORM 1 FROM public.tenants WHERE id=p_tenant_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'transfer_not_found'; END IF;
    IF NOT EXISTS(SELECT 1 FROM public.platform_tenants WHERE tenant_id=p_tenant_id AND status='active')
      THEN RAISE EXCEPTION 'transfer_tenant_inactive'; END IF;
    IF p_name IS NULL OR length(trim(p_name)) NOT BETWEEN 1 AND 2000 THEN RAISE EXCEPTION 'transfer_invalid'; END IF;
    UPDATE public.tenant_data_requests SET state='cancelled'
      WHERE tenant_id=p_tenant_id AND state='open' AND expires_at<=now();
    INSERT INTO public.tenant_data_requests(tenant_id,created_by,message)
      VALUES(p_tenant_id,auth.uid(),trim(p_name)) ON CONFLICT(tenant_id) WHERE state='open' DO NOTHING
      RETURNING * INTO v_request;
    IF v_request.id IS NULL THEN
      SELECT * INTO v_request FROM public.tenant_data_requests WHERE tenant_id=p_tenant_id AND state='open';
    ELSE
      PERFORM public.platform_write_audit_log('data_transfer.requested','tenant_data_request',v_request.id,p_tenant_id,NULL,NULL,'Datenübernahme angefordert');
    END IF;
    RETURN to_jsonb(v_request);
  ELSIF p_action='list' THEN
    IF NOT v_operator THEN RAISE EXCEPTION 'transfer_forbidden' USING ERRCODE='42501'; END IF;
    SELECT count(*) INTO v_total FROM public.tenant_data_requests WHERE tenant_id=p_tenant_id;
    SELECT coalesce(jsonb_agg(to_jsonb(q)),'[]') INTO v_result FROM (
      SELECT r.*, (SELECT count(*) FROM public.tenant_data_files f WHERE f.request_id=r.id AND f.state='ready') AS file_count
      FROM public.tenant_data_requests r WHERE r.tenant_id=p_tenant_id
      ORDER BY r.created_at DESC,r.id LIMIT 25 OFFSET p_offset
    ) q;
    RETURN jsonb_build_object('items',v_result,'total',v_total);
  END IF;

  -- Same lock order for all mutations: request, then file; submit cannot race begin/discard.
  SELECT * INTO v_request FROM public.tenant_data_requests WHERE id=p_request_id AND tenant_id=p_tenant_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'transfer_not_found'; END IF;
  IF p_action='files' THEN
    IF v_operator AND v_request.state NOT IN ('submitted','processed') THEN RETURN jsonb_build_object('items','[]'::jsonb,'total',0); END IF;
    SELECT count(*) INTO v_total FROM public.tenant_data_files WHERE request_id=p_request_id AND state<>'discarded';
    SELECT coalesce(jsonb_agg(to_jsonb(q)),'[]') INTO v_result FROM (
      SELECT * FROM public.tenant_data_files WHERE request_id=p_request_id AND state<>'discarded'
      ORDER BY created_at,id LIMIT 50 OFFSET p_offset
    ) q;
    RETURN jsonb_build_object('items',v_result,'total',v_total);
  ELSIF p_action='download' THEN
    IF NOT v_operator THEN RAISE EXCEPTION 'transfer_forbidden' USING ERRCODE='42501'; END IF;
    IF v_request.state NOT IN ('submitted','processed') THEN RAISE EXCEPTION 'transfer_not_submitted'; END IF;
    SELECT * INTO v_file FROM public.tenant_data_files WHERE id=p_file_id AND request_id=p_request_id AND state='ready';
    IF NOT FOUND THEN RAISE EXCEPTION 'transfer_not_found'; END IF;
    PERFORM public.platform_write_audit_log('data_transfer.download_authorized','tenant_data_file',v_file.id,p_tenant_id,NULL,NULL,'Download autorisiert');
    RETURN to_jsonb(v_file);
  ELSIF p_action IN ('cancel','process') THEN
    IF NOT v_operator THEN RAISE EXCEPTION 'transfer_forbidden' USING ERRCODE='42501'; END IF;
    IF p_action='process' AND v_request.state IN ('submitted','processed') THEN
      UPDATE public.tenant_data_requests SET state='processed',processed_at=coalesce(processed_at,now()) WHERE id=p_request_id;
    ELSIF p_action='cancel' AND v_request.state IN ('open','cancelled') THEN
      UPDATE public.tenant_data_requests SET state='cancelled' WHERE id=p_request_id;
    ELSE RAISE EXCEPTION 'transfer_closed'; END IF;
    PERFORM public.platform_write_audit_log('data_transfer.'||p_action,'tenant_data_request',p_request_id,p_tenant_id,NULL,NULL,'Datenübernahme aktualisiert');
    RETURN jsonb_build_object('ok',true);
  END IF;

  IF NOT v_member THEN RAISE EXCEPTION 'transfer_forbidden' USING ERRCODE='42501'; END IF;
  -- Idempotent submission: only the actor who submitted can retry it successfully.
  IF p_action='submit' AND v_request.state IN ('submitted','processed') AND v_request.submitted_by=auth.uid() THEN RETURN to_jsonb(v_request); END IF;
  IF v_request.state<>'open' OR v_request.expires_at<=now() THEN RAISE EXCEPTION 'transfer_closed'; END IF;
  IF p_action='submit' THEN
    IF NOT EXISTS(SELECT 1 FROM public.tenant_data_files WHERE request_id=p_request_id AND state='ready')
      OR EXISTS(SELECT 1 FROM public.tenant_data_files WHERE request_id=p_request_id AND state='pending')
      THEN RAISE EXCEPTION 'transfer_incomplete'; END IF;
    -- Check object presence and size again, not just client-reported completion.
    IF EXISTS(SELECT 1 FROM public.tenant_data_files f LEFT JOIN storage.objects o
      ON o.bucket_id='tenant-data-transfers' AND o.name=f.object_path
      WHERE f.request_id=p_request_id AND f.state='ready'
        AND (o.id IS NULL OR (o.metadata->>'size')::bigint IS DISTINCT FROM f.size
          OR o.metadata->>'mimetype' IS DISTINCT FROM 'application/octet-stream'))
      THEN RAISE EXCEPTION 'transfer_incomplete'; END IF;
    UPDATE public.tenant_data_requests SET state='submitted',submitted_at=now(),submitted_by=auth.uid()
      WHERE id=p_request_id RETURNING * INTO v_request;
    INSERT INTO public.platform_audit_log(actor_user_id,actor_role,action,target_type,target_id,tenant_id,reason)
      VALUES(auth.uid(),'tenant_admin','data_transfer.submitted','tenant_data_request',p_request_id,p_tenant_id,'Daten vom Unternehmen übermittelt');
    RETURN to_jsonb(v_request);
  ELSIF p_action='begin' THEN
    IF p_file_id IS NULL OR p_size IS NULL OR p_size<0 OR p_size>9007199254740991
      OR p_name IS NULL OR length(p_name) NOT BETWEEN 1 AND 255 OR p_name ~ '[[:cntrl:]]'
      THEN RAISE EXCEPTION 'transfer_invalid'; END IF;
    INSERT INTO public.tenant_data_files(id,request_id,tenant_id,created_by,name,size,object_path)
      VALUES(p_file_id,p_request_id,p_tenant_id,auth.uid(),p_name,p_size,p_tenant_id::text||'/'||p_request_id::text||'/'||p_file_id::text)
      ON CONFLICT(id) DO NOTHING;
    SELECT * INTO v_file FROM public.tenant_data_files WHERE id=p_file_id;
    IF v_file.request_id<>p_request_id OR v_file.created_by<>auth.uid() OR v_file.name<>p_name OR v_file.size<>p_size OR v_file.state='discarded'
      THEN RAISE EXCEPTION 'transfer_invalid'; END IF;
    RETURN to_jsonb(v_file);
  ELSIF p_action IN ('finish','discard') THEN
    SELECT * INTO v_file FROM public.tenant_data_files WHERE id=p_file_id AND request_id=p_request_id AND created_by=auth.uid() FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'transfer_not_found'; END IF;
    IF p_action='discard' THEN
      UPDATE public.tenant_data_files SET state='discarded' WHERE id=p_file_id;
    ELSE
      IF v_file.state='discarded' THEN RAISE EXCEPTION 'transfer_closed'; END IF;
      SELECT metadata INTO v_metadata FROM storage.objects WHERE bucket_id='tenant-data-transfers' AND name=v_file.object_path;
      IF NOT FOUND OR (v_metadata->>'size')::bigint IS DISTINCT FROM v_file.size
        OR v_metadata->>'mimetype' IS DISTINCT FROM 'application/octet-stream'
        THEN RAISE EXCEPTION 'transfer_incomplete'; END IF;
      UPDATE public.tenant_data_files SET state='ready',uploaded_at=coalesce(uploaded_at,now()) WHERE id=p_file_id;
    END IF;
    RETURN jsonb_build_object('ok',true);
  END IF;
  RAISE EXCEPTION 'transfer_invalid';
END;
$$;

CREATE FUNCTION public.tenant_data_transfer(
  p_action text,p_tenant_id uuid,p_request_id uuid DEFAULT NULL,p_file_id uuid DEFAULT NULL,
  p_name text DEFAULT NULL,p_size bigint DEFAULT NULL,p_offset integer DEFAULT 0
) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$
  SELECT private.data_transfer_action(p_action,p_tenant_id,p_request_id,p_file_id,p_name,p_size,p_offset);
$$;
REVOKE ALL ON FUNCTION private.data_transfer_operator(),private.data_transfer_member(uuid),private.data_transfer_storage_allowed(text,text),private.data_transfer_action(text,uuid,uuid,uuid,text,bigint,integer) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.tenant_data_transfer(text,uuid,uuid,uuid,text,bigint,integer) FROM PUBLIC,anon;
GRANT USAGE ON SCHEMA private TO authenticated;
GRANT EXECUTE ON FUNCTION private.data_transfer_operator(),private.data_transfer_member(uuid),private.data_transfer_storage_allowed(text,text),private.data_transfer_action(text,uuid,uuid,uuid,text,bigint,integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.tenant_data_transfer(text,uuid,uuid,uuid,text,bigint,integer) TO authenticated;
COMMIT;
