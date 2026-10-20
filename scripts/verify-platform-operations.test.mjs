import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';
import { dirname,resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createContext,SourceTextModule,SyntheticModule } from 'node:vm';
import { test } from 'node:test';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const requests=[];let rpcError=null;let demo=false;let summaryResult={telemetry:null};
const context=createContext({console});
const boundaries={
  '@/lib/services/mode':{getServiceMode:()=>demo?'demo':'supabase'},
  './platformSupabaseClient':{platformRpc:async(name,args)=>{requests.push({name,args});return {data:name==='platform_set_incident_resolution'?null:name==='platform_get_operations_summary'?summaryResult:{items:[]},error:rpcError};}},
};
const cache=new Map();
async function moduleFor(file){
  if(cache.has(file))return cache.get(file);
  const mod=new SourceTextModule(stripTypeScriptTypes(await readFile(file,'utf8')),{context,identifier:file});cache.set(file,mod);
  await mod.link(async(specifier)=>{
    if(!boundaries[specifier]&&specifier.startsWith('.'))return moduleFor(resolve(dirname(file),specifier+'.ts'));
    const values=boundaries[specifier];assert.ok(values,'Unexpected boundary: '+specifier);
    const key='boundary:'+specifier;
    if(!cache.has(key))cache.set(key,new SyntheticModule(Object.keys(values),function(){for(const[k,v]of Object.entries(values))this.setExport(k,v);},{context}));
    return cache.get(key);
  });
  await mod.evaluate();return mod;
}
const service=(await moduleFor(resolve(root,'src/lib/platformConsole/platformOperationsService.web.ts'))).namespace;
const capabilities=(await moduleFor(resolve(root,'src/lib/platformConsole/platformCapabilities.web.ts'))).namespace;
const uuid='00000000-0000-4000-8000-000000000001';
const plain=value=>JSON.parse(JSON.stringify(value));
test('list paging and filter values reach the actual service contract',async()=>{
  requests.length=0;await service.listRegistrationActivity('inactive',50);await service.listRuntimeIncidents('resolved',100);
  assert.deepEqual(plain(requests.map(x=>x.args)),[{p_state:'inactive',p_offset:50},{p_status:'resolved',p_offset:100}]);
});
test('resolution requires a reason, preserves concurrency token and propagates server failure',async()=>{
  requests.length=0;const row={id:uuid,last_seen_at:'2026-10-07T12:00:00Z'};
  await assert.rejects(service.setIncidentResolution(row,true,'x'));assert.equal(requests.length,0);
  await service.setIncidentResolution(row,true,'Bearbeitung geprüft');
  assert.equal(requests[0].args.p_expected_last_seen_at,row.last_seen_at);
  rpcError={message:'Stand wurde geändert'};await assert.rejects(service.setIncidentResolution(row,true,'Bearbeitung geprüft'),/Stand wurde geändert/);rpcError=null;
});
test('demo operations never fabricate real-time figures or write resolutions',async()=>{
  demo=true;requests.length=0;
  await assert.rejects(service.getPlatformOperationsSummary(),/keine Live-Zahlen/);
  await assert.rejects(service.setIncidentResolution({id:uuid},true,'Bearbeitung geprüft'));
  assert.equal(requests.length,0);demo=false;
});

test('inventory-only release does not call absent registration or error endpoints',async()=>{
  summaryResult={telemetry:null};
  for(const tab of ['registrations','errors','live','inventory']){
    requests.length=0;const result=await service.getPlatformOperationsPage({full:true,canMonitor:true,tab,registrationState:'',incidentStatus:'open',offset:0});
    assert.equal(requests.length,1);assert.equal(requests[0].name,'platform_get_operations_summary');
    assert.equal(result.registrations,null);assert.equal(result.incidents,null);
  }
});
test('installed observation endpoints are queried only for an authorized requested tab',async()=>{
  summaryResult={telemetry:{firstEventAt:null}};
  const options={full:true,canMonitor:true,tab:'registrations',registrationState:'inactive',incidentStatus:'open',offset:50};
  requests.length=0;await service.getPlatformOperationsPage(options);
  assert.deepEqual(plain(requests.map(x=>x.name)),['platform_get_operations_summary','platform_list_registration_activity']);
  requests.length=0;await service.getPlatformOperationsPage({...options,canMonitor:false});assert.equal(requests.length,1);
  requests.length=0;await service.getPlatformOperationsPage({...options,full:false});assert.equal(requests.length,1);
  requests.length=0;await service.getPlatformOperationsPage({...options,tab:'errors'});assert.equal(requests[1].name,'platform_list_runtime_incidents');
  summaryResult={telemetry:null};
});
test('web capabilities follow server denials for read-only support and retired paid features',()=>{
  assert.equal(capabilities.platformRoleHasCapability('platform_readonly','support.read'),false);
  assert.equal(capabilities.platformRoleHasCapability('platform_readonly','tenants.read'),true);
  for(const role of ['platform_admin','platform_support','platform_developer','platform_readonly']){
    assert.equal(capabilities.platformRoleHasCapability(role,'bodymap.review.read'),false);
    assert.equal(capabilities.platformRoleHasCapability(role,'bodymap.review.write'),false);
  }
  for(const role of ['platform_owner','platform_admin','platform_billing','platform_support','platform_developer','platform_readonly'])
    for(const capability of ['plans.read','plans.write','billing.read','billing.write','payments.read','payments.write','discounts.read','discounts.write'])
      assert.equal(capabilities.platformRoleHasCapability(role,capability),false);
});
