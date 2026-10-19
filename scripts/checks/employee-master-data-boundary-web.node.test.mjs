import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes as strip } from 'node:module';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const root = fileURLToPath(new URL('../../', import.meta.url));
const read = path => readFileSync(join(root, path), 'utf8');
const source = read('src/lib/office/employeeMasterDataBoundary.web.ts');
const getBoundary = new Function(strip(source.replace(/^export type[\s\S]*?\n\}>;\n/m, '').replace(/\bexport /g, '')) + ';return getEmployeeMasterDataBoundaryWeb;')();
const mapper = read('src/lib/office/employeeDetailMapper.ts');
const detailScreen = read('src/screens/office/EmployeeDetailScreen.tsx');
const panel = read('src/components/office/EmployeeMasterDataBoundaryPanel.web.tsx');
const offboarding = read('src/lib/office/offboarding/employeeOffboardingService.ts');
const schema = read('supabase/migrations/0132_employee_personnel_file_prepared.sql');

test('Master-data boundary is immutable and forbids completion inference', () => {
  const value = getBoundary();
  assert.ok(Object.isFrozen(value));
  assert.equal(value.nativeEmployeeIdentity, 'provided');
  assert.equal(value.currentEmploymentSnapshot, 'partial');
  assert.equal(value.exitImpliesAllAccessRevoked, 'forbidden');
  assert.equal(value.currentSnapshotImpliesCompletePersonnelFile, 'forbidden');
  assert.throws(() => { value.exitImpliesAllAccessRevoked = 'allowed'; }, TypeError);
  assert.strictEqual(getBoundary(), value);
});

test('Employee detail query is a current snapshot without exit or contract history', () => {
  const columns = mapper.match(/export const EMPLOYEE_DETAIL_SELECT_COLUMNS = \[([\s\S]*?)\n\]\.join/)?.[1] ?? '';
  assert.match(columns, /entry_date/);
  assert.match(columns, /employment_type/);
  assert.doesNotMatch(columns, /exit_date|contract_type|fixed_term_ends_at|notice_period_days|profile_id/);
  assert.doesNotMatch(mapper, /history|revision|valid_from|valid_to/);
});

test('Personnel schema keeps current rows but defines no native contract or role history', () => {
  assert.match(schema, /CREATE TABLE IF NOT EXISTS public\.employee_employment_details/);
  assert.match(schema, /CREATE TABLE IF NOT EXISTS public\.employee_audit_events/);
  const tables = [...schema.matchAll(/CREATE TABLE IF NOT EXISTS public\.([a-z0-9_]+)/g)].map(match => match[1]);
  assert.ok(tables.every(table => !/(?:employment_history|contract_history|role_history|employee_identity_history)/.test(table)));
  assert.doesNotMatch(schema, /valid_from|valid_to|supersedes_id|original_revision_id/);
});

test('Portal revocation is several client writes and not an atomic all-access transaction', () => {
  const lock = offboarding.match(/export async function lockOffboardingPortalAccess\([\s\S]*?\n\}/)?.[0] ?? '';
  assert.match(lock, /employee_portal_accounts/);
  assert.match(lock, /employee_profiles/);
  assert.match(lock, /invalidateEmployeeOffboardingPushDevices/);
  assert.doesNotMatch(lock, /\.rpc\(|transaction|BEGIN|COMMIT/);
  assert.doesNotMatch(lock, /kind: 'email'|kind: 'phone'|kind: 'cloud'/);
});

test('Final clearance writes current exit status but does not prove identity-provider revocation', () => {
  assert.match(offboarding, /\{ status: 'terminated', exit_date: progress\.session\.exitDate \}/);
  assert.doesNotMatch(offboarding, /auth\.admin\.deleteUser|auth\.admin\.updateUserById/);
  assert.doesNotMatch(offboarding, /historical.*author|author.*history/i);
});

test('Visible employment view states the personnel and access evidence limits', () => {
  assert.match(detailScreen, /<EmployeeMasterDataBoundaryPanel \/>/);
  assert.match(panel, /Personalstamm und Austritt · Nachweisgrenze/);
  assert.match(panel, /aktueller Beschäftigten-Snapshot/);
  assert.match(panel, /keine vollständige Vertrags-, Rollen- oder Beschäftigungsänderungshistorie/);
  assert.match(panel, /beweist weder den vollständigen Entzug aller Portal-, Geräte-, E-Mail-, Telefon- und Cloud-Zugänge/);
  assert.match(panel, /unveränderte Erhaltung aller historischen Autorenangaben/);
});

test('Boundary display has no query, write, clock or inferred access completion', () => {
  for (const content of [source, panel]) {
    assert.doesNotMatch(content, /\b(?:fetch|insert|update|delete|upsert|rpc)\s*\(/);
    assert.doesNotMatch(content, /Date\.now|new Date|Math\.|setTimeout|setInterval/);
  }
  assert.doesNotMatch(source, /status\s*[:=]\s*['"](?:completed|revoked|terminated|archived)['"]/);
});
