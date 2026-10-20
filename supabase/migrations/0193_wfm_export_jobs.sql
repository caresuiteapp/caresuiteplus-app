-- ==========================================================================
-- CareSuite+ — Migration 0193: WFM Export jobs (Phase 5 foundation)
-- ==========================================================================

CREATE TABLE IF NOT EXISTS public.workforce_export_jobs (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  requested_by    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  export_format   TEXT        NOT NULL DEFAULT 'csv' CHECK (export_format IN ('csv', 'pdf', 'datev_stub')),
  period_year     INTEGER     NOT NULL CHECK (period_year BETWEEN 2000 AND 2100),
  period_month    INTEGER     NOT NULL CHECK (period_month BETWEEN 1 AND 12),
  status          TEXT        NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'processing', 'completed', 'failed'
  )),
  row_count       INTEGER     NOT NULL DEFAULT 0 CHECK (row_count >= 0),
  checksum        TEXT,
  error_message   TEXT,
  metadata        JSONB       NOT NULL DEFAULT '{}'::jsonb,
  completed_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_workforce_export_jobs_tenant
  ON public.workforce_export_jobs (tenant_id, created_at DESC);

DROP TRIGGER IF EXISTS set_workforce_export_jobs_updated_at ON public.workforce_export_jobs;
CREATE TRIGGER set_workforce_export_jobs_updated_at
  BEFORE UPDATE ON public.workforce_export_jobs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.workforce_export_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS wfm_export_jobs_select ON public.workforce_export_jobs;
CREATE POLICY wfm_export_jobs_select ON public.workforce_export_jobs
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND (
      requested_by = auth.uid()
      OR public.has_permission('time.tracking.admin.export')
      OR public.is_tenant_admin()
    )
  );

DROP POLICY IF EXISTS wfm_export_jobs_insert ON public.workforce_export_jobs;
CREATE POLICY wfm_export_jobs_insert ON public.workforce_export_jobs
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND requested_by = auth.uid()
    AND (
      public.has_permission('time.tracking.admin.export')
      OR public.is_tenant_admin()
    )
  );

DROP POLICY IF EXISTS wfm_export_jobs_update ON public.workforce_export_jobs;
CREATE POLICY wfm_export_jobs_update ON public.workforce_export_jobs
  FOR UPDATE TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND (
      public.has_permission('time.tracking.admin.export')
      OR public.is_tenant_admin()
    )
  );

GRANT SELECT, INSERT, UPDATE ON public.workforce_export_jobs TO authenticated;
