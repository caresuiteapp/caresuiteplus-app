-- Checkpoint 228 / T-06: individuelle Anspruchszeiträume und append-only Verbrauchsketten.
-- Vorgänger bleiben unverändert erhalten; nur der eindeutige aktuelle Kettenkopf wirkt im Verbrauch.

CREATE TABLE IF NOT EXISTS public.client_budget_entitlement_periods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  financing_path_id uuid NOT NULL,
  service_type_key text NOT NULL CHECK (btrim(service_type_key) <> ''),
  basis_reference text NOT NULL CHECK (btrim(basis_reference) <> ''),
  period_start date NOT NULL,
  period_end date NOT NULL,
  allocated_cents bigint NOT NULL CHECK (allocated_cents BETWEEN 0 AND 999999999),
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  FOREIGN KEY (tenant_id, client_id, financing_path_id)
    REFERENCES public.client_financing_paths(tenant_id, client_id, id),
  CHECK (period_end >= period_start),
  UNIQUE (tenant_id, client_id, financing_path_id, service_type_key, id)
);

CREATE INDEX IF NOT EXISTS idx_client_budget_entitlement_scope
  ON public.client_budget_entitlement_periods
  (tenant_id, client_id, financing_path_id, service_type_key, period_start, period_end);

CREATE TABLE IF NOT EXISTS public.client_budget_consumption_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  client_id uuid NOT NULL,
  entitlement_period_id uuid NOT NULL,
  financing_path_id uuid NOT NULL,
  service_type_key text NOT NULL CHECK (btrim(service_type_key) <> ''),
  service_date date NOT NULL,
  amount_cents bigint NOT NULL CHECK (amount_cents BETWEEN 0 AND 999999999),
  event_kind text NOT NULL CHECK (event_kind IN ('usage', 'correction', 'cancellation')),
  supersedes_event_id uuid,
  source_type text NOT NULL CHECK (btrim(source_type) <> ''),
  source_id text NOT NULL CHECK (btrim(source_id) <> ''),
  reason text,
  recorded_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  FOREIGN KEY (tenant_id, client_id, financing_path_id, service_type_key, entitlement_period_id)
    REFERENCES public.client_budget_entitlement_periods(tenant_id, client_id, financing_path_id, service_type_key, id),
  CHECK (
    (event_kind = 'usage' AND supersedes_event_id IS NULL AND amount_cents > 0 AND reason IS NULL)
    OR (event_kind = 'correction' AND supersedes_event_id IS NOT NULL AND amount_cents > 0 AND btrim(reason) <> '')
    OR (event_kind = 'cancellation' AND supersedes_event_id IS NOT NULL AND amount_cents = 0 AND btrim(reason) <> '')
  ),
  UNIQUE (tenant_id, client_id, entitlement_period_id, id),
  UNIQUE (tenant_id, source_type, source_id)
);

DO $$ BEGIN
  ALTER TABLE public.client_budget_consumption_events
    ADD CONSTRAINT client_budget_consumption_predecessor_fk
    FOREIGN KEY (tenant_id, client_id, entitlement_period_id, supersedes_event_id)
    REFERENCES public.client_budget_consumption_events(tenant_id, client_id, entitlement_period_id, id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE OR REPLACE FUNCTION public.validate_client_budget_consumption_event()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_start date;
  v_end date;
  v_predecessor_time timestamptz;
BEGIN
  SELECT period_start, period_end INTO v_start, v_end
  FROM public.client_budget_entitlement_periods
  WHERE tenant_id = NEW.tenant_id
    AND client_id = NEW.client_id
    AND financing_path_id = NEW.financing_path_id
    AND service_type_key = NEW.service_type_key
    AND id = NEW.entitlement_period_id;
  IF NOT FOUND OR NEW.service_date < v_start OR NEW.service_date > v_end THEN
    RAISE EXCEPTION 'Leistungsdatum liegt außerhalb des Anspruchszeitraums';
  END IF;
  IF NEW.supersedes_event_id IS NOT NULL THEN
    SELECT recorded_at INTO v_predecessor_time
    FROM public.client_budget_consumption_events
    WHERE tenant_id = NEW.tenant_id
      AND client_id = NEW.client_id
      AND entitlement_period_id = NEW.entitlement_period_id
      AND id = NEW.supersedes_event_id;
    IF NOT FOUND OR v_predecessor_time >= NEW.recorded_at THEN
      RAISE EXCEPTION 'Vorgänger fehlt oder wurde nicht früher erfasst';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_client_budget_consumption_event_insert
  ON public.client_budget_consumption_events;
CREATE TRIGGER validate_client_budget_consumption_event_insert
  BEFORE INSERT ON public.client_budget_consumption_events
  FOR EACH ROW EXECUTE FUNCTION public.validate_client_budget_consumption_event();

CREATE UNIQUE INDEX IF NOT EXISTS idx_client_budget_consumption_one_successor
  ON public.client_budget_consumption_events
  (tenant_id, client_id, entitlement_period_id, supersedes_event_id)
  WHERE supersedes_event_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_client_budget_consumption_history
  ON public.client_budget_consumption_events
  (tenant_id, client_id, entitlement_period_id, recorded_at, id);

ALTER TABLE public.client_budget_entitlement_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_budget_consumption_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS client_budget_entitlement_read ON public.client_budget_entitlement_periods;
CREATE POLICY client_budget_entitlement_read ON public.client_budget_entitlement_periods
  FOR SELECT TO authenticated USING (
    tenant_id = public.current_tenant_id()
    AND (public.has_permission('clients.billing_profile.view') OR public.has_permission('office.clients.view'))
  );

DROP POLICY IF EXISTS client_budget_entitlement_insert ON public.client_budget_entitlement_periods;
CREATE POLICY client_budget_entitlement_insert ON public.client_budget_entitlement_periods
  FOR INSERT TO authenticated WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND (public.has_permission('clients.billing_profile.edit') OR public.has_permission('office.clients.edit'))
  );

DROP POLICY IF EXISTS client_budget_consumption_read ON public.client_budget_consumption_events;
CREATE POLICY client_budget_consumption_read ON public.client_budget_consumption_events
  FOR SELECT TO authenticated USING (
    tenant_id = public.current_tenant_id()
    AND (public.has_permission('clients.billing_profile.view') OR public.has_permission('office.clients.view'))
  );

DROP POLICY IF EXISTS client_budget_consumption_insert ON public.client_budget_consumption_events;
CREATE POLICY client_budget_consumption_insert ON public.client_budget_consumption_events
  FOR INSERT TO authenticated WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND (public.has_permission('clients.billing_profile.edit') OR public.has_permission('office.clients.edit'))
  );

GRANT SELECT, INSERT ON public.client_budget_entitlement_periods TO authenticated;
GRANT SELECT, INSERT ON public.client_budget_consumption_events TO authenticated;

COMMENT ON TABLE public.client_budget_entitlement_periods IS
  'Individuell belegte Anspruchsgrundlage je Leistungsart, Finanzierungsweg und Zeitraum; keine Anspruchsfreigabe.';
COMMENT ON TABLE public.client_budget_consumption_events IS
  'Append-only Verbrauchshistorie. Korrektur/Storno ersetzen genau einen nativen Vorgänger, ohne ihn zu überschreiben.';
