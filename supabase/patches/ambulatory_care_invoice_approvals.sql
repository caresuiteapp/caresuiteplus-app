-- Checkpoint 235 / U-03: versionierter, unveränderlicher Freigabebeleg für genau eine Entwurfsfassung.
-- Freigabe ist weder Versand/Übertragung noch Zahlungseingang.

CREATE TABLE IF NOT EXISTS public.pfleger_invoice_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE RESTRICT,
  invoice_draft_id uuid NOT NULL REFERENCES public.pfleger_invoice_drafts(id) ON DELETE RESTRICT,
  draft_version integer NOT NULL CHECK (draft_version > 0),
  approval_version integer NOT NULL CHECK (approval_version > 0),
  source_draft_fingerprint text NOT NULL CHECK (source_draft_fingerprint ~ '^[0-9a-f]{32}$'),
  document_fingerprint text NOT NULL CHECK (document_fingerprint ~ '^[0-9a-f]{32}$'),
  position_count integer NOT NULL CHECK (position_count > 0),
  net_amount_cents bigint NOT NULL CHECK (net_amount_cents BETWEEN 0 AND 999999999999),
  tax_amount_cents bigint NOT NULL CHECK (tax_amount_cents BETWEEN 0 AND 999999999999),
  total_amount_cents bigint NOT NULL CHECK (total_amount_cents BETWEEN 0 AND 999999999999),
  tax_treatment text NOT NULL CHECK (tax_treatment IN ('tax_exempt_healthcare','taxable')),
  tax_rate_basis_points integer NOT NULL CHECK (tax_rate_basis_points BETWEEN 0 AND 10000),
  tax_legal_reference text NOT NULL,
  reviewer_note text NOT NULL,
  document_snapshot jsonb NOT NULL,
  approved_by uuid NOT NULL REFERENCES auth.users(id),
  approved_by_name text NOT NULL,
  approved_at timestamptz NOT NULL,
  transmission_status text NOT NULL DEFAULT 'not_transmitted' CHECK (transmission_status='not_transmitted'),
  payment_status text NOT NULL DEFAULT 'not_inferred' CHECK (payment_status='not_inferred'),
  client_request_id uuid NOT NULL,
  request_fingerprint text NOT NULL CHECK (request_fingerprint ~ '^[0-9a-f]{32}$'),
  CHECK (net_amount_cents + tax_amount_cents = total_amount_cents),
  UNIQUE (invoice_draft_id, approval_version),
  UNIQUE (tenant_id, client_request_id)
);

ALTER TABLE public.pfleger_invoice_approvals ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.pfleger_invoice_approvals FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.pfleger_invoice_approvals TO authenticated;
DROP POLICY IF EXISTS pfleger_invoice_approvals_read ON public.pfleger_invoice_approvals;
CREATE POLICY pfleger_invoice_approvals_read ON public.pfleger_invoice_approvals FOR SELECT TO authenticated
  USING (tenant_id=public.current_tenant_id() AND public.has_permission('pflege.billing.view'));

CREATE OR REPLACE FUNCTION care_private.protect_pfleger_invoice_approval_history()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  RAISE EXCEPTION 'Freigegebene Rechnungsfassungen bleiben unverändert.' USING ERRCODE='42501';
END $$;
DROP TRIGGER IF EXISTS protect_pfleger_invoice_approvals ON public.pfleger_invoice_approvals;
CREATE TRIGGER protect_pfleger_invoice_approvals BEFORE UPDATE OR DELETE ON public.pfleger_invoice_approvals
  FOR EACH ROW EXECUTE FUNCTION care_private.protect_pfleger_invoice_approval_history();

CREATE OR REPLACE FUNCTION public.approve_pfleger_invoice_draft(
  p_invoice_draft_id uuid,
  p_expected_draft_version integer,
  p_expected_draft_created_at timestamptz,
  p_tax_treatment text,
  p_tax_rate_basis_points integer,
  p_net_amount_cents bigint,
  p_tax_amount_cents bigint,
  p_tax_legal_reference text,
  p_reviewer_note text,
  p_client_request_id uuid
) RETURNS public.pfleger_invoice_approvals
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  t uuid:=public.current_tenant_id(); actor uuid:=auth.uid(); actor_name text;
  draft public.pfleger_invoice_drafts; prior public.pfleger_invoice_approvals; approval public.pfleger_invoice_approvals;
  tenant_row public.tenants; client_row public.clients; carrier_row public.cost_bearers;
  positions jsonb; position_total bigint; position_count integer; first_position integer; last_position integer; source_snapshot jsonb; document_snapshot jsonb;
  source_fingerprint text; document_fingerprint text; request_fingerprint text; actual_time timestamptz:=clock_timestamp();
  issuer_name text; issuer_address text; issuer_tax_reference text; recipient_name text; recipient_address text; expected_tax bigint;
BEGIN
  IF t IS NULL OR actor IS NULL OR NOT public.has_permission('pflege.billing.release') THEN
    RAISE EXCEPTION 'Keine Berechtigung.' USING ERRCODE='42501';
  END IF;
  IF p_invoice_draft_id IS NULL OR p_client_request_id IS NULL OR p_expected_draft_version<>1 OR p_expected_draft_created_at IS NULL OR
     p_tax_treatment NOT IN ('tax_exempt_healthcare','taxable') OR p_tax_rate_basis_points NOT BETWEEN 0 AND 10000 OR
     p_net_amount_cents NOT BETWEEN 0 AND 999999999999 OR p_tax_amount_cents NOT BETWEEN 0 AND 999999999999 OR
     length(btrim(COALESCE(p_tax_legal_reference,'')))=0 OR length(btrim(COALESCE(p_reviewer_note,'')))<5 THEN
    RAISE EXCEPTION 'Freigabeauftrag oder Pflichtangaben sind unvollständig.' USING ERRCODE='23514';
  END IF;
  request_fingerprint:=md5(jsonb_build_object(
    'draftId',p_invoice_draft_id,'draftVersion',p_expected_draft_version,'draftCreatedAt',to_char(p_expected_draft_created_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
    'taxTreatment',p_tax_treatment,'taxRateBasisPoints',p_tax_rate_basis_points,'netAmountCents',p_net_amount_cents,
    'taxAmountCents',p_tax_amount_cents,'taxLegalReference',btrim(p_tax_legal_reference),'reviewerNote',btrim(p_reviewer_note)
  )::text);
  PERFORM pg_advisory_xact_lock(hashtext(t::text),hashtext(p_client_request_id::text));
  SELECT * INTO prior FROM public.pfleger_invoice_approvals WHERE tenant_id=t AND client_request_id=p_client_request_id;
  IF FOUND THEN
    IF prior.invoice_draft_id IS DISTINCT FROM p_invoice_draft_id OR prior.request_fingerprint IS DISTINCT FROM request_fingerprint THEN
      RAISE EXCEPTION 'Diese Anforderungs-ID wurde bereits mit anderen Freigabedaten verwendet.' USING ERRCODE='40001';
    END IF;
    RETURN prior;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(t::text),hashtext(p_invoice_draft_id::text));
  SELECT * INTO draft FROM public.pfleger_invoice_drafts WHERE id=p_invoice_draft_id AND tenant_id=t FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Rechnungsentwurf nicht gefunden.' USING ERRCODE='42501'; END IF;
  IF draft.status<>'draft' OR draft.created_at IS DISTINCT FROM p_expected_draft_created_at THEN
    RAISE EXCEPTION 'Die erwartete Entwurfsfassung ist nicht mehr unverändert vorhanden.' USING ERRCODE='40001';
  END IF;
  IF draft.created_by=actor THEN
    RAISE EXCEPTION 'Entwurf und Freigabe benötigen zwei verschiedene Identitäten.' USING ERRCODE='42501';
  END IF;
  IF EXISTS (SELECT 1 FROM public.pfleger_invoice_approvals WHERE tenant_id=t AND invoice_draft_id=draft.id) THEN
    RAISE EXCEPTION 'Diese Entwurfsfassung besitzt bereits einen Freigabebeleg.' USING ERRCODE='40001';
  END IF;

  SELECT count(*),sum(amount_cents),min(position_no),max(position_no),jsonb_agg(jsonb_build_object(
    'positionNo',position_no,'billingCaseId',billing_case_id,'serviceProofId',service_proof_id,'serviceDate',service_date,
    'serviceCode',service_code,'quantityMilli',quantity_milli,'unitAmountCents',unit_amount_cents,
    'amountCents',amount_cents,'proofFingerprint',proof_fingerprint,'sourceSnapshot',source_snapshot
  ) ORDER BY position_no) INTO position_count,position_total,first_position,last_position,positions
  FROM public.pfleger_invoice_draft_positions WHERE tenant_id=t AND invoice_draft_id=draft.id;
  IF position_count IS DISTINCT FROM draft.position_count OR position_total IS DISTINCT FROM draft.total_amount_cents OR first_position<>1 OR last_position<>position_count OR positions IS NULL OR
     EXISTS (SELECT 1 FROM public.pfleger_invoice_draft_positions p WHERE p.tenant_id=t AND p.invoice_draft_id=draft.id AND
       (p.position_no<1 OR p.amount_cents<>(p.quantity_milli::bigint*p.unit_amount_cents)/1000 OR (p.quantity_milli::bigint*p.unit_amount_cents)%1000<>0)) THEN
    RAISE EXCEPTION 'Entwurfspositionen sind unvollständig oder rechnerisch widersprüchlich.' USING ERRCODE='40001';
  END IF;
  IF p_net_amount_cents+p_tax_amount_cents<>draft.total_amount_cents THEN
    RAISE EXCEPTION 'Netto- und Steuerbetrag stimmen nicht mit dem Gesamtbetrag überein.' USING ERRCODE='23514';
  END IF;
  IF p_tax_treatment='tax_exempt_healthcare' THEN
    IF p_tax_rate_basis_points<>0 OR p_tax_amount_cents<>0 OR p_net_amount_cents<>draft.total_amount_cents THEN
      RAISE EXCEPTION 'Steuerbefreite Rechnung benötigt null Steuer und den Gesamtbetrag als Netto.' USING ERRCODE='23514';
    END IF;
  ELSE
    expected_tax:=round(p_net_amount_cents::numeric*p_tax_rate_basis_points/10000)::bigint;
    IF p_tax_rate_basis_points<=0 OR p_tax_amount_cents<>expected_tax THEN
      RAISE EXCEPTION 'Steuerbetrag stimmt nicht mit Nettobetrag und Steuersatz überein.' USING ERRCODE='23514';
    END IF;
  END IF;

  SELECT * INTO tenant_row FROM public.tenants WHERE id=t FOR SHARE;
  issuer_name:=btrim(COALESCE(tenant_row.legal_name,tenant_row.name,''));
  issuer_address:=concat_ws(', ',NULLIF(btrim(concat_ws(' ',tenant_row.street,tenant_row.house_number)),''),NULLIF(btrim(concat_ws(' ',tenant_row.postal_code,tenant_row.city)),''),NULLIF(btrim(tenant_row.country),''));
  issuer_tax_reference:=btrim(COALESCE(NULLIF(tenant_row.tax_number,''),NULLIF(tenant_row.vat_id,''),''));
  IF issuer_name='' OR btrim(COALESCE(tenant_row.street,''))='' OR btrim(COALESCE(tenant_row.house_number,''))='' OR btrim(COALESCE(tenant_row.postal_code,''))='' OR btrim(COALESCE(tenant_row.city,''))='' OR btrim(COALESCE(tenant_row.country,''))='' OR issuer_tax_reference='' THEN
    RAISE EXCEPTION 'Ausstellername, vollständige Anschrift und Steuerkennung sind vor Freigabe erforderlich.' USING ERRCODE='23514';
  END IF;
  IF draft.recipient_key LIKE 'self:%' THEN
    SELECT * INTO client_row FROM public.clients WHERE id=draft.client_id AND tenant_id=t FOR SHARE;
    recipient_name:=btrim(concat_ws(' ',client_row.first_name,client_row.last_name));
    recipient_address:=concat_ws(', ',NULLIF(btrim(concat_ws(' ',client_row.street,client_row.house_number,client_row.apartment_number)),''),NULLIF(btrim(concat_ws(' ',client_row.postal_code,client_row.city)),''),NULLIF(btrim(client_row.country),''));
    IF recipient_name='' OR btrim(COALESCE(client_row.street,''))='' OR btrim(COALESCE(client_row.house_number,''))='' OR btrim(COALESCE(client_row.postal_code,''))='' OR btrim(COALESCE(client_row.city,''))='' OR btrim(COALESCE(client_row.country,''))='' THEN recipient_address:=''; END IF;
  ELSE
    SELECT * INTO carrier_row FROM public.cost_bearers WHERE ik_number=draft.recipient_ik AND (tenant_id=t OR tenant_id IS NULL)
      ORDER BY (tenant_id=t) DESC,updated_at DESC LIMIT 1;
    recipient_name:=btrim(COALESCE(NULLIF(carrier_row.name,''),draft.recipient_name,''));
    recipient_address:=COALESCE(NULLIF(btrim(carrier_row.billing_address),''),concat_ws(', ',NULLIF(btrim(concat_ws(' ',carrier_row.street,carrier_row.house_number)),''),NULLIF(btrim(concat_ws(' ',carrier_row.postal_code,carrier_row.city)),''),NULLIF(btrim(carrier_row.country),'')));
    IF btrim(COALESCE(carrier_row.billing_address,''))='' AND (btrim(COALESCE(carrier_row.street,''))='' OR btrim(COALESCE(carrier_row.house_number,''))='' OR btrim(COALESCE(carrier_row.postal_code,''))='' OR btrim(COALESCE(carrier_row.city,''))='' OR btrim(COALESCE(carrier_row.country,''))='') THEN recipient_address:=''; END IF;
  END IF;
  IF btrim(COALESCE(draft.invoice_number,''))='' OR btrim(COALESCE(draft.recipient_name,''))='' OR btrim(COALESCE(draft.recipient_key,''))='' OR btrim(COALESCE(recipient_name,''))='' OR btrim(COALESCE(recipient_address,''))='' OR draft.due_date<draft.issued_at::date THEN
    RAISE EXCEPTION 'Rechnungsnummer, Empfänger, Empfängeranschrift und plausible Fristen sind vor Freigabe erforderlich.' USING ERRCODE='23514';
  END IF;

  source_snapshot:=jsonb_build_object('draftId',draft.id,'draftVersion',1,'createdBy',draft.created_by,'createdAt',to_char(draft.created_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),'draft',to_jsonb(draft),'positions',positions);
  source_fingerprint:=md5(source_snapshot::text);
  actor_name:=public.clinical_actor_name();
  document_snapshot:=jsonb_build_object(
    'invoiceDraftId',draft.id,'invoiceNumber',draft.invoice_number,'draftVersion',1,'approvalVersion',1,
    'tenantId',t,'clientId',draft.client_id,'issuedAt',to_char(draft.issued_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),'dueDate',draft.due_date,
    'issuer',jsonb_build_object('name',issuer_name,'address',issuer_address,'taxReference',issuer_tax_reference),
    'recipient',jsonb_build_object('name',recipient_name,'draftName',draft.recipient_name,'key',draft.recipient_key,'ik',draft.recipient_ik,'address',recipient_address),
    'amounts',jsonb_build_object('netAmountCents',p_net_amount_cents,'taxAmountCents',p_tax_amount_cents,'totalAmountCents',draft.total_amount_cents,'taxTreatment',p_tax_treatment,'taxRateBasisPoints',p_tax_rate_basis_points,'taxLegalReference',btrim(p_tax_legal_reference)),
    'positions',positions,'sourceDraftFingerprint',source_fingerprint,'reviewer',jsonb_build_object('id',actor,'name',actor_name,'note',btrim(p_reviewer_note)),
    'approvedAt',to_char(actual_time AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),'transmissionStatus','not_transmitted','paymentStatus','not_inferred'
  );
  document_fingerprint:=md5(document_snapshot::text);
  INSERT INTO public.pfleger_invoice_approvals(
    tenant_id,client_id,invoice_draft_id,draft_version,approval_version,source_draft_fingerprint,document_fingerprint,
    position_count,net_amount_cents,tax_amount_cents,total_amount_cents,tax_treatment,tax_rate_basis_points,tax_legal_reference,
    reviewer_note,document_snapshot,approved_by,approved_by_name,approved_at,transmission_status,payment_status,client_request_id,request_fingerprint
  ) VALUES (
    t,draft.client_id,draft.id,1,1,source_fingerprint,document_fingerprint,position_count,p_net_amount_cents,p_tax_amount_cents,
    draft.total_amount_cents,p_tax_treatment,p_tax_rate_basis_points,btrim(p_tax_legal_reference),btrim(p_reviewer_note),document_snapshot,
    actor,actor_name,actual_time,'not_transmitted','not_inferred',p_client_request_id,request_fingerprint
  ) RETURNING * INTO approval;
  INSERT INTO public.care_audit_events(tenant_id,client_id,entity_type,entity_id,action,summary,after_data,actor_id,actor_name)
    VALUES(t,draft.client_id,'pflege_invoice_approval',approval.id,'approved','Rechnungsfassung geprüft und unveränderlich freigegeben; nicht versendet und Zahlung nicht abgeleitet.',to_jsonb(approval),actor,actor_name);
  RETURN approval;
END $$;

REVOKE ALL ON FUNCTION public.approve_pfleger_invoice_draft(uuid,integer,timestamptz,text,integer,bigint,bigint,text,text,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.approve_pfleger_invoice_draft(uuid,integer,timestamptz,text,integer,bigint,bigint,text,text,uuid) TO authenticated;
COMMENT ON FUNCTION public.approve_pfleger_invoice_draft(uuid,integer,timestamptz,text,integer,bigint,bigint,text,text,uuid) IS
  'Friert eine konkrete geprüfte Entwurfsfassung mit zweiter Identität ein. Keine Übertragung, kein Versand und kein Zahlungseingang.';
