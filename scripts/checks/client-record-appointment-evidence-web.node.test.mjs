import test from 'node:test';
import assert from 'node:assert/strict';
import { captureClientRecordAppointmentEvidence as capture } from '../../src/lib/clients/clientRecordAppointmentEvidence.web.ts';

const id = n => `11111111-1111-4111-8111-${String(n).padStart(12, '0')}`;
const scope = { tenantId: id(1), clientId: id(2) };
const dto = extra => ({ id: scope.clientId, tenantId: scope.tenantId, nextActionHint: 'Einsätze und Dokumentation sind auf dem aktuellen Stand.', contextCounts: { appointments: 0, assignments: 0, invoices: 0, documents: 0 }, ...extra });
function unknownAppointment(value) {
  assert.equal(value.error, null);
  assert.equal(value.details, 'not-supplied');
  assert.equal(Object.hasOwn(value, 'appointmentId'), false);
  assert.equal(Object.hasOwn(value, 'startsAt'), false);
  assert.equal(Object.hasOwn(value, 'confirmed'), false);
}

test('Native generic status hint and mapper-default zero remain distinct unconfirmed originals', () => {
  const input = dto(), before = structuredClone(input), value = capture(input, scope);
  unknownAppointment(value); assert.equal(value.hint.state, 'value'); assert.equal(value.hint.raw, input.nextActionHint);
  assert.equal(value.hint.display, input.nextActionHint); assert.deepEqual(value.originals.contextCounts.raw, input.contextCounts);
  assert.deepEqual(input, before);
});
test('Free text containing a microsecond date cannot supply appointment identity or a dated plan', () => {
  const text = 'Rückruf erwünscht 2026-10-20T08:00:00.123456+02:00', value = capture(dto({ nextActionHint: text }), scope);
  unknownAppointment(value); assert.equal(value.hint.raw, text); assert.equal(value.hint.display, text);
});
for (const count of [3, -1, 0.5, '3', null]) test(`Summary count ${JSON.stringify(count)} never supplies next appointment or confirms an empty appointment pool`, () => {
  const value = capture(dto({ nextActionHint: '', contextCounts: { appointments: count } }), scope);
  unknownAppointment(value); assert.equal(value.originals.contextCounts.raw.appointments, count); assert.equal(value.hint.state, 'empty');
});
test('Task due time, contract start, service start, creation and time preferences do not become appointments', () => {
  const input = dto({ tasks: [{ id: id(3), dueDate: '2026-10-20T09:00:00.123456Z' }], contracts: [{ contractStart: '2026-10-20' }], serviceStart: '2026-10-01', createdAt: '2026-09-01T08:00:00.123456Z', schedulingWishes: { timeFrom: '08:00', timeTo: '10:00', preferredDays: ['mo'] } }), before = structuredClone(input);
  unknownAppointment(capture(input, scope)); assert.deepEqual(input, before);
});
test('Uncontracted extra appointment-shaped fields are not interpreted as a trusted appointment feed', () => {
  const input = dto({ appointments: [{ id: id(7), startsAt: '2026-10-20T08:00:00Z', status: 'bestaetigt' }], nextAppointment: '2026-10-20' }), before = structuredClone(input);
  unknownAppointment(capture(input, scope)); assert.deepEqual(input, before);
});
test('Absent hint is different from own undefined', () => {
  const input = dto(); delete input.nextActionHint; const missing = capture(input, scope), supplied = capture(dto({ nextActionHint: undefined }), scope);
  unknownAppointment(missing); unknownAppointment(supplied); assert.equal(missing.hint.state, 'missing'); assert.equal(supplied.hint.state, 'invalid');
  assert.equal(missing.originals.nextActionHint.present, false); assert.equal(supplied.originals.nextActionHint.present, true); assert.equal(supplied.hint.raw, undefined);
});
test('Native null hint remains null without a zero-count empty-schedule claim', () => {
  const value = capture(dto({ nextActionHint: null }), scope); unknownAppointment(value); assert.equal(value.hint.state, 'null'); assert.equal(value.hint.raw, null);
});
for (const text of ['', '  ', '\n\t']) test(`Empty original hint ${JSON.stringify(text)} remains distinct and unnormalized`, () => {
  const value = capture(dto({ nextActionHint: text }), scope); unknownAppointment(value); assert.equal(value.hint.state, 'empty'); assert.equal(value.hint.raw, text);
});
test('Nonempty original spaces, line breaks, HTML-like free text and microseconds remain exact text', () => {
  const text = '  Original <script>not executed</script>\n2026-10-20 08:00:00.000001Z  ', value = capture(dto({ nextActionHint: text }), scope);
  unknownAppointment(value); assert.equal(value.hint.raw, text); assert.equal(value.hint.display, text);
});
for (const hint of [0, false, { foreignClinical: 'unrelated finding', nested: { id: id(99), value: 0 } }, ['unrelated clinical original']]) test(`Invalid supplied hint type ${Array.isArray(hint) ? 'array' : typeof hint} is retained without exposing unrelated clinical content`, () => {
  const input = dto({ nextActionHint: hint }), value = capture(input, scope); unknownAppointment(value); assert.equal(value.hint.state, 'invalid');
  assert.deepEqual(value.hint.raw, hint); assert.deepEqual(value.originals.nextActionHint.raw, hint); assert.equal(value.hint.display.includes('unrelated'), false); assert.equal(value.hint.display.includes(id(99)), false);
});
test('Whole delivered context-count metadata including own undefined, names, IDs, microtimes, false and zero are independently cloned', () => {
  const input = dto({ contextCounts: { appointments: 0, rawExtra: [{ id: id(10), author: '  Original  ', time: '2026-10-20T08:00:00.123456Z', observed: false, dose: 0, optional: undefined }] } }), before = structuredClone(input), value = capture(input, scope);
  unknownAppointment(value); assert.deepEqual(value.originals.contextCounts.raw, before.contextCounts);
  input.contextCounts.rawExtra[0].author = 'Changed'; assert.equal(value.originals.contextCounts.raw.rawExtra[0].author, '  Original  ');
  assert.equal(Object.hasOwn(value.originals.contextCounts.raw.rawExtra[0], 'optional'), true);
});
test('Consumers cannot mutate independently retained hint originals through the projected hint field', () => {
  const input = dto({ nextActionHint: { extra: { actor: 'Native' } } }), value = capture(input, scope);
  value.hint.raw.extra.actor = 'Consumer changed'; assert.equal(value.originals.nextActionHint.raw.extra.actor, 'Native'); assert.equal(input.nextActionHint.extra.actor, 'Native');
});
test('Missing and null whole context metadata remain distinct without displaying a counter', () => {
  const input = dto(); delete input.contextCounts; const missing = capture(input, scope), nil = capture(dto({ contextCounts: null }), scope);
  unknownAppointment(missing); unknownAppointment(nil); assert.equal(missing.originals.contextCounts.present, false); assert.equal(nil.originals.contextCounts.present, true); assert.equal(nil.originals.contextCounts.raw, null);
});
for (const extra of [{ tenantId: id(8) }, { id: id(9) }, { tenantId: 'not-native' }, { id: null }]) test(`Foreign or invalid native header ${JSON.stringify(extra)} prevents hint publication`, () => {
  const value = capture(dto(extra), scope); assert.ok(value.error); assert.equal(value.details, 'unconfirmed'); assert.equal(value.hint.state, 'invalid'); assert.equal(value.originals.nextActionHint.present, false);
});
test('Inherited scope fields do not confer own native identity', () => {
  const input = Object.create({ id: scope.clientId, tenantId: scope.tenantId }); input.nextActionHint = 'Untrusted'; assert.ok(capture(input, scope).error);
});
test('Native null-prototype DTO and metadata retain own fields without prototype synthesis as evidence', () => {
  const input = Object.assign(Object.create(null), dto({ contextCounts: Object.assign(Object.create(null), { appointments: 0, extra: false }) })), value = capture(input, scope);
  unknownAppointment(value); assert.equal(value.originals.contextCounts.raw.extra, false);
});
test('Frozen original input remains readable without mutation', () => {
  const input = Object.freeze(dto({ contextCounts: Object.freeze({ appointments: 0 }) })); unknownAppointment(capture(input, Object.freeze(scope)));
});
test('A hint getter is never invoked or published as native text', () => {
  let calls = 0; const input = dto(); Object.defineProperty(input, 'nextActionHint', { enumerable: true, get() { calls++; return 'Unsafe'; } });
  assert.ok(capture(input, scope).error); assert.equal(calls, 0);
});
test('Nested metadata getters cannot execute during original preservation', () => {
  let calls = 0; const counts = { appointments: 0 }; Object.defineProperty(counts, 'unknown', { enumerable: true, get() { calls++; return 'Unsafe'; } });
  assert.ok(capture(dto({ contextCounts: counts }), scope).error); assert.equal(calls, 0);
});
for (const unsupported of [new Date('2026-10-01'), new Map([['appointments', 0]]), NaN, () => 0]) test(`Unsupported original ${typeof unsupported === 'function' ? 'function' : Number.isNaN(unsupported) ? 'NaN' : unsupported.constructor.name} is not silently normalized`, () => {
  const value = capture(dto({ contextCounts: { original: unsupported } }), scope); assert.ok(value.error); assert.equal(value.details, 'unconfirmed');
});
test('Sparse original metadata arrays fail closed instead of losing positions', () => {
  const values = []; values.length = 2; values[1] = 0; assert.ok(capture(dto({ contextCounts: { extra: values } }), scope).error);
});
test('Array extra original properties cannot silently disappear during cloning', () => {
  const values = [0]; values.nativeOriginal = 'Extra'; assert.ok(capture(dto({ contextCounts: { extra: values } }), scope).error);
});
test('Nonenumerable, symbolic and circular original fields are not mistaken for complete metadata', () => {
  const a = { appointments: 0 }; Object.defineProperty(a, 'hidden', { value: 1 }); assert.ok(capture(dto({ contextCounts: a }), scope).error);
  const b = { appointments: 0, [Symbol('original')]: 1 }; assert.ok(capture(dto({ contextCounts: b }), scope).error);
  const c = { appointments: 0 }; c.self = c; assert.ok(capture(dto({ contextCounts: c }), scope).error);
});
