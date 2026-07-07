-- ==========================================================================
-- CareSuite+ — Migration 0240: WFM Phase 2.1 — Review-Persistenz (ENTWURF)
--
-- Scope P2.1 ONLY:
--   - workforce_time_entry_reviews   (Office-Prüfstatus pro Zeitblock)
--   - workforce_time_review_actions  (append-only Review-Lifecycle)
--   - RLS analog 0190/0223 (resolve_current_employee_id, has_permission)
--
-- NICHT in P2.1:
--   - export_status / export_job_id / exported_at / export_batch_id / export_item_id
--   - review_status: exported, changed_after_export (→ P2.2/P2.3 Export-Logik)
--   - action: export_marked (→ P2.3)
--   - workforce_export_job_items, manual_time_entries, travel_rules,
--     time_conflicts, meeting_time_links
--
-- review_status P2.1 (DB-Werte):
--   open, pending_review, needs_clarification, approved, rejected,
--   corrected, locked, superseded
-- Mapping UI/Anforderung: „pending“ → pending_review (siehe schema-approval §6)
--
-- ⚠️  ENTWURF — NICHT remote anwenden ohne P2.0-Verifikation (0190–0195).
-- ⚠️  Kein supabase db push / MCP apply ohne explizite Freigabe.
-- Basis: docs/architecture/wfm-phase2-schema-approval.md (Option B)
-- ==========================================================================

-- --------------------------------------------------------------------------
-- 1. workforce_time_entry_reviews — kanonische Review-Zeile (polymorph)
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.workforce_time_entry_reviews (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  employee_id       UUID        NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  work_date         DATE        NOT NULL,
  entry_kind        TEXT        NOT NULL CHECK (entry_kind IN (
    'session', 'visit', 'manual', 'meeting'
  )),
  reference_id      UUID        NOT NULL,
  reference_key     TEXT        NOT NULL,
  review_status     TEXT        NOT NULL DEFAULT 'open' CHECK (review_status IN (
    'open',
    'pending_review',
    'needs_clarification',
    'approved',
    'rejected',
    'corrected',
    'locked',
    'superseded'
  )),
  export_blocking   BOOLEAN     NOT NULL DEFAULT TRUE,
  review_note       TEXT,
  office_comment    TEXT,
  reviewed_at       TIMESTAMPTZ,
  reviewed_by       UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  ampel_snapshot    JSONB       NOT NULL DEFAULT '{}'::jsonb,
  justifications    JSONB       NOT NULL DEFAULT '{}'::jsonb,
  flags             JSONB       NOT NULL DEFAULT '{}'::jsonb,
  metadata          JSONB       NOT NULL DEFAULT '{}'::jsonb,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT workforce_time_entry_reviews_tenant_reference_key_unique
    UNIQUE (tenant_id, reference_key)
);

CREATE INDEX IF NOT EXISTS idx_workforce_time_entry_reviews_tenant_employee_date
  ON public.workforce_time_entry_reviews (tenant_id, employee_id, work_date DESC);

CREATE INDEX IF NOT EXISTS idx_workforce_time_entry_reviews_tenant_status_active
  ON public.workforce_time_entry_reviews (tenant_id, review_status)
  WHERE review_status IN ('pending_review', 'needs_clarification');

CREATE INDEX IF NOT EXISTS idx_workforce_time_entry_reviews_tenant_export_blocking
  ON public.workforce_time_entry_reviews (tenant_id, work_date DESC)
  WHERE export_blocking = TRUE;

CREATE INDEX IF NOT EXISTS idx_workforce_time_entry_reviews_reference
  ON public.workforce_time_entry_reviews (tenant_id, entry_kind, reference_id);

COMMENT ON TABLE public.workforce_time_entry_reviews IS
  'WFM P2.1 — persistenter Office-Prüfstatus pro Zeitblock (visit/session/manual/meeting). '
  'reference_key: {tenant_id}:{employee_id}:{work_date}:{entry_kind}:{reference_id}. '
  'Polymorphe reference_id ohne DB-FK — Validierung auf App-Ebene. '
  'Export-Statuswerte (exported, changed_after_export) folgen in P2.2/P2.3.';

COMMENT ON COLUMN public.workforce_time_entry_reviews.reference_key IS
  'Stabiler Idempotenz-Key, UNIQUE pro Mandant. Beispiel: '
  '{tenant}:{employee}:{work_date}:visit:{visit_id}';

COMMENT ON COLUMN public.workforce_time_entry_reviews.review_status IS
  'P2.1 Review-Lifecycle. open = Ampel grün/gelb ohne Pflichtaktion; '
  'pending_review = prüfpflichtig (UI-Alias: pending). '
  'exported/changed_after_export bewusst ausgeschlossen (P2.2/P2.3).';

COMMENT ON COLUMN public.workforce_time_entry_reviews.export_blocking IS
  'Review-seitiges Flag: blockiert Export solange Prüfung nicht freigegeben. '
  'Kein Export-Persistenzfeld — App leitet aus review_status ab; Index für Prüfqueue.';

-- --------------------------------------------------------------------------
-- 2. workforce_time_review_actions — append-only Transitionen
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.workforce_time_review_actions (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  entry_review_id   UUID        NOT NULL REFERENCES public.workforce_time_entry_reviews(id) ON DELETE RESTRICT,
  action            TEXT        NOT NULL CHECK (action IN (
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
    'justification_updated'
  )),
  prev_status       TEXT        CHECK (prev_status IS NULL OR prev_status IN (
    'open',
    'pending_review',
    'needs_clarification',
    'approved',
    'rejected',
    'corrected',
    'locked',
    'superseded'
  )),
  new_status        TEXT        CHECK (new_status IS NULL OR new_status IN (
    'open',
    'pending_review',
    'needs_clarification',
    'approved',
    'rejected',
    'corrected',
    'locked',
    'superseded'
  )),
  reason            TEXT,
  comment           TEXT,
  old_value         JSONB,
  new_value         JSONB,
  actor_id          UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  source            TEXT        NOT NULL DEFAULT 'office' CHECK (source IN (
    'office', 'portal', 'system', 'import', 'correction'
  )),
  metadata          JSONB       NOT NULL DEFAULT '{}'::jsonb,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_workforce_time_review_actions_review
  ON public.workforce_time_review_actions (entry_review_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_workforce_time_review_actions_tenant
  ON public.workforce_time_review_actions (tenant_id, created_at DESC);

COMMENT ON TABLE public.workforce_time_review_actions IS
  'WFM P2.1 — append-only Audit jeder Review-Transition. Kein UPDATE/DELETE für authenticated. '
  'export_marked folgt in P2.3.';

-- --------------------------------------------------------------------------
-- 3. updated_at trigger (reviews only — actions are append-only)
-- --------------------------------------------------------------------------
DROP TRIGGER IF EXISTS set_workforce_time_entry_reviews_updated_at
  ON public.workforce_time_entry_reviews;
CREATE TRIGGER set_workforce_time_entry_reviews_updated_at
  BEFORE UPDATE ON public.workforce_time_entry_reviews
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- --------------------------------------------------------------------------
-- 4. RLS — aligned with 0223_wfm_portal_rls_alignment.sql
-- --------------------------------------------------------------------------
ALTER TABLE public.workforce_time_entry_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workforce_time_review_actions ENABLE ROW LEVEL SECURITY;

-- Reviews: SELECT — own employee, team view, admin, audit
DROP POLICY IF EXISTS wfm_entry_reviews_select ON public.workforce_time_entry_reviews;
CREATE POLICY wfm_entry_reviews_select ON public.workforce_time_entry_reviews
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND (
      employee_id = public.resolve_current_employee_id()
      OR public.has_permission('time.tracking.team.view')
      OR public.has_permission('time.tracking.admin.view')
      OR public.has_permission('time.audit.view')
      OR public.is_tenant_admin()
    )
  );

-- Reviews: INSERT — admin/system only (lazy upsert via Repository oder SECURITY DEFINER RPC später)
DROP POLICY IF EXISTS wfm_entry_reviews_insert ON public.workforce_time_entry_reviews;
CREATE POLICY wfm_entry_reviews_insert ON public.workforce_time_entry_reviews
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND (
      public.has_permission('time.tracking.admin.correct')
      OR public.is_tenant_admin()
    )
  );

-- Reviews: UPDATE — admin correct only (Portal-Justification D3: spätere Policy)
DROP POLICY IF EXISTS wfm_entry_reviews_update ON public.workforce_time_entry_reviews;
CREATE POLICY wfm_entry_reviews_update ON public.workforce_time_entry_reviews
  FOR UPDATE TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND (
      public.has_permission('time.tracking.admin.correct')
      OR public.is_tenant_admin()
    )
  )
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND (
      public.has_permission('time.tracking.admin.correct')
      OR public.is_tenant_admin()
    )
  );

-- Review actions: SELECT — own review chain, team, audit, admin
DROP POLICY IF EXISTS wfm_review_actions_select ON public.workforce_time_review_actions;
CREATE POLICY wfm_review_actions_select ON public.workforce_time_review_actions
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND (
      EXISTS (
        SELECT 1
        FROM public.workforce_time_entry_reviews r
        WHERE r.id = entry_review_id
          AND r.tenant_id = public.current_tenant_id()
          AND r.employee_id = public.resolve_current_employee_id()
      )
      OR public.has_permission('time.tracking.team.view')
      OR public.has_permission('time.tracking.admin.view')
      OR public.has_permission('time.audit.view')
      OR public.is_tenant_admin()
    )
  );

-- Review actions: INSERT — admin correct only (Service Role bypasses RLS)
DROP POLICY IF EXISTS wfm_review_actions_insert ON public.workforce_time_review_actions;
CREATE POLICY wfm_review_actions_insert ON public.workforce_time_review_actions
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND (
      public.has_permission('time.tracking.admin.correct')
      OR public.is_tenant_admin()
    )
  );

COMMENT ON POLICY wfm_entry_reviews_insert ON public.workforce_time_entry_reviews IS
  'P2.1 — Review-Materialisierung nur Admin/Service; Portal-MA liest eigene Reviews.';

COMMENT ON POLICY wfm_review_actions_insert ON public.workforce_time_review_actions IS
  'P2.1 — append-only; kein UPDATE/DELETE-Policy für authenticated.';

-- --------------------------------------------------------------------------
-- 5. GRANTs
-- --------------------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE ON public.workforce_time_entry_reviews TO authenticated;
GRANT SELECT, INSERT ON public.workforce_time_review_actions TO authenticated;
