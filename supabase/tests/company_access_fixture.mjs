import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';

export const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const migrationFiles = {
  "company_access": "20261015085833_company_access.sql",
  "company_organization": "20261015085834_company_organization.sql",
  "company_scope_access": "20261015085835_company_scope_access.sql",
  "company_resources": "20261015085836_company_resources.sql",
  "company_inventory_scope": "20261015085837_company_inventory_scope.sql",
  "company_custom_values": "20261015085838_company_custom_values.sql",
  "company_cost_centers": "20261015085839_company_cost_centers.sql"
};
export const companyMigration = name => readFileSync(new URL(`../migrations/${migrationFiles[name]}`, import.meta.url), 'utf8');

/** Isolated Postgres execution with synthetic tenants; never contacts Supabase. */
export async function companyFixture({ resources = false } = {}) {
  const db = new PGlite();
  await db.exec(`
    CREATE ROLE authenticated; CREATE ROLE anon; CREATE ROLE service_role BYPASSRLS;
    CREATE SCHEMA auth;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS 'SELECT nullif(current_setting(''fixture.uid'',true),'''')::uuid';
    CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql AS 'SELECT coalesce(nullif(current_setting(''fixture.jwt'',true),''''),''{}'')::jsonb';
    CREATE FUNCTION public.current_tenant_id() RETURNS uuid LANGUAGE sql AS 'SELECT nullif(current_setting(''fixture.tenant'',true),'''')::uuid';
    CREATE TABLE tenants(id uuid PRIMARY KEY);
    CREATE TABLE roles(id uuid PRIMARY KEY,key text,tenant_id uuid,is_admin_role boolean DEFAULT false,can_manage_roles boolean DEFAULT false);
    CREATE TABLE profiles(id uuid PRIMARY KEY,auth_user_id uuid,tenant_id uuid,role_id uuid,status text,is_active boolean,display_name text,first_name text,last_name text);
    CREATE TABLE employees(id uuid PRIMARY KEY,tenant_id uuid,profile_id uuid,first_name text,last_name text,status text,deleted_at timestamptz);
    CREATE TABLE role_permissions(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),role_id uuid,tenant_id uuid,permission_key text,can_view boolean DEFAULT true);
    CREATE TABLE role_permission_sets(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid,role_key text,permission_key text);
    CREATE TABLE role_templates(id uuid PRIMARY KEY,tenant_id uuid,role_key text,name text);
    CREATE TABLE role_template_permissions(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),role_template_id uuid,permission_key text,allowed boolean);
    CREATE TABLE employee_role_assignments(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid,employee_id uuid,role_template_id uuid,role_key text);
    CREATE TABLE employee_permission_overrides(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid,employee_id uuid,permission_key text,allowed boolean,valid_from timestamptz,valid_until timestamptz);
    CREATE TABLE employee_data_scopes(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid,employee_id uuid,module text,scope_type text,scope_value text);
    CREATE TABLE tenant_cost_centers(id uuid PRIMARY KEY,tenant_id uuid,name text,label text,code text,is_active boolean);
    CREATE TABLE inventory_categories(id uuid PRIMARY KEY,tenant_id uuid,group_key text,label text);
    CREATE TABLE inventory_locations(id uuid PRIMARY KEY,tenant_id uuid,label text);
    CREATE TABLE inventory_items(id uuid PRIMARY KEY,tenant_id uuid,category_id uuid,location_id uuid,name text,status text);
    CREATE TABLE inventory_assignments(id uuid PRIMARY KEY,tenant_id uuid,item_id uuid,recipient_employee_id uuid,responsible_employee_id uuid,status text);
    CREATE TABLE inventory_return_records(id uuid PRIMARY KEY,tenant_id uuid,item_id uuid,assignment_id uuid,employee_id uuid);
    CREATE TABLE inventory_damage_reports(id uuid PRIMARY KEY,tenant_id uuid,item_id uuid,assignment_id uuid,employee_id uuid);
    CREATE TABLE inventory_return_protocols(id uuid PRIMARY KEY,tenant_id uuid,employee_id uuid,assignment_ids uuid[]);
    CREATE TABLE inventory_audit_events(id uuid PRIMARY KEY,tenant_id uuid,entity_type text,entity_id uuid,actor_profile_id uuid);
    CREATE TABLE device_management_profiles(id uuid PRIMARY KEY,tenant_id uuid,item_id uuid);
    CREATE TABLE central_document_records(id uuid PRIMARY KEY,tenant_id uuid,target text,entity_id uuid,snapshot_json jsonb,revision integer,state text,created_at timestamptz,title text);
    CREATE TABLE employee_logbook_vehicles(id uuid PRIMARY KEY,tenant_id uuid,employee_id uuid,plate text,make text,model text,ownership text,active boolean,updated_at timestamptz);
    GRANT USAGE ON SCHEMA auth TO authenticated,anon; GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA auth TO authenticated,anon;
    GRANT SELECT ON ALL TABLES IN SCHEMA public TO authenticated;
  `);
  for (const table of ['employees','employee_role_assignments','employee_permission_overrides','employee_data_scopes','role_permission_sets','role_templates','role_template_permissions']) {
    await db.exec(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY; GRANT INSERT,UPDATE,DELETE ON ${table} TO authenticated; CREATE POLICY old_tenant_policy ON ${table} TO authenticated USING(true) WITH CHECK(true)`);
  }
  for (const table of ['inventory_items','inventory_categories','inventory_locations','inventory_assignments','inventory_return_records','inventory_damage_reports','inventory_return_protocols','inventory_audit_events','device_management_profiles']) {
    await db.exec(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY; GRANT SELECT,INSERT,UPDATE,DELETE ON ${table} TO authenticated; CREATE POLICY old_inventory_tenant ON ${table} TO authenticated USING(tenant_id=public.current_tenant_id()) WITH CHECK(tenant_id=public.current_tenant_id())`);
  }
  await db.query('INSERT INTO tenants VALUES($1),($2)', [id(10), id(11)]);
  for (const [n,key,admin] of [[1,'business_admin',true],[2,'business_manager',false],[3,'employee_portal',false],[4,'billing',false]]) await db.query('INSERT INTO roles(id,key,is_admin_role) VALUES($1,$2,$3)',[id(n),key,admin]);
  for (const [n,r,t] of [[20,1,10],[21,2,10],[22,3,10],[23,4,10],[24,1,11]]) await db.query("INSERT INTO profiles(id,auth_user_id,tenant_id,role_id,status,is_active,display_name) VALUES($1,$2,$3,$4,'active',true,$5)",[id(n),id(n+100),id(t),id(r),`Synthetic ${n}`]);
  for (const [n,p] of [[40,21],[41,22],[42,23]]) await db.query("INSERT INTO employees(id,tenant_id,profile_id,first_name,last_name,status) VALUES($1,$2,$3,'Synthetic',$4,'active')",[id(n),id(10),id(p),`${n}`]);
  for (const r of [2,3]) for (const permission of ['business.tenant.manage','office.employees.view','inventory.view','inventory.manage_items','inventory.issue','inventory.return_manage','inventory.report_damage','inventory.audit_view','inventory.offboarding']) await db.query('INSERT INTO role_permissions(role_id,permission_key) VALUES($1,$2)',[id(r),permission]);
  await db.query("INSERT INTO role_permissions(role_id,permission_key) VALUES($1,'office.employees.view')",[id(4)]);
  await db.exec(companyMigration('company_access'));
  await db.exec(companyMigration('company_organization'));
  await db.exec(companyMigration('company_scope_access'));
  if (resources) { await db.exec(companyMigration('company_resources')); await db.exec(companyMigration('company_inventory_scope')); }
  async function actor(profile = 20, tenant = 10, claims = {}) {
    await db.exec('RESET ROLE');
    await db.query("SELECT set_config('fixture.uid',$1,false),set_config('fixture.tenant',$2,false),set_config('fixture.jwt',$3,false)",[profile == null ? '' : id(profile+100),id(tenant),JSON.stringify(claims)]);
    await db.exec(profile == null ? 'SET ROLE anon' : 'SET ROLE authenticated');
  }
  async function owner() { await db.exec('RESET ROLE'); await db.query("SELECT set_config('fixture.uid','',false),set_config('fixture.jwt','{}',false)"); }
  async function permission(permission = 'business.tenant.manage', tenant = 10) { return (await db.query('SELECT care_security.company_actor($1,$2) AS ok',[id(tenant),permission])).rows[0].ok; }
  async function organization(kind,data,recordId=null,version=null) { return (await db.query('SELECT public.company_organization_save($1,$2,$3,$4,$5) AS result',[id(10),kind,recordId,version,JSON.stringify(data)])).rows[0].result; }
  async function scope(profile,grants,version=0,limited=true) { return (await db.query('SELECT public.company_scope_save($1,$2,$3,$4,$5) AS result',[id(10),id(profile),limited,JSON.stringify(grants),version])).rows[0].result; }
  async function access() { return (await db.query('SELECT public.company_access_permissions($1) AS result',[id(10)])).rows[0].result; }
  await actor();
  const entityA=await organization('entity',{name:'Alpha'});
  const entityB=await organization('entity',{name:'Beta'});
  const siteA=await organization('site',{name:'Alpha Site',kind:'branch',entity_id:entityA.id});
  const siteB=await organization('site',{name:'Beta Site',kind:'branch',entity_id:entityB.id});
  const department=await organization('department',{name:'Alpha Team',entity_id:entityA.id,site_id:siteA.id});
  return {db,actor,owner,permission,organization,scope,access,entityA,entityB,siteA,siteB,department};
}
