-- ==========================================================================
-- CareSuite+ — Migration 0210: ASSIST.WORKFLOW.2 time proof columns
-- Denormalized timestamps on assist_visit_execution_state for repair/audit.
-- ==========================================================================

ALTER TABLE public.assist_visit_execution_state
  ADD COLUMN IF NOT EXISTS travel_started_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS travel_ended_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS service_started_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS service_ended_at    TIMESTAMPTZ;

COMMENT ON COLUMN public.assist_visit_execution_state.travel_started_at IS
  'ASSIST.WORKFLOW.2 — drive_start from assist_time_events';
COMMENT ON COLUMN public.assist_visit_execution_state.travel_ended_at IS
  'ASSIST.WORKFLOW.2 — drive_end/arrive from assist_time_events';
COMMENT ON COLUMN public.assist_visit_execution_state.service_started_at IS
  'ASSIST.WORKFLOW.2 — service_start from assist_time_events';
COMMENT ON COLUMN public.assist_visit_execution_state.service_ended_at IS
  'ASSIST.WORKFLOW.2 — service_end from assist_time_events';
