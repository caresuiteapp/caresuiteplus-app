// Real captured functions and local SQL draft, isolated synthetic PostgreSQL.
// No remote calls, Auth account creation or customer identities.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';
const require = createRequire(import.meta.url);
const { PGlite } = require('@electric-sql/pglite');
const db = new PGlite();
const metadata = JSON.parse(readFileSync(new URL('../../docs/workflow-server-write-rpc-metadata-20261011.json', import.meta.url), 'utf8'));
const draft = readFileSync(new URL('../../docs/workflow-server-legacy-rpc-draft.sql', import.meta.url), 'utf8');
const tenant = '10000000-0000-0000-0000-000000000001';
const other = '10000000-0000-0000-0000-000000000002';
const user = '20000000-0000-0000-0000-000000000001';
const employee = '30000000-0000-0000-0000-000000000001';
const foreignEmployee = '30000000-0000-0000-0000-000000000002';
const client = '40000000-0000-0000-0000-000000000001';
const foreignClient = '40000000-0000-0000-0000-000000000002';
const signatures = [
  'create_access_code_for_employee(uuid,uuid,integer)',
  'create_access_code_for_client(uuid,uuid,integer)',
  'seed_tenant_assist_service_catalog(uuid)',
  'backfill_client_care_entitlement_from_legacy(uuid)',
];
const seededTables = [
  'access_codes', 'tenant_service_catalog', 'tenant_service_prices',
  'client_care_entitlement', 'tenant_client_service_types', 'tenant_service_intake_sections',
  'tenant_client_portal_defaults', 'tenant_budget_years', 'tenant_budget_types',
  'tenant_budget_defaults', 'tenant_service_type_budget_rules',
];
await db.exec(`
CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
 'SELECT nullif(current_setting(''fixture.uid'',true),'''')::uuid';
CREATE FUNCTION current_tenant_id() RETURNS uuid LANGUAGE sql STABLE AS
 'SELECT nullif(current_setting(''fixture.tenant'',true),'''')::uuid';
CREATE FUNCTION current_portal_type() RETURNS text LANGUAGE sql STABLE AS
 'SELECT nullif(current_setting(''fixture.portal'',true),'''')';
CREATE FUNCTION current_profile_id() RETURNS uuid LANGUAGE sql STABLE AS 'SELECT auth.uid()';
CREATE FUNCTION has_permission(permission text) RETURNS boolean LANGUAGE sql STABLE AS
 'SELECT coalesce(current_setting(''fixture.'' || permission,true) = ''true'',false)';
CREATE FUNCTION is_tenant_admin() RETURNS boolean LANGUAGE sql STABLE AS
 'SELECT coalesce(current_setting(''fixture.admin'',true) = ''true'',false)';
CREATE SEQUENCE code_sequence START 100000;
CREATE FUNCTION generate_six_digit_code() RETURNS text LANGUAGE sql AS
 'SELECT nextval(''code_sequence'')::text';
CREATE TABLE employees(id uuid PRIMARY KEY,tenant_id uuid);
CREATE TABLE clients(id uuid PRIMARY KEY,tenant_id uuid,care_level text);
CREATE TABLE access_codes(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid,code text,
 code_type text,employee_id uuid REFERENCES employees(id),client_id uuid REFERENCES clients(id),
 status text,valid_until timestamptz,created_by uuid);
CREATE TABLE tenant_billing_settings(tenant_id uuid,default_hourly_rate numeric);
CREATE TABLE tenant_service_catalog(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid,
 module_key text,service_key text,name text,description text,unit text,category text,sort_order integer,
 UNIQUE(tenant_id,service_key));
CREATE TABLE tenant_service_prices(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid,
 catalog_id uuid,price_net numeric,tax_rate numeric,tax_mode text,valid_from date,is_default boolean);
CREATE TABLE client_care_levels(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid,client_id uuid,
 grade text,valid_from date,created_at timestamptz DEFAULT now(),care_fund_name text,
 care_fund_member_id text,md_assessment_date date);
CREATE TABLE client_care_entitlement(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid,
 client_id uuid,care_grade text,valid_from date,valid_until date,conversion_enabled boolean,
 care_fund_name text,care_fund_member_id text,md_assessment_date date,source text,metadata jsonb,
 updated_at timestamptz DEFAULT now());
CREATE TABLE tenant_client_service_types(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid,
 service_type_key text,care_context_key text,name text,description text,module_keys text[],
 is_system_template boolean,sort_order integer,UNIQUE(tenant_id,service_type_key));
CREATE TABLE tenant_service_intake_sections(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid,
 service_type_id uuid,section_key text,is_required boolean,is_visible boolean,sort_order integer,
 UNIQUE(tenant_id,service_type_id,section_key));
CREATE TABLE tenant_client_portal_defaults(tenant_id uuid PRIMARY KEY,portal_enabled boolean,
 show_appointments boolean,show_messages boolean,show_documents boolean,show_proofs boolean,
 show_budget boolean,show_visit_tracking boolean,allow_access_requests boolean);
CREATE TABLE tenant_budget_years(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid,
 budget_year integer,label text,is_active boolean,UNIQUE(tenant_id,budget_year));
CREATE TABLE tenant_budget_types(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid,
 budget_type_key text,name text,description text,period text,sort_order integer,
 UNIQUE(tenant_id,budget_type_key));
CREATE TABLE tenant_budget_defaults(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid,
 budget_year_id uuid,budget_type_id uuid,amount_cents integer,conversion_rate_pct numeric,
 monthly_amount_cents integer,yearly_amount_cents integer,notes text,
 UNIQUE(tenant_id,budget_year_id,budget_type_id));
CREATE TABLE tenant_service_type_budget_rules(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid,
 service_type_id uuid,budget_type_id uuid,is_default boolean,
 UNIQUE(tenant_id,service_type_id,budget_type_id));
GRANT USAGE ON SCHEMA public,auth TO anon,authenticated,service_role;
`);
for (const table of seededTables) {
  await db.exec(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY; GRANT SELECT,INSERT,UPDATE,DELETE ON ${table} TO authenticated;`);
}
for (const [id,scope] of [[employee,tenant],[foreignEmployee,other]]) {
  await db.query('INSERT INTO employees VALUES($1,$2)', [id,scope]);
}
for (const [id,scope] of [[client,tenant],[foreignClient,other]]) {
  await db.query("INSERT INTO clients VALUES($1,$2,'pg2')", [id,scope]);
}
for (const name of [...signatures.map(signature => signature.split('(')[0]), 'seed_tenant_client_core_templates']) {
  const captured = metadata.functions.find(f => f.name === name);
  assert.ok(captured, 'captured metadata must include ' + name);
  await db.exec(captured.definition);
  // Captured effective EXECUTE grants; freshly-created PostgreSQL functions
  // otherwise default to PUBLIC execution and obscure this distinction.
  const signature = signatures.find(s => s.startsWith(name + '(')) ?? name + '(uuid)';
  await db.exec(`REVOKE EXECUTE ON FUNCTION ${signature} FROM PUBLIC; GRANT EXECUTE ON FUNCTION ${signature} TO service_role;`);
  if (captured.auth) await db.exec(`GRANT EXECUTE ON FUNCTION ${signature} TO authenticated;`);
  if (captured.anon) await db.exec(`GRANT EXECUTE ON FUNCTION ${signature} TO anon;`);
}
async function actor({role = 'authenticated',uid = user,scope = tenant,portal = 'business',view = true,edit = false,admin = false} = {}) {
  await db.exec('RESET ROLE');
  await db.query(`SELECT set_config('fixture.uid',$1,false),set_config('fixture.tenant',$2,false),
    set_config('fixture.portal',$3,false),set_config('fixture.office.clients.view',$4,false),
    set_config('fixture.office.clients.edit',$5,false),set_config('fixture.admin',$6,false)`,
  [uid ?? '',scope ?? '',portal ?? '',String(view),String(edit),String(admin)]);
  await db.exec('SET ROLE ' + role);
}
async function snapshot() {
  await db.exec('RESET ROLE');
  const result = {};
  for (const table of seededTables) result[table] = (await db.query(`SELECT * FROM ${table} ORDER BY id` .replace('tenant_client_portal_defaults ORDER BY id','tenant_client_portal_defaults ORDER BY tenant_id'))).rows;
  return result;
}
async function clearSeeded() {
  await db.exec('RESET ROLE');
  for (const table of seededTables) await db.exec('TRUNCATE ' + table);
}
await test('captured access-code writers allow foreign tenant and mismatched target despite table RLS', async () => {
  await actor({portal:'employee',view:false});
  await db.query('SELECT create_access_code_for_employee($1,$2,365)', [other,foreignEmployee]);
  await db.query('SELECT create_access_code_for_employee($1,$2,365)', [tenant,foreignEmployee]);
  await db.query('SELECT create_access_code_for_client($1,$2,365)', [other,foreignClient]);
  await db.query('SELECT create_access_code_for_client($1,$2,365)', [tenant,foreignClient]);
  await db.exec('RESET ROLE');
  const rows = (await db.query('SELECT tenant_id,employee_id,client_id FROM access_codes ORDER BY code')).rows;
  assert.equal(rows.length,4);
  assert.equal(rows[0].tenant_id,other);
  assert.equal(rows[1].employee_id,foreignEmployee);
  assert.equal(rows[1].tenant_id,tenant);
  assert.equal(rows[2].client_id,foreignClient);
});
await test('captured anonymous seed and backfill writers mutate arbitrary tenants', async () => {
  await actor({role:'anon',uid:null,scope:null,view:false});
  await db.query('SELECT seed_tenant_assist_service_catalog($1)', [other]);
  await db.query('SELECT seed_tenant_client_core_templates($1)', [other]);
  const backfill = (await db.query('SELECT * FROM backfill_client_care_entitlement_from_legacy(NULL)')).rows;
  assert.equal(backfill.length,2);
  await db.exec('RESET ROLE');
  assert.equal((await db.query('SELECT count(*)::int AS count FROM tenant_service_catalog WHERE tenant_id=$1',[other])).rows[0].count,6);
  assert.equal((await db.query('SELECT count(*)::int AS count FROM tenant_client_service_types WHERE tenant_id=$1',[other])).rows[0].count,6);
  await clearSeeded();
});
await test('local draft applies twice without altering any existing business rows', async () => {
  const before = await snapshot();
  await db.exec(draft); await db.exec(draft);
  assert.deepEqual(await snapshot(),before);
});
const calls = [
  ['SELECT create_access_code_for_employee($1,$2,365)',[other,foreignEmployee]],
  ['SELECT create_access_code_for_client($1,$2,365)',[other,foreignClient]],
  ['SELECT seed_tenant_assist_service_catalog($1)',[other]],
  ['SELECT * FROM backfill_client_care_entitlement_from_legacy(NULL)',[]],
];
for (const role of ['anon','authenticated']) {
  for (let i = 0; i < calls.length; i++) {
    await test(role + ' cannot execute unused legacy writer ' + signatures[i], async () => {
      const before = await snapshot();
      await actor({role});
      await assert.rejects(db.query(...calls[i]),/permission denied/i);
      assert.deepEqual(await snapshot(),before);
    });
  }
}
await test('PUBLIC and anonymous rights are absent; service-role rights are retained', async () => {
  await db.exec('RESET ROLE');
  for (const signature of signatures) {
    const [row] = (await db.query(`SELECT has_function_privilege('anon',$1,'EXECUTE') AS anon,
      has_function_privilege('authenticated',$1,'EXECUTE') AS authenticated,
      has_function_privilege('service_role',$1,'EXECUTE') AS service`,[signature])).rows;
    assert.deepEqual(row,{anon:false,authenticated:false,service:true});
  }
  await actor({role:'anon',uid:null});
  await assert.rejects(db.query('SELECT seed_tenant_client_core_templates($1)',[tenant]),/permission denied/i);
});
for (const [label,options] of [
  ['missing Auth identity',{uid:null}],
  ['missing input tenant',{}],
  ['foreign tenant',{}],
  ['no tenant membership',{scope:null}],
  ['employee portal',{portal:'employee'}],
  ['client portal',{portal:'client'}],
  ['relative portal',{portal:'relative'}],
  ['unknown portal role',{portal:'unexpected'}],
  ['missing clients permission',{view:false}],
]) {
  await test('core template initialization rejects ' + label + ' without side effects', async () => {
    const before = await snapshot();
    await actor(options);
    const target = label === 'missing input tenant' ? null : label === 'foreign tenant' ? other : tenant;
    await assert.rejects(db.query('SELECT seed_tenant_client_core_templates($1)',[target]),/authorized business actor|42501/i);
    assert.deepEqual(await snapshot(),before);
  });
}
for (const [label,options] of [
  ['same-tenant business reader',{view:true}],
  ['same-tenant business editor',{view:false,edit:true}],
  ['same-tenant tenant administrator',{view:false,admin:true}],
  ['same-tenant legacy business reader',{portal:null,view:true}],
]) {
  await test('core template initialization preserves ' + label, async () => {
    await clearSeeded();
    await actor(options);
    await db.query('SELECT seed_tenant_client_core_templates($1)',[tenant]);
    const state = await snapshot();
    assert.equal(state.tenant_client_service_types.length,6);
    assert.equal(state.tenant_service_intake_sections.length,60);
    assert.equal(state.tenant_budget_types.length,2);
    assert.equal(state.tenant_service_type_budget_rules.length,3);
    assert.ok(Object.values(state).flat().every(row => row.tenant_id === tenant));
    assert.equal(state.tenant_client_portal_defaults[0].portal_enabled,false);
  });
}
await test('authenticated repeated seeding preserves existing names, budgets and portal settings', async () => {
  await db.exec('RESET ROLE');
  await db.query("UPDATE tenant_client_service_types SET name='Custom name' WHERE tenant_id=$1 AND service_type_key='betreuung'",[tenant]);
  await db.query('UPDATE tenant_budget_defaults SET monthly_amount_cents=12345 WHERE tenant_id=$1',[tenant]);
  await db.query('UPDATE tenant_client_portal_defaults SET show_documents=true WHERE tenant_id=$1',[tenant]);
  const before = await snapshot();
  await actor();
  await db.query('SELECT seed_tenant_client_core_templates($1)',[tenant]);
  assert.deepEqual(await snapshot(),before);
});
await test('trusted service role retains all five maintenance functions without an end-user session', async () => {
  await clearSeeded();
  await actor({role:'service_role',uid:null,scope:null,portal:null,view:false});
  await db.query('SELECT create_access_code_for_employee($1,$2,365)',[other,foreignEmployee]);
  await db.query('SELECT create_access_code_for_client($1,$2,365)',[other,foreignClient]);
  await db.query('SELECT seed_tenant_assist_service_catalog($1)',[other]);
  await db.query('SELECT seed_tenant_client_core_templates($1)',[other]);
  assert.equal((await db.query('SELECT * FROM backfill_client_care_entitlement_from_legacy($1)',[other])).rows.length,1);
  const state = await snapshot();
  assert.equal(state.access_codes.length,2);
  assert.equal(state.tenant_client_service_types.length,6);
  assert.equal(state.tenant_service_catalog.length,6);
  assert.equal(state.client_care_entitlement.length,1);
  assert.ok(Object.values(state).flat().every(row => row.tenant_id === other));
});
await db.close();
