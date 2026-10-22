import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
import {requireCareWorkspaceAuthorityWeb} from '../../src/lib/pflege/careWorkspaceAuthority.web.ts';
import {cloneClientNativeOriginal,sameClientNativeOriginal} from '../../src/lib/clients/clientRecordNativeOriginal.web.ts';

const moduleUrl=source=>'data:text/javascript;base64,'+Buffer.from(stripTypeScriptTypes(source,{mode:'strip'})).toString('base64');
const vitalPacketUrl=new URL('../../src/lib/pflege/vitalCarePathPacket.web.ts',import.meta.url).href;
const vitalReviewUrl=moduleUrl(readFileSync(new URL('../../src/lib/pflege/vitalCareReview.web.ts',import.meta.url),'utf8').replace("from './vitalCarePathPacket.web'",`from '${vitalPacketUrl}'`));
const vitalReadSource=readFileSync(new URL('../../src/lib/pflege/vitalWorkspaceReadProof.web.ts',import.meta.url),'utf8')
 .replace("from '../clients/clientRecordNativeOriginal.web.ts'",`from '${new URL('../../src/lib/clients/clientRecordNativeOriginal.web.ts',import.meta.url).href}'`)
 .replace("from './vitalCareReview.web'",`from '${vitalReviewUrl}'`);
const {readCompleteVitalHistoryWeb,readVitalSourcesWithProofWeb}=await import(moduleUrl(vitalReadSource));

const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const tenant=id(1),profile=id(2),authUser=id(3),client=id(4),record=id(5);
const direct=request=>Promise.resolve(request);
function harness(hook=()=>{}){
 const state={current:true,serverProfile:profile,serverTenant:tenant,userId:authUser,verifiedUser:authUser,token:'verified-original-token',expiresAt:4102444800,sessionError:null,userError:null,profileError:null,tenantError:null,sessions:0};
 const calls=[];
 const session=()=>({user:{id:state.userId},access_token:state.token,expires_at:state.expiresAt});
 const db={auth:{
  async getSession(){const stage=++state.sessions===1?'session-before':'session-after';calls.push(stage);await hook(stage,state);return {data:{session:state.sessionMissing?null:session()},error:state.sessionError};},
  async getUser(token){calls.push(['user',token]);await hook('user',state);return {data:{user:state.verifiedUser===null?null:{id:state.verifiedUser}},error:state.userError};},
 },async rpc(name,args){calls.push([name,structuredClone(args)]);await hook(name,state);if(name==='resolve_current_profile_id')return {data:state.serverProfile,error:state.profileError};if(name==='current_tenant_id')return {data:state.serverTenant,error:state.tenantError};return {data:name==='web_read_care_documentation_page'?{rows:[],nextCursorOccurredAt:null,nextCursorId:null,stateFingerprint:'sha256:'+'e'.repeat(64)}:['web_read_treatment_care_page','web_read_wound_path_page','web_read_vital_care_path_page'].includes(name)?{rows:[],nextCursorRecordedAt:null,nextCursorId:null,stateFingerprint:'sha256:'+'e'.repeat(64)}:{rows:[]},error:null};}};
 state.sdk=db;
 const context={tenantId:tenant,actorId:profile,clientId:client,medicationId:record,woundId:record,measurementId:record,isCurrent:()=>state.current};
 return {state,db,context,calls,getSdk:()=>state.sdk,run:()=>requireCareWorkspaceAuthorityWeb(context,()=>state.sdk,direct,'Current own workspace was not confirmed')};
}

test('different authenticated-user and exact current profile IDs are accepted without rewriting the actor',async()=>{
 const h=harness();assert.notEqual(profile,authUser);assert.equal(await h.run(),h.db);assert.equal(h.context.actorId,profile);
 assert.deepEqual(h.calls,['session-before',['user','verified-original-token'],['resolve_current_profile_id',{}],['current_tenant_id',{}],'session-after']);
});
test('matching legacy user/profile identity still needs exact server profile and tenant confirmation',async()=>{const h=harness();h.state.userId=profile;h.state.verifiedUser=profile;assert.equal(await h.run(),h.db);assert(h.calls.some(c=>Array.isArray(c)&&c[0]==='resolve_current_profile_id'));});
test('another active profile on the same authenticated account is rejected',async()=>{const h=harness();h.state.serverProfile=id(20);await assert.rejects(h.run());assert.equal(h.calls.some(c=>Array.isArray(c)&&c[0]==='current_tenant_id'),false);});
test('the auth-user UUID is never accepted as a substitute for its resolved profile',async()=>{const h=harness();h.context.actorId=authUser;await assert.rejects(h.run());});
test('the requested tenant must equal the server current tenant',async()=>{const h=harness();h.state.serverTenant=id(21);await assert.rejects(h.run());});
test('the Auth server must verify the same account as the captured session',async()=>{const h=harness();h.state.verifiedUser=id(22);await assert.rejects(h.run());assert.equal(h.calls.some(c=>Array.isArray(c)&&c[0]==='resolve_current_profile_id'),false);});
for(const [field,value] of [['sessionMissing',true],['token',''],['userId','invalid'],['expiresAt',undefined],['expiresAt',NaN],['expiresAt',Infinity],['expiresAt',0],['sessionError',{message:'session failed'}],['userError',{message:'auth failed'}],['profileError',{message:'profile denied'}],['tenantError',{message:'tenant denied'}],['verifiedUser',null],['serverProfile',null],['serverTenant',null]]){
 test(`missing/invalid authority is rejected: ${field}=${String(value)}`,async()=>{const h=harness();h.state[field]=value;await assert.rejects(h.run());});
}
for(const stage of ['session-before','user','resolve_current_profile_id','current_tenant_id','session-after']){
 test(`current caller revoked while awaiting ${stage} is rejected`,async()=>{const h=harness((at,state)=>{if(at===stage)state.current=false;});await assert.rejects(h.run());});
 test(`SDK replaced while awaiting ${stage} is rejected`,async()=>{const h=harness((at,state)=>{if(at===stage)state.sdk={...state.sdk};});await assert.rejects(h.run());});
}
for(const [name,change] of [
 ['token',state=>{state.token='replacement-token';}],
 ['account',state=>{state.userId=id(23);}],
 ['expiry',state=>{state.expiresAt=1;}],
 ['expiry metadata',state=>{state.expiresAt=4102444801;}],
 ['missing session',state=>{state.sessionMissing=true;}],
])test(`session ${name} changed during profile/tenant checks is rejected`,async()=>{const h=harness((stage,state)=>{if(stage==='current_tenant_id')change(state);});await assert.rejects(h.run());});
for(const key of ['tenantId','actorId'])test(`in-place ${key} replacement during auth is rejected`,async()=>{let h;h=harness(stage=>{if(stage==='user')h.context[key]=id(24);});await assert.rejects(h.run());});

const repositories=[
 ['woundPath','readWoundPathPage','web_read_wound_path_page'],
 ['vitalCarePath','readVitalCarePage','web_read_vital_care_path_page'],
 ['respiratoryIntensiveCare','readRespiratoryCarePage','web_read_respiratory_intensive_care_path_page'],
 ['treatmentCare','readTreatmentCarePage','web_read_treatment_care_page'],
 ['medicationSafety','readMedicationSafetyPage','web_read_medication_safety_page'],
 ['careDocumentation','readCareDocumentation','web_read_care_documentation_page'],
 ['basicCare','readBasicCarePage','web_read_basic_care_page'],
];
function actualRead(name,method,h){
 const raw=readFileSync(new URL(`../../src/lib/pflege/${name}Repository.supabase.web.ts`,import.meta.url),'utf8');
 const code=stripTypeScriptTypes(raw.replace(/^import .*;\n/gm,'').replace(/^export /gm,''));
 return new Function('getSupabaseClient','withServiceQueryTimeout','requireCareWorkspaceAuthorityWeb','cloneClientNativeOriginal','sameClientNativeOriginal','readCompleteVitalHistoryWeb','readVitalSourcesWithProofWeb',`${code}\nreturn ${method};`)(h.getSdk,request=>Promise.resolve(request),requireCareWorkspaceAuthorityWeb,cloneClientNativeOriginal,sameClientNativeOriginal,readCompleteVitalHistoryWeb,readVitalSourcesWithProofWeb);
}
for(const [name,method,rpc] of repositories){
 test(`${name}: actual repository reads its profile-bound history when auth/user IDs differ`,async()=>{const h=harness(),read=actualRead(name,method,h);assert.deepEqual(await read(h.context),{ok:true,data:[]});const page=h.calls.find(c=>Array.isArray(c)&&c[0]===rpc);assert.equal(page?.[1].p_actor_profile_id,profile);assert.equal(page?.[1].p_tenant_id,tenant);assert.equal(page?.[1].p_client_id,client);});
 test(`${name}: another account profile is rejected before any clinical RPC`,async()=>{const h=harness();h.state.serverProfile=id(30);const read=actualRead(name,method,h);assert.equal((await read(h.context)).ok,false);assert.equal(h.calls.some(c=>Array.isArray(c)&&c[0].startsWith('web_')),false);});
 test(`${name}: token switch during authority prevents the clinical RPC`,async()=>{const h=harness((stage,state)=>{if(stage==='current_tenant_id')state.token='other-token';}),read=actualRead(name,method,h);assert.equal((await read(h.context)).ok,false);assert.equal(h.calls.some(c=>Array.isArray(c)&&c[0].startsWith('web_')),false);});
}
