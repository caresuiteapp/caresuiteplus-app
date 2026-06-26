-- Portal: read finalized intake document HTML for own client (linked from client_documents).

DROP POLICY IF EXISTS client_intake_documents_portal_self_select ON public.client_intake_documents;
CREATE POLICY client_intake_documents_portal_self_select ON public.client_intake_documents
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND client_id = public.current_client_id()
    AND public.current_client_id() IS NOT NULL
    AND status IN ('abgeschlossen', 'bestaetigt', 'freigegeben')
  );

COMMENT ON POLICY client_intake_documents_portal_self_select ON public.client_intake_documents IS
  'Portal users read finalized intake HTML for documents released via client_documents.portal_visible.';
