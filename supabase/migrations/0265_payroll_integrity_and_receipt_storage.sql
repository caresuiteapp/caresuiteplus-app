-- CareSuite+ 0265 — Payroll-Integrität, Auslagen-RLS und persönlicher Belegspeicher

CREATE OR REPLACE FUNCTION public.employee_payroll_mileage_rate_cents()
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((
    SELECT settings.mileage_rate_cents
    FROM public.employee_payroll_settings settings
    WHERE settings.tenant_id = public.current_tenant_id()
      AND settings.employee_id = public.resolve_current_employee_id()
    LIMIT 1
  ), 30);
$$;
REVOKE ALL ON FUNCTION public.employee_payroll_mileage_rate_cents() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.employee_payroll_mileage_rate_cents() TO authenticated;

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
  IF NEW.approved_amount_cents IS NOT NULL AND NEW.approved_amount_cents > NEW.amount_cents THEN
    RAISE EXCEPTION 'Der genehmigte Betrag darf den eingereichten Betrag nicht überschreiten.';
  END IF;
  IF NEW.status = 'approved' AND NEW.approved_amount_cents IS NOT NULL
    AND NEW.approved_amount_cents < NEW.amount_cents THEN
    NEW.status := 'partially_approved';
  END IF;
  IF NOT office_actor THEN
    IF OLD.employee_id <> public.resolve_current_employee_id()
      OR NEW.employee_id IS DISTINCT FROM OLD.employee_id
      OR NEW.tenant_id IS DISTINCT FROM OLD.tenant_id THEN
      RAISE EXCEPTION 'Auslagenzuordnung darf nicht verändert werden.';
    END IF;
    IF OLD.status NOT IN ('draft','needs_info') THEN
      RAISE EXCEPTION 'Eingereichte oder geprüfte Auslagen sind nicht mehr änderbar.';
    END IF;
    IF NEW.approved_amount_cents IS DISTINCT FROM OLD.approved_amount_cents
      OR NEW.tax_treatment IS DISTINCT FROM OLD.tax_treatment
      OR NEW.reviewed_by IS DISTINCT FROM OLD.reviewed_by
      OR NEW.reviewed_at IS DISTINCT FROM OLD.reviewed_at
      OR NEW.office_note IS DISTINCT FROM OLD.office_note
      OR NEW.rejection_reason IS DISTINCT FROM OLD.rejection_reason THEN
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

DROP POLICY IF EXISTS payroll_expenses_insert ON public.employee_expense_claims;
CREATE POLICY payroll_expenses_insert ON public.employee_expense_claims
FOR INSERT TO authenticated WITH CHECK (
  tenant_id = public.current_tenant_id() AND (
    (
      employee_id = public.resolve_current_employee_id()
      AND status IN ('draft','submitted')
      AND approved_amount_cents IS NULL
      AND reviewed_at IS NULL
      AND reviewed_by IS NULL
      AND office_note IS NULL
      AND rejection_reason IS NULL
      AND tax_treatment = 'review'
      AND created_by = auth.uid()
    )
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
) WITH CHECK (
  tenant_id = public.current_tenant_id() AND (
    employee_id = public.resolve_current_employee_id()
    OR public.has_permission('office.employees.edit')
    OR public.is_tenant_admin()
  )
);

DROP POLICY IF EXISTS payroll_audit_insert ON public.payroll_month_audit_log;
CREATE POLICY payroll_audit_insert ON public.payroll_month_audit_log
FOR INSERT TO authenticated WITH CHECK (
  tenant_id = public.current_tenant_id() AND (
    public.has_permission('office.employees.edit') OR public.is_tenant_admin()
  )
);

DROP POLICY IF EXISTS payroll_employee_receipts_insert ON storage.objects;
CREATE POLICY payroll_employee_receipts_insert ON storage.objects
FOR INSERT TO authenticated WITH CHECK (
  bucket_id = 'office-documents'
  AND (storage.foldername(name))[1] = public.current_tenant_id()::TEXT
  AND (storage.foldername(name))[2] = 'payroll'
  AND (storage.foldername(name))[3] = 'expenses'
  AND (storage.foldername(name))[4] = public.resolve_current_employee_id()::TEXT
  AND lower(storage.extension(name)) IN ('pdf','jpg','jpeg','png','webp','heic','heif')
);

DROP POLICY IF EXISTS payroll_employee_documents_select ON storage.objects;
CREATE POLICY payroll_employee_documents_select ON storage.objects
FOR SELECT TO authenticated USING (
  bucket_id = 'office-documents'
  AND (storage.foldername(name))[1] = public.current_tenant_id()::TEXT
  AND (
    (
      (storage.foldername(name))[2] = 'payroll'
      AND (storage.foldername(name))[3] = 'expenses'
      AND (
        (storage.foldername(name))[4] = public.resolve_current_employee_id()::TEXT
        OR public.has_permission('office.employees.view')
        OR public.is_tenant_admin()
      )
    )
    OR (
      (storage.foldername(name))[2] = 'generated'
      AND EXISTS (
        SELECT 1 FROM public.payroll_month_statements statement
        WHERE statement.tenant_id = public.current_tenant_id()
          AND statement.pdf_path = name
          AND (
            statement.employee_id = public.resolve_current_employee_id()
            OR public.has_permission('office.employees.view')
            OR public.is_tenant_admin()
          )
      )
    )
  )
);
