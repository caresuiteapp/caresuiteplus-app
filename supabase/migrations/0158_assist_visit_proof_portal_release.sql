-- ==========================================================================
-- CareSuite+ — Migration 0158: Assist visit proof portal release fields
-- Additive only — portal visibility, approval notes, PDF path/hash.
-- ==========================================================================

ALTER TABLE public.assist_visit_proofs
  ADD COLUMN IF NOT EXISTS portal_visible BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS released_to_portal_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS portal_release_status TEXT NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS approval_note TEXT,
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
  ADD COLUMN IF NOT EXISTS pdf_storage_path TEXT,
  ADD COLUMN IF NOT EXISTS pdf_hash TEXT;

ALTER TABLE public.assist_visit_proofs
  DROP CONSTRAINT IF EXISTS assist_visit_proofs_portal_release_status_check;

ALTER TABLE public.assist_visit_proofs
  ADD CONSTRAINT assist_visit_proofs_portal_release_status_check
    CHECK (portal_release_status IN ('none', 'released', 'revoked'));

ALTER TABLE public.assist_visit_proofs
  DROP CONSTRAINT IF EXISTS assist_visit_proofs_status_check;

ALTER TABLE public.assist_visit_proofs
  ADD CONSTRAINT assist_visit_proofs_status_check
    CHECK (status IN ('draft', 'pending_review', 'approved', 'exported', 'archived', 'rejected'));

CREATE INDEX IF NOT EXISTS idx_assist_visit_proofs_tenant_portal
  ON public.assist_visit_proofs (tenant_id, portal_visible)
  WHERE portal_visible = TRUE;

CREATE INDEX IF NOT EXISTS idx_assist_visit_proofs_tenant_portal_release
  ON public.assist_visit_proofs (tenant_id, portal_release_status);

COMMENT ON COLUMN public.assist_visit_proofs.portal_visible IS
  'TRUE when proof PDF is released to client portal (Migration 0158)';
COMMENT ON COLUMN public.assist_visit_proofs.pdf_storage_path IS
  'Supabase Storage path for generated PDF — tenant/…/assist/visits/…/proofs/{id}.pdf';
