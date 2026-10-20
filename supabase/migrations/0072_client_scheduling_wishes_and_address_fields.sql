-- CareSuite+ — Einsatz-Wünsche (Terminpräferenzen) + erweiterte Adressfelder
-- Voraussetzung: 0010 / 0061 client_addresses

ALTER TABLE public.client_addresses
  ADD COLUMN IF NOT EXISTS apartment_number TEXT;

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS apartment_number TEXT;

CREATE TABLE IF NOT EXISTS public.client_scheduling_wishes (
  id                        UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                 UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  client_id                 UUID        NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE UNIQUE,
  preferred_days            TEXT[]      NOT NULL DEFAULT '{}',
  preferred_time_slots      TEXT[]      NOT NULL DEFAULT '{}',
  time_from                 TEXT,
  time_to                   TEXT,
  preferred_employee_gender TEXT
                            CHECK (preferred_employee_gender IS NULL OR preferred_employee_gender IN ('männlich','weiblich','egal')),
  hours_per_assignment      NUMERIC(4, 1),
  assignments_per_week      INTEGER
                            CHECK (assignments_per_week IS NULL OR assignments_per_week >= 0),
  assignments_per_month     INTEGER
                            CHECK (assignments_per_month IS NULL OR assignments_per_month >= 0),
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_client_scheduling_wishes_tenant_client
  ON public.client_scheduling_wishes (tenant_id, client_id);

ALTER TABLE public.client_scheduling_wishes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "client_scheduling_wishes_select_tenant" ON public.client_scheduling_wishes;
CREATE POLICY "client_scheduling_wishes_select_tenant"
  ON public.client_scheduling_wishes FOR SELECT TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND public.has_permission('office.clients.view')
  );

DROP POLICY IF EXISTS "client_scheduling_wishes_write_tenant" ON public.client_scheduling_wishes;
CREATE POLICY "client_scheduling_wishes_write_tenant"
  ON public.client_scheduling_wishes FOR ALL TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND public.has_permission('office.clients.edit')
  )
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND public.has_permission('office.clients.edit')
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_scheduling_wishes TO authenticated;
