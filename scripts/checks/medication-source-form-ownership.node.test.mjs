import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {stripTypeScriptTypes} from 'node:module';
import {MedicationRequestState} from '../../src/lib/pflege/medicationRequestState.ts';
import {sameWoundJson,woundUuid} from '../../src/lib/pflege/woundCareDomain.ts';
import {medicationSourceArchiveReadiness} from '../../src/lib/pflege/medicationSourceWorkflow.web.ts';
const read=path=>readFileSync(new URL('../../'+path,import.meta.url),'utf8');
const submission=stripTypeScriptTypes(read('src/hooks/useMedicationSubmission.web.ts').replace(/^import .*;\n/gm,'').replace('export function','function'));
const screen=read('src/screens/pflege/MedicationDetailScreen.web.tsx');
const form=stripTypeScriptTypes(screen.slice(screen.indexOf('function useMedicationFormWrite<'),screen.indexOf('\nfunction MedicationFormUnavailable(')));
const create=new Function('useRef','useState','useEffect','useCallback','useUnsavedWebChanges','MedicationRequestState','sameWoundJson','woundUuid','medicationSourceArchiveReadiness',submission+'\n'+form+'\nreturn useMedicationFormWrite;');
const id=n=>`44444444-4444-4444-8444-${String(n).padStart(12,'0')}`;const version='2026-10-22T10:00:00.123456Z';
function workspace(kind='archive'){
 const slots=[],cleanups=[],calls=[];let cursor=0;const env={result:{ok:false,uncertain:true,error:'missing'},deferred:null,confirmed:0,confirmationGuard:null,dirty:false};
 const source={id:id(5),orderVersion:version,hasFingerprint:true,archive:null};const document={id:id(6),tenantId:id(1),clientId:id(3),updatedAt:version,title:'Original'};
 const context={tenantId:id(1),actorId:id(2),role:'business_admin',profileRole:'business_admin',canView:true,canSources:true,canManage:true,canAdminister:false,unavailable:false,sourceUnavailable:false,order:{id:id(4),tenantId:id(1),clientId:id(3),updatedAt:version},currentSourceLinks:[source],currentSourceDocuments:[document],registerLeave:()=>{},refresh:async()=>{},close:()=>{},saved:()=>{}};
 const useRef=initial=>slots[cursor++]??=( {current:initial});
 const useState=initial=>{const i=cursor++;if(!(i in slots))slots[i]=typeof initial==='function'?initial():initial;return [slots[i],value=>{slots[i]=typeof value==='function'?value(slots[i]):value;}];};
 const useEffect=fn=>{const i=cursor++;if(!(i in slots)){slots[i]=true;cleanups.push(fn());}};
 const useCallback=fn=>{cursor++;return fn;};
 const hook=create(useRef,useState,useEffect,useCallback,(dirty,locked)=>{env.dirty=dirty;return async()=>!locked;},MedicationRequestState,sameWoundJson,woundUuid,medicationSourceArchiveReadiness);
 const payload=kind==='archive'?{sourceId:source.id}:{documentId:document.id,reason:'Original reason'};
 const execute=async(requestId,data,replay,frozen)=>{calls.push({requestId,data:structuredClone(data),replay,source:frozen.related,owner:frozen.context.actorId});return env.deferred?env.deferred():env.result;};
 function render(){cursor=0;return hook(context,env.dirty,kind,payload,kind==='source'?document:null,()=>structuredClone(payload),execute,async guard=>{env.confirmationGuard=guard;env.guardAtConfirmation=guard();env.confirmed++;});}
 return {env,context,payload,source,document,calls,render,dispose:()=>cleanups.forEach(fn=>fn?.())};
}
test('Archivierung einer aktuellen bereitgestellten Kopie erreicht denselben geschützten Formularweg',async()=>{const w=workspace();w.source.archive={id:id(8)};w.env.result={ok:true,data:{id:id(8)}};await w.render().submit(w.payload);assert.equal(w.calls.length,1);assert.equal(w.env.confirmed,1);});
test('Historische Quelle eröffnet über zurückbehaltenen Aufruf keinen neuen Archivauftrag',async()=>{const w=workspace();const old=w.render();w.source.orderVersion='2026-10-21T10:00:00.123456Z';w.render();await old.submit(w.payload);assert.deepEqual(w.calls,[]);});
test('Ungewisse Archivierung behält Original-ID und Quelle trotz geänderter späterer Auswahl',async()=>{const w=workspace();await w.render().submit(w.payload);const original=w.calls[0];w.payload.sourceId=id(9);w.render();w.env.result={ok:true,data:{id:id(8)}};await w.render().retry();assert.equal(w.calls[1].requestId,original.requestId);assert.deepEqual(w.calls[1].data,original.data);assert.equal(w.calls[1].replay,true);});
for(const change of [{actorId:id(9)},{tenantId:id(9)},{role:'pfleger'},{profileRole:'pfleger'},{canSources:false},{canView:false}])test('Eigener Quellenzugriff schützt ausstehende Antwort bei '+JSON.stringify(change),async()=>{const w=workspace('source');let release;w.env.deferred=()=>new Promise(resolve=>{release=resolve;});const pending=w.render().submit(w.payload);Object.assign(w.context,change);w.render();release({ok:true,data:{id:id(7)}});await pending;assert.equal(w.env.confirmed,0);assert.equal(w.render().uncertain,true);});
test('Ausstehende Quellenzuordnung kann erst unter demselben eigenen Bezug bestätigt werden',async()=>{const w=workspace('source');await w.render().submit(w.payload);const first=w.calls[0];w.context.canSources=false;const old=w.render();await old.retry();assert.equal(w.calls.length,1);w.context.canSources=true;w.env.result={ok:true,data:{id:id(7)}};w.render();await old.retry();assert.equal(w.calls[1].requestId,first.requestId);assert.deepEqual(w.calls[1].source,first.source);assert.equal(w.env.confirmed,1);});
test('Bestätigtes Formular startet nach einem Ansichtsfehler keinen zweiten Schreibvorgang',async()=>{const w=workspace('source');w.env.result={ok:true,data:{id:id(7)}};await w.render().submit(w.payload);w.context.sourceUnavailable=true;const retained=w.render();await retained.submit(w.payload);await retained.retry();assert.equal(w.calls.length,1);assert.equal(w.render().uncertain,false);});
test('Bestätigungsbezug erkennt geänderte Akte und Unmount',async()=>{const w=workspace('source');w.env.result={ok:true,data:{id:id(7)}};await w.render().submit(w.payload);assert.equal(w.env.guardAtConfirmation,true);w.context.order={...w.context.order,clientId:id(9)};w.render();assert.equal(w.env.confirmationGuard(),false);w.dispose();assert.equal(w.env.confirmationGuard(),false);});
