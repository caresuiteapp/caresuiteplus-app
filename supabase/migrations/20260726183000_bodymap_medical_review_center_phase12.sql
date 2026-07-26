-- CareSuite+ Bodymap 3D · Phase 12
-- Revisionssicheres medizinisches Prüfzentrum für 30 Real-Human-Varianten.

CREATE TABLE IF NOT EXISTS public.bodymap_medical_review_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  variant_id TEXT NOT NULL,
  asset_path TEXT NOT NULL,
  asset_sha256 TEXT NOT NULL CHECK (asset_sha256 ~ '^[a-f0-9]{64}$'),
  source_commit_sha TEXT NOT NULL,
  checklist_version INTEGER NOT NULL DEFAULT 1 CHECK (checklist_version > 0),
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'in_review', 'changes_required', 'approved', 'revoked', 'superseded')),
  reviewer_user_id UUID NOT NULL DEFAULT auth.uid(),
  reviewer_name TEXT NOT NULL,
  reviewer_qualification TEXT NOT NULL DEFAULT '',
  review_scope TEXT NOT NULL DEFAULT '',
  decision_reason TEXT,
  checklist_snapshot JSONB NOT NULL DEFAULT '[]'::jsonb,
  summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  submitted_at TIMESTAMPTZ,
  approved_at TIMESTAMPTZ,
  approved_by UUID,
  revoked_at TIMESTAMPTZ,
  revoked_by UUID
);

CREATE INDEX IF NOT EXISTS idx_bodymap_review_runs_variant
  ON public.bodymap_medical_review_runs (variant_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_bodymap_review_runs_asset
  ON public.bodymap_medical_review_runs (variant_id, asset_sha256, status);
CREATE UNIQUE INDEX IF NOT EXISTS uq_bodymap_review_approved_asset
  ON public.bodymap_medical_review_runs (variant_id, asset_sha256)
  WHERE status = 'approved';

CREATE TABLE IF NOT EXISTS public.bodymap_medical_review_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id UUID NOT NULL REFERENCES public.bodymap_medical_review_runs(id) ON DELETE CASCADE,
  criterion_id TEXT NOT NULL,
  category TEXT NOT NULL,
  result TEXT NOT NULL DEFAULT 'pending'
    CHECK (result IN ('pending', 'pass', 'minor', 'major', 'blocker', 'not_applicable')),
  notes TEXT NOT NULL DEFAULT '',
  evidence JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(evidence) = 'array'),
  updated_by UUID NOT NULL DEFAULT auth.uid(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (review_id, criterion_id)
);

CREATE INDEX IF NOT EXISTS idx_bodymap_review_items_review
  ON public.bodymap_medical_review_items (review_id, category, criterion_id);

CREATE TABLE IF NOT EXISTS public.bodymap_medical_review_issues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id UUID NOT NULL REFERENCES public.bodymap_medical_review_runs(id) ON DELETE CASCADE,
  anatomical_zone_id TEXT,
  view_id TEXT CHECK (view_id IS NULL OR view_id IN ('front', 'back', 'left', 'right')),
  severity TEXT NOT NULL CHECK (severity IN ('minor', 'major', 'blocker')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved', 'accepted')),
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  surface_point JSONB,
  evidence JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(evidence) = 'array'),
  resolution TEXT,
  created_by UUID NOT NULL DEFAULT auth.uid(),
  updated_by UUID NOT NULL DEFAULT auth.uid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bodymap_review_issues_review
  ON public.bodymap_medical_review_issues (review_id, status, severity);

CREATE TABLE IF NOT EXISTS public.bodymap_medical_review_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id UUID REFERENCES public.bodymap_medical_review_runs(id) ON DELETE SET NULL,
  variant_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  actor_user_id UUID NOT NULL DEFAULT auth.uid(),
  actor_role TEXT,
  before JSONB,
  after JSONB,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bodymap_review_events_variant
  ON public.bodymap_medical_review_events (variant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bodymap_review_events_review
  ON public.bodymap_medical_review_events (review_id, created_at DESC);

ALTER TABLE public.bodymap_medical_review_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bodymap_medical_review_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bodymap_medical_review_issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bodymap_medical_review_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS bodymap_reviews_platform_read ON public.bodymap_medical_review_runs;
CREATE POLICY bodymap_reviews_platform_read ON public.bodymap_medical_review_runs
  FOR SELECT TO authenticated USING (public.is_platform_user());

DROP POLICY IF EXISTS bodymap_review_items_platform_read ON public.bodymap_medical_review_items;
CREATE POLICY bodymap_review_items_platform_read ON public.bodymap_medical_review_items
  FOR SELECT TO authenticated USING (public.is_platform_user());

DROP POLICY IF EXISTS bodymap_review_issues_platform_read ON public.bodymap_medical_review_issues;
CREATE POLICY bodymap_review_issues_platform_read ON public.bodymap_medical_review_issues
  FOR SELECT TO authenticated USING (public.is_platform_user());

DROP POLICY IF EXISTS bodymap_review_events_platform_read ON public.bodymap_medical_review_events;
CREATE POLICY bodymap_review_events_platform_read ON public.bodymap_medical_review_events
  FOR SELECT TO authenticated USING (public.is_platform_user());

REVOKE INSERT, UPDATE, DELETE ON public.bodymap_medical_review_runs FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.bodymap_medical_review_items FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.bodymap_medical_review_issues FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.bodymap_medical_review_events FROM authenticated;
GRANT SELECT ON public.bodymap_medical_review_runs TO authenticated;
GRANT SELECT ON public.bodymap_medical_review_items TO authenticated;
GRANT SELECT ON public.bodymap_medical_review_issues TO authenticated;
GRANT SELECT ON public.bodymap_medical_review_events TO authenticated;

CREATE OR REPLACE FUNCTION public.platform_bodymap_can_write_review()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.platform_current_role() IN ('platform_owner', 'platform_admin')
$$;

CREATE OR REPLACE FUNCTION public.platform_bodymap_review_overview()
RETURNS JSONB
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT CASE
    WHEN NOT public.is_platform_user() THEN
      jsonb_build_object('forbidden', true, 'reviews', '[]'::jsonb)
    ELSE jsonb_build_object(
      'reviews',
      COALESCE((
        SELECT jsonb_agg(
          to_jsonb(r) ||
          jsonb_build_object(
            'items', COALESCE((
              SELECT jsonb_agg(to_jsonb(i) ORDER BY i.category, i.criterion_id)
              FROM public.bodymap_medical_review_items i
              WHERE i.review_id = r.id
            ), '[]'::jsonb),
            'issues', COALESCE((
              SELECT jsonb_agg(to_jsonb(x) ORDER BY x.created_at)
              FROM public.bodymap_medical_review_issues x
              WHERE x.review_id = r.id
            ), '[]'::jsonb)
          )
          ORDER BY r.updated_at DESC
        )
        FROM public.bodymap_medical_review_runs r
      ), '[]'::jsonb)
    )
  END
$$;

CREATE OR REPLACE FUNCTION public.platform_bodymap_start_review(
  p_variant_id TEXT,
  p_asset_path TEXT,
  p_asset_sha256 TEXT,
  p_source_commit_sha TEXT,
  p_reviewer_name TEXT,
  p_reviewer_qualification TEXT,
  p_review_scope TEXT,
  p_checklist_version INTEGER,
  p_checklist_snapshot JSONB,
  p_items JSONB
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_review_id UUID;
  v_item JSONB;
BEGIN
  IF NOT public.platform_bodymap_can_write_review() THEN
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
$$;

CREATE OR REPLACE FUNCTION public.platform_bodymap_save_review(
  p_review_id UUID,
  p_reviewer_name TEXT,
  p_reviewer_qualification TEXT,
  p_review_scope TEXT,
  p_status TEXT,
  p_items JSONB,
  p_issues JSONB,
  p_reason TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_run public.bodymap_medical_review_runs%ROWTYPE;
  v_item JSONB;
  v_issue JSONB;
BEGIN
  IF NOT public.platform_bodymap_can_write_review() THEN
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
$$;

CREATE OR REPLACE FUNCTION public.platform_bodymap_approve_review(
  p_review_id UUID,
  p_expected_criteria INTEGER,
  p_current_asset_sha256 TEXT,
  p_reason TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_run public.bodymap_medical_review_runs%ROWTYPE;
  v_completed INTEGER;
  v_blocking_items INTEGER;
  v_blocking_issues INTEGER;
BEGIN
  IF public.platform_current_role() <> 'platform_owner' THEN
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
$$;

CREATE OR REPLACE FUNCTION public.platform_bodymap_revoke_review(
  p_review_id UUID,
  p_reason TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_run public.bodymap_medical_review_runs%ROWTYPE;
BEGIN
  IF public.platform_current_role() <> 'platform_owner' THEN
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
$$;

CREATE OR REPLACE FUNCTION public.bodymap_get_active_medical_approval(
  p_variant_id TEXT,
  p_asset_sha256 TEXT
)
RETURNS TABLE (approved BOOLEAN, review_id UUID, approved_at TIMESTAMPTZ)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    EXISTS (
      SELECT 1 FROM public.bodymap_medical_review_runs r
      WHERE r.variant_id = p_variant_id
        AND r.asset_sha256 = p_asset_sha256
        AND r.status = 'approved'
    ),
    (
      SELECT r.id FROM public.bodymap_medical_review_runs r
      WHERE r.variant_id = p_variant_id
        AND r.asset_sha256 = p_asset_sha256
        AND r.status = 'approved'
      ORDER BY r.approved_at DESC LIMIT 1
    ),
    (
      SELECT r.approved_at FROM public.bodymap_medical_review_runs r
      WHERE r.variant_id = p_variant_id
        AND r.asset_sha256 = p_asset_sha256
        AND r.status = 'approved'
      ORDER BY r.approved_at DESC LIMIT 1
    )
$$;

REVOKE ALL ON FUNCTION public.platform_bodymap_can_write_review() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.platform_bodymap_review_overview() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.platform_bodymap_start_review(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER, JSONB, JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.platform_bodymap_save_review(UUID, TEXT, TEXT, TEXT, TEXT, JSONB, JSONB, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.platform_bodymap_approve_review(UUID, INTEGER, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.platform_bodymap_revoke_review(UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.bodymap_get_active_medical_approval(TEXT, TEXT) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.platform_bodymap_review_overview() TO authenticated;
GRANT EXECUTE ON FUNCTION public.platform_bodymap_start_review(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER, JSONB, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.platform_bodymap_save_review(UUID, TEXT, TEXT, TEXT, TEXT, JSONB, JSONB, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.platform_bodymap_approve_review(UUID, INTEGER, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.platform_bodymap_revoke_review(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.bodymap_get_active_medical_approval(TEXT, TEXT) TO authenticated;

COMMENT ON TABLE public.bodymap_medical_review_runs IS
  'Asset- und Commit-gebundene medizinische Prüfungen der 30 Bodymap-Varianten.';
COMMENT ON FUNCTION public.bodymap_get_active_medical_approval(TEXT, TEXT) IS
  'Liefert nur für exakt passenden Varianten- und Asset-Hash eine aktive medizinische Freigabe.';
