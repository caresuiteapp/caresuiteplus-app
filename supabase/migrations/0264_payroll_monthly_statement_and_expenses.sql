-- CareSuite+ 0264 — Gehaltsstatistik, Monatsfreigabe und Auslagen
-- Verbindliche Versionen, Employee-Self-Service, Office-Prüfung, RLS und Audit.

ALTER TABLE public.employee_payroll_settings
  ADD COLUMN IF NOT EXISTS max_payout_hours_month NUMERIC(7,2),
  ADD COLUMN IF NOT EXISTS overflow_to_time_account BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS mileage_rate_cents INTEGER NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS payroll_notes TEXT;

ALTER TABLE public.employee_payroll_settings
  DROP CONSTRAINT IF EXISTS employee_payroll_max_payout_hours_check;
ALTER TABLE public.employee_payroll_settings
  ADD CONSTRAINT employee_payroll_max_payout_hours_check
  CHECK (max_payout_hours_month IS NULL OR max_payout_hours_month >= 0);

CREATE TABLE IF NOT EXISTS public.employee_expense_claims (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  employee_id              UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  expense_date             DATE NOT NULL,
  category                 TEXT NOT NULL CHECK (category IN (
    'receipt','mileage','public_transport','rail','taxi','parking','toll',
    'accommodation','meals','client_purchase','work_equipment','postage',
    'communication','training','other'
  )),
  description              TEXT NOT NULL CHECK (char_length(trim(description)) >= 3),
  amount_cents             INTEGER NOT NULL CHECK (amount_cents >= 0),
  approved_amount_cents    INTEGER CHECK (approved_amount_cents IS NULL OR approved_amount_cents >= 0),
  currency                 TEXT NOT NULL DEFAULT 'EUR' CHECK (char_length(currency) = 3),
  assignment_id            UUID,
  client_id                UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  payment_method           TEXT,
  receipt_number           TEXT,
  receipt_path             TEXT,
  mileage_km               NUMERIC(9,2) CHECK (mileage_km IS NULL OR mileage_km >= 0),
  mileage_rate_cents       INTEGER CHECK (mileage_rate_cents IS NULL OR mileage_rate_cents >= 0),
  origin                   TEXT,
  destination              TEXT,
  vehicle_label            TEXT,
  business_purpose         TEXT NOT NULL CHECK (char_length(trim(business_purpose)) >= 3),
  tax_treatment            TEXT NOT NULL DEFAULT 'review' CHECK (tax_treatment IN ('reimbursement','taxable','review')),
  status                   TEXT NOT NULL DEFAULT 'draft' CHECK (status IN (
    'draft','submitted','needs_info','approved','partially_approved','rejected','reimbursed'
  )),
  office_note              TEXT,
  rejection_reason         TEXT,
  submitted_at             TIMESTAMPTZ,
  reviewed_at              TIMESTAMPTZ,
  reviewed_by              UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reimbursed_at            TIMESTAMPTZ,
  created_by               UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_employee_expense_claims_tenant_period
  ON public.employee_expense_claims (tenant_id, expense_date DESC);
CREATE INDEX IF NOT EXISTS idx_employee_expense_claims_employee_period
  ON public.employee_expense_claims (tenant_id, employee_id, expense_date DESC);
CREATE INDEX IF NOT EXISTS idx_employee_expense_claims_review
  ON public.employee_expense_claims (tenant_id, status, submitted_at DESC)
  WHERE status IN ('submitted','needs_info');

CREATE TABLE IF NOT EXISTS public.payroll_month_statements (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  employee_id              UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  period_year              INTEGER NOT NULL CHECK (period_year BETWEEN 2000 AND 2100),
  period_month             INTEGER NOT NULL CHECK (period_month BETWEEN 1 AND 12),
  version                  INTEGER NOT NULL CHECK (version > 0),
  status                   TEXT NOT NULL DEFAULT 'draft' CHECK (status IN (
    'draft','published','confirmed','rejected','superseded','locked','paid'
  )),
  snapshot_json            JSONB NOT NULL,
  actual_work_minutes      INTEGER NOT NULL DEFAULT 0 CHECK (actual_work_minutes >= 0),
  travel_minutes           INTEGER NOT NULL DEFAULT 0 CHECK (travel_minutes >= 0),
  paid_absence_minutes     INTEGER NOT NULL DEFAULT 0 CHECK (paid_absence_minutes >= 0),
  planned_minutes          INTEGER NOT NULL DEFAULT 0 CHECK (planned_minutes >= 0),
  payable_minutes          INTEGER NOT NULL DEFAULT 0 CHECK (payable_minutes >= 0),
  overtime_transfer_minutes INTEGER NOT NULL DEFAULT 0 CHECK (overtime_transfer_minutes >= 0),
  earned_gross_cents       INTEGER NOT NULL DEFAULT 0 CHECK (earned_gross_cents >= 0),
  projected_gross_cents    INTEGER NOT NULL DEFAULT 0 CHECK (projected_gross_cents >= 0),
  approved_expenses_cents  INTEGER NOT NULL DEFAULT 0 CHECK (approved_expenses_cents >= 0),
  projected_payout_cents   INTEGER NOT NULL DEFAULT 0 CHECK (projected_payout_cents >= 0),
  pdf_path                 TEXT,
  pdf_sha256               TEXT,
  employee_decision_reason TEXT,
  published_at             TIMESTAMPTZ,
  published_by             UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  confirmed_at             TIMESTAMPTZ,
  rejected_at              TIMESTAMPTZ,
  locked_at                TIMESTAMPTZ,
  locked_by                UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  paid_at                  TIMESTAMPTZ,
  created_by               UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, employee_id, period_year, period_month, version)
);

CREATE INDEX IF NOT EXISTS idx_payroll_month_statements_tenant_period
  ON public.payroll_month_statements (tenant_id, period_year, period_month, status);
CREATE INDEX IF NOT EXISTS idx_payroll_month_statements_employee_period
  ON public.payroll_month_statements (tenant_id, employee_id, period_year DESC, period_month DESC, version DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_payroll_one_actionable_version
  ON public.payroll_month_statements (tenant_id, employee_id, period_year, period_month)
  WHERE status IN ('published','confirmed','locked','paid');

CREATE TABLE IF NOT EXISTS public.payroll_month_audit_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  statement_id UUID REFERENCES public.payroll_month_statements(id) ON DELETE CASCADE,
  expense_claim_id UUID REFERENCES public.employee_expense_claims(id) ON DELETE CASCADE,
  employee_id UUID REFERENCES public.employees(id) ON DELETE SET NULL,
  action      TEXT NOT NULL,
  actor_id    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  summary     TEXT NOT NULL,
  metadata    JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (statement_id IS NOT NULL OR expense_claim_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_payroll_month_audit_tenant
  ON public.payroll_month_audit_log (tenant_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.payroll_guard_statement_immutability()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.status IN ('confirmed','locked','paid') AND (
    NEW.snapshot_json IS DISTINCT FROM OLD.snapshot_json OR
    NEW.pdf_path IS DISTINCT FROM OLD.pdf_path OR
    NEW.pdf_sha256 IS DISTINCT FROM OLD.pdf_sha256 OR
    NEW.employee_id IS DISTINCT FROM OLD.employee_id OR
    NEW.period_year IS DISTINCT FROM OLD.period_year OR
    NEW.period_month IS DISTINCT FROM OLD.period_month OR
    NEW.version IS DISTINCT FROM OLD.version
  ) THEN
    RAISE EXCEPTION 'Bestätigte oder gesperrte Abrechnungsversionen sind unveränderbar.';
  END IF;
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS payroll_statement_immutability ON public.payroll_month_statements;
CREATE TRIGGER payroll_statement_immutability
BEFORE UPDATE ON public.payroll_month_statements
FOR EACH ROW EXECUTE FUNCTION public.payroll_guard_statement_immutability();

CREATE OR REPLACE FUNCTION public.payroll_guard_expense_employee_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  office_actor BOOLEAN := public.is_tenant_admin()
    OR public.has_permission('office.employees.edit');
BEGIN
  IF NOT office_actor THEN
    IF OLD.employee_id <> public.resolve_current_employee_id() THEN
      RAISE EXCEPTION 'Auslage gehört nicht zum aktuellen Mitarbeitendenkonto.';
    END IF;
    IF OLD.status NOT IN ('draft','needs_info') THEN
      RAISE EXCEPTION 'Eingereichte oder geprüfte Auslagen sind nicht mehr änderbar.';
    END IF;
    IF NEW.approved_amount_cents IS DISTINCT FROM OLD.approved_amount_cents
      OR NEW.tax_treatment IS DISTINCT FROM OLD.tax_treatment
      OR NEW.reviewed_by IS DISTINCT FROM OLD.reviewed_by
      OR NEW.reviewed_at IS DISTINCT FROM OLD.reviewed_at
      OR NEW.office_note IS DISTINCT FROM OLD.office_note
      OR NEW.rejection_reason IS DISTINCT FROM OLD.rejection_reason
    THEN
      RAISE EXCEPTION 'Prüffelder dürfen nur durch Office geändert werden.';
    END IF;
    IF NEW.status NOT IN ('draft','submitted') THEN
      RAISE EXCEPTION 'Mitarbeitende dürfen Auslagen nur speichern oder einreichen.';
    END IF;
  END IF;
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS payroll_expense_employee_update ON public.employee_expense_claims;
CREATE TRIGGER payroll_expense_employee_update
BEFORE UPDATE ON public.employee_expense_claims
FOR EACH ROW EXECUTE FUNCTION public.payroll_guard_expense_employee_update();

ALTER TABLE public.employee_expense_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_month_statements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_month_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS payroll_expenses_select ON public.employee_expense_claims;
CREATE POLICY payroll_expenses_select ON public.employee_expense_claims
FOR SELECT TO authenticated USING (
  tenant_id = public.current_tenant_id() AND (
    employee_id = public.resolve_current_employee_id()
    OR public.has_permission('office.employees.view')
    OR public.is_tenant_admin()
  )
);
DROP POLICY IF EXISTS payroll_expenses_insert ON public.employee_expense_claims;
CREATE POLICY payroll_expenses_insert ON public.employee_expense_claims
FOR INSERT TO authenticated WITH CHECK (
  tenant_id = public.current_tenant_id() AND (
    employee_id = public.resolve_current_employee_id()
    OR public.has_permission('office.employees.edit')
    OR public.is_tenant_admin()
  )
);
DROP POLICY IF EXISTS payroll_expenses_update ON public.employee_expense_claims;
CREATE POLICY payroll_expenses_update ON public.employee_expense_claims
FOR UPDATE TO authenticated USING (
  tenant_id = public.current_tenant_id() AND (
    employee_id = public.resolve_current_employee_id()
    OR public.has_permission('office.employees.edit')
    OR public.is_tenant_admin()
  )
) WITH CHECK (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS payroll_statements_select ON public.payroll_month_statements;
CREATE POLICY payroll_statements_select ON public.payroll_month_statements
FOR SELECT TO authenticated USING (
  tenant_id = public.current_tenant_id() AND (
    employee_id = public.resolve_current_employee_id()
    OR public.has_permission('office.employees.view')
    OR public.is_tenant_admin()
  )
);
DROP POLICY IF EXISTS payroll_statements_insert ON public.payroll_month_statements;
CREATE POLICY payroll_statements_insert ON public.payroll_month_statements
FOR INSERT TO authenticated WITH CHECK (
  tenant_id = public.current_tenant_id() AND (
    public.has_permission('office.employees.edit') OR public.is_tenant_admin()
  )
);
DROP POLICY IF EXISTS payroll_statements_update ON public.payroll_month_statements;
CREATE POLICY payroll_statements_update ON public.payroll_month_statements
FOR UPDATE TO authenticated USING (
  tenant_id = public.current_tenant_id() AND (
    public.has_permission('office.employees.edit') OR public.is_tenant_admin()
  )
) WITH CHECK (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS payroll_audit_select ON public.payroll_month_audit_log;
CREATE POLICY payroll_audit_select ON public.payroll_month_audit_log
FOR SELECT TO authenticated USING (
  tenant_id = public.current_tenant_id() AND (
    employee_id = public.resolve_current_employee_id()
    OR public.has_permission('office.employees.view_sensitive')
    OR public.is_tenant_admin()
  )
);
DROP POLICY IF EXISTS payroll_audit_insert ON public.payroll_month_audit_log;
CREATE POLICY payroll_audit_insert ON public.payroll_month_audit_log
FOR INSERT TO authenticated WITH CHECK (tenant_id = public.current_tenant_id());

CREATE OR REPLACE FUNCTION public.employee_decide_payroll_statement(
  p_statement_id UUID,
  p_decision TEXT,
  p_reason TEXT DEFAULT NULL
)
RETURNS public.payroll_month_statements
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  row public.payroll_month_statements;
  own_employee UUID := public.resolve_current_employee_id();
BEGIN
  IF p_decision NOT IN ('confirm','reject') THEN
    RAISE EXCEPTION 'Ungültige Entscheidung.';
  END IF;
  SELECT * INTO row FROM public.payroll_month_statements
  WHERE id = p_statement_id FOR UPDATE;
  IF row.id IS NULL OR row.tenant_id <> public.current_tenant_id() OR row.employee_id <> own_employee THEN
    RAISE EXCEPTION 'Abrechnung nicht gefunden oder nicht berechtigt.';
  END IF;
  IF row.status <> 'published' THEN
    RAISE EXCEPTION 'Diese Abrechnung kann nicht mehr beantwortet werden.';
  END IF;
  IF p_decision = 'reject' AND char_length(trim(COALESCE(p_reason,''))) < 10 THEN
    RAISE EXCEPTION 'Bitte geben Sie einen konkreten Ablehnungsgrund mit mindestens 10 Zeichen an.';
  END IF;

  UPDATE public.payroll_month_statements SET
    status = CASE WHEN p_decision = 'confirm' THEN 'confirmed' ELSE 'rejected' END,
    employee_decision_reason = CASE WHEN p_decision = 'reject' THEN trim(p_reason) ELSE NULL END,
    confirmed_at = CASE WHEN p_decision = 'confirm' THEN NOW() ELSE NULL END,
    rejected_at = CASE WHEN p_decision = 'reject' THEN NOW() ELSE NULL END,
    updated_at = NOW()
  WHERE id = p_statement_id RETURNING * INTO row;

  INSERT INTO public.payroll_month_audit_log
    (tenant_id, statement_id, employee_id, action, actor_id, summary, metadata)
  VALUES
    (row.tenant_id, row.id, row.employee_id,
     CASE WHEN p_decision = 'confirm' THEN 'employee_confirmed' ELSE 'employee_rejected' END,
     auth.uid(),
     CASE WHEN p_decision = 'confirm' THEN 'Mitarbeitende:r hat die Monatsübersicht bestätigt.' ELSE 'Mitarbeitende:r hat die Monatsübersicht abgelehnt.' END,
     jsonb_build_object('reason', p_reason, 'version', row.version));
  RETURN row;
END;
$$;

REVOKE ALL ON FUNCTION public.employee_decide_payroll_statement(UUID,TEXT,TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.employee_decide_payroll_statement(UUID,TEXT,TEXT) TO authenticated;

GRANT SELECT, INSERT, UPDATE ON public.employee_expense_claims TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.payroll_month_statements TO authenticated;
GRANT SELECT, INSERT ON public.payroll_month_audit_log TO authenticated;

COMMENT ON TABLE public.payroll_month_statements IS
  'Unveränderbare, versionierte Monatsübersichten für Lohnprognose und Mitarbeitendenfreigabe.';
COMMENT ON TABLE public.employee_expense_claims IS
  'Beleggebundene Auslagen, Kilometer- und Reisekostenerstattungen mit Office-Prüfung.';
