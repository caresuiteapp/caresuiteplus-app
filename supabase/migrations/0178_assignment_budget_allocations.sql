-- ==========================================================================
-- CareSuite+ — Migration 0178: Einsatz-Budgetverteilung & RBAC
-- assignment_budget_allocations detail layer + assist.assignment.budget.* permissions
-- ==========================================================================

-- --------------------------------------------------------------------------
-- assignment_budget_allocations — geplante/reservierte/finale Beträge je Topf
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.assignment_budget_allocations (
  id                      UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               UUID          NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  assignment_id           UUID          NOT NULL,
  client_id               UUID          NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  budget_account_id       UUID          REFERENCES public.client_budget_accounts(id) ON DELETE SET NULL,
  catalog_key             TEXT          NOT NULL,
  legal_basis             TEXT,
  allocation_status       TEXT          NOT NULL DEFAULT 'planned'
                          CHECK (allocation_status IN (
                            'planned',
                            'reserved',
                            'executed',
                            'finalized',
                            'released',
                            'storniert'
                          )),
  planned_amount_cents    BIGINT        NOT NULL DEFAULT 0 CHECK (planned_amount_cents >= 0),
  reserved_amount_cents   BIGINT        NOT NULL DEFAULT 0 CHECK (reserved_amount_cents >= 0),
  final_amount_cents      BIGINT        CHECK (final_amount_cents IS NULL OR final_amount_cents >= 0),
  priority_order          INT           NOT NULL DEFAULT 99,
  is_manual_override      BOOLEAN       NOT NULL DEFAULT FALSE,
  override_reason         TEXT,
  metadata                JSONB         NOT NULL DEFAULT '{}'::jsonb,
  created_at              TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_assignment_budget_allocations_visit
  ON public.assignment_budget_allocations (tenant_id, assignment_id, priority_order);

CREATE INDEX IF NOT EXISTS idx_assignment_budget_allocations_client
  ON public.assignment_budget_allocations (tenant_id, client_id, allocation_status);

COMMENT ON TABLE public.assignment_budget_allocations IS
  'Einsatz-Budgetverteilung je Topf — Migration 0178';

-- Allow multiple active reservations per visit (one per budget account)
DROP INDEX IF EXISTS public.idx_client_budget_tx_visit_reservation_active;

CREATE UNIQUE INDEX IF NOT EXISTS idx_client_budget_tx_visit_reservation_active
  ON public.client_budget_transactions (tenant_id, reference_type, reference_id, budget_account_id)
  WHERE reference_type = 'assist_visit'
    AND transaction_type = 'reservation'
    AND COALESCE(lifecycle_status, 'geplant') NOT IN ('storniert', 'nachgewiesen', 'freigegeben', 'abgerechnet');

-- --------------------------------------------------------------------------
-- RLS
-- --------------------------------------------------------------------------
ALTER TABLE public.assignment_budget_allocations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS assignment_budget_allocations_tenant ON public.assignment_budget_allocations;
CREATE POLICY assignment_budget_allocations_tenant ON public.assignment_budget_allocations
  FOR ALL TO authenticated
  USING (public.has_permission('assist.assignment.budget.view'))
  WITH CHECK (public.has_permission('assist.assignments.manage'));

-- --------------------------------------------------------------------------
-- updated_at trigger
-- --------------------------------------------------------------------------
DROP TRIGGER IF EXISTS set_assignment_budget_allocations_updated_at ON public.assignment_budget_allocations;
CREATE TRIGGER set_assignment_budget_allocations_updated_at
  BEFORE UPDATE ON public.assignment_budget_allocations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- --------------------------------------------------------------------------
-- RBAC — assist.assignment.budget.*
-- --------------------------------------------------------------------------
INSERT INTO public.permission_catalog (key, module, category, label, risk_level, requires_audit)
VALUES
  ('assist.assignment.budget.view', 'assist', 'assignment_budget', 'Einsatz-Budget ansehen', 'low', FALSE),
  ('assist.assignment.budget.auto_allocate', 'assist', 'assignment_budget', 'Automatische Budgetverteilung', 'low', FALSE),
  ('assist.assignment.budget.override', 'assist', 'assignment_budget', 'Einsatz-Budget manuell überschreiben', 'high', TRUE),
  ('assist.assignment.budget.use_self_payer', 'assist', 'assignment_budget', 'Selbstzahler bei Einsatz nutzen', 'medium', TRUE),
  ('assist.assignment.budget.use_preventive_care', 'assist', 'assignment_budget', 'Verhinderungspflege bei Einsatz nutzen', 'medium', TRUE),
  ('assist.assignment.budget.use_joint_annual_budget', 'assist', 'assignment_budget', 'Gemeinsames Jahresbudget nutzen', 'medium', TRUE),
  ('assist.assignment.budget.mark_internal_no_billing', 'assist', 'assignment_budget', 'Kulanz / intern nicht abrechnen', 'high', TRUE),
  ('assist.assignment.budget.mark_unclear', 'assist', 'assignment_budget', 'Abrechnung als ungeklärt markieren', 'high', TRUE),
  ('assist.assignment.budget.approve_final', 'assist', 'assignment_budget', 'Finale Einsatz-Abrechnung freigeben', 'high', TRUE),
  ('assist.assignment.budget.audit.view', 'assist', 'assignment_budget', 'Einsatz-Budget-Audit ansehen', 'low', FALSE)
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.role_template_permissions (role_template_id, permission_key, allowed)
SELECT rt.id, p.key, TRUE
FROM public.role_templates rt
CROSS JOIN (
  VALUES
    ('assist.assignment.budget.view'),
    ('assist.assignment.budget.auto_allocate'),
    ('assist.assignment.budget.use_self_payer'),
    ('assist.assignment.budget.use_preventive_care'),
    ('assist.assignment.budget.use_joint_annual_budget'),
    ('assist.assignment.budget.audit.view')
) AS p(key)
WHERE rt.tenant_id IS NULL
  AND rt.role_key IN ('business_admin', 'business_manager', 'billing', 'dispatch', 'nurse')
ON CONFLICT (role_template_id, permission_key) DO NOTHING;

INSERT INTO public.role_template_permissions (role_template_id, permission_key, allowed)
SELECT rt.id, p.key, TRUE
FROM public.role_templates rt
CROSS JOIN (
  VALUES
    ('assist.assignment.budget.override'),
    ('assist.assignment.budget.mark_internal_no_billing'),
    ('assist.assignment.budget.mark_unclear'),
    ('assist.assignment.budget.approve_final')
) AS p(key)
WHERE rt.tenant_id IS NULL
  AND rt.role_key IN ('business_admin', 'business_manager', 'billing')
ON CONFLICT (role_template_id, permission_key) DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_key)
SELECT r.id, p.key
FROM public.roles r
CROSS JOIN (
  VALUES
    ('assist.assignment.budget.view'),
    ('assist.assignment.budget.auto_allocate'),
    ('assist.assignment.budget.use_self_payer'),
    ('assist.assignment.budget.use_preventive_care'),
    ('assist.assignment.budget.use_joint_annual_budget'),
    ('assist.assignment.budget.audit.view')
) AS p(key)
WHERE r.key IN ('business_admin', 'business_manager', 'billing', 'dispatch', 'nurse')
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_key)
SELECT r.id, p.key
FROM public.roles r
CROSS JOIN (
  VALUES
    ('assist.assignment.budget.override'),
    ('assist.assignment.budget.mark_internal_no_billing'),
    ('assist.assignment.budget.mark_unclear'),
    ('assist.assignment.budget.approve_final')
) AS p(key)
WHERE r.key IN ('business_admin', 'business_manager', 'billing')
ON CONFLICT DO NOTHING;
