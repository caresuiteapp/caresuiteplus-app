-- ==========================================================================
-- CareSuite+ — Migration 0052: Training Management (prepared)
-- Prompt 75 — Schulungen, Unterweisungen, Zertifikate
-- Keine destruktiven Befehle. Nicht produktiv bis Remote-Apply + Backfill.
-- ==========================================================================

CREATE TABLE IF NOT EXISTS public.training_courses (
  id                          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                   UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  course_key                  TEXT        NOT NULL,
  title                       TEXT        NOT NULL,
  description                 TEXT        NOT NULL DEFAULT '',
  training_type_group         TEXT        NOT NULL CHECK (training_type_group IN (
    'mandatory_briefing', 'care_support', 'system_training', 'legal_organizational', 'academy_prepared'
  )),
  category                    TEXT        NOT NULL DEFAULT '',
  duration_minutes            INTEGER     NOT NULL DEFAULT 60,
  validity_months             INTEGER,
  is_mandatory                BOOLEAN     NOT NULL DEFAULT FALSE,
  blocks_deployment_on_expiry BOOLEAN     NOT NULL DEFAULT TRUE,
  expiry_action               TEXT        NOT NULL DEFAULT 'block'
    CHECK (expiry_action IN ('block', 'warn')),
  requires_proof              BOOLEAN     NOT NULL DEFAULT TRUE,
  requires_quiz               BOOLEAN     NOT NULL DEFAULT FALSE,
  academy_course_id           UUID,
  module_keys                 TEXT[]      NOT NULL DEFAULT '{}',
  role_keys                   TEXT[]      NOT NULL DEFAULT '{}',
  status                      TEXT        NOT NULL DEFAULT 'prepared'
    CHECK (status IN ('prepared', 'active', 'archived')),
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, course_key)
);

CREATE INDEX IF NOT EXISTS idx_training_courses_tenant
  ON public.training_courses (tenant_id, training_type_group, status);

CREATE TABLE IF NOT EXISTS public.training_course_modules (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  course_id   UUID        NOT NULL REFERENCES public.training_courses(id) ON DELETE CASCADE,
  module_key  TEXT        NOT NULL,
  required    BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, course_id, module_key)
);

CREATE TABLE IF NOT EXISTS public.training_requirements (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  course_id       UUID        NOT NULL REFERENCES public.training_courses(id) ON DELETE CASCADE,
  role_key        TEXT,
  module_key      TEXT,
  job_title       TEXT,
  mandatory       BOOLEAN     NOT NULL DEFAULT TRUE,
  effective_from  DATE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_training_requirements_tenant
  ON public.training_requirements (tenant_id, role_key, module_key);

CREATE TABLE IF NOT EXISTS public.employee_training_records (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  employee_id           UUID        NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  course_id             UUID        NOT NULL REFERENCES public.training_courses(id) ON DELETE CASCADE,
  status                TEXT        NOT NULL DEFAULT 'required' CHECK (status IN (
    'not_required', 'required', 'assigned', 'in_progress', 'completed', 'passed', 'failed',
    'expired', 'expires_soon', 'waived', 'pending_review', 'rejected', 'archived'
  )),
  assigned_at           TIMESTAMPTZ,
  started_at            TIMESTAMPTZ,
  completed_at          TIMESTAMPTZ,
  passed_at             TIMESTAMPTZ,
  valid_until           TIMESTAMPTZ,
  proof_document_id     UUID,
  verified_by           UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  verified_at           TIMESTAMPTZ,
  waived_by             UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  waived_reason         TEXT,
  progress_percent      INTEGER     NOT NULL DEFAULT 0 CHECK (progress_percent BETWEEN 0 AND 100),
  score_percent         INTEGER     CHECK (score_percent BETWEEN 0 AND 100),
  absence_id            UUID,
  academy_enrollment_id UUID,
  rejection_reason      TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, employee_id, course_id)
);

CREATE INDEX IF NOT EXISTS idx_employee_training_records_tenant
  ON public.employee_training_records (tenant_id, employee_id, status);

CREATE INDEX IF NOT EXISTS idx_employee_training_records_expiry
  ON public.employee_training_records (tenant_id, valid_until);

CREATE TABLE IF NOT EXISTS public.employee_certificates (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  employee_id         UUID        NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  training_record_id  UUID        REFERENCES public.employee_training_records(id) ON DELETE SET NULL,
  course_id           UUID        NOT NULL REFERENCES public.training_courses(id) ON DELETE CASCADE,
  title               TEXT        NOT NULL,
  certificate_number  TEXT,
  issued_at           TIMESTAMPTZ,
  valid_until         TIMESTAMPTZ,
  document_id         UUID,
  verification_status TEXT        NOT NULL DEFAULT 'pending' CHECK (verification_status IN (
    'pending', 'verified', 'rejected', 'expired', 'needs_review'
  )),
  verified_by         UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  verified_at         TIMESTAMPTZ,
  rejection_reason    TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_employee_certificates_tenant
  ON public.employee_certificates (tenant_id, employee_id, verification_status);

CREATE TABLE IF NOT EXISTS public.training_assignments (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  employee_id UUID        NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  course_id   UUID        NOT NULL REFERENCES public.training_courses(id) ON DELETE CASCADE,
  assigned_by UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  due_at      TIMESTAMPTZ,
  status      TEXT        NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'completed', 'cancelled')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_training_assignments_tenant
  ON public.training_assignments (tenant_id, employee_id, status);

CREATE TABLE IF NOT EXISTS public.training_reminders (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  employee_id         UUID        NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  course_id           UUID        NOT NULL REFERENCES public.training_courses(id) ON DELETE CASCADE,
  training_record_id  UUID        REFERENCES public.employee_training_records(id) ON DELETE SET NULL,
  reminder_level      TEXT        NOT NULL CHECK (reminder_level IN (
    'info_90d', 'urgent_30d', 'expired', 'review_due'
  )),
  due_at              TIMESTAMPTZ NOT NULL,
  acknowledged_at     TIMESTAMPTZ,
  admin_task_created  BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_training_reminders_tenant
  ON public.training_reminders (tenant_id, reminder_level, due_at);

CREATE TABLE IF NOT EXISTS public.training_audit_events (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  employee_id         UUID        REFERENCES public.employees(id) ON DELETE SET NULL,
  course_id           UUID        REFERENCES public.training_courses(id) ON DELETE SET NULL,
  training_record_id  UUID        REFERENCES public.employee_training_records(id) ON DELETE SET NULL,
  certificate_id      UUID        REFERENCES public.employee_certificates(id) ON DELETE SET NULL,
  action              TEXT        NOT NULL,
  actor_id            UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  actor_role          TEXT,
  summary             TEXT        NOT NULL,
  metadata            JSONB       NOT NULL DEFAULT '{}'::jsonb,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_training_audit_events_tenant
  ON public.training_audit_events (tenant_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.training_quiz_results (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  training_record_id  UUID        NOT NULL REFERENCES public.employee_training_records(id) ON DELETE CASCADE,
  score_percent       INTEGER     NOT NULL CHECK (score_percent BETWEEN 0 AND 100),
  passed              BOOLEAN     NOT NULL DEFAULT FALSE,
  attempted_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.training_content_items (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  course_id             UUID        NOT NULL REFERENCES public.training_courses(id) ON DELETE CASCADE,
  content_type          TEXT        NOT NULL CHECK (content_type IN (
    'document', 'video', 'scorm_package', 'xapi_activity', 'external_link'
  )),
  title                 TEXT        NOT NULL,
  external_ref          TEXT,
  sort_order            INTEGER     NOT NULL DEFAULT 0,
  academy_prepared_only BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.training_courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_course_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_training_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_certificates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_quiz_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_content_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS training_courses_tenant ON public.training_courses;
CREATE POLICY training_courses_tenant ON public.training_courses
  FOR ALL
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS training_course_modules_tenant ON public.training_course_modules;
CREATE POLICY training_course_modules_tenant ON public.training_course_modules
  FOR ALL
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS training_requirements_tenant ON public.training_requirements;
CREATE POLICY training_requirements_tenant ON public.training_requirements
  FOR ALL
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS employee_training_records_tenant ON public.employee_training_records;
CREATE POLICY employee_training_records_tenant ON public.employee_training_records
  FOR ALL
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS employee_certificates_tenant ON public.employee_certificates;
CREATE POLICY employee_certificates_tenant ON public.employee_certificates
  FOR ALL
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS training_assignments_tenant ON public.training_assignments;
CREATE POLICY training_assignments_tenant ON public.training_assignments
  FOR ALL
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS training_reminders_tenant ON public.training_reminders;
CREATE POLICY training_reminders_tenant ON public.training_reminders
  FOR ALL
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS training_audit_events_tenant ON public.training_audit_events;
CREATE POLICY training_audit_events_tenant ON public.training_audit_events
  FOR ALL
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS training_quiz_results_tenant ON public.training_quiz_results;
CREATE POLICY training_quiz_results_tenant ON public.training_quiz_results
  FOR ALL
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS training_content_items_tenant ON public.training_content_items;
CREATE POLICY training_content_items_tenant ON public.training_content_items
  FOR ALL
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());
