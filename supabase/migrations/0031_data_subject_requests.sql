-- ==========================================================================
-- CareSuite+ — Migration 0031: data_subject_requests (DSGVO Betroffenenrechte)
-- Safe additive migration — CREATE TABLE IF NOT EXISTS, RLS, no destructive ops.
-- ==========================================================================

DO $$ BEGIN
  CREATE TYPE public.data_request_type AS ENUM (
    'access',
    'export',
    'correction',
    'deletion',
    'restriction',
    'objection',
    'portability',
    'consent_withdrawal',
    'other'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.job_status AS ENUM (
    'queued',
    'running',
    'completed',
    'failed',
    'cancelled'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.data_subject_requests (
  id                  UUID                    PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID                    NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  profile_id          UUID                    REFERENCES public.profiles(id) ON DELETE SET NULL,
  client_id           UUID                    REFERENCES public.clients(id) ON DELETE SET NULL,
  employee_id         UUID                    REFERENCES public.employees(id) ON DELETE SET NULL,
  request_type        public.data_request_type NOT NULL,
  status              public.job_status       NOT NULL DEFAULT 'queued',
  requester_name      TEXT,
  requester_email     TEXT,
  verification_notes  TEXT,
  request_number      TEXT,
  metadata            JSONB                   NOT NULL DEFAULT '{}'::jsonb,
  received_at         TIMESTAMPTZ,
  due_at              TIMESTAMPTZ,
  completed_at        TIMESTAMPTZ,
  export_document_id  UUID,
  result_summary      TEXT,
  created_at          TIMESTAMPTZ             NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ             NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS data_subject_requests_tenant_id_idx
  ON public.data_subject_requests (tenant_id);

CREATE INDEX IF NOT EXISTS data_subject_requests_profile_id_idx
  ON public.data_subject_requests (profile_id);

CREATE INDEX IF NOT EXISTS data_subject_requests_status_idx
  ON public.data_subject_requests (tenant_id, status);

ALTER TABLE public.data_subject_requests ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY data_subject_requests_tenant_isolation ON public.data_subject_requests
    FOR ALL
    USING (tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()))
    WITH CHECK (
      tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
      AND (profile_id IS NULL OR profile_id = auth.uid())
    );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

COMMENT ON TABLE public.data_subject_requests IS 'DSGVO Betroffenenanfragen — Einreichung via authentifiziertem Anon-Client mit RLS (Sprint 49)';
