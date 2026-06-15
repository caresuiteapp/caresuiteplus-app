-- ==========================================================================
-- CareSuite+ — Migration 0033: employees Live-Detail-Felder (Office Vollprofil)
-- Erweitert public.employees für Mitarbeitenden-Detail (Sprint 72 Live-Mapping).
-- Spalten existieren ggf. bereits in 0005 — ADD IF NOT EXISTS ist idempotent.
-- Keine destruktiven Befehle (DROP/TRUNCATE/DELETE).
-- ==========================================================================

ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS department TEXT,
  ADD COLUMN IF NOT EXISTS start_date DATE,
  ADD COLUMN IF NOT EXISTS notes TEXT;

COMMENT ON COLUMN public.employees.department IS 'Abteilung für Mitarbeitenden-Vollprofil';
COMMENT ON COLUMN public.employees.start_date IS 'Eintrittsdatum für Mitarbeitenden-Vollprofil';
COMMENT ON COLUMN public.employees.notes IS 'HR-Notizen für Mitarbeitenden-Vollprofil';
