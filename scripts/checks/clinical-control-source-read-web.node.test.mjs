import test from 'node:test';import assert from 'node:assert/strict';
import {clinicalControlSourceReadProjection,clinicalControlSourceReadSignature} from '../../src/lib/pflege/clinicalControlSourceRead.web.ts';
import {controlSourcePermissions} from '../../src/lib/pflege/clinicalControlRuntime.ts';
import {exportClinicalControlFollowUp} from '../../src/lib/pflege/clinicalControlFollowUpDownload.web.ts';
import {MedicationRequestState} from '../../src/lib/pflege/medicationRequestState.ts';
import {control,addEvent,resolveDraft} from './fixtures/plan-review-controls.mjs';
import {record,id,tenant,client,now,time} from './fixtures/plan-amendment.mjs';
import {dailyProtocolVersion} from '../../src/lib/pflege/dailyProtocolDomain.ts';
const keys=['pflege.documentation.view','pflege.treatment.view','pflege.orders.view','pflege.plans.view','pflege.medications.view','pflege.vitals.view','pflege.wounds.view'];
const rights=()=>Object.fromEntries(keys.map(key=>[key,true]));
const source=(kind='care_plan',n=800,extra={})=>({kind,id:id(n),snapshot:{id:id(n),tenant_id:tenant,client_id:client,content:'Vollständiger vertraulicher Originalinhalt',...extra}});
function clinical(n=0,s=source()){const c=control(record(),'',n);c.events[0].draft.source=structuredClone(s);return c;}
const projection=(records=[],sources=[],permissions=rights(),extra={})=>clinicalControlSourceReadProjection({tenantId:tenant,clientId:client,records,sources,permissions,now,...extra});
function protocol(){const entry={kind:'stool',occurredAt:time(8),source:'observed',reportedBy:'',observation:'Tatsächlicher Originalbefund',reaction:'Tatsächliche Rücksprache',reviewState:'pending',reviewAt:'',reviewReason:'Ausdrückliche offene Abstimmung',occurrence:'passed',amount:'medium',consistency:'formed',color:'Tatsächlich braun',reason:''};return {kind:'protocol_event',id:id(780),snapshot:{id:id(780),tenant_id:tenant,client_id:client,root_id:id(781),protocol_version:dailyProtocolVersion,protocol_kind:'stool',sequence:1,previous_id:'',actor_id:id(4),actor_name:'Historische Protokollfachperson',request_id:id(782),recorded_at:time(9),occurred_at:time(8),title:'Stuhl-/Darmprotokoll',draft:{action:'record',entry,reason:''}}};}
const vital=(n=710)=>source('vital_measurement',n,{occurred_at:time(12),display_value:'0',unit:'ml',values:{volume:0}});
for(const [kind,key] of [['care_plan','pflege.plans.view'],['wound_assessment','pflege.wounds.view'],['medication_administration','pflege.medications.view'],['vital_measurement','pflege.vitals.view'],['treatment_execution','pflege.medications.view'],['treatment_execution','pflege.vitals.view']])test(`revoked native ${kind} ${key} blocks cached full originals and current comparison`,()=>{
 const s=source(kind),r=clinical(0,s),p={...rights(),[key]:false},v=projection([r],[s],p);
 assert.equal(v.canReadOriginals,false);assert.equal(v.canReadSources,false);assert.equal(v.canReadComparison,false);
 assert.ok(v.originalMissingPermissions.includes(key));assert.ok(v.sourceMissingPermissions.includes(key));assert.ok(controlSourcePermissions(kind).includes(key));
});
test('genuine complete native plan evaluation requires current plan read permission despite preserved historical author',()=>{
 const r=control(),p={...rights(),'pflege.plans.view':false},v=projection([r],[r.events[0].draft.source],p);
 assert.deepEqual(v.originalMissingPermissions,['pflege.plans.view']);assert.equal(v.canReadOriginals,false);assert.equal(r.actorNames[r.headId],'Tatsächliche Auftragsfachperson');
});
test('native wound treatment additionally requires wound read; unrelated treatment does not invent that requirement',()=>{
 const wound=source('treatment_execution',800,{treatment_type:'wound_dressing'}),p={...rights(),'pflege.wounds.view':false};
 assert.equal(projection([clinical(0,wound)],[wound],p).canReadOriginals,false);
 const ordinary=source('treatment_execution',801,{treatment_type:'compression'});
 assert.equal(projection([clinical(0,ordinary)],[ordinary],p).canReadOriginals,true);
});
for(const key of keys.slice(0,3))test(`revoked base ${key} blocks even expressly empty or unknown clinical pools`,()=>{
 for(const pool of [null,[]]){const v=projection(pool,pool,{...rights(),[key]:false});assert.equal(v.canReadOriginals,false);assert.equal(v.canReadSources,false);assert.ok(v.originalMissingPermissions.includes(key));}
});
test('native protocol, infusion and report retain established base read contract without fabricated kind rights',()=>{
 const p={...rights(),'pflege.plans.view':false,'pflege.medications.view':false,'pflege.vitals.view':false,'pflege.wounds.view':false};
 for(const s of [protocol(),source('infusion_event'),source('pflege_report')]){const v=projection([clinical(0,s)],[s],p);assert.equal(v.canReadComparison,true);assert.deepEqual(v.originalRequiredPermissions,keys.slice(0,3));}
});
test('inaccessible current wound pool blocks comparison while accessible original report remains independently readable',()=>{
 const v=projection([clinical(0,source('pflege_report'))],[source('wound_assessment')],{...rights(),'pflege.wounds.view':false});
 assert.equal(v.canReadOriginals,true);assert.equal(v.canReadSources,false);assert.equal(v.canReadComparison,false);assert.deepEqual(v.originalMissingPermissions,[]);
});
test('current sources remain separately permitted even when retained historical plan original is no longer readable',()=>{
 const v=projection([],[source('pflege_report')],{...rights(),'pflege.plans.view':false},{retainedRecordPools:[[clinical()]]});
 assert.equal(v.canReadSources,true);assert.equal(v.canReadOriginals,false);assert.equal(v.canReadComparison,false);
});
test('all earlier result evidence survives a reopen and supplies its own native permission requirement',()=>{
 const r=clinical(0,source('pflege_report')),evidence=vital();
 addEvent(r,{...resolveDraft(),evidence});addEvent(r,{kind:'reopen',occurredAt:time(14),reason:'Tatsächlich neuer Bedarf',policy:{...r.events[0].draft.policy,dueAt:time(18),escalationAt:time(19)}});
 const v=projection([r],[],{...rights(),'pflege.vitals.view':false});
 assert.equal(v.canReadOriginals,false);assert.ok(v.originalRequiredPermissions.includes('pflege.vitals.view'));assert.equal(r.events.length,3);
});
test('result without actual evidence does not invent a missing vital or medication permission',()=>{
 const r=clinical(0,source('pflege_report'));addEvent(r,{...resolveDraft(),outcome:'omitted',evidence:null});
 const v=projection([r],[],{...rights(),'pflege.vitals.view':false,'pflege.medications.view':false});assert.equal(v.canReadOriginals,true);assert.deepEqual(v.originalRequiredPermissions,keys.slice(0,3));
});
test('retained original from opening remains rights-checked when newly returned native current pool is empty',()=>{
 const v=projection([],[],{...rights(),'pflege.plans.view':false},{retainedRecordPools:[[clinical()]]});
 assert.equal(v.originalPoolStatus,'provided');assert.equal(v.canReadOriginals,false);
});
test('older retained task prefix and pinned later complete pool may share identity without losing either original requirements',()=>{
 const earlier=clinical(0,source('pflege_report')),later=structuredClone(earlier);addEvent(later,{...resolveDraft(),evidence:vital()});
 const v=projection([later],[],{...rights(),'pflege.vitals.view':false},{retainedRecordPools:[[earlier],[later]]});
 assert.equal(v.canReadOriginals,false);assert.ok(v.originalRequiredPermissions.includes('pflege.vitals.view'));
});
test('same native source in separate pinned/seed pools may preserve changed snapshots and both native requirements',()=>{
 const seed=source(),pinned=structuredClone(seed);pinned.snapshot.content='Spätere vollständige Fassung';
 const v=projection(null,null,{...rights(),'pflege.plans.view':false},{retainedSourcePools:[[seed],[pinned]]});assert.equal(v.canReadOriginals,false);assert.equal(v.originalPoolStatus,'not_loaded');
});
test('null source/record queries remain unknown instead of being presented as expressly provided empty lists',()=>{
 const missing=projection(null,null),empty=projection([],[]);
 assert.equal(missing.originalPoolStatus,'not_loaded');assert.equal(missing.sourcePoolStatus,'not_loaded');assert.equal(empty.originalPoolStatus,'provided');assert.equal(empty.sourcePoolStatus,'provided');
 assert.equal(missing.canReadOriginals,true);assert.equal(missing.canReadSources,true);assert.equal(empty.permissionSignature,missing.permissionSignature);
});
for(const key of keys)test(`fixed signature changes on current ${key} revoke and regrant even while all pools are unknown`,()=>{
 const all=rights(),revoked={...all,[key]:false};assert.notEqual(clinicalControlSourceReadSignature(all),clinicalControlSourceReadSignature(revoked));assert.equal(projection(null,null,revoked).permissionSignature,clinicalControlSourceReadSignature(revoked));assert.equal(clinicalControlSourceReadSignature(all),clinicalControlSourceReadSignature({...revoked,[key]:true}));
});
test('truthy nonboolean rights and omitted flags never grant native read',()=>{
 for(const value of [1,'true',{},undefined]){const p={...rights(),'pflege.plans.view':value};assert.equal(projection([clinical()],[],p).canReadOriginals,false);assert.notEqual(clinicalControlSourceReadSignature(p),clinicalControlSourceReadSignature(rights()));}
 assert.equal(projection([],[],null).canReadOriginals,false);
});
for(const field of ['tenantId','clientId'])test(`foreign hidden original ${field} is validated before denying missing permissions`,()=>{
 const hidden=clinical(1);hidden.task[field]=id(99);assert.throws(()=>projection([clinical(),hidden],[],{}));
});
test('invalid hidden retained original never disappears behind an empty current RLS pool or missing right',()=>{
 const hidden=clinical(1);hidden.actorNames={};assert.throws(()=>projection([],[],{}, {retainedRecordPools:[[clinical(),hidden]]}),/Personenbelege/);
});
test('duplicate task inside one retained pool remains invalid; distinct pools preserve original versions',()=>{
 const r=clinical();assert.throws(()=>projection(null,null,rights(),{retainedRecordPools:[[r,r]]}),/doppelter/);assert.equal(projection(null,null,rights(),{retainedRecordPools:[[r],[r]]}).canReadOriginals,true);
});
test('cross-pool globally duplicate request on distinct native task is not hidden by separate retention',()=>{
 const current=clinical(),retained=clinical(1);retained.events[0].requestId=current.events[0].requestId;
 assert.throws(()=>projection([current],[],rights(),{retainedRecordPools:[[retained]]}),/Anfragekennung/);
});
test('retained earlier task version is not clipped before cross-task event and request namespace validation',()=>{
 const a=clinical(),b=clinical(1),olderA=structuredClone(a);
 olderA.events[0].id=b.events[0].id;olderA.events[0].requestId=b.events[0].requestId;olderA.headId=olderA.events[0].id;olderA.actorNames={[olderA.headId]:'Tatsächliche Auftragsfachperson'};
 assert.throws(()=>projection([a,b],[],rights(),{retainedRecordPools:[[olderA]]}),/Ereigniskennung|Anfragekennung/);
});
test('same native event with changed full content or historical author cannot impersonate an immutable retained original',()=>{
 const a=clinical(),changed=structuredClone(a);changed.events[0].draft.reason='Anderer tatsächlicher Originalgrund';
 assert.throws(()=>projection([a],[],rights(),{retainedRecordPools:[[changed]]}),/unveränderten Original/);
 const changedAuthor=structuredClone(a);changedAuthor.actorNames[a.headId]='Andere gesicherte historische Person';
 assert.throws(()=>projection([a],[],rights(),{retainedRecordPools:[[changedAuthor]]}),/unveränderten Original/);
});
test('one same-task request cannot identify two distinct individually valid native event originals across retained versions',()=>{
 const a=clinical(),changed=structuredClone(a);changed.events[0].id=id(9900);changed.headId=id(9900);changed.actorNames={[id(9900)]:'Tatsächliche Auftragsfachperson'};
 assert.throws(()=>projection([a],[],rights(),{retainedRecordPools:[[changed]]}),/Anfragekennung/);
});
test('same native task sequence cannot fork into different individually valid original create events across retained versions',()=>{
 const a=clinical(),fork=structuredClone(a);fork.events[0].id=id(9901);fork.events[0].requestId=id(9902);fork.headId=id(9901);fork.actorNames={[id(9901)]:'Tatsächliche Auftragsfachperson'};
 assert.throws(()=>projection([a],[],rights(),{retainedRecordPools:[[fork]]}),/Auftragssequenz/);
});
for(const pool of ['current','retained'])test(`malformed unused ${pool} source fails before permission derivation`,()=>{
 const malformed=source('pflege_report',899);malformed.snapshot.client_id=id(99);
 assert.throws(()=>pool==='current'?projection([clinical()],[source(),malformed],{}):projection([clinical()],[],{},{retainedSourcePools:[[source(),malformed]]}));
});
test('duplicate source inside one current or retained pool fails; preserved versions across pools remain legitimate',()=>{
 const s=source();assert.throws(()=>projection([],[s,s]),/doppelt/);assert.throws(()=>projection([],[],rights(),{retainedSourcePools:[[s,s]]}),/doppelt/);
 assert.equal(projection([],[s],rights(),{retainedSourcePools:[[s]]}).canReadComparison,true);
});
for(const kind of ['plan_evaluation','protocol_event'])test(`unused native ${kind} source respects exact explicit future microsecond boundary`,()=>{
 const s=kind==='plan_evaluation'?structuredClone(control().events[0].draft.source):protocol();
 s.snapshot.recorded_at='2026-10-10T06:00:00.000001Z';if(kind==='plan_evaluation')s.snapshot.root_created_at=s.snapshot.recorded_at;
 assert.throws(()=>projection([], [source('pflege_report'),s]),/zeit|zukünft|Erfassung/i);
 s.snapshot.recorded_at='2026-10-10T08:00:00.000000+02:00';if(kind==='plan_evaluation')s.snapshot.root_created_at=s.snapshot.recorded_at;
 assert.equal(projection([], [s]).canReadSources,true);
});
test('explicit unknown pool contract rejects missing/malformed arrays rather than claiming them provided',()=>{
 for(const bad of [undefined,{},false,''])assert.throws(()=>clinicalControlSourceReadProjection({tenantId:tenant,clientId:client,records:bad,sources:[],permissions:rights(),now}));
 for(const bad of [undefined,{},false,''])assert.throws(()=>clinicalControlSourceReadProjection({tenantId:tenant,clientId:client,records:[],sources:bad,permissions:rights(),now}));
});
test('sparse retained pool positions cannot silently omit unknown original or source snapshots',()=>{
 for(const key of ['retainedRecordPools','retainedSourcePools'])assert.throws(()=>projection([],[],rights(),{[key]:Array(1)}));
 assert.throws(()=>projection([],[],rights(),{retainedRecordPools:[Array(1)]}));
 assert.throws(()=>projection([],[],rights(),{retainedSourcePools:[Array(1)]}));
});
test('historical author and arbitrary snapshot role/rights claims never grant current runtime rights',()=>{
 const s=source('care_plan',800,{role:'business_admin',permissions:['pflege.plans.view'],can_read:true}),r=clinical(0,s);r.actorNames[r.headId]='Historische Business-Admin-Fachperson';
 assert.equal(projection([r],[s],{...rights(),'pflege.plans.view':false}).canReadOriginals,false);
});
test('permission projection never mutates native histories, microsecond times, retained/pinned sources or current flags',()=>{
 const r=clinical(),s=r.events[0].draft.source,p=rights(),input={tenantId:tenant,clientId:client,records:[r],sources:[s],retainedRecordPools:[[r]],retainedSourcePools:[[s]],permissions:p,now},before=structuredClone(input);
 const result=clinicalControlSourceReadProjection(input);result.originalRequiredPermissions.push('other');result.scope.clientId=id(99);assert.deepEqual(input,before);
});
test('opaque uncertain original request ID and payload survive independent source read revocation without being recaptured',()=>{
 const original=clinical(),payload={task:{id:original.task.id,clientId:client,version:original.task.version},expectedHeadId:'',draft:structuredClone(original.events[0].draft)},requests=new MedicationRequestState();
 const first=requests.begin(payload,()=>id(950));requests.settle(false,true);requests.release();
 assert.equal(projection([original],[],{...rights(),'pflege.plans.view':false}).canReadOriginals,false);
 const next=requests.begin({...payload,draft:{...payload.draft,title:'Neue fremde Übernahme'}});
 assert.equal(next.id,first.id);assert.equal(next.replay,true);assert.deepEqual(next.payload,first.payload);
});
test('actual native archive Blob output is refused by caller projection after plan read revocation, accessible report output stays possible',async()=>{
 const real={window:globalThis.window,document:globalThis.document,create:URL.createObjectURL,revoke:URL.revokeObjectURL,timeout:globalThis.setTimeout};let downloads=0,blob;
 globalThis.window={};globalThis.document={createElement:()=>({remove(){},click(){downloads++;}}),body:{appendChild(){}}};URL.createObjectURL=value=>{blob=value;return 'blob:source-rights';};URL.revokeObjectURL=()=>{};globalThis.setTimeout=()=>0;
 try{
  const plan=clinical(),p={...rights(),'pflege.plans.view':false};
  const guarded=r=>{if(!projection([r],null,p).canReadOriginals)throw Error('Aktuelles Quellen-Leserecht fehlt.');exportClinicalControlFollowUp([r],tenant,client,r.task.id,'json');};
  assert.throws(()=>guarded(plan),/Quellen-Leserecht/);assert.equal(downloads,0);assert.equal(blob,undefined);
  const report=clinical(1,source('pflege_report'));guarded(report);assert.equal(downloads,1);const bytes=await blob.text();assert.ok(bytes.includes(report.task.id));assert.ok(bytes.includes('Vollständiger vertraulicher Originalinhalt'));assert.ok(!bytes.includes(plan.task.id));
 }finally{URL.createObjectURL=real.create;URL.revokeObjectURL=real.revoke;globalThis.setTimeout=real.timeout;for(const key of ['window','document'])if(real[key]===undefined)delete globalThis[key];else globalThis[key]=real[key];}
});
