import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { academyFixture, content, id } from './academy_workspace_fixture.mjs';

const migrations = new URL('../migrations/', import.meta.url);
const candidates = readdirSync(migrations).filter(name => name.endsWith('_academy_legacy_access_repair.sql'));
if (!process.env.ACADEMY_ACCESS_REPAIR_SQL && candidates.length !== 1) {
  throw new Error('Exactly one published Academy legacy access repair migration is required.');
}
const sql = readFileSync(process.env.ACADEMY_ACCESS_REPAIR_SQL ?? new URL(candidates[0], migrations), 'utf8');
const role = id(90), employee = id(91), tenant = id(10);
const keys = ['akademie.access', 'akademie.courses.manage', 'akademie.courses.view', 'akademie.enrollments.assign', 'akademie.enrollments.review'];
const denied = promise => assert.rejects(promise, error => error.code === '42501');

/** Only synthetic records in the existing embedded PostgreSQL fixture. */
async function legacyFixture(flags = {}) {
  const f = await academyFixture();
  await f.owner();
  await f.db.exec(`
    ALTER TABLE role_permissions ADD COLUMN product_key product_key;
    ALTER TABLE role_permissions ADD COLUMN can_create boolean NOT NULL DEFAULT false;
    ALTER TABLE role_permissions ADD COLUMN can_update boolean NOT NULL DEFAULT false;
    ALTER TABLE role_permissions ADD COLUMN can_delete boolean NOT NULL DEFAULT false;
    ALTER TABLE role_permissions ADD COLUMN can_export boolean NOT NULL DEFAULT false;
    ALTER TABLE role_permissions ADD COLUMN can_approve boolean NOT NULL DEFAULT false;
    ALTER TABLE role_permissions ADD COLUMN restrictions jsonb NOT NULL DEFAULT '{}'::jsonb;
    ALTER TABLE role_permissions ADD CONSTRAINT academy_fixture_permission_unique UNIQUE(role_id,permission_key);
  `);
  await f.db.query("INSERT INTO roles(id,key,tenant_id,is_admin_role) VALUES($1,'owner',$2,true)", [role, tenant]);
  await f.db.query('UPDATE profiles SET role_id=$1 WHERE id=$2', [role, id(20)]);
  await f.db.query("INSERT INTO employees(id,tenant_id,profile_id,first_name,last_name,status) VALUES($1,$2,$3,'Owner','Synthetic','active')", [employee, tenant, id(20)]);
  for (const permission of ['office.access', 'office.employees.view']) {
    await f.db.query('INSERT INTO role_permissions(role_id,tenant_id,permission_key) VALUES($1,$2,$3)', [role, tenant, permission]);
  }
  await f.db.query("INSERT INTO role_permissions(role_id,tenant_id,permission_key,can_view,can_create,can_update,can_approve) VALUES($1,$2,'academy',$3,$4,$5,$6)",
    [role, tenant, flags.view ?? true, flags.create ?? true, flags.update ?? true, flags.approve ?? true]);
  const grants = async () => (await f.db.query("SELECT permission_key FROM role_permissions WHERE role_id=$1 AND permission_key LIKE 'akademie.%' ORDER BY permission_key", [role])).rows.map(row => row.permission_key);
  const repair = async () => { await f.owner(); await f.db.exec(sql); };
  return { ...f, grants, repair };
}

test('legacy Academy: reproduce denial, translate existing authority and complete the authorized RPC workflow', async () => {
  const f = await legacyFixture();
  try {
    await f.actor();
    assert.equal((await f.db.query('SELECT care_security.company_profile($1) IS NOT NULL AS valid', [tenant])).rows[0].valid, true);
    await denied(f.load());
    await f.repair(); assert.deepEqual(await f.grants(), keys);
    const before = await f.db.query('SELECT count(*)::int AS n FROM role_permissions');
    await f.repair(); assert.deepEqual(await f.db.query('SELECT count(*)::int AS n FROM role_permissions'), before);
    await f.actor();
    assert.deepEqual((await f.load()).capabilities, { manageCourses: true, assign: true, review: true, learn: false });
    let course = await f.publish(); await f.assign(course);
    await f.learner(); let enrollment = (await f.load('learner')).enrollments[0];
    const send = async (action, data) => f.mutate(action, enrollment.id, enrollment.revision, data, { view: 'learner' });
    await send('complete_lesson', { lessonId: 'reading' }); enrollment = (await f.load('learner')).enrollments[0];
    await send('submit_quiz', { lessonId: 'check', answers: { 'question-1': 'b' } }); enrollment = (await f.load('learner')).enrollments[0];
    await send('submit_enrollment', {}); enrollment = (await f.load('learner')).enrollments[0];
    await f.actor();
    await f.mutate('review_enrollment', enrollment.id, enrollment.revision, { decision: 'approve', note: 'Synthetisch geprüft', validUntil: null });
    assert.equal((await f.load()).certificates.length, 1);
    await denied(f.db.query('SELECT * FROM courses'));
    await denied(f.db.query('SELECT * FROM academy_private.course_workspaces'));
    await f.actor(24, 11); await denied(f.load('office', 10));
    await f.learner(); await denied(f.load('office'));
  } finally { await f.db.close(); }
});

test('legacy Academy: a view-only grant remains read-only and cannot author, assign or approve', async () => {
  const f = await legacyFixture({ create: false, update: false, approve: false });
  try {
    await f.repair(); assert.deepEqual(await f.grants(), ['akademie.access', 'akademie.courses.view']);
    await f.actor();
    assert.deepEqual((await f.load()).capabilities, { manageCourses: false, assign: false, review: false, learn: false });
    await denied(f.mutate('save_course', randomUUID(), null, { content: content() }));
    await denied(f.mutate('assign', randomUUID(), 1, { targets: [], dueDate: null }));
    await denied(f.mutate('review_enrollment', randomUUID(), 1, { decision: 'approve', note: 'Test', validUntil: null }));
  } finally { await f.db.close(); }
});

test('legacy Academy: existing write flags do not imply approval authority', async () => {
  const f = await legacyFixture({ approve: false });
  try {
    await f.repair(); assert.deepEqual(await f.grants(), keys.filter(key => key !== 'akademie.enrollments.review'));
    await f.actor(); assert.equal((await f.load()).capabilities.review, false);
    await denied(f.mutate('review_enrollment', randomUUID(), 1, { decision: 'approve', note: 'Test', validUntil: null }));
  } finally { await f.db.close(); }
});

for (const flags of [{ create: false }, { update: false }, { view: false }]) {
  test(`legacy Academy: combined capabilities require every underlying flag ${JSON.stringify(flags)}`, async () => {
    const f = await legacyFixture(flags);
    try {
      await f.repair(); assert.deepEqual(await f.grants(), flags.view === false ? [] : ['akademie.access', 'akademie.courses.view']);
    } finally { await f.db.close(); }
  });
}

const exclusions = [
  ['custom primary replacement set', async f => f.db.query("INSERT INTO role_permission_sets(tenant_id,role_key,permission_key) VALUES($1,'owner','office.access')", [tenant])],
  ['custom mapped replacement set', async f => f.db.query("INSERT INTO role_permission_sets(tenant_id,role_key,permission_key) VALUES($1,'business_admin','office.access')", [tenant])],
  ['existing exact Academy policy', async f => f.db.query("INSERT INTO role_permissions(role_id,permission_key) VALUES($1,'akademie.courses.view')", [role])],
  ['restricted coarse grant', async f => f.db.query("UPDATE role_permissions SET restrictions=$2::jsonb WHERE role_id=$1 AND permission_key='academy'", [role, JSON.stringify({ team: 'only' })])],
  ['foreign grant row', async f => f.db.query("UPDATE role_permissions SET tenant_id=$2 WHERE role_id=$1 AND permission_key='academy'", [role, id(11)])],
  ['foreign primary profile', async f => f.db.query('UPDATE profiles SET role_id=$1 WHERE id=$2', [role, id(24)])],
  ['nonstandard role', async f => f.db.query("UPDATE roles SET key='custom_admin' WHERE id=$1", [role])],
  ['nonadministrative role', async f => f.db.query('UPDATE roles SET is_admin_role=false WHERE id=$1', [role])],
  ['missing Office access', async f => f.db.query("DELETE FROM role_permissions WHERE role_id=$1 AND permission_key='office.access'", [role])],
  ['duplicate personnel link', async f => f.db.query("INSERT INTO employees(id,tenant_id,profile_id,status) VALUES($1,$2,$3,'active')", [id(92), tenant, id(20)])],
  ['foreign legacy personnel link', async f => {
    // Model a historic inconsistent row in this isolated fixture, then restore
    // its guard before applying the repair. Production guards stay untouched.
    await f.db.exec('ALTER TABLE employees DISABLE TRIGGER company_employee_identity_guard');
    await f.db.query('UPDATE employees SET tenant_id=$2 WHERE id=$1', [employee, id(11)]);
    await f.db.exec('ALTER TABLE employees ENABLE TRIGGER company_employee_identity_guard');
  }],
  ['deleted personnel link', async f => f.db.query('UPDATE employees SET deleted_at=now() WHERE id=$1', [employee])],
  ['personnel record scope', async f => f.db.query("INSERT INTO employee_data_scopes(tenant_id,employee_id,module,scope_type,scope_value) VALUES($1,$2,'akademie','employee','self')", [tenant, employee])],
  ['company scope restriction', async f => f.db.query('INSERT INTO company_scope_profiles(tenant_id,profile_id,scope_limited,updated_by) VALUES($1,$2,true,$2)', [tenant, id(20)])],
  ['future granular denial', async f => f.db.query("INSERT INTO employee_permission_overrides(tenant_id,employee_id,permission_key,allowed,valid_from) VALUES($1,$2,'akademie.courses.manage',false,now()+interval '1 day')", [tenant, employee])],
  ['expired coarse denial', async f => f.db.query("INSERT INTO employee_permission_overrides(tenant_id,employee_id,permission_key,allowed,valid_until) VALUES($1,$2,'academy',false,now()-interval '1 day')", [tenant, employee])],
  ['global denial', async f => f.db.query("INSERT INTO employee_permission_overrides(tenant_id,employee_id,permission_key,allowed) VALUES($1,$2,'*',false)", [tenant, employee])],
  ['secondary-role denial', async f => {
    await f.db.query("INSERT INTO employee_role_assignments(tenant_id,employee_id,role_key) VALUES($1,$2,'owner')", [tenant, id(40)]);
    await f.db.query("INSERT INTO employee_permission_overrides(tenant_id,employee_id,permission_key,allowed) VALUES($1,$2,'training',false)", [tenant, id(40)]);
  }],
  ['secondary-role scope', async f => {
    await f.db.query("INSERT INTO employee_role_assignments(tenant_id,employee_id,role_key) VALUES($1,$2,'owner')", [tenant, id(40)]);
    await f.db.query("INSERT INTO employee_data_scopes(tenant_id,employee_id,module,scope_type,scope_value) VALUES($1,$2,'office','department','one')", [tenant, id(40)]);
  }],
];
for (const [label, arrange] of exclusions) {
  test(`legacy Academy: preserve ${label}`, async () => {
    const f = await legacyFixture();
    try {
      await arrange(f); const before = await f.grants();
      await f.repair(); assert.deepEqual(await f.grants(), before);
    } finally { await f.db.close(); }
  });
}

test('legacy Academy: inactive shared-role profiles and stale or ambiguous identities remain rejected by the real RPC', async () => {
  const f = await legacyFixture();
  try {
    await f.db.query("INSERT INTO profiles(id,auth_user_id,tenant_id,role_id,status,is_active) VALUES($1,$2,$3,$4,'inactive',false)", [id(92), id(192), tenant, role]);
    await f.repair(); assert.deepEqual(await f.grants(), keys);
    await f.actor(); assert.equal((await f.load()).viewer.mode, 'office');
    await f.actor(92); await denied(f.load());
    await denied(f.mutate('save_course', randomUUID(), null, { content: content() }));
    await f.owner(); await f.db.query('UPDATE profiles SET auth_user_id=$2 WHERE id=$1', [id(20), id(999)]);
    await f.actor(); await denied(f.load());
    await denied(f.mutate('save_course', randomUUID(), null, { content: content() }));
    await f.owner(); await f.db.query('UPDATE profiles SET auth_user_id=$2 WHERE id=$1', [id(20), id(120)]);
    await f.db.query("UPDATE profiles SET auth_user_id=$2,status='active',is_active=true WHERE id=$1", [id(92), id(120)]);
    await f.actor(); await denied(f.load());
  } finally { await f.db.close(); }
});

test('legacy Academy: later personal denials and tenant replacement sets remain authoritative', async () => {
  const f = await legacyFixture();
  try {
    await f.repair();
    await f.db.query("INSERT INTO employee_permission_overrides(tenant_id,employee_id,permission_key,allowed) VALUES($1,$2,'akademie.courses.view',false)", [tenant, employee]);
    await f.actor(); await denied(f.load());
    await f.owner(); await f.db.query('DELETE FROM employee_permission_overrides WHERE employee_id=$1', [employee]);
    await f.db.query("INSERT INTO role_permission_sets(tenant_id,role_key,permission_key) VALUES($1,'owner','office.access')", [tenant]);
    await f.actor(); await denied(f.load());
  } finally { await f.db.close(); }
});
