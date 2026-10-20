-- Preserve the existing legacy messages.can_create grant for internal notes.
-- No global RBAC change and no stored message/employee data mutation.
BEGIN;

CREATE OR REPLACE FUNCTION care_security.internal_note_can_send(p_tenant uuid)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $body$
DECLARE v_profile uuid; v_role uuid; v_role_key text;
BEGIN
  IF NOT coalesce(care_security.internal_note_auth_active(auth.uid())
    AND care_security.company_actor(p_tenant,'office.access'),false) THEN RETURN false; END IF;
  IF coalesce(care_security.company_actor(p_tenant,'communication.send_message'),false) THEN RETURN true; END IF;
  v_profile:=care_security.company_profile(p_tenant);
  IF v_profile IS NULL THEN RETURN false; END IF;
  SELECT p.role_id,r.key INTO v_role,v_role_key FROM public.profiles p JOIN public.roles r ON r.id=p.role_id WHERE p.id=v_profile;
  IF EXISTS(SELECT 1 FROM public.role_permission_sets s WHERE s.tenant_id=p_tenant AND s.role_key=v_role_key)
    OR EXISTS(SELECT 1 FROM public.employee_permission_overrides o JOIN public.employees e ON e.id=o.employee_id AND e.tenant_id=o.tenant_id
      WHERE e.profile_id=v_profile AND o.tenant_id=p_tenant AND o.permission_key IN ('communication.send_message','messages') AND o.allowed IS FALSE
        AND (o.valid_from IS NULL OR o.valid_from<=now()) AND (o.valid_until IS NULL OR o.valid_until>=now())) THEN RETURN false; END IF;
  RETURN EXISTS(SELECT 1 FROM public.role_permissions rp WHERE rp.role_id=v_role AND rp.permission_key='messages' AND rp.can_create IS TRUE
    AND (to_jsonb(rp)->>'tenant_id' IS NULL OR to_jsonb(rp)->>'tenant_id'=p_tenant::text));
END $body$;

CREATE OR REPLACE FUNCTION care_security.office_internal_note_recipients(p_tenant_id uuid,p_query text DEFAULT '',p_limit integer DEFAULT 100,p_offset integer DEFAULT 0)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $body$
DECLARE v_result jsonb;
BEGIN
  IF NOT care_security.internal_note_can_send(p_tenant_id) THEN
    RAISE EXCEPTION 'Active Office sending access required' USING ERRCODE='42501'; END IF;
  IF p_query IS NULL OR length(p_query)>120 OR p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 100 OR p_offset IS NULL OR p_offset<0 THEN
    RAISE EXCEPTION 'Invalid recipient query' USING ERRCODE='22023'; END IF;
  WITH available AS MATERIALIZED (SELECT employee_id,display_name FROM care_security.internal_note_recipients(p_tenant_id)
    WHERE strpos(lower(display_name),lower(btrim(p_query)))>0),
  page AS (SELECT * FROM available ORDER BY display_name,employee_id LIMIT p_limit OFFSET p_offset)
  SELECT jsonb_build_object('items',coalesce((SELECT jsonb_agg(to_jsonb(page) ORDER BY display_name,employee_id) FROM page),'[]'::jsonb),'total',(SELECT count(*) FROM available)) INTO v_result;
  RETURN v_result;
END $body$;

CREATE OR REPLACE FUNCTION care_security.office_internal_note_send(p_tenant_id uuid,p_sender_user_id uuid,p_request_id uuid,p_payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $body$
DECLARE v_payload jsonb; v_ids uuid[]; v_count integer; v_date date; v_note care_security.office_internal_notes; v_sender text;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() IS DISTINCT FROM p_sender_user_id OR p_tenant_id IS DISTINCT FROM public.current_tenant_id() THEN
    RAISE EXCEPTION 'Sending identity changed; reopen the reviewed draft' USING ERRCODE='42501'; END IF;
  IF NOT care_security.internal_note_can_send(p_tenant_id) THEN
    RAISE EXCEPTION 'Active Office sending access required' USING ERRCODE='42501'; END IF;
  IF p_request_id IS NULL OR p_payload IS NULL OR jsonb_typeof(p_payload)<>'object' THEN
    RAISE EXCEPTION 'Invalid send request' USING ERRCODE='22023'; END IF;
  IF EXISTS(SELECT 1 FROM jsonb_object_keys(p_payload) k WHERE k NOT IN ('title','body','type','priority','due_date','recipient_employee_ids'))
    OR jsonb_typeof(p_payload->'title') IS DISTINCT FROM 'string' OR length(p_payload->>'title')>240 OR length(care_security.internal_note_trim(p_payload->>'title'))<1
    OR jsonb_typeof(p_payload->'body') IS DISTINCT FROM 'string' OR length(p_payload->>'body')>20000 OR length(care_security.internal_note_trim(p_payload->>'body'))<1
    OR coalesce(p_payload->>'type','') NOT IN ('note','task','conversation','callback','request')
    OR coalesce(p_payload->>'priority','') NOT IN ('normal','high')
    OR jsonb_typeof(p_payload->'recipient_employee_ids') IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Invalid selected text or recipients' USING ERRCODE='22023'; END IF;
  v_count:=jsonb_array_length(p_payload->'recipient_employee_ids');
  IF v_count NOT BETWEEN 1 AND 25 OR EXISTS(SELECT 1 FROM jsonb_array_elements(p_payload->'recipient_employee_ids') x
    WHERE jsonb_typeof(x)<>'string' OR (x#>>'{}') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$') THEN
    RAISE EXCEPTION 'Choose 1 to 25 distinct employee recipients' USING ERRCODE='22023'; END IF;
  SELECT array_agg(DISTINCT value::uuid ORDER BY value::uuid) INTO v_ids FROM jsonb_array_elements_text(p_payload->'recipient_employee_ids');
  IF cardinality(v_ids)<>v_count THEN RAISE EXCEPTION 'Duplicate recipients' USING ERRCODE='22023'; END IF;
  IF p_payload->'due_date' IS NOT NULL AND p_payload->'due_date'<>'null'::jsonb THEN
    IF jsonb_typeof(p_payload->'due_date')<>'string' OR (p_payload->>'due_date') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN
      RAISE EXCEPTION 'Invalid due date' USING ERRCODE='22023'; END IF;
    BEGIN v_date:=(p_payload->>'due_date')::date;
    EXCEPTION WHEN invalid_datetime_format OR datetime_field_overflow THEN RAISE EXCEPTION 'Invalid due date' USING ERRCODE='22023'; END;
  END IF;
  v_payload:=jsonb_build_object('title',care_security.internal_note_trim(p_payload->>'title'),'body',care_security.internal_note_trim(p_payload->>'body'),
    'type',p_payload->>'type','priority',p_payload->>'priority','due_date',v_date,'recipient_employee_ids',to_jsonb(v_ids));
  -- Serialize retries before checking current recipient availability. A completed
  -- request keeps its original receipt even if an account is later disabled.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_tenant_id::text||':'||auth.uid()::text||':'||p_request_id::text,0));
  SELECT * INTO v_note FROM care_security.office_internal_notes WHERE tenant_id=p_tenant_id AND sender_user_id=auth.uid() AND request_id=p_request_id;
  IF FOUND THEN
    IF v_note.request_payload IS DISTINCT FROM v_payload THEN RAISE EXCEPTION 'Request ID was already used for different content' USING ERRCODE='22023'; END IF;
    RETURN jsonb_build_object('dispatch_id',v_note.id,'created_at',v_note.created_at,'sender_user_id',v_note.sender_user_id,'tenant_id',v_note.tenant_id);
  END IF;
  -- Keep employee/account deactivation from racing validation and insertion.
  PERFORM 1 FROM public.employees WHERE id=ANY(v_ids) ORDER BY id FOR SHARE;
  PERFORM 1 FROM public.employee_portal_accounts WHERE employee_id=ANY(v_ids) ORDER BY id FOR SHARE;
  IF (SELECT count(*) FROM care_security.internal_note_recipients(p_tenant_id) WHERE employee_id=ANY(v_ids))<>v_count THEN
    RAISE EXCEPTION 'A selected employee no longer has an active, unambiguous portal access' USING ERRCODE='22023'; END IF;
  SELECT coalesce(nullif(care_security.internal_note_trim(p.display_name),''),'Office') INTO v_sender FROM public.profiles p WHERE p.id=care_security.company_profile(p_tenant_id);
  INSERT INTO care_security.office_internal_notes(tenant_id,sender_user_id,sender_name,request_id,request_payload,title,body,type,priority,due_date)
    VALUES(p_tenant_id,auth.uid(),v_sender,p_request_id,v_payload,v_payload->>'title',v_payload->>'body',v_payload->>'type',v_payload->>'priority',v_date) RETURNING * INTO v_note;
  INSERT INTO care_security.office_internal_note_deliveries(dispatch_id,tenant_id,employee_id,recipient_user_id,display_name)
    SELECT v_note.id,p_tenant_id,employee_id,recipient_user_id,display_name FROM care_security.internal_note_recipients(p_tenant_id) WHERE employee_id=ANY(v_ids);
  GET DIAGNOSTICS v_count=ROW_COUNT;
  IF v_count<>cardinality(v_ids) THEN RAISE EXCEPTION 'Recipient availability changed; nothing was sent' USING ERRCODE='40001'; END IF;
  RETURN jsonb_build_object('dispatch_id',v_note.id,'created_at',v_note.created_at,'sender_user_id',v_note.sender_user_id,'tenant_id',v_note.tenant_id);
END $body$;

REVOKE ALL ON FUNCTION care_security.internal_note_can_send(uuid) FROM PUBLIC,anon,authenticated,service_role;
COMMIT;
