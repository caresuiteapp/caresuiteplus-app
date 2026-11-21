-- Intersect existing permissive Storage policies for the three Assist original namespaces.
-- Institutional roles retain their existing policies. Never handle arbitrary object content here.
CREATE FUNCTION care_security.gkv_portal_object_allowed(bucket text, object_path text, operation text)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE t uuid;c uuid;owner_user uuid;account uuid;visit uuid; a text[]; dir text; file text; family boolean; typ text; role_key text;
   uuid_pattern constant text:='[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}';
BEGIN
 IF bucket IS DISTINCT FROM 'office-documents' OR object_path !~ '^tenant/[^/]+/assist/visits/[^/]+/(signatures|proofs|server-proofs)(/|$)' THEN RETURN true; END IF;
 owner_user:=auth.uid();t:=public.current_tenant_id();
 IF owner_user IS NULL OR t IS NULL OR operation IS NULL OR operation NOT IN ('read','insert','change') THEN RETURN false; END IF;
 typ:=public.current_portal_type();role_key:=public.current_role_key();
 family:=coalesce(typ IN ('family','relative'),false) OR coalesce(role_key IN ('family_portal','relative'),false);
 IF NOT (family OR coalesce(typ='client',false) OR coalesce(role_key IN ('client','client_portal'),false)
    OR (typ IS NULL AND public.is_client_portal_rls_context(t) IS TRUE)) THEN RETURN true; END IF;
 -- Signature capture and recovery create new objects. Clients never replace, rename or delete these originals.
 IF operation='change' THEN RETURN false; END IF;
 a:=string_to_array(object_path,'/'); dir:=a[6];file:=a[7];
 IF cardinality(a)<>7 OR a[2] IS DISTINCT FROM t::text OR a[5] !~ ('^'||uuid_pattern||'$') OR nullif(file,'') IS NULL THEN RETURN false; END IF;
 c:=public.current_client_id();account:=public.current_portal_account_id();visit:=a[5]::uuid;
 IF c IS NULL OR public.is_client_portal_rls_context(t) IS NOT TRUE OR NOT EXISTS(
   SELECT FROM public.client_portal_access p WHERE p.tenant_id=t AND p.auth_user_id=owner_user AND p.client_id=c
      AND (account IS NULL OR p.id=account) AND p.portal_enabled AND p.status='aktiv'
   UNION ALL SELECT FROM public.client_portal_codes pc WHERE NOT family AND pc.tenant_id=t AND pc.auth_user_id=owner_user
      AND pc.client_id=c AND (account IS NULL OR pc.id=account) AND pc.status='active' AND pc.blocked_at IS NULL
      AND (pc.expires_at IS NULL OR pc.expires_at>statement_timestamp())
 ) THEN RETURN false; END IF;
 RETURN EXISTS(SELECT FROM public.assist_visits v JOIN public.assist_visit_proofs p ON p.tenant_id=v.tenant_id AND p.visit_id=v.id
   WHERE v.tenant_id=t AND v.id=visit AND v.client_id=c AND p.portal_visible IS TRUE
     AND p.portal_release_status IN ('pending_client_signature','released')
     AND CASE
       WHEN dir='signatures' AND operation='insert' THEN NOT family AND p.portal_release_status='pending_client_signature'
         AND p.signature_id IS NULL AND file ~ ('^'||uuid_pattern||'[.]png$')
         AND NOT EXISTS(SELECT FROM public.assist_visit_signatures prior WHERE prior.tenant_id=t AND prior.visit_id=v.id AND prior.storage_path=object_path)
       WHEN dir='signatures' AND operation='read' THEN EXISTS(SELECT FROM public.assist_visit_signatures s WHERE s.tenant_id=t AND s.visit_id=v.id
         AND s.storage_path=object_path AND file=s.id::text||'.png' AND s.is_valid AND s.invalidated_at IS NULL
         AND (p.signature_id=s.id OR (p.portal_release_status='pending_client_signature' AND s.metadata->>'proofId'=p.id::text
           AND s.metadata->>'signedVia'='client_portal' AND s.metadata->>'proofPayloadHash'=p.payload_hash)))
       WHEN operation='read' AND dir IN ('proofs','server-proofs') AND p.portal_release_status='released' AND p.signature_id IS NOT NULL
          AND p.pdf_storage_path=object_path AND p.pdf_hash ~ '^(sha256:)?[0-9a-f]{64}$' THEN EXISTS(
            SELECT FROM public.assist_visit_signatures s WHERE s.id=p.signature_id AND s.visit_id=v.id AND s.tenant_id=t AND s.is_valid AND s.invalidated_at IS NULL)
       WHEN dir='proofs' AND NOT family THEN EXISTS(SELECT FROM public.assist_visit_signatures s WHERE s.tenant_id=t AND s.visit_id=v.id
         AND s.is_valid AND s.invalidated_at IS NULL AND s.signer_role='client' AND s.metadata->>'proofId'=p.id::text AND s.metadata->>'signedVia'='client_portal'
         AND file ~ ('^'||p.id::text||'-'||s.id::text||'-[A-Za-z0-9_-]{1,128}[.]pdf$')
         AND ((p.portal_release_status='pending_client_signature' AND p.signature_id IS NULL AND s.metadata->>'proofPayloadHash'=p.payload_hash)
           OR (p.portal_release_status='released' AND p.signature_id=s.id AND p.payload_snapshot->>'signedViaClientPortal'='true'
             AND (p.pdf_storage_path IS NULL OR p.payload_snapshot->>'clientPortalPdfSignatureId' IS DISTINCT FROM s.id::text))))
       ELSE false END);
END $$;
REVOKE ALL ON FUNCTION care_security.gkv_portal_object_allowed(text,text,text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION care_security.gkv_portal_object_allowed(text,text,text) TO authenticated;
CREATE POLICY gkv_portal_original_read ON storage.objects AS RESTRICTIVE FOR SELECT TO authenticated
 USING (care_security.gkv_portal_object_allowed(bucket_id,name,'read'));
CREATE POLICY gkv_portal_original_insert ON storage.objects AS RESTRICTIVE FOR INSERT TO authenticated
 WITH CHECK (care_security.gkv_portal_object_allowed(bucket_id,name,'insert'));
CREATE POLICY gkv_portal_original_update ON storage.objects AS RESTRICTIVE FOR UPDATE TO authenticated
 USING (care_security.gkv_portal_object_allowed(bucket_id,name,'change')) WITH CHECK (care_security.gkv_portal_object_allowed(bucket_id,name,'change'));
CREATE POLICY gkv_portal_original_delete ON storage.objects AS RESTRICTIVE FOR DELETE TO authenticated
 USING (care_security.gkv_portal_object_allowed(bucket_id,name,'change'));
CREATE POLICY gkv_portal_original_no_anon ON storage.objects AS RESTRICTIVE FOR ALL TO anon
 USING (bucket_id<>'office-documents' OR name !~ '^tenant/[^/]+/assist/visits/[^/]+/(signatures|proofs|server-proofs)(/|$)')
 WITH CHECK (bucket_id<>'office-documents' OR name !~ '^tenant/[^/]+/assist/visits/[^/]+/(signatures|proofs|server-proofs)(/|$)');
