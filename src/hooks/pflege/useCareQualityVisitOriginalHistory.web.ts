import {useEffect,useRef} from 'react';
import {useAuth} from '@/lib/auth/context';
import {useServiceTenantId} from '@/hooks/useTenantId';
import {useAsyncQuery} from '@/hooks/core';
import {useCareRuntimePermissions} from './useCareRuntimePermissions.web';
import {getServiceMode} from '@/lib/services/mode';
import {getSupabaseClient} from '@/lib/supabase/client';
import {CareQualityVisitOriginalReader,VISIT_ORIGINAL_READ_KEYS} from '@/lib/pflege/careQualityVisitOriginals.web';
import type {CareQualityVisitOriginalReceipt} from '@/lib/pflege/careQualityVisitOriginals.web';
import {captureCareQualityVisitOriginalHistoryWeb} from '@/lib/pflege/careQualityVisitOriginalHistory.web';
import {sameClientNativeOriginal} from '@/lib/clients/clientRecordNativeOriginal.web';
import {currentCareQualityVisitParentSelectionWeb} from '@/screens/pflege/PflegeDedicatedScreens.web';
import type {CareQualityVisitParentSelectionWeb} from '@/screens/pflege/PflegeDedicatedScreens.web';

export type CareQualityVisitHistoryProjectionWeb=NonNullable<ReturnType<typeof captureCareQualityVisitOriginalHistoryWeb>>;
type Runtime=ReturnType<typeof useCareRuntimePermissions>;
type Envelope=Readonly<{owner:object;key:string;ticket:number;history:CareQualityVisitHistoryProjectionWeb}>;
type Generation={valid:boolean;alive:boolean;checking:boolean;selection:CareQualityVisitParentSelectionWeb|null;factory:unknown;origin:Runtime['permissions'];can:Runtime['can'];sdk:unknown;reader:CareQualityVisitOriginalReader;ticket:number;trusted:{receipt:CareQualityVisitOriginalReceipt;envelope:Envelope}|null};
const denied='Die eigene Auswahl der Visitenoriginale ist nicht mehr zum Lesen bestätigt.';
/** Native rights are independent from the source-owned Parentselection; raw receipts stay in this hook. */
export function useCareQualityVisitOriginalHistory(captureSelection:unknown){
 const auth=useAuth(),tenantId=useServiceTenantId(),runtime=useCareRuntimePermissions();
 const latest=useRef({auth,tenantId,runtime,captureSelection}),current=useRef<Generation|null>(null);
 latest.current={auth,tenantId,runtime,captureSelection};
 const selection=currentCareQualityVisitParentSelectionWeb(captureSelection);
 if(!current.current||current.current.selection!==selection||current.current.origin!==runtime.permissions||current.current.factory!==captureSelection){
  if(current.current){current.current.valid=false;current.current.trusted=null;current.current.reader.dispose();}
  const generation:Generation={valid:true,alive:false,checking:false,selection,factory:captureSelection,origin:runtime.permissions,can:runtime.can,sdk:getSupabaseClient(),ticket:0,trusted:null,
   reader:new CareQualityVisitOriginalReader(()=>{
    assertCurrent(generation);
    const context=latest.current;
    return {auth:context.auth,tenantId:context.tenantId,clientId:generation.selection!.clientId,permissions:generation.origin,can:key=>{
     assertCurrent(generation);return generation.can(key)===true&&context.runtime.can(key)===true;
    }};
   })
  };
  current.current=generation;
 }
 const generation=current.current;
 function assertCurrent(entry:Generation):void{
  const local=()=>entry.valid&&entry.alive&&current.current===entry&&entry.selection!==null;
  if(!local()||entry.checking){entry.valid=false;entry.trusted=null;throw Error(denied);}entry.checking=true;
  try{
   const context=latest.current;
   if(context.captureSelection!==entry.factory||context.runtime.permissions!==entry.origin||context.tenantId!==entry.selection!.tenantId||context.runtime.tenantId!==entry.selection!.tenantId
    ||currentCareQualityVisitParentSelectionWeb(entry.factory,entry.selection!)!==entry.selection)throw Error(denied);
   const grants=()=>VISIT_ORIGINAL_READ_KEYS.every(key=>entry.can(key)===true&&context.runtime.can(key)===true);
   if(!grants()||getSupabaseClient()!==entry.sdk||!entry.sdk||getServiceMode()!=='supabase'||getSupabaseClient()!==entry.sdk)throw Error(denied);
   if(currentCareQualityVisitParentSelectionWeb(entry.factory,entry.selection!)!==entry.selection||getServiceMode()!=='supabase'||getSupabaseClient()!==entry.sdk||getServiceMode()!=='supabase'||!grants()||!local())throw Error(denied);
  }catch(error){entry.valid=false;entry.trusted=null;throw error;}finally{entry.checking=false;}
 }
 useEffect(()=>{generation.alive=true;generation.reader.mount();return()=>{generation.alive=false;generation.valid=false;generation.ticket++;generation.trusted=null;generation.reader.dispose();};},[generation]);
 const enabled=!!selection&&VISIT_ORIGINAL_READ_KEYS.every(key=>runtime.can(key)===true);
 const query=useAsyncQuery<Envelope>(async()=>{
  const ticket=++generation.ticket;generation.trusted=null;
  try{
   assertCurrent(generation);
   const result=await generation.reader.read();assertCurrent(generation);
   if(ticket!==generation.ticket)throw Error(denied);if(!result.ok)return result;
   const history=captureCareQualityVisitOriginalHistoryWeb(generation.reader,result.data,generation.selection!.visitId);
   assertCurrent(generation);if(!history||ticket!==generation.ticket)throw Error('Die ausgewählte native Visite ist in den gelieferten Originalen nicht bestätigt.');
   const envelope=Object.freeze({owner:generation.selection!.owner,key:generation.selection!.key,ticket,history});
   generation.trusted={receipt:result.data,envelope};return{ok:true as const,data:envelope};
  }catch(error){return{ok:false as const,error:error instanceof Error?error.message:denied};}
 },[generation],{enabled,queryKey:'visit-original-history:'+selection?.key});
 const latestQuery=useRef(query);latestQuery.current=query;
 const shown=query.data,shownTicket=generation.ticket;
 const view=():CareQualityVisitHistoryProjectionWeb|null=>{
  try{
   assertCurrent(generation);const q=latestQuery.current;
   if(!shown||q.data!==shown||generation.ticket!==shownTicket||generation.trusted?.envelope!==shown||shown.ticket!==generation.ticket||shown.owner!==generation.selection!.owner||shown.key!==generation.selection!.key
    ||q.loading||q.refreshing||q.error!==null||q.refreshError!==null||q.previewData||q.tableMissing||q.cacheMeta.fromCache||q.cacheMeta.partialDetail)return null;
   const history=captureCareQualityVisitOriginalHistoryWeb(generation.reader,generation.trusted.receipt,generation.selection!.visitId);
   assertCurrent(generation);return history&&sameClientNativeOriginal(history,shown.history)?shown.history:null;
  }catch{return null;}
 };
 const refresh=async()=>{
  try{assertCurrent(generation);if(latestQuery.current.loading||latestQuery.current.refreshing||latestQuery.current.data!==shown||generation.ticket!==shownTicket)return;await query.refresh();}catch{/* Query owns the error; stale callbacks do not issue another read. */}
 };
 return {view,refresh,loading:query.loading,refreshing:query.refreshing,error:query.error??query.refreshError,available:enabled};
}
