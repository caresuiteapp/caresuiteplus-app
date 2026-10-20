import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { isUuid } from '../../src/lib/validation/uuid.ts';
const source = stripTypeScriptTypes(readFileSync(new URL('../../src/lib/clients/clientIntakeCompletion.web.ts',import.meta.url),'utf8')
  .replace(/^import[\s\S]*?;\n/gm,'').replace(/^export /gm,''));
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const timestamp='2026-10-15T07:29:00.123456+00:00';
const form=()=>({salutation:' Frau ',serviceStart:'2026-10-15',housingForm:' Wohnung ',specialNotes:' Original ',preferredContact:' Telefon ',assignedModules:['pflege']});
function environment(patch={}){
 const calls=[];let current=true;
 const client={id:id(3),tenant_id:id(1),status:'lead',updated_at:timestamp};
 const env={calls,client,set current(value){current=value;},...patch};
 const db={from(table){assert.equal(table,'clients');let payload=null,columns;const filters=[];
  const q={select(value){columns=value;return q;},eq(key,value){filters.push([key,value]);return q;},update(value){payload=structuredClone(value);return q;},async maybeSingle(){
   const call={kind:payload?.status==='active'?'activate':payload?'master':'read',payload,columns,filters};calls.push(call);
   await env.before?.(call,env);
   const matches=filters.every(([key,value])=>client[key]===value);
   if(matches&&payload)Object.assign(client,payload);
   let data=matches?structuredClone(client):null;
   if(data&&columns!=='*')data=Object.fromEntries(columns.split(',').map(key=>[key,data[key]]));
   return env.after?.(call,{data,error:null},env)??{data,error:null};
  }};return q;
 }};
 const phase=name=>async(...args)=>{calls.push({kind:name,args:structuredClone(args.map(arg=>arg&&typeof arg==='object'&&typeof arg.isCurrent==='function'?{requestId:arg.requestId}:arg))});await env.phase?.(name,env);return name===env.failPhase?{ok:false,error:'partial'}:{ok:true,data:null};};
 const deps={getSupabaseClient:()=>db,isUuid,
  findExactClientIdentityConflictFromIntake:async()=>{calls.push({kind:'identity'});return env.conflict??{ok:true,data:null};},
  persistClientIntakeDocuments:phase('documents'),persistIntakeCostCarriers:phase('carriers'),syncIntakeClientExtendedData:phase('extended'),
  confirmClientIntakeDocuments:phase('documents-confirm'),
  prepareClientIntakeCompletion:async(_tenant,_client,_actor,request,_review,version)=>{calls.push({kind:'prepare-completion',request,version});return env.failPhase==='prepare-completion'?{ok:false,error:'partial'}:{ok:true,data:{id:id(3),requestId:request,status:'prepared',leadUpdatedAt:version}};},
  finalizeClientIntakeCompletion:async(_tenant,_client,_actor,request,version)=>{calls.push({kind:'finalize-completion',request,version});if(env.failPhase==='finalize-completion')return{ok:false,error:'partial'};client.status='active';client.updated_by=id(2);return{ok:true,data:{id:id(3),requestId:request,status:'active',leadUpdatedAt:version}};},
  mapIntakeModulesToPortal:modules=>modules,saveClientModuleAssignments:phase('modules'),syncClientCoreAfterIntake:phase('core')};
 const complete=new Function(...Object.keys(deps),`${source};return completeWebClientIntake;`)(...Object.values(deps));
 return {...env,client,calls,complete:input=>complete(id(1),id(3),input??form(),id(2),id(80),id(81),id(82),()=>current),set current(value){current=value;}};
}
test('the complete native phase order preserves signed documents before derived records and activates the same lead last',async()=>{
 const e=environment();assert.deepEqual(await e.complete(),{ok:true,data:{id:id(3)}});
 assert.deepEqual(e.calls.map(call=>call.kind),['identity','read','master','documents-confirm','read','prepare-completion','carriers','extended','modules','core','read','finalize-completion']);
 assert.equal(e.client.status,'active');assert.equal(e.client.salutation,'Frau');assert.equal(e.client.service_start,'2026-10-15');
 for(const call of e.calls.filter(call=>call.kind==='master')){
  assert.ok(call.filters.some(([key,value])=>key==='tenant_id'&&value===id(1)));
  assert.ok(call.filters.some(([key,value])=>key==='id'&&value===id(3)));
  assert.ok(call.filters.some(([key,value])=>key==='status'&&value==='lead'));
  assert.ok(call.filters.some(([key,value])=>key==='updated_at'&&value===timestamp));
 }
});
for(const failPhase of ['documents-confirm','prepare-completion','carriers','extended','modules','core','finalize-completion'])test(`failure of ${failPhase} stops subsequent phases and never activates`,async()=>{
 const e=environment({failPhase});assert.equal((await e.complete()).ok,false);
 assert.equal(e.calls.some(call=>call.kind==='activate'),false);assert.equal(e.client.status,'lead');
 const order=['documents-confirm','prepare-completion','carriers','extended','modules','core','finalize-completion'];assert.deepEqual(e.calls.filter(call=>order.includes(call.kind)).map(call=>call.kind),order.slice(0,order.indexOf(failPhase)+1));
});
for(const conflict of [{ok:false,error:'lookup denied'},{ok:true,data:{clientId:id(4)}}])test('an unresolved identity check cannot mutate the original lead',async()=>{
 const e=environment({conflict});assert.equal((await e.complete()).ok,false);assert.deepEqual(e.calls.map(call=>call.kind),['identity']);
});
for(const status of ['active','archived','deleted'])test(`a previously ${status} person is never turned back into a lead`,async()=>{
 const e=environment();e.client.status=status;assert.equal((await e.complete()).ok,false);assert.equal(e.calls.some(call=>call.payload),false);assert.equal(e.client.status,status);
});
test('a one-microsecond concurrent master edit fails the native compare and stops all document writes',async()=>{
 const e=environment({before:call=>{if(call.kind==='master')e.client.updated_at='2026-10-15T07:29:00.123457+00:00';}});
 assert.equal((await e.complete()).ok,false);assert.equal(e.calls.some(call=>call.kind==='documents'),false);assert.equal(e.client.salutation,undefined);
});
test('the exact final microsecond revision is handed to the server activation receipt',async()=>{
 const e=environment();assert.equal((await e.complete()).ok,true);const finalize=e.calls.find(call=>call.kind==='finalize-completion');assert.equal(finalize.version,timestamp);
});
for(const phase of ['documents-confirm','carriers','extended','modules','core'])test(`owner revocation during ${phase} prevents later phases and activation`,async()=>{
 const e=environment({phase:async name=>{if(name===phase)e.current=false;}});assert.equal((await e.complete()).ok,false);assert.equal(e.calls.some(call=>call.kind==='activate'),false);
 const order=['documents-confirm','carriers','extended','modules','core'];assert.deepEqual(e.calls.filter(call=>order.includes(call.kind)).map(call=>call.kind),order.slice(0,order.indexOf(phase)+1));
});
for(const kind of ['master'])test(`a forged ${kind} return cannot confirm successful completion`,async()=>{
 const e=environment({after:(call,result)=>call.kind===kind?{data:{...result.data,tenant_id:id(9)},error:null}:result});assert.equal((await e.complete()).ok,false);
});
test('a lost server activation receipt remains uncertain even if activation may have happened',async()=>{
 const e=environment({failPhase:'finalize-completion'});assert.equal((await e.complete()).ok,false);assert.equal(e.client.status,'lead');
});
test('completion captures all inputs before its first awaited identity check',async()=>{
 const input=form();const e=environment({before:call=>{if(call.kind==='read'){input.salutation='Changed';input.assignedModules.length=0;}}});
 assert.equal((await e.complete(input)).ok,true);assert.equal(e.client.salutation,'Frau');assert.equal(e.calls.some(call=>call.kind==='modules'),true);
});
