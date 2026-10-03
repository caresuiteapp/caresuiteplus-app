-- Reviewed release patch. Register through the existing migration pipeline before deployment.
-- No production data is seeded or changed by tests. Historical tours remain readable;
-- unlinked legacy tours must be cancelled and recreated before release.
BEGIN;
CREATE SCHEMA IF NOT EXISTS care_private;
REVOKE ALL ON SCHEMA care_private FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA care_private TO authenticated;
ALTER TABLE public.care_tours ADD COLUMN IF NOT EXISTS client_request_id uuid;
ALTER TABLE public.care_tours ADD COLUMN IF NOT EXISTS request_fingerprint text;
CREATE UNIQUE INDEX IF NOT EXISTS care_tours_request_unique ON public.care_tours(tenant_id,created_by,client_request_id) WHERE client_request_id IS NOT NULL;
ALTER TABLE public.care_tour_stops ADD COLUMN IF NOT EXISTS actual_started_at timestamptz;
ALTER TABLE public.care_tour_stops ADD COLUMN IF NOT EXISTS actual_ended_at timestamptz;
ALTER TABLE public.care_tour_stops ADD COLUMN IF NOT EXISTS documentation_entry_id uuid REFERENCES public.clinical_documentation_entries(id);
ALTER TABLE public.care_tour_stops ADD COLUMN IF NOT EXISTS service_proof_id uuid REFERENCES public.pfleger_service_proofs(id);
CREATE UNIQUE INDEX IF NOT EXISTS care_stop_proof_unique ON public.care_tour_stops(service_proof_id) WHERE service_proof_id IS NOT NULL;
CREATE TABLE IF NOT EXISTS public.care_tour_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 tenant_id uuid NOT NULL REFERENCES public.tenants(id),
 tour_id uuid NOT NULL REFERENCES public.care_tours(id),
 stop_id uuid REFERENCES public.care_tour_stops(id),
 actor_id uuid NOT NULL REFERENCES auth.users(id),
 actor_name text NOT NULL DEFAULT public.clinical_actor_name(),
 action text NOT NULL,
 note text NOT NULL DEFAULT '',
 occurred_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX IF NOT EXISTS care_tour_events_tenant_tour_idx ON public.care_tour_events(tenant_id,tour_id,occurred_at);
ALTER TABLE public.care_tour_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS care_tours_tenant_all ON public.care_tours;
DROP POLICY IF EXISTS care_tour_stops_tenant_all ON public.care_tour_stops;
DROP POLICY IF EXISTS care_tours_workflow_read ON public.care_tours;
CREATE POLICY care_tours_workflow_read ON public.care_tours FOR SELECT TO authenticated
 USING(tenant_id=public.current_tenant_id() AND public.has_permission('pflege.plans.view'));
DROP POLICY IF EXISTS care_tour_stops_workflow_read ON public.care_tour_stops;
CREATE POLICY care_tour_stops_workflow_read ON public.care_tour_stops FOR SELECT TO authenticated
 USING(tenant_id=public.current_tenant_id() AND public.has_permission('pflege.plans.view'));
DROP POLICY IF EXISTS care_tour_events_read ON public.care_tour_events;
CREATE POLICY care_tour_events_read ON public.care_tour_events FOR SELECT TO authenticated
 USING(tenant_id=public.current_tenant_id() AND public.has_permission('pflege.plans.view'));
REVOKE ALL ON public.care_tours,public.care_tour_stops,public.care_tour_events FROM anon,authenticated;
GRANT SELECT ON public.care_tours,public.care_tour_stops,public.care_tour_events TO authenticated;

-- Privileged writes are deliberately isolated from the exposed public schema.
-- Every entry point validates the signed-in actor, current tenant and write permission.
CREATE OR REPLACE FUNCTION care_private.assert_tour_actor() RETURNS uuid
 LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE t uuid:=public.current_tenant_id();
BEGIN
 IF auth.uid() IS NULL OR t IS NULL OR NOT public.has_permission('pflege.plans.manage') THEN
  RAISE EXCEPTION 'Keine Berechtigung zur Tourenbearbeitung.' USING ERRCODE='42501';
 END IF;
 RETURN t;
END $$;

CREATE OR REPLACE FUNCTION care_private.tour_resources() RETURNS jsonb
 LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE t uuid:=care_private.assert_tour_actor();
BEGIN
 RETURN jsonb_build_object(
 'employees',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',e.id,'name',concat_ws(' ',e.first_name,e.last_name),'qualification',COALESCE(e.qualification,'')) ORDER BY e.last_name,e.first_name)
 FROM public.employees e WHERE e.tenant_id=t AND e.deleted_at IS NULL AND e.status::text='active' AND 'pfleger'=ANY(e.allowed_products::text[])), '[]'::jsonb),
 'clients',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',c.id,'name',concat_ws(' ',c.first_name,c.last_name),'address',concat_ws(', ',NULLIF(concat_ws(' ',c.street,c.house_number),''),NULLIF(concat_ws(' ',c.postal_code,c.city),''))) ORDER BY c.last_name,c.first_name)
 FROM public.clients c WHERE c.tenant_id=t AND public.is_active_pfleger_client(c.id)), '[]'::jsonb));
END $$;

CREATE OR REPLACE FUNCTION care_private.create_tour(p_payload jsonb) RETURNS jsonb
 LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE t uuid:=care_private.assert_tour_actor(); tour uuid; e public.employees; c public.clients;
 request_id uuid:=COALESCE(NULLIF(p_payload->>'requestId','')::uuid,gen_random_uuid()); fingerprint text:=md5(p_payload::text);
 s jsonb; seq integer:=0; last_end time; start_at time; end_at time; day date;
BEGIN
 IF COALESCE(btrim(p_payload->>'name'),'')='' OR COALESCE(p_payload->>'tourDate','')!~'^\d{4}-\d{2}-\d{2}$'
 OR jsonb_typeof(p_payload->'stops') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Tourname, Datum und Einsätze sind erforderlich.'; END IF;
 day:=(p_payload->>'tourDate')::date;
 IF jsonb_array_length(p_payload->'stops')=0 THEN RAISE EXCEPTION 'Mindestens ein Einsatz ist erforderlich.'; END IF;
 SELECT * INTO e FROM public.employees WHERE id=(p_payload->>'employeeId')::uuid AND tenant_id=t
 AND deleted_at IS NULL AND status::text='active' AND 'pfleger'=ANY(allowed_products::text[]) FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Keine aktive Pflegekraft dieses Mandanten ausgewählt.' USING ERRCODE='23514'; END IF;
 SELECT id INTO tour FROM public.care_tours WHERE tenant_id=t AND created_by=auth.uid() AND client_request_id=request_id;
 IF tour IS NOT NULL THEN
  IF NOT EXISTS(SELECT 1 FROM public.care_tours WHERE id=tour AND request_fingerprint=fingerprint) THEN RAISE EXCEPTION 'Diese Speicheranfrage wurde bereits mit anderen Angaben gespeichert. Bitte aktualisieren.'; END IF;
  RETURN jsonb_build_object('id',tour);
 END IF;
 INSERT INTO public.care_tours(tenant_id,tour_date,name,employee_id,employee_name_snapshot,vehicle_label_snapshot,notes,created_by,client_request_id,request_fingerprint)
 VALUES(t,day,btrim(p_payload->>'name'),e.id,concat_ws(' ',e.first_name,e.last_name),COALESCE(btrim(p_payload->>'vehicleLabel'),''),COALESCE(btrim(p_payload->>'notes'),''),auth.uid(),request_id,fingerprint) RETURNING id INTO tour;
 FOR s IN SELECT value FROM jsonb_array_elements(p_payload->'stops') LOOP
  seq:=seq+1;
  IF COALESCE(s->>'plannedStart','')!~'^([01][0-9]|2[0-3]):[0-5][0-9]$' OR COALESCE(s->>'plannedEnd','')!~'^([01][0-9]|2[0-3]):[0-5][0-9]$'
  OR COALESCE(btrim(s->>'serviceSummary'),'')='' THEN RAISE EXCEPTION 'Einsatz %: Zeiten und Leistung fehlen.',seq; END IF;
  start_at:=(s->>'plannedStart')::time; end_at:=(s->>'plannedEnd')::time;
  IF end_at<=start_at OR start_at<last_end THEN RAISE EXCEPTION 'Einsatz %: ungültiges oder überlappendes Zeitfenster.',seq; END IF;
  last_end:=end_at;
  SELECT * INTO c FROM public.clients WHERE id=(s->>'clientId')::uuid AND tenant_id=t AND public.is_active_pfleger_client(id) FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Einsatz %: kein aktiver Pflegefall dieses Mandanten.',seq USING ERRCODE='23514'; END IF;
  INSERT INTO public.care_tour_stops(tenant_id,tour_id,sequence_no,client_id,client_name_snapshot,address_snapshot,planned_start,planned_end,service_summary)
  VALUES(t,tour,seq,c.id,concat_ws(' ',c.first_name,c.last_name),concat_ws(', ',NULLIF(concat_ws(' ',c.street,c.house_number),''),NULLIF(concat_ws(' ',c.postal_code,c.city),'')),start_at,end_at,btrim(s->>'serviceSummary'));
 END LOOP;
 INSERT INTO public.care_tour_events(tenant_id,tour_id,actor_id,action) VALUES(t,tour,auth.uid(),'created');
 RETURN jsonb_build_object('id',tour);
END $$;

CREATE OR REPLACE FUNCTION care_private.advance_tour(p_tour_id uuid,p_status text,p_expected_status text,p_reason text) RETURNS jsonb
 LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE t uuid:=care_private.assert_tour_actor(); r public.care_tours;
BEGIN
 -- Serialize planning against this employee; all callers acquire employee then tour.
 PERFORM 1 FROM public.employees WHERE id=(SELECT employee_id FROM public.care_tours WHERE id=p_tour_id AND tenant_id=t) FOR UPDATE;
 SELECT * INTO r FROM public.care_tours WHERE id=p_tour_id AND tenant_id=t FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Tour nicht gefunden.' USING ERRCODE='42501'; END IF;
 IF r.status IS DISTINCT FROM p_expected_status THEN RAISE EXCEPTION 'Tour wurde zwischenzeitlich geändert. Bitte aktualisieren.' USING ERRCODE='40001'; END IF;
 IF NOT ((r.status='draft' AND p_status='published') OR (r.status='published' AND p_status='in_progress') OR (r.status='in_progress' AND p_status='completed') OR (r.status IN('draft','published') AND p_status='cancelled')) THEN
  RAISE EXCEPTION 'Dieser Tourstatuswechsel ist nicht zulässig.' USING ERRCODE='23514';
 END IF;
 IF p_status IN('published','in_progress') THEN
  IF NOT EXISTS(SELECT 1 FROM public.employees WHERE id=r.employee_id AND tenant_id=t AND deleted_at IS NULL AND status::text='active' AND 'pfleger'=ANY(allowed_products::text[])) THEN RAISE EXCEPTION 'Die zugeordnete Pflegekraft ist nicht aktiv.'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.care_tour_stops WHERE tour_id=r.id AND tenant_id=t) OR EXISTS(SELECT 1 FROM public.care_tour_stops WHERE tour_id=r.id AND tenant_id=t AND (client_id IS NULL OR NOT public.is_active_pfleger_client(client_id))) THEN RAISE EXCEPTION 'Tour benötigt ausschließlich aktive, zugeordnete Pflegefälle.'; END IF;
  IF EXISTS(SELECT 1 FROM public.care_tours other JOIN public.care_tour_stops os ON os.tour_id=other.id JOIN public.care_tour_stops ns ON ns.tour_id=r.id
   WHERE other.tenant_id=t AND other.id<>r.id AND other.tour_date=r.tour_date AND other.employee_id=r.employee_id AND other.status IN('published','in_progress')
   AND os.status<>'cancelled' AND ns.status<>'cancelled' AND os.planned_start<ns.planned_end AND ns.planned_start<os.planned_end) THEN RAISE EXCEPTION 'Pflegekraft hat einen überlappenden Einsatz in einer anderen Tour.'; END IF;
 END IF;
 IF p_status='completed' AND (NOT EXISTS(SELECT 1 FROM public.care_tour_stops WHERE tour_id=r.id) OR EXISTS(SELECT 1 FROM public.care_tour_stops WHERE tour_id=r.id AND status NOT IN('completed','cancelled'))) THEN RAISE EXCEPTION 'Alle Einsätze müssen dokumentiert oder begründet ausgefallen sein.'; END IF;
 IF p_status='cancelled' THEN
  IF COALESCE(btrim(p_reason),'')='' THEN RAISE EXCEPTION 'Ein Absagegrund ist erforderlich.'; END IF;
  UPDATE public.care_tour_stops SET status='cancelled',notes=btrim(p_reason),updated_at=clock_timestamp() WHERE tour_id=r.id AND tenant_id=t;
 END IF;
 UPDATE public.care_tours SET status=p_status,updated_by=auth.uid(),updated_at=clock_timestamp() WHERE id=r.id;
 INSERT INTO public.care_tour_events(tenant_id,tour_id,actor_id,action,note) VALUES(t,r.id,auth.uid(),r.status||'→'||p_status,COALESCE(btrim(p_reason),''));
 RETURN jsonb_build_object('id',r.id);
END $$;

CREATE OR REPLACE FUNCTION care_private.advance_stop(p_stop_id uuid,p_status text,p_expected_status text,p_note text) RETURNS jsonb
 LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE t uuid:=care_private.assert_tour_actor(); r public.care_tour_stops; tr public.care_tours; doc public.clinical_documentation_entries;
BEGIN
 PERFORM 1 FROM public.employees WHERE id=(SELECT employee_id FROM public.care_tours WHERE id=(SELECT tour_id FROM public.care_tour_stops WHERE id=p_stop_id AND tenant_id=t) AND tenant_id=t) FOR UPDATE;
 SELECT * INTO tr FROM public.care_tours WHERE id=(SELECT tour_id FROM public.care_tour_stops WHERE id=p_stop_id AND tenant_id=t) AND tenant_id=t FOR UPDATE;
 IF NOT FOUND OR tr.status<>'in_progress' THEN RAISE EXCEPTION 'Tour muss zuerst gestartet werden.'; END IF;
 SELECT * INTO r FROM public.care_tour_stops WHERE id=p_stop_id AND tenant_id=t FOR UPDATE;
 IF NOT FOUND OR r.status IS DISTINCT FROM p_expected_status THEN RAISE EXCEPTION 'Einsatz wurde zwischenzeitlich geändert. Bitte aktualisieren.' USING ERRCODE='40001'; END IF;
 IF NOT ((r.status='planned' AND p_status='arrived') OR (r.status='arrived' AND p_status='in_progress') OR (r.status='in_progress' AND p_status='completed') OR (r.status IN('planned','arrived','in_progress') AND p_status='cancelled')) THEN RAISE EXCEPTION 'Dieser Einsatzstatuswechsel ist nicht zulässig.'; END IF;
 IF p_status IN('completed','cancelled') AND COALESCE(btrim(p_note),'')='' THEN RAISE EXCEPTION 'Durchführungsnachweis bzw. Ausfallgrund ist erforderlich.'; END IF;
 IF p_status='in_progress' THEN
  IF NOT public.is_active_pfleger_client(r.client_id) THEN RAISE EXCEPTION 'Kein aktiver Pflegefall.'; END IF;
  IF EXISTS(SELECT 1 FROM public.care_tour_stops s JOIN public.care_tours ct ON ct.id=s.tour_id WHERE ct.tenant_id=t AND ct.employee_id=tr.employee_id AND s.id<>r.id AND s.status='in_progress') THEN RAISE EXCEPTION 'Ein anderer Einsatz läuft bereits.'; END IF;
 END IF;
 IF p_status='completed' THEN
  SELECT * INTO doc FROM public.create_clinical_documentation(r.client_id,'visit','Ambulanter Einsatz: '||r.service_summary,btrim(p_note),jsonb_build_object('interventions',r.service_summary));
 END IF;
 UPDATE public.care_tour_stops SET status=p_status,
 documentation_entry_id=COALESCE(doc.id,documentation_entry_id),
 actual_started_at=CASE WHEN p_status='in_progress' THEN clock_timestamp() ELSE actual_started_at END,
 actual_ended_at=CASE WHEN p_status IN('completed','cancelled') AND actual_started_at IS NOT NULL THEN clock_timestamp() ELSE actual_ended_at END,
 notes=CASE WHEN p_status IN('completed','cancelled') THEN btrim(p_note) ELSE notes END,updated_at=clock_timestamp() WHERE id=r.id;
 INSERT INTO public.care_tour_events(tenant_id,tour_id,stop_id,actor_id,action,note) VALUES(t,tr.id,r.id,auth.uid(),r.status||'→'||p_status,COALESCE(btrim(p_note),''));
 RETURN jsonb_build_object('id',r.id);
END $$;


CREATE OR REPLACE FUNCTION care_private.create_stop_proof(p_stop_id uuid,p_payload jsonb) RETURNS jsonb
 LANGUAGE plpgsql SECURITY DEFINER SET search_path='' SET timezone='Europe/Berlin' AS $$
DECLARE t uuid:=care_private.assert_tour_actor(); r public.care_tour_stops; tr public.care_tours; proof public.pfleger_service_proofs;
BEGIN
 IF NOT public.has_permission('pflege.proofs.create') THEN RAISE EXCEPTION 'Keine Berechtigung.' USING ERRCODE='42501'; END IF;
 SELECT * INTO r FROM public.care_tour_stops WHERE id=p_stop_id AND tenant_id=t FOR UPDATE;
 IF NOT FOUND OR r.status<>'completed' OR r.actual_started_at IS NULL OR r.actual_ended_at IS NULL THEN RAISE EXCEPTION 'Nur dokumentierte Einsätze können einen Leistungsnachweis erzeugen.'; END IF;
 IF r.service_proof_id IS NOT NULL THEN RETURN jsonb_build_object('id',r.service_proof_id); END IF;
 SELECT * INTO tr FROM public.care_tours WHERE id=r.tour_id AND tenant_id=t;
 IF COALESCE(p_payload->>'grossAmountCents','')!~'^[0-9]+$' OR length(p_payload->>'grossAmountCents')>9 OR COALESCE(btrim(p_payload->>'serviceLabel'),'')='' THEN RAISE EXCEPTION 'Leistungsbezeichnung und gültiger Betrag in Cent sind erforderlich.'; END IF;
 IF p_payload->>'legalBasis' IN('sgb_v','sgb_xi','mixed') AND COALESCE(btrim(p_payload->>'costCarrierName'),'')='' THEN RAISE EXCEPTION 'Für Kassenleistungen ist ein Kostenträger erforderlich.'; END IF;
 -- Override client, date, actual times, author evidence and documentation from the trusted stop.
 SELECT * INTO proof FROM public.create_pfleger_service_proof(r.client_id,
 p_payload||jsonb_build_object('serviceDate',(r.actual_started_at AT TIME ZONE 'Europe/Berlin')::date,'startedAt',r.actual_started_at,'endedAt',r.actual_ended_at,'performanceNote',r.notes,'documentationEntryId',r.documentation_entry_id,'tourStopId',r.id,'assignedEmployeeId',tr.employee_id,'assignedEmployeeName',tr.employee_name_snapshot));
 UPDATE public.care_tour_stops SET service_proof_id=proof.id WHERE id=r.id;
 INSERT INTO public.care_tour_events(tenant_id,tour_id,stop_id,actor_id,action) VALUES(t,r.tour_id,r.id,auth.uid(),'proof_created');
 RETURN jsonb_build_object('id',proof.id);
END $$;
CREATE OR REPLACE FUNCTION public.create_ambulatory_care_stop_proof(p_stop_id uuid,p_payload jsonb) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$SELECT care_private.create_stop_proof(p_stop_id,p_payload)$$;

CREATE OR REPLACE FUNCTION public.get_ambulatory_care_tour_resources() RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$SELECT care_private.tour_resources()$$;
CREATE OR REPLACE FUNCTION public.create_ambulatory_care_tour(p_payload jsonb) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$SELECT care_private.create_tour(p_payload)$$;
CREATE OR REPLACE FUNCTION public.advance_ambulatory_care_tour(p_tour_id uuid,p_status text,p_expected_status text,p_reason text DEFAULT '') RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$SELECT care_private.advance_tour(p_tour_id,p_status,p_expected_status,p_reason)$$;
CREATE OR REPLACE FUNCTION public.advance_ambulatory_care_stop(p_stop_id uuid,p_status text,p_expected_status text,p_note text DEFAULT '') RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$SELECT care_private.advance_stop(p_stop_id,p_status,p_expected_status,p_note)$$;
REVOKE ALL ON FUNCTION care_private.assert_tour_actor(),care_private.create_stop_proof(uuid,jsonb),care_private.tour_resources(),care_private.create_tour(jsonb),care_private.advance_tour(uuid,text,text,text),care_private.advance_stop(uuid,text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION care_private.create_stop_proof(uuid,jsonb),care_private.tour_resources(),care_private.create_tour(jsonb),care_private.advance_tour(uuid,text,text,text),care_private.advance_stop(uuid,text,text,text) TO authenticated;
REVOKE ALL ON FUNCTION public.create_ambulatory_care_stop_proof(uuid,jsonb),public.get_ambulatory_care_tour_resources(),public.create_ambulatory_care_tour(jsonb),public.advance_ambulatory_care_tour(uuid,text,text,text),public.advance_ambulatory_care_stop(uuid,text,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.create_ambulatory_care_stop_proof(uuid,jsonb),public.get_ambulatory_care_tour_resources(),public.create_ambulatory_care_tour(jsonb),public.advance_ambulatory_care_tour(uuid,text,text,text),public.advance_ambulatory_care_stop(uuid,text,text,text) TO authenticated;

-- Real signature capture replaces the previous editable signature-reference field.
CREATE TABLE IF NOT EXISTS public.pfleger_signature_evidence (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES public.tenants(id),
 proof_id uuid NOT NULL UNIQUE REFERENCES public.pfleger_service_proofs(id),
 signer_name text NOT NULL CHECK(length(btrim(signer_name))>0),
 png_data_url text NOT NULL CHECK(png_data_url LIKE 'data:image/png;base64,%' AND length(png_data_url) BETWEEN 100 AND 1048576),
 captured_by uuid NOT NULL REFERENCES auth.users(id), captured_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
ALTER TABLE public.pfleger_signature_evidence ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS pfleger_signature_evidence_read ON public.pfleger_signature_evidence;
CREATE POLICY pfleger_signature_evidence_read ON public.pfleger_signature_evidence FOR SELECT TO authenticated
 USING(tenant_id=public.current_tenant_id() AND public.has_permission('pflege.proofs.view'));
REVOKE ALL ON public.pfleger_signature_evidence FROM anon,authenticated;
GRANT SELECT ON public.pfleger_signature_evidence TO authenticated;
-- Preserve the established billing/audit implementation behind a validated public entry point.
DO $$BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='care_private' AND p.proname='advance_pfleger_service_proof') THEN
  ALTER FUNCTION public.advance_pfleger_service_proof(uuid,text,jsonb) SET SCHEMA care_private;
 END IF;
END $$;
REVOKE ALL ON FUNCTION care_private.advance_pfleger_service_proof(uuid,text,jsonb) FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION care_private.advance_proof(p_proof_id uuid,p_action text,p_payload jsonb) RETURNS public.pfleger_service_proofs
 LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE t uuid:=public.current_tenant_id(); r public.pfleger_service_proofs;
BEGIN
 IF auth.uid() IS NULL OR t IS NULL THEN RAISE EXCEPTION 'Keine Berechtigung.' USING ERRCODE='42501'; END IF;
 SELECT * INTO r FROM public.pfleger_service_proofs WHERE id=p_proof_id AND tenant_id=t FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Leistungsnachweis nicht gefunden.' USING ERRCODE='42501'; END IF;
 IF p_action='sign' AND NOT EXISTS(SELECT 1 FROM public.pfleger_signature_evidence WHERE proof_id=r.id AND tenant_id=t AND id::text=p_payload->>'signatureRef' AND signer_name=btrim(p_payload->>'signatureName')) THEN RAISE EXCEPTION 'Eine erfasste Unterschrift ist erforderlich.' USING ERRCODE='23514'; END IF;
 IF p_action IN('approve','reject') AND (r.employee_profile_id=public.clinical_actor_id() OR EXISTS(SELECT 1 FROM public.pfleger_signature_evidence WHERE proof_id=r.id AND captured_by=auth.uid())) THEN RAISE EXCEPTION 'Der eigene Leistungsnachweis benötigt eine zweite prüfende Person.' USING ERRCODE='42501'; END IF;
 RETURN care_private.advance_pfleger_service_proof(p_proof_id,p_action,p_payload);
END $$;
CREATE OR REPLACE FUNCTION care_private.capture_proof_signature(p_proof_id uuid,p_signer_name text,p_png_data_url text) RETURNS jsonb
 LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE t uuid:=public.current_tenant_id(); r public.pfleger_service_proofs; evidence uuid;
BEGIN
 IF auth.uid() IS NULL OR t IS NULL OR NOT public.has_permission('pflege.proofs.sign') THEN RAISE EXCEPTION 'Keine Berechtigung.' USING ERRCODE='42501'; END IF;
 SELECT * INTO r FROM public.pfleger_service_proofs WHERE id=p_proof_id AND tenant_id=t FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Leistungsnachweis nicht gefunden.' USING ERRCODE='42501'; END IF;
 IF r.status='signed' AND EXISTS(SELECT 1 FROM public.pfleger_signature_evidence WHERE proof_id=r.id AND captured_by=auth.uid() AND signer_name=btrim(p_signer_name) AND png_data_url=p_png_data_url) THEN RETURN jsonb_build_object('id',r.id); END IF;
 IF r.status NOT IN('draft','submitted') THEN RAISE EXCEPTION 'Dieser Nachweis kann nicht mehr unterschrieben werden.'; END IF;
 IF COALESCE(btrim(p_signer_name),'')='' OR COALESCE(p_png_data_url,'')!~'^data:image/png;base64,iVBORw0KGgo[A-Za-z0-9+/=]+$' OR length(p_png_data_url) NOT BETWEEN 100 AND 1048576 THEN RAISE EXCEPTION 'Name und gültige PNG-Unterschrift sind erforderlich.'; END IF;
 INSERT INTO public.pfleger_signature_evidence(tenant_id,proof_id,signer_name,png_data_url,captured_by) VALUES(t,r.id,btrim(p_signer_name),p_png_data_url,auth.uid()) RETURNING id INTO evidence;
 PERFORM care_private.advance_proof(r.id,'sign',jsonb_build_object('signatureName',btrim(p_signer_name),'signatureRef',evidence::text));
 RETURN jsonb_build_object('id',r.id);
END $$;
CREATE OR REPLACE FUNCTION public.advance_pfleger_service_proof(p_proof_id uuid,p_action text,p_payload jsonb DEFAULT '{}'::jsonb) RETURNS public.pfleger_service_proofs
 LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$SELECT care_private.advance_proof(p_proof_id,p_action,p_payload)$$;
CREATE OR REPLACE FUNCTION public.capture_pfleger_proof_signature(p_proof_id uuid,p_signer_name text,p_png_data_url text) RETURNS jsonb
 LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$SELECT care_private.capture_proof_signature(p_proof_id,p_signer_name,p_png_data_url)$$;
REVOKE ALL ON FUNCTION care_private.advance_proof(uuid,text,jsonb),care_private.capture_proof_signature(uuid,text,text),public.advance_pfleger_service_proof(uuid,text,jsonb),public.capture_pfleger_proof_signature(uuid,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION care_private.advance_proof(uuid,text,jsonb),care_private.capture_proof_signature(uuid,text,text),public.advance_pfleger_service_proof(uuid,text,jsonb),public.capture_pfleger_proof_signature(uuid,text,text) TO authenticated;

COMMIT;
