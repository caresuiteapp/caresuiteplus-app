import type { ServiceResult } from '@/types';
import { getServiceMode } from '@/lib/services/mode';
import { getSupabaseClient } from '@/lib/supabase/client';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { withServiceQueryTimeout } from '@/lib/services/queryTimeout';
import { woundInstant, woundUuid } from '../pflege/woundCareDomain.ts';
import { cloneClientNativeOriginal, freezeClientNativeOriginal, sameClientNativeOriginal, captureClientNativeRoot, type ClientNativeRow } from './clientRecordNativeOriginal.web';
import { CLIENT_FINAL_PHASE_POOLS, clientEditFinalPhaseReadContextWeb, type ClientFinalPhasePlan, type ClientFinalPhasePool, type ClientFinalPhaseCoreBinding } from './clientRecordEditFinalPhasePlan.web';

/** Private inspection originals only. No component props, mutation readiness,
 * entitlement approval, atomic snapshot or completion of a whole save. */
export type ClientFinalPhaseRead=Readonly<{
  phase:'pre_core'|'post_core';wholeSave:'unsupported';
  originals:Readonly<{client:ClientNativeRow;pools:Partial<Record<ClientFinalPhasePool,readonly ClientNativeRow[]>>|null;selectors:Readonly<Record<string,string>>}>;
  requested:'requested'|'not_requested';unresolved:readonly string[];queriedPools:readonly string[];
}>;
type Context=ReturnType<typeof clientEditFinalPhaseReadContextWeb>;
type Entry={plan:ClientFinalPhasePlan;context:Context;valid:boolean;finished:boolean;result:ClientFinalPhaseRead|null;binding:ClientFinalPhaseCoreBinding|undefined};
const generations=new WeakMap<ClientFinalPhasePlan,Entry>();
const owners=new WeakMap<Context['controller'],Entry>();
const minted=new WeakMap<ClientFinalPhaseRead,Entry>();
const denied=()=>Error('Die eigene vollständige Schlussphasen-Leseprüfung ist nicht aktuell bestätigt.');
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
function runtime(entry:Entry):void {
  try{if(!entry.valid||generations.get(entry.plan)!==entry||owners.get(entry.context.controller)!==entry||getServiceMode()!=='supabase'||getSupabaseClient()!==entry.context.db||getServiceMode()!=='supabase')throw denied();}
  catch(error){entry.valid=false;throw error;}
}
function current(entry:Entry,binding?:ClientFinalPhaseCoreBinding):void {
  try{const context=clientEditFinalPhaseReadContextWeb(entry.plan,binding);
    if(context.controller!==entry.context.controller||context.lease!==entry.context.lease||context.read!==entry.context.read||context.db!==entry.context.db)throw denied();runtime(entry);
  }catch(error){entry.valid=false;throw error;}
}
function captureBinding(input:ClientFinalPhaseCoreBinding):ClientFinalPhaseCoreBinding {
  if(!object(input)||![Object.prototype,null].includes(Object.getPrototypeOf(input))||Reflect.ownKeys(input).length!==3)throw denied();
  const values:Record<string,unknown>={};for(const key of ['attempt','intent','outcome']){const d=Object.getOwnPropertyDescriptor(input,key);if(!d||!('value'in d)||!d.enumerable)throw denied();values[key]=d.value;}
  return Object.freeze(values) as ClientFinalPhaseCoreBinding;
}
function capturePage(input:unknown,pool:ClientFinalPhasePool,scope:{tenantId:string;clientId:string},cursor:string|null):ClientNativeRow[]{
  const page=cloneClientNativeOriginal(input);if(!Array.isArray(page)||!woundUuid(scope.tenantId)||!woundUuid(scope.clientId))throw denied();
  let previous=cursor?.toLowerCase()??null;
  for(const row of page){if(!object(row)||!Object.hasOwn(row,'id')||!woundUuid(row.id))throw denied();
    const namespace=CLIENT_FINAL_PHASE_POOLS[pool];
    if(namespace!=='global'&&(!Object.hasOwn(row,'tenant_id')||row.tenant_id!==scope.tenantId)
      ||namespace==='client'&&(!Object.hasOwn(row,'client_id')||row.client_id!==scope.clientId))throw denied();
    const id=String(row.id).toLowerCase();if(previous!==null&&id<=previous)throw denied();previous=id;
  }
  return freezeClientNativeOriginal(page);
}
const references:Partial<Record<ClientFinalPhasePool,readonly [string,ClientFinalPhasePool,boolean][]>>={
  client_service_profiles:[['service_type_id','tenant_client_service_types',false]],tenant_service_type_rules:[['service_type_id','tenant_client_service_types',false]],
  client_budget_settings:[['budget_year_id','tenant_budget_years',false],['budget_type_id','tenant_budget_types',false]],client_budget_movements:[['budget_setting_id','client_budget_settings',false]],
  tenant_budget_defaults:[['budget_year_id','tenant_budget_years',false],['budget_type_id','tenant_budget_types',false]],tenant_service_type_budget_rules:[['service_type_id','tenant_client_service_types',false],['budget_type_id','tenant_budget_types',false]],
  client_service_entitlements:[['service_type_id','tenant_client_service_types',true]],client_budget_accounts:[['catalog_template_id','budget_template_catalog',true]],client_budget_transactions:[['budget_account_id','client_budget_accounts',false]],
  client_service_portal_settings:[['service_type_id','tenant_client_service_types',false]],tenant_service_type_portal_rules:[['service_type_id','tenant_client_service_types',false]],
};
const dates:Partial<Record<ClientFinalPhasePool,readonly [string,boolean][]>>={
  client_service_profiles:[['started_on',true],['ended_on',true]],client_funding_selections:[['effective_from',false]],client_care_entitlement:[['valid_from',false],['valid_until',true]],client_service_entitlements:[['valid_from',false],['valid_until',true]],client_budget_accounts:[['period_start',false],['period_end',false]],
};
const dateKnown=(v:unknown)=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number(v.slice(0,4))>0&&woundInstant(v+'T00:00:00Z')!==null;
/** Reports whole delivered relations. Missing targets remain unresolved, including
 * global records hidden by RLS. No active/head/primary filtering of raw history. */
function relations(plan:ClientFinalPhasePlan,pools:Partial<Record<ClientFinalPhasePool,ClientNativeRow[]>>):string[]{
  const unresolved=[...plan.blockers];
  for(const [table,rows]of Object.entries(pools) as [ClientFinalPhasePool,ClientNativeRow[]][]){
    for(const row of rows){const prefix=table+':'+row.id;
      for(const [key,target,nullable]of references[table]??[]){const value=row[key];
        if(Object.hasOwn(row,key)&&value===null&&nullable)continue;
        if(!Object.hasOwn(row,key)||!woundUuid(value)||!pools[target]?.some(r=>String(r.id).toLowerCase()===String(value).toLowerCase()))unresolved.push('native_fk_not_delivered:'+prefix+':'+key);
      }
      for(const [key,nullable]of dates[table]??[]){if(!Object.hasOwn(row,key)||row[key]===null?!Object.hasOwn(row,key)||!nullable:!dateKnown(row[key]))unresolved.push('native_source_date_unknown:'+prefix+':'+key);}
      for(const key of ['created_by','actor_id'])if(Object.hasOwn(row,key)&&row[key]!==null&&!woundUuid(row[key]))unresolved.push('native_actor_unknown:'+prefix+':'+key);
      if(table==='tenant_budget_years'&&(!Number.isInteger(row.budget_year)||Number(row.budget_year)<1))unresolved.push('native_budget_year_unknown:'+prefix);
      if(table==='client_budget_accounts'&&(!Number.isInteger(row.catalog_year)||Number(row.catalog_year)<1))unresolved.push('native_budget_year_unknown:'+prefix);
      if(table==='client_funding_selections'&&(!Array.isArray(row.sources)||row.sources.length===0||row.sources.some(v=>!['entlastungsleistung','umwandlung','verhinderungspflege','selbstzahler'].includes(String(v)))||new Set(row.sources).size!==row.sources.length))unresolved.push('native_funding_sources_unknown:'+prefix);
    }
  }
  for(const table of ['client_service_profiles','client_insurance_profiles'] as const)if((pools[table]??[]).filter(row=>row.is_primary===true).length>1)unresolved.push('native_primary_ambiguous:'+table);
  if(plan.changes.includes('careContexts')){
    const mapping:Record<string,string>={daily_assistance:'alltagsbegleitung',support_care:'betreuung',companionship:'begleitung',ambulatory_care:'ambulante_pflege',stationary_care:'stationaere_pflege',consulting:'beratung'};
    if(!Array.isArray(plan.form.careContexts)||new Set(plan.form.careContexts).size!==plan.form.careContexts.length)unresolved.push('explicit_context_ambiguous');
    for(const key of plan.form.careContexts){const type=mapping[key],rows=pools.tenant_client_service_types??[];
      if(!type||rows.filter(row=>row.service_type_key===type&&row.care_context_key===key).length!==1||rows.find(row=>row.service_type_key===type&&row.care_context_key===key)?.is_active!==true)unresolved.push('explicit_native_service_target_unresolved:'+key);
    }
  }
  return [...new Set(unresolved)];
}
function rootBasis(entry:Entry,binding?:ClientFinalPhaseCoreBinding):{root:ClientNativeRow;selector:string}{
  const native=entry.context.read.original.fullNative,original=native.parts.client,selector=native.selectors.clients;
  if(typeof selector!=='string'||!selector||!sameClientNativeOriginal(original,entry.context.read.original.recordNative.parts.client))throw denied();
  if(!binding||binding.outcome.status==='not_required'){
    if(binding&&binding.outcome.nativeResult!==null)throw denied();return {root:original,selector};
  }
  if(binding.outcome.status!=='acknowledged')throw denied();
  const reply=cloneClientNativeOriginal(binding.outcome.nativeResult);
  if(!object(reply)||reply.error!==null||!Object.hasOwn(reply,'data'))throw denied();
  const ack=captureClientNativeRoot(reply.data,entry.context.lease.original.scope);
  if(selector==='*')return {root:ack,selector};
  // Own fixed Core verifier already owns this exact ACK. Its selected values
  // extend only actually requested Original columns, never an invented '*'.
  const keys=[...new Set([...selector.split(',').map(k=>k.trim()),...Object.keys(ack)])];
  return {root:freezeClientNativeOriginal({...original,...ack}),selector:keys.join(',')};
}
async function read(entry:Entry,binding?:ClientFinalPhaseCoreBinding):Promise<ClientFinalPhaseRead>{
  const gate=()=>current(entry,binding),scope=entry.context.lease.original.scope,db=entry.context.db;
  const dispatch=async(work:()=>PromiseLike<unknown>)=>{
    gate();const query=work();
    const raw=await withServiceQueryTimeout(new Promise<unknown>((resolve,reject)=>{try{const then=query?.then;gate();if(typeof then!=='function')throw denied();Reflect.apply(then,query,[resolve,reject]);}catch(error){reject(error);}}));
    gate();const reply=cloneClientNativeOriginal(raw);gate();
    if(!object(reply)||!Object.hasOwn(reply,'error')||reply.error!==null||!Object.hasOwn(reply,'data')||!Object.hasOwn(reply,'status')||!Number.isInteger(reply.status)||Number(reply.status)<200||Number(reply.status)>299)throw denied();
    return reply.data;
  };
  const requested=entry.plan.requiredPools.length===0||scope.canSensitive===true;
  const pools:Partial<Record<ClientFinalPhasePool,ClientNativeRow[]>>={},selectors:Record<string,string>={},queriedPools:string[]=[];
  if(requested)for(const table of entry.plan.requiredPools){
    const rows:ClientNativeRow[]=[];let cursor:string|null=null;selectors[table]='*';queriedPools.push(table);
    for(;;){const data=await dispatch(()=>{let q=fromUnknownTable(db,table).select('*');const namespace=CLIENT_FINAL_PHASE_POOLS[table];if(namespace!=='global')q=q.eq('tenant_id',scope.tenantId);if(namespace==='client')q=q.eq('client_id',scope.clientId);q=q.order('id',{ascending:true}).limit(200);if(cursor!==null)q=q.gt('id',cursor);return q;});
      const page=capturePage(data,table,scope,cursor);gate();if(page.length===0)break;rows.push(...page);cursor=String(page[page.length-1].id).toLowerCase();
    }pools[table]=rows;
  }
  const unresolved=requested?relations(entry.plan,pools):[...entry.plan.blockers,'required_originals_not_requested'];gate();
  const expected=rootBasis(entry,binding);gate();selectors.clients=expected.selector;
  const root=captureClientNativeRoot(await dispatch(()=>db.from('clients').select(expected.selector).eq('tenant_id',scope.tenantId).eq('id',scope.clientId).single()),scope);gate();
  if(!sameClientNativeOriginal(root,expected.root))throw denied();
  const result=freezeClientNativeOriginal({phase:binding?'post_core' as const:'pre_core' as const,wholeSave:'unsupported' as const,
    originals:{client:root,pools:requested?pools:null,selectors},requested:requested?'requested' as const:'not_requested' as const,unresolved,queriedPools});gate();
  entry.finished=true;entry.result=result;entry.binding=binding;minted.set(result,entry);return result;
}
export function isOwnClientFinalPhaseReadWeb(plan:ClientFinalPhasePlan,result:ClientFinalPhaseRead,binding?:ClientFinalPhaseCoreBinding):boolean {
  try{const entry=minted.get(result);if(!entry||entry.plan!==plan||!entry.finished||entry.result!==result)throw denied();
    const captured=binding===undefined?undefined:captureBinding(binding);
    if(entry.binding===undefined?captured!==undefined:captured===undefined||captured.intent!==entry.binding.intent||captured.attempt!==entry.binding.attempt||captured.outcome!==entry.binding.outcome)throw denied();
    current(entry,captured);return true;}catch{return false;}
}
export async function fetchClientEditFinalPhaseReadWeb(plan:ClientFinalPhasePlan):Promise<ServiceResult<ClientFinalPhaseRead>>{
  let entry:Entry|undefined;
  try{const context=clientEditFinalPhaseReadContextWeb(plan);const previous=owners.get(context.controller);if(previous)previous.valid=false;
    entry={plan,context,valid:true,finished:false,result:null,binding:undefined};generations.set(plan,entry);owners.set(context.controller,entry);current(entry);return {ok:true,data:await read(entry)};
  }catch(error){if(entry)entry.valid=false;return {ok:false,error:error instanceof Error?error.message:'Die Schlussphasen-Originale sind ungeklärt.'};}
}
/** Same original preflight and actual own Core triplet only. SELECT revalidation
 * cannot justify an unknown required target retroactively or authorize a write. */
export async function revalidateClientEditFinalPhaseReadWeb(plan:ClientFinalPhasePlan,preflight:ClientFinalPhaseRead,core:ClientFinalPhaseCoreBinding):Promise<ServiceResult<ClientFinalPhaseRead>>{
  let entry:Entry|undefined;
  try{const binding=captureBinding(core);entry=minted.get(preflight);
    if(!entry||entry.plan!==plan||entry.result!==preflight||preflight.phase!=='pre_core'||!entry.finished||preflight.requested!=='requested')throw denied();
    // Required later writers are intentionally unsupported. This inspection can
    // verify an existing separate Core-only attempt, not start a whole chain.
    if(plan.requiredPools.length!==0)throw denied();current(entry,binding);entry.finished=false;return {ok:true,data:await read(entry,binding)};
  }catch(error){if(entry)entry.valid=false;return {ok:false,error:error instanceof Error?error.message:'Die eigene Core-Fortsetzung ist ungeklärt.'};}
}
