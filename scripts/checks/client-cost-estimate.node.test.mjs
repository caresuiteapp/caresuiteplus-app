import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { assessClientCostEstimate } from '../../src/lib/clients/clientCostEstimateDomain.ts';

const estimate = (overrides = {}) => ({
  id: 'estimate-native-v1', logicalEstimateId: 'estimate-logical-native',
  tenantId: 'tenant-native', clientId: 'client-native', financingPathId: 'path-native-xi',
  version: 1, status: 'issued', issueDate: '2026-05-01', validUntil: '2026-06-30',
  servicePeriodStart: '2026-07-01', servicePeriodEnd: '2026-09-30',
  payerContributionCents: 10000, selfPayCents: 5000, currency: 'EUR',
  contentFingerprint: 'sha256:estimate-v1-original', supersedesEstimateId: null,
  createdAt: '2026-05-01T09:10:11.123456Z', ...overrides,
});

const line = (overrides = {}) => ({
  id: 'line-native-1', tenantId: 'tenant-native', clientId: 'client-native', financingPathId: 'path-native-xi',
  estimateVersionId: 'estimate-native-v1', tariffPositionId: 'tariff-native-v7',
  serviceCode: 'LK-01', serviceLabel: 'Pflegeeinsatz', billingUnit: 'visit', normalizedQuantity: '1.000',
  frequencyCount: 3, frequencyUnit: 'month', occurrenceAmountCents: 5000, totalAmountCents: 15000,
  ...overrides,
});

const decision = (overrides = {}) => ({
  id: 'decision-native-1', tenantId: 'tenant-native', clientId: 'client-native', financingPathId: 'path-native-xi',
  estimateVersionId: 'estimate-native-v1', logicalEstimateId: 'estimate-logical-native', estimateVersion: 1,
  contentFingerprint: 'sha256:estimate-v1-original', decision: 'accepted',
  decidedAt: '2026-05-02T10:11:12.123457Z', decidedByName: 'Erika Beispiel',
  decidedByRole: 'Bevollmächtigte Person', evidenceReference: 'signed-offer-native-v1', ...overrides,
});

test('Annahme bindet exakt die unveränderte Angebotsversion samt Nachweis', () => {
  const result = assessClientCostEstimate(estimate(), [line()], [decision()], '2026-06-01');
  assert.equal(result.state, 'accepted');
  assert.equal(result.decision?.estimateVersionId, 'estimate-native-v1');
  assert.equal(result.decision?.contentFingerprint, 'sha256:estimate-v1-original');
  assert.equal(result.decision?.evidenceReference, 'signed-offer-native-v1');
});

for (const [field, value] of [
  ['tenantId', 'other-tenant'], ['clientId', 'other-client'], ['financingPathId', 'other-path'],
  ['estimateVersionId', 'estimate-native-v2'], ['logicalEstimateId', 'other-logical'],
  ['estimateVersion', 2], ['contentFingerprint', 'sha256:changed-content'],
]) {
  test(`abweichende Annahmebindung ${field} wird verworfen`, () => {
    assert.throws(() => assessClientCostEstimate(estimate(), [line()], [decision({ [field]: value })], '2026-06-01'), /Scope|konkrete Angebotsversion/);
  });
}

test('mehrere Entscheidungen zu derselben Version werden nicht priorisiert', () => {
  assert.throws(() => assessClientCostEstimate(estimate(), [line()], [decision(), decision({ id: 'decision-native-2', decision: 'declined' })], '2026-06-01'), /mehrere Entscheidungen/);
});

test('Entwurf darf auch mit Unterschriftsnachweis nicht als angenommen gelten', () => {
  assert.throws(() => assessClientCostEstimate(estimate({ status: 'draft' }), [line()], [decision()], '2026-06-01'), /Entwurf darf nicht/);
});

test('Entscheidung vor Erzeugung und ungenauer Zeittext werden verworfen', () => {
  assert.throws(() => assessClientCostEstimate(estimate(), [line()], [decision({ decidedAt: '2026-05-01T09:10:11.123455Z' })], '2026-06-01'), /vor der Angebotsversion/);
  assert.throws(() => assessClientCostEstimate(estimate(), [line()], [decision({ decidedAt: '2026-05-02' })], '2026-06-01'), /Entscheidungszeit ist ungültig/);
});

test('Leistungszeilen frieren Tarifposition, Menge, Häufigkeit und Betrag ein', () => {
  const result = assessClientCostEstimate(estimate(), [line()], [], '2026-06-01');
  assert.equal(result.totalAmountCents, 15000);
  assert.equal(result.lines[0].tariffPositionId, 'tariff-native-v7');
  assert.equal(result.lines[0].normalizedQuantity, '1.000');
  assert.equal(result.lines[0].frequencyCount, 3);
  assert.equal(result.state, 'offered');
});

test('ein späterer Tarifwert ändert die eingefrorene Angebotszeile nicht', () => {
  const frozen = line();
  const laterTariffOccurrenceAmountCents = 9999;
  const result = assessClientCostEstimate(estimate(), [frozen], [], '2026-06-01');
  assert.equal(result.totalAmountCents, 15000);
  assert.notEqual(result.lines[0].occurrenceAmountCents, laterTariffOccurrenceAmountCents);
});

test('Einzelbetrag mal Häufigkeit muss exakt dem Zeilengesamt entsprechen', () => {
  assert.throws(() => assessClientCostEstimate(estimate(), [line({ totalAmountCents: 14999 })], [], '2026-06-01'), /Zeilengesamt/);
});

test('Kostenträger- und Eigenanteil müssen exakt das Angebot decken', () => {
  assert.throws(() => assessClientCostEstimate(estimate({ selfPayCents: 4999 }), [line()], [], '2026-06-01'), /Eigenanteil/);
});

test('fehlende und doppelte Leistungszeilen werden verweigert', () => {
  assert.throws(() => assessClientCostEstimate(estimate(), [], [], '2026-06-01'), /keine Leistungszeile/);
  assert.throws(() => assessClientCostEstimate(estimate({ payerContributionCents: 25000 }), [line(), line()], [], '2026-06-01'), /nicht eindeutig/);
});

test('Leistungszeile einer fremden Angebotsversion wird verweigert', () => {
  assert.throws(() => assessClientCostEstimate(estimate(), [line({ estimateVersionId: 'estimate-native-v2' })], [], '2026-06-01'), /konkreten Angebotsversion/);
});

for (const [field, value] of [['tenantId', 'other-tenant'], ['clientId', 'other-client'], ['financingPathId', 'other-path']]) {
  test(`Leistungszeile mit fremdem Scope ${field} wird verweigert`, () => {
    assert.throws(() => assessClientCostEstimate(estimate(), [line({ [field]: value })], [], '2026-06-01'), /Angebots-Scope/);
  });
}

test('Angebots- und Leistungszeitraumgrenzen bleiben getrennt und gültig', () => {
  assert.throws(() => assessClientCostEstimate(estimate({ validUntil: '2026-04-30' }), [line()], [], '2026-06-01'), /Angebotsfrist/);
  assert.throws(() => assessClientCostEstimate(estimate({ servicePeriodEnd: '2026-06-30' }), [line()], [], '2026-06-01'), /Leistungszeitraum/);
});

test('Angebotsfrist ist am Grenztag einschließlich und danach abgelaufen', () => {
  assert.equal(assessClientCostEstimate(estimate(), [line()], [], '2026-06-30').state, 'offered');
  assert.equal(assessClientCostEstimate(estimate(), [line()], [], '2026-07-01').state, 'expired');
});

for (const [status, expected] of [['draft', 'draft'], ['superseded', 'superseded'], ['withdrawn', 'withdrawn']]) {
  test(`Angebotsstatus ${status} bleibt ohne Entscheidung ${expected}`, () => {
    assert.equal(assessClientCostEstimate(estimate({ status }), [line()], [], '2026-06-01').state, expected);
  });
}

test('historische Annahme bleibt an Version 1 gebunden, wenn sie später abgelöst wird', () => {
  const result = assessClientCostEstimate(estimate({ status: 'superseded' }), [line()], [decision()], '2026-08-01');
  assert.equal(result.state, 'accepted');
  assert.equal(result.estimate.version, 1);
  assert.equal(result.decision?.estimateVersion, 1);
});

test('Folgeversion benötigt nativen Vorgänger, Erstversion darf keinen tragen', () => {
  assert.throws(() => assessClientCostEstimate(estimate({ version: 2 }), [line()], [], '2026-06-01'), /Folgeversion/);
  assert.throws(() => assessClientCostEstimate(estimate({ supersedesEstimateId: 'estimate-v0' }), [line()], [], '2026-06-01'), /Erste Angebotsversion/);
});

test('Mapper bewahren native IDs, Fingerprint und Mikrosekunden als Originaltext', async () => {
  const service = await fs.readFile(new URL('../../src/lib/clients/clientCostEstimateService.ts', import.meta.url), 'utf8');
  assert.match(service, /id: required\(row\.id, 'id'\)/);
  assert.match(service, /tenantId: required\(row\.tenant_id, 'tenant_id'\)/);
  assert.match(service, /contentFingerprint: required\(row\.content_fingerprint, 'content_fingerprint'\)/);
  assert.match(service, /decidedAt: required\(row\.decided_at, 'decided_at'\)/);
  assert.doesNotMatch(service, /new Date\(row\.(?:created_at|decided_at)/);
  assert.equal(assessClientCostEstimate(estimate(), [line()], [decision()], '2026-06-01').decision?.decidedAt, '2026-05-02T10:11:12.123457Z');
});

test('SQL bindet Scope, Version und Fingerprint, erzwingt einen Vorgänger und bleibt append-only', async () => {
  const sql = await fs.readFile(new URL('../../supabase/patches/ambulatory_client_cost_estimates.sql', import.meta.url), 'utf8');
  assert.match(sql, /logical_estimate_id, estimate_version, content_fingerprint[\s\S]*REFERENCES public\.client_cost_estimates/);
  assert.match(sql, /v_predecessor_version <> NEW\.version - 1/);
  assert.match(sql, /UNIQUE \(tenant_id, client_id, estimate_version_id\)/);
  assert.match(sql, /v_status = 'draft' OR NEW\.decided_at < v_created_at/);
  assert.match(sql, /GRANT SELECT, INSERT ON public\.client_cost_estimate_decisions/);
  assert.doesNotMatch(sql, /GRANT[^;]*UPDATE[^;]*client_cost_estimate/i);
  assert.doesNotMatch(sql, /UPDATE\s+public\.client_cost_estimate/i);
});

test('SQL friert Leistungswerte ein und enthält keinen Bestandsdaten-Backfill', async () => {
  const sql = await fs.readFile(new URL('../../supabase/patches/ambulatory_client_cost_estimates.sql', import.meta.url), 'utf8');
  assert.match(sql, /tariff_position_id uuid NOT NULL/);
  assert.match(sql, /normalized_quantity text NOT NULL/);
  assert.match(sql, /total_amount_cents = occurrence_amount_cents \* frequency_count/);
  assert.doesNotMatch(sql, /INSERT INTO public\.client_cost_estimates\s+SELECT/i);
});

test('Web zeigt konkrete Version, Leistungszeitraum, Eigenanteil und Annahmenachweis; Android bleibt unverändert', async () => {
  const [web, nativeDefault] = await Promise.all([
    fs.readFile(new URL('../../src/components/office/ClientParallelFinancingSummary.web.tsx', import.meta.url), 'utf8'),
    fs.readFile(new URL('../../src/components/office/ClientParallelFinancingSummary.tsx', import.meta.url), 'utf8'),
  ]);
  assert.match(web, /Kostenvoranschlag Version \{estimate\.version\}/);
  assert.match(web, /Eigenanteil \{formatBudgetAmount\(estimate\.selfPayCents\)\}/);
  assert.match(web, /Nachweis \$\{assessment\.decision\.evidenceReference\}/);
  assert.match(web, /Leistungserbringung/);
  assert.match(nativeDefault, /return null/);
});
