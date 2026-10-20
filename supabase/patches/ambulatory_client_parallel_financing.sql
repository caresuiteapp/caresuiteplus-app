-- Checkpoint 224 / T-02: getrennte, parallel gültige Finanzierungswege.
-- Keine Bestandswerte werden abgeleitet oder rückwirkend übernommen.

CREATE TABLE IF NOT EXISTS public.client_financing_paths (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  logical_path_id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  financing_kind text NOT NULL CHECK (financing_kind IN ('sgb_xi', 'sgb_v', 'private', 'other')),
  payer_assignment_id uuid,
  payer_name text NOT NULL CHECK (btrim(payer_name) <> ''),
  payer_ik text,
  basis_reference text NOT NULL CHECK (btrim(basis_reference) <> ''),
  valid_from date NOT NULL,
  valid_until date,
  status text NOT NULL CHECK (status IN ('draft', 'active', 'ended', 'cancelled')),
  version integer NOT NULL DEFAULT 1 CHECK (version >= 1),
  supersedes_path_id uuid REFERENCES public.client_financing_paths(id),
  replaced_at timestamptz,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CHECK (valid_until IS NULL OR valid_until >= valid_from),
  UNIQUE (tenant_id, logical_path_id, version)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_client_financing_paths_current_version
  ON public.client_financing_paths (tenant_id, logical_path_id)
  WHERE replaced_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_client_financing_paths_client_period
  ON public.client_financing_paths (tenant_id, client_id, valid_from, valid_until);

ALTER TABLE public.client_financing_paths ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS client_financing_paths_select_tenant ON public.client_financing_paths;
CREATE POLICY client_financing_paths_select_tenant ON public.client_financing_paths
  FOR SELECT TO authenticated USING (
    tenant_id = public.current_tenant_id()
    AND (
      public.has_permission('clients.billing_profile.view')
      OR public.has_permission('office.clients.view')
    )
  );

DROP POLICY IF EXISTS client_financing_paths_insert_tenant ON public.client_financing_paths;
CREATE POLICY client_financing_paths_insert_tenant ON public.client_financing_paths
  FOR INSERT TO authenticated WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND EXISTS (
      SELECT 1 FROM public.clients c
      WHERE c.id = client_id AND c.tenant_id = tenant_id
    )
    AND (
      public.has_permission('clients.billing_profile.edit')
      OR public.has_permission('office.clients.edit')
    )
  );

GRANT SELECT, INSERT ON public.client_financing_paths TO authenticated;

COMMENT ON TABLE public.client_financing_paths IS
  'Append-only Finanzierungswege je Pflegefall; parallele Wege bleiben getrennt. Keine automatische Anspruchs- oder Freigabebestätigung.';
