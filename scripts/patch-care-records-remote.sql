CREATE TABLE IF NOT EXISTS public.care_records (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  title       TEXT        NOT NULL,
  status      TEXT        NOT NULL DEFAULT 'entwurf',
  client_name TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS set_care_records_updated_at ON public.care_records;
CREATE TRIGGER set_care_records_updated_at
  BEFORE UPDATE ON public.care_records
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.care_records ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS care_records_tenant ON public.care_records;
CREATE POLICY care_records_tenant ON public.care_records
  FOR ALL USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());
GRANT SELECT, INSERT, UPDATE ON public.care_records TO authenticated;
CREATE INDEX IF NOT EXISTS idx_care_records_tenant ON public.care_records(tenant_id, status);

ALTER TABLE public.care_records
  ADD COLUMN IF NOT EXISTS record_type TEXT DEFAULT 'care_note',
  ADD COLUMN IF NOT EXISTS first_name TEXT,
  ADD COLUMN IF NOT EXISTS last_name TEXT,
  ADD COLUMN IF NOT EXISTS wing TEXT,
  ADD COLUMN IF NOT EXISTS admission_date TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS care_level TEXT,
  ADD COLUMN IF NOT EXISTS room_name TEXT,
  ADD COLUMN IF NOT EXISTS room_id TEXT,
  ADD COLUMN IF NOT EXISTS notes TEXT;

CREATE INDEX IF NOT EXISTS idx_care_records_tenant_resident
  ON public.care_records (tenant_id, record_type)
  WHERE record_type = 'resident';