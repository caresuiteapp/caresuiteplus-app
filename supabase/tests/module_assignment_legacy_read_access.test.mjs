import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { companyFixture, id } from './company_access_fixture.mjs';

const patch = readFileSync(new URL('../migrations/20261021093935_module_assignment_legacy_read_access.sql', import.meta.url), 'utf8');
const f = await companyFixture();
const { db, owner, actor, permission } = f;
const reads = ['office.catalogs.view', 'office.employees.view', 'office.invoices.view'];
let sequence = 0;

await owner();
// Extend the shared permission flags with the remaining production columns.
await db.exec(`
  ALTER TABLE role_permissions ADD COLUMN product_key text,
    ADD COLUMN can_create boolean DEFAULT false,
    ADD COLUMN can_export boolean DEFAULT false,
    ADD COLUMN can_approve boolean DEFAULT false,
    ADD COLUMN restrictions jsonb DEFAULT '{}';
  ALTER TABLE role_permissions ADD CONSTRAINT fixture_role_permission_unique UNIQUE(role_id,permission_key);
  CREATE FUNCTION public.is_tenant_admin() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $body$
    SELECT EXISTS(SELECT 1 FROM profiles p JOIN roles r ON r.id=p.role_id
      WHERE p.auth_user_id=auth.uid() AND p.status='active' AND p.is_active
      AND (r.is_admin_role OR r.key IN ('owner','admin','business_admin')))
  $body$;
`);
// Exercise the production legacy evaluator, not a mocked permission answer.
const legacyEvaluator = readFileSync(new URL('../migrations/0237_communication_has_permission_bridge.sql', import.meta.url), 'utf8');
await db.exec(legacyEvaluator);

async function legacyOwner({ key = 'owner', admin = true, global = false, empty = false } = {}) {
  await owner();
  const n = 1000 + ++sequence * 10;
  const role = { tenant: n, id: n + 1, profile: n + 2, employee: n + 3, key };
  await db.query('INSERT INTO tenants(id) VALUES($1)', [id(role.tenant)]);
  await db.query('INSERT INTO roles(id,key,tenant_id,is_admin_role) VALUES($1,$2,$3,$4)', [id(role.id), key, global ? null : id(role.tenant), admin]);
  await db.query("INSERT INTO profiles(id,auth_user_id,tenant_id,role_id,status,is_active) VALUES($1,$2,$3,$4,'active',true)", [id(role.profile), id(role.profile + 100), id(role.tenant), id(role.id)]);
  await db.query("INSERT INTO employees(id,tenant_id,profile_id,status) VALUES($1,$2,$3,'active')", [id(role.employee), id(role.tenant), id(role.profile)]);
  if (!empty) {
    for (const key of ['office.access', 'office.clients.view', 'office.documents.view', 'business.tenant.manage', 'office.invoices.create', 'office.employees.delete', 'office.employees.hr.view']) {
      await db.query('INSERT INTO role_permissions(tenant_id,role_id,permission_key,can_view) VALUES($1,$2,$3,true)', [id(role.tenant), id(role.id), key]);
    }
    for (const key of ['clients', 'employees', 'billing']) {
      await db.query('INSERT INTO role_permissions(tenant_id,role_id,permission_key,can_view,can_create,can_update) VALUES($1,$2,$3,true,true,true)', [id(role.tenant), id(role.id), key]);
    }
  }
  return role;
}
async function apply() { await owner(); await db.exec(patch); }
async function readRows(role) {
  await owner();
  return (await db.query('SELECT * FROM role_permissions WHERE role_id=$1 AND permission_key=ANY($2::text[]) ORDER BY permission_key', [id(role.id), reads])).rows;
}
async function keys(role) { return (await readRows(role)).map(row => row.permission_key); }
async function addPermission(role, key, values = {}) {
  await owner();
  await db.query('INSERT INTO role_permissions(tenant_id,role_id,permission_key,can_view,can_create,can_update,restrictions) VALUES($1,$2,$3,$4,$5,$6,$7)', [values.foreign ? id(11) : id(role.tenant), id(role.id), key, values.view ?? true, values.create ?? false, values.update ?? false, JSON.stringify(values.restrictions ?? {})]);
}
async function deny(role, key, timing = '') {
  await owner();
  await db.query(`INSERT INTO employee_permission_overrides(tenant_id,employee_id,permission_key,allowed,valid_from,valid_until)
    VALUES($1,$2,$3,false,${timing === 'future' ? "now()+interval '1 day'" : 'NULL'},${timing === 'past' ? "now()-interval '1 day'" : 'NULL'})`, [id(role.tenant), id(role.employee), key]);
}

try {
  await test('repairs the real partially converted owner matrix with only three read grants', async () => {
    const role = await legacyOwner();
    await actor(role.profile, role.tenant);
    assert.equal((await db.query("SELECT has_permission('office.employees.view') AS ok")).rows[0].ok, true);
    assert.equal(await permission('office.employees.view', role.tenant), false);
    assert.equal((await db.query("SELECT has_permission('office.invoices.view') AS ok")).rows[0].ok, false);
    await owner();
    const before = (await db.query('SELECT * FROM role_permissions WHERE role_id=$1 ORDER BY permission_key', [id(role.id)])).rows;
    await apply();
    assert.deepEqual(await keys(role), reads);
    for (const row of await readRows(role)) {
      assert.equal(row.tenant_id, id(role.tenant));
      assert.equal(row.product_key, 'office');
      assert.equal(row.can_view, true);
      for (const flag of ['can_create', 'can_update', 'can_delete', 'can_export', 'can_approve']) assert.equal(row[flag], false);
      assert.deepEqual(row.restrictions, {});
    }
    const retained = (await db.query('SELECT * FROM role_permissions WHERE role_id=$1 AND NOT(permission_key=ANY($2::text[])) ORDER BY permission_key', [id(role.id), reads])).rows;
    assert.deepEqual(retained, before);
    await actor(role.profile, role.tenant);
    for (const key of reads) {
      assert.equal((await db.query('SELECT has_permission($1) AS ok', [key])).rows[0].ok, true);
      assert.equal(await permission(key, role.tenant), true);
    }
    const access = (await db.query('SELECT company_access_permissions($1) AS result', [id(role.tenant)])).rows[0].result;
    assert.equal(access.permissions.includes('office.employees.view'), true);
    assert.equal(access.permissions.includes('office.employees.edit'), false);
  });

  await test('repeated execution is idempotent and changes no existing permission row', async () => {
    await owner();
    const before = (await db.query('SELECT * FROM role_permissions ORDER BY id')).rows;
    await apply();
    assert.deepEqual((await db.query('SELECT * FROM role_permissions ORDER BY id')).rows, before);
  });

  await test('canonical admin receives the same narrowly verified repair', async () => {
    const role = await legacyOwner({ key: 'admin' });
    await apply();
    assert.deepEqual(await keys(role), reads);
  });

  await test('empty owners, non-admin roles, portal roles, and global roles stay untouched', async () => {
    for (const input of [{ empty: true }, { admin: false }, { key: 'employee_portal' }, { global: true }, { key: 'business_manager', admin: true }]) {
      const role = await legacyOwner(input);
      await apply();
      assert.deepEqual(await keys(role), []);
    }
  });

  await test('office access is a required server-side grant', async () => {
    const role = await legacyOwner();
    await db.query("DELETE FROM role_permissions WHERE role_id=$1 AND permission_key='office.access'", [id(role.id)]);
    await apply();
    assert.deepEqual(await keys(role), []);
  });

  await test('raw and normalized tenant role replacements are preserved', async () => {
    for (const key of ['owner', 'business_admin']) {
      const role = await legacyOwner();
      await db.query("INSERT INTO role_permission_sets(tenant_id,role_key,permission_key) VALUES($1,$2,'office.access')", [id(role.tenant), key]);
      await apply();
      assert.deepEqual(await keys(role), []);
    }
  });

  await test('any existing role metadata restriction prevents broad conversion', async () => {
    for (const key of ['employees', 'office.invoices.create', 'office.catalogs.edit']) {
      const role = await legacyOwner();
      if (key === 'office.catalogs.edit') await addPermission(role, key);
      await db.query('UPDATE role_permissions SET restrictions=$1 WHERE role_id=$2 AND permission_key=$3', [JSON.stringify({ department: 'limited' }), id(role.id), key]);
      await apply();
      assert.deepEqual(await keys(role), []);
    }
  });

  await test('existing granular read entries remain unchanged even with false legacy flags', async () => {
    const role = await legacyOwner();
    for (const key of reads) await addPermission(role, key, { view: false });
    const before = await readRows(role);
    await apply();
    assert.deepEqual(await readRows(role), before);
  });

  await test('an existing catalog policy prevents adding a catalog default', async () => {
    for (const key of ['office.catalogs.edit', 'catalogs', 'catalog']) {
      const role = await legacyOwner();
      await addPermission(role, key);
      await apply();
      assert.deepEqual(await keys(role), ['office.employees.view', 'office.invoices.view']);
    }
  });

  await test('catalog default requires all three complete legacy areas, while valid direct reads survive', async () => {
    for (const [key, column] of [['clients', 'can_create'], ['employees', 'can_update'], ['billing', 'can_create']]) {
      const role = await legacyOwner();
      await db.query(`UPDATE role_permissions SET ${column}=false WHERE role_id=$1 AND permission_key=$2`, [id(role.id), key]);
      await apply();
      assert.deepEqual(await keys(role), ['office.employees.view', 'office.invoices.view']);
    }
  });

  await test('a false coarse read flag never becomes its exact read grant', async () => {
    const role = await legacyOwner();
    await db.query("UPDATE role_permissions SET can_view=false WHERE role_id=$1 AND permission_key IN ('employees','billing')", [id(role.id)]);
    await apply();
    assert.deepEqual(await keys(role), []);
  });

  await test('foreign tenant permission metadata and foreign primary profile links prevent conversion', async () => {
    const foreignPermission = await legacyOwner();
    await db.query("UPDATE role_permissions SET tenant_id=$1 WHERE role_id=$2 AND permission_key='employees'", [id(11), id(foreignPermission.id)]);
    const foreignProfile = await legacyOwner();
    await db.query('UPDATE profiles SET tenant_id=$1 WHERE id=$2', [id(11), id(foreignProfile.profile)]);
    await apply();
    assert.deepEqual(await keys(foreignPermission), []);
    assert.deepEqual(await keys(foreignProfile), []);
  });

  await test('primary coarse personal denials block conversion regardless of validity dates', async () => {
    for (const [key, timing] of [['employees', ''], ['billing', 'past'], ['catalogs', 'future'], ['clients', '']]) {
      const role = await legacyOwner();
      await deny(role, key, timing);
      await apply();
      assert.deepEqual(await keys(role), []);
    }
  });

  await test('secondary owner role holders with coarse personal denials also block conversion', async () => {
    const role = await legacyOwner();
    const secondaryProfile = role.profile + 4;
    const secondaryEmployee = role.employee + 4;
    await db.query("INSERT INTO profiles(id,auth_user_id,tenant_id,role_id,status,is_active) VALUES($1,$2,$3,$4,'active',true)", [id(secondaryProfile), id(secondaryProfile + 100), id(role.tenant), id(4)]);
    await db.query("INSERT INTO employees(id,tenant_id,profile_id,status) VALUES($1,$2,$3,'active')", [id(secondaryEmployee), id(role.tenant), id(secondaryProfile)]);
    await db.query('INSERT INTO employee_role_assignments(tenant_id,employee_id,role_key) VALUES($1,$2,$3)', [id(role.tenant), id(secondaryEmployee), role.key]);
    await deny({ ...role, employee: secondaryEmployee }, 'employees', 'future');
    await apply();
    assert.deepEqual(await keys(role), []);
  });

  await test('existing limited employee and controlled company scopes prevent conversion', async () => {
    const employeeScope = await legacyOwner();
    await db.query("INSERT INTO employee_data_scopes(tenant_id,employee_id,module,scope_type,scope_value) VALUES($1,$2,'office','location','one location')", [id(employeeScope.tenant), id(employeeScope.employee)]);
    const companyScope = await legacyOwner();
    await db.query('INSERT INTO company_scope_profiles(tenant_id,profile_id,scope_limited,updated_by) VALUES($1,$2,true,$2)', [id(companyScope.tenant), id(companyScope.profile)]);
    await apply();
    assert.deepEqual(await keys(employeeScope), []);
    assert.deepEqual(await keys(companyScope), []);
  });

  await test('existing exact personal denials prevent creating any new legacy RPC grant', async () => {
    for (const [key, timing] of [['office.access', ''], ['office.employees.view', 'future'], ['office.invoices.view', 'past'], ['office.catalogs.view', '']]) {
      const role = await legacyOwner();
      await deny(role, key, timing);
      await apply();
      assert.deepEqual(await keys(role), []);
    }
  });

  await test('inactive profiles and employees, foreign employee links, and duplicate links stay untouched', async () => {
    for (const variant of ['inactive-profile', 'disabled-profile', 'inactive-employee', 'foreign-employee', 'duplicate-employee']) {
      const role = await legacyOwner();
      if (variant === 'inactive-profile') await db.query("UPDATE profiles SET status='inactive' WHERE id=$1", [id(role.profile)]);
      if (variant === 'disabled-profile') await db.query('UPDATE profiles SET is_active=false WHERE id=$1', [id(role.profile)]);
      if (variant === 'inactive-employee') await db.query("UPDATE employees SET status='inactive' WHERE id=$1", [id(role.employee)]);
      if (variant === 'foreign-employee') {
        // Represent an existing inconsistent legacy link; current trigger correctly rejects creating one.
        await db.exec('ALTER TABLE employees DISABLE TRIGGER company_employee_identity_guard');
        await db.query('UPDATE employees SET tenant_id=$1 WHERE id=$2', [id(11), id(role.employee)]);
        await db.exec('ALTER TABLE employees ENABLE TRIGGER company_employee_identity_guard');
      }
      if (variant === 'duplicate-employee') await db.query("INSERT INTO employees(id,tenant_id,profile_id,status) VALUES($1,$2,$3,'active')", [id(role.employee + 4), id(role.tenant), id(role.profile)]);
      await apply();
      assert.deepEqual(await keys(role), []);
    }
  });

  await test('an active owner is repaired without enabling a shared inactive account or changing either profile', async () => {
    for (const [status, enabled] of [['invited', true], ['inactive', true], ['active', false]]) {
      const role = await legacyOwner();
      const inactiveProfile = role.profile + 4;
      await db.query('INSERT INTO profiles(id,auth_user_id,tenant_id,role_id,status,is_active) VALUES($1,$2,$3,$4,$5,$6)', [id(inactiveProfile), id(inactiveProfile + 100), id(role.tenant), id(role.id), status, enabled]);
      const before = (await db.query('SELECT * FROM profiles WHERE role_id=$1 ORDER BY id', [id(role.id)])).rows;
      await apply();
      assert.deepEqual(await keys(role), reads);
      assert.deepEqual((await db.query('SELECT * FROM profiles WHERE role_id=$1 ORDER BY id', [id(role.id)])).rows, before);
      await actor(role.profile, role.tenant);
      for (const key of reads) {
        assert.equal((await db.query('SELECT has_permission($1) AS ok', [key])).rows[0].ok, true);
        assert.equal(await permission(key, role.tenant), true);
      }
      await actor(inactiveProfile, role.tenant);
      for (const key of reads) {
        assert.equal((await db.query('SELECT has_permission($1) AS ok', [key])).rows[0].ok, false);
        assert.equal(await permission(key, role.tenant), false);
      }
    }
  });

  await test('the repaired reads require the contributing profile tenant and strict auth link', async () => {
    const role = await legacyOwner();
    await apply();
    await actor(role.profile, 11);
    for (const key of reads) assert.equal((await db.query('SELECT has_permission($1) AS ok', [key])).rows[0].ok, false);
    // A matching profile primary key cannot supersede a different auth_user_id.
    await actor(role.profile - 100, role.tenant);
    for (const key of reads) assert.equal((await db.query('SELECT has_permission($1) AS ok', [key])).rows[0].ok, false);
    // The documented legacy id=auth.uid() link remains supported when unmapped.
    await owner();
    await db.query('UPDATE profiles SET auth_user_id=NULL WHERE id=$1', [id(role.profile)]);
    await actor(role.profile - 100, role.tenant);
    for (const key of reads) assert.equal((await db.query('SELECT has_permission($1) AS ok', [key])).rows[0].ok, true);
  });

  await test('an inactive privileged duplicate cannot contribute grants to an active lower-role profile', async () => {
    const role = await legacyOwner();
    const lowRole = role.id + 4;
    const lowProfile = role.profile + 4;
    const inactiveProfile = role.profile + 5;
    await db.query("INSERT INTO roles(id,key,tenant_id,is_admin_role) VALUES($1,'custom',$2,false)", [id(lowRole), id(role.tenant)]);
    await db.query("INSERT INTO profiles(id,auth_user_id,tenant_id,role_id,status,is_active) VALUES($1,$2,$3,$4,'active',true),($5,$2,$3,$6,'inactive',true)", [id(lowProfile), id(lowProfile + 100), id(role.tenant), id(lowRole), id(inactiveProfile), id(role.id)]);
    await apply();
    assert.deepEqual(await keys(role), reads);
    await actor(lowProfile, role.tenant);
    for (const key of reads) {
      assert.equal((await db.query('SELECT has_permission($1) AS ok', [key])).rows[0].ok, false);
      assert.equal(await permission(key, role.tenant), false);
    }
  });

  await test('all unrelated legacy, communication, and administrator permission branches are unchanged', async () => {
    const role = await legacyOwner();
    await addPermission(role, 'messages', { view: true, create: true });
    await addPermission(role, 'schedules', { view: false, create: false, update: false });
    await db.query("DELETE FROM role_permissions WHERE role_id=$1 AND permission_key='business.tenant.manage'", [id(role.id)]);
    const expected = new Map([
      ['office.employees.create', true], ['office.employees.upload', true],
      ['office.employees.edit', true], ['office.employees.update', true],
      ['office.employees.manage', true], ['office.employees.delete', true],
      ['office.clients.view', true], ['office.clients.create', true], ['office.clients.delete', false],
      ['office.schedules.view', false], ['office.schedules.create', false],
      ['office.schedules.upload', false], ['office.schedules.edit', false],
      ['office.schedules.update', false], ['office.schedules.manage', false], ['office.schedules.delete', false],
      ['office.invoices.create', true], ['communication.messages.view', true],
      ['communication.messages.create', true], ['communication.threads.view_all', true],
      ['business.tenant.manage', true], ['messages.broadcast.create', true], ['unknown.permission', false],
    ]);
    await db.exec(legacyEvaluator);
    await actor(role.profile, role.tenant);
    const before = (await db.query('SELECT permission_key, has_permission(permission_key) AS ok FROM unnest($1::text[]) AS permission_key', [[...expected.keys()]])).rows;
    assert.deepEqual(before.map(row => [row.permission_key, row.ok]), [...expected]);
    await apply();
    await actor(role.profile, role.tenant);
    assert.deepEqual((await db.query('SELECT permission_key, has_permission(permission_key) AS ok FROM unnest($1::text[]) AS permission_key', [[...expected.keys()]])).rows, before);
    // Existing behavior for unrelated keys is preserved even for disabled users.
    await owner();
    await db.query('UPDATE profiles SET is_active=false WHERE id=$1', [id(role.profile)]);
    await db.exec(legacyEvaluator);
    await actor(role.profile, role.tenant);
    const disabledBefore = (await db.query('SELECT permission_key, has_permission(permission_key) AS ok FROM unnest($1::text[]) AS permission_key', [[...expected.keys()]])).rows;
    await apply();
    await actor(role.profile, role.tenant);
    assert.deepEqual((await db.query('SELECT permission_key, has_permission(permission_key) AS ok FROM unnest($1::text[]) AS permission_key', [[...expected.keys()]])).rows, disabledBefore);
    for (const key of reads) assert.equal((await db.query('SELECT has_permission($1) AS ok', [key])).rows[0].ok, false);
  });

  await test('tenant boundaries and later scope restrictions still fail closed after conversion', async () => {
    const role = await legacyOwner();
    await apply();
    await actor(role.profile, 11);
    for (const key of reads) assert.equal(await permission(key, role.tenant), false);
    await owner();
    await db.query('INSERT INTO company_scope_profiles(tenant_id,profile_id,scope_limited,updated_by) VALUES($1,$2,true,$2)', [id(role.tenant), id(role.profile)]);
    await actor(role.profile, role.tenant);
    for (const key of reads) assert.equal(await permission(key, role.tenant), false);
  });
} finally {
  await db.close();
}
