import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';

const root = new URL('../../', import.meta.url);
const read = file => readFileSync(new URL(file, root), 'utf8');
const compile = file => stripTypeScriptTypes(read(file).replace(/^import[\s\S]*?from .*?;\n/gm, '').replace(/\bexport /g, ''));
const repositorySource = compile('src/lib/clients/clientClinicalHistoryRepository.supabase.web.ts');
const workflowSource = compile('src/lib/clients/clientClinicalHistoryWorkflow.web.ts');
const sql = read('supabase/patches/ambulatory_client_clinical_history.sql');
const screen = read('src/screens/office/ClientClinicalHistoryScreen.web.tsx');
const panel = read('src/screens/business/office/ClientRecordDiagnosisNotesPanel.web.tsx');
const route = read('app/office/clients/[id]/clinical-history.web.tsx');
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const time = n => `2026-10-15T${String(n).padStart(2, '0')}:00:00.123456+00:00`;
const entry = patch => ({ id: id(10), request_id: id(11), tenant_id: id(1), client_id: id(2), kind: 'diagnosis', clinical_code: 'I10', clinical_text: 'Arterieller Hypertoniehinweis', source_type: 'Arztbrief', source_reference: 'Dokument 42', clinical_date: '2026-10-01', date_meaning: 'diagnosed_on', verification: 'confirmed', record_state: 'active', revision: 1, supersedes_id: null, recorded_by_profile_id: id(3), recorded_by_name: 'Fachkraft Eins', created_at: time(10), updated_at: time(10), legacy_origin: null, ...patch });
const legacy = patch => ({ origin_kind: 'client_allergies', origin_id: id(2), origin_updated_at: time(9), display_label: 'Älterer Allergiehinweis', display_text: 'Penicillin unklar', original: { field: 'allergies', value: 'Penicillin unklar', client_updated_at: time(9) }, linked_entry_id: null, ...patch });

function repositoryEnvironment(controls = {}) {
  const calls = []; let current;
  const db = { async rpc(name, args) {
    calls.push({ name, args: structuredClone(args) }); await controls.before?.(name, args, env);
    if (controls.error) return { data: null, error: { message: 'transport' } };
    let data = name === 'web_read_client_clinical_history'
      ? { client_name: 'Klara Beleg', client_updated_at: time(9), current: [entry({})], history: [entry({})], legacy_candidates: [] }
      : entry({ request_id: args.p_request_id, legacy_origin: args.p_payload?.legacy_origin ?? null });
    data = controls.mutate?.(structuredClone(data), name, args) ?? data;
    return { data, error: null };
  } };
  current = db;
  const functions = new Function('getSupabaseClient', `${repositorySource};return {readClientClinicalHistory,recordClientClinicalHistory,confirmClientClinicalHistoryWrite,clientClinicalHistoryInternals};`)(() => current);
  const env = { calls, functions, setCurrent(value) { current = value; } };
  return env;
}

test('liefert nur vollständig gebundene strukturierte Originale', async () => {
  const e = repositoryEnvironment(); const result = await e.functions.readClientClinicalHistory(id(1), id(2), id(3));
  assert.equal(result.ok, true); assert.equal(result.data.current[0].clinicalCode, 'I10'); assert.equal(result.data.diagnosesState, 'present');
  assert.equal(result.data.allergiesState, 'unknown'); assert.equal(e.calls[0].name, 'web_read_client_clinical_history');
});

test('leerer gelieferter Bestand bleibt für Diagnosen und Allergien sichtbar unbekannt', async () => {
  const e = repositoryEnvironment({ mutate: data => ({ ...data, current: [], history: [], legacy_candidates: [] }) }); const result = await e.functions.readClientClinicalHistory(id(1), id(2), id(3));
  assert.equal(result.ok, true); assert.equal(result.data.diagnosesState, 'unknown'); assert.equal(result.data.allergiesState, 'unknown');
  assert.equal(Object.hasOwn(result.data, 'diagnosisFree'), false); assert.equal(Object.hasOwn(result.data, 'allergyFree'), false);
});

for (const [label, mutate] of [
  ['fremder Mandant', data => ({ ...data, current: [entry({ tenant_id: id(9) })] })],
  ['fremde Person', data => ({ ...data, history: [entry({ client_id: id(9) })] })],
  ['unbekannte Art', data => ({ ...data, current: [entry({ kind: 'none' })], history: [entry({ kind: 'none' })] })],
  ['unvollständige Mikrosekundenzeit', data => ({ ...data, current: [entry({ updated_at: '2026-10-15' })], history: [entry({ updated_at: '2026-10-15' })] })],
  ['Datum ohne Bedeutung', data => ({ ...data, current: [entry({ date_meaning: 'unknown' })], history: [entry({ date_meaning: 'unknown' })] })],
  ['aktuelle Fassung fehlt in Historie', data => ({ ...data, history: [entry({ id: id(99) })] })],
  ['fremdes Altoriginal', data => ({ ...data, legacy_candidates: [legacy({ origin_id: id(9) })] })],
  ['Altoriginal mit unbekannter Art', data => ({ ...data, legacy_candidates: [legacy({ origin_kind: 'heuristic_merge' })] })],
  ['Altoriginal ohne vollständiges JSON', data => ({ ...data, legacy_candidates: [legacy({ original: 'text' })] })],
  ['doppelte Originalrevision', data => ({ ...data, legacy_candidates: [legacy({}), legacy({})] })],
  ['Zuordnung ohne vorhandenen Verlaufseintrag', data => ({ ...data, legacy_candidates: [legacy({ linked_entry_id: id(99) })] })],
]) test(`verwirft ${label} im ganzen nativen Verlauf`, async () => {
  const e = repositoryEnvironment({ mutate }); assert.equal((await e.functions.readClientClinicalHistory(id(1), id(2), id(3))).ok, false);
});

test('bewahrt vollständiges Altoriginal tief eingefroren und getrennt von der Anzeigeprojektion', async () => {
  const raw = legacy({ original: { field: 'allergies', value: ' Original ', nested: ['b', 'a'], client_updated_at: time(9) } });
  const e = repositoryEnvironment({ mutate: data => ({ ...data, legacy_candidates: [raw] }) });
  const result = await e.functions.readClientClinicalHistory(id(1), id(2), id(3)); assert.equal(result.ok, true);
  raw.original.value = 'später'; raw.original.nested.reverse();
  assert.equal(result.data.legacyCandidates[0].original.value, ' Original '); assert.deepEqual(result.data.legacyCandidates[0].original.nested, ['b', 'a']);
  assert.ok(Object.isFrozen(result.data.legacyCandidates[0].original)); assert.ok(Object.isFrozen(result.data.legacyCandidates[0].original.nested));
});

test('ordnet einen vollständig gebundenen Legacybeleg nur einer neuen Fassung zu', async () => {
  const origin = { originKind: 'client_allergies', originId: id(2), originUpdatedAt: time(9), original: { field: 'allergies', value: 'Penicillin unklar', client_updated_at: time(9) } };
  const e = repositoryEnvironment(); const input = { tenantId: id(1), clientId: id(2), actorId: id(3), requestId: id(11), expectedClientUpdatedAt: time(9), supersedesId: null, expectedSupersededUpdatedAt: null, kind: 'unresolved_hint', clinicalCode: null, clinicalText: 'Penicillin unklar', sourceType: 'Geprüftes Legacyoriginal', sourceReference: 'clients.allergies', clinicalDate: null, dateMeaning: 'unknown', verification: 'unconfirmed', recordState: 'active', recordedByName: 'Fachkraft Eins', legacyOrigin: origin };
  const result = await e.functions.recordClientClinicalHistory(input); assert.equal(result.ok, true);
  assert.deepEqual(e.calls[0].args.p_payload.legacy_origin, { origin_kind: 'client_allergies', origin_id: id(2), origin_updated_at: time(9), original: origin.original });
});

test('akzeptiert keine erfolgreiche Schreibantwort mit anderem oder fehlendem Legacyoriginal', async () => {
  const origin = { originKind: 'client_allergies', originId: id(2), originUpdatedAt: time(9), original: { field: 'allergies', value: 'Penicillin unklar' } };
  const e = repositoryEnvironment({ mutate: (data, name) => name === 'web_record_client_clinical_history' ? { ...data, legacy_origin: null } : data });
  const result = await e.functions.recordClientClinicalHistory({ ...writeOriginal(), legacyOrigin: origin });
  assert.equal(result.ok, false); assert.equal(e.calls.length, 1);
});

for (const legacyOrigin of [
  { originKind: 'heuristic_merge', originId: id(2), originUpdatedAt: time(9), original: {} },
  { originKind: 'client_allergies', originId: 'bad', originUpdatedAt: time(9), original: {} },
  { originKind: 'client_allergies', originId: id(2), originUpdatedAt: '2026-10-15', original: {} },
  { originKind: 'client_allergies', originId: id(2), originUpdatedAt: time(9), original: 'raw' },
]) test('sendet keinen unvollständigen Legacybezug', async () => {
  const e = repositoryEnvironment(); const input = { ...writeOriginal(), legacyOrigin };
  assert.equal((await e.functions.recordClientClinicalHistory(input)).ok, false); assert.equal(e.calls.length, 0);
});

test('Legacybezug ist bei Fortschreibung gesperrt', async () => {
  const e = repositoryEnvironment(); const input = { ...writeOriginal(), supersedesId: id(10), expectedSupersededUpdatedAt: time(10), legacyOrigin: { originKind: 'client_allergies', originId: id(2), originUpdatedAt: time(9), original: { field: 'allergies' } } };
  assert.equal((await e.functions.recordClientClinicalHistory(input)).ok, false); assert.equal(e.calls.length, 0);
});

test('erfasst das vollständige Schreiboriginal vor Await und verlangt dieselbe Quittung', async () => {
  const input = { tenantId: id(1), clientId: id(2), actorId: id(3), requestId: id(11), expectedClientUpdatedAt: time(9), supersedesId: null, expectedSupersededUpdatedAt: null, kind: 'diagnosis', clinicalCode: 'I10', clinicalText: 'Originaler Diagnosehinweis', sourceType: 'Arztbrief', sourceReference: 'Dokument 42', clinicalDate: '2026-10-01', dateMeaning: 'diagnosed_on', verification: 'confirmed', recordState: 'active', recordedByName: 'Fachkraft Eins' };
  const e = repositoryEnvironment({ before: () => { input.clinicalText = 'nachträglich verändert'; } }); const result = await e.functions.recordClientClinicalHistory(input);
  assert.equal(result.ok, true); assert.equal(e.calls[0].args.p_payload.clinical_text, 'Originaler Diagnosehinweis'); assert.equal(e.calls[0].args.p_request_id, id(11));
});

for (const patch of [
  { requestId: 'bad' }, { clinicalText: 'x' }, { sourceType: '' }, { sourceReference: '' },
  { clinicalDate: null, dateMeaning: 'diagnosed_on' }, { clinicalDate: '2026-10-01', dateMeaning: 'unknown' },
  { supersedesId: id(7), expectedSupersededUpdatedAt: null },
]) test('sendet kein unvollständiges oder widersprüchliches Original', async () => {
  const e = repositoryEnvironment(); const input = { tenantId: id(1), clientId: id(2), actorId: id(3), requestId: id(11), expectedClientUpdatedAt: time(9), supersedesId: null, expectedSupersededUpdatedAt: null, kind: 'diagnosis', clinicalCode: null, clinicalText: 'Originaler Hinweis', sourceType: 'Arztbrief', sourceReference: 'Dokument 42', clinicalDate: null, dateMeaning: 'unknown', verification: 'unconfirmed', recordState: 'active', recordedByName: 'Fachkraft Eins', ...patch };
  assert.equal((await e.functions.recordClientClinicalHistory(input)).ok, false); assert.equal(e.calls.length, 0);
});

test('Sitzungswechsel nach Transport entwertet eine späte Antwort', async () => {
  const e = repositoryEnvironment({ before: () => e.setCurrent({ rpc: async () => ({ data: null, error: null }) }) });
  assert.equal((await e.functions.confirmClientClinicalHistoryWrite({ tenantId: id(1), clientId: id(2), actorId: id(3), requestId: id(11) })).ok, false);
});

function workflowEnvironment(controls = {}) {
  const values = new Map(); const calls = [];
  const storage = { setItem(k, v) { if (controls.failWrite) throw Error('quota'); values.set(k, v); }, getItem: k => values.get(k) ?? null, removeItem: k => values.delete(k) };
  const record = async original => { calls.push(['record', structuredClone(original), values.size]); return controls.recordResult ?? { ok: true, data: entry({ request_id: original.requestId }) }; };
  const confirm = async original => { calls.push(['confirm', structuredClone(original), values.size]); return controls.confirmResult ?? { ok: true, data: entry({ request_id: original.requestId }) }; };
  const functions = new Function('window','recordClientClinicalHistory','confirmClientClinicalHistoryWrite', `${workflowSource};return {recordClientClinicalHistoryDurably,recoverClientClinicalHistoryJournal,clientClinicalHistoryJournal};`)({ localStorage: storage }, record, confirm);
  return { values, calls, functions };
}
const writeOriginal = () => ({ tenantId: id(1), clientId: id(2), actorId: id(3), requestId: id(11), expectedClientUpdatedAt: time(9), supersedesId: null, expectedSupersededUpdatedAt: null, kind: 'allergy', clinicalCode: null, clinicalText: 'Hinweis auf Penicillinallergie', sourceType: 'Anamnese', sourceReference: 'Aufnahmegespräch 2026-10-15', clinicalDate: null, dateMeaning: 'unknown', verification: 'unconfirmed', recordState: 'active', recordedByName: 'Fachkraft Eins' });

test('persistiert das ganze Schreiboriginal zwingend vor dem ersten RPC', async () => {
  const e = workflowEnvironment(); assert.equal((await e.functions.recordClientClinicalHistoryDurably(writeOriginal())).ok, true);
  assert.equal(e.calls[0][0], 'record'); assert.equal(e.calls[0][2], 1); assert.equal(e.values.size, 0);
});

test('persistiert auch verschachtelte Legacyoriginale als tiefe Momentaufnahme vor Await', async () => {
  const input = { ...writeOriginal(), legacyOrigin: { originKind: 'client_allergies', originId: id(2), originUpdatedAt: time(9), original: { field: 'allergies', nested: ['b', 'a'] } } };
  const e = workflowEnvironment(); const flight = e.functions.recordClientClinicalHistoryDurably(input);
  input.legacyOrigin.original.nested.reverse(); const result = await flight; assert.equal(result.ok, true);
  assert.deepEqual(e.calls[0][1].legacyOrigin.original.nested, ['b', 'a']);
});

test('sendet ohne dauerhaftes Journal keinen klinischen Write', async () => {
  const e = workflowEnvironment({ failWrite: true }); assert.equal((await e.functions.recordClientClinicalHistoryDurably(writeOriginal())).ok, false); assert.equal(e.calls.length, 0);
});

test('unklarer Write bleibt gesperrt und wird nach Reload nur über native Quittung aufgeklärt', async () => {
  const e = workflowEnvironment({ recordResult: { ok: false, error: 'transport' } }); await e.functions.recordClientClinicalHistoryDurably(writeOriginal());
  assert.equal(e.values.size, 1); assert.equal((await e.functions.recoverClientClinicalHistoryJournal(id(1), id(2), id(3))).ok, true);
  assert.deepEqual(e.calls.map(call => call[0]), ['record', 'confirm']); assert.equal(e.values.size, 0);
});

test('fremder Akteur kann ein lokales Journal weder bestätigen noch wiederholen', async () => {
  const e = workflowEnvironment({ recordResult: { ok: false, error: 'transport' } }); await e.functions.recordClientClinicalHistoryDurably(writeOriginal());
  const result = await e.functions.recoverClientClinicalHistoryJournal(id(1), id(2), id(4)); assert.equal(result.ok, false); assert.equal(e.calls.length, 1); assert.equal(e.values.size, 1);
});

test('SQL speichert jede Fassung unveränderlich mit genau einem Nachfolger', () => {
  for (const token of ['request_id UUID NOT NULL UNIQUE','revision INTEGER NOT NULL','supersedes_id UUID','original_payload JSONB NOT NULL','uq_client_clinical_records_one_successor']) assert.match(sql, new RegExp(token));
  assert.doesNotMatch(sql, /UPDATE public\.client_clinical_records/); assert.doesNotMatch(sql, /DELETE FROM public\.client_clinical_records/);
});

test('SQL liefert Legacyoriginale getrennt und verknüpft sie nur nach vollständigem CAS-Vergleich', () => {
  for (const token of ['client_diagnoses','client_diagnoses_notes','client_allergies','care_diagnosis','legacy_candidates','legacy_origin','uq_client_clinical_records_legacy_origin']) assert.match(sql, new RegExp(token));
  assert.match(sql, /v_legacy->'original' IS DISTINCT FROM v_expected_original/);
  assert.match(sql, /v_legacy_updated_at IS DISTINCT FROM CASE WHEN v_legacy_kind='care_diagnosis' THEN v_care\.updated_at ELSE v_client\.updated_at END/);
  assert.match(sql, /SELECT \* INTO STRICT v_care FROM public\.care_diagnoses[\s\S]*?FOR SHARE/);
  assert.match(sql, /Dieses Altoriginal wurde bereits ausdrücklich zugeordnet/);
  assert.doesNotMatch(sql, /string_to_array|regexp_split|to_tsvector|similarity\(/);
});

test('SQL bindet Sitzung, Mandant, Person und sensible Diagnose-Rechte bei Read und Write', () => {
  for (const permission of ['office.clients.view','office.clients.view_sensitive','pflege.diagnoses.view','pflege.diagnoses.manage']) assert.match(sql, new RegExp(permission.replaceAll('.', '\\.')));
  assert.match(sql, /auth\.sessions/); assert.match(sql, /pg_advisory_xact_lock\(hashtextextended\('client-clinical:'\|\|p_tenant_id::TEXT\|\|':'\|\|p_client_id::TEXT,0\)\)/);
  assert.match(sql, /REVOKE ALL ON TABLE public\.client_clinical_records FROM PUBLIC, anon, authenticated/);
});

test('SQL trennt Diagnose, Allergie, Unverträglichkeit und ungeklärten Hinweis', () => {
  for (const kind of ['diagnosis','allergy','intolerance','unresolved_hint']) assert.match(sql, new RegExp(kind));
  assert.match(sql, /date_meaning IN \('diagnosed_on','onset_on','reported_on','unknown'\)/);
  assert.match(sql, /verification IN \('unconfirmed','provisional','confirmed','refuted'\)/);
});

test('aktiver Webpfad verbindet Legacyoriginal, strukturierte Historie, sichere Revision und Reload-Aufklärung', () => {
  assert.match(panel, /Strukturierte Diagnosen- und Allergiehistorie öffnen/); assert.match(panel, /clinical-history/); assert.match(route, /ClientClinicalHistoryScreen/);
  assert.match(screen, /recordClientClinicalHistoryDurably/); assert.match(screen, /recoverClientClinicalHistoryJournal/); assert.match(screen, /Unbekannt bleibt unbekannt/);
  assert.match(screen, /Neue unveränderliche Fassung/); assert.match(screen, /Ältere Freitexthinweise bleiben getrennte Originale/);
  assert.match(screen, /Unveränderte Altoriginale zur ausdrücklichen Prüfung/); assert.match(screen, /Original in Prüfmaske übernehmen/);
  assert.match(screen, /Noch keine klinische Bestätigung/); assert.match(screen, /legacyOrigin/);
});
