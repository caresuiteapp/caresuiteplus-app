-- ==========================================================================
-- CareSuite+ — Migration 0045: Connect API-/Connector-Zentrale
-- Mandantenfähiges Datenmodell für Anbieter, Integrationen, Credentials,
-- Datenfreigaben, Sync-Jobs, Webhooks und Audit.
--
-- Hinweis zu Bestandstabellen (NICHT dupliziert):
--   integration_providers (0007) — Legacy mandantenspezifisch, bleibt unverändert
--   ti_providers (0009) — TI-Domain, bleibt separat
--
-- Keine API-Keys, keine Secrets im Klartext. Keine destruktiven Befehle.
-- ==========================================================================

-- --------------------------------------------------------------------------
-- Hilfsfunktionen (RLS)
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_connect_tenant_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.current_role_key() IN ('business_admin', 'business_manager')
$$;

CREATE OR REPLACE FUNCTION public.is_connect_platform_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.current_role_key() = 'business_admin'
$$;

GRANT EXECUTE ON FUNCTION public.is_connect_tenant_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_connect_platform_admin() TO authenticated;

-- --------------------------------------------------------------------------
-- 1. connect_providers — globale Anbieter-Stammdaten (kein tenant_id)
-- provider.status = Katalog-/Anbieter-Reifegrad (≠ Feature-Status)
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.connect_providers (
  id                              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_key                    TEXT        NOT NULL,
  name                            TEXT        NOT NULL,
  category                        TEXT        NOT NULL
    CHECK (category IN (
      'billing', 'accounting', 'ti_kim', 'payments', 'communication_channels',
      'routes_gps', 'documents_signatures', 'medical_data', 'hr_payroll',
      'academy_integrations', 'marketplace', 'other'
    )),
  description                     TEXT        NOT NULL DEFAULT '',
  logo_url                        TEXT,
  website_url                     TEXT,
  provider_type                   TEXT        NOT NULL DEFAULT 'other'
    CHECK (provider_type IN (
      'billing', 'accounting', 'ti', 'payment', 'communication', 'maps',
      'documents', 'medical_data', 'hr', 'academy', 'marketplace', 'other'
    )),
  status                          TEXT        NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'preview', 'active', 'deprecated', 'disabled')),
  supports_sandbox                BOOLEAN     NOT NULL DEFAULT TRUE,
  supports_production             BOOLEAN     NOT NULL DEFAULT FALSE,
  requires_contract               BOOLEAN     NOT NULL DEFAULT FALSE,
  requires_avv                    BOOLEAN     NOT NULL DEFAULT FALSE,
  requires_health_data_processing BOOLEAN     NOT NULL DEFAULT FALSE,
  requires_admin_approval         BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at                      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (provider_key)
);

CREATE INDEX IF NOT EXISTS idx_connect_providers_category_status
  ON public.connect_providers (category, status);

-- --------------------------------------------------------------------------
-- 2. connect_provider_capabilities — Feature-Fähigkeiten pro Anbieter
-- capability.status = Feature-Reifegrad (getrennt von provider.status)
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.connect_provider_capabilities (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id           UUID        NOT NULL REFERENCES public.connect_providers(id) ON DELETE CASCADE,
  capability_key        TEXT        NOT NULL,
  title                 TEXT        NOT NULL,
  description           TEXT        NOT NULL DEFAULT '',
  data_direction        TEXT        NOT NULL DEFAULT 'out'
    CHECK (data_direction IN ('in', 'out', 'bidirectional')),
  sensitive_data_level  TEXT        NOT NULL DEFAULT 'none'
    CHECK (sensitive_data_level IN ('none', 'personal', 'health', 'financial', 'special_category')),
  requires_permission   TEXT,
  status                TEXT        NOT NULL DEFAULT 'planned'
    CHECK (status IN ('planned', 'beta', 'active', 'deprecated', 'disabled')),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (provider_id, capability_key)
);

CREATE INDEX IF NOT EXISTS idx_connect_provider_capabilities_provider
  ON public.connect_provider_capabilities (provider_id, status);

-- --------------------------------------------------------------------------
-- 3. tenant_connect_integrations — Mandant aktiviert/deaktiviert Anbieter
-- integration_status = mandantenspezifischer Betriebsstatus
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tenant_connect_integrations (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  provider_id           UUID        NOT NULL REFERENCES public.connect_providers(id) ON DELETE RESTRICT,
  integration_status    TEXT        NOT NULL DEFAULT 'not_configured'
    CHECK (integration_status IN (
      'not_configured', 'requested', 'configured', 'sandbox', 'production',
      'degraded', 'disabled', 'error'
    )),
  environment           TEXT
    CHECK (environment IS NULL OR environment IN ('sandbox', 'production')),
  enabled_by            UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  enabled_at            TIMESTAMPTZ,
  disabled_by           UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  disabled_at           TIMESTAMPTZ,
  last_health_status    TEXT,
  last_health_check_at  TIMESTAMPTZ,
  notes                 TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, provider_id)
);

CREATE INDEX IF NOT EXISTS idx_tenant_connect_integrations_tenant_status
  ON public.tenant_connect_integrations (tenant_id, integration_status);

CREATE INDEX IF NOT EXISTS idx_tenant_connect_integrations_provider
  ON public.tenant_connect_integrations (provider_id);

-- --------------------------------------------------------------------------
-- 4. tenant_connect_credentials — Vault-Referenzen (KEIN Klartext)
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tenant_connect_credentials (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  integration_id        UUID        NOT NULL REFERENCES public.tenant_connect_integrations(id) ON DELETE CASCADE,
  credential_type       TEXT        NOT NULL,
  credential_reference  TEXT        NOT NULL,
  encrypted_metadata    JSONB,
  rotation_required_at  TIMESTAMPTZ,
  created_by            UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (integration_id, credential_type),
  CONSTRAINT tenant_connect_credentials_reference_not_empty
    CHECK (length(trim(credential_reference)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_tenant_connect_credentials_tenant
  ON public.tenant_connect_credentials (tenant_id, integration_id);

-- --------------------------------------------------------------------------
-- 5. connect_data_permissions — Datenfreigaben je Integration
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.connect_data_permissions (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  integration_id        UUID        NOT NULL REFERENCES public.tenant_connect_integrations(id) ON DELETE CASCADE,
  data_category         TEXT        NOT NULL
    CHECK (data_category IN (
      'client_master_data', 'health_data', 'invoices', 'documents', 'appointments',
      'assignments', 'employees', 'location_data', 'payment_data', 'communication_data'
    )),
  allowed               BOOLEAN     NOT NULL DEFAULT FALSE,
  legal_basis           TEXT,
  consent_required      BOOLEAN     NOT NULL DEFAULT FALSE,
  consent_template_id   UUID,
  configured_by         UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  configured_at         TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (integration_id, data_category)
);

CREATE INDEX IF NOT EXISTS idx_connect_data_permissions_tenant
  ON public.connect_data_permissions (tenant_id, integration_id);

-- --------------------------------------------------------------------------
-- 6. connect_sync_jobs — Synchronisationsläufe
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.connect_sync_jobs (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  integration_id    UUID        NOT NULL REFERENCES public.tenant_connect_integrations(id) ON DELETE CASCADE,
  job_type          TEXT        NOT NULL,
  direction         TEXT        NOT NULL DEFAULT 'out'
    CHECK (direction IN ('in', 'out', 'bidirectional')),
  status            TEXT        NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
  started_at        TIMESTAMPTZ,
  finished_at       TIMESTAMPTZ,
  records_total     INTEGER     NOT NULL DEFAULT 0,
  records_success   INTEGER     NOT NULL DEFAULT 0,
  records_failed    INTEGER     NOT NULL DEFAULT 0,
  error_summary     TEXT,
  created_by        UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_connect_sync_jobs_tenant_integration
  ON public.connect_sync_jobs (tenant_id, integration_id, created_at DESC);

-- --------------------------------------------------------------------------
-- 7. connect_webhook_events — Webhook-Protokoll (keine vollen Payloads)
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.connect_webhook_events (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID        REFERENCES public.tenants(id) ON DELETE SET NULL,
  provider_id         UUID        NOT NULL REFERENCES public.connect_providers(id) ON DELETE CASCADE,
  integration_id      UUID        REFERENCES public.tenant_connect_integrations(id) ON DELETE SET NULL,
  event_type          TEXT        NOT NULL,
  external_event_id   TEXT,
  received_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at        TIMESTAMPTZ,
  status              TEXT        NOT NULL DEFAULT 'received'
    CHECK (status IN ('received', 'processing', 'processed', 'failed', 'ignored')),
  payload_hash        TEXT,
  error_message       TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_connect_webhook_events_provider
  ON public.connect_webhook_events (provider_id, received_at DESC);

CREATE INDEX IF NOT EXISTS idx_connect_webhook_events_tenant
  ON public.connect_webhook_events (tenant_id, received_at DESC)
  WHERE tenant_id IS NOT NULL;

-- --------------------------------------------------------------------------
-- 8. connect_audit_events — Audit-Trail (append-only)
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.connect_audit_events (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  integration_id    UUID        REFERENCES public.tenant_connect_integrations(id) ON DELETE SET NULL,
  provider_id       UUID        REFERENCES public.connect_providers(id) ON DELETE SET NULL,
  actor_user_id     UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  action            TEXT        NOT NULL,
  entity_type       TEXT        NOT NULL,
  entity_id         UUID,
  old_value_hash    TEXT,
  new_value_hash    TEXT,
  ip_address        INET,
  user_agent        TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_connect_audit_events_tenant
  ON public.connect_audit_events (tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_connect_audit_events_integration
  ON public.connect_audit_events (tenant_id, integration_id, created_at DESC)
  WHERE integration_id IS NOT NULL;

-- --------------------------------------------------------------------------
-- 9. connect_partner_marketplace_entries — Marktplatz
-- display_status ≠ provider.status ≠ integration_status
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.connect_partner_marketplace_entries (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id           UUID        NOT NULL REFERENCES public.connect_providers(id) ON DELETE CASCADE,
  marketplace_category  TEXT        NOT NULL
    CHECK (marketplace_category IN (
      'care_aids', 'medical_supply', 'pharmacy', 'emergency_call', 'transport',
      'meal_service', 'training_provider', 'billing_center', 'tax_advisor', 'other'
    )),
  display_status        TEXT        NOT NULL DEFAULT 'draft'
    CHECK (display_status IN ('draft', 'pending_review', 'published', 'suspended', 'archived')),
  short_description     TEXT        NOT NULL DEFAULT '',
  long_description      TEXT        NOT NULL DEFAULT '',
  pricing_model         TEXT,
  commission_model      TEXT,
  onboarding_url        TEXT,
  support_contact       TEXT,
  approved_by           UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  approved_at           TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (provider_id, marketplace_category)
);

CREATE INDEX IF NOT EXISTS idx_connect_marketplace_display
  ON public.connect_partner_marketplace_entries (display_status, marketplace_category);

-- --------------------------------------------------------------------------
-- updated_at Trigger
-- --------------------------------------------------------------------------
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'connect_providers',
    'connect_provider_capabilities',
    'tenant_connect_integrations',
    'tenant_connect_credentials',
    'connect_data_permissions',
    'connect_partner_marketplace_entries'
  ]
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS set_%I_updated_at ON public.%I', t, t);
    EXECUTE format(
      'CREATE TRIGGER set_%I_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()',
      t, t
    );
  END LOOP;
END $$;

-- --------------------------------------------------------------------------
-- RLS aktivieren
-- --------------------------------------------------------------------------
ALTER TABLE public.connect_providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.connect_provider_capabilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_connect_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_connect_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.connect_data_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.connect_sync_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.connect_webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.connect_audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.connect_partner_marketplace_entries ENABLE ROW LEVEL SECURITY;

-- --------------------------------------------------------------------------
-- RLS: connect_providers — global lesbar, nur Plattform-Admin schreibbar
-- --------------------------------------------------------------------------
DROP POLICY IF EXISTS connect_providers_select ON public.connect_providers;
CREATE POLICY connect_providers_select ON public.connect_providers
  FOR SELECT
  TO authenticated
  USING (status <> 'disabled');

DROP POLICY IF EXISTS connect_providers_write ON public.connect_providers;
CREATE POLICY connect_providers_write ON public.connect_providers
  FOR ALL
  TO authenticated
  USING (public.is_connect_platform_admin())
  WITH CHECK (public.is_connect_platform_admin());

-- --------------------------------------------------------------------------
-- RLS: connect_provider_capabilities — wie Provider-Katalog
-- --------------------------------------------------------------------------
DROP POLICY IF EXISTS connect_provider_capabilities_select ON public.connect_provider_capabilities;
CREATE POLICY connect_provider_capabilities_select ON public.connect_provider_capabilities
  FOR SELECT
  TO authenticated
  USING (
    status <> 'disabled'
    AND EXISTS (
      SELECT 1 FROM public.connect_providers p
      WHERE p.id = provider_id AND p.status <> 'disabled'
    )
  );

DROP POLICY IF EXISTS connect_provider_capabilities_write ON public.connect_provider_capabilities;
CREATE POLICY connect_provider_capabilities_write ON public.connect_provider_capabilities
  FOR ALL
  TO authenticated
  USING (public.is_connect_platform_admin())
  WITH CHECK (public.is_connect_platform_admin());

-- --------------------------------------------------------------------------
-- RLS: tenant_connect_integrations — Mandant + Tenant-Admin
-- --------------------------------------------------------------------------
DROP POLICY IF EXISTS tenant_connect_integrations_tenant_select ON public.tenant_connect_integrations;
CREATE POLICY tenant_connect_integrations_tenant_select ON public.tenant_connect_integrations
  FOR SELECT
  TO authenticated
  USING (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS tenant_connect_integrations_tenant_write ON public.tenant_connect_integrations;
CREATE POLICY tenant_connect_integrations_tenant_write ON public.tenant_connect_integrations
  FOR INSERT
  TO authenticated
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND public.is_connect_tenant_admin()
  );

DROP POLICY IF EXISTS tenant_connect_integrations_tenant_update ON public.tenant_connect_integrations;
CREATE POLICY tenant_connect_integrations_tenant_update ON public.tenant_connect_integrations
  FOR UPDATE
  TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND public.is_connect_tenant_admin()
  )
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND public.is_connect_tenant_admin()
  );

DROP POLICY IF EXISTS tenant_connect_integrations_tenant_delete ON public.tenant_connect_integrations;
CREATE POLICY tenant_connect_integrations_tenant_delete ON public.tenant_connect_integrations
  FOR DELETE
  TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND public.is_connect_tenant_admin()
  );

-- --------------------------------------------------------------------------
-- RLS: tenant_connect_credentials — KEIN Client-Zugriff (nur service_role)
-- Keine Policy für authenticated → implizit verweigert
-- --------------------------------------------------------------------------

-- --------------------------------------------------------------------------
-- RLS: connect_data_permissions — Mandant, Tenant-Admin
-- --------------------------------------------------------------------------
DROP POLICY IF EXISTS connect_data_permissions_tenant ON public.connect_data_permissions;
CREATE POLICY connect_data_permissions_tenant ON public.connect_data_permissions
  FOR ALL
  TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND public.is_connect_tenant_admin()
  )
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND public.is_connect_tenant_admin()
  );

DROP POLICY IF EXISTS connect_data_permissions_tenant_read ON public.connect_data_permissions;
CREATE POLICY connect_data_permissions_tenant_read ON public.connect_data_permissions
  FOR SELECT
  TO authenticated
  USING (tenant_id = public.current_tenant_id());

-- --------------------------------------------------------------------------
-- RLS: connect_sync_jobs — Mandant lesen; Schreiben Tenant-Admin
-- --------------------------------------------------------------------------
DROP POLICY IF EXISTS connect_sync_jobs_tenant_select ON public.connect_sync_jobs;
CREATE POLICY connect_sync_jobs_tenant_select ON public.connect_sync_jobs
  FOR SELECT
  TO authenticated
  USING (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS connect_sync_jobs_tenant_insert ON public.connect_sync_jobs;
CREATE POLICY connect_sync_jobs_tenant_insert ON public.connect_sync_jobs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND public.is_connect_tenant_admin()
  );

-- --------------------------------------------------------------------------
-- RLS: connect_webhook_events — stark eingeschränkt
-- Mandanten-Admins sehen nur eigene Events; Insert nur service_role (keine Policy)
-- --------------------------------------------------------------------------
DROP POLICY IF EXISTS connect_webhook_events_tenant_select ON public.connect_webhook_events;
CREATE POLICY connect_webhook_events_tenant_select ON public.connect_webhook_events
  FOR SELECT
  TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND public.is_connect_tenant_admin()
  );

-- --------------------------------------------------------------------------
-- RLS: connect_audit_events — Mandant lesen; Insert Tenant-Admin (append)
-- --------------------------------------------------------------------------
DROP POLICY IF EXISTS connect_audit_events_tenant_select ON public.connect_audit_events;
CREATE POLICY connect_audit_events_tenant_select ON public.connect_audit_events
  FOR SELECT
  TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND public.is_connect_tenant_admin()
  );

DROP POLICY IF EXISTS connect_audit_events_tenant_insert ON public.connect_audit_events;
CREATE POLICY connect_audit_events_tenant_insert ON public.connect_audit_events
  FOR INSERT
  TO authenticated
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND public.is_connect_tenant_admin()
  );

-- --------------------------------------------------------------------------
-- RLS: connect_partner_marketplace_entries — published lesbar für alle Auth
-- --------------------------------------------------------------------------
DROP POLICY IF EXISTS connect_marketplace_select ON public.connect_partner_marketplace_entries;
CREATE POLICY connect_marketplace_select ON public.connect_partner_marketplace_entries
  FOR SELECT
  TO authenticated
  USING (
    display_status = 'published'
    OR public.is_connect_platform_admin()
  );

DROP POLICY IF EXISTS connect_marketplace_write ON public.connect_partner_marketplace_entries;
CREATE POLICY connect_marketplace_write ON public.connect_partner_marketplace_entries
  FOR ALL
  TO authenticated
  USING (public.is_connect_platform_admin())
  WITH CHECK (public.is_connect_platform_admin());

-- --------------------------------------------------------------------------
-- GRANTs — Credentials bewusst ausgeschlossen (service_role only)
-- --------------------------------------------------------------------------
GRANT SELECT ON public.connect_providers TO authenticated;
GRANT SELECT ON public.connect_provider_capabilities TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tenant_connect_integrations TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.connect_data_permissions TO authenticated;
GRANT SELECT, INSERT ON public.connect_sync_jobs TO authenticated;
GRANT SELECT ON public.connect_webhook_events TO authenticated;
GRANT SELECT, INSERT ON public.connect_audit_events TO authenticated;
GRANT SELECT ON public.connect_partner_marketplace_entries TO authenticated;

GRANT INSERT, UPDATE, DELETE ON public.connect_providers TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.connect_provider_capabilities TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.connect_partner_marketplace_entries TO authenticated;

-- service_role: voller Zugriff inkl. Credentials & Webhook-Insert (RLS-Bypass)
GRANT ALL ON public.tenant_connect_credentials TO service_role;
GRANT ALL ON public.connect_webhook_events TO service_role;
GRANT ALL ON public.connect_sync_jobs TO service_role;

-- --------------------------------------------------------------------------
-- Kommentare
-- --------------------------------------------------------------------------
COMMENT ON TABLE public.connect_providers IS
  'CareSuite+ Connect — globaler Anbieter-Katalog (provider.status = Katalog-Reifegrad)';

COMMENT ON TABLE public.connect_provider_capabilities IS
  'CareSuite+ Connect — Anbieter-Fähigkeiten (capability.status = Feature-Reifegrad)';

COMMENT ON TABLE public.tenant_connect_integrations IS
  'CareSuite+ Connect — mandantenspezifische Integration (integration_status = Betrieb)';

COMMENT ON TABLE public.tenant_connect_credentials IS
  'CareSuite+ Connect — Vault-Referenzen only; kein SELECT für authenticated';

COMMENT ON TABLE public.integration_providers IS
  'Legacy (0007) — wird schrittweise durch tenant_connect_integrations ersetzt; unverändert';

COMMENT ON COLUMN public.tenant_connect_credentials.credential_reference IS
  'Vault/Secret-Manager-Key — niemals Klartext-API-Key';

COMMENT ON COLUMN public.connect_webhook_events.payload_hash IS
  'SHA-256 o.ä. — keine vollständigen sensiblen Payloads persistieren';
