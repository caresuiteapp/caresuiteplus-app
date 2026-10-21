-- Checkpoint 239 / U-07: append-only Zahlungen und offene Posten mit centgenauer Forderungszuordnung.
-- Teilzahlungen bleiben teilbezahlt. Fälligkeit, Versand, Rückläufer und Gegenbuchung sind keine Zahlung.

CREATE TABLE IF NOT EXISTS public.pfleger_receivable_open_items (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE RESTRICT,
  receivable_lineage_id uuid NOT NULL,
  invoice_approval_id uuid NOT NULL REFERENCES public.pfleger_invoice_approvals(id) ON DELETE RESTRICT,
  invoice_draft_id uuid NOT NULL REFERENCES public.pfleger_invoice_drafts(id) ON DELETE RESTRICT,
  invoice_number text NOT NULL CHECK (btrim(invoice_number) <> ''),
  adjustment_id uuid REFERENCES public.pfleger_invoice_adjustments(id) ON DELETE RESTRICT,
  document_fingerprint text NOT NULL CHECK (document_fingerprint ~ '^[0-9a-f]{32}$'),
  approved_at timestamptz NOT NULL,
  due_date date NOT NULL,
  receivable_amount_cents bigint NOT NULL CHECK (receivable_amount_cents BETWEEN 1 AND 999999999999),
  source_snapshot jsonb NOT NULL,
  prepared_by uuid NOT NULL REFERENCES auth.users(id),
  prepared_by_name text NOT NULL,
  prepared_at timestamptz NOT NULL,
  CHECK (due_date >= approved_at::date),
  UNIQUE (tenant_id, invoice_approval_id),
  UNIQUE (tenant_id, receivable_lineage_id)
);

CREATE TABLE IF NOT EXISTS public.pfleger_receivable_payment_events (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE RESTRICT,
  event_kind text NOT NULL CHECK (event_kind IN ('payment_received','payment_reversal')),
  payment_method text NOT NULL CHECK (payment_method IN ('bank_transfer','cash','direct_debit')),
  bank_transaction_id text,
  booking_reference text NOT NULL CHECK (btrim(booking_reference) <> ''),
  value_date date NOT NULL,
  recorded_at timestamptz NOT NULL,
  server_recorded_at timestamptz NOT NULL,
  amount_cents bigint NOT NULL CHECK (amount_cents BETWEEN 1 AND 999999999999),
  reverses_payment_event_id uuid REFERENCES public.pfleger_receivable_payment_events(id) ON DELETE RESTRICT,
  reversal_reason text,
  recorded_by uuid NOT NULL REFERENCES auth.users(id),
  recorded_by_name text NOT NULL,
  client_request_id uuid NOT NULL,
  request_fingerprint text NOT NULL CHECK (request_fingerprint ~ '^[0-9a-f]{32}$'),
  CHECK (value_date <= recorded_at::date),
  CHECK ((event_kind = 'payment_reversal') = (reverses_payment_event_id IS NOT NULL)),
  CHECK ((event_kind = 'payment_reversal') = (reversal_reason IS NOT NULL)),
  CHECK (payment_method = 'cash' OR bank_transaction_id IS NOT NULL),
  UNIQUE (tenant_id, client_request_id),
  UNIQUE (tenant_id, bank_transaction_id),
  UNIQUE (tenant_id, reverses_payment_event_id)
);

CREATE TABLE IF NOT EXISTS public.pfleger_receivable_payment_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  payment_event_id uuid NOT NULL REFERENCES public.pfleger_receivable_payment_events(id) ON DELETE RESTRICT,
  open_item_id uuid NOT NULL REFERENCES public.pfleger_receivable_open_items(id) ON DELETE RESTRICT,
  invoice_approval_id uuid NOT NULL REFERENCES public.pfleger_invoice_approvals(id) ON DELETE RESTRICT,
  receivable_lineage_id uuid NOT NULL,
  amount_cents bigint NOT NULL CHECK (amount_cents BETWEEN 1 AND 999999999999),
  UNIQUE (payment_event_id, open_item_id)
);

ALTER TABLE public.pfleger_receivable_open_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pfleger_receivable_payment_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pfleger_receivable_payment_allocations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.pfleger_receivable_open_items, public.pfleger_receivable_payment_events, public.pfleger_receivable_payment_allocations FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.pfleger_receivable_open_items, public.pfleger_receivable_payment_events, public.pfleger_receivable_payment_allocations TO authenticated;

DROP POLICY IF EXISTS pfleger_receivable_open_items_read ON public.pfleger_receivable_open_items;
CREATE POLICY pfleger_receivable_open_items_read ON public.pfleger_receivable_open_items FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id() AND public.has_permission('pflege.billing.view'));
DROP POLICY IF EXISTS pfleger_receivable_payment_events_read ON public.pfleger_receivable_payment_events;
CREATE POLICY pfleger_receivable_payment_events_read ON public.pfleger_receivable_payment_events FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id() AND public.has_permission('pflege.billing.view'));
DROP POLICY IF EXISTS pfleger_receivable_payment_allocations_read ON public.pfleger_receivable_payment_allocations;
CREATE POLICY pfleger_receivable_payment_allocations_read ON public.pfleger_receivable_payment_allocations FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id() AND public.has_permission('pflege.billing.view'));

CREATE OR REPLACE FUNCTION care_private.protect_pfleger_receivable_history()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  RAISE EXCEPTION 'Forderungs-, Zahlungs- und Zuordnungshistorien bleiben unverändert.' USING ERRCODE = '42501';
END $$;
DROP TRIGGER IF EXISTS protect_pfleger_receivable_open_items ON public.pfleger_receivable_open_items;
CREATE TRIGGER protect_pfleger_receivable_open_items BEFORE UPDATE OR DELETE ON public.pfleger_receivable_open_items
  FOR EACH ROW EXECUTE FUNCTION care_private.protect_pfleger_receivable_history();
DROP TRIGGER IF EXISTS protect_pfleger_receivable_payment_events ON public.pfleger_receivable_payment_events;
CREATE TRIGGER protect_pfleger_receivable_payment_events BEFORE UPDATE OR DELETE ON public.pfleger_receivable_payment_events
  FOR EACH ROW EXECUTE FUNCTION care_private.protect_pfleger_receivable_history();
DROP TRIGGER IF EXISTS protect_pfleger_receivable_payment_allocations ON public.pfleger_receivable_payment_allocations;
CREATE TRIGGER protect_pfleger_receivable_payment_allocations BEFORE UPDATE OR DELETE ON public.pfleger_receivable_payment_allocations
  FOR EACH ROW EXECUTE FUNCTION care_private.protect_pfleger_receivable_history();

CREATE OR REPLACE FUNCTION public.prepare_pfleger_receivable_open_item(p_invoice_approval_id uuid)
RETURNS public.pfleger_receivable_open_items
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  t uuid := public.current_tenant_id(); actor uuid := auth.uid(); actor_name text;
  approval public.pfleger_invoice_approvals; draft public.pfleger_invoice_drafts;
  adjustment public.pfleger_invoice_adjustments; prior public.pfleger_receivable_open_items;
  result public.pfleger_receivable_open_items; item_id uuid := gen_random_uuid(); amount bigint;
  actual_time timestamptz := clock_timestamp();
BEGIN
  IF t IS NULL OR actor IS NULL OR NOT public.has_permission('pflege.invoices.manage') THEN
    RAISE EXCEPTION 'Keine Berechtigung.' USING ERRCODE = '42501';
  END IF;
  IF p_invoice_approval_id IS NULL THEN RAISE EXCEPTION 'Rechnungsfreigabe fehlt.' USING ERRCODE = '23514'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext(t::text), hashtext(p_invoice_approval_id::text));
  SELECT * INTO prior FROM public.pfleger_receivable_open_items WHERE tenant_id = t AND invoice_approval_id = p_invoice_approval_id;
  IF FOUND THEN RETURN prior; END IF;
  SELECT * INTO approval FROM public.pfleger_invoice_approvals WHERE tenant_id = t AND id = p_invoice_approval_id FOR SHARE;
  IF NOT FOUND OR approval.approval_version <> 1 THEN RAISE EXCEPTION 'Freigegebene Rechnungsfassung fehlt.' USING ERRCODE = '42501'; END IF;
  SELECT * INTO draft FROM public.pfleger_invoice_drafts WHERE tenant_id = t AND id = approval.invoice_draft_id FOR SHARE;
  IF NOT FOUND OR draft.client_id IS DISTINCT FROM approval.client_id OR draft.total_amount_cents IS DISTINCT FROM approval.total_amount_cents OR draft.due_date < approval.approved_at::date THEN
    RAISE EXCEPTION 'Rechnung, Entwurf und Fälligkeit sind nicht vollständig gebunden.' USING ERRCODE = '40001';
  END IF;
  SELECT * INTO adjustment FROM public.pfleger_invoice_adjustments
    WHERE tenant_id = t AND (original_invoice_approval_id = approval.id OR replacement_invoice_approval_id = approval.id)
    ORDER BY approved_at DESC LIMIT 1 FOR SHARE;
  IF FOUND THEN
    IF adjustment.original_invoice_approval_id = approval.id AND adjustment.adjustment_kind IN ('full_cancellation','cancel_and_rebill') THEN
      RAISE EXCEPTION 'Die Originalrechnung ist vollständig storniert oder durch eine Neurechnung ersetzt.' USING ERRCODE = '23514';
    END IF;
    amount := adjustment.resulting_balance_cents;
  ELSE amount := approval.total_amount_cents;
  END IF;
  IF amount IS NULL OR amount <= 0 THEN RAISE EXCEPTION 'Für diese Rechnungsfassung besteht kein positiver offener Betrag.' USING ERRCODE = '23514'; END IF;
  actor_name := public.clinical_actor_name();
  INSERT INTO public.pfleger_receivable_open_items(
    id,tenant_id,client_id,receivable_lineage_id,invoice_approval_id,invoice_draft_id,invoice_number,adjustment_id,
    document_fingerprint,approved_at,due_date,receivable_amount_cents,source_snapshot,prepared_by,prepared_by_name,prepared_at
  ) VALUES (
    item_id,t,approval.client_id,item_id,approval.id,draft.id,draft.invoice_number,adjustment.id,approval.document_fingerprint,
    approval.approved_at,draft.due_date,amount,jsonb_build_object('approval',to_jsonb(approval),'draft',to_jsonb(draft),'adjustment',to_jsonb(adjustment)),actor,actor_name,actual_time
  ) RETURNING * INTO result;
  INSERT INTO public.care_audit_events(tenant_id,client_id,entity_type,entity_id,action,summary,after_data,actor_id,actor_name)
    VALUES(t,approval.client_id,'pflege_receivable_open_item',result.id,'receivable_prepared','Freigegebene Rechnungsfassung und aktueller Gegenbuchungssaldo als eigener offener Posten vorbereitet; keine Zahlung abgeleitet.',to_jsonb(result),actor,actor_name);
  RETURN result;
END $$;

CREATE OR REPLACE FUNCTION public.record_pfleger_receivable_payment(p_payload jsonb, p_client_request_id uuid)
RETURNS public.pfleger_receivable_payment_events
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  t uuid := public.current_tenant_id(); actor uuid := auth.uid(); actor_name text;
  event_kind text := COALESCE(p_payload->>'eventKind',''); payment_method text := COALESCE(p_payload->>'paymentMethod','');
  event_id uuid; event_client uuid; original public.pfleger_receivable_payment_events; prior public.pfleger_receivable_payment_events;
  result public.pfleger_receivable_payment_events; allocations jsonb := COALESCE(p_payload->'allocations','[]'::jsonb);
  allocation_count integer; matched_count integer; allocation_total bigint; payment_amount bigint;
  recorded_at timestamptz; value_date date; request_fingerprint text; actual_time timestamptz := clock_timestamp();
BEGIN
  IF t IS NULL OR actor IS NULL OR NOT public.has_permission('pflege.invoices.manage') THEN
    RAISE EXCEPTION 'Keine Berechtigung.' USING ERRCODE = '42501';
  END IF;
  IF p_payload IS NULL OR p_client_request_id IS NULL OR event_kind NOT IN ('payment_received','payment_reversal') OR
     payment_method NOT IN ('bank_transfer','cash','direct_debit') OR btrim(COALESCE(p_payload->>'bookingReference','')) = '' OR
     COALESCE(p_payload->>'recordedAt','') !~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}(Z|\+00:00)$' OR
     COALESCE(p_payload->>'valueDate','') !~ '^\d{4}-\d{2}-\d{2}$' OR COALESCE((p_payload->>'amountCents')::bigint,0) <= 0 THEN
    RAISE EXCEPTION 'Zahlungsauftrag ist unvollständig oder ungültig.' USING ERRCODE = '23514';
  END IF;
  IF payment_method <> 'cash' AND btrim(COALESCE(p_payload->>'bankTransactionId','')) = '' THEN
    RAISE EXCEPTION 'Bankzahlung benötigt eine native Transaktions-ID.' USING ERRCODE = '23514';
  END IF;
  event_id := (p_payload->>'paymentEventId')::uuid; event_client := (p_payload->>'clientId')::uuid;
  recorded_at := (p_payload->>'recordedAt')::timestamptz; value_date := (p_payload->>'valueDate')::date; payment_amount := (p_payload->>'amountCents')::bigint;
  IF p_payload->>'tenantId' IS DISTINCT FROM t::text OR value_date > recorded_at::date THEN
    RAISE EXCEPTION 'Mandant oder Zeitbezug des Zahlungsereignisses ist ungültig.' USING ERRCODE = '23514';
  END IF;
  request_fingerprint := md5(jsonb_build_object('payload',p_payload,'requestId',p_client_request_id)::text);
  PERFORM pg_advisory_xact_lock(hashtext(t::text), hashtext(p_client_request_id::text));
  SELECT * INTO prior FROM public.pfleger_receivable_payment_events WHERE tenant_id = t AND client_request_id = p_client_request_id;
  IF FOUND THEN
    IF prior.id IS DISTINCT FROM event_id OR prior.request_fingerprint IS DISTINCT FROM request_fingerprint THEN
      RAISE EXCEPTION 'Diese Anforderungs-ID wurde bereits mit einem anderen Zahlungsereignis verwendet.' USING ERRCODE = '40001';
    END IF;
    RETURN prior;
  END IF;
  PERFORM pg_advisory_xact_lock(hashtext(t::text), hashtext(event_id::text));
  IF event_kind = 'payment_received' THEN
    IF jsonb_typeof(allocations) <> 'array' OR jsonb_array_length(allocations) = 0 OR p_payload->>'reversesPaymentEventId' IS NOT NULL OR p_payload->>'reversalReason' IS NOT NULL THEN
      RAISE EXCEPTION 'Zahlungseingang benötigt ausschließlich konkrete Forderungszuordnungen.' USING ERRCODE = '23514';
    END IF;
    SELECT count(*),COALESCE(sum((value->>'amountCents')::bigint),0),count(i.id) INTO allocation_count,allocation_total,matched_count
      FROM jsonb_array_elements(allocations) value
      LEFT JOIN public.pfleger_receivable_open_items i ON i.tenant_id=t AND i.client_id=event_client
        AND i.id=(value->>'openItemId')::uuid AND i.invoice_approval_id=(value->>'invoiceApprovalId')::uuid
        AND i.receivable_lineage_id=(value->>'claimLineageId')::uuid
        AND (value->>'amountCents')::bigint BETWEEN 1 AND i.receivable_amount_cents;
    IF allocation_count <> matched_count OR allocation_total <> payment_amount OR EXISTS (
      SELECT 1 FROM jsonb_array_elements(allocations) value GROUP BY value->>'openItemId' HAVING count(*) > 1
    ) THEN RAISE EXCEPTION 'Zahlung ist nicht centgenau und eindeutig den offenen Posten zugeordnet.' USING ERRCODE = '23514'; END IF;
    IF EXISTS (
      SELECT 1 FROM jsonb_array_elements(allocations) value
      JOIN public.pfleger_receivable_open_items i ON i.tenant_id=t AND i.id=(value->>'openItemId')::uuid
      WHERE value_date < i.approved_at::date OR recorded_at <= i.approved_at OR
        (value->>'amountCents')::bigint + COALESCE((SELECT sum(a.amount_cents)
          FROM public.pfleger_receivable_payment_allocations a
          JOIN public.pfleger_receivable_payment_events e ON e.id=a.payment_event_id AND e.event_kind='payment_received'
          WHERE a.tenant_id=t AND a.open_item_id=i.id AND NOT EXISTS (
            SELECT 1 FROM public.pfleger_receivable_payment_events r WHERE r.tenant_id=t AND r.event_kind='payment_reversal' AND r.reverses_payment_event_id=e.id
          )),0) > i.receivable_amount_cents
    ) THEN RAISE EXCEPTION 'Zahlung liegt vor der Forderung oder übersteigt den offenen Restbetrag.' USING ERRCODE = '23514'; END IF;
  ELSE
    IF jsonb_typeof(allocations) <> 'array' OR jsonb_array_length(allocations) <> 0 OR btrim(COALESCE(p_payload->>'reversalReason','')) = '' THEN
      RAISE EXCEPTION 'Zahlungsstorno benötigt Grund und keine neue Zuordnung.' USING ERRCODE = '23514';
    END IF;
    PERFORM pg_advisory_xact_lock(hashtext(t::text),hashtext((p_payload->>'reversesPaymentEventId')::text));
    SELECT * INTO original FROM public.pfleger_receivable_payment_events
      WHERE tenant_id=t AND id=(p_payload->>'reversesPaymentEventId')::uuid AND event_kind='payment_received' FOR SHARE;
    IF NOT FOUND OR original.client_id IS DISTINCT FROM event_client OR original.amount_cents IS DISTINCT FROM payment_amount OR
       original.payment_method IS DISTINCT FROM payment_method OR recorded_at <= original.recorded_at OR EXISTS (
         SELECT 1 FROM public.pfleger_receivable_payment_events WHERE tenant_id=t AND reverses_payment_event_id=original.id
       ) THEN RAISE EXCEPTION 'Zahlungsstorno muss genau einen vorhandenen Zahlungseingang vollständig und später umkehren.' USING ERRCODE = '23514'; END IF;
  END IF;
  actor_name := public.clinical_actor_name();
  INSERT INTO public.pfleger_receivable_payment_events(
    id,tenant_id,client_id,event_kind,payment_method,bank_transaction_id,booking_reference,value_date,recorded_at,server_recorded_at,
    amount_cents,reverses_payment_event_id,reversal_reason,recorded_by,recorded_by_name,client_request_id,request_fingerprint
  ) VALUES (
    event_id,t,event_client,event_kind,payment_method,NULLIF(btrim(p_payload->>'bankTransactionId'),''),btrim(p_payload->>'bookingReference'),
    value_date,recorded_at,actual_time,payment_amount,NULLIF(p_payload->>'reversesPaymentEventId','')::uuid,NULLIF(btrim(p_payload->>'reversalReason'),''),
    actor,actor_name,p_client_request_id,request_fingerprint
  ) RETURNING * INTO result;
  IF event_kind = 'payment_received' THEN
    INSERT INTO public.pfleger_receivable_payment_allocations(tenant_id,payment_event_id,open_item_id,invoice_approval_id,receivable_lineage_id,amount_cents)
      SELECT t,result.id,(value->>'openItemId')::uuid,(value->>'invoiceApprovalId')::uuid,(value->>'claimLineageId')::uuid,(value->>'amountCents')::bigint
      FROM jsonb_array_elements(allocations) value;
    IF (SELECT count(*) FROM public.pfleger_receivable_payment_allocations WHERE payment_event_id=result.id) <> allocation_count THEN
      RAISE EXCEPTION 'Zahlungszuordnungen wurden nicht vollständig gespeichert.' USING ERRCODE = '40001';
    END IF;
  END IF;
  INSERT INTO public.care_audit_events(tenant_id,client_id,entity_type,entity_id,action,summary,after_data,actor_id,actor_name)
    VALUES(t,event_client,'pflege_receivable_payment',result.id,event_kind,'Zahlungsereignis append-only und centgenau zugeordnet; Teilzahlung bleibt teilbezahlt.',to_jsonb(result),actor,actor_name);
  RETURN result;
END $$;

REVOKE ALL ON FUNCTION public.prepare_pfleger_receivable_open_item(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.prepare_pfleger_receivable_open_item(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.record_pfleger_receivable_payment(jsonb,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_pfleger_receivable_payment(jsonb,uuid) TO authenticated;
