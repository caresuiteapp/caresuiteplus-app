import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes as strip } from 'node:module';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const root = fileURLToPath(new URL('../../', import.meta.url));
const read = path => readFileSync(join(root, path), 'utf8');
const source = read('src/lib/assist/doubleStaffingBoundary.web.ts');
const getBoundary = new Function(strip(source.replace(/^export type[\s\S]*?\n\}>;\n/m, '').replace(/\bexport /g, '')) + ';return getDoubleStaffingBoundaryWeb;')();
const assignmentTypes = read('src/types/modules/assignmentWorkflow.ts');
const routeTypes = read('src/types/modules/routePlanning.ts');
const routeService = read('src/lib/assist/routePlanningService.ts');
const visitSchema = read('supabase/migrations/0116_assist_visits_disposition.sql');
const screen = read('src/screens/assist/ToursReplacementScreen.tsx');
const panel = read('src/components/assist/DoubleStaffingBoundaryPanel.web.tsx');

test('Double-staffing boundary is immutable and forbids inference from two names', () => {
  const value = getBoundary();
  assert.ok(Object.isFrozen(value));
  assert.equal(value.primaryEmployeeRelation, 'provided_single');
  assert.equal(value.twoNamesImplyDoubleStaffing, 'forbidden');
  assert.equal(value.completeDoubleStaffingReservation, 'not_verifiable');
  assert.throws(() => { value.atomicReservationOfBothPeople = 'provided'; }, TypeError);
  assert.strictEqual(getBoundary(), value);
});

test('Assignment workflow binds one employee to one planned interval', () => {
  const record = assignmentTypes.match(/export type AssignmentWorkflowRecord = \{[\s\S]*?\n\};/)?.[0] ?? '';
  assert.match(record, /employeeId: string \| null/);
  assert.match(record, /plannedStartAt: string/);
  assert.match(record, /plannedEndAt: string/);
  assert.doesNotMatch(record, /secondEmployeeId|employeeIds|staffingReason|doubleStaffing/);
});

test('Native assist visit schema has one employee and no double-staffing relation', () => {
  const table = visitSchema.match(/CREATE TABLE IF NOT EXISTS public\.assist_visits \([\s\S]*?\n\);/)?.[0] ?? '';
  assert.match(table, /employee_id[\s\S]*REFERENCES public\.employees/);
  assert.match(table, /planned_start_at/);
  assert.match(table, /planned_end_at/);
  assert.doesNotMatch(table, /second_employee_id|employee_ids|assist_visit_staff|double_staff|staffing_reason/);
});

test('Route plan is owned by one employee and items do not add a second person', () => {
  const plan = routeTypes.match(/export type RoutePlan = [\s\S]*?\n\};/)?.[0] ?? '';
  const item = routeTypes.match(/export type RoutePlanItem = [\s\S]*?\n\};/)?.[0] ?? '';
  assert.match(plan, /employeeId: string/);
  assert.match(item, /assignmentId: string/);
  assert.doesNotMatch(plan + item, /secondEmployeeId|employeeIds|staffingReason/);
});

test('Overlap check prevents double-booking of one candidate but does not reserve a pair', () => {
  const suggestions = routeService.match(/export function buildReplacementSuggestions\([\s\S]*?\n\}\n/)?.[0] ?? '';
  assert.match(suggestions, /const doubleBooked = existing\.some/);
  assert.match(suggestions, /a\.employeeId === employeeId/);
  assert.match(suggestions, /if \(doubleBooked\) continue/);
  assert.doesNotMatch(suggestions, /secondEmployeeId|reserveBoth|employeeIds/);
});

test('Replacement suggestion is an alternative single employee, not a second assignment', () => {
  const suggestion = routeTypes.match(/export type ReplacementSuggestion = [\s\S]*?\n\};/)?.[0] ?? '';
  assert.match(suggestion, /originalEmployeeId: string/);
  assert.match(suggestion, /suggestedEmployeeId: string/);
  assert.doesNotMatch(suggestion, /coAssigned|secondEmployeeId|simultaneousReservation/);
});

test('Suitability check is executed for a candidate only, not independently for a reserved pair', () => {
  const suggestions = routeService.match(/export function buildReplacementSuggestions\([\s\S]*?\n\}\n/)?.[0] ?? '';
  assert.match(suggestions, /checkEmployeeQualificationForAssignment\([\s\S]*?employeeId/);
  assert.match(suggestions, /checkEmployeeAvailabilityForPlanning\([\s\S]*?employeeId/);
  assert.doesNotMatch(suggestions, /primaryQualification|secondaryQualification|bothQualified/);
});

test('Visible route view states the incomplete double-staffing boundary without writes', () => {
  assert.match(screen, /<DoubleStaffingBoundaryPanel \/>/);
  assert.match(panel, /Doppelte Besetzung · Nachweisgrenze/);
  assert.match(panel, /Zwei parallele Einzelpläne dürfen nicht still als gemeinsamer Einsatz gelten/);
  for (const content of [source, panel]) {
    assert.doesNotMatch(content, /\b(?:fetch|insert|update|delete|upsert|rpc)\s*\(/);
    assert.doesNotMatch(content, /Date\.now|new Date|Math\.|setTimeout|setInterval/);
  }
});
