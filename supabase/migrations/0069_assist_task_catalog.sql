-- CareSuite+ Assist: Erweiterung client_tasks + Referenztabellen für Aufgabenkatalog

-- Referenz: Aufgabenpakete (Ebene 2)
CREATE TABLE IF NOT EXISTS public.assist_task_packages (
  id              TEXT        PRIMARY KEY,
  key             TEXT        NOT NULL UNIQUE,
  title           TEXT        NOT NULL,
  description     TEXT,
  leistungsbereich TEXT       NOT NULL,
  module_area     TEXT        NOT NULL,
  sort_order      INTEGER     NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Referenz: Einzelaufgaben-Vorlagen (Ebene 3)
CREATE TABLE IF NOT EXISTS public.assist_task_templates (
  id                      TEXT        PRIMARY KEY,
  package_id              TEXT        NOT NULL REFERENCES public.assist_task_packages(id) ON DELETE CASCADE,
  leistungsbereich        TEXT        NOT NULL,
  subcategory             TEXT        NOT NULL,
  module_area             TEXT        NOT NULL,
  title                   TEXT        NOT NULL,
  description             TEXT,
  leistungsart            TEXT        NOT NULL,
  planned_duration_minutes INTEGER    NOT NULL DEFAULT 15,
  is_mandatory            BOOLEAN     NOT NULL DEFAULT FALSE,
  proof_required          BOOLEAN     NOT NULL DEFAULT FALSE,
  documentation_required  BOOLEAN     NOT NULL DEFAULT TRUE,
  billing_relevant        BOOLEAN     NOT NULL DEFAULT TRUE,
  visible_to_client       BOOLEAN     NOT NULL DEFAULT TRUE,
  sort_order              INTEGER     NOT NULL DEFAULT 0,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_assist_task_templates_package ON public.assist_task_templates(package_id);

-- client_tasks: Assist-Metadaten
ALTER TABLE public.client_tasks
  ADD COLUMN IF NOT EXISTS module_key TEXT DEFAULT 'assist'
    CHECK (module_key IS NULL OR module_key IN ('assist', 'pflege', 'general')),
  ADD COLUMN IF NOT EXISTS leistungsbereich TEXT,
  ADD COLUMN IF NOT EXISTS subcategory TEXT,
  ADD COLUMN IF NOT EXISTS package_id TEXT,
  ADD COLUMN IF NOT EXISTS leistungsart TEXT,
  ADD COLUMN IF NOT EXISTS is_mandatory BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS proof_required BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS documentation_required BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS billing_relevant BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS visible_to_client BOOLEAN NOT NULL DEFAULT TRUE;

CREATE INDEX IF NOT EXISTS idx_client_tasks_package ON public.client_tasks(package_id);
CREATE INDEX IF NOT EXISTS idx_client_tasks_leistungsbereich ON public.client_tasks(leistungsbereich);

-- RLS für Referenztabellen (read-only für authenticated)
ALTER TABLE public.assist_task_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assist_task_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS assist_task_packages_select ON public.assist_task_packages;
CREATE POLICY assist_task_packages_select ON public.assist_task_packages
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS assist_task_templates_select ON public.assist_task_templates;
CREATE POLICY assist_task_templates_select ON public.assist_task_templates
  FOR SELECT TO authenticated USING (true);

GRANT SELECT ON public.assist_task_packages, public.assist_task_templates TO authenticated;
