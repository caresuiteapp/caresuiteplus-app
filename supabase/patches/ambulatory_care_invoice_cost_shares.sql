-- Checkpoint 243 / U-11: Kostenträger- und Eigenanteile je freigegebener Rechnungsposition.
-- Lokaler additiver Entwurf; nicht gegen eine produktive Datenbank ausführen.

CREATE TABLE IF NOT EXISTS public.pfleger_invoice_cost_share_assessments (
  id uuid PRIMARY KEY,
  client_request_id uuid NOT NULL,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE RESTRICT,
  invoice_approval_id uuid NOT NULL REFERENCES public.pfleger_invoice_approvals(id) ON DELETE RESTRICT,
  invoice_draft_id uuid NOT NULL REFERENCES public.pfleger_invoice_drafts(id) ON DELETE RESTRICT,
  invoice_number text NOT NULL CHECK (btrim(invoice_number) <> ''),
  approval_version integer NOT NULL CHECK (approval_version >= 1),
  approval_approved_at timestamptz NOT NULL,
  document_fingerprint text NOT NULL CHECK (document_fingerprint ~ '^[0-9a-f]{32}$'),
  coverage_basis_id uuid NOT NULL,
  coverage_basis_version integer NOT NULL CHECK (coverage_basis_version >= 1),
  coverage_basis_fingerprint text NOT NULL CHECK (coverage_basis_fingerprint ~ '^[0-9a-f]{32}$'),
  position_count integer NOT NULL CHECK (position_count >= 1),
  approved_total_cents bigint NOT NULL CHECK (approved_total_cents BETWEEN 0 AND 999999999999),
  coverage_total_cents bigint NOT NULL CHECK (coverage_total_cents BETWEEN 0 AND 999999999999),
  personal_total_cents bigint NOT NULL CHECK (personal_total_cents BETWEEN 0 AND 999999999999),
  reconciliation_state text NOT NULL DEFAULT 'reconciled' CHECK (reconciliation_state = 'reconciled'),
  transmission_state text NOT NULL DEFAULT 'not_inferred' CHECK (transmission_state = 'not_inferred'),
  collection_state text NOT NULL DEFAULT 'not_inferred' CHECK (collection_state = 'not_inferred'),
  payment_state text NOT NULL DEFAULT 'not_inferred' CHECK (payment_state = 'not_inferred'),
  assessed_at timestamptz NOT NULL,
  assessed_by uuid NOT NULL REFERENCES auth.users(id),
  assessed_by_name text NOT NULL,
  request_fingerprint text NOT NULL CHECK (request_fingerprint ~ '^[0-9a-f]{32}$'),
  CHECK (coverage_total_cents + personal_total_cents = approved_total_cents),
  UNIQUE (tenant_id, client_request_id),
  UNIQUE (tenant_id, invoice_approval_id)
);

CREATE TABLE IF NOT EXISTS public.pfleger_invoice_cost_share_positions (
  assessment_id uuid NOT NULL REFERENCES public.pfleger_invoice_cost_share_assessments(id) ON DELETE RESTRICT,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE RESTRICT,
  position_no integer NOT NULL CHECK (position_no >= 1),
  billing_case_id uuid NOT NULL REFERENCES public.pfleger_billing_cases(id) ON DELETE RESTRICT,
  service_proof_id uuid NOT NULL REFERENCES public.pfleger_service_proofs(id) ON DELETE RESTRICT,
  service_date date NOT NULL,
  service_code text NOT NULL CHECK (btrim(service_code) <> ''),
  approved_amount_cents bigint NOT NULL CHECK (approved_amount_cents BETWEEN 0 AND 999999999999),
  payer_type text NOT NULL CHECK (payer_type IN ('insurance','self_payer')),
  coverage_recipient_id text,
  coverage_recipient_name text,
  coverage_recipient_ik text,
  coverage_recipient_address_fingerprint text,
  personal_recipient_id text NOT NULL CHECK (btrim(personal_recipient_id) <> ''),
  personal_recipient_name text NOT NULL CHECK (btrim(personal_recipient_name) <> ''),
  personal_recipient_address_fingerprint text NOT NULL CHECK (personal_recipient_address_fingerprint ~ '^[0-9a-f]{32}$'),
  coverage_share_cents bigint NOT NULL CHECK (coverage_share_cents BETWEEN 0 AND 999999999999),
  personal_share_cents bigint NOT NULL CHECK (personal_share_cents BETWEEN 0 AND 999999999999),
  personal_share_basis_kind text NOT NULL CHECK (personal_share_basis_kind IN ('calculated','exemption','documented_zero','self_payer')),
  exemption_evidence_id uuid,
  exemption_evidence_fingerprint text,
  exemption_valid_from date,
  exemption_valid_until date,
  exemption_recorded_at timestamptz,
  CHECK (coverage_share_cents + personal_share_cents = approved_amount_cents),
  CHECK (
    (payer_type='self_payer' AND coverage_share_cents=0 AND personal_share_cents=approved_amount_cents AND personal_share_basis_kind='self_payer'
      AND coverage_recipient_id IS NULL AND coverage_recipient_name IS NULL AND coverage_recipient_ik IS NULL AND coverage_recipient_address_fingerprint IS NULL
      AND exemption_evidence_id IS NULL AND exemption_evidence_fingerprint IS NULL AND exemption_valid_from IS NULL AND exemption_valid_until IS NULL AND exemption_recorded_at IS NULL)
    OR
    (payer_type='insurance' AND btrim(COALESCE(coverage_recipient_id,''))<>'' AND btrim(COALESCE(coverage_recipient_name,''))<>''
      AND btrim(COALESCE(coverage_recipient_ik,''))<>'' AND coverage_recipient_address_fingerprint ~ '^[0-9a-f]{32}$'
      AND (
        (personal_share_basis_kind='calculated' AND personal_share_cents>0 AND exemption_evidence_id IS NULL AND exemption_evidence_fingerprint IS NULL AND exemption_valid_from IS NULL AND exemption_valid_until IS NULL AND exemption_recorded_at IS NULL)
        OR (personal_share_basis_kind='documented_zero' AND personal_share_cents=0 AND coverage_share_cents=approved_amount_cents AND exemption_evidence_id IS NULL AND exemption_evidence_fingerprint IS NULL AND exemption_valid_from IS NULL AND exemption_valid_until IS NULL AND exemption_recorded_at IS NULL)
        OR (personal_share_basis_kind='exemption' AND personal_share_cents=0 AND coverage_share_cents=approved_amount_cents AND exemption_evidence_id IS NOT NULL AND exemption_evidence_fingerprint ~ '^[0-9a-f]{32}$' AND exemption_valid_from IS NOT NULL AND exemption_valid_until>=exemption_valid_from AND exemption_recorded_at IS NOT NULL)
      ))
  ),
  PRIMARY KEY (assessment_id, position_no),
  UNIQUE (assessment_id, billing_case_id),
  UNIQUE (assessment_id, service_proof_id)
);

ALTER TABLE public.pfleger_invoice_cost_share_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pfleger_invoice_cost_share_positions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.pfleger_invoice_cost_share_assessments, public.pfleger_invoice_cost_share_positions FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.pfleger_invoice_cost_share_assessments, public.pfleger_invoice_cost_share_positions TO authenticated;

DROP POLICY IF EXISTS pfleger_invoice_cost_share_assessments_read ON public.pfleger_invoice_cost_share_assessments;
CREATE POLICY pfleger_invoice_cost_share_assessments_read ON public.pfleger_invoice_cost_share_assessments FOR SELECT TO authenticated
  USING (tenant_id=public.current_tenant_id() AND public.has_permission('pflege.billing.view'));
DROP POLICY IF EXISTS pfleger_invoice_cost_share_positions_read ON public.pfleger_invoice_cost_share_positions;
CREATE POLICY pfleger_invoice_cost_share_positions_read ON public.pfleger_invoice_cost_share_positions FOR SELECT TO authenticated
  USING (tenant_id=public.current_tenant_id() AND public.has_permission('pflege.billing.view'));

CREATE OR REPLACE FUNCTION care_private.protect_pfleger_invoice_cost_share_history()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN
  RAISE EXCEPTION 'Festgestellte Kostenträger- und Eigenanteile bleiben unverändert.' USING ERRCODE='42501';
END $$;
DROP TRIGGER IF EXISTS protect_pfleger_invoice_cost_share_assessments ON public.pfleger_invoice_cost_share_assessments;
CREATE TRIGGER protect_pfleger_invoice_cost_share_assessments BEFORE UPDATE OR DELETE ON public.pfleger_invoice_cost_share_assessments
  FOR EACH ROW EXECUTE FUNCTION care_private.protect_pfleger_invoice_cost_share_history();
DROP TRIGGER IF EXISTS protect_pfleger_invoice_cost_share_positions ON public.pfleger_invoice_cost_share_positions;
CREATE TRIGGER protect_pfleger_invoice_cost_share_positions BEFORE UPDATE OR DELETE ON public.pfleger_invoice_cost_share_positions
  FOR EACH ROW EXECUTE FUNCTION care_private.protect_pfleger_invoice_cost_share_history();

CREATE OR REPLACE FUNCTION public.record_pfleger_invoice_cost_share_assessment(
  p_invoice_approval_id uuid,
  p_payload jsonb,
  p_client_request_id uuid
) RETURNS public.pfleger_invoice_cost_share_assessments
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  t uuid:=public.current_tenant_id(); actor uuid:=auth.uid(); actor_name text;
  approval public.pfleger_invoice_approvals; prior public.pfleger_invoice_cost_share_assessments;
  result public.pfleger_invoice_cost_share_assessments; actual_time timestamptz:=clock_timestamp();
  expected_count integer; actual_count integer; approved_total bigint; coverage_total bigint; personal_total bigint;
  first_position integer; last_position integer; request_fingerprint text;
BEGIN
  IF t IS NULL OR actor IS NULL OR NOT public.has_permission('pflege.invoices.manage') THEN RAISE EXCEPTION 'Keine Berechtigung.' USING ERRCODE='42501'; END IF;
  IF p_invoice_approval_id IS NULL OR p_client_request_id IS NULL OR p_payload IS NULL OR jsonb_typeof(p_payload->'lines')<>'array'
    OR COALESCE(p_payload->>'costShareAssessmentId','')='' OR COALESCE(p_payload->>'coverageBasisId','')=''
    OR COALESCE((p_payload->>'coverageBasisVersion')::integer,0)<1 OR COALESCE(p_payload->>'coverageBasisFingerprint','')!~'^[0-9a-f]{32}$' THEN
    RAISE EXCEPTION 'Anteilsfeststellung ist unvollständig.' USING ERRCODE='23514';
  END IF;
  request_fingerprint:=md5(jsonb_build_object('approvalId',p_invoice_approval_id,'payload',p_payload,'requestId',p_client_request_id)::text);
  PERFORM pg_advisory_xact_lock(hashtext(t::text),hashtext(p_client_request_id::text));
  SELECT * INTO prior FROM public.pfleger_invoice_cost_share_assessments WHERE tenant_id=t AND client_request_id=p_client_request_id;
  IF FOUND THEN
    IF prior.invoice_approval_id IS DISTINCT FROM p_invoice_approval_id OR prior.request_fingerprint IS DISTINCT FROM request_fingerprint THEN RAISE EXCEPTION 'Anforderungs-ID wurde anders verwendet.' USING ERRCODE='40001'; END IF;
    RETURN prior;
  END IF;
  PERFORM pg_advisory_xact_lock(hashtext(t::text),hashtext(p_invoice_approval_id::text));
  SELECT * INTO approval FROM public.pfleger_invoice_approvals WHERE tenant_id=t AND id=p_invoice_approval_id FOR SHARE;
  IF NOT FOUND OR approval.approval_version IS DISTINCT FROM (p_payload->>'approvalVersion')::integer OR approval.invoice_draft_id IS DISTINCT FROM (p_payload->>'invoiceDraftId')::uuid OR approval.document_fingerprint IS DISTINCT FROM p_payload->>'documentFingerprint' THEN
    RAISE EXCEPTION 'Freigegebene Rechnungsfassung ist nicht mehr unverändert vorhanden.' USING ERRCODE='40001';
  END IF;
  IF actual_time<=approval.approved_at THEN RAISE EXCEPTION 'Anteilsfeststellung muss nach der Rechnungsfreigabe liegen.' USING ERRCODE='40001'; END IF;

  SELECT count(*),COALESCE(sum(amount_cents),0),min(position_no),max(position_no)
    INTO expected_count,approved_total,first_position,last_position
  FROM public.pfleger_invoice_draft_positions WHERE tenant_id=t AND invoice_draft_id=approval.invoice_draft_id FOR SHARE;
  SELECT count(*),COALESCE(sum((line->>'coverageShareCents')::bigint),0),COALESCE(sum((line->>'personalShareCents')::bigint),0)
    INTO actual_count,coverage_total,personal_total FROM jsonb_array_elements(p_payload->'lines') line;
  IF expected_count<1 OR actual_count<>expected_count OR first_position<>1 OR last_position<>expected_count OR approved_total IS DISTINCT FROM approval.total_amount_cents OR coverage_total+personal_total<>approved_total THEN
    RAISE EXCEPTION 'Kostenträger- und Eigenanteile stimmen nicht vollständig mit der freigegebenen Rechnung überein.' USING ERRCODE='23514';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_payload->'lines') WITH ORDINALITY AS source(line,ord)
    LEFT JOIN public.pfleger_invoice_draft_positions position ON position.tenant_id=t AND position.invoice_draft_id=approval.invoice_draft_id AND position.position_no=ord
    WHERE position.position_no IS NULL OR (source.line->>'positionNo')::integer<>position.position_no
      OR (source.line->>'billingCaseId')::uuid IS DISTINCT FROM position.billing_case_id OR (source.line->>'serviceProofId')::uuid IS DISTINCT FROM position.service_proof_id
      OR (source.line->>'serviceDate')::date IS DISTINCT FROM position.service_date OR source.line->>'serviceCode' IS DISTINCT FROM position.service_code
      OR (source.line->>'approvedAmountCents')::bigint IS DISTINCT FROM position.amount_cents
      OR (source.line->>'coverageShareCents')::bigint<0 OR (source.line->>'personalShareCents')::bigint<0
      OR (source.line->>'coverageShareCents')::bigint+(source.line->>'personalShareCents')::bigint<>position.amount_cents
      OR COALESCE(source.line->>'personalRecipientId','')='' OR COALESCE(source.line->>'personalRecipientName','')=''
      OR COALESCE(source.line->>'personalRecipientAddressFingerprint','')!~'^[0-9a-f]{32}$'
      OR source.line->>'payerType' NOT IN ('insurance','self_payer')
      OR source.line->>'personalShareBasisKind' NOT IN ('calculated','exemption','documented_zero','self_payer')
      OR (source.line->>'payerType'='self_payer' AND ((source.line->>'coverageShareCents')::bigint<>0 OR (source.line->>'personalShareCents')::bigint<>position.amount_cents OR source.line->>'personalShareBasisKind'<>'self_payer' OR source.line->>'coverageRecipientId' IS NOT NULL OR source.line->>'exemptionEvidenceId' IS NOT NULL))
      OR (source.line->>'payerType'='insurance' AND (COALESCE(source.line->>'coverageRecipientId','')='' OR COALESCE(source.line->>'coverageRecipientName','')='' OR COALESCE(source.line->>'coverageRecipientIk','')='' OR COALESCE(source.line->>'coverageRecipientAddressFingerprint','')!~'^[0-9a-f]{32}$'))
      OR (source.line->>'personalShareBasisKind'='calculated' AND ((source.line->>'personalShareCents')::bigint<=0 OR source.line->>'exemptionEvidenceId' IS NOT NULL))
      OR (source.line->>'personalShareBasisKind'='documented_zero' AND ((source.line->>'personalShareCents')::bigint<>0 OR source.line->>'exemptionEvidenceId' IS NOT NULL))
      OR (source.line->>'personalShareBasisKind'='exemption' AND ((source.line->>'personalShareCents')::bigint<>0 OR COALESCE(source.line->>'exemptionEvidenceId','')='' OR COALESCE(source.line->>'exemptionEvidenceFingerprint','')!~'^[0-9a-f]{32}$' OR (source.line->>'exemptionValidFrom')::date>position.service_date OR (source.line->>'exemptionValidUntil')::date<position.service_date OR (source.line->>'exemptionRecordedAt')::timestamptz>actual_time))
  ) THEN RAISE EXCEPTION 'Anteilszeile ist nicht exakt belegt oder an die freigegebene Position gebunden.' USING ERRCODE='23514'; END IF;

  actor_name:=public.clinical_actor_name();
  INSERT INTO public.pfleger_invoice_cost_share_assessments(id,client_request_id,tenant_id,client_id,invoice_approval_id,invoice_draft_id,invoice_number,approval_version,approval_approved_at,document_fingerprint,coverage_basis_id,coverage_basis_version,coverage_basis_fingerprint,position_count,approved_total_cents,coverage_total_cents,personal_total_cents,reconciliation_state,transmission_state,collection_state,payment_state,assessed_at,assessed_by,assessed_by_name,request_fingerprint)
  VALUES((p_payload->>'costShareAssessmentId')::uuid,p_client_request_id,t,approval.client_id,approval.id,approval.invoice_draft_id,p_payload->>'invoiceNumber',approval.approval_version,approval.approved_at,approval.document_fingerprint,(p_payload->>'coverageBasisId')::uuid,(p_payload->>'coverageBasisVersion')::integer,p_payload->>'coverageBasisFingerprint',expected_count,approved_total,coverage_total,personal_total,'reconciled','not_inferred','not_inferred','not_inferred',actual_time,actor,actor_name,request_fingerprint) RETURNING * INTO result;

  INSERT INTO public.pfleger_invoice_cost_share_positions(assessment_id,tenant_id,client_id,position_no,billing_case_id,service_proof_id,service_date,service_code,approved_amount_cents,payer_type,coverage_recipient_id,coverage_recipient_name,coverage_recipient_ik,coverage_recipient_address_fingerprint,personal_recipient_id,personal_recipient_name,personal_recipient_address_fingerprint,coverage_share_cents,personal_share_cents,personal_share_basis_kind,exemption_evidence_id,exemption_evidence_fingerprint,exemption_valid_from,exemption_valid_until,exemption_recorded_at)
  SELECT result.id,t,approval.client_id,(line->>'positionNo')::integer,(line->>'billingCaseId')::uuid,(line->>'serviceProofId')::uuid,(line->>'serviceDate')::date,line->>'serviceCode',(line->>'approvedAmountCents')::bigint,line->>'payerType',line->>'coverageRecipientId',line->>'coverageRecipientName',line->>'coverageRecipientIk',line->>'coverageRecipientAddressFingerprint',line->>'personalRecipientId',line->>'personalRecipientName',line->>'personalRecipientAddressFingerprint',(line->>'coverageShareCents')::bigint,(line->>'personalShareCents')::bigint,line->>'personalShareBasisKind',NULLIF(line->>'exemptionEvidenceId','')::uuid,line->>'exemptionEvidenceFingerprint',NULLIF(line->>'exemptionValidFrom','')::date,NULLIF(line->>'exemptionValidUntil','')::date,NULLIF(line->>'exemptionRecordedAt','')::timestamptz
  FROM jsonb_array_elements(p_payload->'lines') line;
  INSERT INTO public.care_audit_events(tenant_id,client_id,entity_type,entity_id,action,summary,after_data,actor_id,actor_name)
  VALUES(t,approval.client_id,'pflege_invoice_cost_share_assessment',result.id,'cost_shares_reconciled','Kostenträger- und Eigenanteile je freigegebener Position exakt abgestimmt; Versand, Einzug und Zahlung nicht abgeleitet.',to_jsonb(result),actor,actor_name);
  RETURN result;
END $$;

REVOKE ALL ON FUNCTION public.record_pfleger_invoice_cost_share_assessment(uuid,jsonb,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_pfleger_invoice_cost_share_assessment(uuid,jsonb,uuid) TO authenticated;
