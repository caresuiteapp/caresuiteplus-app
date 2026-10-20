-- CareSuite HealthOS · Fahrtenbuch P0 R18.4
-- Stale recordings, R16 whole-session quarantine and auditable leg recovery.

BEGIN;

ALTER TABLE public.employee_logbook_trips
  DROP CONSTRAINT IF EXISTS employee_logbook_trips_status_check;
ALTER TABLE public.employee_logbook_trips
  ADD CONSTRAINT employee_logbook_trips_status_check
  CHECK (status IN ('recording','review_required','completed','corrected','confirmed','cancelled'));

COMMENT ON COLUMN public.employee_logbook_trips.status IS
  'review_required blocks totals, payroll and reimbursement until Office confirms or corrects the trip.';

-- A previous-day recording cannot still be live. Preserve its raw points and
-- route metadata, but remove it from active tracking and all payable totals.
UPDATE public.employee_logbook_trips trip
SET status = 'review_required',
    ended_at = COALESCE(
      (
        SELECT MAX(point.recorded_at)
        FROM public.employee_logbook_points point
        WHERE point.trip_id = trip.id
          AND point.tenant_id = trip.tenant_id
          AND point.employee_id = trip.employee_id
      ),
      trip.started_at
    ),
    notes = CONCAT_WS(
      ' ',
      NULLIF(trip.notes, ''),
      'Automatisch beendet: Die Aufzeichnung war über den Berliner Kalendertag hinaus offen. Kilometer bleiben bis zur Verwaltungsprüfung gesperrt.'
    ),
    updated_at = NOW()
WHERE trip.status = 'recording'
  AND (trip.started_at AT TIME ZONE 'Europe/Berlin')::date < (NOW() AT TIME ZONE 'Europe/Berlin')::date;

-- R16.1 imported a whole Assist visit as one trip. In addition, the automatic
-- employee_portal recorder could close a partial GPS fragment (including
-- 0.00 km) as if it were the complete trip. Quarantine every not-yet-corrected
-- automatic historical row in the affected recovery period; R18 rebuilds
-- stable per-leg sources from the preserved Assist points instead.
CREATE TEMP TABLE r18_quarantined_logbook_trips ON COMMIT DROP AS
SELECT id, tenant_id, employee_id
FROM public.employee_logbook_trips
WHERE status = 'completed'
  AND (
    source LIKE 'assist_gps_recovery:%'
    OR (
      source = 'employee_portal'
      AND started_at >= TIMESTAMPTZ '2026-08-24T00:00:00+02:00'
      AND started_at < NOW()
    )
  );

UPDATE public.employee_logbook_trips trip
SET status = 'review_required',
    notes = CONCAT_WS(
      ' ',
      NULLIF(trip.notes, ''),
      'Automatischer Altimport gesperrt: GPS-Aufzeichnung muss in einzelne Fahrtabschnitte zerlegt werden.'
    ),
    updated_at = NOW()
FROM r18_quarantined_logbook_trips stale
WHERE trip.id = stale.id;

UPDATE public.assist_driving_log driving
SET status = 'cancelled',
    notes = CONCAT_WS(' ', NULLIF(driving.notes, ''), 'R18: R16-Gesamtimport bis zur Abschnittsprüfung gesperrt.'),
    updated_at = NOW()
FROM r18_quarantined_logbook_trips stale
WHERE driving.tenant_id = stale.tenant_id
  AND driving.employee_id = stale.employee_id
  AND driving.notes = 'employee_logbook_trip:' || stale.id::text
  AND driving.status IN ('open','completed','corrected')
  AND NOT EXISTS (
    SELECT 1
    FROM public.employee_expense_claims protected_claim
    WHERE protected_claim.tenant_id = driving.tenant_id
      AND protected_claim.employee_id = driving.employee_id
      AND protected_claim.driving_log_id = driving.id
  );

-- Abrechnungsdaten sind unveränderlich. Eingereichte, geprüfte oder sonstige
-- bereits angelegte Auslagen werden weder storniert noch nachträglich geändert.
-- Die Korrektur erfolgt ausschließlich über den gesperrten Fahrtenbucheintrag;
-- eine bereits erfolgte Erstattung bleibt als historischer Vorgang erhalten.

-- Old Assist sessions must never survive as live across days. Their original
-- points remain append-only and can still be reconstructed by R18.
UPDATE public.assist_tracking_sessions session
SET is_active = FALSE,
    ended_at = COALESCE(session.ended_at, session.last_location_at, session.updated_at, session.started_at),
    end_reason = 'timeout',
    updated_at = NOW()
WHERE session.is_active = TRUE
  AND (session.started_at AT TIME ZONE 'Europe/Berlin')::date < (NOW() AT TIME ZONE 'Europe/Berlin')::date;

CREATE INDEX IF NOT EXISTS idx_employee_logbook_trips_review_required
  ON public.employee_logbook_trips (tenant_id, employee_id, started_at DESC)
  WHERE status = 'review_required';

COMMIT;
