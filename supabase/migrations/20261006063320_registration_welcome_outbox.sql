-- Transactional registration mail queue. No historical accounts are backfilled.
BEGIN;
CREATE TABLE public.registration_welcome_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  tenant_user_id uuid NOT NULL REFERENCES public.tenant_users(id) ON DELETE CASCADE,
  auth_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recipient_email text NOT NULL,
  template_version text NOT NULL DEFAULT 'registration-welcome-v1' CHECK (template_version='registration-welcome-v1'),
  state text NOT NULL DEFAULT 'pending' CHECK (state IN ('pending','sending','sent','failed','cancelled')),
  provider text CHECK (provider IN ('resend','sendgrid')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 8),
  first_attempt_at timestamptz,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  lease_token uuid,
  lease_until timestamptz,
  provider_message_id text,
  last_error_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  UNIQUE (tenant_user_id, template_version)
);
ALTER TABLE public.registration_welcome_outbox ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.registration_welcome_outbox FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.registration_welcome_outbox TO service_role;
CREATE INDEX registration_welcome_outbox_due ON public.registration_welcome_outbox(next_attempt_at,created_at)
  WHERE state IN ('pending','sending');
COMMENT ON TABLE public.registration_welcome_outbox IS 'One transactional welcome message per new company owner; contains no passwords or authentication tokens. sent means accepted by the mail provider, not proof of inbox delivery.';

CREATE OR REPLACE FUNCTION public.registration_welcome_claim(p_tenant_id uuid DEFAULT NULL,p_limit integer DEFAULT 10,p_provider text DEFAULT 'resend')
RETURNS SETOF public.registration_welcome_outbox
LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp
AS $$
BEGIN
  IF p_provider IS NULL OR p_provider NOT IN ('resend','sendgrid') THEN
    RAISE EXCEPTION 'invalid_mail_provider' USING ERRCODE='22023';
  END IF;
  -- SendGrid has no idempotency key. An expired in-flight attempt may already
  -- have been accepted; preserve it for operator review instead of sending twice.
  UPDATE public.registration_welcome_outbox SET state='failed',lease_token=NULL,lease_until=NULL,
    last_error_code='mail_delivery_needs_review',updated_at=now()
  WHERE state='sending' AND provider='sendgrid' AND lease_until<=now()
    AND (p_tenant_id IS NULL OR tenant_id=p_tenant_id);
  -- Resend idempotency expires after 24 h. Never retry an ambiguous delivery later.
  UPDATE public.registration_welcome_outbox SET state='failed',lease_token=NULL,lease_until=NULL,
    last_error_code='mail_retry_window_expired',updated_at=now()
  WHERE state IN ('pending','sending') AND (p_tenant_id IS NULL OR tenant_id=p_tenant_id)
    AND (lease_until IS NULL OR lease_until <= now())
    AND (attempts >= 8 OR first_attempt_at <= now()-interval '23 hours');
  RETURN QUERY
  WITH due AS (
    SELECT id FROM public.registration_welcome_outbox
    WHERE (p_tenant_id IS NULL OR tenant_id=p_tenant_id)
      AND attempts < 8
      AND (provider IS NULL OR provider=p_provider)
      AND (first_attempt_at IS NULL OR first_attempt_at > now()-interval '23 hours')
      AND ((state='pending' AND next_attempt_at<=now()) OR (state='sending' AND lease_until<=now()))
    ORDER BY created_at,id LIMIT greatest(1,least(coalesce(p_limit,10),10))
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.registration_welcome_outbox q SET state='sending',provider=p_provider,attempts=q.attempts+1,
    first_attempt_at=coalesce(q.first_attempt_at,now()),lease_token=gen_random_uuid(),lease_until=now()+interval '5 minutes',updated_at=now()
  FROM due WHERE q.id=due.id RETURNING q.*;
END;
$$;
REVOKE ALL ON FUNCTION public.registration_welcome_claim(uuid,integer,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.registration_welcome_claim(uuid,integer,text) TO service_role;

CREATE OR REPLACE FUNCTION public.registration_welcome_finish(p_outbox_id uuid,p_lease_token uuid,p_outcome text,p_provider_message_id text DEFAULT NULL,p_error_code text DEFAULT NULL)
RETURNS boolean
LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp
AS $$
DECLARE v_updated integer;
BEGIN
  IF p_outcome IS NULL OR p_outcome NOT IN ('sent','retry','failed','cancelled') THEN
    RAISE EXCEPTION 'invalid_mail_outcome' USING ERRCODE='22023';
  END IF;
  UPDATE public.registration_welcome_outbox SET
    state=CASE WHEN p_outcome='retry' THEN CASE WHEN attempts>=8 THEN 'failed' ELSE 'pending' END ELSE p_outcome END,
    next_attempt_at=CASE WHEN p_outcome='retry' THEN now()+make_interval(mins=>least(128,power(2,attempts-1)::integer)) ELSE next_attempt_at END,
    provider_message_id=CASE WHEN p_outcome='sent' THEN left(p_provider_message_id,200) ELSE provider_message_id END,
    last_error_code=CASE WHEN p_outcome='sent' THEN NULL ELSE left(p_error_code,100) END,
    sent_at=CASE WHEN p_outcome='sent' THEN now() ELSE sent_at END,
    lease_token=NULL,lease_until=NULL,updated_at=now()
  WHERE id=p_outbox_id AND state='sending' AND lease_token=p_lease_token AND lease_until>now();
  GET DIAGNOSTICS v_updated=ROW_COUNT;
  RETURN v_updated=1;
END;
$$;
REVOKE ALL ON FUNCTION public.registration_welcome_finish(uuid,uuid,text,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.registration_welcome_finish(uuid,uuid,text,text,text) TO service_role;

-- The current register_business_workspace implementation follows, with a single
-- insertion inside its new-workspace transaction. Existing retries remain intact.

-- One transaction provisions the complete free workspace and its operator record.
-- Only the registration Edge Function may call this function (service_role).
CREATE OR REPLACE FUNCTION public.register_business_workspace(p_auth_user_id uuid, p_data jsonb)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  v_tenant uuid;
  v_role uuid;
  v_owner public.tenant_users%ROWTYPE;
  v_email text := lower(trim(p_data->>'adminEmail'));
  v_name text := trim(p_data->>'companyName');
  v_slug text;
  v_key text;
  v_products public.product_key[];
BEGIN
  IF p_auth_user_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM auth.users WHERE id = p_auth_user_id AND lower(email) = v_email
  ) THEN RAISE EXCEPTION 'registration_identity_invalid' USING ERRCODE='22023'; END IF;
  FOREACH v_key IN ARRAY ARRAY['companyName','legalForm','industry','street','zip','city','phone','email','adminFirstName','adminLastName','adminEmail'] LOOP
    IF coalesce(length(trim(p_data->>v_key)),0) NOT BETWEEN 1 AND 200 THEN
      RAISE EXCEPTION 'registration_required_field: %', v_key USING ERRCODE='22023';
    END IF;
  END LOOP;
  IF p_data->>'termsAccepted' IS DISTINCT FROM 'true' THEN
    RAISE EXCEPTION 'registration_terms_required' USING ERRCODE='22023';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_auth_user_id::text, 1700));
  -- Safe retry after a lost HTTP response: never create a second workspace.
  SELECT * INTO v_owner FROM public.tenant_users WHERE auth_user_id=p_auth_user_id AND role_key='owner' AND status='active' LIMIT 1;
  IF NOT FOUND THEN
    IF EXISTS (SELECT 1 FROM public.profiles WHERE auth_user_id=p_auth_user_id AND tenant_id IS NOT NULL) THEN
      RAISE EXCEPTION 'registration_existing_account' USING ERRCODE='23505';
    END IF;
    SELECT array_agg(product_key ORDER BY sort_order) INTO v_products FROM public.products WHERE is_active;
    IF v_products IS NULL OR NOT ('office'::public.product_key = ANY(v_products)) THEN
      RAISE EXCEPTION 'registration_products_unavailable';
    END IF;
    v_tenant := gen_random_uuid();
    v_slug := left(trim(both '-' from regexp_replace(lower(v_name), '[^a-z0-9]+', '-', 'g')), 35) || '-' || left(v_tenant::text,8);
    INSERT INTO public.tenants(id,name,legal_name,slug,legal_form,industry,street,postal_code,city,phone,email,website,ik_number,tax_number,vat_id,status,billing_email,representative_name)
    VALUES(v_tenant,v_name,v_name,v_slug,trim(p_data->>'legalForm'),trim(p_data->>'industry'),trim(p_data->>'street'),trim(p_data->>'zip'),trim(p_data->>'city'),trim(p_data->>'phone'),lower(trim(p_data->>'email')),nullif(trim(p_data->>'website'),''),nullif(trim(p_data->>'ikNumber'),''),nullif(trim(p_data->>'taxNumber'),''),nullif(trim(p_data->>'vatId'),''),'active',v_email,trim(p_data->>'adminFirstName')||' '||trim(p_data->>'adminLastName'));
    INSERT INTO public.roles(tenant_id,key,name,is_admin_role,can_manage_tenant,can_manage_users,can_manage_roles,can_manage_products,can_manage_clients,can_manage_employees,can_manage_assignments,can_manage_documentation,can_manage_service_records,can_manage_signatures,can_manage_documents,can_manage_messages,can_manage_billing,can_view_reports,can_view_audit_logs,can_manage_support,can_use_ai_assistant,allowed_products)
    VALUES(v_tenant,'owner','Geschäftsführung',true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,v_products) RETURNING id INTO v_role;
    INSERT INTO public.profiles(auth_user_id,tenant_id,role_id,first_name,last_name,email,phone,status,is_active,activated_at,terms_accepted_at,privacy_accepted_at)
    VALUES(p_auth_user_id,v_tenant,v_role,trim(p_data->>'adminFirstName'),trim(p_data->>'adminLastName'),v_email,nullif(trim(p_data->>'adminPhone'),''),'active',true,now(),now(),now())
    ON CONFLICT(auth_user_id) DO UPDATE SET tenant_id=EXCLUDED.tenant_id,role_id=EXCLUDED.role_id,first_name=EXCLUDED.first_name,last_name=EXCLUDED.last_name,email=EXCLUDED.email,phone=EXCLUDED.phone,status=EXCLUDED.status,is_active=true,activated_at=now(),terms_accepted_at=now(),privacy_accepted_at=now(),updated_at=now();
    INSERT INTO public.tenant_users(tenant_id,auth_user_id,display_name,first_name,last_name,email,username,role_key,status,must_change_password,first_login_completed,last_password_change_at)
    VALUES(v_tenant,p_auth_user_id,trim(p_data->>'adminFirstName')||' '||trim(p_data->>'adminLastName'),trim(p_data->>'adminFirstName'),trim(p_data->>'adminLastName'),v_email,'admin.'||left(replace(v_tenant::text,'-',''),14),'owner','active',false,true,now()) RETURNING * INTO v_owner;
    INSERT INTO public.tenant_addresses(tenant_id,street,zip,city) VALUES(v_tenant,trim(p_data->>'street'),trim(p_data->>'zip'),trim(p_data->>'city'));
    INSERT INTO public.tenant_contacts(tenant_id,first_name,last_name,role,email,phone,is_primary)
    VALUES(v_tenant,coalesce(nullif(trim(p_data->>'contactFirstName'),''),trim(p_data->>'adminFirstName')),coalesce(nullif(trim(p_data->>'contactLastName'),''),trim(p_data->>'adminLastName')),coalesce(nullif(trim(p_data->>'contactRole'),''),'Geschäftsführung'),v_email,nullif(trim(p_data->>'adminPhone'),''),true);
    INSERT INTO public.tenant_products(tenant_id,product_id,product_key,status,is_active,activated_at,access_source,access_type,billing_status,price_cents,monthly_price,premium_ready,is_default,is_visible_in_switcher)
    SELECT v_tenant,id,product_key,'active',true,now(),'free_active','free','free_active',0,0,false,product_key='office',true FROM public.products WHERE is_active;
    INSERT INTO public.tenant_subscriptions(tenant_id,status,billing_email,metadata)
    VALUES(v_tenant,'active',v_email,jsonb_build_object('plan_key','free_platform','price_cents',0,'registration_version','2026-09-07'));
    INSERT INTO public.platform_tenants(tenant_id,tenant_name,legal_name,slug,status,lifecycle_status,billing_status,plan_key,industry_type,primary_contact_name,primary_contact_email,primary_contact_phone,activated_at)
    VALUES(v_tenant,v_name,v_name,v_slug,'active','onboarding','manual_free','free_platform',trim(p_data->>'industry'),v_owner.display_name,v_email,nullif(trim(p_data->>'adminPhone'),''),now())
    ON CONFLICT(tenant_id) DO UPDATE SET tenant_name=EXCLUDED.tenant_name,legal_name=EXCLUDED.legal_name,slug=EXCLUDED.slug,status='active',lifecycle_status='onboarding',billing_status='manual_free',plan_key='free_platform',industry_type=EXCLUDED.industry_type,primary_contact_name=EXCLUDED.primary_contact_name,primary_contact_email=EXCLUDED.primary_contact_email,primary_contact_phone=EXCLUDED.primary_contact_phone,trial_starts_at=NULL,trial_ends_at=NULL,activated_at=now(),updated_at=now();
    INSERT INTO public.tenant_environment_settings(tenant_id,mode,is_pilot_tenant,provider_sandbox_only,notes)
    VALUES(v_tenant,'production',false,false,'Kostenlose Unternehmensregistrierung')
    ON CONFLICT(tenant_id) DO NOTHING;
    INSERT INTO public.platform_tenant_modules(tenant_id,module_key,status,is_trial,enabled_at)
    SELECT v_tenant,module_key,'enabled',false,now() FROM public.platform_modules WHERE status='available'
    ON CONFLICT(tenant_id,module_key) DO UPDATE SET status='enabled',is_trial=false,trial_ends_at=NULL,enabled_at=now();
    INSERT INTO public.registration_welcome_outbox(tenant_id,tenant_user_id,auth_user_id,recipient_email)
    VALUES(v_owner.tenant_id,v_owner.id,p_auth_user_id,v_email);
  END IF;
  RETURN jsonb_build_object('ok',true,'tenantId',v_owner.tenant_id,'owner',jsonb_build_object('id',v_owner.id,'tenantId',v_owner.tenant_id,'username',v_owner.username,'email',v_owner.email,'roleKey',v_owner.role_key,'displayName',v_owner.display_name),'credentials',jsonb_build_object('username',v_owner.username),'welcomeEmailQueued',EXISTS(SELECT 1 FROM public.registration_welcome_outbox q WHERE q.tenant_user_id=v_owner.id AND q.state IN ('pending','sending','sent')));
END;
$$;
REVOKE ALL ON FUNCTION public.register_business_workspace(uuid,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.register_business_workspace(uuid,jsonb) TO service_role;

COMMIT;
