-- ==========================================================================
-- CareSuite+ — Migration 0084: tenant_billing_settings RLS für Mandanten-UI
-- /settings/tenant → Stundensatz speichern via business.tenant.manage
-- Pattern: 0078_tenant_settings_rls_live.sql
-- ==========================================================================

DROP POLICY IF EXISTS "tenant_billing_settings_insert_manage" ON public.tenant_billing_settings;
CREATE POLICY "tenant_billing_settings_insert_manage"
  ON public.tenant_billing_settings FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND public.has_permission('business.tenant.manage')
  );

DROP POLICY IF EXISTS "tenant_billing_settings_update_manage" ON public.tenant_billing_settings;
CREATE POLICY "tenant_billing_settings_update_manage"
  ON public.tenant_billing_settings FOR UPDATE TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND public.has_permission('business.tenant.manage')
  )
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND public.has_permission('business.tenant.manage')
  );
