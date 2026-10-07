BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '60s';

-- Keep access decisions separate from editable tenant account data.
CREATE TABLE public.platform_account_access_states (
  tenant_user_id uuid PRIMARY KEY REFERENCES public.tenant_users(id),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  state text NOT NULL DEFAULT 'active' CHECK (state IN ('active','inactive','deleted')),
  prior_status text,
  deleted_from_state text,
  deleted_user_status text,
  deleted_user_archived_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.platform_account_access_states ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.platform_account_access_states FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON public.platform_account_access_states TO service_role;
CREATE INDEX platform_account_access_states_tenant ON public.platform_account_access_states(tenant_id,state);

CREATE OR REPLACE FUNCTION public.platform_tenant_access_allowed(p_tenant_id uuid,p_allow_platform boolean DEFAULT true)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
  IF p_tenant_id IS NULL THEN RETURN true; END IF;
  IF p_allow_platform AND public.is_platform_user() THEN RETURN true; END IF;
  IF EXISTS(SELECT 1 FROM public.platform_tenants WHERE tenant_id=p_tenant_id AND status<>'active') THEN RETURN false; END IF;
  RETURN NOT EXISTS(SELECT 1 FROM public.platform_account_access_states s
    JOIN public.tenant_users u ON u.id=s.tenant_user_id AND u.tenant_id=s.tenant_id
    WHERE s.tenant_id=p_tenant_id AND u.auth_user_id=auth.uid() AND s.state IN ('inactive','deleted'));
END; $$;
REVOKE ALL ON FUNCTION public.platform_tenant_access_allowed(uuid,boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.platform_tenant_access_allowed(uuid,boolean) TO anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION public.platform_manage_tenant_access(
  p_tenant_id uuid,p_action text,p_expected_status text,p_expected_updated_at timestamptz,p_confirmation text,p_reason text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_before public.platform_tenants%ROWTYPE; v_after public.platform_tenants%ROWTYPE; v_status text; v_audit text; v_message text;
BEGIN
  PERFORM public.platform_assert_capability('tenants.suspend');
  IF p_reason IS NULL OR length(trim(p_reason)) NOT BETWEEN 5 AND 1000 THEN RAISE EXCEPTION 'access_reason_invalid' USING ERRCODE='22023'; END IF;
  SELECT * INTO v_before FROM public.platform_tenants WHERE tenant_id=p_tenant_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'tenant_not_found' USING ERRCODE='P0002'; END IF;
  IF p_expected_status IS DISTINCT FROM v_before.status OR p_expected_updated_at IS DISTINCT FROM v_before.updated_at
    THEN RAISE EXCEPTION 'access_record_changed' USING ERRCODE='40001'; END IF;
  CASE
    WHEN p_action='suspend' AND v_before.status='active' THEN v_status:='suspended';v_audit:='tenant.suspended';v_message:='Das Unternehmen ist gesperrt.';
    WHEN p_action='unsuspend' AND v_before.status IN ('suspended','locked') THEN v_status:='active';v_audit:='tenant.unsuspended';v_message:='Das Unternehmen ist entsperrt. Einzeln deaktivierte Konten bleiben deaktiviert.';
    WHEN p_action='deactivate' AND v_before.status IN ('active','suspended','locked') THEN v_status:='terminated';v_audit:='tenant.deactivated';v_message:='Das Unternehmen ist deaktiviert. Die Daten bleiben erhalten.';
    WHEN p_action='reactivate' AND v_before.status='terminated' THEN v_status:='active';v_audit:='tenant.reactivated';v_message:='Das Unternehmen ist reaktiviert. Einzeln deaktivierte Konten bleiben deaktiviert.';
    WHEN p_action='delete' AND v_before.status IN ('active','suspended','locked','terminated') THEN v_status:='deleted_soft';v_audit:='tenant.deleted';v_message:='Das Unternehmen wurde in die Übersicht „Gelöscht“ verschoben. Die Daten bleiben erhalten.';
    WHEN p_action='restore' AND v_before.status='deleted_soft' THEN v_status:='terminated';v_audit:='tenant.restored';v_message:='Das Unternehmen ist wiederhergestellt und bleibt bis zur Reaktivierung deaktiviert.';
    ELSE RAISE EXCEPTION 'access_action_invalid' USING ERRCODE='22023';
  END CASE;
  IF (p_action='suspend' AND trim(coalesce(p_confirmation,''))<>'SPERREN')
    OR (p_action='deactivate' AND trim(coalesce(p_confirmation,''))<>'DEAKTIVIEREN')
    OR (p_action='delete' AND trim(coalesce(p_confirmation,''))<>trim(v_before.tenant_name))
    THEN RAISE EXCEPTION 'access_confirmation_required' USING ERRCODE='22023'; END IF;
  IF v_status<>'active' THEN
    -- Same lock order as account preparation: company, account, outbox.
    PERFORM 1 FROM public.tenant_users WHERE tenant_id=p_tenant_id ORDER BY id FOR UPDATE;
    IF EXISTS(SELECT 1 FROM public.platform_account_operations WHERE tenant_id=p_tenant_id AND state IN ('prepared','processing','needs_review'))
      THEN RAISE EXCEPTION 'account_update_needs_review' USING ERRCODE='55000'; END IF;
    PERFORM 1 FROM public.registration_welcome_outbox WHERE tenant_id=p_tenant_id ORDER BY id FOR UPDATE;
    IF EXISTS(SELECT 1 FROM public.registration_welcome_outbox WHERE tenant_id=p_tenant_id AND state='sending' AND lease_until>now())
      THEN RAISE EXCEPTION 'account_mail_in_progress' USING ERRCODE='55000'; END IF;
    UPDATE public.registration_welcome_outbox SET state='cancelled',lease_token=NULL,lease_until=NULL,updated_at=now()
      WHERE tenant_id=p_tenant_id AND state IN ('pending','failed');
  END IF;
  UPDATE public.platform_tenants SET status=v_status,updated_at=clock_timestamp(),
    suspended_at=CASE WHEN v_status='suspended' THEN now() WHEN v_status='active' THEN NULL ELSE suspended_at END,
    terminated_at=CASE WHEN v_status IN ('terminated','deleted_soft') THEN now() WHEN v_status='active' THEN NULL ELSE terminated_at END
    WHERE tenant_id=p_tenant_id RETURNING * INTO v_after;
  PERFORM public.platform_write_audit_log(v_audit,'platform_tenant',v_after.id,p_tenant_id,to_jsonb(v_before),to_jsonb(v_after),trim(p_reason));
  RETURN jsonb_build_object('status',v_status,'message',v_message);
END; $$;
REVOKE ALL ON FUNCTION public.platform_manage_tenant_access(uuid,text,text,timestamptz,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.platform_manage_tenant_access(uuid,text,text,timestamptz,text,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.platform_manage_account_access(
  p_tenant_id uuid,p_tenant_user_id uuid,p_action text,p_expected_status text,p_expected_updated_at timestamptz,p_confirmation text,p_reason text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_user public.tenant_users%ROWTYPE; v_after public.tenant_users%ROWTYPE; v_access public.platform_account_access_states%ROWTYPE;
  v_company_status text; v_state text; v_status text; v_message text; v_before jsonb; v_name text;
BEGIN
  PERFORM public.platform_assert_capability('tenants.suspend');
  IF p_reason IS NULL OR length(trim(p_reason)) NOT BETWEEN 5 AND 1000 THEN RAISE EXCEPTION 'access_reason_invalid' USING ERRCODE='22023'; END IF;
  SELECT status INTO v_company_status FROM public.platform_tenants WHERE tenant_id=p_tenant_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'tenant_not_found' USING ERRCODE='P0002'; END IF;
  IF v_company_status='deleted_soft' THEN RAISE EXCEPTION 'tenant_deleted_restore_first' USING ERRCODE='22023'; END IF;
  SELECT * INTO v_user FROM public.tenant_users WHERE id=p_tenant_user_id AND tenant_id=p_tenant_id
    AND employee_id IS NULL AND role_key NOT IN ('employee','client') FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'account_not_found' USING ERRCODE='P0002'; END IF;
  IF p_expected_status IS DISTINCT FROM v_user.status OR p_expected_updated_at IS DISTINCT FROM v_user.updated_at
    THEN RAISE EXCEPTION 'access_record_changed' USING ERRCODE='40001'; END IF;
  IF EXISTS(SELECT 1 FROM public.platform_account_operations WHERE auth_user_id=v_user.auth_user_id AND state IN ('prepared','processing','needs_review'))
    THEN RAISE EXCEPTION 'account_update_needs_review' USING ERRCODE='55000'; END IF;
  PERFORM 1 FROM public.registration_welcome_outbox WHERE tenant_user_id=v_user.id FOR UPDATE;
  IF EXISTS(SELECT 1 FROM public.registration_welcome_outbox WHERE tenant_user_id=v_user.id AND state='sending' AND lease_until>now())
    THEN RAISE EXCEPTION 'account_mail_in_progress' USING ERRCODE='55000'; END IF;
  SELECT * INTO v_access FROM public.platform_account_access_states WHERE tenant_user_id=v_user.id FOR UPDATE;
  v_state:=coalesce(v_access.state,'active');
  v_before:=jsonb_build_object('account',to_jsonb(v_user),'access_state',v_state);
  v_name:=coalesce(nullif(trim(v_user.display_name),''),nullif(trim(v_user.email),''),'Verwaltungskonto');
  IF (p_action='deactivate' AND trim(coalesce(p_confirmation,''))<>'DEAKTIVIEREN')
    OR (p_action='delete' AND trim(coalesce(p_confirmation,''))<>v_name)
    THEN RAISE EXCEPTION 'access_confirmation_required' USING ERRCODE='22023'; END IF;
  IF p_action IN ('deactivate','delete') AND v_user.role_key='owner' AND v_user.status='active' AND v_state='active' AND v_company_status='active'
    AND NOT EXISTS(SELECT 1 FROM public.tenant_users u LEFT JOIN public.platform_account_access_states s ON s.tenant_user_id=u.id
      WHERE u.tenant_id=p_tenant_id AND u.id<>v_user.id AND u.role_key='owner' AND u.status='active' AND u.archived_at IS NULL
        AND coalesce(s.state,'active')='active')
    THEN RAISE EXCEPTION 'last_tenant_owner_protected' USING ERRCODE='55000'; END IF;
  INSERT INTO public.platform_account_access_states(tenant_user_id,tenant_id) VALUES(v_user.id,p_tenant_id) ON CONFLICT DO NOTHING;
  CASE
    WHEN p_action='deactivate' AND v_state='active' AND v_user.status IN ('active','pending_first_login','password_reset_required') AND v_user.archived_at IS NULL THEN
      UPDATE public.platform_account_access_states SET state='inactive',prior_status=v_user.status,updated_at=now() WHERE tenant_user_id=v_user.id;
      v_status:='blocked';v_message:='Das Konto ist für dieses Unternehmen deaktiviert.';
    WHEN p_action='reactivate' AND v_state='inactive' AND v_user.status='blocked' AND v_user.archived_at IS NULL THEN
      UPDATE public.platform_account_access_states SET state='active',updated_at=now() WHERE tenant_user_id=v_user.id;
      v_status:=v_access.prior_status;v_message:='Das Konto ist reaktiviert. Ein deaktiviertes Unternehmen bleibt unzugänglich.';
    WHEN p_action='delete' AND v_state IN ('active','inactive') AND v_user.archived_at IS NULL THEN
      UPDATE public.platform_account_access_states SET state='deleted',deleted_from_state=v_state,deleted_user_status=v_user.status,
        deleted_user_archived_at=v_user.archived_at,updated_at=now() WHERE tenant_user_id=v_user.id;
      v_status:='archived';v_message:='Der Zugang zu diesem Unternehmen wurde entfernt. Das Konto ist unter „Gelöschte Konten“ auffindbar.';
    WHEN p_action='restore' AND v_state='deleted' AND v_user.status='archived' THEN
      UPDATE public.platform_account_access_states SET state=v_access.deleted_from_state,updated_at=now() WHERE tenant_user_id=v_user.id;
      v_status:=v_access.deleted_user_status;v_message:=CASE WHEN v_access.deleted_from_state='inactive' THEN 'Das Konto ist wiederhergestellt und bleibt deaktiviert.' ELSE 'Das Konto ist mit seinem vorherigen Zustand wiederhergestellt.' END;
    ELSE RAISE EXCEPTION 'access_action_invalid' USING ERRCODE='22023';
  END CASE;
  UPDATE public.tenant_users SET status=v_status,updated_at=clock_timestamp(),
    archived_at=CASE WHEN p_action='delete' THEN now() WHEN p_action='restore' THEN v_access.deleted_user_archived_at ELSE archived_at END
    WHERE id=v_user.id RETURNING * INTO v_after;
  IF p_action IN ('deactivate','delete') THEN
    UPDATE public.registration_welcome_outbox SET state='cancelled',lease_token=NULL,lease_until=NULL,updated_at=now()
      WHERE tenant_user_id=v_user.id AND state IN ('pending','failed');
  END IF;
  SELECT state INTO v_state FROM public.platform_account_access_states WHERE tenant_user_id=v_user.id;
  PERFORM public.platform_write_audit_log('tenant.account.'||CASE p_action WHEN 'deactivate' THEN 'deactivated' WHEN 'reactivate' THEN 'reactivated' WHEN 'delete' THEN 'deleted' ELSE 'restored' END,
    'tenant_user',v_user.id,p_tenant_id,v_before,jsonb_build_object('account',to_jsonb(v_after),'access_state',v_state),trim(p_reason));
  RETURN jsonb_build_object('status',v_status,'message',v_message);
END; $$;
REVOKE ALL ON FUNCTION public.platform_manage_account_access(uuid,uuid,text,text,timestamptz,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.platform_manage_account_access(uuid,uuid,text,text,timestamptz,text,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.platform_list_tenant_account_access(p_tenant_id uuid,p_include_deleted boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
  PERFORM public.platform_assert_capability('tenants.read');
  RETURN jsonb_build_object('items',coalesce((SELECT jsonb_agg(jsonb_build_object(
    'id',u.id,'display_name',u.display_name,'username',u.username,'email',u.email,'role_key',u.role_key,'status',u.status,
    'last_login_at',u.last_login_at,'has_login',u.auth_user_id IS NOT NULL,'updated_at',u.updated_at,'access_state',coalesce(s.state,'active'),
    'open_operation',(SELECT jsonb_build_object('state',o.state,'action',o.action,'created_at',o.created_at)
      FROM public.platform_account_operations o WHERE o.auth_user_id=u.auth_user_id AND o.state IN ('prepared','processing','needs_review') ORDER BY o.created_at DESC LIMIT 1),
    'welcome',CASE WHEN q.id IS NOT NULL THEN jsonb_build_object('state',q.state,'recipient_email',q.recipient_email,'attempts',q.attempts,
      'sent_at',q.sent_at,'updated_at',q.updated_at,'last_error_code',q.last_error_code,'delivery_revision',q.delivery_revision) ELSE NULL END
  ) ORDER BY u.display_name,u.id) FROM public.tenant_users u
    LEFT JOIN public.platform_account_access_states s ON s.tenant_user_id=u.id AND s.tenant_id=u.tenant_id
    LEFT JOIN public.registration_welcome_outbox q ON q.tenant_user_id=u.id
    WHERE u.tenant_id=p_tenant_id AND u.employee_id IS NULL AND u.role_key NOT IN ('employee','client')
      AND ((u.archived_at IS NULL AND coalesce(s.state,'active')<>'deleted') OR (p_include_deleted AND s.state='deleted'))),'[]'::jsonb));
END; $$;
REVOKE ALL ON FUNCTION public.platform_list_tenant_account_access(uuid,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.platform_list_tenant_account_access(uuid,boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.platform_business_access_state()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_tenant uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'platform_forbidden' USING ERRCODE='42501'; END IF;
  SELECT tenant_id INTO v_tenant FROM public.profiles WHERE id=auth.uid() OR auth_user_id=auth.uid() ORDER BY (id=auth.uid()) DESC LIMIT 1;
  IF v_tenant IS NULL THEN RETURN jsonb_build_object('allowed',true); END IF;
  RETURN jsonb_build_object('allowed',public.platform_tenant_access_allowed(v_tenant,false),
    'message','Der Zugang zu diesem Unternehmen ist gesperrt, deaktiviert oder gelöscht. Bitte wenden Sie sich an die Verwaltung.');
END; $$;
REVOKE ALL ON FUNCTION public.platform_business_access_state() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.platform_business_access_state() TO authenticated;

-- Preserve the current portal resolution bodies; append the live access decision.
DO $wrap$
DECLARE v_name text; v_source text; v_oid regprocedure;
BEGIN
  FOREACH v_name IN ARRAY ARRAY['current_tenant_id','caresuite_current_tenant_id'] LOOP
    v_oid:=to_regprocedure('public.'||v_name||'()');
    IF v_oid IS NULL THEN CONTINUE; END IF;
    SELECT regexp_replace(prosrc,';[[:space:]]*$','') INTO v_source FROM pg_proc WHERE oid=v_oid;
    IF position('platform_tenant_access_allowed' IN v_source)>0 THEN CONTINUE; END IF;
    EXECUTE format('CREATE OR REPLACE FUNCTION public.%I() RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS %L',v_name,
      'SELECT CASE WHEN public.platform_tenant_access_allowed(v.tenant_id,false) THEN v.tenant_id ELSE NULL END FROM ('||v_source||') v(tenant_id)');
  END LOOP;
  FOREACH v_name IN ARRAY ARRAY['is_tenant_member','is_internal_tenant_actor','support_is_tenant_member'] LOOP
    v_oid:=to_regprocedure('public.'||v_name||'(uuid)');
    IF v_oid IS NULL THEN CONTINUE; END IF;
    SELECT regexp_replace(prosrc,';[[:space:]]*$','') INTO v_source FROM pg_proc WHERE oid=v_oid;
    IF position('platform_tenant_access_allowed' IN v_source)>0 THEN CONTINUE; END IF;
    EXECUTE format('CREATE OR REPLACE FUNCTION public.%I(p_tenant_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS %L',v_name,
      'SELECT coalesce(v.allowed,false) AND public.platform_tenant_access_allowed(p_tenant_id,false) FROM ('||v_source||') v(allowed)');
  END LOOP;
END; $wrap$;

-- Existing portal/tenant helpers above remain the access boundary. No blanket table policies are added.

-- Keep default company lists clear of removed records. Explicit deleted filters still work.
DO $lists$
DECLARE v_oid regprocedure; v_definition text; v_source text;
BEGIN
  FOREACH v_oid IN ARRAY ARRAY['public.platform_list_companies(text,text,text,text,integer,integer,text)'::regprocedure,
    'public.platform_list_tenants(text,text,text,text,integer,integer)'::regprocedure] LOOP
    SELECT pg_get_functiondef(oid),prosrc INTO v_definition,v_source FROM pg_proc WHERE oid=v_oid;
    IF position('pt.status <> ''deleted_soft''' IN v_source)=0 THEN
      IF position('(p_status IS NULL OR pt.status = p_status)' IN v_source)=0 THEN RAISE EXCEPTION 'company_list_definition_changed'; END IF;
      v_definition:=replace(v_definition,'(p_status IS NULL OR pt.status = p_status)',
        '((p_status IS NULL AND pt.status <> ''deleted_soft'') OR pt.status = p_status)');
      EXECUTE v_definition;
    END IF;
  END LOOP;
END; $lists$;

-- The existing account-mail function must also stop for an inactive company.
DO $mail$
DECLARE v_definition text;
BEGIN
  SELECT pg_get_functiondef('public.platform_prepare_account_operation(uuid,uuid,uuid,text,text,text,boolean)'::regprocedure) INTO v_definition;
  IF position('tenant_access_company_active' IN v_definition)=0 THEN
    IF position('PERFORM public.platform_assert_capability(''tenants.write'');' IN v_definition)=0 THEN RAISE EXCEPTION 'account_prepare_definition_changed'; END IF;
    v_definition:=replace(v_definition,'PERFORM public.platform_assert_capability(''tenants.write'');',
      'PERFORM public.platform_assert_capability(''tenants.write'');
       -- tenant_access_company_active
       PERFORM 1 FROM public.platform_tenants WHERE tenant_id=p_tenant_id AND status=''active'' FOR SHARE;
       IF NOT FOUND THEN RAISE EXCEPTION ''access_action_invalid'' USING ERRCODE=''22023''; END IF;');
    EXECUTE v_definition;
  END IF;
  SELECT pg_get_functiondef('public.validate_portal_session(text)'::regprocedure) INTO v_definition;
  IF position('platform_tenant_access_allowed' IN v_definition)=0 THEN
    IF position('and ps.status = ''active''' IN v_definition)=0 THEN RAISE EXCEPTION 'portal_session_definition_changed'; END IF;
    EXECUTE replace(v_definition,'and ps.status = ''active''','and ps.status = ''active'' and public.platform_tenant_access_allowed(ps.tenant_id,false)');
  END IF;
END; $mail$;

-- Legacy clients retain suspend/unsuspend; deletion cannot bypass the new confirmation/version checks.
CREATE OR REPLACE FUNCTION public.platform_update_tenant_status(p_tenant_id uuid,p_status text,p_reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_before public.platform_tenants%ROWTYPE; v_result jsonb; v_action text;
BEGIN
  PERFORM public.platform_assert_capability('tenants.suspend');
  SELECT * INTO v_before FROM public.platform_tenants WHERE tenant_id=p_tenant_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'tenant_not_found' USING ERRCODE='P0002'; END IF;
  IF p_status='active' AND v_before.status IN ('suspended','locked') THEN v_action:='unsuspend';
  ELSIF p_status='suspended' AND v_before.status='active' THEN v_action:='suspend';
  ELSE RAISE EXCEPTION 'access_action_invalid' USING ERRCODE='22023'; END IF;
  v_result:=public.platform_manage_tenant_access(p_tenant_id,v_action,v_before.status,v_before.updated_at,'SPERREN',p_reason);
  RETURN (SELECT to_jsonb(pt) FROM public.platform_tenants pt WHERE tenant_id=p_tenant_id);
END; $$;
REVOKE ALL ON FUNCTION public.platform_update_tenant_status(uuid,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.platform_update_tenant_status(uuid,text,text) TO authenticated;
CREATE OR REPLACE FUNCTION public.platform_access_release_status()
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path=public,pg_temp AS $$
  SELECT jsonb_build_object('release','caresuite-platform-access-controls-20261007');
$$;
REVOKE ALL ON FUNCTION public.platform_access_release_status() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.platform_access_release_status() TO anon,authenticated,service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
