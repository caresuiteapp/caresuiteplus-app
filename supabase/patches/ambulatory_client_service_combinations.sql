-- Checkpoint 231 / T-09: datierte, kostentraeger- und leistungsgenaue Kombinationsregeln.
-- Eine Regelpruefung bestaetigt weder Leistungserbringung noch Genehmigung oder Abrechnungsfreigabe.

CREATE TABLE IF NOT EXISTS public.client_service_combination_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  logical_rule_id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  version integer NOT NULL CHECK (version >= 1),
  financing_kind text NOT NULL CHECK (financing_kind IN ('sgb_xi', 'sgb_v', 'private', 'other')),
  cost_carrier_reference text NOT NULL CHECK (btrim(cost_carrier_reference) <> ''),
  service_type_a text NOT NULL CHECK (btrim(service_type_a) <> ''),
  service_type_b text NOT NULL CHECK (btrim(service_type_b) <> ''),
  outcome text NOT NULL CHECK (outcome IN ('allowed', 'prohibited', 'surcharge_required')),
  surcharge_service_type text,
  valid_from date NOT NULL,
  valid_until date,
  predecessor_rule_id uuid,
  rule_title text NOT NULL CHECK (btrim(rule_title) <> ''),
  rule_reference text NOT NULL CHECK (btrim(rule_reference) <> ''),
  content_fingerprint text NOT NULL CHECK (btrim(content_fingerprint) <> ''),
  recorded_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CHECK (service_type_a < service_type_b),
  CHECK (valid_until IS NULL OR valid_until >= valid_from),
  CHECK (
    (outcome = 'surcharge_required' AND btrim(surcharge_service_type) <> '')
    OR (outcome IN ('allowed', 'prohibited') AND surcharge_service_type IS NULL)
  ),
  CHECK ((version = 1 AND predecessor_rule_id IS NULL) OR (version > 1 AND predecessor_rule_id IS NOT NULL)),
  UNIQUE (tenant_id, logical_rule_id, version),
  UNIQUE (tenant_id, logical_rule_id, id),
  UNIQUE (tenant_id, logical_rule_id, id, version, content_fingerprint),
  UNIQUE (tenant_id, financing_kind, cost_carrier_reference, service_type_a, service_type_b, valid_from)
);

DO $$ BEGIN
  ALTER TABLE public.client_service_combination_rules
    ADD CONSTRAINT client_service_combination_rule_predecessor_fk
    FOREIGN KEY (tenant_id, logical_rule_id, predecessor_rule_id)
    REFERENCES public.client_service_combination_rules(tenant_id, logical_rule_id, id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_client_service_combination_rule_one_successor
  ON public.client_service_combination_rules (tenant_id, logical_rule_id, predecessor_rule_id)
  WHERE predecessor_rule_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_client_service_combination_rule_lookup
  ON public.client_service_combination_rules (
    tenant_id, financing_kind, cost_carrier_reference, service_type_a, service_type_b, valid_from, valid_until
  );

CREATE OR REPLACE FUNCTION public.validate_client_service_combination_rule()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_predecessor public.client_service_combination_rules%ROWTYPE;
BEGIN
  IF NEW.predecessor_rule_id IS NOT NULL THEN
    SELECT * INTO v_predecessor
    FROM public.client_service_combination_rules
    WHERE tenant_id = NEW.tenant_id
      AND logical_rule_id = NEW.logical_rule_id
      AND id = NEW.predecessor_rule_id;
    IF NOT FOUND
      OR v_predecessor.version <> NEW.version - 1
      OR v_predecessor.financing_kind <> NEW.financing_kind
      OR v_predecessor.cost_carrier_reference <> NEW.cost_carrier_reference
      OR v_predecessor.service_type_a <> NEW.service_type_a
      OR v_predecessor.service_type_b <> NEW.service_type_b
      OR v_predecessor.valid_until IS NULL
      OR v_predecessor.valid_until >= NEW.valid_from
      OR v_predecessor.recorded_at >= NEW.recorded_at THEN
      RAISE EXCEPTION 'Regelvorgaenger fehlt, ist nicht unmittelbar oder die Zeitfolge ist ungueltig';
    END IF;
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.client_service_combination_rules existing
    WHERE existing.tenant_id = NEW.tenant_id
      AND existing.logical_rule_id <> NEW.logical_rule_id
      AND existing.financing_kind = NEW.financing_kind
      AND existing.cost_carrier_reference = NEW.cost_carrier_reference
      AND existing.service_type_a = NEW.service_type_a
      AND existing.service_type_b = NEW.service_type_b
      AND (existing.valid_until IS NULL OR existing.valid_until >= NEW.valid_from)
      AND (NEW.valid_until IS NULL OR NEW.valid_until >= existing.valid_from)
  ) THEN
    RAISE EXCEPTION 'Mehrere Kombinationsregeln wuerden gleichzeitig gelten';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_client_service_combination_rule_insert ON public.client_service_combination_rules;
CREATE TRIGGER validate_client_service_combination_rule_insert
  BEFORE INSERT ON public.client_service_combination_rules
  FOR EACH ROW EXECUTE FUNCTION public.validate_client_service_combination_rule();

CREATE TABLE IF NOT EXISTS public.client_service_combination_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  financing_path_id uuid NOT NULL REFERENCES public.client_financing_paths(id),
  financing_kind text NOT NULL CHECK (financing_kind IN ('sgb_xi', 'sgb_v', 'private', 'other')),
  cost_carrier_reference text NOT NULL CHECK (btrim(cost_carrier_reference) <> ''),
  service_type_a text NOT NULL CHECK (btrim(service_type_a) <> ''),
  service_type_b text NOT NULL CHECK (btrim(service_type_b) <> ''),
  service_on date NOT NULL,
  rule_id uuid NOT NULL,
  logical_rule_id uuid NOT NULL,
  rule_version integer NOT NULL CHECK (rule_version >= 1),
  rule_fingerprint text NOT NULL CHECK (btrim(rule_fingerprint) <> ''),
  outcome text NOT NULL CHECK (outcome IN ('allowed', 'prohibited', 'surcharge_required')),
  surcharge_service_type text,
  evidence_reference text NOT NULL CHECK (btrim(evidence_reference) <> ''),
  evaluated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  evaluated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CHECK (service_type_a < service_type_b),
  CHECK (
    (outcome = 'surcharge_required' AND btrim(surcharge_service_type) <> '')
    OR (outcome IN ('allowed', 'prohibited') AND surcharge_service_type IS NULL)
  ),
  FOREIGN KEY (tenant_id, logical_rule_id, rule_id, rule_version, rule_fingerprint)
    REFERENCES public.client_service_combination_rules(
      tenant_id, logical_rule_id, id, version, content_fingerprint
    )
);

CREATE INDEX IF NOT EXISTS idx_client_service_combination_review_scope
  ON public.client_service_combination_reviews (tenant_id, client_id, service_on, evaluated_at);

CREATE OR REPLACE FUNCTION public.validate_client_service_combination_review()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_path_tenant uuid;
  v_path_client uuid;
  v_path_kind text;
  v_rule public.client_service_combination_rules%ROWTYPE;
  v_match_count integer;
  v_rule_id uuid;
BEGIN
  SELECT tenant_id, client_id, financing_kind
    INTO v_path_tenant, v_path_client, v_path_kind
  FROM public.client_financing_paths
  WHERE id = NEW.financing_path_id;
  IF NOT FOUND OR v_path_tenant <> NEW.tenant_id OR v_path_client <> NEW.client_id OR v_path_kind <> NEW.financing_kind THEN
    RAISE EXCEPTION 'Finanzierungsweg gehoert nicht zu Mandant, Pflegefall und Finanzierungsart';
  END IF;

  SELECT count(*) INTO v_match_count
  FROM public.client_service_combination_rules rule
  WHERE rule.tenant_id = NEW.tenant_id
    AND rule.financing_kind = NEW.financing_kind
    AND rule.cost_carrier_reference = NEW.cost_carrier_reference
    AND rule.service_type_a = NEW.service_type_a
    AND rule.service_type_b = NEW.service_type_b
    AND rule.valid_from <= NEW.service_on
    AND (rule.valid_until IS NULL OR rule.valid_until >= NEW.service_on);
  IF v_match_count <> 1 THEN
    RAISE EXCEPTION 'Keine eindeutige datumsgueltige Kombinationsregel';
  END IF;

  SELECT id INTO v_rule_id
  FROM public.client_service_combination_rules rule
  WHERE rule.tenant_id = NEW.tenant_id
    AND rule.financing_kind = NEW.financing_kind
    AND rule.cost_carrier_reference = NEW.cost_carrier_reference
    AND rule.service_type_a = NEW.service_type_a
    AND rule.service_type_b = NEW.service_type_b
    AND rule.valid_from <= NEW.service_on
    AND (rule.valid_until IS NULL OR rule.valid_until >= NEW.service_on);
  IF v_rule_id <> NEW.rule_id THEN
    RAISE EXCEPTION 'Pruefung verweist nicht auf die datumsgueltige Kombinationsregel';
  END IF;

  SELECT * INTO v_rule
  FROM public.client_service_combination_rules
  WHERE id = NEW.rule_id;
  IF v_rule.logical_rule_id <> NEW.logical_rule_id
    OR v_rule.version <> NEW.rule_version
    OR v_rule.content_fingerprint <> NEW.rule_fingerprint
    OR v_rule.outcome <> NEW.outcome
    OR v_rule.surcharge_service_type IS DISTINCT FROM NEW.surcharge_service_type
    OR NEW.evaluated_at < v_rule.recorded_at THEN
    RAISE EXCEPTION 'Pruefung ist nicht an die konkrete Regelfassung und ihr Ergebnis gebunden';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_client_service_combination_review_insert ON public.client_service_combination_reviews;
CREATE TRIGGER validate_client_service_combination_review_insert
  BEFORE INSERT ON public.client_service_combination_reviews
  FOR EACH ROW EXECUTE FUNCTION public.validate_client_service_combination_review();

ALTER TABLE public.client_service_combination_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_service_combination_reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS client_service_combination_rules_read ON public.client_service_combination_rules;
CREATE POLICY client_service_combination_rules_read ON public.client_service_combination_rules
  FOR SELECT TO authenticated USING (
    tenant_id = public.current_tenant_id()
    AND (public.has_permission('clients.contracts.view') OR public.has_permission('office.clients.view'))
  );
DROP POLICY IF EXISTS client_service_combination_rules_insert ON public.client_service_combination_rules;
CREATE POLICY client_service_combination_rules_insert ON public.client_service_combination_rules
  FOR INSERT TO authenticated WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND (public.has_permission('clients.contracts.edit') OR public.has_permission('office.clients.edit'))
  );
DROP POLICY IF EXISTS client_service_combination_reviews_read ON public.client_service_combination_reviews;
CREATE POLICY client_service_combination_reviews_read ON public.client_service_combination_reviews
  FOR SELECT TO authenticated USING (
    tenant_id = public.current_tenant_id()
    AND (public.has_permission('clients.contracts.view') OR public.has_permission('office.clients.view'))
  );
DROP POLICY IF EXISTS client_service_combination_reviews_insert ON public.client_service_combination_reviews;
CREATE POLICY client_service_combination_reviews_insert ON public.client_service_combination_reviews
  FOR INSERT TO authenticated WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND (public.has_permission('clients.contracts.edit') OR public.has_permission('office.clients.edit'))
  );

GRANT SELECT, INSERT ON public.client_service_combination_rules TO authenticated;
GRANT SELECT, INSERT ON public.client_service_combination_reviews TO authenticated;

COMMENT ON TABLE public.client_service_combination_rules IS
  'Append-only datierte Kombinationsregeln je Kostentraeger, Finanzierungsart und kanonischem Leistungspaar.';
COMMENT ON TABLE public.client_service_combination_reviews IS
  'Append-only fallbezogene Pruefung gegen eine exakte Regelfassung; kein Leistungs-, Genehmigungs- oder Abrechnungsnachweis.';
