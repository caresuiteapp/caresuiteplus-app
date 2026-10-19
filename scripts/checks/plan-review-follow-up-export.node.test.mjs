import {test} from 'node:test';import assert from 'node:assert/strict';
import {buildPlanReviewControlsArchive} from '../../src/lib/careAssessment/planReviewControlsExport.ts';
import {exportPlanReviewControls} from '../../src/lib/careAssessment/planReviewControlsExport.web.ts';
import {plan,record,tenant,assessment,client,now,time,id} from './fixtures/plan-amendment.mjs';
import {control,addEvent,resolveDraft} from './fixtures/plan-review-controls.mjs';
const stamp='2026-10-10T05:00:00Z';
const build=(controls,at=stamp)=>buildPlanReviewControlsArchive(plan(),[record()],controls,tenant,assessment,client,at,now);
function clinical(n=1){const c=control(record(),'',n);c.events[0].draft.source={kind:'care_plan',id:id(800+n),snapshot:{id:id(800+n),tenant_id:tenant,client_id:client,original_detail:`Persönlicher Originalbefund ${n}`}};return c;}
function outside(n=2){const r=record();r.root.assessmentId=id(900+n);r.root.snapshot.assessmentId=id(900+n);return control(r,id(50),n);}
const resolve=(origin,target,at=time(13))=>addEvent(origin,{...resolveDraft(),occurredAt:at,outcome:'refused',evidence:null,followUpTaskId:target.task.id,noFollowUpReason:''});
const cancel=(t,at)=>addEvent(t,{kind:'cancel',occurredAt:at,reason:'Tatsächlich storniert',communication:'Individuelle Abstimmung'});
const reopen=(t,at)=>addEvent(t,{kind:'reopen',occurredAt:at,reason:'Tatsächlich neuer Bedarf',policy:{...t.events[0].draft.policy,dueAt:time(18),escalationAt:time(19)}});
function pair(target=clinical()){const origin=control();resolve(origin,target);return {origin,target};}

test('version 3 keeps outgoing clinical originals and explicit unchecked source comparison without extending primary evaluation counters',()=>{
 const {origin,target}=pair(),v=build([origin,target]);assert.equal(v.archive.version,3);assert.deepEqual(v.archive.currentSourceComparison,{status:'not_checked',checkedAt:null,rows:[]});assert.equal(v.archive.overview.controlTotal,1);assert.equal(v.archive.overview.controlUnfulfilled,1);assert.equal(v.archive.overview.controlOpen,0);assert.deepEqual(v.archive.controlOriginals,[origin,target]);assert.deepEqual(v.archive.overview.controlOriginals,[origin,target]);assert.equal(v.archive.followUpRelations[0].targetState.source.kind,'care_plan');assert(v.html.includes(target.events[0].draft.source.snapshot.original_detail));assert(v.html.includes('Getrennter heutiger Folgeauftragszustand'));
});
test('explicit different assessment preserves exact historical source in both original arrays',()=>{
 const {origin,target}=pair(outside()),v=build([target,origin]);assert.deepEqual(v.archive.controlOriginals,[origin,target]);assert.deepEqual(v.archive.overview.controlOriginals,[origin,target]);assert.equal(v.archive.overview.links.length,1);assert.equal(v.archive.followUpRelations[0].targetState.source.snapshot.assessment_id,id(902));assert(v.html.includes(id(902)));
});
test('unrelated and incoming-only orders never leak into nested archive sections',()=>{
 const {origin,target}=pair(),incoming=clinical(3),unrelated=outside(4);resolve(incoming,origin,time(14));incoming.events[0].draft.title='Incoming secret';unrelated.events[0].draft.title='Unrelated secret';const v=build([incoming,origin,target,unrelated]);for(const c of [incoming,unrelated]){assert(!v.json.includes(c.task.id));assert(!v.html.includes(c.task.id));assert(!v.json.includes(c.events[0].draft.title));assert(!v.html.includes(c.events[0].draft.title));}assert.deepEqual(v.archive.controlOriginals,[origin,target]);assert.equal(v.archive.followUpRelations.length,1);
});
test('outgoing chain includes every original even beyond other assessment and source boundaries',()=>{
 const {origin,target}=pair(),third=outside(2),fourth=clinical(3);resolve(target,third,time(14));resolve(third,fourth,time(15));const v=build([fourth,third,target,origin]);assert.deepEqual(v.archive.controlOriginals,[origin,target,third,fourth]);assert.equal(v.archive.followUpRelations.length,3);assert.equal(v.archive.overview.controlTotal,1);assert.equal((v.html.match(/class="control-original"/g)||[]).length,4);assert.deepEqual(v.archive.missingFollowUpTaskIds,[]);
});
test('cycle through native reopened origin terminates and exports each complete history once',()=>{
 const {origin,target}=pair();reopen(origin,time(14));resolve(target,origin,time(15));const v=build([origin,target]);assert.deepEqual(v.archive.controlOriginals,[origin,target]);assert.equal(v.archive.followUpRelations.length,2);assert.equal(v.archive.overview.controlOpen,1);assert.equal(v.archive.overview.links[0].results[0].currentCycle,false);assert.equal((v.html.match(/class="control-original"/g)||[]).length,2);assert(v.html.includes('Ergebnis einer früheren Auftragsfassung; kein Abschluss der jetzigen Fassung'));
});
test('shared native target is unique while every historical explicit resolution remains',()=>{
 const {origin,target}=pair();reopen(origin,time(14));resolve(origin,target,time(15));const v=build([origin,target]);assert.equal(v.archive.controlOriginals.length,2);assert.equal(v.archive.followUpRelations.length,2);assert.deepEqual(v.archive.followUpRelations.map(r=>r.currentCycle),[false,true]);assert.deepEqual(v.archive.followUpRelations.map(r=>r.targetTaskId),[target.task.id,target.task.id]);
});
test('missing direct target remains explicit and never creates an invented original',()=>{
 const {origin,target}=pair(),v=build([origin]);assert.deepEqual(v.archive.missingFollowUpTaskIds,[target.task.id]);assert.deepEqual(v.archive.controlOriginals,[origin]);assert.equal(v.archive.followUpRelations[0].comparison,'unavailable');assert.equal(v.archive.followUpRelations[0].target,null);assert(v.html.includes(target.task.id));assert(v.html.includes('kein Auftrag daraus abgeleitet'));
});
test('missing chain target remains explicit with upstream complete originals',()=>{
 const {origin,target}=pair(),third=clinical(2);resolve(target,third,time(14));const v=build([origin,target]);assert.deepEqual(v.archive.missingFollowUpTaskIds,[third.task.id]);assert.deepEqual(v.archive.controlOriginals,[origin,target]);assert.equal(v.archive.followUpRelations.length,2);assert.equal(v.archive.followUpRelations[1].target,null);
});
test('archive retains all target events and historical people without row or history truncation',()=>{
 const {origin,target}=pair();for(let h=11;h<=22;h++)addEvent(target,{kind:'assign',occurredAt:time(h),reason:`Individuelle Zuständigkeit ${h}`,assigneeId:id(100+h),backupId:id(5),escalationRecipientId:id(6)});target.actorNames[target.headId]='Historische Fachperson am letzten Ereignis';const v=build([origin,target]);assert.deepEqual(v.archive.controlOriginals[1],target);assert.equal(v.archive.controlOriginals[1].eventCount,13);assert(v.html.includes('Individuelle Zuständigkeit 22'));assert(v.html.includes(target.headId));assert(v.html.includes('Historische Fachperson am letzten Ereignis'));
});
test('today completed target cannot transform origin refusal into a performed resolution',()=>{
 const {origin,target}=pair();addEvent(target,{...resolveDraft(),occurredAt:time(14),evidence:{kind:'vital_measurement',id:id(780),snapshot:{id:id(780),tenant_id:tenant,client_id:client,occurred_at:time(13),display_value:'120/80',unit:'mmHg',values:{systolic:120,diastolic:80}}}});const v=build([origin,target]),r=v.archive.followUpRelations[0];assert.equal(r.targetState.status,'completed');assert.equal(r.recordedPrefix.status,'open');assert.equal(r.outcome,'refused');assert.equal(v.archive.overview.links[0].state.status,'not_fulfilled');assert.deepEqual(v.archive.controlOriginals[0],origin);assert(v.html.includes('Kontrolle abgelehnt'));
});
test('today reopened target preserves earlier cancelled prefix and independent original result',()=>{
 const {origin,target}=pair();cancel(target,time(12));reopen(target,time(14));const v=build([origin,target]),r=v.archive.followUpRelations[0];assert.equal(r.comparison,'not_open_at_recording');assert.equal(r.recordedPrefix.status,'cancelled');assert.equal(r.targetState.status,'open');assert.equal(r.recordedPrefix.policy.dueAt,time(11));assert.equal(r.targetState.policy.dueAt,time(18));assert.equal(v.archive.overview.controlUnfulfilled,1);assert(v.html.includes('Eigene Frist im damals dokumentierten Verlauf'));assert(v.html.includes('Eigene heutige Folgeauftragsfrist'));
});
test('later target creation prints discrepancy without fabricating former prefix',()=>{
 const {origin,target}=pair();target.events[0].recordedAt=time(14);target.events[0].draft.occurredAt=time(14);target.events[0].draft.policy.dueAt=time(15);target.events[0].draft.policy.escalationAt=time(16);const r=build([origin,target]).archive.followUpRelations[0];assert.equal(r.comparison,'created_after_recording');assert.equal(r.recordedPrefix,null);assert.equal(r.targetState.status,'open');
});
test('timezone-equivalent simultaneous microsecond creation carries warning and original IDs',()=>{
 const {origin,target}=pair();target.events[0].recordedAt='2026-10-09T15:00:00.000001+02:00';const v=build([origin,target]),r=v.archive.followUpRelations[0];assert.equal(r.comparison,'simultaneous_recording');assert.deepEqual(r.sameTimeEventIds,[target.events[0].id]);assert.equal(r.recordedPrefix.headId,target.headId);assert(v.html.includes('Bei zeitgleichen Erfassungen bleibt deren damalige Reihenfolge unklar.'));assert(v.html.includes('Er belegt keine gesicherte Transaktionsreihenfolge'));assert(v.html.includes(target.events[0].recordedAt));
});
test('one microsecond later documentation remains outside historical prefix',()=>{
 const {origin,target}=pair();target.events[0].recordedAt='2026-10-09T13:00:00.000002Z';const r=build([origin,target]).archive.followUpRelations[0];assert.equal(r.comparison,'created_after_recording');assert.equal(r.recordedPrefix,null);assert.deepEqual(r.sameTimeEventIds,[]);
});
test('retrospective actual event and later recording remain separate in JSON and HTML',()=>{
 const {origin,target}=pair();origin.events[1].draft.occurredAt=time(10);target.events[0].draft.occurredAt=time(11);target.events[0].recordedAt=time(11);const v=build([origin,target]),r=v.archive.followUpRelations[0];assert.equal(r.comparison,'open_at_recording');assert.equal(r.occurredAt,time(10));assert.equal(r.recordedAt,time(13));assert(v.html.includes('Tatsächlicher ursprünglicher Ereigniszeitpunkt'));assert(v.html.includes('Tatsächliche Erfassung der Verknüpfung'));
});
test('target due and escalation exact boundaries stay separate from own origin closure',()=>{
 const {origin,target}=pair();target.events[0].draft.policy.dueAt='2026-10-09T15:00:00.000001Z';target.events[0].draft.policy.escalationAt='2026-10-09T15:00:00.000002Z';const a=build([origin,target],'2026-10-09T15:00:00Z'),b=build([origin,target],'2026-10-09T15:00:00.000001Z');assert.equal(a.archive.followUpRelations[0].targetState.overdue,false);assert.equal(b.archive.followUpRelations[0].targetState.overdue,true);assert.equal(b.archive.followUpRelations[0].targetState.escalationState,'scheduled');assert.equal(b.archive.overview.controlUnfulfilled,1);
});
test('malformed unrelated originals are rejected before graph exclusions',()=>{const {origin,target}=pair(),unrelated=clinical(3);unrelated.actorNames={};assert.throws(()=>build([origin,target,unrelated]),/Personenbelege/);});
test('foreign client target is rejected instead of satisfying explicit own-client native link',()=>{const {origin,target}=pair();target.task.clientId=id(99);assert.throws(()=>build([origin,target]));});
test('duplicate loaded target cannot duplicate or ambiguously satisfy graph originals',()=>{const {origin,target}=pair();assert.throws(()=>build([origin,target,target]));});
test('reference before later target history cannot export an apparently current partial graph',()=>{const {origin,target}=pair();cancel(target,time(14));assert.throws(()=>build([origin,target],time(13)),/Vergleichszeitpunkt/);});
test('target clinical free text remains literal, all originals are escaped, CSP denies external content',()=>{
 const {origin,target}=pair();target.events[0].draft.reason='effective';target.events[0].draft.title='<script>native()</script>';target.actorNames[target.headId]='Historisch <img src=x>';target.events[0].draft.source.snapshot.original_detail='<svg onload=bad()> & persönliche Angabe';const v=build([origin,target]);assert(v.html.includes('<dd>effective</dd>'));assert(!v.html.includes('<script>'));assert(!v.html.includes('<img '));assert(!v.html.includes('<svg '));assert(v.html.includes('&lt;script&gt;native()&lt;/script&gt;'));assert(v.html.includes('&lt;img src=x&gt;'));assert(v.html.includes('&lt;svg onload=bad()&gt; &amp; persönliche Angabe'));assert.match(v.html,/Content-Security-Policy/);assert.match(v.html,/default-src &#39;none&#39;|default-src 'none'/);
});
test('all archive branches remain independent of original source collection',()=>{
 const {origin,target}=pair(),before=structuredClone([origin,target]),v=build([origin,target]);v.archive.controlOriginals[1].events[0].draft.title='Consumer change';v.archive.followUpRelations[0].recordedPrefix.policy.dueAt='Consumer change';assert.deepEqual([origin,target],before);
});
for(const mode of ['json','html'])test(`actual ${mode} Blob retains explicit clinical target, excludes incoming-only secret and revokes URL`,async()=>{
 const {origin,target}=pair(),incoming=clinical(3);resolve(incoming,origin,time(14));const blobs=[],timers=[],calls=[],saved={window:globalThis.window,document:globalThis.document,setTimeout:globalThis.setTimeout,create:URL.createObjectURL,revoke:URL.revokeObjectURL};
 const link={remove:()=>calls.push('remove'),click:()=>calls.push('click')};globalThis.window={};globalThis.document={createElement:()=>link,body:{appendChild:()=>calls.push('append')}};URL.createObjectURL=b=>{blobs.push(b);return 'blob:explicit-followup';};URL.revokeObjectURL=url=>calls.push(url);globalThis.setTimeout=fn=>timers.push(fn);
 try{exportPlanReviewControls(plan(),[record()],[incoming,target,origin],tenant,assessment,client,mode);const bytes=await blobs[0].text();assert(bytes.includes(target.task.id));assert(!bytes.includes(incoming.task.id));if(mode==='json'){const a=JSON.parse(bytes);assert.equal(a.version,3);assert.deepEqual(a.currentSourceComparison,{status:'not_checked',checkedAt:null,rows:[]});assert.deepEqual(a.controlOriginals,[origin,target]);assert.deepEqual(a.overview.controlOriginals,[origin,target]);assert.equal(a.followUpRelations.length,1);}else assert(bytes.includes(target.events[0].draft.source.snapshot.original_detail));assert.deepEqual(calls,['append','click','remove']);assert.equal(timers.length,1);timers[0]();assert.equal(calls.at(-1),'blob:explicit-followup');}
 finally{for(const k of ['window','document'])if(saved[k]===undefined)delete globalThis[k];else globalThis[k]=saved[k];globalThis.setTimeout=saved.setTimeout;URL.createObjectURL=saved.create;URL.revokeObjectURL=saved.revoke;}
});
