import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '../..');
const read = relative => fs.readFile(path.join(root, relative), 'utf8');

test('opening is an append-only native relation across tenant, stop, client and plan', async () => {
  const sql = await read('supabase/patches/ambulatory_care_stop_opening.sql');
  assert.match(sql, /CREATE TABLE IF NOT EXISTS public\.care_tour_stop_openings/);
  for (const field of ['tenant_id','tour_id','stop_id','client_id','care_plan_id','care_plan_version','opened_at']) assert.match(sql, new RegExp(`\\b${field}\\b`));
  assert.match(sql, /UNIQUE INDEX[\s\S]*care_tour_stop_openings_one_start[\s\S]*\(stop_id\)/);
  assert.doesNotMatch(sql, /UPDATE public\.care_tour_stop_openings|DELETE FROM public\.care_tour_stop_openings/);
});

test('read context requires arrived stop, running tour and authorized exact assignment', async () => {
  const sql = await read('supabase/patches/ambulatory_care_stop_opening.sql');
  assert.match(sql, /tr\.status<>'in_progress' OR s\.status<>'arrived'/);
  assert.match(sql, /public\.has_permission\('pflege\.plans\.manage'\)/);
  assert.match(sql, /p_tour\.employee_id IS NOT DISTINCT FROM public\.resolve_current_employee_id\(\)/);
});

test('context binds exactly one active plan valid on the planned service day', async () => {
  const sql = await read('supabase/patches/ambulatory_care_stop_opening.sql');
  assert.match(sql, /plan_count<>1/);
  assert.match(sql, /status IN\('active','aktiv'\)/);
  assert.match(sql, /valid_from<=tr\.tour_date/);
  assert.match(sql, /valid_until IS NULL OR valid_until>=tr\.tour_date/);
});

test('confirmation rejects stale stop, client or plan at native timestamp precision', async () => {
  const sql = await read('supabase/patches/ambulatory_care_stop_opening.sql');
  assert.match(sql, /s\.updated_at IS DISTINCT FROM p_expected_stop_updated_at/);
  assert.match(sql, /cl\.updated_at IS DISTINCT FROM p_expected_client_updated_at/);
  assert.match(sql, /p\.updated_at IS DISTINCT FROM p_expected_plan_updated_at/);
  assert.match(sql, /p\.version IS DISTINCT FROM p_plan_version/);
  assert.doesNotMatch(sql, /date_trunc|to_char\([^\n]*updated_at|::timestamp\(0\)/);
});

test('wrong client identity cannot start the stop', async () => {
  const sql = await read('supabase/patches/ambulatory_care_stop_opening.sql');
  assert.match(sql, /lower\(btrim\(cl\.last_name\)\) IS DISTINCT FROM lower\(btrim\(p_last_name\)\)/);
  assert.match(sql, /cl\.date_of_birth IS DISTINCT FROM p_date_of_birth/);
  assert.match(sql, /Identität stimmt nicht mit dem gebundenen Pflegefall überein/);
});

test('actual start is written only after identity and current-plan validation', async () => {
  const sql = await read('supabase/patches/ambulatory_care_stop_opening.sql');
  const identity = sql.indexOf('Identität stimmt nicht mit dem gebundenen Pflegefall überein');
  const plan = sql.indexOf('Pflegeplan wurde geändert. Einsatz erneut öffnen.');
  const actual = sql.indexOf("UPDATE public.care_tour_stops SET status='in_progress',actual_started_at=clock_timestamp()");
  assert.ok(identity > 0 && plan > identity && actual > plan);
  assert.match(sql, /opening_confirmed→in_progress/);
});

test('plan schedule and actual start remain separate stored values', async () => {
  const sql = await read('supabase/patches/ambulatory_care_stop_opening.sql');
  assert.match(sql, /'plannedStart',s\.planned_start,'plannedEnd',s\.planned_end/);
  assert.match(sql, /actual_started_at=clock_timestamp\(\)/);
  assert.doesNotMatch(sql, /actual_started_at\s*=\s*[^,\n]*planned_start/);
});

test('opening snapshot exposes supplied warnings without asserting absence of risk', async () => {
  const sql = await read('supabase/patches/ambulatory_care_stop_opening.sql');
  const web = await read('src/components/pflege/CareStopOpeningPanel.web.tsx');
  for (const field of ['allergies','visible_notes_for_employee','emergency_notes','risks','notes']) assert.match(sql, new RegExp(`\\b${field}\\b`));
  assert.match(web, /Das bedeutet nicht „keine Risiken“/);
  assert.doesNotMatch(web, /risikofrei|keine Allergien|unbedenklich/i);
});

test('Web and employee portal replace arrived direct start with the opening gate', async () => {
  const planning = await read('src/screens/pflege/CareTourPlanningScreen.tsx');
  const portal = await read('src/components/pflege/PortalCarePanels.tsx');
  const panel = await read('src/components/pflege/CareStopOpeningPanel.web.tsx');
  const service = await read('src/lib/pflege/careStopOpeningService.ts');
  assert.match(planning, /stop\.status === 'arrived' \? <><CareStopOpeningPanel/);
  assert.match(portal, /s\.status === 'arrived' \? <CareStopOpeningPanel/);
  assert.match(panel, /Identität bestätigen und Versorgung starten/);
  assert.match(service, /confirm_ambulatory_care_stop_opening/);
});

test('native interface keeps its preceding start action and no new database call', async () => {
  const native = await read('src/components/pflege/CareStopOpeningPanel.tsx');
  assert.match(native, /title="Versorgung starten"/);
  assert.match(native, /onPress=\{onNativeStart\}/);
  assert.doesNotMatch(native, /supabase|\.rpc\(|get_ambulatory|confirm_ambulatory/);
});

test('proof remains bound server-side to the trusted completed stop client', async () => {
  const workflow = await read('supabase/patches/ambulatory_care_tour_workflow.sql');
  const operations = await read('supabase/patches/ambulatory_care_operations.sql');
  assert.match(workflow, /public\.create_pfleger_service_proof\(r\.client_id/);
  assert.match(workflow, /'tourStopId',r\.id/);
  assert.match(operations, /client_id=s\.client_id/);
  assert.match(operations, /care_private\.create_stop_proof\(p_stop_id/);
});
