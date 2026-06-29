-- ==========================================================================
-- CareSuite+ — Migration 0214: Multi-select transport modes for employee mobility
-- Adds transport_modes array; keeps transport_mode as primary (first) mode for legacy reads.
-- ==========================================================================

ALTER TABLE public.employee_mobility_settings
  ADD COLUMN IF NOT EXISTS transport_modes TEXT[] NOT NULL DEFAULT ARRAY['car']::TEXT[];

ALTER TABLE public.employee_mobility_settings
  DROP CONSTRAINT IF EXISTS employee_mobility_settings_transport_modes_check;

ALTER TABLE public.employee_mobility_settings
  ADD CONSTRAINT employee_mobility_settings_transport_modes_check
  CHECK (
    cardinality(transport_modes) >= 1
    AND transport_modes <@ ARRAY['car', 'transit', 'bicycle', 'escooter', 'walking']::TEXT[]
  );

UPDATE public.employee_mobility_settings
SET transport_modes = ARRAY[transport_mode]::TEXT[]
WHERE transport_modes IS NULL
   OR cardinality(transport_modes) = 0;

COMMENT ON COLUMN public.employee_mobility_settings.transport_modes IS
  'Selected Verkehrsmittel (multi-select): car | transit | bicycle | escooter | walking';
