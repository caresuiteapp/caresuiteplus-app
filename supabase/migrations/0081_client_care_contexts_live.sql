-- ==========================================================================
-- CareSuite+ — Migration 0081: client_care_contexts auf Live
-- Stammdaten-Bearbeitung: syncCareContexts → DELETE client_care_contexts 404
-- (PGRST205), weil Migration 0039 nie auf Live angewendet wurde.
-- Pattern: 0072_client_scheduling_wishes_and_address_fields.sql, 0061
-- ==========================================================================

CREATE TABLE IF NOT EXISTS public.client_care_contexts (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  client_id   UUID        NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  context_key TEXT        NOT NULL
              CHECK (context_key IN (
                'daily_assistance','support_care','companionship',
                'ambulatory_care','stationary_care','consulting','academy_prepared'
              )),
  is_primary  BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, client_id, context_key)
);

CREATE INDEX IF NOT EXISTS idx_client_care_contexts_client
  ON public.client_care_contexts (tenant_id, client_id);

ALTER TABLE public.client_care_contexts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "client_care_contexts_select_tenant" ON public.client_care_contexts;
CREATE POLICY "client_care_contexts_select_tenant"
  ON public.client_care_contexts FOR SELECT TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND public.has_permission('office.clients.view')
  );

DROP POLICY IF EXISTS "client_care_contexts_write_tenant" ON public.client_care_contexts;
CREATE POLICY "client_care_contexts_write_tenant"
  ON public.client_care_contexts FOR ALL TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND public.has_permission('office.clients.edit')
  )
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND public.has_permission('office.clients.edit')
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_care_contexts TO authenticated;
