import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { stripTypeScriptTypes } from 'node:module';

const root = path.resolve(import.meta.dirname, '../..');
const read = relative => fs.readFile(path.join(root, relative), 'utf8');

async function loadEvidence() {
  const source = await read('src/lib/pflege/careVisitPlanningEvidence.web.ts');
  const js = stripTypeScriptTypes(source, { mode: 'transform' });
  return import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}#${Date.now()}`);
}

test('delivered tour statuses stay immutable and are not converted into regular appointments', async () => {
  const { buildCareVisitPlanningEvidence } = await loadEvidence();
  const evidence = buildCareVisitPlanningEvidence([
    { status: 'draft', stops: [{ status: 'planned' }, { status: 'planned' }] },
    { status: 'published', stops: [{ status: 'planned' }] },
    { status: 'in_progress', stops: [{ status: 'arrived' }] },
    { status: 'unexpected', stops: [] },
  ]);
  assert.ok(Object.isFrozen(evidence) && Object.isFrozen(evidence.tourCounts));
  assert.deepEqual(evidence.tourCounts, { draft: 1, published: 1, inProgress: 1, completed: 0, cancelled: 0, unknown: 1 });
  assert.equal(evidence.stopCount, 4);
  assert.equal(evidence.regularAppointmentCount, null);
  assert.equal(evidence.actualCareInferred, false);
});

test('resource list and draft creation use module-active client scope, not dated admission scope', async () => {
  const sql = await read('supabase/patches/ambulatory_care_tour_workflow.sql');
  const resources = sql.match(/CREATE OR REPLACE FUNCTION care_private\.tour_resources\(\)[\s\S]*?END \$\$;/)?.[0] ?? '';
  const create = sql.match(/CREATE OR REPLACE FUNCTION care_private\.create_tour\(p_payload jsonb\)[\s\S]*?END \$\$;/)?.[0] ?? '';
  assert.match(resources, /public\.is_active_pfleger_client\(c\.id\)/);
  assert.match(create, /public\.is_active_pfleger_client\(id\)/);
  assert.doesNotMatch(resources, /care_admissions|tour_date|starts_on|ends_on/);
  assert.doesNotMatch(create, /care_admissions/);
});

test('module-active client predicate does not prove an active care admission', async () => {
  const sql = await read('supabase/migrations/20260808170000_premium_sis_pfleger_boundary.sql');
  const predicate = sql.match(/CREATE OR REPLACE FUNCTION public\.is_active_pfleger_client\([\s\S]*?\n\$\$;/)?.[0] ?? '';
  assert.match(predicate, /client_module_assignments/);
  assert.match(predicate, /c\.status = 'active'/);
  assert.doesNotMatch(predicate, /care_admissions|starts_on|ends_on/);
});

test('publishing is blocked without an active admission covering the tour date', async () => {
  const sql = await read('supabase/patches/ambulatory_care_operations.sql');
  const guard = sql.match(/CREATE OR REPLACE FUNCTION care_private\.guard_tour_operations\(\)[\s\S]*?END \$\$/)?.[0] ?? '';
  assert.match(guard, /NEW\.status IN\('published','in_progress'\)/);
  assert.match(guard, /a\.status='active'/);
  assert.match(guard, /a\.starts_on<=NEW\.tour_date/);
  assert.match(guard, /a\.ends_on IS NULL OR a\.ends_on>=NEW\.tour_date/);
  assert.match(guard, /freigegebene Aufnahme im Versorgungszeitraum/);
});

test('starting a visit is blocked when care is paused, ended or not released', async () => {
  const sql = await read('supabase/patches/ambulatory_care_operations.sql');
  const guard = sql.match(/CREATE OR REPLACE FUNCTION care_private\.guard_stop_operations\(\)[\s\S]*?END \$\$/)?.[0] ?? '';
  assert.match(guard, /NEW\.status='in_progress'/);
  assert.match(guard, /a\.status='active'/);
  assert.match(guard, /Versorgung ist pausiert, beendet oder noch nicht freigegeben/);
});

test('publishing also requires released shift coverage and rejects collisions', async () => {
  const operations = await read('supabase/patches/ambulatory_care_operations.sql');
  const workflow = await read('supabase/patches/ambulatory_care_tour_workflow.sql');
  assert.match(operations, /check_staff_planning/);
  assert.match(operations, /status IN\('published','confirmed'\)/);
  assert.match(operations, /außerhalb geplanter Pausen/);
  assert.match(workflow, /Pflegekraft hat einen überlappenden Einsatz in einer anderen Tour/);
});

test('stop contract has time window and free summary but no bound need frequency or plan version', async () => {
  const workflow = await read('src/lib/pflege/careTourWorkflow.ts');
  const stop = workflow.match(/stops: \{([^}]*)\}\[\];/)?.[1] ?? '';
  assert.match(stop, /clientId/);
  assert.match(stop, /plannedStart/);
  assert.match(stop, /plannedEnd/);
  assert.match(stop, /serviceSummary/);
  assert.doesNotMatch(stop, /need|frequency|serviceTypeId|carePlanVersion/);
});

test('visible Web/Desktop boundary is integrated without query write or native behaviour change', async () => {
  const screen = await read('src/screens/pflege/CareTourPlanningScreen.tsx');
  const web = await read('src/components/pflege/CareVisitPlanningEvidencePanel.web.tsx');
  const native = await read('src/components/pflege/CareVisitPlanningEvidencePanel.tsx');
  assert.match(screen, /<CareVisitPlanningEvidencePanel tours=\{tours\} \/>/);
  assert.match(web, /Entwurf ist kein regulärer Besuchstermin/);
  assert.match(web, /Unterbrechung vor Freigabe nicht vollständig gebunden/);
  assert.doesNotMatch(web, /supabase|\.from\(|\.rpc\(|useAsyncQuery|Date\.now|new Date/);
  assert.match(native, /return null/);
});
