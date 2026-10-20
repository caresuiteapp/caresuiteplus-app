-- Office Termine page: remote missing public.appointments (0006 partially applied — invoices only).
-- PostgREST GET /rest/v1/appointments → 404 PGRST205 → "Datenbankfehler: Bitte erneut versuchen."
-- Pattern: 0006_appointments_invoices.sql + 0057/0060 GRANT idempotency.

CREATE TABLE IF NOT EXISTS public.appointments (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  title         TEXT        NOT NULL,
  client_name   TEXT,
  employee_name TEXT,
  location      TEXT,
  starts_at     TIMESTAMPTZ,
  ends_at       TIMESTAMPTZ,
  status        TEXT        NOT NULL DEFAULT 'entwurf'
                CHECK (status IN (
                  'entwurf','aktiv','in_bearbeitung','abgeschlossen',
                  'archiviert','fehlerhaft','gesperrt'
                )),
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS set_appointments_updated_at ON public.appointments;
CREATE TRIGGER set_appointments_updated_at
  BEFORE UPDATE ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "appointments_tenant" ON public.appointments;
CREATE POLICY "appointments_tenant"
  ON public.appointments FOR ALL TO authenticated
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

GRANT SELECT, INSERT, UPDATE ON public.appointments TO authenticated;

CREATE INDEX IF NOT EXISTS idx_appointments_tenant ON public.appointments(tenant_id, starts_at);
