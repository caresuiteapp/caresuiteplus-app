BEGIN;

-- Match legacy task mirrors without assuming identical sort_order values.
-- No existing visit, documentation, signature or proof is changed by this migration.
CREATE OR REPLACE FUNCTION public.resolve_admin_visit_task_ids(p_visit_id uuid, p_source_task_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','pg_temp'
AS $match$
DECLARE
 v public.assist_visits%ROWTYPE;
 v_assignment_id uuid;
 v_visit_task_id uuid;
 v_assignment_task_id uuid;
 v_title text;
 v_sort_order integer;
 v_candidates uuid[];
 v_source_count integer;
BEGIN
 IF NOT (public.is_tenant_admin() OR public.has_permission('assist.execution.manage')) THEN
  RAISE EXCEPTION 'Keine Berechtigung für administrative Nachbearbeitung';
 END IF;
 SELECT * INTO v FROM public.assist_visits
 WHERE id=p_visit_id AND tenant_id=public.current_tenant_id() FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Einsatz nicht gefunden'; END IF;
 v_assignment_id:=coalesce(v.legacy_assignment_id,v.id);
 SELECT id,title,sort_order INTO v_visit_task_id,v_title,v_sort_order
 FROM public.assist_visit_tasks WHERE tenant_id=v.tenant_id AND visit_id=v.id AND id=p_source_task_id FOR UPDATE;
 IF v_visit_task_id IS NULL THEN
  SELECT id,title,sort_order INTO v_assignment_task_id,v_title,v_sort_order
  FROM public.assignment_tasks WHERE tenant_id=v.tenant_id AND assignment_id=v_assignment_id AND id=p_source_task_id FOR UPDATE;
 END IF;
 IF v_visit_task_id IS NULL AND v_assignment_task_id IS NULL THEN RETURN '{}'::jsonb; END IF;
 IF v_visit_task_id IS NOT NULL THEN
  SELECT id INTO v_assignment_task_id FROM public.assignment_tasks
  WHERE tenant_id=v.tenant_id AND assignment_id=v_assignment_id AND id=p_source_task_id FOR UPDATE;
  IF v_assignment_task_id IS NULL THEN
   SELECT array_agg(q.id) INTO v_candidates FROM (
    SELECT id FROM public.assignment_tasks
    WHERE tenant_id=v.tenant_id AND assignment_id=v_assignment_id AND title=v_title AND sort_order IS NOT DISTINCT FROM v_sort_order
    ORDER BY id FOR UPDATE
   ) q;
   IF coalesce(cardinality(v_candidates),0)>1 THEN RAISE EXCEPTION 'Aufgabe nicht eindeutig zuordenbar: %',v_title; END IF;
   IF coalesce(cardinality(v_candidates),0)=1 THEN
    SELECT count(*) INTO v_source_count FROM public.assist_visit_tasks
    WHERE tenant_id=v.tenant_id AND visit_id=v.id AND title=v_title AND sort_order IS NOT DISTINCT FROM v_sort_order;
    IF v_source_count<>1 THEN RAISE EXCEPTION 'Aufgabe nicht eindeutig zuordenbar: %',v_title; END IF;
    v_assignment_task_id:=v_candidates[1];
   ELSE
    SELECT count(*) INTO v_source_count FROM public.assist_visit_tasks
    WHERE tenant_id=v.tenant_id AND visit_id=v.id AND title=v_title;
    SELECT array_agg(q.id) INTO v_candidates FROM (
     SELECT id FROM public.assignment_tasks WHERE tenant_id=v.tenant_id AND assignment_id=v_assignment_id AND title=v_title ORDER BY id FOR UPDATE
    ) q;
    IF coalesce(cardinality(v_candidates),0)>0 THEN
     IF cardinality(v_candidates)<>1 OR v_source_count<>1 THEN RAISE EXCEPTION 'Aufgabe nicht eindeutig zuordenbar: %',v_title; END IF;
     v_assignment_task_id:=v_candidates[1];
    END IF;
   END IF;
  END IF;
 ELSE
  SELECT id INTO v_visit_task_id FROM public.assist_visit_tasks
  WHERE tenant_id=v.tenant_id AND visit_id=v.id AND id=p_source_task_id FOR UPDATE;
  IF v_visit_task_id IS NULL THEN
   SELECT array_agg(q.id) INTO v_candidates FROM (
    SELECT id FROM public.assist_visit_tasks
    WHERE tenant_id=v.tenant_id AND visit_id=v.id AND title=v_title AND sort_order IS NOT DISTINCT FROM v_sort_order
    ORDER BY id FOR UPDATE
   ) q;
   IF coalesce(cardinality(v_candidates),0)>1 THEN RAISE EXCEPTION 'Aufgabe nicht eindeutig zuordenbar: %',v_title; END IF;
   IF coalesce(cardinality(v_candidates),0)=1 THEN
    SELECT count(*) INTO v_source_count FROM public.assignment_tasks
    WHERE tenant_id=v.tenant_id AND assignment_id=v_assignment_id AND title=v_title AND sort_order IS NOT DISTINCT FROM v_sort_order;
    IF v_source_count<>1 THEN RAISE EXCEPTION 'Aufgabe nicht eindeutig zuordenbar: %',v_title; END IF;
    v_visit_task_id:=v_candidates[1];
   ELSE
    SELECT count(*) INTO v_source_count FROM public.assignment_tasks
    WHERE tenant_id=v.tenant_id AND assignment_id=v_assignment_id AND title=v_title;
    SELECT array_agg(q.id) INTO v_candidates FROM (
     SELECT id FROM public.assist_visit_tasks WHERE tenant_id=v.tenant_id AND visit_id=v.id AND title=v_title ORDER BY id FOR UPDATE
    ) q;
    IF coalesce(cardinality(v_candidates),0)>0 THEN
     IF cardinality(v_candidates)<>1 OR v_source_count<>1 THEN RAISE EXCEPTION 'Aufgabe nicht eindeutig zuordenbar: %',v_title; END IF;
     v_visit_task_id:=v_candidates[1];
    END IF;
   END IF;
  END IF;
 END IF;
 RETURN jsonb_build_object('visit_task_id',v_visit_task_id,'assignment_task_id',v_assignment_task_id,'title',v_title);
END;
$match$;
REVOKE ALL ON FUNCTION public.resolve_admin_visit_task_ids(uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_admin_visit_task_ids(uuid,uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_bulk_update_assist_visit_tasks(p_visit_id uuid, p_updates jsonb, p_reason text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_visit public.assist_visits%ROWTYPE;
  v_assignment_id UUID;
  v_item JSONB;
  v_source_id UUID;
  v_visit_task_id UUID;
  v_assignment_task_id UUID;
  v_title TEXT;
  v_sort_order INTEGER;
  v_status TEXT;
  v_assignment_status TEXT;
  v_old_visit_status TEXT;
  v_old_assignment_status TEXT;
  v_old_visible_status TEXT;
  v_changed BOOLEAN;
  v_match JSONB;
  v_updated INTEGER := 0;
  v_skipped INTEGER := 0;
BEGIN
  IF NOT (
    public.is_tenant_admin()
    OR public.has_permission('assist.execution.manage')
  ) THEN
    RAISE EXCEPTION 'Keine Berechtigung für administrative Nachbearbeitung';
  END IF;

  IF length(trim(coalesce(p_reason, ''))) = 0 THEN
    RAISE EXCEPTION 'Begründung ist erforderlich';
  END IF;

  IF p_updates IS NULL
     OR jsonb_typeof(p_updates) <> 'array'
     OR jsonb_array_length(p_updates) = 0 THEN
    RAISE EXCEPTION 'Keine Aufgabenänderungen übergeben';
  END IF;

  SELECT *
  INTO v_visit
  FROM public.assist_visits
  WHERE id = p_visit_id
    AND tenant_id = public.current_tenant_id()
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Einsatz nicht gefunden';
  END IF;

  v_assignment_id := coalesce(v_visit.legacy_assignment_id, v_visit.id);

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_updates)
  LOOP
    v_source_id := NULL;
    v_visit_task_id := NULL;
    v_assignment_task_id := NULL;
    v_title := NULL;
    v_sort_order := NULL;
    v_old_visit_status := NULL;
    v_old_assignment_status := NULL;
    v_changed := FALSE;

    BEGIN
      v_source_id := nullif(v_item->>'task_id', '')::UUID;
    EXCEPTION WHEN invalid_text_representation THEN
      RAISE EXCEPTION 'Ungültige Aufgaben-ID';
    END;
    v_status := v_item->>'status';

    IF v_source_id IS NULL OR v_status NOT IN (
      'open', 'done', 'partial', 'not_requested',
      'not_possible', 'cancelled', 'deferred'
    ) THEN
      RAISE EXCEPTION 'Ungültiger Aufgabenstatus';
    END IF;

    SELECT t.id, t.title, t.sort_order, t.status
    INTO v_visit_task_id, v_title, v_sort_order, v_old_visit_status
    FROM public.assist_visit_tasks t
    WHERE t.tenant_id = v_visit.tenant_id
      AND t.visit_id = v_visit.id
      AND t.id = v_source_id
    FOR UPDATE;

    IF v_visit_task_id IS NULL THEN
      SELECT t.id, t.title, t.sort_order, t.status
      INTO v_assignment_task_id, v_title, v_sort_order, v_old_assignment_status
      FROM public.assignment_tasks t
      WHERE t.tenant_id = v_visit.tenant_id
        AND t.assignment_id = v_assignment_id
        AND t.id = v_source_id
      FOR UPDATE;
    END IF;

    IF v_visit_task_id IS NULL AND v_assignment_task_id IS NULL THEN
      INSERT INTO public.assist_visit_admin_audit (
        tenant_id, visit_id, action, previous_value, new_value, reason
      ) VALUES (
        v_visit.tenant_id,
        v_visit.id,
        'stale_task_reference_discarded',
        jsonb_build_object('source_task_id', v_source_id),
        jsonb_build_object('discarded', TRUE),
        trim(p_reason)
      );
      v_skipped := v_skipped + 1;
      CONTINUE;
    END IF;

    v_match := public.resolve_admin_visit_task_ids(v_visit.id,v_source_id);
    v_visit_task_id := (v_match->>'visit_task_id')::uuid;
    v_assignment_task_id := (v_match->>'assignment_task_id')::uuid;
    SELECT status INTO v_old_visit_status FROM public.assist_visit_tasks
    WHERE tenant_id=v_visit.tenant_id AND visit_id=v_visit.id AND id=v_visit_task_id;
    SELECT status INTO v_old_assignment_status FROM public.assignment_tasks
    WHERE tenant_id=v_visit.tenant_id AND assignment_id=v_assignment_id AND id=v_assignment_task_id;

    v_assignment_status := CASE v_status
      WHEN 'not_possible' THEN 'not_done'
      WHEN 'deferred' THEN 'not_done'
      ELSE v_status
    END;
    v_old_visible_status := coalesce(
      v_old_visit_status,
      CASE v_old_assignment_status
        WHEN 'not_done' THEN 'not_possible'
        ELSE v_old_assignment_status
      END
    );

    IF v_visit_task_id IS NOT NULL
       AND v_old_visit_status IS DISTINCT FROM v_status THEN
      UPDATE public.assist_visit_tasks
      SET
        status = v_status,
        not_done_reason = CASE WHEN v_status = 'done' THEN NULL ELSE trim(p_reason) END,
        completed_at = CASE WHEN v_status = 'done' THEN coalesce(completed_at, now()) ELSE NULL END,
        updated_at = now()
      WHERE id = v_visit_task_id
        AND visit_id = v_visit.id
        AND tenant_id = v_visit.tenant_id;
      v_changed := TRUE;
    END IF;

    IF v_assignment_task_id IS NOT NULL
       AND v_old_assignment_status IS DISTINCT FROM v_assignment_status THEN
      UPDATE public.assignment_tasks
      SET
        status = v_assignment_status,
        not_done_reason = CASE WHEN v_status = 'done' THEN NULL ELSE trim(p_reason) END,
        updated_at = now()
      WHERE id = v_assignment_task_id
        AND assignment_id = v_assignment_id
        AND tenant_id = v_visit.tenant_id;
      v_changed := TRUE;
    END IF;

    IF v_changed THEN
      INSERT INTO public.assist_visit_admin_audit (
        tenant_id, visit_id, action, previous_value, new_value, reason
      ) VALUES (
        v_visit.tenant_id,
        v_visit.id,
        'task_updated_reconciled',
        jsonb_build_object(
          'source_task_id', v_source_id,
          'visit_task_id', v_visit_task_id,
          'assignment_task_id', v_assignment_task_id,
          'title', v_title,
          'status', v_old_visible_status
        ),
        jsonb_build_object(
          'source_task_id', v_source_id,
          'visit_task_id', v_visit_task_id,
          'assignment_task_id', v_assignment_task_id,
          'title', v_title,
          'status', v_status
        ),
        trim(p_reason)
      );
      v_updated := v_updated + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'ok', TRUE,
    'updated', v_updated,
    'skipped', v_skipped
  );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.admin_reconcile_complete_assist_visit_follow_up(p_visit_id uuid, p_task_states jsonb, p_reason text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v public.assist_visits%ROWTYPE;
  v_actor UUID := public.resolve_current_profile_id();
  v_assignment_id UUID;
  v_item JSONB;
  v_match JSONB;
  v_visit_task_id UUID;
  v_assignment_task_id UUID;
  v_source_id UUID;
  v_title TEXT;
  v_sort_order INTEGER;
  v_status TEXT;
  v_assignment_status TEXT;
  v_signature_deferred BOOLEAN := FALSE;
  v_open_titles TEXT;
BEGIN
  IF NOT (public.is_tenant_admin() OR public.has_permission('assist.execution.manage')) THEN
    RAISE EXCEPTION 'Keine Berechtigung';
  END IF;
  IF length(trim(coalesce(p_reason, ''))) = 0 THEN
    RAISE EXCEPTION 'Begründung ist erforderlich';
  END IF;
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Angemeldetes Verwaltungsprofil konnte nicht zugeordnet werden';
  END IF;
  IF p_task_states IS NULL OR jsonb_typeof(p_task_states) <> 'array' THEN
    RAISE EXCEPTION 'Aufgabenstatus ist ungültig';
  END IF;

  SELECT * INTO v
  FROM public.assist_visits
  WHERE id = p_visit_id AND tenant_id = public.current_tenant_id()
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Einsatz nicht gefunden'; END IF;

  v_assignment_id := coalesce(v.legacy_assignment_id, v.id);

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_task_states)
  LOOP
    v_title := NULL;
    v_sort_order := NULL;
    BEGIN
      v_source_id := nullif(v_item->>'task_id', '')::UUID;
    EXCEPTION WHEN invalid_text_representation THEN
      RAISE EXCEPTION 'Ungültige Aufgaben-ID';
    END;
    v_status := v_item->>'status';
    IF v_source_id IS NULL OR v_status NOT IN (
      'open', 'done', 'partial', 'not_requested',
      'not_possible', 'cancelled', 'deferred'
    ) THEN
      RAISE EXCEPTION 'Ungültiger Aufgabenstatus';
    END IF;

    v_match := public.resolve_admin_visit_task_ids(v.id,v_source_id);
    v_visit_task_id := (v_match->>'visit_task_id')::uuid;
    v_assignment_task_id := (v_match->>'assignment_task_id')::uuid;
    IF v_visit_task_id IS NULL AND v_assignment_task_id IS NULL THEN RAISE EXCEPTION 'Aufgabe nicht gefunden'; END IF;

    UPDATE public.assist_visit_tasks t
    SET
      status = v_status,
      not_done_reason = CASE WHEN v_status = 'done' THEN NULL ELSE trim(p_reason) END,
      completed_at = CASE WHEN v_status = 'done' THEN coalesce(t.completed_at, now()) ELSE NULL END,
      updated_at = now()
    WHERE t.tenant_id = v.tenant_id
      AND t.visit_id = v.id
      AND t.id = v_visit_task_id;

    IF to_regclass('public.assignment_tasks') IS NOT NULL THEN
      v_assignment_status := CASE v_status
        WHEN 'not_possible' THEN 'not_done'
        WHEN 'deferred' THEN 'not_done'
        ELSE v_status
      END;
      UPDATE public.assignment_tasks t
      SET
        status = v_assignment_status,
        not_done_reason = CASE WHEN v_status = 'done' THEN NULL ELSE trim(p_reason) END,
        updated_at = now()
      WHERE t.tenant_id = v.tenant_id
        AND t.assignment_id = v_assignment_id
        AND t.id = v_assignment_task_id;
    END IF;
  END LOOP;

  IF v.actual_start_at IS NULL OR v.actual_end_at IS NULL
     OR coalesce(v.duration_minutes, 0) <= 0 THEN
    RAISE EXCEPTION 'Gültige Ist-Zeiten fehlen';
  END IF;

  SELECT string_agg(t.title, ', ' ORDER BY t.sort_order) INTO v_open_titles
  FROM public.assist_visit_tasks t
  WHERE t.tenant_id = v.tenant_id AND t.visit_id = v.id
    AND t.is_required AND t.status = 'open';

  IF v_open_titles IS NULL AND to_regclass('public.assignment_tasks') IS NOT NULL THEN
    SELECT string_agg(t.title, ', ' ORDER BY t.sort_order) INTO v_open_titles
    FROM public.assignment_tasks t
    WHERE t.tenant_id = v.tenant_id AND t.assignment_id = v_assignment_id
      AND t.is_required AND t.status = 'open';
  END IF;
  IF v_open_titles IS NOT NULL THEN
    RAISE EXCEPTION 'Pflichtaufgaben sind noch offen: %', v_open_titles;
  END IF;

  IF v.documentation_status <> 'complete' THEN
    RAISE EXCEPTION 'Dokumentation ist nicht vollständig';
  END IF;

  IF v.proof_status NOT IN ('signed', 'verified') THEN
    SELECT EXISTS (
      SELECT 1 FROM public.assist_visit_signature_requests
      WHERE tenant_id = v.tenant_id AND visit_id = v.id AND status = 'open'
      UNION ALL
      SELECT 1 FROM public.assist_visit_proofs
      WHERE tenant_id = v.tenant_id AND visit_id = v.id
        AND portal_visible = TRUE
        AND portal_release_status = 'pending_client_signature'
    ) INTO v_signature_deferred;
    IF NOT v_signature_deferred THEN
      RAISE EXCEPTION 'Signatur oder verifizierter Nachweis fehlt';
    END IF;
  END IF;

  UPDATE public.assist_visits
  SET
    execution_status = 'completed',
    canonical_status = 'completed',
    billing_status = CASE WHEN v_signature_deferred THEN 'blocked' ELSE 'ready' END,
    finished_at = coalesce(finished_at, actual_end_at),
    updated_by = v_actor,
    updated_at = now()
  WHERE id = v.id AND tenant_id = v.tenant_id;

  UPDATE public.assignments
  SET status = 'completed', updated_at = now()
  WHERE id = v_assignment_id AND tenant_id = v.tenant_id;

  INSERT INTO public.assist_visit_admin_audit (
    tenant_id, visit_id, action, previous_value, new_value, reason
  ) VALUES (
    v.tenant_id, v.id, 'follow_up_completed_reconciled',
    jsonb_build_object('canonical_status', v.canonical_status),
    jsonb_build_object(
      'canonical_status', 'completed',
      'signature_deferred_to_client_portal', v_signature_deferred,
      'billing_status', CASE WHEN v_signature_deferred THEN 'blocked' ELSE 'ready' END,
      'task_state_count', jsonb_array_length(p_task_states)
    ), trim(p_reason)
  );
END;
$function$
;

COMMIT;
