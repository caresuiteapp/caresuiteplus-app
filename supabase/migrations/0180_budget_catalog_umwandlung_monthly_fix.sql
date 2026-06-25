-- ==========================================================================
-- CareSuite+ — Migration 0180: Budget-Korrektur 2026
-- Umwandlung PG2–PG5: monatlich (nicht jährlich) im Katalog + Klientenkonten.
-- client_budget_mode + erweiterte client_budget_accounts Spalten.
-- ==========================================================================

-- --------------------------------------------------------------------------
-- 1. Katalog: Umwandlung §45a → period = monthly, Beschreibung korrigieren
-- --------------------------------------------------------------------------
UPDATE public.budget_template_catalog
SET
  period = 'monthly',
  description = CASE catalog_key
    WHEN 'umwandlung_pg2' THEN 'Monatlicher Umwandlungsanspruch Pflegegrad 2 (§ 45a SGB XI)'
    WHEN 'umwandlung_pg3' THEN 'Monatlicher Umwandlungsanspruch Pflegegrad 3 (§ 45a SGB XI)'
    WHEN 'umwandlung_pg4' THEN 'Monatlicher Umwandlungsanspruch Pflegegrad 4 (§ 45a SGB XI)'
    WHEN 'umwandlung_pg5' THEN 'Monatlicher Umwandlungsanspruch Pflegegrad 5 (§ 45a SGB XI)'
    ELSE description
  END,
  updated_at = NOW()
WHERE budget_year = 2026
  AND (
    catalog_key LIKE 'umwandlung_%'
    OR (metadata->>'legal_ref') ILIKE '%45a%'
  );

-- Re-seed / upsert exact 2026 cent values (idempotent)
INSERT INTO public.budget_template_catalog (
  catalog_key, budget_year, label, description, period,
  default_amount_cents, care_grade_min, care_grade_max,
  billing_priority, allows_individual_override, auto_generate, is_statutory, metadata
) VALUES
  (
    'paragraph_45b', 2026, 'Entlastungsbudget § 45b SGB XI',
    'Monatliches Entlastungsbudget — Pflegegrade 1–5', 'monthly',
    13100, 'pg1', 'pg5', 1, TRUE, TRUE, TRUE,
    '{"legal_ref":"§45b SGB XI","currency":"EUR"}'::jsonb
  ),
  (
    'umwandlung_pg2', 2026, 'Umwandlung Entlastungsbudget PG 2',
    'Monatlicher Umwandlungsanspruch Pflegegrad 2 (§ 45a SGB XI)', 'monthly',
    31800, 'pg2', 'pg2', 2, TRUE, TRUE, TRUE,
    '{"legal_ref":"§45a SGB XI","conversion":true}'::jsonb
  ),
  (
    'umwandlung_pg3', 2026, 'Umwandlung Entlastungsbudget PG 3',
    'Monatlicher Umwandlungsanspruch Pflegegrad 3 (§ 45a SGB XI)', 'monthly',
    59800, 'pg3', 'pg3', 2, TRUE, TRUE, TRUE,
    '{"legal_ref":"§45a SGB XI","conversion":true}'::jsonb
  ),
  (
    'umwandlung_pg4', 2026, 'Umwandlung Entlastungsbudget PG 4',
    'Monatlicher Umwandlungsanspruch Pflegegrad 4 (§ 45a SGB XI)', 'monthly',
    74300, 'pg4', 'pg4', 2, TRUE, TRUE, TRUE,
    '{"legal_ref":"§45a SGB XI","conversion":true}'::jsonb
  ),
  (
    'umwandlung_pg5', 2026, 'Umwandlung Entlastungsbudget PG 5',
    'Monatlicher Umwandlungsanspruch Pflegegrad 5 (§ 45a SGB XI)', 'monthly',
    91900, 'pg5', 'pg5', 2, TRUE, TRUE, TRUE,
    '{"legal_ref":"§45a SGB XI","conversion":true}'::jsonb
  ),
  (
    'verhinderungspflege', 2026, 'Verhinderungspflege § 39 SGB XI',
    'Jährliches Verhinderungspflege-Budget PG 2–5', 'yearly',
    168500, 'pg2', 'pg5', 3, TRUE, TRUE, TRUE,
    '{"legal_ref":"§39 SGB XI"}'::jsonb
  ),
  (
    'kurzzeitpflege', 2026, 'Kurzzeitpflege § 42 SGB XI',
    'Jährliches Kurzzeitpflege-Budget', 'yearly',
    185400, NULL, NULL, 4, TRUE, TRUE, TRUE,
    '{"legal_ref":"§42 SGB XI"}'::jsonb
  ),
  (
    'gemeinsames_jahresbudget', 2026, 'Gemeinsames Jahresbudget',
    'Kombiniertes Jahresbudget Entlastung + Umwandlung', 'yearly',
    353900, NULL, NULL, 5, TRUE, FALSE, TRUE,
    '{"legal_ref":"§45b/§45a kombiniert"}'::jsonb
  ),
  (
    'selbstzahler', 2026, 'Selbstzahler',
    'Individuelle Vereinbarung ohne Kassenbudget', 'yearly',
    NULL, NULL, NULL, 90, TRUE, FALSE, FALSE,
    '{"billing_mode":"self_payer"}'::jsonb
  ),
  (
    'kulanz', 2026, 'Kulanz',
    'Kulanzleistung ohne festes Budget', 'yearly',
    NULL, NULL, NULL, 91, TRUE, FALSE, FALSE,
    '{"billing_mode":"kulanz"}'::jsonb
  ),
  (
    'ungeklaert', 2026, 'Ungeklärt',
    'Abrechnungsklärung ausstehend', 'yearly',
    NULL, NULL, NULL, 99, TRUE, FALSE, FALSE,
    '{"billing_mode":"unclear"}'::jsonb
  )
ON CONFLICT (catalog_key, budget_year) DO UPDATE SET
  label = EXCLUDED.label,
  description = EXCLUDED.description,
  period = EXCLUDED.period,
  default_amount_cents = EXCLUDED.default_amount_cents,
  care_grade_min = EXCLUDED.care_grade_min,
  care_grade_max = EXCLUDED.care_grade_max,
  billing_priority = EXCLUDED.billing_priority,
  allows_individual_override = EXCLUDED.allows_individual_override,
  auto_generate = EXCLUDED.auto_generate,
  is_statutory = EXCLUDED.is_statutory,
  metadata = EXCLUDED.metadata,
  updated_at = NOW();

-- --------------------------------------------------------------------------
-- 2. client_budget_accounts — zusätzliche Spalten
-- --------------------------------------------------------------------------
ALTER TABLE public.client_budget_accounts
  ADD COLUMN IF NOT EXISTS standard_amount_cents BIGINT,
  ADD COLUMN IF NOT EXISTS locked BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS lock_reason TEXT,
  ADD COLUMN IF NOT EXISTS is_enabled BOOLEAN NOT NULL DEFAULT TRUE;

COMMENT ON COLUMN public.client_budget_accounts.standard_amount_cents IS
  'Katalog-Standardbetrag zum Zeitpunkt der Konteneröffnung (Migration 0180)';
COMMENT ON COLUMN public.client_budget_accounts.is_enabled IS
  'Aktiv-Schalter im Budget-Tab — deaktiviert ohne Löschung (Migration 0180)';

-- Backfill standard_amount_cents from catalog
UPDATE public.client_budget_accounts a
SET standard_amount_cents = c.default_amount_cents
FROM public.budget_template_catalog c
WHERE a.catalog_template_id = c.id
  AND a.standard_amount_cents IS NULL
  AND c.default_amount_cents IS NOT NULL;

UPDATE public.client_budget_accounts a
SET standard_amount_cents = c.default_amount_cents
FROM public.budget_template_catalog c
WHERE a.catalog_key = c.catalog_key
  AND a.catalog_year = c.budget_year
  AND a.standard_amount_cents IS NULL
  AND c.default_amount_cents IS NOT NULL;

-- --------------------------------------------------------------------------
-- 3. Klientenkonten: Umwandlung period → monthly + Monatsgrenzen
-- --------------------------------------------------------------------------
UPDATE public.client_budget_accounts
SET
  period = 'monthly',
  period_start = make_date(
    catalog_year,
    GREATEST(1, LEAST(12, EXTRACT(MONTH FROM COALESCE(period_start, CURRENT_DATE))::INT)),
    1
  ),
  period_end = (
    make_date(
      catalog_year,
      GREATEST(1, LEAST(12, EXTRACT(MONTH FROM COALESCE(period_start, CURRENT_DATE))::INT)),
      1
    ) + INTERVAL '1 month - 1 day'
  )::DATE,
  updated_at = NOW()
WHERE catalog_key LIKE 'umwandlung_%'
  AND period <> 'monthly';

-- --------------------------------------------------------------------------
-- 4. client_budget_mode — Verhinderung/Kurzzeit vs. gemeinsames Jahresbudget
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.client_budget_mode (
  id                      UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               UUID          NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  client_id               UUID          NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  budget_year             INT           NOT NULL,
  care_prevention_mode    TEXT          NOT NULL DEFAULT 'separate_preventive_short_term',
  mode_change_reason      TEXT,
  metadata                JSONB         NOT NULL DEFAULT '{}'::jsonb,
  created_at              TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  CONSTRAINT client_budget_mode_mode_check
    CHECK (care_prevention_mode IN ('joint_annual_budget', 'separate_preventive_short_term')),
  UNIQUE (tenant_id, client_id, budget_year)
);

CREATE INDEX IF NOT EXISTS idx_client_budget_mode_client
  ON public.client_budget_mode (tenant_id, client_id, budget_year);

COMMENT ON TABLE public.client_budget_mode IS
  'Budget-Modus je Klient:in/Jahr: gemeinsames Jahresbudget vs. getrennte VP/Kurzzeit (Migration 0180)';

DROP TRIGGER IF EXISTS set_client_budget_mode_updated_at ON public.client_budget_mode;
CREATE TRIGGER set_client_budget_mode_updated_at
  BEFORE UPDATE ON public.client_budget_mode
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.client_budget_mode ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS client_budget_mode_select_tenant ON public.client_budget_mode;
CREATE POLICY client_budget_mode_select_tenant ON public.client_budget_mode
  FOR SELECT TO authenticated USING (
    tenant_id = public.current_tenant_id()
    AND (
      public.has_permission('clients.billing_profile.view')
      OR public.has_permission('office.clients.view')
    )
  );

DROP POLICY IF EXISTS client_budget_mode_write_tenant ON public.client_budget_mode;
CREATE POLICY client_budget_mode_write_tenant ON public.client_budget_mode
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

GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_budget_mode TO authenticated;
