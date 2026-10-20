import type {ServiceResult} from '@/types';
import {getSupabaseClient} from '@/lib/supabase/client';
import {getServiceMode} from '@/lib/services/mode';
import {fromUnknownTable} from '@/lib/supabase/untypedTable';
import {withServiceQueryTimeout} from '@/lib/services/queryTimeout';
import {carePermissionOwner,sameCarePermissionOwner,type CarePermissionOwner,type CarePermissionAuth} from '@/lib/permissions/carePermissionOwner.web';
import {cloneClientNativeOriginal,freezeClientNativeOriginal,sameClientNativeOriginal,type ClientNativeRow} from '@/lib/clients/clientRecordNativeOriginal.web';
import {woundUuid} from '../pflege/woundCareDomain';

/** `permissions` must be the latest actual native-hook frozen list, not a copied/reused list or an old query envelope. */
export type MentalHealthAccess={auth:CarePermissionAuth;tenantId:string|null;clientId:string;assessmentId:string;can:(key:'pflege.plans.view')=>boolean;permissions:readonly unknown[]};
export type MentalHealthReceipt=Readonly<{kind:'mental_health_originals';counts:Readonly<Record<MentalHealthPool,number>>}>;
export type MentalHealthRawOriginals=Readonly<{assessment:ClientNativeRow;pools:Readonly<Record<MentalHealthPool,readonly ClientNativeRow[]>>}>;
export const MENTAL_HEALTH_POOLS={topics:'care_assessment_topics',risks:'care_assessment_risks',measures:'care_assessment_measures',evaluations:'care_assessment_evaluations',events:'care_assessment_events',links:'care_assessment_links',versions:'care_assessment_versions'} as const;
export type MentalHealthPool=keyof typeof MENTAL_HEALTH_POOLS;
type NativeContext={owner:CarePermissionOwner;clientId:string;assessmentId:string;can:MentalHealthAccess['can'];permissionOrigin:readonly unknown[]};
type Entry={serial:number;lifetime:number;valid:boolean;checking:boolean;context:NativeContext;db:NonNullable<ReturnType<typeof getSupabaseClient>>;originals:MentalHealthRawOriginals|null};
type ReaderState={alive:boolean;lifetime:number;serial:number;readonly access:()=>MentalHealthAccess;readonly receipts:WeakMap<MentalHealthReceipt,Entry>};
const readers=new WeakMap<object,ReaderState>();
const denied=()=>Error('Der eigene vollständige narrative SIS-Originalbestand ist nicht aktuell oder nicht freigegeben.');
const plain=(v:unknown):v is ClientNativeRow=>!!v&&typeof v==='object'&&!Array.isArray(v)&&[Object.prototype,null].includes(Object.getPrototypeOf(v));
function own(value:unknown,key:string,optional=false):unknown{
 if(!plain(value))throw denied();const d=Object.getOwnPropertyDescriptor(value,key);
 if(!d){if(optional)return undefined;throw denied();}if(!('value'in d)||!d.enumerable)throw denied();return d.value;
}
function identity(value:unknown):{id:string;roleKey?:string|null}|null{
 if(value===null)return null;const id=own(value,'id'),roleKey=own(value,'roleKey',true);
 if(!woundUuid(id)||roleKey!==undefined&&roleKey!==null&&typeof roleKey!=='string')throw denied();return{id,roleKey};
}
/** Project only actual auth data descriptors, without executing getters or cloning auth callbacks. */
function captureAuth(raw:unknown):CarePermissionAuth{
 const profile=own(raw,'profile'),session=own(raw,'session'),p=identity(profile);
 const authReady=own(raw,'authReady'),isAuthenticated=own(raw,'isAuthenticated'),isLoading=own(raw,'isLoading'),profileBootstrapError=own(raw,'profileBootstrapError'),portalSession=own(raw,'portalSession');
 if(typeof authReady!=='boolean'||typeof isAuthenticated!=='boolean'||typeof isLoading!=='boolean'||profileBootstrapError!==null&&typeof profileBootstrapError!=='string'||portalSession!==null)throw denied();
 const user=identity(own(raw,'user')),s=session===null?null:{user:identity(own(session,'user'))!,accessToken:own(session,'accessToken'),expiresAt:own(session,'expiresAt')};
 if(s&&(typeof s.accessToken!=='string'||s.expiresAt!==null&&(typeof s.expiresAt!=='number'||!Number.isFinite(s.expiresAt))))throw denied();
 const tenantId=p===null?null:own(profile,'tenantId');if(tenantId!==null&&typeof tenantId!=='string')throw denied();
 return{authReady,isAuthenticated,isLoading,profileBootstrapError,portalSession,profile:p===null?null:{...p,tenantId},user,session:s as CarePermissionAuth['session']};
}
type ExpectedContext={owner:CarePermissionOwner|null;clientId:string;assessmentId:string;db:unknown};
function expectedContext(input:unknown):ExpectedContext{
 const keys=['auth','tenantId','clientId','assessmentId','sdk'];
 if(!plain(input)||Reflect.ownKeys(input).some(k=>typeof k!=='string'||!keys.includes(k)))throw denied();
 const auth=captureAuth(own(input,'auth')),tenantId=own(input,'tenantId'),clientId=own(input,'clientId'),assessmentId=own(input,'assessmentId'),db=own(input,'sdk');
 if(tenantId!==null&&!woundUuid(tenantId)||!woundUuid(clientId)||!woundUuid(assessmentId)||db!==null&&typeof db!=='object')throw denied();
 return{owner:carePermissionOwner(auth,tenantId as string|null,false),clientId,assessmentId,db};
}
function captureContext(getAccess:()=>MentalHealthAccess):NativeContext{
 const input=getAccess(),auth=captureAuth(own(input,'auth'));
 const tenantId=own(input,'tenantId'),clientId=own(input,'clientId'),assessmentId=own(input,'assessmentId'),can=own(input,'can'),permissionOrigin=own(input,'permissions');
 const permissionCopy=cloneClientNativeOriginal(permissionOrigin);
 if(!Array.isArray(permissionCopy)||!Object.isFrozen(permissionOrigin)||permissionCopy.some(key=>typeof key!=='string')||!permissionCopy.includes('pflege.plans.view'))throw denied();
 const owner=carePermissionOwner(auth,typeof tenantId==='string'?tenantId:null,false);
 if(!owner||owner.demo||!woundUuid(clientId)||!woundUuid(assessmentId)||typeof can!=='function')throw denied();
 return{owner,clientId,assessmentId,can:can as MentalHealthAccess['can'],permissionOrigin:permissionOrigin as readonly unknown[]};
}
function sameContext(a:NativeContext,b:NativeContext):boolean{return sameCarePermissionOwner(a.owner,b.owner)&&a.clientId===b.clientId&&a.assessmentId===b.assessmentId&&a.permissionOrigin===b.permissionOrigin;}
function scope(row:ClientNativeRow,context:NativeContext,parent:boolean):void{
 const required=parent?['id','tenant_id','subject_type','subject_id']:['id','tenant_id','assessment_id'];if(required.some(key=>!Object.hasOwn(row,key)))throw denied();
 if(!woundUuid(row.id)||row.tenant_id!==context.owner.tenantId||(parent?row.id!==context.assessmentId||row.subject_type!=='client'||row.subject_id!==context.clientId:row.assessment_id!==context.assessmentId))throw denied();
 // Supplied known scope fields cannot silently contradict this own assessment. No absent column is invented.
 if(Object.hasOwn(row,'client_id')&&row.client_id!==context.clientId||Object.hasOwn(row,'subject_type')&&row.subject_type!=='client'||Object.hasOwn(row,'subject_id')&&row.subject_id!==context.clientId)throw denied();
}
function knownSnapshotScope(value:unknown,context:NativeContext,parent:boolean):void{
 if(!plain(value))return;const keys=parent?['id','tenant_id','subject_type','subject_id']:['id','tenant_id','assessment_id'];
 if(keys.some(key=>Object.hasOwn(value,key)))scope(value,context,parent);
}
/** Native transition snapshots and unknown legacy JSON are distinct; no reconstructed revision/array. */
function historicalReference(row:ClientNativeRow,context:NativeContext):void{
 const snap=Object.hasOwn(row,'snapshot')?row.snapshot:undefined;if(!plain(snap))return;knownSnapshotScope(Object.hasOwn(snap,'assessment')?snap.assessment:undefined,context,true);
 for(const key of ['topics','risks','measures']){
  const items=Object.hasOwn(snap,key)?snap[key]:undefined;if(!Array.isArray(items))continue;const seen=new Set<string>();
  for(const item of items){knownSnapshotScope(item,context,false);if(plain(item)&&Object.hasOwn(item,'id')&&woundUuid(item.id)){const id=item.id.toLowerCase();if(seen.has(id))throw denied();seen.add(id);}}
 }
}
function page(input:unknown,context:NativeContext,cursor:string|null,kind:MentalHealthPool):ClientNativeRow[]{
 const cloned=cloneClientNativeOriginal(input);if(!Array.isArray(cloned))throw denied();let previous=cursor;
 for(const row of cloned){if(!plain(row))throw denied();scope(row,context,false);const id=String(row.id).toLowerCase();if(previous!==null&&id<=previous)throw denied();previous=id;if(kind==='versions')historicalReference(row,context);}
 return freezeClientNativeOriginal(cloned);
}
function parentRow(input:unknown,context:NativeContext):ClientNativeRow{const row=cloneClientNativeOriginal(input);if(!plain(row))throw denied();scope(row,context,true);return freezeClientNativeOriginal(row);}
function response(value:unknown):unknown{
 const cloned=cloneClientNativeOriginal(value);if(!plain(cloned)||!Object.hasOwn(cloned,'error')||cloned.error!==null||!Object.hasOwn(cloned,'data')||Object.hasOwn(cloned,'status')&&(!Number.isSafeInteger(cloned.status)||Number(cloned.status)<200||Number(cloned.status)>=300))throw denied();return cloned.data;
}
/** Private SELECT-only own narrative SIS rows and actually supplied stored snapshots. No active Pflegecase,
 * psychiatric diagnosis, immutable/full as-of revisions, clinical performance or atomic DB snapshot is proven. */
export class MentalHealthOriginalReader{
 constructor(getAccess:()=>MentalHealthAccess){readers.set(this,{alive:false,lifetime:0,serial:0,access:getAccess,receipts:new WeakMap()});}
 mount():void{const state=readers.get(this);if(state&&!state.alive){state.alive=true;state.lifetime++;}}
 dispose():void{const state=readers.get(this);if(state){state.alive=false;state.lifetime++;state.serial++;}}
 async read():Promise<ServiceResult<MentalHealthReceipt>>{
  const state=readers.get(this);if(!state)return{ok:false,error:denied().message};let entry:Entry|null=null;const serial=++state.serial;
  try{
   if(!state.alive||typeof state.access!=='function')throw denied();const context=captureContext(state.access),db=getSupabaseClient();if(!db)throw denied();
   entry={serial,lifetime:state.lifetime,valid:true,checking:false,context,db,originals:null};gate(state,entry);
   const dispatch=async(build:()=>PromiseLike<unknown>):Promise<unknown>=>{
    gate(state,entry!);const query=build();
    const result=await withServiceQueryTimeout(new Promise<unknown>((resolve,reject)=>{try{const then=query?.then,sameThen=query?.then;if(typeof then!=='function'||sameThen!==then)throw denied();gate(state,entry!);Reflect.apply(then,query,[resolve,reject]);}catch(error){reject(error);}}));
    gate(state,entry!);const resultData=response(result);gate(state,entry!);return resultData;
   };
   const ownParent=()=>fromUnknownTable(db,'care_assessments').select('*').eq('tenant_id',context.owner.tenantId).eq('id',context.assessmentId).eq('subject_type','client').eq('subject_id',context.clientId).maybeSingle();
   const assessment=parentRow(await dispatch(ownParent),context);gate(state,entry);
   const pools={} as Record<MentalHealthPool,ClientNativeRow[]>;
   for(const[kind,table]of Object.entries(MENTAL_HEALTH_POOLS) as [MentalHealthPool,string][]){
    const rows:ClientNativeRow[]=[];let cursor:string|null=null;
    for(;;){const raw=await dispatch(()=>{let query=fromUnknownTable(db,table).select('*').eq('tenant_id',context.owner.tenantId).eq('assessment_id',context.assessmentId).order('id',{ascending:true}).limit(200);if(cursor!==null)query=query.gt('id',cursor);return query;});
     const delivered=page(raw,context,cursor,kind);gate(state,entry);if(!delivered.length)break;rows.push(...delivered);cursor=String(delivered[delivered.length-1].id).toLowerCase();}
    pools[kind]=rows;
   }
   const after=parentRow(await dispatch(ownParent),context);gate(state,entry);if(!sameClientNativeOriginal(assessment,after))throw Error('Die ganze gelieferte SIS-Kopffassung hat sich während des Lesens geändert. Keine gemischte Quellenfassung bestätigen.');
   entry.originals=freezeClientNativeOriginal({assessment,pools});gate(state,entry);
   const receipt=Object.freeze({kind:'mental_health_originals' as const,counts:Object.freeze(Object.fromEntries(Object.entries(pools).map(([key,rows])=>[key,rows.length])) as Record<MentalHealthPool,number>)});state.receipts.set(receipt,entry);return{ok:true,data:receipt};
  }catch(error){if(entry)entry.valid=false;return{ok:false,error:error instanceof Error?error.message:'Der eigene Originalbestand ist ungeklärt.'};}
 }
 current(receipt:MentalHealthReceipt):boolean{return currentMentalHealthOriginalsWeb(this,receipt)!==null;}
 /** Private raw composition only; fixed lookup does not trust an overridable receiver method. */
 currentOriginals(receipt:MentalHealthReceipt):MentalHealthRawOriginals|null{return currentMentalHealthOriginalsWeb(this,receipt);}
}
function ownEntry(state:ReaderState,entry:Entry):void{if(!entry.valid||!state.alive||entry.lifetime!==state.lifetime||entry.serial!==state.serial)throw denied();}
function authority(state:ReaderState,entry:Entry):void{
  ownEntry(state,entry);if(typeof state.access!=='function')throw denied();
  const current=captureContext(state.access);if(!sameContext(current,entry.context))throw denied();
  const grant:unknown=current.can('pflege.plans.view');if(grant!==true){if(grant instanceof Promise)void grant.catch(()=>{});throw denied();}
  if(!sameContext(captureContext(state.access),entry.context))throw denied();ownEntry(state,entry);
 }
function gate(state:ReaderState,entry:Entry):void{
  if(!entry.valid)throw denied();if(entry.checking){entry.valid=false;throw denied();}entry.checking=true;
  try{
   authority(state,entry);
   // SDK and mode accessors can invalidate the native permission read. Inspect authority AFTER both,
   // including expiry without render and refresh with the same SDK/IDs; no old grant may revive.
   if(getSupabaseClient()!==entry.db||getServiceMode()!=='supabase')throw denied();
   authority(state,entry);
   // A native can/context callback may in turn change mode. Recheck it, then inspect native grants
   // once more because the mode accessor itself may expire/refresh them. Bounded checks, no retry.
   if(getServiceMode()!=='supabase')throw denied();authority(state,entry);ownEntry(state,entry);
   // Close a mode/context accessor's replacement of the captured SDK before any native dispatch.
   // These are bounded observations of the actual read-only runtime accessors/native can, not a
   // generic callback grant or a retry loop. Keep authority/lifetime binding after accessor entry.
   if(getSupabaseClient()!==entry.db)throw denied();authority(state,entry);
   if(getServiceMode()!=='supabase'||getSupabaseClient()!==entry.db)throw denied();
   authority(state,entry);ownEntry(state,entry);
  }catch(error){entry.valid=false;throw error;}finally{entry.checking=false;}
 }

export function currentMentalHealthOriginalsWeb(reader:unknown,receipt:unknown):MentalHealthRawOriginals|null{
 if(!reader||typeof reader!=='object')return null;const state=readers.get(reader),entry=state?.receipts.get(receipt as MentalHealthReceipt);if(!state||!entry)return null;
 try{gate(state,entry);return entry.originals;}catch{return null;}
}
/** Bool-only cross-context check; each real own origin stays independently current. */
export function isCurrentMentalHealthOriginalContextWeb(reader:unknown,receipt:unknown,exactRaw:unknown,expected:unknown):boolean{
 let wanted:ExpectedContext;try{wanted=expectedContext(expected);}catch{return false;}
 if(!reader||typeof reader!=='object')return false;const state=readers.get(reader),entry=state?.receipts.get(receipt as MentalHealthReceipt);if(!state||!entry)return false;
 try{gate(state,entry);}catch{return false;}
 if(entry.originals===null||entry.originals!==exactRaw||!wanted.owner||!sameCarePermissionOwner(entry.context.owner,wanted.owner)||entry.context.clientId!==wanted.clientId||entry.context.assessmentId!==wanted.assessmentId||entry.db!==wanted.db)return false;
 try{gate(state,entry);return entry.originals===exactRaw;}catch{return false;}
}
