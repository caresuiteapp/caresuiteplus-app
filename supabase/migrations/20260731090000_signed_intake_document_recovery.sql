-- Recover already signed intake documents after an interrupted client intake.
-- This migration is deliberately idempotent and never asks a client to sign again.

-- The document foreign key is the authoritative relationship. Older interrupted
-- writes could leave tenant_id/client_id on the signature row out of sync.
UPDATE public.client_document_signatures AS sig
SET
  tenant_id = doc.tenant_id,
  client_id = doc.client_id
FROM public.client_intake_documents AS doc
WHERE sig.document_id = doc.id
  AND (
    sig.tenant_id IS DISTINCT FROM doc.tenant_id
    OR sig.client_id IS DISTINCT FROM doc.client_id
  );

-- A stored client signature is authoritative even if the preceding status write
-- was interrupted. Preserve the signed HTML and recover the workflow status.
UPDATE public.client_intake_documents AS doc
SET
  status = CASE
    WHEN doc.finalized_html IS NOT NULL THEN 'finalized'
    ELSE 'signed'
  END,
  updated_at = NOW()
WHERE doc.status IN ('not_started', 'preview_open', 'pending_signature')
  AND COALESCE(doc.finalized_html, doc.preview_html) IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM public.client_document_signatures AS sig
    WHERE sig.document_id = doc.id
      AND sig.signer_role = 'client'
      AND NULLIF(BTRIM(sig.signature_data), '') IS NOT NULL
  );

-- Repair an existing canonical document row first.
UPDATE public.client_documents AS canonical
SET
  tenant_id = doc.tenant_id,
  client_id = doc.client_id,
  intake_document_id = doc.id,
  title = doc.title,
  file_name = doc.template_key || '.html',
  mime_type = 'text/html',
  category = CASE
    WHEN doc.document_type IN ('privacy_consent', 'additional_consent') THEN 'einwilligung'
    WHEN doc.document_type IN ('client_contract', 'assignment_declaration') THEN 'vertrag'
    ELSE 'sonstige'
  END,
  status = CASE WHEN doc.status = 'finalized' THEN 'abgeschlossen' ELSE 'bestaetigt' END,
  sensitivity = 'care',
  source = 'intake',
  portal_visible = TRUE,
  updated_at = NOW()
FROM public.client_intake_documents AS doc
WHERE (
    canonical.intake_document_id = doc.id
    OR (
      canonical.tenant_id = doc.tenant_id
      AND canonical.client_id = doc.client_id
      AND canonical.file_name = doc.template_key || '.html'
    )
  )
  AND COALESCE(doc.finalized_html, doc.preview_html) IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM public.client_document_signatures AS sig
    WHERE sig.document_id = doc.id
      AND sig.signer_role = 'client'
      AND NULLIF(BTRIM(sig.signature_data), '') IS NOT NULL
  );

-- Insert canonical client-record rows that were never created after signing.
INSERT INTO public.client_documents (
  tenant_id,
  client_id,
  title,
  file_name,
  mime_type,
  category,
  status,
  sensitivity,
  source,
  intake_document_id,
  portal_visible,
  uploaded_by
)
SELECT
  doc.tenant_id,
  doc.client_id,
  doc.title,
  doc.template_key || '.html',
  'text/html',
  CASE
    WHEN doc.document_type IN ('privacy_consent', 'additional_consent') THEN 'einwilligung'
    WHEN doc.document_type IN ('client_contract', 'assignment_declaration') THEN 'vertrag'
    ELSE 'sonstige'
  END,
  CASE WHEN doc.status = 'finalized' THEN 'abgeschlossen' ELSE 'bestaetigt' END,
  'care',
  'intake',
  doc.id,
  TRUE,
  doc.updated_by
FROM public.client_intake_documents AS doc
WHERE COALESCE(doc.finalized_html, doc.preview_html) IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM public.client_document_signatures AS sig
    WHERE sig.document_id = doc.id
      AND sig.signer_role = 'client'
      AND NULLIF(BTRIM(sig.signature_data), '') IS NOT NULL
  )
  AND NOT EXISTS (
    SELECT 1
    FROM public.client_documents AS canonical
    WHERE canonical.intake_document_id = doc.id
      OR (
        canonical.tenant_id = doc.tenant_id
        AND canonical.client_id = doc.client_id
        AND canonical.file_name = doc.template_key || '.html'
      )
  );

-- Activate only complete draft intakes: at least one client signature exists and
-- no required intake document is left unsigned. Partial drafts remain drafts.
UPDATE public.clients AS client
SET
  status = 'active',
  updated_at = NOW()
WHERE client.status = 'lead'
  AND EXISTS (
    SELECT 1
    FROM public.client_intake_documents AS doc
    JOIN public.client_document_signatures AS sig
      ON sig.document_id = doc.id
     AND sig.signer_role = 'client'
    WHERE doc.tenant_id = client.tenant_id
      AND doc.client_id = client.id
      AND NULLIF(BTRIM(sig.signature_data), '') IS NOT NULL
  )
  AND NOT EXISTS (
    SELECT 1
    FROM public.client_intake_documents AS required_doc
    WHERE required_doc.tenant_id = client.tenant_id
      AND required_doc.client_id = client.id
      AND required_doc.is_required = TRUE
      AND required_doc.status NOT IN ('finalized', 'signed')
  );
