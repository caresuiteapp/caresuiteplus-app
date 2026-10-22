import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';

const read=name=>readFileSync(new URL('../../src/components/pflege/'+name,import.meta.url),'utf8');
const panel=read('VitalCareReviewPanel.web.tsx');
const reviewCode=stripTypeScriptTypes(panel.slice(panel.indexOf('export function VitalCareReviewPanel('),panel.indexOf(' if(!canView)return null;')).replace('export function','function')+`return {load,send,ready,active,rows:ready?rows:[],error,success,busy,uncertain,current,setReason,setRequiredChange,setRationale};\n}`)+'\nreturn VitalCareReviewPanel;';
const makeReview=new Function('useState','useRef','useEffect','useUnsavedWebChanges','sameVitalWorkspaceProofWeb','readVitalCareReviewPage','recoverVitalCareReview','saveVitalCareReviewDurably','makeVitalCareReviewPacket','vitalCareReviewPacketIssue',reviewCode);
const workspaceSource=read('VitalCarePathWorkspacePanel.web.tsx');
const workspaceCode=stripTypeScriptTypes(workspaceSource.slice(workspaceSource.indexOf('function VitalCarePathWorkspace('),workspaceSource.indexOf(' if(!canRead)return <SectionPanel'))+`return {current};\n}`)+'\nreturn VitalCarePathWorkspace;';
const makeWorkspace=new Function('useState','useRef','useEffect','useTreatmentCorrectionStyles','readVitalCareDraft','useAsyncQuery','readVitalCareSources','readVitalCarePage','sameVitalWorkspaceProofWeb',workspaceCode);
const id=n=>`77777777-7777-4777-8777-${String(n).padStart(12,'0')}`;
const proof=new WeakMap();
const tagged=(value,token='A')=>{proof.set(value,token);return value;};
const sameProof=(...values)=>values.length>1&&values.every(value=>proof.has(value)&&proof.get(value)===proof.get(values[0]));
const baseProps=()=>({tenantId:id(1),clientId:id(2),measurementId:id(3),actorId:id(4),canView:true,canRequest:true,canReview:true,careOriginal:{rootId:id(5),headId:id(6),contentFingerprint:'sha256:'+'a'.repeat(64)},sources:tagged({})});
const record=()=>({rootId:id(7),careRootId:id(5),careHeadId:id(6),careFingerprint:'sha256:'+'a'.repeat(64),status:'requested',headId:id(8),revision:1,history:[]});
function hooks(){
 const slots=[],cleanup=[];let cursor=0;
 const useState=initial=>{const index=cursor++;if(!(index in slots))slots[index]=typeof initial==='function'?initial():initial;return [slots[index],next=>{slots[index]=typeof next==='function'?next(slots[index]):next;}];};
 const useRef=initial=>{const index=cursor++;return slots[index]??={current:initial};};
 const useEffect=(fn,deps)=>{const index=cursor++;if(!(index in slots)||deps.some((value,n)=>!Object.is(slots[index][n],value))){cleanup[index]?.();slots[index]=deps.slice();cleanup[index]=fn();}};
 return {useState,useRef,useEffect,render:fn=>{cursor=0;return fn();},dispose:()=>cleanup.forEach(fn=>fn?.())};
}
const flush=async()=>{for(let n=0;n<12;n++)await Promise.resolve();};
function review(){
 const h=hooks(),props=baseProps(),env={readCount:0,recoverCount:0,changed:0,writes:[],rows:tagged([record()]),readDeferred:null,saveDeferred:null,recovered:null,next:{ok:true,data:record()}};
 props.onChanged=async()=>{env.changed++;return false;};
 const component=makeReview(h.useState,h.useRef,h.useEffect,()=>{},sameProof,async context=>{env.readCount++;return env.readDeferred?env.readDeferred(context):{ok:true,data:env.rows};},async(context,current)=>{env.recoverCount++;if(!current())return null;const value=env.recovered;env.recovered=null;return value;},async(packet,current)=>{env.writes.push({packet,current});return env.saveDeferred?env.saveDeferred(packet,current):env.next;},packet=>packet,()=>null);
 const render=()=>h.render(()=>component(props));
 const prepare=async()=>{render();await flush();return render();};
 return {env,props,render,prepare,dispose:h.dispose};
}
function workspace(){
 const h=hooks(),props={...baseProps(),canRead:true,canWrite:true},env={sources:tagged({}),rows:tagged([]),fetcher:null,sourceRead:null,historyRead:null};
 const q={data:null,loading:true,refresh:async()=>{},refreshWithResult:async()=>true};
 const component=makeWorkspace(h.useState,h.useRef,h.useEffect,()=>({}),()=>null,fetcher=>{env.fetcher=fetcher;return q;},async context=>env.sourceRead?env.sourceRead(context):{ok:true,data:env.sources},async context=>env.historyRead?env.historyRead(context):{ok:true,data:env.rows},sameProof);
 return {env,props,render:()=>h.render(()=>component(props)),dispose:h.dispose};
}

test('Vital workspace publishes only sources and complete history from the same retained ledger',async()=>{const w=workspace();w.render();const result=await w.env.fetcher();assert.equal(result.ok,true);assert.equal(result.data.sources,w.env.sources);assert.equal(result.data.history,w.env.rows);});
for(const mismatch of ['other','unknown'])test('Vital workspace rejects '+mismatch+' history proof before query publication',async()=>{const w=workspace();w.env.rows=mismatch==='other'?tagged([],'B'):[];w.render();await assert.rejects(w.env.fetcher(),/während des Ladens geändert/);});
test('Vital workspace rejects an in-flight response after its owner unmounts',async()=>{const w=workspace();let finish;w.env.historyRead=()=>new Promise(resolve=>{finish=resolve;});w.render();const pending=w.env.fetcher();w.dispose();finish({ok:true,data:w.env.rows});await assert.rejects(pending,/Rechtekontext hat gewechselt/);});
test('Matching Vital review proof publishes the current immutable queue',async()=>{const w=review(),c=await w.prepare();assert.equal(c.ready,true);assert.equal(c.active.headId,id(8));assert.equal(c.rows.length,1);});
for(const mismatch of ['other','unknown'])test('Vital review rejects '+mismatch+' queue proof and does not enable writes',async()=>{const w=review();w.env.rows=mismatch==='other'?tagged([record()],'B'):[record()];const c=await w.prepare();assert.equal(c.ready,false);assert.deepEqual(c.rows,[]);assert.match(c.error,/demselben bestätigten Stand/);await c.send('accept');assert.equal(w.env.writes.length,0);});
test('New source object invalidates retained review callbacks before the replacement queue returns',async()=>{const w=review(),old=await w.prepare();w.props.sources=tagged({},'B');let finish;w.env.readDeferred=()=>new Promise(resolve=>{finish=resolve;});assert.equal(w.render().ready,false);await flush();await old.send('accept');assert.equal(w.env.writes.length,0);finish({ok:true,data:tagged([record()],'B')});await flush();assert.equal(w.render().ready,true);});
test('Late old-source queue cannot replace a fresh matching queue',async()=>{const w=review();let first;w.env.readDeferred=()=>new Promise(resolve=>{first=resolve;});w.render();await flush();w.props.sources=tagged({},'B');w.env.readDeferred=null;w.env.rows=tagged([{...record(),status:'accepted'}],'B');w.render();await flush();assert.equal(w.render().active.status,'accepted');first({ok:true,data:tagged([{...record(),status:'returned'}])});await flush();assert.equal(w.render().active.status,'accepted');});
test('Confirmed own review clears the old queue and requests a joined parent refresh',async()=>{const w=review();await w.prepare();await w.render().send('accept');const c=w.render();assert.equal(w.env.changed,1);assert.equal(c.ready,false);assert.deepEqual(c.rows,[]);assert.equal(c.busy,false);assert.match(c.error,/gemeinsame Vitalpfadstand/);assert.equal(w.env.writes.length,1);});
test('Confirmed own review publishes again only after fresh parent sources and matching queue arrive',async()=>{const w=review();await w.prepare();let complete;w.props.onChanged=()=>{w.env.changed++;return new Promise(resolve=>{complete=resolve;});};w.render();const saving=w.render().send('accept');await flush();assert.equal(w.render().ready,false);w.props.sources=tagged({},'B');w.env.rows=tagged([{...record(),status:'accepted'}],'B');w.render();await flush();complete(true);await saving;assert.equal(w.render().ready,true);assert.equal(w.render().active.status,'accepted');assert.equal(w.render().busy,false);});
test('Recovered own review receipt refreshes source ledger before any queue read',async()=>{const w=review();w.env.recovered={ok:true,data:record()};const c=await w.prepare();assert.equal(w.env.changed,1);assert.equal(w.env.readCount,0);assert.equal(c.ready,false);assert.deepEqual(c.rows,[]);assert.match(c.success,/ursprüngliche/);});
test('Owner loss during review write cannot refresh or publish into the new owner',async()=>{const w=review();await w.prepare();let complete;w.env.saveDeferred=()=>new Promise(resolve=>{complete=resolve;});const saving=w.render().send('accept');w.props.actorId=id(10);w.render();complete({ok:true,data:record()});await saving;assert.equal(w.env.changed,0);assert.equal(w.env.writes[0].current(),false);});
test('Workspace wires confirmed review changes to the result-bearing joined query refresh',()=>{assert.match(workspaceSource,/onChanged=\{q\.refreshWithResult\}/);});
