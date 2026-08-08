-- CareSuite HealthOS — finaler RLS-Abschluss für die vollständige Einsatzanlage.
--
-- Die Anlage schreibt nicht nur assist_visits, sondern auch Aufgaben, den
-- Legacy-Portalspiegel, Budgetzuordnungen, Budgetkonten und Budgettransaktionen.
-- Jede Stufe bleibt strikt an current_tenant_id() gebunden. Interne
-- Einsatzplaner mit assist.assignments.manage sowie Tenant-Admins dürfen die
-- vollständige Kette ausführen; Portalrollen bleiben ausgeschlossen.

BEGIN;

INSERT INTO public.role_permissions (role_id, permission_key)
SELECT role.id, 'assist.assignment.budget.auto_allocate'
FROM public.roles role
WHERE role.key IN (
  'owner', 'admin', 'management', 'office', 'planning',
  'business_admin', 'business_manager', 'billing', 'dispatch', 'nurse'
)
ON CONFLICT DO NOTHING;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.assist_visits TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.assist_visit_tasks TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.assignments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.assignment_tasks TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.assignment_budget_allocations TO authenticated;
GRANT SELECT, UPDATE ON public.client_budget_accounts TO authenticated;
GRANT SELECT ON public.client_billing_priority_rules TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.client_budget_transactions TO authenticated;

DROP POLICY IF EXISTS assignment_budget_allocations_tenant
  ON public.assignment_budget_allocations;
CREATE POLICY assignment_budget_allocations_tenant
  ON public.assignment_budget_allocations
  FOR ALL
  TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND public.is_internal_tenant_actor(tenant_id)
    AND (
      public.has_permission('assist.assignment.budget.view')
      OR public.has_permission('assist.assignment.budget.auto_allocate')
      OR public.has_permission('assist.assignments.manage')
      OR public.has_permission('clients.budgets.view')
      OR public.has_permission('office.clients.view')
      OR public.is_tenant_admin()
    )
  )
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND public.is_internal_tenant_actor(tenant_id)
    AND (
      public.has_permission('assist.assignment.budget.auto_allocate')
      OR public.has_permission('assist.assignments.manage')
      OR public.has_permission('clients.budgets.edit')
      OR public.has_permission('clients.billing_profile.edit')
      OR public.has_permission('office.clients.edit')
      OR public.is_tenant_admin()
    )
  );

DROP POLICY IF EXISTS client_budget_accounts_select_tenant
  ON public.client_budget_accounts;
CREATE POLICY client_budget_accounts_select_tenant
  ON public.client_budget_accounts
  FOR SELECT
  TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND public.is_internal_tenant_actor(tenant_id)
    AND (
      public.has_permission('assist.assignment.budget.auto_allocate')
      OR public.has_permission('assist.assignments.manage')
      OR public.has_permission('clients.billing_profile.view')
      OR public.has_permission('office.clients.view')
      OR public.is_tenant_admin()
    )
  );

DROP POLICY IF EXISTS client_budget_accounts_write_tenant
  ON public.client_budget_accounts;
CREATE POLICY client_budget_accounts_write_tenant
  ON public.client_budget_accounts
  FOR ALL
  TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND public.is_internal_tenant_actor(tenant_id)
    AND (
      public.has_permission('assist.assignment.budget.auto_allocate')
      OR public.has_permission('assist.assignments.manage')
      OR public.has_permission('clients.billing_profile.edit')
      OR public.has_permission('clients.budgets.edit')
      OR public.has_permission('office.clients.edit')
      OR public.is_tenant_admin()
    )
  )
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND public.is_internal_tenant_actor(tenant_id)
    AND (
      public.has_permission('assist.assignment.budget.auto_allocate')
      OR public.has_permission('assist.assignments.manage')
      OR public.has_permission('clients.billing_profile.edit')
      OR public.has_permission('clients.budgets.edit')
      OR public.has_permission('office.clients.edit')
      OR public.is_tenant_admin()
    )
  );

DROP POLICY IF EXISTS client_billing_priority_rules_select_tenant
  ON public.client_billing_priority_rules;
CREATE POLICY client_billing_priority_rules_select_tenant
  ON public.client_billing_priority_rules
  FOR SELECT
  TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND public.is_internal_tenant_actor(tenant_id)
    AND (
      public.has_permission('assist.assignment.budget.auto_allocate')
      OR public.has_permission('assist.assignments.manage')
      OR public.has_permission('clients.billing_profile.view')
      OR public.has_permission('office.clients.view')
      OR public.is_tenant_admin()
    )
  );

DROP POLICY IF EXISTS client_budget_transactions_select_tenant
  ON public.client_budget_transactions;
CREATE POLICY client_budget_transactions_select_tenant
  ON public.client_budget_transactions
  FOR SELECT
  TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND public.is_internal_tenant_actor(tenant_id)
    AND (
      public.has_permission('assist.assignment.budget.auto_allocate')
      OR public.has_permission('assist.assignments.manage')
      OR public.has_permission('clients.billing_profile.view')
      OR public.has_permission('office.clients.view')
      OR public.is_tenant_admin()
    )
  );

DROP POLICY IF EXISTS client_budget_transactions_write_tenant
  ON public.client_budget_transactions;
CREATE POLICY client_budget_transactions_write_tenant
  ON public.client_budget_transactions
  FOR ALL
  TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND public.is_internal_tenant_actor(tenant_id)
    AND (
      public.has_permission('assist.assignment.budget.auto_allocate')
      OR public.has_permission('assist.assignments.manage')
      OR public.has_permission('clients.billing_profile.edit')
      OR public.has_permission('clients.budgets.edit')
      OR public.has_permission('office.clients.edit')
      OR public.is_tenant_admin()
    )
  )
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND public.is_internal_tenant_actor(tenant_id)
    AND (
      public.has_permission('assist.assignment.budget.auto_allocate')
      OR public.has_permission('assist.assignments.manage')
      OR public.has_permission('clients.billing_profile.edit')
      OR public.has_permission('clients.budgets.edit')
      OR public.has_permission('office.clients.edit')
      OR public.is_tenant_admin()
    )
  );

DO $$
BEGIN
  -- Produktionsmandanten verwenden je nach Einführungsstand sowohl die
  -- kanonischen Rollen (business_admin/...) als auch die Live-Rollen
  -- (owner/admin/...). Deshalb darf die Verifikation keine einzelne,
  -- möglicherweise nicht vorhandene Legacy-Rolle voraussetzen. Sie prüft
  -- stattdessen lückenlos jede tatsächlich vorhandene Verwaltungsrolle.
  IF EXISTS (
    SELECT 1
    FROM public.roles role
    WHERE role.key IN (
      'owner', 'admin', 'management', 'office', 'planning',
      'business_admin', 'business_manager', 'billing', 'dispatch', 'nurse'
    )
      AND NOT EXISTS (
        SELECT 1
        FROM public.role_permissions permission
        WHERE permission.role_id = role.id
          AND permission.permission_key = 'assist.assignment.budget.auto_allocate'
      )
  ) THEN
    RAISE EXCEPTION 'R19 verification failed: an existing administrative role lacks auto allocation permission';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'client_budget_transactions'
      AND policyname = 'client_budget_transactions_write_tenant'
      AND COALESCE(with_check, '') LIKE '%assist.assignments.manage%'
  ) THEN
    RAISE EXCEPTION 'R19 verification failed: budget transaction write chain incomplete';
  END IF;
END
$$;

COMMIT;

NOTIFY pgrst, 'reload schema';
