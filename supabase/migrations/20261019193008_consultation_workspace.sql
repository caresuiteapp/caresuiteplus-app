-- One authoritative web workflow for office and assigned employee portal actors.
-- Existing consultation tables and native Assist execution are preserved.
BEGIN;
CREATE TABLE public.consultation_workspaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  client_id uuid NOT NULL REFERENCES public.clients(id), title text NOT NULL CHECK(length(title) BETWEEN 1 AND 200),
  created_at timestamptz NOT NULL DEFAULT now(), created_by uuid NOT NULL,
  UNIQUE(tenant_id,id)
);
CREATE TABLE public.consultation_encounters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL,
  case_id uuid NOT NULL, service_kind text NOT NULL CHECK(service_kind IN ('37_3','45')),
  assigned_employee_id uuid REFERENCES public.employees(id),
  status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','scheduled','in_progress','documentation_pending','submitted','returned','approved','cancelled','no_show')),
  version integer NOT NULL DEFAULT 1 CHECK(version>0),
  scheduled_start timestamptz, scheduled_end timestamptz, actual_start timestamptz, actual_end timestamptz,
  preparation text NOT NULL DEFAULT '', answers jsonb NOT NULL DEFAULT '{"schemaVersion":1}',
  review_note text NOT NULL DEFAULT '', review_section text,
  client_snapshot jsonb NOT NULL, last_read_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(), submitted_by uuid,
  FOREIGN KEY(tenant_id,case_id) REFERENCES public.consultation_workspaces(tenant_id,id),
  UNIQUE(tenant_id,id), CHECK(scheduled_end>scheduled_start), CHECK(actual_end>=actual_start),
  CHECK(jsonb_typeof(answers)='object' AND octet_length(answers::text)<200000)
);
CREATE INDEX consultation_encounters_inbox ON public.consultation_encounters(tenant_id,assigned_employee_id,status,scheduled_start);
CREATE INDEX consultation_encounters_case ON public.consultation_encounters(tenant_id,case_id);
CREATE TABLE public.consultation_qualifications (
  tenant_id uuid NOT NULL REFERENCES public.tenants(id), employee_id uuid NOT NULL REFERENCES public.employees(id),
  service_kind text NOT NULL CHECK(service_kind IN ('37_3','45')), valid_from date NOT NULL, valid_until date,
  evidence text NOT NULL CHECK(length(btrim(evidence)) BETWEEN 1 AND 2000), active boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(), updated_by uuid NOT NULL,
  PRIMARY KEY(tenant_id,employee_id,service_kind), CHECK(valid_until>=valid_from)
);
CREATE TABLE public.consultation_revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, encounter_id uuid NOT NULL,
  version integer NOT NULL, snapshot jsonb NOT NULL, content_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(), created_by uuid NOT NULL,
  FOREIGN KEY(tenant_id,encounter_id) REFERENCES public.consultation_encounters(tenant_id,id), UNIQUE(encounter_id,version)
);
CREATE TABLE public.consultation_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES public.tenants(id), encounter_id uuid,
  action text NOT NULL, note text NOT NULL DEFAULT '', actor_id uuid NOT NULL, actor_label text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(tenant_id,encounter_id) REFERENCES public.consultation_encounters(tenant_id,id)
);
CREATE INDEX consultation_events_encounter ON public.consultation_events(tenant_id,encounter_id,created_at);
CREATE TABLE public.consultation_requests (
  tenant_id uuid NOT NULL REFERENCES public.tenants(id), actor_id uuid NOT NULL, request_id uuid NOT NULL,
  payload_hash text NOT NULL, result jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(tenant_id,actor_id,request_id)
);
-- No direct client table access: the two invoker RPCs below are the sole API.
DO $b$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['consultation_workspaces','consultation_encounters','consultation_qualifications','consultation_revisions','consultation_events','consultation_requests'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
    EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC,anon,authenticated',t);
  END LOOP;
END $b$;

-- Defaults only. Tenant role sets and employee denies still take precedence.
INSERT INTO public.role_permissions(role_id,permission_key,can_view)
SELECT r.id,p.key,true FROM public.roles r CROSS JOIN (VALUES
 ('beratung.cases.manage'),('beratung.cases.review'),('beratung.qualifications.manage')) p(key)
WHERE to_jsonb(r)->>'tenant_id' IS NULL
 AND (lower(r.key) NOT IN ('owner','admin','business_admin') OR EXISTS(SELECT 1 FROM public.role_permissions existing WHERE existing.role_id=r.id))
 AND (lower(r.key) IN ('owner','admin','business_admin')
   OR lower(r.key) IN ('manager','business_manager','counselor') AND p.key<>'beratung.qualifications.manage'
   OR lower(r.key)='dispatch' AND p.key='beratung.cases.manage')
 AND NOT EXISTS(SELECT 1 FROM public.role_permissions rp WHERE rp.role_id=r.id AND rp.permission_key=p.key);

CREATE FUNCTION care_security.consultation_office(p_tenant uuid,p_permission text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $b$
 SELECT care_security.company_actor(p_tenant,p_permission)
  AND care_security.company_permission(p_tenant,'beratung.cases.view')
  AND care_security.company_permission(p_tenant,'office.clients.view_sensitive')
  AND NOT EXISTS(SELECT 1 FROM public.employee_data_scopes s JOIN public.employees e ON e.id=s.employee_id AND e.tenant_id=s.tenant_id
    WHERE s.tenant_id=p_tenant AND e.profile_id=care_security.company_profile(p_tenant)
      AND lower(btrim(s.module)) IN ('beratung','consultation')
      AND (s.scope_type<>'tenant' OR nullif(btrim(s.scope_value),'') IS NOT NULL AND btrim(s.scope_value)<>p_tenant::text))
$b$;
CREATE FUNCTION care_security.consultation_employee(p_tenant uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $b$
 SELECT e.id FROM public.employees e WHERE e.tenant_id=p_tenant AND e.deleted_at IS NULL AND e.status::text IN ('active','aktiv')
 AND p_tenant=public.current_tenant_id() AND auth.uid() IS NOT NULL AND (
   (public.current_role_key()='employee_portal' AND EXISTS(SELECT 1 FROM public.employee_portal_accounts a
    WHERE a.id=public.current_portal_account_id() AND a.employee_id=e.id AND a.tenant_id=p_tenant
      AND a.auth_user_id=auth.uid() AND a.status='active'))
   OR (e.profile_id=care_security.company_profile(p_tenant) AND care_security.consultation_office(p_tenant,'beratung.cases.view'))
 ) ORDER BY e.id LIMIT 1
$b$;
CREATE FUNCTION care_security.consultation_qualified(p_tenant uuid,p_employee uuid,p_kind text,p_date date)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $b$
 SELECT EXISTS(SELECT 1 FROM public.consultation_qualifications q JOIN public.employees e ON e.id=q.employee_id AND e.tenant_id=q.tenant_id
 WHERE q.tenant_id=p_tenant AND q.employee_id=p_employee AND q.service_kind=p_kind AND q.active
 AND q.valid_from<=p_date AND (q.valid_until IS NULL OR q.valid_until>=p_date)
 AND e.deleted_at IS NULL AND e.status::text IN ('active','aktiv'))
$b$;
CREATE FUNCTION care_security.consultation_client(p_tenant uuid,p_client uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $b$
 SELECT jsonb_build_object('id',c.id,'name',coalesce(nullif(c.full_name,''),nullif(concat_ws(' ',c.first_name,c.last_name),''),'Unbenannt'),
  'address',concat_ws(', ',nullif(concat_ws(' ',c.street,c.house_number),''),nullif(concat_ws(' ',c.postal_code,c.city),'')),
  'phone',coalesce(nullif(c.mobile,''),c.phone),'care_grade',c.care_level::text,'payer',c.insurance_name,
  'insurance_number',c.insurance_number,'access_notes',c.access_notes,'notes',c.visible_notes_for_employee)
 FROM public.clients c WHERE c.id=p_client AND c.tenant_id=p_tenant AND c.deleted_at IS NULL
$b$;
-- Drafts may be incomplete, but their shape must remain safe to load in both UIs.
CREATE FUNCTION care_security.consultation_answers_shape(a jsonb)
RETURNS void LANGUAGE plpgsql IMMUTABLE SET search_path=pg_catalog AS $b$
DECLARE k text; item jsonb;
BEGIN
 IF jsonb_typeof(a) IS DISTINCT FROM 'object' OR a->>'schemaVersion' IS DISTINCT FROM '1' OR octet_length(a::text)>180000 THEN
  RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Die Dokumentation hat ein ungültiges Format.'; END IF;
 FOREACH k IN ARRAY ARRAY['clientPerspective','caregiverPerspective','situation','burden','guidance','careSecured','risk','riskNotes','riskAction','findingsConsent','materials','summary','followUpDate','followUpNote'] LOOP
  IF jsonb_typeof(a->k) IS DISTINCT FROM 'string' OR length(a->>k)>10000 THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Die Dokumentation enthält ein ungültiges Textfeld.'; END IF;
 END LOOP;
 FOREACH k IN ARRAY ARRAY['participants','topics','goals','measures'] LOOP
  IF jsonb_typeof(a->k) IS DISTINCT FROM 'array' OR jsonb_array_length(a->k)>60 THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Die Dokumentation enthält ungültige Listen.'; END IF;
  IF k='topics' THEN
   IF EXISTS(SELECT 1 FROM jsonb_array_elements(a->k) v WHERE jsonb_typeof(v)<>'string') THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Ungültiges Beratungsthema.'; END IF;
  ELSE
   IF EXISTS(SELECT 1 FROM jsonb_array_elements(a->k) v WHERE jsonb_typeof(v)<>'object' OR nullif(v->>'id','') IS NULL)
    OR (SELECT count(*)<>count(DISTINCT v->>'id') FROM jsonb_array_elements(a->k) v) THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Listeneinträge müssen eindeutige Kennungen haben.'; END IF;
  END IF;
 END LOOP;
 FOR item IN SELECT * FROM jsonb_array_elements(a->'participants') LOOP
  FOREACH k IN ARRAY ARRAY['id','name','role','authority'] LOOP
   IF jsonb_typeof(item->k) IS DISTINCT FROM 'string' THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Ungültiger Teilnehmendeneintrag.'; END IF;
  END LOOP;
 END LOOP;
 FOR item IN SELECT * FROM jsonb_array_elements(a->'goals') LOOP
  FOREACH k IN ARRAY ARRAY['id','title','method','practice','result','nextStep'] LOOP
   IF jsonb_typeof(item->k) IS DISTINCT FROM 'string' THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Ungültiges Lernziel.'; END IF;
  END LOOP;
 END LOOP;
 FOR item IN SELECT * FROM jsonb_array_elements(a->'measures') LOOP
  FOREACH k IN ARRAY ARRAY['id','title','owner','due','status','outcome'] LOOP
   IF jsonb_typeof(item->k) IS DISTINCT FROM 'string' THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Ungültige Empfehlung.'; END IF;
  END LOOP;
 END LOOP;
END $b$;
CREATE FUNCTION care_security.consultation_validate(p_kind text,a jsonb)
RETURNS void LANGUAGE plpgsql IMMUTABLE SET search_path=pg_catalog AS $b$
DECLARE v jsonb; k text;
BEGIN
 PERFORM care_security.consultation_answers_shape(a);
 IF jsonb_typeof(a) IS DISTINCT FROM 'object' OR a->>'schemaVersion' IS DISTINCT FROM '1' OR octet_length(a::text)>180000 THEN
  RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Die Dokumentation hat ein ungültiges Format.'; END IF;
 FOREACH k IN ARRAY ARRAY['participants','topics','goals','measures'] LOOP
  IF jsonb_typeof(a->k) IS DISTINCT FROM 'array' OR jsonb_array_length(a->k)>60 THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Die Dokumentation enthält ungültige Listen.'; END IF;
 END LOOP;
 IF jsonb_array_length(a->'participants')=0 OR EXISTS(SELECT 1 FROM jsonb_array_elements(a->'participants') x WHERE nullif(btrim(x->>'name'),'') IS NULL OR nullif(btrim(x->>'role'),'') IS NULL)
 THEN RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Teilnehmende mit Name und Rolle ergänzen.'; END IF;
 IF nullif(btrim(a->>'situation'),'') IS NULL OR nullif(btrim(a->>'summary'),'') IS NULL OR coalesce(a->>'risk','') NOT IN ('none','clarify','urgent')
 THEN RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Situation, Handlungsbedarf und gemeinsames Ergebnis vervollständigen.'; END IF;
 IF a->>'risk' IN ('clarify','urgent') AND (nullif(btrim(a->>'riskNotes'),'') IS NULL OR nullif(btrim(a->>'riskAction'),'') IS NULL)
 THEN RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Auffälligkeit und veranlasste Hilfe dokumentieren.'; END IF;
 IF p_kind='37_3' THEN
  IF nullif(btrim(a->>'clientPerspective'),'') IS NULL OR nullif(btrim(a->>'caregiverPerspective'),'') IS NULL OR nullif(btrim(a->>'guidance'),'') IS NULL
    OR jsonb_array_length(a->'topics')=0 OR coalesce(a->>'careSecured','') NOT IN ('yes','partly','no') OR coalesce(a->>'findingsConsent','') NOT IN ('yes','no')
  THEN RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Beratung, Perspektiven, Sicherstellung der Pflege und Entscheidung zur Weitergabe vervollständigen.'; END IF;
 ELSE
  IF jsonb_array_length(a->'goals')=0 THEN RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Mindestens ein Lernziel ergänzen.'; END IF;
  FOR v IN SELECT * FROM jsonb_array_elements(a->'goals') LOOP
   IF nullif(btrim(v->>'title'),'') IS NULL OR nullif(btrim(v->>'method'),'') IS NULL OR nullif(btrim(v->>'practice'),'') IS NULL
    OR coalesce(v->>'result','') NOT IN ('understood','supported','independent','practice_needed')
    OR v->>'result'='practice_needed' AND nullif(btrim(v->>'nextStep'),'') IS NULL
   THEN RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Lernziel, Anleitung, Übung und Lernergebnis vervollständigen.'; END IF;
  END LOOP;
 END IF;
 FOR v IN SELECT * FROM jsonb_array_elements(a->'measures') LOOP
  IF nullif(btrim(v->>'title'),'') IS NULL OR nullif(btrim(v->>'owner'),'') IS NULL OR coalesce(v->>'due','') !~ '^\d{4}-\d{2}-\d{2}$'
    OR coalesce(v->>'status','') NOT IN ('open','done') THEN RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Empfehlung, Zuständigkeit und Termin vervollständigen.'; END IF;
  PERFORM (v->>'due')::date;
 END LOOP;
 IF nullif(a->>'followUpDate','') IS NOT NULL THEN PERFORM (a->>'followUpDate')::date; END IF;
END $b$;

CREATE FUNCTION care_security.consultation_load(p_tenant uuid,p_employee_view boolean,p_case uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $b$
DECLARE v_office boolean:=care_security.consultation_office(p_tenant,'beratung.cases.view'); v_employee uuid:=care_security.consultation_employee(p_tenant); v_ids uuid[];
BEGIN
 IF auth.uid() IS NULL OR p_tenant IS DISTINCT FROM public.current_tenant_id() OR NOT v_office AND v_employee IS NULL
  OR public.tenant_has_platform_module('beratung',p_tenant) IS DISTINCT FROM true THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Kein Zugriff auf diesen Beratungsarbeitsplatz.'; END IF;
 IF NOT coalesce(p_employee_view,true) AND NOT v_office THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Kein Verwaltungszugriff.'; END IF;
 SELECT coalesce(array_agg(e.id),'{}') INTO v_ids FROM public.consultation_encounters e WHERE e.tenant_id=p_tenant
  AND (p_case IS NULL OR e.case_id=p_case) AND ((v_office AND NOT p_employee_view) OR e.assigned_employee_id=v_employee);
 RETURN jsonb_build_object(
  'canManage',v_office AND NOT p_employee_view AND care_security.consultation_office(p_tenant,'beratung.cases.manage'),
  'canReview',v_office AND NOT p_employee_view AND care_security.consultation_office(p_tenant,'beratung.cases.review'),
  'canQualify',v_office AND NOT p_employee_view AND care_security.consultation_office(p_tenant,'beratung.qualifications.manage'),
  'employeeView',p_employee_view,
  'cases',coalesce((SELECT jsonb_agg(to_jsonb(c)-'created_by'||jsonb_build_object('client',care_security.consultation_client(p_tenant,c.client_id)) ORDER BY c.created_at DESC)
    FROM public.consultation_workspaces c WHERE c.tenant_id=p_tenant AND EXISTS(SELECT 1 FROM public.consultation_encounters e WHERE e.case_id=c.id AND e.id=ANY(v_ids))),'[]'),
  'encounters',coalesce((SELECT jsonb_agg(to_jsonb(e)-'submitted_by'||jsonb_build_object('employee_name',nullif(concat_ws(' ',s.first_name,s.last_name),''),
    'can_execute',e.assigned_employee_id=v_employee AND care_security.consultation_qualified(p_tenant,v_employee,e.service_kind,(coalesce(e.actual_start,e.scheduled_start,now()) AT TIME ZONE 'Europe/Berlin')::date)) ORDER BY e.scheduled_start ASC NULLS LAST,e.updated_at DESC)
    FROM public.consultation_encounters e LEFT JOIN public.employees s ON s.id=e.assigned_employee_id WHERE e.id=ANY(v_ids)),'[]'),
  'clients',CASE WHEN v_office AND NOT p_employee_view AND care_security.consultation_office(p_tenant,'beratung.cases.manage') THEN
    coalesce((SELECT jsonb_agg(care_security.consultation_client(p_tenant,c.id) ORDER BY c.last_name,c.first_name) FROM public.clients c WHERE c.tenant_id=p_tenant AND c.deleted_at IS NULL),'[]') ELSE '[]'::jsonb END,
  'employees',CASE WHEN v_office AND NOT p_employee_view THEN coalesce((SELECT jsonb_agg(jsonb_build_object('id',s.id,'name',concat_ws(' ',s.first_name,s.last_name),'qualifications',
    coalesce((SELECT jsonb_agg(to_jsonb(q)-'updated_by') FROM public.consultation_qualifications q WHERE q.tenant_id=p_tenant AND q.employee_id=s.id),'[]')) ORDER BY s.last_name,s.first_name)
    FROM public.employees s WHERE s.tenant_id=p_tenant AND s.deleted_at IS NULL AND s.status::text IN ('active','aktiv')),'[]') ELSE '[]'::jsonb END,
  'events',coalesce((SELECT jsonb_agg(to_jsonb(x)-'actor_id' ORDER BY x.created_at DESC) FROM public.consultation_events x WHERE x.tenant_id=p_tenant AND x.encounter_id=ANY(v_ids)),'[]'),
  'revisions',CASE WHEN p_case IS NOT NULL THEN coalesce((SELECT jsonb_agg(to_jsonb(x)-'created_by' ORDER BY x.created_at DESC) FROM public.consultation_revisions x WHERE x.tenant_id=p_tenant AND x.encounter_id=ANY(v_ids)),'[]') ELSE '[]'::jsonb END);
END $b$;

CREATE FUNCTION care_security.consultation_mutate(p_tenant uuid,p_action text,p_request uuid,p_encounter uuid,p_version integer,p_data jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $b$
DECLARE
 v_office boolean:=care_security.consultation_office(p_tenant,'beratung.cases.view'); v_employee uuid:=care_security.consultation_employee(p_tenant);
 v_manage boolean:=care_security.consultation_office(p_tenant,'beratung.cases.manage'); v_review boolean:=care_security.consultation_office(p_tenant,'beratung.cases.review');
 v_e public.consultation_encounters%ROWTYPE; v_case public.consultation_workspaces%ROWTYPE;
 v_hash text; v_prior public.consultation_requests%ROWTYPE; v_result jsonb; v_snapshot jsonb; v_signature jsonb;
 v_assigned uuid; v_start timestamptz; v_end timestamptz; v_kind text; v_client jsonb; v_actor text; v_note text:=coalesce(p_data->>'note','');
BEGIN
 IF auth.uid() IS NULL OR p_tenant IS DISTINCT FROM public.current_tenant_id() OR (NOT v_office AND v_employee IS NULL)
  OR public.tenant_has_platform_module('beratung',p_tenant) IS DISTINCT FROM true THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Kein Zugriff.'; END IF;
 IF p_request IS NULL OR jsonb_typeof(p_data) IS DISTINCT FROM 'object' OR octet_length(p_data::text)>1000000 THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Ungültiger Auftrag.'; END IF;
 IF p_action NOT IN ('create','add_visit','plan','read','start','finish','save','submit','return','approve','cancel','no_show','comment','qualify') THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Unbekannter Vorgang.'; END IF;
 -- Serialize identical requests before checking versions; replay never creates a second signature or visit.
 PERFORM pg_advisory_xact_lock(hashtextextended(p_tenant::text||auth.uid()::text||p_request::text,0));
 v_hash:=encode(sha256(convert_to(jsonb_build_object('action',p_action,'encounter',p_encounter,'version',p_version,'data',p_data)::text,'UTF8')),'hex');
 SELECT * INTO v_prior FROM public.consultation_requests WHERE tenant_id=p_tenant AND actor_id=auth.uid() AND request_id=p_request;
 IF FOUND THEN
  IF v_prior.payload_hash<>v_hash THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Die Anfragekennung wurde bereits für einen anderen Inhalt verwendet.'; END IF;
  -- Re-check assignment / office authority even for retry responses.
  IF NOT v_office AND NOT EXISTS(SELECT 1 FROM public.consultation_encounters e WHERE e.id=(v_prior.result->>'encounter_id')::uuid AND e.tenant_id=p_tenant AND e.assigned_employee_id=v_employee) THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Die Zuweisung ist nicht mehr gültig.'; END IF;
  RETURN v_prior.result;
 END IF;
 SELECT coalesce(nullif(p.display_name,''),nullif(concat_ws(' ',p.first_name,p.last_name),'')) INTO v_actor FROM public.profiles p WHERE p.id=care_security.company_profile(p_tenant);
 IF v_actor IS NULL THEN SELECT nullif(concat_ws(' ',e.first_name,e.last_name),'') INTO v_actor FROM public.employees e WHERE e.id=v_employee; END IF;
 v_actor:=coalesce(v_actor,'Berechtigte Person');
 IF p_action='qualify' THEN
  IF NOT care_security.consultation_office(p_tenant,'beratung.qualifications.manage') THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Keine Berechtigung zur Qualifikationsfreigabe.'; END IF;
  v_assigned:=(p_data->>'employee_id')::uuid; v_kind:=p_data->>'service_kind';
  IF NOT EXISTS(SELECT 1 FROM public.employees e WHERE e.id=v_assigned AND e.tenant_id=p_tenant AND e.deleted_at IS NULL AND e.status::text IN ('active','aktiv')) THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Mitarbeitende nicht verfügbar.'; END IF;
  INSERT INTO public.consultation_qualifications(tenant_id,employee_id,service_kind,valid_from,valid_until,evidence,active,updated_by)
   VALUES(p_tenant,v_assigned,v_kind,(p_data->>'valid_from')::date,nullif(p_data->>'valid_until','')::date,btrim(p_data->>'evidence'),coalesce((p_data->>'active')::boolean,true),auth.uid())
   ON CONFLICT(tenant_id,employee_id,service_kind) DO UPDATE SET valid_from=excluded.valid_from,valid_until=excluded.valid_until,evidence=excluded.evidence,active=excluded.active,updated_at=now(),updated_by=auth.uid();
  v_note:=jsonb_build_object('employee_id',v_assigned,'service_kind',v_kind,'valid_from',p_data->>'valid_from','valid_until',p_data->>'valid_until','active',coalesce((p_data->>'active')::boolean,true),'evidence',p_data->>'evidence')::text;
  v_result:=jsonb_build_object('case_id',null,'encounter_id',null,'version',0);
 ELSIF p_action IN ('create','add_visit') THEN
  IF NOT v_manage THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Keine Berechtigung zur Fallanlage.'; END IF;
  IF p_action='create' THEN
   v_client:=care_security.consultation_client(p_tenant,(p_data->>'client_id')::uuid);
   IF v_client IS NULL THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Klient nicht verfügbar.'; END IF;
   INSERT INTO public.consultation_workspaces(tenant_id,client_id,title,created_by) VALUES(p_tenant,(p_data->>'client_id')::uuid,btrim(p_data->>'title'),auth.uid()) RETURNING * INTO v_case;
  ELSE
   SELECT * INTO v_case FROM public.consultation_workspaces WHERE id=(p_data->>'case_id')::uuid AND tenant_id=p_tenant;
   IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Fall nicht verfügbar.'; END IF;
   v_client:=care_security.consultation_client(p_tenant,v_case.client_id);
   IF v_client IS NULL THEN RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Der Klient ist nicht mehr aktiv verfügbar.'; END IF;
  END IF;
  v_kind:=p_data->>'service_kind';
  INSERT INTO public.consultation_encounters(tenant_id,case_id,service_kind,client_snapshot,preparation)
   VALUES(p_tenant,v_case.id,v_kind,v_client,coalesce(p_data->>'preparation','')) RETURNING * INTO v_e;
  v_result:=jsonb_build_object('case_id',v_case.id,'encounter_id',v_e.id,'version',v_e.version);
 ELSE
  SELECT * INTO v_e FROM public.consultation_encounters WHERE id=p_encounter AND tenant_id=p_tenant FOR UPDATE;
  IF NOT FOUND OR NOT v_office AND v_e.assigned_employee_id IS DISTINCT FROM v_employee THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Besuch nicht verfügbar.'; END IF;
  IF v_e.version IS DISTINCT FROM p_version THEN RAISE EXCEPTION USING ERRCODE='40001',MESSAGE='Der Besuch wurde zwischenzeitlich geändert.'; END IF;
  IF p_action IN ('plan','cancel') AND NOT v_manage OR p_action IN ('return','approve') AND NOT v_review THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Keine Berechtigung für diesen Vorgang.'; END IF;
  IF p_action IN ('read','start','finish','save','submit','no_show') AND (v_e.assigned_employee_id IS DISTINCT FROM v_employee
   OR NOT care_security.consultation_qualified(p_tenant,v_employee,v_e.service_kind,(coalesce(v_e.actual_start,CASE WHEN p_action='start' THEN now() ELSE v_e.scheduled_start END,now()) AT TIME ZONE 'Europe/Berlin')::date))
  THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Die persönliche Zuweisung oder Qualifikationsfreigabe fehlt.'; END IF;
  CASE p_action
  WHEN 'plan' THEN
   IF v_e.status NOT IN ('draft','scheduled') THEN RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Begonnene Besuche können nicht neu zugewiesen werden.'; END IF;
   v_assigned:=(p_data->>'employee_id')::uuid; v_start:=(p_data->>'scheduled_start')::timestamptz; v_end:=(p_data->>'scheduled_end')::timestamptz;
   IF v_start IS NULL OR v_end IS NULL OR v_end<=v_start OR v_end>v_start+interval '12 hours' THEN RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Einen gültigen Termin mit Beginn und Ende angeben.'; END IF;
   IF NOT care_security.consultation_qualified(p_tenant,v_assigned,v_e.service_kind,(v_start AT TIME ZONE 'Europe/Berlin')::date) THEN RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Für diesen Termin fehlt die Qualifikationsfreigabe der Beratungsperson.'; END IF;
   PERFORM pg_advisory_xact_lock(hashtextextended(p_tenant::text||v_assigned::text,1));
   IF EXISTS(SELECT 1 FROM public.consultation_encounters e WHERE e.tenant_id=p_tenant AND e.assigned_employee_id=v_assigned AND e.id<>v_e.id
    AND e.status NOT IN ('cancelled','no_show') AND e.scheduled_start<v_end AND e.scheduled_end>v_start)
   THEN RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Die Beratungsperson hat bereits einen Beratungs- oder Schulungstermin in diesem Zeitraum.'; END IF;
   v_e.assigned_employee_id:=v_assigned; v_e.scheduled_start:=v_start; v_e.scheduled_end:=v_end; v_e.preparation:=coalesce(p_data->>'preparation',''); v_e.status:='scheduled'; v_e.last_read_at:=NULL;
  WHEN 'read' THEN
   IF v_e.status NOT IN ('scheduled','returned') THEN RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Die Übergabe kann in diesem Status nicht bestätigt werden.'; END IF;
   v_e.last_read_at:=now();
  WHEN 'start' THEN
   IF v_e.status<>'scheduled' THEN RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Nur geplante Besuche können begonnen werden.'; END IF;
   IF v_e.last_read_at IS NULL THEN RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Bitte zuerst die Übergabe lesen und bestätigen.'; END IF;
   v_e.actual_start:=clock_timestamp(); v_e.status:='in_progress';
  WHEN 'finish' THEN
   IF v_e.status<>'in_progress' THEN RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Der Besuch ist nicht in Durchführung.'; END IF;
   v_e.actual_end:=clock_timestamp(); v_e.status:='documentation_pending';
  WHEN 'save' THEN
   IF v_e.status NOT IN ('in_progress','documentation_pending','returned') THEN RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Diese Dokumentation ist nicht zur Bearbeitung offen.'; END IF;
   PERFORM care_security.consultation_answers_shape(p_data->'answers');
   v_e.answers:=p_data->'answers';
  WHEN 'submit' THEN
   IF v_e.status NOT IN ('documentation_pending','returned') OR v_e.actual_start IS NULL OR v_e.actual_end IS NULL THEN RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Besuch beenden und Dokumentation vervollständigen.'; END IF;
   PERFORM care_security.consultation_validate(v_e.service_kind,p_data->'answers');
   IF jsonb_typeof(p_data->'signatures') IS DISTINCT FROM 'array' OR jsonb_array_length(p_data->'signatures')<>2 THEN RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Bestätigung der teilnehmenden Person und der Beratungsperson erfassen.'; END IF;
   FOR v_signature IN SELECT * FROM jsonb_array_elements(p_data->'signatures') LOOP
    IF nullif(btrim(v_signature->>'name'),'') IS NULL OR coalesce(v_signature->>'role','') NOT IN ('client','representative','participant','counselor')
     OR v_signature->>'role'='participant' AND v_e.service_kind<>'45'
     OR coalesce(v_signature->>'image','') !~ '^data:image/png;base64,[A-Za-z0-9+/=]+$' OR length(v_signature->>'image') NOT BETWEEN 200 AND 200000
     OR v_signature->>'role'='representative' AND nullif(btrim(v_signature->>'authority'),'') IS NULL
    THEN RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Unterschriften mit Name, Rolle und gegebenenfalls Vertretungsgrund vervollständigen.'; END IF;
   END LOOP;
   IF (SELECT count(*) FROM jsonb_array_elements(p_data->'signatures') x WHERE x->>'role'='counselor')<>1 THEN RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Eine Bestätigung muss von der Beratungsperson stammen.'; END IF;
   v_e.answers:=p_data->'answers'; v_e.status:='submitted'; v_e.submitted_by:=auth.uid();
   v_snapshot:=jsonb_build_object('answers',v_e.answers,'client',v_e.client_snapshot,'service_kind',v_e.service_kind,'actual_start',v_e.actual_start,'actual_end',v_e.actual_end,
    'assigned_employee_id',v_e.assigned_employee_id,'signatures',p_data->'signatures','confirmed_at',now(),'author_id',auth.uid(),'schemaVersion',1);
   INSERT INTO public.consultation_revisions(tenant_id,encounter_id,version,snapshot,content_hash,created_by)
    VALUES(p_tenant,v_e.id,v_e.version+1,v_snapshot,encode(sha256(convert_to(v_snapshot::text,'UTF8')),'hex'),auth.uid());
  WHEN 'return' THEN
   IF v_e.status<>'submitted' OR nullif(btrim(v_note),'') IS NULL OR coalesce(p_data->>'section','') NOT IN ('preparation','situation','training','measures','confirmation') THEN RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Einen eingereichten Besuch mit Abschnitt und konkreter Rückfrage zurückgeben.'; END IF;
   v_e.status:='returned'; v_e.review_note:=btrim(v_note); v_e.review_section:=p_data->>'section'; v_e.last_read_at:=NULL;
  WHEN 'approve' THEN
   IF v_e.status<>'submitted' THEN RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Nur eingereichte Besuche können fachlich freigegeben werden.'; END IF;
   IF v_e.submitted_by=auth.uid() THEN RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Die fachliche Freigabe muss eine andere berechtigte Person vornehmen.'; END IF;
   v_e.status:='approved'; v_e.review_note:=''; v_e.review_section:=NULL;
  WHEN 'cancel' THEN
   IF v_e.status NOT IN ('draft','scheduled') OR nullif(btrim(v_note),'') IS NULL THEN RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Nur unbegonnene Termine mit Begründung absagen.'; END IF;
   v_e.status:='cancelled';
  WHEN 'no_show' THEN
   IF v_e.status<>'scheduled' OR nullif(btrim(v_note),'') IS NULL THEN RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Bei einem geplanten Besuch den Kontaktversuch dokumentieren.'; END IF;
   v_e.status:='no_show';
  WHEN 'comment' THEN
   IF nullif(btrim(v_note),'') IS NULL OR length(v_note)>5000 THEN RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Eine Nachricht bis 5.000 Zeichen eingeben.'; END IF;
  ELSE RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Unbekannter Vorgang.';
  END CASE;
  UPDATE public.consultation_encounters SET assigned_employee_id=v_e.assigned_employee_id,status=v_e.status,version=version+1,
   scheduled_start=v_e.scheduled_start,scheduled_end=v_e.scheduled_end,actual_start=v_e.actual_start,actual_end=v_e.actual_end,
   preparation=v_e.preparation,answers=v_e.answers,review_note=v_e.review_note,review_section=v_e.review_section,last_read_at=v_e.last_read_at,
   submitted_by=v_e.submitted_by,updated_at=now() WHERE id=v_e.id RETURNING * INTO v_e;
  v_result:=jsonb_build_object('case_id',v_e.case_id,'encounter_id',v_e.id,'version',v_e.version);
 END IF;
 INSERT INTO public.consultation_events(tenant_id,encounter_id,action,note,actor_id,actor_label) VALUES(p_tenant,v_e.id,p_action,v_note,auth.uid(),v_actor);
 INSERT INTO public.consultation_requests(tenant_id,actor_id,request_id,payload_hash,result) VALUES(p_tenant,auth.uid(),p_request,v_hash,v_result);
 RETURN v_result;
END $b$;

-- Keep implementation outside PostgREST's public schema. Explicit invoker entry points.
REVOKE ALL ON FUNCTION care_security.consultation_office(uuid,text),care_security.consultation_employee(uuid),care_security.consultation_qualified(uuid,uuid,text,date),care_security.consultation_client(uuid,uuid),care_security.consultation_validate(text,jsonb),care_security.consultation_answers_shape(jsonb),care_security.consultation_load(uuid,boolean,uuid),care_security.consultation_mutate(uuid,text,uuid,uuid,integer,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION care_security.consultation_load(uuid,boolean,uuid),care_security.consultation_mutate(uuid,text,uuid,uuid,integer,jsonb) TO authenticated;
CREATE FUNCTION public.consultation_workspace_load(p_tenant uuid,p_employee_view boolean DEFAULT false,p_case uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path=pg_catalog AS $b$ SELECT care_security.consultation_load(p_tenant,p_employee_view,p_case) $b$;
CREATE FUNCTION public.consultation_workspace_mutate(p_tenant uuid,p_action text,p_request uuid,p_encounter uuid DEFAULT NULL,p_version integer DEFAULT NULL,p_data jsonb DEFAULT '{}')
RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path=pg_catalog AS $b$ SELECT care_security.consultation_mutate(p_tenant,p_action,p_request,p_encounter,p_version,p_data) $b$;
REVOKE ALL ON FUNCTION public.consultation_workspace_load(uuid,boolean,uuid),public.consultation_workspace_mutate(uuid,text,uuid,uuid,integer,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.consultation_workspace_load(uuid,boolean,uuid),public.consultation_workspace_mutate(uuid,text,uuid,uuid,integer,jsonb) TO authenticated;
COMMIT;
