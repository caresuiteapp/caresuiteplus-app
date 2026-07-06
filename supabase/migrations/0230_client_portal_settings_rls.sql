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
