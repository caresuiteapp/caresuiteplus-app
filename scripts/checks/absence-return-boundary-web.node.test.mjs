import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes as strip } from 'node:module';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const root = fileURLToPath(new URL('../../', import.meta.url));
const read = path => readFileSync(join(root, path), 'utf8');
const source = read('src/lib/wfm/absenceReturnBoundary.web.ts');
const getBoundary = new Function(strip(source.replace(/^export type[\s\S]*?\n\}>;\n/m, '').replace(/\bexport /g, '')) + ';return getAbsenceReturnBoundaryWeb;')();
const wfmSchema = read('supabase/migrations/0190_wfm_foundation.sql');
const legacySchema = read('supabase/migrations/0051_employee_absences.sql');
const personnelSchema = read('supabase/migrations/0132_employee_personnel_file_prepared.sql');
const absenceService = read('src/lib/office/absenceService.ts');
const calendarSync = read('src/lib/calendar/calendarSyncService.ts');
const calendarRepository = read('src/lib/calendar/calendarEventRepository.ts');
const absenceSchedule = read('src/lib/office/absenceScheduleService.ts');
const portalProfile = read('src/lib/portal/clientProfileLiveService.ts');
const screen = read('src/components/wfm/WfmEmployeeRequestsOfficeScreen.tsx');
const panel = read('src/components/wfm/AbsenceReturnBoundaryPanel.web.tsx');

function extractFunction(text, name) {
  const start = text.indexOf(`export function ${name}`);
  assert.notEqual(start, -1, `${name} fehlt`);
  let depth = 0;
  let seenBody = false;
  for (let index = start; index < text.length; index += 1) {
    if (text[index] === '{') {
      depth += 1;
      seenBody = true;
    } else if (text[index] === '}') {
      depth -= 1;
      if (seenBody && depth === 0) return text.slice(start, index + 1);
    }
  }
  throw new Error(`${name} ist unvollständig`);
}

test('Absence-return boundary is immutable and does not infer return from an interval', () => {
  const value = getBoundary();
  assert.ok(Object.isFrozen(value));
  assert.equal(value.actualReturnEvidence, 'not_provided');
  assert.equal(value.deployabilityDecision, 'separate_snapshot_not_linked');
  assert.equal(value.clientPortalReasonDisclosure, 'forbidden');
  assert.throws(() => { value.actualReturnEvidence = 'provided'; }, TypeError);
  assert.strictEqual(getBoundary(), value);
});

test('Canonical WFM absence records decisions and intervals but no actual return or restrictions', () => {
  const table = wfmSchema.match(/CREATE TABLE IF NOT EXISTS public\.workforce_absences \([\s\S]*?\n\);/)?.[0] ?? '';
  for (const field of ['tenant_id', 'employee_id', 'absence_type', 'status', 'starts_at', 'ends_at', 'employee_note', 'internal_note']) {
    assert.match(table, new RegExp(`\\b${field}\\b`));
  }
  assert.doesNotMatch(table, /actual_returned_at|return_confirmed_by|fit_for_work|restriction_until|return_decision_id/);
});

test('Client absence projection dynamically strips every confidential reason field', () => {
  const fnText = extractFunction(absenceService, 'sanitizeForClientPortal');
  const sanitize = new Function(`${strip(fnText.replace(/^export /, ''))}; return sanitizeForClientPortal;`)();
  const input = {
    id: 'absence-1', tenantId: 'tenant-1', employeeId: 'employee-1', absenceType: 'sick_leave',
    status: 'approved', startsAt: '2026-10-01T00:00:00Z', endsAt: '2026-10-03T00:00:00Z', allDay: true,
    internalNotes: 'diagnosis', employeeVisibleNote: 'private employee reason', sickDetails: 'confidential',
    auDocumentId: 'au-1', certificateDocumentId: 'doc-1', replacementRequired: true, hideDetailsFromAdmin: false,
    requestedDays: 3, approvedBy: 'profile-1', approvedAt: '2026-09-20T10:00:00Z', rejectedBy: null,
    rejectedAt: null, rejectionReason: 'reason', cancelledAt: null, qualificationUpdated: false,
    createdBy: 'profile-2', updatedBy: 'profile-2', createdAt: '2026-09-20T09:00:00Z', updatedAt: '2026-09-20T10:00:00Z',
  };
  const output = sanitize(input);
  assert.deepEqual(output, {
    employeeId: 'employee-1',
    startsAt: '2026-10-01T00:00:00Z',
    endsAt: '2026-10-03T00:00:00Z',
    category: 'unavailable',
  });
  for (const secret of ['diagnosis', 'private employee reason', 'confidential', 'au-1', 'reason']) {
    assert.doesNotMatch(JSON.stringify(output), new RegExp(secret));
  }
});

test('Calendar absence sync cannot opt into client visibility by omission', () => {
  const builder = extractFunction(calendarSync, 'buildCalendarEventFromAbsence');
  assert.doesNotMatch(builder, /isClientPortalVisible:\s*true/);
  assert.match(calendarRepository, /is_client_portal_visible:\s*record\.isClientPortalVisible\s*\?\?\s*false/);
  assert.match(calendarRepository, /\.eq\('related_client_id', context\.clientId\)[\s\S]*?\.eq\('is_client_portal_visible', true\)/);
});

test('Planning projection exposes an absence label but no free-text reason', () => {
  const builder = extractFunction(absenceSchedule, 'buildAbsenceScheduleEntry');
  assert.match(builder, /title:\s*ABSENCE_TYPE_LABELS\[absence\.absenceType\]/);
  assert.doesNotMatch(builder, /internalNotes|employeeVisibleNote|sickDetails|rejectionReason|auDocumentId/);
});

test('Separate deployability snapshot is not a return decision or restriction history', () => {
  const table = personnelSchema.match(/CREATE TABLE IF NOT EXISTS public\.employee_assignment_eligibility \([\s\S]*?\n\);/)?.[0] ?? '';
  for (const field of ['employee_id', 'result', 'checked_at', 'not_absent', 'availability_ok', 'blockers_json']) {
    assert.match(table, new RegExp(`\\b${field}\\b`));
  }
  assert.doesNotMatch(table, /absence_id|actual_returned_at|return_confirmed_by|restriction_until|supersedes_id/);
});

test('Legacy audit rows are mutable tenant records and do not prove append-only return history', () => {
  const table = legacySchema.match(/CREATE TABLE IF NOT EXISTS public\.absence_audit_events \([\s\S]*?\n\);/)?.[0] ?? '';
  assert.match(table, /absence_id/);
  assert.match(table, /action/);
  assert.match(legacySchema, /CREATE POLICY absence_audit_events_tenant[\s\S]*?FOR ALL/);
  assert.doesNotMatch(legacySchema, /REVOKE UPDATE, DELETE ON public\.absence_audit_events FROM authenticated/);
});

test('Office surface states the boundary without adding a client query, write, or clock inference', () => {
  assert.match(screen, /<AbsenceReturnBoundaryPanel \/>/);
  assert.match(panel, /Abwesenheit und Rückkehr · Nachweisgrenze/);
  assert.match(panel, /belegen weder die tatsächliche Rückkehr noch uneingeschränkte Einsatzfähigkeit/);
  const portalTables = [...portalProfile.matchAll(/fromUnknownTable\(supabase,\s*'([^']+)'\)/g)].map(match => match[1]);
  assert.ok(portalTables.length > 0);
  assert.ok(!portalTables.includes('workforce_absences'));
  for (const content of [source, panel]) {
    assert.doesNotMatch(content, /\b(?:fetch|insert|update|delete|upsert|rpc)\s*\(/);
    assert.doesNotMatch(content, /Date\.now|new Date|Math\.|setTimeout|setInterval/);
  }
});
