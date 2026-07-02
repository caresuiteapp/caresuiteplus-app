-- P0 — Fix assist_visits mirror drift after portal workflow transitions.
-- Root cause: repair RPC treated beendet as in-service (blocked without service_started_at)
-- and wrote assignment enum values into execution_status instead of execution vocabulary.

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
      ('geplant',              'planned'::public.assignment_status,              'planned',              'geplant',              FALSE),
      ('bestaetigt',           'confirmed'::public.assignment_status,            'confirmed',            'bestaetigt',           FALSE),
      ('unterwegs',            'on_the_way'::public.assignment_status,           'on_the_way',           'unterwegs',            FALSE),
      ('angekommen',           'arrived'::public.assignment_status,              'arrived',              'angekommen',           FALSE),
      ('gestartet',            'started'::public.assignment_status,              'started',              'gestartet',            TRUE),
      ('pausiert',             'paused'::public.assignment_status,               'paused',               'pausiert',             TRUE),
      ('beendet',              'finished'::public.assignment_status,             'finished',             'beendet',              FALSE),
      ('dokumentation_offen',  'documentation_open'::public.assignment_status,   'documentation_open',   'dokumentation_offen',  FALSE),
      ('unterschrift_offen',   'signature_open'::public.assignment_status,       'signature_open',       'unterschrift_offen',   FALSE),
      ('abgeschlossen',        'completed'::public.assignment_status,            'completed',            'abgeschlossen',        FALSE),
      ('storniert',            'cancelled'::public.assignment_status,            'cancelled',            'storniert',            FALSE),
      ('nicht_erschienen',     'no_show'::public.assignment_status,              'no_show',              'nicht_erschienen',     FALSE),
      ('planned',              'planned'::public.assignment_status,              'planned',              'geplant',              FALSE),
      ('confirmed',            'confirmed'::public.assignment_status,            'confirmed',            'bestaetigt',           FALSE),
      ('on_the_way',           'on_the_way'::public.assignment_status,           'on_the_way',           'unterwegs',            FALSE),
      ('arrived',              'arrived'::public.assignment_status,              'arrived',              'angekommen',           FALSE),
      ('started',              'started'::public.assignment_status,              'started',              'gestartet',            TRUE),
      ('paused',               'paused'::public.assignment_status,               'paused',               'pausiert',             TRUE),
      ('finished',             'finished'::public.assignment_status,             'finished',             'beendet',              FALSE),
      ('documentation_open',   'documentation_open'::public.assignment_status,   'documentation_open',   'dokumentation_offen',  FALSE),
      ('signature_open',       'signature_open'::public.assignment_status,       'signature_open',       'unterschrift_offen',   FALSE),
      ('completed',            'completed'::public.assignment_status,            'completed',            'abgeschlossen',        FALSE),
      ('cancelled',            'cancelled'::public.assignment_status,            'cancelled',            'storniert',            FALSE),
      ('no_show',              'no_show'::public.assignment_status,              'no_show',              'nicht_erschienen',     FALSE),
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

  UPDATE public.assignments
  SET
    status     = v_status.assignment_enum,
    updated_at = NOW(),
    updated_by = p_actor_employee_id
  WHERE tenant_id = p_tenant_id
    AND id = p_assignment_id;

  UPDATE public.assist_visits
  SET
    execution_status = v_execution_status,
    canonical_status = v_status.visit_status,
    updated_at       = NOW(),
    updated_by       = p_actor_employee_id
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
    p_actor_employee_id,
    NULL,
    v_from_status,
    v_status.visit_status,
    p_reason,
    NOW()
  );
END;
$$;

COMMENT ON FUNCTION public.repair_assist_visit_workflow_status IS
  'P0 — Mirror assignments.status into assist_visits with correct execution_status vocabulary';
