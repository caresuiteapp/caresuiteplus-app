import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes as strip} from 'node:module';
import * as native from '../../src/lib/clients/clientRecordNativeOriginal.web.ts';
import * as own from '../../src/lib/clients/clientRecordRead.web.ts';
import * as actions from '../../src/lib/clients/clientRecordActions.web.ts';
import {woundInstant,woundUuid} from '../../src/lib/pflege/woundCareDomain.ts';
import {validEventInstant} from '../../src/lib/pflege/medicationAdministrationDomain.ts';
import {withServiceQueryTimeout} from '../../src/lib/services/queryTimeout.ts';
const read=p=>readFileSync(new URL('../../'+p,import.meta.url),'utf8');
const compose=(p,deps,names)=>new Function(...Object.keys(deps),strip(read(p).replace(/^import[\s\S]*?;\n/gm,'').replace(/\bexport /g,''))+';return {'+names.join(',')+'};\n//# sourceURL='+p)(...Object.values(deps));
const old=read('scripts/checks/client-record-edit-core-native-web.node.test.mjs');
const setup=old.slice(0,old.indexOf("test('Actual legacy whole")) .replace(/^import[^\n]*\n/gm,'')
 .replace('return{state,tables,calls,writes,rpcCalls,initCalls,core,','return{db,state,tables,calls,writes,rpcCalls,initCalls,core,');
const {loaded}=new Function('native','own','actions','woundInstant','woundUuid','withServiceQueryTimeout','strip','readFileSync','read','assert',setup.replace(/const read=p=>[^\n]*\n/,'')+';return {loaded};')(native,own,actions,woundInstant,woundUuid,withServiceQueryTimeout,strip,readFileSync,read,assert);
const funding=compose('src/lib/clients/clientIntakeCostBearerConfig.ts',{},['COST_BEARER_TYPE_CONFIG','getCostBearerFieldValues','isCostBearerTypeKey','resolvePrimaryCostBearerName']);
const units=compose('src/lib/formatters/unitFormatters.ts',{},['formatCareLevel','formatSalutation']);
const dates=compose('src/lib/formatters/dateTimeFormatters.ts',{APP_LOCALE:'de-DE',APP_TIME_ZONE:'Europe/Berlin'},['formatDate']);
const types=compose('src/features/intakeDocuments/intakeDocumentTypes.ts',{},['CARE_CONTEXT_TO_SERVICE_TYPE','CONTRACT_TEMPLATE_BY_SERVICE_TYPE','PRIVACY_TEMPLATE_KEY','ASSIGNMENT_TEMPLATE_KEY','OPTIONAL_CONSENT_TEMPLATE_KEYS']);
const merges=compose('src/features/intakeDocuments/intakeCostCarrierMerge.ts',{...funding,...units,...dates},['buildCostCarrierMergeFields','buildFamilyDoctorClause']);
const context=compose('src/features/intakeDocuments/buildIntakeDocumentContext.ts',{...funding,...units,...dates,...types,...merges},['buildIntakePlaceholderContext']);
const renderer=compose('src/features/intakeDocuments/renderIntakeDocumentPreview.ts',{CARESUITE_DOCUMENT_FONT_CSS:'/* font leaf: no layout */',CARESUITE_FONT_STACK:'sans-serif'},['renderIntakeDocumentHtml']);
const {normalizeIntakeCareLevelForDb}=compose('src/lib/clients/clientIntakeCareLevel.ts',{},['normalizeIntakeCareLevelForDb']);
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`,at='2026-10-08 10:00:00.123456+02:00';
const row=(n,x={})=>({id:id(n),tenant_id:id(1),client_id:id(3),created_at:at,updated_at:at,...x});
const tablesMap={documents:'client_intake_documents',canonicals:'client_documents',signatures:'client_document_signatures',events:'client_document_events',systems:'intake_document_system_templates',tenants:'tenant_document_templates'};
const keys=['office.documents.view','office.documents.signatures.view','office.templates.view','office.clients.view_sensitive','documents.create','documents.edit_draft'];
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return{promise,resolve};};
async function harness(options={}){
 const h=await loaded(options);h.calls.length=0;h.state.docRights=Object.fromEntries(keys.map(k=>[k,true]));
 const system={id:id(2000),template_key:'contract',title:'Native contract',document_type:'client_contract',service_type:null,version:2,is_active:true,is_required:true,requires_client_signature:true,requires_employee_signature:false,requires_representative_signature:false,allows_custom_template:true,html_content:'<p>{{client.full_name}} {{care.level}}</p>{{signature.client}}',plain_text_content:'Native source',placeholder_schema:{'care.level':{label:'Pflegegrad',required:true}},signature_slots:[{role:'client',placeholder:'signature.client',required:true}],created_at:at,updated_at:at,raw_extra:{optional:undefined,nil:null,history:['b','a']}};
 h.tables.intake_document_system_templates=[system];h.tables.tenant_document_templates=[];
 h.tables.client_intake_documents=[row(1000,{template_key:'contract',document_type:'client_contract',title:'Original contract',status:'signed',version:3,source:'system',tenant_template_id:null,generated_document_id:null,finalized_html:'Original signed HTML',preview_html:'Original preview',updated_by:id(2),raw_extra:{at,optional:undefined}})];
 h.tables.client_documents=[row(1001,{intake_document_id:id(1000),portal_visible:true,uploaded_by:id(2),raw_filename:'Original.html'})];
 h.tables.client_document_signatures=[row(1002,{document_id:id(1000),signature_data:'RAW SIGNATURE',signed_at:at,signer_role:'client',signer_name:'Original author'})];
 h.tables.client_document_events=[row(1003,{document_id:id(1000),actor_profile_id:id(2),event_type:'original',summary:'Native original',metadata_json:{raw:undefined,sequence:['b','a'],at}})];
 const oldFrom=h.db.from;
 h.db.from=table=>{
  if(!Object.values(tablesMap).includes(table))return oldFrom.call(h.db,table);
  let payload=null,columns='*',single=false,cursor=null;const filters=[];
  const q={select(v){columns=v;h.state.docBuilder?.({table,payload});return q;},eq(k,v){filters.push([k,v]);return q;},order(k,v){assert.equal(k,'id');assert.equal(v.ascending,true);return q;},limit(n){assert.equal(n,200);return q;},gt(k,v){assert.equal(k,'id');cursor=v;return q;},single(){single=true;return q;},insert(v){payload=v;h.state.docBuilder?.({table,payload});return q;}};
  const then=(resolve,reject)=>{
   const call={table,columns,single,cursor,filters:structuredClone(filters),payload,rights:{...h.state.docRights}};
   (payload?h.writes:h.calls).push(call);
   return Promise.resolve().then(async()=>{
    const intercepted=await h.state.docIntercept?.(call);if(intercepted!==undefined)return intercepted;
    let rows=(h.tables[table]??[]).filter(r=>filters.every(([k,v])=>r[k]===v)).sort((a,b)=>a.id.localeCompare(b.id));
    if(payload){const defaults=table==='client_intake_documents'?{finalized_html:null,rendered_pdf_path:null,finalized_at:null,generated_document_id:null}:table==='client_documents'?{storage_path:null,valid_until:null,size_bytes:null,module_visibility:[],signed_at:null,signature_required:false,service_record_id:null,service_month:null}:{};
     const item={id:id(3000+h.writes.length),...structuredClone(payload),...defaults,created_at:at,...(table==='client_document_events'?{}:{updated_at:at}),raw_sdk_extra:{optional:undefined,sequence:[4,1],nativeAt:at}};
     h.tables[table].push(item);rows=[item];
    }else{if(cursor)rows=rows.filter(r=>r.id>cursor);rows=rows.slice(0,h.state.cap);}
    const r={data:single?rows[0]??null:rows,error:null,status:200,statusText:'OK'};
    if(payload)await h.state.afterDocAck?.(call,r);return r;
   }).then(resolve,reject);
  };
  Object.defineProperty(q,'then',{get(){h.state.docThenAccessor?.({table,payload});return then;}});return q;
 };
 const getSupabaseClient=()=>{h.state.privateSdkAccessor?.();return h.state.noSdk?null:h.state.sdkOverride??h.db;};
 const deps={...native,woundUuid,normalizeIntakeCareLevelForDb,ClientRecordEditController:h.controller.constructor,isOwnClientEditOriginalRead:h.reader.isOwnClientEditOriginalRead,getSupabaseClient,getServiceMode:()=>h.state.mode,fromUnknownTable:(db,t)=>db.from(t),withServiceQueryTimeout};
 const pre=compose('src/lib/clients/clientRecordEditCareDocuments.web.ts',deps,['ClientCareDocumentPreflightReader']);
 const permission=k=>{h.state.permissionCall?.(k);return h.state.docRights[k];};
 const reader=new pre.ClientCareDocumentPreflightReader(h.controller,h.lease,h.result,permission);reader.mount();
 const plannerModule=compose('src/lib/clients/clientRecordEditCareDocumentPlan.web.ts',{...deps,...pre,...context,...renderer,mayContinueClientEditCoreWriteWeb:h.core.mayContinueClientEditCoreWriteWeb},['ClientCareDocumentAppendPlanner','claimClientCareDocumentAppendWeb','clientCareDocumentAppendPrivateBindingWeb','assertClientCareDocumentAppendWeb']);
 const writer=compose('src/lib/clients/clientRecordEditCareDocumentWrite.web.ts',{...deps,...plannerModule,validEventInstant},['executeClientCareDocumentAppendWeb','mayContinueClientCareDocumentAppendWeb']);
 const planner=new plannerModule.ClientCareDocumentAppendPlanner(h.controller,h.lease,h.result,reader,permission);planner.mount();
 const form={...structuredClone(h.result.form),careLevel:'pg3'};
 const capture=async()=>{const preflight=await reader.prepare(form);assert.equal(preflight.ok,true,preflight.error);
  const core=h.core.captureClientEditCoreWriteWeb(h.controller,h.lease,h.result,form,['versorgung'],()=>true);
  return{receipt:preflight.data,core,plan:planner.capture(preflight.data,form,core)};};
 const start=async()=>{const p=await capture();assert.ok(p.plan);assert.ok(p.core);assert.equal(planner.current(p.plan,form,p.core),true);
  const attempt=h.controller.begin(h.lease,form,['versorgung']);assert.ok(attempt);const coreOutcome=await h.core.executeClientEditCoreWriteWeb(p.core,attempt);assert.equal(coreOutcome.status,'acknowledged');return{...p,attempt,coreOutcome};};
 return{...h,editReader:h.reader,system,reader,pre,permission,planner,plannerModule,writer,form,capture,start,run:p=>writer.executeClientCareDocumentAppendWeb(p.plan,p.attempt,p.coreOutcome)};
}

test('Actual reader/planner/whole Core/controller append three native rows; immutable originals/raw µs/defaults/private portal preserved',async()=>{
 const h=await harness(),raw=structuredClone(Object.fromEntries(Object.values(tablesMap).map(t=>[t,h.tables[t]]))),p=await h.start(),r=await h.run(p);
 assert.equal(r.status,'acknowledged');assert.equal(r.evidence.length,3);assert.equal(h.writes.length,4);assert.equal(h.writes[2].payload.portal_visible,false);
 assert.ok(h.writes[1].payload.preview_html.includes('PG 3'));assert.ok(h.writes[1].payload.preview_html.includes('Original Klient'));assert.equal(h.writes[1].payload.finalized_html,undefined);
 assert.equal(r.evidence[0].nativeResult.data.created_at,at);assert.deepEqual(r.evidence[0].nativeResult.data.raw_sdk_extra.sequence,[4,1]);assert.ok(Object.hasOwn(r.evidence[0].nativeResult.data.raw_sdk_extra,'optional'));
 for(const[t,rows]of Object.entries(raw))assert.deepEqual(h.tables[t].slice(0,rows.length),rows);
 assert.equal(h.writer.mayContinueClientCareDocumentAppendWeb(p.plan,p.attempt,r),true);assert.equal(h.writer.mayContinueClientCareDocumentAppendWeb(p.plan,p.attempt,{...r}),false);
 assert.equal(h.controller.status().pending,true);assert.equal(h.controller.finish(p.attempt).status,'uncertain');assert.equal(h.controller.status().uncertainOwners,1);
});
for(const key of ['tenant.name','tenant.street','tenant.city','cost_carrier.assignment_intro','document.date','client.unknown','client.careLevel'])test(`Unavailable/synthetic/unknown context ${key} rejects BEFORE Core`,async()=>{
 const h=await harness();h.system.html_content=`<p>{{${key}}}</p>`;const p=await h.capture();assert.equal(p.plan,null);assert.equal(h.writes.length,0);assert.equal(h.controller.status().pending,false);
});
for(const version of [2147483647,2147483648])test(`Native INTEGER successor overflow ${version} rejects before any Core write`,async()=>{const h=await harness();h.tables.client_intake_documents[0].version=version;assert.equal((await h.capture()).plan,null);assert.equal(h.writes.length,0);});
for(const patch of [{required:'false'},{label:null},{required:1},{extra:true}])test(`Strict real placeholder schema ${JSON.stringify(patch)} rejects before Core`,async()=>{const h=await harness();h.system.placeholder_schema={'care.level':{label:'Native',...patch}};assert.equal((await h.capture()).plan,null);assert.equal(h.writes.length,0);});
for(const key of ['contract.service_start','intake.date'])test(`Actual unchanged native historical DATE supplies ${key} without today's date fallback`,async()=>{const h=await harness();h.system.html_content=`<p>{{${key}}}</p>`;const p=await h.start(),r=await h.run(p);assert.equal(r.status,'acknowledged');assert.ok(h.writes[1].payload.preview_html.includes('08.02.2011'));});
for(const key of ['contract.service_start','intake.date'])test(`Missing native historical DATE ${key} does not receive a synthetic current date`,async()=>{const h=await harness({nativeCorePatch:{service_start:null,admission_date:null}});h.system.html_content=`{{${key}}}`;assert.equal((await h.capture()).plan,null);assert.equal(h.writes.length,0);});
for(const key of keys)test(`Observed ${key} loss closes captured plan permanently; matching regrant cannot restart`,async()=>{const h=await harness(),p=await h.capture();assert.ok(p.plan);h.state.docRights[key]=false;assert.equal(h.planner.current(p.plan,h.form,p.core),false);h.state.docRights[key]=true;assert.equal(h.planner.current(p.plan,h.form,p.core),false);assert.equal(h.writes.length,0);});
for(const change of ['plannerDisposed','controllerDisposed','newLease','foreignOwner','mutatedForm','copiedPlan','copiedCoreOutcome'])test(`Exact owner/lifetime/form/capability ${change} cannot dispatch a successor`,async()=>{
 const h=await harness(),p=await h.start();if(change==='plannerDisposed')h.planner.dispose();if(change==='controllerDisposed')h.controller.dispose();if(change==='newLease')h.controller.captureRead();if(change==='foreignOwner')h.refreshOriginal({owner:{foreign:true}});if(change==='mutatedForm'){h.form.careLevel='pg5';p.plan={...p.plan};}if(change==='copiedPlan')p.plan={...p.plan};if(change==='copiedCoreOutcome')p.coreOutcome={...p.coreOutcome};
 assert.equal((await h.run(p)).status,'blocked');assert.equal(h.writes.length,1);
});
for(const pool of Object.keys(tablesMap))test(`Full unselected ${pool} concurrent drift is detected under the SAME attempt without reader.current`,async()=>{const h=await harness(),p=await h.start(),table=tablesMap[pool];if(h.tables[table].length)h.tables[table][0].unselected_original='Changed';else h.tables[table].push({id:id(2200),tenant_id:id(1),template_key:'Other'});const r=await h.run(p);assert.equal(r.status,'uncertain');assert.equal(h.writes.length,1);assert.equal(h.controller.status().pending,true);});
for(const table of ['client_intake_documents','client_documents','client_document_events'])test(`Actual ${table} SDK error retains preceding full ACKs and denies automatic replay`,async()=>{const h=await harness(),p=await h.start();h.state.docIntercept=call=>call.payload&&call.table===table?{data:null,error:{code:'08006',message:'Native outcome unknown'},status:503}:undefined;const r=await h.run(p);assert.equal(r.status,'uncertain');const expected=['client_intake_documents','client_documents','client_document_events'].indexOf(table);assert.equal(r.evidence.filter(x=>x.acknowledged).length,expected);const before=h.writes.length;assert.equal((await h.run(p)).status,'blocked');assert.equal(h.writes.length,before);assert.equal(h.controller.status().pending,true);});
for(const field of ['id','tenant_id','client_id','updated_by','created_at','updated_at','finalized_html','generated_document_id','version','preview_html'])test(`Strict native intake ACK ${field} mismatch remains uncertain with no canonical or event`,async()=>{const h=await harness(),p=await h.start();h.state.afterDocAck=(call,r)=>{if(call.table==='client_intake_documents')r.data[field]=field==='id'?'bad':field==='tenant_id'||field==='client_id'||field==='updated_by'?id(99):field==='version'?99:'unexpected';};const r=await h.run(p);assert.equal(r.status,'uncertain');assert.equal(r.evidence[0].acknowledged,false);assert.equal(h.writes.length,2);});
for(const field of ['module_visibility','signature_required','signed_at','service_record_id','service_month','storage_path','size_bytes','valid_until','portal_visible','intake_document_id','uploaded_by'])test(`Strict native canonical default/link/author ${field} mismatch cannot reach event`,async()=>{const h=await harness(),p=await h.start();h.state.afterDocAck=(call,r)=>{if(call.table==='client_documents')r.data[field]=field==='portal_visible'||field==='signature_required'?true:field==='module_visibility'?['other']:'unexpected';};const r=await h.run(p);assert.equal(r.status,'uncertain');assert.equal(r.evidence[0].acknowledged,true);assert.equal(r.evidence[1].acknowledged,false);assert.equal(h.writes.length,3);});
for(const field of ['actor_profile_id','document_id','metadata_json','created_at','summary'])test(`Strict native event ${field} mismatch retains two prior ACKs without false whole completion`,async()=>{const h=await harness(),p=await h.start();h.state.afterDocAck=(call,r)=>{if(call.table==='client_document_events')r.data[field]='unexpected';};const r=await h.run(p);assert.equal(r.status,'uncertain');assert.equal(r.evidence.filter(x=>x.acknowledged).length,2);assert.equal(h.writer.mayContinueClientCareDocumentAppendWeb(p.plan,p.attempt,r),false);});
for(const boundary of ['builder','firstThen','secondThen','lastPermission'])test(`Actual ${boundary} permission loss before native then-entry causes zero CareDoc dispatch`,async()=>{const h=await harness(),p=await h.start();let n=0;if(boundary==='builder')h.state.docBuilder=()=>{h.state.docRights['documents.create']=false;};if(boundary==='firstThen'||boundary==='secondThen')h.state.docThenAccessor=()=>{if(++n===(boundary==='firstThen'?1:2))h.state.docRights['documents.create']=false;};if(boundary==='lastPermission')h.state.permissionCall=k=>{if(k==='documents.edit_draft')h.state.docRights['documents.create']=false;};const r=await h.run(p);assert.ok(['blocked','uncertain'].includes(r.status));assert.equal(h.writes.length,1);});
for(const afterTable of ['client_intake_documents','client_documents','client_document_events'])test(`Actual native ${afterTable} ACK survives rights loss, while subsequent dispatch/current followup denies`,async()=>{const h=await harness(),p=await h.start();h.state.afterDocAck=call=>{if(call.table===afterTable)h.state.docRights['office.documents.view']=false;};const r=await h.run(p),n=['client_intake_documents','client_documents','client_document_events'].indexOf(afterTable)+1;assert.equal(r.evidence.filter(x=>x.acknowledged).length,n);assert.equal(h.writes.length,n+1);assert.equal(r.status,n===3?'acknowledged':'uncertain');assert.equal(r.currentAtReturn,false);assert.equal(h.writer.mayContinueClientCareDocumentAppendWeb(p.plan,p.attempt,r),false);h.state.docRights['office.documents.view']=true;assert.equal(h.writer.mayContinueClientCareDocumentAppendWeb(p.plan,p.attempt,r),false);});
test('Whole form is frozen before await and used as exact Core binding, not mutable external draft',async()=>{const h=await harness(),p=await h.capture();h.form.firstName='External mutation';assert.equal(h.planner.current(p.plan,h.form,p.core),false);assert.equal(h.writes.length,0);});
test('A newer same-controller fixed plan closes an older captured plan before native write',async()=>{const h=await harness(),a=await h.capture(),b=await h.capture();assert.ok(b.plan);assert.equal(h.planner.current(a.plan,a.core.form,a.core),false);assert.equal(h.planner.current(b.plan,b.core.form,b.core),true);});
test('Transport rejection after actual mutation ingress preserves conservative unknown with no rollback or retry',async()=>{const h=await harness(),p=await h.start();h.state.docIntercept=call=>{if(call.payload)throw Error('Lost ACK');};const r=await h.run(p);assert.equal(r.status,'uncertain');assert.equal(r.nativeWriteEntered,true);assert.equal(r.evidence[0].acknowledged,false);assert.equal(h.controller.finish(p.attempt).status,'uncertain');assert.equal(h.controller.status().uncertainOwners,1);});
for(const phase of ['planner','executor'])test(`LAST private ${phase} SDK accessor returning same db but changing mode blocks native entry`,async()=>{
 const h=await harness();let fired=0;
 if(phase==='planner'){
  const r=await h.reader.prepare(h.form);assert.ok(r.ok);const core=h.core.captureClientEditCoreWriteWeb(h.controller,h.lease,h.result,h.form,['versorgung'],()=>true);
  h.state.privateSdkAccessor=()=>{if(++fired===2)h.state.mode='demo';};const before=h.calls.length;
  assert.equal(h.planner.capture(r.data,h.form,core),null);assert.equal(fired,2);assert.equal(h.calls.length,before);assert.equal(h.writes.length,0);
 }else{
  const p=await h.start();h.state.privateSdkAccessor=()=>{if(new Error().stack.includes('at gate (src/lib/clients/clientRecordEditCareDocumentWrite.web.ts')){fired++;h.state.mode='demo';}};
  const before=h.calls.length,r=await h.run(p);assert.equal(r.status,'uncertain');assert.equal(fired,1);assert.equal(h.calls.length,before);assert.equal(h.writes.length,1);
 }
});
test('Untrusted copied Core public form accessor is rejected before it executes or produces a fixed plan',async()=>{const h=await harness(),r=await h.reader.prepare(h.form);assert.ok(r.ok);let gets=0;const fake={sections:['versorgung']};Object.defineProperty(fake,'form',{enumerable:true,get(){gets++;return h.form;}});assert.equal(h.planner.capture(r.data,h.form,fake),null);assert.equal(gets,0);assert.equal(h.writes.length,0);});
test('Genuine minted Reader receipt from another actual native tenant/client cannot supply a private A successor plan',async()=>{
 const h=await harness();
 const bLoaded=new Function('native','own','actions','woundInstant','woundUuid','withServiceQueryTimeout','strip','readFileSync','read','assert',setup.replace(/const read=p=>[^\n]*\n/,'').replace(/id\(1\)/g,'id(11)').replace(/id\(3\)/g,'id(13)')+';return loaded;')(native,own,actions,woundInstant,woundUuid,withServiceQueryTimeout,strip,readFileSync,read,assert);
 const b=await bLoaded(),controller=new h.controller.constructor(()=>({original:b.original,editor:b.editor,ticket:b.ticket,actions:b.guard,canRead:()=>true,canEdit:()=>true,canSensitive:()=>true}));controller.mount();
 for(const [table,rows]of Object.entries(b.tables))h.tables[table]=[...(h.tables[table]??[]),...structuredClone(rows)];
 const lease=controller.captureRead();assert.ok(lease);const result=await h.editReader.fetchClientEditOriginalReadWeb(controller,lease);assert.equal(result.ok,true,result.error);
 h.tables.client_intake_documents.push({...structuredClone(h.tables.client_intake_documents[0]),tenant_id:id(11),client_id:id(13)});
 const bReader=new h.pre.ClientCareDocumentPreflightReader(controller,lease,result.data,h.permission);bReader.mount();
 const form={...structuredClone(result.data.form),careLevel:'pg3'},r=await bReader.prepare(form);assert.equal(r.ok,true,r.error);assert.equal(r.data.state,'append_only_prepared');
 assert.equal(bReader.current(r.data,form),true);
 const foreignPlanner=new h.plannerModule.ClientCareDocumentAppendPlanner(h.controller,h.lease,h.result,bReader,h.permission);foreignPlanner.mount();
 const core=h.core.captureClientEditCoreWriteWeb(h.controller,h.lease,h.result,h.form,['versorgung'],()=>true);
 assert.deepEqual(form,h.form);assert.equal(foreignPlanner.capture(r.data,h.form,core),null);assert.equal(h.writes.length,0);assert.equal(b.writes.length,0);
});
test('A genuine newer six-pool preparation invalidates the old fixed plan at the last pre-begin check',async()=>{const h=await harness(),p=await h.capture();assert.ok(p.plan);assert.ok((await h.reader.prepare(h.form)).ok);assert.equal(h.planner.current(p.plan,h.form,p.core),false);assert.equal(h.writes.length,0);});
for(const shape of ['missing_error','error_false','missing_data','data_array','missing_status','status_string','status_199','status_300','status_fraction','getter','symbol','hidden'])test(`Whole SDK response ${shape} never claims a complete intake ACK or retries`,async()=>{
 const h=await harness(),p=await h.start();let gets=0;
 h.state.docIntercept=call=>{if(!call.payload)return;const r={data:{...structuredClone(call.payload),id:id(3500),created_at:at,updated_at:at,finalized_html:null,rendered_pdf_path:null,finalized_at:null,generated_document_id:null},error:null,status:200};
  if(shape==='missing_error')delete r.error;if(shape==='error_false')r.error=false;if(shape==='missing_data')delete r.data;if(shape==='data_array')r.data=[r.data];if(shape==='missing_status')delete r.status;if(shape==='status_string')r.status='200';if(shape==='status_199')r.status=199;if(shape==='status_300')r.status=300;if(shape==='status_fraction')r.status=200.5;
  if(shape==='getter')Object.defineProperty(r.data,'extra',{enumerable:true,get(){gets++;return'unknown';}});if(shape==='symbol')r.data[Symbol('original')]='unknown';if(shape==='hidden')Object.defineProperty(r.data,'extra',{enumerable:false,value:'unknown'});return r;};
 const r=await h.run(p);assert.equal(r.status,'uncertain');assert.equal(r.evidence[0].acknowledged,false);assert.equal(gets,0);assert.equal(h.writes.length,2);const before=h.writes.length;assert.equal((await h.run(p)).status,'blocked');assert.equal(h.writes.length,before);
});
test('Copied positive Core DTO cannot replace the actual owned Core continuation outcome',async()=>{const h=await harness(),p=await h.start();const core={phase:'core',status:'acknowledged',writeStarted:true,patchedColumns:['care_level'],nativeResult:p.coreOutcome.nativeResult,currentAtReturn:true};assert.equal((await h.writer.executeClientCareDocumentAppendWeb(p.plan,p.attempt,core)).status,'blocked');assert.equal(h.writes.length,1);});
test('A genuine unchanged native care-level preflight cannot mint an append phase or a new agreement',async()=>{const h=await harness(),form=structuredClone(h.result.form),r=await h.reader.prepare(form);assert.equal(r.ok,true);assert.equal(r.data.state,'not_required');const core=h.core.captureClientEditCoreWriteWeb(h.controller,h.lease,h.result,form,['versorgung'],()=>true);assert.ok(core);assert.equal(h.planner.capture(r.data,form,core),null);assert.equal(h.writes.length,0);});
test('Several originals produce separate successors with all originals/signatures retained and six independent full ACKs',async()=>{const h=await harness();h.tables.client_intake_documents.push({...structuredClone(h.tables.client_intake_documents[0]),id:id(1004),version:7,created_at:'2026-10-08T10:00:00.123457+02:00'});const raw=structuredClone(h.tables.client_intake_documents),p=await h.start(),r=await h.run(p);assert.equal(r.status,'acknowledged');assert.equal(r.evidence.length,6);assert.equal(h.writes.length,7);assert.notEqual(h.writes[1].payload.template_key,h.writes[4].payload.template_key);assert.deepEqual(h.tables.client_intake_documents.slice(0,2),raw);assert.equal(h.tables.client_document_signatures.length,1);assert.equal(h.writes[4].payload.version,8);});
test('A fake preparation token does not traverse its untrusted state getter or make any native request',async()=>{const h=await harness();let gets=0;const fake={};Object.defineProperty(fake,'state',{enumerable:true,get(){gets++;return'append_only_prepared';}});const core=h.core.captureClientEditCoreWriteWeb(h.controller,h.lease,h.result,h.form,['versorgung'],()=>true);assert.equal(h.planner.capture(fake,h.form,core),null);assert.equal(gets,0);assert.equal(h.writes.length,0);});
test('Whole unselected signature original with raw metadata and unknown fields remains preserved, without a signature verification claim',async()=>{const h=await harness();h.tables.client_document_signatures.push(row(1005,{document_id:id(1000),signer_role:'legacy_unknown',signature_data:'',signed_at:{unknown:'unparsed original'},signer_name:null,unknown_fields:{at,undefinedValue:undefined}}));const raw=structuredClone(h.tables.client_document_signatures),p=await h.start(),r=await h.run(p);assert.equal(r.status,'acknowledged');assert.deepEqual(h.tables.client_document_signatures,raw);assert.equal(h.writes.some(w=>w.table==='client_document_signatures'),false);assert.equal(Object.hasOwn(r,'signatureVerified'),false);});
test('Malformed real native template INTEGER version is unsupported before Core, preserving the supplied original',async()=>{const h=await harness();h.system.version=2147483648;assert.equal((await h.capture()).plan,null);assert.equal(h.system.version,2147483648);assert.equal(h.writes.length,0);});
test('Final borrowed reader.current SDK accessor cannot mint a plan after mode loss even when same SDK is returned',async()=>{
 const h=await harness(),r=await h.reader.prepare(h.form);assert.ok(r.ok);const core=h.core.captureClientEditCoreWriteWeb(h.controller,h.lease,h.result,h.form,['versorgung'],()=>true);
 let reads=0,fired=0;h.state.privateSdkAccessor=()=>{if(new Error().stack.includes('ClientCareDocumentPreflightReader.current')&&++reads===2){fired++;h.state.mode='demo';}};
 assert.equal(h.planner.capture(r.data,h.form,core),null);assert.equal(fired,1);assert.equal(h.state.mode,'demo');assert.equal(h.writes.length,0);
});
