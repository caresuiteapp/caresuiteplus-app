import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes as strip } from 'node:module';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const root = fileURLToPath(new URL('../../', import.meta.url));
const read = path => readFileSync(join(root, path), 'utf8');
const source = read('src/lib/assist/replacementReadinessAuthorityBoundary.web.ts');
const getBoundary = new Function(strip(source.replace(/^export type[\s\S]*?\n\}>;\n/m, '').replace(/\bexport /g, '')) + ';return getReplacementReadinessAuthorityBoundaryWeb;')();
const absenceMigration = read('supabase/migrations/0051_employee_absences.sql');
const timeMigration = read('supabase/migrations/0133_employee_time_prepared.sql');
const routeMigration = read('supabase/migrations/0142_route_planning_prepared.sql');
const roleMigration = read('supabase/migrations/0130_roles_permissions_matrix.sql');
const screen = read('src/screens/assist/ToursReplacementScreen.tsx');
const panel = read('src/components/assist/ReplacementReadinessAuthorityBoundaryPanel.web.tsx');

test('Replacement readiness boundary is immutable and forbids permission inheritance', () => {
  const value = getBoundary();
  assert.ok(Object.isFrozen(value));
  assert.equal(value.replacementInheritsPermissions, 'forbidden');
  assert.equal(value.temporaryAuthorityScope, 'not_provided');
  assert.throws(() => { value.authorityExpiry = 'provided'; }, TypeError);
  assert.strictEqual(getBoundary(), value);
});

test('Absence and availability contracts retain explicit periods and employee identities', () => {
  const absence = absenceMigration.match(/CREATE TABLE IF NOT EXISTS public\.employee_absences \([\s\S]*?\n\);/)?.[0] ?? '';
  const availability = absenceMigration.match(/CREATE TABLE IF NOT EXISTS public\.employee_availability \([\s\S]*?\n\);/)?.[0] ?? '';
  for (const table of [absence, availability]) {
    assert.match(table, /employee_id/);
    assert.match(table, /starts_at/);
    assert.match(table, /ends_at/);
  }
  assert.match(absence, /replacement_required/);
});

test('Replacement request identifies alternatives but carries no reachability or authority grant', () => {
  const table = absenceMigration.match(/CREATE TABLE IF NOT EXISTS public\.replacement_requests \([\s\S]*?\n\);/)?.[0] ?? '';
  for (const field of ['assignment_id', 'original_employee_id', 'suggested_employee_id', 'assigned_employee_id', 'absence_id']) assert.match(table, new RegExp(field));
  assert.doesNotMatch(table, /reachable_at|contact_channel|permission_keys|authority_scope|authority_valid_until|revoked_at/);
});

test('Standby time is a time entry and does not confer operational permissions', () => {
  const table = timeMigration.match(/CREATE TABLE IF NOT EXISTS public\.employee_time_entries \([\s\S]*?\n\);/)?.[0] ?? '';
  assert.match(table, /'standby_time'/);
  for (const field of ['employee_id', 'started_at', 'ended_at', 'paid_minutes', 'unpaid_minutes']) assert.match(table, new RegExp(field));
  assert.doesNotMatch(table, /permission|authority|reachable|contact_channel/);
});

test('Route suggestion validates planning signals but does not grant access', () => {
  const table = routeMigration.match(/CREATE TABLE IF NOT EXISTS public\.replacement_suggestions \([\s\S]*?\n\);/)?.[0] ?? '';
  assert.match(table, /qualification_match/);
  assert.match(table, /availability_ok/);
  assert.match(table, /suggested_employee_id/);
  assert.doesNotMatch(table, /permission|authority|role_key|valid_until|revoked_at/);
});

test('Role-area permissions are role-wide and have no replacement interval relation', () => {
  const table = roleMigration.match(/CREATE TABLE IF NOT EXISTS public\.tenant_role_area_permissions \([\s\S]*?\n\);/)?.[0] ?? '';
  for (const field of ['role_key', 'area_key', 'can_view', 'can_edit', 'can_approve']) assert.match(table, new RegExp(field));
  assert.doesNotMatch(table, /replacement_request_id|assignment_id|employee_id|valid_from|valid_until|revoked_at/);
});

test('Coverage audit rows are declared but database append-only behavior is not enforced', () => {
  for (const [migration, table] of [[absenceMigration, 'absence_audit_events'], [routeMigration, 'route_planning_audit_events']]) {
    const block = migration.match(new RegExp(`CREATE TABLE IF NOT EXISTS public\\.${table} \\([\\s\\S]*?\\n\\);`))?.[0] ?? '';
    assert.match(block, /action/);
    assert.match(block, /created_at/);
    assert.doesNotMatch(migration, new RegExp(`REVOKE (?:UPDATE|DELETE)[\\s\\S]*${table}|${table}[\\s\\S]*BEFORE (?:UPDATE|DELETE)[\\s\\S]*RAISE EXCEPTION`, 'i'));
  }
});

test('Visible route view states the authority boundary without writes or clock inference', () => {
  assert.match(screen, /<ReplacementReadinessAuthorityBoundaryPanel \/>/);
  assert.match(panel, /Vertretung und Bereitschaft · Befugnisgrenze/);
  assert.match(panel, /Auswahl, Zuweisung oder Bereitschaft übertragen keine Rolle und keine pauschalen Rechte/);
  for (const content of [source, panel]) {
    assert.doesNotMatch(content, /\b(?:fetch|insert|update|delete|upsert|rpc)\s*\(/);
    assert.doesNotMatch(content, /Date\.now|new Date|Math\.|setTimeout|setInterval/);
  }
});
