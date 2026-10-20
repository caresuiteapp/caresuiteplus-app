import type { ClientIntakeFormData } from '@/types/forms/clientIntakeForm';
import type { IntakeSectionKey } from './clientIntakeFieldRules';
import { ClientRecordEditController, type ClientEditReadLease, type ClientEditAttempt } from './clientRecordEditController.web';
import { isOwnClientEditOriginalRead, type ClientEditOriginalRead } from './clientRecordEditRead.web';
import { mayContinueClientEditCoreWriteWeb, type ClientEditCoreIntent, type ClientEditCoreOutcome } from './clientRecordEditCoreWrite.web';
import { getServiceMode } from '@/lib/services/mode';
import { getSupabaseClient } from '@/lib/supabase/client';
import { woundInstant } from '../pflege/woundCareDomain.ts';
import { cloneClientNativeOriginal, freezeClientNativeOriginal, sameClientNativeOriginal } from './clientRecordNativeOriginal.web';

export const CLIENT_FINAL_PHASE_POOLS = {
  client_service_profiles:'client',tenant_client_service_types:'tenant',tenant_service_type_rules:'tenant',
  client_budget_settings:'client',client_budget_movements:'client',tenant_budget_years:'tenant',tenant_budget_types:'tenant',tenant_budget_defaults:'tenant',tenant_service_type_budget_rules:'tenant',
  client_funding_selections:'client',client_care_entitlement:'client',client_service_entitlements:'client',client_budget_accounts:'client',client_budget_transactions:'client',client_billing_audit_log:'client',client_insurance_profiles:'client',budget_template_catalog:'global',
  client_portal_settings:'client',client_service_portal_settings:'client',tenant_client_portal_defaults:'tenant',tenant_service_type_portal_rules:'tenant',
} as const;
export type ClientFinalPhasePool=keyof typeof CLIENT_FINAL_PHASE_POOLS;
export type ClientFinalPhasePlan=Readonly<{
  form:ClientIntakeFormData;sections:readonly IntakeSectionKey[];changes:readonly string[];
  requiredPools:readonly ClientFinalPhasePool[];
  /** Inspection requirement report, never permission to begin a mutation. */
  blockers:readonly string[];affectedPhases:readonly string[];wholeSave:'unsupported';
}>;
export type ClientFinalPhaseCoreBinding=Readonly<{attempt:ClientEditAttempt;intent:ClientEditCoreIntent;outcome:ClientEditCoreOutcome}>;
type Entry={controller:ClientRecordEditController;lease:ClientEditReadLease;read:ClientEditOriginalRead;plan:ClientFinalPhasePlan;db:NonNullable<ReturnType<typeof getSupabaseClient>>;valid:boolean};
const minted=new WeakMap<ClientFinalPhasePlan,Entry>();
const denied=()=>Error('Die vollständige private Schlussphasen-Vorprüfung ist nicht aktuell in ihrer eigenen Originalbearbeitung bestätigt.');
const groups:Record<string,readonly string[]>={
  leistungsart:['careContexts'],stammdaten:['status','salutation','firstName','lastName','dateOfBirth','gender','housingForm','admissionDate','serviceStart','specialNotes'],
  adresse_kontakt:['street','houseNumber','zip','city','phone','mobile','email','preferredContact'],
  versorgung:['careLevel','careLevelStatus','careLevelValidFrom','familyDoctor','supportWishes','preferredTimes','excludedTimes','mobility','orientation','communication'],
  kostentraeger:['fundingSources','billingType','billingTypes','costBearerType','costBearerTypes','careFundName','careFundStreet','careFundZip','careFundCity','healthInsurance','healthInsuranceStreet','healthInsuranceZip','healthInsuranceCity','healthInsuranceIk','privatversicherungName','sozialamtName','beihilfeName','selbstzahlerName','berufsgenossenschaftName','unfallversicherungName','sonstigerName','costBearerIk','insuranceNumber','selfPay'],
  angehoerige:['emergencyContactName','emergencyContactPhone'],notfall_zugang:['homeAccess','keyStatus','keyNumber','keySafeCode','doorCode','bellName','floor','elevatorAvailable','parkingNotes','accessNotes','hazardNotes','facilityName','careArea','roomNumber','pets','smokerHousehold','aidsOnSite','hygieneNotes','infectionNotes'],
};
const service:ClientFinalPhasePool[]=['client_service_profiles','tenant_client_service_types','tenant_service_type_rules'];
const budget:ClientFinalPhasePool[]=['client_budget_settings','client_budget_movements','tenant_budget_years','tenant_budget_types','tenant_budget_defaults','tenant_service_type_budget_rules'];
const funding:ClientFinalPhasePool[]=['client_funding_selections','client_care_entitlement','client_service_entitlements','client_budget_accounts','client_budget_transactions','client_billing_audit_log','client_insurance_profiles','budget_template_catalog'];
const portal:ClientFinalPhasePool[]=['client_portal_settings','client_service_portal_settings','tenant_client_portal_defaults','tenant_service_type_portal_rules'];
function runtime(entry:Entry):void{
  try{if(!entry.valid||getServiceMode()!=='supabase'||getSupabaseClient()!==entry.db||getServiceMode()!=='supabase')throw denied();}
  catch(error){entry.valid=false;throw error;}
}
function current(entry:Entry,binding?:ClientFinalPhaseCoreBinding):void{
  try{
    runtime(entry);entry.controller.assertRead(entry.lease);
    if(!isOwnClientEditOriginalRead(entry.lease,entry.read))throw denied();
    if(binding){
      if(!mayContinueClientEditCoreWriteWeb(binding.intent,binding.attempt,binding.outcome)
        || !sameClientNativeOriginal(entry.plan.form,binding.intent.form)||!sameClientNativeOriginal(entry.plan.sections,binding.intent.sections)
        || !sameClientNativeOriginal(entry.plan.form,binding.attempt.form)||!sameClientNativeOriginal(entry.plan.sections,binding.attempt.sections))throw denied();
      entry.controller.assertCurrentAttempt(binding.attempt);
    }else{
      const status=entry.controller.status();if(status.pending||status.uncertainOwners!==0)throw denied();
    }
    entry.controller.assertRead(entry.lease);
    if(binding){entry.controller.assertCurrentAttempt(binding.attempt);if(!mayContinueClientEditCoreWriteWeb(binding.intent,binding.attempt,binding.outcome))throw denied();}
    runtime(entry);
  }catch(error){entry.valid=false;throw error;}
}
/** Complete selected input is retained before deciding affected pools. No writes,
 * new attempt, journal completion, default target year or clinical eligibility. */
export function captureClientEditFinalPhasePlanWeb(controller:ClientRecordEditController,lease:ClientEditReadLease,read:ClientEditOriginalRead,input:ClientIntakeFormData,selected?:readonly IntakeSectionKey[]):ClientFinalPhasePlan|null{
  try{
    if(!(controller instanceof ClientRecordEditController)||!isOwnClientEditOriginalRead(lease,read))throw denied();
    controller.assertRead(lease);const status=controller.status();if(status.pending||status.uncertainOwners!==0||getServiceMode()!=='supabase')throw denied();
    const db=getSupabaseClient();if(!db||getServiceMode()!=='supabase')throw denied();
    const form=cloneClientNativeOriginal(input),provided=selected===undefined?undefined:cloneClientNativeOriginal(selected);
    if(!Array.isArray(provided)||provided.length===0)throw denied();
    const selection=provided;
    if(!Array.isArray(selection)||new Set(selection).size!==selection.length||selection.some(key=>!Object.hasOwn(groups,key))
      ||Object.keys(read.form).some(key=>!Object.hasOwn(form,key))||Object.keys(form).some(key=>!Object.hasOwn(read.form,key)))throw denied();
    const changes=Object.keys(form).filter(key=>!sameClientNativeOriginal(form[key as keyof ClientIntakeFormData],read.form[key as keyof ClientIntakeFormData]));
    if(changes.some(key=>!selection.some(section=>groups[section].includes(key))))throw denied();
    const blockers:string[]=['whole_save_orchestration_unimplemented'],affectedPhases:string[]=[],requiredPools:ClientFinalPhasePool[]=[];
    for(const key of ['dateOfBirth','admissionDate','serviceStart','careLevelValidFrom'] as const)if(changes.includes(key)){const value=form[key];if(typeof value!=='string'||value!==''&&(!/^\d{4}-\d{2}-\d{2}$/.test(value)||Number(value.slice(0,4))<1||woundInstant(value+'T00:00:00Z')===null))blockers.push('explicit_source_date_unconfirmed:'+key);}
    for(const section of selection)for(const key of groups[section])if(!['native','derived','absent'].includes(read.fields[key]?.status))blockers.push('original_field_unresolved:'+key);
    const add=(phase:string,pools:ClientFinalPhasePool[])=>{affectedPhases.push(phase);requiredPools.push(...pools);blockers.push('writer_contract_unimplemented:'+phase);};
    if(changes.includes('careContexts')){add('service_profiles',service);add('budget_settings',budget);add('portal_metadata',portal);}
    if(changes.includes('serviceStart')){add('budget_settings',budget);blockers.push('explicit_native_budget_year_target_missing');}
    if(changes.some(key=>['careLevel','careLevelStatus','careLevelValidFrom',...groups.kostentraeger].includes(key)))add('financial_originals',funding);
    if(requiredPools.length)requiredPools.push('tenant_client_service_types');
    if(requiredPools.length&&read.original.scope.canSensitive!==true)blockers.push('sensitive_originals_not_requested');
    const plan=freezeClientNativeOriginal({form,sections:selection,changes,requiredPools:[...new Set(requiredPools)],wholeSave:'unsupported' as const,blockers:[...new Set(blockers)],affectedPhases:[...new Set(affectedPhases)]});
    const entry:Entry={controller,lease,read,plan,db,valid:true};current(entry);minted.set(plan,entry);return plan;
  }catch{return null;}
}
/** Private cross-module read context. Exact minted object only; no callback grant.
 * Caller retains its own read receipt and may not use this as mutation readiness. */
export function clientEditFinalPhaseReadContextWeb(plan:ClientFinalPhasePlan,binding?:ClientFinalPhaseCoreBinding):Readonly<{controller:ClientRecordEditController;lease:ClientEditReadLease;read:ClientEditOriginalRead;db:NonNullable<ReturnType<typeof getSupabaseClient>>}>{
  if(binding!==undefined){
    if(!binding||typeof binding!=='object'||![Object.prototype,null].includes(Object.getPrototypeOf(binding))||Reflect.ownKeys(binding).length!==3)throw denied();
    const values=Object.fromEntries(['attempt','intent','outcome'].map(key=>{const d=Object.getOwnPropertyDescriptor(binding,key);if(!d||!('value'in d))throw denied();return[key,d.value];}));
    binding=Object.freeze(values) as ClientFinalPhaseCoreBinding;
  }
  const entry=minted.get(plan);if(!entry)throw denied();current(entry,binding);return {controller:entry.controller,lease:entry.lease,read:entry.read,db:entry.db};
}
