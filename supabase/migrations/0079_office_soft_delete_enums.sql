-- ==========================================================================
-- CareSuite+ — Migration 0079: Soft-Delete Enum-Werte (separater Commit nötig)
-- ==========================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'client_status' AND e.enumlabel = 'deleted'
  ) THEN
    ALTER TYPE public.client_status ADD VALUE 'deleted';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'employee_status' AND e.enumlabel = 'deleted'
  ) THEN
    ALTER TYPE public.employee_status ADD VALUE 'deleted';
  END IF;
END $$;
