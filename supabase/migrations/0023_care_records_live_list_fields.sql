-- ==========================================================================
-- CareSuite+ — Migration 0023: care_records Live-Listen-Felder (Stationär)
-- Erweitert public.care_records für Bewohner:innen-Liste (Sprint 27 Live-Mapping).
-- Keine destruktiven Befehle (DROP/TRUNCATE/DELETE).
-- ==========================================================================

ALTER TABLE public.care_records
  ADD COLUMN IF NOT EXISTS record_type TEXT DEFAULT 'care_note',
  ADD COLUMN IF NOT EXISTS first_name TEXT,
  ADD COLUMN IF NOT EXISTS last_name TEXT,
  ADD COLUMN IF NOT EXISTS wing TEXT,
  ADD COLUMN IF NOT EXISTS admission_date TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS care_level TEXT,
  ADD COLUMN IF NOT EXISTS room_name TEXT;

CREATE INDEX IF NOT EXISTS idx_care_records_tenant_resident
  ON public.care_records (tenant_id, record_type)
  WHERE record_type = 'resident';

COMMENT ON COLUMN public.care_records.record_type IS 'Datensatztyp: resident (Stationär) oder care_note (Pflege)';
COMMENT ON COLUMN public.care_records.first_name IS 'Vorname Bewohner:in für Live-Liste';
COMMENT ON COLUMN public.care_records.last_name IS 'Nachname Bewohner:in für Live-Liste';
COMMENT ON COLUMN public.care_records.wing IS 'Wohnbereich für Live-Liste';
COMMENT ON COLUMN public.care_records.admission_date IS 'Aufnahmedatum für Live-Liste';
COMMENT ON COLUMN public.care_records.care_level IS 'Pflegegrad-Anzeige für Live-Liste';
COMMENT ON COLUMN public.care_records.room_name IS 'Zimmerbezeichnung für Live-Liste';
