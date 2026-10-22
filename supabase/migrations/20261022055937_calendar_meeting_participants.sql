-- One calendar event, with every selected employee kept on the same record.
-- Apply before deploying the web participant picker. Existing singular relations
-- and the calendar's tenant/portal RLS policies remain in place.
ALTER TABLE public.calendar_events
  ADD COLUMN IF NOT EXISTS participant_employee_ids uuid[] NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS calendar_events_participant_employees_idx
  ON public.calendar_events USING gin (participant_employee_ids)
  WHERE archived_at IS NULL;

CREATE OR REPLACE FUNCTION public.validate_calendar_employee_participants()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND NEW.tenant_id IS NOT DISTINCT FROM OLD.tenant_id
     AND NEW.participant_employee_ids IS NOT DISTINCT FROM OLD.participant_employee_ids THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1 FROM unnest(NEW.participant_employee_ids) AS selected(employee_id)
    WHERE selected.employee_id IS NULL OR NOT EXISTS (
      SELECT 1 FROM public.employees AS employee
      WHERE employee.id = selected.employee_id AND employee.tenant_id = NEW.tenant_id
    )
  ) THEN
    RAISE EXCEPTION 'Alle ausgewählten Mitarbeitenden müssen zum Mandanten des Termins gehören.'
      USING ERRCODE = '23514';
  END IF;

  NEW.participant_employee_ids := ARRAY(
    SELECT selected.employee_id
    FROM unnest(NEW.participant_employee_ids) WITH ORDINALITY AS selected(employee_id, position)
    GROUP BY selected.employee_id ORDER BY min(selected.position)
  );
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.validate_calendar_employee_participants() FROM PUBLIC;
DROP TRIGGER IF EXISTS calendar_employee_participants_guard ON public.calendar_events;
CREATE TRIGGER calendar_employee_participants_guard
  BEFORE INSERT OR UPDATE OF tenant_id, participant_employee_ids ON public.calendar_events
  FOR EACH ROW EXECUTE FUNCTION public.validate_calendar_employee_participants();

COMMENT ON COLUMN public.calendar_events.participant_employee_ids IS
  'Selected employees of this tenant; related_employee_id remains the legacy primary relation.';

NOTIFY pgrst, 'reload schema';
