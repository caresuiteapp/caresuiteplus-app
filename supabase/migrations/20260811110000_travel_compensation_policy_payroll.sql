-- CareSuite HealthOS — Fahrtkostenregel, Fahrtenbuch und automatische Gehaltsstatistik
-- Idempotent, mandantenfähig und ohne Veränderung bestehender Fahrtdaten.

BEGIN;

ALTER TABLE public.tenant_service_catalog
  ADD COLUMN IF NOT EXISTS travel_policy_json JSONB;

ALTER TABLE public.employee_payroll_settings
  ADD COLUMN IF NOT EXISTS travel_policy_override JSONB;

ALTER TABLE public.workforce_travel_rules
  ADD COLUMN IF NOT EXISTS travel_policy_json JSONB;

ALTER TABLE public.trips
  ADD COLUMN IF NOT EXISTS employee_id UUID REFERENCES public.employees(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS travel_type TEXT,
  ADD COLUMN IF NOT EXISTS logbook_eligible BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS payroll_eligible BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS work_time_eligible BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS client_billing_eligible BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS mileage_rate_cents INTEGER,
  ADD COLUMN IF NOT EXISTS mileage_amount_cents INTEGER,
  ADD COLUMN IF NOT EXISTS policy_snapshot JSONB;

ALTER TABLE public.assist_driving_log
  ADD COLUMN IF NOT EXISTS travel_type TEXT,
  ADD COLUMN IF NOT EXISTS logbook_eligible BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS payroll_eligible BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS work_time_eligible BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS client_billing_eligible BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS mileage_rate_cents INTEGER,
  ADD COLUMN IF NOT EXISTS mileage_amount_cents INTEGER,
  ADD COLUMN IF NOT EXISTS policy_snapshot JSONB;

ALTER TABLE public.employee_expense_claims
  ADD COLUMN IF NOT EXISTS driving_log_id UUID REFERENCES public.assist_driving_log(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS travel_type TEXT,
  ADD COLUMN IF NOT EXISTS automatic_source BOOLEAN NOT NULL DEFAULT FALSE;

CREATE UNIQUE INDEX IF NOT EXISTS idx_employee_expense_claims_driving_log
  ON public.employee_expense_claims (tenant_id, driving_log_id)
  WHERE driving_log_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_assist_driving_log_payroll_period
  ON public.assist_driving_log (tenant_id, employee_id, ended_at)
  WHERE status IN ('completed', 'corrected') AND payroll_eligible;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'trips_travel_type_check') THEN
    ALTER TABLE public.trips ADD CONSTRAINT trips_travel_type_check CHECK (
      travel_type IS NULL OR travel_type IN (
        'home_to_office','office_to_home','home_to_client','client_to_home',
        'office_to_client','client_to_office','client_to_client','with_client',
        'other_business','private_non_business'
      )
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'assist_driving_log_travel_type_check') THEN
    ALTER TABLE public.assist_driving_log ADD CONSTRAINT assist_driving_log_travel_type_check CHECK (
      travel_type IS NULL OR travel_type IN (
        'home_to_office','office_to_home','home_to_client','client_to_home',
        'office_to_client','client_to_office','client_to_client','with_client',
        'other_business','private_non_business'
      )
    );
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.default_travel_compensation_policy()
RETURNS JSONB
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT jsonb_build_object(
    'preset', 'custom',
    'logbookRouteTypes', jsonb_build_array(
      'home_to_office','office_to_home','home_to_client','client_to_home',
      'office_to_client','client_to_office','client_to_client','with_client','other_business'
    ),
    'payrollRouteTypes', '[]'::jsonb,
    'workTimeRouteTypes', '[]'::jsonb,
    'clientBillingRouteTypes', '[]'::jsonb
  );
$$;

CREATE OR REPLACE FUNCTION public.resolve_employee_travel_compensation_policy(
  p_tenant_id UUID,
  p_employee_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_policy JSONB;
BEGIN
  SELECT travel_policy_override INTO v_policy
  FROM public.employee_payroll_settings
  WHERE tenant_id = p_tenant_id AND employee_id = p_employee_id;

  IF v_policy IS NULL THEN
    SELECT travel_policy_json INTO v_policy
    FROM public.tenant_service_catalog
    WHERE tenant_id = p_tenant_id
      AND category = 'travel'
      AND is_active
      AND travel_policy_json IS NOT NULL
    ORDER BY CASE WHEN service_key = 'assist.travel.km' THEN 0 ELSE 1 END, sort_order
    LIMIT 1;
  END IF;

  RETURN COALESCE(v_policy, public.default_travel_compensation_policy());
END;
$$;

CREATE OR REPLACE FUNCTION public.classify_assist_driving_log_for_payroll()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_policy JSONB;
  v_rate INTEGER := 30;
  v_type TEXT;
BEGIN
  v_type := COALESCE(NULLIF(NEW.travel_type, ''),
    CASE
      WHEN lower(COALESCE(NEW.purpose, '')) LIKE '%mit klient%' THEN 'with_client'
      WHEN lower(COALESCE(NEW.purpose, '')) LIKE '%zwischen%klient%' THEN 'client_to_client'
      WHEN lower(COALESCE(NEW.purpose, '')) IN ('einsatz', 'anfahrt zum einsatz') THEN 'office_to_client'
      ELSE 'other_business'
    END
  );
  NEW.travel_type := v_type;

  IF NEW.employee_id IS NULL THEN
    NEW.logbook_eligible := TRUE;
    NEW.payroll_eligible := FALSE;
    NEW.work_time_eligible := FALSE;
    NEW.client_billing_eligible := FALSE;
    NEW.mileage_amount_cents := 0;
    RETURN NEW;
  END IF;

  v_policy := public.resolve_employee_travel_compensation_policy(NEW.tenant_id, NEW.employee_id);
  SELECT COALESCE(mileage_rate_cents, 30) INTO v_rate
  FROM public.employee_payroll_settings
  WHERE tenant_id = NEW.tenant_id AND employee_id = NEW.employee_id;
  v_rate := COALESCE(v_rate, 30);

  NEW.policy_snapshot := v_policy;
  NEW.mileage_rate_cents := v_rate;
  NEW.logbook_eligible := COALESCE(v_policy->'logbookRouteTypes', '[]'::jsonb) ? v_type;
  NEW.payroll_eligible := COALESCE(v_policy->'payrollRouteTypes', '[]'::jsonb) ? v_type;
  NEW.work_time_eligible := COALESCE(v_policy->'workTimeRouteTypes', '[]'::jsonb) ? v_type;
  NEW.client_billing_eligible := COALESCE(v_policy->'clientBillingRouteTypes', '[]'::jsonb) ? v_type;
  NEW.mileage_amount_cents := CASE
    WHEN NEW.payroll_eligible THEN ROUND(COALESCE(NEW.distance_km, 0) * v_rate)::INTEGER
    ELSE 0
  END;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.classify_trip_for_payroll()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_policy JSONB;
  v_rate INTEGER := 30;
  v_type TEXT;
BEGIN
  v_type := COALESCE(NULLIF(NEW.travel_type, ''),
    CASE
      WHEN lower(COALESCE(NEW.purpose, '')) LIKE '%mit klient%' THEN 'with_client'
      WHEN lower(COALESCE(NEW.purpose, '')) LIKE '%zwischen%klient%' THEN 'client_to_client'
      WHEN lower(COALESCE(NEW.purpose, '')) IN ('einsatz', 'anfahrt zum einsatz') THEN 'office_to_client'
      ELSE 'other_business'
    END
  );
  NEW.travel_type := v_type;
  IF NEW.employee_id IS NULL THEN
    NEW.logbook_eligible := TRUE;
    NEW.payroll_eligible := FALSE;
    NEW.work_time_eligible := FALSE;
    NEW.client_billing_eligible := FALSE;
    NEW.mileage_amount_cents := 0;
    RETURN NEW;
  END IF;
  v_policy := public.resolve_employee_travel_compensation_policy(NEW.tenant_id, NEW.employee_id);
  SELECT COALESCE(mileage_rate_cents, 30) INTO v_rate
  FROM public.employee_payroll_settings
  WHERE tenant_id = NEW.tenant_id AND employee_id = NEW.employee_id;
  v_rate := COALESCE(v_rate, 30);
  NEW.policy_snapshot := v_policy;
  NEW.mileage_rate_cents := v_rate;
  NEW.logbook_eligible := COALESCE(v_policy->'logbookRouteTypes', '[]'::jsonb) ? v_type;
  NEW.payroll_eligible := COALESCE(v_policy->'payrollRouteTypes', '[]'::jsonb) ? v_type;
  NEW.work_time_eligible := COALESCE(v_policy->'workTimeRouteTypes', '[]'::jsonb) ? v_type;
  NEW.client_billing_eligible := COALESCE(v_policy->'clientBillingRouteTypes', '[]'::jsonb) ? v_type;
  NEW.mileage_amount_cents := CASE WHEN NEW.payroll_eligible
    THEN ROUND(COALESCE(NEW.distance_km, 0) * v_rate)::INTEGER ELSE 0 END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS classify_trip_payroll ON public.trips;
CREATE TRIGGER classify_trip_payroll
BEFORE INSERT OR UPDATE OF employee_id, purpose, travel_type, distance_km, status
ON public.trips
FOR EACH ROW EXECUTE FUNCTION public.classify_trip_for_payroll();

CREATE OR REPLACE FUNCTION public.sync_completed_trip_to_driving_log()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.employee_id IS NULL OR NEW.status <> 'abgeschlossen' OR NEW.ended_at IS NULL THEN
    RETURN NEW;
  END IF;
  UPDATE public.assist_driving_log SET
    employee_id = NEW.employee_id,
    purpose = NEW.purpose,
    travel_type = NEW.travel_type,
    started_at = NEW.started_at,
    ended_at = NEW.ended_at,
    distance_km = NEW.distance_km,
    start_address = NEW.start_address,
    end_address = NEW.end_address,
    status = 'completed',
    updated_at = NOW()
  WHERE tenant_id = NEW.tenant_id AND trip_id = NEW.id;
  IF NOT FOUND THEN
    INSERT INTO public.assist_driving_log (
      tenant_id, trip_id, employee_id, purpose, travel_type, started_at, ended_at,
      distance_km, start_address, end_address, status, notes
    ) VALUES (
      NEW.tenant_id, NEW.id, NEW.employee_id, NEW.purpose, NEW.travel_type,
      NEW.started_at, NEW.ended_at, NEW.distance_km, NEW.start_address, NEW.end_address,
      'completed', NEW.notes
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_completed_trip_driving_log ON public.trips;
CREATE TRIGGER sync_completed_trip_driving_log
AFTER INSERT OR UPDATE OF employee_id, purpose, travel_type, distance_km, status, ended_at
ON public.trips
FOR EACH ROW EXECUTE FUNCTION public.sync_completed_trip_to_driving_log();

DROP TRIGGER IF EXISTS classify_assist_driving_log_payroll ON public.assist_driving_log;
CREATE TRIGGER classify_assist_driving_log_payroll
BEFORE INSERT OR UPDATE OF employee_id, purpose, travel_type, distance_km, status
ON public.assist_driving_log
FOR EACH ROW EXECUTE FUNCTION public.classify_assist_driving_log_for_payroll();

CREATE OR REPLACE FUNCTION public.sync_driving_log_to_payroll_expense()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_expense_date DATE;
BEGIN
  IF NEW.employee_id IS NULL OR NEW.status NOT IN ('completed', 'corrected')
    OR NOT NEW.payroll_eligible OR COALESCE(NEW.distance_km, 0) <= 0
    OR COALESCE(NEW.mileage_amount_cents, 0) <= 0
  THEN
    UPDATE public.employee_expense_claims
    SET status = CASE WHEN status = 'reimbursed' THEN status ELSE 'rejected' END,
        rejection_reason = CASE WHEN status = 'reimbursed' THEN rejection_reason ELSE 'Fahrt ist nach der gültigen Fahrtkostenregel nicht vergütungsfähig.' END,
        updated_at = NOW()
    WHERE tenant_id = NEW.tenant_id AND driving_log_id = NEW.id;
    RETURN NEW;
  END IF;

  v_expense_date := COALESCE(NEW.ended_at, NEW.started_at, NEW.created_at)::DATE;
  INSERT INTO public.employee_expense_claims (
    tenant_id, employee_id, expense_date, category, description,
    amount_cents, approved_amount_cents, mileage_km, mileage_rate_cents,
    origin, destination, business_purpose, tax_treatment, status,
    reviewed_at, assignment_id, driving_log_id, travel_type, automatic_source
  ) VALUES (
    NEW.tenant_id, NEW.employee_id, v_expense_date, 'mileage',
    'Automatische Kilometervergütung aus Fahrtenbuch',
    NEW.mileage_amount_cents, NEW.mileage_amount_cents, NEW.distance_km, NEW.mileage_rate_cents,
    NEW.start_address, NEW.end_address, COALESCE(NULLIF(NEW.purpose, ''), 'Dienstliche Fahrt'),
    'reimbursement', 'approved', NOW(), NEW.visit_id, NEW.id, NEW.travel_type, TRUE
  )
  ON CONFLICT (tenant_id, driving_log_id) WHERE driving_log_id IS NOT NULL
  DO UPDATE SET
    employee_id = EXCLUDED.employee_id,
    expense_date = EXCLUDED.expense_date,
    amount_cents = EXCLUDED.amount_cents,
    approved_amount_cents = EXCLUDED.approved_amount_cents,
    mileage_km = EXCLUDED.mileage_km,
    mileage_rate_cents = EXCLUDED.mileage_rate_cents,
    origin = EXCLUDED.origin,
    destination = EXCLUDED.destination,
    business_purpose = EXCLUDED.business_purpose,
    tax_treatment = 'reimbursement',
    status = CASE WHEN public.employee_expense_claims.status = 'reimbursed' THEN 'reimbursed' ELSE 'approved' END,
    rejection_reason = NULL,
    travel_type = EXCLUDED.travel_type,
    automatic_source = TRUE,
    updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_assist_driving_log_payroll_expense ON public.assist_driving_log;
CREATE TRIGGER sync_assist_driving_log_payroll_expense
AFTER INSERT OR UPDATE OF employee_id, purpose, travel_type, distance_km, status, ended_at
ON public.assist_driving_log
FOR EACH ROW EXECUTE FUNCTION public.sync_driving_log_to_payroll_expense();

UPDATE public.tenant_service_catalog
SET travel_policy_json = public.default_travel_compensation_policy()
WHERE category = 'travel' AND travel_policy_json IS NULL;

UPDATE public.workforce_travel_rules
SET travel_policy_json = public.default_travel_compensation_policy()
WHERE travel_policy_json IS NULL;

GRANT EXECUTE ON FUNCTION public.resolve_employee_travel_compensation_policy(UUID, UUID) TO authenticated;

COMMIT;
