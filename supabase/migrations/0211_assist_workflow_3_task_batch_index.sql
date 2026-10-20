-- ==========================================================================
-- CareSuite+ — Migration 0211: ASSIST.WORKFLOW.3 task batch index
-- Speeds portal employee task batch upserts (assignment_tasks lookup).
-- ==========================================================================

CREATE INDEX IF NOT EXISTS idx_assignment_tasks_tenant_assignment
  ON public.assignment_tasks (tenant_id, assignment_id);

COMMENT ON INDEX public.idx_assignment_tasks_tenant_assignment IS
  'ASSIST.WORKFLOW.3 — batch task result saves in employee portal';
