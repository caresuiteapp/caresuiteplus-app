-- Persist Office time corrections and additions atomically with their review.
-- Additive RPC; no historical entries are changed by this migration.
CREATE OR REPLACE FUNCTION public.wfm_save_office_time_entry(
  p_tenant_id UUID, p_employee_id UUID, p_work_date DATE,
  p_entry_kind TEXT, p_reference_id UUID, p_reference_key TEXT,
  p_office_entry JSONB, p_reason TEXT, p_expected_updated_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS SETOF public.workforce_time_entry_reviews
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_previous public.workforce_time_entry_reviews%ROWTYPE;
  v_review public.workforce_time_entry_reviews%ROWTYPE;
  v_start TIMESTAMPTZ;
  v_end TIMESTAMPTZ;
  v_pause NUMERIC;
  v_status TEXT;
  v_snapshot JSONB;
BEGIN
  IF auth.uid() IS NULL OR p_tenant_id IS DISTINCT FROM public.current_tenant_id()
    OR NOT (public.has_permission('time.tracking.admin.correct') OR public.is_tenant_admin()) THEN
    RAISE EXCEPTION 'Keine Berechtigung für Arbeitszeitkorrekturen in diesem Mandanten' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.employees WHERE tenant_id = p_tenant_id AND id = p_employee_id) THEN
    RAISE EXCEPTION 'Mitarbeitende sind diesem Mandanten nicht zugeordnet' USING ERRCODE = '23503';
  END IF;
  IF p_entry_kind NOT IN ('session', 'visit', 'manual', 'meeting')
    OR p_reference_key IS DISTINCT FROM concat_ws(':', p_tenant_id, p_employee_id, p_work_date, p_entry_kind, p_reference_id)
    OR p_reference_id IS NULL OR p_work_date IS NULL THEN
    RAISE EXCEPTION 'Ungültige Buchungsreferenz' USING ERRCODE = '22023';
  END IF;
  IF NULLIF(btrim(p_reason), '') IS NULL OR jsonb_typeof(p_office_entry) IS DISTINCT FROM 'object'
    OR NULLIF(p_office_entry->>'id', '') IS NULL
    OR jsonb_typeof(p_office_entry->'flags') IS DISTINCT FROM 'array'
    OR COALESCE(p_office_entry->>'source', '') NOT IN ('correction', 'manual_addition')
    OR COALESCE(p_office_entry->>'workKind', '') NOT IN ('einsatz','buero','homeoffice','fahrt','pause','korrektur','nachtrag','sonstige') THEN
    RAISE EXCEPTION 'Buchungsdaten und Begründung sind erforderlich' USING ERRCODE = '22023';
  END IF;
  v_start := (p_office_entry->>'actualStartAt')::timestamptz;
  v_end := (p_office_entry->>'actualEndAt')::timestamptz;
  v_pause := (p_office_entry->>'pauseMinutes')::numeric;
  IF v_start IS NULL OR v_end IS NULL OR NOT isfinite(v_start) OR NOT isfinite(v_end)
    OR v_end <= v_start OR v_pause IS NULL OR v_pause <> trunc(v_pause)
    OR v_pause < 0 OR v_pause > round(extract(epoch FROM (v_end - v_start)) / 60) THEN
    RAISE EXCEPTION 'Beginn, Ende oder Pause sind ungültig' USING ERRCODE = '22023';
  END IF;
  v_status := CASE WHEN p_office_entry->>'source' = 'manual_addition' THEN 'pending_review' ELSE 'corrected' END;
  v_snapshot := (p_office_entry - 'officeRevision') || jsonb_build_object(
    'tenantId', p_tenant_id, 'employeeId', p_employee_id, 'workDate', p_work_date,
    'officeComment', btrim(p_reason), 'reviewStatus', v_status, 'status', v_status,
    'exportStatus', 'not_exported');

  -- Covers both competing first inserts and edits of an existing review.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_reference_key, 0));
  SELECT * INTO v_previous FROM public.workforce_time_entry_reviews
    WHERE tenant_id = p_tenant_id AND reference_key = p_reference_key FOR UPDATE;
  IF v_previous.review_status IN ('locked','superseded')
    OR v_previous.export_status IN ('exported','changed_after_export') THEN
    RAISE EXCEPTION 'Exportierte oder gesperrte Buchungen benötigen den gesonderten Korrekturablauf' USING ERRCODE = '55000';
  END IF;
  -- Retrying the exact same request after a lost response creates no duplicate.
  IF v_previous.metadata->'office_time_entry' = v_snapshot AND v_previous.review_status = v_status THEN
    RETURN NEXT v_previous;
    RETURN;
  END IF;
  IF v_previous.updated_at IS DISTINCT FROM p_expected_updated_at THEN
    RAISE EXCEPTION 'Die Buchung wurde inzwischen geändert. Bitte erneut laden.' USING ERRCODE = '40001';
  END IF;

  SELECT * INTO STRICT v_review FROM public.wfm_upsert_time_review(
    p_tenant_id, p_employee_id, p_work_date, p_entry_kind, p_reference_id, p_reference_key,
    v_status, TRUE, btrim(p_reason), btrim(p_reason), btrim(p_reason));
  UPDATE public.workforce_time_entry_reviews SET
    metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('office_time_entry', v_snapshot, 'office_time_entry_version', 1),
    export_status = 'not_exported', updated_at = clock_timestamp()
    WHERE tenant_id = p_tenant_id AND id = v_review.id RETURNING * INTO v_review;
  INSERT INTO public.workforce_time_review_actions (
    tenant_id, entry_review_id, action, prev_status, new_status, reason, comment,
    old_value, new_value, actor_id, source, metadata
  ) VALUES (
    p_tenant_id, v_review.id, 'comment_added', v_previous.review_status, v_status,
    btrim(p_reason), 'Zeitwerte dauerhaft gespeichert',
    v_previous.metadata->'office_time_entry', v_snapshot, auth.uid(), 'office',
    jsonb_build_object('source', 'wfm_office_time_entry_v1', 'entryId', p_office_entry->>'id'));
  RETURN NEXT v_review;
END;
$$;
REVOKE ALL ON FUNCTION public.wfm_save_office_time_entry(UUID,UUID,DATE,TEXT,UUID,TEXT,JSONB,TEXT,TIMESTAMPTZ) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.wfm_save_office_time_entry(UUID,UUID,DATE,TEXT,UUID,TEXT,JSONB,TEXT,TIMESTAMPTZ) TO authenticated;
