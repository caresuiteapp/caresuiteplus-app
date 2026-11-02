-- REVIEW ONLY. Ninth draft, after monthly-assist-originals-draft.sql and the
-- existing employee/client portal signature migrations. No rollout or backfill.
-- The employee captures content at service end. The client's later signature
-- and the employee's final sealing are different events with different times.
BEGIN;
CREATE TABLE care_security.gkv_assist_deferred_sources (
 proof_id uuid PRIMARY KEY REFERENCES public.assist_visit_proofs(id),
 tenant_id uuid NOT NULL REFERENCES public.tenants(id), visit_id uuid NOT NULL,
 assignment_id uuid NOT NULL, employee_id uuid NOT NULL, actor_id uuid NOT NULL,
 session_id uuid NOT NULL, registration_id uuid NOT NULL, employee_number text NOT NULL,
 captured_at timestamptz NOT NULL, service_started_at timestamptz NOT NULL,
 service_ended_at timestamptz NOT NULL, documentation_submitted_at timestamptz NOT NULL,
 payload_snapshot jsonb NOT NULL, payload_hash text NOT NULL,
 UNIQUE(tenant_id,visit_id), UNIQUE(tenant_id,assignment_id),
 FOREIGN KEY(tenant_id,registration_id) REFERENCES care_security.gkv_employee_registrations(tenant_id,id)
);
ALTER TABLE care_security.gkv_employee_captures DROP CONSTRAINT gkv_employee_captures_policy_check;
ALTER TABLE care_security.gkv_employee_captures ADD CONSTRAINT gkv_employee_captures_policy_check
 CHECK(policy IN ('personal-proof-insert-15m-v1','personal-deferred-source-15m-v1'));

-- The unsigned source must already contain the complete actual service. The
-- existing signed validator repeats these checks before final PDF/record use.
CREATE FUNCTION care_security.gkv_assist_deferred_payload(p public.assist_visit_proofs) RETURNS timestamptz
 LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE v public.assist_visits; a public.assignments; doc public.assist_visit_documentation;
 snap jsonb:=p.payload_snapshot; r record; paused timestamptz; pause_seconds numeric:=0; seconds integer;
BEGIN
 SELECT * INTO v FROM public.assist_visits WHERE tenant_id=p.tenant_id AND id=p.visit_id FOR SHARE;
 IF NOT FOUND OR v.canonical_status IN ('cancelled','no_show') OR v.actual_start_at IS NULL OR v.actual_end_at IS NULL
  OR NOT isfinite(v.actual_start_at) OR NOT isfinite(v.actual_end_at) OR v.actual_end_at<v.actual_start_at
  OR v.actual_end_at>clock_timestamp() THEN
  RAISE EXCEPTION 'Beendete tatsächliche Leistung fehlt für die Portalnachsignatur' USING ERRCODE='40001'; END IF;
 IF (SELECT count(*) FROM public.assignments WHERE tenant_id=p.tenant_id AND (id=v.id OR id=v.legacy_assignment_id))<>1 THEN
  RAISE EXCEPTION 'Eindeutige Einsatzzuordnung fehlt' USING ERRCODE='40001'; END IF;
 SELECT * INTO a FROM public.assignments WHERE tenant_id=p.tenant_id AND (id=v.id OR id=v.legacy_assignment_id) FOR SHARE;
 IF a.status::text IN ('cancelled','no_show') OR a.employee_id IS DISTINCT FROM v.employee_id
  OR a.client_id IS DISTINCT FROM v.client_id OR a.actual_start_at IS DISTINCT FROM v.actual_start_at
  OR a.actual_end_at IS DISTINCT FROM v.actual_end_at THEN
  RAISE EXCEPTION 'Einsatz und Portalquelle widersprechen sich' USING ERRCODE='40001'; END IF;
 IF jsonb_typeof(snap) IS DISTINCT FROM 'object' OR pg_column_size(snap)>256000
  OR p.payload_hash IS DISTINCT FROM 'sha256:'||encode(sha256(convert_to(public.workflow_canonical_json(snap),'UTF8')),'hex')
  OR snap->>'visitId' IS DISTINCT FROM v.id::text OR snap->>'clientId' IS DISTINCT FROM v.client_id::text
  OR snap->>'employeeId' IS DISTINCT FROM v.employee_id::text
  OR (snap#>>'{visitTimes,serviceStartedAt}')::timestamptz IS DISTINCT FROM v.actual_start_at
  OR (snap#>>'{visitTimes,serviceEndedAt}')::timestamptz IS DISTINCT FROM v.actual_end_at
  OR (snap->>'plannedStartAt')::timestamptz IS DISTINCT FROM v.planned_start_at
  OR (snap->>'plannedEndAt')::timestamptz IS DISTINCT FROM v.planned_end_at THEN
  RAISE EXCEPTION 'Portalquelle stimmt nicht mit der tatsächlichen Leistung überein' USING ERRCODE='40001'; END IF;
 IF (SELECT count(*) FROM public.assist_visit_documentation WHERE tenant_id=p.tenant_id AND visit_id=v.id)<>1 THEN
  RAISE EXCEPTION 'Eindeutige Dokumentationsfassung fehlt' USING ERRCODE='40001'; END IF;
 SELECT * INTO doc FROM public.assist_visit_documentation WHERE tenant_id=p.tenant_id AND visit_id=v.id FOR SHARE;
 IF doc.submitted_at IS NULL OR doc.submitted_at>clock_timestamp() OR NULLIF(trim(doc.short_description),'') IS NULL
  OR coalesce(snap->>'documentationNote',snap->>'documentation') IS DISTINCT FROM trim(doc.short_description)
  OR jsonb_typeof(snap->'tasks') IS DISTINCT FROM 'array'
  OR NOT (public.workflow_tasks_match(snap->'tasks',p.tenant_id,v.id,v.legacy_assignment_id,FALSE)
   OR public.workflow_tasks_match(snap->'tasks',p.tenant_id,v.id,v.legacy_assignment_id,TRUE)) THEN
  RAISE EXCEPTION 'Dokumentation oder vollständige Aufgabenfassung wurde geändert' USING ERRCODE='40001'; END IF;
 FOR r IN SELECT event_type,occurred_at FROM public.assist_time_events WHERE tenant_id=p.tenant_id AND visit_id=v.id
  AND occurred_at BETWEEN v.actual_start_at AND v.actual_end_at ORDER BY occurred_at,id LOOP
  IF r.event_type='pause_start' AND paused IS NULL THEN paused:=r.occurred_at;
  ELSIF r.event_type IN ('pause_end','service_end') AND paused IS NOT NULL THEN
   pause_seconds:=pause_seconds+round(extract(epoch FROM r.occurred_at-paused)); paused:=NULL;
  END IF;
 END LOOP;
 IF paused IS NOT NULL THEN pause_seconds:=pause_seconds+round(extract(epoch FROM v.actual_end_at-paused)); END IF;
 seconds:=GREATEST(0,round(extract(epoch FROM v.actual_end_at-v.actual_start_at))-pause_seconds);
 IF (snap#>>'{visitTimes,serviceSeconds}')::numeric IS DISTINCT FROM seconds::numeric
  OR NOT EXISTS(SELECT 1 FROM public.assist_time_events WHERE tenant_id=p.tenant_id AND visit_id=v.id AND event_type='service_start' AND occurred_at=v.actual_start_at)
  OR NOT EXISTS(SELECT 1 FROM public.assist_time_events WHERE tenant_id=p.tenant_id AND visit_id=v.id AND event_type='service_end' AND occurred_at=v.actual_end_at) THEN
  RAISE EXCEPTION 'Bestätigte Zeitereignisse und vollständige Pausen fehlen' USING ERRCODE='40001'; END IF;
 RETURN doc.submitted_at;
END $$;

CREATE FUNCTION care_security.gkv_assist_deferred_signed_snapshot(c care_security.gkv_assist_deferred_sources,s public.assist_visit_signatures)
 RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT c.payload_snapshot||jsonb_build_object('signatureDeferredToClientPortal',false,
  'clientPortalSignedAt',to_char(s.signed_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
  'signedViaClientPortal',true,'clientPortalPdfSignatureId',s.id::text,'signerName',s.signer_name,
  'signedAt',to_char(s.signed_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
  'signature',jsonb_build_object('signerName',s.signer_name,'signerRole','client',
   'signedAt',to_char(s.signed_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')))
$$;
CREATE FUNCTION care_security.gkv_assist_deferred_check(c care_security.gkv_assist_deferred_sources,p public.assist_visit_proofs) RETURNS void
 LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE registration care_security.gkv_employee_registrations; s public.assist_visit_signatures; signature_payload jsonb; tasks jsonb;
BEGIN
 SELECT * INTO registration FROM care_security.gkv_employee_registrations WHERE tenant_id=c.tenant_id AND id=c.registration_id FOR SHARE;
 IF NOT FOUND OR registration.state<>'approved' OR registration.actor_id<>c.actor_id OR registration.employee_id<>c.employee_id
  OR registration.employee_number<>c.employee_number OR registration.valid_from>c.service_started_at OR registration.valid_until<=c.captured_at
  OR p.tenant_id IS DISTINCT FROM c.tenant_id OR p.visit_id IS DISTINCT FROM c.visit_id
  OR (p.payload_snapshot#>>'{visitTimes,serviceStartedAt}')::timestamptz IS DISTINCT FROM c.service_started_at
  OR (p.payload_snapshot#>>'{visitTimes,serviceEndedAt}')::timestamptz IS DISTINCT FROM c.service_ended_at
  OR care_security.gkv_assist_deferred_payload(p) IS DISTINCT FROM c.documentation_submitted_at THEN
  RAISE EXCEPTION 'Persönliche Portalquelle wurde geändert oder widerrufen' USING ERRCODE='40001'; END IF;
 IF p.signature_id IS NULL THEN
  IF p.payload_snapshot IS DISTINCT FROM c.payload_snapshot OR p.payload_hash IS DISTINCT FROM c.payload_hash THEN
   RAISE EXCEPTION 'Erfasster Leistungsinhalt ist unveränderbar' USING ERRCODE='40001'; END IF;
 ELSE
  SELECT * INTO s FROM public.assist_visit_signatures WHERE tenant_id=c.tenant_id AND visit_id=c.visit_id AND id=p.signature_id FOR SHARE;
  IF NOT FOUND OR s.is_valid IS NOT TRUE OR s.invalidated_at IS NOT NULL OR s.signer_role<>'client'
   OR s.signed_at IS NULL OR s.signed_at<date_trunc('milliseconds',c.captured_at) OR s.signed_at>clock_timestamp()
   OR s.metadata->>'proofId' IS DISTINCT FROM c.proof_id::text OR s.metadata->>'signedVia' IS DISTINCT FROM 'client_portal'
   OR s.metadata->>'proofPayloadHash' IS DISTINCT FROM c.payload_hash
   OR p.payload_snapshot IS DISTINCT FROM care_security.gkv_assist_deferred_signed_snapshot(c,s) THEN
   RAISE EXCEPTION 'Nachgereichte Unterschrift gehört nicht zur erfassten Portalquelle' USING ERRCODE='40001'; END IF;
  SELECT coalesce(jsonb_agg(jsonb_build_object('taskId',x->>'id','status',x->>'status') ORDER BY n),'[]') INTO tasks
   FROM jsonb_array_elements(c.payload_snapshot->'tasks') WITH ORDINALITY a(x,n);
  signature_payload:=jsonb_build_object('visitId',c.visit_id,'clientId',c.payload_snapshot->>'clientId','employeeId',c.employee_id,
   'plannedStartAt',c.payload_snapshot->>'plannedStartAt','plannedEndAt',c.payload_snapshot->>'plannedEndAt',
   'taskStatuses',tasks,'documentationNote',coalesce(c.payload_snapshot->>'documentationNote',c.payload_snapshot->>'documentation'));
  IF s.payload_hash IS DISTINCT FROM 'sha256:'||encode(sha256(convert_to(public.workflow_canonical_json(signature_payload),'UTF8')),'hex')
   OR coalesce(s.signature_hash,'')!~'^sha256:[0-9a-f]{64}$' OR s.storage_path IS NULL
   OR s.storage_path NOT LIKE 'tenant/'||c.tenant_id::text||'/assist/visits/'||c.visit_id::text||'/signatures/%' THEN
   RAISE EXCEPTION 'Signaturinhalt oder Signaturdatei passt nicht zur Portalquelle' USING ERRCODE='40001'; END IF;
 END IF;
END $$;

-- Existing employee portal release commits proof, client document and this
-- capture together. An administrative release cannot impersonate the employee.
CREATE FUNCTION care_security.gkv_assist_deferred_capture() RETURNS trigger
 LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE employee uuid; r care_security.gkv_employee_registrations; v public.assist_visits;
 a uuid; instant timestamptz; submitted timestamptz;
BEGIN
 IF NEW.portal_visible IS NOT TRUE OR NEW.portal_release_status<>'pending_client_signature' OR NEW.signature_id IS NOT NULL
  OR EXISTS(SELECT 1 FROM care_security.gkv_assist_deferred_sources WHERE proof_id=NEW.id) THEN RETURN NEW; END IF;
 SELECT * INTO v FROM public.assist_visits WHERE tenant_id=NEW.tenant_id AND id=NEW.visit_id FOR SHARE;
 IF NOT EXISTS(SELECT 1 FROM care_security.gkv_employee_registrations WHERE tenant_id=NEW.tenant_id AND employee_id=v.employee_id
  AND state IN ('approved','revoked') AND (v.actual_start_at IS NULL OR valid_from<=v.actual_start_at AND valid_until>v.actual_start_at)) THEN RETURN NEW; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(NEW.tenant_id::text||':gkv-assist:'||NEW.visit_id::text,0));
 employee:=care_security.gkv_employee_self(NEW.tenant_id); instant:=clock_timestamp();
 SELECT * INTO r FROM care_security.gkv_employee_registrations WHERE tenant_id=NEW.tenant_id AND employee_id=employee
  AND actor_id=auth.uid() AND state='approved' AND valid_from<=v.actual_start_at AND valid_until>instant FOR SHARE;
 IF NOT FOUND OR employee IS DISTINCT FROM v.employee_id OR v.actual_end_at IS NULL
  OR v.actual_end_at<instant-interval '15 minutes' OR NEW.status<>'draft' OR NEW.billing_released
  OR NEW.payload_snapshot->>'signatureDeferredToClientPortal' IS DISTINCT FROM 'true'
  OR coalesce(NEW.payload_snapshot->'signature','null')<>'null'::jsonb
  OR NEW.payload_snapshot->>'signedAt' IS NOT NULL OR NEW.payload_snapshot->>'clientPortalSignedAt' IS NOT NULL
  OR NEW.payload_snapshot->>'signedViaClientPortal'='true'
  OR EXISTS(SELECT 1 FROM public.service_records WHERE tenant_id=NEW.tenant_id AND source_receipt->>'visit_id'=NEW.visit_id::text) THEN
  RAISE EXCEPTION 'Zeitnahe persönliche Erfassung vor Portalnachsignatur fehlt' USING ERRCODE='40001'; END IF;
 submitted:=care_security.gkv_assist_deferred_payload(NEW);
 instant:=clock_timestamp();
 IF r.valid_until<=instant OR v.actual_end_at<instant-interval '15 minutes' THEN
  RAISE EXCEPTION 'Erfassungsfrist oder Nummernfreigabe während der Prüfung abgelaufen' USING ERRCODE='40001'; END IF;
 SELECT id INTO a FROM public.assignments WHERE tenant_id=NEW.tenant_id AND (id=v.id OR id=v.legacy_assignment_id);
 INSERT INTO care_security.gkv_assist_deferred_sources VALUES(NEW.id,NEW.tenant_id,NEW.visit_id,a,employee,auth.uid(),
  care_security.gkv_monthly_live_session(),r.id,r.employee_number,instant,v.actual_start_at,v.actual_end_at,submitted,NEW.payload_snapshot,NEW.payload_hash);
 RETURN NEW;
END $$;
CREATE TRIGGER gkv_assist_deferred_capture AFTER INSERT OR UPDATE ON public.assist_visit_proofs
 FOR EACH ROW EXECUTE FUNCTION care_security.gkv_assist_deferred_capture();

CREATE FUNCTION care_security.gkv_assist_deferred_guard() RETURNS trigger
 LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE c care_security.gkv_assist_deferred_sources; t uuid; v uuid;
BEGIN
 t:=CASE WHEN TG_OP='INSERT' THEN NEW.tenant_id ELSE OLD.tenant_id END;
 v:=CASE WHEN TG_OP='INSERT' THEN NEW.visit_id ELSE OLD.visit_id END;
 PERFORM pg_advisory_xact_lock(hashtextextended(t::text||':gkv-assist:'||v::text,0));
 SELECT * INTO c FROM care_security.gkv_assist_deferred_sources WHERE tenant_id=t AND visit_id=v;
 IF NOT FOUND THEN RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END; END IF;
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Persönliche Portalquelle bleibt erhalten' USING ERRCODE='42501'; END IF;
 -- Only the existing atomic final-sealing path may insert the new original.
 IF EXISTS(SELECT 1 FROM care_security.gkv_assist_originals WHERE tenant_id=t AND proof_id=NEW.id) THEN RETURN NEW; END IF;
 IF TG_OP='INSERT' OR NEW.id IS DISTINCT FROM c.proof_id OR NEW.id IS DISTINCT FROM OLD.id
  OR NEW.tenant_id IS DISTINCT FROM OLD.tenant_id OR NEW.visit_id IS DISTINCT FROM OLD.visit_id THEN
  RAISE EXCEPTION 'Keine neue oder verschobene Fassung über der erfassten Portalquelle' USING ERRCODE='40001'; END IF;
 IF to_jsonb(NEW)=to_jsonb(OLD) THEN RETURN NEW; END IF;
 IF OLD.signature_id IS NOT NULL THEN
  RAISE EXCEPTION 'Unterzeichnete Portalquelle ist abgeschlossen' USING ERRCODE='40001'; END IF;
 PERFORM care_security.gkv_monthly_live_session();
 IF NEW.signature_id IS NULL THEN
  -- Repeated employee release keeps its first timestamp and exact content.
  IF auth.uid() IS DISTINCT FROM c.actor_id OR care_security.gkv_employee_self(t) IS DISTINCT FROM c.employee_id
   OR NEW.payload_snapshot-'signatureDeferredAt' IS DISTINCT FROM c.payload_snapshot-'signatureDeferredAt'
   OR NEW.payload_hash IS DISTINCT FROM 'sha256:'||encode(sha256(convert_to(public.workflow_canonical_json(NEW.payload_snapshot),'UTF8')),'hex')
   OR (to_jsonb(NEW)-ARRAY['payload_snapshot','payload_hash','updated_at','released_to_portal_at','updated_by'])
      IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['payload_snapshot','payload_hash','updated_at','released_to_portal_at','updated_by']) THEN
   RAISE EXCEPTION 'Portalquelle wurde nach der persönlichen Erfassung geändert' USING ERRCODE='40001'; END IF;
  NEW.payload_snapshot:=c.payload_snapshot; NEW.payload_hash:=c.payload_hash;
  NEW.updated_at:=OLD.updated_at; NEW.released_to_portal_at:=OLD.released_to_portal_at;
 ELSE
  IF public.is_client_portal_rls_context(t) IS NOT TRUE OR public.current_client_id()::text IS DISTINCT FROM c.payload_snapshot->>'clientId'
   OR NEW.portal_visible IS NOT TRUE OR NEW.portal_release_status<>'released' OR NEW.status<>'pending_review'
   OR (to_jsonb(NEW)-ARRAY['signature_id','payload_snapshot','payload_hash','pdf_storage_path','pdf_hash','portal_release_status','status','updated_at'])
      IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['signature_id','payload_snapshot','payload_hash','pdf_storage_path','pdf_hash','portal_release_status','status','updated_at']) THEN
   RAISE EXCEPTION 'Nur die zugehörige Portalunterschrift darf ergänzt werden' USING ERRCODE='42501'; END IF;
 END IF;
 PERFORM care_security.gkv_assist_deferred_check(c,NEW);
 RETURN NEW;
END $$;
CREATE TRIGGER gkv_assist_deferred_guard BEFORE INSERT OR UPDATE OR DELETE ON public.assist_visit_proofs
 FOR EACH ROW EXECUTE FUNCTION care_security.gkv_assist_deferred_guard();

CREATE FUNCTION care_security.gkv_assist_deferred_state(t uuid,a_id uuid) RETURNS jsonb
 LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE c care_security.gkv_assist_deferred_sources; p public.assist_visit_proofs;
BEGIN
 SELECT * INTO c FROM care_security.gkv_assist_deferred_sources WHERE tenant_id=t AND assignment_id=a_id;
 IF NOT FOUND THEN RETURN NULL; END IF;
 IF c.actor_id IS DISTINCT FROM auth.uid() OR care_security.gkv_employee_self(t) IS DISTINCT FROM c.employee_id THEN
  RAISE EXCEPTION 'Ursprünglicher persönlicher Zugang erforderlich' USING ERRCODE='42501'; END IF;
 SELECT * INTO p FROM public.assist_visit_proofs WHERE tenant_id=t AND id=c.proof_id FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Erfasste Portalquelle fehlt' USING ERRCODE='40001'; END IF;
 PERFORM care_security.gkv_assist_deferred_check(c,p);
 IF p.signature_id IS NULL THEN RETURN jsonb_build_object('phase','awaiting_signature'); END IF;
 IF NOT EXISTS(SELECT 1 FROM public.assignments WHERE tenant_id=t AND id=a_id AND status::text='completed') THEN
  RAISE EXCEPTION 'Einsatzabschluss fehlt' USING ERRCODE='40001'; END IF;
 PERFORM public.workflow_signed_proof_source(t,c.visit_id,p.id,FALSE,FALSE);
 RETURN jsonb_build_object('phase','ready','draft',jsonb_build_object('proofId',p.id,'updatedAt',p.updated_at,'payloadHash',p.payload_hash,'signatureId',p.signature_id));
END $$;

CREATE FUNCTION care_security.gkv_assist_deferred_bind(p public.assist_visit_proofs) RETURNS boolean
 LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE c care_security.gkv_assist_deferred_sources; o care_security.gkv_assist_originals;
BEGIN
 SELECT * INTO c FROM care_security.gkv_assist_deferred_sources WHERE tenant_id=p.tenant_id AND visit_id=p.visit_id;
 IF NOT FOUND THEN RETURN false; END IF;
 SELECT * INTO o FROM care_security.gkv_assist_originals WHERE tenant_id=p.tenant_id AND proof_id=p.id;
 IF NOT FOUND OR o.draft_id IS DISTINCT FROM c.proof_id OR auth.uid() IS DISTINCT FROM c.actor_id
  OR care_security.gkv_employee_self(p.tenant_id) IS DISTINCT FROM c.employee_id OR p.signature_id IS NULL THEN
  RAISE EXCEPTION 'Persönliche Portalquelle gehört nicht zum Abschluss' USING ERRCODE='42501'; END IF;
 PERFORM care_security.gkv_assist_deferred_check(c,p);
 INSERT INTO care_security.gkv_employee_captures(tenant_id,proof_id,visit_id,employee_id,actor_id,session_id,registration_id,
  employee_number,proof_payload_hash,captured_at,service_started_at,service_ended_at,policy)
 VALUES(c.tenant_id,p.id,c.visit_id,c.employee_id,c.actor_id,c.session_id,c.registration_id,c.employee_number,p.payload_hash,
  c.captured_at,c.service_started_at,c.service_ended_at,'personal-deferred-source-15m-v1');
 RETURN true;
END $$;
CREATE FUNCTION care_security.gkv_assist_deferred_provenance(t uuid,p_id uuid) RETURNS jsonb
 LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE c care_security.gkv_assist_deferred_sources; o care_security.gkv_assist_originals; p public.assist_visit_proofs; signed timestamptz;
BEGIN
 SELECT * INTO o FROM care_security.gkv_assist_originals WHERE tenant_id=t AND proof_id=p_id;
 SELECT * INTO c FROM care_security.gkv_assist_deferred_sources WHERE tenant_id=t AND proof_id=o.draft_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Persönliche Portalherkunft fehlt' USING ERRCODE='40001'; END IF;
 SELECT * INTO p FROM public.assist_visit_proofs WHERE tenant_id=t AND id=p_id;
 PERFORM care_security.gkv_assist_deferred_check(c,p);
 SELECT signed_at INTO signed FROM public.assist_visit_signatures WHERE tenant_id=t AND id=p.signature_id;
 RETURN jsonb_build_object('proofId',c.proof_id,'payloadHash',c.payload_hash,'signedAt',signed,'sealedAt',o.sealed_at);
END $$;

ALTER TABLE care_security.gkv_assist_deferred_sources ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON care_security.gkv_assist_deferred_sources FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER gkv_assist_deferred_sources_immutable BEFORE UPDATE OR DELETE ON care_security.gkv_assist_deferred_sources
 FOR EACH ROW EXECUTE FUNCTION care_security.gkv_employee_immutable();
DO $$ DECLARE f regprocedure; BEGIN
 FOR f IN SELECT p.oid::regprocedure FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='care_security' AND p.proname LIKE 'gkv_assist_deferred_%' LOOP
  EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated,service_role',f);
 END LOOP;
END $$;
NOTIFY pgrst,'reload schema';
COMMIT;
