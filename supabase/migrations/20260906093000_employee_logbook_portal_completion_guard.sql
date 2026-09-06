-- Align the R11 portal guard with the R18.5 kilometre confirmation workflow.
-- Changes rules only: no trip, GPS point, expense or signature is rewritten.
BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'employee_logbook_trips'
      AND column_name = 'employee_confirmed_at'
  ) THEN
    RAISE EXCEPTION 'Die Fahrtenbuch-Migration R18.5 muss zuerst vorhanden sein.';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.protect_employee_logbook_completed_trip()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_corrected BOOLEAN;
  v_open_visit UUID;
BEGIN
  IF NOT public.is_employee_portal_rls_context(OLD.tenant_id) THEN
    RETURN NEW;
  END IF;

  IF NEW.id IS DISTINCT FROM OLD.id
    OR NEW.tenant_id IS DISTINCT FROM OLD.tenant_id
    OR NEW.employee_id IS DISTINCT FROM OLD.employee_id
    OR NEW.vehicle_id IS DISTINCT FROM OLD.vehicle_id
    OR NEW.assignment_id IS DISTINCT FROM OLD.assignment_id
    OR NEW.client_id IS DISTINCT FROM OLD.client_id
    OR NEW.route_type IS DISTINCT FROM OLD.route_type
    OR NEW.purpose IS DISTINCT FROM OLD.purpose
    OR NEW.started_at IS DISTINCT FROM OLD.started_at
    OR NEW.start_address IS DISTINCT FROM OLD.start_address
    OR NEW.source IS DISTINCT FROM OLD.source
    OR NEW.created_at IS DISTINCT FROM OLD.created_at
  THEN
    RAISE EXCEPTION 'Die Zuordnung einer Fahrt darf im Mitarbeitendenportal nicht verändert werden.';
  END IF;

  IF OLD.status = 'recording' THEN
    IF NEW.status NOT IN ('recording', 'confirmation_required', 'cancelled') THEN
      RAISE EXCEPTION 'Eine Fahrt muss zuerst beendet und anschließend mit Kilometern bestätigt werden.';
    END IF;
    IF NEW.employee_confirmed_at IS NOT NULL OR NEW.employee_confirmation_reason IS NOT NULL THEN
      RAISE EXCEPTION 'Kilometer dürfen erst nach dem Fahrtende bestätigt werden.';
    END IF;
    IF NEW.status = 'confirmation_required' AND (
      NEW.ended_at IS NULL OR NEW.ended_at < OLD.started_at
      OR NEW.distance_final_km IS NULL OR NEW.distance_final_km < 0
      OR NEW.distance_final_km::TEXT IN ('NaN', 'Infinity', '-Infinity')
    ) THEN
      RAISE EXCEPTION 'Für die Kilometerprüfung fehlen ein gültiges Fahrtende oder gültige Kilometer.';
    END IF;
    RETURN NEW;
  END IF;

  IF OLD.status IN ('completed','confirmed','corrected') AND NEW.status = 'confirmed' AND OLD.assignment_id IS NOT NULL THEN
    SELECT v.id INTO v_open_visit FROM public.assist_visits v
      WHERE v.tenant_id=OLD.tenant_id AND v.employee_id=OLD.employee_id
        AND (v.id=OLD.assignment_id OR v.legacy_assignment_id=OLD.assignment_id)
        AND v.canonical_status NOT IN ('completed','cancelled','no_show')
        AND v.planning_status NOT IN ('cancelled','draft')
        AND NOT EXISTS (SELECT 1 FROM public.assist_visit_execution_state es
          WHERE es.tenant_id=v.tenant_id AND es.visit_id=v.id AND es.finalized_at IS NOT NULL)
        AND NOT EXISTS (SELECT 1 FROM public.assignments a WHERE a.tenant_id=v.tenant_id
          AND a.id=v.legacy_assignment_id AND a.status::text IN ('completed','cancelled','no_show'))
      FOR UPDATE;
  END IF;
  IF (OLD.status <> 'confirmation_required' AND v_open_visit IS NULL) OR NEW.status <> 'confirmed' THEN
    RAISE EXCEPTION 'Der zugehörige Einsatz ist abgeschlossen. Diese Fahrt kann nur die Verwaltung korrigieren.';
  END IF;

  -- Confirmation must not change the trip, GPS evidence or office decisions.
  -- prepare_employee_logbook_trip runs before this guard; keep the rate from
  -- the finished trip and calculate the resulting amount server-side.
  NEW.mileage_rate_cents := OLD.mileage_rate_cents;
  NEW.mileage_amount_cents := CASE WHEN OLD.route_type = 'private_non_business' THEN 0
    ELSE ROUND(NEW.distance_final_km * OLD.mileage_rate_cents)::INTEGER END;
  IF (to_jsonb(NEW) - ARRAY[
      'status','distance_final_km','distance_source','route_quality_status',
      'employee_confirmed_at','employee_confirmation_reason','previous_values',
      'updated_at','mileage_amount_cents'
    ]) IS DISTINCT FROM (to_jsonb(OLD) - ARRAY[
      'status','distance_final_km','distance_source','route_quality_status',
      'employee_confirmed_at','employee_confirmation_reason','previous_values',
      'updated_at','mileage_amount_cents'
    ]) THEN
    RAISE EXCEPTION 'Bei der Kilometerbestätigung dürfen nur Kilometer und ihre Begründung geändert werden.';
  END IF;

  IF OLD.ended_at IS NULL OR NEW.employee_confirmed_at IS NULL
    OR NEW.distance_final_km IS NULL OR NEW.distance_final_km < 0
    OR NEW.distance_final_km::TEXT IN ('NaN', 'Infinity', '-Infinity') THEN
    RAISE EXCEPTION 'Die Kilometerbestätigung ist unvollständig.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.employee_logbook_segments segment
    WHERE segment.trip_id = OLD.id AND segment.tenant_id = OLD.tenant_id
      AND segment.employee_id = OLD.employee_id AND segment.ended_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Vor der Kilometerbestätigung müssen die offenen Teilstrecken beendet werden.';
  END IF;

  v_corrected := ABS(NEW.distance_final_km - OLD.distance_final_km) >= 0.005;
  IF v_corrected AND LENGTH(BTRIM(COALESCE(NEW.employee_confirmation_reason, ''))) < 3 THEN
    RAISE EXCEPTION 'Bitte die Kilometerkorrektur kurz begründen.';
  END IF;
  NEW.distance_source := CASE WHEN v_corrected THEN 'manual' ELSE OLD.distance_source END;
  NEW.route_quality_status := CASE WHEN v_corrected THEN 'corrected' ELSE OLD.route_quality_status END;
  NEW.previous_values := CASE WHEN v_corrected THEN jsonb_build_object(
    'distance_final_km', OLD.distance_final_km, 'status', OLD.status
  ) ELSE NULL END;
  NEW.employee_confirmation_reason := CASE WHEN v_corrected
    THEN BTRIM(NEW.employee_confirmation_reason) ELSE NULL END;
  IF v_open_visit IS NOT NULL AND v_corrected THEN
    UPDATE public.assist_visit_signatures SET is_valid=FALSE, invalidated_at=now(),
      invalidation_reason='Kilometer vor Einsatzabschluss korrigiert.', updated_at=now()
      WHERE tenant_id=OLD.tenant_id AND visit_id=v_open_visit AND is_valid;
    UPDATE public.assist_visit_proofs SET signature_id=NULL, portal_visible=FALSE,
      portal_release_status='none', updated_at=now() WHERE tenant_id=OLD.tenant_id AND visit_id=v_open_visit;
    UPDATE public.assist_visit_execution_state SET signature_complete=FALSE,proof_generated=FALSE,updated_at=now()
      WHERE tenant_id=OLD.tenant_id AND visit_id=v_open_visit;
  END IF;
  NEW.employee_confirmed_at := NOW();
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

-- Closing the parent precedes closing its open segments in existing clients.
-- Keep ownership checks and the one-time segment-close trigger in force.
DROP POLICY IF EXISTS employee_logbook_segments_update ON public.employee_logbook_segments;
CREATE POLICY employee_logbook_segments_update ON public.employee_logbook_segments
FOR UPDATE TO authenticated
USING (
  tenant_id = public.current_tenant_id()
  AND (
    NOT public.is_employee_portal_rls_context(tenant_id)
    OR (
      employee_id = public.resolve_current_employee_id()
      AND EXISTS (
        SELECT 1 FROM public.employee_logbook_trips trip
        WHERE trip.id = employee_logbook_segments.trip_id
          AND trip.tenant_id = employee_logbook_segments.tenant_id
          AND trip.employee_id = employee_logbook_segments.employee_id
          AND trip.status IN ('recording', 'confirmation_required', 'completed')
      )
    )
  )
)
WITH CHECK (public.employee_logbook_own_employee(tenant_id, employee_id));

COMMIT;

-- Read-only result for a manual SQL-editor deployment.
WITH checks AS (
  SELECT
    pg_get_functiondef('public.protect_employee_logbook_completed_trip()'::regprocedure)
      LIKE '%OLD.status = ''recording''%' AS trip_guard_updated,
    EXISTS (
      SELECT 1 FROM pg_policies WHERE schemaname = 'public'
        AND tablename = 'employee_logbook_segments'
        AND policyname = 'employee_logbook_segments_update'
        AND qual LIKE '%confirmation_required%'
    ) AS segment_close_allowed,
    (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.employee_logbook_trips'::regclass)
      AS trip_rls_enabled,
    (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.employee_logbook_segments'::regclass)
      AS segment_rls_enabled
)
SELECT CASE WHEN trip_guard_updated AND segment_close_allowed AND trip_rls_enabled AND segment_rls_enabled
  THEN 'BESTANDEN' ELSE 'PRUEFEN' END AS status, checks.* FROM checks;
