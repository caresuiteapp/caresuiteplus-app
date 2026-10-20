BEGIN;
CREATE SCHEMA cs_sr_test_20261013;
SET LOCAL search_path=cs_sr_test_20261013,pg_catalog;
GRANT USAGE ON SCHEMA cs_sr_test_20261013 TO authenticated,anon,service_role;
CREATE FUNCTION current_tenant_id() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('cs_test.tenant',true),'')::uuid $$;
CREATE FUNCTION current_portal_type() RETURNS text LANGUAGE sql AS $$ SELECT nullif(current_setting('cs_test.portal',true),'') $$;
CREATE FUNCTION current_portal_account_id() RETURNS uuid LANGUAGE sql AS $$ SELECT '10000000-0000-4000-8000-000000000004'::uuid $$;
CREATE FUNCTION resolve_current_employee_id() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('cs_test.employee',true),'')::uuid $$;
CREATE TABLE roles(id uuid,tenant_id uuid,key text);
CREATE TABLE role_permissions(role_id uuid,permission_key text,can_create boolean);
CREATE TABLE profiles(id uuid,auth_user_id uuid,tenant_id uuid,role_id uuid,is_active boolean,status text);
CREATE TABLE tenants(id uuid,name text,legal_name text);
CREATE TABLE clients(id uuid,tenant_id uuid,full_name text,first_name text,last_name text);
CREATE TABLE employees(id uuid,tenant_id uuid,full_name text,first_name text,last_name text);
CREATE TABLE assignment_tasks(id uuid,tenant_id uuid,assignment_id uuid,title text,status text,not_done_reason text);
CREATE TABLE storage_objects(bucket_id text,name text);
ALTER TABLE storage_objects ENABLE ROW LEVEL SECURITY;
GRANT SELECT,INSERT,UPDATE,DELETE ON storage_objects TO authenticated,service_role;
CREATE POLICY old_storage_allow ON storage_objects FOR ALL TO authenticated USING(TRUE) WITH CHECK(TRUE);
CREATE TABLE employee_portal_accounts(id uuid,tenant_id uuid,employee_id uuid,auth_user_id uuid,status text);
CREATE TABLE assignments(id uuid PRIMARY KEY,tenant_id uuid,client_id uuid,employee_id uuid,status text,actual_start_at timestamptz,actual_end_at timestamptz);
CREATE TABLE assist_visits(id uuid PRIMARY KEY,tenant_id uuid,legacy_assignment_id uuid,client_id uuid,employee_id uuid,canonical_status text,
 actual_start_at timestamptz,actual_end_at timestamptz,planned_start_at timestamptz,planned_end_at timestamptz);
CREATE TABLE assist_visit_documentation(id uuid DEFAULT gen_random_uuid(),tenant_id uuid,visit_id uuid,short_description text,submitted_at timestamptz);
CREATE TABLE assist_visit_tasks(id uuid,tenant_id uuid,visit_id uuid,status text);
CREATE TABLE assist_time_events(id uuid DEFAULT gen_random_uuid(),tenant_id uuid,visit_id uuid,event_type text,occurred_at timestamptz);
CREATE TABLE assist_visit_signatures(id uuid PRIMARY KEY,tenant_id uuid,visit_id uuid,payload_hash text,signature_hash text,storage_path text,
 signer_name text,signer_role text,signed_at timestamptz,is_valid boolean,invalidated_at timestamptz);
CREATE TABLE assist_visit_proofs(id uuid PRIMARY KEY,tenant_id uuid,visit_id uuid,signature_id uuid REFERENCES assist_visit_signatures(id),status text,
 payload_snapshot jsonb,payload_hash text,pdf_storage_path text,pdf_hash text,approved_at timestamptz,approved_by uuid,created_at timestamptz DEFAULT now());
CREATE TABLE documentation_entries(id uuid PRIMARY KEY,tenant_id uuid,assignment_id uuid,client_id uuid,employee_id uuid,status text,free_text text,updated_at timestamptz);
CREATE TABLE time_entries(id uuid DEFAULT gen_random_uuid(),tenant_id uuid,assignment_id uuid,entry_type text,event_at timestamptz);
CREATE TABLE signatures(id uuid PRIMARY KEY,tenant_id uuid,assignment_id uuid,documentation_entry_id uuid,client_id uuid,employee_id uuid,status text,
 signature_data text,signer_name text,signed_at timestamptz);
CREATE TABLE service_records(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid,assignment_id uuid REFERENCES assignments(id),
 assist_visit_id uuid REFERENCES assist_visits(id),client_id uuid,employee_id uuid,product_key text,service_date date,actual_minutes integer,
 planned_minutes integer,status text,documentation_entry_id uuid REFERENCES documentation_entries(id),signature_id uuid REFERENCES signatures(id));
CREATE TABLE client_billing_candidates(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid,proof_id uuid,visit_id uuid,client_id uuid,
 billing_period_start timestamptz,billing_period_end timestamptz,duration_minutes integer,source_snapshot jsonb,UNIQUE(tenant_id,proof_id));
GRANT SELECT,INSERT,UPDATE,DELETE ON client_billing_candidates,service_records TO authenticated;
GRANT SELECT,UPDATE,DELETE ON assist_visit_proofs TO authenticated;
CREATE POLICY legacy_permissive_records ON service_records FOR ALL TO authenticated USING(TRUE) WITH CHECK(TRUE);

ALTER TABLE assist_visit_tasks ADD COLUMN title text,ADD COLUMN not_done_reason text;
ALTER TABLE assist_visit_proofs ADD COLUMN billing_released boolean DEFAULT FALSE,ADD COLUMN portal_visible boolean DEFAULT FALSE,ADD COLUMN updated_at timestamptz DEFAULT now();
ALTER TABLE service_records ENABLE ROW LEVEL SECURITY;
-- Canonical signed Assist proof completion. No approval, invoice or backfill.
CREATE OR REPLACE FUNCTION cs_sr_test_20261013.workflow_record_actor_allowed(t uuid,employee uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT auth.uid() IS NOT NULL AND t=cs_sr_test_20261013.current_tenant_id() AND (
   (cs_sr_test_20261013.current_portal_type()='employee' AND employee IS NOT NULL AND employee=cs_sr_test_20261013.resolve_current_employee_id()
     AND EXISTS(SELECT 1 FROM cs_sr_test_20261013.employee_portal_accounts e WHERE e.id=cs_sr_test_20261013.current_portal_account_id()
       AND e.tenant_id=t AND e.employee_id=employee AND e.auth_user_id=auth.uid() AND e.status='active'))
   OR (COALESCE(cs_sr_test_20261013.current_portal_type(),'business')='business' AND EXISTS(
     SELECT 1 FROM cs_sr_test_20261013.profiles p JOIN cs_sr_test_20261013.roles r ON r.id=p.role_id JOIN cs_sr_test_20261013.role_permissions rp ON rp.role_id=r.id
     WHERE (p.auth_user_id=auth.uid() OR (p.auth_user_id IS NULL AND p.id=auth.uid())) AND p.tenant_id=t
       AND p.is_active AND p.status::text='active' AND (r.tenant_id IS NULL OR r.tenant_id=t)
       AND r.key NOT IN ('employee_portal','client_portal','family_portal')
       AND (rp.permission_key='assist.records.create' OR (rp.permission_key='records' AND COALESCE(rp.can_create,FALSE))))));
$$;
REVOKE ALL ON FUNCTION cs_sr_test_20261013.workflow_record_actor_allowed(uuid,uuid) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION cs_sr_test_20261013.workflow_task_state(s text) RETURNS text
LANGUAGE sql IMMUTABLE SECURITY INVOKER SET search_path=pg_catalog AS $$
 SELECT CASE WHEN s IN ('done','open','cancelled') THEN s
   WHEN s IN ('not_requested','not_wanted','skipped') THEN 'not_requested' ELSE 'not_done' END
$$;
REVOKE ALL ON FUNCTION cs_sr_test_20261013.workflow_task_state(text) FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION cs_sr_test_20261013.workflow_tasks_match(tasks jsonb,t uuid,v uuid,a uuid,legacy boolean)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path=pg_catalog AS $$
 WITH expected AS (SELECT x->>'id' id,x->>'title' title,cs_sr_test_20261013.workflow_task_state(x->>'status') status,
   COALESCE(NULLIF(trim(x->>'completionNote'),''),NULLIF(trim(x->>'note'),''),'') note FROM jsonb_array_elements(tasks) x),
 actual AS (SELECT id::text,title,cs_sr_test_20261013.workflow_task_state(status::text) status,COALESCE(NULLIF(trim(not_done_reason),''),'') note
   FROM cs_sr_test_20261013.assist_visit_tasks WHERE NOT legacy AND tenant_id=t AND visit_id=v
   UNION ALL SELECT id::text,title,cs_sr_test_20261013.workflow_task_state(status::text),COALESCE(NULLIF(trim(not_done_reason),''),'')
   FROM cs_sr_test_20261013.assignment_tasks WHERE legacy AND tenant_id=t AND assignment_id=COALESCE(a,v))
 SELECT jsonb_typeof(tasks)='array' AND NOT EXISTS((SELECT * FROM expected EXCEPT SELECT * FROM actual)
   UNION ALL (SELECT * FROM actual EXCEPT SELECT * FROM expected))
   AND (SELECT count(*) FROM expected)=(SELECT count(*) FROM actual);
$$;
REVOKE ALL ON FUNCTION cs_sr_test_20261013.workflow_tasks_match(jsonb,uuid,uuid,uuid,boolean) FROM PUBLIC,anon,authenticated;

DO $$ BEGIN
  IF EXISTS(SELECT 1 FROM cs_sr_test_20261013.service_records WHERE assignment_id IS NOT NULL
    GROUP BY tenant_id,assignment_id HAVING count(*)>1) THEN
    RAISE EXCEPTION 'Preflight: doppelte Einsatznachweise zuerst fachlich prüfen.';
  END IF;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS workflow_service_record_assignment_unique
  ON cs_sr_test_20261013.service_records(tenant_id,assignment_id);
ALTER TABLE cs_sr_test_20261013.service_records ADD COLUMN IF NOT EXISTS source_receipt jsonb NOT NULL DEFAULT '{}';

-- PRIVATE server attestation contract. There is intentionally no App-write API
-- or fabricated producer here. A trusted completion worker must read/hash the
-- actual signature/PDF bytes, validate this exact version, then insert once.
-- The complete-assist-service-record worker verifies actual bytes before
-- calling the service-role-only commit function. No client may attest.
CREATE TABLE IF NOT EXISTS cs_sr_test_20261013.workflow_proof_attestations (
 tenant_id uuid NOT NULL, assignment_id uuid NOT NULL REFERENCES cs_sr_test_20261013.assignments(id),
 visit_id uuid REFERENCES cs_sr_test_20261013.assist_visits(id), proof_id uuid REFERENCES cs_sr_test_20261013.assist_visit_proofs(id),
 proof_payload_hash text, signature_id uuid REFERENCES cs_sr_test_20261013.assist_visit_signatures(id), signature_hash text,
 legacy_documentation_id uuid REFERENCES cs_sr_test_20261013.documentation_entries(id),legacy_signature_id uuid REFERENCES cs_sr_test_20261013.signatures(id),
 documentation_updated_at timestamptz,signed_at timestamptz NOT NULL,
 service_started_at timestamptz NOT NULL,service_ended_at timestamptz NOT NULL,actual_minutes integer NOT NULL CHECK(actual_minutes>=0),
 pdf_storage_path text NOT NULL CHECK(length(trim(pdf_storage_path))>0),pdf_sha256 text NOT NULL CHECK(pdf_sha256 ~ '^(sha256:)?[0-9a-f]{64}$'),
 verified_at timestamptz NOT NULL DEFAULT clock_timestamp(),producer_contract text NOT NULL CHECK(producer_contract='verified-original-bytes-v1'),
 PRIMARY KEY(tenant_id,assignment_id),CHECK(service_ended_at>=service_started_at)
);
ALTER TABLE cs_sr_test_20261013.workflow_proof_attestations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON cs_sr_test_20261013.workflow_proof_attestations FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT ON cs_sr_test_20261013.workflow_proof_attestations TO service_role;


-- Same sorted-key JSON contract used by assistExecutionHashService (ASCII keys).
CREATE OR REPLACE FUNCTION cs_sr_test_20261013.workflow_canonical_json(v jsonb) RETURNS text
LANGUAGE plpgsql IMMUTABLE SECURITY INVOKER SET search_path=pg_catalog AS $$
DECLARE result text;
BEGIN
  IF jsonb_typeof(v)='object' THEN
    SELECT '{'||COALESCE(string_agg(to_jsonb(key)::text||':'||cs_sr_test_20261013.workflow_canonical_json(value),',' ORDER BY key COLLATE "C"),'')||'}'
      INTO result FROM jsonb_each(v); RETURN result;
  ELSIF jsonb_typeof(v)='array' THEN
    SELECT '['||COALESCE(string_agg(cs_sr_test_20261013.workflow_canonical_json(value),',' ORDER BY ord),'')||']'
      INTO result FROM jsonb_array_elements(v) WITH ORDINALITY a(value,ord); RETURN result;
  END IF;
  RETURN v::text;
END $$;
REVOKE ALL ON FUNCTION cs_sr_test_20261013.workflow_canonical_json(jsonb) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION cs_sr_test_20261013.workflow_signed_proof_source(t uuid,v_id uuid,p_id uuid,approved boolean,attested boolean DEFAULT TRUE)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $$
DECLARE v cs_sr_test_20261013.assist_visits%ROWTYPE; p cs_sr_test_20261013.assist_visit_proofs%ROWTYPE;
 s cs_sr_test_20261013.assist_visit_signatures%ROWTYPE; doc cs_sr_test_20261013.assist_visit_documentation%ROWTYPE;
 snap jsonb; payload jsonb; task jsonb; r record; paused timestamptz; pause_seconds numeric:=0; seconds integer; a cs_sr_test_20261013.workflow_proof_attestations%ROWTYPE; result jsonb;
BEGIN
  SELECT * INTO v FROM cs_sr_test_20261013.assist_visits WHERE tenant_id=t AND id=v_id FOR SHARE;
  IF NOT FOUND OR v.canonical_status<>'completed' OR v.actual_start_at IS NULL OR v.actual_end_at IS NULL
    OR NOT isfinite(v.actual_start_at) OR NOT isfinite(v.actual_end_at)
    OR v.actual_end_at<v.actual_start_at OR v.actual_end_at>clock_timestamp() THEN
    RAISE EXCEPTION 'Bestätigter Einsatzabschluss mit tatsächlichem Zeitpaar fehlt.';
  END IF;
  SELECT * INTO p FROM cs_sr_test_20261013.assist_visit_proofs WHERE tenant_id=t AND visit_id=v_id AND id=p_id FOR SHARE;
  IF NOT FOUND OR p.signature_id IS NULL OR p.status NOT IN ('draft','pending_review','approved','exported') OR (attested AND p.status='draft')
    OR (approved AND (p.status NOT IN ('approved','exported') OR p.approved_at IS NULL OR p.approved_by IS NULL)) THEN
    RAISE EXCEPTION 'Bestätigter signierter Nachweis fehlt.';
  END IF;
  snap:=p.payload_snapshot;
  IF jsonb_typeof(snap)<>'object' OR pg_column_size(snap)>256000 OR p.payload_hash IS DISTINCT FROM
    'sha256:'||encode(sha256(convert_to(cs_sr_test_20261013.workflow_canonical_json(snap),'UTF8')),'hex')
    OR snap->>'visitId' IS DISTINCT FROM v.id::text OR snap->>'clientId' IS DISTINCT FROM v.client_id::text
    OR snap->>'employeeId' IS DISTINCT FROM v.employee_id::text
    OR (snap#>>'{visitTimes,serviceStartedAt}')::timestamptz IS DISTINCT FROM v.actual_start_at
    OR (snap#>>'{visitTimes,serviceEndedAt}')::timestamptz IS DISTINCT FROM v.actual_end_at
    OR (snap->>'plannedStartAt')::timestamptz IS DISTINCT FROM v.planned_start_at
    OR (snap->>'plannedEndAt')::timestamptz IS DISTINCT FROM v.planned_end_at THEN
    RAISE EXCEPTION 'Nachweisfassung oder tatsächliche Einsatzzeit stimmt nicht überein.';
  END IF;
  SELECT * INTO doc FROM cs_sr_test_20261013.assist_visit_documentation WHERE tenant_id=t AND visit_id=v_id FOR SHARE;
  SELECT * INTO s FROM cs_sr_test_20261013.assist_visit_signatures WHERE id=p.signature_id AND tenant_id=t AND visit_id=v_id FOR SHARE;
  IF NOT FOUND OR NOT s.is_valid OR s.invalidated_at IS NOT NULL OR NULLIF(s.storage_path,'') IS NULL
    OR COALESCE(s.signature_hash,'') !~ '^sha256:[0-9a-f]{64}$' OR doc.submitted_at IS NULL OR NULLIF(trim(doc.short_description),'') IS NULL
    OR s.signed_at<doc.submitted_at OR s.signed_at<v.actual_end_at OR s.signed_at>clock_timestamp()
    OR COALESCE(snap->>'documentationNote',snap->>'documentation') IS DISTINCT FROM trim(doc.short_description)
    OR snap#>>'{signature,signerName}' IS DISTINCT FROM s.signer_name
    OR (snap#>>'{signature,signedAt}')::timestamptz IS DISTINCT FROM s.signed_at
    OR snap#>>'{signature,signerRole}' IS DISTINCT FROM s.signer_role
    OR s.storage_path NOT LIKE 'tenant/'||t::text||'/assist/visits/'||v_id::text||'/signatures/%' THEN
    RAISE EXCEPTION 'Aktuelle Unterschrift und Dokumentationsfassung fehlen.';
  END IF;
  IF jsonb_typeof(snap->'tasks')<>'array' THEN RAISE EXCEPTION 'Aufgabenfassung fehlt.'; END IF;
  SELECT COALESCE(jsonb_agg(jsonb_build_object('taskId',x->>'id','status',x->>'status') ORDER BY n),'[]') INTO task
    FROM jsonb_array_elements(snap->'tasks') WITH ORDINALITY a(x,n);
  -- Portal task IDs may come from the canonical visit or linked legacy assignment.
  -- Compare a full scoped task set, with the same persisted status normalization.
  IF NOT (cs_sr_test_20261013.workflow_tasks_match(snap->'tasks',t,v_id,v.legacy_assignment_id,FALSE)
    OR cs_sr_test_20261013.workflow_tasks_match(snap->'tasks',t,v_id,v.legacy_assignment_id,TRUE)) THEN
    RAISE EXCEPTION 'Aufgabenfassung wurde geändert.';
  END IF;
  payload:=jsonb_build_object('visitId',v.id,'clientId',v.client_id,'employeeId',v.employee_id,
    'plannedStartAt',snap->>'plannedStartAt','plannedEndAt',snap->>'plannedEndAt',
    'taskStatuses',task,'documentationNote',NULLIF(trim(doc.short_description),''));
  IF s.payload_hash IS DISTINCT FROM 'sha256:'||encode(sha256(convert_to(cs_sr_test_20261013.workflow_canonical_json(payload),'UTF8')),'hex') THEN
    RAISE EXCEPTION 'Unterschrift gehört nicht zu dieser Nachweisfassung.';
  END IF;
  -- Count every real pause once; no minimum minute, planned-time fallback or
  -- additional subtraction of an already-net serviceSeconds snapshot.
  FOR r IN SELECT event_type,occurred_at FROM cs_sr_test_20261013.assist_time_events WHERE tenant_id=t AND visit_id=v_id
    AND occurred_at BETWEEN v.actual_start_at AND v.actual_end_at ORDER BY occurred_at,id LOOP
    IF r.event_type='pause_start' AND paused IS NULL THEN paused:=r.occurred_at;
    ELSIF r.event_type IN ('pause_end','service_end') AND paused IS NOT NULL THEN
      pause_seconds:=pause_seconds+round(extract(epoch FROM r.occurred_at-paused)); paused:=NULL;
    END IF;
  END LOOP;
  IF paused IS NOT NULL THEN pause_seconds:=pause_seconds+round(extract(epoch FROM v.actual_end_at-paused)); END IF;
  seconds:=GREATEST(0,round(extract(epoch FROM v.actual_end_at-v.actual_start_at))-pause_seconds);
  IF (snap#>>'{visitTimes,serviceSeconds}')::numeric IS DISTINCT FROM seconds::numeric THEN
    RAISE EXCEPTION 'Gespeicherte Leistungsdauer entspricht nicht den vollständigen Zeitereignissen.';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM cs_sr_test_20261013.assist_time_events WHERE tenant_id=t AND visit_id=v_id AND event_type='service_start' AND occurred_at=v.actual_start_at)
    OR NOT EXISTS(SELECT 1 FROM cs_sr_test_20261013.assist_time_events WHERE tenant_id=t AND visit_id=v_id AND event_type='service_end' AND occurred_at=v.actual_end_at) THEN
    RAISE EXCEPTION 'Bestätigte Start-/Endereignisse fehlen.'; END IF;
  IF attested THEN
  SELECT * INTO a FROM cs_sr_test_20261013.workflow_proof_attestations WHERE tenant_id=t AND visit_id=v_id AND proof_id=p_id FOR SHARE;
  IF NOT FOUND OR a.proof_payload_hash IS DISTINCT FROM p.payload_hash OR a.signature_id IS DISTINCT FROM s.id
    OR a.signature_hash IS DISTINCT FROM s.signature_hash OR a.signed_at IS DISTINCT FROM s.signed_at
    OR a.service_started_at IS DISTINCT FROM v.actual_start_at OR a.service_ended_at IS DISTINCT FROM v.actual_end_at
    OR a.actual_minutes IS DISTINCT FROM round(seconds/60.0)::integer OR a.pdf_storage_path IS DISTINCT FROM p.pdf_storage_path
    OR a.pdf_sha256 IS DISTINCT FROM p.pdf_hash OR a.verified_at<s.signed_at OR a.verified_at>clock_timestamp()
    OR a.assignment_id NOT IN (v.id,COALESCE(v.legacy_assignment_id,v.id)) OR a.producer_contract<>'verified-original-bytes-v1' THEN
    RAISE EXCEPTION 'Vertrauenswürdige Original-/PDF-Bytebestätigung fehlt; Abschlussvorbereitung ist gesperrt.'; END IF;
  END IF;
  RETURN jsonb_build_object('version','workflow-assignment-record-v1','tenant_id',t,'visit_id',v_id,
    'proof_id',p.id,'proof_payload_hash',p.payload_hash,'signature_id',s.id,'signature_payload_hash',s.payload_hash,
    'client_id',v.client_id,'employee_id',v.employee_id,'service_started_at',v.actual_start_at,
    'service_ended_at',v.actual_end_at,'actual_minutes',round(seconds/60.0)::integer,
    'pdf_storage_path',a.pdf_storage_path,'pdf_sha256',a.pdf_sha256,'attested_at',a.verified_at);
END $$;
REVOKE ALL ON FUNCTION cs_sr_test_20261013.workflow_signed_proof_source(uuid,uuid,uuid,boolean,boolean) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION cs_sr_test_20261013.workflow_assignment_record_capability() RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$ BEGIN
  IF auth.uid() IS NULL OR cs_sr_test_20261013.current_tenant_id() IS NULL THEN RAISE EXCEPTION 'Anmeldung erforderlich.' USING ERRCODE='42501'; END IF;
  RETURN 'workflow-assignment-record-v1';
END $$;
CREATE OR REPLACE FUNCTION cs_sr_test_20261013.workflow_prepare_assignment_service_record(p_tenant_id uuid,p_assignment_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE a cs_sr_test_20261013.assignments%ROWTYPE; v cs_sr_test_20261013.assist_visits%ROWTYPE; d cs_sr_test_20261013.documentation_entries%ROWTYPE;
 s cs_sr_test_20261013.signatures%ROWTYPE; existing cs_sr_test_20261013.service_records%ROWTYPE; receipt jsonb; p_id uuid; employee uuid;
 r record; paused timestamptz; pause_seconds numeric:=0; att cs_sr_test_20261013.workflow_proof_attestations%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR p_tenant_id IS DISTINCT FROM cs_sr_test_20261013.current_tenant_id() THEN
    RAISE EXCEPTION 'Ungültiger Mandant.' USING ERRCODE='42501'; END IF;
  SELECT * INTO a FROM cs_sr_test_20261013.assignments WHERE tenant_id=p_tenant_id AND id=p_assignment_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Einsatz nicht verfügbar.' USING ERRCODE='42501'; END IF;
  IF NOT cs_sr_test_20261013.workflow_record_actor_allowed(p_tenant_id,a.employee_id) THEN
    RAISE EXCEPTION 'Keine aktive eigene Einsatz- oder Nachweisberechtigung.' USING ERRCODE='42501'; END IF;
  IF a.status::text<>'completed' OR a.actual_start_at IS NULL OR a.actual_end_at IS NULL
    OR NOT isfinite(a.actual_start_at) OR NOT isfinite(a.actual_end_at) OR a.actual_end_at<a.actual_start_at
    OR a.actual_end_at>clock_timestamp() THEN RAISE EXCEPTION 'Tatsächlicher Einsatzabschluss fehlt.'; END IF;
  IF (SELECT count(*) FROM cs_sr_test_20261013.assist_visits WHERE tenant_id=p_tenant_id AND (id=a.id OR legacy_assignment_id=a.id))>1 THEN
    RAISE EXCEPTION 'Mehrdeutige Einsatzzuordnung.'; END IF;
  SELECT * INTO v FROM cs_sr_test_20261013.assist_visits WHERE tenant_id=p_tenant_id AND (id=a.id OR legacy_assignment_id=a.id) FOR SHARE;
  IF FOUND THEN
    IF v.client_id IS DISTINCT FROM a.client_id OR v.employee_id IS DISTINCT FROM a.employee_id
      OR v.actual_start_at IS DISTINCT FROM a.actual_start_at OR v.actual_end_at IS DISTINCT FROM a.actual_end_at THEN
      RAISE EXCEPTION 'Kanonische Einsatzzuordnung wurde verändert.'; END IF;
    SELECT id INTO p_id FROM cs_sr_test_20261013.assist_visit_proofs WHERE tenant_id=p_tenant_id AND visit_id=v.id
      AND status IN ('pending_review','approved','exported') ORDER BY created_at DESC,id DESC LIMIT 1;
    receipt:=cs_sr_test_20261013.workflow_signed_proof_source(p_tenant_id,v.id,p_id,FALSE);
  ELSE
    SELECT * INTO d FROM cs_sr_test_20261013.documentation_entries WHERE tenant_id=p_tenant_id AND assignment_id=a.id AND client_id=a.client_id
      AND employee_id IS NOT DISTINCT FROM a.employee_id AND status::text IN ('saved','signature_required','completed','approved')
      AND NULLIF(trim(free_text),'') IS NOT NULL ORDER BY updated_at DESC,id DESC LIMIT 1 FOR SHARE;
    SELECT * INTO s FROM cs_sr_test_20261013.signatures WHERE tenant_id=p_tenant_id AND assignment_id=a.id AND documentation_entry_id=d.id
      AND client_id=a.client_id AND employee_id IS NOT DISTINCT FROM a.employee_id AND status::text='signed'
      AND NULLIF(trim(signature_data),'') IS NOT NULL AND length(trim(signer_name))>=2 AND signed_at>=d.updated_at
      AND signed_at>=a.actual_end_at AND signed_at<=clock_timestamp() ORDER BY signed_at DESC,id DESC LIMIT 1 FOR SHARE;
    IF NOT FOUND OR d.id IS NULL THEN RAISE EXCEPTION 'Aktuelle Dokumentation und Unterschrift fehlen.'; END IF;
    FOR r IN SELECT entry_type,event_at FROM cs_sr_test_20261013.time_entries WHERE tenant_id=p_tenant_id AND assignment_id=a.id
      AND event_at BETWEEN a.actual_start_at AND a.actual_end_at ORDER BY event_at,id LOOP
      IF r.entry_type::text='paused' AND paused IS NULL THEN paused:=r.event_at;
      ELSIF r.entry_type::text IN ('resumed','finished') AND paused IS NOT NULL THEN
        pause_seconds:=pause_seconds+extract(epoch FROM r.event_at-paused); paused:=NULL;
      END IF;
    END LOOP;
    IF paused IS NOT NULL THEN pause_seconds:=pause_seconds+extract(epoch FROM a.actual_end_at-paused); END IF;
    SELECT * INTO att FROM cs_sr_test_20261013.workflow_proof_attestations WHERE tenant_id=p_tenant_id AND assignment_id=a.id FOR SHARE;
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
  SELECT * INTO existing FROM cs_sr_test_20261013.service_records WHERE tenant_id=p_tenant_id AND assignment_id=a.id FOR UPDATE;
  IF FOUND THEN
    IF existing.source_receipt IS DISTINCT FROM receipt OR existing.client_id IS DISTINCT FROM a.client_id
      OR existing.employee_id IS DISTINCT FROM a.employee_id OR existing.actual_minutes IS DISTINCT FROM (receipt->>'actual_minutes')::int THEN
      RAISE EXCEPTION 'Vorhandener Nachweis muss fachlich abgeglichen werden; keine Überschreibung.'; END IF;
    RETURN receipt||jsonb_build_object('id',existing.id);
  END IF;
  INSERT INTO cs_sr_test_20261013.service_records(tenant_id,assignment_id,assist_visit_id,client_id,employee_id,product_key,service_date,
    actual_minutes,planned_minutes,status,documentation_entry_id,signature_id,source_receipt)
  VALUES(p_tenant_id,a.id,v.id,a.client_id,a.employee_id,'assist',(a.actual_start_at AT TIME ZONE 'Europe/Berlin')::date,
    (receipt->>'actual_minutes')::int,NULL,'draft',d.id,s.id,receipt) RETURNING * INTO existing;
  -- s.id is ONLY the legacy signatures FK; canonical signature is in receipt.
  RETURN receipt||jsonb_build_object('id',existing.id);
END $$;

REVOKE ALL ON FUNCTION cs_sr_test_20261013.workflow_assignment_record_capability(),cs_sr_test_20261013.workflow_prepare_assignment_service_record(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION cs_sr_test_20261013.workflow_assignment_record_capability(),cs_sr_test_20261013.workflow_prepare_assignment_service_record(uuid,uuid) TO authenticated;

-- User-scoped read: service credentials never authorize a supplied tenant/visit.
CREATE OR REPLACE FUNCTION cs_sr_test_20261013.workflow_assignment_proof_source(p_tenant_id uuid,p_assignment_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE a cs_sr_test_20261013.assignments%ROWTYPE; v cs_sr_test_20261013.assist_visits%ROWTYPE; p cs_sr_test_20261013.assist_visit_proofs%ROWTYPE;
 s cs_sr_test_20261013.assist_visit_signatures%ROWTYPE; source jsonb; tenant_name text; client_name text; employee_name text; ready boolean;
BEGIN
 SELECT * INTO a FROM cs_sr_test_20261013.assignments WHERE tenant_id=p_tenant_id AND id=p_assignment_id FOR SHARE;
 IF NOT FOUND OR NOT cs_sr_test_20261013.workflow_record_actor_allowed(p_tenant_id,a.employee_id) THEN
   RAISE EXCEPTION 'Keine aktive eigene Einsatz- oder Nachweisberechtigung.' USING ERRCODE='42501'; END IF;
 IF (SELECT count(*) FROM cs_sr_test_20261013.assist_visits WHERE tenant_id=p_tenant_id AND (id=a.id OR legacy_assignment_id=a.id))<>1 THEN
   RAISE EXCEPTION 'Eine eindeutige kanonische Einsatzfassung ist erforderlich.'; END IF;
 SELECT * INTO v FROM cs_sr_test_20261013.assist_visits WHERE tenant_id=p_tenant_id AND (id=a.id OR legacy_assignment_id=a.id) FOR SHARE;
 IF a.status::text<>'completed' OR v.client_id IS DISTINCT FROM a.client_id OR v.employee_id IS DISTINCT FROM a.employee_id
   OR v.actual_start_at IS DISTINCT FROM a.actual_start_at OR v.actual_end_at IS DISTINCT FROM a.actual_end_at THEN
   RAISE EXCEPTION 'Einsatzabschluss und Zuordnung stimmen nicht überein.'; END IF;
 SELECT * INTO p FROM cs_sr_test_20261013.assist_visit_proofs WHERE tenant_id=p_tenant_id AND visit_id=v.id
   AND signature_id IS NOT NULL AND status IN ('draft','pending_review','approved','exported') ORDER BY created_at DESC,id DESC LIMIT 1 FOR SHARE;
 source:=cs_sr_test_20261013.workflow_signed_proof_source(p_tenant_id,v.id,p.id,FALSE,FALSE);
 SELECT * INTO s FROM cs_sr_test_20261013.assist_visit_signatures WHERE tenant_id=p_tenant_id AND visit_id=v.id AND id=p.signature_id FOR SHARE;
 SELECT COALESCE(NULLIF(legal_name,''),name) INTO tenant_name FROM cs_sr_test_20261013.tenants WHERE id=p_tenant_id;
 SELECT COALESCE(NULLIF(full_name,''),concat_ws(' ',first_name,last_name)) INTO client_name FROM cs_sr_test_20261013.clients WHERE tenant_id=p_tenant_id AND id=a.client_id;
 SELECT COALESCE(NULLIF(full_name,''),concat_ws(' ',first_name,last_name)) INTO employee_name FROM cs_sr_test_20261013.employees WHERE tenant_id=p_tenant_id AND id=a.employee_id;
 ready:=EXISTS(SELECT 1 FROM cs_sr_test_20261013.workflow_proof_attestations w WHERE w.tenant_id=p_tenant_id AND w.assignment_id=a.id
   AND w.proof_id=p.id AND w.proof_payload_hash=p.payload_hash AND w.signature_id=s.id AND w.signature_hash=s.signature_hash
   AND w.pdf_storage_path=p.pdf_storage_path AND w.pdf_sha256=p.pdf_hash);
 RETURN jsonb_build_object('attested_pdf',ready,'receipt',source||jsonb_build_object('assignment_id',a.id),'snapshot',p.payload_snapshot,
   'signature_storage_path',s.storage_path,'signature_hash',s.signature_hash,'signature_id',s.id,
   'tenant_name',tenant_name,'client_name',client_name,'employee_name',employee_name,
   'pdf_storage_path',p.pdf_storage_path,'pdf_hash',p.pdf_hash);
END $$;
REVOKE ALL ON FUNCTION cs_sr_test_20261013.workflow_assignment_proof_source(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION cs_sr_test_20261013.workflow_assignment_proof_source(uuid,uuid) TO authenticated;

-- Only the trusted byte-reading worker may commit an attestation. Revalidate
-- the exact source under locks after storage I/O; stale replies cannot attest.
CREATE OR REPLACE FUNCTION cs_sr_test_20261013.workflow_commit_proof_attestation(t uuid,a_id uuid,p_id uuid,expected_payload_hash text,
 expected_signature_hash text,pdf_path text,pdf_sha text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE a cs_sr_test_20261013.assignments%ROWTYPE; p cs_sr_test_20261013.assist_visit_proofs%ROWTYPE; v cs_sr_test_20261013.assist_visits%ROWTYPE;
 s cs_sr_test_20261013.assist_visit_signatures%ROWTYPE; source jsonb; old cs_sr_test_20261013.workflow_proof_attestations%ROWTYPE;
BEGIN
 SELECT * INTO a FROM cs_sr_test_20261013.assignments WHERE tenant_id=t AND id=a_id FOR UPDATE;
 IF NOT FOUND OR a.status::text<>'completed' THEN RAISE EXCEPTION 'Einsatzabschluss fehlt.'; END IF;
 SELECT * INTO p FROM cs_sr_test_20261013.assist_visit_proofs WHERE tenant_id=t AND id=p_id FOR UPDATE;
 SELECT * INTO v FROM cs_sr_test_20261013.assist_visits WHERE tenant_id=t AND id=p.visit_id FOR SHARE;
 IF v.id IS NULL OR COALESCE(v.legacy_assignment_id,v.id)<>a.id OR v.client_id IS DISTINCT FROM a.client_id
   OR v.employee_id IS DISTINCT FROM a.employee_id OR v.actual_start_at IS DISTINCT FROM a.actual_start_at
   OR v.actual_end_at IS DISTINCT FROM a.actual_end_at THEN RAISE EXCEPTION 'Einsatzzuordnung geändert.'; END IF;
 SELECT * INTO s FROM cs_sr_test_20261013.assist_visit_signatures WHERE tenant_id=t AND visit_id=v.id AND id=p.signature_id FOR SHARE;
 source:=cs_sr_test_20261013.workflow_signed_proof_source(t,v.id,p.id,FALSE,FALSE);
 IF p.payload_hash IS DISTINCT FROM expected_payload_hash OR s.signature_hash IS DISTINCT FROM expected_signature_hash
   OR pdf_sha !~ '^sha256:[0-9a-f]{64}$' OR pdf_path IS DISTINCT FROM
     'tenant/'||t::text||'/assist/visits/'||v.id::text||'/server-proofs/'||p.id::text||'-'||substring(pdf_sha from 8)||'.pdf'
   OR NOT EXISTS(SELECT 1 FROM cs_sr_test_20261013.storage_objects WHERE bucket_id='office-documents' AND name=pdf_path) THEN
   RAISE EXCEPTION 'Bytebestätigung passt nicht zur aktuellen Nachweisfassung.'; END IF;
 SELECT * INTO old FROM cs_sr_test_20261013.workflow_proof_attestations WHERE tenant_id=t AND assignment_id=a.id FOR UPDATE;
 IF FOUND AND old.proof_id=p.id AND old.proof_payload_hash=p.payload_hash AND old.signature_id=s.id
   AND old.signature_hash=s.signature_hash AND old.pdf_storage_path=pdf_path AND old.pdf_sha256=pdf_sha THEN
   RETURN jsonb_build_object('confirmed',TRUE,'proof_id',p.id,'pdf_storage_path',pdf_path,'pdf_sha256',pdf_sha); END IF;
 IF EXISTS(SELECT 1 FROM cs_sr_test_20261013.service_records WHERE tenant_id=t AND assignment_id=a.id AND source_receipt<>'{}'::jsonb)
   OR p.billing_released OR p.portal_visible THEN RAISE EXCEPTION 'Veröffentlichte Nachweisfassung darf nicht ersetzt werden.'; END IF;
 UPDATE cs_sr_test_20261013.assist_visit_proofs SET pdf_storage_path=pdf_path,pdf_hash=pdf_sha,
   status=CASE WHEN status='draft' THEN 'pending_review' ELSE status END,updated_at=clock_timestamp() WHERE id=p.id AND tenant_id=t;
 INSERT INTO cs_sr_test_20261013.workflow_proof_attestations(tenant_id,assignment_id,visit_id,proof_id,proof_payload_hash,signature_id,signature_hash,
   signed_at,service_started_at,service_ended_at,actual_minutes,pdf_storage_path,pdf_sha256,producer_contract)
 VALUES(t,a.id,v.id,p.id,p.payload_hash,s.id,s.signature_hash,s.signed_at,v.actual_start_at,v.actual_end_at,
   (source->>'actual_minutes')::integer,pdf_path,pdf_sha,'verified-original-bytes-v1')
 ON CONFLICT(tenant_id,assignment_id) DO UPDATE SET visit_id=EXCLUDED.visit_id,proof_id=EXCLUDED.proof_id,
   proof_payload_hash=EXCLUDED.proof_payload_hash,signature_id=EXCLUDED.signature_id,signature_hash=EXCLUDED.signature_hash,
   signed_at=EXCLUDED.signed_at,service_started_at=EXCLUDED.service_started_at,service_ended_at=EXCLUDED.service_ended_at,
   actual_minutes=EXCLUDED.actual_minutes,pdf_storage_path=EXCLUDED.pdf_storage_path,pdf_sha256=EXCLUDED.pdf_sha256,
   verified_at=clock_timestamp(),producer_contract=EXCLUDED.producer_contract;
 RETURN jsonb_build_object('confirmed',TRUE,'proof_id',p.id,'pdf_storage_path',pdf_path,'pdf_sha256',pdf_sha);
END $$;
REVOKE ALL ON FUNCTION cs_sr_test_20261013.workflow_commit_proof_attestation(uuid,uuid,uuid,text,text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION cs_sr_test_20261013.workflow_commit_proof_attestation(uuid,uuid,uuid,text,text,text,text) TO service_role;

CREATE OR REPLACE FUNCTION cs_sr_test_20261013.workflow_storage_object_mutable(bucket text,path text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT bucket<>'office-documents' OR (
   path !~ '^tenant/[^/]+/assist/visits/[^/]+/server-proofs/'
   AND (path !~ '^tenant/[^/]+/assist/visits/[^/]+/signatures/' OR (
     path LIKE 'tenant/'||cs_sr_test_20261013.current_tenant_id()::text||'/%'
     AND NOT EXISTS(SELECT 1 FROM cs_sr_test_20261013.assist_visit_signatures s WHERE s.storage_path=path
       AND (s.is_valid OR EXISTS(SELECT 1 FROM cs_sr_test_20261013.workflow_proof_attestations w WHERE w.signature_id=s.id)))))
 );
$$;
REVOKE ALL ON FUNCTION cs_sr_test_20261013.workflow_storage_object_mutable(text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION cs_sr_test_20261013.workflow_storage_object_mutable(text,text) TO authenticated;

-- Reserve the worker namespace, without changing existing document paths.
DROP POLICY IF EXISTS workflow_server_proof_insert_guard ON cs_sr_test_20261013.storage_objects;
CREATE POLICY workflow_server_proof_insert_guard ON cs_sr_test_20261013.storage_objects AS RESTRICTIVE FOR INSERT TO authenticated
 WITH CHECK(bucket_id<>'office-documents' OR name !~ '^tenant/[^/]+/assist/visits/[^/]+/server-proofs/');
DROP POLICY IF EXISTS workflow_server_proof_update_guard ON cs_sr_test_20261013.storage_objects;
CREATE POLICY workflow_server_proof_update_guard ON cs_sr_test_20261013.storage_objects AS RESTRICTIVE FOR UPDATE TO authenticated
 USING(cs_sr_test_20261013.workflow_storage_object_mutable(bucket_id,name))
 WITH CHECK(cs_sr_test_20261013.workflow_storage_object_mutable(bucket_id,name));
DROP POLICY IF EXISTS workflow_server_proof_delete_guard ON cs_sr_test_20261013.storage_objects;
CREATE POLICY workflow_server_proof_delete_guard ON cs_sr_test_20261013.storage_objects AS RESTRICTIVE FOR DELETE TO authenticated
 USING(cs_sr_test_20261013.workflow_storage_object_mutable(bucket_id,name));

CREATE OR REPLACE FUNCTION cs_sr_test_20261013.workflow_guard_service_record_source() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $$ BEGIN
 IF TG_OP='INSERT' THEN
   IF NEW.source_receipt<>'{}'::jsonb AND current_user NOT IN ('postgres','supabase_admin') THEN
     RAISE EXCEPTION 'Serverbestätigung kann nicht vom Client geschrieben werden.' USING ERRCODE='42501'; END IF;
 ELSIF OLD.source_receipt<>'{}'::jsonb THEN
   IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Bestätigter Leistungsnachweis darf nicht gelöscht werden.'; END IF;
   IF NEW.source_receipt IS DISTINCT FROM OLD.source_receipt OR NEW.assignment_id IS DISTINCT FROM OLD.assignment_id
     OR NEW.tenant_id IS DISTINCT FROM OLD.tenant_id OR NEW.client_id IS DISTINCT FROM OLD.client_id
     OR NEW.employee_id IS DISTINCT FROM OLD.employee_id OR NEW.actual_minutes IS DISTINCT FROM OLD.actual_minutes
     OR NEW.assist_visit_id IS DISTINCT FROM OLD.assist_visit_id OR NEW.service_date IS DISTINCT FROM OLD.service_date
     OR NEW.documentation_entry_id IS DISTINCT FROM OLD.documentation_entry_id OR NEW.signature_id IS DISTINCT FROM OLD.signature_id
     OR NEW.product_key IS DISTINCT FROM OLD.product_key OR NEW.id IS DISTINCT FROM OLD.id THEN
     RAISE EXCEPTION 'Bestätigte Nachweisquelle ist unveränderlich.'; END IF;
 ELSIF TG_OP='UPDATE' AND NEW.source_receipt<>'{}'::jsonb AND current_user NOT IN ('postgres','supabase_admin') THEN
   RAISE EXCEPTION 'Serverbestätigung kann nicht vom Client geschrieben werden.' USING ERRCODE='42501';
 END IF;
 RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
END $$;
REVOKE ALL ON FUNCTION cs_sr_test_20261013.workflow_guard_service_record_source() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS workflow_service_record_source_guard ON cs_sr_test_20261013.service_records;
CREATE TRIGGER workflow_service_record_source_guard BEFORE INSERT OR UPDATE OR DELETE ON cs_sr_test_20261013.service_records
 FOR EACH ROW EXECUTE FUNCTION cs_sr_test_20261013.workflow_guard_service_record_source();

CREATE OR REPLACE FUNCTION cs_sr_test_20261013.workflow_guard_record_bound_proof() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$ BEGIN
 IF EXISTS(SELECT 1 FROM cs_sr_test_20261013.service_records WHERE tenant_id=OLD.tenant_id AND source_receipt->>'proof_id'=OLD.id::text) THEN
   IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Bestätigte Nachweisfassung darf nicht gelöscht werden.'; END IF;
   IF NEW.payload_snapshot IS DISTINCT FROM OLD.payload_snapshot OR NEW.payload_hash IS DISTINCT FROM OLD.payload_hash
     OR NEW.signature_id IS DISTINCT FROM OLD.signature_id OR NEW.pdf_storage_path IS DISTINCT FROM OLD.pdf_storage_path
     OR NEW.pdf_hash IS DISTINCT FROM OLD.pdf_hash OR NEW.tenant_id IS DISTINCT FROM OLD.tenant_id
     OR NEW.visit_id IS DISTINCT FROM OLD.visit_id OR NEW.id IS DISTINCT FROM OLD.id THEN
     RAISE EXCEPTION 'Bestätigte Nachweisfassung ist unveränderlich.'; END IF;
 END IF;
 RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
END $$;
REVOKE ALL ON FUNCTION cs_sr_test_20261013.workflow_guard_record_bound_proof() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS workflow_record_bound_proof_guard ON cs_sr_test_20261013.assist_visit_proofs;
CREATE TRIGGER workflow_record_bound_proof_guard BEFORE UPDATE OR DELETE ON cs_sr_test_20261013.assist_visit_proofs
 FOR EACH ROW EXECUTE FUNCTION cs_sr_test_20261013.workflow_guard_record_bound_proof();
NOTIFY pgrst,'reload schema';

INSERT INTO tenants VALUES('10000000-0000-4000-8000-000000000001','Testmandant','Testmandant');
INSERT INTO clients VALUES('10000000-0000-4000-8000-000000000007','10000000-0000-4000-8000-000000000001','Testperson','Test','Person');
INSERT INTO employees VALUES('10000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000001','Testkraft','Test','Kraft');
INSERT INTO employee_portal_accounts VALUES('10000000-0000-4000-8000-000000000004','10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000003','active');
INSERT INTO assignments VALUES('10000000-0000-4000-8000-000000000005','10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000007','10000000-0000-4000-8000-000000000002','completed','2026-10-12T08:00:00.000Z','2026-10-12T09:00:00.000Z');
INSERT INTO assist_visits VALUES('10000000-0000-4000-8000-000000000006','10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000005','10000000-0000-4000-8000-000000000007','10000000-0000-4000-8000-000000000002','completed','2026-10-12T08:00:00.000Z','2026-10-12T09:00:00.000Z','2026-10-12T08:00:00.000Z','2026-10-12T09:00:00.000Z');
INSERT INTO assist_visit_documentation(tenant_id,visit_id,short_description,submitted_at) VALUES('10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000006','Synthetische Prüfdaten.','2026-10-12T09:02:00.000Z');
INSERT INTO assist_visit_signatures VALUES('10000000-0000-4000-8000-000000000009','10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000006','sha256:f57ffa928b8695dfe3460ae279f9b755f3b3522302c25ad85c5ecbdfd568ac25','sha256:94522d4410e16e86c911eceaa62897be075b4ba1a46cbd3d723f294a82620679','tenant/10000000-0000-4000-8000-000000000001/assist/visits/10000000-0000-4000-8000-000000000006/signatures/10000000-0000-4000-8000-000000000009.png','Testperson','client','2026-10-12T09:03:00.000Z',TRUE,NULL);
INSERT INTO assist_visit_proofs(id,tenant_id,visit_id,signature_id,status,payload_snapshot,payload_hash) VALUES('10000000-0000-4000-8000-000000000008','10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000006','10000000-0000-4000-8000-000000000009','draft','{"clientId":"10000000-0000-4000-8000-000000000007","documentationNote":"Synthetische Prüfdaten.","employeeId":"10000000-0000-4000-8000-000000000002","generatedAt":"2026-10-12T09:02:00.000Z","plannedEndAt":"2026-10-12T09:00:00.000Z","plannedStartAt":"2026-10-12T08:00:00.000Z","signature":{"signedAt":"2026-10-12T09:03:00.000Z","signerName":"Testperson","signerRole":"client"},"tasks":[],"visitId":"10000000-0000-4000-8000-000000000006","visitTimes":{"serviceEndedAt":"2026-10-12T09:00:00.000Z","serviceSeconds":3600,"serviceStartedAt":"2026-10-12T08:00:00.000Z"}}'::jsonb,'sha256:7e64c40777e9184b8595211929fce3d889f5ff3774c91cc885431a39692ce9fc');
INSERT INTO assist_time_events(tenant_id,visit_id,event_type,occurred_at) VALUES('10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000006','service_start','2026-10-12T08:00:00.000Z'),('10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000006','service_end','2026-10-12T09:00:00.000Z');
INSERT INTO storage_objects VALUES('office-documents','tenant/10000000-0000-4000-8000-000000000001/assist/visits/10000000-0000-4000-8000-000000000006/signatures/10000000-0000-4000-8000-000000000009.png'),('office-documents','tenant/10000000-0000-4000-8000-000000000001/assist/visits/10000000-0000-4000-8000-000000000006/server-proofs/10000000-0000-4000-8000-000000000008-abababababababababababababababababababababababababababababababab.pdf'),('office-documents','legacy/document.txt');
INSERT INTO roles VALUES('10000000-0000-4000-8000-000000000020','10000000-0000-4000-8000-000000000001','business_admin');
INSERT INTO role_permissions VALUES('10000000-0000-4000-8000-000000000020','assist.records.create',TRUE);
INSERT INTO profiles VALUES('10000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000020',TRUE,'active');
SELECT set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000003","role":"authenticated"}',TRUE);
SELECT set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000003',TRUE);
SELECT set_config('cs_test.tenant','10000000-0000-4000-8000-000000000001',TRUE),set_config('cs_test.employee','10000000-0000-4000-8000-000000000002',TRUE),set_config('cs_test.portal','employee',TRUE);
SET LOCAL ROLE authenticated;
DO $$ DECLARE r jsonb; BEGIN
 r:=cs_sr_test_20261013.workflow_assignment_proof_source('10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000005');
 IF r#>>'{receipt,proof_id}'<>'10000000-0000-4000-8000-000000000008' OR (r->>'attested_pdf')::boolean THEN RAISE EXCEPTION 'valid-source assertion'; END IF;
 IF cs_sr_test_20261013.workflow_assignment_record_capability()<>'workflow-assignment-record-v1' THEN RAISE EXCEPTION 'capability assertion'; END IF;
 BEGIN PERFORM cs_sr_test_20261013.workflow_prepare_assignment_service_record('10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000005');RAISE EXCEPTION 'missing attestation was accepted';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE '%Bytebestätigung%' AND SQLERRM NOT LIKE '%signierter Nachweis%' THEN RAISE; END IF; END;
 BEGIN PERFORM cs_sr_test_20261013.workflow_assignment_proof_source('10000000-0000-4000-8000-000000000099','10000000-0000-4000-8000-000000000005');RAISE EXCEPTION 'foreign tenant accepted';EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN PERFORM cs_sr_test_20261013.workflow_commit_proof_attestation('10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000005','10000000-0000-4000-8000-000000000008','sha256:7e64c40777e9184b8595211929fce3d889f5ff3774c91cc885431a39692ce9fc','sha256:94522d4410e16e86c911eceaa62897be075b4ba1a46cbd3d723f294a82620679','tenant/10000000-0000-4000-8000-000000000001/assist/visits/10000000-0000-4000-8000-000000000006/server-proofs/10000000-0000-4000-8000-000000000008-abababababababababababababababababababababababababababababababab.pdf','sha256:abababababababababababababababababababababababababababababababab');RAISE EXCEPTION 'client attestation accepted';EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN DELETE FROM cs_sr_test_20261013.storage_objects WHERE name='tenant/10000000-0000-4000-8000-000000000001/assist/visits/10000000-0000-4000-8000-000000000006/signatures/10000000-0000-4000-8000-000000000009.png';IF FOUND THEN RAISE EXCEPTION 'original signature was deleted';END IF;END;
 BEGIN INSERT INTO cs_sr_test_20261013.storage_objects VALUES('office-documents','tenant/10000000-0000-4000-8000-000000000001/assist/visits/10000000-0000-4000-8000-000000000006/server-proofs/fake.pdf');RAISE EXCEPTION 'client server namespace write accepted';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
 UPDATE cs_sr_test_20261013.storage_objects SET name='legacy/document-updated.txt' WHERE name='legacy/document.txt';IF NOT FOUND THEN RAISE EXCEPTION 'unrelated legacy object blocked';END IF;
 END $$;
SELECT set_config('cs_test.portal','client',TRUE);
DO $$ BEGIN BEGIN PERFORM cs_sr_test_20261013.workflow_assignment_proof_source('10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000005');RAISE EXCEPTION 'client portal accepted';EXCEPTION WHEN insufficient_privilege THEN NULL;END;END $$;
SELECT set_config('cs_test.portal','employee',TRUE),set_config('cs_test.employee','10000000-0000-4000-8000-000000000088',TRUE);
DO $$ BEGIN BEGIN PERFORM cs_sr_test_20261013.workflow_assignment_proof_source('10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000005');RAISE EXCEPTION 'foreign employee accepted';EXCEPTION WHEN insufficient_privilege THEN NULL;END;END $$;
SELECT set_config('cs_test.employee','10000000-0000-4000-8000-000000000002',TRUE);
SET LOCAL ROLE service_role;
DO $$ DECLARE r jsonb; BEGIN
 BEGIN PERFORM cs_sr_test_20261013.workflow_commit_proof_attestation('10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000005','10000000-0000-4000-8000-000000000008','sha256:bad','sha256:94522d4410e16e86c911eceaa62897be075b4ba1a46cbd3d723f294a82620679','tenant/10000000-0000-4000-8000-000000000001/assist/visits/10000000-0000-4000-8000-000000000006/server-proofs/10000000-0000-4000-8000-000000000008-abababababababababababababababababababababababababababababababab.pdf','sha256:abababababababababababababababababababababababababababababababab');RAISE EXCEPTION 'stale source accepted';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE '%Bytebestätigung%' THEN RAISE;END IF;END;
 r:=cs_sr_test_20261013.workflow_commit_proof_attestation('10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000005','10000000-0000-4000-8000-000000000008','sha256:7e64c40777e9184b8595211929fce3d889f5ff3774c91cc885431a39692ce9fc','sha256:94522d4410e16e86c911eceaa62897be075b4ba1a46cbd3d723f294a82620679','tenant/10000000-0000-4000-8000-000000000001/assist/visits/10000000-0000-4000-8000-000000000006/server-proofs/10000000-0000-4000-8000-000000000008-abababababababababababababababababababababababababababababababab.pdf','sha256:abababababababababababababababababababababababababababababababab');
 IF NOT (r->>'confirmed')::boolean THEN RAISE EXCEPTION 'commit not confirmed';END IF;
 END $$;
SET LOCAL ROLE authenticated;
DO $$ DECLARE r jsonb; again jsonb; BEGIN
 r:=cs_sr_test_20261013.workflow_prepare_assignment_service_record('10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000005');
 again:=cs_sr_test_20261013.workflow_prepare_assignment_service_record('10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000005');
 IF r IS DISTINCT FROM again OR (r->>'actual_minutes')::int<>60 OR r->>'pdf_sha256'<>'sha256:abababababababababababababababababababababababababababababababab' THEN RAISE EXCEPTION 'receipt or idempotence assertion';END IF;
 IF (SELECT count(*) FROM cs_sr_test_20261013.service_records)<>1 THEN RAISE EXCEPTION 'duplicate record assertion';END IF;
 BEGIN UPDATE cs_sr_test_20261013.assist_visit_proofs SET payload_snapshot=payload_snapshot||'{"documentationNote":"changed"}'::jsonb;RAISE EXCEPTION 'bound proof changed';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE '%unveränderlich%' THEN RAISE;END IF;END;
 BEGIN UPDATE cs_sr_test_20261013.service_records SET actual_minutes=99;RAISE EXCEPTION 'source minutes changed';EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE '%unveränderlich%' THEN RAISE;END IF;END;
 BEGIN INSERT INTO cs_sr_test_20261013.service_records(tenant_id,source_receipt) VALUES('10000000-0000-4000-8000-000000000001','{"version":"fake"}');RAISE EXCEPTION 'forged receipt accepted';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
 BEGIN PERFORM count(*) FROM cs_sr_test_20261013.workflow_proof_attestations;RAISE EXCEPTION 'private attestations exposed';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
 END $$;
SELECT set_config('cs_test.portal','business',TRUE);
DO $$ BEGIN PERFORM cs_sr_test_20261013.workflow_assignment_proof_source('10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000005');END $$;
SET LOCAL ROLE anon;
DO $$ BEGIN BEGIN PERFORM cs_sr_test_20261013.workflow_assignment_record_capability();RAISE EXCEPTION 'anonymous capability access';EXCEPTION WHEN insufficient_privilege THEN NULL;END;END $$;
RESET ROLE;
ROLLBACK;
SELECT 'passed' as isolated_sql_assertions,to_regnamespace('cs_sr_test_20261013') IS NULL as fixture_rolled_back;
