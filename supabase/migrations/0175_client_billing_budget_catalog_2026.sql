-- ==========================================================================
-- CareSuite+ — Migration 0175: Klient:innenakte Leistungen, Budgets, Vorlagen 2026
-- System budget template catalog (versioned by year) + client billing foundation.
-- Additive only — complements 0159/0160 without replacing tenant_budget_* tables.
-- ==========================================================================

-- --------------------------------------------------------------------------
-- budget_template_catalog — versioned statutory / standard budget templates
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.budget_template_catalog (
  id                      UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  catalog_key             TEXT          NOT NULL,
  budget_year             INT           NOT NULL,
  label                   TEXT          NOT NULL,
  description             TEXT,
  period                  TEXT          NOT NULL DEFAULT 'yearly',
  default_amount_cents    BIGINT,
  care_grade_min          TEXT,
  care_grade_max          TEXT,
  billing_priority        INT           NOT NULL DEFAULT 99,
  allows_individual_override BOOLEAN      NOT NULL DEFAULT TRUE,
  auto_generate           BOOLEAN       NOT NULL DEFAULT TRUE,
  is_statutory            BOOLEAN       NOT NULL DEFAULT TRUE,
  metadata                JSONB         NOT NULL DEFAULT '{}'::jsonb,
  is_active               BOOLEAN       NOT NULL DEFAULT TRUE,
  created_at              TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  CONSTRAINT budget_template_catalog_period_check
    CHECK (period IN ('monthly', 'yearly', 'quarterly')),
  CONSTRAINT budget_template_catalog_grade_min_check
    CHECK (care_grade_min IS NULL OR care_grade_min IN ('pg1','pg2','pg3','pg4','pg5','kein')),
  CONSTRAINT budget_template_catalog_grade_max_check
    CHECK (care_grade_max IS NULL OR care_grade_max IN ('pg1','pg2','pg3','pg4','pg5','kein')),
  UNIQUE (catalog_key, budget_year)
);

CREATE INDEX IF NOT EXISTS idx_budget_template_catalog_year
  ON public.budget_template_catalog (budget_year, billing_priority, is_active);

COMMENT ON TABLE public.budget_template_catalog IS
  'Versionierte Budget-Vorlagen (z. B. §45b 2026) — Migration 0175';

-- --------------------------------------------------------------------------
-- client_care_entitlement — Pflegegrad & Anspruch je Klient:in
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.client_care_entitlement (
  id                      UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               UUID          NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  client_id               UUID          NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  care_grade              TEXT          NOT NULL
                          CHECK (care_grade IN ('kein','pg1','pg2','pg3','pg4','pg5','hospiz')),
  valid_from              DATE          NOT NULL,
  valid_until             DATE,
  conversion_enabled      BOOLEAN       NOT NULL DEFAULT FALSE,
  care_fund_name          TEXT,
  care_fund_member_id     TEXT,
  md_assessment_date      DATE,
  notes                   TEXT,
  source                  TEXT          NOT NULL DEFAULT 'manual',
  metadata                JSONB         NOT NULL DEFAULT '{}'::jsonb,
  created_at              TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_client_care_entitlement_client
  ON public.client_care_entitlement (tenant_id, client_id, valid_from DESC);

-- --------------------------------------------------------------------------
-- client_service_entitlements — aktive Leistungs-Ansprüche je Klient:in
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.client_service_entitlements (
  id                      UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               UUID          NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  client_id               UUID          NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  service_type_id         UUID          REFERENCES public.tenant_client_service_types(id) ON DELETE SET NULL,
  service_type_key        TEXT,
  billing_mode            TEXT          NOT NULL DEFAULT 'cost_carrier',
  is_active               BOOLEAN       NOT NULL DEFAULT TRUE,
  valid_from              DATE          NOT NULL,
  valid_until             DATE,
  hourly_rate_cents       BIGINT,
  notes                   TEXT,
  metadata                JSONB         NOT NULL DEFAULT '{}'::jsonb,
  created_at              TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  CONSTRAINT client_service_entitlements_billing_mode_check
    CHECK (billing_mode IN ('cost_carrier', 'self_payer', 'kulanz', 'unclear', 'mixed'))
);

CREATE INDEX IF NOT EXISTS idx_client_service_entitlements_client
  ON public.client_service_entitlements (tenant_id, client_id, is_active, valid_from DESC);

-- --------------------------------------------------------------------------
-- client_budget_accounts — Budgetkonten (monatlich/jährlich, individuelle Overrides)
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.client_budget_accounts (
  id                      UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               UUID          NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  client_id               UUID          NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  catalog_template_id     UUID          REFERENCES public.budget_template_catalog(id) ON DELETE RESTRICT,
  catalog_key             TEXT          NOT NULL,
  catalog_year            INT           NOT NULL,
  period                  TEXT          NOT NULL,
  period_start            DATE          NOT NULL,
  period_end              DATE          NOT NULL,
  allocated_cents         BIGINT        NOT NULL DEFAULT 0,
  used_cents              BIGINT        NOT NULL DEFAULT 0,
  reserved_cents          BIGINT        NOT NULL DEFAULT 0,
  is_individual_override  BOOLEAN       NOT NULL DEFAULT FALSE,
  individual_amount_cents BIGINT,
  catalog_snapshot        JSONB         NOT NULL DEFAULT '{}'::jsonb,
  billing_priority        INT           NOT NULL DEFAULT 99,
  status                  TEXT          NOT NULL DEFAULT 'active',
  notes                   TEXT,
  metadata                JSONB         NOT NULL DEFAULT '{}'::jsonb,
  created_at              TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  CONSTRAINT client_budget_accounts_period_check
    CHECK (period IN ('monthly', 'yearly', 'quarterly')),
  CONSTRAINT client_budget_accounts_status_check
    CHECK (status IN ('active', 'closed', 'suspended'))
);

CREATE INDEX IF NOT EXISTS idx_client_budget_accounts_client
  ON public.client_budget_accounts (tenant_id, client_id, catalog_year, period_start DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_client_budget_accounts_period_unique
  ON public.client_budget_accounts (tenant_id, client_id, catalog_key, period_start, period_end)
  WHERE status = 'active';

-- --------------------------------------------------------------------------
-- client_billing_priority_rules — Abrechnungs-Priorität je Klient:in
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.client_billing_priority_rules (
  id                      UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               UUID          NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  client_id               UUID          REFERENCES public.clients(id) ON DELETE CASCADE,
  catalog_key             TEXT          NOT NULL,
  priority_order          INT           NOT NULL,
  is_active               BOOLEAN       NOT NULL DEFAULT TRUE,
  notes                   TEXT,
  created_at              TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  CONSTRAINT client_billing_priority_rules_scope_check
    CHECK (client_id IS NOT NULL OR TRUE)
);

CREATE INDEX IF NOT EXISTS idx_client_billing_priority_rules_client
  ON public.client_billing_priority_rules (tenant_id, client_id, priority_order);

CREATE UNIQUE INDEX IF NOT EXISTS idx_client_billing_priority_rules_tenant_default
  ON public.client_billing_priority_rules (tenant_id, catalog_key)
  WHERE client_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_client_billing_priority_rules_client_key
  ON public.client_billing_priority_rules (tenant_id, client_id, catalog_key)
  WHERE client_id IS NOT NULL;

-- --------------------------------------------------------------------------
-- client_budget_transactions — Budgetverlauf / Ledger
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.client_budget_transactions (
  id                      UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               UUID          NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  client_id               UUID          NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  budget_account_id       UUID          NOT NULL REFERENCES public.client_budget_accounts(id) ON DELETE CASCADE,
  transaction_type        TEXT          NOT NULL,
  amount_cents            BIGINT        NOT NULL,
  balance_after_cents     BIGINT,
  reference_type          TEXT,
  reference_id            UUID,
  note                    TEXT,
  created_by              UUID          REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at              TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  CONSTRAINT client_budget_transactions_type_check
    CHECK (transaction_type IN ('allocation', 'usage', 'reservation', 'release', 'adjustment', 'reversal'))
);

CREATE INDEX IF NOT EXISTS idx_client_budget_transactions_account
  ON public.client_budget_transactions (tenant_id, budget_account_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_client_budget_transactions_client
  ON public.client_budget_transactions (tenant_id, client_id, created_at DESC);

-- --------------------------------------------------------------------------
-- client_billing_warnings — automatische Warnungen & Klärungsbedarf
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.client_billing_warnings (
  id                      UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               UUID          NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  client_id               UUID          NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  warning_type            TEXT          NOT NULL,
  severity                TEXT          NOT NULL DEFAULT 'info',
  catalog_key             TEXT,
  budget_account_id       UUID          REFERENCES public.client_budget_accounts(id) ON DELETE SET NULL,
  message                 TEXT          NOT NULL,
  is_resolved             BOOLEAN       NOT NULL DEFAULT FALSE,
  resolved_at             TIMESTAMPTZ,
  resolved_by             UUID          REFERENCES public.profiles(id) ON DELETE SET NULL,
  metadata                JSONB         NOT NULL DEFAULT '{}'::jsonb,
  created_at              TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  CONSTRAINT client_billing_warnings_severity_check
    CHECK (severity IN ('info', 'warning', 'critical'))
);

CREATE INDEX IF NOT EXISTS idx_client_billing_warnings_client
  ON public.client_billing_warnings (tenant_id, client_id, is_resolved, created_at DESC);

-- --------------------------------------------------------------------------
-- client_billing_audit_log — Änderungsprotokoll
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.client_billing_audit_log (
  id                      UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               UUID          NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  client_id               UUID          NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  action                  TEXT          NOT NULL,
  entity_type             TEXT          NOT NULL,
  entity_id               UUID,
  payload                 JSONB         NOT NULL DEFAULT '{}'::jsonb,
  actor_id                UUID          REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at              TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_client_billing_audit_log_client
  ON public.client_billing_audit_log (tenant_id, client_id, created_at DESC);

-- --------------------------------------------------------------------------
-- updated_at triggers
-- --------------------------------------------------------------------------
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'budget_template_catalog',
    'client_care_entitlement',
    'client_service_entitlements',
    'client_budget_accounts',
    'client_billing_priority_rules',
    'client_billing_warnings'
  ]
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS set_%I_updated_at ON public.%I', tbl, tbl);
    EXECUTE format(
      'CREATE TRIGGER set_%I_updated_at BEFORE UPDATE ON public.%I
       FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()', tbl, tbl
    );
  END LOOP;
END $$;

-- --------------------------------------------------------------------------
-- RLS — office.clients pattern; catalog read-only for authenticated
-- --------------------------------------------------------------------------
ALTER TABLE public.budget_template_catalog ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS budget_template_catalog_select ON public.budget_template_catalog;
CREATE POLICY budget_template_catalog_select ON public.budget_template_catalog
  FOR SELECT TO authenticated USING (is_active = TRUE);

DROP POLICY IF EXISTS budget_template_catalog_admin ON public.budget_template_catalog;
CREATE POLICY budget_template_catalog_admin ON public.budget_template_catalog
  FOR ALL TO authenticated USING (
    public.has_permission('system.budget_templates.edit')
  ) WITH CHECK (
    public.has_permission('system.budget_templates.edit')
  );

DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'client_care_entitlement',
    'client_service_entitlements',
    'client_budget_accounts',
    'client_billing_priority_rules',
    'client_budget_transactions',
    'client_billing_warnings',
    'client_billing_audit_log'
  ]
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);

    EXECUTE format('DROP POLICY IF EXISTS "%s_select_tenant" ON public.%I', tbl, tbl);
    EXECUTE format(
      'CREATE POLICY "%s_select_tenant" ON public.%I FOR SELECT TO authenticated USING (
        tenant_id = public.current_tenant_id()
        AND (
          public.has_permission(''clients.billing_profile.view'')
          OR public.has_permission(''office.clients.view'')
        )
      )', tbl, tbl
    );

    EXECUTE format('DROP POLICY IF EXISTS "%s_write_tenant" ON public.%I', tbl, tbl);
    EXECUTE format(
      'CREATE POLICY "%s_write_tenant" ON public.%I FOR ALL TO authenticated USING (
        tenant_id = public.current_tenant_id()
        AND (
          public.has_permission(''clients.billing_profile.edit'')
          OR public.has_permission(''clients.budgets.edit'')
          OR public.has_permission(''office.clients.edit'')
        )
      ) WITH CHECK (
        tenant_id = public.current_tenant_id()
        AND (
          public.has_permission(''clients.billing_profile.edit'')
          OR public.has_permission(''clients.budgets.edit'')
          OR public.has_permission(''office.clients.edit'')
        )
      )', tbl, tbl
    );
  END LOOP;
END $$;

GRANT SELECT ON public.budget_template_catalog TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.budget_template_catalog TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON
  public.client_care_entitlement,
  public.client_service_entitlements,
  public.client_budget_accounts,
  public.client_billing_priority_rules,
  public.client_budget_transactions,
  public.client_billing_warnings,
  public.client_billing_audit_log
TO authenticated;

-- --------------------------------------------------------------------------
-- Seed 2026 budget templates (exact cent values per spec §3)
-- --------------------------------------------------------------------------
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
    'Jährlicher Umwandlungsanspruch Pflegegrad 2', 'yearly',
    31800, 'pg2', 'pg2', 2, TRUE, TRUE, TRUE,
    '{"legal_ref":"§45a SGB XI","conversion":true}'::jsonb
  ),
  (
    'umwandlung_pg3', 2026, 'Umwandlung Entlastungsbudget PG 3',
    'Jährlicher Umwandlungsanspruch Pflegegrad 3', 'yearly',
    59800, 'pg3', 'pg3', 2, TRUE, TRUE, TRUE,
    '{"legal_ref":"§45a SGB XI","conversion":true}'::jsonb
  ),
  (
    'umwandlung_pg4', 2026, 'Umwandlung Entlastungsbudget PG 4',
    'Jährlicher Umwandlungsanspruch Pflegegrad 4', 'yearly',
    74300, 'pg4', 'pg4', 2, TRUE, TRUE, TRUE,
    '{"legal_ref":"§45a SGB XI","conversion":true}'::jsonb
  ),
  (
    'umwandlung_pg5', 2026, 'Umwandlung Entlastungsbudget PG 5',
    'Jährlicher Umwandlungsanspruch Pflegegrad 5', 'yearly',
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
ON CONFLICT (catalog_key, budget_year) DO NOTHING;

-- Default priority rules (tenant-wide, client_id NULL) — spec §11
INSERT INTO public.client_billing_priority_rules (tenant_id, client_id, catalog_key, priority_order, notes)
SELECT t.id, NULL, p.catalog_key, p.priority_order, 'System-Default Priorität 2026'
FROM public.tenants t
CROSS JOIN (
  VALUES
    ('paragraph_45b', 1),
    ('umwandlung_pg2', 2),
    ('umwandlung_pg3', 2),
    ('umwandlung_pg4', 2),
    ('umwandlung_pg5', 2),
    ('verhinderungspflege', 3),
    ('kurzzeitpflege', 4),
    ('gemeinsames_jahresbudget', 5),
    ('selbstzahler', 90),
    ('kulanz', 91),
    ('ungeklaert', 99)
) AS p(catalog_key, priority_order)
WHERE NOT EXISTS (
  SELECT 1 FROM public.client_billing_priority_rules r
  WHERE r.tenant_id = t.id AND r.client_id IS NULL AND r.catalog_key = p.catalog_key
);

COMMENT ON TABLE public.client_budget_accounts IS
  'Klient:innen-Budgetkonten mit Katalog-Snapshot — individuelle Overrides bleiben erhalten (Migration 0175)';
