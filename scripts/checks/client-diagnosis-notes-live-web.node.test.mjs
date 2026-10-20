import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes as strip } from 'node:module';

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
const source = read('src/lib/clients/clientDiagnosisNotes.web.ts');
const api = new Function(
  strip(source.replace(/\bexport /g, '')) + ';return {projectClientDiagnosisNotesWeb};',
)();
const screenSource = read('src/screens/pflege/ClientRecordWorkspace365.web.tsx');

test('unavailable sensitive diagnosis read remains unavailable rather than empty', () => {
  const projection = api.projectClientDiagnosisNotesWeb(null);
  assert.equal(projection.state, 'unavailable');
  assert.deepEqual(projection.entries, []);
});

test('delivered empty diagnosis array is visibly unknown and never diagnosis-free', () => {
  const projection = api.projectClientDiagnosisNotesWeb([]);
  assert.equal(projection.state, 'unknown');
  assert.deepEqual(projection.entries, []);
  assert.equal(Object.hasOwn(projection, 'diagnosisFree'), false);
});

test('diagnosis hints preserve duplicates and delivered order without deduplication', () => {
  const projection = api.projectClientDiagnosisNotesWeb(['Hinweis A', 'Hinweis A', 'Hinweis B']);
  assert.deepEqual(projection.entries.map((entry) => entry.note), ['Hinweis A', 'Hinweis A', 'Hinweis B']);
  assert.deepEqual(projection.entries.map((entry) => entry.ordinal), [1, 2, 3]);
});

test('one delivered string remains one hint and is never split by punctuation', () => {
  const projection = api.projectClientDiagnosisNotesWeb(['A, B; C']);
  assert.equal(projection.entries.length, 1);
  assert.equal(projection.entries[0].note, 'A, B; C');
});

test('empty original diagnosis value remains an explicit empty field', () => {
  const entry = api.projectClientDiagnosisNotesWeb(['']).entries[0];
  assert.equal(entry.noteState, 'empty');
  assert.equal(entry.note, null);
});

test('source date and clinical confirmation are never inferred from a hint', () => {
  const entry = api.projectClientDiagnosisNotesWeb(['Gespeicherter Hinweis']).entries[0];
  assert.equal(entry.sourceState, 'not_supplied');
  assert.equal(entry.recordedAtState, 'not_supplied');
  assert.equal(entry.clinicalState, 'not_confirmed');
});

test('malformed diagnosis pools fail closed as a whole', () => {
  for (const value of [undefined, {}, 'Hinweis', ['ok', 7]]) {
    assert.throws(() => api.projectClientDiagnosisNotesWeb(value));
  }
});

test('active overview passes diagnoses only under current sensitive read', () => {
  assert.match(screenSource, /<ClientRecordDiagnosisNotesPanel[\s\S]*?diagnoses=\{fullQuery\.data && fullQuery\.canViewSensitive \? fullQuery\.data\.core\.diagnoses : null\}[\s\S]*?clientId=\{detail\.id\}[\s\S]*?canViewStructured=\{fullQuery\.canViewSensitive && can\('pflege\.diagnoses\.view'\)\}/);
  assert.doesNotMatch(screenSource, /fullClient\.core\.diagnoses\.join/);
});
