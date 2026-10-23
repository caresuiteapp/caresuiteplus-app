import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {stripTypeScriptTypes} from 'node:module';
import {registerNutritionCaptureSmallPostgresEvidenceTests} from './validate-nutrition-capture-small-postgres-evidence.mjs';
import {nutritionReviewPacketIssue,nutritionReviewReceiptIssue,nutritionReviewOriginalIssue,nutritionWorkspaceHistoryIssue} from '../../src/lib/pflege/nutritionEliminationPacket.web.ts';

const fixture=new URL('./fixtures/nutrition-linked-inspection-staging-synthetic-20261023.json',import.meta.url);
const bytes=readFileSync(fixture),e=JSON.parse(bytes.toString('utf8'));
const provenance=JSON.parse(readFileSync(new URL('./fixtures/nutrition-linked-inspection-staging-synthetic-20261023.provenance.json',import.meta.url),'utf8'));
const hash=value=>createHash('sha256').update(value).digest('hex');
const root=new URL('../../',import.meta.url),scope={tenantId:e.expected.tenantId,clientId:e.expected.clientId};
registerNutritionCaptureSmallPostgresEvidenceTests(fixture);

test('Actual open-planning inspection preserves the complete care original and exact own historical receipt',()=>{
 assert.equal(e.linkedPlannedInspection,true);assert.equal(e.cleanupConfirmed,true);
 assert.equal(e.canonicalAliasDenials,3);assert.equal(e.clinicalDecisionDenials,2);
 assert.equal(nutritionReviewPacketIssue(e.reviewPacket),null);
 for(const r of [e.reviewReceipt,e.reviewConfirmed])assert.equal(nutritionReviewReceiptIssue(r,e.reviewPacket),null);
 assert.deepEqual(e.reviewConfirmed,e.reviewReceipt);assert.deepEqual(e.reviewPacket.careOriginal,e.careReceipt.original);
 assert.equal(nutritionReviewOriginalIssue(e.reviewReceipt.original,scope),null);
 assert.equal(nutritionWorkspaceHistoryIssue({careOriginals:[e.careReceipt.original],reviewOriginals:[e.reviewReceipt.original]},scope),null);
 assert.equal(e.reviewReceipt.original.status,'requested');assert.equal(e.reviewReceipt.original.history[0].qualification,null);
 assert.equal(e.reviewReceipt.original.history[0].actorId,e.expected.actorId);
 assert.notEqual(e.expected.actorId,e.expected.reviewerId);
 assert.equal(e.careReceipt.original.payload.execution.outcome,'planned');assert.equal(e.careReceipt.original.payload.occurredAt,null);
});

test('Actual complete SQL pages share one state proof through both empty terminators',()=>{
 assert.deepEqual(e.carePage.rows,[e.careReceipt.original]);assert.deepEqual(e.reviewPage.rows,[e.reviewReceipt.original]);
 for(const page of [e.carePage,e.careTail,e.reviewPage,e.reviewTail]){
  assert.equal(page.stateFingerprint,e.prerequisites.stateFingerprint);
  assert.match(page.stateFingerprint,/^sha256:[a-f0-9]{64}$/);
 }
 for(const page of [e.careTail,e.reviewTail]){assert.deepEqual(page.rows,[]);assert.equal(page.nextCursorId,null);assert.equal(page.nextCursorRecordedAt,null);}
 assert.equal(e.carePage.nextCursorId,e.careReceipt.original.rootId);assert.equal(e.carePage.nextCursorRecordedAt,e.careReceipt.original.history[0].recordedAt);
 assert.equal(e.reviewPage.nextCursorId,e.reviewReceipt.original.rootId);assert.equal(e.reviewPage.nextCursorRecordedAt,e.reviewReceipt.original.history[0].recordedAt);
});

test('Actual requested review cannot confirm another request, author, care version or authored reason',()=>{
 const other='00000000-0000-4000-8000-999999999999';
 for(const change of [r=>r.requestId=other,r=>r.original.careHeadId=other,r=>r.original.history[0].actorId=e.expected.reviewerId,r=>r.original.history[0].reason='Synthetic substituted reason']){
  const r=structuredClone(e.reviewReceipt);change(r);assert.ok(nutritionReviewReceiptIssue(r,e.reviewPacket));
 }
});

test('Retained linked-chain bytes bind the executed fixture and all three applied migration sources',()=>{
 assert.equal(provenance.evidenceBytes,bytes.length);assert.equal(provenance.evidenceSha256,hash(bytes));
 const sql=readFileSync(new URL(provenance.sqlFixture,root));assert.equal(sql.length,provenance.sqlFixtureBytes);assert.equal(hash(sql),provenance.sqlFixtureSha256);
 assert.equal(provenance.sqlRollbackAndCleanupVerified,true);
 assert.deepEqual(provenance.appliedMigrationVersions,['20261022115155','20261023164242','20261023164421']);
 for(const [name,expected] of Object.entries(provenance.appliedPatchSha256))assert.equal(hash(readFileSync(new URL('supabase/patches/'+name,root))),expected);
 for(const [name,expected] of Object.entries(provenance.appliedMigrationSha256))assert.equal(hash(readFileSync(new URL('supabase/migrations/'+name,root))),expected);
 assert.equal(provenance.captureRecordedAt,e.captureReceipt.binding.capturedAt);
 assert.equal(provenance.careRecordedAt,e.careReceipt.original.recordedAt);
 assert.equal(provenance.reviewRecordedAt,e.reviewReceipt.original.history[0].recordedAt);
});

test('Actual linked evidence contains no credentials, raw Auth claims, sessions or private account proofs',()=>{
 const walk=value=>{if(value&&typeof value==='object')for(const [key,child] of Object.entries(value)){assert.doesNotMatch(key,/access.?token|refresh.?token|password|secret|jwt|session.?id|raw_user_meta|raw_app_meta|authorization|bearer|auth_user_id/i);walk(child);}else if(typeof value==='string')assert.doesNotMatch(value,/eyJ[A-Za-z0-9_-]{12,}\.eyJ[A-Za-z0-9_-]{12,}\.|-----BEGIN .*PRIVATE KEY-----/);};walk(e);
});

let serial=0;
async function actualRepository(change=(page)=>page,onCall=()=>{}){
 const key='__nutritionLinkedActual'+serial++,calls=[],state={current:true};
 const envelope=data=>({data:structuredClone(data),error:null,status:200});
 const sdk={auth:{getSession:async()=>envelope({session:{user:{id:e.expected.actorId},access_token:'synthetic-local-contract-token',expires_at:4102444800}}),getUser:async()=>envelope({user:{id:e.expected.actorId}})},rpc:async(name,args)=>{
  if(name==='resolve_current_profile_id')return envelope(e.expected.actorId);
  if(name==='current_tenant_id')return envelope(e.expected.tenantId);
  calls.push({name,args:structuredClone(args)});
  let data;
  if(name==='web_read_nutrition_elimination_prerequisites')data=e.prerequisites;
  else if(name==='web_read_nutrition_elimination_page')data=args.p_cursor_id===null?e.carePage:e.careTail;
  else if(name==='web_read_nutrition_review_page')data=args.p_cursor_id===null?e.reviewPage:e.reviewTail;
  else if(name==='web_commit_nutrition_review'||name==='web_confirm_nutrition_review')data=e.reviewReceipt;
  else throw Error('Unexpected business RPC '+name);
  const response=envelope(change(structuredClone(data),name,args,calls.length));onCall(state,calls.length);return response;
 }};
 globalThis[key]=()=>sdk;
 const path=new URL('src/lib/pflege/nutritionEliminationRepository.supabase.web.ts',root);
 const source=readFileSync(path,'utf8')
  .replace("import {getSupabaseClient} from '@/lib/supabase/client';",`const getSupabaseClient=()=>globalThis['${key}']();`)
  .replace("import {toGermanSupabaseError} from '@/lib/supabase/errors';","const toGermanSupabaseError=()=> 'Synthetic SQL error';")
  .replace("import {withServiceQueryTimeout} from '@/lib/services/queryTimeout';","const withServiceQueryTimeout=async p=>await p;")
  .replace(/from '(\.\.?\/[^']+)'/g,(_m,p)=>`from '${new URL(p,path).href.replace(/nutritionEliminationPacket\.web$/,'nutritionEliminationPacket.web.ts')}'`);
 try{const repo=await import('data:text/javascript;base64,'+Buffer.from(stripTypeScriptTypes(source,{mode:'strip'})).toString('base64'));return{repo,calls,state,context:{...scope,actorId:e.expected.actorId,isCurrent:()=>state.current},cleanup:()=>delete globalThis[key]};}catch(error){delete globalThis[key];throw error;}
}

test('Production joined repository publishes the complete actual SQL chain through repeated native reads',async()=>{
 const h=await actualRepository();try{const r=await h.repo.readNutritionEliminationWorkspace(h.context);assert.equal(r.ok,true,JSON.stringify(r));assert.deepEqual(r.data.careOriginals,e.carePage.rows);assert.deepEqual(r.data.reviewOriginals,e.reviewPage.rows);assert.equal(r.data.stateFingerprint,e.prerequisites.stateFingerprint);assert.equal(h.calls.length,10);}finally{h.cleanup();}
});
for(const name of ['web_read_nutrition_elimination_page','web_read_nutrition_review_page'])test('Production joined repository rejects changed empty-page state for '+name,async()=>{
 const h=await actualRepository((p,n,args)=>{if(n===name&&args.p_cursor_id!==null)p.stateFingerprint='sha256:'+'0'.repeat(64);return p;});try{const r=await h.repo.readNutritionEliminationWorkspace(h.context);assert.equal(r.ok,false);assert.equal(Object.hasOwn(r,'data'),false);}finally{h.cleanup();}
});
test('Production joined repository never publishes actual private results after owner loss',async()=>{
 const h=await actualRepository(p=>p,state=>{state.current=false;});try{const r=await h.repo.readNutritionEliminationWorkspace(h.context);assert.equal(r.ok,false);assert.equal(h.calls.length,1);assert.equal(Object.hasOwn(r,'data'),false);}finally{h.cleanup();}
});
test('Production review repository separately confirms the exact actual stored review receipt',async()=>{
 const h=await actualRepository();try{const r=await h.repo.confirmNutritionReview(e.reviewPacket,()=>h.state.current);assert.equal(r.ok,true);assert.deepEqual(r.data,e.reviewReceipt.original);assert.equal(h.calls[0].name,'web_confirm_nutrition_review');assert.deepEqual(h.calls[0].args.p_packet,e.reviewPacket);}finally{h.cleanup();}
});
test('Production review repository leaves a substituted own-write response uncertain',async()=>{
 const h=await actualRepository((r,name)=>{if(name==='web_commit_nutrition_review')r.requestId='00000000-0000-4000-8000-999999999999';return r;});try{const r=await h.repo.commitNutritionReview(e.reviewPacket,()=>h.state.current);assert.equal(r.ok,false);assert.equal(r.uncertain,true);assert.equal(Object.hasOwn(r,'data'),false);}finally{h.cleanup();}
});
