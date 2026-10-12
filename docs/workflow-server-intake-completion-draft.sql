-- LOCAL REVIEW DRAFT, NOT APPLIED. Dependencies: identity, verified-profile,
-- preparation/version handshake and immutable signed-intake write ceilings.
-- Completes previously prepared, locked HTML; never regenerates an original
-- from changed form data. This is Office attestation of collected onsite PNGs,
-- not a client Auth account creation or a cryptographic personal certificate.
BEGIN;
CREATE OR REPLACE FUNCTION public.workflow_complete_client_intake(
 p_tenant uuid,p_client uuid,p_expected_client_updated_at timestamptz,p_documents jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE v_profile uuid:=public.workflow_current_verified_profile(p_tenant);
 c public.clients%ROWTYPE;d public.client_intake_documents%ROWTYPE;t public.intake_document_system_templates%ROWTYPE;
 v_entry jsonb;v_sig jsonb;v_role text;v_needed text[];v_id uuid;v_hash text;v_request_hash text;
 v_now timestamptz:=clock_timestamp();v_privacy uuid;v_contract uuid;v_seen uuid[]:=ARRAY[]::uuid[];
 v_template_updated_at timestamptz;
BEGIN
 IF NOT public.is_internal_tenant_actor(p_tenant) OR NOT public.has_permission('office.clients.create')
  OR p_expected_client_updated_at IS NULL OR jsonb_typeof(p_documents) IS DISTINCT FROM 'array'
  OR jsonb_array_length(p_documents)=0 THEN RAISE EXCEPTION 'Aufnahmeabschluss ist nicht berechtigt oder vollständig' USING ERRCODE='42501'; END IF;
 v_request_hash:=encode(sha256(convert_to(p_documents::text,'UTF8')),'hex');
 SELECT * INTO c FROM public.clients WHERE id=p_client AND tenant_id=p_tenant FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Aufnahme nicht gefunden' USING ERRCODE='42501'; END IF;
 IF c.status='active' THEN
  PERFORM 1 FROM public.client_timeline_events e WHERE e.tenant_id=p_tenant AND e.client_id=p_client
   AND e.event_type='status' AND e.metadata->>'contract'='intake-completion-v1'
   AND e.metadata->>'actorProfileId'=v_profile::text AND e.metadata->>'requestHash'=v_request_hash
   AND e.metadata->>'reviewedClientUpdatedAt'=p_expected_client_updated_at::text;
  IF NOT FOUND THEN RAISE EXCEPTION 'Aktive Aufnahme gehört zu einem anderen oder unverifizierten Abschluss'; END IF;
  FOR v_entry IN SELECT value FROM jsonb_array_elements(p_documents) LOOP
   PERFORM 1 FROM public.client_intake_documents x JOIN public.client_documents a ON a.intake_document_id=x.id
    JOIN public.client_document_events e ON e.document_id=x.id
    WHERE x.id=(v_entry->>'documentId')::uuid AND x.tenant_id=p_tenant AND x.client_id=p_client AND x.status='finalized'
     AND x.version=(v_entry->>'version')::integer AND x.finalized_html=x.preview_html
     AND v_entry->>'contentHash'='sha256:'||encode(sha256(convert_to(x.finalized_html,'UTF8')),'hex')
     AND a.tenant_id=p_tenant AND a.client_id=p_client AND a.status='abgeschlossen' AND a.source='intake'
     AND e.metadata_json->>'contract'='intake-completion-v1' AND e.metadata_json->>'requestHash'=v_request_hash;
   IF NOT FOUND THEN RAISE EXCEPTION 'Original- oder Archivquittung wurde verändert'; END IF;
  END LOOP;
  RETURN jsonb_build_object('contract','intake-completion-v1','clientId',p_client,'status','active','portalAccountCreated',false,'replayed',true);
 END IF;
 IF c.status<>'lead' OR c.updated_at IS DISTINCT FROM p_expected_client_updated_at THEN
  RAISE EXCEPTION 'Aufnahme wurde geändert. Bitte erneut laden'; END IF;
 IF nullif(btrim(c.first_name),'') IS NULL OR nullif(btrim(c.last_name),'') IS NULL THEN RAISE EXCEPTION 'Klientenstammdaten fehlen'; END IF;
 FOR v_entry IN SELECT value FROM jsonb_array_elements(p_documents) LOOP
  v_id:=(v_entry->>'documentId')::uuid;
  IF v_id IS NULL OR v_id=ANY(v_seen) THEN RAISE EXCEPTION 'Dokumentzuordnung fehlt oder ist doppelt'; END IF;
  v_seen:=array_append(v_seen,v_id);
  SELECT * INTO d FROM public.client_intake_documents WHERE id=v_id AND tenant_id=p_tenant AND client_id=p_client FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Fremdes Aufnahmedokument' USING ERRCODE='42501'; END IF;
  SELECT * INTO t FROM public.intake_document_system_templates WHERE template_key=d.template_key AND is_active;
  IF NOT FOUND OR d.version<>t.version OR (v_entry->>'version')::integer IS DISTINCT FROM d.version
   OR d.document_type<>t.document_type OR d.status NOT IN ('preview_open','pending_signature','signed','finalized')
   OR nullif(d.preview_html,'') IS NULL OR jsonb_array_length(coalesce(d.missing_placeholders,'[]'))<>0 THEN
   RAISE EXCEPTION 'Geprüfte Vorlage, Original oder Pflichtangaben fehlen'; END IF;
  IF d.source='tenant' THEN
   SELECT x.updated_at INTO v_template_updated_at FROM public.tenant_document_templates x WHERE x.id=d.tenant_template_id
    AND x.tenant_id=p_tenant AND x.template_key=d.template_key AND x.is_active;
   IF NOT FOUND THEN RAISE EXCEPTION 'Eigene aktive Dokumentvorlage fehlt'; END IF;
  ELSIF d.source='system' THEN v_template_updated_at:=t.updated_at;
  ELSE RAISE EXCEPTION 'Dokumentquelle ist nicht verifiziert'; END IF;
  v_hash:='sha256:'||encode(sha256(convert_to(d.preview_html,'UTF8')),'hex');
  IF v_entry->>'contentHash' IS DISTINCT FROM v_hash OR jsonb_typeof(v_entry->'signatures') IS DISTINCT FROM 'array' THEN
   RAISE EXCEPTION 'Geprüftes Original und Signaturen stimmen nicht überein'; END IF;
  -- Fail closed until the separate trusted preparation endpoint binds the
  -- real template revision to the reviewed original. It is intentionally NOT
  -- implemented/enabled in this draft; raw App events cannot forge its receipt.
  PERFORM 1 FROM public.client_document_events e WHERE e.tenant_id=p_tenant AND e.client_id=p_client AND e.document_id=d.id
   AND e.metadata_json->>'contract'='intake-preparation-v1' AND e.metadata_json->>'contentHash'=v_hash
   AND e.metadata_json->>'version'=d.version::text AND e.metadata_json->>'templateUpdatedAt'=v_template_updated_at::text;
  IF NOT FOUND THEN RAISE EXCEPTION 'Verifizierte atomare Originalvorbereitung oder aktuelle Vorlagenrevision fehlt'; END IF;
  v_needed:=ARRAY[]::text[];
  IF t.requires_client_signature THEN v_needed:=array_append(v_needed,'client'); END IF;
  IF t.requires_employee_signature THEN v_needed:=array_append(v_needed,'employee'); END IF;
  IF t.requires_representative_signature THEN v_needed:=array_append(v_needed,'legal_representative'); END IF;
  FOR v_role IN SELECT DISTINCT slot->>'role' FROM jsonb_array_elements(t.signature_slots) slot WHERE (slot->>'required')::boolean LOOP
   IF NOT v_role=ANY(v_needed) THEN v_needed:=array_append(v_needed,v_role); END IF;
  END LOOP;
  FOREACH v_role IN ARRAY v_needed LOOP
   IF (SELECT count(*) FROM jsonb_array_elements(v_entry->'signatures') s WHERE s->>'role'=v_role)<>1 THEN RAISE EXCEPTION 'Erforderliche Unterschriftsrolle ist nicht eindeutig'; END IF;
  END LOOP;
  FOR v_sig IN SELECT value FROM jsonb_array_elements(v_entry->'signatures') LOOP
   v_role:=v_sig->>'role';
   IF v_role IS NULL OR v_role NOT IN ('client','employee','legal_representative') OR (SELECT count(*) FROM jsonb_array_elements(v_entry->'signatures') s WHERE s->>'role'=v_role)<>1
    OR v_sig->>'dataUrl' IS NULL OR (v_sig->>'dataUrl') !~ '^data:image/png;base64,[A-Za-z0-9+/]+={0,2}$'
    OR length(v_sig->>'dataUrl')>3000000 OR position(v_sig->>'dataUrl' IN d.preview_html)=0
    OR substring(decode(substring(v_sig->>'dataUrl',23),'base64'),1,8)<>decode('89504e470d0a1a0a','hex') THEN
    RAISE EXCEPTION 'Signatur ist nicht an die geprüfte Originalfassung gebunden'; END IF;
   IF EXISTS(SELECT 1 FROM public.client_document_signatures s WHERE s.document_id=d.id AND s.signer_role=v_role) THEN
    PERFORM 1 FROM public.client_document_signatures s JOIN public.client_document_events e ON e.document_id=s.document_id
     WHERE s.document_id=d.id AND s.tenant_id=p_tenant AND s.client_id=p_client AND s.signer_role=v_role AND s.signature_data=v_sig->>'dataUrl'
      AND e.tenant_id=p_tenant AND e.client_id=p_client AND e.metadata_json->>'contract'='intake-completion-v1'
      AND e.metadata_json->>'contentHash'=v_hash AND e.metadata_json->>'requestHash'=v_request_hash;
    IF NOT FOUND THEN RAISE EXCEPTION 'Bestehende Legacy-Unterschrift hat keine fassungsgenaue Abschlussquittung'; END IF;
   ELSE
    INSERT INTO public.client_document_signatures(tenant_id,client_id,document_id,signer_role,signature_data,signed_at,signer_name)
     VALUES(p_tenant,p_client,d.id,v_role,v_sig->>'dataUrl',v_now,nullif(btrim(v_sig->>'signerName'),''));
   END IF;
  END LOOP;
  IF d.status='finalized' AND (d.finalized_html IS DISTINCT FROM d.preview_html OR d.finalized_at IS NULL) THEN
   RAISE EXCEPTION 'Gespeichertes Original ist nicht unverändert verifiziert'; END IF;
  INSERT INTO public.client_document_events(tenant_id,client_id,document_id,event_type,summary,metadata_json,actor_profile_id)
   VALUES(p_tenant,p_client,d.id,'document_finalized','Originalfassung und Unterschriften gemeinsam abgeschlossen',
    jsonb_build_object('contract','intake-completion-v1','version',d.version,'contentHash',v_hash,'requestHash',v_request_hash,'collectorProfileId',v_profile),v_profile);
  INSERT INTO public.client_documents(id,tenant_id,client_id,title,file_name,mime_type,category,status,sensitivity,source,intake_document_id,portal_visible,uploaded_by)
   VALUES(d.id,p_tenant,p_client,d.title,d.template_key||'.html','text/html',CASE WHEN d.document_type IN ('privacy_consent','additional_consent') THEN 'einwilligung' ELSE 'vertrag' END,
    'abgeschlossen','care','intake',d.id,true,v_profile);
  UPDATE public.client_intake_documents SET status='finalized',finalized_html=preview_html,finalized_at=coalesce(finalized_at,v_now),
   generated_document_id=d.id,updated_by=v_profile,updated_at=v_now WHERE id=d.id;
  IF d.document_type='privacy_consent' THEN v_privacy:=d.id; END IF;
  IF d.document_type='client_contract' THEN v_contract:=d.id; END IF;
 END LOOP;
 IF v_privacy IS NULL OR v_contract IS NULL OR EXISTS(SELECT 1 FROM public.client_intake_documents x
  WHERE x.tenant_id=p_tenant AND x.client_id=p_client AND x.is_required AND x.status<>'finalized') THEN
  RAISE EXCEPTION 'Datenschutz, Vertrag oder weitere Pflichtdokumente sind nicht vollständig'; END IF;
 PERFORM 1 FROM public.client_contract_selection s JOIN public.client_intake_documents x ON x.template_key=s.selected_template_key
  WHERE s.tenant_id=p_tenant AND s.client_id=p_client AND x.id=v_contract AND x.tenant_id=p_tenant AND x.client_id=p_client;
 IF NOT FOUND THEN RAISE EXCEPTION 'Gewählter Vertrag stimmt nicht mit der abgeschlossenen Fassung überein'; END IF;
 INSERT INTO public.client_consent_status(tenant_id,client_id,privacy_status,contract_status,privacy_finalized_at,contract_finalized_at,updated_by)
  VALUES(p_tenant,p_client,'finalized','finalized',v_now,v_now,v_profile)
  ON CONFLICT(tenant_id,client_id) DO UPDATE SET privacy_status='finalized',contract_status='finalized',
   privacy_finalized_at=v_now,contract_finalized_at=v_now,updated_by=v_profile,updated_at=v_now;
 INSERT INTO public.client_timeline_events(tenant_id,client_id,event_type,title,status,is_internal,metadata)
  VALUES(p_tenant,p_client,'status','Klientenaufnahme abgeschlossen','completed',true,
   jsonb_build_object('contract','intake-completion-v1','actorProfileId',v_profile,'requestHash',v_request_hash,'reviewedClientUpdatedAt',p_expected_client_updated_at::text));
 UPDATE public.clients SET status='active',updated_by=v_profile,updated_at=v_now WHERE id=p_client AND tenant_id=p_tenant;
 RETURN jsonb_build_object('contract','intake-completion-v1','clientId',p_client,'status','active','portalAccountCreated',false,'replayed',false);
END $$;
REVOKE ALL ON FUNCTION public.workflow_complete_client_intake(uuid,uuid,timestamptz,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.workflow_complete_client_intake(uuid,uuid,timestamptz,jsonb) TO authenticated;
-- Existing signed rows are not silently imported. A separate verified legacy
-- migration and safe original preparation RPC are required before activation.
CREATE OR REPLACE FUNCTION public.workflow_guard_intake_activation() RETURNS trigger
 LANGUAGE plpgsql SET search_path=pg_catalog AS $$ BEGIN
 IF OLD.status='lead' AND NEW.status='active' AND NOT EXISTS(
  SELECT 1 FROM public.client_timeline_events e WHERE e.tenant_id=NEW.tenant_id AND e.client_id=NEW.id
   AND e.event_type='status' AND e.metadata->>'contract'='intake-completion-v1') THEN
  RAISE EXCEPTION 'Die vollständige atomare Aufnahmequittung fehlt';
 END IF;RETURN NEW;END $$;
DROP TRIGGER IF EXISTS workflow_guard_intake_activation ON public.clients;
CREATE TRIGGER workflow_guard_intake_activation BEFORE UPDATE ON public.clients FOR EACH ROW EXECUTE FUNCTION public.workflow_guard_intake_activation();
CREATE OR REPLACE FUNCTION public.workflow_guard_signed_intake_original() RETURNS trigger
 LANGUAGE plpgsql SET search_path=pg_catalog AS $$ BEGIN
 IF current_user='authenticated' AND (OLD.status='finalized' OR EXISTS(
  SELECT 1 FROM public.client_document_signatures s WHERE s.document_id=OLD.id)) THEN
  RAISE EXCEPTION 'Unterschriebene Originalfassung ist unveränderlich';
 END IF;RETURN NEW;END $$;
DROP TRIGGER IF EXISTS workflow_guard_signed_intake_original ON public.client_intake_documents;
CREATE TRIGGER workflow_guard_signed_intake_original BEFORE UPDATE ON public.client_intake_documents
 FOR EACH ROW EXECUTE FUNCTION public.workflow_guard_signed_intake_original();
DROP POLICY IF EXISTS workflow_intake_document_insert_ceiling ON public.client_intake_documents;
CREATE POLICY workflow_intake_document_insert_ceiling ON public.client_intake_documents AS RESTRICTIVE FOR INSERT TO authenticated
 WITH CHECK(tenant_id=public.current_tenant_id() AND public.is_internal_tenant_actor(tenant_id)
  AND (public.has_permission('office.clients.create') OR public.has_permission('office.clients.edit'))
  AND status IN ('not_started','preview_open') AND finalized_html IS NULL AND finalized_at IS NULL);
DROP POLICY IF EXISTS workflow_intake_document_delete_ceiling ON public.client_intake_documents;
CREATE POLICY workflow_intake_document_delete_ceiling ON public.client_intake_documents AS RESTRICTIVE FOR DELETE TO authenticated
 USING(status IN ('not_started','preview_open') AND public.is_internal_tenant_actor(tenant_id)
  AND public.has_permission('office.clients.edit') AND NOT EXISTS(SELECT 1 FROM public.client_document_signatures s WHERE s.document_id=client_intake_documents.id));
DO $$ DECLARE t text;op text; BEGIN
 FOREACH t IN ARRAY ARRAY['client_document_signatures'] LOOP
  FOREACH op IN ARRAY ARRAY['INSERT','UPDATE','DELETE'] LOOP
   EXECUTE format('DROP POLICY IF EXISTS workflow_intake_%s_ceiling ON public.%I',lower(op),t);
   EXECUTE format('CREATE POLICY workflow_intake_%s_ceiling ON public.%I AS RESTRICTIVE FOR %s TO authenticated %s %s',
    lower(op),t,op,CASE WHEN op='INSERT' THEN '' ELSE 'USING(false)' END,CASE WHEN op='DELETE' THEN '' ELSE 'WITH CHECK(false)' END);
  END LOOP;
 END LOOP;
END $$;
DROP POLICY IF EXISTS workflow_intake_receipt_insert_ceiling ON public.client_timeline_events;
CREATE POLICY workflow_intake_receipt_insert_ceiling ON public.client_timeline_events AS RESTRICTIVE FOR INSERT TO authenticated
 WITH CHECK(coalesce(metadata->>'contract','')<>'intake-completion-v1');
DROP POLICY IF EXISTS workflow_intake_receipt_update_ceiling ON public.client_timeline_events;
CREATE POLICY workflow_intake_receipt_update_ceiling ON public.client_timeline_events AS RESTRICTIVE FOR UPDATE TO authenticated
 USING(coalesce(metadata->>'contract','')<>'intake-completion-v1') WITH CHECK(coalesce(metadata->>'contract','')<>'intake-completion-v1');
DROP POLICY IF EXISTS workflow_intake_receipt_delete_ceiling ON public.client_timeline_events;
CREATE POLICY workflow_intake_receipt_delete_ceiling ON public.client_timeline_events AS RESTRICTIVE FOR DELETE TO authenticated USING(coalesce(metadata->>'contract','')<>'intake-completion-v1');
DROP POLICY IF EXISTS workflow_intake_event_insert_ceiling ON public.client_document_events;
CREATE POLICY workflow_intake_event_insert_ceiling ON public.client_document_events AS RESTRICTIVE FOR INSERT TO authenticated
 WITH CHECK(event_type<>'document_finalized' AND coalesce(metadata_json->>'contract','') NOT IN ('intake-completion-v1','intake-preparation-v1'));
DROP POLICY IF EXISTS workflow_intake_event_update_ceiling ON public.client_document_events;
CREATE POLICY workflow_intake_event_update_ceiling ON public.client_document_events AS RESTRICTIVE FOR UPDATE TO authenticated
 USING(event_type<>'document_finalized') WITH CHECK(event_type<>'document_finalized' AND coalesce(metadata_json->>'contract','') NOT IN ('intake-completion-v1','intake-preparation-v1'));
DROP POLICY IF EXISTS workflow_intake_event_delete_ceiling ON public.client_document_events;
CREATE POLICY workflow_intake_event_delete_ceiling ON public.client_document_events AS RESTRICTIVE FOR DELETE TO authenticated USING(event_type<>'document_finalized');
COMMIT;
