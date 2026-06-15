-- ==========================================================================
-- CareSuite+ — Migration 0005: Mitarbeitende & Profil-Erweiterungen (WP 081–100)
-- Voraussetzung: 0001–0004
-- Entspricht src/types/modules/office.ts (Employee) + src/types/core/auth.ts (Profile)
-- ==========================================================================

-- --------------------------------------------------------------------------
-- profiles — optionale Felder ergänzen
-- --------------------------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS locale TEXT NOT NULL DEFAULT 'de';

-- --------------------------------------------------------------------------
-- employees
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.employees (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  profile_id  UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  first_name  TEXT        NOT NULL,
  last_name   TEXT        NOT NULL,
  job_title   TEXT,
  email       TEXT,
  phone       TEXT,
  department  TEXT,
  start_date  DATE,
  notes       TEXT,
  status      TEXT        NOT NULL DEFAULT 'aktiv'
              CHECK (status IN (
                'entwurf','aktiv','in_bearbeitung','abgeschlossen',
                'archiviert','fehlerhaft','gesperrt'
              )),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS set_employees_updated_at ON public.employees;
CREATE TRIGGER set_employees_updated_at
  BEFORE UPDATE ON public.employees
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- --------------------------------------------------------------------------
-- Berechtigung office.employees.view (synchron mit src/data/demo/permissions.ts)
-- --------------------------------------------------------------------------
INSERT INTO public.role_permissions (role_id, permission_key)
SELECT r.id, 'office.employees.view'
FROM public.roles r
WHERE r.key IN (
  'business_admin',
  'business_manager',
  'billing',
  'dispatch',
  'nurse',
  'caregiver',
  'counselor'
)
ON CONFLICT (role_id, permission_key) DO NOTHING;

-- --------------------------------------------------------------------------
-- RLS
-- --------------------------------------------------------------------------
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "employees_select_tenant" ON public.employees;
CREATE POLICY "employees_select_tenant"
  ON public.employees FOR SELECT
  USING (
    tenant_id = public.current_tenant_id()
    AND public.has_permission('office.employees.view')
  );

DROP POLICY IF EXISTS "employees_insert_tenant" ON public.employees;
CREATE POLICY "employees_insert_tenant"
  ON public.employees FOR INSERT
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND public.has_permission('office.employees.view')
    AND public.current_role_key() IN ('business_admin', 'business_manager')
  );

DROP POLICY IF EXISTS "employees_update_tenant" ON public.employees;
CREATE POLICY "employees_update_tenant"
  ON public.employees FOR UPDATE
  USING (
    tenant_id = public.current_tenant_id()
    AND public.current_role_key() IN ('business_admin', 'business_manager')
  );

-- --------------------------------------------------------------------------
-- GRANTs
-- --------------------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE ON public.employees TO authenticated;

-- --------------------------------------------------------------------------
-- Indizes
-- --------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_employees_tenant_id ON public.employees(tenant_id);
CREATE INDEX IF NOT EXISTS idx_employees_profile_id ON public.employees(profile_id);
CREATE INDEX IF NOT EXISTS idx_employees_status ON public.employees(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_employees_name ON public.employees(tenant_id, last_name, first_name);
