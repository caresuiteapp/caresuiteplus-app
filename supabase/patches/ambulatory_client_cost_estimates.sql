-- Checkpoint 229 / T-07: unveraenderliche Kostenvoranschlagsversionen und exakte Annahmebindung.
-- Tarif-, Mengen- und Kostenwerte werden je Version eingefroren; eine Entscheidung ist kein Vertrags- oder Leistungsnachweis.

CREATE TABLE IF NOT EXISTS public.client_cost_estimates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  logical_estimate_id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  financing_path_id uuid NOT NULL,
  version integer NOT NULL CHECK (version >= 1),
  status text NOT NULL CHECK (status IN ('draft', 'issued', 'superseded', 'withdrawn')),
  issue_date date NOT NULL,
  valid_until date NOT NULL,
  service_period_start date NOT NULL,
  service_period_end date NOT NULL,
  payer_contribution_cents bigint NOT NULL CHECK (payer_contribution_cents BETWEEN 0 AND 999999999),
  self_pay_cents bigint NOT NULL CHECK (self_pay_cents BETWEEN 0 AND 999999999),
  currency text NOT NULL DEFAULT 'EUR' CHECK (currency = 'EUR'),
  content_fingerprint text NOT NULL CHECK (btrim(content_fingerprint) <> ''),
  supersedes_estimate_id uuid,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  FOREIGN KEY (tenant_id, client_id, financing_path_id)
    REFERENCES public.client_financing_paths(tenant_id, client_id, id),
  CHECK (valid_until >= issue_date),
  CHECK (service_period_end >= service_period_start),
  CHECK (
    (version = 1 AND supersedes_estimate_id IS NULL)
    OR (version > 1 AND supersedes_estimate_id IS NOT NULL)
  ),
  UNIQUE (tenant_id, logical_estimate_id, version),
  UNIQUE (tenant_id, client_id, financing_path_id, id),
  UNIQUE (tenant_id, client_id, financing_path_id, logical_estimate_id, id),
  UNIQUE (tenant_id, client_id, financing_path_id, id, logical_estimate_id, version, content_fingerprint)
);

DO $$ BEGIN
  ALTER TABLE public.client_cost_estimates
    ADD CONSTRAINT client_cost_estimate_predecessor_fk
    FOREIGN KEY (tenant_id, client_id, financing_path_id, logical_estimate_id, supersedes_estimate_id)
    REFERENCES public.client_cost_estimates(tenant_id, client_id, financing_path_id, logical_estimate_id, id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_client_cost_estimates_one_successor
  ON public.client_cost_estimates (tenant_id, client_id, financing_path_id, supersedes_estimate_id)
  WHERE supersedes_estimate_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_client_cost_estimates_scope
  ON public.client_cost_estimates (tenant_id, client_id, financing_path_id, logical_estimate_id, version);

CREATE OR REPLACE FUNCTION public.validate_client_cost_estimate_version()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_predecessor_version integer;
  v_predecessor_created_at timestamptz;
BEGIN
  IF NEW.supersedes_estimate_id IS NOT NULL THEN
    SELECT version, created_at INTO v_predecessor_version, v_predecessor_created_at
    FROM public.client_cost_estimates
    WHERE tenant_id = NEW.tenant_id
      AND client_id = NEW.client_id
      AND financing_path_id = NEW.financing_path_id
      AND logical_estimate_id = NEW.logical_estimate_id
      AND id = NEW.supersedes_estimate_id;
    IF NOT FOUND
      OR v_predecessor_version <> NEW.version - 1
      OR v_predecessor_created_at >= NEW.created_at THEN
      RAISE EXCEPTION 'Angebotsvorgaenger fehlt, ist nicht unmittelbar oder wurde nicht frueher erfasst';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_client_cost_estimate_version_insert ON public.client_cost_estimates;
CREATE TRIGGER validate_client_cost_estimate_version_insert
  BEFORE INSERT ON public.client_cost_estimates
  FOR EACH ROW EXECUTE FUNCTION public.validate_client_cost_estimate_version();

CREATE TABLE IF NOT EXISTS public.client_cost_estimate_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  client_id uuid NOT NULL,
  financing_path_id uuid NOT NULL,
  estimate_version_id uuid NOT NULL,
  tariff_position_id uuid NOT NULL REFERENCES public.client_tariff_positions(id),
  service_code text NOT NULL CHECK (btrim(service_code) <> ''),
  service_label text NOT NULL CHECK (btrim(service_label) <> ''),
  billing_unit text NOT NULL CHECK (btrim(billing_unit) <> ''),
  normalized_quantity text NOT NULL CHECK (normalized_quantity ~ '^[0-9]{1,5}(\.[0-9]{1,3})?$' AND normalized_quantity::numeric > 0),
  frequency_count integer NOT NULL CHECK (frequency_count BETWEEN 1 AND 10000),
  frequency_unit text NOT NULL CHECK (frequency_unit IN ('once', 'week', 'month', 'period')),
  occurrence_amount_cents bigint NOT NULL CHECK (occurrence_amount_cents BETWEEN 1 AND 999999999),
  total_amount_cents bigint NOT NULL CHECK (total_amount_cents BETWEEN 1 AND 999999999),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  FOREIGN KEY (tenant_id, client_id, financing_path_id, estimate_version_id)
    REFERENCES public.client_cost_estimates(tenant_id, client_id, financing_path_id, id),
  CHECK (total_amount_cents = occurrence_amount_cents * frequency_count),
  UNIQUE (tenant_id, client_id, estimate_version_id, id)
);

CREATE INDEX IF NOT EXISTS idx_client_cost_estimate_lines_version
  ON public.client_cost_estimate_lines (tenant_id, client_id, financing_path_id, estimate_version_id, created_at, id);

CREATE TABLE IF NOT EXISTS public.client_cost_estimate_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  client_id uuid NOT NULL,
  financing_path_id uuid NOT NULL,
  estimate_version_id uuid NOT NULL,
  logical_estimate_id uuid NOT NULL,
  estimate_version integer NOT NULL CHECK (estimate_version >= 1),
  content_fingerprint text NOT NULL CHECK (btrim(content_fingerprint) <> ''),
  decision text NOT NULL CHECK (decision IN ('accepted', 'declined')),
  decided_at timestamptz NOT NULL,
  decided_by_name text NOT NULL CHECK (btrim(decided_by_name) <> ''),
  decided_by_role text NOT NULL CHECK (btrim(decided_by_role) <> ''),
  evidence_reference text NOT NULL CHECK (btrim(evidence_reference) <> ''),
  recorded_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  FOREIGN KEY (
    tenant_id, client_id, financing_path_id, estimate_version_id,
    logical_estimate_id, estimate_version, content_fingerprint
  ) REFERENCES public.client_cost_estimates(
    tenant_id, client_id, financing_path_id, id,
    logical_estimate_id, version, content_fingerprint
  ),
  UNIQUE (tenant_id, client_id, estimate_version_id)
);

CREATE OR REPLACE FUNCTION public.validate_client_cost_estimate_decision()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_status text;
  v_created_at timestamptz;
BEGIN
  SELECT status, created_at INTO v_status, v_created_at
  FROM public.client_cost_estimates
  WHERE tenant_id = NEW.tenant_id
    AND client_id = NEW.client_id
    AND financing_path_id = NEW.financing_path_id
    AND id = NEW.estimate_version_id
    AND logical_estimate_id = NEW.logical_estimate_id
    AND version = NEW.estimate_version
    AND content_fingerprint = NEW.content_fingerprint;
  IF NOT FOUND OR v_status = 'draft' OR NEW.decided_at < v_created_at THEN
    RAISE EXCEPTION 'Entscheidung ist nicht an eine entscheidbare konkrete Angebotsversion gebunden';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_client_cost_estimate_decision_insert ON public.client_cost_estimate_decisions;
CREATE TRIGGER validate_client_cost_estimate_decision_insert
  BEFORE INSERT ON public.client_cost_estimate_decisions
  FOR EACH ROW EXECUTE FUNCTION public.validate_client_cost_estimate_decision();

ALTER TABLE public.client_cost_estimates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_cost_estimate_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_cost_estimate_decisions ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['client_cost_estimates', 'client_cost_estimate_lines', 'client_cost_estimate_decisions'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', table_name || '_read', table_name);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (tenant_id = public.current_tenant_id() AND (public.has_permission(''clients.billing_profile.view'') OR public.has_permission(''office.clients.view'')))',
      table_name || '_read', table_name
    );
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', table_name || '_insert', table_name);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (tenant_id = public.current_tenant_id() AND (public.has_permission(''clients.billing_profile.edit'') OR public.has_permission(''office.clients.edit'')))',
      table_name || '_insert', table_name
    );
  END LOOP;
END $$;

GRANT SELECT, INSERT ON public.client_cost_estimates TO authenticated;
GRANT SELECT, INSERT ON public.client_cost_estimate_lines TO authenticated;
GRANT SELECT, INSERT ON public.client_cost_estimate_decisions TO authenticated;

COMMENT ON TABLE public.client_cost_estimates IS
  'Append-only Kostenvoranschlagsversionen mit eingefrorenem Zeitraum und Kostenanteilen; keine Vertrags- oder Abrechnungsfreigabe.';
COMMENT ON TABLE public.client_cost_estimate_lines IS
  'Eingefrorene Leistungs-, Tarif-, Mengen- und Haeufigkeitswerte genau einer Kostenvoranschlagsversion.';
COMMENT ON TABLE public.client_cost_estimate_decisions IS
  'Append-only Annahme oder Ablehnung mit exakter Angebots-ID, Version, Inhaltsfingerprint und Originalnachweis.';
