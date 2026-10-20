-- CareSuite+ ambulant: S-07 — unveränderliche Korrektur statt Überschreiben eines Leistungsnachweises.
-- Der Originalnachweis, seine Bestätigung und sein Abrechnungsstand bleiben erhalten.

CREATE TABLE IF NOT EXISTS public.pfleger_service_proof_corrections (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
 client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE RESTRICT,
 root_proof_id uuid NOT NULL REFERENCES public.pfleger_service_proofs(id) ON DELETE RESTRICT,
 source_proof_id uuid NOT NULL UNIQUE REFERENCES public.pfleger_service_proofs(id) ON DELETE RESTRICT,
 replacement_proof_id uuid NOT NULL UNIQUE REFERENCES public.pfleger_service_proofs(id) ON DELETE RESTRICT,
 previous_correction_id uuid REFERENCES public.pfleger_service_proof_corrections(id) ON DELETE RESTRICT,
 correction_no integer NOT NULL CHECK(correction_no>0),
 reason text NOT NULL CHECK(length(btrim(reason)) BETWEEN 10 AND 2000),
 source_proof_snapshot jsonb NOT NULL,
 replacement_proof_snapshot jsonb NOT NULL,
 source_signature_evidence_id uuid REFERENCES public.pfleger_signature_evidence(id) ON DELETE RESTRICT,
 source_signature_snapshot jsonb,
 source_confirmation_id uuid REFERENCES public.pfleger_proof_client_confirmations(id) ON DELETE RESTRICT,
 source_confirmation_snapshot jsonb,
 source_billing_case_id uuid REFERENCES public.pfleger_billing_cases(id) ON DELETE RESTRICT,
 source_billing_status text NOT NULL CHECK(source_billing_status IN('none','pending','blocked','ready','released','invoiced','cancelled')),
 source_invoice_foundation_id uuid REFERENCES public.pfleger_invoice_foundations(id) ON DELETE RESTRICT,
 source_billing_snapshot jsonb,
 created_by uuid NOT NULL REFERENCES auth.users(id),
 created_by_name text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 client_request_id uuid NOT NULL,
 request_fingerprint text NOT NULL CHECK(request_fingerprint~'^[0-9a-f]{32}$'),
 UNIQUE(tenant_id,root_proof_id,correction_no),
 UNIQUE(tenant_id,client_request_id)
);
ALTER TABLE public.pfleger_service_proof_corrections ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.pfleger_service_proof_corrections FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.pfleger_service_proof_corrections TO authenticated;
DROP POLICY IF EXISTS pfleger_service_proof_corrections_read ON public.pfleger_service_proof_corrections;
CREATE POLICY pfleger_service_proof_corrections_read ON public.pfleger_service_proof_corrections FOR SELECT TO authenticated
 USING(tenant_id=public.current_tenant_id() AND public.has_permission('pflege.proofs.view'));

CREATE OR REPLACE FUNCTION care_private.protect_proof_correction_history() RETURNS trigger
 LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 RAISE EXCEPTION 'Korrekturhistorien sind unveränderlich.' USING ERRCODE='42501';
END $$;
DROP TRIGGER IF EXISTS protect_proof_correction_history ON public.pfleger_service_proof_corrections;
CREATE TRIGGER protect_proof_correction_history BEFORE UPDATE OR DELETE ON public.pfleger_service_proof_corrections
 FOR EACH ROW EXECUTE FUNCTION care_private.protect_proof_correction_history();

CREATE OR REPLACE FUNCTION care_private.prevent_duplicate_corrected_proof_billing() RETURNS trigger
 LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE root_id uuid;
BEGIN
 IF NEW.status='cancelled' THEN RETURN NEW; END IF;
 SELECT c.root_proof_id INTO root_id FROM public.pfleger_service_proof_corrections c
  WHERE c.tenant_id=NEW.tenant_id AND (c.replacement_proof_id=NEW.service_proof_id OR c.source_proof_id=NEW.service_proof_id)
  ORDER BY c.correction_no DESC LIMIT 1;
 root_id:=COALESCE(root_id,NEW.service_proof_id);
 IF EXISTS(
  SELECT 1 FROM public.pfleger_billing_cases b
  WHERE b.tenant_id=NEW.tenant_id AND b.id IS DISTINCT FROM NEW.id AND b.status<>'cancelled'
   AND (b.service_proof_id=root_id OR b.service_proof_id IN(
    SELECT c.replacement_proof_id FROM public.pfleger_service_proof_corrections c
    WHERE c.tenant_id=NEW.tenant_id AND c.root_proof_id=root_id
   ))
 ) THEN
  RAISE EXCEPTION 'Für diese Nachweisfamilie besteht bereits ein aktiver Abrechnungsfall.' USING ERRCODE='40001';
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS prevent_duplicate_corrected_proof_billing ON public.pfleger_billing_cases;
CREATE TRIGGER prevent_duplicate_corrected_proof_billing BEFORE INSERT OR UPDATE OF service_proof_id,status
 ON public.pfleger_billing_cases FOR EACH ROW EXECUTE FUNCTION care_private.prevent_duplicate_corrected_proof_billing();

CREATE OR REPLACE FUNCTION care_private.correct_service_proof(
 p_proof_id uuid,p_expected_proof_updated_at timestamptz,p_reason text,
 p_performance_note text,p_deviations text,p_request_id uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE t uuid:=public.current_tenant_id(); source public.pfleger_service_proofs; replacement public.pfleger_service_proofs;
 existing public.pfleger_service_proof_corrections; previous public.pfleger_service_proof_corrections;
 signature_row public.pfleger_signature_evidence; confirmation_row public.pfleger_proof_client_confirmations;
 billing_row public.pfleger_billing_cases; root_id uuid; correction_id uuid:=gen_random_uuid(); correction_no integer;
 actual_time timestamptz:=clock_timestamp(); reason text:=btrim(COALESCE(p_reason,''));
 performance_note text:=btrim(COALESCE(p_performance_note,'')); deviations text:=btrim(COALESCE(p_deviations,''));
 fingerprint text; actor_name text;
BEGIN
 IF auth.uid() IS NULL OR t IS NULL OR NOT public.has_permission('pflege.proofs.review') THEN
  RAISE EXCEPTION 'Keine Berechtigung.' USING ERRCODE='42501';
 END IF;
 IF p_request_id IS NULL OR p_expected_proof_updated_at IS NULL OR length(reason) NOT BETWEEN 10 AND 2000
  OR length(performance_note) NOT BETWEEN 5 AND 4000 OR length(deviations)>2000 THEN
  RAISE EXCEPTION 'Grund und vollständiger korrigierter Durchführungsnachweis sind erforderlich.' USING ERRCODE='23514';
 END IF;
 fingerprint:=md5(jsonb_build_object('proofId',p_proof_id,'expectedProofUpdatedAt',p_expected_proof_updated_at,
  'reason',reason,'performanceNote',performance_note,'deviations',deviations)::text);
 SELECT * INTO existing FROM public.pfleger_service_proof_corrections WHERE tenant_id=t AND client_request_id=p_request_id;
 IF FOUND THEN
  IF existing.source_proof_id IS DISTINCT FROM p_proof_id OR existing.created_by IS DISTINCT FROM auth.uid()
   OR existing.request_fingerprint IS DISTINCT FROM fingerprint THEN
   RAISE EXCEPTION 'Diese Korrekturanfrage wurde bereits mit anderen Angaben verwendet.' USING ERRCODE='40001';
  END IF;
  RETURN jsonb_build_object('id',existing.id,'sourceProofId',existing.source_proof_id,
   'replacementProofId',existing.replacement_proof_id,'duplicate',true);
 END IF;
 SELECT * INTO source FROM public.pfleger_service_proofs WHERE id=p_proof_id AND tenant_id=t FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Leistungsnachweis nicht gefunden.' USING ERRCODE='42501'; END IF;
 IF source.updated_at IS DISTINCT FROM p_expected_proof_updated_at THEN
  RAISE EXCEPTION 'Der Leistungsnachweis wurde zwischenzeitlich geändert. Bitte neu laden.' USING ERRCODE='40001';
 END IF;
 IF source.status='cancelled' OR EXISTS(SELECT 1 FROM public.pfleger_service_proof_corrections c WHERE c.source_proof_id=source.id) THEN
  RAISE EXCEPTION 'Diese Nachweisfassung wurde bereits ersetzt oder storniert.' USING ERRCODE='40001';
 END IF;
 IF performance_note=source.performance_note AND deviations=source.deviations THEN
  RAISE EXCEPTION 'Die neue Fassung muss sich in Durchführung oder Abweichung vom Original unterscheiden.' USING ERRCODE='23514';
 END IF;
 SELECT * INTO billing_row FROM public.pfleger_billing_cases WHERE tenant_id=t AND service_proof_id=source.id FOR UPDATE;
 IF FOUND AND (billing_row.status='invoiced' OR billing_row.invoice_foundation_id IS NOT NULL) THEN
  RAISE EXCEPTION 'Bereits in eine Rechnungsgrundlage übernommene Nachweise benötigen einen gesonderten Stornoablauf.' USING ERRCODE='23514';
 END IF;
 SELECT * INTO previous FROM public.pfleger_service_proof_corrections c WHERE c.tenant_id=t AND c.replacement_proof_id=source.id FOR UPDATE;
 root_id:=CASE WHEN FOUND THEN previous.root_proof_id ELSE source.id END;
 correction_no:=CASE WHEN previous.id IS NULL THEN 1 ELSE previous.correction_no+1 END;
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(t::text||':proof-correction:'||root_id::text,0));
 SELECT * INTO signature_row FROM public.pfleger_signature_evidence e WHERE e.tenant_id=t AND e.proof_id=source.id;
 SELECT * INTO confirmation_row FROM public.pfleger_proof_client_confirmations c WHERE c.tenant_id=t AND c.proof_id=source.id;
 actor_name:=COALESCE(NULLIF(public.clinical_actor_name(),''),'Unbekannt');
 INSERT INTO public.pfleger_service_proofs(
  tenant_id,client_id,documentation_entry_id,service_date,started_at,ended_at,duration_minutes,service_code,service_label,
  legal_basis,prescription_reference,cost_carrier_name,cost_carrier_ik,billing_unit,quantity,unit_price_cents,gross_amount_cents,
  performance_note,deviations,employee_profile_id,employee_name_snapshot,client_signature_name,client_signed_at,signature_ref,
  status,rejection_reason,reviewed_by,reviewed_by_name,reviewed_at,evidence_snapshot,created_at,updated_at,tariff_id,admission_id)
 VALUES(t,source.client_id,source.documentation_entry_id,source.service_date,source.started_at,source.ended_at,source.duration_minutes,
  source.service_code,source.service_label,source.legal_basis,source.prescription_reference,source.cost_carrier_name,source.cost_carrier_ik,
  source.billing_unit,source.quantity,source.unit_price_cents,source.gross_amount_cents,performance_note,deviations,
  source.employee_profile_id,source.employee_name_snapshot,'',NULL,'','draft','',NULL,'',NULL,
  source.evidence_snapshot||jsonb_build_object('correctionOf',source.id,'correctionRoot',root_id,'correctionNo',correction_no,
   'correctionReason',reason,'serverCreatedAt',actual_time),actual_time,actual_time,source.tariff_id,source.admission_id)
 RETURNING * INTO replacement;
 INSERT INTO public.pfleger_service_proof_corrections(
  id,tenant_id,client_id,root_proof_id,source_proof_id,replacement_proof_id,previous_correction_id,correction_no,reason,
  source_proof_snapshot,replacement_proof_snapshot,source_signature_evidence_id,source_signature_snapshot,
  source_confirmation_id,source_confirmation_snapshot,source_billing_case_id,source_billing_status,
  source_invoice_foundation_id,source_billing_snapshot,created_by,created_by_name,created_at,client_request_id,request_fingerprint)
 VALUES(correction_id,t,source.client_id,root_id,source.id,replacement.id,previous.id,correction_no,reason,to_jsonb(source),to_jsonb(replacement),
  signature_row.id,CASE WHEN signature_row.id IS NULL THEN NULL ELSE to_jsonb(signature_row) END,
  confirmation_row.id,CASE WHEN confirmation_row.id IS NULL THEN NULL ELSE to_jsonb(confirmation_row) END,
  billing_row.id,COALESCE(billing_row.status,'none'),billing_row.invoice_foundation_id,
  CASE WHEN billing_row.id IS NULL THEN NULL ELSE to_jsonb(billing_row) END,auth.uid(),actor_name,actual_time,p_request_id,fingerprint);
 IF billing_row.id IS NOT NULL THEN
  UPDATE public.pfleger_billing_cases SET status='cancelled',blocker_reason='Durch unveränderliche Nachweiskorrektur ersetzt.',updated_at=actual_time
   WHERE id=billing_row.id;
 END IF;
 UPDATE public.pfleger_service_proofs SET status='cancelled',updated_at=actual_time WHERE id=source.id;
 UPDATE public.care_tour_stops SET service_proof_id=replacement.id,updated_at=actual_time
  WHERE tenant_id=t AND service_proof_id=source.id;
 INSERT INTO public.care_audit_events(tenant_id,client_id,entity_type,entity_id,action,summary,before_data,after_data,actor_id,actor_name)
 VALUES(t,source.client_id,'pflege_service_proof_correction',correction_id,'created',
  'Originalnachweis unverändert archiviert und neue unbestätigte Fassung angelegt.',to_jsonb(source),to_jsonb(replacement),auth.uid(),actor_name);
 RETURN jsonb_build_object('id',correction_id,'sourceProofId',source.id,'replacementProofId',replacement.id,'duplicate',false);
END $$;

CREATE OR REPLACE FUNCTION public.correct_pfleger_service_proof(
 p_proof_id uuid,p_expected_proof_updated_at timestamptz,p_reason text,p_performance_note text,p_deviations text,p_request_id uuid
) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$
 SELECT care_private.correct_service_proof(p_proof_id,p_expected_proof_updated_at,p_reason,p_performance_note,p_deviations,p_request_id)
$$;
REVOKE ALL ON FUNCTION care_private.correct_service_proof(uuid,timestamptz,text,text,text,uuid),
 public.correct_pfleger_service_proof(uuid,timestamptz,text,text,text,uuid),
 care_private.protect_proof_correction_history(),care_private.prevent_duplicate_corrected_proof_billing() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION care_private.correct_service_proof(uuid,timestamptz,text,text,text,uuid),
 public.correct_pfleger_service_proof(uuid,timestamptz,text,text,text,uuid) TO authenticated;
