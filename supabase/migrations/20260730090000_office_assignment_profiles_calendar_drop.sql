-- ==========================================================================
-- CareSuite HealthOS — Office Einsatzprofile + Kalender-Drop
-- ==========================================================================

-- Einige ältere Installationen besitzen diese produktiv bereits verwendeten
-- Aktenfelder noch nicht in ihrer lokalen Migrationshistorie. Der Ablauf bleibt
-- dadurch auch bei einem frischen Aufbau vollständig reproduzierbar.
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS visible_notes_for_employee TEXT,
  ADD COLUMN IF NOT EXISTS emergency_notes TEXT,
  ADD COLUMN IF NOT EXISTS allergies TEXT,
  ADD COLUMN IF NOT EXISTS mobility_notes TEXT,
  ADD COLUMN IF NOT EXISTS pets TEXT,
  ADD COLUMN IF NOT EXISTS key_management_notes TEXT;

CREATE TABLE IF NOT EXISTS public.client_assignment_profiles (
  id                          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                   UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  client_id                   UUID        NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  employee_id                 UUID        REFERENCES public.employees(id) ON DELETE SET NULL,
  profile_name                TEXT        NOT NULL,
  assignment_title            TEXT        NOT NULL,
  duration_minutes            INTEGER     NOT NULL DEFAULT 60
    CHECK (duration_minutes BETWEEN 15 AND 720),
  task_titles                 JSONB       NOT NULL DEFAULT '[]'::jsonb
    CHECK (jsonb_typeof(task_titles) = 'array'),
  location_address            TEXT,
  notes_for_employee          TEXT,
  internal_notes              TEXT,
  client_visible_notes        TEXT,
  billing_relevant            BOOLEAN     NOT NULL DEFAULT TRUE,
  requires_signature          BOOLEAN     NOT NULL DEFAULT TRUE,
  requires_documentation      BOOLEAN     NOT NULL DEFAULT TRUE,
  requires_route              BOOLEAN     NOT NULL DEFAULT TRUE,
  client_portal_visible       BOOLEAN     NOT NULL DEFAULT TRUE,
  employee_portal_visible     BOOLEAN     NOT NULL DEFAULT TRUE,
  is_active                   BOOLEAN     NOT NULL DEFAULT TRUE,
  sort_order                  INTEGER     NOT NULL DEFAULT 0,
  created_by                  UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_by                  UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT assignment_profile_name_not_blank CHECK (btrim(profile_name) <> ''),
  CONSTRAINT assignment_profile_title_not_blank CHECK (btrim(assignment_title) <> '')
);

CREATE INDEX IF NOT EXISTS idx_client_assignment_profiles_client
  ON public.client_assignment_profiles (tenant_id, client_id, is_active, sort_order);

CREATE INDEX IF NOT EXISTS idx_client_assignment_profiles_calendar
  ON public.client_assignment_profiles (tenant_id, is_active, profile_name);

ALTER TABLE public.client_assignment_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS client_assignment_profiles_select ON public.client_assignment_profiles;
CREATE POLICY client_assignment_profiles_select
  ON public.client_assignment_profiles FOR SELECT TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND public.is_tenant_member(tenant_id)
  );

DROP POLICY IF EXISTS client_assignment_profiles_write ON public.client_assignment_profiles;
CREATE POLICY client_assignment_profiles_write
  ON public.client_assignment_profiles FOR ALL TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND public.is_tenant_member(tenant_id)
    AND public.has_permission('assist.assignments.manage')
  )
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND public.is_tenant_member(tenant_id)
    AND public.has_permission('assist.assignments.manage')
  );

GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.client_assignment_profiles TO authenticated;

DROP TRIGGER IF EXISTS set_client_assignment_profiles_updated_at
  ON public.client_assignment_profiles;
CREATE TRIGGER set_client_assignment_profiles_updated_at
  BEFORE UPDATE ON public.client_assignment_profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Der erzeugte Einsatz hält die verwendete Vorlage und den zum
-- Freigabezeitpunkt gültigen operativen Klient:innenkontext fest. Dadurch
-- verändern spätere Aktenänderungen einen bereits freigegebenen Einsatz nicht
-- unbemerkt.
ALTER TABLE public.assignments
  ADD COLUMN IF NOT EXISTS assignment_profile_id UUID
    REFERENCES public.client_assignment_profiles(id) ON DELETE SET NULL;
ALTER TABLE public.assignments
  ADD COLUMN IF NOT EXISTS operational_context JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_assignments_assignment_profile
  ON public.assignments (tenant_id, assignment_profile_id);

CREATE OR REPLACE FUNCTION public.schedule_client_assignment_profile(
  p_tenant_id UUID,
  p_profile_id UUID,
  p_assignment_date DATE,
  p_start_time TIME
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_profile public.client_assignment_profiles%ROWTYPE;
  v_assignment_id UUID;
  v_start_at TIMESTAMPTZ;
  v_end_at TIMESTAMPTZ;
  v_task JSONB;
  v_task_title TEXT;
  v_actor_profile_id UUID;
  v_client RECORD;
  v_ambulatory RECORD;
  v_preferences RECORD;
  v_risk_notes TEXT;
  v_access_notes TEXT;
  v_employee_notes TEXT;
  v_internal_notes TEXT;
  v_operational_context JSONB;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Anmeldung erforderlich.';
  END IF;

  IF p_tenant_id IS NULL OR p_profile_id IS NULL
     OR p_assignment_date IS NULL OR p_start_time IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = '22004',
      MESSAGE = 'Einsatzprofil, Datum und Uhrzeit sind erforderlich.';
  END IF;

  IF NOT public.is_tenant_member(p_tenant_id)
     OR NOT public.has_permission('assist.assignments.manage') THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501',
      MESSAGE = 'Keine Berechtigung zur Einsatzplanung.';
  END IF;

  SELECT *
    INTO v_profile
    FROM public.client_assignment_profiles
   WHERE tenant_id = p_tenant_id
     AND id = p_profile_id
     AND is_active = TRUE
   FOR SHARE;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'Einsatzprofil nicht gefunden.';
  END IF;

  IF v_profile.employee_id IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = '23502',
      MESSAGE = 'Im Einsatzprofil muss eine mitarbeitende Person hinterlegt sein.';
  END IF;

  IF jsonb_array_length(v_profile.task_titles) = 0 THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'Im Einsatzprofil muss mindestens eine Aufgabe hinterlegt sein.';
  END IF;

  v_actor_profile_id := public.resolve_current_profile_id();

  SELECT
    c.visible_notes_for_employee,
    c.emergency_notes,
    c.allergies,
    c.mobility_notes,
    c.pets,
    c.key_management_notes,
    c.internal_notes
  INTO v_client
  FROM public.clients c
  WHERE c.tenant_id = p_tenant_id
    AND c.id = v_profile.client_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'Klient:in nicht gefunden.';
  END IF;

  SELECT
    d.home_access,
    d.key_status,
    d.key_number,
    d.key_safe_code,
    d.door_code,
    d.bell_name,
    d.floor,
    d.parking_notes,
    d.access_notes,
    d.hazard_notes,
    d.pets
  INTO v_ambulatory
  FROM public.client_ambulatory_details d
  WHERE d.tenant_id = p_tenant_id
    AND d.client_id = v_profile.client_id
  LIMIT 1;

  SELECT
    p.mobility_notes,
    p.household_notes,
    p.pet_notes,
    p.access_instructions
  INTO v_preferences
  FROM public.client_preferences p
  WHERE p.tenant_id = p_tenant_id
    AND p.client_id = v_profile.client_id
  LIMIT 1;

  SELECT string_agg(
    concat(
      upper(r.category), ' · ', upper(r.level), ': ', btrim(r.description),
      CASE
        WHEN NULLIF(btrim(r.mitigation), '') IS NOT NULL
          THEN ' — Maßnahme: ' || btrim(r.mitigation)
        ELSE ''
      END
    ),
    E'\n'
    ORDER BY
      CASE r.level
        WHEN 'kritisch' THEN 1
        WHEN 'hoch' THEN 2
        WHEN 'mittel' THEN 3
        ELSE 4
      END,
      r.assessed_at DESC
  )
  INTO v_risk_notes
  FROM public.client_risks r
  WHERE r.tenant_id = p_tenant_id
    AND r.client_id = v_profile.client_id;

  v_access_notes := NULLIF(concat_ws(
    E'\n',
    CASE WHEN NULLIF(btrim(v_client.key_management_notes), '') IS NOT NULL
      THEN 'Schlüsselhinweis: ' || btrim(v_client.key_management_notes) END,
    CASE WHEN NULLIF(btrim(v_ambulatory.home_access), '') IS NOT NULL
      THEN 'Hauszugang: ' || btrim(v_ambulatory.home_access) END,
    CASE WHEN NULLIF(btrim(v_ambulatory.key_status), '') IS NOT NULL
      THEN 'Schlüsselstatus: ' || btrim(v_ambulatory.key_status) END,
    CASE WHEN NULLIF(btrim(v_ambulatory.key_number), '') IS NOT NULL
      THEN 'Schlüsselnummer: ' || btrim(v_ambulatory.key_number) END,
    CASE WHEN NULLIF(btrim(v_ambulatory.key_safe_code), '') IS NOT NULL
      THEN 'Schlüsseltresor: ' || btrim(v_ambulatory.key_safe_code) END,
    CASE WHEN NULLIF(btrim(v_ambulatory.door_code), '') IS NOT NULL
      THEN 'Türcode: ' || btrim(v_ambulatory.door_code) END,
    CASE WHEN NULLIF(btrim(v_ambulatory.bell_name), '') IS NOT NULL
      THEN 'Klingel: ' || btrim(v_ambulatory.bell_name) END,
    CASE WHEN NULLIF(btrim(v_ambulatory.floor), '') IS NOT NULL
      THEN 'Etage: ' || btrim(v_ambulatory.floor) END,
    CASE WHEN NULLIF(btrim(v_ambulatory.parking_notes), '') IS NOT NULL
      THEN 'Parken: ' || btrim(v_ambulatory.parking_notes) END,
    CASE WHEN NULLIF(btrim(v_ambulatory.access_notes), '') IS NOT NULL
      THEN 'Zugang: ' || btrim(v_ambulatory.access_notes) END,
    CASE WHEN NULLIF(btrim(v_preferences.access_instructions), '') IS NOT NULL
      THEN 'Zugangsablauf: ' || btrim(v_preferences.access_instructions) END
  ), '');

  v_internal_notes := NULLIF(concat_ws(
    E'\n',
    CASE WHEN NULLIF(btrim(v_profile.internal_notes), '') IS NOT NULL
      THEN 'Einsatzprofil intern: ' || btrim(v_profile.internal_notes) END,
    CASE WHEN NULLIF(btrim(v_client.internal_notes), '') IS NOT NULL
      THEN 'Interner Aktenhinweis: ' || btrim(v_client.internal_notes) END
  ), '');

  v_employee_notes := NULLIF(concat_ws(
    E'\n\n',
    CASE WHEN NULLIF(btrim(v_profile.notes_for_employee), '') IS NOT NULL
      THEN 'Einsatzhinweis: ' || btrim(v_profile.notes_for_employee) END,
    CASE WHEN NULLIF(btrim(v_risk_notes), '') IS NOT NULL
      THEN 'RISIKEN\n' || v_risk_notes END,
    CASE WHEN NULLIF(btrim(v_client.emergency_notes), '') IS NOT NULL
      THEN 'Notfall-/Risikohinweis: ' || btrim(v_client.emergency_notes) END,
    CASE WHEN NULLIF(btrim(v_ambulatory.hazard_notes), '') IS NOT NULL
      THEN 'Gefahren im Haushalt: ' || btrim(v_ambulatory.hazard_notes) END,
    CASE WHEN NULLIF(btrim(v_client.allergies), '') IS NOT NULL
      THEN 'Allergien: ' || btrim(v_client.allergies) END,
    CASE WHEN COALESCE(
      NULLIF(btrim(v_client.mobility_notes), ''),
      NULLIF(btrim(v_preferences.mobility_notes), '')
    ) IS NOT NULL THEN 'Mobilität: ' || COALESCE(
      NULLIF(btrim(v_client.mobility_notes), ''),
      NULLIF(btrim(v_preferences.mobility_notes), '')
    ) END,
    CASE WHEN COALESCE(
      NULLIF(btrim(v_client.pets), ''),
      NULLIF(btrim(v_ambulatory.pets), ''),
      NULLIF(btrim(v_preferences.pet_notes), '')
    ) IS NOT NULL THEN 'Haustiere: ' || concat_ws(
      ' · ',
      NULLIF(btrim(v_client.pets), ''),
      NULLIF(btrim(v_ambulatory.pets), ''),
      NULLIF(btrim(v_preferences.pet_notes), '')
    ) END,
    CASE WHEN NULLIF(btrim(v_preferences.household_notes), '') IS NOT NULL
      THEN 'Haushalt: ' || btrim(v_preferences.household_notes) END,
    CASE WHEN NULLIF(btrim(v_client.visible_notes_for_employee), '') IS NOT NULL
      THEN 'Hinweis für Mitarbeitende: ' || btrim(v_client.visible_notes_for_employee) END,
    v_internal_notes
  ), '');

  v_operational_context := jsonb_strip_nulls(jsonb_build_object(
    'capturedAt', NOW(),
    'profileId', v_profile.id,
    'risks', NULLIF(v_risk_notes, ''),
    'accessAndKeys', NULLIF(v_access_notes, ''),
    'pets', COALESCE(
      NULLIF(btrim(v_client.pets), ''),
      NULLIF(btrim(v_ambulatory.pets), ''),
      NULLIF(btrim(v_preferences.pet_notes), '')
    ),
    'allergies', NULLIF(btrim(v_client.allergies), ''),
    'mobility', COALESCE(
      NULLIF(btrim(v_client.mobility_notes), ''),
      NULLIF(btrim(v_preferences.mobility_notes), '')
    ),
    'employeeNotes', NULLIF(v_employee_notes, ''),
    'internalNotes', NULLIF(v_internal_notes, ''),
    'requirements', jsonb_build_object(
      'billingRelevant', v_profile.billing_relevant,
      'documentation', v_profile.requires_documentation,
      'signature', v_profile.requires_signature,
      'route', v_profile.requires_route
    )
  ));

  v_start_at := (p_assignment_date + p_start_time) AT TIME ZONE 'Europe/Berlin';
  v_end_at := v_start_at + make_interval(mins => v_profile.duration_minutes);

  IF EXISTS (
    SELECT 1
      FROM public.assignments a
     WHERE a.tenant_id = p_tenant_id
       AND a.employee_id = v_profile.employee_id
       AND a.status::TEXT NOT IN ('cancelled', 'storniert', 'no_show', 'nicht_erschienen')
       AND a.planned_start_at < v_end_at
       AND a.planned_end_at > v_start_at
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '23P01',
      MESSAGE = 'Die mitarbeitende Person ist zu dieser Zeit bereits eingeplant.';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM public.assignments a
     WHERE a.tenant_id = p_tenant_id
       AND a.client_id = v_profile.client_id
       AND a.status::TEXT NOT IN ('cancelled', 'storniert', 'no_show', 'nicht_erschienen')
       AND a.planned_start_at < v_end_at
       AND a.planned_end_at > v_start_at
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '23P01',
      MESSAGE = 'Für diese Klient:in besteht zu dieser Zeit bereits ein Einsatz.';
  END IF;

  INSERT INTO public.assignments (
    tenant_id,
    client_id,
    employee_id,
    assignment_date,
    planned_start_at,
    planned_end_at,
    title,
    status,
    product_key,
    address_snapshot,
    description,
    internal_notes,
    client_visible_notes,
    assignment_profile_id,
    operational_context,
    created_by,
    updated_by
  )
  VALUES (
    p_tenant_id,
    v_profile.client_id,
    v_profile.employee_id,
    p_assignment_date,
    v_start_at,
    v_end_at,
    v_profile.assignment_title,
    'confirmed',
    'assist',
    NULLIF(btrim(v_profile.location_address), ''),
    v_employee_notes,
    v_internal_notes,
    NULLIF(btrim(v_profile.client_visible_notes), ''),
    v_profile.id,
    v_operational_context,
    v_actor_profile_id,
    v_actor_profile_id
  )
  RETURNING id INTO v_assignment_id;

  FOR v_task IN SELECT value FROM jsonb_array_elements(v_profile.task_titles)
  LOOP
    v_task_title := btrim(CASE
      WHEN jsonb_typeof(v_task) = 'string' THEN v_task #>> '{}'
      ELSE COALESCE(v_task ->> 'title', '')
    END);
    IF v_task_title <> '' THEN
      INSERT INTO public.assignment_tasks (
        tenant_id,
        assignment_id,
        title,
        status,
        is_required,
        requires_note_if_not_done,
        sort_order
      )
      VALUES (
        p_tenant_id,
        v_assignment_id,
        v_task_title,
        'open',
        TRUE,
        TRUE,
        COALESCE((v_task ->> 'sortOrder')::INTEGER, 0)
      );
    END IF;
  END LOOP;

  INSERT INTO public.calendar_events (
    tenant_id,
    module_key,
    source_type,
    source_id,
    event_type,
    title,
    description,
    internal_note,
    public_note,
    start_at,
    end_at,
    all_day,
    timezone,
    status,
    location_name,
    address,
    related_client_id,
    related_employee_id,
    is_office_visible,
    is_module_visible,
    is_client_portal_visible,
    is_employee_portal_visible,
    color_key,
    created_by,
    updated_by
  )
  VALUES (
    p_tenant_id,
    'assist',
    'assist_visit',
    v_assignment_id,
    'einsatz',
    v_profile.assignment_title,
    v_employee_notes,
    v_internal_notes,
    NULLIF(btrim(v_profile.client_visible_notes), ''),
    v_start_at,
    v_end_at,
    FALSE,
    'Europe/Berlin',
    'aktiv',
    NULLIF(btrim(v_profile.location_address), ''),
    NULLIF(btrim(v_profile.location_address), ''),
    v_profile.client_id,
    v_profile.employee_id,
    TRUE,
    TRUE,
    v_profile.client_portal_visible,
    v_profile.employee_portal_visible,
    'assist',
    v_actor_profile_id,
    v_actor_profile_id
  )
  ON CONFLICT (tenant_id, source_type, source_id)
  DO UPDATE SET
    start_at = EXCLUDED.start_at,
    end_at = EXCLUDED.end_at,
    status = EXCLUDED.status,
    description = EXCLUDED.description,
    internal_note = EXCLUDED.internal_note,
    updated_by = v_actor_profile_id,
    updated_at = NOW();

  RETURN jsonb_build_object(
    'assignmentId', v_assignment_id,
    'profileId', v_profile.id,
    'status', 'confirmed',
    'startAt', v_start_at,
    'endAt', v_end_at
  );
END;
$$;

REVOKE ALL ON FUNCTION public.schedule_client_assignment_profile(
  UUID, UUID, DATE, TIME
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.schedule_client_assignment_profile(
  UUID, UUID, DATE, TIME
) TO authenticated;

COMMENT ON TABLE public.client_assignment_profiles IS
  'Wiederverwendbare Einsatzvorlagen je Klient:in ohne Datum und Uhrzeit.';
COMMENT ON FUNCTION public.schedule_client_assignment_profile(UUID, UUID, DATE, TIME) IS
  'Erzeugt aus einem Einsatzprofil atomar einen bestätigten Einsatz, Aufgaben und den zentralen Kalendereintrag.';
