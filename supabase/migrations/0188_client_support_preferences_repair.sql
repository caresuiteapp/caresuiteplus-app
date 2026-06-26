-- ==========================================================================
-- CareSuite+ — Migration 0188: client_support_preferences live repair
-- Table from 0039 was missing on live; portal RLS remainder from 0182.
-- ==========================================================================

CREATE TABLE IF NOT EXISTS public.client_support_preferences (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  client_id           UUID        NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE UNIQUE,
  support_wishes      TEXT[]      NOT NULL DEFAULT '{}',
  preferred_times     TEXT[]      NOT NULL DEFAULT '{}',
  excluded_times      TEXT[]      NOT NULL DEFAULT '{}',
  mobility            TEXT,
  orientation         TEXT,
  communication       TEXT,
  special_wishes      TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.client_support_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS client_support_preferences_select ON public.client_support_preferences;
CREATE POLICY client_support_preferences_select ON public.client_support_preferences
  FOR SELECT
  USING (
    tenant_id = public.current_tenant_id()
    AND public.has_permission('office.clients.view')
  );

DROP POLICY IF EXISTS client_support_preferences_write ON public.client_support_preferences;
CREATE POLICY client_support_preferences_write ON public.client_support_preferences
  FOR ALL
  USING (
    tenant_id = public.current_tenant_id()
    AND public.has_permission('office.clients.edit')
  )
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND public.has_permission('office.clients.edit')
  );

DROP POLICY IF EXISTS client_support_preferences_portal_self_select ON public.client_support_preferences;
CREATE POLICY client_support_preferences_portal_self_select ON public.client_support_preferences
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND client_id = public.current_client_id()
    AND public.current_client_id() IS NOT NULL
  );

COMMENT ON POLICY client_support_preferences_portal_self_select ON public.client_support_preferences IS
  'Portal users read communication preference for profile contact section.';
