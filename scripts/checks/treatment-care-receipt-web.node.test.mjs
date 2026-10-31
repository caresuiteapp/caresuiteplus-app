import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
import * as treatment from '../../src/lib/pflege/treatmentCarePacket.web.ts';
import {cloneClientNativeOriginal} from '../../src/lib/clients/clientRecordNativeOriginal.web.ts';
import {requireCareWorkspaceAuthorityWeb} from '../../src/lib/pflege/careWorkspaceAuthority.web.ts';

const fixture=JSON.parse(readFileSync(new URL('./fixtures/treatment-staging-synthetic-20261022.json',import.meta.url),'utf8'));
const reviewSource=readFileSync(new URL('../../src/lib/pflege/treatmentCareReview.web.ts',import.meta.url),'utf8').replace("from './treatmentCarePacket.web'",`from '${new URL('../../src/lib/pflege/treatmentCarePacket.web.ts',import.meta.url).href}'`);
const review=await import('data:text/javascript;base64,'+Buffer.from(stripTypeScriptTypes(reviewSource,{mode:'strip'})).toString('base64'));
const otherId='12345678-1234-4234-8234-123456789012';
const specs=[
 {kind:'packet',file:'treatmentCareRepository.supabase.web.ts',commit:'commitTreatmentCarePacket',confirm:'confirmTreatmentCarePacket',rpc:'treatment_care_packet',original:treatment.treatmentCareOriginalIssue},
 {kind:'review',file:'treatmentCareReviewRepository.supabase.web.ts',commit:'commitTreatmentCareReview',confirm:'confirmTreatmentCareReview',rpc:'treatment_care_review',original:review.treatmentCareReviewOriginalIssue},
];

async function run(spec,method,receiptName,mutate=()=>{},descriptor=null){
 const receipt=structuredClone(fixture[receiptName]),packet=structuredClone(receipt.packet);
 mutate(receipt);
 assert.equal(spec.original(receipt.original,packet),null,'transport negative remains a valid generic original');
 const state={current:true,getterCalls:0},calls=[];
 const userId='12345678-1234-4234-8234-123456789013';
 const db={auth:{getSession:async()=>({data:{session:{user:{id:userId},access_token:'synthetic-test-token',expires_at:4102444800}},error:null}),getUser:async()=>({data:{user:{id:userId}},error:null})},rpc:async(name,args)=>{
  if(name==='resolve_current_profile_id')return {data:packet.actorId,error:null};
  if(name==='current_tenant_id')return {data:packet.tenantId,error:null};
  assert.equal(name,`web_${method==='commit'?'commit':'confirm'}_${spec.rpc}`);
  assert.deepEqual(args.p_packet,packet);calls.push({name,args:structuredClone(args)});
  const response={data:receipt,error:null,status:200};
  if(descriptor){const value=response[descriptor];Object.defineProperty(response,descriptor,{enumerable:true,get(){state.getterCalls++;state.current=false;return value;}});}
  return response;
 }};
 const source=readFileSync(new URL('../../src/lib/pflege/'+spec.file,import.meta.url),'utf8').replace(/^import .*;\n/gm,'').replace(/^export /gm,'');
 const deps={...treatment,...review,cloneClientNativeOriginal,requireCareWorkspaceAuthorityWeb,getSupabaseClient:()=>db,toGermanSupabaseError:()=> 'Synthetic rejection',withServiceQueryTimeout:request=>Promise.resolve(request)};
 const methodFn=new Function(...Object.keys(deps),stripTypeScriptTypes(source,{mode:'strip'})+`\nreturn ${spec[method]};`)(...Object.values(deps));
 return {result:await methodFn(packet,()=>state.current),calls,state,receipt};
}

for(const method of ['commit','confirm']){
 for(const receiptName of ['receipt','revisedReceipt','payerReceipt'])test(`${method}: production Treatment adapter accepts actual SQL ${receiptName} with independent event UUID`,async()=>{
  const {result,calls,receipt}=await run(specs[0],method,receiptName);
  assert.deepEqual(result,{ok:true,data:receipt.original});assert.equal(calls.length,1);
  assert.notEqual(receipt.original.headId,receipt.requestId,'native event ID is not fabricated from the request ID');
 });
 test(`${method}: production review adapter accepts actual retained SQL request`,async()=>{
  const {result,calls,receipt}=await run(specs[1],method,'reviewReceipt');
  assert.deepEqual(result,{ok:true,data:receipt.original});assert.equal(calls.length,1);
 });
}

const packetChanges=[
 ['different actual actor',r=>{r.original.recordedBy=otherId;r.original.history.at(-1).recordedBy=otherId;}],
 ['different saved reason',r=>{r.original.history.at(-1).reason+=' Changed persisted reason.';}],
 ['different saved clinical entry',r=>{r.original.payload.title+=' Changed entry.';r.original.history.at(-1).payload.title+=' Changed entry.';}],
 ['different prior immutable history',r=>{r.original.history[0].recordedByName='Changed original person';}],
 ['another root/previous head',r=>{r.original.rootId=otherId;r.original.history[0].id=otherId;r.original.history.at(-1).previousId=otherId;}],
 ['voided original',r=>{r.original.voided=true;}],
 ['later current original instead of own retained result',r=>{const old=r.original.history.at(-1),next={...structuredClone(old),id:otherId,previousId:old.id,revision:old.revision+1};r.original.history.push(next);Object.assign(r.original,{id:otherId,headId:otherId,revision:next.revision});}],
 ['another receipt request',r=>{r.requestId=otherId;}],
];
for(const method of ['commit','confirm'])for(const [name,mutate] of packetChanges)test(`${method}: generic valid Treatment original with ${name} cannot confirm own request`,async()=>{
 const {result,calls}=await run(specs[0],method,'revisedReceipt',mutate);
 assert.equal(result.ok,false);assert.equal('data' in result,false);assert.equal(calls.length,1);
 if(method==='commit')assert.equal(result.uncertain,true);
});

const reviewChanges=[
 ['different review actor',r=>{r.original.history[0].actorId=otherId;}],
 ['different review reason',r=>{r.original.history[0].reason+=' Another retained reason.';}],
 ['different review request',r=>{r.original.history[0].requestId=otherId;}],
 ['another treatment head',r=>{r.original.treatmentHeadId=otherId;r.original.history[0].treatmentHeadId=otherId;}],
 ['another treatment fingerprint',r=>{r.original.treatmentFingerprint='sha256:'+'0'.repeat(64);r.original.history[0].treatmentFingerprint=r.original.treatmentFingerprint;}],
 ['another treatment root',r=>{r.original.treatmentRootId=otherId;}],
 ['another receipt request',r=>{r.requestId=otherId;}],
];
for(const method of ['commit','confirm'])for(const [name,mutate] of reviewChanges)test(`${method}: generic valid review with ${name} cannot confirm own request`,async()=>{
 const {result,calls}=await run(specs[1],method,'reviewReceipt',mutate);
 assert.equal(result.ok,false);assert.equal('data' in result,false);assert.equal(calls.length,1);
 if(method==='commit')assert.equal(result.uncertain,true);
});

for(const spec of specs)for(const method of ['commit','confirm'])for(const field of ['data','error','status'])test(`${spec.kind} ${method}: whole ${field} descriptor rejects before callback can lose current scope`,async()=>{
 const {result,calls,state}=await run(spec,method,spec.kind==='packet'?'revisedReceipt':'reviewReceipt',()=>{},field);
 assert.equal(result.ok,false);assert.equal('data' in result,false);assert.equal(calls.length,1);assert.equal(state.getterCalls,0);
 if(method==='commit')assert.equal(result.uncertain,true);
});
