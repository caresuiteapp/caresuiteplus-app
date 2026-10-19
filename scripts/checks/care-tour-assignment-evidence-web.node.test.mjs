import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { stripTypeScriptTypes } from 'node:module';

const root = path.resolve(import.meta.dirname, '../..');
const read = relative => fs.readFile(path.join(root, relative), 'utf8');

async function loadEvidence() {
  const source = await read('src/lib/pflege/careTourAssignmentEvidence.web.ts');
  const js = stripTypeScriptTypes(source, { mode: 'transform' });
  return import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}#${Date.now()}`);
}

test('assignment boundary is immutable and never treats distance as suitability', async () => {
  const { getCareTourAssignmentEvidence } = await loadEvidence();
  const evidence = getCareTourAssignmentEvidence();
  assert.ok(Object.isFrozen(evidence) && Object.isFrozen(evidence.missingEvidence));
  assert.equal(evidence.distanceOptimization, 'not_present_in_care_tour_path');
  assert.equal(evidence.distanceMayProveSuitability, false);
  assert.equal(evidence.automaticAssignmentRelease, false);
  assert.strictEqual(getCareTourAssignmentEvidence(), evidence);
});

test('care tour input binds one employee while stops contain no second-person relation', async () => {
  const workflow = await read('src/lib/pflege/careTourWorkflow.ts');
  const input = workflow.match(/export type CareTourInput = \{[\s\S]*?\n\};/)?.[0] ?? '';
  assert.match(input, /employeeId: string/);
  assert.match(input, /stops: \{/);
  assert.doesNotMatch(input, /secondEmployeeId|employeeIds|doubleStaffing|staffingReason/);
});

test('prepared tour creation checks active Pflege employee but not visit-specific qualification', async () => {
  const sql = await read('supabase/patches/ambulatory_care_tour_workflow.sql');
  const create = sql.match(/CREATE OR REPLACE FUNCTION care_private\.create_tour\(p_payload jsonb\)[\s\S]*?END \$\$;/)?.[0] ?? '';
  assert.match(create, /status::text='active'/);
  assert.match(create, /'pfleger'=ANY\(allowed_products::text\[\]\)/);
  assert.match(create, /employee_name_snapshot/);
  assert.doesNotMatch(create, /qualification_requirement|service_qualification|qualification_id|competency_id/);
});

test('prepared publication guards one employee against overlap and requires shift coverage', async () => {
  const workflow = await read('supabase/patches/ambulatory_care_tour_workflow.sql');
  const operations = await read('supabase/patches/ambulatory_care_operations.sql');
  assert.match(workflow, /other\.employee_id=r\.employee_id/);
  assert.match(workflow, /Pflegekraft hat einen überlappenden Einsatz in einer anderen Tour/);
  assert.match(operations, /care_private\.check_staff_planning/);
  assert.match(operations, /status IN\('published','confirmed'\)/);
  assert.doesNotMatch(workflow + operations, /second_employee_id|tour_staff|double_staff|staffing_reason/);
});

test('care-tour stop contract does not bind travel capacity or access requirements', async () => {
  const service = await read('src/lib/pflege/careTourPlanningService.ts');
  const stop = service.match(/export type CareTourStop = \{[\s\S]*?\n\};/)?.[0] ?? '';
  assert.match(stop, /plannedStart/);
  assert.match(stop, /plannedEnd/);
  assert.match(stop, /serviceSummary/);
  assert.doesNotMatch(stop, /travel|capacity|accessRequirement|keyRequirement|doubleStaff/);
});

test('resource qualification is a display label and is not submitted as assignment evidence', async () => {
  const service = await read('src/lib/pflege/careTourPlanningService.ts');
  const screen = await read('src/screens/pflege/CareTourPlanningScreen.tsx');
  assert.match(service, /qualification: string/);
  assert.match(screen, /detail: e\.qualification/);
  const save = screen.match(/function save\(\)[\s\S]*?\n  \}/)?.[0] ?? '';
  assert.match(save, /createCareTour/);
  assert.doesNotMatch(save, /qualification|competency|doubleStaff/);
});

test('separate replacement scorer hard-gates one candidate qualification before travel score but reserves no pair', async () => {
  const route = await read('src/lib/assist/routePlanningService.ts');
  const suggestions = route.match(/export function buildReplacementSuggestions\([\s\S]*?\n\}/)?.[0] ?? '';
  assert.match(suggestions, /!qualification\.data\.qualificationOk[\s\S]*?continue/);
  assert.match(suggestions, /if \(travelMinutes <= 20\) score \+= 10/);
  assert.doesNotMatch(suggestions, /secondEmployeeId|reserveBoth|bothQualified/);
});

test('visible Web/Desktop boundary is integrated without query write or native behaviour change', async () => {
  const screen = await read('src/screens/pflege/CareTourPlanningScreen.tsx');
  const web = await read('src/components/pflege/CareTourAssignmentEvidencePanel.web.tsx');
  const native = await read('src/components/pflege/CareTourAssignmentEvidencePanel.tsx');
  assert.match(screen, /<CareTourAssignmentEvidencePanel \/>/);
  assert.match(web, /Kurze Strecke ist keine Einsatzfreigabe/);
  assert.match(web, /Doppelbesetzung nicht reserviert/);
  assert.doesNotMatch(web, /supabase|\.from\(|\.rpc\(|useAsyncQuery|Date\.now|new Date/);
  assert.match(native, /return null/);
});
