-- ==========================================================================
-- CareSuite+ — Migration 0051: Employee Personnel File (Personalakte) prepared
-- Extends employees; adds personnel sub-tables. No destructive changes.
-- ==========================================================================

ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS employee_number TEXT,
  ADD COLUMN IF NOT EXISTS date_of_birth DATE,
  ADD COLUMN IF NOT EXISTS street TEXT,
  ADD COLUMN IF NOT EXISTS house_number TEXT,
  ADD COLUMN IF NOT EXISTS postal_code TEXT,
  ADD COLUMN IF NOT EXISTS city TEXT,
  ADD COLUMN IF NOT EXISTS country TEXT DEFAULT 'DE',
  ADD COLUMN IF NOT EXISTS mobile TEXT,
  ADD COLUMN IF NOT EXISTS emergency_contact_name TEXT,
  ADD COLUMN IF NOT EXISTS emergency_contact_phone TEXT,
  ADD COLUMN IF NOT EXISTS entry_date DATE,
  ADD COLUMN IF NOT EXISTS exit_date DATE,
  ADD COLUMN IF NOT EXISTS role_title TEXT,
  ADD COLUMN IF NOT EXISTS employment_type TEXT,
  ADD COLUMN IF NOT EXISTS weekly_hours NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS cost_center TEXT;

CREATE TABLE IF NOT EXISTS public.employee_profiles (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  employee_id     UUID        NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  profile_id      UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  portal_active   BOOLEAN     NOT NULL DEFAULT FALSE,
  role_key        TEXT,
  last_login_at   TIMESTAMPTZ,
  invitation_sent_at TIMESTAMPTZ,
  password_configured BOOLEAN NOT NULL DEFAULT FALSE,
  two_factor_prepared BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, employee_id)
);

CREATE TABLE IF NOT EXISTS public.employee_employment_details (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  employee_id         UUID        NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  contract_type       TEXT,
  probation_ends_at   DATE,
  fixed_term_ends_at  DATE,
  notice_period_days  INTEGER,
  weekly_hours        NUMERIC(5,2),
  deployment_area     TEXT,
  employment_status   TEXT        NOT NULL DEFAULT 'active'
                      CHECK (employment_status IN (
                        'applicant','onboarding','active','paused','sick_long_term',
                        'on_leave','suspended','terminated','archived'
                      )),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, employee_id)
);

CREATE TABLE IF NOT EXISTS public.employee_qualifications (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  employee_id           UUID        NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  qualification_type    TEXT        NOT NULL,
  title                 TEXT        NOT NULL,
  issuing_organization  TEXT,
  issued_at             DATE,
  valid_until           DATE,
  document_id           UUID,
  verified_by           TEXT,
  verified_at           TIMESTAMPTZ,
  status                TEXT        NOT NULL DEFAULT 'pending_review'
                        CHECK (status IN (
                          'valid','expires_soon','expired','missing','pending_review','rejected'
                        )),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.employee_background_checks (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  employee_id     UUID        NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  present         BOOLEAN     NOT NULL DEFAULT FALSE,
  issue_date      DATE,
  verified_at     TIMESTAMPTZ,
  verified_by     TEXT,
  follow_up_due_at DATE,
  status          TEXT        NOT NULL DEFAULT 'missing'
                  CHECK (status IN (
                    'not_required','missing','requested','submitted','verified','expired','rejected'
                  )),
  document_id     UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, employee_id)
);

CREATE TABLE IF NOT EXISTS public.employee_documents (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  employee_id         UUID        NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  category            TEXT        NOT NULL,
  title               TEXT        NOT NULL,
  file_name           TEXT        NOT NULL,
  storage_path        TEXT,
  sensitive           BOOLEAN     NOT NULL DEFAULT FALSE,
  released_to_portal  BOOLEAN     NOT NULL DEFAULT FALSE,
  valid_until         DATE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.employee_portal_access (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  employee_id         UUID        NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  profile_id          UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  portal_active       BOOLEAN     NOT NULL DEFAULT FALSE,
  role_key            TEXT,
  last_login_at       TIMESTAMPTZ,
  invitation_sent_at  TIMESTAMPTZ,
  password_configured BOOLEAN     NOT NULL DEFAULT FALSE,
  two_factor_prepared BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, employee_id)
);

CREATE TABLE IF NOT EXISTS public.employee_assignment_eligibility (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  employee_id         UUID        NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  result              TEXT        NOT NULL DEFAULT 'blocked'
                      CHECK (result IN ('assignable','warning','blocked')),
  checked_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  active              BOOLEAN     NOT NULL DEFAULT FALSE,
  portal_ok           BOOLEAN     NOT NULL DEFAULT FALSE,
  qualification_ok    BOOLEAN     NOT NULL DEFAULT FALSE,
  not_absent          BOOLEAN     NOT NULL DEFAULT FALSE,
  background_check_ok BOOLEAN     NOT NULL DEFAULT FALSE,
  availability_ok     BOOLEAN     NOT NULL DEFAULT FALSE,
  no_block            BOOLEAN     NOT NULL DEFAULT FALSE,
  required_docs_ok    BOOLEAN     NOT NULL DEFAULT FALSE,
  warnings_json       JSONB       NOT NULL DEFAULT '[]'::jsonb,
  blockers_json       JSONB       NOT NULL DEFAULT '[]'::jsonb,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.employee_audit_events (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  employee_id     UUID        NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  action          TEXT        NOT NULL,
  actor_id        UUID,
  actor_role      TEXT,
  summary         TEXT        NOT NULL,
  field_changes   JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_employee_qualifications_tenant_employee
  ON public.employee_qualifications (tenant_id, employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_documents_tenant_employee
  ON public.employee_documents (tenant_id, employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_audit_events_tenant_employee
  ON public.employee_audit_events (tenant_id, employee_id, created_at DESC);

ALTER TABLE public.employee_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_employment_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_qualifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_background_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_portal_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_assignment_eligibility ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_audit_events ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'employee_profiles','employee_employment_details','employee_qualifications',
    'employee_background_checks','employee_documents','employee_portal_access',
    'employee_assignment_eligibility','employee_audit_events'
  ] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I_tenant ON public.%I', tbl, tbl);
    EXECUTE format(
      'CREATE POLICY %I_tenant ON public.%I FOR ALL USING (tenant_id = public.current_tenant_id()) WITH CHECK (tenant_id = public.current_tenant_id())',
      tbl, tbl
    );
  END LOOP;
END $$;

COMMENT ON TABLE public.employee_profiles IS 'Personalakte — Systemzugang (prepared)';
COMMENT ON TABLE public.employee_qualifications IS 'Personalakte — Qualifikationen mit Ablaufmonitoring';
COMMENT ON TABLE public.employee_background_checks IS 'Personalakte — Führungszeugnis (geschützt)';
COMMENT ON TABLE public.employee_assignment_eligibility IS 'Personalakte — Einsatzfähigkeit Snapshot';
