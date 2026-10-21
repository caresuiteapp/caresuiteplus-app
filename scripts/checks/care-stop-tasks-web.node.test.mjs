import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '../..');
const read = relative => fs.readFile(path.join(root, relative), 'utf8');
const sqlFile = 'supabase/patches/ambulatory_care_stop_tasks.sql';

test('opening freezes the complete native plan item identity before actual work', async () => {
  const opening = await read('supabase/patches/ambulatory_care_stop_opening.sql');
  assert.match(opening, /plan_items_snapshot jsonb NOT NULL/);
  for (const field of ['id','updatedAt','title','intervention','frequency','timing','responsibleRole','warningSigns','escalationPath']) assert.match(opening, new RegExp(`'${field}'`));
  assert.match(opening, /INSERT INTO public\.care_tour_stop_openings[\s\S]*plan_items_snapshot[\s\S]*plan_items/);
});

test('task bindings retain original identities without a deletable live item foreign key', async () => {
  const sql = await read(sqlFile);
  for (const field of ['opening_id','care_plan_id','care_plan_version','plan_item_id','plan_item_updated_at','planned_task_snapshot']) assert.match(sql, new RegExp(`\\b${field}\\b`));
  assert.doesNotMatch(sql, /plan_item_id uuid[^\n]*REFERENCES public\.care_plan_items/);
  assert.match(sql, /care_stop_task_bindings_item_unique[\s\S]*stop_id,plan_item_id/);
});

test('preparation copies only the immutable opening snapshot and verifies completeness', async () => {
  const sql = await read(sqlFile);
  assert.match(sql, /jsonb_array_elements\(o\.plan_items_snapshot\)/);
  assert.doesNotMatch(sql, /prepare_stop_tasks[\s\S]{0,4000}FROM public\.care_plan_items/);
  assert.match(sql, /actual_count<>expected_count[\s\S]*Planaufgabenbindung ist unvollständig/);
});

test('an outcome cannot be stored as a bare check mark', async () => {
  const sql = await read(sqlFile);
  assert.match(sql, /result_detail text NOT NULL CHECK \(length\(btrim\(result_detail\)\) BETWEEN 5 AND 4000\)/);
  assert.match(sql, /outcome IN \('performed','not_performed','refused'\)/);
  assert.match(sql, /has_deviation OR outcome<>'performed'/);
});

test('non-performance and deviations require a reason while normal performance rejects one', async () => {
  const sql = await read(sqlFile);
  assert.match(sql, /p_outcome<>'performed'[\s\S]*p_deviation_reason/);
  assert.match(sql, /NOT COALESCE\(p_has_deviation,false\) AND p_outcome='performed'/);
});

test('execution is append-only, one original per binding, and never changes the care plan', async () => {
  const sql = await read(sqlFile);
  assert.match(sql, /care_stop_task_executions_binding_unique[\s\S]*binding_id/);
  assert.doesNotMatch(sql, /UPDATE public\.care_tour_stop_task_(bindings|executions)|DELETE FROM public\.care_tour_stop_task_(bindings|executions)/);
  assert.doesNotMatch(sql, /UPDATE public\.care_plan_items|UPDATE public\.care_plans/);
});

test('same request and fingerprint are idempotent but changed or foreign reuse is rejected', async () => {
  const sql = await read(sqlFile);
  assert.match(sql, /care_stop_task_executions_request_unique[\s\S]*tenant_id,stop_id,client_request_id/);
  assert.match(sql, /existing\.recorded_by IS DISTINCT FROM auth\.uid\(\) OR existing\.request_fingerprint IS DISTINCT FROM fingerprint/);
  assert.match(sql, /'duplicate',true/);
});

test('execution is constrained to an open stop with an actual non-ended time trail', async () => {
  const sql = await read(sqlFile);
  assert.match(sql, /tr\.status<>'in_progress' OR s\.status<>'in_progress'/);
  assert.match(sql, /care_tour_stop_time_events[\s\S]*event_kind<>'correction'/);
  assert.match(sql, /last_kind IS NULL OR last_kind='end'/);
});

test('server supplies actor and microsecond-capable event time', async () => {
  const sql = await read(sqlFile);
  assert.match(sql, /actual_time:=clock_timestamp\(\)/);
  assert.match(sql, /recorded_by,recorded_by_name,recorded_at\)[\s\S]*auth\.uid\(\),actor_name,actual_time/);
  assert.doesNotMatch(sql, /p_recorded_at|p_recorded_by/);
});

test('tables expose no direct authenticated writes and only the RPC surface is granted', async () => {
  const sql = await read(sqlFile);
  assert.match(sql, /ENABLE ROW LEVEL SECURITY/);
  assert.match(sql, /REVOKE ALL ON public\.care_tour_stop_task_bindings,public\.care_tour_stop_task_executions FROM PUBLIC,anon,authenticated/);
  assert.doesNotMatch(sql, /GRANT (SELECT|INSERT|UPDATE|DELETE) ON public\.care_tour_stop_task/);
  assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.[\s\S]*record_ambulatory_care_stop_task_execution/);
});

test('Web and employee portal share the detailed task panel while native stays unchanged', async () => {
  const planning = await read('src/screens/pflege/CareTourPlanningScreen.tsx'); const portal = await read('src/components/pflege/PortalCarePanels.tsx');
  assert.match(planning, /<CareStopTasksPanel/); assert.match(portal, /<CareStopTasksPanel/);
  const native = await read('src/components/pflege/CareStopTasksPanel.tsx');
  assert.match(native, /return null/); assert.doesNotMatch(native, /supabase|\.rpc\(|PremiumButton/);
});

test('Web retries retain a frozen request and payload instead of producing a new identity', async () => {
  const panel = await read('src/components/pflege/CareStopTasksPanel.web.tsx');
  assert.match(panel, /pending\.current\[bindingId\] = \{ bindingId, \.\.\.checked\.data, requestId: newCareStopTaskRequestId\(\) \}/);
  assert.match(panel, /const frozen = pending\.current\[bindingId\]/);
  assert.match(panel, /Unveränderte Anfrage erneut senden/);
});

test('domain validation normalizes details and distinguishes outcomes from deviations', async () => {
  let source = await read('src/lib/pflege/careStopTaskDomain.ts');
  source = source.replace(/^import.*$/m, '').replace(/^export type .*$/gm, '');
  const js = source.replace('export function validateCareStopTaskDraft(input: CareStopTaskDraft): { ok: true; data: ValidCareStopTaskDraft } | { ok: false; error: string } {', 'function validateCareStopTaskDraft(input) {');
  const validate = new Function(`${js}; return validateCareStopTaskDraft;`)();
  assert.equal(validate({ outcome: '', resultDetail: 'detail', hasDeviation: false, deviationReason: '', observation: '' }).ok, false);
  assert.equal(validate({ outcome: 'performed', resultDetail: ' ok ', hasDeviation: false, deviationReason: '', observation: '' }).ok, false);
  assert.equal(validate({ outcome: 'not_performed', resultDetail: 'Nicht erfolgt', hasDeviation: false, deviationReason: '', observation: '' }).ok, false);
  const good = validate({ outcome: 'performed', resultDetail: '  Fachlich erfolgt  ', hasDeviation: false, deviationReason: '', observation: '  stabil  ' });
  assert.deepEqual(good, { ok: true, data: { outcome: 'performed', resultDetail: 'Fachlich erfolgt', hasDeviation: false, deviationReason: '', observation: 'stabil' } });
});
