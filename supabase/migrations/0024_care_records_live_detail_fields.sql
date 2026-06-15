-- ==========================================================================
-- CareSuite+ — Migration 0024: care_records Live-Detail-Felder (Stationär)
-- Erweitert public.care_records für Bewohner:innen-Detail (Sprint 27 Live-Mapping).
-- Keine destruktiven Befehle (DROP/TRUNCATE/DELETE).
-- ==========================================================================

ALTER TABLE public.care_records
  ADD COLUMN IF NOT EXISTS room_id TEXT,
  ADD COLUMN IF NOT EXISTS notes TEXT;

COMMENT ON COLUMN public.care_records.room_id IS 'Zimmer-ID für Bewohner:innen-Detail';
COMMENT ON COLUMN public.care_records.notes IS 'Pflegenotizen für Bewohner:innen-Detail';
