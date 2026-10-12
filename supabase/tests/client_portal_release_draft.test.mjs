// Isolated PostgreSQL validation of a review draft, not a deployed migration.
// Uses the existing PGlite dependency and synthetic rows only.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';

const require = createRequire(import.meta.url);
const { PGlite } = require('@electric-sql/pglite');
const db = new PGlite();
const draft = readFileSync(new URL('../../docs/client-portal-release-gates.sql', import.meta.url), 'utf8');
const budgetTables = ['client_budget_accounts', 'client_care_entitlement', 'client_service_entitlements', 'client_funding_selections', 'portal_budget_snapshots'];
const liveTables = ['assist_tracking_sessions', 'assist_location_points'];
const tenant = '10000000-0000-0000-0000-000000000001';
const otherTenant = '10000000-0000-0000-0000-000000000002';
const client = '20000000-0000-0000-0000-000000000001';
const otherClient = '20000000-0000-0000-0000-000000000002';
const visit = '30000000-0000-0000-0000-000000000001';
const legacy = '40000000-0000-0000-0000-000000000001';

await db.exec(`
  CREATE ROLE authenticated;
  CREATE FUNCTION public.current_tenant_id() RETURNS UUID LANGUAGE SQL AS
    'SELECT current_setting(''test.tenant'')::UUID';
  CREATE FUNCTION public.current_client_id() RETURNS UUID LANGUAGE SQL AS
    'SELECT NULLIF(current_setting(''test.client''),'''')::UUID';
  CREATE FUNCTION public.current_role_key() RETURNS TEXT LANGUAGE SQL AS
    'SELECT current_setting(''test.role'')';
  SELECT set_config('test.tenant','${tenant}',false),set_config('test.client','${client}',false),set_config('test.role','client_portal',false);
  CREATE TABLE tenant_client_portal_defaults(tenant_id UUID,portal_enabled BOOLEAN,show_budget BOOLEAN,show_appointments BOOLEAN);
  CREATE TABLE client_portal_settings(tenant_id UUID,client_id UUID,inherit_tenant_defaults BOOLEAN,portal_enabled BOOLEAN,show_budget BOOLEAN,show_appointments BOOLEAN);
  CREATE TABLE assist_visits(id UUID,tenant_id UUID,client_id UUID,legacy_assignment_id UUID,portal_release_enabled BOOLEAN,planning_status TEXT);
  CREATE TABLE assignments(id UUID,tenant_id UUID,client_id UUID,status TEXT);
  INSERT INTO tenant_client_portal_defaults VALUES('${tenant}',true,true,true),('${otherTenant}',true,true,true);
  INSERT INTO client_portal_settings VALUES('${tenant}','${client}',false,true,false,true);
  INSERT INTO assist_visits VALUES('${visit}','${tenant}','${client}','${legacy}',false,'planned');
  INSERT INTO assignments VALUES('${legacy}','${tenant}','${client}','on_the_way');
  GRANT USAGE ON SCHEMA public TO authenticated;
  GRANT SELECT ON tenant_client_portal_defaults,client_portal_settings,assist_visits,assignments TO authenticated;
`);
for (const table of budgetTables) await db.exec(`
  CREATE TABLE ${table}(id INT,tenant_id UUID,client_id UUID);
  ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY;
  CREATE POLICY existing_own_read ON ${table} FOR SELECT TO authenticated USING(tenant_id=public.current_tenant_id() AND client_id=public.current_client_id());
  CREATE POLICY existing_business_read ON ${table} FOR SELECT TO authenticated USING(tenant_id=public.current_tenant_id() AND public.current_role_key()='business_admin');
  GRANT SELECT ON ${table} TO authenticated;
  INSERT INTO ${table} VALUES(1,'${tenant}','${client}'),(2,'${tenant}','${otherClient}'),(3,'${otherTenant}','${client}');
`);
for (const table of liveTables) await db.exec(`
  CREATE TABLE ${table}(id INT,tenant_id UUID,visit_id UUID);
  ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY;
  CREATE POLICY existing_own_assignment_read ON ${table} FOR SELECT TO authenticated USING(tenant_id=public.current_tenant_id() AND visit_id IN (SELECT id FROM assignments WHERE client_id=public.current_client_id()));
  CREATE POLICY existing_business_read ON ${table} FOR SELECT TO authenticated USING(tenant_id=public.current_tenant_id() AND public.current_role_key()='business_admin');
  GRANT SELECT ON ${table} TO authenticated;
  INSERT INTO ${table} VALUES(1,'${tenant}','${visit}'),(2,'${tenant}','${legacy}'),(3,'${otherTenant}','${visit}');
`);
const ids = async (table) => (await db.query(`SELECT id FROM ${table} ORDER BY id`)).rows.map((row) => row.id);
const asClient = (role = 'client_portal') => db.exec(`RESET ROLE; SELECT set_config('test.role','${role}',false),set_config('test.client','${client}',false); SET ROLE authenticated;`);
const patchSettings = (sql) => db.exec(`RESET ROLE; UPDATE client_portal_settings SET ${sql} WHERE tenant_id='${tenant}' AND client_id='${client}'; SET ROLE authenticated;`);
const patchVisit = (sql) => db.exec(`RESET ROLE; UPDATE assist_visits SET ${sql}; SET ROLE authenticated;`);

await test('reproduces budget/GPS reads before the review draft despite missing releases', async () => {
  await asClient();
  assert.deepEqual(await ids('client_budget_accounts'), [1]);
  assert.deepEqual(await ids('assist_location_points'), [2]);
});
await test('draft applies twice without changing personal rows', async () => {
  await db.exec('RESET ROLE;');
  const before = (await db.query('SELECT * FROM client_budget_accounts ORDER BY id')).rows;
  await db.exec(draft); await db.exec(draft);
  assert.deepEqual((await db.query('SELECT * FROM client_budget_accounts ORDER BY id')).rows, before);
  await asClient();
});
await test('all budget foundations stay hidden when showBudget is false', async () => {
  for (const table of budgetTables) assert.deepEqual(await ids(table), []);
});
await test('positive own-client release exposes only the correct tenant/client', async () => {
  await patchSettings('show_budget=true');
  for (const table of budgetTables) assert.deepEqual(await ids(table), [1]);
});
await test('disabled portal blocks budget even if the feature flag is true', async () => {
  await patchSettings('portal_enabled=false');
  for (const table of budgetTables) assert.deepEqual(await ids(table), []);
  await patchSettings('portal_enabled=true');
});
await test('family portal follows the same release boundaries', async () => {
  await asClient('family_portal'); await patchSettings('show_budget=false');
  assert.deepEqual(await ids('client_budget_accounts'), []);
  await patchSettings('show_budget=true');
  assert.deepEqual(await ids('client_budget_accounts'), [1]);
  await asClient();
});
await test('inherited settings use tenant defaults, explicit client overrides take precedence', async () => {
  await patchSettings('inherit_tenant_defaults=true,show_budget=false');
  assert.deepEqual(await ids('client_budget_accounts'), [1]);
  await patchSettings('inherit_tenant_defaults=false');
  assert.deepEqual(await ids('client_budget_accounts'), []);
});
await test('missing defaults fail closed', async () => {
  await db.exec(`RESET ROLE; DELETE FROM tenant_client_portal_defaults WHERE tenant_id='${tenant}'; SET ROLE authenticated;`);
  assert.deepEqual(await ids('client_budget_accounts'), []);
  await db.exec(`RESET ROLE; INSERT INTO tenant_client_portal_defaults VALUES('${tenant}',true,true,true); SET ROLE authenticated;`);
});
await test('GPS stays hidden until the canonical visit is positively released', async () => {
  for (const table of liveTables) assert.deepEqual(await ids(table), []);
  await patchVisit('portal_release_enabled=true');
  for (const table of liveTables) assert.deepEqual(await ids(table), [1, 2]);
});
await test('GPS follows appointments and portal releases', async () => {
  for (const patch of ['show_appointments=false', 'show_appointments=true,portal_enabled=false']) {
    await patchSettings(patch);
    for (const table of liveTables) assert.deepEqual(await ids(table), []);
  }
  await patchSettings('show_appointments=true,portal_enabled=true');
});
await test('released GPS cannot be read for a different client in the same tenant', async () => {
  await patchVisit(`client_id='${otherClient}'`);
  for (const table of liveTables) assert.deepEqual(await ids(table), []);
  await patchVisit(`client_id='${client}'`);
});
await test('GPS is unavailable for draft, unknown-release and completed visits', async () => {
  for (const patch of ["planning_status='draft'", "planning_status='planned',portal_release_enabled=null"]) {
    await patchVisit(patch);
    assert.deepEqual(await ids('assist_location_points'), []);
  }
  await patchVisit('portal_release_enabled=true');
  await db.exec("RESET ROLE; UPDATE assignments SET status='completed'; SET ROLE authenticated;");
  assert.deepEqual(await ids('assist_location_points'), []);
});
await test('existing business tenant access remains unchanged', async () => {
  await db.exec("RESET ROLE; SELECT set_config('test.role','business_admin',false),set_config('test.client','',false); SET ROLE authenticated;");
  for (const table of [...budgetTables, ...liveTables]) assert.deepEqual(await ids(table), [1, 2]);
});
await db.close();
