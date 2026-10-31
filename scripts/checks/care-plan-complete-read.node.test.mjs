import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { readCompleteCarePlanRows } from '../../src/lib/pflege/carePlanCompleteRead.ts';
const id=n=>String(n).padStart(8,'0');
const rows=n=>Array.from({length:n},(_,i)=>({id:id(i),tenant_id:'own'}));
for(const n of [0,1,499,500,501,1001,1500])test(`counted reader completes ${n} rows beyond single-response cap`,async()=>{
  const all=rows(n),calls=[];
  const r=await readCompleteCarePlanRows(async(from,to)=>{calls.push([from,to]);return{data:all.slice(from,to+1),count:n,error:null};},r=>r.tenant_id==='own');
  assert.equal(r.ok,true);assert.equal(r.data.length,n);assert.equal(calls.length,Math.max(1,Math.ceil(n/500)));
});
for(const [name,patch] of [
  ['missing count',p=>p.count=null],['missing error metadata',p=>delete p.error],['noncanonical id',p=>p.data[0].id=' '+p.data[0].id],['fractional count',p=>p.count=1.5],['negative count',p=>p.count=-1],['excessive count',p=>p.count=100001],
  ['truncated data',p=>p.data=p.data.slice(0,2)],['missing data',p=>p.data=null],['duplicate rows',p=>p.data[1]=p.data[0]],
  ['foreign tenant',p=>p.data[0].tenant_id='foreign'],['missing id',p=>delete p.data[0].id],['error',p=>p.error={code:'42501'}],
])test(`counted reader rejects ${name} without returning partial rows`,async()=>{
  const all=rows(501);const r=await readCompleteCarePlanRows(async(from,to)=>{const p={data:all.slice(from,to+1),count:all.length,error:null};patch(p);return p;},r=>r.tenant_id==='own');
  assert.equal(r.ok,false);assert.equal('data'in r,false);
});
test('count change on later page rejects the entire selection',async()=>{
  const all=rows(501);const r=await readCompleteCarePlanRows(async(from,to)=>({data:all.slice(from,to+1),count:from?502:501,error:null}),()=>true);assert.equal(r.ok,false);
});
test('later page exception never publishes earlier rows',async()=>{
  const all=rows(501);const r=await readCompleteCarePlanRows(async(from,to)=>{if(from)throw Error('offline');return{data:all.slice(from,to+1),count:501,error:null};},()=>true);assert.equal(r.ok,false);
});
function repositoryHarness(count=1101,patch=()=>{}){
  const plans=rows(count).map((r,i)=>({...r,client_id:'c'+r.id,primary_nurse_id:'n'+r.id,title:'Plan '+i,status:'draft',updated_at:'2026-10-31',valid_from:'2026-10-31'}));
  const tables={care_plans:plans,clients:plans.map(r=>({id:r.client_id,tenant_id:'own',first_name:r.id,last_name:'Name'})),employees:plans.map(r=>({id:r.primary_nurse_id,tenant_id:'own',first_name:'Nurse'})),care_plan_items:plans.flatMap(r=>Array.from({length:6},(_,j)=>({id:r.id+'i'+j,tenant_id:'own',care_plan_id:r.id,title:'Measure '+j,sort_order:5-j}))),care_diagnoses:[],care_medical_orders:[]};
  const calls=[];const sdk={};
  const fromUnknownTable=(db,table)=>{
    assert.equal(db,sdk);const filters=[],call={table,filters};let from=0,to=Infinity,head=false;calls.push(call);
    const response=()=>{let data=tables[table].filter(r=>filters.every(([k,op,v])=>op==='eq'?r[k]===v:op==='neq'?r[k]!==v:v.includes(r[k]))).sort((a,b)=>a.id.localeCompare(b.id));let r={data:head?null:structuredClone(data.slice(from,to+1)),count:data.length,error:null};patch(r,call);return r;};
    const builder={select:(columns,options)=>{call.columns=columns;call.options=options;head=options?.head===true;return builder;},eq:(k,v)=>{filters.push([k,'eq',v]);return builder;},neq:(k,v)=>{filters.push([k,'neq',v]);return builder;},in:(k,v)=>{assert(v.length<=100);filters.push([k,'in',v]);return builder;},order:(k)=>{assert.equal(k,'id');return builder;},range:(a,b)=>{from=a;to=b;call.range=[a,b];return builder;},maybeSingle:async()=>{const r=response();return{...r,data:r.data[0]??null};},then:(yes,no)=>Promise.resolve().then(response).then(yes,no)};return builder;
  };
  const raw=readFileSync(new URL('../../src/lib/pflege/carePlanRepository.supabase.ts',import.meta.url),'utf8');
  const source=stripTypeScriptTypes(raw.replace(/^import .*;\n/gm,''),{mode:'strip'}).replace(/^export /gm,'');
  const repo=new Function('getSupabaseClient','fromUnknownTable','toGermanSupabaseError','SERVICE_ERRORS','readCompleteCarePlanRows',source+'\nreturn carePlanLiveRepository;')(()=>sdk,fromUnknownTable,()=> 'Datenbankfehler',{supabaseUnavailable:'unavailable'},readCompleteCarePlanRows);
  return{repo,calls,tables};
}
test('actual repository completes 1101 plans, 6606 measures and bounded reference batches',async()=>{
  const h=repositoryHarness();const r=await h.repo.list('own');assert.equal(r.ok,true);assert.equal(r.data.length,1101);assert(r.data.every(r=>r.clientName.endsWith('Name')));
  assert.equal(h.calls.filter(c=>c.table==='care_plans').length,3);assert(h.calls.every(c=>c.options.count==='exact'));
  assert(h.calls.filter(c=>c.table==='care_plan_items').length>12);
});
for(const table of ['care_plans','clients','employees','care_plan_items'])test(`actual repository rejects foreign ${table} row despite filters`,async()=>{
  const h=repositoryHarness(2,(r,c)=>{if(c.table===table&&r.data?.length)r.data[0].tenant_id='foreign';});assert.equal((await h.repo.list('own')).ok,false);
});
test('actual repository rejects truncated reference response instead of incomplete counts',async()=>{
  const h=repositoryHarness(100,(r,c)=>{if(c.table==='care_plan_items')r.data=r.data.slice(0,100);});assert.equal((await h.repo.list('own')).ok,false);
});
test('actual detail independently rejects wrong singleton scope before reading any references',async()=>{
  const h=repositoryHarness(1,(r,c)=>{if(c.table==='care_plans')r.data[0].tenant_id='foreign';});assert.equal((await h.repo.get('own',id(0))).ok,false);assert.equal(h.calls.length,1);
});
test('actual detail reads all 1201 measures and preserves declared sort order',async()=>{
  const h=repositoryHarness(1);const plan=h.tables.care_plans[0];h.tables.care_plan_items=Array.from({length:1201},(_,i)=>({id:id(i),tenant_id:'own',care_plan_id:plan.id,title:'Measure '+i,sort_order:1200-i}));
  const r=await h.repo.get('own',plan.id);assert.equal(r.ok,true);assert.equal(r.data.tasks.length,1201);assert.equal(r.data.tasks[0].label,'Measure 1200');assert.equal(r.data.dueVitalsCount,null);
});

test('actual repository rejects a moving duplicate measure across disjoint plan batches',async()=>{
  const h=repositoryHarness(101,(r,c)=>{if(c.table==='care_plan_items'&&c.filters.some(([k,op,v])=>k==='care_plan_id'&&op==='in'&&v.includes(id(100)))&&r.data.length)r.data[0].id=id(0)+'i0';});
  assert.equal((await h.repo.list('own')).ok,false);
});

for (const table of ['care_diagnoses','care_medical_orders']) test(`actual detail rejects missing ${table} count instead of claiming zero`,async()=>{
  const h=repositoryHarness(1,(r,c)=>{if(c.table===table)r.count=null;});assert.equal((await h.repo.get('own',id(0))).ok,false);
});
test('actual detail rejects a negative head count',async()=>{
  const h=repositoryHarness(1,(r,c)=>{if(c.table==='care_diagnoses')r.count=-1;});assert.equal((await h.repo.get('own',id(0))).ok,false);
});
test('actual detail distinguishes an unreadable assigned nurse from no assignment',async()=>{
  const h=repositoryHarness(1);h.tables.employees=[];const r=await h.repo.get('own',id(0));assert.equal(r.ok,true);assert.equal(r.data.employeeName,'Zugeordnete Pflegekraft nicht lesbar.');
});
