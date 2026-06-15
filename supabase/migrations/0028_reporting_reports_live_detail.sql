-- ==========================================================================
-- CareSuite+ — Migration 0028: reporting_reports Live-Detail-Felder
-- Erweitert public.reporting_reports für Bericht-Detail (Sprint 29 Live-Mapping).
-- Keine destruktiven Befehle (DROP/TRUNCATE/DELETE).
-- ==========================================================================

ALTER TABLE public.reporting_reports
  ADD COLUMN IF NOT EXISTS summary TEXT,
  ADD COLUMN IF NOT EXISTS kpi_snapshot JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.reporting_reports.summary IS 'Berichtszusammenfassung für Live-Detail';
COMMENT ON COLUMN public.reporting_reports.kpi_snapshot IS 'KPI-Snapshot als JSON-Array für Live-Detail';
