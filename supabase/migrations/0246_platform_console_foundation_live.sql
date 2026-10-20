-- ==========================================================================
-- CareSuite+ — Migration 0246: Platform Console Foundation (live)
-- SaaS-Betreiber-Konsole: Tabellen, RLS, RBAC-Hilfsfunktionen, Kern-RPCs
-- Kein Production-Seed für platform_owner — nur manuelle Zuweisung.
-- ==========================================================================

-- --------------------------------------------------------------------------
-- 1. platform_users
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.platform_users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL UNIQUE,
  email         TEXT NOT NULL,
  full_name     TEXT,
  role          TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'active',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by    UUID,
  last_login_at TIMESTAMPTZ,
  notes         TEXT,
  CONSTRAINT platform_users_role_check CHECK (
    role IN (
      'platform_owner', 'platform_admin', 'platform_billing',
      'platform_support', 'platform_developer', 'platform_readonly'
    )
  ),
  CONSTRAINT platform_users_status_check CHECK (
    status IN ('active', 'disabled', 'revoked')
  )
);

CREATE INDEX IF NOT EXISTS idx_platform_users_user_id ON public.platform_users (user_id);
CREATE INDEX IF NOT EXISTS idx_platform_users_role ON public.platform_users (role, status);

-- --------------------------------------------------------------------------
-- 2. platform_tenants
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.platform_tenants (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID NOT NULL UNIQUE REFERENCES public.tenants(id) ON DELETE CASCADE,
  tenant_name           TEXT NOT NULL,
  legal_name            TEXT,
  slug                  TEXT UNIQUE,
  status                TEXT NOT NULL DEFAULT 'active',
  lifecycle_status      TEXT NOT NULL DEFAULT 'onboarding',
  billing_status        TEXT NOT NULL DEFAULT 'trial',
  plan_key              TEXT,
  industry_type         TEXT,
  country               TEXT NOT NULL DEFAULT 'DE',
  timezone              TEXT NOT NULL DEFAULT 'Europe/Berlin',
  primary_contact_name  TEXT,
  primary_contact_email TEXT,
  primary_contact_phone TEXT,
  billing_email         TEXT,
  support_email         TEXT,
  trial_starts_at       TIMESTAMPTZ,
  trial_ends_at         TIMESTAMPTZ,
  activated_at          TIMESTAMPTZ,
  suspended_at          TIMESTAMPTZ,
  terminated_at         TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by            UUID,
  notes                 TEXT,
  CONSTRAINT platform_tenants_status_check CHECK (
    status IN ('active', 'suspended', 'locked', 'terminated', 'deleted_soft')
  ),
  CONSTRAINT platform_tenants_lifecycle_check CHECK (
    lifecycle_status IN ('lead', 'onboarding', 'trial', 'live', 'paused', 'offboarding', 'terminated')
  ),
  CONSTRAINT platform_tenants_billing_check CHECK (
    billing_status IN ('trial', 'active', 'past_due', 'failed', 'manual_free', 'invoice_pending', 'cancelled')
  )
);

CREATE INDEX IF NOT EXISTS idx_platform_tenants_status ON public.platform_tenants (status, billing_status);
CREATE INDEX IF NOT EXISTS idx_platform_tenants_slug ON public.platform_tenants (slug);

-- --------------------------------------------------------------------------
-- 3. platform_modules
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.platform_modules (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_key              TEXT NOT NULL UNIQUE,
  module_name             TEXT NOT NULL,
  description             TEXT,
  category                TEXT,
  status                  TEXT NOT NULL DEFAULT 'available',
  is_core                 BOOLEAN NOT NULL DEFAULT FALSE,
  is_beta                 BOOLEAN NOT NULL DEFAULT FALSE,
  is_internal             BOOLEAN NOT NULL DEFAULT FALSE,
  default_enabled         BOOLEAN NOT NULL DEFAULT FALSE,
  requires_module_keys    TEXT[] NOT NULL DEFAULT '{}',
  incompatible_module_keys TEXT[] NOT NULL DEFAULT '{}',
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT platform_modules_status_check CHECK (
    status IN ('available', 'beta', 'internal', 'deprecated', 'disabled')
  )
);

-- --------------------------------------------------------------------------
-- 4. platform_tenant_modules
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.platform_tenant_modules (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  module_key      TEXT NOT NULL REFERENCES public.platform_modules(module_key) ON DELETE RESTRICT,
  status          TEXT NOT NULL DEFAULT 'enabled',
  enabled_at      TIMESTAMPTZ,
  disabled_at     TIMESTAMPTZ,
  starts_at       TIMESTAMPTZ,
  ends_at         TIMESTAMPTZ,
  is_trial        BOOLEAN NOT NULL DEFAULT FALSE,
  trial_ends_at   TIMESTAMPTZ,
  manual_override BOOLEAN NOT NULL DEFAULT FALSE,
  override_reason TEXT,
  enabled_by      UUID,
  disabled_by     UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, module_key),
  CONSTRAINT platform_tenant_modules_status_check CHECK (
    status IN ('enabled', 'disabled', 'trial', 'scheduled', 'expired', 'locked', 'beta_enabled')
  )
);

CREATE INDEX IF NOT EXISTS idx_platform_tenant_modules_tenant ON public.platform_tenant_modules (tenant_id, status);

-- --------------------------------------------------------------------------
-- 5. platform_plans
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.platform_plans (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_key              TEXT NOT NULL UNIQUE,
  plan_name             TEXT NOT NULL,
  description           TEXT,
  monthly_price_cents   INTEGER NOT NULL DEFAULT 0,
  yearly_price_cents    INTEGER NOT NULL DEFAULT 0,
  currency              TEXT NOT NULL DEFAULT 'EUR',
  billing_interval      TEXT,
  max_users             INTEGER,
  max_clients           INTEGER,
  max_employees         INTEGER,
  max_storage_mb        INTEGER,
  included_module_keys  TEXT[] NOT NULL DEFAULT '{}',
  is_public             BOOLEAN NOT NULL DEFAULT FALSE,
  is_custom             BOOLEAN NOT NULL DEFAULT FALSE,
  status                TEXT NOT NULL DEFAULT 'active',
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- --------------------------------------------------------------------------
-- 6. platform_tenant_plans
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.platform_tenant_plans (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  plan_key              TEXT NOT NULL REFERENCES public.platform_plans(plan_key) ON DELETE RESTRICT,
  status                TEXT NOT NULL DEFAULT 'active',
  starts_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ends_at               TIMESTAMPTZ,
  billing_interval      TEXT,
  monthly_price_cents   INTEGER,
  yearly_price_cents    INTEGER,
  currency              TEXT NOT NULL DEFAULT 'EUR',
  custom_terms          TEXT,
  assigned_by           UUID,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT platform_tenant_plans_status_check CHECK (
    status IN ('active', 'scheduled', 'cancelled', 'expired', 'paused')
  )
);

CREATE INDEX IF NOT EXISTS idx_platform_tenant_plans_tenant ON public.platform_tenant_plans (tenant_id, status);

-- --------------------------------------------------------------------------
-- 7. platform_discounts
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.platform_discounts (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  discount_key          TEXT NOT NULL UNIQUE,
  name                  TEXT NOT NULL,
  description           TEXT,
  discount_type         TEXT NOT NULL,
  percentage            NUMERIC,
  amount_cents          INTEGER,
  currency              TEXT NOT NULL DEFAULT 'EUR',
  free_months           INTEGER,
  max_redemptions       INTEGER,
  current_redemptions   INTEGER NOT NULL DEFAULT 0,
  starts_at             TIMESTAMPTZ,
  ends_at               TIMESTAMPTZ,
  status                TEXT NOT NULL DEFAULT 'active',
  created_by            UUID,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT platform_discounts_type_check CHECK (
    discount_type IN (
      'percentage', 'fixed_amount', 'free_months', 'lifetime_discount',
      'beta_discount', 'manual_credit', 'goodwill_credit', 'partner_discount'
    )
  )
);

-- --------------------------------------------------------------------------
-- 8. platform_tenant_discounts
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.platform_tenant_discounts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  discount_key  TEXT NOT NULL REFERENCES public.platform_discounts(discount_key) ON DELETE RESTRICT,
  status        TEXT NOT NULL DEFAULT 'active',
  starts_at     TIMESTAMPTZ,
  ends_at       TIMESTAMPTZ,
  applied_by    UUID,
  reason        TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, discount_key),
  CONSTRAINT platform_tenant_discounts_status_check CHECK (
    status IN ('active', 'scheduled', 'expired', 'revoked')
  )
);

-- --------------------------------------------------------------------------
-- 9. platform_invoices
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.platform_invoices (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  invoice_number      TEXT,
  external_invoice_id TEXT,
  provider            TEXT,
  status              TEXT NOT NULL DEFAULT 'draft',
  period_start        DATE,
  period_end          DATE,
  subtotal_cents      INTEGER NOT NULL DEFAULT 0,
  discount_cents      INTEGER NOT NULL DEFAULT 0,
  tax_cents           INTEGER NOT NULL DEFAULT 0,
  total_cents         INTEGER NOT NULL DEFAULT 0,
  currency            TEXT NOT NULL DEFAULT 'EUR',
  due_date            DATE,
  issued_at           TIMESTAMPTZ,
  paid_at             TIMESTAMPTZ,
  failed_at           TIMESTAMPTZ,
  cancelled_at        TIMESTAMPTZ,
  invoice_url         TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT platform_invoices_status_check CHECK (
    status IN ('draft', 'open', 'paid', 'past_due', 'failed', 'cancelled', 'refunded', 'partially_paid')
  )
);

CREATE INDEX IF NOT EXISTS idx_platform_invoices_tenant ON public.platform_invoices (tenant_id, status);

-- --------------------------------------------------------------------------
-- 10. platform_payments
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.platform_payments (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  invoice_id            UUID REFERENCES public.platform_invoices(id) ON DELETE SET NULL,
  provider              TEXT,
  external_payment_id   TEXT,
  payment_method        TEXT,
  status                TEXT NOT NULL,
  amount_cents          INTEGER NOT NULL,
  currency              TEXT NOT NULL DEFAULT 'EUR',
  paid_at               TIMESTAMPTZ,
  failed_at             TIMESTAMPTZ,
  failure_reason        TEXT,
  raw_provider_status   TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT platform_payments_status_check CHECK (
    status IN ('pending', 'succeeded', 'failed', 'cancelled', 'refunded', 'chargeback')
  )
);

CREATE INDEX IF NOT EXISTS idx_platform_payments_tenant ON public.platform_payments (tenant_id, status);

-- --------------------------------------------------------------------------
-- 11. platform_feature_flags
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.platform_feature_flags (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flag_key            TEXT NOT NULL,
  name                TEXT,
  description         TEXT,
  scope               TEXT NOT NULL DEFAULT 'global',
  tenant_id           UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  enabled             BOOLEAN NOT NULL DEFAULT FALSE,
  rollout_percentage  INTEGER,
  starts_at           TIMESTAMPTZ,
  ends_at             TIMESTAMPTZ,
  created_by          UUID,
  updated_by          UUID,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT platform_feature_flags_scope_check CHECK (
    scope IN ('global', 'tenant', 'module', 'user', 'beta_group')
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_platform_feature_flags_global
  ON public.platform_feature_flags (flag_key)
  WHERE scope = 'global' AND tenant_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_platform_feature_flags_tenant
  ON public.platform_feature_flags (flag_key, tenant_id)
  WHERE tenant_id IS NOT NULL;

-- --------------------------------------------------------------------------
-- 12. platform_support_sessions
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.platform_support_sessions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  platform_user_id  UUID NOT NULL REFERENCES public.platform_users(id) ON DELETE CASCADE,
  reason            TEXT NOT NULL,
  status            TEXT NOT NULL DEFAULT 'active',
  starts_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ends_at           TIMESTAMPTZ,
  expires_at        TIMESTAMPTZ NOT NULL,
  readonly          BOOLEAN NOT NULL DEFAULT TRUE,
  allowed_scopes    TEXT[] NOT NULL DEFAULT '{}',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT platform_support_sessions_status_check CHECK (
    status IN ('active', 'expired', 'revoked', 'closed')
  )
);

CREATE INDEX IF NOT EXISTS idx_platform_support_sessions_tenant ON public.platform_support_sessions (tenant_id, status);

-- --------------------------------------------------------------------------
-- 13. platform_audit_log (immutable)
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.platform_audit_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id   UUID,
  actor_role      TEXT,
  action          TEXT NOT NULL,
  target_type     TEXT,
  target_id       UUID,
  tenant_id       UUID,
  before          JSONB,
  after           JSONB,
  reason          TEXT,
  ip_address      TEXT,
  user_agent      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_platform_audit_log_tenant ON public.platform_audit_log (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_platform_audit_log_action ON public.platform_audit_log (action, created_at DESC);

-- Audit-Log Schreibfunktion (nach Tabellenerstellung)
CREATE OR REPLACE FUNCTION public.platform_write_audit_log(
  p_action TEXT,
  p_target_type TEXT DEFAULT NULL,
  p_target_id UUID DEFAULT NULL,
  p_tenant_id UUID DEFAULT NULL,
  p_before JSONB DEFAULT NULL,
  p_after JSONB DEFAULT NULL,
  p_reason TEXT DEFAULT NULL,
  p_ip_address TEXT DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  IF NOT public.is_platform_user() THEN
    RAISE EXCEPTION 'platform_forbidden' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.platform_audit_log (
    actor_user_id,
    actor_role,
    action,
    target_type,
    target_id,
    tenant_id,
    before,
    after,
    reason,
    ip_address,
    user_agent
  ) VALUES (
    auth.uid(),
    public.platform_current_role(),
    p_action,
    p_target_type,
    p_target_id,
    p_tenant_id,
    p_before,
    p_after,
    p_reason,
    p_ip_address,
    p_user_agent
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.platform_write_audit_log(TEXT, TEXT, UUID, UUID, JSONB, JSONB, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.platform_write_audit_log(TEXT, TEXT, UUID, UUID, JSONB, JSONB, TEXT, TEXT, TEXT) TO authenticated;

-- --------------------------------------------------------------------------
-- 14. platform_system_settings
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.platform_system_settings (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key   TEXT NOT NULL UNIQUE,
  value         JSONB NOT NULL,
  description   TEXT,
  is_sensitive  BOOLEAN NOT NULL DEFAULT FALSE,
  updated_by    UUID,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- --------------------------------------------------------------------------
-- Hilfsfunktionen: Plattform-RBAC (SECURITY DEFINER)
-- Nach Tabellen — platform_current_role() benötigt platform_users
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.platform_current_user_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.platform_current_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT pu.role
  FROM public.platform_users pu
  WHERE pu.user_id = auth.uid()
    AND pu.status = 'active'
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.is_platform_user()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.platform_users pu
    WHERE pu.user_id = auth.uid()
      AND pu.status = 'active'
  )
$$;

CREATE OR REPLACE FUNCTION public.platform_has_capability(p_capability TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT;
BEGIN
  v_role := public.platform_current_role();
  IF v_role IS NULL THEN
    RETURN FALSE;
  END IF;

  IF v_role = 'platform_owner' THEN
    RETURN TRUE;
  END IF;

  CASE p_capability
    WHEN 'tenants.read' THEN
      RETURN v_role IN (
        'platform_admin', 'platform_billing', 'platform_support',
        'platform_developer', 'platform_readonly'
      );
    WHEN 'tenants.write', 'tenants.suspend' THEN
      RETURN v_role = 'platform_admin';
    WHEN 'modules.read' THEN
      RETURN v_role IN (
        'platform_admin', 'platform_support', 'platform_developer', 'platform_readonly'
      );
    WHEN 'modules.write' THEN
      RETURN v_role = 'platform_admin';
    WHEN 'plans.read', 'discounts.read' THEN
      RETURN v_role IN (
        'platform_admin', 'platform_billing', 'platform_readonly'
      );
    WHEN 'plans.write', 'discounts.write' THEN
      RETURN v_role IN ('platform_admin', 'platform_billing');
    WHEN 'billing.read', 'payments.read' THEN
      RETURN v_role IN (
        'platform_admin', 'platform_billing', 'platform_readonly'
      );
    WHEN 'billing.write', 'payments.write' THEN
      RETURN v_role IN ('platform_owner', 'platform_billing');
    WHEN 'flags.read' THEN
      RETURN v_role IN (
        'platform_admin', 'platform_developer', 'platform_readonly'
      );
    WHEN 'flags.write' THEN
      RETURN v_role IN ('platform_owner', 'platform_developer');
    WHEN 'support.read', 'support.write' THEN
      RETURN v_role IN ('platform_owner', 'platform_admin', 'platform_support');
    WHEN 'audit.read' THEN
      RETURN v_role IN (
        'platform_admin', 'platform_billing', 'platform_support',
        'platform_developer', 'platform_readonly'
      );
    WHEN 'system.read', 'releases.read' THEN
      RETURN v_role IN (
        'platform_admin', 'platform_developer', 'platform_readonly'
      );
    WHEN 'system.write' THEN
      RETURN v_role = 'platform_owner';
    WHEN 'users.read' THEN
      RETURN v_role IN ('platform_owner', 'platform_admin', 'platform_readonly');
    WHEN 'users.write' THEN
      RETURN v_role = 'platform_owner';
    ELSE
      RETURN FALSE;
  END CASE;
END;
$$;

-- EXECUTE-Rechte: Migration 0249 (kein anon/authenticated auf Hilfsfunktionen)

-- --------------------------------------------------------------------------
-- Seed: Modulverzeichnis
-- --------------------------------------------------------------------------
INSERT INTO public.platform_modules (module_key, module_name, category, is_core, requires_module_keys) VALUES
  ('office', 'Office', 'core', TRUE, '{}'),
  ('assist', 'Assist', 'operations', FALSE, '{office}'),
  ('care', 'Care / Pflege', 'care', FALSE, '{office}'),
  ('stationary', 'Stationär', 'care', FALSE, '{office,care}'),
  ('consulting', 'Beratung', 'care', FALSE, '{office}'),
  ('academy', 'Akademie', 'education', FALSE, '{}'),
  ('client_portal', 'Klient:innenportal', 'portal', FALSE, '{office}'),
  ('employee_portal', 'Mitarbeiterportal', 'portal', FALSE, '{office}'),
  ('messaging', 'Messaging', 'communication', FALSE, '{office}'),
  ('documents', 'Dokumente', 'documents', FALSE, '{office}'),
  ('signatures', 'Signaturen', 'documents', FALSE, '{documents}'),
  ('billing', 'Abrechnung', 'finance', FALSE, '{office}'),
  ('timekeeping', 'Zeiterfassung', 'workforce', FALSE, '{office}'),
  ('workforce', 'Workforce', 'workforce', FALSE, '{office}'),
  ('live_tracking', 'Live Tracking', 'operations', FALSE, '{assist}'),
  ('ai_assist', 'KI-Assist', 'ai', TRUE, '{}'),
  ('api_access', 'API-Zugang', 'integration', FALSE, '{}'),
  ('robotics', 'Robotics', 'integration', TRUE, '{}'),
  ('healthos', 'HealthOS', 'integration', TRUE, '{}'),
  ('integrations', 'Integrationen', 'integration', FALSE, '{}')
ON CONFLICT (module_key) DO NOTHING;

UPDATE public.platform_modules SET requires_module_keys = '{healthos,integrations}'
WHERE module_key = 'robotics';

-- --------------------------------------------------------------------------
-- Seed: Tarife
-- --------------------------------------------------------------------------
INSERT INTO public.platform_plans (plan_key, plan_name, description, monthly_price_cents, yearly_price_cents, is_public, included_module_keys) VALUES
  ('starter', 'Starter', 'Einstieg für kleine Teams', 9900, 99000, TRUE, '{office,employee_portal}'),
  ('professional', 'Professional', 'Vollständige Pflege-Suite', 29900, 299000, TRUE, '{office,assist,care,employee_portal,client_portal,messaging,documents}'),
  ('enterprise', 'Enterprise', 'Enterprise mit allen Modulen', 59900, 599000, TRUE, '{office,assist,care,stationary,consulting,academy,client_portal,employee_portal,messaging,documents,signatures,billing,timekeeping,workforce}'),
  ('beta_free', 'Beta (kostenfrei)', 'Beta-Programm', 0, 0, FALSE, '{office,assist,ai_assist}'),
  ('internal', 'Intern', 'CareSuite+ intern', 0, 0, FALSE, '{}'),
  ('custom', 'Individuell', 'Individueller Vertrag', 0, 0, FALSE, '{}')
ON CONFLICT (plan_key) DO NOTHING;

-- --------------------------------------------------------------------------
-- Seed: Systemeinstellungen
-- --------------------------------------------------------------------------
INSERT INTO public.platform_system_settings (setting_key, value, description) VALUES
  ('default_trial_days', '14', 'Standard-Trial-Dauer in Tagen'),
  ('billing_grace_period_days', '7', 'Karenzzeit bei Zahlungsverzug'),
  ('maintenance_mode', 'false', 'Wartungsmodus aktiv'),
  ('allow_new_tenant_signup', 'true', 'Neue Mandanten-Registrierung erlaubt'),
  ('default_country', '"DE"', 'Standard-Land'),
  ('default_timezone', '"Europe/Berlin"', 'Standard-Zeitzone'),
  ('support_session_max_minutes', '60', 'Max. Support-Session-Dauer'),
  ('beta_features_enabled', 'false', 'Beta-Features global'),
  ('payment_provider_mode', '"manual"', 'Zahlungsanbieter-Modus'),
  ('invoice_prefix', '"CS-"', 'Rechnungspräfix')
ON CONFLICT (setting_key) DO NOTHING;

-- --------------------------------------------------------------------------
-- Sync bestehender Mandanten in platform_tenants
-- --------------------------------------------------------------------------
INSERT INTO public.platform_tenants (tenant_id, tenant_name, slug, status, lifecycle_status, billing_status)
SELECT t.id, t.name, t.slug, 'active', 'live', 'trial'
FROM public.tenants t
WHERE NOT EXISTS (
  SELECT 1 FROM public.platform_tenants pt WHERE pt.tenant_id = t.id
);

-- --------------------------------------------------------------------------
-- RLS aktivieren
-- --------------------------------------------------------------------------
ALTER TABLE public.platform_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_tenant_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_tenant_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_discounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_tenant_discounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_feature_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_support_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_system_settings ENABLE ROW LEVEL SECURITY;

-- platform_users
CREATE POLICY platform_users_select ON public.platform_users FOR SELECT
  USING (public.is_platform_user() AND (
    user_id = auth.uid() OR public.platform_has_capability('users.read')
  ));

-- platform_tenants
CREATE POLICY platform_tenants_select ON public.platform_tenants FOR SELECT
  USING (public.platform_has_capability('tenants.read'));

-- platform_modules (Lesen für alle Plattformuser)
CREATE POLICY platform_modules_select ON public.platform_modules FOR SELECT
  USING (public.is_platform_user());

-- platform_tenant_modules
CREATE POLICY platform_tenant_modules_select ON public.platform_tenant_modules FOR SELECT
  USING (public.platform_has_capability('modules.read'));

-- platform_plans
CREATE POLICY platform_plans_select ON public.platform_plans FOR SELECT
  USING (public.platform_has_capability('plans.read'));

-- platform_tenant_plans
CREATE POLICY platform_tenant_plans_select ON public.platform_tenant_plans FOR SELECT
  USING (public.platform_has_capability('plans.read'));

-- platform_discounts
CREATE POLICY platform_discounts_select ON public.platform_discounts FOR SELECT
  USING (public.platform_has_capability('discounts.read'));

-- platform_tenant_discounts
CREATE POLICY platform_tenant_discounts_select ON public.platform_tenant_discounts FOR SELECT
  USING (public.platform_has_capability('discounts.read'));

-- platform_invoices
CREATE POLICY platform_invoices_select ON public.platform_invoices FOR SELECT
  USING (public.platform_has_capability('billing.read'));

-- platform_payments
CREATE POLICY platform_payments_select ON public.platform_payments FOR SELECT
  USING (public.platform_has_capability('payments.read'));

-- platform_feature_flags
CREATE POLICY platform_feature_flags_select ON public.platform_feature_flags FOR SELECT
  USING (public.platform_has_capability('flags.read'));

-- platform_support_sessions
CREATE POLICY platform_support_sessions_select ON public.platform_support_sessions FOR SELECT
  USING (public.platform_has_capability('support.read'));

-- platform_audit_log (nur lesen, nie schreiben direkt)
CREATE POLICY platform_audit_log_select ON public.platform_audit_log FOR SELECT
  USING (public.platform_has_capability('audit.read'));

-- platform_system_settings
CREATE POLICY platform_system_settings_select ON public.platform_system_settings FOR SELECT
  USING (public.platform_has_capability('system.read'));

-- Keine direkten INSERT/UPDATE/DELETE Policies — Mutationen nur über RPCs

-- --------------------------------------------------------------------------
-- RPC: Plattform-Session / Auth
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.platform_get_current_user()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.platform_users%ROWTYPE;
BEGIN
  SELECT * INTO v_row
  FROM public.platform_users
  WHERE user_id = auth.uid()
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('isPlatformUser', FALSE);
  END IF;

  RETURN jsonb_build_object(
    'isPlatformUser', v_row.status = 'active',
    'id', v_row.id,
    'userId', v_row.user_id,
    'email', v_row.email,
    'fullName', v_row.full_name,
    'role', v_row.role,
    'status', v_row.status,
    'lastLoginAt', v_row.last_login_at
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.platform_get_current_user() TO authenticated;

-- --------------------------------------------------------------------------
-- RPC: Dashboard Summary
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.platform_get_dashboard_summary()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.platform_has_capability('tenants.read') THEN
    RAISE EXCEPTION 'platform_forbidden' USING ERRCODE = '42501';
  END IF;

  RETURN jsonb_build_object(
    'tenants', jsonb_build_object(
      'active', (SELECT COUNT(*) FROM public.platform_tenants WHERE status = 'active'),
      'trial', (SELECT COUNT(*) FROM public.platform_tenants WHERE billing_status = 'trial'),
      'suspended', (SELECT COUNT(*) FROM public.platform_tenants WHERE status IN ('suspended', 'locked')),
      'onboarding', (SELECT COUNT(*) FROM public.platform_tenants WHERE lifecycle_status = 'onboarding'),
      'pastDue', (SELECT COUNT(*) FROM public.platform_tenants WHERE billing_status = 'past_due'),
      'cancelled', (SELECT COUNT(*) FROM public.platform_tenants WHERE billing_status = 'cancelled')
    ),
    'billing', jsonb_build_object(
      'openInvoices', (SELECT COUNT(*) FROM public.platform_invoices WHERE status = 'open'),
      'pastDueInvoices', (SELECT COUNT(*) FROM public.platform_invoices WHERE status = 'past_due'),
      'failedPayments', (SELECT COUNT(*) FROM public.platform_payments WHERE status = 'failed'),
      'activeDiscounts', (SELECT COUNT(*) FROM public.platform_tenant_discounts WHERE status = 'active')
    ),
    'modules', jsonb_build_object(
      'betaActive', (SELECT COUNT(*) FROM public.platform_tenant_modules WHERE status = 'beta_enabled'),
      'trialExpiring', (SELECT COUNT(*) FROM public.platform_tenant_modules WHERE is_trial AND trial_ends_at < NOW() + INTERVAL '7 days')
    ),
    'system', jsonb_build_object(
      'activeFeatureFlags', (SELECT COUNT(*) FROM public.platform_feature_flags WHERE enabled = TRUE),
      'activeSupportSessions', (SELECT COUNT(*) FROM public.platform_support_sessions WHERE status = 'active'),
      'maintenanceMode', COALESCE(
        (SELECT (value #>> '{}')::boolean FROM public.platform_system_settings WHERE setting_key = 'maintenance_mode'),
        FALSE
      )
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.platform_get_dashboard_summary() TO authenticated;

-- --------------------------------------------------------------------------
-- RPC: Mandantenliste
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.platform_list_tenants(
  p_search TEXT DEFAULT NULL,
  p_status TEXT DEFAULT NULL,
  p_billing_status TEXT DEFAULT NULL,
  p_plan_key TEXT DEFAULT NULL,
  p_limit INTEGER DEFAULT 50,
  p_offset INTEGER DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB;
BEGIN
  IF NOT public.platform_has_capability('tenants.read') THEN
    RAISE EXCEPTION 'platform_forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT COALESCE(jsonb_agg(row_to_json(t)::jsonb ORDER BY t."createdAt" DESC), '[]'::jsonb)
  INTO v_result
  FROM (
    SELECT
      pt.id,
      pt.tenant_id AS "tenantId",
      pt.tenant_name AS "tenantName",
      pt.legal_name AS "legalName",
      pt.slug,
      pt.status,
      pt.lifecycle_status AS "lifecycleStatus",
      pt.billing_status AS "billingStatus",
      pt.plan_key AS "planKey",
      pt.trial_ends_at AS "trialEndsAt",
      pt.created_at AS "createdAt",
      pt.updated_at AS "updatedAt",
      (
        SELECT COUNT(*)::integer
        FROM public.platform_tenant_modules ptm
        WHERE ptm.tenant_id = pt.tenant_id AND ptm.status IN ('enabled', 'beta_enabled', 'trial')
      ) AS "activeModuleCount"
    FROM public.platform_tenants pt
    WHERE (p_status IS NULL OR pt.status = p_status)
      AND (p_billing_status IS NULL OR pt.billing_status = p_billing_status)
      AND (p_plan_key IS NULL OR pt.plan_key = p_plan_key)
      AND (
        p_search IS NULL OR p_search = '' OR
        pt.tenant_name ILIKE '%' || p_search || '%' OR
        pt.slug ILIKE '%' || p_search || '%' OR
        pt.primary_contact_email ILIKE '%' || p_search || '%' OR
        pt.tenant_id::text ILIKE '%' || p_search || '%'
      )
    ORDER BY pt.created_at DESC
    LIMIT GREATEST(1, LEAST(p_limit, 200))
    OFFSET GREATEST(0, p_offset)
  ) t;

  RETURN jsonb_build_object('items', v_result, 'limit', p_limit, 'offset', p_offset);
END;
$$;

GRANT EXECUTE ON FUNCTION public.platform_list_tenants(TEXT, TEXT, TEXT, TEXT, INTEGER, INTEGER) TO authenticated;

-- --------------------------------------------------------------------------
-- RPC: Mandantendetail
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.platform_get_tenant_detail(p_tenant_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant JSONB;
  v_modules JSONB;
  v_plan JSONB;
  v_discounts JSONB;
  v_invoices JSONB;
  v_payments JSONB;
BEGIN
  IF NOT public.platform_has_capability('tenants.read') THEN
    RAISE EXCEPTION 'platform_forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT row_to_json(pt)::jsonb INTO v_tenant
  FROM public.platform_tenants pt
  WHERE pt.tenant_id = p_tenant_id;

  IF v_tenant IS NULL THEN
    RAISE EXCEPTION 'tenant_not_found' USING ERRCODE = 'P0002';
  END IF;

  SELECT COALESCE(jsonb_agg(row_to_json(m)::jsonb), '[]'::jsonb) INTO v_modules
  FROM (
    SELECT pm.module_key AS "moduleKey", pm.module_name AS "moduleName",
           COALESCE(ptm.status, 'disabled') AS status,
           ptm.is_trial AS "isTrial", ptm.trial_ends_at AS "trialEndsAt",
           ptm.manual_override AS "manualOverride"
    FROM public.platform_modules pm
    LEFT JOIN public.platform_tenant_modules ptm
      ON ptm.module_key = pm.module_key AND ptm.tenant_id = p_tenant_id
    ORDER BY pm.module_name
  ) m;

  SELECT row_to_json(tp)::jsonb INTO v_plan
  FROM public.platform_tenant_plans tp
  WHERE tp.tenant_id = p_tenant_id AND tp.status = 'active'
  ORDER BY tp.starts_at DESC
  LIMIT 1;

  IF public.platform_has_capability('discounts.read') THEN
    SELECT COALESCE(jsonb_agg(row_to_json(d)::jsonb), '[]'::jsonb) INTO v_discounts
    FROM public.platform_tenant_discounts d
    WHERE d.tenant_id = p_tenant_id;
  END IF;

  IF public.platform_has_capability('billing.read') THEN
    SELECT COALESCE(jsonb_agg(row_to_json(i)::jsonb ORDER BY i.created_at DESC), '[]'::jsonb) INTO v_invoices
    FROM (SELECT * FROM public.platform_invoices WHERE tenant_id = p_tenant_id ORDER BY created_at DESC LIMIT 20) i;

    SELECT COALESCE(jsonb_agg(row_to_json(p)::jsonb ORDER BY p.created_at DESC), '[]'::jsonb) INTO v_payments
    FROM (SELECT * FROM public.platform_payments WHERE tenant_id = p_tenant_id ORDER BY created_at DESC LIMIT 20) p;
  END IF;

  RETURN jsonb_build_object(
    'tenant', v_tenant,
    'modules', v_modules,
    'plan', v_plan,
    'discounts', COALESCE(v_discounts, '[]'::jsonb),
    'invoices', COALESCE(v_invoices, '[]'::jsonb),
    'payments', COALESCE(v_payments, '[]'::jsonb)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.platform_get_tenant_detail(UUID) TO authenticated;

-- --------------------------------------------------------------------------
-- RPC: Mandantenstatus ändern
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.platform_update_tenant_status(
  p_tenant_id UUID,
  p_status TEXT,
  p_reason TEXT
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
  IF NOT public.platform_has_capability('tenants.suspend') THEN
    RAISE EXCEPTION 'platform_forbidden' USING ERRCODE = '42501';
  END IF;

  IF p_reason IS NULL OR trim(p_reason) = '' THEN
    RAISE EXCEPTION 'reason_required' USING ERRCODE = '22023';
  END IF;

  SELECT row_to_json(pt)::jsonb INTO v_before
  FROM public.platform_tenants pt WHERE pt.tenant_id = p_tenant_id;

  IF v_before IS NULL THEN
    RAISE EXCEPTION 'tenant_not_found' USING ERRCODE = 'P0002';
  END IF;

  UPDATE public.platform_tenants
  SET status = p_status,
      updated_at = NOW(),
      suspended_at = CASE WHEN p_status IN ('suspended', 'locked') THEN NOW() ELSE suspended_at END,
      terminated_at = CASE WHEN p_status = 'terminated' THEN NOW() ELSE terminated_at END
  WHERE tenant_id = p_tenant_id;

  SELECT row_to_json(pt)::jsonb INTO v_after
  FROM public.platform_tenants pt WHERE pt.tenant_id = p_tenant_id;

  PERFORM public.platform_write_audit_log(
    CASE p_status
      WHEN 'suspended' THEN 'tenant.suspended'
      WHEN 'locked' THEN 'tenant.locked'
      WHEN 'active' THEN 'tenant.unsuspended'
      ELSE 'tenant.status_changed'
    END,
    'platform_tenant',
    (v_after->>'id')::uuid,
    p_tenant_id,
    v_before,
    v_after,
    p_reason
  );

  RETURN v_after;
END;
$$;

GRANT EXECUTE ON FUNCTION public.platform_update_tenant_status(UUID, TEXT, TEXT) TO authenticated;

-- --------------------------------------------------------------------------
-- RPC: Modul aktivieren/deaktivieren
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.platform_set_tenant_module(
  p_tenant_id UUID,
  p_module_key TEXT,
  p_status TEXT,
  p_reason TEXT,
  p_is_trial BOOLEAN DEFAULT FALSE,
  p_trial_ends_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_before JSONB;
  v_after JSONB;
  v_requires TEXT[];
  v_missing TEXT;
BEGIN
  IF NOT public.platform_has_capability('modules.write') THEN
    RAISE EXCEPTION 'platform_forbidden' USING ERRCODE = '42501';
  END IF;

  IF p_reason IS NULL OR trim(p_reason) = '' THEN
    RAISE EXCEPTION 'reason_required' USING ERRCODE = '22023';
  END IF;

  SELECT requires_module_keys INTO v_requires
  FROM public.platform_modules WHERE module_key = p_module_key;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'module_not_found' USING ERRCODE = 'P0002';
  END IF;

  IF p_status IN ('enabled', 'beta_enabled', 'trial') AND array_length(v_requires, 1) > 0 THEN
    SELECT req INTO v_missing
    FROM unnest(v_requires) AS req
    WHERE NOT EXISTS (
      SELECT 1 FROM public.platform_tenant_modules ptm
      WHERE ptm.tenant_id = p_tenant_id
        AND ptm.module_key = req
        AND ptm.status IN ('enabled', 'beta_enabled', 'trial')
    )
    LIMIT 1;

    IF v_missing IS NOT NULL THEN
      RAISE EXCEPTION 'module_dependency_missing:%', v_missing USING ERRCODE = '23503';
    END IF;
  END IF;

  SELECT row_to_json(ptm)::jsonb INTO v_before
  FROM public.platform_tenant_modules ptm
  WHERE ptm.tenant_id = p_tenant_id AND ptm.module_key = p_module_key;

  INSERT INTO public.platform_tenant_modules (
    tenant_id, module_key, status, enabled_at, disabled_at,
    is_trial, trial_ends_at, manual_override, override_reason, enabled_by, disabled_by
  ) VALUES (
    p_tenant_id, p_module_key, p_status,
    CASE WHEN p_status IN ('enabled', 'beta_enabled', 'trial') THEN NOW() ELSE NULL END,
    CASE WHEN p_status = 'disabled' THEN NOW() ELSE NULL END,
    p_is_trial, p_trial_ends_at, TRUE, p_reason,
    CASE WHEN p_status IN ('enabled', 'beta_enabled', 'trial') THEN auth.uid() ELSE NULL END,
    CASE WHEN p_status = 'disabled' THEN auth.uid() ELSE NULL END
  )
  ON CONFLICT (tenant_id, module_key) DO UPDATE SET
    status = EXCLUDED.status,
    enabled_at = EXCLUDED.enabled_at,
    disabled_at = EXCLUDED.disabled_at,
    is_trial = EXCLUDED.is_trial,
    trial_ends_at = EXCLUDED.trial_ends_at,
    manual_override = TRUE,
    override_reason = EXCLUDED.override_reason,
    enabled_by = EXCLUDED.enabled_by,
    disabled_by = EXCLUDED.disabled_by,
    updated_at = NOW();

  SELECT row_to_json(ptm)::jsonb INTO v_after
  FROM public.platform_tenant_modules ptm
  WHERE ptm.tenant_id = p_tenant_id AND ptm.module_key = p_module_key;

  PERFORM public.platform_write_audit_log(
    CASE WHEN p_status = 'disabled' THEN 'module.disabled' ELSE 'module.enabled' END,
    'platform_tenant_module',
    (v_after->>'id')::uuid,
    p_tenant_id,
    v_before,
    v_after,
    p_reason
  );

  RETURN v_after;
END;
$$;

GRANT EXECUTE ON FUNCTION public.platform_set_tenant_module(UUID, TEXT, TEXT, TEXT, BOOLEAN, TIMESTAMPTZ) TO authenticated;

-- --------------------------------------------------------------------------
-- RPC: Tarif zuweisen
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.platform_assign_plan(
  p_tenant_id UUID,
  p_plan_key TEXT,
  p_reason TEXT,
  p_billing_interval TEXT DEFAULT 'monthly',
  p_custom_monthly_cents INTEGER DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan public.platform_plans%ROWTYPE;
  v_before JSONB;
  v_after JSONB;
  v_new_id UUID;
BEGIN
  IF NOT public.platform_has_capability('plans.write') THEN
    RAISE EXCEPTION 'platform_forbidden' USING ERRCODE = '42501';
  END IF;

  IF p_reason IS NULL OR trim(p_reason) = '' THEN
    RAISE EXCEPTION 'reason_required' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_plan FROM public.platform_plans WHERE plan_key = p_plan_key;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'plan_not_found' USING ERRCODE = 'P0002';
  END IF;

  SELECT row_to_json(tp)::jsonb INTO v_before
  FROM public.platform_tenant_plans tp
  WHERE tp.tenant_id = p_tenant_id AND tp.status = 'active'
  LIMIT 1;

  UPDATE public.platform_tenant_plans
  SET status = 'cancelled', updated_at = NOW()
  WHERE tenant_id = p_tenant_id AND status = 'active';

  INSERT INTO public.platform_tenant_plans (
    tenant_id, plan_key, status, billing_interval,
    monthly_price_cents, yearly_price_cents, assigned_by
  ) VALUES (
    p_tenant_id, p_plan_key, 'active', p_billing_interval,
    COALESCE(p_custom_monthly_cents, v_plan.monthly_price_cents),
    v_plan.yearly_price_cents,
    auth.uid()
  )
  RETURNING id INTO v_new_id;

  UPDATE public.platform_tenants
  SET plan_key = p_plan_key, updated_at = NOW()
  WHERE tenant_id = p_tenant_id;

  SELECT row_to_json(tp)::jsonb INTO v_after
  FROM public.platform_tenant_plans tp WHERE tp.id = v_new_id;

  PERFORM public.platform_write_audit_log(
    'plan.assigned', 'platform_tenant_plan', v_new_id, p_tenant_id,
    v_before, v_after, p_reason
  );

  RETURN v_after;
END;
$$;

GRANT EXECUTE ON FUNCTION public.platform_assign_plan(UUID, TEXT, TEXT, TEXT, INTEGER) TO authenticated;

-- --------------------------------------------------------------------------
-- RPC: Rabatt zuweisen / entfernen
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.platform_assign_discount(
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
DECLARE
  v_after JSONB;
BEGIN
  IF NOT public.platform_has_capability('discounts.write') THEN
    RAISE EXCEPTION 'platform_forbidden' USING ERRCODE = '42501';
  END IF;

  IF p_reason IS NULL OR trim(p_reason) = '' THEN
    RAISE EXCEPTION 'reason_required' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.platform_tenant_discounts (tenant_id, discount_key, status, starts_at, ends_at, applied_by, reason)
  VALUES (p_tenant_id, p_discount_key, 'active', p_starts_at, p_ends_at, auth.uid(), p_reason)
  ON CONFLICT (tenant_id, discount_key) DO UPDATE SET
    status = 'active', starts_at = EXCLUDED.starts_at, ends_at = EXCLUDED.ends_at,
    applied_by = auth.uid(), reason = EXCLUDED.reason, updated_at = NOW()
  RETURNING row_to_json(platform_tenant_discounts)::jsonb INTO v_after;

  PERFORM public.platform_write_audit_log(
    'discount.assigned', 'platform_tenant_discount', (v_after->>'id')::uuid,
    p_tenant_id, NULL, v_after, p_reason
  );

  RETURN v_after;
END;
$$;

GRANT EXECUTE ON FUNCTION public.platform_assign_discount(UUID, TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;

CREATE OR REPLACE FUNCTION public.platform_remove_discount(
  p_tenant_id UUID,
  p_discount_key TEXT,
  p_reason TEXT
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
  IF NOT public.platform_has_capability('discounts.write') THEN
    RAISE EXCEPTION 'platform_forbidden' USING ERRCODE = '42501';
  END IF;

  IF p_reason IS NULL OR trim(p_reason) = '' THEN
    RAISE EXCEPTION 'reason_required' USING ERRCODE = '22023';
  END IF;

  SELECT row_to_json(d)::jsonb INTO v_before
  FROM public.platform_tenant_discounts d
  WHERE d.tenant_id = p_tenant_id AND d.discount_key = p_discount_key;

  UPDATE public.platform_tenant_discounts
  SET status = 'revoked', updated_at = NOW()
  WHERE tenant_id = p_tenant_id AND discount_key = p_discount_key
  RETURNING row_to_json(platform_tenant_discounts)::jsonb INTO v_after;

  PERFORM public.platform_write_audit_log(
    'discount.removed', 'platform_tenant_discount', (v_after->>'id')::uuid,
    p_tenant_id, v_before, v_after, p_reason
  );

  RETURN v_after;
END;
$$;

GRANT EXECUTE ON FUNCTION public.platform_remove_discount(UUID, TEXT, TEXT) TO authenticated;

-- --------------------------------------------------------------------------
-- RPC: Rechnungsstatus
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.platform_update_invoice_status(
  p_invoice_id UUID,
  p_status TEXT,
  p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_before JSONB;
  v_after JSONB;
  v_tenant_id UUID;
BEGIN
  IF NOT public.platform_has_capability('billing.write') THEN
    RAISE EXCEPTION 'platform_forbidden' USING ERRCODE = '42501';
  END IF;

  IF p_reason IS NULL OR trim(p_reason) = '' THEN
    RAISE EXCEPTION 'reason_required' USING ERRCODE = '22023';
  END IF;

  SELECT row_to_json(i)::jsonb, i.tenant_id INTO v_before, v_tenant_id
  FROM public.platform_invoices i WHERE i.id = p_invoice_id;

  IF v_before IS NULL THEN
    RAISE EXCEPTION 'invoice_not_found' USING ERRCODE = 'P0002';
  END IF;

  UPDATE public.platform_invoices
  SET status = p_status,
      paid_at = CASE WHEN p_status = 'paid' THEN NOW() ELSE paid_at END,
      cancelled_at = CASE WHEN p_status = 'cancelled' THEN NOW() ELSE cancelled_at END,
      updated_at = NOW()
  WHERE id = p_invoice_id
  RETURNING row_to_json(platform_invoices)::jsonb INTO v_after;

  PERFORM public.platform_write_audit_log(
    'invoice.status_changed', 'platform_invoice', p_invoice_id,
    v_tenant_id, v_before, v_after, p_reason
  );

  RETURN v_after;
END;
$$;

GRANT EXECUTE ON FUNCTION public.platform_update_invoice_status(UUID, TEXT, TEXT) TO authenticated;

-- --------------------------------------------------------------------------
-- RPC: Manuelle Zahlung
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.platform_record_manual_payment(
  p_tenant_id UUID,
  p_invoice_id UUID,
  p_amount_cents INTEGER,
  p_status TEXT,
  p_reason TEXT,
  p_payment_method TEXT DEFAULT 'manual'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_after JSONB;
  v_id UUID;
BEGIN
  IF NOT public.platform_has_capability('payments.write') THEN
    RAISE EXCEPTION 'platform_forbidden' USING ERRCODE = '42501';
  END IF;

  IF p_reason IS NULL OR trim(p_reason) = '' THEN
    RAISE EXCEPTION 'reason_required' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.platform_payments (
    tenant_id, invoice_id, provider, payment_method, status,
    amount_cents, paid_at
  ) VALUES (
    p_tenant_id, p_invoice_id, 'manual', p_payment_method, p_status,
    p_amount_cents,
    CASE WHEN p_status = 'succeeded' THEN NOW() ELSE NULL END
  )
  RETURNING id, row_to_json(platform_payments)::jsonb INTO v_id, v_after;

  PERFORM public.platform_write_audit_log(
    'payment.recorded', 'platform_payment', v_id, p_tenant_id, NULL, v_after, p_reason
  );

  RETURN v_after;
END;
$$;

GRANT EXECUTE ON FUNCTION public.platform_record_manual_payment(UUID, UUID, INTEGER, TEXT, TEXT, TEXT) TO authenticated;

-- --------------------------------------------------------------------------
-- RPC: Feature Flag
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.platform_set_feature_flag(
  p_flag_key TEXT,
  p_enabled BOOLEAN,
  p_reason TEXT,
  p_scope TEXT DEFAULT 'global',
  p_tenant_id UUID DEFAULT NULL,
  p_rollout_percentage INTEGER DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_before JSONB;
  v_after JSONB;
  v_id UUID;
BEGIN
  IF NOT public.platform_has_capability('flags.write') THEN
    RAISE EXCEPTION 'platform_forbidden' USING ERRCODE = '42501';
  END IF;

  IF p_reason IS NULL OR trim(p_reason) = '' THEN
    RAISE EXCEPTION 'reason_required' USING ERRCODE = '22023';
  END IF;

  IF p_scope = 'global' THEN
    SELECT row_to_json(f)::jsonb INTO v_before
    FROM public.platform_feature_flags f
    WHERE f.flag_key = p_flag_key AND f.scope = 'global' AND f.tenant_id IS NULL;
  ELSE
    SELECT row_to_json(f)::jsonb INTO v_before
    FROM public.platform_feature_flags f
    WHERE f.flag_key = p_flag_key AND f.tenant_id = p_tenant_id;
  END IF;

  INSERT INTO public.platform_feature_flags (
    flag_key, scope, tenant_id, enabled, rollout_percentage, created_by, updated_by
  ) VALUES (
    p_flag_key, p_scope, p_tenant_id, p_enabled, p_rollout_percentage, auth.uid(), auth.uid()
  )
  ON CONFLICT DO NOTHING;

  IF p_scope = 'global' THEN
    UPDATE public.platform_feature_flags
    SET enabled = p_enabled, rollout_percentage = p_rollout_percentage,
        updated_by = auth.uid(), updated_at = NOW()
    WHERE flag_key = p_flag_key AND scope = 'global' AND tenant_id IS NULL
    RETURNING id, row_to_json(platform_feature_flags)::jsonb INTO v_id, v_after;
  ELSE
    UPDATE public.platform_feature_flags
    SET enabled = p_enabled, rollout_percentage = p_rollout_percentage,
        updated_by = auth.uid(), updated_at = NOW()
    WHERE flag_key = p_flag_key AND tenant_id = p_tenant_id
    RETURNING id, row_to_json(platform_feature_flags)::jsonb INTO v_id, v_after;
  END IF;

  PERFORM public.platform_write_audit_log(
    'feature_flag.changed', 'platform_feature_flag', v_id, p_tenant_id,
    v_before, v_after, p_reason
  );

  RETURN v_after;
END;
$$;

GRANT EXECUTE ON FUNCTION public.platform_set_feature_flag(TEXT, BOOLEAN, TEXT, TEXT, UUID, INTEGER) TO authenticated;

-- --------------------------------------------------------------------------
-- RPC: Support-Session
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.platform_start_support_session(
  p_tenant_id UUID,
  p_reason TEXT,
  p_expires_at TIMESTAMPTZ,
  p_readonly BOOLEAN DEFAULT TRUE,
  p_allowed_scopes TEXT[] DEFAULT '{}'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_platform_user_id UUID;
  v_after JSONB;
  v_id UUID;
BEGIN
  IF NOT public.platform_has_capability('support.write') THEN
    RAISE EXCEPTION 'platform_forbidden' USING ERRCODE = '42501';
  END IF;

  IF p_reason IS NULL OR trim(p_reason) = '' THEN
    RAISE EXCEPTION 'reason_required' USING ERRCODE = '22023';
  END IF;

  IF NOT p_readonly AND public.platform_current_role() NOT IN ('platform_owner', 'platform_admin') THEN
    RAISE EXCEPTION 'platform_forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT id INTO v_platform_user_id
  FROM public.platform_users WHERE user_id = auth.uid() AND status = 'active';

  INSERT INTO public.platform_support_sessions (
    tenant_id, platform_user_id, reason, expires_at, readonly, allowed_scopes
  ) VALUES (
    p_tenant_id, v_platform_user_id, p_reason, p_expires_at, p_readonly, p_allowed_scopes
  )
  RETURNING id, row_to_json(platform_support_sessions)::jsonb INTO v_id, v_after;

  PERFORM public.platform_write_audit_log(
    'support_session.started', 'platform_support_session', v_id,
    p_tenant_id, NULL, v_after, p_reason
  );

  RETURN v_after;
END;
$$;

GRANT EXECUTE ON FUNCTION public.platform_start_support_session(UUID, TEXT, TIMESTAMPTZ, BOOLEAN, TEXT[]) TO authenticated;

CREATE OR REPLACE FUNCTION public.platform_end_support_session(
  p_session_id UUID,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_before JSONB;
  v_after JSONB;
  v_tenant_id UUID;
BEGIN
  IF NOT public.platform_has_capability('support.write') THEN
    RAISE EXCEPTION 'platform_forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT row_to_json(s)::jsonb, s.tenant_id INTO v_before, v_tenant_id
  FROM public.platform_support_sessions s WHERE s.id = p_session_id;

  UPDATE public.platform_support_sessions
  SET status = 'closed', ends_at = NOW()
  WHERE id = p_session_id
  RETURNING row_to_json(platform_support_sessions)::jsonb INTO v_after;

  PERFORM public.platform_write_audit_log(
    'support_session.ended', 'platform_support_session', p_session_id,
    v_tenant_id, v_before, v_after, p_reason
  );

  RETURN v_after;
END;
$$;

GRANT EXECUTE ON FUNCTION public.platform_end_support_session(UUID, TEXT) TO authenticated;

-- --------------------------------------------------------------------------
-- RPC: Systemeinstellungen
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.platform_update_system_setting(
  p_setting_key TEXT,
  p_value JSONB,
  p_reason TEXT
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
  IF NOT public.platform_has_capability('system.write') THEN
    RAISE EXCEPTION 'platform_forbidden' USING ERRCODE = '42501';
  END IF;

  IF p_reason IS NULL OR trim(p_reason) = '' THEN
    RAISE EXCEPTION 'reason_required' USING ERRCODE = '22023';
  END IF;

  SELECT row_to_json(s)::jsonb INTO v_before
  FROM public.platform_system_settings s WHERE s.setting_key = p_setting_key;

  UPDATE public.platform_system_settings
  SET value = p_value, updated_by = auth.uid(), updated_at = NOW()
  WHERE setting_key = p_setting_key
  RETURNING row_to_json(platform_system_settings)::jsonb INTO v_after;

  PERFORM public.platform_write_audit_log(
    'system_setting.changed', 'platform_system_setting',
    (v_after->>'id')::uuid, NULL, v_before, v_after, p_reason
  );

  RETURN v_after;
END;
$$;

GRANT EXECUTE ON FUNCTION public.platform_update_system_setting(TEXT, JSONB, TEXT) TO authenticated;

-- --------------------------------------------------------------------------
-- RPC: Audit-Log abfragen
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.platform_list_audit_log(
  p_tenant_id UUID DEFAULT NULL,
  p_action TEXT DEFAULT NULL,
  p_limit INTEGER DEFAULT 50,
  p_offset INTEGER DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB;
BEGIN
  IF NOT public.platform_has_capability('audit.read') THEN
    RAISE EXCEPTION 'platform_forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT COALESCE(jsonb_agg(row_to_json(a)::jsonb ORDER BY a.created_at DESC), '[]'::jsonb)
  INTO v_result
  FROM (
    SELECT * FROM public.platform_audit_log
    WHERE (p_tenant_id IS NULL OR tenant_id = p_tenant_id)
      AND (p_action IS NULL OR action = p_action)
    ORDER BY created_at DESC
    LIMIT GREATEST(1, LEAST(p_limit, 200))
    OFFSET GREATEST(0, p_offset)
  ) a;

  RETURN jsonb_build_object('items', v_result);
END;
$$;

GRANT EXECUTE ON FUNCTION public.platform_list_audit_log(UUID, TEXT, INTEGER, INTEGER) TO authenticated;

-- --------------------------------------------------------------------------
-- GRANTs auf Tabellen (SELECT only via RLS)
-- --------------------------------------------------------------------------
GRANT SELECT ON public.platform_users TO authenticated;
GRANT SELECT ON public.platform_tenants TO authenticated;
GRANT SELECT ON public.platform_modules TO authenticated;
GRANT SELECT ON public.platform_tenant_modules TO authenticated;
GRANT SELECT ON public.platform_plans TO authenticated;
GRANT SELECT ON public.platform_tenant_plans TO authenticated;
GRANT SELECT ON public.platform_discounts TO authenticated;
GRANT SELECT ON public.platform_tenant_discounts TO authenticated;
GRANT SELECT ON public.platform_invoices TO authenticated;
GRANT SELECT ON public.platform_payments TO authenticated;
GRANT SELECT ON public.platform_feature_flags TO authenticated;
GRANT SELECT ON public.platform_support_sessions TO authenticated;
GRANT SELECT ON public.platform_audit_log TO authenticated;
GRANT SELECT ON public.platform_system_settings TO authenticated;
