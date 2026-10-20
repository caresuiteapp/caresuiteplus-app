-- =============================================================================
-- R34: Einsatzprofil-Dauer vollständig auf sichere Zukunftseinsätze anwenden
-- =============================================================================
-- R33 hat die Neuerstellung abgesichert, beim Bestandsabgleich jedoch nur
-- Abweichungen korrigiert, die exakt einer einzelnen Aufgaben-Richtzeit
-- entsprachen. Der ursprüngliche UI-Fehler konnte ebenso die Gesamtdauer eines
-- Aufgabenpakets übernehmen. Deshalb ist die Aufgabenzeit für diesen Abgleich
-- vollständig irrelevant: Für aktive, noch nicht operativ begonnene
-- Zukunftseinsätze ist ausschließlich client_assignment_profiles.duration_minutes
-- maßgeblich.

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
     AND (
       a.id = NEW.source_id
       OR EXISTS (
         SELECT 1
           FROM public.assist_visits v
          WHERE v.tenant_id = a.tenant_id
            AND v.id = NEW.source_id
            AND (v.legacy_assignment_id = a.id OR v.id = a.id)
       )
     )
   ORDER BY CASE WHEN a.id = NEW.source_id THEN 0 ELSE 1 END
   LIMIT 1;

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

-- Die R33-Trigger waren auf INSERT begrenzt. R34 schützt zusätzlich jede
-- nachträgliche Änderung der geplanten Zeitfelder vor einem erneuten
-- Überschreiben durch Aufgaben- oder Paketzeiten.
DROP TRIGGER IF EXISTS assignments_profile_duration_on_insert
  ON public.assignments;
CREATE TRIGGER assignments_profile_duration_on_insert
  BEFORE INSERT OR UPDATE OF assignment_profile_id, planned_start_at, planned_end_at
  ON public.assignments
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_assignment_profile_duration_on_insert();

DROP TRIGGER IF EXISTS assist_visits_profile_duration_on_insert
  ON public.assist_visits;
CREATE TRIGGER assist_visits_profile_duration_on_insert
  BEFORE INSERT OR UPDATE OF legacy_assignment_id, planned_start_at, planned_end_at, duration_minutes
  ON public.assist_visits
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_assist_profile_duration_on_insert();

DROP TRIGGER IF EXISTS calendar_events_profile_duration_on_insert
  ON public.calendar_events;
CREATE TRIGGER calendar_events_profile_duration_on_insert
  BEFORE INSERT OR UPDATE OF module_key, source_type, source_id, start_at, end_at
  ON public.calendar_events
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_calendar_profile_duration_on_insert();

-- Eine einmalige, transaktionsgebundene Zielmenge stellt sicher, dass Audit,
-- Zuordnung, Assist-Einsatz und Kalender exakt dieselben Datensätze bearbeiten.
-- Zugelassen sind nur zukünftige Planungen ohne jegliches operatives Signal.
CREATE TEMP TABLE r34_profile_duration_targets
ON COMMIT DROP
AS
SELECT
  a.tenant_id,
  a.id AS assignment_id,
  a.assignment_profile_id,
  a.planned_start_at,
  a.planned_end_at AS previous_assignment_end_at,
  p.duration_minutes AS profile_duration_minutes
FROM public.assignments a
JOIN public.client_assignment_profiles p
  ON p.tenant_id = a.tenant_id
 AND p.id = a.assignment_profile_id
WHERE a.planned_start_at > NOW()
  AND a.status::TEXT IN ('planned', 'confirmed', 'scheduled', 'entwurf', 'geplant')
  AND a.actual_start_at IS NULL
  AND a.actual_end_at IS NULL
  AND a.on_the_way_at IS NULL
  AND a.arrived_at IS NULL
  AND a.finished_at IS NULL
  AND NOT EXISTS (
    SELECT 1
      FROM public.assist_visits started_visit
     WHERE started_visit.tenant_id = a.tenant_id
       AND (
         started_visit.legacy_assignment_id = a.id
         OR started_visit.id = a.id
       )
       AND (
         started_visit.execution_status::TEXT <> 'pending'
         OR started_visit.actual_start_at IS NOT NULL
         OR started_visit.actual_end_at IS NOT NULL
         OR started_visit.on_the_way_at IS NOT NULL
         OR started_visit.arrived_at IS NOT NULL
         OR started_visit.finished_at IS NOT NULL
       )
  )
  AND (
    a.planned_end_at IS DISTINCT FROM (
      a.planned_start_at + make_interval(mins => p.duration_minutes)
    )
    OR EXISTS (
      SELECT 1
        FROM public.assist_visits v
       WHERE v.tenant_id = a.tenant_id
         AND (v.legacy_assignment_id = a.id OR v.id = a.id)
         AND (
           v.planned_start_at IS DISTINCT FROM a.planned_start_at
           OR v.planned_end_at IS DISTINCT FROM (
             a.planned_start_at + make_interval(mins => p.duration_minutes)
           )
           OR v.duration_minutes IS DISTINCT FROM p.duration_minutes
         )
    )
    OR EXISTS (
      SELECT 1
        FROM public.calendar_events event
       WHERE event.tenant_id = a.tenant_id
         AND event.module_key = 'assist'
         AND event.source_type = 'assist_visit'
         AND event.archived_at IS NULL
         AND event.status::TEXT NOT IN (
           'cancelled', 'storniert', 'abgesagt', 'completed', 'abgeschlossen'
         )
         AND (
           event.source_id = a.id
           OR EXISTS (
             SELECT 1
               FROM public.assist_visits source_visit
              WHERE source_visit.tenant_id = a.tenant_id
                AND source_visit.id = event.source_id
                AND (
                  source_visit.legacy_assignment_id = a.id
                  OR source_visit.id = a.id
                )
           )
         )
         AND (
           event.start_at IS DISTINCT FROM a.planned_start_at
           OR event.end_at IS DISTINCT FROM (
             a.planned_start_at + make_interval(mins => p.duration_minutes)
           )
         )
    )
  );

CREATE UNIQUE INDEX r34_profile_duration_targets_assignment
  ON r34_profile_duration_targets (tenant_id, assignment_id);

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
SELECT
  target.tenant_id,
  target.assignment_id,
  'profile_duration_complete_future_repair',
  NULL,
  'System · R34',
  NULL,
  NULL,
  format(
    'Geplantes Ende vollständig aus dem Einsatzprofil korrigiert: %s Minuten. Aufgaben- und Paketzeiten wurden nicht verwendet.',
    target.profile_duration_minutes
  )
FROM r34_profile_duration_targets target;

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
  'profile_duration_complete_future_repair',
  'Geplante Einsatzdauer vollständig auf die Gesamtdauer des Einsatzprofils korrigiert.',
  NULL,
  jsonb_build_object(
    'previousDurationMinutes', COALESCE(
      v.duration_minutes,
      ROUND(EXTRACT(EPOCH FROM (v.planned_end_at - v.planned_start_at)) / 60)::INTEGER
    ),
    'plannedDurationMinutes', target.profile_duration_minutes,
    'durationSource', 'assignment_profile',
    'assignmentProfileId', target.assignment_profile_id,
    'repairRelease', 'R34'
  )
FROM r34_profile_duration_targets target
JOIN public.assist_visits v
  ON v.tenant_id = target.tenant_id
 AND (v.legacy_assignment_id = target.assignment_id OR v.id = target.assignment_id);

UPDATE public.assignments a
   SET planned_end_at = target.planned_start_at
         + make_interval(mins => target.profile_duration_minutes),
       updated_at = NOW()
  FROM r34_profile_duration_targets target
 WHERE a.tenant_id = target.tenant_id
   AND a.id = target.assignment_id;

UPDATE public.assist_visits v
   SET planned_start_at = target.planned_start_at,
       planned_end_at = target.planned_start_at
         + make_interval(mins => target.profile_duration_minutes),
       duration_minutes = target.profile_duration_minutes,
       catalog_snapshot_json = COALESCE(v.catalog_snapshot_json, '{}'::JSONB)
         || jsonb_build_object(
           'plannedDurationMinutes', target.profile_duration_minutes,
           'durationSource', 'assignment_profile',
           'durationRepairRelease', 'R34'
         ),
       updated_at = NOW()
  FROM r34_profile_duration_targets target
 WHERE v.tenant_id = target.tenant_id
   AND (v.legacy_assignment_id = target.assignment_id OR v.id = target.assignment_id);

UPDATE public.calendar_events event
   SET start_at = target.planned_start_at,
       end_at = target.planned_start_at
         + make_interval(mins => target.profile_duration_minutes),
       updated_at = NOW()
  FROM r34_profile_duration_targets target
 WHERE event.tenant_id = target.tenant_id
   AND event.module_key = 'assist'
   AND event.source_type = 'assist_visit'
   AND event.archived_at IS NULL
   AND event.status::TEXT NOT IN (
     'cancelled', 'storniert', 'abgesagt', 'completed', 'abgeschlossen'
   )
   AND (
     event.source_id = target.assignment_id
     OR EXISTS (
       SELECT 1
         FROM public.assist_visits source_visit
        WHERE source_visit.tenant_id = target.tenant_id
          AND source_visit.id = event.source_id
          AND (
            source_visit.legacy_assignment_id = target.assignment_id
            OR source_visit.id = target.assignment_id
          )
     )
   );

COMMENT ON FUNCTION public.enforce_assignment_profile_duration_on_insert() IS
  'Erzwingt bei Insert und Zeitänderungen aus einem Einsatzprofil dessen Gesamtdauer.';
COMMENT ON FUNCTION public.enforce_assist_profile_duration_on_insert() IS
  'Erzwingt bei Insert und Zeitänderungen des Assist-Einsatzes die Dauer des Einsatzprofils.';
COMMENT ON FUNCTION public.enforce_calendar_profile_duration_on_insert() IS
  'Erzwingt bei Insert und Zeitänderungen des Assist-Kalendereintrags die Dauer des Einsatzprofils.';

NOTIFY pgrst, 'reload schema';

COMMIT;
