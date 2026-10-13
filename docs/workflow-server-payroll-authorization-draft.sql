-- REVIEW DRAFT ONLY, NOT APPLIED. Original deployed definition/grants captured
-- in workflow-server-write-rpc-metadata-20261011.json; schema in payroll metadata.
-- The deployed <> checks admit NULL tenant/employee: this replacement requires
-- actual auth + tenant + active own portal binding before selecting any row.
BEGIN;
CREATE OR REPLACE FUNCTION public.employee_decide_payroll_statement(p_statement_id uuid,p_decision text,p_reason text DEFAULT NULL)
RETURNS public.payroll_month_statements LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE r public.payroll_month_statements%ROWTYPE; own_employee uuid:=public.resolve_current_employee_id();
 t uuid:=public.current_tenant_id(); expected text; reason text:=NULLIF(trim(p_reason),''); a public.payroll_month_audit_log%ROWTYPE;
BEGIN
 IF auth.uid() IS NULL OR t IS NULL OR own_employee IS NULL OR COALESCE(public.current_portal_type(),'')<>'employee'
   OR NOT EXISTS(SELECT 1 FROM public.employee_portal_accounts e WHERE e.id=public.current_portal_account_id()
      AND e.auth_user_id=auth.uid() AND e.tenant_id=t AND e.employee_id=own_employee AND e.status='active') THEN
   RAISE EXCEPTION 'Aktive eigene Mitarbeitendenzuordnung erforderlich.' USING ERRCODE='42501'; END IF;
 IF p_statement_id IS NULL OR p_decision IS NULL OR p_decision NOT IN ('confirm','reject') THEN RAISE EXCEPTION 'Ungültige Entscheidung.'; END IF;
 IF p_decision='reject' AND (char_length(COALESCE(reason,''))<10 OR char_length(reason)>4000) THEN
   RAISE EXCEPTION 'Ablehnungsgrund muss 10 bis 4000 Zeichen enthalten.'; END IF;
 expected:=CASE p_decision WHEN 'confirm' THEN 'confirmed' ELSE 'rejected' END;
 SELECT * INTO r FROM public.payroll_month_statements WHERE id=p_statement_id AND tenant_id=t AND employee_id=own_employee FOR UPDATE;
 IF NOT FOUND OR r.tenant_id IS DISTINCT FROM t OR r.employee_id IS DISTINCT FROM own_employee THEN
   RAISE EXCEPTION 'Abrechnung nicht gefunden oder nicht berechtigt.' USING ERRCODE='42501'; END IF;
 IF r.published_at IS NULL OR r.published_by IS NULL OR r.version IS NULL OR r.version<1
   OR NULLIF(trim(r.pdf_path),'') IS NULL OR COALESCE(r.pdf_sha256,'') !~ '^(sha256:)?[0-9a-f]{64}$' OR jsonb_typeof(r.snapshot_json)<>'object' THEN
   RAISE EXCEPTION 'Bestätigte veröffentlichte Abrechnungsfassung fehlt.'; END IF;
 IF r.status=expected THEN
   SELECT * INTO a FROM public.payroll_month_audit_log WHERE tenant_id=t AND statement_id=r.id AND employee_id=own_employee
     AND actor_id=auth.uid() AND action=CASE p_decision WHEN 'confirm' THEN 'employee_confirmed' ELSE 'employee_rejected' END
     AND metadata->>'version'=r.version::text AND metadata->>'pdf_sha256'=r.pdf_sha256 ORDER BY created_at DESC,id DESC LIMIT 1;
   IF a.id IS NOT NULL AND (p_decision='confirm' OR r.employee_decision_reason IS NOT DISTINCT FROM reason)
     AND (CASE p_decision WHEN 'confirm' THEN r.confirmed_at ELSE r.rejected_at END) IS NOT NULL THEN RETURN r; END IF;
   RAISE EXCEPTION 'Die Entscheidung gehört nicht zu dieser bestätigten Fassung.';
 END IF;
 IF r.status<>'published' OR r.locked_at IS NOT NULL OR r.paid_at IS NOT NULL THEN
   RAISE EXCEPTION 'Diese Abrechnung kann nicht mehr beantwortet werden.'; END IF;
 UPDATE public.payroll_month_statements SET status=expected,employee_decision_reason=CASE p_decision WHEN 'reject' THEN reason ELSE NULL END,
   confirmed_at=CASE p_decision WHEN 'confirm' THEN clock_timestamp() ELSE NULL END,
   rejected_at=CASE p_decision WHEN 'reject' THEN clock_timestamp() ELSE NULL END,updated_at=clock_timestamp()
   WHERE id=r.id AND tenant_id=t AND employee_id=own_employee AND version=r.version AND status='published' RETURNING * INTO r;
 IF NOT FOUND THEN RAISE EXCEPTION 'Abrechnungsentscheidung noch nicht bestätigt.'; END IF;
 INSERT INTO public.payroll_month_audit_log(tenant_id,statement_id,employee_id,action,actor_id,summary,metadata)
 VALUES(t,r.id,own_employee,CASE p_decision WHEN 'confirm' THEN 'employee_confirmed' ELSE 'employee_rejected' END,auth.uid(),
   CASE p_decision WHEN 'confirm' THEN 'Mitarbeitende:r hat die Monatsübersicht bestätigt.' ELSE 'Mitarbeitende:r hat die Monatsübersicht abgelehnt.' END,
   jsonb_build_object('reason',CASE p_decision WHEN 'reject' THEN reason ELSE NULL END,'version',r.version,'pdf_sha256',r.pdf_sha256));
 RETURN r;
END $$;

-- Publishing, superseding and locking can advance status, but a published
-- snapshot/PDF/scope cannot silently change underneath the employee decision.
CREATE OR REPLACE FUNCTION public.workflow_guard_published_payroll_version() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public,pg_temp AS $$ BEGIN
 IF OLD.published_at IS NOT NULL THEN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Veröffentlichte Abrechnungsfassung darf nicht gelöscht werden.'; END IF;
  IF NEW.id IS DISTINCT FROM OLD.id OR NEW.tenant_id IS DISTINCT FROM OLD.tenant_id OR NEW.employee_id IS DISTINCT FROM OLD.employee_id
    OR NEW.period_year IS DISTINCT FROM OLD.period_year OR NEW.period_month IS DISTINCT FROM OLD.period_month OR NEW.version IS DISTINCT FROM OLD.version
    OR NEW.snapshot_json IS DISTINCT FROM OLD.snapshot_json OR NEW.pdf_path IS DISTINCT FROM OLD.pdf_path OR NEW.pdf_sha256 IS DISTINCT FROM OLD.pdf_sha256
    OR NEW.published_at IS DISTINCT FROM OLD.published_at OR NEW.published_by IS DISTINCT FROM OLD.published_by
    OR NEW.actual_work_minutes IS DISTINCT FROM OLD.actual_work_minutes OR NEW.travel_minutes IS DISTINCT FROM OLD.travel_minutes
    OR NEW.paid_absence_minutes IS DISTINCT FROM OLD.paid_absence_minutes OR NEW.planned_minutes IS DISTINCT FROM OLD.planned_minutes
    OR NEW.payable_minutes IS DISTINCT FROM OLD.payable_minutes OR NEW.overtime_transfer_minutes IS DISTINCT FROM OLD.overtime_transfer_minutes
    OR NEW.earned_gross_cents IS DISTINCT FROM OLD.earned_gross_cents OR NEW.projected_gross_cents IS DISTINCT FROM OLD.projected_gross_cents
    OR NEW.approved_expenses_cents IS DISTINCT FROM OLD.approved_expenses_cents OR NEW.projected_payout_cents IS DISTINCT FROM OLD.projected_payout_cents THEN
    RAISE EXCEPTION 'Veröffentlichte Abrechnungsfassung ist unveränderlich; neue Version erforderlich.'; END IF;
 END IF;
 RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
END $$;
DROP TRIGGER IF EXISTS workflow_published_payroll_version_guard ON public.payroll_month_statements;
CREATE TRIGGER workflow_published_payroll_version_guard BEFORE UPDATE OR DELETE ON public.payroll_month_statements
 FOR EACH ROW EXECUTE FUNCTION public.workflow_guard_published_payroll_version();
REVOKE ALL ON FUNCTION public.employee_decide_payroll_statement(uuid,text,text),public.workflow_guard_published_payroll_version() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.employee_decide_payroll_statement(uuid,text,text) TO authenticated,service_role;
COMMIT;
