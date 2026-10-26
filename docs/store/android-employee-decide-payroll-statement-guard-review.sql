-- REVIEW ONLY, NOT APPLIED. Read-only Production catalog captured 2026-10-26.
-- Narrow authorization repair; no business rows, RLS policies, triggers, proof
-- attestations or historical workflow drafts are activated here.
-- Original pg_get_functiondef SHA-256: dff812e4a3481618b20dba1c65356a7fee971b41098e78692f95b331d6dbc37d
-- Existing function signature, runtime body and ACL stay in place except the
-- explicitly scoped actor/tenant checks below. Changed source aborts this file.
BEGIN;
SET LOCAL search_path = public, pg_temp;
DO $review$
BEGIN
 IF encode(sha256(convert_to(pg_get_functiondef('public.employee_decide_payroll_statement(uuid,text,text)'::regprocedure),'UTF8')),'hex')
    IS DISTINCT FROM 'dff812e4a3481618b20dba1c65356a7fee971b41098e78692f95b331d6dbc37d' THEN
   RAISE EXCEPTION 'Reviewed function source changed: employee_decide_payroll_statement' USING ERRCODE='55000';
 END IF;
END;
$review$;
CREATE OR REPLACE FUNCTION public.employee_decide_payroll_statement(p_statement_id uuid, p_decision text, p_reason text DEFAULT NULL::text)
 RETURNS payroll_month_statements
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  row public.payroll_month_statements;
  own_employee UUID := public.resolve_current_employee_id();
BEGIN
  -- A NULL comparison is not a denial in PL/pgSQL. Resolve a live own portal
  -- actor before locking or returning any statement, including on stale JWTs.
  IF auth.uid() IS NULL OR public.current_tenant_id() IS NULL OR own_employee IS NULL
     OR COALESCE(public.current_portal_type(),'') <> 'employee'
     OR NOT EXISTS (
       SELECT 1 FROM public.employee_portal_accounts e
       WHERE e.id = public.current_portal_account_id()
         AND e.auth_user_id = auth.uid()
         AND e.tenant_id = public.current_tenant_id()
         AND e.employee_id = own_employee
         AND e.status = 'active'
         AND e.must_change_password IS FALSE AND e.first_login_completed IS TRUE
     ) THEN
    RAISE EXCEPTION 'Aktive eigene Mitarbeitendenzuordnung erforderlich.' USING ERRCODE='42501';
  END IF;
  IF p_statement_id IS NULL OR p_decision IS NULL OR p_decision NOT IN ('confirm','reject') THEN
    RAISE EXCEPTION 'Ungültige Entscheidung.';
  END IF;
  SELECT * INTO row FROM public.payroll_month_statements
  WHERE id = p_statement_id AND tenant_id = public.current_tenant_id()
    AND employee_id = own_employee FOR UPDATE;
  IF row.id IS NULL OR row.tenant_id IS DISTINCT FROM public.current_tenant_id() OR row.employee_id IS DISTINCT FROM own_employee THEN
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
$function$;
COMMIT;
