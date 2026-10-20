-- ==========================================================================
-- CareSuite+ — Migration 0017: RLS-Härtung Auth/Portal-Tabellen
-- Hashes nur serverseitig (Edge Functions); Clients lesen sichere Views.
-- ==========================================================================

CREATE INDEX IF NOT EXISTS idx_employee_portal_accounts_username_lower
  ON public.employee_portal_accounts (lower(username));

CREATE INDEX IF NOT EXISTS idx_tenant_users_username_lower
  ON public.tenant_users (tenant_id, lower(username));

CREATE INDEX IF NOT EXISTS idx_client_portal_codes_tenant_status
  ON public.client_portal_codes (tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_relative_portal_codes_tenant_status
  ON public.relative_portal_codes (tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_login_audit_events_tenant_created
  ON public.login_audit_events (tenant_id, created_at DESC);

-- Sichere Views ohne Geheimnisse (security_invoker = RLS des aufrufenden Users)
CREATE OR REPLACE VIEW public.employee_portal_accounts_mgmt
WITH (security_invoker = true) AS
SELECT
  id,
  tenant_id,
  employee_id,
  username,
  status,
  must_change_password,
  first_login_completed,
  temporary_password_created_at,
  temporary_password_expires_at,
  last_login_at,
  created_by,
  created_at,
  updated_at,
  blocked_at,
  blocked_by,
  blocked_reason
FROM public.employee_portal_accounts;

CREATE OR REPLACE VIEW public.client_portal_codes_mgmt
WITH (security_invoker = true) AS
SELECT
  id,
  tenant_id,
  client_id,
  status,
  expires_at,
  last_used_at,
  created_by,
  created_at,
  updated_at,
  blocked_at,
  blocked_by,
  blocked_reason,
  regenerated_at
FROM public.client_portal_codes;

CREATE OR REPLACE VIEW public.relative_portal_codes_mgmt
WITH (security_invoker = true) AS
SELECT
  id,
  tenant_id,
  client_id,
  relative_contact_id,
  status,
  expires_at,
  last_used_at,
  created_by,
  created_at,
  updated_at,
  blocked_at,
  blocked_by,
  blocked_reason,
  regenerated_at
FROM public.relative_portal_codes;

GRANT SELECT ON public.employee_portal_accounts_mgmt TO authenticated;
GRANT SELECT ON public.client_portal_codes_mgmt TO authenticated;
GRANT SELECT ON public.relative_portal_codes_mgmt TO authenticated;

-- Kein direkter SELECT auf Hash-Spalten für authenticated
REVOKE SELECT ON public.employee_portal_accounts FROM authenticated;
REVOKE SELECT ON public.client_portal_codes FROM authenticated;
REVOKE SELECT ON public.relative_portal_codes FROM authenticated;

GRANT INSERT, UPDATE ON public.employee_portal_accounts TO authenticated;
GRANT INSERT, UPDATE ON public.client_portal_codes TO authenticated;
GRANT INSERT, UPDATE ON public.relative_portal_codes TO authenticated;

-- Policies: Schreiben bleibt mandantenisoliert; Lesen über Views
DROP POLICY IF EXISTS employee_portal_accounts_tenant_isolation ON public.employee_portal_accounts;
DROP POLICY IF EXISTS client_portal_codes_tenant_isolation ON public.client_portal_codes;
DROP POLICY IF EXISTS relative_portal_codes_tenant_isolation ON public.relative_portal_codes;

CREATE POLICY employee_portal_accounts_insert ON public.employee_portal_accounts
  FOR INSERT WITH CHECK (tenant_id = public.current_tenant_id());

CREATE POLICY employee_portal_accounts_update ON public.employee_portal_accounts
  FOR UPDATE
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

CREATE POLICY client_portal_codes_insert ON public.client_portal_codes
  FOR INSERT WITH CHECK (tenant_id = public.current_tenant_id());

CREATE POLICY client_portal_codes_update ON public.client_portal_codes
  FOR UPDATE
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

CREATE POLICY relative_portal_codes_insert ON public.relative_portal_codes
  FOR INSERT WITH CHECK (tenant_id = public.current_tenant_id());

CREATE POLICY relative_portal_codes_update ON public.relative_portal_codes
  FOR UPDATE
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());
