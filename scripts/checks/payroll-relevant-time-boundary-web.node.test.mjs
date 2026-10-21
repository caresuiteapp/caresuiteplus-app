import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes as strip } from 'node:module';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const root = fileURLToPath(new URL('../../', import.meta.url));
const read = path => readFileSync(join(root, path), 'utf8');
const source = read('src/lib/wfm/payrollRelevantTimeBoundary.web.ts');
const getBoundary = new Function(strip(source.replace(/^export type[\s\S]*?\n\}>;\n/m, '').replace(/\bexport /g, '')) + ';return getPayrollRelevantTimeBoundaryWeb;')();
const prepared = read('supabase/migrations/0133_employee_time_prepared.sql');
const reviews = read('supabase/migrations/0240_wfm_time_reviews_phase2_p21.sql');
const exportsP22 = read('supabase/migrations/0248_wfm_time_exports_p22.sql');
const exportsP23 = read('supabase/migrations/0252_wfm_time_exports_p23.sql');
const policy = read('src/lib/wfm/wfmTimeExportPolicy.ts');
const payload = read('src/lib/wfm/wfmTimeExportPayloadBuilder.ts');
const screen = read('src/components/wfm/WfmExportScreen.tsx');
const panel = read('src/components/wfm/PayrollRelevantTimeBoundaryPanel.web.tsx');

test('Payroll boundary is immutable and keeps uncovered facts explicit', () => {
  const value = getBoundary();
  assert.ok(Object.isFrozen(value));
  assert.equal(value.approvedOnlyExport, 'required');
  assert.equal(value.plannedTimeAsPayrollFact, 'forbidden');
  assert.equal(value.surchargeCoverage, 'not_provided');
  assert.equal(value.microsecondOriginals, 'not_preserved');
  assert.throws(() => { value.reviewedWorkTime = 'complete'; }, TypeError);
  assert.strictEqual(getBoundary(), value);
});

test('Prepared time schema separates plan, work, travel, standby and correction facts', () => {
  const table = prepared.match(/CREATE TABLE IF NOT EXISTS public\.employee_time_entries \([\s\S]*?\n\);/)?.[0] ?? '';
  assert.match(table, /planned_minutes/);
  assert.match(table, /'travel_time'/);
  assert.match(table, /'standby_time'/);
  assert.match(table, /'correction_time'/);
  assert.match(prepared, /CREATE TABLE IF NOT EXISTS public\.travel_time_entries/);
});

test('Canonical review kinds do not fully cover travel, standby or surcharges', () => {
  const table = reviews.match(/CREATE TABLE IF NOT EXISTS public\.workforce_time_entry_reviews \([\s\S]*?\n\);/)?.[0] ?? '';
  assert.match(table, /'session', 'visit', 'manual', 'meeting'/);
  assert.doesNotMatch(table, /'travel'|'standby'|'surcharge'/);
});

test('Export policy requires approved and non-blocking review state', () => {
  assert.match(policy, /review\.reviewStatus !== 'approved'/);
  assert.match(policy, /if \(review\.exportBlocking\)/);
  assert.match(exportsP22, /CHECK \(review_status_at_export = 'approved'\)/);
});

test('Final export snapshot retains review and source references with a payload hash', () => {
  const table = exportsP22.match(/CREATE TABLE IF NOT EXISTS public\.workforce_time_export_items \([\s\S]*?\n\);/)?.[0] ?? '';
  for (const field of ['review_id', 'employee_id', 'reference_id', 'reference_key', 'exported_payload', 'payload_hash']) {
    assert.match(table, new RegExp(`\\b${field}\\b`));
  }
  for (const field of ['reviewId', 'employeeId', 'referenceKey', 'referenceId', 'entryKind', 'periodDate', 'minutesTotal']) {
    assert.match(payload, new RegExp(`\\b${field}\\b`));
  }
});

test('Correction export keeps an explicit supersede chain and immutable authenticated items', () => {
  assert.match(exportsP23, /logical_reference_key/);
  assert.match(exportsP23, /export_sequence/);
  assert.match(exportsP23, /supersedes_export_item_id/);
  assert.match(exportsP23, /superseded_by_export_item_id/);
  assert.match(exportsP23, /REVOKE UPDATE, DELETE ON public\.workforce_time_export_items FROM authenticated/);
});

test('Prepared database evidence is not treated as deployed proof', () => {
  assert.match(reviews, /ENTWURF/);
  assert.match(exportsP22, /ENTWURF/);
  assert.equal(getBoundary().deployedDatabaseEvidence, 'not_verified');
});

test('Web export surface exposes the boundary and keeps legacy session export blocked', () => {
  assert.match(screen, /<PayrollRelevantTimeBoundaryPanel \/>/);
  assert.match(screen, /Alt-Export gesperrt/);
  assert.match(screen, /frühere CSV\/PDF\/DATEV-Sitzungsexport ist aus Sicherheitsgründen deaktiviert/);
  assert.match(panel, /Lohnrelevante Zeiten · Nachweisgrenze/);
  assert.match(panel, /Fahrt- und Bereitschaftszeit sind nicht vollständig an den Review-Export gebunden/);
  for (const content of [source, panel]) {
    assert.doesNotMatch(content, /\b(?:fetch|insert|update|delete|upsert|rpc)\s*\(/);
    assert.doesNotMatch(content, /Date\.now|new Date|Math\.|setTimeout|setInterval/);
  }
});
