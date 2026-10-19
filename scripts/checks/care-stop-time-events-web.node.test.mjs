import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '../..');
const read = relative => fs.readFile(path.join(root, relative), 'utf8');
const sqlFile = 'supabase/patches/ambulatory_care_stop_time_events.sql';

test('actual stop times use an append-only native event ledger', async () => {
  const sql = await read(sqlFile);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS public\.care_tour_stop_time_events/);
  for (const field of ['tenant_id','tour_id','stop_id','client_id','event_kind','location_context','occurred_at']) assert.match(sql, new RegExp(`\\b${field}\\b`));
  assert.doesNotMatch(sql, /UPDATE public\.care_tour_stop_time_events|DELETE FROM public\.care_tour_stop_time_events/);
});

test('request identity makes an exact retry idempotent and rejects changed reuse', async () => {
  const sql = await read(sqlFile);
  assert.match(sql, /care_stop_time_events_request_unique[\s\S]*tenant_id,stop_id,client_request_id/);
  assert.match(sql, /existing\.request_fingerprint IS DISTINCT FROM fingerprint/);
  assert.match(sql, /'duplicate',true/);
  assert.match(sql, /Ereignisanfrage wurde bereits mit anderen Angaben verwendet/);
});

test('start and end are unique while pause and resume follow the locked actual state', async () => {
  const sql = await read(sqlFile);
  assert.match(sql, /care_stop_time_events_one_start[\s\S]*event_kind='start'/);
  assert.match(sql, /care_stop_time_events_one_end[\s\S]*event_kind='end'/);
  assert.match(sql, /p_event_kind='pause'[\s\S]*last_kind NOT IN\('start','resume'\)/);
  assert.match(sql, /p_event_kind='resume'[\s\S]*last_kind<>'pause'/);
  assert.match(sql, /p_event_kind='end'[\s\S]*last_kind NOT IN\('start','resume'\)/);
});

test('actual event time comes from the server and never from plan time or client payload', async () => {
  const sql = await read(sqlFile);
  assert.match(sql, /actual_time:=clock_timestamp\(\)/);
  assert.match(sql, /occurred_at\)\s*\n\+? VALUES\([\s\S]*actual_time\)/);
  assert.doesNotMatch(sql, /p_occurred_at|planned_start[^\n]*occurred_at|planned_end[^\n]*occurred_at/);
});

test('stale native stop precision is rejected without truncation', async () => {
  const sql = await read(sqlFile);
  assert.match(sql, /s\.updated_at IS DISTINCT FROM p_expected_stop_updated_at/);
  assert.doesNotMatch(sql, /date_trunc|to_char\([^\n]*updated_at|::timestamp\(0\)/);
});

test('location context is preserved but manual text is not represented as verified GPS', async () => {
  const sql = await read(sqlFile); const service = await read('src/lib/pflege/careStopTimeService.ts'); const panel = await read('src/components/pflege/CareStopTimePanel.web.tsx');
  assert.match(sql, /jsonb_typeof\(location_context\)='object'/);
  assert.match(service, /captureMode: 'manual'/);
  assert.match(panel, /keine GPS-Bestätigung/);
  assert.doesNotMatch(panel, /GPS bestätigt|Standort verifiziert/);
});

test('opening and unchanged native status paths receive exact start and end events', async () => {
  const sql = await read(sqlFile); const opening = await read('supabase/patches/ambulatory_care_stop_opening.sql');
  assert.match(sql, /BEFORE UPDATE OF actual_started_at,actual_ended_at/);
  assert.match(sql, /NEW\.actual_started_at/); assert.match(sql, /NEW\.actual_ended_at/);
  assert.match(opening, /actual_started_at=clock_timestamp\(\)/);
});

test('first actual times are immutable at the stop even after later status transitions', async () => {
  const sql = await read(sqlFile);
  assert.match(sql, /NEW\.actual_started_at:=OLD\.actual_started_at/);
  assert.match(sql, /NEW\.actual_ended_at:=OLD\.actual_ended_at/);
});

test('correction appends its own reason and target without rewriting the original', async () => {
  const sql = await read(sqlFile);
  for (const field of ['corrects_event_id','corrected_occurred_at','correction_reason']) assert.match(sql, new RegExp(`\\b${field}\\b`));
  assert.match(sql, /target\.event_kind='correction'/);
  assert.match(sql, /INSERT INTO public\.care_tour_stop_time_events[\s\S]*'correction'/);
  assert.doesNotMatch(sql, /UPDATE public\.care_tour_stop_time_events/);
});

test('plan times, actual events, corrections and documentation remain separate', async () => {
  const sql = await read(sqlFile); const workflow = await read('supabase/patches/ambulatory_care_tour_workflow.sql');
  assert.match(sql, /'plannedStart',s\.planned_start,'plannedEnd',s\.planned_end/);
  assert.doesNotMatch(sql, /create_clinical_documentation|create_pfleger_service_proof|approved|released/);
  assert.match(workflow, /create_clinical_documentation/);
});

test('Web and employee portal expose pause resume and end controls', async () => {
  const planning = await read('src/screens/pflege/CareTourPlanningScreen.tsx'); const portal = await read('src/components/pflege/PortalCarePanels.tsx'); const panel = await read('src/components/pflege/CareStopTimePanel.web.tsx');
  assert.match(planning, /<CareStopTimePanel/); assert.match(portal, /<CareStopTimePanel/);
  for (const label of ['Pause beginnen','Versorgung fortsetzen','Versorgungszeit beenden']) assert.match(panel, new RegExp(label));
});

test('native component leaves the established Android interface untouched', async () => {
  const native = await read('src/components/pflege/CareStopTimePanel.tsx');
  assert.match(native, /return null/);
  assert.doesNotMatch(native, /supabase|\.rpc\(|PremiumButton|get_ambulatory|record_ambulatory/);
});

test('database surface is read-only and writes are RPC-only', async () => {
  const sql = await read(sqlFile);
  assert.match(sql, /ENABLE ROW LEVEL SECURITY/);
  assert.match(sql, /REVOKE ALL ON public\.care_tour_stop_time_events FROM PUBLIC,anon,authenticated/);
  assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.get_ambulatory_care_stop_time_context/);
  assert.doesNotMatch(sql, /GRANT (INSERT|UPDATE|DELETE) ON public\.care_tour_stop_time_events/);
});
