import {useEffect,useRef} from 'react';
import {useAuth} from '@/lib/auth/context';
import {useServiceTenantId} from '@/hooks/useTenantId';
import {useAsyncQuery} from '@/hooks/core';
import type {useQmRuntimePermissions} from '@/hooks/qm/useQmRuntimePermissions.web';
import {qmReadOwner,sameQmReadOwner} from '@/lib/qm/qmReadOwner.web';
import type {QmReadScope} from '@/lib/qm/confirmQmReadScope.web';
import {getServiceMode} from '@/lib/services/mode';
import {getSupabaseClient} from '@/lib/supabase/client';
import {fetchQmDocument,fetchQmDocumentVersions,fetchQmReadConfirmations} from '@/lib/qm';
import {cloneClientNativeOriginal,freezeClientNativeOriginal} from '@/lib/clients/clientRecordNativeOriginal.web';
import {woundUuid} from '@/lib/pflege/woundCareDomain';
import {projectQmDocumentVersionReferenceWeb} from '@/lib/qm/qmDocumentVersionReference.web';
import type {QmVersionReferenceWeb} from '@/lib/qm/qmDocumentVersionReference.web';

type Runtime=ReturnType<typeof useQmRuntimePermissions>;
type Kind='document'|'versions'|'confirmations';
type SourceResult={ok:true;data:unknown}|{ok:false;error:string};
type RecordRead={ticket:number;original:unknown|null};
type Generation={serial:number;alive:boolean;valid:boolean;checking:boolean;authBlocked:boolean;owner:QmReadScope|null;documentId:string|null;origin:Runtime['permissions'];can:Runtime['can'];sdk:unknown;reads:Record<Kind,RecordRead>};
export type QmReferenceReadStateWeb={state:'unavailable'|'loading'|'refreshing'|'error'|'unverified_cache'|'supplied';error:string|null};
const denied='Der eigene QM-Lesezugriff ist nicht mehr aktuell.';
/** Read only own data fields of the current business identity. Never traverse inherited getters or clone credentials into public data. */
function qmAuthOwner(auth:unknown,tenantId:string|null):QmReadScope|null{return qmReadOwner(auth,tenantId);}
/** Existing three SELECT services only. Delivery is a supplied, unverified excerpt, never a database read capability. */
export function useQmDocumentReferenceRead(documentId:unknown,runtime:Runtime){
 const auth=useAuth(),tenantId=useServiceTenantId(),owner=qmAuthOwner(auth,tenantId);
 const ownId=woundUuid(documentId)?documentId:null;
 const alive=useRef(true),serial=useRef(0),current=useRef<Generation|null>(null),latest=useRef({auth,tenantId,documentId:ownId,runtime});
 latest.current={auth,tenantId,documentId:ownId,runtime};
 if(!current.current||!sameQmReadOwner(current.current.owner,owner)||current.current.documentId!==ownId||current.current.origin!==runtime.permissions||(current.current.authBlocked&&owner&&runtime.can('qm.view')===true&&runtime.can('qm.view_versions')===true&&getServiceMode()==='supabase'&&getSupabaseClient())){
  if(current.current){current.current.valid=false;for(const row of Object.values(current.current.reads))row.original=null;}
  current.current={serial:++serial.current,alive:true,valid:true,checking:false,authBlocked:false,owner,documentId:ownId,origin:runtime.permissions,can:runtime.can,sdk:getSupabaseClient(),reads:{document:{ticket:0,original:null},versions:{ticket:0,original:null},confirmations:{ticket:0,original:null}}};
 }
 const generation=current.current;
 const close=()=>{generation.valid=false;for(const row of Object.values(generation.reads))row.original=null;return false;};
 const own=()=>alive.current&&generation.alive&&generation.valid&&current.current===generation;
 const authority=()=>{
  const context=latest.current,ownOwner=qmAuthOwner(context.auth,context.tenantId);
  if(!ownOwner){generation.authBlocked=true;return false;}
  return !!generation.owner&&!!generation.documentId&&context.documentId===generation.documentId&&context.tenantId===generation.owner.tenantId
   &&context.runtime.tenantId===generation.owner.tenantId&&context.runtime.roleKey===generation.owner.roleKey&&context.runtime.permissions===generation.origin
   &&sameQmReadOwner(generation.owner,ownOwner)
   &&generation.can('qm.view')===true&&generation.can('qm.view_versions')===true&&context.runtime.can('qm.view')===true&&context.runtime.can('qm.view_versions')===true;
 };
 const isCurrent=()=>{
  if(!own())return false;if(generation.checking)return close();generation.checking=true;
  try{
   if(!authority()||getServiceMode()!=='supabase'||getSupabaseClient()!==generation.sdk||!generation.sdk||getServiceMode()!=='supabase')return close();
   // Native callback/SDK/mode accessors may synchronously change owner, permission read, or lifetime.
   if(!authority()||getSupabaseClient()!==generation.sdk||getServiceMode()!=='supabase'||getSupabaseClient()!==generation.sdk||!authority()||!own())return close();
   return true;
  }catch{return close();}finally{generation.checking=false;}
 };
 useEffect(()=>{alive.current=true;generation.alive=true;return()=>{alive.current=false;generation.alive=false;for(const row of Object.values(generation.reads)){row.ticket++;row.original=null;}};},[generation]);
 const run=async(kind:Kind):Promise<SourceResult>=>{
  const read=generation.reads[kind],ticket=++read.ticket;read.original=null;
  if(!isCurrent())return {ok:false as const,error:denied};
  const nativeOwner=generation.owner!,id=generation.documentId!;
  const confirmed=await latest.current.runtime.confirmRead();
  if(!confirmed.ok||!isCurrent()||read.ticket!==ticket)return {ok:false as const,error:confirmed.ok?denied:confirmed.error};
  const result=kind==='document'?await fetchQmDocument(nativeOwner.tenantId,id,nativeOwner.roleKey):kind==='versions'?await fetchQmDocumentVersions(nativeOwner.tenantId,id,nativeOwner.roleKey):await fetchQmReadConfirmations(nativeOwner.tenantId,id,nativeOwner.roleKey);
  if(!isCurrent()||read.ticket!==ticket)return {ok:false as const,error:denied};
  try{
   const delivered=cloneClientNativeOriginal(result);
   if(!Object.hasOwn(delivered,'ok')||typeof delivered.ok!=='boolean')return {ok:false as const,error:'Der Serviceausgang ist ungeklärt.'};
   if(delivered.ok!==true)return {ok:false as const,error:Object.hasOwn(delivered,'error')&&typeof delivered.error==='string'?delivered.error:'Der Serviceausgang ist ungeklärt.'};
   if(!Object.hasOwn(delivered,'data')||delivered.data===undefined)return {ok:false as const,error:'Der eigene Serviceausschnitt ist nicht geliefert.'};
   const original=freezeClientNativeOriginal(delivered.data);
   if(!isCurrent()||read.ticket!==ticket)return {ok:false as const,error:denied};
   read.original=original;return {...delivered,ok:true as const,data:original};
  }catch{return {ok:false as const,error:'Das gelieferte QM-Originalformat ist ungeklärt.'};}
 };
 const enabled=isCurrent(),key='qm-reference-'+generation.serial;
 const document=useAsyncQuery(()=>run('document'),[generation],{enabled,queryKey:key+'-document'});
 const versions=useAsyncQuery(()=>run('versions'),[generation],{enabled,queryKey:key+'-versions'});
 const confirmations=useAsyncQuery(()=>run('confirmations'),[generation],{enabled,queryKey:key+'-confirmations'});
 const state=(query:typeof document,kind:Kind):QmReferenceReadStateWeb=>{
  if(!isCurrent())return {state:'unavailable',error:denied};
  if(query.error||query.refreshError)return {state:'error',error:query.error??query.refreshError};
  if(query.loading)return {state:'loading',error:null};if(query.refreshing)return {state:'refreshing',error:null};
  if(query.previewData||query.tableMissing||query.cacheMeta.fromCache||query.cacheMeta.partialDetail)return {state:'unverified_cache',error:null};
  if(query.data===null||query.data===undefined||generation.reads[kind].original!==query.data)return {state:'unavailable',error:'Dieser QM-Ausschnitt ist noch nicht geliefert.'};
  return {state:'supplied',error:null};
 };
 const states={document:state(document,'document'),versions:state(versions,'versions'),confirmations:state(confirmations,'confirmations')};
 const view=():QmVersionReferenceWeb|null=>{
  if(!isCurrent()||state(document,'document').state!=='supplied'||state(versions,'versions').state!=='supplied'||state(confirmations,'confirmations').state!=='supplied')return null;
  const result=projectQmDocumentVersionReferenceWeb({document:document.data,versions:versions.data,confirmations:confirmations.data},{tenantId:generation.owner!.tenantId,documentId:generation.documentId});
  if(!result.ok||!isCurrent()||generation.reads.document.original!==document.data||generation.reads.versions.original!==versions.data||generation.reads.confirmations.original!==confirmations.data)return null;
  return result.data;
 };
 const refresh=async()=>{if(!isCurrent())return;await Promise.all([document.refresh(),versions.refresh(),confirmations.refresh()]);};
 return {states,view,isCurrent,refresh};
}
