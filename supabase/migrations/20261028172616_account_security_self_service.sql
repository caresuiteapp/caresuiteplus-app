-- Additive self-service only: no existing authorization helper or RLS policy is changed.
-- Shared Web/Android account security. No messages, sample users or business records are created.
CREATE SCHEMA IF NOT EXISTS account_security;
REVOKE ALL ON SCHEMA account_security FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA account_security TO authenticated;

CREATE TABLE account_security.runtime (singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),mfa_enforced boolean NOT NULL DEFAULT true);
INSERT INTO account_security.runtime(singleton,mfa_enforced) VALUES(true,true);
ALTER TABLE account_security.runtime ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON account_security.runtime FROM PUBLIC,anon,authenticated;

CREATE TABLE account_security.device_sessions (
  session_id uuid PRIMARY KEY,
  auth_user_id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  portal_session_id uuid,
  label text NOT NULL CHECK (length(label) BETWEEN 1 AND 120),
  platform text NOT NULL CHECK (platform IN ('web','android','ios')),
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz
);
CREATE INDEX account_security_device_owner ON account_security.device_sessions(auth_user_id,tenant_id);
ALTER TABLE account_security.device_sessions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON account_security.device_sessions FROM PUBLIC, anon, authenticated;
CREATE TABLE account_security.notification_preferences (
  auth_user_id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  events jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(events)='object'),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(auth_user_id,tenant_id)
);
ALTER TABLE account_security.notification_preferences ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON account_security.notification_preferences FROM PUBLIC, anon, authenticated;

CREATE FUNCTION account_security.session_id() RETURNS uuid
LANGUAGE sql STABLE SET search_path=pg_catalog AS $$
 SELECT CASE WHEN coalesce(auth.jwt()->>'session_id','') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
 THEN (auth.jwt()->>'session_id')::uuid ELSE NULL END
$$;
CREATE FUNCTION account_security.active_session() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,account_security AS $$
 SELECT auth.uid() IS NOT NULL AND EXISTS(SELECT 1 FROM auth.sessions s
  WHERE s.id=account_security.session_id() AND s.user_id=auth.uid() AND (s.not_after IS NULL OR s.not_after>now()))
 AND NOT EXISTS(SELECT 1 FROM account_security.device_sessions d WHERE d.session_id=account_security.session_id() AND d.revoked_at IS NOT NULL)
$$;
CREATE FUNCTION account_security.requires_mfa() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,account_security AS $$
 SELECT coalesce(auth.jwt()->'app_metadata'->>'portal_type','business')='business'
 AND EXISTS(SELECT 1 FROM public.profiles p JOIN public.roles r ON r.id=p.role_id
  WHERE (p.auth_user_id=auth.uid() OR (p.auth_user_id IS NULL AND p.id=auth.uid()))
   AND p.status::text='active' AND p.is_active IS TRUE
   AND (coalesce((to_jsonb(r)->>'is_admin_role')::boolean,false) OR coalesce((to_jsonb(r)->>'can_manage_tenant')::boolean,false) OR coalesce((to_jsonb(r)->>'can_manage_users')::boolean,false) OR coalesce((to_jsonb(r)->>'can_manage_roles')::boolean,false)
    OR r.key IN ('owner','management','administration','pdl','business_admin','business_manager','akademie_admin','platform_admin')))
$$;
CREATE FUNCTION account_security.allowed_session() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,account_security AS $$
 SELECT account_security.active_session() AND (NOT (SELECT mfa_enforced FROM account_security.runtime WHERE singleton) OR NOT account_security.requires_mfa()
  OR (auth.jwt()->>'aal'='aal2' AND EXISTS(SELECT 1 FROM auth.sessions s WHERE s.id=account_security.session_id() AND s.user_id=auth.uid() AND s.aal::text='aal2')))
$$;

CREATE FUNCTION public.account_security_state() RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,account_security AS $$
 SELECT jsonb_build_object('active',account_security.active_session(),'mfaRequired',account_security.requires_mfa(),
  'aal',coalesce(auth.jwt()->>'aal','aal1'),'sessionId',coalesce(account_security.session_id()::text,''))
$$;
-- Only the caller's minimal bootstrap identity is available before MFA; no
-- business/clinical records or existing permission checks are bypassed.
CREATE FUNCTION public.account_security_bootstrap(p_expected_user_id uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,account_security AS $$
DECLARE result jsonb;
BEGIN
 IF auth.uid() IS DISTINCT FROM p_expected_user_id OR NOT account_security.active_session() THEN RAISE EXCEPTION 'Active own session required' USING ERRCODE='42501'; END IF;
 SELECT jsonb_build_object('mfaRequired',account_security.requires_mfa(),'aal',coalesce(auth.jwt()->>'aal','aal1'),
  'profile',jsonb_build_object('id',p.id,'tenantId',p.tenant_id,'roleId',p.role_id,'roleKey',r.key,
   'firstName',p.first_name,'lastName',p.last_name,'displayName',p.full_name,'email',p.email,'phone',p.phone,
   'avatarUrl',p.avatar_url,'createdAt',p.created_at,'updatedAt',p.updated_at)) INTO result
 FROM public.profiles p JOIN public.roles r ON r.id=p.role_id
 WHERE p.auth_user_id=auth.uid() AND p.status::text='active' AND p.is_active IS TRUE
 ORDER BY p.created_at LIMIT 1;
 RETURN result;
END $$;

CREATE FUNCTION public.account_security_register_device(p_platform text,p_label text,p_portal_session_token text DEFAULT NULL) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,account_security AS $$
DECLARE tid uuid; portal_id uuid;
BEGIN
 IF NOT account_security.allowed_session() OR p_platform NOT IN ('web','android','ios') OR length(btrim(p_label)) NOT BETWEEN 1 AND 120 THEN RAISE EXCEPTION 'Active account and valid device required' USING ERRCODE='42501'; END IF;
 tid:=public.current_tenant_id(); IF tid IS NULL THEN RAISE EXCEPTION 'Tenant required' USING ERRCODE='42501'; END IF;
 IF p_portal_session_token IS NOT NULL THEN
  IF length(p_portal_session_token)<16 THEN RAISE EXCEPTION 'Invalid portal session' USING ERRCODE='42501'; END IF;
  SELECT s.id INTO portal_id FROM public.portal_sessions s WHERE s.tenant_id=tid AND s.status::text='active' AND s.expires_at>now()
   AND s.session_token IN (encode(extensions.digest(p_portal_session_token,'sha256'),'hex'),p_portal_session_token)
   AND coalesce(s.metadata->>'account_id',s.metadata->>'portal_account_id',s.metadata->>'portal_access_id')=auth.jwt()->'app_metadata'->>'portal_account_id' LIMIT 1;
  IF portal_id IS NULL THEN RAISE EXCEPTION 'Own portal session required' USING ERRCODE='42501'; END IF;
 END IF;
 INSERT INTO account_security.device_sessions(session_id,auth_user_id,tenant_id,portal_session_id,platform,label)
 VALUES(account_security.session_id(),auth.uid(),tid,portal_id,p_platform,btrim(p_label))
 ON CONFLICT(session_id) DO UPDATE SET last_seen_at=now(),platform=excluded.platform,label=excluded.label,
  portal_session_id=coalesce(excluded.portal_session_id,account_security.device_sessions.portal_session_id)
 WHERE account_security.device_sessions.auth_user_id=auth.uid() AND account_security.device_sessions.tenant_id=tid AND account_security.device_sessions.revoked_at IS NULL;
 IF NOT FOUND THEN RAISE EXCEPTION 'Device registration denied' USING ERRCODE='42501'; END IF;
 RETURN true;
END $$;
CREATE FUNCTION public.account_security_list_devices() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,account_security AS $$
DECLARE result jsonb;
BEGIN
 IF NOT account_security.allowed_session() THEN RAISE EXCEPTION 'Active session required' USING ERRCODE='42501'; END IF;
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',d.session_id,'label',d.label,'platform',d.platform,
  'lastSeenAt',d.last_seen_at,'current',d.session_id=account_security.session_id(),'revokedAt',d.revoked_at) ORDER BY d.last_seen_at DESC),'[]') INTO result
 FROM account_security.device_sessions d WHERE d.auth_user_id=auth.uid() AND d.tenant_id=public.current_tenant_id();
 RETURN result;
END $$;
CREATE FUNCTION public.account_security_revoke_device(p_session_id uuid) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,account_security AS $$
DECLARE target account_security.device_sessions;
BEGIN
 IF NOT account_security.allowed_session() THEN RAISE EXCEPTION 'Active session required' USING ERRCODE='42501'; END IF;
 SELECT * INTO target FROM account_security.device_sessions d WHERE d.session_id=p_session_id AND d.auth_user_id=auth.uid() AND d.tenant_id=public.current_tenant_id() FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Own device required' USING ERRCODE='42501'; END IF;
 UPDATE account_security.device_sessions SET revoked_at=coalesce(revoked_at,now()) WHERE session_id=p_session_id;
 IF target.portal_session_id IS NOT NULL THEN
  UPDATE public.portal_sessions SET status='revoked',revoked_at=coalesce(revoked_at,now()),revoked_reason='Gerät durch Kontoinhaber abgemeldet',updated_at=now()
   WHERE id=target.portal_session_id AND tenant_id=target.tenant_id;
 END IF;
 DELETE FROM auth.sessions WHERE id=p_session_id AND user_id=auth.uid();
 RETURN true;
END $$;
CREATE FUNCTION public.account_security_notification_preferences(p_event text DEFAULT NULL,p_enabled boolean DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,account_security AS $$
DECLARE result jsonb; tid uuid;
BEGIN
 IF NOT account_security.allowed_session() THEN RAISE EXCEPTION 'Active session required' USING ERRCODE='42501'; END IF;
 tid:=public.current_tenant_id(); IF tid IS NULL THEN RAISE EXCEPTION 'Tenant required' USING ERRCODE='42501'; END IF;
 IF p_event IS NOT NULL THEN
  IF p_event NOT IN ('assignment','reminder','message','signature','proof','announcement','update') OR p_enabled IS NULL THEN RAISE EXCEPTION 'Invalid event preference'; END IF;
  INSERT INTO account_security.notification_preferences(auth_user_id,tenant_id,events) VALUES(auth.uid(),tid,jsonb_build_object(p_event,p_enabled))
  ON CONFLICT(auth_user_id,tenant_id) DO UPDATE SET events=account_security.notification_preferences.events||excluded.events,updated_at=now();
 END IF;
 SELECT jsonb_build_object('assignment',true,'reminder',true,'message',true,'signature',true,'proof',true,'announcement',true,'update',true)||coalesce(p.events,'{}') INTO result
 FROM (SELECT 1) seed LEFT JOIN account_security.notification_preferences p ON p.auth_user_id=auth.uid() AND p.tenant_id=tid;
 RETURN result;
END $$;

REVOKE ALL ON ALL FUNCTIONS IN SCHEMA account_security FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION account_security.allowed_session() TO authenticated;
REVOKE ALL ON FUNCTION public.account_security_state(),public.account_security_bootstrap(uuid),public.account_security_register_device(text,text,text),public.account_security_list_devices(),public.account_security_revoke_device(uuid),public.account_security_notification_preferences(text,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.account_security_state(),public.account_security_bootstrap(uuid),public.account_security_register_device(text,text,text),public.account_security_list_devices(),public.account_security_revoke_device(uuid),public.account_security_notification_preferences(text,boolean) TO authenticated;
