-- Publish an administrative signature request and its portal document together.
-- Repeated clicks preserve the existing request; signed proofs are never reset.
CREATE OR REPLACE FUNCTION public.admin_release_deferred_signature(
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
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor uuid;
  v_proof public.assist_visit_proofs%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Anmeldung ist erforderlich';
  END IF;
  IF p_tenant_id IS NULL OR p_tenant_id IS DISTINCT FROM public.current_tenant_id() THEN
    RAISE EXCEPTION 'Mandant stimmt nicht überein';
  END IF;
  IF NOT coalesce(public.is_tenant_admin() OR public.has_permission('assist.execution.manage'), FALSE) THEN
    RAISE EXCEPTION 'Keine Berechtigung';
  END IF;
  v_actor := public.resolve_current_profile_id();
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Angemeldetes Verwaltungsprofil konnte nicht zugeordnet werden';
  END IF;
  IF p_proof_id IS NULL OR p_client_id IS NULL
     OR p_payload_snapshot IS NULL OR jsonb_typeof(p_payload_snapshot) <> 'object'
     OR nullif(trim(coalesce(p_payload_hash, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Angaben zur Signaturanforderung sind unvollständig';
  END IF;

  SELECT * INTO v_proof
  FROM public.assist_visit_proofs
  WHERE tenant_id = p_tenant_id AND id = p_proof_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Nachweis nicht gefunden'; END IF;

  PERFORM 1 FROM public.assist_visits
  WHERE tenant_id = p_tenant_id AND id = v_proof.visit_id AND client_id = p_client_id
  FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Signaturanforderung ist nicht eindeutig dem Klienten zugeordnet';
  END IF;
  IF v_proof.signature_id IS NOT NULL OR v_proof.status IN ('approved', 'exported', 'archived') THEN
    RAISE EXCEPTION 'Der Nachweis ist bereits unterschrieben oder freigegeben';
  END IF;

  IF v_proof.portal_visible AND v_proof.portal_release_status = 'pending_client_signature' THEN
    IF EXISTS (
      SELECT 1 FROM public.client_documents
      WHERE id = p_proof_id AND tenant_id = p_tenant_id AND client_id = p_client_id
        AND source = 'assist_visit_proof' AND portal_visible
        AND signature_required AND signed_at IS NULL AND status = 'aktiv'
    ) THEN
      RETURN p_proof_id;
    END IF;
  ELSE
    UPDATE public.assist_visit_proofs
    SET payload_snapshot = p_payload_snapshot,
        payload_hash = trim(p_payload_hash),
        portal_visible = TRUE,
        portal_release_status = 'pending_client_signature',
        released_to_portal_at = now(),
        updated_by = v_actor,
        updated_at = now()
    WHERE id = p_proof_id AND tenant_id = p_tenant_id;
  END IF;

  INSERT INTO public.client_documents (
    id, tenant_id, client_id, title, file_name, mime_type, category,
    storage_path, portal_visible, status, sensitivity, source, uploaded_by,
    signed_at, signature_required, updated_at
  ) VALUES (
    p_proof_id, p_tenant_id, p_client_id,
    coalesce(nullif(trim(p_title), ''), 'Leistungsnachweis') || ' — Unterschrift ausstehend',
    'unterschrift-' || p_proof_id::text || '.pending', 'application/pdf',
    'leistungsnachweis', NULL, TRUE, 'aktiv', 'care', 'assist_visit_proof',
    v_actor, NULL, TRUE, now()
  )
  ON CONFLICT (id) DO UPDATE SET
    portal_visible = TRUE,
    signature_required = TRUE,
    status = 'aktiv',
    updated_at = now()
  WHERE client_documents.tenant_id = EXCLUDED.tenant_id
    AND client_documents.client_id = EXCLUDED.client_id
    AND client_documents.source = 'assist_visit_proof'
    AND client_documents.signed_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Portal-Dokument ist bereits unterschrieben oder nicht eindeutig zugeordnet';
  END IF;
  RETURN p_proof_id;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_release_deferred_signature(uuid, uuid, uuid, text, jsonb, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_release_deferred_signature(uuid, uuid, uuid, text, jsonb, text)
  TO authenticated;
NOTIFY pgrst, 'reload schema';
