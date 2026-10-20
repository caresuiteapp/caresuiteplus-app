-- Intake completion (Step 11): clients INSERT blocked by admin-only RLS
-- Remote had only clients_admin_manage_own_tenant (is_tenant_admin()), which
-- requires profile.status = 'active'. Invited owners (e.g. Helferhasen+) fail with 42501.
-- Pattern: 0003_office_clients.sql permission policies + 0057/0058 GRANT idempotency.

-- --------------------------------------------------------------------------
-- clients: permission-based write (coexists with admin policy — OR semantics)
-- --------------------------------------------------------------------------
DROP POLICY IF EXISTS "clients_insert_tenant" ON public.clients;
CREATE POLICY "clients_insert_tenant"
  ON public.clients FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND public.has_permission('office.clients.create')
  );

DROP POLICY IF EXISTS "clients_update_tenant" ON public.clients;
CREATE POLICY "clients_update_tenant"
  ON public.clients FOR UPDATE TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND public.has_permission('office.clients.edit')
  )
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND public.has_permission('office.clients.edit')
  );

-- --------------------------------------------------------------------------
-- Table grants (idempotent — policies alone are insufficient per 0057 lesson)
-- --------------------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE ON public.clients TO authenticated;

GRANT SELECT ON public.intake_document_system_templates TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.tenant_document_templates TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.client_intake_documents TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.client_document_signatures TO authenticated;
GRANT SELECT, INSERT ON public.client_document_events TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.client_contract_selection TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.client_consent_status TO authenticated;

GRANT SELECT, INSERT, UPDATE ON public.tenant_cost_carrier_overrides TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.client_cost_carrier_assignments TO authenticated;
GRANT SELECT, INSERT ON public.cost_carrier_audit_events TO authenticated;
