import type { ClientIntakeFormData } from '@/types/forms/clientIntakeForm';
import type { IntakeSectionKey } from './clientIntakeFieldRules';
import type { ClientRecordEditController, ClientEditReadLease, ClientEditAttempt } from './clientRecordEditController.web';
import type { ClientEditOriginalRead } from './clientRecordEditRead.web';
import { captureClientEditCoreWriteWeb, executeClientEditCoreWriteWeb, type ClientEditCoreIntent, type ClientEditCoreOutcome } from './clientRecordEditCoreWrite.web';
import { validateIntakeStep, hasIntakeErrors } from './clientIntakeService';
import { cloneClientNativeOriginal, freezeClientNativeOriginal, sameClientNativeOriginal } from './clientRecordNativeOriginal.web';
import { getSupabaseClient } from '@/lib/supabase/client';
import { getServiceMode } from '@/lib/services/mode';

export type ClientMasterDataSavePlan = Readonly<{ form: ClientIntakeFormData; sections: readonly IntakeSectionKey[] }>;
export type ClientMasterDataSaveReceipt = Readonly<{
  phase:'stammdaten'; status:'saved'|'unchanged'|'blocked'|'uncertain'; writeStarted:boolean;
  /** Complete only for this explicit single section. No ActivationRepair or other
   * section is inferred. This native fact is not a live follow-up permission. */
  core:ClientEditCoreOutcome|null;
}>;
type Entry = {
  controller:ClientRecordEditController; lease:ClientEditReadLease; core:ClientEditCoreIntent;
  sdk:NonNullable<ReturnType<typeof getSupabaseClient>>; canChangeStatus:()=>boolean; statusChanged:boolean;
  used:boolean; closed:boolean; attempt:ClientEditAttempt|null; receipt:ClientMasterDataSaveReceipt|null; completed:boolean;
};
const plans=new WeakMap<ClientMasterDataSavePlan,Entry>();
const receipts=new WeakMap<ClientMasterDataSaveReceipt,Entry>();
const denied=()=>Error('Der eigene vollständige Stammdaten-Speicherversuch ist nicht aktuell bestätigt.');
function gate(entry:Entry):void {
  if(entry.closed)throw denied();
  try {
    if(getServiceMode()!=='supabase'||getSupabaseClient()!==entry.sdk)throw denied();
    entry.controller.assertRead(entry.lease);
    if(entry.statusChanged) {
      const value:unknown=entry.canChangeStatus();
      if(value instanceof Promise)void value.catch(()=>{});
      if(value!==true)throw denied();
    }
    entry.controller.assertRead(entry.lease);
    // Supplied permission and original accessors may themselves change runtime.
    if(entry.closed||getServiceMode()!=='supabase'||getSupabaseClient()!==entry.sdk)throw denied();
  }catch(error){entry.closed=true;throw error;}
}
function current(entry:Entry):boolean {try{gate(entry);return true;}catch{return false;}}

/** Query-free preflight. []/undefined retain ALL semantics and are unsupported
 * here; no required phase can be silently omitted or delegated to Shared. */
export function captureClientMasterDataSaveWeb(
  controller:ClientRecordEditController,lease:ClientEditReadLease,read:ClientEditOriginalRead,
  input:ClientIntakeFormData,sections:readonly IntakeSectionKey[]|undefined,canChangeStatus:()=>boolean,
):ClientMasterDataSavePlan|null {
  try {
    if(!Array.isArray(sections)||sections.length!==1||sections[0]!=='stammdaten')throw denied();
    const form=freezeClientNativeOriginal(cloneClientNativeOriginal(input));
    if(hasIntakeErrors(validateIntakeStep('stammdaten',form)))throw denied();
    const core=captureClientEditCoreWriteWeb(controller,lease,read,form,['stammdaten'],canChangeStatus);
    const sdk=getSupabaseClient();
    if(!core||!sdk)throw denied();
    const entry:Entry={controller,lease,core,sdk,canChangeStatus,statusChanged:!sameClientNativeOriginal(form.status,read.form.status),used:false,closed:false,attempt:null,receipt:null,completed:false};
    gate(entry);
    const plan=Object.freeze({form:core.form,sections:core.sections});plans.set(plan,entry);return plan;
  }catch{return null;}
}
function receipt(entry:Entry|null,status:ClientMasterDataSaveReceipt['status'],core:ClientEditCoreOutcome|null):ClientMasterDataSaveReceipt {
  const value=Object.freeze({phase:'stammdaten' as const,status,writeStarted:core?.writeStarted??false,core});
  if(entry){entry.receipt=value;receipts.set(value,entry);}return value;
}

/** Fixed recognizer for the controller. There is no supplied callback, structural
 * DTO proof or boolean exception. Only this module's own final native invocation
 * or current explicit unchanged result can mint the recognized receipt. */
export function recognizeOwnClientMasterDataSaveReceipt(
  controller:ClientRecordEditController,attempt:ClientEditAttempt,value:ClientMasterDataSaveReceipt,
):'saved'|'unchanged'|null {
  const entry=receipts.get(value);
  return entry&&entry.controller===controller&&entry.attempt===attempt&&entry.receipt===value
    &&(value.status==='saved'||value.status==='unchanged'&&current(entry))?value.status:null;
}

/** Owns exactly one begin and actual imported Core execution. No finish/retry
 * callback or old Shared fallback is accepted. An uncertain native ingress keeps
 * the conservative owner journal; a saved fact survives later permission loss. */
export async function executeClientMasterDataSaveWeb(plan:ClientMasterDataSavePlan):Promise<ClientMasterDataSaveReceipt> {
  const entry=plans.get(plan);
  if(!entry||entry.used)return receipt(null,'blocked',null);
  entry.used=true;
  let core:ClientEditCoreOutcome|null=null;
  try {
    gate(entry);
    const attempt=entry.controller.begin(entry.lease,plan.form,plan.sections);
    if(!attempt)throw denied();entry.attempt=attempt;
    core=await executeClientEditCoreWriteWeb(entry.core,attempt);
    if(!core.currentAtReturn)entry.closed=true;
    if(core.status==='acknowledged') {
      const value=receipt(entry,'saved',core);
      entry.completed=entry.controller.finishOwnMasterDataSave(attempt,value);
      // A factual ACK does not imply completion of an externally closed or
      // replaced journal, nor does it grant a new live permission.
      return value;
    }
    if(core.status==='not_required'&&current(entry)) {
      const value=receipt(entry,'unchanged',core);
      entry.completed=entry.controller.finishOwnMasterDataSave(attempt,value);
      if(entry.completed)return value;
    }
  }catch{entry.closed=true;}
  const finished=entry.attempt?entry.controller.finish(entry.attempt):null;
  return receipt(entry,finished?.writeStarted||core?.writeStarted?'uncertain':'blocked',core);
}

/** Fresh own follow-up only. A receipt's native saved fact never supplies rights.
 * Refresh, observed loss, dispose, SDK/mode change and matching regrant cannot
 * reactivate a held permission; completion itself never releases a new attempt. */
export function mayFollowupClientMasterDataSaveWeb(plan:ClientMasterDataSavePlan,value:ClientMasterDataSaveReceipt):boolean {
  const entry=plans.get(plan);
  return !!entry&&entry.used&&entry.completed&&entry.receipt===value&&receipts.get(value)===entry
    &&(value.status==='saved'||value.status==='unchanged')&&current(entry);
}
