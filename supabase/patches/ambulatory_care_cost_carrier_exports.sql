-- Checkpoint 236 / U-04: append-only Beleg einer konkreten §105-SGB-XI-Dateifassung und ihrer Formatprüfung.
-- Die Ablage bestätigt weder Übermittlung noch Annahme durch eine Datenannahmestelle.

CREATE TABLE IF NOT EXISTS public.pfleger_cost_carrier_exports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE RESTRICT,
  invoice_approval_id uuid NOT NULL REFERENCES public.pfleger_invoice_approvals(id) ON DELETE RESTRICT,
  invoice_draft_id uuid NOT NULL REFERENCES public.pfleger_invoice_drafts(id) ON DELETE RESTRICT,
  invoice_number text NOT NULL CHECK (btrim(invoice_number)<>''),
  approval_version integer NOT NULL CHECK (approval_version=1),
  document_fingerprint text NOT NULL,
  recipient_ik text NOT NULL CHECK (recipient_ik ~ '^\d{9}$'),
  profile_id text NOT NULL CHECK (profile_id='sgb_xi_105_ta1_6_4_0'),
  technical_specification_version text NOT NULL CHECK (technical_specification_version='6.4.0'),
  key_directory_version text NOT NULL CHECK (key_directory_version='6.4.0'),
  carrier_directory_format_version text NOT NULL CHECK (carrier_directory_format_version='5.2'),
  specification_sha256 text NOT NULL CHECK (specification_sha256 ~ '^[0-9a-f]{64}$'),
  key_directory_sha256 text NOT NULL CHECK (key_directory_sha256 ~ '^[0-9a-f]{64}$'),
  carrier_directory_format_sha256 text NOT NULL CHECK (carrier_directory_format_sha256 ~ '^[0-9a-f]{64}$'),
  carrier_directory_snapshot jsonb NOT NULL,
  payload_file_name text NOT NULL CHECK (btrim(payload_file_name)<>''),
  payload_sha256 text NOT NULL CHECK (payload_sha256 ~ '^[0-9a-f]{64}$'),
  payload_size_bytes bigint NOT NULL CHECK (payload_size_bytes > 0),
  order_file_name text NOT NULL CHECK (btrim(order_file_name)<>''),
  order_file_sha256 text NOT NULL CHECK (order_file_sha256 ~ '^[0-9a-f]{64}$'),
  order_file_size_bytes bigint NOT NULL CHECK (order_file_size_bytes > 0),
  files_created_at timestamptz NOT NULL,
  validator_name text NOT NULL CHECK (btrim(validator_name)<>''),
  validator_version text NOT NULL CHECK (btrim(validator_version)<>''),
  validator_rules_sha256 text NOT NULL CHECK (validator_rules_sha256 ~ '^[0-9a-f]{64}$'),
  software_test_catalog_version text NOT NULL CHECK (software_test_catalog_version='1.0'),
  validation_run_id text NOT NULL CHECK (btrim(validation_run_id)<>''),
  validation_result text NOT NULL CHECK (validation_result IN ('valid','invalid')),
  validation_errors jsonb NOT NULL CHECK (jsonb_typeof(validation_errors)='array'),
  validation_warnings jsonb NOT NULL CHECK (jsonb_typeof(validation_warnings)='array'),
  validated_at timestamptz NOT NULL,
  validation_snapshot jsonb NOT NULL,
  validation_state text NOT NULL CHECK (validation_state IN ('format_validated_not_submitted','format_rejected_not_submitted')),
  transmission_status text NOT NULL DEFAULT 'not_transmitted' CHECK (transmission_status='not_transmitted'),
  acceptance_status text NOT NULL DEFAULT 'not_inferred' CHECK (acceptance_status='not_inferred'),
  recorded_by uuid NOT NULL REFERENCES auth.users(id),
  recorded_by_name text NOT NULL,
  recorded_at timestamptz NOT NULL,
  client_request_id uuid NOT NULL,
  request_fingerprint text NOT NULL CHECK (request_fingerprint ~ '^[0-9a-f]{32}$'),
  CHECK (payload_file_name<>order_file_name AND payload_sha256<>order_file_sha256),
  CHECK (validated_at>=files_created_at),
  UNIQUE (tenant_id, client_request_id),
  UNIQUE (tenant_id, validation_run_id)
);

ALTER TABLE public.pfleger_cost_carrier_exports ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.pfleger_cost_carrier_exports FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.pfleger_cost_carrier_exports TO authenticated;
DROP POLICY IF EXISTS pfleger_cost_carrier_exports_read ON public.pfleger_cost_carrier_exports;
CREATE POLICY pfleger_cost_carrier_exports_read ON public.pfleger_cost_carrier_exports FOR SELECT TO authenticated
  USING (tenant_id=public.current_tenant_id() AND public.has_permission('pflege.billing.view'));

CREATE OR REPLACE FUNCTION care_private.protect_pfleger_cost_carrier_export_history()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  RAISE EXCEPTION 'Exportdateien und Formatprüfprotokolle bleiben unverändert.' USING ERRCODE='42501';
END $$;
DROP TRIGGER IF EXISTS protect_pfleger_cost_carrier_exports ON public.pfleger_cost_carrier_exports;
CREATE TRIGGER protect_pfleger_cost_carrier_exports BEFORE UPDATE OR DELETE ON public.pfleger_cost_carrier_exports
  FOR EACH ROW EXECUTE FUNCTION care_private.protect_pfleger_cost_carrier_export_history();

CREATE OR REPLACE FUNCTION public.record_pfleger_cost_carrier_export_validation(
  p_invoice_approval_id uuid,
  p_payload jsonb,
  p_client_request_id uuid
) RETURNS public.pfleger_cost_carrier_exports
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  t uuid:=public.current_tenant_id(); actor uuid:=auth.uid(); actor_name text;
  approval public.pfleger_invoice_approvals; draft public.pfleger_invoice_drafts;
  prior public.pfleger_cost_carrier_exports; result public.pfleger_cost_carrier_exports;
  recipient_ik text; request_fingerprint text; actual_time timestamptz:=clock_timestamp();
  errors jsonb:=COALESCE(p_payload->'validation'->'errors','[]'::jsonb);
  warnings jsonb:=COALESCE(p_payload->'validation'->'warnings','[]'::jsonb);
  created_at timestamptz; validated_at timestamptz;
BEGIN
  IF t IS NULL OR actor IS NULL OR NOT public.has_permission('pflege.invoices.manage') THEN
    RAISE EXCEPTION 'Keine Berechtigung.' USING ERRCODE='42501';
  END IF;
  IF p_invoice_approval_id IS NULL OR p_client_request_id IS NULL OR p_payload IS NULL THEN
    RAISE EXCEPTION 'Exportprüfung ist unvollständig.' USING ERRCODE='23514';
  END IF;
  request_fingerprint:=md5(jsonb_build_object('approvalId',p_invoice_approval_id,'payload',p_payload)::text);
  PERFORM pg_advisory_xact_lock(hashtext(t::text),hashtext(p_client_request_id::text));
  SELECT * INTO prior FROM public.pfleger_cost_carrier_exports WHERE tenant_id=t AND client_request_id=p_client_request_id;
  IF FOUND THEN
    IF prior.invoice_approval_id IS DISTINCT FROM p_invoice_approval_id OR prior.request_fingerprint IS DISTINCT FROM request_fingerprint OR prior.recorded_by IS DISTINCT FROM actor THEN
      RAISE EXCEPTION 'Diese Anforderungs-ID wurde bereits mit anderen Exportdaten verwendet.' USING ERRCODE='40001';
    END IF;
    RETURN prior;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(t::text),hashtext(p_invoice_approval_id::text));
  SELECT * INTO approval FROM public.pfleger_invoice_approvals WHERE id=p_invoice_approval_id AND tenant_id=t FOR SHARE;
  IF NOT FOUND OR approval.approval_version<>1 OR approval.transmission_status<>'not_transmitted' THEN
    RAISE EXCEPTION 'Unveränderte, noch nicht übertragene Freigabeversion 1 fehlt.' USING ERRCODE='40001';
  END IF;
  SELECT * INTO draft FROM public.pfleger_invoice_drafts WHERE id=approval.invoice_draft_id AND tenant_id=t FOR SHARE;
  IF NOT FOUND OR draft.client_id<>approval.client_id OR draft.invoice_number IS DISTINCT FROM approval.document_snapshot->>'invoiceNumber' THEN
    RAISE EXCEPTION 'Freigabe und Rechnungsentwurf sind widersprüchlich.' USING ERRCODE='40001';
  END IF;
  recipient_ik:=approval.document_snapshot->'recipient'->>'ik';
  IF recipient_ik !~ '^\d{9}$' OR EXISTS (
    SELECT 1 FROM public.pfleger_invoice_draft_positions p
    JOIN public.pfleger_billing_cases b ON b.id=p.billing_case_id AND b.tenant_id=p.tenant_id
    WHERE p.tenant_id=t AND p.invoice_draft_id=draft.id AND b.legal_basis<>'sgb_xi'
  ) OR NOT EXISTS (SELECT 1 FROM public.pfleger_invoice_draft_positions p WHERE p.tenant_id=t AND p.invoice_draft_id=draft.id) THEN
    RAISE EXCEPTION 'Dieses Exportprofil verlangt ausschließlich §105-SGB-XI-Positionen und eine Kostenträger-IK.' USING ERRCODE='23514';
  END IF;

  IF p_payload->>'profileId'<>'sgb_xi_105_ta1_6_4_0' OR p_payload->>'technicalSpecificationVersion'<>'6.4.0' OR
     p_payload->>'keyDirectoryVersion'<>'6.4.0' OR p_payload->>'carrierDirectoryFormatVersion'<>'5.2' OR
     COALESCE(p_payload->'carrierDirectory'->>'resolvedCostCarrierIk','')<>recipient_ik OR
     COALESCE(p_payload->'carrierDirectory'->>'dataAcceptanceIk','')!~ '^\d{9}$' OR
     COALESCE(p_payload->'carrierDirectory'->>'physicalReceiverIk','')!~ '^\d{9}$' OR
     COALESCE(p_payload->'carrierDirectory'->>'encryptionReceiverIk','')!~ '^\d{9}$' THEN
    RAISE EXCEPTION 'Empfangsprofil oder aufgelöste Kostenträgerdatei ist unvollständig.' USING ERRCODE='23514';
  END IF;
  IF COALESCE(p_payload->>'specificationSha256','')!~ '^[0-9a-f]{64}$' OR COALESCE(p_payload->>'keyDirectorySha256','')!~ '^[0-9a-f]{64}$' OR
     COALESCE(p_payload->>'carrierDirectoryFormatSha256','')!~ '^[0-9a-f]{64}$' OR COALESCE(p_payload->'carrierDirectory'->>'fileSha256','')!~ '^[0-9a-f]{64}$' OR
     COALESCE(p_payload->'artifact'->>'payloadSha256','')!~ '^[0-9a-f]{64}$' OR COALESCE(p_payload->'artifact'->>'orderFileSha256','')!~ '^[0-9a-f]{64}$' OR
     COALESCE(p_payload->'validation'->>'validatorRulesSha256','')!~ '^[0-9a-f]{64}$' OR
     p_payload->'validation'->>'payloadSha256' IS DISTINCT FROM p_payload->'artifact'->>'payloadSha256' OR
     p_payload->'validation'->>'orderFileSha256' IS DISTINCT FROM p_payload->'artifact'->>'orderFileSha256' THEN
    RAISE EXCEPTION 'Originaldateien, Spezifikationen oder Prüfprotokoll sind nicht eindeutig per SHA-256 gebunden.' USING ERRCODE='23514';
  END IF;
  created_at:=(p_payload->'artifact'->>'createdAt')::timestamptz;
  validated_at:=(p_payload->'validation'->>'validatedAt')::timestamptz;
  IF created_at::date NOT BETWEEN DATE '2026-05-01' AND DATE '2027-01-31' OR validated_at<created_at OR
     (p_payload->'carrierDirectory'->>'publishedOn')::date>created_at::date OR
     p_payload->'validation'->>'softwareTestCatalogVersion'<>'1.0' OR
     jsonb_typeof(errors)<>'array' OR jsonb_typeof(warnings)<>'array' OR
     (p_payload->'validation'->>'result'='valid' AND jsonb_array_length(errors)>0) OR
     (p_payload->'validation'->>'result'='invalid' AND jsonb_array_length(errors)=0) OR
     COALESCE(p_payload->'validation'->>'result','') NOT IN ('valid','invalid') THEN
    RAISE EXCEPTION 'Prüfzeit, Gültigkeitszeitraum oder Validierungsergebnis ist widersprüchlich.' USING ERRCODE='23514';
  END IF;

  actor_name:=public.clinical_actor_name();
  INSERT INTO public.pfleger_cost_carrier_exports(
    tenant_id,client_id,invoice_approval_id,invoice_draft_id,invoice_number,approval_version,document_fingerprint,recipient_ik,
    profile_id,technical_specification_version,key_directory_version,carrier_directory_format_version,specification_sha256,key_directory_sha256,
    carrier_directory_format_sha256,carrier_directory_snapshot,payload_file_name,payload_sha256,payload_size_bytes,order_file_name,order_file_sha256,
    order_file_size_bytes,files_created_at,validator_name,validator_version,validator_rules_sha256,software_test_catalog_version,validation_run_id,
    validation_result,validation_errors,validation_warnings,validated_at,validation_snapshot,validation_state,transmission_status,acceptance_status,
    recorded_by,recorded_by_name,recorded_at,client_request_id,request_fingerprint
  ) VALUES (
    t,approval.client_id,approval.id,approval.invoice_draft_id,draft.invoice_number,approval.approval_version,approval.document_fingerprint,recipient_ik,
    p_payload->>'profileId',p_payload->>'technicalSpecificationVersion',p_payload->>'keyDirectoryVersion',p_payload->>'carrierDirectoryFormatVersion',
    p_payload->>'specificationSha256',p_payload->>'keyDirectorySha256',p_payload->>'carrierDirectoryFormatSha256',p_payload->'carrierDirectory',
    p_payload->'artifact'->>'payloadFileName',p_payload->'artifact'->>'payloadSha256',(p_payload->'artifact'->>'payloadSizeBytes')::bigint,
    p_payload->'artifact'->>'orderFileName',p_payload->'artifact'->>'orderFileSha256',(p_payload->'artifact'->>'orderFileSizeBytes')::bigint,created_at,
    p_payload->'validation'->>'validatorName',p_payload->'validation'->>'validatorVersion',p_payload->'validation'->>'validatorRulesSha256',
    p_payload->'validation'->>'softwareTestCatalogVersion',p_payload->'validation'->>'validationRunId',p_payload->'validation'->>'result',errors,warnings,
    validated_at,p_payload->'validation',CASE WHEN p_payload->'validation'->>'result'='valid' THEN 'format_validated_not_submitted' ELSE 'format_rejected_not_submitted' END,
    'not_transmitted','not_inferred',actor,actor_name,actual_time,p_client_request_id,request_fingerprint
  ) RETURNING * INTO result;
  INSERT INTO public.care_audit_events(tenant_id,client_id,entity_type,entity_id,action,summary,after_data,actor_id,actor_name)
    VALUES(t,approval.client_id,'pflege_cost_carrier_export',result.id,'format_validation_recorded',
      'Dateifassung und Formatprüfprotokoll gespeichert; Übermittlung und Annahme nicht abgeleitet.',to_jsonb(result),actor,actor_name);
  RETURN result;
END $$;

REVOKE ALL ON FUNCTION public.record_pfleger_cost_carrier_export_validation(uuid,jsonb,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_pfleger_cost_carrier_export_validation(uuid,jsonb,uuid) TO authenticated;
COMMENT ON FUNCTION public.record_pfleger_cost_carrier_export_validation(uuid,jsonb,uuid) IS
  'Bindet §105-SGB-XI-Dateien an Freigabe, Kostenträgerdatei, aktuelle Spezifikationen und konkretes Formatprüfprotokoll. Keine Übermittlung oder Empfängerannahme.';
