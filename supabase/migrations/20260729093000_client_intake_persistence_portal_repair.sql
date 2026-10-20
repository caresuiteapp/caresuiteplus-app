-- Client intake production repair:
-- 1) Recover intakes left as lead after derived budget/module sync failures.
-- 2) Promote client-signed intake documents into the canonical client_documents list.
-- 3) Align client portal RLS with the actual intake status vocabulary.

-- A completed extended-data write creates this deterministic intake event before
-- derived budget synchronization. These records are safe to activate.
UPDATE public.clients AS c
SET
  status = 'active',
  updated_at = NOW()
WHERE c.status = 'lead'
  AND NULLIF(BTRIM(c.first_name), '') IS NOT NULL
  AND NULLIF(BTRIM(c.last_name), '') IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM public.client_timeline_events AS e
    WHERE e.tenant_id = c.tenant_id
      AND e.client_id = c.id
      AND COALESCE(e.metadata ->> 'source', '') = 'intake'
  );

-- Link an older canonical row with the deterministic intake HTML filename.
UPDATE public.client_documents AS cd
SET
  intake_document_id = cid.id,
  source = 'intake',
  mime_type = 'text/html',
  title = cid.title,
  status = CASE WHEN cid.status = 'finalized' THEN 'abgeschlossen' ELSE 'bestaetigt' END,
  portal_visible = TRUE,
  updated_at = NOW()
FROM public.client_intake_documents AS cid
WHERE cd.tenant_id = cid.tenant_id
  AND cd.client_id = cid.client_id
  AND cd.file_name = cid.template_key || '.html'
  AND (
    cid.status IN ('finalized', 'signed')
    OR (
      cid.status = 'pending_signature'
      AND EXISTS (
        SELECT 1
        FROM public.client_document_signatures AS sig
        WHERE sig.tenant_id = cid.tenant_id
          AND sig.client_id = cid.client_id
          AND sig.document_id = cid.id
          AND sig.signer_role = 'client'
      )
    )
  );

-- Insert canonical rows for client-signed intake documents that were never promoted.
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
  cid.tenant_id,
  cid.client_id,
  cid.title,
  cid.template_key || '.html',
  'text/html',
  CASE
    WHEN cid.document_type IN ('privacy_consent', 'additional_consent') THEN 'einwilligung'
    WHEN cid.document_type IN ('client_contract', 'assignment_declaration') THEN 'vertrag'
    ELSE 'sonstige'
  END,
  CASE WHEN cid.status = 'finalized' THEN 'abgeschlossen' ELSE 'bestaetigt' END,
  'care',
  'intake',
  cid.id,
  TRUE,
  cid.updated_by
FROM public.client_intake_documents AS cid
WHERE (
    cid.status IN ('finalized', 'signed')
    OR (
      cid.status = 'pending_signature'
      AND EXISTS (
        SELECT 1
        FROM public.client_document_signatures AS sig
        WHERE sig.tenant_id = cid.tenant_id
          AND sig.client_id = cid.client_id
          AND sig.document_id = cid.id
          AND sig.signer_role = 'client'
      )
    )
  )
  AND COALESCE(cid.finalized_html, cid.preview_html) IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.client_documents AS existing
    WHERE existing.tenant_id = cid.tenant_id
      AND existing.client_id = cid.client_id
      AND (
        existing.intake_document_id = cid.id
        OR existing.file_name = cid.template_key || '.html'
      )
  );

DROP POLICY IF EXISTS client_intake_documents_portal_self_select
  ON public.client_intake_documents;
CREATE POLICY client_intake_documents_portal_self_select
  ON public.client_intake_documents
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND client_id = public.current_client_id()
    AND public.current_client_id() IS NOT NULL
    AND status IN ('finalized', 'signed', 'pending_signature')
    AND EXISTS (
      SELECT 1
      FROM public.client_documents AS cd
      WHERE cd.tenant_id = client_intake_documents.tenant_id
        AND cd.client_id = client_intake_documents.client_id
        AND cd.intake_document_id = client_intake_documents.id
        AND cd.portal_visible = TRUE
        AND cd.status IN ('aktiv', 'abgeschlossen', 'bestaetigt')
        AND cd.sensitivity NOT IN ('internal', 'restricted')
    )
  );

COMMENT ON POLICY client_intake_documents_portal_self_select
  ON public.client_intake_documents IS
  'Client portal reads finalized or client-signed intake HTML only through a released client_documents row.';

GRANT SELECT ON public.client_intake_documents TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.client_documents TO authenticated;
