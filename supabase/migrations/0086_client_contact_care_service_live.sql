-- CareSuite+ — Migration 0086: Pflegedienst-Kontakttyp (care_service) auf Live
-- Kontakt-Tab: feste Kategorie „Pflegedienst“ in client_contacts.contact_type

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'client_contact_type'
      AND e.enumlabel = 'care_service'
  ) THEN
    ALTER TYPE public.client_contact_type ADD VALUE 'care_service';
  END IF;
END $$;
