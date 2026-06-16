-- ==========================================================================
-- CareSuite+ — Migration 0050: Mandanten-Onboarding & Datenqualität (vorbereitet)
-- Onboarding-Sessions, Firmenprofile, Startfreigabe, Audit.
-- NICHT pushen — nur Schema-Vorbereitung.
-- ==========================================================================

CREATE TABLE IF NOT EXISTS public.tenant_company_profiles (
  id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name                    TEXT        NOT NULL,
  legal_form              TEXT,
  industry                TEXT,
  street                  TEXT,
  zip                     TEXT,
  city                    TEXT,
  phone                   TEXT,
  email                   TEXT,
  management_name         TEXT,
  register_number         TEXT,
  tax_id                  TEXT,
  vat_id                  TEXT,
  ik_number               TEXT,
  bank_name               TEXT,
  iban                    TEXT,
  payment_terms_days      INTEGER,
  tax_status              TEXT,
  statutory_billing_active BOOLEAN    NOT NULL DEFAULT FALSE,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id)
);

CREATE TABLE IF NOT EXISTS public.tenant_module_setup (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  active_modules  JSONB       NOT NULL DEFAULT '[]'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id)
);

CREATE TABLE IF NOT EXISTS public.tenant_onboarding_sessions (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  overall_status    TEXT        NOT NULL DEFAULT 'not_started'
    CHECK (overall_status IN (
      'not_started', 'in_progress', 'blocked', 'ready_for_internal_test',
      'ready_for_pilot', 'completed', 'reopened'
    )),
  current_step_key  TEXT        NOT NULL DEFAULT 'company_data',
  started_at        TIMESTAMPTZ,
  completed_at      TIMESTAMPTZ,
  last_saved_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id)
);

CREATE TABLE IF NOT EXISTS public.tenant_onboarding_steps (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id    UUID        NOT NULL REFERENCES public.tenant_onboarding_sessions(id) ON DELETE CASCADE,
  tenant_id     UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  step_key      TEXT        NOT NULL,
  status        TEXT        NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'completed', 'warning', 'blocked', 'skipped', 'not_applicable')),
  completed_at  TIMESTAMPTZ,
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (session_id, step_key)
);

CREATE TABLE IF NOT EXISTS public.tenant_onboarding_check_results (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id    UUID        NOT NULL REFERENCES public.tenant_onboarding_sessions(id) ON DELETE CASCADE,
  tenant_id     UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  check_key     TEXT        NOT NULL,
  status        TEXT        NOT NULL CHECK (status IN ('passed', 'warning', 'failed')),
  message       TEXT        NOT NULL,
  evaluated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.tenant_start_readiness_checks (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  session_id        UUID        NOT NULL REFERENCES public.tenant_onboarding_sessions(id) ON DELETE CASCADE,
  overall_ready     BOOLEAN     NOT NULL DEFAULT FALSE,
  recommended_status TEXT       NOT NULL,
  report_json       JSONB       NOT NULL DEFAULT '{}'::jsonb,
  evaluated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.tenant_onboarding_audit_events (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  session_id  UUID        NOT NULL REFERENCES public.tenant_onboarding_sessions(id) ON DELETE CASCADE,
  action      TEXT        NOT NULL,
  step_key    TEXT,
  detail      TEXT        NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tenant_onboarding_sessions_tenant
  ON public.tenant_onboarding_sessions (tenant_id);

CREATE INDEX IF NOT EXISTS idx_tenant_onboarding_steps_session
  ON public.tenant_onboarding_steps (session_id, step_key);

CREATE INDEX IF NOT EXISTS idx_tenant_onboarding_audit_tenant
  ON public.tenant_onboarding_audit_events (tenant_id, created_at DESC);
