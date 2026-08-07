-- CareSuite+ R15 — Administrative Sammelbearbeitung gegen beide Aufgabenwahrheiten.
-- Die Verwaltungsansicht zeigt bevorzugt assignment_tasks. Der bisherige RPC
-- akzeptierte dagegen ausschließlich IDs aus assist_visit_tasks und brach bei
-- gültigen sichtbaren Aufgaben mit "Aufgabe nicht gefunden" ab.

CREATE OR REPLACE FUNCTION public.admin_bulk_update_assist_visit_tasks(
  p_visit_id UUID,
  p_updates JSONB,
  p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
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

    IF v_visit_task_id IS NOT NULL THEN
      SELECT t.id, t.status
      INTO v_assignment_task_id, v_old_assignment_status
      FROM public.assignment_tasks t
      WHERE t.tenant_id = v_visit.tenant_id
        AND t.assignment_id = v_assignment_id
        AND (
          t.id = v_source_id
          OR (t.title = v_title AND t.sort_order = v_sort_order)
        )
      ORDER BY CASE WHEN t.id = v_source_id THEN 0 ELSE 1 END
      LIMIT 1
      FOR UPDATE;
    ELSE
      SELECT t.id, t.status
      INTO v_visit_task_id, v_old_visit_status
      FROM public.assist_visit_tasks t
      WHERE t.tenant_id = v_visit.tenant_id
        AND t.visit_id = v_visit.id
        AND t.title = v_title
        AND t.sort_order = v_sort_order
      LIMIT 1
      FOR UPDATE;
    END IF;

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
$$;

REVOKE ALL ON FUNCTION public.admin_bulk_update_assist_visit_tasks(UUID, JSONB, TEXT)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_bulk_update_assist_visit_tasks(UUID, JSONB, TEXT)
  TO authenticated;

COMMENT ON FUNCTION public.admin_bulk_update_assist_visit_tasks(UUID, JSONB, TEXT) IS
  'Atomare, tenant-sichere Sammelkorrektur sichtbarer Assignment- oder Visit-Aufgaben mit Spiegelabgleich und Einzelaudit.';

NOTIFY pgrst, 'reload schema';
