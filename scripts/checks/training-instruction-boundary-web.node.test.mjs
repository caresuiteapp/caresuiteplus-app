import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes as strip } from 'node:module';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const root = fileURLToPath(new URL('../../', import.meta.url));
const read = path => readFileSync(join(root, path), 'utf8');
const source = read('src/lib/training/trainingInstructionBoundary.web.ts');
const getBoundary = new Function(strip(source.replace(/^export type[\s\S]*?\n\}>;\n/m, '').replace(/\bexport /g, '')) + ';return getTrainingInstructionBoundaryWeb;')();
const types = read('src/types/modules/training.ts');
const migration = read('supabase/migrations/0139_training_management_prepared.sql');
const service = read('src/lib/training/trainingService.ts');
const requirements = read('src/lib/training/trainingRequirementsRegistry.ts');
const screen = read('src/screens/office/TrainingManagementScreen.tsx');
const panel = read('src/components/office/TrainingInstructionBoundaryPanel.web.tsx');

test('Instruction boundary is immutable and forbids competence inference', () => {
  const value = getBoundary();
  assert.ok(Object.isFrozen(value));
  assert.equal(value.topicAndParticipantRelation, 'provided');
  assert.equal(value.participationImpliesCompetence, 'forbidden');
  assert.equal(value.trainingCompletionReleasesConcreteActivity, 'not_verifiable');
  assert.throws(() => { value.participationImpliesCompetence = 'allowed'; }, TypeError);
  assert.strictEqual(getBoundary(), value);
});

test('Training records provide person and timestamps but no device, version or participant confirmation', () => {
  const table = migration.match(/CREATE TABLE IF NOT EXISTS public\.employee_training_records \([\s\S]*?\n\);/)?.[0] ?? '';
  for (const field of ['employee_id', 'course_id', 'started_at', 'completed_at', 'passed_at', 'valid_until', 'proof_document_id', 'verified_by', 'verified_at']) assert.match(table, new RegExp(field));
  assert.doesNotMatch(table, /device_id|device_version|instruction_version|participant_confirmed_at|participant_signature|competence_assessment_id/);
});

test('Course contract provides a topic but no instructed device identity or version', () => {
  const table = migration.match(/CREATE TABLE IF NOT EXISTS public\.training_courses \([\s\S]*?\n\);/)?.[0] ?? '';
  for (const field of ['course_key', 'title', 'description', 'training_type_group', 'validity_months']) assert.match(table, new RegExp(field));
  assert.doesNotMatch(table, /device_id|manufacturer|serial_number|instruction_version|revision_id/);
  assert.match(types, /export type TrainingCourse/);
});

test('Completion may record result and proof id but creates no separate competence decision', () => {
  const complete = service.match(/export async function completeTrainingRecord\([\s\S]*?\n\}/)?.[0] ?? '';
  assert.match(complete, /scorePercent/);
  assert.match(complete, /proofDocumentId/);
  assert.match(complete, /status: course\.requiresQuiz/);
  assert.match(complete, /training_completed/);
  assert.doesNotMatch(complete, /competence|activityId|serviceType|deviceId|participantConfirmation/);
});

test('Deployment requirements are role, module and job based, not concrete activity or device based', () => {
  assert.match(requirements, /roleKey/);
  assert.match(requirements, /moduleKeys/);
  assert.match(requirements, /jobTitle/);
  assert.doesNotMatch(requirements, /activityId|serviceType|deviceId|deviceVersion|competenceDecision/);
});

test('Audit rows are declared but database immutability is not enforced', () => {
  const auditTable = migration.match(/CREATE TABLE IF NOT EXISTS public\.training_audit_events \([\s\S]*?\n\);/)?.[0] ?? '';
  assert.match(auditTable, /action/);
  assert.match(auditTable, /actor_id/);
  assert.match(auditTable, /created_at/);
  assert.doesNotMatch(migration, /REVOKE (?:UPDATE|DELETE)[\s\S]*training_audit_events|training_audit_events[\s\S]*BEFORE (?:UPDATE|DELETE)[\s\S]*RAISE EXCEPTION/i);
});

test('Proof relation remains an identifier and does not verify an original document', () => {
  assert.match(types, /proofDocumentId: string \| null/);
  const deployability = service.match(/export function evaluateEmployeeTrainingDeployability\([\s\S]*?\n\}\n\nexport async function/)?.[0] ?? '';
  assert.match(deployability, /requiresProof/);
  assert.match(deployability, /verificationStatus/);
  assert.doesNotMatch(deployability, /storagePath|createSignedUrl|documentHash|originalDocument/);
});

test('Visible training view states the incomplete evidence boundary without writes', () => {
  assert.match(screen, /<TrainingInstructionBoundaryPanel \/>/);
  assert.match(panel, /Einarbeitung und Einweisung · Nachweisgrenze/);
  assert.match(panel, /Teilnahme, Abschluss oder Quiz-Ergebnis dürfen nicht als gesonderte Kompetenzfeststellung/);
  for (const content of [source, panel]) {
    assert.doesNotMatch(content, /\b(?:fetch|insert|update|delete|upsert|rpc)\s*\(/);
    assert.doesNotMatch(content, /Date\.now|new Date|Math\.|setTimeout|setInterval/);
  }
});
