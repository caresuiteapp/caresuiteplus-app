-- ASSIST.PERMISSIONS.2 — Consent bundle version string + execution state portal write repair.
-- Migration 0206 already applied — repair bundle_version type and RLS grants.

-- --------------------------------------------------------------------------
-- employee_consent_bundle — bundle_version INTEGER → TEXT (canonical version key)
-- --------------------------------------------------------------------------
ALTER TABLE public.employee_consent_bundle
  DROP CONSTRAINT IF EXISTS employee_consent_bundle_unique;

ALTER TABLE public.employee_consent_bundle
  ALTER COLUMN bundle_version TYPE TEXT USING (
    CASE
      WHEN bundle_version::text = '1' THEN '2026-06-employee-portal-v1'
      ELSE bundle_version::text
    END
  );

ALTER TABLE public.employee_consent_bundle
  ALTER COLUMN bundle_version SET DEFAULT '2026-06-employee-portal-v1';

ALTER TABLE public.employee_consent_bundle
  ADD CONSTRAINT employee_consent_bundle_unique
    UNIQUE (tenant_id, employee_id, bundle_version);

CREATE INDEX IF NOT EXISTS idx_employee_consent_bundle_tenant_employee_version
  ON public.employee_consent_bundle (tenant_id, employee_id, bundle_version);

COMMENT ON COLUMN public.employee_consent_bundle.bundle_version IS
  'ASSIST.PERMISSIONS.2 — Canonical consent bundle version key (e.g. 2026-06-employee-portal-v1).';

-- Ensure portal employee can upsert own bundle (0206 policies — re-assert after type change)
DROP POLICY IF EXISTS employee_consent_bundle_portal_employee_all ON public.employee_consent_bundle;
CREATE POLICY employee_consent_bundle_portal_employee_all ON public.employee_consent_bundle
  FOR ALL TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND public.current_role_key() = 'employee_portal'
    AND employee_id = public.resolve_current_employee_id()
  )
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND public.current_role_key() = 'employee_portal'
    AND employee_id = public.resolve_current_employee_id()
  );

GRANT SELECT, INSERT, UPDATE ON public.employee_consent_bundle TO authenticated;

-- --------------------------------------------------------------------------
-- assist_visit_execution_state — ensure portal employee INSERT/UPDATE for arrival
-- --------------------------------------------------------------------------
DROP POLICY IF EXISTS assist_visit_execution_state_portal_employee ON public.assist_visit_execution_state;
CREATE POLICY assist_visit_execution_state_portal_employee ON public.assist_visit_execution_state
  FOR ALL TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND public.current_role_key() = 'employee_portal'
    AND visit_id IN (SELECT public.portal_employee_assigned_visit_ids(tenant_id))
  )
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND public.current_role_key() = 'employee_portal'
    AND visit_id IN (SELECT public.portal_employee_assigned_visit_ids(tenant_id))
  );

GRANT SELECT, INSERT, UPDATE ON public.assist_visit_execution_state TO authenticated;
