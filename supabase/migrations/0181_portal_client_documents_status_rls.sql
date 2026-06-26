-- Portal client_documents: allow finalized contracts/consents (abgeschlossen/bestaetigt),
-- not only aktiv. Block internal/restricted sensitivity at RLS layer.

DROP POLICY IF EXISTS client_documents_portal_select ON public.client_documents;
CREATE POLICY client_documents_portal_select ON public.client_documents
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND client_id = public.current_client_id()
    AND public.current_client_id() IS NOT NULL
    AND portal_visible = TRUE
    AND status IN ('aktiv', 'abgeschlossen', 'bestaetigt')
    AND sensitivity NOT IN ('internal', 'restricted')
  );

COMMENT ON POLICY client_documents_portal_select ON public.client_documents IS
  'Portal users read office-released client documents (contracts, consents, uploads; proofs use same table).';
