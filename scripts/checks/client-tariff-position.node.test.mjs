import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {
  assessClientTariffPosition,
  assessClientTariffPositions,
  selectClientTariffPosition,
} from '../../src/lib/clients/clientTariffPositionDomain.ts';

const day = '2026-10-13';
const position = (overrides = {}) => ({
  id: 'tariff-row-v2',
  logicalPositionId: 'tariff-logical',
  tenantId: 'tenant-native',
  clientId: 'client-native',
  financingPathId: 'path-native-xi',
  regionCode: 'NW',
  regionName: 'Nordrhein-Westfalen',
  payerAssignmentId: 'payer-assignment-native',
  payerName: 'Pflegekasse Beispiel',
  payerIk: '123456789',
  serviceCode: 'LK-01',
  serviceLabel: 'Leistungsposition 01',
  billingUnit: 'visit',
  unitPriceCents: 1540,
  currency: 'EUR',
  validFrom: '2026-07-01',
  validUntil: null,
  openEnded: true,
  agreementReference: 'vereinbarung-original-2026-07',
  version: 2,
  supersedesPositionId: 'tariff-row-v1',
  createdAt: '2026-06-10T11:12:13.123456Z',
  ...overrides,
});

const selection = (overrides = {}) => ({
  tenantId: 'tenant-native',
  clientId: 'client-native',
  financingPathId: 'path-native-xi',
  regionCode: 'NW',
  payerAssignmentId: 'payer-assignment-native',
  serviceCode: 'LK-01',
  serviceDate: day,
  ...overrides,
});

test('vollständig belegte Tarifposition ist am Leistungsdatum anwendbar', () => {
  const result = assessClientTariffPosition(position(), day);
  assert.equal(result.state, 'applicable');
  assert.deepEqual(result.issues, []);
  assert.equal(result.position.unitPriceCents, 1540);
});

test('Leistungsdatum wählt die historische Position statt des heutigen Standardpreises', () => {
  const old = position({
    id: 'tariff-old', logicalPositionId: 'tariff-old-logical', version: 1,
    unitPriceCents: 1325, validFrom: '2026-01-01', validUntil: '2026-06-30', openEnded: false,
    agreementReference: 'vereinbarung-original-2026-01', supersedesPositionId: null,
  });
  const current = position();
  assert.equal(selectClientTariffPosition([current, old], selection({ serviceDate: '2026-05-12' }))?.id, 'tariff-old');
  assert.equal(selectClientTariffPosition([current, old], selection({ serviceDate: '2026-08-12' }))?.id, 'tariff-row-v2');
});

test('erster und letzter Gültigkeitstag gehören einschließlich zur Tarifposition', () => {
  const finite = position({ validFrom: '2026-10-13', validUntil: '2026-10-13', openEnded: false });
  assert.equal(assessClientTariffPosition(finite, day).state, 'applicable');
});

test('künftige und abgelaufene Position bleiben nicht anwendbar', () => {
  const future = assessClientTariffPosition(position({ validFrom: '2026-10-14' }), day);
  const expired = assessClientTariffPosition(position({ validFrom: '2026-01-01', validUntil: '2026-10-12', openEnded: false }), day);
  assert.equal(future.state, 'not_applicable');
  assert.ok(future.issues.includes('not_started'));
  assert.equal(expired.state, 'not_applicable');
  assert.ok(expired.issues.includes('expired'));
});

test('fehlendes Ende wird nicht als unbefristet interpretiert', () => {
  const missing = position({ validUntil: null, openEnded: false });
  assert.equal(assessClientTariffPosition(missing, day).state, 'incomplete');
  assert.ok(assessClientTariffPosition(missing, day).issues.includes('valid_until_invalid'));
  assert.equal(assessClientTariffPosition(position({ validUntil: null, openEnded: true }), day).state, 'applicable');
});

test('umgekehrte und unmögliche Kalenderzeiträume werden verweigert', () => {
  assert.ok(assessClientTariffPosition(position({ validFrom: '2026-02-30' }), day).issues.includes('valid_from_invalid'));
  assert.ok(assessClientTariffPosition(position({ validFrom: '2026-08-01', validUntil: '2026-07-31', openEnded: false }), day).issues.includes('valid_until_invalid'));
});

for (const [field, issue] of [
  ['id', 'position_identity_missing'],
  ['logicalPositionId', 'logical_identity_missing'],
  ['tenantId', 'tenant_identity_missing'],
  ['clientId', 'client_identity_missing'],
  ['financingPathId', 'financing_path_identity_missing'],
  ['regionCode', 'region_missing'],
  ['payerName', 'payer_missing'],
  ['serviceCode', 'service_missing'],
  ['agreementReference', 'agreement_reference_missing'],
]) {
  test(`fehlende Originalbindung ${field} bleibt unvollständig`, () => {
    const result = assessClientTariffPosition(position({ [field]: '' }), day);
    assert.equal(result.state, 'incomplete');
    assert.ok(result.issues.includes(issue));
  });
}

test('Preis, Einheit, Währung und Version werden ohne stilles Normalisieren geprüft', () => {
  assert.ok(assessClientTariffPosition(position({ unitPriceCents: 15.4 }), day).issues.includes('price_invalid'));
  assert.ok(assessClientTariffPosition(position({ unitPriceCents: 0 }), day).issues.includes('price_invalid'));
  assert.ok(assessClientTariffPosition(position({ billingUnit: 'package' }), day).issues.includes('billing_unit_invalid'));
  assert.ok(assessClientTariffPosition(position({ currency: 'USD' }), day).issues.includes('currency_invalid'));
  assert.ok(assessClientTariffPosition(position({ version: 1.5 }), day).issues.includes('version_invalid'));
});

test('Region, Finanzierungsweg und Kostenträgerzuordnung sind exakte Auswahlgrenzen', () => {
  const rows = [
    position(),
    position({ id: 'other-region', logicalPositionId: 'other-region-logical', regionCode: 'BY' }),
    position({ id: 'other-path', logicalPositionId: 'other-path-logical', financingPathId: 'path-private' }),
    position({ id: 'self-pay', logicalPositionId: 'self-pay-logical', payerAssignmentId: null, payerName: 'Selbstzahler', payerIk: null }),
  ];
  assert.equal(selectClientTariffPosition(rows, selection())?.id, 'tariff-row-v2');
  assert.equal(selectClientTariffPosition(rows, selection({ regionCode: 'BY' }))?.id, 'other-region');
  assert.equal(selectClientTariffPosition(rows, selection({ payerAssignmentId: null }))?.id, 'self-pay');
});

test('mehrere passende Positionen werden nicht nach Default oder Neuanlage ausgewählt', () => {
  const duplicateScope = position({ id: 'ambiguous', logicalPositionId: 'ambiguous-logical', unitPriceCents: 1600 });
  assert.throws(() => selectClientTariffPosition([position(), duplicateScope], selection()), /Mehrere Tarifpositionen/);
});

test('ohne passende historische Position liefert die Auswahl null statt Fallbackpreis', () => {
  assert.equal(selectClientTariffPosition([position()], selection({ serviceDate: '2025-12-31' })), null);
});

test('doppelte native Position wird nicht still zusammengeführt', () => {
  assert.throws(() => assessClientTariffPositions([position(), position()], day), /Doppelte/);
});

test('Leistungsdatum und Auswahlschlüssel werden streng validiert', () => {
  assert.throws(() => assessClientTariffPosition(position(), '2026-02-30'));
  assert.throws(() => selectClientTariffPosition([position()], selection({ tenantId: '' })));
});

test('SQL bindet Tarifposition an Mandant, Fall und Weg, bleibt append-only und ohne Backfill', async () => {
  const sql = await fs.readFile(new URL('../../supabase/patches/ambulatory_client_tariff_positions.sql', import.meta.url), 'utf8');
  assert.match(sql, /FOREIGN KEY \(tenant_id, client_id, financing_path_id\)/);
  assert.match(sql, /REFERENCES public\.client_financing_paths\(tenant_id, client_id, id\)/);
  assert.match(sql, /region_code text NOT NULL/);
  assert.match(sql, /payer_ik text/);
  assert.match(sql, /unit_price_cents bigint NOT NULL CHECK \(unit_price_cents > 0\)/);
  assert.match(sql, /is_open_ended AND valid_until IS NULL/);
  assert.doesNotMatch(sql, /GRANT[^;]*(UPDATE|DELETE)/i);
  assert.doesNotMatch(sql, /INSERT INTO public\.client_tariff_positions\s*\([^;]+SELECT/is);
  assert.doesNotMatch(sql, /UPDATE\s+public\.client_tariff_positions/i);
  assert.match(sql, /tenant_id = public\.current_tenant_id\(\)/);
});

test('Lesepfad erhält historische Fassungen statt nur die aktuelle Version zu laden', async () => {
  const service = await fs.readFile(new URL('../../src/lib/clients/clientTariffPositionService.ts', import.meta.url), 'utf8');
  assert.match(service, /client_tariff_positions/);
  assert.match(service, /order\('valid_from'/);
  assert.doesNotMatch(service, /\.is\('replaced_at', null\)/);
});

test('Web zeigt Originalpreis und Zeitraum je Weg, native Standardkomponente bleibt leer', async () => {
  const [web, nativeDefault] = await Promise.all([
    fs.readFile(new URL('../../src/components/office/ClientParallelFinancingSummary.web.tsx', import.meta.url), 'utf8'),
    fs.readFile(new URL('../../src/components/office/ClientParallelFinancingSummary.tsx', import.meta.url), 'utf8'),
  ]);
  assert.match(web, /listClientTariffPositions/);
  assert.match(web, /position\.financingPathId === path\.id/);
  assert.match(web, /weder Kostenträger noch aktuellen Standardpreis automatisch/);
  assert.match(nativeDefault, /return null/);
});
