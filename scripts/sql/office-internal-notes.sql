-- Explicit copies of selected text. No source-note ID or private note content is
-- fetched here. Apply through the reviewed SQL deployment path, not client code.
BEGIN;

CREATE TABLE IF NOT EXISTS care_security.office_internal_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  sender_user_id uuid NOT NULL REFERENCES auth.users(id),
  sender_name text NOT NULL,
  request_id uuid NOT NULL,
  request_payload jsonb NOT NULL,
  title text NOT NULL CHECK(length(title) BETWEEN 1 AND 240),
  body text NOT NULL CHECK(length(body) BETWEEN 1 AND 20000),
  type text NOT NULL CHECK(type IN ('note','task','conversation','callback','request')),
  priority text NOT NULL CHECK(priority IN ('normal','high')),
  due_date date,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE(tenant_id,sender_user_id,request_id),
  UNIQUE(id,tenant_id)
);
CREATE TABLE IF NOT EXISTS care_security.office_internal_note_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dispatch_id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  employee_id uuid NOT NULL REFERENCES public.employees(id),
  recipient_user_id uuid NOT NULL REFERENCES auth.users(id),
  display_name text NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK(status IN ('open','in_progress','done')),
  read_at timestamptz,
  response text NOT NULL DEFAULT '' CHECK(length(response)<=2000),
  revision integer NOT NULL DEFAULT 1 CHECK(revision>0),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  FOREIGN KEY(dispatch_id,tenant_id) REFERENCES care_security.office_internal_notes(id,tenant_id),
  UNIQUE(dispatch_id,employee_id)
);
CREATE INDEX IF NOT EXISTS office_internal_notes_sender_idx ON care_security.office_internal_notes(tenant_id,sender_user_id,created_at DESC,id);
CREATE INDEX IF NOT EXISTS office_internal_note_delivery_recipient_idx ON care_security.office_internal_note_deliveries(tenant_id,recipient_user_id,employee_id,dispatch_id);
ALTER TABLE care_security.office_internal_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE care_security.office_internal_notes FORCE ROW LEVEL SECURITY;
ALTER TABLE care_security.office_internal_note_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE care_security.office_internal_note_deliveries FORCE ROW LEVEL SECURITY;
-- No direct table API, no tenant-wide administrator policy, no physical delete.
REVOKE ALL ON care_security.office_internal_notes,care_security.office_internal_note_deliveries FROM PUBLIC,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION care_security.internal_note_auth_active(p_user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $body$
  SELECT EXISTS(SELECT 1 FROM auth.users u WHERE u.id=p_user AND u.deleted_at IS NULL
    AND (u.banned_until IS NULL OR u.banned_until<=now()))
$body$;

CREATE OR REPLACE FUNCTION care_security.internal_note_trim(p_text text)
RETURNS text LANGUAGE sql IMMUTABLE STRICT SET search_path=pg_catalog AS $body$
  -- ECMAScript String.trim whitespace, matching the reviewed web payload.
  SELECT btrim(p_text,E' \t\r\n\f'||chr(11)||chr(160)||chr(5760)||chr(8192)||chr(8193)||chr(8194)||chr(8195)
    ||chr(8196)||chr(8197)||chr(8198)||chr(8199)||chr(8200)||chr(8201)||chr(8202)||chr(8232)||chr(8233)||chr(8239)||chr(8287)||chr(12288)||chr(65279))
$body$;

-- Older role rows grant sending through messages.can_create. Keep that existing
-- grant usable here without broadening company permissions or ignoring a more
-- specific employee denial / tenant replacement permission set.
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

CREATE OR REPLACE FUNCTION care_security.internal_note_recipients(p_tenant uuid)
RETURNS TABLE(employee_id uuid,display_name text,recipient_user_id uuid,portal_account_id uuid)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $body$
  SELECT e.id,care_security.internal_note_trim(concat_ws(' ',e.first_name,e.last_name)),a.auth_user_id,a.id
  FROM public.employees e JOIN public.employee_portal_accounts a
    ON a.employee_id=e.id AND a.tenant_id=e.tenant_id
  WHERE e.tenant_id=p_tenant AND e.status::text IN ('active','aktiv') AND e.deleted_at IS NULL
    AND length(care_security.internal_note_trim(concat_ws(' ',e.first_name,e.last_name)))>0
    AND (e.profile_id IS NULL OR EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=e.profile_id
      AND p.tenant_id=e.tenant_id AND p.status::text='active' AND p.is_active IS TRUE))
    AND a.status::text='active' AND a.blocked_at IS NULL AND a.auth_user_id IS NOT NULL
    AND care_security.internal_note_auth_active(a.auth_user_id)
    AND NOT EXISTS(SELECT 1 FROM public.employee_portal_accounts other
      WHERE other.id<>a.id AND other.status::text='active'
        AND (other.employee_id=e.id OR other.auth_user_id=a.auth_user_id))
$body$;

CREATE OR REPLACE FUNCTION care_security.internal_note_employee(p_tenant uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $body$
  SELECT r.employee_id FROM care_security.internal_note_recipients(p_tenant) r
  JOIN public.employees e ON e.id=r.employee_id AND e.tenant_id=p_tenant
  WHERE auth.uid() IS NOT NULL AND p_tenant=public.current_tenant_id() AND r.recipient_user_id=auth.uid()
    AND ((public.current_portal_type()='employee' AND r.portal_account_id=public.current_portal_account_id()
      AND r.employee_id=public.resolve_current_employee_id())
      OR (coalesce(public.current_portal_type(),'business')='business'
        AND e.profile_id=care_security.company_profile(p_tenant)))
$body$;

CREATE OR REPLACE FUNCTION care_security.internal_note_delivery_json(p_delivery care_security.office_internal_note_deliveries)
RETURNS jsonb LANGUAGE sql IMMUTABLE SET search_path=pg_catalog AS $body$
  SELECT jsonb_build_object('id',p_delivery.id,'employee_id',p_delivery.employee_id,
    'recipient_user_id',p_delivery.recipient_user_id,'display_name',p_delivery.display_name,
    'status',p_delivery.status,'read_at',p_delivery.read_at,'response',p_delivery.response,
    'revision',p_delivery.revision,'updated_at',p_delivery.updated_at)
$body$;

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

CREATE OR REPLACE FUNCTION care_security.office_internal_note_read(p_tenant_id uuid,p_box text,p_dispatch_id uuid DEFAULT NULL,p_limit integer DEFAULT 50,p_offset integer DEFAULT 0)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $body$
DECLARE v_employee uuid; v_result jsonb;
BEGIN
  IF NOT care_security.internal_note_auth_active(auth.uid()) OR p_tenant_id IS DISTINCT FROM public.current_tenant_id() THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
  IF p_box='sent' THEN
    IF NOT coalesce(care_security.company_actor(p_tenant_id,'office.access'),false) THEN RAISE EXCEPTION 'Active Office access required' USING ERRCODE='42501'; END IF;
  ELSIF p_box='inbox' THEN
    v_employee:=care_security.internal_note_employee(p_tenant_id);
    IF v_employee IS NULL THEN RAISE EXCEPTION 'Active employee access required' USING ERRCODE='42501'; END IF;
  ELSE RAISE EXCEPTION 'Invalid mailbox' USING ERRCODE='22023'; END IF;
  IF p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 100 OR p_offset IS NULL OR p_offset<0 THEN RAISE EXCEPTION 'Invalid page' USING ERRCODE='22023'; END IF;
  WITH visible AS MATERIALIZED (
    SELECT n.* FROM care_security.office_internal_notes n WHERE n.tenant_id=p_tenant_id AND (p_dispatch_id IS NULL OR n.id=p_dispatch_id)
      AND ((p_box='sent' AND n.sender_user_id=auth.uid()) OR (p_box='inbox' AND EXISTS(SELECT 1 FROM care_security.office_internal_note_deliveries d
        WHERE d.dispatch_id=n.id AND d.tenant_id=p_tenant_id AND d.employee_id=v_employee AND d.recipient_user_id=auth.uid())))
  ), page AS (SELECT * FROM visible ORDER BY created_at DESC,id LIMIT p_limit OFFSET p_offset)
  SELECT jsonb_build_object('total',(SELECT count(*) FROM visible),'items',coalesce((SELECT jsonb_agg(
    jsonb_build_object('id',n.id,'tenant_id',n.tenant_id,'sender_user_id',n.sender_user_id,'sender_name',n.sender_name,
      'title',n.title,'body',n.body,'type',n.type,'priority',n.priority,'due_date',n.due_date,'created_at',n.created_at,
      'deliveries',(SELECT jsonb_agg(care_security.internal_note_delivery_json(d) ORDER BY d.display_name,d.employee_id)
        FROM care_security.office_internal_note_deliveries d WHERE d.dispatch_id=n.id AND d.tenant_id=p_tenant_id
          AND (p_box='sent' OR (d.employee_id=v_employee AND d.recipient_user_id=auth.uid())))) ORDER BY n.created_at DESC,n.id) FROM page n),'[]'::jsonb)) INTO v_result;
  IF p_dispatch_id IS NOT NULL AND (v_result->>'total')::integer=0 THEN RAISE EXCEPTION 'Not found' USING ERRCODE='P0002'; END IF;
  RETURN v_result;
END $body$;

CREATE OR REPLACE FUNCTION care_security.office_internal_note_delivery_update(p_tenant_id uuid,p_delivery_id uuid,p_expected_revision integer,p_action text,p_status text DEFAULT NULL,p_response text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $body$
DECLARE v_employee uuid:=care_security.internal_note_employee(p_tenant_id); v_delivery care_security.office_internal_note_deliveries;
BEGIN
  IF v_employee IS NULL THEN RAISE EXCEPTION 'Active employee access required' USING ERRCODE='42501'; END IF;
  IF p_delivery_id IS NULL OR p_expected_revision IS NULL OR p_expected_revision<1 OR p_action IS NULL OR p_action NOT IN ('read','status')
    OR (p_action='status' AND (p_status IS NULL OR p_status NOT IN ('open','in_progress','done')))
    OR (p_action='read' AND (p_status IS NOT NULL OR p_response IS NOT NULL)) OR length(p_response)>2000 THEN
    RAISE EXCEPTION 'Invalid delivery update' USING ERRCODE='22023'; END IF;
  SELECT * INTO v_delivery FROM care_security.office_internal_note_deliveries
    WHERE id=p_delivery_id AND tenant_id=p_tenant_id AND employee_id=v_employee AND recipient_user_id=auth.uid() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Not found' USING ERRCODE='P0002'; END IF;
  IF v_delivery.revision<>p_expected_revision THEN RAISE EXCEPTION 'Delivery changed; reload it' USING ERRCODE='40001'; END IF;
  IF (p_action='read' AND v_delivery.read_at IS NOT NULL) OR (p_action='status' AND v_delivery.read_at IS NOT NULL AND v_delivery.status=p_status
    AND (p_response IS NULL OR v_delivery.response=care_security.internal_note_trim(p_response))) THEN RETURN care_security.internal_note_delivery_json(v_delivery); END IF;
  UPDATE care_security.office_internal_note_deliveries SET read_at=coalesce(read_at,clock_timestamp()),
    status=CASE WHEN p_action='status' THEN p_status ELSE status END,
    response=CASE WHEN p_action='status' AND p_response IS NOT NULL THEN care_security.internal_note_trim(p_response) ELSE response END,
    revision=revision+1,updated_at=clock_timestamp() WHERE id=v_delivery.id RETURNING * INTO v_delivery;
  RETURN care_security.internal_note_delivery_json(v_delivery);
END $body$;

-- PostgREST exposes invoker wrappers; privileged implementations live in the
-- unexposed schema and validate the complete actor again on every invocation.
CREATE OR REPLACE FUNCTION public.office_internal_note_recipients(p_tenant_id uuid,p_query text DEFAULT '',p_limit integer DEFAULT 100,p_offset integer DEFAULT 0)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path=pg_catalog AS $body$
  SELECT care_security.office_internal_note_recipients(p_tenant_id,p_query,p_limit,p_offset)
$body$;
CREATE OR REPLACE FUNCTION public.office_internal_note_send(p_tenant_id uuid,p_sender_user_id uuid,p_request_id uuid,p_payload jsonb)
RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path=pg_catalog AS $body$
  SELECT care_security.office_internal_note_send(p_tenant_id,p_sender_user_id,p_request_id,p_payload)
$body$;
CREATE OR REPLACE FUNCTION public.office_internal_note_read(p_tenant_id uuid,p_box text,p_dispatch_id uuid DEFAULT NULL,p_limit integer DEFAULT 50,p_offset integer DEFAULT 0)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path=pg_catalog AS $body$
  SELECT care_security.office_internal_note_read(p_tenant_id,p_box,p_dispatch_id,p_limit,p_offset)
$body$;
CREATE OR REPLACE FUNCTION public.office_internal_note_delivery_update(p_tenant_id uuid,p_delivery_id uuid,p_expected_revision integer,p_action text,p_status text DEFAULT NULL,p_response text DEFAULT NULL)
RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path=pg_catalog AS $body$
  SELECT care_security.office_internal_note_delivery_update(p_tenant_id,p_delivery_id,p_expected_revision,p_action,p_status,p_response)
$body$;
REVOKE ALL ON FUNCTION care_security.internal_note_trim(text),care_security.internal_note_auth_active(uuid),care_security.internal_note_can_send(uuid),care_security.internal_note_recipients(uuid),care_security.internal_note_employee(uuid),
  care_security.internal_note_delivery_json(care_security.office_internal_note_deliveries) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION care_security.office_internal_note_recipients(uuid,text,integer,integer),care_security.office_internal_note_send(uuid,uuid,uuid,jsonb),
  care_security.office_internal_note_read(uuid,text,uuid,integer,integer),care_security.office_internal_note_delivery_update(uuid,uuid,integer,text,text,text) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.office_internal_note_recipients(uuid,text,integer,integer),public.office_internal_note_send(uuid,uuid,uuid,jsonb),
  public.office_internal_note_read(uuid,text,uuid,integer,integer),public.office_internal_note_delivery_update(uuid,uuid,integer,text,text,text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.office_internal_note_recipients(uuid,text,integer,integer),public.office_internal_note_send(uuid,uuid,uuid,jsonb),
  public.office_internal_note_read(uuid,text,uuid,integer,integer),public.office_internal_note_delivery_update(uuid,uuid,integer,text,text,text),
  care_security.office_internal_note_recipients(uuid,text,integer,integer),care_security.office_internal_note_send(uuid,uuid,uuid,jsonb),
  care_security.office_internal_note_read(uuid,text,uuid,integer,integer),care_security.office_internal_note_delivery_update(uuid,uuid,integer,text,text,text) TO authenticated;
COMMENT ON TABLE care_security.office_internal_notes IS 'Immutable explicit text copies. Personal office_private_notes and their owner-only policies are not shared or altered.';
COMMIT;
