-- ==========================================================================
-- CareSuite+ — Migration 0242: SECURITY DEFINER RPC for deferred signature release
-- Bypasses client_documents RLS edge cases; validates employee assignment in RPC.
-- ==========================================================================

CREATE OR REPLACE FUNCTION public.employee_portal_upsert_deferred_signature_client_document(
  p_tenant_id uuid,
  p_proof_id uuid,
  p_client_id uuid,
  p_title text,
  p_actor_profile_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_visit_id uuid;
  v_employee_id uuid;
  v_doc_title text;
BEGIN
  IF p_tenant_id IS NULL OR p_proof_id IS NULL OR p_client_id IS NULL THEN
    RAISE EXCEPTION 'employee_portal_upsert_deferred_signature_client_document: missing required parameters';
  END IF;

  IF p_tenant_id IS DISTINCT FROM public.current_tenant_id() THEN
    RAISE EXCEPTION 'employee_portal_upsert_deferred_signature_client_document: tenant mismatch';
  END IF;

  IF NOT public.is_employee_portal_rls_context(p_tenant_id)
     AND NOT public.is_tenant_member(p_tenant_id) THEN
    RAISE EXCEPTION 'employee_portal_upsert_deferred_signature_client_document: insufficient permissions';
  END IF;

  v_employee_id := public.resolve_current_employee_id();
  IF v_employee_id IS NULL THEN
    RAISE EXCEPTION 'employee_portal_upsert_deferred_signature_client_document: employee not resolved';
  END IF;

  SELECT avp.visit_id
  INTO v_visit_id
  FROM public.assist_visit_proofs avp
  WHERE avp.tenant_id = p_tenant_id
    AND avp.id = p_proof_id
    AND avp.portal_visible = TRUE
    AND avp.portal_release_status = 'pending_client_signature';

  IF v_visit_id IS NULL THEN
    RAISE EXCEPTION 'employee_portal_upsert_deferred_signature_client_document: proof not pending client signature';
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
    RAISE EXCEPTION 'employee_portal_upsert_deferred_signature_client_document: visit not assigned to employee';
  END IF;

  v_doc_title := COALESCE(NULLIF(trim(p_title), ''), 'Leistungsnachweis') || ' — Unterschrift ausstehend';

  INSERT INTO public.client_documents (
    id,
    tenant_id,
    client_id,
    title,
    file_name,
    mime_type,
    category,
    storage_path,
    portal_visible,
    status,
    sensitivity,
    source,
    uploaded_by,
    signed_at,
    signature_required,
    updated_at
  )
  VALUES (
    p_proof_id,
    p_tenant_id,
    p_client_id,
    v_doc_title,
    'unterschrift-' || p_proof_id::text || '.pending',
    'application/pdf',
    'leistungsnachweis',
    NULL,
    TRUE,
    'aktiv',
    'care',
    'assist_visit_proof',
    p_actor_profile_id,
    NULL,
    TRUE,
    now()
  )
  ON CONFLICT (id) DO UPDATE SET
    title = EXCLUDED.title,
    file_name = EXCLUDED.file_name,
    storage_path = EXCLUDED.storage_path,
    portal_visible = EXCLUDED.portal_visible,
    status = EXCLUDED.status,
    category = EXCLUDED.category,
    signed_at = NULL,
    signature_required = TRUE,
    source = EXCLUDED.source,
    updated_at = now();

  RETURN p_proof_id;
END;
$$;

COMMENT ON FUNCTION public.employee_portal_upsert_deferred_signature_client_document(uuid, uuid, uuid, text, uuid) IS
  'Employee portal — upsert client_documents row for deferred assist visit signature (SECURITY DEFINER).';

GRANT EXECUTE ON FUNCTION public.employee_portal_upsert_deferred_signature_client_document(uuid, uuid, uuid, text, uuid) TO authenticated;
