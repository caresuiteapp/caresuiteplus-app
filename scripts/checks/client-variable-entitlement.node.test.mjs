import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {
  evaluateClientVariableEntitlement,
  parseClientVariableEntitlementQuantity,
  projectClientVariableEntitlementConsumption,
  projectClientVariableEntitlementHistory,
  validateClientVariableEntitlementVersionAppend,
} from '../../src/lib/clients/clientVariableEntitlementDomain.ts';

const version = (overrides = {}) => ({
  id: 'entitlement-native-v1', logicalEntitlementId: 'entitlement-logical-native',
  tenantId: 'tenant-native', clientId: 'client-native', financingPathId: 'path-native', version: 1,
  entitlementKind: 'hours', unit: 'Stunden', allocatedQuantity: '20.5',
  decisionDocumentId: 'decision-native-v1', decisionReference: 'Bescheid B-100', decisionIssuedOn: '2026-01-05',
  validFrom: '2026-01-10', validUntil: '2026-06-30', predecessorVersionId: null, changeReason: null,
  basisFingerprint: 'sha256:basis-v1', recordedAt: '2026-01-05T10:11:12.123454Z', ...overrides,
});

const successor = (overrides = {}) => version({
  id: 'entitlement-native-v2', version: 2, allocatedQuantity: '30', decisionDocumentId: 'decision-native-v2',
  decisionReference: 'Änderungsbescheid B-200', decisionIssuedOn: '2026-06-05', validFrom: '2026-07-01',
  validUntil: null, predecessorVersionId: 'entitlement-native-v1', changeReason: 'Höherstufung',
  basisFingerprint: 'sha256:basis-v2', recordedAt: '2026-06-05T10:11:12.123455Z', ...overrides,
});

const usage = (overrides = {}) => ({
  id: 'usage-native-1', tenantId: 'tenant-native', clientId: 'client-native', financingPathId: 'path-native',
  entitlementVersionId: 'entitlement-native-v1', logicalEntitlementId: 'entitlement-logical-native', entitlementVersion: 1,
  entitlementKind: 'hours', unit: 'Stunden', basisFingerprint: 'sha256:basis-v1', serviceOn: '2026-02-01',
  quantity: '4.25', eventKind: 'usage', supersedesEventId: null, evidenceReference: 'proof-native-1', reason: null,
  recordedAt: '2026-02-01T12:13:14.123456Z', ...overrides,
});

test('aktuelle individuelle Grundlage nennt Bescheid, Datum und Fassung', () => {
  const result = evaluateClientVariableEntitlement([version()], {
    tenantId: 'tenant-native', clientId: 'client-native', financingPathId: 'path-native',
    entitlementKind: 'hours', serviceOn: '2026-02-01',
  });
  assert.equal(result.state, 'documented_current');
  assert.equal(result.version.id, 'entitlement-native-v1');
  assert.match(result.reason, /Bescheid B-100/);
  assert.match(result.reason, /2026-01-05/);
  assert.match(result.reason, /Fassung 1/);
});

test('Anspruch gilt einschließlich erstem und letztem Kalendertag', () => {
  const scope = { tenantId: 'tenant-native', clientId: 'client-native', financingPathId: 'path-native', entitlementKind: 'hours' };
  assert.equal(evaluateClientVariableEntitlement([version()], { ...scope, serviceOn: '2026-01-10' }).state, 'documented_current');
  assert.equal(evaluateClientVariableEntitlement([version()], { ...scope, serviceOn: '2026-06-30' }).state, 'documented_current');
});

test('vor und nach befristetem Bescheid wird kein Anspruch erfunden', () => {
  const scope = { tenantId: 'tenant-native', clientId: 'client-native', financingPathId: 'path-native', entitlementKind: 'hours' };
  assert.equal(evaluateClientVariableEntitlement([version()], { ...scope, serviceOn: '2026-01-09' }).state, 'not_documented');
  assert.equal(evaluateClientVariableEntitlement([version()], { ...scope, serviceOn: '2026-07-01' }).state, 'not_documented');
});

test('Änderungsbescheid wird ab seinem Gültigkeitsbeginn zur aktuellen Grundlage', () => {
  const result = evaluateClientVariableEntitlement([successor(), version()], {
    tenantId: 'tenant-native', clientId: 'client-native', financingPathId: 'path-native',
    entitlementKind: 'hours', serviceOn: '2026-07-01',
  });
  assert.equal(result.version.id, 'entitlement-native-v2');
  assert.match(result.reason, /Änderungsbescheid B-200/);
});

for (const [field, value] of [
  ['tenantId', 'tenant-other'], ['clientId', 'client-other'], ['financingPathId', 'path-other'], ['entitlementKind', 'days'],
]) test(`abweichender Scope ${field} übernimmt keinen fremden Anspruch`, () => {
  const result = evaluateClientVariableEntitlement([version()], {
    tenantId: 'tenant-native', clientId: 'client-native', financingPathId: 'path-native',
    entitlementKind: 'hours', serviceOn: '2026-02-01', [field]: value,
  });
  assert.equal(result.state, 'not_documented');
});

test('zwei gleichzeitig gültige individuelle Grundlagen werden nicht priorisiert', () => {
  const competing = version({ id: 'entitlement-other', logicalEntitlementId: 'logical-other', decisionDocumentId: 'doc-other', basisFingerprint: 'sha256:other' });
  assert.throws(() => evaluateClientVariableEntitlement([version(), competing], {
    tenantId: 'tenant-native', clientId: 'client-native', financingPathId: 'path-native',
    entitlementKind: 'hours', serviceOn: '2026-02-01',
  }), /Mehrere individuelle/);
});

test('native Fassungs-ID bleibt global eindeutig', () => {
  assert.throws(() => evaluateClientVariableEntitlement([
    version(), version({ logicalEntitlementId: 'logical-other', validFrom: '2027-01-01', validUntil: null }),
  ], {
    tenantId: 'tenant-native', clientId: 'client-native', financingPathId: 'path-native',
    entitlementKind: 'hours', serviceOn: '2026-02-01',
  }), /global eindeutig/);
});

test('lückenlose Bescheidfolge bleibt vollständig und sortiert', () => {
  assert.deepEqual(projectClientVariableEntitlementHistory([successor(), version()]).map((item) => item.version), [1, 2]);
});

for (const candidate of [
  successor({ version: 3 }), successor({ predecessorVersionId: 'wrong' }), successor({ validFrom: '2026-06-30' }),
  successor({ decisionIssuedOn: '2026-01-05' }), successor({ recordedAt: '2026-01-05T10:11:12.123454Z' }),
]) test(`ungültige Anspruchsfolge wird abgewiesen: ${JSON.stringify(candidate).slice(0, 48)}`, () => {
  assert.throws(() => projectClientVariableEntitlementHistory([version(), candidate]));
});

test('offene Vorfassung kann nicht still durch Folgefassung beendet werden', () => {
  assert.throws(() => projectClientVariableEntitlementHistory([version({ validUntil: null }), successor()]));
});

test('Änderung benötigt neuen Bescheid und neuen Fingerprint', () => {
  assert.throws(() => projectClientVariableEntitlementHistory([version(), successor({ decisionDocumentId: 'decision-native-v1' })]), /neue individuelle/);
  assert.throws(() => projectClientVariableEntitlementHistory([version(), successor({ basisFingerprint: 'sha256:basis-v1' })]), /neue individuelle/);
});

test('Historie darf Scope, Anspruchsart oder Einheit nicht wechseln', () => {
  assert.throws(() => projectClientVariableEntitlementHistory([version(), successor({ clientId: 'client-other' })]), /überschreitet/);
  assert.throws(() => projectClientVariableEntitlementHistory([version(), successor({ entitlementKind: 'days' })]), /überschreitet/);
  assert.throws(() => projectClientVariableEntitlementHistory([version(), successor({ unit: 'Tage' })]), /überschreitet/);
});

test('Dezimalmengen bleiben exakt auf vier Nachkommastellen skaliert', () => {
  assert.equal(parseClientVariableEntitlementQuantity('20.5001'), 205001);
  assert.equal(parseClientVariableEntitlementQuantity('0.0001'), 1);
  assert.throws(() => parseClientVariableEntitlementQuantity('1.00001'));
  assert.throws(() => parseClientVariableEntitlementQuantity('-1'));
});

test('Verbrauch berechnet Rest exakt aus wirksamen Ereignisköpfen', () => {
  const correction = usage({ id: 'usage-native-2', quantity: '3.5', eventKind: 'correction', supersedesEventId: 'usage-native-1', reason: 'Korrektur', recordedAt: '2026-02-02T12:13:14.123457Z' });
  const result = projectClientVariableEntitlementConsumption(version(), [usage(), correction]);
  assert.equal(result.allocatedQuantityScaled, 205000);
  assert.equal(result.consumedQuantityScaled, 35000);
  assert.equal(result.remainingQuantityScaled, 170000);
  assert.deepEqual(result.effectiveEvents.map((item) => item.id), ['usage-native-2']);
  assert.equal(result.history.length, 2);
});

test('Storno bewahrt Historie und setzt wirksamen Verbrauch auf null', () => {
  const cancellation = usage({ id: 'usage-native-2', quantity: '0', eventKind: 'cancellation', supersedesEventId: 'usage-native-1', reason: 'Doppelbuchung', recordedAt: '2026-02-02T12:13:14.123457Z' });
  const result = projectClientVariableEntitlementConsumption(version(), [usage(), cancellation]);
  assert.equal(result.consumedQuantityScaled, 0);
  assert.equal(result.history.length, 2);
});

for (const [field, value] of [
  ['tenantId', 'tenant-other'], ['clientId', 'client-other'], ['financingPathId', 'path-other'],
  ['entitlementVersionId', 'wrong'], ['logicalEntitlementId', 'wrong'], ['entitlementVersion', 2],
  ['entitlementKind', 'days'], ['unit', 'Tage'], ['basisFingerprint', 'wrong'],
]) test(`abweichende Verbrauchsbindung ${field} wird verworfen`, () => {
  assert.throws(() => projectClientVariableEntitlementConsumption(version(), [usage({ [field]: value })]), /konkrete individuelle/);
});

test('Verbrauch außerhalb des Bescheidzeitraums wird verworfen', () => {
  assert.throws(() => projectClientVariableEntitlementConsumption(version(), [usage({ serviceOn: '2026-07-01' })]), /außerhalb/);
});

test('Verbrauch vor Bescheiderfassung und Mikrosekundenverlust werden verworfen', () => {
  assert.throws(() => projectClientVariableEntitlementConsumption(version(), [usage({ recordedAt: '2026-01-05T10:11:12.123453Z' })]), /vor der/);
  assert.throws(() => projectClientVariableEntitlementConsumption(version(), [usage({ recordedAt: '2026-02-01T12:13:14.1234567Z' })]), /ungültig/);
});

test('Korrektur und Storno benötigen Vorgänger, Grund und passende Menge', () => {
  assert.throws(() => projectClientVariableEntitlementConsumption(version(), [usage({ eventKind: 'correction' })]));
  assert.throws(() => projectClientVariableEntitlementConsumption(version(), [usage({ eventKind: 'cancellation', quantity: '1', supersedesEventId: 'x', reason: 'x' })]));
  assert.throws(() => projectClientVariableEntitlementConsumption(version(), [usage({ eventKind: 'correction', quantity: '0', supersedesEventId: 'x', reason: 'x' })]));
});

test('fehlender, rückwärts erfasster und konkurrierender Vorgänger wird verworfen', () => {
  const correction = usage({ id: 'usage-native-2', quantity: '3', eventKind: 'correction', supersedesEventId: 'missing', reason: 'x', recordedAt: '2026-02-02T12:13:14.123457Z' });
  assert.throws(() => projectClientVariableEntitlementConsumption(version(), [usage(), correction]), /fehlt/);
  const backward = { ...correction, supersedesEventId: 'usage-native-1', recordedAt: '2026-02-01T12:13:14.123455Z' };
  assert.throws(() => projectClientVariableEntitlementConsumption(version(), [usage(), backward]), /nach ihrem Vorgänger/);
  const competing = { ...correction, id: 'usage-native-3', supersedesEventId: 'usage-native-1' };
  assert.throws(() => projectClientVariableEntitlementConsumption(version(), [usage(), { ...correction, supersedesEventId: 'usage-native-1' }, competing]), /mehrere Nachfolger/);
});

test('Korrektur und Storno dürfen das ursprüngliche Leistungsdatum nicht verschieben', () => {
  const correction = usage({ id: 'usage-native-2', quantity: '3', eventKind: 'correction', supersedesEventId: 'usage-native-1', reason: 'x', serviceOn: '2026-02-02', recordedAt: '2026-02-02T12:13:14.123457Z' });
  assert.throws(() => projectClientVariableEntitlementConsumption(version(), [usage(), correction]), /Leistungsdatum nicht verschieben/);
});

test('Überverbrauch bleibt sichtbar und wird nicht als Freigabe gekappt', () => {
  const result = projectClientVariableEntitlementConsumption(version({ allocatedQuantity: '2' }), [usage({ quantity: '3' })]);
  assert.equal(result.remainingQuantityScaled, -10000);
});

test('neue Anspruchsfassung darf andere Historie nicht überlappen', () => {
  const competing = version({ id: 'other-v1', logicalEntitlementId: 'logical-other', decisionDocumentId: 'doc-other', basisFingerprint: 'sha256:other' });
  assert.throws(() => validateClientVariableEntitlementVersionAppend([version()], [], competing), /überlappt/);
});

test('rückwirkende Anspruchsänderung darf gebundenen Verbrauch nicht entwerten', () => {
  assert.throws(() => validateClientVariableEntitlementVersionAppend([version()], [usage({ serviceOn: '2026-07-02' })], successor()), /rückwirkend/);
});

test('Mapper erhalten native IDs, Bescheidbindung, Fingerprint, Menge und Mikrosekunden', async () => {
  const service = await fs.readFile(new URL('../../src/lib/clients/clientVariableEntitlementService.ts', import.meta.url), 'utf8');
  assert.match(service, /logicalEntitlementId: required\(row\.logical_entitlement_id/);
  assert.match(service, /decisionDocumentId: required\(row\.decision_document_id/);
  assert.match(service, /basisFingerprint: required\(row\.basis_fingerprint/);
  assert.match(service, /allocatedQuantity: quantityText\(row\.allocated_quantity/);
  assert.match(service, /entitlementVersionId: required\(row\.entitlement_version_id/);
  assert.match(service, /recordedAt: required\(row\.recorded_at/);
});

test('SQL erzwingt append-only Bescheidfassung, exakte Verbrauchsbindung und Mandant', async () => {
  const sql = await fs.readFile(new URL('../../supabase/patches/ambulatory_client_variable_entitlements.sql', import.meta.url), 'utf8');
  assert.match(sql, /FOREIGN KEY \(tenant_id, client_id, logical_entitlement_id, entitlement_version_id, entitlement_version, basis_fingerprint\)/);
  assert.match(sql, /financing_path_id uuid NOT NULL REFERENCES public\.client_financing_paths\(id\)/);
  assert.match(sql, /v_match_count <> 1/);
  assert.match(sql, /gebundenen Verbrauch rueckwirkend entwerten/);
  assert.match(sql, /ENABLE ROW LEVEL SECURITY/);
  assert.match(sql, /GRANT SELECT, INSERT/);
  assert.doesNotMatch(sql, /GRANT[^;]*(UPDATE|DELETE)|\bUPDATE\s+public\.client_variable_entitlement|\bDELETE\s+FROM\s+public\.client_variable_entitlement/i);
  assert.doesNotMatch(sql, /INSERT\s+INTO\s+public\.client_variable_entitlement[^\n]*SELECT/i);
});

test('Web zeigt aktuellen individuellen Bescheid und Native-Komponente bleibt leer', async () => {
  const web = await fs.readFile(new URL('../../src/components/office/ClientVariableEntitlementSummary.web.tsx', import.meta.url), 'utf8');
  const native = await fs.readFile(new URL('../../src/components/office/ClientVariableEntitlementSummary.tsx', import.meta.url), 'utf8');
  assert.match(web, /Aktuelle individuelle Bescheidfassung/);
  assert.match(web, /Allgemeine Regeln, ein Finanzierungsweg oder ein alter Anspruch/);
  assert.match(web, /Anspruch .*Verbrauch .*Rest/);
  assert.match(web, /bestätigen weder Leistungserbringung/);
  assert.match(native, /return null/);
  assert.doesNotMatch(native, /react-native|supabase|useAsyncQuery/);
});
