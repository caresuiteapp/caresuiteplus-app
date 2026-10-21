-- Additive staging prerequisite. No clinical values, actual event times or payloads are backfilled.
DO $$ BEGIN
 IF to_regtype('public.medication_status') IS NULL THEN
 CREATE TYPE public.medication_status AS ENUM ('active','paused','stopped','archived');
 END IF;
END $$;
ALTER TABLE public.medications
 ADD COLUMN IF NOT EXISTS status public.medication_status,
 ADD COLUMN IF NOT EXISTS active_ingredient text,
 ADD COLUMN IF NOT EXISTS strength text,
 ADD COLUMN IF NOT EXISTS form text,
 ADD COLUMN IF NOT EXISTS route text,
 ADD COLUMN IF NOT EXISTS prescribed_by text,
 ADD COLUMN IF NOT EXISTS start_date date,
 ADD COLUMN IF NOT EXISTS end_date date,
 ADD COLUMN IF NOT EXISTS indication text,
 ADD COLUMN IF NOT EXISTS is_prn boolean;
ALTER TABLE public.medication_administrations
 ADD COLUMN IF NOT EXISTS occurred_at timestamptz,
 ADD COLUMN IF NOT EXISTS creation_payload jsonb;
