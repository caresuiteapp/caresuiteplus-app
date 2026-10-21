import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {
  projectClientContractLifecycle,
  selectClientContractEventForServiceDate,
  validateClientContractLifecycleAppend,
  validateClientContractServiceBinding,
} from '../../src/lib/clients/clientContractLifecycleDomain.ts';

const initial = (overrides = {}) => ({
  id: 'contract-event-native-v1', logicalContractId: 'contract-logical-native', sourceContractId: 'contract-source-native',
  tenantId: 'tenant-native', clientId: 'client-native', version: 1, kind: 'initial', effectiveOn: '2026-01-01',
  changeReason: null, consequences: null, predecessorEventId: null, contractNumber: 'V-100',
  contractPartner: 'Pflegekundin', serviceBasis: 'Ambulanter Pflegevertrag', documentReference: 'document-native-v1',
  contentFingerprint: 'sha256:contract-v1', recordedAt: '2025-12-01T09:10:11.123454Z', ...overrides,
});

const amendment = (overrides = {}) => ({
  ...initial(), id: 'contract-event-native-v2', version: 2, kind: 'amendment', effectiveOn: '2026-04-01',
  changeReason: 'Leistungsumfang angepasst', consequences: 'Neue Leistungsanlage gilt ab Wirksamkeitsdatum',
  predecessorEventId: 'contract-event-native-v1', documentReference: 'document-native-v2',
  contentFingerprint: 'sha256:contract-v2', recordedAt: '2026-03-01T09:10:11.123455Z', ...overrides,
});

const closure = (overrides = {}) => ({
  ...amendment(), id: 'contract-event-native-v3', version: 3, kind: 'closure', effectiveOn: '2026-08-01',
  changeReason: 'Vertrag beendet', consequences: 'Neue Leistungen ab Wirksamkeitsdatum nicht mehr zuordnen',
  predecessorEventId: 'contract-event-native-v2', documentReference: 'document-native-v3',
  contentFingerprint: 'sha256:contract-v3', recordedAt: '2026-07-01T09:10:11.123456Z', ...overrides,
});

const binding = (overrides = {}) => ({
  id: 'binding-native-1', tenantId: 'tenant-native', clientId: 'client-native', logicalContractId: 'contract-logical-native',
  lifecycleEventId: 'contract-event-native-v2', lifecycleVersion: 2, lifecycleFingerprint: 'sha256:contract-v2',
  serviceEvidenceId: 'service-evidence-native', serviceOccurredOn: '2026-05-15', linkedAt: '2026-08-02T10:11:12.123456Z',
  ...overrides,
});

test('lückenlose Änderung und Schließung ergeben eine geschlossene Originalhistorie', () => {
  const result = projectClientContractLifecycle([closure(), initial(), amendment()]);
  assert.equal(result.state, 'closed');
  assert.equal(result.currentEvent.id, 'contract-event-native-v3');
  assert.deepEqual(result.events.map((event) => event.version), [1, 2, 3]);
});

test('aktive Änderung bleibt vor einer Schließung aktueller Vertragsstand', () => {
  const result = projectClientContractLifecycle([initial(), amendment()]);
  assert.equal(result.state, 'active');
  assert.equal(result.currentEvent.id, 'contract-event-native-v2');
});

test('historische Leistungsdaten wählen die damals wirksame Fassung', () => {
  const events = [initial(), amendment(), closure()];
  assert.equal(selectClientContractEventForServiceDate(events, '2026-03-31')?.id, 'contract-event-native-v1');
  assert.equal(selectClientContractEventForServiceDate(events, '2026-04-01')?.id, 'contract-event-native-v2');
});

test('Schließung sperrt das Wirksamkeitsdatum und spätere Leistungszuordnung', () => {
  const events = [initial(), amendment(), closure()];
  assert.equal(selectClientContractEventForServiceDate(events, '2026-08-01'), null);
  assert.equal(selectClientContractEventForServiceDate(events, '2026-09-01'), null);
});

test('vor Vertragsbeginn wird keine Fassung erfunden', () => {
  assert.equal(selectClientContractEventForServiceDate([initial()], '2025-12-31'), null);
});

test('historische Leistungsreferenz bleibt auch nach späterer Schließung exakt gültig', () => {
  const selected = validateClientContractServiceBinding(binding(), [initial(), amendment(), closure()]);
  assert.equal(selected.id, 'contract-event-native-v2');
  assert.equal(selected.contentFingerprint, 'sha256:contract-v2');
});

test('zukünftige Schließung lässt frühere Leistungsreferenz unverändert', () => {
  const projected = validateClientContractLifecycleAppend([initial(), amendment()], [binding()], closure());
  assert.equal(projected.state, 'closed');
  assert.equal(validateClientContractServiceBinding(binding(), projected.events).id, amendment().id);
});

test('rückwirkende Änderung darf bestehende Leistungsreferenz nicht entwerten', () => {
  const existingBinding = binding({ lifecycleEventId: initial().id, lifecycleVersion: 1, lifecycleFingerprint: initial().contentFingerprint, serviceOccurredOn: '2026-03-15', linkedAt: '2026-03-16T10:11:12.123456Z' });
  assert.throws(
    () => validateClientContractLifecycleAppend([initial()], [existingBinding], amendment({ effectiveOn: '2026-03-01' })),
    /Rückwirkende Vertragsfassung/,
  );
});

for (const [field, value] of [
  ['tenantId', 'other-tenant'], ['clientId', 'other-client'], ['logicalContractId', 'other-contract'],
]) {
  test(`fremder Leistungs-Scope ${field} wird verworfen`, () => {
    assert.throws(() => validateClientContractServiceBinding(binding({ [field]: value }), [initial(), amendment(), closure()]), /Vertragsscope/);
  });
}

for (const [field, value] of [
  ['lifecycleEventId', 'contract-event-native-v1'], ['lifecycleVersion', 1], ['lifecycleFingerprint', 'sha256:changed'],
]) {
  test(`abweichende Versionsbindung ${field} wird verworfen`, () => {
    assert.throws(() => validateClientContractServiceBinding(binding({ [field]: value }), [initial(), amendment(), closure()]), /datumsgültige konkrete Vertragsfassung/);
  });
}

test('Leistungsreferenz am oder nach Schließungsdatum wird verweigert', () => {
  assert.throws(() => validateClientContractServiceBinding(binding({ serviceOccurredOn: '2026-08-01' }), [initial(), amendment(), closure()]), /keine aktive Vertragsfassung/);
});

test('Zuordnung vor Erfassung der gebundenen Fassung wird verweigert', () => {
  assert.throws(() => validateClientContractServiceBinding(binding({ linkedAt: '2026-03-01T09:10:11.123454Z' }), [initial(), amendment()]), /vor der Vertragsfassung/);
});

test('mikrosekundengenau spätere Zuordnung wird akzeptiert', () => {
  const selected = validateClientContractServiceBinding(binding({
    serviceOccurredOn: '2026-04-01', linkedAt: '2026-03-01T09:10:11.123456Z',
  }), [initial(), amendment()]);
  assert.equal(selected.version, 2);
});

test('mehr als sechs Nachkommastellen werden nicht still gekürzt', () => {
  assert.throws(() => projectClientContractLifecycle([initial({ recordedAt: '2025-12-01T09:10:11.1234567Z' })]), /Erfassungszeitpunkt ist ungültig/);
});

test('kalenderwidrige Wirksamkeit wird verworfen', () => {
  assert.throws(() => projectClientContractLifecycle([initial({ effectiveOn: '2026-02-30' })]), /Wirksamkeitsdatum ist ungültig/);
});

test('Erstfassung darf weder Vorgänger noch Änderungsfolgen erfinden', () => {
  assert.throws(() => projectClientContractLifecycle([initial({ predecessorEventId: 'foreign' })]), /Erstfassung/);
  assert.throws(() => projectClientContractLifecycle([initial({ changeReason: 'Altgrund' })]), /Erstfassung/);
});

test('Änderung und Schließung verlangen Grund und Folgen', () => {
  assert.throws(() => projectClientContractLifecycle([initial(), amendment({ changeReason: '  ' })]), /grund fehlt/i);
  assert.throws(() => projectClientContractLifecycle([initial(), amendment({ consequences: null })]), /Folgen fehlt/);
});

test('Versionslücke und falscher Vorgänger werden verweigert', () => {
  assert.throws(() => projectClientContractLifecycle([initial(), amendment({ version: 3 })]), /nicht lückenlos/);
  assert.throws(() => projectClientContractLifecycle([initial(), amendment({ predecessorEventId: 'foreign-event' })]), /unmittelbare Vorversion/);
});

test('mehrdeutige Wirksamkeit und rückwärts erfasste Fassung werden verweigert', () => {
  assert.throws(() => projectClientContractLifecycle([initial(), amendment({ effectiveOn: '2026-01-01' })]), /Wirksamkeitsdaten/);
  assert.throws(() => projectClientContractLifecycle([initial(), amendment({ recordedAt: '2025-12-01T09:10:11.123453Z' })]), /Erfassungszeiten/);
});

test('zeitlich gleiche Mikrosekunden mit anderer Schreibweise bleiben gleich', () => {
  assert.throws(() => projectClientContractLifecycle([
    initial({ recordedAt: '2025-12-01T09:10:11.1Z' }),
    amendment({ recordedAt: '2025-12-01T09:10:11.100000Z' }),
  ]), /Erfassungszeiten/);
});

test('nach einer Schließung ist keine Wiedereröffnung in derselben Historie zulässig', () => {
  assert.throws(() => projectClientContractLifecycle([initial(), closure({ version: 2, predecessorEventId: initial().id }), amendment({ version: 3, predecessorEventId: closure({ version: 2 }).id, effectiveOn: '2026-09-01' })]), /Nach einer Schließung/);
});

test('Mandant, Pflegefall, logische und native Vertragsidentität bleiben in der Kette gleich', () => {
  for (const overrides of [{ tenantId: 'other' }, { clientId: 'other' }, { logicalContractId: 'other' }, { sourceContractId: 'other' }]) {
    assert.throws(() => projectClientContractLifecycle([initial(), amendment(overrides)]), /Vertragsidentität/);
  }
});

test('doppelte native Ereignis-ID wird nicht priorisiert', () => {
  assert.throws(() => projectClientContractLifecycle([initial(), amendment({ id: initial().id })]), /nicht eindeutig/);
});

test('Mapper übernehmen native IDs, Vorgänger, Fingerprint und Mikrosekunden ohne Ersatzidentität', async () => {
  const service = await fs.readFile(new URL('../../src/lib/clients/clientContractLifecycleService.ts', import.meta.url), 'utf8');
  assert.match(service, /sourceContractId: required\(row\.source_contract_id/);
  assert.match(service, /predecessorEventId: nullable\(row\.predecessor_event_id/);
  assert.match(service, /contentFingerprint: required\(row\.content_fingerprint/);
  assert.match(service, /recordedAt: required\(row\.recorded_at/);
  assert.match(service, /lifecycleEventId: required\(row\.lifecycle_event_id/);
  assert.match(service, /lifecycleFingerprint: required\(row\.lifecycle_fingerprint/);
  assert.match(service, /serviceEvidenceId: required\(row\.service_evidence_id/);
});

test('SQL erzwingt append-only Kette, exakte Leistungsbindung und Scope-RLS', async () => {
  const sql = await fs.readFile(new URL('../../supabase/patches/ambulatory_client_contract_lifecycle.sql', import.meta.url), 'utf8');
  assert.match(sql, /source_contract_id uuid NOT NULL REFERENCES public\.client_contracts\(id\)/);
  assert.match(sql, /client_contract_lifecycle_predecessor_fk/);
  assert.match(sql, /idx_client_contract_lifecycle_one_successor/);
  assert.match(sql, /v_kind = 'closure'/);
  assert.match(sql, /service_occurred_on >= NEW\.effective_on/);
  assert.match(sql, /Rueckwirkendes Vertragsereignis wuerde bereits gebundene Leistungsreferenzen entwerten/);
  assert.match(sql, /ORDER BY effective_on DESC, version DESC/);
  assert.match(sql, /lifecycle_version, lifecycle_fingerprint/);
  assert.match(sql, /GRANT SELECT, INSERT ON public\.client_contract_lifecycle_events/);
  assert.match(sql, /GRANT SELECT, INSERT ON public\.client_contract_service_bindings/);
  assert.doesNotMatch(sql, /GRANT[^;]*(?:UPDATE|DELETE)/i);
  assert.doesNotMatch(sql, /UPDATE\s+public\.|DELETE\s+FROM\s+public\./i);
  assert.doesNotMatch(sql, /INSERT\s+INTO\s+public\.client_contract/i);
});

test('Web zeigt Historie und Native-Komponente bleibt leer', async () => {
  const web = await fs.readFile(new URL('../../src/components/office/ClientContractLifecycleSummary.web.tsx', import.meta.url), 'utf8');
  const native = await fs.readFile(new URL('../../src/components/office/ClientContractLifecycleSummary.tsx', import.meta.url), 'utf8');
  const panel = await fs.readFile(new URL('../../src/components/office/ClientRecordContractsPanel.tsx', import.meta.url), 'utf8');
  assert.match(web, /projectClientContractLifecycle/);
  assert.match(web, /validateClientContractServiceBinding/);
  assert.match(web, /weder Leistungserbringung noch Abrechnungs- oder Rechtsfreigabe/);
  assert.match(native, /return null/);
  assert.match(panel, /ClientContractLifecycleSummary clientId=\{clientId\}/);
});
