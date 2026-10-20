-- Add optional tasks only to the current actor's individual, writable visit.
-- No customer rows, planning templates, billing values or RLS policies are changed here.
CREATE SCHEMA IF NOT EXISTS caresuite_private;
REVOKE ALL ON SCHEMA caresuite_private FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA caresuite_private TO authenticated;

CREATE OR REPLACE FUNCTION caresuite_private.employee_add_optional_visit_tasks(
  p_tenant_id uuid, p_source text, p_parent_id uuid, p_tasks jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path = '' SET lock_timeout = '3s'
AS $function$
DECLARE
  v_user uuid := auth.uid();
  v_employee uuid := public.resolve_current_employee_id();
  v_visit public.assist_visits%ROWTYPE;
  v_assignment public.assignments%ROWTYPE;
  v_mirror public.assignments%ROWTYPE;
  v_item jsonb; v_id uuid; v_title text; v_key text;
  v_existing_id uuid; v_existing_title text; v_existing_status text;
  v_existing_required boolean; v_existing_note text;
  v_ids uuid[] := '{}'; v_keys text[] := '{}';
  v_order integer; v_mirror_order integer; v_inserted integer := 0;
  v_saved jsonb := '[]'::jsonb;
BEGIN
  IF v_user IS NULL OR v_employee IS NULL
    OR p_tenant_id IS DISTINCT FROM public.current_tenant_id()
    OR public.is_employee_portal_rls_context(p_tenant_id) IS NOT TRUE
    OR public.platform_tenant_access_allowed(p_tenant_id, false) IS NOT TRUE THEN
    RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='Aufgaben dürfen nur im eigenen freigegebenen Mitarbeitendenzugang ergänzt werden.';
  END IF;
  IF p_parent_id IS NULL OR p_source NOT IN ('assist_visits','assignments') OR p_source IS NULL
    OR jsonb_typeof(p_tasks) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='Aufgabenauswahl ist ungültig. Bitte eine bis 25 Aufgaben auswählen.';
  END IF;
  IF jsonb_array_length(p_tasks) NOT BETWEEN 1 AND 25 THEN
    RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='Aufgabenauswahl ist ungültig. Bitte eine bis 25 Aufgaben auswählen.';
  END IF;
  IF p_source='assist_visits' THEN
    SELECT * INTO v_visit FROM public.assist_visits
      WHERE id=p_parent_id AND tenant_id=p_tenant_id AND employee_id=v_employee
        AND employee_portal_visible AND planning_status NOT IN ('draft','cancelled') FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='Aufgaben können nur dem eigenen freigegebenen Einsatz zugeordnet werden.'; END IF;
    IF v_visit.canonical_status NOT IN ('started','paused','finished','documentation_open')
      OR v_visit.proof_status IN ('signed','verified') OR v_visit.billing_status IN ('invoiced','paid') THEN
      RAISE EXCEPTION USING ERRCODE='55000', MESSAGE='Aufgaben können nach der Freigabe zur Unterschrift oder dem Abschluss nicht mehr ergänzt werden.';
    END IF;
    IF v_visit.legacy_assignment_id IS NOT NULL THEN
      SELECT * INTO v_mirror FROM public.assignments WHERE id=v_visit.legacy_assignment_id AND tenant_id=p_tenant_id FOR UPDATE;
      IF FOUND AND (v_mirror.employee_id IS DISTINCT FROM v_employee OR v_mirror.status::text IN ('completed','cancelled','no_show','signature_open')) THEN
        RAISE EXCEPTION USING ERRCODE='55000', MESSAGE='Aufgaben können in diesem Einsatz nicht mehr ergänzt werden.';
      END IF;
    END IF;
    SELECT coalesce(max(sort_order),-1)+1 INTO v_order FROM public.assist_visit_tasks WHERE tenant_id=p_tenant_id AND visit_id=p_parent_id;
    IF v_mirror.id IS NOT NULL THEN
      SELECT coalesce(max(sort_order),-1)+1 INTO v_mirror_order FROM public.assignment_tasks WHERE tenant_id=p_tenant_id AND assignment_id=v_mirror.id;
    END IF;
  ELSE
    SELECT * INTO v_assignment FROM public.assignments WHERE id=p_parent_id AND tenant_id=p_tenant_id AND employee_id=v_employee FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='Aufgaben können nur dem eigenen freigegebenen Einsatz zugeordnet werden.'; END IF;
    IF v_assignment.status::text NOT IN ('started','paused','finished','documentation_open') THEN
      RAISE EXCEPTION USING ERRCODE='55000', MESSAGE='Aufgaben können nach der Freigabe zur Unterschrift oder dem Abschluss nicht mehr ergänzt werden.';
    END IF;
    -- A linked visit owns the execution. Do not create tasks in a stale mirror.
    IF EXISTS (SELECT 1 FROM public.assist_visits WHERE tenant_id=p_tenant_id AND legacy_assignment_id=p_parent_id) THEN
      RAISE EXCEPTION USING ERRCODE='55000', MESSAGE='Aufgaben müssen im aktuellen einzelnen Einsatz ergänzt werden. Bitte den Einsatz neu laden.';
    END IF;
    SELECT coalesce(max(sort_order),-1)+1 INTO v_order FROM public.assignment_tasks WHERE tenant_id=p_tenant_id AND assignment_id=p_parent_id;
  END IF;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_tasks) LOOP
    IF jsonb_typeof(v_item) IS DISTINCT FROM 'object' THEN
      RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='Aufgabenauswahl ist unvollständig. Bitte erneut auswählen.';
    END IF;
    IF jsonb_typeof(v_item->'id') IS DISTINCT FROM 'string'
      OR jsonb_typeof(v_item->'title') IS DISTINCT FROM 'string'
      OR coalesce(v_item->>'id','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      OR EXISTS (SELECT 1 FROM jsonb_object_keys(v_item) k WHERE k NOT IN ('id','title','catalogId'))
      OR (v_item ? 'catalogId' AND (jsonb_typeof(v_item->'catalogId') IS DISTINCT FROM 'string' OR char_length(v_item->>'catalogId')>128)) THEN
      RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='Aufgabenauswahl ist unvollständig. Bitte erneut auswählen.';
    END IF;
    v_id := (v_item->>'id')::uuid;
    v_title := btrim(regexp_replace(normalize(v_item->>'title',NFKC),'\s+',' ','g'));
    v_key := lower(v_title);
    IF char_length(v_title) NOT BETWEEN 1 AND 300 OR v_title ~ '[[:cntrl:]]' THEN
      RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='Aufgabe muss eine Bezeichnung mit höchstens 300 Zeichen enthalten.';
    END IF;
    -- Match the existing Assist task guard; clinical orders belong to their existing workflow.
    IF EXISTS (SELECT 1 FROM unnest(ARRAY['medikament','medikation','injektion','insulin','infusion','wundversorgung','wundbehandlung','medizin','diagnose','blutdruck','blutzucker','katheter','stoma','behandlungspflege','krankenpflege','kompressionsstr','sauerstoff','grundpflege','pflegeleistung','therapie']) keyword WHERE strpos(v_key,keyword)>0) THEN
      RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='Aufgabe gehört nicht zu den freigegebenen Alltags- und Unterstützungsaufgaben.';
    END IF;
    IF v_id=ANY(v_ids) OR v_key=ANY(v_keys) THEN
      RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='Aufgabe wurde mehrfach ausgewählt. Bitte die Auswahl prüfen.';
    END IF;
    v_ids := array_append(v_ids,v_id); v_keys := array_append(v_keys,v_key);
    v_existing_id := NULL;
    IF p_source='assist_visits' THEN
      IF EXISTS (SELECT 1 FROM public.assist_visit_tasks WHERE id=v_id AND (tenant_id<>p_tenant_id OR visit_id<>p_parent_id OR lower(btrim(regexp_replace(normalize(title,NFKC),'\s+',' ','g')))<>v_key)) THEN
        RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='Aufgabenanfrage wurde bereits anders verwendet. Bitte die Auswahl neu öffnen.';
      END IF;
      SELECT id,title,status,is_required,not_done_reason INTO v_existing_id,v_existing_title,v_existing_status,v_existing_required,v_existing_note
        FROM public.assist_visit_tasks WHERE tenant_id=p_tenant_id AND visit_id=p_parent_id
          AND lower(btrim(regexp_replace(normalize(title,NFKC),'\s+',' ','g')))=v_key ORDER BY sort_order,id LIMIT 1;
      IF v_existing_id IS NULL THEN
        INSERT INTO public.assist_visit_tasks(id,tenant_id,visit_id,title,status,is_required,is_optional,requires_note_if_not_done,sort_order,payload_json)
          VALUES(v_id,p_tenant_id,p_parent_id,v_title,'open',false,true,true,v_order,jsonb_build_object('origin','employee_portal','catalog_task_id',v_item->>'catalogId','created_by_auth_user',v_user,'created_by_employee',v_employee));
        v_existing_id:=v_id; v_existing_title:=v_title; v_existing_status:='open'; v_existing_required:=false; v_existing_note:=NULL;
        v_order:=v_order+1; v_inserted:=v_inserted+1;
        IF v_mirror.id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.assignment_tasks WHERE tenant_id=p_tenant_id AND assignment_id=v_mirror.id AND lower(btrim(regexp_replace(normalize(title,NFKC),'\s+',' ','g')))=v_key) THEN
          INSERT INTO public.assignment_tasks(id,tenant_id,assignment_id,title,status,is_required,requires_note_if_not_done,sort_order)
            VALUES(v_id,p_tenant_id,v_mirror.id,v_title,'open',false,true,v_mirror_order);
          v_mirror_order:=v_mirror_order+1;
        END IF;
      END IF;
    ELSE
      IF EXISTS (SELECT 1 FROM public.assignment_tasks WHERE id=v_id AND (tenant_id<>p_tenant_id OR assignment_id<>p_parent_id OR lower(btrim(regexp_replace(normalize(title,NFKC),'\s+',' ','g')))<>v_key)) THEN
        RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='Aufgabenanfrage wurde bereits anders verwendet. Bitte die Auswahl neu öffnen.';
      END IF;
      SELECT id,title,status::text,is_required,not_done_reason INTO v_existing_id,v_existing_title,v_existing_status,v_existing_required,v_existing_note
        FROM public.assignment_tasks WHERE tenant_id=p_tenant_id AND assignment_id=p_parent_id
          AND lower(btrim(regexp_replace(normalize(title,NFKC),'\s+',' ','g')))=v_key ORDER BY sort_order,id LIMIT 1;
      IF v_existing_id IS NULL THEN
        INSERT INTO public.assignment_tasks(id,tenant_id,assignment_id,title,status,is_required,requires_note_if_not_done,sort_order)
          VALUES(v_id,p_tenant_id,p_parent_id,v_title,'open',false,true,v_order);
        v_existing_id:=v_id; v_existing_title:=v_title; v_existing_status:='open'; v_existing_required:=false; v_existing_note:=NULL;
        v_order:=v_order+1; v_inserted:=v_inserted+1;
      END IF;
    END IF;
    v_saved:=v_saved || jsonb_build_array(jsonb_build_object('id',v_existing_id,'title',v_existing_title,'status',v_existing_status,'required',v_existing_required,'completionNote',v_existing_note));
  END LOOP;
  IF p_source='assist_visits' AND v_inserted>0 THEN
    INSERT INTO public.assist_visit_audit_logs(tenant_id,visit_id,action,details,metadata)
      VALUES(p_tenant_id,p_parent_id,'optional_tasks_added',v_inserted||' optionale Aufgaben durch Mitarbeitenden ergänzt',jsonb_build_object('auth_user_id',v_user,'employee_id',v_employee,'task_ids',v_ids));
  END IF;
  RETURN jsonb_build_object('release','caresuite-optional-visit-tasks-20261008','source',p_source,'parentId',p_parent_id,'inserted',v_inserted,'tasks',v_saved);
END;
$function$;
REVOKE ALL ON FUNCTION caresuite_private.employee_add_optional_visit_tasks(uuid,text,uuid,jsonb) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION caresuite_private.employee_add_optional_visit_tasks(uuid,text,uuid,jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.employee_add_optional_visit_tasks(p_tenant_id uuid,p_source text,p_parent_id uuid,p_tasks jsonb)
RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path=''
AS $function$ SELECT caresuite_private.employee_add_optional_visit_tasks(p_tenant_id,p_source,p_parent_id,p_tasks); $function$;
REVOKE ALL ON FUNCTION public.employee_add_optional_visit_tasks(uuid,text,uuid,jsonb) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.employee_add_optional_visit_tasks(uuid,text,uuid,jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.employee_optional_tasks_release_status()
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path=''
AS $function$
  SELECT jsonb_build_object('release','caresuite-optional-visit-tasks-20261008','ready',
    EXISTS(SELECT 1 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
      WHERE n.nspname='caresuite_private' AND p.proname='employee_add_optional_visit_tasks' AND p.prosecdef
        AND p.proconfig @> ARRAY['search_path=""']::text[]) AND
    EXISTS(SELECT 1 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
      WHERE n.nspname='public' AND p.proname='employee_add_optional_visit_tasks' AND NOT p.prosecdef));
$function$;
REVOKE ALL ON FUNCTION public.employee_optional_tasks_release_status() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.employee_optional_tasks_release_status() TO anon,authenticated,service_role;
NOTIFY pgrst,'reload schema';
