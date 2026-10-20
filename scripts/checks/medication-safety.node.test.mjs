import test from 'node:test';
import assert from 'node:assert/strict';
import { MedicationRequestState, isDefiniteMedicationRejection } from '../../src/lib/pflege/medicationRequestState.ts';
import { berlinEventCandidates, validateMedicationAdministration as check, validateMedicationFollowUp, validEventInstant } from '../../src/lib/pflege/medicationAdministrationDomain.ts';
const now = new Date('2026-10-08T10:00:00Z');
const order = { status: 'active', startDate: '2026-01-01', endDate: '2026-12-31', isPrn: true, isControlledSubstance: true };
const input = { status: 'late', occurredAt: '2026-10-08T08:00:00+02:00', dose: '1 Tablette', route: 'oral', deviationReason: 'Einsatz verspätet', prnReason: 'Dokumentierter Bedarf', witnessProfileId: 'witness', painScoreBefore: 0 };
test('Ein sofortiger zweiter Speicherklick startet keine zweite Anfrage', () => {
  const state = new MedicationRequestState(); let ids = 0;
  assert.equal(state.begin(undefined, () => `request-${++ids}`), null);
  const first = state.begin(input, () => `request-${++ids}`);
  assert.equal(state.begin(input, () => `request-${++ids}`), null);
  assert.equal(ids, 1); assert.equal(first.replay, false);
});
test('Verlorene Bestätigung behält Identität und unveränderte Daten über mehrere Wiederholungen', () => {
  const state = new MedicationRequestState(); const draft = { ...input };
  const first = state.begin(draft, () => 'same');
  draft.dose = 'Andere Dosis'; state.settle(false, true); state.release();
  for (let i = 0; i < 3; i++) {
    const retry = state.begin(i === 0 ? undefined : { dose: 'Veränderte Eingabe' }, () => { throw Error('Neue ID verboten'); });
    assert.equal(retry.id, first.id); assert.equal(retry.payload, first.payload);
    assert.equal(retry.payload.dose, '1 Tablette'); assert.equal(retry.replay, true);
    assert.throws(() => { retry.payload.dose = 'Manipulation'; }, TypeError);
    // A later definite rejection cannot disprove the original unknown commit.
    state.settle(false, i !== 1); state.release();
  }
});
test('Bestätigter Abschluss erlaubt eine eigenständige neue Dokumentation', () => {
  const state = new MedicationRequestState(); state.begin(input, () => 'first');
  state.settle(true); state.release();
  const next = state.begin({ ...input, dose: '2 Tabletten' }, () => 'second');
  assert.equal(next.id, 'second'); assert.equal(next.replay, false); assert.equal(next.payload.dose, '2 Tabletten');
});
test('Eindeutige Ablehnung erlaubt korrigierte Daten mit neuer Identität', () => {
  const state = new MedicationRequestState(); state.begin(input, () => 'invalid');
  state.settle(false, false); state.release();
  const corrected = state.begin({ ...input, route: 'Korrigierte Applikation' }, () => 'corrected');
  assert.equal(corrected.id, 'corrected'); assert.equal(corrected.replay, false);
});
test('Verbindungsabbruch, Serverausfall und fehlender Fehlercode bleiben ungewiss', () => {
  for (const code of ['08006', '08003', '57P01', 'XX000', 'PGRST000', undefined]) assert.equal(isDefiniteMedicationRejection(code, 503), false, String(code));
  for (const code of ['23514', '42501', '40001', '22P02', 'P0001']) assert.equal(isDefiniteMedicationRejection(code, 400), true, code);
  assert.equal(isDefiniteMedicationRejection('PGRST202', 404), true);
  assert.equal(isDefiniteMedicationRejection('PGRST202', 500), false);
});
test('Verspätete Gabe benötigt aktuelle Bedarfsindikation und eine andere Kontrollperson', () => {
  assert.equal(check(order, 'actor', input, now), null);
  assert.match(check(order, 'actor', { ...input, prnReason: '' }, now), /Bedarfsindikation/);
  assert.match(check(order, 'actor', { ...input, witnessProfileId: 'actor' }, now), /andere Person/);
});
test('Nichtgabe enthält keine tatsächliche Dosis, Applikation oder Schmerzbewertung der Gabe', () => {
  const noDose = { status: 'refused', occurredAt: input.occurredAt, deviationReason: 'Ablehnung' };
  assert.equal(check(order, 'actor', noDose, now), null);
  for (const field of [{ dose: '1 Tablette' }, { route: 'oral' }, { painScoreBefore: 0 }, { witnessProfileId: 'witness' }, { prnReason: 'Bedarf' }]) assert.match(check(order, 'actor', { ...noDose, ...field }, now), /Nichtgabe/);
});
test('Gaben benötigen ausdrückliche Dosis und Applikation', () => {
  for (const fields of [{ dose: '' }, { route: ' ' }]) assert.match(check(order, 'actor', { ...input, ...fields }, now), /ausdrücklich/);
});
test('Ungültige oder zukünftige Zeiten sowie fehlende Identität werden verweigert', () => {
  for (const occurredAt of ['2026-02-30T08:00:00Z', '2026-10-08T24:00:00Z', '0000-10-08T08:00:00Z', '2026-10-08T08:00:00', '2026-10-09T08:00:00Z']) assert.ok(check(order, 'actor', { ...input, occurredAt }, now));
  assert.equal(validEventInstant('2026-10-08T08:00:00+25:00'), false);
  assert.ok(check(order, '', input, now)); assert.ok(check({ ...order, status: 'paused' }, 'actor', input, now));
});
test('Verordnungsgültigkeit richtet sich nach dem Ereignistag in Deutschland', () => {
  assert.match(check({ ...order, endDate: '2026-10-07' }, 'actor', { ...input, occurredAt: '2026-10-07T22:30:00Z' }, now), /gültigkeit/i);
});
test('Zeitumstellung hat eine ungültige und eine ausdrücklich zu unterscheidende Uhrzeit', () => {
  assert.deepEqual(berlinEventCandidates('2026-03-29', '02:30'), []);
  const fold = berlinEventCandidates('2026-10-25', '02:30'); assert.equal(fold.length, 2);
  assert.equal(Math.abs(Date.parse(fold[0]) - Date.parse(fold[1])), 3600000);
  assert.deepEqual(berlinEventCandidates('2026-02-30', '10:00'), []);
});
test('Schmerzskala erhält null Punkte und lehnt Bruchteile und Extremwerte ab', () => {
  assert.equal(check(order, 'actor', input, now), null);
  assert.equal(check(order, 'actor', { ...input, painScoreBefore: null }, now), null);
  for (const painScoreBefore of [-1, 11, .5, NaN, Infinity]) assert.match(check(order, 'actor', { ...input, painScoreBefore }, now), /Schmerzskala/);
});
test('Wirkungskontrolle benötigt eine bestätigte Gabe, zulässige Zeit und beide Fachangaben', () => {
  assert.equal(validateMedicationFollowUp(input.occurredAt, '2026-10-08T09:00:00+02:00', 'Wirkung beobachtet', 'Kontrolle geplant', 0, now), null);
  for (const args of [[null, input.occurredAt, 'Text', 'Text', null], [input.occurredAt, '2026-10-08T07:00:00+02:00', 'Text', 'Text', null], [input.occurredAt, input.occurredAt, '', 'Text', null], [input.occurredAt, input.occurredAt, 'Text', '', null], [input.occurredAt, input.occurredAt, 'Text', 'Text', 11]]) assert.ok(validateMedicationFollowUp(...args, now));
});

const exactOrder = { status: 'active', startDate: null, endDate: null, isPrn: false, isControlledSubstance: false };
const exactDraft = occurredAt => ({ status: 'administered', occurredAt, dose: '1 Tablette', route: 'oral' });
for (const earlier of ['2026-10-08T08:00:00.000001Z', '2026-10-08T10:00:00.000001+02:00', '2026-10-08T05:00:00.000001-03:00']) test(`Kontrolle eine Mikrosekunde vor der Gabe wird mit nativer Zone verweigert: ${earlier}`, () => {
  assert.ok(validateMedicationFollowUp('2026-10-08T08:00:00.000002Z', earlier, 'Tatsächliche Beobachtung', 'Individuelle Maßnahme', 0, now));
});
for (const [future, clock] of [
  ['2026-10-08T08:00:00.000001Z', '2026-10-08T08:00:00.000Z'],
  ['2026-10-08T08:00:00.001001Z', '2026-10-08T08:00:00.001Z'],
  ['2026-10-08T10:00:00.000001+02:00', '2026-10-08T08:00:00.000Z'],
  ['2026-10-08T05:00:00.000001-03:00', '2026-10-08T08:00:00.000Z'],
  ['2026-10-08T08:00:00.999999Z', '2026-10-08T08:00:00.999Z'],
  ['1969-12-31T23:59:59.999001Z', '1969-12-31T23:59:59.999Z'],
]) test(`Gabe und Kontrolle verweigern Zukunft innerhalb derselben Millisekunde: ${future}`, () => {
  const reference = new Date(clock);
  assert.ok(check(exactOrder, 'actor', exactDraft(future), reference));
  assert.ok(validateMedicationFollowUp('1969-12-31T00:00:00Z', future, 'Beobachtung', 'Maßnahme', null, reference));
});
for (const [given, observed] of [
  ['2026-10-08T08:00:00Z', '2026-10-08T10:00:00.000000+02:00'],
  ['2026-10-08T08:00:00.1Z', '2026-10-08T05:00:00.100000-03:00'],
  ['2026-10-08T08:00:00.123456Z', '2026-10-08T10:00:00.123456+02:00'],
  ['1969-12-31T23:59:59.999999Z', '1970-01-01T01:59:59.999999+02:00'],
]) test(`Native gleiche Kontroll- und Gabezeit bleibt einschließlich Fractionpadding zulässig: ${observed}`, () => {
  assert.equal(validateMedicationFollowUp(given, observed, 'Beobachtung', 'Maßnahme', 0, now), null);
});
test('HH:MM-Webeingabe vor erhaltenem Mikrosekunden-Gabeoriginal verweigert; nächste Minute bleibt unabhängig zulässig', () => {
  const given = '2026-10-08T08:00:00.000001Z', sameMinute = berlinEventCandidates('2026-10-08', '10:00')[0], nextMinute = berlinEventCandidates('2026-10-08', '10:01')[0];
  assert.ok(validateMedicationFollowUp(given, sameMinute, 'Beobachtung', 'Maßnahme', null, now));
  assert.equal(validateMedicationFollowUp(given, nextMinute, 'Beobachtung', 'Maßnahme', null, now), null);
});
test('Zeitpunkte vor Unix-Epoche werden exakt geordnet und dürfen vergangene tatsächliche Gaben beschreiben', () => {
  const reference = new Date('1970-01-01T00:00:00Z'), given = '1969-12-31T23:59:59.999998Z';
  assert.equal(check(exactOrder, 'actor', exactDraft(given), reference), null);
  assert.ok(validateMedicationFollowUp(given, '1969-12-31T23:59:59.999997Z', 'Beobachtung', 'Maßnahme', null, reference));
  assert.equal(validateMedicationFollowUp(given, '1969-12-31T23:59:59.999999Z', 'Beobachtung', 'Maßnahme', null, reference), null);
});
test('Tatsächliche Zeit genau am Millisekunden-Lesezeitpunkt ist zulässig, nicht als Zukunft eingestuft', () => {
  const reference = new Date('2026-10-08T08:00:00.001Z'), exact = '2026-10-08T10:00:00.001000+02:00';
  assert.equal(check(exactOrder, 'actor', exactDraft(exact), reference), null);
  assert.equal(validateMedicationFollowUp('2026-10-08T08:00:00.000999Z', exact, 'Beobachtung', 'Maßnahme', null, reference), null);
});
for (const invalid of ['2026-02-30T08:00:00.000001Z', '2026-10-08T08:00:00.0000001Z', '2026-10-08T08:00:00.1+25:00', '2026-10-08T08:00:00.123456']) test(`Native Detailzeit mit fehlerhaftem Datum, Präzision oder Zone bleibt verweigert: ${invalid}`, () => {
  assert.ok(check(exactOrder, 'actor', exactDraft(invalid), now));
  assert.ok(validateMedicationFollowUp('2026-10-08T08:00:00Z', invalid, 'Beobachtung', 'Maßnahme', null, now));
  assert.ok(validateMedicationFollowUp(invalid, input.occurredAt, 'Beobachtung', 'Maßnahme', null, now));
});
test('Ungültige tatsächliche Prüfuhr kann weder Gabe noch Kontrolle zulassen oder BigInt-Ausnahme erzeugen', () => {
  const invalidNow = new Date(NaN);
  assert.ok(check(exactOrder, 'actor', exactDraft(input.occurredAt), invalidNow));
  assert.ok(validateMedicationFollowUp(input.occurredAt, input.occurredAt, 'Beobachtung', 'Maßnahme', null, invalidNow));
});
test('Native Rohmikrozeiten, Fachangaben und Verordnung bleiben bei erfolgreicher und abgewiesener Prüfung unverändert', () => {
  const medication = structuredClone(exactOrder), draft = exactDraft('2026-10-08T10:00:00.123456+02:00'), original = structuredClone({medication, draft}), given = '2026-10-08T08:00:00.123455Z';
  assert.equal(check(medication, 'actor', draft, now), null);
  assert.equal(validateMedicationFollowUp(given, draft.occurredAt, 'Tatsächliche Beobachtung', 'Ausdrückliche Folgeentscheidung', 0, now), null);
  assert.ok(check(medication, 'actor', draft, new Date('2026-10-08T08:00:00.123Z')));
  assert.deepEqual({medication, draft}, original);
});
