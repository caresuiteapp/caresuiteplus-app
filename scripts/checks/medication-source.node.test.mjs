import test from 'node:test';import assert from 'node:assert/strict';
import {validateMedicationSource as check} from '../../src/lib/pflege/medicationSourceDomain.ts';
const tenant='11111111-1111-4111-8111-111111111111',client='22222222-2222-4222-8222-222222222222',id='33333333-3333-4333-8333-333333333333';
const order={tenantId:tenant,clientId:client,updatedAt:'2026-10-08T10:00:00.123456Z'};
const doc={id,tenantId:tenant,clientId:client,title:'Originalunterlage',fileName:'Verordnung.pdf',updatedAt:'2026-10-08T09:00:00.654321Z',status:'aktiv',storagePath:`tenant/${tenant}/clients/${client}/documents/${id}/${id}.pdf`};
const p={documentId:id,documentUpdatedAt:doc.updatedAt,expectedUpdatedAt:order.updatedAt,reason:'Bezug zur Verordnung erfasst',contentSha256:'a'.repeat(64),contentSize:123};
test('Zuordnung zur selben Akte mit beiden gespeicherten Fassungen ist zulässig',()=>assert.equal(check(order,doc,p),null));
test('Fremder Mandant und anderer Klient werden abgewiesen',()=>{for(const v of [{tenantId:'other'},{clientId:'other'}])assert.match(check(order,{...doc,...v},p),/Klientenakte/);});
test('Falsche Dokument-ID wird nicht umgebunden',()=>assert.match(check(order,doc,{...p,documentId:'other'}),/Klientenakte/));
test('Inaktives Dokument wird nicht neu zugeordnet',()=>assert.match(check(order,{...doc,status:'archiviert'},p),/aktives/));
test('Fehlende, fremde und traversierende Dateipfade werden verweigert',()=>{for(const storagePath of [null,'https://example.invalid/file',`tenant/other/clients/${client}/documents/file.pdf`,`${doc.storagePath}/../other`, `tenant/${tenant}/clients/${client}/documents/`])assert.match(check(order,{...doc,storagePath},p),/Originaldatei/);});
test('Geänderte Dokumentfassung wird erkannt, einschließlich Mikrosekunden',()=>assert.match(check(order,{...doc,updatedAt:'2026-10-08T09:00:00.654322Z'},p),/Dokument wurde geändert/));
test('Geänderter Verordnungsstand wird erkannt',()=>assert.match(check({...order,updatedAt:'2026-10-08T10:00:00.123457Z'},doc,p),/Verordnung wurde geändert/));
test('Begründung ist erforderlich und begrenzt',()=>{for(const reason of ['', ' ', 'a'.repeat(2001)])assert.match(check(order,doc,{...p,reason}),/Begründung/);assert.equal(check(order,doc,{...p,reason:'a'.repeat(2000)}),null);});

test('Quellenzuordnung braucht gültigen Inhaltsfingerabdruck und positive begrenzte Bytezahl',()=>{for(const v of [{contentSha256:''},{contentSha256:'A'.repeat(64)},{contentSha256:'a'.repeat(63)},{contentSize:0},{contentSize:1.5},{contentSize:52_428_801}])assert.match(check(order,doc,{...p,...v}),/Inhaltsfingerabdruck/);assert.equal(check(order,doc,{...p,contentSize:52_428_800}),null);});

for(const [label,raw] of [
 ['ungültiger Kalendertag','2026-02-30T09:00:00.123456Z'],
 ['ungültiger Schalttag','2026-02-29 09:00:00.123456+00:00'],
 ['24 Uhr','2026-10-08T24:00:00Z'],
 ['mehr als sechs Nachkommastellen','2026-10-08T09:00:00.1234567Z'],
 ['fehlende Zeitzone','2026-10-08T09:00:00.123456'],
 ['ungültiger Offset','2026-10-08T09:00:00+24:00'],
 ['Jahr null','0000-10-08T09:00:00Z'],
 ['falscher Zeittyp',null],
]){
 test(`Dokumentzeit verweigert ${label} trotz gleicher roher Versionsangabe`,()=>assert.match(check(order,{...doc,updatedAt:raw},{...p,documentUpdatedAt:raw}),/Dokument wurde geändert/));
 test(`Verordnungszeit verweigert ${label} trotz gleicher roher Versionsangabe`,()=>assert.match(check({...order,updatedAt:raw},doc,{...p,expectedUpdatedAt:raw}),/Verordnung wurde geändert/));
}

test('Native Metadatenzeiten mit T oder Leerzeichen, Offset und einer bis sechs Mikrosekundenstellen bleiben unverändert',()=>{
 const instants=['2024-02-29T09:00:00Z','1969-12-31 23:59:59.999999+00:00','0001-01-01T00:00:00Z','2026-10-08T11:00:00.123456+02:00','2099-10-08T09:00:00Z'];
 for(let digits=1;digits<=6;digits++)instants.push(`2026-10-08 09:00:00.${'123456'.slice(0,digits)}-02:30`);
 for(const raw of instants){const currentOrder={...order,updatedAt:raw},currentDoc={...doc,updatedAt:raw},payload={...p,expectedUpdatedAt:raw,documentUpdatedAt:raw};const original=structuredClone({currentOrder,currentDoc,payload});assert.equal(check(currentOrder,currentDoc,payload),null);assert.deepEqual({currentOrder,currentDoc,payload},original);}
});

test('Gleiche Instantzeit in anderer nativer Darstellung ersetzt keine originale Versionskennung',()=>{
 for(const updatedAt of ['2026-10-08 09:00:00.654321+00:00','2026-10-08T11:00:00.654321+02:00'])assert.match(check(order,{...doc,updatedAt},p),/Dokument wurde geändert/);
 for(const updatedAt of ['2026-10-08 10:00:00.123456+00:00','2026-10-08T12:00:00.123456+02:00'])assert.match(check({...order,updatedAt},doc,p),/Verordnung wurde geändert/);
});

test('Native Versionsvergleiche behalten die sechste Stelle auch bei Leerzeichen und Offset',()=>{
 const updatedAt='2026-10-08 11:00:00.654321+02:00',currentDoc={...doc,updatedAt},payload={...p,documentUpdatedAt:updatedAt};
 assert.match(check(order,{...currentDoc,updatedAt:'2026-10-08 11:00:00.654322+02:00'},payload),/Dokument wurde geändert/);
 const orderAt='2026-10-08 12:00:00.123456+02:00';assert.match(check({...order,updatedAt:'2026-10-08 12:00:00.123457+02:00'},currentDoc,{...payload,expectedUpdatedAt:orderAt}),/Verordnung wurde geändert/);
});
