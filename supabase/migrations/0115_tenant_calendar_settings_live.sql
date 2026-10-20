-- ==========================================================================
-- CareSuite+ — Migration 0115: tenant_calendar_settings (Office/Assist Kalender)
-- Mandantenweite Kalenderansicht-Einstellungen (JSON)
-- Pattern: 0084_tenant_billing_settings_rls_live.sql
-- ==========================================================================

CREATE TABLE IF NOT EXISTS public.tenant_calendar_settings (
  tenant_id   UUID PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
  settings    JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.tenant_calendar_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_calendar_settings_select_tenant" ON public.tenant_calendar_settings;
CREATE POLICY "tenant_calendar_settings_select_tenant"
  ON public.tenant_calendar_settings FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS "tenant_calendar_settings_insert_manage" ON public.tenant_calendar_settings;
CREATE POLICY "tenant_calendar_settings_insert_manage"
  ON public.tenant_calendar_settings FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND public.has_permission('business.tenant.manage')
  );

DROP POLICY IF EXISTS "tenant_calendar_settings_update_manage" ON public.tenant_calendar_settings;
CREATE POLICY "tenant_calendar_settings_update_manage"
  ON public.tenant_calendar_settings FOR UPDATE TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND public.has_permission('business.tenant.manage')
  )
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND public.has_permission('business.tenant.manage')
  );

GRANT SELECT, INSERT, UPDATE ON public.tenant_calendar_settings TO authenticated;

DROP TRIGGER IF EXISTS set_tenant_calendar_settings_updated_at ON public.tenant_calendar_settings;
CREATE TRIGGER set_tenant_calendar_settings_updated_at
  BEFORE UPDATE ON public.tenant_calendar_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_tenant_calendar_settings_tenant
  ON public.tenant_calendar_settings(tenant_id);
