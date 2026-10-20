-- CareSuite HealthOS — vollständige RLS-Kette für die automatische
-- Budgetreservierung beim Anlegen eines Einsatzes.
--
-- R14 autorisierte assignment_budget_allocations, der unmittelbar folgende
-- Reservierungspfad benötigt aber zusätzlich Lesezugriff auf Budgetkonto und
-- Prioritätsregeln sowie Schreibzugriff auf Konto und Transaktion. Ohne diese
-- Ergänzung wurde ein korrekt angelegter Einsatz nachträglich mit dem
-- irreführenden Fehler "Mandantentrennung" zurückgerollt.

BEGIN;

DROP POLICY IF EXISTS client_budget_accounts_select_tenant
  ON public.client_budget_accounts;
CREATE POLICY client_budget_accounts_select_tenant
  ON public.client_budget_accounts
  FOR SELECT
  TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND (
      public.has_permission('assist.assignment.budget.auto_allocate')
      OR public.has_permission('clients.billing_profile.view')
      OR public.has_permission('office.clients.view')
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
    AND (
      public.has_permission('assist.assignment.budget.auto_allocate')
      OR public.has_permission('clients.billing_profile.edit')
      OR public.has_permission('clients.budgets.edit')
      OR public.has_permission('office.clients.edit')
    )
  )
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND (
      public.has_permission('assist.assignment.budget.auto_allocate')
      OR public.has_permission('clients.billing_profile.edit')
      OR public.has_permission('clients.budgets.edit')
      OR public.has_permission('office.clients.edit')
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
    AND (
      public.has_permission('assist.assignment.budget.auto_allocate')
      OR public.has_permission('clients.billing_profile.view')
      OR public.has_permission('office.clients.view')
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
    AND (
      public.has_permission('assist.assignment.budget.auto_allocate')
      OR public.has_permission('clients.billing_profile.view')
      OR public.has_permission('office.clients.view')
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
    AND (
      public.has_permission('assist.assignment.budget.auto_allocate')
      OR public.has_permission('clients.billing_profile.edit')
      OR public.has_permission('clients.budgets.edit')
      OR public.has_permission('office.clients.edit')
    )
  )
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND (
      public.has_permission('assist.assignment.budget.auto_allocate')
      OR public.has_permission('clients.billing_profile.edit')
      OR public.has_permission('clients.budgets.edit')
      OR public.has_permission('office.clients.edit')
    )
  );

COMMIT;

COMMENT ON POLICY client_budget_accounts_write_tenant
  ON public.client_budget_accounts IS
  'Mandantengebundene Budgetkonten; automatische Einsatzplanung darf ausschließlich die autorisierte Budgetreservierung persistieren.';

COMMENT ON POLICY client_budget_transactions_write_tenant
  ON public.client_budget_transactions IS
  'Mandantengebundener Budgetverlauf inklusive autorisierter automatischer Einsatzreservierung.';
