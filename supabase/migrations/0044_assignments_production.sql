-- ==========================================================================
-- CareSuite+ — Migration 0044: Assignments Production Stabilization
-- Aligns local schema with remote production columns (non-destructive).
-- ==========================================================================

ALTER TABLE public.assignments ADD COLUMN IF NOT EXISTS on_the_way_at TIMESTAMPTZ;
ALTER TABLE public.assignments ADD COLUMN IF NOT EXISTS arrived_at TIMESTAMPTZ;
ALTER TABLE public.assignments ADD COLUMN IF NOT EXISTS finished_at TIMESTAMPTZ;
ALTER TABLE public.assignments ADD COLUMN IF NOT EXISTS documentation_notes TEXT;

CREATE TABLE IF NOT EXISTS public.assignment_audit_events (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  assignment_id     UUID        NOT NULL,
  action            TEXT        NOT NULL,
  actor_profile_id  UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  actor_name        TEXT        NOT NULL DEFAULT 'System',
  from_status       TEXT,
  to_status         TEXT,
  details           TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_assignment_audit_events_tenant
  ON public.assignment_audit_events (tenant_id, assignment_id, created_at DESC);

ALTER TABLE public.assignment_audit_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS assignment_audit_events_tenant ON public.assignment_audit_events;
CREATE POLICY assignment_audit_events_tenant ON public.assignment_audit_events
  FOR ALL
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

GRANT SELECT, INSERT ON public.assignment_audit_events TO authenticated;

COMMENT ON TABLE public.assignment_audit_events IS 'Audit trail for Assist assignment lifecycle events';
COMMENT ON COLUMN public.assignments.on_the_way_at IS 'Timestamp when employee marked on the way';
COMMENT ON COLUMN public.assignments.arrived_at IS 'Timestamp when employee arrived on site';
COMMENT ON COLUMN public.assignments.finished_at IS 'Timestamp when service delivery finished';
COMMENT ON COLUMN public.assignments.documentation_notes IS 'Required documentation before completion';
