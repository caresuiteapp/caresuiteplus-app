-- Visible client master data must be durable workflow data.
-- Existing columns are repeated idempotently because older production
-- histories may have applied the intake migrations incompletely.

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS salutation TEXT,
  ADD COLUMN IF NOT EXISTS service_start DATE,
  ADD COLUMN IF NOT EXISTS housing_form TEXT,
  ADD COLUMN IF NOT EXISTS special_notes TEXT,
  ADD COLUMN IF NOT EXISTS preferred_contact TEXT;

COMMENT ON COLUMN public.clients.salutation IS
  'Persisted client salutation selected in the Office record.';
COMMENT ON COLUMN public.clients.service_start IS
  'Contract/service start selected in the Office record.';
COMMENT ON COLUMN public.clients.housing_form IS
  'Persisted housing form selected in the Office record.';
COMMENT ON COLUMN public.clients.special_notes IS
  'Office-only internal profile notes from the master-data editor.';
COMMENT ON COLUMN public.clients.preferred_contact IS
  'Preferred contact channel selected in the Office record.';
