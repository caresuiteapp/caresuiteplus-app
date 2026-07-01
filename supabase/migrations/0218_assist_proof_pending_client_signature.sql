-- ==========================================================================
-- CareSuite+ — Migration 0218: Assist proof restricted portal release
-- Allows portal_release_status = pending_client_signature for client signing.
-- ==========================================================================

ALTER TABLE public.assist_visit_proofs
  DROP CONSTRAINT IF EXISTS assist_visit_proofs_portal_release_status_check;

ALTER TABLE public.assist_visit_proofs
  ADD CONSTRAINT assist_visit_proofs_portal_release_status_check
    CHECK (portal_release_status IN ('none', 'released', 'pending_client_signature', 'revoked'));

COMMENT ON COLUMN public.assist_visit_proofs.portal_release_status IS
  'none | released | pending_client_signature (client must sign in portal) | revoked';
