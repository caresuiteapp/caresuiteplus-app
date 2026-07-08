-- ==========================================================================
-- CareSuite+ — Migration 0253: WFM P2.3 — Finalize RPC Partial-Unique Fix
--
-- Fixes 0252 RPC: correction items must NOT exist as active before finalize.
-- New signature accepts p_items JSONB; RPC atomically supersedes + inserts.
--
-- Scope: WFM P2.3 ONLY. No platform. No seeds. No payload overwrite on old items.
-- ⚠️  ENTWURF — nicht remote anwenden ohne explizites Staging-Gate.
-- ==========================================================================

DROP FUNCTION IF EXISTS public.wfm_finalize_correction_export(UUID);

CREATE OR REPLACE FUNCTION public.wfm_finalize_correction_export(
  p_export_job_id UUID,
  p_items JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id   UUID;
  v_job         RECORD;
  v_actor       UUID;
  v_item        JSONB;
  v_old_item    RECORD;
  v_new_item_id UUID;
  v_review      RECORD;
  v_item_count  INTEGER := 0;
  v_old_seq     INTEGER;
  v_new_seq     INTEGER;
  v_new_ref_key TEXT;
BEGIN
  v_actor := auth.uid();
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'wfm_finalize_correction_export: authentication required';
  END IF;

  v_tenant_id := public.current_tenant_id();
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'wfm_finalize_correction_export: tenant context required';
  END IF;

  IF NOT (
    public.is_tenant_admin()
    OR public.has_permission('time.tracking.admin.export')
  ) THEN
    RAISE EXCEPTION 'wfm_finalize_correction_export: permission denied';
  END IF;

  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'wfm_finalize_correction_export: p_items required';
  END IF;

  SELECT *
  INTO v_job
  FROM public.workforce_export_jobs
  WHERE id = p_export_job_id
    AND tenant_id = v_tenant_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'wfm_finalize_correction_export: export job not found';
  END IF;

  IF v_job.export_type <> 'reviewed_time_correction' THEN
    RAISE EXCEPTION 'wfm_finalize_correction_export: not a correction export job';
  END IF;

  IF v_job.status <> 'validated' THEN
    RAISE EXCEPTION 'wfm_finalize_correction_export: job must be validated before finalize';
  END IF;

  IF v_job.correction_of_export_job_id IS NULL THEN
    RAISE EXCEPTION 'wfm_finalize_correction_export: correction_of_export_job_id required';
  END IF;

  IF v_job.correction_reason IS NULL OR length(trim(v_job.correction_reason)) < 10 THEN
    RAISE EXCEPTION 'wfm_finalize_correction_export: correction_reason required (min 10 chars)';
  END IF;

  IF v_job.export_scope IS DISTINCT FROM 'delta_correction' THEN
    RAISE EXCEPTION 'wfm_finalize_correction_export: export_scope must be delta_correction';
  END IF;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items)
  LOOP
    IF v_item->>'review_id' IS NULL OR v_item->>'review_id' = '' THEN
      RAISE EXCEPTION 'wfm_finalize_correction_export: review_id required';
    END IF;
    IF v_item->>'original_export_item_id' IS NULL OR v_item->>'original_export_item_id' = '' THEN
      RAISE EXCEPTION 'wfm_finalize_correction_export: original_export_item_id required';
    END IF;
    IF v_item->>'logical_reference_key' IS NULL OR trim(v_item->>'logical_reference_key') = '' THEN
      RAISE EXCEPTION 'wfm_finalize_correction_export: logical_reference_key required';
    END IF;
    IF v_item->>'new_reference_key' IS NULL OR trim(v_item->>'new_reference_key') = '' THEN
      RAISE EXCEPTION 'wfm_finalize_correction_export: new_reference_key required';
    END IF;
    IF v_item->>'export_sequence' IS NULL THEN
      RAISE EXCEPTION 'wfm_finalize_correction_export: export_sequence required';
    END IF;
    IF v_item->'exported_payload' IS NULL THEN
      RAISE EXCEPTION 'wfm_finalize_correction_export: exported_payload required';
    END IF;
    IF v_item->'correction_payload_delta' IS NULL THEN
      RAISE EXCEPTION 'wfm_finalize_correction_export: correction_payload_delta required';
    END IF;
    IF v_item->>'previous_payload_hash' IS NULL OR trim(v_item->>'previous_payload_hash') = '' THEN
      RAISE EXCEPTION 'wfm_finalize_correction_export: previous_payload_hash required';
    END IF;
    IF v_item->>'payload_hash' IS NULL OR trim(v_item->>'payload_hash') = '' THEN
      RAISE EXCEPTION 'wfm_finalize_correction_export: payload_hash required';
    END IF;
    IF v_item->>'correction_reason' IS NULL OR length(trim(v_item->>'correction_reason')) < 10 THEN
      RAISE EXCEPTION 'wfm_finalize_correction_export: item correction_reason required (min 10 chars)';
    END IF;
    IF v_item->>'employee_id' IS NULL OR v_item->>'employee_id' = '' THEN
      RAISE EXCEPTION 'wfm_finalize_correction_export: employee_id required';
    END IF;
    IF v_item->>'entry_kind' IS NULL OR v_item->>'entry_kind' = '' THEN
      RAISE EXCEPTION 'wfm_finalize_correction_export: entry_kind required';
    END IF;
    IF v_item->>'period_date' IS NULL OR v_item->>'period_date' = '' THEN
      RAISE EXCEPTION 'wfm_finalize_correction_export: period_date required';
    END IF;
    IF v_item->>'minutes_total' IS NULL THEN
      RAISE EXCEPTION 'wfm_finalize_correction_export: minutes_total required';
    END IF;

    v_new_seq := (v_item->>'export_sequence')::INTEGER;
    IF v_new_seq < 2 THEN
      RAISE EXCEPTION 'wfm_finalize_correction_export: export_sequence must be >= 2 for corrections';
    END IF;

    v_new_ref_key := trim(v_item->>'new_reference_key');

    IF EXISTS (
      SELECT 1
      FROM public.workforce_time_export_items
      WHERE tenant_id = v_tenant_id
        AND reference_key = v_new_ref_key
    ) THEN
      RAISE EXCEPTION
        'wfm_finalize_correction_export: new_reference_key already exists: %',
        v_new_ref_key;
    END IF;

    SELECT *
    INTO v_review
    FROM public.workforce_time_entry_reviews
    WHERE id = (v_item->>'review_id')::UUID
      AND tenant_id = v_tenant_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'wfm_finalize_correction_export: review not found';
    END IF;

    IF v_review.export_status NOT IN ('exported', 'changed_after_export') THEN
      RAISE EXCEPTION 'wfm_finalize_correction_export: review must be exported or changed_after_export';
    END IF;

    SELECT *
    INTO v_old_item
    FROM public.workforce_time_export_items
    WHERE id = (v_item->>'original_export_item_id')::UUID
      AND tenant_id = v_tenant_id
      AND item_status = 'active'
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'wfm_finalize_correction_export: active original item not found';
    END IF;

    IF v_old_item.logical_reference_key IS DISTINCT FROM trim(v_item->>'logical_reference_key') THEN
      RAISE EXCEPTION 'wfm_finalize_correction_export: logical_reference_key mismatch with original item';
    END IF;

    v_old_seq := v_old_item.export_sequence;
    IF v_new_seq <= v_old_seq THEN
      RAISE EXCEPTION
        'wfm_finalize_correction_export: export_sequence % must be greater than %',
        v_new_seq,
        v_old_seq;
    END IF;

    v_new_item_id := gen_random_uuid();

    UPDATE public.workforce_time_export_items
    SET
      item_status = 'superseded',
      superseded_at = NOW(),
      superseded_by = v_actor
    WHERE id = v_old_item.id;

    INSERT INTO public.workforce_time_export_items (
      id,
      tenant_id,
      export_job_id,
      review_id,
      employee_id,
      reference_id,
      reference_key,
      logical_reference_key,
      export_sequence,
      item_status,
      entry_kind,
      period_date,
      minutes_total,
      review_status_at_export,
      exported_payload,
      payload_hash,
      source_review_version_hash,
      previous_payload_hash,
      correction_reason,
      correction_payload_delta,
      supersedes_export_item_id,
      changed_after_export
    ) VALUES (
      v_new_item_id,
      v_tenant_id,
      p_export_job_id,
      (v_item->>'review_id')::UUID,
      (v_item->>'employee_id')::UUID,
      NULLIF(v_item->>'reference_id', '')::UUID,
      v_new_ref_key,
      trim(v_item->>'logical_reference_key'),
      v_new_seq,
      'active',
      v_item->>'entry_kind',
      (v_item->>'period_date')::date,
      (v_item->>'minutes_total')::INTEGER,
      'approved',
      v_item->'exported_payload',
      trim(v_item->>'payload_hash'),
      NULLIF(trim(v_item->>'source_review_version_hash'), ''),
      trim(v_item->>'previous_payload_hash'),
      trim(v_item->>'correction_reason'),
      v_item->'correction_payload_delta',
      v_old_item.id,
      FALSE
    );

    UPDATE public.workforce_time_export_items
    SET superseded_by_export_item_id = v_new_item_id
    WHERE id = v_old_item.id;

    UPDATE public.workforce_time_entry_reviews
    SET
      export_status = 'exported',
      changed_after_export = FALSE,
      changed_after_export_detected_at = NULL,
      changed_after_export_reason = NULL,
      latest_export_item_id = v_new_item_id,
      last_export_job_id = p_export_job_id,
      last_exported_at = NOW(),
      pending_reexport_job_id = NULL,
      export_version = export_version + 1
    WHERE id = (v_item->>'review_id')::UUID
      AND tenant_id = v_tenant_id;

    INSERT INTO public.workforce_time_review_actions (
      tenant_id,
      entry_review_id,
      action,
      prev_status,
      new_status,
      reason,
      comment,
      actor_id,
      source,
      metadata
    ) VALUES (
      v_tenant_id,
      (v_item->>'review_id')::UUID,
      'export_item_superseded',
      'approved',
      'approved',
      v_job.correction_reason,
      'Korrektur-Export: Item superseded',
      v_actor,
      'office',
      jsonb_build_object(
        'export_job_id', p_export_job_id,
        'old_item_id', v_old_item.id,
        'new_item_id', v_new_item_id,
        'logical_reference_key', trim(v_item->>'logical_reference_key'),
        'export_sequence', v_new_seq
      )
    );

    INSERT INTO public.workforce_time_review_actions (
      tenant_id,
      entry_review_id,
      action,
      prev_status,
      new_status,
      reason,
      comment,
      actor_id,
      source,
      metadata
    ) VALUES (
      v_tenant_id,
      (v_item->>'review_id')::UUID,
      'reexport_finalized',
      'approved',
      'approved',
      v_job.correction_reason,
      'Korrektur-Export finalisiert',
      v_actor,
      'office',
      jsonb_build_object('export_job_id', p_export_job_id)
    );

    v_item_count := v_item_count + 1;
  END LOOP;

  INSERT INTO public.workforce_time_review_actions (
    tenant_id,
    entry_review_id,
    action,
    prev_status,
    new_status,
    reason,
    comment,
    actor_id,
    source,
    metadata
  )
  SELECT DISTINCT
    v_tenant_id,
    (elem->>'review_id')::UUID,
    'correction_export_finalized',
    'approved',
    'approved',
    v_job.correction_reason,
    'Korrektur-Export-Job finalisiert',
    v_actor,
    'office',
    jsonb_build_object(
      'export_job_id', p_export_job_id,
      'correction_of_export_job_id', v_job.correction_of_export_job_id,
      'item_count', v_item_count
    )
  FROM jsonb_array_elements(p_items) AS elem;

  UPDATE public.workforce_export_jobs
  SET
    status = 'finalized',
    row_count = v_item_count,
    finalized_at = NOW(),
    finalized_by = v_actor,
    updated_at = NOW()
  WHERE id = p_export_job_id
    AND tenant_id = v_tenant_id;

  RETURN p_export_job_id;
END;
$$;

REVOKE ALL ON FUNCTION public.wfm_finalize_correction_export(UUID, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.wfm_finalize_correction_export(UUID, JSONB) TO authenticated;

COMMENT ON FUNCTION public.wfm_finalize_correction_export(UUID, JSONB) IS
  'WFM P2.3 — atomares Korrektur-Finalize via p_items: supersede altes active Item, insert neues active Item, '
  'Review-Flags, Actions, Job finalized. Keine active Correction Items vor RPC. '
  'Nur tenant_admin / time.tracking.admin.export. Kein Employee.';
