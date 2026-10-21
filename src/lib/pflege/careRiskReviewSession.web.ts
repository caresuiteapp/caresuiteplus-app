import {getSupabaseClient} from '@/lib/supabase/client';
import {getServiceMode} from '@/lib/services/mode';
import {fromUnknownTable} from '@/lib/supabase/untypedTable';
import {withServiceQueryTimeout} from '@/lib/services/queryTimeout';
import {carePermissionOwner,sameCarePermissionOwner,type CarePermissionAuth,type CarePermissionOwner} from '@/lib/permissions/carePermissionOwner.web';
import {cloneClientNativeOriginal,freezeClientNativeOriginal,sameClientNativeOriginal,type ClientNativeRow} from '@/lib/clients/clientRecordNativeOriginal.web';
import {MentalHealthOriginalReader,type MentalHealthReceipt} from '@/lib/careAssessment/mentalHealthOriginals.web';
import {FallRiskReviewOriginalReader,FALL_REVIEW_READ_KEYS,currentFallRiskReviewOriginalsWeb,isCurrentFallRiskReviewSisBindingWeb,isCurrentFallRiskReviewOriginalContextWeb,type FallRiskReviewReceipt,type FallRiskReviewRawOriginals} from './fallRiskReviewOriginals.web';
import {CareRiskReviewWrite,type CareRiskReviewForm,type CareRiskReviewOutcome,type CareRiskReviewWriteKey} from './careRiskReviewWrite.web';
import {woundUuid,woundInstant} from './woundCareDomain';

export type CareRiskReviewSessionAccess={auth:CarePermissionAuth;tenantId:string|null;riskId:unknown;permissions:readonly unknown[];can:(key:CareRiskReviewWriteKey)=>boolean};
export type CareRiskReviewSessionToken=Readonly<Record<never,never>>;
export type CareRiskReviewField=Readonly<{kind:'missing'|'null'|'empty'|'value'|'unresolved';value?:string|boolean}>;
export type CareRiskReviewFields=Readonly<Record<keyof CareRiskReviewForm,CareRiskReviewField>>;
export type CareRiskReviewSnapshot=Readonly<{kind:'missing'|'null'|'unresolved'|'own_assessment_snapshot';riskId?:string;assessmentId?:string;riskKey?:string;entityMatches?:boolean;fields?:CareRiskReviewFields}>;
export type CareRiskReviewAudit=Readonly<{id:CareRiskReviewField;entityId:CareRiskReviewField;actorId:CareRiskReviewField;actorName:CareRiskReviewField;action:CareRiskReviewField;summary:CareRiskReviewField;recordedAt:CareRiskReviewField;before:CareRiskReviewSnapshot;after:CareRiskReviewSnapshot}>;
export type CareRiskReviewSessionView=Readonly<{stage:'choose'|'loading'|'ready'|'blocked'|'saving'|'uncertain'|'risk_response_acknowledged';dirty:boolean;draftState:'none'|'retained'|'restored'|'conflict';canEdit:boolean;canSave:boolean;fields:CareRiskReviewFields|null;fieldErrors:readonly (keyof CareRiskReviewForm)[];history:readonly CareRiskReviewAudit[];counts:Readonly<Record<string,number>>;createdAt:CareRiskReviewField;updatedAt:CareRiskReviewField}>;
type Context={owner:CarePermissionOwner;riskId:string;origin:readonly unknown[]};
type OwnerStore={current:Entry|null;history:Entry[];work:Entry|null;draft:Entry|null};
type Entry={token:CareRiskReviewSessionToken;store:OwnerStore;context:Context;access:()=>CareRiskReviewSessionAccess;db:NonNullable<ReturnType<typeof getSupabaseClient>>;alive:boolean;valid:boolean;checking:boolean;serial:number;stage:CareRiskReviewSessionView['stage'];editClosed:boolean;dirty:boolean;draftState:CareRiskReviewSessionView['draftState'];resume:Entry|null;form:CareRiskReviewForm|null;projection:CareRiskReviewFields|null;errors:readonly (keyof CareRiskReviewForm)[];resolved:Readonly<{risk:ClientNativeRow;assessment:ClientNativeRow;clientId:string;assessmentId:string}>|null;originals:FallRiskReviewRawOriginals|null;sis:MentalHealthOriginalReader|null;sisReceipt:MentalHealthReceipt|null;fall:FallRiskReviewOriginalReader|null;fallReceipt:FallRiskReviewReceipt|null;writer:CareRiskReviewWrite|null;outcome:CareRiskReviewOutcome|null;history:readonly CareRiskReviewAudit[];listeners:Set<()=>void>};
const entries=new WeakMap<CareRiskReviewSessionToken,Entry>(),stores=new Map<string,OwnerStore>(),targetWork=new Map<string,Entry>();
const fields={state:'risk_state',urgency:'urgency',evidence:'evidence',protectiveFactors:'protective_factors',professionalRationale:'professional_rationale',counselingProvided:'counseling_provided',personDecision:'person_decision',refusalDocumented:'refusal_documented',nextReviewAt:'next_review_at'} as const;
const riskColumns=['id','tenant_id','assessment_id','risk_key',...Object.values(fields),'focused_assessment_key','focused_assessment_result','linked_bodymap_marker_ids','created_at','updated_at'] as const;
const denied=()=>Error('Die eigene Risikofassung ist nicht vollständig, aktuell oder freigegeben.');
const plain=(v:unknown):v is ClientNativeRow=>!!v&&typeof v==='object'&&!Array.isArray(v)&&[Object.prototype,null].includes(Object.getPrototypeOf(v));
function own(v:unknown,key:string,optional=false):unknown{if(!plain(v))throw denied();const d=Object.getOwnPropertyDescriptor(v,key);if(!d){if(optional)return undefined;throw denied();}if(!d.enumerable||!('value'in d))throw denied();return d.value;}
function identity(value:unknown):{id:string;roleKey?:string|null}|null{if(value===null)return null;const id=own(value,'id'),roleKey=own(value,'roleKey',true);if(typeof id!=='string'||roleKey!==undefined&&roleKey!==null&&typeof roleKey!=='string')throw denied();return{id,roleKey};}
function capturedAuth(value:unknown):CarePermissionAuth{
 // The actual AuthProvider value also contains action functions. Project only declared own data
 // before cloning; ignore unrelated context members without invoking their getters or actions.
 const profile=own(value,'profile'),session=own(value,'session'),p=identity(profile);
 const projected={authReady:own(value,'authReady'),isAuthenticated:own(value,'isAuthenticated'),isLoading:own(value,'isLoading'),profileBootstrapError:own(value,'profileBootstrapError'),profile:p===null?null:{...p,tenantId:own(profile,'tenantId')},user:identity(own(value,'user')),session:session===null?null:{user:identity(own(session,'user'))!,accessToken:own(session,'accessToken'),expiresAt:own(session,'expiresAt')},portalSession:own(value,'portalSession')};
 return freezeClientNativeOriginal(cloneClientNativeOriginal(projected)) as CarePermissionAuth;
}
function captured(getAccess:()=>CareRiskReviewSessionAccess):{context:Context;auth:CarePermissionAuth;can:CareRiskReviewSessionAccess['can']} {
 const input=getAccess(),auth=capturedAuth(own(input,'auth')),tenant=own(input,'tenantId'),risk=own(input,'riskId'),origin=own(input,'permissions'),can=own(input,'can'),copy=cloneClientNativeOriginal(origin);
 const owner=carePermissionOwner(auth,typeof tenant==='string'?tenant:null,false);
 if(!owner||owner.demo||!woundUuid(risk)||!Array.isArray(copy)||!Object.isFrozen(origin)||copy.some(key=>typeof key!=='string')||!FALL_REVIEW_READ_KEYS.every(key=>copy.includes(key))||typeof can!=='function')throw denied();
 return{context:{owner,riskId:risk,origin:origin as readonly unknown[]},auth,can:can as CareRiskReviewSessionAccess['can']};
}
const same=(a:Context,b:Context)=>sameCarePermissionOwner(a.owner,b.owner)&&a.riskId===b.riskId&&a.origin===b.origin;
const storeKey=(c:Context)=>[c.owner.tenantId,c.owner.profileId,c.owner.roleKey,c.riskId].map(s=>s.toLowerCase()).join('/');
const target=(e:Entry)=>e.resolved?[e.context.owner.tenantId,e.resolved.clientId,e.resolved.assessmentId,e.context.riskId].map(s=>s.toLowerCase()).join('/'):null;
function life(e:Entry):void{if(!e.alive||!e.valid||e.store.current!==e)throw denied();}
function authority(e:Entry):void{life(e);const current=captured(e.access);if(!same(current.context,e.context))throw denied();for(const key of FALL_REVIEW_READ_KEYS){const grant:unknown=current.can(key);if(grant!==true){if(grant instanceof Promise)void grant.catch(()=>{});throw denied();}}if(!same(captured(e.access).context,e.context))throw denied();life(e);}
function gate(e:Entry):boolean{
 if(!e.valid)return false;if(e.checking){e.valid=false;return false;}e.checking=true;
 try{
  authority(e);if(getSupabaseClient()!==e.db||getServiceMode()!=='supabase')throw denied();authority(e);
  if(e.fallReceipt){
   const actual=nativeAccess(e);
   // The fixed verifier rechecks exactRaw after the own gates; expected data is not a grant.
   if(!e.originals||!isCurrentFallRiskReviewSisBindingWeb(e.fall,e.fallReceipt,e.sis,e.sisReceipt)
    ||!isCurrentFallRiskReviewOriginalContextWeb(e.fall,e.fallReceipt,e.originals,{auth:actual.auth,tenantId:actual.tenantId,clientId:actual.clientId,assessmentId:actual.assessmentId,sdk:e.db}))throw denied();
  }authority(e);
  if(getServiceMode()!=='supabase'||getSupabaseClient()!==e.db)throw denied();authority(e);
  // Bounded final checks after actual can/context and runtime accessors. No generic atomicity claim.
  if(getSupabaseClient()!==e.db||getServiceMode()!=='supabase')throw denied();
  const after=captured(e.access);if(!same(after.context,e.context))throw denied();for(const key of FALL_REVIEW_READ_KEYS){const grant:unknown=after.can(key);if(grant!==true){if(grant instanceof Promise)void grant.catch(()=>{});throw denied();}}
  if(getSupabaseClient()!==e.db||getServiceMode()!=='supabase'||!same(captured(e.access).context,e.context))throw denied();
  // Observe the captured SDK after the last mode accessor, then actual native authority and own
  // lifetime, as in the original readers. This is not atomicity for arbitrary impure getters.
  if(getServiceMode()!=='supabase'||getSupabaseClient()!==e.db)throw denied();authority(e);life(e);return true;
 }catch{e.valid=false;return false;}finally{e.checking=false;}
}
function edit(e:Entry):boolean{
 if(e.editClosed||!gate(e))return false;
 try{const a=captured(e.access),grant:unknown=a.can('pflege.risks.manage');if(grant!==true){if(grant instanceof Promise)void grant.catch(()=>{});e.editClosed=true;return false;}if(!same(a.context,e.context)||!gate(e))throw denied();return true;}catch{e.editClosed=true;return false;}
}
function notify(e:Entry):void{for(const listener of [...e.listeners]){try{listener();}catch{/* A subscriber cannot release a journal. */}}}
function closeReaders(e:Entry):void{e.sis?.dispose();e.fall?.dispose();e.writer?.dispose();}
function field(row:ClientNativeRow,key:string):CareRiskReviewField{
 if(!Object.hasOwn(row,key))return Object.freeze({kind:'missing'});const value=row[key];
 return Object.freeze(value===null?{kind:'null'}:typeof value==='string'||typeof value==='boolean'?{kind:value===''?'empty':'value',value}:{kind:'unresolved'});
}
function timeField(row:ClientNativeRow,key:string):CareRiskReviewField{const result=field(row,key);return typeof result.value==='string'&&result.value!==''&&woundInstant(result.value.replace(' ','T'))===null?Object.freeze({...result,kind:'unresolved'}):result;}
function referenceField(row:ClientNativeRow,key:string):CareRiskReviewField{const result=field(row,key);return result.kind==='value'&&!woundUuid(result.value)?Object.freeze({...result,kind:'unresolved'}):result;}
function projected(input:ClientNativeRow):CareRiskReviewFields{return freezeClientNativeOriginal(Object.fromEntries(Object.keys(fields).map(key=>[key,key==='nextReviewAt'?timeField(input,key):field(input,key)]))) as CareRiskReviewFields;}
function originalForm(row:ClientNativeRow):CareRiskReviewForm{
 for(const column of riskColumns)own(row,column);const result=Object.fromEntries(Object.entries(fields).map(([key,column])=>[key,own(row,column)]));return validateForm(result,false);
}
function validateForm(input:unknown,requireRationale=true):CareRiskReviewForm{
 const result=cloneClientNativeOriginal(input);if(!plain(result)||Object.keys(result).length!==9||Object.keys(result).some(key=>!Object.hasOwn(fields,key)))throw denied();
 for(const key of ['state','urgency','evidence','protectiveFactors','professionalRationale','counselingProvided','personDecision'])if(typeof own(result,key)!=='string')throw denied();
 if(!['none','unclear','present','controlled'].includes(String(result.state))||!['routine','timely','urgent','immediate'].includes(String(result.urgency))||typeof own(result,'refusalDocumented')!=='boolean'||requireRationale&&!String(result.professionalRationale).replace(/^ +| +$/g,'')||own(result,'nextReviewAt')!==null&&(typeof result.nextReviewAt!=='string'||woundInstant(result.nextReviewAt.replace(' ','T'))===null))throw denied();return freezeClientNativeOriginal(result) as CareRiskReviewForm;
}
function formErrors(value:CareRiskReviewForm):readonly (keyof CareRiskReviewForm)[]{
 const errors:(keyof CareRiskReviewForm)[]=[];if(!['none','unclear','present','controlled'].includes(value.state))errors.push('state');if(!['routine','timely','urgent','immediate'].includes(value.urgency))errors.push('urgency');if(!value.professionalRationale.replace(/^ +| +$/g,''))errors.push('professionalRationale');if(value.nextReviewAt!==null&&woundInstant(value.nextReviewAt.replace(' ','T'))===null)errors.push('nextReviewAt');return Object.freeze(errors);
}
function snapshot(e:Entry,row:ClientNativeRow,key:string):CareRiskReviewSnapshot{
 if(!Object.hasOwn(row,key))return Object.freeze({kind:'missing'});const raw=row[key];if(raw===null)return Object.freeze({kind:'null'});
 try{if(!plain(raw)||!woundUuid(own(raw,'id'))||own(raw,'tenant_id')!==e.context.owner.tenantId||own(raw,'assessment_id')!==e.resolved!.assessmentId||typeof own(raw,'risk_key')!=='string')throw denied();const values=Object.fromEntries(Object.entries(fields).filter(([,column])=>Object.hasOwn(raw,column)).map(([key,column])=>[key,own(raw,column)]));return Object.freeze({kind:'own_assessment_snapshot',riskId:String(raw.id),assessmentId:String(raw.assessment_id),riskKey:String(raw.risk_key),entityMatches:row.entity_id===raw.id,fields:projected(values)});}catch{return Object.freeze({kind:'unresolved'});}
}
function history(e:Entry):readonly CareRiskReviewAudit[]{return freezeClientNativeOriginal(e.originals!.audits.map(row=>({id:referenceField(row,'id'),entityId:referenceField(row,'entity_id'),actorId:referenceField(row,'actor_id'),actorName:field(row,'actor_name'),action:field(row,'action'),summary:field(row,'summary'),recordedAt:timeField(row,'created_at'),before:snapshot(e,row,'before_data'),after:snapshot(e,row,'after_data')})));}
function response(value:unknown):ClientNativeRow{
 const copy=freezeClientNativeOriginal(cloneClientNativeOriginal(value));if(!plain(copy)||own(copy,'error')!==null||!Number.isSafeInteger(own(copy,'status'))||Number(copy.status)<200||Number(copy.status)>=300)throw denied();const row=own(copy,'data');if(!plain(row))throw denied();return row;
}
function nativeAccess(e:Entry){const a=captured(e.access);if(!e.resolved||!same(a.context,e.context))throw denied();return{auth:a.auth,tenantId:a.context.owner.tenantId,clientId:e.resolved.clientId,assessmentId:e.resolved.assessmentId,permissions:a.context.origin,can:a.can};}

/** Unbound private session. Product/route gates, server auth, clinical status and AuditACK are not
 * granted here. Module memory survives remounts, not a browser reload or process termination. */
export function attachCareRiskReviewSession(getAccess:()=>CareRiskReviewSessionAccess):CareRiskReviewSessionToken|null{
 try{
  const {context}=captured(getAccess),db=getSupabaseClient();if(!db)throw denied();const key=storeKey(context);const store:OwnerStore=stores.get(key)??{current:null,history:[],work:null,draft:null};
  const previous=store.current;if(previous&&previous.alive&&(previous.dirty||['loading','saving','uncertain'].includes(previous.stage)))return null;
  if(previous?.checking){previous.valid=false;return null;}
  if(previous){previous.alive=false;previous.valid=false;previous.serial++;closeReaders(previous);notify(previous);}
  const token=Object.freeze({}),e:Entry={token,store,context,access:getAccess,db,alive:true,valid:true,checking:false,serial:0,stage:store.work?(store.work.stage==='saving'?'saving':'uncertain'):'choose',editClosed:false,dirty:!!store.draft,draftState:store.draft?'retained':'none',resume:store.draft,form:null,projection:null,errors:Object.freeze([]),resolved:null,originals:null,sis:null,sisReceipt:null,fall:null,fallReceipt:null,writer:null,outcome:null,history:Object.freeze([]),listeners:new Set()};store.current=e;store.history.push(e);stores.set(key,store);entries.set(token,e);if(!gate(e)){e.alive=false;return null;}return token;
 }catch{return null;}
}
export function detachCareRiskReviewSession(token:CareRiskReviewSessionToken):void{const e=entries.get(token);if(!e)return;e.alive=false;e.valid=false;e.serial++;closeReaders(e);if(e.store.current===e)e.store.current=null;notify(e);e.listeners.clear();}
export function subscribeCareRiskReviewSession(token:CareRiskReviewSessionToken,listener:()=>void):()=>void{const e=entries.get(token);if(!e||!gate(e))return()=>{};e.listeners.add(listener);return()=>e.listeners.delete(listener);}
export async function readCareRiskReviewSession(token:CareRiskReviewSessionToken):Promise<boolean>{
 const e=entries.get(token);if(!e||e.stage!=='choose'||e.store.work||!gate(e))return false;const serial=++e.serial;e.stage='loading';notify(e);
 const current=()=>{if(e.serial!==serial||!gate(e))throw denied();};
 try{
  const dispatch=async(build:()=>PromiseLike<unknown>)=>{current();const query=build();const raw=await withServiceQueryTimeout(new Promise<unknown>((resolve,reject)=>{try{const then=query?.then,sameThen=query?.then;if(typeof then!=='function'||then!==sameThen)throw denied();current();Reflect.apply(then,query,[resolve,reject]);}catch(error){reject(error);}}));current();const row=response(raw);current();return row;};
  const risk=await dispatch(()=>fromUnknownTable(e.db,'care_assessment_risks').select('*').eq('tenant_id',e.context.owner.tenantId).eq('id',e.context.riskId).maybeSingle());
  if(own(risk,'id')!==e.context.riskId||own(risk,'tenant_id')!==e.context.owner.tenantId||!woundUuid(own(risk,'assessment_id')))throw denied();current();
  const assessment=await dispatch(()=>fromUnknownTable(e.db,'care_assessments').select('*').eq('tenant_id',e.context.owner.tenantId).eq('id',String(risk.assessment_id)).eq('subject_type','client').maybeSingle());
  if(own(assessment,'id')!==risk.assessment_id||own(assessment,'tenant_id')!==e.context.owner.tenantId||own(assessment,'subject_type')!=='client'||!woundUuid(own(assessment,'subject_id')))throw denied();current();
  e.resolved=Object.freeze({risk,assessment,clientId:String(assessment.subject_id),assessmentId:String(assessment.id)});
  e.sis=new MentalHealthOriginalReader(()=>nativeAccess(e));e.sis.mount();const sr=await e.sis.read();current();if(sr.ok!==true)throw denied();e.sisReceipt=sr.data;
  e.fall=new FallRiskReviewOriginalReader(()=>nativeAccess(e),e.sis,sr.data);e.fall.mount();const fr=await e.fall.read();current();if(fr.ok!==true)throw denied();e.fallReceipt=fr.data;e.originals=currentFallRiskReviewOriginalsWeb(e.fall,fr.data);if(!e.originals)throw denied();current();
  const rows=e.originals.sis.pools.risks.filter(row=>row.id===e.context.riskId);if(rows.length!==1||own(rows[0],'assessment_id')!==e.resolved.assessmentId||own(rows[0],'tenant_id')!==e.context.owner.tenantId)throw denied();
  e.projection=projected(Object.fromEntries(Object.entries(fields).filter(([,column])=>Object.hasOwn(rows[0],column)).map(([key,column])=>[key,own(rows[0],column)])));e.history=history(e);e.form=originalForm(rows[0]);
  if(e.resume){const old=e.resume.originals?.sis.pools.risks.find(row=>row.id===e.context.riskId);if(!old||!e.resume.form||!sameClientNativeOriginal(old,rows[0])){e.draftState='conflict';throw denied();}e.form=e.resume.form;e.draftState='restored';e.dirty=true;e.store.draft=e;}
  e.writer=new CareRiskReviewWrite(()=>nativeAccess(e),e.fall,fr.data);e.writer.mount();current();
  const work=targetWork.get(target(e)!);e.stage=work?'uncertain':'ready';notify(e);return true;
 }catch{if(e.serial===serial){e.stage='blocked';if(!e.originals)closeReaders(e);notify(e);}return false;}
}
export function viewCareRiskReviewSession(token:CareRiskReviewSessionToken):CareRiskReviewSessionView|null{
 const e=entries.get(token);if(!e||!gate(e))return null;const editable=edit(e),stage=e.store.work&&e.store.work!==e?(e.store.work.stage==='saving'?'saving':'uncertain'):e.stage;
 const disclose=!!e.originals&&!['loading','choose'].includes(stage),risk=e.originals?.sis.pools.risks.find(row=>row.id===e.context.riskId);
 const result=Object.freeze({stage,dirty:e.dirty,draftState:e.draftState,canEdit:stage==='ready'&&editable,canSave:stage==='ready'&&editable,fields:disclose?(e.form?projected(e.form):e.projection):null,fieldErrors:e.errors,history:disclose?e.history:Object.freeze([]),counts:Object.freeze(e.originals?{...Object.fromEntries(Object.entries(e.originals.sis.pools).map(([key,rows])=>[key,rows.length])),audits:e.originals.audits.length}:{}),createdAt:risk?timeField(risk,'created_at'):Object.freeze({kind:'missing' as const}),updatedAt:risk?timeField(risk,'updated_at'):Object.freeze({kind:'missing' as const})});return gate(e)?result:null;
}
export function updateCareRiskReviewSession(token:CareRiskReviewSessionToken,key:keyof CareRiskReviewForm,value:unknown):boolean{
 const e=entries.get(token);if(!e||e.stage!=='ready'||e.store.work||!e.form||!Object.hasOwn(fields,key)||!edit(e))return false;
 // Invalid user input remains explicit for correction; no coercion or implicit null/time default.
 if(key==='refusalDocumented'?typeof value!=='boolean':key==='nextReviewAt'?value!==null&&typeof value!=='string':typeof value!=='string')return false;
 const form=freezeClientNativeOriginal({...e.form,[key]:value}) as CareRiskReviewForm;if(!edit(e)||e.stage!=='ready'||e.store.work)return false;e.form=form;e.dirty=true;e.store.draft=e;e.errors=Object.freeze([]);notify(e);return true;
}
export async function saveCareRiskReviewSession(token:CareRiskReviewSessionToken):Promise<boolean>{
 const e=entries.get(token);if(!e||e.stage!=='ready'||e.store.work||!e.writer||!e.form||!edit(e))return false;
 const errors=formErrors(e.form);if(errors.length){e.errors=errors;notify(e);return false;}try{validateForm(e.form);}catch{e.stage='blocked';notify(e);return false;}
 const intent=e.writer.capture(e.context.riskId,e.form);if(!intent){e.stage='blocked';notify(e);return false;}if(!edit(e)||e.store.work||e.stage!=='ready')return false;
 const key=target(e)!;if(targetWork.has(key)){e.stage='uncertain';notify(e);return false;}e.store.work=e;targetWork.set(key,e);e.stage='saving';notify(e);
 try{
  const outcome=await e.writer.execute(intent);e.outcome=outcome;const summary=outcome?e.writer.summary(outcome):null;
  // Preserve the actual native fact even after detach. No late callback/raw/UI grant follows.
  if(summary?.status==='risk_response_acknowledged'){e.stage='risk_response_acknowledged';e.dirty=false;if(e.store.draft===e)e.store.draft=null;if(e.store.work===e)e.store.work=null;if(targetWork.get(key)===e)targetWork.delete(key);}
  else if(summary?.status==='blocked_before_request'&&summary.requestStarted===false){e.stage='blocked';if(e.store.work===e)e.store.work=null;if(targetWork.get(key)===e)targetWork.delete(key);}
  else e.stage='uncertain';
  const current=e.store.current;if(current&&current!==e){
   // A remounted same-owner attachment may observe a technical end, not the old draft/raw reply
   // or a new action grant. Unknown remains in work; a known end still needs explicit fresh read.
   if(!e.store.work&&current.stage==='saving'){
    current.stage=e.stage;
    if(summary?.status==='risk_response_acknowledged'&&current.resume===e){current.dirty=false;current.resume=null;current.draftState='none';}
   }
   if(current.alive&&gate(current))notify(current);
  }
  if(e.alive&&gate(e))notify(e);return !!outcome&&summary?.status==='risk_response_acknowledged'&&gate(e)&&e.writer.mayFollowup(outcome);
 }catch{e.stage='uncertain';if(e.alive&&gate(e))notify(e);return false;}
}
export async function closeCareRiskReviewSession(token:CareRiskReviewSessionToken,confirmDiscard:()=>Promise<boolean>):Promise<boolean>{
 const e=entries.get(token);if(!e||!localDiscard(e))return false;
 const form=e.form,serial=e.serial,stage=e.stage,dirty=e.dirty,editClosed=e.editClosed,resume=e.resume,draft=e.store.draft;if(e.dirty){let confirmed:unknown;try{confirmed=await confirmDiscard();}catch{return false;}if(confirmed!==true)return false;}
 if(!localDiscard(e)||e.form!==form||e.serial!==serial||e.stage!==stage||e.dirty!==dirty||e.editClosed!==editClosed||e.resume!==resume||e.store.draft!==draft)return false;if(e.store.draft===e||e.store.draft===e.resume)e.store.draft=null;detachCareRiskReviewSession(token);return true;
}
function localDiscard(e:Entry):boolean{
 // Local destruction is not a Read/Edit grant. No raw projection, native request or journal release.
 try{if(!e.alive||e.store.current!==e||e.store.work||['loading','saving','uncertain'].includes(e.stage)||e.checking)return false;const input=e.access(),auth=capturedAuth(own(input,'auth')),tenant=own(input,'tenantId'),risk=own(input,'riskId'),owner=carePermissionOwner(auth,typeof tenant==='string'?tenant:null,false,0);return !!owner&&sameCarePermissionOwner(owner,e.context.owner)&&risk===e.context.riskId&&e.alive&&e.store.current===e&&!e.store.work;}catch{return false;}
}
