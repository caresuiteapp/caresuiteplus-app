-- ==========================================================================
-- CareSuite+ — Migration 0025: catalogs Live-Listen-Felder (Akademie)
-- Erweitert public.catalogs für Kurs-Liste (Sprint 28 Live-Mapping).
-- Keine destruktiven Befehle (DROP/TRUNCATE/DELETE).
-- ==========================================================================

ALTER TABLE public.catalogs
  ADD COLUMN IF NOT EXISTS category TEXT,
  ADD COLUMN IF NOT EXISTS duration_minutes INTEGER,
  ADD COLUMN IF NOT EXISTS is_mandatory BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS starts_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS enrollment_count INTEGER DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_catalogs_tenant_course
  ON public.catalogs (tenant_id, catalog_type)
  WHERE catalog_type = 'course';

COMMENT ON COLUMN public.catalogs.category IS 'Kurskategorie für Live-Kursliste';
COMMENT ON COLUMN public.catalogs.duration_minutes IS 'Kursdauer in Minuten für Live-Kursliste';
COMMENT ON COLUMN public.catalogs.is_mandatory IS 'Pflichtkurs-Kennzeichen für Live-Kursliste';
COMMENT ON COLUMN public.catalogs.starts_at IS 'Kursbeginn für Live-Kursliste';
COMMENT ON COLUMN public.catalogs.enrollment_count IS 'Teilnehmendenzahl für Live-Kursliste';
