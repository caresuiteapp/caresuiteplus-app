-- ==========================================================================
-- CareSuite+ — Migration 0215: Employee personnel documents repair (prod drift)
-- Restores employee_documents + related 0132 tables missing on production.
-- Adds employees.cost_center from 0132 if absent.
-- ==========================================================================

ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS cost_center TEXT;

CREATE TABLE IF NOT EXISTS public.employee_qualifications (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  employee_id           UUID        NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  qualification_type    TEXT        NOT NULL,
  title                 TEXT        NOT NULL,
  issuing_organization  TEXT,
  issued_at             DATE,
  valid_until           DATE,
  document_id           UUID,
  verified_by           TEXT,
  verified_at           TIMESTAMPTZ,
  status                TEXT        NOT NULL DEFAULT 'pending_review'
                        CHECK (status IN (
                          'valid','expires_soon','expired','missing','pending_review','rejected'
                        )),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.employee_background_checks (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  employee_id     UUID        NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  present         BOOLEAN     NOT NULL DEFAULT FALSE,
  issue_date      DATE,
  verified_at     TIMESTAMPTZ,
  verified_by     TEXT,
  follow_up_due_at DATE,
  status          TEXT        NOT NULL DEFAULT 'missing'
                  CHECK (status IN (
                    'not_required','missing','requested','submitted','verified','expired','rejected'
                  )),
  document_id     UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, employee_id)
);

CREATE TABLE IF NOT EXISTS public.employee_documents (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  employee_id         UUID        NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  category            TEXT        NOT NULL DEFAULT 'other',
  title               TEXT        NOT NULL,
  file_name           TEXT        NOT NULL,
  storage_path        TEXT,
  sensitive           BOOLEAN     NOT NULL DEFAULT FALSE,
  released_to_portal  BOOLEAN     NOT NULL DEFAULT FALSE,
  valid_until         DATE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_employee_qualifications_tenant_employee
  ON public.employee_qualifications (tenant_id, employee_id);

CREATE INDEX IF NOT EXISTS idx_employee_documents_tenant_employee
  ON public.employee_documents (tenant_id, employee_id);

ALTER TABLE public.employee_qualifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_background_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS employee_qualifications_tenant ON public.employee_qualifications;
CREATE POLICY employee_qualifications_tenant ON public.employee_qualifications
  FOR ALL TO authenticated
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS employee_background_checks_tenant ON public.employee_background_checks;
CREATE POLICY employee_background_checks_tenant ON public.employee_background_checks
  FOR ALL TO authenticated
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS employee_documents_tenant ON public.employee_documents;
CREATE POLICY employee_documents_tenant ON public.employee_documents
  FOR ALL TO authenticated
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.employee_qualifications TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.employee_background_checks TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.employee_documents TO authenticated;

COMMENT ON TABLE public.employee_documents IS 'Personalakte — Mitarbeiterdokumente (live)';
