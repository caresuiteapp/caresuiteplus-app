-- Office Web invoice lifecycle. This source is staged for the existing migration
-- deployment workflow; it does not issue invoices or insert business test data.
BEGIN;

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS office_managed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS include_service_proofs boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS selected_proof_ids text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS company_snapshot jsonb,
  ADD COLUMN IF NOT EXISTS customer_snapshot jsonb,
  ADD COLUMN IF NOT EXISTS issued_snapshot jsonb,
  ADD COLUMN IF NOT EXISTS pdf_sha256 text,
  ADD COLUMN IF NOT EXISTS issued_at timestamptz,
  ADD COLUMN IF NOT EXISTS delivery_evidence jsonb;

-- Neither the retry ledger nor the transaction capability is a client-writable
-- table. The public entry points are invokers; their tightly scoped private
-- implementations must own the ledger and enforce every business permission.
CREATE TABLE IF NOT EXISTS care_security.office_invoice_requests (
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  request_id uuid NOT NULL, actor_id uuid NOT NULL, request_hash text NOT NULL,
  invoice_id uuid NOT NULL, operation text NOT NULL, result jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (tenant_id, request_id)
);
CREATE TABLE IF NOT EXISTS care_security.office_invoice_write_context (
  transaction_id bigint NOT NULL, tenant_id uuid NOT NULL, invoice_id uuid NOT NULL,
  actor_id uuid NOT NULL, PRIMARY KEY (transaction_id, tenant_id, invoice_id)
);
ALTER TABLE care_security.office_invoice_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE care_security.office_invoice_write_context ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON care_security.office_invoice_requests, care_security.office_invoice_write_context FROM PUBLIC, anon, authenticated;

-- Existing legacy readers retain their policies. Newly managed financial rows
-- additionally require an active Office invoice reader (never a portal role).
CREATE OR REPLACE FUNCTION care_security.office_invoice_reader(p_tenant uuid,p_invoice uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $body$
  SELECT p_tenant=public.current_tenant_id() AND EXISTS(SELECT 1 FROM public.invoices i
    WHERE i.id=p_invoice AND i.tenant_id=p_tenant AND (NOT i.office_managed OR
      ((public.current_portal_type() IS NULL OR public.current_portal_type()='business')
       AND care_security.office_actor(p_tenant,'office.invoices.view'))))
$body$;
REVOKE ALL ON FUNCTION care_security.office_invoice_reader(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION care_security.office_invoice_reader(uuid,uuid) TO authenticated;
DROP POLICY IF EXISTS office_invoice_workspace_read ON public.invoices;
CREATE POLICY office_invoice_workspace_read ON public.invoices AS RESTRICTIVE FOR SELECT TO authenticated
  USING(NOT office_managed OR ((public.current_portal_type() IS NULL OR public.current_portal_type()='business')
    AND care_security.office_actor(tenant_id,'office.invoices.view')));
DROP POLICY IF EXISTS office_invoice_items_workspace_read ON public.invoice_items;
CREATE POLICY office_invoice_items_workspace_read ON public.invoice_items AS RESTRICTIVE FOR SELECT TO authenticated
  USING(care_security.office_invoice_reader(tenant_id,invoice_id));
DROP POLICY IF EXISTS office_invoice_payments_workspace_read ON public.payments;
CREATE POLICY office_invoice_payments_workspace_read ON public.payments AS RESTRICTIVE FOR SELECT TO authenticated
  USING(invoice_id IS NULL OR care_security.office_invoice_reader(tenant_id,invoice_id));

CREATE OR REPLACE FUNCTION care_security.office_invoice_write_allowed(p_tenant uuid,p_invoice uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $body$
  SELECT auth.uid() IS NOT NULL AND p_tenant=public.current_tenant_id() AND EXISTS (
    SELECT 1 FROM care_security.office_invoice_write_context c
    WHERE c.transaction_id=txid_current() AND c.tenant_id=p_tenant AND c.invoice_id=p_invoice AND c.actor_id=auth.uid()
  )
$body$;
REVOKE ALL ON FUNCTION care_security.office_invoice_write_allowed(uuid,uuid) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION care_security.office_invoice_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $body$
DECLARE v_old jsonb; v_new jsonb; v_invoice uuid; v_tenant uuid; v_managed boolean;
BEGIN
  IF TG_OP<>'INSERT' THEN v_old:=to_jsonb(OLD); END IF;
  IF TG_OP<>'DELETE' THEN v_new:=to_jsonb(NEW); END IF;
  IF TG_TABLE_NAME='invoices' THEN
    v_managed:=coalesce((v_old->>'office_managed')::boolean,false) OR coalesce((v_new->>'office_managed')::boolean,false);
    v_invoice:=coalesce(v_old->>'id',v_new->>'id')::uuid;
    v_tenant:=coalesce(v_old->>'tenant_id',v_new->>'tenant_id')::uuid;
    IF TG_OP='UPDATE' AND coalesce((v_old->>'office_managed')::boolean,false)
      AND (NEW.id IS DISTINCT FROM OLD.id OR NEW.tenant_id IS DISTINCT FROM OLD.tenant_id OR NOT NEW.office_managed) THEN
      RAISE EXCEPTION 'Die Rechnungszuordnung darf nicht geändert werden.' USING ERRCODE='42501';
    END IF;
  ELSE
    IF TG_TABLE_NAME='invoice_items' AND TG_OP<>'DELETE' AND nullif(v_new->>'service_record_id','') IS NOT NULL THEN
      -- A legacy line writer must wait for a concurrent managed source claim,
      -- then evaluate the committed owner instead of an earlier snapshot.
      PERFORM 1 FROM public.service_records WHERE id=(v_new->>'service_record_id')::uuid
        AND tenant_id=(v_new->>'tenant_id')::uuid FOR UPDATE;
      IF NOT FOUND THEN RAISE EXCEPTION 'Der Leistungsnachweis gehört nicht zum Rechnungsmandanten.' USING ERRCODE='23514'; END IF;
      IF EXISTS (SELECT 1 FROM public.service_records s JOIN public.invoices i ON i.id=s.billed_invoice_id
        WHERE s.id=(v_new->>'service_record_id')::uuid AND s.tenant_id=(v_new->>'tenant_id')::uuid
          AND i.tenant_id=s.tenant_id AND i.office_managed AND i.id<>(v_new->>'invoice_id')::uuid) THEN
        RAISE EXCEPTION 'Dieser Leistungsnachweis gehört bereits zu einer anderen Rechnung.' USING ERRCODE='23514';
      END IF;
    END IF;
    FOR v_invoice,v_tenant,v_managed IN
      SELECT i.id,i.tenant_id,i.office_managed FROM public.invoices i
      WHERE i.id=ANY(ARRAY[nullif(v_old->>'invoice_id','')::uuid,nullif(v_new->>'invoice_id','')::uuid])
    LOOP
      IF v_managed AND NOT care_security.office_invoice_write_allowed(v_tenant,v_invoice) THEN
        RAISE EXCEPTION 'Rechnungspositionen und Zahlungen müssen über die geprüfte Rechnungsbearbeitung gespeichert werden.' USING ERRCODE='42501';
      END IF;
    END LOOP;
    RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
  END IF;
  IF v_managed AND NOT care_security.office_invoice_write_allowed(v_tenant,v_invoice) THEN
    RAISE EXCEPTION 'Diese Rechnung muss über die geprüfte Rechnungsbearbeitung gespeichert werden.' USING ERRCODE='42501';
  END IF;
  RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
END
$body$;
REVOKE ALL ON FUNCTION care_security.office_invoice_guard() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS office_invoice_workspace_guard ON public.invoices;
CREATE TRIGGER office_invoice_workspace_guard BEFORE INSERT OR UPDATE OR DELETE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION care_security.office_invoice_guard();
DROP TRIGGER IF EXISTS office_invoice_items_workspace_guard ON public.invoice_items;
CREATE TRIGGER office_invoice_items_workspace_guard BEFORE INSERT OR UPDATE OR DELETE ON public.invoice_items
  FOR EACH ROW EXECUTE FUNCTION care_security.office_invoice_guard();
DROP TRIGGER IF EXISTS office_invoice_payments_workspace_guard ON public.payments;
CREATE TRIGGER office_invoice_payments_workspace_guard BEFORE INSERT OR UPDATE OR DELETE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION care_security.office_invoice_guard();

CREATE OR REPLACE FUNCTION care_security.office_invoice_source_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $body$
DECLARE v_old jsonb;v_new jsonb;v_invoice public.invoices;
BEGIN
  IF TG_OP<>'INSERT' THEN v_old:=to_jsonb(OLD); END IF;
  IF TG_OP<>'DELETE' THEN v_new:=to_jsonb(NEW); END IF;
  FOR v_invoice IN SELECT i.* FROM public.invoices i WHERE i.office_managed
    AND i.id=ANY(ARRAY[nullif(v_old->>'billed_invoice_id','')::uuid,nullif(v_new->>'billed_invoice_id','')::uuid])
  LOOP
    IF NOT care_security.office_invoice_write_allowed(v_invoice.tenant_id,v_invoice.id) THEN
      RAISE EXCEPTION 'Ein bereits zugeordneter Leistungsnachweis kann nur über den Rechnungsentwurf freigegeben werden.' USING ERRCODE='42501';
    END IF;
    IF TG_OP='DELETE' OR (TG_OP='UPDATE' AND
      (v_old-ARRAY['billed_invoice_id','status','updated_at']) IS DISTINCT FROM (v_new-ARRAY['billed_invoice_id','status','updated_at'])) THEN
      RAISE EXCEPTION 'Die bestätigte Rechnungsquelle ist unveränderlich.';
    END IF;
  END LOOP;
  RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
END
$body$;
REVOKE ALL ON FUNCTION care_security.office_invoice_source_guard() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS office_invoice_source_workspace_guard ON public.service_records;
CREATE TRIGGER office_invoice_source_workspace_guard BEFORE INSERT OR UPDATE OR DELETE ON public.service_records
  FOR EACH ROW EXECUTE FUNCTION care_security.office_invoice_source_guard();

CREATE OR REPLACE FUNCTION care_security.office_invoice_company(p_tenant uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $body$
  SELECT jsonb_build_object(
    'legalName',coalesce(nullif(btrim(t.legal_name),''),t.name,''),'street',coalesce(t.street,''),
    'houseNumber',coalesce(t.house_number,''),'postalCode',coalesce(t.postal_code,''),'city',coalesce(t.city,''),
    'country',coalesce(t.country,''),'phone',coalesce(t.phone,''),'email',coalesce(t.email,''),'website',coalesce(t.website,''),
    'taxNumber',coalesce(t.tax_number,''),'vatId',coalesce(t.vat_id,''),'registerCourt',coalesce(t.register_court,''),
    'registerNumber',coalesce(t.register_number,''),'ikNumber',coalesce(t.ik_number,''),
    'representativeName',coalesce(t.representative_name,''),'bankName',coalesce(CASE WHEN b.id IS NOT NULL THEN b.bank_name ELSE s.bank_name END,''),
    'iban',coalesce(CASE WHEN b.id IS NOT NULL THEN b.iban ELSE s.iban END,''),
    'bic',coalesce(CASE WHEN b.id IS NOT NULL THEN b.bic ELSE s.bic END,''),'logoUrl',coalesce(br.logo_url,''),
    'footerText',coalesce(s.invoice_footer_text,''))
  FROM public.tenants t LEFT JOIN public.tenant_billing_settings s ON s.tenant_id=t.id
  LEFT JOIN LATERAL (SELECT id,bank_name,iban,bic FROM public.tenant_bank_accounts
    WHERE tenant_id=t.id ORDER BY is_primary DESC NULLS LAST,sort_order NULLS LAST,id LIMIT 1) b ON true
  LEFT JOIN public.tenant_branding br ON br.tenant_id=t.id WHERE t.id=p_tenant
$body$;
REVOKE ALL ON FUNCTION care_security.office_invoice_company(uuid) FROM PUBLIC,anon,authenticated;

-- Verify the real signed source independently of the optional PDF annex switch.
-- Existing workflow attestation helpers are private and are called only after
-- this lifecycle's tenant and invoice permission checks.
CREATE OR REPLACE FUNCTION care_security.office_invoice_assert_source(p_source public.service_records,p_billing boolean)
RETURNS void LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog AS $body$
DECLARE a public.assignments;d public.documentation_entries;s public.signatures;att public.workflow_proof_attestations;
  v_receipt jsonb;v_row record;v_paused timestamptz;v_pause numeric:=0;v_minutes integer;
BEGIN
  IF p_source.tenant_id IS DISTINCT FROM public.current_tenant_id() OR auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Der Leistungsnachweis gehört nicht zum aktuellen Unternehmen.' USING ERRCODE='42501';
  END IF;
  IF p_billing AND (p_source.actual_minutes IS NULL OR p_source.actual_minutes<=0 OR p_source.billable_minutes IS NULL
    OR p_source.billable_minutes<=0 OR p_source.billable_minutes>p_source.actual_minutes OR p_source.hourly_rate IS NULL
    OR p_source.hourly_rate<=0 OR p_source.total_amount IS NULL OR p_source.total_amount<=0
    OR round(p_source.billable_minutes::numeric/60*p_source.hourly_rate,2) IS DISTINCT FROM p_source.total_amount) THEN
    RAISE EXCEPTION 'Tatsächliche Leistung, abrechenbare Dauer und bestätigter Nettobetrag stimmen nicht überein.';
  END IF;
  IF p_source.assignment_id IS NOT NULL THEN
    IF p_source.source_receipt->>'version' IS DISTINCT FROM 'workflow-assignment-record-v1'
      OR p_source.source_receipt->>'tenant_id' IS DISTINCT FROM p_source.tenant_id::text
      OR p_source.source_receipt->>'client_id' IS DISTINCT FROM p_source.client_id::text
      OR p_source.source_receipt->>'assignment_id' IS DISTINCT FROM p_source.assignment_id::text THEN
      RAISE EXCEPTION 'Die bestätigte Nachweisquelle fehlt. Bitte den Einsatzabschluss prüfen.';
    END IF;
    SELECT * INTO a FROM public.assignments WHERE tenant_id=p_source.tenant_id AND id=p_source.assignment_id FOR SHARE;
    IF NOT FOUND OR a.client_id IS DISTINCT FROM p_source.client_id OR a.employee_id IS DISTINCT FROM p_source.employee_id
      OR a.status::text<>'completed' OR a.actual_start_at IS NULL OR a.actual_end_at IS NULL
      OR NOT isfinite(a.actual_start_at) OR NOT isfinite(a.actual_end_at) OR a.actual_end_at<a.actual_start_at
      OR a.actual_end_at>clock_timestamp()
      OR p_source.service_date IS DISTINCT FROM (a.actual_start_at AT TIME ZONE 'Europe/Berlin')::date THEN
      RAISE EXCEPTION 'Der bestätigte Einsatzabschluss oder sein Leistungsdatum ist nicht mehr gültig.';
    END IF;
    IF nullif(p_source.source_receipt->>'visit_id','') IS NOT NULL THEN
      IF NOT EXISTS(SELECT 1 FROM public.assist_visits v WHERE v.tenant_id=p_source.tenant_id
        AND v.id=(p_source.source_receipt->>'visit_id')::uuid AND (v.id=a.id OR v.legacy_assignment_id=a.id)
        AND v.client_id=a.client_id AND v.employee_id IS NOT DISTINCT FROM a.employee_id
        AND v.actual_start_at=a.actual_start_at AND v.actual_end_at=a.actual_end_at) THEN
        RAISE EXCEPTION 'Die Einsatzzuordnung des Nachweises wurde geändert.';
      END IF;
      v_receipt:=public.workflow_signed_proof_source(p_source.tenant_id,(p_source.source_receipt->>'visit_id')::uuid,
        (p_source.source_receipt->>'proof_id')::uuid,p_billing,true)||jsonb_build_object('assignment_id',a.id);
    ELSE
      SELECT * INTO d FROM public.documentation_entries WHERE tenant_id=p_source.tenant_id AND assignment_id=a.id
        AND id=(p_source.source_receipt->>'documentation_entry_id')::uuid AND client_id=a.client_id
        AND employee_id IS NOT DISTINCT FROM a.employee_id AND status::text IN ('saved','signature_required','completed','approved')
        AND nullif(btrim(free_text),'') IS NOT NULL FOR SHARE;
      IF NOT FOUND THEN RAISE EXCEPTION 'Die bestätigte Dokumentation ist nicht mehr verfügbar.'; END IF;
      SELECT * INTO s FROM public.signatures WHERE tenant_id=p_source.tenant_id AND assignment_id=a.id
        AND id=(p_source.source_receipt->>'legacy_signature_id')::uuid AND documentation_entry_id=d.id AND client_id=a.client_id
        AND employee_id IS NOT DISTINCT FROM a.employee_id AND status::text='signed' AND nullif(btrim(signature_data),'') IS NOT NULL
        AND length(btrim(signer_name))>=2 AND signed_at>=d.updated_at AND signed_at>=a.actual_end_at AND signed_at<=clock_timestamp() FOR SHARE;
      IF NOT FOUND THEN RAISE EXCEPTION 'Die aktuelle Unterschrift fehlt.'; END IF;
      FOR v_row IN SELECT entry_type,event_at FROM public.time_entries WHERE tenant_id=p_source.tenant_id AND assignment_id=a.id
        AND event_at BETWEEN a.actual_start_at AND a.actual_end_at ORDER BY event_at,id LOOP
        IF v_row.entry_type::text='paused' AND v_paused IS NULL THEN v_paused:=v_row.event_at;
        ELSIF v_row.entry_type::text IN ('resumed','finished') AND v_paused IS NOT NULL THEN
          v_pause:=v_pause+extract(epoch FROM v_row.event_at-v_paused);v_paused:=NULL;
        END IF;
      END LOOP;
      IF v_paused IS NOT NULL THEN v_pause:=v_pause+extract(epoch FROM a.actual_end_at-v_paused); END IF;
      v_minutes:=round(greatest(0,extract(epoch FROM a.actual_end_at-a.actual_start_at)-v_pause)/60)::integer;
      SELECT * INTO att FROM public.workflow_proof_attestations WHERE tenant_id=p_source.tenant_id AND assignment_id=a.id FOR SHARE;
      IF NOT FOUND OR att.proof_id IS NOT NULL OR att.legacy_documentation_id IS DISTINCT FROM d.id OR att.legacy_signature_id IS DISTINCT FROM s.id
        OR att.documentation_updated_at IS DISTINCT FROM d.updated_at OR att.signed_at IS DISTINCT FROM s.signed_at
        OR att.proof_payload_hash IS DISTINCT FROM 'sha256:'||encode(sha256(convert_to(d.free_text,'UTF8')),'hex')
        OR att.signature_hash IS DISTINCT FROM 'sha256:'||encode(sha256(convert_to(s.signature_data,'UTF8')),'hex')
        OR att.service_started_at IS DISTINCT FROM a.actual_start_at OR att.service_ended_at IS DISTINCT FROM a.actual_end_at
        OR att.actual_minutes IS DISTINCT FROM v_minutes OR att.verified_at<s.signed_at OR att.verified_at>clock_timestamp()
        OR att.producer_contract<>'verified-original-bytes-v1' THEN RAISE EXCEPTION 'Die vertrauenswürdige Originalbestätigung fehlt oder ist veraltet.'; END IF;
      v_receipt:=jsonb_build_object('version','workflow-assignment-record-v1','tenant_id',p_source.tenant_id,'assignment_id',a.id,
        'client_id',a.client_id,'employee_id',a.employee_id,'service_started_at',a.actual_start_at,'service_ended_at',a.actual_end_at,
        'actual_minutes',v_minutes,'documentation_entry_id',d.id,'legacy_signature_id',s.id,'documentation_updated_at',d.updated_at,
        'signed_at',s.signed_at,'pdf_storage_path',att.pdf_storage_path,'pdf_sha256',att.pdf_sha256,'attested_at',att.verified_at);
    END IF;
    IF v_receipt IS DISTINCT FROM p_source.source_receipt OR (v_receipt->>'actual_minutes')::integer IS DISTINCT FROM p_source.actual_minutes THEN
      RAISE EXCEPTION 'Die gespeicherte Nachweisfassung wurde geändert. Bitte den Einsatzabschluss prüfen.';
    END IF;
  ELSE
    -- A standalone proof cannot reuse an unrelated old signature from the same
    -- client. Lock and verify its exact current documentation and signature.
    SELECT * INTO d FROM public.documentation_entries WHERE tenant_id=p_source.tenant_id AND id=p_source.documentation_entry_id
      AND client_id=p_source.client_id AND employee_id IS NOT DISTINCT FROM p_source.employee_id AND assignment_id IS NULL
      AND status::text IN ('saved','signature_required','completed','approved') AND nullif(btrim(free_text),'') IS NOT NULL FOR SHARE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Die aktuelle Dokumentation des Leistungsnachweises fehlt.'; END IF;
    SELECT * INTO s FROM public.signatures WHERE tenant_id=p_source.tenant_id AND id=p_source.signature_id
      AND client_id=p_source.client_id AND employee_id IS NOT DISTINCT FROM p_source.employee_id AND assignment_id IS NULL
      AND documentation_entry_id=d.id AND status::text='signed' AND nullif(btrim(signature_data),'') IS NOT NULL
      AND length(btrim(signer_name))>=2 AND signed_at>=d.updated_at AND signed_at<=clock_timestamp()
      AND (signed_at AT TIME ZONE 'Europe/Berlin')::date>=p_source.service_date FOR SHARE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Ein gültiger unterschriebener Leistungsnachweis fehlt.'; END IF;
  END IF;
END
$body$;
REVOKE ALL ON FUNCTION care_security.office_invoice_assert_source(public.service_records,boolean) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION care_security.office_invoice_proofs(p_invoice public.invoices)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog AS $body$
DECLARE v_key text;v_source public.service_records;v_path text;v_items jsonb:='[]'::jsonb;
BEGIN
  IF NOT p_invoice.include_service_proofs THEN
    IF cardinality(p_invoice.selected_proof_ids)>0 THEN RAISE EXCEPTION 'Die Anlagen sind ausgeschaltet.'; END IF;
    RETURN v_items;
  END IF;
  IF cardinality(p_invoice.selected_proof_ids) NOT BETWEEN 1 AND 30
    OR cardinality(p_invoice.selected_proof_ids)<>(SELECT count(DISTINCT x) FROM unnest(p_invoice.selected_proof_ids) x) THEN
    RAISE EXCEPTION 'Bitte zwischen einem und 30 unterschiedliche Leistungsnachweise auswählen.';
  END IF;
  FOREACH v_key IN ARRAY p_invoice.selected_proof_ids LOOP
    IF v_key !~ '^record:[0-9a-fA-F-]{36}$' THEN RAISE EXCEPTION 'Die Nachweisauswahl ist ungültig.'; END IF;
    SELECT * INTO v_source FROM public.service_records WHERE id=substring(v_key FROM 8)::uuid
      AND tenant_id=p_invoice.tenant_id AND client_id=p_invoice.client_id;
    IF NOT FOUND OR v_source.service_date NOT BETWEEN p_invoice.service_period_from AND p_invoice.service_period_to
      OR v_source.status::text NOT IN ('signed','approved','billable','billed')
      OR (v_source.billed_invoice_id IS NOT NULL AND v_source.billed_invoice_id<>p_invoice.id) THEN
      RAISE EXCEPTION 'Ein ausgewählter Leistungsnachweis gehört nicht zu dieser Rechnung oder ist nicht freigegeben.';
    END IF;
    PERFORM care_security.office_invoice_assert_source(v_source,false);
    -- A plausible same-tenant URL is not proof that those PDF bytes belong to
    -- the current signature. Only the existing trusted byte attestation may
    -- supply an annex; standalone manual lines remain usable without an annex.
    IF v_source.assignment_id IS NULL OR v_source.source_receipt->>'version' IS DISTINCT FROM 'workflow-assignment-record-v1'
      OR coalesce(v_source.source_receipt->>'pdf_sha256','') !~ '^(sha256:)?[0-9a-f]{64}$' THEN
      RAISE EXCEPTION 'Die Original-PDF dieses Leistungsnachweises ist nicht verlässlich bestätigt. Bitte die Anlage im Einsatzabschluss prüfen.';
    END IF;
    v_path:=nullif(v_source.source_receipt->>'pdf_storage_path','');
    IF v_path IS NULL OR v_path NOT LIKE 'tenant/'||p_invoice.tenant_id||'/%' OR v_path LIKE '%..%'
      OR NOT EXISTS(SELECT 1 FROM storage.objects WHERE bucket_id='office-documents' AND name=v_path
        AND metadata->>'mimetype'='application/pdf' AND coalesce((metadata->>'size')::bigint,0)>0) THEN
      RAISE EXCEPTION 'Eine ausgewählte Original-PDF ist nicht verfügbar.';
    END IF;
    IF v_source.source_receipt<>'{}'::jsonb AND
      (v_source.source_receipt->>'tenant_id' IS DISTINCT FROM p_invoice.tenant_id::text
       OR v_source.source_receipt->>'client_id' IS DISTINCT FROM p_invoice.client_id::text) THEN
      RAISE EXCEPTION 'Die Zuordnung des bestätigten Nachweises stimmt nicht überein.';
    END IF;
    v_items:=v_items||jsonb_build_array(jsonb_build_object('id',v_key,'updated_at',v_source.updated_at,
      'path',v_path,'sha256',v_source.source_receipt->>'pdf_sha256','service_date',v_source.service_date));
  END LOOP;
  RETURN v_items;
END
$body$;
REVOKE ALL ON FUNCTION care_security.office_invoice_proofs(public.invoices) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION care_security.office_invoice_issue_preview(p_tenant_id uuid,p_invoice_id uuid,p_expected_updated_at timestamptz)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog AS $body$
DECLARE v_invoice public.invoices;v_settings public.tenant_billing_settings;v_company jsonb;v_lines jsonb;v_sources jsonb;
  v_proofs jsonb;v_number text;v_next integer;v_snapshot jsonb;v_name text;v_total numeric;v_source public.service_records;
BEGIN
  IF auth.uid() IS NULL OR p_tenant_id IS DISTINCT FROM public.current_tenant_id()
    OR (public.current_portal_type() IS NOT NULL AND public.current_portal_type()<>'business')
    OR NOT coalesce(care_security.office_actor(p_tenant_id,'office.invoices.view'),false)
    OR NOT coalesce(care_security.office_actor(p_tenant_id,'office.invoices.status_change'),false) THEN
    RAISE EXCEPTION 'Keine Berechtigung zur Rechnungsfreigabe.' USING ERRCODE='42501';
  END IF;
  SELECT * INTO v_invoice FROM public.invoices WHERE tenant_id=p_tenant_id AND id=p_invoice_id;
  IF NOT FOUND OR NOT v_invoice.office_managed OR v_invoice.status<>'draft' OR v_invoice.issued_at IS NOT NULL
    OR p_expected_updated_at IS NULL OR v_invoice.updated_at IS DISTINCT FROM p_expected_updated_at THEN
    RAISE EXCEPTION 'Der Rechnungsentwurf wurde inzwischen geändert. Bitte aktualisieren.' USING ERRCODE='40001';
  END IF;
  SELECT * INTO v_settings FROM public.tenant_billing_settings WHERE tenant_id=p_tenant_id;
  IF NOT FOUND OR v_settings.next_invoice_number IS NULL OR v_settings.next_invoice_number<1
    OR nullif(btrim(v_settings.invoice_prefix),'') IS NULL THEN
    RAISE EXCEPTION 'Rechnungspräfix und nächste Rechnungsnummer müssen in den Unternehmenseinstellungen hinterlegt sein.';
  END IF;
  v_next:=v_settings.next_invoice_number;
  LOOP
    IF v_next>=2147483647 THEN RAISE EXCEPTION 'Der Rechnungsnummernkreis ist ausgeschöpft.'; END IF;
    v_number:=btrim(v_settings.invoice_prefix)||'-'||to_char(v_invoice.invoice_date,'YYYY')||'-'||lpad(v_next::text,greatest(5,length(v_next::text)),'0');
    EXIT WHEN NOT EXISTS(SELECT 1 FROM public.invoices WHERE tenant_id=p_tenant_id AND invoice_number=v_number AND id<>p_invoice_id);
    v_next:=v_next+1;
  END LOOP;
  v_company:=care_security.office_invoice_company(p_tenant_id);
  FOREACH v_name IN ARRAY ARRAY['legalName','street','postalCode','city','country','bankName','iban'] LOOP
    IF nullif(btrim(v_company->>v_name),'') IS NULL THEN RAISE EXCEPTION 'Unternehmensangabe für die Rechnung fehlt: %.',v_name; END IF;
  END LOOP;
  IF nullif(btrim(v_company->>'taxNumber'),'') IS NULL AND nullif(btrim(v_company->>'vatId'),'') IS NULL THEN
    RAISE EXCEPTION 'Steuernummer oder Umsatzsteuer-ID des Unternehmens fehlt.';
  END IF;
  IF v_invoice.due_date IS NULL OR v_invoice.due_date<v_invoice.invoice_date OR v_invoice.service_period_from IS NULL
    OR v_invoice.service_period_to IS NULL OR v_invoice.service_period_to<v_invoice.service_period_from
    OR nullif(btrim(v_invoice.recipient_name),'') IS NULL OR nullif(btrim(v_invoice.recipient_street),'') IS NULL
    OR nullif(btrim(v_invoice.recipient_postal_code),'') IS NULL OR nullif(btrim(v_invoice.recipient_city),'') IS NULL THEN
    RAISE EXCEPTION 'Empfänger, Leistungszeitraum oder Fälligkeitsdatum ist unvollständig.';
  END IF;
  SELECT jsonb_agg(to_jsonb(i) ORDER BY i.sort_order,i.id),sum(i.gross_amount) INTO v_lines,v_total
    FROM public.invoice_items i WHERE tenant_id=p_tenant_id AND invoice_id=p_invoice_id;
  IF v_lines IS NULL OR v_total IS DISTINCT FROM v_invoice.total_amount OR v_total<=0 THEN
    RAISE EXCEPTION 'Die gespeicherten Rechnungspositionen und Rechnungssumme stimmen nicht überein.';
  END IF;
  IF EXISTS(SELECT 1 FROM public.invoice_items WHERE tenant_id=p_tenant_id AND invoice_id=p_invoice_id AND vat_rate=0)
    AND nullif(btrim(v_invoice.footer_text),'') IS NULL THEN
    RAISE EXCEPTION 'Bitte die Grundlage für Rechnungspositionen ohne Umsatzsteuer angeben.';
  END IF;
  IF EXISTS(SELECT 1 FROM public.invoice_items i LEFT JOIN public.service_records s ON s.id=i.service_record_id AND s.tenant_id=i.tenant_id
    WHERE i.tenant_id=p_tenant_id AND i.invoice_id=p_invoice_id AND i.service_record_id IS NOT NULL
      AND (s.id IS NULL OR s.billed_invoice_id IS DISTINCT FROM p_invoice_id OR s.client_id IS DISTINCT FROM v_invoice.client_id
        OR s.status::text NOT IN ('approved','billable') OR s.total_amount IS DISTINCT FROM i.net_amount)) THEN
    RAISE EXCEPTION 'Eine Rechnungsquelle hat sich geändert oder ist nicht mehr abrechenbar.';
  END IF;
  FOR v_source IN SELECT * FROM public.service_records WHERE tenant_id=p_tenant_id AND billed_invoice_id=p_invoice_id ORDER BY id LOOP
    PERFORM care_security.office_invoice_assert_source(v_source,true);
  END LOOP;
  SELECT coalesce(jsonb_agg(to_jsonb(s) ORDER BY s.id),'[]'::jsonb) INTO v_sources FROM public.service_records s
    WHERE s.tenant_id=p_tenant_id AND s.billed_invoice_id=p_invoice_id;
  v_proofs:=care_security.office_invoice_proofs(v_invoice);
  v_snapshot:=jsonb_build_object('invoice',to_jsonb(v_invoice),'lines',v_lines,'sources',v_sources,'proofs',v_proofs,
    'company',v_company,'invoice_number',v_number);
  RETURN jsonb_build_object('invoice_number',v_number,'company_snapshot',v_company,'source_revision',md5(v_snapshot::text),
    'snapshot',v_snapshot,'next_invoice_number',v_next+1);
END
$body$;
REVOKE ALL ON FUNCTION care_security.office_invoice_issue_preview(uuid,uuid,timestamptz) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION care_security.office_invoice_issue_preview(uuid,uuid,timestamptz) TO authenticated;
CREATE OR REPLACE FUNCTION public.office_invoice_issue_preview(p_tenant_id uuid,p_invoice_id uuid,p_expected_updated_at timestamptz)
RETURNS jsonb LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path=pg_catalog AS $body$
  SELECT care_security.office_invoice_issue_preview(p_tenant_id,p_invoice_id,p_expected_updated_at)
$body$;
REVOKE ALL ON FUNCTION public.office_invoice_issue_preview(uuid,uuid,timestamptz) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.office_invoice_issue_preview(uuid,uuid,timestamptz) TO authenticated;

CREATE OR REPLACE FUNCTION care_security.office_invoice_mutation(
  p_tenant_id uuid,p_request_id uuid,p_invoice_id uuid,p_expected_updated_at timestamptz,p_operation text,p_payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $body$
DECLARE
  v_invoice public.invoices;v_client public.clients;v_source public.service_records;
  v_request care_security.office_invoice_requests;v_actor uuid;v_id uuid;v_hash text;v_result jsonb;
  v_line jsonb;v_key text;v_keys uuid[]:='{}';v_proofs text[]:='{}';v_lines jsonb:='[]';v_line_id uuid;
  v_quantity numeric;v_price numeric;v_rate numeric;v_net numeric;v_tax numeric;v_subtotal numeric:=0;v_taxes numeric:=0;
  v_start date;v_end date;v_date date;v_due date;v_service_date date;v_include boolean;v_sort integer:=0;
  v_preview jsonb;v_paid numeric;v_amount numeric;v_status text;v_payment_date date;v_now timestamptz:=clock_timestamp();
BEGIN
  IF auth.uid() IS NULL OR p_tenant_id IS DISTINCT FROM public.current_tenant_id()
    OR (public.current_portal_type() IS NOT NULL AND public.current_portal_type()<>'business')
    OR NOT coalesce(care_security.office_actor(p_tenant_id,'office.invoices.view'),false)
    OR NOT coalesce(care_security.office_actor(p_tenant_id,CASE WHEN p_operation='save_draft' THEN 'office.invoices.create' ELSE 'office.invoices.status_change' END),false) THEN
    RAISE EXCEPTION 'Keine Berechtigung für diese Rechnungsbearbeitung.' USING ERRCODE='42501';
  END IF;
  IF p_request_id IS NULL OR p_operation IS NULL OR p_operation NOT IN ('save_draft','delete_draft','set_status','record_payment')
    OR jsonb_typeof(p_payload) IS DISTINCT FROM 'object' OR octet_length(p_payload::text)>2000000 THEN
    RAISE EXCEPTION 'Ungültiger Rechnungsauftrag.' USING ERRCODE='22023';
  END IF;
  SELECT id INTO v_actor FROM public.profiles WHERE tenant_id=p_tenant_id AND is_active IS TRUE AND status::text='active'
    AND (auth_user_id=auth.uid() OR (auth_user_id IS NULL AND id=auth.uid()));
  IF v_actor IS NULL THEN RAISE EXCEPTION 'Aktives Verwaltungsprofil fehlt.' USING ERRCODE='42501'; END IF;
  v_hash:=md5(jsonb_build_array(p_invoice_id,p_expected_updated_at,p_operation,p_payload)::text);
  PERFORM pg_advisory_xact_lock(hashtextextended('office-invoice-request:'||p_tenant_id||':'||p_request_id,0));
  SELECT * INTO v_request FROM care_security.office_invoice_requests WHERE tenant_id=p_tenant_id AND request_id=p_request_id;
  IF FOUND THEN
    IF v_request.actor_id IS DISTINCT FROM auth.uid() OR v_request.request_hash IS DISTINCT FROM v_hash THEN
      RAISE EXCEPTION 'Diese Speicherkennung wurde bereits für einen anderen Vorgang verwendet.' USING ERRCODE='22023';
    END IF;
    RETURN v_request.result;
  END IF;
  v_id:=coalesce(p_invoice_id,gen_random_uuid());
  PERFORM pg_advisory_xact_lock(hashtextextended('office-invoice:'||p_tenant_id||':'||v_id,0));
  IF p_invoice_id IS NOT NULL THEN
    SELECT * INTO v_invoice FROM public.invoices WHERE tenant_id=p_tenant_id AND id=p_invoice_id FOR UPDATE;
    IF NOT FOUND OR p_expected_updated_at IS NULL OR v_invoice.updated_at IS DISTINCT FROM p_expected_updated_at THEN
      RAISE EXCEPTION 'Die Rechnung wurde inzwischen geändert. Bitte aktualisieren und erneut prüfen.' USING ERRCODE='40001';
    END IF;
    IF NOT v_invoice.office_managed AND (p_operation<>'save_draft' OR v_invoice.status<>'draft' OR v_invoice.sent_at IS NOT NULL
      OR v_invoice.pdf_file_path IS NOT NULL OR EXISTS(SELECT 1 FROM public.payments WHERE tenant_id=p_tenant_id AND invoice_id=v_id)) THEN
      RAISE EXCEPTION 'Diese bestehende Rechnung bleibt unverändert. Nur unversendete Entwürfe können übernommen werden.';
    END IF;
  ELSIF p_operation<>'save_draft' OR p_expected_updated_at IS NOT NULL THEN
    RAISE EXCEPTION 'Rechnungskennung oder Bearbeitungsstand fehlt.';
  END IF;
  INSERT INTO care_security.office_invoice_write_context(transaction_id,tenant_id,invoice_id,actor_id)
    VALUES(txid_current(),p_tenant_id,v_id,auth.uid());

  IF p_operation='save_draft' THEN
    IF p_invoice_id IS NOT NULL AND (v_invoice.status<>'draft' OR v_invoice.issued_at IS NOT NULL
      OR v_invoice.sent_at IS NOT NULL OR v_invoice.pdf_file_path IS NOT NULL) THEN RAISE EXCEPTION 'Ausgestellte Rechnungen sind unveränderlich.'; END IF;
    SELECT * INTO v_client FROM public.clients WHERE tenant_id=p_tenant_id AND id=(p_payload->>'client_id')::uuid AND deleted_at IS NULL FOR SHARE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Die gewählte Klientenakte ist nicht verfügbar.'; END IF;
    FOREACH v_key IN ARRAY ARRAY['invoice_date','due_date','service_period_from','service_period_to'] LOOP
      IF coalesce(p_payload->>v_key,'') !~ '^\d{4}-\d{2}-\d{2}$' THEN RAISE EXCEPTION 'Ungültiges Rechnungsdatum: %.',v_key; END IF;
    END LOOP;
    v_date:=(p_payload->>'invoice_date')::date;v_due:=(p_payload->>'due_date')::date;
    v_start:=(p_payload->>'service_period_from')::date;v_end:=(p_payload->>'service_period_to')::date;
    IF v_due<v_date OR v_end<v_start OR v_date<'2000-01-01' OR v_date>'2100-12-31' THEN RAISE EXCEPTION 'Rechnungsdaten oder Leistungszeitraum sind ungültig.'; END IF;
    FOREACH v_key IN ARRAY ARRAY['recipient_name','recipient_street','recipient_postal_code','recipient_city','recipient_country'] LOOP
      IF nullif(btrim(p_payload->>v_key),'') IS NULL THEN RAISE EXCEPTION 'Die Empfängeranschrift ist unvollständig.'; END IF;
    END LOOP;
    FOREACH v_key IN ARRAY ARRAY['recipient_name','recipient_street','recipient_house_number','recipient_postal_code','recipient_city','recipient_country','recipient_email'] LOOP
      IF length(coalesce(p_payload->>v_key,''))>500 THEN RAISE EXCEPTION 'Eine Empfängerangabe ist zu lang.'; END IF;
    END LOOP;
    IF length(coalesce(p_payload->>'notes',''))>10000 OR length(coalesce(p_payload->>'footer_text',''))>10000
      OR (nullif(btrim(p_payload->>'recipient_email'),'') IS NOT NULL AND p_payload->>'recipient_email' !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$') THEN
      RAISE EXCEPTION 'Notiz, Rechnungstext oder E-Mail-Adresse ist ungültig.';
    END IF;
    IF jsonb_typeof(p_payload->'include_service_proofs') IS DISTINCT FROM 'boolean'
      OR jsonb_typeof(p_payload->'lines') IS DISTINCT FROM 'array' OR jsonb_array_length(p_payload->'lines') NOT BETWEEN 1 AND 500
      OR jsonb_typeof(coalesce(p_payload->'selected_proof_ids','[]')) IS DISTINCT FROM 'array' THEN
      RAISE EXCEPTION 'Rechnungspositionen oder Anlagenauswahl fehlen.';
    END IF;
    v_include:=(p_payload->>'include_service_proofs')::boolean;
    SELECT coalesce(array_agg(x),'{}') INTO v_proofs FROM jsonb_array_elements_text(coalesce(p_payload->'selected_proof_ids','[]')) x;
    -- Lock the union of retained and removed sources in stable order. Other
    -- invoice runs cannot claim any of these records between check and commit.
    SELECT coalesce(array_agg(DISTINCT (x->>'service_record_id')::uuid),'{}') INTO v_keys
      FROM jsonb_array_elements(p_payload->'lines') x WHERE nullif(x->>'service_record_id','') IS NOT NULL;
    -- Follow the existing workflow's assignment-before-source lock order.
    PERFORM 1 FROM public.assignments WHERE tenant_id=p_tenant_id AND id IN (
      SELECT assignment_id FROM public.service_records WHERE tenant_id=p_tenant_id
        AND (id=ANY(v_keys) OR billed_invoice_id=v_id OR ('record:'||id)=ANY(v_proofs))) ORDER BY id FOR SHARE;
    PERFORM 1 FROM public.service_records WHERE tenant_id=p_tenant_id
      AND (id=ANY(v_keys) OR billed_invoice_id=v_id OR ('record:'||id)=ANY(v_proofs)) ORDER BY id FOR UPDATE;
    IF cardinality(v_keys)<>(SELECT count(*) FROM jsonb_array_elements(p_payload->'lines') x WHERE nullif(x->>'service_record_id','') IS NOT NULL) THEN
      RAISE EXCEPTION 'Derselbe Leistungsnachweis ist mehrfach enthalten.';
    END IF;
    FOR v_line IN SELECT value FROM jsonb_array_elements(p_payload->'lines') LOOP
      IF jsonb_typeof(v_line) IS DISTINCT FROM 'object' OR nullif(btrim(v_line->>'description'),'') IS NULL
        OR length(v_line->>'description')>2000 OR nullif(btrim(v_line->>'unit'),'') IS NULL OR length(v_line->>'unit')>50
        OR coalesce(v_line->>'product_key','') NOT IN ('assist','pflege','stationaer','beratung') THEN RAISE EXCEPTION 'Eine Rechnungsposition ist unvollständig.'; END IF;
      FOREACH v_key IN ARRAY ARRAY['quantity','unit_price_cents','vat_rate'] LOOP
        IF jsonb_typeof(v_line->v_key) IS DISTINCT FROM 'number' OR v_line->>v_key !~ '^\d+(\.\d+)?$' THEN RAISE EXCEPTION 'Ein Positionsbetrag ist ungültig.'; END IF;
      END LOOP;
      v_quantity:=(v_line->>'quantity')::numeric;v_price:=(v_line->>'unit_price_cents')::numeric;v_rate:=(v_line->>'vat_rate')::numeric;
      IF v_quantity<=0 OR v_quantity>1000000 OR round(v_quantity,2)<>v_quantity OR v_price<0 OR v_price>100000000
        OR trunc(v_price)<>v_price OR v_rate<0 OR v_rate>100 OR round(v_rate,2)<>v_rate THEN
        RAISE EXCEPTION 'Menge, Einzelpreis oder Umsatzsteuersatz ist ungültig. Mengen dürfen zwei Nachkommastellen enthalten.';
      END IF;
      v_net:=round(v_quantity*v_price);v_tax:=round(v_net*v_rate/100);
      IF v_net+v_tax>9999999999 THEN RAISE EXCEPTION 'Der Positionsbetrag ist zu groß.'; END IF;
      v_service_date:=nullif(v_line->>'service_date','')::date;
      IF v_service_date IS NOT NULL AND v_service_date NOT BETWEEN v_start AND v_end THEN RAISE EXCEPTION 'Eine Leistung liegt außerhalb des Rechnungszeitraums.'; END IF;
      IF nullif(v_line->>'service_record_id','') IS NOT NULL THEN
        SELECT * INTO v_source FROM public.service_records WHERE tenant_id=p_tenant_id AND id=(v_line->>'service_record_id')::uuid;
        IF NOT FOUND OR v_source.client_id<>v_client.id OR v_source.service_date NOT BETWEEN v_start AND v_end
          OR (v_source.status::text NOT IN ('approved','billable') AND NOT (p_invoice_id IS NOT NULL AND NOT v_invoice.office_managed
            AND v_source.status::text='billed' AND v_source.billed_invoice_id=v_id))
          OR v_source.billed_invoice_id IS NOT NULL AND v_source.billed_invoice_id<>v_id
          OR v_source.updated_at IS DISTINCT FROM (v_line->>'source_updated_at')::timestamptz
          OR v_source.product_key::text IS DISTINCT FROM v_line->>'product_key' OR v_source.service_date IS DISTINCT FROM v_service_date
          OR v_source.total_amount IS NULL OR round(v_source.total_amount*100)<>v_net THEN
          RAISE EXCEPTION 'Ein Leistungsnachweis wurde geändert, ist bereits zugeordnet oder stimmt nicht mit der Rechnungsposition überein.' USING ERRCODE='40001';
        END IF;
        IF EXISTS(SELECT 1 FROM public.invoice_items i JOIN public.invoices parent ON parent.id=i.invoice_id
          WHERE i.service_record_id=v_source.id AND i.invoice_id<>v_id AND parent.status::text<>'cancelled') THEN
          RAISE EXCEPTION 'Dieser Leistungsnachweis ist bereits in einer anderen Rechnung enthalten.';
        END IF;
        PERFORM care_security.office_invoice_assert_source(v_source,true);
      END IF;
      v_line_id:=coalesce(nullif(v_line->>'id','')::uuid,gen_random_uuid());
      IF nullif(v_line->>'id','') IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.invoice_items WHERE tenant_id=p_tenant_id AND invoice_id=v_id AND id=v_line_id) THEN
        RAISE EXCEPTION 'Eine Rechnungsposition gehört nicht zu diesem Entwurf.';
      END IF;
      v_lines:=v_lines||jsonb_build_array(v_line||jsonb_build_object('id',v_line_id,'net_cents',v_net,'tax_cents',v_tax));
      v_subtotal:=v_subtotal+v_net;v_taxes:=v_taxes+v_tax;
    END LOOP;
    IF v_subtotal+v_taxes<=0 OR v_subtotal+v_taxes>9999999999 THEN RAISE EXCEPTION 'Die Rechnungssumme ist ungültig oder zu groß.'; END IF;
    IF p_invoice_id IS NULL THEN
      INSERT INTO public.invoices(id,tenant_id,invoice_number,client_id,status,invoice_date,office_managed,created_by,updated_by)
        VALUES(v_id,p_tenant_id,'DRAFT-'||v_id,v_client.id,'draft',v_date,true,v_actor,v_actor);
    END IF;
    UPDATE public.invoices SET office_managed=true,client_id=v_client.id,invoice_date=v_date,due_date=v_due,
      customer_snapshot=jsonb_build_object('id',v_client.id,'name',concat_ws(' ',v_client.first_name,v_client.last_name),
        'clientNumber',coalesce(v_client.client_number,''),'insuranceNumber',coalesce(v_client.insurance_number,'')),
      service_month=date_trunc('month',v_start)::date,service_period_from=v_start,service_period_to=v_end,
      recipient_type=coalesce(nullif(p_payload->>'recipient_type',''),CASE v_client.billing_party::text WHEN 'self_payer' THEN 'client' WHEN 'care_insurance' THEN 'care_insurance' WHEN 'health_insurance' THEN 'health_insurance' WHEN 'social_welfare' THEN 'social_welfare' ELSE 'other' END)::public.invoice_recipient_type,
      billing_party=coalesce(nullif(p_payload->>'billing_party',''),v_client.billing_party::text,'other')::public.billing_party,
      recipient_name=btrim(p_payload->>'recipient_name'),recipient_street=btrim(p_payload->>'recipient_street'),
      recipient_house_number=nullif(btrim(p_payload->>'recipient_house_number'),''),recipient_postal_code=btrim(p_payload->>'recipient_postal_code'),
      recipient_city=btrim(p_payload->>'recipient_city'),recipient_country=btrim(p_payload->>'recipient_country'),recipient_email=nullif(btrim(p_payload->>'recipient_email'),''),
      notes=nullif(btrim(p_payload->>'notes'),''),footer_text=nullif(btrim(p_payload->>'footer_text'),''),
      include_service_proofs=v_include,selected_proof_ids=v_proofs,subtotal_amount=v_subtotal/100,vat_amount=v_taxes/100,
      total_amount=(v_subtotal+v_taxes)/100,paid_amount=0,open_amount=(v_subtotal+v_taxes)/100,updated_by=v_actor
      WHERE id=v_id AND tenant_id=p_tenant_id RETURNING * INTO v_invoice;
    PERFORM care_security.office_invoice_proofs(v_invoice);
    UPDATE public.service_records SET billed_invoice_id=NULL,status=CASE WHEN status='billed' THEN 'billable'::public.service_record_status ELSE status END
      WHERE tenant_id=p_tenant_id AND billed_invoice_id=v_id AND NOT id=ANY(v_keys);
    DELETE FROM public.invoice_items WHERE tenant_id=p_tenant_id AND invoice_id=v_id;
    FOR v_line IN SELECT value FROM jsonb_array_elements(v_lines) LOOP
      INSERT INTO public.invoice_items(id,tenant_id,invoice_id,description,quantity,unit,unit_price,vat_rate,net_amount,vat_amount,gross_amount,
        product_key,service_date,service_record_id,sort_order)
      VALUES((v_line->>'id')::uuid,p_tenant_id,v_id,btrim(v_line->>'description'),(v_line->>'quantity')::numeric,btrim(v_line->>'unit'),
        (v_line->>'unit_price_cents')::numeric/100,(v_line->>'vat_rate')::numeric,(v_line->>'net_cents')::numeric/100,
        (v_line->>'tax_cents')::numeric/100,((v_line->>'net_cents')::numeric+(v_line->>'tax_cents')::numeric)/100,
        (v_line->>'product_key')::public.product_key,nullif(v_line->>'service_date','')::date,nullif(v_line->>'service_record_id','')::uuid,v_sort);
      v_sort:=v_sort+1;
    END LOOP;
    UPDATE public.service_records SET billed_invoice_id=v_id,status=CASE WHEN status='billed' THEN 'billable'::public.service_record_status ELSE status END
      WHERE tenant_id=p_tenant_id AND id=ANY(v_keys) AND (billed_invoice_id IS NULL OR status='billed');

  ELSIF p_operation='delete_draft' THEN
    IF v_invoice.status<>'draft' OR v_invoice.issued_at IS NOT NULL OR v_invoice.pdf_file_path IS NOT NULL
      OR EXISTS(SELECT 1 FROM public.payments WHERE tenant_id=p_tenant_id AND invoice_id=v_id) THEN RAISE EXCEPTION 'Nur unversendete Rechnungsentwürfe ohne Zahlungen dürfen gelöscht werden.'; END IF;
    PERFORM 1 FROM public.service_records WHERE tenant_id=p_tenant_id AND billed_invoice_id=v_id ORDER BY id FOR UPDATE;
    UPDATE public.service_records SET billed_invoice_id=NULL WHERE tenant_id=p_tenant_id AND billed_invoice_id=v_id;
    DELETE FROM public.invoices WHERE tenant_id=p_tenant_id AND id=v_id;

  ELSIF p_operation='set_status' THEN
    v_status:=p_payload->>'status';
    IF v_status='ready' THEN
      IF v_invoice.status<>'draft' OR v_invoice.issued_at IS NOT NULL THEN RAISE EXCEPTION 'Nur Entwürfe können freigegeben werden.'; END IF;
      PERFORM 1 FROM public.assignments WHERE tenant_id=p_tenant_id AND id IN (
        SELECT assignment_id FROM public.service_records WHERE tenant_id=p_tenant_id
          AND (billed_invoice_id=v_id OR ('record:'||id)=ANY(v_invoice.selected_proof_ids))) ORDER BY id FOR SHARE;
      PERFORM 1 FROM public.service_records WHERE tenant_id=p_tenant_id AND (billed_invoice_id=v_id OR ('record:'||id)=ANY(v_invoice.selected_proof_ids)) ORDER BY id FOR UPDATE;
      PERFORM 1 FROM public.tenant_billing_settings WHERE tenant_id=p_tenant_id FOR UPDATE;
      PERFORM 1 FROM public.tenants WHERE id=p_tenant_id FOR SHARE;
      PERFORM 1 FROM public.tenant_bank_accounts WHERE tenant_id=p_tenant_id ORDER BY id FOR SHARE;
      PERFORM 1 FROM public.tenant_branding WHERE tenant_id=p_tenant_id FOR SHARE;
      v_preview:=care_security.office_invoice_issue_preview(p_tenant_id,v_id,p_expected_updated_at);
      IF p_payload->>'invoice_number' IS DISTINCT FROM v_preview->>'invoice_number'
        OR p_payload->>'source_revision' IS DISTINCT FROM v_preview->>'source_revision'
        OR p_payload->'company_snapshot' IS DISTINCT FROM v_preview->'company_snapshot' THEN
        RAISE EXCEPTION 'Rechnungsnummer oder Rechnungsdaten wurden inzwischen geändert. Bitte die Vorschau erneut erstellen.' USING ERRCODE='40001';
      END IF;
      IF coalesce(p_payload->>'pdf_sha256','') !~ '^[0-9a-f]{64}$'
        OR p_payload->>'pdf_file_path' IS DISTINCT FROM 'tenant/'||p_tenant_id||'/generated/invoice-'||v_id||'/'||(p_payload->>'pdf_sha256')||'.pdf'
        OR NOT EXISTS(SELECT 1 FROM public.document_render_jobs WHERE tenant_id=p_tenant_id AND related_entity_table='invoices'
          AND related_entity_id=v_id AND job_status='completed' AND pdf_path=p_payload->>'pdf_file_path' AND created_by=v_actor)
        OR NOT EXISTS(SELECT 1 FROM storage.objects WHERE bucket_id='office-documents' AND name=p_payload->>'pdf_file_path'
          AND metadata->>'mimetype'='application/pdf' AND coalesce((metadata->>'size')::bigint,0)>0) THEN
        RAISE EXCEPTION 'Die fertige Rechnungs-PDF wurde nicht vollständig und unveränderlich gespeichert.';
      END IF;
      UPDATE public.tenant_billing_settings SET next_invoice_number=(v_preview->>'next_invoice_number')::integer WHERE tenant_id=p_tenant_id;
      UPDATE public.invoices SET status='ready',invoice_number=v_preview->>'invoice_number',payment_reference=v_preview->>'invoice_number',
        company_snapshot=v_preview->'company_snapshot',issued_snapshot=v_preview->'snapshot',issued_at=v_now,
        pdf_file_path=p_payload->>'pdf_file_path',pdf_sha256=p_payload->>'pdf_sha256',updated_by=v_actor
        WHERE tenant_id=p_tenant_id AND id=v_id RETURNING * INTO v_invoice;
      UPDATE public.service_records SET status='billed' WHERE tenant_id=p_tenant_id AND billed_invoice_id=v_id;
    ELSIF v_status='sent' THEN
      IF v_invoice.status<>'ready' OR v_invoice.issued_at IS NULL OR v_invoice.pdf_file_path IS NULL
        OR coalesce(p_payload->>'delivery_channel','') NOT IN ('email','post','personal','other')
        OR coalesce(p_payload->>'delivery_date','') !~ '^\d{4}-\d{2}-\d{2}$'
        OR length(btrim(coalesce(p_payload->>'delivery_reference',''))) NOT BETWEEN 3 AND 500 THEN
        RAISE EXCEPTION 'Bitte den tatsächlichen Versand der ausgestellten Rechnung mit Datum, Versandweg und Referenz belegen.';
      END IF;
      v_date:=(p_payload->>'delivery_date')::date;
      IF v_date<(v_invoice.issued_at AT TIME ZONE 'Europe/Berlin')::date OR v_date>(clock_timestamp() AT TIME ZONE 'Europe/Berlin')::date THEN RAISE EXCEPTION 'Das Versanddatum ist ungültig.'; END IF;
      UPDATE public.invoices SET status='sent',sent_at=(v_date::timestamp AT TIME ZONE 'Europe/Berlin'),
        delivery_evidence=jsonb_build_object('channel',p_payload->>'delivery_channel','date',v_date,'reference',btrim(p_payload->>'delivery_reference'),'recorded_by',auth.uid(),'recorded_at',v_now),
        updated_by=v_actor WHERE tenant_id=p_tenant_id AND id=v_id RETURNING * INTO v_invoice;
    ELSIF v_status='cancelled' AND v_invoice.status='draft' AND v_invoice.issued_at IS NULL THEN
      IF length(btrim(coalesce(p_payload->>'reason',''))) NOT BETWEEN 5 AND 10000 THEN RAISE EXCEPTION 'Bitte einen nachvollziehbaren Stornogrund angeben.'; END IF;
      PERFORM 1 FROM public.service_records WHERE tenant_id=p_tenant_id AND billed_invoice_id=v_id ORDER BY id FOR UPDATE;
      UPDATE public.service_records SET billed_invoice_id=NULL WHERE tenant_id=p_tenant_id AND billed_invoice_id=v_id;
      UPDATE public.invoices SET status='cancelled',cancelled_at=v_now,cancellation_reason=btrim(p_payload->>'reason'),open_amount=0,updated_by=v_actor
        WHERE tenant_id=p_tenant_id AND id=v_id RETURNING * INTO v_invoice;
    ELSE
      RAISE EXCEPTION 'Dieser Statuswechsel ist nicht erlaubt. Ausgestellte Rechnungen bleiben unveränderlich; Zahlungen werden über Zahlungseingänge gebucht.';
    END IF;

  ELSIF p_operation='record_payment' THEN
    IF v_invoice.status::text NOT IN ('ready','sent','partly_paid','overdue') OR v_invoice.issued_at IS NULL OR v_invoice.pdf_file_path IS NULL THEN
      RAISE EXCEPTION 'Zahlungen können nur auf ausgestellte, offene Rechnungen gebucht werden.';
    END IF;
    IF jsonb_typeof(p_payload->'amount_cents') IS DISTINCT FROM 'number' OR coalesce(p_payload->>'amount_cents','') !~ '^\d+$'
      OR coalesce(p_payload->>'payment_date','') !~ '^\d{4}-\d{2}-\d{2}$'
      OR coalesce(p_payload->>'payment_method','') NOT IN ('bank_transfer','direct_debit','cash','card','paypal','stripe','other')
      OR length(btrim(coalesce(p_payload->>'reference',''))) NOT BETWEEN 1 AND 500 OR length(coalesce(p_payload->>'notes',''))>10000 THEN
      RAISE EXCEPTION 'Zahlungsbetrag, Zahlungsdatum, Zahlungsart oder Buchungsreferenz ist ungültig.';
    END IF;
    v_amount:=(p_payload->>'amount_cents')::numeric;v_payment_date:=(p_payload->>'payment_date')::date;
    IF v_amount<=0 OR v_amount>9999999999 OR v_payment_date>(clock_timestamp() AT TIME ZONE 'Europe/Berlin')::date
      OR v_payment_date<'2000-01-01' THEN RAISE EXCEPTION 'Der Zahlungseingang ist ungültig oder liegt in der Zukunft.'; END IF;
    PERFORM 1 FROM public.payments WHERE tenant_id=p_tenant_id AND invoice_id=v_id ORDER BY id FOR UPDATE;
    IF EXISTS(SELECT 1 FROM public.payments WHERE tenant_id=p_tenant_id AND invoice_id=v_id AND status::text IN ('booked','matched')
      AND payment_date=v_payment_date AND amount=v_amount/100 AND reference=btrim(p_payload->>'reference')) THEN
      RAISE EXCEPTION 'Dieser Zahlungseingang ist bereits gebucht. Bitte die Zahlungsübersicht prüfen.';
    END IF;
    SELECT coalesce(sum(amount),0) INTO v_paid FROM public.payments WHERE tenant_id=p_tenant_id AND invoice_id=v_id AND status::text IN ('booked','matched') AND currency='EUR';
    IF v_paid*100+v_amount>v_invoice.total_amount*100 THEN RAISE EXCEPTION 'Der Zahlungseingang übersteigt den offenen Rechnungsbetrag.'; END IF;
    INSERT INTO public.payments(tenant_id,invoice_id,client_id,payment_date,amount,currency,status,payment_method,reference,notes,matched_at,matched_by)
      VALUES(p_tenant_id,v_id,v_invoice.client_id,v_payment_date,v_amount/100,'EUR','matched',(p_payload->>'payment_method')::public.payment_method,
        btrim(p_payload->>'reference'),nullif(btrim(p_payload->>'notes'),''),v_now,v_actor);
    SELECT coalesce(sum(amount),0) INTO v_paid FROM public.payments WHERE tenant_id=p_tenant_id AND invoice_id=v_id AND status::text IN ('booked','matched') AND currency='EUR';
    UPDATE public.invoices SET paid_amount=v_paid,open_amount=total_amount-v_paid,
      status=CASE WHEN v_paid=total_amount THEN 'paid'::public.invoice_status ELSE 'partly_paid'::public.invoice_status END,
      paid_at=CASE WHEN v_paid=total_amount THEN v_now ELSE NULL END,updated_by=v_actor
      WHERE tenant_id=p_tenant_id AND id=v_id RETURNING * INTO v_invoice;
  END IF;
  v_result:=jsonb_build_object('invoice_id',v_id,'updated_at',CASE WHEN p_operation='delete_draft' THEN v_now ELSE v_invoice.updated_at END);
  INSERT INTO care_security.office_invoice_requests(tenant_id,request_id,actor_id,request_hash,invoice_id,operation,result)
    VALUES(p_tenant_id,p_request_id,auth.uid(),v_hash,v_id,p_operation,v_result);
  DELETE FROM care_security.office_invoice_write_context WHERE transaction_id=txid_current() AND tenant_id=p_tenant_id AND invoice_id=v_id;
  RETURN v_result;
END
$body$;
REVOKE ALL ON FUNCTION care_security.office_invoice_mutation(uuid,uuid,uuid,timestamptz,text,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION care_security.office_invoice_mutation(uuid,uuid,uuid,timestamptz,text,jsonb) TO authenticated;
CREATE OR REPLACE FUNCTION public.office_invoice_mutation(
  p_tenant_id uuid,p_request_id uuid,p_invoice_id uuid,p_expected_updated_at timestamptz,p_operation text,p_payload jsonb)
RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path=pg_catalog AS $body$
  SELECT care_security.office_invoice_mutation(p_tenant_id,p_request_id,p_invoice_id,p_expected_updated_at,p_operation,p_payload)
$body$;
REVOKE ALL ON FUNCTION public.office_invoice_mutation(uuid,uuid,uuid,timestamptz,text,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.office_invoice_mutation(uuid,uuid,uuid,timestamptz,text,jsonb) TO authenticated;

-- Keep the existing generated-document and payroll exceptions. The invoice
-- exception grants access only to the exact original referenced by the invoice.
DROP POLICY IF EXISTS care_security_generated_pdf_read ON storage.objects;
CREATE POLICY care_security_generated_pdf_read ON storage.objects AS RESTRICTIVE FOR SELECT TO authenticated
  USING (bucket_id<>'office-documents' OR (storage.foldername(name))[1] IS DISTINCT FROM 'tenant'
    OR (storage.foldername(name))[3] IS DISTINCT FROM 'generated' OR care_security.generated_pdf_reader(name)
    OR (care_security.office_actor(public.current_tenant_id(),'office.employees.view') AND EXISTS(
      SELECT 1 FROM public.payroll_month_statements s WHERE s.tenant_id=public.current_tenant_id() AND s.pdf_path=name))
    OR (care_security.office_actor(public.current_tenant_id(),'office.invoices.view') AND EXISTS(
      SELECT 1 FROM public.invoices i WHERE i.tenant_id=public.current_tenant_id() AND i.office_managed AND i.pdf_file_path=name)));

COMMIT;
