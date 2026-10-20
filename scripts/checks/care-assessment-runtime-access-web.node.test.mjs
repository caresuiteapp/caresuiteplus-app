import test from 'node:test';
import assert from 'node:assert/strict';
import {careAssessmentRuntimeAccess,assertCareAssessmentRuntimeReadAccess} from '../../src/lib/careAssessment/careAssessmentRuntimeAccess.web.ts';
import {getPermissionsForRole} from '../../src/lib/permissions/staticRolePermissions.ts';
import {captureCareAssessmentDraftBaseline,confirmCareAssessmentDraftWrite,adoptCareAssessmentDraftRead} from '../../src/lib/careAssessment/careAssessmentDraftReadState.web.ts';

const id=n=>`00000000-0000-0000-0000-${String(n).padStart(12,'0')}`;
const input=()=>({tenantId:id(1),profileId:id(2),profileRole:'business_admin',runtimeTenantId:id(1),runtimeRole:'business_admin',canView:true,canManage:true});
const denied={canRead:false,canManage:false};
const context=()=>({tenantId:id(1),profileId:id(2),roleKey:'business_admin',assessmentId:id(3),subjectType:'client',subjectId:id(4)});
// Already decoded own-context read: the access model does not decode clinical contents.
const decodedRead=()=>({id:id(3),tenantId:id(1),subjectType:'client',subjectId:id(4),status:'draft',draftRevision:12,personStatement:'Gesicherter Originalton',topics:[],risks:[],measures:[],evaluations:[],events:[],links:[],versionHistory:[]});

test('actual business_admin static defaults do not override supplied runtime revocation',()=>{
 const defaults=getPermissionsForRole('business_admin');
 assert.ok(defaults.includes('pflege.plans.view'));
 assert.ok(defaults.includes('pflege.assessments.manage'));
 assert.deepEqual(careAssessmentRuntimeAccess({...input(),canView:false,canManage:false}),denied);
});
test('matching native profile and runtime context grants only the supplied rights',()=>{
 assert.deepEqual(careAssessmentRuntimeAccess(input()),{canRead:true,canManage:true});
 assert.deepEqual(careAssessmentRuntimeAccess({...input(),canManage:false}),{canRead:true,canManage:false});
 assert.deepEqual(careAssessmentRuntimeAccess({...input(),canView:false}),denied);
});
test('runtime roles are exact identities and legitimate custom roles need no invented allowlist',()=>{
 assert.deepEqual(careAssessmentRuntimeAccess({...input(),profileRole:'custom_native_role',runtimeRole:'custom_native_role'}),{canRead:true,canManage:true});
 assert.deepEqual(careAssessmentRuntimeAccess({...input(),runtimeRole:'Business_admin'}),denied);
 assert.deepEqual(careAssessmentRuntimeAccess({...input(),runtimeRole:'business_admin '}),denied);
});
for(const field of ['tenantId','profileId','runtimeTenantId']){
 for(const value of [null,undefined,'','not-a-native-id'])test(`missing or malformed native ${field} (${String(value)}) denies runtime rights`,()=>{
  assert.deepEqual(careAssessmentRuntimeAccess({...input(),[field]:value}),denied);
 });
}
for(const field of ['profileRole','runtimeRole']){
 for(const value of [null,undefined,'','   '])test(`missing native ${field} (${String(value)}) denies runtime rights`,()=>{
  assert.deepEqual(careAssessmentRuntimeAccess({...input(),[field]:value}),denied);
 });
}
test('valid foreign runtime tenant and changed actual profile role both deny',()=>{
 assert.deepEqual(careAssessmentRuntimeAccess({...input(),runtimeTenantId:id(99)}),denied);
 assert.deepEqual(careAssessmentRuntimeAccess({...input(),profileRole:'pflegefachperson'}),denied);
});
test('truthy nonboolean supplied flags never grant rights',()=>{
 for(const value of [1,'true',{},[]]){
  assert.deepEqual(careAssessmentRuntimeAccess({...input(),canView:value}),denied);
  assert.deepEqual(careAssessmentRuntimeAccess({...input(),canManage:value}),{canRead:true,canManage:false});
 }
});
test('missing runtime input fails closed and the evaluator preserves the caller input',()=>{
 assert.deepEqual(careAssessmentRuntimeAccess(null),denied);
 assert.deepEqual(careAssessmentRuntimeAccess(undefined),denied);
 const original=input(),before=structuredClone(original);Object.freeze(original);
 const first=careAssessmentRuntimeAccess(original);first.canRead=false;
 assert.deepEqual(original,before);
 assert.equal(careAssessmentRuntimeAccess(original).canRead,true);
});
test('latest read guard requires exactly true and permits independent read-only access',()=>{
 assert.doesNotThrow(()=>assertCareAssessmentRuntimeReadAccess(careAssessmentRuntimeAccess({...input(),canManage:false})));
 for(const value of [denied,null,undefined,{canRead:1,canManage:true},{canRead:'true',canManage:true}])assert.throws(()=>assertCareAssessmentRuntimeReadAccess(value),/Leserecht/);
});

for(const change of [
 ['revoked view',current=>({...current,canView:false})],
 ['native profile disappears',current=>({...current,profileId:null})],
 ['runtime tenant changes',current=>({...current,runtimeTenantId:id(99)})],
 ['actual role differs from runtime',current=>({...current,profileRole:'pflegefachperson'})],
])test(`${change[0]} during an own confirmed reload prevents adopting its result and preserves the original draft`,async()=>{
 let latest=input(),resolveRead;
 const original=decodedRead(),baseline=captureCareAssessmentDraftBaseline(original,context()),value=structuredClone(original);
 value.personStatement='Offene eigene Änderung';
 const before=structuredClone({baseline,value});
 const read=new Promise(resolve=>{resolveRead=resolve;});
 let next=null;
 const reload=(async()=>{
  assertCareAssessmentRuntimeReadAccess(careAssessmentRuntimeAccess(latest));
  const confirmed=await read;
  assertCareAssessmentRuntimeReadAccess(careAssessmentRuntimeAccess(latest));
  next=confirmCareAssessmentDraftWrite(confirmed,baseline.context,context());
 })();
 latest=change[1](latest);
 resolveRead({...decodedRead(),draftRevision:13,personStatement:'Bestätigt gespeicherte Änderung'});
 await assert.rejects(reload,/Leserecht/);
 assert.equal(next,null);
 assert.deepEqual({baseline,value},before);
});
test('read-only runtime access can explicitly adopt a clean fresh read while management remains denied',async()=>{
 let latest={...input(),canManage:false};
 const initial=decodedRead(),baseline=captureCareAssessmentDraftBaseline(initial,context()),value=structuredClone(initial);
 assertCareAssessmentRuntimeReadAccess(careAssessmentRuntimeAccess(latest));
 const incoming=await Promise.resolve({...decodedRead(),draftRevision:13,personStatement:'Neu geladener Originalton'});
 assertCareAssessmentRuntimeReadAccess(careAssessmentRuntimeAccess(latest));
 const adopted=adoptCareAssessmentDraftRead(baseline,value,incoming,context());
 assert.equal(adopted.baseline.assessment.draftRevision,13);
 assert.deepEqual(careAssessmentRuntimeAccess(latest),{canRead:true,canManage:false});
 assert.equal(baseline.assessment.draftRevision,12);
});
