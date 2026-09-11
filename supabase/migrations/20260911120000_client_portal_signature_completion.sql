-- Complete a client signature, its PDF, portal mirror and workflow in one transaction.
-- Assets are uploaded first while the pending-signature storage permission still applies.
BEGIN;

CREATE OR REPLACE FUNCTION public.client_portal_finalize_assist_proof(
  p_tenant_id uuid, p_proof_id uuid, p_signature_id uuid,
  p_expected_payload_hash text, p_signed_payload_hash text,
  p_pdf_storage_path text, p_pdf_hash text
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_proof public.assist_visit_proofs%ROWTYPE;
  v_signature public.assist_visit_signatures%ROWTYPE;
  v_visit public.assist_visits%ROWTYPE;
  v_snapshot jsonb;
BEGIN
  IF auth.uid() IS NULL OR p_tenant_id IS DISTINCT FROM public.current_tenant_id()
     OR NOT coalesce(public.is_client_portal_rls_context(p_tenant_id), false)
     OR public.current_client_id() IS NULL THEN
    RAISE EXCEPTION 'Keine Berechtigung für diese Unterschrift';
  END IF;
  SELECT * INTO v_proof FROM public.assist_visit_proofs
    WHERE tenant_id = p_tenant_id AND id = p_proof_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Nachweis nicht gefunden'; END IF;
  SELECT * INTO v_visit FROM public.assist_visits
    WHERE tenant_id = p_tenant_id AND id = v_proof.visit_id
      AND client_id = public.current_client_id() AND planning_status <> 'draft' FOR SHARE;
  IF NOT FOUND OR NOT v_proof.portal_visible
     OR v_proof.portal_release_status NOT IN ('pending_client_signature', 'released') THEN
    RAISE EXCEPTION 'Nachweis nicht für Sie freigegeben';
  END IF;
  -- Repeated or concurrent delivery returns the existing receipt without overwriting it.
  IF v_proof.signature_id IS NOT NULL AND v_proof.pdf_storage_path IS NOT NULL
     AND v_proof.portal_release_status = 'released'
     AND v_proof.payload_snapshot->>'signedViaClientPortal' = 'true'
     AND v_proof.payload_snapshot->>'clientPortalPdfSignatureId' = v_proof.signature_id::text
     AND EXISTS (SELECT 1 FROM public.assist_visit_signatures WHERE id = v_proof.signature_id AND tenant_id = p_tenant_id AND is_valid) THEN
    RETURN jsonb_build_object('proofId', v_proof.id, 'signatureId', v_proof.signature_id,
      'signedAt', v_proof.payload_snapshot->>'clientPortalSignedAt', 'proofPersisted', true);
  END IF;
  IF v_visit.canonical_status IN ('cancelled', 'no_show') THEN RAISE EXCEPTION 'Einsatz ist nicht zur Bestätigung freigegeben'; END IF;
  IF v_proof.payload_hash IS DISTINCT FROM p_expected_payload_hash THEN
    RAISE EXCEPTION 'Der Nachweis wurde geändert. Bitte neu laden und prüfen';
  END IF;
  IF v_proof.portal_release_status = 'released' AND
     (v_proof.signature_id IS DISTINCT FROM p_signature_id OR
      v_proof.payload_snapshot->>'signedViaClientPortal' IS DISTINCT FROM 'true') THEN
    RAISE EXCEPTION 'Nachweis ist nicht zur Fertigstellung freigegeben';
  END IF;
  SELECT * INTO v_signature FROM public.assist_visit_signatures
    WHERE tenant_id = p_tenant_id AND id = p_signature_id AND visit_id = v_proof.visit_id
      AND is_valid AND signer_role = 'client'
      AND metadata->>'proofId' = p_proof_id::text
      AND metadata->>'signedVia' = 'client_portal' FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Gültige Unterschrift fehlt'; END IF;
  IF v_signature.metadata->>'proofPayloadHash' IS NOT NULL
     AND v_signature.metadata->>'proofPayloadHash' IS DISTINCT FROM v_proof.payload_hash
     AND v_proof.signature_id IS DISTINCT FROM v_signature.id THEN
    RAISE EXCEPTION 'Unterschrift gehört zu einer früheren Nachweisfassung';
  END IF;
  IF p_pdf_storage_path NOT LIKE ('tenant/' || p_tenant_id || '/assist/visits/' || v_proof.visit_id || '/proofs/' || p_proof_id || '-' || p_signature_id || '-%.pdf')
     OR p_pdf_hash !~ '^[a-f0-9]{64}$' OR p_signed_payload_hash !~ '^[a-f0-9]{64}$'
     OR p_pdf_storage_path IS NULL OR p_pdf_hash IS NULL OR p_signed_payload_hash IS NULL THEN
    RAISE EXCEPTION 'Nachweisdatei ist ungültig';
  END IF;
  PERFORM 1 FROM storage.objects WHERE bucket_id = 'office-documents' AND name = p_pdf_storage_path;
  IF NOT FOUND THEN RAISE EXCEPTION 'Nachweisdatei wurde noch nicht übertragen'; END IF;
  PERFORM 1 FROM storage.objects WHERE bucket_id = 'office-documents' AND name = v_signature.storage_path;
  IF NOT FOUND THEN RAISE EXCEPTION 'Signaturbild fehlt'; END IF;

  v_snapshot := v_proof.payload_snapshot || jsonb_build_object(
    'signatureDeferredToClientPortal', false, 'clientPortalSignedAt', to_char(v_signature.signed_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'signedViaClientPortal', true, 'clientPortalPdfSignatureId', p_signature_id::text, 'signerName', v_signature.signer_name,
    'signedAt', to_char(v_signature.signed_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'signature', jsonb_build_object('signerName', v_signature.signer_name,
      'signedAt', to_char(v_signature.signed_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'), 'signerRole', 'client'));

  INSERT INTO public.client_documents (id, tenant_id, client_id, title, file_name, mime_type,
    category, storage_path, portal_visible, status, sensitivity, source, signed_at, signature_required, updated_at)
  VALUES (p_proof_id, p_tenant_id, v_visit.client_id,
    coalesce(nullif(v_snapshot->>'title', ''), nullif(v_snapshot->>'serviceName', ''), 'Leistungsnachweis'),
    'Leistungsnachweis-' || coalesce(v_proof.proof_number, p_proof_id::text) || '.pdf', 'application/pdf',
    'leistungsnachweis', p_pdf_storage_path, true, 'aktiv', 'care', 'assist_visit_proof', v_signature.signed_at, false, now())
  ON CONFLICT (id) DO UPDATE SET title = excluded.title, file_name = excluded.file_name,
    mime_type = excluded.mime_type, category = excluded.category, storage_path = excluded.storage_path,
    portal_visible = true, status = 'aktiv', signed_at = excluded.signed_at,
    signature_required = false, updated_at = now()
  WHERE client_documents.tenant_id = excluded.tenant_id AND client_documents.client_id = excluded.client_id
    AND client_documents.source = 'assist_visit_proof';
  IF NOT FOUND THEN RAISE EXCEPTION 'Portal-Dokument ist nicht eindeutig zugeordnet'; END IF;

  UPDATE public.assist_visit_proofs SET signature_id = p_signature_id, payload_snapshot = v_snapshot,
    payload_hash = p_signed_payload_hash, pdf_storage_path = p_pdf_storage_path, pdf_hash = p_pdf_hash,
    portal_release_status = 'released', status = 'pending_review', updated_at = now()
  WHERE id = p_proof_id AND tenant_id = p_tenant_id;

  INSERT INTO public.assist_visit_execution_state
    (tenant_id, visit_id, current_step, assignment_status, signature_complete, proof_generated, finalized_at, updated_at)
  VALUES (p_tenant_id, v_visit.id, 'completed', 'abgeschlossen', true, true, v_signature.signed_at, now())
  ON CONFLICT (tenant_id, visit_id) DO UPDATE SET
    current_step = 'completed', assignment_status = 'abgeschlossen', signature_complete = true,
    proof_generated = true, finalized_at = excluded.finalized_at, updated_at = now();

  INSERT INTO public.audit_logs (tenant_id, action, entity_type, entity_id, table_name, metadata)
    VALUES (p_tenant_id, 'client_portal_proof_signed', 'assist_visit_proof', p_proof_id, 'assist_visit_proofs',
      jsonb_build_object('signature_id', p_signature_id, 'signed_at', v_signature.signed_at, 'actor_user_id', auth.uid()));

  RETURN jsonb_build_object('proofId', p_proof_id, 'signatureId', p_signature_id,
    'signedAt', v_snapshot->>'clientPortalSignedAt', 'proofPersisted', true);
END;
$$;
REVOKE ALL ON FUNCTION public.client_portal_finalize_assist_proof(uuid, uuid, uuid, text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.client_portal_finalize_assist_proof(uuid, uuid, uuid, text, text, text, text) TO authenticated;

-- A captured signature must remain readable for retry and for the signed preview.
CREATE OR REPLACE FUNCTION public.client_portal_can_read_assist_signature(p_path text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT auth.uid() IS NOT NULL
    AND coalesce(public.is_client_portal_rls_context(public.current_tenant_id()), false)
    AND EXISTS (SELECT 1 FROM public.assist_visit_signatures s
      JOIN public.assist_visits v ON v.id = s.visit_id AND v.tenant_id = s.tenant_id
      JOIN public.assist_visit_proofs p ON p.visit_id = v.id AND p.tenant_id = v.tenant_id
      WHERE s.tenant_id = public.current_tenant_id() AND v.client_id = public.current_client_id()
        AND s.storage_path = p_path AND s.is_valid AND p.portal_visible
        AND p.portal_release_status IN ('pending_client_signature', 'released')
        AND (p.signature_id = s.id OR s.metadata->>'proofId' = p.id::text));
$$;
REVOKE ALL ON FUNCTION public.client_portal_can_read_assist_signature(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.client_portal_can_read_assist_signature(text) TO authenticated;
DROP POLICY IF EXISTS assist_signature_client_read ON storage.objects;
CREATE POLICY assist_signature_client_read ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'office-documents' AND public.client_portal_can_read_assist_signature(name));

-- Resume historical client-signed proofs whose old post-signature PDF upload failed.
CREATE OR REPLACE FUNCTION public.client_portal_can_upload_proof_recovery(p_path text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT auth.uid() IS NOT NULL
    AND coalesce(public.is_client_portal_rls_context(public.current_tenant_id()), false)
    AND EXISTS (SELECT 1 FROM public.assist_visit_proofs p
      JOIN public.assist_visits v ON v.id = p.visit_id AND v.tenant_id = p.tenant_id
      JOIN public.assist_visit_signatures s ON s.id = p.signature_id AND s.tenant_id = p.tenant_id AND s.is_valid
      WHERE p.tenant_id = public.current_tenant_id() AND v.client_id = public.current_client_id()
        AND p.portal_visible AND p.portal_release_status = 'released'
        AND (p.pdf_storage_path IS NULL OR p.payload_snapshot->>'clientPortalPdfSignatureId' IS DISTINCT FROM p.signature_id::text)
        AND p.payload_snapshot->>'signedViaClientPortal' = 'true'
        AND p_path LIKE ('tenant/' || p.tenant_id || '/assist/visits/' || p.visit_id || '/proofs/' || p.id || '-' || s.id || '-%.pdf'));
$$;
REVOKE ALL ON FUNCTION public.client_portal_can_upload_proof_recovery(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.client_portal_can_upload_proof_recovery(text) TO authenticated;
DROP POLICY IF EXISTS assist_proof_client_recovery_insert ON storage.objects;
CREATE POLICY assist_proof_client_recovery_insert ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'office-documents' AND public.client_portal_can_upload_proof_recovery(name));

-- Template signatures and the rendered signed document must commit together as well.
CREATE OR REPLACE FUNCTION public.client_portal_sign_document_request(
  p_tenant_id uuid, p_request_id uuid, p_signer_role text, p_signer_name text,
  p_signature_data_url text, p_expected_updated_at timestamptz
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_request public.cs_document_requests%ROWTYPE;
  v_signed_at timestamptz := now();
  v_html text;
  v_image text;
  v_anchor text;
  v_pattern text;
  v_all_done boolean;
BEGIN
  IF auth.uid() IS NULL OR p_tenant_id IS DISTINCT FROM public.current_tenant_id()
     OR NOT coalesce(public.is_client_portal_rls_context(p_tenant_id), false)
     OR public.current_client_id() IS NULL OR p_signer_role NOT IN ('client', 'representative')
     OR p_signer_role IS NULL THEN RAISE EXCEPTION 'Keine Berechtigung für diese Unterschrift'; END IF;
  SELECT * INTO v_request FROM public.cs_document_requests
    WHERE id = p_request_id AND owner_tenant_id = p_tenant_id
      AND client_id = public.current_client_id() AND portal_visible
      AND recipient_scope IN ('client', 'both') FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Dokument nicht für Sie freigegeben'; END IF;
  IF EXISTS (SELECT 1 FROM public.cs_document_request_signatures
      WHERE request_id = p_request_id AND signer_role = p_signer_role AND status = 'signed')
     AND NOT EXISTS (SELECT 1 FROM public.cs_document_request_signatures
      WHERE request_id = p_request_id AND signer_role = p_signer_role AND status = 'pending') THEN
    RETURN p_request_id;
  END IF;
  IF v_request.status NOT IN ('sent', 'opened', 'partially_signed')
     OR v_request.updated_at IS DISTINCT FROM p_expected_updated_at THEN
    RAISE EXCEPTION 'Dokument wurde geändert. Bitte neu laden und prüfen';
  END IF;
  IF nullif(trim(p_signer_name), '') IS NULL OR length(p_signer_name) > 300
     OR p_signature_data_url IS NULL OR length(p_signature_data_url) > 3000000
     OR p_signature_data_url !~ '^data:image/png;base64,[A-Za-z0-9+/]+={0,2}$'
     OR nullif(trim(v_request.rendered_html), '') IS NULL THEN
    RAISE EXCEPTION 'Signatur oder Dokumentvorschau ist unvollständig';
  END IF;
  UPDATE public.cs_document_request_signatures SET status = 'signed', signer_name = trim(p_signer_name),
    signature_data_url = p_signature_data_url, signed_at = v_signed_at, updated_at = v_signed_at
    WHERE request_id = p_request_id AND signer_role = p_signer_role AND status = 'pending';
  IF NOT FOUND THEN RAISE EXCEPTION 'Keine offene Unterschrift für diese Rolle'; END IF;
  -- Derive the HTML from the locked original. The portal cannot replace document text.
  v_anchor := p_signer_role || '_signature';
  v_image := '<img src="' || p_signature_data_url || '" alt="Unterschrift" style="max-height:80px;max-width:240px;" /><br/><small>'
    || replace(replace(replace(trim(p_signer_name), '&', '&amp;'), '<', '&lt;'), '>', '&gt;')
    || ' · ' || to_char(v_signed_at AT TIME ZONE 'Europe/Berlin', 'DD.MM.YYYY HH24:MI:SS') || '</small>';
  v_pattern := '(<span[^>]*data-signature-anchor="' || v_anchor || '"[^>]*>)(\[SIGNATURE:[^]]+\])(</span>)';
  IF v_request.rendered_html ~* v_pattern THEN
    v_html := regexp_replace(v_request.rendered_html, v_pattern, '\1' || replace(v_image, E'\\', E'\\\\') || '\3', 'i');
  ELSE
    v_html := v_request.rendered_html || '<p data-signature-anchor="' || v_anchor || '">' || v_image || '</p>';
  END IF;
  SELECT NOT EXISTS (SELECT 1 FROM public.cs_document_request_signatures
    WHERE request_id = p_request_id AND status NOT IN ('signed', 'not_required')) INTO v_all_done;
  UPDATE public.cs_document_requests SET status = CASE WHEN v_all_done THEN 'completed' ELSE 'partially_signed' END,
    rendered_html = v_html, completed_at = CASE WHEN v_all_done THEN v_signed_at ELSE NULL END, updated_at = v_signed_at
    WHERE id = p_request_id AND owner_tenant_id = p_tenant_id;
  INSERT INTO public.audit_logs (tenant_id, action, entity_type, entity_id, table_name, metadata)
    VALUES (p_tenant_id, 'document_request_signed', 'cs_document_request', p_request_id, 'cs_document_requests',
      jsonb_build_object('signer_role', p_signer_role, 'signed_at', v_signed_at, 'actor_user_id', auth.uid()));
  RETURN p_request_id;
END;
$$;
REVOKE ALL ON FUNCTION public.client_portal_sign_document_request(uuid, uuid, text, text, text, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.client_portal_sign_document_request(uuid, uuid, text, text, text, timestamptz) TO authenticated;

NOTIFY pgrst, 'reload schema';
COMMIT;
