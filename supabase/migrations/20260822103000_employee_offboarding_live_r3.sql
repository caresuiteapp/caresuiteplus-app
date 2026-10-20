-- CareSuite HealthOS · Personal R3 · live offboarding persistence repair
-- Additive and idempotent. No personnel or workflow data is removed.

BEGIN;

ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS exit_date DATE;

CREATE TABLE IF NOT EXISTS public.employee_offboarding_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  overall_status TEXT NOT NULL DEFAULT 'not_started'
    CHECK (overall_status IN ('not_started', 'in_progress', 'blocked', 'ready_for_clearance', 'completed', 'reopened')),
  current_step_key TEXT NOT NULL DEFAULT 'exit_date',
  exit_date DATE,
  termination_type TEXT
    CHECK (termination_type IS NULL OR termination_type IN ('voluntary', 'employer_initiated', 'mutual', 'contract_end', 'retirement', 'other')),
  internal_reason TEXT,
  responsible_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  last_saved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, employee_id)
);

CREATE TABLE IF NOT EXISTS public.employee_offboarding_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.employee_offboarding_sessions(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  step_key TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'in_progress', 'completed', 'blocked', 'skipped', 'not_applicable')),
  responsible_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  completed_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (session_id, step_key)
);

CREATE TABLE IF NOT EXISTS public.employee_offboarding_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.employee_offboarding_sessions(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  check_key TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('passed', 'warning', 'failed')),
  message TEXT NOT NULL,
  count_value INTEGER,
  evaluated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.employee_access_revocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.employee_offboarding_sessions(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('portal', 'email', 'phone', 'cloud', 'keys', 'device')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'prepared', 'locked', 'failed')),
  provider_connected BOOLEAN NOT NULL DEFAULT FALSE,
  prepared_at TIMESTAMPTZ,
  locked_at TIMESTAMPTZ,
  actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (session_id, kind)
);

CREATE TABLE IF NOT EXISTS public.employee_final_clearance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.employee_offboarding_sessions(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  cleared_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  cleared_at TIMESTAMPTZ,
  protocol_document_id TEXT,
  protocol_generated_at TIMESTAMPTZ,
  archived_at TIMESTAMPTZ,
  employment_status_after TEXT CHECK (employment_status_after IS NULL OR employment_status_after IN ('terminated', 'archived')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (session_id)
);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'employee_final_clearance'
      AND column_name = 'protocol_document_id'
      AND data_type = 'uuid'
  ) THEN
    ALTER TABLE public.employee_final_clearance
      ALTER COLUMN protocol_document_id TYPE TEXT USING protocol_document_id::TEXT;
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS public.offboarding_audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES public.employee_offboarding_sessions(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  step_key TEXT,
  detail TEXT NOT NULL,
  actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_employee_offboarding_sessions_tenant_employee
  ON public.employee_offboarding_sessions (tenant_id, employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_offboarding_steps_session
  ON public.employee_offboarding_steps (session_id, step_key);
CREATE INDEX IF NOT EXISTS idx_employee_offboarding_checks_session
  ON public.employee_offboarding_checks (session_id, check_key);
CREATE INDEX IF NOT EXISTS idx_employee_access_revocations_session
  ON public.employee_access_revocations (session_id, kind);
CREATE INDEX IF NOT EXISTS idx_employee_final_clearance_session
  ON public.employee_final_clearance (session_id);
CREATE INDEX IF NOT EXISTS idx_offboarding_audit_tenant_session
  ON public.offboarding_audit_events (tenant_id, session_id, created_at DESC);

ALTER TABLE public.employee_offboarding_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_offboarding_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_offboarding_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_access_revocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_final_clearance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offboarding_audit_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS employee_offboarding_sessions_tenant_access ON public.employee_offboarding_sessions;
CREATE POLICY employee_offboarding_sessions_tenant_access ON public.employee_offboarding_sessions
  FOR ALL TO authenticated
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS employee_offboarding_steps_tenant_access ON public.employee_offboarding_steps;
CREATE POLICY employee_offboarding_steps_tenant_access ON public.employee_offboarding_steps
  FOR ALL TO authenticated
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS employee_offboarding_checks_tenant_access ON public.employee_offboarding_checks;
CREATE POLICY employee_offboarding_checks_tenant_access ON public.employee_offboarding_checks
  FOR ALL TO authenticated
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS employee_access_revocations_tenant_access ON public.employee_access_revocations;
CREATE POLICY employee_access_revocations_tenant_access ON public.employee_access_revocations
  FOR ALL TO authenticated
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS employee_final_clearance_tenant_access ON public.employee_final_clearance;
CREATE POLICY employee_final_clearance_tenant_access ON public.employee_final_clearance
  FOR ALL TO authenticated
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS offboarding_audit_events_tenant_access ON public.offboarding_audit_events;
CREATE POLICY offboarding_audit_events_tenant_access ON public.offboarding_audit_events
  FOR ALL TO authenticated
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

GRANT SELECT, INSERT, UPDATE, DELETE ON
  public.employee_offboarding_sessions,
  public.employee_offboarding_steps,
  public.employee_offboarding_checks,
  public.employee_access_revocations,
  public.employee_final_clearance,
  public.offboarding_audit_events
TO authenticated;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'employees' AND column_name = 'exit_date'
  ) OR to_regclass('public.employee_offboarding_sessions') IS NULL
    OR to_regclass('public.employee_offboarding_steps') IS NULL
    OR to_regclass('public.employee_offboarding_checks') IS NULL
    OR to_regclass('public.employee_access_revocations') IS NULL
    OR to_regclass('public.employee_final_clearance') IS NULL
    OR to_regclass('public.offboarding_audit_events') IS NULL
  THEN
    RAISE EXCEPTION 'Personal R3 offboarding schema verification failed';
  END IF;
END
$$;

NOTIFY pgrst, 'reload schema';

COMMIT;
