-- CareSuite+ ambulant: S-06 — versionsgebundene Bestätigung genau eines Leistungsnachweises.
-- Eine Unterschrift bestätigt weder eine andere Position noch eine später geänderte Fassung.

CREATE TABLE IF NOT EXISTS public.pfleger_proof_client_confirmations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
 proof_id uuid NOT NULL UNIQUE REFERENCES public.pfleger_service_proofs(id) ON DELETE RESTRICT,
 client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE RESTRICT,
 signature_evidence_id uuid NOT NULL UNIQUE REFERENCES public.pfleger_signature_evidence(id) ON DELETE RESTRICT,
 confirmed_scope text NOT NULL DEFAULT 'one_proof_version' CHECK(confirmed_scope='one_proof_version'),
 proof_updated_at timestamptz NOT NULL,
 proof_content_snapshot jsonb NOT NULL,
 proof_content_hash text NOT NULL CHECK(proof_content_hash~'^[0-9a-f]{32}$'),
 signer_kind text NOT NULL CHECK(signer_kind IN('client','representative')),
 signer_name text NOT NULL CHECK(length(btrim(signer_name)) BETWEEN 2 AND 200),
 representation_basis text NOT NULL DEFAULT '' CHECK(length(representation_basis)<=1000),
 confirmed_by uuid NOT NULL REFERENCES auth.users(id),
 confirmed_at timestamptz NOT NULL,
 client_request_id uuid NOT NULL,
 request_fingerprint text NOT NULL CHECK(request_fingerprint~'^[0-9a-f]{32}$'),
 UNIQUE(tenant_id,client_request_id),
 CHECK((signer_kind='client' AND representation_basis='') OR (signer_kind='representative' AND length(btrim(representation_basis)) BETWEEN 3 AND 1000))
);
ALTER TABLE public.pfleger_proof_client_confirmations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.pfleger_proof_client_confirmations FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.pfleger_proof_client_confirmations TO authenticated;
DROP POLICY IF EXISTS pfleger_proof_client_confirmations_read ON public.pfleger_proof_client_confirmations;
CREATE POLICY pfleger_proof_client_confirmations_read ON public.pfleger_proof_client_confirmations FOR SELECT TO authenticated
 USING(tenant_id=public.current_tenant_id() AND public.has_permission('pflege.proofs.view'));

CREATE OR REPLACE FUNCTION care_private.protect_confirmed_proof_content() RETURNS trigger
 LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM public.pfleger_proof_client_confirmations c WHERE c.tenant_id=OLD.tenant_id AND c.proof_id=OLD.id)
  AND (NEW.client_id,NEW.documentation_entry_id,NEW.service_date,NEW.started_at,NEW.ended_at,NEW.duration_minutes,
   NEW.service_code,NEW.service_label,NEW.legal_basis,NEW.prescription_reference,NEW.cost_carrier_name,NEW.cost_carrier_ik,
   NEW.billing_unit,NEW.quantity,NEW.unit_price_cents,NEW.gross_amount_cents,NEW.performance_note,NEW.deviations,
   NEW.employee_profile_id,NEW.employee_name_snapshot,NEW.evidence_snapshot,NEW.tariff_id,NEW.admission_id)
  IS DISTINCT FROM
  (OLD.client_id,OLD.documentation_entry_id,OLD.service_date,OLD.started_at,OLD.ended_at,OLD.duration_minutes,
   OLD.service_code,OLD.service_label,OLD.legal_basis,OLD.prescription_reference,OLD.cost_carrier_name,OLD.cost_carrier_ik,
   OLD.billing_unit,OLD.quantity,OLD.unit_price_cents,OLD.gross_amount_cents,OLD.performance_note,OLD.deviations,
   OLD.employee_profile_id,OLD.employee_name_snapshot,OLD.evidence_snapshot,OLD.tariff_id,OLD.admission_id) THEN
  RAISE EXCEPTION 'Bestätigte Nachweisinhalte sind unveränderlich; eine Korrektur benötigt eine neue Fassung.' USING ERRCODE='40001';
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS protect_confirmed_pfleger_proof_content ON public.pfleger_service_proofs;
CREATE TRIGGER protect_confirmed_pfleger_proof_content BEFORE UPDATE OF client_id,documentation_entry_id,service_date,started_at,ended_at,
 duration_minutes,service_code,service_label,legal_basis,prescription_reference,cost_carrier_name,cost_carrier_ik,billing_unit,
 quantity,unit_price_cents,gross_amount_cents,performance_note,deviations,employee_profile_id,employee_name_snapshot,evidence_snapshot,
 tariff_id,admission_id ON public.pfleger_service_proofs FOR EACH ROW EXECUTE FUNCTION care_private.protect_confirmed_proof_content();

CREATE OR REPLACE FUNCTION care_private.capture_proof_client_confirmation(
 p_proof_id uuid,p_expected_proof_updated_at timestamptz,p_signer_kind text,p_signer_name text,
 p_representation_basis text,p_png_data_url text,p_request_id uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE t uuid:=public.current_tenant_id(); proof public.pfleger_service_proofs; line public.care_tour_stop_proof_lines;
 existing public.pfleger_proof_client_confirmations; evidence_id uuid; confirmation_id uuid:=gen_random_uuid();
 actual_time timestamptz:=clock_timestamp(); content jsonb; content_hash text; fingerprint text;
 signer_name text:=btrim(COALESCE(p_signer_name,'')); representation text:=btrim(COALESCE(p_representation_basis,''));
BEGIN
 IF auth.uid() IS NULL OR t IS NULL OR NOT public.has_permission('pflege.proofs.sign') THEN
  RAISE EXCEPTION 'Keine Berechtigung.' USING ERRCODE='42501';
 END IF;
 IF p_request_id IS NULL OR p_expected_proof_updated_at IS NULL OR p_signer_kind NOT IN('client','representative')
  OR length(signer_name) NOT BETWEEN 2 AND 200
  OR (p_signer_kind='client' AND representation<>'')
  OR (p_signer_kind='representative' AND length(representation) NOT BETWEEN 3 AND 1000)
  OR COALESCE(p_png_data_url,'')!~'^data:image/png;base64,iVBORw0KGgo[A-Za-z0-9+/=]+$'
  OR length(p_png_data_url) NOT BETWEEN 100 AND 1048576 THEN
  RAISE EXCEPTION 'Bestätigende Person, Vertretungsgrundlage und gültige PNG-Unterschrift sind erforderlich.' USING ERRCODE='23514';
 END IF;
 fingerprint:=md5(jsonb_build_object('proofId',p_proof_id,'expectedProofUpdatedAt',p_expected_proof_updated_at,
  'signerKind',p_signer_kind,'signerName',signer_name,'representationBasis',representation,'pngDataUrl',p_png_data_url)::text);
 SELECT * INTO existing FROM public.pfleger_proof_client_confirmations WHERE tenant_id=t AND client_request_id=p_request_id;
 IF FOUND THEN
  IF existing.proof_id IS DISTINCT FROM p_proof_id OR existing.confirmed_by IS DISTINCT FROM auth.uid()
   OR existing.request_fingerprint IS DISTINCT FROM fingerprint THEN
   RAISE EXCEPTION 'Diese Bestätigungsanfrage wurde bereits mit anderen Angaben verwendet.' USING ERRCODE='40001';
  END IF;
  RETURN jsonb_build_object('id',existing.id,'proofId',existing.proof_id,'signatureEvidenceId',existing.signature_evidence_id,'duplicate',true);
 END IF;
 SELECT * INTO proof FROM public.pfleger_service_proofs WHERE id=p_proof_id AND tenant_id=t FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Leistungsnachweis nicht gefunden.' USING ERRCODE='42501'; END IF;
 IF proof.updated_at IS DISTINCT FROM p_expected_proof_updated_at THEN
  RAISE EXCEPTION 'Der Leistungsnachweis wurde zwischenzeitlich geändert. Bitte neu laden.' USING ERRCODE='40001';
 END IF;
 IF proof.status NOT IN('draft','submitted') THEN RAISE EXCEPTION 'Dieser Nachweis kann nicht mehr bestätigt werden.' USING ERRCODE='23514'; END IF;
 IF EXISTS(SELECT 1 FROM public.pfleger_proof_client_confirmations c WHERE c.proof_id=proof.id) THEN
  RAISE EXCEPTION 'Für diese konkrete Nachweisfassung besteht bereits eine Bestätigung.' USING ERRCODE='40001';
 END IF;
 SELECT * INTO line FROM public.care_tour_stop_proof_lines WHERE tenant_id=t AND proof_id=proof.id;
 content:=jsonb_build_object('proof',jsonb_build_object(
  'id',proof.id,'tenantId',proof.tenant_id,'clientId',proof.client_id,'documentationEntryId',proof.documentation_entry_id,
  'serviceDate',proof.service_date,'startedAt',proof.started_at,'endedAt',proof.ended_at,'durationMinutes',proof.duration_minutes,
  'serviceCode',proof.service_code,'serviceLabel',proof.service_label,'legalBasis',proof.legal_basis,
  'prescriptionReference',proof.prescription_reference,'costCarrierName',proof.cost_carrier_name,'costCarrierIk',proof.cost_carrier_ik,
  'billingUnit',proof.billing_unit,'quantity',proof.quantity,'unitPriceCents',proof.unit_price_cents,'grossAmountCents',proof.gross_amount_cents,
  'performanceNote',proof.performance_note,'deviations',proof.deviations,'employeeProfileId',proof.employee_profile_id,
  'employeeNameSnapshot',proof.employee_name_snapshot,'tariffId',proof.tariff_id,'admissionId',proof.admission_id,
  'evidenceSnapshot',proof.evidence_snapshot,'createdAt',proof.created_at,'updatedAt',proof.updated_at),
  'batchPosition',CASE WHEN line.id IS NULL THEN NULL ELSE jsonb_build_object(
   'lineId',line.id,'batchId',line.batch_id,'tourId',line.tour_id,'stopId',line.stop_id,'positionNo',line.position_no,
   'tariffId',line.tariff_id,'admissionId',line.admission_id,'orderId',line.order_id,'quantity',line.quantity,
   'billingUnit',line.billing_unit,'legalBasis',line.legal_basis,'executionDetail',line.execution_detail,'deviation',line.deviation,
   'tariffSnapshot',line.tariff_snapshot,'admissionSnapshot',line.admission_snapshot,'orderSnapshot',line.order_snapshot) END);
 content_hash:=md5(content::text);
 INSERT INTO public.pfleger_signature_evidence(id,tenant_id,proof_id,signer_name,png_data_url,captured_by,captured_at)
 VALUES(gen_random_uuid(),t,proof.id,signer_name,p_png_data_url,auth.uid(),actual_time) RETURNING id INTO evidence_id;
 INSERT INTO public.pfleger_proof_client_confirmations(id,tenant_id,proof_id,client_id,signature_evidence_id,confirmed_scope,
  proof_updated_at,proof_content_snapshot,proof_content_hash,signer_kind,signer_name,representation_basis,confirmed_by,confirmed_at,
  client_request_id,request_fingerprint)
 VALUES(confirmation_id,t,proof.id,proof.client_id,evidence_id,'one_proof_version',proof.updated_at,content,content_hash,
  p_signer_kind,signer_name,representation,auth.uid(),actual_time,p_request_id,fingerprint);
 PERFORM care_private.advance_proof(proof.id,'sign',jsonb_build_object('signatureName',signer_name,'signatureRef',evidence_id::text));
 RETURN jsonb_build_object('id',confirmation_id,'proofId',proof.id,'signatureEvidenceId',evidence_id,'duplicate',false);
END $$;

CREATE OR REPLACE FUNCTION public.capture_pfleger_proof_client_confirmation(
 p_proof_id uuid,p_expected_proof_updated_at timestamptz,p_signer_kind text,p_signer_name text,
 p_representation_basis text,p_png_data_url text,p_request_id uuid
) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$
 SELECT care_private.capture_proof_client_confirmation(p_proof_id,p_expected_proof_updated_at,p_signer_kind,p_signer_name,p_representation_basis,p_png_data_url,p_request_id)
$$;
REVOKE ALL ON FUNCTION care_private.capture_proof_client_confirmation(uuid,timestamptz,text,text,text,text,uuid),
 public.capture_pfleger_proof_client_confirmation(uuid,timestamptz,text,text,text,text,uuid),care_private.protect_confirmed_proof_content() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION care_private.capture_proof_client_confirmation(uuid,timestamptz,text,text,text,text,uuid),
 public.capture_pfleger_proof_client_confirmation(uuid,timestamptz,text,text,text,text,uuid) TO authenticated;

