-- ==========================================================================
-- CareSuite+ — Migration 0082: client_contacts Schreibzugriff für Klienten-Bearbeitung
-- persistClientEditData → POST client_contacts 400: Spalten name/is_emergency existieren
-- auf Live nicht (full_name/is_emergency_contact). Zusätzlich RLS nur admin-only —
-- invited Owner mit office.clients.edit brauchen permission-basierte Policy.
-- Pattern: 0060_intake_completion_rls_grants.sql, 0010 client_contacts_write
-- ==========================================================================

DROP POLICY IF EXISTS "client_contacts_write_tenant" ON public.client_contacts;
CREATE POLICY "client_contacts_write_tenant"
  ON public.client_contacts FOR ALL TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND (
      public.has_permission('office.clients.edit')
      OR public.has_permission('office.clients.manage_contacts')
    )
  )
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND (
      public.has_permission('office.clients.edit')
      OR public.has_permission('office.clients.manage_contacts')
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_contacts TO authenticated;
