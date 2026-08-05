-- CareSuite+ 0272 — Verwaltungsprofil und doppelte Aufgabenwahrheit reparieren.
-- Die Office-Nachbearbeitung zeigt bevorzugt assignment_tasks, waehrend der
-- bisherige Abschluss nur assist_visit_tasks validierte. Dieser RPC gleicht
-- beide Spiegel in derselben Transaktion ab und schliesst erst danach ab.

CREATE OR REPLACE FUNCTION public.admin_upsert_deferred_signature_client_document(
  p_tenant_id UUID,
  p_proof_id UUID,
  p_client_id UUID,
  p_title TEXT,
  p_actor_profile_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor UUID := public.resolve_current_profile_id();
  v_title TEXT;
BEGIN
  IF p_tenant_id IS DISTINCT FROM public.current_tenant_id() THEN
    RAISE EXCEPTION 'Mandant stimmt nicht überein';
  END IF;
  IF NOT (public.is_tenant_admin() OR public.has_permission('assist.execution.manage')) THEN
    RAISE EXCEPTION 'Keine Berechtigung';
  END IF;
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Angemeldetes Verwaltungsprofil konnte nicht zugeordnet werden';
  END IF;
  IF p_actor_profile_id IS NOT NULL AND p_actor_profile_id IS DISTINCT FROM v_actor THEN
    RAISE EXCEPTION 'Verwaltungsprofil stimmt nicht mit der Sitzung überein';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM public.assist_visit_proofs p
    JOIN public.assist_visits v
      ON v.tenant_id = p.tenant_id AND v.id = p.visit_id
    WHERE p.tenant_id = p_tenant_id
      AND p.id = p_proof_id
      AND v.client_id = p_client_id
      AND p.portal_visible = TRUE
      AND p.portal_release_status = 'pending_client_signature'
  ) THEN
    RAISE EXCEPTION 'Signaturanforderung ist nicht eindeutig dem Klienten zugeordnet';
  END IF;

  v_title := coalesce(nullif(trim(p_title), ''), 'Leistungsnachweis')
    || ' — Unterschrift ausstehend';

  INSERT INTO public.client_documents (
    id, tenant_id, client_id, title, file_name, mime_type, category,
    storage_path, portal_visible, status, sensitivity, source, uploaded_by,
    signed_at, signature_required, updated_at
  ) VALUES (
    p_proof_id, p_tenant_id, p_client_id, v_title,
    'unterschrift-' || p_proof_id::text || '.pending', 'application/pdf',
    'leistungsnachweis', NULL, TRUE, 'aktiv', 'care', 'assist_visit_proof',
    v_actor, NULL, TRUE, now()
  )
  ON CONFLICT (id) DO UPDATE SET
    title = EXCLUDED.title,
    file_name = EXCLUDED.file_name,
    storage_path = NULL,
    portal_visible = TRUE,
    status = 'aktiv',
    category = 'leistungsnachweis',
    signed_at = NULL,
    signature_required = TRUE,
    source = 'assist_visit_proof',
    uploaded_by = v_actor,
    updated_at = now();

  RETURN p_proof_id;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_upsert_deferred_signature_client_document(UUID, UUID, UUID, TEXT, UUID)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_upsert_deferred_signature_client_document(UUID, UUID, UUID, TEXT, UUID)
  TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_reconcile_complete_assist_visit_follow_up(
  p_visit_id UUID,
  p_task_states JSONB,
  p_reason TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v public.assist_visits%ROWTYPE;
  v_actor UUID := public.resolve_current_profile_id();
  v_assignment_id UUID;
  v_item JSONB;
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

    SELECT t.title, t.sort_order INTO v_title, v_sort_order
    FROM public.assist_visit_tasks t
    WHERE t.tenant_id = v.tenant_id AND t.visit_id = v.id AND t.id = v_source_id;

    IF v_title IS NULL AND to_regclass('public.assignment_tasks') IS NOT NULL THEN
      SELECT t.title, t.sort_order INTO v_title, v_sort_order
      FROM public.assignment_tasks t
      WHERE t.tenant_id = v.tenant_id
        AND t.assignment_id = v_assignment_id
        AND t.id = v_source_id;
    END IF;
    IF v_title IS NULL THEN RAISE EXCEPTION 'Aufgabe nicht gefunden'; END IF;

    UPDATE public.assist_visit_tasks t
    SET
      status = v_status,
      not_done_reason = CASE WHEN v_status = 'done' THEN NULL ELSE trim(p_reason) END,
      completed_at = CASE WHEN v_status = 'done' THEN coalesce(t.completed_at, now()) ELSE NULL END,
      updated_at = now()
    WHERE t.tenant_id = v.tenant_id
      AND t.visit_id = v.id
      AND (t.id = v_source_id OR (t.title = v_title AND t.sort_order = v_sort_order));

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
        AND (t.id = v_source_id OR (t.title = v_title AND t.sort_order = v_sort_order));
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
$$;

REVOKE ALL ON FUNCTION public.admin_reconcile_complete_assist_visit_follow_up(UUID, JSONB, TEXT)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_reconcile_complete_assist_visit_follow_up(UUID, JSONB, TEXT)
  TO authenticated;

NOTIFY pgrst, 'reload schema';
