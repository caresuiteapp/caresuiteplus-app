-- ==========================================================================
-- CareSuite+ — Migration 0016: Auth, Portalzugänge & Benutzerverwaltung
-- Keine destruktiven Befehle (DROP/TRUNCATE/DELETE auf Produktionsdaten).
-- ==========================================================================

CREATE TABLE IF NOT EXISTS public.tenant_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  auth_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  employee_id UUID,
  display_name TEXT NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT NOT NULL,
  username TEXT NOT NULL,
  role_key TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','blocked','pending_first_login','password_reset_required','expired','archived')),
  must_change_password BOOLEAN NOT NULL DEFAULT FALSE,
  first_login_completed BOOLEAN NOT NULL DEFAULT FALSE,
  last_login_at TIMESTAMPTZ,
  last_password_change_at TIMESTAMPTZ,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  archived_at TIMESTAMPTZ,
  UNIQUE (tenant_id, username),
  UNIQUE (tenant_id, email)
);

CREATE TABLE IF NOT EXISTS public.employee_portal_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL,
  username TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending_first_login'
    CHECK (status IN ('active','blocked','pending_first_login','password_reset_required','expired','archived')),
  must_change_password BOOLEAN NOT NULL DEFAULT TRUE,
  first_login_completed BOOLEAN NOT NULL DEFAULT FALSE,
  temporary_password_hash TEXT,
  temporary_password_created_at TIMESTAMPTZ,
  temporary_password_expires_at TIMESTAMPTZ,
  last_login_at TIMESTAMPTZ,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  blocked_at TIMESTAMPTZ,
  blocked_by UUID,
  blocked_reason TEXT,
  UNIQUE (tenant_id, username)
);

CREATE TABLE IF NOT EXISTS public.client_portal_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  client_id UUID NOT NULL,
  code_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','blocked','expired','regenerated','revoked')),
  expires_at TIMESTAMPTZ,
  last_used_at TIMESTAMPTZ,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  blocked_at TIMESTAMPTZ,
  blocked_by UUID,
  blocked_reason TEXT,
  regenerated_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.relative_portal_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  client_id UUID NOT NULL,
  relative_contact_id UUID NOT NULL,
  code_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','blocked','expired','regenerated','revoked')),
  expires_at TIMESTAMPTZ,
  last_used_at TIMESTAMPTZ,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  blocked_at TIMESTAMPTZ,
  blocked_by UUID,
  blocked_reason TEXT,
  regenerated_at TIMESTAMPTZ
);

DO $$ BEGIN
  CREATE TYPE public.portal_type AS ENUM (
    'employee',
    'client',
    'relative',
    'business',
    'demo'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.portal_session_status AS ENUM (
    'active',
    'expired',
    'revoked',
    'logged_out'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- access_code_id ohne FK: access_codes existiert nicht in frühen Migrationen (nur Live-Drift).
CREATE TABLE IF NOT EXISTS public.portal_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  portal_type public.portal_type NOT NULL,
  access_code_id UUID,
  profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  employee_id UUID REFERENCES public.employees(id) ON DELETE SET NULL,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  relative_contact_id UUID REFERENCES public.client_contacts(id) ON DELETE SET NULL,
  status public.portal_session_status NOT NULL DEFAULT 'active'::public.portal_session_status,
  session_token TEXT UNIQUE,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  logged_out_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  revoked_reason TEXT,
  ip_address TEXT,
  user_agent TEXT,
  device_fingerprint TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_portal_sessions_client
  ON public.portal_sessions (client_id);
CREATE INDEX IF NOT EXISTS idx_portal_sessions_employee
  ON public.portal_sessions (employee_id);
CREATE INDEX IF NOT EXISTS idx_portal_sessions_expires
  ON public.portal_sessions (expires_at);
CREATE INDEX IF NOT EXISTS idx_portal_sessions_tenant_status
  ON public.portal_sessions (tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_portal_sessions_token
  ON public.portal_sessions (session_token);

CREATE TABLE IF NOT EXISTS public.portal_access_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  portal_type TEXT NOT NULL CHECK (portal_type IN ('client','relative')),
  portal_account_id UUID NOT NULL,
  can_view_appointments BOOLEAN NOT NULL DEFAULT TRUE,
  can_view_documents BOOLEAN NOT NULL DEFAULT TRUE,
  can_view_messages BOOLEAN NOT NULL DEFAULT TRUE,
  can_send_messages BOOLEAN NOT NULL DEFAULT FALSE,
  can_view_service_records BOOLEAN NOT NULL DEFAULT TRUE,
  can_view_invoices BOOLEAN NOT NULL DEFAULT FALSE,
  can_download_documents BOOLEAN NOT NULL DEFAULT TRUE,
  can_confirm_appointments BOOLEAN NOT NULL DEFAULT FALSE,
  can_sign_records BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.role_permission_sets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  role_key TEXT NOT NULL,
  permission_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, role_key, permission_key)
);

CREATE TABLE IF NOT EXISTS public.user_module_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  tenant_user_id UUID NOT NULL REFERENCES public.tenant_users(id) ON DELETE CASCADE,
  module_key TEXT NOT NULL,
  can_view BOOLEAN NOT NULL DEFAULT FALSE,
  can_create BOOLEAN NOT NULL DEFAULT FALSE,
  can_edit BOOLEAN NOT NULL DEFAULT FALSE,
  can_archive BOOLEAN NOT NULL DEFAULT FALSE,
  can_export BOOLEAN NOT NULL DEFAULT FALSE,
  can_manage_settings BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, tenant_user_id, module_key)
);

CREATE TABLE IF NOT EXISTS public.login_audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE SET NULL,
  login_type TEXT NOT NULL CHECK (login_type IN ('business','employee_portal','client_portal','relative_portal')),
  account_id UUID,
  username_or_code_hint TEXT NOT NULL,
  success BOOLEAN NOT NULL,
  failure_reason TEXT,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.password_reset_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  account_type TEXT NOT NULL CHECK (account_type IN ('tenant_user','employee_portal')),
  account_id UUID NOT NULL,
  initiated_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.access_block_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  account_type TEXT NOT NULL,
  account_id UUID NOT NULL,
  blocked BOOLEAN NOT NULL,
  reason TEXT,
  actor_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.tenant_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_portal_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_portal_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.relative_portal_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portal_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portal_access_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permission_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_module_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.login_audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.password_reset_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.access_block_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_users_tenant_isolation ON public.tenant_users
  FOR ALL USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

CREATE POLICY employee_portal_accounts_tenant_isolation ON public.employee_portal_accounts
  FOR ALL USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

CREATE POLICY client_portal_codes_tenant_isolation ON public.client_portal_codes
  FOR ALL USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

CREATE POLICY relative_portal_codes_tenant_isolation ON public.relative_portal_codes
  FOR ALL USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS portal_sessions_select_own_tenant ON public.portal_sessions;
CREATE POLICY portal_sessions_select_own_tenant ON public.portal_sessions
  FOR SELECT USING (tenant_id = public.current_tenant_id());

CREATE POLICY portal_access_permissions_tenant_isolation ON public.portal_access_permissions
  FOR ALL USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

CREATE POLICY role_permission_sets_tenant_isolation ON public.role_permission_sets
  FOR ALL USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

CREATE POLICY user_module_permissions_tenant_isolation ON public.user_module_permissions
  FOR ALL USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

CREATE POLICY login_audit_events_tenant_isolation ON public.login_audit_events
  FOR SELECT USING (tenant_id = public.current_tenant_id() OR tenant_id IS NULL);

CREATE POLICY login_audit_events_insert ON public.login_audit_events
  FOR INSERT WITH CHECK (tenant_id IS NULL OR tenant_id = public.current_tenant_id());

CREATE POLICY password_reset_events_tenant_isolation ON public.password_reset_events
  FOR ALL USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

CREATE POLICY access_block_events_tenant_isolation ON public.access_block_events
  FOR ALL USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

GRANT SELECT, INSERT, UPDATE ON public.tenant_users TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.employee_portal_accounts TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.client_portal_codes TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.relative_portal_codes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.portal_sessions TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.portal_access_permissions TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.role_permission_sets TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.user_module_permissions TO authenticated;
GRANT SELECT, INSERT ON public.login_audit_events TO authenticated;
GRANT SELECT, INSERT ON public.password_reset_events TO authenticated;
GRANT SELECT, INSERT ON public.access_block_events TO authenticated;
