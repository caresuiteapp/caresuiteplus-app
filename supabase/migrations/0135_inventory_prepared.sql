-- ==========================================================================
-- CareSuite+ — Migration 0051: Inventar, Ausgabe & Rückgabe (preparedOnly)
-- Geräte, Dienstkleidung, Schlüssel, Dokumente, Fahrzeuge/Software vorbereitet.
-- Keine destruktiven Befehle. isInventoryLiveReady() bleibt false bis Freigabe.
-- ==========================================================================

CREATE TABLE IF NOT EXISTS public.inventory_categories (
  id                        UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                 UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  group_key                 TEXT        NOT NULL
    CHECK (group_key IN ('devices', 'mobile_sim', 'uniform', 'keys_access', 'documents', 'vehicles', 'software_access')),
  label                     TEXT        NOT NULL,
  requires_return_on_exit   BOOLEAN     NOT NULL DEFAULT TRUE,
  portal_visible_to_employee BOOLEAN    NOT NULL DEFAULT FALSE,
  barcode_enabled           BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, group_key, label)
);

CREATE TABLE IF NOT EXISTS public.inventory_locations (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  label       TEXT        NOT NULL,
  building    TEXT,
  room        TEXT,
  notes       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inventory_locations_tenant
  ON public.inventory_locations (tenant_id, label);

CREATE TABLE IF NOT EXISTS public.inventory_items (
  id                          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                   UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  category_id                 UUID        NOT NULL REFERENCES public.inventory_categories(id) ON DELETE RESTRICT,
  name                        TEXT        NOT NULL,
  sku                         TEXT,
  barcode                     TEXT,
  serial_number               TEXT,
  manufacturer                TEXT,
  model                       TEXT,
  purchase_date               DATE,
  warranty_until              DATE,
  location_id                 UUID        REFERENCES public.inventory_locations(id) ON DELETE SET NULL,
  status                      TEXT        NOT NULL DEFAULT 'available'
    CHECK (status IN (
      'available', 'assigned', 'in_use', 'reserved', 'maintenance',
      'damaged', 'lost', 'returned', 'decommissioned', 'archived'
    )),
  condition                   TEXT        NOT NULL DEFAULT 'new'
    CHECK (condition IN ('new', 'very_good', 'good', 'used', 'damaged', 'unusable', 'lost', 'unknown')),
  notes                       TEXT,
  requires_return_on_exit     BOOLEAN     NOT NULL DEFAULT TRUE,
  portal_visible_to_employee  BOOLEAN     NOT NULL DEFAULT FALSE,
  vehicle_ref_id              UUID,
  access_account_ref          TEXT,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inventory_items_tenant_status
  ON public.inventory_items (tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_inventory_items_tenant_serial
  ON public.inventory_items (tenant_id, serial_number);

CREATE TABLE IF NOT EXISTS public.inventory_assignments (
  id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  item_id                 UUID        NOT NULL REFERENCES public.inventory_items(id) ON DELETE RESTRICT,
  recipient_employee_id   UUID        NOT NULL REFERENCES public.employees(id) ON DELETE RESTRICT,
  responsible_employee_id UUID        REFERENCES public.employees(id) ON DELETE SET NULL,
  issued_by_profile_id    UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  issued_at               TIMESTAMPTZ,
  expected_return_at      TIMESTAMPTZ,
  acknowledged_at         TIMESTAMPTZ,
  status                  TEXT        NOT NULL DEFAULT 'planned'
    CHECK (status IN (
      'planned', 'issued', 'acknowledged', 'return_requested', 'partially_returned',
      'returned', 'overdue', 'damaged_returned', 'lost', 'disputed', 'archived'
    )),
  issue_condition         TEXT        NOT NULL DEFAULT 'good'
    CHECK (issue_condition IN ('new', 'very_good', 'good', 'used', 'damaged', 'unusable', 'lost', 'unknown')),
  issue_notes             TEXT,
  return_required         BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inventory_assignments_tenant_employee
  ON public.inventory_assignments (tenant_id, recipient_employee_id, status);

CREATE TABLE IF NOT EXISTS public.inventory_return_records (
  id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  assignment_id           UUID        NOT NULL REFERENCES public.inventory_assignments(id) ON DELETE RESTRICT,
  item_id                 UUID        NOT NULL REFERENCES public.inventory_items(id) ON DELETE RESTRICT,
  employee_id             UUID        NOT NULL REFERENCES public.employees(id) ON DELETE RESTRICT,
  returned_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  returned                BOOLEAN     NOT NULL DEFAULT FALSE,
  complete                BOOLEAN     NOT NULL DEFAULT FALSE,
  condition               TEXT        NOT NULL DEFAULT 'unknown'
    CHECK (condition IN ('new', 'very_good', 'good', 'used', 'damaged', 'unusable', 'lost', 'unknown')),
  damage_description      TEXT,
  accessories_complete    BOOLEAN,
  charger_returned        BOOLEAN,
  sim_removed             BOOLEAN,
  device_reset            BOOLEAN,
  data_deleted            BOOLEAN,
  photo_refs              TEXT[]      NOT NULL DEFAULT ARRAY[]::TEXT[],
  signature_refs          TEXT[]      NOT NULL DEFAULT ARRAY[]::TEXT[],
  notes                   TEXT,
  recorded_by_profile_id  UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inventory_return_records_tenant
  ON public.inventory_return_records (tenant_id, returned_at DESC);

CREATE TABLE IF NOT EXISTS public.inventory_damage_reports (
  id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  item_id                 UUID        NOT NULL REFERENCES public.inventory_items(id) ON DELETE RESTRICT,
  assignment_id           UUID        REFERENCES public.inventory_assignments(id) ON DELETE SET NULL,
  employee_id             UUID        REFERENCES public.employees(id) ON DELETE SET NULL,
  report_type             TEXT        NOT NULL CHECK (report_type IN ('damage', 'loss', 'missing_return')),
  description             TEXT        NOT NULL,
  condition               TEXT        NOT NULL DEFAULT 'damaged'
    CHECK (condition IN ('new', 'very_good', 'good', 'used', 'damaged', 'unusable', 'lost', 'unknown')),
  reported_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reported_by_profile_id  UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  resolved_at             TIMESTAMPTZ,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inventory_damage_reports_tenant
  ON public.inventory_damage_reports (tenant_id, report_type, reported_at DESC);

CREATE TABLE IF NOT EXISTS public.inventory_return_protocols (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  employee_id         UUID        NOT NULL REFERENCES public.employees(id) ON DELETE RESTRICT,
  employee_name       TEXT        NOT NULL,
  personnel_number    TEXT,
  exit_date           DATE        NOT NULL,
  issued_items        JSONB       NOT NULL DEFAULT '[]'::jsonb,
  returned_items      JSONB       NOT NULL DEFAULT '[]'::jsonb,
  missing_items       JSONB       NOT NULL DEFAULT '[]'::jsonb,
  damaged_items       JSONB       NOT NULL DEFAULT '[]'::jsonb,
  notes               TEXT,
  admin_profile_id    UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  admin_name          TEXT,
  employee_signature_ref TEXT,
  admin_signature_ref    TEXT,
  protocol_date       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  content_hash        TEXT        NOT NULL,
  pdf_template_prepared BOOLEAN   NOT NULL DEFAULT TRUE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.device_management_profiles (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  item_id               UUID        NOT NULL REFERENCES public.inventory_items(id) ON DELETE CASCADE,
  device_id             TEXT,
  os_name               TEXT,
  os_version            TEXT,
  app_version           TEXT,
  last_login_at         TIMESTAMPTZ,
  last_sync_at          TIMESTAMPTZ,
  mdm_status            TEXT        NOT NULL DEFAULT 'not_configured'
    CHECK (mdm_status IN ('not_configured', 'enrolled', 'pending', 'removed')),
  remote_lock_prepared  BOOLEAN     NOT NULL DEFAULT TRUE,
  remote_wipe_prepared  BOOLEAN     NOT NULL DEFAULT TRUE,
  mdm_provider_key      TEXT,
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, item_id)
);

CREATE TABLE IF NOT EXISTS public.inventory_audit_events (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  actor_profile_id  UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  action            TEXT        NOT NULL,
  entity_type       TEXT        NOT NULL
    CHECK (entity_type IN ('inventory_item', 'inventory_assignment', 'inventory_return', 'inventory_damage', 'return_protocol')),
  entity_id         UUID        NOT NULL,
  metadata          JSONB       NOT NULL DEFAULT '{}'::jsonb,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inventory_audit_events_tenant
  ON public.inventory_audit_events (tenant_id, created_at DESC);

-- Aggregierte Übersicht pro Mitarbeiter (materialisierte Sicht vorbereitet)
CREATE OR REPLACE VIEW public.employee_equipment_summary AS
SELECT
  a.tenant_id,
  a.recipient_employee_id AS employee_id,
  COUNT(*) FILTER (WHERE a.status NOT IN ('returned', 'archived')) AS active_assignments,
  COUNT(*) FILTER (WHERE a.status = 'overdue') AS overdue_returns,
  COUNT(*) FILTER (WHERE a.status = 'return_requested') AS open_return_requests,
  MAX(a.issued_at) AS last_issued_at
FROM public.inventory_assignments a
GROUP BY a.tenant_id, a.recipient_employee_id;

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'inventory_categories',
    'inventory_locations',
    'inventory_items',
    'inventory_assignments',
    'device_management_profiles'
  ]
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS set_%I_updated_at ON public.%I', t, t);
    EXECUTE format(
      'CREATE TRIGGER set_%I_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()',
      t, t
    );
  END LOOP;
END $$;

ALTER TABLE public.inventory_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_return_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_damage_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_return_protocols ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.device_management_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_audit_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY inventory_categories_tenant ON public.inventory_categories
  FOR ALL USING (tenant_id = public.current_tenant_id()) WITH CHECK (tenant_id = public.current_tenant_id());

CREATE POLICY inventory_locations_tenant ON public.inventory_locations
  FOR ALL USING (tenant_id = public.current_tenant_id()) WITH CHECK (tenant_id = public.current_tenant_id());

CREATE POLICY inventory_items_tenant ON public.inventory_items
  FOR ALL USING (tenant_id = public.current_tenant_id()) WITH CHECK (tenant_id = public.current_tenant_id());

CREATE POLICY inventory_assignments_tenant ON public.inventory_assignments
  FOR ALL USING (tenant_id = public.current_tenant_id()) WITH CHECK (tenant_id = public.current_tenant_id());

CREATE POLICY inventory_return_records_tenant ON public.inventory_return_records
  FOR ALL USING (tenant_id = public.current_tenant_id()) WITH CHECK (tenant_id = public.current_tenant_id());

CREATE POLICY inventory_damage_reports_tenant ON public.inventory_damage_reports
  FOR ALL USING (tenant_id = public.current_tenant_id()) WITH CHECK (tenant_id = public.current_tenant_id());

CREATE POLICY inventory_return_protocols_tenant ON public.inventory_return_protocols
  FOR ALL USING (tenant_id = public.current_tenant_id()) WITH CHECK (tenant_id = public.current_tenant_id());

CREATE POLICY device_management_profiles_tenant ON public.device_management_profiles
  FOR ALL USING (tenant_id = public.current_tenant_id()) WITH CHECK (tenant_id = public.current_tenant_id());

CREATE POLICY inventory_audit_events_tenant ON public.inventory_audit_events
  FOR ALL USING (tenant_id = public.current_tenant_id()) WITH CHECK (tenant_id = public.current_tenant_id());

GRANT SELECT, INSERT, UPDATE ON public.inventory_categories TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.inventory_locations TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.inventory_items TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.inventory_assignments TO authenticated;
GRANT SELECT, INSERT ON public.inventory_return_records TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.inventory_damage_reports TO authenticated;
GRANT SELECT, INSERT ON public.inventory_return_protocols TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.device_management_profiles TO authenticated;
GRANT SELECT, INSERT ON public.inventory_audit_events TO authenticated;

COMMENT ON TABLE public.inventory_items IS 'Inventarposten — mandantengebunden, keine Cross-Tenant-Daten';
COMMENT ON TABLE public.inventory_assignments IS 'Ausgaben — Empfänger Pflicht, voll auditierbar';
COMMENT ON TABLE public.device_management_profiles IS 'MDM vorbereitet — remote_lock/wipe erst nach Provider-Anbindung';
