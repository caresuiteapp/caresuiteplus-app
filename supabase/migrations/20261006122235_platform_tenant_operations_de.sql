BEGIN;

ALTER TABLE public.registration_welcome_outbox
  ADD COLUMN IF NOT EXISTS delivery_revision integer NOT NULL DEFAULT 1 CHECK (delivery_revision > 0);

CREATE TABLE public.platform_account_operations (
  id uuid PRIMARY KEY,
  actor_user_id uuid NOT NULL REFERENCES auth.users(id),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  tenant_user_id uuid NOT NULL REFERENCES public.tenant_users(id),
  auth_user_id uuid NOT NULL REFERENCES auth.users(id),
  action text NOT NULL CHECK (action IN ('email_change','password_recovery','welcome_resend')),
  old_email text NOT NULL,
  new_email text,
  reason text NOT NULL CHECK (length(trim(reason)) BETWEEN 5 AND 1000),
  state text NOT NULL DEFAULT 'prepared' CHECK (state IN ('prepared','processing','completed','failed','needs_review')),
  result jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.platform_account_operations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.platform_account_operations FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON public.platform_account_operations TO service_role;
CREATE INDEX platform_account_operations_tenant ON public.platform_account_operations(tenant_id,created_at DESC);

CREATE OR REPLACE FUNCTION public.platform_list_tenant_accounts(p_tenant_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
  PERFORM public.platform_assert_capability('tenants.read');
  RETURN jsonb_build_object('items',coalesce((SELECT jsonb_agg(jsonb_build_object(
    'id',u.id,'display_name',u.display_name,'username',u.username,'email',u.email,
    'role_key',u.role_key,'status',u.status,'last_login_at',u.last_login_at,
    'has_login',u.auth_user_id IS NOT NULL,
    'open_operation',(SELECT jsonb_build_object('state',o.state,'action',o.action,'created_at',o.created_at)
      FROM public.platform_account_operations o WHERE o.auth_user_id=u.auth_user_id AND o.state IN ('prepared','processing','needs_review') ORDER BY o.created_at DESC LIMIT 1),
    'welcome',CASE WHEN q.id IS NOT NULL THEN jsonb_build_object(
      'state',q.state,'recipient_email',q.recipient_email,'attempts',q.attempts,
      'sent_at',q.sent_at,'updated_at',q.updated_at,'last_error_code',q.last_error_code,
      'delivery_revision',q.delivery_revision) ELSE NULL END
  ) ORDER BY u.display_name,u.id) FROM public.tenant_users u
    LEFT JOIN public.registration_welcome_outbox q ON q.tenant_user_id=u.id
    WHERE u.tenant_id=p_tenant_id AND u.employee_id IS NULL AND u.role_key NOT IN ('employee','client')
      AND u.archived_at IS NULL),'[]'::jsonb));
END; $$;
REVOKE ALL ON FUNCTION public.platform_list_tenant_accounts(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.platform_list_tenant_accounts(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.platform_prepare_account_operation(
  p_nonce uuid,p_tenant_id uuid,p_tenant_user_id uuid,p_action text,p_new_email text,p_reason text,p_authorization_confirmed boolean
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_user public.tenant_users%ROWTYPE; v_op public.platform_account_operations%ROWTYPE; v_email text:=lower(trim(p_new_email)); v_auth_email text;
BEGIN
  PERFORM public.platform_assert_capability('tenants.write');
  PERFORM public.platform_assert_reason(p_reason);
  IF p_authorization_confirmed IS DISTINCT FROM true THEN RAISE EXCEPTION 'account_authorization_required' USING ERRCODE='22023'; END IF;
  IF p_nonce IS NULL OR p_tenant_user_id IS NULL OR p_action IS NULL OR p_action NOT IN ('email_change','password_recovery','welcome_resend')
    OR length(trim(p_reason))>1000 THEN RAISE EXCEPTION 'account_request_invalid' USING ERRCODE='22023'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_nonce::text,61006));
  SELECT * INTO v_op FROM public.platform_account_operations WHERE id=p_nonce FOR UPDATE;
  IF FOUND THEN
    IF v_op.actor_user_id<>auth.uid() OR v_op.tenant_id<>p_tenant_id OR v_op.tenant_user_id<>p_tenant_user_id
      OR v_op.action<>p_action OR v_op.new_email IS DISTINCT FROM nullif(v_email,'') OR v_op.reason<>trim(p_reason)
    THEN RAISE EXCEPTION 'request_payload_changed' USING ERRCODE='22023'; END IF;
    RETURN jsonb_build_object('id',v_op.id,'state',v_op.state,'result',v_op.result);
  END IF;
  SELECT * INTO v_user FROM public.tenant_users WHERE id=p_tenant_user_id AND tenant_id=p_tenant_id FOR UPDATE;
  IF NOT FOUND OR v_user.auth_user_id IS NULL OR v_user.status<>'active' OR v_user.archived_at IS NOT NULL
    OR v_user.employee_id IS NOT NULL OR v_user.role_key IN ('employee','client')
  THEN RAISE EXCEPTION 'account_not_active' USING ERRCODE='22023'; END IF;
  SELECT lower(email) INTO v_auth_email FROM auth.users WHERE id=v_user.auth_user_id AND deleted_at IS NULL;
  IF v_auth_email IS NULL OR v_auth_email IS DISTINCT FROM lower(v_user.email)
    THEN RAISE EXCEPTION 'account_identity_mismatch' USING ERRCODE='22023'; END IF;
  IF p_action='email_change' THEN
    IF v_email IS NULL OR length(v_email)>254 OR v_email !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' OR v_email=v_auth_email
      THEN RAISE EXCEPTION 'account_email_invalid' USING ERRCODE='22023'; END IF;
    IF EXISTS(SELECT 1 FROM public.tenant_users WHERE auth_user_id=v_user.auth_user_id AND tenant_id<>p_tenant_id)
      OR EXISTS(SELECT 1 FROM public.profiles WHERE auth_user_id=v_user.auth_user_id AND tenant_id IS DISTINCT FROM p_tenant_id)
      OR EXISTS(SELECT 1 FROM public.platform_users WHERE user_id=v_user.auth_user_id)
    THEN RAISE EXCEPTION 'account_shared_identity' USING ERRCODE='22023'; END IF;
    IF EXISTS(SELECT 1 FROM auth.users WHERE lower(email)=v_email AND id<>v_user.auth_user_id AND deleted_at IS NULL)
      THEN RAISE EXCEPTION 'account_email_in_use' USING ERRCODE='23505'; END IF;
  ELSIF nullif(v_email,'') IS NOT NULL THEN RAISE EXCEPTION 'account_request_invalid' USING ERRCODE='22023'; END IF;
  IF p_action='welcome_resend' AND v_user.role_key<>'owner' THEN RAISE EXCEPTION 'welcome_owner_required' USING ERRCODE='22023'; END IF;
  IF EXISTS(SELECT 1 FROM public.platform_account_operations WHERE auth_user_id=v_user.auth_user_id AND state IN ('prepared','processing','needs_review'))
    THEN RAISE EXCEPTION 'account_update_needs_review' USING ERRCODE='55000'; END IF;
  PERFORM 1 FROM public.registration_welcome_outbox WHERE tenant_user_id=v_user.id FOR UPDATE;
  IF EXISTS(SELECT 1 FROM public.registration_welcome_outbox WHERE tenant_user_id=v_user.id AND state='sending' AND lease_until>now())
    THEN RAISE EXCEPTION 'account_mail_in_progress' USING ERRCODE='55000'; END IF;
  IF p_action IN ('email_change','welcome_resend') THEN
    UPDATE public.registration_welcome_outbox SET state='cancelled',lease_token=NULL,lease_until=NULL,updated_at=now()
      WHERE tenant_user_id=v_user.id AND state<>'sent';
  END IF;
  INSERT INTO public.platform_account_operations(id,actor_user_id,tenant_id,tenant_user_id,auth_user_id,action,old_email,new_email,reason)
    VALUES(p_nonce,auth.uid(),p_tenant_id,v_user.id,v_user.auth_user_id,p_action,v_auth_email,nullif(v_email,''),trim(p_reason)) RETURNING * INTO v_op;
  PERFORM public.platform_write_audit_log('tenant.account.requested','tenant_user',v_user.id,p_tenant_id,
    NULL,jsonb_build_object('operation',p_nonce,'action',p_action),trim(p_reason));
  RETURN jsonb_build_object('id',v_op.id,'state',v_op.state);
END; $$;
REVOKE ALL ON FUNCTION public.platform_prepare_account_operation(uuid,uuid,uuid,text,text,text,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.platform_prepare_account_operation(uuid,uuid,uuid,text,text,text,boolean) TO authenticated;

-- Service-only claim is atomic. A duplicate HTTP request cannot change Auth twice.
CREATE OR REPLACE FUNCTION public.platform_claim_account_operation(p_operation_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
DECLARE v_op public.platform_account_operations%ROWTYPE;
BEGIN
  UPDATE public.platform_account_operations SET state='processing',updated_at=now()
    WHERE id=p_operation_id AND state='prepared' RETURNING * INTO v_op;
  IF NOT FOUND THEN RETURN NULL; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.platform_users WHERE user_id=v_op.actor_user_id AND status='active' AND role IN ('platform_owner','platform_admin'))
    THEN RAISE EXCEPTION 'platform_forbidden' USING ERRCODE='42501'; END IF;
  RETURN to_jsonb(v_op);
END; $$;
REVOKE ALL ON FUNCTION public.platform_claim_account_operation(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.platform_claim_account_operation(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.platform_finish_account_operation(p_operation_id uuid,p_success boolean,p_needs_review boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
DECLARE v_op public.platform_account_operations%ROWTYPE; v_user public.tenant_users%ROWTYPE; v_result jsonb; v_action text;
BEGIN
  SELECT * INTO v_op FROM public.platform_account_operations WHERE id=p_operation_id FOR UPDATE;
  IF NOT FOUND OR v_op.state<>'processing' THEN RAISE EXCEPTION 'account_operation_inactive' USING ERRCODE='55000'; END IF;
  IF NOT p_success THEN
    UPDATE public.platform_account_operations SET state=CASE WHEN p_needs_review THEN 'needs_review' ELSE 'failed' END,updated_at=now() WHERE id=v_op.id;
    INSERT INTO public.platform_audit_log(actor_user_id,actor_role,action,target_type,target_id,tenant_id,reason)
      VALUES(v_op.actor_user_id,(SELECT role FROM public.platform_users WHERE user_id=v_op.actor_user_id),
        'tenant.account.failed','tenant_user',v_op.tenant_user_id,v_op.tenant_id,v_op.reason);
    RETURN jsonb_build_object('ok',false,'needsReview',p_needs_review);
  END IF;
  SELECT * INTO v_user FROM public.tenant_users WHERE id=v_op.tenant_user_id AND tenant_id=v_op.tenant_id FOR UPDATE;
  IF NOT FOUND OR v_user.auth_user_id<>v_op.auth_user_id OR v_user.status<>'active' OR v_user.archived_at IS NOT NULL
    THEN RAISE EXCEPTION 'account_identity_mismatch' USING ERRCODE='22023'; END IF;
  IF v_op.action='email_change' THEN
    IF NOT EXISTS(SELECT 1 FROM auth.users WHERE id=v_op.auth_user_id AND lower(email)=v_op.new_email AND deleted_at IS NULL)
      THEN RAISE EXCEPTION 'account_identity_mismatch' USING ERRCODE='22023'; END IF;
    UPDATE public.tenant_users SET email=v_op.new_email,updated_at=now() WHERE id=v_user.id;
    UPDATE public.profiles SET email=v_op.new_email,updated_at=now() WHERE auth_user_id=v_op.auth_user_id AND tenant_id=v_op.tenant_id;
    UPDATE public.platform_tenants SET primary_contact_email=v_op.new_email,updated_at=now()
      WHERE tenant_id=v_op.tenant_id AND lower(primary_contact_email)=v_op.old_email;
    UPDATE public.registration_welcome_outbox SET state='cancelled',lease_token=NULL,lease_until=NULL,
      last_error_code='registration_account_changed',updated_at=now() WHERE tenant_user_id=v_user.id AND state<>'sent';
    v_action:='tenant.account.email_changed';
    v_result:=jsonb_build_object('ok',true,'message','Die Anmelde-E-Mail wurde korrigiert. Die neue Adresse wird durch den Rücksetz-Link bestätigt.');
  ELSIF v_op.action='welcome_resend' THEN
    IF NOT EXISTS(SELECT 1 FROM auth.users WHERE id=v_op.auth_user_id AND lower(email)=lower(v_user.email) AND deleted_at IS NULL)
      THEN RAISE EXCEPTION 'account_identity_mismatch' USING ERRCODE='22023'; END IF;
    INSERT INTO public.registration_welcome_outbox(tenant_id,tenant_user_id,auth_user_id,recipient_email)
      VALUES(v_op.tenant_id,v_user.id,v_user.auth_user_id,lower(v_user.email))
    ON CONFLICT(tenant_user_id,template_version) DO UPDATE SET
      recipient_email=EXCLUDED.recipient_email,state='pending',delivery_revision=registration_welcome_outbox.delivery_revision+1,
      provider=NULL,attempts=0,first_attempt_at=NULL,next_attempt_at=now(),lease_token=NULL,lease_until=NULL,
      provider_message_id=NULL,last_error_code=NULL,sent_at=NULL,updated_at=now();
    v_action:='tenant.account.welcome_resent';
    v_result:=jsonb_build_object('ok',true,'message','Die Willkommensmail wurde erneut zum Versand vorgemerkt.');
  ELSE
    v_action:='tenant.account.password_recovery';
    v_result:=jsonb_build_object('ok',true,'message','Der Versanddienst hat die Passwortwiederherstellung angenommen. Bitte auch den Spam-Ordner prüfen.');
  END IF;
  UPDATE public.platform_account_operations SET state='completed',result=v_result,updated_at=now() WHERE id=v_op.id;
  INSERT INTO public.platform_audit_log(actor_user_id,actor_role,action,target_type,target_id,tenant_id,"before","after",reason)
    VALUES(v_op.actor_user_id,(SELECT role FROM public.platform_users WHERE user_id=v_op.actor_user_id),v_action,
      'tenant_user',v_user.id,v_op.tenant_id,jsonb_build_object('email',v_op.old_email),
      jsonb_build_object('email',coalesce(v_op.new_email,v_user.email),'operation',v_op.id),v_op.reason);
  RETURN v_result;
END; $$;
REVOKE ALL ON FUNCTION public.platform_finish_account_operation(uuid,boolean,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.platform_finish_account_operation(uuid,boolean,boolean) TO service_role;

CREATE OR REPLACE FUNCTION public.platform_assign_tenant_tariff(p_tenant_id uuid,p_plan_key text,p_reason text,p_billing_interval text DEFAULT 'monthly',p_custom_monthly_cents integer DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_result jsonb;
BEGIN
  PERFORM public.platform_assert_capability('plans.write'); PERFORM public.platform_assert_reason(p_reason);
  IF p_billing_interval IS NULL OR p_billing_interval NOT IN ('monthly','yearly') OR p_custom_monthly_cents<0
    THEN RAISE EXCEPTION 'invalid_contract_values' USING ERRCODE='22023'; END IF;
  PERFORM 1 FROM public.platform_tenants WHERE tenant_id=p_tenant_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'tenant_not_found' USING ERRCODE='P0002'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.platform_plans WHERE plan_key=p_plan_key AND status='active')
    THEN RAISE EXCEPTION 'plan_not_found' USING ERRCODE='P0002'; END IF;
  UPDATE public.platform_tenant_plans SET status='cancelled',ends_at=now(),updated_at=now() WHERE tenant_id=p_tenant_id AND status='paused';
  v_result:=public.platform_assign_plan(p_tenant_id,p_plan_key,p_reason,p_billing_interval,p_custom_monthly_cents);
  UPDATE public.platform_tenant_plans SET currency=(SELECT currency FROM public.platform_plans WHERE plan_key=p_plan_key) WHERE id=(v_result->>'id')::uuid RETURNING to_jsonb(platform_tenant_plans.*) INTO v_result;
  RETURN v_result;
END; $$;
REVOKE ALL ON FUNCTION public.platform_assign_tenant_tariff(uuid,text,text,text,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.platform_assign_tenant_tariff(uuid,text,text,text,integer) TO authenticated;

-- Use the tariff tables that are actually deployed; keep the tenant's account status separate.
CREATE OR REPLACE FUNCTION public.platform_update_tenant_contract(p_tenant_id uuid,p_status text,p_reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_before jsonb; v_after jsonb;
BEGIN
  PERFORM public.platform_assert_capability('plans.write'); PERFORM public.platform_assert_reason(p_reason);
  IF p_status IS NULL OR p_status NOT IN ('active','paused','cancelled') THEN RAISE EXCEPTION 'invalid_contract_status' USING ERRCODE='22023'; END IF;
  PERFORM 1 FROM public.platform_tenants WHERE tenant_id=p_tenant_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'tenant_not_found' USING ERRCODE='P0002'; END IF;
  SELECT to_jsonb(tp) INTO v_before FROM public.platform_tenant_plans tp WHERE tenant_id=p_tenant_id AND status IN ('active','paused') ORDER BY created_at DESC,id DESC LIMIT 1 FOR UPDATE;
  IF v_before IS NULL THEN RAISE EXCEPTION 'contract_not_found' USING ERRCODE='P0002'; END IF;
  UPDATE public.platform_tenant_plans SET status=p_status,ends_at=CASE WHEN p_status='cancelled' THEN now() ELSE NULL END,updated_at=now()
    WHERE id=(v_before->>'id')::uuid RETURNING to_jsonb(platform_tenant_plans.*) INTO v_after;
  PERFORM public.platform_write_audit_log('subscription.'||CASE p_status WHEN 'active' THEN 'reactivated' WHEN 'paused' THEN 'suspended' ELSE 'cancelled' END,
    'platform_tenant_plan',(v_after->>'id')::uuid,p_tenant_id,v_before,v_after,p_reason);
  RETURN v_after;
END; $$;
REVOKE ALL ON FUNCTION public.platform_update_tenant_contract(uuid,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.platform_update_tenant_contract(uuid,text,text) TO authenticated;

-- Named-company filtering runs on the server before pagination.
CREATE OR REPLACE FUNCTION public.platform_tenant_ticket_queue(p_tenant_id uuid,p_search text DEFAULT '',p_status text DEFAULT '',p_offset integer DEFAULT 0)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_rows jsonb;
BEGIN
  PERFORM public.platform_assert_capability('support.read');
  SELECT coalesce(jsonb_agg(to_jsonb(q)),'[]'::jsonb) INTO v_rows FROM (
    SELECT t.id,t.number,t.subject,t.tenant_id,n.name tenant_name,t.status,t.category,t.priority,pu.full_name assigned_name,t.updated_at,
      (SELECT m.body FROM public.support_messages m WHERE m.ticket_id=t.id ORDER BY m.created_at DESC,m.id DESC LIMIT 1) last_message
    FROM public.support_workspace_tickets t JOIN public.tenants n ON n.id=t.tenant_id LEFT JOIN public.platform_users pu ON pu.id=t.assigned_to
    WHERE t.tenant_id=p_tenant_id AND public.support_can_read_ticket(t.id)
      AND (coalesce(p_status,'')='' OR t.status=p_status)
      AND (coalesce(p_search,'')='' OR t.subject ILIKE '%'||left(p_search,200)||'%')
    ORDER BY t.updated_at DESC,t.id DESC LIMIT 51 OFFSET greatest(0,least(coalesce(p_offset,0),100000))
  ) q;
  RETURN jsonb_build_object('tickets',v_rows,'can_create',false,'can_manage',false,'can_support_write',public.platform_has_capability('support.write'));
END; $$;
REVOKE ALL ON FUNCTION public.platform_tenant_ticket_queue(uuid,text,text,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.platform_tenant_ticket_queue(uuid,text,text,integer) TO authenticated;

ALTER TABLE public.support_access_requests DROP CONSTRAINT support_access_requests_scopes_check;
ALTER TABLE public.support_access_requests ADD CONSTRAINT support_access_requests_scopes_check CHECK(
  cardinality(scopes) BETWEEN 1 AND 9 AND scopes <@ ARRAY['company.read','company.write','assignments.read','assignments.notes.write','clients.read','employees.read','clients.details.read','employees.details.read','errors.read']
);

CREATE OR REPLACE FUNCTION public.support_workspace_details(p_request_id uuid,p_scope text,p_record_id uuid DEFAULT NULL,p_offset integer DEFAULT 0)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_request public.support_access_requests%ROWTYPE; v_rows jsonb;
BEGIN
  v_request:=public.support_assert_access(p_request_id,p_scope);
  IF p_scope='clients.details.read' THEN
    SELECT coalesce(jsonb_agg(jsonb_build_object('id',c.id,'client_number',c.client_number,'first_name',c.first_name,'last_name',c.last_name,
      'status',c.status,'email',to_jsonb(c)->>'email','phone',to_jsonb(c)->>'phone','street',to_jsonb(c)->>'street',
      'postal_code',coalesce(to_jsonb(c)->>'postal_code',to_jsonb(c)->>'zip'),'city',to_jsonb(c)->>'city','updated_at',c.updated_at)),'[]')
    INTO v_rows FROM public.clients c WHERE c.tenant_id=v_request.tenant_id AND c.id=p_record_id AND c.deleted_at IS NULL;
  ELSIF p_scope='employees.details.read' THEN
    SELECT coalesce(jsonb_agg(jsonb_build_object('id',e.id,'employee_number',e.employee_number,'first_name',e.first_name,'last_name',e.last_name,
      'status',e.status,'portal_enabled',e.portal_enabled,'email',to_jsonb(e)->>'email','phone',to_jsonb(e)->>'phone',
      'street',to_jsonb(e)->>'street','postal_code',coalesce(to_jsonb(e)->>'postal_code',to_jsonb(e)->>'zip'),
      'city',to_jsonb(e)->>'city','updated_at',e.updated_at)),'[]')
    INTO v_rows FROM public.employees e WHERE e.tenant_id=v_request.tenant_id AND e.id=p_record_id AND e.deleted_at IS NULL;
  ELSIF p_scope='errors.read' THEN
    SELECT coalesce(jsonb_agg(to_jsonb(q)),'[]') INTO v_rows FROM (
      SELECT id,level,error_code,product_key,page_name,action_name,app_version,is_resolved,created_at
      FROM public.error_logs WHERE tenant_id=v_request.tenant_id ORDER BY created_at DESC,id DESC
      LIMIT 51 OFFSET greatest(0,least(coalesce(p_offset,0),100000))
    ) q;
  ELSE RAISE EXCEPTION 'support_scope_invalid' USING ERRCODE='22023'; END IF;
  INSERT INTO public.support_audit_events(ticket_id,actor_id,event,details) VALUES(v_request.ticket_id,auth.uid(),'workspace.read',
    jsonb_build_object('request',p_request_id,'scope',p_scope,'record',p_record_id));
  RETURN jsonb_build_object('rows',v_rows,'expires_at',v_request.expires_at,'scope',p_scope);
END; $$;
REVOKE ALL ON FUNCTION public.support_workspace_details(uuid,text,uuid,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.support_workspace_details(uuid,text,uuid,integer) TO authenticated;

-- Bind a recovery link to the mailbox that received it. An old link cannot
-- reset an account after its email address has been corrected.
CREATE TABLE public.business_recovery_deliveries (
  token_digest text PRIMARY KEY CHECK (token_digest ~ '^[a-f0-9]{64}$'),
  auth_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recipient_email text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT now()+interval '1 hour',
  consumed_at timestamptz
);
ALTER TABLE public.business_recovery_deliveries ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.business_recovery_deliveries FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.business_recovery_deliveries TO service_role;
CREATE OR REPLACE FUNCTION public.business_register_recovery_delivery(p_token_digest text,p_auth_user_id uuid,p_email text)
RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
BEGIN
  DELETE FROM public.business_recovery_deliveries WHERE expires_at<now()-interval '1 day';
  INSERT INTO public.business_recovery_deliveries(token_digest,auth_user_id,recipient_email)
    VALUES(p_token_digest,p_auth_user_id,lower(trim(p_email)));
  RETURN true;
END; $$;
REVOKE ALL ON FUNCTION public.business_register_recovery_delivery(text,uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.business_register_recovery_delivery(text,uuid,text) TO service_role;
CREATE OR REPLACE FUNCTION public.business_consume_recovery_delivery(p_token_digest text,p_auth_user_id uuid,p_email text)
RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
DECLARE v_count integer;
BEGIN
  UPDATE public.business_recovery_deliveries SET consumed_at=now()
    WHERE token_digest=p_token_digest AND auth_user_id=p_auth_user_id AND recipient_email=lower(trim(p_email))
      AND consumed_at IS NULL AND expires_at>now();
  GET DIAGNOSTICS v_count=ROW_COUNT; RETURN v_count=1;
END; $$;
REVOKE ALL ON FUNCTION public.business_consume_recovery_delivery(text,uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.business_consume_recovery_delivery(text,uuid,text) TO service_role;

CREATE TABLE IF NOT EXISTS public.platform_tenant_credits(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL UNIQUE REFERENCES public.tenants(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  balance_cents integer NOT NULL DEFAULT 0 CHECK(balance_cents>=0),
  currency text NOT NULL DEFAULT 'EUR',
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.platform_credit_ledger(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  entry_type text NOT NULL CHECK(entry_type IN ('credit','debit','adjustment')),
  amount_cents integer NOT NULL,
  balance_after integer NOT NULL CHECK(balance_after>=0),
  reason text NOT NULL,
  actor_user_id uuid NOT NULL,
  currency text NOT NULL DEFAULT 'EUR',
  reference_type text,
  reference_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.platform_tenant_credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_credit_ledger ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.platform_tenant_credits,public.platform_credit_ledger FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.platform_tenant_credits,public.platform_credit_ledger TO authenticated;
GRANT ALL ON public.platform_tenant_credits,public.platform_credit_ledger TO service_role;
CREATE POLICY platform_credits_read ON public.platform_tenant_credits FOR SELECT TO authenticated USING(public.platform_has_capability('billing.read'));
CREATE POLICY platform_credit_entries_read ON public.platform_credit_ledger FOR SELECT TO authenticated USING(public.platform_has_capability('billing.read'));

CREATE OR REPLACE FUNCTION public.platform_record_tenant_credit(p_nonce uuid,p_tenant_id uuid,p_amount_cents integer,p_reason text,p_entry_type text DEFAULT 'credit')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_entry public.platform_credit_ledger%ROWTYPE; v_balance integer; v_delta integer;
BEGIN
  PERFORM public.platform_assert_capability('billing.write'); PERFORM public.platform_assert_reason(p_reason);
  IF p_nonce IS NULL OR p_amount_cents IS NULL OR p_amount_cents<=0 OR p_entry_type IS NULL OR p_entry_type NOT IN ('credit','debit')
    THEN RAISE EXCEPTION 'invalid_credit_values' USING ERRCODE='22023'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_nonce::text,61007));
  SELECT * INTO v_entry FROM public.platform_credit_ledger WHERE id=p_nonce;
  IF FOUND THEN
    IF v_entry.tenant_id<>p_tenant_id OR v_entry.entry_type<>p_entry_type OR v_entry.amount_cents<>p_amount_cents
      OR v_entry.actor_user_id<>auth.uid() OR v_entry.reason<>trim(p_reason)
    THEN RAISE EXCEPTION 'request_payload_changed' USING ERRCODE='22023'; END IF;
    RETURN to_jsonb(v_entry);
  END IF;
  INSERT INTO public.platform_tenant_credits(tenant_id) VALUES(p_tenant_id) ON CONFLICT DO NOTHING;
  SELECT balance_cents INTO v_balance FROM public.platform_tenant_credits WHERE tenant_id=p_tenant_id FOR UPDATE;
  v_delta:=CASE WHEN p_entry_type='credit' THEN p_amount_cents ELSE -p_amount_cents END;
  IF v_balance::bigint+v_delta<0 OR v_balance::bigint+v_delta>2147483647 THEN RAISE EXCEPTION 'invalid_credit_balance' USING ERRCODE='22023'; END IF;
  UPDATE public.platform_tenant_credits SET balance_cents=v_balance+v_delta,updated_at=now() WHERE tenant_id=p_tenant_id;
  INSERT INTO public.platform_credit_ledger(id,tenant_id,entry_type,amount_cents,balance_after,reason,actor_user_id)
    VALUES(p_nonce,p_tenant_id,p_entry_type,p_amount_cents,v_balance+v_delta,trim(p_reason),auth.uid()) RETURNING * INTO v_entry;
  PERFORM public.platform_write_audit_log('credit.booked','platform_credit_ledger',v_entry.id,p_tenant_id,
    jsonb_build_object('balance_cents',v_balance),jsonb_build_object('balance_cents',v_entry.balance_after),trim(p_reason));
  RETURN to_jsonb(v_entry);
END; $$;
REVOKE ALL ON FUNCTION public.platform_record_tenant_credit(uuid,uuid,integer,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.platform_record_tenant_credit(uuid,uuid,integer,text,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.platform_tenant_cost_overview(p_tenant_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_lines jsonb; v_plan jsonb; v_credit integer;
BEGIN
  PERFORM public.platform_assert_capability('billing.read');
  SELECT jsonb_build_object('key',tp.plan_key,'name',coalesce(p.plan_name,tp.plan_key),'status',tp.status,'interval',tp.billing_interval,
    'amount_cents',CASE WHEN tp.billing_interval='yearly' THEN tp.yearly_price_cents ELSE tp.monthly_price_cents END,'currency',tp.currency)
    INTO v_plan FROM public.platform_tenant_plans tp LEFT JOIN public.platform_plans p ON p.plan_key=tp.plan_key
    WHERE tp.tenant_id=p_tenant_id AND tp.status IN ('active','paused') ORDER BY tp.created_at DESC,tp.id DESC LIMIT 1;
  IF v_plan IS NULL AND EXISTS(SELECT 1 FROM public.platform_tenants WHERE tenant_id=p_tenant_id AND plan_key='free_platform') THEN
    v_plan:=jsonb_build_object('key','free_platform','name','CareSuite kostenlos','status','active','interval','monthly','amount_cents',0,'currency','EUR');
  END IF;
  SELECT coalesce(jsonb_agg(jsonb_build_object('key',ta.addon_key,'name',a.addon_name,'status',ta.status,'interval',ta.billing_interval,
    'amount_cents',coalesce(ta.price_override_cents,CASE WHEN ta.billing_interval='yearly' THEN av.yearly_price_cents ELSE av.monthly_price_cents END),'currency',av.currency)),'[]')
    INTO v_lines FROM public.platform_tenant_addons ta JOIN public.platform_addons a ON a.addon_key=ta.addon_key
    JOIN public.platform_addon_versions av ON av.id=ta.addon_version_id
    WHERE ta.tenant_id=p_tenant_id AND ta.status='active' AND ta.starts_at<=now() AND (ta.ends_at IS NULL OR ta.ends_at>now());
  SELECT balance_cents INTO v_credit FROM public.platform_tenant_credits WHERE tenant_id=p_tenant_id;
  RETURN jsonb_build_object('tariff',v_plan,'addons',v_lines,'credit_cents',coalesce(v_credit,0),'as_of',now());
END; $$;
REVOKE ALL ON FUNCTION public.platform_tenant_cost_overview(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.platform_tenant_cost_overview(uuid) TO authenticated;

-- Catalog maintenance on the deployed tariff schema; existing prices stay intact.
CREATE OR REPLACE FUNCTION public.platform_create_plan(p_plan_key text,p_plan_name text,p_reason text,p_description text DEFAULT NULL,p_monthly_price_cents integer DEFAULT 0,p_yearly_price_cents integer DEFAULT 0,p_currency text DEFAULT 'EUR',p_is_public boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_plan public.platform_plans%ROWTYPE;
BEGIN
  PERFORM public.platform_assert_capability('plans.write'); PERFORM public.platform_assert_reason(p_reason);
  IF p_plan_key IS NULL OR p_plan_key !~ '^[a-z][a-z0-9_]{2,63}$' OR p_plan_name IS NULL OR length(trim(p_plan_name)) NOT BETWEEN 2 AND 120
    OR p_currency IS DISTINCT FROM 'EUR' OR p_monthly_price_cents IS DISTINCT FROM 0 OR p_yearly_price_cents IS DISTINCT FROM 0
    THEN RAISE EXCEPTION 'invalid_plan_values' USING ERRCODE='22023'; END IF;
  INSERT INTO public.platform_plans(plan_key,plan_name,description,monthly_price_cents,yearly_price_cents,currency,is_public)
    VALUES(p_plan_key,trim(p_plan_name),nullif(trim(p_description),''),0,0,'EUR',coalesce(p_is_public,false)) RETURNING * INTO v_plan;
  PERFORM public.platform_write_audit_log('plan.created','platform_plan',v_plan.id,NULL,NULL,to_jsonb(v_plan),p_reason);
  RETURN to_jsonb(v_plan);
END; $$;
REVOKE ALL ON FUNCTION public.platform_create_plan(text,text,text,text,integer,integer,text,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.platform_create_plan(text,text,text,text,integer,integer,text,boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.platform_update_plan(p_plan_key text,p_reason text,p_plan_name text DEFAULT NULL,p_description text DEFAULT NULL,p_is_public boolean DEFAULT NULL,p_status text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_before public.platform_plans%ROWTYPE; v_after public.platform_plans%ROWTYPE;
BEGIN
  PERFORM public.platform_assert_capability('plans.write'); PERFORM public.platform_assert_reason(p_reason);
  IF (p_plan_name IS NOT NULL AND length(trim(p_plan_name)) NOT BETWEEN 2 AND 120)
    OR (p_status IS NOT NULL AND p_status NOT IN ('active','inactive','archived')) THEN RAISE EXCEPTION 'invalid_plan_values' USING ERRCODE='22023'; END IF;
  SELECT * INTO v_before FROM public.platform_plans WHERE plan_key=p_plan_key FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'plan_not_found' USING ERRCODE='P0002'; END IF;
  UPDATE public.platform_plans SET plan_name=coalesce(trim(p_plan_name),plan_name),description=coalesce(p_description,description),
    is_public=coalesce(p_is_public,is_public),status=coalesce(p_status,status),updated_at=now() WHERE id=v_before.id RETURNING * INTO v_after;
  PERFORM public.platform_write_audit_log('plan.updated','platform_plan',v_after.id,NULL,to_jsonb(v_before),to_jsonb(v_after),p_reason);
  RETURN to_jsonb(v_after);
END; $$;
REVOKE ALL ON FUNCTION public.platform_update_plan(text,text,text,text,boolean,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.platform_update_plan(text,text,text,text,boolean,text) TO authenticated;

COMMIT;
