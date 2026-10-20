-- REVIEW DRAFT ONLY, NOT APPLIED. Review with the identity/execution drafts.
-- Installation gate: historical duplicate (tenant,assignment) records require
-- explicit reconciliation. This draft stops; it never deletes/deduplicates rows.
-- App requires the capability contract before its first mutation. Missing RPCs
-- are release blockers, never a reason to fall back to unguarded table INSERTs.
BEGIN;
DO $$ BEGIN
  IF EXISTS(SELECT 1 FROM public.service_records WHERE assignment_id IS NOT NULL
    GROUP BY tenant_id,assignment_id HAVING count(*)>1) THEN
    RAISE EXCEPTION 'Preflight: doppelte Einsatznachweise zuerst fachlich prüfen.';
  END IF;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS workflow_service_record_assignment_unique
  ON public.service_records(tenant_id,assignment_id);
ALTER TABLE public.service_records ADD COLUMN IF NOT EXISTS source_receipt jsonb NOT NULL DEFAULT '{}';

-- PRIVATE server attestation contract. There is intentionally no App-write API
-- or fabricated producer here. A trusted completion worker must read/hash the
-- actual signature/PDF bytes, validate this exact version, then insert once.
-- No existing producer is claimed; until one is implemented/reviewed and this
-- table is populated with verified receipts, both record/billing RPCs fail closed.
CREATE TABLE IF NOT EXISTS public.workflow_proof_attestations (
 tenant_id uuid NOT NULL, assignment_id uuid NOT NULL REFERENCES public.assignments(id),
 visit_id uuid REFERENCES public.assist_visits(id), proof_id uuid REFERENCES public.assist_visit_proofs(id),
 proof_payload_hash text, signature_id uuid REFERENCES public.assist_visit_signatures(id), signature_hash text,
 legacy_documentation_id uuid REFERENCES public.documentation_entries(id),legacy_signature_id uuid REFERENCES public.signatures(id),
 documentation_updated_at timestamptz,signed_at timestamptz NOT NULL,
 service_started_at timestamptz NOT NULL,service_ended_at timestamptz NOT NULL,actual_minutes integer NOT NULL CHECK(actual_minutes>=0),
 pdf_storage_path text NOT NULL CHECK(length(trim(pdf_storage_path))>0),pdf_sha256 text NOT NULL CHECK(pdf_sha256 ~ '^(sha256:)?[0-9a-f]{64}$'),
 verified_at timestamptz NOT NULL DEFAULT clock_timestamp(),producer_contract text NOT NULL CHECK(producer_contract='verified-original-bytes-v1'),
 PRIMARY KEY(tenant_id,assignment_id),CHECK(service_ended_at>=service_started_at)
);
ALTER TABLE public.workflow_proof_attestations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.workflow_proof_attestations FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT ON public.workflow_proof_attestations TO service_role;


-- Same sorted-key JSON contract used by assistExecutionHashService (ASCII keys).
CREATE OR REPLACE FUNCTION public.workflow_canonical_json(v jsonb) RETURNS text
LANGUAGE plpgsql IMMUTABLE SECURITY INVOKER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE result text;
BEGIN
  IF jsonb_typeof(v)='object' THEN
    SELECT '{'||COALESCE(string_agg(to_jsonb(key)::text||':'||public.workflow_canonical_json(value),',' ORDER BY key COLLATE "C"),'')||'}'
      INTO result FROM jsonb_each(v); RETURN result;
  ELSIF jsonb_typeof(v)='array' THEN
    SELECT '['||COALESCE(string_agg(public.workflow_canonical_json(value),',' ORDER BY ord),'')||']'
      INTO result FROM jsonb_array_elements(v) WITH ORDINALITY a(value,ord); RETURN result;
  END IF;
  RETURN v::text;
END $$;
REVOKE ALL ON FUNCTION public.workflow_canonical_json(jsonb) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.workflow_signed_proof_source(t uuid,v_id uuid,p_id uuid,approved boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE v public.assist_visits%ROWTYPE; p public.assist_visit_proofs%ROWTYPE;
 s public.assist_visit_signatures%ROWTYPE; doc public.assist_visit_documentation%ROWTYPE;
 snap jsonb; payload jsonb; task jsonb; r record; paused timestamptz; pause_seconds numeric:=0; seconds integer; a public.workflow_proof_attestations%ROWTYPE; result jsonb;
BEGIN
  SELECT * INTO v FROM public.assist_visits WHERE tenant_id=t AND id=v_id FOR SHARE;
  IF NOT FOUND OR v.canonical_status<>'completed' OR v.actual_start_at IS NULL OR v.actual_end_at IS NULL
    OR NOT isfinite(v.actual_start_at) OR NOT isfinite(v.actual_end_at)
    OR v.actual_end_at<v.actual_start_at OR v.actual_end_at>clock_timestamp() THEN
    RAISE EXCEPTION 'Bestätigter Einsatzabschluss mit tatsächlichem Zeitpaar fehlt.';
  END IF;
  SELECT * INTO p FROM public.assist_visit_proofs WHERE tenant_id=t AND visit_id=v_id AND id=p_id FOR SHARE;
  IF NOT FOUND OR p.signature_id IS NULL OR p.status NOT IN ('pending_review','approved','exported')
    OR (approved AND (p.status NOT IN ('approved','exported') OR p.approved_at IS NULL OR p.approved_by IS NULL)) THEN
    RAISE EXCEPTION 'Bestätigter signierter Nachweis fehlt.';
  END IF;
  snap:=p.payload_snapshot;
  IF jsonb_typeof(snap)<>'object' OR p.payload_hash IS DISTINCT FROM
    'sha256:'||encode(sha256(convert_to(public.workflow_canonical_json(snap),'UTF8')),'hex')
    OR snap->>'visitId' IS DISTINCT FROM v.id::text OR snap->>'clientId' IS DISTINCT FROM v.client_id::text
    OR snap->>'employeeId' IS DISTINCT FROM v.employee_id::text
    OR (snap#>>'{visitTimes,serviceStartedAt}')::timestamptz IS DISTINCT FROM v.actual_start_at
    OR (snap#>>'{visitTimes,serviceEndedAt}')::timestamptz IS DISTINCT FROM v.actual_end_at
    OR (snap->>'plannedStartAt')::timestamptz IS DISTINCT FROM v.planned_start_at
    OR (snap->>'plannedEndAt')::timestamptz IS DISTINCT FROM v.planned_end_at THEN
    RAISE EXCEPTION 'Nachweisfassung oder tatsächliche Einsatzzeit stimmt nicht überein.';
  END IF;
  SELECT * INTO doc FROM public.assist_visit_documentation WHERE tenant_id=t AND visit_id=v_id FOR SHARE;
  SELECT * INTO s FROM public.assist_visit_signatures WHERE id=p.signature_id AND tenant_id=t AND visit_id=v_id FOR SHARE;
  IF NOT FOUND OR NOT s.is_valid OR s.invalidated_at IS NOT NULL OR NULLIF(s.storage_path,'') IS NULL
    OR COALESCE(s.signature_hash,'') !~ '^sha256:[0-9a-f]{64}$' OR doc.submitted_at IS NULL OR NULLIF(trim(doc.short_description),'') IS NULL
    OR s.signed_at<doc.submitted_at OR s.signed_at<v.actual_end_at OR s.signed_at>clock_timestamp()
    OR COALESCE(snap->>'documentationNote',snap->>'documentation') IS DISTINCT FROM trim(doc.short_description)
    OR snap#>>'{signature,signerName}' IS DISTINCT FROM s.signer_name
    OR (snap#>>'{signature,signedAt}')::timestamptz IS DISTINCT FROM s.signed_at THEN
    RAISE EXCEPTION 'Aktuelle Unterschrift und Dokumentationsfassung fehlen.';
  END IF;
  IF jsonb_typeof(snap->'tasks')<>'array' THEN RAISE EXCEPTION 'Aufgabenfassung fehlt.'; END IF;
  SELECT COALESCE(jsonb_agg(jsonb_build_object('taskId',x->>'id','status',x->>'status') ORDER BY n),'[]') INTO task
    FROM jsonb_array_elements(snap->'tasks') WITH ORDINALITY a(x,n);
  IF EXISTS((SELECT x->>'id',x->>'status' FROM jsonb_array_elements(snap->'tasks') x
      EXCEPT SELECT id::text,status::text FROM public.assist_visit_tasks WHERE tenant_id=t AND visit_id=v_id)
    UNION ALL (SELECT id::text,status::text FROM public.assist_visit_tasks WHERE tenant_id=t AND visit_id=v_id
      EXCEPT SELECT x->>'id',x->>'status' FROM jsonb_array_elements(snap->'tasks') x)) THEN
    RAISE EXCEPTION 'Aufgabenfassung wurde geändert.';
  END IF;
  payload:=jsonb_build_object('visitId',v.id,'clientId',v.client_id,'employeeId',v.employee_id,
    'plannedStartAt',snap->>'plannedStartAt','plannedEndAt',snap->>'plannedEndAt',
    'taskStatuses',task,'documentationNote',NULLIF(trim(doc.short_description),''));
  IF s.payload_hash IS DISTINCT FROM 'sha256:'||encode(sha256(convert_to(public.workflow_canonical_json(payload),'UTF8')),'hex') THEN
    RAISE EXCEPTION 'Unterschrift gehört nicht zu dieser Nachweisfassung.';
  END IF;
  -- Count every real pause once; no minimum minute, planned-time fallback or
  -- additional subtraction of an already-net serviceSeconds snapshot.
  FOR r IN SELECT event_type,occurred_at FROM public.assist_time_events WHERE tenant_id=t AND visit_id=v_id
    AND occurred_at BETWEEN v.actual_start_at AND v.actual_end_at ORDER BY occurred_at,id LOOP
    IF r.event_type='pause_start' AND paused IS NULL THEN paused:=r.occurred_at;
    ELSIF r.event_type IN ('pause_end','service_end') AND paused IS NOT NULL THEN
      pause_seconds:=pause_seconds+extract(epoch FROM r.occurred_at-paused); paused:=NULL;
    END IF;
  END LOOP;
  IF paused IS NOT NULL THEN pause_seconds:=pause_seconds+extract(epoch FROM v.actual_end_at-paused); END IF;
  seconds:=round(GREATEST(0,extract(epoch FROM v.actual_end_at-v.actual_start_at)-pause_seconds));
  IF (snap#>>'{visitTimes,serviceSeconds}')::numeric IS DISTINCT FROM seconds::numeric THEN
    RAISE EXCEPTION 'Gespeicherte Leistungsdauer entspricht nicht den vollständigen Zeitereignissen.';
  END IF;
  SELECT * INTO a FROM public.workflow_proof_attestations WHERE tenant_id=t AND visit_id=v_id AND proof_id=p_id FOR SHARE;
  IF NOT FOUND OR a.proof_payload_hash IS DISTINCT FROM p.payload_hash OR a.signature_id IS DISTINCT FROM s.id
    OR a.signature_hash IS DISTINCT FROM s.signature_hash OR a.signed_at IS DISTINCT FROM s.signed_at
    OR a.service_started_at IS DISTINCT FROM v.actual_start_at OR a.service_ended_at IS DISTINCT FROM v.actual_end_at
    OR a.actual_minutes IS DISTINCT FROM round(seconds/60.0)::integer OR a.pdf_storage_path IS DISTINCT FROM p.pdf_storage_path
    OR a.pdf_sha256 IS DISTINCT FROM p.pdf_hash OR a.verified_at<s.signed_at OR a.verified_at>clock_timestamp()
    OR a.assignment_id NOT IN (v.id,COALESCE(v.legacy_assignment_id,v.id)) OR a.producer_contract<>'verified-original-bytes-v1' THEN
    RAISE EXCEPTION 'Vertrauenswürdige Original-/PDF-Bytebestätigung fehlt; Abschlussvorbereitung ist gesperrt.'; END IF;
  RETURN jsonb_build_object('version','workflow-assignment-record-v1','tenant_id',t,'visit_id',v_id,
    'proof_id',p.id,'proof_payload_hash',p.payload_hash,'signature_id',s.id,'signature_payload_hash',s.payload_hash,
    'client_id',v.client_id,'employee_id',v.employee_id,'service_started_at',v.actual_start_at,
    'service_ended_at',v.actual_end_at,'actual_minutes',round(seconds/60.0)::integer,
    'pdf_storage_path',a.pdf_storage_path,'pdf_sha256',a.pdf_sha256,'attested_at',a.verified_at);
END $$;
REVOKE ALL ON FUNCTION public.workflow_signed_proof_source(uuid,uuid,uuid,boolean) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.workflow_assignment_record_capability() RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$ BEGIN
  IF auth.uid() IS NULL OR public.current_tenant_id() IS NULL THEN RAISE EXCEPTION 'Anmeldung erforderlich.' USING ERRCODE='42501'; END IF;
  RETURN 'workflow-assignment-record-v1';
END $$;
CREATE OR REPLACE FUNCTION public.workflow_prepare_assignment_service_record(p_tenant_id uuid,p_assignment_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE a public.assignments%ROWTYPE; v public.assist_visits%ROWTYPE; d public.documentation_entries%ROWTYPE;
 s public.signatures%ROWTYPE; existing public.service_records%ROWTYPE; receipt jsonb; p_id uuid; employee uuid;
 r record; paused timestamptz; pause_seconds numeric:=0; att public.workflow_proof_attestations%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR p_tenant_id IS DISTINCT FROM public.current_tenant_id() THEN
    RAISE EXCEPTION 'Ungültiger Mandant.' USING ERRCODE='42501'; END IF;
  SELECT * INTO a FROM public.assignments WHERE tenant_id=p_tenant_id AND id=p_assignment_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Einsatz nicht verfügbar.' USING ERRCODE='42501'; END IF;
  IF COALESCE(public.current_portal_type(),'')='employee' THEN
    employee:=public.resolve_current_employee_id();
    IF employee IS NULL OR employee IS DISTINCT FROM a.employee_id OR NOT EXISTS(SELECT 1 FROM public.employee_portal_accounts e
      WHERE e.id=public.current_portal_account_id() AND e.tenant_id=p_tenant_id AND e.employee_id=employee
        AND e.auth_user_id=auth.uid() AND e.status='active') THEN RAISE EXCEPTION 'Aktive eigene Einsatzzuordnung fehlt.' USING ERRCODE='42501'; END IF;
  ELSIF COALESCE(public.current_portal_type(),'business')<>'business' OR NOT COALESCE(public.is_internal_tenant_actor(p_tenant_id),FALSE)
    OR NOT COALESCE(public.has_permission('assist.records.create'),FALSE) THEN RAISE EXCEPTION 'Keine Nachweisberechtigung.' USING ERRCODE='42501'; END IF;
  IF a.status::text<>'completed' OR a.actual_start_at IS NULL OR a.actual_end_at IS NULL
    OR NOT isfinite(a.actual_start_at) OR NOT isfinite(a.actual_end_at) OR a.actual_end_at<a.actual_start_at
    OR a.actual_end_at>clock_timestamp() THEN RAISE EXCEPTION 'Tatsächlicher Einsatzabschluss fehlt.'; END IF;
  IF (SELECT count(*) FROM public.assist_visits WHERE tenant_id=p_tenant_id AND (id=a.id OR legacy_assignment_id=a.id))>1 THEN
    RAISE EXCEPTION 'Mehrdeutige Einsatzzuordnung.'; END IF;
  SELECT * INTO v FROM public.assist_visits WHERE tenant_id=p_tenant_id AND (id=a.id OR legacy_assignment_id=a.id) FOR SHARE;
  IF FOUND THEN
    IF v.client_id IS DISTINCT FROM a.client_id OR v.employee_id IS DISTINCT FROM a.employee_id
      OR v.actual_start_at IS DISTINCT FROM a.actual_start_at OR v.actual_end_at IS DISTINCT FROM a.actual_end_at THEN
      RAISE EXCEPTION 'Kanonische Einsatzzuordnung wurde verändert.'; END IF;
    SELECT id INTO p_id FROM public.assist_visit_proofs WHERE tenant_id=p_tenant_id AND visit_id=v.id
      AND status IN ('pending_review','approved','exported') ORDER BY created_at DESC,id DESC LIMIT 1;
    receipt:=public.workflow_signed_proof_source(p_tenant_id,v.id,p_id,FALSE);
  ELSE
    SELECT * INTO d FROM public.documentation_entries WHERE tenant_id=p_tenant_id AND assignment_id=a.id AND client_id=a.client_id
      AND employee_id IS NOT DISTINCT FROM a.employee_id AND status::text IN ('saved','signature_required','completed','approved')
      AND NULLIF(trim(free_text),'') IS NOT NULL ORDER BY updated_at DESC,id DESC LIMIT 1 FOR SHARE;
    SELECT * INTO s FROM public.signatures WHERE tenant_id=p_tenant_id AND assignment_id=a.id AND documentation_entry_id=d.id
      AND client_id=a.client_id AND employee_id IS NOT DISTINCT FROM a.employee_id AND status::text='signed'
      AND NULLIF(trim(signature_data),'') IS NOT NULL AND length(trim(signer_name))>=2 AND signed_at>=d.updated_at
      AND signed_at>=a.actual_end_at AND signed_at<=clock_timestamp() ORDER BY signed_at DESC,id DESC LIMIT 1 FOR SHARE;
    IF NOT FOUND OR d.id IS NULL THEN RAISE EXCEPTION 'Aktuelle Dokumentation und Unterschrift fehlen.'; END IF;
    FOR r IN SELECT entry_type,event_at FROM public.time_entries WHERE tenant_id=p_tenant_id AND assignment_id=a.id
      AND event_at BETWEEN a.actual_start_at AND a.actual_end_at ORDER BY event_at,id LOOP
      IF r.entry_type::text='paused' AND paused IS NULL THEN paused:=r.event_at;
      ELSIF r.entry_type::text IN ('resumed','finished') AND paused IS NOT NULL THEN
        pause_seconds:=pause_seconds+extract(epoch FROM r.event_at-paused); paused:=NULL;
      END IF;
    END LOOP;
    IF paused IS NOT NULL THEN pause_seconds:=pause_seconds+extract(epoch FROM a.actual_end_at-paused); END IF;
    SELECT * INTO att FROM public.workflow_proof_attestations WHERE tenant_id=p_tenant_id AND assignment_id=a.id FOR SHARE;
    IF NOT FOUND OR att.proof_id IS NOT NULL OR att.legacy_documentation_id IS DISTINCT FROM d.id OR att.legacy_signature_id IS DISTINCT FROM s.id
      OR att.documentation_updated_at IS DISTINCT FROM d.updated_at OR att.signed_at IS DISTINCT FROM s.signed_at
      OR att.proof_payload_hash IS DISTINCT FROM 'sha256:'||encode(sha256(convert_to(d.free_text,'UTF8')),'hex')
      OR att.signature_hash IS DISTINCT FROM 'sha256:'||encode(sha256(convert_to(s.signature_data,'UTF8')),'hex')
      OR att.service_started_at IS DISTINCT FROM a.actual_start_at OR att.service_ended_at IS DISTINCT FROM a.actual_end_at
      OR att.actual_minutes IS DISTINCT FROM round(GREATEST(0,extract(epoch FROM a.actual_end_at-a.actual_start_at)-pause_seconds)/60)::integer
      OR att.verified_at<s.signed_at OR att.verified_at>clock_timestamp() OR att.producer_contract<>'verified-original-bytes-v1' THEN
      RAISE EXCEPTION 'Vertrauenswürdige Original-/PDF-Bytebestätigung fehlt; Abschlussvorbereitung ist gesperrt.'; END IF;
    receipt:=jsonb_build_object('version','workflow-assignment-record-v1','tenant_id',p_tenant_id,'assignment_id',a.id,
      'client_id',a.client_id,'employee_id',a.employee_id,'service_started_at',a.actual_start_at,'service_ended_at',a.actual_end_at,
      'actual_minutes',round(GREATEST(0,extract(epoch FROM a.actual_end_at-a.actual_start_at)-pause_seconds)/60)::integer,
      'documentation_entry_id',d.id,'legacy_signature_id',s.id,'documentation_updated_at',d.updated_at,'signed_at',s.signed_at,
      'pdf_storage_path',att.pdf_storage_path,'pdf_sha256',att.pdf_sha256,'attested_at',att.verified_at);
  END IF;
  receipt:=receipt||jsonb_build_object('assignment_id',a.id);
  SELECT * INTO existing FROM public.service_records WHERE tenant_id=p_tenant_id AND assignment_id=a.id FOR UPDATE;
  IF FOUND THEN
    IF existing.source_receipt IS DISTINCT FROM receipt OR existing.client_id IS DISTINCT FROM a.client_id
      OR existing.employee_id IS DISTINCT FROM a.employee_id OR existing.actual_minutes IS DISTINCT FROM (receipt->>'actual_minutes')::int THEN
      RAISE EXCEPTION 'Vorhandener Nachweis muss fachlich abgeglichen werden; keine Überschreibung.'; END IF;
    RETURN receipt||jsonb_build_object('id',existing.id);
  END IF;
  INSERT INTO public.service_records(tenant_id,assignment_id,assist_visit_id,client_id,employee_id,product_key,service_date,
    actual_minutes,planned_minutes,status,documentation_entry_id,signature_id,source_receipt)
  VALUES(p_tenant_id,a.id,v.id,a.client_id,a.employee_id,'assist',(a.actual_start_at AT TIME ZONE 'Europe/Berlin')::date,
    (receipt->>'actual_minutes')::int,NULL,'draft',d.id,s.id,receipt) RETURNING * INTO existing;
  -- s.id is ONLY the legacy signatures FK; canonical signature is in receipt.
  RETURN receipt||jsonb_build_object('id',existing.id);
END $$;

CREATE OR REPLACE FUNCTION public.workflow_verify_billing_proof(p_tenant_id uuid,p_proof_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$ DECLARE v_id uuid; BEGIN
  IF auth.uid() IS NULL OR p_tenant_id IS DISTINCT FROM public.current_tenant_id()
    OR COALESCE(public.current_portal_type(),'business')<>'business' OR NOT COALESCE(public.is_internal_tenant_actor(p_tenant_id),FALSE)
    OR NOT COALESCE(public.has_permission('office.clients.edit'),FALSE) THEN RAISE EXCEPTION 'Keine Abrechnungsberechtigung.' USING ERRCODE='42501'; END IF;
  SELECT visit_id INTO v_id FROM public.assist_visit_proofs WHERE tenant_id=p_tenant_id AND id=p_proof_id;
  RETURN public.workflow_signed_proof_source(p_tenant_id,v_id,p_proof_id,TRUE);
END $$;

CREATE OR REPLACE FUNCTION public.workflow_guard_billing_candidate_source() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$ DECLARE receipt jsonb; BEGIN
  receipt:=public.workflow_verify_billing_proof(NEW.tenant_id,NEW.proof_id);
  IF NEW.source_snapshot->'confirmedSource' IS DISTINCT FROM receipt OR NEW.visit_id::text IS DISTINCT FROM receipt->>'visit_id'
    OR NEW.client_id::text IS DISTINCT FROM receipt->>'client_id' OR NEW.billing_period_start IS DISTINCT FROM (receipt->>'service_started_at')::timestamptz
    OR NEW.billing_period_end IS DISTINCT FROM (receipt->>'service_ended_at')::timestamptz
    OR NEW.duration_minutes IS DISTINCT FROM (receipt->>'actual_minutes')::int THEN RAISE EXCEPTION 'Abrechnung gehört nicht zur bestätigten Nachweisfassung.'; END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS workflow_billing_candidate_source_guard ON public.client_billing_candidates;
CREATE TRIGGER workflow_billing_candidate_source_guard BEFORE INSERT OR UPDATE ON public.client_billing_candidates
  FOR EACH ROW EXECUTE FUNCTION public.workflow_guard_billing_candidate_source();
CREATE OR REPLACE FUNCTION public.workflow_guard_bound_proof_version() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$ BEGIN
  IF OLD.status IN ('approved','exported') OR EXISTS(SELECT 1 FROM public.client_billing_candidates WHERE tenant_id=OLD.tenant_id AND proof_id=OLD.id)
    OR EXISTS(SELECT 1 FROM public.service_records WHERE tenant_id=OLD.tenant_id AND source_receipt->>'proof_id'=OLD.id::text) THEN
    IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Bestätigte Nachweisfassung darf nicht gelöscht werden.'; END IF;
    IF NEW.payload_snapshot IS DISTINCT FROM OLD.payload_snapshot OR NEW.payload_hash IS DISTINCT FROM OLD.payload_hash
      OR NEW.signature_id IS DISTINCT FROM OLD.signature_id OR NEW.tenant_id IS DISTINCT FROM OLD.tenant_id
      OR NEW.visit_id IS DISTINCT FROM OLD.visit_id OR NEW.id IS DISTINCT FROM OLD.id OR NEW.status NOT IN ('approved','exported',OLD.status)
      THEN RAISE EXCEPTION 'Bestätigte Nachweisfassung ist unveränderlich; neue Fassung erforderlich.'; END IF;
  END IF;
  RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
END $$;
DROP TRIGGER IF EXISTS workflow_bound_proof_version_guard ON public.assist_visit_proofs;
CREATE TRIGGER workflow_bound_proof_version_guard BEFORE UPDATE OR DELETE ON public.assist_visit_proofs
  FOR EACH ROW EXECUTE FUNCTION public.workflow_guard_bound_proof_version();

-- Portal/direct INSERT cannot bypass the atomic RPC. Business review of status,
-- price or approval remains possible under the existing permissive policies,
-- narrowed to a verified business actor; source identity/time stays immutable.
ALTER TABLE public.service_records ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS workflow_service_record_insert_ceiling ON public.service_records;
CREATE POLICY workflow_service_record_insert_ceiling ON public.service_records AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK(FALSE);
DROP POLICY IF EXISTS workflow_service_record_update_ceiling ON public.service_records;
CREATE POLICY workflow_service_record_update_ceiling ON public.service_records AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (tenant_id=public.current_tenant_id() AND COALESCE(public.current_portal_type(),'business')='business'
    AND public.is_internal_tenant_actor(tenant_id) AND public.has_permission('assist.records.create'))
  WITH CHECK (tenant_id=public.current_tenant_id() AND COALESCE(public.current_portal_type(),'business')='business'
    AND public.is_internal_tenant_actor(tenant_id) AND public.has_permission('assist.records.create'));
DROP POLICY IF EXISTS workflow_service_record_delete_ceiling ON public.service_records;
CREATE POLICY workflow_service_record_delete_ceiling ON public.service_records AS RESTRICTIVE FOR DELETE TO authenticated
  USING (source_receipt='{}'::jsonb AND tenant_id=public.current_tenant_id() AND COALESCE(public.current_portal_type(),'business')='business'
    AND public.is_internal_tenant_actor(tenant_id) AND public.has_permission('assist.records.create'));
CREATE OR REPLACE FUNCTION public.workflow_guard_service_record_receipt() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public,pg_temp AS $$ BEGIN
  IF TG_OP='DELETE' THEN
    IF OLD.source_receipt<>'{}'::jsonb THEN RAISE EXCEPTION 'Bestätigter Einsatznachweis darf nicht gelöscht werden.'; END IF;
    RETURN OLD;
  END IF;
  IF OLD.source_receipt<>'{}'::jsonb AND (NEW.id IS DISTINCT FROM OLD.id OR NEW.tenant_id IS DISTINCT FROM OLD.tenant_id
    OR NEW.assignment_id IS DISTINCT FROM OLD.assignment_id OR NEW.assist_visit_id IS DISTINCT FROM OLD.assist_visit_id
    OR NEW.client_id IS DISTINCT FROM OLD.client_id OR NEW.employee_id IS DISTINCT FROM OLD.employee_id
    OR NEW.actual_minutes IS DISTINCT FROM OLD.actual_minutes OR NEW.service_date IS DISTINCT FROM OLD.service_date
    OR NEW.source_receipt IS DISTINCT FROM OLD.source_receipt OR NEW.documentation_entry_id IS DISTINCT FROM OLD.documentation_entry_id
    OR NEW.signature_id IS DISTINCT FROM OLD.signature_id OR NEW.product_key IS DISTINCT FROM OLD.product_key) THEN
    RAISE EXCEPTION 'Bestätigte Einsatznachweisquelle ist unveränderlich; fachliche Korrektur erforderlich.';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS workflow_service_record_receipt_guard ON public.service_records;
CREATE TRIGGER workflow_service_record_receipt_guard BEFORE UPDATE OR DELETE ON public.service_records
  FOR EACH ROW EXECUTE FUNCTION public.workflow_guard_service_record_receipt();
REVOKE ALL ON FUNCTION public.workflow_assignment_record_capability(), public.workflow_prepare_assignment_service_record(uuid,uuid),
  public.workflow_verify_billing_proof(uuid,uuid), public.workflow_guard_billing_candidate_source(),public.workflow_guard_bound_proof_version(),public.workflow_guard_service_record_receipt() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.workflow_assignment_record_capability(),public.workflow_prepare_assignment_service_record(uuid,uuid),
  public.workflow_verify_billing_proof(uuid,uuid) TO authenticated,service_role;
-- No invoices, payments, automatic approval, backfill or production application.
COMMIT;
