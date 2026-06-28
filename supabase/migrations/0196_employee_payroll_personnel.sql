-- ==========================================================================
-- CareSuite+ — Migration 0196: Employee payroll / Personalakte extensions
-- Lexware-style personnel data: contract, compensation, tax, social insurance.
-- ==========================================================================

-- --------------------------------------------------------------------------
-- 1. employees — personal data extensions
-- --------------------------------------------------------------------------
ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS salutation TEXT,
  ADD COLUMN IF NOT EXISTS academic_title TEXT,
  ADD COLUMN IF NOT EXISTS nationality TEXT DEFAULT 'DE',
  ADD COLUMN IF NOT EXISTS address_supplement TEXT;

COMMENT ON COLUMN public.employees.salutation IS 'Anrede: herr | frau | divers';
COMMENT ON COLUMN public.employees.academic_title IS 'Akademischer Titel (optional)';
COMMENT ON COLUMN public.employees.nationality IS 'Staatsangehörigkeit (ISO 3166-1 alpha-2)';
COMMENT ON COLUMN public.employees.address_supplement IS 'Adresszusatz';

-- --------------------------------------------------------------------------
-- 2. employee_contract_settings — Vertragsdaten & Urlaub
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.employee_contract_settings (
  id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  employee_id             UUID        NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  job_title_key           TEXT,
  education_degrees       JSONB       NOT NULL DEFAULT '[]'::jsonb,
  work_days               JSONB       NOT NULL DEFAULT '{"mon":0,"tue":0,"wed":0,"thu":0,"fri":0,"sat":0,"sun":0}'::jsonb,
  work_on_holidays        BOOLEAN     NOT NULL DEFAULT FALSE,
  annual_vacation_days    NUMERIC(4,1),
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, employee_id)
);

CREATE INDEX IF NOT EXISTS idx_employee_contract_settings_tenant_employee
  ON public.employee_contract_settings (tenant_id, employee_id);

-- --------------------------------------------------------------------------
-- 3. employee_payroll_settings — Vergütung & Bank
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.employee_payroll_settings (
  id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  employee_id             UUID        NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  compensation_type       TEXT        NOT NULL DEFAULT 'salary'
                          CHECK (compensation_type IN ('salary', 'hourly')),
  compensation_amount     NUMERIC(12,2),
  payout_interval         TEXT        NOT NULL DEFAULT 'monthly'
                          CHECK (payout_interval IN ('monthly', 'weekly', 'biweekly')),
  payout_method           TEXT        NOT NULL DEFAULT 'transfer'
                          CHECK (payout_method IN ('transfer', 'cash')),
  iban                    TEXT,
  bank_name               TEXT,
  account_holder          TEXT,
  alternate_account_holder TEXT,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, employee_id)
);

CREATE INDEX IF NOT EXISTS idx_employee_payroll_settings_tenant_employee
  ON public.employee_payroll_settings (tenant_id, employee_id);

-- --------------------------------------------------------------------------
-- 4. employee_tax_settings — Lohnsteuer
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.employee_tax_settings (
  id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  employee_id             UUID        NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  tax_calculation_type    TEXT,
  tax_id                  TEXT,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, employee_id)
);

CREATE INDEX IF NOT EXISTS idx_employee_tax_settings_tenant_employee
  ON public.employee_tax_settings (tenant_id, employee_id);

-- --------------------------------------------------------------------------
-- 5. employee_social_insurance — Sozialversicherung
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.employee_social_insurance (
  id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  employee_id             UUID        NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  insurance_type          TEXT        NOT NULL DEFAULT 'statutory'
                          CHECK (insurance_type IN ('statutory', 'private')),
  health_insurance_key    TEXT,
  pension_fund_registered BOOLEAN     NOT NULL DEFAULT FALSE,
  social_security_number  TEXT,
  employer_relationship   BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, employee_id)
);

CREATE INDEX IF NOT EXISTS idx_employee_social_insurance_tenant_employee
  ON public.employee_social_insurance (tenant_id, employee_id);

-- --------------------------------------------------------------------------
-- 6. employee_secondary_employments — Mehrfachbeschäftigung
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.employee_secondary_employments (
  id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  employee_id             UUID        NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  employer_name           TEXT        NOT NULL DEFAULT '',
  gross_monthly_income    NUMERIC(12,2),
  sort_order              INTEGER     NOT NULL DEFAULT 0,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_employee_secondary_employments_tenant_employee
  ON public.employee_secondary_employments (tenant_id, employee_id, sort_order);

-- --------------------------------------------------------------------------
-- updated_at triggers
-- --------------------------------------------------------------------------
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'employee_contract_settings',
    'employee_payroll_settings',
    'employee_tax_settings',
    'employee_social_insurance',
    'employee_secondary_employments'
  ]
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS set_%I_updated_at ON public.%I', tbl, tbl);
    EXECUTE format(
      'CREATE TRIGGER set_%I_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()',
      tbl, tbl
    );
  END LOOP;
END $$;

-- --------------------------------------------------------------------------
-- RLS
-- --------------------------------------------------------------------------
ALTER TABLE public.employee_contract_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_payroll_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_tax_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_social_insurance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_secondary_employments ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'employee_contract_settings',
    'employee_payroll_settings',
    'employee_tax_settings',
    'employee_social_insurance',
    'employee_secondary_employments'
  ]
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I_office ON public.%I', tbl, tbl);
    EXECUTE format(
      'CREATE POLICY %I_office ON public.%I FOR ALL TO authenticated
       USING (tenant_id = public.current_tenant_id() AND public.has_permission(''office.employees.view''))
       WITH CHECK (tenant_id = public.current_tenant_id() AND public.has_permission(''office.employees.edit''))',
      tbl, tbl
    );
  END LOOP;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.employee_contract_settings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.employee_payroll_settings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.employee_tax_settings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.employee_social_insurance TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.employee_secondary_employments TO authenticated;

-- --------------------------------------------------------------------------
-- System catalogs: Tätigkeit, Lohnsteuer-Art, Krankenkassen
-- --------------------------------------------------------------------------
INSERT INTO public.catalog_entries (tenant_id, catalog_type, value_key, label, description, module_key, is_system, sort_order)
SELECT NULL, v.catalog_type, v.value_key, v.label, v.description, 'office', TRUE, v.sort_order
FROM (VALUES
  ('employee_job_title', 'pflegefachkraft', 'Pflegefachkraft', 'Examinierte Pflegefachkraft', 1),
  ('employee_job_title', 'pflegehelfer', 'Pflegehelfer:in', 'Pflegehilfskraft', 2),
  ('employee_job_title', 'betreuungskraft', 'Betreuungskraft', '§ 45b Betreuungskraft', 3),
  ('employee_job_title', 'alltagsbegleiter', 'Alltagsbegleiter:in', 'Alltagsbegleitung', 4),
  ('employee_job_title', 'hauswirtschaft', 'Hauswirtschaftskraft', 'Haushalt und Versorgung', 5),
  ('employee_job_title', 'disponent', 'Disponent:in', 'Einsatzplanung', 6),
  ('employee_job_title', 'buerokraft', 'Bürokraft', 'Verwaltung', 7),
  ('employee_job_title', 'teamleitung', 'Teamleitung', 'Team- / Bereichsleitung', 8),
  ('employee_job_title', 'geschaeftsfuehrung', 'Geschäftsführung', 'Unternehmensleitung', 9),
  ('employee_job_title', 'praktikant', 'Praktikant:in', 'Praktikum', 10),
  ('employee_job_title', 'ausbildung', 'Auszubildende:r', 'Pflegeausbildung', 11)
) AS v(catalog_type, value_key, label, description, sort_order)
WHERE NOT EXISTS (
  SELECT 1 FROM public.catalog_entries e
  WHERE e.tenant_id IS NULL AND e.catalog_type = v.catalog_type AND e.value_key = v.value_key
);

INSERT INTO public.catalog_entries (tenant_id, catalog_type, value_key, label, description, module_key, is_system, sort_order)
SELECT NULL, v.catalog_type, v.value_key, v.label, v.description, 'office', TRUE, v.sort_order
FROM (VALUES
  ('employee_tax_calculation', 'lohnsteuer_tabelle', 'Lohnsteuer-Tabelle', 'Reguläre Lohnsteuerermittlung', 1),
  ('employee_tax_calculation', 'pauschsteuer_standard', 'Pauschsteuer Standard', 'Pauschsteuer nach Standardtarif', 2),
  ('employee_tax_calculation', 'pauschsteuer_minijob', 'Pauschsteuer Minijob', 'Pauschsteuer für Minijobber', 3),
  ('employee_tax_calculation', 'freiberufler', 'Freiberufler / Honorar', 'Keine Lohnsteuerabzüge', 4),
  ('employee_tax_calculation', 'steuerfrei', 'Steuerfrei', 'Steuerfreie Beschäftigung', 5)
) AS v(catalog_type, value_key, label, description, sort_order)
WHERE NOT EXISTS (
  SELECT 1 FROM public.catalog_entries e
  WHERE e.tenant_id IS NULL AND e.catalog_type = v.catalog_type AND e.value_key = v.value_key
);

INSERT INTO public.catalog_entries (tenant_id, catalog_type, value_key, label, description, module_key, is_system, sort_order)
SELECT NULL, v.catalog_type, v.value_key, v.label, v.description, 'office', TRUE, v.sort_order
FROM (VALUES
  ('employee_health_insurance', 'aok', 'AOK', 'Allgemeine Ortskrankenkasse', 1),
  ('employee_health_insurance', 'barmer', 'BARMER', 'BARMER Krankenkasse', 2),
  ('employee_health_insurance', 'tk', 'Techniker Krankenkasse', 'TK', 3),
  ('employee_health_insurance', 'dak', 'DAK-Gesundheit', 'DAK', 4),
  ('employee_health_insurance', 'ikk_classic', 'IKK classic', 'IKK classic', 5),
  ('employee_health_insurance', 'hkk', 'hkk Krankenkasse', 'hkk', 6),
  ('employee_health_insurance', 'kkh', 'KKH Kaufmännische Krankenkasse', 'KKH', 7),
  ('employee_health_insurance', 'sbk', 'SBK Siemens-Betriebskrankenkasse', 'SBK', 8),
  ('employee_health_insurance', 'bkk_vbu', 'BKK VBU', 'BKK Verkehrsbau Union', 9),
  ('employee_health_insurance', 'private', 'Private Krankenversicherung', 'PKV', 10),
  ('employee_health_insurance', 'sonstige', 'Sonstige Krankenkasse', 'Andere gesetzliche Kasse', 11)
) AS v(catalog_type, value_key, label, description, sort_order)
WHERE NOT EXISTS (
  SELECT 1 FROM public.catalog_entries e
  WHERE e.tenant_id IS NULL AND e.catalog_type = v.catalog_type AND e.value_key = v.value_key
);

COMMENT ON TABLE public.employee_contract_settings IS 'Personalakte — Vertragsdaten, Arbeitszeitverteilung, Urlaubsanspruch';
COMMENT ON TABLE public.employee_payroll_settings IS 'Personalakte — Vergütung und Bankverbindung';
COMMENT ON TABLE public.employee_tax_settings IS 'Personalakte — Lohnsteuer';
COMMENT ON TABLE public.employee_social_insurance IS 'Personalakte — Sozialversicherung';
COMMENT ON TABLE public.employee_secondary_employments IS 'Personalakte — Mehrfachbeschäftigung';
