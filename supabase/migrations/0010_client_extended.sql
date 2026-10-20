-- ==========================================================================
-- CareSuite+ — Migration 0010: Erweiterte Klient:innen-Akte
-- Voraussetzung: 0001–0009
-- Entspricht src/types/modules/client/
-- ==========================================================================

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS lifecycle_status TEXT NOT NULL DEFAULT 'aktiv'
    CHECK (lifecycle_status IN ('aktiv','pausiert','archiviert','verstorben','interessent')),
  ADD COLUMN IF NOT EXISTS salutation TEXT,
  ADD COLUMN IF NOT EXISTS gender TEXT
    CHECK (gender IS NULL OR gender IN ('weiblich','männlich','divers','keine_angabe')),
  ADD COLUMN IF NOT EXISTS insurance_number TEXT,
  ADD COLUMN IF NOT EXISTS key_safe_code TEXT,
  ADD COLUMN IF NOT EXISTS diagnoses JSONB NOT NULL DEFAULT '[]'::jsonb;

CREATE TABLE IF NOT EXISTS public.client_addresses (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  client_id       UUID        NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  address_type    TEXT        NOT NULL DEFAULT 'hauptwohnsitz'
                  CHECK (address_type IN ('hauptwohnsitz','pflegeheim','ferien','rechnung','sonstige')),
  street          TEXT        NOT NULL,
  zip             TEXT        NOT NULL,
  city            TEXT        NOT NULL,
  country         TEXT        NOT NULL DEFAULT 'DE',
  is_primary      BOOLEAN     NOT NULL DEFAULT FALSE,
  access_notes    TEXT,
  floor           TEXT,
  door_code       TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.client_care_levels (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  client_id           UUID        NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  grade               TEXT        NOT NULL
                      CHECK (grade IN ('kein','pg1','pg2','pg3','pg4','pg5','hospiz')),
  valid_from          DATE        NOT NULL,
  valid_until         DATE,
  care_fund_name      TEXT        NOT NULL,
  care_fund_member_id TEXT,
  md_assessment_date  DATE,
  notes               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.client_budgets (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  client_id           UUID        NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  budget_type         TEXT        NOT NULL
                      CHECK (budget_type IN ('paragraph_45b','paragraph_45a','verhinderungspflege','entlastungsbetrag')),
  year                INTEGER     NOT NULL,
  total_amount_cents  INTEGER     NOT NULL DEFAULT 0,
  used_amount_cents   INTEGER     NOT NULL DEFAULT 0,
  reserved_amount_cents INTEGER   NOT NULL DEFAULT 0,
  valid_from          DATE        NOT NULL,
  valid_until         DATE        NOT NULL,
  notes               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.client_billing_profiles (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  client_id             UUID        NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  billing_type          TEXT        NOT NULL
                        CHECK (billing_type IN ('selbstzahler','pflegekasse','beihilfe','kombi','sonstige')),
  hourly_rate_cents     INTEGER     NOT NULL DEFAULT 0,
  service_type          TEXT        NOT NULL DEFAULT 'betreuung'
                        CHECK (service_type IN ('sachleistung','verhinderungspflege','betreuung','haushalt','sonstige')),
  invoice_recipient     TEXT,
  payment_terms_days    INTEGER     NOT NULL DEFAULT 14,
  cost_bearer_name      TEXT,
  cost_bearer_reference TEXT,
  notes                 TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.client_contracts (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  client_id         UUID        NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  contract_number   TEXT        NOT NULL,
  contract_start    DATE        NOT NULL,
  contract_end      DATE,
  service_type      TEXT        NOT NULL DEFAULT 'betreuung',
  hourly_rate_cents INTEGER     NOT NULL DEFAULT 0,
  weekly_hours      NUMERIC(5,2),
  status            TEXT        NOT NULL DEFAULT 'aktiv',
  signed_at         TIMESTAMPTZ,
  document_id       UUID,
  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.client_contacts
  ADD COLUMN IF NOT EXISTS first_name TEXT,
  ADD COLUMN IF NOT EXISTS last_name TEXT,
  ADD COLUMN IF NOT EXISTS is_portal_user BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS portal_permissions JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE public.client_consents
  ADD COLUMN IF NOT EXISTS consent_type TEXT
    CHECK (consent_type IS NULL OR consent_type IN (
      'datenschutz','portal_zugang','portal_angehoerige','medizinische_daten',
      'tracking','foto_video','vertrag','kommunikation'
    )),
  ADD COLUMN IF NOT EXISTS granted_by_profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS document_id UUID,
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE TABLE IF NOT EXISTS public.client_documents (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  client_id       UUID        NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  title           TEXT        NOT NULL,
  file_name       TEXT        NOT NULL,
  mime_type       TEXT        NOT NULL DEFAULT 'application/pdf',
  category        TEXT        NOT NULL DEFAULT 'sonstige'
                  CHECK (category IN ('vertrag','pflegeplan','arztbrief','md_gutachten','einwilligung','sonstige')),
  storage_path    TEXT,
  status          TEXT        NOT NULL DEFAULT 'aktiv',
  sensitivity     TEXT        NOT NULL DEFAULT 'care'
                  CHECK (sensitivity IN ('public','internal','care','health','restricted')),
  uploaded_by     UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  valid_until       DATE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.client_notes (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  client_id       UUID        NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  content         TEXT        NOT NULL,
  is_internal     BOOLEAN     NOT NULL DEFAULT TRUE,
  category        TEXT        NOT NULL DEFAULT 'allgemein'
                  CHECK (category IN ('allgemein','einsatz','abrechnung','gesundheit','portal')),
  created_by      UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.client_risks (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  client_id       UUID        NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  category        TEXT        NOT NULL
                  CHECK (category IN ('sturz','dekubitus','ernaehrung','medikation','verhalten','sonstige')),
  level           TEXT        NOT NULL DEFAULT 'mittel'
                  CHECK (level IN ('niedrig','mittel','hoch','kritisch')),
  description     TEXT        NOT NULL,
  mitigation      TEXT,
  assessed_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  assessed_by     UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.client_preferences (
  id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  client_id               UUID        NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  preferred_shifts        TEXT[]      NOT NULL DEFAULT '{}',
  preferred_employee_ids  UUID[]      NOT NULL DEFAULT '{}',
  excluded_employee_ids   UUID[]      NOT NULL DEFAULT '{}',
  language                TEXT,
  mobility_notes          TEXT,
  household_notes         TEXT,
  pet_notes               TEXT,
  access_instructions     TEXT,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (client_id)
);

CREATE TABLE IF NOT EXISTS public.client_portal_access (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  client_id         UUID        NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  contact_id        UUID        REFERENCES public.client_contacts(id) ON DELETE SET NULL,
  email             TEXT        NOT NULL,
  status            TEXT        NOT NULL DEFAULT 'eingeladen'
                    CHECK (status IN ('aktiv','eingeladen','gesperrt','deaktiviert')),
  last_login_at     TIMESTAMPTZ,
  invited_at        TIMESTAMPTZ,
  modules_enabled   TEXT[]      NOT NULL DEFAULT '{}',
  two_factor_enabled BOOLEAN    NOT NULL DEFAULT FALSE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.client_tasks (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  client_id             UUID        NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  category              TEXT        NOT NULL
                        CHECK (category IN (
                          'haushalt','waesche','einkauf','koerperpflege','mobilisation',
                          'ernaehrung','medikation','begleitung','haushaltshilfe','sonstige'
                        )),
  title                 TEXT        NOT NULL,
  description           TEXT,
  frequency             TEXT        NOT NULL DEFAULT 'woechentlich'
                        CHECK (frequency IN ('taeglich','woechentlich','zweimal_wöchentlich','monatlich','bei_bedarf')),
  duration_minutes      INTEGER,
  is_active             BOOLEAN     NOT NULL DEFAULT TRUE,
  catalog_task_id       TEXT,
  assigned_employee_ids UUID[]      NOT NULL DEFAULT '{}',
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.client_timeline_events (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  client_id       UUID        NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  event_type      TEXT        NOT NULL
                  CHECK (event_type IN (
                    'status','einsatz','dokument','rechnung','einwilligung',
                    'notiz','pflegeplan','kontakt','portal','sonstige'
                  )),
  icon            TEXT        NOT NULL DEFAULT '📋',
  title           TEXT        NOT NULL,
  subtitle        TEXT,
  status          TEXT        NOT NULL DEFAULT 'aktiv',
  actor_name      TEXT,
  is_internal     BOOLEAN     NOT NULL DEFAULT FALSE,
  metadata        JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.care_plans (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  client_id       UUID        NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  title           TEXT        NOT NULL,
  status          TEXT        NOT NULL DEFAULT 'aktiv',
  valid_from      DATE        NOT NULL,
  valid_until     DATE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.care_reports (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  client_id       UUID        NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  care_plan_id    UUID        REFERENCES public.care_plans(id) ON DELETE SET NULL,
  report_date     DATE        NOT NULL,
  summary         TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.vital_signs (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  client_id       UUID        NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  recorded_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  blood_pressure  TEXT,
  heart_rate      INTEGER,
  temperature     NUMERIC(4,1),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.medications (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  client_id       UUID        NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  name            TEXT        NOT NULL,
  dosage          TEXT,
  frequency       TEXT,
  active          BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.wounds (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  client_id       UUID        NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  location        TEXT        NOT NULL,
  stage           TEXT,
  status          TEXT        NOT NULL DEFAULT 'aktiv',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.risk_assessments (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  client_id       UUID        NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  assessment_type TEXT        NOT NULL,
  score           INTEGER,
  assessed_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.medical_orders (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  client_id       UUID        NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  order_type      TEXT        NOT NULL,
  description     TEXT        NOT NULL,
  ordered_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status          TEXT        NOT NULL DEFAULT 'aktiv',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.service_records (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  client_id       UUID        NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  performed_at    TIMESTAMPTZ NOT NULL,
  duration_minutes INTEGER    NOT NULL,
  service_type    TEXT        NOT NULL,
  employee_id     UUID        REFERENCES public.employees(id) ON DELETE SET NULL,
  invoice_id      UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.budget_transactions (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  budget_id           UUID        NOT NULL REFERENCES public.client_budgets(id) ON DELETE CASCADE,
  service_record_id   UUID        REFERENCES public.service_records(id) ON DELETE SET NULL,
  invoice_id          UUID,
  amount_cents        INTEGER     NOT NULL,
  description         TEXT        NOT NULL,
  booked_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'client_addresses','client_care_levels','client_budgets','client_billing_profiles',
    'client_contracts','client_documents','client_notes','client_risks',
    'client_preferences','client_portal_access','client_tasks',
    'care_plans','medications','wounds'
  ]
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS set_%s_updated_at ON public.%I', t, t);
    EXECUTE format(
      'CREATE TRIGGER set_%s_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()',
      t, t
    );
  END LOOP;
END $$;

DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'client_addresses','client_care_levels','client_budgets','client_billing_profiles',
    'client_contracts','client_documents','client_notes','client_risks',
    'client_preferences','client_portal_access','client_tasks','client_timeline_events',
    'care_plans','care_reports','vital_signs','medications','wounds',
    'risk_assessments','medical_orders','service_records','budget_transactions'
  ]
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);

    EXECUTE format('DROP POLICY IF EXISTS "%s_select" ON public.%I', tbl, tbl);
    EXECUTE format(
      'CREATE POLICY "%s_select" ON public.%I FOR SELECT USING (
        tenant_id = public.current_tenant_id()
        AND public.has_permission(''office.clients.view'')
      )', tbl, tbl
    );

    EXECUTE format('DROP POLICY IF EXISTS "%s_write" ON public.%I', tbl, tbl);
    EXECUTE format(
      'CREATE POLICY "%s_write" ON public.%I FOR ALL USING (
        tenant_id = public.current_tenant_id()
        AND public.has_permission(''office.clients.edit'')
      ) WITH CHECK (
        tenant_id = public.current_tenant_id()
        AND public.has_permission(''office.clients.edit'')
      )', tbl, tbl
    );
  END LOOP;
END $$;

DROP POLICY IF EXISTS "client_contacts_write" ON public.client_contacts;
CREATE POLICY "client_contacts_write"
  ON public.client_contacts FOR ALL
  USING (
    tenant_id = public.current_tenant_id()
    AND (
      public.has_permission('office.clients.edit')
      OR public.has_permission('office.clients.manage_contacts')
    )
  )
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND (
      public.has_permission('office.clients.edit')
      OR public.has_permission('office.clients.manage_contacts')
    )
  );

DROP POLICY IF EXISTS "client_consents_write" ON public.client_consents;
CREATE POLICY "client_consents_write"
  ON public.client_consents FOR ALL
  USING (
    tenant_id = public.current_tenant_id()
    AND public.has_permission('office.clients.manage_consents')
  )
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND public.has_permission('office.clients.manage_consents')
  );

CREATE INDEX IF NOT EXISTS idx_client_addresses_client ON public.client_addresses(client_id);
CREATE INDEX IF NOT EXISTS idx_client_care_levels_client ON public.client_care_levels(client_id);
CREATE INDEX IF NOT EXISTS idx_client_budgets_client ON public.client_budgets(client_id);
CREATE INDEX IF NOT EXISTS idx_client_billing_profiles_client ON public.client_billing_profiles(client_id);
CREATE INDEX IF NOT EXISTS idx_client_contracts_client ON public.client_contracts(client_id);
CREATE INDEX IF NOT EXISTS idx_client_documents_client ON public.client_documents(client_id);
CREATE INDEX IF NOT EXISTS idx_client_notes_client ON public.client_notes(client_id);
CREATE INDEX IF NOT EXISTS idx_client_risks_client ON public.client_risks(client_id);
CREATE INDEX IF NOT EXISTS idx_client_tasks_client ON public.client_tasks(client_id);
CREATE INDEX IF NOT EXISTS idx_client_timeline_client ON public.client_timeline_events(client_id);
CREATE INDEX IF NOT EXISTS idx_client_portal_access_client ON public.client_portal_access(client_id);
CREATE INDEX IF NOT EXISTS idx_care_plans_client ON public.care_plans(client_id);
CREATE INDEX IF NOT EXISTS idx_service_records_client ON public.service_records(client_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON
  public.client_addresses,
  public.client_care_levels,
  public.client_budgets,
  public.client_billing_profiles,
  public.client_contracts,
  public.client_documents,
  public.client_notes,
  public.client_risks,
  public.client_preferences,
  public.client_portal_access,
  public.client_tasks,
  public.client_timeline_events,
  public.care_plans,
  public.care_reports,
  public.vital_signs,
  public.medications,
  public.wounds,
  public.risk_assessments,
  public.medical_orders,
  public.service_records,
  public.budget_transactions
TO authenticated;
