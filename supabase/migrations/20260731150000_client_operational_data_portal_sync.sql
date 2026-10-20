-- Operational client data is workflow data, not decorative metadata.
-- This migration exposes it only to the affected client and assigned employees.

CREATE OR REPLACE FUNCTION public.get_client_portal_operational_profile()
RETURNS TABLE (
  home_access TEXT,
  floor TEXT,
  elevator_available BOOLEAN,
  parking_notes TEXT,
  access_notes TEXT,
  hazard_notes TEXT,
  pets TEXT,
  smoker_household BOOLEAN,
  aids_on_site TEXT,
  hygiene_notes TEXT,
  infection_notes TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    details.home_access,
    details.floor,
    details.elevator_available,
    details.parking_notes,
    details.access_notes,
    details.hazard_notes,
    details.pets,
    details.smoker_household,
    details.aids_on_site,
    details.hygiene_notes,
    details.infection_notes
  FROM public.client_ambulatory_details AS details
  WHERE details.tenant_id = public.current_tenant_id()
    AND details.client_id = public.current_client_id()
    AND public.current_client_id() IS NOT NULL
  LIMIT 1
$$;

REVOKE ALL ON FUNCTION public.get_client_portal_operational_profile() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_client_portal_operational_profile() TO authenticated;

DROP POLICY IF EXISTS clients_portal_employee_assigned_select ON public.clients;
CREATE POLICY clients_portal_employee_assigned_select ON public.clients
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND public.is_employee_portal_rls_context(tenant_id)
    AND id IN (
      SELECT visit.client_id
      FROM public.assist_visits AS visit
      WHERE visit.tenant_id = public.current_tenant_id()
        AND visit.employee_id = public.resolve_current_employee_id()
        AND visit.planning_status <> 'draft'
      UNION
      SELECT assignment.client_id
      FROM public.assignments AS assignment
      WHERE assignment.tenant_id = public.current_tenant_id()
        AND assignment.employee_id = public.resolve_current_employee_id()
    )
  );

DO $$
DECLARE
  table_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'client_ambulatory_details',
    'client_preferences',
    'client_risks'
  ]
  LOOP
    IF to_regclass('public.' || table_name) IS NOT NULL THEN
      EXECUTE format(
        'DROP POLICY IF EXISTS portal_employee_assigned_operational_select ON public.%I',
        table_name
      );
      EXECUTE format(
        'CREATE POLICY portal_employee_assigned_operational_select ON public.%I
           FOR SELECT TO authenticated
           USING (
             tenant_id = public.current_tenant_id()
             AND public.is_employee_portal_rls_context(tenant_id)
             AND client_id IN (
               SELECT visit.client_id
               FROM public.assist_visits AS visit
               WHERE visit.tenant_id = public.current_tenant_id()
                 AND visit.employee_id = public.resolve_current_employee_id()
                 AND visit.planning_status <> ''draft''
               UNION
               SELECT assignment.client_id
               FROM public.assignments AS assignment
               WHERE assignment.tenant_id = public.current_tenant_id()
                 AND assignment.employee_id = public.resolve_current_employee_id()
             )
           )',
        table_name
      );
      EXECUTE format('GRANT SELECT ON public.%I TO authenticated', table_name);
    END IF;
  END LOOP;
END
$$;

COMMENT ON FUNCTION public.get_client_portal_operational_profile() IS
  'Sanitized self-service projection; deliberately excludes keys, door codes and internal notes.';
