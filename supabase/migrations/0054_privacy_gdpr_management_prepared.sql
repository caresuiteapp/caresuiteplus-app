-- ==========================================================================
-- CareSuite+ — Migration 0054: Datenschutz- und DSGVO-Management (prepared)
-- Verarbeitungstätigkeiten, TOMs, AVV, Betroffenenrechte, Löschfristen
-- ==========================================================================

CREATE TABLE IF NOT EXISTS public.privacy_processing_activities (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  title               TEXT        NOT NULL,
  purpose             TEXT        NOT NULL DEFAULT '',
  legal_basis         TEXT        NOT NULL DEFAULT '',
  data_categories     TEXT[]      NOT NULL DEFAULT '{}',
  data_subjects       TEXT[]      NOT NULL DEFAULT '{}',
  recipients          TEXT[]      NOT NULL DEFAULT '{}',
  retention_reference TEXT,
  status              TEXT        NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_privacy_processing_activities_tenant
  ON public.privacy_processing_activities (tenant_id, status);

ALTER TABLE public.privacy_processing_activities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS privacy_processing_activities_tenant ON public.privacy_processing_activities;
CREATE POLICY privacy_processing_activities_tenant ON public.privacy_processing_activities
  FOR ALL
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

CREATE TABLE IF NOT EXISTS public.privacy_tom_records (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  title                 TEXT        NOT NULL,
  category              TEXT        NOT NULL DEFAULT '',
  description           TEXT        NOT NULL DEFAULT '',
  implementation_status TEXT        NOT NULL DEFAULT 'planned'
    CHECK (implementation_status IN ('planned', 'partial', 'implemented')),
  review_due_at         TIMESTAMPTZ,
  status                TEXT        NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_privacy_tom_records_tenant
  ON public.privacy_tom_records (tenant_id, status);

ALTER TABLE public.privacy_tom_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS privacy_tom_records_tenant ON public.privacy_tom_records;
CREATE POLICY privacy_tom_records_tenant ON public.privacy_tom_records
  FOR ALL
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

CREATE TABLE IF NOT EXISTS public.privacy_dpa_records (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  processor_name      TEXT        NOT NULL,
  service_description TEXT        NOT NULL DEFAULT '',
  signed_at           TIMESTAMPTZ,
  expires_at          TIMESTAMPTZ,
  document_id         UUID,
  status              TEXT        NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'active', 'expired', 'archived')),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_privacy_dpa_records_tenant
  ON public.privacy_dpa_records (tenant_id, status);

ALTER TABLE public.privacy_dpa_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS privacy_dpa_records_tenant ON public.privacy_dpa_records;
CREATE POLICY privacy_dpa_records_tenant ON public.privacy_dpa_records
  FOR ALL
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

-- Erweiterung data_subject_requests um DSGVO-Management-Status (additive)
DO $$ BEGIN
  ALTER TABLE public.data_subject_requests
    ADD COLUMN IF NOT EXISTS privacy_status TEXT
      CHECK (privacy_status IS NULL OR privacy_status IN (
        'received', 'identity_check_required', 'in_review', 'processing',
        'completed', 'rejected', 'archived'
      ));
EXCEPTION
  WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.data_subject_requests
    ADD COLUMN IF NOT EXISTS identity_verified BOOLEAN NOT NULL DEFAULT FALSE;
EXCEPTION
  WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.data_subject_requests
    ADD COLUMN IF NOT EXISTS identity_check_prepared BOOLEAN NOT NULL DEFAULT FALSE;
EXCEPTION
  WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.data_subject_requests
    ADD COLUMN IF NOT EXISTS contains_health_data BOOLEAN NOT NULL DEFAULT FALSE;
EXCEPTION
  WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.data_subject_requests
    ADD COLUMN IF NOT EXISTS internal_task_id UUID;
EXCEPTION
  WHEN duplicate_column THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.data_export_jobs (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  request_id          UUID        NOT NULL,
  status              public.job_status NOT NULL DEFAULT 'queued',
  includes_health_data BOOLEAN    NOT NULL DEFAULT FALSE,
  export_prepared     BOOLEAN     NOT NULL DEFAULT FALSE,
  approved_by_role    TEXT,
  result_summary      TEXT,
  completed_at        TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_data_export_jobs_tenant
  ON public.data_export_jobs (tenant_id, request_id);

ALTER TABLE public.data_export_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS data_export_jobs_tenant ON public.data_export_jobs;
CREATE POLICY data_export_jobs_tenant ON public.data_export_jobs
  FOR ALL
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

CREATE TABLE IF NOT EXISTS public.data_deletion_requests (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  request_id          UUID        NOT NULL,
  target_entity_type  TEXT        NOT NULL,
  target_entity_id    UUID        NOT NULL,
  review_status       TEXT        NOT NULL DEFAULT 'pending_review'
    CHECK (review_status IN (
      'pending_review', 'approved', 'rejected', 'blocked_retention', 'executed'
    )),
  retention_blocked   BOOLEAN     NOT NULL DEFAULT FALSE,
  retention_rule_id   UUID,
  reviewed_by_user_id UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at         TIMESTAMPTZ,
  review_notes        TEXT,
  executed_at         TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_data_deletion_requests_tenant
  ON public.data_deletion_requests (tenant_id, review_status);

ALTER TABLE public.data_deletion_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS data_deletion_requests_tenant ON public.data_deletion_requests;
CREATE POLICY data_deletion_requests_tenant ON public.data_deletion_requests
  FOR ALL
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

CREATE TABLE IF NOT EXISTS public.consent_records (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  subject_type  TEXT        NOT NULL,
  subject_id    UUID        NOT NULL,
  consent_type  TEXT        NOT NULL,
  granted       BOOLEAN     NOT NULL DEFAULT FALSE,
  granted_at    TIMESTAMPTZ,
  revoked_at    TIMESTAMPTZ,
  source        TEXT        NOT NULL DEFAULT 'manual',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_consent_records_tenant_subject
  ON public.consent_records (tenant_id, subject_type, subject_id);

ALTER TABLE public.consent_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS consent_records_tenant ON public.consent_records;
CREATE POLICY consent_records_tenant ON public.consent_records
  FOR ALL
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

CREATE TABLE IF NOT EXISTS public.retention_rules (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  entity_type           TEXT        NOT NULL,
  label                 TEXT        NOT NULL,
  retention_days        INTEGER     NOT NULL,
  legal_reference       TEXT        NOT NULL DEFAULT '',
  block_deletion_until  BOOLEAN     NOT NULL DEFAULT TRUE,
  status                TEXT        NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_retention_rules_tenant
  ON public.retention_rules (tenant_id, entity_type, status);

ALTER TABLE public.retention_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS retention_rules_tenant ON public.retention_rules;
CREATE POLICY retention_rules_tenant ON public.retention_rules
  FOR ALL
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

CREATE TABLE IF NOT EXISTS public.privacy_incident_reports (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  title         TEXT        NOT NULL,
  description   TEXT        NOT NULL DEFAULT '',
  severity      TEXT        NOT NULL DEFAULT 'medium'
    CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  status        TEXT        NOT NULL DEFAULT 'prepared'
    CHECK (status IN ('prepared', 'reported', 'investigating', 'closed')),
  reported_at   TIMESTAMPTZ,
  prepared_only BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_privacy_incident_reports_tenant
  ON public.privacy_incident_reports (tenant_id, status);

ALTER TABLE public.privacy_incident_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS privacy_incident_reports_tenant ON public.privacy_incident_reports;
CREATE POLICY privacy_incident_reports_tenant ON public.privacy_incident_reports
  FOR ALL
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

CREATE TABLE IF NOT EXISTS public.privacy_audit_events (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  action          TEXT        NOT NULL,
  entity_type     TEXT        NOT NULL,
  entity_id       UUID        NOT NULL,
  actor_user_id   UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  actor_role_key  TEXT,
  details         TEXT        NOT NULL DEFAULT '',
  metadata        JSONB       NOT NULL DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_privacy_audit_events_tenant
  ON public.privacy_audit_events (tenant_id, created_at DESC);

ALTER TABLE public.privacy_audit_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS privacy_audit_events_tenant ON public.privacy_audit_events;
CREATE POLICY privacy_audit_events_tenant ON public.privacy_audit_events
  FOR ALL
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

COMMENT ON TABLE public.privacy_processing_activities IS 'DSGVO Verarbeitungsverzeichnis (Art. 30) — prepared';
COMMENT ON TABLE public.privacy_incident_reports IS 'Datenschutzvorfälle — Meldeprozess prepared only';
