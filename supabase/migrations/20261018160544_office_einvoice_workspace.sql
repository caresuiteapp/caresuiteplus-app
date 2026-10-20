-- Company-scoped invoice originals and structured draft metadata. This source
-- is deployed by the existing migration workflow. It does not book payments,
-- issue invoices, or claim EN 16931 / XRechnung validation is available.
BEGIN;

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS e_invoice_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS e_invoice_xml_sha256 text,
  ADD COLUMN IF NOT EXISTS e_invoice_validation_id uuid;
ALTER TABLE public.invoice_items ADD COLUMN IF NOT EXISTS e_invoice_tax jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Originals are bounded immutable bytes in the existing database. The current
-- office-documents bucket does not allow application/xml. Keeping originals in
-- this private archive avoids weakening shared Storage policies and makes
-- bytes, hash, duplicate detection, and the receipt one atomic transaction.
CREATE TABLE IF NOT EXISTS care_security.office_einvoice_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  file_name text NOT NULL CHECK(length(file_name) BETWEEN 1 AND 255),
  mime_type text NOT NULL CHECK(mime_type IN ('application/xml','application/pdf')),
  original_bytes bytea NOT NULL CHECK(octet_length(original_bytes) BETWEEN 1 AND 10485760),
  original_sha256 text NOT NULL CHECK(original_sha256 ~ '^[0-9a-f]{64}$'),
  extracted_xml_bytes bytea,
  extracted_xml_sha256 text,
  inspection jsonb NOT NULL DEFAULT '{}'::jsonb CHECK(jsonb_typeof(inspection)='object' AND octet_length(inspection::text)<=1000000),
  -- Inspection is a client parsing result, never a validator attestation.
  format_status text NOT NULL DEFAULT 'pending_validation' CHECK(format_status IN ('pending_validation','valid','invalid','unsupported','error')),
  validation_id uuid,
  business_status text NOT NULL DEFAULT 'unreviewed' CHECK(business_status IN ('unreviewed','reviewed','rejected')),
  review_note text NOT NULL DEFAULT '' CHECK(length(review_note)<=10000),
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  reviewed_by uuid,
  reviewed_at timestamptz,
  UNIQUE(tenant_id,original_sha256),
  CHECK((extracted_xml_bytes IS NULL AND extracted_xml_sha256 IS NULL) OR
    (extracted_xml_bytes IS NOT NULL AND octet_length(extracted_xml_bytes) BETWEEN 1 AND 5242880
      AND extracted_xml_sha256 ~ '^[0-9a-f]{64}$'))
);
CREATE INDEX IF NOT EXISTS office_einvoice_documents_created_idx
  ON care_security.office_einvoice_documents(tenant_id,created_at DESC,id);
CREATE TABLE IF NOT EXISTS care_security.office_einvoice_requests (
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  request_id uuid NOT NULL, actor_id uuid NOT NULL, request_hash text NOT NULL,
  document_id uuid NOT NULL REFERENCES care_security.office_einvoice_documents(id) ON DELETE RESTRICT,
  operation text NOT NULL CHECK(operation IN ('import','review')), result jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(), PRIMARY KEY(tenant_id,request_id)
);
CREATE TABLE IF NOT EXISTS care_security.office_einvoice_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  document_id uuid NOT NULL REFERENCES care_security.office_einvoice_documents(id) ON DELETE RESTRICT,
  actor_id uuid NOT NULL, operation text NOT NULL CHECK(operation IN ('import','duplicate','review','validate')),
  details jsonb NOT NULL DEFAULT '{}'::jsonb, created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX IF NOT EXISTS office_einvoice_events_document_idx
  ON care_security.office_einvoice_events(tenant_id,document_id,created_at);
CREATE TABLE IF NOT EXISTS care_security.office_einvoice_validations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  -- Draft deletion remains possible; the evidence of a former draft is retained.
  invoice_id uuid,
  document_id uuid REFERENCES care_security.office_einvoice_documents(id) ON DELETE RESTRICT,
  expected_updated_at timestamptz,
  source_revision text,
  invoice_number text,
  xml_bytes bytea NOT NULL CHECK(octet_length(xml_bytes) BETWEEN 1 AND 5242880),
  xml_sha256 text NOT NULL CHECK(xml_sha256 ~ '^[0-9a-f]{64}$'),
  report jsonb NOT NULL CHECK(jsonb_typeof(report)='object' AND octet_length(report::text)<=1000000),
  actor_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CHECK((invoice_id IS NOT NULL AND document_id IS NULL AND expected_updated_at IS NOT NULL
    AND source_revision IS NOT NULL AND invoice_number IS NOT NULL) OR
    (invoice_id IS NULL AND document_id IS NOT NULL AND expected_updated_at IS NULL AND source_revision IS NULL AND invoice_number IS NULL))
);
CREATE INDEX IF NOT EXISTS office_einvoice_validations_invoice_idx
  ON care_security.office_einvoice_validations(tenant_id,invoice_id,expected_updated_at,source_revision,invoice_number,xml_sha256);
CREATE INDEX IF NOT EXISTS office_einvoice_validations_document_idx
  ON care_security.office_einvoice_validations(tenant_id,document_id,created_at DESC);
ALTER TABLE care_security.office_einvoice_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE care_security.office_einvoice_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE care_security.office_einvoice_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE care_security.office_einvoice_validations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON care_security.office_einvoice_documents,care_security.office_einvoice_requests,care_security.office_einvoice_events FROM PUBLIC,anon,authenticated;
REVOKE ALL ON care_security.office_einvoice_validations FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT ON care_security.office_einvoice_validations TO service_role;
GRANT SELECT,UPDATE ON care_security.office_einvoice_documents TO service_role;
GRANT INSERT ON care_security.office_einvoice_events TO service_role;
GRANT USAGE ON SCHEMA care_security TO service_role;

CREATE OR REPLACE FUNCTION care_security.office_einvoice_original_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $body$
BEGIN
  IF TG_OP='DELETE' THEN
    RAISE EXCEPTION 'Gespeicherte Rechnungsoriginale und ihre Verarbeitungsschritte dürfen nicht gelöscht werden.' USING ERRCODE='42501';
  END IF;
  IF TG_TABLE_NAME<>'office_einvoice_documents' THEN
    RAISE EXCEPTION 'Verarbeitungsschritte dürfen nicht nachträglich geändert werden.' USING ERRCODE='42501';
  END IF;
  IF ROW(OLD.id,OLD.tenant_id,OLD.file_name,OLD.mime_type,OLD.original_bytes,OLD.original_sha256,
      OLD.extracted_xml_bytes,OLD.extracted_xml_sha256,OLD.inspection,OLD.created_by,OLD.created_at)
    IS DISTINCT FROM ROW(NEW.id,NEW.tenant_id,NEW.file_name,NEW.mime_type,NEW.original_bytes,NEW.original_sha256,
      NEW.extracted_xml_bytes,NEW.extracted_xml_sha256,NEW.inspection,NEW.created_by,NEW.created_at) THEN
    RAISE EXCEPTION 'Das Rechnungsoriginal, seine Prüfsumme und die gespeicherte Erkennung sind unveränderlich.' USING ERRCODE='42501';
  END IF;
  IF (NEW.format_status IS DISTINCT FROM OLD.format_status OR NEW.validation_id IS DISTINCT FROM OLD.validation_id)
    AND current_user<>'service_role' THEN
    RAISE EXCEPTION 'Das Formatprüfungsergebnis darf nur der geprüfte Serverprozess speichern.' USING ERRCODE='42501';
  END IF;
  RETURN NEW;
END
$body$;
REVOKE ALL ON FUNCTION care_security.office_einvoice_original_guard() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS office_einvoice_original_guard ON care_security.office_einvoice_documents;
CREATE TRIGGER office_einvoice_original_guard BEFORE UPDATE OR DELETE ON care_security.office_einvoice_documents
  FOR EACH ROW EXECUTE FUNCTION care_security.office_einvoice_original_guard();
DROP TRIGGER IF EXISTS office_einvoice_event_guard ON care_security.office_einvoice_events;
CREATE TRIGGER office_einvoice_event_guard BEFORE UPDATE OR DELETE ON care_security.office_einvoice_events
  FOR EACH ROW EXECUTE FUNCTION care_security.office_einvoice_original_guard();
DROP TRIGGER IF EXISTS office_einvoice_validation_guard ON care_security.office_einvoice_validations;
CREATE TRIGGER office_einvoice_validation_guard BEFORE UPDATE OR DELETE ON care_security.office_einvoice_validations
  FOR EACH ROW EXECUTE FUNCTION care_security.office_einvoice_original_guard();

CREATE OR REPLACE FUNCTION care_security.office_einvoice_metadata(p_document care_security.office_einvoice_documents)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path=pg_catalog AS $body$
  SELECT jsonb_build_object('id',p_document.id,'tenant_id',p_document.tenant_id,'file_name',p_document.file_name,
    'mime_type',p_document.mime_type,'original_sha256',p_document.original_sha256,'original_size',octet_length(p_document.original_bytes),
    'extracted_xml_sha256',p_document.extracted_xml_sha256,'extracted_xml_size',octet_length(p_document.extracted_xml_bytes),
    'inspection',p_document.inspection,'format_status',p_document.format_status,'business_status',p_document.business_status,
    'review_note',p_document.review_note,'created_at',p_document.created_at,'updated_at',p_document.updated_at,'reviewed_at',p_document.reviewed_at,
    'validation_id',p_document.validation_id,'validation_report',(SELECT v.report FROM care_security.office_einvoice_validations v
      WHERE v.id=p_document.validation_id AND v.tenant_id=p_document.tenant_id AND v.document_id=p_document.id))
$body$;
REVOKE ALL ON FUNCTION care_security.office_einvoice_metadata(care_security.office_einvoice_documents) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION care_security.office_einvoice_inbox_read(
  p_tenant_id uuid,p_document_id uuid DEFAULT NULL,p_limit integer DEFAULT 50,p_offset integer DEFAULT 0,p_include_original boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $body$
DECLARE v_items jsonb;v_total bigint;v_document care_security.office_einvoice_documents;v_item jsonb;v_report jsonb;
BEGIN
  IF auth.uid() IS NULL OR p_tenant_id IS DISTINCT FROM public.current_tenant_id()
    OR (public.current_portal_type() IS NOT NULL AND public.current_portal_type()<>'business')
    OR NOT coalesce(care_security.office_actor(p_tenant_id,'office.invoices.view'),false) THEN
    RAISE EXCEPTION 'Keine Berechtigung für den Rechnungseingang.' USING ERRCODE='42501';
  END IF;
  IF p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 100 OR p_offset IS NULL OR p_offset<0 OR p_offset>1000000
    OR p_include_original IS NULL OR (p_include_original AND p_document_id IS NULL) THEN
    RAISE EXCEPTION 'Ungültige Anfrage für den Rechnungseingang.' USING ERRCODE='22023';
  END IF;
  IF p_document_id IS NOT NULL THEN
    SELECT * INTO v_document FROM care_security.office_einvoice_documents WHERE tenant_id=p_tenant_id AND id=p_document_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Das Rechnungsoriginal ist nicht verfügbar.' USING ERRCODE='P0002'; END IF;
    v_item:=care_security.office_einvoice_metadata(v_document);
    IF v_document.validation_id IS NOT NULL THEN
      SELECT report INTO v_report FROM care_security.office_einvoice_validations
        WHERE id=v_document.validation_id AND tenant_id=p_tenant_id AND document_id=v_document.id;
      v_item:=v_item||jsonb_build_object('validation_report',v_report);
    END IF;
    IF p_include_original THEN
      v_item:=v_item||jsonb_build_object('original_base64',encode(v_document.original_bytes,'base64'),
        'extracted_xml_base64',CASE WHEN v_document.extracted_xml_bytes IS NULL THEN NULL ELSE encode(v_document.extracted_xml_bytes,'base64') END);
    END IF;
    RETURN jsonb_build_object('items',jsonb_build_array(v_item),'total',1,'limit',p_limit,'offset',p_offset);
  END IF;
  SELECT count(*) INTO v_total FROM care_security.office_einvoice_documents WHERE tenant_id=p_tenant_id;
  SELECT coalesce(jsonb_agg(page.item ORDER BY page.created_at DESC,page.id),'[]'::jsonb) INTO v_items
    FROM (SELECT d.id,d.created_at,care_security.office_einvoice_metadata(d) AS item FROM care_security.office_einvoice_documents d
      WHERE d.tenant_id=p_tenant_id ORDER BY d.created_at DESC,d.id LIMIT p_limit OFFSET p_offset) page;
  RETURN jsonb_build_object('items',v_items,'total',v_total,'limit',p_limit,'offset',p_offset);
END
$body$;
REVOKE ALL ON FUNCTION care_security.office_einvoice_inbox_read(uuid,uuid,integer,integer,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION care_security.office_einvoice_inbox_read(uuid,uuid,integer,integer,boolean) TO authenticated;
CREATE OR REPLACE FUNCTION public.office_einvoice_inbox_read(
  p_tenant_id uuid,p_document_id uuid DEFAULT NULL,p_limit integer DEFAULT 50,p_offset integer DEFAULT 0,p_include_original boolean DEFAULT false)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path=pg_catalog AS $body$
  SELECT care_security.office_einvoice_inbox_read(p_tenant_id,p_document_id,p_limit,p_offset,p_include_original)
$body$;
REVOKE ALL ON FUNCTION public.office_einvoice_inbox_read(uuid,uuid,integer,integer,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.office_einvoice_inbox_read(uuid,uuid,integer,integer,boolean) TO authenticated;

CREATE OR REPLACE FUNCTION care_security.office_einvoice_inbox_mutation(
  p_tenant_id uuid,p_request_id uuid,p_document_id uuid,p_expected_updated_at timestamptz,p_operation text,p_payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $body$
DECLARE v_original bytea;v_xml bytea;v_original_hash text;v_xml_hash text;v_hash text;v_result jsonb;v_duplicate boolean:=false;
  v_request care_security.office_einvoice_requests;v_document care_security.office_einvoice_documents;v_now timestamptz:=clock_timestamp();
BEGIN
  IF auth.uid() IS NULL OR p_tenant_id IS DISTINCT FROM public.current_tenant_id()
    OR (public.current_portal_type() IS NOT NULL AND public.current_portal_type()<>'business')
    OR NOT coalesce(care_security.office_actor(p_tenant_id,'office.invoices.view'),false)
    OR NOT coalesce(care_security.office_actor(p_tenant_id,CASE WHEN p_operation='import' THEN 'office.invoices.create' ELSE 'office.invoices.status_change' END),false) THEN
    RAISE EXCEPTION 'Keine Berechtigung für diese Bearbeitung im Rechnungseingang.' USING ERRCODE='42501';
  END IF;
  IF p_request_id IS NULL OR p_operation IS NULL OR p_operation NOT IN ('import','review')
    OR jsonb_typeof(p_payload) IS DISTINCT FROM 'object' OR octet_length(p_payload::text)>22500000 THEN
    RAISE EXCEPTION 'Ungültiger Auftrag für den Rechnungseingang.' USING ERRCODE='22023';
  END IF;
  v_hash:=encode(extensions.digest(convert_to(jsonb_build_array(p_document_id,p_expected_updated_at,p_operation,p_payload)::text,'UTF8'),'sha256'),'hex');
  PERFORM pg_advisory_xact_lock(hashtextextended('office-einvoice-request:'||p_tenant_id||':'||p_request_id,0));
  SELECT * INTO v_request FROM care_security.office_einvoice_requests WHERE tenant_id=p_tenant_id AND request_id=p_request_id;
  IF FOUND THEN
    IF v_request.actor_id IS DISTINCT FROM auth.uid() OR v_request.request_hash IS DISTINCT FROM v_hash THEN
      RAISE EXCEPTION 'Diese Speicherkennung wurde bereits für einen anderen Vorgang verwendet.' USING ERRCODE='22023';
    END IF;
    RETURN v_request.result;
  END IF;
  IF p_operation='import' THEN
    IF p_document_id IS NOT NULL OR p_expected_updated_at IS NOT NULL
      OR length(btrim(coalesce(p_payload->>'file_name',''))) NOT BETWEEN 1 AND 255
      OR p_payload->>'file_name' ~ '[[:cntrl:]]' OR position('/' IN p_payload->>'file_name')>0 OR position(chr(92) IN p_payload->>'file_name')>0
      OR coalesce(p_payload->>'mime_type','') NOT IN ('application/xml','application/pdf')
      OR jsonb_typeof(p_payload->'original_base64') IS DISTINCT FROM 'string'
      OR length(p_payload->>'original_base64')>13981016
      OR coalesce(p_payload->>'original_sha256','') !~ '^[0-9a-f]{64}$'
      OR jsonb_typeof(p_payload->'inspection') IS DISTINCT FROM 'object' OR octet_length((p_payload->'inspection')::text)>1000000
      OR (p_payload-ARRAY['file_name','mime_type','original_base64','original_sha256','extracted_xml_base64','inspection'])<>'{}'::jsonb THEN
      RAISE EXCEPTION 'Datei, Erkennung oder Prüfsumme ist ungültig.' USING ERRCODE='22023';
    END IF;
    v_original:=decode(p_payload->>'original_base64','base64');
    IF octet_length(v_original) NOT BETWEEN 1 AND 10485760 THEN RAISE EXCEPTION 'Die Originaldatei darf höchstens 10 MiB groß sein.' USING ERRCODE='22023'; END IF;
    v_original_hash:=encode(extensions.digest(v_original,'sha256'),'hex');
    IF v_original_hash IS DISTINCT FROM p_payload->>'original_sha256' THEN RAISE EXCEPTION 'Die Originaldatei stimmt nicht mit der berechneten Prüfsumme überein.' USING ERRCODE='22023'; END IF;
    IF p_payload->>'mime_type'='application/xml' THEN
      IF octet_length(v_original)>5242880 THEN RAISE EXCEPTION 'Der XML-Datensatz darf höchstens 5 MiB groß sein.' USING ERRCODE='22023'; END IF;
      v_xml:=v_original;
      IF nullif(p_payload->>'extracted_xml_base64','') IS NOT NULL AND decode(p_payload->>'extracted_xml_base64','base64') IS DISTINCT FROM v_xml THEN
        RAISE EXCEPTION 'Bei einer XML-Datei müssen Original und strukturierter Datensatz übereinstimmen.' USING ERRCODE='22023';
      END IF;
    ELSE
      IF substring(v_original FROM 1 FOR 5)<>convert_to('%PDF-','UTF8') THEN RAISE EXCEPTION 'Die Datei besitzt keinen PDF-Dateikopf.' USING ERRCODE='22023'; END IF;
      IF nullif(p_payload->>'extracted_xml_base64','') IS NOT NULL THEN
        IF jsonb_typeof(p_payload->'extracted_xml_base64') IS DISTINCT FROM 'string' OR length(p_payload->>'extracted_xml_base64')>6990508 THEN
          RAISE EXCEPTION 'Der extrahierte XML-Datensatz ist zu groß.' USING ERRCODE='22023';
        END IF;
        v_xml:=decode(p_payload->>'extracted_xml_base64','base64');
        IF octet_length(v_xml) NOT BETWEEN 1 AND 5242880 THEN RAISE EXCEPTION 'Der XML-Datensatz darf höchstens 5 MiB groß sein.' USING ERRCODE='22023'; END IF;
      END IF;
    END IF;
    v_xml_hash:=CASE WHEN v_xml IS NULL THEN NULL ELSE encode(extensions.digest(v_xml,'sha256'),'hex') END;
    PERFORM pg_advisory_xact_lock(hashtextextended('office-einvoice-original:'||p_tenant_id||':'||v_original_hash,0));
    SELECT * INTO v_document FROM care_security.office_einvoice_documents WHERE tenant_id=p_tenant_id AND original_sha256=v_original_hash;
    IF FOUND THEN
      v_duplicate:=true;
    ELSE
      INSERT INTO care_security.office_einvoice_documents(tenant_id,file_name,mime_type,original_bytes,original_sha256,
        extracted_xml_bytes,extracted_xml_sha256,inspection,created_by)
      VALUES(p_tenant_id,btrim(p_payload->>'file_name'),p_payload->>'mime_type',v_original,v_original_hash,
        v_xml,v_xml_hash,p_payload->'inspection',auth.uid()) RETURNING * INTO v_document;
    END IF;
    INSERT INTO care_security.office_einvoice_events(tenant_id,document_id,actor_id,operation,details)
      VALUES(p_tenant_id,v_document.id,auth.uid(),CASE WHEN v_duplicate THEN 'duplicate' ELSE 'import' END,
        jsonb_build_object('original_sha256',v_original_hash,'format_status','pending_validation'));
  ELSE
    IF p_document_id IS NULL OR p_expected_updated_at IS NULL
      OR coalesce(p_payload->>'business_status','') NOT IN ('unreviewed','reviewed','rejected')
      OR jsonb_typeof(p_payload->'review_note') IS DISTINCT FROM 'string' OR length(p_payload->>'review_note')>10000
      OR (p_payload-ARRAY['business_status','review_note'])<>'{}'::jsonb THEN
      RAISE EXCEPTION 'Prüfstatus, Notiz oder Bearbeitungsstand ist ungültig.' USING ERRCODE='22023';
    END IF;
    SELECT * INTO v_document FROM care_security.office_einvoice_documents WHERE tenant_id=p_tenant_id AND id=p_document_id FOR UPDATE;
    IF NOT FOUND OR v_document.updated_at IS DISTINCT FROM p_expected_updated_at THEN
      RAISE EXCEPTION 'Der Rechnungseingang wurde inzwischen geändert. Bitte aktualisieren.' USING ERRCODE='40001';
    END IF;
    INSERT INTO care_security.office_einvoice_events(tenant_id,document_id,actor_id,operation,details)
      VALUES(p_tenant_id,v_document.id,auth.uid(),'review',jsonb_build_object('previous_status',v_document.business_status,
        'business_status',p_payload->>'business_status','review_note',btrim(p_payload->>'review_note')));
    v_now:=greatest(clock_timestamp(),v_document.updated_at+interval '1 microsecond');
    UPDATE care_security.office_einvoice_documents SET business_status=p_payload->>'business_status',review_note=btrim(p_payload->>'review_note'),
      updated_at=v_now,reviewed_by=auth.uid(),reviewed_at=v_now WHERE tenant_id=p_tenant_id AND id=p_document_id RETURNING * INTO v_document;
  END IF;
  v_result:=jsonb_build_object('document_id',v_document.id,'updated_at',v_document.updated_at,'duplicate',v_duplicate);
  INSERT INTO care_security.office_einvoice_requests(tenant_id,request_id,actor_id,request_hash,document_id,operation,result)
    VALUES(p_tenant_id,p_request_id,auth.uid(),v_hash,v_document.id,p_operation,v_result);
  RETURN v_result;
END
$body$;
REVOKE ALL ON FUNCTION care_security.office_einvoice_inbox_mutation(uuid,uuid,uuid,timestamptz,text,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION care_security.office_einvoice_inbox_mutation(uuid,uuid,uuid,timestamptz,text,jsonb) TO authenticated;
CREATE OR REPLACE FUNCTION public.office_einvoice_inbox_mutation(
  p_tenant_id uuid,p_request_id uuid,p_document_id uuid,p_expected_updated_at timestamptz,p_operation text,p_payload jsonb)
RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path=pg_catalog AS $body$
  SELECT care_security.office_einvoice_inbox_mutation(p_tenant_id,p_request_id,p_document_id,p_expected_updated_at,p_operation,p_payload)
$body$;
REVOKE ALL ON FUNCTION public.office_einvoice_inbox_mutation(uuid,uuid,uuid,timestamptz,text,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.office_einvoice_inbox_mutation(uuid,uuid,uuid,timestamptz,text,jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION care_security.office_einvoice_check_metadata(p_metadata jsonb,p_line boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql IMMUTABLE SECURITY INVOKER SET search_path=pg_catalog AS $body$
DECLARE v_key text;v_value jsonb;
BEGIN
  IF jsonb_typeof(p_metadata) IS DISTINCT FROM 'object' OR octet_length(p_metadata::text)>25000 THEN
    RAISE EXCEPTION 'Die E-Rechnungsangaben sind ungültig oder zu lang.' USING ERRCODE='22023';
  END IF;
  IF p_metadata='{}'::jsonb THEN RETURN p_metadata; END IF;
  IF p_line THEN
    IF (p_metadata-ARRAY['category','unitCode','exemptionReason','exemptionReasonCode','legalBasis'])<>'{}'::jsonb
      OR coalesce(p_metadata->>'category','?') NOT IN ('','S','Z','E','AE','O')
      OR coalesce(p_metadata->>'legalBasis','') NOT IN ('unknown','none','ustg_4_8_29','ustg_19','other') THEN
      RAISE EXCEPTION 'Steuerkategorie oder steuerliche Einordnung ist ungültig.' USING ERRCODE='22023';
    END IF;
    FOREACH v_key IN ARRAY ARRAY['unitCode','exemptionReason','exemptionReasonCode'] LOOP
      IF jsonb_typeof(p_metadata->v_key) IS DISTINCT FROM 'string' OR length(p_metadata->>v_key)>500 THEN
        RAISE EXCEPTION 'Eine strukturierte Positionsangabe ist ungültig.' USING ERRCODE='22023';
      END IF;
    END LOOP;
    RETURN p_metadata;
  END IF;
  IF (p_metadata-ARRAY['version','format','buyer','buyerConfirmed','buyerCountryCode','buyerVatId','buyerLegalRegistrationId',
      'buyerReference','buyerEndpoint','sellerCountryCode','sellerIdentifier','sellerEndpoint','sellerContact','legal'])<>'{}'::jsonb
    OR p_metadata->'version' IS DISTINCT FROM '1'::jsonb OR coalesce(p_metadata->>'format','') NOT IN ('pdf','xrechnung')
    OR jsonb_typeof(p_metadata->'buyerConfirmed') IS DISTINCT FROM 'boolean' THEN
    RAISE EXCEPTION 'Das E-Rechnungsformat oder die Empfängerbestätigung ist ungültig.' USING ERRCODE='22023';
  END IF;
  FOREACH v_key IN ARRAY ARRAY['buyerCountryCode','buyerVatId','buyerLegalRegistrationId','buyerReference','sellerCountryCode','sellerIdentifier'] LOOP
    IF jsonb_typeof(p_metadata->v_key) IS DISTINCT FROM 'string' OR length(p_metadata->>v_key)>500 THEN
      RAISE EXCEPTION 'Eine E-Rechnungsangabe ist ungültig oder zu lang.' USING ERRCODE='22023';
    END IF;
  END LOOP;
  FOREACH v_key IN ARRAY ARRAY['buyer','buyerEndpoint','sellerEndpoint','sellerContact','legal'] LOOP
    IF jsonb_typeof(p_metadata->v_key) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Die E-Rechnungsangaben sind unvollständig.' USING ERRCODE='22023'; END IF;
  END LOOP;
  FOR v_value IN SELECT value FROM jsonb_each(p_metadata->'buyer') UNION ALL SELECT value FROM jsonb_each(p_metadata->'buyerEndpoint')
    UNION ALL SELECT value FROM jsonb_each(p_metadata->'sellerEndpoint') UNION ALL SELECT value FROM jsonb_each(p_metadata->'sellerContact') LOOP
    IF jsonb_typeof(v_value) IS DISTINCT FROM 'string' OR length(v_value#>>'{}')>500 THEN
      RAISE EXCEPTION 'Eine Anschrift oder Kontaktangabe ist ungültig.' USING ERRCODE='22023';
    END IF;
  END LOOP;
  IF coalesce(p_metadata#>>'{legal,recipientKind}','') NOT IN ('unknown','b2b','b2c','b2g') THEN
    RAISE EXCEPTION 'Die geschäftliche Rolle des Leistungsempfängers ist ungültig.' USING ERRCODE='22023';
  END IF;
  FOREACH v_key IN ARRAY ARRAY['buyerBusinessUse','sellerDomestic','buyerDomestic','sellerSmallBusiness','smallAmountRuleEligible','passengerTicket','pdfConsent'] LOOP
    IF coalesce(p_metadata->'legal'->>v_key,'') NOT IN ('unknown','yes','no') THEN
      RAISE EXCEPTION 'Die steuerliche Einordnung enthält eine ungültige Antwort.' USING ERRCODE='22023';
    END IF;
  END LOOP;
  IF jsonb_typeof(p_metadata#>'{legal,transmissionDate}') IS DISTINCT FROM 'string' THEN RAISE EXCEPTION 'Das Übermittlungsdatum ist ungültig.' USING ERRCODE='22023'; END IF;
  IF nullif(p_metadata#>>'{legal,transmissionDate}','') IS NOT NULL THEN
    IF (p_metadata#>>'{legal,transmissionDate}') !~ '^\d{4}-\d{2}-\d{2}$' THEN RAISE EXCEPTION 'Das Übermittlungsdatum ist ungültig.' USING ERRCODE='22023'; END IF;
    PERFORM (p_metadata#>>'{legal,transmissionDate}')::date;
  END IF;
  FOREACH v_key IN ARRAY ARRAY['priorYearRevenueCents','priorYearRevenueYear'] LOOP
    v_value:=p_metadata->'legal'->v_key;
    IF v_value IS NULL OR (v_value<>'null'::jsonb AND (jsonb_typeof(v_value) IS DISTINCT FROM 'number' OR v_value::text !~ '^\d+$')) THEN
      RAISE EXCEPTION 'Umsatz oder Bezugsjahr ist ungültig.' USING ERRCODE='22023';
    END IF;
  END LOOP;
  RETURN p_metadata;
END
$body$;
REVOKE ALL ON FUNCTION care_security.office_einvoice_check_metadata(jsonb,boolean) FROM PUBLIC,anon,authenticated;

-- Return true only for the narrow, fully confirmed B2B case represented by the
-- editor's assessment. Unknown facts are not silently declared permissible.
CREATE OR REPLACE FUNCTION care_security.office_einvoice_pdf_explicitly_blocked(p_invoice public.invoices)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=pg_catalog AS $body$
DECLARE v_legal jsonb:=p_invoice.e_invoice_metadata->'legal';v_sent date;v_revenue numeric;
BEGIN
  IF p_invoice.e_invoice_metadata->'buyerConfirmed' IS DISTINCT FROM 'true'::jsonb
    OR v_legal->>'recipientKind' IS DISTINCT FROM 'b2b' OR v_legal->>'buyerBusinessUse' IS DISTINCT FROM 'yes'
    OR v_legal->>'sellerDomestic' IS DISTINCT FROM 'yes' OR v_legal->>'buyerDomestic' IS DISTINCT FROM 'yes'
    OR v_legal->>'sellerSmallBusiness' IS DISTINCT FROM 'no' OR v_legal->>'passengerTicket' IS DISTINCT FROM 'no' THEN RETURN false; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.invoice_items i WHERE i.tenant_id=p_invoice.tenant_id AND i.invoice_id=p_invoice.id)
    OR EXISTS(SELECT 1 FROM public.invoice_items i WHERE i.tenant_id=p_invoice.tenant_id AND i.invoice_id=p_invoice.id
      AND (coalesce(i.e_invoice_tax->>'category','')='' OR coalesce(i.e_invoice_tax->>'legalBasis','unknown')='unknown')) THEN RETURN false; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.invoice_items i WHERE i.tenant_id=p_invoice.tenant_id AND i.invoice_id=p_invoice.id
    AND NOT (i.e_invoice_tax->>'category'='E' AND i.e_invoice_tax->>'legalBasis'='ustg_4_8_29'
      AND i.vat_rate=0 AND length(btrim(coalesce(i.e_invoice_tax->>'exemptionReason','')))>0)) THEN RETURN false; END IF;
  IF p_invoice.total_amount<=250 AND v_legal->>'smallAmountRuleEligible' IN ('yes','unknown') THEN RETURN false; END IF;
  IF p_invoice.service_period_from IS NULL OR p_invoice.service_period_to IS NULL
    OR coalesce(v_legal->>'transmissionDate','') !~ '^\d{4}-\d{2}-\d{2}$' THEN RETURN false; END IF;
  v_sent:=(v_legal->>'transmissionDate')::date;
  IF v_sent<p_invoice.invoice_date OR p_invoice.service_period_from>p_invoice.service_period_to
    OR p_invoice.service_period_to<'2025-01-01' OR p_invoice.service_period_from<'2025-01-01'
    OR extract(year FROM p_invoice.service_period_from)<>extract(year FROM p_invoice.service_period_to) THEN RETURN false; END IF;
  IF p_invoice.service_period_to<='2026-12-31' AND v_sent<='2026-12-31' THEN RETURN false; END IF;
  IF p_invoice.service_period_from>='2027-01-01' AND p_invoice.service_period_to<='2027-12-31' AND v_sent<='2027-12-31' THEN
    IF v_legal->'priorYearRevenueYear' IS DISTINCT FROM '2026'::jsonb
      OR jsonb_typeof(v_legal->'priorYearRevenueCents') IS DISTINCT FROM 'number' THEN RETURN false; END IF;
    v_revenue:=(v_legal->>'priorYearRevenueCents')::numeric;
    IF v_revenue<=80000000 THEN RETURN false; END IF;
  END IF;
  RETURN true;
END
$body$;
REVOKE ALL ON FUNCTION care_security.office_einvoice_pdf_explicitly_blocked(public.invoices) FROM PUBLIC,anon,authenticated;

-- These APIs are accessible only to the existing trusted server process. The
-- browser cannot create a validation receipt or choose a validator endpoint.
-- They are invokers, and their explicit service_role grants do not expose the
-- private byte archive to authenticated clients.
CREATE OR REPLACE FUNCTION care_security.office_einvoice_server_actor(p_tenant_id uuid,p_actor_id uuid,p_permission text)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path=pg_catalog AS $body$
  SELECT p_actor_id IS NOT NULL AND auth.jwt()->>'role'='service_role' AND EXISTS(
    SELECT 1 FROM public.profiles p JOIN public.roles r ON r.id=p.role_id
    WHERE (p.auth_user_id=p_actor_id OR (p.auth_user_id IS NULL AND p.id=p_actor_id))
      AND p.tenant_id=p_tenant_id AND p.status::text='active' AND p.is_active
      AND (to_jsonb(r)->>'tenant_id' IS NULL OR to_jsonb(r)->>'tenant_id'=p_tenant_id::text)
      AND lower(r.key) NOT IN ('employee_portal','client_portal','family_portal','employee','client','family','relative','caregiver','nurse')
      AND (coalesce(r.is_admin_role,false) OR r.key IN ('owner','admin','management','geschaeftsfuehrung','business_admin')
        OR EXISTS(SELECT 1 FROM public.role_permissions rp WHERE rp.role_id=r.id
          AND (to_jsonb(rp)->>'tenant_id' IS NULL OR to_jsonb(rp)->>'tenant_id'=p_tenant_id::text)
          AND rp.permission_key=p_permission AND rp.can_view IS TRUE)))
$body$;
REVOKE ALL ON FUNCTION care_security.office_einvoice_server_actor(uuid,uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION care_security.office_einvoice_server_actor(uuid,uuid,text) TO service_role;

CREATE OR REPLACE FUNCTION care_security.office_einvoice_check_report(p_report jsonb,p_xml_sha256 text,p_require_valid boolean)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE SECURITY INVOKER SET search_path=pg_catalog AS $body$
BEGIN
  IF jsonb_typeof(p_report) IS DISTINCT FROM 'object' OR octet_length(p_report::text)>1000000
    OR p_report->'schemaVersion' IS DISTINCT FROM '1'::jsonb OR p_report->>'source' IS DISTINCT FROM 'server'
    OR p_report->>'documentSha256' IS DISTINCT FROM p_xml_sha256
    OR coalesce(p_report->>'status','') NOT IN ('valid','invalid','unsupported','error')
    OR p_report#>>'{engine,name}' IS DISTINCT FROM 'libxml2-wasm+saxon-js'
    OR p_report#>>'{engine,version}' IS DISTINCT FROM '0.7.2+2.7.0'
    OR jsonb_typeof(p_report->'checks') IS DISTINCT FROM 'array'
    OR jsonb_typeof(p_report->'findings') IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Der serverseitige Prüfbericht ist ungültig oder gehört zu anderen Dateibytes.' USING ERRCODE='22023';
  END IF;
  IF p_require_valid AND p_report->>'status'<>'valid' THEN
    RAISE EXCEPTION 'Die E-Rechnung hat die vollständige Formatprüfung nicht bestanden.' USING ERRCODE='55000';
  END IF;
  IF p_report->>'status'='valid' AND (
    coalesce(p_report->>'syntax','') NOT IN ('ubl_invoice','ubl_credit_note','cii')
    OR p_report->>'scope' IS DISTINCT FROM 'structured_xml'
    OR p_report#>>'{ruleSet,name}' IS DISTINCT FROM 'KoSIT XRechnung'
    OR p_report#>>'{ruleSet,version}' IS DISTINCT FROM '2026-08-31'
    OR p_report#>>'{ruleSet,sha256}' IS DISTINCT FROM 'cd4e642f4957a95fd17006afced517dc58526a17e6bd9f3097bf596d54d575c2'
    OR jsonb_array_length(p_report->'checks')<>3
    OR NOT (p_report->'checks' @> '[{"kind":"syntax","status":"passed"},{"kind":"xsd","status":"passed"},{"kind":"business_rules","status":"passed"}]'::jsonb)
    OR EXISTS(SELECT 1 FROM jsonb_array_elements(p_report->'findings') f WHERE f->>'severity'='error')) THEN
    RAISE EXCEPTION 'Der Prüfbericht belegt keine vollständige Prüfung mit dem freigegebenen XRechnung-Regelpaket.' USING ERRCODE='55000';
  END IF;
  IF p_report->>'status'='valid' THEN
    IF p_report->>'standard'='xrechnung_3.0' THEN
      IF p_report->>'profileId' IS DISTINCT FROM 'urn:cen.eu:en16931:2017#compliant#urn:xeinkauf.de:kosit:xrechnung_3.0'
        OR p_report->'businessRuleSets' IS DISTINCT FROM '["en16931-1.3.16","xrechnung-2.6.0"]'::jsonb THEN
        RAISE EXCEPTION 'Das XRechnung-Profil und die angewendeten Geschäftsregeln stimmen nicht überein.' USING ERRCODE='55000';
      END IF;
    ELSIF NOT p_require_valid AND p_report->>'standard'='en16931' THEN
      IF p_report->>'profileId' IS DISTINCT FROM 'urn:cen.eu:en16931:2017'
        OR p_report->'businessRuleSets' IS DISTINCT FROM '["en16931-1.3.16"]'::jsonb THEN
        RAISE EXCEPTION 'Das EN-16931-Profil und die angewendeten Geschäftsregeln stimmen nicht überein.' USING ERRCODE='55000';
      END IF;
    ELSE
      RAISE EXCEPTION 'Dieser Prüfstandard ist für den gewählten Ablauf nicht freigegeben.' USING ERRCODE='55000';
    END IF;
  END IF;
  RETURN true;
END
$body$;
REVOKE ALL ON FUNCTION care_security.office_einvoice_check_report(jsonb,text,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION care_security.office_einvoice_check_report(jsonb,text,boolean) TO service_role;

CREATE OR REPLACE FUNCTION care_security.office_einvoice_record_validation(
  p_tenant_id uuid,p_invoice_id uuid,p_expected_updated_at timestamptz,p_source_revision text,p_invoice_number text,
  p_xml_base64 text,p_report jsonb,p_actor_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $body$
DECLARE v_xml bytea;v_hash text;v_invoice public.invoices;v_validation care_security.office_einvoice_validations;
BEGIN
  IF NOT coalesce(care_security.office_einvoice_server_actor(p_tenant_id,p_actor_id,'office.invoices.view'),false)
    OR NOT coalesce(care_security.office_einvoice_server_actor(p_tenant_id,p_actor_id,'office.invoices.status_change'),false) THEN
    RAISE EXCEPTION 'Nur der freigegebene Serverprozess darf Prüfnachweise zur Rechnungsfreigabe speichern.' USING ERRCODE='42501';
  END IF;
  IF p_invoice_id IS NULL OR p_expected_updated_at IS NULL OR coalesce(p_source_revision,'') !~ '^[0-9a-f]{32}$'
    OR length(coalesce(p_invoice_number,'')) NOT BETWEEN 1 AND 120 OR p_xml_base64 IS NULL OR length(p_xml_base64)>6990508 THEN
    RAISE EXCEPTION 'Der Prüfnachweis enthält keine gültige Rechnungszuordnung.' USING ERRCODE='22023';
  END IF;
  v_xml:=decode(p_xml_base64,'base64');
  IF octet_length(v_xml) NOT BETWEEN 1 AND 5242880 THEN RAISE EXCEPTION 'Der XML-Datensatz ist leer oder zu groß.' USING ERRCODE='22023'; END IF;
  v_hash:=encode(extensions.digest(v_xml,'sha256'),'hex');
  PERFORM care_security.office_einvoice_check_report(p_report,v_hash,true);
  IF p_report->>'syntax'<>'ubl_invoice' THEN RAISE EXCEPTION 'Dieser Ausgabeweg unterstützt ausschließlich UBL-Rechnungen.' USING ERRCODE='22023'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('office-invoice:'||p_tenant_id||':'||p_invoice_id,0));
  SELECT * INTO v_invoice FROM public.invoices WHERE tenant_id=p_tenant_id AND id=p_invoice_id FOR SHARE;
  IF NOT FOUND OR NOT v_invoice.office_managed OR v_invoice.status<>'draft' OR v_invoice.issued_at IS NOT NULL
    OR v_invoice.updated_at IS DISTINCT FROM p_expected_updated_at OR v_invoice.e_invoice_metadata->>'format' IS DISTINCT FROM 'xrechnung' THEN
    RAISE EXCEPTION 'Der Rechnungsentwurf wurde inzwischen geändert. Bitte erneut prüfen.' USING ERRCODE='40001';
  END IF;
  SELECT * INTO v_validation FROM care_security.office_einvoice_validations WHERE tenant_id=p_tenant_id AND invoice_id=p_invoice_id
    AND expected_updated_at=p_expected_updated_at AND source_revision=p_source_revision AND invoice_number=p_invoice_number AND xml_sha256=v_hash
    AND report->>'status'='valid' ORDER BY created_at DESC LIMIT 1;
  IF NOT FOUND THEN
    INSERT INTO care_security.office_einvoice_validations(tenant_id,invoice_id,expected_updated_at,source_revision,invoice_number,xml_bytes,xml_sha256,report,actor_id)
      VALUES(p_tenant_id,p_invoice_id,p_expected_updated_at,p_source_revision,p_invoice_number,v_xml,v_hash,p_report,p_actor_id) RETURNING * INTO v_validation;
  END IF;
  RETURN jsonb_build_object('validation_id',v_validation.id,'xml_sha256',v_validation.xml_sha256);
END
$body$;
REVOKE ALL ON FUNCTION care_security.office_einvoice_record_validation(uuid,uuid,timestamptz,text,text,text,jsonb,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION care_security.office_einvoice_record_validation(uuid,uuid,timestamptz,text,text,text,jsonb,uuid) TO service_role;
CREATE OR REPLACE FUNCTION public.office_einvoice_record_validation(
  p_tenant_id uuid,p_invoice_id uuid,p_expected_updated_at timestamptz,p_source_revision text,p_invoice_number text,
  p_xml_base64 text,p_report jsonb,p_actor_id uuid)
RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path=pg_catalog AS $body$
  SELECT care_security.office_einvoice_record_validation(p_tenant_id,p_invoice_id,p_expected_updated_at,p_source_revision,p_invoice_number,p_xml_base64,p_report,p_actor_id)
$body$;
REVOKE ALL ON FUNCTION public.office_einvoice_record_validation(uuid,uuid,timestamptz,text,text,text,jsonb,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.office_einvoice_record_validation(uuid,uuid,timestamptz,text,text,text,jsonb,uuid) TO service_role;

CREATE OR REPLACE FUNCTION care_security.office_einvoice_inbox_validation(
  p_tenant_id uuid,p_document_id uuid,p_original_sha256 text,p_report jsonb,p_actor_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $body$
DECLARE v_document care_security.office_einvoice_documents;v_validation care_security.office_einvoice_validations;v_status text;
BEGIN
  IF NOT coalesce(care_security.office_einvoice_server_actor(p_tenant_id,p_actor_id,'office.invoices.view'),false)
    OR NOT coalesce(care_security.office_einvoice_server_actor(p_tenant_id,p_actor_id,'office.invoices.create'),false) THEN
    RAISE EXCEPTION 'Nur der freigegebene Serverprozess darf Formatprüfungen speichern.' USING ERRCODE='42501';
  END IF;
  SELECT * INTO v_document FROM care_security.office_einvoice_documents WHERE tenant_id=p_tenant_id AND id=p_document_id FOR UPDATE;
  IF NOT FOUND OR v_document.original_sha256 IS DISTINCT FROM p_original_sha256 OR v_document.extracted_xml_bytes IS NULL THEN
    RAISE EXCEPTION 'Das gespeicherte Rechnungsoriginal oder sein strukturierter Datensatz ist nicht verfügbar.' USING ERRCODE='40001';
  END IF;
  PERFORM care_security.office_einvoice_check_report(p_report,v_document.extracted_xml_sha256,false);
  INSERT INTO care_security.office_einvoice_validations(tenant_id,document_id,xml_bytes,xml_sha256,report,actor_id)
    VALUES(p_tenant_id,p_document_id,v_document.extracted_xml_bytes,v_document.extracted_xml_sha256,p_report,p_actor_id) RETURNING * INTO v_validation;
  v_status:=p_report->>'status';
  UPDATE care_security.office_einvoice_documents SET format_status=v_status,validation_id=v_validation.id,
    updated_at=greatest(clock_timestamp(),updated_at+interval '1 microsecond') WHERE tenant_id=p_tenant_id AND id=p_document_id RETURNING * INTO v_document;
  INSERT INTO care_security.office_einvoice_events(tenant_id,document_id,actor_id,operation,details)
    VALUES(p_tenant_id,p_document_id,p_actor_id,'validate',jsonb_build_object('validation_id',v_validation.id,'format_status',v_status,'xml_sha256',v_validation.xml_sha256));
  RETURN jsonb_build_object('document_id',p_document_id,'updated_at',v_document.updated_at,'validation_id',v_validation.id,'format_status',v_status);
END
$body$;
REVOKE ALL ON FUNCTION care_security.office_einvoice_inbox_validation(uuid,uuid,text,jsonb,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION care_security.office_einvoice_inbox_validation(uuid,uuid,text,jsonb,uuid) TO service_role;
CREATE OR REPLACE FUNCTION public.office_einvoice_inbox_validation(
  p_tenant_id uuid,p_document_id uuid,p_original_sha256 text,p_report jsonb,p_actor_id uuid)
RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path=pg_catalog AS $body$
  SELECT care_security.office_einvoice_inbox_validation(p_tenant_id,p_document_id,p_original_sha256,p_report,p_actor_id)
$body$;
REVOKE ALL ON FUNCTION public.office_einvoice_inbox_validation(uuid,uuid,text,jsonb,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.office_einvoice_inbox_validation(uuid,uuid,text,jsonb,uuid) TO service_role;

CREATE OR REPLACE FUNCTION care_security.office_einvoice_artifact_read(p_tenant_id uuid,p_invoice_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $body$
DECLARE v_invoice public.invoices;v_validation care_security.office_einvoice_validations;
BEGIN
  IF auth.uid() IS NULL OR p_tenant_id IS DISTINCT FROM public.current_tenant_id()
    OR (public.current_portal_type() IS NOT NULL AND public.current_portal_type()<>'business')
    OR NOT coalesce(care_security.office_actor(p_tenant_id,'office.invoices.view'),false) THEN
    RAISE EXCEPTION 'Keine Berechtigung zum Rechnungsoriginal.' USING ERRCODE='42501';
  END IF;
  SELECT * INTO v_invoice FROM public.invoices WHERE tenant_id=p_tenant_id AND id=p_invoice_id;
  IF NOT FOUND OR NOT v_invoice.office_managed OR v_invoice.issued_at IS NULL OR v_invoice.e_invoice_validation_id IS NULL THEN
    RAISE EXCEPTION 'Für diese Rechnung ist kein ausgestelltes XML-Original vorhanden.' USING ERRCODE='P0002';
  END IF;
  SELECT * INTO v_validation FROM care_security.office_einvoice_validations WHERE tenant_id=p_tenant_id AND invoice_id=p_invoice_id
    AND id=v_invoice.e_invoice_validation_id AND xml_sha256=v_invoice.e_invoice_xml_sha256 AND invoice_number=v_invoice.invoice_number;
  IF NOT FOUND THEN RAISE EXCEPTION 'Das archivierte XML-Original ist nicht verfügbar.' USING ERRCODE='P0002'; END IF;
  RETURN jsonb_build_object('file_name',v_invoice.invoice_number||'.xml','xml_base64',encode(v_validation.xml_bytes,'base64'),
    'xml_sha256',v_validation.xml_sha256,'report',v_validation.report);
END
$body$;
REVOKE ALL ON FUNCTION care_security.office_einvoice_artifact_read(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION care_security.office_einvoice_artifact_read(uuid,uuid) TO authenticated;
CREATE OR REPLACE FUNCTION public.office_einvoice_artifact_read(p_tenant_id uuid,p_invoice_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path=pg_catalog AS $body$
  SELECT care_security.office_einvoice_artifact_read(p_tenant_id,p_invoice_id)
$body$;
REVOKE ALL ON FUNCTION public.office_einvoice_artifact_read(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.office_einvoice_artifact_read(uuid,uuid) TO authenticated;

-- A client-provided success flag or XML draft cannot authorize issuance. The
-- private immutable receipt must match the invoice's exact frozen data.
CREATE OR REPLACE FUNCTION care_security.office_einvoice_issue_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $body$
BEGIN
  IF TG_OP='UPDATE' AND OLD.issued_at IS NOT NULL AND
    ROW(NEW.e_invoice_metadata,NEW.e_invoice_xml_sha256,NEW.e_invoice_validation_id) IS DISTINCT FROM
    ROW(OLD.e_invoice_metadata,OLD.e_invoice_xml_sha256,OLD.e_invoice_validation_id) THEN
    RAISE EXCEPTION 'Die E-Rechnungsangaben einer ausgestellten Rechnung sind unveränderlich.' USING ERRCODE='42501';
  END IF;
  IF NEW.office_managed AND NEW.e_invoice_metadata->>'format'='xrechnung' AND
    (NEW.issued_at IS NOT NULL OR NEW.status::text IN ('ready','sent','partly_paid','paid','overdue')) THEN
    IF auth.uid() IS NULL OR NOT EXISTS(SELECT 1 FROM care_security.office_einvoice_validations v
      WHERE v.id=NEW.e_invoice_validation_id AND v.tenant_id=NEW.tenant_id AND v.invoice_id=NEW.id
        AND v.xml_sha256=NEW.e_invoice_xml_sha256 AND v.invoice_number=NEW.invoice_number
        AND v.expected_updated_at=(NEW.issued_snapshot#>>'{invoice,updated_at}')::timestamptz
        AND v.source_revision=md5(NEW.issued_snapshot::text) AND v.report->>'status'='valid'
        AND v.report->>'source'='server' AND v.report->>'documentSha256'=NEW.e_invoice_xml_sha256) THEN
      RAISE EXCEPTION 'Die vollständige Formatprüfung für genau diesen Rechnungsstand fehlt. Bitte die Rechnung erneut prüfen.' USING ERRCODE='55000';
    END IF;
  END IF;
  RETURN NEW;
END
$body$;
REVOKE ALL ON FUNCTION care_security.office_einvoice_issue_guard() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS office_einvoice_issue_guard ON public.invoices;
CREATE TRIGGER office_einvoice_issue_guard BEFORE INSERT OR UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION care_security.office_einvoice_issue_guard();

-- A zero-VAT position may carry its own explicit exemption reason. The legacy
-- common footer remains a fallback; every uncovered zero-VAT position blocks release.
CREATE OR REPLACE FUNCTION care_security.office_invoice_issue_preview(p_tenant_id uuid,p_invoice_id uuid,p_expected_updated_at timestamptz)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog AS $body$
DECLARE v_invoice public.invoices;v_settings public.tenant_billing_settings;v_company jsonb;v_lines jsonb;v_sources jsonb;
  v_proofs jsonb;v_number text;v_next integer;v_snapshot jsonb;v_name text;v_total numeric;v_source public.service_records;
BEGIN
  IF auth.uid() IS NULL OR p_tenant_id IS DISTINCT FROM public.current_tenant_id()
    OR (public.current_portal_type() IS NOT NULL AND public.current_portal_type()<>'business')
    OR NOT coalesce(care_security.office_actor(p_tenant_id,'office.invoices.view'),false)
    OR NOT coalesce(care_security.office_actor(p_tenant_id,'office.invoices.status_change'),false) THEN
    RAISE EXCEPTION 'Keine Berechtigung zur Rechnungsfreigabe.' USING ERRCODE='42501';
  END IF;
  SELECT * INTO v_invoice FROM public.invoices WHERE tenant_id=p_tenant_id AND id=p_invoice_id;
  IF NOT FOUND OR NOT v_invoice.office_managed OR v_invoice.status<>'draft' OR v_invoice.issued_at IS NOT NULL
    OR p_expected_updated_at IS NULL OR v_invoice.updated_at IS DISTINCT FROM p_expected_updated_at THEN
    RAISE EXCEPTION 'Der Rechnungsentwurf wurde inzwischen geändert. Bitte aktualisieren.' USING ERRCODE='40001';
  END IF;
  SELECT * INTO v_settings FROM public.tenant_billing_settings WHERE tenant_id=p_tenant_id;
  IF NOT FOUND OR v_settings.next_invoice_number IS NULL OR v_settings.next_invoice_number<1
    OR nullif(btrim(v_settings.invoice_prefix),'') IS NULL THEN
    RAISE EXCEPTION 'Rechnungspräfix und nächste Rechnungsnummer müssen in den Unternehmenseinstellungen hinterlegt sein.';
  END IF;
  v_next:=v_settings.next_invoice_number;
  LOOP
    IF v_next>=2147483647 THEN RAISE EXCEPTION 'Der Rechnungsnummernkreis ist ausgeschöpft.'; END IF;
    v_number:=btrim(v_settings.invoice_prefix)||'-'||to_char(v_invoice.invoice_date,'YYYY')||'-'||lpad(v_next::text,greatest(5,length(v_next::text)),'0');
    EXIT WHEN NOT EXISTS(SELECT 1 FROM public.invoices WHERE tenant_id=p_tenant_id AND invoice_number=v_number AND id<>p_invoice_id);
    v_next:=v_next+1;
  END LOOP;
  v_company:=care_security.office_invoice_company(p_tenant_id);
  FOREACH v_name IN ARRAY ARRAY['legalName','street','postalCode','city','country','bankName','iban'] LOOP
    IF nullif(btrim(v_company->>v_name),'') IS NULL THEN RAISE EXCEPTION 'Unternehmensangabe für die Rechnung fehlt: %.',v_name; END IF;
  END LOOP;
  IF nullif(btrim(v_company->>'taxNumber'),'') IS NULL AND nullif(btrim(v_company->>'vatId'),'') IS NULL THEN
    RAISE EXCEPTION 'Steuernummer oder Umsatzsteuer-ID des Unternehmens fehlt.';
  END IF;
  IF v_invoice.due_date IS NULL OR v_invoice.due_date<v_invoice.invoice_date OR v_invoice.service_period_from IS NULL
    OR v_invoice.service_period_to IS NULL OR v_invoice.service_period_to<v_invoice.service_period_from
    OR nullif(btrim(v_invoice.recipient_name),'') IS NULL OR nullif(btrim(v_invoice.recipient_street),'') IS NULL
    OR nullif(btrim(v_invoice.recipient_postal_code),'') IS NULL OR nullif(btrim(v_invoice.recipient_city),'') IS NULL THEN
    RAISE EXCEPTION 'Empfänger, Leistungszeitraum oder Fälligkeitsdatum ist unvollständig.';
  END IF;
  SELECT jsonb_agg(to_jsonb(i) ORDER BY i.sort_order,i.id),sum(i.gross_amount) INTO v_lines,v_total
    FROM public.invoice_items i WHERE tenant_id=p_tenant_id AND invoice_id=p_invoice_id;
  IF v_lines IS NULL OR v_total IS DISTINCT FROM v_invoice.total_amount OR v_total<=0 THEN
    RAISE EXCEPTION 'Die gespeicherten Rechnungspositionen und Rechnungssumme stimmen nicht überein.';
  END IF;
  IF EXISTS(SELECT 1 FROM public.invoice_items WHERE tenant_id=p_tenant_id AND invoice_id=p_invoice_id AND vat_rate=0
      AND nullif(btrim(e_invoice_tax->>'exemptionReason'),'') IS NULL
      AND nullif(btrim(e_invoice_tax->>'exemptionReasonCode'),'') IS NULL)
    AND nullif(btrim(v_invoice.footer_text),'') IS NULL THEN
    RAISE EXCEPTION 'Bitte die Grundlage für Rechnungspositionen ohne Umsatzsteuer angeben.';
  END IF;
  IF EXISTS(SELECT 1 FROM public.invoice_items i LEFT JOIN public.service_records s ON s.id=i.service_record_id AND s.tenant_id=i.tenant_id
    WHERE i.tenant_id=p_tenant_id AND i.invoice_id=p_invoice_id AND i.service_record_id IS NOT NULL
      AND (s.id IS NULL OR s.billed_invoice_id IS DISTINCT FROM p_invoice_id OR s.client_id IS DISTINCT FROM v_invoice.client_id
        OR s.status::text NOT IN ('approved','billable') OR s.total_amount IS DISTINCT FROM i.net_amount)) THEN
    RAISE EXCEPTION 'Eine Rechnungsquelle hat sich geändert oder ist nicht mehr abrechenbar.';
  END IF;
  FOR v_source IN SELECT * FROM public.service_records WHERE tenant_id=p_tenant_id AND billed_invoice_id=p_invoice_id ORDER BY id LOOP
    PERFORM care_security.office_invoice_assert_source(v_source,true);
  END LOOP;
  SELECT coalesce(jsonb_agg(to_jsonb(s) ORDER BY s.id),'[]'::jsonb) INTO v_sources FROM public.service_records s
    WHERE s.tenant_id=p_tenant_id AND s.billed_invoice_id=p_invoice_id;
  v_proofs:=care_security.office_invoice_proofs(v_invoice);
  v_snapshot:=jsonb_build_object('invoice',to_jsonb(v_invoice),'lines',v_lines,'sources',v_sources,'proofs',v_proofs,
    'company',v_company,'invoice_number',v_number);
  RETURN jsonb_build_object('invoice_number',v_number,'company_snapshot',v_company,'source_revision',md5(v_snapshot::text),
    'snapshot',v_snapshot,'next_invoice_number',v_next+1);
END
$body$;
REVOKE ALL ON FUNCTION care_security.office_invoice_issue_preview(uuid,uuid,timestamptz) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION care_security.office_invoice_issue_preview(uuid,uuid,timestamptz) TO authenticated;

-- The existing lifecycle implementation below is preserved apart from atomic
-- structured metadata persistence and a shared lock on seller tax settings.
-- Its existing issue snapshot uses to_jsonb(invoice/lines), so the additional
-- fields participate in revision checking and immutable snapshots automatically.

CREATE OR REPLACE FUNCTION care_security.office_invoice_mutation(
  p_tenant_id uuid,p_request_id uuid,p_invoice_id uuid,p_expected_updated_at timestamptz,p_operation text,p_payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $body$
DECLARE
  v_invoice public.invoices;v_client public.clients;v_source public.service_records;
  v_request care_security.office_invoice_requests;v_actor uuid;v_id uuid;v_hash text;v_result jsonb;
  v_line jsonb;v_key text;v_keys uuid[]:='{}';v_proofs text[]:='{}';v_lines jsonb:='[]';v_line_id uuid;
  v_quantity numeric;v_price numeric;v_rate numeric;v_net numeric;v_tax numeric;v_subtotal numeric:=0;v_taxes numeric:=0;
  v_start date;v_end date;v_date date;v_due date;v_service_date date;v_include boolean;v_sort integer:=0;
  v_einvoice_metadata jsonb;v_einvoice_tax jsonb;v_einvoice_validation care_security.office_einvoice_validations;
  v_preview jsonb;v_paid numeric;v_amount numeric;v_status text;v_payment_date date;v_now timestamptz:=clock_timestamp();
BEGIN
  IF auth.uid() IS NULL OR p_tenant_id IS DISTINCT FROM public.current_tenant_id()
    OR (public.current_portal_type() IS NOT NULL AND public.current_portal_type()<>'business')
    OR NOT coalesce(care_security.office_actor(p_tenant_id,'office.invoices.view'),false)
    OR NOT coalesce(care_security.office_actor(p_tenant_id,CASE WHEN p_operation='save_draft' THEN 'office.invoices.create' ELSE 'office.invoices.status_change' END),false) THEN
    RAISE EXCEPTION 'Keine Berechtigung für diese Rechnungsbearbeitung.' USING ERRCODE='42501';
  END IF;
  IF p_request_id IS NULL OR p_operation IS NULL OR p_operation NOT IN ('save_draft','delete_draft','set_status','record_payment')
    OR jsonb_typeof(p_payload) IS DISTINCT FROM 'object' OR octet_length(p_payload::text)>2000000 THEN
    RAISE EXCEPTION 'Ungültiger Rechnungsauftrag.' USING ERRCODE='22023';
  END IF;
  SELECT id INTO v_actor FROM public.profiles WHERE tenant_id=p_tenant_id AND is_active IS TRUE AND status::text='active'
    AND (auth_user_id=auth.uid() OR (auth_user_id IS NULL AND id=auth.uid()));
  IF v_actor IS NULL THEN RAISE EXCEPTION 'Aktives Verwaltungsprofil fehlt.' USING ERRCODE='42501'; END IF;
  v_hash:=md5(jsonb_build_array(p_invoice_id,p_expected_updated_at,p_operation,p_payload)::text);
  PERFORM pg_advisory_xact_lock(hashtextextended('office-invoice-request:'||p_tenant_id||':'||p_request_id,0));
  SELECT * INTO v_request FROM care_security.office_invoice_requests WHERE tenant_id=p_tenant_id AND request_id=p_request_id;
  IF FOUND THEN
    IF v_request.actor_id IS DISTINCT FROM auth.uid() OR v_request.request_hash IS DISTINCT FROM v_hash THEN
      RAISE EXCEPTION 'Diese Speicherkennung wurde bereits für einen anderen Vorgang verwendet.' USING ERRCODE='22023';
    END IF;
    RETURN v_request.result;
  END IF;
  v_id:=coalesce(p_invoice_id,gen_random_uuid());
  PERFORM pg_advisory_xact_lock(hashtextextended('office-invoice:'||p_tenant_id||':'||v_id,0));
  IF p_invoice_id IS NOT NULL THEN
    SELECT * INTO v_invoice FROM public.invoices WHERE tenant_id=p_tenant_id AND id=p_invoice_id FOR UPDATE;
    IF NOT FOUND OR p_expected_updated_at IS NULL OR v_invoice.updated_at IS DISTINCT FROM p_expected_updated_at THEN
      RAISE EXCEPTION 'Die Rechnung wurde inzwischen geändert. Bitte aktualisieren und erneut prüfen.' USING ERRCODE='40001';
    END IF;
    IF NOT v_invoice.office_managed AND (p_operation<>'save_draft' OR v_invoice.status<>'draft' OR v_invoice.sent_at IS NOT NULL
      OR v_invoice.pdf_file_path IS NOT NULL OR EXISTS(SELECT 1 FROM public.payments WHERE tenant_id=p_tenant_id AND invoice_id=v_id)) THEN
      RAISE EXCEPTION 'Diese bestehende Rechnung bleibt unverändert. Nur unversendete Entwürfe können übernommen werden.';
    END IF;
  ELSIF p_operation<>'save_draft' OR p_expected_updated_at IS NOT NULL THEN
    RAISE EXCEPTION 'Rechnungskennung oder Bearbeitungsstand fehlt.';
  END IF;
  INSERT INTO care_security.office_invoice_write_context(transaction_id,tenant_id,invoice_id,actor_id)
    VALUES(txid_current(),p_tenant_id,v_id,auth.uid());

  IF p_operation='save_draft' THEN
    IF p_invoice_id IS NOT NULL AND (v_invoice.status<>'draft' OR v_invoice.issued_at IS NOT NULL
      OR v_invoice.sent_at IS NOT NULL OR v_invoice.pdf_file_path IS NOT NULL) THEN RAISE EXCEPTION 'Ausgestellte Rechnungen sind unveränderlich.'; END IF;
    v_einvoice_metadata:=care_security.office_einvoice_check_metadata(
      CASE WHEN p_payload ? 'e_invoice_metadata' THEN p_payload->'e_invoice_metadata' ELSE coalesce(v_invoice.e_invoice_metadata,'{}'::jsonb) END,false);
    SELECT * INTO v_client FROM public.clients WHERE tenant_id=p_tenant_id AND id=(p_payload->>'client_id')::uuid AND deleted_at IS NULL FOR SHARE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Die gewählte Klientenakte ist nicht verfügbar.'; END IF;
    FOREACH v_key IN ARRAY ARRAY['invoice_date','due_date','service_period_from','service_period_to'] LOOP
      IF coalesce(p_payload->>v_key,'') !~ '^\d{4}-\d{2}-\d{2}$' THEN RAISE EXCEPTION 'Ungültiges Rechnungsdatum: %.',v_key; END IF;
    END LOOP;
    v_date:=(p_payload->>'invoice_date')::date;v_due:=(p_payload->>'due_date')::date;
    v_start:=(p_payload->>'service_period_from')::date;v_end:=(p_payload->>'service_period_to')::date;
    IF v_due<v_date OR v_end<v_start OR v_date<'2000-01-01' OR v_date>'2100-12-31' THEN RAISE EXCEPTION 'Rechnungsdaten oder Leistungszeitraum sind ungültig.'; END IF;
    FOREACH v_key IN ARRAY ARRAY['recipient_name','recipient_street','recipient_postal_code','recipient_city','recipient_country'] LOOP
      IF nullif(btrim(p_payload->>v_key),'') IS NULL THEN RAISE EXCEPTION 'Die Empfängeranschrift ist unvollständig.'; END IF;
    END LOOP;
    FOREACH v_key IN ARRAY ARRAY['recipient_name','recipient_street','recipient_house_number','recipient_postal_code','recipient_city','recipient_country','recipient_email'] LOOP
      IF length(coalesce(p_payload->>v_key,''))>500 THEN RAISE EXCEPTION 'Eine Empfängerangabe ist zu lang.'; END IF;
    END LOOP;
    IF length(coalesce(p_payload->>'notes',''))>10000 OR length(coalesce(p_payload->>'footer_text',''))>10000
      OR (nullif(btrim(p_payload->>'recipient_email'),'') IS NOT NULL AND p_payload->>'recipient_email' !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$') THEN
      RAISE EXCEPTION 'Notiz, Rechnungstext oder E-Mail-Adresse ist ungültig.';
    END IF;
    IF jsonb_typeof(p_payload->'include_service_proofs') IS DISTINCT FROM 'boolean'
      OR jsonb_typeof(p_payload->'lines') IS DISTINCT FROM 'array' OR jsonb_array_length(p_payload->'lines') NOT BETWEEN 1 AND 500
      OR jsonb_typeof(coalesce(p_payload->'selected_proof_ids','[]')) IS DISTINCT FROM 'array' THEN
      RAISE EXCEPTION 'Rechnungspositionen oder Anlagenauswahl fehlen.';
    END IF;
    v_include:=(p_payload->>'include_service_proofs')::boolean;
    SELECT coalesce(array_agg(x),'{}') INTO v_proofs FROM jsonb_array_elements_text(coalesce(p_payload->'selected_proof_ids','[]')) x;
    -- Lock the union of retained and removed sources in stable order. Other
    -- invoice runs cannot claim any of these records between check and commit.
    SELECT coalesce(array_agg(DISTINCT (x->>'service_record_id')::uuid),'{}') INTO v_keys
      FROM jsonb_array_elements(p_payload->'lines') x WHERE nullif(x->>'service_record_id','') IS NOT NULL;
    -- Follow the existing workflow's assignment-before-source lock order.
    PERFORM 1 FROM public.assignments WHERE tenant_id=p_tenant_id AND id IN (
      SELECT assignment_id FROM public.service_records WHERE tenant_id=p_tenant_id
        AND (id=ANY(v_keys) OR billed_invoice_id=v_id OR ('record:'||id)=ANY(v_proofs))) ORDER BY id FOR SHARE;
    PERFORM 1 FROM public.service_records WHERE tenant_id=p_tenant_id
      AND (id=ANY(v_keys) OR billed_invoice_id=v_id OR ('record:'||id)=ANY(v_proofs)) ORDER BY id FOR UPDATE;
    IF cardinality(v_keys)<>(SELECT count(*) FROM jsonb_array_elements(p_payload->'lines') x WHERE nullif(x->>'service_record_id','') IS NOT NULL) THEN
      RAISE EXCEPTION 'Derselbe Leistungsnachweis ist mehrfach enthalten.';
    END IF;
    FOR v_line IN SELECT value FROM jsonb_array_elements(p_payload->'lines') LOOP
      IF jsonb_typeof(v_line) IS DISTINCT FROM 'object' OR nullif(btrim(v_line->>'description'),'') IS NULL
        OR length(v_line->>'description')>2000 OR nullif(btrim(v_line->>'unit'),'') IS NULL OR length(v_line->>'unit')>50
        OR coalesce(v_line->>'product_key','') NOT IN ('assist','pflege','stationaer','beratung') THEN RAISE EXCEPTION 'Eine Rechnungsposition ist unvollständig.'; END IF;
      FOREACH v_key IN ARRAY ARRAY['quantity','unit_price_cents','vat_rate'] LOOP
        IF jsonb_typeof(v_line->v_key) IS DISTINCT FROM 'number' OR v_line->>v_key !~ '^\d+(\.\d+)?$' THEN RAISE EXCEPTION 'Ein Positionsbetrag ist ungültig.'; END IF;
      END LOOP;
      v_quantity:=(v_line->>'quantity')::numeric;v_price:=(v_line->>'unit_price_cents')::numeric;v_rate:=(v_line->>'vat_rate')::numeric;
      IF v_quantity<=0 OR v_quantity>1000000 OR round(v_quantity,2)<>v_quantity OR v_price<0 OR v_price>100000000
        OR trunc(v_price)<>v_price OR v_rate<0 OR v_rate>100 OR round(v_rate,2)<>v_rate THEN
        RAISE EXCEPTION 'Menge, Einzelpreis oder Umsatzsteuersatz ist ungültig. Mengen dürfen zwei Nachkommastellen enthalten.';
      END IF;
      v_net:=round(v_quantity*v_price);v_tax:=round(v_net*v_rate/100);
      IF v_net+v_tax>9999999999 THEN RAISE EXCEPTION 'Der Positionsbetrag ist zu groß.'; END IF;
      v_service_date:=nullif(v_line->>'service_date','')::date;
      IF v_service_date IS NOT NULL AND v_service_date NOT BETWEEN v_start AND v_end THEN RAISE EXCEPTION 'Eine Leistung liegt außerhalb des Rechnungszeitraums.'; END IF;
      IF nullif(v_line->>'service_record_id','') IS NOT NULL THEN
        SELECT * INTO v_source FROM public.service_records WHERE tenant_id=p_tenant_id AND id=(v_line->>'service_record_id')::uuid;
        IF NOT FOUND OR v_source.client_id<>v_client.id OR v_source.service_date NOT BETWEEN v_start AND v_end
          OR (v_source.status::text NOT IN ('approved','billable') AND NOT (p_invoice_id IS NOT NULL AND NOT v_invoice.office_managed
            AND v_source.status::text='billed' AND v_source.billed_invoice_id=v_id))
          OR v_source.billed_invoice_id IS NOT NULL AND v_source.billed_invoice_id<>v_id
          OR v_source.updated_at IS DISTINCT FROM (v_line->>'source_updated_at')::timestamptz
          OR v_source.product_key::text IS DISTINCT FROM v_line->>'product_key' OR v_source.service_date IS DISTINCT FROM v_service_date
          OR v_source.total_amount IS NULL OR round(v_source.total_amount*100)<>v_net THEN
          RAISE EXCEPTION 'Ein Leistungsnachweis wurde geändert, ist bereits zugeordnet oder stimmt nicht mit der Rechnungsposition überein.' USING ERRCODE='40001';
        END IF;
        IF EXISTS(SELECT 1 FROM public.invoice_items i JOIN public.invoices parent ON parent.id=i.invoice_id
          WHERE i.service_record_id=v_source.id AND i.invoice_id<>v_id AND parent.status::text<>'cancelled') THEN
          RAISE EXCEPTION 'Dieser Leistungsnachweis ist bereits in einer anderen Rechnung enthalten.';
        END IF;
        PERFORM care_security.office_invoice_assert_source(v_source,true);
      END IF;
      v_line_id:=coalesce(nullif(v_line->>'id','')::uuid,gen_random_uuid());
      IF nullif(v_line->>'id','') IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.invoice_items WHERE tenant_id=p_tenant_id AND invoice_id=v_id AND id=v_line_id) THEN
        RAISE EXCEPTION 'Eine Rechnungsposition gehört nicht zu diesem Entwurf.';
      END IF;
      v_einvoice_tax:=NULL;
      IF NOT v_line ? 'e_invoice_tax' AND nullif(v_line->>'id','') IS NOT NULL THEN
        SELECT e_invoice_tax INTO v_einvoice_tax FROM public.invoice_items WHERE tenant_id=p_tenant_id AND invoice_id=v_id AND id=v_line_id;
      END IF;
      v_einvoice_tax:=care_security.office_einvoice_check_metadata(
        CASE WHEN v_line ? 'e_invoice_tax' THEN v_line->'e_invoice_tax' ELSE coalesce(v_einvoice_tax,'{}'::jsonb) END,true);
      v_lines:=v_lines||jsonb_build_array(v_line||jsonb_build_object('id',v_line_id,'net_cents',v_net,'tax_cents',v_tax,'e_invoice_tax',v_einvoice_tax));
      v_subtotal:=v_subtotal+v_net;v_taxes:=v_taxes+v_tax;
    END LOOP;
    IF v_subtotal+v_taxes<=0 OR v_subtotal+v_taxes>9999999999 THEN RAISE EXCEPTION 'Die Rechnungssumme ist ungültig oder zu groß.'; END IF;
    IF p_invoice_id IS NULL THEN
      INSERT INTO public.invoices(id,tenant_id,invoice_number,client_id,status,invoice_date,office_managed,created_by,updated_by)
        VALUES(v_id,p_tenant_id,'DRAFT-'||v_id,v_client.id,'draft',v_date,true,v_actor,v_actor);
    END IF;
    UPDATE public.invoices SET office_managed=true,client_id=v_client.id,invoice_date=v_date,due_date=v_due,e_invoice_metadata=v_einvoice_metadata,
      customer_snapshot=jsonb_build_object('id',v_client.id,'name',concat_ws(' ',v_client.first_name,v_client.last_name),
        'clientNumber',coalesce(v_client.client_number,''),'insuranceNumber',coalesce(v_client.insurance_number,'')),
      service_month=date_trunc('month',v_start)::date,service_period_from=v_start,service_period_to=v_end,
      recipient_type=coalesce(nullif(p_payload->>'recipient_type',''),CASE v_client.billing_party::text WHEN 'self_payer' THEN 'client' WHEN 'care_insurance' THEN 'care_insurance' WHEN 'health_insurance' THEN 'health_insurance' WHEN 'social_welfare' THEN 'social_welfare' ELSE 'other' END)::public.invoice_recipient_type,
      billing_party=coalesce(nullif(p_payload->>'billing_party',''),v_client.billing_party::text,'other')::public.billing_party,
      recipient_name=btrim(p_payload->>'recipient_name'),recipient_street=btrim(p_payload->>'recipient_street'),
      recipient_house_number=nullif(btrim(p_payload->>'recipient_house_number'),''),recipient_postal_code=btrim(p_payload->>'recipient_postal_code'),
      recipient_city=btrim(p_payload->>'recipient_city'),recipient_country=btrim(p_payload->>'recipient_country'),recipient_email=nullif(btrim(p_payload->>'recipient_email'),''),
      notes=nullif(btrim(p_payload->>'notes'),''),footer_text=nullif(btrim(p_payload->>'footer_text'),''),
      include_service_proofs=v_include,selected_proof_ids=v_proofs,subtotal_amount=v_subtotal/100,vat_amount=v_taxes/100,
      total_amount=(v_subtotal+v_taxes)/100,paid_amount=0,open_amount=(v_subtotal+v_taxes)/100,updated_by=v_actor
      WHERE id=v_id AND tenant_id=p_tenant_id RETURNING * INTO v_invoice;
    PERFORM care_security.office_invoice_proofs(v_invoice);
    UPDATE public.service_records SET billed_invoice_id=NULL,status=CASE WHEN status='billed' THEN 'billable'::public.service_record_status ELSE status END
      WHERE tenant_id=p_tenant_id AND billed_invoice_id=v_id AND NOT id=ANY(v_keys);
    DELETE FROM public.invoice_items WHERE tenant_id=p_tenant_id AND invoice_id=v_id;
    FOR v_line IN SELECT value FROM jsonb_array_elements(v_lines) LOOP
      INSERT INTO public.invoice_items(id,tenant_id,invoice_id,description,quantity,unit,unit_price,vat_rate,net_amount,vat_amount,gross_amount,
        product_key,service_date,service_record_id,sort_order,e_invoice_tax)
      VALUES((v_line->>'id')::uuid,p_tenant_id,v_id,btrim(v_line->>'description'),(v_line->>'quantity')::numeric,btrim(v_line->>'unit'),
        (v_line->>'unit_price_cents')::numeric/100,(v_line->>'vat_rate')::numeric,(v_line->>'net_cents')::numeric/100,
        (v_line->>'tax_cents')::numeric/100,((v_line->>'net_cents')::numeric+(v_line->>'tax_cents')::numeric)/100,
        (v_line->>'product_key')::public.product_key,nullif(v_line->>'service_date','')::date,nullif(v_line->>'service_record_id','')::uuid,v_sort,v_line->'e_invoice_tax');
      v_sort:=v_sort+1;
    END LOOP;
    UPDATE public.service_records SET billed_invoice_id=v_id,status=CASE WHEN status='billed' THEN 'billable'::public.service_record_status ELSE status END
      WHERE tenant_id=p_tenant_id AND id=ANY(v_keys) AND (billed_invoice_id IS NULL OR status='billed');

  ELSIF p_operation='delete_draft' THEN
    IF v_invoice.status<>'draft' OR v_invoice.issued_at IS NOT NULL OR v_invoice.pdf_file_path IS NOT NULL
      OR EXISTS(SELECT 1 FROM public.payments WHERE tenant_id=p_tenant_id AND invoice_id=v_id) THEN RAISE EXCEPTION 'Nur unversendete Rechnungsentwürfe ohne Zahlungen dürfen gelöscht werden.'; END IF;
    PERFORM 1 FROM public.service_records WHERE tenant_id=p_tenant_id AND billed_invoice_id=v_id ORDER BY id FOR UPDATE;
    UPDATE public.service_records SET billed_invoice_id=NULL WHERE tenant_id=p_tenant_id AND billed_invoice_id=v_id;
    DELETE FROM public.invoices WHERE tenant_id=p_tenant_id AND id=v_id;

  ELSIF p_operation='set_status' THEN
    v_status:=p_payload->>'status';
    IF v_status='ready' THEN
      IF v_invoice.status<>'draft' OR v_invoice.issued_at IS NOT NULL THEN RAISE EXCEPTION 'Nur Entwürfe können freigegeben werden.'; END IF;
      PERFORM 1 FROM public.assignments WHERE tenant_id=p_tenant_id AND id IN (
        SELECT assignment_id FROM public.service_records WHERE tenant_id=p_tenant_id
          AND (billed_invoice_id=v_id OR ('record:'||id)=ANY(v_invoice.selected_proof_ids))) ORDER BY id FOR SHARE;
      PERFORM 1 FROM public.service_records WHERE tenant_id=p_tenant_id AND (billed_invoice_id=v_id OR ('record:'||id)=ANY(v_invoice.selected_proof_ids)) ORDER BY id FOR UPDATE;
      PERFORM 1 FROM public.tenant_billing_settings WHERE tenant_id=p_tenant_id FOR UPDATE;
      PERFORM 1 FROM public.tenants WHERE id=p_tenant_id FOR SHARE;
      PERFORM 1 FROM public.tenant_tax_profiles WHERE tenant_id=p_tenant_id FOR SHARE;
      PERFORM 1 FROM public.tenant_bank_accounts WHERE tenant_id=p_tenant_id ORDER BY id FOR SHARE;
      PERFORM 1 FROM public.tenant_branding WHERE tenant_id=p_tenant_id FOR SHARE;
      v_preview:=care_security.office_invoice_issue_preview(p_tenant_id,v_id,p_expected_updated_at);
      IF coalesce(v_invoice.e_invoice_metadata->>'format','pdf')='pdf' AND care_security.office_einvoice_pdf_explicitly_blocked(v_invoice) THEN
        RAISE EXCEPTION 'Nach den bestätigten Rechnungsangaben ist eine strukturierte E-Rechnung erforderlich. Eine normale PDF kann hierfür nicht freigegeben werden.' USING ERRCODE='55000';
      END IF;
      IF p_payload->>'invoice_number' IS DISTINCT FROM v_preview->>'invoice_number'
        OR p_payload->>'source_revision' IS DISTINCT FROM v_preview->>'source_revision'
        OR p_payload->'company_snapshot' IS DISTINCT FROM v_preview->'company_snapshot' THEN
        RAISE EXCEPTION 'Rechnungsnummer oder Rechnungsdaten wurden inzwischen geändert. Bitte die Vorschau erneut erstellen.' USING ERRCODE='40001';
      END IF;
      IF v_invoice.e_invoice_metadata->>'format'='xrechnung' THEN
        IF coalesce(p_payload->>'e_invoice_xml_sha256','') !~ '^[0-9a-f]{64}$' THEN
          RAISE EXCEPTION 'Die Prüfsumme der vollständig geprüften XRechnung fehlt.' USING ERRCODE='55000';
        END IF;
        SELECT * INTO v_einvoice_validation FROM care_security.office_einvoice_validations
          WHERE tenant_id=p_tenant_id AND invoice_id=v_id AND expected_updated_at=p_expected_updated_at
            AND source_revision=v_preview->>'source_revision' AND invoice_number=v_preview->>'invoice_number'
            AND xml_sha256=p_payload->>'e_invoice_xml_sha256' AND report->>'status'='valid' AND report->>'source'='server'
          ORDER BY created_at DESC LIMIT 1;
        IF NOT FOUND THEN RAISE EXCEPTION 'Für diesen Rechnungsstand fehlt die vollständige serverseitige Formatprüfung.' USING ERRCODE='55000'; END IF;
      ELSIF nullif(p_payload->>'e_invoice_xml_sha256','') IS NOT NULL THEN
        RAISE EXCEPTION 'Der XML-Prüfnachweis passt nicht zum gewählten Rechnungsformat.' USING ERRCODE='22023';
      END IF;
      IF coalesce(p_payload->>'pdf_sha256','') !~ '^[0-9a-f]{64}$'
        OR p_payload->>'pdf_file_path' IS DISTINCT FROM 'tenant/'||p_tenant_id||'/generated/invoice-'||v_id||'/'||(p_payload->>'pdf_sha256')||'.pdf'
        OR NOT EXISTS(SELECT 1 FROM public.document_render_jobs WHERE tenant_id=p_tenant_id AND related_entity_table='invoices'
          AND related_entity_id=v_id AND job_status='completed' AND pdf_path=p_payload->>'pdf_file_path' AND created_by=v_actor)
        OR NOT EXISTS(SELECT 1 FROM storage.objects WHERE bucket_id='office-documents' AND name=p_payload->>'pdf_file_path'
          AND metadata->>'mimetype'='application/pdf' AND coalesce((metadata->>'size')::bigint,0)>0) THEN
        RAISE EXCEPTION 'Die fertige Rechnungs-PDF wurde nicht vollständig und unveränderlich gespeichert.';
      END IF;
      UPDATE public.tenant_billing_settings SET next_invoice_number=(v_preview->>'next_invoice_number')::integer WHERE tenant_id=p_tenant_id;
      UPDATE public.invoices SET status='ready',invoice_number=v_preview->>'invoice_number',payment_reference=v_preview->>'invoice_number',
        company_snapshot=v_preview->'company_snapshot',issued_snapshot=v_preview->'snapshot',issued_at=v_now,
        e_invoice_xml_sha256=v_einvoice_validation.xml_sha256,e_invoice_validation_id=v_einvoice_validation.id,
        pdf_file_path=p_payload->>'pdf_file_path',pdf_sha256=p_payload->>'pdf_sha256',updated_by=v_actor
        WHERE tenant_id=p_tenant_id AND id=v_id RETURNING * INTO v_invoice;
      UPDATE public.service_records SET status='billed' WHERE tenant_id=p_tenant_id AND billed_invoice_id=v_id;
    ELSIF v_status='sent' THEN
      IF v_invoice.status<>'ready' OR v_invoice.issued_at IS NULL OR v_invoice.pdf_file_path IS NULL
        OR coalesce(p_payload->>'delivery_channel','') NOT IN ('email','post','personal','other')
        OR coalesce(p_payload->>'delivery_date','') !~ '^\d{4}-\d{2}-\d{2}$'
        OR length(btrim(coalesce(p_payload->>'delivery_reference',''))) NOT BETWEEN 3 AND 500 THEN
        RAISE EXCEPTION 'Bitte den tatsächlichen Versand der ausgestellten Rechnung mit Datum, Versandweg und Referenz belegen.';
      END IF;
      v_date:=(p_payload->>'delivery_date')::date;
      IF v_date<(v_invoice.issued_at AT TIME ZONE 'Europe/Berlin')::date OR v_date>(clock_timestamp() AT TIME ZONE 'Europe/Berlin')::date THEN RAISE EXCEPTION 'Das Versanddatum ist ungültig.'; END IF;
      UPDATE public.invoices SET status='sent',sent_at=(v_date::timestamp AT TIME ZONE 'Europe/Berlin'),
        delivery_evidence=jsonb_build_object('channel',p_payload->>'delivery_channel','date',v_date,'reference',btrim(p_payload->>'delivery_reference'),'recorded_by',auth.uid(),'recorded_at',v_now),
        updated_by=v_actor WHERE tenant_id=p_tenant_id AND id=v_id RETURNING * INTO v_invoice;
    ELSIF v_status='cancelled' AND v_invoice.status='draft' AND v_invoice.issued_at IS NULL THEN
      IF length(btrim(coalesce(p_payload->>'reason',''))) NOT BETWEEN 5 AND 10000 THEN RAISE EXCEPTION 'Bitte einen nachvollziehbaren Stornogrund angeben.'; END IF;
      PERFORM 1 FROM public.service_records WHERE tenant_id=p_tenant_id AND billed_invoice_id=v_id ORDER BY id FOR UPDATE;
      UPDATE public.service_records SET billed_invoice_id=NULL WHERE tenant_id=p_tenant_id AND billed_invoice_id=v_id;
      UPDATE public.invoices SET status='cancelled',cancelled_at=v_now,cancellation_reason=btrim(p_payload->>'reason'),open_amount=0,updated_by=v_actor
        WHERE tenant_id=p_tenant_id AND id=v_id RETURNING * INTO v_invoice;
    ELSE
      RAISE EXCEPTION 'Dieser Statuswechsel ist nicht erlaubt. Ausgestellte Rechnungen bleiben unveränderlich; Zahlungen werden über Zahlungseingänge gebucht.';
    END IF;

  ELSIF p_operation='record_payment' THEN
    IF v_invoice.status::text NOT IN ('ready','sent','partly_paid','overdue') OR v_invoice.issued_at IS NULL OR v_invoice.pdf_file_path IS NULL THEN
      RAISE EXCEPTION 'Zahlungen können nur auf ausgestellte, offene Rechnungen gebucht werden.';
    END IF;
    IF jsonb_typeof(p_payload->'amount_cents') IS DISTINCT FROM 'number' OR coalesce(p_payload->>'amount_cents','') !~ '^\d+$'
      OR coalesce(p_payload->>'payment_date','') !~ '^\d{4}-\d{2}-\d{2}$'
      OR coalesce(p_payload->>'payment_method','') NOT IN ('bank_transfer','direct_debit','cash','card','paypal','stripe','other')
      OR length(btrim(coalesce(p_payload->>'reference',''))) NOT BETWEEN 1 AND 500 OR length(coalesce(p_payload->>'notes',''))>10000 THEN
      RAISE EXCEPTION 'Zahlungsbetrag, Zahlungsdatum, Zahlungsart oder Buchungsreferenz ist ungültig.';
    END IF;
    v_amount:=(p_payload->>'amount_cents')::numeric;v_payment_date:=(p_payload->>'payment_date')::date;
    IF v_amount<=0 OR v_amount>9999999999 OR v_payment_date>(clock_timestamp() AT TIME ZONE 'Europe/Berlin')::date
      OR v_payment_date<'2000-01-01' THEN RAISE EXCEPTION 'Der Zahlungseingang ist ungültig oder liegt in der Zukunft.'; END IF;
    PERFORM 1 FROM public.payments WHERE tenant_id=p_tenant_id AND invoice_id=v_id ORDER BY id FOR UPDATE;
    IF EXISTS(SELECT 1 FROM public.payments WHERE tenant_id=p_tenant_id AND invoice_id=v_id AND status::text IN ('booked','matched')
      AND payment_date=v_payment_date AND amount=v_amount/100 AND reference=btrim(p_payload->>'reference')) THEN
      RAISE EXCEPTION 'Dieser Zahlungseingang ist bereits gebucht. Bitte die Zahlungsübersicht prüfen.';
    END IF;
    SELECT coalesce(sum(amount),0) INTO v_paid FROM public.payments WHERE tenant_id=p_tenant_id AND invoice_id=v_id AND status::text IN ('booked','matched') AND currency='EUR';
    IF v_paid*100+v_amount>v_invoice.total_amount*100 THEN RAISE EXCEPTION 'Der Zahlungseingang übersteigt den offenen Rechnungsbetrag.'; END IF;
    INSERT INTO public.payments(tenant_id,invoice_id,client_id,payment_date,amount,currency,status,payment_method,reference,notes,matched_at,matched_by)
      VALUES(p_tenant_id,v_id,v_invoice.client_id,v_payment_date,v_amount/100,'EUR','matched',(p_payload->>'payment_method')::public.payment_method,
        btrim(p_payload->>'reference'),nullif(btrim(p_payload->>'notes'),''),v_now,v_actor);
    SELECT coalesce(sum(amount),0) INTO v_paid FROM public.payments WHERE tenant_id=p_tenant_id AND invoice_id=v_id AND status::text IN ('booked','matched') AND currency='EUR';
    UPDATE public.invoices SET paid_amount=v_paid,open_amount=total_amount-v_paid,
      status=CASE WHEN v_paid=total_amount THEN 'paid'::public.invoice_status ELSE 'partly_paid'::public.invoice_status END,
      paid_at=CASE WHEN v_paid=total_amount THEN v_now ELSE NULL END,updated_by=v_actor
      WHERE tenant_id=p_tenant_id AND id=v_id RETURNING * INTO v_invoice;
  END IF;
  v_result:=jsonb_build_object('invoice_id',v_id,'updated_at',CASE WHEN p_operation='delete_draft' THEN v_now ELSE v_invoice.updated_at END);
  INSERT INTO care_security.office_invoice_requests(tenant_id,request_id,actor_id,request_hash,invoice_id,operation,result)
    VALUES(p_tenant_id,p_request_id,auth.uid(),v_hash,v_id,p_operation,v_result);
  DELETE FROM care_security.office_invoice_write_context WHERE transaction_id=txid_current() AND tenant_id=p_tenant_id AND invoice_id=v_id;
  RETURN v_result;
END
$body$;
REVOKE ALL ON FUNCTION care_security.office_invoice_mutation(uuid,uuid,uuid,timestamptz,text,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION care_security.office_invoice_mutation(uuid,uuid,uuid,timestamptz,text,jsonb) TO authenticated;

COMMIT;
