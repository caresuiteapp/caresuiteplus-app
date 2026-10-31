import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { companyFixture, id } from './company_access_fixture.mjs';

const workspaceMigration = readFileSync(new URL('../migrations/20261019202713_consultation_workspace.sql', import.meta.url), 'utf8');
// Before rollout the reviewed SQL is a fix; afterwards its server-assigned
// migration filename is authoritative. Both paths run exactly the same SQL.
const recordedMigration = readdirSync(new URL('../migrations/', import.meta.url))
  .find(name => name.endsWith('_consultation_legacy_access.sql'));
const repair = readFileSync(new URL(recordedMigration
  ? `../migrations/${recordedMigration}` : '../fixes/consultation_legacy_access.sql', import.meta.url), 'utf8');

async function fixture() {
  const f = await companyFixture();
  await f.owner();
  await f.db.exec(`
    ALTER TABLE role_permissions ADD COLUMN can_create boolean DEFAULT false,
      ADD COLUMN can_approve boolean DEFAULT false,
      ADD COLUMN restrictions jsonb DEFAULT '{}', ADD COLUMN product_key text;
    ALTER TABLE role_permissions ADD UNIQUE(role_id, permission_key);
    CREATE TABLE products(id uuid PRIMARY KEY, product_key text, is_active boolean DEFAULT true);
    CREATE TABLE tenant_products(tenant_id uuid PRIMARY KEY REFERENCES tenants(id), product_id uuid REFERENCES products(id),
      product_key text, status text DEFAULT 'active', is_active boolean DEFAULT true,
      starts_at timestamptz, ends_at timestamptz, trial_ends_at timestamptz,
      billing_status text DEFAULT 'free_active', access_source text DEFAULT 'free_active');
    CREATE TABLE platform_modules(module_key text PRIMARY KEY, status text);
    CREATE TABLE platform_tenant_modules(tenant_id uuid REFERENCES tenants(id), module_key text REFERENCES platform_modules(module_key),
      status text, enabled_at timestamptz, starts_at timestamptz, ends_at timestamptz,
      is_trial boolean DEFAULT false, trial_ends_at timestamptz, manual_override boolean DEFAULT false,
      PRIMARY KEY(tenant_id,module_key));
    CREATE TABLE clients(id uuid PRIMARY KEY,tenant_id uuid,full_name text,first_name text,last_name text,street text,
      house_number text,postal_code text,city text,mobile text,phone text,care_level text,insurance_name text,
      insurance_number text,access_notes text,visible_notes_for_employee text,deleted_at timestamptz);
    CREATE TABLE employee_portal_accounts(id uuid PRIMARY KEY,tenant_id uuid,employee_id uuid,auth_user_id uuid,status text);
    CREATE FUNCTION public.current_role_key() RETURNS text LANGUAGE sql AS 'SELECT auth.jwt()->''app_metadata''->>''role_key''';
    CREATE FUNCTION public.current_portal_account_id() RETURNS uuid LANGUAGE sql AS 'SELECT (auth.jwt()->''app_metadata''->>''portal_account_id'')::uuid';
    CREATE FUNCTION public.tenant_has_platform_module(p_module text,p_tenant uuid) RETURNS boolean
      LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $body$
      DECLARE m public.platform_tenant_modules%ROWTYPE;
      BEGIN
        IF auth.uid() IS NULL OR p_tenant IS DISTINCT FROM public.current_tenant_id() THEN RETURN false; END IF;
        SELECT * INTO m FROM public.platform_tenant_modules WHERE tenant_id=p_tenant AND module_key=p_module;
        IF NOT FOUND THEN RETURN NULL; END IF;
        RETURN m.status IN ('enabled','beta_enabled','trial')
          AND (m.starts_at IS NULL OR m.starts_at<=now()) AND (m.ends_at IS NULL OR m.ends_at>now())
          AND (NOT m.is_trial OR m.trial_ends_at IS NULL OR m.trial_ends_at>now());
      END $body$;
    INSERT INTO platform_modules VALUES('consulting','available');
  `);
  await f.db.query("INSERT INTO products(id,product_key) VALUES($1,'beratung')", [id(90)]);
  await f.db.exec(workspaceMigration);
  const load = async (employee = false, tenant = id(10)) =>
    (await f.db.query('SELECT consultation_workspace_load($1,$2,NULL) AS value', [tenant, employee])).rows[0].value;
  const grants = async role => (await f.db.query(
    "SELECT permission_key FROM role_permissions WHERE role_id=$1 AND permission_key LIKE 'beratung.%' ORDER BY permission_key", [id(role)],
  )).rows.map(row => row.permission_key);
  return { ...f, load, grants };
}

test('legacy consultation owner: reproduce denial, migrate existing grants, retain deny and tenant boundaries', async () => {
  const f = await fixture();
  const { db, owner, actor, load, grants } = f;
  try {
    await db.query("UPDATE roles SET key='owner',tenant_id=$1 WHERE id=$2", [id(10), id(1)]);
    await db.query("INSERT INTO role_permissions(role_id,tenant_id,permission_key,can_view,can_create,can_update,can_approve) VALUES($1,$2,'beratung',true,true,true,true),($1,$2,'office.clients.view_sensitive',true,false,false,false)", [id(1), id(10)]);
    // Active free licenses can carry an old trial timestamp; only actual trials expire by it.
    await db.query("INSERT INTO tenant_products(tenant_id,product_id,product_key,trial_ends_at) VALUES($1,$2,'beratung',now()-interval '1 day')", [id(10), id(90)]);
    await actor();
    await assert.rejects(load(), error => error.code === '42501');
    await owner();
    await db.exec(repair);
    assert.deepEqual(await grants(1), ['beratung.access', 'beratung.cases.manage', 'beratung.cases.review', 'beratung.cases.view', 'beratung.qualifications.manage']);
    await actor();
    const state = await load();
    assert.equal(state.canManage, true);
    assert.equal(state.canReview, true);
    assert.equal(state.canQualify, true);
    assert.deepEqual(state.cases, []);
    await assert.rejects(load(false, id(11)), error => error.code === '42501');
    await assert.rejects(db.query('SELECT * FROM consultation_workspaces'), error => error.code === '42501');

    await owner();
    const before = await db.query('SELECT * FROM platform_tenant_modules ORDER BY tenant_id');
    await db.exec(repair);
    assert.deepEqual(await db.query('SELECT * FROM platform_tenant_modules ORDER BY tenant_id'), before);
    assert.equal((await grants(1)).length, 5);

    // The repair does not override a later explicit custom role set.
    await db.query("INSERT INTO role_permission_sets(tenant_id,role_key,permission_key) VALUES($1,'owner','office.clients.view_sensitive')", [id(10)]);
    await actor();
    await assert.rejects(load(), error => error.code === '42501');
    await owner();
    await db.query('DELETE FROM role_permission_sets WHERE tenant_id=$1', [id(10)]);
    await db.query("INSERT INTO employees(id,tenant_id,profile_id,first_name,status) VALUES($1,$2,$3,'Synthetic','active')", [id(43), id(10), id(20)]);
    await db.query("INSERT INTO employee_permission_overrides(tenant_id,employee_id,permission_key,allowed) VALUES($1,$2,'beratung.cases.manage',false)", [id(10), id(43)]);
    await actor();
    assert.equal((await load()).canManage, false);
    await assert.rejects(db.query("SELECT consultation_workspace_mutate($1,'create',gen_random_uuid(),NULL,NULL,'{}')", [id(10)]), error => error.code === '42501');
    await owner();
    await db.query("INSERT INTO employee_data_scopes(tenant_id,employee_id,module,scope_type,scope_value) VALUES($1,$2,'beratung','client','restricted')", [id(10), id(43)]);
    await actor();
    await assert.rejects(load(), error => error.code === '42501');
    await actor(null);
    await assert.rejects(load(), error => error.code === '42501');
  } finally { await db.close(); }
});

test('legacy consultation backfill preserves module locks, license windows, custom roles and read-only grants', async () => {
  const { db, owner, actor, load, grants } = await fixture();
  try {
    await owner();
    const cases = [
      [11, "status='trial',trial_ends_at=now()+interval '1 day'"],
      [12, "status='trial',trial_ends_at=now()-interval '1 day'"],
      [13, "ends_at=now()-interval '1 day'"],
      [14, "starts_at=now()+interval '1 day'"],
      [15, "billing_status='admin_disabled'"],
      [16, "is_active=false"],
      [17, "access_source='disabled'"],
      [18, "status='active'"],
      [19, "status='active'"],
      [25, "status='trial',trial_ends_at=NULL"],
    ];
    for (const [tenant, settings] of cases) {
      await db.query('INSERT INTO tenants VALUES($1) ON CONFLICT DO NOTHING', [id(tenant)]);
      await db.query("INSERT INTO tenant_products(tenant_id,product_id,product_key) VALUES($1,$2,'beratung')", [id(tenant), id(90)]);
      await db.exec(`UPDATE tenant_products SET ${settings} WHERE tenant_id='${id(tenant)}'`);
    }
    await db.query("INSERT INTO platform_tenant_modules(tenant_id,module_key,status,manual_override) VALUES($1,'consulting','locked',true),($2,'consulting','enabled',true)", [id(18), id(19)]);

    const roleCases = [
      [5, 'legacy_reader', false, false, false, false],
      [6, 'legacy_planner', false, true, true, true],
      [7, 'custom_manager', true, true, true, true],
      [8, 'granular_reader', true, true, true, true],
      [9, 'restricted_manager', true, true, true, true],
      [30, 'employee_portal', true, true, true, true],
      [31, 'ungranted_owner', true, true, true, true],
    ];
    for (const [role, key, admin, create, update, approve] of roleCases) {
      await db.query('INSERT INTO roles(id,tenant_id,key,is_admin_role) VALUES($1,$2,$3,$4)', [id(role), id(10), key, admin]);
      await db.query("INSERT INTO role_permissions(role_id,tenant_id,permission_key,can_view,can_create,can_update,can_approve) VALUES($1,$2,'beratung',$3,$4,$5,$6),($1,$2,'office.clients.view_sensitive',true,false,false,false)", [id(role), id(10), role !== 31, create, update, approve]);
    }
    await db.query("INSERT INTO role_permission_sets(tenant_id,role_key,permission_key) VALUES($1,'custom_manager','office.clients.view_sensitive')", [id(10)]);
    await db.query("INSERT INTO role_permissions(role_id,tenant_id,permission_key) VALUES($1,$2,'beratung.cases.view')", [id(8), id(10)]);
    await db.query("UPDATE role_permissions SET restrictions='{\"clients\":[\"limited\"]}' WHERE role_id=$1 AND permission_key='beratung'", [id(9)]);
    await db.exec(repair);
    const modules = (await db.query('SELECT tenant_id,status,is_trial,manual_override FROM platform_tenant_modules ORDER BY tenant_id')).rows;
    assert.deepEqual(modules.map(row => row.tenant_id), [id(11), id(18), id(19)]);
    assert.equal(modules[0].status, 'trial');
    assert.equal(modules[0].is_trial, true);
    assert.equal(modules[1].status, 'locked');
    assert.equal(modules[1].manual_override, true);
    assert.equal(modules[2].manual_override, true);
    assert.deepEqual(await grants(5), ['beratung.access', 'beratung.cases.view']);
    assert.deepEqual(await grants(6), ['beratung.access', 'beratung.cases.manage', 'beratung.cases.review', 'beratung.cases.view']);
    for (const role of [7, 9, 30, 31]) assert.deepEqual(await grants(role), []);
    assert.deepEqual(await grants(8), ['beratung.cases.view']);

    // Verify effective capabilities through the real workspace RPC, not just inserted rows.
    await db.query("INSERT INTO platform_tenant_modules(tenant_id,module_key,status) VALUES($1,'consulting','enabled')", [id(10)]);
    await db.query('UPDATE profiles SET role_id=$1 WHERE id=$2', [id(5), id(20)]);
    await actor();
    const readOnly = await load();
    assert.equal(readOnly.canManage, false);
    assert.equal(readOnly.canReview, false);
    assert.equal(readOnly.canQualify, false);
    await owner();
    await db.query("UPDATE platform_tenant_modules SET status='disabled' WHERE tenant_id=$1", [id(10)]);
    await actor();
    await assert.rejects(load(), error => error.code === '42501');
  } finally { await db.close(); }
});
