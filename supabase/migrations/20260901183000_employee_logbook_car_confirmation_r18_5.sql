-- CareSuite HealthOS · Fahrtenbuch P0 R18.5
-- Per-visit mobility proof, employee kilometre confirmation and safe R18.4 quarantine.
BEGIN;

CREATE TABLE IF NOT EXISTS public.employee_visit_mobility_selections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  assignment_id UUID NOT NULL,
  transport_mode TEXT NOT NULL CHECK (transport_mode IN ('car','transit','bicycle','escooter','walking')),
  selected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, employee_id, assignment_id)
);

ALTER TABLE public.employee_visit_mobility_selections ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS employee_visit_mobility_select ON public.employee_visit_mobility_selections;
CREATE POLICY employee_visit_mobility_select ON public.employee_visit_mobility_selections
FOR SELECT TO authenticated USING (public.employee_logbook_own_employee(tenant_id, employee_id));
DROP POLICY IF EXISTS employee_visit_mobility_write ON public.employee_visit_mobility_selections;
CREATE POLICY employee_visit_mobility_write ON public.employee_visit_mobility_selections
FOR ALL TO authenticated USING (public.employee_logbook_own_employee(tenant_id, employee_id))
WITH CHECK (public.employee_logbook_own_employee(tenant_id, employee_id));
GRANT SELECT, INSERT, UPDATE ON public.employee_visit_mobility_selections TO authenticated;

ALTER TABLE public.employee_logbook_trips
  ADD COLUMN IF NOT EXISTS employee_confirmed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS employee_confirmation_reason TEXT;

ALTER TABLE public.employee_logbook_trips DROP CONSTRAINT IF EXISTS employee_logbook_trips_status_check;
ALTER TABLE public.employee_logbook_trips ADD CONSTRAINT employee_logbook_trips_status_check
CHECK (status IN ('recording','confirmation_required','review_required','completed','corrected','confirmed','cancelled'));

-- R18.4 inferred historical car use from a vehicle that exists today. That is
-- not evidence for the old visit. Quarantine only those automatic recovery
-- rows for which no explicit per-visit car selection exists. Expense rows are
-- intentionally not touched.
UPDATE public.employee_logbook_trips trip
SET status = 'review_required',
    notes = CONCAT_WS(' ', NULLIF(trip.notes, ''),
      'R18.5 gesperrt: Für diesen historischen Einsatz ist keine ausdrückliche PKW-Auswahl nachgewiesen.'),
    updated_at = NOW()
WHERE trip.source LIKE 'assist_gps_recovery_r18:%'
  AND trip.status IN ('completed','confirmed')
  AND NOT EXISTS (
    SELECT 1 FROM public.employee_visit_mobility_selections mobility
    WHERE mobility.tenant_id = trip.tenant_id
      AND mobility.employee_id = trip.employee_id
      AND mobility.assignment_id = trip.assignment_id
      AND mobility.transport_mode = 'car'
  );

CREATE INDEX IF NOT EXISTS idx_employee_visit_mobility_assignment
ON public.employee_visit_mobility_selections (tenant_id, employee_id, assignment_id, transport_mode);

COMMIT;
