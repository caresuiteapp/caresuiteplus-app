-- ==========================================================================
-- CareSuite+ — Migration 0032: DSGVO Admin Status-Update RLS
-- Safe additive migration — ADD policy only, no DROP.
-- Allows tenant admins with security.manage to update request status.
-- ==========================================================================

DO $$ BEGIN
  CREATE POLICY data_subject_requests_admin_status_update ON public.data_subject_requests
    FOR UPDATE
    USING (
      tenant_id = public.current_tenant_id()
      AND public.has_permission('security.manage')
    )
    WITH CHECK (
      tenant_id = public.current_tenant_id()
      AND public.has_permission('security.manage')
    );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

COMMENT ON POLICY data_subject_requests_admin_status_update ON public.data_subject_requests IS
  'DSGVO Admin darf Status von Betroffenenanfragen im Mandanten aktualisieren (Sprint 58)';
