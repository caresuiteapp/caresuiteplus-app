-- ==========================================================================
-- CareSuite+ — Migration 0071: Mitarbeitende für Assist-Einsatzplanung lesen
-- Erlaubt SELECT auf employees auch mit assist.assignments.manage
-- ==========================================================================

DROP POLICY IF EXISTS "employees_select_tenant" ON public.employees;
CREATE POLICY "employees_select_tenant"
  ON public.employees FOR SELECT
  USING (
    tenant_id = public.current_tenant_id()
    AND (
      public.has_permission('office.employees.view')
      OR public.has_permission('assist.assignments.manage')
    )
  );
