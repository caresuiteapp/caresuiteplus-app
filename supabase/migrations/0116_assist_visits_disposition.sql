-- ==========================================================================
-- CareSuite+ — Migration 0116: Assist Visits Disposition (Einsatzplanung v1)
-- Core disposition tables with multi-dimensional status, budget/proof/portal.
-- Backfill from public.assignments where present.
-- RLS: is_tenant_member(tenant_id) — Pattern 0113/0114
-- ==========================================================================

-- --------------------------------------------------------------------------
-- assist_visits — Assist-Disposition (source of truth)
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.assist_visits (
  id                      UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               UUID          NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  legacy_assignment_id    UUID          REFERENCES public.assignments(id) ON DELETE SET NULL,
  client_id               UUID          NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  employee_id             UUID          REFERENCES public.employees(id) ON DELETE SET NULL,
  service_key             TEXT,
  service_name            TEXT,
  title                   TEXT          NOT NULL,
  description             TEXT,
  assignment_date         DATE          NOT NULL,
  planned_start_at        TIMESTAMPTZ   NOT NULL,
  planned_end_at          TIMESTAMPTZ   NOT NULL,
  duration_minutes        INTEGER,
  actual_start_at         TIMESTAMPTZ,
  actual_end_at           TIMESTAMPTZ,
  on_the_way_at           TIMESTAMPTZ,
  arrived_at              TIMESTAMPTZ,
  finished_at             TIMESTAMPTZ,
  address_snapshot        TEXT,
  location_notes          TEXT,
  route_notes             TEXT,
  internal_notes          TEXT,
  employee_notes          TEXT,
  client_visible_notes    TEXT,
  -- Multi-dimensional status (section 18)
  planning_status         TEXT          NOT NULL DEFAULT 'draft',
  execution_status        TEXT          NOT NULL DEFAULT 'pending',
  documentation_status    TEXT          NOT NULL DEFAULT 'none',
  proof_status            TEXT          NOT NULL DEFAULT 'none',
  billing_status          TEXT          NOT NULL DEFAULT 'none',
  portal_status           TEXT          NOT NULL DEFAULT 'hidden',
  -- Legacy bridge to assignment_status enum
  canonical_status        TEXT          NOT NULL DEFAULT 'planned',
  -- Portal & visibility
  portal_release_enabled  BOOLEAN       NOT NULL DEFAULT FALSE,
  portal_released_at      TIMESTAMPTZ,
  employee_portal_visible BOOLEAN       NOT NULL DEFAULT TRUE,
  -- Budget preview
  budget_amount_cents     INTEGER,
  budget_currency         TEXT          NOT NULL DEFAULT 'EUR',
  budget_warning          TEXT,
  -- Risk / completeness flags
  is_at_risk              BOOLEAN       NOT NULL DEFAULT FALSE,
  is_incomplete           BOOLEAN       NOT NULL DEFAULT FALSE,
  error_code              TEXT,
  error_message           TEXT,
  -- Audit
  created_by              UUID          REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_by              UUID          REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at              TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_assist_visits_tenant_planned
  ON public.assist_visits (tenant_id, planned_start_at DESC);

CREATE INDEX IF NOT EXISTS idx_assist_visits_tenant_planning
  ON public.assist_visits (tenant_id, planning_status);

CREATE INDEX IF NOT EXISTS idx_assist_visits_tenant_client
  ON public.assist_visits (tenant_id, client_id);

CREATE INDEX IF NOT EXISTS idx_assist_visits_legacy_assignment
  ON public.assist_visits (legacy_assignment_id)
  WHERE legacy_assignment_id IS NOT NULL;

COMMENT ON TABLE public.assist_visits IS 'Assist-Disposition Einsätze — Multi-Status-Workflow (Migration 0116)';

-- --------------------------------------------------------------------------
-- assist_visit_tasks
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.assist_visit_tasks (
  id                      UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               UUID          NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  visit_id                UUID          NOT NULL REFERENCES public.assist_visits(id) ON DELETE CASCADE,
  title                   TEXT          NOT NULL,
  status                  TEXT          NOT NULL DEFAULT 'open',
  is_required             BOOLEAN       NOT NULL DEFAULT TRUE,
  requires_note_if_not_done BOOLEAN     NOT NULL DEFAULT FALSE,
  not_done_reason         TEXT,
  sort_order              INTEGER       NOT NULL DEFAULT 0,
  completed_at            TIMESTAMPTZ,
  completed_by            UUID          REFERENCES public.employees(id) ON DELETE SET NULL,
  created_at              TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_assist_visit_tasks_visit
  ON public.assist_visit_tasks (tenant_id, visit_id, sort_order);

-- --------------------------------------------------------------------------
-- assist_visit_status_history
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.assist_visit_status_history (
  id                      UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               UUID          NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  visit_id                UUID          NOT NULL REFERENCES public.assist_visits(id) ON DELETE CASCADE,
  dimension               TEXT          NOT NULL,
  from_status             TEXT,
  to_status               TEXT          NOT NULL,
  note                    TEXT,
  changed_by              UUID          REFERENCES public.profiles(id) ON DELETE SET NULL,
  changed_at              TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_assist_visit_status_history_visit
  ON public.assist_visit_status_history (tenant_id, visit_id, changed_at DESC);

-- --------------------------------------------------------------------------
-- assist_visit_budget_snapshots
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.assist_visit_budget_snapshots (
  id                      UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               UUID          NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  visit_id                UUID          NOT NULL REFERENCES public.assist_visits(id) ON DELETE CASCADE,
  snapshot_at             TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  budget_amount_cents     INTEGER       NOT NULL DEFAULT 0,
  used_amount_cents       INTEGER       NOT NULL DEFAULT 0,
  remaining_amount_cents  INTEGER       NOT NULL DEFAULT 0,
  source_type             TEXT          NOT NULL DEFAULT 'preview',
  metadata                JSONB         NOT NULL DEFAULT '{}'::jsonb,
  created_at              TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_assist_visit_budget_snapshots_visit
  ON public.assist_visit_budget_snapshots (tenant_id, visit_id, snapshot_at DESC);

-- --------------------------------------------------------------------------
-- assist_visit_billing_snapshots
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.assist_visit_billing_snapshots (
  id                      UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               UUID          NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  visit_id                UUID          NOT NULL REFERENCES public.assist_visits(id) ON DELETE CASCADE,
  snapshot_at             TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  billing_status          TEXT          NOT NULL DEFAULT 'none',
  amount_cents            INTEGER       NOT NULL DEFAULT 0,
  invoice_id              UUID,
  metadata                JSONB         NOT NULL DEFAULT '{}'::jsonb,
  created_at              TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_assist_visit_billing_snapshots_visit
  ON public.assist_visit_billing_snapshots (tenant_id, visit_id, snapshot_at DESC);

-- --------------------------------------------------------------------------
-- assist_visit_audit_logs
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.assist_visit_audit_logs (
  id                      UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               UUID          NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  visit_id                UUID          NOT NULL REFERENCES public.assist_visits(id) ON DELETE CASCADE,
  action                  TEXT          NOT NULL,
  details                 TEXT,
  actor_profile_id        UUID          REFERENCES public.profiles(id) ON DELETE SET NULL,
  metadata                JSONB         NOT NULL DEFAULT '{}'::jsonb,
  created_at              TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_assist_visit_audit_logs_visit
  ON public.assist_visit_audit_logs (tenant_id, visit_id, created_at DESC);

-- --------------------------------------------------------------------------
-- updated_at triggers
-- --------------------------------------------------------------------------
DROP TRIGGER IF EXISTS set_assist_visits_updated_at ON public.assist_visits;
CREATE TRIGGER set_assist_visits_updated_at
  BEFORE UPDATE ON public.assist_visits
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_assist_visit_tasks_updated_at ON public.assist_visit_tasks;
CREATE TRIGGER set_assist_visit_tasks_updated_at
  BEFORE UPDATE ON public.assist_visit_tasks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- --------------------------------------------------------------------------
-- RLS — is_tenant_member(tenant_id)
-- --------------------------------------------------------------------------
ALTER TABLE public.assist_visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assist_visit_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assist_visit_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assist_visit_budget_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assist_visit_billing_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assist_visit_audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS assist_visits_tenant ON public.assist_visits;
CREATE POLICY assist_visits_tenant ON public.assist_visits
  FOR ALL TO authenticated
  USING (public.is_tenant_member(tenant_id))
  WITH CHECK (public.is_tenant_member(tenant_id));

DROP POLICY IF EXISTS assist_visit_tasks_tenant ON public.assist_visit_tasks;
CREATE POLICY assist_visit_tasks_tenant ON public.assist_visit_tasks
  FOR ALL TO authenticated
  USING (public.is_tenant_member(tenant_id))
  WITH CHECK (public.is_tenant_member(tenant_id));

DROP POLICY IF EXISTS assist_visit_status_history_tenant ON public.assist_visit_status_history;
CREATE POLICY assist_visit_status_history_tenant ON public.assist_visit_status_history
  FOR ALL TO authenticated
  USING (public.is_tenant_member(tenant_id))
  WITH CHECK (public.is_tenant_member(tenant_id));

DROP POLICY IF EXISTS assist_visit_budget_snapshots_tenant ON public.assist_visit_budget_snapshots;
CREATE POLICY assist_visit_budget_snapshots_tenant ON public.assist_visit_budget_snapshots
  FOR ALL TO authenticated
  USING (public.is_tenant_member(tenant_id))
  WITH CHECK (public.is_tenant_member(tenant_id));

DROP POLICY IF EXISTS assist_visit_billing_snapshots_tenant ON public.assist_visit_billing_snapshots;
CREATE POLICY assist_visit_billing_snapshots_tenant ON public.assist_visit_billing_snapshots
  FOR ALL TO authenticated
  USING (public.is_tenant_member(tenant_id))
  WITH CHECK (public.is_tenant_member(tenant_id));

DROP POLICY IF EXISTS assist_visit_audit_logs_tenant ON public.assist_visit_audit_logs;
CREATE POLICY assist_visit_audit_logs_tenant ON public.assist_visit_audit_logs
  FOR ALL TO authenticated
  USING (public.is_tenant_member(tenant_id))
  WITH CHECK (public.is_tenant_member(tenant_id));

GRANT SELECT, INSERT, UPDATE ON public.assist_visits TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.assist_visit_tasks TO authenticated;
GRANT SELECT, INSERT ON public.assist_visit_status_history TO authenticated;
GRANT SELECT, INSERT ON public.assist_visit_budget_snapshots TO authenticated;
GRANT SELECT, INSERT ON public.assist_visit_billing_snapshots TO authenticated;
GRANT SELECT, INSERT ON public.assist_visit_audit_logs TO authenticated;

-- --------------------------------------------------------------------------
-- Backfill from public.assignments (idempotent)
-- --------------------------------------------------------------------------
INSERT INTO public.assist_visits (
  tenant_id,
  legacy_assignment_id,
  client_id,
  employee_id,
  title,
  description,
  assignment_date,
  planned_start_at,
  planned_end_at,
  duration_minutes,
  actual_start_at,
  actual_end_at,
  address_snapshot,
  canonical_status,
  planning_status,
  execution_status,
  documentation_status,
  created_by,
  created_at,
  updated_at
)
SELECT
  a.tenant_id,
  a.id,
  a.client_id,
  a.employee_id,
  COALESCE(NULLIF(TRIM(a.title), ''), 'Einsatz'),
  a.description,
  a.assignment_date,
  a.planned_start_at,
  a.planned_end_at,
  GREATEST(1, EXTRACT(EPOCH FROM (a.planned_end_at - a.planned_start_at))::INTEGER / 60),
  a.actual_start_at,
  a.actual_end_at,
  a.address_snapshot,
  a.status::TEXT,
  CASE a.status::TEXT
    WHEN 'planned' THEN 'draft'
    WHEN 'confirmed' THEN 'confirmed'
    WHEN 'cancelled' THEN 'cancelled'
    WHEN 'no_show' THEN 'at_risk'
    ELSE 'scheduled'
  END,
  CASE a.status::TEXT
    WHEN 'on_the_way' THEN 'on_way'
    WHEN 'arrived' THEN 'arrived'
    WHEN 'started' THEN 'in_progress'
    WHEN 'paused' THEN 'paused'
    WHEN 'finished' THEN 'completed'
    WHEN 'completed' THEN 'completed'
    WHEN 'cancelled' THEN 'cancelled'
    WHEN 'no_show' THEN 'no_show'
    ELSE 'pending'
  END,
  CASE a.status::TEXT
    WHEN 'documentation_open' THEN 'open'
    WHEN 'signature_open' THEN 'open'
    WHEN 'completed' THEN 'complete'
    ELSE 'none'
  END,
  a.created_by,
  a.created_at,
  a.updated_at
FROM public.assignments a
WHERE a.product_key = 'assist'
  AND NOT EXISTS (
    SELECT 1 FROM public.assist_visits v
    WHERE v.legacy_assignment_id = a.id
  );

-- Backfill tasks from assignment_tasks
INSERT INTO public.assist_visit_tasks (
  tenant_id,
  visit_id,
  title,
  status,
  is_required,
  requires_note_if_not_done,
  not_done_reason,
  sort_order,
  completed_by,
  created_at,
  updated_at
)
SELECT
  t.tenant_id,
  v.id,
  t.title,
  t.status::TEXT,
  COALESCE(t.is_required, TRUE),
  COALESCE(t.requires_note_if_not_done, FALSE),
  t.not_done_reason,
  COALESCE(t.sort_order, 0),
  t.completed_by_employee_id,
  t.created_at,
  t.updated_at
FROM public.assignment_tasks t
JOIN public.assist_visits v ON v.legacy_assignment_id = t.assignment_id
WHERE NOT EXISTS (
  SELECT 1 FROM public.assist_visit_tasks avt
  WHERE avt.visit_id = v.id AND avt.title = t.title
);
