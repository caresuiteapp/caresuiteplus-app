-- ==========================================================================
-- CareSuite+ — Migration 0244: Client portal SELECT on released assist visit proofs
-- Required for Nachweise list, document detail preview, and deferred signature flow.
-- ==========================================================================

DROP POLICY IF EXISTS assist_visit_proofs_portal_client_select ON public.assist_visit_proofs;
CREATE POLICY assist_visit_proofs_portal_client_select ON public.assist_visit_proofs
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND public.is_client_portal_rls_context(tenant_id)
    AND portal_visible = TRUE
    AND portal_release_status IN ('released', 'pending_client_signature')
    AND visit_id IN (
      SELECT v.id
      FROM public.assist_visits v
      WHERE v.tenant_id = public.current_tenant_id()
        AND v.client_id = public.current_client_id()
        AND public.current_client_id() IS NOT NULL
        AND v.planning_status <> 'draft'
    )
  );

COMMENT ON POLICY assist_visit_proofs_portal_client_select ON public.assist_visit_proofs IS
  'Client portal reads portal-visible assist visit proofs (incl. pending_client_signature).';
