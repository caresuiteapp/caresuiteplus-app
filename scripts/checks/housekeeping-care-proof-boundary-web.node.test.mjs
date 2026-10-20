import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes as strip } from 'node:module';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const root = fileURLToPath(new URL('../../', import.meta.url));
const read = path => readFileSync(join(root, path), 'utf8');
const source = read('src/lib/assist/housekeepingCareProofBoundary.web.ts');
const getBoundary = new Function(strip(source.replace(/^export type[\s\S]*?\n\}>;\n/m, '').replace(/\bexport /g, '')) + ';return getHousekeepingCareProofBoundaryWeb;')();
const serviceAreas = read('src/types/assistServiceCatalog/serviceAreas.ts');
const serviceCategoryValidation = read('src/lib/assistServiceCatalog/categoryValidationService.ts');
const assistTaskGuard = read('src/lib/assist/assistTaskGuardService.ts');
const mapper = read('src/lib/assist/assistTaskCategoryMapper.ts');
const assistMigration = read('supabase/migrations/0156_assist_execution_persistence.sql');
const careMigration = read('supabase/migrations/20260812193000_pfleger_proofs_billing_acceptance_live_r1.sql');
const persistence = read('src/lib/assist/assistVisitProofPersistenceService.ts');
const panel = read('src/components/assist/ProofReviewWorkspace.web.tsx');

test('Boundary is immutable and denies Assist-to-care proof promotion', () => {
  const value = getBoundary();
  assert.ok(Object.isFrozen(value));
  assert.deepEqual(Reflect.ownKeys(value), [
    'capability', 'serviceAreaMeaning', 'taskIdentityMeaning', 'plannedAssignmentMeaning',
    'assistVisitProofMeaning', 'nursingProofCreation', 'treatmentProofCreation',
    'proofPromotion', 'actualCareExecutionProof', 'sourceQuality',
  ]);
  assert.equal(value.capability, 'assist_housekeeping_proof_is_not_care_or_treatment_proof');
  assert.equal(value.plannedAssignmentMeaning, 'not_actual_execution_proof');
  assert.equal(value.assistVisitProofMeaning, 'assist_service_evidence_only');
  assert.equal(value.proofPromotion, 'forbidden_without_distinct_native_care_execution');
  assert.equal(value.actualCareExecutionProof, 'not_verifiable_from_assist_record');
  assert.throws(() => { value.proofPromotion = 'allowed'; }, TypeError);
  assert.strictEqual(getBoundary(), value);
});

test('Housekeeping is an Assist area while the service-category medical guard gap stays explicit', () => {
  assert.match(serviceAreas, /\| 'hauswirtschaft'/);
  assert.match(serviceAreas, /hauswirtschaft: 'Hauswirtschaft'/);
  for (const token of ['pflegeleistung', 'behandlungspflege', 'grundpflege', 'medikament', 'wundversorgung']) {
    assert.match(serviceAreas, new RegExp(`'${token}'`));
  }
  assert.match(assistTaskGuard, /ASSIST_FORBIDDEN_TASK_KEYWORDS/);
  assert.match(assistTaskGuard, /ASSIST_MEDICAL_CARE_KEYWORDS/);
  assert.doesNotMatch(serviceCategoryValidation, /category\s*===\s*['"]hauswirtschaft['"]/);
  assert.match(serviceCategoryValidation, /case 'hauswirtschaft':\s*return 'hauswirtschaft'/);
});

test('Housekeeping task mapping remains household work rather than a clinical task category', () => {
  assert.match(mapper, /case 'hauswirtschaft':\s*return 'haushalt'/);
  assert.doesNotMatch(mapper, /case 'hauswirtschaft':[\s\S]{0,80}return '(?:pflege|behandlungspflege|grundpflege)'/);
});

test('Assist proof has its own visit identity and does not reference a care proof', () => {
  const table = assistMigration.match(/CREATE TABLE IF NOT EXISTS public\.assist_visit_proofs \(([\s\S]*?)\n\);/)?.[1] ?? '';
  assert.ok(table.length > 500);
  assert.match(table, /tenant_id\s+UUID\s+NOT NULL/);
  assert.match(table, /visit_id\s+UUID\s+NOT NULL REFERENCES public\.assist_visits/);
  assert.match(table, /payload_snapshot\s+JSONB\s+NOT NULL/);
  assert.doesNotMatch(table, /pfleger_service_proof|treatment_execution|care_documentation_entry/i);
});

test('Native care proof requires a distinct care table, permission and execution payload', () => {
  assert.match(careMigration, /CREATE TABLE IF NOT EXISTS public\.pfleger_service_proofs/);
  assert.match(careMigration, /public\.has_permission\('pflege\.proofs\.create'\)/);
  assert.match(careMigration, /Leistungsart, Rechtsgrundlage und Durchführungsnachweis sind erforderlich/);
  assert.match(careMigration, /employee_profile_id UUID/);
  assert.match(careMigration, /started_at TIMESTAMPTZ NOT NULL/);
  assert.match(careMigration, /ended_at TIMESTAMPTZ NOT NULL/);
});

test('Assist proof persistence never writes the native care proof table or RPC', () => {
  assert.match(persistence, /ASSIST_EXECUTION_TABLES\.proofs/);
  assert.doesNotMatch(persistence, /pfleger_service_proofs|create_pfleger_service_proof|structured_treatment_executions/);
});

test('Visible review boundary states that Assist evidence is not care execution', () => {
  assert.match(panel, /Abgrenzung Hauswirtschaft \/ Pflege/);
  assert.match(panel, /Assist-Einsatz und Assist-Leistungsnachweis bleiben Nachweise für Hauswirtschaft oder Alltagshilfe/);
  assert.match(panel, /keinen Grundpflege- oder Behandlungspflegenachweis/);
  assert.match(panel, /eigenständige native Pflegedurchführung erforderlich/);
});

test('Boundary display has no query, write, clock or inferred completion', () => {
  const visibleBoundary = panel.match(/<div className="pr-alert" role="note">([\s\S]*?)\n    <\/div>\n    \{error/)?.[1] ?? '';
  assert.ok(visibleBoundary.length > 200);
  for (const content of [source, visibleBoundary]) {
    assert.doesNotMatch(content, /\b(?:fetch|insert|update|delete|upsert|rpc)\s*\(/);
    assert.doesNotMatch(content, /Date\.now|new Date|Math\.|setTimeout|setInterval/);
  }
  assert.doesNotMatch(source, /status\s*[:=]\s*['"](?:completed|approved|released)['"]/);
});
