-- ==========================================================================
-- CareSuite HealthOS — Einsatzprofil-Direktfreigabe vollständig reparieren
-- ==========================================================================
-- Der Freigabe-RPC liest und schreibt mehrere Tabellen atomar. Ältere
-- Production-Historien enthielten teilweise nur die Assist-Zielspalten aus
-- R12, nicht jedoch alle vom Legacy-Core gelesenen Klient:innenfelder und
-- geschriebenen Kalender-/Assignmentfelder. PL/pgSQL meldete deshalb erst
-- beim tatsächlichen Drop einen 42P01/42703-Datenbankfehler.

BEGIN;

CREATE TABLE IF NOT EXISTS public.client_ambulatory_details (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, client_id)
);

ALTER TABLE public.client_ambulatory_details
  ADD COLUMN IF NOT EXISTS home_access TEXT,
  ADD COLUMN IF NOT EXISTS key_status TEXT,
  ADD COLUMN IF NOT EXISTS key_number TEXT,
  ADD COLUMN IF NOT EXISTS key_safe_code TEXT,
  ADD COLUMN IF NOT EXISTS door_code TEXT,
  ADD COLUMN IF NOT EXISTS bell_name TEXT,
  ADD COLUMN IF NOT EXISTS floor TEXT,
  ADD COLUMN IF NOT EXISTS parking_notes TEXT,
  ADD COLUMN IF NOT EXISTS access_notes TEXT,
  ADD COLUMN IF NOT EXISTS hazard_notes TEXT,
  ADD COLUMN IF NOT EXISTS pets TEXT;

CREATE TABLE IF NOT EXISTS public.client_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, client_id)
);

ALTER TABLE public.client_preferences
  ADD COLUMN IF NOT EXISTS mobility_notes TEXT,
  ADD COLUMN IF NOT EXISTS household_notes TEXT,
  ADD COLUMN IF NOT EXISTS pet_notes TEXT,
  ADD COLUMN IF NOT EXISTS access_instructions TEXT;

CREATE TABLE IF NOT EXISTS public.client_risks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  category TEXT NOT NULL DEFAULT 'sonstige',
  level TEXT NOT NULL DEFAULT 'mittel',
  description TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.client_risks
  ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'sonstige',
  ADD COLUMN IF NOT EXISTS level TEXT NOT NULL DEFAULT 'mittel',
  ADD COLUMN IF NOT EXISTS description TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS mitigation TEXT,
  ADD COLUMN IF NOT EXISTS assessed_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS visible_notes_for_employee TEXT,
  ADD COLUMN IF NOT EXISTS emergency_notes TEXT,
  ADD COLUMN IF NOT EXISTS allergies TEXT,
  ADD COLUMN IF NOT EXISTS mobility_notes TEXT,
  ADD COLUMN IF NOT EXISTS pets TEXT,
  ADD COLUMN IF NOT EXISTS key_management_notes TEXT,
  ADD COLUMN IF NOT EXISTS internal_notes TEXT;

ALTER TABLE public.assignments
  ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS employee_id UUID REFERENCES public.employees(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS assignment_date DATE,
  ADD COLUMN IF NOT EXISTS planned_start_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS planned_end_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS address_snapshot TEXT,
  ADD COLUMN IF NOT EXISTS internal_notes TEXT,
  ADD COLUMN IF NOT EXISTS client_visible_notes TEXT,
  ADD COLUMN IF NOT EXISTS assignment_profile_id UUID
    REFERENCES public.client_assignment_profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS operational_context JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.assignment_tasks
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS assignment_id UUID REFERENCES public.assignments(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS title TEXT,
  ADD COLUMN IF NOT EXISTS status TEXT,
  ADD COLUMN IF NOT EXISTS is_required BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS requires_note_if_not_done BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;

ALTER TABLE public.calendar_events
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS internal_note TEXT,
  ADD COLUMN IF NOT EXISTS public_note TEXT,
  ADD COLUMN IF NOT EXISTS address TEXT,
  ADD COLUMN IF NOT EXISTS related_client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS related_employee_id UUID REFERENCES public.employees(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_office_visible BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS is_module_visible BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS is_client_portal_visible BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_employee_portal_visible BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS color_key TEXT,
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.assist_visits
  ADD COLUMN IF NOT EXISTS subject_key TEXT,
  ADD COLUMN IF NOT EXISTS assignment_type_key TEXT,
  ADD COLUMN IF NOT EXISTS service_category_key TEXT,
  ADD COLUMN IF NOT EXISTS task_package_id UUID REFERENCES public.catalog_items(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS billing_budget_source_key TEXT,
  ADD COLUMN IF NOT EXISTS documentation_template_key TEXT,
  ADD COLUMN IF NOT EXISTS proof_template_key TEXT,
  ADD COLUMN IF NOT EXISTS risk_flag_keys JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS catalog_snapshot_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.assist_visit_tasks
  ADD COLUMN IF NOT EXISTS catalog_item_id UUID REFERENCES public.catalog_items(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS item_key TEXT,
  ADD COLUMN IF NOT EXISTS is_optional BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS payload_json JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE UNIQUE INDEX IF NOT EXISTS idx_calendar_events_release_source_unique
  ON public.calendar_events (tenant_id, source_type, source_id);

CREATE INDEX IF NOT EXISTS idx_assignment_profile_release_overlap_employee
  ON public.assignments (tenant_id, employee_id, planned_start_at, planned_end_at);

CREATE INDEX IF NOT EXISTS idx_assignment_profile_release_overlap_client
  ON public.assignments (tenant_id, client_id, planned_start_at, planned_end_at);

GRANT SELECT, INSERT, UPDATE ON public.assignments TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.assignment_tasks TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.calendar_events TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.assist_visits TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.assist_visit_tasks TO authenticated;
GRANT SELECT, INSERT ON public.assist_visit_status_history TO authenticated;
GRANT SELECT, INSERT ON public.assist_visit_audit_logs TO authenticated;

DO $release_contract$
DECLARE
  v_missing TEXT[];
BEGIN
  SELECT array_agg(required.column_name ORDER BY required.table_name, required.column_name)
    INTO v_missing
  FROM (
    VALUES
      ('assignments', 'assignment_profile_id'),
      ('assignments', 'operational_context'),
      ('calendar_events', 'related_employee_id'),
      ('assist_visits', 'catalog_snapshot_json'),
      ('assist_visit_tasks', 'payload_json'),
      ('client_ambulatory_details', 'hazard_notes'),
      ('client_preferences', 'access_instructions'),
      ('client_risks', 'assessed_at')
  ) AS required(table_name, column_name)
  WHERE NOT EXISTS (
    SELECT 1
    FROM information_schema.columns c
    WHERE c.table_schema = 'public'
      AND c.table_name = required.table_name
      AND c.column_name = required.column_name
  );

  IF COALESCE(array_length(v_missing, 1), 0) > 0 THEN
    RAISE EXCEPTION 'Einsatzprofil-Freigabeschema unvollständig: %', v_missing;
  END IF;

  IF to_regprocedure(
    'public.schedule_client_assignment_profile(uuid,uuid,date,time without time zone)'
  ) IS NULL THEN
    RAISE EXCEPTION 'Freigabe-RPC schedule_client_assignment_profile fehlt';
  END IF;
END;
$release_contract$;

NOTIFY pgrst, 'reload schema';

COMMIT;
