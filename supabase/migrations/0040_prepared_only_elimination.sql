-- 0040 Prepared-only elimination — non-destructive Pflege demo tables
-- care_shift_plans, client context indexes (idempotent)

CREATE TABLE IF NOT EXISTS public.care_shift_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  employee_name text NOT NULL,
  role_label text NOT NULL,
  shift_date date NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  location text,
  status text NOT NULL DEFAULT 'entwurf',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_care_shift_plans_tenant_date
  ON public.care_shift_plans (tenant_id, shift_date DESC);

ALTER TABLE public.care_shift_plans ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'care_shift_plans'
      AND policyname = 'care_shift_plans_tenant_isolation'
  ) THEN
    CREATE POLICY care_shift_plans_tenant_isolation ON public.care_shift_plans
      FOR ALL
      USING (tenant_id = public.current_tenant_id())
      WITH CHECK (tenant_id = public.current_tenant_id());
  END IF;
END $$;

COMMENT ON TABLE public.care_shift_plans IS 'Dienstpläne — demo-funktional, Live-Repo folgt';

CREATE INDEX IF NOT EXISTS idx_client_vital_signs_tenant_measured
  ON public.client_vital_signs (tenant_id, recorded_at DESC);

CREATE INDEX IF NOT EXISTS idx_client_medications_tenant_updated
  ON public.client_medications (tenant_id, updated_at DESC);
