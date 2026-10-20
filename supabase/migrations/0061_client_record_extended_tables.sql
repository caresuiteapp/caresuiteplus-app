-- Klient:innenakte page load: remote missing extended client tables (0010/0003 never applied).
-- PostgREST returns 404 for unknown relations → app shows "Datenbankfehler".
-- Pattern: 0010_client_extended.sql + 0003_office_clients.sql child tables + 0060 GRANT idempotency.

-- --------------------------------------------------------------------------
-- 0003 child tables (missing on remote production)
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.client_consents (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  client_id   UUID        NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  title       TEXT        NOT NULL,
  scope       TEXT        NOT NULL CHECK (scope IN ('own','shared','team','tenant_admin')),
  granted     BOOLEAN     NOT NULL DEFAULT FALSE,
  granted_at  TIMESTAMPTZ,
  expires_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.client_audit_entries (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  client_id   UUID        NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  action      TEXT        NOT NULL,
  actor_name  TEXT        NOT NULL,
  details     TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.client_history_entries (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  client_id   UUID        NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  icon        TEXT        NOT NULL DEFAULT '📋',
  title       TEXT        NOT NULL,
  subtitle    TEXT,
  status      TEXT        NOT NULL
              CHECK (status IN (
                'entwurf','aktiv','in_bearbeitung','abgeschlossen',
                'archiviert','fehlerhaft','gesperrt'
              )),
  actor_name  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Extended columns on existing tables (no-op if already present)
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

ALTER TABLE public.client_contacts
  ADD COLUMN IF NOT EXISTS first_name TEXT,
  ADD COLUMN IF NOT EXISTS last_name TEXT,
  ADD COLUMN IF NOT EXISTS is_portal_user BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS portal_permissions JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- --------------------------------------------------------------------------
-- 0010 extended client record tables
-- --------------------------------------------------------------------------
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
  valid_until     DATE,
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

-- --------------------------------------------------------------------------
-- RLS + permission policies (tenant + office.clients.view / edit)
-- --------------------------------------------------------------------------
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'client_consents','client_audit_entries','client_history_entries',
    'client_addresses','client_care_levels','client_billing_profiles',
    'client_contracts','client_documents','client_notes','client_risks',
    'client_portal_access','client_tasks','client_timeline_events'
  ]
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);

    EXECUTE format('DROP POLICY IF EXISTS "%s_select_tenant" ON public.%I', tbl, tbl);
    EXECUTE format(
      'CREATE POLICY "%s_select_tenant" ON public.%I FOR SELECT TO authenticated USING (
        tenant_id = public.current_tenant_id()
        AND public.has_permission(''office.clients.view'')
      )', tbl, tbl
    );

    EXECUTE format('DROP POLICY IF EXISTS "%s_write_tenant" ON public.%I', tbl, tbl);
    EXECUTE format(
      'CREATE POLICY "%s_write_tenant" ON public.%I FOR ALL TO authenticated USING (
        tenant_id = public.current_tenant_id()
        AND public.has_permission(''office.clients.edit'')
      ) WITH CHECK (
        tenant_id = public.current_tenant_id()
        AND public.has_permission(''office.clients.edit'')
      )', tbl, tbl
    );
  END LOOP;
END $$;

-- Audit/history: allow insert without edit permission (status change RPC pattern)
DROP POLICY IF EXISTS "client_audit_entries_insert_tenant" ON public.client_audit_entries;
CREATE POLICY "client_audit_entries_insert_tenant"
  ON public.client_audit_entries FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS "client_history_entries_insert_tenant" ON public.client_history_entries;
CREATE POLICY "client_history_entries_insert_tenant"
  ON public.client_history_entries FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.current_tenant_id());

-- clients: permission-based SELECT (coexists with clients_select_own_tenant — OR semantics)
DROP POLICY IF EXISTS "clients_select_tenant" ON public.clients;
CREATE POLICY "clients_select_tenant"
  ON public.clients FOR SELECT TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND public.has_permission('office.clients.view')
  );

-- --------------------------------------------------------------------------
-- Indexes
-- --------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_client_consents_client ON public.client_consents(client_id);
CREATE INDEX IF NOT EXISTS idx_client_audit_client ON public.client_audit_entries(client_id);
CREATE INDEX IF NOT EXISTS idx_client_history_client ON public.client_history_entries(client_id);
CREATE INDEX IF NOT EXISTS idx_client_addresses_client ON public.client_addresses(client_id);
CREATE INDEX IF NOT EXISTS idx_client_care_levels_client ON public.client_care_levels(client_id);
CREATE INDEX IF NOT EXISTS idx_client_billing_profiles_client ON public.client_billing_profiles(client_id);
CREATE INDEX IF NOT EXISTS idx_client_contracts_client ON public.client_contracts(client_id);
CREATE INDEX IF NOT EXISTS idx_client_documents_client ON public.client_documents(client_id);
CREATE INDEX IF NOT EXISTS idx_client_notes_client ON public.client_notes(client_id);
CREATE INDEX IF NOT EXISTS idx_client_risks_client ON public.client_risks(client_id);
CREATE INDEX IF NOT EXISTS idx_client_tasks_client ON public.client_tasks(client_id);
CREATE INDEX IF NOT EXISTS idx_client_timeline_client ON public.client_timeline_events(client_id);
CREATE INDEX IF NOT EXISTS idx_client_portal_access_client ON public.client_portal_access(client_id);

-- --------------------------------------------------------------------------
-- GRANTs (policies alone insufficient — see 0057/0060)
-- --------------------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE, DELETE ON
  public.client_consents,
  public.client_addresses,
  public.client_care_levels,
  public.client_billing_profiles,
  public.client_contracts,
  public.client_documents,
  public.client_notes,
  public.client_risks,
  public.client_portal_access,
  public.client_tasks
TO authenticated;

GRANT SELECT, INSERT ON
  public.client_audit_entries,
  public.client_history_entries,
  public.client_timeline_events
TO authenticated;

GRANT SELECT ON public.clients TO authenticated;
