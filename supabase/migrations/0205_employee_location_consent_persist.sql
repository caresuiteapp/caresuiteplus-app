-- LT.GMAPS.5 — Permanent employee-level location consent (tenant + employee scope).
-- Complements per-visit assist_tracking_sessions.consent_granted_at from LT.GMAPS.4.

CREATE TABLE IF NOT EXISTS public.employee_location_consents (
  id                      UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               UUID          NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  employee_id             UUID          NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  consent_granted_at      TIMESTAMPTZ   NOT NULL,
  consent_explained_at    TIMESTAMPTZ,
  revoked_at              TIMESTAMPTZ,
  created_at              TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  CONSTRAINT employee_location_consents_unique
    UNIQUE (tenant_id, employee_id)
);

CREATE INDEX IF NOT EXISTS idx_employee_location_consents_tenant_employee
  ON public.employee_location_consents (tenant_id, employee_id)
  WHERE revoked_at IS NULL;

COMMENT ON TABLE public.employee_location_consents IS
  'LT.GMAPS.5 — Dauerhafte Standort-Einwilligung pro Mitarbeiter:in und Mandant (nicht pro Einsatz).';

ALTER TABLE public.employee_location_consents ENABLE ROW LEVEL SECURITY;

-- Portal employee: read/write own consent
DROP POLICY IF EXISTS employee_location_consents_portal_employee_all ON public.employee_location_consents;
CREATE POLICY employee_location_consents_portal_employee_all ON public.employee_location_consents
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

-- Assist/Office: read-only for live monitoring
DROP POLICY IF EXISTS employee_location_consents_office_assist_select ON public.employee_location_consents;
CREATE POLICY employee_location_consents_office_assist_select ON public.employee_location_consents
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND public.is_tenant_member(tenant_id)
    AND public.current_role_key() <> 'employee_portal'
    AND public.current_role_key() <> 'client_portal'
  );
