-- ==========================================================================
-- CareSuite+ — Migration 0009: Telematikinfrastruktur (TI-Modul)
-- Entspricht src/types/modules/ti/
-- RLS: tenant_id + has_permission() auf allen Tabellen
-- ==========================================================================

-- --------------------------------------------------------------------------
-- ti_providers
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ti_providers (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name              TEXT        NOT NULL,
  kind              TEXT        NOT NULL DEFAULT 'connector'
                    CHECK (kind IN ('kim', 'egk', 'epa', 'emp', 'erezept', 'connector')),
  connection_status TEXT        NOT NULL DEFAULT 'not_configured'
                    CHECK (connection_status IN (
                      'not_configured','provider_configured','provider_connected',
                      'ti_verified','kim_active','partially_available',
                      'blocked_missing_permission','blocked_missing_consent',
                      'provider_error','disabled'
                    )),
  secret_reference  TEXT,
  endpoint_url      TEXT,
  last_check_at     TIMESTAMPTZ,
  last_error        TEXT,
  is_active         BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- --------------------------------------------------------------------------
-- ti_provider_checks
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ti_provider_checks (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  provider_id UUID        NOT NULL REFERENCES public.ti_providers(id) ON DELETE CASCADE,
  status      TEXT        NOT NULL,
  message     TEXT,
  checked_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- --------------------------------------------------------------------------
-- kim_mailboxes
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.kim_mailboxes (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  address       TEXT        NOT NULL,
  display_name  TEXT        NOT NULL,
  provider_id   UUID        NOT NULL REFERENCES public.ti_providers(id) ON DELETE CASCADE,
  unread_count  INTEGER     NOT NULL DEFAULT 0,
  last_sync_at  TIMESTAMPTZ,
  sync_status   TEXT        NOT NULL DEFAULT 'idle'
                CHECK (sync_status IN ('idle', 'syncing', 'error')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- --------------------------------------------------------------------------
-- kim_messages
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.kim_messages (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  mailbox_id      UUID        NOT NULL REFERENCES public.kim_mailboxes(id) ON DELETE CASCADE,
  sender          TEXT        NOT NULL,
  sender_name     TEXT,
  subject         TEXT        NOT NULL,
  preview         TEXT        NOT NULL DEFAULT '',
  body            TEXT        NOT NULL DEFAULT '',
  status          TEXT        NOT NULL DEFAULT 'unread'
                  CHECK (status IN ('unread', 'read', 'archived', 'error')),
  received_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  has_attachments BOOLEAN     NOT NULL DEFAULT FALSE,
  is_medical      BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- --------------------------------------------------------------------------
-- kim_attachments
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.kim_attachments (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id            UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  message_id           UUID        NOT NULL REFERENCES public.kim_messages(id) ON DELETE CASCADE,
  file_name            TEXT        NOT NULL,
  mime_type            TEXT        NOT NULL DEFAULT 'application/pdf',
  size_bytes           BIGINT      NOT NULL DEFAULT 0,
  import_status        TEXT        NOT NULL DEFAULT 'pending'
                       CHECK (import_status IN ('pending', 'confirmed', 'imported', 'rejected')),
  suggested_assignment TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- --------------------------------------------------------------------------
-- ti_document_assignments
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ti_document_assignments (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  source_message_id     UUID        REFERENCES public.kim_messages(id) ON DELETE SET NULL,
  source_attachment_id  UUID        REFERENCES public.kim_attachments(id) ON DELETE SET NULL,
  client_id             UUID        REFERENCES public.clients(id) ON DELETE SET NULL,
  document_type         TEXT        NOT NULL,
  status                TEXT        NOT NULL DEFAULT 'suggested'
                        CHECK (status IN ('suggested', 'confirmed', 'assigned', 'rejected')),
  confirmed_by          TEXT,
  confirmed_at          TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- --------------------------------------------------------------------------
-- egk_insurance_data_drafts
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.egk_insurance_data_drafts (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  client_id        UUID        REFERENCES public.clients(id) ON DELETE SET NULL,
  insurance_number TEXT,
  insurer_name     TEXT,
  valid_from       TIMESTAMPTZ,
  valid_to         TIMESTAMPTZ,
  raw_data_ref     TEXT,
  status           TEXT        NOT NULL DEFAULT 'draft'
                   CHECK (status IN ('draft', 'verified', 'expired')),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- --------------------------------------------------------------------------
-- epa_connections
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.epa_connections (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id          UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  client_id          UUID        REFERENCES public.clients(id) ON DELETE SET NULL,
  epa_id             TEXT,
  connection_status  TEXT        NOT NULL DEFAULT 'not_configured',
  last_access_at     TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- --------------------------------------------------------------------------
-- emp_medication_plans
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.emp_medication_plans (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  client_id    UUID        REFERENCES public.clients(id) ON DELETE SET NULL,
  plan_version TEXT        NOT NULL DEFAULT '1.0',
  valid_from   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  valid_to     TIMESTAMPTZ,
  status       TEXT        NOT NULL DEFAULT 'draft'
               CHECK (status IN ('draft', 'active', 'superseded')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- --------------------------------------------------------------------------
-- emp_medication_items
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.emp_medication_items (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  plan_id    UUID        NOT NULL REFERENCES public.emp_medication_plans(id) ON DELETE CASCADE,
  substance  TEXT        NOT NULL,
  dosage     TEXT        NOT NULL,
  frequency  TEXT        NOT NULL,
  pzn        TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- --------------------------------------------------------------------------
-- erezept_items
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.erezept_items (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  client_id       UUID        REFERENCES public.clients(id) ON DELETE SET NULL,
  prescription_id TEXT        NOT NULL,
  medication      TEXT        NOT NULL,
  status          TEXT        NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'dispensed', 'cancelled')),
  issued_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- --------------------------------------------------------------------------
-- ti_consents
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ti_consents (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  scope       TEXT        NOT NULL
              CHECK (scope IN ('kim', 'egk', 'epa', 'emp', 'erezept', 'ti_general')),
  status      TEXT        NOT NULL DEFAULT 'pending'
              CHECK (status IN ('pending', 'granted', 'revoked', 'expired')),
  version     INTEGER     NOT NULL DEFAULT 1,
  granted_at  TIMESTAMPTZ,
  revoked_at  TIMESTAMPTZ,
  expires_at  TIMESTAMPTZ,
  granted_by  TEXT,
  legal_basis TEXT        NOT NULL DEFAULT 'Art. 9 Abs. 2 lit. h DSGVO',
  description TEXT        NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- --------------------------------------------------------------------------
-- ti_audit_events
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ti_audit_events (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  action        TEXT        NOT NULL,
  actor_id      UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  actor_name    TEXT        NOT NULL,
  resource_type TEXT        NOT NULL,
  resource_id   UUID,
  details       TEXT,
  ip_address    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- --------------------------------------------------------------------------
-- ti_permissions (Mandanten-TI-Freigaben, ergänzt App-Rollen)
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ti_permissions (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  profile_id      UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  permission_key  TEXT        NOT NULL,
  granted         BOOLEAN     NOT NULL DEFAULT TRUE,
  granted_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  granted_by      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, profile_id, permission_key)
);

-- --------------------------------------------------------------------------
-- updated_at triggers
-- --------------------------------------------------------------------------
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'ti_providers', 'ti_provider_checks', 'kim_mailboxes', 'kim_messages',
    'kim_attachments', 'ti_document_assignments', 'egk_insurance_data_drafts',
    'epa_connections', 'emp_medication_plans', 'emp_medication_items',
    'erezept_items', 'ti_consents', 'ti_audit_events', 'ti_permissions'
  ] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS set_%I_updated_at ON public.%I', tbl, tbl);
    EXECUTE format(
      'CREATE TRIGGER set_%I_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()',
      tbl, tbl
    );
  END LOOP;
END $$;

-- --------------------------------------------------------------------------
-- RLS aktivieren
-- --------------------------------------------------------------------------
ALTER TABLE public.ti_providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ti_provider_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kim_mailboxes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kim_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kim_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ti_document_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.egk_insurance_data_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.epa_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.emp_medication_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.emp_medication_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.erezept_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ti_consents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ti_audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ti_permissions ENABLE ROW LEVEL SECURITY;

-- --------------------------------------------------------------------------
-- RLS Policies — ti_providers
-- --------------------------------------------------------------------------
DROP POLICY IF EXISTS "ti_providers_select" ON public.ti_providers;
CREATE POLICY "ti_providers_select"
  ON public.ti_providers FOR SELECT
  USING (tenant_id = public.current_tenant_id() AND public.has_permission('ti.view'));

DROP POLICY IF EXISTS "ti_providers_write" ON public.ti_providers;
CREATE POLICY "ti_providers_write"
  ON public.ti_providers FOR ALL
  USING (tenant_id = public.current_tenant_id() AND public.has_permission('ti.provider.manage'))
  WITH CHECK (tenant_id = public.current_tenant_id() AND public.has_permission('ti.provider.manage'));

-- ti_provider_checks
DROP POLICY IF EXISTS "ti_provider_checks_select" ON public.ti_provider_checks;
CREATE POLICY "ti_provider_checks_select"
  ON public.ti_provider_checks FOR SELECT
  USING (tenant_id = public.current_tenant_id() AND public.has_permission('ti.view'));

DROP POLICY IF EXISTS "ti_provider_checks_insert" ON public.ti_provider_checks;
CREATE POLICY "ti_provider_checks_insert"
  ON public.ti_provider_checks FOR INSERT
  WITH CHECK (tenant_id = public.current_tenant_id() AND public.has_permission('ti.provider.manage'));

-- kim_mailboxes
DROP POLICY IF EXISTS "kim_mailboxes_select" ON public.kim_mailboxes;
CREATE POLICY "kim_mailboxes_select"
  ON public.kim_mailboxes FOR SELECT
  USING (tenant_id = public.current_tenant_id() AND public.has_permission('ti.kim.view'));

DROP POLICY IF EXISTS "kim_mailboxes_write" ON public.kim_mailboxes;
CREATE POLICY "kim_mailboxes_write"
  ON public.kim_mailboxes FOR ALL
  USING (tenant_id = public.current_tenant_id() AND public.has_permission('ti.kim.manage'))
  WITH CHECK (tenant_id = public.current_tenant_id() AND public.has_permission('ti.kim.manage'));

-- kim_messages
DROP POLICY IF EXISTS "kim_messages_select" ON public.kim_messages;
CREATE POLICY "kim_messages_select"
  ON public.kim_messages FOR SELECT
  USING (tenant_id = public.current_tenant_id() AND public.has_permission('ti.kim.view'));

DROP POLICY IF EXISTS "kim_messages_write" ON public.kim_messages;
CREATE POLICY "kim_messages_write"
  ON public.kim_messages FOR ALL
  USING (tenant_id = public.current_tenant_id() AND public.has_permission('ti.kim.manage'))
  WITH CHECK (tenant_id = public.current_tenant_id() AND public.has_permission('ti.kim.manage'));

-- kim_attachments
DROP POLICY IF EXISTS "kim_attachments_select" ON public.kim_attachments;
CREATE POLICY "kim_attachments_select"
  ON public.kim_attachments FOR SELECT
  USING (tenant_id = public.current_tenant_id() AND public.has_permission('ti.kim.view'));

DROP POLICY IF EXISTS "kim_attachments_write" ON public.kim_attachments;
CREATE POLICY "kim_attachments_write"
  ON public.kim_attachments FOR ALL
  USING (tenant_id = public.current_tenant_id() AND public.has_permission('ti.kim.manage'))
  WITH CHECK (tenant_id = public.current_tenant_id() AND public.has_permission('ti.kim.manage'));

-- ti_document_assignments
DROP POLICY IF EXISTS "ti_document_assignments_select" ON public.ti_document_assignments;
CREATE POLICY "ti_document_assignments_select"
  ON public.ti_document_assignments FOR SELECT
  USING (tenant_id = public.current_tenant_id() AND public.has_permission('ti.kim.view'));

DROP POLICY IF EXISTS "ti_document_assignments_write" ON public.ti_document_assignments;
CREATE POLICY "ti_document_assignments_write"
  ON public.ti_document_assignments FOR ALL
  USING (tenant_id = public.current_tenant_id() AND public.has_permission('ti.kim.manage'))
  WITH CHECK (tenant_id = public.current_tenant_id() AND public.has_permission('ti.kim.manage'));

-- egk_insurance_data_drafts
DROP POLICY IF EXISTS "egk_drafts_select" ON public.egk_insurance_data_drafts;
CREATE POLICY "egk_drafts_select"
  ON public.egk_insurance_data_drafts FOR SELECT
  USING (tenant_id = public.current_tenant_id() AND public.has_permission('ti.egk.view'));

DROP POLICY IF EXISTS "egk_drafts_write" ON public.egk_insurance_data_drafts;
CREATE POLICY "egk_drafts_write"
  ON public.egk_insurance_data_drafts FOR ALL
  USING (tenant_id = public.current_tenant_id() AND public.has_permission('ti.admin'))
  WITH CHECK (tenant_id = public.current_tenant_id() AND public.has_permission('ti.admin'));

-- epa_connections
DROP POLICY IF EXISTS "epa_connections_select" ON public.epa_connections;
CREATE POLICY "epa_connections_select"
  ON public.epa_connections FOR SELECT
  USING (tenant_id = public.current_tenant_id() AND public.has_permission('ti.epa.view'));

DROP POLICY IF EXISTS "epa_connections_write" ON public.epa_connections;
CREATE POLICY "epa_connections_write"
  ON public.epa_connections FOR ALL
  USING (tenant_id = public.current_tenant_id() AND public.has_permission('ti.admin'))
  WITH CHECK (tenant_id = public.current_tenant_id() AND public.has_permission('ti.admin'));

-- emp_medication_plans + items
DROP POLICY IF EXISTS "emp_plans_select" ON public.emp_medication_plans;
CREATE POLICY "emp_plans_select"
  ON public.emp_medication_plans FOR SELECT
  USING (tenant_id = public.current_tenant_id() AND public.has_permission('ti.emp.view'));

DROP POLICY IF EXISTS "emp_plans_write" ON public.emp_medication_plans;
CREATE POLICY "emp_plans_write"
  ON public.emp_medication_plans FOR ALL
  USING (tenant_id = public.current_tenant_id() AND public.has_permission('ti.admin'))
  WITH CHECK (tenant_id = public.current_tenant_id() AND public.has_permission('ti.admin'));

DROP POLICY IF EXISTS "emp_items_select" ON public.emp_medication_items;
CREATE POLICY "emp_items_select"
  ON public.emp_medication_items FOR SELECT
  USING (tenant_id = public.current_tenant_id() AND public.has_permission('ti.emp.view'));

DROP POLICY IF EXISTS "emp_items_write" ON public.emp_medication_items;
CREATE POLICY "emp_items_write"
  ON public.emp_medication_items FOR ALL
  USING (tenant_id = public.current_tenant_id() AND public.has_permission('ti.admin'))
  WITH CHECK (tenant_id = public.current_tenant_id() AND public.has_permission('ti.admin'));

-- erezept_items
DROP POLICY IF EXISTS "erezept_items_select" ON public.erezept_items;
CREATE POLICY "erezept_items_select"
  ON public.erezept_items FOR SELECT
  USING (tenant_id = public.current_tenant_id() AND public.has_permission('ti.erezept.view'));

DROP POLICY IF EXISTS "erezept_items_write" ON public.erezept_items;
CREATE POLICY "erezept_items_write"
  ON public.erezept_items FOR ALL
  USING (tenant_id = public.current_tenant_id() AND public.has_permission('ti.admin'))
  WITH CHECK (tenant_id = public.current_tenant_id() AND public.has_permission('ti.admin'));

-- ti_consents
DROP POLICY IF EXISTS "ti_consents_select" ON public.ti_consents;
CREATE POLICY "ti_consents_select"
  ON public.ti_consents FOR SELECT
  USING (tenant_id = public.current_tenant_id() AND public.has_permission('ti.view'));

DROP POLICY IF EXISTS "ti_consents_write" ON public.ti_consents;
CREATE POLICY "ti_consents_write"
  ON public.ti_consents FOR ALL
  USING (tenant_id = public.current_tenant_id() AND public.has_permission('ti.consent.manage'))
  WITH CHECK (tenant_id = public.current_tenant_id() AND public.has_permission('ti.consent.manage'));

-- ti_audit_events (append-only für normale Nutzer)
DROP POLICY IF EXISTS "ti_audit_events_select" ON public.ti_audit_events;
CREATE POLICY "ti_audit_events_select"
  ON public.ti_audit_events FOR SELECT
  USING (tenant_id = public.current_tenant_id() AND public.has_permission('ti.audit.view'));

DROP POLICY IF EXISTS "ti_audit_events_insert" ON public.ti_audit_events;
CREATE POLICY "ti_audit_events_insert"
  ON public.ti_audit_events FOR INSERT
  WITH CHECK (tenant_id = public.current_tenant_id());

-- ti_permissions
DROP POLICY IF EXISTS "ti_permissions_select" ON public.ti_permissions;
CREATE POLICY "ti_permissions_select"
  ON public.ti_permissions FOR SELECT
  USING (tenant_id = public.current_tenant_id() AND public.has_permission('ti.admin'));

DROP POLICY IF EXISTS "ti_permissions_write" ON public.ti_permissions;
CREATE POLICY "ti_permissions_write"
  ON public.ti_permissions FOR ALL
  USING (tenant_id = public.current_tenant_id() AND public.has_permission('ti.admin'))
  WITH CHECK (tenant_id = public.current_tenant_id() AND public.has_permission('ti.admin'));

-- --------------------------------------------------------------------------
-- GRANTs
-- --------------------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE ON public.ti_providers TO authenticated;
GRANT SELECT, INSERT ON public.ti_provider_checks TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.kim_mailboxes TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.kim_messages TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.kim_attachments TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.ti_document_assignments TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.egk_insurance_data_drafts TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.epa_connections TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.emp_medication_plans TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.emp_medication_items TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.erezept_items TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.ti_consents TO authenticated;
GRANT SELECT, INSERT ON public.ti_audit_events TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.ti_permissions TO authenticated;

-- --------------------------------------------------------------------------
-- Indizes
-- --------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_ti_providers_tenant ON public.ti_providers(tenant_id, kind);
CREATE INDEX IF NOT EXISTS idx_kim_messages_tenant ON public.kim_messages(tenant_id, status, received_at DESC);
CREATE INDEX IF NOT EXISTS idx_kim_messages_mailbox ON public.kim_messages(mailbox_id, received_at DESC);
CREATE INDEX IF NOT EXISTS idx_kim_attachments_message ON public.kim_attachments(message_id);
CREATE INDEX IF NOT EXISTS idx_ti_consents_tenant ON public.ti_consents(tenant_id, scope, status);
CREATE INDEX IF NOT EXISTS idx_ti_audit_events_tenant ON public.ti_audit_events(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ti_permissions_profile ON public.ti_permissions(tenant_id, profile_id);
