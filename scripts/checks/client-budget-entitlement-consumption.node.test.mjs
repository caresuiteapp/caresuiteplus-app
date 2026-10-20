import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {
  projectClientBudgetConsumption,
  selectClientBudgetEntitlementPeriod,
} from '../../src/lib/clients/clientBudgetEntitlementDomain.ts';

const period = (overrides = {}) => ({
  id: 'period-native-2026', tenantId: 'tenant-native', clientId: 'client-native',
  financingPathId: 'path-native-xi', serviceTypeKey: 'paragraph_45b',
  basisReference: 'bescheid-original-2026', periodStart: '2026-01-01', periodEnd: '2026-12-31',
  allocatedCents: 300000, createdAt: '2026-01-02T09:10:11.123456Z', ...overrides,
});

const event = (overrides = {}) => ({
  id: 'usage-native-1', tenantId: 'tenant-native', clientId: 'client-native',
  entitlementPeriodId: 'period-native-2026', financingPathId: 'path-native-xi',
  serviceTypeKey: 'paragraph_45b', serviceDate: '2026-05-10', amountCents: 3275,
  eventKind: 'usage', supersedesEventId: null, sourceType: 'service_proof', sourceId: 'proof-native-1',
  reason: null, recordedAt: '2026-05-10T10:11:12.123456Z', ...overrides,
});

test('eindeutiger Anspruch wird über exakten Mandant, Fall, Weg, Leistungsart und Leistungsdatum gewählt', () => {
  const selected = selectClientBudgetEntitlementPeriod([
    period(),
    period({ id: 'other-path', financingPathId: 'path-native-v', serviceTypeKey: 'treatment' }),
  ], {
    tenantId: 'tenant-native', clientId: 'client-native', financingPathId: 'path-native-xi',
    serviceTypeKey: 'paragraph_45b', serviceDate: '2026-06-01',
  });
  assert.equal(selected.id, 'period-native-2026');
  assert.equal(selected.basisReference, 'bescheid-original-2026');
});

test('Zeitraumgrenzen sind einschließlich', () => {
  for (const serviceDate of ['2026-01-01', '2026-12-31']) {
    assert.equal(selectClientBudgetEntitlementPeriod([period()], {
      tenantId: 'tenant-native', clientId: 'client-native', financingPathId: 'path-native-xi',
      serviceTypeKey: 'paragraph_45b', serviceDate,
    }).id, 'period-native-2026');
  }
});

test('fehlender Anspruch erhält keinen aktuellen oder fremden Fallback', () => {
  assert.throws(() => selectClientBudgetEntitlementPeriod([period()], {
    tenantId: 'tenant-native', clientId: 'client-native', financingPathId: 'path-native-xi',
    serviceTypeKey: 'paragraph_45b', serviceDate: '2027-01-01',
  }), /kein dokumentierter Anspruchszeitraum/);
  assert.throws(() => selectClientBudgetEntitlementPeriod([period()], {
    tenantId: 'other', clientId: 'client-native', financingPathId: 'path-native-xi',
    serviceTypeKey: 'paragraph_45b', serviceDate: '2026-06-01',
  }), /kein dokumentierter Anspruchszeitraum/);
});

test('überlappende Anspruchszeiträume werden nicht automatisch priorisiert', () => {
  assert.throws(() => selectClientBudgetEntitlementPeriod([
    period(), period({ id: 'overlap', periodStart: '2026-05-01' }),
  ], {
    tenantId: 'tenant-native', clientId: 'client-native', financingPathId: 'path-native-xi',
    serviceTypeKey: 'paragraph_45b', serviceDate: '2026-06-01',
  }), /mehrdeutig/);
});

test('unveränderter Erstverbrauch zählt genau einmal', () => {
  const result = projectClientBudgetConsumption(period(), [event()]);
  assert.equal(result.consumedCents, 3275);
  assert.equal(result.remainingCents, 296725);
  assert.deepEqual(result.effectiveEvents.map((row) => row.id), ['usage-native-1']);
});

test('Korrektur ersetzt den Vorgänger, ohne ihn aus der Historie zu entfernen', () => {
  const corrected = event({
    id: 'correction-native-2', eventKind: 'correction', amountCents: 4000,
    supersedesEventId: 'usage-native-1', sourceId: 'correction-proof-native-2',
    reason: 'Tatsächliche Dauer berichtigt', recordedAt: '2026-05-11T10:11:12.123457Z',
  });
  const result = projectClientBudgetConsumption(period(), [event(), corrected]);
  assert.equal(result.consumedCents, 4000);
  assert.equal(result.history.length, 2);
  assert.deepEqual(result.effectiveEvents.map((row) => row.id), ['correction-native-2']);
});

test('mehrstufige Korrektur zählt nur den letzten Kettenkopf', () => {
  const second = event({ id: 'c2', eventKind: 'correction', amountCents: 4000, supersedesEventId: 'usage-native-1', sourceId: 'c2-source', reason: 'erste Korrektur', recordedAt: '2026-05-11T10:00:00.000001Z' });
  const third = event({ id: 'c3', eventKind: 'correction', amountCents: 4500, supersedesEventId: 'c2', sourceId: 'c3-source', reason: 'zweite Korrektur', recordedAt: '2026-05-12T10:00:00.000002Z' });
  const result = projectClientBudgetConsumption(period(), [third, event(), second]);
  assert.equal(result.consumedCents, 4500);
  assert.equal(result.history.length, 3);
  assert.equal(result.effectiveEvents[0].id, 'c3');
});

test('Storno setzt genau seine Kette auf null und lässt andere Erstverbräuche bestehen', () => {
  const other = event({ id: 'usage-2', amountCents: 1000, sourceId: 'proof-2', recordedAt: '2026-05-10T11:00:00.000001Z' });
  const cancelled = event({ id: 'cancel-1', eventKind: 'cancellation', amountCents: 0, supersedesEventId: 'usage-native-1', sourceId: 'cancel-source', reason: 'Leistungsnachweis storniert', recordedAt: '2026-05-12T11:00:00.000002Z' });
  const result = projectClientBudgetConsumption(period(), [event(), other, cancelled]);
  assert.equal(result.consumedCents, 1000);
  assert.deepEqual(result.effectiveEvents.map((row) => row.id), ['usage-2', 'cancel-1']);
});

test('fehlender Vorgänger wird verworfen', () => {
  assert.throws(() => projectClientBudgetConsumption(period(), [event({
    id: 'orphan', eventKind: 'correction', supersedesEventId: 'missing', sourceId: 'orphan-source', reason: 'Korrektur', recordedAt: '2026-05-12T00:00:00.000001Z',
  })]), /vorgänger fehlt/i);
});

test('zwei konkurrierende Nachfolger werden nicht zusammengerechnet', () => {
  const correction = (id, amountCents, recordedAt) => event({ id, eventKind: 'correction', amountCents, supersedesEventId: 'usage-native-1', sourceId: `${id}-source`, reason: id, recordedAt });
  assert.throws(() => projectClientBudgetConsumption(period(), [
    event(), correction('c1', 4000, '2026-05-11T00:00:00.000001Z'), correction('c2', 4500, '2026-05-12T00:00:00.000001Z'),
  ]), /mehrere konkurrierende Nachfolger/);
});

test('rückwärts erfasste Korrektur wird abgewiesen und Mikrosekunden bleiben unterscheidbar', () => {
  assert.throws(() => projectClientBudgetConsumption(period(), [event(), event({
    id: 'bad-order', eventKind: 'correction', amountCents: 4000, supersedesEventId: 'usage-native-1',
    sourceId: 'bad-order-source', reason: 'Korrektur', recordedAt: '2026-05-10T10:11:12.123455Z',
  })]), /nach dem Vorgänger/);
  const good = event({ id: 'microsecond-successor', eventKind: 'correction', amountCents: 4000, supersedesEventId: 'usage-native-1', sourceId: 'micro-source', reason: 'Korrektur', recordedAt: '2026-05-10T10:11:12.123457Z' });
  assert.equal(projectClientBudgetConsumption(period(), [event(), good]).consumedCents, 4000);
});

for (const override of [
  { tenantId: 'other' }, { clientId: 'other' }, { entitlementPeriodId: 'other' },
  { financingPathId: 'other' }, { serviceTypeKey: 'other' },
]) {
  test(`fremder Verbrauchsscope ${Object.keys(override)[0]} wird verworfen`, () => {
    assert.throws(() => projectClientBudgetConsumption(period(), [event(override)]), /gehört nicht/);
  });
}

test('Leistungsdatum außerhalb des individuellen Zeitraums wird verworfen', () => {
  assert.throws(() => projectClientBudgetConsumption(period(), [event({ serviceDate: '2025-12-31' })]), /außerhalb/);
});

test('Korrektur und Storno benötigen nativen Vorgänger und dokumentierten Grund', () => {
  assert.throws(() => projectClientBudgetConsumption(period(), [event({ eventKind: 'correction', supersedesEventId: null })]), /nativen Vorgänger/);
  assert.throws(() => projectClientBudgetConsumption(period(), [event({ eventKind: 'cancellation', supersedesEventId: 'usage-native-1', amountCents: 0, reason: null })]), /Korrektur-\/Stornogrund/);
});

test('Storno darf keinen positiven Verbrauch und Korrektur keinen Nullverbrauch tragen', () => {
  assert.throws(() => projectClientBudgetConsumption(period(), [event({ eventKind: 'cancellation', supersedesEventId: 'x', reason: 'Storno' })]), /Storno muss/);
  assert.throws(() => projectClientBudgetConsumption(period(), [event({ eventKind: 'correction', amountCents: 0, supersedesEventId: 'x', reason: 'Korrektur' })]), /Korrektur muss/);
});

test('ungültige oder fehlende individuelle Grundlage wird nicht als Anspruch verwendet', () => {
  assert.throws(() => projectClientBudgetConsumption(period({ basisReference: '' }), []), /Anspruchsgrundlage fehlt/);
  assert.throws(() => projectClientBudgetConsumption(period({ periodEnd: '2025-01-01' }), []), /Anspruchszeitraum/);
});

test('Mapper erhalten native Identitäten und mikrosekundengenaue Zeittexte ohne Date-Neuparsing', async () => {
  const service = await fs.readFile(new URL('../../src/lib/clients/clientBudgetEntitlementService.ts', import.meta.url), 'utf8');
  assert.match(service, /id: requiredText\(row\.id, 'id'\)/);
  assert.match(service, /sourceId: requiredText\(row\.source_id, 'source_id'\)/);
  assert.match(service, /recordedAt: requiredText\(row\.recorded_at, 'recorded_at'\)/);
  assert.doesNotMatch(service, /new Date\(row\.recorded_at/);
  const projected = projectClientBudgetConsumption(period(), [event()]);
  assert.equal(projected.history[0].recordedAt, '2026-05-10T10:11:12.123456Z');
});

test('SQL bindet Scope, Zeitraum und eindeutigen Nachfolger und bleibt append-only', async () => {
  const sql = await fs.readFile(new URL('../../supabase/patches/ambulatory_client_budget_entitlement_consumption.sql', import.meta.url), 'utf8');
  assert.match(sql, /FOREIGN KEY \(tenant_id, client_id, financing_path_id, service_type_key, entitlement_period_id\)/);
  assert.match(sql, /idx_client_budget_consumption_one_successor/);
  assert.match(sql, /NEW\.service_date < v_start OR NEW\.service_date > v_end/);
  assert.match(sql, /v_predecessor_time >= NEW\.recorded_at/);
  assert.match(sql, /GRANT SELECT, INSERT ON public\.client_budget_consumption_events/);
  assert.doesNotMatch(sql, /GRANT[^;]*UPDATE[^;]*client_budget_consumption_events/i);
  assert.doesNotMatch(sql, /UPDATE\s+public\.client_budget_consumption_events/i);
});

test('Web zeigt Grundlage, Zeitraum, wirksamen Verbrauch und Historienzahl; Android bleibt unverändert', async () => {
  const [web, nativeDefault] = await Promise.all([
    fs.readFile(new URL('../../src/components/office/ClientParallelFinancingSummary.web.tsx', import.meta.url), 'utf8'),
    fs.readFile(new URL('../../src/components/office/ClientParallelFinancingSummary.tsx', import.meta.url), 'utf8'),
  ]);
  assert.match(web, /Grundlage \{period\.basisReference\}/);
  assert.match(web, /Wirksamer Verbrauch/);
  assert.match(web, /historische Ereignisse/);
  assert.match(nativeDefault, /return null/);
});
