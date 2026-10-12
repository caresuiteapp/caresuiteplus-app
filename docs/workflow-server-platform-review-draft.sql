-- REVIEW DRAFT ONLY. Never apply automatically or to production.
-- Captured 2026-10-11: an ordinary Auth identity has no platform_users row;
-- platform_current_role returns NULL. PL/pgSQL IF treats NULL as not true.
-- Preserve owner/admin capabilities and existing immutability/object guards;
-- close both delegated IF NOT NULL and direct NULL <> owner fall-through.
BEGIN;

CREATE OR REPLACE FUNCTION public.platform_bodymap_can_write_review()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT COALESCE(public.platform_current_role() IN ('platform_owner', 'platform_admin'), FALSE)
$function$;

CREATE OR REPLACE FUNCTION public.platform_bodymap_start_review(p_variant_id text, p_asset_path text, p_asset_sha256 text, p_source_commit_sha text, p_reviewer_name text, p_reviewer_qualification text, p_review_scope text, p_checklist_version integer, p_checklist_snapshot jsonb, p_items jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_review_id UUID;
  v_item JSONB;
BEGIN
  IF public.platform_bodymap_can_write_review() IS NOT TRUE THEN
    RAISE EXCEPTION 'bodymap_review_write_forbidden' USING ERRCODE = '42501';
  END IF;
  IF p_asset_sha256 !~ '^[a-f0-9]{64}$' THEN
    RAISE EXCEPTION 'invalid_asset_sha256' USING ERRCODE = '22023';
  END IF;
  IF length(trim(p_reviewer_name)) < 2 THEN
    RAISE EXCEPTION 'reviewer_name_required' USING ERRCODE = '22023';
  END IF;

  UPDATE public.bodymap_medical_review_runs
  SET status = 'superseded', updated_at = NOW()
  WHERE variant_id = p_variant_id
    AND status IN ('draft', 'in_review', 'changes_required')
    AND asset_sha256 <> p_asset_sha256;

  INSERT INTO public.bodymap_medical_review_runs (
    variant_id, asset_path, asset_sha256, source_commit_sha,
    checklist_version, status, reviewer_name, reviewer_qualification,
    review_scope, checklist_snapshot
  ) VALUES (
    p_variant_id, p_asset_path, p_asset_sha256, p_source_commit_sha,
    p_checklist_version, 'in_review', trim(p_reviewer_name),
    trim(COALESCE(p_reviewer_qualification, '')),
    trim(COALESCE(p_review_scope, '')), COALESCE(p_checklist_snapshot, '[]'::jsonb)
  ) RETURNING id INTO v_review_id;

  FOR v_item IN SELECT value FROM jsonb_array_elements(COALESCE(p_items, '[]'::jsonb))
  LOOP
    INSERT INTO public.bodymap_medical_review_items (
      review_id, criterion_id, category, result, notes, evidence
    ) VALUES (
      v_review_id, v_item->>'criterionId', v_item->>'category',
      COALESCE(v_item->>'result', 'pending'), COALESCE(v_item->>'notes', ''),
      COALESCE(v_item->'evidence', '[]'::jsonb)
    );
  END LOOP;

  INSERT INTO public.bodymap_medical_review_events (
    review_id, variant_id, event_type, actor_role, after
  ) VALUES (
    v_review_id, p_variant_id, 'review_started', public.platform_current_role(),
    jsonb_build_object('assetSha256', p_asset_sha256, 'sourceCommitSha', p_source_commit_sha)
  );
  PERFORM public.platform_write_audit_log(
    'bodymap.review.started', 'bodymap_medical_review', v_review_id, NULL, NULL,
    jsonb_build_object('variantId', p_variant_id, 'assetSha256', p_asset_sha256),
    'Medizinische Bodymap-Prüfung gestartet'
  );
  RETURN v_review_id;
END
$function$;

CREATE OR REPLACE FUNCTION public.platform_bodymap_save_review(p_review_id uuid, p_reviewer_name text, p_reviewer_qualification text, p_review_scope text, p_status text, p_items jsonb, p_issues jsonb, p_reason text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_run public.bodymap_medical_review_runs%ROWTYPE;
  v_item JSONB;
  v_issue JSONB;
BEGIN
  IF public.platform_bodymap_can_write_review() IS NOT TRUE THEN
    RAISE EXCEPTION 'bodymap_review_write_forbidden' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_run FROM public.bodymap_medical_review_runs WHERE id = p_review_id FOR UPDATE;
  IF v_run.id IS NULL THEN RAISE EXCEPTION 'review_not_found'; END IF;
  IF v_run.status IN ('approved', 'revoked', 'superseded') THEN
    RAISE EXCEPTION 'immutable_review_decision';
  END IF;
  IF p_status NOT IN ('draft', 'in_review', 'changes_required') THEN
    RAISE EXCEPTION 'invalid_review_status';
  END IF;

  UPDATE public.bodymap_medical_review_runs SET
    reviewer_name = trim(p_reviewer_name),
    reviewer_qualification = trim(COALESCE(p_reviewer_qualification, '')),
    review_scope = trim(COALESCE(p_review_scope, '')),
    status = p_status,
    submitted_at = CASE WHEN p_status = 'changes_required' THEN NOW() ELSE submitted_at END,
    updated_at = NOW()
  WHERE id = p_review_id;

  DELETE FROM public.bodymap_medical_review_items WHERE review_id = p_review_id;
  FOR v_item IN SELECT value FROM jsonb_array_elements(COALESCE(p_items, '[]'::jsonb))
  LOOP
    INSERT INTO public.bodymap_medical_review_items (
      review_id, criterion_id, category, result, notes, evidence
    ) VALUES (
      p_review_id, v_item->>'criterionId', v_item->>'category',
      COALESCE(v_item->>'result', 'pending'), COALESCE(v_item->>'notes', ''),
      COALESCE(v_item->'evidence', '[]'::jsonb)
    );
  END LOOP;

  DELETE FROM public.bodymap_medical_review_issues WHERE review_id = p_review_id;
  FOR v_issue IN SELECT value FROM jsonb_array_elements(COALESCE(p_issues, '[]'::jsonb))
  LOOP
    INSERT INTO public.bodymap_medical_review_issues (
      review_id, anatomical_zone_id, view_id, severity, status, title,
      description, surface_point, evidence, resolution
    ) VALUES (
      p_review_id, NULLIF(v_issue->>'anatomicalZoneId', ''),
      NULLIF(v_issue->>'viewId', ''), v_issue->>'severity',
      COALESCE(v_issue->>'status', 'open'), v_issue->>'title',
      COALESCE(v_issue->>'description', ''), v_issue->'surfacePoint',
      COALESCE(v_issue->'evidence', '[]'::jsonb), NULLIF(v_issue->>'resolution', '')
    );
  END LOOP;

  INSERT INTO public.bodymap_medical_review_events (
    review_id, variant_id, event_type, actor_role, before, after, reason
  ) VALUES (
    p_review_id, v_run.variant_id, 'review_saved', public.platform_current_role(),
    jsonb_build_object('status', v_run.status),
    jsonb_build_object('status', p_status, 'itemCount', jsonb_array_length(COALESCE(p_items, '[]'::jsonb)), 'issueCount', jsonb_array_length(COALESCE(p_issues, '[]'::jsonb))),
    p_reason
  );
  PERFORM public.platform_write_audit_log(
    'bodymap.review.saved', 'bodymap_medical_review', p_review_id, NULL,
    jsonb_build_object('status', v_run.status), jsonb_build_object('status', p_status), p_reason
  );
  RETURN TRUE;
END
$function$;

CREATE OR REPLACE FUNCTION public.platform_bodymap_approve_review(p_review_id uuid, p_expected_criteria integer, p_current_asset_sha256 text, p_reason text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_run public.bodymap_medical_review_runs%ROWTYPE;
  v_completed INTEGER;
  v_blocking_items INTEGER;
  v_blocking_issues INTEGER;
BEGIN
  IF public.platform_current_role() IS DISTINCT FROM 'platform_owner' THEN
    RAISE EXCEPTION 'bodymap_final_approval_owner_only' USING ERRCODE = '42501';
  END IF;
  IF length(trim(COALESCE(p_reason, ''))) < 5 THEN
    RAISE EXCEPTION 'approval_reason_required' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_run FROM public.bodymap_medical_review_runs WHERE id = p_review_id FOR UPDATE;
  IF v_run.id IS NULL THEN RAISE EXCEPTION 'review_not_found'; END IF;
  IF v_run.asset_sha256 <> p_current_asset_sha256 THEN
    RAISE EXCEPTION 'asset_changed_review_invalid' USING ERRCODE = '22023';
  END IF;

  SELECT count(*), count(*) FILTER (WHERE result IN ('pending', 'major', 'blocker'))
  INTO v_completed, v_blocking_items
  FROM public.bodymap_medical_review_items WHERE review_id = p_review_id;
  SELECT count(*) INTO v_blocking_issues
  FROM public.bodymap_medical_review_issues
  WHERE review_id = p_review_id AND status = 'open' AND severity IN ('major', 'blocker');

  IF v_completed <> p_expected_criteria OR v_blocking_items > 0 OR v_blocking_issues > 0 THEN
    RAISE EXCEPTION 'review_quality_gate_failed';
  END IF;

  UPDATE public.bodymap_medical_review_runs
  SET status = 'superseded', updated_at = NOW()
  WHERE variant_id = v_run.variant_id AND status = 'approved' AND id <> p_review_id;
  UPDATE public.bodymap_medical_review_runs SET
    status = 'approved', decision_reason = trim(p_reason), submitted_at = NOW(),
    approved_at = NOW(), approved_by = auth.uid(), updated_at = NOW()
  WHERE id = p_review_id;

  INSERT INTO public.bodymap_medical_review_events (
    review_id, variant_id, event_type, actor_role, before, after, reason
  ) VALUES (
    p_review_id, v_run.variant_id, 'review_approved', public.platform_current_role(),
    jsonb_build_object('status', v_run.status),
    jsonb_build_object('status', 'approved', 'assetSha256', v_run.asset_sha256),
    trim(p_reason)
  );
  PERFORM public.platform_write_audit_log(
    'bodymap.review.approved', 'bodymap_medical_review', p_review_id, NULL,
    jsonb_build_object('status', v_run.status),
    jsonb_build_object('status', 'approved', 'variantId', v_run.variant_id, 'assetSha256', v_run.asset_sha256),
    trim(p_reason)
  );
  RETURN TRUE;
END
$function$;

CREATE OR REPLACE FUNCTION public.platform_bodymap_revoke_review(p_review_id uuid, p_reason text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_run public.bodymap_medical_review_runs%ROWTYPE;
BEGIN
  IF public.platform_current_role() IS DISTINCT FROM 'platform_owner' THEN
    RAISE EXCEPTION 'bodymap_revoke_owner_only' USING ERRCODE = '42501';
  END IF;
  IF length(trim(COALESCE(p_reason, ''))) < 5 THEN
    RAISE EXCEPTION 'revoke_reason_required' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_run FROM public.bodymap_medical_review_runs WHERE id = p_review_id FOR UPDATE;
  IF v_run.status <> 'approved' THEN RAISE EXCEPTION 'only_approved_review_can_be_revoked'; END IF;
  UPDATE public.bodymap_medical_review_runs SET
    status = 'revoked', decision_reason = trim(p_reason), revoked_at = NOW(),
    revoked_by = auth.uid(), updated_at = NOW()
  WHERE id = p_review_id;
  INSERT INTO public.bodymap_medical_review_events (
    review_id, variant_id, event_type, actor_role, before, after, reason
  ) VALUES (
    p_review_id, v_run.variant_id, 'review_revoked', public.platform_current_role(),
    jsonb_build_object('status', 'approved'), jsonb_build_object('status', 'revoked'), trim(p_reason)
  );
  PERFORM public.platform_write_audit_log(
    'bodymap.review.revoked', 'bodymap_medical_review', p_review_id, NULL,
    jsonb_build_object('status', 'approved'), jsonb_build_object('status', 'revoked'), trim(p_reason)
  );
  RETURN TRUE;
END
$function$;

COMMIT;
