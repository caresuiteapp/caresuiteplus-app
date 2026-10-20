-- CareSuite+ — Migration 0086: Pflegedienst-Kontakttyp (care_service) auf Live
-- Kontakt-Tab: feste Kategorie „Pflegedienst“ in client_contacts.contact_type

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_type
    WHERE typname = 'client_contact_type' AND typnamespace = 'public'::regnamespace
  ) THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_enum e
      JOIN pg_type t ON e.enumtypid = t.oid
      WHERE t.typname = 'client_contact_type'
        AND e.enumlabel = 'care_service'
    ) THEN
      ALTER TYPE public.client_contact_type ADD VALUE 'care_service';
    END IF;
  ELSE
    ALTER TABLE public.client_contacts
      ADD COLUMN IF NOT EXISTS contact_type TEXT NOT NULL DEFAULT 'other';

    ALTER TABLE public.client_contacts DROP CONSTRAINT IF EXISTS client_contacts_contact_type_check;
    ALTER TABLE public.client_contacts
      ADD CONSTRAINT client_contacts_contact_type_check
      CHECK (contact_type IN (
        'emergency_contact', 'relative', 'doctor', 'care_service', 'other'
      ));
  END IF;
END $$;
