-- ==========================================================================
-- CareSuite+ — Migration 0052: Mitarbeiter-Offboarding (vorbereitet)
-- Sessions, Schritte, Prüfungen, Zugangssperren, Endfreigabe, Audit.
-- NICHT pushen — nur Schema-Vorbereitung (Prompt 78).
-- ==========================================================================

CREATE TABLE IF NOT EXISTS public.employee_offboarding_sessions (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  employee_id         UUID        NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  overall_status      TEXT        NOT NULL DEFAULT 'not_started'
    CHECK (overall_status IN (
      'not_started', 'in_progress', 'blocked', 'ready_for_clearance', 'completed', 'reopened'
    )),
  current_step_key    TEXT        NOT NULL DEFAULT 'exit_date',
  exit_date           DATE,
  termination_type    TEXT
    CHECK (termination_type IS NULL OR termination_type IN (
      'voluntary', 'employer_initiated', 'mutual', 'contract_end', 'retirement', 'other'
    )),
  internal_reason     TEXT,
  responsible_user_id UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  started_at          TIMESTAMPTZ,
  completed_at        TIMESTAMPTZ,
  last_saved_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, employee_id)
);

CREATE TABLE IF NOT EXISTS public.employee_offboarding_steps (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id          UUID        NOT NULL REFERENCES public.employee_offboarding_sessions(id) ON DELETE CASCADE,
  tenant_id           UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  employee_id         UUID        NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  step_key            TEXT        NOT NULL,
  status              TEXT        NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'in_progress', 'completed', 'blocked', 'skipped', 'not_applicable')),
  responsible_user_id UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  completed_at        TIMESTAMPTZ,
  notes               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (session_id, step_key)
);

CREATE TABLE IF NOT EXISTS public.employee_offboarding_checks (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id    UUID        NOT NULL REFERENCES public.employee_offboarding_sessions(id) ON DELETE CASCADE,
  tenant_id     UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  employee_id   UUID        NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  check_key     TEXT        NOT NULL,
  status        TEXT        NOT NULL CHECK (status IN ('passed', 'warning', 'failed')),
  message       TEXT        NOT NULL,
  count_value   INTEGER,
  evaluated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.employee_access_revocations (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id          UUID        NOT NULL REFERENCES public.employee_offboarding_sessions(id) ON DELETE CASCADE,
  tenant_id           UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  employee_id         UUID        NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  kind                TEXT        NOT NULL
    CHECK (kind IN ('portal', 'email', 'phone', 'cloud', 'keys', 'device')),
  status              TEXT        NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'prepared', 'locked', 'failed')),
  provider_connected  BOOLEAN     NOT NULL DEFAULT FALSE,
  prepared_at         TIMESTAMPTZ,
  locked_at           TIMESTAMPTZ,
  actor_id            UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  notes               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (session_id, kind)
);

CREATE TABLE IF NOT EXISTS public.employee_final_clearance (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id            UUID        NOT NULL REFERENCES public.employee_offboarding_sessions(id) ON DELETE CASCADE,
  tenant_id             UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  employee_id           UUID        NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  cleared_by            UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  cleared_at            TIMESTAMPTZ,
  protocol_document_id  UUID,
  protocol_generated_at TIMESTAMPTZ,
  archived_at           TIMESTAMPTZ,
  employment_status_after TEXT
    CHECK (employment_status_after IS NULL OR employment_status_after IN ('terminated', 'archived')),
  notes                 TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (session_id)
);

CREATE TABLE IF NOT EXISTS public.offboarding_audit_events (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  session_id  UUID        NOT NULL REFERENCES public.employee_offboarding_sessions(id) ON DELETE CASCADE,
  employee_id UUID        NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  action      TEXT        NOT NULL,
  step_key    TEXT,
  detail      TEXT        NOT NULL,
  actor_id    UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_employee_offboarding_sessions_tenant
  ON public.employee_offboarding_sessions (tenant_id, employee_id);

CREATE INDEX IF NOT EXISTS idx_employee_offboarding_steps_session
  ON public.employee_offboarding_steps (session_id, step_key);

CREATE INDEX IF NOT EXISTS idx_employee_offboarding_checks_session
  ON public.employee_offboarding_checks (session_id, check_key);

CREATE INDEX IF NOT EXISTS idx_offboarding_audit_tenant
  ON public.offboarding_audit_events (tenant_id, created_at DESC);

COMMENT ON TABLE public.employee_offboarding_sessions IS 'Mitarbeiter-Offboarding — Austrittsprozess (Prompt 78, vorbereitet)';
