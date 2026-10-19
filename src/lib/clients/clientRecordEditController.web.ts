import type { ClientIntakeFormData } from '@/types/forms/clientIntakeForm';
import type { IntakeSectionKey } from './clientIntakeFieldRules';
import { CLIENT_MASTER_DATA_SECTION_KEYS } from './clientMasterDataSections';
import { ClientRecordActionGuard, sameClientRecordActionOriginal, type ClientRecordActionOriginal, type ClientRecordActionTicket } from './clientRecordActions.web';
import { captureClientParentRecord, captureClientParentDetail } from './clientRecordRead.web';
import { CLIENT_RECORD_NATIVE_POOLS, cloneClientNativeOriginal, freezeClientNativeOriginal, sameClientNativeOriginal, captureClientNativeRoot, captureClientNativePage, captureClientNativeContexts, type ClientNativeOriginals } from './clientRecordNativeOriginal.web';
import { isOwnClientEditOriginalRead, type ClientEditOriginalRead } from './clientRecordEditRead.web';
import { recognizeOwnClientMasterDataSaveReceipt, type ClientMasterDataSaveReceipt } from './clientRecordMasterDataSave.web';

export type ClientEditOriginal = ClientRecordActionOriginal & { recordNative: ClientNativeOriginals; fullNative: ClientNativeOriginals };
export type ClientEditCurrent = {
  original: ClientEditOriginal; editor: object; ticket: ClientRecordActionTicket; actions: ClientRecordActionGuard;
  canRead: () => boolean; canEdit: () => boolean; canSensitive: () => boolean;
};
export type ClientEditReadLease = Readonly<{ original: ClientEditOriginal }>;
export type ClientEditAttempt = Readonly<{ sections: readonly IntakeSectionKey[]; form: ClientIntakeFormData; changes: readonly string[] }>;
export type ClientEditPendingOutcome = Readonly<{ status: 'unstarted' | 'uncertain' | 'acknowledged' | 'unchanged'; writeStarted: boolean }>;
type ReadEntry = { lease:ClientEditReadLease; current: ClientEditCurrent; lifetime: number; serial: number; valid: boolean; delivered: ClientEditOriginalRead | null };
type Entry = { read: ReadEntry; lifetime: number; serial: number; owner: string; writeStarted: boolean; done: boolean; outcome: ClientEditPendingOutcome | null };
const sectionFields: Partial<Record<IntakeSectionKey, readonly string[]>> = {
  leistungsart: ['careContexts'],
  stammdaten: ['status','salutation','firstName','lastName','dateOfBirth','gender','housingForm','admissionDate','serviceStart','specialNotes'],
  adresse_kontakt: ['street','houseNumber','zip','city','phone','mobile','email','preferredContact'],
  versorgung: ['careLevel','careLevelStatus','careLevelValidFrom','familyDoctor','supportWishes','preferredTimes','excludedTimes','mobility','orientation','communication'],
  kostentraeger: ['fundingSources','billingType','billingTypes','costBearerType','costBearerTypes','careFundName','careFundStreet','careFundZip','careFundCity','healthInsurance','healthInsuranceStreet','healthInsuranceZip','healthInsuranceCity','healthInsuranceIk','privatversicherungName','sozialamtName','beihilfeName','selbstzahlerName','berufsgenossenschaftName','unfallversicherungName','sonstigerName','costBearerIk','insuranceNumber','selfPay'],
  angehoerige: ['emergencyContactName','emergencyContactPhone'],
  notfall_zugang: ['homeAccess','keyStatus','keyNumber','keySafeCode','doorCode','bellName','floor','elevatorAvailable','parkingNotes','accessNotes','hazardNotes','facilityName','careArea','roomNumber','pets','smokerHousehold','aidsOnSite','hygieneNotes','infectionNotes'],
};
const denied = () => Error('Die private Bearbeitung benötigt ihre aktuelle eigene Originalakte, Lebensdauer und Aktionsrechte.');
function frozen(value: unknown, seen = new Set<object>()): boolean {
  if (!value || typeof value !== 'object') return true;
  if (!Object.isFrozen(value) || seen.has(value)) return false;
  seen.add(value);
  for (const key of Reflect.ownKeys(value)) {
    const d = Object.getOwnPropertyDescriptor(value, key)!;
    if (!('value' in d) || !frozen(d.value, seen)) return false;
  }
  seen.delete(value); return true;
}
function captureCurrent(value: ClientEditCurrent | null): ClientEditCurrent {
  if (!value || !(value.actions instanceof ClientRecordActionGuard) || !value.editor || typeof value.editor !== 'object'
    || value.ticket?.action !== 'edit' || !value.actions.current(value.ticket)
    || !sameClientRecordActionOriginal(value.ticket.original, value.original)
    || value.original.scope.canEdit !== true || value.original.scope.canRead !== true
    || value.canRead() !== true || value.canEdit() !== true || value.canSensitive() !== value.original.scope.canSensitive
    || !frozen(value.original.record) || !frozen(value.original.full) || !frozen(value.original.recordNative) || !frozen(value.original.fullNative)
    || !Number.isSafeInteger(value.original.recordTicket) || !Number.isSafeInteger(value.original.fullTicket)) throw denied();
  captureClientParentRecord(value.original.record, value.original.scope);
  captureClientParentDetail(value.original.full, value.original.scope);
  for (const native of [value.original.recordNative,value.original.fullNative]) {
    cloneClientNativeOriginal(native);
    captureClientNativeRoot(native.parts.client, value.original.scope);
    if (!Array.isArray(native.queriedPools) || new Set(native.queriedPools).size !== native.queriedPools.length) throw denied();
    for (const [key,table] of Object.entries(CLIENT_RECORD_NATIVE_POOLS)) {
      captureClientNativePage(native.parts[key as keyof typeof CLIENT_RECORD_NATIVE_POOLS],value.original.scope,null);
      if (!native.queriedPools.includes(table) || typeof native.selectors[table] !== 'string' || !native.selectors[table]) throw denied();
    }
    if (native.careContexts !== null) captureClientNativeContexts(captureClientNativePage(native.careContexts,value.original.scope,null));
  }
  const expected = value.original.scope.canSensitive ? 'requested' : 'not_requested';
  if (value.original.recordNative.coreSensitiveFields !== expected || value.original.fullNative.coreSensitiveFields !== expected) throw denied();
  if (['key','tenantId','clientId','actorId','role','canRead','canEdit','canSensitive'].some(key=>value.original.scope[key as keyof typeof value.original.scope]!==value.ticket.original.scope[key as keyof typeof value.original.scope])) throw denied();
  return { ...value, original: Object.freeze({ ...value.original,scope:Object.freeze({...value.original.scope}) }) };
}
function same(a: ClientEditCurrent, b: ClientEditCurrent): boolean {
  return a.editor === b.editor && a.actions === b.actions && a.ticket === b.ticket
    && sameClientRecordActionOriginal(a.original,b.original)
    && a.original.recordNative === b.original.recordNative && a.original.fullNative === b.original.fullNative
    && a.original.scope.canSensitive === b.original.scope.canSensitive;
}

/** Private native SDK-step journal. Whole completion is recognized only from the
 * fixed Stammdaten orchestrator; all other adapters retain conservative outcomes. */
export class ClientRecordEditController {
  private alive = false; private lifetime = 0;
  private reads = new WeakMap<ClientEditReadLease,ReadEntry>();
  private attempts = new WeakMap<ClientEditAttempt,Entry>();
  private journals = new Map<string,Entry>();
  private completedOriginals = new Map<string,ClientEditOriginal[]>();
  private flight: Entry | null = null;
  private readSerial=0;
  private attemptSerial=0;
  private readonly current: () => ClientEditCurrent | null;
  constructor(current: () => ClientEditCurrent | null) { this.current=current; }
  mount(): void { if (!this.alive) { this.alive = true; this.lifetime++; } }
  dispose(): void { this.alive = false; this.lifetime++; }
  captureRead(): ClientEditReadLease | null {
    try {
      if (!this.alive) return null;
      // Extra pools have their own read generation even when the Parent's two
      // original tickets stay equal. Refresh invalidates before any await.
      const serial=++this.readSerial;
      const current = captureCurrent(this.current()), lease = Object.freeze({ original: current.original });
      this.reads.set(lease,{lease,current,lifetime:this.lifetime,serial,valid:true,delivered:null}); return lease;
    } catch { return null; }
  }
  assertRead(lease: ClientEditReadLease): void {
    const read = this.reads.get(lease);
    if (!read || !read.valid) throw denied();
    try {
      if (!this.alive || read.lifetime !== this.lifetime || read.serial!==this.readSerial || !same(read.current,captureCurrent(this.current()))) throw denied();
      if(read.delivered&&!isOwnClientEditOriginalRead(lease,read.delivered))throw denied();
    } catch(error) { read.valid=false;throw error; }
  }
  /** Only the native reader can deliver its complete result; delivery does not authorize a mutation. */
  deliver(lease: ClientEditReadLease, result: ClientEditOriginalRead): void {
    this.assertRead(lease);
    const read = this.reads.get(lease)!;
    if (read.delivered || !Object.isFrozen(result) || !frozen(result.form) || !frozen(result.fields) || !frozen(result.originals)
      || result.original !== lease.original || !isOwnClientEditOriginalRead(lease,result)) throw denied();
    read.delivered = result;
  }
  begin(lease: ClientEditReadLease, input: ClientIntakeFormData, sectionsOverride?: readonly IntakeSectionKey[]): ClientEditAttempt | null {
    try {
      this.assertRead(lease); const read = this.reads.get(lease)!, delivered = read.delivered;
      if (!delivered || this.flight || !read.current.actions.mayLaunch(read.current.ticket)) return null;
      const owner = JSON.stringify([lease.original.scope.tenantId,lease.original.scope.clientId,lease.original.scope.actorId,lease.original.scope.role]);
      if (this.journals.has(owner) || this.completedOriginals.get(owner)?.some(original=>sameClientRecordActionOriginal(original,read.current.original))) return null;
      const form = freezeClientNativeOriginal(cloneClientNativeOriginal(input));
      const sections = cloneClientNativeOriginal(sectionsOverride?.length ? sectionsOverride : CLIENT_MASTER_DATA_SECTION_KEYS);
      if (new Set(sections).size !== sections.length || sections.some(section=>!sectionFields[section])) return null;
      // Missing or protected inputs are not original blanks and must not reach a later broad section patch.
      if (sections.some(section=>sectionFields[section]!.some(field=>!['native','absent','derived'].includes(delivered.fields[field]?.status ?? 'unresolved')))) return null;
      // An omitted original field is a deletion, including fields outside this section.
      if (Object.keys(delivered.form).some(key=>!Object.hasOwn(form,key))) return null;
      const changes = Object.keys(form).filter(key=>!Object.hasOwn(delivered.form,key) || !sameClientNativeOriginal(form[key as keyof ClientIntakeFormData],delivered.form[key as keyof ClientIntakeFormData]));
      if (changes.some(field=>!sections.some(section=>sectionFields[section]!.includes(field)))) return null;
      const attempt = Object.freeze({form,sections:Object.freeze(sections),changes:Object.freeze(changes)});
      const entry: Entry = {read,lifetime:this.lifetime,serial:++this.attemptSerial,owner,writeStarted:false,done:false,outcome:null};
      this.attempts.set(attempt,entry);this.journals.set(owner,entry);this.flight=entry;return attempt;
    } catch { return null; }
  }
  private assertAttempt(entry: Entry): void {
    if (!entry.read.valid || entry.done || this.flight !== entry) throw denied();
    try {
      if (!this.alive || entry.lifetime !== this.lifetime || entry.read.serial!==this.readSerial
        || !same(entry.read.current,captureCurrent(this.current()))) throw denied();
      if(entry.read.delivered&&!isOwnClientEditOriginalRead(entry.read.lease,entry.read.delivered))throw denied();
    } catch(error) { entry.read.valid=false;throw error; }
  }
  assertCurrentAttempt(attempt:ClientEditAttempt):void {
    const entry = this.attempts.get(attempt);
    if(!entry)throw denied();
    this.assertAttempt(entry);
  }
  /** Native then-entry is synchronous, after the builder and its then accessor.
   * The exact result is returned as an inner-step result, never a whole-save ACK.
   * A later complete adapter must inspect it and call assertCurrentAttempt before
   * any next step/follow-up. A generic external callback is not a native no-write
   * proof: invocation is conservatively possible mutation even if then-entry is
   * subsequently blocked. Only attempts with no callback invocation are unstarted. */
  async dispatchNativeWrite<T>(attempt:ClientEditAttempt,build:()=>PromiseLike<T>):Promise<T> {
    this.assertCurrentAttempt(attempt);
    if (typeof build!=='function') throw denied();
    this.attempts.get(attempt)!.writeStarted=true;
    const query=build();
    const result=await new Promise<T>((resolve,reject)=>{
      try {
        const then=query?.then;
        this.assertCurrentAttempt(attempt);
        if(typeof then!=='function')throw denied();
        then.call(query,resolve,reject);
      } catch(error) { reject(error); }
    });
    return result;
  }
  finish(attempt: ClientEditAttempt): ClientEditPendingOutcome | null {
    const entry = this.attempts.get(attempt);
    if (!entry || entry.done) return entry?.outcome ?? null;
    entry.done=true;
    const outcome=Object.freeze({status:entry.writeStarted?'uncertain' as const:'unstarted' as const,writeStarted:entry.writeStarted});
    entry.outcome=outcome;
    if(this.flight===entry)this.flight=null;
    if(!entry.writeStarted && this.journals.get(entry.owner)===entry)this.journals.delete(entry.owner);
    return outcome;
  }
  /** Only the actual whole Stammdaten save can close its exact exclusive journal.
   * A known final native ACK remains a fact after lifetime/rights loss. Closing
   * this journal grants no live action and never clears a prior/replaced entry. */
  finishOwnMasterDataSave(attempt:ClientEditAttempt,receipt:ClientMasterDataSaveReceipt):boolean {
    const entry=this.attempts.get(attempt);
    if(!entry || entry.done || this.flight!==entry || this.journals.get(entry.owner)!==entry)return false;
    const status=recognizeOwnClientMasterDataSaveReceipt(this,attempt,receipt);
    if(status==='saved') { if(!entry.writeStarted)return false; }
    else if(status==='unchanged') {
      if(entry.writeStarted)return false;
      try {this.assertAttempt(entry);}catch{return false;}
      // The final fixed recognizer checks its captured native runtime after all
      // supplied original/permission callbacks in the last attempt assertion.
      if(recognizeOwnClientMasterDataSaveReceipt(this,attempt,receipt)!=='unchanged')return false;
    } else return false;
    if(entry.done||this.flight!==entry||this.journals.get(entry.owner)!==entry)return false;
    entry.done=true;
    entry.outcome=Object.freeze({status:status==='saved'?'acknowledged' as const:'unchanged' as const,writeStarted:entry.writeStarted});
    this.completedOriginals.set(entry.owner,[...(this.completedOriginals.get(entry.owner)??[]),entry.read.current.original]);
    this.flight=null;this.journals.delete(entry.owner);return true;
  }
  isOwnUnstarted(attempt:ClientEditAttempt,outcome:ClientEditPendingOutcome):boolean {
    const entry=this.attempts.get(attempt);return this.alive && !!entry && entry.lifetime===this.lifetime && entry.serial===this.attemptSerial
      && this.flight===null && !this.journals.has(entry.owner) && entry.outcome===outcome && outcome.status==='unstarted' && !entry.writeStarted;
  }
  status():Readonly<{pending:boolean;uncertainOwners:number}> {
    return Object.freeze({pending:this.flight!==null,uncertainOwners:[...this.journals.values()].filter(entry=>entry.done&&entry.writeStarted).length});
  }
}
