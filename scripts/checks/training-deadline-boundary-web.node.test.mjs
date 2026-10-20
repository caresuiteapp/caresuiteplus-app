import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes as strip } from 'node:module';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const root = fileURLToPath(new URL('../../', import.meta.url));
const read = path => readFileSync(join(root, path), 'utf8');
const source = read('src/lib/training/trainingDeadlineBoundary.web.ts');
const getBoundary = new Function(strip(source.replace(/^export type[\s\S]*?\n\}>;\n/m, '').replace(/\bexport /g, '')) + ';return getTrainingDeadlineBoundaryWeb;')();
const migration = read('supabase/migrations/0139_training_management_prepared.sql');
const service = read('src/lib/training/trainingService.ts');
const statusService = read('src/lib/training/trainingStatusService.ts');
const screen = read('src/screens/office/TrainingManagementScreen.tsx');
const panel = read('src/components/office/TrainingDeadlineBoundaryPanel.web.tsx');

test('Deadline boundary is immutable and forbids completion inference', () => {
  const value = getBoundary();
  assert.ok(Object.isFrozen(value));
  assert.equal(value.reminderAcknowledgementCompletesRequirement, 'forbidden');
  assert.equal(value.assignmentCompletionProvesParticipation, 'forbidden');
  assert.throws(() => { value.livePersistence = 'ready'; }, TypeError);
  assert.strictEqual(getBoundary(), value);
});

test('Prepared schema separates requirement, assignment, record, certificate and reminder', () => {
  for (const table of ['training_requirements', 'training_assignments', 'employee_training_records', 'employee_certificates', 'training_reminders']) {
    assert.match(migration, new RegExp(`CREATE TABLE IF NOT EXISTS public\\.${table} \\(`));
  }
  assert.match(migration, /Nicht produktiv bis Remote-Apply \+ Backfill/);
});

test('Assignment deadline and completion status carry no participation evidence', () => {
  const table = migration.match(/CREATE TABLE IF NOT EXISTS public\.training_assignments \([\s\S]*?\n\);/)?.[0] ?? '';
  for (const field of ['employee_id', 'course_id', 'assigned_by', 'due_at', 'status']) assert.match(table, new RegExp(field));
  assert.match(table, /'open', 'completed', 'cancelled'/);
  assert.doesNotMatch(table, /attended_at|participation_confirmed_at|proof_document_id|completion_evidence_id/);
});

test('Training record distinguishes times and proof id but does not retain an original proof', () => {
  const table = migration.match(/CREATE TABLE IF NOT EXISTS public\.employee_training_records \([\s\S]*?\n\);/)?.[0] ?? '';
  for (const field of ['assigned_at', 'started_at', 'completed_at', 'passed_at', 'valid_until', 'proof_document_id', 'verified_at']) assert.match(table, new RegExp(field));
  assert.doesNotMatch(table, /proof_sha256|proof_storage_version|proof_original_bytes|participation_event_id/);
});

test('Completion derives validity from the processing clock and a coarse month conversion', () => {
  const complete = service.match(/export async function completeTrainingRecord\([\s\S]*?\n\}/)?.[0] ?? '';
  assert.match(complete, /new Date\(Date\.now\(\) \+ course\.validityMonths \* 30 \* 86_400_000\)/);
  assert.doesNotMatch(complete, /sourceValidUntil|validityDecisionId|originalValidityRule|microseconds/);
});

test('Reminder acknowledgement is not a fulfillment or certificate decision', () => {
  const table = migration.match(/CREATE TABLE IF NOT EXISTS public\.training_reminders \([\s\S]*?\n\);/)?.[0] ?? '';
  assert.match(table, /acknowledged_at/);
  assert.match(table, /admin_task_created/);
  assert.doesNotMatch(table, /fulfilled_at|certificate_id|participation_confirmed_at/);
  assert.doesNotMatch(service.match(/export function refreshTrainingReminders[\s\S]*?\n\}/)?.[0] ?? '', /appendTrainingAuditEvent/);
});

test('Expiry calculation does not preserve microsecond chronology or original agreement', () => {
  assert.match(statusService, /new Date\(isoDate\)\.getTime\(\)/);
  assert.match(statusService, /Math\.ceil\(diff \/ 86_400_000\)/);
  assert.doesNotMatch(statusService, /BigInt|Temporal|originalAgreement|history/);
});

test('Declared audit table is not an append-only requirement history', () => {
  const audit = migration.match(/CREATE TABLE IF NOT EXISTS public\.training_audit_events \([\s\S]*?\n\);/)?.[0] ?? '';
  assert.match(audit, /action/);
  assert.match(audit, /metadata/);
  assert.doesNotMatch(migration, /REVOKE (?:UPDATE|DELETE)[\s\S]*training_audit_events|training_audit_events[\s\S]*BEFORE (?:UPDATE|DELETE)[\s\S]*RAISE EXCEPTION/i);
});

test('Visible training view states the deadline boundary without writes or clock inference', () => {
  assert.match(screen, /<TrainingDeadlineBoundaryPanel \/>/);
  assert.match(panel, /Fortbildung und Fristen · Nachweisgrenze/);
  assert.match(panel, /Zuweisung, Termin, Erinnerung oder deren Bestätigung schließen keine Pflicht/);
  for (const content of [source, panel]) {
    assert.doesNotMatch(content, /\b(?:fetch|insert|update|delete|upsert|rpc)\s*\(/);
    assert.doesNotMatch(content, /Date\.now|new Date|Math\.|setTimeout|setInterval/);
  }
});
