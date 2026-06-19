-- ==========================================================================
-- CareSuite+ — Migration 0100: Access Management RLS auf Live
-- /business/office/access → 42501 (RLS): security_invoker mgmt-Views
-- (employee_portal_accounts_mgmt, relative_portal_codes_mgmt) brauchen
-- SELECT auf Basistabellen; 0017 REVOKE SELECT blockiert Invoker-Lesezugriff.
-- Live-Rollen (owner/admin) brauchen office.access in role_permissions.
-- Pattern: 0076_employees_create_rls_live.sql, 0083_owner_clients_permissions_live.sql
-- ==========================================================================

-- --------------------------------------------------------------------------
-- office.access — Live-Mandanten-Rollen (Helferhasen+ owner/admin)
-- --------------------------------------------------------------------------
INSERT INTO public.role_permissions (role_id, permission_key)
SELECT r.id, p.key
FROM public.roles r
CROSS JOIN (VALUES ('office.access')) AS p(key)
WHERE r.key IN (
  'owner',
  'admin',
  'management',
  'geschaeftsfuehrung',
  'office',
  'planning',
  'pdl',
  'billing',
  'quality_management',
  'team_lead',
  'dispatcher'
)
ON CONFLICT (role_id, permission_key) DO NOTHING;

-- --------------------------------------------------------------------------
-- employee_portal_accounts: sichere Spalten für mgmt-View (ohne Passwort-Hash)
-- --------------------------------------------------------------------------
GRANT SELECT (
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
) ON public.employee_portal_accounts TO authenticated;

DROP POLICY IF EXISTS employee_portal_accounts_select ON public.employee_portal_accounts;
CREATE POLICY employee_portal_accounts_select ON public.employee_portal_accounts
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND (
      public.has_permission('office.access')
      OR public.is_tenant_admin()
    )
  );

-- --------------------------------------------------------------------------
-- relative_portal_codes: sichere Spalten für mgmt-View (ohne code_hash)
-- --------------------------------------------------------------------------
GRANT SELECT (
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
) ON public.relative_portal_codes TO authenticated;

DROP POLICY IF EXISTS relative_portal_codes_select ON public.relative_portal_codes;
CREATE POLICY relative_portal_codes_select ON public.relative_portal_codes
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND (
      public.has_permission('office.access')
      OR public.is_tenant_admin()
    )
  );

-- --------------------------------------------------------------------------
-- client_portal_codes: sichere Spalten für mgmt-View (ohne code_hash)
-- --------------------------------------------------------------------------
GRANT SELECT (
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
) ON public.client_portal_codes TO authenticated;

DROP POLICY IF EXISTS client_portal_codes_select ON public.client_portal_codes;
CREATE POLICY client_portal_codes_select ON public.client_portal_codes
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND (
      public.has_permission('office.access')
      OR public.is_tenant_admin()
    )
  );

-- --------------------------------------------------------------------------
-- tenant_users + login_audit_events: Office-Zugangsverwaltung lesen
-- (bisher nur Mandantenisolation — ergänzt office.access für Konsistenz)
-- --------------------------------------------------------------------------
DROP POLICY IF EXISTS tenant_users_tenant_isolation ON public.tenant_users;

CREATE POLICY tenant_users_select ON public.tenant_users
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND (
      public.has_permission('office.access')
      OR public.is_tenant_admin()
    )
  );

CREATE POLICY tenant_users_insert ON public.tenant_users
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND (
      public.has_permission('office.access')
      OR public.is_tenant_admin()
    )
  );

CREATE POLICY tenant_users_update ON public.tenant_users
  FOR UPDATE TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND (
      public.has_permission('office.access')
      OR public.is_tenant_admin()
    )
  )
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND (
      public.has_permission('office.access')
      OR public.is_tenant_admin()
    )
  );

DROP POLICY IF EXISTS login_audit_events_tenant_isolation ON public.login_audit_events;
CREATE POLICY login_audit_events_select ON public.login_audit_events
  FOR SELECT TO authenticated
  USING (
    (tenant_id = public.current_tenant_id() OR tenant_id IS NULL)
    AND (
      public.has_permission('office.access')
      OR public.is_tenant_admin()
    )
  );
