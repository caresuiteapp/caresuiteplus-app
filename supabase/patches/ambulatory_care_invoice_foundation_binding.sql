-- Checkpoint 233 / U-01: ausdruecklich ausgewaehlte Rechnungsgrundlage.
-- Additiv und ohne Backfill: alte Freigaben erhalten keinen erfundenen Originalfingerprint.

ALTER TABLE public.pfleger_service_proofs
  ADD COLUMN IF NOT EXISTS approved_evidence_fingerprint text,
  ADD COLUMN IF NOT EXISTS approved_evidence_snapshot jsonb;

CREATE OR REPLACE FUNCTION public.freeze_pfleger_proof_approval_evidence()
RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
  IF NEW.status = 'approved' AND OLD.status IS DISTINCT FROM 'approved' THEN
    IF NEW.reviewed_at IS NULL OR NEW.reviewed_by IS NULL OR btrim(NEW.reviewed_by_name) = '' THEN
      RAISE EXCEPTION 'Freigabe benoetigt native pruefende Identitaet und Ereigniszeit.' USING ERRCODE='23514';
    END IF;
    NEW.approved_evidence_snapshot := jsonb_build_object(
      'proofId', NEW.id, 'tenantId', NEW.tenant_id, 'clientId', NEW.client_id,
      'serviceDate', NEW.service_date, 'startedAt', NEW.started_at, 'endedAt', NEW.ended_at,
      'serviceCode', NEW.service_code, 'legalBasis', NEW.legal_basis,
      'grossAmountCents', NEW.gross_amount_cents, 'evidenceSnapshot', NEW.evidence_snapshot,
      'reviewedBy', NEW.reviewed_by, 'reviewedByName', NEW.reviewed_by_name,
      'reviewedAt', to_char(NEW.reviewed_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')
    );
    NEW.approved_evidence_fingerprint := md5(NEW.approved_evidence_snapshot::text);
  ELSIF OLD.status = 'approved' AND (
    NEW.approved_evidence_fingerprint IS DISTINCT FROM OLD.approved_evidence_fingerprint
    OR NEW.approved_evidence_snapshot IS DISTINCT FROM OLD.approved_evidence_snapshot
  ) THEN
    RAISE EXCEPTION 'Eingefrorener Freigabenachweis ist unveraenderlich.' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS freeze_pfleger_proof_approval_evidence_update ON public.pfleger_service_proofs;
CREATE TRIGGER freeze_pfleger_proof_approval_evidence_update
  BEFORE UPDATE ON public.pfleger_service_proofs
  FOR EACH ROW EXECUTE FUNCTION public.freeze_pfleger_proof_approval_evidence();

ALTER TABLE public.pfleger_invoice_foundations
  ADD COLUMN IF NOT EXISTS recipient_key text,
  ADD COLUMN IF NOT EXISTS logical_contract_id uuid,
  ADD COLUMN IF NOT EXISTS contract_lifecycle_event_id uuid,
  ADD COLUMN IF NOT EXISTS contract_lifecycle_version integer,
  ADD COLUMN IF NOT EXISTS contract_lifecycle_fingerprint text,
  ADD COLUMN IF NOT EXISTS selection_snapshot jsonb;

CREATE OR REPLACE FUNCTION public.create_bound_pfleger_invoice_foundation(
  p_client_id uuid, p_period_from date, p_period_to date, p_billing_case_ids uuid[]
)
RETURNS public.pfleger_invoice_foundations
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  r public.pfleger_invoice_foundations;
  t uuid := public.current_tenant_id();
  selected_count integer; eligible_count integer; updated_count integer; total_value integer;
  payer_value text; recipient_value text; ik_value text; recipient_key_value text;
  logical_contract_value uuid; contract_event_value uuid; contract_version_value integer; contract_fingerprint_value text;
  selected_snapshot jsonb;
BEGIN
  IF t IS NULL OR auth.uid() IS NULL OR NOT public.has_permission('pflege.invoices.manage') THEN
    RAISE EXCEPTION 'Keine Berechtigung.' USING ERRCODE='42501';
  END IF;
  IF p_period_from IS NULL OR p_period_to IS NULL OR p_period_to < p_period_from
    OR p_billing_case_ids IS NULL OR cardinality(p_billing_case_ids) = 0
    OR cardinality(p_billing_case_ids) <> (SELECT count(DISTINCT id) FROM unnest(p_billing_case_ids) AS selected_id(id)) THEN
    RAISE EXCEPTION 'Zeitraum und eindeutige ausdrueckliche Auswahl sind erforderlich.' USING ERRCODE='23514';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(t::text), hashtext(p_client_id::text));
  PERFORM 1 FROM public.pfleger_billing_cases
    WHERE tenant_id=t AND client_id=p_client_id AND id=ANY(p_billing_case_ids)
    ORDER BY id FOR UPDATE;

  SELECT count(*), sum(b.amount_cents), min(b.payer_type), min(b.cost_carrier_name), min(b.cost_carrier_ik),
    (array_agg(cb.logical_contract_id ORDER BY b.id))[1], (array_agg(cb.lifecycle_event_id ORDER BY b.id))[1],
    min(cb.lifecycle_version), min(cb.lifecycle_fingerprint),
    jsonb_agg(jsonb_build_object(
      'billingCaseId',b.id,'serviceProofId',p.id,'proofFingerprint',p.approved_evidence_fingerprint,
      'proofApprovedAt',to_char(p.reviewed_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
      'serviceDate',b.service_date,'serviceCode',b.service_code,'amountCents',b.amount_cents,'payerType',b.payer_type,
      'recipientName',b.cost_carrier_name,'recipientIk',b.cost_carrier_ik,
      'logicalContractId',cb.logical_contract_id,'contractEventId',cb.lifecycle_event_id,
      'contractVersion',cb.lifecycle_version,'contractFingerprint',cb.lifecycle_fingerprint
    ) ORDER BY b.id)
  INTO selected_count,total_value,payer_value,recipient_value,ik_value,logical_contract_value,
    contract_event_value,contract_version_value,contract_fingerprint_value,selected_snapshot
  FROM public.pfleger_billing_cases b
  JOIN public.pfleger_service_proofs p ON p.id=b.service_proof_id AND p.tenant_id=b.tenant_id AND p.client_id=b.client_id
  JOIN public.client_contract_service_bindings cb ON cb.service_evidence_id=p.id AND cb.tenant_id=p.tenant_id AND cb.client_id=p.client_id
  WHERE b.tenant_id=t AND b.client_id=p_client_id AND b.id=ANY(p_billing_case_ids)
    AND b.status='released' AND b.invoice_foundation_id IS NULL
    AND b.service_date BETWEEN p_period_from AND p_period_to
    AND p.status='approved' AND p.reviewed_at IS NOT NULL
    AND btrim(COALESCE(p.approved_evidence_fingerprint,''))<>''
    AND cb.service_occurred_on=b.service_date;

  IF selected_count IS DISTINCT FROM cardinality(p_billing_case_ids) THEN
    RAISE EXCEPTION 'Auswahl enthaelt nicht freigegebene, bereits zugeordnete oder unvollstaendig belegte Faelle.' USING ERRCODE='40001';
  END IF;
  IF (SELECT count(DISTINCT b.payer_type) FROM public.pfleger_billing_cases b WHERE b.id=ANY(p_billing_case_ids))<>1
    OR payer_value='mixed' THEN RAISE EXCEPTION 'Gemischte Kostentraeger sind gesperrt.' USING ERRCODE='23514'; END IF;
  recipient_key_value := CASE WHEN payer_value='self_payer' THEN 'self:'||p_client_id::text ELSE 'ik:'||btrim(ik_value) END;
  IF payer_value<>'self_payer' AND btrim(COALESCE(ik_value,''))='' THEN RAISE EXCEPTION 'Kostentraeger-IK fehlt.' USING ERRCODE='23514'; END IF;
  IF (SELECT count(DISTINCT CASE WHEN b.payer_type='self_payer' THEN 'self:'||b.client_id::text ELSE 'ik:'||btrim(b.cost_carrier_ik) END) FROM public.pfleger_billing_cases b WHERE b.id=ANY(p_billing_case_ids))<>1
    OR (SELECT count(DISTINCT cb.logical_contract_id) FROM public.client_contract_service_bindings cb JOIN public.pfleger_billing_cases b ON b.service_proof_id=cb.service_evidence_id WHERE b.id=ANY(p_billing_case_ids))<>1
    OR (SELECT count(DISTINCT (cb.lifecycle_event_id::text||':'||cb.lifecycle_version::text||':'||cb.lifecycle_fingerprint)) FROM public.client_contract_service_bindings cb JOIN public.pfleger_billing_cases b ON b.service_proof_id=cb.service_evidence_id WHERE b.id=ANY(p_billing_case_ids))<>1 THEN
    RAISE EXCEPTION 'Empfaenger oder konkrete Vertragsfassung sind nicht eindeutig.' USING ERRCODE='23514';
  END IF;

  SELECT count(*) INTO eligible_count
  FROM public.pfleger_billing_cases b
  JOIN public.pfleger_service_proofs p ON p.id=b.service_proof_id AND p.tenant_id=b.tenant_id AND p.client_id=b.client_id
  JOIN public.client_contract_service_bindings cb ON cb.service_evidence_id=p.id AND cb.tenant_id=p.tenant_id AND cb.client_id=p.client_id
  WHERE b.tenant_id=t AND b.client_id=p_client_id AND b.status='released' AND b.invoice_foundation_id IS NULL
    AND b.service_date BETWEEN p_period_from AND p_period_to AND p.status='approved' AND p.reviewed_at IS NOT NULL
    AND btrim(COALESCE(p.approved_evidence_fingerprint,''))<>''
    AND (CASE WHEN b.payer_type='self_payer' THEN 'self:'||b.client_id::text ELSE 'ik:'||btrim(b.cost_carrier_ik) END)=recipient_key_value
    AND b.payer_type=payer_value AND cb.logical_contract_id=logical_contract_value
    AND cb.lifecycle_event_id=contract_event_value AND cb.lifecycle_version=contract_version_value
    AND cb.lifecycle_fingerprint=contract_fingerprint_value AND cb.service_occurred_on=b.service_date;
  IF eligible_count<>selected_count THEN RAISE EXCEPTION 'Stille Teilmenge ist gesperrt; vollstaendige Bereitschaftsgruppe waehlen.' USING ERRCODE='40001'; END IF;

  INSERT INTO public.pfleger_invoice_foundations(
    tenant_id,client_id,foundation_number,period_from,period_to,payer_type,recipient_name,recipient_ik,
    proof_count,total_amount_cents,billing_case_ids,status,validation_snapshot,created_by,created_by_name,
    recipient_key,logical_contract_id,contract_lifecycle_event_id,contract_lifecycle_version,
    contract_lifecycle_fingerprint,selection_snapshot
  ) VALUES (
    t,p_client_id,'PF-'||to_char(clock_timestamp(),'YYYYMMDDHH24MISSUS'),p_period_from,p_period_to,payer_value,
    CASE WHEN payer_value='self_payer' THEN COALESCE(NULLIF(recipient_value,''),'Selbstzahler') ELSE recipient_value END,
    ik_value,selected_count,total_value,p_billing_case_ids,'validated',
    jsonb_build_object('explicitSelection',true,'completeGroup',true,'serverCheckedAt',clock_timestamp()),
    public.clinical_actor_id(),public.clinical_actor_name(),recipient_key_value,logical_contract_value,
    contract_event_value,contract_version_value,contract_fingerprint_value,selected_snapshot
  ) RETURNING * INTO r;
  UPDATE public.pfleger_billing_cases SET status='invoiced',invoice_foundation_id=r.id,updated_at=clock_timestamp()
    WHERE tenant_id=t AND client_id=p_client_id AND id=ANY(p_billing_case_ids)
      AND status='released' AND invoice_foundation_id IS NULL;
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  IF updated_count<>selected_count THEN RAISE EXCEPTION 'Parallele Zuordnung erkannt.' USING ERRCODE='40001'; END IF;
  INSERT INTO public.care_audit_events(tenant_id,client_id,entity_type,entity_id,action,summary,after_data,actor_id,actor_name)
    VALUES(t,p_client_id,'pflege_invoice_foundation',r.id,'created_bound','Rechnungsgrundlage aus ausdruecklich gewaehlter, vollstaendiger Gruppe erstellt.',to_jsonb(r),public.clinical_actor_id(),public.clinical_actor_name());
  RETURN r;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_pfleger_invoice_foundation(p_client_id uuid,p_period_from date,p_period_to date)
RETURNS public.pfleger_invoice_foundations LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  RAISE EXCEPTION 'Pauschaler Sammelpfad gesperrt; ausdrueckliche gebundene Fallauswahl erforderlich.' USING ERRCODE='0A000';
END;
$$;

REVOKE ALL ON FUNCTION public.create_bound_pfleger_invoice_foundation(uuid,date,date,uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_bound_pfleger_invoice_foundation(uuid,date,date,uuid[]) TO authenticated;

COMMENT ON FUNCTION public.create_bound_pfleger_invoice_foundation(uuid,date,date,uuid[]) IS
  'Erzeugt nur aus einer ausdruecklichen vollstaendigen Auswahl freigegebener Originalnachweise gleicher Empfaenger- und Vertragsbindung eine Rechnungsgrundlage; keine Rechnung, Genehmigung oder Versendung.';
