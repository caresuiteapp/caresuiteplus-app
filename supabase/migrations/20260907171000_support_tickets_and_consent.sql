-- Keep the pre-existing support_tickets table, its enum-based API, messages and attachments intact.
-- Consent-based Web support uses a dedicated workspace table with its own RLS.
-- Ticket communication is separate from tenant data access. No impersonation,
-- no change to current_tenant_id(), and no global tenant RLS bypass.
CREATE TABLE public.support_workspace_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  number bigint GENERATED ALWAYS AS IDENTITY UNIQUE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  created_by uuid NOT NULL,
  client_nonce uuid NOT NULL,
  subject text NOT NULL CHECK (length(trim(subject)) BETWEEN 3 AND 180),
  category text NOT NULL DEFAULT 'technical' CHECK(category IN ('technical','account','general')),
  priority text NOT NULL DEFAULT 'normal' CHECK(priority IN ('normal','high','urgent')),
  status text NOT NULL DEFAULT 'open' CHECK(status IN ('open','waiting_tenant','waiting_support','resolved','closed')),
  assigned_to uuid REFERENCES public.platform_users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id,tenant_id), UNIQUE(created_by,client_nonce)
);
CREATE INDEX support_workspace_tickets_tenant_updated ON public.support_workspace_tickets(tenant_id,updated_at DESC,id);
CREATE INDEX support_workspace_tickets_queue ON public.support_workspace_tickets(status,updated_at DESC,id);

CREATE TABLE public.support_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  author_id uuid NOT NULL,
  author_kind text NOT NULL CHECK(author_kind IN ('tenant','platform')),
  author_name text NOT NULL,
  body text NOT NULL CHECK(length(body) <= 10000),
  client_nonce uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(ticket_id,tenant_id) REFERENCES public.support_workspace_tickets(id,tenant_id),
  UNIQUE(id,ticket_id,tenant_id), UNIQUE(author_id,client_nonce)
);
CREATE INDEX support_messages_ticket_created ON public.support_messages(ticket_id,created_at DESC,id DESC);

CREATE TABLE public.support_access_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  platform_user_id uuid NOT NULL REFERENCES public.platform_users(id),
  requester_name text NOT NULL,
  reason text NOT NULL CHECK(length(trim(reason)) BETWEEN 10 AND 1000),
  scopes text[] NOT NULL CHECK(cardinality(scopes) BETWEEN 1 AND 6 AND scopes <@ ARRAY['company.read','company.write','assignments.read','assignments.notes.write','clients.read','employees.read']),
  CHECK(NOT ('company.write'=ANY(scopes)) OR 'company.read'=ANY(scopes)),
  CHECK(NOT ('assignments.notes.write'=ANY(scopes)) OR 'assignments.read'=ANY(scopes)),
  duration_minutes integer NOT NULL CHECK(duration_minutes IN (15,30,60,120)),
  status text NOT NULL DEFAULT 'requested' CHECK(status IN ('requested','approved','rejected','revoked')),
  approved_by uuid,
  approved_at timestamptz,
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(ticket_id,tenant_id) REFERENCES public.support_workspace_tickets(id,tenant_id),
  CHECK(status <> 'approved' OR (approved_by IS NOT NULL AND approved_at IS NOT NULL AND expires_at IS NOT NULL))
);
CREATE INDEX support_access_ticket ON public.support_access_requests(ticket_id,created_at DESC);

CREATE TABLE public.support_audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.support_workspace_tickets(id),
  actor_id uuid NOT NULL,
  event text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX support_audit_ticket ON public.support_audit_events(ticket_id,created_at DESC);

CREATE OR REPLACE FUNCTION public.support_is_tenant_member(p_tenant_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
  SELECT auth.uid() IS NOT NULL AND EXISTS(
    SELECT 1 FROM public.profiles p JOIN public.tenants t ON t.id=p.tenant_id
    WHERE p.auth_user_id=auth.uid() AND p.tenant_id=p_tenant_id AND p.status='active' AND p.is_active
      AND t.status IN ('active','trial','paused')
  );
$$;
CREATE OR REPLACE FUNCTION public.support_is_tenant_admin(p_tenant_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
  SELECT public.support_is_tenant_member(p_tenant_id) AND EXISTS(
    SELECT 1 FROM public.profiles p JOIN public.roles r ON r.id=p.role_id
    WHERE p.auth_user_id=auth.uid() AND p.tenant_id=p_tenant_id AND p.status='active' AND p.is_active
      AND (r.tenant_id=p_tenant_id OR r.tenant_id IS NULL)
      AND (r.is_admin_role OR r.can_manage_tenant OR r.can_manage_support)
  );
$$;
CREATE OR REPLACE FUNCTION public.support_can_read_ticket(p_ticket_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
  SELECT auth.uid() IS NOT NULL AND EXISTS(
    SELECT 1 FROM public.support_workspace_tickets t WHERE t.id=p_ticket_id AND (
      public.platform_has_capability('support.read') OR
      (public.support_is_tenant_member(t.tenant_id) AND (t.created_by=auth.uid() OR public.support_is_tenant_admin(t.tenant_id)))
    )
  );
$$;
CREATE OR REPLACE FUNCTION public.support_can_write_ticket(p_ticket_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
  SELECT public.support_can_read_ticket(p_ticket_id) AND EXISTS(
    SELECT 1 FROM public.support_workspace_tickets t WHERE t.id=p_ticket_id AND (
      public.platform_has_capability('support.write') OR
      (public.support_is_tenant_member(t.tenant_id) AND (t.created_by=auth.uid() OR public.support_is_tenant_admin(t.tenant_id)))
    )
  );
$$;

ALTER TABLE public.support_workspace_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_access_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_audit_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.support_workspace_tickets,public.support_messages,public.support_access_requests,public.support_audit_events FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.support_workspace_tickets,public.support_messages,public.support_access_requests,public.support_audit_events TO authenticated;
CREATE POLICY support_workspace_tickets_read ON public.support_workspace_tickets FOR SELECT TO authenticated USING(public.support_can_read_ticket(id));
CREATE POLICY support_messages_read ON public.support_messages FOR SELECT TO authenticated USING(public.support_can_read_ticket(ticket_id));
CREATE POLICY support_access_read ON public.support_access_requests FOR SELECT TO authenticated USING(public.support_can_read_ticket(ticket_id));
CREATE POLICY support_audit_read ON public.support_audit_events FOR SELECT TO authenticated USING(public.support_can_read_ticket(ticket_id));

CREATE OR REPLACE FUNCTION public.support_create_ticket(p_subject text,p_body text,p_category text,p_priority text,p_client_nonce uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_tenant uuid; v_ticket public.support_workspace_tickets%ROWTYPE; v_name text;
BEGIN
  SELECT p.tenant_id,trim(concat_ws(' ',p.first_name,p.last_name)) INTO v_tenant,v_name FROM public.profiles p
    WHERE p.auth_user_id=auth.uid() AND p.status='active' AND p.is_active LIMIT 1;
  IF NOT coalesce(public.support_is_tenant_member(v_tenant),false) THEN RAISE EXCEPTION 'support_forbidden' USING ERRCODE='42501'; END IF;
  IF p_client_nonce IS NULL OR coalesce(length(trim(p_body)),0) NOT BETWEEN 1 AND 10000 THEN RAISE EXCEPTION 'support_invalid_message' USING ERRCODE='22023'; END IF;
  INSERT INTO public.support_workspace_tickets(tenant_id,created_by,client_nonce,subject,category,priority)
  VALUES(v_tenant,auth.uid(),p_client_nonce,trim(p_subject),p_category,p_priority)
  ON CONFLICT(created_by,client_nonce) DO NOTHING RETURNING * INTO v_ticket;
  IF NOT FOUND THEN
    SELECT * INTO v_ticket FROM public.support_workspace_tickets WHERE created_by=auth.uid() AND client_nonce=p_client_nonce AND tenant_id=v_tenant;
    IF NOT FOUND THEN RAISE EXCEPTION 'support_invalid_retry' USING ERRCODE='22023'; END IF;
    RETURN to_jsonb(v_ticket);
  END IF;
  INSERT INTO public.support_messages(ticket_id,tenant_id,author_id,author_kind,author_name,body,client_nonce)
    VALUES(v_ticket.id,v_tenant,auth.uid(),'tenant',coalesce(nullif(v_name,''),'Unternehmen'),trim(p_body),p_client_nonce);
  INSERT INTO public.support_audit_events(ticket_id,actor_id,event) VALUES(v_ticket.id,auth.uid(),'ticket.created');
  RETURN to_jsonb(v_ticket);
END; $$;

CREATE OR REPLACE FUNCTION public.support_list_tickets(p_search text DEFAULT '',p_status text DEFAULT '',p_offset integer DEFAULT 0)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_rows jsonb; v_tenant uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'support_forbidden' USING ERRCODE='42501'; END IF;
  SELECT tenant_id INTO v_tenant FROM public.profiles WHERE auth_user_id=auth.uid() AND status='active' AND is_active LIMIT 1;
  SELECT coalesce(jsonb_agg(to_jsonb(q)),'[]') INTO v_rows FROM (
    SELECT t.*,n.name AS tenant_name,pu.full_name AS assigned_name,
      (SELECT m.body FROM public.support_messages m WHERE m.ticket_id=t.id ORDER BY m.created_at DESC,m.id DESC LIMIT 1) AS last_message
    FROM public.support_workspace_tickets t JOIN public.tenants n ON n.id=t.tenant_id LEFT JOIN public.platform_users pu ON pu.id=t.assigned_to
    WHERE public.support_can_read_ticket(t.id) AND (coalesce(p_status,'')='' OR t.status=p_status)
      AND (coalesce(p_search,'')='' OR t.subject ILIKE '%'||left(p_search,180)||'%' OR n.name ILIKE '%'||left(p_search,180)||'%' OR t.number::text=p_search)
    ORDER BY t.updated_at DESC,t.id DESC LIMIT 51 OFFSET greatest(0,least(coalesce(p_offset,0),100000))
  ) q;
  RETURN jsonb_build_object('tickets',v_rows,'can_create',coalesce(public.support_is_tenant_member(v_tenant),false),'can_manage',coalesce(public.support_is_tenant_admin(v_tenant),false),'can_support_write',public.platform_has_capability('support.write'));
END; $$;

CREATE OR REPLACE FUNCTION public.support_set_ticket_status(p_ticket_id uuid,p_status text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
  IF NOT public.support_can_write_ticket(p_ticket_id) THEN RAISE EXCEPTION 'support_forbidden' USING ERRCODE='42501'; END IF;
  PERFORM 1 FROM public.support_workspace_tickets WHERE id=p_ticket_id FOR UPDATE;
  UPDATE public.support_workspace_tickets SET status=p_status,updated_at=now() WHERE id=p_ticket_id;
  IF p_status IN ('resolved','closed') THEN
    UPDATE public.support_access_requests SET status='revoked',revoked_at=now() WHERE ticket_id=p_ticket_id AND status IN ('requested','approved');
  END IF;
  INSERT INTO public.support_audit_events(ticket_id,actor_id,event,details) VALUES(p_ticket_id,auth.uid(),'ticket.status',jsonb_build_object('status',p_status));
END; $$;

CREATE OR REPLACE FUNCTION public.support_claim_ticket(p_ticket_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_operator uuid;
BEGIN
  IF NOT public.platform_has_capability('support.write') OR NOT public.support_can_read_ticket(p_ticket_id) THEN RAISE EXCEPTION 'support_forbidden' USING ERRCODE='42501'; END IF;
  SELECT id INTO v_operator FROM public.platform_users WHERE user_id=auth.uid() AND status='active';
  UPDATE public.support_workspace_tickets SET assigned_to=v_operator,updated_at=now() WHERE id=p_ticket_id;
  INSERT INTO public.support_audit_events(ticket_id,actor_id,event,details) VALUES(p_ticket_id,auth.uid(),'ticket.assigned',jsonb_build_object('operator',v_operator));
END; $$;

CREATE OR REPLACE FUNCTION public.support_request_access(p_ticket_id uuid,p_reason text,p_scopes text[],p_duration_minutes integer DEFAULT 60)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_ticket public.support_workspace_tickets%ROWTYPE; v_operator public.platform_users%ROWTYPE; v_request public.support_access_requests%ROWTYPE;
BEGIN
  IF NOT public.platform_has_capability('support.write') THEN RAISE EXCEPTION 'support_forbidden' USING ERRCODE='42501'; END IF;
  SELECT * INTO v_ticket FROM public.support_workspace_tickets WHERE id=p_ticket_id FOR UPDATE;
  IF NOT FOUND OR v_ticket.status IN ('resolved','closed') THEN RAISE EXCEPTION 'support_ticket_closed' USING ERRCODE='22023'; END IF;
  SELECT * INTO v_operator FROM public.platform_users WHERE user_id=auth.uid() AND status='active';
  IF EXISTS(SELECT 1 FROM public.support_access_requests WHERE ticket_id=p_ticket_id AND platform_user_id=v_operator.id AND status='requested' AND created_at>now()-interval '1 day') THEN
    RAISE EXCEPTION 'support_request_pending' USING ERRCODE='22023';
  END IF;
  INSERT INTO public.support_access_requests(ticket_id,tenant_id,platform_user_id,requester_name,reason,scopes,duration_minutes)
  VALUES(p_ticket_id,v_ticket.tenant_id,v_operator.id,coalesce(nullif(v_operator.full_name,''),v_operator.email),trim(p_reason),p_scopes,p_duration_minutes) RETURNING * INTO v_request;
  INSERT INTO public.support_audit_events(ticket_id,actor_id,event,details) VALUES(p_ticket_id,auth.uid(),'access.requested',jsonb_build_object('request',v_request.id,'scopes',p_scopes,'minutes',p_duration_minutes));
  RETURN to_jsonb(v_request);
END; $$;

CREATE OR REPLACE FUNCTION public.support_decide_access(p_request_id uuid,p_decision text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_request public.support_access_requests%ROWTYPE; v_ticket public.support_workspace_tickets%ROWTYPE;
BEGIN
  SELECT * INTO v_request FROM public.support_access_requests WHERE id=p_request_id;
  IF NOT FOUND OR NOT public.support_is_tenant_admin(v_request.tenant_id) THEN RAISE EXCEPTION 'support_tenant_approval_required' USING ERRCODE='42501'; END IF;
  -- Consistent lock order with ticket closure and protected workspace calls.
  SELECT * INTO v_ticket FROM public.support_workspace_tickets WHERE id=v_request.ticket_id FOR UPDATE;
  SELECT * INTO v_request FROM public.support_access_requests WHERE id=p_request_id FOR UPDATE;
  IF p_decision='approve' THEN
    IF v_request.status<>'requested' OR v_request.created_at<now()-interval '1 day' OR v_ticket.status IN ('resolved','closed') THEN RAISE EXCEPTION 'support_request_inactive' USING ERRCODE='22023'; END IF;
    UPDATE public.support_access_requests SET status='approved',approved_by=auth.uid(),approved_at=now(),expires_at=now()+make_interval(mins=>duration_minutes) WHERE id=p_request_id RETURNING * INTO v_request;
  ELSIF p_decision='reject' AND v_request.status='requested' THEN
    UPDATE public.support_access_requests SET status='rejected' WHERE id=p_request_id RETURNING * INTO v_request;
  ELSIF p_decision='revoke' AND v_request.status IN ('requested','approved') THEN
    UPDATE public.support_access_requests SET status='revoked',revoked_at=now() WHERE id=p_request_id RETURNING * INTO v_request;
  ELSE RAISE EXCEPTION 'support_invalid_decision' USING ERRCODE='22023'; END IF;
  INSERT INTO public.support_audit_events(ticket_id,actor_id,event,details) VALUES(v_request.ticket_id,auth.uid(),'access.'||p_decision,jsonb_build_object('request',p_request_id,'scopes',v_request.scopes,'expires_at',v_request.expires_at));
  RETURN to_jsonb(v_request);
END; $$;

-- Close the former operator-only entry point. Consent cannot be bypassed by
-- an old browser tab or a direct call to the former RPC.
CREATE OR REPLACE FUNCTION public.platform_start_support_session(p_tenant_id uuid,p_reason text,p_expires_at timestamptz,p_readonly boolean DEFAULT true,p_allowed_scopes text[] DEFAULT '{}')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN RAISE EXCEPTION 'support_ticket_and_tenant_approval_required' USING ERRCODE='42501'; END; $$;

DO $$ DECLARE v_signature regprocedure;
BEGIN
  FOR v_signature IN SELECT p.oid::regprocedure FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname IN (
    'support_is_tenant_member','support_is_tenant_admin','support_can_read_ticket','support_can_write_ticket','support_create_ticket','support_list_tickets','support_set_ticket_status','support_claim_ticket','support_request_access','support_decide_access'
  ) LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated',v_signature);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated',v_signature);
  END LOOP;
END $$;
