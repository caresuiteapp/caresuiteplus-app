-- Published snapshots are the ledger for skipped work and later catch-up claims.
-- Keep the existing RLS, source revision, immutable-version and PDF checks.
BEGIN;
CREATE OR REPLACE FUNCTION public.payroll_office_assert_time_rollovers(
  p_tenant_id uuid,p_employee_id uuid,p_year integer,p_month integer,p_snapshot jsonb
) RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $body$
DECLARE
  v_pending jsonb := coalesce(p_snapshot->'deferredTimeEntries','[]'::jsonb);
  v_catchup jsonb := coalesce(p_snapshot->'catchUpTimeEntries','[]'::jsonb);
  v_history_pending jsonb; v_history_claims jsonb;
  v_item jsonb; v_existing jsonb; v_origin integer;
  v_period integer := p_year*12+p_month;
  v_sum bigint := 0; v_day date;
BEGIN
  IF auth.uid() IS NULL OR p_tenant_id IS DISTINCT FROM public.current_tenant_id()
    OR NOT care_security.office_actor(p_tenant_id,'office.employees.view')
    OR NOT care_security.office_actor(p_tenant_id,'office.employees.edit') THEN
    RAISE EXCEPTION 'Keine Berechtigung zur Zeitnachberechnung.' USING ERRCODE='42501';
  END IF;
  IF jsonb_typeof(v_pending)<>'array' OR jsonb_typeof(v_catchup)<>'array' THEN
    RAISE EXCEPTION 'Die zurückgestellten Zeiten sind unvollständig.';
  END IF;
  SELECT coalesce(jsonb_agg(item),'[]'::jsonb) INTO v_history_pending
  FROM public.payroll_month_statements s CROSS JOIN LATERAL
    jsonb_array_elements(CASE WHEN jsonb_typeof(s.snapshot_json->'deferredTimeEntries')='array'
      THEN s.snapshot_json->'deferredTimeEntries' ELSE '[]'::jsonb END) item
  WHERE s.tenant_id=p_tenant_id AND s.employee_id=p_employee_id AND s.status<>'draft';
  SELECT coalesce(jsonb_agg(jsonb_build_object('period',s.period_year*12+s.period_month,'item',item)),'[]'::jsonb)
    INTO v_history_claims
  FROM public.payroll_month_statements s CROSS JOIN LATERAL
    jsonb_array_elements(CASE WHEN jsonb_typeof(s.snapshot_json->'catchUpTimeEntries')='array'
      THEN s.snapshot_json->'catchUpTimeEntries' ELSE '[]'::jsonb END) item
  WHERE s.tenant_id=p_tenant_id AND s.employee_id=p_employee_id AND s.status<>'draft';

  IF EXISTS(SELECT 1 FROM jsonb_array_elements(v_pending) item GROUP BY item->>'key' HAVING count(*)>1)
    OR EXISTS(SELECT 1 FROM jsonb_array_elements(v_catchup) item GROUP BY item->>'key' HAVING count(*)>1)
    OR EXISTS(SELECT 1 FROM jsonb_array_elements(v_catchup) item GROUP BY item->>'sourceEntryId' HAVING count(*)>1) THEN
    RAISE EXCEPTION 'Eine Zeit darf nicht doppelt nachberechnet werden.';
  END IF;
  FOR v_item IN SELECT value FROM jsonb_array_elements(v_pending||v_catchup) LOOP
    IF jsonb_typeof(v_item)<>'object' OR coalesce(v_item->>'workDate','')!~'^\d{4}-\d{2}-\d{2}$'
      OR coalesce(v_item->>'entryId','')='' OR length(v_item->>'entryId')>500
      OR v_item->>'key' IS DISTINCT FROM left(v_item->>'workDate',7)||':'||(v_item->>'entryId') THEN
      RAISE EXCEPTION 'Die Herkunft einer zurückgestellten Zeit ist ungültig.';
    END IF;
    v_day := (v_item->>'workDate')::date;
    IF (v_item->>'originYear')::integer IS DISTINCT FROM extract(year FROM v_day)::integer
      OR (v_item->>'originMonth')::integer IS DISTINCT FROM extract(month FROM v_day)::integer THEN
      RAISE EXCEPTION 'Der Ursprungsmonat einer Zeit stimmt nicht überein.';
    END IF;
    v_origin := extract(year FROM v_day)::integer*12+extract(month FROM v_day)::integer;
    IF v_origin>v_period THEN RAISE EXCEPTION 'Eine zukünftige Zeit kann nicht zurückgestellt werden.'; END IF;
    IF v_origin<v_period AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(v_history_pending) prior
      WHERE prior->>'key'=v_item->>'key' AND prior->>'entryId'=v_item->>'entryId' AND prior->>'workDate'=v_item->>'workDate') THEN
      RAISE EXCEPTION 'Die Zeit wurde nicht in einer früheren Monatsübersicht zurückgestellt.';
    END IF;
  END LOOP;
  -- Reissuing the origin month must never turn an already deferred item back
  -- into current work, even if it was corrected after that month's publication.
  FOR v_existing IN SELECT value FROM jsonb_array_elements(v_history_pending) LOOP
    IF (v_existing->>'originYear')::integer*12+(v_existing->>'originMonth')::integer=v_period
      AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(v_pending) item WHERE item->>'key'=v_existing->>'key') THEN
      RAISE EXCEPTION 'Bereits zurückgestellte Zeiten bleiben im Ursprungsmonat ausgeschlossen. Bitte aktualisieren.' USING ERRCODE='40001';
    END IF;
  END LOOP;
  FOR v_item IN SELECT value FROM jsonb_array_elements(v_catchup) LOOP
    v_origin := (v_item->>'originYear')::integer*12+(v_item->>'originMonth')::integer;
    IF v_origin>=v_period OR coalesce(v_item->>'sourceEntryId','')=''
      OR jsonb_typeof(v_item->'minutes') IS DISTINCT FROM 'number'
      OR jsonb_typeof(v_item->'travelMinutes') IS DISTINCT FROM 'number'
      OR (v_item->>'minutes')::numeric<0 OR (v_item->>'minutes')::numeric>2147483647
      OR trunc((v_item->>'minutes')::numeric)<>(v_item->>'minutes')::numeric
      OR (v_item->>'travelMinutes')::numeric<0 OR (v_item->>'travelMinutes')::numeric>(v_item->>'minutes')::numeric
      OR trunc((v_item->>'travelMinutes')::numeric)<>(v_item->>'travelMinutes')::numeric
      OR (v_item->>'actualStartAt') IS NULL OR (v_item->>'actualEndAt') IS NULL
      OR (v_item->>'actualEndAt')::timestamptz<(v_item->>'actualStartAt')::timestamptz
      OR (v_item->>'actualEndAt')::timestamptz>now() THEN
      RAISE EXCEPTION 'Nur abgeschlossene und geprüfte Zeiten aus einem Vormonat können nachberechnet werden.';
    END IF;
    IF EXISTS(SELECT 1 FROM jsonb_array_elements(v_history_claims) prior WHERE
      (prior->'item'->>'key'=v_item->>'key' AND ((prior->>'period')::integer<>v_period OR prior->'item'<>v_item))
      OR (prior->'item'->>'sourceEntryId'=v_item->>'sourceEntryId' AND prior->'item'->>'key'<>v_item->>'key')) THEN
      RAISE EXCEPTION 'Diese Zeit wurde bereits in einer anderen Monatsübersicht berücksichtigt. Bitte aktualisieren.' USING ERRCODE='40001';
    END IF;
    v_sum := v_sum+(v_item->>'minutes')::bigint;
  END LOOP;
  -- A new version carries the same previously settled catch-up entries. It does
  -- not release them for another month or silently change their frozen minutes.
  FOR v_existing IN SELECT value FROM jsonb_array_elements(v_history_claims) LOOP
    IF (v_existing->>'period')::integer=v_period
      AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(v_catchup) item WHERE item=v_existing->'item') THEN
      RAISE EXCEPTION 'Bereits berücksichtigte Nachberechnungen fehlen. Bitte die Monatsdaten aktualisieren.' USING ERRCODE='40001';
    END IF;
  END LOOP;
  IF p_snapshot ? 'currentPeriodWorkMinutes' OR p_snapshot ? 'catchUpWorkMinutes' OR jsonb_array_length(v_catchup)>0 THEN
    IF jsonb_typeof(p_snapshot->'currentPeriodWorkMinutes') IS DISTINCT FROM 'number'
      OR jsonb_typeof(p_snapshot->'catchUpWorkMinutes') IS DISTINCT FROM 'number'
      OR (p_snapshot->>'currentPeriodWorkMinutes')::numeric<0
      OR trunc((p_snapshot->>'currentPeriodWorkMinutes')::numeric)<>(p_snapshot->>'currentPeriodWorkMinutes')::numeric
      OR (p_snapshot->>'catchUpWorkMinutes')::numeric<0
      OR trunc((p_snapshot->>'catchUpWorkMinutes')::numeric)<>(p_snapshot->>'catchUpWorkMinutes')::numeric
      OR (p_snapshot->>'catchUpWorkMinutes')::bigint<>v_sum
      OR (p_snapshot->>'actualWorkMinutes')::bigint<>(p_snapshot->>'currentPeriodWorkMinutes')::bigint+v_sum THEN
      RAISE EXCEPTION 'Die Nachberechnung stimmt nicht mit der vergütbaren Arbeitszeit überein.';
    END IF;
  END IF;
END
$body$;
REVOKE ALL ON FUNCTION public.payroll_office_assert_time_rollovers(uuid,uuid,integer,integer,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.payroll_office_assert_time_rollovers(uuid,uuid,integer,integer,jsonb) TO authenticated;

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
  -- Serialize cross-month catch-up claims for this employee as well as the month.
  PERFORM pg_advisory_xact_lock(hashtextextended(concat_ws(':','payroll-office-time',p_tenant_id,p_employee_id),0));
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
  PERFORM public.payroll_office_assert_time_rollovers(p_tenant_id,p_employee_id,p_year,p_month,p_snapshot);
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

COMMIT;
