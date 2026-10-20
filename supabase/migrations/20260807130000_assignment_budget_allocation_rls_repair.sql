-- CareSuite HealthOS — automatische Budgetzuordnung beim Anlegen eines Einsatzes.
--
-- Migration 0178 vergab assist.assignment.budget.auto_allocate an die operativen
-- Rollen, verlangte beim INSERT aber ausschließlich assist.assignments.manage.
-- Dadurch wurde die bereits autorisierte Einsatzanlage an der nachgelagerten
-- Budgetzuordnung per RLS abgewiesen. R12 machte diesen zuvor verschluckten
-- Fehler sichtbar und rollte den halbfertigen Einsatz folgerichtig zurück.

BEGIN;

DROP POLICY IF EXISTS assignment_budget_allocations_tenant
  ON public.assignment_budget_allocations;

CREATE POLICY assignment_budget_allocations_tenant
  ON public.assignment_budget_allocations
  FOR ALL
  TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND (
      public.has_permission('assist.assignment.budget.view')
      OR public.has_permission('assist.assignment.budget.auto_allocate')
      OR public.has_permission('assist.assignments.manage')
      OR public.has_permission('clients.budgets.view')
      OR public.has_permission('office.clients.view')
    )
  )
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND (
      public.has_permission('assist.assignment.budget.auto_allocate')
      OR public.has_permission('assist.assignments.manage')
      OR public.has_permission('clients.budgets.edit')
      OR public.has_permission('clients.billing_profile.edit')
      OR public.has_permission('office.clients.edit')
    )
  );

-- Bestandsrollen erhalten die für den automatischen Schreibpfad vorgesehene
-- Berechtigung idempotent. Mandantenindividuelle Rollen bleiben unverändert.
INSERT INTO public.role_permissions (role_id, permission_key)
SELECT role.id, 'assist.assignment.budget.auto_allocate'
FROM public.roles role
WHERE role.key IN ('business_admin', 'business_manager', 'billing', 'dispatch', 'nurse')
ON CONFLICT DO NOTHING;

COMMIT;

COMMENT ON POLICY assignment_budget_allocations_tenant
  ON public.assignment_budget_allocations IS
  'Mandantengebundene Budgetzuordnung; automatische Zuweisung nutzt die dafür vorgesehene RBAC-Berechtigung.';
