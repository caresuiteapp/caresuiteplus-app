import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';

const root = new URL('../../', import.meta.url);
const read = file => readFileSync(new URL(file, root), 'utf8');
const compile = file => stripTypeScriptTypes(read(file)
  .replace(/^import[\s\S]*?from .*?;\n/gm, '').replace(/\bexport /g, ''));
const repositorySource = compile('src/lib/office/continuity/clientCareContinuityRepository.supabase.web.ts');
const workflowSource = compile('src/lib/office/continuity/clientCareContinuityWorkflow.web.ts');
const sql = read('supabase/migrations/20261015111500_client_service_continuity.sql');
const screen = read('src/screens/office/ClientCareContinuityScreen.web.tsx');
const webRoute = read('app/office/clients/[id]/offboarding.web.tsx');

const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const time = n => `2026-10-15T${String(n).padStart(2, '0')}:00:00.123456+00:00`;
const row = patch => ({
  id: id(10), request_id: id(11), tenant_id: id(1), client_id: id(2), actor_profile_id: id(3),
  kind: 'hospital', reason: 'Bestätigter stationärer Aufenthalt', planned_start_at: time(10), planned_end_at: time(20),
  actual_start_at: time(11), actual_end_at: null, end_reason: null, status: 'active', affected_visit_count: 3,
  affected_tour_stop_count: 2, blocked_started_visit_count: 1, client_updated_at: time(9), created_at: time(11), updated_at: time(11), ...patch,
});

function repositoryEnvironment(controls = {}) {
  const calls = []; let current;
  const db = { async rpc(name, args) {
    const call = { name, args: structuredClone(args) }; calls.push(call); await controls.before?.(call, env);
    if (controls.error) return { data: null, error: { message: 'transport', code: 'ERR' } };
    let data = name === 'web_read_client_service_continuity'
      ? { client_name: 'Klara Beleg', client_updated_at: time(9), active: row(), history: [row()] }
      : row(name === 'web_end_client_service_interruption' ? { status: 'ended', actual_end_at: args.p_actual_end_at, end_reason: args.p_end_reason, updated_at: time(22) } : {});
    data = controls.mutate?.(structuredClone(data), call) ?? data;
    return { data, error: null };
  } };
  current = db;
  const functions = new Function('getSupabaseClient', `${repositorySource};return {readClientServiceContinuity,beginClientServiceInterruption,confirmClientServiceInterruption,endClientServiceInterruption,clientServiceContinuityInternals};`)(() => current);
  const env = { calls, functions, setCurrent(value) { current = value; } };
  return env;
}

test('liest nur eine vollständig gebundene native Verlaufssicht', async () => {
  const e = repositoryEnvironment(); const result = await e.functions.readClientServiceContinuity(id(1), id(2), id(3));
  assert.equal(result.ok, true); assert.equal(result.data.active.requestId, id(11)); assert.equal(result.data.history.length, 1);
  assert.deepEqual(e.calls[0], { name: 'web_read_client_service_continuity', args: { p_tenant_id: id(1), p_client_id: id(2), p_actor_profile_id: id(3) } });
});

for (const [label, mutate] of [
  ['fremder Mandant', data => ({ ...data, active: row({ tenant_id: id(9) }) })],
  ['fremde Person', data => ({ ...data, history: [row({ client_id: id(9) })] })],
  ['negative Anzahl', data => ({ ...data, active: row({ affected_visit_count: -1 }) })],
  ['unvollständige Mikrosekundenzeit', data => ({ ...data, active: row({ updated_at: '2026-10-15' }) })],
  ['beendet ohne Rückkehrgrund', data => ({ ...data, active: row({ status: 'ended', actual_end_at: time(20) }) })],
]) test(`verwirft ${label} in der nativen Übersicht`, async () => {
  const e = repositoryEnvironment({ mutate }); assert.equal((await e.functions.readClientServiceContinuity(id(1), id(2), id(3))).ok, false);
});

test('erfasst vor Await das ganze Startoriginal und verlangt dieselbe Quittung', async () => {
  const input = { tenantId: id(1), clientId: id(2), actorId: id(3), requestId: id(11), expectedClientUpdatedAt: time(9),
    kind: 'hospital', reason: 'Bestätigter stationärer Aufenthalt', plannedStartAt: time(10), plannedEndAt: time(20), actualStartAt: time(11) };
  const e = repositoryEnvironment({ before: () => { input.reason = 'nachträglich verändert'; } });
  const result = await e.functions.beginClientServiceInterruption(input); assert.equal(result.ok, true);
  assert.equal(e.calls[0].args.p_reason, 'Bestätigter stationärer Aufenthalt');
  assert.equal(e.calls[0].args.p_request_id, id(11));
});

for (const patch of [
  { requestId: 'bad' }, { reason: 'kurz' }, { plannedStartAt: '2026-10-15' }, { actualStartAt: '' }, { actorId: 'kein-uuid' },
]) test('sendet kein unvollständiges Startoriginal', async () => {
  const e = repositoryEnvironment(); const input = { tenantId: id(1), clientId: id(2), actorId: id(3), requestId: id(11), expectedClientUpdatedAt: time(9),
    kind: 'hospital', reason: 'Bestätigter stationärer Aufenthalt', plannedStartAt: time(10), plannedEndAt: null, actualStartAt: time(11), ...patch };
  assert.equal((await e.functions.beginClientServiceInterruption(input)).ok, false); assert.equal(e.calls.length, 0);
});

test('Sitzungswechsel nach Transport entwertet die Antwort', async () => {
  const e = repositoryEnvironment({ before: () => e.setCurrent({ rpc: async () => ({ data: null, error: null }) }) });
  assert.equal((await e.functions.confirmClientServiceInterruption({ tenantId: id(1), clientId: id(2), actorId: id(3), requestId: id(11) })).ok, false);
});

test('Rückkehr akzeptiert nur beendeten exakt gebundenen Originalvorgang', async () => {
  const e = repositoryEnvironment(); const result = await e.functions.endClientServiceInterruption({ tenantId: id(1), clientId: id(2), actorId: id(3), interruptionId: id(10),
    endRequestId: id(12), expectedUpdatedAt: time(11), actualEndAt: time(20), endReason: 'Rückkehr fachlich bestätigt' });
  assert.equal(result.ok, true); assert.equal(result.data.status, 'ended'); assert.equal(e.calls[0].args.p_end_request_id, id(12));
  const wrong = repositoryEnvironment({ mutate: data => ({ ...data, id: id(99) }) });
  assert.equal((await wrong.functions.endClientServiceInterruption({ tenantId: id(1), clientId: id(2), actorId: id(3), interruptionId: id(10),
    endRequestId: id(12), expectedUpdatedAt: time(11), actualEndAt: time(20), endReason: 'Rückkehr fachlich bestätigt' })).ok, false);
});

function workflowEnvironment(controls = {}) {
  const values = new Map(); const storage = { setItem(k, v) { if (controls.failWrite) throw Error('quota'); values.set(k, v); }, getItem: k => values.get(k) ?? null, removeItem: k => values.delete(k) };
  const starts = [], ends = [], confirms = [];
  const begin = async original => { starts.push(structuredClone(original)); await controls.beforeStart?.(original); return controls.startResult ?? { ok: true, data: row() }; };
  const end = async original => { ends.push(structuredClone(original)); return controls.endResult ?? { ok: true, data: row({ id: original.interruptionId, status: 'ended', actual_end_at: original.actualEndAt, end_reason: original.endReason }) }; };
  const confirm = async original => { confirms.push(structuredClone(original)); return controls.confirmResult ?? { ok: true, data: row({ id: original.requestId }) }; };
  const functions = new Function('window','beginClientServiceInterruption','confirmClientServiceInterruption','endClientServiceInterruption',
    `${workflowSource};return {startInterruptionDurably,endInterruptionDurably,recoverInterruptionJournal,clientCareContinuityJournal};`)({ localStorage: storage }, begin, confirm, end);
  return { values, starts, ends, confirms, functions };
}

test('persistiert das unveränderte Startoriginal zwingend vor dem ersten Write', async () => {
  let journalBeforeWrite = false; const e = workflowEnvironment({ beforeStart: () => { journalBeforeWrite = e.values.size === 1; } });
  const original = { tenantId: id(1), clientId: id(2), actorId: id(3), requestId: id(11), expectedClientUpdatedAt: time(9), kind: 'hospital',
    reason: 'Bestätigter stationärer Aufenthalt', plannedStartAt: time(10), plannedEndAt: null, actualStartAt: time(11) };
  assert.equal((await e.functions.startInterruptionDurably(original)).ok, true); assert.equal(journalBeforeWrite, true); assert.equal(e.values.size, 0);
});

test('sendet ohne dauerhaftes Versandjournal überhaupt nicht', async () => {
  const e = workflowEnvironment({ failWrite: true }); const result = await e.functions.startInterruptionDurably({ tenantId: id(1), clientId: id(2), actorId: id(3), requestId: id(11),
    expectedClientUpdatedAt: time(9), kind: 'hospital', reason: 'Bestätigter stationärer Aufenthalt', plannedStartAt: time(10), plannedEndAt: null, actualStartAt: time(11) });
  assert.equal(result.ok, false); assert.equal(e.starts.length, 0);
});

test('behält ein ungeklärtes Startjournal und klärt reload ausschließlich lesend auf', async () => {
  const e = workflowEnvironment({ startResult: { ok: false, error: 'transport' } }); const original = { tenantId: id(1), clientId: id(2), actorId: id(3), requestId: id(11),
    expectedClientUpdatedAt: time(9), kind: 'hospital', reason: 'Bestätigter stationärer Aufenthalt', plannedStartAt: time(10), plannedEndAt: null, actualStartAt: time(11) };
  assert.equal((await e.functions.startInterruptionDurably(original)).ok, false); assert.equal(e.values.size, 1);
  assert.equal((await e.functions.recoverInterruptionJournal(id(1), id(2), id(3))).ok, true); assert.equal(e.confirms.length, 1); assert.equal(e.starts.length, 1); assert.equal(e.values.size, 0);
});

test('fremder Akteur kann ein lokales Journal weder bestätigen noch wiederholen', async () => {
  const e = workflowEnvironment({ startResult: { ok: false, error: 'transport' } }); const original = { tenantId: id(1), clientId: id(2), actorId: id(3), requestId: id(11),
    expectedClientUpdatedAt: time(9), kind: 'hospital', reason: 'Bestätigter stationärer Aufenthalt', plannedStartAt: time(10), plannedEndAt: null, actualStartAt: time(11) };
  await e.functions.startInterruptionDurably(original); const recovered = await e.functions.recoverInterruptionJournal(id(1), id(2), id(4));
  assert.equal(recovered.ok, false); assert.equal(e.confirms.length, 0); assert.equal(e.values.size, 1);
});

test('Rückkehrjournal verlangt denselben tatsächlichen Endzeitpunkt und Grund', async () => {
  const endOriginal = { tenantId: id(1), clientId: id(2), actorId: id(3), interruptionId: id(10), requestId: id(11), endRequestId: id(12), expectedUpdatedAt: time(11), actualEndAt: time(20), endReason: 'Rückkehr fachlich bestätigt' };
  const e = workflowEnvironment({ endResult: { ok: false, error: 'transport' }, confirmResult: { ok: true, data: row({ id: id(10), request_id: id(11), status: 'ended', actual_end_at: time(20), end_reason: 'anderer Grund' }) } });
  await e.functions.endInterruptionDurably(endOriginal); const recovered = await e.functions.recoverInterruptionJournal(id(1), id(2), id(3));
  assert.equal(recovered.ok, false); assert.equal(e.values.size, 1); assert.equal(e.ends.length, 1); assert.equal(e.confirms[0].requestId, id(11));
});

test('SQL-Vertrag trennt Plan, tatsächliches Ereignis, Originale und append-only Verlauf', () => {
  for (const token of ['planned_start_at TIMESTAMPTZ','actual_start_at TIMESTAMPTZ','actual_end_at TIMESTAMPTZ','visit_originals JSONB','visit_results JSONB','client_service_interruption_events']) assert.match(sql, new RegExp(token));
  assert.match(sql, /REVOKE ALL ON TABLE public\.client_service_interruptions, public\.client_service_interruption_events/);
  assert.doesNotMatch(sql, /DELETE FROM public\.(assist_visits|care_tour_stops|clients)/);
});

test('SQL stoppt ausschließlich nicht begonnene künftige Einsätze und schreibt tatsächliche Zeiten nie um', () => {
  assert.match(sql, /v\.actual_start_at IS NULL/); assert.match(sql, /SET execution_status='cancelled',canonical_status='cancelled'/);
  assert.match(sql, /lower\(v\.execution_status\) NOT IN \('completed','finished','closed','ended','cancelled','canceled','rejected'\)/);
  const update = sql.match(/UPDATE public\.assist_visits[\s\S]*?;/)?.[0] ?? '';
  assert.doesNotMatch(update, /actual_start_at\s*=|actual_end_at\s*=|planned_start_at\s*=/);
});

test('SQL authentifiziert erneut, sperrt je Mandant und Akte und macht Request-IDs idempotent', () => {
  assert.ok((sql.match(/client_continuity_private\.authorize\(p_tenant_id,p_actor_profile_id\)/g) ?? []).length >= 5);
  assert.match(sql, /auth\.sessions/); assert.match(sql, /pg_advisory_xact_lock\(hashtextextended\('client-continuity:'\|\|p_tenant_id::TEXT\|\|':'\|\|p_client_id::TEXT,0\)\)/);
  assert.match(sql, /request_id UUID NOT NULL UNIQUE/); assert.match(sql, /end_request_id UUID UNIQUE/);
});

test('Rückkehr erzeugt keine Einsätze neu und bestätigt keinen Austritt', () => {
  const end = sql.match(/CREATE OR REPLACE FUNCTION client_continuity_private\.end_interruption[\s\S]*?\n\$\$;/)?.[0] ?? '';
  assert.doesNotMatch(end, /INSERT INTO public\.(assist_visits|care_tour_stops)/); assert.doesNotMatch(end, /UPDATE public\.clients/);
  assert.match(end, /'automatic_replanning',FALSE/); assert.doesNotMatch(sql, /status='deceased'/);
});

test('Webweg zeigt Unterbrechung, Rückkehr und getrennten endgültigen Austritt aktiv an', () => {
  assert.match(webRoute, /ClientCareContinuityScreen/); assert.match(screen, /Unterbrechung und Rückkehr/); assert.match(screen, /Endgültiger Austritt \/ Kündigung/);
  assert.match(screen, /startInterruptionDurably/); assert.match(screen, /endInterruptionDurably/); assert.match(screen, /ClientOffboardingScreen/);
  assert.match(screen, /Tod wird niemals abgeleitet/); assert.match(screen, /Keine stillschweigende Neuplanung/);
});

