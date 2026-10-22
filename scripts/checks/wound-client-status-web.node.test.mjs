import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
import {loadCompleteMedicationHistory,medicationHistoryFilter,medicationHistoryCursor,compareMedicationHistory} from '../../src/lib/pflege/medicationHistoryPagination.ts';
import {validateWoundRequest} from '../../src/lib/pflege/woundDocumentationDomain.ts';
import {validateWoundLifecycle} from '../../src/lib/pflege/woundLifecycleDomain.ts';

const id=n=>`55555555-5555-4555-8555-${String(n).padStart(12,'0')}`;
const tenant=id(1),client=id(3),wound=id(30),at='2026-10-21T10:00:00.123456Z';
const row=(n,extra={})=>({id:id(n),tenant_id:tenant,created_at:at,...extra});
const source=readFileSync(new URL('../../src/lib/pflege/ambulatoryWoundService.web.ts',import.meta.url),'utf8');
const body=stripTypeScriptTypes(source.replace(/^import .*;\n/gm,'')).replace(/^export /gm,'');
const names=['enforcePermission','guardServiceTenant','getServiceMode','getSupabaseClient','fromUnknownTable','withServiceQueryTimeout','toGermanSupabaseError','loadCompleteMedicationHistory','medicationHistoryFilter','medicationHistoryCursor','isDefiniteMedicationRejection','validateWoundRequest','validateWoundLifecycle'];
const make=new Function(...names,body+'\nreturn {fetchWoundClients,fetchAmbulatoryWound,fetchAmbulatoryWoundList};');

// Execute the actual Web platform service with the existing complete-history parser.
// The in-memory transport is a query adapter, not Auth/PostgREST or browser evidence.
function setup(){
 const env={runtimeTenant:tenant,mode:'supabase',canView:true,pageCap:2,queries:[],failTable:null,leakTenant:false,changeCase:false,
  tables:{clients:[row(3,{status:'aktiv',first_name:'Deutscher',last_name:'Pflegefall',deleted_at:null}),row(4,{status:'active',first_name:'English',last_name:'Case',deleted_at:null}),row(5,{status:'archiviert',first_name:'Closed',last_name:'Case',deleted_at:null})],
   client_module_assignments:[row(13,{client_id:id(3),module_key:'pflege',is_active:true,status:'active'}),row(14,{client_id:id(4),module_key:'pflege',is_active:true,status:'active'}),row(15,{client_id:id(5),module_key:'pflege',is_active:true,status:'active'})],
   clinical_wound_cases:[row(30,{client_id:client,status:'draft',updated_at:at,body_location:'Linker Arm',documentation_details:{basisStatus:'pending',nativeUnknown:null}})],
   clinical_wound_assessments:[row(40,{client_id:client,wound_case_id:wound,observed_at:null,documentation_details:null,length_cm:null,pain_score:null,unknownOriginal:{zero:0,flag:false}})],ambulatory_wound_lifecycle_events:[]}};
 const db={};
 class Query{
  constructor(table){this.table=table;this.filters=[];this.fields='*';this.cursor=null;this.maximum=250;this.single=false;}
  select(fields){this.fields=fields;return this;}eq(key,value){this.filters.push([key,value]);return this;}order(){return this;}limit(value){this.maximum=value;return this;}or(filter){this.cursor=filter;return this;}maybeSingle(){this.single=true;return this;}
  then(resolve,reject){try{return Promise.resolve(this.execute()).then(resolve,reject);}catch(error){return Promise.reject(error).then(resolve,reject);}}
  execute(){
   env.queries.push({table:this.table,filters:structuredClone(this.filters),cursor:this.cursor,single:this.single});
   if(env.failTable===this.table)return {data:null,error:{code:'P0001',message:'Synthetic incomplete native history'}};
   let rows=structuredClone(env.tables[this.table]??[]).filter(r=>this.filters.every(([key,value])=>r[key]===value));
   if(env.changeCase&&this.table==='clinical_wound_cases'&&this.fields==='updated_at,status')rows=rows.map(r=>({...r,updated_at:'2026-10-21T10:00:00.123457Z'}));
   rows.sort((a,b)=>-compareMedicationHistory(medicationHistoryCursor(a),medicationHistoryCursor(b)));
   if(this.cursor){const match=/created_at\.lt\."([^"]+)".*id\.lt\.([0-9a-f-]{36})\)$/.exec(this.cursor);assert.ok(match,'Actual complete-history cursor must be understood');const cursor=medicationHistoryCursor({created_at:match[1],id:match[2]});rows=rows.filter(r=>compareMedicationHistory(medicationHistoryCursor(r),cursor)<0);}
   rows=rows.slice(0,Math.min(this.maximum,env.pageCap));if(env.leakTenant&&rows.length)rows[0].tenant_id=id(99);
   return {data:this.single?(rows[0]??null):rows,error:null};
  }
 }
 const api=make((role,key)=>role==='denied'||!env.canView?{ok:false,error:'Current wound permission missing'}:null,t=>t!==env.runtimeTenant?{ok:false,error:'Current tenant changed'}:null,()=>env.mode,()=>db,(_db,table)=>new Query(table),promise=>promise,error=>error.message,loadCompleteMedicationHistory,medicationHistoryFilter,medicationHistoryCursor,()=>true,validateWoundRequest,validateWoundLifecycle);
 return {env,api};
}

test('Web reads both explicit active/aktiv states through complete native pages and preserves names',async()=>{
 const {api,env}=setup(),result=await api.fetchWoundClients(tenant,'nurse');assert.equal(result.ok,true);assert.deepEqual(result.data,[{id:id(4),name:'English Case'},{id:id(3),name:'Deutscher Pflegefall'}]);
 assert.ok(env.queries.some(q=>q.table==='clients'&&q.cursor));assert.ok(env.queries.filter(q=>q.table==='clients').length>=3,'Short pages do not silently end the read');
});
for(const status of ['archiviert','inactive','draft','ACTIVE','unknown',null,undefined])test(`Web does not infer active client state from ${String(status)}`,async()=>{
 const {api,env}=setup();env.tables.clients[0].status=status;const r=await api.fetchWoundClients(tenant,'nurse');assert.equal(r.ok,true);assert.equal(r.data.some(p=>p.id===client),false);
});
test('Deleted clients, absent Pflege assignments and explicitly inactive assignments remain excluded',async()=>{
 for(const change of ['deleted','unassigned','inactive']){const {api,env}=setup();if(change==='deleted')env.tables.clients[0].deleted_at=at;else if(change==='unassigned')env.tables.client_module_assignments.shift();else env.tables.client_module_assignments[0].is_active=false;const r=await api.fetchWoundClients(tenant,'nurse');assert.equal(r.ok,true);assert.equal(r.data.some(p=>p.id===client),false);}
});
test('Actual Web wound detail resolves aktiv client and retains unknown native observations without defaults',async()=>{
 const {api}=setup(),r=await api.fetchAmbulatoryWound(tenant,wound,'nurse');assert.equal(r.ok,true);assert.equal(r.data.clientName,'Deutscher Pflegefall');assert.equal(r.data.row.documentation_details.basisStatus,'pending');assert.equal(r.data.assessments[0].observed_at,null);assert.equal(r.data.assessments[0].length_cm,null);assert.equal(r.data.assessments[0].pain_score,null);assert.deepEqual(r.data.assessments[0].unknownOriginal,{zero:0,flag:false});
});
test('Actual Web list keeps two different wound cases for the same aktiv client',async()=>{
 const {api,env}=setup();env.tables.clinical_wound_cases.push(row(31,{...env.tables.clinical_wound_cases[0],id:id(31)}));const r=await api.fetchAmbulatoryWoundList(tenant,'nurse');assert.equal(r.ok,true);assert.deepEqual(r.data.map(v=>v.row.id),[id(31),wound]);assert.ok(r.data.every(v=>v.clientName==='Deutscher Pflegefall'));
});
test('Current permission and tenant mismatches are denied before any native query',async()=>{
 for(const change of ['permission','tenant']){const {api,env}=setup();if(change==='permission')env.canView=false;else env.runtimeTenant=id(99);assert.equal((await api.fetchWoundClients(tenant,'nurse')).ok,false);assert.equal(env.queries.length,0);}
});
test('Foreign native rows and incomplete history cannot produce confirmed client/detail output',async()=>{
 const a=setup();a.env.leakTenant=true;assert.equal((await a.api.fetchWoundClients(tenant,'nurse')).ok,false);
 const b=setup();b.env.failTable='clinical_wound_assessments';assert.equal((await b.api.fetchAmbulatoryWound(tenant,wound,'nurse')).ok,false);
});
test('One-microsecond case change while reading still rejects the Web detail',async()=>{
 const {api,env}=setup();env.changeCase=true;const r=await api.fetchAmbulatoryWound(tenant,wound,'nurse');assert.equal(r.ok,false);assert.match(r.error,/geändert/);
});
test('Demo mode supplies no fabricated wound data and native shared implementation remains a separate file',async()=>{
 const {api,env}=setup();env.mode='demo';assert.equal((await api.fetchWoundClients(tenant,'nurse')).ok,false);assert.equal(env.queries.length,0);
 const shared=readFileSync(new URL('../../src/lib/pflege/ambulatoryWoundService.ts',import.meta.url),'utf8');assert.notEqual(source,shared);assert.match(source,/Web platform adapter/);
});
