-- ==========================================================================
-- CareSuite+ — Migration 0239: client_documents portal proof metadata
-- Adds columns used by assist proof mirror (upsertAssistProofClientPortalDocument)
-- and portal service proof listing (portalServiceProofService).
-- ==========================================================================

ALTER TABLE public.client_documents
  ADD COLUMN IF NOT EXISTS signed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS signature_required BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS service_record_id UUID REFERENCES public.service_records(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS service_month TEXT;

CREATE INDEX IF NOT EXISTS idx_client_documents_service_record
  ON public.client_documents (tenant_id, service_record_id)
  WHERE service_record_id IS NOT NULL;

COMMENT ON COLUMN public.client_documents.signed_at IS
  '0239 — Signature timestamp for portal-visible Leistungsnachweise (assist mirror).';
COMMENT ON COLUMN public.client_documents.signature_required IS
  '0239 — Client signature still required (restricted portal release).';
COMMENT ON COLUMN public.client_documents.service_record_id IS
  '0239 — Linked billing service record when mirrored from legacy proofs.';
COMMENT ON COLUMN public.client_documents.service_month IS
  '0239 — Service period label for portal proof list (ISO date or month key).';
