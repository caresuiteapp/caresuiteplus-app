-- ==========================================================================
-- CareSuite+ — Migration 0049: Assignment Workflow Extensions (prepared)
-- schedule_entries, client_visit_requests, assignment_tasks metadata
-- ==========================================================================

CREATE TABLE IF NOT EXISTS public.schedule_entries (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  assignment_id   UUID        NOT NULL,
  employee_id     UUID        REFERENCES public.employees(id) ON DELETE SET NULL,
  client_id       UUID        NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  starts_at       TIMESTAMPTZ NOT NULL,
  ends_at         TIMESTAMPTZ NOT NULL,
  entry_type      TEXT        NOT NULL DEFAULT 'assignment',
  title           TEXT        NOT NULL,
  source          TEXT        NOT NULL DEFAULT 'assignment_sync',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, assignment_id)
);

CREATE INDEX IF NOT EXISTS idx_schedule_entries_tenant_starts
  ON public.schedule_entries (tenant_id, starts_at);

ALTER TABLE public.schedule_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS schedule_entries_tenant ON public.schedule_entries;
CREATE POLICY schedule_entries_tenant ON public.schedule_entries
  FOR ALL
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

CREATE TABLE IF NOT EXISTS public.client_visit_requests (
  id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  assignment_id           UUID        NOT NULL,
  client_id               UUID        NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  request_type            TEXT        NOT NULL CHECK (request_type IN ('cancel', 'reschedule')),
  status                  TEXT        NOT NULL DEFAULT 'pending',
  requested_by_profile_id UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  reason                  TEXT        NOT NULL,
  proposed_start_at       TIMESTAMPTZ,
  proposed_end_at         TIMESTAMPTZ,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at             TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_client_visit_requests_tenant
  ON public.client_visit_requests (tenant_id, assignment_id, status);

ALTER TABLE public.client_visit_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS client_visit_requests_tenant ON public.client_visit_requests;
CREATE POLICY client_visit_requests_tenant ON public.client_visit_requests
  FOR ALL
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

COMMENT ON TABLE public.schedule_entries IS 'Dienstplan-Einträge abgeleitet aus assignments — nicht freistehend';
COMMENT ON TABLE public.client_visit_requests IS 'Klient:innen-Absage/Verschiebung — ändert Einsatz nicht direkt';
