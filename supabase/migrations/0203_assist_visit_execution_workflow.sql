-- ==========================================================================
-- CareSuite+ — Migration 0203: Assist Visit Execution Workflow (ASSIST.WORKFLOW.1)
-- Additive: documentation, pause segments, execution state, portal RLS repairs.
-- ==========================================================================

-- --------------------------------------------------------------------------
-- assist_visit_documentation — structured employee portal documentation
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.assist_visit_documentation (
  id                      UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               UUID          NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  visit_id                UUID          NOT NULL REFERENCES public.assist_visits(id) ON DELETE CASCADE,
  short_description       TEXT          NOT NULL,
  special_notes           TEXT,
  deviations              TEXT,
  deviation_justification TEXT,
  referral_required       BOOLEAN       NOT NULL DEFAULT FALSE,
  emergency_or_problem    BOOLEAN       NOT NULL DEFAULT FALSE,
  sis_notes               TEXT,
  vitals_summary          TEXT,
  body_map_notes          TEXT,
  medication_notes        TEXT,
  care_report_notes       TEXT,
  photo_references        JSONB         NOT NULL DEFAULT '[]'::jsonb,
  submitted_at            TIMESTAMPTZ,
  submitted_by            UUID          REFERENCES public.profiles(id) ON DELETE SET NULL,
  locked                  BOOLEAN       NOT NULL DEFAULT FALSE,
  metadata                JSONB         NOT NULL DEFAULT '{}'::jsonb,
  created_at              TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  CONSTRAINT assist_visit_documentation_short_desc_nonempty
    CHECK (char_length(trim(short_description)) > 0),
  CONSTRAINT assist_visit_documentation_tenant_visit_unique
    UNIQUE (tenant_id, visit_id)
);

CREATE INDEX IF NOT EXISTS idx_assist_visit_documentation_tenant_visit
  ON public.assist_visit_documentation (tenant_id, visit_id);

COMMENT ON TABLE public.assist_visit_documentation IS
  'ASSIST.WORKFLOW.1 — structured visit documentation from employee portal';

-- --------------------------------------------------------------------------
-- assist_pause_segments — materialized pause intervals (from time events)
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.assist_pause_segments (
  id                      UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               UUID          NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  visit_id                UUID          NOT NULL REFERENCES public.assist_visits(id) ON DELETE CASCADE,
  session_id              UUID          REFERENCES public.assist_tracking_sessions(id) ON DELETE SET NULL,
  pause_start_event_id    UUID          REFERENCES public.assist_time_events(id) ON DELETE SET NULL,
  pause_end_event_id      UUID          REFERENCES public.assist_time_events(id) ON DELETE SET NULL,
  started_at              TIMESTAMPTZ   NOT NULL,
  ended_at                TIMESTAMPTZ,
  duration_seconds        INTEGER,
  reason                  TEXT,
  created_at              TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  CONSTRAINT assist_pause_segments_duration_nonneg
    CHECK (duration_seconds IS NULL OR duration_seconds >= 0)
);

CREATE INDEX IF NOT EXISTS idx_assist_pause_segments_tenant_visit
  ON public.assist_pause_segments (tenant_id, visit_id, started_at DESC);

COMMENT ON TABLE public.assist_pause_segments IS
  'ASSIST.WORKFLOW.1 — pause segments derived from assist_time_events';

-- --------------------------------------------------------------------------
-- assist_visit_execution_state — workflow step snapshot for portals
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.assist_visit_execution_state (
  id                      UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               UUID          NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  visit_id                UUID          NOT NULL REFERENCES public.assist_visits(id) ON DELETE CASCADE,
  current_step            TEXT          NOT NULL DEFAULT 'consent',
  assignment_status       TEXT,
  no_show_note            TEXT,
  tasks_complete          BOOLEAN       NOT NULL DEFAULT FALSE,
  documentation_complete  BOOLEAN       NOT NULL DEFAULT FALSE,
  signature_complete      BOOLEAN       NOT NULL DEFAULT FALSE,
  proof_generated         BOOLEAN       NOT NULL DEFAULT FALSE,
  finalized_at            TIMESTAMPTZ,
  metadata                JSONB         NOT NULL DEFAULT '{}'::jsonb,
  created_at              TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  CONSTRAINT assist_visit_execution_state_tenant_visit_unique
    UNIQUE (tenant_id, visit_id),
  CONSTRAINT assist_visit_execution_state_step_check
    CHECK (current_step IN (
      'consent', 'en_route', 'arrived', 'in_service', 'paused', 'tasks',
      'documentation', 'signature', 'finalize', 'completed', 'no_show', 'locked'
    ))
);

CREATE INDEX IF NOT EXISTS idx_assist_visit_execution_state_tenant
  ON public.assist_visit_execution_state (tenant_id, visit_id);

COMMENT ON TABLE public.assist_visit_execution_state IS
  'ASSIST.WORKFLOW.1 — employee portal workflow step snapshot';

-- --------------------------------------------------------------------------
-- service_records — link to assist visit when available
-- --------------------------------------------------------------------------
ALTER TABLE public.service_records
  ADD COLUMN IF NOT EXISTS assist_visit_id UUID REFERENCES public.assist_visits(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_service_records_assist_visit
  ON public.service_records (tenant_id, assist_visit_id)
  WHERE assist_visit_id IS NOT NULL;

-- --------------------------------------------------------------------------
-- updated_at triggers
-- --------------------------------------------------------------------------
DROP TRIGGER IF EXISTS set_assist_visit_documentation_updated_at ON public.assist_visit_documentation;
CREATE TRIGGER set_assist_visit_documentation_updated_at
  BEFORE UPDATE ON public.assist_visit_documentation
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_assist_pause_segments_updated_at ON public.assist_pause_segments;
CREATE TRIGGER set_assist_pause_segments_updated_at
  BEFORE UPDATE ON public.assist_pause_segments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_assist_visit_execution_state_updated_at ON public.assist_visit_execution_state;
CREATE TRIGGER set_assist_visit_execution_state_updated_at
  BEFORE UPDATE ON public.assist_visit_execution_state
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- --------------------------------------------------------------------------
-- RLS
-- --------------------------------------------------------------------------
ALTER TABLE public.assist_visit_documentation ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assist_pause_segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assist_visit_execution_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS assist_visit_documentation_tenant ON public.assist_visit_documentation;
CREATE POLICY assist_visit_documentation_tenant ON public.assist_visit_documentation
  FOR ALL TO authenticated
  USING (public.is_tenant_member(tenant_id))
  WITH CHECK (public.is_tenant_member(tenant_id));

DROP POLICY IF EXISTS assist_visit_documentation_portal_employee ON public.assist_visit_documentation;
CREATE POLICY assist_visit_documentation_portal_employee ON public.assist_visit_documentation
  FOR ALL TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND public.current_role_key() = 'employee_portal'
    AND visit_id IN (SELECT public.portal_employee_assigned_visit_ids(tenant_id))
  )
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND public.current_role_key() = 'employee_portal'
    AND visit_id IN (SELECT public.portal_employee_assigned_visit_ids(tenant_id))
  );

DROP POLICY IF EXISTS assist_pause_segments_tenant ON public.assist_pause_segments;
CREATE POLICY assist_pause_segments_tenant ON public.assist_pause_segments
  FOR ALL TO authenticated
  USING (public.is_tenant_member(tenant_id))
  WITH CHECK (public.is_tenant_member(tenant_id));

DROP POLICY IF EXISTS assist_pause_segments_portal_employee_insert ON public.assist_pause_segments;
CREATE POLICY assist_pause_segments_portal_employee_insert ON public.assist_pause_segments
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND public.current_role_key() = 'employee_portal'
    AND visit_id IN (SELECT public.portal_employee_assigned_visit_ids(tenant_id))
  );

DROP POLICY IF EXISTS assist_visit_execution_state_tenant ON public.assist_visit_execution_state;
CREATE POLICY assist_visit_execution_state_tenant ON public.assist_visit_execution_state
  FOR ALL TO authenticated
  USING (public.is_tenant_member(tenant_id))
  WITH CHECK (public.is_tenant_member(tenant_id));

DROP POLICY IF EXISTS assist_visit_execution_state_portal_employee ON public.assist_visit_execution_state;
CREATE POLICY assist_visit_execution_state_portal_employee ON public.assist_visit_execution_state
  FOR ALL TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND public.current_role_key() = 'employee_portal'
    AND visit_id IN (SELECT public.portal_employee_assigned_visit_ids(tenant_id))
  )
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND public.current_role_key() = 'employee_portal'
    AND visit_id IN (SELECT public.portal_employee_assigned_visit_ids(tenant_id))
  );

-- Employee portal: insert signatures + proofs for assigned visits
DROP POLICY IF EXISTS assist_visit_signatures_portal_employee_insert ON public.assist_visit_signatures;
CREATE POLICY assist_visit_signatures_portal_employee_insert ON public.assist_visit_signatures
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND public.current_role_key() = 'employee_portal'
    AND visit_id IN (SELECT public.portal_employee_assigned_visit_ids(tenant_id))
  );

DROP POLICY IF EXISTS assist_visit_signatures_portal_employee_select ON public.assist_visit_signatures;
CREATE POLICY assist_visit_signatures_portal_employee_select ON public.assist_visit_signatures
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND public.current_role_key() = 'employee_portal'
    AND visit_id IN (SELECT public.portal_employee_assigned_visit_ids(tenant_id))
  );

DROP POLICY IF EXISTS assist_visit_proofs_portal_employee_insert ON public.assist_visit_proofs;
CREATE POLICY assist_visit_proofs_portal_employee_insert ON public.assist_visit_proofs
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND public.current_role_key() = 'employee_portal'
    AND visit_id IN (SELECT public.portal_employee_assigned_visit_ids(tenant_id))
  );

DROP POLICY IF EXISTS assist_visit_proofs_portal_employee_select ON public.assist_visit_proofs;
CREATE POLICY assist_visit_proofs_portal_employee_select ON public.assist_visit_proofs
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND public.current_role_key() = 'employee_portal'
    AND visit_id IN (SELECT public.portal_employee_assigned_visit_ids(tenant_id))
  );

GRANT SELECT, INSERT, UPDATE ON public.assist_visit_documentation TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.assist_pause_segments TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.assist_visit_execution_state TO authenticated;
