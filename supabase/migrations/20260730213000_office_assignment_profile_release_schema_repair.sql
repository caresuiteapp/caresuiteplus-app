-- ==========================================================================
-- CareSuite HealthOS — Office/Assist Einsatzprofil-Direktfreigabe reparieren
-- ==========================================================================
-- R11 konnte auf älteren Production-Schemata als angewendet registriert sein,
-- obwohl einzelne Katalog- und Auditspalten der Assist-Tabellen fehlten.
-- Die PL/pgSQL-Funktion wird erst beim realen Drop vollständig vorbereitet;
-- deshalb trat der Fehler erst bei "Einsatz direkt freigeben" auf.

BEGIN;

DO $schema_guard$
BEGIN
  IF to_regclass('public.assist_visits') IS NULL THEN
    RAISE EXCEPTION 'R11-Reparatur nicht möglich: public.assist_visits fehlt';
  END IF;
  IF to_regclass('public.assist_visit_tasks') IS NULL THEN
    RAISE EXCEPTION 'R11-Reparatur nicht möglich: public.assist_visit_tasks fehlt';
  END IF;
  IF to_regclass('public.catalog_items') IS NULL THEN
    RAISE EXCEPTION 'R11-Reparatur nicht möglich: public.catalog_items fehlt';
  END IF;
END;
$schema_guard$;

ALTER TABLE public.assist_visits
  ADD COLUMN IF NOT EXISTS subject_key TEXT,
  ADD COLUMN IF NOT EXISTS assignment_type_key TEXT,
  ADD COLUMN IF NOT EXISTS service_category_key TEXT,
  ADD COLUMN IF NOT EXISTS task_package_id UUID
    REFERENCES public.catalog_items(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS billing_budget_source_key TEXT,
  ADD COLUMN IF NOT EXISTS documentation_template_key TEXT,
  ADD COLUMN IF NOT EXISTS proof_template_key TEXT,
  ADD COLUMN IF NOT EXISTS risk_flag_keys JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS catalog_snapshot_json JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS updated_by UUID
    REFERENCES public.profiles(id) ON DELETE SET NULL;

UPDATE public.assist_visits
SET
  risk_flag_keys = CASE
    WHEN risk_flag_keys IS NULL THEN '[]'::jsonb
    WHEN jsonb_typeof(risk_flag_keys) = 'array' THEN risk_flag_keys
    ELSE jsonb_build_array(risk_flag_keys)
  END,
  catalog_snapshot_json = CASE
    WHEN catalog_snapshot_json IS NULL THEN '{}'::jsonb
    WHEN jsonb_typeof(catalog_snapshot_json) = 'object' THEN catalog_snapshot_json
    ELSE jsonb_build_object('legacyValue', catalog_snapshot_json)
  END
WHERE risk_flag_keys IS NULL
   OR jsonb_typeof(risk_flag_keys) <> 'array'
   OR catalog_snapshot_json IS NULL
   OR jsonb_typeof(catalog_snapshot_json) <> 'object';

ALTER TABLE public.assist_visits
  ALTER COLUMN risk_flag_keys SET DEFAULT '[]'::jsonb,
  ALTER COLUMN risk_flag_keys SET NOT NULL,
  ALTER COLUMN catalog_snapshot_json SET DEFAULT '{}'::jsonb,
  ALTER COLUMN catalog_snapshot_json SET NOT NULL;

ALTER TABLE public.assist_visit_tasks
  ADD COLUMN IF NOT EXISTS catalog_item_id UUID
    REFERENCES public.catalog_items(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS item_key TEXT,
  ADD COLUMN IF NOT EXISTS is_optional BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS payload_json JSONB DEFAULT '{}'::jsonb;

UPDATE public.assist_visit_tasks
SET
  is_optional = COALESCE(is_optional, FALSE),
  payload_json = CASE
    WHEN payload_json IS NULL THEN '{}'::jsonb
    WHEN jsonb_typeof(payload_json) = 'object' THEN payload_json
    ELSE jsonb_build_object('legacyValue', payload_json)
  END
WHERE is_optional IS NULL
   OR payload_json IS NULL
   OR jsonb_typeof(payload_json) <> 'object';

ALTER TABLE public.assist_visit_tasks
  ALTER COLUMN is_optional SET DEFAULT FALSE,
  ALTER COLUMN is_optional SET NOT NULL,
  ALTER COLUMN payload_json SET DEFAULT '{}'::jsonb,
  ALTER COLUMN payload_json SET NOT NULL;

ALTER TABLE public.assist_visits
  DROP CONSTRAINT IF EXISTS assist_visits_r11_risk_flags_array,
  DROP CONSTRAINT IF EXISTS assist_visits_r11_catalog_snapshot_object;

ALTER TABLE public.assist_visits
  ADD CONSTRAINT assist_visits_r11_risk_flags_array
    CHECK (jsonb_typeof(risk_flag_keys) = 'array'),
  ADD CONSTRAINT assist_visits_r11_catalog_snapshot_object
    CHECK (jsonb_typeof(catalog_snapshot_json) = 'object');

ALTER TABLE public.assist_visit_tasks
  DROP CONSTRAINT IF EXISTS assist_visit_tasks_r11_payload_object;

ALTER TABLE public.assist_visit_tasks
  ADD CONSTRAINT assist_visit_tasks_r11_payload_object
    CHECK (jsonb_typeof(payload_json) = 'object');

CREATE INDEX IF NOT EXISTS idx_assist_visits_r11_assignment_profile
  ON public.assist_visits (
    tenant_id,
    ((catalog_snapshot_json ->> 'assignmentProfileId'))
  )
  WHERE catalog_snapshot_json ? 'assignmentProfileId';

GRANT SELECT, INSERT, UPDATE ON public.assist_visits TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.assist_visit_tasks TO authenticated;

COMMENT ON COLUMN public.assist_visits.catalog_snapshot_json IS
  'Unveränderlicher Katalog- und Einsatzprofil-Snapshot bei Direktfreigabe.';
COMMENT ON COLUMN public.assist_visit_tasks.payload_json IS
  'Aufgabenmetadaten aus dem Office-Einsatzprofil bei Direktfreigabe.';

NOTIFY pgrst, 'reload schema';

COMMIT;
