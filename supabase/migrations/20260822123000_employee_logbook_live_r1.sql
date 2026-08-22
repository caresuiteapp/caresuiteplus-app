-- CareSuite HealthOS · Digitales Mitarbeiter-Fahrtenbuch R1
-- Live, mandantenfähig, revisionssicher, idempotent.

BEGIN;

CREATE TABLE IF NOT EXISTS public.employee_logbook_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  default_vehicle_id UUID,
  mileage_rate_cents INTEGER NOT NULL DEFAULT 30 CHECK (mileage_rate_cents >= 0),
  gps_consent BOOLEAN NOT NULL DEFAULT FALSE,
  gps_consent_at TIMESTAMPTZ,
  license_front_path TEXT,
  license_back_path TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, employee_id)
);

CREATE TABLE IF NOT EXISTS public.employee_logbook_vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  ownership TEXT NOT NULL DEFAULT 'private' CHECK (ownership IN ('private','company')),
  plate TEXT NOT NULL CHECK (char_length(trim(plate)) >= 2),
  make TEXT,
  model TEXT,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, employee_id, plate),
  UNIQUE (id, tenant_id, employee_id)
);

ALTER TABLE public.employee_logbook_profiles
  DROP CONSTRAINT IF EXISTS employee_logbook_profiles_default_vehicle_id_fkey;
ALTER TABLE public.employee_logbook_profiles
  ADD CONSTRAINT employee_logbook_profiles_default_vehicle_id_fkey
  FOREIGN KEY (default_vehicle_id, tenant_id, employee_id)
  REFERENCES public.employee_logbook_vehicles(id, tenant_id, employee_id) ON DELETE RESTRICT;

CREATE TABLE IF NOT EXISTS public.employee_logbook_trips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  assignment_id UUID,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  vehicle_id UUID,
  route_type TEXT NOT NULL CHECK (route_type IN (
    'home_to_office','office_to_home','home_to_client','client_to_home',
    'office_to_client','client_to_office','client_to_client','with_client',
    'other_business','private_non_business'
  )),
  purpose TEXT NOT NULL CHECK (char_length(trim(purpose)) >= 3),
  manual_reason TEXT,
  status TEXT NOT NULL DEFAULT 'recording' CHECK (status IN ('recording','completed','corrected','confirmed','cancelled')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  start_address TEXT,
  end_address TEXT,
  start_latitude NUMERIC(10,7),
  start_longitude NUMERIC(10,7),
  end_latitude NUMERIC(10,7),
  end_longitude NUMERIC(10,7),
  distance_gps_km NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (distance_gps_km >= 0),
  distance_final_km NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (distance_final_km >= 0),
  duration_seconds INTEGER NOT NULL DEFAULT 0 CHECK (duration_seconds >= 0),
  counts_as_work_time BOOLEAN NOT NULL DEFAULT FALSE,
  worktime_deduction_minutes INTEGER NOT NULL DEFAULT 0 CHECK (worktime_deduction_minutes >= 0),
  mileage_rate_cents INTEGER NOT NULL DEFAULT 30 CHECK (mileage_rate_cents >= 0),
  mileage_amount_cents INTEGER NOT NULL DEFAULT 0 CHECK (mileage_amount_cents >= 0),
  gps_captured BOOLEAN NOT NULL DEFAULT FALSE,
  navigation_provider TEXT,
  source TEXT NOT NULL DEFAULT 'employee_portal',
  correction_reason TEXT,
  corrected_at TIMESTAMPTZ,
  corrected_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  previous_values JSONB,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (assignment_id IS NOT NULL OR char_length(trim(COALESCE(manual_reason, ''))) >= 3),
  CHECK (ended_at IS NULL OR ended_at >= started_at),
  UNIQUE (id, tenant_id, employee_id),
  FOREIGN KEY (vehicle_id, tenant_id, employee_id)
    REFERENCES public.employee_logbook_vehicles(id, tenant_id, employee_id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS public.employee_logbook_segments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  trip_id UUID NOT NULL,
  sequence_no INTEGER NOT NULL CHECK (sequence_no > 0),
  assignment_id UUID,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  stop_kind TEXT NOT NULL DEFAULT 'other' CHECK (stop_kind IN ('client','doctor','pharmacy','shopping','office','home','other')),
  label TEXT NOT NULL,
  start_address TEXT,
  end_address TEXT,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  distance_km NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (distance_km >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  FOREIGN KEY (trip_id, tenant_id, employee_id)
    REFERENCES public.employee_logbook_trips(id, tenant_id, employee_id) ON DELETE CASCADE,
  UNIQUE (trip_id, sequence_no)
);

CREATE TABLE IF NOT EXISTS public.employee_logbook_points (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  trip_id UUID NOT NULL,
  segment_id UUID REFERENCES public.employee_logbook_segments(id) ON DELETE SET NULL,
  latitude NUMERIC(10,7) NOT NULL,
  longitude NUMERIC(10,7) NOT NULL,
  accuracy NUMERIC(8,2),
  altitude NUMERIC(10,2),
  speed NUMERIC(9,3),
  heading NUMERIC(8,2),
  recorded_at TIMESTAMPTZ NOT NULL,
  source TEXT NOT NULL DEFAULT 'device_gps',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  FOREIGN KEY (trip_id, tenant_id, employee_id)
    REFERENCES public.employee_logbook_trips(id, tenant_id, employee_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.employee_logbook_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  trip_id UUID,
  category TEXT NOT NULL CHECK (category IN ('parking','toll','fuel','other')),
  amount_cents INTEGER NOT NULL DEFAULT 0 CHECK (amount_cents >= 0),
  expense_date DATE NOT NULL,
  storage_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  mime_type TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  FOREIGN KEY (trip_id, tenant_id, employee_id)
    REFERENCES public.employee_logbook_trips(id, tenant_id, employee_id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS public.employee_logbook_daily_confirmations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  work_date DATE NOT NULL,
  signer_name TEXT NOT NULL CHECK (char_length(trim(signer_name)) >= 2),
  signature_data TEXT NOT NULL CHECK (char_length(signature_data) >= 20),
  trip_count INTEGER NOT NULL CHECK (trip_count > 0),
  distance_km NUMERIC(10,2) NOT NULL CHECK (distance_km >= 0),
  confirmed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  confirmation_hash TEXT NOT NULL DEFAULT md5(gen_random_uuid()::text),
  UNIQUE (tenant_id, employee_id, work_date)
);

CREATE TABLE IF NOT EXISTS public.employee_logbook_audit_events (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  trip_id UUID,
  action TEXT NOT NULL,
  previous_values JSONB,
  new_values JSONB,
  actor_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  FOREIGN KEY (trip_id, tenant_id, employee_id)
    REFERENCES public.employee_logbook_trips(id, tenant_id, employee_id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_employee_logbook_trips_employee_date ON public.employee_logbook_trips (tenant_id, employee_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_employee_logbook_trips_assignment ON public.employee_logbook_trips (tenant_id, assignment_id) WHERE assignment_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_employee_logbook_points_trip_time ON public.employee_logbook_points (trip_id, recorded_at);
CREATE INDEX IF NOT EXISTS idx_employee_logbook_receipts_employee_date ON public.employee_logbook_receipts (tenant_id, employee_id, expense_date DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_assist_driving_log_employee_logbook_source
  ON public.assist_driving_log (tenant_id, notes)
  WHERE notes LIKE 'employee_logbook_trip:%';

CREATE OR REPLACE FUNCTION public.prepare_employee_logbook_trip()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_rate INTEGER := 30;
BEGIN
  SELECT COALESCE(p.mileage_rate_cents, s.mileage_rate_cents, 30) INTO v_rate
  FROM (SELECT NEW.tenant_id tenant_id, NEW.employee_id employee_id) x
  LEFT JOIN public.employee_logbook_profiles p ON p.tenant_id=x.tenant_id AND p.employee_id=x.employee_id
  LEFT JOIN public.employee_payroll_settings s ON s.tenant_id=x.tenant_id AND s.employee_id=x.employee_id;
  NEW.mileage_rate_cents := COALESCE(v_rate, 30);
  NEW.duration_seconds := CASE WHEN NEW.ended_at IS NULL THEN 0 ELSE GREATEST(0, EXTRACT(EPOCH FROM (NEW.ended_at - NEW.started_at))::INTEGER) END;
  NEW.counts_as_work_time := NEW.route_type NOT IN ('home_to_office','office_to_home','home_to_client','client_to_home','private_non_business');
  NEW.worktime_deduction_minutes := CASE WHEN NEW.counts_as_work_time THEN 0 ELSE CEIL(NEW.duration_seconds / 60.0)::INTEGER END;
  NEW.mileage_amount_cents := CASE WHEN NEW.route_type='private_non_business' THEN 0 ELSE ROUND(NEW.distance_final_km * NEW.mileage_rate_cents)::INTEGER END;
  NEW.updated_at := NOW();
  RETURN NEW;
END $$;

-- Compatibility repair: no column reference that can drift between releases.
DROP TRIGGER IF EXISTS employee_logbook_prepare_trip ON public.employee_logbook_trips;
CREATE TRIGGER employee_logbook_prepare_trip BEFORE INSERT OR UPDATE OF ended_at, route_type, distance_final_km, employee_id
ON public.employee_logbook_trips FOR EACH ROW EXECUTE FUNCTION public.prepare_employee_logbook_trip();

CREATE OR REPLACE FUNCTION public.audit_employee_logbook_trip()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP='INSERT' THEN
    INSERT INTO public.employee_logbook_audit_events(tenant_id,employee_id,trip_id,action,new_values,actor_user_id)
    VALUES(NEW.tenant_id,NEW.employee_id,NEW.id,'created',to_jsonb(NEW),auth.uid());
  ELSIF OLD IS DISTINCT FROM NEW THEN
    INSERT INTO public.employee_logbook_audit_events(tenant_id,employee_id,trip_id,action,previous_values,new_values,actor_user_id)
    VALUES(NEW.tenant_id,NEW.employee_id,NEW.id,CASE WHEN NEW.status='corrected' THEN 'corrected' ELSE 'updated' END,to_jsonb(OLD),to_jsonb(NEW),auth.uid());
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS employee_logbook_audit_trip ON public.employee_logbook_trips;
CREATE TRIGGER employee_logbook_audit_trip AFTER INSERT OR UPDATE ON public.employee_logbook_trips
FOR EACH ROW EXECUTE FUNCTION public.audit_employee_logbook_trip();

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
      reviewed_at,assignment_id,driving_log_id,travel_type,automatic_source
    ) VALUES(
      NEW.tenant_id,NEW.employee_id,NEW.started_at::date,'mileage','Automatische Kilometervergütung aus Mitarbeiter-Fahrtenbuch',
      NEW.mileage_amount_cents,NEW.mileage_amount_cents,NEW.distance_final_km,NEW.mileage_rate_cents,
      NEW.start_address,NEW.end_address,NEW.purpose,'reimbursement','approved',NOW(),NEW.assignment_id,v_log_id,NEW.route_type,TRUE
    ) ON CONFLICT(tenant_id,driving_log_id) WHERE driving_log_id IS NOT NULL DO UPDATE SET
      amount_cents=EXCLUDED.amount_cents,approved_amount_cents=EXCLUDED.approved_amount_cents,
      mileage_km=EXCLUDED.mileage_km,mileage_rate_cents=EXCLUDED.mileage_rate_cents,
      origin=EXCLUDED.origin,destination=EXCLUDED.destination,business_purpose=EXCLUDED.business_purpose,
      status=CASE WHEN public.employee_expense_claims.status='reimbursed' THEN 'reimbursed' ELSE 'approved' END,
      rejection_reason=NULL,updated_at=NOW();
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS employee_logbook_sync_payroll ON public.employee_logbook_trips;
CREATE TRIGGER employee_logbook_sync_payroll AFTER INSERT OR UPDATE OF status,ended_at,distance_final_km,route_type
ON public.employee_logbook_trips FOR EACH ROW EXECUTE FUNCTION public.sync_employee_logbook_to_payroll();

CREATE OR REPLACE FUNCTION public.employee_logbook_own_employee(p_tenant UUID,p_employee UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT p_tenant=public.current_tenant_id() AND (
    NOT public.is_employee_portal_rls_context(p_tenant)
    OR p_employee=public.resolve_current_employee_id()
  );
$$;

ALTER TABLE public.employee_logbook_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_logbook_vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_logbook_trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_logbook_segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_logbook_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_logbook_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_logbook_daily_confirmations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_logbook_audit_events ENABLE ROW LEVEL SECURITY;

DO $$ DECLARE t TEXT; BEGIN
  FOREACH t IN ARRAY ARRAY['employee_logbook_profiles','employee_logbook_vehicles','employee_logbook_trips','employee_logbook_segments','employee_logbook_receipts'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I',t||'_access',t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (public.employee_logbook_own_employee(tenant_id,employee_id)) WITH CHECK (public.employee_logbook_own_employee(tenant_id,employee_id))',t||'_access',t);
  END LOOP;
END $$;

DROP POLICY IF EXISTS employee_logbook_points_select ON public.employee_logbook_points;
CREATE POLICY employee_logbook_points_select ON public.employee_logbook_points FOR SELECT TO authenticated USING (public.employee_logbook_own_employee(tenant_id,employee_id));
DROP POLICY IF EXISTS employee_logbook_points_insert ON public.employee_logbook_points;
CREATE POLICY employee_logbook_points_insert ON public.employee_logbook_points FOR INSERT TO authenticated WITH CHECK (public.employee_logbook_own_employee(tenant_id,employee_id));

DROP POLICY IF EXISTS employee_logbook_confirmations_select ON public.employee_logbook_daily_confirmations;
CREATE POLICY employee_logbook_confirmations_select ON public.employee_logbook_daily_confirmations FOR SELECT TO authenticated USING (public.employee_logbook_own_employee(tenant_id,employee_id));
DROP POLICY IF EXISTS employee_logbook_confirmations_insert ON public.employee_logbook_daily_confirmations;
CREATE POLICY employee_logbook_confirmations_insert ON public.employee_logbook_daily_confirmations FOR INSERT TO authenticated WITH CHECK (public.employee_logbook_own_employee(tenant_id,employee_id));

DROP POLICY IF EXISTS employee_logbook_audit_internal_select ON public.employee_logbook_audit_events;
CREATE POLICY employee_logbook_audit_internal_select ON public.employee_logbook_audit_events FOR SELECT TO authenticated USING (tenant_id=public.current_tenant_id() AND NOT public.is_employee_portal_rls_context(tenant_id));

GRANT SELECT,INSERT,UPDATE,DELETE ON public.employee_logbook_profiles,public.employee_logbook_vehicles,public.employee_logbook_trips,public.employee_logbook_segments,public.employee_logbook_receipts TO authenticated;
GRANT SELECT,INSERT ON public.employee_logbook_points,public.employee_logbook_daily_confirmations TO authenticated;
GRANT SELECT ON public.employee_logbook_audit_events TO authenticated;
GRANT USAGE,SELECT ON SEQUENCE public.employee_logbook_points_id_seq, public.employee_logbook_audit_events_id_seq TO authenticated;
GRANT EXECUTE ON FUNCTION public.employee_logbook_own_employee(UUID,UUID) TO authenticated;

INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
VALUES('employee-logbook','employee-logbook',FALSE,10485760,ARRAY['image/jpeg','image/png','image/webp','application/pdf'])
ON CONFLICT(id) DO UPDATE SET public=FALSE,file_size_limit=10485760,allowed_mime_types=EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS employee_logbook_storage_select ON storage.objects;
CREATE POLICY employee_logbook_storage_select ON storage.objects FOR SELECT TO authenticated USING (
  bucket_id='employee-logbook' AND (storage.foldername(name))[1]=public.current_tenant_id()::text AND (
    NOT public.is_employee_portal_rls_context(public.current_tenant_id()) OR (storage.foldername(name))[2]=public.resolve_current_employee_id()::text
  )
);
DROP POLICY IF EXISTS employee_logbook_storage_insert ON storage.objects;
CREATE POLICY employee_logbook_storage_insert ON storage.objects FOR INSERT TO authenticated WITH CHECK (
  bucket_id='employee-logbook' AND (storage.foldername(name))[1]=public.current_tenant_id()::text AND (
    NOT public.is_employee_portal_rls_context(public.current_tenant_id()) OR (storage.foldername(name))[2]=public.resolve_current_employee_id()::text
  )
);

COMMIT;
