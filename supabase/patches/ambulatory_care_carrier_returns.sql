-- Checkpoint 237 / U-05: append-only Rückläufer, Korrektur und erneute Übermittlung derselben Forderung.
-- Ein Rückläufer belegt keine Annahme oder Zahlung. Eine erneute Übermittlung ersetzt exakt den
-- abgewiesenen Versuch innerhalb derselben Forderungshistorie und erzeugt keine zweite Forderung.

CREATE TABLE IF NOT EXISTS public.pfleger_cost_carrier_transmission_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE RESTRICT,
  claim_lineage_id uuid NOT NULL,
  attempt_number integer NOT NULL CHECK (attempt_number > 0),
  replacement_for_attempt_id uuid REFERENCES public.pfleger_cost_carrier_transmission_attempts(id) ON DELETE RESTRICT,
  export_id uuid NOT NULL REFERENCES public.pfleger_cost_carrier_exports(id) ON DELETE RESTRICT,
  invoice_approval_id uuid NOT NULL REFERENCES public.pfleger_invoice_approvals(id) ON DELETE RESTRICT,
  invoice_draft_id uuid NOT NULL REFERENCES public.pfleger_invoice_drafts(id) ON DELETE RESTRICT,
  invoice_number text NOT NULL CHECK (btrim(invoice_number) <> ''),
  position_snapshot jsonb NOT NULL CHECK (jsonb_typeof(position_snapshot) = 'array' AND jsonb_array_length(position_snapshot) > 0),
  total_amount_cents bigint NOT NULL CHECK (total_amount_cents BETWEEN 0 AND 999999999999),
  payload_sha256 text NOT NULL CHECK (payload_sha256 ~ '^[0-9a-f]{64}$'),
  order_file_sha256 text NOT NULL CHECK (order_file_sha256 ~ '^[0-9a-f]{64}$'),
  transport_message_id text NOT NULL CHECK (btrim(transport_message_id) <> ''),
  sender_ik text NOT NULL CHECK (sender_ik ~ '^\d{9}$'),
  receiver_ik text NOT NULL CHECK (receiver_ik ~ '^\d{9}$'),
  transmitted_at timestamptz NOT NULL,
  transmission_state text NOT NULL CHECK (transmission_state IN ('submitted','replacement_submitted_not_accepted')),
  acceptance_status text NOT NULL DEFAULT 'not_inferred' CHECK (acceptance_status = 'not_inferred'),
  payment_status text NOT NULL DEFAULT 'not_inferred' CHECK (payment_status = 'not_inferred'),
  transport_evidence jsonb NOT NULL,
  recorded_by uuid NOT NULL REFERENCES auth.users(id),
  recorded_by_name text NOT NULL,
  recorded_at timestamptz NOT NULL,
  CHECK (payload_sha256 <> order_file_sha256),
  CHECK ((attempt_number = 1 AND replacement_for_attempt_id IS NULL) OR (attempt_number > 1 AND replacement_for_attempt_id IS NOT NULL)),
  UNIQUE (tenant_id, claim_lineage_id, attempt_number),
  UNIQUE (tenant_id, transport_message_id),
  UNIQUE (tenant_id, replacement_for_attempt_id),
  UNIQUE (tenant_id, export_id)
);

CREATE TABLE IF NOT EXISTS public.pfleger_cost_carrier_returns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE RESTRICT,
  claim_lineage_id uuid NOT NULL,
  transmission_attempt_id uuid NOT NULL REFERENCES public.pfleger_cost_carrier_transmission_attempts(id) ON DELETE RESTRICT,
  invoice_number text NOT NULL CHECK (btrim(invoice_number) <> ''),
  return_file_name text NOT NULL CHECK (btrim(return_file_name) <> ''),
  return_file_sha256 text NOT NULL CHECK (return_file_sha256 ~ '^[0-9a-f]{64}$'),
  return_file_size_bytes bigint NOT NULL CHECK (return_file_size_bytes > 0),
  received_at timestamptz NOT NULL,
  sender_ik text NOT NULL CHECK (sender_ik ~ '^\d{9}$'),
  receiver_ik text NOT NULL CHECK (receiver_ik ~ '^\d{9}$'),
  referenced_transport_message_id text NOT NULL CHECK (btrim(referenced_transport_message_id) <> ''),
  code_system text NOT NULL CHECK (btrim(code_system) <> ''),
  code_system_version text NOT NULL CHECK (btrim(code_system_version) <> ''),
  errors jsonb NOT NULL CHECK (jsonb_typeof(errors) = 'array' AND jsonb_array_length(errors) > 0),
  return_state text NOT NULL DEFAULT 'rejected_requires_correction' CHECK (return_state = 'rejected_requires_correction'),
  acceptance_status text NOT NULL DEFAULT 'not_accepted' CHECK (acceptance_status = 'not_accepted'),
  payment_status text NOT NULL DEFAULT 'not_inferred' CHECK (payment_status = 'not_inferred'),
  recorded_by uuid NOT NULL REFERENCES auth.users(id),
  recorded_by_name text NOT NULL,
  recorded_at timestamptz NOT NULL,
  client_request_id uuid NOT NULL,
  request_fingerprint text NOT NULL CHECK (request_fingerprint ~ '^[0-9a-f]{32}$'),
  UNIQUE (tenant_id, transmission_attempt_id),
  UNIQUE (tenant_id, client_request_id)
);

CREATE TABLE IF NOT EXISTS public.pfleger_cost_carrier_corrections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE RESTRICT,
  claim_lineage_id uuid NOT NULL,
  return_id uuid NOT NULL REFERENCES public.pfleger_cost_carrier_returns(id) ON DELETE RESTRICT,
  replaced_attempt_id uuid NOT NULL REFERENCES public.pfleger_cost_carrier_transmission_attempts(id) ON DELETE RESTRICT,
  resubmission_attempt_id uuid NOT NULL REFERENCES public.pfleger_cost_carrier_transmission_attempts(id) ON DELETE RESTRICT,
  correction_version integer NOT NULL CHECK (correction_version = 1),
  correction_reason text NOT NULL CHECK (btrim(correction_reason) <> ''),
  corrected_export_id uuid NOT NULL REFERENCES public.pfleger_cost_carrier_exports(id) ON DELETE RESTRICT,
  corrected_invoice_approval_id uuid NOT NULL REFERENCES public.pfleger_invoice_approvals(id) ON DELETE RESTRICT,
  corrected_invoice_draft_id uuid NOT NULL REFERENCES public.pfleger_invoice_drafts(id) ON DELETE RESTRICT,
  corrected_invoice_number text NOT NULL CHECK (btrim(corrected_invoice_number) <> ''),
  corrected_document_fingerprint text NOT NULL CHECK (corrected_document_fingerprint ~ '^[0-9a-f]{32}$'),
  corrected_position_snapshot jsonb NOT NULL CHECK (jsonb_typeof(corrected_position_snapshot) = 'array' AND jsonb_array_length(corrected_position_snapshot) > 0),
  corrected_total_amount_cents bigint NOT NULL CHECK (corrected_total_amount_cents BETWEEN 0 AND 999999999999),
  claim_action text NOT NULL DEFAULT 'replace_rejected_claim' CHECK (claim_action = 'replace_rejected_claim'),
  recorded_by uuid NOT NULL REFERENCES auth.users(id),
  recorded_by_name text NOT NULL,
  recorded_at timestamptz NOT NULL,
  client_request_id uuid NOT NULL,
  request_fingerprint text NOT NULL CHECK (request_fingerprint ~ '^[0-9a-f]{32}$'),
  CHECK (replaced_attempt_id <> resubmission_attempt_id),
  UNIQUE (tenant_id, return_id),
  UNIQUE (tenant_id, resubmission_attempt_id),
  UNIQUE (tenant_id, corrected_export_id),
  UNIQUE (tenant_id, client_request_id)
);

ALTER TABLE public.pfleger_cost_carrier_transmission_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pfleger_cost_carrier_returns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pfleger_cost_carrier_corrections ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.pfleger_cost_carrier_transmission_attempts, public.pfleger_cost_carrier_returns, public.pfleger_cost_carrier_corrections FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.pfleger_cost_carrier_transmission_attempts, public.pfleger_cost_carrier_returns, public.pfleger_cost_carrier_corrections TO authenticated;

DROP POLICY IF EXISTS pfleger_cost_carrier_transmission_attempts_read ON public.pfleger_cost_carrier_transmission_attempts;
CREATE POLICY pfleger_cost_carrier_transmission_attempts_read ON public.pfleger_cost_carrier_transmission_attempts FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id() AND public.has_permission('pflege.billing.view'));
DROP POLICY IF EXISTS pfleger_cost_carrier_returns_read ON public.pfleger_cost_carrier_returns;
CREATE POLICY pfleger_cost_carrier_returns_read ON public.pfleger_cost_carrier_returns FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id() AND public.has_permission('pflege.billing.view'));
DROP POLICY IF EXISTS pfleger_cost_carrier_corrections_read ON public.pfleger_cost_carrier_corrections;
CREATE POLICY pfleger_cost_carrier_corrections_read ON public.pfleger_cost_carrier_corrections FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id() AND public.has_permission('pflege.billing.view'));

CREATE OR REPLACE FUNCTION care_private.protect_pfleger_cost_carrier_return_history()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  RAISE EXCEPTION 'Übermittlungsversuche, Rückläufer und Korrekturen bleiben unverändert.' USING ERRCODE = '42501';
END $$;
DROP TRIGGER IF EXISTS protect_pfleger_cost_carrier_transmission_attempts ON public.pfleger_cost_carrier_transmission_attempts;
CREATE TRIGGER protect_pfleger_cost_carrier_transmission_attempts BEFORE UPDATE OR DELETE ON public.pfleger_cost_carrier_transmission_attempts
  FOR EACH ROW EXECUTE FUNCTION care_private.protect_pfleger_cost_carrier_return_history();
DROP TRIGGER IF EXISTS protect_pfleger_cost_carrier_returns ON public.pfleger_cost_carrier_returns;
CREATE TRIGGER protect_pfleger_cost_carrier_returns BEFORE UPDATE OR DELETE ON public.pfleger_cost_carrier_returns
  FOR EACH ROW EXECUTE FUNCTION care_private.protect_pfleger_cost_carrier_return_history();
DROP TRIGGER IF EXISTS protect_pfleger_cost_carrier_corrections ON public.pfleger_cost_carrier_corrections;
CREATE TRIGGER protect_pfleger_cost_carrier_corrections BEFORE UPDATE OR DELETE ON public.pfleger_cost_carrier_corrections
  FOR EACH ROW EXECUTE FUNCTION care_private.protect_pfleger_cost_carrier_return_history();

CREATE OR REPLACE FUNCTION public.record_pfleger_cost_carrier_rejection(
  p_transmission_attempt_id uuid,
  p_payload jsonb,
  p_client_request_id uuid
) RETURNS public.pfleger_cost_carrier_returns
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  t uuid := public.current_tenant_id(); actor uuid := auth.uid(); actor_name text;
  attempt public.pfleger_cost_carrier_transmission_attempts;
  prior public.pfleger_cost_carrier_returns; result public.pfleger_cost_carrier_returns;
  errors jsonb := COALESCE(p_payload->'errors', '[]'::jsonb);
  request_fingerprint text; received_at timestamptz; actual_time timestamptz := clock_timestamp();
BEGIN
  IF t IS NULL OR actor IS NULL OR NOT public.has_permission('pflege.invoices.manage') THEN
    RAISE EXCEPTION 'Keine Berechtigung.' USING ERRCODE = '42501';
  END IF;
  IF p_transmission_attempt_id IS NULL OR p_client_request_id IS NULL OR p_payload IS NULL THEN
    RAISE EXCEPTION 'Rückläufer ist unvollständig.' USING ERRCODE = '23514';
  END IF;
  request_fingerprint := md5(jsonb_build_object('attemptId', p_transmission_attempt_id, 'payload', p_payload)::text);
  PERFORM pg_advisory_xact_lock(hashtext(t::text), hashtext(p_client_request_id::text));
  SELECT * INTO prior FROM public.pfleger_cost_carrier_returns WHERE tenant_id = t AND client_request_id = p_client_request_id;
  IF FOUND THEN
    IF prior.transmission_attempt_id IS DISTINCT FROM p_transmission_attempt_id OR prior.request_fingerprint IS DISTINCT FROM request_fingerprint OR prior.recorded_by IS DISTINCT FROM actor THEN
      RAISE EXCEPTION 'Diese Anforderungs-ID wurde bereits mit einem anderen Rückläufer verwendet.' USING ERRCODE = '40001';
    END IF;
    RETURN prior;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(t::text), hashtext(p_transmission_attempt_id::text));
  SELECT * INTO attempt FROM public.pfleger_cost_carrier_transmission_attempts WHERE id = p_transmission_attempt_id AND tenant_id = t FOR SHARE;
  IF NOT FOUND OR attempt.transmission_state NOT IN ('submitted','replacement_submitted_not_accepted') THEN
    RAISE EXCEPTION 'Ein tatsächlich dokumentierter Übermittlungsversuch fehlt.' USING ERRCODE = '40001';
  END IF;
  IF EXISTS (SELECT 1 FROM public.pfleger_cost_carrier_returns WHERE tenant_id = t AND transmission_attempt_id = attempt.id) THEN
    RAISE EXCEPTION 'Für diesen Übermittlungsversuch ist bereits ein Rückläufer dokumentiert.' USING ERRCODE = '40001';
  END IF;
  IF COALESCE(p_payload->>'returnFileName','') = '' OR COALESCE(p_payload->>'returnFileSha256','') !~ '^[0-9a-f]{64}$' OR
     COALESCE(p_payload->>'returnFileSizeBytes','0')::bigint <= 0 OR
     COALESCE(p_payload->>'senderIk','') !~ '^\d{9}$' OR COALESCE(p_payload->>'receiverIk','') !~ '^\d{9}$' OR
     COALESCE(p_payload->>'codeSystem','') = '' OR COALESCE(p_payload->>'codeSystemVersion','') = '' OR
     COALESCE(p_payload->>'receivedAt','') !~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}(Z|\+00:00)$' OR
     jsonb_typeof(errors) <> 'array' OR jsonb_array_length(errors) = 0 THEN
    RAISE EXCEPTION 'Datei, Empfangszeit, Parteien oder Fehlerprotokoll sind unvollständig.' USING ERRCODE = '23514';
  END IF;
  received_at := (p_payload->>'receivedAt')::timestamptz;
  IF received_at <= attempt.transmitted_at OR p_payload->>'senderIk' IS DISTINCT FROM attempt.receiver_ik OR
     p_payload->>'receiverIk' IS DISTINCT FROM attempt.sender_ik OR
     p_payload->>'referencedTransportMessageId' IS DISTINCT FROM attempt.transport_message_id THEN
    RAISE EXCEPTION 'Rückläufer gehört nicht exakt zum dokumentierten Übermittlungsversuch.' USING ERRCODE = '23514';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(errors) error
    WHERE btrim(COALESCE(error->>'errorId','')) = '' OR btrim(COALESCE(error->>'code','')) = '' OR btrim(COALESCE(error->>'message','')) = '' OR
      COALESCE(error->>'scope','') NOT IN ('invoice','position') OR
      (error->>'scope' = 'invoice' AND (error->'positionNo' <> 'null'::jsonb OR error->'billingCaseId' <> 'null'::jsonb OR error->'serviceProofId' <> 'null'::jsonb)) OR
      (error->>'scope' = 'position' AND NOT EXISTS (
        SELECT 1 FROM jsonb_array_elements(attempt.position_snapshot) position
        WHERE (position->>'positionNo')::integer = (error->>'positionNo')::integer
          AND position->>'billingCaseId' = error->>'billingCaseId'
          AND position->>'serviceProofId' = error->>'serviceProofId'
      ))
  ) OR EXISTS (
    SELECT 1 FROM jsonb_array_elements(errors) error GROUP BY error->>'errorId' HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Fehlercodes sind leer, doppelt oder nicht an die Originalposition gebunden.' USING ERRCODE = '23514';
  END IF;

  actor_name := public.clinical_actor_name();
  INSERT INTO public.pfleger_cost_carrier_returns(
    tenant_id,client_id,claim_lineage_id,transmission_attempt_id,invoice_number,return_file_name,return_file_sha256,
    return_file_size_bytes,received_at,sender_ik,receiver_ik,referenced_transport_message_id,code_system,code_system_version,
    errors,return_state,acceptance_status,payment_status,recorded_by,recorded_by_name,recorded_at,client_request_id,request_fingerprint
  ) VALUES (
    t,attempt.client_id,attempt.claim_lineage_id,attempt.id,attempt.invoice_number,btrim(p_payload->>'returnFileName'),p_payload->>'returnFileSha256',
    (p_payload->>'returnFileSizeBytes')::bigint,received_at,p_payload->>'senderIk',p_payload->>'receiverIk',p_payload->>'referencedTransportMessageId',
    btrim(p_payload->>'codeSystem'),btrim(p_payload->>'codeSystemVersion'),errors,'rejected_requires_correction','not_accepted','not_inferred',
    actor,actor_name,actual_time,p_client_request_id,request_fingerprint
  ) RETURNING * INTO result;
  INSERT INTO public.care_audit_events(tenant_id,client_id,entity_type,entity_id,action,summary,after_data,actor_id,actor_name)
    VALUES(t,attempt.client_id,'pflege_cost_carrier_return',result.id,'rejection_recorded',
      'Rückläufer exakt am Übermittlungsversuch gespeichert; Annahme und Zahlung nicht abgeleitet.',to_jsonb(result),actor,actor_name);
  RETURN result;
END $$;

CREATE OR REPLACE FUNCTION public.record_pfleger_cost_carrier_resubmission(
  p_return_id uuid,
  p_corrected_export_id uuid,
  p_transport_message_id text,
  p_payload jsonb,
  p_client_request_id uuid
) RETURNS public.pfleger_cost_carrier_transmission_attempts
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  t uuid := public.current_tenant_id(); actor uuid := auth.uid(); actor_name text;
  rejection public.pfleger_cost_carrier_returns; original public.pfleger_cost_carrier_transmission_attempts;
  corrected_export public.pfleger_cost_carrier_exports; corrected_approval public.pfleger_invoice_approvals;
  prior_correction public.pfleger_cost_carrier_corrections; result public.pfleger_cost_carrier_transmission_attempts;
  corrected_positions jsonb; request_fingerprint text; transmitted_at timestamptz; actual_time timestamptz := clock_timestamp();
BEGIN
  IF t IS NULL OR actor IS NULL OR NOT public.has_permission('pflege.invoices.manage') THEN
    RAISE EXCEPTION 'Keine Berechtigung.' USING ERRCODE = '42501';
  END IF;
  IF p_return_id IS NULL OR p_corrected_export_id IS NULL OR p_client_request_id IS NULL OR btrim(COALESCE(p_transport_message_id,'')) = '' OR p_payload IS NULL THEN
    RAISE EXCEPTION 'Korrektur oder erneute Übermittlung ist unvollständig.' USING ERRCODE = '23514';
  END IF;
  request_fingerprint := md5(jsonb_build_object('returnId',p_return_id,'exportId',p_corrected_export_id,'messageId',p_transport_message_id,'payload',p_payload)::text);
  PERFORM pg_advisory_xact_lock(hashtext(t::text), hashtext(p_client_request_id::text));
  SELECT * INTO prior_correction FROM public.pfleger_cost_carrier_corrections WHERE tenant_id = t AND client_request_id = p_client_request_id;
  IF FOUND THEN
    IF prior_correction.return_id IS DISTINCT FROM p_return_id OR prior_correction.corrected_export_id IS DISTINCT FROM p_corrected_export_id OR prior_correction.request_fingerprint IS DISTINCT FROM request_fingerprint OR prior_correction.recorded_by IS DISTINCT FROM actor THEN
      RAISE EXCEPTION 'Diese Anforderungs-ID wurde bereits mit einer anderen Korrektur verwendet.' USING ERRCODE = '40001';
    END IF;
    SELECT * INTO result FROM public.pfleger_cost_carrier_transmission_attempts WHERE id = prior_correction.resubmission_attempt_id;
    RETURN result;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(t::text), hashtext(p_return_id::text));
  SELECT * INTO rejection FROM public.pfleger_cost_carrier_returns WHERE id = p_return_id AND tenant_id = t FOR SHARE;
  IF NOT FOUND OR rejection.return_state <> 'rejected_requires_correction' THEN
    RAISE EXCEPTION 'Dokumentierter Rückläufer fehlt.' USING ERRCODE = '40001';
  END IF;
  SELECT * INTO original FROM public.pfleger_cost_carrier_transmission_attempts WHERE id = rejection.transmission_attempt_id AND tenant_id = t FOR SHARE;
  IF NOT FOUND OR original.claim_lineage_id IS DISTINCT FROM rejection.claim_lineage_id THEN
    RAISE EXCEPTION 'Originalversuch und Forderungshistorie sind widersprüchlich.' USING ERRCODE = '40001';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtext(t::text), hashtext(original.claim_lineage_id::text));
  IF EXISTS (SELECT 1 FROM public.pfleger_cost_carrier_corrections WHERE tenant_id = t AND return_id = rejection.id) OR
     EXISTS (SELECT 1 FROM public.pfleger_cost_carrier_transmission_attempts WHERE tenant_id = t AND replacement_for_attempt_id = original.id) THEN
    RAISE EXCEPTION 'Der abgewiesene Versuch wurde bereits ersetzt; eine zweite Forderung ist nicht zulässig.' USING ERRCODE = '40001';
  END IF;

  SELECT * INTO corrected_export FROM public.pfleger_cost_carrier_exports WHERE id = p_corrected_export_id AND tenant_id = t FOR SHARE;
  IF NOT FOUND OR corrected_export.client_id IS DISTINCT FROM original.client_id OR corrected_export.validation_state <> 'format_validated_not_submitted' OR
     corrected_export.transmission_status <> 'not_transmitted' OR corrected_export.invoice_number IS DISTINCT FROM original.invoice_number OR
     corrected_export.id = original.export_id OR corrected_export.invoice_approval_id = original.invoice_approval_id OR corrected_export.invoice_draft_id = original.invoice_draft_id OR
     corrected_export.payload_sha256 = original.payload_sha256 OR corrected_export.order_file_sha256 = original.order_file_sha256 THEN
    RAISE EXCEPTION 'Korrigierte, neu freigegebene und formatgeprüfte Fassung derselben Forderung fehlt.' USING ERRCODE = '40001';
  END IF;
  SELECT * INTO corrected_approval FROM public.pfleger_invoice_approvals WHERE id = corrected_export.invoice_approval_id AND tenant_id = t FOR SHARE;
  corrected_positions := corrected_approval.document_snapshot->'positions';
  IF NOT FOUND OR corrected_approval.client_id IS DISTINCT FROM original.client_id OR jsonb_typeof(corrected_positions) <> 'array' OR jsonb_array_length(corrected_positions) = 0 OR
     corrected_approval.document_fingerprint IS DISTINCT FROM p_payload->>'correctedDocumentFingerprint' OR
     COALESCE(p_payload->>'correctionVersion','0')::integer <> 1 OR btrim(COALESCE(p_payload->>'correctionReason','')) = '' OR
     COALESCE(p_payload->>'attemptNumber','0')::integer <> original.attempt_number + 1 OR
     p_payload->>'replacementForAttemptId' IS DISTINCT FROM original.id::text OR
     p_payload->>'senderIk' IS DISTINCT FROM original.sender_ik OR p_payload->>'receiverIk' IS DISTINCT FROM original.receiver_ik OR
     p_payload->>'payloadSha256' IS DISTINCT FROM corrected_export.payload_sha256 OR p_payload->>'orderFileSha256' IS DISTINCT FROM corrected_export.order_file_sha256 OR
     COALESCE(p_payload->>'transmittedAt','') !~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}(Z|\+00:00)$' THEN
    RAISE EXCEPTION 'Korrekturbeleg oder Folgeversuch ist nicht exakt an die neue Fassung gebunden.' USING ERRCODE = '23514';
  END IF;
  transmitted_at := (p_payload->>'transmittedAt')::timestamptz;
  IF transmitted_at <= rejection.received_at OR p_transport_message_id = original.transport_message_id OR
     EXISTS (
       SELECT 1 FROM jsonb_array_elements(rejection.errors) error
       WHERE error->>'scope' = 'position' AND NOT EXISTS (
         SELECT 1 FROM jsonb_array_elements(corrected_positions) position
         WHERE position->>'billingCaseId' = error->>'billingCaseId' AND position->>'serviceProofId' = error->>'serviceProofId'
       )
     ) THEN
    RAISE EXCEPTION 'Folgeversuch liegt zu früh, verwendet die alte Transportidentität oder verliert eine betroffene Originalposition.' USING ERRCODE = '23514';
  END IF;

  actor_name := public.clinical_actor_name();
  INSERT INTO public.pfleger_cost_carrier_transmission_attempts(
    tenant_id,client_id,claim_lineage_id,attempt_number,replacement_for_attempt_id,export_id,invoice_approval_id,invoice_draft_id,
    invoice_number,position_snapshot,total_amount_cents,payload_sha256,order_file_sha256,transport_message_id,sender_ik,receiver_ik,
    transmitted_at,transmission_state,acceptance_status,payment_status,transport_evidence,recorded_by,recorded_by_name,recorded_at
  ) VALUES (
    t,original.client_id,original.claim_lineage_id,original.attempt_number+1,original.id,corrected_export.id,corrected_export.invoice_approval_id,
    corrected_export.invoice_draft_id,original.invoice_number,corrected_positions,corrected_approval.total_amount_cents,corrected_export.payload_sha256,
    corrected_export.order_file_sha256,p_transport_message_id,original.sender_ik,original.receiver_ik,transmitted_at,
    'replacement_submitted_not_accepted','not_inferred','not_inferred',p_payload,actor,actor_name,actual_time
  ) RETURNING * INTO result;
  INSERT INTO public.pfleger_cost_carrier_corrections(
    tenant_id,client_id,claim_lineage_id,return_id,replaced_attempt_id,resubmission_attempt_id,correction_version,correction_reason,
    corrected_export_id,corrected_invoice_approval_id,corrected_invoice_draft_id,corrected_invoice_number,corrected_document_fingerprint,
    corrected_position_snapshot,corrected_total_amount_cents,claim_action,recorded_by,recorded_by_name,recorded_at,client_request_id,request_fingerprint
  ) VALUES (
    t,original.client_id,original.claim_lineage_id,rejection.id,original.id,result.id,1,btrim(p_payload->>'correctionReason'),corrected_export.id,
    corrected_export.invoice_approval_id,corrected_export.invoice_draft_id,original.invoice_number,corrected_approval.document_fingerprint,
    corrected_positions,corrected_approval.total_amount_cents,'replace_rejected_claim',actor,actor_name,actual_time,p_client_request_id,request_fingerprint
  );
  INSERT INTO public.care_audit_events(tenant_id,client_id,entity_type,entity_id,action,summary,after_data,actor_id,actor_name)
    VALUES(t,original.client_id,'pflege_cost_carrier_transmission_attempt',result.id,'rejected_claim_replaced',
      'Korrigierte Fassung ersetzt genau den abgewiesenen Versuch; keine zweite Forderung, Annahme oder Zahlung abgeleitet.',to_jsonb(result),actor,actor_name);
  RETURN result;
END $$;

REVOKE ALL ON FUNCTION public.record_pfleger_cost_carrier_rejection(uuid,jsonb,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_pfleger_cost_carrier_rejection(uuid,jsonb,uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.record_pfleger_cost_carrier_resubmission(uuid,uuid,text,jsonb,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_pfleger_cost_carrier_resubmission(uuid,uuid,text,jsonb,uuid) TO authenticated;
COMMENT ON FUNCTION public.record_pfleger_cost_carrier_rejection(uuid,jsonb,uuid) IS
  'Speichert einen abweisenden Rückläufer exakt an einem tatsächlichen Übermittlungsversuch. Keine Annahme oder Zahlung.';
COMMENT ON FUNCTION public.record_pfleger_cost_carrier_resubmission(uuid,uuid,text,jsonb,uuid) IS
  'Ersetzt genau einen abgewiesenen Versuch in derselben Forderungshistorie. Keine doppelte Forderung, Annahme oder Zahlung.';
