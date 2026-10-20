-- CareSuite HealthOS · Fahrtenbuch R2
-- Verwaltungsfunktionen trennen, Klient:innenzuordnung erlauben, Stammdaten schützen.

BEGIN;

DO $$
DECLARE
  constraint_name TEXT;
BEGIN
  FOR constraint_name IN
    SELECT constraint_row.conname
    FROM pg_constraint constraint_row
    WHERE constraint_row.conrelid = 'public.employee_logbook_trips'::regclass
      AND constraint_row.contype = 'c'
      AND pg_get_constraintdef(constraint_row.oid) ILIKE '%assignment_id%'
      AND pg_get_constraintdef(constraint_row.oid) ILIKE '%manual_reason%'
  LOOP
    EXECUTE format(
      'ALTER TABLE public.employee_logbook_trips DROP CONSTRAINT %I',
      constraint_name
    );
  END LOOP;
END;
$$;
ALTER TABLE public.employee_logbook_trips
  DROP CONSTRAINT IF EXISTS employee_logbook_trips_assignment_or_reason_check;
ALTER TABLE public.employee_logbook_trips
  ADD CONSTRAINT employee_logbook_trips_assignment_or_reason_check
  CHECK (
    assignment_id IS NOT NULL
    OR client_id IS NOT NULL
    OR char_length(trim(COALESCE(manual_reason, ''))) >= 3
  );

CREATE OR REPLACE FUNCTION public.protect_employee_logbook_office_profile_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rate INTEGER := 30;
BEGIN
  IF public.is_employee_portal_rls_context(NEW.tenant_id) THEN
    IF TG_OP = 'INSERT' THEN
      SELECT COALESCE(settings.mileage_rate_cents, 30)
        INTO v_rate
      FROM (SELECT NEW.tenant_id AS tenant_id, NEW.employee_id AS employee_id) source
      LEFT JOIN public.employee_payroll_settings settings
        ON settings.tenant_id = source.tenant_id
       AND settings.employee_id = source.employee_id;
      NEW.default_vehicle_id := NULL;
      NEW.mileage_rate_cents := COALESCE(v_rate, 30);
    ELSE
      NEW.default_vehicle_id := OLD.default_vehicle_id;
      NEW.mileage_rate_cents := OLD.mileage_rate_cents;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS employee_logbook_protect_office_profile_fields
  ON public.employee_logbook_profiles;
CREATE TRIGGER employee_logbook_protect_office_profile_fields
BEFORE INSERT OR UPDATE ON public.employee_logbook_profiles
FOR EACH ROW EXECUTE FUNCTION public.protect_employee_logbook_office_profile_fields();

DROP POLICY IF EXISTS employee_logbook_vehicles_access ON public.employee_logbook_vehicles;
DROP POLICY IF EXISTS employee_logbook_vehicles_select ON public.employee_logbook_vehicles;
DROP POLICY IF EXISTS employee_logbook_vehicles_office_insert ON public.employee_logbook_vehicles;
DROP POLICY IF EXISTS employee_logbook_vehicles_office_update ON public.employee_logbook_vehicles;
DROP POLICY IF EXISTS employee_logbook_vehicles_office_delete ON public.employee_logbook_vehicles;

CREATE POLICY employee_logbook_vehicles_select
ON public.employee_logbook_vehicles
FOR SELECT TO authenticated
USING (public.employee_logbook_own_employee(tenant_id, employee_id));

CREATE POLICY employee_logbook_vehicles_office_insert
ON public.employee_logbook_vehicles
FOR INSERT TO authenticated
WITH CHECK (
  tenant_id = public.current_tenant_id()
  AND NOT public.is_employee_portal_rls_context(tenant_id)
);

CREATE POLICY employee_logbook_vehicles_office_update
ON public.employee_logbook_vehicles
FOR UPDATE TO authenticated
USING (
  tenant_id = public.current_tenant_id()
  AND NOT public.is_employee_portal_rls_context(tenant_id)
)
WITH CHECK (
  tenant_id = public.current_tenant_id()
  AND NOT public.is_employee_portal_rls_context(tenant_id)
);

CREATE POLICY employee_logbook_vehicles_office_delete
ON public.employee_logbook_vehicles
FOR DELETE TO authenticated
USING (
  tenant_id = public.current_tenant_id()
  AND NOT public.is_employee_portal_rls_context(tenant_id)
);

GRANT EXECUTE ON FUNCTION public.protect_employee_logbook_office_profile_fields() TO authenticated;

COMMIT;
