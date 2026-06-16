-- Office Dokumente: client_documents metadata + office.documents RLS

ALTER TABLE public.client_documents
  ADD COLUMN IF NOT EXISTS size_bytes BIGINT,
  ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'upload',
  ADD COLUMN IF NOT EXISTS module_visibility TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS portal_visible BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.client_documents
  ADD COLUMN IF NOT EXISTS intake_document_id UUID REFERENCES public.client_intake_documents(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_client_documents_intake
  ON public.client_documents (tenant_id, client_id, intake_document_id)
  WHERE intake_document_id IS NOT NULL;

-- Office sidebar list uses office.documents.view (not only office.clients.view)
DROP POLICY IF EXISTS client_documents_select_office ON public.client_documents;
CREATE POLICY client_documents_select_office ON public.client_documents
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND public.has_permission('office.documents.view')
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_documents TO authenticated;
