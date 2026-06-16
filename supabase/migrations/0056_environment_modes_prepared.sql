-- ==========================================================================
-- CareSuite+ — Migration 0056: Umgebungsmodi & Mandantentrennung (vorbereitet)
-- Demo, Sandbox, Pilot, Interner Test, Produktion — auditierbar.
-- NICHT pushen — nur Schema-Vorbereitung.
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

CREATE TABLE IF NOT EXISTS public.pilot_readiness_checks (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  check_key       TEXT        NOT NULL,
  status          TEXT        NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'passed', 'warning', 'failed')),
  message         TEXT        NOT NULL,
  evaluated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, check_key)
);

CREATE TABLE IF NOT EXISTS public.environment_audit_events (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID        REFERENCES public.tenants(id) ON DELETE SET NULL,
  event_type      TEXT        NOT NULL
    CHECK (event_type IN (
      'mode_resolved', 'demo_data_blocked', 'mock_provider_blocked',
      'demo_fallback_blocked', 'provider_sandbox_labeled',
      'tenant_settings_updated', 'pilot_marked'
    )),
  mode            TEXT        NOT NULL
    CHECK (mode IN ('demo', 'sandbox', 'pilot', 'internal_test', 'production')),
  summary         TEXT        NOT NULL,
  metadata        JSONB       NOT NULL DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tenant_environment_settings_tenant
  ON public.tenant_environment_settings (tenant_id);

CREATE INDEX IF NOT EXISTS idx_demo_data_sets_tenant
  ON public.demo_data_sets (tenant_id);

CREATE INDEX IF NOT EXISTS idx_pilot_readiness_checks_tenant
  ON public.pilot_readiness_checks (tenant_id);

CREATE INDEX IF NOT EXISTS idx_environment_audit_events_tenant_created
  ON public.environment_audit_events (tenant_id, created_at DESC);

ALTER TABLE public.environment_modes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_environment_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.demo_data_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pilot_readiness_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.environment_audit_events ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.environment_modes IS
  'Globale Modusdefinitionen — Demo/Sandbox/Pilot/Interner Test/Produktion.';
COMMENT ON TABLE public.tenant_environment_settings IS
  'Mandantenspezifische Umgebung — Pilot-Kennzeichnung und Demo-Datensatz-Referenz.';
COMMENT ON TABLE public.environment_audit_events IS
  'Audit-Trail für Modusauflösung und Blockierungen (append-only vorbereitet).';
