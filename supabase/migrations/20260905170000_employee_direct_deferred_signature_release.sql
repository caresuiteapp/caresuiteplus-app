-- Employee portal: securely release a deferred client signature in one transaction.
-- The broad employee UPDATE policy remains revoked. This SECURITY DEFINER function
-- validates tenant, role, employee assignment, visit and client before changing data.

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
SET search_path = public, pg_temp
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
  IF NOT public.is_employee_portal_rls_context(p_tenant_id) THEN
    RAISE EXCEPTION 'employee_portal_release_deferred_signature: employee portal role required';
  END IF;

  v_employee_id := public.resolve_current_employee_id();
  IF v_employee_id IS NULL THEN
    RAISE EXCEPTION 'employee_portal_release_deferred_signature: employee not resolved';
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
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.employee_portal_release_deferred_signature(
  uuid, uuid, uuid, text, jsonb, text
) TO authenticated;

COMMENT ON FUNCTION public.employee_portal_release_deferred_signature(
  uuid, uuid, uuid, text, jsonb, text
) IS 'Atomically releases an assigned visit proof to the client portal without broad employee table UPDATE rights.';
