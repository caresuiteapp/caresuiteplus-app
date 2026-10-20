-- ==========================================================================
-- CareSuite+ — Migration 0252: WFM Phase 2.3 — Re-Export / Supersede (ENTWURF)
--
-- Scope P2.3 ONLY:
--   - workforce_export_jobs Korrektur-Metadaten + export_type reviewed_time_correction
--   - workforce_time_export_items logical_reference_key, export_sequence, item_status, Supersede-FKs
--   - workforce_time_entry_reviews Drift-/Reexport-Denormalisierung
--   - workforce_time_review_actions Korrektur-Action-Typen
--   - Partial Unique: max. 1 active Item je (tenant_id, logical_reference_key)
--   - RPC wfm_finalize_correction_export (SECURITY DEFINER, atomares Supersede + Finalize)
--   - RLS/Grants: Employee weiterhin denied; Items UPDATE nur via RPC
--
-- NICHT in P2.3:
--   - DATEV / Lohnexport / Employee Export View
--   - DB-Trigger für changed_after_export (F12: Service-only MVP)
--   - Re-Export-Daten / Seeds beim Apply
--   - Platform Console (0249–0251)
--   - Payload-Overwrite auf bestehenden Items
--   - DELETE / TRUNCATE auf Export-Items
--
-- Basis:
--   docs/architecture/wfm-p23-reexport-supersede-architecture-gate.md (F1–F12 final)
--   docs/architecture/wfm-p23-schema-proposal-0252.md
--
-- Rückwärtskompatibel zu P2.2 / Migration 0248.
-- Keine Production-Mutation beyond Schema + metadata Backfill (seq=1, active, logical_key).
--
-- ⚠️  ENTWURF — NICHT remote anwenden ohne explizites Staging-Gate.
-- ⚠️  Kein supabase db push / MCP apply ohne explizite Freigabe.
-- ==========================================================================

-- --------------------------------------------------------------------------
-- A) workforce_export_jobs — Korrektur-Metadaten
-- --------------------------------------------------------------------------
ALTER TABLE public.workforce_export_jobs
  ADD COLUMN IF NOT EXISTS correction_of_export_job_id UUID REFERENCES public.workforce_export_jobs(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS correction_reason TEXT,
  ADD COLUMN IF NOT EXISTS correction_sequence INTEGER,
  ADD COLUMN IF NOT EXISTS export_scope TEXT;

ALTER TABLE public.workforce_export_jobs
  DROP CONSTRAINT IF EXISTS workforce_export_jobs_export_type_check;

ALTER TABLE public.workforce_export_jobs
  ADD CONSTRAINT workforce_export_jobs_export_type_check
  CHECK (export_type IN (
    'reviewed_time',
    'reviewed_time_correction',
    'session_legacy'
  ));

ALTER TABLE public.workforce_export_jobs
  DROP CONSTRAINT IF EXISTS workforce_export_jobs_correction_sequence_check;

ALTER TABLE public.workforce_export_jobs
  ADD CONSTRAINT workforce_export_jobs_correction_sequence_check
  CHECK (correction_sequence IS NULL OR correction_sequence >= 1);

ALTER TABLE public.workforce_export_jobs
  DROP CONSTRAINT IF EXISTS workforce_export_jobs_correction_parent_check;

ALTER TABLE public.workforce_export_jobs
  ADD CONSTRAINT workforce_export_jobs_correction_parent_check
  CHECK (
    export_type <> 'reviewed_time_correction'
    OR correction_of_export_job_id IS NOT NULL
  );

ALTER TABLE public.workforce_export_jobs
  DROP CONSTRAINT IF EXISTS workforce_export_jobs_correction_reason_check;

ALTER TABLE public.workforce_export_jobs
  ADD CONSTRAINT workforce_export_jobs_correction_reason_check
  CHECK (
    export_type <> 'reviewed_time_correction'
    OR (
      correction_reason IS NOT NULL
      AND length(trim(correction_reason)) >= 10
    )
  );

ALTER TABLE public.workforce_export_jobs
  DROP CONSTRAINT IF EXISTS workforce_export_jobs_correction_scope_check;

ALTER TABLE public.workforce_export_jobs
  ADD CONSTRAINT workforce_export_jobs_correction_scope_check
  CHECK (
    export_type <> 'reviewed_time_correction'
    OR export_scope = 'delta_correction'
  );

ALTER TABLE public.workforce_export_jobs
  DROP CONSTRAINT IF EXISTS workforce_export_jobs_correction_no_self_ref;

ALTER TABLE public.workforce_export_jobs
  ADD CONSTRAINT workforce_export_jobs_correction_no_self_ref
  CHECK (
    correction_of_export_job_id IS NULL
    OR correction_of_export_job_id <> id
  );

ALTER TABLE public.workforce_export_jobs
  DROP CONSTRAINT IF EXISTS workforce_export_jobs_export_scope_check;

ALTER TABLE public.workforce_export_jobs
  ADD CONSTRAINT workforce_export_jobs_export_scope_check
  CHECK (
    export_scope IS NULL
    OR export_scope IN ('delta_correction', 'full_replacement')
  );

COMMENT ON COLUMN public.workforce_export_jobs.correction_of_export_job_id IS
  'WFM P2.3 — Ursprungs-Export-Job bei reviewed_time_correction.';

COMMENT ON COLUMN public.workforce_export_jobs.correction_reason IS
  'WFM P2.3 — Pflichtgrund für Korrektur-Export (min. 10 Zeichen).';

COMMENT ON COLUMN public.workforce_export_jobs.export_scope IS
  'WFM P2.3 — delta_correction (MVP) | full_replacement (nicht MVP).';

-- --------------------------------------------------------------------------
-- B) workforce_time_export_items — Sequenz, logical key, Supersede
-- --------------------------------------------------------------------------
ALTER TABLE public.workforce_time_export_items
  ADD COLUMN IF NOT EXISTS logical_reference_key TEXT,
  ADD COLUMN IF NOT EXISTS export_sequence INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS supersedes_export_item_id UUID,
  ADD COLUMN IF NOT EXISTS item_status TEXT NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS correction_reason TEXT,
  ADD COLUMN IF NOT EXISTS source_review_version_hash TEXT,
  ADD COLUMN IF NOT EXISTS previous_payload_hash TEXT,
  ADD COLUMN IF NOT EXISTS correction_payload_delta JSONB,
  ADD COLUMN IF NOT EXISTS superseded_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS superseded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Self-FK supersedes_export_item_id (neues Item → altes Item)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'workforce_time_export_items_supersedes_fkey'
  ) THEN
    ALTER TABLE public.workforce_time_export_items
      ADD CONSTRAINT workforce_time_export_items_supersedes_fkey
      FOREIGN KEY (supersedes_export_item_id)
      REFERENCES public.workforce_time_export_items(id)
      ON DELETE RESTRICT;
  END IF;
END $$;

-- Backfill metadata — keine Payload-Mutation, keine Duplikate
UPDATE public.workforce_time_export_items
SET logical_reference_key = reference_key
WHERE logical_reference_key IS NULL
  AND reference_key IS NOT NULL
  AND reference_key <> '';

UPDATE public.workforce_time_export_items
SET export_sequence = 1
WHERE export_sequence IS NULL OR export_sequence < 1;

UPDATE public.workforce_time_export_items
SET item_status = 'active'
WHERE item_status IS NULL OR item_status NOT IN ('active', 'superseded', 'voided');

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'workforce_time_export_items'
      AND column_name = 'logical_reference_key'
      AND is_nullable = 'YES'
  ) THEN
    ALTER TABLE public.workforce_time_export_items
      ALTER COLUMN logical_reference_key SET NOT NULL;
  END IF;
END $$;

ALTER TABLE public.workforce_time_export_items
  DROP CONSTRAINT IF EXISTS workforce_time_export_items_export_sequence_check;

ALTER TABLE public.workforce_time_export_items
  ADD CONSTRAINT workforce_time_export_items_export_sequence_check
  CHECK (export_sequence >= 1);

ALTER TABLE public.workforce_time_export_items
  DROP CONSTRAINT IF EXISTS workforce_time_export_items_item_status_check;

ALTER TABLE public.workforce_time_export_items
  ADD CONSTRAINT workforce_time_export_items_item_status_check
  CHECK (item_status IN ('active', 'superseded', 'voided'));

ALTER TABLE public.workforce_time_export_items
  DROP CONSTRAINT IF EXISTS workforce_time_export_items_logical_key_nonempty;

ALTER TABLE public.workforce_time_export_items
  ADD CONSTRAINT workforce_time_export_items_logical_key_nonempty
  CHECK (logical_reference_key <> '');

ALTER TABLE public.workforce_time_export_items
  DROP CONSTRAINT IF EXISTS workforce_time_export_items_supersedes_no_self;

ALTER TABLE public.workforce_time_export_items
  ADD CONSTRAINT workforce_time_export_items_supersedes_no_self
  CHECK (
    supersedes_export_item_id IS NULL
    OR supersedes_export_item_id <> id
  );

ALTER TABLE public.workforce_time_export_items
  DROP CONSTRAINT IF EXISTS workforce_time_export_items_superseded_by_no_self;

ALTER TABLE public.workforce_time_export_items
  ADD CONSTRAINT workforce_time_export_items_superseded_by_no_self
  CHECK (
    superseded_by_export_item_id IS NULL
    OR superseded_by_export_item_id <> id
  );

COMMENT ON COLUMN public.workforce_time_export_items.logical_reference_key IS
  'WFM P2.3 — stabiler fachlicher Ursprung (z. B. review:<uuid>). Partial Unique je active Item.';

COMMENT ON COLUMN public.workforce_time_export_items.export_sequence IS
  'WFM P2.3 — 1 = Initial-Export; 2+ = Korrektur. Physical reference_key versioniert separat.';

COMMENT ON COLUMN public.workforce_time_export_items.item_status IS
  'WFM P2.3 — active | superseded | voided. Max. 1 active je logical_reference_key.';

COMMENT ON COLUMN public.workforce_time_export_items.correction_payload_delta IS
  'WFM P2.3 F11 — Delta für Korrektur-CSV (changedFields, old/new, deltaMinutes).';

-- Pre-check: Partial Unique darf nicht still scheitern
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.workforce_time_export_items
    WHERE item_status = 'active'
    GROUP BY tenant_id, logical_reference_key
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION
      'WFM P2.3 0252: duplicate active logical_reference_key — manual review required before apply';
  END IF;
END $$;

DROP INDEX IF EXISTS public.uq_wfm_export_items_one_active_per_logical_key;

CREATE UNIQUE INDEX uq_wfm_export_items_one_active_per_logical_key
  ON public.workforce_time_export_items (tenant_id, logical_reference_key)
  WHERE item_status = 'active';

-- P2.2 UNIQUE (tenant_id, reference_key) bleibt für physical/versioned keys erhalten.

-- --------------------------------------------------------------------------
-- C) workforce_time_entry_reviews — Drift / Reexport Denormalisierung
-- --------------------------------------------------------------------------
ALTER TABLE public.workforce_time_entry_reviews
  ADD COLUMN IF NOT EXISTS changed_after_export_detected_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS changed_after_export_reason TEXT,
  ADD COLUMN IF NOT EXISTS latest_export_item_id UUID REFERENCES public.workforce_time_export_items(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS pending_reexport_job_id UUID REFERENCES public.workforce_export_jobs(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS export_version INTEGER NOT NULL DEFAULT 1;

ALTER TABLE public.workforce_time_entry_reviews
  DROP CONSTRAINT IF EXISTS workforce_time_entry_reviews_export_version_check;

ALTER TABLE public.workforce_time_entry_reviews
  ADD CONSTRAINT workforce_time_entry_reviews_export_version_check
  CHECK (export_version >= 1);

ALTER TABLE public.workforce_time_entry_reviews
  DROP CONSTRAINT IF EXISTS workforce_time_entry_reviews_drift_reason_check;

ALTER TABLE public.workforce_time_entry_reviews
  ADD CONSTRAINT workforce_time_entry_reviews_drift_reason_check
  CHECK (
    (
      export_status <> 'changed_after_export'
      AND changed_after_export = FALSE
    )
    OR (
      changed_after_export_reason IS NOT NULL
      AND length(trim(changed_after_export_reason)) > 0
    )
  );

COMMENT ON COLUMN public.workforce_time_entry_reviews.changed_after_export_detected_at IS
  'WFM P2.3 F1/F3 — Zeitpunkt Drift-Erkennung (Service-only).';

COMMENT ON COLUMN public.workforce_time_entry_reviews.latest_export_item_id IS
  'WFM P2.3 — Zeiger auf aktives Export-Item (Denormalisierung).';

COMMENT ON COLUMN public.workforce_time_entry_reviews.export_version IS
  'WFM P2.3 — Inkrement bei Korrektur-Finalize.';

-- Backfill Drift-Reason für bestehende changed_after_export Reviews (Constraint-Vorbereitung)
UPDATE public.workforce_time_entry_reviews
SET changed_after_export_reason = 'legacy_p22_drift'
WHERE (
    export_status = 'changed_after_export'
    OR changed_after_export = TRUE
  )
  AND (
    changed_after_export_reason IS NULL
    OR length(trim(changed_after_export_reason)) = 0
  );

-- Kein automatisches Setzen von changed_after_export auf bisher unveränderte Reviews.

-- --------------------------------------------------------------------------
-- D) workforce_time_review_actions — Korrektur-Action-Typen
-- --------------------------------------------------------------------------
ALTER TABLE public.workforce_time_review_actions
  DROP CONSTRAINT IF EXISTS workforce_time_review_actions_action_check;

ALTER TABLE public.workforce_time_review_actions
  ADD CONSTRAINT workforce_time_review_actions_action_check
  CHECK (action IN (
    'created',
    'status_changed',
    'review_approved',
    'review_rejected',
    'review_corrected',
    'clarification_requested',
    'comment_added',
    'review_reopened',
    'locked',
    'superseded',
    'justification_updated',
    'export_marked',
    'export_finalized',
    'export_voided',
    'export_reopened',
    'changed_after_export_detected',
    'export_change_detected',
    'reexport_requested',
    'reexport_drafted',
    'reexport_finalized',
    'export_item_superseded',
    'correction_export_finalized'
  ));

COMMENT ON TABLE public.workforce_time_review_actions IS
  'WFM P2.1/P2.2/P2.3 — append-only Review-Audit inkl. Korrektur-Export-Actions.';

-- --------------------------------------------------------------------------
-- E) RPC — atomares Korrektur-Finalize + Supersede
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.wfm_finalize_correction_export(p_export_job_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id UUID;
  v_job       RECORD;
  v_actor     UUID;
  v_new_item  RECORD;
  v_old_item  RECORD;
  v_item_count INTEGER := 0;
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

  FOR v_new_item IN
    SELECT i.*
    FROM public.workforce_time_export_items i
    WHERE i.export_job_id = p_export_job_id
      AND i.tenant_id = v_tenant_id
      AND i.item_status = 'active'
    FOR UPDATE
  LOOP
    v_item_count := v_item_count + 1;

    SELECT o.*
    INTO v_old_item
    FROM public.workforce_time_export_items o
    WHERE o.tenant_id = v_tenant_id
      AND o.logical_reference_key = v_new_item.logical_reference_key
      AND o.item_status = 'active'
      AND o.id <> v_new_item.id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION
        'wfm_finalize_correction_export: no active item to supersede for logical_reference_key %',
        v_new_item.logical_reference_key;
    END IF;

    UPDATE public.workforce_time_export_items
    SET
      item_status = 'superseded',
      superseded_by_export_item_id = v_new_item.id,
      superseded_at = NOW(),
      superseded_by = v_actor
    WHERE id = v_old_item.id;

    UPDATE public.workforce_time_export_items
    SET
      supersedes_export_item_id = v_old_item.id,
      previous_payload_hash = v_old_item.payload_hash
    WHERE id = v_new_item.id;

    UPDATE public.workforce_time_entry_reviews
    SET
      export_status = 'exported',
      changed_after_export = FALSE,
      changed_after_export_detected_at = NULL,
      changed_after_export_reason = NULL,
      latest_export_item_id = v_new_item.id,
      last_export_job_id = p_export_job_id,
      last_exported_at = NOW(),
      pending_reexport_job_id = NULL,
      export_version = export_version + 1
    WHERE id = v_new_item.review_id
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
      v_new_item.review_id,
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
        'new_item_id', v_new_item.id,
        'logical_reference_key', v_new_item.logical_reference_key,
        'export_sequence', v_new_item.export_sequence
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
      v_new_item.review_id,
      'reexport_finalized',
      'approved',
      'approved',
      v_job.correction_reason,
      'Korrektur-Export finalisiert',
      v_actor,
      'office',
      jsonb_build_object('export_job_id', p_export_job_id)
    );
  END LOOP;

  IF v_item_count = 0 THEN
    RAISE EXCEPTION 'wfm_finalize_correction_export: no active correction items on job';
  END IF;

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
    i.review_id,
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
  FROM public.workforce_time_export_items i
  WHERE i.export_job_id = p_export_job_id
    AND i.tenant_id = v_tenant_id;

  UPDATE public.workforce_export_jobs
  SET
    status = 'finalized',
    finalized_at = NOW(),
    finalized_by = v_actor,
    updated_at = NOW()
  WHERE id = p_export_job_id
    AND tenant_id = v_tenant_id;

  RETURN p_export_job_id;
END;
$$;

REVOKE ALL ON FUNCTION public.wfm_finalize_correction_export(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.wfm_finalize_correction_export(UUID) TO authenticated;

COMMENT ON FUNCTION public.wfm_finalize_correction_export(UUID) IS
  'WFM P2.3 — atomares Korrektur-Finalize: Supersede active Items, Review-Flags, Actions, Job finalized. '
  'Voraussetzung: validated reviewed_time_correction Job mit active Correction-Items (Service-INSERT). '
  'Nur tenant_admin / time.tracking.admin.export. Kein Employee.';

-- --------------------------------------------------------------------------
-- F) RLS — Export-Jobs (reviewed_time_correction admin-only wie reviewed_time)
-- --------------------------------------------------------------------------
DROP POLICY IF EXISTS wfm_export_jobs_select ON public.workforce_export_jobs;
CREATE POLICY wfm_export_jobs_select ON public.workforce_export_jobs
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND (
      public.has_permission('time.tracking.admin.export')
      OR public.is_tenant_admin()
      OR (
        export_type = 'session_legacy'
        AND requested_by = auth.uid()
      )
    )
  );

COMMENT ON POLICY wfm_export_jobs_select ON public.workforce_export_jobs IS
  'WFM P2.2/P2.3 — reviewed_time + reviewed_time_correction nur admin.export/tenant_admin. '
  'session_legacy: Self-Read für requested_by.';

-- Items: SELECT/INSERT unverändert admin-only; kein UPDATE/DELETE für authenticated
REVOKE UPDATE, DELETE ON public.workforce_time_export_items FROM authenticated;
GRANT SELECT, INSERT ON public.workforce_time_export_items TO authenticated;

-- --------------------------------------------------------------------------
-- G) Indexe
-- --------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_wfm_time_export_items_logical_key
  ON public.workforce_time_export_items (tenant_id, logical_reference_key);

CREATE INDEX IF NOT EXISTS idx_wfm_time_export_items_tenant_sequence
  ON public.workforce_time_export_items (tenant_id, logical_reference_key, export_sequence DESC);

CREATE INDEX IF NOT EXISTS idx_wfm_time_export_items_item_status
  ON public.workforce_time_export_items (tenant_id, item_status)
  WHERE item_status IN ('active', 'superseded');

CREATE INDEX IF NOT EXISTS idx_workforce_export_jobs_correction_of
  ON public.workforce_export_jobs (tenant_id, correction_of_export_job_id)
  WHERE correction_of_export_job_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_workforce_time_entry_reviews_pending_reexport
  ON public.workforce_time_entry_reviews (tenant_id, pending_reexport_job_id)
  WHERE pending_reexport_job_id IS NOT NULL;
