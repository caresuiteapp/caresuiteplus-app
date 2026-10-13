-- LOCAL REVIEW DRAFT, NOT APPLIED. Requires workflow_current_verified_profile.
-- Immutable assets are uploaded first. This transaction binds their verified
-- Storage metadata to one UUID, one profile, one request and one portal upload.
-- No cross-service transaction with the byte upload is claimed; failed uploads
-- and unregistered objects require a separately reviewed orphan retention job.
-- Employee-to-client upload is deliberately refused until a current assignment
-- access contract is supplied. A historical visit is not such a contract.
BEGIN;
CREATE OR REPLACE FUNCTION public.workflow_register_portal_upload(
  p_tenant_id uuid,p_upload_id uuid,p_context text,p_employee_id uuid,p_client_id uuid,
  p_storage_path text,p_file_name text,p_mime_type text,p_size_bytes bigint,
  p_category text,p_message text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog
AS $$
DECLARE v_profile uuid:=public.workflow_current_verified_profile(p_tenant_id);
  v_object storage.objects%ROWTYPE;v_existing public.portal_uploads%ROWTYPE;
  v_prefix text;v_request_id uuid;v_employee uuid;v_client uuid;
BEGIN
  IF p_upload_id IS NULL OR p_context IS NULL OR p_context NOT IN ('mitarbeiter','klient')
    OR nullif(btrim(p_file_name),'') IS NULL OR nullif(btrim(p_mime_type),'') IS NULL
    OR p_size_bytes IS NULL OR p_size_bytes<=0 OR p_storage_path IS NULL
    OR p_storage_path ~ '(\.\.|[\\%?#])' THEN RAISE EXCEPTION 'Uploaddaten sind unvollständig'; END IF;
  IF public.is_client_portal_rls_context(p_tenant_id) THEN
    IF p_context<>'klient' OR p_employee_id IS NOT NULL OR p_client_id IS DISTINCT FROM public.current_client_id()
      OR p_client_id IS NULL THEN RAISE EXCEPTION 'Fremde Uploadzuordnung' USING ERRCODE='42501'; END IF;
    v_client:=p_client_id;
  ELSIF public.is_employee_portal_rls_context(p_tenant_id)
    OR (public.current_role_key() IN ('caregiver','nurse') AND public.is_internal_tenant_actor(p_tenant_id)) THEN
    IF p_context<>'mitarbeiter' OR p_client_id IS NOT NULL OR p_employee_id IS NULL
      OR p_employee_id IS DISTINCT FROM public.resolve_current_employee_id() THEN
      RAISE EXCEPTION 'Klienten-Upload benötigt einen verifizierten aktuellen Zugriffsvertrag; eigene Personalunterlagen sind möglich' USING ERRCODE='42501';
    END IF;
    v_employee:=p_employee_id;
  ELSIF public.is_internal_tenant_actor(p_tenant_id) AND public.has_permission('office.documents.upload') THEN
    IF p_context='klient' AND p_client_id IS NOT NULL AND p_employee_id IS NULL THEN
      PERFORM 1 FROM public.clients WHERE id=p_client_id AND tenant_id=p_tenant_id;
      IF NOT FOUND THEN RAISE EXCEPTION 'Klientenzuordnung fehlt' USING ERRCODE='42501'; END IF;
      v_client:=p_client_id;
    ELSIF p_context='mitarbeiter' AND p_employee_id IS NOT NULL AND p_client_id IS NULL
      AND public.has_permission('office.employees.edit') THEN
      PERFORM 1 FROM public.employees WHERE id=p_employee_id AND tenant_id=p_tenant_id;
      IF NOT FOUND THEN RAISE EXCEPTION 'Mitarbeitendenzuordnung fehlt' USING ERRCODE='42501'; END IF;
      v_employee:=p_employee_id;
    ELSE RAISE EXCEPTION 'Uploadzuordnung ist nicht eindeutig' USING ERRCODE='42501'; END IF;
  ELSE RAISE EXCEPTION 'Upload nicht berechtigt' USING ERRCODE='42501'; END IF;
  v_prefix:='tenant/'||p_tenant_id||'/'||CASE WHEN p_context='mitarbeiter' THEN 'employees/'||v_employee ELSE 'clients/'||v_client END||'/portal-uploads/'||p_upload_id||'/';
  IF left(p_storage_path,length(v_prefix))<>v_prefix OR substring(p_storage_path,length(v_prefix)+1) LIKE '%/%'
    OR substring(p_storage_path,length(v_prefix)+1)='' THEN RAISE EXCEPTION 'Dateipfad gehört nicht zu diesem Upload'; END IF;
  -- Serialize registration and review using the same per-upload advisory lock.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_tenant_id::text||':'||p_upload_id::text,0));
  SELECT * INTO v_object FROM storage.objects WHERE bucket_id='office-documents' AND name=p_storage_path FOR SHARE;
  IF NOT FOUND OR v_object.owner_id IS DISTINCT FROM auth.uid()::text OR v_object.archived_at IS NOT NULL
    OR v_object.is_delete_marker OR nullif(v_object.version,'') IS NULL
    OR v_object.metadata->>'mimetype' IS DISTINCT FROM p_mime_type
    OR (v_object.metadata->>'size')::bigint IS DISTINCT FROM p_size_bytes THEN
    RAISE EXCEPTION 'Datei, Eigentümer oder bestätigte Objektversion fehlt';
  END IF;
  SELECT * INTO v_existing FROM public.portal_uploads WHERE id=p_upload_id FOR UPDATE;
  IF FOUND THEN
    IF v_existing.tenant_id IS DISTINCT FROM p_tenant_id OR v_existing.employee_id IS DISTINCT FROM v_employee
      OR v_existing.client_id IS DISTINCT FROM v_client OR v_existing.portal_user_id IS DISTINCT FROM v_profile
      OR v_existing.storage_path IS DISTINCT FROM p_storage_path OR v_existing.file_name IS DISTINCT FROM p_file_name
      OR v_existing.mime_type IS DISTINCT FROM p_mime_type OR v_existing.size_bytes IS DISTINCT FROM p_size_bytes
      OR v_existing.category IS DISTINCT FROM nullif(btrim(p_category),'')
      OR v_existing.message IS DISTINCT FROM nullif(btrim(p_message),'') THEN
      RAISE EXCEPTION 'Upload-ID gehört zu einer anderen Einreichung';
    END IF;
    IF v_client IS NOT NULL THEN
      PERFORM 1 FROM public.portal_requests r WHERE r.id=v_existing.portal_request_id
        AND r.tenant_id=p_tenant_id AND r.client_id=v_client AND r.portal_user_id=v_profile
        AND r.request_type='upload' AND r.payload->>'uploadId'=p_upload_id::text
        AND r.payload->>'objectId'=v_object.id::text AND r.payload->>'objectVersion'=v_object.version;
      IF NOT FOUND THEN RAISE EXCEPTION 'Anfrage oder ursprüngliche Objektversion wurde nicht bestätigt'; END IF;
    ELSIF v_existing.portal_request_id IS NOT NULL THEN RAISE EXCEPTION 'Unerwartete Anfragenverknüpfung'; END IF;
    RETURN jsonb_build_object('contract','portal-upload-v1','uploadId',p_upload_id,'requestId',v_existing.portal_request_id,
      'actorProfileId',v_profile,'objectId',v_object.id,'objectVersion',v_object.version,'status',v_existing.status,'replayed',true);
  END IF;
  IF v_client IS NOT NULL THEN
    v_request_id:=p_upload_id;
    INSERT INTO public.portal_requests(id,tenant_id,client_id,portal_user_id,module_key,request_type,status,title,description,payload)
      VALUES(v_request_id,p_tenant_id,v_client,v_profile,'assist','upload','offen','Dokument: '||p_file_name,
        nullif(btrim(p_message),''),jsonb_build_object('uploadId',p_upload_id,'objectId',v_object.id,'objectVersion',v_object.version));
  END IF;
  INSERT INTO public.portal_uploads(id,tenant_id,employee_id,client_id,portal_user_id,portal_request_id,
    upload_context,storage_path,file_name,mime_type,size_bytes,category,message,status)
    VALUES(p_upload_id,p_tenant_id,v_employee,v_client,v_profile,v_request_id,p_context,p_storage_path,p_file_name,p_mime_type,
      p_size_bytes,nullif(btrim(p_category),''),nullif(btrim(p_message),''),'hochgeladen');
  RETURN jsonb_build_object('contract','portal-upload-v1','uploadId',p_upload_id,'requestId',v_request_id,
    'actorProfileId',v_profile,'objectId',v_object.id,'objectVersion',v_object.version,'status','hochgeladen','replayed',false);
END $$;
REVOKE ALL ON FUNCTION public.workflow_register_portal_upload(uuid,uuid,text,uuid,uuid,text,text,text,bigint,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.workflow_register_portal_upload(uuid,uuid,text,uuid,uuid,text,text,text,bigint,text,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.workflow_review_portal_upload(
  p_tenant_id uuid,p_upload_id uuid,p_expected_updated_at timestamptz,
  p_decision text,p_title text,p_category text,p_note text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog
AS $$
DECLARE v_profile uuid:=public.workflow_current_verified_profile(p_tenant_id);
  v_upload public.portal_uploads%ROWTYPE;v_object storage.objects%ROWTYPE;
  v_title text;v_category text;v_now timestamptz:=clock_timestamp();v_doc_id uuid;
BEGIN
  IF NOT public.is_internal_tenant_actor(p_tenant_id) OR p_expected_updated_at IS NULL
    OR p_decision IS NULL OR p_decision NOT IN ('approve','reject') THEN
    RAISE EXCEPTION 'Entscheidung nicht berechtigt' USING ERRCODE='42501'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_tenant_id::text||':'||p_upload_id::text,0));
  SELECT * INTO v_upload FROM public.portal_uploads WHERE id=p_upload_id AND tenant_id=p_tenant_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Upload nicht gefunden' USING ERRCODE='42501'; END IF;
  IF (v_upload.upload_context='mitarbeiter' AND NOT public.has_permission('office.employees.edit'))
    OR (v_upload.upload_context='klient' AND NOT public.has_permission('office.documents.upload')) THEN
    RAISE EXCEPTION 'Berechtigung für dieses Ziel fehlt' USING ERRCODE='42501'; END IF;
  v_title:=coalesce(nullif(btrim(p_title),''),v_upload.file_name);
  v_category:=coalesce(nullif(btrim(p_category),''),v_upload.category,CASE WHEN v_upload.upload_context='mitarbeiter' THEN 'other' ELSE 'sonstige' END);
  IF v_upload.status IN ('freigegeben','abgelehnt') THEN
    IF v_upload.reviewed_by IS DISTINCT FROM v_profile OR
      (p_decision='approve' AND v_upload.status<>'freigegeben') OR (p_decision='reject' AND v_upload.status<>'abgelehnt') THEN
      RAISE EXCEPTION 'Dieser Upload wurde mit einer anderen Entscheidung bearbeitet'; END IF;
    IF p_decision='approve' THEN
      IF v_upload.upload_context='mitarbeiter' THEN
        PERFORM 1 FROM public.employee_documents WHERE id=p_upload_id AND tenant_id=p_tenant_id
          AND employee_id=v_upload.employee_id AND storage_path=v_upload.storage_path AND title=v_title AND category=v_category;
      ELSE
        PERFORM 1 FROM public.client_documents WHERE id=v_upload.client_document_id AND tenant_id=p_tenant_id
          AND client_id=v_upload.client_id AND storage_path=v_upload.storage_path AND title=v_title AND category=v_category;
      END IF;
      IF NOT FOUND THEN RAISE EXCEPTION 'Archivquittung passt nicht zur wiederholten Entscheidung'; END IF;
    ELSIF v_upload.review_note IS DISTINCT FROM nullif(btrim(p_note),'') THEN
      RAISE EXCEPTION 'Ablehnungsgrund gehört zu einer anderen Entscheidung';
    END IF;
    RETURN jsonb_build_object('contract','portal-review-v1','uploadId',p_upload_id,'documentId',CASE WHEN v_upload.upload_context='mitarbeiter' AND p_decision='approve' THEN p_upload_id ELSE v_upload.client_document_id END,'status',v_upload.status,'replayed',true);
  END IF;
  IF v_upload.status NOT IN ('hochgeladen','wird_geprueft') OR v_upload.updated_at IS DISTINCT FROM p_expected_updated_at THEN
    RAISE EXCEPTION 'Upload wurde geändert. Bitte neu laden'; END IF;
  SELECT * INTO v_object FROM storage.objects WHERE bucket_id='office-documents' AND name=v_upload.storage_path FOR SHARE;
  IF NOT FOUND OR v_object.archived_at IS NOT NULL OR v_object.is_delete_marker
    OR nullif(v_object.version,'') IS NULL OR v_object.metadata->>'mimetype' IS DISTINCT FROM v_upload.mime_type
    OR (v_object.metadata->>'size')::bigint IS DISTINCT FROM v_upload.size_bytes
    OR NOT EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=v_upload.portal_user_id
      AND p.tenant_id=p_tenant_id AND v_object.owner_id=coalesce(p.auth_user_id,p.id)::text) THEN
    RAISE EXCEPTION 'Unveränderte Originaldatei oder ursprünglicher Einreichender fehlt'; END IF;
  IF v_upload.portal_request_id IS NOT NULL THEN
    PERFORM 1 FROM public.portal_requests r WHERE r.id=v_upload.portal_request_id
      AND r.tenant_id=p_tenant_id AND r.client_id=v_upload.client_id AND r.portal_user_id=v_upload.portal_user_id
      AND r.request_type='upload' AND r.payload->>'uploadId'=p_upload_id::text
      AND r.payload->>'objectId'=v_object.id::text AND r.payload->>'objectVersion'=v_object.version FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Originalquittung der Anfrage fehlt; Legacy-Daten benötigen eine verifizierte Migration'; END IF;
  END IF;
  IF p_decision='approve' THEN
    v_doc_id:=p_upload_id;
    IF v_upload.upload_context='mitarbeiter' THEN
      IF v_upload.employee_id IS NULL OR v_upload.client_id IS NOT NULL OR lower(v_category) IN ('background_check','warning','termination','confidentiality') THEN
        RAISE EXCEPTION 'Sensible oder uneindeutige Unterlage darf nicht ungeprüft freigegeben werden'; END IF;
      INSERT INTO public.employee_documents(id,tenant_id,employee_id,title,category,file_name,storage_path,sensitive,released_to_portal)
        VALUES(v_doc_id,p_tenant_id,v_upload.employee_id,v_title,v_category,v_upload.file_name,v_upload.storage_path,false,true);
    ELSE
      IF v_upload.client_id IS NULL THEN RAISE EXCEPTION 'Klientenzuordnung fehlt'; END IF;
      INSERT INTO public.client_documents(id,tenant_id,client_id,title,category,file_name,mime_type,storage_path,portal_visible,status,sensitivity,source,uploaded_by)
        VALUES(v_doc_id,p_tenant_id,v_upload.client_id,v_title,v_category,v_upload.file_name,v_upload.mime_type,v_upload.storage_path,true,'aktiv','care','portal_upload',v_profile);
    END IF;
  END IF;
  UPDATE public.portal_uploads SET status=CASE WHEN p_decision='approve' THEN 'freigegeben'::public.portal_upload_status ELSE 'abgelehnt'::public.portal_upload_status END,
    reviewed_by=v_profile,reviewed_at=v_now,review_note=CASE WHEN p_decision='approve' THEN 'Archiv: '||v_doc_id ELSE nullif(btrim(p_note),'') END,
    client_document_id=CASE WHEN v_upload.upload_context='klient' THEN v_doc_id ELSE NULL END,updated_at=v_now
    WHERE id=p_upload_id AND tenant_id=p_tenant_id;
  IF v_upload.portal_request_id IS NOT NULL THEN
    UPDATE public.portal_requests SET status=CASE WHEN p_decision='approve' THEN 'erledigt'::public.portal_request_status ELSE 'abgelehnt'::public.portal_request_status END,updated_at=v_now
      WHERE id=v_upload.portal_request_id AND tenant_id=p_tenant_id AND client_id=v_upload.client_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Verknüpfte Anfrage wurde nicht bestätigt'; END IF;
  END IF;
  RETURN jsonb_build_object('contract','portal-review-v1','uploadId',p_upload_id,'documentId',v_doc_id,
    'status',CASE WHEN p_decision='approve' THEN 'freigegeben' ELSE 'abgelehnt' END,'replayed',false);
END $$;
REVOKE ALL ON FUNCTION public.workflow_review_portal_upload(uuid,uuid,timestamptz,text,text,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.workflow_review_portal_upload(uuid,uuid,timestamptz,text,text,text,text) TO authenticated;
-- Direct App INSERT/UPDATE fallbacks must be retired before applying these ceilings.
DROP POLICY IF EXISTS workflow_portal_upload_insert_ceiling ON public.portal_uploads;
CREATE POLICY workflow_portal_upload_insert_ceiling ON public.portal_uploads AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK(false);
DROP POLICY IF EXISTS workflow_portal_upload_update_ceiling ON public.portal_uploads;
CREATE POLICY workflow_portal_upload_update_ceiling ON public.portal_uploads AS RESTRICTIVE FOR UPDATE TO authenticated USING(false) WITH CHECK(false);
DROP POLICY IF EXISTS workflow_portal_upload_delete_ceiling ON public.portal_uploads;
CREATE POLICY workflow_portal_upload_delete_ceiling ON public.portal_uploads AS RESTRICTIVE FOR DELETE TO authenticated USING(false);
-- Protect upload receipts from alternate direct request writes; unrelated
-- request types remain governed by their existing policies, not this draft.
DROP POLICY IF EXISTS workflow_upload_request_insert_ceiling ON public.portal_requests;
CREATE POLICY workflow_upload_request_insert_ceiling ON public.portal_requests AS RESTRICTIVE FOR INSERT TO authenticated
 WITH CHECK(request_type<>'upload');
DROP POLICY IF EXISTS workflow_upload_request_update_ceiling ON public.portal_requests;
CREATE POLICY workflow_upload_request_update_ceiling ON public.portal_requests AS RESTRICTIVE FOR UPDATE TO authenticated
 USING(request_type<>'upload') WITH CHECK(request_type<>'upload');
DROP POLICY IF EXISTS workflow_upload_request_delete_ceiling ON public.portal_requests;
CREATE POLICY workflow_upload_request_delete_ceiling ON public.portal_requests AS RESTRICTIVE FOR DELETE TO authenticated
 USING(request_type<>'upload');
COMMIT;
