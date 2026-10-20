-- ==========================================================================
-- CareSuite+ — Migration 0026: catalogs Live-Detail-Felder (Akademie)
-- Erweitert public.catalogs für Kurs-Detail (Sprint 28 Live-Mapping).
-- Keine destruktiven Befehle (DROP/TRUNCATE/DELETE).
-- ==========================================================================

ALTER TABLE public.catalogs
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS ends_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS instructor_name TEXT,
  ADD COLUMN IF NOT EXISTS completion_rate_percent INTEGER DEFAULT 0;

COMMENT ON COLUMN public.catalogs.description IS 'Kursbeschreibung für Live-Kursdetail';
COMMENT ON COLUMN public.catalogs.ends_at IS 'Kursende für Live-Kursdetail';
COMMENT ON COLUMN public.catalogs.instructor_name IS 'Dozent:in für Live-Kursdetail';
COMMENT ON COLUMN public.catalogs.completion_rate_percent IS 'Abschlussquote in Prozent für Live-Kursdetail';
