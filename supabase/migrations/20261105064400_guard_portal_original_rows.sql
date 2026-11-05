-- Intersect broad tenant policies; a portal account never inherits office
-- access to another client's proof or signature through tenant membership.
CREATE FUNCTION care_security.gkv_portal_row_scope(t uuid,v_id uuid)
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE typ text; role_key text; c uuid; account uuid; family boolean;
BEGIN
 IF auth.uid() IS NULL OR t IS DISTINCT FROM public.current_tenant_id() THEN RETURN 'denied'; END IF;
 typ:=public.current_portal_type();role_key:=public.current_role_key();
 family:=coalesce(typ IN ('family','relative'),false) OR coalesce(role_key IN ('family_portal','relative'),false);
 IF NOT (family OR coalesce(typ='client',false) OR coalesce(role_key IN ('client','client_portal'),false)
   OR (typ IS NULL AND public.is_client_portal_rls_context(t) IS TRUE)) THEN RETURN 'institution'; END IF;
 c:=public.current_client_id();account:=public.current_portal_account_id();
 IF c IS NULL OR public.is_client_portal_rls_context(t) IS NOT TRUE OR NOT EXISTS(
  SELECT FROM public.client_portal_access p WHERE p.tenant_id=t AND p.client_id=c AND p.auth_user_id=auth.uid()
   AND (account IS NULL OR p.id=account) AND p.portal_enabled AND p.status='aktiv'
  UNION ALL SELECT FROM public.client_portal_codes p WHERE NOT family AND p.tenant_id=t AND p.client_id=c AND p.auth_user_id=auth.uid()
   AND (account IS NULL OR p.id=account) AND p.status='active' AND p.blocked_at IS NULL AND (p.expires_at IS NULL OR p.expires_at>statement_timestamp())
 ) OR NOT EXISTS(SELECT FROM public.assist_visits v WHERE v.tenant_id=t AND v.id=v_id AND v.client_id=c AND v.planning_status<>'draft') THEN RETURN 'denied'; END IF;
 RETURN 'client';
END $$;
REVOKE ALL ON FUNCTION care_security.gkv_portal_row_scope(uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION care_security.gkv_portal_row_scope(uuid,uuid) TO authenticated;
CREATE POLICY gkv_portal_proof_scoped_read ON public.assist_visit_proofs AS RESTRICTIVE FOR SELECT TO authenticated
 USING (care_security.gkv_portal_row_scope(tenant_id,visit_id)='institution' OR
  (care_security.gkv_portal_row_scope(tenant_id,visit_id)='client' AND portal_visible AND portal_release_status IN ('pending_client_signature','released')));
-- The validated finalizer performs client updates atomically as its owner.
CREATE POLICY gkv_portal_proof_no_direct_insert ON public.assist_visit_proofs AS RESTRICTIVE FOR INSERT TO authenticated
 WITH CHECK (care_security.gkv_portal_row_scope(tenant_id,visit_id)='institution');
CREATE POLICY gkv_portal_proof_no_direct_update ON public.assist_visit_proofs AS RESTRICTIVE FOR UPDATE TO authenticated
 USING (care_security.gkv_portal_row_scope(tenant_id,visit_id)='institution') WITH CHECK(care_security.gkv_portal_row_scope(tenant_id,visit_id)='institution');
CREATE POLICY gkv_portal_proof_no_direct_delete ON public.assist_visit_proofs AS RESTRICTIVE FOR DELETE TO authenticated
 USING (care_security.gkv_portal_row_scope(tenant_id,visit_id)='institution');
CREATE POLICY gkv_portal_signature_scoped_read ON public.assist_visit_signatures AS RESTRICTIVE FOR SELECT TO authenticated
 USING (care_security.gkv_portal_row_scope(tenant_id,visit_id)='institution' OR
  (care_security.gkv_portal_row_scope(tenant_id,visit_id)='client' AND EXISTS(SELECT FROM public.assist_visit_proofs p
   WHERE p.tenant_id=assist_visit_signatures.tenant_id AND p.visit_id=assist_visit_signatures.visit_id AND p.portal_visible
    AND p.portal_release_status IN ('pending_client_signature','released') AND
     (p.signature_id=assist_visit_signatures.id OR (p.portal_release_status='pending_client_signature' AND assist_visit_signatures.metadata->>'proofId'=p.id::text)))));
CREATE POLICY gkv_portal_signature_scoped_insert ON public.assist_visit_signatures AS RESTRICTIVE FOR INSERT TO authenticated
 WITH CHECK (care_security.gkv_portal_row_scope(tenant_id,visit_id)='institution' OR
  (care_security.gkv_portal_row_scope(tenant_id,visit_id)='client' AND signer_role='client' AND metadata->>'signedVia'='client_portal'
   AND EXISTS(SELECT FROM public.assist_visit_proofs p WHERE p.tenant_id=assist_visit_signatures.tenant_id AND p.visit_id=assist_visit_signatures.visit_id
    AND p.portal_visible AND p.portal_release_status='pending_client_signature' AND p.signature_id IS NULL
    AND assist_visit_signatures.metadata->>'proofId'=p.id::text AND assist_visit_signatures.metadata->>'proofPayloadHash'=p.payload_hash)));
CREATE POLICY gkv_portal_signature_no_direct_update ON public.assist_visit_signatures AS RESTRICTIVE FOR UPDATE TO authenticated
 USING (care_security.gkv_portal_row_scope(tenant_id,visit_id)='institution') WITH CHECK(care_security.gkv_portal_row_scope(tenant_id,visit_id)='institution');
CREATE POLICY gkv_portal_signature_no_direct_delete ON public.assist_visit_signatures AS RESTRICTIVE FOR DELETE TO authenticated
 USING (care_security.gkv_portal_row_scope(tenant_id,visit_id)='institution');
NOTIFY pgrst,'reload schema';
