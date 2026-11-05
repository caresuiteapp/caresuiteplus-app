BEGIN;
-- An explicit Office decision assigns corrected deferred work to one payroll period.
-- Source approvals and payroll reservations commit together. Published snapshots stay immutable.
CREATE TABLE IF NOT EXISTS public.payroll_time_acceptances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  employee_id uuid NOT NULL REFERENCES public.employees(id),
  deferred_key text NOT NULL, work_date date NOT NULL,
  target_year integer NOT NULL CHECK(target_year BETWEEN 2000 AND 2100),
  target_month integer NOT NULL CHECK(target_month BETWEEN 1 AND 12),
  review_id uuid NOT NULL REFERENCES public.workforce_time_entry_reviews(id),
  review_updated_at timestamptz NOT NULL, submitted_review_updated_at timestamptz NOT NULL,
  source_entry_id text NOT NULL, office_entry jsonb NOT NULL CHECK(jsonb_typeof(office_entry)='object'),
  accepted_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(), updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE(tenant_id,employee_id,deferred_key), UNIQUE(tenant_id,employee_id,source_entry_id)
);
CREATE INDEX IF NOT EXISTS payroll_time_acceptances_review_idx ON public.payroll_time_acceptances(review_id);
ALTER TABLE public.payroll_time_acceptances ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.payroll_time_acceptances FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.payroll_time_acceptances TO authenticated;
CREATE POLICY payroll_time_acceptances_read ON public.payroll_time_acceptances FOR SELECT TO authenticated
  USING(tenant_id=(SELECT public.current_tenant_id()) AND
    (care_security.office_actor(tenant_id,'office.employees.view') OR employee_id=(SELECT public.resolve_current_employee_id())));
CREATE SCHEMA IF NOT EXISTS care_time_private;
REVOKE ALL ON SCHEMA care_time_private FROM PUBLIC,anon;
GRANT USAGE ON SCHEMA care_time_private TO authenticated;

CREATE OR REPLACE FUNCTION care_time_private.accept_corrected_payroll_time(
  p_tenant_id uuid,p_employee_id uuid,p_deferred_key text,p_review_id uuid,
  p_expected_review_updated_at timestamptz,p_target_year integer,p_target_month integer,
  p_expected_acceptance_updated_at timestamptz DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $body$
DECLARE
  r public.workforce_time_entry_reviews; a public.payroll_time_acceptances; saved public.payroll_time_acceptances;
  origin_statement uuid; item jsonb; entry jsonb; target_period integer; source_id text;
BEGIN
  IF auth.uid() IS NULL OR p_tenant_id IS DISTINCT FROM public.current_tenant_id()
    OR NOT care_security.office_actor(p_tenant_id,'office.employees.view')
    OR NOT care_security.office_actor(p_tenant_id,'office.employees.edit') THEN
    RAISE EXCEPTION 'Keine Berechtigung zur Zeitannahme.' USING ERRCODE='42501';
  END IF;
  IF p_target_year IS NULL OR p_target_year NOT BETWEEN 2000 AND 2100 OR p_target_month IS NULL OR p_target_month NOT BETWEEN 1 AND 12
    OR p_deferred_key IS NULL OR p_review_id IS NULL OR p_expected_review_updated_at IS NULL THEN
    RAISE EXCEPTION 'Zeitkorrektur und Abrechnungsmonat müssen vollständig sein.' USING ERRCODE='22023';
  END IF;
  target_period:=p_target_year*12+p_target_month;
  PERFORM pg_advisory_xact_lock(hashtextextended(concat_ws(':','payroll-office-time',p_tenant_id,p_employee_id),0));
  SELECT s.id,value INTO origin_statement,item FROM public.payroll_month_statements s CROSS JOIN LATERAL
    jsonb_array_elements(CASE WHEN jsonb_typeof(s.snapshot_json->'deferredTimeEntries')='array' THEN s.snapshot_json->'deferredTimeEntries' ELSE '[]'::jsonb END)
    WHERE s.tenant_id=p_tenant_id AND s.employee_id=p_employee_id AND s.status<>'draft' AND value->>'key'=p_deferred_key
    ORDER BY s.period_year,s.period_month,s.version LIMIT 1;
  IF origin_statement IS NULL THEN RAISE EXCEPTION 'Diese Zeit wurde noch nicht in einer Monatsübersicht zurückgestellt.' USING ERRCODE='42501'; END IF;
  IF target_period < (item->>'originYear')::integer*12+(item->>'originMonth')::integer THEN
    RAISE EXCEPTION 'Die Zeit kann nicht vor ihrem ursprünglichen Arbeitsmonat angenommen werden.' USING ERRCODE='22023';
  END IF;
  IF EXISTS(SELECT 1 FROM public.payroll_month_statements WHERE tenant_id=p_tenant_id AND employee_id=p_employee_id
    AND period_year=p_target_year AND period_month=p_target_month AND status IN ('confirmed','locked','paid')) THEN
    RAISE EXCEPTION 'Die Abrechnung ist bestätigt, gesperrt oder ausgezahlt. Bitte einen offenen Folgemonat wählen.' USING ERRCODE='55000';
  END IF;
  SELECT * INTO r FROM public.workforce_time_entry_reviews WHERE tenant_id=p_tenant_id AND employee_id=p_employee_id AND id=p_review_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Eigene Zeitkorrektur nicht gefunden.' USING ERRCODE='42501'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(r.reference_key,0));
  SELECT * INTO r FROM public.workforce_time_entry_reviews WHERE tenant_id=p_tenant_id AND employee_id=p_employee_id AND id=p_review_id FOR UPDATE;
  entry:=r.metadata->'office_time_entry'; source_id:=entry->>'id';
  IF r.work_date::text IS DISTINCT FROM item->>'workDate' OR jsonb_typeof(entry) IS DISTINCT FROM 'object'
    OR entry->>'tenantId' IS DISTINCT FROM p_tenant_id::text OR entry->>'employeeId' IS DISTINCT FROM p_employee_id::text
    OR entry->>'workDate' IS DISTINCT FROM item->>'workDate' OR coalesce(source_id,'')=''
    OR NOT (source_id=item->>'entryId' OR (
      ((item->>'visitId' IS NOT NULL AND entry->>'visitId'=item->>'visitId') OR (item->>'assignmentId' IS NOT NULL AND entry->>'assignmentId'=item->>'assignmentId'))
      AND (item->>'plannedStartAt' IS NULL OR (entry->>'plannedStartAt')::timestamptz=(item->>'plannedStartAt')::timestamptz))) THEN
    RAISE EXCEPTION 'Die korrigierte Buchung gehört nicht eindeutig zu dieser zurückgestellten Zeit.' USING ERRCODE='42501';
  END IF;
  IF EXISTS(SELECT 1 FROM public.payroll_month_statements s CROSS JOIN LATERAL
    jsonb_array_elements(CASE WHEN jsonb_typeof(s.snapshot_json->'catchUpTimeEntries')='array' THEN s.snapshot_json->'catchUpTimeEntries' ELSE '[]'::jsonb END) c
    WHERE s.tenant_id=p_tenant_id AND s.employee_id=p_employee_id AND s.status<>'draft'
      AND (c->>'key'=p_deferred_key OR c->>'sourceEntryId'=source_id)) THEN
    RAISE EXCEPTION 'Diese Zeit wurde bereits in einer veröffentlichten Abrechnung berücksichtigt.' USING ERRCODE='55000';
  END IF;
  SELECT * INTO a FROM public.payroll_time_acceptances WHERE tenant_id=p_tenant_id AND employee_id=p_employee_id AND deferred_key=p_deferred_key FOR UPDATE;
  IF a.id IS NOT NULL AND a.target_year=p_target_year AND a.target_month=p_target_month AND a.office_entry=entry
    AND r.updated_at=a.review_updated_at AND p_expected_review_updated_at IN (a.submitted_review_updated_at,a.review_updated_at) THEN
    RETURN to_jsonb(a); -- Lost-response retry: do not approve or audit twice.
  END IF;
  IF r.updated_at IS DISTINCT FROM p_expected_review_updated_at OR a.updated_at IS DISTINCT FROM p_expected_acceptance_updated_at THEN
    RAISE EXCEPTION 'Zeitkorrektur oder Annahme wurde inzwischen geändert. Bitte aktualisieren.' USING ERRCODE='40001';
  END IF;
  IF r.review_status NOT IN ('approved','open','pending_review','corrected') OR r.export_status IN ('exported','changed_after_export') THEN
    RAISE EXCEPTION 'Die Zeit muss zuerst im Zeitkonto geklärt werden.' USING ERRCODE='55000';
  END IF;
  IF r.review_status<>'approved' THEN
    SELECT * INTO r FROM public.wfm_review_office_time_entry(p_tenant_id,p_employee_id,r.work_date,r.entry_kind,r.reference_id,r.reference_key,
      'approved','Nachbearbeitete Zeit für die Gehaltsstatistik angenommen.',r.updated_at,entry);
    IF r.id IS NULL THEN RAISE EXCEPTION 'Die Zeitfreigabe wurde nicht bestätigt.'; END IF;
  END IF;
  entry:=r.metadata->'office_time_entry';
  IF r.review_status<>'approved' OR (entry->>'actualStartAt') IS NULL OR (entry->>'actualEndAt') IS NULL
    OR NOT isfinite((entry->>'actualStartAt')::timestamptz) OR NOT isfinite((entry->>'actualEndAt')::timestamptz)
    OR (entry->>'actualEndAt')::timestamptz<=(entry->>'actualStartAt')::timestamptz OR (entry->>'actualEndAt')::timestamptz>clock_timestamp()
    OR (entry->>'pauseMinutes') IS NULL OR (entry->>'pauseMinutes')::numeric<0 OR trunc((entry->>'pauseMinutes')::numeric)<>(entry->>'pauseMinutes')::numeric
    OR (entry->>'netMinutes') IS NULL OR (entry->>'netMinutes')::numeric<>greatest(0,round(extract(epoch FROM ((entry->>'actualEndAt')::timestamptz-(entry->>'actualStartAt')::timestamptz))/60)-(entry->>'pauseMinutes')::numeric)
    OR (entry->>'pauseMinutes')::numeric>round(extract(epoch FROM ((entry->>'actualEndAt')::timestamptz-(entry->>'actualStartAt')::timestamptz))/60) THEN
    RAISE EXCEPTION 'Nur gültige abgeschlossene und freigegebene Zeiten können angenommen werden.' USING ERRCODE='22023';
  END IF;
  IF EXISTS(SELECT 1 FROM public.payroll_time_acceptances WHERE tenant_id=p_tenant_id AND employee_id=p_employee_id
    AND source_entry_id=source_id AND deferred_key<>p_deferred_key) THEN
    RAISE EXCEPTION 'Diese Buchung ist bereits über eine andere zurückgestellte Zeit angenommen.' USING ERRCODE='55000';
  END IF;
  INSERT INTO public.payroll_time_acceptances(tenant_id,employee_id,deferred_key,work_date,target_year,target_month,review_id,review_updated_at,
    submitted_review_updated_at,source_entry_id,office_entry,accepted_by)
    VALUES(p_tenant_id,p_employee_id,p_deferred_key,r.work_date,p_target_year,p_target_month,r.id,r.updated_at,p_expected_review_updated_at,source_id,entry,auth.uid())
    ON CONFLICT(tenant_id,employee_id,deferred_key) DO UPDATE SET target_year=excluded.target_year,target_month=excluded.target_month,
      review_id=excluded.review_id,review_updated_at=excluded.review_updated_at,submitted_review_updated_at=excluded.submitted_review_updated_at,
      source_entry_id=excluded.source_entry_id,office_entry=excluded.office_entry,accepted_by=excluded.accepted_by,updated_at=clock_timestamp() RETURNING * INTO saved;
  INSERT INTO public.payroll_month_audit_log(tenant_id,statement_id,employee_id,action,actor_id,summary,metadata)
    VALUES(p_tenant_id,origin_statement,p_employee_id,'time_accepted',auth.uid(),'Nachbearbeitete Zeit für einen Abrechnungsmonat angenommen.',
      jsonb_build_object('acceptance_id',saved.id,'deferred_key',p_deferred_key,'target_year',p_target_year,'target_month',p_target_month,'previous',to_jsonb(a),'accepted',to_jsonb(saved)));
  RETURN to_jsonb(saved);
END
$body$;
REVOKE ALL ON FUNCTION care_time_private.accept_corrected_payroll_time(uuid,uuid,text,uuid,timestamptz,integer,integer,timestamptz) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION care_time_private.accept_corrected_payroll_time(uuid,uuid,text,uuid,timestamptz,integer,integer,timestamptz) TO authenticated;
CREATE OR REPLACE FUNCTION public.payroll_accept_corrected_time(
  p_tenant_id uuid,p_employee_id uuid,p_deferred_key text,p_review_id uuid,p_expected_review_updated_at timestamptz,
  p_target_year integer,p_target_month integer,p_expected_acceptance_updated_at timestamptz DEFAULT NULL
) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $body$
  SELECT care_time_private.accept_corrected_payroll_time(p_tenant_id,p_employee_id,p_deferred_key,p_review_id,p_expected_review_updated_at,p_target_year,p_target_month,p_expected_acceptance_updated_at);
$body$;
REVOKE ALL ON FUNCTION public.payroll_accept_corrected_time(uuid,uuid,text,uuid,timestamptz,integer,integer,timestamptz) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.payroll_accept_corrected_time(uuid,uuid,text,uuid,timestamptz,integer,integer,timestamptz) TO authenticated;

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
      AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(v_pending||v_catchup) item WHERE item->>'key'=v_existing->>'key') THEN
      RAISE EXCEPTION 'Bereits zurückgestellte Zeiten bleiben im Ursprungsmonat ausgeschlossen. Bitte aktualisieren.' USING ERRCODE='40001';
    END IF;
  END LOOP;
  FOR v_item IN SELECT value FROM jsonb_array_elements(v_catchup) LOOP
    v_origin := (v_item->>'originYear')::integer*12+(v_item->>'originMonth')::integer;
    IF v_origin>v_period OR coalesce(v_item->>'sourceEntryId','')=''
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
    -- Frozen claims may be reissued unchanged; every new claim needs an explicit
    -- acceptance for exactly this period and the still-approved time values.
    IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(v_history_claims) prior WHERE (prior->>'period')::integer=v_period AND prior->'item'=v_item) THEN
      IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(v_history_pending) prior WHERE prior->>'key'=v_item->>'key')
        OR NOT EXISTS(SELECT 1 FROM public.payroll_time_acceptances a JOIN public.workforce_time_entry_reviews r
          ON r.id=a.review_id AND r.tenant_id=a.tenant_id AND r.employee_id=a.employee_id
          WHERE a.tenant_id=p_tenant_id AND a.employee_id=p_employee_id AND a.id::text=v_item->>'acceptanceId'
            AND a.deferred_key=v_item->>'key' AND a.target_year=p_year AND a.target_month=p_month
            AND a.source_entry_id=v_item->>'sourceEntryId' AND a.work_date::text=v_item->>'workDate'
            AND r.review_status IN ('approved','exported','locked')
            AND (v_item->>'travelMinutes')::integer=0
            AND (a.office_entry->>'netMinutes')::integer=(v_item->>'minutes')::integer
            AND (a.office_entry->>'actualStartAt')::timestamptz=(v_item->>'actualStartAt')::timestamptz
            AND (a.office_entry->>'actualEndAt')::timestamptz=(v_item->>'actualEndAt')::timestamptz
            AND (r.metadata->'office_time_entry'->>'actualStartAt')::timestamptz=(a.office_entry->>'actualStartAt')::timestamptz
            AND (r.metadata->'office_time_entry'->>'actualEndAt')::timestamptz=(a.office_entry->>'actualEndAt')::timestamptz
            AND r.metadata->'office_time_entry'->'pauseMinutes'=a.office_entry->'pauseMinutes'
            AND r.metadata->'office_time_entry'->'netMinutes'=a.office_entry->'netMinutes'
            AND r.metadata->'office_time_entry'->'workKind'=a.office_entry->'workKind') THEN
        RAISE EXCEPTION 'Die Zeit ist für diesen Monat nicht mit den aktuellen Zeitwerten angenommen. Bitte aktualisieren.' USING ERRCODE='40001';
      END IF;
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
    'payroll_time_acceptances','workforce_time_entry_reviews','workforce_time_accounts','workforce_absences','employee_logbook_trips'] LOOP
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


NOTIFY pgrst, 'reload schema';

COMMIT;
