import test from 'node:test';
import assert from 'node:assert/strict';
import { woundEditorAccess } from '../../src/lib/pflege/woundEditorAccess.web.ts';
const id = n => `33333333-3333-4333-8333-${String(n).padStart(12, '0')}`;
const owner = { tenantId: id(1), profileId: id(2), role: 'pflegefachkraft' };
const input = () => ({ owner: structuredClone(owner), profile: { tenantId: owner.tenantId, id: owner.profileId, roleKey: owner.role }, serviceTenant: owner.tenantId, runtimeTenant: owner.tenantId, runtimeRole: owner.role, canView: true, canManage: true });
test('Eigener bestätigter Kontext erlaubt Lesen und Schreiben, ohne die native Formularidentität zu ändern', () => {
  const i = input(), before = structuredClone(i), a = woundEditorAccess(i); assert.equal(a.canView, true); assert.equal(a.canManage, true); assert.deepEqual(a.owner, owner); assert.deepEqual(i, before);
});
for (const [name, mutate] of [
  ['Leserecht', i => { i.canView = false; }], ['Schreibrecht', i => { i.canManage = false; }], ['übergeordneter Zugriff', i => { i.blocked = true; }],
  ['fehlender Dienstmandant', i => { i.serviceTenant = null; }], ['fremder Dienstmandant', i => { i.serviceTenant = id(99); }], ['Laufzeitmandant', i => { i.runtimeTenant = id(99); }], ['Laufzeitrolle', i => { i.runtimeRole = 'verwaltung'; }], ['fehlende Laufzeitrolle', i => { i.runtimeRole = null; }],
  ['Profilkennung', i => { i.profile.id = id(99); }], ['Profilmandant', i => { i.profile.tenantId = id(99); }], ['Profilrolle', i => { i.profile.roleKey = 'verwaltung'; }], ['fehlendes Profil', i => { i.profile = null; }]
]) test(`Vorübergehend geänderter ${name} sperrt Schreiben und behält den ursprünglichen Formschlüssel`, () => {
  const i = input(), key = woundEditorAccess(i).key; mutate(i); const a = woundEditorAccess(i); assert.equal(a.canManage, false); assert.equal(a.key, key); assert.deepEqual(a.owner, owner);
  if (name !== 'Schreibrecht') assert.equal(a.canView, false);
});
test('Rückkehr desselben bestätigten Kontexts erlaubt die bestehende Bearbeitung wieder', () => {
  const i = input(), before = woundEditorAccess(i); i.runtimeRole = null; assert.equal(woundEditorAccess(i).canView, false); i.runtimeRole = owner.role; const after = woundEditorAccess(i); assert.deepEqual(after, before);
});
test('Eigenständig geöffnete Formulare verwenden die native Profilidentität statt den vorübergehenden Laufzeitkontext', () => {
  const i = input(); delete i.owner; const a = woundEditorAccess(i); i.runtimeRole = null; i.serviceTenant = null; assert.equal(woundEditorAccess(i).key, a.key); assert.deepEqual(woundEditorAccess(i).owner, owner); assert.equal(woundEditorAccess(i).canView, false);
});
test('Ein tatsächlich anderes natives Profil erhält einen anderen Formschlüssel', () => {
  const i = input(); delete i.owner; const before = woundEditorAccess(i); i.profile.id = id(99); assert.notEqual(woundEditorAccess(i).key, before.key);
});
for (const broken of [null, { ...owner, profileId: 'Anzeigename' }, { ...owner, tenantId: '' }, { ...owner, role: null }]) test(`Ein ungültiger vorgegebener Eigentümer ${JSON.stringify(broken)} übernimmt keinen fremden aktuellen Zugriff`, () => {
  const i = input(); i.owner = broken; const a = woundEditorAccess(i); assert.equal(a.canView, false); assert.equal(a.canManage, false);
});
