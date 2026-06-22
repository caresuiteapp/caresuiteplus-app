-- ==========================================================================
-- CareSuite+ — Migration 0052: Employee HR Cases (prepared)
-- Personalvorgänge — Mitarbeitergespräche, Abmahnungen, Kündigungen, Zeugnisse
-- ==========================================================================

CREATE TABLE IF NOT EXISTS public.employee_hr_cases (
  id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  employee_id             UUID        NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  area_key                TEXT        NOT NULL CHECK (area_key IN (
    'mitarbeitergespraech', 'probezeitgespraech', 'kritik_feedbackgespraech', 'zielvereinbarung',
    'abmahnung', 'ermahnung', 'kuendigung', 'aufhebungsvereinbarung', 'arbeitszeugnis',
    'rueckgabe_uebergabeprotokoll', 'dokumentenarchiv_personal'
  )),
  status                  TEXT        NOT NULL DEFAULT 'draft' CHECK (status IN (
    'draft', 'scheduled', 'open', 'in_review', 'finalized', 'delivered',
    'acknowledged', 'corrected', 'archived', 'cancelled'
  )),
  case_number             TEXT,
  title                   TEXT        NOT NULL DEFAULT '',
  template_id             TEXT,
  lifecycle_document_id   UUID,
  preview_confirmed       BOOLEAN     NOT NULL DEFAULT FALSE,
  locked_at               TIMESTAMPTZ,
  content_hash            TEXT,
  version                 INTEGER     NOT NULL DEFAULT 1,
  corrected_from_case_id  UUID        REFERENCES public.employee_hr_cases(id) ON DELETE SET NULL,
  released_to_portal      BOOLEAN     NOT NULL DEFAULT FALSE,
  released_to_portal_at   TIMESTAMPTZ,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_employee_hr_cases_tenant_employee
  ON public.employee_hr_cases (tenant_id, employee_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_employee_hr_cases_tenant_status
  ON public.employee_hr_cases (tenant_id, status, area_key);

ALTER TABLE public.employee_hr_cases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS employee_hr_cases_tenant ON public.employee_hr_cases;
CREATE POLICY employee_hr_cases_tenant ON public.employee_hr_cases
  FOR ALL
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

CREATE TABLE IF NOT EXISTS public.employee_hr_case_events (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  case_id     UUID        NOT NULL REFERENCES public.employee_hr_cases(id) ON DELETE CASCADE,
  event_type  TEXT        NOT NULL,
  summary     TEXT        NOT NULL DEFAULT '',
  actor_id    UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  actor_role  TEXT,
  old_status  TEXT,
  new_status  TEXT,
  metadata    JSONB       NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_employee_hr_case_events_case
  ON public.employee_hr_case_events (tenant_id, case_id, created_at DESC);

ALTER TABLE public.employee_hr_case_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS employee_hr_case_events_tenant ON public.employee_hr_case_events;
CREATE POLICY employee_hr_case_events_tenant ON public.employee_hr_case_events
  FOR ALL
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

CREATE TABLE IF NOT EXISTS public.employee_hr_documents (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  case_id               UUID        NOT NULL REFERENCES public.employee_hr_cases(id) ON DELETE CASCADE,
  employee_id           UUID        NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  document_category     TEXT        NOT NULL DEFAULT 'hr',
  storage_path          TEXT,
  lifecycle_document_id UUID,
  version               INTEGER     NOT NULL DEFAULT 1,
  is_correction         BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.employee_hr_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS employee_hr_documents_tenant ON public.employee_hr_documents;
CREATE POLICY employee_hr_documents_tenant ON public.employee_hr_documents
  FOR ALL
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

CREATE TABLE IF NOT EXISTS public.employee_conversations (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  case_id         UUID        NOT NULL UNIQUE REFERENCES public.employee_hr_cases(id) ON DELETE CASCADE,
  employee_id     UUID        NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  conversation_type TEXT      NOT NULL CHECK (conversation_type IN ('general', 'probation', 'feedback', 'goal_agreement')),
  scheduled_at    TIMESTAMPTZ,
  participants    JSONB       NOT NULL DEFAULT '[]'::jsonb,
  topics          TEXT        NOT NULL DEFAULT '',
  summary         TEXT        NOT NULL DEFAULT '',
  agreements      TEXT        NOT NULL DEFAULT '',
  next_steps      TEXT        NOT NULL DEFAULT '',
  follow_up_at    TIMESTAMPTZ,
  document_id     UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.employee_conversations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS employee_conversations_tenant ON public.employee_conversations;
CREATE POLICY employee_conversations_tenant ON public.employee_conversations
  FOR ALL
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

CREATE TABLE IF NOT EXISTS public.employee_warnings (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  case_id               UUID        NOT NULL UNIQUE REFERENCES public.employee_hr_cases(id) ON DELETE CASCADE,
  employee_id           UUID        NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  warning_type          TEXT        NOT NULL CHECK (warning_type IN ('formal_warning', 'admonition')),
  incident_date         DATE,
  incident_description  TEXT        NOT NULL DEFAULT '',
  breached_duties       TEXT        NOT NULL DEFAULT '',
  prior_discussion      TEXT,
  expected_behavior     TEXT        NOT NULL DEFAULT '',
  consequences_notice   TEXT        NOT NULL DEFAULT '',
  delivery_method       TEXT        CHECK (delivery_method IN ('personal', 'registered_mail', 'email', 'portal')),
  delivered_at          TIMESTAMPTZ,
  acknowledged_at       TIMESTAMPTZ,
  document_id           UUID,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.employee_warnings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS employee_warnings_tenant ON public.employee_warnings;
CREATE POLICY employee_warnings_tenant ON public.employee_warnings
  FOR ALL
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

CREATE TABLE IF NOT EXISTS public.employee_terminations (
  id                        UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                 UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  case_id                   UUID        NOT NULL UNIQUE REFERENCES public.employee_hr_cases(id) ON DELETE CASCADE,
  employee_id               UUID        NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  termination_type          TEXT        NOT NULL CHECK (termination_type IN (
    'ordinary', 'extraordinary', 'mutual_termination', 'fixed_term_end'
  )),
  termination_date          DATE,
  effective_date            DATE,
  reason_internal           TEXT        NOT NULL DEFAULT '',
  notice_period             TEXT        NOT NULL DEFAULT '',
  probation_period          BOOLEAN     NOT NULL DEFAULT FALSE,
  property_return_due_at    TIMESTAMPTZ,
  return_protocol_case_id   UUID        REFERENCES public.employee_hr_cases(id) ON DELETE SET NULL,
  portal_block_at           TIMESTAMPTZ,
  final_payroll_check_status TEXT       CHECK (final_payroll_check_status IN ('pending', 'in_review', 'completed')),
  document_id               UUID,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.employee_terminations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS employee_terminations_tenant ON public.employee_terminations;
CREATE POLICY employee_terminations_tenant ON public.employee_terminations
  FOR ALL
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

CREATE TABLE IF NOT EXISTS public.employee_references (
  id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  case_id                 UUID        NOT NULL UNIQUE REFERENCES public.employee_hr_cases(id) ON DELETE CASCADE,
  employee_id             UUID        NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  reference_type          TEXT        NOT NULL CHECK (reference_type IN ('interim', 'simple', 'qualified')),
  employment_period       TEXT        NOT NULL DEFAULT '',
  role_description        TEXT        NOT NULL DEFAULT '',
  tasks                   TEXT        NOT NULL DEFAULT '',
  performance_assessment  TEXT        NOT NULL DEFAULT '',
  conduct_assessment      TEXT        NOT NULL DEFAULT '',
  closing_formula         TEXT        NOT NULL DEFAULT '',
  grade_internal          TEXT,
  document_id             UUID,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.employee_references ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS employee_references_tenant ON public.employee_references;
CREATE POLICY employee_references_tenant ON public.employee_references
  FOR ALL
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

CREATE TABLE IF NOT EXISTS public.employee_hr_audit_events (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  case_id     UUID        NOT NULL REFERENCES public.employee_hr_cases(id) ON DELETE CASCADE,
  event_type  TEXT        NOT NULL,
  summary     TEXT        NOT NULL DEFAULT '',
  actor_id    UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  actor_role  TEXT,
  metadata    JSONB       NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_employee_hr_audit_events_case
  ON public.employee_hr_audit_events (tenant_id, case_id, created_at DESC);

ALTER TABLE public.employee_hr_audit_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS employee_hr_audit_events_tenant ON public.employee_hr_audit_events;
CREATE POLICY employee_hr_audit_events_tenant ON public.employee_hr_audit_events
  FOR ALL
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

COMMENT ON TABLE public.employee_hr_cases IS 'Personalvorgänge — vorbereitet, nicht produktiv freigegeben';
