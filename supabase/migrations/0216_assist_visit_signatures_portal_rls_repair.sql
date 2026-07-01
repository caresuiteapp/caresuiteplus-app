-- Portal signature read/write: align with dual-role portal RLS (0208/0209 pattern).
-- Root cause: assist_visit_signatures still required current_role_key() = 'employee_portal',
-- blocking SELECT for dual-role portal actors while INSERT could succeed via is_tenant_member.

DROP POLICY IF EXISTS assist_visit_signatures_portal_employee_insert ON public.assist_visit_signatures;
CREATE POLICY assist_visit_signatures_portal_employee_insert ON public.assist_visit_signatures
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND public.is_employee_portal_rls_context(tenant_id)
    AND visit_id IN (SELECT public.portal_employee_assigned_visit_ids(tenant_id))
  );

DROP POLICY IF EXISTS assist_visit_signatures_portal_employee_select ON public.assist_visit_signatures;
CREATE POLICY assist_visit_signatures_portal_employee_select ON public.assist_visit_signatures
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND public.is_employee_portal_rls_context(tenant_id)
    AND visit_id IN (SELECT public.portal_employee_assigned_visit_ids(tenant_id))
  );
