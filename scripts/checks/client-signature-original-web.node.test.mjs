import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import * as native from '../../src/lib/clients/clientRecordNativeOriginal.web.ts';
import * as signature from '../../src/lib/clients/clientSignatureOriginals.web.ts';
import { withServiceQueryTimeout } from '../../src/lib/services/queryTimeout.ts';
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const scope={tenantId:id(1),clientId:id(2)}, time='2026-10-08 10:00:00.123456+00:00';
const row=(n,more={})=>({id:id(n),tenant_id:scope.tenantId,client_id:scope.clientId,created_at:time,...more});
const doc=(n=10,more={})=>row(n,{status:'not_started',preview_html:'Original HTML',version:0,...more});
const sig=(n=20,more={})=>row(n,{document_id:id(10),signer_role:'client',signature_data:'Original ink',signed_at:time,signer_name:'Raw author',...more});
const source=readFileSync(new URL('../../src/lib/clients/clientSignatureOriginalRead.web.ts',import.meta.url),'utf8');
const executable=stripTypeScriptTypes(source.replace(/^import[\s\S]*?;\n/gm,'').replace(/\bexport /g,''));
function harness(change={}) {
 const state={current:true,cap:1,calls:[],built:[],tables:{client_intake_documents:[doc()],client_document_signatures:[sig()]},override:null,beforeResult:null,beforeBuild:null,reflection:null,sdkLookups:0};
 class Query{
  constructor(table){this.table=table;this.filters=[];this.cursor=null;}
  select(value){this.selector=value;return this;}eq(key,value){this.filters.push([key,value]);return this;}
  order(key,value){this.orderKey=key;this.ascending=value.ascending;return this;}limit(value){this.limitN=value;state.beforeBuild?.(this);return this;}
  gt(key,value){this.cursorKey=key;this.cursor=value;return this;}
  then(resolve,reject){
   state.calls.push({table:this.table,selector:this.selector,filters:this.filters,cursor:this.cursor,cursorKey:this.cursorKey,order:this.orderKey,ascending:this.ascending,current:state.current});
   return Promise.resolve().then(async()=>{
    await state.beforeResult?.(this);
    const replace=state.override?.(this);if(replace!==undefined)return replace;
    const values=state.tables[this.table].filter(r=>this.filters.every(([k,v])=>r[k]===v)).sort((a,b)=>a.id.toLowerCase().localeCompare(b.id.toLowerCase()));
    return {error:null,data:values.filter(r=>!this.cursor||r.id.toLowerCase()>this.cursor).slice(0,Math.min(state.cap,this.limitN))};
   }).then(resolve,reject);
  }
 }
 const sdk={from:table=>{state.built.push(table);return new Query(table);}};
 const deps={...native,...signature,getSupabaseClient:()=>{state.sdkLookups++;return sdk;},fromUnknownTable:(client,table)=>client.from(table),toGermanSupabaseError:e=>e.message??'Native failure',withServiceQueryTimeout:change.timeout??withServiceQueryTimeout,...change.dependencies};
 const read=new Function(...Object.keys(deps),executable+';return fetchClientSignatureOriginalReadWeb;')(...Object.values(deps));
 const options={canRead:true,canViewSensitive:true,assertCurrentRead:()=>{if(!state.current)throw Error('Current native receipt lost');},...change.options};
 return {state,options,read:(optionsOverride=options,owner=scope)=>read(owner.tenantId,owner.clientId,optionsOverride)};
}
test('Whole originals retain every supplied field, native authors/raw microseconds/HTML, order and absence without mutation or status inference',()=>{
 const original={documents:[doc()],signatures:[sig(20,{extra:{who:'Author',time:'1969-12-31T23:59:59.999999Z',false:false,zero:0,nil:null,missing:undefined}}),sig(21,{signer_role:'employee',signed_at:'legacy time'})]},before=structuredClone(original);
 const result=signature.captureClientSignatureOriginals(original,scope);
 assert.deepEqual(result.pools,before);assert.deepEqual(original,before);assert.equal(result.links.length,2);assert.equal(result.links[0].document.status,'not_started');assert.equal(result.links[0].original.id,id(20));assert.ok(Object.isFrozen(result.links[0].original.extra));original.signatures[0].extra.who='changed';assert.equal(result.links[0].original.extra.who,'Author');assert.equal(Object.hasOwn(result.links[0],'approved'),false);
});
test('Native same-document/same-role delivered rows are never collapsed by a role map, including opposite signature payloads',()=>{
 const result=signature.captureClientSignatureOriginals({documents:[doc()],signatures:[sig(20),sig(21,{signature_data:'Second delivered original'})]},scope);
 assert.equal(result.links.length,2);assert.deepEqual(result.pools.signatures.map(r=>r.signature_data),['Original ink','Second delivered original']);
});
for(const documentId of [undefined,null,'',false,'not-uuid',id(99)])test(`Unresolved native document metadata ${String(documentId)} cannot fabricate a delivered link`,()=>{
 const original=sig(20,{document_id:documentId});const result=signature.captureClientSignatureOriginals({documents:[doc()],signatures:[original]},scope);assert.deepEqual(result.pools.signatures,[original]);assert.equal(result.links[0].state,'unresolved');assert.equal(result.links[0].document,null);assert.equal(result.links[0].documentId,documentId);
});
test('Only actual delivered native intake UUIDs match; title/template/status/role/signature bytes never supply a relationship',()=>{
 const result=signature.captureClientSignatureOriginals({documents:[doc(11,{title:'Same',template_key:'Same',document_id:id(10)})],signatures:[sig(20,{title:'Same',template_key:'Same',signature_data:'',signer_role:'new legacy role'})]},scope);assert.equal(result.links[0].state,'unresolved');assert.equal(result.pools.signatures[0].signer_role,'new legacy role');
});
test('Native UUID casing affects only identity comparison; full original strings remain unchanged',()=>{
 const input={documents:[doc(10,{id:id(10).toUpperCase()})],signatures:[sig(20,{document_id:id(10).toLowerCase()})]};const result=signature.captureClientSignatureOriginals(input,scope);assert.equal(result.links[0].state,'delivered_document');assert.deepEqual(result.pools,input);
});
for(const input of [{documents:[],signatures:null},{documents:undefined,signatures:[]},{documents:[],signatures:[],extra:[]},{signatures:[]},null])test(`Missing/unknown whole pool is not genuine empty ${JSON.stringify(input)}`,()=>assert.throws(()=>signature.captureClientSignatureOriginals(input,scope)));
for(const pool of ['documents','signatures'])for(const bad of ['foreignTenant','foreignClient','badId','duplicate','unordered','sparse','getter'])test(`Whole ${pool} rejects ${bad} rather than selecting away untrusted rows`,()=>{
 let values=[pool==='documents'?doc():sig()];let gets=0;
 if(bad==='foreignTenant')values[0].tenant_id=id(99);if(bad==='foreignClient')values[0].client_id=id(99);if(bad==='badId')values[0].id='bad';if(bad==='duplicate')values.push({...values[0]});if(bad==='unordered')values=[row(30),row(20)];if(bad==='sparse')values=Array(1);if(bad==='getter')Object.defineProperty(values[0],'signed_at',{enumerable:true,get(){gets++;return time;}});
 const input={documents:[doc()],signatures:[sig()],[pool]:values};assert.throws(()=>signature.captureClientSignatureOriginals(input,scope));assert.equal(gets,0);
});
test('Actual SELECT loader passes server-capped short pages until actual empty in both pools, preserving all original rows',async()=>{
 const h=harness();h.state.tables.client_intake_documents=[doc(10),doc(11),doc(12)];h.state.tables.client_document_signatures=[sig(20),sig(21,{document_id:id(11)}),sig(22,{document_id:id(99)})];const result=await h.read();assert.equal(result.ok,true,result.error);assert.deepEqual(result.data.collection.pools,h.state.tables.client_intake_documents&&{documents:h.state.tables.client_intake_documents,signatures:h.state.tables.client_document_signatures});assert.deepEqual(result.data.collection.links.map(r=>r.state),['delivered_document','delivered_document','unresolved']);assert.equal(h.state.calls.length,8);assert.deepEqual(h.state.calls.map(c=>c.cursor),[null,id(10),id(11),id(12),null,id(20),id(21),id(22)]);assert.ok(h.state.calls.every(c=>c.selector==='*'&&c.order==='id'&&c.ascending&&c.filters.length===2&&c.filters[0][1]===scope.tenantId&&c.filters[1][1]===scope.clientId));assert.deepEqual(result.data.queriedPools,['client_intake_documents','client_document_signatures']);assert.equal(result.data.state,'requested');assert.ok(Object.isFrozen(result.data.collection.links));
});
test('Actual empty is explicit requested empty in both pools, with two genuine empty SDK responses',async()=>{const h=harness();h.state.tables.client_intake_documents=[];h.state.tables.client_document_signatures=[];const r=await h.read();assert.equal(r.ok,true,r.error);assert.equal(r.data.state,'requested');assert.deepEqual(r.data.collection,{pools:{documents:[],signatures:[]},links:[]});assert.equal(h.state.calls.length,2);});
test('Sensitive false means not requested, not known empty; neither SDK lookup nor raw HTML/signature read occurs',async()=>{const h=harness({options:{canViewSensitive:false}}),r=await h.read();assert.equal(r.ok,true,r.error);assert.deepEqual(r.data,{state:'not_requested',collection:null,selectors:{},queriedPools:[]});assert.equal(h.state.sdkLookups,0);assert.equal(h.state.calls.length,0);assert.equal(JSON.stringify(r).includes('Original ink'),false);});
for(const options of [{canRead:false},{canRead:'true'},{canViewSensitive:'false'},{canViewSensitive:null},{assertCurrentRead:null},{assertCurrentRead:()=>true},{assertCurrentRead:()=>false},{assertCurrentRead:()=>null},{assertCurrentRead:async()=>{}},{assertCurrentRead:async()=>{throw Error('deny');}}])test(`Malformed/denied option ${Object.keys(options)} yields no SDK entry or read`,async()=>{const h=harness({options}),r=await h.read();assert.equal(r.ok,false);assert.equal(h.state.calls.length,0);assert.equal(h.state.sdkLookups,0);});
for(const key of ['canRead','canViewSensitive','assertCurrentRead'])test(`Option ${key} accessor never executes`,async()=>{const h=harness();let gets=0;Object.defineProperty(h.options,key,{enumerable:true,get(){gets++;return true;}});assert.equal((await h.read()).ok,false);assert.equal(gets,0);assert.equal(h.state.calls.length,0);});
for(const owner of [{tenantId:'bad',clientId:id(2)},{tenantId:id(1),clientId:'bad'}])test(`Invalid native request scope ${JSON.stringify(owner)} stops before SDK lookup`,async()=>{const h=harness();assert.equal((await h.read(h.options,owner)).ok,false);assert.equal(h.state.sdkLookups,0);});
test('Options are captured once: mutation of sensitive flag/callback cannot broaden an in-flight receipt',async()=>{const h=harness();h.state.beforeResult=()=>{h.options.canViewSensitive=false;h.options.assertCurrentRead=()=>{};};const r=await h.read();assert.equal(r.ok,true,r.error);assert.equal(r.data.state,'requested');});
for(const table of ['client_intake_documents','client_document_signatures'])for(const mode of ['nullData','missingData','missingError','falseError','stringError','error','errorGetter','dataGetter','arrayResponse','sparseRows','foreignRow','repeatCursor'])test(`Actual native ${table}/${mode} cannot deliver partial or apparently empty originals`,async()=>{
 const h=harness();let gets=0;h.state.override=q=>{if(q.table!==table)return;const r={error:null,data:[]};if(mode==='nullData')r.data=null;if(mode==='missingData')delete r.data;if(mode==='missingError')delete r.error;if(mode==='falseError')r.error=false;if(mode==='stringError')r.error='unknown';if(mode==='error')r.error={message:'Denied'};if(mode==='errorGetter')Object.defineProperty(r,'error',{enumerable:true,get(){gets++;return null;}});if(mode==='dataGetter')Object.defineProperty(r,'data',{enumerable:true,get(){gets++;return [];}});if(mode==='arrayResponse')return [];if(mode==='sparseRows')r.data=Array(1);if(mode==='foreignRow')r.data=[row(30,{client_id:id(99)})];if(mode==='repeatCursor')r.data=[row(30)];return r;};const r=await h.read();assert.equal(r.ok,false);assert.equal(Object.hasOwn(r,'data'),false);assert.equal(gets,0);assert.ok(h.state.calls.length<=4);
});
for(const table of ['client_intake_documents','client_document_signatures'])test(`Synchronous current owner loss while building ${table} stops actual then-entry`,async()=>{const h=harness();h.state.beforeBuild=q=>{if(q.table===table)h.state.current=false;};assert.equal((await h.read()).ok,false);assert.equal(h.state.calls.filter(c=>c.table===table).length,0);assert.ok(h.state.calls.every(c=>c.current));});
for(const table of ['client_intake_documents','client_document_signatures'])test(`Microtask current owner loss cannot retroactively authorize a receipt from issued ${table} request`,async()=>{const h=harness();h.state.beforeBuild=q=>{if(q.table===table)queueMicrotask(()=>{h.state.current=false;});};assert.equal((await h.read()).ok,false);assert.equal(h.state.calls.filter(c=>c.table===table).length,1);assert.ok(h.state.calls.every(c=>c.current));});
for(const table of ['client_intake_documents','client_document_signatures'])test(`Current owner/read/sensitive/ticket/lifetime assertion is rechecked after ${table} await`,async()=>{const h=harness();h.state.beforeResult=q=>{if(q.table===table)h.state.current=false;};assert.equal((await h.read()).ok,false);assert.equal(h.state.calls.filter(c=>c.table===table).length,1);});
test('Actual SDK whole-result reflection that expires current ownership cannot reach any subsequent page or receipt',async()=>{const h=harness();let reflects=0;h.state.override=q=>q.table==='client_intake_documents'?new Proxy({error:null,data:[doc()]},{ownKeys(target){reflects++;h.state.current=false;return Reflect.ownKeys(target);}}):undefined;assert.equal((await h.read()).ok,false);assert.equal(reflects,1);assert.equal(h.state.calls.length,1);});
test('Current gate is rechecked after actual whole-page capture and before paging again',async()=>{let h;h=harness({dependencies:{captureClientNativePage:(...args)=>{const page=native.captureClientNativePage(...args);h.state.current=false;return page;}}});assert.equal((await h.read()).ok,false);assert.equal(h.state.calls.length,1);});
test('Current gate is rechecked after actual whole-collection capture before final private delivery',async()=>{let h;h=harness({dependencies:{captureClientSignatureOriginals:(...args)=>{const value=signature.captureClientSignatureOriginals(...args);h.state.current=false;return value;}}});assert.equal((await h.read()).ok,false);assert.equal(h.state.calls.length,4);});
test('An assertion becoming async after a real await cannot grant a late original receipt',async()=>{let asynchronous=false;const h=harness({options:{assertCurrentRead:()=>asynchronous?Promise.resolve():undefined}});h.state.beforeResult=()=>{asynchronous=true;};assert.equal((await h.read()).ok,false);assert.equal(h.state.calls.length,1);});
test('Actual timeout terminates delivery without claiming cancellation; late original data cannot initiate new SDK reads',async()=>{let release;const wait=new Promise(resolve=>{release=resolve;}),h=harness({timeout:(p,label)=>withServiceQueryTimeout(p,label,1)});h.state.beforeResult=()=>wait;assert.equal((await h.read()).ok,false);release();await new Promise(resolve=>setImmediate(resolve));assert.equal(h.state.calls.length,1);});
test('Same-object native mutation after document capture cannot alter delivered original document/status/author/time',async()=>{const h=harness();h.state.beforeResult=q=>{if(q.table==='client_document_signatures'){h.state.tables.client_intake_documents[0].status='finalized';h.state.tables.client_intake_documents[0].created_at='2026-10-08 10:00:00.123457+00:00';}};const r=await h.read();assert.equal(r.ok,true,r.error);assert.equal(r.data.collection.links[0].document.status,'not_started');assert.equal(r.data.collection.links[0].document.created_at,time);});
