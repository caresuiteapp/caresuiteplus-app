-- ==========================================================================
-- CareSuite+ — Migration 0053: Tourenplanung & Vertretung (preparedOnly)
-- route_plans, route_plan_items, replacement_suggestions, assignment_conflicts,
-- travel_time_estimates, route_planning_audit_events
-- Keine destruktiven Befehle. Live-Anbindung erst nach Freigabe.
-- ==========================================================================

CREATE TABLE IF NOT EXISTS public.route_plans (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  employee_id           UUID        NOT NULL,
  plan_date             DATE        NOT NULL,
  status                TEXT        NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'confirmed', 'archived')),
  title                 TEXT        NOT NULL,
  total_stops           INTEGER     NOT NULL DEFAULT 0,
  total_planned_minutes INTEGER     NOT NULL DEFAULT 0,
  confirmed_at          TIMESTAMPTZ,
  confirmed_by          UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_route_plans_tenant_employee_date
  ON public.route_plans (tenant_id, employee_id, plan_date DESC);

CREATE TABLE IF NOT EXISTS public.route_plan_items (
  id                          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                   UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  route_plan_id               UUID        NOT NULL REFERENCES public.route_plans(id) ON DELETE CASCADE,
  assignment_id               UUID        NOT NULL,
  sort_order                  INTEGER     NOT NULL DEFAULT 0,
  planned_arrival_at          TIMESTAMPTZ NOT NULL,
  planned_departure_at        TIMESTAMPTZ NOT NULL,
  address                     TEXT        NOT NULL,
  travel_minutes_from_previous INTEGER,
  travel_plausibility         TEXT        NOT NULL DEFAULT 'unknown'
    CHECK (travel_plausibility IN ('ok', 'warning', 'unknown')),
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_route_plan_items_plan
  ON public.route_plan_items (route_plan_id, sort_order);

CREATE TABLE IF NOT EXISTS public.replacement_suggestions (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  assignment_id         UUID        NOT NULL,
  original_employee_id  UUID        NOT NULL,
  suggested_employee_id UUID        NOT NULL,
  absence_id            UUID,
  status                TEXT        NOT NULL DEFAULT 'suggested'
    CHECK (status IN ('suggested', 'accepted', 'rejected', 'expired')),
  qualification_match   BOOLEAN     NOT NULL DEFAULT FALSE,
  availability_ok       BOOLEAN     NOT NULL DEFAULT FALSE,
  travel_time_minutes   INTEGER,
  travel_plausibility   TEXT        NOT NULL DEFAULT 'unknown'
    CHECK (travel_plausibility IN ('ok', 'warning', 'unknown')),
  regional_proximity    TEXT        NOT NULL DEFAULT 'unknown'
    CHECK (regional_proximity IN ('same_region', 'adjacent', 'distant', 'unknown')),
  score                 NUMERIC(5,2) NOT NULL DEFAULT 0,
  reason                TEXT        NOT NULL DEFAULT '',
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_replacement_suggestions_tenant_assignment
  ON public.replacement_suggestions (tenant_id, assignment_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.assignment_conflicts (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  assignment_id   UUID        NOT NULL,
  employee_id     UUID,
  code            TEXT        NOT NULL
    CHECK (code IN (
      'absence', 'qualification_missing', 'overlapping_assignment',
      'travel_time_unrealistic', 'max_working_time_warning', 'missing_address',
      'missing_provider', 'employee_inactive'
    )),
  message         TEXT        NOT NULL,
  severity        TEXT        NOT NULL DEFAULT 'warning'
    CHECK (severity IN ('warning', 'error')),
  resolved        BOOLEAN     NOT NULL DEFAULT FALSE,
  detected_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_assignment_conflicts_tenant
  ON public.assignment_conflicts (tenant_id, assignment_id, detected_at DESC);

CREATE TABLE IF NOT EXISTS public.travel_time_estimates (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  assignment_id     UUID,
  from_address      TEXT        NOT NULL,
  to_address        TEXT        NOT NULL,
  duration_minutes  INTEGER     NOT NULL,
  source            TEXT        NOT NULL DEFAULT 'heuristic'
    CHECK (source IN ('heuristic', 'provider')),
  provider_key      TEXT,
  is_plausible      BOOLEAN     NOT NULL DEFAULT TRUE,
  disclaimer        TEXT        NOT NULL DEFAULT 'Plausibilitätswert — keine exakte Route.',
  calculated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_travel_time_estimates_tenant
  ON public.travel_time_estimates (tenant_id, assignment_id, calculated_at DESC);

CREATE TABLE IF NOT EXISTS public.route_planning_audit_events (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  action          TEXT        NOT NULL,
  actor_id        UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  actor_role      TEXT,
  assignment_id   UUID,
  employee_id     UUID,
  summary         TEXT        NOT NULL,
  metadata        JSONB       NOT NULL DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_route_planning_audit_tenant
  ON public.route_planning_audit_events (tenant_id, created_at DESC);

ALTER TABLE public.route_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.route_plan_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.replacement_suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignment_conflicts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.travel_time_estimates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.route_planning_audit_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY route_plans_tenant ON public.route_plans
  FOR ALL USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

CREATE POLICY route_plan_items_tenant ON public.route_plan_items
  FOR ALL USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

CREATE POLICY replacement_suggestions_tenant ON public.replacement_suggestions
  FOR ALL USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

CREATE POLICY assignment_conflicts_tenant ON public.assignment_conflicts
  FOR ALL USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

CREATE POLICY travel_time_estimates_tenant ON public.travel_time_estimates
  FOR ALL USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

CREATE POLICY route_planning_audit_tenant ON public.route_planning_audit_events
  FOR ALL USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

GRANT SELECT, INSERT, UPDATE ON public.route_plans TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.route_plan_items TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.replacement_suggestions TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.assignment_conflicts TO authenticated;
GRANT SELECT, INSERT ON public.travel_time_estimates TO authenticated;
GRANT SELECT, INSERT ON public.route_planning_audit_events TO authenticated;

COMMENT ON TABLE public.route_plans IS 'Tages-Tourenpläne je Mitarbeitende:r — preparedOnly';
COMMENT ON TABLE public.route_plan_items IS 'Stopps/Reihenfolge einer Tour — abgeleitet aus Einsätzen';
COMMENT ON TABLE public.replacement_suggestions IS 'Vertretungsvorschläge mit Qualifikations-/Verfügbarkeits-Score';
COMMENT ON TABLE public.assignment_conflicts IS 'Persistierte Planungskonflikte — auditierbar';
COMMENT ON TABLE public.travel_time_estimates IS 'Fahrzeit-Plausibilitätswerte — kein GPS ohne Provider-Freigabe';
COMMENT ON TABLE public.route_planning_audit_events IS 'Audit-Trail Tourenplanung/Vertretung';
