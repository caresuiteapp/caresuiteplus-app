import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
import * as domain from '../../src/lib/pflege/careDocumentationPacket.web.ts';
import {cloneClientNativeOriginal} from '../../src/lib/clients/clientRecordNativeOriginal.web.ts';
import {requireCareWorkspaceAuthorityWeb} from '../../src/lib/pflege/careWorkspaceAuthority.web.ts';

const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const ids={tenant:id(1),client:id(2),actor:id(3),account:id(4),request:id(5),root:id(100),other:id(999)};
const at='2026-10-21T10:00:00.123456Z',recorded='2026-10-21T12:00:00.123456Z',proof='sha256:'+'a'.repeat(64);
const entry=(occurredAt=at)=>({...domain.blankCareDocumentationEntry('care_report',occurredAt),title:'Synthetic care observation',observation:'Synthetic explicitly authored observation',intervention:'Synthetic explicitly authored account',result:'Synthetic authored result'});
function original({root=ids.root,head=root,revision=1,occurredAt=at,prior=null,payload=entry(occurredAt)}={}){
 const item={id:head,revision,previousId:prior?.headId??null,occurredAt,recordedAt:recorded,recordedBy:ids.actor,recordedByName:'Synthetic author',payload:structuredClone(payload),correctionReason:revision===1?'':'Synthetic precise correction reason',contentFingerprint:proof};
 return{id:head,tenantId:ids.tenant,clientId:ids.client,rootId:root,headId:head,revision,kind:'care_report',recordedAt:recorded,occurredAt,createdAt:recorded,recordedBy:ids.actor,recordedByName:'Synthetic author',payload:structuredClone(payload),signature:null,contentFingerprint:proof,history:[...(prior?structuredClone(prior.history):[]),item],voided:false};
}
function packet(action='create'){
 const before=original(),after=entry();after.result+=' explicitly corrected';
 return{schemaVersion:'1',action,requestId:ids.request,tenantId:ids.tenant,clientId:ids.client,actorId:ids.actor,expectedHeadId:action==='create'?null:before.headId,expectedRevision:action==='create'?0:1,entry:action==='create'?entry():after,correctionReason:action==='create'?'':'Synthetic precise correction reason',confirmation:null,original:action==='create'?null:before};
}
function receipt(p){return{requestId:p.requestId,packet:structuredClone(p),original:p.action==='create'?original({payload:p.entry}):original({root:p.original.rootId,head:id(101),revision:2,prior:p.original,payload:p.entry})};}
const page=rows=>({rows:structuredClone(rows),nextCursorOccurredAt:rows.at(-1)?.occurredAt??null,nextCursorId:rows.at(-1)?.id??null,stateFingerprint:proof});
const moduleSource=stripTypeScriptTypes(readFileSync(new URL('../../src/lib/pflege/careDocumentationRepository.supabase.web.ts',import.meta.url),'utf8').replace(/^import .*;\n/gm,'').replace(/^export /gm,''),{mode:'strip'});
function harness({pages=[page([]),page([])],result=null,hook=()=>{}}={}){
 const state={current:true,user:ids.account,verified:ids.account,token:'synthetic-token',expires:4102444800,profile:ids.actor,tenant:ids.tenant,getterCalls:0,clinical:0,sessions:0},calls=[];
 const db={auth:{getSession:async()=>{await hook('session',state);state.sessions++;return{data:{session:{user:{id:state.user},access_token:state.token,expires_at:state.expires}},error:null};},getUser:async()=>{await hook('user',state);return{data:{user:{id:state.verified}},error:null};}},rpc:async(name,args)=>{
  calls.push({name,args:structuredClone(args)});await hook(name,state,args);
  if(name==='resolve_current_profile_id')return{data:state.profile,error:null};if(name==='current_tenant_id')return{data:state.tenant,error:null};
  const index=state.clinical++;const answer=result!==null?(typeof result==='function'?result(name,args,state):{data:structuredClone(result),error:null}):{data:structuredClone(pages[index]),error:null};
  await hook('clinical-response',state,answer);return answer;
 }};state.sdk=db;
 const context={tenantId:ids.tenant,clientId:ids.client,actorId:ids.actor,isCurrent:()=>state.current};
 const deps={...domain,cloneClientNativeOriginal,requireCareWorkspaceAuthorityWeb,getSupabaseClient:()=>state.sdk,toGermanSupabaseError:()=> 'Synthetic server rejection',withServiceQueryTimeout:request=>Promise.resolve(request)};
 const api=new Function(...Object.keys(deps),moduleSource+'\nreturn{readCareDocumentation,readCareDocumentationRecord,commitCareDocumentationPacket,confirmCareDocumentationPacket};')(...Object.values(deps));
 return{state,calls,db,context,api};
}

test('actual Web instant parser preserves one microsecond and equal offset instants',()=>{
 assert.equal(domain.careDocumentationInstantMicros('2026-10-21T10:00:00.123457Z')-domain.careDocumentationInstantMicros(at),1n);
 assert.equal(domain.careDocumentationInstantMicros('2026-10-21T12:30:00.123456+02:30'),domain.careDocumentationInstantMicros(at));
 assert.equal(domain.careDocumentationInstantMicros('2026-10-21T12:30:00.123456+0230'),domain.careDocumentationInstantMicros(at));
});
for(const invalid of ['2026-02-29T10:00:00Z','2026-04-31T10:00:00Z','0000-01-01T10:00:00Z','2026-10-21T24:00:00Z','2026-10-21T10:00:60Z','2026-10-21T10:00:00.1234567Z','2026-10-21T10:00:00+24:00','2026-10-21T10:00:00+01:60'])test('real calendar parser rejects '+invalid,()=>assert.equal(domain.careDocumentationInstantMicros(invalid),null));
for(const [name,change] of [
 ['changed old occurrence/payload',o=>{o.history[0].occurredAt='2026-10-21T10:00:00.123455Z';}],
 ['different historical kind',o=>{o.history[0].payload={...entry(),kind:'incident',incident:{incidentType:'Synthetic event',people:'Synthetic participants',measures:'Synthetic response',forwardedTo:'Synthetic service',closureState:'open',closureEvidence:''}};}],
 ['head payload detached from history',o=>{o.payload.result+=' different head';}],
 ['head author detached from history',o=>{o.recordedBy=ids.other;}],
 ['head author name detached from history',o=>{o.recordedByName='Another synthetic author';}],
 ['head recorded time detached from history',o=>{o.recordedAt='2026-10-21T12:00:00.123457Z';}],
 ['different created timestamp',o=>{o.createdAt='2026-10-21T12:00:00.123457Z';}],
 ['recorded before actual event',o=>{o.history[0].recordedAt='2026-10-20T12:00:00Z';}],
 ['backwards recorded history',o=>{o.history[1].recordedAt='2026-10-21T11:00:00Z';o.recordedAt=o.history[1].recordedAt;o.createdAt=o.recordedAt;}],
 ['first version correction reason',o=>{o.history[0].correctionReason='Invented first-version correction';}],
 ['unknown historical scope field',o=>{o.history[0].clientId=ids.other;}],
 ['unknown nested native field',o=>{o.history[0].payload.hidden='Unrecognized';}],
 ['undefined signature instead of explicit null',o=>{o.signature=undefined;}],
])test('complete original fails closed for '+name,()=>{const p=packet('correct'),o=receipt(p).original,scope={tenantId:ids.tenant,clientId:ids.client};assert.equal(domain.careDocumentationOriginalIssue(o,scope),null);change(o);assert.ok(domain.careDocumentationOriginalIssue(o,scope));});

for(const kind of ['entry','original','packet'])for(const attack of ['getter','hidden','symbol','toJSON','prototype','sparse','cycle'])test(kind+' validates descriptors before '+attack+' can alter the original',()=>{
 let calls=0;const value=kind==='entry'?entry():kind==='original'?original():packet();
 if(attack==='getter')Object.defineProperty(value,kind==='entry'?'title':kind==='original'?'id':'actorId',{enumerable:true,get(){calls++;return ids.actor;}});
 if(attack==='hidden')Object.defineProperty(value,'hidden',{enumerable:false,value:'omitted'});
 if(attack==='symbol')value[Symbol('hidden')]='omitted';if(attack==='toJSON')value.toJSON=()=>{calls++;return{};};
 if(attack==='prototype')Object.setPrototypeOf(value,{inherited:'hidden'});
 if(attack==='sparse'){if(kind==='original')delete value.history[0];else value.hidden=new Array(2);}
 if(attack==='cycle')value.hidden=value;
 const issue=kind==='entry'?domain.careDocumentationEntryIssue(value):kind==='original'?domain.careDocumentationOriginalIssue(value,{tenantId:ids.tenant,clientId:ids.client}):domain.careDocumentationPacketIssue(value);
 assert.ok(issue);assert.equal(calls,0);
});
test('packet builder clones before spreading descriptors and deeply freezes the preserved draft',()=>{
 const p=packet();let calls=0;Object.defineProperty(p,'actorId',{enumerable:true,get(){calls++;return ids.actor;}});assert.throws(()=>domain.makeCareDocumentationPacket(p));assert.equal(calls,0);
 const source=packet(),saved=domain.makeCareDocumentationPacket(source);assert.ok(Object.isFrozen(saved.entry));source.entry.observation+=' changed';assert.notEqual(source.entry.observation,saved.entry.observation);
});

test('production repository reads all short pages, the empty tail and an identical final head',async()=>{
 const one=original({root:id(104),occurredAt:'2026-10-21T10:00:00.123458Z'}),two=original({root:id(103),occurredAt:'2026-10-21T10:00:00.123457Z'}),three=original({root:id(102)});
 const h=harness({pages:[page([one]),page([two,three]),page([]),page([one])]});
 assert.deepEqual(await h.api.readCareDocumentation(h.context),{ok:true,data:[one,two,three]});assert.equal(h.state.clinical,4);
 const calls=h.calls.filter(c=>c.name==='web_read_care_documentation_page');assert.equal(calls[1].args.p_cursor_occurred_at,one.occurredAt);assert.equal(calls[2].args.p_cursor_id,three.id);assert.equal(calls[3].args.p_cursor_id,null);assert.notEqual(ids.account,ids.actor);
});
test('an initially empty ledger still needs a complete identical head reread',async()=>{const h=harness();assert.deepEqual(await h.api.readCareDocumentation(h.context),{ok:true,data:[]});assert.equal(h.state.clinical,2);});
for(const [name,pages] of [
 ['missing full proof',[{rows:[],nextCursorOccurredAt:null,nextCursorId:null}]],
 ['empty tail missing explicit cursors',[{rows:[],stateFingerprint:proof}]],
 ['empty tail retains a cursor',[{...page([]),nextCursorId:ids.root}]],
 ['older page changed token',[page([original()]),{...page([]),stateFingerprint:'sha256:'+'b'.repeat(64)}]],
 ['final head changed token',[page([]),{...page([]),stateFingerprint:'sha256:'+'b'.repeat(64)}]],
 ['new row appears after an empty first page',[page([]),page([original()])]],
 ['same head data but changed older ledger token',[page([original()]),page([]),{...page([original()]),stateFingerprint:'sha256:'+'b'.repeat(64)}]],
 ['wrong page cursor microsecond',[{...page([original()]),nextCursorOccurredAt:'2026-10-21T10:00:00.123455Z'}]],
 ['wrong page cursor UUID',[{...page([original()]),nextCursorId:ids.other}]],
 ['ascending microsecond order',[page([original(),original({root:id(101),occurredAt:'2026-10-21T10:00:00.123457Z'})])]],
 ['equal-time ascending UUIDs',[page([original(),original({root:id(101)})])]],
 ['same root returned twice',[page([original()]),page([original({head:id(101),revision:2,prior:original()})])]],
])test('production whole-ledger read rejects '+name,async()=>{const h=harness({pages});const result=await h.api.readCareDocumentation(h.context);assert.equal(result.ok,false);assert.equal('data'in result,false);});

for(const method of ['commitCareDocumentationPacket','confirmCareDocumentationPacket'])for(const action of ['create','correct'])test(method+' accepts the exact own '+action+' receipt and retained old history',async()=>{
 const p=packet(action),r=receipt(p),h=harness({result:r});assert.equal(domain.careDocumentationPacketIssue(p),null);assert.equal(domain.careDocumentationOriginalIssue(r.original,{tenantId:ids.tenant,clientId:ids.client}),null);
 assert.deepEqual(await h.api[method](p,()=>h.state.current),{ok:true,data:r.original});assert.equal(h.state.clinical,1);
});
for(const method of ['commitCareDocumentationPacket','confirmCareDocumentationPacket'])for(const [name,mutate] of [
 ['another valid actor',r=>{r.original.recordedBy=ids.other;r.original.history.at(-1).recordedBy=ids.other;}],
 ['another retained entry',r=>{r.original.payload.result+=' changed';r.original.history.at(-1).payload.result+=' changed';}],
 ['changed exact prior history',r=>{r.original.history[0].recordedByName='Changed original author';}],
 ['different retained correction reason',r=>{r.original.history.at(-1).correctionReason+=' altered';}],
 ['different root/previous head',r=>{r.original.rootId=ids.other;r.original.history[0].id=ids.other;r.original.history[1].previousId=ids.other;}],
 ['voided result',r=>{r.original.voided=true;}],
 ['different echoed request',r=>{r.requestId=ids.other;}],
])test(method+' rejects generic valid original with '+name,async()=>{
 const p=packet('correct'),r=receipt(p);mutate(r);assert.equal(domain.careDocumentationOriginalIssue(r.original,{tenantId:ids.tenant,clientId:ids.client}),null);
 const h=harness({result:r}),result=await h.api[method](p,()=>h.state.current);assert.equal(result.ok,false);assert.equal('data'in result,false);if(method.startsWith('commit'))assert.equal(result.uncertain,true);
});
for(const method of ['readCareDocumentation','commitCareDocumentationPacket','confirmCareDocumentationPacket'])for(const key of ['data','error','status'])test(method+' rejects whole response '+key+' accessor without invoking it',async()=>{
 const p=packet(),h=harness({result:method==='readCareDocumentation'?null:receipt(p),hook:(stage,state,value)=>{if(stage==='clinical-response'){const retained=value[key];Object.defineProperty(value,key,{enumerable:true,get(){state.getterCalls++;return retained;}});}}});
 const result=method==='readCareDocumentation'?await h.api[method](h.context):await h.api[method](p,()=>h.state.current);assert.equal(result.ok,false);assert.equal(h.state.getterCalls,0);if(method.startsWith('commit'))assert.equal(result.uncertain,true);
});
for(const [name,mutate] of [['raw account',s=>{s.user=ids.other;s.verified=ids.other;}],['session token',s=>{s.token+=' changed';}],['expiry metadata',s=>{s.expires++;}],['internal profile',s=>{s.profile=ids.other;}],['tenant',s=>{s.tenant=ids.other;}],['current owner',s=>{s.current=false;}],['SDK',s=>{s.sdk={...s.sdk};}]])for(const method of ['readCareDocumentation','commitCareDocumentationPacket','confirmCareDocumentationPacket'])test(method+' rejects '+name+' replacement after clinical dispatch',async()=>{
 const p=packet(),h=harness({result:method==='readCareDocumentation'?null:receipt(p),hook:(stage,state)=>{if(stage==='clinical-response')mutate(state);}});
 const result=method==='readCareDocumentation'?await h.api[method](h.context):await h.api[method](p,()=>h.state.current);assert.equal(result.ok,false);assert.equal('data'in result,false);if(method.startsWith('commit'))assert.equal(result.uncertain,true);
});
test('a caller mutation during the first await cannot replace the captured write packet',async()=>{
 const p=packet(),captured=structuredClone(p);const h=harness({result:receipt(captured),hook:(stage)=>{if(stage==='session')p.entry.observation='Changed while awaiting';}});
 assert.equal((await h.api.commitCareDocumentationPacket(p,()=>h.state.current)).ok,true);assert.deepEqual(h.calls.find(c=>c.name==='web_commit_care_documentation_packet').args.p_packet,captured);
});
test('readRecord may return a later root head only when selected ID occurs in its exact retained history',async()=>{
 const p=packet('correct'),r=receipt(p),h=harness({result:r.original});assert.deepEqual(await h.api.readCareDocumentationRecord(h.context,ids.root),{ok:true,data:r.original});
 const foreign=harness({result:original({root:ids.other})});assert.equal((await foreign.api.readCareDocumentationRecord(foreign.context,ids.root)).ok,false);
});
