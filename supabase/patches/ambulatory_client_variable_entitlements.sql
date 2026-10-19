-- Checkpoint 232 / T-10: veraenderliche individuelle Leistungsansprueche.
-- Eine allgemeine Regel, ein Finanzierungsweg oder eine alte Fassung ersetzt keinen aktuellen individuellen Bescheid.

CREATE TABLE IF NOT EXISTS public.client_variable_entitlement_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  logical_entitlement_id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  financing_path_id uuid NOT NULL REFERENCES public.client_financing_paths(id),
  version integer NOT NULL CHECK (version >= 1),
  entitlement_kind text NOT NULL CHECK (entitlement_kind IN ('money', 'hours', 'days', 'units')),
  unit text NOT NULL CHECK (btrim(unit) <> ''),
  allocated_quantity numeric(18,4) NOT NULL CHECK (allocated_quantity > 0),
  decision_document_id text NOT NULL CHECK (btrim(decision_document_id) <> ''),
  decision_reference text NOT NULL CHECK (btrim(decision_reference) <> ''),
  decision_issued_on date NOT NULL,
  valid_from date NOT NULL,
  valid_until date,
  predecessor_version_id uuid,
  change_reason text,
  basis_fingerprint text NOT NULL CHECK (btrim(basis_fingerprint) <> ''),
  recorded_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CHECK (valid_until IS NULL OR valid_until >= valid_from),
  CHECK ((version = 1 AND predecessor_version_id IS NULL AND change_reason IS NULL)
    OR (version > 1 AND predecessor_version_id IS NOT NULL AND btrim(change_reason) <> '')),
  UNIQUE (tenant_id, client_id, logical_entitlement_id, version),
  UNIQUE (tenant_id, client_id, logical_entitlement_id, id),
  UNIQUE (tenant_id, client_id, logical_entitlement_id, id, version, basis_fingerprint)
);

DO $$ BEGIN
  ALTER TABLE public.client_variable_entitlement_versions
    ADD CONSTRAINT client_variable_entitlement_predecessor_fk
    FOREIGN KEY (tenant_id, client_id, logical_entitlement_id, predecessor_version_id)
    REFERENCES public.client_variable_entitlement_versions(tenant_id, client_id, logical_entitlement_id, id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_client_variable_entitlement_one_successor
  ON public.client_variable_entitlement_versions (tenant_id, client_id, logical_entitlement_id, predecessor_version_id)
  WHERE predecessor_version_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_client_variable_entitlement_current
  ON public.client_variable_entitlement_versions (tenant_id, client_id, financing_path_id, entitlement_kind, valid_from, valid_until);

CREATE OR REPLACE FUNCTION public.validate_client_variable_entitlement_version()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_path_tenant uuid;
  v_path_client uuid;
  v_predecessor public.client_variable_entitlement_versions%ROWTYPE;
BEGIN
  SELECT tenant_id, client_id INTO v_path_tenant, v_path_client
  FROM public.client_financing_paths WHERE id = NEW.financing_path_id;
  IF NOT FOUND OR v_path_tenant <> NEW.tenant_id OR v_path_client <> NEW.client_id THEN
    RAISE EXCEPTION 'Finanzierungsweg gehoert nicht zu Mandant und Pflegefall';
  END IF;
  IF NEW.predecessor_version_id IS NOT NULL THEN
    SELECT * INTO v_predecessor FROM public.client_variable_entitlement_versions
    WHERE tenant_id = NEW.tenant_id AND client_id = NEW.client_id
      AND logical_entitlement_id = NEW.logical_entitlement_id AND id = NEW.predecessor_version_id;
    IF NOT FOUND OR v_predecessor.version <> NEW.version - 1
      OR v_predecessor.financing_path_id <> NEW.financing_path_id
      OR v_predecessor.entitlement_kind <> NEW.entitlement_kind OR v_predecessor.unit <> NEW.unit
      OR v_predecessor.valid_until IS NULL OR v_predecessor.valid_until >= NEW.valid_from
      OR v_predecessor.decision_issued_on >= NEW.decision_issued_on
      OR v_predecessor.decision_document_id = NEW.decision_document_id
      OR v_predecessor.basis_fingerprint = NEW.basis_fingerprint
      OR v_predecessor.recorded_at >= NEW.recorded_at THEN
      RAISE EXCEPTION 'Anspruchsvorgaenger oder individuelle Bescheidfolge ist ungueltig';
    END IF;
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.client_variable_entitlement_versions existing
    WHERE existing.tenant_id = NEW.tenant_id AND existing.client_id = NEW.client_id
      AND existing.logical_entitlement_id <> NEW.logical_entitlement_id
      AND existing.financing_path_id = NEW.financing_path_id
      AND existing.entitlement_kind = NEW.entitlement_kind
      AND (existing.valid_until IS NULL OR existing.valid_until >= NEW.valid_from)
      AND (NEW.valid_until IS NULL OR NEW.valid_until >= existing.valid_from)
  ) THEN RAISE EXCEPTION 'Mehrere individuelle Anspruchsgrundlagen wuerden gleichzeitig gelten'; END IF;
  IF EXISTS (
    SELECT 1 FROM public.client_variable_entitlement_consumptions consumed
    WHERE consumed.tenant_id = NEW.tenant_id AND consumed.client_id = NEW.client_id
      AND consumed.financing_path_id = NEW.financing_path_id
      AND consumed.entitlement_kind = NEW.entitlement_kind AND consumed.service_on >= NEW.valid_from
  ) THEN RAISE EXCEPTION 'Anspruchsaenderung wuerde gebundenen Verbrauch rueckwirkend entwerten'; END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_client_variable_entitlement_version_insert ON public.client_variable_entitlement_versions;
CREATE TRIGGER validate_client_variable_entitlement_version_insert
  BEFORE INSERT ON public.client_variable_entitlement_versions
  FOR EACH ROW EXECUTE FUNCTION public.validate_client_variable_entitlement_version();

CREATE TABLE IF NOT EXISTS public.client_variable_entitlement_consumptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  financing_path_id uuid NOT NULL REFERENCES public.client_financing_paths(id),
  entitlement_version_id uuid NOT NULL,
  logical_entitlement_id uuid NOT NULL,
  entitlement_version integer NOT NULL CHECK (entitlement_version >= 1),
  entitlement_kind text NOT NULL CHECK (entitlement_kind IN ('money', 'hours', 'days', 'units')),
  unit text NOT NULL CHECK (btrim(unit) <> ''),
  basis_fingerprint text NOT NULL CHECK (btrim(basis_fingerprint) <> ''),
  service_on date NOT NULL,
  quantity numeric(18,4) NOT NULL CHECK (quantity >= 0),
  event_kind text NOT NULL CHECK (event_kind IN ('usage', 'correction', 'cancellation')),
  supersedes_event_id uuid,
  evidence_reference text NOT NULL CHECK (btrim(evidence_reference) <> ''),
  reason text,
  recorded_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CHECK ((event_kind = 'usage' AND supersedes_event_id IS NULL AND quantity > 0)
    OR (event_kind = 'correction' AND supersedes_event_id IS NOT NULL AND quantity > 0 AND btrim(reason) <> '')
    OR (event_kind = 'cancellation' AND supersedes_event_id IS NOT NULL AND quantity = 0 AND btrim(reason) <> '')),
  UNIQUE (tenant_id, client_id, logical_entitlement_id, entitlement_version_id, id),
  FOREIGN KEY (tenant_id, client_id, logical_entitlement_id, entitlement_version_id, entitlement_version, basis_fingerprint)
    REFERENCES public.client_variable_entitlement_versions(
      tenant_id, client_id, logical_entitlement_id, id, version, basis_fingerprint
    )
);

DO $$ BEGIN
  ALTER TABLE public.client_variable_entitlement_consumptions
    ADD CONSTRAINT client_variable_entitlement_consumption_predecessor_fk
    FOREIGN KEY (tenant_id, client_id, logical_entitlement_id, entitlement_version_id, supersedes_event_id)
    REFERENCES public.client_variable_entitlement_consumptions(tenant_id, client_id, logical_entitlement_id, entitlement_version_id, id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_client_variable_entitlement_consumption_one_successor
  ON public.client_variable_entitlement_consumptions (tenant_id, client_id, logical_entitlement_id, entitlement_version_id, supersedes_event_id)
  WHERE supersedes_event_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_client_variable_entitlement_consumption_scope
  ON public.client_variable_entitlement_consumptions (tenant_id, client_id, entitlement_version_id, service_on, recorded_at);

CREATE OR REPLACE FUNCTION public.validate_client_variable_entitlement_consumption()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_path_tenant uuid;
  v_path_client uuid;
  v_version public.client_variable_entitlement_versions%ROWTYPE;
  v_predecessor public.client_variable_entitlement_consumptions%ROWTYPE;
  v_match_count integer;
BEGIN
  SELECT tenant_id, client_id INTO v_path_tenant, v_path_client
  FROM public.client_financing_paths WHERE id = NEW.financing_path_id;
  IF NOT FOUND OR v_path_tenant <> NEW.tenant_id OR v_path_client <> NEW.client_id THEN
    RAISE EXCEPTION 'Finanzierungsweg gehoert nicht zu Mandant und Pflegefall';
  END IF;
  SELECT count(*) INTO v_match_count FROM public.client_variable_entitlement_versions entitlement
  WHERE entitlement.tenant_id = NEW.tenant_id AND entitlement.client_id = NEW.client_id
    AND entitlement.financing_path_id = NEW.financing_path_id
    AND entitlement.entitlement_kind = NEW.entitlement_kind
    AND entitlement.valid_from <= NEW.service_on
    AND (entitlement.valid_until IS NULL OR entitlement.valid_until >= NEW.service_on);
  IF v_match_count <> 1 THEN RAISE EXCEPTION 'Keine eindeutige aktuelle individuelle Anspruchsgrundlage'; END IF;
  SELECT * INTO v_version FROM public.client_variable_entitlement_versions
  WHERE id = NEW.entitlement_version_id;
  IF NOT FOUND OR v_version.logical_entitlement_id <> NEW.logical_entitlement_id
    OR v_version.version <> NEW.entitlement_version
    OR v_version.basis_fingerprint <> NEW.basis_fingerprint
    OR v_version.financing_path_id <> NEW.financing_path_id
    OR v_version.entitlement_kind <> NEW.entitlement_kind OR v_version.unit <> NEW.unit
    OR NEW.service_on < v_version.valid_from
    OR (v_version.valid_until IS NOT NULL AND NEW.service_on > v_version.valid_until)
    OR NEW.recorded_at < v_version.recorded_at THEN
    RAISE EXCEPTION 'Verbrauch ist nicht an die datumsgueltige individuelle Anspruchsfassung gebunden';
  END IF;
  IF NEW.supersedes_event_id IS NOT NULL THEN
    SELECT * INTO v_predecessor FROM public.client_variable_entitlement_consumptions
    WHERE tenant_id = NEW.tenant_id AND client_id = NEW.client_id
      AND logical_entitlement_id = NEW.logical_entitlement_id
      AND entitlement_version_id = NEW.entitlement_version_id AND id = NEW.supersedes_event_id;
    IF NOT FOUND OR v_predecessor.service_on <> NEW.service_on OR v_predecessor.recorded_at >= NEW.recorded_at THEN
      RAISE EXCEPTION 'Verbrauchsvorgaenger fehlt oder Zeitfolge ist ungueltig';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_client_variable_entitlement_consumption_insert ON public.client_variable_entitlement_consumptions;
CREATE TRIGGER validate_client_variable_entitlement_consumption_insert
  BEFORE INSERT ON public.client_variable_entitlement_consumptions
  FOR EACH ROW EXECUTE FUNCTION public.validate_client_variable_entitlement_consumption();

ALTER TABLE public.client_variable_entitlement_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_variable_entitlement_consumptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS client_variable_entitlement_versions_read ON public.client_variable_entitlement_versions;
CREATE POLICY client_variable_entitlement_versions_read ON public.client_variable_entitlement_versions
  FOR SELECT TO authenticated USING (
    tenant_id = public.current_tenant_id()
    AND (public.has_permission('clients.contracts.view') OR public.has_permission('office.clients.view'))
  );
DROP POLICY IF EXISTS client_variable_entitlement_versions_insert ON public.client_variable_entitlement_versions;
CREATE POLICY client_variable_entitlement_versions_insert ON public.client_variable_entitlement_versions
  FOR INSERT TO authenticated WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND (public.has_permission('clients.contracts.edit') OR public.has_permission('office.clients.edit'))
  );
DROP POLICY IF EXISTS client_variable_entitlement_consumptions_read ON public.client_variable_entitlement_consumptions;
CREATE POLICY client_variable_entitlement_consumptions_read ON public.client_variable_entitlement_consumptions
  FOR SELECT TO authenticated USING (
    tenant_id = public.current_tenant_id()
    AND (public.has_permission('clients.contracts.view') OR public.has_permission('office.clients.view'))
  );
DROP POLICY IF EXISTS client_variable_entitlement_consumptions_insert ON public.client_variable_entitlement_consumptions;
CREATE POLICY client_variable_entitlement_consumptions_insert ON public.client_variable_entitlement_consumptions
  FOR INSERT TO authenticated WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND (public.has_permission('clients.contracts.edit') OR public.has_permission('office.clients.edit'))
  );

GRANT SELECT, INSERT ON public.client_variable_entitlement_versions TO authenticated;
GRANT SELECT, INSERT ON public.client_variable_entitlement_consumptions TO authenticated;

COMMENT ON TABLE public.client_variable_entitlement_versions IS
  'Append-only individuelle Bescheidfassungen je Pflegefall, Finanzierungsweg und Anspruchsart; keine Ableitung aus allgemeinen Regeln.';
COMMENT ON TABLE public.client_variable_entitlement_consumptions IS
  'Append-only Verbrauchskette mit exakter Bindung an die datumsgueltige individuelle Anspruchsfassung.';
