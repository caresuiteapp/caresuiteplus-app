-- CareSuite+ — Add-ons und Mandantenakten reparieren (idempotent)
-- 1. Stellt die vollständige Add-on-Basis bereit.
-- 2. Liest Add-ons ausschließlich über capability-geschützte RPCs.
-- 3. Trennt bestätigte Produktivmandanten sichtbar von Pilot-/Testdaten.

CREATE OR REPLACE FUNCTION public.platform_assert_capability(p_capability TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.platform_has_capability(p_capability) THEN
    RAISE EXCEPTION 'platform_forbidden' USING ERRCODE = '42501';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.platform_assert_reason(p_reason TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF p_reason IS NULL OR length(BTRIM(p_reason)) < 5 THEN
    RAISE EXCEPTION 'reason_required' USING ERRCODE = '22023';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.platform_assert_capability(TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.platform_assert_reason(TEXT) FROM PUBLIC, anon, authenticated;

CREATE TABLE IF NOT EXISTS public.platform_addons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  addon_key TEXT NOT NULL UNIQUE,
  addon_name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'beta', 'deprecated', 'disabled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.platform_addon_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  addon_key TEXT NOT NULL REFERENCES public.platform_addons(addon_key) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  monthly_price_cents INTEGER NOT NULL DEFAULT 0,
  yearly_price_cents INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'EUR',
  effective_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  effective_until TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (addon_key, version_number)
);

CREATE TABLE IF NOT EXISTS public.platform_addon_entitlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  addon_version_id UUID NOT NULL REFERENCES public.platform_addon_versions(id) ON DELETE CASCADE,
  module_key TEXT REFERENCES public.platform_modules(module_key) ON DELETE RESTRICT,
  entitlement_key TEXT NOT NULL,
  entitlement_value JSONB NOT NULL DEFAULT 'true'::jsonb,
  access_state TEXT NOT NULL DEFAULT 'active',
  UNIQUE (addon_version_id, entitlement_key)
);

CREATE TABLE IF NOT EXISTS public.platform_tenant_addons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  addon_key TEXT NOT NULL REFERENCES public.platform_addons(addon_key) ON DELETE RESTRICT,
  addon_version_id UUID REFERENCES public.platform_addon_versions(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'active',
  billing_interval TEXT NOT NULL DEFAULT 'monthly',
  price_override_cents INTEGER,
  starts_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ends_at TIMESTAMPTZ,
  assigned_by UUID,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, addon_key)
);

CREATE TABLE IF NOT EXISTS public.platform_tenant_addon_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_addon_id UUID NOT NULL REFERENCES public.platform_tenant_addons(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  actor_user_id UUID,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.platform_addons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_addon_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_addon_entitlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_tenant_addons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_tenant_addon_events ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE v_table TEXT;
BEGIN
  FOREACH v_table IN ARRAY ARRAY[
    'platform_addons', 'platform_addon_versions', 'platform_addon_entitlements',
    'platform_tenant_addons', 'platform_tenant_addon_events'
  ] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', v_table || '_platform_select', v_table);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (public.is_platform_user())',
      v_table || '_platform_select', v_table
    );
  END LOOP;
END $$;

GRANT SELECT ON public.platform_addons, public.platform_addon_versions,
  public.platform_addon_entitlements, public.platform_tenant_addons,
  public.platform_tenant_addon_events TO authenticated;

CREATE OR REPLACE FUNCTION public.platform_list_addons_catalog()
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_result JSONB;
BEGIN
  PERFORM public.platform_assert_capability('plans.read');
  SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.addon_name), '[]'::jsonb)
  INTO v_result
  FROM (
    SELECT a.*,
      av.id AS active_version_id,
      av.version_number,
      av.monthly_price_cents,
      av.yearly_price_cents,
      av.currency
    FROM public.platform_addons a
    LEFT JOIN LATERAL (
      SELECT v.* FROM public.platform_addon_versions v
      WHERE v.addon_key = a.addon_key AND v.status = 'active'
      ORDER BY v.version_number DESC LIMIT 1
    ) av ON TRUE
  ) x;
  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.platform_list_addon_versions(p_addon_key TEXT)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_result JSONB;
BEGIN
  PERFORM public.platform_assert_capability('plans.read');
  SELECT COALESCE(jsonb_agg(to_jsonb(v) ORDER BY v.version_number DESC), '[]'::jsonb)
  INTO v_result FROM public.platform_addon_versions v WHERE v.addon_key = p_addon_key;
  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.platform_create_addon(
  p_addon_key TEXT, p_addon_name TEXT, p_reason TEXT, p_description TEXT DEFAULT NULL,
  p_monthly_price_cents INTEGER DEFAULT 0, p_yearly_price_cents INTEGER DEFAULT 0
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_addon public.platform_addons%ROWTYPE; v_version_id UUID;
BEGIN
  PERFORM public.platform_assert_capability('plans.write');
  PERFORM public.platform_assert_reason(p_reason);
  IF p_addon_key !~ '^[a-z][a-z0-9_]{2,63}$' THEN RAISE EXCEPTION 'invalid_addon_key'; END IF;
  INSERT INTO public.platform_addons (addon_key, addon_name, description)
  VALUES (p_addon_key, BTRIM(p_addon_name), NULLIF(BTRIM(p_description), '')) RETURNING * INTO v_addon;
  INSERT INTO public.platform_addon_versions (addon_key, version_number, monthly_price_cents, yearly_price_cents)
  VALUES (p_addon_key, 1, GREATEST(p_monthly_price_cents, 0), GREATEST(p_yearly_price_cents, 0))
  RETURNING id INTO v_version_id;
  PERFORM public.platform_write_audit_log('addon.created', 'platform_addon', v_addon.id, NULL, NULL, to_jsonb(v_addon), p_reason);
  RETURN jsonb_build_object('addon', to_jsonb(v_addon), 'initialVersionId', v_version_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.platform_update_addon(
  p_addon_key TEXT, p_reason TEXT, p_addon_name TEXT DEFAULT NULL,
  p_description TEXT DEFAULT NULL, p_status TEXT DEFAULT NULL
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_before JSONB; v_after JSONB;
BEGIN
  PERFORM public.platform_assert_capability('plans.write');
  PERFORM public.platform_assert_reason(p_reason);
  SELECT to_jsonb(a) INTO v_before FROM public.platform_addons a WHERE a.addon_key = p_addon_key;
  IF v_before IS NULL THEN RAISE EXCEPTION 'addon_not_found' USING ERRCODE = 'P0002'; END IF;
  UPDATE public.platform_addons SET
    addon_name = COALESCE(NULLIF(BTRIM(p_addon_name), ''), addon_name),
    description = CASE WHEN p_description IS NULL THEN description ELSE NULLIF(BTRIM(p_description), '') END,
    status = COALESCE(p_status, status), updated_at = NOW()
  WHERE addon_key = p_addon_key RETURNING to_jsonb(platform_addons) INTO v_after;
  PERFORM public.platform_write_audit_log('addon.updated', 'platform_addon', (v_after->>'id')::uuid, NULL, v_before, v_after, p_reason);
  RETURN v_after;
END;
$$;

CREATE OR REPLACE FUNCTION public.platform_create_addon_version(
  p_addon_key TEXT, p_reason TEXT, p_monthly_price_cents INTEGER,
  p_yearly_price_cents INTEGER, p_effective_from TIMESTAMPTZ DEFAULT NOW()
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_next INTEGER; v_new public.platform_addon_versions%ROWTYPE;
BEGIN
  PERFORM public.platform_assert_capability('plans.write');
  PERFORM public.platform_assert_reason(p_reason);
  IF NOT EXISTS (SELECT 1 FROM public.platform_addons WHERE addon_key = p_addon_key) THEN
    RAISE EXCEPTION 'addon_not_found' USING ERRCODE = 'P0002';
  END IF;
  SELECT COALESCE(MAX(version_number), 0) + 1 INTO v_next FROM public.platform_addon_versions WHERE addon_key = p_addon_key;
  UPDATE public.platform_addon_versions SET status = 'superseded', effective_until = p_effective_from
  WHERE addon_key = p_addon_key AND status = 'active';
  INSERT INTO public.platform_addon_versions (addon_key, version_number, monthly_price_cents, yearly_price_cents, effective_from)
  VALUES (p_addon_key, v_next, GREATEST(p_monthly_price_cents, 0), GREATEST(p_yearly_price_cents, 0), p_effective_from)
  RETURNING * INTO v_new;
  PERFORM public.platform_write_audit_log('addon.version_created', 'platform_addon_version', v_new.id, NULL, NULL, to_jsonb(v_new), p_reason);
  RETURN to_jsonb(v_new);
END;
$$;

CREATE OR REPLACE FUNCTION public.platform_assign_addon_to_tenant(
  p_tenant_id UUID, p_addon_key TEXT, p_reason TEXT,
  p_billing_interval TEXT DEFAULT 'monthly', p_price_override_cents INTEGER DEFAULT NULL
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_version_id UUID; v_row public.platform_tenant_addons%ROWTYPE;
BEGIN
  PERFORM public.platform_assert_capability('plans.write');
  PERFORM public.platform_assert_reason(p_reason);
  IF p_billing_interval NOT IN ('monthly', 'yearly') THEN RAISE EXCEPTION 'invalid_billing_interval'; END IF;
  SELECT av.id INTO v_version_id FROM public.platform_addon_versions av
  WHERE av.addon_key = p_addon_key AND av.status = 'active' ORDER BY av.version_number DESC LIMIT 1;
  IF v_version_id IS NULL THEN RAISE EXCEPTION 'active_addon_version_not_found' USING ERRCODE = 'P0002'; END IF;
  INSERT INTO public.platform_tenant_addons (
    tenant_id, addon_key, addon_version_id, status, billing_interval, price_override_cents, assigned_by, reason
  ) VALUES (p_tenant_id, p_addon_key, v_version_id, 'active', p_billing_interval, p_price_override_cents, auth.uid(), p_reason)
  ON CONFLICT (tenant_id, addon_key) DO UPDATE SET
    addon_version_id = EXCLUDED.addon_version_id, status = 'active', billing_interval = EXCLUDED.billing_interval,
    price_override_cents = EXCLUDED.price_override_cents, ends_at = NULL, assigned_by = EXCLUDED.assigned_by,
    reason = EXCLUDED.reason, updated_at = NOW()
  RETURNING * INTO v_row;
  INSERT INTO public.platform_tenant_addon_events (tenant_addon_id, tenant_id, event_type, payload, actor_user_id, reason)
  VALUES (v_row.id, p_tenant_id, 'assigned', jsonb_build_object('addonKey', p_addon_key), auth.uid(), p_reason);
  IF to_regprocedure('public.platform_recalculate_tenant_entitlements(uuid,text)') IS NOT NULL THEN
    EXECUTE 'SELECT public.platform_recalculate_tenant_entitlements($1, $2)' USING p_tenant_id, p_reason;
  END IF;
  PERFORM public.platform_write_audit_log('addon.assigned', 'platform_tenant_addon', v_row.id, p_tenant_id, NULL, to_jsonb(v_row), p_reason);
  RETURN to_jsonb(v_row);
END;
$$;

CREATE OR REPLACE FUNCTION public.platform_remove_addon_from_tenant(p_tenant_id UUID, p_addon_key TEXT, p_reason TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_before JSONB; v_row_id UUID;
BEGIN
  PERFORM public.platform_assert_capability('plans.write');
  PERFORM public.platform_assert_reason(p_reason);
  SELECT to_jsonb(ta), ta.id INTO v_before, v_row_id FROM public.platform_tenant_addons ta
  WHERE ta.tenant_id = p_tenant_id AND ta.addon_key = p_addon_key;
  UPDATE public.platform_tenant_addons SET status = 'cancelled', ends_at = NOW(), updated_at = NOW()
  WHERE tenant_id = p_tenant_id AND addon_key = p_addon_key AND status = 'active';
  IF v_row_id IS NOT NULL THEN
    INSERT INTO public.platform_tenant_addon_events (tenant_addon_id, tenant_id, event_type, payload, actor_user_id, reason)
    VALUES (v_row_id, p_tenant_id, 'removed', jsonb_build_object('addonKey', p_addon_key), auth.uid(), p_reason);
  END IF;
  IF to_regprocedure('public.platform_recalculate_tenant_entitlements(uuid,text)') IS NOT NULL THEN
    EXECUTE 'SELECT public.platform_recalculate_tenant_entitlements($1, $2)' USING p_tenant_id, p_reason;
  END IF;
  PERFORM public.platform_write_audit_log('addon.removed', 'platform_tenant_addon', v_row_id, p_tenant_id, v_before, NULL, p_reason);
  RETURN jsonb_build_object('removed', v_before IS NOT NULL);
END;
$$;

GRANT EXECUTE ON FUNCTION public.platform_list_addons_catalog() TO authenticated;
GRANT EXECUTE ON FUNCTION public.platform_list_addon_versions(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.platform_create_addon(TEXT, TEXT, TEXT, TEXT, INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.platform_update_addon(TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.platform_create_addon_version(TEXT, TEXT, INTEGER, INTEGER, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION public.platform_assign_addon_to_tenant(UUID, TEXT, TEXT, TEXT, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.platform_remove_addon_from_tenant(UUID, TEXT, TEXT) TO authenticated;

-- Bekannte Umgebungen eindeutig kennzeichnen. Fehlende Mandanten bleiben bewusst ungeklärt.
INSERT INTO public.tenant_environment_settings (tenant_id, mode, is_pilot_tenant, provider_sandbox_only, notes)
SELECT x.tenant_id, x.mode, x.is_pilot, x.sandbox_only, x.notes
FROM (VALUES
  ('56180c22-b894-4fab-b55e-a563c94dd6e7'::uuid, 'production', false, false, 'LIVE whitelist — Helferhasen+ UG / AVENTA'),
  ('a0000000-0000-4000-8000-000000000001'::uuid, 'demo', false, true, 'Synthetischer Demo-Mandant'),
  ('a4ba83bd-65db-46cf-8cf7-61492cc78315'::uuid, 'internal_test', false, true, 'E2E Test Pflege GmbH'),
  ('6e8a5c3b-03fd-423d-acd9-00edf9b24f99'::uuid, 'internal_test', false, true, 'E2E Test Pflege Live GmbH'),
  ('3d6220dd-7e10-478a-97c7-f8d5c0a99c32'::uuid, 'internal_test', false, true, 'Pilot-Verify-Sandbox'),
  ('11111111-1111-1111-1111-111111111101'::uuid, 'pilot', true, true, 'Fiktiver Pilotmandant: SonnenPflege Ambulant Köln'),
  ('11111111-1111-1111-1111-111111111102'::uuid, 'pilot', true, true, 'Fiktiver Pilotmandant: Herzlich Zuhause Pflege Düsseldorf'),
  ('11111111-1111-1111-1111-111111111103'::uuid, 'pilot', true, true, 'Fiktiver Pilotmandant: PflegeEngel Bonn')
) AS x(tenant_id, mode, is_pilot, sandbox_only, notes)
WHERE EXISTS (SELECT 1 FROM public.tenants t WHERE t.id = x.tenant_id)
ON CONFLICT (tenant_id) DO UPDATE SET
  mode = EXCLUDED.mode, is_pilot_tenant = EXCLUDED.is_pilot_tenant,
  provider_sandbox_only = EXCLUDED.provider_sandbox_only, notes = EXCLUDED.notes, updated_at = NOW();

CREATE OR REPLACE FUNCTION public.platform_list_tenants(
  p_search TEXT DEFAULT NULL, p_status TEXT DEFAULT NULL, p_billing_status TEXT DEFAULT NULL,
  p_plan_key TEXT DEFAULT NULL, p_limit INTEGER DEFAULT 50, p_offset INTEGER DEFAULT 0
)
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_result JSONB;
BEGIN
  PERFORM public.platform_assert_capability('tenants.read');
  SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x."createdAt" DESC), '[]'::jsonb) INTO v_result
  FROM (
    SELECT pt.id, pt.tenant_id AS "tenantId", pt.tenant_name AS "tenantName", pt.legal_name AS "legalName",
      pt.slug, pt.status, pt.lifecycle_status AS "lifecycleStatus", pt.billing_status AS "billingStatus",
      pt.plan_key AS "planKey", pt.trial_ends_at AS "trialEndsAt", pt.created_at AS "createdAt",
      pt.updated_at AS "updatedAt", COALESCE(tes.mode, 'unclassified') AS "environmentMode",
      COALESCE(tes.is_pilot_tenant, false) AS "isPilotTenant",
      (EXISTS (SELECT 1 FROM public.demo_data_sets ds WHERE ds.tenant_id = pt.tenant_id AND ds.is_synthetic) OR pt.tenant_id IN (
        'a0000000-0000-4000-8000-000000000001'::uuid,
        '11111111-1111-1111-1111-111111111101'::uuid,
        '11111111-1111-1111-1111-111111111102'::uuid,
        '11111111-1111-1111-1111-111111111103'::uuid
      )) AS "isSynthetic", tes.notes AS "environmentNotes",
      (SELECT COUNT(*)::integer FROM public.platform_tenant_modules m
       WHERE m.tenant_id = pt.tenant_id AND m.status IN ('enabled', 'beta_enabled', 'trial')) AS "activeModuleCount"
    FROM public.platform_tenants pt
    LEFT JOIN public.tenant_environment_settings tes ON tes.tenant_id = pt.tenant_id
    WHERE (p_status IS NULL OR pt.status = p_status)
      AND (p_billing_status IS NULL OR pt.billing_status = p_billing_status)
      AND (p_plan_key IS NULL OR pt.plan_key = p_plan_key)
      AND (p_search IS NULL OR p_search = '' OR pt.tenant_name ILIKE '%' || p_search || '%'
        OR COALESCE(pt.slug, '') ILIKE '%' || p_search || '%'
        OR COALESCE(pt.primary_contact_email, '') ILIKE '%' || p_search || '%'
        OR pt.tenant_id::text ILIKE '%' || p_search || '%')
    ORDER BY pt.created_at DESC LIMIT GREATEST(1, LEAST(p_limit, 200)) OFFSET GREATEST(0, p_offset)
  ) x;
  RETURN jsonb_build_object('items', v_result, 'limit', p_limit, 'offset', p_offset);
END;
$$;

CREATE OR REPLACE FUNCTION public.platform_get_tenant_detail(p_tenant_id UUID)
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_tenant JSONB; v_modules JSONB; v_plan JSONB; v_discounts JSONB := '[]'; v_invoices JSONB := '[]'; v_payments JSONB := '[]';
BEGIN
  PERFORM public.platform_assert_capability('tenants.read');
  SELECT to_jsonb(pt) || jsonb_build_object(
    'environmentMode', COALESCE(tes.mode, 'unclassified'),
    'isPilotTenant', COALESCE(tes.is_pilot_tenant, false),
    'isSynthetic', EXISTS (SELECT 1 FROM public.demo_data_sets ds WHERE ds.tenant_id = pt.tenant_id AND ds.is_synthetic) OR pt.tenant_id IN (
      'a0000000-0000-4000-8000-000000000001'::uuid,
      '11111111-1111-1111-1111-111111111101'::uuid,
      '11111111-1111-1111-1111-111111111102'::uuid,
      '11111111-1111-1111-1111-111111111103'::uuid),
    'environmentNotes', tes.notes, 'providerSandboxOnly', COALESCE(tes.provider_sandbox_only, false)
  ) INTO v_tenant
  FROM public.platform_tenants pt
  LEFT JOIN public.tenant_environment_settings tes ON tes.tenant_id = pt.tenant_id
  WHERE pt.tenant_id = p_tenant_id;
  IF v_tenant IS NULL THEN RAISE EXCEPTION 'tenant_not_found' USING ERRCODE = 'P0002'; END IF;
  SELECT COALESCE(jsonb_agg(to_jsonb(m) ORDER BY m."moduleName"), '[]'::jsonb) INTO v_modules FROM (
    SELECT pm.module_key AS "moduleKey", pm.module_name AS "moduleName", COALESCE(ptm.status, 'disabled') AS status,
      ptm.is_trial AS "isTrial", ptm.trial_ends_at AS "trialEndsAt", ptm.manual_override AS "manualOverride"
    FROM public.platform_modules pm LEFT JOIN public.platform_tenant_modules ptm
      ON ptm.module_key = pm.module_key AND ptm.tenant_id = p_tenant_id
  ) m;
  SELECT to_jsonb(tp) INTO v_plan FROM public.platform_tenant_plans tp
  WHERE tp.tenant_id = p_tenant_id AND tp.status = 'active' ORDER BY tp.starts_at DESC LIMIT 1;
  IF public.platform_has_capability('discounts.read') THEN
    SELECT COALESCE(jsonb_agg(to_jsonb(d)), '[]') INTO v_discounts FROM public.platform_tenant_discounts d WHERE d.tenant_id = p_tenant_id;
  END IF;
  IF public.platform_has_capability('billing.read') THEN
    SELECT COALESCE(jsonb_agg(to_jsonb(i) ORDER BY i.created_at DESC), '[]') INTO v_invoices FROM
      (SELECT * FROM public.platform_invoices WHERE tenant_id = p_tenant_id ORDER BY created_at DESC LIMIT 20) i;
    SELECT COALESCE(jsonb_agg(to_jsonb(p) ORDER BY p.created_at DESC), '[]') INTO v_payments FROM
      (SELECT * FROM public.platform_payments WHERE tenant_id = p_tenant_id ORDER BY created_at DESC LIMIT 20) p;
  END IF;
  RETURN jsonb_build_object('tenant', v_tenant, 'modules', v_modules, 'plan', v_plan,
    'discounts', v_discounts, 'invoices', v_invoices, 'payments', v_payments);
END;
$$;

GRANT EXECUTE ON FUNCTION public.platform_list_tenants(TEXT, TEXT, TEXT, TEXT, INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.platform_get_tenant_detail(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.platform_update_tenant_record(
  p_tenant_id UUID, p_reason TEXT, p_legal_name TEXT DEFAULT NULL, p_slug TEXT DEFAULT NULL,
  p_primary_contact_name TEXT DEFAULT NULL, p_primary_contact_email TEXT DEFAULT NULL,
  p_primary_contact_phone TEXT DEFAULT NULL, p_billing_email TEXT DEFAULT NULL,
  p_support_email TEXT DEFAULT NULL, p_country TEXT DEFAULT 'DE',
  p_timezone TEXT DEFAULT 'Europe/Berlin', p_environment_mode TEXT DEFAULT NULL,
  p_environment_notes TEXT DEFAULT NULL
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_before JSONB; v_after JSONB;
BEGIN
  PERFORM public.platform_assert_capability('tenants.write');
  PERFORM public.platform_assert_reason(p_reason);
  IF p_environment_mode NOT IN ('production', 'pilot', 'demo', 'sandbox', 'internal_test') THEN
    RAISE EXCEPTION 'invalid_environment_mode' USING ERRCODE = '22023';
  END IF;
  SELECT to_jsonb(pt) INTO v_before FROM public.platform_tenants pt WHERE pt.tenant_id = p_tenant_id FOR UPDATE;
  IF v_before IS NULL THEN RAISE EXCEPTION 'tenant_not_found' USING ERRCODE = 'P0002'; END IF;
  UPDATE public.platform_tenants SET
    legal_name = NULLIF(BTRIM(p_legal_name), ''), slug = NULLIF(BTRIM(p_slug), ''),
    primary_contact_name = NULLIF(BTRIM(p_primary_contact_name), ''),
    primary_contact_email = NULLIF(BTRIM(p_primary_contact_email), ''),
    primary_contact_phone = NULLIF(BTRIM(p_primary_contact_phone), ''),
    billing_email = NULLIF(BTRIM(p_billing_email), ''), support_email = NULLIF(BTRIM(p_support_email), ''),
    country = COALESCE(NULLIF(UPPER(BTRIM(p_country)), ''), 'DE'),
    timezone = COALESCE(NULLIF(BTRIM(p_timezone), ''), 'Europe/Berlin'), updated_at = NOW()
  WHERE tenant_id = p_tenant_id;
  INSERT INTO public.tenant_environment_settings (
    tenant_id, mode, is_pilot_tenant, provider_sandbox_only, notes
  ) VALUES (
    p_tenant_id, p_environment_mode, p_environment_mode = 'pilot',
    p_environment_mode IN ('demo', 'sandbox', 'internal_test', 'pilot'), NULLIF(BTRIM(p_environment_notes), '')
  ) ON CONFLICT (tenant_id) DO UPDATE SET
    mode = EXCLUDED.mode, is_pilot_tenant = EXCLUDED.is_pilot_tenant,
    provider_sandbox_only = EXCLUDED.provider_sandbox_only, notes = EXCLUDED.notes, updated_at = NOW();
  SELECT to_jsonb(pt) || jsonb_build_object('environmentMode', tes.mode, 'environmentNotes', tes.notes)
  INTO v_after FROM public.platform_tenants pt JOIN public.tenant_environment_settings tes ON tes.tenant_id = pt.tenant_id
  WHERE pt.tenant_id = p_tenant_id;
  PERFORM public.platform_write_audit_log('tenant.record_updated', 'platform_tenant', (v_before->>'id')::uuid,
    p_tenant_id, v_before, v_after, p_reason);
  RETURN v_after;
END;
$$;

GRANT EXECUTE ON FUNCTION public.platform_update_tenant_record(
  UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT
) TO authenticated;

NOTIFY pgrst, 'reload schema';
