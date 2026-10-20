import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { companyFixture, id } from './company_access_fixture.mjs';

const migration = readFileSync(new URL('../migrations/20261015142334_company_owner_profile_activation.sql', import.meta.url), 'utf8');
const f = await companyFixture();
const { db, owner, actor, access } = f;
const signedIn = '2026-10-15T01:00:00.000Z';
const previouslyActivated = '2026-09-01T01:00:00.000Z';
const profiles = async () => (await db.query('SELECT to_jsonb(p) AS data FROM profiles p ORDER BY id')).rows.map(row => row.data);

try {
  await owner();
  await db.exec(`
    ALTER TABLE profiles ADD COLUMN locked_at timestamptz, ADD COLUMN activated_at timestamptz,
      ADD COLUMN created_at timestamptz DEFAULT '2026-06-01T01:00:00Z',
      ADD COLUMN updated_at timestamptz DEFAULT '2026-06-01T01:00:00Z';
    ALTER TABLE tenants ADD COLUMN status text DEFAULT 'trial';
    CREATE TABLE auth.users(
      id uuid PRIMARY KEY, email_confirmed_at timestamptz, last_sign_in_at timestamptz,
      banned_until timestamptz, deleted_at timestamptz, is_anonymous boolean,
      raw_app_meta_data jsonb
    );
  `);
  await db.query("UPDATE roles SET key='owner',tenant_id=$1 WHERE id=$2", [id(10), id(1)]);
  await db.query("INSERT INTO roles(id,key,tenant_id) VALUES($1,'owner',$2),($3,'owner',NULL)", [id(5), id(11), id(6)]);
  await db.query("UPDATE tenants SET status='suspended' WHERE id=$1", [id(11)]);
  await db.query("INSERT INTO role_permissions(role_id,permission_key) VALUES($1,'business.tenant.manage'),($1,'inventory.view')", [id(1)]);
  await db.query("UPDATE profiles SET status='invited' WHERE id=$1", [id(20)]);

  const cases = [
    { name: 'verified owner with matching claims', n: 20, activate: true },
    { name: 'legacy owner without claims', n: 500, activate: true, metadata: {} },
    { name: 'preserve existing activation timestamp', n: 501, activate: true, activatedAt: previouslyActivated },
    { name: 'unconfirmed email', n: 502, confirmed: false },
    { name: 'invitation never used', n: 503, signedIn: false },
    { name: 'disabled profile', n: 504, active: false },
    { name: 'locked profile', n: 505, locked: true },
    { name: 'suspended profile', n: 506, status: 'suspended' },
    { name: 'already active profile', n: 507, status: 'active' },
    { name: 'employee portal role', n: 508, role: 3 },
    { name: 'non-owner business role', n: 509, role: 2 },
    { name: 'employee portal claim', n: 510, metadata: { portal: 'employee' } },
    { name: 'client portal type claim', n: 511, metadata: { portal_type: 'client' } },
    { name: 'portal role claim', n: 512, metadata: { role_key: 'employee_portal' } },
    { name: 'foreign tenant claim', n: 513, metadata: { tenant_id: id(11) } },
    { name: 'role from another tenant', n: 514, role: 5 },
    { name: 'global rather than tenant owner role', n: 515, role: 6 },
    { name: 'banned auth account', n: 516, banned: true },
    { name: 'deleted auth account', n: 517, deleted: true },
    { name: 'anonymous auth account', n: 518, anonymous: true },
    { name: 'duplicate auth link', n: 519, duplicate: true },
    { name: 'legacy identity alias collision', n: 520, alias: true },
    { name: 'disabled tenant', n: 521, tenant: 11, role: 5 },
    { name: 'profile created after last login', n: 522, createdAfterLogin: true },
    { name: 'profile changed after last login', n: 523, updatedAfterLogin: true },
    { name: 'email confirmed after last login', n: 524, confirmedAfterLogin: true },
  ];

  for (const c of cases) {
    const tenant = c.tenant ?? 10;
    if (c.n !== 20) {
      await db.query(`INSERT INTO profiles(id,auth_user_id,tenant_id,role_id,status,is_active,locked_at,activated_at)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8)`, [id(c.n), id(c.n + 100), id(tenant), id(c.role ?? 1),
        c.status ?? 'invited', c.active ?? true, c.locked ? signedIn : null, c.activatedAt ?? null]);
    }
    await db.query(`INSERT INTO auth.users VALUES($1,$2,$3,$4,$5,$6,$7)`, [
      id(c.n + 100), c.confirmed === false ? null : c.confirmedAfterLogin ? '2026-10-16' : previouslyActivated,
      c.signedIn === false ? null : signedIn, c.banned ? '2099-01-01' : null,
      c.deleted ? signedIn : null, c.anonymous ?? false,
      JSON.stringify(c.metadata ?? { role_key: 'business_admin', tenant_id: id(tenant) }),
    ]);
    if (c.createdAfterLogin) await db.query("UPDATE profiles SET created_at='2026-10-16' WHERE id=$1", [id(c.n)]);
    if (c.updatedAfterLogin) await db.query("UPDATE profiles SET updated_at='2026-10-16' WHERE id=$1", [id(c.n)]);
    if (c.duplicate || c.alias) {
      await db.query("INSERT INTO profiles(id,auth_user_id,tenant_id,role_id,status,is_active) VALUES($1,$2,$3,$4,'invited',false)",
        [id(c.alias ? c.n + 100 : c.n + 1000), c.duplicate ? id(c.n + 100) : null, id(10), id(1)]);
    }
  }

  await test('reconciles proven legacy owners while leaving all other profile data unchanged', async () => {
    await actor(20);
    assert.deepEqual((await access()).permissions, [], 'invited owners stay denied before reconciliation');
    await owner();
    const before = await profiles();
    await db.exec(migration);
    const after = await profiles();
    for (const original of before) {
      const c = cases.find(candidate => id(candidate.n) === original.id);
      const actual = after.find(profile => profile.id === original.id);
      if (c?.activate) {
        assert.equal(actual.status, 'active', c.name);
        assert.equal(new Date(actual.activated_at).toISOString(), c.activatedAt ?? signedIn, c.name);
        assert.deepEqual({ ...actual, status: original.status, activated_at: original.activated_at }, original,
          `${c.name}: identity, tenant, role and all other fields stay unchanged`);
      } else {
        assert.deepEqual(actual, original, c?.name ?? 'unrelated profile');
      }
    }
  });

  await test('reconciliation is idempotent', async () => {
    const before = await profiles();
    await db.exec(migration);
    assert.deepEqual(await profiles(), before);
  });

  await test('restored access still obeys explicit role grants, overrides and tenant boundaries', async () => {
    await actor(20);
    assert.deepEqual(new Set((await access()).permissions), new Set(['business.tenant.manage', 'inventory.view']));
    await owner();
    await db.query("INSERT INTO employees(id,tenant_id,profile_id,status) VALUES($1,$2,$3,'active')", [id(50), id(10), id(20)]);
    await db.query("INSERT INTO employee_permission_overrides(tenant_id,employee_id,permission_key,allowed) VALUES($1,$2,'inventory.view',false)", [id(10), id(50)]);
    await actor(20);
    assert.equal((await access()).permissions.includes('inventory.view'), false);
    await owner();
    await db.exec('DELETE FROM employee_permission_overrides');
    await db.query("INSERT INTO role_permission_sets(tenant_id,role_key,permission_key) VALUES($1,'owner','office.employees.view')", [id(10)]);
    await actor(20);
    assert.equal((await access()).permissions.includes('inventory.view'), false);
    await owner();
    await db.exec('DELETE FROM role_permission_sets');
    await actor(20, 11);
    assert.deepEqual((await access()).permissions, []);
    await actor(20, 10, { app_metadata: { role_key: 'employee_portal' } });
    assert.deepEqual((await access()).permissions, []);
    await actor(503);
    assert.deepEqual((await access()).permissions, [], 'unused invitations remain denied');
  });
} finally {
  await db.close();
}
