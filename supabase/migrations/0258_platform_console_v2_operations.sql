-- CareSuite+ Platform Console V2: Benutzerverwaltung und Release-Register.
-- Additiv, auditierbar und ausschließlich für authentifizierte Platform-Rollen.

CREATE TABLE IF NOT EXISTS public.platform_release_deployments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  environment TEXT NOT NULL CHECK (environment IN ('preview', 'staging', 'production')),
  version_label TEXT NOT NULL,
  commit_sha TEXT,
  status TEXT NOT NULL CHECK (status IN ('planned', 'building', 'ready', 'failed', 'rolled_back')),
  deployment_url TEXT,
  migration_version TEXT,
  checks JSONB NOT NULL DEFAULT '{}'::jsonb,
  notes TEXT,
  deployed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT auth.uid(),
  deployed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS platform_release_deployments_recent_idx
  ON public.platform_release_deployments(environment, deployed_at DESC);

ALTER TABLE public.platform_release_deployments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS platform_release_deployments_select ON public.platform_release_deployments;
CREATE POLICY platform_release_deployments_select ON public.platform_release_deployments
  FOR SELECT TO authenticated
  USING (public.platform_has_capability('releases.read'));

REVOKE ALL ON public.platform_release_deployments FROM PUBLIC, anon;
GRANT SELECT ON public.platform_release_deployments TO authenticated;

CREATE OR REPLACE FUNCTION public.platform_list_operator_users()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.platform_assert_capability('users.read');
  RETURN jsonb_build_object(
    'items', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', pu.id,
        'user_id', pu.user_id,
        'email', pu.email,
        'full_name', pu.full_name,
        'role', pu.role,
        'status', pu.status,
        'last_login_at', pu.last_login_at,
        'updated_at', pu.updated_at
      ) ORDER BY pu.status, pu.email)
      FROM public.platform_users pu
    ), '[]'::jsonb)
  );
END;
$$;

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

  IF p_role NOT IN ('platform_owner','platform_admin','platform_billing','platform_support','platform_developer','platform_readonly') THEN
    RAISE EXCEPTION 'invalid_platform_role' USING ERRCODE = '22023';
  END IF;
  IF p_status NOT IN ('active','disabled','revoked') THEN
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

CREATE OR REPLACE FUNCTION public.platform_list_releases(p_limit INTEGER DEFAULT 100)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.platform_assert_capability('releases.read');
  RETURN jsonb_build_object(
    'items', COALESCE((
      SELECT jsonb_agg(to_jsonb(r) ORDER BY r.deployed_at DESC)
      FROM (SELECT * FROM public.platform_release_deployments ORDER BY deployed_at DESC LIMIT LEAST(GREATEST(p_limit,1),200)) r
    ), '[]'::jsonb)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.platform_register_release(
  p_environment TEXT,
  p_version_label TEXT,
  p_commit_sha TEXT,
  p_status TEXT,
  p_deployment_url TEXT,
  p_migration_version TEXT,
  p_checks JSONB,
  p_notes TEXT,
  p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_row public.platform_release_deployments%ROWTYPE;
BEGIN
  PERFORM public.platform_assert_capability('system.write');
  PERFORM public.platform_assert_reason(p_reason);
  IF p_environment NOT IN ('preview','staging','production') THEN RAISE EXCEPTION 'invalid_environment' USING ERRCODE='22023'; END IF;
  IF p_status NOT IN ('planned','building','ready','failed','rolled_back') THEN RAISE EXCEPTION 'invalid_release_status' USING ERRCODE='22023'; END IF;
  IF length(trim(coalesce(p_version_label,''))) = 0 THEN RAISE EXCEPTION 'version_required' USING ERRCODE='22023'; END IF;

  INSERT INTO public.platform_release_deployments(
    environment, version_label, commit_sha, status, deployment_url,
    migration_version, checks, notes
  ) VALUES (
    p_environment, trim(p_version_label), nullif(trim(p_commit_sha),''), p_status,
    nullif(trim(p_deployment_url),''), nullif(trim(p_migration_version),''),
    coalesce(p_checks,'{}'::jsonb), nullif(trim(p_notes),'')
  ) RETURNING * INTO v_row;

  PERFORM public.platform_write_audit_log(
    'release.registered', 'platform_release', v_row.id, NULL, NULL,
    jsonb_build_object('environment',v_row.environment,'version',v_row.version_label,'status',v_row.status),
    trim(p_reason)
  );
  RETURN to_jsonb(v_row);
END;
$$;

REVOKE ALL ON FUNCTION public.platform_list_operator_users() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.platform_update_operator_user(UUID,TEXT,TEXT,TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.platform_list_releases(INTEGER) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.platform_register_release(TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,JSONB,TEXT,TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.platform_list_operator_users() TO authenticated;
GRANT EXECUTE ON FUNCTION public.platform_update_operator_user(UUID,TEXT,TEXT,TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.platform_list_releases(INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.platform_register_release(TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,JSONB,TEXT,TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.platform_create_discount(
  p_discount_key TEXT, p_name TEXT, p_discount_type TEXT, p_value NUMERIC,
  p_description TEXT, p_reason TEXT
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_row public.platform_discounts%ROWTYPE;
BEGIN
  PERFORM public.platform_assert_capability('discounts.write');
  PERFORM public.platform_assert_reason(p_reason);
  IF trim(coalesce(p_discount_key,'')) !~ '^[a-z0-9_-]{3,}$' THEN RAISE EXCEPTION 'invalid_discount_key' USING ERRCODE='22023'; END IF;
  IF length(trim(coalesce(p_name,''))) < 2 THEN RAISE EXCEPTION 'discount_name_required' USING ERRCODE='22023'; END IF;
  IF p_discount_type NOT IN ('percentage','fixed_amount','free_months','lifetime_discount','beta_discount','manual_credit','goodwill_credit','partner_discount') THEN RAISE EXCEPTION 'invalid_discount_type' USING ERRCODE='22023'; END IF;
  IF p_value IS NULL OR p_value < 0 THEN RAISE EXCEPTION 'invalid_discount_value' USING ERRCODE='22023'; END IF;
  INSERT INTO public.platform_discounts(discount_key,name,description,discount_type,percentage,amount_cents,free_months,created_by)
  VALUES(trim(p_discount_key),trim(p_name),nullif(trim(p_description),''),p_discount_type,
    CASE WHEN p_discount_type IN ('percentage','lifetime_discount','beta_discount','partner_discount') THEN p_value ELSE NULL END,
    CASE WHEN p_discount_type IN ('fixed_amount','manual_credit','goodwill_credit') THEN round(p_value)::INTEGER ELSE NULL END,
    CASE WHEN p_discount_type='free_months' THEN round(p_value)::INTEGER ELSE NULL END, auth.uid())
  RETURNING * INTO v_row;
  PERFORM public.platform_write_audit_log('discount.created','platform_discount',v_row.id,NULL,NULL,to_jsonb(v_row),trim(p_reason));
  RETURN to_jsonb(v_row);
END $$;

CREATE OR REPLACE FUNCTION public.platform_create_manual_invoice(
  p_tenant_id UUID, p_total_cents INTEGER, p_tax_cents INTEGER,
  p_due_date DATE, p_reason TEXT
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_row public.platform_invoices%ROWTYPE;
BEGIN
  PERFORM public.platform_assert_capability('billing.write');
  PERFORM public.platform_assert_reason(p_reason);
  IF p_total_cents <= 0 OR p_tax_cents < 0 OR p_tax_cents > p_total_cents THEN RAISE EXCEPTION 'invalid_invoice_amounts' USING ERRCODE='22023'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.platform_tenants WHERE tenant_id=p_tenant_id) THEN RAISE EXCEPTION 'tenant_not_found' USING ERRCODE='P0002'; END IF;
  INSERT INTO public.platform_invoices(tenant_id,invoice_number,provider,status,subtotal_cents,tax_cents,total_cents,due_date,issued_at)
  VALUES(p_tenant_id,'CS-'||to_char(now(),'YYYYMMDD')||'-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,6)),'manual','open',p_total_cents-p_tax_cents,p_tax_cents,p_total_cents,p_due_date,now())
  RETURNING * INTO v_row;
  PERFORM public.platform_write_audit_log('invoice.created','platform_invoice',v_row.id,p_tenant_id,NULL,to_jsonb(v_row),trim(p_reason));
  RETURN to_jsonb(v_row);
END $$;

CREATE OR REPLACE FUNCTION public.platform_update_payment_status(
  p_payment_id UUID, p_status TEXT, p_reason TEXT
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_before public.platform_payments%ROWTYPE; v_after public.platform_payments%ROWTYPE;
BEGIN
  PERFORM public.platform_assert_capability('payments.write');
  PERFORM public.platform_assert_reason(p_reason);
  IF p_status NOT IN ('pending','succeeded','failed','cancelled','refunded','chargeback') THEN RAISE EXCEPTION 'invalid_payment_status' USING ERRCODE='22023'; END IF;
  SELECT * INTO v_before FROM public.platform_payments WHERE id=p_payment_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'payment_not_found' USING ERRCODE='P0002'; END IF;
  UPDATE public.platform_payments SET status=p_status,
    paid_at=CASE WHEN p_status='succeeded' THEN coalesce(paid_at,now()) ELSE paid_at END,
    failed_at=CASE WHEN p_status='failed' THEN coalesce(failed_at,now()) ELSE failed_at END,
    updated_at=now() WHERE id=p_payment_id RETURNING * INTO v_after;
  PERFORM public.platform_write_audit_log('payment.status_changed','platform_payment',v_after.id,v_after.tenant_id,to_jsonb(v_before),to_jsonb(v_after),trim(p_reason));
  RETURN to_jsonb(v_after);
END $$;

REVOKE ALL ON FUNCTION public.platform_create_discount(TEXT,TEXT,TEXT,NUMERIC,TEXT,TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.platform_create_manual_invoice(UUID,INTEGER,INTEGER,DATE,TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.platform_update_payment_status(UUID,TEXT,TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.platform_create_discount(TEXT,TEXT,TEXT,NUMERIC,TEXT,TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.platform_create_manual_invoice(UUID,INTEGER,INTEGER,DATE,TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.platform_update_payment_status(UUID,TEXT,TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.platform_list_tenant_users(p_tenant_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  PERFORM public.platform_assert_capability('tenants.read');
  RETURN jsonb_build_object('items',COALESCE((SELECT jsonb_agg(jsonb_build_object(
    'id',p.id,'display_name',p.display_name,'email',p.email,'phone',p.phone,
    'role_key',p.role_key,'updated_at',p.updated_at
  ) ORDER BY p.display_name,p.email) FROM public.profiles p WHERE p.tenant_id=p_tenant_id),'[]'::jsonb));
END $$;
REVOKE ALL ON FUNCTION public.platform_list_tenant_users(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.platform_list_tenant_users(UUID) TO authenticated;
