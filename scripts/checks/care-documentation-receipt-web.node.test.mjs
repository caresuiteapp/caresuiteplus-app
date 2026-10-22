import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
import * as domain from '../../src/lib/pflege/careDocumentationPacket.web.ts';
import {cloneClientNativeOriginal} from '../../src/lib/clients/clientRecordNativeOriginal.web.ts';
import {requireCareWorkspaceAuthorityWeb} from '../../src/lib/pflege/careWorkspaceAuthority.web.ts';
import {createCareDocumentationPathRepository} from '../../src/lib/pflege/careDocumentationPathWorkspaceRepository.web.ts';

const fixture=JSON.parse(readFileSync(new URL('./fixtures/care-documentation-staging-synthetic-20261022.json',import.meta.url),'utf8'));
const other='12345678-1234-4234-8234-123456789012',account='12345678-1234-4234-8234-123456789013';
const code=stripTypeScriptTypes(readFileSync(new URL('../../src/lib/pflege/careDocumentationRepository.supabase.web.ts',import.meta.url),'utf8').replace(/^import .*;\n/gm,'').replace(/^export /gm,''),{mode:'strip'});
function setup(replies,mutate=()=>{}){
 const state={current:true,clinical:0,getters:0},calls=[];
 const sdk={auth:{getSession:async()=>({data:{session:{user:{id:account},access_token:'synthetic-retained-test-token',expires_at:4102444800}},error:null}),getUser:async()=>({data:{user:{id:account}},error:null})},rpc:async(name,args)=>{
  if(name==='resolve_current_profile_id')return{data:fixture.expected.actorId,error:null};if(name==='current_tenant_id')return{data:fixture.expected.tenantId,error:null};
  calls.push({name,args:structuredClone(args)});const data=structuredClone(replies[state.clinical++]);const response={data,error:null,status:200};mutate(response,state);return response;
 }};
 const deps={...domain,cloneClientNativeOriginal,requireCareWorkspaceAuthorityWeb,getSupabaseClient:()=>sdk,toGermanSupabaseError:()=> 'Synthetic SQL denial',withServiceQueryTimeout:p=>Promise.resolve(p)};
 const api=new Function(...Object.keys(deps),code+'\nreturn{readCareDocumentation,readCareDocumentationRecord,commitCareDocumentationPacket,confirmCareDocumentationPacket};')(...Object.values(deps));
 const context={tenantId:fixture.expected.tenantId,clientId:fixture.expected.clientId,actorId:fixture.expected.actorId,isCurrent:()=>state.current};
 return{state,calls,api,sdk,context};
}
for(const method of ['commitCareDocumentationPacket','confirmCareDocumentationPacket'])for(const prefix of ['create','correct','later','extra','lower','older'])test(method+' accepts actual SQL '+prefix+' own receipt without fabricating the native version UUID',async()=>{
 const p=fixture[prefix+'Packet'],r=fixture[prefix+'Receipt'],h=setup([r]);assert.notEqual(p.actorId,account);
 assert.deepEqual(await h.api[method](p,()=>h.state.current),{ok:true,data:r.original});assert.equal(h.calls.length,1);assert.deepEqual(h.calls[0].args.p_packet,p);assert.notEqual(r.original.id,p.requestId);
});
test('production complete reader accepts actual PostgreSQL tied cursors, empty tail and final complete ledger reread',async()=>{
 const h=setup([fixture.firstPage,fixture.secondPage,fixture.thirdPage,fixture.emptyPage,fixture.firstPage]);
 assert.deepEqual(await h.api.readCareDocumentation(h.context),{ok:true,data:[...fixture.firstPage.rows,...fixture.secondPage.rows,...fixture.thirdPage.rows]});assert.equal(h.calls.length,5);
 assert.equal(h.calls[1].args.p_cursor_occurred_at,fixture.firstPage.nextCursorOccurredAt);assert.equal(h.calls[3].args.p_cursor_id,fixture.thirdPage.nextCursorId);assert.equal(h.calls[4].args.p_cursor_id,null);
});
test('production current-record reader resolves actual selected historical ID only within its retained complete root',async()=>{
 const h=setup([fixture.laterReceipt.original]);assert.deepEqual(await h.api.readCareDocumentationRecord(h.context,fixture.expected.firstVersionId),{ok:true,data:fixture.laterReceipt.original});
 const unrelated=setup([fixture.extraReceipt.original]);assert.equal((await unrelated.api.readCareDocumentationRecord(unrelated.context,fixture.expected.firstVersionId)).ok,false);
});
for(const method of ['commitCareDocumentationPacket','confirmCareDocumentationPacket'])for(const [name,change] of [
 ['another actual actor',r=>{r.original.recordedBy=other;r.original.history.at(-1).recordedBy=other;}],
 ['another retained entry',r=>{r.original.payload.result+=' altered';r.original.history.at(-1).payload.result+=' altered';}],
 ['altered original author snapshot',r=>{r.original.history[0].recordedByName='Synthetic changed old author';}],
 ['altered correction reason',r=>{r.original.history.at(-1).correctionReason+=' changed';}],
 ['another root and previous head',r=>{r.original.rootId=other;r.original.history[0].id=other;r.original.history[1].previousId=other;}],
 ['later current head instead of retained own result',r=>{r.original=structuredClone(fixture.laterReceipt.original);}],
 ['voided original',r=>{r.original.voided=true;}],
 ['another echoed request',r=>{r.requestId=other;}],
])test(method+' rejects generic valid actual SQL original with '+name,async()=>{
 const r=structuredClone(fixture.correctReceipt);change(r);assert.equal(domain.careDocumentationOriginalIssue(r.original,fixture.expected),null);
 const h=setup([r]),result=await h.api[method](fixture.correctPacket,()=>h.state.current);assert.equal(result.ok,false);assert.equal('data'in result,false);if(method.startsWith('commit'))assert.equal(result.uncertain,true);
});
for(const method of ['commitCareDocumentationPacket','confirmCareDocumentationPacket'])for(const field of ['data','error','status'])test(method+' rejects complete actual '+field+' response accessor without reading it',async()=>{
 const h=setup([fixture.correctReceipt],(response,state)=>{const retained=response[field];Object.defineProperty(response,field,{enumerable:true,get(){state.getters++;state.current=false;return retained;}});});
 const result=await h.api[method](fixture.correctPacket,()=>h.state.current);assert.equal(result.ok,false);assert.equal(h.state.getters,0);if(method.startsWith('commit'))assert.equal(result.uncertain,true);
});
test('production path adapter reads actual quarantined context with separately verified raw account and profile',async()=>{
 const h=setup([fixture.pathContext]),repository=createCareDocumentationPathRepository({getSdk:()=>h.sdk,query:p=>Promise.resolve(p)}),authority={...h.context,accessToken:'synthetic-retained-test-token',expiresAt:4102444800000};
 assert.deepEqual(await repository.context(authority),{ok:true,data:fixture.pathContext});assert.equal(h.calls.length,1);
 assert.equal((await repository.commit(authority,fixture.blockedPathCommand)).rejected,true);assert.equal((await repository.confirm(authority,fixture.blockedPathCommand)).uncertain,true);assert.equal(h.calls.length,1,'Unsupported path writes and unproven historical confirmations never dispatch.');
});
test('actual older-page mutation token prevents publication although the first actual page did not change',async()=>{
 const h=setup([fixture.firstPage,fixture.secondPage,fixture.thirdPage,{...fixture.emptyPage,stateFingerprint:fixture.pathContext.sources.stateFingerprint}]);assert.notEqual(fixture.firstPage.stateFingerprint,fixture.pathContext.sources.stateFingerprint);
 const result=await h.api.readCareDocumentation(h.context);assert.equal(result.ok,false);assert.equal('data'in result,false);
});
