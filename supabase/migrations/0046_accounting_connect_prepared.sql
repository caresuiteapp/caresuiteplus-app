-- ==========================================================================
-- CareSuite+ — Migration 0046: Buchhaltung / Connect Accounting (prepared)
-- DATEV, Lexware Office, sevDesk, Steuerberater-Export, GoBD-Archiv
-- Keine API-Keys im Klartext. Keine destruktiven Befehle. Nicht produktiv.
-- ==========================================================================

-- --------------------------------------------------------------------------
-- 1. accounting_provider_configs — mandantenspezifische Anbieter-Einstellungen
-- credential_vault_ref = Vault-Referenz only (kein Klartext)
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.accounting_provider_configs (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  provider_key          TEXT        NOT NULL
    CHECK (provider_key IN (
      'datev', 'lexware_office', 'sevdesk', 'fastbill', 'agenda',
      'steuerberater_export', 'gobd_archiv'
    )),
  config_status         TEXT        NOT NULL DEFAULT 'not_configured'
    CHECK (config_status IN (
      'not_configured', 'requested', 'configured', 'sandbox', 'production',
      'disabled', 'error'
    )),
  environment           TEXT
    CHECK (environment IS NULL OR environment IN ('sandbox', 'production')),
  credential_vault_ref  TEXT,
  settings_json         JSONB       NOT NULL DEFAULT '{}'::jsonb,
  configured_by         UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  configured_at         TIMESTAMPTZ,
  notes                 TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, provider_key),
  CONSTRAINT accounting_provider_configs_vault_not_empty
    CHECK (credential_vault_ref IS NULL OR length(trim(credential_vault_ref)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_accounting_provider_configs_tenant
  ON public.accounting_provider_configs (tenant_id, provider_key);

-- --------------------------------------------------------------------------
-- 2. invoice_accounting_status — Buchhaltungsstatus je Rechnung
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.invoice_accounting_status (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  invoice_id            UUID        NOT NULL,
  accounting_status     TEXT        NOT NULL DEFAULT 'erstellt'
    CHECK (accounting_status IN (
      'erstellt', 'versendet', 'bezahlt', 'ueberfaellig', 'gemahnt',
      'storniert', 'korrigiert', 'export_bereit', 'exportiert',
      'export_fehler', 'steuerberater_uebergeben', 'gobd_archiviert'
    )),
  provider_key          TEXT
    CHECK (provider_key IS NULL OR provider_key IN (
      'datev', 'lexware_office', 'sevdesk', 'fastbill', 'agenda',
      'steuerberater_export', 'gobd_archiv'
    )),
  last_export_id        UUID,
  archived_at           TIMESTAMPTZ,
  archive_version       INTEGER     NOT NULL DEFAULT 0,
  correction_of_id      UUID,
  notes                 TEXT,
  updated_by            UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, invoice_id)
);

CREATE INDEX IF NOT EXISTS idx_invoice_accounting_status_tenant
  ON public.invoice_accounting_status (tenant_id, accounting_status);

CREATE INDEX IF NOT EXISTS idx_invoice_accounting_status_invoice
  ON public.invoice_accounting_status (tenant_id, invoice_id);

-- --------------------------------------------------------------------------
-- 3. accounting_exports — Exportläufe (niemals „completed" ohne echten Transfer)
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.accounting_exports (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  provider_key          TEXT        NOT NULL
    CHECK (provider_key IN (
      'datev', 'lexware_office', 'sevdesk', 'fastbill', 'agenda',
      'steuerberater_export', 'gobd_archiv'
    )),
  export_type           TEXT        NOT NULL DEFAULT 'invoice'
    CHECK (export_type IN ('invoice', 'batch', 'steuerberater_package', 'archive')),
  export_format         TEXT
    CHECK (export_format IS NULL OR export_format IN ('csv', 'xml', 'pdf', 'datev', 'lexware', 'sevdesk')),
  status                TEXT        NOT NULL DEFAULT 'prepared'
    CHECK (status IN (
      'prepared', 'queued', 'running', 'blocked', 'failed', 'cancelled'
    )),
  external_transfer     BOOLEAN     NOT NULL DEFAULT FALSE,
  item_count            INTEGER     NOT NULL DEFAULT 0,
  error_summary         TEXT,
  package_label         TEXT,
  initiated_by          UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  started_at            TIMESTAMPTZ,
  finished_at           TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_accounting_exports_tenant
  ON public.accounting_exports (tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_accounting_exports_status
  ON public.accounting_exports (tenant_id, status, provider_key);

-- --------------------------------------------------------------------------
-- 4. accounting_export_items — Einzelposten je Export
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.accounting_export_items (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  export_id             UUID        NOT NULL REFERENCES public.accounting_exports(id) ON DELETE CASCADE,
  invoice_id            UUID        NOT NULL,
  invoice_number        TEXT,
  item_status           TEXT        NOT NULL DEFAULT 'pending'
    CHECK (item_status IN ('pending', 'prepared', 'blocked', 'failed', 'skipped')),
  error_message         TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_accounting_export_items_export
  ON public.accounting_export_items (export_id);

CREATE INDEX IF NOT EXISTS idx_accounting_export_items_tenant_invoice
  ON public.accounting_export_items (tenant_id, invoice_id);

ALTER TABLE public.invoice_accounting_status
  DROP CONSTRAINT IF EXISTS invoice_accounting_status_last_export_fk;

ALTER TABLE public.invoice_accounting_status
  ADD CONSTRAINT invoice_accounting_status_last_export_fk
  FOREIGN KEY (last_export_id) REFERENCES public.accounting_exports(id) ON DELETE SET NULL;

-- --------------------------------------------------------------------------
-- 5. document_archive_entries — GoBD-Archiv (Versionierung)
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.document_archive_entries (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  invoice_id            UUID        NOT NULL,
  document_type           TEXT        NOT NULL DEFAULT 'invoice'
    CHECK (document_type IN ('invoice', 'correction', 'storno', 'steuerberater_package')),
  version               INTEGER     NOT NULL DEFAULT 1,
  content_hash          TEXT        NOT NULL,
  storage_reference     TEXT        NOT NULL,
  archived_by           UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  archived_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_immutable          BOOLEAN     NOT NULL DEFAULT TRUE,
  metadata_json         JSONB       NOT NULL DEFAULT '{}'::jsonb,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, invoice_id, document_type, version)
);

CREATE INDEX IF NOT EXISTS idx_document_archive_entries_tenant
  ON public.document_archive_entries (tenant_id, invoice_id, version DESC);

-- --------------------------------------------------------------------------
-- 6. gobd_audit_events — GoBD-relevanter Audit-Trail (append-only)
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.gobd_audit_events (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  invoice_id            UUID,
  archive_entry_id      UUID        REFERENCES public.document_archive_entries(id) ON DELETE SET NULL,
  export_id             UUID        REFERENCES public.accounting_exports(id) ON DELETE SET NULL,
  actor_user_id         UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  event_type            TEXT        NOT NULL
    CHECK (event_type IN (
      'archive_created', 'archive_versioned', 'edit_blocked', 'correction_started',
      'storno_created', 'korrektur_created', 'export_prepared', 'export_blocked',
      'export_failed', 'steuerberater_package_prepared', 'status_changed'
    )),
  summary               TEXT        NOT NULL,
  old_value_hash        TEXT,
  new_value_hash        TEXT,
  metadata_json         JSONB       NOT NULL DEFAULT '{}'::jsonb,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gobd_audit_events_tenant
  ON public.gobd_audit_events (tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_gobd_audit_events_invoice
  ON public.gobd_audit_events (tenant_id, invoice_id, created_at DESC)
  WHERE invoice_id IS NOT NULL;

-- --------------------------------------------------------------------------
-- updated_at Trigger
-- --------------------------------------------------------------------------
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'accounting_provider_configs',
    'invoice_accounting_status',
    'accounting_exports',
    'accounting_export_items'
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
ALTER TABLE public.accounting_provider_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_accounting_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounting_exports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounting_export_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_archive_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gobd_audit_events ENABLE ROW LEVEL SECURITY;

-- --------------------------------------------------------------------------
-- RLS: accounting_provider_configs — nur Tenant-Admin (connect.configure)
-- --------------------------------------------------------------------------
DROP POLICY IF EXISTS accounting_provider_configs_admin ON public.accounting_provider_configs;
CREATE POLICY accounting_provider_configs_admin ON public.accounting_provider_configs
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

-- --------------------------------------------------------------------------
-- RLS: invoice_accounting_status — Mandant lesen; Schreiben Tenant-Admin
-- --------------------------------------------------------------------------
DROP POLICY IF EXISTS invoice_accounting_status_tenant_select ON public.invoice_accounting_status;
CREATE POLICY invoice_accounting_status_tenant_select ON public.invoice_accounting_status
  FOR SELECT
  TO authenticated
  USING (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS invoice_accounting_status_tenant_write ON public.invoice_accounting_status;
CREATE POLICY invoice_accounting_status_tenant_write ON public.invoice_accounting_status
  FOR INSERT
  TO authenticated
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND public.is_connect_tenant_admin()
  );

DROP POLICY IF EXISTS invoice_accounting_status_tenant_update ON public.invoice_accounting_status;
CREATE POLICY invoice_accounting_status_tenant_update ON public.invoice_accounting_status
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

-- --------------------------------------------------------------------------
-- RLS: accounting_exports — Mandant lesen; Schreiben Tenant-Admin
-- --------------------------------------------------------------------------
DROP POLICY IF EXISTS accounting_exports_tenant_select ON public.accounting_exports;
CREATE POLICY accounting_exports_tenant_select ON public.accounting_exports
  FOR SELECT
  TO authenticated
  USING (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS accounting_exports_tenant_insert ON public.accounting_exports;
CREATE POLICY accounting_exports_tenant_insert ON public.accounting_exports
  FOR INSERT
  TO authenticated
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND public.is_connect_tenant_admin()
  );

DROP POLICY IF EXISTS accounting_exports_tenant_update ON public.accounting_exports;
CREATE POLICY accounting_exports_tenant_update ON public.accounting_exports
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

-- --------------------------------------------------------------------------
-- RLS: accounting_export_items — wie Exports
-- --------------------------------------------------------------------------
DROP POLICY IF EXISTS accounting_export_items_tenant_select ON public.accounting_export_items;
CREATE POLICY accounting_export_items_tenant_select ON public.accounting_export_items
  FOR SELECT
  TO authenticated
  USING (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS accounting_export_items_tenant_write ON public.accounting_export_items;
CREATE POLICY accounting_export_items_tenant_write ON public.accounting_export_items
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

-- --------------------------------------------------------------------------
-- RLS: document_archive_entries — Mandant lesen; Insert Tenant-Admin
-- --------------------------------------------------------------------------
DROP POLICY IF EXISTS document_archive_entries_tenant_select ON public.document_archive_entries;
CREATE POLICY document_archive_entries_tenant_select ON public.document_archive_entries
  FOR SELECT
  TO authenticated
  USING (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS document_archive_entries_tenant_insert ON public.document_archive_entries;
CREATE POLICY document_archive_entries_tenant_insert ON public.document_archive_entries
  FOR INSERT
  TO authenticated
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND public.is_connect_tenant_admin()
  );

-- --------------------------------------------------------------------------
-- RLS: gobd_audit_events — Mandant lesen; append-only Insert
-- --------------------------------------------------------------------------
DROP POLICY IF EXISTS gobd_audit_events_tenant_select ON public.gobd_audit_events;
CREATE POLICY gobd_audit_events_tenant_select ON public.gobd_audit_events
  FOR SELECT
  TO authenticated
  USING (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS gobd_audit_events_tenant_insert ON public.gobd_audit_events;
CREATE POLICY gobd_audit_events_tenant_insert ON public.gobd_audit_events
  FOR INSERT
  TO authenticated
  WITH CHECK (tenant_id = public.current_tenant_id());

-- --------------------------------------------------------------------------
-- GRANTs
-- --------------------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE ON public.accounting_provider_configs TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.invoice_accounting_status TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.accounting_exports TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.accounting_export_items TO authenticated;
GRANT SELECT, INSERT ON public.document_archive_entries TO authenticated;
GRANT SELECT, INSERT ON public.gobd_audit_events TO authenticated;

-- --------------------------------------------------------------------------
-- Kommentare
-- --------------------------------------------------------------------------
COMMENT ON TABLE public.accounting_provider_configs IS
  'Buchhaltungs-Anbieter je Mandant — credential_vault_ref only, kein Klartext-API-Key';

COMMENT ON TABLE public.invoice_accounting_status IS
  'Buchhaltungsstatus je Rechnung — getrennt vom Workflow-Status';

COMMENT ON TABLE public.accounting_exports IS
  'Exportläufe — external_transfer=false bis echter Anbieter-Transfer; kein „completed" ohne Transfer';

COMMENT ON TABLE public.document_archive_entries IS
  'GoBD-Archiv mit Versionierung — is_immutable=true nach Archivierung';

COMMENT ON TABLE public.gobd_audit_events IS
  'GoBD-relevanter Audit-Trail — append-only, mandantenspezifisch';

COMMENT ON COLUMN public.accounting_exports.external_transfer IS
  'Nur TRUE wenn tatsächlicher Transfer zum Anbieter nachweisbar — sonst status blocked/failed';
