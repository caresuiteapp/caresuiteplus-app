CREATE TABLE IF NOT EXISTS public.catalogs (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  title        TEXT        NOT NULL,
  catalog_type TEXT        NOT NULL DEFAULT 'service',
  status       TEXT        NOT NULL DEFAULT 'entwurf',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS set_catalogs_updated_at ON public.catalogs;
CREATE TRIGGER set_catalogs_updated_at
  BEFORE UPDATE ON public.catalogs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.catalogs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS catalogs_tenant ON public.catalogs;
CREATE POLICY catalogs_tenant ON public.catalogs
  FOR ALL USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());
GRANT SELECT, INSERT, UPDATE ON public.catalogs TO authenticated;
CREATE INDEX IF NOT EXISTS idx_catalogs_tenant ON public.catalogs(tenant_id, status);

ALTER TABLE public.catalogs
  ADD COLUMN IF NOT EXISTS category TEXT,
  ADD COLUMN IF NOT EXISTS duration_minutes INTEGER,
  ADD COLUMN IF NOT EXISTS is_mandatory BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS starts_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS enrollment_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS ends_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS instructor_name TEXT,
  ADD COLUMN IF NOT EXISTS completion_rate_percent INTEGER DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_catalogs_tenant_course
  ON public.catalogs (tenant_id, catalog_type)
  WHERE catalog_type = 'course';
