import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes as strip } from 'node:module';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const root = fileURLToPath(new URL('../../', import.meta.url));
const read = path => readFileSync(join(root, path), 'utf8');
const source = read('src/lib/office/employeeQualificationBoundary.web.ts');
const getBoundary = new Function(strip(source.replace(/^export type[\s\S]*?\n\}>;\n/m, '').replace(/\bexport /g, '')) + ';return getEmployeeQualificationBoundaryWeb;')();
const qualificationSource = read('src/lib/office/employeeQualificationService.ts');
const qualificationModule = new Function(
  'QUALIFICATION_EXPIRY_WARNING_DAYS',
  strip(qualificationSource.replace(/^import[\s\S]*?;\n/gm, '').replace(/\bexport /g, '')) +
    ';return {computeQualificationStatus, hasRequiredQualifications};',
)(30);
const schema = read('supabase/migrations/0215_employee_personnel_documents_repair.sql');
const loader = read('src/lib/office/employeePersonnelFileLiveLoader.ts');
const routePlanning = read('src/lib/assist/routePlanningService.ts');
const legacyReplacement = read('src/lib/office/replacementPlanningService.ts');
const personnelPanel = read('src/components/office/EmployeePersonnelFilePanel.tsx');
const boundaryPanel = read('src/components/office/EmployeeQualificationBoundaryPanel.web.tsx');

test('Qualification boundary is immutable and forbids competence inference', () => {
  const value = getBoundary();
  assert.ok(Object.isFrozen(value));
  assert.equal(value.nativeQualificationRows, 'provided');
  assert.equal(value.expiredEvidenceCanBeTreatedAsValid, 'forbidden');
  assert.equal(value.currentStatusImpliesActivityCompetence, 'forbidden');
  assert.equal(value.completeAutomaticAssignmentRelease, 'not_verifiable');
  assert.throws(() => { value.completeAutomaticAssignmentRelease = 'verified'; }, TypeError);
  assert.strictEqual(getBoundary(), value);
});

test('Qualification dates and verification reject expired required evidence', () => {
  const reference = new Date('2026-10-12T12:00:00.000Z');
  const base = { qualificationType: 'first_aid', validUntil: '2026-10-11', verifiedAt: '2026-01-02T10:00:00Z', status: 'valid' };
  assert.equal(qualificationModule.computeQualificationStatus(base, reference), 'expired');
  assert.deepEqual(qualificationModule.hasRequiredQualifications([base], ['first_aid'], reference), { ok: false, missing: ['first_aid'] });
  assert.equal(qualificationModule.computeQualificationStatus({ ...base, validUntil: '2026-12-31', verifiedAt: null }, reference), 'pending_review');
});

test('Native rows carry current proof metadata but no activity-specific or append-only history relation', () => {
  const table = schema.match(/CREATE TABLE IF NOT EXISTS public\.employee_qualifications \([\s\S]*?\n\);/)?.[0] ?? '';
  for (const field of ['qualification_type', 'issued_at', 'valid_until', 'document_id', 'verified_by', 'verified_at', 'status']) assert.match(table, new RegExp(field));
  assert.doesNotMatch(table, /activity_id|service_type|competence_scope|valid_from|supersedes_id|previous_id|revision/);
  assert.doesNotMatch(schema, /employee_qualification_(?:history|events|revisions)/);
});

test('Live loader reads the qualification identifier and dates without loading document originals', () => {
  const load = loader.match(/async function loadEmployeeQualifications\([\s\S]*?\n\}/)?.[0] ?? '';
  assert.match(load, /employee_qualifications/);
  assert.match(load, /qualification_type, title, issuing_organization, issued_at, valid_until, document_id, verified_by, verified_at, status/);
  assert.doesNotMatch(load, /employee_documents|storage_path|download|createSignedUrl/);
});

test('Primary route suggestions exclude every candidate without an accepted qualification result', () => {
  const suggestions = routePlanning.match(/export function buildReplacementSuggestions\([\s\S]*?\n\}/)?.[0] ?? '';
  assert.match(suggestions, /checkEmployeeQualificationForAssignment/);
  assert.match(suggestions, /!qualification\.data\?\.assignable/);
  assert.match(suggestions, /!qualification\.data\.qualificationOk/);
  assert.match(suggestions, /continue;/);
});

test('Qualification check derives expiry from native personnel records but has no activity relation', () => {
  const check = routePlanning.match(/export function checkEmployeeQualificationForAssignment\([\s\S]*?\n\}/)?.[0] ?? '';
  assert.match(check, /getEmployeePersonnelFileForAssignmentCheck/);
  assert.match(check, /qualifications: file\.qualifications/);
  assert.match(check, /qualificationOk: deployability\.qualificationOk/);
  assert.doesNotMatch(check, /serviceType\s*===|requiredQualification|activityId|competenceScope/);
});

test('Legacy replacement suggestions remain a static mapping without native expiry proof', () => {
  assert.match(legacyReplacement, /const EMPLOYEE_QUALIFICATIONS: Record<string, string>/);
  const suggestions = legacyReplacement.match(/export function suggestReplacementEmployees\([\s\S]*?\n\}/)?.[0] ?? '';
  assert.match(suggestions, /EMPLOYEE_QUALIFICATIONS\[employeeId\]/);
  assert.doesNotMatch(suggestions, /employee_qualifications|validUntil|valid_until|verifiedAt|documentId/);
});

test('Visible qualification view states the incomplete automatic-assignment evidence boundary without writes', () => {
  assert.match(personnelPanel, /<EmployeeQualificationBoundaryPanel \/>/);
  assert.match(boundaryPanel, /Qualifikationen und Einsatzfreigabe · Nachweisgrenze/);
  assert.match(boundaryPanel, /Abgelaufene Nachweise dürfen nicht als passende automatische Zuordnung verwendet werden/);
  assert.match(boundaryPanel, /weiterer statischer Vertretungspfad/);
  for (const content of [source, boundaryPanel]) {
    assert.doesNotMatch(content, /\b(?:fetch|insert|update|delete|upsert|rpc)\s*\(/);
    assert.doesNotMatch(content, /Date\.now|new Date|Math\.|setTimeout|setInterval/);
  }
});
