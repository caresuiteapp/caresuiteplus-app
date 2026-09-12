-- Platform Console: catalogue editing, protected settings, consistent payments.
-- No customer seeds, no price conversion, no deletion of historical records.
BEGIN;

-- One redactor for nested configuration and audit payloads; unavailable as a public RPC.
CREATE OR REPLACE FUNCTION public.platform_redact_console_value(p_value JSONB)
RETURNS JSONB LANGUAGE plpgsql IMMUTABLE SET search_path=public AS $$
DECLARE v_key TEXT;v_item JSONB;v_result JSONB;
BEGIN
  IF jsonb_typeof(p_value)='array' THEN
    RETURN coalesce((SELECT jsonb_agg(public.platform_redact_console_value(item) ORDER BY position)
      FROM jsonb_array_elements(p_value) WITH ORDINALITY AS entries(item,position)),'[]'::jsonb);
  ELSIF jsonb_typeof(p_value)='object' THEN
    v_result='{}'::jsonb;
    FOR v_key,v_item IN SELECT key,value FROM jsonb_each(p_value) LOOP
      IF v_key ~* '(secret|token|password|api[_-]?key|private|credential)'
        OR (v_key='value' AND (p_value->>'is_sensitive'='true' OR coalesce(p_value->>'setting_key','') ~* '(secret|token|password|api[_-]?key|private|credential)')) THEN
        v_result=v_result||jsonb_build_object(v_key,'[geschützt]');
      ELSE
        v_result=v_result||jsonb_build_object(v_key,public.platform_redact_console_value(v_item));
      END IF;
    END LOOP;
    RETURN v_result;
  END IF;
  RETURN p_value;
END $$;
REVOKE ALL ON FUNCTION public.platform_redact_console_value(JSONB) FROM PUBLIC,anon,authenticated;

-- Scope validation and serialization prevent malformed or concurrent flag changes.
CREATE OR REPLACE FUNCTION public.platform_set_feature_flag(
  p_flag_key TEXT,p_enabled BOOLEAN,p_reason TEXT,p_scope TEXT DEFAULT 'global',
  p_tenant_id UUID DEFAULT NULL,p_rollout_percentage INTEGER DEFAULT NULL
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_before public.platform_feature_flags%ROWTYPE;v_after public.platform_feature_flags%ROWTYPE;
BEGIN
  PERFORM public.platform_assert_capability('flags.write');PERFORM public.platform_assert_reason(p_reason);
  IF p_flag_key IS NULL OR p_flag_key !~ '^[a-z0-9_.-]{3,100}$' OR p_enabled IS NULL
    OR p_scope IS NULL OR p_scope NOT IN ('global','tenant')
    OR (p_scope='global' AND p_tenant_id IS NOT NULL) OR (p_scope='tenant' AND p_tenant_id IS NULL)
    OR (p_rollout_percentage IS NOT NULL AND (p_rollout_percentage<0 OR p_rollout_percentage>100)) THEN
    RAISE EXCEPTION 'invalid_flag_scope_or_rollout' USING ERRCODE='22023';
  END IF;
  IF p_scope='tenant' AND NOT EXISTS(SELECT 1 FROM public.platform_tenants WHERE tenant_id=p_tenant_id) THEN
    RAISE EXCEPTION 'tenant_not_found' USING ERRCODE='P0002';END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('platform-flag:'||p_flag_key||':'||coalesce(p_tenant_id::text,'global'),0));
  SELECT * INTO v_before FROM public.platform_feature_flags
    WHERE flag_key=p_flag_key AND tenant_id IS NOT DISTINCT FROM p_tenant_id
      AND (p_tenant_id IS NOT NULL OR scope='global') FOR UPDATE;
  IF FOUND THEN
    IF v_before.scope<>p_scope THEN RAISE EXCEPTION 'invalid_flag_scope_or_rollout' USING ERRCODE='23514';END IF;
    UPDATE public.platform_feature_flags SET enabled=p_enabled,rollout_percentage=p_rollout_percentage,
      updated_by=auth.uid(),updated_at=now() WHERE id=v_before.id RETURNING * INTO v_after;
  ELSE
    INSERT INTO public.platform_feature_flags(flag_key,scope,tenant_id,enabled,rollout_percentage,created_by,updated_by)
      VALUES(p_flag_key,p_scope,p_tenant_id,p_enabled,p_rollout_percentage,auth.uid(),auth.uid()) RETURNING * INTO v_after;
  END IF;
  PERFORM public.platform_write_audit_log('feature_flag.changed','platform_feature_flag',v_after.id,p_tenant_id,
    CASE WHEN v_before.id IS NULL THEN NULL ELSE to_jsonb(v_before) END,to_jsonb(v_after),trim(p_reason));
  RETURN to_jsonb(v_after);
END $$;
REVOKE ALL ON FUNCTION public.platform_set_feature_flag(TEXT,BOOLEAN,TEXT,TEXT,UUID,INTEGER) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.platform_set_feature_flag(TEXT,BOOLEAN,TEXT,TEXT,UUID,INTEGER) TO authenticated;


CREATE OR REPLACE FUNCTION public.platform_save_module_catalog(
  p_key TEXT, p_name TEXT, p_description TEXT, p_category TEXT, p_status TEXT, p_reason TEXT
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_before public.platform_modules%ROWTYPE; v_after public.platform_modules%ROWTYPE;
BEGIN
  PERFORM public.platform_assert_capability('modules.write');
  PERFORM public.platform_assert_reason(p_reason);
  IF p_key IS NULL OR p_key !~ '^[a-z0-9_-]{3,100}$' OR lower(p_key) LIKE '%bodymap%' THEN
    RAISE EXCEPTION 'invalid_module_key' USING ERRCODE='22023';
  END IF;
  IF length(trim(coalesce(p_name,'')))<2 OR p_status IS NULL OR p_status NOT IN ('available','beta','internal','deprecated','disabled') THEN
    RAISE EXCEPTION 'invalid_module_record' USING ERRCODE='22023';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('platform-module:'||p_key,0));
  SELECT * INTO v_before FROM public.platform_modules WHERE module_key=p_key FOR UPDATE;
  IF v_before.is_core AND p_status NOT IN ('available','beta') THEN
    RAISE EXCEPTION 'core_module_protected' USING ERRCODE='23514';
  END IF;
  INSERT INTO public.platform_modules(module_key,module_name,description,category,status,is_beta,is_internal)
    VALUES(p_key,trim(p_name),nullif(trim(p_description),''),nullif(trim(p_category),''),p_status,p_status='beta',p_status='internal')
    ON CONFLICT(module_key) DO UPDATE SET module_name=excluded.module_name,description=excluded.description,
      category=excluded.category,status=excluded.status,is_beta=excluded.is_beta,is_internal=excluded.is_internal,updated_at=now()
    RETURNING * INTO v_after;
  PERFORM public.platform_write_audit_log('module.catalog_saved','platform_module',v_after.id,NULL,
    CASE WHEN v_before.id IS NULL THEN NULL ELSE to_jsonb(v_before) END,to_jsonb(v_after),trim(p_reason));
  RETURN to_jsonb(v_after);
END $$;
REVOKE ALL ON FUNCTION public.platform_save_module_catalog(TEXT,TEXT,TEXT,TEXT,TEXT,TEXT) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.platform_save_module_catalog(TEXT,TEXT,TEXT,TEXT,TEXT,TEXT) TO authenticated;

-- Sensitive values never leave the database through the Console settings read.
CREATE OR REPLACE FUNCTION public.platform_list_console_settings()
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  PERFORM public.platform_assert_capability('system.read');
  RETURN coalesce((SELECT jsonb_agg(jsonb_build_object(
    'id',s.id,'setting_key',s.setting_key,'description',s.description,'updated_at',s.updated_at,
    'is_sensitive',(s.is_sensitive OR s.setting_key ~* '(secret|token|password|api[_-]?key|private|credential)' OR public.platform_redact_console_value(s.value) IS DISTINCT FROM s.value),
    'value',CASE WHEN (s.is_sensitive OR s.setting_key ~* '(secret|token|password|api[_-]?key|private|credential)' OR public.platform_redact_console_value(s.value) IS DISTINCT FROM s.value)
      THEN to_jsonb('[geschützt]'::text) ELSE s.value END
  ) ORDER BY s.setting_key) FROM public.platform_system_settings s),'[]'::jsonb);
END $$;
REVOKE ALL ON FUNCTION public.platform_list_console_settings() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.platform_list_console_settings() TO authenticated;
REVOKE SELECT ON public.platform_system_settings FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.platform_update_system_setting(p_setting_key TEXT,p_value JSONB,p_reason TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_before public.platform_system_settings%ROWTYPE;v_after public.platform_system_settings%ROWTYPE;
BEGIN
  PERFORM public.platform_assert_capability('system.write');PERFORM public.platform_assert_reason(p_reason);
  SELECT * INTO v_before FROM public.platform_system_settings WHERE setting_key=p_setting_key FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'setting_not_found' USING ERRCODE='P0002';END IF;
  IF v_before.is_sensitive OR p_setting_key ~* '(secret|token|password|api[_-]?key|private|credential)'
    OR public.platform_redact_console_value(v_before.value) IS DISTINCT FROM v_before.value THEN
    RAISE EXCEPTION 'protected_setting' USING ERRCODE='42501';
  END IF;
  IF p_value IS NULL OR jsonb_typeof(p_value)<>jsonb_typeof(v_before.value) THEN
    RAISE EXCEPTION 'setting_type_mismatch' USING ERRCODE='22023';
  END IF;
  IF p_setting_key IN ('default_trial_days','support_session_minutes','invoice_due_days')
     AND (jsonb_typeof(p_value)<>'number' OR (p_value#>>'{}')::numeric<0 OR (p_value#>>'{}')::numeric<>trunc((p_value#>>'{}')::numeric)) THEN
    RAISE EXCEPTION 'invalid_setting_value' USING ERRCODE='22023';
  END IF;
  UPDATE public.platform_system_settings SET value=p_value,updated_by=auth.uid(),updated_at=now()
    WHERE id=v_before.id RETURNING * INTO v_after;
  PERFORM public.platform_write_audit_log('system_setting.changed','platform_system_setting',v_after.id,NULL,to_jsonb(v_before),to_jsonb(v_after),trim(p_reason));
  RETURN to_jsonb(v_after);
END $$;

-- Only existing authentication users can be granted a Console role; no emails are sent.
CREATE OR REPLACE FUNCTION public.platform_add_operator_user(p_email TEXT,p_role TEXT,p_reason TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_user UUID;v_row public.platform_users%ROWTYPE;
BEGIN
  PERFORM public.platform_assert_capability('users.write');PERFORM public.platform_assert_reason(p_reason);
  IF p_role IS NULL OR p_role NOT IN ('platform_owner','platform_admin','platform_billing','platform_support','platform_developer','platform_readonly') THEN
    RAISE EXCEPTION 'invalid_platform_role' USING ERRCODE='22023';END IF;
  SELECT id INTO v_user FROM auth.users WHERE lower(email)=lower(trim(p_email)) AND deleted_at IS NULL;
  IF v_user IS NULL THEN RAISE EXCEPTION 'existing_auth_user_required' USING ERRCODE='P0002';END IF;
  IF EXISTS(SELECT 1 FROM public.platform_users WHERE user_id=v_user) THEN
    RAISE EXCEPTION 'platform_user_already_exists' USING ERRCODE='23505';END IF;
  INSERT INTO public.platform_users(user_id,email,role,status,created_by)
    VALUES(v_user,lower(trim(p_email)),p_role,'active',auth.uid()) RETURNING * INTO v_row;
  PERFORM public.platform_write_audit_log('platform_user.created','platform_user',v_row.id,NULL,NULL,
    jsonb_build_object('email',v_row.email,'role',v_row.role,'status',v_row.status),trim(p_reason));
  RETURN jsonb_build_object('id',v_row.id,'email',v_row.email,'role',v_row.role,'status',v_row.status);
END $$;
REVOKE ALL ON FUNCTION public.platform_add_operator_user(TEXT,TEXT,TEXT) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.platform_add_operator_user(TEXT,TEXT,TEXT) TO authenticated;

-- Internal helper: settle invoice status in the same transaction as a payment.
CREATE OR REPLACE FUNCTION public.platform_reconcile_console_invoice(p_invoice_id UUID,p_reason TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_before public.platform_invoices%ROWTYPE;v_after public.platform_invoices%ROWTYPE;v_paid BIGINT;v_status TEXT;
BEGIN
  IF p_invoice_id IS NULL THEN RETURN;END IF;
  SELECT * INTO v_before FROM public.platform_invoices WHERE id=p_invoice_id FOR UPDATE;
  IF NOT FOUND OR v_before.status IN ('cancelled','refunded','draft') THEN RETURN;END IF;
  SELECT coalesce(sum(amount_cents),0) INTO v_paid FROM public.platform_payments
    WHERE invoice_id=p_invoice_id AND tenant_id=v_before.tenant_id AND currency=v_before.currency AND status='succeeded';
  v_status=CASE WHEN v_paid>=v_before.total_cents THEN 'paid' WHEN v_paid>0 THEN 'partially_paid'
    WHEN v_before.due_date<current_date THEN 'past_due' ELSE 'open' END;
  IF v_status=v_before.status THEN RETURN;END IF;
  UPDATE public.platform_invoices SET status=v_status,
    paid_at=CASE WHEN v_status='paid' THEN coalesce(paid_at,now()) ELSE NULL END,updated_at=now()
    WHERE id=p_invoice_id RETURNING * INTO v_after;
  PERFORM public.platform_write_audit_log('invoice.payment_reconciled','platform_invoice',p_invoice_id,v_after.tenant_id,to_jsonb(v_before),to_jsonb(v_after),p_reason);
END $$;
REVOKE ALL ON FUNCTION public.platform_reconcile_console_invoice(UUID,TEXT) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.platform_record_manual_payment(
  p_tenant_id UUID,p_invoice_id UUID,p_amount_cents INTEGER,p_status TEXT,p_reason TEXT,p_payment_method TEXT DEFAULT 'manual'
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_row public.platform_payments%ROWTYPE;v_invoice public.platform_invoices%ROWTYPE;v_currency TEXT='EUR';
BEGIN
  PERFORM public.platform_assert_capability('payments.write');PERFORM public.platform_assert_reason(p_reason);
  IF p_amount_cents IS NULL OR p_amount_cents<=0 OR p_status IS NULL OR p_status NOT IN ('pending','succeeded','failed','cancelled','refunded','chargeback') THEN
    RAISE EXCEPTION 'invalid_payment_values' USING ERRCODE='22023';END IF;
  IF NOT EXISTS(SELECT 1 FROM public.platform_tenants WHERE tenant_id=p_tenant_id) THEN
    RAISE EXCEPTION 'tenant_not_found' USING ERRCODE='P0002';END IF;
  IF p_invoice_id IS NOT NULL THEN
    SELECT * INTO v_invoice FROM public.platform_invoices WHERE id=p_invoice_id FOR UPDATE;
    IF NOT FOUND OR v_invoice.tenant_id<>p_tenant_id THEN RAISE EXCEPTION 'invoice_tenant_mismatch' USING ERRCODE='23514';END IF;
    IF v_invoice.status IN ('cancelled','refunded','draft') THEN RAISE EXCEPTION 'invoice_not_payable' USING ERRCODE='23514';END IF;
    v_currency=v_invoice.currency;
  END IF;
  INSERT INTO public.platform_payments(tenant_id,invoice_id,provider,payment_method,status,amount_cents,currency,paid_at)
    VALUES(p_tenant_id,p_invoice_id,'manual',p_payment_method,p_status,p_amount_cents,v_currency,CASE WHEN p_status='succeeded' THEN now() ELSE NULL END)
    RETURNING * INTO v_row;
  PERFORM public.platform_write_audit_log('payment.recorded','platform_payment',v_row.id,p_tenant_id,NULL,to_jsonb(v_row),trim(p_reason));
  PERFORM public.platform_reconcile_console_invoice(p_invoice_id,trim(p_reason));
  RETURN to_jsonb(v_row);
END $$;

CREATE OR REPLACE FUNCTION public.platform_update_payment_status(p_payment_id UUID,p_status TEXT,p_reason TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_before public.platform_payments%ROWTYPE;v_after public.platform_payments%ROWTYPE;v_invoice UUID;
BEGIN
  PERFORM public.platform_assert_capability('payments.write');PERFORM public.platform_assert_reason(p_reason);
  IF p_status IS NULL OR p_status NOT IN ('pending','succeeded','failed','cancelled','refunded','chargeback') THEN
    RAISE EXCEPTION 'invalid_payment_status' USING ERRCODE='22023';END IF;
  -- All payment operations lock invoice first, then payment, to avoid deadlocks.
  SELECT invoice_id INTO v_invoice FROM public.platform_payments WHERE id=p_payment_id;
  IF v_invoice IS NOT NULL THEN PERFORM 1 FROM public.platform_invoices WHERE id=v_invoice FOR UPDATE;END IF;
  SELECT * INTO v_before FROM public.platform_payments WHERE id=p_payment_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'payment_not_found' USING ERRCODE='P0002';END IF;
  IF v_before.provider IS DISTINCT FROM 'manual' THEN RAISE EXCEPTION 'provider_payment_readonly' USING ERRCODE='42501';END IF;
  UPDATE public.platform_payments SET status=p_status,
    paid_at=CASE WHEN p_status='succeeded' THEN coalesce(paid_at,now()) ELSE NULL END,
    failed_at=CASE WHEN p_status='failed' THEN now() ELSE NULL END,updated_at=now()
    WHERE id=p_payment_id RETURNING * INTO v_after;
  PERFORM public.platform_write_audit_log('payment.status_changed','platform_payment',v_after.id,v_after.tenant_id,to_jsonb(v_before),to_jsonb(v_after),trim(p_reason));
  PERFORM public.platform_reconcile_console_invoice(v_after.invoice_id,trim(p_reason));
  RETURN to_jsonb(v_after);
END $$;

-- Retry protection for manual financial records. Keys are scoped to their author.
CREATE TABLE IF NOT EXISTS public.platform_console_requests(
  actor_id UUID NOT NULL, request_id UUID NOT NULL, operation TEXT NOT NULL,
  payload JSONB NOT NULL, result JSONB, created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY(actor_id,request_id)
);
ALTER TABLE public.platform_console_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.platform_console_requests FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION public.platform_record_console_finance(p_request_id UUID,p_operation TEXT,p_payload JSONB,p_reason TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_request public.platform_console_requests%ROWTYPE;v_result JSONB;
BEGIN
  IF p_operation='payment' THEN PERFORM public.platform_assert_capability('payments.write');
  ELSIF p_operation='invoice' THEN PERFORM public.platform_assert_capability('billing.write');
  ELSE RAISE EXCEPTION 'invalid_finance_operation' USING ERRCODE='22023';END IF;
  PERFORM public.platform_assert_reason(p_reason);
  IF p_request_id IS NULL OR p_payload IS NULL THEN RAISE EXCEPTION 'request_required' USING ERRCODE='22023';END IF;
  INSERT INTO public.platform_console_requests(actor_id,request_id,operation,payload)
    VALUES(auth.uid(),p_request_id,p_operation,p_payload) ON CONFLICT DO NOTHING;
  SELECT * INTO v_request FROM public.platform_console_requests WHERE actor_id=auth.uid() AND request_id=p_request_id FOR UPDATE;
  IF v_request.operation<>p_operation OR v_request.payload<>p_payload THEN RAISE EXCEPTION 'request_payload_changed' USING ERRCODE='23514';END IF;
  IF v_request.result IS NOT NULL THEN RETURN v_request.result;END IF;
  IF p_operation='payment' THEN
    v_result=public.platform_record_manual_payment((p_payload->>'tenant_id')::uuid,(p_payload->>'invoice_id')::uuid,
      (p_payload->>'amount_cents')::integer,'succeeded',p_reason,p_payload->>'payment_method');
  ELSE
    IF p_payload->>'due_date' IS NULL OR p_payload->>'tenant_id' IS NULL
      OR p_payload->>'amount_cents' IS NULL OR p_payload->>'tax_cents' IS NULL
      OR (p_payload->>'amount_cents')::integer<=0 OR (p_payload->>'tax_cents')::integer<0
      OR (p_payload->>'tax_cents')::integer>(p_payload->>'amount_cents')::integer THEN
      RAISE EXCEPTION 'invalid_invoice_values' USING ERRCODE='22023';END IF;
    v_result=public.platform_create_manual_invoice((p_payload->>'tenant_id')::uuid,(p_payload->>'amount_cents')::integer,
      (p_payload->>'tax_cents')::integer,(p_payload->>'due_date')::date,p_reason);
  END IF;
  UPDATE public.platform_console_requests SET result=v_result WHERE actor_id=auth.uid() AND request_id=p_request_id;
  RETURN v_result;
END $$;
REVOKE ALL ON FUNCTION public.platform_record_console_finance(UUID,TEXT,JSONB,TEXT) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.platform_record_console_finance(UUID,TEXT,JSONB,TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.platform_update_operator_user(
  p_platform_user_id UUID,
  p_role TEXT,
  p_status TEXT,
  p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_before public.platform_users%ROWTYPE;
  v_after public.platform_users%ROWTYPE;
  v_owner_count INTEGER;
BEGIN
  PERFORM public.platform_assert_capability('users.write');
  PERFORM public.platform_assert_reason(p_reason);
  PERFORM pg_advisory_xact_lock(hashtextextended('platform-owner-membership',0));

  IF p_role IS NULL OR p_role NOT IN ('platform_owner','platform_admin','platform_billing','platform_support','platform_developer','platform_readonly') THEN
    RAISE EXCEPTION 'invalid_platform_role' USING ERRCODE = '22023';
  END IF;
  IF p_status IS NULL OR p_status NOT IN ('active','disabled','revoked') THEN
    RAISE EXCEPTION 'invalid_platform_user_status' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_before FROM public.platform_users WHERE id = p_platform_user_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'platform_user_not_found' USING ERRCODE = 'P0002'; END IF;

  IF v_before.role = 'platform_owner' AND v_before.status = 'active'
     AND (p_role <> 'platform_owner' OR p_status <> 'active') THEN
    SELECT count(*) INTO v_owner_count
    FROM public.platform_users
    WHERE role = 'platform_owner' AND status = 'active';
    IF v_owner_count <= 1 THEN
      RAISE EXCEPTION 'last_platform_owner_protected' USING ERRCODE = '23514';
    END IF;
  END IF;

  UPDATE public.platform_users
  SET role = p_role, status = p_status, updated_at = now()
  WHERE id = p_platform_user_id
  RETURNING * INTO v_after;

  PERFORM public.platform_write_audit_log(
    'platform_user.updated', 'platform_user', v_after.id, NULL,
    jsonb_build_object('role', v_before.role, 'status', v_before.status),
    jsonb_build_object('role', v_after.role, 'status', v_after.status),
    trim(p_reason)
  );
  RETURN jsonb_build_object('ok', TRUE, 'id', v_after.id, 'role', v_after.role, 'status', v_after.status);
END;
$$;

-- Search and dates apply to the entire audit trail before paging.
CREATE OR REPLACE FUNCTION public.platform_list_console_audit(
  p_tenant_id UUID DEFAULT NULL,p_search TEXT DEFAULT NULL,p_from DATE DEFAULT NULL,p_until DATE DEFAULT NULL,p_offset INTEGER DEFAULT 0
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  PERFORM public.platform_assert_capability('audit.read');
  IF p_from IS NOT NULL AND p_until IS NOT NULL AND p_until<p_from THEN
    RAISE EXCEPTION 'invalid_date_range' USING ERRCODE='22023';END IF;
  RETURN jsonb_build_object('items',coalesce((SELECT jsonb_agg(to_jsonb(a) ORDER BY a.created_at DESC,a.id DESC) FROM (
    SELECT id,actor_user_id,actor_role,action,target_type,target_id,tenant_id,
      public.platform_redact_console_value("before") AS "before",public.platform_redact_console_value("after") AS "after",reason,created_at FROM public.platform_audit_log
    WHERE (p_tenant_id IS NULL OR tenant_id=p_tenant_id)
      AND (nullif(trim(p_search),'') IS NULL OR concat_ws(' ',action,reason,target_type,actor_role) ILIKE '%'||trim(p_search)||'%')
      AND (p_from IS NULL OR created_at>=p_from::timestamp AT TIME ZONE 'Europe/Berlin')
      AND (p_until IS NULL OR created_at<(p_until+1)::timestamp AT TIME ZONE 'Europe/Berlin')
    ORDER BY created_at DESC,id DESC LIMIT 51 OFFSET greatest(coalesce(p_offset,0),0)
  ) a),'[]'::jsonb));
END $$;
REVOKE ALL ON FUNCTION public.platform_list_console_audit(UUID,TEXT,DATE,DATE,INTEGER) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.platform_list_console_audit(UUID,TEXT,DATE,DATE,INTEGER) TO authenticated;

-- Paid states are derived from actual records; provider invoices remain provider-managed.
CREATE OR REPLACE FUNCTION public.platform_update_invoice_status(p_invoice_id UUID,p_status TEXT,p_reason TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_before public.platform_invoices%ROWTYPE;v_after public.platform_invoices%ROWTYPE;v_received BIGINT;
BEGIN
  PERFORM public.platform_assert_capability('billing.write');PERFORM public.platform_assert_reason(p_reason);
  IF p_status IS NULL OR p_status NOT IN ('draft','open','past_due','cancelled','failed') THEN
    RAISE EXCEPTION 'invoice_status_payment_managed' USING ERRCODE='22023';END IF;
  SELECT * INTO v_before FROM public.platform_invoices WHERE id=p_invoice_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'invoice_not_found' USING ERRCODE='P0002';END IF;
  IF v_before.provider IS NOT NULL AND v_before.provider<>'manual' THEN
    RAISE EXCEPTION 'provider_invoice_readonly' USING ERRCODE='42501';END IF;
  SELECT coalesce(sum(amount_cents),0) INTO v_received FROM public.platform_payments
    WHERE invoice_id=p_invoice_id AND tenant_id=v_before.tenant_id AND currency=v_before.currency AND status='succeeded';
  IF v_received>0 OR v_before.status IN ('paid','partially_paid','refunded') THEN
    RAISE EXCEPTION 'invoice_status_payment_managed' USING ERRCODE='23514';END IF;
  IF p_status='past_due' AND (v_before.due_date IS NULL OR v_before.due_date>=current_date) THEN
    RAISE EXCEPTION 'invoice_not_past_due' USING ERRCODE='23514';END IF;
  UPDATE public.platform_invoices SET status=p_status,paid_at=NULL,
    cancelled_at=CASE WHEN p_status='cancelled' THEN coalesce(cancelled_at,now()) ELSE NULL END,
    failed_at=CASE WHEN p_status='failed' THEN coalesce(failed_at,now()) ELSE NULL END,updated_at=now()
    WHERE id=p_invoice_id RETURNING * INTO v_after;
  PERFORM public.platform_write_audit_log('invoice.status_changed','platform_invoice',v_after.id,v_after.tenant_id,to_jsonb(v_before),to_jsonb(v_after),trim(p_reason));
  RETURN to_jsonb(v_after);
END $$;
REVOKE ALL ON FUNCTION public.platform_update_invoice_status(UUID,TEXT,TEXT) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.platform_update_invoice_status(UUID,TEXT,TEXT) TO authenticated;

-- The release register searches its full history before paging.
CREATE OR REPLACE FUNCTION public.platform_list_console_releases(
  p_search TEXT DEFAULT NULL,p_status TEXT DEFAULT NULL,p_from DATE DEFAULT NULL,p_until DATE DEFAULT NULL,p_offset INTEGER DEFAULT 0
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  PERFORM public.platform_assert_capability('releases.read');
  IF p_from IS NOT NULL AND p_until IS NOT NULL AND p_until<p_from THEN
    RAISE EXCEPTION 'invalid_date_range' USING ERRCODE='22023';END IF;
  RETURN jsonb_build_object('items',coalesce((SELECT jsonb_agg(to_jsonb(r) ORDER BY r.deployed_at DESC,r.id DESC) FROM (
    SELECT * FROM public.platform_release_deployments
    WHERE (nullif(trim(p_status),'') IS NULL OR status=p_status)
      AND (nullif(trim(p_search),'') IS NULL OR concat_ws(' ',version_label,environment,commit_sha,migration_version,notes) ILIKE '%'||trim(p_search)||'%')
      AND (p_from IS NULL OR deployed_at>=p_from::timestamp AT TIME ZONE 'Europe/Berlin')
      AND (p_until IS NULL OR deployed_at<(p_until+1)::timestamp AT TIME ZONE 'Europe/Berlin')
    ORDER BY deployed_at DESC,id DESC LIMIT 51 OFFSET greatest(coalesce(p_offset,0),0)
  ) r),'[]'::jsonb));
END $$;
REVOKE ALL ON FUNCTION public.platform_list_console_releases(TEXT,TEXT,DATE,DATE,INTEGER) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.platform_list_console_releases(TEXT,TEXT,DATE,DATE,INTEGER) TO authenticated;

COMMIT;
