-- P0 — Fix repair_assist_visit_workflow_status mirror failures from employee portal.
-- Root cause: p_actor_employee_id is often an employees.id, but assignments.updated_by
-- references profiles.id; assignment_audit_events.actor_name is NOT NULL.

CREATE OR REPLACE FUNCTION public.repair_assist_visit_workflow_status(
  p_tenant_id                         UUID,
  p_assignment_id                     UUID,
  p_target_status                     TEXT,
  p_reason                            TEXT DEFAULT 'workflow_repair',
  p_actor_employee_id                 UUID DEFAULT NULL,
  p_allow_service_without_timestamp   BOOLEAN DEFAULT FALSE
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status           RECORD;
  v_from_status      TEXT;
  v_visit_id         UUID;
  v_service_started  TIMESTAMPTZ;
  v_execution_status TEXT;
  v_actor_profile_id UUID;
  v_actor_name       TEXT;
BEGIN
  IF p_tenant_id IS NULL OR p_assignment_id IS NULL OR p_target_status IS NULL THEN
    RAISE EXCEPTION 'repair_assist_visit_workflow_status: missing required parameters';
  END IF;

  SELECT a.status::TEXT
  INTO v_from_status
  FROM public.assignments a
  WHERE a.tenant_id = p_tenant_id
    AND a.id = p_assignment_id;

  IF v_from_status IS NULL THEN
    RAISE EXCEPTION 'Assignment not found';
  END IF;

  SELECT *
  INTO v_status
  FROM public.normalize_assist_workflow_repair_status(p_target_status);

  IF v_status.is_in_service AND NOT p_allow_service_without_timestamp THEN
    SELECT av.id, es.service_started_at
    INTO v_visit_id, v_service_started
    FROM public.assist_visits av
    LEFT JOIN public.assist_visit_execution_state es
      ON es.tenant_id = av.tenant_id AND es.visit_id = av.id
    WHERE av.tenant_id = p_tenant_id
      AND (av.legacy_assignment_id = p_assignment_id OR av.id = p_assignment_id)
    ORDER BY av.created_at DESC
    LIMIT 1;

    IF v_service_started IS NULL THEN
      RAISE EXCEPTION
        'Cannot repair to in-service status (%) without service_started_at; set p_allow_service_without_timestamp for explicit admin time correction',
        p_target_status;
    END IF;
  END IF;

  v_execution_status := CASE v_status.german_status
    WHEN 'unterwegs' THEN 'on_way'
    WHEN 'angekommen' THEN 'arrived'
    WHEN 'gestartet' THEN 'in_progress'
    WHEN 'pausiert' THEN 'paused'
    WHEN 'beendet' THEN 'completed'
    WHEN 'dokumentation_offen' THEN 'completed'
    WHEN 'unterschrift_offen' THEN 'completed'
    WHEN 'abgeschlossen' THEN 'completed'
    WHEN 'nicht_erschienen' THEN 'no_show'
    WHEN 'storniert' THEN 'cancelled'
    ELSE 'pending'
  END;

  v_actor_profile_id := NULL;
  IF p_actor_employee_id IS NOT NULL THEN
    SELECT p.id, COALESCE(NULLIF(trim(p.display_name), ''), NULLIF(trim(p.full_name), ''), 'Portal')
    INTO v_actor_profile_id, v_actor_name
    FROM public.profiles p
    WHERE p.id = p_actor_employee_id;
  END IF;

  IF v_actor_name IS NULL THEN
    v_actor_name := CASE
      WHEN p_reason = 'portal_execution_status_mirror' THEN 'Portal Mirror'
      ELSE 'Workflow Repair'
    END;
  END IF;

  IF v_from_status IS DISTINCT FROM v_status.visit_status THEN
    UPDATE public.assignments
    SET
      status     = v_status.assignment_enum,
      updated_at = NOW(),
      updated_by = v_actor_profile_id
    WHERE tenant_id = p_tenant_id
      AND id = p_assignment_id;
  END IF;

  UPDATE public.assist_visits
  SET
    execution_status = v_execution_status,
    canonical_status = v_status.visit_status,
    updated_at       = NOW(),
    updated_by       = v_actor_profile_id
  WHERE tenant_id = p_tenant_id
    AND (legacy_assignment_id = p_assignment_id OR id = p_assignment_id);

  UPDATE public.assist_visit_execution_state es
  SET
    assignment_status           = v_status.german_status,
    workflow_consistency_status = 'consistent',
    last_auto_repair_at         = NOW(),
    last_repair_reason          = p_reason,
    updated_at                  = NOW()
  FROM public.assist_visits av
  WHERE av.tenant_id = p_tenant_id
    AND (av.legacy_assignment_id = p_assignment_id OR av.id = p_assignment_id)
    AND es.tenant_id = av.tenant_id
    AND es.visit_id = av.id;

  INSERT INTO public.assignment_audit_events (
    tenant_id,
    assignment_id,
    action,
    actor_profile_id,
    actor_name,
    from_status,
    to_status,
    details,
    created_at
  )
  VALUES (
    p_tenant_id,
    p_assignment_id,
    'workflow_repair',
    v_actor_profile_id,
    v_actor_name,
    v_from_status,
    v_status.visit_status,
    p_reason,
    NOW()
  );
END;
$$;

COMMENT ON FUNCTION public.repair_assist_visit_workflow_status IS
  'P0 — Mirror assignments.status into assist_visits; safe actor FK for portal mirror';
