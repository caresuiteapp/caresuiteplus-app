-- Personal employee portal reads for the current care_tours model.
-- Apply after the existing employee-identity and care-operations migrations.
BEGIN;

-- Older installations use a text array. Production already has product_key[].
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS allowed_products text[] NOT NULL DEFAULT '{}';

DROP POLICY IF EXISTS care_tours_tenant_all ON public.care_tours;
CREATE POLICY care_tours_tenant_all ON public.care_tours
  FOR ALL TO authenticated
  USING (tenant_id = (SELECT public.current_tenant_id()) AND (SELECT public.current_portal_type()) IS NULL AND public.is_internal_tenant_actor(tenant_id))
  WITH CHECK (tenant_id = (SELECT public.current_tenant_id()) AND (SELECT public.current_portal_type()) IS NULL AND public.is_internal_tenant_actor(tenant_id));

DROP POLICY IF EXISTS care_tour_stops_tenant_all ON public.care_tour_stops;
CREATE POLICY care_tour_stops_tenant_all ON public.care_tour_stops
  FOR ALL TO authenticated
  USING (tenant_id = (SELECT public.current_tenant_id()) AND (SELECT public.current_portal_type()) IS NULL AND public.is_internal_tenant_actor(tenant_id))
  WITH CHECK (
    tenant_id = (SELECT public.current_tenant_id()) AND (SELECT public.current_portal_type()) IS NULL AND public.is_internal_tenant_actor(tenant_id)
    AND EXISTS (SELECT 1 FROM public.care_tours t WHERE t.id = tour_id AND t.tenant_id = care_tour_stops.tenant_id)
  );

-- The private reader returns the published projection. The underlying tables
-- keep their internal-only policies, including notes and maintenance fields.
CREATE SCHEMA IF NOT EXISTS care_security;
GRANT USAGE ON SCHEMA care_security TO authenticated;

CREATE OR REPLACE FUNCTION care_security.employee_portal_care_day(p_day date)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  tenant uuid := public.current_tenant_id();
  employee uuid := public.resolve_current_employee_id();
BEGIN
  IF auth.uid() IS NULL OR public.current_portal_type() IS DISTINCT FROM 'employee'
    OR tenant IS NULL OR employee IS NULL OR public.platform_tenant_access_allowed(tenant, false) IS DISTINCT FROM TRUE
    OR NOT EXISTS (
      SELECT 1 FROM public.employee_portal_accounts a
      WHERE a.id = public.current_portal_account_id() AND a.tenant_id = tenant
        AND a.auth_user_id = auth.uid() AND a.employee_id = employee AND a.status = 'active'
    ) OR NOT EXISTS (
      SELECT 1 FROM public.employees e WHERE e.id = employee AND e.tenant_id = tenant
        AND e.deleted_at IS NULL AND e.status::text IN ('active', 'aktiv')
        AND 'pflege' = ANY(e.allowed_products::text[])
    ) OR NOT coalesce(public.tenant_has_platform_module('care', tenant), EXISTS (
      SELECT 1 FROM public.tenant_products tp
      WHERE tp.tenant_id = tenant
        AND to_jsonb(tp)->>'product_key' = 'pflege'
        AND CASE WHEN to_jsonb(tp) ? 'is_active' THEN (to_jsonb(tp)->>'is_active')::boolean IS TRUE
          AND to_jsonb(tp)->>'billing_status' IS DISTINCT FROM 'admin_disabled'
          ELSE to_jsonb(tp)->>'status' IN ('active', 'trial') END
    )) THEN
    RAISE EXCEPTION 'Persönliche Pflegefreigabe erforderlich.' USING ERRCODE = '42501';
  END IF;
  IF p_day IS NULL THEN RAISE EXCEPTION 'Bitte einen Tag auswählen.' USING ERRCODE = '22023'; END IF;
  RETURN coalesce((
    SELECT jsonb_agg(jsonb_build_object(
      'id', t.id, 'date', t.tour_date, 'name', t.name, 'status', t.status, 'vehicle', t.vehicle_label_snapshot,
      'stops', coalesce((
        SELECT jsonb_agg(jsonb_build_object(
          'id', s.id, 'client', s.client_name_snapshot, 'address', s.address_snapshot,
          'start', s.planned_start, 'end', s.planned_end, 'service', s.service_summary, 'status', s.status
        ) ORDER BY s.sequence_no)
        FROM public.care_tour_stops s WHERE s.tour_id = t.id AND s.tenant_id = tenant
      ), '[]'::jsonb)
    ) ORDER BY t.name, t.id)
    FROM public.care_tours t
    WHERE t.tenant_id = tenant AND t.employee_id = employee AND t.tour_date = p_day
      AND t.status IN ('published', 'in_progress', 'completed')
  ), '[]'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_employee_portal_care_day(p_day date)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = ''
AS $$ SELECT care_security.employee_portal_care_day(p_day) $$;

REVOKE ALL ON FUNCTION care_security.employee_portal_care_day(date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION care_security.employee_portal_care_day(date) TO authenticated;
REVOKE ALL ON FUNCTION public.get_employee_portal_care_day(date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_employee_portal_care_day(date) TO authenticated;

NOTIFY pgrst, 'reload schema';
COMMIT;
