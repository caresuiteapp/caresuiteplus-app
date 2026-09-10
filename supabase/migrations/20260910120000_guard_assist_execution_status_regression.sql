-- Prevent late asynchronous projections from moving a visit backwards.
-- A recorded service start is authoritative for all workflow mirrors.
BEGIN;

CREATE OR REPLACE FUNCTION public.guard_assist_visit_execution_regression()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.canonical_status IN ('planned','scheduled','confirmed','on_the_way','arrived')
     AND NEW.actual_start_at IS NOT NULL THEN
    IF OLD.canonical_status IN ('completed','cancelled','no_show') THEN
      NEW.canonical_status := OLD.canonical_status;
      NEW.execution_status := OLD.execution_status;
      RETURN NEW;
    END IF;
    IF NEW.actual_end_at IS NOT NULL OR NEW.finished_at IS NOT NULL THEN
      IF OLD.canonical_status IN ('finished','documentation_open','signature_open','completed') THEN
        NEW.canonical_status := OLD.canonical_status;
        NEW.execution_status := OLD.execution_status;
      ELSE
        NEW.canonical_status := 'finished';
        NEW.execution_status := 'completed';
      END IF;
    ELSE
      NEW.canonical_status := CASE WHEN OLD.canonical_status = 'paused' THEN 'paused' ELSE 'started' END;
      NEW.execution_status := CASE WHEN OLD.canonical_status = 'paused' THEN 'paused' ELSE 'in_progress' END;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_assist_visit_execution_regression ON public.assist_visits;
DROP TRIGGER IF EXISTS trg_zz_guard_assist_visit_execution_regression ON public.assist_visits;
-- Run after timestamp preservation so the guard sees the restored start.
CREATE TRIGGER trg_zz_guard_assist_visit_execution_regression
BEFORE UPDATE OF canonical_status, execution_status, actual_start_at, actual_end_at, finished_at
ON public.assist_visits
FOR EACH ROW EXECUTE FUNCTION public.guard_assist_visit_execution_regression();

CREATE OR REPLACE FUNCTION public.guard_assignment_execution_regression()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.status::TEXT IN ('planned','confirmed','on_the_way','arrived')
     AND NEW.actual_start_at IS NOT NULL THEN
    IF OLD.status::TEXT IN ('completed','cancelled','no_show') THEN
      NEW.status := OLD.status;
      RETURN NEW;
    END IF;
    IF NEW.actual_end_at IS NOT NULL OR NEW.finished_at IS NOT NULL THEN
      IF OLD.status::TEXT IN ('finished','documentation_open','signature_open','completed') THEN
        NEW.status := OLD.status;
      ELSE
        NEW.status := 'finished'::public.assignment_status;
      END IF;
    ELSE
      NEW.status := CASE WHEN OLD.status::TEXT = 'paused' THEN 'paused'::public.assignment_status ELSE 'started'::public.assignment_status END;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_assignment_execution_regression ON public.assignments;
CREATE TRIGGER trg_guard_assignment_execution_regression
BEFORE UPDATE OF status, actual_start_at, actual_end_at, finished_at
ON public.assignments
FOR EACH ROW EXECUTE FUNCTION public.guard_assignment_execution_regression();

CREATE OR REPLACE FUNCTION public.guard_assist_execution_state_regression()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.assignment_status IN ('geplant','bestaetigt','unterwegs','angekommen')
     AND NEW.service_started_at IS NOT NULL THEN
    IF OLD.assignment_status IN ('abgeschlossen','storniert','nicht_erschienen') THEN
      NEW.assignment_status := OLD.assignment_status;
      NEW.current_step := OLD.current_step;
      RETURN NEW;
    END IF;
    IF NEW.service_ended_at IS NOT NULL OR NEW.finalized_at IS NOT NULL THEN
      IF OLD.assignment_status IN ('beendet','dokumentation_offen','unterschrift_offen','abgeschlossen') THEN
        NEW.assignment_status := OLD.assignment_status;
        NEW.current_step := OLD.current_step;
      ELSE
        NEW.assignment_status := 'beendet';
        NEW.current_step := 'documentation';
      END IF;
    ELSE
      NEW.assignment_status := CASE WHEN OLD.assignment_status = 'pausiert' THEN 'pausiert' ELSE 'gestartet' END;
      NEW.current_step := CASE WHEN OLD.assignment_status = 'pausiert' THEN OLD.current_step ELSE 'in_service' END;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_assist_execution_state_regression ON public.assist_visit_execution_state;
CREATE TRIGGER trg_guard_assist_execution_state_regression
BEFORE UPDATE OF assignment_status, current_step, service_started_at, service_ended_at, finalized_at
ON public.assist_visit_execution_state
FOR EACH ROW EXECUTE FUNCTION public.guard_assist_execution_state_regression();

-- Repair already-started visits that a delayed arrival projection moved backwards.
UPDATE public.assist_visits v
SET canonical_status = 'started',
    execution_status = 'in_progress',
    updated_at = clock_timestamp()
WHERE coalesce(v.planning_status, '') NOT IN ('cancelled','draft')
  AND v.actual_start_at IS NOT NULL
  AND v.actual_end_at IS NULL
  AND v.finished_at IS NULL
  AND v.canonical_status IN ('planned','scheduled','confirmed','on_the_way','arrived')
  AND EXISTS (
    SELECT 1 FROM public.assist_time_events e
    WHERE e.tenant_id = v.tenant_id
      AND e.visit_id = v.id
      AND e.event_type = 'service_start'
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.assist_time_events e
    WHERE e.tenant_id = v.tenant_id
      AND e.visit_id = v.id
      AND e.event_type = 'service_end'
  );

UPDATE public.assignments a
SET status = 'started'::public.assignment_status,
    updated_at = clock_timestamp()
WHERE a.actual_start_at IS NOT NULL
  AND a.actual_end_at IS NULL
  AND a.finished_at IS NULL
  AND a.status::TEXT IN ('planned','confirmed','on_the_way','arrived')
  AND EXISTS (
    SELECT 1 FROM public.assist_time_events e
    WHERE e.tenant_id = a.tenant_id
      AND e.visit_id = a.id
      AND e.event_type = 'service_start'
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.assist_time_events e
    WHERE e.tenant_id = a.tenant_id
      AND e.visit_id = a.id
      AND e.event_type = 'service_end'
  );

UPDATE public.assist_visit_execution_state s
SET assignment_status = 'gestartet',
    current_step = 'in_service',
    updated_at = clock_timestamp()
WHERE s.service_started_at IS NOT NULL
  AND s.service_ended_at IS NULL
  AND s.finalized_at IS NULL
  AND s.assignment_status IN ('geplant','bestaetigt','unterwegs','angekommen');

COMMIT;
