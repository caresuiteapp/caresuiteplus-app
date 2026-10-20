-- ==========================================================================
-- CareSuite+ — Migration 0006: Office Termine & Rechnungen (WP 201–240)
-- ==========================================================================

CREATE TABLE IF NOT EXISTS public.appointments (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  title       TEXT        NOT NULL,
  client_name TEXT,
  employee_name TEXT,
  location    TEXT,
  starts_at   TIMESTAMPTZ,
  ends_at     TIMESTAMPTZ,
  status      TEXT        NOT NULL DEFAULT 'entwurf'
              CHECK (status IN (
                'entwurf','aktiv','in_bearbeitung','abgeschlossen',
                'archiviert','fehlerhaft','gesperrt'
              )),
  notes       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.invoices (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  title         TEXT        NOT NULL,
  invoice_number TEXT,
  client_name   TEXT,
  total_cents   INTEGER     NOT NULL DEFAULT 0,
  status        TEXT        NOT NULL DEFAULT 'entwurf'
                CHECK (status IN (
                  'entwurf','aktiv','in_bearbeitung','abgeschlossen',
                  'archiviert','fehlerhaft','gesperrt'
                )),
  due_date      DATE,
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS set_appointments_updated_at ON public.appointments;
CREATE TRIGGER set_appointments_updated_at
  BEFORE UPDATE ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_invoices_updated_at ON public.invoices;
CREATE TRIGGER set_invoices_updated_at
  BEFORE UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "appointments_tenant" ON public.appointments;
CREATE POLICY "appointments_tenant"
  ON public.appointments FOR ALL
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS "invoices_tenant" ON public.invoices;
CREATE POLICY "invoices_tenant"
  ON public.invoices FOR ALL
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

GRANT SELECT, INSERT, UPDATE ON public.appointments TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.invoices TO authenticated;

CREATE INDEX IF NOT EXISTS idx_appointments_tenant ON public.appointments(tenant_id, starts_at);
CREATE INDEX IF NOT EXISTS idx_invoices_tenant ON public.invoices(tenant_id, status);
