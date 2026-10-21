-- Checkpoint 234 / U-02: nachrechenbarer Rechnungsentwurf aus genau einer gebundenen Grundlage.
-- Erstellen ist weder Freigabe noch Übertragung oder Versand.

CREATE TABLE IF NOT EXISTS public.pfleger_invoice_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE RESTRICT,
  invoice_foundation_id uuid NOT NULL UNIQUE REFERENCES public.pfleger_invoice_foundations(id) ON DELETE RESTRICT,
  invoice_number text NOT NULL,
  recipient_name text NOT NULL,
  recipient_key text NOT NULL,
  recipient_ik text NOT NULL DEFAULT '',
  payment_term_days integer NOT NULL CHECK (payment_term_days BETWEEN 1 AND 365),
  issued_at timestamptz NOT NULL,
  due_date date NOT NULL,
  total_amount_cents bigint NOT NULL CHECK (total_amount_cents BETWEEN 0 AND 999999999999),
  position_count integer NOT NULL CHECK (position_count > 0),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','approved','cancelled')),
  source_snapshot jsonb NOT NULL,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_by_name text NOT NULL,
  created_at timestamptz NOT NULL,
  client_request_id uuid NOT NULL,
  request_fingerprint text NOT NULL CHECK (request_fingerprint ~ '^[0-9a-f]{32}$'),
  UNIQUE (tenant_id, invoice_number),
  UNIQUE (tenant_id, client_request_id)
);

CREATE TABLE IF NOT EXISTS public.pfleger_invoice_draft_positions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  invoice_draft_id uuid NOT NULL REFERENCES public.pfleger_invoice_drafts(id) ON DELETE RESTRICT,
  position_no integer NOT NULL CHECK (position_no > 0),
  billing_case_id uuid NOT NULL REFERENCES public.pfleger_billing_cases(id) ON DELETE RESTRICT,
  service_proof_id uuid NOT NULL REFERENCES public.pfleger_service_proofs(id) ON DELETE RESTRICT,
  service_date date NOT NULL,
  service_code text NOT NULL,
  quantity_milli integer NOT NULL CHECK (quantity_milli > 0),
  unit_amount_cents bigint NOT NULL CHECK (unit_amount_cents BETWEEN 0 AND 999999999999),
  amount_cents bigint NOT NULL CHECK (amount_cents BETWEEN 0 AND 999999999999),
  proof_fingerprint text NOT NULL,
  source_snapshot jsonb NOT NULL,
  CHECK ((quantity_milli::bigint * unit_amount_cents) % 1000 = 0),
  CHECK (amount_cents = (quantity_milli::bigint * unit_amount_cents) / 1000),
  UNIQUE (invoice_draft_id, position_no),
  UNIQUE (invoice_draft_id, billing_case_id),
  UNIQUE (invoice_draft_id, service_proof_id)
);

ALTER TABLE public.pfleger_invoice_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pfleger_invoice_draft_positions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.pfleger_invoice_drafts, public.pfleger_invoice_draft_positions FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.pfleger_invoice_drafts, public.pfleger_invoice_draft_positions TO authenticated;

DROP POLICY IF EXISTS pfleger_invoice_drafts_read ON public.pfleger_invoice_drafts;
CREATE POLICY pfleger_invoice_drafts_read ON public.pfleger_invoice_drafts FOR SELECT TO authenticated
  USING (tenant_id=public.current_tenant_id() AND public.has_permission('pflege.billing.view'));
DROP POLICY IF EXISTS pfleger_invoice_draft_positions_read ON public.pfleger_invoice_draft_positions;
CREATE POLICY pfleger_invoice_draft_positions_read ON public.pfleger_invoice_draft_positions FOR SELECT TO authenticated
  USING (tenant_id=public.current_tenant_id() AND public.has_permission('pflege.billing.view'));

CREATE OR REPLACE FUNCTION care_private.protect_pfleger_invoice_draft_history()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  RAISE EXCEPTION 'Rechnungsentwurf und Einzelpositionen sind unveränderliche Historie.' USING ERRCODE='42501';
END $$;
DROP TRIGGER IF EXISTS protect_pfleger_invoice_drafts ON public.pfleger_invoice_drafts;
CREATE TRIGGER protect_pfleger_invoice_drafts BEFORE UPDATE OR DELETE ON public.pfleger_invoice_drafts
  FOR EACH ROW EXECUTE FUNCTION care_private.protect_pfleger_invoice_draft_history();
DROP TRIGGER IF EXISTS protect_pfleger_invoice_draft_positions ON public.pfleger_invoice_draft_positions;
CREATE TRIGGER protect_pfleger_invoice_draft_positions BEFORE UPDATE OR DELETE ON public.pfleger_invoice_draft_positions
  FOR EACH ROW EXECUTE FUNCTION care_private.protect_pfleger_invoice_draft_history();

CREATE OR REPLACE FUNCTION public.create_pfleger_invoice_draft(
  p_invoice_foundation_id uuid, p_payment_term_days integer, p_client_request_id uuid
) RETURNS public.pfleger_invoice_drafts
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  t uuid := public.current_tenant_id(); actor uuid := auth.uid(); actor_name text;
  foundation public.pfleger_invoice_foundations; existing public.pfleger_invoice_drafts; draft public.pfleger_invoice_drafts;
  actual_time timestamptz := clock_timestamp(); calculated_total bigint; calculated_count integer; inserted_count integer;
  fingerprint text;
BEGIN
  IF t IS NULL OR actor IS NULL OR NOT public.has_permission('pflege.invoices.manage') THEN
    RAISE EXCEPTION 'Keine Berechtigung.' USING ERRCODE='42501';
  END IF;
  IF p_invoice_foundation_id IS NULL OR p_client_request_id IS NULL OR p_payment_term_days NOT BETWEEN 1 AND 365 THEN
    RAISE EXCEPTION 'Grundlage, Zahlungsziel und eindeutige Anforderungs-ID sind erforderlich.' USING ERRCODE='23514';
  END IF;
  fingerprint := md5(jsonb_build_object('foundationId',p_invoice_foundation_id,'paymentTermDays',p_payment_term_days)::text);
  SELECT * INTO existing FROM public.pfleger_invoice_drafts WHERE tenant_id=t AND client_request_id=p_client_request_id;
  IF FOUND THEN
    IF existing.invoice_foundation_id IS DISTINCT FROM p_invoice_foundation_id OR existing.request_fingerprint IS DISTINCT FROM fingerprint THEN
      RAISE EXCEPTION 'Diese Anforderungs-ID wurde bereits mit anderen Rechnungsdaten verwendet.' USING ERRCODE='40001';
    END IF;
    RETURN existing;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(t::text), hashtext(p_invoice_foundation_id::text));
  SELECT * INTO foundation FROM public.pfleger_invoice_foundations
    WHERE id=p_invoice_foundation_id AND tenant_id=t FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Rechnungsgrundlage nicht gefunden.' USING ERRCODE='42501'; END IF;
  IF foundation.status<>'validated' OR foundation.recipient_key IS NULL OR foundation.selection_snapshot IS NULL THEN
    RAISE EXCEPTION 'Nur eine vollständig gebundene validierte Rechnungsgrundlage darf einen Entwurf erzeugen.' USING ERRCODE='23514';
  END IF;
  IF EXISTS (SELECT 1 FROM public.pfleger_invoice_drafts WHERE tenant_id=t AND invoice_foundation_id=foundation.id) THEN
    RAISE EXCEPTION 'Für diese Rechnungsgrundlage besteht bereits ein Rechnungsentwurf.' USING ERRCODE='40001';
  END IF;

  SELECT count(*), sum((item->>'amountCents')::bigint) INTO calculated_count, calculated_total
  FROM jsonb_array_elements(foundation.selection_snapshot) item
  WHERE btrim(COALESCE(item->>'billingCaseId',''))<>'' AND btrim(COALESCE(item->>'serviceProofId',''))<>''
    AND btrim(COALESCE(item->>'serviceCode',''))<>'' AND btrim(COALESCE(item->>'proofFingerprint',''))<>''
    AND (item->>'amountCents')::bigint BETWEEN 0 AND 999999999999;
  IF calculated_count IS DISTINCT FROM foundation.proof_count OR calculated_total IS DISTINCT FROM foundation.total_amount_cents THEN
    RAISE EXCEPTION 'Grundlagensumme stimmt nicht mit den nachvollziehbaren Einzelpositionen überein.' USING ERRCODE='23514';
  END IF;
  actor_name := public.clinical_actor_name();
  INSERT INTO public.pfleger_invoice_drafts(
    tenant_id,client_id,invoice_foundation_id,invoice_number,recipient_name,recipient_key,recipient_ik,
    payment_term_days,issued_at,due_date,total_amount_cents,position_count,status,source_snapshot,
    created_by,created_by_name,created_at,client_request_id,request_fingerprint
  ) VALUES (
    t,foundation.client_id,foundation.id,'RE-'||to_char(actual_time AT TIME ZONE 'UTC','YYYYMMDDHH24MISSUS'),
    foundation.recipient_name,foundation.recipient_key,foundation.recipient_ik,p_payment_term_days,actual_time,
    (actual_time AT TIME ZONE 'UTC')::date+p_payment_term_days,calculated_total,calculated_count,'draft',
    jsonb_build_object('foundationId',foundation.id,'foundationNumber',foundation.foundation_number,
      'recipientKey',foundation.recipient_key,'selectionSnapshot',foundation.selection_snapshot,
      'createdAt',to_char(actual_time AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"')),
    actor,actor_name,actual_time,p_client_request_id,fingerprint
  ) RETURNING * INTO draft;

  INSERT INTO public.pfleger_invoice_draft_positions(
    tenant_id,invoice_draft_id,position_no,billing_case_id,service_proof_id,service_date,service_code,
    quantity_milli,unit_amount_cents,amount_cents,proof_fingerprint,source_snapshot
  ) SELECT t,draft.id,ordinality,(item->>'billingCaseId')::uuid,(item->>'serviceProofId')::uuid,
      (item->>'serviceDate')::date,item->>'serviceCode',1000,(item->>'amountCents')::bigint,
      (item->>'amountCents')::bigint,item->>'proofFingerprint',item
    FROM jsonb_array_elements(foundation.selection_snapshot) WITH ORDINALITY selected(item,ordinality);
  GET DIAGNOSTICS inserted_count = ROW_COUNT;
  IF inserted_count<>calculated_count OR
    (SELECT sum(amount_cents) FROM public.pfleger_invoice_draft_positions WHERE invoice_draft_id=draft.id)<>draft.total_amount_cents THEN
    RAISE EXCEPTION 'Positionsübernahme ist unvollständig oder rechnerisch widersprüchlich.' USING ERRCODE='40001';
  END IF;
  INSERT INTO public.care_audit_events(tenant_id,client_id,entity_type,entity_id,action,summary,after_data,actor_id,actor_name)
    VALUES(t,foundation.client_id,'pflege_invoice_draft',draft.id,'created','Rechnungsentwurf aus gebundener Grundlage erstellt; nicht freigegeben oder versendet.',to_jsonb(draft),actor,actor_name);
  RETURN draft;
END $$;

REVOKE ALL ON FUNCTION public.create_pfleger_invoice_draft(uuid,integer,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_pfleger_invoice_draft(uuid,integer,uuid) TO authenticated;
COMMENT ON FUNCTION public.create_pfleger_invoice_draft(uuid,integer,uuid) IS
  'Erzeugt einen unveränderlichen, nachrechenbaren Entwurf aus genau einer validierten Grundlage. Keine Freigabe, Übertragung oder Versendung.';
