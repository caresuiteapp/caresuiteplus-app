-- Portal signature documents: source type + signature field placement metadata

ALTER TABLE public.portal_signature_documents
  ADD COLUMN IF NOT EXISTS signature_fields_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS document_source_type TEXT NOT NULL DEFAULT 'office_write'
    CHECK (document_source_type IN ('template', 'pdf_upload', 'office_write'));

COMMENT ON COLUMN public.portal_signature_documents.signature_fields_json IS
  'Parsed signature field markers: role, fieldId, label, order.';

COMMENT ON COLUMN public.portal_signature_documents.document_source_type IS
  'How the document was created in Office: template, pdf_upload, or office_write.';

COMMENT ON COLUMN public.portal_signature_documents.source_document_id IS
  'Optional link to generated_documents when created from document engine template.';
