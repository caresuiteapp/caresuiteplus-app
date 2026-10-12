-- REVIEW DRAFT ONLY. No remote application, business mutation or scheduling.
-- Source: captured production definitions/EXECUTE metadata 2026-10-11.
-- Exactly the two existing planning APIs; all original bodies and headers are
-- retained verbatim apart from CRLF normalization and one added entry gate.
-- Multi-tenant membership alone must not borrow the current tenant's planning
-- permission for another tenant. No admin permission bypass or role expansion.
-- Review/apply together with workflow-server-identity-draft.sql, whose actual
-- has_permission/current_tenant/profile guards bind role permissions to the
-- current authenticated tenant and disallow profile role self-promotion.
-- Release gate: authenticated staging/JWT/RLS plus real scheduling compatibility
-- for both callers. Local tests prove the entry authorization with expressly
-- synthetic planning bodies, not complete assignment/calendar/task scheduling.
BEGIN;

CREATE OR REPLACE FUNCTION public.schedule_client_assignment_profile(p_tenant_id uuid, p_profile_id uuid, p_assignment_date date, p_start_time time without time zone)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_result JSONB;
  v_assignment_id UUID;
  v_profile public.client_assignment_profiles%ROWTYPE;
  v_assignment public.assignments%ROWTYPE;
  v_task JSONB;
  v_task_title TEXT;
  v_visit_task_count INTEGER := 0;
  v_actor_profile_id UUID;
BEGIN
  -- workflow-profile-planning-auth-v1 BEGIN
  IF auth.uid() IS NULL
     OR public.current_tenant_id() IS NULL
     OR p_tenant_id IS DISTINCT FROM public.current_tenant_id()
     OR COALESCE(public.current_portal_type(), 'business') <> 'business'
     OR public.is_tenant_member(p_tenant_id) IS NOT TRUE
     OR public.has_permission('assist.assignments.manage') IS NOT TRUE
     OR NOT EXISTS (
       SELECT 1 FROM public.profiles p
       WHERE p.id = public.resolve_current_profile_id()
         AND p.tenant_id = p_tenant_id
         AND p.status::text = 'active' AND p.is_active IS TRUE
         AND (p.auth_user_id = auth.uid()
           OR (p.auth_user_id IS NULL AND p.id = auth.uid()))
         AND NOT EXISTS (
           SELECT 1 FROM public.tenant_users u
           WHERE u.auth_user_id = auth.uid() AND u.tenant_id = p.tenant_id
             AND (u.status::text IS DISTINCT FROM 'active'
               OR u.must_change_password IS DISTINCT FROM FALSE
               OR u.first_login_completed IS DISTINCT FROM TRUE)
         )
     ) THEN
    RAISE EXCEPTION USING ERRCODE = '42501',
      MESSAGE = 'Aktives eigenes Firmenprofil und Planungsrecht im aktuellen Sitzungsmandanten erforderlich.';
  END IF;
  -- workflow-profile-planning-auth-v1 END
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Anmeldung erforderlich.';
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

  IF jsonb_array_length(v_profile.task_drafts) = 0
     AND jsonb_array_length(v_profile.task_titles) = 0 THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'Im Einsatzprofil muss mindestens eine Aufgabe hinterlegt sein.';
  END IF;

  -- Erstellt bestätigte Legacy-Zuordnung, Kalenderereignis und den vollständigen
  -- Snapshot aus Risiken, Sturzgefahr, Haustieren, Schlüsseln und Aktenhinweisen.
  v_result := public.schedule_client_assignment_profile_legacy_core(
    p_tenant_id,
    p_profile_id,
    p_assignment_date,
    p_start_time
  );
  v_assignment_id := (v_result ->> 'assignmentId')::UUID;
  v_actor_profile_id := public.resolve_current_profile_id();

  SELECT *
    INTO v_assignment
    FROM public.assignments
   WHERE tenant_id = p_tenant_id
     AND id = v_assignment_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0002',
      MESSAGE = 'Der freigegebene Einsatz konnte nicht geladen werden.';
  END IF;

  INSERT INTO public.assist_visits (
    id,
    tenant_id,
    legacy_assignment_id,
    client_id,
    employee_id,
    service_key,
    service_name,
    title,
    description,
    assignment_date,
    planned_start_at,
    planned_end_at,
    duration_minutes,
    address_snapshot,
    location_notes,
    internal_notes,
    employee_notes,
    client_visible_notes,
    planning_status,
    execution_status,
    documentation_status,
    proof_status,
    billing_status,
    portal_status,
    canonical_status,
    portal_release_enabled,
    portal_released_at,
    employee_portal_visible,
    subject_key,
    assignment_type_key,
    service_category_key,
    task_package_id,
    billing_budget_source_key,
    documentation_template_key,
    proof_template_key,
    risk_flag_keys,
    catalog_snapshot_json,
    created_by,
    updated_by
  )
  VALUES (
    v_assignment_id,
    p_tenant_id,
    v_assignment_id,
    v_profile.client_id,
    v_profile.employee_id,
    NULLIF(btrim(v_profile.service_key), ''),
    NULLIF(btrim(v_profile.service_name), ''),
    v_profile.assignment_title,
    NULLIF(btrim(v_profile.description), ''),
    p_assignment_date,
    v_assignment.planned_start_at,
    v_assignment.planned_end_at,
    v_profile.duration_minutes,
    NULLIF(btrim(v_profile.location_address), ''),
    NULLIF(btrim(v_profile.location_notes), ''),
    v_assignment.internal_notes,
    v_assignment.description,
    v_assignment.client_visible_notes,
    'confirmed',
    'pending',
    CASE WHEN v_profile.requires_documentation THEN 'open' ELSE 'none' END,
    CASE WHEN v_profile.requires_signature THEN 'pending' ELSE 'none' END,
    CASE WHEN v_profile.billing_relevant THEN 'preview' ELSE 'none' END,
    CASE WHEN v_profile.client_portal_visible THEN 'released' ELSE 'hidden' END,
    'confirmed',
    v_profile.client_portal_visible,
    CASE WHEN v_profile.client_portal_visible THEN NOW() ELSE NULL END,
    v_profile.employee_portal_visible,
    NULLIF(btrim(v_profile.subject_key), ''),
    NULLIF(btrim(v_profile.assignment_type_key), ''),
    NULLIF(btrim(v_profile.service_category_key), ''),
    v_profile.task_package_id,
    NULLIF(btrim(v_profile.billing_budget_source_key), ''),
    NULLIF(btrim(v_profile.documentation_template_key), ''),
    NULLIF(btrim(v_profile.proof_template_key), ''),
    v_profile.risk_flag_keys,
    v_profile.catalog_snapshot_json
      || jsonb_build_object(
        'assignmentProfileId', v_profile.id,
        'assignmentProfileName', v_profile.profile_name,
        'releasedFromProfileAt', NOW(),
        'operationalContext', v_assignment.operational_context
      ),
    v_actor_profile_id,
    v_actor_profile_id
  );

  -- Die strukturierte Aufgabenliste ist die maßgebliche Quelle. Alte Profile
  -- ohne task_drafts verwenden weiterhin verlustfrei task_titles.
  FOR v_task IN
    SELECT value
      FROM jsonb_array_elements(
        CASE
          WHEN jsonb_array_length(v_profile.task_drafts) > 0
            THEN v_profile.task_drafts
          ELSE v_profile.task_titles
        END
      )
  LOOP
    v_task_title := btrim(CASE
      WHEN jsonb_typeof(v_task) = 'string' THEN v_task #>> '{}'
      ELSE COALESCE(v_task ->> 'title', '')
    END);

    IF v_task_title <> '' THEN
      INSERT INTO public.assist_visit_tasks (
        tenant_id,
        visit_id,
        catalog_item_id,
        item_key,
        title,
        status,
        is_required,
        is_optional,
        requires_note_if_not_done,
        sort_order,
        payload_json
      )
      VALUES (
        p_tenant_id,
        v_assignment_id,
        CASE
          WHEN NULLIF(v_task ->> 'catalogItemId', '') IS NULL THEN NULL
          ELSE (v_task ->> 'catalogItemId')::UUID
        END,
        NULLIF(v_task ->> 'itemKey', ''),
        v_task_title,
        'open',
        COALESCE((v_task ->> 'isRequired')::BOOLEAN, TRUE),
        COALESCE((v_task ->> 'isOptional')::BOOLEAN, FALSE),
        COALESCE((v_task ->> 'requiresNoteIfNotDone')::BOOLEAN, FALSE),
        COALESCE((v_task ->> 'sortOrder')::INTEGER, v_visit_task_count),
        jsonb_strip_nulls(jsonb_build_object(
          'defaultDurationMinutes', v_task -> 'defaultDurationMinutes',
          'notExecutable', v_task -> 'notExecutable',
          'assignmentProfileId', v_profile.id
        ))
      );
      v_visit_task_count := v_visit_task_count + 1;
    END IF;
  END LOOP;

  INSERT INTO public.assist_visit_status_history (
    tenant_id,
    visit_id,
    dimension,
    from_status,
    to_status,
    note,
    changed_by
  )
  VALUES
    (
      p_tenant_id,
      v_assignment_id,
      'planning',
      NULL,
      'confirmed',
      'Direktfreigabe aus Office-Einsatzprofil per Assist-Kalender',
      v_actor_profile_id
    ),
    (
      p_tenant_id,
      v_assignment_id,
      'portal',
      NULL,
      CASE WHEN v_profile.client_portal_visible THEN 'released' ELSE 'hidden' END,
      'Portalstatus aus Einsatzprofil übernommen',
      v_actor_profile_id
    );

  INSERT INTO public.assist_visit_audit_logs (
    tenant_id,
    visit_id,
    action,
    details,
    actor_profile_id,
    metadata
  )
  VALUES (
    p_tenant_id,
    v_assignment_id,
    'profile_drop_release',
    'Einsatzprofil per Drag-and-drop geplant und unmittelbar freigegeben',
    v_actor_profile_id,
    jsonb_build_object(
      'assignmentProfileId', v_profile.id,
      'assignmentProfileName', v_profile.profile_name,
      'taskCount', v_visit_task_count
    )
  );

  RETURN v_result || jsonb_build_object(
    'assignmentId', v_assignment_id,
    'visitId', v_assignment_id,
    'status', 'confirmed',
    'planningStatus', 'confirmed',
    'portalStatus', CASE
      WHEN v_profile.client_portal_visible THEN 'released'
      ELSE 'hidden'
    END,
    'released', TRUE
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.schedule_client_assignment_profile_legacy_core(p_tenant_id uuid, p_profile_id uuid, p_assignment_date date, p_start_time time without time zone)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
  -- workflow-profile-planning-auth-v1 BEGIN
  IF auth.uid() IS NULL
     OR public.current_tenant_id() IS NULL
     OR p_tenant_id IS DISTINCT FROM public.current_tenant_id()
     OR COALESCE(public.current_portal_type(), 'business') <> 'business'
     OR public.is_tenant_member(p_tenant_id) IS NOT TRUE
     OR public.has_permission('assist.assignments.manage') IS NOT TRUE
     OR NOT EXISTS (
       SELECT 1 FROM public.profiles p
       WHERE p.id = public.resolve_current_profile_id()
         AND p.tenant_id = p_tenant_id
         AND p.status::text = 'active' AND p.is_active IS TRUE
         AND (p.auth_user_id = auth.uid()
           OR (p.auth_user_id IS NULL AND p.id = auth.uid()))
         AND NOT EXISTS (
           SELECT 1 FROM public.tenant_users u
           WHERE u.auth_user_id = auth.uid() AND u.tenant_id = p.tenant_id
             AND (u.status::text IS DISTINCT FROM 'active'
               OR u.must_change_password IS DISTINCT FROM FALSE
               OR u.first_login_completed IS DISTINCT FROM TRUE)
         )
     ) THEN
    RAISE EXCEPTION USING ERRCODE = '42501',
      MESSAGE = 'Aktives eigenes Firmenprofil und Planungsrecht im aktuellen Sitzungsmandanten erforderlich.';
  END IF;
  -- workflow-profile-planning-auth-v1 END
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
$function$;

COMMIT;
