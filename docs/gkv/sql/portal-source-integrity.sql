-- Forward patch to the existing portal actions. Requires the canonical Assist JSON helper.
-- This validates structured evidence. Storage metadata does not establish a PDF byte digest.
CREATE FUNCTION care_security.gkv_portal_snapshot_matches(snapshot jsonb, claimed text)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE SECURITY INVOKER SET search_path=pg_catalog AS $$
BEGIN
  IF jsonb_typeof(snapshot) IS DISTINCT FROM 'object' OR claimed IS NULL
     OR claimed !~ '^(sha256:)?[0-9a-f]{64}$' OR octet_length(snapshot::text)>256000 THEN RETURN false; END IF;
  RETURN regexp_replace(claimed,'^sha256:','') = encode(sha256(convert_to(public.workflow_canonical_json(snapshot),'UTF8')),'hex');
END $$;
REVOKE ALL ON FUNCTION care_security.gkv_portal_snapshot_matches(jsonb,text) FROM PUBLIC,anon,authenticated,service_role;

-- The portal signs this projection of the preview. Compare the recorded signature
-- to the actual preview as well as binding its metadata to the full draft.
CREATE FUNCTION care_security.gkv_portal_signature_matches(snap jsonb, visit uuid, client uuid, signed_hash text)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE SECURITY INVOKER SET search_path=pg_catalog AS $$
DECLARE statuses jsonb; payload jsonb;
BEGIN
  IF jsonb_typeof(snap) IS DISTINCT FROM 'object' OR octet_length(snap::text)>256000
     OR jsonb_typeof(snap->'tasks') IS DISTINCT FROM 'array' OR visit IS NULL OR client IS NULL
     OR nullif(btrim(coalesce(snap->>'plannedStartAt',snap->>'scheduledStart')),'') IS NULL
     OR nullif(btrim(coalesce(snap->>'plannedEndAt',snap->>'scheduledEnd')),'') IS NULL THEN RETURN false; END IF;
  IF EXISTS(SELECT FROM jsonb_array_elements(snap->'tasks') x
    WHERE jsonb_typeof(x->'id') IS DISTINCT FROM 'string' OR jsonb_typeof(x->'status') IS DISTINCT FROM 'string'
       OR nullif(x->>'id','') IS NULL OR nullif(x->>'status','') IS NULL) THEN RETURN false; END IF;
  SELECT coalesce(jsonb_agg(jsonb_build_object('taskId',x->>'id','status',x->>'status') ORDER BY n),'[]'::jsonb)
    INTO statuses FROM jsonb_array_elements(snap->'tasks') WITH ORDINALITY a(x,n);
  payload:=jsonb_build_object('visitId',visit,'clientId',client,'employeeId',nullif(btrim(snap->>'employeeId'),''),
    'plannedStartAt',btrim(coalesce(snap->>'plannedStartAt',snap->>'scheduledStart')),
    'plannedEndAt',btrim(coalesce(snap->>'plannedEndAt',snap->>'scheduledEnd')),
    'taskStatuses',statuses,'documentationNote',coalesce(nullif(btrim(snap->>'documentationNote'),''),nullif(btrim(snap->>'documentation'),'')));
  RETURN care_security.gkv_portal_snapshot_matches(payload,signed_hash);
END $$;
REVOKE ALL ON FUNCTION care_security.gkv_portal_signature_matches(jsonb,uuid,uuid,text) FROM PUBLIC,anon,authenticated,service_role;

-- Bind a deferred signature release to its current employee account. No data migration.
CREATE OR REPLACE FUNCTION public.employee_portal_release_deferred_signature(
  p_tenant_id uuid,
  p_proof_id uuid,
  p_client_id uuid,
  p_title text,
  p_payload_snapshot jsonb,
  p_payload_hash text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
  v_visit_id uuid;
  v_employee_id uuid;
  v_actor_profile_id uuid;
  v_signature_id uuid;
  v_doc_title text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'employee_portal_release_deferred_signature: authentication required';
  END IF;
  IF p_tenant_id IS NULL OR p_proof_id IS NULL OR p_client_id IS NULL
     OR p_payload_snapshot IS NULL OR nullif(trim(coalesce(p_payload_hash, '')), '') IS NULL THEN
    RAISE EXCEPTION 'employee_portal_release_deferred_signature: missing required parameters';
  END IF;
  IF p_tenant_id IS DISTINCT FROM public.current_tenant_id() THEN
    RAISE EXCEPTION 'employee_portal_release_deferred_signature: tenant mismatch';
  END IF;
  IF public.current_portal_type() IS DISTINCT FROM 'employee'
     OR public.is_employee_portal_rls_context(p_tenant_id) IS NOT TRUE THEN
    RAISE EXCEPTION 'employee_portal_release_deferred_signature: employee portal role required';
  END IF;

  -- An unexpired JWT may still contain the employee role after a block.
  -- Hold the matched account until the proof and client document have been written.
  SELECT e.employee_id INTO v_employee_id
  FROM public.employee_portal_accounts e
  WHERE e.id=public.current_portal_account_id() AND e.tenant_id=p_tenant_id
    AND e.auth_user_id=auth.uid() AND e.status='active' AND e.employee_id IS NOT NULL
  FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'employee_portal_release_deferred_signature: active personal portal account required' USING ERRCODE='42501';
  END IF;

  v_actor_profile_id := public.resolve_current_profile_id();
  IF v_actor_profile_id IS NULL THEN
    RAISE EXCEPTION 'employee_portal_release_deferred_signature: profile not resolved';
  END IF;

  SELECT avp.visit_id, avp.signature_id
    INTO v_visit_id, v_signature_id
  FROM public.assist_visit_proofs avp
  WHERE avp.tenant_id = p_tenant_id
    AND avp.id = p_proof_id
  FOR UPDATE;

  IF v_visit_id IS NULL THEN
    RAISE EXCEPTION 'employee_portal_release_deferred_signature: proof not found';
  END IF;
  IF v_signature_id IS NOT NULL THEN
    RAISE EXCEPTION 'employee_portal_release_deferred_signature: proof already signed';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.assist_visits v
    WHERE v.tenant_id = p_tenant_id
      AND v.id = v_visit_id
      AND v.client_id = p_client_id
      AND v.employee_id = v_employee_id
  ) AND NOT EXISTS (
    SELECT 1
    FROM public.assignments a
    JOIN public.assist_visits v
      ON v.tenant_id = a.tenant_id
     AND (v.legacy_assignment_id = a.id OR v.id = a.id)
    WHERE a.tenant_id = p_tenant_id
      AND v.id = v_visit_id
      AND a.client_id = p_client_id
      AND a.employee_id = v_employee_id
  ) THEN
    RAISE EXCEPTION 'employee_portal_release_deferred_signature: visit not assigned to employee';
  END IF;

  -- Recalculate the hash over the wire representation and bind all three identities.
  IF p_payload_snapshot->>'visitId' IS DISTINCT FROM v_visit_id::text
     OR p_payload_snapshot->>'clientId' IS DISTINCT FROM p_client_id::text
     OR p_payload_snapshot->>'employeeId' IS DISTINCT FROM v_employee_id::text
     OR care_security.gkv_portal_snapshot_matches(p_payload_snapshot,p_payload_hash) IS NOT TRUE THEN
    RAISE EXCEPTION 'Nachweisinhalt, Prüfsumme oder Einsatzzuordnung stimmen nicht überein' USING ERRCODE='22023';
  END IF;

  UPDATE public.assist_visit_proofs
  SET payload_snapshot = p_payload_snapshot,
      payload_hash = trim(p_payload_hash),
      signature_id = NULL,
      portal_visible = TRUE,
      portal_release_status = 'pending_client_signature',
      released_to_portal_at = now(),
      updated_by = v_actor_profile_id,
      updated_at = now()
  WHERE tenant_id = p_tenant_id
    AND id = p_proof_id
    AND signature_id IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'employee_portal_release_deferred_signature: proof update failed';
  END IF;

  v_doc_title := coalesce(nullif(trim(p_title), ''), 'Leistungsnachweis') ||
    ' — Unterschrift ausstehend';

  INSERT INTO public.client_documents (
    id, tenant_id, client_id, title, file_name, mime_type, category,
    storage_path, portal_visible, status, sensitivity, source, uploaded_by,
    signed_at, signature_required, updated_at
  ) VALUES (
    p_proof_id, p_tenant_id, p_client_id, v_doc_title,
    'unterschrift-' || p_proof_id::text || '.pending', 'application/pdf',
    'leistungsnachweis', NULL, TRUE, 'aktiv', 'care', 'assist_visit_proof',
    v_actor_profile_id, NULL, TRUE, now()
  )
  ON CONFLICT (id) DO UPDATE SET
    title = EXCLUDED.title,
    file_name = EXCLUDED.file_name,
    storage_path = NULL,
    portal_visible = TRUE,
    status = 'aktiv',
    category = 'leistungsnachweis',
    signed_at = NULL,
    signature_required = TRUE,
    source = 'assist_visit_proof',
    updated_at = now()
  WHERE client_documents.tenant_id = EXCLUDED.tenant_id
    AND client_documents.client_id = EXCLUDED.client_id
    AND client_documents.source = 'assist_visit_proof';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'employee_portal_release_deferred_signature: document id conflict';
  END IF;

  RETURN p_proof_id;
END;
$$;

REVOKE ALL ON FUNCTION public.employee_portal_release_deferred_signature(
  uuid, uuid, uuid, text, jsonb, text
) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.employee_portal_release_deferred_signature(
  uuid, uuid, uuid, text, jsonb, text
) TO authenticated;

COMMENT ON FUNCTION public.employee_portal_release_deferred_signature(
  uuid, uuid, uuid, text, jsonb, text
) IS 'Releases an assigned visit proof only for the active personal employee portal account bound to the authenticated session.';

-- Assist-only successor to the portal part of migration 20260911120000.
-- First completion binds an existing hash. A retry belongs to the same signature.
-- Storage can only use a single filename beneath the owning proof.
CREATE OR REPLACE FUNCTION public.client_portal_finalize_assist_proof(
  p_tenant_id uuid, p_proof_id uuid, p_signature_id uuid,
  p_expected_payload_hash text, p_signed_payload_hash text,
  p_pdf_storage_path text, p_pdf_hash text
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
  v_proof public.assist_visit_proofs%ROWTYPE;
  v_signature public.assist_visit_signatures%ROWTYPE;
  v_visit public.assist_visits%ROWTYPE;
  v_snapshot jsonb;
  v_unsigned jsonb;
  v_bound_hash text;
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
  IF NOT FOUND OR v_proof.portal_visible IS NOT TRUE
     OR v_proof.portal_release_status NOT IN ('pending_client_signature', 'released') THEN
    RAISE EXCEPTION 'Nachweis nicht für Sie freigegeben';
  END IF;
  IF v_proof.payload_snapshot->>'visitId' IS DISTINCT FROM v_visit.id::text
     OR v_proof.payload_snapshot->>'clientId' IS DISTINCT FROM v_visit.client_id::text
     OR (v_visit.employee_id IS NOT NULL AND v_proof.payload_snapshot->>'employeeId' IS DISTINCT FROM v_visit.employee_id::text) THEN
    RAISE EXCEPTION 'Nachweisinhalt gehört nicht zu diesem Einsatz' USING ERRCODE='22023';
  END IF;
  -- Repeated or concurrent delivery returns the existing receipt without overwriting it.
  IF v_proof.signature_id IS NOT NULL AND v_proof.pdf_storage_path IS NOT NULL
     AND v_proof.portal_release_status = 'released'
     AND v_proof.payload_snapshot->>'signedViaClientPortal' = 'true'
     AND v_proof.payload_snapshot->>'clientPortalPdfSignatureId' = v_proof.signature_id::text
     THEN
    IF p_signature_id IS DISTINCT FROM v_proof.signature_id THEN RAISE EXCEPTION 'Die Unterschrift gehört nicht zu diesem Abschluss'; END IF;
    IF NOT EXISTS(SELECT FROM public.assist_visit_signatures s WHERE s.id=v_proof.signature_id AND s.tenant_id=p_tenant_id
         AND s.visit_id=v_visit.id AND s.is_valid IS TRUE AND s.invalidated_at IS NULL AND s.signer_role='client'
         AND s.metadata->>'proofId'=v_proof.id::text AND s.metadata->>'signedVia'='client_portal'
         AND s.signer_name=v_proof.payload_snapshot#>>'{signature,signerName}'
         AND to_char(s.signed_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')=v_proof.payload_snapshot#>>'{signature,signedAt}'
         AND care_security.gkv_portal_signature_matches(v_proof.payload_snapshot,v_visit.id,v_visit.client_id,s.payload_hash))
       OR care_security.gkv_portal_snapshot_matches(v_proof.payload_snapshot,v_proof.payload_hash) IS NOT TRUE
       OR care_security.gkv_portal_snapshot_matches(v_proof.payload_snapshot,p_signed_payload_hash) IS NOT TRUE THEN
      RAISE EXCEPTION 'Gespeicherte Unterschriftsfassung stimmt nicht überein' USING ERRCODE='22023';
    END IF;
    RETURN jsonb_build_object('proofId', v_proof.id, 'signatureId', v_proof.signature_id,
      'signedAt', v_proof.payload_snapshot->>'clientPortalSignedAt', 'proofPersisted', true);
  END IF;
  IF v_visit.canonical_status IN ('cancelled', 'no_show') THEN RAISE EXCEPTION 'Einsatz ist nicht zur Bestätigung freigegeben'; END IF;
  IF p_expected_payload_hash IS NULL OR p_expected_payload_hash !~ '^(sha256:)?[a-f0-9]{64}$'
     OR v_proof.payload_hash IS DISTINCT FROM p_expected_payload_hash THEN
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
  IF v_signature.invalidated_at IS NOT NULL
     OR v_signature.storage_path IS DISTINCT FROM 'tenant/' || p_tenant_id::text || '/assist/visits/'
        || v_visit.id::text || '/signatures/' || p_signature_id::text || '.png' THEN
    RAISE EXCEPTION 'Signaturbild gehört nicht zu dieser Unterschrift' USING ERRCODE='22023';
  END IF;
  IF care_security.gkv_portal_signature_matches(v_proof.payload_snapshot,v_visit.id,v_visit.client_id,v_signature.payload_hash) IS NOT TRUE THEN
    RAISE EXCEPTION 'Unterschrift passt nicht zum angezeigten Leistungsinhalt' USING ERRCODE='22023';
  END IF;
  v_bound_hash := v_signature.metadata->>'proofPayloadHash';
  IF v_proof.signature_id IS NULL THEN
    -- A captured but unbound signature must not be reused for a different draft.
    IF care_security.gkv_portal_snapshot_matches(v_proof.payload_snapshot,v_proof.payload_hash) IS NOT TRUE
       OR care_security.gkv_portal_snapshot_matches(v_proof.payload_snapshot,v_bound_hash) IS NOT TRUE THEN
      RAISE EXCEPTION 'Unterschrift gehört nicht zur freigegebenen Nachweisfassung' USING ERRCODE='22023';
    END IF;
  ELSIF v_proof.signature_id = p_signature_id AND v_proof.portal_release_status = 'released'
        AND v_proof.payload_snapshot->>'signedViaClientPortal' = 'true' THEN
    -- Only restore an already identified signature. Recover the exact unsigned wire
    -- object (no document text, tasks, qualifications or times are reconstructed).
    v_unsigned := (v_proof.payload_snapshot - ARRAY['clientPortalSignedAt','signedViaClientPortal','clientPortalPdfSignatureId'])
      || jsonb_build_object('signatureDeferredToClientPortal',true,'signature',null,'signedAt',null,'signerName',null);
    IF v_bound_hash IS NOT NULL THEN
      IF care_security.gkv_portal_snapshot_matches(v_unsigned,v_bound_hash) IS NOT TRUE THEN
        RAISE EXCEPTION 'Ursprung der bereits geleisteten Unterschrift ist nicht belegbar' USING ERRCODE='22023';
      END IF;
    ELSIF care_security.gkv_portal_snapshot_matches(v_proof.payload_snapshot,v_proof.payload_hash) IS NOT TRUE THEN
      RAISE EXCEPTION 'Ungebundene Altunterschrift kann nicht automatisch wiederhergestellt werden' USING ERRCODE='22023';
    END IF;
  ELSE
    RAISE EXCEPTION 'Unterschrift gehört nicht zu diesem Abschluss' USING ERRCODE='22023';
  END IF;
  IF p_pdf_storage_path !~ ('^tenant/' || p_tenant_id || '/assist/visits/' || v_proof.visit_id || '/proofs/' || p_proof_id || '-' || p_signature_id || '-[A-Za-z0-9_-]{1,128}[.]pdf$')
     OR p_pdf_hash !~ '^(sha256:)?[a-f0-9]{64}$' OR p_signed_payload_hash !~ '^(sha256:)?[a-f0-9]{64}$'
     OR p_pdf_storage_path IS NULL OR p_pdf_hash IS NULL OR p_signed_payload_hash IS NULL THEN
    RAISE EXCEPTION 'Nachweisdatei ist ungültig';
  END IF;
  v_snapshot := v_proof.payload_snapshot || jsonb_build_object(
    'signatureDeferredToClientPortal', false, 'clientPortalSignedAt', to_char(v_signature.signed_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'signedViaClientPortal', true, 'clientPortalPdfSignatureId', p_signature_id::text, 'signerName', v_signature.signer_name,
    'signedAt', to_char(v_signature.signed_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'signature', jsonb_build_object('signerName', v_signature.signer_name,
      'signedAt', to_char(v_signature.signed_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'), 'signerRole', 'client'));

  IF care_security.gkv_portal_snapshot_matches(v_snapshot,p_signed_payload_hash) IS NOT TRUE THEN
    RAISE EXCEPTION 'Prüfsumme der unterschriebenen Nachweisfassung stimmt nicht' USING ERRCODE='22023';
  END IF;
  PERFORM 1 FROM storage.objects WHERE bucket_id = 'office-documents' AND name = p_pdf_storage_path;
  IF NOT FOUND THEN RAISE EXCEPTION 'Nachweisdatei wurde noch nicht übertragen'; END IF;
  PERFORM 1 FROM storage.objects WHERE bucket_id = 'office-documents' AND name = v_signature.storage_path;
  IF NOT FOUND THEN RAISE EXCEPTION 'Signaturbild fehlt'; END IF;

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

  INSERT INTO public.audit_logs (tenant_id, action, record_id, table_name, title, new_data)
    VALUES (p_tenant_id, 'signature', p_proof_id, 'assist_visit_proofs', 'Leistungsnachweis im Klientenportal unterzeichnet',
      jsonb_build_object('event', 'client_portal_proof_signed', 'signature_id', p_signature_id, 'signed_at', v_signature.signed_at, 'actor_user_id', auth.uid()));

  RETURN jsonb_build_object('proofId', p_proof_id, 'signatureId', p_signature_id,
    'signedAt', v_snapshot->>'clientPortalSignedAt', 'proofPersisted', true);
END;
$$;
REVOKE ALL ON FUNCTION public.client_portal_finalize_assist_proof(uuid, uuid, uuid, text, text, text, text) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.client_portal_finalize_assist_proof(uuid, uuid, uuid, text, text, text, text) TO authenticated;
