-- ==========================================================================
-- CareSuite+ — Migration 0254: PLATFORM.2.0A Foundation
-- Plans/Versions, Subscriptions, Add-ons, Entitlements, Credits, Billing Preview
-- Additive only — extends 0246 platform console foundation.
-- ==========================================================================

-- --------------------------------------------------------------------------
-- Helpers
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.platform_assert_capability(p_capability TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.platform_has_capability(p_capability) THEN
    RAISE EXCEPTION 'platform_forbidden' USING ERRCODE = '42501';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.platform_assert_reason(p_reason TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_reason IS NULL OR length(trim(p_reason)) < 3 THEN
    RAISE EXCEPTION 'reason_required' USING ERRCODE = '22023';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.platform_assert_capability(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.platform_assert_reason(TEXT) FROM PUBLIC;

-- --------------------------------------------------------------------------
-- Plan versions / modules / limits
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.platform_plan_versions (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_key              TEXT NOT NULL REFERENCES public.platform_plans(plan_key) ON DELETE CASCADE,
  version_number        INTEGER NOT NULL,
  effective_from        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  effective_until       TIMESTAMPTZ,
  monthly_price_cents   INTEGER NOT NULL DEFAULT 0,
  yearly_price_cents    INTEGER NOT NULL DEFAULT 0,
  currency              TEXT NOT NULL DEFAULT 'EUR',
  status                TEXT NOT NULL DEFAULT 'active',
  change_reason         TEXT,
  created_by            UUID,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (plan_key, version_number),
  CONSTRAINT platform_plan_versions_status_check CHECK (
    status IN ('draft', 'active', 'superseded', 'archived')
  )
);

CREATE INDEX IF NOT EXISTS idx_platform_plan_versions_plan
  ON public.platform_plan_versions (plan_key, effective_from DESC);

CREATE TABLE IF NOT EXISTS public.platform_plan_modules (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_version_id   UUID NOT NULL REFERENCES public.platform_plan_versions(id) ON DELETE CASCADE,
  module_key        TEXT NOT NULL REFERENCES public.platform_modules(module_key) ON DELETE RESTRICT,
  access_state      TEXT NOT NULL DEFAULT 'active',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (plan_version_id, module_key),
  CONSTRAINT platform_plan_modules_state_check CHECK (
    access_state IN ('active', 'beta', 'coming_soon', 'disabled', 'internal')
  )
);

CREATE INDEX IF NOT EXISTS idx_platform_plan_modules_version
  ON public.platform_plan_modules (plan_version_id);

CREATE TABLE IF NOT EXISTS public.platform_plan_limits (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_version_id   UUID NOT NULL REFERENCES public.platform_plan_versions(id) ON DELETE CASCADE,
  limit_key         TEXT NOT NULL,
  limit_value       INTEGER NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (plan_version_id, limit_key)
);

-- --------------------------------------------------------------------------
-- Subscriptions
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.platform_tenant_subscriptions (
  id                            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                     UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  plan_key                      TEXT NOT NULL REFERENCES public.platform_plans(plan_key) ON DELETE RESTRICT,
  plan_version_id               UUID REFERENCES public.platform_plan_versions(id) ON DELETE SET NULL,
  status                        TEXT NOT NULL DEFAULT 'active',
  billing_interval              TEXT NOT NULL DEFAULT 'monthly',
  price_override_monthly_cents  INTEGER,
  price_override_yearly_cents   INTEGER,
  currency                      TEXT NOT NULL DEFAULT 'EUR',
  starts_at                     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ends_at                       TIMESTAMPTZ,
  suspended_at                  TIMESTAMPTZ,
  cancelled_at                  TIMESTAMPTZ,
  assigned_by                   UUID,
  created_at                    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT platform_tenant_subscriptions_status_check CHECK (
    status IN ('active', 'scheduled', 'suspended', 'cancelled', 'expired')
  ),
  CONSTRAINT platform_tenant_subscriptions_interval_check CHECK (
    billing_interval IN ('monthly', 'yearly')
  )
);

CREATE INDEX IF NOT EXISTS idx_platform_tenant_subscriptions_tenant
  ON public.platform_tenant_subscriptions (tenant_id, status);

CREATE TABLE IF NOT EXISTS public.platform_subscription_events (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id   UUID NOT NULL REFERENCES public.platform_tenant_subscriptions(id) ON DELETE CASCADE,
  tenant_id         UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  event_type        TEXT NOT NULL,
  payload           JSONB NOT NULL DEFAULT '{}'::jsonb,
  actor_user_id     UUID,
  reason            TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_platform_subscription_events_sub
  ON public.platform_subscription_events (subscription_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.platform_subscription_scheduled_changes (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id   UUID NOT NULL REFERENCES public.platform_tenant_subscriptions(id) ON DELETE CASCADE,
  tenant_id         UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  change_type       TEXT NOT NULL,
  target_plan_key   TEXT REFERENCES public.platform_plans(plan_key) ON DELETE RESTRICT,
  target_plan_version_id UUID REFERENCES public.platform_plan_versions(id) ON DELETE SET NULL,
  effective_at      TIMESTAMPTZ NOT NULL,
  status            TEXT NOT NULL DEFAULT 'pending',
  payload           JSONB NOT NULL DEFAULT '{}'::jsonb,
  reason            TEXT NOT NULL,
  created_by        UUID,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  applied_at        TIMESTAMPTZ,
  CONSTRAINT platform_subscription_scheduled_changes_status_check CHECK (
    status IN ('pending', 'applied', 'cancelled')
  )
);

-- --------------------------------------------------------------------------
-- Add-ons
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.platform_addons (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  addon_key       TEXT NOT NULL UNIQUE,
  addon_name      TEXT NOT NULL,
  description     TEXT,
  status          TEXT NOT NULL DEFAULT 'active',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT platform_addons_status_check CHECK (
    status IN ('active', 'beta', 'deprecated', 'disabled')
  )
);

CREATE TABLE IF NOT EXISTS public.platform_addon_versions (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  addon_key             TEXT NOT NULL REFERENCES public.platform_addons(addon_key) ON DELETE CASCADE,
  version_number        INTEGER NOT NULL,
  monthly_price_cents   INTEGER NOT NULL DEFAULT 0,
  yearly_price_cents    INTEGER NOT NULL DEFAULT 0,
  currency              TEXT NOT NULL DEFAULT 'EUR',
  effective_from        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  effective_until       TIMESTAMPTZ,
  status                TEXT NOT NULL DEFAULT 'active',
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (addon_key, version_number)
);

CREATE TABLE IF NOT EXISTS public.platform_addon_entitlements (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  addon_version_id  UUID NOT NULL REFERENCES public.platform_addon_versions(id) ON DELETE CASCADE,
  module_key        TEXT REFERENCES public.platform_modules(module_key) ON DELETE RESTRICT,
  entitlement_key   TEXT NOT NULL,
  entitlement_value JSONB NOT NULL DEFAULT 'true'::jsonb,
  access_state      TEXT NOT NULL DEFAULT 'active',
  UNIQUE (addon_version_id, entitlement_key),
  CONSTRAINT platform_addon_entitlements_state_check CHECK (
    access_state IN ('active', 'beta', 'coming_soon', 'disabled', 'internal')
  )
);

CREATE TABLE IF NOT EXISTS public.platform_tenant_addons (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  addon_key             TEXT NOT NULL REFERENCES public.platform_addons(addon_key) ON DELETE RESTRICT,
  addon_version_id      UUID REFERENCES public.platform_addon_versions(id) ON DELETE SET NULL,
  status                TEXT NOT NULL DEFAULT 'active',
  billing_interval      TEXT NOT NULL DEFAULT 'monthly',
  price_override_cents  INTEGER,
  starts_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ends_at               TIMESTAMPTZ,
  assigned_by           UUID,
  reason                TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, addon_key),
  CONSTRAINT platform_tenant_addons_status_check CHECK (
    status IN ('active', 'scheduled', 'cancelled', 'expired')
  )
);

CREATE TABLE IF NOT EXISTS public.platform_tenant_addon_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_addon_id UUID NOT NULL REFERENCES public.platform_tenant_addons(id) ON DELETE CASCADE,
  tenant_id       UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  event_type      TEXT NOT NULL,
  payload         JSONB NOT NULL DEFAULT '{}'::jsonb,
  actor_user_id   UUID,
  reason          TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- --------------------------------------------------------------------------
-- Entitlements
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.platform_tenant_entitlements (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  entitlement_key   TEXT NOT NULL,
  entitlement_type  TEXT NOT NULL DEFAULT 'module',
  module_key        TEXT REFERENCES public.platform_modules(module_key) ON DELETE RESTRICT,
  access_state      TEXT NOT NULL DEFAULT 'active',
  source_type       TEXT NOT NULL,
  source_id         UUID,
  limit_value       INTEGER,
  metadata          JSONB NOT NULL DEFAULT '{}'::jsonb,
  effective_from    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  effective_until   TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, entitlement_key),
  CONSTRAINT platform_tenant_entitlements_state_check CHECK (
    access_state IN ('active', 'beta', 'coming_soon', 'disabled', 'internal')
  ),
  CONSTRAINT platform_tenant_entitlements_source_check CHECK (
    source_type IN ('plan', 'addon', 'manual', 'beta', 'override')
  )
);

CREATE INDEX IF NOT EXISTS idx_platform_tenant_entitlements_tenant
  ON public.platform_tenant_entitlements (tenant_id, entitlement_key);

CREATE TABLE IF NOT EXISTS public.platform_entitlement_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  entitlement_id  UUID REFERENCES public.platform_tenant_entitlements(id) ON DELETE SET NULL,
  event_type      TEXT NOT NULL,
  payload         JSONB NOT NULL DEFAULT '{}'::jsonb,
  actor_user_id   UUID,
  reason          TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- --------------------------------------------------------------------------
-- Credits
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.platform_tenant_credits (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE UNIQUE,
  balance_cents   INTEGER NOT NULL DEFAULT 0,
  currency        TEXT NOT NULL DEFAULT 'EUR',
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT platform_tenant_credits_balance_nonneg CHECK (balance_cents >= 0)
);

CREATE TABLE IF NOT EXISTS public.platform_credit_ledger (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  entry_type      TEXT NOT NULL,
  amount_cents    INTEGER NOT NULL,
  balance_after   INTEGER NOT NULL,
  currency        TEXT NOT NULL DEFAULT 'EUR',
  reference_type  TEXT,
  reference_id    UUID,
  reason          TEXT NOT NULL,
  actor_user_id   UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT platform_credit_ledger_type_check CHECK (
    entry_type IN ('credit', 'debit', 'adjustment', 'preview_apply', 'refund')
  )
);

CREATE INDEX IF NOT EXISTS idx_platform_credit_ledger_tenant
  ON public.platform_credit_ledger (tenant_id, created_at DESC);

-- --------------------------------------------------------------------------
-- Billing preview
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.platform_invoice_previews (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  period_start      DATE NOT NULL,
  period_end        DATE NOT NULL,
  subtotal_cents    INTEGER NOT NULL DEFAULT 0,
  discount_cents    INTEGER NOT NULL DEFAULT 0,
  credit_cents      INTEGER NOT NULL DEFAULT 0,
  tax_cents         INTEGER NOT NULL DEFAULT 0,
  total_cents       INTEGER NOT NULL DEFAULT 0,
  currency          TEXT NOT NULL DEFAULT 'EUR',
  status            TEXT NOT NULL DEFAULT 'draft',
  metadata          JSONB NOT NULL DEFAULT '{}'::jsonb,
  generated_by      UUID,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT platform_invoice_previews_status_check CHECK (
    status IN ('draft', 'superseded', 'finalized')
  ),
  CONSTRAINT platform_invoice_previews_total_nonneg CHECK (total_cents >= 0)
);

CREATE TABLE IF NOT EXISTS public.platform_invoice_preview_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  preview_id      UUID NOT NULL REFERENCES public.platform_invoice_previews(id) ON DELETE CASCADE,
  line_type       TEXT NOT NULL,
  description     TEXT NOT NULL,
  quantity        NUMERIC NOT NULL DEFAULT 1,
  unit_cents      INTEGER NOT NULL DEFAULT 0,
  amount_cents    INTEGER NOT NULL DEFAULT 0,
  metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT platform_invoice_preview_items_type_check CHECK (
    line_type IN ('plan', 'addon', 'usage', 'discount', 'credit', 'tax', 'adjustment')
  )
);

CREATE INDEX IF NOT EXISTS idx_platform_invoice_preview_items_preview
  ON public.platform_invoice_preview_items (preview_id, sort_order);

-- --------------------------------------------------------------------------
-- Resolve effective plan version
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.platform_resolve_effective_plan_version(
  p_plan_key TEXT,
  p_at TIMESTAMPTZ DEFAULT NOW()
)
RETURNS UUID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  SELECT pv.id INTO v_id
  FROM public.platform_plan_versions pv
  WHERE pv.plan_key = p_plan_key
    AND pv.status = 'active'
    AND pv.effective_from <= p_at
    AND (pv.effective_until IS NULL OR pv.effective_until > p_at)
  ORDER BY pv.version_number DESC
  LIMIT 1;

  RETURN v_id;
END;
$$;

-- --------------------------------------------------------------------------
-- RPC: Plans
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.platform_create_plan(
  p_plan_key TEXT,
  p_plan_name TEXT,
  p_reason TEXT,
  p_description TEXT DEFAULT NULL,
  p_monthly_price_cents INTEGER DEFAULT 0,
  p_yearly_price_cents INTEGER DEFAULT 0,
  p_currency TEXT DEFAULT 'EUR',
  p_is_public BOOLEAN DEFAULT FALSE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.platform_plans%ROWTYPE;
  v_version_id UUID;
BEGIN
  PERFORM public.platform_assert_capability('plans.write');
  PERFORM public.platform_assert_reason(p_reason);

  INSERT INTO public.platform_plans (
    plan_key, plan_name, description, monthly_price_cents, yearly_price_cents,
    currency, is_public, status
  ) VALUES (
    p_plan_key, p_plan_name, p_description, p_monthly_price_cents, p_yearly_price_cents,
    p_currency, p_is_public, 'active'
  )
  RETURNING * INTO v_row;

  INSERT INTO public.platform_plan_versions (
    plan_key, version_number, monthly_price_cents, yearly_price_cents, currency,
    status, change_reason, created_by
  ) VALUES (
    p_plan_key, 1, p_monthly_price_cents, p_yearly_price_cents, p_currency,
    'active', p_reason, auth.uid()
  )
  RETURNING id INTO v_version_id;

  PERFORM public.platform_write_audit_log(
    'plan.created', 'platform_plan', v_row.id, NULL,
    NULL, row_to_json(v_row)::jsonb, p_reason
  );

  RETURN jsonb_build_object('plan', row_to_json(v_row)::jsonb, 'initialVersionId', v_version_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.platform_update_plan(
  p_plan_key TEXT,
  p_reason TEXT,
  p_plan_name TEXT DEFAULT NULL,
  p_description TEXT DEFAULT NULL,
  p_is_public BOOLEAN DEFAULT NULL,
  p_status TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_before JSONB;
  v_after JSONB;
BEGIN
  PERFORM public.platform_assert_capability('plans.write');
  PERFORM public.platform_assert_reason(p_reason);

  SELECT row_to_json(p)::jsonb INTO v_before
  FROM public.platform_plans p WHERE p.plan_key = p_plan_key;
  IF v_before IS NULL THEN
    RAISE EXCEPTION 'plan_not_found' USING ERRCODE = 'P0002';
  END IF;

  UPDATE public.platform_plans SET
    plan_name = COALESCE(p_plan_name, plan_name),
    description = COALESCE(p_description, description),
    is_public = COALESCE(p_is_public, is_public),
    status = COALESCE(p_status, status),
    updated_at = NOW()
  WHERE plan_key = p_plan_key;

  SELECT row_to_json(p)::jsonb INTO v_after
  FROM public.platform_plans p WHERE p.plan_key = p_plan_key;

  PERFORM public.platform_write_audit_log(
    'plan.updated', 'platform_plan', (v_after->>'id')::uuid, NULL,
    v_before, v_after, p_reason
  );

  RETURN v_after;
END;
$$;

CREATE OR REPLACE FUNCTION public.platform_create_plan_version(
  p_plan_key TEXT,
  p_reason TEXT,
  p_monthly_price_cents INTEGER,
  p_yearly_price_cents INTEGER,
  p_effective_from TIMESTAMPTZ DEFAULT NOW()
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_next INTEGER;
  v_new public.platform_plan_versions%ROWTYPE;
BEGIN
  PERFORM public.platform_assert_capability('plans.write');
  PERFORM public.platform_assert_reason(p_reason);

  IF NOT EXISTS (SELECT 1 FROM public.platform_plans WHERE plan_key = p_plan_key) THEN
    RAISE EXCEPTION 'plan_not_found' USING ERRCODE = 'P0002';
  END IF;

  SELECT COALESCE(MAX(version_number), 0) + 1 INTO v_next
  FROM public.platform_plan_versions WHERE plan_key = p_plan_key;

  UPDATE public.platform_plan_versions
  SET status = 'superseded', effective_until = p_effective_from, updated_at = NOW()
  WHERE plan_key = p_plan_key AND status = 'active';

  INSERT INTO public.platform_plan_versions (
    plan_key, version_number, effective_from, monthly_price_cents, yearly_price_cents,
    status, change_reason, created_by
  ) VALUES (
    p_plan_key, v_next, p_effective_from, p_monthly_price_cents, p_yearly_price_cents,
    'active', p_reason, auth.uid()
  )
  RETURNING * INTO v_new;

  UPDATE public.platform_plans SET
    monthly_price_cents = p_monthly_price_cents,
    yearly_price_cents = p_yearly_price_cents,
    updated_at = NOW()
  WHERE plan_key = p_plan_key;

  PERFORM public.platform_write_audit_log(
    'plan.version_created', 'platform_plan_version', v_new.id, NULL,
    NULL, row_to_json(v_new)::jsonb, p_reason
  );

  RETURN row_to_json(v_new)::jsonb;
END;
$$;

CREATE OR REPLACE FUNCTION public.platform_assign_plan_module(
  p_plan_version_id UUID,
  p_module_key TEXT,
  p_access_state TEXT,
  p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_after JSONB;
BEGIN
  PERFORM public.platform_assert_capability('plans.write');
  PERFORM public.platform_assert_reason(p_reason);

  INSERT INTO public.platform_plan_modules (plan_version_id, module_key, access_state)
  VALUES (p_plan_version_id, p_module_key, p_access_state)
  ON CONFLICT (plan_version_id, module_key) DO UPDATE SET access_state = EXCLUDED.access_state
  RETURNING row_to_json(platform_plan_modules)::jsonb INTO v_after;

  PERFORM public.platform_write_audit_log(
    'plan.module_assigned', 'platform_plan_module', (v_after->>'id')::uuid, NULL,
    NULL, v_after, p_reason
  );

  RETURN v_after;
END;
$$;

CREATE OR REPLACE FUNCTION public.platform_remove_plan_module(
  p_plan_version_id UUID,
  p_module_key TEXT,
  p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_before JSONB;
BEGIN
  PERFORM public.platform_assert_capability('plans.write');
  PERFORM public.platform_assert_reason(p_reason);

  SELECT row_to_json(pm)::jsonb INTO v_before
  FROM public.platform_plan_modules pm
  WHERE pm.plan_version_id = p_plan_version_id AND pm.module_key = p_module_key;

  DELETE FROM public.platform_plan_modules
  WHERE plan_version_id = p_plan_version_id AND module_key = p_module_key;

  PERFORM public.platform_write_audit_log(
    'plan.module_removed', 'platform_plan_module', NULL, NULL,
    v_before, NULL, p_reason
  );

  RETURN jsonb_build_object('removed', v_before IS NOT NULL);
END;
$$;

CREATE OR REPLACE FUNCTION public.platform_set_plan_limit(
  p_plan_version_id UUID,
  p_limit_key TEXT,
  p_limit_value INTEGER,
  p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_after JSONB;
BEGIN
  PERFORM public.platform_assert_capability('plans.write');
  PERFORM public.platform_assert_reason(p_reason);

  INSERT INTO public.platform_plan_limits (plan_version_id, limit_key, limit_value)
  VALUES (p_plan_version_id, p_limit_key, p_limit_value)
  ON CONFLICT (plan_version_id, limit_key) DO UPDATE SET limit_value = EXCLUDED.limit_value
  RETURNING row_to_json(platform_plan_limits)::jsonb INTO v_after;

  PERFORM public.platform_write_audit_log(
    'plan.limit_set', 'platform_plan_limit', (v_after->>'id')::uuid, NULL,
    NULL, v_after, p_reason
  );

  RETURN v_after;
END;
$$;

-- --------------------------------------------------------------------------
-- RPC: Subscriptions
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.platform_assign_plan_to_tenant(
  p_tenant_id UUID,
  p_plan_key TEXT,
  p_reason TEXT,
  p_billing_interval TEXT DEFAULT 'monthly',
  p_custom_monthly_cents INTEGER DEFAULT NULL,
  p_custom_yearly_cents INTEGER DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan public.platform_plans%ROWTYPE;
  v_version_id UUID;
  v_sub public.platform_tenant_subscriptions%ROWTYPE;
  v_legacy JSONB;
BEGIN
  PERFORM public.platform_assert_capability('plans.write');
  PERFORM public.platform_assert_reason(p_reason);

  SELECT * INTO v_plan FROM public.platform_plans WHERE plan_key = p_plan_key;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'plan_not_found' USING ERRCODE = 'P0002';
  END IF;

  v_version_id := public.platform_resolve_effective_plan_version(p_plan_key);

  UPDATE public.platform_tenant_subscriptions
  SET status = 'cancelled', cancelled_at = NOW(), updated_at = NOW()
  WHERE tenant_id = p_tenant_id AND status IN ('active', 'scheduled', 'suspended');

  INSERT INTO public.platform_tenant_subscriptions (
    tenant_id, plan_key, plan_version_id, status, billing_interval,
    price_override_monthly_cents, price_override_yearly_cents, currency, assigned_by
  ) VALUES (
    p_tenant_id, p_plan_key, v_version_id, 'active', p_billing_interval,
    p_custom_monthly_cents, p_custom_yearly_cents, v_plan.currency, auth.uid()
  )
  RETURNING * INTO v_sub;

  INSERT INTO public.platform_subscription_events (
    subscription_id, tenant_id, event_type, payload, actor_user_id, reason
  ) VALUES (
    v_sub.id, p_tenant_id, 'assigned',
    jsonb_build_object('planKey', p_plan_key, 'planVersionId', v_version_id),
    auth.uid(), p_reason
  );

  v_legacy := public.platform_assign_plan(
    p_tenant_id, p_plan_key, p_reason, p_billing_interval, p_custom_monthly_cents
  );

  PERFORM public.platform_recalculate_tenant_entitlements(p_tenant_id, p_reason);

  PERFORM public.platform_write_audit_log(
    'subscription.assigned', 'platform_tenant_subscription', v_sub.id, p_tenant_id,
    NULL, row_to_json(v_sub)::jsonb, p_reason
  );

  RETURN jsonb_build_object('subscription', row_to_json(v_sub)::jsonb, 'legacyPlan', v_legacy);
END;
$$;

CREATE OR REPLACE FUNCTION public.platform_schedule_plan_change(
  p_tenant_id UUID,
  p_target_plan_key TEXT,
  p_effective_at TIMESTAMPTZ,
  p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sub_id UUID;
  v_row public.platform_subscription_scheduled_changes%ROWTYPE;
BEGIN
  PERFORM public.platform_assert_capability('plans.write');
  PERFORM public.platform_assert_reason(p_reason);

  SELECT id INTO v_sub_id
  FROM public.platform_tenant_subscriptions
  WHERE tenant_id = p_tenant_id AND status = 'active'
  ORDER BY created_at DESC LIMIT 1;

  IF v_sub_id IS NULL THEN
    RAISE EXCEPTION 'subscription_not_found' USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO public.platform_subscription_scheduled_changes (
    subscription_id, tenant_id, change_type, target_plan_key, effective_at, reason, created_by
  ) VALUES (
    v_sub_id, p_tenant_id, 'plan_change', p_target_plan_key, p_effective_at, p_reason, auth.uid()
  )
  RETURNING * INTO v_row;

  PERFORM public.platform_write_audit_log(
    'subscription.change_scheduled', 'platform_subscription_scheduled_change', v_row.id, p_tenant_id,
    NULL, row_to_json(v_row)::jsonb, p_reason
  );

  RETURN row_to_json(v_row)::jsonb;
END;
$$;

CREATE OR REPLACE FUNCTION public.platform_suspend_subscription(
  p_tenant_id UUID,
  p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sub public.platform_tenant_subscriptions%ROWTYPE;
  v_before JSONB;
BEGIN
  PERFORM public.platform_assert_capability('plans.write');
  PERFORM public.platform_assert_reason(p_reason);

  SELECT * INTO v_sub FROM public.platform_tenant_subscriptions
  WHERE tenant_id = p_tenant_id AND status = 'active'
  ORDER BY created_at DESC LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'subscription_not_found' USING ERRCODE = 'P0002';
  END IF;

  v_before := row_to_json(v_sub)::jsonb;

  UPDATE public.platform_tenant_subscriptions
  SET status = 'suspended', suspended_at = NOW(), updated_at = NOW()
  WHERE id = v_sub.id
  RETURNING * INTO v_sub;

  INSERT INTO public.platform_subscription_events (
    subscription_id, tenant_id, event_type, payload, actor_user_id, reason
  ) VALUES (v_sub.id, p_tenant_id, 'suspended', '{}'::jsonb, auth.uid(), p_reason);

  PERFORM public.platform_recalculate_tenant_entitlements(p_tenant_id, p_reason);

  PERFORM public.platform_write_audit_log(
    'subscription.suspended', 'platform_tenant_subscription', v_sub.id, p_tenant_id,
    v_before, row_to_json(v_sub)::jsonb, p_reason
  );

  RETURN row_to_json(v_sub)::jsonb;
END;
$$;

CREATE OR REPLACE FUNCTION public.platform_reactivate_subscription(
  p_tenant_id UUID,
  p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sub public.platform_tenant_subscriptions%ROWTYPE;
  v_before JSONB;
BEGIN
  PERFORM public.platform_assert_capability('plans.write');
  PERFORM public.platform_assert_reason(p_reason);

  SELECT * INTO v_sub FROM public.platform_tenant_subscriptions
  WHERE tenant_id = p_tenant_id AND status = 'suspended'
  ORDER BY created_at DESC LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'subscription_not_found' USING ERRCODE = 'P0002';
  END IF;

  v_before := row_to_json(v_sub)::jsonb;

  UPDATE public.platform_tenant_subscriptions
  SET status = 'active', suspended_at = NULL, updated_at = NOW()
  WHERE id = v_sub.id
  RETURNING * INTO v_sub;

  INSERT INTO public.platform_subscription_events (
    subscription_id, tenant_id, event_type, payload, actor_user_id, reason
  ) VALUES (v_sub.id, p_tenant_id, 'reactivated', '{}'::jsonb, auth.uid(), p_reason);

  PERFORM public.platform_recalculate_tenant_entitlements(p_tenant_id, p_reason);

  PERFORM public.platform_write_audit_log(
    'subscription.reactivated', 'platform_tenant_subscription', v_sub.id, p_tenant_id,
    v_before, row_to_json(v_sub)::jsonb, p_reason
  );

  RETURN row_to_json(v_sub)::jsonb;
END;
$$;

CREATE OR REPLACE FUNCTION public.platform_cancel_subscription(
  p_tenant_id UUID,
  p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sub public.platform_tenant_subscriptions%ROWTYPE;
  v_before JSONB;
BEGIN
  PERFORM public.platform_assert_capability('plans.write');
  PERFORM public.platform_assert_reason(p_reason);

  SELECT * INTO v_sub FROM public.platform_tenant_subscriptions
  WHERE tenant_id = p_tenant_id AND status IN ('active', 'suspended', 'scheduled')
  ORDER BY created_at DESC LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'subscription_not_found' USING ERRCODE = 'P0002';
  END IF;

  v_before := row_to_json(v_sub)::jsonb;

  UPDATE public.platform_tenant_subscriptions
  SET status = 'cancelled', cancelled_at = NOW(), updated_at = NOW()
  WHERE id = v_sub.id
  RETURNING * INTO v_sub;

  INSERT INTO public.platform_subscription_events (
    subscription_id, tenant_id, event_type, payload, actor_user_id, reason
  ) VALUES (v_sub.id, p_tenant_id, 'cancelled', '{}'::jsonb, auth.uid(), p_reason);

  PERFORM public.platform_recalculate_tenant_entitlements(p_tenant_id, p_reason);

  PERFORM public.platform_write_audit_log(
    'subscription.cancelled', 'platform_tenant_subscription', v_sub.id, p_tenant_id,
    v_before, row_to_json(v_sub)::jsonb, p_reason
  );

  RETURN row_to_json(v_sub)::jsonb;
END;
$$;

-- --------------------------------------------------------------------------
-- RPC: Add-ons
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.platform_create_addon(
  p_addon_key TEXT,
  p_addon_name TEXT,
  p_reason TEXT,
  p_description TEXT DEFAULT NULL,
  p_monthly_price_cents INTEGER DEFAULT 0,
  p_yearly_price_cents INTEGER DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_addon public.platform_addons%ROWTYPE;
  v_version_id UUID;
BEGIN
  PERFORM public.platform_assert_capability('plans.write');
  PERFORM public.platform_assert_reason(p_reason);

  INSERT INTO public.platform_addons (addon_key, addon_name, description)
  VALUES (p_addon_key, p_addon_name, p_description)
  RETURNING * INTO v_addon;

  INSERT INTO public.platform_addon_versions (
    addon_key, version_number, monthly_price_cents, yearly_price_cents
  ) VALUES (p_addon_key, 1, p_monthly_price_cents, p_yearly_price_cents)
  RETURNING id INTO v_version_id;

  PERFORM public.platform_write_audit_log(
    'addon.created', 'platform_addon', v_addon.id, NULL,
    NULL, row_to_json(v_addon)::jsonb, p_reason
  );

  RETURN jsonb_build_object('addon', row_to_json(v_addon)::jsonb, 'initialVersionId', v_version_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.platform_update_addon(
  p_addon_key TEXT,
  p_reason TEXT,
  p_addon_name TEXT DEFAULT NULL,
  p_description TEXT DEFAULT NULL,
  p_status TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_before JSONB;
  v_after JSONB;
BEGIN
  PERFORM public.platform_assert_capability('plans.write');
  PERFORM public.platform_assert_reason(p_reason);

  SELECT row_to_json(a)::jsonb INTO v_before FROM public.platform_addons a WHERE a.addon_key = p_addon_key;
  IF v_before IS NULL THEN
    RAISE EXCEPTION 'addon_not_found' USING ERRCODE = 'P0002';
  END IF;

  UPDATE public.platform_addons SET
    addon_name = COALESCE(p_addon_name, addon_name),
    description = COALESCE(p_description, description),
    status = COALESCE(p_status, status),
    updated_at = NOW()
  WHERE addon_key = p_addon_key;

  SELECT row_to_json(a)::jsonb INTO v_after FROM public.platform_addons a WHERE a.addon_key = p_addon_key;

  PERFORM public.platform_write_audit_log(
    'addon.updated', 'platform_addon', (v_after->>'id')::uuid, NULL,
    v_before, v_after, p_reason
  );

  RETURN v_after;
END;
$$;

CREATE OR REPLACE FUNCTION public.platform_create_addon_version(
  p_addon_key TEXT,
  p_reason TEXT,
  p_monthly_price_cents INTEGER,
  p_yearly_price_cents INTEGER,
  p_effective_from TIMESTAMPTZ DEFAULT NOW()
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_next INTEGER;
  v_new public.platform_addon_versions%ROWTYPE;
BEGIN
  PERFORM public.platform_assert_capability('plans.write');
  PERFORM public.platform_assert_reason(p_reason);

  SELECT COALESCE(MAX(version_number), 0) + 1 INTO v_next
  FROM public.platform_addon_versions WHERE addon_key = p_addon_key;

  UPDATE public.platform_addon_versions
  SET status = 'superseded', effective_until = p_effective_from
  WHERE addon_key = p_addon_key AND status = 'active';

  INSERT INTO public.platform_addon_versions (
    addon_key, version_number, monthly_price_cents, yearly_price_cents, effective_from
  ) VALUES (
    p_addon_key, v_next, p_monthly_price_cents, p_yearly_price_cents, p_effective_from
  )
  RETURNING * INTO v_new;

  PERFORM public.platform_write_audit_log(
    'addon.version_created', 'platform_addon_version', v_new.id, NULL,
    NULL, row_to_json(v_new)::jsonb, p_reason
  );

  RETURN row_to_json(v_new)::jsonb;
END;
$$;

CREATE OR REPLACE FUNCTION public.platform_assign_addon_to_tenant(
  p_tenant_id UUID,
  p_addon_key TEXT,
  p_reason TEXT,
  p_billing_interval TEXT DEFAULT 'monthly',
  p_price_override_cents INTEGER DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_version_id UUID;
  v_row public.platform_tenant_addons%ROWTYPE;
BEGIN
  PERFORM public.platform_assert_capability('plans.write');
  PERFORM public.platform_assert_reason(p_reason);

  SELECT av.id INTO v_version_id
  FROM public.platform_addon_versions av
  WHERE av.addon_key = p_addon_key AND av.status = 'active'
  ORDER BY av.version_number DESC LIMIT 1;

  INSERT INTO public.platform_tenant_addons (
    tenant_id, addon_key, addon_version_id, status, billing_interval,
    price_override_cents, assigned_by, reason
  ) VALUES (
    p_tenant_id, p_addon_key, v_version_id, 'active', p_billing_interval,
    p_price_override_cents, auth.uid(), p_reason
  )
  ON CONFLICT (tenant_id, addon_key) DO UPDATE SET
    addon_version_id = EXCLUDED.addon_version_id,
    status = 'active',
    billing_interval = EXCLUDED.billing_interval,
    price_override_cents = EXCLUDED.price_override_cents,
    reason = EXCLUDED.reason,
    updated_at = NOW()
  RETURNING * INTO v_row;

  INSERT INTO public.platform_tenant_addon_events (
    tenant_addon_id, tenant_id, event_type, payload, actor_user_id, reason
  ) VALUES (
    v_row.id, p_tenant_id, 'assigned',
    jsonb_build_object('addonKey', p_addon_key), auth.uid(), p_reason
  );

  PERFORM public.platform_recalculate_tenant_entitlements(p_tenant_id, p_reason);

  PERFORM public.platform_write_audit_log(
    'addon.assigned', 'platform_tenant_addon', v_row.id, p_tenant_id,
    NULL, row_to_json(v_row)::jsonb, p_reason
  );

  RETURN row_to_json(v_row)::jsonb;
END;
$$;

CREATE OR REPLACE FUNCTION public.platform_remove_addon_from_tenant(
  p_tenant_id UUID,
  p_addon_key TEXT,
  p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_before JSONB;
BEGIN
  PERFORM public.platform_assert_capability('plans.write');
  PERFORM public.platform_assert_reason(p_reason);

  SELECT row_to_json(ta)::jsonb INTO v_before
  FROM public.platform_tenant_addons ta
  WHERE ta.tenant_id = p_tenant_id AND ta.addon_key = p_addon_key;

  UPDATE public.platform_tenant_addons
  SET status = 'cancelled', ends_at = NOW(), updated_at = NOW()
  WHERE tenant_id = p_tenant_id AND addon_key = p_addon_key AND status = 'active';

  PERFORM public.platform_recalculate_tenant_entitlements(p_tenant_id, p_reason);

  PERFORM public.platform_write_audit_log(
    'addon.removed', 'platform_tenant_addon', NULL, p_tenant_id,
    v_before, NULL, p_reason
  );

  RETURN jsonb_build_object('removed', v_before IS NOT NULL);
END;
$$;

-- --------------------------------------------------------------------------
-- Entitlement recalculation + read
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.platform_recalculate_tenant_entitlements(
  p_tenant_id UUID,
  p_reason TEXT DEFAULT 'system_recalc'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sub public.platform_tenant_subscriptions%ROWTYPE;
  v_plan_version_id UUID;
  v_count INTEGER := 0;
  v_module RECORD;
  v_beta RECORD;
BEGIN
  IF public.is_platform_user() THEN
    PERFORM public.platform_assert_capability('plans.read');
  END IF;

  SELECT * INTO v_sub FROM public.platform_tenant_subscriptions
  WHERE tenant_id = p_tenant_id AND status IN ('active', 'suspended')
  ORDER BY created_at DESC LIMIT 1;

  IF FOUND AND v_sub.status = 'suspended' THEN
    DELETE FROM public.platform_tenant_entitlements
    WHERE tenant_id = p_tenant_id AND source_type IN ('plan', 'addon');
    RETURN jsonb_build_object('tenantId', p_tenant_id, 'count', 0, 'suspended', TRUE);
  END IF;

  v_plan_version_id := COALESCE(
    v_sub.plan_version_id,
    public.platform_resolve_effective_plan_version(
      COALESCE(v_sub.plan_key, (SELECT plan_key FROM public.platform_tenants WHERE tenant_id = p_tenant_id))
    )
  );

  DELETE FROM public.platform_tenant_entitlements
  WHERE tenant_id = p_tenant_id AND source_type IN ('plan', 'addon');

  IF v_plan_version_id IS NOT NULL THEN
    FOR v_module IN
      SELECT pm.module_key, pm.access_state
      FROM public.platform_plan_modules pm
      WHERE pm.plan_version_id = v_plan_version_id
    LOOP
      INSERT INTO public.platform_tenant_entitlements (
        tenant_id, entitlement_key, entitlement_type, module_key, access_state,
        source_type, source_id
      ) VALUES (
        p_tenant_id, 'module:' || v_module.module_key, 'module', v_module.module_key,
        v_module.access_state, 'plan', v_plan_version_id
      )
      ON CONFLICT (tenant_id, entitlement_key) DO UPDATE SET
        access_state = EXCLUDED.access_state,
        source_type = EXCLUDED.source_type,
        source_id = EXCLUDED.source_id,
        updated_at = NOW();
      v_count := v_count + 1;
    END LOOP;
  END IF;

  FOR v_module IN
    SELECT ta.addon_key, ae.module_key, ae.access_state, ae.entitlement_key, ta.id AS tenant_addon_id
    FROM public.platform_tenant_addons ta
    JOIN public.platform_addon_entitlements ae ON ae.addon_version_id = ta.addon_version_id
    WHERE ta.tenant_id = p_tenant_id AND ta.status = 'active'
  LOOP
    INSERT INTO public.platform_tenant_entitlements (
      tenant_id, entitlement_key, entitlement_type, module_key, access_state,
      source_type, source_id
    ) VALUES (
      p_tenant_id,
      COALESCE(v_module.entitlement_key, 'addon:' || v_module.addon_key || ':' || COALESCE(v_module.module_key, 'core')),
      CASE WHEN v_module.module_key IS NULL THEN 'feature' ELSE 'module' END,
      v_module.module_key,
      v_module.access_state,
      'addon',
      v_module.tenant_addon_id
    )
    ON CONFLICT (tenant_id, entitlement_key) DO UPDATE SET
      access_state = EXCLUDED.access_state,
      source_type = EXCLUDED.source_type,
      source_id = EXCLUDED.source_id,
      updated_at = NOW();
    v_count := v_count + 1;
  END LOOP;

  FOR v_beta IN
    SELECT ptm.module_key
    FROM public.platform_tenant_modules ptm
    WHERE ptm.tenant_id = p_tenant_id AND ptm.status = 'beta_enabled'
  LOOP
    INSERT INTO public.platform_tenant_entitlements (
      tenant_id, entitlement_key, entitlement_type, module_key, access_state, source_type
    ) VALUES (
      p_tenant_id, 'module:' || v_beta.module_key, 'module', v_beta.module_key, 'beta', 'beta'
    )
    ON CONFLICT (tenant_id, entitlement_key) DO UPDATE SET
      access_state = 'beta', source_type = 'beta', updated_at = NOW();
    v_count := v_count + 1;
  END LOOP;

  INSERT INTO public.platform_entitlement_events (
    tenant_id, event_type, payload, actor_user_id, reason
  ) VALUES (
    p_tenant_id, 'recalculated', jsonb_build_object('count', v_count), auth.uid(), p_reason
  );

  RETURN jsonb_build_object('tenantId', p_tenant_id, 'count', v_count);
END;
$$;

CREATE OR REPLACE FUNCTION public.platform_get_effective_tenant_entitlements(
  p_tenant_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_platform_user() THEN
    IF public.current_tenant_id() IS DISTINCT FROM p_tenant_id THEN
      RAISE EXCEPTION 'tenant_forbidden' USING ERRCODE = '42501';
    END IF;
  ELSE
    PERFORM public.platform_assert_capability('plans.read');
  END IF;

  RETURN COALESCE(
    (
      SELECT jsonb_agg(
        jsonb_build_object(
          'entitlementKey', e.entitlement_key,
          'entitlementType', e.entitlement_type,
          'moduleKey', e.module_key,
          'accessState', e.access_state,
          'sourceType', e.source_type,
          'limitValue', e.limit_value,
          'effectiveFrom', e.effective_from,
          'effectiveUntil', e.effective_until
        )
        ORDER BY e.entitlement_key
      )
      FROM public.platform_tenant_entitlements e
      WHERE e.tenant_id = p_tenant_id
        AND (e.effective_until IS NULL OR e.effective_until > NOW())
    ),
    '[]'::jsonb
  );
END;
$$;

-- --------------------------------------------------------------------------
-- Discounts / Credits aliases
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.platform_assign_discount_to_tenant(
  p_tenant_id UUID,
  p_discount_key TEXT,
  p_reason TEXT,
  p_starts_at TIMESTAMPTZ DEFAULT NOW(),
  p_ends_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN public.platform_assign_discount(p_tenant_id, p_discount_key, p_reason, p_starts_at, p_ends_at);
END;
$$;

CREATE OR REPLACE FUNCTION public.platform_remove_discount_from_tenant(
  p_tenant_id UUID,
  p_discount_key TEXT,
  p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN public.platform_remove_discount(p_tenant_id, p_discount_key, p_reason);
END;
$$;

CREATE OR REPLACE FUNCTION public.platform_book_tenant_credit(
  p_tenant_id UUID,
  p_amount_cents INTEGER,
  p_reason TEXT,
  p_entry_type TEXT DEFAULT 'credit'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance INTEGER;
  v_new_balance INTEGER;
  v_ledger public.platform_credit_ledger%ROWTYPE;
BEGIN
  PERFORM public.platform_assert_capability('billing.write');
  PERFORM public.platform_assert_reason(p_reason);

  IF p_amount_cents <= 0 THEN
    RAISE EXCEPTION 'invalid_amount' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.platform_tenant_credits (tenant_id, balance_cents)
  VALUES (p_tenant_id, 0)
  ON CONFLICT (tenant_id) DO NOTHING;

  SELECT balance_cents INTO v_balance
  FROM public.platform_tenant_credits WHERE tenant_id = p_tenant_id FOR UPDATE;

  IF p_entry_type = 'debit' THEN
    v_new_balance := GREATEST(0, v_balance - p_amount_cents);
  ELSE
    v_new_balance := v_balance + p_amount_cents;
  END IF;

  UPDATE public.platform_tenant_credits
  SET balance_cents = v_new_balance, updated_at = NOW()
  WHERE tenant_id = p_tenant_id;

  INSERT INTO public.platform_credit_ledger (
    tenant_id, entry_type, amount_cents, balance_after, reason, actor_user_id
  ) VALUES (
    p_tenant_id, p_entry_type, p_amount_cents, v_new_balance, p_reason, auth.uid()
  )
  RETURNING * INTO v_ledger;

  PERFORM public.platform_write_audit_log(
    'credit.booked', 'platform_credit_ledger', v_ledger.id, p_tenant_id,
    jsonb_build_object('balance', v_balance),
    jsonb_build_object('balance', v_new_balance, 'entry', row_to_json(v_ledger)::jsonb),
    p_reason
  );

  RETURN jsonb_build_object('balanceCents', v_new_balance, 'ledgerEntry', row_to_json(v_ledger)::jsonb);
END;
$$;

-- --------------------------------------------------------------------------
-- Billing preview engine (RPC)
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.platform_generate_invoice_preview(
  p_tenant_id UUID,
  p_period_start DATE,
  p_period_end DATE,
  p_reason TEXT DEFAULT 'preview',
  p_persist BOOLEAN DEFAULT TRUE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sub public.platform_tenant_subscriptions%ROWTYPE;
  v_plan_version public.platform_plan_versions%ROWTYPE;
  v_plan public.platform_plans%ROWTYPE;
  v_subtotal INTEGER := 0;
  v_discount INTEGER := 0;
  v_credit INTEGER := 0;
  v_total INTEGER := 0;
  v_credit_balance INTEGER := 0;
  v_preview_id UUID;
  v_sort INTEGER := 0;
  v_addon RECORD;
  v_disc RECORD;
  v_plan_cents INTEGER;
  v_addon_cents INTEGER;
  v_disc_amt INTEGER;
BEGIN
  PERFORM public.platform_assert_capability('billing.read');
  IF p_persist THEN
    PERFORM public.platform_assert_capability('billing.write');
  END IF;

  SELECT * INTO v_sub FROM public.platform_tenant_subscriptions
  WHERE tenant_id = p_tenant_id AND status = 'active'
  ORDER BY created_at DESC LIMIT 1;

  IF NOT FOUND THEN
    SELECT tp.plan_key INTO v_sub.plan_key
    FROM public.platform_tenant_plans tp
    WHERE tp.tenant_id = p_tenant_id AND tp.status = 'active'
    ORDER BY tp.created_at DESC LIMIT 1;
    v_sub.billing_interval := 'monthly';
  END IF;

  IF v_sub.plan_key IS NOT NULL THEN
    SELECT * INTO v_plan FROM public.platform_plans WHERE plan_key = v_sub.plan_key;
    SELECT * INTO v_plan_version FROM public.platform_plan_versions
    WHERE id = COALESCE(v_sub.plan_version_id, public.platform_resolve_effective_plan_version(v_sub.plan_key));

    v_plan_cents := CASE
      WHEN v_sub.billing_interval = 'yearly' THEN
        COALESCE(v_sub.price_override_yearly_cents, v_plan_version.yearly_price_cents, v_plan.yearly_price_cents)
      ELSE
        COALESCE(v_sub.price_override_monthly_cents, v_plan_version.monthly_price_cents, v_plan.monthly_price_cents)
    END;

    v_subtotal := v_subtotal + v_plan_cents;
  END IF;

  FOR v_addon IN
    SELECT ta.*, av.monthly_price_cents, av.yearly_price_cents, a.addon_name
    FROM public.platform_tenant_addons ta
    JOIN public.platform_addons a ON a.addon_key = ta.addon_key
    LEFT JOIN public.platform_addon_versions av ON av.id = ta.addon_version_id
    WHERE ta.tenant_id = p_tenant_id AND ta.status = 'active'
  LOOP
    v_addon_cents := COALESCE(
      v_addon.price_override_cents,
      CASE WHEN v_addon.billing_interval = 'yearly' THEN v_addon.yearly_price_cents ELSE v_addon.monthly_price_cents END,
      0
    );
    v_subtotal := v_subtotal + v_addon_cents;
    v_sort := v_sort + 1;
  END LOOP;

  FOR v_disc IN
    SELECT td.*, d.discount_type, d.percentage, d.amount_cents, d.status AS catalog_status
    FROM public.platform_tenant_discounts td
    JOIN public.platform_discounts d ON d.discount_key = td.discount_key
    WHERE td.tenant_id = p_tenant_id
      AND td.status = 'active'
      AND (td.starts_at IS NULL OR td.starts_at <= NOW())
      AND (td.ends_at IS NULL OR td.ends_at > NOW())
      AND d.status = 'active'
  LOOP
    IF v_disc.discount_type = 'percentage' AND v_disc.percentage IS NOT NULL THEN
      v_disc_amt := ROUND(v_subtotal * v_disc.percentage / 100.0)::INTEGER;
    ELSIF v_disc.discount_type = 'fixed_amount' AND v_disc.amount_cents IS NOT NULL THEN
      v_disc_amt := v_disc.amount_cents;
    ELSE
      v_disc_amt := 0;
    END IF;
    v_discount := v_discount + v_disc_amt;
  END LOOP;

  SELECT balance_cents INTO v_credit_balance
  FROM public.platform_tenant_credits WHERE tenant_id = p_tenant_id;
  v_credit_balance := COALESCE(v_credit_balance, 0);

  v_total := GREATEST(0, v_subtotal - v_discount);
  v_credit := LEAST(v_credit_balance, v_total);
  v_total := v_total - v_credit;

  IF p_persist THEN
    INSERT INTO public.platform_invoice_previews (
      tenant_id, period_start, period_end, subtotal_cents, discount_cents,
      credit_cents, total_cents, generated_by, metadata
    ) VALUES (
      p_tenant_id, p_period_start, p_period_end, v_subtotal, v_discount,
      v_credit, v_total, auth.uid(),
      jsonb_build_object('reason', p_reason, 'billingInterval', v_sub.billing_interval)
    )
  RETURNING id INTO v_preview_id;

    IF v_sub.plan_key IS NOT NULL THEN
      INSERT INTO public.platform_invoice_preview_items (
        preview_id, line_type, description, quantity, unit_cents, amount_cents, sort_order
      ) VALUES (
        v_preview_id, 'plan', COALESCE(v_plan.plan_name, v_sub.plan_key), 1, v_plan_cents, v_plan_cents, 0
      );
    END IF;

    FOR v_addon IN
      SELECT ta.*, av.monthly_price_cents, av.yearly_price_cents, a.addon_name
      FROM public.platform_tenant_addons ta
      JOIN public.platform_addons a ON a.addon_key = ta.addon_key
      LEFT JOIN public.platform_addon_versions av ON av.id = ta.addon_version_id
      WHERE ta.tenant_id = p_tenant_id AND ta.status = 'active'
    LOOP
      v_addon_cents := COALESCE(
        v_addon.price_override_cents,
        CASE WHEN v_addon.billing_interval = 'yearly' THEN v_addon.yearly_price_cents ELSE v_addon.monthly_price_cents END,
        0
      );
      INSERT INTO public.platform_invoice_preview_items (
        preview_id, line_type, description, quantity, unit_cents, amount_cents, sort_order
      ) VALUES (
        v_preview_id, 'addon', v_addon.addon_name, 1, v_addon_cents, v_addon_cents, v_sort
      );
      v_sort := v_sort + 1;
    END LOOP;

    IF v_discount > 0 THEN
      INSERT INTO public.platform_invoice_preview_items (
        preview_id, line_type, description, quantity, unit_cents, amount_cents, sort_order
      ) VALUES (
        v_preview_id, 'discount', 'Rabatte', 1, -v_discount, -v_discount, 90
      );
    END IF;

    IF v_credit > 0 THEN
      INSERT INTO public.platform_invoice_preview_items (
        preview_id, line_type, description, quantity, unit_cents, amount_cents, sort_order
      ) VALUES (
        v_preview_id, 'credit', 'Guthaben', 1, -v_credit, -v_credit, 95
      );
    END IF;

    PERFORM public.platform_write_audit_log(
      'billing.preview_generated', 'platform_invoice_preview', v_preview_id, p_tenant_id,
      NULL,
      jsonb_build_object(
        'subtotalCents', v_subtotal, 'discountCents', v_discount,
        'creditCents', v_credit, 'totalCents', v_total
      ),
      p_reason
    );
  END IF;

  RETURN jsonb_build_object(
    'tenantId', p_tenant_id,
    'periodStart', p_period_start,
    'periodEnd', p_period_end,
    'subtotalCents', v_subtotal,
    'discountCents', v_discount,
    'creditCents', v_credit,
    'totalCents', v_total,
    'previewId', v_preview_id,
    'isPreview', TRUE
  );
END;
$$;

-- --------------------------------------------------------------------------
-- RLS: platform users read-only on foundation tables
-- --------------------------------------------------------------------------
ALTER TABLE public.platform_plan_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_plan_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_plan_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_tenant_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_subscription_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_subscription_scheduled_changes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_addons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_addon_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_addon_entitlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_tenant_addons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_tenant_addon_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_tenant_entitlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_entitlement_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_tenant_credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_credit_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_invoice_previews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_invoice_preview_items ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'platform_plan_versions', 'platform_plan_modules', 'platform_plan_limits',
    'platform_tenant_subscriptions', 'platform_subscription_events',
    'platform_subscription_scheduled_changes', 'platform_addons', 'platform_addon_versions',
    'platform_addon_entitlements', 'platform_tenant_addons', 'platform_tenant_addon_events',
    'platform_tenant_entitlements', 'platform_entitlement_events', 'platform_tenant_credits',
    'platform_credit_ledger', 'platform_invoice_previews', 'platform_invoice_preview_items'
  ]
  LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON public.%I;
       CREATE POLICY %I ON public.%I FOR SELECT TO authenticated
       USING (public.is_platform_user());',
      t || '_platform_select', t,
      t || '_platform_select', t
    );
  END LOOP;
END;
$$;

-- --------------------------------------------------------------------------
-- GRANTs
-- --------------------------------------------------------------------------
GRANT SELECT ON public.platform_plan_versions TO authenticated;
GRANT SELECT ON public.platform_plan_modules TO authenticated;
GRANT SELECT ON public.platform_plan_limits TO authenticated;
GRANT SELECT ON public.platform_tenant_subscriptions TO authenticated;
GRANT SELECT ON public.platform_subscription_events TO authenticated;
GRANT SELECT ON public.platform_subscription_scheduled_changes TO authenticated;
GRANT SELECT ON public.platform_addons TO authenticated;
GRANT SELECT ON public.platform_addon_versions TO authenticated;
GRANT SELECT ON public.platform_addon_entitlements TO authenticated;
GRANT SELECT ON public.platform_tenant_addons TO authenticated;
GRANT SELECT ON public.platform_tenant_addon_events TO authenticated;
GRANT SELECT ON public.platform_tenant_entitlements TO authenticated;
GRANT SELECT ON public.platform_entitlement_events TO authenticated;
GRANT SELECT ON public.platform_tenant_credits TO authenticated;
GRANT SELECT ON public.platform_credit_ledger TO authenticated;
GRANT SELECT ON public.platform_invoice_previews TO authenticated;
GRANT SELECT ON public.platform_invoice_preview_items TO authenticated;

GRANT EXECUTE ON FUNCTION public.platform_create_plan(TEXT, TEXT, TEXT, TEXT, INTEGER, INTEGER, TEXT, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.platform_update_plan(TEXT, TEXT, TEXT, TEXT, BOOLEAN, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.platform_create_plan_version(TEXT, TEXT, INTEGER, INTEGER, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION public.platform_assign_plan_module(UUID, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.platform_remove_plan_module(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.platform_set_plan_limit(UUID, TEXT, INTEGER, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.platform_assign_plan_to_tenant(UUID, TEXT, TEXT, TEXT, INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.platform_schedule_plan_change(UUID, TEXT, TIMESTAMPTZ, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.platform_suspend_subscription(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.platform_reactivate_subscription(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.platform_cancel_subscription(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.platform_create_addon(TEXT, TEXT, TEXT, TEXT, INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.platform_update_addon(TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.platform_create_addon_version(TEXT, TEXT, INTEGER, INTEGER, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION public.platform_assign_addon_to_tenant(UUID, TEXT, TEXT, TEXT, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.platform_remove_addon_from_tenant(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.platform_recalculate_tenant_entitlements(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.platform_get_effective_tenant_entitlements(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.platform_assign_discount_to_tenant(UUID, TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION public.platform_remove_discount_from_tenant(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.platform_book_tenant_credit(UUID, INTEGER, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.platform_generate_invoice_preview(UUID, DATE, DATE, TEXT, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.platform_resolve_effective_plan_version(TEXT, TIMESTAMPTZ) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.platform_assert_capability(TEXT) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.platform_assert_reason(TEXT) FROM PUBLIC, anon, authenticated;
