-- Office Web: publication and expense decisions commit with their audit record.
-- The existing native services/RPCs keep their interfaces.
BEGIN;

CREATE OR REPLACE FUNCTION public.payroll_office_source_revision(p_tenant_id uuid, p_employee_id uuid, p_year integer, p_month integer)
RETURNS text LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = pg_catalog AS $body$
DECLARE v_table text; v_part text; v_parts text := ''; v_hash text;
BEGIN
  IF auth.uid() IS NULL OR p_tenant_id IS DISTINCT FROM public.current_tenant_id()
    OR NOT care_security.office_actor(p_tenant_id, 'office.employees.view')
    OR NOT care_security.office_actor(p_tenant_id, 'office.employees.edit') THEN
    RAISE EXCEPTION 'Keine Berechtigung für diese Gehaltsstatistik.' USING ERRCODE = '42501';
  END IF;
  IF p_year IS NULL OR p_year NOT BETWEEN 2000 AND 2100 OR p_month IS NULL OR p_month NOT BETWEEN 1 AND 12
    OR NOT EXISTS (SELECT 1 FROM public.employees WHERE tenant_id=p_tenant_id AND id=p_employee_id) THEN
    RAISE EXCEPTION 'Mitarbeitende:r oder Abrechnungsmonat ist ungültig.';
  END IF;
  -- Keep historical balances and recurring-series changes in the revision. Hashes
  -- leave the database; personal/source rows do not. RLS remains in force.
  FOREACH v_table IN ARRAY ARRAY['employee_payroll_settings','employee_contract_settings','employee_expense_claims',
    'payroll_month_statements','portal_uploads','workforce_work_sessions','workforce_time_events',
    'workforce_time_entry_reviews','workforce_time_accounts','workforce_absences','employee_logbook_trips'] LOOP
    EXECUTE format('SELECT md5(coalesce(string_agg(h, '''' ORDER BY h), '''')) FROM (SELECT md5(to_jsonb(t)::text) h FROM public.%I t WHERE tenant_id=$1 AND employee_id=$2) q',v_table)
      INTO v_part USING p_tenant_id,p_employee_id;
    v_parts := v_parts || v_table || ':' || v_part || ';';
  END LOOP;
  FOREACH v_table IN ARRAY ARRAY['workforce_time_review_actions','assist_visits','assignments','assist_visit_execution_state','workforce_approvals'] LOOP
    EXECUTE format('SELECT md5(coalesce(string_agg(h, '''' ORDER BY h), '''')) FROM (SELECT md5(to_jsonb(t)::text) h FROM public.%I t WHERE tenant_id=$1) q',v_table)
      INTO v_part USING p_tenant_id;
    v_parts := v_parts || v_table || ':' || v_part || ';';
  END LOOP;
  SELECT md5(to_jsonb(e)::text) INTO v_part FROM public.employees e WHERE tenant_id=p_tenant_id AND id=p_employee_id;
  v_parts := v_parts || 'employee:' || v_part;
  SELECT md5(coalesce(string_agg(h,'' ORDER BY h),'')) INTO v_hash FROM (
    SELECT md5(jsonb_build_array(id,first_name,last_name,full_name)::text) h FROM public.clients WHERE tenant_id=p_tenant_id
  ) names;
  RETURN md5(concat_ws(':',p_tenant_id,p_employee_id,p_year,p_month,v_parts,v_hash));
END
$body$;
REVOKE ALL ON FUNCTION public.payroll_office_source_revision(uuid,uuid,integer,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.payroll_office_source_revision(uuid,uuid,integer,integer) TO authenticated;

-- Employee data readers may open only the exact payroll PDF referenced by a
-- statement they can read. Other generated-document restrictions are retained.
DROP POLICY IF EXISTS care_security_generated_pdf_read ON storage.objects;
CREATE POLICY care_security_generated_pdf_read ON storage.objects AS RESTRICTIVE FOR SELECT TO authenticated
  USING (bucket_id <> 'office-documents' OR (storage.foldername(name))[1] IS DISTINCT FROM 'tenant'
    OR (storage.foldername(name))[3] IS DISTINCT FROM 'generated' OR care_security.generated_pdf_reader(name)
    OR (care_security.office_actor(public.current_tenant_id(),'office.employees.view') AND EXISTS (
      SELECT 1 FROM public.payroll_month_statements s WHERE s.tenant_id=public.current_tenant_id() AND s.pdf_path=name
    )));

CREATE OR REPLACE FUNCTION public.publish_office_payroll_statement(
  p_tenant_id uuid,p_employee_id uuid,p_year integer,p_month integer,p_statement_id uuid,
  p_expected_version integer,p_expected_updated_at timestamptz,p_source_revision text,
  p_snapshot jsonb,p_pdf_path text,p_pdf_sha256 text
)
RETURNS public.payroll_month_statements LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog AS $body$
DECLARE
  v_existing public.payroll_month_statements; v_latest public.payroll_month_statements;
  v_created public.payroll_month_statements; v_key text; v_number numeric; v_approved bigint;
  v_setting public.employee_payroll_settings; v_actor uuid;
BEGIN
  IF auth.uid() IS NULL OR p_tenant_id IS DISTINCT FROM public.current_tenant_id()
    OR NOT care_security.office_actor(p_tenant_id,'office.employees.edit')
    OR NOT care_security.office_actor(p_tenant_id,'office.employees.view') THEN
    RAISE EXCEPTION 'Keine Berechtigung zur Veröffentlichung.' USING ERRCODE='42501';
  END IF;
  IF p_statement_id IS NULL OR p_year IS NULL OR p_year NOT BETWEEN 2000 AND 2100
    OR p_month IS NULL OR p_month NOT BETWEEN 1 AND 12 OR p_expected_version IS NULL OR p_expected_version < 0
    OR jsonb_typeof(p_snapshot) IS DISTINCT FROM 'object'
    OR p_snapshot->>'employeeId' IS DISTINCT FROM p_employee_id::text
    OR p_snapshot->>'periodYear' IS DISTINCT FROM p_year::text OR p_snapshot->>'periodMonth' IS DISTINCT FROM p_month::text
    OR NOT EXISTS (SELECT 1 FROM public.employees WHERE tenant_id=p_tenant_id AND id=p_employee_id) THEN
    RAISE EXCEPTION 'Ungültige Zuordnung der Monatsübersicht.';
  END IF;
  IF p_pdf_sha256 IS NULL OR p_pdf_sha256 !~ '^[0-9a-f]{64}$'
    OR p_pdf_path IS DISTINCT FROM ('tenant/'||p_tenant_id||'/generated/payroll-'||p_statement_id||'/'||p_pdf_sha256||'.pdf') THEN
    RAISE EXCEPTION 'Die PDF-Datei gehört nicht zu dieser Monatsübersicht.';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(concat_ws(':','payroll-office',p_tenant_id,p_employee_id,p_year,p_month),0));
  SELECT * INTO v_existing FROM public.payroll_month_statements WHERE id=p_statement_id FOR UPDATE;
  IF FOUND THEN
    IF v_existing.tenant_id=p_tenant_id AND v_existing.employee_id=p_employee_id
      AND v_existing.period_year=p_year AND v_existing.period_month=p_month
      AND v_existing.version=p_expected_version+1 AND v_existing.snapshot_json=p_snapshot
      AND v_existing.pdf_path=p_pdf_path AND v_existing.pdf_sha256=p_pdf_sha256
      AND v_existing.published_by=auth.uid() THEN
      RETURN v_existing; -- Lost-response retry: do not publish or audit twice.
    END IF;
    RAISE EXCEPTION 'Diese Veröffentlichungskennung wurde bereits anders verwendet.';
  END IF;
  PERFORM 1 FROM public.payroll_month_statements WHERE tenant_id=p_tenant_id AND employee_id=p_employee_id
    AND period_year=p_year AND period_month=p_month ORDER BY version FOR UPDATE;
  IF EXISTS(SELECT 1 FROM public.payroll_month_statements WHERE tenant_id=p_tenant_id AND employee_id=p_employee_id
    AND period_year=p_year AND period_month=p_month AND status IN ('confirmed','locked','paid')) THEN
    RAISE EXCEPTION 'Eine bestätigte, gesperrte oder ausgezahlte Monatsübersicht darf nicht ersetzt werden.';
  END IF;
  SELECT * INTO v_latest FROM public.payroll_month_statements WHERE tenant_id=p_tenant_id AND employee_id=p_employee_id
    AND period_year=p_year AND period_month=p_month ORDER BY version DESC LIMIT 1;
  IF coalesce(v_latest.version,0) <> p_expected_version OR v_latest.updated_at IS DISTINCT FROM p_expected_updated_at THEN
    RAISE EXCEPTION 'Die Monatsübersicht wurde inzwischen geändert. Bitte aktualisieren und erneut prüfen.' USING ERRCODE='40001';
  END IF;
  IF p_source_revision IS NULL OR p_source_revision IS DISTINCT FROM public.payroll_office_source_revision(p_tenant_id,p_employee_id,p_year,p_month) THEN
    RAISE EXCEPTION 'Die Quelldaten wurden inzwischen geändert. Bitte aktualisieren und erneut prüfen.' USING ERRCODE='40001';
  END IF;
  SELECT * INTO v_setting FROM public.employee_payroll_settings WHERE tenant_id=p_tenant_id AND employee_id=p_employee_id;
  IF NOT FOUND OR v_setting.compensation_type NOT IN ('hourly','salary') OR coalesce(v_setting.compensation_amount,0)<=0
    OR p_snapshot->>'compensationType' IS DISTINCT FROM v_setting.compensation_type THEN
    RAISE EXCEPTION 'Eine gültige Vergütung fehlt oder wurde geändert.';
  END IF;
  FOREACH v_key IN ARRAY ARRAY['actualWorkMinutes','travelMinutes','vacationMinutes','sickMinutes','otherPaidAbsenceMinutes',
    'plannedMinutes','payableMinutes','overtimeTransferMinutes','earnedGrossCents','projectedGrossCents',
    'approvedExpensesCents','projectedTotalPayoutCents','hourlyRateCents','fixedSalaryCents'] LOOP
    IF jsonb_typeof(p_snapshot->v_key) IS DISTINCT FROM 'number' THEN RAISE EXCEPTION 'Ungültiger Zahlenwert: %',v_key; END IF;
    v_number := (p_snapshot->>v_key)::numeric;
    IF v_number<0 OR v_number>2147483647 OR trunc(v_number)<>v_number THEN RAISE EXCEPTION 'Ungültiger Zahlenwert: %',v_key; END IF;
  END LOOP;
  IF (p_snapshot->>'hourlyRateCents')::integer <> (CASE WHEN v_setting.compensation_type='hourly' THEN round(v_setting.compensation_amount*100)::integer ELSE 0 END)
    OR (p_snapshot->>'fixedSalaryCents')::integer <> (CASE WHEN v_setting.compensation_type='salary' THEN round(v_setting.compensation_amount*100)::integer ELSE 0 END) THEN
    RAISE EXCEPTION 'Die Vergütung wurde inzwischen geändert.';
  END IF;
  IF jsonb_typeof(p_snapshot->'expenseClaims') IS DISTINCT FROM 'array' OR EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_snapshot->'expenseClaims') e
    WHERE e->>'tenantId' IS DISTINCT FROM p_tenant_id::text OR e->>'employeeId' IS DISTINCT FROM p_employee_id::text
      OR left(e->>'expenseDate',7) IS DISTINCT FROM to_char(make_date(p_year,p_month,1),'YYYY-MM')
  ) THEN RAISE EXCEPTION 'Die Auslagen gehören nicht zu diesem Abrechnungsmonat.'; END IF;
  SELECT coalesce(sum(coalesce(approved_amount_cents,amount_cents)),0) INTO v_approved FROM public.employee_expense_claims
    WHERE tenant_id=p_tenant_id AND employee_id=p_employee_id AND expense_date>=make_date(p_year,p_month,1)
      AND expense_date<(make_date(p_year,p_month,1)+interval '1 month') AND status IN ('approved','partially_approved') AND currency='EUR';
  IF v_approved <> (p_snapshot->>'approvedExpensesCents')::bigint THEN RAISE EXCEPTION 'Die genehmigten Auslagen wurden inzwischen geändert.'; END IF;
  SELECT id INTO v_actor FROM public.profiles WHERE tenant_id=p_tenant_id
    AND (auth_user_id=auth.uid() OR (auth_user_id IS NULL AND id=auth.uid())) AND is_active IS TRUE AND status::text='active';
  IF v_actor IS NULL OR NOT EXISTS (SELECT 1 FROM public.document_render_jobs WHERE tenant_id=p_tenant_id
    AND related_entity_table='payroll_month_statements' AND related_entity_id=p_statement_id AND pdf_path=p_pdf_path
    AND job_status='completed' AND created_by=v_actor) THEN RAISE EXCEPTION 'Der PDF-Upload wurde nicht bestätigt.'; END IF;
  UPDATE public.payroll_month_statements SET status='superseded',updated_at=now() WHERE tenant_id=p_tenant_id
    AND employee_id=p_employee_id AND period_year=p_year AND period_month=p_month AND status IN ('published','rejected');
  INSERT INTO public.payroll_month_statements(id,tenant_id,employee_id,period_year,period_month,version,status,snapshot_json,
    actual_work_minutes,travel_minutes,paid_absence_minutes,planned_minutes,payable_minutes,overtime_transfer_minutes,
    earned_gross_cents,projected_gross_cents,approved_expenses_cents,projected_payout_cents,pdf_path,pdf_sha256,published_at,published_by,created_by)
  VALUES(p_statement_id,p_tenant_id,p_employee_id,p_year,p_month,p_expected_version+1,'published',p_snapshot,
    (p_snapshot->>'actualWorkMinutes')::integer,(p_snapshot->>'travelMinutes')::integer,
    (p_snapshot->>'vacationMinutes')::integer+(p_snapshot->>'sickMinutes')::integer+(p_snapshot->>'otherPaidAbsenceMinutes')::integer,
    (p_snapshot->>'plannedMinutes')::integer,(p_snapshot->>'payableMinutes')::integer,(p_snapshot->>'overtimeTransferMinutes')::integer,
    (p_snapshot->>'earnedGrossCents')::integer,(p_snapshot->>'projectedGrossCents')::integer,(p_snapshot->>'approvedExpensesCents')::integer,
    (p_snapshot->>'projectedTotalPayoutCents')::integer,p_pdf_path,p_pdf_sha256,now(),auth.uid(),auth.uid()) RETURNING * INTO v_created;
  -- Check after the insert so the exact-reference read policy also supports HR
  -- roles without general document access. Any failure rolls the entire call back.
  IF NOT EXISTS (SELECT 1 FROM storage.objects WHERE bucket_id='office-documents' AND name=p_pdf_path
    AND metadata->>'mimetype'='application/pdf' AND coalesce((metadata->>'size')::bigint,0)>0) THEN
    RAISE EXCEPTION 'Die gespeicherte PDF-Datei ist nicht verfügbar.';
  END IF;
  INSERT INTO public.payroll_month_audit_log(tenant_id,statement_id,employee_id,action,actor_id,summary,metadata)
    VALUES(p_tenant_id,p_statement_id,p_employee_id,'published',auth.uid(),format('Monatsübersicht Version %s veröffentlicht.',p_expected_version+1),
      jsonb_build_object('pdf_sha256',p_pdf_sha256,'source_revision',p_source_revision,'replaces',v_latest.id));
  RETURN v_created;
END
$body$;
REVOKE ALL ON FUNCTION public.publish_office_payroll_statement(uuid,uuid,integer,integer,uuid,integer,timestamptz,text,jsonb,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.publish_office_payroll_statement(uuid,uuid,integer,integer,uuid,integer,timestamptz,text,jsonb,text,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.review_office_payroll_expense(
  p_tenant_id uuid,p_employee_id uuid,p_year integer,p_month integer,p_claim_id uuid,p_expected_updated_at timestamptz,
  p_status text,p_approved_amount_cents integer,p_office_note text,p_rejection_reason text
)
RETURNS public.employee_expense_claims LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $body$
DECLARE v_claim public.employee_expense_claims; v_before text;
BEGIN
  IF auth.uid() IS NULL OR p_tenant_id IS DISTINCT FROM public.current_tenant_id()
    OR NOT care_security.office_actor(p_tenant_id,'office.employees.edit')
    OR NOT care_security.office_actor(p_tenant_id,'office.employees.view') THEN
    RAISE EXCEPTION 'Keine Berechtigung zur Auslagenprüfung.' USING ERRCODE='42501';
  END IF;
  IF p_year IS NULL OR p_year NOT BETWEEN 2000 AND 2100 OR p_month IS NULL OR p_month NOT BETWEEN 1 AND 12
    OR p_expected_updated_at IS NULL OR p_status IS NULL OR p_status NOT IN ('approved','partially_approved','rejected','needs_info') THEN
    RAISE EXCEPTION 'Prüfentscheidung oder Bearbeitungsstand fehlt.';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(concat_ws(':','payroll-office',p_tenant_id,p_employee_id,p_year,p_month),0));
  SELECT * INTO v_claim FROM public.employee_expense_claims WHERE id=p_claim_id AND tenant_id=p_tenant_id
    AND employee_id=p_employee_id AND expense_date>=make_date(p_year,p_month,1)
    AND expense_date<(make_date(p_year,p_month,1)+interval '1 month') FOR UPDATE;
  IF NOT FOUND OR v_claim.updated_at IS DISTINCT FROM p_expected_updated_at OR v_claim.status NOT IN ('submitted','needs_info') THEN
    RAISE EXCEPTION 'Der Beleg wurde inzwischen geändert oder geprüft. Bitte aktualisieren.' USING ERRCODE='40001';
  END IF;
  IF EXISTS (SELECT 1 FROM public.payroll_month_statements WHERE tenant_id=p_tenant_id AND employee_id=p_employee_id
    AND period_year=p_year AND period_month=p_month AND status IN ('confirmed','locked','paid')) THEN
    RAISE EXCEPTION 'Dieser Monat ist bereits bestätigt, gesperrt oder ausgezahlt. Die Auslage muss als Korrektur geklärt werden.';
  END IF;
  IF v_claim.currency <> 'EUR' THEN RAISE EXCEPTION 'Diese Auslage muss vor der Freigabe in EUR geklärt werden.'; END IF;
  IF p_status IN ('approved','partially_approved') AND (p_approved_amount_cents IS NULL OR p_approved_amount_cents<0
    OR p_approved_amount_cents>v_claim.amount_cents
    OR (p_status='approved' AND p_approved_amount_cents<>v_claim.amount_cents)
    OR (p_status='partially_approved' AND p_approved_amount_cents>=v_claim.amount_cents)) THEN
    RAISE EXCEPTION 'Der genehmigte Betrag passt nicht zur Prüfentscheidung.';
  END IF;
  IF p_status IN ('partially_approved','needs_info') AND length(btrim(coalesce(p_office_note,'')))<5 THEN
    RAISE EXCEPTION 'Bitte die Kürzung oder Rückfrage mit mindestens fünf Zeichen begründen.';
  END IF;
  IF p_status='rejected' AND length(btrim(coalesce(p_rejection_reason,'')))<5 THEN
    RAISE EXCEPTION 'Bitte die Ablehnung mit mindestens fünf Zeichen begründen.';
  END IF;
  v_before:=v_claim.status;
  -- An approval is not a tax classification. Preserve tax_treatment unchanged.
  UPDATE public.employee_expense_claims SET status=p_status,
    approved_amount_cents=CASE WHEN p_status IN ('approved','partially_approved') THEN p_approved_amount_cents ELSE NULL END,
    office_note=nullif(btrim(p_office_note),''),rejection_reason=CASE WHEN p_status='rejected' THEN nullif(btrim(p_rejection_reason),'') ELSE NULL END,
    reviewed_at=now(),reviewed_by=auth.uid(),updated_at=now() WHERE id=v_claim.id AND tenant_id=p_tenant_id RETURNING * INTO v_claim;
  INSERT INTO public.payroll_month_audit_log(tenant_id,expense_claim_id,employee_id,action,actor_id,summary,metadata)
    VALUES(p_tenant_id,p_claim_id,p_employee_id,'expense_reviewed',auth.uid(),'Auslage geprüft.',
      jsonb_build_object('previous_status',v_before,'status',v_claim.status,'approved_amount_cents',v_claim.approved_amount_cents,
        'office_note',v_claim.office_note,'rejection_reason',v_claim.rejection_reason,'tax_treatment',v_claim.tax_treatment));
  RETURN v_claim;
END
$body$;
REVOKE ALL ON FUNCTION public.review_office_payroll_expense(uuid,uuid,integer,integer,uuid,timestamptz,text,integer,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.review_office_payroll_expense(uuid,uuid,integer,integer,uuid,timestamptz,text,integer,text,text) TO authenticated;
COMMIT;
