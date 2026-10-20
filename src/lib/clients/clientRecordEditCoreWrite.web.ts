import type { Database } from '@/lib/supabase/types';
import type { ClientIntakeFormData } from '@/types/forms/clientIntakeForm';
import type { IntakeSectionKey } from './clientIntakeFieldRules';
import { CLIENT_MASTER_DATA_SECTION_KEYS } from './clientMasterDataSections';
import { getSupabaseClient } from '@/lib/supabase/client';
import { getServiceMode } from '@/lib/services/mode';
import { withServiceQueryTimeout } from '@/lib/services/queryTimeout';
import { normalizeIntakeCareLevelForDb } from './clientIntakeCareLevel';
import { resolvePrimaryCostBearerName } from './clientIntakeCostBearerConfig';
import { workflowStatusToRemote } from '@/lib/services/clients/clientStatusBridge';
import type { WorkflowStatus } from '@/types/core/base';
import { cloneClientNativeOriginal, freezeClientNativeOriginal, sameClientNativeOriginal, captureClientNativeRoot } from './clientRecordNativeOriginal.web';
import { isOwnClientEditOriginalRead, type ClientEditOriginalRead } from './clientRecordEditRead.web';
import type { ClientRecordEditController, ClientEditReadLease, ClientEditAttempt } from './clientRecordEditController.web';

export type ClientEditCoreIntent = Readonly<{ form: ClientIntakeFormData; sections: readonly IntakeSectionKey[] }>;
export type ClientEditCoreOutcome = Readonly<{
  phase: 'core'; status: 'acknowledged' | 'not_required' | 'blocked' | 'uncertain'; writeStarted: boolean;
  /** A snapshot only. A positive Core acknowledgement is never a continuation grant. */
  currentAtReturn: boolean; patchedColumns: readonly string[];
  /** Private lossless SDK evidence, never an editor/display DTO or whole-save receipt. */
  nativeResult: unknown; error?: string;
}>;
type Entry = {
  controller: ClientRecordEditController; lease: ClientEditReadLease; read: ClientEditOriginalRead;
  form: ClientIntakeFormData; sections: readonly IntakeSectionKey[]; changes: readonly string[];
  payload: Readonly<Record<string, unknown>>; selector: string; nativeStatus: string;
  sdk: NonNullable<ReturnType<typeof getSupabaseClient>>;
  version: string; statusChanged: boolean; statusPermissionClosed: boolean; runtimeClosed: boolean; canChangeStatus: () => boolean; used: boolean;
  attempt: ClientEditAttempt | null; outcome: ClientEditCoreOutcome | null;
};
const intents = new WeakMap<ClientEditCoreIntent, Entry>();
const consumedAttempts = new WeakSet<ClientEditAttempt>();
const knownNativeStatuses = new Set(['lead','active','paused','inactive','archived','deceased','blocked','deleted']);
const knownWorkflowStatuses = new Set(['entwurf','aktiv','in_bearbeitung','abgeschlossen','archiviert','fehlerhaft','gesperrt','geplant','bestaetigt']);
// The existing seven Master-section contract. Read provenance is a prerequisite,
// not proof that the Shared mapper can round-trip a native target unchanged.
const fields: Partial<Record<IntakeSectionKey, readonly string[]>> = {
  leistungsart: ['careContexts'],
  stammdaten: ['status','salutation','firstName','lastName','dateOfBirth','gender','housingForm','admissionDate','serviceStart','specialNotes'],
  adresse_kontakt: ['street','houseNumber','zip','city','phone','mobile','email','preferredContact'],
  versorgung: ['careLevel','careLevelStatus','careLevelValidFrom','familyDoctor','supportWishes','preferredTimes','excludedTimes','mobility','orientation','communication'],
  kostentraeger: ['fundingSources','billingType','billingTypes','costBearerType','costBearerTypes','careFundName','careFundStreet','careFundZip','careFundCity','healthInsurance','healthInsuranceStreet','healthInsuranceZip','healthInsuranceCity','healthInsuranceIk','privatversicherungName','sozialamtName','beihilfeName','selbstzahlerName','berufsgenossenschaftName','unfallversicherungName','sonstigerName','costBearerIk','insuranceNumber','selfPay'],
  angehoerige: ['emergencyContactName','emergencyContactPhone'],
  notfall_zugang: ['homeAccess','keyStatus','keyNumber','keySafeCode','doorCode','bellName','floor','elevatorAvailable','parkingNotes','accessNotes','hazardNotes','facilityName','careArea','roomNumber','pets','smokerHousehold','aidsOnSite','hygieneNotes','infectionNotes'],
};
const denied = () => Error('Der private native Stammdaten-Schritt ist nicht in seiner eigenen aktuellen Originalbearbeitung bestätigt.');
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const own = (row: Record<string, unknown>, key: string): unknown => { if (!Object.hasOwn(row,key)) throw denied(); return row[key]; };
function text(value: unknown): string { if (typeof value !== 'string') throw denied(); return value; }
function date(value: unknown): string | null {
  const raw=text(value); if (raw==='') return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw) || Number(raw.slice(0,4))<1) throw denied();
  const parsed = new Date(raw+'T00:00:00.000Z');
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0,10)!==raw) throw denied();
  return raw;
}
// A native TIMESTAMPTZ equality token, never a parsed/normalized JavaScript
// instant. Preserve all delivered fractional digits and the original offset.
function version(value:unknown):string {
  if(typeof value!=='string')throw denied();
  const match=/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2}):(\d{2})(?:\.\d{1,6})?(Z|[+-]\d{2}:\d{2})$/.exec(value);
  if(!match)throw denied();
  const [year,month,day,hour,minute,second]=match.slice(1,7).map(Number);
  const leap=year%4===0&&(year%100!==0||year%400===0),days=[31,leap?29:28,31,30,31,30,31,31,30,31,30,31];
  if(year<1||month<1||month>12||day<1||day>days[month-1]||hour>23||minute>59||second>59)throw denied();
  if(match[7]!=='Z'&&(Number(match[7].slice(1,3))>23||Number(match[7].slice(4,6))>59))throw denied();
  return value;
}
function gate(entry: Entry, attempt?: ClientEditAttempt): void {
  if(entry.runtimeClosed||getServiceMode()!=='supabase'||getSupabaseClient()!==entry.sdk) {entry.runtimeClosed=true;throw denied();}
  entry.controller.assertRead(entry.lease);
  if (attempt) entry.controller.assertCurrentAttempt(attempt);
  if(entry.statusChanged) {
    if(entry.statusPermissionClosed)throw denied();
    try {
      const value:unknown=entry.canChangeStatus();
      if(value instanceof Promise)void value.catch(()=>{});
      if(value!==true)throw denied();
    } catch(error) {entry.statusPermissionClosed=true;throw error;}
  }
  // A supplied synchronous permission callback can itself invalidate the owner.
  entry.controller.assertRead(entry.lease);
  if (attempt) entry.controller.assertCurrentAttempt(attempt);
  // Reentrant callbacks/owner assertions may close an intent or change mode
  // after its first check. The final synchronous native boundary must see that.
  if(entry.runtimeClosed||getServiceMode()!=='supabase'||getSupabaseClient()!==entry.sdk) {entry.runtimeClosed=true;throw denied();}
  if(entry.statusChanged&&entry.statusPermissionClosed)throw denied();
}
function current(entry: Entry, attempt: ClientEditAttempt): boolean { try { gate(entry,attempt); return true; } catch { return false; } }

/** Query-free capture before the caller begins its ONE whole-save attempt.
 * Unsupported native targets and unresolved/masked section inputs do not reach
 * a callback ingress. This module has no component/Parent or Shared fallback. */
export function captureClientEditCoreWriteWeb(
  controller: ClientRecordEditController, lease: ClientEditReadLease, read: ClientEditOriginalRead,
  input: ClientIntakeFormData, sectionsOverride: readonly IntakeSectionKey[] | undefined,
  canChangeStatus: () => boolean,
): ClientEditCoreIntent | null {
  try {
    controller.assertRead(lease);
    if (!isOwnClientEditOriginalRead(lease,read) || read.original!==lease.original || typeof canChangeStatus!=='function') throw denied();
    if(getServiceMode()!=='supabase')throw denied();const sdk=getSupabaseClient();if(!sdk)throw denied();
    const form=freezeClientNativeOriginal(cloneClientNativeOriginal(input));
    const sections=freezeClientNativeOriginal(cloneClientNativeOriginal(sectionsOverride?.length?sectionsOverride:CLIENT_MASTER_DATA_SECTION_KEYS));
    if (new Set(sections).size!==sections.length || sections.some(section=>!fields[section])) throw denied();
    if (sections.some(section=>fields[section]!.some(field=>!['native','derived','absent'].includes(read.fields[field]?.status??'unresolved')))) throw denied();
    // Whole original omissions and changes outside selected sections never become
    // a partial broad-patch request. [] retains the existing ALL semantics.
    if (Object.keys(read.form).some(key=>!Object.hasOwn(form,key))) throw denied();
    const changes=Object.keys(form).filter(key=>!Object.hasOwn(read.form,key)||!sameClientNativeOriginal(form[key as keyof ClientIntakeFormData],read.form[key as keyof ClientIntakeFormData]));
    if (changes.some(field=>!sections.some(section=>fields[section]!.includes(field)))) throw denied();
    // clients.house_number/mobile/access_notes/floor are not declared by the
    // local client DDL. Do not silently omit those selected legacy chains.
    if (sections.includes('adresse_kontakt') || sections.includes('notfall_zugang')) throw denied();
    const root=read.original.fullNative.parts.client, rawStatus=own(root,'status');
    if (typeof rawStatus!=='string' || !knownNativeStatuses.has(rawStatus)) throw denied();
    const originalVersion=version(own(root,'updated_at'));
    const scope=lease.original.scope, payload:Record<string,unknown>={updated_by:scope.actorId};
    const changed=(field:string)=>changes.includes(field);
    const trimmed=(field:keyof ClientIntakeFormData)=>text(form[field]).trim()||null;
    if (sections.includes('stammdaten')) {
      for (const [field,target] of Object.entries({firstName:'first_name',lastName:'last_name'})) if (changed(field)) payload[target]=text(form[field as keyof ClientIntakeFormData]).trim();
      for (const [field,target] of Object.entries({salutation:'salutation',housingForm:'housing_form'})) if (changed(field)) payload[target]=trimmed(field as keyof ClientIntakeFormData);
      for (const [field,target] of Object.entries({dateOfBirth:'date_of_birth',admissionDate:'admission_date',serviceStart:'service_start'})) if (changed(field)) payload[target]=date(form[field as keyof ClientIntakeFormData]);
      if (changed('gender')) {
        const gender=text(form.gender);
        if (gender!=='' && !['weiblich','männlich','divers','keine_angabe'].includes(gender)) throw denied();
        payload.gender=gender||null;
      }
      if (changed('specialNotes')) payload.internal_notes=payload.special_notes=trimmed('specialNotes');
      if (changed('status')) {
        if (!knownWorkflowStatuses.has(text(form.status))) throw denied();
        payload.status=workflowStatusToRemote(form.status as WorkflowStatus);
        if (!knownNativeStatuses.has(String(payload.status))) throw denied();
      }
    }
    if (sections.includes('versorgung') && changed('careLevel')) payload.care_level=normalizeIntakeCareLevelForDb(text(form.careLevel));
    if (sections.includes('kostentraeger')) {
      if (changed('insuranceNumber')) payload.insurance_number=trimmed('insuranceNumber');
      const nameInputs=['costBearerTypes','careFundName','healthInsurance','privatversicherungName','sozialamtName','beihilfeName','selbstzahlerName','berufsgenossenschaftName','unfallversicherungName','sonstigerName'];
      if (nameInputs.some(changed)) payload.insurance_name=payload.cost_bearer=resolvePrimaryCostBearerName(form);
    }
    // Typed target/source availability must be explicit even for paired writes.
    for (const key of Object.keys(payload)) if (key!=='updated_by' && !Object.hasOwn(root,key)) throw denied();
    const safeOriginalColumns=lease.original.fullNative.selectors.clients.split(',').map(v=>v.trim());
    if (!scope.canSensitive && (safeOriginalColumns.includes('*') || Object.keys(payload).some(key=>!safeOriginalColumns.includes(key)))) throw denied();
    const selector=scope.canSensitive?'*':[...new Set(['id','tenant_id','status','updated_by','updated_at',...Object.keys(payload)])].join(',');
    const entry:Entry={controller,lease,read,form,sections,changes:Object.freeze(changes),payload:freezeClientNativeOriginal(payload),selector,sdk,
      nativeStatus:Object.hasOwn(payload,'status')?String(payload.status):rawStatus,version:originalVersion,
      statusChanged:changed('status'),statusPermissionClosed:false,runtimeClosed:false,canChangeStatus,used:false,attempt:null,outcome:null};
    gate(entry);
    const intent=Object.freeze({form,sections});intents.set(intent,entry);return intent;
  } catch { return null; }
}

function outcome(entry:Entry|null,status:ClientEditCoreOutcome['status'],writeStarted:boolean,nativeResult:unknown,error?:string):ClientEditCoreOutcome {
  const value=Object.freeze({phase:'core' as const,status,writeStarted,currentAtReturn:!!entry?.attempt&&current(entry,entry.attempt),
    patchedColumns:Object.freeze(entry&&status!=='not_required'?Object.keys(entry.payload):[]),nativeResult,error});
  if(entry)entry.outcome=value;return value;
}

/** Exactly one native clients UPDATE; an ACK is ONLY this Core step. The caller
 * retains the same controller attempt for all required subsequent save phases.
 * This method never finishes/releases its conservative mutation journal. */
export async function executeClientEditCoreWriteWeb(intent:ClientEditCoreIntent,attempt:ClientEditAttempt):Promise<ClientEditCoreOutcome> {
  const entry=intents.get(intent);
  if(!entry || entry.used || consumedAttempts.has(attempt)) return outcome(null,'blocked',false,null);
  // The first invocation consumes this intent even if a local current gate
  // denies it. Restoration cannot revive a retained local submit closure.
  entry.used=true;
  let invoked=false,evidence:unknown=null;
  try {
    gate(entry,attempt);
    if(!sameClientNativeOriginal(attempt.form,entry.form)||!sameClientNativeOriginal(attempt.sections,entry.sections)||!sameClientNativeOriginal(attempt.changes,entry.changes))throw denied();
    entry.attempt=attempt;consumedAttempts.add(attempt);
    if(Object.keys(entry.payload).length===1) return outcome(entry,'not_required',false,null);
    const db=entry.sdk;gate(entry,attempt);
    const scope=entry.lease.original.scope;
    const raw=await withServiceQueryTimeout(entry.controller.dispatchNativeWrite(attempt,()=>{
      // Frozen controller conservatively marks possible mutation before this
      // callback. Never manufacture a no-write proof after callback ingress.
      invoked=true;gate(entry,attempt);
      const query=db.from('clients').update(entry.payload as Database['public']['Tables']['clients']['Update']).eq('id',scope.clientId).eq('tenant_id',scope.tenantId).eq('updated_at',entry.version).select(entry.selector).single();
      return {then<TResult1=unknown,TResult2=never>(
        onfulfilled?: ((value:unknown)=>TResult1|PromiseLike<TResult1>)|null,
        onrejected?: ((reason:unknown)=>TResult2|PromiseLike<TResult2>)|null,
      ):Promise<TResult1|TResult2> {
        return new Promise<unknown>((resolve,reject)=>{
          try {
            const then=query?.then;gate(entry,attempt);
            if(typeof then!=='function')throw denied();
            then.call(query,resolve,reject);
          } catch(error) { reject(error); }
        }).then(onfulfilled,onrejected);
      }};
    }));
    evidence=freezeClientNativeOriginal(cloneClientNativeOriginal(raw));
    if(!object(evidence)||!Object.hasOwn(evidence,'error')||evidence.error!==null||!Object.hasOwn(evidence,'data')
      ||!Object.hasOwn(evidence,'status')||typeof evidence.status!=='number'||!Number.isInteger(evidence.status)||evidence.status<200||evidence.status>299)throw denied();
    const root=captureClientNativeRoot(evidence.data,scope);
    if(own(root,'updated_by')!==scope.actorId || own(root,'status')!==entry.nativeStatus)throw denied();
    version(own(root,'updated_at'));
    for(const [key,value]of Object.entries(entry.payload))if(!sameClientNativeOriginal(own(root,key),value))throw denied();
    const expected=entry.selector==='*'?Object.keys(entry.read.original.fullNative.parts.client):entry.selector.split(',').map(v=>v.trim());
    if(expected.some(key=>!Object.hasOwn(root,key)) || entry.selector!=='*'&&Object.keys(root).some(key=>!expected.includes(key)))throw denied();
    const originalRoot=entry.read.original.fullNative.parts.client;
    // Only updated_at has a declared automatic trigger update. Unknown fields,
    // DATE/null/raw extras and all other delivered unpatched values remain exact
    // evidence; a drift is not a confirmed preservation of the original Core.
    for(const key of expected)if(key!=='updated_at'&&!Object.hasOwn(entry.payload,key)
      &&!sameClientNativeOriginal(own(root,key),own(originalRoot,key)))throw denied();
    // Preserve the confirmed final native fact before checking stale follow-ups.
    return outcome(entry,'acknowledged',true,evidence);
  } catch(error) {
    // No SDK retry or Shared fallback; a started callback remains conservative.
    return outcome(entry,invoked?'uncertain':'blocked',invoked,evidence,error instanceof Error?error.message:'Der native Stammdaten-Schritt ist ungeklärt.');
  }
}

/** Fresh query-free continuation, never a whole-save ACK or journal release. */
export function mayContinueClientEditCoreWriteWeb(intent:ClientEditCoreIntent,attempt:ClientEditAttempt,value:ClientEditCoreOutcome):boolean {
  const entry=intents.get(intent);return !!entry&&entry.used&&entry.attempt===attempt&&entry.outcome===value
    &&['acknowledged','not_required'].includes(value.status)&&current(entry,attempt);
}
