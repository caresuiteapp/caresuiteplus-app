-- CareSuite+ Office: frei wählbarer Leistungszeitraum für Rechnungen.
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS service_period_from DATE,
  ADD COLUMN IF NOT EXISTS service_period_to DATE;

UPDATE public.invoices
SET
  service_period_from = COALESCE(service_period_from, service_month),
  service_period_to = COALESCE(service_period_to, service_month)
WHERE service_month IS NOT NULL
  AND (service_period_from IS NULL OR service_period_to IS NULL);

COMMENT ON COLUMN public.invoices.service_period_from IS
  'Erster Tag des abgerechneten Leistungszeitraums.';
COMMENT ON COLUMN public.invoices.service_period_to IS
  'Letzter Tag des abgerechneten Leistungszeitraums.';

ALTER TABLE public.invoices
  DROP CONSTRAINT IF EXISTS invoices_service_period_order_check;
ALTER TABLE public.invoices
  ADD CONSTRAINT invoices_service_period_order_check
  CHECK (
    service_period_from IS NULL
    OR service_period_to IS NULL
    OR service_period_from <= service_period_to
  );
