-- Checkpoint 238 / U-06: append-only Storno/Gutschrift mit exaktem Bezug zur freigegebenen Originalrechnung.
-- Rückläufer und Folgeversuche erzeugen keine Gegenbuchung. Zahlung und Übermittlung werden nicht abgeleitet.

CREATE TABLE IF NOT EXISTS public.pfleger_invoice_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE RESTRICT,
  original_invoice_approval_id uuid NOT NULL REFERENCES public.pfleger_invoice_approvals(id) ON DELETE RESTRICT,
  original_invoice_draft_id uuid NOT NULL REFERENCES public.pfleger_invoice_drafts(id) ON DELETE RESTRICT,
  original_invoice_number text NOT NULL CHECK (btrim(original_invoice_number) <> ''),
  original_document_fingerprint text NOT NULL CHECK (original_document_fingerprint ~ '^[0-9a-f]{32}$'),
  original_total_amount_cents bigint NOT NULL CHECK (original_total_amount_cents BETWEEN 1 AND 999999999999),
  adjustment_number text NOT NULL CHECK (btrim(adjustment_number) <> ''),
  adjustment_kind text NOT NULL CHECK (adjustment_kind IN ('full_cancellation','partial_credit','cancel_and_rebill')),
  adjustment_basis text NOT NULL DEFAULT 'documented_billing_correction' CHECK (adjustment_basis = 'documented_billing_correction'),
  reason text NOT NULL CHECK (btrim(reason) <> ''),
  credit_total_cents bigint NOT NULL CHECK (credit_total_cents BETWEEN 1 AND 999999999999),
  counter_entry_cents bigint NOT NULL CHECK (counter_entry_cents < 0),
  replacement_invoice_approval_id uuid REFERENCES public.pfleger_invoice_approvals(id) ON DELETE RESTRICT,
  replacement_invoice_draft_id uuid REFERENCES public.pfleger_invoice_drafts(id) ON DELETE RESTRICT,
  replacement_invoice_number text,
  replacement_total_amount_cents bigint NOT NULL DEFAULT 0 CHECK (replacement_total_amount_cents BETWEEN 0 AND 999999999999),
  resulting_balance_cents bigint NOT NULL CHECK (resulting_balance_cents BETWEEN 0 AND 999999999999),
  document_fingerprint text NOT NULL CHECK (document_fingerprint ~ '^[0-9a-f]{32}$'),
  source_snapshot jsonb NOT NULL,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_by_name text NOT NULL,
  approved_by uuid NOT NULL REFERENCES auth.users(id),
  approved_by_name text NOT NULL,
  approved_at timestamptz NOT NULL,
  carrier_return_effect text NOT NULL DEFAULT 'none' CHECK (carrier_return_effect = 'none'),
  transmission_status text NOT NULL DEFAULT 'not_inferred' CHECK (transmission_status = 'not_inferred'),
  payment_status text NOT NULL DEFAULT 'not_inferred' CHECK (payment_status = 'not_inferred'),
  client_request_id uuid NOT NULL,
  request_fingerprint text NOT NULL CHECK (request_fingerprint ~ '^[0-9a-f]{32}$'),
  CHECK (created_by <> approved_by),
  CHECK (counter_entry_cents = -credit_total_cents),
  CHECK (resulting_balance_cents = original_total_amount_cents - credit_total_cents + replacement_total_amount_cents),
  CHECK ((adjustment_kind = 'cancel_and_rebill') = (replacement_invoice_approval_id IS NOT NULL)),
  CHECK ((replacement_invoice_approval_id IS NULL) = (replacement_invoice_draft_id IS NULL)),
  CHECK ((replacement_invoice_approval_id IS NULL) = (replacement_invoice_number IS NULL)),
  UNIQUE (tenant_id, original_invoice_approval_id),
  UNIQUE (tenant_id, adjustment_number),
  UNIQUE (tenant_id, client_request_id),
  UNIQUE (tenant_id, replacement_invoice_approval_id)
);

CREATE TABLE IF NOT EXISTS public.pfleger_invoice_adjustment_positions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  adjustment_id uuid NOT NULL REFERENCES public.pfleger_invoice_adjustments(id) ON DELETE RESTRICT,
  original_position_no integer NOT NULL CHECK (original_position_no > 0),
  billing_case_id uuid NOT NULL REFERENCES public.pfleger_billing_cases(id) ON DELETE RESTRICT,
  service_proof_id uuid NOT NULL REFERENCES public.pfleger_service_proofs(id) ON DELETE RESTRICT,
  original_amount_cents bigint NOT NULL CHECK (original_amount_cents > 0),
  credit_amount_cents bigint NOT NULL CHECK (credit_amount_cents > 0),
  counter_entry_cents bigint NOT NULL CHECK (counter_entry_cents < 0),
  CHECK (credit_amount_cents <= original_amount_cents),
  CHECK (counter_entry_cents = -credit_amount_cents),
  UNIQUE (adjustment_id, original_position_no),
  UNIQUE (adjustment_id, billing_case_id),
  UNIQUE (adjustment_id, service_proof_id)
);

ALTER TABLE public.pfleger_invoice_adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pfleger_invoice_adjustment_positions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.pfleger_invoice_adjustments, public.pfleger_invoice_adjustment_positions FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.pfleger_invoice_adjustments, public.pfleger_invoice_adjustment_positions TO authenticated;

DROP POLICY IF EXISTS pfleger_invoice_adjustments_read ON public.pfleger_invoice_adjustments;
CREATE POLICY pfleger_invoice_adjustments_read ON public.pfleger_invoice_adjustments FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id() AND public.has_permission('pflege.billing.view'));
DROP POLICY IF EXISTS pfleger_invoice_adjustment_positions_read ON public.pfleger_invoice_adjustment_positions;
CREATE POLICY pfleger_invoice_adjustment_positions_read ON public.pfleger_invoice_adjustment_positions FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id() AND public.has_permission('pflege.billing.view'));

CREATE OR REPLACE FUNCTION care_private.protect_pfleger_invoice_adjustment_history()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  RAISE EXCEPTION 'Originalrechnung, Gegenbuchung, Positionen und Neurechnung bleiben unverändert.' USING ERRCODE = '42501';
END $$;
DROP TRIGGER IF EXISTS protect_pfleger_invoice_adjustments ON public.pfleger_invoice_adjustments;
CREATE TRIGGER protect_pfleger_invoice_adjustments BEFORE UPDATE OR DELETE ON public.pfleger_invoice_adjustments
  FOR EACH ROW EXECUTE FUNCTION care_private.protect_pfleger_invoice_adjustment_history();
DROP TRIGGER IF EXISTS protect_pfleger_invoice_adjustment_positions ON public.pfleger_invoice_adjustment_positions;
CREATE TRIGGER protect_pfleger_invoice_adjustment_positions BEFORE UPDATE OR DELETE ON public.pfleger_invoice_adjustment_positions
  FOR EACH ROW EXECUTE FUNCTION care_private.protect_pfleger_invoice_adjustment_history();

CREATE OR REPLACE FUNCTION public.record_pfleger_invoice_adjustment(
  p_original_invoice_approval_id uuid,
  p_payload jsonb,
  p_client_request_id uuid
) RETURNS public.pfleger_invoice_adjustments
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  t uuid := public.current_tenant_id(); actor uuid := auth.uid(); actor_name text;
  original_approval public.pfleger_invoice_approvals; original_draft public.pfleger_invoice_drafts;
  replacement_approval public.pfleger_invoice_approvals; replacement_draft public.pfleger_invoice_drafts;
  prior public.pfleger_invoice_adjustments; result public.pfleger_invoice_adjustments;
  credit_positions jsonb := COALESCE(p_payload->'creditPositions', '[]'::jsonb);
  adjustment_kind text := COALESCE(p_payload->>'adjustmentKind','');
  credit_total bigint; credit_count integer; original_count integer; matched_count integer; replacement_total bigint := 0;
  replacement_approval_id uuid; approved_at timestamptz; request_fingerprint text; actual_time timestamptz := clock_timestamp();
BEGIN
  IF t IS NULL OR actor IS NULL OR NOT public.has_permission('pflege.billing.release') THEN
    RAISE EXCEPTION 'Keine Berechtigung.' USING ERRCODE = '42501';
  END IF;
  IF p_original_invoice_approval_id IS NULL OR p_client_request_id IS NULL OR p_payload IS NULL THEN
    RAISE EXCEPTION 'Gegenbuchungsauftrag ist unvollständig.' USING ERRCODE = '23514';
  END IF;
  IF adjustment_kind NOT IN ('full_cancellation','partial_credit','cancel_and_rebill') OR
     COALESCE(p_payload->>'adjustmentBasis','') <> 'documented_billing_correction' OR
     btrim(COALESCE(p_payload->>'adjustmentNumber','')) = '' OR btrim(COALESCE(p_payload->>'reason','')) = '' OR
     COALESCE(p_payload->>'documentFingerprint','') !~ '^[0-9a-f]{32}$' OR
     COALESCE(p_payload->>'approvedAt','') !~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}(Z|\+00:00)$' OR
     jsonb_typeof(credit_positions) <> 'array' OR jsonb_array_length(credit_positions) = 0 THEN
    RAISE EXCEPTION 'Art, Grundlage, Nummer, Zeit, Fingerprint oder Positionen der Gegenbuchung sind ungültig.' USING ERRCODE = '23514';
  END IF;
  approved_at := (p_payload->>'approvedAt')::timestamptz;
  IF COALESCE(p_payload->>'createdByUserId','')::uuid = COALESCE(p_payload->>'approvedByUserId','')::uuid OR
     COALESCE(p_payload->>'approvedByUserId','')::uuid IS DISTINCT FROM actor THEN
    RAISE EXCEPTION 'Gegenbuchung benötigt eine getrennte, aktuell authentifizierte prüfende Identität.' USING ERRCODE = '42501';
  END IF;

  request_fingerprint := md5(jsonb_build_object('approvalId',p_original_invoice_approval_id,'payload',p_payload)::text);
  PERFORM pg_advisory_xact_lock(hashtext(t::text), hashtext(p_client_request_id::text));
  SELECT * INTO prior FROM public.pfleger_invoice_adjustments WHERE tenant_id = t AND client_request_id = p_client_request_id;
  IF FOUND THEN
    IF prior.original_invoice_approval_id IS DISTINCT FROM p_original_invoice_approval_id OR prior.request_fingerprint IS DISTINCT FROM request_fingerprint OR prior.approved_by IS DISTINCT FROM actor THEN
      RAISE EXCEPTION 'Diese Anforderungs-ID wurde bereits mit einer anderen Gegenbuchung verwendet.' USING ERRCODE = '40001';
    END IF;
    RETURN prior;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(t::text), hashtext(p_original_invoice_approval_id::text));
  SELECT * INTO original_approval FROM public.pfleger_invoice_approvals WHERE id = p_original_invoice_approval_id AND tenant_id = t FOR SHARE;
  IF NOT FOUND OR original_approval.approval_version <> 1 OR original_approval.payment_status <> 'not_inferred' THEN
    RAISE EXCEPTION 'Freigegebene Originalrechnung fehlt oder ist nicht eindeutig.' USING ERRCODE = '40001';
  END IF;
  SELECT * INTO original_draft FROM public.pfleger_invoice_drafts WHERE id = original_approval.invoice_draft_id AND tenant_id = t FOR SHARE;
  IF NOT FOUND OR original_draft.client_id IS DISTINCT FROM original_approval.client_id OR original_draft.total_amount_cents IS DISTINCT FROM original_approval.total_amount_cents THEN
    RAISE EXCEPTION 'Originalrechnung und Entwurf sind nicht vollständig gebunden.' USING ERRCODE = '40001';
  END IF;
  IF approved_at <= original_approval.approved_at OR p_payload->>'documentFingerprint' = original_approval.document_fingerprint THEN
    RAISE EXCEPTION 'Gegenbuchungsfassung muss zeitlich und dokumentbezogen neu sein.' USING ERRCODE = '23514';
  END IF;
  IF EXISTS (SELECT 1 FROM public.pfleger_invoice_adjustments WHERE tenant_id = t AND original_invoice_approval_id = original_approval.id) THEN
    RAISE EXCEPTION 'Die Originalrechnung besitzt bereits eine unveränderliche Gegenbuchung.' USING ERRCODE = '40001';
  END IF;

  SELECT count(*), COALESCE(sum((value->>'creditAmountCents')::bigint),0), count(p.id)
    INTO credit_count, credit_total, matched_count
  FROM jsonb_array_elements(credit_positions) value
  LEFT JOIN public.pfleger_invoice_draft_positions p
    ON p.tenant_id = t AND p.invoice_draft_id = original_draft.id
   AND p.position_no = (value->>'originalPositionNo')::integer
   AND p.billing_case_id = (value->>'billingCaseId')::uuid
   AND p.service_proof_id = (value->>'serviceProofId')::uuid
   AND (value->>'creditAmountCents')::bigint BETWEEN 1 AND p.amount_cents;
  SELECT count(*) INTO original_count FROM public.pfleger_invoice_draft_positions WHERE tenant_id = t AND invoice_draft_id = original_draft.id;
  IF matched_count <> credit_count OR credit_total <> COALESCE((p_payload->>'creditTotalCents')::bigint,-1) OR
     EXISTS (SELECT 1 FROM jsonb_array_elements(credit_positions) value GROUP BY value->>'originalPositionNo' HAVING count(*) > 1) THEN
    RAISE EXCEPTION 'Gegenbuchungspositionen stimmen nicht exakt mit den Originalpositionen überein.' USING ERRCODE = '23514';
  END IF;
  IF adjustment_kind = 'partial_credit' AND (credit_total >= original_approval.total_amount_cents OR p_payload->'replacementInvoice' <> 'null'::jsonb) THEN
    RAISE EXCEPTION 'Teil-Gutschrift darf weder vollständig stornieren noch automatisch neu berechnen.' USING ERRCODE = '23514';
  END IF;
  IF adjustment_kind IN ('full_cancellation','cancel_and_rebill') AND (credit_total <> original_approval.total_amount_cents OR credit_count <> original_count OR EXISTS (
    SELECT 1 FROM jsonb_array_elements(credit_positions) value JOIN public.pfleger_invoice_draft_positions p
      ON p.tenant_id = t AND p.invoice_draft_id = original_draft.id AND p.position_no = (value->>'originalPositionNo')::integer
    WHERE (value->>'creditAmountCents')::bigint <> p.amount_cents
  )) THEN
    RAISE EXCEPTION 'Vollstorno benötigt die exakte Gegenbuchung aller Originalpositionen.' USING ERRCODE = '23514';
  END IF;

  replacement_approval_id := NULLIF(p_payload->'replacementInvoice'->>'invoiceApprovalId','')::uuid;
  IF adjustment_kind = 'cancel_and_rebill' THEN
    IF replacement_approval_id IS NULL THEN RAISE EXCEPTION 'Storno mit Neurechnung benötigt eine neue Freigabe.' USING ERRCODE = '23514'; END IF;
    PERFORM pg_advisory_xact_lock(hashtext(t::text), hashtext(replacement_approval_id::text));
    SELECT * INTO replacement_approval FROM public.pfleger_invoice_approvals WHERE id = replacement_approval_id AND tenant_id = t FOR SHARE;
    SELECT * INTO replacement_draft FROM public.pfleger_invoice_drafts WHERE id = replacement_approval.invoice_draft_id AND tenant_id = t FOR SHARE;
    IF replacement_approval.id IS NULL OR replacement_approval.id = original_approval.id OR replacement_draft.id IS NULL OR
       replacement_approval.client_id IS DISTINCT FROM original_approval.client_id OR replacement_approval.approved_at <= approved_at OR
       replacement_approval.document_fingerprint = original_approval.document_fingerprint OR
       replacement_draft.invoice_number = original_draft.invoice_number OR
       p_payload->'replacementInvoice'->>'replacesInvoiceApprovalId' IS DISTINCT FROM original_approval.id::text OR
       p_payload->'replacementInvoice'->>'invoiceDraftId' IS DISTINCT FROM replacement_draft.id::text OR
       p_payload->'replacementInvoice'->>'invoiceNumber' IS DISTINCT FROM replacement_draft.invoice_number OR
       p_payload->'replacementInvoice'->>'tenantId' IS DISTINCT FROM t::text OR
       p_payload->'replacementInvoice'->>'clientId' IS DISTINCT FROM original_approval.client_id::text OR
       p_payload->'replacementInvoice'->>'documentFingerprint' IS DISTINCT FROM replacement_approval.document_fingerprint OR
       COALESCE((p_payload->'replacementInvoice'->>'totalAmountCents')::bigint,-1) IS DISTINCT FROM replacement_approval.total_amount_cents THEN
      RAISE EXCEPTION 'Neurechnung ist nicht als neue freigegebene Fassung der Originalrechnung gebunden.' USING ERRCODE = '23514';
    END IF;
    replacement_total := replacement_approval.total_amount_cents;
  ELSIF p_payload->'replacementInvoice' <> 'null'::jsonb THEN
    RAISE EXCEPTION 'Diese Gegenbuchungsart darf keine Neurechnung enthalten.' USING ERRCODE = '23514';
  END IF;

  actor_name := public.clinical_actor_name();
  INSERT INTO public.pfleger_invoice_adjustments(
    tenant_id,client_id,original_invoice_approval_id,original_invoice_draft_id,original_invoice_number,
    original_document_fingerprint,original_total_amount_cents,adjustment_number,adjustment_kind,adjustment_basis,reason,
    credit_total_cents,counter_entry_cents,replacement_invoice_approval_id,replacement_invoice_draft_id,replacement_invoice_number,
    replacement_total_amount_cents,resulting_balance_cents,document_fingerprint,source_snapshot,created_by,created_by_name,
    approved_by,approved_by_name,approved_at,carrier_return_effect,transmission_status,payment_status,client_request_id,request_fingerprint
  ) VALUES (
    t,original_approval.client_id,original_approval.id,original_draft.id,original_draft.invoice_number,
    original_approval.document_fingerprint,original_approval.total_amount_cents,btrim(p_payload->>'adjustmentNumber'),adjustment_kind,
    'documented_billing_correction',btrim(p_payload->>'reason'),credit_total,-credit_total,replacement_approval.id,replacement_draft.id,
    replacement_draft.invoice_number,replacement_total,original_approval.total_amount_cents-credit_total+replacement_total,
    p_payload->>'documentFingerprint',jsonb_build_object('originalApproval',to_jsonb(original_approval),'originalDraft',to_jsonb(original_draft),'replacementApproval',to_jsonb(replacement_approval),'replacementDraft',to_jsonb(replacement_draft),'request',p_payload),
    (p_payload->>'createdByUserId')::uuid,COALESCE(NULLIF(btrim(p_payload->>'createdByName'),''),'Unbekannt'),actor,actor_name,approved_at,
    'none','not_inferred','not_inferred',p_client_request_id,request_fingerprint
  ) RETURNING * INTO result;

  INSERT INTO public.pfleger_invoice_adjustment_positions(
    tenant_id,adjustment_id,original_position_no,billing_case_id,service_proof_id,original_amount_cents,credit_amount_cents,counter_entry_cents
  ) SELECT t,result.id,p.position_no,p.billing_case_id,p.service_proof_id,p.amount_cents,(value->>'creditAmountCents')::bigint,-(value->>'creditAmountCents')::bigint
    FROM jsonb_array_elements(credit_positions) value
    JOIN public.pfleger_invoice_draft_positions p ON p.tenant_id=t AND p.invoice_draft_id=original_draft.id
      AND p.position_no=(value->>'originalPositionNo')::integer AND p.billing_case_id=(value->>'billingCaseId')::uuid AND p.service_proof_id=(value->>'serviceProofId')::uuid;
  IF (SELECT count(*) FROM public.pfleger_invoice_adjustment_positions WHERE adjustment_id=result.id) <> credit_count THEN
    RAISE EXCEPTION 'Gegenbuchungspositionen wurden nicht vollständig gespeichert.' USING ERRCODE='40001';
  END IF;
  INSERT INTO public.care_audit_events(tenant_id,client_id,entity_type,entity_id,action,summary,after_data,actor_id,actor_name)
    VALUES(t,original_approval.client_id,'pflege_invoice_adjustment',result.id,'invoice_adjustment_approved',
      'Originalrechnung und exakte Gegenbuchung append-only gespeichert; Rückläufer, Übermittlung und Zahlung nicht abgeleitet.',to_jsonb(result),actor,actor_name);
  RETURN result;
END $$;

REVOKE ALL ON FUNCTION public.record_pfleger_invoice_adjustment(uuid,jsonb,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_pfleger_invoice_adjustment(uuid,jsonb,uuid) TO authenticated;
