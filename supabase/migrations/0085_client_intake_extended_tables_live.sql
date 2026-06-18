-- ==========================================================================
-- CareSuite+ — Migration 0085: Intake extended tables auf Live
-- Step 11 persistIntakeClientExtendedData scheitert nach care_contexts an
-- fehlenden Tabellen aus Migration 0039 (nie auf Live angewendet):
--   client_insurance_profiles (immer), client_ambulatory_details,
--   client_stationary_details (kontextabhängig).
-- Pattern: 0081_client_care_contexts_live.sql
-- ==========================================================================

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

CREATE INDEX IF NOT EXISTS idx_client_insurance_profiles_client
  ON public.client_insurance_profiles (tenant_id, client_id);

CREATE INDEX IF NOT EXISTS idx_client_ambulatory_details_client
  ON public.client_ambulatory_details (tenant_id, client_id);

CREATE INDEX IF NOT EXISTS idx_client_stationary_details_client
  ON public.client_stationary_details (tenant_id, client_id);

DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'client_insurance_profiles',
    'client_ambulatory_details',
    'client_stationary_details'
  ]
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);

    EXECUTE format('DROP POLICY IF EXISTS "%s_select_tenant" ON public.%I', tbl, tbl);
    EXECUTE format(
      'CREATE POLICY "%s_select_tenant" ON public.%I FOR SELECT TO authenticated USING (
        tenant_id = public.current_tenant_id()
        AND public.has_permission(''office.clients.view'')
      )', tbl, tbl
    );

    EXECUTE format('DROP POLICY IF EXISTS "%s_write_tenant" ON public.%I', tbl, tbl);
    EXECUTE format(
      'CREATE POLICY "%s_write_tenant" ON public.%I FOR ALL TO authenticated USING (
        tenant_id = public.current_tenant_id()
        AND public.has_permission(''office.clients.edit'')
      ) WITH CHECK (
        tenant_id = public.current_tenant_id()
        AND public.has_permission(''office.clients.edit'')
      )', tbl, tbl
    );
  END LOOP;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON
  public.client_insurance_profiles,
  public.client_ambulatory_details,
  public.client_stationary_details
TO authenticated;
