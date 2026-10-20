-- Checkpoint 240 / U-08: append-only Buchhaltung und Controlling aus tatsächlich gültigen Quellbelegen.
-- Export, Rückabgleich, Zahlung und Periodenabschluss bleiben getrennte Tatsachen.

CREATE TABLE IF NOT EXISTS public.pfleger_accounting_source_documents (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE RESTRICT,
  claim_lineage_id uuid NOT NULL,
  source_kind text NOT NULL CHECK (source_kind IN ('approved_invoice','approved_credit_note','payment_received','payment_reversal')),
  source_id uuid NOT NULL,
  invoice_approval_id uuid NOT NULL REFERENCES public.pfleger_invoice_approvals(id) ON DELETE RESTRICT,
  document_number text NOT NULL CHECK (btrim(document_number) <> ''),
  source_fingerprint text NOT NULL CHECK (source_fingerprint ~ '^[0-9a-f]{32}$'),
  effective_date date NOT NULL,
  recorded_at timestamptz NOT NULL,
  amount_cents bigint NOT NULL CHECK (amount_cents BETWEEN 1 AND 999999999999),
  receivable_effect text NOT NULL CHECK (receivable_effect IN ('increase','decrease')),
  source_state text NOT NULL DEFAULT 'valid' CHECK (source_state = 'valid'),
  source_snapshot jsonb NOT NULL,
  prepared_by uuid NOT NULL REFERENCES auth.users(id), prepared_by_name text NOT NULL, prepared_at timestamptz NOT NULL,
  CHECK ((source_kind IN ('approved_invoice','payment_reversal')) = (receivable_effect = 'increase')),
  UNIQUE (tenant_id, source_kind, source_id), UNIQUE (tenant_id, document_number)
);

CREATE TABLE IF NOT EXISTS public.pfleger_accounting_postings (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE RESTRICT,
  claim_lineage_id uuid NOT NULL,
  accounting_document_id uuid NOT NULL REFERENCES public.pfleger_accounting_source_documents(id) ON DELETE RESTRICT,
  source_id uuid NOT NULL, source_fingerprint text NOT NULL CHECK (source_fingerprint ~ '^[0-9a-f]{32}$'),
  journal_number text NOT NULL CHECK (btrim(journal_number) <> ''), posting_date date NOT NULL,
  accounting_period text NOT NULL CHECK (accounting_period ~ '^\d{4}-\d{2}$'),
  debit_account text NOT NULL CHECK (debit_account ~ '^[A-Za-z0-9][A-Za-z0-9._/-]{1,31}$'),
  credit_account text NOT NULL CHECK (credit_account ~ '^[A-Za-z0-9][A-Za-z0-9._/-]{1,31}$'),
  amount_cents bigint NOT NULL CHECK (amount_cents BETWEEN 1 AND 999999999999), recorded_at timestamptz NOT NULL,
  export_batch_id text, external_journal_reference text,
  reconciliation_state text NOT NULL DEFAULT 'not_reconciled' CHECK (reconciliation_state IN ('not_reconciled','matched','mismatch')),
  reconciliation_reference text, reconciled_at timestamptz,
  recorded_by uuid NOT NULL REFERENCES auth.users(id), recorded_by_name text NOT NULL,
  client_request_id uuid NOT NULL, request_fingerprint text NOT NULL CHECK (request_fingerprint ~ '^[0-9a-f]{32}$'),
  CHECK (debit_account <> credit_account), CHECK (accounting_period = to_char(posting_date,'YYYY-MM')),
  CHECK ((export_batch_id IS NULL) = (external_journal_reference IS NULL)),
  CHECK ((reconciliation_state = 'not_reconciled') = (reconciliation_reference IS NULL AND reconciled_at IS NULL)),
  UNIQUE (tenant_id, accounting_document_id), UNIQUE (tenant_id, journal_number), UNIQUE (tenant_id, client_request_id)
);

ALTER TABLE public.pfleger_accounting_source_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pfleger_accounting_postings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.pfleger_accounting_source_documents, public.pfleger_accounting_postings FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.pfleger_accounting_source_documents, public.pfleger_accounting_postings TO authenticated;
DROP POLICY IF EXISTS pfleger_accounting_source_documents_read ON public.pfleger_accounting_source_documents;
CREATE POLICY pfleger_accounting_source_documents_read ON public.pfleger_accounting_source_documents FOR SELECT TO authenticated USING (tenant_id=public.current_tenant_id() AND public.has_permission('pflege.billing.view'));
DROP POLICY IF EXISTS pfleger_accounting_postings_read ON public.pfleger_accounting_postings;
CREATE POLICY pfleger_accounting_postings_read ON public.pfleger_accounting_postings FOR SELECT TO authenticated USING (tenant_id=public.current_tenant_id() AND public.has_permission('pflege.billing.view'));

CREATE OR REPLACE FUNCTION care_private.protect_pfleger_accounting_history() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN RAISE EXCEPTION 'Buchhaltungsbelege und Journalbuchungen bleiben unverändert.' USING ERRCODE='42501'; END $$;
DROP TRIGGER IF EXISTS protect_pfleger_accounting_source_documents ON public.pfleger_accounting_source_documents;
CREATE TRIGGER protect_pfleger_accounting_source_documents BEFORE UPDATE OR DELETE ON public.pfleger_accounting_source_documents FOR EACH ROW EXECUTE FUNCTION care_private.protect_pfleger_accounting_history();
DROP TRIGGER IF EXISTS protect_pfleger_accounting_postings ON public.pfleger_accounting_postings;
CREATE TRIGGER protect_pfleger_accounting_postings BEFORE UPDATE OR DELETE ON public.pfleger_accounting_postings FOR EACH ROW EXECUTE FUNCTION care_private.protect_pfleger_accounting_history();

CREATE OR REPLACE FUNCTION public.record_pfleger_accounting_posting(p_payload jsonb,p_client_request_id uuid)
RETURNS public.pfleger_accounting_postings LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE t uuid:=public.current_tenant_id();actor uuid:=auth.uid();actor_name text;source public.pfleger_accounting_source_documents;prior public.pfleger_accounting_postings;result public.pfleger_accounting_postings;entry_id uuid;recorded_at timestamptz;reconciled_at timestamptz;request_fingerprint text;state text:=COALESCE(p_payload->>'reconciliationState','');actual_time timestamptz:=clock_timestamp();
BEGIN
  IF t IS NULL OR actor IS NULL OR NOT public.has_permission('pflege.invoices.manage') THEN RAISE EXCEPTION 'Keine Berechtigung.' USING ERRCODE='42501'; END IF;
  IF p_payload IS NULL OR p_client_request_id IS NULL OR COALESCE(p_payload->>'recordedAt','') !~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}(Z|\+00:00)$' OR state NOT IN ('not_reconciled','matched','mismatch') OR COALESCE((p_payload->>'amountCents')::bigint,0)<=0 THEN RAISE EXCEPTION 'Kontierung ist unvollständig oder ungültig.' USING ERRCODE='23514'; END IF;
  entry_id:=(p_payload->>'journalEntryId')::uuid;recorded_at:=(p_payload->>'recordedAt')::timestamptz;reconciled_at:=NULLIF(p_payload->>'reconciledAt','')::timestamptz;
  request_fingerprint:=md5(jsonb_build_object('payload',p_payload,'requestId',p_client_request_id)::text);
  PERFORM pg_advisory_xact_lock(hashtext(t::text),hashtext(p_client_request_id::text));
  SELECT * INTO prior FROM public.pfleger_accounting_postings WHERE tenant_id=t AND client_request_id=p_client_request_id;
  IF FOUND THEN IF prior.id IS DISTINCT FROM entry_id OR prior.request_fingerprint IS DISTINCT FROM request_fingerprint THEN RAISE EXCEPTION 'Anforderungs-ID wurde mit anderer Kontierung verwendet.' USING ERRCODE='40001'; END IF;RETURN prior;END IF;
  PERFORM pg_advisory_xact_lock(hashtext(t::text),hashtext((p_payload->>'accountingDocumentId')::text));
  SELECT * INTO source FROM public.pfleger_accounting_source_documents WHERE tenant_id=t AND id=(p_payload->>'accountingDocumentId')::uuid AND source_state='valid' FOR SHARE;
  IF NOT FOUND OR source.client_id::text IS DISTINCT FROM p_payload->>'clientId' OR source.claim_lineage_id::text IS DISTINCT FROM p_payload->>'claimLineageId' OR source.source_id::text IS DISTINCT FROM p_payload->>'sourceId' OR source.source_fingerprint IS DISTINCT FROM p_payload->>'sourceFingerprint' OR source.amount_cents IS DISTINCT FROM (p_payload->>'amountCents')::bigint THEN RAISE EXCEPTION 'Kontierung ist nicht exakt an den gültigen Quellbeleg gebunden.' USING ERRCODE='23514';END IF;
  IF (p_payload->>'postingDate')::date<source.effective_date OR recorded_at<=source.recorded_at OR p_payload->>'accountingPeriod' IS DISTINCT FROM to_char((p_payload->>'postingDate')::date,'YYYY-MM') OR p_payload->>'debitAccount' IS NOT DISTINCT FROM p_payload->>'creditAccount' THEN RAISE EXCEPTION 'Zeitbezug oder Konten der Buchung sind ungültig.' USING ERRCODE='23514';END IF;
  IF ((p_payload->>'exportBatchId') IS NULL)<>( (p_payload->>'externalJournalReference') IS NULL) OR (state='not_reconciled')<>( (p_payload->>'reconciliationReference') IS NULL AND reconciled_at IS NULL) OR (reconciled_at IS NOT NULL AND reconciled_at<=recorded_at) THEN RAISE EXCEPTION 'Export oder Rückabgleich ist widersprüchlich.' USING ERRCODE='23514';END IF;
  actor_name:=public.clinical_actor_name();
  INSERT INTO public.pfleger_accounting_postings(id,tenant_id,client_id,claim_lineage_id,accounting_document_id,source_id,source_fingerprint,journal_number,posting_date,accounting_period,debit_account,credit_account,amount_cents,recorded_at,export_batch_id,external_journal_reference,reconciliation_state,reconciliation_reference,reconciled_at,recorded_by,recorded_by_name,client_request_id,request_fingerprint)
  VALUES(entry_id,t,source.client_id,source.claim_lineage_id,source.id,source.source_id,source.source_fingerprint,btrim(p_payload->>'journalNumber'),(p_payload->>'postingDate')::date,p_payload->>'accountingPeriod',p_payload->>'debitAccount',p_payload->>'creditAccount',source.amount_cents,recorded_at,NULLIF(p_payload->>'exportBatchId',''),NULLIF(p_payload->>'externalJournalReference',''),state,NULLIF(p_payload->>'reconciliationReference',''),reconciled_at,actor,actor_name,p_client_request_id,request_fingerprint) RETURNING * INTO result;
  INSERT INTO public.care_audit_events(tenant_id,client_id,entity_type,entity_id,action,summary,after_data,actor_id,actor_name) VALUES(t,source.client_id,'pflege_accounting_posting',result.id,'accounting_posted','Kontierung append-only an gültigen Quellbeleg gebunden; Export, Rückabgleich und Periodenabschluss nicht abgeleitet.',to_jsonb(result),actor,actor_name);
  RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.record_pfleger_accounting_posting(jsonb,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.record_pfleger_accounting_posting(jsonb,uuid) TO authenticated;
