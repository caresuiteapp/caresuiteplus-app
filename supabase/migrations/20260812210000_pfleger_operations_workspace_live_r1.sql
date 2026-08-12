-- CareSuite HealthOS — eigenständiger Pflege-Dienstplan (Live R1)

CREATE TABLE IF NOT EXISTS public.care_staff_shifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  employee_id UUID REFERENCES public.employees(id) ON DELETE SET NULL,
  employee_name_snapshot TEXT NOT NULL CHECK (length(btrim(employee_name_snapshot)) > 0),
  role_label_snapshot TEXT NOT NULL DEFAULT '',
  shift_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  location TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'published', 'confirmed', 'in_progress', 'completed', 'cancelled')),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  CHECK (end_time > start_time)
);

CREATE INDEX IF NOT EXISTS care_staff_shifts_tenant_date_idx
  ON public.care_staff_shifts (tenant_id, shift_date, start_time);
CREATE INDEX IF NOT EXISTS care_staff_shifts_employee_date_idx
  ON public.care_staff_shifts (tenant_id, employee_id, shift_date)
  WHERE employee_id IS NOT NULL;

ALTER TABLE public.care_staff_shifts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS care_staff_shifts_tenant_select ON public.care_staff_shifts;
CREATE POLICY care_staff_shifts_tenant_select ON public.care_staff_shifts
  FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS care_staff_shifts_tenant_insert ON public.care_staff_shifts;
CREATE POLICY care_staff_shifts_tenant_insert ON public.care_staff_shifts
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.current_tenant_id() AND created_by = auth.uid());

DROP POLICY IF EXISTS care_staff_shifts_tenant_update ON public.care_staff_shifts;
CREATE POLICY care_staff_shifts_tenant_update ON public.care_staff_shifts
  FOR UPDATE TO authenticated
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id() AND updated_by = auth.uid());

GRANT SELECT, INSERT, UPDATE ON public.care_staff_shifts TO authenticated;

COMMENT ON TABLE public.care_staff_shifts IS
  'Mandantengetrennter Dienstplan ausschließlich für den eigenständigen Pflegebereich.';

CREATE TABLE IF NOT EXISTS public.care_tours (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  tour_date DATE NOT NULL,
  name TEXT NOT NULL CHECK (length(btrim(name)) > 0),
  employee_id UUID REFERENCES public.employees(id) ON DELETE SET NULL,
  employee_name_snapshot TEXT NOT NULL DEFAULT '',
  vehicle_inventory_item_id UUID REFERENCES public.inventory_items(id) ON DELETE SET NULL,
  vehicle_label_snapshot TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'published', 'in_progress', 'completed', 'cancelled')),
  notes TEXT NOT NULL DEFAULT '',
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE TABLE IF NOT EXISTS public.care_tour_stops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  tour_id UUID NOT NULL REFERENCES public.care_tours(id) ON DELETE CASCADE,
  sequence_no INTEGER NOT NULL CHECK (sequence_no > 0),
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  client_name_snapshot TEXT NOT NULL CHECK (length(btrim(client_name_snapshot)) > 0),
  address_snapshot TEXT NOT NULL DEFAULT '',
  planned_start TIME NOT NULL,
  planned_end TIME NOT NULL,
  service_summary TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'planned'
    CHECK (status IN ('planned', 'arrived', 'in_progress', 'completed', 'cancelled')),
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (tour_id, sequence_no),
  CHECK (planned_end > planned_start)
);

CREATE INDEX IF NOT EXISTS care_tours_tenant_date_idx
  ON public.care_tours (tenant_id, tour_date, status);
CREATE INDEX IF NOT EXISTS care_tour_stops_tour_sequence_idx
  ON public.care_tour_stops (tenant_id, tour_id, sequence_no);

ALTER TABLE public.care_tours ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.care_tour_stops ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS care_tours_tenant_all ON public.care_tours;
CREATE POLICY care_tours_tenant_all ON public.care_tours
  FOR ALL TO authenticated
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS care_tour_stops_tenant_all ON public.care_tour_stops;
CREATE POLICY care_tour_stops_tenant_all ON public.care_tour_stops
  FOR ALL TO authenticated
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND EXISTS (
      SELECT 1 FROM public.care_tours t
      WHERE t.id = tour_id AND t.tenant_id = public.current_tenant_id()
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.care_tours TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.care_tour_stops TO authenticated;

COMMENT ON TABLE public.care_tours IS
  'Eigenständige ambulante Pflege-Touren mit Personal- und Fahrzeugzuordnung.';
COMMENT ON TABLE public.care_tour_stops IS
  'Geordnete, klientenbezogene Stopps einer Pflege-Tour.';
