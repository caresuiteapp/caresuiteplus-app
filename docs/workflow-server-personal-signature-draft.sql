-- LOCAL REVIEW DRAFT, NOT APPLIED. Requires identity + CS verified-profile helper
-- and workflow-server-document-storage-draft.sql before any caller migration.
-- App activation is blocked until capability/version handshake and a trusted
-- renderer actually exists. No metadata-only claim proves Storage PDF bytes.
BEGIN;
CREATE OR REPLACE FUNCTION public.workflow_capture_personal_signature(
 p_tenant uuid,p_document uuid,p_capture uuid,p_role text,p_name text,
 p_version integer,p_content_hash text,p_png_path text,p_png_hash text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE v_profile uuid:=public.workflow_current_verified_profile(p_tenant);
 d public.portal_signature_documents%ROWTYPE;c public.portal_signature_captures%ROWTYPE;
 o storage.objects%ROWTYPE;v_hash text;v_count integer;v_all boolean;v_now timestamptz:=clock_timestamp();
BEGIN
 SELECT * INTO d FROM public.portal_signature_documents WHERE id=p_document AND tenant_id=p_tenant FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Dokument nicht gefunden' USING ERRCODE='42501'; END IF;
 IF d.document_source_type='pdf_upload' THEN RAISE EXCEPTION 'Original-PDF-Komposition benötigt einen verifizierten Serverrenderer'; END IF;
 IF public.is_employee_portal_rls_context(p_tenant) OR
  (public.current_role_key() IN ('caregiver','nurse') AND public.is_internal_tenant_actor(p_tenant)) THEN
  IF d.employee_id IS DISTINCT FROM public.resolve_current_employee_id() OR d.employee_id IS NULL
   OR d.recipient_type<>'employee' THEN RAISE EXCEPTION 'Fremdes Mitarbeitendendokument' USING ERRCODE='42501'; END IF;
 ELSIF public.is_client_portal_rls_context(p_tenant) THEN
  IF public.current_role_key()<>'client_portal' OR p_role<>'client' OR d.client_id IS NULL
   OR d.client_id IS DISTINCT FROM public.current_client_id() OR d.recipient_type<>'client' THEN
   RAISE EXCEPTION 'Diese Dokumentrolle gehört nicht zu Ihrem Portal' USING ERRCODE='42501'; END IF;
 ELSE RAISE EXCEPTION 'Keine persönliche Unterschriftsberechtigung' USING ERRCODE='42501'; END IF;
 IF p_capture IS NULL OR p_role IS NULL OR p_role NOT IN ('employee','client') OR nullif(btrim(p_name),'') IS NULL
  OR length(p_name)>300 OR p_version IS NULL OR p_version<>d.version_number OR nullif(d.preview_html,'') IS NULL
  OR p_png_hash IS NULL OR p_png_hash !~ '^sha256:[a-f0-9]{64}$' THEN RAISE EXCEPTION 'Geprüfte Originalfassung oder Signatur fehlt'; END IF;
 v_hash:='sha256:'||encode(sha256(convert_to(d.id::text||':'||d.version_number::text||':'||d.preview_html,'UTF8')),'hex');
 IF p_content_hash IS DISTINCT FROM v_hash THEN RAISE EXCEPTION 'Die geprüfte Originalfassung wurde geändert'; END IF;
 IF p_png_path IS DISTINCT FROM 'tenant/'||p_tenant||'/portal/signatures/'||p_document||'/'||p_capture||'.png' THEN
  RAISE EXCEPTION 'Signaturpfad ist nicht gebunden'; END IF;
 SELECT * INTO o FROM storage.objects WHERE bucket_id='office-documents' AND name=p_png_path FOR SHARE;
 IF NOT FOUND OR o.owner_id IS DISTINCT FROM auth.uid()::text OR o.archived_at IS NOT NULL OR o.is_delete_marker
  OR nullif(o.version,'') IS NULL OR o.metadata->>'mimetype'<>'image/png' OR (o.metadata->>'size')::bigint<=0 THEN
  RAISE EXCEPTION 'Unverändertes Signaturobjekt fehlt'; END IF;
 SELECT count(*) INTO v_count FROM public.portal_signature_captures WHERE document_id=p_document AND signer_role=p_role;
 IF v_count>1 THEN RAISE EXCEPTION 'Unterschriftsrolle ist nicht eindeutig'; END IF;
 IF v_count=1 THEN
  SELECT * INTO c FROM public.portal_signature_captures WHERE document_id=p_document AND signer_role=p_role;
  IF c.id=p_capture AND c.tenant_id=p_tenant AND c.signer_profile_id=v_profile AND c.signer_name=btrim(p_name)
   AND c.storage_path=p_png_path AND c.signature_hash=p_png_hash AND c.payload_hash=v_hash
   AND EXISTS(SELECT 1 FROM public.portal_signature_audit_events a WHERE a.id=c.audit_id
    AND a.document_id=p_document AND a.tenant_id=p_tenant AND a.actor_user_id=v_profile
    AND a.metadata_json->>'contract'='personal-capture-v1' AND a.metadata_json->>'objectId'=o.id::text
    AND a.metadata_json->>'objectVersion'=o.version) THEN
   RETURN jsonb_build_object('contract','personal-capture-v1','documentId',p_document,'captureId',p_capture,'status',d.status,'replayed',true);
  END IF;
  RAISE EXCEPTION 'Andere oder nicht verifizierte Unterschrift ist bereits vorhanden';
 END IF;
 IF d.status NOT IN ('open','in_progress','partially_signed') OR d.is_immutable OR d.next_signer_role IS DISTINCT FROM p_role THEN
  RAISE EXCEPTION 'Dokument ist nicht für diese Rolle offen'; END IF;
 INSERT INTO public.portal_signature_audit_events(id,tenant_id,document_id,actor_user_id,actor_name,event_type,summary,metadata_json)
  VALUES(p_capture,p_tenant,p_document,v_profile,btrim(p_name),'signature_captured','Originalgebundene Unterschrift',
   jsonb_build_object('contract','personal-capture-v1','actorAuthUserId',auth.uid(),'version',p_version,'contentHash',v_hash,'objectId',o.id,'objectVersion',o.version));
 INSERT INTO public.portal_signature_captures(id,tenant_id,document_id,signer_role,signer_name,signer_profile_id,storage_path,signature_hash,payload_hash,signed_at,audit_id)
  VALUES(p_capture,p_tenant,p_document,p_role,btrim(p_name),v_profile,p_png_path,p_png_hash,v_hash,v_now,p_capture);
 d.employee_signed:=d.employee_signed OR p_role='employee';d.client_signed:=d.client_signed OR p_role='client';
 v_all:=(d.signature_requirement='employee' AND d.employee_signed) OR (d.signature_requirement='client' AND d.client_signed)
  OR (d.signature_requirement='both_sequential' AND d.employee_signed AND d.client_signed);
 UPDATE public.portal_signature_documents SET employee_signed=d.employee_signed,client_signed=d.client_signed,
  status=CASE WHEN v_all THEN 'fully_signed' ELSE 'partially_signed' END,
  next_signer_role=CASE WHEN v_all THEN NULL WHEN NOT d.employee_signed THEN 'employee' ELSE 'client' END,updated_at=v_now
  WHERE id=p_document AND tenant_id=p_tenant;
 RETURN jsonb_build_object('contract','personal-capture-v1','documentId',p_document,'captureId',p_capture,
  'actorProfileId',v_profile,'status',CASE WHEN v_all THEN 'fully_signed' ELSE 'partially_signed' END,'replayed',false);
END $$;
REVOKE ALL ON FUNCTION public.workflow_capture_personal_signature(uuid,uuid,uuid,text,text,integer,text,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.workflow_capture_personal_signature(uuid,uuid,uuid,text,text,integer,text,text,text) TO authenticated;

-- Trusted worker only. It MUST first download exact immutable original/capture
-- object versions, compose all pages and signatures, compute/verify PDF bytes,
-- upload once, and verify those uploaded bytes. Passing local bytes alone does
-- not prove Storage equality; no worker/endpoint is claimed implemented here.
CREATE OR REPLACE FUNCTION public.workflow_complete_personal_signature(
 p_tenant uuid,p_document uuid,p_version integer,p_content_hash text,p_pdf_path text,p_pdf_bytes bytea
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE d public.portal_signature_documents%ROWTYPE;o storage.objects%ROWTYPE;
 v_hash text;v_pdf_hash text;v_needed text[];v_role text;v_count integer;v_now timestamptz:=clock_timestamp();v_actor uuid;
BEGIN
 SELECT * INTO d FROM public.portal_signature_documents WHERE id=p_document AND tenant_id=p_tenant FOR UPDATE;
 IF NOT FOUND OR d.document_source_type='pdf_upload' THEN RAISE EXCEPTION 'Original-PDF-Komposition ist noch nicht freigegeben'; END IF;
 v_hash:='sha256:'||encode(sha256(convert_to(d.id::text||':'||d.version_number::text||':'||d.preview_html,'UTF8')),'hex');
 IF p_version IS NULL OR p_version<>d.version_number OR p_content_hash IS DISTINCT FROM v_hash OR p_pdf_bytes IS NULL
  OR substring(p_pdf_bytes,1,5)<>convert_to('%PDF-','UTF8') THEN RAISE EXCEPTION 'Originalversion oder echte PDF-Bytes fehlen'; END IF;
 v_pdf_hash:='sha256:'||encode(sha256(p_pdf_bytes),'hex');
 IF p_pdf_path IS DISTINCT FROM 'tenant/'||p_tenant||'/portal/signatures/'||p_document||'/versions/'||p_version||'/final-'||substring(v_pdf_hash,8)||'.pdf' THEN
  RAISE EXCEPTION 'PDF-Prüfsumme und unveränderlicher Pfad stimmen nicht überein'; END IF;
 SELECT * INTO o FROM storage.objects WHERE bucket_id='office-documents' AND name=p_pdf_path FOR SHARE;
 IF NOT FOUND OR o.archived_at IS NOT NULL OR o.is_delete_marker OR nullif(o.version,'') IS NULL
  OR o.metadata->>'mimetype' IS DISTINCT FROM 'application/pdf' OR (o.metadata->>'size')::bigint IS DISTINCT FROM octet_length(p_pdf_bytes) THEN
  RAISE EXCEPTION 'Verifiziertes PDF-Objekt fehlt'; END IF;
 IF d.status='completed' THEN
  IF d.final_storage_path=p_pdf_path AND d.final_pdf_hash=v_pdf_hash AND d.is_immutable
   AND EXISTS(SELECT 1 FROM public.portal_signature_audit_events a WHERE a.tenant_id=p_tenant AND a.document_id=p_document
    AND a.metadata_json->>'contract'='personal-completion-v1' AND a.metadata_json->>'pdfHash'=v_pdf_hash
    AND a.metadata_json->>'contentHash'=v_hash AND a.metadata_json->>'objectId'=o.id::text AND a.metadata_json->>'objectVersion'=o.version)
   AND (d.recipient_type<>'employee' OR EXISTS(SELECT 1 FROM public.employee_documents e WHERE e.id=p_document
    AND e.tenant_id=p_tenant AND e.employee_id=d.employee_id AND e.storage_path=p_pdf_path AND e.released_to_portal AND e.sensitive IS FALSE))
   AND (d.client_id IS NULL OR EXISTS(SELECT 1 FROM public.client_documents x WHERE x.id=p_document
    AND x.tenant_id=p_tenant AND x.client_id=d.client_id AND x.storage_path=p_pdf_path AND x.status='abgeschlossen')) THEN
   RETURN jsonb_build_object('contract','personal-completion-v1','documentId',p_document,'status','completed','replayed',true);
  END IF;RAISE EXCEPTION 'Anderer Abschluss ist bereits vorhanden';
 END IF;
 IF d.status<>'fully_signed' THEN RAISE EXCEPTION 'Erforderliche Unterschriften fehlen'; END IF;
 v_needed:=CASE d.signature_requirement WHEN 'employee' THEN ARRAY['employee'] WHEN 'client' THEN ARRAY['client'] ELSE ARRAY['employee','client'] END;
 FOREACH v_role IN ARRAY v_needed LOOP
  IF (SELECT count(*) FROM public.portal_signature_captures WHERE document_id=p_document AND signer_role=v_role)<>1 THEN
   RAISE EXCEPTION 'Unterschriftsrolle ist nicht eindeutig'; END IF;
  SELECT count(*) INTO v_count FROM public.portal_signature_captures c JOIN public.portal_signature_audit_events a ON a.id=c.audit_id
   JOIN storage.objects s ON s.bucket_id='office-documents' AND s.name=c.storage_path
   WHERE c.document_id=p_document AND c.tenant_id=p_tenant AND c.signer_role=v_role AND c.payload_hash=v_hash
    AND a.tenant_id=p_tenant AND a.document_id=p_document AND a.actor_user_id=c.signer_profile_id
    AND a.metadata_json->>'contract'='personal-capture-v1' AND a.metadata_json->>'objectId'=s.id::text
    AND a.metadata_json->>'objectVersion'=s.version AND s.archived_at IS NULL AND NOT s.is_delete_marker;
  IF v_count<>1 THEN RAISE EXCEPTION 'Originalgebundene Rollenquittung fehlt'; END IF;
 END LOOP;
 SELECT signer_profile_id INTO v_actor FROM public.portal_signature_captures WHERE document_id=p_document ORDER BY signed_at DESC LIMIT 1;
 IF d.recipient_type='employee' THEN
  INSERT INTO public.employee_documents(id,tenant_id,employee_id,title,category,file_name,storage_path,sensitive,released_to_portal)
   VALUES(p_document,p_tenant,d.employee_id,d.title,d.document_type,d.title||'.pdf',p_pdf_path,false,true);
 END IF;
 IF d.client_id IS NOT NULL THEN
  INSERT INTO public.client_documents(id,tenant_id,client_id,title,file_name,mime_type,storage_path,category,status,sensitivity,portal_visible,uploaded_by)
   VALUES(p_document,p_tenant,d.client_id,d.title,d.title||'.pdf','application/pdf',p_pdf_path,
    CASE WHEN d.document_type IN ('arbeitsvertrag','zusatzvereinbarung') THEN 'vertrag' WHEN d.document_type IN ('einwilligung','datenschutz') THEN 'einwilligung' WHEN d.document_type='pflegeunterlage' THEN 'pflegeplan' ELSE 'sonstige' END,
    'abgeschlossen','care',true,v_actor);
 END IF;
 INSERT INTO public.portal_signature_audit_events(tenant_id,document_id,actor_user_id,event_type,summary,metadata_json)
  VALUES(p_tenant,p_document,v_actor,'document_completed','Original und Archiv atomar abgeschlossen',jsonb_build_object('contract','personal-completion-v1','pdfHash',v_pdf_hash,'contentHash',v_hash,'objectId',o.id,'objectVersion',o.version));
 UPDATE public.portal_signature_documents SET status='completed',is_immutable=true,final_storage_path=p_pdf_path,
  final_pdf_hash=v_pdf_hash,completed_at=v_now,updated_at=v_now,next_signer_role=NULL WHERE id=p_document AND tenant_id=p_tenant;
 RETURN jsonb_build_object('contract','personal-completion-v1','documentId',p_document,'status','completed','replayed',false);
END $$;
REVOKE ALL ON FUNCTION public.workflow_complete_personal_signature(uuid,uuid,integer,text,text,bytea) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.workflow_complete_personal_signature(uuid,uuid,integer,text,text,bytea) TO service_role;
DROP POLICY IF EXISTS workflow_personal_capture_insert_ceiling ON public.portal_signature_captures;
CREATE POLICY workflow_personal_capture_insert_ceiling ON public.portal_signature_captures AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK(false);
DROP POLICY IF EXISTS workflow_personal_capture_update_ceiling ON public.portal_signature_captures;
CREATE POLICY workflow_personal_capture_update_ceiling ON public.portal_signature_captures AS RESTRICTIVE FOR UPDATE TO authenticated USING(false) WITH CHECK(false);
DROP POLICY IF EXISTS workflow_personal_capture_delete_ceiling ON public.portal_signature_captures;
CREATE POLICY workflow_personal_capture_delete_ceiling ON public.portal_signature_captures AS RESTRICTIVE FOR DELETE TO authenticated USING(false);
DROP POLICY IF EXISTS workflow_personal_document_update_ceiling ON public.portal_signature_documents;
CREATE POLICY workflow_personal_document_update_ceiling ON public.portal_signature_documents AS RESTRICTIVE FOR UPDATE TO authenticated USING(false) WITH CHECK(false);
DROP POLICY IF EXISTS workflow_personal_document_delete_ceiling ON public.portal_signature_documents;
CREATE POLICY workflow_personal_document_delete_ceiling ON public.portal_signature_documents AS RESTRICTIVE FOR DELETE TO authenticated USING(false);
DROP POLICY IF EXISTS workflow_personal_document_insert_ceiling ON public.portal_signature_documents;
CREATE POLICY workflow_personal_document_insert_ceiling ON public.portal_signature_documents AS RESTRICTIVE FOR INSERT TO authenticated
 WITH CHECK(tenant_id=public.current_tenant_id() AND public.is_internal_tenant_actor(tenant_id)
  AND public.has_permission('office.documents.signatures.manage') AND status IN ('new','open')
  AND employee_signed IS FALSE AND client_signed IS FALSE AND is_immutable IS FALSE AND final_storage_path IS NULL
  AND final_pdf_hash IS NULL AND completed_at IS NULL);
DROP POLICY IF EXISTS workflow_personal_audit_insert_ceiling ON public.portal_signature_audit_events;
DROP POLICY IF EXISTS workflow_personal_audit_update_ceiling ON public.portal_signature_audit_events;
DROP POLICY IF EXISTS workflow_personal_audit_delete_ceiling ON public.portal_signature_audit_events;
CREATE POLICY workflow_personal_audit_insert_ceiling ON public.portal_signature_audit_events AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK(false);
CREATE POLICY workflow_personal_audit_update_ceiling ON public.portal_signature_audit_events AS RESTRICTIVE FOR UPDATE TO authenticated USING(false) WITH CHECK(false);
CREATE POLICY workflow_personal_audit_delete_ceiling ON public.portal_signature_audit_events AS RESTRICTIVE FOR DELETE TO authenticated USING(false);
COMMIT;
