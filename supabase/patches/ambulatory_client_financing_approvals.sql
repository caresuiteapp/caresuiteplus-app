-- Checkpoint 225 / T-03: Anträge und Entscheidungen je konkretem Finanzierungsweg.
-- Keine Kostenträger-, Vertrags- oder Zeitraumzeile wird als Genehmigung übernommen.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'client_financing_paths_tenant_client_id_unique'
      AND conrelid = 'public.client_financing_paths'::regclass
  ) THEN
    ALTER TABLE public.client_financing_paths
      ADD CONSTRAINT client_financing_paths_tenant_client_id_unique
      UNIQUE (tenant_id, client_id, id);
  END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS public.client_financing_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  logical_approval_id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  financing_path_id uuid NOT NULL,
  application_reference text NOT NULL CHECK (btrim(application_reference) <> ''),
  applied_on date NOT NULL,
  requested_from date NOT NULL,
  requested_until date,
  decision text NOT NULL CHECK (decision IN ('pending', 'approved', 'rejected', 'withdrawn')),
  decision_reference text,
  decided_on date,
  approved_from date,
  approved_until date,
  follow_up_due_on date,
  version integer NOT NULL DEFAULT 1 CHECK (version >= 1),
  supersedes_approval_id uuid REFERENCES public.client_financing_approvals(id),
  replaced_at timestamptz,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  FOREIGN KEY (tenant_id, client_id, financing_path_id)
    REFERENCES public.client_financing_paths(tenant_id, client_id, id),
  CHECK (requested_until IS NULL OR requested_until >= requested_from),
  CHECK (approved_until IS NULL OR approved_from IS NOT NULL),
  CHECK (approved_from IS NULL OR approved_until IS NOT NULL),
  CHECK (approved_until IS NULL OR approved_until >= approved_from),
  CHECK (
    decision = 'pending'
    OR (
      decision_reference IS NOT NULL AND btrim(decision_reference) <> ''
      AND decided_on IS NOT NULL
    )
  ),
  CHECK (
    decision <> 'approved'
    OR (
      decision_reference IS NOT NULL AND btrim(decision_reference) <> ''
      AND decided_on IS NOT NULL
      AND approved_from IS NOT NULL
      AND approved_until IS NOT NULL
    )
  ),
  UNIQUE (tenant_id, logical_approval_id, version)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_client_financing_approvals_current_version
  ON public.client_financing_approvals (tenant_id, logical_approval_id)
  WHERE replaced_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_client_financing_approvals_path_period
  ON public.client_financing_approvals (tenant_id, client_id, financing_path_id, approved_from, approved_until);

ALTER TABLE public.client_financing_approvals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS client_financing_approvals_select_tenant ON public.client_financing_approvals;
CREATE POLICY client_financing_approvals_select_tenant ON public.client_financing_approvals
  FOR SELECT TO authenticated USING (
    tenant_id = public.current_tenant_id()
    AND (
      public.has_permission('clients.billing_profile.view')
      OR public.has_permission('office.clients.view')
    )
  );

DROP POLICY IF EXISTS client_financing_approvals_insert_tenant ON public.client_financing_approvals;
CREATE POLICY client_financing_approvals_insert_tenant ON public.client_financing_approvals
  FOR INSERT TO authenticated WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND EXISTS (
      SELECT 1 FROM public.client_financing_paths p
      WHERE p.id = financing_path_id
        AND p.tenant_id = tenant_id
        AND p.client_id = client_id
    )
    AND (
      public.has_permission('clients.billing_profile.edit')
      OR public.has_permission('office.clients.edit')
    )
  );

GRANT SELECT, INSERT ON public.client_financing_approvals TO authenticated;

COMMENT ON TABLE public.client_financing_approvals IS
  'Append-only Antrags- und Entscheidungsfassungen je Finanzierungsweg; keine automatische Anspruchs- oder Abrechnungsfreigabe.';
