import {assertCareSdkOwnerWeb} from '../../src/lib/permissions/careSdkOwner.web.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { isUuid } from '../../src/lib/validation/uuid.ts';
const body=path=>stripTypeScriptTypes(readFileSync(new URL(`../../${path}`,import.meta.url),'utf8').replace(/^import[\s\S]*?;\n/gm,'').replace(/^export /gm,''));
const source=body('src/lib/clients/clientIntakeIdentitySession.web.ts');
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const time='2026-10-15T06:10:00.123456+00:00';
const form=(patch={})=>({firstName:'Anna',lastName:'Meyer',dateOfBirth:'1940-02-29',insuranceNumber:'A123456789',...patch});
const row=(n=20,patch={})=>({id:id(n),tenant_id:id(1),first_name:'Anne',last_name:'Meyer',date_of_birth:'1940-02-28',insurance_number:'B987654321',status:'active',updated_at:time,...patch});
const binding=(patch={})=>({clientId:null,allocation:'new',stage:'ready',...patch});
const deferred=()=>{let resolve;const promise=new Promise(r=>{resolve=r;});return{promise,resolve};};
const like=(value,pattern)=>{let expression='',escaped=false;for(const char of pattern){if(escaped){expression+=char.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');escaped=false;}else if(char==='\\')escaped=true;else if(char==='%')expression+='.*';else if(char==='_')expression+='.';else expression+=char.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');}return new RegExp(`^${expression}$`,'iu').test(String(value??''));};
function environment(initial=[],patch={}){
 const rows=structuredClone(initial),calls=[];
 const env={allowed:true,current:true,token:'test-token',userId:id(2),expiresAt:(Math.floor(Date.now()/1000)+3600)*1000,cap:100,...patch};
 const db={async rpc(name,args){
  if(['resolve_current_profile_id','current_tenant_id'].includes(name)){calls.push({authority:name});await env.authority?.(name);return env.authorityResult?.(name)??{data:name==='resolve_current_profile_id'?id(2):id(1),error:null};}
  assert.equal(name,'web_prepare_client_intake_identity_review');calls.push({rpc:name,args:structuredClone(args)});await env.prepare?.(args);
  const prepared=Date.now();return env.prepareResult??{data:{review_id:id(500),request_id:args.p_request_id,tenant_id:args.p_tenant_id,actor_profile_id:args.p_actor_profile_id,
   resolution:'create_distinct',candidate_count:args.p_candidates.length,prepared_at:new Date(prepared).toISOString(),expires_at:new Date(prepared+300000).toISOString()},error:null};
 },auth:{async getSession(){calls.push({auth:'session'});await env.session?.();return env.sessionResult??{data:{session:{user:{id:env.userId},access_token:env.token,expires_at:env.expiresAt/1000}},error:null};},
 async getUser(token){calls.push({auth:'user',token});await env.user?.();return env.userResult??{data:{user:{id:env.userId}},error:null};}},from(table){
  assert.equal(table,'clients');const filters=[];let limit=100;const query={
   select(columns){assert.equal(columns,'id,tenant_id,first_name,last_name,date_of_birth,insurance_number,status,updated_at');return query;},
   eq(key,value){filters.push(['eq',key,value]);return query;},neq(key,value){filters.push(['neq',key,value]);return query;},gt(key,value){filters.push(['gt',key,value]);return query;},
   ilike(key,value){filters.push(['ilike',key,value]);return query;},order(key,options){assert.equal(key,'id');assert.deepEqual(options,{ascending:true});return query;},limit(value){limit=value;return query;},
   then(resolve,reject){return(async()=>{const call={filters:structuredClone(filters)};calls.push(call);await env.before?.(call,rows);
    const result={data:rows.filter(row=>filters.every(([kind,key,value])=>kind==='eq'?row[key]===value:kind==='neq'?row[key]!==value:kind==='gt'?row[key]>value:like(row[key],value)))
     .sort((a,b)=>a.id.localeCompare(b.id)).slice(0,Math.min(limit,env.cap)).map(row=>structuredClone(row)),error:null};
    return env.result?.(call,result,rows)??result;
   })().then(resolve,reject);}
  };return query;
 }};
 let sdk=db;
 const ClientIntakeIdentitySession=new Function('getSupabaseClient','isUuid','assertCareSdkOwnerWeb',`${source};return ClientIntakeIdentitySession;`)(()=>sdk,isUuid,assertCareSdkOwnerWeb);
 const session=new ClientIntakeIdentitySession({owner:{tenantId:id(1),profileId:id(2),roleKey:'business_admin',accessToken:'test-token',expiresAt:env.expiresAt,demo:false},isCurrent:()=>env.current,canRead:()=>env.allowed,captureRead:()=>{const epoch=env.permissionEpoch??0;return()=>env.current&&env.allowed&&epoch===(env.permissionEpoch??0);}});
 return{rows,calls,env,db,session,set sdk(value){sdk=value;}};
}

test('native capped pages are exhausted through a real empty page and insurance adds otherwise absent names',async()=>{
 const e=environment([row(20),row(21),row(22),row(23,{last_name:'Schmidt',insurance_number:'A123456789'})],{cap:2});
 assert.equal(await e.session.review(form(),binding()),true);assert.equal(e.session.view().candidates.length,4);assert.equal(e.session.view().exactConflict,true);
 const nameCalls=e.calls.filter(call=>call.filters?.some(([kind,key])=>kind==='ilike'&&key==='last_name'));
 assert.equal(nameCalls.length,3);assert.ok(nameCalls[1].filters.some(([kind,key,value])=>kind==='gt'&&key==='id'&&value===id(21)));
 assert.ok(e.calls.filter(call=>call.filters).every(call=>call.filters.some(([kind,key,value])=>kind==='eq'&&key==='tenant_id'&&value===id(1))));
});
test('similar names require an explicit reason and remain a distinct creation choice',async()=>{
 const e=environment([row()]);await e.session.review(form(),binding());assert.equal(e.session.permits(form(),binding()),false);
 assert.equal(e.session.approveNew('anders'),false);assert.equal(e.session.approveNew('Geburtsdatum und Versicherungsnummer weichen ab.'),true);
 assert.equal(e.session.decision().resolution,'create_distinct');assert.equal(e.session.permits(form(),binding()),true);
 await e.session.assertCurrent(form(),binding({clientId:id(80)}));assert.equal(e.session.permits(form(),binding({clientId:id(80),allocation:'existing'})),true);
 assert.equal(e.session.permits(form(),binding({clientId:id(99),allocation:'existing'})),false);
});
for(const match of [{first_name:'anna',date_of_birth:'1940-02-29'},{insurance_number:'a123456789'},{status:'deleted',insurance_number:'A123456789'}])test('an exact native identity blocks a second person even with an explicit distinctness reason',async()=>{
 const e=environment([row(20,match)]);await e.session.review(form(),binding());assert.equal(e.session.view().exactConflict,true);assert.equal(e.session.approveNew('Person wurde mit Nachweisen abgeglichen.'),false);assert.equal(e.session.permits(form(),binding()),false);
});
test('an explicitly empty native result still requires an actual user creation decision',async()=>{
 const e=environment();await e.session.review(form(),binding());assert.equal(e.session.permits(form(),binding()),false);assert.equal(e.session.approveNew(''),true);await e.session.assertCurrent(form(),binding({clientId:id(80)}));
});
test('opening an explicitly selected candidate rereads the original and never writes a person',async()=>{
 const e=environment([row()]);await e.session.review(form(),binding());const before=e.calls.length;
 const decision=await e.session.selectExisting(id(20),form(),binding());assert.equal(decision.resolution,'open_existing');assert.equal(e.session.permits(form(),binding()),false);assert.ok(e.calls.length>before);
 await assert.rejects(e.session.selectExisting(id(99),form(),binding()));
});
test('a previously bound live lead cannot select a different existing person',async()=>{
 const e=environment([row()]);await e.session.review(form(),binding({clientId:id(80),allocation:'existing'}));
 await assert.rejects(e.session.selectExisting(id(20),form(),binding({clientId:id(80),allocation:'existing'})));
 assert.equal(e.session.approveNew('Die ähnlichen Angaben gehören einer anderen Person.'),true);assert.equal(e.session.decision().resolution,'continue_draft');
});
test('a deleted candidate cannot be opened or silently bypassed for duplicate creation',async()=>{
 const e=environment([row(20,{status:'deleted'})]);await e.session.review(form(),binding());await assert.rejects(e.session.selectExisting(id(20),form(),binding()),/nicht.*geöffnet/);
});
for(const action of ['create','open'])test(`a one-microsecond changed candidate invalidates a prior ${action} decision`,async()=>{
 const e=environment([row()]);await e.session.review(form(),binding());e.session.approveNew('Abweichende Person anhand Originaldaten geprüft.');e.rows[0].updated_at='2026-10-15T06:10:00.123457+00:00';
 await assert.rejects(action==='create'?e.session.assertCurrent(form(),binding({clientId:id(80)})):e.session.selectExisting(id(20),form(),binding()),/geändert/);
 assert.equal(e.session.permits(form(),binding()),false);assert.deepEqual(e.session.view().candidates,[]);
});
test('a new exact person after review prevents dispatch and requires a fresh explicit decision',async()=>{
 const e=environment();await e.session.review(form(),binding());e.session.approveNew('');e.rows.push(row(21,{first_name:'Anna',date_of_birth:'1940-02-29'}));
 await assert.rejects(e.session.assertCurrent(form(),binding({clientId:id(80)})),/geändert/);assert.equal(e.session.permits(form(),binding()),false);
});
test('a lookup error on a later capped page exposes no earlier partial candidates',async()=>{
 const e=environment([row(20),row(21),row(22)],{cap:2,result:(call,result)=>call.filters.some(([kind])=>kind==='gt')?{data:null,error:{message:'denied'}}:result});
 assert.equal(await e.session.review(form(),binding()),false);assert.deepEqual(e.session.view().candidates,[]);assert.equal(e.session.approveNew('Reason with enough length'),false);
});
for(const value of [null,{},'[]'])test('malformed native candidate pools never authorize absence',async()=>{
 const e=environment([],{result:()=>({data:value,error:null})});assert.equal(await e.session.review(form(),binding()),false);assert.equal(e.session.approveNew(''),false);
});
for(const patch of [{tenant_id:id(9)},{updated_at:null},{date_of_birth:'1940-02-30'},{status:'unknown-native'},{insurance_number:undefined}])test('foreign or incomplete native originals fail closed before any choice',async()=>{
 const e=environment([],{result:()=>({data:[row(20,patch)],error:null})});assert.equal(await e.session.review(form(),binding()),false);assert.deepEqual(e.session.view().candidates,[]);
});
for(const patch of [{token:'other'},{userId:id(9),authorityResult:name=>({data:name==='resolve_current_profile_id'?id(9):id(1),error:null})},{sessionResult:{data:{session:null},error:null}},{userResult:{data:{user:{id:id(9)}},error:null}}])test('SDK/session/server-user mismatch prevents candidate reads',async()=>{
 const e=environment([row()],patch);assert.equal(await e.session.review(form(),binding()),false);assert.equal(e.calls.filter(call=>call.filters).length,0);
});
test('revoked runtime rights hide the whole original and stop retained choices without another hook render',async()=>{
 const e=environment([row()]);await e.session.review(form(),binding());e.session.approveNew('Die andere Person hat andere Identitätsangaben.');e.env.allowed=false;
 assert.deepEqual(e.session.view().candidates,[]);assert.equal(e.session.approveNew('Reason with enough length'),false);await assert.rejects(e.session.selectExisting(id(20),form(),binding()));assert.equal(e.session.permits(form(),binding()),false);
});
test('late read after input A-B-A cannot revive an older A candidate snapshot',async()=>{
 const gate=deferred(),e=environment([row()],{before:async()=>gate.promise});const pending=e.session.review(form(),binding());
 e.session.syncInput(form({firstName:'B'}));e.session.syncInput(form());gate.resolve();assert.equal(await pending,false);assert.deepEqual(e.session.view().candidates,[]);
});
test('replacing the SDK during candidate reading prevents snapshot publication',async()=>{
 const e=environment([row()],{before:()=>{e.sdk={};}});assert.equal(await e.session.review(form(),binding()),false);assert.deepEqual(e.session.view().candidates,[]);
});
test('changing a native identity between name and insurance queries rejects inconsistent union data',async()=>{
 const e=environment([row(20,{insurance_number:'A123456789'})],{before:call=>{if(call.filters.some(([,key])=>key==='insurance_number'))e.rows[0].first_name='Else';}});
 assert.equal(await e.session.review(form(),binding()),false);assert.deepEqual(e.session.view().candidates,[]);
});
test('literal percent underscore and backslash do not widen the requested family-name pattern',async()=>{
 const e=environment([row(20,{last_name:'Me%_\\yer'})]);assert.equal(await e.session.review(form({lastName:'Me%_\\yer'}),binding()),true);
 assert.equal(e.session.view().candidates.length,1);assert.ok(e.calls.find(call=>call.filters)?.filters.some(([kind,key,value])=>kind==='ilike'&&key==='last_name'&&value==='%Me\\%\\_\\\\yer%'));
});
test('invalid birth dates and missing names reach no SDK or native read',async()=>{
 for(const input of [form({dateOfBirth:'1940-02-30'}),form({firstName:''}),form({lastName:''})]){const e=environment();assert.equal(await e.session.review(input,binding()),false);assert.equal(e.calls.length,0);}
});
test('transport exception text cannot expose internal URLs or credentials in the user-facing review',async()=>{
 const e=environment([],{user:()=>{throw Error('secret-test-token-and-url');}});assert.equal(await e.session.review(form(),binding()),false);assert.doesNotMatch(e.session.view().error,/secret/);
});
test('a refreshed session object never trusts an earlier persisted local creation decision',async()=>{
 const e=environment();await e.session.review(form(),binding());e.session.approveNew('');assert.ok(e.session.decision());
 const fresh=environment();fresh.session.syncInput(form());assert.equal(fresh.session.permits(form(),binding()),false);assert.equal(fresh.session.decision(),null);
});

test('same-role native permission refresh never revives an old candidate snapshot or choice',async()=>{
 const e=environment([row()]);await e.session.review(form(),binding());e.session.approveNew('Identitätsangaben dieser Personen sind unterschiedlich.');
 e.env.permissionEpoch=1;assert.deepEqual(e.session.view().candidates,[]);assert.equal(e.session.permits(form(),binding()),false);
 assert.equal(e.session.approveNew('Identitätsangaben dieser Personen sind unterschiedlich.'),false);
 assert.equal(await e.session.review(form(),binding()),true);assert.equal(e.session.approveNew('Identitätsangaben dieser Personen sind unterschiedlich.'),true);
});
test('replacing the SDK after review hides the original before any subsequent action',async()=>{
 const e=environment([row()]);await e.session.review(form(),binding());e.sdk={};assert.deepEqual(e.session.view().candidates,[]);assert.equal(e.session.approveNew('Reason with enough length'),false);
});

test('first reservation sends the exact reviewed originals and explicit reason to server preparation',async()=>{
 const original=row(20,{date_of_birth:null,insurance_number:null}),e=environment([original]);
 await e.session.review(form(),binding());e.session.approveNew('Geburtsdatum und weitere Originale sind unterschiedlich.');
 await e.session.assertCurrent(form(),binding({clientId:id(80)}));
 const call=e.calls.find(c=>c.rpc);assert.equal(call.args.p_request_id,id(80));assert.deepEqual(call.args.p_candidates,[original]);
 assert.equal(call.args.p_candidates[0].updated_at,time);assert.equal(call.args.p_reason,'Geburtsdatum und weitere Originale sind unterschiedlich.');
 assert.equal(e.session.reservationReview().id,id(500));assert.equal(e.session.reservationReview().candidateCount,1);
});
test('continuing a bound lead and opening an existing record never prepare another first reservation',async()=>{
 const bound=environment([row()]);await bound.session.review(form(),binding({clientId:id(80),allocation:'existing'}));
 bound.session.approveNew('Die andere Person hat abweichende Originaldaten.');
 await bound.session.assertCurrent(form(),binding({clientId:id(80),allocation:'existing'}));assert.equal(bound.calls.filter(c=>c.rpc).length,0);
 const existing=environment([row()]);await existing.session.review(form(),binding());await existing.session.selectExisting(id(20),form(),binding());
 assert.equal(existing.calls.filter(c=>c.rpc).length,0);
});
for(const patch of [
 {review_id:'not-native'},{request_id:id(81)},{tenant_id:id(9)},{actor_profile_id:id(9)},
 {resolution:'open_existing'},{candidate_count:99},{expires_at:'2020-01-01T00:00:00Z'},
 {expires_at:'2099-01-01T00:00:00Z'},{prepared_at:'2099-01-01T00:00:00Z'},
])test('a foreign, expired or malformed server preparation cannot authorize the first write',async()=>{
 const now=Date.now(),e=environment();await e.session.review(form(),binding());e.session.approveNew('');
 e.env.prepareResult={data:{review_id:id(500),request_id:id(80),tenant_id:id(1),actor_profile_id:id(2),resolution:'create_distinct',candidate_count:0,
  prepared_at:new Date(now).toISOString(),expires_at:new Date(now+300000).toISOString(),...patch},error:null};
 await assert.rejects(e.session.assertCurrent(form(),binding({clientId:id(80)})));
 assert.equal(e.session.reservationReview(),null);assert.equal(e.session.permits(form(),binding()),false);
});
for(const kind of ['permission','input','sdk'])test(`a ${kind} change during server preparation invalidates the whole original decision`,{timeout:2000},async()=>{
 const gate=deferred(),started=deferred(),e=environment([],{prepare:()=>{started.resolve();return gate.promise;}});await e.session.review(form(),binding());e.session.approveNew('');
 const pending=e.session.assertCurrent(form(),binding({clientId:id(80)}));await started.promise;
 assert.ok(e.calls.some(c=>c.rpc));if(kind==='permission')e.env.permissionEpoch=1;
 if(kind==='input'){e.session.syncInput(form({firstName:'B'}));e.session.syncInput(form());}if(kind==='sdk')e.sdk={};
 gate.resolve();await assert.rejects(pending);assert.equal(e.session.reservationReview(),null);assert.deepEqual(e.session.view().candidates,[]);
});
test('a thrown preparation never exposes transport secrets or revives the approved choice',async()=>{
 const e=environment([],{prepare:()=>{throw Error('private-test-token-url');}});await e.session.review(form(),binding());e.session.approveNew('');
 await assert.rejects(e.session.assertCurrent(form(),binding({clientId:id(80)})),error=>!error.message.includes('private-test'));
 assert.equal(e.session.reservationReview(),null);assert.equal(e.session.decision(),null);
});

for(const status of ['interessent','aktiv','pausiert','archiviert','verstorben'])test(`Native German status ${status} remains an exact candidate under distinct Auth/profile IDs`,async()=>{const e=environment([row(20,{status})],{userId:id(500)});assert.equal(await e.session.review(form(),binding()),true);assert.equal(e.session.view().candidates[0].status,status);assert.equal(e.session.view().candidates[0].id,id(20));assert.ok(e.calls.some(c=>c.authority==='resolve_current_profile_id'));assert.ok(e.calls.some(c=>c.authority==='current_tenant_id'));assert.equal(e.calls.filter(c=>c.rpc).length,0);});
test('Distinct raw Auth account reserves identity review with the exact internal actor',async()=>{const e=environment([],{userId:id(500)});assert.equal(await e.session.review(form(),binding()),true);assert.equal(e.session.approveNew(''),true);await e.session.assertCurrent(form(),binding({clientId:id(80)}));const call=e.calls.find(c=>c.rpc);assert.equal(call.args.p_actor_profile_id,id(2));assert.equal(call.args.p_tenant_id,id(1));assert.equal(e.session.reservationReview().actorId,id(2));assert.equal(e.env.userId,id(500));});
for(const attack of ['profile','tenant','resolverError','anonymous','missingExpiry','expired','fractionalExpiry'])test(`Identity candidate read rejects ${attack} before native SELECT or preparation`,async()=>{const e=environment([row()],{userId:id(500)});if(attack==='profile')e.env.authorityResult=name=>({data:name==='resolve_current_profile_id'?id(999):id(1),error:null});if(attack==='tenant')e.env.authorityResult=name=>({data:name==='resolve_current_profile_id'?id(2):id(999),error:null});if(attack==='resolverError')e.env.authorityResult=()=>({data:null,error:{code:'42501'}});if(attack==='anonymous')e.env.userResult={data:{user:{id:id(500),is_anonymous:true}},error:null};if(attack==='missingExpiry')e.env.sessionResult={data:{session:{user:{id:id(500)},access_token:'test-token'}},error:null};if(attack==='expired')e.env.expiresAt=Date.now()-1000;if(attack==='fractionalExpiry')e.env.expiresAt+=0.5;assert.equal(await e.session.review(form(),binding()),false);assert.equal(e.calls.filter(c=>c.filters).length,0);assert.equal(e.calls.filter(c=>c.rpc).length,0);assert.deepEqual(e.session.view().candidates,[]);});
test('Raw SDK account switch during candidate pages publishes no identity decision',async()=>{const e=environment([row(20),row(21)],{userId:id(500),cap:1,before:()=>{e.env.userId=id(999);}});assert.equal(await e.session.review(form(),binding()),false);assert.equal(e.calls.filter(c=>c.rpc).length,0);assert.deepEqual(e.session.view().candidates,[]);e.env.userId=id(500);assert.equal(e.session.permits(form(),binding()),false);});
