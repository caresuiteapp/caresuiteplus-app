-- ==========================================================================
-- CareSuite HealthOS — vollständige Assist-Vorlagen in Office-Einsatzprofilen
-- ==========================================================================
-- Ein Einsatzprofil ist ein vollständig konfigurierter Assist-Einsatz ohne
-- Datum und Uhrzeit. Erst der Drop im Assist-Kalender ergänzt diese beiden
-- Werte und gibt den Einsatz unmittelbar frei.

ALTER TABLE public.client_assignment_profiles
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS task_drafts JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS service_key TEXT,
  ADD COLUMN IF NOT EXISTS service_name TEXT,
  ADD COLUMN IF NOT EXISTS subject_key TEXT,
  ADD COLUMN IF NOT EXISTS assignment_type_key TEXT,
  ADD COLUMN IF NOT EXISTS service_category_key TEXT,
  ADD COLUMN IF NOT EXISTS task_package_id UUID
    REFERENCES public.catalog_items(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS billing_budget_source_key TEXT,
  ADD COLUMN IF NOT EXISTS risk_flag_keys JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS documentation_template_key TEXT,
  ADD COLUMN IF NOT EXISTS proof_template_key TEXT,
  ADD COLUMN IF NOT EXISTS catalog_snapshot_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS location_notes TEXT;

ALTER TABLE public.client_assignment_profiles
  DROP CONSTRAINT IF EXISTS client_assignment_profiles_task_drafts_array,
  DROP CONSTRAINT IF EXISTS client_assignment_profiles_risk_flags_array,
  DROP CONSTRAINT IF EXISTS client_assignment_profiles_catalog_snapshot_object;

ALTER TABLE public.client_assignment_profiles
  ADD CONSTRAINT client_assignment_profiles_task_drafts_array
    CHECK (jsonb_typeof(task_drafts) = 'array'),
  ADD CONSTRAINT client_assignment_profiles_risk_flags_array
    CHECK (jsonb_typeof(risk_flag_keys) = 'array'),
  ADD CONSTRAINT client_assignment_profiles_catalog_snapshot_object
    CHECK (jsonb_typeof(catalog_snapshot_json) = 'object');

-- Bestehende Profile bleiben vollständig nutzbar und erhalten strukturierte
-- Aufgaben, ohne ihre bisherigen Texte zu verlieren.
UPDATE public.client_assignment_profiles p
SET task_drafts = COALESCE(
  (
    SELECT jsonb_agg(
      jsonb_build_object(
        'itemKey', 'legacy-' || (entry.ordinality - 1)::TEXT,
        'title', CASE
          WHEN jsonb_typeof(entry.value) = 'string' THEN entry.value #>> '{}'
          ELSE entry.value ->> 'title'
        END,
        'isRequired', TRUE,
        'isOptional', FALSE,
        'sortOrder', entry.ordinality - 1,
        'requiresNoteIfNotDone', TRUE
      )
      ORDER BY entry.ordinality
    )
    FROM jsonb_array_elements(p.task_titles) WITH ORDINALITY AS entry(value, ordinality)
    WHERE btrim(CASE
      WHEN jsonb_typeof(entry.value) = 'string' THEN entry.value #>> '{}'
      ELSE COALESCE(entry.value ->> 'title', '')
    END) <> ''
  ),
  '[]'::jsonb
)
WHERE jsonb_array_length(p.task_drafts) = 0
  AND jsonb_array_length(p.task_titles) > 0;

-- Die bisherige, bereits produktiv gehärtete Funktion bleibt für
-- Mandantentrennung, Konfliktprüfung und den operativen Klient:innen-Snapshot
-- erhalten. Der neue öffentliche Einstieg ergänzt daraus atomar den modernen
-- Assist-Einsatz einschließlich aller Vorlagenfelder.
ALTER FUNCTION public.schedule_client_assignment_profile(UUID, UUID, DATE, TIME)
  RENAME TO schedule_client_assignment_profile_legacy_core;

REVOKE ALL ON FUNCTION public.schedule_client_assignment_profile_legacy_core(
  UUID, UUID, DATE, TIME
) FROM PUBLIC;

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
  v_result JSONB;
  v_assignment_id UUID;
  v_profile public.client_assignment_profiles%ROWTYPE;
  v_assignment public.assignments%ROWTYPE;
  v_task JSONB;
  v_task_title TEXT;
  v_visit_task_count INTEGER := 0;
  v_actor_profile_id UUID;
BEGIN
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
$$;

REVOKE ALL ON FUNCTION public.schedule_client_assignment_profile(
  UUID, UUID, DATE, TIME
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.schedule_client_assignment_profile(
  UUID, UUID, DATE, TIME
) TO authenticated;

COMMENT ON COLUMN public.client_assignment_profiles.task_drafts IS
  'Vollständige, aus Assist-Aufgabenpaketen und Einzelaufgaben erzeugte Einsatzaufgaben.';
COMMENT ON COLUMN public.client_assignment_profiles.catalog_snapshot_json IS
  'Unveränderlicher Snapshot der beim Profil-Speichern gewählten Assist-Katalogeinträge.';
COMMENT ON FUNCTION public.schedule_client_assignment_profile(UUID, UUID, DATE, TIME) IS
  'Ergänzt Datum/Uhrzeit, erzeugt einen bestätigten Assist-Einsatz mit vollständiger Vorlagenkonfiguration und gibt ihn unmittelbar frei.';
