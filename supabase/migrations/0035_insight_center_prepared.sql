-- ==========================================================================
-- CareSuite+ — Migration 0035: InsightCenter (preparedOnly Schema Prep)
-- Vorbereitung für Mandanten-Analytics, Snapshots und geplante Exporte.
-- Keine destruktiven Befehle. isInsightLiveReady() bleibt false bis ETL aktiv.
-- ==========================================================================

CREATE TABLE IF NOT EXISTS public.insight_data_sources (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  module_key        TEXT        NOT NULL,
  label             TEXT        NOT NULL,
  connection_status TEXT        NOT NULL DEFAULT 'prepared',
  last_sync_at      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.insight_snapshots (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  title        TEXT        NOT NULL,
  module_label TEXT        NOT NULL,
  description  TEXT,
  kpi_count    INTEGER     NOT NULL DEFAULT 0,
  period_label TEXT,
  status       TEXT        NOT NULL DEFAULT 'prepared',
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.insight_scheduled_exports (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  title           TEXT        NOT NULL,
  format          TEXT        NOT NULL DEFAULT 'csv',
  schedule_label  TEXT        NOT NULL,
  status          TEXT        NOT NULL DEFAULT 'planned',
  description     TEXT,
  recipient_label TEXT,
  columns_label   TEXT,
  last_run_label  TEXT,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_insight_snapshots_tenant
  ON public.insight_snapshots (tenant_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_insight_exports_tenant
  ON public.insight_scheduled_exports (tenant_id, updated_at DESC);

ALTER TABLE public.insight_data_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.insight_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.insight_scheduled_exports ENABLE ROW LEVEL SECURITY;

CREATE POLICY insight_data_sources_tenant ON public.insight_data_sources
  FOR ALL
  USING (tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()))
  WITH CHECK (tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY insight_snapshots_tenant ON public.insight_snapshots
  FOR ALL
  USING (tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()))
  WITH CHECK (tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY insight_scheduled_exports_tenant ON public.insight_scheduled_exports
  FOR ALL
  USING (tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()))
  WITH CHECK (tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));

COMMENT ON TABLE public.insight_snapshots IS 'InsightCenter KPI-Snapshots — preparedOnly bis Warehouse-ETL (Sprint 97–98)';
