import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes as strip } from 'node:module';

const source = readFileSync(
  new URL('../../src/lib/clients/clientMedicalContacts.web.ts', import.meta.url),
  'utf8',
);
const api = new Function(
  strip(source.replace(/^import[^;]+;\n/gm, '').replace(/\bexport /g, ''))
    + ';return {resolveMedicalContactCategory,isMedicalContact,listMedicalContacts,medicalContactCategoryLabel,storedMedicalContactChannels,buildMedicalContactInput};',
)();
const screenSource = readFileSync(
  new URL('../../src/screens/pflege/ClientRecordWorkspace365.web.tsx', import.meta.url),
  'utf8',
);
const panelSource = readFileSync(
  new URL('../../src/screens/business/office/ClientRecordMedicalContactsPanel.web.tsx', import.meta.url),
  'utf8',
);
const payloadSource = readFileSync(
  new URL('../../src/lib/clients/clientContactPayload.ts', import.meta.url),
  'utf8',
);
const payloadApi = new Function(
  strip(payloadSource.replace(/^import[^;]+;\n/gm, '').replace(/\bexport /g, ''))
    + ';return {resolveClientContactType};',
)();

const contact = (patch = {}) => ({
  id: '00000000-0000-4000-8000-000000000001',
  contactType: 'other',
  relationshipLabel: null,
  phone: null,
  email: null,
  notes: null,
  ...patch,
});

test('explicit saved categories distinguish GP specialist pharmacy therapy and medical supply', () => {
  assert.equal(api.resolveMedicalContactCategory(contact({ relationshipLabel: ' Hausarzt / Hausärztin ' })), 'general_practice');
  assert.equal(api.resolveMedicalContactCategory(contact({ relationshipLabel: 'Facharzt / Fachärztin' })), 'specialist');
  assert.equal(api.resolveMedicalContactCategory(contact({ relationshipLabel: 'Apotheke' })), 'pharmacy');
  assert.equal(api.resolveMedicalContactCategory(contact({ relationshipLabel: 'Therapie' })), 'therapy');
  assert.equal(api.resolveMedicalContactCategory(contact({ relationshipLabel: 'Sanitätshaus' })), 'medical_supply');
});

test('legacy doctor remains visible without inventing GP or specialist responsibility', () => {
  const legacy = contact({ contactType: 'doctor', relationshipLabel: 'arzt' });
  assert.equal(api.resolveMedicalContactCategory(legacy), 'physician_unspecified');
  assert.equal(api.medicalContactCategoryLabel(legacy), 'Ärztlicher Kontakt');
});

test('name similarity never classifies an unrelated contact as medical', () => {
  assert.equal(api.isMedicalContact(contact({ firstName: 'Dr.', lastName: 'Hausarzt', relationshipLabel: 'Nachbar' })), false);
});

test('medical list preserves every native contact and original order without deduplication', () => {
  const rows = [
    contact({ id: 'a', contactType: 'doctor', relationshipLabel: 'Facharzt / Fachärztin' }),
    contact({ id: 'b', relationshipLabel: 'Apotheke' }),
    contact({ id: 'c', relationshipLabel: 'Nachbar' }),
    contact({ id: 'd', relationshipLabel: 'Apotheke' }),
  ];
  assert.deepEqual(api.listMedicalContacts(rows).map((row) => row.id), ['a', 'b', 'd']);
});

test('stored phone and email remain separate unverified channels', () => {
  const channels = api.storedMedicalContactChannels(contact({ phone: ' 0231 1 ', email: ' praxis@example.test ' }));
  assert.deepEqual(channels, [
    { kind: 'phone', label: 'Telefon', value: '0231 1', security: 'unverified' },
    { kind: 'email', label: 'E-Mail', value: 'praxis@example.test', security: 'unverified' },
  ]);
});

test('GP creation keeps category responsibility and contact data in distinct fields', () => {
  const result = api.buildMedicalContactInput({
    category: 'general_practice',
    name: 'Praxis West',
    responsibility: 'Hausärztliche Versorgung und Verordnungen',
    phone: '0231 10',
    email: '',
  });
  assert.equal(result.ok, true);
  assert.equal(result.input.contactType, 'doctor');
  assert.equal(result.input.relationshipLabel, 'Hausarzt / Hausärztin');
  assert.equal(result.input.notes, 'Hausärztliche Versorgung und Verordnungen');
  assert.equal(result.input.phone, '0231 10');
  assert.equal(result.input.isPortalUser, false);
});

test('pharmacy creation remains a non-physician contact with no inferred access grant', () => {
  const result = api.buildMedicalContactInput({
    category: 'pharmacy',
    name: 'Stadt Apotheke',
    responsibility: 'Stammversorgung',
    phone: '',
    email: 'kontakt@example.test',
  });
  assert.equal(result.ok, true);
  assert.equal(result.input.contactType, 'other');
  assert.equal(result.input.relationshipLabel, 'Apotheke');
  assert.equal(result.input.portalPermissions.canViewDocuments, false);
  assert.equal(result.input.email, 'kontakt@example.test');
});

test('medical creation fails closed without name responsibility or stored channel', () => {
  const base = { category: 'therapy', name: 'Therapiezentrum', responsibility: 'Physiotherapie', phone: '1', email: '' };
  assert.equal(api.buildMedicalContactInput({ ...base, name: '' }).ok, false);
  assert.equal(api.buildMedicalContactInput({ ...base, responsibility: '' }).ok, false);
  assert.equal(api.buildMedicalContactInput({ ...base, phone: '', email: '' }).ok, false);
});

test('active relatives tab wires the medical panel to native detail and refresh', () => {
  assert.match(screenSource, /activeTab === 'angehoerige' \? <View/);
  assert.match(screenSource, /fullQuery\.data \? <ClientRecordMedicalContactsPanel/);
  assert.match(screenSource, /<ClientRecordMedicalContactsPanel client=\{fullQuery\.data\} onRefresh=\{handleRecordRefresh\}/);
});

test('active panel forwards current tenant client and role to guarded mutations', () => {
  assert.match(panelSource, /can\('office\.clients\.manage_contacts'\)/);
  assert.doesNotMatch(panelSource, /can\('office\.clients\.edit'\)/);
  assert.match(panelSource, /createClientContact\(tenantId, client\.id, prepared\.input, roleKey\)/);
  assert.match(panelSource, /deleteClientContact\(tenantId, client\.id, contactId, roleKey\)/);
});

test('legacy explicit physician labels remain physician contacts without name inference', () => {
  assert.equal(payloadApi.resolveClientContactType({ relationship: ' Hausarzt / Hausärztin ' }), 'doctor');
  assert.equal(payloadApi.resolveClientContactType({ relationship: 'Facharzt / Fachärztin' }), 'doctor');
  assert.equal(payloadApi.resolveClientContactType({ relationship: 'Dr. Hausarzt' }), 'other');
});
