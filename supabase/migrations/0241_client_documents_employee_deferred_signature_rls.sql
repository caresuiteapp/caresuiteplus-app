-- ==========================================================================
-- CareSuite+ — Migration 0241: Employee portal deferred signature client_documents RLS
-- Fixes: new row violates row-level security policy for table "client_documents"
-- when employee releases pending_client_signature proof to Klient:innenportal.
-- ==========================================================================

-- client_documents — employee portal INSERT deferred signature portal entry
DROP POLICY IF EXISTS client_documents_portal_employee_deferred_signature_insert ON public.client_documents;
CREATE POLICY client_documents_portal_employee_deferred_signature_insert ON public.client_documents
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND public.is_employee_portal_rls_context(tenant_id)
    AND portal_visible = TRUE
    AND source = 'assist_visit_proof'
    AND signature_required = TRUE
    AND client_id IN (
      SELECT v.client_id
      FROM public.assist_visits v
      WHERE v.tenant_id = tenant_id
        AND v.id IN (SELECT public.portal_employee_assigned_visit_ids(tenant_id))
    )
    AND id IN (
      SELECT avp.id
      FROM public.assist_visit_proofs avp
      WHERE avp.tenant_id = tenant_id
        AND avp.visit_id IN (SELECT public.portal_employee_assigned_visit_ids(tenant_id))
        AND avp.portal_visible = TRUE
        AND avp.portal_release_status = 'pending_client_signature'
    )
  );

-- client_documents — employee portal UPDATE when re-releasing deferred signature entry
DROP POLICY IF EXISTS client_documents_portal_employee_deferred_signature_update ON public.client_documents;
CREATE POLICY client_documents_portal_employee_deferred_signature_update ON public.client_documents
  FOR UPDATE TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND public.is_employee_portal_rls_context(tenant_id)
    AND source = 'assist_visit_proof'
    AND signature_required = TRUE
    AND id IN (
      SELECT avp.id
      FROM public.assist_visit_proofs avp
      WHERE avp.tenant_id = tenant_id
        AND avp.visit_id IN (SELECT public.portal_employee_assigned_visit_ids(tenant_id))
    )
  )
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND public.is_employee_portal_rls_context(tenant_id)
    AND portal_visible = TRUE
    AND source = 'assist_visit_proof'
    AND signature_required = TRUE
    AND client_id IN (
      SELECT v.client_id
      FROM public.assist_visits v
      WHERE v.tenant_id = tenant_id
        AND v.id IN (SELECT public.portal_employee_assigned_visit_ids(tenant_id))
    )
  );

-- assist_visit_proofs — employee portal UPDATE for portal release (deferred signature)
DROP POLICY IF EXISTS assist_visit_proofs_portal_employee_update ON public.assist_visit_proofs;
CREATE POLICY assist_visit_proofs_portal_employee_update ON public.assist_visit_proofs
  FOR UPDATE TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND public.is_employee_portal_rls_context(tenant_id)
    AND visit_id IN (SELECT public.portal_employee_assigned_visit_ids(tenant_id))
  )
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND public.is_employee_portal_rls_context(tenant_id)
    AND visit_id IN (SELECT public.portal_employee_assigned_visit_ids(tenant_id))
  );

COMMENT ON POLICY client_documents_portal_employee_deferred_signature_insert ON public.client_documents IS
  'Employee portal — create portal-visible assist proof signature request for assigned client.';

COMMENT ON POLICY client_documents_portal_employee_deferred_signature_update ON public.client_documents IS
  'Employee portal — refresh deferred signature client_documents row for assigned assist proof.';

COMMENT ON POLICY assist_visit_proofs_portal_employee_update ON public.assist_visit_proofs IS
  'Employee portal — update assigned visit proofs (portal release / deferred signature).';
