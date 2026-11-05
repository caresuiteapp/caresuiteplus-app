-- Preserve legacy labels on old rows. Managed invoices use only the canonical
-- lifecycle; no translation of an old label into issued/paid/approved evidence.
ALTER TABLE public.clients ADD COLUMN billing_party public.billing_party;
DO $$ BEGIN
 IF (SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conrelid='public.invoices'::regclass AND conname='invoices_status_check') IS DISTINCT FROM
  'CHECK ((status = ANY (ARRAY[''entwurf''::text, ''aktiv''::text, ''in_bearbeitung''::text, ''abgeschlossen''::text, ''archiviert''::text, ''fehlerhaft''::text, ''gesperrt''::text])))' THEN
  RAISE EXCEPTION 'Unreviewed legacy invoice status constraint'; END IF;
END $$;
ALTER TABLE public.invoices DROP CONSTRAINT invoices_status_check;
ALTER TABLE public.invoices ADD CONSTRAINT invoices_status_check CHECK (
 (office_managed AND status IN ('draft','ready','sent','partly_paid','paid','overdue','cancelled','written_off')) OR
 (NOT office_managed AND status IN ('entwurf','aktiv','in_bearbeitung','abgeschlossen','archiviert','fehlerhaft','gesperrt'))
);
