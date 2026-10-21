-- Restrict only the new internal intake source, including direct table access.
-- Existing permissive calendar policies continue to govern all other sources.
BEGIN;
CREATE POLICY calendar_intake_read ON public.calendar_events AS RESTRICTIVE
 FOR SELECT TO authenticated USING (
  source_type <> 'intake_appointment' OR (
   tenant_id = public.current_tenant_id()
   AND coalesce(public.is_internal_tenant_actor(tenant_id),false)
   AND (coalesce(public.has_permission('office.appointments.view'),false)
    OR coalesce(public.has_permission('office.appointments.edit'),false))
  )
 );
CREATE POLICY calendar_intake_insert ON public.calendar_events AS RESTRICTIVE
 FOR INSERT TO authenticated WITH CHECK (
  source_type <> 'intake_appointment' OR (
   tenant_id = public.current_tenant_id()
   AND coalesce(public.is_internal_tenant_actor(tenant_id),false)
   AND coalesce(public.has_permission('office.appointments.edit'),false)
  )
 );
CREATE POLICY calendar_intake_update ON public.calendar_events AS RESTRICTIVE
 FOR UPDATE TO authenticated USING (
  source_type <> 'intake_appointment' OR (
   tenant_id = public.current_tenant_id()
   AND coalesce(public.is_internal_tenant_actor(tenant_id),false)
   AND coalesce(public.has_permission('office.appointments.edit'),false)
  )
 ) WITH CHECK (
  source_type <> 'intake_appointment' OR (
   tenant_id = public.current_tenant_id()
   AND coalesce(public.is_internal_tenant_actor(tenant_id),false)
   AND coalesce(public.has_permission('office.appointments.edit'),false)
  )
 );
CREATE POLICY calendar_intake_delete ON public.calendar_events AS RESTRICTIVE
 FOR DELETE TO authenticated USING (
  source_type <> 'intake_appointment' OR (
   tenant_id = public.current_tenant_id()
   AND coalesce(public.is_internal_tenant_actor(tenant_id),false)
   AND coalesce(public.has_permission('office.appointments.edit'),false)
  )
 );
COMMIT;
