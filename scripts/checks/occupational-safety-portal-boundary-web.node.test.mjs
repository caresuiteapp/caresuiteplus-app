import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes as strip } from 'node:module';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const root = fileURLToPath(new URL('../../', import.meta.url));
const read = path => readFileSync(join(root, path), 'utf8');
const source = read('src/lib/office/occupationalSafetyPortalBoundary.web.ts');
const getBoundary = new Function(strip(source.replace(/^export type[\s\S]*?\n\}>;\n/m, '').replace(/\bexport /g, '')) + ';return getOccupationalSafetyPortalBoundaryWeb;')();
const complianceAccess = read('src/lib/office/complianceTrainingAccess.ts');
const complianceMigration = read('supabase/migrations/0052_compliance_training_prepared.sql');
const trainingMigration = read('supabase/migrations/0139_training_management_prepared.sql');
const profileLive = read('src/lib/portal/clientProfileLiveService.ts');
const profileProjection = read('src/lib/portal/clientPortalProfileProjection.ts');
const personalAccess = read('src/lib/office/personalComplianceAccess.ts');
const screen = read('src/screens/office/PersonalComplianceCockpitScreen.tsx');
const panel = read('src/components/office/OccupationalSafetyPortalBoundaryPanel.web.tsx');

test('Occupational-safety portal boundary is immutable and records the unresolved database gap', () => {
  const value = getBoundary();
  assert.ok(Object.isFrozen(value));
  assert.equal(value.clientPortalApplicationAccess, 'forbidden');
  assert.equal(value.clientPortalDatabaseIsolation, 'not_enforced');
  assert.equal(value.appendOnlyHistory, 'not_enforced');
  assert.throws(() => { value.hazardRecord = 'provided'; }, TypeError);
  assert.strictEqual(getBoundary(), value);
});

test('Prepared compliance contracts retain employee identities and training evidence', () => {
  const assignment = complianceMigration.match(/CREATE TABLE IF NOT EXISTS public\.compliance_training_assignments \([\s\S]*?\n\);/)?.[0] ?? '';
  const acknowledgement = complianceMigration.match(/CREATE TABLE IF NOT EXISTS public\.compliance_training_acknowledgements \([\s\S]*?\n\);/)?.[0] ?? '';
  const trainingRecord = trainingMigration.match(/CREATE TABLE IF NOT EXISTS public\.employee_training_records \([\s\S]*?\n\);/)?.[0] ?? '';
  for (const table of [assignment, acknowledgement, trainingRecord]) assert.match(table, /employee_id/);
  assert.match(assignment, /status|acknowledged_at/);
  assert.match(acknowledgement, /signature_captured_at|viewed_at/);
  assert.match(trainingRecord, /status|completed_at/);
});

test('Training evidence is not a native occupational hazard, measure, report, or responsible-office record', () => {
  for (const migration of [complianceMigration, trainingMigration]) {
    assert.doesNotMatch(migration, /occupational_hazard|hazard_assessment|protective_measure|incident_reported_at|responsible_office_id/);
  }
});

test('Application access explicitly rejects client and family portal roles', () => {
  assert.match(complianceAccess, /isClientPortalRole\(ctx\.roleKey\)/);
  assert.match(complianceAccess, /Pflichtunterweisungen sind für Klient:innenportale nicht sichtbar/);
  assert.match(personalAccess, /isClientPortalRole\(ctx\.roleKey\)/);
});

test('Client portal live profile reads no employee personnel or training table', () => {
  const tables = [...profileLive.matchAll(/fromUnknownTable\(supabase,\s*'([^']+)'\)/g)].map(match => match[1]);
  assert.ok(tables.length > 0);
  for (const table of tables) {
    assert.doesNotMatch(table, /^(?:employees|employee_|compliance_training|training_)/);
  }
});

test('Client portal projection is an explicit client-domain allowlist', () => {
  assert.match(profileProjection, /BuildClientPortalProfileInput/);
  assert.match(profileProjection, /operationalInformation/);
  assert.doesNotMatch(profileProjection, /employeeId|employee_id|hazard_assessment|protective_measure|responsible_office/);
});

test('Prepared SQL policies remain tenant-wide and do not prove portal-role isolation', () => {
  for (const migration of [complianceMigration, trainingMigration]) {
    assert.match(migration, /tenant_id = public\.current_tenant_id\(\)/);
    assert.doesNotMatch(migration, /is_client_portal_rls_context|current_role_key\(\)\s+NOT IN\s*\([^)]*client_portal/);
  }
});

test('Internal cockpit states the boundary without writes or clock inference', () => {
  assert.match(screen, /<OccupationalSafetyPortalBoundaryPanel \/>/);
  assert.match(panel, /Arbeitsschutz und Belastung · Portalgrenze/);
  assert.match(panel, /eine tatsächlich ausgerollte feld- und rollenbezogene Datenbanktrennung ist damit jedoch nicht bewiesen/);
  for (const content of [source, panel]) {
    assert.doesNotMatch(content, /\b(?:fetch|insert|update|delete|upsert|rpc)\s*\(/);
    assert.doesNotMatch(content, /Date\.now|new Date|Math\.|setTimeout|setInterval/);
  }
});
