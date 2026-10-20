-- CareSuite HealthOS · Digitales Fahrtenbuch R11
-- Verbindliche PKW-Berechtigung, idempotente Rückfahrt, ein aktiver Track,
-- revisionssichere Portalrechte und prüfpflichtige Kilometererstattung.

BEGIN;

CREATE TABLE IF NOT EXISTS public.employee_logbook_prompt_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  assignment_id UUID NOT NULL,
  prompt_type TEXT NOT NULL CHECK (prompt_type IN ('return_trip')),
  decision TEXT NOT NULL CHECK (decision IN ('declined','home','office','completed')),
  decided_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, employee_id, assignment_id, prompt_type)
);

ALTER TABLE public.employee_logbook_prompt_decisions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS employee_logbook_prompt_decisions_select ON public.employee_logbook_prompt_decisions;
CREATE POLICY employee_logbook_prompt_decisions_select
ON public.employee_logbook_prompt_decisions FOR SELECT TO authenticated
USING (public.employee_logbook_own_employee(tenant_id, employee_id));
DROP POLICY IF EXISTS employee_logbook_prompt_decisions_insert ON public.employee_logbook_prompt_decisions;
CREATE POLICY employee_logbook_prompt_decisions_insert
ON public.employee_logbook_prompt_decisions FOR INSERT TO authenticated
WITH CHECK (public.employee_logbook_own_employee(tenant_id, employee_id));
DROP POLICY IF EXISTS employee_logbook_prompt_decisions_update ON public.employee_logbook_prompt_decisions;
CREATE POLICY employee_logbook_prompt_decisions_update
ON public.employee_logbook_prompt_decisions FOR UPDATE TO authenticated
USING (public.employee_logbook_own_employee(tenant_id, employee_id))
WITH CHECK (public.employee_logbook_own_employee(tenant_id, employee_id));
GRANT SELECT, INSERT, UPDATE ON public.employee_logbook_prompt_decisions TO authenticated;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.employee_logbook_trips
    WHERE status = 'recording'
    GROUP BY tenant_id, employee_id
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Fahrtenbuch-R11: Mehrere laufende Fahrten pro Mitarbeitendenkonto gefunden. Vor Migration fachlich prüfen; keine Daten wurden automatisch verworfen.';
  END IF;
END;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_employee_logbook_one_recording_trip
  ON public.employee_logbook_trips (tenant_id, employee_id)
  WHERE status = 'recording';

CREATE OR REPLACE FUNCTION public.enforce_employee_logbook_vehicle_assignment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_has_active_vehicle BOOLEAN := FALSE;
  v_has_car_mode BOOLEAN := FALSE;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.employee_logbook_vehicles vehicle
    WHERE vehicle.id = NEW.vehicle_id
      AND vehicle.tenant_id = NEW.tenant_id
      AND vehicle.employee_id = NEW.employee_id
      AND vehicle.active = TRUE
  ) INTO v_has_active_vehicle;

  IF NOT v_has_active_vehicle THEN
    RAISE EXCEPTION 'Für diese Fahrt ist kein aktiver, dem Mitarbeitenden zugeordneter PKW ausgewählt.';
  END IF;

  SELECT COALESCE(
    settings.transport_modes @> ARRAY['car']::TEXT[],
    settings.transport_mode = 'car',
    FALSE
  )
  INTO v_has_car_mode
  FROM public.employee_mobility_settings settings
  WHERE settings.tenant_id = NEW.tenant_id
    AND settings.employee_id = NEW.employee_id;

  IF COALESCE(v_has_car_mode, TRUE) = FALSE THEN
    RAISE EXCEPTION 'Das PKW-Fahrtenbuch ist für das hinterlegte Verkehrsmittel nicht freigeschaltet.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS employee_logbook_require_vehicle ON public.employee_logbook_trips;
CREATE TRIGGER employee_logbook_require_vehicle
BEFORE INSERT OR UPDATE OF vehicle_id, employee_id ON public.employee_logbook_trips
FOR EACH ROW EXECUTE FUNCTION public.enforce_employee_logbook_vehicle_assignment();

CREATE OR REPLACE FUNCTION public.protect_employee_logbook_completed_trip()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.is_employee_portal_rls_context(OLD.tenant_id) THEN
    IF OLD.status <> 'recording' THEN
      RAISE EXCEPTION 'Abgeschlossene Fahrten können nur durch die Verwaltung korrigiert werden.';
    END IF;
    IF NEW.tenant_id IS DISTINCT FROM OLD.tenant_id
      OR NEW.employee_id IS DISTINCT FROM OLD.employee_id
      OR NEW.vehicle_id IS DISTINCT FROM OLD.vehicle_id
      OR NEW.assignment_id IS DISTINCT FROM OLD.assignment_id
      OR NEW.client_id IS DISTINCT FROM OLD.client_id
      OR NEW.route_type IS DISTINCT FROM OLD.route_type
      OR NEW.purpose IS DISTINCT FROM OLD.purpose
      OR NEW.started_at IS DISTINCT FROM OLD.started_at
    THEN
      RAISE EXCEPTION 'Die Zuordnung einer laufenden Fahrt darf im Mitarbeitendenportal nicht verändert werden.';
    END IF;
    IF NEW.status NOT IN ('recording','completed','cancelled') THEN
      RAISE EXCEPTION 'Dieser Fahrtenbuchstatus darf im Mitarbeitendenportal nicht gesetzt werden.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS employee_logbook_protect_completed_trip ON public.employee_logbook_trips;
CREATE TRIGGER employee_logbook_protect_completed_trip
BEFORE UPDATE ON public.employee_logbook_trips
FOR EACH ROW EXECUTE FUNCTION public.protect_employee_logbook_completed_trip();

DROP POLICY IF EXISTS employee_logbook_trips_access ON public.employee_logbook_trips;
DROP POLICY IF EXISTS employee_logbook_trips_select ON public.employee_logbook_trips;
DROP POLICY IF EXISTS employee_logbook_trips_insert ON public.employee_logbook_trips;
DROP POLICY IF EXISTS employee_logbook_trips_update ON public.employee_logbook_trips;
DROP POLICY IF EXISTS employee_logbook_trips_office_delete ON public.employee_logbook_trips;
CREATE POLICY employee_logbook_trips_select ON public.employee_logbook_trips
FOR SELECT TO authenticated USING (public.employee_logbook_own_employee(tenant_id, employee_id));
CREATE POLICY employee_logbook_trips_insert ON public.employee_logbook_trips
FOR INSERT TO authenticated WITH CHECK (
  public.employee_logbook_own_employee(tenant_id, employee_id)
  AND (
    NOT public.is_employee_portal_rls_context(tenant_id)
    OR (status = 'recording' AND source = 'employee_portal')
  )
);
CREATE POLICY employee_logbook_trips_update ON public.employee_logbook_trips
FOR UPDATE TO authenticated
USING (public.employee_logbook_own_employee(tenant_id, employee_id))
WITH CHECK (public.employee_logbook_own_employee(tenant_id, employee_id));
CREATE POLICY employee_logbook_trips_office_delete ON public.employee_logbook_trips
FOR DELETE TO authenticated
USING (tenant_id = public.current_tenant_id() AND NOT public.is_employee_portal_rls_context(tenant_id));

-- Mitarbeitende dürfen Teilstrecken nur während einer eigenen laufenden Fahrt ergänzen.
-- Nachträgliches Ändern/Löschen bleibt der Verwaltung vorbehalten.
DROP POLICY IF EXISTS employee_logbook_segments_access ON public.employee_logbook_segments;
DROP POLICY IF EXISTS employee_logbook_segments_select ON public.employee_logbook_segments;
DROP POLICY IF EXISTS employee_logbook_segments_insert ON public.employee_logbook_segments;
DROP POLICY IF EXISTS employee_logbook_segments_update ON public.employee_logbook_segments;
DROP POLICY IF EXISTS employee_logbook_segments_office_update ON public.employee_logbook_segments;
DROP POLICY IF EXISTS employee_logbook_segments_office_delete ON public.employee_logbook_segments;
CREATE POLICY employee_logbook_segments_select ON public.employee_logbook_segments
FOR SELECT TO authenticated USING (public.employee_logbook_own_employee(tenant_id, employee_id));
CREATE POLICY employee_logbook_segments_insert ON public.employee_logbook_segments
FOR INSERT TO authenticated WITH CHECK (
  public.employee_logbook_own_employee(tenant_id, employee_id)
  AND (
    NOT public.is_employee_portal_rls_context(tenant_id)
    OR EXISTS (
      SELECT 1 FROM public.employee_logbook_trips trip
      WHERE trip.id = employee_logbook_segments.trip_id
        AND trip.tenant_id = employee_logbook_segments.tenant_id
        AND trip.employee_id = employee_logbook_segments.employee_id
        AND trip.status = 'recording'
    )
  )
);
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
          AND trip.status IN ('recording','completed')
      )
    )
  )
)
WITH CHECK (public.employee_logbook_own_employee(tenant_id, employee_id));
CREATE POLICY employee_logbook_segments_office_delete ON public.employee_logbook_segments
FOR DELETE TO authenticated
USING (tenant_id = public.current_tenant_id() AND NOT public.is_employee_portal_rls_context(tenant_id));

CREATE OR REPLACE FUNCTION public.protect_employee_logbook_segment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.is_employee_portal_rls_context(OLD.tenant_id) THEN
    IF OLD.ended_at IS NOT NULL OR NEW.ended_at IS NULL THEN
      RAISE EXCEPTION 'Eine Teilstrecke darf im Mitarbeitendenportal nur einmal abgeschlossen werden.';
    END IF;
    IF NEW.tenant_id IS DISTINCT FROM OLD.tenant_id
      OR NEW.employee_id IS DISTINCT FROM OLD.employee_id
      OR NEW.trip_id IS DISTINCT FROM OLD.trip_id
      OR NEW.sequence_no IS DISTINCT FROM OLD.sequence_no
      OR NEW.assignment_id IS DISTINCT FROM OLD.assignment_id
      OR NEW.client_id IS DISTINCT FROM OLD.client_id
      OR NEW.stop_kind IS DISTINCT FROM OLD.stop_kind
      OR NEW.label IS DISTINCT FROM OLD.label
      OR NEW.start_address IS DISTINCT FROM OLD.start_address
      OR NEW.started_at IS DISTINCT FROM OLD.started_at
      OR NEW.distance_km IS DISTINCT FROM OLD.distance_km
    THEN
      RAISE EXCEPTION 'Die Zuordnung einer Teilstrecke darf im Mitarbeitendenportal nicht verändert werden.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS employee_logbook_protect_segment ON public.employee_logbook_segments;
CREATE TRIGGER employee_logbook_protect_segment
BEFORE UPDATE ON public.employee_logbook_segments
FOR EACH ROW EXECUTE FUNCTION public.protect_employee_logbook_segment();

-- Belege können im Portal ergänzt, aber anschließend nur revisionssicher durch Office geändert werden.
DROP POLICY IF EXISTS employee_logbook_receipts_access ON public.employee_logbook_receipts;
DROP POLICY IF EXISTS employee_logbook_receipts_select ON public.employee_logbook_receipts;
DROP POLICY IF EXISTS employee_logbook_receipts_insert ON public.employee_logbook_receipts;
DROP POLICY IF EXISTS employee_logbook_receipts_office_update ON public.employee_logbook_receipts;
DROP POLICY IF EXISTS employee_logbook_receipts_office_delete ON public.employee_logbook_receipts;
CREATE POLICY employee_logbook_receipts_select ON public.employee_logbook_receipts
FOR SELECT TO authenticated USING (public.employee_logbook_own_employee(tenant_id, employee_id));
CREATE POLICY employee_logbook_receipts_insert ON public.employee_logbook_receipts
FOR INSERT TO authenticated WITH CHECK (public.employee_logbook_own_employee(tenant_id, employee_id));
CREATE POLICY employee_logbook_receipts_office_update ON public.employee_logbook_receipts
FOR UPDATE TO authenticated
USING (tenant_id = public.current_tenant_id() AND NOT public.is_employee_portal_rls_context(tenant_id))
WITH CHECK (tenant_id = public.current_tenant_id() AND NOT public.is_employee_portal_rls_context(tenant_id));
CREATE POLICY employee_logbook_receipts_office_delete ON public.employee_logbook_receipts
FOR DELETE TO authenticated
USING (tenant_id = public.current_tenant_id() AND NOT public.is_employee_portal_rls_context(tenant_id));

CREATE OR REPLACE FUNCTION public.sync_employee_logbook_to_payroll()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_log_id UUID;
BEGIN
  IF NEW.status NOT IN ('completed','corrected','confirmed') OR NEW.ended_at IS NULL THEN RETURN NEW; END IF;
  SELECT id INTO v_log_id FROM public.assist_driving_log WHERE tenant_id=NEW.tenant_id AND employee_id=NEW.employee_id AND notes=('employee_logbook_trip:'||NEW.id::text) LIMIT 1;
  IF v_log_id IS NULL THEN
    INSERT INTO public.assist_driving_log(tenant_id,visit_id,employee_id,purpose,travel_type,started_at,ended_at,distance_km,start_address,end_address,status,notes,payroll_eligible,work_time_eligible,logbook_eligible,mileage_rate_cents,mileage_amount_cents)
    VALUES(NEW.tenant_id,NULL,NEW.employee_id,NEW.purpose,NEW.route_type,NEW.started_at,NEW.ended_at,NEW.distance_final_km,NEW.start_address,NEW.end_address,CASE WHEN NEW.status='corrected' THEN 'corrected' ELSE 'completed' END,'employee_logbook_trip:'||NEW.id::text,NEW.route_type<>'private_non_business',NEW.counts_as_work_time,TRUE,NEW.mileage_rate_cents,NEW.mileage_amount_cents)
    RETURNING id INTO v_log_id;
  ELSE
    UPDATE public.assist_driving_log SET purpose=NEW.purpose,travel_type=NEW.route_type,started_at=NEW.started_at,ended_at=NEW.ended_at,distance_km=NEW.distance_final_km,start_address=NEW.start_address,end_address=NEW.end_address,status=CASE WHEN NEW.status='corrected' THEN 'corrected' ELSE 'completed' END,payroll_eligible=NEW.route_type<>'private_non_business',work_time_eligible=NEW.counts_as_work_time,mileage_rate_cents=NEW.mileage_rate_cents,mileage_amount_cents=NEW.mileage_amount_cents,updated_at=NOW() WHERE id=v_log_id;
  END IF;
  IF NEW.route_type <> 'private_non_business' AND NEW.mileage_amount_cents > 0 THEN
    INSERT INTO public.employee_expense_claims(
      tenant_id,employee_id,expense_date,category,description,amount_cents,approved_amount_cents,
      mileage_km,mileage_rate_cents,origin,destination,business_purpose,tax_treatment,status,
      submitted_at,assignment_id,driving_log_id,travel_type,automatic_source
    ) VALUES(
      NEW.tenant_id,NEW.employee_id,(NEW.started_at AT TIME ZONE 'Europe/Berlin')::date,'mileage','Automatische Kilometervergütung aus Mitarbeiter-Fahrtenbuch',
      NEW.mileage_amount_cents,NULL,NEW.distance_final_km,NEW.mileage_rate_cents,
      NEW.start_address,NEW.end_address,NEW.purpose,'review','submitted',NOW(),NEW.assignment_id,v_log_id,NEW.route_type,TRUE
    ) ON CONFLICT(tenant_id,driving_log_id) WHERE driving_log_id IS NOT NULL DO UPDATE SET
      amount_cents=EXCLUDED.amount_cents,
      approved_amount_cents=CASE WHEN public.employee_expense_claims.status IN ('approved','partially_approved','reimbursed') THEN public.employee_expense_claims.approved_amount_cents ELSE NULL END,
      mileage_km=EXCLUDED.mileage_km,mileage_rate_cents=EXCLUDED.mileage_rate_cents,
      origin=EXCLUDED.origin,destination=EXCLUDED.destination,business_purpose=EXCLUDED.business_purpose,
      status=CASE WHEN public.employee_expense_claims.status IN ('approved','partially_approved','reimbursed') THEN public.employee_expense_claims.status ELSE 'submitted' END,
      tax_treatment=CASE WHEN public.employee_expense_claims.status IN ('approved','partially_approved','reimbursed') THEN public.employee_expense_claims.tax_treatment ELSE 'review' END,
      rejection_reason=NULL,updated_at=NOW();
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS employee_logbook_sync_payroll ON public.employee_logbook_trips;
CREATE TRIGGER employee_logbook_sync_payroll AFTER INSERT OR UPDATE OF
  status, ended_at, distance_final_km, route_type, purpose, started_at,
  start_address, end_address, assignment_id, counts_as_work_time, mileage_rate_cents
ON public.employee_logbook_trips FOR EACH ROW EXECUTE FUNCTION public.sync_employee_logbook_to_payroll();

GRANT EXECUTE ON FUNCTION public.enforce_employee_logbook_vehicle_assignment() TO authenticated;
GRANT EXECUTE ON FUNCTION public.protect_employee_logbook_completed_trip() TO authenticated;
GRANT EXECUTE ON FUNCTION public.protect_employee_logbook_segment() TO authenticated;

COMMIT;
