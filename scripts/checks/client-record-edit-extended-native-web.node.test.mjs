import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes as strip} from 'node:module';
import * as native from '../../src/lib/clients/clientRecordNativeOriginal.web.ts';
import * as own from '../../src/lib/clients/clientRecordRead.web.ts';
import * as actions from '../../src/lib/clients/clientRecordActions.web.ts';
import {woundInstant,woundUuid} from '../../src/lib/pflege/woundCareDomain.ts';
import {withServiceQueryTimeout} from '../../src/lib/services/queryTimeout.ts';
const read=p=>readFileSync(new URL('../../'+p,import.meta.url),'utf8');
const body=p=>strip(read(p).replace(/^import[\s\S]*?;\n/gm,'').replace(/\bexport /g,''));
const compose=(p,deps,names)=>new Function(...Object.keys(deps),body(p)+';return {'+names.join(',')+'};')(...Object.values(deps));
const {EMPTY_CLIENT_INTAKE_FORM}=compose('src/types/forms/clientIntakeForm.ts',{},['EMPTY_CLIENT_INTAKE_FORM']);
const {EMPTY_CLIENT_EDIT_FORM}=compose('src/types/forms/clientEditForm.ts',{},['EMPTY_CLIENT_EDIT_FORM']);
const {splitStreetLine}=compose('src/lib/clients/clientEditAddressUtils.ts',{},['splitStreetLine']);
const {parseHomeAccessStoredValue,serializeHomeAccessValues}=compose('src/lib/clients/clientIntakeHomeAccess.ts',{},['parseHomeAccessStoredValue','serializeHomeAccessValues']);
const sharedIntake=compose('src/lib/clients/clientIntakeFormMappers.ts',{EMPTY_CLIENT_INTAKE_FORM,createEmptyIntakeForm:()=>({...EMPTY_CLIENT_INTAKE_FORM}),splitStreetLine,parseHomeAccessStoredValue},['mapClientEditLoadToIntakeForm']);
const date=compose('src/lib/clients/clientIntakeEditOriginalForm.web.ts',{...native,...own,woundInstant,mapSharedForm:sharedIntake.mapClientEditLoadToIntakeForm},['captureClientIntakeEditOriginalForm']);
const edit=compose('src/lib/clients/clientEditFormMappers.ts',{EMPTY_CLIENT_EDIT_FORM,splitStreetLine},['mapClientToEditForm','mapClientEditRawFields']);
const address=compose('src/lib/clients/clientAddressResolver.ts',compose('src/lib/formatAddress.ts',{},['formatStreetLine']),['mergeClientAddresses','resolveClientPhone','resolveClientStreetLine']);
const contact=compose('src/lib/clients/clientContactPayload.ts',{},['resolveClientContactDisplayName','resolveClientContactIsEmergency','resolveClientContactType']);
const status=compose('src/lib/services/workflow/clientStatus.ts',{},['CLIENT_STATUS_HINTS','getAllowedStatusActions']);
const bridge=compose('src/lib/services/clients/clientStatusBridge.ts',{},['remoteStatusToWorkflow','workflowStatusToRemote']);
const care=compose('src/lib/clients/clientIntakeCareLevel.ts',{},['normalizeIntakeCareLevelForDb']);
const base=compose('src/lib/supabase/mappers/clientMapper.ts',{...address,...contact,...status,...bridge},['mapClientDetail']);
const office=compose('src/lib/office/officeDocumentDisplay.ts',{getSystemIntakeTemplateByKey:()=>null,CLIENT_DOCUMENT_CATEGORY_LABELS:{},PORTAL_DOCUMENT_CATEGORY_LABELS:{}},['isIntakeTemplateFileName','resolveIntakeTemplateKey','isTechnicalIntakeDocumentTitle']);
const merge=compose('src/lib/clients/clientDocumentMerge.ts',office,['mergeClientRecordDocuments','mapIntakeDocumentRow']);
const mapper=compose('src/lib/supabase/mappers/clientExtendedMapper.ts',{...address,...base,...merge,...contact},['mapClientFullDetail']);
const {CLIENT_MASTER_DATA_SECTION_KEYS}=compose('src/lib/clients/clientMasterDataSections.ts',{},['CLIENT_MASTER_DATA_SECTION_KEYS']);
const {isPortalModuleKey}=compose('src/lib/portal/engine/portalModuleKeys.ts',{},['isPortalModuleKey']);
const {normalizeClientFundingSources}=compose('src/types/clients/clientFundingSource.ts',{},['normalizeClientFundingSources']);
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const at='2026-10-08 10:00:00.123456+00:00';
const row=(n,extra={})=>({id:id(n),tenant_id:id(1),client_id:id(3),created_at:at,updated_at:at,...extra});
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return{promise,resolve};};
async function harness(options={}){
 const state={canRead:true,canEdit:true,canSensitive:options.sensitive!==false,mode:'supabase',cap:1,...options};
 const root={id:id(3),tenant_id:id(1),first_name:'Original',last_name:'Klient',status:'active',lifecycle_status:'aktiv',salutation:null,gender:null,date_of_birth:'1999-03-17',admission_date:'2000-02-29',service_start:'2011-02-08',housing_form:null,special_notes:' Original notes ',notes:' Original notes ',preferred_contact:null,street:'Original Street 4',postal_code:'12345',zip:'12345',city:'Original City',phone:null,email:null,care_level:'pg2',insurance_number:'NATIVE-SECRET',key_safe_code:'CORE-SECRET',diagnoses:['Original diagnosis'],apartment_number:null,mobility_notes:null,visible_notes_for_employee:null,emergency_notes:null,key_management_notes:null,created_at:at,updated_at:at,raw_unmapped:{optional:undefined,history:['old','new'],nil:null,flag:false,value:0}};
 if(Object.hasOwn(state,'nativeStatus'))root.status=state.nativeStatus;
 Object.assign(root,state.nativeCorePatch??{});
 const tables={clients:[root],...Object.fromEntries(Object.values(native.CLIENT_RECORD_NATIVE_POOLS).map(table=>[table,[]])),client_care_contexts:[row(20,{context_key:'ambulatory_care',is_primary:true})],client_support_preferences:[row(30,{support_wishes:['Original'],preferred_times:[],excluded_times:[],mobility:null,orientation:null,communication:null,special_wishes:null,raw_unknown:{history:['b','a'],optional:undefined}})],client_ambulatory_details:[row(31,{home_access:'key_safe',key_status:null,key_number:null,key_safe_code:'SAFE-SECRET',door_code:'DOOR-SECRET',bell_name:null,floor:null,elevator_available:false,parking_notes:null,access_notes:null,hazard_notes:null,pets:null,smoker_household:false,aids_on_site:null,hygiene_notes:null,infection_notes:null,family_doctor:null})],client_stationary_details:[],client_insurance_profiles:[row(32,{care_level:'pg2',care_level_status:null,care_level_valid_from:'2022-04-09',care_level_applied:false,decision_available:false,care_fund_name:null,health_insurance:null,cost_bearer_ik:null,insurance_number:'INSURANCE-SECRET',billing_type:null,self_pay:false,relief_budget_prepared:false,substitution_prepared:false,prevention_prepared:false,is_primary:true})],client_module_assignments:[],client_funding_selections:[row(33,{sources:['selbstzahler','entlastungsleistung'],effective_from:'2026-10-08',replaced_at:null,created_by:id(2),unknown:{time:at,optional:undefined}})],client_care_entitlement:[],client_service_entitlements:[]};
 state.beforeReadTables?.(tables);
 tables.client_history_entries=Array.from({length:3},(_,i)=>row(100+i,{title:'Native '+i,status:'active',actor_name:'Original',raw_history:{sequence:i,at}}));
 const calls=[],writes=[],coreWrites=[],rpcCalls=[];
 const db={from(table){let columns='*',single=false,limit=200,cursor=null,payload=null,mode='select';const filters=[];
  const q={select(value){columns=value;(mode==='select'?state.builder:state.writeSelect)?.({table,columns,payload});return q;},eq(k,v){filters.push([k,v]);return q;},is(k,v){filters.push([k,v]);return q;},single(){single=true;return q;},order(k,options){assert.equal(k,'id');assert.equal(options.ascending,true);return q;},limit(n){limit=n;return q;},gt(k,v){assert.equal(k,'id');cursor=v;return q;},then(resolve,reject){const call={table,mode,columns,filters:structuredClone(filters),cursor,single,current:state.canRead&&state.canEdit,payload};(mode==='select'?calls:table==='clients'?coreWrites:writes).push(call);return Promise.resolve().then(async()=>{
   const intercepted=await (mode==='select'?state.intercept?.(call):state.writeIntercept?.(call));if(intercepted!==undefined)return intercepted;
   let rows=(tables[table]??[]).filter(r=>filters.every(([k,v])=>r[k]===v));
   if(mode==='update'){rows.forEach(r=>Object.assign(r,structuredClone(payload)));state.updatedRows=(state.updatedRows??0)+rows.length;}
   if(mode==='insert'){rows=[row(1000+writes.length,{...structuredClone(payload),created_at:at})];(tables[table]??=[]).push(rows[0]);}
   rows=[...rows].sort((a,b)=>a.id.localeCompare(b.id));if(cursor)rows=rows.filter(r=>r.id>cursor);rows=rows.slice(0,Math.min(limit,state.cap));if(columns!=='*'){const keys=columns.split(',').map(v=>v.trim());rows=rows.map(r=>Object.fromEntries(Object.entries(r).filter(([k])=>keys.includes(k))));}
   return{data:single?rows[0]??null:rows,error:null,status:mode==='insert'?201:200,statusText:'OK'};
  }).then(resolve,reject);}};
  const execute=q.then;Object.defineProperty(q,'then',{get(){(mode==='select'?state.thenAccessor:state.writeThenAccessor)?.({table,columns,payload});return execute;}});
  q.update=value=>{mode='update';payload=value;state.writeBuilder?.({table,payload});return q;};q.insert=value=>{mode='insert';payload=value;state.writeBuilder?.({table,payload});return q;};for(const method of ['upsert','delete'])q[method]=()=>{writes.push({table,method});throw Error('The private phase cannot delete original history');};return q;},rpc(...args){rpcCalls.push(args);throw Error('No RPC or default seed is permitted');}};
 const common={...native,getSupabaseClient:()=>state.noSdk?null:db,fromUnknownTable:(sdk,table)=>sdk.from(table),toGermanSupabaseError:e=>e?.message??'Native error',withServiceQueryTimeout};
 const originalReader=compose('src/lib/clients/clientRecordOriginalRead.web.ts',{...common,mapClientFullDetail:mapper.mapClientFullDetail},['fetchClientOriginalReadWeb']);
 const assertNativeRead=()=>{if(!state.canRead)throw Error('Current read denied');};
 const recordSource=await originalReader.fetchClientOriginalReadWeb(id(1),id(3),{canViewSensitive:state.canSensitive,assertCurrentRead:assertNativeRead,includeCareContexts:true});
 const fullSource=await originalReader.fetchClientOriginalReadWeb(id(1),id(3),{canViewSensitive:state.canSensitive,assertCurrentRead:assertNativeRead});
 assert.equal(recordSource.ok,true);assert.equal(fullSource.ok,true);
 const scope=own.clientParentReadScope({clientId:id(3),userId:id(2),profileId:id(2),profileTenant:id(1),profileRole:'business_admin',serviceTenant:id(1),runtimeTenant:id(1),runtimeRole:'business_admin',portalSession:false,canRead:true,canEdit:true,canSensitive:state.canSensitive});
 const owner={generation:1};
 let original={scopeKey:scope.key,owner,recordTicket:1,fullTicket:1,scope:Object.freeze(scope),record:own.captureClientParentRecord({detail:recordSource.data.detail,careContexts:recordSource.data.careContexts,tabs:['overview']},scope),full:own.captureClientParentDetail(fullSource.data.detail,scope),recordNative:recordSource.data.originals,fullNative:fullSource.data.originals};
 const guard=new actions.ClientRecordActionGuard();guard.mount();
 const editor={},refresh=()=>{guard.update({original,liveOriginal:()=>state.canRead?original:null,livePermission:()=>state.canEdit,canEdit:true,canDelete:true,canArchive:true});};refresh();let ticket=guard.capture('edit');assert.ok(ticket);
 let reader;
 const {ClientRecordEditController}=compose('src/lib/clients/clientRecordEditController.web.ts',{...native,...own,...actions,CLIENT_MASTER_DATA_SECTION_KEYS,isOwnClientEditOriginalRead:(...args)=>reader.isOwnClientEditOriginalRead(...args)},['ClientRecordEditController']);
 const controller=new ClientRecordEditController(()=>({original,editor:state.editor??editor,ticket,actions:guard,canRead:()=>state.canRead,canEdit:()=>state.canEdit,canSensitive:()=>state.canSensitive}));controller.mount();
 const carrierOriginal=compose('src/lib/clients/clientRecordEditCarrierOriginal.web.ts',{...native,woundUuid,woundInstant},['CLIENT_EDIT_CARRIER_POOLS','captureClientEditCarrierPage','captureClientEditCarrierOriginals']);
 const carrier=compose('src/lib/clients/clientRecordEditCarrierRead.web.ts',{...common,...carrierOriginal,ClientRecordEditController,getServiceMode:()=>state.mode},['fetchClientEditCarrierReadWeb','recognizesClientEditCarrierRuntime']);
 const carrierTypes=compose('src/features/costCarriers/costCarrierTypes.ts',{},['UI_TO_DB_CARRIER_TYPE']);
 const carrierFields=compose('src/lib/clients/clientRecordEditCarrierFields.web.ts',{...native,...carrierOriginal,...carrierTypes},['captureClientEditCarrierFields']);
 reader=compose('src/lib/clients/clientRecordEditRead.web.ts',{...common,...edit,...date,...carrier,...carrierFields,parseHomeAccessStoredValue,isPortalModuleKey,normalizeClientFundingSources,getServiceMode:()=>state.mode},['fetchClientEditOriginalReadWeb','isOwnClientEditOriginalRead']);
 const billing=compose('src/lib/clients/clientIntakeBilling.ts',{},['resolveIntakeBillingProfileType']);
 const funding=compose('src/lib/clients/clientIntakeCostBearerConfig.ts',{},['resolvePrimaryCostBearerName','resolvePrimaryCostBearerReference']);
 const planner=compose('src/lib/clients/clientRecordEditExtendedPlan.web.ts',{...native,woundInstant,woundUuid,CLIENT_MASTER_DATA_SECTION_KEYS,parseHomeAccessStoredValue,serializeHomeAccessValues,...billing,...funding},['planClientEditExtendedWeb']);
 const core=compose('src/lib/clients/clientRecordEditCoreWrite.web.ts',{...common,...care,...funding,...bridge,...native,CLIENT_MASTER_DATA_SECTION_KEYS,getServiceMode:()=>state.mode,isOwnClientEditOriginalRead:reader.isOwnClientEditOriginalRead},['captureClientEditCoreWriteWeb','executeClientEditCoreWriteWeb','mayContinueClientEditCoreWriteWeb']);
 const extended=compose('src/lib/clients/clientRecordEditExtendedWrite.web.ts',{...common,...planner,...core,woundInstant,getServiceMode:()=>state.mode,isOwnClientEditOriginalRead:reader.isOwnClientEditOriginalRead},['captureClientEditExtendedWriteWeb','executeClientEditExtendedWriteWeb','mayContinueClientEditExtendedWriteWeb']);
 const initCalls=calls.splice(0);
 return{extended,planner,core,state,tables,calls,writes,coreWrites,rpcCalls,initCalls,controller,guard,owner,scope,reader,editor,get original(){return original;},get ticket(){return ticket;},read:async lease=>reader.fetchClientEditOriginalReadWeb(controller,lease??controller.captureRead()),refreshOriginal(change={}){original={...original,...change};refresh();ticket=guard.capture('edit');},dispose(){controller.dispose();guard.dispose();},regrant(){state.canRead=true;state.canEdit=true;state.canSensitive=scope.canSensitive;refresh();ticket=guard.capture('edit');},updateGuard:refresh};
}
async function loaded(options={}){const h=await harness(options),lease=h.controller.captureRead();assert.ok(lease);const result=await h.read(lease);assert.equal(result.ok,true,result.error);return{...h,lease,result:result.data};}
function begin(h,section='stammdaten',patch={}){return h.controller.begin(h.lease,{...structuredClone(h.result.form),...patch},[section]);}

// Whole local Source/Reader/Controller/Core/Extended composition. Current
// permission functions/SDK leaves are controlled primitives, not native Auth,
// React/SQL/RLS or a complete future WholeSave claim.
function capture(h,patch={},sections=['versorgung'],currentOutcome) {
 const form={...structuredClone(h.result.form),...patch};
 let plan;try{plan=h.planner.planClientEditExtendedWeb(h.result,form,sections);}catch{return null;}
 h.coreIntent=plan.coreRequired?h.core.captureClientEditCoreWriteWeb(h.controller,h.lease,h.result,form,sections,()=>h.state.canChangeStatus!==false):null;
 const binding=plan.coreRequired&&h.coreIntent?{intent:h.coreIntent,currentOutcome:currentOutcome??(()=>h.coreOutcome??null)}:null;
 return h.extended.captureClientEditExtendedWriteWeb(h.controller,h.lease,h.result,form,sections,binding,()=>h.state.contactsManage!==false);
}
function start(h,intent){assert.ok(intent);const attempt=h.controller.begin(h.lease,intent.form,intent.sections);assert.ok(attempt);return attempt;}
async function execute(h,patch={},sections=['versorgung']){const intent=capture(h,patch,sections),attempt=start(h,intent);if(h.coreIntent)h.coreOutcome=await h.core.executeClientEditCoreWriteWeb(h.coreIntent,attempt);const outcome=await h.extended.executeClientEditExtendedWriteWeb(intent,attempt);return{intent,attempt,outcome};}
const billingRow=()=>row(41,{billing_type:'pflegekasse',hourly_rate_cents:7777,service_type:'sachleistung',cost_bearer_name:null,cost_bearer_reference:null,invoice_recipient:null,notes:'pflegekasse',payment_terms_days:30});
const careRow=()=>row(42,{grade:'pg2',valid_from:'2022-04-09',valid_until:null,care_fund_name:'Original Fonds',care_fund_member_id:'NATIVE-SECRET',md_assessment_date:null,notes:null});
const doctorRow=()=>row(43,{first_name:'Native',last_name:'Doctor',contact_type:'doctor',relationship:'arzt',phone:'01234',email:'original@example.invalid',notes:'Raw Original',created_by:id(2)});
function validAddress(tables){tables.client_addresses=[row(44,{address_type:'hauptwohnsitz',street:'Original Street 4',zip:'12345',city:'Original City',country:'DE',is_primary:true,access_notes:null,floor:null,door_code:null,apartment_number:null})];}

test('Actual own orientation-only plan dispatches one change-only native row with exact µs versionguard and full originals',async()=>{
 const h=await loaded(),before=structuredClone(h.result.originals),{intent,attempt,outcome}=await execute(h,{orientation:'New orientation'});
 assert.equal(outcome.phase,'extended');assert.equal(outcome.status,'acknowledged');assert.equal(outcome.currentAtReturn,true);assert.equal(h.writes.length,1);
 assert.deepEqual(h.writes[0].payload,{orientation:'New orientation'});assert.deepEqual(h.writes[0].filters,[['id',id(30)],['tenant_id',id(1)],['client_id',id(3)],['updated_at',at],['orientation',null]]);
 assert.equal(h.writes[0].columns,'*');assert.equal(outcome.acknowledgements.length,1);assert.deepEqual(h.result.originals,before);
 const acknowledged=outcome.acknowledgements[0].nativeResult.data;assert.equal(acknowledged.created_at,at);assert.equal(acknowledged.updated_at,at);assert.deepEqual(acknowledged.raw_unknown,{history:['b','a'],optional:undefined});
 assert.ok(Object.isFrozen(acknowledged.raw_unknown.history));assert.equal(Object.hasOwn(intent,'originals'),false);assert.equal(h.extended.mayContinueClientEditExtendedWriteWeb(intent,attempt,outcome),true);
 assert.equal(h.controller.status().pending,true);assert.equal(h.rpcCalls.length,0);assert.deepEqual(outcome.requiredOtherPhases,[]);
});
for(const [field,value]of [['supportWishes',['New A','New B']],['preferredTimes',['Original exact']],['excludedTimes',[]],['mobility','New mobility'],['communication','New communication']])test(`Explicit support ${field} changes no unrelated billing/sensitive/native fields`,async()=>{
 const h=await loaded();if(Array.isArray(value)&&JSON.stringify(value)!==JSON.stringify(h.result.form[field])){assert.equal(capture(h,{[field]:value}),null);assert.equal(h.writes.length+h.coreWrites.length,0);return;}const {outcome}=await execute(h,{[field]:value});assert.equal(outcome.status,'acknowledged');assert.ok(h.writes.length<=1);assert.ok(h.writes.every(call=>call.table==='client_support_preferences'));assert.equal(h.tables.client_ambulatory_details[0].door_code,'DOOR-SECRET');assert.equal(h.tables.client_insurance_profiles[0].insurance_number,'INSURANCE-SECRET');
});
test('Ambulatory explicit key change preserves untouched sensitive value, original home representation and full metadata',async()=>{
 const h=await loaded(),{outcome}=await execute(h,{keyNumber:'New key'},['notfall_zugang']);assert.equal(outcome.status,'acknowledged');assert.equal(h.writes.length,1);assert.deepEqual(h.writes[0].payload,{key_number:'New key'});assert.equal(outcome.nativeResult.data.key_safe_code,'SAFE-SECRET');assert.equal(outcome.nativeResult.data.door_code,'DOOR-SECRET');assert.equal(outcome.nativeResult.data.home_access,'key_safe');
});
test('Changed home selection uses explicit unambiguous serializer; unchanged raw value was never rewritten',async()=>{
 const h=await loaded(),{outcome}=await execute(h,{homeAccess:['key_safe','client_opens']},['notfall_zugang']);assert.equal(outcome.status,'acknowledged');assert.deepEqual(h.writes[0].payload,{home_access:'key_safe,client_opens'});assert.equal(h.result.originals.pools.client_ambulatory_details[0].home_access,'key_safe');
});
for(const value of [['bad,ambiguous'],[' padded '],['']])test('Ambiguous new home selection denied before any native mutation '+JSON.stringify(value),async()=>{const h=await loaded();assert.equal(capture(h,{homeAccess:value},['notfall_zugang']),null);assert.equal(h.writes.length,0);assert.equal(h.controller.status().pending,false);});
test('Existing native address target change preserves access originals and exact native UUID',async()=>{
 const h=await loaded({nativeCorePatch:{mobile:null},beforeReadTables:validAddress}),{outcome}=await execute(h,{city:'Changed City'},['adresse_kontakt']);assert.equal(outcome.status,'acknowledged');assert.deepEqual(h.writes[0].payload,{city:'Changed City'});assert.equal(outcome.nativeResult.data.id,id(44));assert.equal(outcome.nativeResult.data.door_code,null);assert.equal(outcome.nativeResult.data.street,'Original Street 4');
});
test('Genuinely absent address row has no verified complete insert contract and cannot be silently skipped',async()=>{
 const h=await loaded({nativeCorePatch:{mobile:null}});assert.equal(capture(h,{city:'New City'},['adresse_kontakt']),null);assert.equal(h.writes.length,0);
});
test('Existing explicit Carelevel DATE and grade changes preserve untouched validity/history and list every required future phase',async()=>{
 const h=await loaded({beforeReadTables:t=>{t.client_care_levels=[careRow()];}}),{outcome}=await execute(h,{careLevel:'pg3',careLevelValidFrom:'2024-02-29'});
 assert.equal(outcome.status,'acknowledged');assert.deepEqual(h.writes[0].payload,{grade:'pg3',valid_from:'2024-02-29'});assert.equal(outcome.nativeResult.data.created_at,at);assert.equal(outcome.nativeResult.data.valid_until,null);assert.equal(h.result.original.fullNative.parts.careLevels[0].valid_from,'2022-04-09');assert.deepEqual(outcome.requiredOtherPhases,['care_documents']);
});
for(const value of ['2024-02-30','2024-13-01','','2024-02-29T00:00:00Z'])test('Invalid/missing date never comes from serviceStart/admission/current time '+value,async()=>{const h=await loaded({beforeReadTables:t=>{t.client_care_levels=[careRow()];}});assert.equal(capture(h,{careLevelValidFrom:value}),null);assert.equal(h.writes.length,0);});
test('Missing required carelevel target blocks a combined orientation edit before ALL steps',async()=>{const h=await loaded();assert.equal(capture(h,{orientation:'New orientation',careLevel:'pg3'}),null);assert.equal(h.writes.length,0);assert.equal(h.controller.status().pending,false);});
test('Native Carelevel member conflicting with UI/core source blocks before any combined mutation',async()=>{
 const h=await loaded({beforeReadTables:t=>{t.client_care_levels=[{...careRow(),grade:'pg4'}];}});assert.equal(capture(h,{careLevel:'pg3',orientation:'New orientation'}),null);assert.equal(h.writes.length,0);
});
test('Doctor name update keeps phone/email/relationship and separately patches exact ambulatory original',async()=>{
 const h=await loaded({beforeReadTables:t=>{t.client_contacts=[doctorRow()];t.client_ambulatory_details[0].family_doctor='Native Doctor';}}),{outcome}=await execute(h,{familyDoctor:'Changed Doctor'});
 assert.equal(outcome.status,'acknowledged');assert.equal(h.writes.length,2);assert.deepEqual(h.writes[0].payload,{first_name:'Changed',last_name:'Doctor'});assert.deepEqual(h.writes[1].payload,{family_doctor:'Changed Doctor'});
 assert.equal(outcome.acknowledgements[0].nativeResult.data.phone,'01234');assert.equal(outcome.acknowledgements[0].nativeResult.data.email,'original@example.invalid');assert.equal(outcome.acknowledgements[0].nativeResult.data.created_by,id(2));
});
test('Conflicting doctor/ambulatory target denies full preflight instead of losing the second mapping',async()=>{
 const h=await loaded({beforeReadTables:t=>{t.client_contacts=[doctorRow()];t.client_ambulatory_details[0].family_doctor='Hidden other doctor';}});assert.equal(capture(h,{familyDoctor:'New Doctor'}),null);assert.equal(h.writes.length,0);
});
for(const patch of [{familyDoctor:'New Doctor'},{familyDoctor:''}])test('Absent doctor creation/deletion unsupported before all mutation '+JSON.stringify(patch),async()=>{const h=await loaded(patch.familyDoctor===''?{beforeReadTables:t=>{t.client_contacts=[doctorRow()];t.client_ambulatory_details[0].family_doctor='Native Doctor';}}:{});assert.equal(capture(h,patch),null);assert.equal(h.writes.length,0);});
test('Stationary explicit room patch keeps all unselected native agreement fields and µs',async()=>{
 const h=await loaded({beforeReadTables:t=>{t.client_stationary_details=[row(45,{facility_name:'Original Home',care_area:null,room_number:'Original room',admission_date:'1998-03-17',primary_nurse:'Native nurse',room_status:'Native original'})];}}),{outcome}=await execute(h,{roomNumber:'New room'},['notfall_zugang']);assert.equal(outcome.status,'acknowledged');assert.deepEqual(h.writes[0].payload,{room_number:'New room'});assert.equal(outcome.nativeResult.data.admission_date,'1998-03-17');assert.equal(outcome.nativeResult.data.primary_nurse,'Native nurse');
});
for(const patch of [{careContexts:[]},{careContexts:['support_care']},{careContexts:['support_care','ambulatory_care']}])test('No context removal/replacement/reordering or recreated original identity '+JSON.stringify(patch),async()=>{
 const h=await loaded({beforeReadTables:t=>{t.client_billing_profiles=[billingRow()];}});assert.equal(capture(h,patch,['leistungsart']),null);assert.equal(h.writes.length,0);
});
test('Appending native context preserves existing ID/µs/primary and checks whole server-native insertion ACK',async()=>{
 const h=await loaded({beforeReadTables:t=>{t.client_billing_profiles=[billingRow()];}}),{intent,attempt,outcome}=await execute(h,{careContexts:['ambulatory_care','support_care']},['leistungsart']);assert.equal(outcome.status,'acknowledged');assert.equal(h.writes.length,1);assert.equal(h.writes[0].mode,'insert');assert.deepEqual(h.writes[0].payload,{tenant_id:id(1),client_id:id(3),context_key:'support_care',is_primary:false});assert.equal(h.tables.client_care_contexts[0].id,id(20));assert.equal(h.tables.client_care_contexts[0].created_at,at);assert.equal(h.tables.client_care_contexts[0].is_primary,true);assert.notEqual(outcome.nativeResult.data.id,id(20));assert.deepEqual(outcome.requiredOtherPhases,['client_core_context']);assert.equal(h.extended.mayContinueClientEditExtendedWriteWeb(intent,attempt,outcome),true);assert.equal(h.controller.status().pending,true);
});
test('Required missing billing target denies context addition before first INSERT',async()=>{const h=await loaded();assert.equal(capture(h,{careContexts:['ambulatory_care','support_care']},['leistungsart']),null);assert.equal(h.writes.length,0);});
for(const loss of ['canRead','canEdit','canSensitive'])test('Current '+loss+' before held execute blocks without SDK mutation and never revives same original',async()=>{
 const h=await loaded(),intent=capture(h,{orientation:'New'}),attempt=start(h,intent);h.state[loss]=false;const denied=await h.extended.executeClientEditExtendedWriteWeb(intent,attempt);assert.equal(denied.status,'blocked');assert.equal(h.writes.length,0);h.regrant();assert.equal((await h.extended.executeClientEditExtendedWriteWeb(intent,attempt)).status,'blocked');assert.equal(h.writes.length,0);
});
for(const phase of ['writeBuilder','writeThenAccessor','writeSelect'])test('Read closes during actual '+phase+' before nativeThen; conservative own attempt kept',async()=>{
 const h=await loaded(),intent=capture(h,{orientation:'New'}),attempt=start(h,intent);h.state[phase]=()=>{h.state.canRead=false;};const result=await h.extended.executeClientEditExtendedWriteWeb(intent,attempt);assert.equal(result.status,'uncertain');assert.equal(result.writeStarted,true);assert.equal(h.writes.length,0);assert.equal(h.controller.status().pending,true);assert.equal(h.extended.mayContinueClientEditExtendedWriteWeb(intent,attempt,result),false);
});
for(const change of [()=>true,async()=>undefined,()=>{throw Error('closed');}])test('Actual Core outcome accessor cannot mint a receipt from truthy/async/throw',async()=>{
 const h=await loaded(),intent=capture(h,{firstName:'New'},['stammdaten'],change),attempt=start(h,intent);assert.equal((await h.extended.executeClientEditExtendedWriteWeb(intent,attempt)).status,'blocked');assert.equal(h.writes.length,0);
});
test('Revocation after a positive final SDK result keeps strict native ACK facts and denies followups/retry',async()=>{
 const h=await loaded(),intent=capture(h,{orientation:'New'}),attempt=start(h,intent);h.state.writeIntercept=call=>{h.state.canRead=false;return{data:{...structuredClone(h.tables.client_support_preferences[0]),...call.payload},error:null,status:200};};const result=await h.extended.executeClientEditExtendedWriteWeb(intent,attempt);assert.equal(result.status,'acknowledged');assert.equal(result.currentAtReturn,false);assert.equal(result.acknowledgements.length,1);assert.equal(h.extended.mayContinueClientEditExtendedWriteWeb(intent,attempt,result),false);h.regrant();assert.equal(h.extended.mayContinueClientEditExtendedWriteWeb(intent,attempt,result),false);assert.equal((await h.extended.executeClientEditExtendedWriteWeb(intent,attempt)).status,'blocked');assert.equal(h.writes.length,1);
});
test('After confirmed first doctor ACK current loss prevents second amb mutation but retains that native fact',async()=>{
 const h=await loaded({beforeReadTables:t=>{t.client_contacts=[doctorRow()];t.client_ambulatory_details[0].family_doctor='Native Doctor';}}),intent=capture(h,{familyDoctor:'New Doctor'}),attempt=start(h,intent);h.state.writeIntercept=call=>{h.state.canEdit=false;return{data:{...structuredClone(h.tables.client_contacts[0]),...call.payload},error:null,status:200};};const result=await h.extended.executeClientEditExtendedWriteWeb(intent,attempt);assert.equal(result.status,'partial');assert.equal(result.acknowledgements.length,1);assert.equal(result.currentAtReturn,false);assert.equal(h.writes.length,1);assert.equal(h.tables.client_ambulatory_details[0].family_doctor,'Native Doctor');
});
for(const fault of ['missingError','falseError','missingStatus','foreignTenant','foreignClient','foreignID','missingOriginal','changedHistory','changedMicrosecond'])test('Whole native '+fault+' ACK is uncertain, not partial success or automatic retry',async()=>{
 const h=await loaded(),intent=capture(h,{orientation:'New'}),attempt=start(h,intent);h.state.writeIntercept=call=>{const result={data:{...structuredClone(h.tables.client_support_preferences[0]),...call.payload},error:null,status:200};if(fault==='missingError')delete result.error;if(fault==='falseError')result.error=false;if(fault==='missingStatus')delete result.status;if(fault==='foreignTenant')result.data.tenant_id=id(9);if(fault==='foreignClient')result.data.client_id=id(9);if(fault==='foreignID')result.data.id=id(9);if(fault==='missingOriginal')delete result.data.raw_unknown;if(fault==='changedHistory')result.data.raw_unknown.history.reverse();if(fault==='changedMicrosecond')result.data.created_at='2026-10-08 10:00:00.123457+00:00';return result;};const result=await h.extended.executeClientEditExtendedWriteWeb(intent,attempt);assert.equal(result.status,'uncertain');assert.equal(result.acknowledgements.length,0);assert.equal(h.writes.length,1);assert.equal((await h.extended.executeClientEditExtendedWriteWeb(intent,attempt)).status,'blocked');assert.equal(h.writes.length,1);assert.equal(h.controller.status().pending,true);
});
test('Native row changed by one original µs denies equality-guarded match and records uncertainty without fallback',async()=>{
 const h=await loaded(),intent=capture(h,{orientation:'New'}),attempt=start(h,intent);h.tables.client_support_preferences[0].updated_at='2026-10-08 10:00:00.123457+00:00';const result=await h.extended.executeClientEditExtendedWriteWeb(intent,attempt);assert.equal(result.status,'uncertain');assert.equal(h.state.updatedRows,0);assert.equal(h.writes.length,1);assert.equal(h.tables.client_support_preferences[0].orientation,null);assert.equal(h.controller.status().pending,true);
});
test('Reentrant whole input capture closes own read before begin/all mutation',async()=>{const h=await loaded(),input=new Proxy({...structuredClone(h.result.form),orientation:'New'},{ownKeys(target){h.state.canRead=false;return Reflect.ownKeys(target);}});assert.equal(h.extended.captureClientEditExtendedWriteWeb(h.controller,h.lease,h.result,input,['versorgung'],null,()=>true),null);assert.equal(h.writes.length,0);assert.equal(h.controller.status().pending,false);});
test('Opaque intent/attempt/reader substitutions cannot grant a native phase',async()=>{
 const h=await loaded(),intent=capture(h,{orientation:'New'}),attempt=start(h,intent);assert.equal((await h.extended.executeClientEditExtendedWriteWeb({...intent},attempt)).status,'blocked');assert.equal((await h.extended.executeClientEditExtendedWriteWeb(intent,{...attempt})).status,'blocked');assert.equal(h.writes.length,0);
});
test('A Core-only identity change carries zero Extended SDK writes and does not release the whole-save journal',async()=>{
 const h=await loaded(),{intent,attempt,outcome}=await execute(h,{firstName:'New'},['stammdaten']);assert.equal(outcome.status,'acknowledged');assert.equal(outcome.writeStarted,false);assert.equal(outcome.acknowledgements.length,0);assert.equal(h.writes.length,0);assert.equal(h.controller.status().pending,true);assert.equal(h.extended.mayContinueClientEditExtendedWriteWeb(intent,attempt,outcome),true);
});

for(const field of ['phone','mobile','email','preferredContact'])test('Unimplemented '+field+' plus valid address change rejects whole preflight before begin or Core mutation',async()=>{
 const h=await loaded({nativeCorePatch:{mobile:null},beforeReadTables:validAddress});assert.equal(capture(h,{city:'New City',[field]:'New'},['adresse_kontakt']),null);assert.equal(h.writes.length+h.coreWrites.length,0);assert.equal(h.controller.status().pending,false);
});
for(const field of ['fundingSources','billingType','costBearerType','careFundStreet','healthInsuranceIk'])test('Missing own native full phase for '+field+' never becomes only a named future phase',async()=>{
 const h=await loaded();const input={...structuredClone(h.result.form),[field]:field==='fundingSources'?['neue-source']:'New'};assert.throws(()=>h.planner.planClientEditExtendedWeb(h.result,input,['kostentraeger']));assert.equal(h.writes.length+h.coreWrites.length,0);
});
test('Required native Core change refuses capture without any Core binding',async()=>{
 const h=await loaded({beforeReadTables:t=>{t.client_care_levels=[careRow()];}}),form={...structuredClone(h.result.form),careLevel:'pg3'};
 assert.equal(h.extended.captureClientEditExtendedWriteWeb(h.controller,h.lease,h.result,form,['versorgung'],null,()=>true),null);assert.equal(h.controller.status().pending,false);assert.equal(h.writes.length+h.coreWrites.length,0);
});
test('Forged same-form Coreintent/outcome cannot start an Extended target',async()=>{
 const h=await loaded({beforeReadTables:t=>{t.client_care_levels=[careRow()];}}),form={...structuredClone(h.result.form),careLevel:'pg3'};
 const intent=h.extended.captureClientEditExtendedWriteWeb(h.controller,h.lease,h.result,form,['versorgung'],{intent:{form,sections:['versorgung']},currentOutcome:()=>({phase:'core',status:'acknowledged',currentAtReturn:true})},()=>true),attempt=start(h,intent);
 assert.equal((await h.extended.executeClientEditExtendedWriteWeb(intent,attempt)).status,'blocked');assert.equal(h.writes.length+h.coreWrites.length,0);
});
test('Actual same-attempt Core ACK precedes required Extended grade and remains only partial phases',async()=>{
 const h=await loaded({beforeReadTables:t=>{t.client_care_levels=[careRow()];}}),{outcome,attempt}=await execute(h,{careLevel:'pg3'});
 assert.equal(h.coreOutcome.status,'acknowledged');assert.equal(h.coreWrites.length,1);assert.equal(h.coreWrites[0].payload.care_level,'pg3');assert.equal(h.writes.length,1);assert.equal(outcome.status,'acknowledged');assert.equal(h.core.mayContinueClientEditCoreWriteWeb(h.coreIntent,attempt,h.coreOutcome),true);assert.equal(h.controller.status().pending,true);assert.deepEqual(outcome.requiredOtherPhases,['care_documents']);
});
for(const phase of ['writeBuilder','writeSelect','writeThenAccessor'])test('Contacts.manage loss during '+phase+' prevents native dispatch and cannot revive retained phase',async()=>{
 const h=await loaded({beforeReadTables:t=>{t.client_contacts=[doctorRow()];t.client_ambulatory_details[0].family_doctor='Native Doctor';}}),intent=capture(h,{familyDoctor:'New Doctor'}),attempt=start(h,intent);
 h.state[phase]=()=>{h.state.contactsManage=false;};const outcome=await h.extended.executeClientEditExtendedWriteWeb(intent,attempt);assert.equal(outcome.status,'uncertain');assert.equal(h.writes.length,0);h.state.contactsManage=true;h.state[phase]=null;assert.equal((await h.extended.executeClientEditExtendedWriteWeb(intent,attempt)).status,'blocked');assert.equal(h.writes.length,0);
});
for(const permission of [()=>false,()=>1,async()=>true,()=>{throw Error('unknown');}])test('Original Contacts callback strict false/truthy/async/throw denies capture before any mutation',async()=>{
 const h=await loaded({beforeReadTables:t=>{t.client_contacts=[doctorRow()];t.client_ambulatory_details[0].family_doctor='Native Doctor';}}),form={...structuredClone(h.result.form),familyDoctor:'New Doctor'};
 assert.equal(h.extended.captureClientEditExtendedWriteWeb(h.controller,h.lease,h.result,form,['versorgung'],null,permission),null);assert.equal(h.writes.length,0);assert.equal(h.controller.status().pending,false);
});
for(const loss of ['mode','noSdk'])for(const phase of ['writeBuilder','writeSelect','writeThenAccessor'])test('Captured runtime '+loss+' loss at '+phase+' prevents actual nativeThen even before render',async()=>{
 const h=await loaded(),intent=capture(h,{orientation:'New'}),attempt=start(h,intent);h.state[phase]=()=>{if(loss==='mode')h.state.mode='demo';else h.state.noSdk=true;};
 const outcome=await h.extended.executeClientEditExtendedWriteWeb(intent,attempt);assert.equal(outcome.status,'uncertain');assert.equal(h.writes.length,0);h.state.mode='supabase';h.state.noSdk=false;h.state[phase]=null;assert.equal((await h.extended.executeClientEditExtendedWriteWeb(intent,attempt)).status,'blocked');assert.equal(h.writes.length,0);
});
test('Full new context ACK cannot reuse another newly confirmed context UUID',async()=>{
 const h=await loaded({beforeReadTables:t=>{t.client_billing_profiles=[billingRow()];}}),intent=capture(h,{careContexts:['ambulatory_care','support_care','daily_assistance']},['leistungsart']),attempt=start(h,intent);
 h.state.writeIntercept=call=>({data:row(999,{...call.payload}),error:null,status:201});const outcome=await h.extended.executeClientEditExtendedWriteWeb(intent,attempt);assert.equal(outcome.status,'uncertain');assert.equal(outcome.acknowledgements.length,1);assert.equal(h.writes.length,2);assert.equal(h.controller.status().pending,true);
});

test('Stale scalar original with unchanged native updated_at matches zero rows rather than overwriting concurrent target',async()=>{
 const h=await loaded(),intent=capture(h,{orientation:'Mine'}),attempt=start(h,intent);h.tables.client_support_preferences[0].orientation='Concurrent';
 const outcome=await h.extended.executeClientEditExtendedWriteWeb(intent,attempt);assert.equal(outcome.status,'uncertain');assert.equal(outcome.acknowledgements.length,0);assert.equal(h.state.updatedRows,0);assert.equal(h.tables.client_support_preferences[0].orientation,'Concurrent');assert.ok(h.writes[0].filters.some(([k,v])=>k==='orientation'&&v===null));
});
test('Original native array target has no verified binding operator and denies whole combined preflight before any scalar/Core write',async()=>{
 const h=await loaded(),intent=capture(h,{supportWishes:['Changed'],orientation:'Mine'});assert.equal(intent,null);assert.equal(h.writes.length+h.coreWrites.length,0);assert.equal(h.controller.status().pending,false);
});

for(const [table,column,concurrent,setup,patch,sections]of [
 ['client_contacts','contact_type','emergency_contact',t=>{t.client_contacts=[doctorRow()];t.client_ambulatory_details[0].family_doctor='Native Doctor';},{familyDoctor:'Held Doctor'},['versorgung']],
 ['client_addresses','is_primary',false,validAddress,{city:'Held City'},['adresse_kontakt']],
 ['client_addresses','address_type','rechnung',validAddress,{city:'Held City'},['adresse_kontakt']],
 ['client_care_levels','valid_until','2026-10-10',t=>{t.client_care_levels=[careRow()];},{careLevelValidFrom:'2024-02-29'},['versorgung']],
 ['client_care_levels','grade','pg3',t=>{t.client_care_levels=[careRow()];},{careLevelValidFrom:'2024-02-29'},['versorgung']],
])test('Concurrent native target role '+table+'.'+column+' with unchanged raw version matches zero affected rows before target mutation',async()=>{
 const h=await loaded({nativeCorePatch:{mobile:null},beforeReadTables:setup}),intent=capture(h,patch,sections),attempt=start(h,intent);h.tables[table][0][column]=concurrent;
 const outcome=await h.extended.executeClientEditExtendedWriteWeb(intent,attempt);assert.equal(outcome.status,'uncertain');assert.equal(outcome.acknowledgements.length,0);assert.equal(h.state.updatedRows,0);assert.ok(h.writes[0].filters.some(([key,value])=>key===column&&value!==concurrent));assert.equal(h.controller.status().pending,true);
});
