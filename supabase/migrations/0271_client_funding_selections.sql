-- CareSuite HealthOS — verbindliche, versionierte Finanzierungsarten je Klient:in.
-- Additiv, mandantenisoliert und idempotent.

BEGIN;

CREATE TABLE IF NOT EXISTS public.client_funding_selections (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  client_id       UUID        NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  sources         TEXT[]      NOT NULL,
  effective_from  DATE        NOT NULL DEFAULT CURRENT_DATE,
  replaced_at     TIMESTAMPTZ,
  created_by      UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT client_funding_selections_nonempty CHECK (cardinality(sources) > 0),
  CONSTRAINT client_funding_selections_allowed CHECK (
    sources <@ ARRAY[
      'entlastungsleistung',
      'umwandlung',
      'verhinderungspflege',
      'selbstzahler'
    ]::TEXT[]
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_client_funding_selections_current
  ON public.client_funding_selections (tenant_id, client_id)
  WHERE replaced_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_client_funding_selections_history
  ON public.client_funding_selections (tenant_id, client_id, effective_from DESC, created_at DESC);

DROP TRIGGER IF EXISTS set_client_funding_selections_updated_at ON public.client_funding_selections;
CREATE TRIGGER set_client_funding_selections_updated_at
  BEFORE UPDATE ON public.client_funding_selections
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.client_funding_selections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS client_funding_selections_select_tenant ON public.client_funding_selections;
CREATE POLICY client_funding_selections_select_tenant ON public.client_funding_selections
  FOR SELECT TO authenticated USING (
    tenant_id = public.current_tenant_id()
    AND (
      public.has_permission('clients.billing_profile.view')
      OR public.has_permission('office.clients.view')
    )
  );

DROP POLICY IF EXISTS client_funding_selections_write_tenant ON public.client_funding_selections;
CREATE POLICY client_funding_selections_write_tenant ON public.client_funding_selections
  FOR ALL TO authenticated USING (
    tenant_id = public.current_tenant_id()
    AND (
      public.has_permission('clients.billing_profile.edit')
      OR public.has_permission('clients.budgets.edit')
      OR public.has_permission('office.clients.edit')
    )
  ) WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND (
      public.has_permission('clients.billing_profile.edit')
      OR public.has_permission('clients.budgets.edit')
      OR public.has_permission('office.clients.edit')
    )
  );

DROP POLICY IF EXISTS client_funding_selections_portal_own_select ON public.client_funding_selections;
CREATE POLICY client_funding_selections_portal_own_select ON public.client_funding_selections
  FOR SELECT TO authenticated USING (
    tenant_id = public.current_tenant_id()
    AND client_id = public.current_client_id()
    AND public.current_client_id() IS NOT NULL
  );

GRANT SELECT, INSERT, UPDATE ON public.client_funding_selections TO authenticated;

-- Bestehende Klient:innen werden ausschließlich aus bereits eindeutig gesetzten
-- Ansprüchen/Vereinbarungen übernommen. Ohne belastbare Altdaten bleibt die Auswahl
-- bewusst offen und muss im Profil bestätigt werden.
INSERT INTO public.client_funding_selections (
  tenant_id, client_id, sources, effective_from, created_at, updated_at
)
SELECT
  c.tenant_id,
  c.id,
  legacy.sources,
  CURRENT_DATE,
  NOW(),
  NOW()
FROM public.clients c
CROSS JOIN LATERAL (
  SELECT ARRAY_REMOVE(ARRAY[
    CASE WHEN EXISTS (
      SELECT 1 FROM public.client_care_entitlement ce
      WHERE ce.tenant_id = c.tenant_id
        AND ce.client_id = c.id
        AND ce.valid_until IS NULL
    ) OR c.care_level IS NOT NULL THEN 'entlastungsleistung' END,
    CASE WHEN EXISTS (
      SELECT 1 FROM public.client_care_entitlement ce
      WHERE ce.tenant_id = c.tenant_id
        AND ce.client_id = c.id
        AND ce.valid_until IS NULL
        AND ce.conversion_enabled = TRUE
    ) THEN 'umwandlung' END,
    CASE WHEN EXISTS (
      SELECT 1 FROM public.client_service_entitlements se
      WHERE se.tenant_id = c.tenant_id
        AND se.client_id = c.id
        AND se.is_active = TRUE
        AND se.service_type_key LIKE '%verhinderung%'
    ) THEN 'verhinderungspflege' END,
    CASE WHEN EXISTS (
      SELECT 1 FROM public.client_insurance_profiles ip
      WHERE ip.tenant_id = c.tenant_id
        AND ip.client_id = c.id
        AND ip.is_primary = TRUE
        AND ip.self_pay = TRUE
    ) OR EXISTS (
      SELECT 1 FROM public.client_service_entitlements se
      WHERE se.tenant_id = c.tenant_id
        AND se.client_id = c.id
        AND se.is_active = TRUE
        AND se.billing_mode IN ('self_payer', 'mixed')
    ) THEN 'selbstzahler' END
  ], NULL)::TEXT[] AS sources
) legacy
WHERE cardinality(legacy.sources) > 0
  AND NOT EXISTS (
    SELECT 1 FROM public.client_funding_selections current_selection
    WHERE current_selection.tenant_id = c.tenant_id
      AND current_selection.client_id = c.id
      AND current_selection.replaced_at IS NULL
  );

CREATE OR REPLACE FUNCTION public.set_client_funding_sources(
  p_client_id UUID,
  p_sources TEXT[],
  p_effective_from DATE DEFAULT CURRENT_DATE
)
RETURNS SETOF public.client_funding_selections
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_tenant_id UUID := public.current_tenant_id();
  v_sources TEXT[];
  v_current public.client_funding_selections%ROWTYPE;
  v_result public.client_funding_selections%ROWTYPE;
BEGIN
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Kein aktiver Mandant.';
  END IF;
  IF NOT (
    public.has_permission('clients.billing_profile.edit')
    OR public.has_permission('clients.budgets.edit')
    OR public.has_permission('office.clients.edit')
  ) THEN
    RAISE EXCEPTION 'Keine Berechtigung zum Ändern der Finanzierungsarten.';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.clients
    WHERE id = p_client_id AND tenant_id = v_tenant_id
  ) THEN
    RAISE EXCEPTION 'Klient:in nicht gefunden.';
  END IF;

  SELECT ARRAY_AGG(source ORDER BY position)
  INTO v_sources
  FROM (
    SELECT source, MIN(position) AS position
    FROM UNNEST(COALESCE(p_sources, ARRAY[]::TEXT[])) WITH ORDINALITY AS item(source, position)
    WHERE source = ANY (ARRAY[
      'entlastungsleistung', 'umwandlung', 'verhinderungspflege', 'selbstzahler'
    ]::TEXT[])
    GROUP BY source
  ) normalized;

  IF COALESCE(cardinality(v_sources), 0) = 0 THEN
    RAISE EXCEPTION 'Mindestens eine Finanzierungsart muss ausgewählt werden.';
  END IF;

  SELECT * INTO v_current
  FROM public.client_funding_selections
  WHERE tenant_id = v_tenant_id
    AND client_id = p_client_id
    AND replaced_at IS NULL
  FOR UPDATE;

  IF v_current.id IS NOT NULL AND v_current.sources = v_sources THEN
    RETURN NEXT v_current;
    RETURN;
  END IF;

  IF v_current.id IS NOT NULL THEN
    UPDATE public.client_funding_selections
    SET replaced_at = NOW()
    WHERE id = v_current.id;
  END IF;

  INSERT INTO public.client_funding_selections (
    tenant_id, client_id, sources, effective_from, created_by
  ) VALUES (
    v_tenant_id, p_client_id, v_sources, COALESCE(p_effective_from, CURRENT_DATE), auth.uid()
  ) RETURNING * INTO v_result;

  UPDATE public.client_insurance_profiles
  SET self_pay = ('selbstzahler' = ANY(v_sources))
  WHERE tenant_id = v_tenant_id
    AND client_id = p_client_id
    AND is_primary = TRUE;

  UPDATE public.client_care_entitlement
  SET conversion_enabled = ('umwandlung' = ANY(v_sources))
  WHERE tenant_id = v_tenant_id
    AND client_id = p_client_id
    AND valid_until IS NULL;

  UPDATE public.client_budget_accounts
  SET
    is_enabled = FALSE,
    status = 'suspended',
    locked = TRUE,
    lock_reason = 'Finanzierungsart nicht ausgewählt'
  WHERE tenant_id = v_tenant_id
    AND client_id = p_client_id
    AND (
      (catalog_key = 'paragraph_45b' AND NOT ('entlastungsleistung' = ANY(v_sources)))
      OR (catalog_key LIKE 'umwandlung_%' AND NOT ('umwandlung' = ANY(v_sources)))
      OR (catalog_key IN ('verhinderungspflege', 'gemeinsames_jahresbudget') AND NOT ('verhinderungspflege' = ANY(v_sources)))
      OR (catalog_key = 'selbstzahler' AND NOT ('selbstzahler' = ANY(v_sources)))
    );

  UPDATE public.client_budget_accounts
  SET
    is_enabled = TRUE,
    status = 'active',
    locked = FALSE,
    lock_reason = NULL
  WHERE tenant_id = v_tenant_id
    AND client_id = p_client_id
    AND lock_reason = 'Finanzierungsart nicht ausgewählt'
    AND (
      (catalog_key = 'paragraph_45b' AND 'entlastungsleistung' = ANY(v_sources))
      OR (catalog_key LIKE 'umwandlung_%' AND 'umwandlung' = ANY(v_sources))
      OR (catalog_key IN ('verhinderungspflege', 'gemeinsames_jahresbudget') AND 'verhinderungspflege' = ANY(v_sources))
      OR (catalog_key = 'selbstzahler' AND 'selbstzahler' = ANY(v_sources))
    );

  RETURN NEXT v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_client_funding_sources(UUID, TEXT[], DATE) TO authenticated;

COMMENT ON TABLE public.client_funding_selections IS
  'Versionierte Single Source of Truth der vom Klienten gewünschten Finanzierungsarten.';

COMMIT;
