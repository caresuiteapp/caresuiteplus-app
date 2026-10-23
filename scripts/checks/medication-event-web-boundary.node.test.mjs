import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
import {isMedicationGiven} from '../../src/lib/pflege/medicationAdministrationDomain.ts';

const source=readFileSync(new URL('../../src/lib/pflege/medicationEventWrite.web.ts',import.meta.url),'utf8');
const body=stripTypeScriptTypes(source.replace(/^import .*\n/gm,'').replaceAll('export ',''));
function service(){const calls=[];let resolve;const result=new Promise(r=>{resolve=r;});const api=new Function('recordMedicationEvent','isMedicationGiven',body+'\nreturn {recordMedicationEventWeb,medicationActualWriteIssueWeb};')((...args)=>{calls.push(args);return result;},isMedicationGiven);return {...api,calls,resolve};}
const args=(status='administered',isPrn=true,replay=false)=>[{id:'order',isPrn,integrity:{canRecord:true},nested:{status:'original'}},'tenant','actor','request',{status,occurredAt:'2026-10-22T08:00:00Z',dose:'1.000',prnReason:'Originaler Bedarf'},'nurse',replay];

for(const status of ['administered','late']){
 test(`Neue tatsächliche Bedarfsgabe ${status} erreicht keinen alten Schreibweg`,async()=>{const s=service(),r=await s.recordMedicationEventWeb(...args(status));assert.equal(r.ok,false);assert.equal(r.uncertain,undefined);assert.match(r.error,/Schreibwege/);assert.equal(s.calls.length,0);});
 test(`Ungeklärte frühere Bedarfsgabe ${status} erzeugt keinen neuen Auftrag`,async()=>{const s=service(),r=await s.recordMedicationEventWeb(...args(status,true,true));assert.equal(r.ok,false);assert.equal(r.uncertain,true);assert.match(r.error,/unabhängig bestätigt/);assert.equal(s.calls.length,0);});
}
for(const isPrn of [null,undefined,'false',0])test(`Unbekannte Verordnungsart ${String(isPrn)} wird nicht zu Regelmedikation`,async()=>{const s=service(),input=args('administered',false);input[0].isPrn=isPrn;const r=await s.recordMedicationEventWeb(...input);assert.equal(r.ok,false);assert.match(r.error,/ungeklärt/);assert.equal(s.calls.length,0);});
for(const status of ['omitted','refused','held'])test(`Tatsächliche Nichtgabe ${status} bleibt im bestehenden Prüfweg`,async()=>{const s=service(),input=args(status),pending=s.recordMedicationEventWeb(...input);assert.equal(s.calls.length,1);assert.deepEqual(s.calls[0],input);s.resolve({ok:true,data:{id:'retained'}});assert.deepEqual(await pending,{ok:true,data:{id:'retained'}});});
test('Regelgabe delegiert einen eigenen unveränderten Snapshot und denselben Anfragebezug',async()=>{const s=service(),input=args('administered',false,true),pending=s.recordMedicationEventWeb(...input);input[0].nested.status='mutated';input[4].dose='999';assert.equal(s.calls[0][0].nested.status,'original');assert.equal(s.calls[0][4].dose,'1.000');assert.equal(s.calls[0][3],'request');assert.equal(s.calls[0][6],true);s.resolve({ok:false,uncertain:true,error:'Originaler Ausgang unbekannt'});assert.deepEqual(await pending,{ok:false,uncertain:true,error:'Originaler Ausgang unbekannt'});});
test('Nicht kopierbare neue Anfrage wird vor jedem Transport abgewiesen',async()=>{const s=service(),input=args('administered',false);input[4].callback=()=>{};const r=await s.recordMedicationEventWeb(...input);assert.equal(r.ok,false);assert.equal(r.uncertain,undefined);assert.equal(s.calls.length,0);});
test('Nicht kopierbare Wiederholung bleibt ungeklärt und sendet keine Ersatzanfrage',async()=>{const s=service(),input=args('administered',false,true);input[4].callback=()=>{};const r=await s.recordMedicationEventWeb(...input);assert.equal(r.ok,false);assert.equal(r.uncertain,true);assert.equal(s.calls.length,0);});
