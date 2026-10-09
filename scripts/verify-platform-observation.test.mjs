import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
import { dirname,resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { webcrypto } from 'node:crypto';
import { createContext,SourceTextModule,SyntheticModule } from 'node:vm';
import { test } from 'node:test';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const requests=[];let rpcError=null;let demo=false;let dnt='0';let pageVisible='visible';
const config={url:'https://example.supabase.co',anonKey:'sb_publishable_test'};
const browser={location:{hostname:'www.caresuiteplus.app'}};
const navigation={get doNotTrack(){return dnt;},globalPrivacyControl:false};
const context=createContext({URL,Request,Response,console,crypto:webcrypto,TextEncoder,Uint8Array,AbortController,setTimeout,clearTimeout,
  window:browser,navigator:navigation,document:{get visibilityState(){return pageVisible;}},
  fetch:async(url,init)=>{requests.push({url,init,body:init?.body?JSON.parse(init.body):null});return new Response('{}',{status:200});}});
const boundaries={
  '@/lib/supabase/config':{getSupabaseConfig:()=>config,isDemoMode:()=>demo,isSupabaseConfigured:()=>true},
  '@/lib/services/mode':{getServiceMode:()=>demo?'demo':'supabase'},
  './platformSupabaseClient':{platformRpc:async(name,args)=>{requests.push({name,args});return {data:name==='platform_set_incident_resolution'?null:{items:[]},error:rpcError};}},
};
const cache=new Map();
async function moduleFor(file){
  if(cache.has(file))return cache.get(file);
  const source=ts.transpileModule(await readFile(file,'utf8'),{
    compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext},
  }).outputText;
  const mod=new SourceTextModule(source,{context,identifier:file});cache.set(file,mod);
  await mod.link(async(specifier)=>{
    const values=boundaries[specifier];assert.ok(values,'Unexpected boundary: '+specifier);
    const key='boundary:'+specifier;
    if(!cache.has(key))cache.set(key,new SyntheticModule(Object.keys(values),function(){for(const[k,v]of Object.entries(values))this.setExport(k,v);},{context}));
    return cache.get(key);
  });
  await mod.evaluate();return mod;
}
const core=(await moduleFor(resolve(root,'supabase/functions/platform-observation/core.ts'))).namespace;
const observation=(await moduleFor(resolve(root,'src/lib/platformConsole/platformObservation.web.ts'))).namespace;
const uuid='00000000-0000-4000-8000-000000000001';
const base={kind:'heartbeat',sessionId:uuid,sessionSecret:'a'.repeat(64),surface:'website',area:'website',active:true};
const plain=value=>JSON.parse(JSON.stringify(value));
const flush=()=>new Promise(resolve=>setTimeout(resolve,25));

test('collector allowlist drops identities, form fields, query URLs and credential-shaped values',()=>{
  const value=core.normalizeObservation({...base,tenantId:uuid,authUserId:uuid,email:'private@example.test',password:'private',url:'https://site/?token=private'});
  assert.deepEqual(plain(value),base);
});
test('invalid collectors cannot submit raw errors, completed signups or array identities',()=>{
  for(const value of [null,[],{}, {...base,sessionId:[uuid]}, {...base,active:'true'}, {...base,surface:'admin'},
    {...base,kind:'error',category:'a raw password',operation:'page'},
    {...base,kind:'registration',attemptId:uuid,eventId:uuid,stage:5,state:'progress'},
    {...base,kind:'registration',attemptId:uuid,eventId:uuid,stage:4,state:'completed'}])assert.equal(core.normalizeObservation(value),null);
});
test('registration observations retain bounded stages and no form contents',()=>{
  const value=core.normalizeObservation({...base,kind:'registration',attemptId:uuid,eventId:uuid,stage:3,state:'submitting',adminPassword:'private'});
  assert.equal(value.stage,3);assert.equal(value.state,'submitting');assert.equal('adminPassword' in value,false);
});
test('server rate hash is salted, changes daily, and contains no IP address',async()=>{
  const a=await core.observationIpHash('192.0.2.1','server-test-secret','2026-10-07');
  assert.match(a,/^[a-f0-9]{64}$/);
  assert.notEqual(a,await core.observationIpHash('192.0.2.1','other-secret','2026-10-07'));
  assert.notEqual(a,await core.observationIpHash('192.0.2.1','server-test-secret','2026-10-08'));
});
test('completion correlation reaches only the server endpoint and optional failure never changes registration',async()=>{
  const calls=[];const client={rpc:async(name,args)=>{calls.push({name,args});return {data:true,error:null};}};
  await core.confirmRegistrationObservation(client,{sessionId:uuid,sessionSecret:'a'.repeat(64),attemptId:uuid},201,{tenantId:uuid,owner:{id:uuid},password:'private'});
  assert.equal(calls[0].name,'platform_confirm_registration_observation');assert.equal(calls[0].args.p_http_status,201);
  assert.equal(JSON.stringify(calls).includes('password'),false);
  await core.confirmRegistrationObservation({rpc:async()=>{throw new Error('offline');}},{sessionId:uuid,sessionSecret:'a'.repeat(64),attemptId:uuid},503,{});
  await core.confirmRegistrationObservation(client,null,201,{});assert.equal(calls.length,1);
});
test('page classification removes record IDs and secret queries',()=>{
  assert.deepEqual(plain(observation.observationPageContext('/portal/employee/assignments/'+uuid+'?token=private')),{surface:'software',area:'employee'});
  assert.deepEqual(plain(observation.observationPageContext('/liquid-command/access/register')),{surface:'registration',area:'registration'});
  assert.deepEqual(plain(observation.observationPageContext('/',true)),{surface:'software',area:'other'});
  assert.deepEqual(plain(observation.observationPageContext('/platform/tenants/'+uuid)),{surface:'platform',area:'platform'});
});
test('observations start disabled and disabling removes in-memory attempt data',async()=>{
  requests.length=0;await observation.observeHeartbeat();
  assert.equal(await observation.prepareRegistrationObservation(),null);
  observation.recordObservedError('render','page');assert.equal(requests.length,0);
  let cloned=false;const response={ok:false,status:500,clone(){cloned=true;throw new Error('must not clone');}};
  await observation.createObservedSupabaseFetch(async()=>response)(config.url+'/rest/v1/clients');
  assert.equal(cloned,false);observation.setObservationCollectionEnabled(true);
});
test('in-memory heartbeat is authenticated separately and hidden pages immediately stop being active',async()=>{
  requests.length=0;observation.setObservationAccessToken('test-user-jwt');observation.setObservationPage('/office/clients/'+uuid);
  await observation.observeHeartbeat(false);
  assert.equal(requests[0].body.active,false);assert.equal(requests[0].body.area,'office');assert.equal('authUserId' in requests[0].body,false);
  assert.equal(requests[0].init.headers.Authorization,'Bearer test-user-jwt');
  assert.equal(JSON.stringify(requests[0].body).includes('test-user-jwt'),false);
  observation.setObservationAccessToken(null);
});
test('Do Not Track, privacy control, demo and preview pages send no observation',async()=>{
  requests.length=0;dnt='1';await observation.observeHeartbeat();dnt='0';
  navigation.globalPrivacyControl=true;await observation.observeHeartbeat();navigation.globalPrivacyControl=false;
  demo=true;await observation.observeHeartbeat();demo=false;
  browser.location.hostname='preview.vercel.app';await observation.observeHeartbeat();browser.location.hostname='www.caresuiteplus.app';
  assert.equal(requests.length,0);
});
test('signup submission reuses its attempt, never reports client completion and keeps passwords outside monitoring',async()=>{
  requests.length=0;observation.setObservationPage('/auth/register');observation.observeRegistrationStep(2);await flush();
  const first=requests[0].body.attemptId;
  const correlation=await observation.prepareRegistrationObservation();assert.equal(correlation.attemptId,first);
  assert.equal(requests.at(-1).body.state,'submitting');
  observation.finishRegistrationObservation(true);await observation.observeHeartbeat();
  assert.equal(requests.at(-1).body.kind,'heartbeat');assert.equal(requests.some(x=>x.body?.state==='completed'),false);
});
test('HTTP error collection preserves the response and recognizes database timeouts without retaining messages',async()=>{
  requests.length=0;observation.setObservationPage('/assist');
  const original=new Response(JSON.stringify({code:'57014',message:'private@example.test',details:'password=private'}),{status:500});
  const fetch=observation.createObservedSupabaseFetch(async()=>original);
  const result=await fetch(config.url+'/rest/v1/assist_visits?client_id='+uuid);
  assert.equal(result,original);assert.equal((await result.json()).message,'private@example.test');await flush();
  const event=requests.find(x=>x.body?.kind==='error');assert.equal(event.body.category,'timeout');assert.equal(event.body.httpStatus,500);
  assert.equal(JSON.stringify(event.body).includes('private'),false);assert.equal(JSON.stringify(event.body).includes('assist_visits'),false);
});
test('caller cancellations and failures of the collector itself do not recursively generate incidents',async()=>{
  requests.length=0;const controller=new AbortController();controller.abort();
  const abort=Object.assign(new Error('cancelled'),{name:'AbortError'});
  await assert.rejects(observation.createObservedSupabaseFetch(async()=>{throw abort;})(config.url+'/rest/v1/clients',{signal:controller.signal}));
  await observation.createObservedSupabaseFetch(async()=>new Response('{}',{status:503}))(config.url+'/functions/v1/platform-observation');
  await flush();assert.equal(requests.length,0);
});

test('planned maintenance and paused signup responses stay visible without creating server incidents',async()=>{
  requests.length=0;observation.setObservationPage('/auth/register');
  for(const code of ['maintenance_active','registration_paused']){
    const original=new Response(JSON.stringify({code,error:'Planned operational closure'}),{status:503});
    const result=await observation.createObservedSupabaseFetch(async()=>original)(config.url+'/functions/v1/register-business-tenant');
    assert.equal(result,original);await flush();
  }
  assert.equal(requests.length,0);
  await observation.createObservedSupabaseFetch(async()=>new Response(JSON.stringify({code:'unexpected_server_failure'}),{status:503}))(config.url+'/functions/v1/register-business-tenant');
  await flush();assert.equal(requests.find(x=>x.body?.kind==='error')?.body.category,'server');
});

test('collection cannot start until both the approved server release and collector are ready',async()=>{
  const original=context.fetch;const calls=[];
  context.fetch=async url=>{calls.push(url);return new Response(JSON.stringify({release:'caresuite-platform-operations-20261007',inventoryReady:true,observationReady:false}),{status:200});};
  assert.equal(await observation.isObservationCollectionReady(),false);assert.equal(calls.length,1);
  calls.length=0;
  context.fetch=async url=>{calls.push(url);return new Response(JSON.stringify(url.includes('/rpc/')?{release:'caresuite-platform-operations-20261007',inventoryReady:true,observationReady:true}:{release:'old',ready:true}),{status:200});};
  assert.equal(await observation.isObservationCollectionReady(),false);assert.equal(calls.length,2);
  context.fetch=async url=>new Response(JSON.stringify(url.includes('/rpc/')?{release:'caresuite-platform-operations-20261007',inventoryReady:true,observationReady:true}:{release:'caresuite-platform-operations-20261007',ready:true}),{status:200});
  assert.equal(await observation.isObservationCollectionReady(),true);
  context.fetch=async()=>{throw new Error('offline');};assert.equal(await observation.isObservationCollectionReady(),false);
  context.fetch=original;
});
test('deactivation clears the tab identity and suppresses future signup, heartbeat and error writes',async()=>{
  requests.length=0;observation.observeRegistrationStep(2);await flush();const before=requests[0].body.sessionId;
  observation.setObservationCollectionEnabled(false);requests.length=0;
  observation.observeRegistrationIssue();observation.leaveRegistrationObservation();await observation.observeHeartbeat();
  assert.equal(await observation.prepareRegistrationObservation(),null);assert.equal(requests.length,0);
  observation.setObservationCollectionEnabled(true);await observation.observeHeartbeat();
  assert.notEqual(requests[0].body.sessionId,before);observation.setObservationCollectionEnabled(false);
});
test('a form already open during the readiness check records its current first step when collection starts',async()=>{
  observation.setObservationCollectionEnabled(false);observation.setObservationPage('/auth/register');requests.length=0;
  const unsubscribe=observation.subscribeObservationCollection(()=>observation.observeRegistrationStep(0));
  observation.observeRegistrationStep(0);assert.equal(requests.length,0);
  observation.setObservationCollectionEnabled(true);await flush();
  assert.equal(requests[0].body.kind,'registration');assert.equal(requests[0].body.stage,0);
  const first=requests[0].body.attemptId;
  observation.setObservationCollectionEnabled(true);await flush();assert.equal(requests.length,1);
  observation.observeRegistrationStep(1);await flush();assert.equal(requests.at(-1).body.attemptId,first);
  unsubscribe();observation.setObservationCollectionEnabled(false);requests.length=0;
  observation.setObservationCollectionEnabled(true);await flush();assert.equal(requests.length,0);
  observation.setObservationCollectionEnabled(false);
});
