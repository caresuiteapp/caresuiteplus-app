-- ==========================================================================
-- CareSuite+ — Migration 0151: Soft-Delete Enum-Werte (Idempotent)
-- Fresh-DB: clients/employees nutzen TEXT+CHECK statt Enum — siehe 0079
-- ==========================================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_type
    WHERE typname = 'client_status' AND typnamespace = 'public'::regnamespace
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_enum e
      JOIN pg_type t ON t.oid = e.enumtypid
      WHERE t.typname = 'client_status' AND e.enumlabel = 'deleted'
    ) THEN
      ALTER TYPE public.client_status ADD VALUE 'deleted';
    END IF;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_type
    WHERE typname = 'employee_status' AND typnamespace = 'public'::regnamespace
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_enum e
      JOIN pg_type t ON t.oid = e.enumtypid
      WHERE t.typname = 'employee_status' AND e.enumlabel = 'deleted'
    ) THEN
      ALTER TYPE public.employee_status ADD VALUE 'deleted';
    END IF;
  END IF;
END $$;
