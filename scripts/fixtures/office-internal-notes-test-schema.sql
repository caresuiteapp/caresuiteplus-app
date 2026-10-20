-- Isolated synthetic schema. Hosted auth.uid/JWT and tenant resolution are
-- explicit adapters; the actual company authorization SQL is loaded unchanged.
CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
CREATE SCHEMA auth; CREATE SCHEMA care_security;
GRANT USAGE ON SCHEMA auth,care_security TO authenticated,service_role;
CREATE TABLE auth.users(id uuid PRIMARY KEY,deleted_at timestamptz,banned_until timestamptz);
CREATE TABLE public.tenants(id uuid PRIMARY KEY);
CREATE TABLE public.roles(id uuid PRIMARY KEY,key text,tenant_id uuid,is_admin_role boolean DEFAULT false);
CREATE TABLE public.profiles(id uuid PRIMARY KEY,auth_user_id uuid,tenant_id uuid,role_id uuid,display_name text,status text DEFAULT 'active',is_active boolean DEFAULT true);
CREATE TABLE public.employees(id uuid PRIMARY KEY,tenant_id uuid,profile_id uuid,first_name text,last_name text,status text DEFAULT 'aktiv',deleted_at timestamptz);
CREATE TABLE public.employee_portal_accounts(id uuid PRIMARY KEY,tenant_id uuid,employee_id uuid,auth_user_id uuid,status text DEFAULT 'active',blocked_at timestamptz);
CREATE TABLE public.role_permissions(role_id uuid,tenant_id uuid,permission_key text,can_view boolean DEFAULT false,can_create boolean DEFAULT false);
CREATE TABLE public.role_permission_sets(tenant_id uuid,role_key text,permission_key text);
CREATE TABLE public.employee_permission_overrides(tenant_id uuid,employee_id uuid,permission_key text,allowed boolean,valid_from timestamptz,valid_until timestamptz);
CREATE TABLE public.employee_role_assignments(tenant_id uuid,employee_id uuid,role_template_id uuid,role_key text);
CREATE TABLE public.employee_data_scopes(tenant_id uuid,employee_id uuid,module text,scope_type text,scope_value text);
CREATE TABLE public.role_templates(id uuid PRIMARY KEY,tenant_id uuid,role_key text);
CREATE TABLE public.role_template_permissions(role_template_id uuid,permission_key text,allowed boolean);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('test.uid',true),'')::uuid $$;
CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$ SELECT coalesce(nullif(current_setting('test.jwt',true),''),'{}')::jsonb $$;
CREATE FUNCTION public.current_tenant_id() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('test.tenant',true),'')::uuid $$;
CREATE FUNCTION public.current_portal_type() RETURNS text LANGUAGE sql STABLE AS $$ SELECT nullif(auth.jwt()->'app_metadata'->>'portal_type','') $$;
CREATE FUNCTION public.current_portal_account_id() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(auth.jwt()->'app_metadata'->>'portal_account_id','')::uuid $$;
CREATE FUNCTION public.resolve_current_employee_id() RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
  SELECT employee_id FROM public.employee_portal_accounts WHERE id=public.current_portal_account_id() AND auth_user_id=auth.uid()
    AND tenant_id=public.current_tenant_id() AND status IN ('active','pending_first_login','password_reset_required')
$$;
CREATE FUNCTION public.current_role_key() RETURNS text LANGUAGE sql STABLE AS $$ SELECT auth.jwt()->'app_metadata'->>'role_key' $$;
CREATE FUNCTION public.has_permission(p_permission text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
  SELECT EXISTS(SELECT 1 FROM public.profiles p JOIN public.roles r ON r.id=p.role_id
    WHERE p.auth_user_id=auth.uid() AND p.tenant_id=public.current_tenant_id() AND p.status='active' AND p.is_active
      AND (r.is_admin_role OR EXISTS(SELECT 1 FROM public.role_permissions rp WHERE rp.role_id=r.id AND rp.permission_key=p_permission)))
$$;
