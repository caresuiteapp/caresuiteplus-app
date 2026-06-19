-- ==========================================================================
-- CareSuite+ — Migration 0104: Portal Leistungsnachweise (service proofs)
-- Portal users can read released client_documents (incl. leistungsnachweis).
-- ==========================================================================

DROP POLICY IF EXISTS client_documents_portal_select ON public.client_documents;
CREATE POLICY client_documents_portal_select ON public.client_documents
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND client_id = public.current_client_id()
    AND public.current_client_id() IS NOT NULL
    AND portal_visible = TRUE
    AND status = 'aktiv'
  );

CREATE INDEX IF NOT EXISTS idx_client_documents_portal_proofs
  ON public.client_documents (tenant_id, client_id, created_at DESC)
  WHERE portal_visible = TRUE AND category = 'leistungsnachweis';

-- Portal users: read own service records when office has not yet mirrored to client_documents
DROP POLICY IF EXISTS service_records_portal_select ON public.service_records;
CREATE POLICY service_records_portal_select ON public.service_records
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND client_id = public.current_client_id()
    AND public.current_client_id() IS NOT NULL
    AND status IN ('signature_required', 'signed', 'approved', 'billable', 'billed')
  );

COMMENT ON POLICY client_documents_portal_select ON public.client_documents IS
  'Portal users read office-released documents (Leistungsnachweise, contracts, etc.).';
