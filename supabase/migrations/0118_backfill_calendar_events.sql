-- ==========================================================================
-- CareSuite+ — Migration 0118: Backfill calendar_events from legacy sources
-- Idempotent: ON CONFLICT (tenant_id, source_type, source_id) DO UPDATE
-- ==========================================================================

-- Office Termine → calendar_events
INSERT INTO public.calendar_events (
  tenant_id, module_key, source_type, source_id, event_type, title, description,
  start_at, end_at, all_day, status, is_office_visible, is_module_visible,
  color_key, created_at, updated_at
)
SELECT
  a.tenant_id,
  'office',
  'appointment',
  a.id,
  'termin',
  a.title,
  a.notes,
  COALESCE(a.starts_at, a.created_at),
  COALESCE(a.ends_at, COALESCE(a.starts_at, a.created_at) + INTERVAL '1 hour'),
  FALSE,
  a.status,
  TRUE,
  TRUE,
  'office',
  a.created_at,
  a.updated_at
FROM public.appointments a
WHERE a.starts_at IS NOT NULL
  AND a.status NOT IN ('archiviert', 'gesperrt')
ON CONFLICT ON CONSTRAINT calendar_events_source_unique
DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  start_at = EXCLUDED.start_at,
  end_at = EXCLUDED.end_at,
  status = EXCLUDED.status,
  updated_at = NOW();

-- Assist Einsätze (assist_visits bevorzugt)
INSERT INTO public.calendar_events (
  tenant_id, module_key, source_type, source_id, event_type, title, description,
  start_at, end_at, all_day, status, related_client_id, related_employee_id,
  is_office_visible, is_module_visible, is_client_portal_visible, is_employee_portal_visible,
  color_key, created_at, updated_at
)
SELECT
  v.tenant_id,
  'assist',
  'assist_visit',
  v.id,
  'einsatz',
  v.title,
  v.description,
  v.planned_start_at,
  v.planned_end_at,
  FALSE,
  v.canonical_status,
  v.client_id,
  v.employee_id,
  TRUE,
  TRUE,
  v.portal_release_enabled,
  v.employee_portal_visible,
  'assist',
  v.created_at,
  v.updated_at
FROM public.assist_visits v
WHERE v.planning_status NOT IN ('cancelled', 'archived')
ON CONFLICT ON CONSTRAINT calendar_events_source_unique
DO UPDATE SET
  title = EXCLUDED.title,
  start_at = EXCLUDED.start_at,
  end_at = EXCLUDED.end_at,
  status = EXCLUDED.status,
  is_client_portal_visible = EXCLUDED.is_client_portal_visible,
  is_employee_portal_visible = EXCLUDED.is_employee_portal_visible,
  updated_at = NOW();

-- Legacy assignments (nur wenn kein assist_visit existiert)
INSERT INTO public.calendar_events (
  tenant_id, module_key, source_type, source_id, event_type, title,
  start_at, end_at, all_day, status,
  is_office_visible, is_module_visible, color_key, created_at, updated_at
)
SELECT
  a.tenant_id,
  'assist',
  'assist_visit',
  a.id,
  'einsatz',
  a.title,
  COALESCE(a.starts_at, a.created_at),
  COALESCE(a.starts_at, a.created_at) + INTERVAL '1 hour',
  FALSE,
  a.status,
  TRUE,
  TRUE,
  'assist',
  a.created_at,
  a.updated_at
FROM public.assignments a
WHERE a.starts_at IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.assist_visits v WHERE v.legacy_assignment_id = a.id
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.calendar_events ce
    WHERE ce.tenant_id = a.tenant_id
      AND ce.source_type = 'assist_visit'
      AND ce.source_id = a.id
      AND ce.archived_at IS NULL
  )
ON CONFLICT ON CONSTRAINT calendar_events_source_unique
DO NOTHING;

-- Abwesenheiten
INSERT INTO public.calendar_events (
  tenant_id, module_key, source_type, source_id, event_type, title,
  start_at, end_at, all_day, status, related_employee_id,
  is_office_visible, is_module_visible, color_key, created_at, updated_at
)
SELECT
  ea.tenant_id,
  'office',
  'absence',
  ea.id,
  CASE ea.absence_type
    WHEN 'vacation' THEN 'urlaub'
    WHEN 'sick_leave' THEN 'krankheit'
    WHEN 'child_sick_leave' THEN 'krankheit'
    WHEN 'training' THEN 'schulung'
    ELSE 'abwesenheit'
  END,
  COALESCE(NULLIF(ea.internal_notes, ''), ea.absence_type),
  ea.starts_at,
  ea.ends_at,
  ea.all_day,
  ea.status,
  ea.employee_id,
  TRUE,
  TRUE,
  'absence',
  ea.created_at,
  ea.updated_at
FROM public.employee_absences ea
WHERE ea.status NOT IN ('rejected', 'cancelled', 'archived')
ON CONFLICT ON CONSTRAINT calendar_events_source_unique
DO UPDATE SET
  start_at = EXCLUDED.start_at,
  end_at = EXCLUDED.end_at,
  status = EXCLUDED.status,
  updated_at = NOW();
