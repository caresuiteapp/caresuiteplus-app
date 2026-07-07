-- ==========================================================================
-- CareSuite+ — Migration 0240: Client portal deferred assist visit signature
-- Allows Klient:innen to sign pending_client_signature proofs from portal.
-- ==========================================================================

CREATE OR REPLACE FUNCTION public.portal_client_pending_signature_visit_ids(p_tenant_id uuid)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT avp.visit_id
  FROM public.assist_visit_proofs avp
  JOIN public.assist_visits av
    ON av.id = avp.visit_id
   AND av.tenant_id = avp.tenant_id
  WHERE avp.tenant_id = p_tenant_id
    AND av.client_id = public.current_client_id()
    AND public.current_client_id() IS NOT NULL
    AND avp.portal_visible = TRUE
    AND avp.portal_release_status = 'pending_client_signature'
    AND avp.signature_id IS NULL;
$$;

COMMENT ON FUNCTION public.portal_client_pending_signature_visit_ids(uuid) IS
  'Visit IDs with portal-visible assist proofs awaiting client signature (client portal RLS helper).';

-- assist_visit_signatures — client portal INSERT for deferred signing
DROP POLICY IF EXISTS assist_visit_signatures_portal_client_insert ON public.assist_visit_signatures;
CREATE POLICY assist_visit_signatures_portal_client_insert ON public.assist_visit_signatures
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND public.is_client_portal_rls_context(tenant_id)
    AND visit_id IN (SELECT public.portal_client_pending_signature_visit_ids(tenant_id))
    AND signer_role IN ('client', 'assignment', 'service_proof')
  );

DROP POLICY IF EXISTS assist_visit_signatures_portal_client_select ON public.assist_visit_signatures;
CREATE POLICY assist_visit_signatures_portal_client_select ON public.assist_visit_signatures
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND public.is_client_portal_rls_context(tenant_id)
    AND visit_id IN (
      SELECT v.id
      FROM public.assist_visits v
      WHERE v.tenant_id = public.current_tenant_id()
        AND v.client_id = public.current_client_id()
        AND v.planning_status <> 'draft'
    )
  );

-- assist_visit_proofs — client portal UPDATE when completing deferred signature
DROP POLICY IF EXISTS assist_visit_proofs_portal_client_sign_update ON public.assist_visit_proofs;
CREATE POLICY assist_visit_proofs_portal_client_sign_update ON public.assist_visit_proofs
  FOR UPDATE TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND public.is_client_portal_rls_context(tenant_id)
    AND portal_visible = TRUE
    AND portal_release_status = 'pending_client_signature'
    AND visit_id IN (
      SELECT v.id
      FROM public.assist_visits v
      WHERE v.tenant_id = public.current_tenant_id()
        AND v.client_id = public.current_client_id()
    )
  )
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND public.is_client_portal_rls_context(tenant_id)
    AND visit_id IN (
      SELECT v.id
      FROM public.assist_visits v
      WHERE v.tenant_id = public.current_tenant_id()
        AND v.client_id = public.current_client_id()
    )
  );

-- client_documents — client portal UPDATE signed_at after assist proof signing
DROP POLICY IF EXISTS client_documents_portal_client_sign_update ON public.client_documents;
CREATE POLICY client_documents_portal_client_sign_update ON public.client_documents
  FOR UPDATE TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND client_id = public.current_client_id()
    AND public.current_client_id() IS NOT NULL
    AND portal_visible = TRUE
    AND source = 'assist_visit_proof'
    AND signature_required = TRUE
  )
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND client_id = public.current_client_id()
    AND public.current_client_id() IS NOT NULL
    AND portal_visible = TRUE
  );

-- Storage — client portal upload assist visit signature images
DROP POLICY IF EXISTS assist_execution_storage_portal_client_insert ON storage.objects;
CREATE POLICY assist_execution_storage_portal_client_insert
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'office-documents'
    AND (storage.foldername(name))[1] = 'tenant'
    AND (storage.foldername(name))[2] = public.current_tenant_id()::text
    AND (storage.foldername(name))[3] = 'assist'
    AND (storage.foldername(name))[4] = 'visits'
    AND (storage.foldername(name))[5]::uuid IN (
      SELECT public.portal_client_pending_signature_visit_ids(public.current_tenant_id())
    )
    AND public.is_client_portal_rls_context(public.current_tenant_id())
  );
