-- ==========================================================================
-- CareSuite+ — Migration 0212: ASSIST.STABILIZE.1 workflow repair RPC + audit columns
-- ==========================================================================

ALTER TABLE public.assist_visit_execution_state
  ADD COLUMN IF NOT EXISTS workflow_consistency_status TEXT,
  ADD COLUMN IF NOT EXISTS last_auto_repair_at       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_repair_reason         TEXT;

COMMENT ON COLUMN public.assist_visit_execution_state.workflow_consistency_status IS
  'ASSIST.STABILIZE.1 — consistent | repairable | blocked';
COMMENT ON COLUMN public.assist_visit_execution_state.last_auto_repair_at IS
  'ASSIST.STABILIZE.1 — timestamp of last workflow auto-repair';
COMMENT ON COLUMN public.assist_visit_execution_state.last_repair_reason IS
  'ASSIST.STABILIZE.1 — audit reason for last repair';

-- Bypass normal transition validation for timestamp-driven workflow repair.
CREATE OR REPLACE FUNCTION public.repair_assist_visit_workflow_status(
  p_tenant_id          UUID,
  p_assignment_id      UUID,
  p_target_status      TEXT,
  p_reason             TEXT DEFAULT 'workflow_repair',
  p_actor_employee_id  UUID DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_remote_status TEXT;
BEGIN
  IF p_tenant_id IS NULL OR p_assignment_id IS NULL OR p_target_status IS NULL THEN
    RAISE EXCEPTION 'repair_assist_visit_workflow_status: missing required parameters';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.assignments
    WHERE tenant_id = p_tenant_id AND id = p_assignment_id
  ) THEN
    RAISE EXCEPTION 'Assignment not found';
  END IF;

  v_remote_status := p_target_status;

  UPDATE public.assignments
  SET
    status     = v_remote_status,
    updated_at = NOW(),
    updated_by = p_actor_employee_id
  WHERE tenant_id = p_tenant_id
    AND id = p_assignment_id;

  UPDATE public.assist_visits
  SET
    execution_status = v_remote_status,
    canonical_status = v_remote_status,
    updated_at       = NOW(),
    updated_by       = p_actor_employee_id
  WHERE tenant_id = p_tenant_id
    AND legacy_assignment_id = p_assignment_id;

  UPDATE public.assist_visit_execution_state
  SET
    assignment_status           = v_remote_status,
    workflow_consistency_status = 'consistent',
    last_auto_repair_at         = NOW(),
    last_repair_reason          = p_reason,
    updated_at                  = NOW()
  WHERE tenant_id = p_tenant_id
    AND visit_id IN (
      SELECT id FROM public.assist_visits
      WHERE tenant_id = p_tenant_id AND legacy_assignment_id = p_assignment_id
      LIMIT 1
    );
END;
$$;

REVOKE ALL ON FUNCTION public.repair_assist_visit_workflow_status(UUID, UUID, TEXT, TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.repair_assist_visit_workflow_status(UUID, UUID, TEXT, TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.repair_assist_visit_workflow_status(UUID, UUID, TEXT, TEXT, UUID) TO service_role;
