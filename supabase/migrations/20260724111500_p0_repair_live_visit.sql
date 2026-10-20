-- P0 2026-07-24: repair the active Kathrin Pott / Ellen Zacharias occurrence.
-- Confirmed operational start: 2026-07-24 09:25 Europe/Berlin.
--
-- The route id can be either assist_visits.id or assignments.id. The migration
-- resolves both forms and is idempotent. It preserves any end/completion state.

DO $$
DECLARE
  v_route_id UUID := '0cc1b0a9-bd8f-4b5e-b453-2e78007b52ab';
  v_visit_id UUID;
  v_assignment_id UUID;
  v_tenant_id UUID;
  v_started_at TIMESTAMPTZ := '2026-07-24 09:25:00+02';
  v_changed INTEGER := 0;
BEGIN
  SELECT av.id, av.legacy_assignment_id, av.tenant_id
    INTO v_visit_id, v_assignment_id, v_tenant_id
    FROM public.assist_visits av
   WHERE av.id = v_route_id
      OR av.legacy_assignment_id = v_route_id
   ORDER BY CASE WHEN av.id = v_route_id THEN 0 ELSE 1 END
   LIMIT 1;

  IF v_visit_id IS NULL THEN
    RAISE NOTICE 'P0 live visit repair skipped: route id % was not found', v_route_id;
    RETURN;
  END IF;

  UPDATE public.assist_visits
     SET actual_start_at = v_started_at,
         execution_status = CASE
           WHEN actual_end_at IS NULL
            AND execution_status IN ('pending', 'planned', 'confirmed', 'on_the_way', 'arrived')
             THEN 'started'
           ELSE execution_status
         END,
         canonical_status = CASE
           WHEN actual_end_at IS NULL
            AND canonical_status IN ('pending', 'planned', 'confirmed', 'on_the_way', 'arrived')
             THEN 'started'
           ELSE canonical_status
         END,
         updated_at = NOW()
   WHERE tenant_id = v_tenant_id
     AND id = v_visit_id;

  IF v_assignment_id IS NOT NULL THEN
    UPDATE public.assignments
       SET actual_start_at = v_started_at,
           status = CASE
             WHEN actual_end_at IS NULL
              AND status IN (
                'planned'::public.assignment_status,
                'confirmed'::public.assignment_status,
                'on_the_way'::public.assignment_status,
                'arrived'::public.assignment_status
              )
               THEN 'started'::public.assignment_status
             ELSE status
           END,
           updated_at = NOW()
     WHERE tenant_id = v_tenant_id
       AND id = v_assignment_id;
  END IF;

  WITH latest_current_start AS (
    SELECT e.id
      FROM public.assist_time_events e
     WHERE e.tenant_id = v_tenant_id
       AND e.visit_id = v_visit_id
       AND e.event_type = 'service_start'
       AND e.occurred_at >= '2026-07-24 00:00:00+02'::TIMESTAMPTZ
       AND e.occurred_at < '2026-07-25 00:00:00+02'::TIMESTAMPTZ
     ORDER BY e.occurred_at DESC
     LIMIT 1
  )
  UPDATE public.assist_time_events e
     SET occurred_at = v_started_at,
         metadata = COALESCE(e.metadata, '{}'::JSONB)
           || jsonb_build_object(
                'corrected_by_migration', '20260724111500_p0_repair_live_visit',
                'confirmed_start_local', '09:25'
              )
    FROM latest_current_start current_start
   WHERE e.id = current_start.id;

  GET DIAGNOSTICS v_changed = ROW_COUNT;

  IF v_changed = 0 THEN
    INSERT INTO public.assist_time_events (
      tenant_id,
      visit_id,
      event_type,
      occurred_at,
      metadata
    )
    VALUES (
      v_tenant_id,
      v_visit_id,
      'service_start',
      v_started_at,
      jsonb_build_object(
        'corrected_by_migration', '20260724111500_p0_repair_live_visit',
        'confirmed_start_local', '09:25'
      )
    );
  END IF;

  UPDATE public.assist_visit_execution_state
     SET service_started_at = v_started_at,
         assignment_status = CASE
           WHEN service_ended_at IS NULL
            AND COALESCE(assignment_status, '') NOT IN (
              'beendet',
              'dokumentation_offen',
              'unterschrift_offen',
              'abgeschlossen',
              'storniert',
              'nicht_erschienen'
            )
             THEN 'gestartet'
           ELSE assignment_status
         END,
         current_step = CASE
           WHEN service_ended_at IS NULL
            AND current_step IN ('consent', 'en_route', 'arrived')
             THEN 'in_service'
           ELSE current_step
         END,
         updated_at = NOW()
   WHERE tenant_id = v_tenant_id
     AND visit_id = v_visit_id;
END
$$;
