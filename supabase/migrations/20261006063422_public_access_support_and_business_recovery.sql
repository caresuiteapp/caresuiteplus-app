BEGIN;

-- Hashes of rate-limit keys only. No password, recovery token or raw IP is stored.
CREATE SCHEMA IF NOT EXISTS public_access_private;
REVOKE ALL ON SCHEMA public_access_private FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA public_access_private TO service_role;
CREATE TABLE public_access_private.request_limits (
  channel text NOT NULL,
  key_hash text NOT NULL CHECK(key_hash ~ '^[a-f0-9]{64}$'),
  window_start timestamptz NOT NULL,
  attempts integer NOT NULL DEFAULT 1,
  PRIMARY KEY(channel,key_hash,window_start)
);
ALTER TABLE public_access_private.request_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public_access_private.request_limits FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public_access_private.request_limits TO service_role;

CREATE FUNCTION public.public_access_consume_limit(p_channel text,p_ip_hash text,p_account_hash text)
RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE v_start timestamptz := date_bin(interval '15 minutes',now(),timestamptz '2000-01-01');
  v_ip integer; v_account integer; v_ip_limit integer; v_account_limit integer;
BEGIN
  IF p_channel NOT IN ('reset_request','reset_complete','public_support') OR p_ip_hash !~ '^[a-f0-9]{64}$' OR p_account_hash !~ '^[a-f0-9]{64}$'
    OR p_ip_hash IS NULL OR p_account_hash IS NULL THEN RAISE EXCEPTION 'public_access_invalid_limit' USING ERRCODE='22023'; END IF;
  v_ip_limit := CASE p_channel WHEN 'public_support' THEN 10 WHEN 'reset_request' THEN 20 ELSE 30 END;
  v_account_limit := CASE p_channel WHEN 'public_support' THEN 3 WHEN 'reset_request' THEN 5 ELSE 5 END;
  DELETE FROM public_access_private.request_limits WHERE window_start < now()-interval '1 day';
  INSERT INTO public_access_private.request_limits(channel,key_hash,window_start)
    VALUES(p_channel||':ip',p_ip_hash,v_start)
    ON CONFLICT(channel,key_hash,window_start) DO UPDATE SET attempts=public_access_private.request_limits.attempts+1 RETURNING attempts INTO v_ip;
  INSERT INTO public_access_private.request_limits(channel,key_hash,window_start)
    VALUES(p_channel||':account',p_account_hash,v_start)
    ON CONFLICT(channel,key_hash,window_start) DO UPDATE SET attempts=public_access_private.request_limits.attempts+1 RETURNING attempts INTO v_account;
  RETURN v_ip <= v_ip_limit AND v_account <= v_account_limit;
END; $$;
REVOKE ALL ON FUNCTION public.public_access_consume_limit(text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.public_access_consume_limit(text,text,text) TO service_role;

-- Only genuine, active administration profiles. Portal roles are never eligible.
-- Auth identity and current Auth email are additionally checked through Auth Admin.
CREATE FUNCTION public.business_password_recovery_target(p_email text DEFAULT NULL,p_auth_user_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
  SELECT jsonb_build_object('authUserId',p.auth_user_id,'email',lower(p.email),
    'recipientName',trim(coalesce(p.first_name,'')||' '||coalesce(p.last_name,'')))
  FROM public.profiles p JOIN public.roles r ON r.id=p.role_id JOIN public.tenants t ON t.id=p.tenant_id
  WHERE (p_email IS NOT NULL OR p_auth_user_id IS NOT NULL)
    AND (p_email IS NULL OR lower(p.email)=lower(trim(p_email)))
    AND (p_auth_user_id IS NULL OR p.auth_user_id=p_auth_user_id)
    AND p.status='active' AND p.is_active AND t.status IN ('active','trial')
    AND (r.tenant_id IS NULL OR r.tenant_id=p.tenant_id)
    AND r.key IN ('owner','admin','management','pdl','administration','billing','quality_management','team_lead','dispatcher','readonly')
  ORDER BY p.auth_user_id LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.business_password_recovery_target(text,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.business_password_recovery_target(text,uuid) TO service_role;

-- Public submissions have no tenant assignment and grant no workspace access.
CREATE TABLE public.public_support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  number bigint GENERATED ALWAYS AS IDENTITY UNIQUE,
  client_nonce uuid NOT NULL UNIQUE,
  request_hash text NOT NULL CHECK(request_hash ~ '^[a-f0-9]{64}$'),
  name text NOT NULL CHECK(length(trim(name)) BETWEEN 2 AND 100),
  email text NOT NULL CHECK(length(email) <= 254 AND email ~ '^[^[:space:]@<>]+@[^[:space:]@<>]+\.[^[:space:]@<>]+$'),
  organization text NOT NULL DEFAULT '' CHECK(length(organization) <= 200),
  subject text NOT NULL CHECK(length(trim(subject)) BETWEEN 3 AND 180),
  category text NOT NULL CHECK(category IN ('technical','account','general')),
  message text NOT NULL CHECK(length(trim(message)) BETWEEN 20 AND 6000),
  privacy_acknowledged_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'open' CHECK(status IN ('open','in_progress','resolved','closed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX public_support_tickets_queue ON public.public_support_tickets(status,updated_at DESC,id DESC);
ALTER TABLE public.public_support_tickets ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.public_support_tickets FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.public_support_tickets TO service_role;
GRANT USAGE,SELECT ON SEQUENCE public.public_support_tickets_number_seq TO service_role;
GRANT SELECT ON public.public_support_tickets TO authenticated;
GRANT UPDATE(status,updated_at) ON public.public_support_tickets TO authenticated;
CREATE POLICY public_support_operator_read ON public.public_support_tickets FOR SELECT TO authenticated
  USING(auth.uid() IS NOT NULL AND public.platform_has_capability('support.read'));
CREATE POLICY public_support_operator_update ON public.public_support_tickets FOR UPDATE TO authenticated
  USING(auth.uid() IS NOT NULL AND public.platform_has_capability('support.write'))
  WITH CHECK(auth.uid() IS NOT NULL AND public.platform_has_capability('support.write'));

CREATE FUNCTION public.public_support_submit(p_nonce uuid,p_request_hash text,p_ip_hash text,p_email_hash text,p_data jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE v_ticket public.public_support_tickets%ROWTYPE;
BEGIN
  IF coalesce((p_data->>'privacyAccepted')::boolean,false) IS NOT TRUE THEN RAISE EXCEPTION 'support_invalid_privacy' USING ERRCODE='22023'; END IF;
  SELECT * INTO v_ticket FROM public.public_support_tickets WHERE client_nonce=p_nonce;
  IF FOUND THEN
    IF v_ticket.request_hash<>p_request_hash THEN RAISE EXCEPTION 'support_invalid_nonce' USING ERRCODE='22023'; END IF;
    RETURN jsonb_build_object('reference','PUB-'||lpad(v_ticket.number::text,greatest(6,length(v_ticket.number::text)),'0'));
  END IF;
  IF NOT public.public_access_consume_limit('public_support',p_ip_hash,p_email_hash) THEN
    RETURN jsonb_build_object('rateLimited',true);
  END IF;
  INSERT INTO public.public_support_tickets(client_nonce,request_hash,name,email,organization,subject,category,message)
    VALUES(p_nonce,p_request_hash,trim(p_data->>'name'),lower(trim(p_data->>'email')),coalesce(trim(p_data->>'organization'),''),trim(p_data->>'subject'),p_data->>'category',trim(p_data->>'message'))
    ON CONFLICT(client_nonce) DO UPDATE SET client_nonce=EXCLUDED.client_nonce
      WHERE public.public_support_tickets.request_hash=EXCLUDED.request_hash RETURNING * INTO v_ticket;
  IF NOT FOUND THEN RAISE EXCEPTION 'support_invalid_nonce' USING ERRCODE='22023'; END IF;
  RETURN jsonb_build_object('reference','PUB-'||lpad(v_ticket.number::text,greatest(6,length(v_ticket.number::text)),'0'));
END; $$;
REVOKE ALL ON FUNCTION public.public_support_submit(uuid,text,text,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.public_support_submit(uuid,text,text,text,jsonb) TO service_role;

CREATE FUNCTION public.support_list_public_tickets(p_status text DEFAULT '',p_offset integer DEFAULT 0)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE v_rows jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT public.platform_has_capability('support.read') THEN RAISE EXCEPTION 'support_forbidden' USING ERRCODE='42501'; END IF;
  SELECT coalesce(jsonb_agg(to_jsonb(q)),'[]'::jsonb) INTO v_rows FROM (
    SELECT t.id,'PUB-'||lpad(t.number::text,greatest(6,length(t.number::text)),'0') AS reference,t.name,t.email,t.organization,t.subject,t.category,t.message,t.status,t.created_at,t.updated_at
    FROM public.public_support_tickets t WHERE coalesce(p_status,'')='' OR t.status=p_status
    ORDER BY t.updated_at DESC,t.id DESC LIMIT 51 OFFSET greatest(0,least(coalesce(p_offset,0),100000))
  ) q;
  RETURN jsonb_build_object('tickets',v_rows);
END; $$;
CREATE FUNCTION public.support_set_public_ticket_status(p_ticket_id uuid,p_status text)
RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.platform_has_capability('support.write') THEN RAISE EXCEPTION 'support_forbidden' USING ERRCODE='42501'; END IF;
  IF p_status NOT IN ('open','in_progress','resolved','closed') THEN RAISE EXCEPTION 'support_invalid_status' USING ERRCODE='22023'; END IF;
  UPDATE public.public_support_tickets SET status=p_status,updated_at=now() WHERE id=p_ticket_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'support_forbidden' USING ERRCODE='42501'; END IF;
  RETURN true;
END; $$;
REVOKE ALL ON FUNCTION public.support_list_public_tickets(text,integer),public.support_set_public_ticket_status(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.support_list_public_tickets(text,integer),public.support_set_public_ticket_status(uuid,text) TO authenticated;

COMMIT;
