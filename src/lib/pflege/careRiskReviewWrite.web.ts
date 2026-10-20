import {getSupabaseClient} from '@/lib/supabase/client';
import {getServiceMode} from '@/lib/services/mode';
import {withServiceQueryTimeout} from '@/lib/services/queryTimeout';
import {carePermissionOwner,sameCarePermissionOwner,type CarePermissionAuth,type CarePermissionOwner} from '@/lib/permissions/carePermissionOwner.web';
import {cloneClientNativeOriginal,freezeClientNativeOriginal,type ClientNativeRow} from '@/lib/clients/clientRecordNativeOriginal.web';
import {FallRiskReviewOriginalReader,FALL_REVIEW_READ_KEYS,currentFallRiskReviewOriginalsWeb,isCurrentFallRiskReviewOriginalContextWeb,type FallRiskReviewReceipt,type FallRiskReviewRawOriginals} from './fallRiskReviewOriginals.web';
import {woundUuid,woundInstant} from './woundCareDomain';

export const CARE_RISK_REVIEW_WRITE_KEYS=[...FALL_REVIEW_READ_KEYS,'pflege.risks.manage'] as const;
export type CareRiskReviewWriteKey=typeof CARE_RISK_REVIEW_WRITE_KEYS[number];
export type CareRiskReviewWriteAccess={auth:CarePermissionAuth;tenantId:string|null;clientId:string;assessmentId:string;permissions:readonly unknown[];can:(key:CareRiskReviewWriteKey)=>boolean};
/** All nine replacements are explicit. Raw dates/text are sent unchanged; no form defaults. */
export type CareRiskReviewForm=Readonly<{state:string;urgency:string;evidence:string;protectiveFactors:string;professionalRationale:string;counselingProvided:string;personDecision:string;refusalDocumented:boolean;nextReviewAt:string|null}>;
export type CareRiskReviewIntent=Readonly<Record<never,never>>;
export type CareRiskReviewOutcome=Readonly<Record<never,never>>;
/** requestStarted means possible side effects at RPC accessor/factory entry, not proof of HTTP
 * transmission. nativeExecutorEntered separately records the observed synchronous then entry. */
export type CareRiskReviewWriteSummary=Readonly<{status:'blocked_before_request'|'uncertain'|'risk_response_acknowledged';requestStarted:boolean;nativeExecutorEntered:boolean;currentAtReturn:boolean}>;
type Context={owner:CarePermissionOwner;clientId:string;assessmentId:string;origin:readonly unknown[]};
type Controller={alive:boolean;lifetime:number;checkingEntry:Entry|null;access:()=>CareRiskReviewWriteAccess;reader:FallRiskReviewOriginalReader;receipt:FallRiskReviewReceipt};
type Entry={controller:Controller;lifetime:number;valid:boolean;checking:boolean;used:boolean;context:Context;db:NonNullable<ReturnType<typeof getSupabaseClient>>;originals:FallRiskReviewRawOriginals;risk:ClientNativeRow;form:CareRiskReviewForm;payload:ClientNativeRow;target:string;requestStarted:boolean;nativeExecutorEntered:boolean;nativeResult:unknown;summary:CareRiskReviewWriteSummary|null;outcome:CareRiskReviewOutcome|null};
const controllers=new WeakMap<CareRiskReviewWrite,Controller>(),intents=new WeakMap<CareRiskReviewIntent,Entry>(),outcomes=new WeakMap<CareRiskReviewOutcome,Entry>();
// Exact native target only. Other owners see a veto, never this owner's raw draft or originals.
// Module memory survives controller/remount changes, not browser reload/process termination.
const journals=new Map<string,Entry>();
const denied=()=>Error('Die eigene Risikoprüfung ist nicht vollständig, aktuell oder freigegeben.');
const plain=(v:unknown):v is ClientNativeRow=>!!v&&typeof v==='object'&&!Array.isArray(v)&&[Object.prototype,null].includes(Object.getPrototypeOf(v));
function own(v:unknown,key:string,optional=false):unknown{if(!plain(v))throw denied();const d=Object.getOwnPropertyDescriptor(v,key);if(!d){if(optional)return undefined;throw denied();}if(!d.enumerable||!('value'in d))throw denied();return d.value;}
function identity(v:unknown):{id:string;roleKey?:string|null}|null{if(v===null)return null;const id=own(v,'id'),roleKey=own(v,'roleKey',true);if(typeof id!=='string'||roleKey!==undefined&&roleKey!==null&&typeof roleKey!=='string')throw denied();return{id,roleKey};}
function access(getAccess:()=>CareRiskReviewWriteAccess):{context:Context;auth:CarePermissionAuth;can:CareRiskReviewWriteAccess['can']}{
 const input=getAccess(),raw=own(input,'auth'),profile=own(raw,'profile'),session=own(raw,'session'),p=identity(profile);
 const auth={authReady:own(raw,'authReady'),isAuthenticated:own(raw,'isAuthenticated'),isLoading:own(raw,'isLoading'),profileBootstrapError:own(raw,'profileBootstrapError'),profile:p===null?null:{...p,tenantId:own(profile,'tenantId')},user:identity(own(raw,'user')),session:session===null?null:{user:identity(own(session,'user'))!,accessToken:own(session,'accessToken'),expiresAt:own(session,'expiresAt')},portalSession:own(raw,'portalSession')} as CarePermissionAuth;
 const tenantId=own(input,'tenantId'),clientId=own(input,'clientId'),assessmentId=own(input,'assessmentId'),origin=own(input,'permissions'),can=own(input,'can'),copy=cloneClientNativeOriginal(origin);
 const owner=carePermissionOwner(auth,typeof tenantId==='string'?tenantId:null,false);
 if(!owner||owner.demo||!woundUuid(clientId)||!woundUuid(assessmentId)||!Array.isArray(copy)||!Object.isFrozen(origin)||copy.some(key=>typeof key!=='string')||!CARE_RISK_REVIEW_WRITE_KEYS.every(key=>copy.includes(key))||typeof can!=='function')throw denied();
 return{context:{owner,clientId,assessmentId,origin:origin as readonly unknown[]},auth,can:can as CareRiskReviewWriteAccess['can']};
}
const same=(a:Context,b:Context)=>sameCarePermissionOwner(a.owner,b.owner)&&a.clientId===b.clientId&&a.assessmentId===b.assessmentId&&a.origin===b.origin;
// PostgreSQL trim(text) strips U+0020 by default, not JS trim's other whitespace.
function sqlTrim(text:string):string{let a=0,b=text.length;while(text[a]===' ')a++;while(b>a&&text[b-1]===' ')b--;return text.slice(a,b);}
function instant(v:unknown):bigint|null{if(typeof v!=='string')return null;return woundInstant(v.replace(' ','T'));}
const fields={state:'risk_state',urgency:'urgency',evidence:'evidence',protectiveFactors:'protective_factors',professionalRationale:'professional_rationale',counselingProvided:'counseling_provided',personDecision:'person_decision',refusalDocumented:'refusal_documented',nextReviewAt:'next_review_at'} as const;
// Actual native RiskROW columns from 202607261400. Marker/screening values remain raw metadata,
// never target FKs, selections or clinical grants. Unknown additional columns are retained too.
const riskColumns=['id','tenant_id','assessment_id','risk_key',...Object.values(fields),'focused_assessment_key','focused_assessment_result','linked_bodymap_marker_ids','created_at','updated_at'] as const;
function form(input:unknown,requireRationale=true):CareRiskReviewForm{
 const value=cloneClientNativeOriginal(input);if(!plain(value)||Object.keys(value).length!==9||Object.keys(value).some(key=>!Object.hasOwn(fields,key)))throw denied();
 for(const key of ['state','urgency','evidence','protectiveFactors','professionalRationale','counselingProvided','personDecision'])if(typeof own(value,key)!=='string')throw denied();
 if(!['none','unclear','present','controlled'].includes(String(value.state))||!['routine','timely','urgent','immediate'].includes(String(value.urgency))||typeof own(value,'refusalDocumented')!=='boolean'||requireRationale&&!sqlTrim(String(value.professionalRationale))||own(value,'nextReviewAt')!==null&&instant(value.nextReviewAt)===null)throw denied();
 return freezeClientNativeOriginal(value) as CareRiskReviewForm;
}
function scope(entry:Entry,row:ClientNativeRow):void{if(own(row,'id')!==entry.risk.id||own(row,'tenant_id')!==entry.context.owner.tenantId||own(row,'assessment_id')!==entry.context.assessmentId||own(row,'risk_key')!==entry.risk.risk_key)throw denied();}
function life(entry:Entry):void{if(!entry.valid||!entry.controller.alive||entry.lifetime!==entry.controller.lifetime)throw denied();}
function currentOriginal(entry:Entry):void{
 const current=access(entry.controller.access);
 // Fixed context checks exactRaw on both sides of its own F/M gates; no dynamic receiver grant.
 if(!same(current.context,entry.context)||!isCurrentFallRiskReviewOriginalContextWeb(entry.controller.reader,entry.controller.receipt,entry.originals,{auth:current.auth,tenantId:current.context.owner.tenantId,clientId:current.context.clientId,assessmentId:current.context.assessmentId,sdk:entry.db}))throw denied();life(entry);
}
function authority(entry:Entry):void{
 life(entry);currentOriginal(entry);
 const current=access(entry.controller.access);if(!same(current.context,entry.context))throw denied();
 for(const key of CARE_RISK_REVIEW_WRITE_KEYS){const grant:unknown=current.can(key);if(grant!==true){if(grant instanceof Promise)void grant.catch(()=>{});throw denied();}}
 if(!same(access(entry.controller.access).context,entry.context))throw denied();
 currentOriginal(entry);
 const after=access(entry.controller.access);if(!same(after.context,entry.context))throw denied();
 for(const key of CARE_RISK_REVIEW_WRITE_KEYS){const grant:unknown=after.can(key);if(grant!==true){if(grant instanceof Promise)void grant.catch(()=>{});throw denied();}}
 if(!same(access(entry.controller.access).context,entry.context))throw denied();life(entry);
}
function gate(entry:Entry):boolean{
 if(!entry.valid)return false;if(entry.checking||entry.controller.checkingEntry){entry.valid=false;if(entry.controller.checkingEntry)entry.controller.checkingEntry.valid=false;return false;}entry.checking=true;entry.controller.checkingEntry=entry;
 try{
  authority(entry);if(getSupabaseClient()!==entry.db||getServiceMode()!=='supabase')throw denied();authority(entry);
  if(getServiceMode()!=='supabase')throw denied();authority(entry);if(getSupabaseClient()!==entry.db)throw denied();authority(entry);
  if(getServiceMode()!=='supabase'||getSupabaseClient()!==entry.db)throw denied();authority(entry);
  // Own native permission/context callbacks can change runtime too. Observe both afterwards,
  // then observe native grants after those accessors. A last permission callback's mode loss
  // is caught by the original reader's fixed runtime gate, without any generic grant callback.
  if(getSupabaseClient()!==entry.db||getServiceMode()!=='supabase')throw denied();authority(entry);
  currentOriginal(entry);
  life(entry);return true;
 }
 catch{entry.valid=false;return false;}finally{entry.checking=false;if(entry.controller.checkingEntry===entry)entry.controller.checkingEntry=null;}
}
function acknowledged(entry:Entry,result:unknown):boolean{
 try{
  const copied=freezeClientNativeOriginal(cloneClientNativeOriginal(result));entry.nativeResult=copied;
  if(!plain(copied)||own(copied,'error')!==null||!Number.isSafeInteger(own(copied,'status'))||Number(copied.status)<200||Number(copied.status)>=300)throw denied();
  const row=own(copied,'data');if(!plain(row))throw denied();scope(entry,row);
  for(const key of riskColumns)own(row,key);
  // RETURN r is the whole native row, not a reduced id DTO. Concurrent changes are not a local CAS.
  for(const key of Object.keys(entry.risk))if(!Object.hasOwn(row,key))throw denied();
  for(const[key,column]of Object.entries(fields)){
   const actual=own(row,column),expected=own(entry.form,key);
   if(key==='professionalRationale'){if(actual!==sqlTrim(String(expected)))throw denied();}
   else if(key==='nextReviewAt'){if(expected===null?actual!==null:instant(actual)===null||instant(actual)!==instant(expected))throw denied();}
   else if(actual!==expected)throw denied();
  }
  if(instant(own(row,'updated_at'))===null)throw denied();return true;
 }catch{return false;}
}
function finish(entry:Entry,status:CareRiskReviewWriteSummary['status']):CareRiskReviewOutcome{
 const currentAtReturn=gate(entry);entry.summary=Object.freeze({status,requestStarted:entry.requestStarted,nativeExecutorEntered:entry.nativeExecutorEntered,currentAtReturn});
 const token=Object.freeze({});entry.outcome=token;outcomes.set(token,entry);return token;
}

/** Existing RPC only. A RiskROW acknowledgment is not an Audit/Actor, clinical review, CAS,
 * active-case or immutable-history proof. No retry, schema change, UI binding or browser persistence. */
export class CareRiskReviewWrite{
 constructor(getAccess:()=>CareRiskReviewWriteAccess,reader:FallRiskReviewOriginalReader,receipt:FallRiskReviewReceipt){controllers.set(this,{alive:false,lifetime:0,checkingEntry:null,access:getAccess,reader,receipt});}
 mount():void{const c=controllers.get(this)!;if(!c.alive){c.alive=true;c.lifetime++;}}
 dispose():void{const c=controllers.get(this)!;c.alive=false;c.lifetime++;}
 capture(riskId:string,input:CareRiskReviewForm):CareRiskReviewIntent|null{
  try{
   const c=controllers.get(this)!;if(c.checkingEntry){c.checkingEntry.valid=false;throw denied();}if(!c.alive||!(c.reader instanceof FallRiskReviewOriginalReader)||!woundUuid(riskId))throw denied();
   const originals=currentFallRiskReviewOriginalsWeb(c.reader,c.receipt),{context}=access(c.access),db=getSupabaseClient();if(!originals||!db)throw denied();
   const root=originals.sis.assessment;if(own(root,'id')!==context.assessmentId||own(root,'tenant_id')!==context.owner.tenantId||own(root,'subject_id')!==context.clientId||own(root,'subject_type')!=='client')throw denied();
   const candidates=originals.sis.pools.risks.filter(row=>row.id===riskId);if(candidates.length!==1)throw denied();const risk=candidates[0],captured=form(input);
   for(const key of riskColumns)own(risk,key);
   // The original replacement fields must exist and be representable too. No silent source defaults.
   const source=Object.fromEntries(Object.entries(fields).map(([key,column])=>[key,own(risk,column)]));form(source,false);
   if(typeof own(risk,'risk_key')!=='string')throw denied();own(risk,'created_at');own(risk,'updated_at');
   const target=[context.owner.tenantId,context.clientId,context.assessmentId,riskId].map(id=>id.toLowerCase()).join('/');
   const previous=journals.get(target);if(previous&&(!previous.summary||previous.summary.status!=='risk_response_acknowledged'||previous.originals.sis===originals.sis||previous.controller.receipt===c.receipt))throw denied();
   const payload=freezeClientNativeOriginal(cloneClientNativeOriginal(captured));
   const entry:Entry={controller:c,lifetime:c.lifetime,valid:true,checking:false,used:false,context,db,originals,risk,form:captured,payload,target,requestStarted:false,nativeExecutorEntered:false,nativeResult:null,summary:null,outcome:null};scope(entry,risk);if(!gate(entry))throw denied();
   const token=Object.freeze({});intents.set(token,entry);return token;
  }catch{return null;}
 }
 async execute(intent:CareRiskReviewIntent):Promise<CareRiskReviewOutcome|null>{
  const entry=intents.get(intent),c=controllers.get(this);if(!entry||entry.controller!==c||entry.used)return null;entry.used=true;
  if(!gate(entry))return finish(entry,'blocked_before_request');
  const previous=journals.get(entry.target);if(previous&&(!previous.summary||previous.summary.status!=='risk_response_acknowledged'||previous.originals.sis===entry.originals.sis||previous.controller.receipt===c!.receipt))return finish(entry,'blocked_before_request');
  journals.set(entry.target,entry);
  try{
   if(!gate(entry))throw denied();
   // RPC factory entry may already start transport. Latch before even reading its accessor.
   entry.requestStarted=true;
   const rpc=entry.db.rpc;if(typeof rpc!=='function'||!gate(entry))throw denied();
   const query=Reflect.apply(rpc,entry.db,['review_care_risk',{p_risk_id:entry.risk.id,p_payload:entry.payload}]);
   const result=await withServiceQueryTimeout(new Promise<unknown>((resolve,reject)=>{
    let settled=false;
    const fulfilled=(value:unknown)=>{if(settled)return;settled=true;try{entry.nativeResult=freezeClientNativeOriginal(cloneClientNativeOriginal(value));resolve(entry.nativeResult);}catch(error){reject(error);}};
    const rejected=(error:unknown)=>{if(settled)return;settled=true;reject(error);};
    // First actual SDK reply is retained before the timeout consumer, even after dispose.
    // A late reply never upgrades an already uncertain outcome, releases its journal or grants UI.
    try{const then=query?.then,sameThen=query?.then;if(typeof then!=='function'||sameThen!==then||!gate(entry))throw denied();entry.nativeExecutorEntered=true;Reflect.apply(then,query,[fulfilled,rejected]);}catch(error){rejected(error);}
   }));
   // Decode the actual native fact first, even after unmount/permission loss; follow-up is separate.
   return finish(entry,acknowledged(entry,result)?'risk_response_acknowledged':'uncertain');
  }catch{
   if(!entry.requestStarted&&journals.get(entry.target)===entry)journals.delete(entry.target);
   return finish(entry,entry.requestStarted?'uncertain':'blocked_before_request');
  }
 }
 summary(outcome:CareRiskReviewOutcome):CareRiskReviewWriteSummary|null{const e=outcomes.get(outcome);return e!==undefined&&e.controller===controllers.get(this)?e.summary:null;}
 mayFollowup(outcome:CareRiskReviewOutcome):boolean{const e=outcomes.get(outcome);return !!e&&e.controller===controllers.get(this)&&e.summary?.status==='risk_response_acknowledged'&&e.outcome===outcome&&journals.get(e.target)===e&&gate(e);}
 /** Current private composition only. Never Child/Query/Shared/AI props. Actual server-before,
  * audit UUID/reviewer and audit timestamp are not returned by this RPC. */
 currentOriginals(outcome:CareRiskReviewOutcome):Readonly<{before:ClientNativeRow;form:CareRiskReviewForm;payload:ClientNativeRow;nativeResult:unknown}>|null{
  const e=outcomes.get(outcome);if(!e||e.controller!==controllers.get(this)||e.outcome!==outcome||!gate(e))return null;
  return Object.freeze({before:e.risk,form:e.form,payload:e.payload,nativeResult:e.nativeResult});
 }
}
