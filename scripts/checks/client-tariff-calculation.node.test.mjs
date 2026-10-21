import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { calculateClientTariffAmount } from '../../src/lib/clients/clientTariffCalculationDomain.ts';

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
  unitPriceCents: 5,
  currency: 'EUR',
  roundingRule: 'half_up_cent',
  surchargeBasisPoints: 0,
  fixedSurchargeCents: 0,
  validFrom: '2026-07-01',
  validUntil: null,
  openEnded: true,
  agreementReference: 'vereinbarung-original-2026-07',
  version: 2,
  supersedesPositionId: 'tariff-row-v1',
  createdAt: '2026-06-10T11:12:13.123456Z',
  ...overrides,
});

test('exakte halbe Centgrenze wird kaufmännisch aufgerundet', () => {
  const result = calculateClientTariffAmount(position(), '0,1');
  assert.equal(result.normalizedQuantity, '0.1');
  assert.equal(result.baseAmountCents, 1);
  assert.equal(result.totalAmountCents, 1);
  assert.equal(result.billingUnit, 'visit');
});

test('Abrunden und Aufrunden behandeln dieselbe Kleinmenge regelgebunden', () => {
  assert.equal(calculateClientTariffAmount(position({ roundingRule: 'floor_cent' }), '0.1').baseAmountCents, 0);
  assert.equal(calculateClientTariffAmount(position({ roundingRule: 'ceil_cent' }), '0.001').baseAmountCents, 1);
});

test('Dezimalpunkt und Dezimalkomma liefern ohne Binärgleitkomma denselben Betrag', () => {
  const tariff = position({ unitPriceCents: 10 });
  const comma = calculateClientTariffAmount(tariff, '0,29');
  const point = calculateClientTariffAmount(tariff, '0.290');
  assert.equal(comma.baseAmountCents, 3);
  assert.deepEqual(comma, point);
});

test('prozentualer Zuschlag wird nach dem Grundbetrag gerundet und Festzuschlag danach addiert', () => {
  const result = calculateClientTariffAmount(position({
    unitPriceCents: 100,
    surchargeBasisPoints: 250,
    fixedSurchargeCents: 7,
  }), '1');
  assert.deepEqual({
    base: result.baseAmountCents,
    percentage: result.percentageSurchargeCents,
    fixed: result.fixedSurchargeCents,
    total: result.totalAmountCents,
  }, { base: 100, percentage: 3, fixed: 7, total: 110 });
});

test('zulässige Betragsgrenze bleibt erhalten, Überschreitung wird verworfen', () => {
  assert.equal(calculateClientTariffAmount(position({ unitPriceCents: 999999999 }), '1').totalAmountCents, 999999999);
  assert.throws(
    () => calculateClientTariffAmount(position({ unitPriceCents: 999999999, fixedSurchargeCents: 1 }), '1'),
    /Betragsgrenze/,
  );
});

for (const invalid of ['', '0', '0.000', '-1', '+1', '1e2', '1 000', '1.2345', '100000', 'NaN']) {
  test(`unzulässige Menge ${JSON.stringify(invalid)} wird nicht normalisiert`, () => {
    assert.throws(() => calculateClientTariffAmount(position(), invalid), /Menge/);
  });
}

test('fehlende oder ungültige Berechnungsparameter erhalten keinen stillen Standard', () => {
  assert.throws(() => calculateClientTariffAmount(position({ roundingRule: null }), '1'), /Rundungsregel fehlt/);
  assert.throws(() => calculateClientTariffAmount(position({ surchargeBasisPoints: null }), '1'), /prozentualer Zuschlag fehlt/);
  assert.throws(() => calculateClientTariffAmount(position({ fixedSurchargeCents: null }), '1'), /Festzuschlag fehlt/);
  assert.throws(() => calculateClientTariffAmount(position({ surchargeBasisPoints: 10001 }), '1'), /prozentualer Zuschlag/);
  assert.throws(() => calculateClientTariffAmount(position({ fixedSurchargeCents: -1 }), '1'), /Festzuschlag/);
});

test('alte Tarifzeilen bleiben explizit unvollständig statt nachträglich befüllt zu werden', () => {
  assert.throws(() => calculateClientTariffAmount(position({
    roundingRule: null, surchargeBasisPoints: null, fixedSurchargeCents: null,
  }), '1'), /Rundungsregel fehlt/);
});

test('Mapper behandelt nicht vorhandene additive Felder als null und validiert dokumentierte Werte', async () => {
  const service = await fs.readFile(new URL('../../src/lib/clients/clientTariffPositionService.ts', import.meta.url), 'utf8');
  assert.match(service, /value === null \|\| value === undefined/);
  assert.match(service, /roundingRule: roundingRule as ClientTariffRoundingRule \| null/);
  assert.match(service, /surchargeBasisPoints < 0 \|\| surchargeBasisPoints > 10000/);
  assert.match(service, /fixedSurchargeCents < 0/);
});

test('SQL ergänzt nur nullable Regeln, rechnet exakt und führt keinen Daten-Backfill aus', async () => {
  const sql = await fs.readFile(new URL('../../supabase/patches/ambulatory_client_tariff_calculation.sql', import.meta.url), 'utf8');
  assert.match(sql, /ADD COLUMN IF NOT EXISTS rounding_rule text/);
  assert.match(sql, /surcharge_basis_points BETWEEN 0 AND 10000/);
  assert.match(sql, /scale\(p_quantity\) > 3/);
  assert.match(sql, /base_exact := p_quantity \* p_unit_price_cents/);
  assert.match(sql, /REVOKE ALL ON FUNCTION/);
  assert.doesNotMatch(sql, /UPDATE\s+public\.client_tariff_positions/i);
  assert.doesNotMatch(sql, /ADD COLUMN[^;]+DEFAULT/is);
});

test('Web kennzeichnet unvollständige Regeln, native Standardkomponente bleibt unverändert leer', async () => {
  const [web, nativeDefault] = await Promise.all([
    fs.readFile(new URL('../../src/components/office/ClientParallelFinancingSummary.web.tsx', import.meta.url), 'utf8'),
    fs.readFile(new URL('../../src/components/office/ClientParallelFinancingSummary.tsx', import.meta.url), 'utf8'),
  ]);
  assert.match(web, /Berechnungsregel oder Zuschlag nicht vollständig dokumentiert/);
  assert.match(web, /position\.surchargeBasisPoints/);
  assert.match(nativeDefault, /return null/);
});
