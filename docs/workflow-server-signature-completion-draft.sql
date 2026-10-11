-- LOCAL REVIEW DRAFT, NOT APPLIED. 2026-10-11 production catalogue is the schema source.
-- This replaces split CS signing writes with a scoped, atomic receipt. It does
-- not enable the App button and is not an original-PDF composition solution.
-- Depends on workflow-server-identity-draft.sql. Deploy only together with
-- profile/role protection, direct-write ceilings,
-- confirmed Office role permissions and both platform capability handshakes.
BEGIN;

CREATE OR REPLACE FUNCTION public.workflow_current_verified_profile(p_tenant_id uuid)
RETURNS uuid LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog
AS $$
DECLARE v_profile uuid;
BEGIN
  IF auth.uid() IS NULL OR p_tenant_id IS DISTINCT FROM public.current_tenant_id() THEN
    RAISE EXCEPTION 'Mandant oder Anmeldung ist nicht verifiziert' USING ERRCODE='42501';
  END IF;
  SELECT p.id INTO v_profile FROM public.profiles p
    WHERE p.id=public.resolve_current_profile_id() AND p.tenant_id=p_tenant_id
      AND (p.auth_user_id=auth.uid() OR (p.auth_user_id IS NULL AND p.id=auth.uid()));
  IF NOT FOUND THEN RAISE EXCEPTION 'Profilzuordnung ist nicht verifiziert' USING ERRCODE='42501'; END IF;
  RETURN v_profile;
END $$;
REVOKE ALL ON FUNCTION public.workflow_current_verified_profile(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.workflow_current_verified_profile(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.workflow_sign_cs_document_request(
  p_tenant_id uuid, p_request_id uuid, p_signer_role text, p_signer_name text,
  p_signature_data_url text, p_expected_updated_at timestamptz
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog
AS $$
DECLARE
  v_profile uuid := public.workflow_current_verified_profile(p_tenant_id);
  v_role text := public.current_role_key();
  v_request public.cs_document_requests%ROWTYPE;
  v_signature public.cs_document_request_signatures%ROWTYPE;
  v_html text; v_anchor text; v_pattern text; v_image text;
  v_signed_at timestamptz := clock_timestamp();
  v_fingerprint text; v_all_done boolean; v_signature_count integer;
BEGIN
  IF p_signer_role IS NULL OR p_signer_name IS NULL OR nullif(btrim(p_signer_name),'') IS NULL
    OR length(p_signer_name)>300 OR p_expected_updated_at IS NULL
    OR p_signature_data_url IS NULL OR length(p_signature_data_url)>3000000
    OR p_signature_data_url !~ '^data:image/png;base64,[A-Za-z0-9+/]+={0,2}$' THEN
    RAISE EXCEPTION 'Signatur oder geprüfte Dokumentversion fehlt';
  END IF;
  IF substring(decode(substring(p_signature_data_url,23),'base64'),1,8)<>decode('89504e470d0a1a0a','hex') THEN
    RAISE EXCEPTION 'Signaturdaten enthalten keinen PNG-Dateikopf';
  END IF;
  v_fingerprint := encode(sha256(convert_to(p_signature_data_url,'UTF8')),'hex');
  SELECT * INTO v_request FROM public.cs_document_requests
    WHERE id=p_request_id AND owner_tenant_id=p_tenant_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Dokument nicht gefunden' USING ERRCODE='42501'; END IF;
  IF public.is_client_portal_rls_context(p_tenant_id) THEN
    IF NOT v_request.portal_visible OR v_request.recipient_scope NOT IN ('client','both')
      OR v_request.client_id IS DISTINCT FROM public.current_client_id()
      OR public.current_client_id() IS NULL
      OR p_signer_role IS DISTINCT FROM (CASE WHEN v_role='family_portal' THEN 'representative' ELSE 'client' END) THEN
      RAISE EXCEPTION 'Diese Rolle oder dieses Dokument gehört nicht zu Ihrem Portal' USING ERRCODE='42501';
    END IF;
  ELSIF public.is_employee_portal_rls_context(p_tenant_id)
    OR (v_role IN ('caregiver','nurse') AND public.is_internal_tenant_actor(p_tenant_id)) THEN
    IF NOT v_request.portal_visible OR v_request.recipient_scope NOT IN ('employee','both')
      OR p_signer_role<>'employee' OR public.resolve_current_employee_id() IS NULL
      OR v_request.employee_id IS DISTINCT FROM public.resolve_current_employee_id() THEN
      RAISE EXCEPTION 'Dieses Dokument gehört nicht zu Ihrem Mitarbeitendenprofil' USING ERRCODE='42501';
    END IF;
  ELSIF public.is_internal_tenant_actor(p_tenant_id)
    AND public.has_permission('office.documents.signatures.manage') THEN
    IF p_signer_role<>'office' THEN RAISE EXCEPTION 'Office kann nur die eigene Office-Rolle unterzeichnen' USING ERRCODE='42501'; END IF;
  ELSE RAISE EXCEPTION 'Keine Berechtigung für diesen Abschluss' USING ERRCODE='42501';
  END IF;

  -- The catalogue has no unique(request_id,signer_role). Never silently update
  -- multiple ambiguous slots and never rewrite an unbound legacy partial row.
  SELECT count(*) INTO v_signature_count FROM public.cs_document_request_signatures
    WHERE request_id=p_request_id AND signer_role=p_signer_role;
  IF v_signature_count<>1 THEN RAISE EXCEPTION 'Unterschriftsrolle ist nicht eindeutig'; END IF;
  SELECT * INTO v_signature FROM public.cs_document_request_signatures
    WHERE request_id=p_request_id AND signer_role=p_signer_role FOR UPDATE;
  IF v_signature.status='signed' THEN
    IF v_signature.audit_payload->>'contract'='cs-completion-v1'
      AND v_signature.audit_payload->>'actorProfileId'=v_profile::text
      AND v_signature.audit_payload->>'actorAuthUserId'=auth.uid()::text
      AND v_signature.audit_payload->>'reviewedUpdatedAt'=p_expected_updated_at::text
      AND v_signature.audit_payload->>'signatureHash'=v_fingerprint
      AND v_signature.signature_data_url=p_signature_data_url
      AND v_signature.signer_name=btrim(p_signer_name)
      AND v_request.status IN ('partially_signed','completed') THEN
      RETURN jsonb_build_object('contract','cs-completion-v1','requestId',p_request_id,
        'signatureId',v_signature.id,'signerRole',p_signer_role,'actorProfileId',v_profile,
        'status',v_request.status,'signedAt',v_signature.signed_at,'replayed',true);
    END IF;
    RAISE EXCEPTION 'Vorhandene Unterschrift gehört zu einem anderen oder nicht verifizierten Abschluss';
  END IF;
  IF v_signature.status<>'pending' OR v_request.status NOT IN ('sent','opened','partially_signed')
    OR v_request.updated_at IS DISTINCT FROM p_expected_updated_at
    OR nullif(btrim(v_request.rendered_html),'') IS NULL THEN
    RAISE EXCEPTION 'Dokument wurde geändert oder ist nicht zur Unterzeichnung offen';
  END IF;
  -- Render only from the locked original, never accept replacement HTML from a portal.
  v_anchor := p_signer_role || '_signature';
  v_image := '<img src="' || p_signature_data_url || '" alt="Unterschrift" style="max-height:80px;max-width:240px;" /><br/><small>'
    || replace(replace(replace(btrim(p_signer_name),'&','&amp;'),'<','&lt;'),'>','&gt;')
    || ' · ' || to_char(v_signed_at AT TIME ZONE 'Europe/Berlin','DD.MM.YYYY HH24:MI:SS') || '</small>';
  v_pattern := '(<span[^>]*data-signature-anchor="' || v_anchor || '"[^>]*>)(\[SIGNATURE:[^]]+\])(</span>)';
  IF v_request.rendered_html ~* v_pattern THEN
    v_html := regexp_replace(v_request.rendered_html,v_pattern,'\1'||replace(v_image,E'\\',E'\\\\')||'\3','i');
  ELSE v_html := v_request.rendered_html || '<p data-signature-anchor="'||v_anchor||'">'||v_image||'</p>'; END IF;
  UPDATE public.cs_document_request_signatures SET status='signed',signer_name=btrim(p_signer_name),
    signature_data_url=p_signature_data_url,signed_at=v_signed_at,updated_at=v_signed_at,
    audit_payload=audit_payload||jsonb_build_object('contract','cs-completion-v1',
      'actorProfileId',v_profile,'actorAuthUserId',auth.uid(),'reviewedUpdatedAt',p_expected_updated_at::text,
      'reviewedHtmlHash',encode(sha256(convert_to(v_request.rendered_html,'UTF8')),'hex'),
      'signatureHash',v_fingerprint)
    WHERE id=v_signature.id AND request_id=p_request_id AND status='pending';
  IF NOT FOUND THEN RAISE EXCEPTION 'Signaturabschluss wurde nicht bestätigt'; END IF;
  SELECT NOT EXISTS(SELECT 1 FROM public.cs_document_request_signatures
    WHERE request_id=p_request_id AND status NOT IN ('signed','not_required')) INTO v_all_done;
  UPDATE public.cs_document_requests SET rendered_html=v_html,
    status=CASE WHEN v_all_done THEN 'completed' ELSE 'partially_signed' END,
    completed_at=CASE WHEN v_all_done THEN v_signed_at ELSE NULL END,updated_at=v_signed_at
    WHERE id=p_request_id AND owner_tenant_id=p_tenant_id;
  RETURN jsonb_build_object('contract','cs-completion-v1','requestId',p_request_id,
    'signatureId',v_signature.id,'signerRole',p_signer_role,'actorProfileId',v_profile,
    'status',CASE WHEN v_all_done THEN 'completed' ELSE 'partially_signed' END,
    'signedAt',v_signed_at,'replayed',false);
END $$;
REVOKE ALL ON FUNCTION public.workflow_sign_cs_document_request(uuid,uuid,text,text,text,timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.workflow_sign_cs_document_request(uuid,uuid,text,text,text,timestamptz) TO authenticated;

-- Required deployment companion: direct signature writes must not bypass this
-- receipt. Existing Office/Web direct writes are deliberately incompatible;
-- migrate both callers and retire the weaker old client RPC before applying.
DROP POLICY IF EXISTS workflow_cs_signature_write_ceiling ON public.cs_document_request_signatures;
CREATE POLICY workflow_cs_signature_write_ceiling ON public.cs_document_request_signatures
  AS RESTRICTIVE FOR UPDATE TO authenticated USING(false) WITH CHECK(false);
DROP POLICY IF EXISTS workflow_cs_signature_insert_ceiling ON public.cs_document_request_signatures;
CREATE POLICY workflow_cs_signature_insert_ceiling ON public.cs_document_request_signatures
 AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK(
  status IN ('pending','not_required') AND signature_data_url IS NULL AND signed_at IS NULL
  AND coalesce(audit_payload,'{}'::jsonb)='{}'::jsonb
  AND EXISTS(SELECT 1 FROM public.cs_document_requests r WHERE r.id=request_id
    AND r.owner_tenant_id=public.current_tenant_id() AND r.status='draft'
    AND public.is_internal_tenant_actor(r.owner_tenant_id)
    AND public.has_permission('office.documents.signatures.manage')));
DROP POLICY IF EXISTS workflow_cs_signature_delete_ceiling ON public.cs_document_request_signatures;
CREATE POLICY workflow_cs_signature_delete_ceiling ON public.cs_document_request_signatures
 AS RESTRICTIVE FOR DELETE TO authenticated USING(false);
DROP POLICY IF EXISTS workflow_cs_request_update_ceiling ON public.cs_document_requests;
CREATE POLICY workflow_cs_request_update_ceiling ON public.cs_document_requests AS RESTRICTIVE
 FOR UPDATE TO authenticated USING(status='draft' AND public.is_internal_tenant_actor(owner_tenant_id)
  AND public.has_permission('office.documents.signatures.manage'))
 WITH CHECK(status='draft' AND public.is_internal_tenant_actor(owner_tenant_id)
  AND public.has_permission('office.documents.signatures.manage'));
DROP POLICY IF EXISTS workflow_cs_request_delete_ceiling ON public.cs_document_requests;
CREATE POLICY workflow_cs_request_delete_ceiling ON public.cs_document_requests AS RESTRICTIVE
 FOR DELETE TO authenticated USING(false);
DROP POLICY IF EXISTS workflow_cs_request_insert_ceiling ON public.cs_document_requests;
CREATE POLICY workflow_cs_request_insert_ceiling ON public.cs_document_requests AS RESTRICTIVE FOR INSERT TO authenticated
 WITH CHECK(owner_tenant_id=public.current_tenant_id() AND status='draft' AND completed_at IS NULL
  AND public.is_internal_tenant_actor(owner_tenant_id) AND public.has_permission('office.documents.signatures.manage'));
-- Retire the weaker SECURITY DEFINER alternate entry point. The App continues
-- using it today: this revocation therefore requires the failclosed handshake
-- and migrated client/family/Office callers before this local draft is applied.
DO $$ BEGIN
 IF to_regprocedure('public.client_portal_sign_document_request(uuid,uuid,text,text,text,timestamptz)') IS NOT NULL THEN
  EXECUTE 'REVOKE ALL ON FUNCTION public.client_portal_sign_document_request(uuid,uuid,text,text,text,timestamptz) FROM PUBLIC,anon,authenticated';
 END IF;
END $$;
COMMIT;
