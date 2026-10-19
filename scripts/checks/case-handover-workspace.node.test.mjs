import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  assertHandoverClosable, assertHandoverSelectionCurrent, caseEmergencyExcerpt, caseHandoverVersion,
  decodeCaseHandoverContext, decodeCaseHandoverHistory, decodeCaseHandoverReceipt,
  handoverTaskFollowUps, validateCaseHandoverCommand, validateHandoverContent,
} from '../../src/lib/pflege/caseHandoverDomain.web.ts';
import { CaseHandoverWorkflow, handoverJournalKey } from '../../src/lib/pflege/caseHandoverWorkflow.web.ts';
import { createCaseHandoverRepository } from '../../src/lib/pflege/caseHandoverRepository.web.ts';
import { handoverDraftKey, restoreHandoverDraft, saveHandoverDraft, discardHandoverDraft } from '../../src/lib/pflege/caseHandoverDraft.web.ts';
import { controlHistory } from '../../src/lib/pflege/clinicalControlDomain.ts';

const id = n => `00000000-0000-0000-0000-${String(n).padStart(12,'0')}`;
const tenantId=id(1), clientId=id(2), actorId=id(4), receiver=id(5), receiver2=id(6);
const at=h=>`2026-10-15T${String(h).padStart(2,'0')}:00:00.123456Z`;
const now=Date.parse('2026-10-16T06:00:00Z'), scope={tenantId,clientId,actorId};
const native=(n,fields={})=>({id:id(n),tenant_id:tenantId,client_id:clientId,created_at:at(7),updated_at:at(8),...fields});
const source=()=>({kind:'care_plan',id:id(20),snapshot:native(20,{title:'Individueller Pflegeplan',status:'active'})});
const recipient=(n=5)=>({id:id(n),tenantId,name:`Pflegeperson ${n}`,roleKey:'nurse',updatedAt:at(8)});
function task(){
 const task={id:id(30),tenantId,clientId,version:'2026-10-09.1'};
 const draft={kind:'create',occurredAt:at(9),title:'Persönlich vereinbarte Kontrolle',reason:'Tatsächlicher Kontrollbedarf',instruction:'Befund erneut prüfen und Rückmeldung dokumentieren',source:source(),policy:{assigneeId:receiver,backupId:receiver2,dueAt:at(12),priority:'important',escalationAt:at(13),escalationRecipientId:actorId}};
 const e={id:id(31),taskId:task.id,tenantId,clientId,sequence:1,previousId:'',actorId,requestId:id(32),recordedAt:at(9),draft};
 return {task,headId:e.id,eventCount:1,events:[e],actorNames:{[e.id]:'Pflegefachperson'}};
}
function cancelledTask(){
 const t=task(),e={...t.events[0],id:id(33),requestId:id(34),sequence:2,previousId:t.headId,recordedAt:at(14),draft:{kind:'cancel',occurredAt:at(14),reason:'Tatsächlicher Anlass dokumentiert',communication:'Verantwortliche Person persönlich informiert'}};
 t.events.push(e);t.actorNames[e.id]='Verantwortliche Pflegeperson';t.headId=e.id;t.eventCount=2;return t;
}
function context(){return {version:caseHandoverVersion,...scope,loadedAt:at(10),client:{id:clientId,tenant_id:tenantId,first_name:'Erika',last_name:'Beispiel',birth_date:'1945-04-03',updated_at:at(8)},contacts:{count:1,rows:[native(40,{name:'Vertrauensperson',relationship:'Angehörige',phone:'Tatsächlich hinterlegte Nummer'})]},risks:{count:1,rows:[native(41,{category:'sturz',level:'hoch',description:'Dokumentierter Befund',mitigation:'Vereinbarte Unterstützung'})]},documents:{count:1,rows:[native(42,{title:'Arztbrief',file_name:'arztbrief.pdf',mime_type:'application/pdf',status:'aktiv'})]},sources:[source()],controls:[task()],recipients:{count:2,rows:[recipient(),recipient(6)]}};}
function content(){const c=context();return {title:'Geprüfte Fallübergabe',priority:'important',summary:'Tatsächliche Änderung und nächste Schritte',client:c.client,sources:c.sources,documents:[{document:c.documents.rows[0],source:'Behandelnde Praxis',documentDate:'2026-10-14',readable:true,correctCase:true,note:'Sichtprüfung durch übergebende Person'}],tasks:c.controls,recipients:[recipient(),recipient(6)],emergency:{contacts:c.contacts.rows,risks:c.risks.rows,plans:c.sources,accessNote:'Auffindbarkeit vor Ort prüfen; keine Zugangscodes gespeichert',limitations:'Erreichbarkeit und medizinische Gültigkeit nicht bestätigt',reviewed:true}};}
function publish(n=100,expectedHeadId=null){return {version:caseHandoverVersion,requestId:id(n+1),eventId:id(n+2),...scope,handoverId:id(100),expectedHeadId,kind:'publish',reason:expectedHeadId?'Tatsächliche relevante Änderung':'',content:content()};}
function ack(p=publish(),who=receiver,n=200){return {version:caseHandoverVersion,requestId:id(n+1),eventId:id(n+2),...scope,actorId:who,handoverId:p.handoverId,expectedHeadId:p.eventId,kind:'acknowledge',statement:'Diese genaue Fassung erhalten; offene Kontrolle bleibt zu bearbeiten.'};}
function close(p=publish(),n=400){return {version:caseHandoverVersion,requestId:id(n+1),eventId:id(n+2),...scope,handoverId:p.handoverId,expectedHeadId:p.eventId,kind:'close',statement:'Empfang abgeschlossen; Auftrag mit tatsächlicher Begründung storniert, keine Durchführung bescheinigt.',taskSnapshots:[cancelledTask()]};}
function event(c,time=at(15)){return {id:c.eventId,requestId:c.requestId,tenantId,clientId,handoverId:c.handoverId,headId:c.kind==='publish'?c.eventId:c.expectedHeadId,kind:c.kind,actorId:c.actorId,actorName:'Native angemeldete Person',recordedAt:time,command:structuredClone(c)};}
const receipt=c=>({version:caseHandoverVersion,requestId:c.requestId,command:structuredClone(c),event:event(c)});
const history=events=>({version:caseHandoverVersion,tenantId,clientId,handoverId:id(100),count:events.length,events});
const decode=events=>decodeCaseHandoverHistory(history(events),{tenantId,clientId,handoverId:id(100)},now);

test('complete native case selection, multiple recipients, documents, emergency details and exact original microseconds round trip',()=>{
 const c=decodeCaseHandoverContext(context(),scope,now),p=publish();
 assertHandoverSelectionCurrent(p.content,c,now);validateCaseHandoverCommand(p,now);
 const saved=decodeCaseHandoverReceipt(receipt(p),p,now),state=decode([saved.event]);
 assert.equal(state.pendingRecipients.length,2);assert.equal(state.head.command.content.sources[0].snapshot.updated_at,at(8));
 saved.command.content.title='Consumer mutation';assert.equal(p.content.title,'Geprüfte Fallübergabe');
});
for(const field of ['contacts','risks','documents','recipients'])test(`incomplete ${field} collection fails before source adoption`,()=>{const c=context();c[field].count++;assert.throws(()=>decodeCaseHandoverContext(c,scope,now));});
test('a foreign case cannot be accepted as the active case even with matching display name',()=>{const c=context();c.client.id=id(99);assert.throws(()=>decodeCaseHandoverContext(c,scope,now));});
for(const field of ['sources','tasks','recipients','documents'])test(`exact native ${field} originals are required, not ID-only membership`,()=>{
 const c=context(),p=content();
 if(field==='sources')p.sources[0].snapshot.title='Invented source';
 if(field==='tasks')p.tasks[0].actorNames[id(31)]='Invented historical name';
 if(field==='recipients')p.recipients[0].name='Invented recipient';
 if(field==='documents')p.documents[0].document.updated_at='2026-10-15T08:00:00.123457Z';
 assert.throws(()=>assertHandoverSelectionCurrent(p,c,now),/geändert|zugänglich/);
});
test('one microsecond or timezone representation change is not flattened away when comparing originals',()=>{
 const p=content(),c=context();p.sources[0].snapshot.updated_at='2026-10-15T10:00:00.123456+02:00';
 assert.throws(()=>assertHandoverSelectionCurrent(p,c,now));assert.equal(p.sources[0].snapshot.updated_at,'2026-10-15T10:00:00.123456+02:00');
});
for(const mutate of [p=>p.documents[0].readable=false,p=>p.documents[0].correctCase=false,p=>p.documents[0].document.client_id=id(90),p=>p.documents[0].document.mime_type='text/html',p=>p.documents[0].documentDate='2026-02-30',p=>p.documents[0].source='',p=>p.documents[0].document.status='archiviert'])test(`document review rejects unreadable/foreign/unreviewed invalid adoption ${mutate.toString()}`,()=>{const p=content();mutate(p);assert.throws(()=>validateHandoverContent(p,tenantId,clientId,now));});
test('empty emergency selections require honest limitations, not guessed contacts or medical orders',()=>{const p=content();p.emergency.contacts=[];p.emergency.risks=[];p.emergency.plans=[];validateHandoverContent(p,tenantId,clientId,now);p.emergency.limitations='';assert.throws(()=>validateHandoverContent(p,tenantId,clientId,now));});
test('a non-plan source cannot become an emergency plan merely by selecting it',()=>{const p=content();p.emergency.plans[0].kind='pflege_report';assert.throws(()=>validateHandoverContent(p,tenantId,clientId,now),/Pflegepläne/);});
test('a task already closed in its native history cannot be newly presented as an open task',()=>{const p=content();p.tasks=[cancelledTask()];assert.throws(()=>validateHandoverContent(p,tenantId,clientId,now),/offene/);});
test('own reception leaves native care task open and closure blocked',()=>{
 const p=publish(),a=ack(p),state=decode([event(p),event(a)]);
 assert.equal(state.pendingRecipients.length,1);assert.equal(controlHistory(p.content.tasks[0].task,p.content.tasks[0].events,now).status,'open');
 assert.throws(()=>assertHandoverClosable(state,[task()],now),/Empfang/);
 const all=decode([event(p),event(a),event(ack(p,receiver2,300))]);assert.throws(()=>assertHandoverClosable(all,[task()],now),/offen/);
});
test('current task follow-up uses the complete independent original, preserves captured task and cannot infer performance',()=>{
 const p=content(),rows=handoverTaskFollowUps(p,[cancelledTask()],tenantId,clientId,now);
 assert.equal(rows[0].state.status,'cancelled');assert.equal(rows[0].changed,true);assert.equal(controlHistory(rows[0].original.task,rows[0].original.events,now).status,'open');
 const missing=handoverTaskFollowUps(p,[],tenantId,clientId,now);assert.equal(missing[0].state,null);assert.equal(missing[0].accessible,false);
});
test('all receipts plus native closed task permit communication closure without rewriting any care record',()=>{
 const p=publish(),t=task(),snapshot=JSON.stringify(t),c=close(p),state=decode([event(p),event(ack(p)),event(ack(p,receiver2,300)),event(c)]);
 assert.equal(state.closure.kind,'close');assert.equal(JSON.stringify(t),snapshot);assert.equal(controlHistory(c.taskSnapshots[0].task,c.taskSnapshots[0].events,now).status,'cancelled');
});
test('communication closure cannot substitute another closed task, omit a task or duplicate one',()=>{
 const p=publish(),state=decode([event(p),event(ack(p)),event(ack(p,receiver2,300))]);
 assert.throws(()=>assertHandoverClosable(state,[],now));
 const foreign=cancelledTask();foreign.task.id=id(500);assert.throws(()=>assertHandoverClosable(state,[foreign],now));
 assert.throws(()=>assertHandoverClosable(state,[cancelledTask(),cancelledTask()],now));
});
test('a new append-only revision invalidates previous recipient receipts while retaining their historical events',()=>{
 const p=publish(),p2=publish(500,p.eventId);p2.content.summary='Neuer tatsächlicher Befund';
 const state=decode([event(p),event(ack(p)),event(ack(p,receiver2,300)),event(p2)]);
 assert.equal(state.revision,2);assert.equal(state.pendingRecipients.length,2);assert.equal(state.events.length,4);
 assert.throws(()=>decode([...state.events,event(ack(p,receiver,700))]),/aktuellen Fassung/);
});
for(const kind of ['foreign','duplicate','missing-head','closed-later'])test(`contradictory immutable handover history rejects ${kind}`,()=>{
 const p=publish();let events=[event(p)];
 if(kind==='foreign')events.push(event(ack(p,id(99))));
 if(kind==='duplicate')events.push(event(ack(p)),event(ack(p,receiver,700)));
 if(kind==='missing-head')events=[event(publish(500,p.eventId))];
 if(kind==='closed-later')events.push(event(ack(p)),event(ack(p,receiver2,300)),event(close(p)),event(publish(700,p.eventId)));
 assert.throws(()=>decode(events));
});
test('partial history count and forged receipt echo never establish a confirmed commit',()=>{
 const p=publish(),h=history([event(p)]);h.count=2;assert.throws(()=>decodeCaseHandoverHistory(h,{tenantId,clientId,handoverId:p.handoverId},now));
 const r=receipt(p);r.event.command.content.summary='Another payload';assert.throws(()=>decodeCaseHandoverReceipt(r,p,now));
});
test('emergency excerpt escapes patient/contact text and states missing and nonvalidated information explicitly',()=>{
 const p=content();p.client.first_name='<img src=x onerror=alert(1)>';p.emergency.contacts[0].name='</li><script>bad()</script>';p.emergency.contacts=[];
 const html=caseEmergencyExcerpt(p,at(15));assert.doesNotMatch(html,/<img|<script/);assert.match(html,/&lt;img/);assert.match(html,/Keine geprüfte Angabe/);assert.match(html,/keine Notfallanordnung/);
});

function storage(){const map=new Map();return {map,getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)};}
const lock=async(_key,action)=>action();
function workflow(options={}){
 const store=options.storage??storage();let writes=0,reads=0,current=true;
 const w=new CaseHandoverWorkflow(scope,{storage:store,lock,isCurrent:()=>current,commit:async p=>{writes++;return options.commit?options.commit(p):{ok:true,data:receipt(p)};},confirm:async p=>{reads++;return options.confirm?options.confirm(p):{ok:true,data:receipt(p)};}});
 return {w,store,writes:()=>writes,reads:()=>reads,revoke:()=>{current=false;}};
}
test('durable dispatched marker exists before the first RPC and confirmed receipt before success returns',async()=>{
 const store=storage(),p=publish(),x=workflow({storage:store,commit:async command=>{const saved=JSON.parse(store.getItem(handoverJournalKey(scope)));assert.equal(saved.phase,'dispatched');assert.deepEqual(saved.command,p);return {ok:true,data:receipt(command)};}});
 const result=await x.w.dispatch(p);assert.equal(result.ok,true);assert.equal(x.w.read().phase,'confirmed');assert.equal(x.writes(),1);
});
test('storage blocked/readback mismatch prevents transport entirely',async()=>{
 const store=storage();store.setItem=()=>{};const x=workflow({storage:store});await assert.rejects(()=>x.w.dispatch(publish()),/gesichert/);assert.equal(x.writes(),0);
});
test('corrupt or foreign durable journal blocks a new request instead of being treated as empty',async()=>{
 const store=storage();store.setItem(handoverJournalKey(scope),'malformed');const x=workflow({storage:store});
 await assert.rejects(()=>x.w.dispatch(publish()));assert.equal(x.writes(),0);
});
test('sparse, undefined or non-JSON context values are rejected rather than silently dropped',()=>{
 for(const mutate of [c=>{c.contacts.rows=new Array(1);},c=>{c.client.optional=undefined;},c=>{c.client.weird=new Date();},c=>{c.risks.rows[0].value=NaN;}]){const c=context();mutate(c);assert.throws(()=>decodeCaseHandoverContext(c,scope,now));}
});
test('account/case scoped editor draft survives reload, preserving original source versions while requiring renewed emergency review',()=>{
 const store=storage(),draft={version:caseHandoverVersion,scope,previousHeadId:null,reason:'',content:content()};
 saveHandoverDraft(store,draft);const restored=restoreHandoverDraft(store,scope,null,context());
 assert.equal(restored.changed,false);assert.equal(restored.draft.content.title,draft.content.title);assert.equal(restored.draft.content.emergency.reviewed,false);
 assert.deepEqual(restored.draft.content.documents,draft.content.documents);
 assert.equal(restoreHandoverDraft(store,{...scope,actorId:receiver},null,context()),null);
});
for(const change of ['source','document','recipient','task','client'])test(`restored draft keeps text but discards changed ${change} selections instead of silently adopting new originals`,()=>{
 const store=storage(),draft={version:caseHandoverVersion,scope,previousHeadId:null,reason:'',content:content()},c=context();saveHandoverDraft(store,draft);
 if(change==='source')c.sources[0].snapshot.updated_at='2026-10-15T08:00:00.123457Z';
 if(change==='document')c.documents.rows[0].updated_at='2026-10-15T08:00:00.123457Z';
 if(change==='recipient')c.recipients.rows[0].name='Geänderter nativer Anzeigename';
 if(change==='task')c.controls=[cancelledTask()];
 if(change==='client')c.client.last_name='Geänderter Name';
 const r=restoreHandoverDraft(store,scope,null,c);assert.equal(r.changed,true);assert.equal(r.draft.content.summary,draft.content.summary);
 for(const field of ['sources','tasks','documents','recipients'])assert.deepEqual(r.draft.content[field],[]);
 assert.equal(r.draft.content.emergency.reviewed,false);
});
test('corrupt draft is not overwritten as an empty draft and cleanup never removes an unresolved journal',async()=>{
 const store=storage(),x=workflow({storage:store,commit:async()=>({ok:false,uncertain:true,error:'lost'})});await x.w.dispatch(publish());
 store.setItem(handoverDraftKey(scope,null),'broken');assert.throws(()=>restoreHandoverDraft(store,scope,null,context()));
 discardHandoverDraft(store,scope,null);assert.equal(x.w.read().phase,'dispatched');
});
test('an incomplete text draft can be secured without claiming readiness or native acceptance',()=>{
 const store=storage(),p=content();p.title='';p.summary='';p.documents=[];p.recipients=[];p.emergency.reviewed=false;
 saveHandoverDraft(store,{version:caseHandoverVersion,scope,previousHeadId:null,reason:'',content:p});
 assert.equal(restoreHandoverDraft(store,scope,null,context()).draft.content.title,'');assert.throws(()=>validateHandoverContent(p,tenantId,clientId,now));
});
test('lost acknowledgement survives a new workflow instance and recovery performs only one read, never a second write',async()=>{
 const x=workflow({commit:async()=>({ok:false,uncertain:true,error:'connection lost after commit'})}),p=publish();
 assert.equal((await x.w.dispatch(p)).ok,false);assert.equal(x.w.read().phase,'dispatched');
 const restored=workflow({storage:x.store});assert.equal((await restored.w.confirm()).ok,true);assert.equal(restored.writes(),0);assert.equal(restored.reads(),1);
 await restored.w.releaseConfirmed([receipt(p).event]);assert.equal(restored.w.read(),null);
});
test('missing recovery receipt cannot establish rollback, clear a journal or permit retransmission',async()=>{
 const x=workflow({commit:async()=>({ok:false,uncertain:true,error:'lost'}),confirm:async()=>({ok:false,rejected:true,error:'no row'})});
 await x.w.dispatch(publish());assert.equal((await x.w.confirm()).ok,false);assert.equal(x.w.read().phase,'dispatched');
 await assert.rejects(()=>x.w.discardUnsentOrRejected());await assert.rejects(()=>x.w.dispatch(publish(600)));assert.equal(x.writes(),1);
});
test('only explicit first-attempt rollback permits clearing a rejected request',async()=>{
 const x=workflow({commit:async()=>({ok:false,rejected:true,error:'native SQL rollback'})});await x.w.dispatch(publish());assert.equal(x.w.read().phase,'rejected');await x.w.discardUnsentOrRejected();assert.equal(x.w.read(),null);
});
test('unmounted/revoked account cannot expose or accept a late commit and preserves the pending marker',async()=>{
 let release;const response=new Promise(resolve=>release=resolve),x=workflow({commit:()=>response}),p=publish(),pending=x.w.dispatch(p);
 await new Promise(resolve=>setImmediate(resolve));x.revoke();release({ok:true,data:receipt(p)});
 await assert.rejects(()=>pending,/Konto/);assert.equal(x.w.read().phase,'dispatched');
});
test('mutating a form while a request awaits transport cannot alter the durable packet or native confirmation',async()=>{
 let release;const response=new Promise(resolve=>release=resolve),x=workflow({commit:()=>response}),p=publish(),original=structuredClone(p),pending=x.w.dispatch(p);
 p.content.title='Changed after click';await new Promise(resolve=>setImmediate(resolve));release({ok:true,data:receipt(original)});
 assert.equal((await pending).ok,true);assert.deepEqual(x.w.read().command,original);
});
test('receipt persistence failure remains recoverable and does not permit a second write',async()=>{
 const store=storage(),set=store.setItem;store.setItem=(k,v)=>{if(JSON.parse(v).phase==='confirmed')throw Error('quota');set(k,v);};const x=workflow({storage:store});
 await assert.rejects(()=>x.w.dispatch(publish()),/quota/);assert.equal(x.w.read().phase,'dispatched');assert.equal(x.writes(),1);
});
test('a confirmed journal is retained until the exact native event is present in the refreshed history',async()=>{
 const x=workflow(),p=publish();await x.w.dispatch(p);await assert.rejects(()=>x.w.releaseConfirmed([]),/Originalbeleg/);assert.equal(x.w.read().phase,'confirmed');
 await x.w.releaseConfirmed([event(p)]);assert.equal(x.w.read(),null);
});
test('two tabs serialize against the same durable key and only one new packet dispatches',async()=>{
 const store=storage();let occupied=false;const tabLock=async(_k,action)=>{if(occupied)throw Error('other tab');occupied=true;try{return await action();}finally{occupied=false;}};
 let release;const wait=new Promise(resolve=>release=resolve),p=publish();let writes=0;
 const deps={storage:store,lock:tabLock,isCurrent:()=>true,commit:async c=>{writes++;await wait;return {ok:true,data:receipt(c)};},confirm:async c=>({ok:true,data:receipt(c)})};
 const first=new CaseHandoverWorkflow(scope,deps),second=new CaseHandoverWorkflow(scope,deps),pending=first.dispatch(p);
 await new Promise(resolve=>setImmediate(resolve));await assert.rejects(()=>second.dispatch(publish(600)),/other tab/);release();await pending;assert.equal(writes,1);
});

function sdkBoundary(options={}){
 let current=true;const calls=[];const a={tenantId,actorId,accessToken:'captured-native-token',expiresAt:null,isCurrent:()=>current};
 const sdk={auth:{getSession:async()=>options.session??{data:{session:{user:{id:actorId},access_token:a.accessToken}},error:null},getUser:async()=>{if(options.onUser)options.onUser();return {data:{user:{id:actorId}},error:null};}},rpc:async(name,args)=>{calls.push({name,args:structuredClone(args)});return options.rpc?options.rpc(name,args):{data:context(),error:null};}};
 let liveSdk=sdk;
 const repository=createCaseHandoverRepository({getSdk:()=>liveSdk,query:async p=>p});
 return {repository,a,calls,revoke:()=>{current=false;},replace:()=>{liveSdk={...sdk};}};
}
test('SDK context reader verifies the exact native session and actor before accepting the full own-case envelope',async()=>{const x=sdkBoundary();const r=await x.repository.context(x.a,clientId);assert.equal(r.ok,true);assert.equal(x.calls[0].name,'web_case_handover_context');});
for(const mismatch of ['token','actor','expiry'])test(`SDK session ${mismatch} mismatch prevents any RPC`,async()=>{
 const s={user:{id:actorId},access_token:'captured-native-token'};if(mismatch==='token')s.access_token='another-token';if(mismatch==='actor')s.user.id=receiver;if(mismatch==='expiry')s.expires_at=1;
 const x=sdkBoundary({session:{data:{session:s},error:null}});assert.equal((await x.repository.context(x.a,clientId)).ok,false);assert.equal(x.calls.length,0);
});
test('permission generation invalidated during native getUser prevents dispatch',async()=>{let x;x=sdkBoundary({onUser:()=>x.revoke()});assert.equal((await x.repository.context(x.a,clientId)).ok,false);assert.equal(x.calls.length,0);});
test('SDK replacement after dispatch makes a success response uncertain, not confirmed',async()=>{
 let x;x=sdkBoundary({rpc:async()=>{x.replace();return {data:receipt(publish()),error:null};}});const r=await x.repository.commit(x.a,publish());assert.equal(r.ok,false);assert.equal(r.uncertain,true);
});
for(const code of ['23514','40001','42501','40P01'])test(`native ${code} rollback is a definite first write rejection`,async()=>{const x=sdkBoundary({rpc:async()=>({data:null,error:{code}})});const r=await x.repository.commit(x.a,publish());assert.equal(r.rejected,true);assert.equal(r.uncertain,undefined);});
for(const response of [{data:null,error:{code:'PGRST000'}},{data:null,error:null},{data:receipt(publish(900)),error:null},{data:{},error:{code:'40001'}}])test(`transport/missing/foreign success remains uncertain ${JSON.stringify(response).slice(0,80)}`,async()=>{const x=sdkBoundary({rpc:async()=>response}),r=await x.repository.commit(x.a,publish());assert.equal(r.ok,false);assert.equal(r.uncertain,true);});
test('readonly confirmation pins the exact original request even after other revisions or recipients have progressed',async()=>{
 const p=publish(),x=sdkBoundary({rpc:async(name,args)=>{assert.equal(name,'web_confirm_case_handover');assert.deepEqual(args.p_command,p);return {data:receipt(p),error:null};}});
 assert.equal((await x.repository.confirm(x.a,p)).ok,true);assert.equal(x.calls.length,1);
});
test('front-end composition: publish, lose answer, restore, read-confirm, native history, recipient ack, changed source and independent closure',async()=>{
 const packets=new Map(),events=[],tasks=[task()];let commits=0,lose=true;
 const x=sdkBoundary({rpc:async(name,args)=>{
  if(name==='web_commit_case_handover'){
   commits++;const p=args.p_command;
   if(p.kind==='publish')assertHandoverSelectionCurrent(p.content,context(),now);
   const r=receipt(p);packets.set(p.requestId,r);events.push(r.event);
   if(lose){lose=false;throw Error('lost after native commit');}return {data:r,error:null};
  }
  if(name==='web_confirm_case_handover')return {data:packets.get(args.p_request_id)??null,error:null};
  throw Error('unexpected RPC');
 }});
 const store=storage(),deps={storage:store,lock,isCurrent:x.a.isCurrent,commit:p=>x.repository.commit(x.a,p),confirm:p=>x.repository.confirm(x.a,p)};
 const first=new CaseHandoverWorkflow(scope,deps),p=publish();assert.equal((await first.dispatch(p)).ok,false);
 const restored=new CaseHandoverWorkflow(scope,deps);assert.equal((await restored.confirm()).ok,true);await restored.releaseConfirmed(decode(events).events);assert.equal(commits,1);
 const a=ack(p),b=ack(p,receiver2,300);events.push(event(a),event(b));const state=decode(events);assert.throws(()=>assertHandoverClosable(state,tasks,now));
 const changed=context();changed.documents.rows[0].updated_at='2026-10-15T08:00:00.123457Z';assert.throws(()=>assertHandoverSelectionCurrent(p.content,changed,now));
 assertHandoverClosable(state,[cancelledTask()],now);assert.equal(controlHistory(tasks[0].task,tasks[0].events,now).status,'open');
});
