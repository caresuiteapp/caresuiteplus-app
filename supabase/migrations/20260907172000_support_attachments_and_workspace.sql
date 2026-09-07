CREATE TABLE public.support_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  message_id uuid,
  created_by uuid NOT NULL,
  file_name text NOT NULL CHECK(length(file_name) BETWEEN 1 AND 180),
  mime_type text NOT NULL CHECK(mime_type IN ('image/png','image/jpeg','image/webp','application/pdf','text/plain','application/zip','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','video/mp4')),
  byte_size bigint NOT NULL CHECK(byte_size BETWEEN 1 AND 20971520),
  storage_path text NOT NULL UNIQUE,
  state text NOT NULL DEFAULT 'uploading' CHECK(state IN ('uploading','ready','discarding')),
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(ticket_id,tenant_id) REFERENCES public.support_tickets(id,tenant_id),
  FOREIGN KEY(message_id,ticket_id,tenant_id) REFERENCES public.support_messages(id,ticket_id,tenant_id)
);
CREATE INDEX support_attachments_message ON public.support_attachments(message_id);
ALTER TABLE public.support_attachments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.support_attachments FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.support_attachments TO authenticated;
CREATE POLICY support_attachments_read ON public.support_attachments FOR SELECT TO authenticated
  USING(public.support_can_read_ticket(ticket_id) AND (message_id IS NOT NULL OR created_by=auth.uid()));

INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
VALUES('support-ticket-attachments','support-ticket-attachments',false,20971520,ARRAY['image/png','image/jpeg','image/webp','application/pdf','text/plain','application/zip','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','video/mp4'])
ON CONFLICT(id) DO UPDATE SET public=false,file_size_limit=EXCLUDED.file_size_limit,allowed_mime_types=EXCLUDED.allowed_mime_types;

CREATE POLICY support_ticket_file_insert ON storage.objects FOR INSERT TO authenticated WITH CHECK(
  bucket_id='support-ticket-attachments' AND EXISTS(
    SELECT 1 FROM public.support_attachments a WHERE a.storage_path=name AND a.created_by=auth.uid() AND a.state='uploading' AND a.message_id IS NULL AND public.support_can_write_ticket(a.ticket_id)
  )
);
CREATE POLICY support_ticket_file_read ON storage.objects FOR SELECT TO authenticated USING(
  bucket_id='support-ticket-attachments' AND EXISTS(
    SELECT 1 FROM public.support_attachments a WHERE a.storage_path=name AND public.support_can_read_ticket(a.ticket_id)
      AND ((a.state='ready' AND a.message_id IS NOT NULL) OR a.created_by=auth.uid())
  )
);
CREATE POLICY support_ticket_file_delete_draft ON storage.objects FOR DELETE TO authenticated USING(
  bucket_id='support-ticket-attachments' AND EXISTS(
    SELECT 1 FROM public.support_attachments a WHERE a.storage_path=name AND a.created_by=auth.uid() AND a.message_id IS NULL AND public.support_can_write_ticket(a.ticket_id)
  )
);

CREATE OR REPLACE FUNCTION public.support_reserve_attachment(p_ticket_id uuid,p_file_name text,p_mime_type text,p_byte_size bigint)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_tenant uuid; v_id uuid:=gen_random_uuid(); v_row public.support_attachments%ROWTYPE;
BEGIN
  IF NOT public.support_can_write_ticket(p_ticket_id) THEN RAISE EXCEPTION 'support_forbidden' USING ERRCODE='42501'; END IF;
  SELECT tenant_id INTO v_tenant FROM public.support_tickets WHERE id=p_ticket_id;
  IF (SELECT count(*) FROM public.support_attachments WHERE ticket_id=p_ticket_id AND created_by=auth.uid() AND message_id IS NULL AND created_at>now()-interval '1 hour')>=20 THEN RAISE EXCEPTION 'support_upload_limit' USING ERRCODE='22023'; END IF;
  INSERT INTO public.support_attachments(id,ticket_id,tenant_id,created_by,file_name,mime_type,byte_size,storage_path)
  VALUES(v_id,p_ticket_id,v_tenant,auth.uid(),left(regexp_replace(p_file_name,'[[:cntrl:]/\\]','_','g'),180),p_mime_type,p_byte_size,v_tenant::text||'/'||p_ticket_id::text||'/'||v_id::text) RETURNING * INTO v_row;
  RETURN to_jsonb(v_row);
END; $$;

CREATE OR REPLACE FUNCTION public.support_finalize_attachment(p_attachment_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_row public.support_attachments%ROWTYPE;
BEGIN
  SELECT * INTO v_row FROM public.support_attachments WHERE id=p_attachment_id FOR UPDATE;
  IF NOT FOUND OR v_row.created_by<>auth.uid() OR v_row.message_id IS NOT NULL OR v_row.state='discarding' OR NOT public.support_can_write_ticket(v_row.ticket_id) THEN RAISE EXCEPTION 'support_forbidden' USING ERRCODE='42501'; END IF;
  IF NOT EXISTS(SELECT 1 FROM storage.objects WHERE bucket_id='support-ticket-attachments' AND name=v_row.storage_path AND (metadata->>'size')::bigint=v_row.byte_size AND metadata->>'mimetype'=v_row.mime_type) THEN
    RAISE EXCEPTION 'support_upload_incomplete' USING ERRCODE='22023';
  END IF;
  UPDATE public.support_attachments SET state='ready' WHERE id=p_attachment_id RETURNING * INTO v_row;
  RETURN to_jsonb(v_row);
END; $$;

CREATE OR REPLACE FUNCTION public.support_begin_discard_attachment(p_attachment_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_row public.support_attachments%ROWTYPE;
BEGIN
  SELECT * INTO v_row FROM public.support_attachments WHERE id=p_attachment_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'support_forbidden' USING ERRCODE='42501'; END IF;
  PERFORM 1 FROM public.support_tickets WHERE id=v_row.ticket_id FOR UPDATE;
  SELECT * INTO v_row FROM public.support_attachments WHERE id=p_attachment_id FOR UPDATE;
  IF v_row.created_by IS DISTINCT FROM auth.uid() OR v_row.message_id IS NOT NULL OR NOT public.support_can_write_ticket(v_row.ticket_id) THEN RAISE EXCEPTION 'support_forbidden' USING ERRCODE='42501'; END IF;
  UPDATE public.support_attachments SET state='discarding' WHERE id=p_attachment_id RETURNING * INTO v_row;
  RETURN to_jsonb(v_row);
END; $$;

CREATE OR REPLACE FUNCTION public.support_discard_attachment(p_attachment_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_row public.support_attachments%ROWTYPE;
BEGIN
  SELECT * INTO v_row FROM public.support_attachments WHERE id=p_attachment_id FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;
  IF v_row.created_by IS DISTINCT FROM auth.uid() OR v_row.message_id IS NOT NULL OR NOT public.support_can_write_ticket(v_row.ticket_id) THEN RAISE EXCEPTION 'support_forbidden' USING ERRCODE='42501'; END IF;
  IF EXISTS(SELECT 1 FROM storage.objects WHERE bucket_id='support-ticket-attachments' AND name=v_row.storage_path) THEN RAISE EXCEPTION 'support_upload_still_exists' USING ERRCODE='22023'; END IF;
  DELETE FROM public.support_attachments WHERE id=p_attachment_id;
END; $$;

CREATE OR REPLACE FUNCTION public.support_send_message(p_ticket_id uuid,p_body text,p_client_nonce uuid,p_attachment_ids uuid[] DEFAULT '{}')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_ticket public.support_tickets%ROWTYPE; v_message public.support_messages%ROWTYPE; v_name text; v_platform boolean;
BEGIN
  IF NOT public.support_can_write_ticket(p_ticket_id) THEN RAISE EXCEPTION 'support_forbidden' USING ERRCODE='42501'; END IF;
  SELECT * INTO v_ticket FROM public.support_tickets WHERE id=p_ticket_id FOR UPDATE;
  SELECT * INTO v_message FROM public.support_messages WHERE author_id=auth.uid() AND client_nonce=p_client_nonce;
  IF FOUND THEN
    IF v_message.ticket_id<>p_ticket_id OR v_message.body<>trim(coalesce(p_body,'')) THEN RAISE EXCEPTION 'support_invalid_retry' USING ERRCODE='22023'; END IF;
    RETURN to_jsonb(v_message);
  END IF;
  IF p_client_nonce IS NULL OR p_attachment_ids IS NULL OR cardinality(p_attachment_ids)>5 OR length(coalesce(p_body,''))>10000 OR (trim(coalesce(p_body,''))='' AND cardinality(p_attachment_ids)=0) THEN RAISE EXCEPTION 'support_invalid_message' USING ERRCODE='22023'; END IF;
  IF cardinality(p_attachment_ids)<>(SELECT count(*) FROM public.support_attachments WHERE id=ANY(p_attachment_ids) AND ticket_id=p_ticket_id AND tenant_id=v_ticket.tenant_id AND created_by=auth.uid() AND state='ready' AND message_id IS NULL) THEN RAISE EXCEPTION 'support_invalid_attachment' USING ERRCODE='22023'; END IF;
  v_platform := public.platform_has_capability('support.write');
  IF v_platform THEN SELECT coalesce(nullif(full_name,''),email) INTO v_name FROM public.platform_users WHERE user_id=auth.uid() AND status='active';
  ELSE SELECT trim(concat_ws(' ',first_name,last_name)) INTO v_name FROM public.profiles WHERE auth_user_id=auth.uid() AND tenant_id=v_ticket.tenant_id AND status='active'; END IF;
  INSERT INTO public.support_messages(ticket_id,tenant_id,author_id,author_kind,author_name,body,client_nonce)
  VALUES(p_ticket_id,v_ticket.tenant_id,auth.uid(),CASE WHEN v_platform THEN 'platform' ELSE 'tenant' END,coalesce(nullif(v_name,''),'Unternehmen'),trim(coalesce(p_body,'')),p_client_nonce) RETURNING * INTO v_message;
  UPDATE public.support_attachments SET message_id=v_message.id WHERE id=ANY(p_attachment_ids);
  UPDATE public.support_tickets SET updated_at=now(),status=CASE WHEN v_platform THEN 'waiting_tenant' ELSE 'waiting_support' END WHERE id=p_ticket_id;
  INSERT INTO public.support_audit_events(ticket_id,actor_id,event,details) VALUES(p_ticket_id,auth.uid(),'message.sent',jsonb_build_object('message',v_message.id,'attachments',cardinality(p_attachment_ids)));
  RETURN to_jsonb(v_message);
END; $$;

CREATE OR REPLACE FUNCTION public.support_get_ticket(p_ticket_id uuid,p_before_message_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_ticket public.support_tickets%ROWTYPE; v_messages jsonb; v_before public.support_messages%ROWTYPE;
BEGIN
  IF NOT public.support_can_read_ticket(p_ticket_id) THEN RAISE EXCEPTION 'support_forbidden' USING ERRCODE='42501'; END IF;
  SELECT * INTO v_ticket FROM public.support_tickets WHERE id=p_ticket_id;
  IF p_before_message_id IS NOT NULL THEN
    SELECT * INTO v_before FROM public.support_messages WHERE id=p_before_message_id AND ticket_id=p_ticket_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'support_invalid_cursor' USING ERRCODE='22023'; END IF;
  END IF;
  SELECT coalesce(jsonb_agg(to_jsonb(q) ORDER BY q.created_at,q.id),'[]') INTO v_messages FROM (
    SELECT m.*,(SELECT coalesce(jsonb_agg(to_jsonb(a)),'[]') FROM public.support_attachments a WHERE a.message_id=m.id AND a.state='ready') AS attachments
    FROM public.support_messages m WHERE m.ticket_id=p_ticket_id
      AND (p_before_message_id IS NULL OR (m.created_at,m.id)<(v_before.created_at,v_before.id))
    ORDER BY m.created_at DESC,m.id DESC LIMIT 100
  ) q;
  RETURN jsonb_build_object('ticket',to_jsonb(v_ticket)||jsonb_build_object('tenant_name',(SELECT name FROM public.tenants WHERE id=v_ticket.tenant_id),'assigned_name',(SELECT full_name FROM public.platform_users WHERE id=v_ticket.assigned_to)),
    'messages',v_messages,
    'requests',(SELECT coalesce(jsonb_agg(to_jsonb(r)||jsonb_build_object('is_requester',pu.user_id=auth.uid()) ORDER BY r.created_at DESC),'[]') FROM public.support_access_requests r JOIN public.platform_users pu ON pu.id=r.platform_user_id WHERE r.ticket_id=p_ticket_id),
    'audit',(SELECT coalesce(jsonb_agg(to_jsonb(q)),'[]') FROM (SELECT event,details,created_at FROM public.support_audit_events WHERE ticket_id=p_ticket_id ORDER BY created_at DESC LIMIT 100) q),
    'can_approve',public.support_is_tenant_admin(v_ticket.tenant_id),'can_write',public.support_can_write_ticket(p_ticket_id),'can_support_write',public.platform_has_capability('support.write'));
END; $$;

CREATE OR REPLACE FUNCTION public.support_assert_access(p_request_id uuid,p_scope text)
RETURNS public.support_access_requests LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_request public.support_access_requests%ROWTYPE; v_status text;
BEGIN
  SELECT * INTO v_request FROM public.support_access_requests WHERE id=p_request_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'support_access_denied' USING ERRCODE='42501'; END IF;
  SELECT status INTO v_status FROM public.support_tickets WHERE id=v_request.ticket_id FOR UPDATE;
  SELECT * INTO v_request FROM public.support_access_requests WHERE id=p_request_id FOR UPDATE;
  IF auth.uid() IS NULL OR NOT public.platform_has_capability('support.write') OR v_status IN ('resolved','closed')
    OR v_request.status<>'approved' OR v_request.expires_at<=clock_timestamp() OR NOT (p_scope=ANY(v_request.scopes))
    OR NOT EXISTS(SELECT 1 FROM public.platform_users WHERE id=v_request.platform_user_id AND user_id=auth.uid() AND status='active')
  THEN RAISE EXCEPTION 'support_access_denied' USING ERRCODE='42501'; END IF;
  RETURN v_request;
END; $$;
REVOKE ALL ON FUNCTION public.support_assert_access(uuid,text) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.support_workspace_read(p_request_id uuid,p_scope text,p_offset integer DEFAULT 0)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_request public.support_access_requests%ROWTYPE; v_rows jsonb; v_offset integer:=greatest(0,least(coalesce(p_offset,0),100000));
BEGIN
  v_request:=public.support_assert_access(p_request_id,p_scope);
  CASE p_scope
    WHEN 'company.read' THEN
      SELECT jsonb_build_array(jsonb_build_object('id',id,'name',name,'legal_name',legal_name,'street',street,'house_number',house_number,'postal_code',postal_code,'city',city,'email',email,'phone',phone,'website',website,'updated_at',updated_at)) INTO v_rows FROM public.tenants WHERE id=v_request.tenant_id;
    WHEN 'assignments.read' THEN
      SELECT coalesce(jsonb_agg(to_jsonb(q)),'[]') INTO v_rows FROM (SELECT id,title,assignment_date,planned_start_at,planned_end_at,actual_start_at,actual_end_at,canonical_status,documentation_status,proof_status,internal_notes,updated_at FROM public.assist_visits WHERE tenant_id=v_request.tenant_id ORDER BY assignment_date DESC,id LIMIT 51 OFFSET v_offset) q;
    WHEN 'clients.read' THEN
      SELECT coalesce(jsonb_agg(to_jsonb(q)),'[]') INTO v_rows FROM (SELECT id,client_number,first_name,last_name,status,updated_at FROM public.clients WHERE tenant_id=v_request.tenant_id AND deleted_at IS NULL ORDER BY last_name,id LIMIT 51 OFFSET v_offset) q;
    WHEN 'employees.read' THEN
      SELECT coalesce(jsonb_agg(to_jsonb(q)),'[]') INTO v_rows FROM (SELECT id,employee_number,first_name,last_name,status,portal_enabled,updated_at FROM public.employees WHERE tenant_id=v_request.tenant_id AND deleted_at IS NULL ORDER BY last_name,id LIMIT 51 OFFSET v_offset) q;
    ELSE RAISE EXCEPTION 'support_scope_invalid' USING ERRCODE='22023';
  END CASE;
  INSERT INTO public.support_audit_events(ticket_id,actor_id,event,details) VALUES(v_request.ticket_id,auth.uid(),'workspace.read',jsonb_build_object('request',p_request_id,'scope',p_scope));
  RETURN jsonb_build_object('rows',coalesce(v_rows,'[]'),'expires_at',v_request.expires_at,'scope',p_scope);
END; $$;

CREATE OR REPLACE FUNCTION public.support_workspace_update(p_request_id uuid,p_scope text,p_record_id uuid,p_expected_updated_at timestamptz,p_patch jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_request public.support_access_requests%ROWTYPE; v_key text; v_count integer; v_legacy uuid;
BEGIN
  v_request:=public.support_assert_access(p_request_id,p_scope);
  IF jsonb_typeof(p_patch) IS DISTINCT FROM 'object' OR p_patch='{}'::jsonb OR p_expected_updated_at IS NULL THEN RAISE EXCEPTION 'support_patch_invalid' USING ERRCODE='22023'; END IF;
  IF p_scope='company.write' THEN
    IF p_record_id<>v_request.tenant_id THEN RAISE EXCEPTION 'support_access_denied' USING ERRCODE='42501'; END IF;
    FOR v_key IN SELECT jsonb_object_keys(p_patch) LOOP
      IF NOT(v_key=ANY(ARRAY['name','legal_name','street','house_number','postal_code','city','email','phone','website'])) OR jsonb_typeof(p_patch->v_key)<>'string' OR length(p_patch->>v_key)>200 THEN RAISE EXCEPTION 'support_patch_invalid' USING ERRCODE='22023'; END IF;
    END LOOP;
    IF p_patch ? 'name' AND trim(p_patch->>'name')='' THEN RAISE EXCEPTION 'support_patch_invalid' USING ERRCODE='22023'; END IF;
    UPDATE public.tenants SET name=coalesce(p_patch->>'name',name),legal_name=coalesce(p_patch->>'legal_name',legal_name),street=coalesce(p_patch->>'street',street),house_number=coalesce(p_patch->>'house_number',house_number),postal_code=coalesce(p_patch->>'postal_code',postal_code),city=coalesce(p_patch->>'city',city),email=coalesce(p_patch->>'email',email),phone=coalesce(p_patch->>'phone',phone),website=coalesce(p_patch->>'website',website),updated_at=now()
    WHERE id=v_request.tenant_id AND updated_at=p_expected_updated_at;
    GET DIAGNOSTICS v_count=ROW_COUNT;
    IF v_count=1 THEN UPDATE public.platform_tenants SET tenant_name=coalesce(p_patch->>'name',tenant_name),legal_name=coalesce(p_patch->>'legal_name',legal_name),updated_at=now() WHERE tenant_id=v_request.tenant_id; END IF;
  ELSIF p_scope='assignments.notes.write' THEN
    IF (SELECT count(*) FROM jsonb_object_keys(p_patch))<>1 OR NOT(p_patch ? 'internal_notes') OR jsonb_typeof(p_patch->'internal_notes')<>'string' OR length(p_patch->>'internal_notes')>10000 THEN RAISE EXCEPTION 'support_patch_invalid' USING ERRCODE='22023'; END IF;
    UPDATE public.assist_visits SET internal_notes=p_patch->>'internal_notes',updated_at=now() WHERE id=p_record_id AND tenant_id=v_request.tenant_id AND updated_at=p_expected_updated_at RETURNING legacy_assignment_id INTO v_legacy;
    GET DIAGNOSTICS v_count=ROW_COUNT;
    IF v_count=1 AND v_legacy IS NOT NULL THEN UPDATE public.assignments SET internal_notes=p_patch->>'internal_notes',updated_at=now() WHERE id=v_legacy AND tenant_id=v_request.tenant_id; END IF;
  ELSE RAISE EXCEPTION 'support_scope_invalid' USING ERRCODE='22023'; END IF;
  IF v_count<>1 THEN RAISE EXCEPTION 'support_record_changed' USING ERRCODE='40001'; END IF;
  INSERT INTO public.support_audit_events(ticket_id,actor_id,event,details) VALUES(v_request.ticket_id,auth.uid(),'workspace.updated',jsonb_build_object('request',p_request_id,'scope',p_scope,'record',p_record_id,'fields',(SELECT jsonb_agg(key) FROM jsonb_object_keys(p_patch) key)));
END; $$;

DO $$ DECLARE v_signature regprocedure;
BEGIN
  FOR v_signature IN SELECT p.oid::regprocedure FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname IN ('support_begin_discard_attachment','support_discard_attachment','support_reserve_attachment','support_finalize_attachment','support_send_message','support_get_ticket','support_workspace_read','support_workspace_update') LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated',v_signature);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated',v_signature);
  END LOOP;
END $$;

-- Realtime delivers only rows admitted by each subscriber's SELECT policy.
DO $$ DECLARE v_table text;
BEGIN
  IF EXISTS(SELECT 1 FROM pg_publication WHERE pubname='supabase_realtime') THEN
    FOREACH v_table IN ARRAY ARRAY['support_tickets','support_messages','support_access_requests'] LOOP
      IF NOT EXISTS(SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename=v_table) THEN
        EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I',v_table);
      END IF;
    END LOOP;
  END IF;
END $$;
