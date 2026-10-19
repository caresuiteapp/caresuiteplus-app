-- CareSuite+ ambulant: S-05 — mehrere getrennte Leistungspositionen je Einsatz.
-- Jede Position bleibt ein eigener Leistungsnachweis mit eigener Menge, Einheit,
-- Finanzierung, gegebenenfalls Verordnung und tatsächlichem Durchführungsdetail.

-- Der Tarifkatalog führt `unit` als native Abrechnungseinheit. Die ältere
-- Nachweistabelle kannte nur `flat`; beide historischen Werte bleiben gültig.
ALTER TABLE public.pfleger_service_proofs DROP CONSTRAINT IF EXISTS pfleger_service_proofs_billing_unit_check;
ALTER TABLE public.pfleger_service_proofs ADD CONSTRAINT pfleger_service_proofs_billing_unit_check
 CHECK(billing_unit IN('minute','hour','visit','flat','unit'));

CREATE TABLE IF NOT EXISTS public.care_tour_stop_proof_batches (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
 tour_id uuid NOT NULL REFERENCES public.care_tours(id) ON DELETE RESTRICT,
 stop_id uuid NOT NULL UNIQUE REFERENCES public.care_tour_stops(id) ON DELETE RESTRICT,
 client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE RESTRICT,
 client_request_id uuid NOT NULL, request_fingerprint text NOT NULL,
 created_by uuid NOT NULL, created_by_name text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(tenant_id,client_request_id)
);
CREATE TABLE IF NOT EXISTS public.care_tour_stop_proof_lines (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
 batch_id uuid NOT NULL REFERENCES public.care_tour_stop_proof_batches(id) ON DELETE RESTRICT,
 tour_id uuid NOT NULL REFERENCES public.care_tours(id) ON DELETE RESTRICT,
 stop_id uuid NOT NULL REFERENCES public.care_tour_stops(id) ON DELETE RESTRICT,
 client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE RESTRICT,
 position_no integer NOT NULL CHECK(position_no BETWEEN 1 AND 50),
 proof_id uuid NOT NULL UNIQUE REFERENCES public.pfleger_service_proofs(id) ON DELETE RESTRICT,
 tariff_id uuid NOT NULL REFERENCES public.care_tariffs(id) ON DELETE RESTRICT,
 admission_id uuid NOT NULL REFERENCES public.care_admissions(id) ON DELETE RESTRICT,
 order_id uuid REFERENCES public.care_medical_orders(id) ON DELETE RESTRICT,
 quantity numeric(12,3) NOT NULL CHECK(quantity>0 AND quantity<=99999),
 billing_unit text NOT NULL CHECK(billing_unit IN('visit','minute','hour','unit')),
 legal_basis text NOT NULL CHECK(legal_basis IN('sgb_xi','sgb_v','private')),
 execution_detail text NOT NULL CHECK(length(btrim(execution_detail)) BETWEEN 5 AND 4000),
 deviation text NOT NULL DEFAULT '' CHECK(length(deviation)<=2000),
 tariff_snapshot jsonb NOT NULL, admission_snapshot jsonb NOT NULL, order_snapshot jsonb,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(batch_id,position_no)
);
ALTER TABLE public.care_tour_stop_proof_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.care_tour_stop_proof_lines ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.care_tour_stop_proof_batches,public.care_tour_stop_proof_lines FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.care_tour_stop_proof_batches,public.care_tour_stop_proof_lines TO authenticated;
DROP POLICY IF EXISTS care_stop_proof_batches_read ON public.care_tour_stop_proof_batches;
CREATE POLICY care_stop_proof_batches_read ON public.care_tour_stop_proof_batches FOR SELECT TO authenticated
 USING(tenant_id=public.current_tenant_id() AND public.has_permission('pflege.proofs.view'));
DROP POLICY IF EXISTS care_stop_proof_lines_read ON public.care_tour_stop_proof_lines;
CREATE POLICY care_stop_proof_lines_read ON public.care_tour_stop_proof_lines FOR SELECT TO authenticated
 USING(tenant_id=public.current_tenant_id() AND public.has_permission('pflege.proofs.view'));

CREATE OR REPLACE FUNCTION care_private.create_stop_proof_batch(
 p_stop_id uuid,p_expected_stop_updated_at timestamptz,p_lines jsonb,p_request_id uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' SET timezone='Europe/Berlin' AS $$
DECLARE t uuid:=care_private.assert_operations_actor('pflege.proofs.create'); s public.care_tour_stops; tr public.care_tours;
 existing public.care_tour_stop_proof_batches; batch_id uuid:=gen_random_uuid(); fingerprint text; line jsonb; pos integer:=0;
 proof public.pfleger_service_proofs; price public.care_tariffs; admission public.care_admissions; ord public.care_medical_orders;
 first_proof uuid; proof_ids jsonb:='[]'::jsonb; actual_time timestamptz:=clock_timestamp(); actor_name text;
BEGIN
 IF p_request_id IS NULL OR p_expected_stop_updated_at IS NULL OR jsonb_typeof(p_lines) IS DISTINCT FROM 'array'
  OR jsonb_array_length(p_lines) NOT BETWEEN 2 AND 50 THEN
  RAISE EXCEPTION 'Zwei bis fünfzig vollständige Leistungspositionen sind erforderlich.' USING ERRCODE='23514';
 END IF;
 fingerprint:=md5(jsonb_build_object('stopId',p_stop_id,'expectedUpdatedAt',p_expected_stop_updated_at,'lines',p_lines)::text);
 SELECT * INTO existing FROM public.care_tour_stop_proof_batches WHERE tenant_id=t AND client_request_id=p_request_id;
 IF FOUND THEN
  IF existing.stop_id IS DISTINCT FROM p_stop_id OR existing.created_by IS DISTINCT FROM auth.uid() OR existing.request_fingerprint IS DISTINCT FROM fingerprint THEN
   RAISE EXCEPTION 'Diese Mehrfachnachweisanfrage wurde bereits mit anderen Angaben verwendet.' USING ERRCODE='40001';
  END IF;
  SELECT COALESCE(jsonb_agg(l.proof_id ORDER BY l.position_no),'[]'::jsonb) INTO proof_ids FROM public.care_tour_stop_proof_lines l WHERE l.batch_id=existing.id;
  RETURN jsonb_build_object('id',proof_ids->>0,'batchId',existing.id,'proofIds',proof_ids,'duplicate',true);
 END IF;
 SELECT * INTO s FROM public.care_tour_stops WHERE id=p_stop_id AND tenant_id=t FOR UPDATE;
 IF NOT FOUND OR s.status<>'completed' OR s.actual_started_at IS NULL OR s.actual_ended_at IS NULL OR s.documentation_entry_id IS NULL THEN
  RAISE EXCEPTION 'Nur ein vollständig dokumentierter Einsatz kann Leistungsnachweise erzeugen.' USING ERRCODE='23514';
 END IF;
 IF s.updated_at IS DISTINCT FROM p_expected_stop_updated_at THEN RAISE EXCEPTION 'Der Einsatz wurde parallel verändert. Bitte neu laden.' USING ERRCODE='40001'; END IF;
 IF s.service_proof_id IS NOT NULL OR EXISTS(SELECT 1 FROM public.care_tour_stop_proof_batches b WHERE b.stop_id=s.id) THEN
  RAISE EXCEPTION 'Für diesen Einsatz bestehen bereits Leistungsnachweise.' USING ERRCODE='40001';
 END IF;
 SELECT * INTO tr FROM public.care_tours WHERE id=s.tour_id AND tenant_id=t;
 IF NOT FOUND THEN RAISE EXCEPTION 'Tour nicht gefunden.' USING ERRCODE='42501'; END IF;
 actor_name:=COALESCE(NULLIF(public.clinical_actor_name(),''),NULLIF(tr.employee_name_snapshot,''),'Unbekannt');
 INSERT INTO public.care_tour_stop_proof_batches(id,tenant_id,tour_id,stop_id,client_id,client_request_id,request_fingerprint,created_by,created_by_name,created_at)
 VALUES(batch_id,t,tr.id,s.id,s.client_id,p_request_id,fingerprint,auth.uid(),actor_name,actual_time);
 FOR line IN SELECT value FROM jsonb_array_elements(p_lines) LOOP
  pos:=pos+1;
  IF jsonb_typeof(line) IS DISTINCT FROM 'object' OR (line-'tariffId'-'quantity'-'orderId'-'executionDetail'-'deviation')<>'{}'::jsonb
   OR COALESCE(line->>'quantity','')!~'^(0|[1-9][0-9]{0,4})(\.[0-9]{1,3})?$'
   OR (line->>'quantity')::numeric<=0 OR length(btrim(COALESCE(line->>'executionDetail',''))) NOT BETWEEN 5 AND 4000
   OR length(COALESCE(line->>'deviation',''))>2000 THEN
   RAISE EXCEPTION 'Leistungsposition % ist unvollständig oder ungültig.',pos USING ERRCODE='23514';
  END IF;
  IF EXISTS(SELECT 1 FROM public.care_tour_stop_proof_lines l WHERE l.batch_id=batch_id AND l.tariff_id=(line->>'tariffId')::uuid AND l.order_id IS NOT DISTINCT FROM NULLIF(line->>'orderId','')::uuid) THEN
   RAISE EXCEPTION 'Leistungsposition % dupliziert Tarif und Verordnungsbezug.',pos USING ERRCODE='23514';
  END IF;
  SELECT * INTO price FROM public.care_tariffs WHERE id=(line->>'tariffId')::uuid AND tenant_id=t FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Leistungstarif % ist nicht verfügbar.',pos USING ERRCODE='23514'; END IF;
  SELECT * INTO admission FROM public.care_admissions WHERE tenant_id=t AND client_id=s.client_id AND status IN('active','closed')
   AND starts_on<=(s.actual_started_at AT TIME ZONE 'Europe/Berlin')::date AND (ends_on IS NULL OR ends_on>=(s.actual_started_at AT TIME ZONE 'Europe/Berlin')::date)
   ORDER BY starts_on DESC LIMIT 1 FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Freigegebene Aufnahme für den Leistungstag fehlt.' USING ERRCODE='23514'; END IF;
  ord:=NULL;
  IF admission.legal_basis='sgb_v' THEN
   SELECT * INTO ord FROM public.care_medical_orders WHERE id=NULLIF(line->>'orderId','')::uuid AND tenant_id=t AND client_id=s.client_id FOR SHARE;
   IF NOT FOUND THEN RAISE EXCEPTION 'Position % benötigt eine gültige Verordnung.',pos USING ERRCODE='23514'; END IF;
  ELSIF NULLIF(line->>'orderId','') IS NOT NULL THEN RAISE EXCEPTION 'Position % darf keinen fremden Verordnungsbezug tragen.',pos USING ERRCODE='23514';
  END IF;
  SELECT * INTO proof FROM care_private.create_priced_proof(s.client_id,jsonb_build_object(
   'serviceDate',(s.actual_started_at AT TIME ZONE 'Europe/Berlin')::date,'startedAt',s.actual_started_at,'endedAt',s.actual_ended_at,
   'performanceNote',btrim(line->>'executionDetail'),'deviations',COALESCE(btrim(line->>'deviation'),''),
   'documentationEntryId',s.documentation_entry_id,'tourStopId',s.id,'assignedEmployeeId',tr.employee_id,
   'assignedEmployeeName',tr.employee_name_snapshot,'tariffId',price.id,'quantity',(line->>'quantity')::numeric,
   'prescriptionReference',CASE WHEN admission.legal_basis='sgb_v' THEN ord.id::text ELSE '' END));
  IF first_proof IS NULL THEN first_proof:=proof.id; END IF;
  INSERT INTO public.care_tour_stop_proof_lines(tenant_id,batch_id,tour_id,stop_id,client_id,position_no,proof_id,tariff_id,admission_id,order_id,quantity,billing_unit,legal_basis,execution_detail,deviation,tariff_snapshot,admission_snapshot,order_snapshot,created_at)
  VALUES(t,batch_id,tr.id,s.id,s.client_id,pos,proof.id,proof.tariff_id,proof.admission_id,CASE WHEN admission.legal_basis='sgb_v' THEN ord.id ELSE NULL END,(line->>'quantity')::numeric,proof.billing_unit,proof.legal_basis,btrim(line->>'executionDetail'),COALESCE(btrim(line->>'deviation'),''),to_jsonb(price),to_jsonb(admission),CASE WHEN admission.legal_basis='sgb_v' THEN to_jsonb(ord) ELSE NULL END,actual_time);
  proof_ids:=proof_ids||to_jsonb(proof.id);
 END LOOP;
 UPDATE public.care_tour_stops SET service_proof_id=first_proof,updated_at=actual_time WHERE id=s.id;
 PERFORM care_private.record_operations_event(t,'proof_batch',batch_id,'created',pos||' getrennte Leistungsnachweise erzeugt');
 RETURN jsonb_build_object('id',first_proof,'batchId',batch_id,'proofIds',proof_ids,'duplicate',false);
END $$;

CREATE OR REPLACE FUNCTION care_private.stop_proof_batch(p_stop_id uuid) RETURNS jsonb
 LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE t uuid:=care_private.assert_operations_actor('pflege.proofs.view'); batch public.care_tour_stop_proof_batches; stop public.care_tour_stops;
BEGIN
 SELECT * INTO stop FROM public.care_tour_stops WHERE tenant_id=t AND id=p_stop_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Einsatz nicht gefunden.' USING ERRCODE='42501'; END IF;
 SELECT * INTO batch FROM public.care_tour_stop_proof_batches WHERE tenant_id=t AND stop_id=p_stop_id;
 IF NOT FOUND THEN RETURN jsonb_build_object('batchId',NULL,'proofIds','[]'::jsonb,'stopUpdatedAt',stop.updated_at); END IF;
 RETURN jsonb_build_object('batchId',batch.id,'proofIds',COALESCE((SELECT jsonb_agg(l.proof_id ORDER BY l.position_no) FROM public.care_tour_stop_proof_lines l WHERE l.batch_id=batch.id),'[]'::jsonb),'stopUpdatedAt',stop.updated_at);
END $$;

CREATE OR REPLACE FUNCTION public.create_ambulatory_care_stop_proof_batch(p_stop_id uuid,p_expected_stop_updated_at timestamptz,p_lines jsonb,p_request_id uuid) RETURNS jsonb
 LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$SELECT care_private.create_stop_proof_batch(p_stop_id,p_expected_stop_updated_at,p_lines,p_request_id)$$;
CREATE OR REPLACE FUNCTION public.get_ambulatory_care_stop_proof_batch(p_stop_id uuid) RETURNS jsonb
 LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$SELECT care_private.stop_proof_batch(p_stop_id)$$;
REVOKE ALL ON FUNCTION care_private.create_stop_proof_batch(uuid,timestamptz,jsonb,uuid),care_private.stop_proof_batch(uuid),public.create_ambulatory_care_stop_proof_batch(uuid,timestamptz,jsonb,uuid),public.get_ambulatory_care_stop_proof_batch(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION care_private.create_stop_proof_batch(uuid,timestamptz,jsonb,uuid),care_private.stop_proof_batch(uuid),public.create_ambulatory_care_stop_proof_batch(uuid,timestamptz,jsonb,uuid),public.get_ambulatory_care_stop_proof_batch(uuid) TO authenticated;
