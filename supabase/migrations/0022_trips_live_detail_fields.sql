-- ==========================================================================
-- CareSuite+ — Migration 0022: trips Live-Detail-Felder
-- Erweitert public.trips für Assist Fahrtenbuch Detail-Ansicht (Sprint 25).
-- Keine destruktiven Befehle (DROP/TRUNCATE/DELETE).
-- ==========================================================================

ALTER TABLE public.trips
  ADD COLUMN IF NOT EXISTS start_address TEXT,
  ADD COLUMN IF NOT EXISTS end_address TEXT,
  ADD COLUMN IF NOT EXISTS notes TEXT;

COMMENT ON COLUMN public.trips.start_address IS 'Startadresse für Live-Fahrtdetail';
COMMENT ON COLUMN public.trips.end_address IS 'Zieladresse für Live-Fahrtdetail (optional bei laufender Fahrt)';
COMMENT ON COLUMN public.trips.notes IS 'Notizen zur Fahrt (optional)';
