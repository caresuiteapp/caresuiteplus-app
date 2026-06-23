-- ==========================================================================
-- CareSuite+ — Migration 0162: Content Portal environment repair (idempotent)
-- Repairs missing 0056 tables if remote history diverged; seeds tenant modes.
-- ==========================================================================

CREATE TABLE IF NOT EXISTS public.environment_modes (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  mode_key            TEXT        NOT NULL UNIQUE
    CHECK (mode_key IN ('demo', 'sandbox', 'pilot', 'internal_test', 'production')),
  label               TEXT        NOT NULL,
  description         TEXT,
  allows_real_data    BOOLEAN     NOT NULL DEFAULT FALSE,
  allows_mock_providers BOOLEAN   NOT NULL DEFAULT FALSE,
  allows_demo_fallback BOOLEAN    NOT NULL DEFAULT FALSE,
  requires_banner     BOOLEAN     NOT NULL DEFAULT FALSE,
  is_active           BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.tenant_environment_settings (
  id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  mode                    TEXT        NOT NULL DEFAULT 'production'
    CHECK (mode IN ('demo', 'sandbox', 'pilot', 'internal_test', 'production')),
  demo_data_set_key       TEXT,
  is_pilot_tenant         BOOLEAN     NOT NULL DEFAULT FALSE,
  pilot_phase             TEXT,
  show_known_risks        BOOLEAN     NOT NULL DEFAULT FALSE,
  feedback_module_prepared BOOLEAN    NOT NULL DEFAULT FALSE,
  provider_sandbox_only   BOOLEAN     NOT NULL DEFAULT FALSE,
  notes                   TEXT,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id)
);

CREATE TABLE IF NOT EXISTS public.demo_data_sets (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  data_set_key        TEXT        NOT NULL UNIQUE,
  label               TEXT        NOT NULL,
  tenant_id           UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  is_synthetic        BOOLEAN     NOT NULL DEFAULT TRUE,
  contains_real_data  BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.environment_audit_events (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID        REFERENCES public.tenants(id) ON DELETE SET NULL,
  event_type      TEXT        NOT NULL,
  mode            TEXT        NOT NULL
    CHECK (mode IN ('demo', 'sandbox', 'pilot', 'internal_test', 'production')),
  summary         TEXT        NOT NULL,
  metadata        JSONB       NOT NULL DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tenant_environment_settings_tenant
  ON public.tenant_environment_settings (tenant_id);

INSERT INTO public.environment_modes (mode_key, label, allows_real_data, allows_mock_providers, allows_demo_fallback, requires_banner)
VALUES
  ('demo', 'Demo', false, true, true, true),
  ('sandbox', 'Sandbox', false, true, true, true),
  ('pilot', 'Pilot', true, false, false, true),
  ('internal_test', 'Interner Test', false, true, false, true),
  ('production', 'Produktion', true, false, false, false)
ON CONFLICT (mode_key) DO NOTHING;

-- LIVE whitelist (confirmed) + E2E / pilot / internal_test tenants
INSERT INTO public.tenant_environment_settings (tenant_id, mode, is_pilot_tenant, notes)
VALUES
  ('56180c22-b894-4fab-b55e-a563c94dd6e7', 'production', false, 'LIVE whitelist — Helferhasen+ UG'),
  ('a4ba83bd-65db-46cf-8cf7-61492cc78315', 'internal_test', false, 'E2E Test Pflege GmbH'),
  ('6e8a5c3b-03fd-423d-acd9-00edf9b24f99', 'internal_test', false, 'E2E Test Pflege Live GmbH'),
  ('3d6220dd-7e10-478a-97c7-f8d5c0a99c32', 'internal_test', false, 'Pilot verify sandbox'),
  ('11111111-1111-1111-1111-111111111101', 'pilot', true, 'Pilot tenant Köln'),
  ('11111111-1111-1111-1111-111111111102', 'pilot', true, 'Pilot tenant Düsseldorf'),
  ('11111111-1111-1111-1111-111111111103', 'pilot', true, 'Pilot tenant Bonn')
ON CONFLICT (tenant_id) DO UPDATE
  SET mode = EXCLUDED.mode,
      is_pilot_tenant = EXCLUDED.is_pilot_tenant,
      notes = EXCLUDED.notes,
      updated_at = NOW();
