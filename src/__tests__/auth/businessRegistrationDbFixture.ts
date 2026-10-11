// Synthetic PostgreSQL schema; no production rows or network access.
export const BUSINESS_REGISTRATION_DB_FIXTURE = `
CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY,email text, raw_user_meta_data jsonb DEFAULT '{}');
CREATE TYPE public.product_key AS ENUM ('office','assist','pflege','beratung','akademie','stationaer');
CREATE TABLE tenants(id uuid PRIMARY KEY,name text,legal_name text,slug text,legal_form text,industry text,street text,postal_code text,city text,phone text,email text,website text,ik_number text,tax_number text,vat_id text,status text,billing_email text,representative_name text);
CREATE TABLE roles(id uuid DEFAULT gen_random_uuid() PRIMARY KEY,tenant_id uuid,created_at timestamptz DEFAULT now(),key text,name text,is_admin_role boolean,can_manage_tenant boolean,can_manage_users boolean,can_manage_roles boolean,can_manage_products boolean,can_manage_clients boolean,can_manage_employees boolean,can_manage_assignments boolean,can_manage_documentation boolean,can_manage_service_records boolean,can_manage_signatures boolean,can_manage_documents boolean,can_manage_messages boolean,can_manage_billing boolean,can_view_reports boolean,can_view_audit_logs boolean,can_manage_support boolean,can_use_ai_assistant boolean,allowed_products product_key[]);
CREATE TABLE profiles(id uuid DEFAULT gen_random_uuid() PRIMARY KEY,auth_user_id uuid UNIQUE,tenant_id uuid,role_id uuid,first_name text,last_name text,email text,phone text,status text,is_active boolean,activated_at timestamptz,terms_accepted_at timestamptz,privacy_accepted_at timestamptz,updated_at timestamptz);
CREATE TABLE tenant_users(id uuid DEFAULT gen_random_uuid() PRIMARY KEY,tenant_id uuid,auth_user_id uuid,display_name text,first_name text,last_name text,email text,username text,role_key text,status text,must_change_password boolean,first_login_completed boolean,last_password_change_at timestamptz);
CREATE TABLE products(id uuid DEFAULT gen_random_uuid(),product_key product_key,is_active boolean,sort_order integer);
INSERT INTO products(product_key,is_active,sort_order) VALUES('office',true,0),('assist',true,1),('pflege',true,2),('beratung',true,3),('akademie',true,4),('stationaer',true,5);
CREATE TABLE tenant_addresses(tenant_id uuid,street text,zip text,city text);
CREATE TABLE tenant_contacts(tenant_id uuid,first_name text,last_name text,role text,email text,phone text,is_primary boolean);
CREATE TABLE tenant_products(tenant_id uuid,product_id uuid,product_key product_key,status text,is_active boolean,activated_at timestamptz,access_source text,access_type text,billing_status text,price_cents integer,monthly_price integer,premium_ready boolean,is_default boolean,is_visible_in_switcher boolean);
CREATE TABLE tenant_subscriptions(tenant_id uuid,status text,billing_email text,metadata jsonb);
CREATE TABLE platform_tenants(tenant_id uuid UNIQUE,tenant_name text,legal_name text,slug text,status text,lifecycle_status text,billing_status text,plan_key text,industry_type text,primary_contact_name text,primary_contact_email text,primary_contact_phone text,activated_at timestamptz,trial_starts_at timestamptz,trial_ends_at timestamptz,updated_at timestamptz);
CREATE TABLE tenant_environment_settings(tenant_id uuid UNIQUE,mode text,is_pilot_tenant boolean,provider_sandbox_only boolean,notes text);
CREATE TABLE platform_modules(module_key text,status text); INSERT INTO platform_modules VALUES('office','available'),('assist','available'),('pflege','available'),('beratung','available'),('akademie','available'),('stationaer','available'),('hidden','retired');
CREATE TABLE platform_tenant_modules(tenant_id uuid,module_key text,status text,is_trial boolean,enabled_at timestamptz,trial_ends_at timestamptz,UNIQUE(tenant_id,module_key));
`;
