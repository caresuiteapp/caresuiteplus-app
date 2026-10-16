-- Document settings writes and portal upload review use verified Office authority.
-- No existing customer rows are changed by this migration.
BEGIN;

ALTER TABLE public.tenant_document_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS document_settings_insert_ceiling ON public.tenant_document_settings;
CREATE POLICY document_settings_insert_ceiling ON public.tenant_document_settings AS RESTRICTIVE
  FOR INSERT TO authenticated WITH CHECK(care_security.company_actor(tenant_id,'office.catalogs.edit'));
DROP POLICY IF EXISTS document_settings_update_ceiling ON public.tenant_document_settings;
CREATE POLICY document_settings_update_ceiling ON public.tenant_document_settings AS RESTRICTIVE
  FOR UPDATE TO authenticated USING(care_security.company_actor(tenant_id,'office.catalogs.edit'))
  WITH CHECK(care_security.company_actor(tenant_id,'office.catalogs.edit'));
DROP POLICY IF EXISTS document_settings_delete_ceiling ON public.tenant_document_settings;
CREATE POLICY document_settings_delete_ceiling ON public.tenant_document_settings AS RESTRICTIVE
  FOR DELETE TO authenticated USING(care_security.company_actor(tenant_id,'office.catalogs.edit'));

CREATE OR REPLACE FUNCTION care_security.office_review_portal_upload(
  p_tenant_id uuid,p_upload_id uuid,p_decision text,p_review_note text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $body$
DECLARE
  v_actor uuid;
  v_upload public.portal_uploads%ROWTYPE;
  v_client_document public.client_documents%ROWTYPE;
  v_employee_document public.employee_documents%ROWTYPE;
  v_employee boolean;
  v_status text;
  v_target uuid;
  v_path_prefix text;
  v_category text;
  v_title text;
  v_now timestamptz:=clock_timestamp();
BEGIN
  v_actor:=care_security.company_profile(p_tenant_id);
  IF auth.uid() IS NULL OR v_actor IS NULL
    OR NOT coalesce(care_security.company_actor(p_tenant_id,'office.documents.view'),false) THEN
    RAISE EXCEPTION 'Keine Berechtigung für diesen Dokumenteneingang.' USING ERRCODE='42501';
  END IF;
  IF p_upload_id IS NULL OR p_decision IS NULL OR p_decision NOT IN ('approve','reject')
    OR length(coalesce(p_review_note,''))>1000 THEN
    RAISE EXCEPTION 'Ungültige Entscheidung.' USING ERRCODE='22023';
  END IF;
  IF p_decision='reject' AND nullif(btrim(p_review_note),'') IS NULL THEN
    RAISE EXCEPTION 'Bitte einen Grund für die Ablehnung angeben.' USING ERRCODE='22023';
  END IF;

  -- The row lock serializes conflicting decisions and retries before any target write.
  SELECT * INTO v_upload FROM public.portal_uploads
    WHERE id=p_upload_id AND tenant_id=p_tenant_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Der Eingang wurde nicht gefunden.' USING ERRCODE='42501'; END IF;
  v_employee:=v_upload.upload_context='mitarbeiter';
  IF v_employee AND (v_upload.employee_id IS NULL OR v_upload.client_id IS NOT NULL)
    OR NOT v_employee AND (v_upload.upload_context<>'klient' OR v_upload.client_id IS NULL) THEN
    RAISE EXCEPTION 'Die Aktenzuordnung ist nicht eindeutig.' USING ERRCODE='23514';
  END IF;
  IF NOT coalesce(care_security.company_actor(p_tenant_id,
    CASE WHEN v_employee THEN 'office.employees.edit' ELSE 'office.clients.edit' END),false) THEN
    RAISE EXCEPTION 'Keine Berechtigung zur Bearbeitung dieser Akte.' USING ERRCODE='42501';
  END IF;
  v_status:=CASE WHEN p_decision='approve' THEN 'freigegeben' ELSE 'abgelehnt' END;
  IF v_upload.status::text IN ('freigegeben','abgelehnt') THEN
    IF v_upload.status::text<>v_status THEN
      RAISE EXCEPTION 'Dieser Eingang wurde bereits mit einer anderen Entscheidung bearbeitet.' USING ERRCODE='40001';
    END IF;
    IF p_decision='approve' THEN
      IF v_employee THEN
        SELECT * INTO v_employee_document FROM public.employee_documents
          WHERE id=p_upload_id AND tenant_id=p_tenant_id AND employee_id=v_upload.employee_id
            AND storage_path=v_upload.storage_path;
        v_target:=v_employee_document.id;
      ELSE
        SELECT * INTO v_client_document FROM public.client_documents
          WHERE id=v_upload.client_document_id AND tenant_id=p_tenant_id AND client_id=v_upload.client_id;
        v_target:=v_client_document.id;
      END IF;
      IF v_target IS NULL THEN RAISE EXCEPTION 'Die zugehörige Akte konnte nicht bestätigt werden.' USING ERRCODE='23514'; END IF;
    END IF;
    RETURN jsonb_build_object('id',p_upload_id,'status',v_status,'target_document_id',v_target,
      'target_kind',CASE WHEN v_employee THEN 'employee' ELSE 'client' END,'replayed',true);
  END IF;
  IF v_upload.status::text NOT IN ('hochgeladen','wird_geprueft') THEN
    RAISE EXCEPTION 'Der Eingang kann in diesem Status nicht bearbeitet werden.' USING ERRCODE='40001';
  END IF;

  IF v_upload.portal_request_id IS NOT NULL THEN
    PERFORM 1 FROM public.portal_requests r WHERE r.id=v_upload.portal_request_id
      AND r.tenant_id=p_tenant_id AND r.client_id IS NOT DISTINCT FROM v_upload.client_id
      AND r.request_type::text='upload'
      AND (r.payload->>'uploadId' IS NULL OR r.payload->>'uploadId'=p_upload_id::text) FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Die verknüpfte Anfrage gehört nicht zu diesem Eingang.' USING ERRCODE='23514'; END IF;
  END IF;

  IF p_decision='approve' THEN
    IF v_employee THEN
      PERFORM 1 FROM public.employees WHERE id=v_upload.employee_id AND tenant_id=p_tenant_id FOR KEY SHARE;
      v_path_prefix:='tenant/'||p_tenant_id::text||'/employees/'||v_upload.employee_id::text||'/portal-uploads/'||p_upload_id::text||'/';
    ELSE
      PERFORM 1 FROM public.clients WHERE id=v_upload.client_id AND tenant_id=p_tenant_id FOR KEY SHARE;
      v_path_prefix:='tenant/'||p_tenant_id::text||'/clients/'||v_upload.client_id::text||'/portal-uploads/'||p_upload_id::text||'/';
    END IF;
    IF NOT FOUND THEN RAISE EXCEPTION 'Die Zielakte gehört nicht zu diesem Unternehmen.' USING ERRCODE='23514'; END IF;
    IF v_upload.storage_path NOT LIKE v_path_prefix||'%'
      OR substring(v_upload.storage_path FROM length(v_path_prefix)+1) !~ ('^'||p_upload_id::text||'\.[a-zA-Z0-9]{1,10}$') THEN
      RAISE EXCEPTION 'Die Originaldatei ist diesem Eingang nicht eindeutig zugeordnet.' USING ERRCODE='23514';
    END IF;
    PERFORM 1 FROM storage.objects WHERE bucket_id='office-documents' AND name=v_upload.storage_path FOR SHARE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Die eingereichte Originaldatei ist nicht verfügbar.' USING ERRCODE='23514'; END IF;
    v_title:=coalesce(nullif(btrim(regexp_replace(v_upload.file_name,'\.[^.]+$','')),''),v_upload.file_name);
    v_target:=p_upload_id;
    IF v_employee THEN
      SELECT * INTO v_employee_document FROM public.employee_documents WHERE id=v_target FOR UPDATE;
      IF FOUND THEN
        IF v_employee_document.tenant_id IS DISTINCT FROM p_tenant_id OR v_employee_document.employee_id IS DISTINCT FROM v_upload.employee_id
          OR v_employee_document.storage_path IS DISTINCT FROM v_upload.storage_path THEN
          RAISE EXCEPTION 'Die Personalaktenzuordnung ist nicht eindeutig.' USING ERRCODE='23514';
        END IF;
      ELSE
        INSERT INTO public.employee_documents(id,tenant_id,employee_id,title,category,file_name,storage_path,sensitive,released_to_portal)
          VALUES(v_target,p_tenant_id,v_upload.employee_id,v_title,coalesce(nullif(btrim(v_upload.category),''),'other'),
            v_upload.file_name,v_upload.storage_path,false,true);
      END IF;
    ELSE
      v_category:=CASE WHEN v_upload.category=ANY(ARRAY['vertrag','pflegeplan','arztbrief','md_gutachten','einwilligung','sonstige',
        'datenschutz','vollmacht','betreuerausweis','pflegegradbescheid','kassenbescheid','rezept','verordnung','ueberweisung',
        'medikationsplan','leistungsnachweis','rechnung','mahnung','beratungsprotokoll','pflegebericht','vitalwerte','wunddokumentation',
        'foto','scan','ausweis','schluesselprotokoll','sonstiges']) THEN v_upload.category ELSE 'sonstige' END;
      SELECT * INTO v_client_document FROM public.client_documents WHERE id=v_target FOR UPDATE;
      IF FOUND THEN
        IF v_client_document.tenant_id IS DISTINCT FROM p_tenant_id OR v_client_document.client_id IS DISTINCT FROM v_upload.client_id
          OR v_client_document.storage_path IS DISTINCT FROM v_upload.storage_path THEN
          RAISE EXCEPTION 'Die Klientenaktenzuordnung ist nicht eindeutig.' USING ERRCODE='23514';
        END IF;
      ELSE
        INSERT INTO public.client_documents(id,tenant_id,client_id,title,file_name,mime_type,category,storage_path,size_bytes,
          uploaded_by,status,sensitivity,source,portal_visible)
          VALUES(v_target,p_tenant_id,v_upload.client_id,v_title,v_upload.file_name,v_upload.mime_type,v_category,
            v_upload.storage_path,v_upload.size_bytes,v_actor,'aktiv','care','upload',true);
      END IF;
    END IF;
  END IF;

  UPDATE public.portal_uploads SET
    status=CASE WHEN p_decision='approve' THEN 'freigegeben'::public.portal_upload_status ELSE 'abgelehnt'::public.portal_upload_status END,
    reviewed_by=v_actor,reviewed_at=v_now,review_note=CASE WHEN p_decision='reject' THEN btrim(p_review_note) ELSE 'Akte: '||v_target::text END,
    client_document_id=CASE WHEN NOT v_employee AND p_decision='approve' THEN v_target ELSE NULL END,updated_at=v_now
    WHERE id=p_upload_id AND tenant_id=p_tenant_id;
  IF v_upload.portal_request_id IS NOT NULL THEN
    UPDATE public.portal_requests SET
      status=CASE WHEN p_decision='approve' THEN 'erledigt'::public.portal_request_status ELSE 'abgelehnt'::public.portal_request_status END,
      updated_at=v_now WHERE id=v_upload.portal_request_id AND tenant_id=p_tenant_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Die Anfrage konnte nicht abgeschlossen werden.' USING ERRCODE='23514'; END IF;
  END IF;
  RETURN jsonb_build_object('id',p_upload_id,'status',v_status,'target_document_id',v_target,
    'target_kind',CASE WHEN v_employee THEN 'employee' ELSE 'client' END,'replayed',false);
END $body$;

REVOKE ALL ON FUNCTION care_security.office_review_portal_upload(uuid,uuid,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION care_security.office_review_portal_upload(uuid,uuid,text,text) TO authenticated;
CREATE OR REPLACE FUNCTION public.office_review_portal_upload(
  p_tenant_id uuid,p_upload_id uuid,p_decision text,p_review_note text DEFAULT NULL
) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path=pg_catalog AS $body$
  SELECT care_security.office_review_portal_upload(p_tenant_id,p_upload_id,p_decision,p_review_note)
$body$;
REVOKE ALL ON FUNCTION public.office_review_portal_upload(uuid,uuid,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.office_review_portal_upload(uuid,uuid,text,text) TO authenticated;
COMMIT;
