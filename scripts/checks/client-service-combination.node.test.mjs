import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {
  evaluateClientServiceCombination,
  projectClientServiceCombinationRuleHistory,
  validateClientServiceCombinationReview,
  validateClientServiceCombinationRuleAppend,
} from '../../src/lib/clients/clientServiceCombinationDomain.ts';

const rule = (overrides = {}) => ({
  id: 'rule-native-v1', logicalRuleId: 'rule-logical-native', tenantId: 'tenant-native', version: 1,
  financingKind: 'sgb_xi', costCarrierReference: 'payer-native-a', serviceTypeA: 'leistung-a', serviceTypeB: 'leistung-b',
  outcome: 'prohibited', surchargeServiceType: null, validFrom: '2026-01-01', validUntil: '2026-06-30',
  predecessorRuleId: null, ruleTitle: 'Kombinationsregel 7', ruleReference: 'RV-7/2026',
  contentFingerprint: 'sha256:rule-v1', recordedAt: '2025-12-01T09:10:11.123454Z', ...overrides,
});

const successor = (overrides = {}) => rule({
  id: 'rule-native-v2', version: 2, outcome: 'surcharge_required', surchargeServiceType: 'zuschlag-c',
  validFrom: '2026-07-01', validUntil: null, predecessorRuleId: 'rule-native-v1',
  ruleTitle: 'Kombinationsregel 8', ruleReference: 'RV-8/2026', contentFingerprint: 'sha256:rule-v2',
  recordedAt: '2026-06-01T09:10:11.123455Z', ...overrides,
});

const review = (overrides = {}) => ({
  id: 'review-native', tenantId: 'tenant-native', clientId: 'client-native', financingPathId: 'path-native',
  financingKind: 'sgb_xi', costCarrierReference: 'payer-native-a', serviceTypeA: 'leistung-a', serviceTypeB: 'leistung-b',
  serviceOn: '2026-05-01', ruleId: 'rule-native-v1', logicalRuleId: 'rule-logical-native', ruleVersion: 1,
  ruleFingerprint: 'sha256:rule-v1', outcome: 'prohibited', surchargeServiceType: null,
  evidenceReference: 'review-document-native', evaluatedAt: '2026-05-01T10:11:12.123456Z', ...overrides,
});

test('unzulässige Kombination nennt konkrete Regel, Referenz und gültiges Datum', () => {
  const result = evaluateClientServiceCombination([rule()], review());
  assert.equal(result.state, 'prohibited');
  assert.match(result.reason, /Kombinationsregel 7/);
  assert.match(result.reason, /RV-7\/2026/);
  assert.match(result.reason, /2026-01-01/);
});

test('Regel gilt inklusive erstem und letztem Kalendertag', () => {
  assert.equal(evaluateClientServiceCombination([rule()], review({ serviceOn: '2026-01-01' })).state, 'prohibited');
  assert.equal(evaluateClientServiceCombination([rule()], review({ serviceOn: '2026-06-30' })).state, 'prohibited');
});

test('vor und nach einem befristeten Zeitraum wird keine Zulässigkeit erfunden', () => {
  assert.equal(evaluateClientServiceCombination([rule()], review({ serviceOn: '2025-12-31' })).state, 'not_documented');
  assert.equal(evaluateClientServiceCombination([rule()], review({ serviceOn: '2026-07-01' })).state, 'not_documented');
});

test('Nachfolgeregel verlangt ab ihrem Datum den konkreten Zuschlag', () => {
  const result = evaluateClientServiceCombination([rule(), successor()], review({ serviceOn: '2026-07-01' }));
  assert.equal(result.state, 'surcharge_required');
  assert.equal(result.rule.surchargeServiceType, 'zuschlag-c');
  assert.match(result.reason, /zuschlag-c/);
});

test('Reihenfolge der angefragten Leistungsarten ändert die Kombination nicht', () => {
  const result = evaluateClientServiceCombination([rule()], review({ serviceTypeA: 'leistung-b', serviceTypeB: 'leistung-a' }));
  assert.equal(result.state, 'prohibited');
});

for (const [field, value] of [
  ['tenantId', 'tenant-other'], ['financingKind', 'sgb_v'], ['costCarrierReference', 'payer-other'],
  ['serviceTypeA', 'leistung-c'], ['serviceTypeB', 'leistung-c'],
]) test(`abweichender Scope ${field} übernimmt keine fremde Regel`, () => {
  const input = review({ [field]: value });
  assert.equal(evaluateClientServiceCombination([rule()], input).state, 'not_documented');
});

test('dieselbe Leistungsart wird nicht als Kombination ausgelegt', () => {
  assert.throws(() => evaluateClientServiceCombination([rule()], review({ serviceTypeB: 'leistung-a' })), /zwei verschiedene/);
});

test('zwei gleichzeitig passende Regeln werden nicht willkürlich priorisiert', () => {
  const competing = rule({ id: 'rule-other', logicalRuleId: 'logical-other', ruleReference: 'OTHER' });
  assert.throws(() => evaluateClientServiceCombination([rule(), competing], review()), /Mehrere Regeln/);
});

test('dieselbe native Regel-ID in zwei Historien wird nicht priorisiert', () => {
  const duplicate = rule({ logicalRuleId: 'logical-other', validFrom: '2027-01-01', validUntil: null });
  assert.throws(() => evaluateClientServiceCombination([rule(), duplicate], review()), /global eindeutig/);
});

test('neue fremde Regelhistorie darf bestehenden Zeitraum nicht überlappen', () => {
  const competing = rule({ id: 'rule-other', logicalRuleId: 'logical-other', validFrom: '2026-06-01', validUntil: null });
  assert.throws(() => validateClientServiceCombinationRuleAppend([rule()], competing), /überlappt/);
});

test('lückenlose nicht überlappende Regelhistorie bleibt vollständig', () => {
  assert.deepEqual(projectClientServiceCombinationRuleHistory([successor(), rule()]).map((item) => item.version), [1, 2]);
});

for (const candidate of [
  successor({ version: 3 }), successor({ predecessorRuleId: 'wrong' }), successor({ validFrom: '2026-06-30' }),
  successor({ recordedAt: '2025-12-01T09:10:11.123454Z' }), successor({ logicalRuleId: 'other' }),
]) test(`ungültige Folgefassung wird abgewiesen: ${JSON.stringify(candidate).slice(0, 45)}`, () => {
  assert.throws(() => projectClientServiceCombinationRuleHistory([rule(), candidate]));
});

test('offener Vorgänger kann nicht unverändert durch Folgeversion beendet werden', () => {
  assert.throws(() => projectClientServiceCombinationRuleHistory([rule({ validUntil: null }), successor()]));
});

test('Zuschlagsregel verlangt Zuschlagsleistung und andere Ergebnisse verbieten sie', () => {
  assert.throws(() => projectClientServiceCombinationRuleHistory([rule({ outcome: 'surcharge_required', surchargeServiceType: null })]), /Zuschlagsleistung/);
  assert.throws(() => projectClientServiceCombinationRuleHistory([rule({ surchargeServiceType: 'zuschlag-c' })]), /ohne Zuschlag/);
});

test('umgekehrter, kalenderwidriger und unsortierter Regelbestand wird verworfen', () => {
  assert.throws(() => projectClientServiceCombinationRuleHistory([rule({ validUntil: '2025-12-31' })]), /umgekehrt/);
  assert.throws(() => projectClientServiceCombinationRuleHistory([rule({ validFrom: '2026-02-30' })]), /ungültig/);
  assert.throws(() => projectClientServiceCombinationRuleHistory([rule({ serviceTypeA: 'leistung-b', serviceTypeB: 'leistung-a' })]), /sortiert/);
});

test('exakt gebundene Prüfung bewahrt unzulässiges Ergebnis und Originalregel', () => {
  const result = validateClientServiceCombinationReview(review(), [rule()]);
  assert.equal(result.rule.id, 'rule-native-v1');
  assert.equal(result.state, 'prohibited');
});

for (const [field, value] of [
  ['ruleId', 'wrong'], ['logicalRuleId', 'wrong'], ['ruleVersion', 2], ['ruleFingerprint', 'wrong'],
  ['outcome', 'allowed'], ['surchargeServiceType', 'zuschlag-c'],
]) test(`abweichende gespeicherte Regelbindung ${field} wird verworfen`, () => {
  assert.throws(() => validateClientServiceCombinationReview(review({ [field]: value }), [rule()]));
});

test('Prüfung vor Regelerfassung und Mikrosekundenverlust werden verworfen', () => {
  assert.throws(() => validateClientServiceCombinationReview(review({ evaluatedAt: '2025-12-01T09:10:11.123453Z' }), [rule()]), /vor der/);
  assert.throws(() => validateClientServiceCombinationReview(review({ evaluatedAt: '2026-05-01T10:11:12.1234567Z' }), [rule()]), /ungültig/);
});

test('Mapper erhalten native IDs, Regelbindung, Datum, Fingerprint und Mikrosekunden', async () => {
  const service = await fs.readFile(new URL('../../src/lib/clients/clientServiceCombinationService.ts', import.meta.url), 'utf8');
  assert.match(service, /logicalRuleId: required\(row\.logical_rule_id/);
  assert.match(service, /costCarrierReference: required\(row\.cost_carrier_reference/);
  assert.match(service, /predecessorRuleId: nullable\(row\.predecessor_rule_id/);
  assert.match(service, /contentFingerprint: required\(row\.content_fingerprint/);
  assert.match(service, /recordedAt: required\(row\.recorded_at/);
  assert.match(service, /financingPathId: required\(row\.financing_path_id/);
  assert.match(service, /ruleFingerprint: required\(row\.rule_fingerprint/);
  assert.match(service, /evaluatedAt: required\(row\.evaluated_at/);
});

test('SQL erzwingt append-only exakte Regelfassung, Finanzierungsweg und Mandant', async () => {
  const sql = await fs.readFile(new URL('../../supabase/patches/ambulatory_client_service_combinations.sql', import.meta.url), 'utf8');
  assert.match(sql, /FOREIGN KEY \(tenant_id, logical_rule_id, rule_id, rule_version, rule_fingerprint\)/);
  assert.match(sql, /financing_path_id uuid NOT NULL REFERENCES public\.client_financing_paths\(id\)/);
  assert.match(sql, /v_match_count <> 1/);
  assert.match(sql, /service_type_a < service_type_b/);
  assert.match(sql, /ENABLE ROW LEVEL SECURITY/);
  assert.match(sql, /GRANT SELECT, INSERT/);
  assert.doesNotMatch(sql, /GRANT[^;]*(UPDATE|DELETE)|\bUPDATE\s+public\.client_service_combination|\bDELETE\s+FROM\s+public\.client_service_combination/i);
  assert.doesNotMatch(sql, /INSERT\s+INTO\s+public\.client_service_combination[^\n]*SELECT/i);
});

test('Web zeigt konkrete unzulässige Regel und Native-Komponente bleibt leer', async () => {
  const web = await fs.readFile(new URL('../../src/components/office/ClientServiceCombinationSummary.web.tsx', import.meta.url), 'utf8');
  const native = await fs.readFile(new URL('../../src/components/office/ClientServiceCombinationSummary.tsx', import.meta.url), 'utf8');
  assert.match(web, /Unzulässige Kombination/);
  assert.match(web, /evaluation\.reason/);
  assert.match(web, /Regelfassung/);
  assert.match(web, /bestätigt weder Leistungserbringung noch Genehmigung/);
  assert.match(native, /return null/);
  assert.doesNotMatch(native, /react-native|supabase|useAsyncQuery/);
});
