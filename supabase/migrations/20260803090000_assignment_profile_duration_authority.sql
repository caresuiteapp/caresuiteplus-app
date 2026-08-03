-- ==========================================================================
-- Einsatzprofile: Die Gesamtdauer ist die alleinige Quelle des Kalenderblocks
-- ==========================================================================
-- Aufgaben und Aufgabenpakete besitzen eigene Richtzeiten. Diese Richtzeiten
-- dürfen weder planned_end_at noch duration_minutes eines aus einem
-- Einsatzprofil erzeugten Einsatzes bestimmen.

BEGIN;

CREATE OR REPLACE FUNCTION public.enforce_assignment_profile_duration_on_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_duration_minutes INTEGER;
BEGIN
  IF NEW.assignment_profile_id IS NULL OR NEW.planned_start_at IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT p.duration_minutes
    INTO v_duration_minutes
    FROM public.client_assignment_profiles p
   WHERE p.tenant_id = NEW.tenant_id
     AND p.id = NEW.assignment_profile_id;

  IF FOUND THEN
    NEW.planned_end_at := NEW.planned_start_at
      + make_interval(mins => v_duration_minutes);
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_assist_profile_duration_on_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_planned_start_at TIMESTAMPTZ;
  v_duration_minutes INTEGER;
BEGIN
  SELECT a.planned_start_at, p.duration_minutes
    INTO v_planned_start_at, v_duration_minutes
    FROM public.assignments a
    JOIN public.client_assignment_profiles p
      ON p.tenant_id = a.tenant_id
     AND p.id = a.assignment_profile_id
   WHERE a.tenant_id = NEW.tenant_id
     AND a.id = COALESCE(NEW.legacy_assignment_id, NEW.id);

  IF FOUND THEN
    NEW.planned_start_at := v_planned_start_at;
    NEW.planned_end_at := v_planned_start_at
      + make_interval(mins => v_duration_minutes);
    NEW.duration_minutes := v_duration_minutes;
    NEW.catalog_snapshot_json := COALESCE(NEW.catalog_snapshot_json, '{}'::JSONB)
      || jsonb_build_object(
        'plannedDurationMinutes', v_duration_minutes,
        'durationSource', 'assignment_profile'
      );
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_calendar_profile_duration_on_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_planned_start_at TIMESTAMPTZ;
  v_duration_minutes INTEGER;
BEGIN
  IF NEW.module_key <> 'assist'
     OR NEW.source_type <> 'assist_visit'
     OR NEW.source_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT a.planned_start_at, p.duration_minutes
    INTO v_planned_start_at, v_duration_minutes
    FROM public.assignments a
    JOIN public.client_assignment_profiles p
      ON p.tenant_id = a.tenant_id
     AND p.id = a.assignment_profile_id
   WHERE a.tenant_id = NEW.tenant_id
     AND a.id = NEW.source_id;

  IF FOUND THEN
    NEW.start_at := v_planned_start_at;
    NEW.end_at := v_planned_start_at
      + make_interval(mins => v_duration_minutes);
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.enforce_assignment_profile_duration_on_insert() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.enforce_assist_profile_duration_on_insert() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.enforce_calendar_profile_duration_on_insert() FROM PUBLIC;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
     WHERE tgname = 'assignments_profile_duration_on_insert'
       AND tgrelid = 'public.assignments'::regclass
       AND NOT tgisinternal
  ) THEN
    CREATE TRIGGER assignments_profile_duration_on_insert
      BEFORE INSERT ON public.assignments
      FOR EACH ROW
      EXECUTE FUNCTION public.enforce_assignment_profile_duration_on_insert();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
     WHERE tgname = 'assist_visits_profile_duration_on_insert'
       AND tgrelid = 'public.assist_visits'::regclass
       AND NOT tgisinternal
  ) THEN
    CREATE TRIGGER assist_visits_profile_duration_on_insert
      BEFORE INSERT ON public.assist_visits
      FOR EACH ROW
      EXECUTE FUNCTION public.enforce_assist_profile_duration_on_insert();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
     WHERE tgname = 'calendar_events_profile_duration_on_insert'
       AND tgrelid = 'public.calendar_events'::regclass
       AND NOT tgisinternal
  ) THEN
    CREATE TRIGGER calendar_events_profile_duration_on_insert
      BEFORE INSERT ON public.calendar_events
      FOR EACH ROW
      EXECUTE FUNCTION public.enforce_calendar_profile_duration_on_insert();
  END IF;
END;
$$;

-- Bereits fehlerhaft aus einer Aufgaben-Richtzeit erzeugte, noch nicht
-- begonnene Zukunftseinsätze werden gezielt korrigiert. Eine Abweichung wird
-- nur dann automatisch repariert, wenn die derzeitige Dauer exakt einer im
-- Profil gespeicherten Aufgaben-Richtzeit entspricht und von der Profilzeit
-- abweicht. Abgeschlossene, stornierte oder bereits begonnene Einsätze bleiben
-- unverändert.
INSERT INTO public.assist_visit_audit_logs (
  tenant_id,
  visit_id,
  action,
  details,
  actor_profile_id,
  metadata
)
SELECT
  v.tenant_id,
  v.id,
  'profile_duration_repair',
  'Geplante Einsatzdauer wurde von Aufgaben-Richtzeit auf Einsatzprofil-Gesamtdauer korrigiert.',
  NULL,
  jsonb_build_object(
    'previousDurationMinutes', COALESCE(
      v.duration_minutes,
      ROUND(EXTRACT(EPOCH FROM (v.planned_end_at - v.planned_start_at)) / 60)::INTEGER
    ),
    'plannedDurationMinutes', p.duration_minutes,
    'durationSource', 'assignment_profile',
    'assignmentProfileId', p.id
  )
FROM public.assist_visits v
JOIN public.assignments a
  ON a.tenant_id = v.tenant_id
 AND (a.id = v.legacy_assignment_id OR a.id = v.id)
JOIN public.client_assignment_profiles p
  ON p.tenant_id = a.tenant_id
 AND p.id = a.assignment_profile_id
WHERE v.planned_start_at >= (
    date_trunc('day', NOW() AT TIME ZONE 'Europe/Berlin') AT TIME ZONE 'Europe/Berlin'
  )
  AND v.actual_start_at IS NULL
  AND v.execution_status::TEXT NOT IN ('completed', 'cancelled', 'no_show')
  AND COALESCE(
    v.duration_minutes,
    ROUND(EXTRACT(EPOCH FROM (v.planned_end_at - v.planned_start_at)) / 60)::INTEGER
  ) <> p.duration_minutes
  AND EXISTS (
    SELECT 1
      FROM jsonb_array_elements(COALESCE(p.task_drafts, '[]'::JSONB)) task
     WHERE COALESCE(task ->> 'defaultDurationMinutes', '') ~ '^[0-9]+$'
       AND (task ->> 'defaultDurationMinutes')::INTEGER = COALESCE(
         v.duration_minutes,
         ROUND(EXTRACT(EPOCH FROM (v.planned_end_at - v.planned_start_at)) / 60)::INTEGER
       )
  );

UPDATE public.assignments a
   SET planned_end_at = a.planned_start_at + make_interval(mins => p.duration_minutes),
       updated_at = NOW()
  FROM public.client_assignment_profiles p
 WHERE a.tenant_id = p.tenant_id
   AND a.assignment_profile_id = p.id
   AND a.planned_start_at >= (
     date_trunc('day', NOW() AT TIME ZONE 'Europe/Berlin') AT TIME ZONE 'Europe/Berlin'
   )
   AND a.status::TEXT NOT IN ('cancelled', 'storniert', 'no_show', 'nicht_erschienen', 'completed', 'abgeschlossen')
   AND ROUND(EXTRACT(EPOCH FROM (a.planned_end_at - a.planned_start_at)) / 60)::INTEGER
       <> p.duration_minutes
   AND EXISTS (
     SELECT 1
       FROM jsonb_array_elements(COALESCE(p.task_drafts, '[]'::JSONB)) task
      WHERE COALESCE(task ->> 'defaultDurationMinutes', '') ~ '^[0-9]+$'
        AND (task ->> 'defaultDurationMinutes')::INTEGER
          = ROUND(EXTRACT(EPOCH FROM (a.planned_end_at - a.planned_start_at)) / 60)::INTEGER
   );

UPDATE public.assist_visits v
   SET planned_start_at = a.planned_start_at,
       planned_end_at = a.planned_start_at + make_interval(mins => p.duration_minutes),
       duration_minutes = p.duration_minutes,
       catalog_snapshot_json = COALESCE(v.catalog_snapshot_json, '{}'::JSONB)
         || jsonb_build_object(
           'plannedDurationMinutes', p.duration_minutes,
           'durationSource', 'assignment_profile'
         ),
       updated_at = NOW()
  FROM public.assignments a
  JOIN public.client_assignment_profiles p
    ON p.tenant_id = a.tenant_id
   AND p.id = a.assignment_profile_id
 WHERE v.tenant_id = a.tenant_id
   AND (v.legacy_assignment_id = a.id OR v.id = a.id)
   AND v.planned_start_at >= (
     date_trunc('day', NOW() AT TIME ZONE 'Europe/Berlin') AT TIME ZONE 'Europe/Berlin'
   )
   AND v.actual_start_at IS NULL
   AND v.execution_status::TEXT NOT IN ('completed', 'cancelled', 'no_show')
   AND COALESCE(
     v.duration_minutes,
     ROUND(EXTRACT(EPOCH FROM (v.planned_end_at - v.planned_start_at)) / 60)::INTEGER
   ) <> p.duration_minutes
   AND EXISTS (
     SELECT 1
       FROM jsonb_array_elements(COALESCE(p.task_drafts, '[]'::JSONB)) task
      WHERE COALESCE(task ->> 'defaultDurationMinutes', '') ~ '^[0-9]+$'
        AND (task ->> 'defaultDurationMinutes')::INTEGER = COALESCE(
          v.duration_minutes,
          ROUND(EXTRACT(EPOCH FROM (v.planned_end_at - v.planned_start_at)) / 60)::INTEGER
        )
   );

UPDATE public.calendar_events event
   SET start_at = a.planned_start_at,
       end_at = a.planned_start_at + make_interval(mins => p.duration_minutes),
       updated_at = NOW()
  FROM public.assignments a
  JOIN public.client_assignment_profiles p
    ON p.tenant_id = a.tenant_id
   AND p.id = a.assignment_profile_id
 WHERE event.tenant_id = a.tenant_id
   AND event.module_key = 'assist'
   AND event.source_type = 'assist_visit'
   AND event.source_id = a.id
   AND event.start_at >= (
     date_trunc('day', NOW() AT TIME ZONE 'Europe/Berlin') AT TIME ZONE 'Europe/Berlin'
   )
   AND event.status::TEXT NOT IN ('cancelled', 'storniert', 'abgesagt', 'completed', 'abgeschlossen')
   AND ROUND(EXTRACT(EPOCH FROM (event.end_at - event.start_at)) / 60)::INTEGER
       <> p.duration_minutes
   AND EXISTS (
     SELECT 1
       FROM jsonb_array_elements(COALESCE(p.task_drafts, '[]'::JSONB)) task
      WHERE COALESCE(task ->> 'defaultDurationMinutes', '') ~ '^[0-9]+$'
        AND (task ->> 'defaultDurationMinutes')::INTEGER
          = ROUND(EXTRACT(EPOCH FROM (event.end_at - event.start_at)) / 60)::INTEGER
   );

COMMENT ON FUNCTION public.enforce_assignment_profile_duration_on_insert() IS
  'Erzwingt beim Erzeugen aus einem Einsatzprofil dessen Gesamtdauer als geplante Einsatzdauer.';
COMMENT ON FUNCTION public.enforce_assist_profile_duration_on_insert() IS
  'Übernimmt beim Erzeugen des Assist-Einsatzes ausschließlich die Dauer des zugehörigen Einsatzprofils.';
COMMENT ON FUNCTION public.enforce_calendar_profile_duration_on_insert() IS
  'Übernimmt beim Erzeugen des Assist-Kalendereintrags ausschließlich die Dauer des zugehörigen Einsatzprofils.';

NOTIFY pgrst, 'reload schema';

COMMIT;
