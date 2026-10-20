-- ASSIST.PERMISSIONS.1 — Employee permission onboarding + arrival audit event types.
-- Migration 0205 (LT.GMAPS.5 location consent) already exists — do not duplicate.

-- --------------------------------------------------------------------------
-- employee_permission_states — browser/device permission snapshots per kind
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.employee_permission_states (
  id                      UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               UUID          NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  employee_id             UUID          NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  permission_kind         TEXT          NOT NULL,
  browser_status          TEXT          NOT NULL DEFAULT 'undetermined',
  last_checked_at         TIMESTAMPTZ,
  last_requested_at       TIMESTAMPTZ,
  explained_at            TIMESTAMPTZ,
  metadata                JSONB         NOT NULL DEFAULT '{}'::jsonb,
  created_at              TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  CONSTRAINT employee_permission_states_kind_check
    CHECK (permission_kind IN ('location', 'notifications', 'camera', 'microphone', 'signature')),
  CONSTRAINT employee_permission_states_status_check
    CHECK (browser_status IN ('granted', 'denied', 'prompt', 'unavailable', 'undetermined')),
  CONSTRAINT employee_permission_states_unique
    UNIQUE (tenant_id, employee_id, permission_kind)
);

CREATE INDEX IF NOT EXISTS idx_employee_permission_states_tenant_employee
  ON public.employee_permission_states (tenant_id, employee_id);

COMMENT ON TABLE public.employee_permission_states IS
  'ASSIST.PERMISSIONS.1 — Browser/OS permission state per Mitarbeiter:in (separate from internal consent).';

-- --------------------------------------------------------------------------
-- employee_consent_bundle — one-time permission onboarding completion
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.employee_consent_bundle (
  id                      UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               UUID          NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  employee_id             UUID          NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  bundle_version          INTEGER       NOT NULL DEFAULT 1,
  completed_at            TIMESTAMPTZ   NOT NULL,
  explained_permissions   JSONB         NOT NULL DEFAULT '[]'::jsonb,
  location_internal_at    TIMESTAMPTZ,
  metadata                JSONB         NOT NULL DEFAULT '{}'::jsonb,
  created_at              TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  CONSTRAINT employee_consent_bundle_unique
    UNIQUE (tenant_id, employee_id, bundle_version)
);

CREATE INDEX IF NOT EXISTS idx_employee_consent_bundle_tenant_employee
  ON public.employee_consent_bundle (tenant_id, employee_id);

COMMENT ON TABLE public.employee_consent_bundle IS
  'ASSIST.PERMISSIONS.1 — Central permission/consent onboarding completion per Mitarbeiter:in.';

-- --------------------------------------------------------------------------
-- assist_time_events — extend arrival audit event types
-- --------------------------------------------------------------------------
ALTER TABLE public.assist_time_events
  DROP CONSTRAINT IF EXISTS assist_time_events_type_check;

ALTER TABLE public.assist_time_events
  ADD CONSTRAINT assist_time_events_type_check
  CHECK (event_type IN (
    'drive_start', 'drive_end', 'service_start', 'service_end',
    'pause_start', 'pause_end', 'arrive', 'depart',
    'arrived_without_gps', 'arrived_manual'
  ));

-- --------------------------------------------------------------------------
-- RLS — employee_permission_states
-- --------------------------------------------------------------------------
ALTER TABLE public.employee_permission_states ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS employee_permission_states_portal_employee_all ON public.employee_permission_states;
CREATE POLICY employee_permission_states_portal_employee_all ON public.employee_permission_states
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

DROP POLICY IF EXISTS employee_permission_states_office_assist_select ON public.employee_permission_states;
CREATE POLICY employee_permission_states_office_assist_select ON public.employee_permission_states
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND public.is_tenant_member(tenant_id)
    AND public.current_role_key() <> 'employee_portal'
    AND public.current_role_key() <> 'client_portal'
  );

-- --------------------------------------------------------------------------
-- RLS — employee_consent_bundle
-- --------------------------------------------------------------------------
ALTER TABLE public.employee_consent_bundle ENABLE ROW LEVEL SECURITY;

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

DROP POLICY IF EXISTS employee_consent_bundle_office_assist_select ON public.employee_consent_bundle;
CREATE POLICY employee_consent_bundle_office_assist_select ON public.employee_consent_bundle
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND public.is_tenant_member(tenant_id)
    AND public.current_role_key() <> 'employee_portal'
    AND public.current_role_key() <> 'client_portal'
  );

GRANT SELECT, INSERT, UPDATE ON public.employee_permission_states TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.employee_consent_bundle TO authenticated;
