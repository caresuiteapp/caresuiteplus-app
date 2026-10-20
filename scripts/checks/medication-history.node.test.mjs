import test from 'node:test';
import assert from 'node:assert/strict';
import { loadCompleteMedicationHistory as load, medicationHistoryCursor as cursor, medicationHistoryFilter as filter, compareMedicationHistory as compare } from '../../src/lib/pflege/medicationHistoryPagination.ts';
const tenant='11111111-1111-4111-8111-111111111111',med='22222222-2222-4222-8222-222222222222',client='44444444-4444-4444-8444-444444444444';
const id=n=>`33333333-3333-4333-8333-${n.toString(16).padStart(12,'0')}`;
const row=(n,extra={})=>({id:id(n),tenant_id:tenant,medication_id:med,client_id:client,created_at:'2026-10-08T12:00:00.123456+00:00',...extra});
const scope=r=>r.medication_id===med&&r.client_id===client;
function pages(rows,size){let calls=0;return {get calls(){return calls;},fetch:async c=>{calls++;const start=c?rows.findIndex(r=>r.id===c.id)+1:0;return rows.slice(start,start+size);}};}
test('620 Einträge über kleinere Serverseiten vollständig und in Reihenfolge laden',async()=>{
 const expected=Array.from({length:620},(_,n)=>row(620-n));const source=pages(expected,37);
 const actual=await load(source.fetch,tenant,scope);
 assert.deepEqual(actual,expected);assert.equal(source.calls,18);assert.equal(new Set(actual.map(r=>r.id)).size,620);
});
test('Leerer Verlauf ist ein bestätigtes leeres Array',async()=>{assert.deepEqual(await load(async()=>[],tenant,scope),[]);});
test('Mikrosekunden ordnen vor UUIDs, auch innerhalb derselben Millisekunde',async()=>{
 const expected=[row(1,{created_at:'2026-10-08T12:00:00.123456Z'}),row(2,{created_at:'2026-10-08T14:00:00.123455+02:00'})];
 assert.equal(Date.parse(expected[0].created_at),Date.parse(expected[1].created_at));
 assert.equal(compare(cursor(expected[0]),cursor(expected[1])),1);
 assert.deepEqual(await load(pages(expected,1).fetch,tenant,scope),expected);
 assert.match(filter(cursor(expected[0])),/123456Z/);
  assert.equal(filter(cursor(expected[0])),`created_at.lt."2026-10-08T12:00:00.123456Z",and(created_at.eq."2026-10-08T12:00:00.123456Z",id.lt.${id(1)})`);
});
test('Verschiedene Zeitzonen und Präzisionen für denselben Zeitpunkt nutzen UUID als Reihenfolge',async()=>{
 const expected=[row(2,{created_at:'2026-10-08T12:00:00.1Z'}),row(1,{created_at:'2026-10-08T14:00:00.100000+02:00'})];
 assert.deepEqual(await load(pages(expected,1).fetch,tenant,scope),expected);
});
test('Doppelte IDs innerhalb einer Seite und über mehrere Seiten werden verweigert',async()=>{
 await assert.rejects(load(async()=>[row(2),row(2)],tenant,scope),/doppelte/);
 let call=0;await assert.rejects(load(async()=>++call===1?[row(3),row(2)]:[row(1),row(3)],tenant,scope),/doppelte/);
});
test('Unsortierte und rückwärts springende Seiten führen zu sichtbarem Fehler',async()=>{
 await assert.rejects(load(async()=>[row(1),row(2)],tenant,scope),/sortierte/);
 let call=0;await assert.rejects(load(async()=>++call===1?[row(2)]:[row(3)],tenant,scope),/sortierte/);
});
test('Fremder Mandant und andere Verordnung werden nicht als aktuelle Akte übernommen',async()=>{
 await assert.rejects(load(async()=>[row(1,{tenant_id:'anderer Mandant'})],tenant,scope),/zugeordnet/);
 await assert.rejects(load(async()=>[row(1,{medication_id:'andere Verordnung'})],tenant,scope),/zugeordnet/);
 await assert.rejects(load(async()=>[row(1,{client_id:'anderer Klient'})],tenant,scope),/zugeordnet/);
});
test('Wirkungskontrollen werden ausschließlich den angefragten Gaben zugeordnet',async()=>{
 const belongs=r=>r.administration_id===id(4);
 const accepted=row(2,{administration_id:id(4)});
 assert.deepEqual(await load(pages([accepted],1).fetch,tenant,belongs),[accepted]);
 await assert.rejects(load(async()=>[row(1,{administration_id:id(5)})],tenant,belongs),/zugeordnet/);
});
test('Ungültige Antwortformen werden nicht als leere oder vollständige Akte dargestellt',async()=>{
 for(const value of [null,undefined,{},'Antwort',[null],[[]],[42]]) await assert.rejects(load(async()=>value,tenant,scope));
});
test('Ungültige Cursor, Kalenderdaten und Filterzeichen werden verweigert',()=>{
 for(const extra of [{id:'id.lt.0)'},{created_at:'2026-02-30T12:00:00Z'},{created_at:'2026-10-08T12:00:00'},{created_at:'0000-01-01T00:00:00Z'},{created_at:'2026-10-08T12:00:00.1234567Z'},{created_at:'2026-10-08T12:00:00Z),id.gt.0'}]) assert.throws(()=>cursor(row(1,extra)));
  assert.throws(()=>filter({id:'id.lt.0)',createdAt:'2026-10-08T12:00:00Z',microseconds:0n}));
});
test('Fehler auf späterer Seite liefert keinen scheinbar vollständigen Teilverlauf',async()=>{
 let calls=0,resolved=false;
 await assert.rejects(load(async()=>{if(++calls===1)return[row(2)];throw Error('Verbindung verloren');},tenant,scope).then(()=>{resolved=true;}),/Verbindung/);
 assert.equal(resolved,false);assert.equal(calls,2);
});
test('Neu hinzukommende Einträge verschieben die bereits geladene Fortsetzung nicht',async()=>{
 const original=[row(3),row(2),row(1)];let values=[...original],calls=0;
 const actual=await load(async c=>{calls++;if(c&&calls===2)values.unshift(row(4));const start=c?values.findIndex(r=>r.id===c.id)+1:0;return values.slice(start,start+1);},tenant,scope);
 assert.deepEqual(actual,original);assert.equal(calls,4);
});
