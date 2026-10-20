-- ==========================================================================
-- CareSuite+ â€” Migration 0073: Mitarbeitenden-Kataloge & Live-Anlage
-- PostgREST GET /rest/v1/catalog_entries â†’ 404 PGRST205 on employee create
-- (CatalogValueSelect for employee_status). Pattern: 0014 + 0066 GRANT idempotency.
-- ==========================================================================

CREATE TABLE IF NOT EXISTS public.catalog_entries (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID        REFERENCES public.tenants(id) ON DELETE CASCADE,
  catalog_type  TEXT        NOT NULL,
  value_key     TEXT        NOT NULL,
  label         TEXT        NOT NULL,
  description   TEXT,
  module_key    TEXT        NOT NULL,
  is_system     BOOLEAN     NOT NULL DEFAULT FALSE,
  is_active     BOOLEAN     NOT NULL DEFAULT TRUE,
  sort_order    INT         NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_catalog_entries_catalog_type ON public.catalog_entries(catalog_type);
CREATE INDEX IF NOT EXISTS idx_catalog_entries_tenant_id ON public.catalog_entries(tenant_id);

ALTER TABLE public.catalog_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "catalog_entries_select_tenant" ON public.catalog_entries;
CREATE POLICY "catalog_entries_select_tenant"
  ON public.catalog_entries FOR SELECT TO authenticated
  USING (
    tenant_id IS NULL
    OR tenant_id = public.current_tenant_id()
  );

DROP POLICY IF EXISTS "catalog_entries_insert_tenant" ON public.catalog_entries;
CREATE POLICY "catalog_entries_insert_tenant"
  ON public.catalog_entries FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS "catalog_entries_update_tenant" ON public.catalog_entries;
CREATE POLICY "catalog_entries_update_tenant"
  ON public.catalog_entries FOR UPDATE TO authenticated
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

GRANT SELECT, INSERT, UPDATE ON public.catalog_entries TO authenticated;

-- HR-Statuswerte erweitern (Katalog employee_status)
ALTER TABLE public.employees DROP CONSTRAINT IF EXISTS employees_status_check;
ALTER TABLE public.employees ADD CONSTRAINT employees_status_check CHECK (status IN (
  'entwurf', 'aktiv', 'in_bearbeitung', 'abgeschlossen', 'archiviert', 'fehlerhaft', 'gesperrt',
  'probezeit', 'einarbeitung', 'urlaub', 'krank', 'elternzeit', 'fortbildung', 'teilzeit',
  'freigestellt', 'kuendigung_laeuft', 'ausgeschieden'
));

-- Berechtigungen fÃ¼r Mitarbeitenden-Anlage
INSERT INTO public.role_permissions (role_id, permission_key)
SELECT r.id, p.key
FROM public.roles r
CROSS JOIN (
  VALUES
    ('office.employees.view'),
    ('office.employees.create'),
    ('office.employees.edit'),
    ('office.catalogs.view')
) AS p(key)
WHERE r.key IN ('business_admin', 'business_manager')
ON CONFLICT (role_id, permission_key) DO NOTHING;

DROP POLICY IF EXISTS "employees_insert_tenant" ON public.employees;
CREATE POLICY "employees_insert_tenant"
  ON public.employees FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND public.has_permission('office.employees.create')
    AND public.current_role_key() IN ('business_admin', 'business_manager')
  );

-- System-Katalog: Mitarbeiterstatus
INSERT INTO public.catalog_entries (tenant_id, catalog_type, value_key, label, description, module_key, is_system, sort_order)
SELECT NULL, v.catalog_type, v.value_key, v.label, v.description, 'office', TRUE, v.sort_order
FROM (VALUES
  ('employee_status', 'aktiv', 'Aktiv', 'Im Einsatz', 1),
  ('employee_status', 'probezeit', 'Probezeit', 'Probezeit lÃ¤uft', 2),
  ('employee_status', 'einarbeitung', 'Einarbeitung', 'Einarbeitungsphase', 3),
  ('employee_status', 'urlaub', 'Im Urlaub', 'Genehmigter Urlaub', 4),
  ('employee_status', 'krank', 'Krankgemeldet', 'AU / Krankmeldung', 5),
  ('employee_status', 'elternzeit', 'Elternzeit', 'Elternzeit / Mutterschutz', 6),
  ('employee_status', 'fortbildung', 'Fortbildung', 'Schulung / Fortbildung', 7),
  ('employee_status', 'teilzeit', 'Teilzeit', 'Reduzierte Arbeitszeit', 8),
  ('employee_status', 'freigestellt', 'Freigestellt', 'VorÃ¼bergehend freigestellt', 9),
  ('employee_status', 'kuendigung_laeuft', 'KÃ¼ndigung lÃ¤uft', 'KÃ¼ndigungsfrist', 10),
  ('employee_status', 'ausgeschieden', 'Ausgeschieden', 'Nicht mehr im Unternehmen', 11),
  ('employee_status', 'gesperrt', 'Gesperrt', 'Zugang gesperrt', 12),
  ('employee_status', 'archiviert', 'Archiviert', 'Archivierter Datensatz', 13)
) AS v(catalog_type, value_key, label, description, sort_order)
WHERE NOT EXISTS (
  SELECT 1 FROM public.catalog_entries e
  WHERE e.tenant_id IS NULL AND e.catalog_type = v.catalog_type AND e.value_key = v.value_key
);

-- System-Katalog: Rollen / Titel
INSERT INTO public.catalog_entries (tenant_id, catalog_type, value_key, label, description, module_key, is_system, sort_order)
SELECT NULL, v.catalog_type, v.value_key, v.label, v.description, 'office', TRUE, v.sort_order
FROM (VALUES
  ('employee_role', 'pflegefachkraft', 'Pflegefachkraft', 'Examinierte Pflegefachkraft', 1),
  ('employee_role', 'pflegehelfer', 'Pflegehelfer:in', 'Pflegehilfskraft / Pflegeassistent:in', 2),
  ('employee_role', 'betreuungskraft', 'Betreuungskraft', 'Betreuung nach Â§ 45b SGB XI', 3),
  ('employee_role', 'alltagsbegleiter', 'Alltagsbegleiter:in', 'Alltagsbegleitung / Assistenz', 4),
  ('employee_role', 'hauswirtschaft', 'Hauswirtschaft', 'Haushalt und Versorgung', 5),
  ('employee_role', 'disponent', 'Disponent:in', 'Einsatz- und Tourenplanung', 6),
  ('employee_role', 'buerokraft', 'BÃ¼rokraft', 'Verwaltung und Empfang', 7),
  ('employee_role', 'teamleitung', 'Teamleitung', 'FÃ¼hrung eines Teams / Bereichs', 8),
  ('employee_role', 'geschaeftsfuehrung', 'GeschÃ¤ftsfÃ¼hrung', 'Leitung / GeschÃ¤ftsfÃ¼hrung', 9),
  ('employee_role', 'praktikant', 'Praktikant:in', 'Praktikum / Ausbildung', 10),
  ('employee_role', 'qualitaetsmanagement', 'QM-Beauftragte:r', 'QualitÃ¤tsmanagement', 11),
  ('employee_role', 'ausbildung', 'Auszubildende:r', 'Pflegeausbildung', 12)
) AS v(catalog_type, value_key, label, description, sort_order)
WHERE NOT EXISTS (
  SELECT 1 FROM public.catalog_entries e
  WHERE e.tenant_id IS NULL AND e.catalog_type = v.catalog_type AND e.value_key = v.value_key
);

-- System-Katalog: Abteilungen
INSERT INTO public.catalog_entries (tenant_id, catalog_type, value_key, label, description, module_key, is_system, sort_order)
SELECT NULL, v.catalog_type, v.value_key, v.label, v.description, 'office', TRUE, v.sort_order
FROM (VALUES
  ('employee_department', 'assist_aussendienst', 'Assist / AuÃŸendienst', 'Assistenz und AuÃŸendienst', 1),
  ('employee_department', 'pflege', 'Pflege', 'Ambulante und stationÃ¤re Pflege', 2),
  ('employee_department', 'buero_verwaltung', 'BÃ¼ro / Verwaltung', 'Backoffice und Verwaltung', 3),
  ('employee_department', 'disposition', 'Disposition', 'Einsatzplanung und Touren', 4),
  ('employee_department', 'abrechnung', 'Abrechnung', 'Leistungsabrechnung und Faktura', 5),
  ('employee_department', 'qm', 'QM', 'QualitÃ¤tsmanagement', 6),
  ('employee_department', 'geschaeftsfuehrung', 'GeschÃ¤ftsfÃ¼hrung', 'Unternehmensleitung', 7),
  ('employee_department', 'recruiting', 'Recruiting / HR', 'Personalgewinnung und HR', 8),
  ('employee_department', 'akademie', 'Akademie / Schulung', 'Fort- und Weiterbildung', 9)
) AS v(catalog_type, value_key, label, description, sort_order)
WHERE NOT EXISTS (
  SELECT 1 FROM public.catalog_entries e
  WHERE e.tenant_id IS NULL AND e.catalog_type = v.catalog_type AND e.value_key = v.value_key
);

COMMENT ON TABLE public.catalog_entries IS 'Dropdown-Katalogwerte fÃ¼r alle Module (Office HR, Status, etc.)';
