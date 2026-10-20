-- Authorization repair for the existing assignment workspace RPCs.
-- Function bodies below retain the production lifecycle/budget behavior.
-- No business rows are changed by this migration.
BEGIN;

CREATE OR REPLACE FUNCTION public.delete_assist_visit(p_tenant_id uuid, p_visit_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_visit public.assist_visits%ROWTYPE;
  v_legacy_assignment_id UUID;
  v_deleted_visit_id UUID;
  v_reservation RECORD;
  v_balance_after BIGINT;
  v_released_reservations INTEGER := 0;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501',
      MESSAGE = 'Anmeldung erforderlich.';
  END IF;

  IF p_tenant_id IS NULL OR p_visit_id IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = '22004',
      MESSAGE = 'Mandant und Einsatz müssen angegeben werden.';
  END IF;

  IF p_tenant_id IS DISTINCT FROM public.current_tenant_id()
    OR NOT COALESCE(public.is_tenant_member(p_tenant_id), false)
    OR NOT COALESCE(care_security.company_actor(p_tenant_id, 'assist.assignments.manage'), false) THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501',
      MESSAGE = 'Keine Berechtigung für diesen Mandanten.';
  END IF;

  SELECT *
    INTO v_visit
    FROM public.assist_visits
   WHERE tenant_id = p_tenant_id
     AND id = p_visit_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0002',
      MESSAGE = 'Einsatz nicht gefunden.';
  END IF;

  v_legacy_assignment_id := v_visit.legacy_assignment_id;

  FOR v_reservation IN
    SELECT tx.*
      FROM public.client_budget_transactions tx
     WHERE tx.tenant_id = p_tenant_id
       AND tx.reference_type = 'assist_visit'
       AND tx.reference_id = p_visit_id
       AND tx.transaction_type = 'reservation'
       AND COALESCE(tx.lifecycle_status, 'geplant') IN ('geplant', 'durchgefuehrt')
     FOR UPDATE
  LOOP
    IF COALESCE(v_reservation.lifecycle_status, 'geplant') = 'durchgefuehrt' THEN
      UPDATE public.client_budget_accounts
         SET used_cents = GREATEST(0, used_cents - v_reservation.amount_cents),
             updated_at = NOW()
       WHERE tenant_id = p_tenant_id
         AND id = v_reservation.budget_account_id
      RETURNING allocated_cents - used_cents - reserved_cents INTO v_balance_after;
    ELSE
      UPDATE public.client_budget_accounts
         SET reserved_cents = GREATEST(0, reserved_cents - v_reservation.amount_cents),
             updated_at = NOW()
       WHERE tenant_id = p_tenant_id
         AND id = v_reservation.budget_account_id
      RETURNING allocated_cents - used_cents - reserved_cents INTO v_balance_after;
    END IF;

    UPDATE public.client_budget_transactions
       SET lifecycle_status = 'storniert',
           note = COALESCE(note, '') ||
             CASE WHEN COALESCE(note, '') = '' THEN '' ELSE ' · ' END ||
             'Einsatz aus Einsatzplanung gelöscht'
     WHERE id = v_reservation.id;

    INSERT INTO public.client_budget_transactions (
      tenant_id,
      client_id,
      budget_account_id,
      transaction_type,
      amount_cents,
      balance_after_cents,
      reference_type,
      reference_id,
      lifecycle_status,
      note,
      created_by
    ) VALUES (
      p_tenant_id,
      v_reservation.client_id,
      v_reservation.budget_account_id,
      'release',
      v_reservation.amount_cents,
      v_balance_after,
      'assist_visit',
      p_visit_id,
      'storniert',
      'Planbetrag durch Löschen des Einsatzes freigegeben',
      NULL
    );

    v_released_reservations := v_released_reservations + 1;
  END LOOP;

  UPDATE public.assignment_budget_allocations
     SET allocation_status = 'released',
         reserved_amount_cents = 0,
         updated_at = NOW()
   WHERE tenant_id = p_tenant_id
     AND assignment_id = p_visit_id
     AND allocation_status IN ('planned', 'reserved', 'executed');

  DELETE FROM public.assist_visits
   WHERE tenant_id = p_tenant_id
     AND id = p_visit_id
  RETURNING id INTO v_deleted_visit_id;

  IF v_deleted_visit_id IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0002',
      MESSAGE = 'Einsatz konnte nicht gelöscht werden.';
  END IF;

  IF v_legacy_assignment_id IS NOT NULL THEN
    DELETE FROM public.assignments
     WHERE tenant_id = p_tenant_id
       AND id = v_legacy_assignment_id;
  END IF;

  RETURN jsonb_build_object(
    'deleted', TRUE,
    'visitId', v_deleted_visit_id,
    'legacyAssignmentId', v_legacy_assignment_id,
    'budgetReservationsReleased', v_released_reservations
  );
END;
$function$
;
REVOKE ALL ON FUNCTION public.delete_assist_visit(uuid,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_assist_visit(uuid,uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.set_assignment_status(input_assignment_id uuid, input_status assignment_status, input_employee_id uuid DEFAULT NULL::uuid, input_latitude numeric DEFAULT NULL::numeric, input_longitude numeric DEFAULT NULL::numeric, input_note text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_assignment public.assignments;
  v_time_entry_type public.time_entry_type;
begin
  IF auth.uid() IS NULL OR public.current_tenant_id() IS NULL THEN
    RAISE EXCEPTION 'Anmeldung und Mandant erforderlich.' USING ERRCODE='42501';
  END IF;
  IF input_assignment_id IS NULL OR input_status IS NULL THEN
    RAISE EXCEPTION 'Einsatz und Status erforderlich.' USING ERRCODE='22023';
  END IF;

  select *
  into v_assignment
  from public.assignments
  where id = input_assignment_id
    AND tenant_id = public.current_tenant_id()
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Einsatz nicht verfügbar oder nicht zugeordnet.' USING ERRCODE='42501';
  END IF;
  IF NOT COALESCE(public.is_tenant_member(v_assignment.tenant_id), false) THEN
    RAISE EXCEPTION 'Keine Berechtigung für diesen Mandanten.' USING ERRCODE='42501';
  END IF;
  IF NOT (
    COALESCE(care_security.company_actor(v_assignment.tenant_id, 'assist.assignments.manage'), false)
    OR COALESCE(care_security.company_actor(v_assignment.tenant_id, 'assist.execution.manage'), false)
  ) THEN
    IF COALESCE(public.current_portal_type(), '') <> 'employee'
      OR v_assignment.employee_id IS NULL
      OR v_assignment.employee_id IS DISTINCT FROM public.resolve_current_employee_id()
      OR NOT EXISTS (
        SELECT 1 FROM public.employee_portal_accounts e
        JOIN public.employees employee ON employee.id = e.employee_id AND employee.tenant_id = e.tenant_id
        WHERE e.id = public.current_portal_account_id()
          AND e.auth_user_id = auth.uid()
          AND e.tenant_id = v_assignment.tenant_id
          AND e.employee_id = v_assignment.employee_id
          AND e.status = 'active'
          AND employee.status::text IN ('active', 'aktiv')
          AND employee.deleted_at IS NULL
          AND (employee.profile_id IS NULL OR EXISTS (
            SELECT 1 FROM public.profiles profile
            WHERE profile.id = employee.profile_id AND profile.tenant_id = employee.tenant_id
              AND profile.status::text = 'active' AND profile.is_active IS TRUE
          ))
      ) THEN
      RAISE EXCEPTION 'Keine Berechtigung für diesen Einsatz.' USING ERRCODE='42501';
    END IF;
  END IF;
  IF input_employee_id IS NOT NULL AND input_employee_id IS DISTINCT FROM v_assignment.employee_id THEN
    RAISE EXCEPTION 'Mitarbeitendenzuordnung stimmt nicht überein.' USING ERRCODE='42501';
  END IF;

  update public.assignments
  set
    status = input_status,
    actual_start_at = case
      when input_status = 'started' and actual_start_at is null then now()
      else actual_start_at
    end,
    actual_end_at = case
      when input_status in ('finished','completed') and actual_end_at is null then now()
      else actual_end_at
    end,
    updated_at = now()
  where id = input_assignment_id
    AND tenant_id = v_assignment.tenant_id;

  v_time_entry_type :=
    case input_status
      when 'on_the_way' then 'on_the_way'::public.time_entry_type
      when 'arrived' then 'arrived'::public.time_entry_type
      when 'started' then 'started'::public.time_entry_type
      when 'paused' then 'paused'::public.time_entry_type
      when 'finished' then 'finished'::public.time_entry_type
      when 'completed' then 'finished'::public.time_entry_type
      else 'system'::public.time_entry_type
    end;

  insert into public.time_entries (
    tenant_id,
    assignment_id,
    employee_id,
    entry_type,
    event_at,
    latitude,
    longitude,
    source,
    note
  )
  values (
    v_assignment.tenant_id,
    input_assignment_id,
    coalesce(input_employee_id, v_assignment.employee_id),
    v_time_entry_type,
    now(),
    input_latitude,
    input_longitude,
    'rpc',
    input_note
  );

  return input_assignment_id;
end;
$function$
;
REVOKE ALL ON FUNCTION public.set_assignment_status(uuid,public.assignment_status,uuid,numeric,numeric,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_assignment_status(uuid,public.assignment_status,uuid,numeric,numeric,text) TO authenticated, service_role;

-- Direct task edits stop at signed/final visits. The explicit administrative
-- correction RPCs below retain their audited reconciliation behavior.
CREATE OR REPLACE FUNCTION care_security.assignment_task_visit_writable(p_tenant uuid,p_visit uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $body$
  SELECT auth.uid() IS NOT NULL AND p_tenant=public.current_tenant_id() AND EXISTS(
    SELECT 1 FROM public.assist_visits v WHERE v.tenant_id=p_tenant AND v.id=p_visit
      AND coalesce(v.canonical_status,'') NOT IN ('completed','cancelled','no_show')
      AND coalesce(v.proof_status,'') <> 'verified'
      AND NOT EXISTS(SELECT 1 FROM public.assist_visit_signatures s
        WHERE s.tenant_id=v.tenant_id AND s.visit_id=v.id AND s.is_valid)
      AND (coalesce(v.proof_status,'') <> 'signed' OR EXISTS(
        SELECT 1 FROM public.assist_visit_signatures s WHERE s.tenant_id=v.tenant_id AND s.visit_id=v.id
          AND s.is_valid IS FALSE AND s.invalidated_at IS NOT NULL
      ))
  )
$body$;
CREATE OR REPLACE FUNCTION care_security.assignment_task_legacy_writable(p_tenant uuid,p_assignment uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $body$
  SELECT auth.uid() IS NOT NULL AND p_tenant=public.current_tenant_id() AND EXISTS(
    SELECT 1 FROM public.assignments a WHERE a.tenant_id=p_tenant AND a.id=p_assignment
      AND a.status::text NOT IN ('completed','cancelled','no_show')
  ) AND NOT EXISTS(
    SELECT 1 FROM public.assist_visits v WHERE v.tenant_id=p_tenant
      AND (v.legacy_assignment_id=p_assignment OR v.id=p_assignment)
      AND NOT care_security.assignment_task_visit_writable(p_tenant,v.id)
  )
$body$;
REVOKE ALL ON FUNCTION care_security.assignment_task_visit_writable(uuid,uuid),
  care_security.assignment_task_legacy_writable(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION care_security.assignment_task_visit_writable(uuid,uuid),
  care_security.assignment_task_legacy_writable(uuid,uuid) TO authenticated,service_role;

DO $body$
DECLARE v_table text; v_operation text; v_predicate text;
BEGIN
  FOREACH v_table IN ARRAY ARRAY['assist_visit_tasks','assignment_tasks'] LOOP
    v_predicate:=CASE WHEN v_table='assist_visit_tasks'
      THEN 'care_security.assignment_task_visit_writable(tenant_id,visit_id)'
      ELSE 'care_security.assignment_task_legacy_writable(tenant_id,assignment_id)' END;
    FOREACH v_operation IN ARRAY ARRAY['INSERT','UPDATE','DELETE'] LOOP
      EXECUTE format('DROP POLICY IF EXISTS assignment_task_%s_ceiling ON public.%I',lower(v_operation),v_table);
      EXECUTE format('CREATE POLICY assignment_task_%s_ceiling ON public.%I AS RESTRICTIVE FOR %s TO authenticated %s %s',
        lower(v_operation),v_table,v_operation,
        CASE WHEN v_operation<>'INSERT' THEN 'USING('||v_predicate||')' ELSE '' END,
        CASE WHEN v_operation<>'DELETE' THEN 'WITH CHECK('||v_predicate||')' ELSE '' END);
    END LOOP;
  END LOOP;
END $body$;

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
    COALESCE(public.is_tenant_member(public.current_tenant_id()), false)
    AND COALESCE(care_security.company_actor(public.current_tenant_id(), 'assist.execution.manage'), false)
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
  IF NOT (COALESCE(public.is_tenant_member(public.current_tenant_id()), false)
    AND COALESCE(care_security.company_actor(public.current_tenant_id(), 'assist.execution.manage'), false)) THEN
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

CREATE OR REPLACE FUNCTION public.admin_update_assist_visit_task(p_visit_id uuid, p_task_id uuid, p_status text, p_reason text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_tenant uuid; v_old text;
BEGIN
  IF NOT (COALESCE(public.is_tenant_member(public.current_tenant_id()), false)
    AND COALESCE(care_security.company_actor(public.current_tenant_id(), 'assist.execution.manage'), false)) THEN RAISE EXCEPTION 'Keine Berechtigung'; END IF;
  IF p_status NOT IN ('open','done','partial','not_requested','not_possible','cancelled','deferred') THEN RAISE EXCEPTION 'Ung├╝ltiger Aufgabenstatus'; END IF;
  IF length(trim(coalesce(p_reason,'')))=0 THEN RAISE EXCEPTION 'Begr├╝ndung ist erforderlich'; END IF;
  SELECT v.tenant_id,t.status INTO v_tenant,v_old FROM public.assist_visits v JOIN public.assist_visit_tasks t
    ON t.visit_id=v.id AND t.tenant_id=v.tenant_id WHERE v.id=p_visit_id AND t.id=p_task_id
    AND v.tenant_id=public.current_tenant_id() FOR UPDATE OF t;
  IF NOT FOUND THEN RAISE EXCEPTION 'Aufgabe nicht gefunden'; END IF;
  UPDATE public.assist_visit_tasks SET status=p_status,
    not_done_reason=CASE WHEN p_status='done' THEN NULL ELSE p_reason END,
    completed_at=CASE WHEN p_status='done' THEN now() ELSE NULL END,updated_at=now() WHERE id=p_task_id AND tenant_id=v_tenant;
  INSERT INTO public.assist_visit_admin_audit(tenant_id,visit_id,action,previous_value,new_value,reason)
  VALUES(v_tenant,p_visit_id,'task_updated',jsonb_build_object('task_id',p_task_id,'status',v_old),jsonb_build_object('task_id',p_task_id,'status',p_status),p_reason);
END $function$
;

REVOKE ALL ON FUNCTION public.admin_update_assist_visit_task(uuid,uuid,text,text),
  public.admin_bulk_update_assist_visit_tasks(uuid,jsonb,text),
  public.admin_reconcile_complete_assist_visit_follow_up(uuid,jsonb,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_update_assist_visit_task(uuid,uuid,text,text),
  public.admin_bulk_update_assist_visit_tasks(uuid,jsonb,text),
  public.admin_reconcile_complete_assist_visit_follow_up(uuid,jsonb,text) TO authenticated;

COMMIT;

