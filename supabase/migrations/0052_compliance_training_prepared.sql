-- ==========================================================================
-- CareSuite+ — Migration 0052: Compliance Training (prepared)
-- Pflichtunterweisungs- und Compliance-Modul
-- ==========================================================================

CREATE TABLE IF NOT EXISTS public.compliance_training_items (
  id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  area_key                TEXT        NOT NULL,
  title                   TEXT        NOT NULL,
  description             TEXT        NOT NULL DEFAULT '',
  mandatory               BOOLEAN     NOT NULL DEFAULT TRUE,
  requires_quiz           BOOLEAN     NOT NULL DEFAULT FALSE,
  requires_signature      BOOLEAN     NOT NULL DEFAULT TRUE,
  validity_months         INTEGER,
  document_id             UUID,
  policy_document_id      UUID,
  linked_course_id        UUID,
  assigned_role_groups    TEXT[]      NOT NULL DEFAULT '{}',
  status                  TEXT        NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_compliance_training_items_tenant
  ON public.compliance_training_items (tenant_id, area_key);

ALTER TABLE public.compliance_training_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS compliance_training_items_tenant ON public.compliance_training_items;
CREATE POLICY compliance_training_items_tenant ON public.compliance_training_items
  FOR ALL
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

CREATE TABLE IF NOT EXISTS public.compliance_training_assignments (
  id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  employee_id             UUID        NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  training_item_id        UUID        NOT NULL REFERENCES public.compliance_training_items(id) ON DELETE CASCADE,
  status                  TEXT        NOT NULL DEFAULT 'assigned' CHECK (status IN (
    'required', 'assigned', 'viewed', 'acknowledged', 'quiz_required', 'passed',
    'failed', 'expired', 'overdue', 'waived', 'archived'
  )),
  mandatory               BOOLEAN     NOT NULL DEFAULT TRUE,
  assigned_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  due_at                  TIMESTAMPTZ,
  expires_at              TIMESTAMPTZ,
  viewed_at               TIMESTAMPTZ,
  acknowledged_at         TIMESTAMPTZ,
  waived_at               TIMESTAMPTZ,
  waived_by               UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  waiver_reason           TEXT,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_compliance_training_assignments_tenant_employee
  ON public.compliance_training_assignments (tenant_id, employee_id, status);

ALTER TABLE public.compliance_training_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS compliance_training_assignments_tenant ON public.compliance_training_assignments;
CREATE POLICY compliance_training_assignments_tenant ON public.compliance_training_assignments
  FOR ALL
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

CREATE TABLE IF NOT EXISTS public.compliance_training_acknowledgements (
  id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  assignment_id           UUID        NOT NULL REFERENCES public.compliance_training_assignments(id) ON DELETE CASCADE,
  employee_id             UUID        NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  training_item_id        UUID        NOT NULL REFERENCES public.compliance_training_items(id) ON DELETE CASCADE,
  viewed_document         BOOLEAN     NOT NULL DEFAULT FALSE,
  viewed_at               TIMESTAMPTZ,
  signature_name          TEXT        NOT NULL,
  signature_captured_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  quiz_score              NUMERIC(5,2),
  quiz_passed             BOOLEAN,
  proof_export_path       TEXT,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_compliance_training_ack_tenant_assignment
  ON public.compliance_training_acknowledgements (tenant_id, assignment_id);

ALTER TABLE public.compliance_training_acknowledgements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS compliance_training_acknowledgements_tenant ON public.compliance_training_acknowledgements;
CREATE POLICY compliance_training_acknowledgements_tenant ON public.compliance_training_acknowledgements
  FOR ALL
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

CREATE TABLE IF NOT EXISTS public.compliance_policy_documents (
  id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  title                   TEXT        NOT NULL,
  area_key                TEXT,
  storage_path            TEXT,
  version_label           TEXT        NOT NULL DEFAULT '1.0',
  effective_from          TIMESTAMPTZ,
  status                  TEXT        NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.compliance_policy_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS compliance_policy_documents_tenant ON public.compliance_policy_documents;
CREATE POLICY compliance_policy_documents_tenant ON public.compliance_policy_documents
  FOR ALL
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

CREATE TABLE IF NOT EXISTS public.employee_policy_acknowledgements (
  id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  employee_id             UUID        NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  policy_document_id      UUID        NOT NULL REFERENCES public.compliance_policy_documents(id) ON DELETE CASCADE,
  acknowledged_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  signature_name          TEXT        NOT NULL,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.employee_policy_acknowledgements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS employee_policy_acknowledgements_tenant ON public.employee_policy_acknowledgements;
CREATE POLICY employee_policy_acknowledgements_tenant ON public.employee_policy_acknowledgements
  FOR ALL
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

CREATE TABLE IF NOT EXISTS public.compliance_training_audit_events (
  id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  employee_id             UUID        REFERENCES public.employees(id) ON DELETE SET NULL,
  training_item_id        UUID        REFERENCES public.compliance_training_items(id) ON DELETE SET NULL,
  assignment_id           UUID        REFERENCES public.compliance_training_assignments(id) ON DELETE SET NULL,
  action                  TEXT        NOT NULL,
  actor_id                UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  actor_role              TEXT,
  summary                 TEXT        NOT NULL,
  metadata                JSONB       NOT NULL DEFAULT '{}',
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_compliance_training_audit_tenant
  ON public.compliance_training_audit_events (tenant_id, created_at DESC);

ALTER TABLE public.compliance_training_audit_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS compliance_training_audit_events_tenant ON public.compliance_training_audit_events;
CREATE POLICY compliance_training_audit_events_tenant ON public.compliance_training_audit_events
  FOR ALL
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

GRANT SELECT, INSERT, UPDATE ON public.compliance_training_items TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.compliance_training_assignments TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.compliance_training_acknowledgements TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.compliance_policy_documents TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.employee_policy_acknowledgements TO authenticated;
GRANT SELECT, INSERT ON public.compliance_training_audit_events TO authenticated;
