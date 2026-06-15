-- ==========================================================================
-- CareSuite+ — Migration 0039: Client context, intake, record, locale catalogs
-- Non-destructive extension for kontextbasierte Klient:innenaufnahme
-- ==========================================================================

-- Care contexts (Leistungsarten)
CREATE TABLE IF NOT EXISTS public.client_care_contexts (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  client_id   UUID        NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  context_key TEXT        NOT NULL
              CHECK (context_key IN (
                'daily_assistance','support_care','companionship',
                'ambulatory_care','stationary_care','consulting','academy_prepared'
              )),
  is_primary  BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, client_id, context_key)
);

-- Ambulatory details
CREATE TABLE IF NOT EXISTS public.client_ambulatory_details (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  client_id           UUID        NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE UNIQUE,
  home_access         TEXT,
  key_status          TEXT,
  key_number          TEXT,
  key_safe_code       TEXT,
  door_code           TEXT,
  bell_name           TEXT,
  floor               TEXT,
  elevator_available  BOOLEAN     NOT NULL DEFAULT FALSE,
  parking_notes       TEXT,
  access_notes        TEXT,
  hazard_notes        TEXT,
  pets                TEXT,
  smoker_household    BOOLEAN     NOT NULL DEFAULT FALSE,
  aids_on_site        TEXT,
  hygiene_notes       TEXT,
  infection_notes     TEXT,
  family_doctor       TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Stationary details
CREATE TABLE IF NOT EXISTS public.client_stationary_details (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  client_id           UUID        NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE UNIQUE,
  facility_name       TEXT,
  facility_location   TEXT,
  care_area           TEXT,
  floor               TEXT,
  room_number         TEXT,
  bed_position        TEXT,
  admission_date      DATE,
  resident_status     TEXT,
  room_status         TEXT,
  primary_nurse       TEXT,
  area_manager        TEXT,
  cost_form           TEXT,
  meal_notes          TEXT,
  daily_structure     TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Support preferences
CREATE TABLE IF NOT EXISTS public.client_support_preferences (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  client_id           UUID        NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE UNIQUE,
  support_wishes      TEXT[]      NOT NULL DEFAULT '{}',
  preferred_times     TEXT[]      NOT NULL DEFAULT '{}',
  excluded_times      TEXT[]      NOT NULL DEFAULT '{}',
  mobility            TEXT,
  orientation         TEXT,
  communication       TEXT,
  special_wishes      TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Insurance profiles
CREATE TABLE IF NOT EXISTS public.client_insurance_profiles (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  client_id             UUID        NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  care_level            TEXT,
  care_level_status     TEXT,
  care_level_valid_from DATE,
  care_level_applied    BOOLEAN     NOT NULL DEFAULT FALSE,
  decision_available    BOOLEAN     NOT NULL DEFAULT FALSE,
  care_fund_name        TEXT,
  health_insurance      TEXT,
  cost_bearer_ik        TEXT,
  insurance_number      TEXT,
  billing_type          TEXT,
  self_pay              BOOLEAN     NOT NULL DEFAULT FALSE,
  relief_budget_prepared BOOLEAN    NOT NULL DEFAULT FALSE,
  substitution_prepared BOOLEAN    NOT NULL DEFAULT FALSE,
  prevention_prepared   BOOLEAN     NOT NULL DEFAULT FALSE,
  is_primary            BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Medical notes
CREATE TABLE IF NOT EXISTS public.client_medical_notes (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  client_id   UUID        NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  note_type   TEXT        NOT NULL DEFAULT 'hinweis',
  content     TEXT        NOT NULL,
  source      TEXT,
  relevant    BOOLEAN     NOT NULL DEFAULT TRUE,
  status      TEXT        NOT NULL DEFAULT 'aktiv',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ICD codes
CREATE TABLE IF NOT EXISTS public.client_icd_codes (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  client_id   UUID        NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  code        TEXT        NOT NULL,
  label       TEXT        NOT NULL,
  source      TEXT,
  recorded_at DATE,
  relevant    BOOLEAN     NOT NULL DEFAULT TRUE,
  note        TEXT,
  status      TEXT        NOT NULL DEFAULT 'aktiv',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Medications (extended)
CREATE TABLE IF NOT EXISTS public.client_medications (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  client_id       UUID        NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  name            TEXT        NOT NULL,
  active_substance TEXT,
  form            TEXT,
  dosage          TEXT,
  unit            TEXT,
  schedule_schema TEXT,
  as_needed       BOOLEAN     NOT NULL DEFAULT FALSE,
  start_date      DATE,
  end_date        DATE,
  prescription_source TEXT,
  doctor          TEXT,
  note            TEXT,
  status          TEXT        NOT NULL DEFAULT 'aktiv',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.client_medication_schedules (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  medication_id   UUID        NOT NULL REFERENCES public.client_medications(id) ON DELETE CASCADE,
  time_slot       TEXT        NOT NULL CHECK (time_slot IN ('morgens','mittags','abends','nachts')),
  amount          NUMERIC(10,2),
  unit            TEXT,
  time_of_day     TIME,
  note            TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Vital signs (extended client table)
CREATE TABLE IF NOT EXISTS public.client_vital_signs (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  client_id       UUID        NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  vital_type      TEXT        NOT NULL,
  value           TEXT        NOT NULL,
  unit            TEXT,
  recorded_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  recorded_by     UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  note            TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Prescriptions
CREATE TABLE IF NOT EXISTS public.client_prescriptions (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  client_id       UUID        NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  prescription_type TEXT      NOT NULL,
  title           TEXT        NOT NULL,
  issued_at       DATE,
  valid_until     DATE,
  doctor          TEXT,
  document_id     UUID,
  status          TEXT        NOT NULL DEFAULT 'aktiv',
  note            TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Service records
CREATE TABLE IF NOT EXISTS public.client_service_records (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  client_id       UUID        NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  service_date    DATE        NOT NULL,
  service_type    TEXT        NOT NULL,
  duration_minutes INTEGER,
  description     TEXT,
  billing_status  TEXT        NOT NULL DEFAULT 'offen',
  document_id     UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Audit events
CREATE TABLE IF NOT EXISTS public.client_audit_events (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  client_id   UUID        NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  action      TEXT        NOT NULL,
  actor_id    UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  actor_name  TEXT,
  details     TEXT,
  metadata    JSONB       NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Extend clients with intake fields
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS client_number TEXT,
  ADD COLUMN IF NOT EXISTS admission_date DATE,
  ADD COLUMN IF NOT EXISTS service_start DATE,
  ADD COLUMN IF NOT EXISTS birth_place TEXT,
  ADD COLUMN IF NOT EXISTS nationality TEXT,
  ADD COLUMN IF NOT EXISTS language TEXT,
  ADD COLUMN IF NOT EXISTS marital_status TEXT,
  ADD COLUMN IF NOT EXISTS housing_form TEXT,
  ADD COLUMN IF NOT EXISTS special_notes TEXT;

-- Extend client_documents
ALTER TABLE public.client_documents
  ADD COLUMN IF NOT EXISTS size_bytes BIGINT,
  ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'upload',
  ADD COLUMN IF NOT EXISTS module_visibility TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS portal_visible BOOLEAN NOT NULL DEFAULT FALSE;

DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'client_care_contexts','client_ambulatory_details','client_stationary_details',
    'client_support_preferences','client_insurance_profiles','client_medical_notes',
    'client_icd_codes','client_medications','client_medication_schedules',
    'client_vital_signs','client_prescriptions','client_service_records','client_audit_events'
  ]
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);

    EXECUTE format('DROP POLICY IF EXISTS "%s_select" ON public.%I', tbl, tbl);
    EXECUTE format(
      'CREATE POLICY "%s_select" ON public.%I FOR SELECT USING (
        tenant_id = public.current_tenant_id()
        AND public.has_permission(''office.clients.view'')
      )', tbl, tbl
    );

    EXECUTE format('DROP POLICY IF EXISTS "%s_write" ON public.%I', tbl, tbl);
    EXECUTE format(
      'CREATE POLICY "%s_write" ON public.%I FOR ALL USING (
        tenant_id = public.current_tenant_id()
        AND public.has_permission(''office.clients.edit'')
      ) WITH CHECK (
        tenant_id = public.current_tenant_id()
        AND public.has_permission(''office.clients.edit'')
      )', tbl, tbl
    );
  END LOOP;
END $$;
