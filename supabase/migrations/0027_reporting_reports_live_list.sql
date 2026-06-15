-- ==========================================================================
-- CareSuite+ — Migration 0027: reporting_reports Live-Listen-Tabelle
-- Erstellt public.reporting_reports für Berichte-Liste (Sprint 29 Live-Mapping).
-- Keine destruktiven Befehle (DROP/TRUNCATE/DELETE).
-- ==========================================================================

CREATE TABLE IF NOT EXISTS public.reporting_reports (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  title       TEXT        NOT NULL,
  category    TEXT        NOT NULL DEFAULT 'pdl'
              CHECK (category IN ('pdl', 'quality', 'finance', 'operations')),
  period      TEXT        NOT NULL DEFAULT 'Aktuell',
  status      TEXT        NOT NULL DEFAULT 'entwurf'
              CHECK (status IN (
                'entwurf','aktiv','in_bearbeitung','abgeschlossen',
                'archiviert','fehlerhaft','gesperrt'
              )),
  created_by  UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reporting_reports_tenant
  ON public.reporting_reports (tenant_id, updated_at DESC);

ALTER TABLE public.reporting_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY reporting_reports_tenant_isolation ON public.reporting_reports
  FOR ALL
  USING (tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()))
  WITH CHECK (tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));

COMMENT ON TABLE public.reporting_reports IS 'Business Reporting Berichte (Live-Liste Sprint 29)';
COMMENT ON COLUMN public.reporting_reports.category IS 'Berichtskategorie für Live-Liste';
COMMENT ON COLUMN public.reporting_reports.period IS 'Berichtszeitraum für Live-Liste';
