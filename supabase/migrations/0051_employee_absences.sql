-- ==========================================================================
-- CareSuite+ — Migration 0051: Employee Absences (prepared)
-- Prompt 72 — Urlaubs-, Krankheits- und Abwesenheitsverwaltung
-- ==========================================================================

CREATE TABLE IF NOT EXISTS public.employee_absences (
  id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  employee_id             UUID        NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  absence_type            TEXT        NOT NULL CHECK (absence_type IN (
    'vacation', 'sick_leave', 'child_sick_leave', 'unpaid_leave', 'training',
    'public_holiday', 'blocked_time', 'appointment', 'no_availability', 'suspension', 'other'
  )),
  status                  TEXT        NOT NULL DEFAULT 'requested' CHECK (status IN (
    'requested', 'approved', 'rejected', 'cancelled', 'active', 'completed', 'requires_review', 'archived'
  )),
  starts_at               TIMESTAMPTZ NOT NULL,
  ends_at                 TIMESTAMPTZ NOT NULL,
  all_day                 BOOLEAN     NOT NULL DEFAULT TRUE,
  internal_notes          TEXT        NOT NULL DEFAULT '',
  employee_visible_note   TEXT        NOT NULL DEFAULT '',
  sick_details            TEXT,
  au_document_id          UUID,
  certificate_document_id UUID,
  replacement_required    BOOLEAN     NOT NULL DEFAULT FALSE,
  hide_details_from_admin BOOLEAN     NOT NULL DEFAULT FALSE,
  requested_days          NUMERIC(5,1),
  approved_by             UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  approved_at             TIMESTAMPTZ,
  rejected_by             UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  rejected_at             TIMESTAMPTZ,
  rejection_reason        TEXT,
  cancelled_at            TIMESTAMPTZ,
  qualification_updated   BOOLEAN     NOT NULL DEFAULT FALSE,
  created_by              UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_by              UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_employee_absences_tenant_employee
  ON public.employee_absences (tenant_id, employee_id, starts_at);

CREATE INDEX IF NOT EXISTS idx_employee_absences_tenant_status
  ON public.employee_absences (tenant_id, status, starts_at);

ALTER TABLE public.employee_absences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS employee_absences_tenant ON public.employee_absences;
CREATE POLICY employee_absences_tenant ON public.employee_absences
  FOR ALL
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

CREATE TABLE IF NOT EXISTS public.employee_absence_requests (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  employee_id         UUID        NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  absence_id          UUID        REFERENCES public.employee_absences(id) ON DELETE SET NULL,
  requested_starts_at TIMESTAMPTZ NOT NULL,
  requested_ends_at   TIMESTAMPTZ NOT NULL,
  requested_days      NUMERIC(5,1) NOT NULL,
  half_day_start      BOOLEAN     NOT NULL DEFAULT FALSE,
  half_day_end        BOOLEAN     NOT NULL DEFAULT FALSE,
  employee_note       TEXT        NOT NULL DEFAULT '',
  status              TEXT        NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'approved', 'rejected', 'cancelled'
  )),
  reviewed_by         UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at         TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_employee_absence_requests_tenant
  ON public.employee_absence_requests (tenant_id, employee_id, status);

ALTER TABLE public.employee_absence_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS employee_absence_requests_tenant ON public.employee_absence_requests;
CREATE POLICY employee_absence_requests_tenant ON public.employee_absence_requests
  FOR ALL
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

CREATE TABLE IF NOT EXISTS public.employee_availability (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  employee_id UUID        NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  starts_at   TIMESTAMPTZ NOT NULL,
  ends_at     TIMESTAMPTZ NOT NULL,
  rule_id     UUID,
  label       TEXT        NOT NULL DEFAULT '',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_employee_availability_tenant
  ON public.employee_availability (tenant_id, employee_id, starts_at);

ALTER TABLE public.employee_availability ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS employee_availability_tenant ON public.employee_availability;
CREATE POLICY employee_availability_tenant ON public.employee_availability
  FOR ALL
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

CREATE TABLE IF NOT EXISTS public.employee_availability_rules (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  employee_id     UUID        NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  weekday         INT         NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  start_time      TIME        NOT NULL,
  end_time        TIME        NOT NULL,
  effective_from  DATE        NOT NULL,
  effective_until DATE,
  label           TEXT        NOT NULL DEFAULT '',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_employee_availability_rules_tenant
  ON public.employee_availability_rules (tenant_id, employee_id);

ALTER TABLE public.employee_availability_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS employee_availability_rules_tenant ON public.employee_availability_rules;
CREATE POLICY employee_availability_rules_tenant ON public.employee_availability_rules
  FOR ALL
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

CREATE TABLE IF NOT EXISTS public.replacement_requests (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  assignment_id         UUID        NOT NULL,
  original_employee_id  UUID        NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  absence_id            UUID        REFERENCES public.employee_absences(id) ON DELETE SET NULL,
  suggested_employee_id UUID        REFERENCES public.employees(id) ON DELETE SET NULL,
  assigned_employee_id  UUID        REFERENCES public.employees(id) ON DELETE SET NULL,
  status                TEXT        NOT NULL DEFAULT 'open' CHECK (status IN (
    'open', 'suggested', 'assigned', 'completed', 'cancelled'
  )),
  travel_time_minutes   INT,
  qualification_match   BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at           TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_replacement_requests_tenant
  ON public.replacement_requests (tenant_id, status, created_at DESC);

ALTER TABLE public.replacement_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS replacement_requests_tenant ON public.replacement_requests;
CREATE POLICY replacement_requests_tenant ON public.replacement_requests
  FOR ALL
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

CREATE TABLE IF NOT EXISTS public.absence_audit_events (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  absence_id  UUID        NOT NULL REFERENCES public.employee_absences(id) ON DELETE CASCADE,
  action      TEXT        NOT NULL,
  actor_id    UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  actor_role  TEXT,
  summary     TEXT        NOT NULL,
  metadata    JSONB       NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_absence_audit_events_tenant
  ON public.absence_audit_events (tenant_id, absence_id, created_at DESC);

ALTER TABLE public.absence_audit_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS absence_audit_events_tenant ON public.absence_audit_events;
CREATE POLICY absence_audit_events_tenant ON public.absence_audit_events
  FOR ALL
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

CREATE TABLE IF NOT EXISTS public.vacation_entitlements (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  employee_id   UUID        NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  year          INT         NOT NULL,
  entitled_days NUMERIC(5,1) NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, employee_id, year)
);

ALTER TABLE public.vacation_entitlements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS vacation_entitlements_tenant ON public.vacation_entitlements;
CREATE POLICY vacation_entitlements_tenant ON public.vacation_entitlements
  FOR ALL
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

CREATE TABLE IF NOT EXISTS public.vacation_balances (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  employee_id    UUID        NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  year           INT         NOT NULL,
  entitled_days  NUMERIC(5,1) NOT NULL DEFAULT 0,
  used_days      NUMERIC(5,1) NOT NULL DEFAULT 0,
  pending_days   NUMERIC(5,1) NOT NULL DEFAULT 0,
  remaining_days NUMERIC(5,1) NOT NULL DEFAULT 0,
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, employee_id, year)
);

ALTER TABLE public.vacation_balances ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS vacation_balances_tenant ON public.vacation_balances;
CREATE POLICY vacation_balances_tenant ON public.vacation_balances
  FOR ALL
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());
