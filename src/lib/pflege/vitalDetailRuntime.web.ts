import {assertVitalSdkOwnerWeb} from './vitalSdkOwner.web.ts';
import {carePermissionOwner,carePermissionOwnerIsCurrent,sameCarePermissionOwner,type CarePermissionAuth,type CarePermissionOwner} from '../permissions/carePermissionOwner.web.ts';
import {getSupabaseClient} from '../supabase/client';
import {getServiceMode} from '../services/mode';

/** Private read leases are empty objects; native identity and permission origins stay in WeakMaps. */
export type VitalDetailRuntimeWeb=Readonly<Record<never,never>>;
export type VitalDetailReadLeaseWeb=Readonly<Record<never,never>>;
type PermissionSource={tenantId:unknown;roleKey:unknown;can(permission:'pflege.vitals.view'):boolean};
export type VitalDetailRuntimeInputWeb={
  auth():CarePermissionAuth;tenantId():unknown;measurementId():unknown;
  expectedClientId?():unknown;permissions():PermissionSource;alive():boolean;
};
type SDK=NonNullable<ReturnType<typeof getSupabaseClient>>;
type Runtime={input:VitalDetailRuntimeInputWeb;capturing:boolean;checking:boolean;reentered:boolean};
type Lease={runtime:Runtime;owner:CarePermissionOwner;client:SDK;measurementId:string;expectedClientId:string|undefined;can:PermissionSource['can'];permissionSource:PermissionSource;closed:boolean;checking:boolean;rawAuthId:string|null};
const runtimes=new WeakMap<object,Runtime>(),leases=new WeakMap<object,Lease>();
const failure=()=>new Error('Der aktuelle native Lesezugriff auf diese Messung ist nicht bestätigt.');
const uuid=(value:unknown):value is string=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
function record(value:unknown):Record<string,unknown>{
  if(!value||typeof value!=='object'||![Object.prototype,null].includes(Object.getPrototypeOf(value)))throw failure();
  return value as Record<string,unknown>;
}
function own(value:unknown,key:string):unknown{const descriptor=Object.getOwnPropertyDescriptor(record(value),key);if(!descriptor)return undefined;if(!('value'in descriptor)||!descriptor.enumerable)throw failure();return descriptor.value;}
function identity(value:unknown,profile=false){const roleKey=own(value,'roleKey');if(roleKey!=null&&typeof roleKey!=='string')throw failure();return{id:own(value,'id'),roleKey,...(profile?{tenantId:own(value,'tenantId')}:{})};}
function authProjection(value:unknown):CarePermissionAuth{
  const profile=own(value,'profile'),user=own(value,'user'),session=own(value,'session'),bootstrapError=own(value,'profileBootstrapError'),portalSession=own(value,'portalSession');
  if((bootstrapError!==null&&typeof bootstrapError!=='string')||(portalSession!==null&&portalSession!==undefined))throw failure();
  return{authReady:own(value,'authReady'),isAuthenticated:own(value,'isAuthenticated'),isLoading:own(value,'isLoading'),profileBootstrapError:bootstrapError,portalSession,
    profile:profile==null?null:identity(profile,true),user:user==null?null:identity(user),session:session==null?null:{user:identity(own(session,'user')),accessToken:own(session,'accessToken'),expiresAt:own(session,'expiresAt')}} as CarePermissionAuth;
}
function granted(value:unknown):boolean{if(value===true)return true;if(value instanceof Promise)void Promise.prototype.then.call(value,undefined,()=>{});return false;}
function invoke(runtime:Runtime,callback:()=>unknown):unknown{if(runtime.reentered)throw failure();const value=Reflect.apply(callback,runtime.input,[]);if(runtime.reentered)throw failure();return value;}
function scope(runtime:Runtime){
  const input=runtime.input,tenant=invoke(runtime,input.tenantId),measurementId=invoke(runtime,input.measurementId),expectedClientId=input.expectedClientId?invoke(runtime,input.expectedClientId):undefined;
  if(!uuid(tenant)||!uuid(measurementId)||(expectedClientId!==undefined&&!uuid(expectedClientId)))throw failure();
  const owner=carePermissionOwner(authProjection(invoke(runtime,input.auth)),tenant,false);
  if(!owner||!Number.isSafeInteger(owner.expiresAt??0)||!granted(invoke(runtime,input.alive)))throw failure();
  const supplied=invoke(runtime,input.permissions) as PermissionSource,permissionSource=record(supplied),can=own(permissionSource,'can');
  if(own(permissionSource,'tenantId')!==tenant||own(permissionSource,'roleKey')!==owner.roleKey||typeof can!=='function'||!granted(can.call(supplied,'pflege.vitals.view')))throw failure();
  if(runtime.reentered)throw failure();return{owner,measurementId,expectedClientId,permissionSource:supplied,can:can as PermissionSource['can']};
}
function native(lease:Lease){
  if(lease.closed||lease.runtime.reentered)throw failure();
  // Observe SDK immediately after every mode read; these are local checks, not an atomic backend snapshot.
  for(let check=0;check<3;check++){if(getServiceMode()!=='supabase'||getSupabaseClient()!==lease.client)throw failure();}
}
function current(lease:Lease){
  if(lease.checking||lease.runtime.checking){lease.closed=true;lease.runtime.reentered=true;throw failure();}
  lease.checking=true;lease.runtime.checking=true;
  try{
    if(lease.closed||lease.runtime.reentered||!carePermissionOwnerIsCurrent(lease.owner))throw failure();
    native(lease);
    const latest=scope(lease.runtime);
    if(lease.runtime.reentered)throw failure();
    if(!sameCarePermissionOwner(latest.owner,lease.owner)||latest.measurementId!==lease.measurementId||latest.expectedClientId!==lease.expectedClientId||!granted(lease.can.call(lease.permissionSource,'pflege.vitals.view')))throw failure();
    // Repeat observed native mode/SDK checks after supplied callbacks; no atomic transport snapshot is inferred.
    native(lease);
    if(!granted(invoke(lease.runtime,lease.runtime.input.alive))||!granted(lease.can.call(lease.permissionSource,'pflege.vitals.view')))throw failure();
    native(lease);
    // Native SDK accessors may have synchronously revoked the captured permission/read lifetime.
    // Finish on pure native caller identity/lifetime and Can checks, with no SDK accessor afterward.
    const finalScope=scope(lease.runtime);
    if(lease.runtime.reentered||!sameCarePermissionOwner(finalScope.owner,lease.owner)||finalScope.measurementId!==lease.measurementId||finalScope.expectedClientId!==lease.expectedClientId||!granted(lease.can.call(lease.permissionSource,'pflege.vitals.view')))throw failure();
  }catch(error){lease.closed=true;throw error;}finally{lease.checking=false;lease.runtime.checking=false;}
}
export function createVitalDetailRuntimeWeb(input:VitalDetailRuntimeInputWeb):VitalDetailRuntimeWeb{
  const value=record(input),captured:Record<string,unknown>={};
  for(const key of ['auth','tenantId','measurementId','expectedClientId','permissions','alive']){
    const callback=own(value,key);if(callback===undefined&&key==='expectedClientId')continue;
    if(typeof callback!=='function')throw failure();captured[key]=callback;
  }
  const token=Object.freeze({});runtimes.set(token,{input:Object.freeze(captured) as unknown as VitalDetailRuntimeInputWeb,capturing:false,checking:false,reentered:false});return token;
}
export function captureVitalDetailReadWeb(runtime:VitalDetailRuntimeWeb):VitalDetailReadLeaseWeb|null{
  const ownRuntime=runtimes.get(runtime);if(!ownRuntime||ownRuntime.reentered)return null;
  if(ownRuntime.capturing||ownRuntime.checking){ownRuntime.reentered=true;return null;}
  ownRuntime.capturing=true;
  try{
    if(getServiceMode()!=='supabase')return null;
    const captured=scope(ownRuntime),client=getSupabaseClient();if(!client)return null;
    const lease:Lease={runtime:ownRuntime,...captured,client,closed:false,checking:false,rawAuthId:null};current(lease);
    const token=Object.freeze({});leases.set(token,lease);return token;
  }catch{return null;}finally{ownRuntime.capturing=false;}
}
export function assertVitalDetailReadWeb(token:VitalDetailReadLeaseWeb):void{const lease=leases.get(token);if(!lease)throw failure();current(lease);}
export function closeVitalDetailReadWeb(token:VitalDetailReadLeaseWeb):void{const lease=leases.get(token);if(lease)lease.closed=true;}
/** Internal reader bridge: no AuthSession/token/profile or clinical RawOriginal is exposed. */
export function vitalDetailReadContextWeb(token:VitalDetailReadLeaseWeb){const lease=leases.get(token);if(!lease)throw failure();current(lease);return Object.freeze({client:lease.client,tenantId:lease.owner.tenantId,measurementId:lease.measurementId,expectedClientId:lease.expectedClientId});}
export async function assertVitalDetailSessionWeb(token:VitalDetailReadLeaseWeb,pinnedAuthId:string|null=null):Promise<string>{
 const lease=leases.get(token);if(!lease)throw failure();
 try{if(lease.rawAuthId!==null&&pinnedAuthId!==null&&lease.rawAuthId!==pinnedAuthId)throw failure();const rawAuthId=await assertVitalSdkOwnerWeb({client:lease.client,owner:lease.owner,pinnedAuthId:lease.rawAuthId??pinnedAuthId,current:()=>current(lease)});current(lease);lease.rawAuthId=rawAuthId;return rawAuthId;}catch(error){lease.closed=true;throw error;}
}
