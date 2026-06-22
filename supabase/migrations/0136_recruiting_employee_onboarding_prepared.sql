-- ==========================================================================
-- CareSuite+ — Migration 0051: Bewerbermanagement & Mitarbeiter-Onboarding
-- Prompt 76 — prepared only, nicht produktiv bis Remote-Migration angewendet
-- ==========================================================================

CREATE TABLE IF NOT EXISTS public.applicants (
  id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  first_name              TEXT        NOT NULL,
  last_name               TEXT        NOT NULL,
  email                   TEXT        NOT NULL,
  phone                   TEXT,
  date_of_birth           DATE,
  street                  TEXT,
  postal_code             TEXT,
  city                    TEXT,
  applied_role            TEXT        NOT NULL,
  applied_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  source                  TEXT,
  desired_start_date      DATE,
  availability_note       TEXT,
  weekly_hours_desired    NUMERIC(5,2),
  experience_years        NUMERIC(4,1),
  previous_employer       TEXT,
  qualification_summary   TEXT,
  status                  TEXT        NOT NULL DEFAULT 'received'
    CHECK (status IN (
      'received', 'in_review', 'documents_requested', 'documents_incomplete',
      'documents_complete', 'screening_passed', 'interview_scheduled',
      'interview_completed', 'assessment_pending', 'offer_preparation',
      'offer_sent', 'offer_accepted', 'offer_declined', 'rejected',
      'withdrawn', 'converted'
    )),
  current_process_step    TEXT        NOT NULL DEFAULT 'application_received',
  internal_notes          TEXT        NOT NULL DEFAULT '',
  rejection_reason        TEXT,
  offer_sent_at           TIMESTAMPTZ,
  offer_accepted_at       TIMESTAMPTZ,
  offer_rejected_at       TIMESTAMPTZ,
  privacy_consent_at      TIMESTAMPTZ,
  extended_storage_consent BOOLEAN    NOT NULL DEFAULT FALSE,
  extended_storage_consent_at TIMESTAMPTZ,
  archived_at             TIMESTAMPTZ,
  deletion_due_at         TIMESTAMPTZ,
  deletion_scheduled      BOOLEAN     NOT NULL DEFAULT FALSE,
  converted_employee_id   UUID        REFERENCES public.employees(id) ON DELETE SET NULL,
  assigned_recruiter_id   UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_by              UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_by              UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_applicants_tenant_status
  ON public.applicants (tenant_id, status, applied_at DESC);

CREATE TABLE IF NOT EXISTS public.applicant_documents (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  applicant_id      UUID        NOT NULL REFERENCES public.applicants(id) ON DELETE CASCADE,
  document_type     TEXT        NOT NULL
    CHECK (document_type IN (
      'cv', 'cover_letter', 'qualifications', 'license',
      'background_check', 'certificate', 'work_permit'
    )),
  title             TEXT        NOT NULL,
  file_name         TEXT,
  storage_path      TEXT,
  status            TEXT        NOT NULL DEFAULT 'requested'
    CHECK (status IN (
      'requested', 'received', 'pending_review', 'verified',
      'rejected', 'expired', 'archived'
    )),
  required          BOOLEAN     NOT NULL DEFAULT TRUE,
  sensitive         BOOLEAN     NOT NULL DEFAULT FALSE,
  verified_by       UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  verified_at       TIMESTAMPTZ,
  rejection_reason  TEXT,
  valid_until       TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_applicant_documents_applicant
  ON public.applicant_documents (tenant_id, applicant_id, document_type);

CREATE TABLE IF NOT EXISTS public.applicant_interviews (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  applicant_id      UUID        NOT NULL REFERENCES public.applicants(id) ON DELETE CASCADE,
  scheduled_at      TIMESTAMPTZ NOT NULL,
  duration_minutes  INTEGER     NOT NULL DEFAULT 45,
  format            TEXT        NOT NULL DEFAULT 'in_person'
    CHECK (format IN ('in_person', 'video', 'phone')),
  location          TEXT,
  meeting_link      TEXT,
  interviewer_ids   UUID[]      NOT NULL DEFAULT '{}',
  interviewer_names TEXT[]      NOT NULL DEFAULT '{}',
  outcome           TEXT        NOT NULL DEFAULT 'pending'
    CHECK (outcome IN ('pending', 'positive', 'neutral', 'negative', 'no_show', 'cancelled')),
  rating            INTEGER,
  notes             TEXT        NOT NULL DEFAULT '',
  next_steps        TEXT,
  completed_at      TIMESTAMPTZ,
  cancelled_at      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.applicant_communications (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  applicant_id      UUID        NOT NULL REFERENCES public.applicants(id) ON DELETE CASCADE,
  message_type      TEXT        NOT NULL,
  channel           TEXT        NOT NULL DEFAULT 'draft_email'
    CHECK (channel IN ('in_app', 'draft_email', 'draft_sms')),
  status            TEXT        NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'prepared', 'sent_in_app', 'cancelled')),
  subject           TEXT        NOT NULL,
  body              TEXT        NOT NULL,
  prepared_only     BOOLEAN     NOT NULL DEFAULT TRUE,
  created_by        UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.applicant_status_events (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  applicant_id      UUID        NOT NULL REFERENCES public.applicants(id) ON DELETE CASCADE,
  previous_status   TEXT,
  new_status        TEXT        NOT NULL,
  process_step      TEXT,
  actor_id          UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  actor_role        TEXT,
  summary           TEXT        NOT NULL,
  metadata          JSONB       NOT NULL DEFAULT '{}'::jsonb,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_applicant_status_events_applicant
  ON public.applicant_status_events (tenant_id, applicant_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.employee_onboarding_sessions (
  id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  employee_id             UUID        NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  applicant_id            UUID        REFERENCES public.applicants(id) ON DELETE SET NULL,
  overall_status          TEXT        NOT NULL DEFAULT 'not_started'
    CHECK (overall_status IN (
      'not_started', 'in_progress', 'blocked', 'deployable', 'completed', 'cancelled'
    )),
  current_step_key        TEXT        NOT NULL DEFAULT 'employee_record_created',
  target_employment_status TEXT       NOT NULL DEFAULT 'onboarding',
  started_at              TIMESTAMPTZ,
  completed_at            TIMESTAMPTZ,
  deployable_at           TIMESTAMPTZ,
  portal_invite_prepared  BOOLEAN     NOT NULL DEFAULT FALSE,
  background_check_status TEXT        NOT NULL DEFAULT 'missing',
  mandatory_training_keys TEXT[]      NOT NULL DEFAULT '{}',
  required_document_types TEXT[]      NOT NULL DEFAULT '{}',
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, employee_id)
);

CREATE TABLE IF NOT EXISTS public.employee_onboarding_steps (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  session_id        UUID        NOT NULL REFERENCES public.employee_onboarding_sessions(id) ON DELETE CASCADE,
  employee_id       UUID        NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  step_key          TEXT        NOT NULL,
  status            TEXT        NOT NULL DEFAULT 'pending'
    CHECK (status IN (
      'pending', 'in_progress', 'completed', 'blocked', 'skipped', 'not_applicable'
    )),
  completed_at      TIMESTAMPTZ,
  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (session_id, step_key)
);

CREATE TABLE IF NOT EXISTS public.employee_onboarding_check_results (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  session_id        UUID        NOT NULL REFERENCES public.employee_onboarding_sessions(id) ON DELETE CASCADE,
  employee_id       UUID        NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  check_key         TEXT        NOT NULL,
  status            TEXT        NOT NULL CHECK (status IN ('passed', 'warning', 'failed')),
  message           TEXT        NOT NULL,
  evaluated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.onboarding_audit_events (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  session_id        UUID        REFERENCES public.employee_onboarding_sessions(id) ON DELETE CASCADE,
  employee_id       UUID        REFERENCES public.employees(id) ON DELETE SET NULL,
  applicant_id      UUID        REFERENCES public.applicants(id) ON DELETE SET NULL,
  action            TEXT        NOT NULL,
  actor_id          UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  actor_role        TEXT,
  summary           TEXT        NOT NULL,
  metadata          JSONB       NOT NULL DEFAULT '{}'::jsonb,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_onboarding_audit_events_tenant
  ON public.onboarding_audit_events (tenant_id, created_at DESC);

-- RLS prepared (tenant isolation)
ALTER TABLE public.applicants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.applicant_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.applicant_interviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.applicant_communications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.applicant_status_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_onboarding_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_onboarding_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_onboarding_check_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.onboarding_audit_events ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'applicants'
      AND policyname = 'applicants_tenant_isolation'
  ) THEN
    CREATE POLICY applicants_tenant_isolation ON public.applicants
      FOR ALL USING (tenant_id = public.current_tenant_id())
      WITH CHECK (tenant_id = public.current_tenant_id());
  END IF;
END $$;

COMMENT ON TABLE public.applicants IS 'Prompt 76 — Bewerbermanagement (prepared only)';
COMMENT ON TABLE public.employee_onboarding_sessions IS 'Prompt 76 — Mitarbeiter-Onboarding (nicht Mandanten-Onboarding)';
