-- Prepared change; register with Supabase apply_migration at the approved rollout.
-- Keep this outside migrations until the server supplies the migration version.
BEGIN;
CREATE TABLE public.consultation_team_templates (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES public.tenants(id),
 version integer NOT NULL DEFAULT 1 CHECK(version > 0), draft jsonb NOT NULL,
 published jsonb, published_version integer, archived boolean NOT NULL DEFAULT false,
 updated_at timestamptz NOT NULL DEFAULT now(), updated_by uuid NOT NULL,
 UNIQUE(tenant_id,id), CHECK((published IS NULL) = (published_version IS NULL))
);
CREATE INDEX consultation_team_templates_tenant ON public.consultation_team_templates(tenant_id,archived);
CREATE TABLE public.consultation_template_versions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, template_id uuid NOT NULL,
 version integer NOT NULL, action text NOT NULL CHECK(action IN ('template_save','template_publish','template_archive')),
 content jsonb NOT NULL, note text NOT NULL, actor_label text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(tenant_id,template_id) REFERENCES public.consultation_team_templates(tenant_id,id), UNIQUE(template_id,version)
);
CREATE TABLE public.consultation_followups (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, encounter_id uuid NOT NULL,
 source_key text NOT NULL, source_revision_id uuid REFERENCES public.consultation_revisions(id),
 title text NOT NULL CHECK(length(btrim(title)) BETWEEN 1 AND 10000), owner_label text NOT NULL DEFAULT '', description text NOT NULL DEFAULT '',
 due_date date NOT NULL, status text NOT NULL DEFAULT 'open' CHECK(status IN ('open','done','cancelled')),
 outcome text NOT NULL DEFAULT '', version integer NOT NULL DEFAULT 1 CHECK(version > 0),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 completed_at timestamptz, updated_by uuid NOT NULL,
 FOREIGN KEY(tenant_id,encounter_id) REFERENCES public.consultation_encounters(tenant_id,id),
 UNIQUE(encounter_id,source_key), CHECK(length(owner_label)<=10000), CHECK(length(description)<=10000), CHECK(length(outcome)<=5000)
);
CREATE INDEX consultation_followups_inbox ON public.consultation_followups(tenant_id,status,due_date);
DO $b$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['consultation_team_templates','consultation_template_versions','consultation_followups'] LOOP
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC,anon,authenticated',t);
 END LOOP;
END $b$;

-- No outcomes, consent, signatures or client data can be applied via a template.
CREATE FUNCTION care_security.consultation_template_validate(p_content jsonb)
RETURNS void LANGUAGE plpgsql IMMUTABLE SET search_path=pg_catalog AS $b$
DECLARE v_key text; v_prompt jsonb;
BEGIN
 IF jsonb_typeof(p_content) IS DISTINCT FROM 'object' OR octet_length(p_content::text)>30000 THEN
  RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Ungültige Vorlage.'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_object_keys(p_content) k WHERE k NOT IN ('kind','title','category','description','preparation','prompts','goal')) THEN
  RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Die Vorlage enthält nicht unterstützte Felder.'; END IF;
 FOREACH v_key IN ARRAY ARRAY['kind','title','category','description','preparation','goal'] LOOP
  IF jsonb_typeof(p_content->v_key) IS DISTINCT FROM 'string' OR length(p_content->>v_key)>10000 THEN
   RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Vorlagenfelder müssen gültige Texte enthalten.'; END IF;
 END LOOP;
 IF p_content->>'kind' NOT IN ('37_3','45') OR length(btrim(p_content->>'title')) NOT BETWEEN 1 AND 200
  OR length(btrim(p_content->>'category')) NOT BETWEEN 1 AND 80 OR length(p_content->>'description')>500
  OR btrim(p_content->>'preparation')='' OR (p_content->>'kind'='45' AND btrim(p_content->>'goal')='') THEN
  RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Leistungsart, Titel, Thema und Vorbereitung ergänzen; Schulungen benötigen ein Lernziel.'; END IF;
 IF jsonb_typeof(p_content->'prompts') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Gesprächsimpulse als Liste erfassen.'; END IF;
 IF jsonb_array_length(p_content->'prompts')>12 THEN RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Höchstens zwölf Gesprächsimpulse erfassen.'; END IF;
 FOR v_prompt IN SELECT value FROM jsonb_array_elements(p_content->'prompts') LOOP
  IF jsonb_typeof(v_prompt)<>'string' OR length(v_prompt#>>'{}') NOT BETWEEN 1 AND 1000 THEN
   RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Gesprächsimpulse müssen Texte mit höchstens 1.000 Zeichen sein.'; END IF;
 END LOOP;
END $b$;

-- Only called by the guarded mutation function after a confirmed approval/import.
CREATE FUNCTION care_security.consultation_materialize_followups(p_tenant uuid,p_encounter uuid)
RETURNS void LANGUAGE plpgsql SET search_path=pg_catalog AS $b$
DECLARE v_revision public.consultation_revisions%ROWTYPE; v_measure record; v_answers jsonb;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.consultation_encounters WHERE tenant_id=p_tenant AND id=p_encounter AND status='approved') THEN
  RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Empfehlungen können nach der fachlichen Freigabe übernommen werden.'; END IF;
 SELECT * INTO v_revision FROM public.consultation_revisions WHERE tenant_id=p_tenant AND encounter_id=p_encounter ORDER BY version DESC LIMIT 1;
 IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Keine bestätigte Fassung vorhanden.'; END IF;
 v_answers:=v_revision.snapshot->'answers';
 FOR v_measure IN SELECT value,ordinality FROM jsonb_array_elements(coalesce(v_answers->'measures','[]')) WITH ORDINALITY LOOP
  IF v_measure.value->>'status'='open' THEN
   INSERT INTO public.consultation_followups(tenant_id,encounter_id,source_key,source_revision_id,title,owner_label,due_date,updated_by)
    VALUES(p_tenant,p_encounter,'measure:'||v_revision.id::text||':'||v_measure.ordinality::text,v_revision.id,
     v_measure.value->>'title',coalesce(v_measure.value->>'owner',''),(v_measure.value->>'due')::date,auth.uid())
    ON CONFLICT(encounter_id,source_key) DO NOTHING;
  END IF;
 END LOOP;
 IF nullif(v_answers->>'followUpDate','') IS NOT NULL THEN
  INSERT INTO public.consultation_followups(tenant_id,encounter_id,source_key,source_revision_id,title,owner_label,description,due_date,updated_by)
   VALUES(p_tenant,p_encounter,'followup:'||v_revision.id::text,v_revision.id,'Wiedervorlage zum Besuch','Beratungsperson',coalesce(v_answers->>'followUpNote',''),
    (v_answers->>'followUpDate')::date,auth.uid()) ON CONFLICT(encounter_id,source_key) DO NOTHING;
 END IF;
END $b$;

CREATE FUNCTION care_security.consultation_extended_load(p_tenant uuid,p_employee_view boolean,p_case uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $b$
DECLARE v_base jsonb; v_ids uuid[]; v_edit boolean;
BEGIN
 v_base:=care_security.consultation_load(p_tenant,p_employee_view,p_case);
 v_edit:=coalesce((v_base->>'canManage')::boolean,false) OR coalesce((v_base->>'canReview')::boolean,false);
 SELECT coalesce(array_agg((e->>'id')::uuid),'{}') INTO v_ids FROM jsonb_array_elements(v_base->'encounters') e;
 RETURN v_base||jsonb_build_object('capabilities',jsonb_build_object('teamTemplates',true,'followUps',true),
  'teamTemplates',coalesce((SELECT jsonb_agg(jsonb_build_object('id',t.id,'version',t.version,'publishedVersion',t.published_version,
   'published',t.published,'archived',t.archived,'draft',CASE WHEN v_edit THEN t.draft ELSE NULL END,
   'history',CASE WHEN v_edit THEN coalesce((SELECT jsonb_agg(to_jsonb(h)-'tenant_id' ORDER BY h.version DESC)
    FROM public.consultation_template_versions h WHERE h.template_id=t.id AND h.tenant_id=p_tenant),'[]') ELSE '[]'::jsonb END) ORDER BY t.updated_at DESC)
   FROM public.consultation_team_templates t WHERE t.tenant_id=p_tenant AND (v_edit OR NOT t.archived AND t.published IS NOT NULL)),'[]'),
  'followUps',coalesce((SELECT jsonb_agg(to_jsonb(f)-'updated_by'||jsonb_build_object('can_edit',
   (v_base->>'canManage')::boolean OR EXISTS(SELECT 1 FROM public.consultation_encounters e WHERE e.id=f.encounter_id
    AND e.tenant_id=p_tenant AND e.assigned_employee_id=care_security.consultation_employee(p_tenant))) ORDER BY f.due_date,f.created_at)
   FROM public.consultation_followups f WHERE f.tenant_id=p_tenant AND f.encounter_id=ANY(v_ids)),'[]'));
END $b$;

CREATE FUNCTION care_security.consultation_extended_mutate(p_tenant uuid,p_action text,p_request uuid,p_encounter uuid,p_version integer,p_data jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $b$
DECLARE
 v_employee uuid:=care_security.consultation_employee(p_tenant);
 v_manage boolean:=coalesce(care_security.consultation_office(p_tenant,'beratung.cases.manage'),false);
 v_review boolean:=coalesce(care_security.consultation_office(p_tenant,'beratung.cases.review'),false);
 v_office boolean:=coalesce(care_security.consultation_office(p_tenant,'beratung.cases.view'),false);
 v_t public.consultation_team_templates%ROWTYPE; v_f public.consultation_followups%ROWTYPE;
 v_e public.consultation_encounters%ROWTYPE; v_prior public.consultation_requests%ROWTYPE;
 v_result jsonb; v_hash text; v_actor text; v_note text:=btrim(coalesce(p_data->>'note','')); v_status text;
BEGIN
 IF p_action NOT IN ('template_save','template_publish','template_archive','followup_create','followup_update','followup_import') THEN
  v_result:=care_security.consultation_mutate(p_tenant,p_action,p_request,p_encounter,p_version,p_data);
  IF p_action='approve' THEN
   IF NOT v_review THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Keine Berechtigung zur Freigabe.'; END IF;
   PERFORM care_security.consultation_materialize_followups(p_tenant,(v_result->>'encounter_id')::uuid);
  END IF;
  RETURN v_result;
 END IF;
 IF auth.uid() IS NULL OR p_tenant IS DISTINCT FROM public.current_tenant_id() OR (NOT v_office AND v_employee IS NULL)
  OR public.tenant_has_platform_module('consulting',p_tenant) IS DISTINCT FROM true THEN
  RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Kein Zugriff auf diesen Beratungsarbeitsplatz.'; END IF;
 IF p_request IS NULL OR jsonb_typeof(p_data) IS DISTINCT FROM 'object' OR octet_length(p_data::text)>100000 THEN
  RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Ungültiger Auftrag.'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_tenant::text||auth.uid()::text||p_request::text,0));
 -- Permission checks precede idempotent replay, including after reassignment/revocation.
 IF p_action LIKE 'template_%' THEN
  IF (p_action IN ('template_save','template_archive') AND NOT v_manage) OR (p_action='template_publish' AND NOT v_review) THEN
   RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Keine Berechtigung für diese Vorlagenänderung.'; END IF;
 ELSE
  SELECT * INTO v_e FROM public.consultation_encounters WHERE tenant_id=p_tenant AND id=p_encounter FOR UPDATE;
  IF NOT FOUND OR NOT (v_manage OR v_employee IS NOT NULL AND v_e.assigned_employee_id=v_employee) THEN
   RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Keine Berechtigung für diese Nachverfolgung.'; END IF;
  IF p_action='followup_import' AND NOT v_manage THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Nur die Verwaltung kann bestehende Empfehlungen übernehmen.'; END IF;
 END IF;
 v_hash:=encode(sha256(convert_to(jsonb_build_object('action',p_action,'encounter',p_encounter,'version',p_version,'data',p_data)::text,'UTF8')),'hex');
 SELECT * INTO v_prior FROM public.consultation_requests WHERE tenant_id=p_tenant AND actor_id=auth.uid() AND request_id=p_request;
 IF FOUND THEN
  IF v_prior.payload_hash<>v_hash THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Die Anfragekennung wurde bereits für einen anderen Inhalt verwendet.'; END IF;
  RETURN v_prior.result;
 END IF;
 SELECT coalesce(nullif(p.display_name,''),nullif(concat_ws(' ',p.first_name,p.last_name),'')) INTO v_actor
  FROM public.profiles p WHERE p.id=care_security.company_profile(p_tenant);
 IF v_actor IS NULL THEN SELECT nullif(concat_ws(' ',e.first_name,e.last_name),'') INTO v_actor FROM public.employees e WHERE e.id=v_employee; END IF;
 v_actor:=coalesce(v_actor,'Berechtigte Person');
 IF p_action LIKE 'template_%' THEN
  IF nullif(p_data->>'template_id','') IS NOT NULL THEN
   SELECT * INTO v_t FROM public.consultation_team_templates WHERE tenant_id=p_tenant AND id=(p_data->>'template_id')::uuid FOR UPDATE;
   IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Vorlage nicht verfügbar.'; END IF;
   IF v_t.version IS DISTINCT FROM (p_data->>'template_version')::integer THEN RAISE EXCEPTION USING ERRCODE='40001',MESSAGE='Die Vorlage wurde geändert.'; END IF;
   IF v_t.archived THEN RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Archivierte Vorlagen können als neue Vorlage kopiert werden.'; END IF;
  ELSIF p_action<>'template_save' THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Vorlage auswählen.'; END IF;
  IF p_action='template_save' THEN
   PERFORM care_security.consultation_template_validate(p_data->'content');
   IF v_t.id IS NULL THEN
    INSERT INTO public.consultation_team_templates(tenant_id,draft,updated_by) VALUES(p_tenant,p_data->'content',auth.uid()) RETURNING * INTO v_t;
   ELSE
    UPDATE public.consultation_team_templates SET draft=p_data->'content',version=version+1,updated_at=now(),updated_by=auth.uid() WHERE id=v_t.id RETURNING * INTO v_t;
   END IF;
   v_note:=coalesce(nullif(v_note,''),'Entwurf gespeichert');
  ELSE
   IF length(v_note) NOT BETWEEN 1 AND 2000 THEN RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Prüfvermerk oder Archivierungsgrund ergänzen (maximal 2.000 Zeichen).'; END IF;
   IF p_action='template_publish' THEN
    PERFORM care_security.consultation_template_validate(v_t.draft);
    UPDATE public.consultation_team_templates SET published=draft,published_version=version+1,version=version+1,updated_at=now(),updated_by=auth.uid() WHERE id=v_t.id RETURNING * INTO v_t;
   ELSE
    UPDATE public.consultation_team_templates SET archived=true,version=version+1,updated_at=now(),updated_by=auth.uid() WHERE id=v_t.id RETURNING * INTO v_t;
   END IF;
  END IF;
  IF length(v_note)>2000 THEN RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Vermerk auf 2.000 Zeichen kürzen.'; END IF;
  INSERT INTO public.consultation_template_versions(tenant_id,template_id,version,action,content,note,actor_label)
   VALUES(p_tenant,v_t.id,v_t.version,p_action,v_t.draft,v_note,v_actor);
  v_result:=jsonb_build_object('case_id',null,'encounter_id',null,'version',0,'template_id',v_t.id,'template_version',v_t.version);
 ELSE
  IF p_action='followup_import' THEN
   PERFORM care_security.consultation_materialize_followups(p_tenant,p_encounter);
   v_note:='Offene Empfehlungen aus der bestätigten Fassung in die Nachverfolgung übernommen.';
  ELSIF p_action='followup_create' THEN
   IF length(btrim(coalesce(p_data->>'title',''))) NOT BETWEEN 1 AND 500 OR nullif(p_data->>'due_date','') IS NULL THEN
    RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Aufgabe und Fälligkeit ergänzen.'; END IF;
   INSERT INTO public.consultation_followups(tenant_id,encounter_id,source_key,title,owner_label,due_date,updated_by)
    VALUES(p_tenant,p_encounter,'manual:'||p_request::text,btrim(p_data->>'title'),btrim(coalesce(p_data->>'owner_label','')),(p_data->>'due_date')::date,auth.uid()) RETURNING * INTO v_f;
   v_note:=v_f.title||' · Fällig: '||v_f.due_date::text;
  ELSE
   SELECT * INTO v_f FROM public.consultation_followups WHERE tenant_id=p_tenant AND encounter_id=p_encounter AND id=(p_data->>'followup_id')::uuid FOR UPDATE;
   IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Aufgabe nicht verfügbar.'; END IF;
   IF v_f.version IS DISTINCT FROM (p_data->>'followup_version')::integer THEN RAISE EXCEPTION USING ERRCODE='40001',MESSAGE='Die Nachverfolgung wurde geändert.'; END IF;
   v_status:=p_data->>'status';
   IF v_status IS NULL OR v_status NOT IN ('open','done','cancelled') OR length(v_note) NOT BETWEEN 1 AND 5000 OR nullif(p_data->>'due_date','') IS NULL THEN
    RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Status, Fälligkeit und eine Rückmeldung ergänzen.'; END IF;
   UPDATE public.consultation_followups SET status=v_status,due_date=(p_data->>'due_date')::date,outcome=v_note,
    completed_at=CASE WHEN v_status='done' THEN coalesce(completed_at,now()) ELSE NULL END,
    version=version+1,updated_at=now(),updated_by=auth.uid() WHERE id=v_f.id RETURNING * INTO v_f;
   v_note:=v_f.title||' · '||CASE v_status WHEN 'done' THEN 'Erledigt' WHEN 'cancelled' THEN 'Entfallen' ELSE 'Offen' END||' · Fällig: '||v_f.due_date::text||E'\n'||v_note;
  END IF;
  INSERT INTO public.consultation_events(tenant_id,encounter_id,action,note,actor_id,actor_label) VALUES(p_tenant,p_encounter,p_action,v_note,auth.uid(),v_actor);
  v_result:=jsonb_build_object('case_id',v_e.case_id,'encounter_id',v_e.id,'version',v_e.version,'followup_id',v_f.id,'followup_version',v_f.version);
 END IF;
 INSERT INTO public.consultation_requests(tenant_id,actor_id,request_id,payload_hash,result) VALUES(p_tenant,auth.uid(),p_request,v_hash,v_result);
 RETURN v_result;
END $b$;
REVOKE ALL ON FUNCTION care_security.consultation_template_validate(jsonb),care_security.consultation_materialize_followups(uuid,uuid),
 care_security.consultation_extended_load(uuid,boolean,uuid),care_security.consultation_extended_mutate(uuid,text,uuid,uuid,integer,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION care_security.consultation_extended_load(uuid,boolean,uuid),care_security.consultation_extended_mutate(uuid,text,uuid,uuid,integer,jsonb) TO authenticated;
-- Prevent a direct authenticated call to the old private mutation bypassing materialization.
REVOKE EXECUTE ON FUNCTION care_security.consultation_load(uuid,boolean,uuid),care_security.consultation_mutate(uuid,text,uuid,uuid,integer,jsonb) FROM authenticated;
CREATE OR REPLACE FUNCTION public.consultation_workspace_load(p_tenant uuid,p_employee_view boolean DEFAULT false,p_case uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path=pg_catalog AS $b$ SELECT care_security.consultation_extended_load(p_tenant,p_employee_view,p_case) $b$;
CREATE OR REPLACE FUNCTION public.consultation_workspace_mutate(p_tenant uuid,p_action text,p_request uuid,p_encounter uuid DEFAULT NULL,p_version integer DEFAULT NULL,p_data jsonb DEFAULT '{}')
RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path=pg_catalog AS $b$ SELECT care_security.consultation_extended_mutate(p_tenant,p_action,p_request,p_encounter,p_version,p_data) $b$;
COMMIT;
