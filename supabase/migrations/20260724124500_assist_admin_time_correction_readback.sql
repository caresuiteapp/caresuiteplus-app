-- P0 2026-07-24: administrative Zeitkorrekturen müssen beim Reload kanonisch
-- bleiben und dürfen nicht von älteren Ereignissen desselben Tages überlagert
-- werden.

CREATE OR REPLACE FUNCTION public.normalize_administrative_assist_time_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_visit public.assist_visits%ROWTYPE;
  v_day_start TIMESTAMPTZ;
  v_day_end TIMESTAMPTZ;
  v_wfm_event_type TEXT;
BEGIN
  IF coalesce(NEW.metadata->>'source', '') <> 'administrative_follow_up' THEN
    RETURN NEW;
  END IF;

  SELECT *
  INTO v_visit
  FROM public.assist_visits
  WHERE id = NEW.visit_id
    AND tenant_id = NEW.tenant_id;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  v_day_start :=
    date_trunc('day', NEW.occurred_at AT TIME ZONE 'Europe/Berlin')
      AT TIME ZONE 'Europe/Berlin';
  v_day_end := v_day_start + INTERVAL '1 day';

  -- Der administrative Datensatz ist für diesen Einsatztag verbindlich.
  -- Beim ersten Ereignis einer Gruppe werden alte Portal-/Legacy-Ereignisse
  -- entfernt; die danach in derselben Transaktion eingefügten Admin-Ereignisse
  -- bleiben erhalten.
  IF NEW.event_type = 'drive_start' THEN
    DELETE FROM public.assist_time_events
    WHERE tenant_id = NEW.tenant_id
      AND visit_id = NEW.visit_id
      AND id <> NEW.id
      AND occurred_at >= v_day_start
      AND occurred_at < v_day_end
      AND (
        event_type = 'drive_start'
        OR (
          event_type IN ('drive_end', 'arrive', 'arrived_without_gps', 'arrived_manual')
          AND coalesce(metadata->>'source', '') <> 'administrative_follow_up'
        )
      );
  ELSIF NEW.event_type = 'arrive' THEN
    DELETE FROM public.assist_time_events
    WHERE tenant_id = NEW.tenant_id
      AND visit_id = NEW.visit_id
      AND id <> NEW.id
      AND occurred_at >= v_day_start
      AND occurred_at < v_day_end
      AND (
        event_type IN ('arrive', 'arrived_without_gps', 'arrived_manual')
        OR (
          event_type = 'drive_end'
          AND coalesce(metadata->>'source', '') <> 'administrative_follow_up'
        )
      );
  ELSIF NEW.event_type = 'service_start' THEN
    DELETE FROM public.assist_time_events
    WHERE tenant_id = NEW.tenant_id
      AND visit_id = NEW.visit_id
      AND id <> NEW.id
      AND occurred_at >= v_day_start
      AND occurred_at < v_day_end
      AND (
        event_type = 'service_start'
        OR (
          event_type = 'service_end'
          AND coalesce(metadata->>'source', '') <> 'administrative_follow_up'
        )
      );
  ELSIF NEW.event_type = 'service_end' THEN
    DELETE FROM public.assist_time_events
    WHERE tenant_id = NEW.tenant_id
      AND visit_id = NEW.visit_id
      AND id <> NEW.id
      AND occurred_at >= v_day_start
      AND occurred_at < v_day_end
      AND event_type = 'service_end';
  END IF;

  UPDATE public.assist_visits
  SET
    on_the_way_at = CASE
      WHEN NEW.event_type = 'drive_start' THEN NEW.occurred_at
      ELSE on_the_way_at
    END,
    arrived_at = CASE
      WHEN NEW.event_type IN ('arrive', 'arrived_without_gps', 'arrived_manual')
        THEN NEW.occurred_at
      ELSE arrived_at
    END,
    actual_start_at = CASE
      WHEN NEW.event_type = 'service_start' THEN NEW.occurred_at
      ELSE actual_start_at
    END,
    actual_end_at = CASE
      WHEN NEW.event_type = 'service_end' THEN NEW.occurred_at
      ELSE actual_end_at
    END,
    finished_at = CASE
      WHEN NEW.event_type = 'service_end' THEN NEW.occurred_at
      ELSE finished_at
    END,
    updated_at = NOW()
  WHERE tenant_id = NEW.tenant_id
    AND id = NEW.visit_id;

  UPDATE public.assignments
  SET
    on_the_way_at = CASE
      WHEN NEW.event_type = 'drive_start' THEN NEW.occurred_at
      ELSE on_the_way_at
    END,
    arrived_at = CASE
      WHEN NEW.event_type IN ('arrive', 'arrived_without_gps', 'arrived_manual')
        THEN NEW.occurred_at
      ELSE arrived_at
    END,
    actual_start_at = CASE
      WHEN NEW.event_type = 'service_start' THEN NEW.occurred_at
      ELSE actual_start_at
    END,
    actual_end_at = CASE
      WHEN NEW.event_type = 'service_end' THEN NEW.occurred_at
      ELSE actual_end_at
    END,
    finished_at = CASE
      WHEN NEW.event_type = 'service_end' THEN NEW.occurred_at
      ELSE finished_at
    END,
    updated_at = NOW()
  WHERE tenant_id = NEW.tenant_id
    AND (
      id = NEW.visit_id
      OR id = v_visit.legacy_assignment_id
    );

  UPDATE public.assist_visit_execution_state
  SET
    travel_started_at = CASE
      WHEN NEW.event_type = 'drive_start' THEN NEW.occurred_at
      ELSE travel_started_at
    END,
    travel_ended_at = CASE
      WHEN NEW.event_type IN ('arrive', 'arrived_without_gps', 'arrived_manual')
        THEN NEW.occurred_at
      ELSE travel_ended_at
    END,
    service_started_at = CASE
      WHEN NEW.event_type = 'service_start' THEN NEW.occurred_at
      ELSE service_started_at
    END,
    service_ended_at = CASE
      WHEN NEW.event_type = 'service_end' THEN NEW.occurred_at
      ELSE service_ended_at
    END,
    updated_at = NOW()
  WHERE tenant_id = NEW.tenant_id
    AND visit_id = NEW.visit_id;

  v_wfm_event_type := CASE NEW.event_type
    WHEN 'drive_start' THEN 'visit_drive_start'
    WHEN 'arrive' THEN 'visit_arrived'
    WHEN 'arrived_without_gps' THEN 'visit_arrived'
    WHEN 'arrived_manual' THEN 'visit_arrived'
    WHEN 'service_start' THEN 'visit_started'
    WHEN 'service_end' THEN 'visit_ended'
    ELSE NULL
  END;

  IF v_wfm_event_type IS NOT NULL THEN
    UPDATE public.workforce_time_events
    SET
      occurred_at = NEW.occurred_at,
      note = coalesce(NEW.metadata->>'reason', note),
      metadata = coalesce(metadata, '{}'::JSONB)
        || jsonb_build_object(
          'source', 'administrative_follow_up',
          'canonical_assist_event_id', NEW.id
        )
    WHERE tenant_id = NEW.tenant_id
      AND employee_id = v_visit.employee_id
      AND reference_type = 'visit'
      AND reference_id = NEW.visit_id
      AND event_type = v_wfm_event_type;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS normalize_administrative_assist_time_event_trigger
  ON public.assist_time_events;
CREATE TRIGGER normalize_administrative_assist_time_event_trigger
AFTER INSERT ON public.assist_time_events
FOR EACH ROW
EXECUTE FUNCTION public.normalize_administrative_assist_time_event();

COMMENT ON FUNCTION public.normalize_administrative_assist_time_event() IS
  'Macht administrative Assist-Zeitkorrekturen beim anschließenden Reload zur kanonischen Quelle.';

NOTIFY pgrst, 'reload schema';
