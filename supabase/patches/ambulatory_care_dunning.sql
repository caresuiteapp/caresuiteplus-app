-- Checkpoint 241 / U-09: append-only Mahnwesen mit erneuter Zahlungsprüfung vor Mahnstufe und Versand.
-- Zahlung, Mahnstufe, Versand, Gebühren, Zinsen und Vollstreckung bleiben getrennte Tatsachen.

CREATE TABLE IF NOT EXISTS public.pfleger_dunning_notices (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE RESTRICT,
  open_item_id uuid NOT NULL REFERENCES public.pfleger_receivable_open_items(id) ON DELETE RESTRICT,
  invoice_approval_id uuid NOT NULL REFERENCES public.pfleger_invoice_approvals(id) ON DELETE RESTRICT,
  receivable_lineage_id uuid NOT NULL,
  document_fingerprint text NOT NULL CHECK (document_fingerprint ~ '^[0-9a-f]{32}$'),
  invoice_number text NOT NULL CHECK (btrim(invoice_number) <> ''),
  stage text NOT NULL CHECK (stage IN ('payment_reminder','first_notice','second_notice','final_notice')),
  predecessor_notice_id uuid REFERENCES public.pfleger_dunning_notices(id) ON DELETE RESTRICT,
  due_date date NOT NULL,
  notice_amount_cents bigint NOT NULL CHECK (notice_amount_cents BETWEEN 1 AND 999999999999),
  paid_amount_cents bigint NOT NULL CHECK (paid_amount_cents BETWEEN 0 AND 999999999999),
  remaining_amount_cents bigint NOT NULL CHECK (remaining_amount_cents BETWEEN 1 AND 999999999999),
  payment_revision bigint NOT NULL CHECK (payment_revision >= 0),
  latest_payment_at timestamptz,
  payment_read_at timestamptz NOT NULL,
  recorded_at timestamptz NOT NULL,
  next_review_date date NOT NULL,
  fee_state text NOT NULL DEFAULT 'not_inferred' CHECK (fee_state = 'not_inferred'),
  interest_state text NOT NULL DEFAULT 'not_inferred' CHECK (interest_state = 'not_inferred'),
  dispatch_state text NOT NULL DEFAULT 'not_inferred' CHECK (dispatch_state = 'not_inferred'),
  recorded_by uuid NOT NULL REFERENCES auth.users(id),
  recorded_by_name text NOT NULL,
  client_request_id uuid NOT NULL,
  request_fingerprint text NOT NULL CHECK (request_fingerprint ~ '^[0-9a-f]{32}$'),
  CHECK (notice_amount_cents = remaining_amount_cents),
  CHECK (recorded_at > payment_read_at),
  CHECK (latest_payment_at IS NULL OR payment_read_at >= latest_payment_at),
  CHECK (next_review_date >= recorded_at::date),
  UNIQUE (tenant_id, client_request_id),
  UNIQUE (tenant_id, open_item_id, stage),
  UNIQUE (tenant_id, predecessor_notice_id)
);

CREATE TABLE IF NOT EXISTS public.pfleger_dunning_dispatches (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE RESTRICT,
  dunning_notice_id uuid NOT NULL REFERENCES public.pfleger_dunning_notices(id) ON DELETE RESTRICT,
  recipient_id uuid NOT NULL,
  recipient_role text NOT NULL CHECK (recipient_role IN ('debtor','authorized_representative')),
  authorization_evidence_id uuid NOT NULL,
  authorization_fingerprint text NOT NULL CHECK (authorization_fingerprint ~ '^[0-9a-f]{32}$'),
  dispatch_channel text NOT NULL CHECK (dispatch_channel IN ('postal','secure_portal')),
  delivery_destination_fingerprint text NOT NULL CHECK (delivery_destination_fingerprint ~ '^[0-9a-f]{32}$'),
  dispatch_proof_id uuid NOT NULL,
  dispatch_proof_fingerprint text NOT NULL CHECK (dispatch_proof_fingerprint ~ '^[0-9a-f]{32}$'),
  payment_revision bigint NOT NULL CHECK (payment_revision >= 0),
  latest_payment_at timestamptz,
  remaining_amount_cents bigint NOT NULL CHECK (remaining_amount_cents BETWEEN 1 AND 999999999999),
  payment_read_at timestamptz NOT NULL,
  dispatched_at timestamptz NOT NULL,
  dispatched_by uuid NOT NULL REFERENCES auth.users(id),
  dispatched_by_name text NOT NULL,
  client_request_id uuid NOT NULL,
  request_fingerprint text NOT NULL CHECK (request_fingerprint ~ '^[0-9a-f]{32}$'),
  CHECK (dispatched_at > payment_read_at),
  UNIQUE (tenant_id, client_request_id),
  UNIQUE (tenant_id, dunning_notice_id),
  UNIQUE (tenant_id, dispatch_proof_id)
);

ALTER TABLE public.pfleger_dunning_notices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pfleger_dunning_dispatches ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.pfleger_dunning_notices, public.pfleger_dunning_dispatches FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.pfleger_dunning_notices, public.pfleger_dunning_dispatches TO authenticated;

DROP POLICY IF EXISTS pfleger_dunning_notices_read ON public.pfleger_dunning_notices;
CREATE POLICY pfleger_dunning_notices_read ON public.pfleger_dunning_notices FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id() AND public.has_permission('pflege.billing.view'));
DROP POLICY IF EXISTS pfleger_dunning_dispatches_read ON public.pfleger_dunning_dispatches;
CREATE POLICY pfleger_dunning_dispatches_read ON public.pfleger_dunning_dispatches FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id() AND public.has_permission('pflege.billing.view'));

CREATE OR REPLACE FUNCTION care_private.protect_pfleger_dunning_history()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  RAISE EXCEPTION 'Mahn- und Versandhistorien bleiben unverändert.' USING ERRCODE = '42501';
END $$;
DROP TRIGGER IF EXISTS protect_pfleger_dunning_notices ON public.pfleger_dunning_notices;
CREATE TRIGGER protect_pfleger_dunning_notices BEFORE UPDATE OR DELETE ON public.pfleger_dunning_notices
  FOR EACH ROW EXECUTE FUNCTION care_private.protect_pfleger_dunning_history();
DROP TRIGGER IF EXISTS protect_pfleger_dunning_dispatches ON public.pfleger_dunning_dispatches;
CREATE TRIGGER protect_pfleger_dunning_dispatches BEFORE UPDATE OR DELETE ON public.pfleger_dunning_dispatches
  FOR EACH ROW EXECUTE FUNCTION care_private.protect_pfleger_dunning_history();

CREATE OR REPLACE FUNCTION public.record_pfleger_dunning_notice(
  p_open_item_id uuid,
  p_expected_invoice_approval_id uuid,
  p_expected_receivable_lineage_id uuid,
  p_expected_document_fingerprint text,
  p_requested_stage text,
  p_predecessor_notice_id uuid,
  p_next_review_date date,
  p_client_request_id uuid
) RETURNS public.pfleger_dunning_notices
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  t uuid := public.current_tenant_id(); actor uuid := auth.uid(); actor_name text;
  item public.pfleger_receivable_open_items; predecessor public.pfleger_dunning_notices;
  prior public.pfleger_dunning_notices; result public.pfleger_dunning_notices;
  expected_stage text; notice_id uuid := gen_random_uuid(); paid bigint; remaining bigint;
  payment_revision bigint; latest_payment_at timestamptz; payment_read_at timestamptz;
  actual_time timestamptz; request_fingerprint text;
BEGIN
  IF t IS NULL OR actor IS NULL OR NOT public.has_permission('pflege.invoices.manage') THEN
    RAISE EXCEPTION 'Keine Berechtigung.' USING ERRCODE = '42501';
  END IF;
  IF p_open_item_id IS NULL OR p_expected_invoice_approval_id IS NULL OR p_expected_receivable_lineage_id IS NULL OR
     p_expected_document_fingerprint !~ '^[0-9a-f]{32}$' OR p_requested_stage NOT IN ('payment_reminder','first_notice','second_notice','final_notice') OR
     p_next_review_date IS NULL OR p_client_request_id IS NULL THEN
    RAISE EXCEPTION 'Mahnauftrag ist unvollständig oder ungültig.' USING ERRCODE = '23514';
  END IF;
  request_fingerprint := md5(jsonb_build_object(
    'openItemId',p_open_item_id,'invoiceApprovalId',p_expected_invoice_approval_id,'receivableLineageId',p_expected_receivable_lineage_id,
    'documentFingerprint',p_expected_document_fingerprint,'stage',p_requested_stage,'predecessorNoticeId',p_predecessor_notice_id,
    'nextReviewDate',p_next_review_date,'requestId',p_client_request_id
  )::text);
  PERFORM pg_advisory_xact_lock(hashtext(t::text), hashtext(p_client_request_id::text));
  SELECT * INTO prior FROM public.pfleger_dunning_notices WHERE tenant_id = t AND client_request_id = p_client_request_id;
  IF FOUND THEN
    IF prior.open_item_id IS DISTINCT FROM p_open_item_id OR prior.request_fingerprint IS DISTINCT FROM request_fingerprint THEN
      RAISE EXCEPTION 'Anforderungs-ID wurde mit einem anderen Mahnauftrag verwendet.' USING ERRCODE = '40001';
    END IF;
    RETURN prior;
  END IF;
  PERFORM pg_advisory_xact_lock(hashtext(t::text), hashtext(p_open_item_id::text));
  SELECT * INTO item FROM public.pfleger_receivable_open_items WHERE tenant_id = t AND id = p_open_item_id FOR SHARE;
  IF NOT FOUND OR item.invoice_approval_id IS DISTINCT FROM p_expected_invoice_approval_id OR item.receivable_lineage_id IS DISTINCT FROM p_expected_receivable_lineage_id OR item.document_fingerprint IS DISTINCT FROM p_expected_document_fingerprint THEN
    RAISE EXCEPTION 'Mahnauftrag ist nicht exakt an den offenen Posten gebunden.' USING ERRCODE = '23514';
  END IF;
  IF item.due_date >= current_date THEN RAISE EXCEPTION 'Noch nicht überfällige Forderung darf nicht gemahnt werden.' USING ERRCODE = '23514'; END IF;
  SELECT * INTO predecessor FROM public.pfleger_dunning_notices WHERE tenant_id=t AND open_item_id=item.id ORDER BY recorded_at DESC LIMIT 1 FOR SHARE;
  expected_stage := CASE WHEN NOT FOUND THEN 'payment_reminder' WHEN predecessor.stage='payment_reminder' THEN 'first_notice' WHEN predecessor.stage='first_notice' THEN 'second_notice' WHEN predecessor.stage='second_notice' THEN 'final_notice' ELSE NULL END;
  IF expected_stage IS NULL OR p_requested_stage IS DISTINCT FROM expected_stage OR p_predecessor_notice_id IS DISTINCT FROM predecessor.id OR (predecessor.id IS NOT NULL AND current_date < predecessor.next_review_date) THEN
    RAISE EXCEPTION 'Mahnstufe, Vorgänger oder ausdrücklich gesetztes nächstes Prüfdatum ist nicht erfüllt.' USING ERRCODE = '23514';
  END IF;
  payment_read_at := clock_timestamp();
  SELECT COALESCE(sum(a.amount_cents) FILTER (WHERE NOT EXISTS (
      SELECT 1 FROM public.pfleger_receivable_payment_events r WHERE r.tenant_id=t AND r.event_kind='payment_reversal' AND r.reverses_payment_event_id=e.id
    )),0),
    count(DISTINCT e.id) + count(DISTINCT r.id),
    max(GREATEST(e.recorded_at,COALESCE(r.recorded_at,e.recorded_at)))
  INTO paid,payment_revision,latest_payment_at
  FROM public.pfleger_receivable_payment_allocations a
  JOIN public.pfleger_receivable_payment_events e ON e.tenant_id=t AND e.id=a.payment_event_id AND e.event_kind='payment_received'
  LEFT JOIN public.pfleger_receivable_payment_events r ON r.tenant_id=t AND r.event_kind='payment_reversal' AND r.reverses_payment_event_id=e.id
  WHERE a.tenant_id=t AND a.open_item_id=item.id;
  remaining := item.receivable_amount_cents - paid;
  IF remaining <= 0 THEN RAISE EXCEPTION 'Zwischenzeitliche Zahlung hat die Forderung ausgeglichen.' USING ERRCODE = '23514'; END IF;
  IF paid < 0 OR remaining > item.receivable_amount_cents OR p_next_review_date < current_date THEN
    RAISE EXCEPTION 'Neu gelesener Zahlungsstand oder nächste Prüfung ist ungültig.' USING ERRCODE = '23514';
  END IF;
  actual_time := clock_timestamp(); actor_name := public.clinical_actor_name();
  INSERT INTO public.pfleger_dunning_notices(
    id,tenant_id,client_id,open_item_id,invoice_approval_id,receivable_lineage_id,document_fingerprint,invoice_number,stage,
    predecessor_notice_id,due_date,notice_amount_cents,paid_amount_cents,remaining_amount_cents,payment_revision,latest_payment_at,
    payment_read_at,recorded_at,next_review_date,fee_state,interest_state,dispatch_state,recorded_by,recorded_by_name,client_request_id,request_fingerprint
  ) VALUES (
    notice_id,t,item.client_id,item.id,item.invoice_approval_id,item.receivable_lineage_id,item.document_fingerprint,item.invoice_number,p_requested_stage,
    predecessor.id,item.due_date,remaining,paid,remaining,payment_revision,latest_payment_at,payment_read_at,actual_time,p_next_review_date,
    'not_inferred','not_inferred','not_inferred',actor,actor_name,p_client_request_id,request_fingerprint
  ) RETURNING * INTO result;
  INSERT INTO public.care_audit_events(tenant_id,client_id,entity_type,entity_id,action,summary,after_data,actor_id,actor_name)
    VALUES(t,item.client_id,'pflege_dunning_notice',result.id,'dunning_notice_recorded','Mahnstufe nach erneutem Zahlungslesen append-only gebunden; Versand, Gebühren, Zinsen und Vollstreckung nicht abgeleitet.',to_jsonb(result),actor,actor_name);
  RETURN result;
END $$;

CREATE OR REPLACE FUNCTION public.record_pfleger_dunning_dispatch(p_payload jsonb, p_client_request_id uuid)
RETURNS public.pfleger_dunning_dispatches
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  t uuid := public.current_tenant_id(); actor uuid := auth.uid(); actor_name text;
  notice public.pfleger_dunning_notices; item public.pfleger_receivable_open_items;
  prior public.pfleger_dunning_dispatches; result public.pfleger_dunning_dispatches;
  dispatch_id uuid; paid bigint; remaining bigint; payment_revision bigint; latest_payment_at timestamptz;
  payment_read_at timestamptz; actual_time timestamptz; request_fingerprint text;
BEGIN
  IF t IS NULL OR actor IS NULL OR NOT public.has_permission('pflege.invoices.manage') THEN RAISE EXCEPTION 'Keine Berechtigung.' USING ERRCODE='42501'; END IF;
  IF p_payload IS NULL OR p_client_request_id IS NULL OR COALESCE(p_payload->>'recipientRole','') NOT IN ('debtor','authorized_representative') OR COALESCE(p_payload->>'dispatchChannel','') NOT IN ('postal','secure_portal') OR
     COALESCE(p_payload->>'authorizationFingerprint','') !~ '^[0-9a-f]{32}$' OR COALESCE(p_payload->>'deliveryDestinationFingerprint','') !~ '^[0-9a-f]{32}$' OR COALESCE(p_payload->>'dispatchProofFingerprint','') !~ '^[0-9a-f]{32}$' THEN
    RAISE EXCEPTION 'Versandauftrag ist unvollständig oder ungültig.' USING ERRCODE='23514';
  END IF;
  dispatch_id := (p_payload->>'dunningDispatchId')::uuid;
  request_fingerprint := md5(jsonb_build_object('payload',p_payload,'requestId',p_client_request_id)::text);
  PERFORM pg_advisory_xact_lock(hashtext(t::text),hashtext(p_client_request_id::text));
  SELECT * INTO prior FROM public.pfleger_dunning_dispatches WHERE tenant_id=t AND client_request_id=p_client_request_id;
  IF FOUND THEN IF prior.id IS DISTINCT FROM dispatch_id OR prior.request_fingerprint IS DISTINCT FROM request_fingerprint THEN RAISE EXCEPTION 'Versand-Anforderungs-ID wurde anders verwendet.' USING ERRCODE='40001'; END IF;RETURN prior;END IF;
  PERFORM pg_advisory_xact_lock(hashtext(t::text),hashtext((p_payload->>'dunningNoticeId')::text));
  SELECT * INTO notice FROM public.pfleger_dunning_notices WHERE tenant_id=t AND id=(p_payload->>'dunningNoticeId')::uuid FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Mahnereignis fehlt.' USING ERRCODE='23514'; END IF;
  SELECT * INTO item FROM public.pfleger_receivable_open_items WHERE tenant_id=t AND id=notice.open_item_id FOR SHARE;
  payment_read_at := clock_timestamp();
  SELECT COALESCE(sum(a.amount_cents) FILTER (WHERE NOT EXISTS (
    SELECT 1 FROM public.pfleger_receivable_payment_events r WHERE r.tenant_id=t AND r.event_kind='payment_reversal' AND r.reverses_payment_event_id=e.id
  )),0),
    count(DISTINCT e.id) + count(DISTINCT r.id),
    max(GREATEST(e.recorded_at,COALESCE(r.recorded_at,e.recorded_at)))
  INTO paid,payment_revision,latest_payment_at
  FROM public.pfleger_receivable_payment_allocations a
  JOIN public.pfleger_receivable_payment_events e ON e.tenant_id=t AND e.id=a.payment_event_id AND e.event_kind='payment_received'
  LEFT JOIN public.pfleger_receivable_payment_events r ON r.tenant_id=t AND r.event_kind='payment_reversal' AND r.reverses_payment_event_id=e.id
  WHERE a.tenant_id=t AND a.open_item_id=item.id;
  remaining := item.receivable_amount_cents-paid;
  IF remaining <= 0 OR remaining IS DISTINCT FROM notice.notice_amount_cents OR paid IS DISTINCT FROM notice.paid_amount_cents OR
     payment_revision IS DISTINCT FROM notice.payment_revision OR latest_payment_at IS DISTINCT FROM notice.latest_payment_at THEN
    RAISE EXCEPTION 'Zwischenzeitliche Zahlung verhindert den Versand; Mahnbetrag muss neu geprüft werden.' USING ERRCODE='40001';
  END IF;
  actual_time:=clock_timestamp();actor_name:=public.clinical_actor_name();
  INSERT INTO public.pfleger_dunning_dispatches(id,tenant_id,client_id,dunning_notice_id,recipient_id,recipient_role,authorization_evidence_id,authorization_fingerprint,dispatch_channel,delivery_destination_fingerprint,dispatch_proof_id,dispatch_proof_fingerprint,payment_revision,latest_payment_at,remaining_amount_cents,payment_read_at,dispatched_at,dispatched_by,dispatched_by_name,client_request_id,request_fingerprint)
  VALUES(dispatch_id,t,notice.client_id,notice.id,(p_payload->>'recipientId')::uuid,p_payload->>'recipientRole',(p_payload->>'authorizationEvidenceId')::uuid,p_payload->>'authorizationFingerprint',p_payload->>'dispatchChannel',p_payload->>'deliveryDestinationFingerprint',(p_payload->>'dispatchProofId')::uuid,p_payload->>'dispatchProofFingerprint',payment_revision,latest_payment_at,remaining,payment_read_at,actual_time,actor,actor_name,p_client_request_id,request_fingerprint) RETURNING * INTO result;
  INSERT INTO public.care_audit_events(tenant_id,client_id,entity_type,entity_id,action,summary,after_data,actor_id,actor_name)
    VALUES(t,notice.client_id,'pflege_dunning_dispatch',result.id,'dunning_dispatched','Berechtigter Versand nach erneuter Zahlungsprüfung separat belegt.',to_jsonb(result),actor,actor_name);
  RETURN result;
END $$;

REVOKE ALL ON FUNCTION public.record_pfleger_dunning_notice(uuid,uuid,uuid,text,text,uuid,date,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_pfleger_dunning_notice(uuid,uuid,uuid,text,text,uuid,date,uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.record_pfleger_dunning_dispatch(jsonb,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_pfleger_dunning_dispatch(jsonb,uuid) TO authenticated;
