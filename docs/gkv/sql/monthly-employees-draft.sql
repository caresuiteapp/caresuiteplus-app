-- REVIEW ONLY. Seventh monthly draft; apply after monthly-facts-draft.sql.
-- No backfill, production rollout, BfArM lookup or new identity provisioning.
-- Uses existing personal accounts, roles and active Supabase sessions.
BEGIN;
CREATE TABLE care_security.gkv_employee_registrations (
 id uuid PRIMARY KEY, tenant_id uuid NOT NULL REFERENCES public.tenants(id),
 employee_id uuid NOT NULL REFERENCES public.employees(id), actor_id uuid NOT NULL,
 employee_number text NOT NULL CHECK(employee_number ~ '^[0-9]{9}$'),
 evidence_reference text NOT NULL, submitted_at timestamptz NOT NULL,
 submitted_session uuid NOT NULL, revision integer NOT NULL DEFAULT 1 CHECK(revision>0),
 state text NOT NULL CHECK(state IN ('pending','approved','rejected','withdrawn','revoked')),
 reviewed_by uuid, reviewed_at timestamptz, review_reference text, review_note text,
 valid_from timestamptz, valid_until timestamptz,
 closed_by uuid, closed_at timestamptz, close_reason text,
 UNIQUE(tenant_id,id), CHECK(reviewed_by IS NULL OR reviewed_by<>actor_id),
 CHECK(state NOT IN ('approved','revoked') OR reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL
   AND valid_from IS NOT NULL AND valid_until>valid_from AND isfinite(valid_until))
);
CREATE INDEX gkv_employee_registration_person ON care_security.gkv_employee_registrations(tenant_id,employee_id,state);
CREATE INDEX gkv_employee_registration_number ON care_security.gkv_employee_registrations(tenant_id,employee_number,state);
CREATE UNIQUE INDEX gkv_employee_one_pending ON care_security.gkv_employee_registrations(tenant_id,employee_id) WHERE state='pending';
CREATE TABLE care_security.gkv_employee_requests (
 tenant_id uuid NOT NULL, request_id uuid NOT NULL, actor_id uuid NOT NULL,
 request_sha256 text NOT NULL, registration_id uuid NOT NULL,
 PRIMARY KEY(tenant_id,request_id),
 FOREIGN KEY(tenant_id,registration_id) REFERENCES care_security.gkv_employee_registrations(tenant_id,id)
);
CREATE TABLE care_security.gkv_employee_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL,
 registration_id uuid NOT NULL, actor_id uuid NOT NULL, session_id uuid NOT NULL,
 action text NOT NULL, recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 before_state jsonb, after_state jsonb NOT NULL,
 FOREIGN KEY(tenant_id,registration_id) REFERENCES care_security.gkv_employee_registrations(tenant_id,id)
);
CREATE TABLE care_security.gkv_employee_captures (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL,
 proof_id uuid NOT NULL REFERENCES public.assist_visit_proofs(id), visit_id uuid NOT NULL,
 employee_id uuid NOT NULL, actor_id uuid NOT NULL, session_id uuid NOT NULL,
 registration_id uuid NOT NULL, employee_number text NOT NULL,
 proof_payload_hash text NOT NULL, captured_at timestamptz NOT NULL,
 service_started_at timestamptz NOT NULL, service_ended_at timestamptz NOT NULL,
 policy text NOT NULL CHECK(policy='personal-proof-insert-15m-v1'),
 UNIQUE(tenant_id,proof_id),
 FOREIGN KEY(tenant_id,registration_id) REFERENCES care_security.gkv_employee_registrations(tenant_id,id)
);

-- Derive a single active employee from existing server-owned account links.
-- A browser cannot choose an employee, submit an actor, or use user_metadata.
CREATE FUNCTION care_security.gkv_employee_self(t uuid) RETURNS uuid
 LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE ids uuid[];
BEGIN
 PERFORM care_security.gkv_monthly_live_session();
 IF t IS DISTINCT FROM public.current_tenant_id()
   OR public.platform_tenant_access_allowed(t,false) IS NOT TRUE THEN
  RAISE EXCEPTION 'Persönlicher Unternehmenszugang erforderlich' USING ERRCODE='42501'; END IF;
 IF public.current_portal_type()='employee' THEN
  SELECT array_agg(DISTINCT e.id) INTO ids FROM public.employees e
   JOIN public.employee_portal_accounts a ON a.tenant_id=e.tenant_id AND a.employee_id=e.id
   WHERE e.tenant_id=t AND e.status::text IN ('aktiv','active') AND a.status='active'
    AND a.id=public.current_portal_account_id() AND a.auth_user_id=auth.uid();
 ELSIF coalesce(public.current_portal_type(),'business')='business' THEN
  SELECT array_agg(DISTINCT e.id) INTO ids FROM public.employees e JOIN public.profiles p ON p.id=e.profile_id
   WHERE e.tenant_id=t AND p.tenant_id=t AND e.status::text IN ('aktiv','active') AND p.is_active AND p.status::text='active'
    AND (p.auth_user_id=auth.uid() OR (p.auth_user_id IS NULL AND p.id=auth.uid()));
 ELSE RAISE EXCEPTION 'Persönlicher Mitarbeitendenzugang erforderlich' USING ERRCODE='42501'; END IF;
 IF coalesce(cardinality(ids),0)>1 THEN RAISE EXCEPTION 'Mitarbeitendenzuordnung ist nicht eindeutig' USING ERRCODE='42501'; END IF;
 RETURN ids[1];
END $$;
CREATE FUNCTION care_security.gkv_employee_reviewer(t uuid) RETURNS boolean
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT care_security.gkv_monthly_writer(t) AND care_security.gkv_exchange_actor(t,'office.employees.edit')
$$;
CREATE FUNCTION care_security.gkv_employee_result(r care_security.gkv_employee_registrations) RETURNS jsonb
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT (to_jsonb(r)-'submitted_session')||jsonb_build_object('employee_name',e.first_name||' '||e.last_name)
 FROM public.employees e WHERE e.id=r.employee_id AND e.tenant_id=r.tenant_id
$$;
CREATE FUNCTION care_security.gkv_employee_workspace(t uuid,p_after uuid DEFAULT NULL) RETURNS jsonb
 LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE employee uuid; reviewer boolean; rows jsonb; cursor uuid; label text;
BEGIN
 employee:=care_security.gkv_employee_self(t); reviewer:=care_security.gkv_employee_reviewer(t);
 IF employee IS NULL AND reviewer IS NOT TRUE THEN RAISE EXCEPTION 'Persönliche Zuordnung oder Prüfauftrag fehlt' USING ERRCODE='42501'; END IF;
 SELECT first_name||' '||last_name INTO label FROM public.employees WHERE id=employee AND tenant_id=t;
 WITH page AS (SELECT r.* FROM care_security.gkv_employee_registrations r WHERE tenant_id=t
   AND (reviewer OR (employee_id=employee AND actor_id=auth.uid())) AND (p_after IS NULL OR id>p_after) ORDER BY id LIMIT 51),
 visible AS (SELECT * FROM page ORDER BY id LIMIT 50)
 SELECT coalesce((SELECT jsonb_agg(care_security.gkv_employee_result(v) ORDER BY id) FROM visible v),'[]'),
   CASE WHEN (SELECT count(*) FROM page)>50 THEN (SELECT id FROM visible ORDER BY id DESC LIMIT 1) END INTO rows,cursor;
 RETURN jsonb_build_object('tenantId',t,'actorId',auth.uid(),'employeeId',employee,'employeeName',label,
   'canReview',coalesce(reviewer,false),'checkedAt',clock_timestamp(),'items',rows,'nextCursor',cursor);
END $$;
CREATE FUNCTION care_security.gkv_employee_request_status(t uuid,p_request uuid) RETURNS jsonb
 LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE q care_security.gkv_employee_requests; r care_security.gkv_employee_registrations; employee uuid;
BEGIN
 employee:=care_security.gkv_employee_self(t);
 SELECT * INTO q FROM care_security.gkv_employee_requests WHERE tenant_id=t AND request_id=p_request AND actor_id=auth.uid();
 IF NOT FOUND THEN RETURN jsonb_build_object('state','not-found','tenantId',t,'requestId',p_request); END IF;
 SELECT * INTO r FROM care_security.gkv_employee_registrations WHERE tenant_id=t AND id=q.registration_id;
 IF (r.actor_id=auth.uid() AND r.employee_id=employee) IS NOT TRUE AND care_security.gkv_employee_reviewer(t) IS NOT TRUE THEN
  RAISE EXCEPTION 'Zugriff auf den Prüfauftrag fehlt' USING ERRCODE='42501'; END IF;
 RETURN jsonb_build_object('state','applied','tenantId',t,'requestId',p_request,'registration',care_security.gkv_employee_result(r));
END $$;
CREATE FUNCTION care_security.gkv_employee_command(t uuid,p_request uuid,p_action text,p_input jsonb) RETURNS jsonb
 LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog SET lock_timeout='3s' AS $$
DECLARE employee uuid; session uuid; r care_security.gkv_employee_registrations;
 q care_security.gkv_employee_requests; required text[]; fingerprint text; old jsonb; until_at timestamptz;
BEGIN
 employee:=care_security.gkv_employee_self(t); session:=care_security.gkv_monthly_live_session();
 IF p_request IS NULL OR p_action IS NULL OR p_action NOT IN ('submit','approve','reject','withdraw','revoke')
   OR jsonb_typeof(p_input) IS DISTINCT FROM 'object' OR octet_length(p_input::text)>8000 THEN
  RAISE EXCEPTION 'Ungültiger Beschäftigtenauftrag' USING ERRCODE='22023'; END IF;
 required:=CASE p_action WHEN 'submit' THEN ARRAY['id','employeeNumber','evidenceReference']
   WHEN 'approve' THEN ARRAY['id','revision','reviewReference','reviewNote','validUntil','reviewed'] ELSE ARRAY['id','revision','reason'] END;
 IF NOT p_input ?& required OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_input) k WHERE NOT k=ANY(required))
   OR EXISTS(SELECT 1 FROM unnest(required) k WHERE p_input->k='null'::jsonb
      OR (k NOT IN ('revision','reviewed') AND jsonb_typeof(p_input->k) IS DISTINCT FROM 'string')) THEN
  RAISE EXCEPTION 'Auftragsfelder fehlen oder sind unbekannt' USING ERRCODE='22023'; END IF;
 fingerprint:=encode(sha256(convert_to(p_action||':'||p_input::text,'UTF8')),'hex');
 PERFORM pg_advisory_xact_lock(hashtextextended(t||':gkv-employee-request:'||p_request,0));
 SELECT * INTO q FROM care_security.gkv_employee_requests WHERE tenant_id=t AND request_id=p_request;
 IF FOUND THEN
  IF q.actor_id<>auth.uid() OR q.request_sha256<>fingerprint THEN RAISE EXCEPTION 'Auftrag bereits anders verwendet' USING ERRCODE='40001'; END IF;
  RETURN care_security.gkv_employee_request_status(t,p_request)->'registration';
 END IF;
 IF p_action='submit' THEN
  IF employee IS NULL THEN RAISE EXCEPTION 'Eigene Mitarbeitendenzuordnung fehlt' USING ERRCODE='42501'; END IF;
  IF jsonb_typeof(p_input->'employeeNumber') IS DISTINCT FROM 'string' OR p_input->>'employeeNumber' !~ '^[0-9]{9}$'
    OR NOT care_security.gkv_monthly_fact_text(p_input->>'evidenceReference',500) OR length(p_input->>'evidenceReference')<3 THEN
   RAISE EXCEPTION 'Neunstellige Beschäftigtennummer und Nachweisreferenz erforderlich' USING ERRCODE='22023'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(t||':gkv-employee:'||employee,0));
  INSERT INTO care_security.gkv_employee_registrations(id,tenant_id,employee_id,actor_id,employee_number,evidence_reference,submitted_at,submitted_session,state)
   VALUES((p_input->>'id')::uuid,t,employee,auth.uid(),p_input->>'employeeNumber',p_input->>'evidenceReference',clock_timestamp(),session,'pending') RETURNING * INTO r;
 ELSE
  SELECT * INTO r FROM care_security.gkv_employee_registrations WHERE tenant_id=t AND id=(p_input->>'id')::uuid;
  IF NOT FOUND THEN RAISE EXCEPTION 'Meldung nicht verfügbar' USING ERRCODE='42501'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(t||':gkv-employee:'||r.employee_id,0));
  SELECT * INTO r FROM care_security.gkv_employee_registrations WHERE tenant_id=t AND id=r.id FOR UPDATE;
  IF p_action='withdraw' THEN
   IF r.actor_id IS DISTINCT FROM auth.uid() OR r.employee_id IS DISTINCT FROM employee THEN
    RAISE EXCEPTION 'Nur die eigene Meldung kann zurückgezogen werden' USING ERRCODE='42501'; END IF;
  ELSIF care_security.gkv_employee_reviewer(t) IS NOT TRUE OR r.actor_id=auth.uid() OR r.employee_id=employee THEN
   RAISE EXCEPTION 'Prüfung durch eine andere beauftragte Person erforderlich' USING ERRCODE='42501'; END IF;
  IF jsonb_typeof(p_input->'revision') IS DISTINCT FROM 'number' OR p_input->>'revision' !~ '^[1-9][0-9]*$'
    OR r.revision IS DISTINCT FROM (p_input->>'revision')::integer THEN
   RAISE EXCEPTION 'Meldung wurde geändert' USING ERRCODE='40001'; END IF;
  old:=to_jsonb(r);
  IF p_action='approve' THEN
   IF r.state<>'pending' OR p_input->'reviewed' IS DISTINCT FROM 'true'::jsonb
     OR NOT care_security.gkv_monthly_fact_text(p_input->>'reviewReference',500) OR length(p_input->>'reviewReference')<3
     OR NOT care_security.gkv_monthly_fact_text(p_input->>'reviewNote',2000) OR length(p_input->>'reviewNote')<3 THEN
    RAISE EXCEPTION 'Dokumentierte unabhängige Prüfung erforderlich' USING ERRCODE='22023'; END IF;
   until_at:=(p_input->>'validUntil')::timestamptz;
   IF NOT isfinite(until_at) OR until_at<=clock_timestamp() OR until_at>clock_timestamp()+interval '366 days' THEN
    RAISE EXCEPTION 'Gültigkeit muss in den nächsten 366 Tagen enden' USING ERRCODE='22023'; END IF;
   IF NOT EXISTS(SELECT 1 FROM public.employees e WHERE e.id=r.employee_id AND e.tenant_id=t AND e.status::text IN ('aktiv','active')
     AND (EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=e.profile_id AND p.tenant_id=t AND p.is_active AND p.status::text='active'
       AND (p.auth_user_id=r.actor_id OR (p.auth_user_id IS NULL AND p.id=r.actor_id)))
      OR EXISTS(SELECT 1 FROM public.employee_portal_accounts a WHERE a.tenant_id=t AND a.employee_id=e.id AND a.auth_user_id=r.actor_id AND a.status='active'))) THEN
    RAISE EXCEPTION 'Mitarbeitende nicht aktiv' USING ERRCODE='42501'; END IF;
   PERFORM pg_advisory_xact_lock(hashtextextended(t||':gkv-number:'||r.employee_number,0));
   IF EXISTS(SELECT 1 FROM care_security.gkv_employee_registrations WHERE tenant_id=t AND state='approved'
     AND valid_until>clock_timestamp() AND (employee_id=r.employee_id OR employee_number=r.employee_number)) THEN
    RAISE EXCEPTION 'Aktive Nummernzuordnung bereits vorhanden; zuerst fachlich klären' USING ERRCODE='40001'; END IF;
   UPDATE care_security.gkv_employee_registrations SET state='approved',revision=revision+1,
    reviewed_by=auth.uid(),reviewed_at=clock_timestamp(),review_reference=p_input->>'reviewReference',review_note=p_input->>'reviewNote',
    valid_from=clock_timestamp(),valid_until=until_at WHERE id=r.id RETURNING * INTO r;
  ELSE
   IF (p_action IN ('reject','withdraw') AND r.state<>'pending') OR (p_action='revoke' AND r.state<>'approved')
     OR NOT care_security.gkv_monthly_fact_text(p_input->>'reason',2000) OR length(p_input->>'reason')<3 THEN
    RAISE EXCEPTION 'Aktueller Stand und nachvollziehbarer Grund erforderlich' USING ERRCODE='22023'; END IF;
   UPDATE care_security.gkv_employee_registrations SET state=CASE p_action WHEN 'reject' THEN 'rejected' WHEN 'withdraw' THEN 'withdrawn' ELSE 'revoked' END,
    revision=revision+1,closed_by=auth.uid(),closed_at=clock_timestamp(),close_reason=p_input->>'reason' WHERE id=r.id RETURNING * INTO r;
  END IF;
 END IF;
 INSERT INTO care_security.gkv_employee_events(tenant_id,registration_id,actor_id,session_id,action,before_state,after_state)
  VALUES(t,r.id,auth.uid(),session,p_action,old,to_jsonb(r));
 INSERT INTO care_security.gkv_employee_requests VALUES(t,p_request,auth.uid(),fingerprint,r.id);
 RETURN care_security.gkv_employee_result(r);
END $$;

-- Capture only at original proof INSERT, before a service record is derived.
-- No authenticated RPC can attach a capture to an existing proof. The 15-minute
-- policy is a conservative product limit, not a claimed statutory time limit.
CREATE FUNCTION care_security.gkv_employee_capture_insert() RETURNS trigger
 LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE employee uuid; registration care_security.gkv_employee_registrations; v public.assist_visits; captured timestamptz;
BEGIN
 IF auth.uid() IS NULL OR auth.jwt()->>'role' IS DISTINCT FROM 'authenticated' THEN RETURN NEW; END IF;
 employee:=care_security.gkv_employee_self(NEW.tenant_id);
 IF employee IS NULL THEN RETURN NEW; END IF;
 SELECT * INTO registration FROM care_security.gkv_employee_registrations WHERE tenant_id=NEW.tenant_id
  AND employee_id=employee AND actor_id=auth.uid() AND state='approved' AND valid_until>clock_timestamp() FOR SHARE;
 IF NOT FOUND THEN RETURN NEW; END IF;
 SELECT * INTO v FROM public.assist_visits WHERE tenant_id=NEW.tenant_id AND id=NEW.visit_id FOR SHARE;
 captured:=clock_timestamp();
 IF NOT FOUND OR v.employee_id IS DISTINCT FROM employee OR v.actual_start_at IS NULL OR v.actual_end_at IS NULL
   OR NOT isfinite(v.actual_start_at) OR NOT isfinite(v.actual_end_at) OR v.actual_end_at<v.actual_start_at
   OR v.actual_end_at>captured OR v.actual_end_at<captured-interval '15 minutes'
   OR registration.valid_from>v.actual_start_at OR registration.valid_until<=captured
   OR NEW.payload_hash IS DISTINCT FROM 'sha256:'||encode(sha256(convert_to(public.workflow_canonical_json(NEW.payload_snapshot),'UTF8')),'hex') THEN
  RAISE EXCEPTION 'Zeitnahe persönliche Ursprungserfassung passt nicht zum Einsatz' USING ERRCODE='40001'; END IF;
 INSERT INTO care_security.gkv_employee_captures(tenant_id,proof_id,visit_id,employee_id,actor_id,session_id,registration_id,
   employee_number,proof_payload_hash,captured_at,service_started_at,service_ended_at,policy)
  VALUES(NEW.tenant_id,NEW.id,NEW.visit_id,employee,auth.uid(),care_security.gkv_monthly_live_session(),registration.id,
   registration.employee_number,NEW.payload_hash,captured,v.actual_start_at,v.actual_end_at,'personal-proof-insert-15m-v1');
 RETURN NEW;
END $$;
CREATE TRIGGER gkv_employee_capture_insert AFTER INSERT ON public.assist_visit_proofs
 FOR EACH ROW EXECUTE FUNCTION care_security.gkv_employee_capture_insert();

-- Called only by the existing canonical monthly source builder. A previously
-- captured but altered/revoked origin must fail, never downgrade to a legacy row.
CREATE FUNCTION care_security.gkv_employee_source(t uuid,source jsonb) RETURNS jsonb
 LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE c care_security.gkv_employee_captures; r care_security.gkv_employee_registrations; original public.assist_visit_proofs;
BEGIN
 SELECT * INTO c FROM care_security.gkv_employee_captures WHERE tenant_id=t
  AND proof_id=(source->'sourceReceipt'->>'proof_id')::uuid FOR SHARE;
 IF NOT FOUND THEN RETURN NULL; END IF;
 SELECT * INTO r FROM care_security.gkv_employee_registrations WHERE tenant_id=t AND id=c.registration_id FOR SHARE;
 IF NOT FOUND OR r.state<>'approved' OR r.employee_id<>c.employee_id OR r.actor_id<>c.actor_id OR r.employee_number<>c.employee_number
   OR r.valid_from>c.service_started_at OR r.valid_until<=c.captured_at
   OR c.employee_id::text IS DISTINCT FROM source->>'employeeId'
   OR c.visit_id::text IS DISTINCT FROM source->'sourceReceipt'->>'visit_id'
   OR c.proof_payload_hash IS DISTINCT FROM source->'sourceReceipt'->>'proof_payload_hash'
   OR c.service_started_at IS DISTINCT FROM (source->'sourceReceipt'->>'service_started_at')::timestamptz
   OR c.service_ended_at IS DISTINCT FROM (source->'sourceReceipt'->>'service_ended_at')::timestamptz THEN
  RAISE EXCEPTION 'Persönliche Ursprungszuordnung wurde geändert oder widerrufen' USING ERRCODE='40001'; END IF;
 SELECT * INTO original FROM public.assist_visit_proofs WHERE tenant_id=t AND id=c.proof_id FOR SHARE;
 IF NOT FOUND OR original.visit_id<>c.visit_id OR original.payload_hash IS DISTINCT FROM c.proof_payload_hash
  OR original.payload_hash IS DISTINCT FROM 'sha256:'||encode(sha256(convert_to(public.workflow_canonical_json(original.payload_snapshot),'UTF8')),'hex') THEN
  RAISE EXCEPTION 'Ursprünglicher Leistungsinhalt wurde verändert' USING ERRCODE='40001'; END IF;
 RETURN jsonb_build_object('id',c.id,'registrationId',c.registration_id,'actorId',c.actor_id,'employeeId',c.employee_id,
  'employeeNumber',c.employee_number,'proofId',c.proof_id,'proofPayloadHash',c.proof_payload_hash,'capturedAt',c.captured_at,
  'policy',c.policy,'reviewedBy',r.reviewed_by,'reviewedAt',r.reviewed_at);
END $$;
CREATE FUNCTION care_security.gkv_employee_immutable() RETURNS trigger
 LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
 BEGIN RAISE EXCEPTION 'Ursprung und Prüfprotokoll sind unveränderbar' USING ERRCODE='42501'; END $$;
CREATE TRIGGER gkv_employee_capture_immutable BEFORE UPDATE OR DELETE ON care_security.gkv_employee_captures
 FOR EACH ROW EXECUTE FUNCTION care_security.gkv_employee_immutable();
CREATE TRIGGER gkv_employee_event_immutable BEFORE UPDATE OR DELETE ON care_security.gkv_employee_events
 FOR EACH ROW EXECUTE FUNCTION care_security.gkv_employee_immutable();

CREATE FUNCTION public.gkv_employee_workspace(t uuid,p_after uuid DEFAULT NULL) RETURNS jsonb
 LANGUAGE sql SECURITY INVOKER SET search_path=pg_catalog AS $$ SELECT care_security.gkv_employee_workspace(t,p_after) $$;
CREATE FUNCTION public.gkv_employee_command(t uuid,p_request uuid,p_action text,p_input jsonb) RETURNS jsonb
 LANGUAGE sql SECURITY INVOKER SET search_path=pg_catalog AS $$ SELECT care_security.gkv_employee_command(t,p_request,p_action,p_input) $$;
CREATE FUNCTION public.gkv_employee_request_status(t uuid,p_request uuid) RETURNS jsonb
 LANGUAGE sql SECURITY INVOKER SET search_path=pg_catalog AS $$ SELECT care_security.gkv_employee_request_status(t,p_request) $$;
DO $$ DECLARE name text; f regprocedure; BEGIN
 FOREACH name IN ARRAY ARRAY['gkv_employee_registrations','gkv_employee_requests','gkv_employee_events','gkv_employee_captures'] LOOP
  EXECUTE format('ALTER TABLE care_security.%I ENABLE ROW LEVEL SECURITY',name);
  EXECUTE format('REVOKE ALL ON care_security.%I FROM PUBLIC,anon,authenticated,service_role',name);
 END LOOP;
 FOR f IN SELECT p.oid::regprocedure FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname IN ('care_security','public') AND p.proname LIKE 'gkv_employee_%' LOOP
  EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated,service_role',f);
 END LOOP;
END $$;
GRANT EXECUTE ON FUNCTION care_security.gkv_employee_workspace(uuid,uuid),public.gkv_employee_workspace(uuid,uuid),
 care_security.gkv_employee_command(uuid,uuid,text,jsonb),public.gkv_employee_command(uuid,uuid,text,jsonb),
 care_security.gkv_employee_request_status(uuid,uuid),public.gkv_employee_request_status(uuid,uuid) TO authenticated;
COMMIT;
