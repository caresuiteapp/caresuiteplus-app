import type { ClientIntakeFormData } from '@/types/forms/clientIntakeForm';
import type { IntakeSectionKey } from './clientIntakeFieldRules';
import type { ClientRecordEditController, ClientEditReadLease, ClientEditAttempt } from './clientRecordEditController.web';
import { isOwnClientEditOriginalRead, type ClientEditOriginalRead } from './clientRecordEditRead.web';
import { mayContinueClientEditCoreWriteWeb, type ClientEditCoreIntent, type ClientEditCoreOutcome } from './clientRecordEditCoreWrite.web';
import { planClientEditExtendedWeb, type ClientEditExtendedPlan, type ClientEditExtendedStep } from './clientRecordEditExtendedPlan.web';
import { cloneClientNativeOriginal, freezeClientNativeOriginal, sameClientNativeOriginal, captureClientNativePage, type ClientNativeRow } from './clientRecordNativeOriginal.web';
import { woundInstant } from '../pflege/woundCareDomain.ts';
import { getSupabaseClient } from '@/lib/supabase/client';
import { getServiceMode } from '@/lib/services/mode';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { withServiceQueryTimeout } from '@/lib/services/queryTimeout';

export type ClientEditExtendedCoreBinding = Readonly<{intent: ClientEditCoreIntent; currentOutcome: () => ClientEditCoreOutcome | null}>;
export type ClientEditExtendedIntent = Readonly<{ form: ClientIntakeFormData; sections: readonly IntakeSectionKey[] }>;
export type ClientEditExtendedAcknowledgement = Readonly<{ table: string; mode: 'insert'|'update'; nativeResult: unknown }>;
export type ClientEditExtendedOutcome = Readonly<{
  phase: 'extended'; status: 'acknowledged' | 'partial' | 'blocked' | 'uncertain'; writeStarted: boolean;
  currentAtReturn: boolean; acknowledgements: readonly ClientEditExtendedAcknowledgement[];
  requiredOtherPhases: readonly string[]; nativeResult: unknown; error?: string;
}>;
type Entry = { controller: ClientRecordEditController; lease: ClientEditReadLease; read: ClientEditOriginalRead;
  plan: ClientEditExtendedPlan; core: ClientEditExtendedCoreBinding | null; canManageContacts: () => boolean;
  contactsRequired: boolean; contactsClosed: boolean; coreClosed: boolean; runtimeClosed: boolean; sdk: NonNullable<ReturnType<typeof getSupabaseClient>>; used: boolean; attempt: ClientEditAttempt | null;
  outcome: ClientEditExtendedOutcome | null };
const intents=new WeakMap<ClientEditExtendedIntent,Entry>(), consumedAttempts=new WeakSet<ClientEditAttempt>();
const deny=()=>Error('Die private Extended-Phase ist nicht in ihrer eigenen aktuellen Originalbearbeitung und bestätigten Corefortsetzung freigegeben.');
function runtime(entry:Entry):void {
  if(entry.runtimeClosed||getServiceMode()!=='supabase'||getSupabaseClient()!==entry.sdk){entry.runtimeClosed=true;throw deny();}
}
function contacts(entry:Entry):void {
  if(entry.contactsRequired){
    if(entry.contactsClosed)throw deny();
    try{const value:unknown=entry.canManageContacts();if(value instanceof Promise)void value.catch(()=>{});if(value!==true)throw deny();}
    catch(error){entry.contactsClosed=true;throw error;}
  }
}
function gate(entry:Entry,attempt?:ClientEditAttempt):void {
  runtime(entry);entry.controller.assertRead(entry.lease);
  if(attempt)entry.controller.assertCurrentAttempt(attempt);
  contacts(entry);
  if(attempt&&entry.plan.coreRequired){
    if(entry.coreClosed||!entry.core)throw deny();
    try{
      const value:unknown=entry.core.currentOutcome();
      if(value instanceof Promise)void value.catch(()=>{});
      if(!value||typeof value!=='object'||value instanceof Promise||!mayContinueClientEditCoreWriteWeb(entry.core.intent,attempt,value as ClientEditCoreOutcome))throw deny();
    }catch(error){entry.coreClosed=true;throw error;}
  }
  contacts(entry);entry.controller.assertRead(entry.lease);if(attempt)entry.controller.assertCurrentAttempt(attempt);
  // Callbacks, current-own assertions and SDK then getters can reenter runtime.
  runtime(entry);if(entry.contactsClosed||entry.coreClosed)throw deny();
}
const current=(entry:Entry,attempt:ClientEditAttempt):boolean=>{try{gate(entry,attempt);return true;}catch{return false;}};
/** Query-free whole target capture before the caller begins its ONE attempt.
 * A required Core binding is checked against that module's OWN intent/outcome
 * verifier at execution. An unrelated callback/boolean cannot mint a Core ACK.
 * With no changed Core target, this plan requires no Core receipt at all. */
export function captureClientEditExtendedWriteWeb(
  controller:ClientRecordEditController,lease:ClientEditReadLease,read:ClientEditOriginalRead,
  form:ClientIntakeFormData,sections:readonly IntakeSectionKey[]|undefined,core:ClientEditExtendedCoreBinding|null,canManageContacts:()=>boolean,
):ClientEditExtendedIntent|null {
  try {
    controller.assertRead(lease);
    if(!isOwnClientEditOriginalRead(lease,read)||read.original!==lease.original||typeof canManageContacts!=='function')throw deny();
    if(getServiceMode()!=='supabase')throw deny();const sdk=getSupabaseClient();if(!sdk)throw deny();
    const plan=planClientEditExtendedWeb(read,form,sections);
    if(plan.coreRequired&&(!core||typeof core.currentOutcome!=='function'||!sameClientNativeOriginal(core.intent?.form,plan.form)||!sameClientNativeOriginal(core.intent?.sections,plan.sections)))throw deny();
    // Copy the original callbacks once; replacing supplied binding properties
    // cannot move this captured phase onto another owner or minted Core receipt.
    const binding=plan.coreRequired&&core?Object.freeze({intent:core.intent,currentOutcome:core.currentOutcome}):null;
    const entry:Entry={controller,lease,read,plan,core:binding,canManageContacts,
      contactsRequired:plan.steps.some(step=>step.table==='client_contacts'),contactsClosed:false,coreClosed:false,runtimeClosed:false,sdk,used:false,attempt:null,outcome:null};
    // Whole capture may cross expiry or synchronously reenter a native owner gate.
    gate(entry);const intent=Object.freeze({form:plan.form,sections:plan.sections});intents.set(intent,entry);return intent;
  }catch{return null;}
}
const object=(value:unknown):value is ClientNativeRow=>!!value&&typeof value==='object'&&!Array.isArray(value);
const own=(row:ClientNativeRow,key:string):unknown=>Object.hasOwn(row,key)?row[key]:(()=>{throw deny();})();
const time=(value:unknown)=>typeof value==='string'&&woundInstant(value.replace(' ','T'))!==null;
function acknowledgement(entry:Entry,step:ClientEditExtendedStep,raw:unknown,prior:readonly ClientEditExtendedAcknowledgement[]):ClientEditExtendedAcknowledgement {
  const evidence=freezeClientNativeOriginal(cloneClientNativeOriginal(raw));
  if(!object(evidence)||own(evidence,'error')!==null||typeof own(evidence,'status')!=='number'
    ||!Number.isInteger(evidence.status)||Number(evidence.status)<200||Number(evidence.status)>299)throw deny();
  const native=captureClientNativePage([own(evidence,'data')],entry.lease.original.scope,null)[0];
  for(const[key,value]of Object.entries(step.payload))if(!sameClientNativeOriginal(own(native,key),value))throw deny();
  if(step.original){
    if(native.id!==step.original.id||!time(own(native,'updated_at')))throw deny();
    for(const[key,value]of Object.entries(step.original)){
      if(Object.hasOwn(step.payload,key)||key==='updated_at')continue;
      // Supplied full_name, when present, must agree with the explicitly changed
      // native name parts. It is read back only; no generated column is written.
      if(key==='full_name'&&(Object.hasOwn(step.payload,'first_name')||Object.hasOwn(step.payload,'last_name'))){
        const name=[own(native,'first_name'),own(native,'last_name')].filter(value=>value!==null&&value!=='').join(' ').trim();
        if(own(native,key)!==name)throw deny();
      }else if(!sameClientNativeOriginal(own(native,key),value))throw deny();
    }
  }else {
    if(step.table!=='client_care_contexts'||step.createdColumns.some(key=>!Object.hasOwn(native,key))||!time(native.created_at))throw deny();
    const existing=entry.read.original.recordNative.careContexts??[];
    if(existing.some(row=>row.id===native.id)||prior.some(ack=>ack.table===step.table&&object(ack.nativeResult)&&object(ack.nativeResult.data)&&ack.nativeResult.data.id===native.id))throw deny();
  }
  return Object.freeze({table:step.table,mode:step.mode,nativeResult:evidence});
}
function outcome(entry:Entry|null,status:ClientEditExtendedOutcome['status'],writeStarted:boolean,
  acknowledgements:readonly ClientEditExtendedAcknowledgement[],evidence:unknown,error?:string):ClientEditExtendedOutcome {
  const value=Object.freeze({phase:'extended' as const,status,writeStarted,currentAtReturn:!!entry?.attempt&&current(entry,entry.attempt),
    acknowledgements:Object.freeze([...acknowledgements]),requiredOtherPhases:entry?.plan.requiredOtherPhases??Object.freeze([]),nativeResult:evidence,error});
  if(entry)entry.outcome=value;return value;
}
/** Own phased facts only, never a WholeSave ACK/release. No begin, finish,
 * retry, fallback, clinical completion, account sync or document promotion. */
export async function executeClientEditExtendedWriteWeb(intent:ClientEditExtendedIntent,attempt:ClientEditAttempt):Promise<ClientEditExtendedOutcome> {
  const entry=intents.get(intent);if(!entry||entry.used||consumedAttempts.has(attempt))return outcome(null,'blocked',false,[],null);
  entry.used=true;let invoked=false,stepInvoked=false,evidence:unknown=null;
  const acknowledgements:ClientEditExtendedAcknowledgement[]=[];
  try {
    gate(entry,attempt);
    if(!sameClientNativeOriginal(attempt.form,entry.plan.form)||!sameClientNativeOriginal(attempt.sections,entry.plan.sections)
      ||!sameClientNativeOriginal(attempt.changes,entry.plan.changes))throw deny();
    if(getServiceMode()!=='supabase')throw deny();entry.attempt=attempt;consumedAttempts.add(attempt);
    if(entry.plan.steps.length){
      const db=entry.sdk;gate(entry,attempt);
      for(const step of entry.plan.steps){
        stepInvoked=false;gate(entry,attempt);
        const scope=entry.lease.original.scope;
        const raw=await withServiceQueryTimeout(entry.controller.dispatchNativeWrite(attempt,()=>{
          invoked=true;stepInvoked=true;gate(entry,attempt);
          let query=step.mode==='update'
            ?fromUnknownTable(db,step.table).update(step.payload).eq('id',step.original!.id).eq('tenant_id',scope.tenantId)
              .eq('client_id',scope.clientId).eq('updated_at',step.original!.updated_at)
            :fromUnknownTable(db,step.table).insert(step.payload);
          if(step.original)for(const[key,value]of Object.entries(step.predicates)){query=value===null?query.is(key,null):query.eq(key,value);
          }
          const selected=query.select('*').single();
          return {then<TResult1=unknown,TResult2=never>(
            onfulfilled?:((value:unknown)=>TResult1|PromiseLike<TResult1>)|null,
            onrejected?:((reason:unknown)=>TResult2|PromiseLike<TResult2>)|null,
          ):Promise<TResult1|TResult2>{
            return new Promise<unknown>((resolve,reject)=>{
              try{const then=selected?.then;gate(entry,attempt);if(typeof then!=='function')throw deny();then.call(selected,resolve,reject);}catch(error){reject(error);}
            }).then(onfulfilled,onrejected);
          }};
        }));
        // Preserve the native result before any current follow-up gate. A known
        // ACK remains a fact after permission loss; it grants no subsequent step.
        evidence=freezeClientNativeOriginal(cloneClientNativeOriginal(raw));
        const ack=acknowledgement(entry,step,evidence,acknowledgements);acknowledgements.push(ack);stepInvoked=false;
        if(step!==entry.plan.steps[entry.plan.steps.length-1])gate(entry,attempt);
      }
    }
    return outcome(entry,'acknowledged',invoked,acknowledgements,evidence);
  }catch(error){
    const status=stepInvoked?'uncertain':acknowledgements.length?'partial':invoked?'uncertain':'blocked';
    return outcome(entry,status,invoked,acknowledgements,evidence,error instanceof Error?error.message:'Der native Extended-Schritt ist ungeklärt.');
  }
}
/** Fresh own phase continuation only. Other required phases and final receipt
 * remain the future WholeSave caller's responsibility; journal is untouched. */
export function mayContinueClientEditExtendedWriteWeb(intent:ClientEditExtendedIntent,attempt:ClientEditAttempt,value:ClientEditExtendedOutcome):boolean {
  const entry=intents.get(intent);return !!entry&&entry.used&&entry.attempt===attempt&&entry.outcome===value
    &&value.status==='acknowledged'&&value.acknowledgements.length===entry.plan.steps.length&&current(entry,attempt);
}
