-- PREPARED CHANGE ONLY. No production apply. Requires company_access and company_scope_access.
-- Apply academy_family_access.sql first (account_kind/access_scope/access_generation trust roots).
-- Canonical courses/lessons/enrollments/certificates are retained; no legacy data is rewritten.
BEGIN;
CREATE SCHEMA IF NOT EXISTS academy_private;
REVOKE ALL ON SCHEMA academy_private FROM PUBLIC,anon,authenticated;
GRANT USAGE ON SCHEMA academy_private TO authenticated,service_role;

CREATE TABLE academy_private.course_workspaces (
  course_id uuid PRIMARY KEY REFERENCES public.courses(id), tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  revision integer NOT NULL CHECK(revision>0), state text NOT NULL CHECK(state IN ('draft','published','archived')),
  content jsonb NOT NULL, published_version_id uuid, version_number integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
-- Editable, tenant-owned source material. Templates are never enrollable courses.
CREATE TABLE academy_private.course_templates (
  id uuid PRIMARY KEY, tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  revision integer NOT NULL CHECK(revision>0), state text NOT NULL CHECK(state IN ('active','archived')),
  name text NOT NULL CHECK(length(btrim(name)) BETWEEN 1 AND 150),
  description text NOT NULL DEFAULT '' CHECK(length(description)<=2000), content jsonb NOT NULL,
  created_by uuid NOT NULL REFERENCES public.profiles(id), updated_by uuid NOT NULL REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX academy_templates_tenant ON academy_private.course_templates(tenant_id,state,updated_at DESC);
CREATE TABLE academy_private.course_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  course_id uuid NOT NULL REFERENCES public.courses(id), number integer NOT NULL CHECK(number>0),
  content jsonb NOT NULL, lesson_map jsonb NOT NULL DEFAULT '{}', published_by uuid NOT NULL REFERENCES public.profiles(id),
  published_at timestamptz NOT NULL DEFAULT now(), UNIQUE(course_id,number), UNIQUE(id,tenant_id,course_id)
);
ALTER TABLE academy_private.course_workspaces ADD CONSTRAINT academy_published_version_fk
  FOREIGN KEY(published_version_id,tenant_id,course_id) REFERENCES academy_private.course_versions(id,tenant_id,course_id);
CREATE TABLE academy_private.enrollment_workspaces (
  enrollment_id uuid PRIMARY KEY REFERENCES public.course_enrollments(id), tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  course_id uuid NOT NULL REFERENCES public.courses(id), version_id uuid NOT NULL,
  target_kind text NOT NULL CHECK(target_kind IN ('employee','client','family')), target_id uuid NOT NULL,
  participant_snapshot jsonb NOT NULL, revision integer NOT NULL DEFAULT 1 CHECK(revision>0),
  state text NOT NULL DEFAULT 'assigned' CHECK(state IN ('assigned','in_progress','submitted','completed','returned','cancelled')),
  due_date date, assigned_at timestamptz NOT NULL DEFAULT now(), assigned_by uuid NOT NULL REFERENCES public.profiles(id),
  renewal_of_id uuid UNIQUE REFERENCES academy_private.enrollment_workspaces(enrollment_id),
  started_at timestamptz, submitted_at timestamptz, completed_at timestamptz, review_note text, certificate_id uuid REFERENCES public.certificates(id),
  FOREIGN KEY(version_id,tenant_id,course_id) REFERENCES academy_private.course_versions(id,tenant_id,course_id)
);
CREATE UNIQUE INDEX academy_enrollments_initial_version ON academy_private.enrollment_workspaces(version_id,target_kind,target_id) WHERE renewal_of_id IS NULL;
CREATE INDEX academy_enrollments_actor ON academy_private.enrollment_workspaces(tenant_id,target_kind,target_id);
CREATE TABLE academy_private.lesson_completions (
  enrollment_id uuid NOT NULL REFERENCES academy_private.enrollment_workspaces(enrollment_id), lesson_id text NOT NULL,
  completed_at timestamptz NOT NULL DEFAULT now(), actor_id uuid NOT NULL, PRIMARY KEY(enrollment_id,lesson_id)
);
CREATE TABLE academy_private.quiz_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), enrollment_id uuid NOT NULL REFERENCES academy_private.enrollment_workspaces(enrollment_id),
  lesson_id text NOT NULL, attempt integer NOT NULL CHECK(attempt>0), answers jsonb NOT NULL,
  score integer NOT NULL CHECK(score BETWEEN 0 AND 100), passed boolean NOT NULL,
  actor_id uuid NOT NULL, submitted_at timestamptz NOT NULL DEFAULT now(), UNIQUE(enrollment_id,lesson_id,attempt)
);
CREATE TABLE academy_private.certificate_snapshots (
  certificate_id uuid PRIMARY KEY REFERENCES public.certificates(id), enrollment_id uuid NOT NULL UNIQUE REFERENCES academy_private.enrollment_workspaces(enrollment_id),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id), snapshot jsonb NOT NULL,
  revoked_at timestamptz, revoked_reason text, revoked_by uuid REFERENCES public.profiles(id)
);
CREATE TABLE academy_private.review_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), enrollment_id uuid NOT NULL REFERENCES academy_private.enrollment_workspaces(enrollment_id),
  actor_id uuid NOT NULL, action text NOT NULL, note text, created_at timestamptz NOT NULL DEFAULT now(),
  previous_due_date date, due_date date
);
CREATE TABLE academy_private.requests (
  tenant_id uuid NOT NULL, actor_id uuid NOT NULL, request_id uuid NOT NULL, digest text NOT NULL,
  action text NOT NULL, record_id uuid NOT NULL, view_name text NOT NULL, result jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(tenant_id,actor_id,request_id)
);
-- Permit reassignment of a newer immutable version, without altering old enrollments.
ALTER TABLE public.course_enrollments DROP CONSTRAINT IF EXISTS course_enrollments_unique_employee_course;
CREATE INDEX IF NOT EXISTS academy_employee_course_lookup ON public.course_enrollments(tenant_id,course_id,employee_id);

CREATE FUNCTION academy_private.immutable_record() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $$
BEGIN
  IF TG_TABLE_NAME='certificate_snapshots' AND TG_OP='UPDATE' THEN
  IF NEW.snapshot=OLD.snapshot
    AND NEW.certificate_id=OLD.certificate_id AND NEW.enrollment_id=OLD.enrollment_id AND NEW.tenant_id=OLD.tenant_id
    AND OLD.revoked_at IS NULL AND NEW.revoked_at IS NOT NULL AND NEW.revoked_by IS NOT NULL AND length(btrim(NEW.revoked_reason))>0 THEN RETURN NEW; END IF;
 END IF;
  RAISE EXCEPTION 'Veröffentlichungen, Versuche und Nachweisstände sind unveränderlich' USING ERRCODE='55000';
END $$;
CREATE TRIGGER academy_version_immutable BEFORE UPDATE OR DELETE ON academy_private.course_versions FOR EACH ROW EXECUTE FUNCTION academy_private.immutable_record();
CREATE TRIGGER academy_certificate_immutable BEFORE UPDATE OR DELETE ON academy_private.certificate_snapshots FOR EACH ROW EXECUTE FUNCTION academy_private.immutable_record();
CREATE TRIGGER academy_attempt_immutable BEFORE UPDATE OR DELETE ON academy_private.quiz_attempts FOR EACH ROW EXECUTE FUNCTION academy_private.immutable_record();
CREATE TRIGGER academy_review_immutable BEFORE UPDATE OR DELETE ON academy_private.review_events FOR EACH ROW EXECUTE FUNCTION academy_private.immutable_record();

CREATE FUNCTION academy_private.office_allowed(p_tenant uuid,p_permission text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT auth.uid() IS NOT NULL AND p_tenant=public.current_tenant_id()
   AND care_security.company_permission(p_tenant,'akademie.courses.view')
   AND care_security.company_permission(p_tenant,p_permission)
   AND care_security.company_unrestricted_scope(p_tenant)
   AND NOT EXISTS(SELECT 1 FROM public.employee_data_scopes s JOIN public.employees e ON e.id=s.employee_id AND e.tenant_id=s.tenant_id
     WHERE s.tenant_id=p_tenant AND e.profile_id=care_security.company_profile(p_tenant)
     AND lower(btrim(s.module)) IN ('akademie','academy','training')
     AND (s.scope_type<>'tenant' OR nullif(btrim(s.scope_value),'') IS NOT NULL AND btrim(s.scope_value)<>p_tenant::text))
$$;
CREATE FUNCTION academy_private.person_visible(p_tenant uuid,p_kind text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT academy_private.office_allowed(p_tenant,'akademie.courses.view') AND
   CASE p_kind WHEN 'employee' THEN care_security.company_permission(p_tenant,'office.employees.view')
     WHEN 'client' THEN care_security.company_permission(p_tenant,'office.clients.view_sensitive')
     WHEN 'family' THEN care_security.company_permission(p_tenant,'office.clients.view_sensitive') ELSE false END
   AND NOT EXISTS(SELECT 1 FROM public.employee_data_scopes s JOIN public.employees e ON e.id=s.employee_id AND e.tenant_id=s.tenant_id
     WHERE s.tenant_id=p_tenant AND e.profile_id=care_security.company_profile(p_tenant)
       AND ((p_kind='employee' AND lower(btrim(s.module)) IN ('employees','employee','office.employees','personal','mitarbeiter'))
         OR (p_kind IN ('client','family') AND lower(btrim(s.module)) IN ('clients','client','office.clients','klienten')))
       AND (s.scope_type<>'tenant' OR nullif(btrim(s.scope_value),'') IS NOT NULL AND btrim(s.scope_value)<>p_tenant::text))
$$;
CREATE FUNCTION academy_private.person(p_tenant uuid,p_kind text,p_id uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE v jsonb; c uuid; ready boolean:=false; label text;
BEGIN
 IF p_kind='employee' THEN
  SELECT to_jsonb(e) INTO v FROM public.employees e WHERE e.id=p_id AND e.tenant_id=p_tenant AND e.deleted_at IS NULL AND e.status::text IN ('active','aktiv');
  SELECT EXISTS(SELECT 1 FROM public.employee_portal_accounts a WHERE a.employee_id=p_id AND a.tenant_id=p_tenant AND a.status='active' AND a.auth_user_id IS NOT NULL) INTO ready;
  label:='Mitarbeitende';
 ELSIF p_kind='client' THEN
  SELECT to_jsonb(x) INTO v FROM public.clients x WHERE x.id=p_id AND x.tenant_id=p_tenant AND x.deleted_at IS NULL AND x.status::text IN ('active','aktiv'); c:=p_id;
  SELECT EXISTS(SELECT 1 FROM public.client_portal_access a WHERE a.client_id=p_id AND a.contact_id IS NULL AND a.account_kind='self' AND a.access_scope='client' AND a.tenant_id=p_tenant AND a.status='aktiv' AND a.portal_enabled AND a.auth_user_id IS NOT NULL)
    OR EXISTS(SELECT 1 FROM public.client_portal_codes a WHERE a.client_id=p_id AND a.tenant_id=p_tenant AND a.status='active' AND a.auth_user_id IS NOT NULL AND (a.expires_at IS NULL OR a.expires_at>now())) INTO ready;
  label:='Klient:in';
 ELSIF p_kind='family' THEN
  SELECT to_jsonb(x),x.client_id INTO v,c FROM public.client_contacts x JOIN public.clients cl ON cl.id=x.client_id AND cl.tenant_id=x.tenant_id
   WHERE x.id=p_id AND x.tenant_id=p_tenant AND cl.deleted_at IS NULL AND cl.status::text IN ('active','aktiv');
  SELECT EXISTS(SELECT 1 FROM public.client_portal_access a JOIN public.client_contacts cc ON cc.id=a.contact_id AND cc.client_id=a.client_id AND cc.tenant_id=a.tenant_id
     WHERE a.contact_id=p_id AND a.account_kind='academy_family' AND a.access_scope='academy' AND a.tenant_id=p_tenant AND a.status='aktiv' AND a.portal_enabled AND a.auth_user_id IS NOT NULL)
   OR EXISTS(SELECT 1 FROM public.relative_portal_codes a JOIN public.portal_sessions s ON s.access_code_id=a.id AND s.tenant_id=a.tenant_id
     WHERE a.relative_contact_id=p_id AND a.client_id=c AND a.tenant_id=p_tenant AND a.status='active' AND a.auth_user_id IS NOT NULL AND (a.expires_at IS NULL OR a.expires_at>now())
       AND s.relative_contact_id=p_id AND s.client_id=c AND s.portal_type::text='relative' AND s.status::text='active' AND s.expires_at>now() AND s.revoked_at IS NULL AND s.logged_out_at IS NULL) INTO ready;
  label:='Angehörige';
 END IF;
 IF v IS NULL THEN RETURN NULL; END IF;
 RETURN jsonb_build_object('id',p_id,'kind',p_kind,'name',coalesce(nullif(v->>'full_name',''),nullif(v->>'display_name',''),nullif(concat_ws(' ',v->>'first_name',v->>'last_name'),''),nullif(v->>'name',''),'Person'),
   'contextLabel',label,'clientId',c,'portalReady',ready);
END $$;
CREATE FUNCTION academy_private.learner(p_tenant uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE a uuid:=public.current_portal_account_id(); k text:=public.current_portal_type(); target uuid; kind text; c uuid; person jsonb;
BEGIN
 IF auth.uid() IS NULL OR NOT coalesce(public.platform_tenant_access_allowed(p_tenant,false),false) OR (k IS DISTINCT FROM 'academy_family' AND p_tenant IS DISTINCT FROM public.current_tenant_id()) THEN RETURN NULL; END IF;
 IF k='employee' THEN
  SELECT x.employee_id INTO target FROM public.employee_portal_accounts x WHERE x.id=a AND x.tenant_id=p_tenant AND x.auth_user_id=auth.uid() AND x.status='active'
   AND NOT EXISTS(SELECT 1 FROM public.employees e JOIN public.profiles p ON p.id=e.profile_id WHERE e.id=x.employee_id AND (p.tenant_id<>p_tenant OR p.status::text<>'active' OR p.is_active IS DISTINCT FROM true)); kind:='employee';
 ELSIF k='academy_family' THEN
  SELECT x.contact_id,x.client_id INTO target,c FROM public.client_portal_access x
   WHERE x.id=a AND x.tenant_id=p_tenant AND x.auth_user_id=auth.uid() AND x.status='aktiv' AND x.portal_enabled
     AND x.account_kind='academy_family' AND x.access_scope='academy' AND x.contact_id IS NOT NULL
     AND auth.jwt()->'app_metadata'->>'academy_access_generation'=x.access_generation::text;
  kind:='family';
  IF NOT EXISTS(SELECT 1 FROM public.client_contacts x WHERE x.id=target AND x.tenant_id=p_tenant AND x.client_id=c) THEN RETURN NULL; END IF;
 ELSIF k='client' THEN
  SELECT x.client_id INTO target FROM public.client_portal_access x WHERE x.id=a AND x.tenant_id=p_tenant AND x.auth_user_id=auth.uid()
    AND x.status='aktiv' AND x.portal_enabled AND x.account_kind='self' AND x.access_scope='client' AND x.contact_id IS NULL;
  IF target IS NULL AND NOT EXISTS(SELECT 1 FROM public.client_portal_access x WHERE x.id=a) THEN
   SELECT x.client_id INTO target FROM public.client_portal_codes x WHERE x.id=a AND x.tenant_id=p_tenant AND x.auth_user_id=auth.uid() AND x.status='active' AND (x.expires_at IS NULL OR x.expires_at>now());
  END IF; kind:='client';
 ELSIF k='relative' THEN
  SELECT x.relative_contact_id,x.client_id INTO target,c FROM public.relative_portal_codes x WHERE x.id=a AND x.tenant_id=p_tenant AND x.auth_user_id=auth.uid() AND x.status='active' AND (x.expires_at IS NULL OR x.expires_at>now())
   AND EXISTS(SELECT 1 FROM public.portal_sessions s WHERE s.tenant_id=p_tenant AND s.access_code_id=x.id AND s.portal_type::text='relative' AND s.status::text='active'
     AND s.client_id=x.client_id AND s.relative_contact_id=x.relative_contact_id AND s.expires_at>now() AND s.revoked_at IS NULL AND s.logged_out_at IS NULL);
  kind:='family';
  IF NOT EXISTS(SELECT 1 FROM public.client_contacts x WHERE x.id=target AND x.client_id=c AND x.tenant_id=p_tenant AND x.portal_enabled) THEN RETURN NULL; END IF;
 ELSIF k IS NULL OR k='business' THEN
  SELECT e.id INTO target FROM public.employees e WHERE e.profile_id=care_security.company_profile(p_tenant) AND e.tenant_id=p_tenant AND e.deleted_at IS NULL AND e.status::text IN ('active','aktiv'); kind:='employee';
 END IF;
 IF target IS NULL THEN RETURN NULL; END IF;
 person:=academy_private.person(p_tenant,kind,target);
 RETURN person;
END $$;
CREATE FUNCTION academy_private.redact(p_content jsonb) RETURNS jsonb LANGUAGE sql IMMUTABLE SET search_path=pg_catalog AS $$
 SELECT jsonb_set(p_content,'{lessons}',coalesce((SELECT jsonb_agg(CASE WHEN l ? 'questions' THEN jsonb_set(l,'{questions}',coalesce((SELECT jsonb_agg(q-'correctOptionId') FROM jsonb_array_elements(l->'questions') q),'[]')) ELSE l END) FROM jsonb_array_elements(p_content->'lessons') l),'[]'))
$$;
CREATE FUNCTION academy_private.validate_content(v jsonb,p_publish boolean) RETURNS void LANGUAGE plpgsql SET search_path=pg_catalog AS $$
DECLARE l jsonb; q jsonb; o jsonb;
BEGIN
 IF jsonb_typeof(v) IS DISTINCT FROM 'object' OR length(v::text)>1000000 OR
    EXISTS(SELECT 1 FROM jsonb_object_keys(v) k WHERE k NOT IN ('title','summary','category','audiences','estimatedMinutes','mandatory','passPercent','maxAttempts','lessons')) OR
    jsonb_typeof(v->'title') IS DISTINCT FROM 'string' OR length(btrim(v->>'title')) NOT BETWEEN 1 AND 250 OR
    jsonb_typeof(v->'summary') IS DISTINCT FROM 'string' OR length(v->>'summary')>10000 OR
    jsonb_typeof(v->'category') IS DISTINCT FROM 'string' OR length(v->>'category')>150 OR
    jsonb_typeof(v->'mandatory') IS DISTINCT FROM 'boolean' OR
    jsonb_typeof(v->'audiences') IS DISTINCT FROM 'array' OR jsonb_array_length(v->'audiences') NOT BETWEEN 1 AND 3 OR
    EXISTS(SELECT 1 FROM jsonb_array_elements_text(v->'audiences') a WHERE a NOT IN ('employee','client','family')) OR
    (SELECT count(DISTINCT a) FROM jsonb_array_elements_text(v->'audiences') a)<>jsonb_array_length(v->'audiences') OR
    jsonb_typeof(v->'estimatedMinutes') IS DISTINCT FROM 'number' OR coalesce(v->>'estimatedMinutes','') !~ '^[0-9]{1,5}$' OR (v->>'estimatedMinutes')::integer NOT BETWEEN 1 AND 10000 OR
    jsonb_typeof(v->'passPercent') IS DISTINCT FROM 'number' OR coalesce(v->>'passPercent','') !~ '^[0-9]{1,3}$' OR (v->>'passPercent')::integer NOT BETWEEN 1 AND 100 OR
    jsonb_typeof(v->'maxAttempts') IS DISTINCT FROM 'number' OR coalesce(v->>'maxAttempts','') !~ '^[0-9]{1,2}$' OR (v->>'maxAttempts')::integer NOT BETWEEN 1 AND 20 OR
    jsonb_typeof(v->'lessons') IS DISTINCT FROM 'array' OR jsonb_array_length(v->'lessons')>100 OR (p_publish AND jsonb_array_length(v->'lessons')=0)
 THEN RAISE EXCEPTION 'Ungültige Kursangaben' USING ERRCODE='22023'; END IF;
 IF (SELECT count(DISTINCT x->>'id') FROM jsonb_array_elements(v->'lessons') x)<>jsonb_array_length(v->'lessons') THEN RAISE EXCEPTION 'Lektionskennungen müssen eindeutig sein' USING ERRCODE='22023'; END IF;
 FOR l IN SELECT value FROM jsonb_array_elements(v->'lessons') LOOP
  IF jsonb_typeof(l) IS DISTINCT FROM 'object' OR EXISTS(SELECT 1 FROM jsonb_object_keys(l) k WHERE k NOT IN ('id','title','kind','body','url','questions')) OR
     jsonb_typeof(l->'id') IS DISTINCT FROM 'string' OR coalesce(l->>'id','') !~ '^[A-Za-z0-9_-]{1,100}$' OR coalesce(l->>'kind','') NOT IN ('text','video','document','quiz') OR
     jsonb_typeof(l->'title') IS DISTINCT FROM 'string' OR length(l->>'title')>250 OR (p_publish AND length(btrim(l->>'title'))=0) OR
     jsonb_typeof(l->'body') IS DISTINCT FROM 'string' OR length(l->>'body')>100000 OR
     (l ? 'url' AND jsonb_typeof(l->'url') IS DISTINCT FROM 'string') OR
     (nullif(l->>'url','') IS NOT NULL AND (length(l->>'url')>2000 OR l->>'url' !~ '^https://[^/@[:space:]]+([/:?#]|$)' OR l->>'url' ~ '^https://[^/]*@')) OR
     (p_publish AND l->>'kind' IN ('video','document') AND nullif(l->>'url','') IS NULL) OR
     (p_publish AND l->>'kind'='text' AND length(btrim(l->>'body'))=0)
  THEN RAISE EXCEPTION 'Ungültige Lektion oder Materialadresse' USING ERRCODE='22023'; END IF;
  IF l->>'kind'='quiz' THEN
   IF NOT (l ? 'questions') AND NOT p_publish THEN CONTINUE; END IF;
   IF jsonb_typeof(l->'questions') IS DISTINCT FROM 'array' OR jsonb_array_length(l->'questions')>50 OR (p_publish AND jsonb_array_length(l->'questions')=0) OR
     (SELECT count(DISTINCT x->>'id') FROM jsonb_array_elements(l->'questions') x)<>jsonb_array_length(l->'questions') THEN RAISE EXCEPTION 'Ungültige Fragen' USING ERRCODE='22023'; END IF;
   FOR q IN SELECT value FROM jsonb_array_elements(l->'questions') LOOP
    IF jsonb_typeof(q) IS DISTINCT FROM 'object' OR EXISTS(SELECT 1 FROM jsonb_object_keys(q) k WHERE k NOT IN ('id','prompt','options','correctOptionId')) OR
      jsonb_typeof(q->'id') IS DISTINCT FROM 'string' OR coalesce(q->>'id','') !~ '^[A-Za-z0-9_-]{1,100}$' OR jsonb_typeof(q->'prompt') IS DISTINCT FROM 'string' OR length(q->>'prompt')>3000 OR
      (p_publish AND length(btrim(q->>'prompt'))=0) OR jsonb_typeof(q->'options') IS DISTINCT FROM 'array' OR jsonb_array_length(q->'options')>8 OR (p_publish AND jsonb_array_length(q->'options')<2) OR
      (SELECT count(DISTINCT x->>'id') FROM jsonb_array_elements(q->'options') x)<>jsonb_array_length(q->'options') OR
      (q ? 'correctOptionId' AND jsonb_typeof(q->'correctOptionId') IS DISTINCT FROM 'string') OR
      ((p_publish OR nullif(q->>'correctOptionId','') IS NOT NULL) AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(q->'options') x WHERE x->>'id'=q->>'correctOptionId')) THEN RAISE EXCEPTION 'Ungültiger Wissenscheck' USING ERRCODE='22023'; END IF;
    FOR o IN SELECT value FROM jsonb_array_elements(q->'options') LOOP
     IF jsonb_typeof(o) IS DISTINCT FROM 'object' OR EXISTS(SELECT 1 FROM jsonb_object_keys(o) k WHERE k NOT IN ('id','text')) OR jsonb_typeof(o->'id') IS DISTINCT FROM 'string' OR coalesce(o->>'id','') !~ '^[A-Za-z0-9_-]{1,100}$' OR jsonb_typeof(o->'text') IS DISTINCT FROM 'string' OR length(o->>'text')>2000 OR (p_publish AND length(btrim(o->>'text'))=0) THEN RAISE EXCEPTION 'Ungültige Antwortoption' USING ERRCODE='22023'; END IF;
    END LOOP;
   END LOOP;
  ELSIF l ? 'questions' AND l->'questions'<>'[]'::jsonb THEN RAISE EXCEPTION 'Fragen benötigen eine Quizlektion' USING ERRCODE='22023'; END IF;
 END LOOP;
END $$;

CREATE FUNCTION academy_private.workspace_load(p_tenant uuid,p_view text) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE me jsonb; office boolean:=p_view='office'; manage boolean:=false; assignable boolean:=false; reviewable boolean:=false; courses jsonb:='[]'; templates jsonb:='[]'; people jsonb:='[]'; enrollments jsonb:='[]'; certs jsonb:='[]'; viewer_name text;
BEGIN
 IF p_view IS NULL OR p_view NOT IN ('office','learner') THEN RAISE EXCEPTION 'Ungültige Ansicht' USING ERRCODE='22023'; END IF;
 IF office THEN
  IF NOT academy_private.office_allowed(p_tenant,'akademie.courses.view') THEN RAISE EXCEPTION 'Akademiezugriff nicht freigegeben' USING ERRCODE='42501'; END IF;
  manage:=academy_private.office_allowed(p_tenant,'akademie.courses.manage'); assignable:=academy_private.office_allowed(p_tenant,'akademie.enrollments.assign'); reviewable:=academy_private.office_allowed(p_tenant,'akademie.enrollments.review');
  SELECT coalesce(nullif(to_jsonb(p)->>'display_name',''),nullif(concat_ws(' ',to_jsonb(p)->>'first_name',to_jsonb(p)->>'last_name'),''),'Verwaltung') INTO viewer_name FROM public.profiles p WHERE p.id=care_security.company_profile(p_tenant);
  SELECT coalesce(jsonb_agg(jsonb_build_object('id',w.course_id,'revision',w.revision,'status',w.state,'publishedVersionId',w.published_version_id,'versionNumber',w.version_number,'content',CASE WHEN manage THEN w.content ELSE academy_private.redact(w.content) END,'updatedAt',w.updated_at) ORDER BY w.updated_at DESC),'[]') INTO courses FROM academy_private.course_workspaces w WHERE w.tenant_id=p_tenant;
  IF manage THEN
   SELECT coalesce(jsonb_agg(jsonb_build_object('id',t.id,'revision',t.revision,'status',t.state,'name',t.name,'description',t.description,'content',t.content,'updatedAt',t.updated_at) ORDER BY t.updated_at DESC,t.id),'[]')
    INTO templates FROM academy_private.course_templates t WHERE t.tenant_id=p_tenant;
  END IF;
  IF assignable THEN
   SELECT coalesce(jsonb_agg(person ORDER BY person->>'name'),'[]') INTO people FROM (
    SELECT academy_private.person(p_tenant,'employee',e.id) person FROM public.employees e WHERE e.tenant_id=p_tenant AND academy_private.person_visible(p_tenant,'employee')
    UNION ALL SELECT academy_private.person(p_tenant,'client',c.id) FROM public.clients c WHERE c.tenant_id=p_tenant AND academy_private.person_visible(p_tenant,'client')
    UNION ALL SELECT academy_private.person(p_tenant,'family',c.id) FROM public.client_contacts c WHERE c.tenant_id=p_tenant AND academy_private.person_visible(p_tenant,'family')
   ) candidates WHERE person IS NOT NULL;
  END IF;
 ELSE
  me:=academy_private.learner(p_tenant); IF me IS NULL THEN RAISE EXCEPTION 'Aktiver persönlicher Lernzugang erforderlich' USING ERRCODE='42501'; END IF; viewer_name:=me->>'name';
 END IF;
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',e.enrollment_id,'courseId',e.course_id,'versionId',e.version_id,'versionNumber',v.number,'revision',e.revision,
   'participant',e.participant_snapshot,'dueDate',e.due_date,'state',e.state,
   'previousEnrollmentId',e.renewal_of_id,'nextEnrollmentId',(SELECT successor.enrollment_id FROM academy_private.enrollment_workspaces successor WHERE successor.renewal_of_id=e.enrollment_id),
   'dateChanges',coalesce((SELECT jsonb_agg(jsonb_build_object('previousDueDate',event.previous_due_date,'dueDate',event.due_date,'note',event.note,'changedAt',event.created_at) ORDER BY event.created_at,event.id) FROM academy_private.review_events event WHERE event.enrollment_id=e.enrollment_id AND event.action='change_due_date'),'[]'),
   'progress',round(100.0*(SELECT count(*) FROM academy_private.lesson_completions x WHERE x.enrollment_id=e.enrollment_id)/greatest(jsonb_array_length(v.content->'lessons'),1)),
   'completedLessonIds',coalesce((SELECT jsonb_agg(x.lesson_id ORDER BY x.completed_at,x.lesson_id) FROM academy_private.lesson_completions x WHERE x.enrollment_id=e.enrollment_id),'[]'),
   'attempts',coalesce((SELECT jsonb_agg(jsonb_build_object('lessonId',a.lesson_id,'attempt',a.attempt,'score',a.score,'passed',a.passed,'submittedAt',a.submitted_at) ORDER BY a.submitted_at,a.attempt) FROM academy_private.quiz_attempts a WHERE a.enrollment_id=e.enrollment_id),'[]'),
   'content',academy_private.redact(v.content),'assignedAt',e.assigned_at,'startedAt',e.started_at,'submittedAt',e.submitted_at,'completedAt',e.completed_at,'reviewNote',e.review_note,'certificateId',e.certificate_id) ORDER BY e.assigned_at DESC),'[]') INTO enrollments
 FROM academy_private.enrollment_workspaces e JOIN academy_private.course_versions v ON v.id=e.version_id
 WHERE e.tenant_id=p_tenant AND ((office AND (assignable OR reviewable) AND academy_private.person_visible(p_tenant,e.target_kind)) OR (NOT office AND e.target_kind=me->>'kind' AND e.target_id=(me->>'id')::uuid));
 SELECT coalesce(jsonb_agg(s.snapshot||jsonb_build_object('revokedAt',s.revoked_at,'revokedReason',s.revoked_reason) ORDER BY s.snapshot->>'issuedAt' DESC),'[]') INTO certs
 FROM academy_private.certificate_snapshots s JOIN academy_private.enrollment_workspaces e ON e.enrollment_id=s.enrollment_id
 WHERE s.tenant_id=p_tenant AND ((office AND (assignable OR reviewable) AND academy_private.person_visible(p_tenant,e.target_kind)) OR (NOT office AND e.target_kind=me->>'kind' AND e.target_id=(me->>'id')::uuid));
 RETURN jsonb_build_object('schemaVersion',1,'viewer',jsonb_build_object('mode',p_view,'name',viewer_name,'audience',CASE WHEN office THEN NULL ELSE me->>'kind' END),
  'capabilities',jsonb_build_object('manageCourses',manage,'assign',assignable,'review',reviewable,'learn',NOT office),'courses',courses,'templates',templates,'participants',people,'enrollments',enrollments,'certificates',certs);
END $$;
-- Audit copies must obey the same person and Academy grants as the canonical workspace.
CREATE FUNCTION academy_private.audit_visible(p_tenant uuid,p_table text,p_record uuid) RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE target_kind text;
BEGIN
 IF p_table NOT IN ('courses','course_lessons','course_enrollments','certificates') OR p_table IS NULL THEN RETURN true; END IF;
 IF p_table IN ('courses','course_lessons') THEN RETURN academy_private.office_allowed(p_tenant,'akademie.courses.manage'); END IF;
 IF p_table='course_enrollments' THEN
  SELECT e.target_kind INTO target_kind FROM academy_private.enrollment_workspaces e WHERE e.enrollment_id=p_record AND e.tenant_id=p_tenant;
 ELSE
  SELECT e.target_kind INTO target_kind FROM academy_private.certificate_snapshots c JOIN academy_private.enrollment_workspaces e ON e.enrollment_id=c.enrollment_id AND e.tenant_id=c.tenant_id WHERE c.certificate_id=p_record AND c.tenant_id=p_tenant;
 END IF;
 RETURN target_kind IS NOT NULL AND academy_private.person_visible(p_tenant,target_kind)
   AND (academy_private.office_allowed(p_tenant,'akademie.enrollments.assign') OR academy_private.office_allowed(p_tenant,'akademie.enrollments.review'));
END $$;
DROP POLICY IF EXISTS academy_audit_visibility ON public.audit_logs;
CREATE POLICY academy_audit_visibility ON public.audit_logs AS RESTRICTIVE FOR SELECT TO authenticated
 USING(academy_private.audit_visible(tenant_id,table_name,record_id));

CREATE FUNCTION academy_private.is_self(p_tenant uuid,p_kind text,p_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT CASE p_kind WHEN 'employee' THEN
  EXISTS(SELECT 1 FROM public.employees e JOIN public.profiles p ON p.id=e.profile_id AND p.tenant_id=e.tenant_id WHERE e.id=p_id AND e.tenant_id=p_tenant AND (p.auth_user_id=auth.uid() OR p.id=auth.uid()))
  OR EXISTS(SELECT 1 FROM public.employee_portal_accounts a WHERE a.employee_id=p_id AND a.tenant_id=p_tenant AND a.auth_user_id=auth.uid())
 WHEN 'client' THEN EXISTS(SELECT 1 FROM public.client_portal_access a WHERE a.client_id=p_id AND a.contact_id IS NULL AND a.account_kind='self' AND a.access_scope='client' AND a.tenant_id=p_tenant AND a.auth_user_id=auth.uid())
  OR EXISTS(SELECT 1 FROM public.client_portal_codes a WHERE a.client_id=p_id AND a.tenant_id=p_tenant AND a.auth_user_id=auth.uid())
 WHEN 'family' THEN EXISTS(SELECT 1 FROM public.client_portal_access a WHERE a.contact_id=p_id AND a.tenant_id=p_tenant AND a.auth_user_id=auth.uid())
  OR EXISTS(SELECT 1 FROM public.relative_portal_codes a WHERE a.relative_contact_id=p_id AND a.tenant_id=p_tenant AND a.auth_user_id=auth.uid()) ELSE false END
$$;
CREATE FUNCTION academy_private.workspace_mutate(p_tenant uuid,p_view text,p_action text,p_request uuid,p_record uuid,p_revision integer,p_data jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
<<academy_command>>
DECLARE me jsonb; actor uuid:=auth.uid(); profile uuid; permission text; fingerprint text; cached academy_private.requests;
 w academy_private.course_workspaces; e academy_private.enrollment_workspaces; v academy_private.course_versions; tpl academy_private.course_templates;
 person jsonb; item jsonb; lesson jsonb; question jsonb; lesson_map jsonb:='{}'; content jsonb;
 record_id uuid:=p_record; version_id uuid; lesson_row_id uuid; certificate_id uuid; created_enrollment_id uuid; n integer:=0; attempt_n integer; score integer; correct integer:=0; passed boolean;
 result jsonb; snapshot jsonb; note text; issuer text; organization text; due date; validity date; next_revision integer; allowed_keys text[];
BEGIN
 IF actor IS NULL OR NOT coalesce(public.platform_tenant_access_allowed(p_tenant,false),false) OR (public.current_portal_type() IS DISTINCT FROM 'academy_family' AND p_tenant IS DISTINCT FROM public.current_tenant_id()) THEN RAISE EXCEPTION 'Kein gültiger Mandantenzugang' USING ERRCODE='42501'; END IF;
 IF p_view IS NULL OR p_view NOT IN ('office','learner') OR p_request IS NULL OR p_record IS NULL OR p_action IS NULL OR jsonb_typeof(p_data) IS DISTINCT FROM 'object' OR length(p_data::text)>1100000 THEN RAISE EXCEPTION 'Ungültiger Akademievorgang' USING ERRCODE='22023'; END IF;
 CASE p_action
  WHEN 'save_template' THEN permission:='akademie.courses.manage'; allowed_keys:=ARRAY['name','description','content'];
  WHEN 'archive_template' THEN permission:='akademie.courses.manage'; allowed_keys:=ARRAY[]::text[];
  WHEN 'restore_template' THEN permission:='akademie.courses.manage'; allowed_keys:=ARRAY[]::text[];
  WHEN 'save_course' THEN permission:='akademie.courses.manage'; allowed_keys:=ARRAY['content'];
  WHEN 'publish_course' THEN permission:='akademie.courses.manage'; allowed_keys:=ARRAY[]::text[];
  WHEN 'archive_course' THEN permission:='akademie.courses.manage'; allowed_keys:=ARRAY[]::text[];
  WHEN 'assign' THEN permission:='akademie.enrollments.assign'; allowed_keys:=ARRAY['targets','dueDate'];
  WHEN 'change_due_date' THEN permission:='akademie.enrollments.assign'; allowed_keys:=ARRAY['dueDate','note'];
  WHEN 'renew_enrollment' THEN permission:='akademie.enrollments.assign'; allowed_keys:=ARRAY['dueDate','note','courseRevision'];
  WHEN 'review_enrollment' THEN permission:='akademie.enrollments.review'; allowed_keys:=ARRAY['decision','note','validUntil'];
  WHEN 'cancel_enrollment' THEN permission:='akademie.enrollments.assign'; allowed_keys:=ARRAY['note'];
  WHEN 'revoke_certificate' THEN permission:='akademie.enrollments.review'; allowed_keys:=ARRAY['note'];
  WHEN 'start_enrollment' THEN allowed_keys:=ARRAY[]::text[];
  WHEN 'complete_lesson' THEN allowed_keys:=ARRAY['lessonId'];
  WHEN 'submit_quiz' THEN allowed_keys:=ARRAY['lessonId','answers'];
  WHEN 'submit_enrollment' THEN allowed_keys:=ARRAY[]::text[];
  ELSE RAISE EXCEPTION 'Unbekannte Akademieaktion' USING ERRCODE='22023';
 END CASE;
 IF EXISTS(SELECT 1 FROM jsonb_object_keys(p_data) k WHERE NOT k=ANY(allowed_keys)) THEN RAISE EXCEPTION 'Unerwartete Vorgangsdaten' USING ERRCODE='22023'; END IF;
 IF permission IS NOT NULL THEN
  IF p_view<>'office' OR NOT academy_private.office_allowed(p_tenant,permission) THEN RAISE EXCEPTION 'Aktion nicht freigegeben' USING ERRCODE='42501'; END IF;
  profile:=care_security.company_profile(p_tenant);
 ELSE
  me:=academy_private.learner(p_tenant);
  IF p_view<>'learner' OR me IS NULL THEN RAISE EXCEPTION 'Persönlicher Lernzugang erforderlich' USING ERRCODE='42501'; END IF;
 END IF;
 -- One transaction serializes replay and CAS for the tenant; no cross-tenant global lock.
 PERFORM pg_advisory_xact_lock(hashtextextended('academy:'||p_tenant::text,0));
 IF p_action IN ('save_template','archive_template','restore_template') THEN
  SELECT * INTO tpl FROM academy_private.course_templates WHERE id=p_record AND tenant_id=p_tenant FOR UPDATE;
  IF tpl.id IS NULL AND (p_action<>'save_template' OR EXISTS(SELECT 1 FROM academy_private.course_templates WHERE id=p_record)) THEN RAISE EXCEPTION 'Vorlage nicht verfügbar' USING ERRCODE='42501'; END IF;
 ELSIF p_action IN ('save_course','publish_course','archive_course','assign') THEN
  SELECT * INTO w FROM academy_private.course_workspaces WHERE course_id=p_record AND tenant_id=p_tenant FOR UPDATE;
  IF w.course_id IS NULL AND (p_action<>'save_course' OR EXISTS(SELECT 1 FROM public.courses WHERE id=p_record)) THEN RAISE EXCEPTION 'Kurs nicht verfügbar' USING ERRCODE='42501'; END IF;
  IF p_action='assign' THEN
   IF jsonb_typeof(p_data->'targets') IS DISTINCT FROM 'array' OR jsonb_array_length(p_data->'targets') NOT BETWEEN 1 AND 200 THEN RAISE EXCEPTION 'Bitte gültige Teilnehmende wählen' USING ERRCODE='22023'; END IF;
   FOR item IN SELECT value FROM jsonb_array_elements(p_data->'targets') LOOP
    IF jsonb_typeof(item) IS DISTINCT FROM 'object' OR (SELECT count(*) FROM jsonb_object_keys(item))<>2 OR item->>'kind' IS NULL OR item->>'id' IS NULL THEN RAISE EXCEPTION 'Ungültige Personenzuordnung' USING ERRCODE='22023'; END IF;
    person:=academy_private.person(p_tenant,item->>'kind',(item->>'id')::uuid);
    IF person IS NULL OR NOT academy_private.person_visible(p_tenant,item->>'kind') THEN RAISE EXCEPTION 'Person nicht aktiv oder nicht freigegeben' USING ERRCODE='42501'; END IF;
   END LOOP;
  END IF;
 ELSE
  IF p_action='revoke_certificate' THEN
   SELECT x.* INTO e FROM academy_private.enrollment_workspaces x JOIN academy_private.certificate_snapshots s ON s.enrollment_id=x.enrollment_id AND s.tenant_id=x.tenant_id WHERE s.certificate_id=p_record AND x.tenant_id=p_tenant FOR UPDATE OF x;
  ELSE SELECT * INTO e FROM academy_private.enrollment_workspaces WHERE enrollment_id=p_record AND tenant_id=p_tenant FOR UPDATE; END IF;
  IF e.enrollment_id IS NULL OR (permission IS NULL AND (e.target_kind IS DISTINCT FROM me->>'kind' OR e.target_id IS DISTINCT FROM (me->>'id')::uuid)) OR
    (permission IS NOT NULL AND NOT academy_private.person_visible(p_tenant,e.target_kind)) THEN RAISE EXCEPTION 'Teilnahme nicht freigegeben' USING ERRCODE='42501'; END IF;
  IF p_action='review_enrollment' AND academy_private.is_self(p_tenant,e.target_kind,e.target_id) THEN RAISE EXCEPTION 'Eigene Teilnahme darf nicht selbst geprüft werden' USING ERRCODE='42501'; END IF;
  IF p_action IN ('change_due_date','renew_enrollment') THEN
   person:=academy_private.person(p_tenant,e.target_kind,e.target_id);
   IF person IS NULL THEN RAISE EXCEPTION 'Teilnehmende Person ist nicht mehr aktiv' USING ERRCODE='42501'; END IF;
   IF p_action='renew_enrollment' AND person->'portalReady' IS DISTINCT FROM 'true'::jsonb THEN RAISE EXCEPTION 'Für die erneute Zuweisung ist ein aktiver persönlicher Lernzugang erforderlich' USING ERRCODE='42501'; END IF;
  END IF;
 END IF;
 fingerprint:=encode(sha256(convert_to(jsonb_build_object('tenant',p_tenant,'view',p_view,'action',p_action,'record',p_record,'revision',p_revision,'data',p_data)::text,'UTF8')),'hex');
 SELECT * INTO cached FROM academy_private.requests WHERE tenant_id=p_tenant AND actor_id=actor AND request_id=p_request;
 IF FOUND THEN
  IF cached.digest<>fingerprint THEN RAISE EXCEPTION 'Vorgangs-ID wurde mit anderen Daten wiederverwendet' USING ERRCODE='22023'; END IF;
  RETURN cached.result||jsonb_build_object('replayed',true);
 END IF;
 IF p_action IN ('save_template','archive_template','restore_template') THEN
  IF (tpl.id IS NULL AND p_revision IS NOT NULL) OR (tpl.id IS NOT NULL AND p_revision IS DISTINCT FROM tpl.revision) THEN RAISE EXCEPTION 'Vorlage wurde zwischenzeitlich geändert. Bitte neu laden.' USING ERRCODE='40001'; END IF;
 ELSIF p_action IN ('save_course','publish_course','archive_course','assign') THEN
  IF (w.course_id IS NULL AND p_revision IS NOT NULL) OR (w.course_id IS NOT NULL AND p_revision IS DISTINCT FROM w.revision) THEN RAISE EXCEPTION 'Kurs wurde zwischenzeitlich geändert. Bitte neu laden.' USING ERRCODE='40001'; END IF;
 ELSE
  IF p_action<>'revoke_certificate' AND p_revision IS DISTINCT FROM e.revision THEN RAISE EXCEPTION 'Teilnahme wurde zwischenzeitlich geändert. Bitte neu laden.' USING ERRCODE='40001'; END IF;
  SELECT * INTO v FROM academy_private.course_versions WHERE id=e.version_id;
 END IF;
 IF p_action IN ('change_due_date','renew_enrollment') THEN
  note:=btrim(p_data->>'note');
  IF jsonb_typeof(p_data->'note') IS DISTINCT FROM 'string' OR note IS NULL OR length(note) NOT BETWEEN 3 AND 4000 THEN RAISE EXCEPTION 'Bitte die Änderung begründen' USING ERRCODE='22023'; END IF;
  IF NOT (p_data ? 'dueDate') OR jsonb_typeof(p_data->'dueDate') NOT IN ('string','null') THEN RAISE EXCEPTION 'Ungültige Frist' USING ERRCODE='22023'; END IF;
  IF p_data->>'dueDate' IS NOT NULL THEN
   IF p_data->>'dueDate' !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN RAISE EXCEPTION 'Ungültige Frist' USING ERRCODE='22023'; END IF;
   BEGIN due:=(p_data->>'dueDate')::date;
   EXCEPTION WHEN datetime_field_overflow OR invalid_datetime_format THEN RAISE EXCEPTION 'Ungültige Frist' USING ERRCODE='22023'; END;
  END IF;
 END IF;
 IF p_action='save_template' THEN
  IF jsonb_typeof(p_data->'name') IS DISTINCT FROM 'string' OR length(btrim(p_data->>'name')) NOT BETWEEN 1 AND 150
    OR jsonb_typeof(p_data->'description') IS DISTINCT FROM 'string' OR length(p_data->>'description')>2000 THEN RAISE EXCEPTION 'Bitte Vorlagenname und Beschreibung prüfen' USING ERRCODE='22023'; END IF;
  content:=p_data->'content'; PERFORM academy_private.validate_content(content,false);
  IF tpl.state='archived' THEN RAISE EXCEPTION 'Stellen Sie die archivierte Vorlage vor dem Bearbeiten wieder her' USING ERRCODE='55000'; END IF;
  next_revision:=coalesce(tpl.revision,0)+1;
  IF tpl.id IS NULL THEN
   INSERT INTO academy_private.course_templates(id,tenant_id,revision,state,name,description,content,created_by,updated_by)
    VALUES(p_record,p_tenant,next_revision,'active',btrim(p_data->>'name'),btrim(p_data->>'description'),content,profile,profile);
  ELSE
   UPDATE academy_private.course_templates SET revision=next_revision,name=btrim(p_data->>'name'),description=btrim(p_data->>'description'),content=academy_command.content,updated_by=profile,updated_at=now() WHERE id=p_record;
  END IF;
 ELSIF p_action IN ('archive_template','restore_template') THEN
  IF (p_action='archive_template' AND tpl.state='archived') OR (p_action='restore_template' AND tpl.state='active') THEN RAISE EXCEPTION 'Die Vorlage hat diesen Status bereits' USING ERRCODE='55000'; END IF;
  next_revision:=tpl.revision+1;
  UPDATE academy_private.course_templates SET revision=next_revision,state=CASE WHEN p_action='archive_template' THEN 'archived' ELSE 'active' END,updated_by=profile,updated_at=now() WHERE id=p_record;
 ELSIF p_action='save_course' THEN
  content:=p_data->'content'; PERFORM academy_private.validate_content(content,false); next_revision:=coalesce(w.revision,0)+1;
  IF w.course_id IS NULL THEN
   INSERT INTO public.courses(id,tenant_id,title,description,status,product_key,is_mandatory,estimated_minutes,created_by) VALUES(p_record,p_tenant,content->>'title',content->>'summary','draft','akademie',(content->>'mandatory')::boolean,(content->>'estimatedMinutes')::integer,profile);
   INSERT INTO academy_private.course_workspaces(course_id,tenant_id,revision,state,content) VALUES(p_record,p_tenant,next_revision,'draft',content);
  ELSE
   IF w.state='archived' THEN RAISE EXCEPTION 'Archivierte Kurse können nicht bearbeitet werden' USING ERRCODE='55000'; END IF;
   UPDATE academy_private.course_workspaces SET content=academy_command.content,revision=next_revision,state='draft',updated_at=now() WHERE course_id=p_record;
   -- A published canonical course continues to describe its published version until republished.
   IF w.published_version_id IS NULL THEN UPDATE public.courses SET title=content->>'title',description=content->>'summary',is_mandatory=(content->>'mandatory')::boolean,estimated_minutes=(content->>'estimatedMinutes')::integer,updated_at=now() WHERE id=p_record; END IF;
  END IF;
 ELSIF p_action='publish_course' THEN
  IF w.state<>'draft' THEN RAISE EXCEPTION 'Nur Entwürfe können veröffentlicht werden' USING ERRCODE='55000'; END IF;
  PERFORM academy_private.validate_content(w.content,true); version_id:=gen_random_uuid();
  FOR lesson IN SELECT value FROM jsonb_array_elements(w.content->'lessons') LOOP
   lesson_row_id:=gen_random_uuid(); n:=n+1; lesson_map:=lesson_map||jsonb_build_object(lesson->>'id',lesson_row_id);
   INSERT INTO public.course_lessons(id,tenant_id,course_id,title,description,status,content_text,video_url,sort_order,is_preview)
    VALUES(lesson_row_id,p_tenant,p_record,lesson->>'title','Fassung '||(w.version_number+1),'published',lesson->>'body',CASE WHEN lesson->>'kind'='video' THEN lesson->>'url' ELSE NULL END,n,false);
  END LOOP;
  INSERT INTO academy_private.course_versions(id,tenant_id,course_id,number,content,lesson_map,published_by) VALUES(version_id,p_tenant,p_record,w.version_number+1,w.content,lesson_map,profile);
  next_revision:=w.revision+1;
  UPDATE academy_private.course_workspaces SET revision=next_revision,state='published',published_version_id=version_id,version_number=w.version_number+1,updated_at=now() WHERE course_id=p_record;
  UPDATE public.courses SET title=w.content->>'title',description=w.content->>'summary',status='published',is_mandatory=(w.content->>'mandatory')::boolean,estimated_minutes=(w.content->>'estimatedMinutes')::integer,passing_required=EXISTS(SELECT 1 FROM jsonb_array_elements(w.content->'lessons') l WHERE l->>'kind'='quiz'),published_at=now(),updated_at=now() WHERE id=p_record;
 ELSIF p_action='archive_course' THEN
  IF w.state='archived' THEN RAISE EXCEPTION 'Kurs bereits archiviert' USING ERRCODE='55000'; END IF;
  next_revision:=w.revision+1; UPDATE academy_private.course_workspaces SET revision=next_revision,state='archived',updated_at=now() WHERE course_id=p_record;
  UPDATE public.courses SET status='archived',updated_at=now() WHERE id=p_record;
 ELSIF p_action='assign' THEN
  IF w.state<>'published' OR w.published_version_id IS NULL THEN RAISE EXCEPTION 'Nur veröffentlichte, nicht archivierte Kurse können zugewiesen werden' USING ERRCODE='55000'; END IF;
  SELECT * INTO v FROM academy_private.course_versions WHERE id=w.published_version_id;
  IF p_data->>'dueDate' IS NOT NULL THEN
   IF p_data->>'dueDate' !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN RAISE EXCEPTION 'Ungültige Frist' USING ERRCODE='22023'; END IF; due:=(p_data->>'dueDate')::date;
  END IF;
  FOR item IN SELECT DISTINCT value FROM jsonb_array_elements(p_data->'targets') LOOP
   IF NOT (v.content->'audiences' ? (item->>'kind')) THEN RAISE EXCEPTION 'Zielgruppe gehört nicht zur veröffentlichten Fassung' USING ERRCODE='22023'; END IF;
   IF EXISTS(SELECT 1 FROM academy_private.enrollment_workspaces x WHERE x.version_id=v.id AND x.target_kind=item->>'kind' AND x.target_id=(item->>'id')::uuid) THEN CONTINUE; END IF;
   person:=academy_private.person(p_tenant,item->>'kind',(item->>'id')::uuid); record_id:=gen_random_uuid();
   INSERT INTO public.course_enrollments(id,tenant_id,course_id,employee_id,status,due_at) VALUES(record_id,p_tenant,p_record,CASE WHEN item->>'kind'='employee' THEN (item->>'id')::uuid END,'invited',due::timestamptz);
   INSERT INTO academy_private.enrollment_workspaces(enrollment_id,tenant_id,course_id,version_id,target_kind,target_id,participant_snapshot,due_date,assigned_by) VALUES(record_id,p_tenant,p_record,v.id,item->>'kind',(item->>'id')::uuid,person,due,profile); n:=n+1;
  END LOOP;
  record_id:=p_record; next_revision:=w.revision+1;
  UPDATE academy_private.course_workspaces SET revision=next_revision,updated_at=now() WHERE course_id=p_record;
  result:=jsonb_build_object('createdCount',n);
 ELSIF p_action='change_due_date' THEN
  IF e.state NOT IN ('assigned','in_progress','returned') THEN RAISE EXCEPTION 'Die Frist kann nur bei offenen Teilnahmen geändert werden' USING ERRCODE='55000'; END IF;
  IF due IS NOT DISTINCT FROM e.due_date THEN RAISE EXCEPTION 'Die neue Frist entspricht bereits der gespeicherten Frist' USING ERRCODE='22023'; END IF;
  next_revision:=e.revision+1;
  UPDATE academy_private.enrollment_workspaces SET due_date=due,revision=next_revision WHERE enrollment_id=e.enrollment_id;
  UPDATE public.course_enrollments SET due_at=due::timestamptz,updated_at=now() WHERE id=e.enrollment_id;
  INSERT INTO academy_private.review_events(enrollment_id,actor_id,action,note,previous_due_date,due_date) VALUES(e.enrollment_id,actor,'change_due_date',note,e.due_date,due);
 ELSIF p_action='renew_enrollment' THEN
  IF e.state<>'completed' AND NOT(e.state='cancelled' AND e.renewal_of_id IS NOT NULL) THEN RAISE EXCEPTION 'Nur abgeschlossene Schulungen oder beendete Folgeteilnahmen können erneut zugewiesen werden' USING ERRCODE='55000'; END IF;
  IF jsonb_typeof(p_data->'courseRevision') IS DISTINCT FROM 'number' OR coalesce(p_data->>'courseRevision','') !~ '^[0-9]{1,10}$' OR (p_data->>'courseRevision')::numeric NOT BETWEEN 1 AND 2147483647 THEN RAISE EXCEPTION 'Ungültiger Kursstand' USING ERRCODE='22023'; END IF;
  SELECT * INTO w FROM academy_private.course_workspaces WHERE course_id=e.course_id AND tenant_id=p_tenant FOR UPDATE;
  IF w.course_id IS NULL OR w.state<>'published' OR w.published_version_id IS NULL THEN RAISE EXCEPTION 'Nur veröffentlichte, nicht archivierte Kurse können erneut zugewiesen werden' USING ERRCODE='55000'; END IF;
  IF w.revision IS DISTINCT FROM (p_data->>'courseRevision')::integer THEN RAISE EXCEPTION 'Kurs wurde zwischenzeitlich geändert. Bitte neu laden.' USING ERRCODE='40001'; END IF;
  SELECT * INTO v FROM academy_private.course_versions WHERE id=w.published_version_id;
  IF NOT(v.content->'audiences' ? e.target_kind) THEN RAISE EXCEPTION 'Zielgruppe gehört nicht zur aktuellen veröffentlichten Fassung' USING ERRCODE='22023'; END IF;
  IF EXISTS(SELECT 1 FROM academy_private.enrollment_workspaces x WHERE x.renewal_of_id=e.enrollment_id) THEN RAISE EXCEPTION 'Für diese Teilnahme besteht bereits eine Folgeteilnahme' USING ERRCODE='55000'; END IF;
  IF EXISTS(SELECT 1 FROM academy_private.enrollment_workspaces x WHERE x.tenant_id=p_tenant AND x.course_id=e.course_id AND x.target_kind=e.target_kind AND x.target_id=e.target_id AND x.state IN ('assigned','in_progress','returned','submitted')) THEN RAISE EXCEPTION 'Für diese Person ist bereits eine Teilnahme dieses Kurses offen' USING ERRCODE='55000'; END IF;
  IF EXISTS(SELECT 1 FROM academy_private.enrollment_workspaces x WHERE x.tenant_id=p_tenant AND x.course_id=e.course_id AND x.target_kind=e.target_kind AND x.target_id=e.target_id AND x.state='completed' AND x.enrollment_id<>e.enrollment_id AND (x.completed_at,x.assigned_at,x.enrollment_id)>(coalesce(e.completed_at,e.assigned_at),e.assigned_at,e.enrollment_id)) THEN RAISE EXCEPTION 'Bitte den jüngsten abgeschlossenen Schulungsstand verwenden' USING ERRCODE='55000'; END IF;
  created_enrollment_id:=gen_random_uuid(); next_revision:=e.revision+1;
  INSERT INTO public.course_enrollments(id,tenant_id,course_id,employee_id,status,due_at) VALUES(created_enrollment_id,p_tenant,e.course_id,CASE WHEN e.target_kind='employee' THEN e.target_id END,'invited',due::timestamptz);
  INSERT INTO academy_private.enrollment_workspaces(enrollment_id,tenant_id,course_id,version_id,target_kind,target_id,participant_snapshot,due_date,assigned_by,renewal_of_id) VALUES(created_enrollment_id,p_tenant,e.course_id,v.id,e.target_kind,e.target_id,person,due,profile,e.enrollment_id);
  UPDATE academy_private.enrollment_workspaces SET revision=next_revision WHERE enrollment_id=e.enrollment_id;
  INSERT INTO academy_private.review_events(enrollment_id,actor_id,action,note) VALUES(e.enrollment_id,actor,'renew_enrollment',note);
  result:=jsonb_build_object('createdEnrollmentId',created_enrollment_id,'createdCount',1);
 ELSIF p_action='revoke_certificate' THEN
  note:=btrim(p_data->>'note'); IF note IS NULL OR length(note) NOT BETWEEN 3 AND 4000 THEN RAISE EXCEPTION 'Bitte Widerruf begründen' USING ERRCODE='22023'; END IF;
  IF EXISTS(SELECT 1 FROM academy_private.certificate_snapshots s WHERE s.certificate_id=p_record AND s.revoked_at IS NOT NULL) THEN RAISE EXCEPTION 'Nachweis bereits widerrufen' USING ERRCODE='55000'; END IF;
  UPDATE academy_private.certificate_snapshots SET revoked_at=now(),revoked_reason=note,revoked_by=profile WHERE academy_private.certificate_snapshots.certificate_id=p_record;
  UPDATE public.certificates SET status='revoked',revoked_at=now(),revoked_reason=note,updated_at=now() WHERE id=p_record;
  INSERT INTO academy_private.review_events(enrollment_id,actor_id,action,note) VALUES(e.enrollment_id,actor,'revoke_certificate',note);
  next_revision:=e.revision;
 ELSE
  next_revision:=e.revision+1;
  IF p_action IN ('start_enrollment','complete_lesson','submit_quiz','submit_enrollment') THEN
   IF e.state NOT IN ('assigned','in_progress','returned') THEN RAISE EXCEPTION 'Teilnahme ist für die Bearbeitung gesperrt' USING ERRCODE='55000'; END IF;
   IF p_action='start_enrollment' AND e.state='in_progress' THEN RAISE EXCEPTION 'Teilnahme wurde bereits gestartet' USING ERRCODE='55000'; END IF;
   IF p_action IN ('complete_lesson','submit_quiz') THEN
    SELECT l INTO lesson FROM jsonb_array_elements(v.content->'lessons') l WHERE l->>'id'=p_data->>'lessonId';
    IF lesson IS NULL THEN RAISE EXCEPTION 'Lektion gehört nicht zur zugewiesenen Fassung' USING ERRCODE='22023'; END IF;
    IF EXISTS(SELECT 1 FROM academy_private.lesson_completions c WHERE c.enrollment_id=e.enrollment_id AND c.lesson_id=lesson->>'id') THEN RAISE EXCEPTION 'Lektion bereits bearbeitet' USING ERRCODE='55000'; END IF;
    IF p_action='complete_lesson' THEN
     IF lesson->>'kind'='quiz' THEN RAISE EXCEPTION 'Wissenscheck muss eingereicht werden' USING ERRCODE='22023'; END IF;
     INSERT INTO academy_private.lesson_completions(enrollment_id,lesson_id,actor_id) VALUES(e.enrollment_id,lesson->>'id',actor);
    ELSE
     IF lesson->>'kind'<>'quiz' OR jsonb_typeof(p_data->'answers') IS DISTINCT FROM 'object' OR EXISTS(SELECT 1 FROM jsonb_each(p_data->'answers') a WHERE jsonb_typeof(a.value) IS DISTINCT FROM 'string') OR (SELECT count(*) FROM jsonb_object_keys(p_data->'answers'))<>jsonb_array_length(lesson->'questions') THEN RAISE EXCEPTION 'Alle Fragen müssen beantwortet werden' USING ERRCODE='22023'; END IF;
     SELECT count(*)+1 INTO attempt_n FROM academy_private.quiz_attempts a WHERE a.enrollment_id=e.enrollment_id AND a.lesson_id=lesson->>'id';
     IF attempt_n>(v.content->>'maxAttempts')::integer THEN RAISE EXCEPTION 'Maximale Versuchsanzahl erreicht' USING ERRCODE='55000'; END IF;
     FOR question IN SELECT value FROM jsonb_array_elements(lesson->'questions') LOOP
      IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(question->'options') o WHERE o->>'id'=p_data->'answers'->>(question->>'id')) THEN RAISE EXCEPTION 'Ungültige oder fehlende Antwortoption' USING ERRCODE='22023'; END IF;
      IF question->>'correctOptionId'=p_data->'answers'->>(question->>'id') THEN correct:=correct+1; END IF;
     END LOOP;
     score:=floor(100.0*correct/jsonb_array_length(lesson->'questions')); passed:=score>=(v.content->>'passPercent')::integer;
     INSERT INTO academy_private.quiz_attempts(enrollment_id,lesson_id,attempt,answers,score,passed,actor_id) VALUES(e.enrollment_id,lesson->>'id',attempt_n,p_data->'answers',score,passed,actor);
     IF passed THEN INSERT INTO academy_private.lesson_completions(enrollment_id,lesson_id,actor_id) VALUES(e.enrollment_id,lesson->>'id',actor); END IF;
     result:=jsonb_build_object('score',score,'passed',passed);
    END IF;
   END IF;
   IF p_action='submit_enrollment' AND EXISTS(SELECT 1 FROM jsonb_array_elements(v.content->'lessons') l WHERE NOT EXISTS(SELECT 1 FROM academy_private.lesson_completions c WHERE c.enrollment_id=e.enrollment_id AND c.lesson_id=l->>'id')) THEN RAISE EXCEPTION 'Zuerst alle Lektionen und Wissenschecks abschließen' USING ERRCODE='55000'; END IF;
   UPDATE academy_private.enrollment_workspaces SET state=CASE WHEN p_action='submit_enrollment' THEN 'submitted' ELSE 'in_progress' END,revision=next_revision,started_at=coalesce(started_at,now()),submitted_at=CASE WHEN p_action='submit_enrollment' THEN now() ELSE submitted_at END WHERE enrollment_id=e.enrollment_id;
   UPDATE public.course_enrollments SET status='active',started_at=coalesce(started_at,now()),progress_percent=round(100.0*(SELECT count(*) FROM academy_private.lesson_completions c WHERE c.enrollment_id=e.enrollment_id)/jsonb_array_length(v.content->'lessons')),last_activity_at=now(),updated_at=now() WHERE id=e.enrollment_id;
  ELSIF p_action='review_enrollment' THEN
   IF e.state<>'submitted' THEN RAISE EXCEPTION 'Nur eingereichte Teilnahmen können geprüft werden' USING ERRCODE='55000'; END IF;
   note:=btrim(coalesce(p_data->>'note',''));
   IF coalesce(p_data->>'decision','') NOT IN ('approve','return') OR length(note)>4000 OR (p_data->>'decision'='return' AND length(note)<3) THEN RAISE EXCEPTION 'Ungültige Prüfentscheidung oder Rückmeldung' USING ERRCODE='22023'; END IF;
   IF p_data->>'decision'='approve' THEN
    person:=academy_private.person(p_tenant,e.target_kind,e.target_id); IF person IS NULL THEN RAISE EXCEPTION 'Teilnehmende Person ist nicht mehr aktiv' USING ERRCODE='42501'; END IF;
    IF EXISTS(SELECT 1 FROM jsonb_array_elements(v.content->'lessons') l WHERE NOT EXISTS(SELECT 1 FROM academy_private.lesson_completions c WHERE c.enrollment_id=e.enrollment_id AND c.lesson_id=l->>'id')) THEN RAISE EXCEPTION 'Unvollständige Teilnahme' USING ERRCODE='55000'; END IF;
    IF p_data->>'validUntil' IS NOT NULL THEN
     IF p_data->>'validUntil' !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN RAISE EXCEPTION 'Ungültiges Gültigkeitsdatum' USING ERRCODE='22023'; END IF; validity:=(p_data->>'validUntil')::date;
     IF validity<current_date THEN RAISE EXCEPTION 'Gültigkeitsende liegt in der Vergangenheit' USING ERRCODE='22023'; END IF;
    END IF;
    certificate_id:=gen_random_uuid();
    SELECT coalesce(nullif(to_jsonb(p)->>'display_name',''),nullif(concat_ws(' ',to_jsonb(p)->>'first_name',to_jsonb(p)->>'last_name'),''),'Verwaltung') INTO issuer FROM public.profiles p WHERE p.id=profile;
    SELECT coalesce(nullif(to_jsonb(t)->>'name',''),nullif(to_jsonb(t)->>'display_name',''),'CareSuite+ Akademie') INTO organization FROM public.tenants t WHERE t.id=p_tenant;
    snapshot:=jsonb_build_object('id',certificate_id,'enrollmentId',e.enrollment_id,'number','AK-'||to_char(current_date,'YYYYMMDD')||'-'||upper(replace(certificate_id::text,'-','')),
     'courseTitle',v.content->>'title','participantName',person->>'name','audience',e.target_kind,'issuedAt',now(),'validUntil',validity,'issuerName',issuer,'organizationName',organization,'versionNumber',v.number,'estimatedMinutes',(v.content->>'estimatedMinutes')::integer);
    INSERT INTO public.certificates(id,tenant_id,course_id,employee_id,certificate_number,title,status,issued_at,valid_until,created_by) VALUES(certificate_id,p_tenant,e.course_id,CASE WHEN e.target_kind='employee' THEN e.target_id END,snapshot->>'number',v.content->>'title','issued',current_date,validity,profile);
    INSERT INTO academy_private.certificate_snapshots(certificate_id,enrollment_id,tenant_id,snapshot) VALUES(certificate_id,e.enrollment_id,p_tenant,snapshot);
    UPDATE academy_private.enrollment_workspaces SET state='completed',revision=next_revision,completed_at=now(),review_note=nullif(note,''),certificate_id=academy_command.certificate_id WHERE enrollment_id=e.enrollment_id;
    UPDATE public.course_enrollments SET status='completed',completed_at=now(),progress_percent=100,last_activity_at=now(),updated_at=now() WHERE id=e.enrollment_id;
    result:=jsonb_build_object('certificateId',certificate_id);
   ELSE
    UPDATE academy_private.enrollment_workspaces SET state='returned',revision=next_revision,review_note=note WHERE enrollment_id=e.enrollment_id;
   END IF;
   INSERT INTO academy_private.review_events(enrollment_id,actor_id,action,note) VALUES(e.enrollment_id,actor,p_data->>'decision',nullif(note,''));
  ELSIF p_action='cancel_enrollment' THEN
   IF e.state IN ('completed','cancelled') THEN RAISE EXCEPTION 'Abgeschlossene oder beendete Teilnahme kann nicht beendet werden' USING ERRCODE='55000'; END IF;
   note:=btrim(p_data->>'note'); IF note IS NULL OR length(note) NOT BETWEEN 3 AND 4000 THEN RAISE EXCEPTION 'Bitte Beendigung begründen' USING ERRCODE='22023'; END IF;
   UPDATE academy_private.enrollment_workspaces SET state='cancelled',revision=next_revision,review_note=note WHERE enrollment_id=e.enrollment_id;
   UPDATE public.course_enrollments SET status='cancelled',updated_at=now() WHERE id=e.enrollment_id;
   INSERT INTO academy_private.review_events(enrollment_id,actor_id,action,note) VALUES(e.enrollment_id,actor,'cancel_enrollment',note);
  END IF;
 END IF;
 result:=coalesce(result,'{}')||jsonb_build_object('recordId',record_id,'revision',next_revision);
 INSERT INTO academy_private.requests(tenant_id,actor_id,request_id,digest,action,record_id,view_name,result) VALUES(p_tenant,actor,p_request,fingerprint,p_action,p_record,p_view,result);
 RETURN result;
END $$;

CREATE OR REPLACE FUNCTION public.academy_workspace_load(p_tenant uuid,p_view text) RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path=pg_catalog AS $$ SELECT academy_private.workspace_load(p_tenant,p_view) $$;
CREATE OR REPLACE FUNCTION public.academy_workspace_mutate(p_tenant uuid,p_view text,p_action text,p_request uuid,p_record uuid,p_revision integer,p_data jsonb) RETURNS jsonb
LANGUAGE sql SECURITY INVOKER SET search_path=pg_catalog AS $$ SELECT academy_private.workspace_mutate(p_tenant,p_view,p_action,p_request,p_record,p_revision,p_data) $$;

-- Extend only established standard admin roles already carrying Academy view.
-- Tenant replacement permission sets and employee deny overrides remain authoritative.
INSERT INTO public.role_permissions(role_id,permission_key)
SELECT r.id,k FROM public.roles r CROSS JOIN unnest(ARRAY['akademie.courses.manage','akademie.enrollments.assign','akademie.enrollments.review']) k
WHERE r.key IN ('business_admin','akademie_admin')
 AND EXISTS(SELECT 1 FROM public.role_permissions p WHERE p.role_id=r.id AND p.permission_key='akademie.courses.view')
 AND NOT EXISTS(SELECT 1 FROM public.role_permissions p WHERE p.role_id=r.id AND p.permission_key=k);

-- Private data has no direct client path, even if the schema is accidentally exposed in PostgREST.
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['course_workspaces','course_templates','course_versions','enrollment_workspaces','lesson_completions','quiz_attempts','certificate_snapshots','review_events','requests'] LOOP
  EXECUTE format('ALTER TABLE academy_private.%I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('REVOKE ALL ON academy_private.%I FROM PUBLIC,anon,authenticated',t);
 END LOOP;
END $$;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA academy_private FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION academy_private.workspace_load(uuid,text),academy_private.workspace_mutate(uuid,text,text,uuid,uuid,integer,jsonb),academy_private.audit_visible(uuid,text,uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.academy_workspace_load(uuid,text),public.academy_workspace_mutate(uuid,text,text,uuid,uuid,integer,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.academy_workspace_load(uuid,text),public.academy_workspace_mutate(uuid,text,text,uuid,uuid,integer,jsonb) TO authenticated;
-- Legacy tenant-wide SELECT and direct edits would bypass learner privacy and trusted completion.
REVOKE ALL ON public.courses,public.course_lessons,public.course_enrollments,public.certificates FROM PUBLIC,anon,authenticated;
DO $$ DECLARE v text; BEGIN
 -- Existing views are security_invoker already; revoke obsolete Academy entry points explicitly too.
 FOREACH v IN ARRAY ARRAY['v_course_overview','v_course_lesson_overview','v_course_enrollment_overview','v_certificate_overview'] LOOP
  IF to_regclass('public.'||v) IS NOT NULL THEN EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC,anon,authenticated',v); END IF;
 END LOOP;
END $$;
DO $$ BEGIN
 IF to_regprocedure('public.update_course_progress(uuid,numeric)') IS NOT NULL THEN
  REVOKE EXECUTE ON FUNCTION public.update_course_progress(uuid,numeric) FROM PUBLIC,anon,authenticated;
  GRANT EXECUTE ON FUNCTION public.update_course_progress(uuid,numeric) TO service_role;
 END IF;
END $$;
COMMIT;
