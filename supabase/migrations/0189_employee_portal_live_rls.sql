-- Employee portal live data: self-read RLS for profile, scoped assignments/tasks.

-- Fresh-DB: production assignments columns + enums expected by 0197+ portal sync
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'assignment_status' AND typnamespace = 'public'::regnamespace) THEN
    CREATE TYPE public.assignment_status AS ENUM (
      'planned', 'confirmed', 'on_the_way', 'arrived', 'started', 'paused',
      'finished', 'documentation_open', 'signature_open', 'completed',
      'cancelled', 'no_show', 'scheduled', 'entwurf'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'product_key' AND typnamespace = 'public'::regnamespace) THEN
    CREATE TYPE public.product_key AS ENUM (
      'office', 'assist', 'pflege', 'stationaer', 'beratung', 'akademie'
    );
  END IF;
END $$;

ALTER TABLE public.assignments ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL;
ALTER TABLE public.assignments ADD COLUMN IF NOT EXISTS employee_id UUID REFERENCES public.employees(id) ON DELETE SET NULL;
ALTER TABLE public.assignments ADD COLUMN IF NOT EXISTS assignment_date DATE;
ALTER TABLE public.assignments ADD COLUMN IF NOT EXISTS planned_start_at TIMESTAMPTZ;
ALTER TABLE public.assignments ADD COLUMN IF NOT EXISTS planned_end_at TIMESTAMPTZ;
ALTER TABLE public.assignments ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.assignments ADD COLUMN IF NOT EXISTS address_snapshot TEXT;
ALTER TABLE public.assignments ADD COLUMN IF NOT EXISTS internal_notes TEXT;
ALTER TABLE public.assignments ADD COLUMN IF NOT EXISTS client_visible_notes TEXT;
ALTER TABLE public.assignments ADD COLUMN IF NOT EXISTS product_key public.product_key;
ALTER TABLE public.assignments ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.assignments ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.assignments ADD COLUMN IF NOT EXISTS actual_start_at TIMESTAMPTZ;
ALTER TABLE public.assignments ADD COLUMN IF NOT EXISTS actual_end_at TIMESTAMPTZ;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'assignments'
      AND column_name = 'status' AND udt_name = 'text'
  ) THEN
    ALTER TABLE public.assignments ALTER COLUMN status DROP DEFAULT;
    ALTER TABLE public.assignments
      ALTER COLUMN status TYPE public.assignment_status
      USING (
        CASE trim(status)
          WHEN 'entwurf' THEN 'planned'::public.assignment_status
          WHEN 'geplant' THEN 'planned'::public.assignment_status
          ELSE trim(status)::public.assignment_status
        END
      );
    ALTER TABLE public.assignments
      ALTER COLUMN status SET DEFAULT 'planned'::public.assignment_status;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.assignment_tasks (
  id                        UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                 UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  assignment_id             UUID        NOT NULL REFERENCES public.assignments(id) ON DELETE CASCADE,
  title                     TEXT        NOT NULL,
  status                    TEXT        NOT NULL DEFAULT 'open',
  is_required               BOOLEAN     NOT NULL DEFAULT TRUE,
  requires_note_if_not_done BOOLEAN     NOT NULL DEFAULT FALSE,
  not_done_reason           TEXT,
  sort_order                INTEGER     NOT NULL DEFAULT 0,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_assignment_tasks_tenant_assignment
  ON public.assignment_tasks (tenant_id, assignment_id);

ALTER TABLE public.assignment_tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS employees_portal_self_select ON public.employees;
CREATE POLICY employees_portal_self_select ON public.employees
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND id = public.resolve_current_employee_id()
    AND public.current_role_key() = 'employee_portal'
  );

DROP POLICY IF EXISTS assignments_portal_employee_select ON public.assignments;
CREATE POLICY assignments_portal_employee_select ON public.assignments
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND employee_id = public.resolve_current_employee_id()
    AND public.current_role_key() = 'employee_portal'
  );

DROP POLICY IF EXISTS assignments_portal_employee_update ON public.assignments;
CREATE POLICY assignments_portal_employee_update ON public.assignments
  FOR UPDATE TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND employee_id = public.resolve_current_employee_id()
    AND public.current_role_key() = 'employee_portal'
  )
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND employee_id = public.resolve_current_employee_id()
  );

DROP POLICY IF EXISTS assignment_tasks_portal_employee_select ON public.assignment_tasks;
CREATE POLICY assignment_tasks_portal_employee_select ON public.assignment_tasks
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND public.current_role_key() = 'employee_portal'
    AND assignment_id IN (
      SELECT a.id
      FROM public.assignments a
      WHERE a.tenant_id = public.current_tenant_id()
        AND a.employee_id = public.resolve_current_employee_id()
    )
  );

DROP POLICY IF EXISTS assignment_tasks_portal_employee_update ON public.assignment_tasks;
CREATE POLICY assignment_tasks_portal_employee_update ON public.assignment_tasks
  FOR UPDATE TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND public.current_role_key() = 'employee_portal'
    AND assignment_id IN (
      SELECT a.id
      FROM public.assignments a
      WHERE a.tenant_id = public.current_tenant_id()
        AND a.employee_id = public.resolve_current_employee_id()
    )
  )
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND public.current_role_key() = 'employee_portal'
  );

ALTER TABLE public.client_contacts
  ADD COLUMN IF NOT EXISTS is_emergency_contact BOOLEAN NOT NULL DEFAULT FALSE;

DROP POLICY IF EXISTS client_contacts_portal_employee_emergency_select ON public.client_contacts;
CREATE POLICY client_contacts_portal_employee_emergency_select ON public.client_contacts
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND public.current_role_key() = 'employee_portal'
    AND is_emergency_contact = TRUE
    AND client_id IN (
      SELECT a.client_id
      FROM public.assignments a
      WHERE a.tenant_id = public.current_tenant_id()
        AND a.employee_id = public.resolve_current_employee_id()
    )
  );

COMMENT ON POLICY employees_portal_self_select ON public.employees IS
  'Employee portal users read their own employee record for profile view.';
COMMENT ON POLICY assignments_portal_employee_select ON public.assignments IS
  'Employee portal users read assignments assigned to them.';
COMMENT ON POLICY assignments_portal_employee_update ON public.assignments IS
  'Employee portal users update status on their own assignments during execution.';
