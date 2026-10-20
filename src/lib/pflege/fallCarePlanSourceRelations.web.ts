import {currentMentalHealthOriginalsWeb,isCurrentMentalHealthOriginalContextWeb} from '@/lib/careAssessment/mentalHealthOriginals.web';
import {currentFallRiskReviewOriginalsWeb,isCurrentFallRiskReviewOriginalContextWeb,isCurrentFallRiskReviewSisBindingWeb} from './fallRiskReviewOriginals.web';
import {currentCareQualityVisitOriginalsWeb,isCurrentCareQualityVisitOriginalContextWeb,type CareQualityVisitOriginalReceipt} from './careQualityVisitOriginals.web';
import {carePermissionOwner,sameCarePermissionOwner,type CarePermissionAuth,type CarePermissionOwner} from '@/lib/permissions/carePermissionOwner.web';
import {freezeClientNativeOriginal,type ClientNativeRow} from '@/lib/clients/clientRecordNativeOriginal.web';
import {woundUuid} from './woundCareDomain';

export type FallCarePlanSourceController=Readonly<Record<never,never>>;
export type FallCarePlanSourceToken=Readonly<Record<never,never>>;
/** Private identity supplier, never a permission callback or a write/navigation capability. */
export type FallCarePlanSourceInput={mentalReader:unknown;mentalReceipt:unknown;fallReader:unknown;fallReceipt:unknown;visitReader:unknown;visitReceipt:unknown;getFrame:()=>unknown};
export type FallCarePlanOriginalField=Readonly<{state:'missing'|'undefined'|'null'|'empty'|'value'|'unprojected_unknown';value?:string|number|boolean|null}>;
export type FallCarePlanSourceProjection=Readonly<{
 kind:'saved_care_plan_source_reference';planId:string;assessmentId:string;
 source:Readonly<{state:'own_source_assessment_reference'|'other_saved_uuid'|'saved_null_source_reference'|'missing'|'undefined'|'empty'|'invalid';raw?:string|number|boolean|null}>;
 metadata:Readonly<Record<string,FallCarePlanOriginalField>>;
}>;
type Frame={expected:{auth:CarePermissionAuth;tenantId:string;clientId:string;assessmentId:string;sdk:object};owner:CarePermissionOwner};
type Originals={m:NonNullable<ReturnType<typeof currentMentalHealthOriginalsWeb>>;f:NonNullable<ReturnType<typeof currentFallRiskReviewOriginalsWeb>>;v:NonNullable<ReturnType<typeof currentCareQualityVisitOriginalsWeb>>};
type State={input:FallCarePlanSourceInput;frame:Frame;originals:Originals;alive:boolean;checking:boolean;serial:number};
type Entry={state:State;serial:number;plan:ClientNativeRow;projection:FallCarePlanSourceProjection};
const controllers=new WeakMap<object,State>(),tokens=new WeakMap<object,Entry>();
const denied=()=>Error('Der eigene aktuelle Pflegeplan-Quellbezug ist nicht bestätigt.');
const plain=(v:unknown):v is ClientNativeRow=>!!v&&typeof v==='object'&&!Array.isArray(v)&&[Object.prototype,null].includes(Object.getPrototypeOf(v));
function own(v:unknown,key:string,optional=false):unknown{
 if(!plain(v))throw denied();const d=Object.getOwnPropertyDescriptor(v,key);if(!d){if(optional)return undefined;throw denied();}if(!d.enumerable||!('value'in d))throw denied();return d.value;
}
function exact(v:unknown,keys:readonly string[]):void{if(!plain(v)||Reflect.ownKeys(v).some(k=>typeof k!=='string'||!keys.includes(k)))throw denied();}
function identity(raw:unknown):{id:string;roleKey?:string|null}|null{
 if(raw===null)return null;const id=own(raw,'id'),roleKey=own(raw,'roleKey',true);if(!woundUuid(id)||roleKey!==undefined&&roleKey!==null&&typeof roleKey!=='string')throw denied();return{id,roleKey};
}
function auth(raw:unknown):CarePermissionAuth{
 const authReady=own(raw,'authReady'),isAuthenticated=own(raw,'isAuthenticated'),isLoading=own(raw,'isLoading'),profileBootstrapError=own(raw,'profileBootstrapError'),portalSession=own(raw,'portalSession');
 if(typeof authReady!=='boolean'||typeof isAuthenticated!=='boolean'||typeof isLoading!=='boolean'||profileBootstrapError!==null&&typeof profileBootstrapError!=='string'||portalSession!==null)throw denied();
 const profile=own(raw,'profile'),p=identity(profile),tenantId=p===null?null:own(profile,'tenantId'),user=identity(own(raw,'user')),session=own(raw,'session');
 if(tenantId!==null&&typeof tenantId!=='string')throw denied();
 const s=session===null?null:{user:identity(own(session,'user'))!,accessToken:own(session,'accessToken'),expiresAt:own(session,'expiresAt')};
 if(s&&(typeof s.accessToken!=='string'||s.expiresAt!==null&&(typeof s.expiresAt!=='number'||!Number.isFinite(s.expiresAt))))throw denied();
 return{authReady,isAuthenticated,isLoading,profileBootstrapError,portalSession,profile:p===null?null:{...p,tenantId},user,session:s as CarePermissionAuth['session']};
}
function frame(supplier:()=>unknown):Frame{
 const raw=supplier();if(raw instanceof Promise)void raw.catch(()=>{});exact(raw,['auth','tenantId','clientId','assessmentId','sdk']);
 const a=auth(own(raw,'auth')),tenantId=own(raw,'tenantId'),clientId=own(raw,'clientId'),assessmentId=own(raw,'assessmentId'),sdk=own(raw,'sdk');
 if(!woundUuid(tenantId)||!woundUuid(clientId)||!woundUuid(assessmentId)||!sdk||typeof sdk!=='object')throw denied();
 const owner=carePermissionOwner(a,tenantId,false);if(!owner)throw denied();
 return{owner,expected:{auth:a,tenantId,clientId,assessmentId,sdk}};
}
const sameFrame=(a:Frame,b:Frame)=>sameCarePermissionOwner(a.owner,b.owner)&&a.expected.clientId===b.expected.clientId&&a.expected.assessmentId===b.expected.assessmentId&&a.expected.sdk===b.expected.sdk;
function local(state:State):void{if(!state.alive)throw denied();}
/** Each module checks its own native origin; different genuine hook origins are not compared by pointer. */
function verify(state:State):void{
 local(state);if(state.checking){state.alive=false;throw denied();}state.checking=true;
 try{
  const i=state.input,o=state.originals,current=frame(i.getFrame);if(!sameFrame(state.frame,current))throw denied();
  const check=()=>{
   if(!isCurrentMentalHealthOriginalContextWeb(i.mentalReader,i.mentalReceipt,o.m,current.expected)
    ||!isCurrentFallRiskReviewOriginalContextWeb(i.fallReader,i.fallReceipt,o.f,current.expected)
    ||!isCurrentFallRiskReviewSisBindingWeb(i.fallReader,i.fallReceipt,i.mentalReader,i.mentalReceipt))throw denied();
   const visit={auth:current.expected.auth,tenantId:current.expected.tenantId,clientId:current.expected.clientId,sdk:current.expected.sdk};
   if(!i.visitReceipt||typeof i.visitReceipt!=='object')throw denied();
   if(!isCurrentCareQualityVisitOriginalContextWeb(i.visitReader,i.visitReceipt,o.v,visit))throw denied();
   if(currentMentalHealthOriginalsWeb(i.mentalReader,i.mentalReceipt)!==o.m||currentFallRiskReviewOriginalsWeb(i.fallReader,i.fallReceipt)!==o.f||currentCareQualityVisitOriginalsWeb(i.visitReader,i.visitReceipt)!==o.v||o.f.sis!==o.m)throw denied();
   local(state);
  };
  check();if(!sameFrame(state.frame,frame(i.getFrame)))throw denied();check();local(state);
 }catch(error){state.alive=false;throw error;}finally{state.checking=false;}
}
/** No raw sources/auth fields leave the private registry. This is no clinical or write authority. */
export function createFallCarePlanSourceRelationsWeb(raw:unknown):FallCarePlanSourceController|null{
 try{
  const keys=['mentalReader','mentalReceipt','fallReader','fallReceipt','visitReader','visitReceipt','getFrame'];exact(raw,keys);
  const input=Object.fromEntries(keys.map(key=>[key,own(raw,key)])) as FallCarePlanSourceInput;if(typeof input.getFrame!=='function')throw denied();
  const captured=frame(input.getFrame),m=currentMentalHealthOriginalsWeb(input.mentalReader,input.mentalReceipt),f=currentFallRiskReviewOriginalsWeb(input.fallReader,input.fallReceipt),v=currentCareQualityVisitOriginalsWeb(input.visitReader,input.visitReceipt as CareQualityVisitOriginalReceipt);
  if(!m||!f||!v)throw denied();const state:State={input,frame:captured,originals:{m,f,v},alive:true,checking:false,serial:0};verify(state);
  const controller=Object.freeze({});controllers.set(controller,state);return controller;
 }catch{return null;}
}
function field(row:ClientNativeRow,key:string):FallCarePlanOriginalField{
 if(!Object.hasOwn(row,key))return{state:'missing'};const value=own(row,key);
 if(value===undefined)return{state:'undefined'};if(value===null)return{state:'null',value:null};if(value==='')return{state:'empty',value:''};
 return typeof value==='string'||typeof value==='boolean'||typeof value==='number'&&Number.isFinite(value)?{state:'value',value}:{state:'unprojected_unknown'};
}
function project(row:ClientNativeRow,state:State):FallCarePlanSourceProjection{
 const raw=Object.hasOwn(row,'source_assessment_id')?own(row,'source_assessment_id'):undefined;
 const sourceState=!Object.hasOwn(row,'source_assessment_id')?'missing':raw===undefined?'undefined':raw===null?'saved_null_source_reference':raw===''?'empty':woundUuid(raw)?raw.toLowerCase()===state.frame.expected.assessmentId.toLowerCase()?'own_source_assessment_reference':'other_saved_uuid':'invalid';
 const primitive=raw===null||typeof raw==='string'||typeof raw==='boolean'||typeof raw==='number'&&Number.isFinite(raw);
 const metadata=Object.fromEntries(['version','status','valid_from','valid_until','review_due_at','approved_at','approved_by','approved_by_name','created_at','created_by','updated_at','updated_by'].map(key=>[key,field(row,key)]));
 return freezeClientNativeOriginal({kind:'saved_care_plan_source_reference',planId:own(row,'id') as string,assessmentId:state.frame.expected.assessmentId,source:{state:sourceState,...(primitive?{raw}: {})},metadata});
}
/** A new explicit selection permanently retires older tokens, including a failed selection. */
export function captureFallCarePlanSourceRelationWeb(controller:unknown,planId:unknown):FallCarePlanSourceToken|null{
 if(!controller||typeof controller!=='object')return null;const state=controllers.get(controller);if(!state)return null;
 const serial=++state.serial;
 try{
  verify(state);if(!woundUuid(planId))return null;
  const matches=state.originals.v.plans.filter(row=>woundUuid(own(row,'id'))&&(own(row,'id') as string).toLowerCase()===planId.toLowerCase());
  if(matches.length!==1)return null;const plan=matches[0];
  if(own(plan,'tenant_id')!==state.frame.expected.tenantId||own(plan,'client_id')!==state.frame.expected.clientId)throw denied();
  const projection=project(plan,state);verify(state);if(serial!==state.serial)throw denied();
  const token=Object.freeze({});tokens.set(token,{state,serial,plan,projection});return token;
 }catch{return null;}
}
/** Inspect again after every await. A copied projection alone never authorizes a retained action. */
export function currentFallCarePlanSourceRelationWeb(token:unknown):FallCarePlanSourceProjection|null{
 if(!token||typeof token!=='object')return null;const entry=tokens.get(token);if(!entry)return null;const state=entry.state;
 try{if(entry.serial!==state.serial)return null;verify(state);if(entry.serial!==state.serial||!state.originals.v.plans.includes(entry.plan))return null;return entry.projection;}catch{return null;}
}
export function disposeFallCarePlanSourceRelationsWeb(controller:unknown):void{if(controller&&typeof controller==='object'){const state=controllers.get(controller);if(state){state.alive=false;state.serial++;}}}
