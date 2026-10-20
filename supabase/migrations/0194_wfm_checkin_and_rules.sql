-- ==========================================================================
-- CareSuite+ — Migration 0194: WFM Büro-Check-in (QR) + ArbZG-Regelverstöße
-- ==========================================================================

-- --------------------------------------------------------------------------
-- 1. workforce_checkin_tokens — mandantenspezifische QR-/Code-Tokens
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.workforce_checkin_tokens (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  token_code          TEXT        NOT NULL,
  location_label      TEXT        NOT NULL DEFAULT 'Hauptstandort',
  location_lat        NUMERIC(10, 7),
  location_lng        NUMERIC(10, 7),
  geofence_radius_m   INTEGER     CHECK (geofence_radius_m IS NULL OR geofence_radius_m BETWEEN 10 AND 5000),
  is_active           BOOLEAN     NOT NULL DEFAULT TRUE,
  expires_at          TIMESTAMPTZ,
  created_by          UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, token_code)
);

CREATE INDEX IF NOT EXISTS idx_workforce_checkin_tokens_tenant_active
  ON public.workforce_checkin_tokens (tenant_id, is_active)
  WHERE is_active = TRUE;

DROP TRIGGER IF EXISTS set_workforce_checkin_tokens_updated_at ON public.workforce_checkin_tokens;
CREATE TRIGGER set_workforce_checkin_tokens_updated_at
  BEFORE UPDATE ON public.workforce_checkin_tokens
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE public.workforce_checkin_tokens IS
  'QR-/Code-Tokens für Büro-Check-in (Migration 0194)';

-- --------------------------------------------------------------------------
-- 2. workforce_rule_violations — ArbZG-Warnungen und Verstöße
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.workforce_rule_violations (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  employee_id     UUID        NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  rule_key        TEXT        NOT NULL CHECK (rule_key IN (
    'max_daily_hours', 'min_rest_period', 'break_requirement_6h', 'break_requirement_9h'
  )),
  severity        TEXT        NOT NULL DEFAULT 'warning' CHECK (severity IN ('warning', 'violation')),
  message         TEXT        NOT NULL,
  work_date       DATE        NOT NULL,
  session_id      UUID        REFERENCES public.workforce_work_sessions(id) ON DELETE SET NULL,
  metadata        JSONB       NOT NULL DEFAULT '{}'::jsonb,
  acknowledged_at TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_workforce_rule_violations_tenant_date
  ON public.workforce_rule_violations (tenant_id, work_date DESC);

CREATE INDEX IF NOT EXISTS idx_workforce_rule_violations_employee
  ON public.workforce_rule_violations (tenant_id, employee_id, work_date DESC);

COMMENT ON TABLE public.workforce_rule_violations IS
  'ArbZG-Regelwarnungen (Migration 0194)';

-- --------------------------------------------------------------------------
-- RLS
-- --------------------------------------------------------------------------
ALTER TABLE public.workforce_checkin_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workforce_rule_violations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS wfm_checkin_tokens_select ON public.workforce_checkin_tokens;
CREATE POLICY wfm_checkin_tokens_select ON public.workforce_checkin_tokens
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND (
      public.has_permission('time.settings.manage')
      OR public.has_permission('time.tracking.own.start')
      OR public.is_tenant_admin()
    )
  );

DROP POLICY IF EXISTS wfm_checkin_tokens_manage ON public.workforce_checkin_tokens;
CREATE POLICY wfm_checkin_tokens_manage ON public.workforce_checkin_tokens
  FOR ALL TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND (
      public.has_permission('time.settings.manage')
      OR public.is_tenant_admin()
    )
  )
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND (
      public.has_permission('time.settings.manage')
      OR public.is_tenant_admin()
    )
  );

DROP POLICY IF EXISTS wfm_rule_violations_select ON public.workforce_rule_violations;
CREATE POLICY wfm_rule_violations_select ON public.workforce_rule_violations
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND (
      employee_id = public.workforce_current_employee_id()
      OR public.has_permission('time.tracking.team.view')
      OR public.has_permission('time.tracking.admin.view')
      OR public.is_tenant_admin()
    )
  );

DROP POLICY IF EXISTS wfm_rule_violations_insert ON public.workforce_rule_violations;
CREATE POLICY wfm_rule_violations_insert ON public.workforce_rule_violations
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND (
      employee_id = public.workforce_current_employee_id()
      OR public.has_permission('time.tracking.admin.correct')
      OR public.is_tenant_admin()
    )
  );

DROP POLICY IF EXISTS wfm_rule_violations_update ON public.workforce_rule_violations;
CREATE POLICY wfm_rule_violations_update ON public.workforce_rule_violations
  FOR UPDATE TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND (
      employee_id = public.workforce_current_employee_id()
      OR public.has_permission('time.tracking.admin.correct')
      OR public.is_tenant_admin()
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.workforce_checkin_tokens TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.workforce_rule_violations TO authenticated;
