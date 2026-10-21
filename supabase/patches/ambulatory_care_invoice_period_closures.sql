-- Checkpoint 244 / U-12: unveränderliche Abrechnungsperioden und getrennte Folgekorrekturen.
-- Lokaler additiver Entwurf; nicht gegen eine produktive Datenbank ausführen.

CREATE TABLE IF NOT EXISTS public.pfleger_invoice_period_closures (
  id uuid PRIMARY KEY,
  client_request_id uuid NOT NULL,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  period_id uuid NOT NULL,
  period_from date NOT NULL,
  period_to date NOT NULL,
  cutoff_at timestamptz NOT NULL,
  invoice_count integer NOT NULL CHECK (invoice_count >= 1),
  invoice_total_cents bigint NOT NULL CHECK (invoice_total_cents BETWEEN 0 AND 999999999999),
  open_case_count integer NOT NULL DEFAULT 0 CHECK (open_case_count = 0),
  approval_evidence_id uuid NOT NULL,
  approval_evidence_fingerprint text NOT NULL CHECK (approval_evidence_fingerprint ~ '^[0-9a-f]{32}$'),
  approved_by uuid NOT NULL REFERENCES auth.users(id),
  approved_by_name text NOT NULL CHECK (btrim(approved_by_name) <> ''),
  approved_at timestamptz NOT NULL,
  closed_at timestamptz NOT NULL,
  closure_state text NOT NULL DEFAULT 'closed' CHECK (closure_state = 'closed'),
  correction_mode text NOT NULL DEFAULT 'subsequent_period_only' CHECK (correction_mode = 'subsequent_period_only'),
  transmission_state text NOT NULL DEFAULT 'not_inferred' CHECK (transmission_state = 'not_inferred'),
  payment_state text NOT NULL DEFAULT 'not_inferred' CHECK (payment_state = 'not_inferred'),
  request_fingerprint text NOT NULL CHECK (request_fingerprint ~ '^[0-9a-f]{32}$'),
  CHECK (period_to >= period_from),
  CHECK (approved_at > cutoff_at AND closed_at >= approved_at),
  UNIQUE (tenant_id, client_request_id),
  UNIQUE (tenant_id, period_id),
  UNIQUE (tenant_id, period_from, period_to)
);

CREATE TABLE IF NOT EXISTS public.pfleger_invoice_period_closure_invoices (
  period_closure_id uuid NOT NULL REFERENCES public.pfleger_invoice_period_closures(id) ON DELETE RESTRICT,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  position_no integer NOT NULL CHECK (position_no >= 1),
  invoice_approval_id uuid NOT NULL REFERENCES public.pfleger_invoice_approvals(id) ON DELETE RESTRICT,
  invoice_draft_id uuid NOT NULL REFERENCES public.pfleger_invoice_drafts(id) ON DELETE RESTRICT,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE RESTRICT,
  invoice_number text NOT NULL CHECK (btrim(invoice_number) <> ''),
  invoice_date date NOT NULL,
  approval_version integer NOT NULL CHECK (approval_version >= 1),
  approved_at timestamptz NOT NULL,
  document_fingerprint text NOT NULL CHECK (document_fingerprint ~ '^[0-9a-f]{32}$'),
  total_amount_cents bigint NOT NULL CHECK (total_amount_cents BETWEEN 0 AND 999999999999),
  PRIMARY KEY (period_closure_id, position_no),
  UNIQUE (period_closure_id, invoice_approval_id),
  UNIQUE (period_closure_id, invoice_draft_id),
  UNIQUE (period_closure_id, invoice_number)
);

CREATE TABLE IF NOT EXISTS public.pfleger_invoice_period_corrections (
  id uuid PRIMARY KEY,
  client_request_id uuid NOT NULL,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  original_period_closure_id uuid NOT NULL REFERENCES public.pfleger_invoice_period_closures(id) ON DELETE RESTRICT,
  original_invoice_approval_id uuid NOT NULL REFERENCES public.pfleger_invoice_approvals(id) ON DELETE RESTRICT,
  correction_period_id uuid NOT NULL,
  correction_period_from date NOT NULL,
  correction_period_to date NOT NULL,
  adjustment_evidence_id uuid NOT NULL,
  adjustment_evidence_fingerprint text NOT NULL CHECK (adjustment_evidence_fingerprint ~ '^[0-9a-f]{32}$'),
  reason text NOT NULL CHECK (length(btrim(reason)) >= 5),
  amount_delta_cents bigint NOT NULL CHECK (amount_delta_cents BETWEEN -999999999999 AND 999999999999 AND amount_delta_cents <> 0),
  recorded_at timestamptz NOT NULL,
  recorded_by uuid NOT NULL REFERENCES auth.users(id),
  recorded_by_name text NOT NULL CHECK (btrim(recorded_by_name) <> ''),
  request_fingerprint text NOT NULL CHECK (request_fingerprint ~ '^[0-9a-f]{32}$'),
  CHECK (correction_period_to >= correction_period_from),
  UNIQUE (tenant_id, client_request_id),
  UNIQUE (tenant_id, original_period_closure_id, correction_period_id, adjustment_evidence_id)
);

ALTER TABLE public.pfleger_invoice_period_closures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pfleger_invoice_period_closure_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pfleger_invoice_period_corrections ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.pfleger_invoice_period_closures, public.pfleger_invoice_period_closure_invoices, public.pfleger_invoice_period_corrections FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.pfleger_invoice_period_closures, public.pfleger_invoice_period_closure_invoices, public.pfleger_invoice_period_corrections TO authenticated;

DROP POLICY IF EXISTS pfleger_invoice_period_closures_read ON public.pfleger_invoice_period_closures;
CREATE POLICY pfleger_invoice_period_closures_read ON public.pfleger_invoice_period_closures FOR SELECT TO authenticated
  USING (tenant_id=public.current_tenant_id() AND public.has_permission('pflege.billing.view'));
DROP POLICY IF EXISTS pfleger_invoice_period_closure_invoices_read ON public.pfleger_invoice_period_closure_invoices;
CREATE POLICY pfleger_invoice_period_closure_invoices_read ON public.pfleger_invoice_period_closure_invoices FOR SELECT TO authenticated
  USING (tenant_id=public.current_tenant_id() AND public.has_permission('pflege.billing.view'));
DROP POLICY IF EXISTS pfleger_invoice_period_corrections_read ON public.pfleger_invoice_period_corrections;
CREATE POLICY pfleger_invoice_period_corrections_read ON public.pfleger_invoice_period_corrections FOR SELECT TO authenticated
  USING (tenant_id=public.current_tenant_id() AND public.has_permission('pflege.billing.view'));

CREATE OR REPLACE FUNCTION care_private.protect_pfleger_invoice_period_history()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN
  RAISE EXCEPTION 'Periodenabschlüsse, eingeschlossene Rechnungsfassungen und Folgekorrekturen bleiben unverändert.' USING ERRCODE='42501';
END $$;
DROP TRIGGER IF EXISTS protect_pfleger_invoice_period_closures ON public.pfleger_invoice_period_closures;
CREATE TRIGGER protect_pfleger_invoice_period_closures BEFORE UPDATE OR DELETE ON public.pfleger_invoice_period_closures
  FOR EACH ROW EXECUTE FUNCTION care_private.protect_pfleger_invoice_period_history();
DROP TRIGGER IF EXISTS protect_pfleger_invoice_period_closure_invoices ON public.pfleger_invoice_period_closure_invoices;
CREATE TRIGGER protect_pfleger_invoice_period_closure_invoices BEFORE UPDATE OR DELETE ON public.pfleger_invoice_period_closure_invoices
  FOR EACH ROW EXECUTE FUNCTION care_private.protect_pfleger_invoice_period_history();
DROP TRIGGER IF EXISTS protect_pfleger_invoice_period_corrections ON public.pfleger_invoice_period_corrections;
CREATE TRIGGER protect_pfleger_invoice_period_corrections BEFORE UPDATE OR DELETE ON public.pfleger_invoice_period_corrections
  FOR EACH ROW EXECUTE FUNCTION care_private.protect_pfleger_invoice_period_history();

CREATE OR REPLACE FUNCTION public.record_pfleger_invoice_period_closure(
  p_period_from date,
  p_period_to date,
  p_cutoff_at timestamptz,
  p_payload jsonb,
  p_client_request_id uuid
) RETURNS public.pfleger_invoice_period_closures
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  t uuid:=public.current_tenant_id(); actor uuid:=auth.uid(); actor_name text;
  prior public.pfleger_invoice_period_closures; result public.pfleger_invoice_period_closures;
  actual_time timestamptz:=clock_timestamp(); request_fingerprint text;
  expected_ids uuid[]; supplied_ids uuid[]; expected_count integer; expected_total bigint; open_count integer;
BEGIN
  IF t IS NULL OR actor IS NULL OR NOT public.has_permission('pflege.acceptance.manage') THEN RAISE EXCEPTION 'Keine Berechtigung.' USING ERRCODE='42501'; END IF;
  IF p_period_from IS NULL OR p_period_to IS NULL OR p_period_to<p_period_from OR p_cutoff_at IS NULL OR p_cutoff_at>=actual_time
    OR p_client_request_id IS NULL OR p_payload IS NULL OR COALESCE(p_payload->>'periodClosureId','')='' OR COALESCE(p_payload->>'periodId','')=''
    OR COALESCE(p_payload->>'approvalEvidenceId','')='' OR COALESCE(p_payload->>'approvalEvidenceFingerprint','')!~'^[0-9a-f]{32}$'
    OR jsonb_typeof(p_payload->'includedInvoiceApprovalIds')<>'array' OR COALESCE((p_payload->>'approvedAt')::timestamptz,p_cutoff_at)<=p_cutoff_at
  THEN RAISE EXCEPTION 'Periodenabschluss ist unvollständig oder zeitlich ungültig.' USING ERRCODE='23514'; END IF;
  request_fingerprint:=md5(jsonb_build_object('from',p_period_from,'to',p_period_to,'cutoff',p_cutoff_at,'payload',p_payload,'requestId',p_client_request_id)::text);
  PERFORM pg_advisory_xact_lock(hashtext(t::text),hashtext(p_client_request_id::text));
  SELECT * INTO prior FROM public.pfleger_invoice_period_closures WHERE tenant_id=t AND client_request_id=p_client_request_id;
  IF FOUND THEN
    IF prior.request_fingerprint IS DISTINCT FROM request_fingerprint THEN RAISE EXCEPTION 'Anforderungs-ID wurde anders verwendet.' USING ERRCODE='40001'; END IF;
    RETURN prior;
  END IF;
  PERFORM pg_advisory_xact_lock(hashtext(t::text),hashtext((p_payload->>'periodId')));
  IF EXISTS (SELECT 1 FROM public.pfleger_invoice_period_closures WHERE tenant_id=t AND (period_id=(p_payload->>'periodId')::uuid OR (period_from=p_period_from AND period_to=p_period_to))) THEN
    RAISE EXCEPTION 'Diese Periode besitzt bereits einen unveränderlichen Abschluss.' USING ERRCODE='40001';
  END IF;
  PERFORM 1 FROM public.pfleger_billing_cases WHERE tenant_id=t AND service_date BETWEEN p_period_from AND p_period_to AND status<>'cancelled' FOR SHARE;
  SELECT count(*) INTO open_count FROM public.pfleger_billing_cases WHERE tenant_id=t AND service_date BETWEEN p_period_from AND p_period_to AND status NOT IN ('invoiced','cancelled');
  IF open_count<>0 THEN RAISE EXCEPTION 'Abrechnungsperiode enthält offene Fälle und darf nicht geschlossen werden.' USING ERRCODE='23514'; END IF;
  PERFORM 1 FROM public.pfleger_invoice_approvals approval JOIN public.pfleger_invoice_drafts draft ON draft.id=approval.invoice_draft_id AND draft.tenant_id=approval.tenant_id
    WHERE approval.tenant_id=t AND draft.issued_at::date BETWEEN p_period_from AND p_period_to AND approval.approved_at<=p_cutoff_at FOR SHARE OF approval,draft;
  SELECT array_agg(approval.id ORDER BY draft.issued_at::date,approval.id),count(*),COALESCE(sum(approval.total_amount_cents),0)
    INTO expected_ids,expected_count,expected_total
  FROM public.pfleger_invoice_approvals approval JOIN public.pfleger_invoice_drafts draft ON draft.id=approval.invoice_draft_id AND draft.tenant_id=approval.tenant_id
  WHERE approval.tenant_id=t AND draft.issued_at::date BETWEEN p_period_from AND p_period_to AND approval.approved_at<=p_cutoff_at;
  SELECT array_agg(value::uuid ORDER BY ord) INTO supplied_ids FROM jsonb_array_elements_text(p_payload->'includedInvoiceApprovalIds') WITH ORDINALITY supplied(value,ord);
  IF expected_count<1 OR supplied_ids IS DISTINCT FROM expected_ids THEN RAISE EXCEPTION 'Abschluss muss jede zum Stichtag freigegebene Rechnungsfassung genau einmal enthalten.' USING ERRCODE='23514'; END IF;
  actor_name:=public.clinical_actor_name();
  IF (p_payload->>'approvedBy')::uuid IS DISTINCT FROM actor OR btrim(p_payload->>'approvedByName') IS DISTINCT FROM btrim(actor_name) OR (p_payload->>'approvedAt')::timestamptz>actual_time THEN
    RAISE EXCEPTION 'Abschlussfreigabe ist nicht der authentifizierten Person und Zeit zugeordnet.' USING ERRCODE='42501';
  END IF;
  INSERT INTO public.pfleger_invoice_period_closures(id,client_request_id,tenant_id,period_id,period_from,period_to,cutoff_at,invoice_count,invoice_total_cents,open_case_count,approval_evidence_id,approval_evidence_fingerprint,approved_by,approved_by_name,approved_at,closed_at,closure_state,correction_mode,transmission_state,payment_state,request_fingerprint)
  VALUES((p_payload->>'periodClosureId')::uuid,p_client_request_id,t,(p_payload->>'periodId')::uuid,p_period_from,p_period_to,p_cutoff_at,expected_count,expected_total,0,(p_payload->>'approvalEvidenceId')::uuid,p_payload->>'approvalEvidenceFingerprint',actor,actor_name,(p_payload->>'approvedAt')::timestamptz,actual_time,'closed','subsequent_period_only','not_inferred','not_inferred',request_fingerprint) RETURNING * INTO result;
  INSERT INTO public.pfleger_invoice_period_closure_invoices(period_closure_id,tenant_id,position_no,invoice_approval_id,invoice_draft_id,client_id,invoice_number,invoice_date,approval_version,approved_at,document_fingerprint,total_amount_cents)
  SELECT result.id,t,(row_number() OVER(ORDER BY draft.issued_at::date,approval.id))::integer,approval.id,approval.invoice_draft_id,approval.client_id,draft.invoice_number,draft.issued_at::date,approval.approval_version,approval.approved_at,approval.document_fingerprint,approval.total_amount_cents
  FROM public.pfleger_invoice_approvals approval JOIN public.pfleger_invoice_drafts draft ON draft.id=approval.invoice_draft_id AND draft.tenant_id=approval.tenant_id
  WHERE approval.tenant_id=t AND approval.id=ANY(expected_ids) ORDER BY draft.issued_at::date,approval.id;
  INSERT INTO public.care_audit_events(tenant_id,entity_type,entity_id,action,summary,after_data,actor_id,actor_name)
  VALUES(t,'pflege_invoice_period_closure',result.id,'closed','Abrechnungsperiode mit vollständigen freigegebenen Rechnungsfassungen unveränderlich geschlossen; Versand und Zahlung nicht abgeleitet.',to_jsonb(result),actor,actor_name);
  RETURN result;
END $$;

CREATE OR REPLACE FUNCTION public.record_pfleger_invoice_period_correction(
  p_payload jsonb,
  p_client_request_id uuid
) RETURNS public.pfleger_invoice_period_corrections
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  t uuid:=public.current_tenant_id(); actor uuid:=auth.uid(); actor_name text;
  closure public.pfleger_invoice_period_closures; prior public.pfleger_invoice_period_corrections; result public.pfleger_invoice_period_corrections;
  actual_time timestamptz:=clock_timestamp(); request_fingerprint text;
BEGIN
  IF t IS NULL OR actor IS NULL OR NOT public.has_permission('pflege.acceptance.manage') THEN RAISE EXCEPTION 'Keine Berechtigung.' USING ERRCODE='42501'; END IF;
  IF p_client_request_id IS NULL OR p_payload IS NULL OR COALESCE(p_payload->>'correctionId','')='' OR COALESCE(p_payload->>'originalPeriodClosureId','')=''
    OR COALESCE(p_payload->>'originalInvoiceApprovalId','')='' OR COALESCE(p_payload->>'correctionPeriodId','')='' OR COALESCE(p_payload->>'adjustmentEvidenceId','')=''
    OR COALESCE(p_payload->>'adjustmentEvidenceFingerprint','')!~'^[0-9a-f]{32}$' OR length(btrim(COALESCE(p_payload->>'reason','')))<5
    OR COALESCE((p_payload->>'amountDeltaCents')::bigint,0)=0 OR (p_payload->>'correctionPeriodTo')::date<(p_payload->>'correctionPeriodFrom')::date
  THEN RAISE EXCEPTION 'Periodenkorrektur ist unvollständig oder ungültig.' USING ERRCODE='23514'; END IF;
  request_fingerprint:=md5(jsonb_build_object('payload',p_payload,'requestId',p_client_request_id)::text);
  PERFORM pg_advisory_xact_lock(hashtext(t::text),hashtext(p_client_request_id::text));
  SELECT * INTO prior FROM public.pfleger_invoice_period_corrections WHERE tenant_id=t AND client_request_id=p_client_request_id;
  IF FOUND THEN
    IF prior.request_fingerprint IS DISTINCT FROM request_fingerprint THEN RAISE EXCEPTION 'Anforderungs-ID wurde anders verwendet.' USING ERRCODE='40001'; END IF;
    RETURN prior;
  END IF;
  SELECT * INTO closure FROM public.pfleger_invoice_period_closures WHERE tenant_id=t AND id=(p_payload->>'originalPeriodClosureId')::uuid FOR SHARE;
  IF NOT FOUND OR NOT EXISTS (SELECT 1 FROM public.pfleger_invoice_period_closure_invoices WHERE tenant_id=t AND period_closure_id=closure.id AND invoice_approval_id=(p_payload->>'originalInvoiceApprovalId')::uuid) THEN
    RAISE EXCEPTION 'Korrektur verweist nicht auf eine im Abschluss enthaltene Rechnungsfassung.' USING ERRCODE='23514';
  END IF;
  IF (p_payload->>'correctionPeriodFrom')::date<=closure.period_to OR (p_payload->>'recordedAt')::timestamptz<=closure.closed_at OR (p_payload->>'recordedAt')::timestamptz>actual_time THEN
    RAISE EXCEPTION 'Korrektur muss nach dem Abschluss in einer späteren Korrekturperiode erfasst werden.' USING ERRCODE='23514';
  END IF;
  actor_name:=public.clinical_actor_name();
  IF (p_payload->>'recordedBy')::uuid IS DISTINCT FROM actor OR btrim(p_payload->>'recordedByName') IS DISTINCT FROM btrim(actor_name) THEN RAISE EXCEPTION 'Korrektur ist nicht der authentifizierten Person zugeordnet.' USING ERRCODE='42501'; END IF;
  INSERT INTO public.pfleger_invoice_period_corrections(id,client_request_id,tenant_id,original_period_closure_id,original_invoice_approval_id,correction_period_id,correction_period_from,correction_period_to,adjustment_evidence_id,adjustment_evidence_fingerprint,reason,amount_delta_cents,recorded_at,recorded_by,recorded_by_name,request_fingerprint)
  VALUES((p_payload->>'correctionId')::uuid,p_client_request_id,t,closure.id,(p_payload->>'originalInvoiceApprovalId')::uuid,(p_payload->>'correctionPeriodId')::uuid,(p_payload->>'correctionPeriodFrom')::date,(p_payload->>'correctionPeriodTo')::date,(p_payload->>'adjustmentEvidenceId')::uuid,p_payload->>'adjustmentEvidenceFingerprint',btrim(p_payload->>'reason'),(p_payload->>'amountDeltaCents')::bigint,actual_time,actor,actor_name,request_fingerprint) RETURNING * INTO result;
  INSERT INTO public.care_audit_events(tenant_id,entity_type,entity_id,action,summary,after_data,actor_id,actor_name)
  VALUES(t,'pflege_invoice_period_correction',result.id,'correction_recorded','Spätere Periodenkorrektur als unveränderliche Folge zum ursprünglichen Abschluss erfasst.',to_jsonb(result),actor,actor_name);
  RETURN result;
END $$;

REVOKE ALL ON FUNCTION public.record_pfleger_invoice_period_closure(date,date,timestamptz,jsonb,uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.record_pfleger_invoice_period_correction(jsonb,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_pfleger_invoice_period_closure(date,date,timestamptz,jsonb,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_pfleger_invoice_period_correction(jsonb,uuid) TO authenticated;
