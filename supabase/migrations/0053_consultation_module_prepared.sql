-- ==========================================================================
-- CareSuite+ — Migration 0053: Beratungsmodul (prepared)
-- Pflegeberatung, Protokolle, Maßnahmenplanung, Wiedervorlagen, Abrechnungsvorbereitung.
-- Keine produktive Abrechnung ohne Validierung. NICHT pushen.
-- ==========================================================================

-- --------------------------------------------------------------------------
-- 1. consultation_cases — Beratungsfälle
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.consultation_cases_v2 (
  id                          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                   UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  client_id                   UUID        NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  assigned_profile_id         UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  occasion_key                TEXT        NOT NULL DEFAULT 'allgemein'
    CHECK (occasion_key IN (
      'pflegeberatung_37_3', 'pflegegrad_antrag', 'entlastungsleistung',
      'angehoerigenberatung', 'massnahmenplanung', 'widerspruch', 'allgemein'
    )),
  title                       TEXT        NOT NULL,
  status                      TEXT        NOT NULL DEFAULT 'draft'
    CHECK (status IN (
      'draft', 'scheduled', 'in_progress', 'documentation_pending',
      'signature_pending', 'completed', 'review_pending', 'billing_ready', 'archived'
    )),
  scheduled_at                TIMESTAMPTZ,
  completed_at                TIMESTAMPTZ,
  contains_health_data        BOOLEAN     NOT NULL DEFAULT FALSE,
  billing_prepared_at         TIMESTAMPTZ,
  legal_disclaimer_acknowledged BOOLEAN   NOT NULL DEFAULT FALSE,
  created_by                  UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_by                  UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_consultation_cases_v2_tenant
  ON public.consultation_cases_v2 (tenant_id, status, scheduled_at DESC);

CREATE INDEX IF NOT EXISTS idx_consultation_cases_v2_client
  ON public.consultation_cases_v2 (tenant_id, client_id);

-- --------------------------------------------------------------------------
-- 2. consultation_sessions — Beratungstermine / Sitzungen
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.consultation_sessions (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  case_id               UUID        NOT NULL REFERENCES public.consultation_cases_v2(id) ON DELETE CASCADE,
  session_at            TIMESTAMPTZ NOT NULL,
  duration_minutes      INTEGER     CHECK (duration_minutes IS NULL OR duration_minutes > 0),
  counselor_profile_id  UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  occasion_key          TEXT        NOT NULL DEFAULT 'allgemein',
  notes                 TEXT,
  status                TEXT        NOT NULL DEFAULT 'planned'
    CHECK (status IN ('planned', 'held', 'cancelled', 'no_show')),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_consultation_sessions_tenant
  ON public.consultation_sessions (tenant_id, case_id, session_at DESC);

-- --------------------------------------------------------------------------
-- 3. consultation_assessments — Pflegegrad, Situation, Bedarf
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.consultation_assessments (
  id                          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                   UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  case_id                     UUID        NOT NULL REFERENCES public.consultation_cases_v2(id) ON DELETE CASCADE,
  session_id                  UUID        REFERENCES public.consultation_sessions(id) ON DELETE SET NULL,
  care_grade                  TEXT        CHECK (care_grade IN ('pg1','pg2','pg3','pg4','pg5','none','unknown')),
  care_grade_valid_from       DATE,
  home_situation_summary      TEXT,
  support_needs_summary       TEXT,
  relief_services_notes       TEXT,
  relative_consultation_notes TEXT,
  contains_health_data        BOOLEAN     NOT NULL DEFAULT FALSE,
  recorded_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_consultation_assessments_tenant
  ON public.consultation_assessments (tenant_id, case_id);

-- --------------------------------------------------------------------------
-- 4. consultation_recommendations — Maßnahmenplan
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.consultation_recommendations_v2 (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  case_id               UUID        NOT NULL REFERENCES public.consultation_cases_v2(id) ON DELETE CASCADE,
  title                 TEXT        NOT NULL,
  description           TEXT        NOT NULL DEFAULT '',
  priority              TEXT        NOT NULL DEFAULT 'medium'
    CHECK (priority IN ('low', 'medium', 'high')),
  status                TEXT        NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'proposed', 'accepted', 'rejected', 'archived')),
  is_informational_only BOOLEAN     NOT NULL DEFAULT TRUE,
  due_at                TIMESTAMPTZ,
  created_by            UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_consultation_recommendations_v2_tenant
  ON public.consultation_recommendations_v2 (tenant_id, case_id, status);

-- --------------------------------------------------------------------------
-- 5. consultation_documents — Protokolle, Unterschriften, Anhänge
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.consultation_documents (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  case_id               UUID        NOT NULL REFERENCES public.consultation_cases_v2(id) ON DELETE CASCADE,
  session_id            UUID        REFERENCES public.consultation_sessions(id) ON DELETE SET NULL,
  document_type         TEXT        NOT NULL
    CHECK (document_type IN ('protocol', 'measure_plan', 'consent', 'signature', 'attachment')),
  title                 TEXT        NOT NULL,
  status                TEXT        NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'finalized', 'signed', 'archived')),
  current_version       INTEGER     NOT NULL DEFAULT 1,
  content_hash          TEXT,
  storage_reference     TEXT,
  signed_at             TIMESTAMPTZ,
  signed_by_profile_id  UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  contains_health_data  BOOLEAN     NOT NULL DEFAULT FALSE,
  created_by            UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_consultation_documents_tenant
  ON public.consultation_documents (tenant_id, case_id, document_type);

CREATE TABLE IF NOT EXISTS public.consultation_document_versions (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  document_id           UUID        NOT NULL REFERENCES public.consultation_documents(id) ON DELETE CASCADE,
  version_number        INTEGER     NOT NULL,
  content_hash          TEXT        NOT NULL,
  storage_reference     TEXT        NOT NULL,
  change_reason         TEXT,
  is_correction         BOOLEAN     NOT NULL DEFAULT FALSE,
  created_by_profile_id UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (document_id, version_number)
);

-- --------------------------------------------------------------------------
-- 6. consultation_followups — Wiedervorlagen
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.consultation_followups (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  case_id               UUID        NOT NULL REFERENCES public.consultation_cases_v2(id) ON DELETE CASCADE,
  due_at                TIMESTAMPTZ NOT NULL,
  assignee_profile_id   UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  status                TEXT        NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'scheduled', 'completed', 'cancelled')),
  note                  TEXT,
  reminder_sent_at      TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_consultation_followups_tenant
  ON public.consultation_followups (tenant_id, due_at, status);

-- --------------------------------------------------------------------------
-- 7. consultation_audit_events — Audit-Trail
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.consultation_audit_events (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  case_id           UUID        REFERENCES public.consultation_cases_v2(id) ON DELETE SET NULL,
  event_type        TEXT        NOT NULL,
  summary           TEXT        NOT NULL,
  actor_profile_id  UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  old_status        TEXT,
  new_status        TEXT,
  metadata          JSONB,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_consultation_audit_events_tenant
  ON public.consultation_audit_events (tenant_id, case_id, created_at DESC);

-- --------------------------------------------------------------------------
-- RLS (prepared — tenant isolation)
-- --------------------------------------------------------------------------
ALTER TABLE public.consultation_cases_v2 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consultation_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consultation_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consultation_recommendations_v2 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consultation_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consultation_document_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consultation_followups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consultation_audit_events ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'consultation_cases_v2', 'consultation_sessions', 'consultation_assessments',
    'consultation_recommendations_v2', 'consultation_documents',
    'consultation_document_versions', 'consultation_followups', 'consultation_audit_events'
  ] LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS tenant_isolation ON public.%I;
       CREATE POLICY tenant_isolation ON public.%I
         FOR ALL USING (tenant_id = public.current_tenant_id())
         WITH CHECK (tenant_id = public.current_tenant_id());',
      tbl, tbl
    );
  END LOOP;
END $$;

COMMENT ON TABLE public.consultation_cases_v2 IS
  'Beratungsfälle — vorbereitet, nicht produktiv bis Remote-Apply';
