-- ==========================================================================
-- CareSuite+ — Migration 0195: DATEV-Exportformat + Homeoffice-Backfill
-- ==========================================================================

-- Erweitere export_format um 'datev'
ALTER TABLE public.workforce_export_jobs
  DROP CONSTRAINT IF EXISTS workforce_export_jobs_export_format_check;

ALTER TABLE public.workforce_export_jobs
  ADD CONSTRAINT workforce_export_jobs_export_format_check
  CHECK (export_format IN ('csv', 'pdf', 'datev', 'datev_stub'));

-- --------------------------------------------------------------------------
-- Backfill: homeoffice_workdays → workforce_work_sessions (nur fehlende)
-- --------------------------------------------------------------------------
INSERT INTO public.workforce_work_sessions (
  id,
  tenant_id,
  employee_id,
  user_id,
  work_date,
  status,
  work_mode,
  display_status,
  started_at,
  ended_at,
  last_event_at,
  gross_minutes,
  net_minutes,
  pause_minutes,
  is_online,
  metadata
)
SELECT
  hw.id,
  hw.tenant_id,
  COALESCE(hw.employee_id, e.id),
  hw.user_id,
  hw.work_date,
  CASE hw.status
    WHEN 'active' THEN 'clocked_in'
    WHEN 'paused' THEN 'paused'
    WHEN 'closed' THEN 'ended'
    WHEN 'submitted' THEN 'ended'
    ELSE 'offline'
  END,
  'homeoffice',
  CASE hw.status
    WHEN 'paused' THEN 'pause'
    WHEN 'closed' THEN 'feierabend'
    WHEN 'submitted' THEN 'feierabend'
    ELSE 'homeoffice'
  END,
  hw.started_at,
  hw.ended_at,
  COALESCE(hw.ended_at, hw.started_at, hw.updated_at),
  GREATEST(
    0,
    CASE
      WHEN hw.started_at IS NOT NULL AND hw.ended_at IS NOT NULL
      THEN EXTRACT(EPOCH FROM (hw.ended_at - hw.started_at))::INTEGER / 60
      ELSE 0
    END
  ),
  GREATEST(
    0,
    CASE
      WHEN hw.started_at IS NOT NULL AND hw.ended_at IS NOT NULL
      THEN EXTRACT(EPOCH FROM (hw.ended_at - hw.started_at))::INTEGER / 60
      ELSE 0
    END
  ),
  0,
  hw.status IN ('active', 'paused'),
  jsonb_build_object('legacy_source', 'homeoffice_workdays', 'migrated_at', NOW())
FROM public.homeoffice_workdays hw
LEFT JOIN public.employees e
  ON e.tenant_id = hw.tenant_id
 AND e.profile_id = hw.user_id
WHERE hw.employee_id IS NOT NULL OR e.id IS NOT NULL
ON CONFLICT (tenant_id, employee_id, work_date) DO NOTHING;

-- Backfill: homeoffice_start Events für migrierte Sessions
INSERT INTO public.workforce_time_events (
  tenant_id,
  employee_id,
  user_id,
  event_type,
  work_mode,
  source,
  occurred_at,
  session_id,
  note,
  metadata
)
SELECT
  ws.tenant_id,
  ws.employee_id,
  ws.user_id,
  'homeoffice_start',
  'homeoffice',
  'import',
  COALESCE(ws.started_at, ws.created_at),
  ws.id,
  'Backfill aus homeoffice_workdays (0195)',
  jsonb_build_object('legacy_source', 'homeoffice_workdays')
FROM public.workforce_work_sessions ws
WHERE ws.metadata->>'legacy_source' = 'homeoffice_workdays'
  AND ws.started_at IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.workforce_time_events e
    WHERE e.session_id = ws.id AND e.event_type = 'homeoffice_start'
  );
