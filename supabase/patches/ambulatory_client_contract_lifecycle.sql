-- Checkpoint 230 / T-08: append-only Vertragsaenderungs- und Schliessungshistorie.
-- Ein Lebenszyklusereignis oder eine Leistungszuordnung bestaetigt weder Leistungserbringung noch Abrechnungsfreigabe.

CREATE TABLE IF NOT EXISTS public.client_contract_lifecycle_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  logical_contract_id uuid NOT NULL DEFAULT gen_random_uuid(),
  source_contract_id uuid NOT NULL REFERENCES public.client_contracts(id),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  version integer NOT NULL CHECK (version >= 1),
  event_kind text NOT NULL CHECK (event_kind IN ('initial', 'amendment', 'closure')),
  effective_on date NOT NULL,
  change_reason text,
  consequences text,
  predecessor_event_id uuid,
  contract_number text NOT NULL CHECK (btrim(contract_number) <> ''),
  contract_partner text NOT NULL CHECK (btrim(contract_partner) <> ''),
  service_basis text NOT NULL CHECK (btrim(service_basis) <> ''),
  document_reference text NOT NULL CHECK (btrim(document_reference) <> ''),
  content_fingerprint text NOT NULL CHECK (btrim(content_fingerprint) <> ''),
  recorded_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CHECK (
    (event_kind = 'initial' AND version = 1 AND predecessor_event_id IS NULL AND change_reason IS NULL AND consequences IS NULL)
    OR
    (event_kind IN ('amendment', 'closure') AND version > 1 AND predecessor_event_id IS NOT NULL
      AND btrim(change_reason) <> '' AND btrim(consequences) <> '')
  ),
  UNIQUE (tenant_id, logical_contract_id, version),
  UNIQUE (tenant_id, client_id, source_contract_id, version),
  UNIQUE (tenant_id, client_id, logical_contract_id, id),
  UNIQUE (tenant_id, client_id, logical_contract_id, id, version, content_fingerprint),
  UNIQUE (tenant_id, client_id, logical_contract_id, source_contract_id, id)
);

DO $$ BEGIN
  ALTER TABLE public.client_contract_lifecycle_events
    ADD CONSTRAINT client_contract_lifecycle_predecessor_fk
    FOREIGN KEY (tenant_id, client_id, logical_contract_id, source_contract_id, predecessor_event_id)
    REFERENCES public.client_contract_lifecycle_events(tenant_id, client_id, logical_contract_id, source_contract_id, id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_client_contract_lifecycle_one_successor
  ON public.client_contract_lifecycle_events (tenant_id, client_id, logical_contract_id, predecessor_event_id)
  WHERE predecessor_event_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_client_contract_lifecycle_scope
  ON public.client_contract_lifecycle_events (tenant_id, client_id, logical_contract_id, version, effective_on);

CREATE OR REPLACE FUNCTION public.validate_client_contract_lifecycle_event()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_source_tenant uuid;
  v_source_client uuid;
  v_predecessor_version integer;
  v_predecessor_kind text;
  v_predecessor_effective_on date;
  v_predecessor_recorded_at timestamptz;
BEGIN
  SELECT tenant_id, client_id INTO v_source_tenant, v_source_client
  FROM public.client_contracts
  WHERE id = NEW.source_contract_id;
  IF NOT FOUND OR v_source_tenant <> NEW.tenant_id OR v_source_client <> NEW.client_id THEN
    RAISE EXCEPTION 'Native Vertrags-ID gehoert nicht zu Mandant und Pflegefall';
  END IF;

  IF NEW.predecessor_event_id IS NOT NULL THEN
    SELECT version, event_kind, effective_on, recorded_at
      INTO v_predecessor_version, v_predecessor_kind, v_predecessor_effective_on, v_predecessor_recorded_at
    FROM public.client_contract_lifecycle_events
    WHERE tenant_id = NEW.tenant_id
      AND client_id = NEW.client_id
      AND logical_contract_id = NEW.logical_contract_id
      AND source_contract_id = NEW.source_contract_id
      AND id = NEW.predecessor_event_id;
    IF NOT FOUND
      OR v_predecessor_version <> NEW.version - 1
      OR v_predecessor_kind = 'closure'
      OR v_predecessor_effective_on >= NEW.effective_on
      OR v_predecessor_recorded_at >= NEW.recorded_at THEN
      RAISE EXCEPTION 'Vertragsvorgaenger fehlt, ist nicht unmittelbar oder die Reihenfolge ist ungueltig';
    END IF;
    IF EXISTS (
      SELECT 1
      FROM public.client_contract_service_bindings
      WHERE tenant_id = NEW.tenant_id
        AND client_id = NEW.client_id
        AND logical_contract_id = NEW.logical_contract_id
        AND service_occurred_on >= NEW.effective_on
    ) THEN
      RAISE EXCEPTION 'Rueckwirkendes Vertragsereignis wuerde bereits gebundene Leistungsreferenzen entwerten';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_client_contract_lifecycle_event_insert ON public.client_contract_lifecycle_events;
CREATE TRIGGER validate_client_contract_lifecycle_event_insert
  BEFORE INSERT ON public.client_contract_lifecycle_events
  FOR EACH ROW EXECUTE FUNCTION public.validate_client_contract_lifecycle_event();

CREATE TABLE IF NOT EXISTS public.client_contract_service_bindings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  client_id uuid NOT NULL,
  logical_contract_id uuid NOT NULL,
  lifecycle_event_id uuid NOT NULL,
  lifecycle_version integer NOT NULL CHECK (lifecycle_version >= 1),
  lifecycle_fingerprint text NOT NULL CHECK (btrim(lifecycle_fingerprint) <> ''),
  service_evidence_id uuid NOT NULL,
  service_occurred_on date NOT NULL,
  linked_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  linked_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  FOREIGN KEY (
    tenant_id, client_id, logical_contract_id, lifecycle_event_id,
    lifecycle_version, lifecycle_fingerprint
  ) REFERENCES public.client_contract_lifecycle_events(
    tenant_id, client_id, logical_contract_id, id,
    version, content_fingerprint
  ),
  UNIQUE (tenant_id, client_id, service_evidence_id)
);

CREATE INDEX IF NOT EXISTS idx_client_contract_service_bindings_scope
  ON public.client_contract_service_bindings (tenant_id, client_id, logical_contract_id, service_occurred_on);

CREATE OR REPLACE FUNCTION public.validate_client_contract_service_binding()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_event_id uuid;
  v_version integer;
  v_kind text;
  v_fingerprint text;
  v_recorded_at timestamptz;
BEGIN
  SELECT id, version, event_kind, content_fingerprint, recorded_at
    INTO v_event_id, v_version, v_kind, v_fingerprint, v_recorded_at
  FROM public.client_contract_lifecycle_events
  WHERE tenant_id = NEW.tenant_id
    AND client_id = NEW.client_id
    AND logical_contract_id = NEW.logical_contract_id
    AND effective_on <= NEW.service_occurred_on
  ORDER BY effective_on DESC, version DESC
  LIMIT 1;

  IF NOT FOUND
    OR v_kind = 'closure'
    OR v_event_id <> NEW.lifecycle_event_id
    OR v_version <> NEW.lifecycle_version
    OR v_fingerprint <> NEW.lifecycle_fingerprint
    OR NEW.linked_at < v_recorded_at THEN
    RAISE EXCEPTION 'Leistungsreferenz ist nicht an die datumsgueltige konkrete Vertragsfassung gebunden';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_client_contract_service_binding_insert ON public.client_contract_service_bindings;
CREATE TRIGGER validate_client_contract_service_binding_insert
  BEFORE INSERT ON public.client_contract_service_bindings
  FOR EACH ROW EXECUTE FUNCTION public.validate_client_contract_service_binding();

ALTER TABLE public.client_contract_lifecycle_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_contract_service_bindings ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['client_contract_lifecycle_events', 'client_contract_service_bindings'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', table_name || '_read', table_name);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (tenant_id = public.current_tenant_id() AND (public.has_permission(''clients.contracts.view'') OR public.has_permission(''office.clients.view'')))',
      table_name || '_read', table_name
    );
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', table_name || '_insert', table_name);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (tenant_id = public.current_tenant_id() AND (public.has_permission(''clients.contracts.edit'') OR public.has_permission(''office.clients.edit'')))',
      table_name || '_insert', table_name
    );
  END LOOP;
END $$;

GRANT SELECT, INSERT ON public.client_contract_lifecycle_events TO authenticated;
GRANT SELECT, INSERT ON public.client_contract_service_bindings TO authenticated;

COMMENT ON TABLE public.client_contract_lifecycle_events IS
  'Append-only Vertragsfassungen, Aenderungen und Schliessungen mit nativer Vertragsidentitaet, Grund, Wirksamkeit, Vorganger und Folgen.';
COMMENT ON TABLE public.client_contract_service_bindings IS
  'Append-only Referenz einer Leistung auf die am Leistungsdatum gueltige konkrete Vertragsfassung; kein Durchfuehrungs- oder Abrechnungsnachweis.';
