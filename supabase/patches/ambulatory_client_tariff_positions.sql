-- Checkpoint 226 / T-04: datumsgültige Tarif- und Leistungsposition je Finanzierungsweg.
-- Kein aktueller Standardpreis wird auf historische oder fremde Leistungen übertragen.

CREATE TABLE IF NOT EXISTS public.client_tariff_positions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  logical_position_id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  financing_path_id uuid NOT NULL,
  region_code text NOT NULL CHECK (btrim(region_code) <> ''),
  region_name text NOT NULL CHECK (btrim(region_name) <> ''),
  payer_assignment_id uuid,
  payer_name text NOT NULL CHECK (btrim(payer_name) <> ''),
  payer_ik text,
  service_code text NOT NULL CHECK (btrim(service_code) <> ''),
  service_label text NOT NULL CHECK (btrim(service_label) <> ''),
  billing_unit text NOT NULL CHECK (billing_unit IN ('minute', 'hour', 'visit', 'flat', 'unit', 'km')),
  unit_price_cents bigint NOT NULL CHECK (unit_price_cents > 0),
  currency text NOT NULL DEFAULT 'EUR' CHECK (currency = 'EUR'),
  valid_from date NOT NULL,
  valid_until date,
  is_open_ended boolean NOT NULL DEFAULT false,
  agreement_reference text NOT NULL CHECK (btrim(agreement_reference) <> ''),
  version integer NOT NULL DEFAULT 1 CHECK (version >= 1),
  supersedes_position_id uuid REFERENCES public.client_tariff_positions(id),
  replaced_at timestamptz,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  FOREIGN KEY (tenant_id, client_id, financing_path_id)
    REFERENCES public.client_financing_paths(tenant_id, client_id, id),
  CHECK (
    (is_open_ended AND valid_until IS NULL)
    OR (NOT is_open_ended AND valid_until IS NOT NULL AND valid_until >= valid_from)
  ),
  UNIQUE (tenant_id, logical_position_id, version)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_client_tariff_positions_current_version
  ON public.client_tariff_positions (tenant_id, logical_position_id)
  WHERE replaced_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_client_tariff_positions_service_date
  ON public.client_tariff_positions (
    tenant_id, client_id, financing_path_id, region_code,
    payer_assignment_id, service_code, valid_from, valid_until
  );

ALTER TABLE public.client_tariff_positions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS client_tariff_positions_select_tenant ON public.client_tariff_positions;
CREATE POLICY client_tariff_positions_select_tenant ON public.client_tariff_positions
  FOR SELECT TO authenticated USING (
    tenant_id = public.current_tenant_id()
    AND (
      public.has_permission('clients.billing_profile.view')
      OR public.has_permission('office.clients.view')
    )
  );

DROP POLICY IF EXISTS client_tariff_positions_insert_tenant ON public.client_tariff_positions;
CREATE POLICY client_tariff_positions_insert_tenant ON public.client_tariff_positions
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

GRANT SELECT, INSERT ON public.client_tariff_positions TO authenticated;

COMMENT ON TABLE public.client_tariff_positions IS
  'Append-only Tarifpositionen mit Originalgrundlage und Datumsgültigkeit; keine automatische Preis- oder Abrechnungsfreigabe.';
