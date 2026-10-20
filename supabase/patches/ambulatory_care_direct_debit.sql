-- Checkpoint 242 / U-10: SEPA-Mandat, Einzugsvorbereitung, Dateifreigabe und Rücklastschrift getrennt.
-- Lokaler additiver Entwurf; nicht gegen eine produktive Datenbank ausführen.

CREATE TABLE IF NOT EXISTS public.pfleger_sepa_mandate_versions (
  id uuid PRIMARY KEY,
  mandate_id uuid NOT NULL,
  revision integer NOT NULL CHECK (revision >= 1),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE RESTRICT,
  mandate_reference text NOT NULL CHECK (btrim(mandate_reference) <> ''),
  creditor_identifier text NOT NULL CHECK (btrim(creditor_identifier) <> ''),
  debtor_account_fingerprint text NOT NULL CHECK (debtor_account_fingerprint ~ '^[0-9a-f]{32}$'),
  authorization_evidence_id uuid NOT NULL,
  authorization_fingerprint text NOT NULL CHECK (authorization_fingerprint ~ '^[0-9a-f]{32}$'),
  signed_at timestamptz NOT NULL,
  valid_from date NOT NULL,
  valid_until date,
  revoked_at timestamptz,
  recorded_at timestamptz NOT NULL,
  recorded_by uuid NOT NULL REFERENCES auth.users(id),
  recorded_by_name text NOT NULL,
  CHECK (valid_until IS NULL OR valid_until >= valid_from),
  CHECK (recorded_at >= signed_at),
  UNIQUE (tenant_id, mandate_id, revision),
  UNIQUE (tenant_id, mandate_reference, revision)
);

CREATE TABLE IF NOT EXISTS public.pfleger_direct_debit_orders (
  id uuid PRIMARY KEY,
  client_request_id uuid NOT NULL,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE RESTRICT,
  open_item_id uuid NOT NULL REFERENCES public.pfleger_receivable_open_items(id) ON DELETE RESTRICT,
  invoice_approval_id uuid NOT NULL REFERENCES public.pfleger_invoice_approvals(id) ON DELETE RESTRICT,
  receivable_lineage_id uuid NOT NULL,
  document_fingerprint text NOT NULL CHECK (document_fingerprint ~ '^[0-9a-f]{32}$'),
  invoice_number text NOT NULL CHECK (btrim(invoice_number) <> ''),
  mandate_version_id uuid NOT NULL REFERENCES public.pfleger_sepa_mandate_versions(id) ON DELETE RESTRICT,
  mandate_id uuid NOT NULL,
  mandate_reference text NOT NULL CHECK (btrim(mandate_reference) <> ''),
  amount_cents bigint NOT NULL CHECK (amount_cents BETWEEN 1 AND 999999999999),
  collection_date date NOT NULL,
  prepared_at timestamptz NOT NULL,
  prepared_by uuid NOT NULL REFERENCES auth.users(id),
  prepared_by_name text NOT NULL,
  order_state text NOT NULL DEFAULT 'prepared' CHECK (order_state = 'prepared'),
  file_release_state text NOT NULL DEFAULT 'not_inferred' CHECK (file_release_state = 'not_inferred'),
  payment_state text NOT NULL DEFAULT 'not_inferred' CHECK (payment_state = 'not_inferred'),
  request_fingerprint text NOT NULL CHECK (request_fingerprint ~ '^[0-9a-f]{32}$'),
  UNIQUE (tenant_id, client_request_id),
  UNIQUE (tenant_id, open_item_id, mandate_version_id, collection_date)
);

CREATE TABLE IF NOT EXISTS public.pfleger_direct_debit_releases (
  id uuid PRIMARY KEY,
  client_request_id uuid NOT NULL,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE RESTRICT,
  direct_debit_order_id uuid NOT NULL REFERENCES public.pfleger_direct_debit_orders(id) ON DELETE RESTRICT,
  mandate_version_id uuid NOT NULL REFERENCES public.pfleger_sepa_mandate_versions(id) ON DELETE RESTRICT,
  mandate_revision integer NOT NULL CHECK (mandate_revision >= 1),
  mandate_read_at timestamptz NOT NULL,
  amount_cents bigint NOT NULL CHECK (amount_cents BETWEEN 1 AND 999999999999),
  collection_date date NOT NULL,
  export_batch_id uuid NOT NULL,
  export_file_name text NOT NULL CHECK (btrim(export_file_name) <> ''),
  export_file_fingerprint text NOT NULL CHECK (export_file_fingerprint ~ '^[0-9a-f]{32}$'),
  released_at timestamptz NOT NULL,
  released_by uuid NOT NULL REFERENCES auth.users(id),
  released_by_name text NOT NULL,
  request_fingerprint text NOT NULL CHECK (request_fingerprint ~ '^[0-9a-f]{32}$'),
  CHECK (released_at > mandate_read_at),
  UNIQUE (tenant_id, client_request_id),
  UNIQUE (tenant_id, direct_debit_order_id),
  UNIQUE (tenant_id, export_batch_id, export_file_name)
);

CREATE TABLE IF NOT EXISTS public.pfleger_direct_debit_returns (
  id uuid PRIMARY KEY,
  client_request_id uuid NOT NULL,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE RESTRICT,
  direct_debit_release_id uuid NOT NULL REFERENCES public.pfleger_direct_debit_releases(id) ON DELETE RESTRICT,
  bank_transaction_reference text NOT NULL CHECK (btrim(bank_transaction_reference) <> ''),
  return_code_system text NOT NULL CHECK (btrim(return_code_system) <> ''),
  return_code text NOT NULL CHECK (btrim(return_code) <> ''),
  returned_amount_cents bigint NOT NULL CHECK (returned_amount_cents BETWEEN 1 AND 999999999999),
  value_date date NOT NULL,
  received_at timestamptz NOT NULL,
  payment_state text NOT NULL DEFAULT 'not_inferred' CHECK (payment_state = 'not_inferred'),
  recorded_by uuid NOT NULL REFERENCES auth.users(id),
  recorded_by_name text NOT NULL,
  request_fingerprint text NOT NULL CHECK (request_fingerprint ~ '^[0-9a-f]{32}$'),
  UNIQUE (tenant_id, client_request_id),
  UNIQUE (tenant_id, direct_debit_release_id),
  UNIQUE (tenant_id, bank_transaction_reference)
);

ALTER TABLE public.pfleger_sepa_mandate_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pfleger_direct_debit_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pfleger_direct_debit_releases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pfleger_direct_debit_returns ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.pfleger_sepa_mandate_versions, public.pfleger_direct_debit_orders, public.pfleger_direct_debit_releases, public.pfleger_direct_debit_returns FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.pfleger_sepa_mandate_versions, public.pfleger_direct_debit_orders, public.pfleger_direct_debit_releases, public.pfleger_direct_debit_returns TO authenticated;

DO $$ DECLARE table_name text; BEGIN
  FOREACH table_name IN ARRAY ARRAY['pfleger_sepa_mandate_versions','pfleger_direct_debit_orders','pfleger_direct_debit_releases','pfleger_direct_debit_returns'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I',table_name||'_read',table_name);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (tenant_id = public.current_tenant_id() AND public.has_permission(''pflege.billing.view''))',table_name||'_read',table_name);
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION care_private.protect_pfleger_direct_debit_history()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN
  RAISE EXCEPTION 'Mandats-, Einzugs-, Freigabe- und Rücklastschrifthistorien bleiben unverändert.' USING ERRCODE='42501';
END $$;
DO $$ DECLARE table_name text; BEGIN
  FOREACH table_name IN ARRAY ARRAY['pfleger_sepa_mandate_versions','pfleger_direct_debit_orders','pfleger_direct_debit_releases','pfleger_direct_debit_returns'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS protect_%I ON public.%I',table_name,table_name);
    EXECUTE format('CREATE TRIGGER protect_%I BEFORE UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION care_private.protect_pfleger_direct_debit_history()',table_name,table_name);
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.record_pfleger_direct_debit_release(p_payload jsonb,p_client_request_id uuid)
RETURNS public.pfleger_direct_debit_releases LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  t uuid:=public.current_tenant_id();actor uuid:=auth.uid();actor_name text;prior public.pfleger_direct_debit_releases;
  result public.pfleger_direct_debit_releases;ord public.pfleger_direct_debit_orders;mandate public.pfleger_sepa_mandate_versions;
  latest public.pfleger_sepa_mandate_versions;item public.pfleger_receivable_open_items;paid bigint;remaining bigint;
  mandate_read_at timestamptz;released_at timestamptz;request_fingerprint text;
BEGIN
  IF t IS NULL OR actor IS NULL OR NOT public.has_permission('pflege.invoices.manage') THEN RAISE EXCEPTION 'Keine Berechtigung.' USING ERRCODE='42501';END IF;
  IF p_payload IS NULL OR p_client_request_id IS NULL OR COALESCE(p_payload->>'exportFileName','')='' OR COALESCE(p_payload->>'exportFileFingerprint','')!~'^[0-9a-f]{32}$' THEN RAISE EXCEPTION 'Dateifreigabe ist unvollständig.' USING ERRCODE='23514';END IF;
  request_fingerprint:=md5(jsonb_build_object('payload',p_payload,'requestId',p_client_request_id)::text);
  PERFORM pg_advisory_xact_lock(hashtext(t::text),hashtext(p_client_request_id::text));
  SELECT * INTO prior FROM public.pfleger_direct_debit_releases WHERE tenant_id=t AND client_request_id=p_client_request_id;
  IF FOUND THEN IF prior.request_fingerprint IS DISTINCT FROM request_fingerprint THEN RAISE EXCEPTION 'Anforderungs-ID wurde anders verwendet.' USING ERRCODE='40001';END IF;RETURN prior;END IF;
  PERFORM pg_advisory_xact_lock(hashtext(t::text),hashtext((p_payload->>'directDebitOrderId')::text));
  SELECT * INTO ord FROM public.pfleger_direct_debit_orders WHERE tenant_id=t AND id=(p_payload->>'directDebitOrderId')::uuid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Einzugsauftrag fehlt.' USING ERRCODE='23514';END IF;
  SELECT * INTO mandate FROM public.pfleger_sepa_mandate_versions WHERE tenant_id=t AND id=ord.mandate_version_id FOR SHARE;
  SELECT * INTO latest FROM public.pfleger_sepa_mandate_versions WHERE tenant_id=t AND mandate_id=ord.mandate_id ORDER BY revision DESC,recorded_at DESC LIMIT 1 FOR SHARE;
  mandate_read_at:=clock_timestamp();
  IF mandate.id IS NULL OR latest.id IS DISTINCT FROM mandate.id OR mandate.client_id IS DISTINCT FROM ord.client_id OR mandate.mandate_reference IS DISTINCT FROM ord.mandate_reference OR ord.collection_date<mandate.valid_from OR (mandate.valid_until IS NOT NULL AND ord.collection_date>mandate.valid_until) OR (mandate.revoked_at IS NOT NULL AND mandate.revoked_at<=mandate_read_at) THEN RAISE EXCEPTION 'Keine aktuell gültige Mandatsgrundlage für die Dateifreigabe.' USING ERRCODE='23514';END IF;
  SELECT * INTO item FROM public.pfleger_receivable_open_items WHERE tenant_id=t AND id=ord.open_item_id FOR SHARE;
  IF item.id IS NULL OR item.client_id IS DISTINCT FROM ord.client_id OR item.invoice_approval_id IS DISTINCT FROM ord.invoice_approval_id OR item.receivable_lineage_id IS DISTINCT FROM ord.receivable_lineage_id OR item.document_fingerprint IS DISTINCT FROM ord.document_fingerprint OR item.invoice_number IS DISTINCT FROM ord.invoice_number THEN RAISE EXCEPTION 'Einzugsauftrag ist nicht mehr exakt an den offenen Posten gebunden.' USING ERRCODE='40001';END IF;
  SELECT COALESCE(sum(a.amount_cents) FILTER(WHERE NOT EXISTS(SELECT 1 FROM public.pfleger_receivable_payment_events r WHERE r.tenant_id=t AND r.event_kind='payment_reversal' AND r.reverses_payment_event_id=e.id)),0) INTO paid
  FROM public.pfleger_receivable_payment_allocations a JOIN public.pfleger_receivable_payment_events e ON e.tenant_id=t AND e.id=a.payment_event_id AND e.event_kind='payment_received' WHERE a.tenant_id=t AND a.open_item_id=item.id;
  remaining:=item.receivable_amount_cents-paid;
  IF remaining<=0 OR remaining IS DISTINCT FROM ord.amount_cents THEN RAISE EXCEPTION 'Zwischenzeitliche Zahlung verhindert die Dateifreigabe.' USING ERRCODE='40001';END IF;
  released_at:=clock_timestamp();actor_name:=public.clinical_actor_name();
  INSERT INTO public.pfleger_direct_debit_releases(id,client_request_id,tenant_id,client_id,direct_debit_order_id,mandate_version_id,mandate_revision,mandate_read_at,amount_cents,collection_date,export_batch_id,export_file_name,export_file_fingerprint,released_at,released_by,released_by_name,request_fingerprint)
  VALUES((p_payload->>'directDebitReleaseId')::uuid,p_client_request_id,t,ord.client_id,ord.id,mandate.id,mandate.revision,mandate_read_at,ord.amount_cents,ord.collection_date,(p_payload->>'exportBatchId')::uuid,p_payload->>'exportFileName',p_payload->>'exportFileFingerprint',released_at,actor,actor_name,request_fingerprint) RETURNING * INTO result;
  INSERT INTO public.care_audit_events(tenant_id,client_id,entity_type,entity_id,action,summary,after_data,actor_id,actor_name)VALUES(t,ord.client_id,'pflege_direct_debit_release',result.id,'direct_debit_file_released','Einzugsdatei nach Mandats- und Zahlungsneulesung freigegeben; Zahlung nicht abgeleitet.',to_jsonb(result),actor,actor_name);
  RETURN result;
END $$;

CREATE OR REPLACE FUNCTION public.record_pfleger_direct_debit_return(p_payload jsonb,p_client_request_id uuid)
RETURNS public.pfleger_direct_debit_returns LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE t uuid:=public.current_tenant_id();actor uuid:=auth.uid();actor_name text;release_row public.pfleger_direct_debit_releases;prior public.pfleger_direct_debit_returns;result public.pfleger_direct_debit_returns;request_fingerprint text;BEGIN
  IF t IS NULL OR actor IS NULL OR NOT public.has_permission('pflege.invoices.manage') THEN RAISE EXCEPTION 'Keine Berechtigung.' USING ERRCODE='42501';END IF;
  IF p_payload IS NULL OR p_client_request_id IS NULL OR COALESCE(p_payload->>'bankTransactionReference','')='' OR COALESCE(p_payload->>'returnCodeSystem','')='' OR COALESCE(p_payload->>'returnCode','')='' THEN RAISE EXCEPTION 'Rücklastschrift ist unvollständig.' USING ERRCODE='23514';END IF;
  request_fingerprint:=md5(jsonb_build_object('payload',p_payload,'requestId',p_client_request_id)::text);PERFORM pg_advisory_xact_lock(hashtext(t::text),hashtext(p_client_request_id::text));
  SELECT * INTO prior FROM public.pfleger_direct_debit_returns WHERE tenant_id=t AND client_request_id=p_client_request_id;IF FOUND THEN IF prior.request_fingerprint IS DISTINCT FROM request_fingerprint THEN RAISE EXCEPTION 'Anforderungs-ID wurde anders verwendet.' USING ERRCODE='40001';END IF;RETURN prior;END IF;
  SELECT * INTO release_row FROM public.pfleger_direct_debit_releases WHERE tenant_id=t AND id=(p_payload->>'directDebitReleaseId')::uuid FOR UPDATE;IF NOT FOUND OR (p_payload->>'returnedAmountCents')::bigint IS DISTINCT FROM release_row.amount_cents OR (p_payload->>'receivedAt')::timestamptz<=release_row.released_at THEN RAISE EXCEPTION 'Rücklastschrift ist nicht exakt an die Dateifreigabe gebunden.' USING ERRCODE='23514';END IF;
  actor_name:=public.clinical_actor_name();INSERT INTO public.pfleger_direct_debit_returns(id,client_request_id,tenant_id,client_id,direct_debit_release_id,bank_transaction_reference,return_code_system,return_code,returned_amount_cents,value_date,received_at,payment_state,recorded_by,recorded_by_name,request_fingerprint)
  VALUES((p_payload->>'directDebitReturnId')::uuid,p_client_request_id,t,release_row.client_id,release_row.id,p_payload->>'bankTransactionReference',p_payload->>'returnCodeSystem',p_payload->>'returnCode',release_row.amount_cents,(p_payload->>'valueDate')::date,(p_payload->>'receivedAt')::timestamptz,'not_inferred',actor,actor_name,request_fingerprint) RETURNING * INTO result;
  INSERT INTO public.care_audit_events(tenant_id,client_id,entity_type,entity_id,action,summary,after_data,actor_id,actor_name)VALUES(t,release_row.client_id,'pflege_direct_debit_return',result.id,'direct_debit_return_recorded','Rücklastschrift separat dokumentiert; kein Zahlungsstatus abgeleitet.',to_jsonb(result),actor,actor_name);RETURN result;
END $$;

REVOKE ALL ON FUNCTION public.record_pfleger_direct_debit_release(jsonb,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.record_pfleger_direct_debit_release(jsonb,uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.record_pfleger_direct_debit_return(jsonb,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.record_pfleger_direct_debit_return(jsonb,uuid) TO authenticated;
