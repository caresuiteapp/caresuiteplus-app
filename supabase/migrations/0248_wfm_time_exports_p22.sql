-- ==========================================================================
-- CareSuite+ — Migration 0248: WFM Phase 2.2 — Export-Persistenz (ENTWURF)
--
-- Scope P2.2 ONLY:
--   - workforce_export_jobs erweitern (Draft/Validate/Finalize-Lifecycle)
--   - workforce_time_export_items (finalisierte Review-Snapshots)
--   - workforce_time_entry_reviews Export-Denormalisierung (F1)
--   - workforce_time_review_actions Export-Action-Typen
--   - RLS für Export-Items (Office/Admin only, F3/F7)
--
-- NICHT in P2.2:
--   - DATEV / Lohnabrechnung / PDF-Vollausbau
--   - DB-Trigger für changed_after_export (F2: Service-only)
--   - Re-Export / Supersede-Workflow (P2.3 — Constraint-Anpassung nötig)
--   - Nachträge, Fahrzeit, Team-Meeting-Zeitlogik
--   - Platform Console (0246/0247)
--
-- Basis: docs/architecture/wfm-p22-export-schema-proposal.md (6c1b972b)
-- Freigaben F1–F7 eingearbeitet.
--
-- ⚠️  ENTWURF — NICHT remote anwenden ohne explizite Staging-Freigabe.
-- ⚠️  Kein supabase db push / MCP apply ohne explizite Freigabe.
-- ==========================================================================

-- --------------------------------------------------------------------------
-- A) workforce_export_jobs — Spalten + Status/Export-Type erweitern
-- --------------------------------------------------------------------------
ALTER TABLE public.workforce_export_jobs
  ADD COLUMN IF NOT EXISTS period_start DATE,
  ADD COLUMN IF NOT EXISTS period_end DATE,
  ADD COLUMN IF NOT EXISTS export_type TEXT,
  ADD COLUMN IF NOT EXISTS finalized_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS finalized_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS canceled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS canceled_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS content_hash TEXT;

-- Legacy-Jobs: session_legacy; neue P2.2-Jobs setzen reviewed_time im Service.
UPDATE public.workforce_export_jobs
SET export_type = 'session_legacy'
WHERE export_type IS NULL;

ALTER TABLE public.workforce_export_jobs
  ALTER COLUMN export_type SET DEFAULT 'session_legacy';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'workforce_export_jobs'
      AND column_name = 'export_type'
      AND is_nullable = 'YES'
  ) THEN
    ALTER TABLE public.workforce_export_jobs
      ALTER COLUMN export_type SET NOT NULL;
  END IF;
END $$;

ALTER TABLE public.workforce_export_jobs
  DROP CONSTRAINT IF EXISTS workforce_export_jobs_status_check;

ALTER TABLE public.workforce_export_jobs
  ADD CONSTRAINT workforce_export_jobs_status_check
  CHECK (status IN (
    'pending',
    'processing',
    'completed',
    'failed',
    'draft',
    'validated',
    'finalized',
    'canceled'
  ));

ALTER TABLE public.workforce_export_jobs
  DROP CONSTRAINT IF EXISTS workforce_export_jobs_export_type_check;

ALTER TABLE public.workforce_export_jobs
  ADD CONSTRAINT workforce_export_jobs_export_type_check
  CHECK (export_type IN ('reviewed_time', 'session_legacy'));

COMMENT ON COLUMN public.workforce_export_jobs.period_start IS
  'WFM P2.2 — flexibler Exportzeitraum (Start). Ergänzt period_year/period_month (0193).';

COMMENT ON COLUMN public.workforce_export_jobs.period_end IS
  'WFM P2.2 — flexibler Exportzeitraum (Ende).';

COMMENT ON COLUMN public.workforce_export_jobs.export_type IS
  'WFM P2.2 — reviewed_time = Review-gated Export; session_legacy = 0193 Session-Export.';

COMMENT ON COLUMN public.workforce_export_jobs.finalized_at IS
  'WFM P2.2 — Zeitpunkt der Export-Finalisierung (Status finalized).';

COMMENT ON COLUMN public.workforce_export_jobs.content_hash IS
  'WFM P2.2 — optionaler Aggregat-Hash über Item-Payloads; kein DATEV-Hash.';

-- --------------------------------------------------------------------------
-- B) workforce_time_export_items — finalisierte Export-Snapshots
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.workforce_time_export_items (
  id                           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                    UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  export_job_id                UUID        NOT NULL REFERENCES public.workforce_export_jobs(id) ON DELETE CASCADE,
  review_id                    UUID        NOT NULL REFERENCES public.workforce_time_entry_reviews(id) ON DELETE RESTRICT,
  employee_id                  UUID        NOT NULL REFERENCES public.employees(id) ON DELETE RESTRICT,
  reference_id                 UUID,
  reference_key                TEXT        NOT NULL,
  entry_kind                   TEXT        NOT NULL,
  period_date                  DATE        NOT NULL,
  minutes_total                INTEGER     NOT NULL,
  review_status_at_export      TEXT        NOT NULL,
  exported_payload             JSONB       NOT NULL DEFAULT '{}'::jsonb,
  payload_hash                 TEXT        NOT NULL,
  changed_after_export         BOOLEAN     NOT NULL DEFAULT FALSE,
  superseded_by_export_item_id UUID,
  created_at                   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT workforce_time_export_items_minutes_nonneg
    CHECK (minutes_total >= 0),
  CONSTRAINT workforce_time_export_items_reference_key_nonempty
    CHECK (reference_key <> ''),
  CONSTRAINT workforce_time_export_items_payload_hash_nonempty
    CHECK (payload_hash <> ''),
  CONSTRAINT workforce_time_export_items_entry_kind_check
    CHECK (entry_kind IN ('session', 'visit', 'manual', 'meeting')),
  CONSTRAINT workforce_time_export_items_review_status_at_export_check
    CHECK (review_status_at_export = 'approved'),
  CONSTRAINT workforce_time_export_items_tenant_job_review_unique
    UNIQUE (tenant_id, export_job_id, review_id),
  CONSTRAINT workforce_time_export_items_tenant_reference_key_unique
    UNIQUE (tenant_id, reference_key)
);

-- Self-reference (P2.3 vorbereitet; P2.2 nutzt superseded_by_export_item_id nicht aktiv)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'workforce_time_export_items_superseded_by_fkey'
  ) THEN
    ALTER TABLE public.workforce_time_export_items
      ADD CONSTRAINT workforce_time_export_items_superseded_by_fkey
      FOREIGN KEY (superseded_by_export_item_id)
      REFERENCES public.workforce_time_export_items(id)
      ON DELETE SET NULL;
  END IF;
END $$;

COMMENT ON TABLE public.workforce_time_export_items IS
  'WFM P2.2 — finalisierte Export-Snapshots je Review. Items werden erst bei Finalisierung '
  'geschrieben (kein Draft-Persist). Source of Truth für exported_payload / CSV-Download. '
  'Kein DATEV. UNIQUE (tenant_id, reference_key) verhindert Doppel-Export in P2.2; '
  'Re-Export/Supersede in P2.3 erfordert Constraint-Anpassung.';

COMMENT ON COLUMN public.workforce_time_export_items.exported_payload IS
  'WFM P2.2 — normalisierter JSONB-Snapshot für internen CSV-Download (F4). Kein DATEV.';

COMMENT ON COLUMN public.workforce_time_export_items.changed_after_export IS
  'WFM P2.2 — Item-Snapshot immutable; Drift-Flag primär auf Review-Denormalisierung (F2).';

COMMENT ON COLUMN public.workforce_time_export_items.superseded_by_export_item_id IS
  'P2.3 — Re-Export-Kette vorbereitet; in P2.2 nicht aktiv genutzt.';

COMMENT ON COLUMN public.workforce_time_export_items.review_status_at_export IS
  'WFM P2.2 — Snapshot nur bei approved-Finalisierung (approved-only CHECK).';

-- Idempotent: falls Tabelle aus früherem Entwurf mit breiterem CHECK existiert
ALTER TABLE public.workforce_time_export_items
  DROP CONSTRAINT IF EXISTS workforce_time_export_items_review_status_at_export_check;

ALTER TABLE public.workforce_time_export_items
  ADD CONSTRAINT workforce_time_export_items_review_status_at_export_check
  CHECK (review_status_at_export = 'approved');

COMMENT ON CONSTRAINT workforce_time_export_items_tenant_job_review_unique
  ON public.workforce_time_export_items IS
  'WFM P2.2 — eine Exportposition pro Review pro Job.';

COMMENT ON CONSTRAINT workforce_time_export_items_tenant_reference_key_unique
  ON public.workforce_time_export_items IS
  'WFM P2.2 — blockiert Doppel-Finalexport pro reference_key. '
  'P2.3 Re-Export/Supersede erfordert Constraint-Anpassung.';

-- --------------------------------------------------------------------------
-- C) workforce_time_entry_reviews — Export-Denormalisierung (F1)
-- --------------------------------------------------------------------------
ALTER TABLE public.workforce_time_entry_reviews
  ADD COLUMN IF NOT EXISTS export_status TEXT NOT NULL DEFAULT 'not_exported',
  ADD COLUMN IF NOT EXISTS last_export_job_id UUID REFERENCES public.workforce_export_jobs(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS last_exported_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS changed_after_export BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.workforce_time_entry_reviews
  DROP CONSTRAINT IF EXISTS workforce_time_entry_reviews_export_status_check;

ALTER TABLE public.workforce_time_entry_reviews
  ADD CONSTRAINT workforce_time_entry_reviews_export_status_check
  CHECK (export_status IN (
    'not_exported',
    'export_ready',
    'exported',
    'changed_after_export',
    'export_blocked'
  ));

-- Idempotent: exportfähige approved Reviews als export_ready markieren (kein exported-Backfill)
UPDATE public.workforce_time_entry_reviews
SET export_status = 'export_ready'
WHERE export_status = 'not_exported'
  AND review_status = 'approved'
  AND export_blocking = FALSE;

COMMENT ON COLUMN public.workforce_time_entry_reviews.export_status IS
  'WFM P2.2 — denormalisiertes Export-UI-Flag (F1). SoT bleibt workforce_time_export_items. '
  'Finalisierung setzt exported, nicht locked (F5).';

COMMENT ON COLUMN public.workforce_time_entry_reviews.last_export_job_id IS
  'WFM P2.2 — letzter finalisierter Export-Job (Denormalisierung).';

COMMENT ON COLUMN public.workforce_time_entry_reviews.changed_after_export IS
  'WFM P2.2 — Drift-Flag denormalisiert; gesetzt via Service detectChangedAfterExport() (F2).';

-- --------------------------------------------------------------------------
-- D) workforce_time_review_actions — Export-Action-Typen
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
    'changed_after_export_detected'
  ));

COMMENT ON TABLE public.workforce_time_review_actions IS
  'WFM P2.1/P2.2 — append-only Review-Audit. Export-Actions ab P2.2; export_voided/export_reopened P2.3+.';

-- --------------------------------------------------------------------------
-- E) RLS — workforce_time_export_items (Office/Admin only, F3/F7)
-- --------------------------------------------------------------------------
ALTER TABLE public.workforce_time_export_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS wfm_time_export_items_select ON public.workforce_time_export_items;
CREATE POLICY wfm_time_export_items_select ON public.workforce_time_export_items
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND (
      public.has_permission('time.tracking.admin.export')
      OR public.is_tenant_admin()
    )
  );

DROP POLICY IF EXISTS wfm_time_export_items_insert ON public.workforce_time_export_items;
CREATE POLICY wfm_time_export_items_insert ON public.workforce_time_export_items
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND (
      public.has_permission('time.tracking.admin.export')
      OR public.is_tenant_admin()
    )
  );

COMMENT ON POLICY wfm_time_export_items_select ON public.workforce_time_export_items IS
  'WFM P2.2 F3/F7 — nur Office/Admin mit time.tracking.admin.export; kein Employee/Team-View.';

COMMENT ON POLICY wfm_time_export_items_insert ON public.workforce_time_export_items IS
  'WFM P2.2 — INSERT bei Finalisierung; kein UPDATE/DELETE für authenticated (immutable Snapshots).';

-- --------------------------------------------------------------------------
-- F) RLS — workforce_export_jobs SELECT härten (F3) + Review-Policies erweitern
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
  'WFM P2.2 F3 — reviewed_time nur admin.export/tenant_admin. '
  'session_legacy: zusätzlich Self-Read für requested_by (0193-Kompatibilität).';

DROP POLICY IF EXISTS wfm_entry_reviews_update ON public.workforce_time_entry_reviews;
CREATE POLICY wfm_entry_reviews_update ON public.workforce_time_entry_reviews
  FOR UPDATE TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND (
      public.has_permission('time.tracking.admin.correct')
      OR public.has_permission('time.tracking.admin.export')
      OR public.is_tenant_admin()
    )
  )
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND (
      public.has_permission('time.tracking.admin.correct')
      OR public.has_permission('time.tracking.admin.export')
      OR public.is_tenant_admin()
    )
  );

DROP POLICY IF EXISTS wfm_review_actions_insert ON public.workforce_time_review_actions;
CREATE POLICY wfm_review_actions_insert ON public.workforce_time_review_actions
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND (
      public.has_permission('time.tracking.admin.correct')
      OR public.has_permission('time.tracking.admin.export')
      OR public.is_tenant_admin()
    )
  );

COMMENT ON POLICY wfm_entry_reviews_update ON public.workforce_time_entry_reviews IS
  'WFM P2.1/P2.2 — admin.correct + admin.export für Review-Updates inkl. export_status (F5: nicht locked).';

-- --------------------------------------------------------------------------
-- G) Indexe
-- --------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_wfm_time_export_items_tenant_job
  ON public.workforce_time_export_items (tenant_id, export_job_id);

CREATE INDEX IF NOT EXISTS idx_wfm_time_export_items_tenant_review
  ON public.workforce_time_export_items (tenant_id, review_id);

CREATE INDEX IF NOT EXISTS idx_wfm_time_export_items_tenant_reference
  ON public.workforce_time_export_items (tenant_id, reference_key);

CREATE INDEX IF NOT EXISTS idx_wfm_time_export_items_employee_date
  ON public.workforce_time_export_items (tenant_id, employee_id, period_date DESC);

CREATE INDEX IF NOT EXISTS idx_wfm_time_export_items_changed_after_export
  ON public.workforce_time_export_items (tenant_id, changed_after_export)
  WHERE changed_after_export = TRUE;

CREATE INDEX IF NOT EXISTS idx_workforce_export_jobs_tenant_period
  ON public.workforce_export_jobs (tenant_id, period_start DESC, period_end DESC);

CREATE INDEX IF NOT EXISTS idx_workforce_time_entry_reviews_tenant_export_status
  ON public.workforce_time_entry_reviews (tenant_id, export_status)
  WHERE export_status IN ('export_ready', 'exported', 'changed_after_export');

-- --------------------------------------------------------------------------
-- H) GRANTs — Items immutable (kein UPDATE/DELETE)
-- --------------------------------------------------------------------------
GRANT SELECT, INSERT ON public.workforce_time_export_items TO authenticated;

REVOKE UPDATE, DELETE ON public.workforce_time_export_items FROM authenticated;
