-- ==========================================================================
-- CareSuite+ — Migration 0047: Medizinische Stammdaten & Dokumentationshilfen
-- Dokumentations-/Kodierhilfe — KEIN Medizinprodukt, keine Therapieempfehlung.
-- Keine destruktiven Befehle. Nicht produktiv bis Lizenzen geprüft.
-- ==========================================================================

-- --------------------------------------------------------------------------
-- 1. medical_catalog_sources — System-Registry mit Lizenzstatus
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.medical_catalog_sources (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  source_key        TEXT        NOT NULL UNIQUE
    CHECK (source_key IN (
      'icd10_gm', 'snomed_ct', 'loinc', 'ucum', 'atc_ddd', 'pzn_ifa',
      'rote_liste', 'abdata', 'bfarm_am'
    )),
  label             TEXT        NOT NULL,
  description       TEXT,
  license_status    TEXT        NOT NULL DEFAULT 'disabled'
    CHECK (license_status IN (
      'public', 'licensed_required', 'provider_required', 'internal_only', 'disabled'
    )),
  is_search_enabled BOOLEAN     NOT NULL DEFAULT FALSE,
  is_import_enabled BOOLEAN     NOT NULL DEFAULT FALSE,
  mdr_risk_note     TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- --------------------------------------------------------------------------
-- 2. medical_catalog_versions — Versionen je Quelle
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.medical_catalog_versions (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id         UUID        NOT NULL REFERENCES public.medical_catalog_sources(id) ON DELETE CASCADE,
  version_label     TEXT        NOT NULL,
  valid_from        DATE,
  valid_until       DATE,
  status            TEXT        NOT NULL DEFAULT 'prepared'
    CHECK (status IN ('prepared', 'importing', 'active', 'deprecated', 'disabled')),
  record_count      INTEGER     NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (source_id, version_label)
);

CREATE INDEX IF NOT EXISTS idx_medical_catalog_versions_source
  ON public.medical_catalog_versions (source_id, status);

-- --------------------------------------------------------------------------
-- 3. icd_codes — ICD-10-GM Kodierhilfe (keine Diagnoseentscheidung)
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.icd_codes (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id        UUID        NOT NULL REFERENCES public.medical_catalog_versions(id) ON DELETE CASCADE,
  code              TEXT        NOT NULL,
  title             TEXT        NOT NULL,
  chapter           TEXT,
  block_code        TEXT,
  parent_code       TEXT,
  search_text       TEXT,
  is_terminal       BOOLEAN     NOT NULL DEFAULT TRUE,
  metadata          JSONB       NOT NULL DEFAULT '{}'::jsonb,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (version_id, code)
);

CREATE INDEX IF NOT EXISTS idx_icd_codes_search
  ON public.icd_codes (version_id, code);
CREATE INDEX IF NOT EXISTS idx_icd_codes_search_text
  ON public.icd_codes USING gin (to_tsvector('german', coalesce(search_text, title || ' ' || code)));

-- --------------------------------------------------------------------------
-- 4. medication_catalog_items — Stammdaten (ATC/PZN/BfArM), keine Verordnung
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.medication_catalog_items (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id        UUID        NOT NULL REFERENCES public.medical_catalog_versions(id) ON DELETE CASCADE,
  item_key          TEXT        NOT NULL,
  display_name      TEXT        NOT NULL,
  atc_code          TEXT,
  pzn               TEXT,
  substance_label   TEXT,
  form_label        TEXT,
  metadata          JSONB       NOT NULL DEFAULT '{}'::jsonb,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (version_id, item_key)
);

CREATE INDEX IF NOT EXISTS idx_medication_catalog_items_version
  ON public.medication_catalog_items (version_id, display_name);

-- --------------------------------------------------------------------------
-- 5. medication_records — Medikationsübersicht als Dokumentation
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.medication_records (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  client_id         UUID        NOT NULL,
  catalog_item_id   UUID        REFERENCES public.medication_catalog_items(id) ON DELETE SET NULL,
  documented_name   TEXT        NOT NULL,
  dosage_note       TEXT,
  source_attribution TEXT       NOT NULL DEFAULT 'master_data'
    CHECK (source_attribution IN ('master_data', 'physician_statement', 'manual_entry')),
  is_active         BOOLEAN     NOT NULL DEFAULT TRUE,
  documentation_hint TEXT,
  recorded_by       UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  recorded_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_medication_records_tenant_client
  ON public.medication_records (tenant_id, client_id, recorded_at DESC);

-- --------------------------------------------------------------------------
-- 6. vital_sign_records — Vitalzeichen-Dokumentation (Pflege)
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.vital_sign_records (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  client_id         UUID        NOT NULL,
  sign_type         TEXT        NOT NULL
    CHECK (sign_type IN ('blood_pressure', 'pulse', 'temperature', 'weight', 'oxygen', 'respiratory_rate')),
  value_text        TEXT        NOT NULL,
  unit              TEXT,
  measured_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  documentation_hint TEXT,
  recorded_by       UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vital_sign_records_tenant_measured
  ON public.vital_sign_records (tenant_id, client_id, measured_at DESC);

-- --------------------------------------------------------------------------
-- 7. medical_documentation_notes — Ärztliche Angaben, Hinweise, Wundnotizen
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.medical_documentation_notes (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  client_id         UUID        NOT NULL,
  note_type         TEXT        NOT NULL
    CHECK (note_type IN (
      'physician_statement', 'diagnosis_documentation', 'medication_hint',
      'vital_hint', 'wound_documentation', 'general_documentation'
    )),
  title             TEXT,
  content           TEXT        NOT NULL,
  icd_code_id       UUID        REFERENCES public.icd_codes(id) ON DELETE SET NULL,
  icd_code_text     TEXT,
  is_physician_statement BOOLEAN NOT NULL DEFAULT FALSE,
  disclaimer_acknowledged BOOLEAN NOT NULL DEFAULT FALSE,
  recorded_by       UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  recorded_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_medical_documentation_notes_tenant
  ON public.medical_documentation_notes (tenant_id, client_id, recorded_at DESC);

-- --------------------------------------------------------------------------
-- 8. medical_catalog_import_jobs — Importläufe (nur mit gültiger Lizenz)
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.medical_catalog_import_jobs (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  source_id         UUID        NOT NULL REFERENCES public.medical_catalog_sources(id) ON DELETE CASCADE,
  version_id        UUID        REFERENCES public.medical_catalog_versions(id) ON DELETE SET NULL,
  job_status        TEXT        NOT NULL DEFAULT 'prepared'
    CHECK (job_status IN ('prepared', 'queued', 'running', 'blocked', 'completed', 'failed', 'cancelled')),
  license_verified  BOOLEAN     NOT NULL DEFAULT FALSE,
  record_count      INTEGER     NOT NULL DEFAULT 0,
  error_summary     TEXT,
  started_by        UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  started_at        TIMESTAMPTZ,
  finished_at       TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_medical_catalog_import_jobs_tenant
  ON public.medical_catalog_import_jobs (tenant_id, job_status);

-- --------------------------------------------------------------------------
-- 9. medical_audit_events — Append-only Audit (MDR/Dokumentation)
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.medical_audit_events (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  event_type        TEXT        NOT NULL
    CHECK (event_type IN (
      'icd_documented', 'medication_documented', 'vital_recorded',
      'catalog_search', 'catalog_import_blocked', 'license_check',
      'mdr_disclaimer_shown', 'blocked_function_attempt'
    )),
  summary           TEXT        NOT NULL,
  entity_type       TEXT,
  entity_id         UUID,
  metadata          JSONB       NOT NULL DEFAULT '{}'::jsonb,
  created_by        UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_medical_audit_events_tenant
  ON public.medical_audit_events (tenant_id, created_at DESC);

-- --------------------------------------------------------------------------
-- updated_at Trigger
-- --------------------------------------------------------------------------
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'medical_catalog_sources',
    'medical_catalog_versions',
    'icd_codes',
    'medication_catalog_items',
    'medication_records',
    'vital_sign_records',
    'medical_documentation_notes',
    'medical_catalog_import_jobs'
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
-- RLS
-- --------------------------------------------------------------------------
ALTER TABLE public.medical_catalog_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medical_catalog_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.icd_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medication_catalog_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medication_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vital_sign_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medical_documentation_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medical_catalog_import_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medical_audit_events ENABLE ROW LEVEL SECURITY;

-- Globale Katalog-Registry: lesbar für authentifizierte Nutzer
DROP POLICY IF EXISTS medical_catalog_sources_read ON public.medical_catalog_sources;
CREATE POLICY medical_catalog_sources_read ON public.medical_catalog_sources
  FOR SELECT TO authenticated USING (TRUE);

DROP POLICY IF EXISTS medical_catalog_versions_read ON public.medical_catalog_versions;
CREATE POLICY medical_catalog_versions_read ON public.medical_catalog_versions
  FOR SELECT TO authenticated USING (TRUE);

DROP POLICY IF EXISTS icd_codes_read ON public.icd_codes;
CREATE POLICY icd_codes_read ON public.icd_codes
  FOR SELECT TO authenticated USING (TRUE);

DROP POLICY IF EXISTS medication_catalog_items_read ON public.medication_catalog_items;
CREATE POLICY medication_catalog_items_read ON public.medication_catalog_items
  FOR SELECT TO authenticated USING (TRUE);

-- Mandantenspezifische Tabellen
DROP POLICY IF EXISTS medication_records_tenant ON public.medication_records;
CREATE POLICY medication_records_tenant ON public.medication_records
  FOR ALL TO authenticated
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS vital_sign_records_tenant ON public.vital_sign_records;
CREATE POLICY vital_sign_records_tenant ON public.vital_sign_records
  FOR ALL TO authenticated
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS medical_documentation_notes_tenant ON public.medical_documentation_notes;
CREATE POLICY medical_documentation_notes_tenant ON public.medical_documentation_notes
  FOR ALL TO authenticated
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS medical_catalog_import_jobs_tenant ON public.medical_catalog_import_jobs;
CREATE POLICY medical_catalog_import_jobs_tenant ON public.medical_catalog_import_jobs
  FOR ALL TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND public.is_connect_tenant_admin()
  )
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND public.is_connect_tenant_admin()
  );

DROP POLICY IF EXISTS medical_audit_events_tenant_select ON public.medical_audit_events;
CREATE POLICY medical_audit_events_tenant_select ON public.medical_audit_events
  FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS medical_audit_events_tenant_insert ON public.medical_audit_events;
CREATE POLICY medical_audit_events_tenant_insert ON public.medical_audit_events
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.current_tenant_id());

-- --------------------------------------------------------------------------
-- GRANTs
-- --------------------------------------------------------------------------
GRANT SELECT ON public.medical_catalog_sources TO authenticated;
GRANT SELECT ON public.medical_catalog_versions TO authenticated;
GRANT SELECT ON public.icd_codes TO authenticated;
GRANT SELECT ON public.medication_catalog_items TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.medication_records TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.vital_sign_records TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.medical_documentation_notes TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.medical_catalog_import_jobs TO authenticated;
GRANT SELECT, INSERT ON public.medical_audit_events TO authenticated;

-- --------------------------------------------------------------------------
-- Seed: Katalogquellen mit Lizenzstatus (keine geschützten DBs ohne Lizenz)
-- --------------------------------------------------------------------------
INSERT INTO public.medical_catalog_sources (
  source_key, label, description, license_status, is_search_enabled, is_import_enabled, mdr_risk_note
) VALUES
  (
    'icd10_gm', 'ICD-10-GM',
    'Diagnoseschlüssel — Kodierhilfe, Dokumentation als ärztliche Angabe',
    'public', TRUE, TRUE,
    'Kodierhilfe — keine Diagnoseentscheidung. MDR-Risiko bei automatischer Diagnosezuordnung.'
  ),
  (
    'snomed_ct', 'SNOMED CT',
    'Klinische Terminologie — Lizenz erforderlich',
    'licensed_required', FALSE, FALSE,
    'Nutzung nur mit gültiger SNOMED-Lizenz. Kein Medizinprodukt-Anspruch.'
  ),
  (
    'loinc', 'LOINC',
    'Labor-/Vitalwert-Codes — Lizenz erforderlich',
    'licensed_required', FALSE, FALSE,
    'Nur Dokumentationshilfe bei gültiger Lizenz.'
  ),
  (
    'ucum', 'UCUM',
    'Einheiten-Codes — öffentlich',
    'public', TRUE, TRUE,
    'Einheitenreferenz — keine klinische Bewertung.'
  ),
  (
    'atc_ddd', 'ATC/DDD',
    'WHO ATC/DDD — Lizenz erforderlich',
    'licensed_required', FALSE, FALSE,
    'Stammdatenreferenz — keine Therapieempfehlung.'
  ),
  (
    'pzn_ifa', 'PZN/IFA',
    'Pharmazentralnummer — Anbieter/Lizenz erforderlich',
    'provider_required', FALSE, FALSE,
    'Import nur mit IFA-Lizenz und Anbietervertrag.'
  ),
  (
    'rote_liste', 'Rote Liste',
    'ABDATA Rote Liste — geschützte Datenbank',
    'licensed_required', FALSE, FALSE,
    'Geschützte Datenbank — ohne Lizenz gesperrt.'
  ),
  (
    'abdata', 'ABDATA',
    'ABDATA Arzneimitteldaten — geschützte Datenbank',
    'disabled', FALSE, FALSE,
    'Ohne Lizenz deaktiviert — kein Import.'
  ),
  (
    'bfarm_am', 'BfArM Arzneimitteldaten',
    'Öffentliche BfArM-Stammdaten — Medikationsübersicht',
    'public', TRUE, TRUE,
    'Stammdatenübersicht — keine Medikationsentscheidung.'
  )
ON CONFLICT (source_key) DO NOTHING;

COMMENT ON TABLE public.medical_catalog_sources IS
  'Medizinische Katalogquellen mit Lizenzstatus — Dokumentationshilfe, kein Medizinprodukt';

COMMENT ON TABLE public.medical_documentation_notes IS
  'Dokumentationsnotizen inkl. ärztlicher Angabe — ersetzt keine medizinische Entscheidung';

COMMENT ON TABLE public.medical_audit_events IS
  'MDR-relevanter Audit-Trail — append-only, mandantenspezifisch';

COMMENT ON COLUMN public.medical_documentation_notes.is_physician_statement IS
  'TRUE wenn Diagnose als ärztliche Angabe dokumentiert — keine Systemdiagnose';
