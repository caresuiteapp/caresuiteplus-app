-- P0: separate internal Office/Assist sessions from portal sessions.
--
-- PostgreSQL combines permissive policies with OR. Historical tenant-wide
-- policies therefore overruled later employee/client portal policies after
-- portal accounts became valid tenant members. The result could be tenant-wide
-- reads from a portal session and misleading visit/client data.

CREATE OR REPLACE FUNCTION public.is_internal_tenant_actor(p_tenant_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    COALESCE(public.current_role_key(), '') NOT IN (
      'employee_portal',
      'client_portal',
      'family_portal'
    )
    AND (
      EXISTS (
        SELECT 1
        FROM public.profiles p
        WHERE (p.id = auth.uid() OR p.auth_user_id = auth.uid())
          AND p.tenant_id = p_tenant_id
      )
      OR EXISTS (
        SELECT 1
        FROM public.tenant_memberships tm
        WHERE tm.user_id = auth.uid()
          AND tm.tenant_id = p_tenant_id
          AND tm.is_active = TRUE
      )
    )
$$;

REVOKE ALL ON FUNCTION public.is_internal_tenant_actor(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_internal_tenant_actor(UUID) TO authenticated;

-- Legacy Assist tables from 0007: internal access only. Dedicated portal
-- policies below remain responsible for employee/client access.
DO $$
DECLARE
  table_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'assignments',
    'care_records',
    'trips',
    'catalogs',
    'integration_providers',
    'ocr_jobs'
  ]
  LOOP
    IF to_regclass('public.' || table_name) IS NOT NULL THEN
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', table_name || '_tenant', table_name);
      EXECUTE format(
        'CREATE POLICY %I ON public.%I
           FOR ALL TO authenticated
           USING (
             tenant_id = public.current_tenant_id()
             AND public.is_internal_tenant_actor(tenant_id)
           )
           WITH CHECK (
             tenant_id = public.current_tenant_id()
             AND public.is_internal_tenant_actor(tenant_id)
           )',
        table_name || '_tenant',
        table_name
      );
    END IF;
  END LOOP;
END
$$;

DROP POLICY IF EXISTS assist_visits_tenant ON public.assist_visits;
CREATE POLICY assist_visits_tenant ON public.assist_visits
  FOR ALL TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND public.is_internal_tenant_actor(tenant_id)
  )
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND public.is_internal_tenant_actor(tenant_id)
  );

DROP POLICY IF EXISTS assist_visit_tasks_tenant ON public.assist_visit_tasks;
CREATE POLICY assist_visit_tasks_tenant ON public.assist_visit_tasks
  FOR ALL TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND public.is_internal_tenant_actor(tenant_id)
  )
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND public.is_internal_tenant_actor(tenant_id)
  );

DROP POLICY IF EXISTS assist_visit_status_history_tenant ON public.assist_visit_status_history;
CREATE POLICY assist_visit_status_history_tenant ON public.assist_visit_status_history
  FOR ALL TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND public.is_internal_tenant_actor(tenant_id)
  )
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND public.is_internal_tenant_actor(tenant_id)
  );

DROP POLICY IF EXISTS assist_visit_budget_snapshots_tenant
  ON public.assist_visit_budget_snapshots;
CREATE POLICY assist_visit_budget_snapshots_tenant
  ON public.assist_visit_budget_snapshots
  FOR ALL TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND public.is_internal_tenant_actor(tenant_id)
  )
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND public.is_internal_tenant_actor(tenant_id)
  );

DROP POLICY IF EXISTS assist_visit_billing_snapshots_tenant
  ON public.assist_visit_billing_snapshots;
CREATE POLICY assist_visit_billing_snapshots_tenant
  ON public.assist_visit_billing_snapshots
  FOR ALL TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND public.is_internal_tenant_actor(tenant_id)
  )
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND public.is_internal_tenant_actor(tenant_id)
  );

DROP POLICY IF EXISTS assist_visit_audit_logs_tenant ON public.assist_visit_audit_logs;
CREATE POLICY assist_visit_audit_logs_tenant ON public.assist_visit_audit_logs
  FOR ALL TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND public.is_internal_tenant_actor(tenant_id)
  )
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND public.is_internal_tenant_actor(tenant_id)
  );

-- The employee detail/history view may read history only for its own visits.
DROP POLICY IF EXISTS assist_visit_status_history_portal_employee_select
  ON public.assist_visit_status_history;
CREATE POLICY assist_visit_status_history_portal_employee_select
  ON public.assist_visit_status_history
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND public.current_role_key() = 'employee_portal'
    AND visit_id IN (
      SELECT v.id
      FROM public.assist_visits v
      WHERE v.tenant_id = public.current_tenant_id()
        AND v.employee_id = public.resolve_current_employee_id()
        AND v.planning_status <> 'draft'
    )
  );

-- Office master data policies must not inherit permissions from a linked
-- owner/admin profile while the current token is a portal token.
DROP POLICY IF EXISTS "clients_select_tenant" ON public.clients;
CREATE POLICY "clients_select_tenant" ON public.clients
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND public.is_internal_tenant_actor(tenant_id)
    AND public.has_permission('office.clients.view')
  );

DROP POLICY IF EXISTS "clients_insert_tenant" ON public.clients;
CREATE POLICY "clients_insert_tenant" ON public.clients
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND public.is_internal_tenant_actor(tenant_id)
    AND public.has_permission('office.clients.create')
  );

DROP POLICY IF EXISTS "clients_update_tenant" ON public.clients;
CREATE POLICY "clients_update_tenant" ON public.clients
  FOR UPDATE TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND public.is_internal_tenant_actor(tenant_id)
    AND public.can_manage_clients_for_current_tenant()
  )
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND public.is_internal_tenant_actor(tenant_id)
    AND public.can_manage_clients_for_current_tenant()
  );

DROP POLICY IF EXISTS "clients_soft_delete_tenant" ON public.clients;
CREATE POLICY "clients_soft_delete_tenant" ON public.clients
  FOR UPDATE TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND public.is_internal_tenant_actor(tenant_id)
    AND (
      public.has_permission('office.clients.delete')
      OR public.is_tenant_admin()
    )
  )
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND public.is_internal_tenant_actor(tenant_id)
    AND status = 'deleted'
    AND (
      public.has_permission('office.clients.delete')
      OR public.is_tenant_admin()
    )
  );

DROP POLICY IF EXISTS clients_admin_manage_own_tenant ON public.clients;
CREATE POLICY clients_admin_manage_own_tenant ON public.clients
  FOR ALL TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND public.is_internal_tenant_actor(tenant_id)
    AND public.is_tenant_admin()
  )
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND public.is_internal_tenant_actor(tenant_id)
    AND public.is_tenant_admin()
  );

DROP POLICY IF EXISTS "employees_select_tenant" ON public.employees;
CREATE POLICY "employees_select_tenant" ON public.employees
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND public.is_internal_tenant_actor(tenant_id)
    AND (
      public.has_permission('office.employees.view')
      OR public.has_permission('assist.assignments.manage')
    )
  );

DROP POLICY IF EXISTS "employees_insert_tenant" ON public.employees;
CREATE POLICY "employees_insert_tenant" ON public.employees
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND public.is_internal_tenant_actor(tenant_id)
    AND public.has_permission('office.employees.create')
  );

DROP POLICY IF EXISTS "employees_update_tenant" ON public.employees;
CREATE POLICY "employees_update_tenant" ON public.employees
  FOR UPDATE TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND public.is_internal_tenant_actor(tenant_id)
    AND public.has_permission('office.employees.edit')
  )
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND public.is_internal_tenant_actor(tenant_id)
    AND public.has_permission('office.employees.edit')
  );

DROP POLICY IF EXISTS "employees_soft_delete_tenant" ON public.employees;
CREATE POLICY "employees_soft_delete_tenant" ON public.employees
  FOR UPDATE TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND public.is_internal_tenant_actor(tenant_id)
    AND (
      public.has_permission('office.employees.delete')
      OR public.is_tenant_admin()
    )
  )
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND public.is_internal_tenant_actor(tenant_id)
    AND status = 'deleted'
    AND (
      public.has_permission('office.employees.delete')
      OR public.is_tenant_admin()
    )
  );

DROP POLICY IF EXISTS employees_admin_manage_own_tenant ON public.employees;
CREATE POLICY employees_admin_manage_own_tenant ON public.employees
  FOR ALL TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND public.is_internal_tenant_actor(tenant_id)
    AND public.is_tenant_admin()
  )
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND public.is_internal_tenant_actor(tenant_id)
    AND public.is_tenant_admin()
  );

COMMENT ON FUNCTION public.is_internal_tenant_actor(UUID) IS
  'Separates internal Office/Assist sessions from employee/client/family portal tokens.';

-- Fail the deployment visibly if a core policy was not recreated as intended.
DO $$
BEGIN
  IF to_regprocedure('public.is_internal_tenant_actor(uuid)') IS NULL THEN
    RAISE EXCEPTION 'P0 verification failed: internal actor function missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'assignments'
      AND policyname = 'assignments_tenant'
      AND COALESCE(qual, '') LIKE '%is_internal_tenant_actor%'
  ) THEN
    RAISE EXCEPTION 'P0 verification failed: assignments internal policy missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'assist_visits'
      AND policyname = 'assist_visits_tenant'
      AND COALESCE(qual, '') LIKE '%is_internal_tenant_actor%'
  ) THEN
    RAISE EXCEPTION 'P0 verification failed: assist_visits internal policy missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'assist_visits'
      AND policyname = 'assist_visits_portal_employee_select'
  ) THEN
    RAISE EXCEPTION 'P0 verification failed: employee visit policy missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'clients'
      AND policyname = 'clients_update_tenant'
      AND COALESCE(qual, '') LIKE '%is_internal_tenant_actor%'
  ) THEN
    RAISE EXCEPTION 'P0 verification failed: client update policy missing';
  END IF;
END
$$;

NOTIFY pgrst, 'reload schema';
