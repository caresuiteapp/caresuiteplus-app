-- The existing restrictive Storage policy references these two columns even
-- for unrelated Assist objects. RLS still denies every payroll row: this does
-- not activate payroll or grant access to amounts, statements or snapshots.
GRANT SELECT (tenant_id,pdf_path) ON public.payroll_month_statements TO authenticated;
