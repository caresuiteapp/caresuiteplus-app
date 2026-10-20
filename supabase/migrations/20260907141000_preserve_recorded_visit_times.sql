-- A status/proof refresh must not erase times already recorded in assignments.
-- Fill only previously empty visit fields from the same visit/tenant/persons.
-- Explicit corrections (including clearing a populated field) still take effect.
CREATE OR REPLACE FUNCTION public.preserve_recorded_assist_visit_times()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_assignment public.assignments%ROWTYPE;
BEGIN
  IF NEW.execution_status IS DISTINCT FROM 'completed' THEN RETURN NEW; END IF;
  SELECT * INTO v_assignment
  FROM public.assignments a
  WHERE a.tenant_id = NEW.tenant_id
    AND a.id = coalesce(NEW.legacy_assignment_id, NEW.id)
    AND a.client_id = NEW.client_id
    AND a.employee_id IS NOT DISTINCT FROM NEW.employee_id;
  IF NOT FOUND THEN RETURN NEW; END IF;

  IF OLD.actual_start_at IS NULL AND NEW.actual_start_at IS NULL THEN
    NEW.actual_start_at := v_assignment.actual_start_at;
  END IF;
  IF OLD.actual_end_at IS NULL AND NEW.actual_end_at IS NULL THEN
    NEW.actual_end_at := v_assignment.actual_end_at;
  END IF;
  IF OLD.on_the_way_at IS NULL AND NEW.on_the_way_at IS NULL THEN
    NEW.on_the_way_at := v_assignment.on_the_way_at;
  END IF;
  IF OLD.arrived_at IS NULL AND NEW.arrived_at IS NULL THEN
    NEW.arrived_at := v_assignment.arrived_at;
  END IF;
  IF OLD.finished_at IS NULL AND NEW.finished_at IS NULL THEN
    NEW.finished_at := v_assignment.finished_at;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_preserve_recorded_assist_visit_times ON public.assist_visits;
CREATE TRIGGER trg_preserve_recorded_assist_visit_times
  BEFORE UPDATE ON public.assist_visits
  FOR EACH ROW EXECUTE FUNCTION public.preserve_recorded_assist_visit_times();
