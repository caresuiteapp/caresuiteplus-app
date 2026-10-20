-- ==========================================================================
-- CareSuite+ — Migration 0213: Fix repair_assist_visit_workflow_status enum cast
-- Root cause: 0212 assigned TEXT to assignments.status (assignment_status enum).
-- ==========================================================================
--
-- TEST CASES (manual / audit-assist-repair-rpc-enum.ts):
-- 1. Repair to arrived (German angekommen or English arrived) → OK
-- 2. Repair to en_route (German unterwegs or workflow step en_route) → OK
-- 3. Repair to in_service/started/gestartet without service_started_at → REJECT
--    unless p_allow_service_without_timestamp = TRUE (admin time correction)
-- 4. Invalid status (e.g. bogus_status) → EXCEPTION with clear message
-- 5. No timestamp columns modified — defective records never get invented times
-- 6. assignment_audit_events row written on successful repair
--
-- FIX MARKER: ASSIST.STABILIZE.1.0213

-- Drop prior 5-arg signature from migration 0212 (TEXT assignment without enum cast).
DROP FUNCTION IF EXISTS public.repair_assist_visit_workflow_status(UUID, UUID, TEXT, TEXT, UUID);

-- --------------------------------------------------------------------------
-- Central status normalization for workflow repair RPC
-- Accepts: German app status, English assignment_status enum, workflow step aliases
-- Returns: typed values for each target column
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.normalize_assist_workflow_repair_status(
  p_target_status TEXT
)
RETURNS TABLE (
  assignment_enum   public.assignment_status,
  visit_status      TEXT,
  german_status     TEXT,
  is_in_service     BOOLEAN
)
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  v_input TEXT;
BEGIN
  IF p_target_status IS NULL OR trim(p_target_status) = '' THEN
    RAISE EXCEPTION 'normalize_assist_workflow_repair_status: p_target_status is required';
  END IF;

  v_input := lower(trim(p_target_status));

  RETURN QUERY
  SELECT m.assignment_enum, m.visit_status, m.german_status, m.is_in_service
  FROM (
    VALUES
      -- German app statuses (AssignmentStatus)
      ('geplant',              'planned'::public.assignment_status,              'planned',              'geplant',              FALSE),
      ('bestaetigt',           'confirmed'::public.assignment_status,            'confirmed',            'bestaetigt',           FALSE),
      ('unterwegs',            'on_the_way'::public.assignment_status,           'on_the_way',           'unterwegs',            FALSE),
      ('angekommen',           'arrived'::public.assignment_status,              'arrived',              'angekommen',           FALSE),
      ('gestartet',            'started'::public.assignment_status,              'started',              'gestartet',            TRUE),
      ('pausiert',             'paused'::public.assignment_status,               'paused',               'pausiert',             TRUE),
      ('beendet',              'finished'::public.assignment_status,             'finished',             'beendet',              TRUE),
      ('dokumentation_offen',  'documentation_open'::public.assignment_status,   'documentation_open',   'dokumentation_offen',  TRUE),
      ('unterschrift_offen',   'signature_open'::public.assignment_status,       'signature_open',       'unterschrift_offen',   TRUE),
      ('abgeschlossen',        'completed'::public.assignment_status,            'completed',            'abgeschlossen',        FALSE),
      ('storniert',            'cancelled'::public.assignment_status,            'cancelled',            'storniert',            FALSE),
      ('nicht_erschienen',     'no_show'::public.assignment_status,              'no_show',              'nicht_erschienen',     FALSE),
      -- English assignment_status enum values
      ('planned',              'planned'::public.assignment_status,              'planned',              'geplant',              FALSE),
      ('confirmed',            'confirmed'::public.assignment_status,            'confirmed',            'bestaetigt',           FALSE),
      ('on_the_way',           'on_the_way'::public.assignment_status,           'on_the_way',           'unterwegs',            FALSE),
      ('arrived',              'arrived'::public.assignment_status,              'arrived',              'angekommen',           FALSE),
      ('started',              'started'::public.assignment_status,              'started',              'gestartet',            TRUE),
      ('paused',               'paused'::public.assignment_status,               'paused',               'pausiert',             TRUE),
      ('finished',             'finished'::public.assignment_status,             'finished',             'beendet',              TRUE),
      ('documentation_open',   'documentation_open'::public.assignment_status,   'documentation_open',   'dokumentation_offen',  TRUE),
      ('signature_open',       'signature_open'::public.assignment_status,       'signature_open',       'unterschrift_offen',   TRUE),
      ('completed',            'completed'::public.assignment_status,            'completed',            'abgeschlossen',        FALSE),
      ('cancelled',            'cancelled'::public.assignment_status,            'cancelled',            'storniert',            FALSE),
      ('no_show',              'no_show'::public.assignment_status,              'no_show',              'nicht_erschienen',     FALSE),
      -- Workflow step aliases (assist_visit_execution_state.current_step vocabulary)
      ('en_route',             'on_the_way'::public.assignment_status,           'on_the_way',           'unterwegs',            FALSE),
      ('in_service',           'started'::public.assignment_status,              'started',              'gestartet',            TRUE),
      ('in_progress',          'started'::public.assignment_status,              'started',              'gestartet',            TRUE)
  ) AS m(input_key, assignment_enum, visit_status, german_status, is_in_service)
  WHERE m.input_key = v_input
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION
      'Invalid repair target status "%": allowed German (geplant…angekommen…gestartet), English enum (planned…arrived…started), or workflow steps (en_route, in_service)',
      p_target_status;
  END IF;
END;
$$;

COMMENT ON FUNCTION public.normalize_assist_workflow_repair_status(TEXT) IS
  'ASSIST.STABILIZE.1.0213 — validates and maps repair target status to column-specific values';

GRANT EXECUTE ON FUNCTION public.normalize_assist_workflow_repair_status(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.normalize_assist_workflow_repair_status(TEXT) TO service_role;

-- --------------------------------------------------------------------------
-- Fixed repair RPC — typed writes, guarded in-service repair, audit log
-- --------------------------------------------------------------------------
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
      AND av.legacy_assignment_id = p_assignment_id
    ORDER BY av.created_at DESC
    LIMIT 1;

    IF v_service_started IS NULL THEN
      RAISE EXCEPTION
        'Cannot repair to in-service status (%) without service_started_at; set p_allow_service_without_timestamp for explicit admin time correction',
        p_target_status;
    END IF;
  END IF;

  UPDATE public.assignments
  SET
    status     = v_status.assignment_enum,
    updated_at = NOW(),
    updated_by = p_actor_employee_id
  WHERE tenant_id = p_tenant_id
    AND id = p_assignment_id;

  UPDATE public.assist_visits
  SET
    execution_status = v_status.visit_status,
    canonical_status = v_status.visit_status,
    updated_at       = NOW(),
    updated_by       = p_actor_employee_id
  WHERE tenant_id = p_tenant_id
    AND legacy_assignment_id = p_assignment_id;

  UPDATE public.assist_visit_execution_state es
  SET
    assignment_status           = v_status.german_status,
    workflow_consistency_status = 'consistent',
    last_auto_repair_at         = NOW(),
    last_repair_reason          = p_reason,
    updated_at                  = NOW()
  FROM public.assist_visits av
  WHERE av.tenant_id = p_tenant_id
    AND av.legacy_assignment_id = p_assignment_id
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
    details
  )
  VALUES (
    p_tenant_id,
    p_assignment_id,
    'workflow_repair',
    p_actor_employee_id,
    COALESCE(
      (
        SELECT trim(COALESCE(e.first_name, '') || ' ' || COALESCE(e.last_name, ''))
        FROM public.employees e
        WHERE e.id = p_actor_employee_id
        LIMIT 1
      ),
      'System'
    ),
    v_from_status,
    v_status.visit_status,
    COALESCE(p_reason, 'workflow_repair')
  );
END;
$$;

REVOKE ALL ON FUNCTION public.repair_assist_visit_workflow_status(UUID, UUID, TEXT, TEXT, UUID, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.repair_assist_visit_workflow_status(UUID, UUID, TEXT, TEXT, UUID, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.repair_assist_visit_workflow_status(UUID, UUID, TEXT, TEXT, UUID, BOOLEAN) TO service_role;

COMMENT ON FUNCTION public.repair_assist_visit_workflow_status(UUID, UUID, TEXT, TEXT, UUID, BOOLEAN) IS
  'ASSIST.STABILIZE.1.0213 — timestamp-driven workflow repair with validated enum cast';
