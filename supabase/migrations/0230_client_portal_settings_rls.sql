-- Klient:innenportal K.1 — Portal-Defaults für Portalnutzer lesbar (ohne office.clients.view).
-- Root cause: tenant_client_portal_defaults / client_portal_settings SELECT required
-- has_permission('office.clients.view') — portal actors could not read seeded defaults
-- → "Portal-Defaults nicht gefunden." blocked profile and feature gates.

-- --------------------------------------------------------------------------
-- tenant_client_portal_defaults — portal self-read (visibility flags only)
-- --------------------------------------------------------------------------
DROP POLICY IF EXISTS tenant_client_portal_defaults_portal_self_select
  ON public.tenant_client_portal_defaults;

CREATE POLICY tenant_client_portal_defaults_portal_self_select
  ON public.tenant_client_portal_defaults
  FOR SELECT
  TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND public.is_client_portal_rls_context(tenant_id)
  );

COMMENT ON POLICY tenant_client_portal_defaults_portal_self_select
  ON public.tenant_client_portal_defaults IS
  'Portal actors read tenant portal visibility defaults for own tenant (K.1).';

-- --------------------------------------------------------------------------
-- client_portal_settings — portal self-read (per-client overrides)
-- --------------------------------------------------------------------------
DROP POLICY IF EXISTS client_portal_settings_portal_self_select
  ON public.client_portal_settings;

CREATE POLICY client_portal_settings_portal_self_select
  ON public.client_portal_settings
  FOR SELECT
  TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND client_id = public.current_client_id()
    AND public.is_client_portal_rls_context(tenant_id)
  );

COMMENT ON POLICY client_portal_settings_portal_self_select
  ON public.client_portal_settings IS
  'Portal actors read own client portal settings override (K.1).';

-- --------------------------------------------------------------------------
-- client_service_portal_settings — portal self-read (per service type)
-- --------------------------------------------------------------------------
DROP POLICY IF EXISTS client_service_portal_settings_portal_self_select
  ON public.client_service_portal_settings;

CREATE POLICY client_service_portal_settings_portal_self_select
  ON public.client_service_portal_settings
  FOR SELECT
  TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND client_id = public.current_client_id()
    AND public.is_client_portal_rls_context(tenant_id)
  );

COMMENT ON POLICY client_service_portal_settings_portal_self_select
  ON public.client_service_portal_settings IS
  'Portal actors read own per-service portal visibility (K.1).';

-- --------------------------------------------------------------------------
-- tenant_service_type_portal_rules — portal self-read (service feature rules)
-- --------------------------------------------------------------------------
DROP POLICY IF EXISTS tenant_service_type_portal_rules_portal_self_select
  ON public.tenant_service_type_portal_rules;

CREATE POLICY tenant_service_type_portal_rules_portal_self_select
  ON public.tenant_service_type_portal_rules
  FOR SELECT
  TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND public.is_client_portal_rls_context(tenant_id)
  );

COMMENT ON POLICY tenant_service_type_portal_rules_portal_self_select
  ON public.tenant_service_type_portal_rules IS
  'Portal actors read tenant service portal rules for feature resolution (K.1).';

-- Employee portal team calendar + colleague visibility (read-only).
DROP POLICY IF EXISTS assist_visits_portal_employee_team_select ON public.assist_visits;
CREATE POLICY assist_visits_portal_employee_team_select ON public.assist_visits
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND public.is_employee_portal_rls_context(tenant_id)
    AND employee_portal_visible = TRUE
    AND planning_status <> 'draft'
  );

DROP POLICY IF EXISTS employees_portal_team_select ON public.employees;
CREATE POLICY employees_portal_team_select ON public.employees
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND public.is_employee_portal_rls_context(tenant_id)
  );

DROP POLICY IF EXISTS calendar_events_portal_employee_team_select ON public.calendar_events;
CREATE POLICY calendar_events_portal_employee_team_select ON public.calendar_events
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND public.is_employee_portal_rls_context(tenant_id)
    AND is_employee_portal_visible = TRUE
    AND archived_at IS NULL
  );

DROP POLICY IF EXISTS clients_portal_employee_team_calendar_select ON public.clients;
CREATE POLICY clients_portal_employee_team_calendar_select ON public.clients
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND public.is_employee_portal_rls_context(tenant_id)
    AND id IN (
      SELECT v.client_id
      FROM public.assist_visits v
      WHERE v.tenant_id = public.current_tenant_id()
        AND v.employee_portal_visible = TRUE
        AND v.planning_status <> 'draft'
    )
  );
