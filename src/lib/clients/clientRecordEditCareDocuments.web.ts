import type { ServiceResult } from '@/types';
import type { ClientIntakeFormData } from '@/types/forms/clientIntakeForm';
import { getSupabaseClient } from '@/lib/supabase/client';
import { getServiceMode } from '@/lib/services/mode';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { withServiceQueryTimeout } from '@/lib/services/queryTimeout';
import { ClientRecordEditController, type ClientEditReadLease } from './clientRecordEditController.web';
import { isOwnClientEditOriginalRead, type ClientEditOriginalRead } from './clientRecordEditRead.web';
import { normalizeIntakeCareLevelForDb } from './clientIntakeCareLevel';
import { cloneClientNativeOriginal, freezeClientNativeOriginal, sameClientNativeOriginal, captureClientNativePage, type ClientNativeRow } from './clientRecordNativeOriginal.web';
import { woundUuid } from '../pflege/woundCareDomain';

const readKeys = ['office.documents.view','office.documents.signatures.view','office.templates.view','office.clients.view_sensitive'] as const;
const draftKeys = ['documents.create','documents.edit_draft'] as const;
export type CareDocumentPermission = typeof readKeys[number] | typeof draftKeys[number];
export type ClientCareDocumentPreflight = Readonly<{
  state: 'append_only_prepared' | 'not_required' | 'unsupported';
  reason: 'complete_append_only' | 'no_native_change' | 'unresolved_original' | 'unsigned_or_mixed' | 'missing_native_template' | 'portal_publish_unsupported';
  affectedCount: number;
  /** No mutation adapter, Core ACK, final save ACK, signature verification or publication capability. */
  mutation: 'unsupported';
}>;
type Pools = Record<'documents'|'canonicals'|'signatures'|'events'|'systems'|'tenants',ClientNativeRow[]>;
export type ClientCareDocumentPrivateOriginals = Readonly<{
  pools: Pools; form: ClientIntakeFormData; previousCareLevel: unknown; nextCareLevel: string | null;
  selectors: Readonly<Record<string,string>>;
}>;
type Entry = {
  serial: number; lifetime: number; generation: object; valid: boolean; db: NonNullable<ReturnType<typeof getSupabaseClient>>;
  form: ClientIntakeFormData | null; originals: ClientCareDocumentPrivateOriginals | null;
};
const generations=new WeakMap<ClientRecordEditController,object>();
const tables = {
  documents:'client_intake_documents',canonicals:'client_documents',signatures:'client_document_signatures',
  events:'client_document_events',systems:'intake_document_system_templates',tenants:'tenant_document_templates',
} as const;
const careTypes = new Set(['client_contract','assignment_declaration']);
const documentTypes = new Set(['privacy_consent','assignment_declaration','client_contract','additional_consent']);
const statuses = new Set(['not_started','preview_open','pending_signature','signed','declined','skipped_optional','finalized','revoked','replaced']);
const nativeLevels = new Set(['none','pg1','pg2','pg3','pg4','pg5','unknown']);
const denied=()=>Error('Die eigene vollständige Dokumentvorprüfung ist nicht mehr aktuell oder nicht freigegeben.');
const object=(v:unknown):v is ClientNativeRow=>!!v&&typeof v==='object'&&!Array.isArray(v);
const text=(v:unknown):v is string=>typeof v==='string'&&v.trim().length>0;
const member=(set:Set<string>,v:unknown)=>typeof v==='string'&&set.has(v);
const nullableText=(v:unknown)=>v===null||typeof v==='string';
const uuidOrNull=(v:unknown)=>v===null||woundUuid(v);
function strictGrant(fn:(key:CareDocumentPermission)=>boolean,key:CareDocumentPermission):void {
  const value:unknown=fn(key);
  if(value!==true){if(value instanceof Promise)void value.catch(()=>{});throw denied();}
}
function templatePage(input:unknown,tenantId:string|null,cursor:string|null):ClientNativeRow[] {
  const page=cloneClientNativeOriginal(input);
  if(!Array.isArray(page))throw denied();
  let previous=cursor?.toLowerCase()??null;
  for(const row of page){
    if(!object(row)||!woundUuid(row.id)||tenantId!==null&&row.tenant_id!==tenantId
      ||tenantId===null&&Object.hasOwn(row,'tenant_id'))throw denied();
    const id=(row.id as string).toLowerCase();if(previous!==null&&id<=previous)throw denied();previous=id;
  }
  return freezeClientNativeOriginal(page);
}
function assess(p:Pools,changed:boolean,portalVisible:boolean):Pick<ClientCareDocumentPreflight,'state'|'reason'|'affectedCount'> {
  const affected=p.documents.filter(row=>member(careTypes,row.document_type));
  const unsupported=(reason:ClientCareDocumentPreflight['reason'])=>({state:'unsupported' as const,reason,affectedCount:affected.length});
  const docIds=new Set(p.documents.map(row=>String(row.id).toLowerCase()));
  const systemIds=new Map(p.systems.map(row=>[String(row.id).toLowerCase(),row]));
  const tenantIds=new Map(p.tenants.map(row=>[String(row.id).toLowerCase(),row]));
  const keys=new Set<string>(),tenantKeys=new Set<string>();
  const active=new Map<string,ClientNativeRow>();
  for(const row of p.systems){
    if(!text(row.template_key)||keys.has(row.template_key)||!member(documentTypes,row.document_type)||typeof row.is_active!=='boolean'
      ||!text(row.title)||!Number.isSafeInteger(row.version)||Number(row.version)<1||typeof row.html_content!=='string'
      ||typeof row.plain_text_content!=='string'||!nullableText(row.service_type)
      ||['is_required','requires_client_signature','requires_employee_signature','requires_representative_signature','allows_custom_template'].some(key=>typeof row[key]!=='boolean')
      ||!object(row.placeholder_schema)||!Array.isArray(row.signature_slots)
      ||row.signature_slots.some(slot=>!object(slot)||!(typeof slot.role==='string'&&['client','employee','legal_representative'].includes(slot.role))||!text(slot.placeholder)||typeof slot.required!=='boolean'))return unsupported('unresolved_original');
    keys.add(row.template_key);if(row.is_active)active.set(row.template_key,row);
  }
  for(const row of p.tenants){
    if(!text(row.template_key)||tenantKeys.has(row.template_key)||!member(documentTypes,row.document_type)||typeof row.is_active!=='boolean'
      ||!uuidOrNull(row.system_template_id)||!nullableText(row.title)||!nullableText(row.html_content)||!nullableText(row.service_type))return unsupported('unresolved_original');
    tenantKeys.add(row.template_key);
    const base=row.system_template_id===null?p.systems.find(s=>s.template_key===row.template_key):systemIds.get(String(row.system_template_id).toLowerCase());
    if(!base||base.template_key!==row.template_key||base.document_type!==row.document_type)return unsupported('missing_native_template');
    if(row.is_active){if(base.is_active!==true)return unsupported('missing_native_template');active.set(row.template_key,row);}
  }
  for(const row of p.documents){
    // A linked generated-document/template-revision workflow is outside these six supplied pools.
    if(Object.hasOwn(row,'generated_document_id')&&row.generated_document_id!==null)return unsupported('unresolved_original');
    if(!text(row.template_key)||!member(documentTypes,row.document_type)||!text(row.title)||!member(statuses,row.status)
      ||!Number.isSafeInteger(row.version)||Number(row.version)<1||!(row.source==='system'||row.source==='tenant')
      ||!uuidOrNull(row.tenant_template_id)||!nullableText(row.finalized_html))return unsupported('unresolved_original');
    if(row.source==='tenant'){
      const template=tenantIds.get(String(row.tenant_template_id).toLowerCase());
      if(!template||template.template_key!==row.template_key||template.document_type!==row.document_type)return unsupported('missing_native_template');
    }else if(row.tenant_template_id!==null)return unsupported('unresolved_original');
  }
  for(const row of p.signatures)if(!woundUuid(row.document_id)||!docIds.has(String(row.document_id).toLowerCase()))return unsupported('unresolved_original');
  for(const row of p.events)if(!uuidOrNull(row.document_id)||row.document_id!==null&&!docIds.has(String(row.document_id).toLowerCase()))return unsupported('unresolved_original');
  for(const row of p.canonicals)if(!uuidOrNull(row.intake_document_id)||row.intake_document_id!==null&&!docIds.has(String(row.intake_document_id).toLowerCase()))return unsupported('unresolved_original');
  if(!changed)return{state:'not_required',reason:'no_native_change',affectedCount:affected.length};
  // New canonical rows may be private drafts only. Existing portal-visible originals are preserved as supplied.
  if(portalVisible)return unsupported('portal_publish_unsupported');
  const signed=new Set(p.signatures.map(row=>String(row.document_id).toLowerCase()));
  for(const row of affected){
    const template=active.get(String(row.template_key));
    if(!template||template.document_type!==row.document_type)return unsupported('missing_native_template');
    // Presence is a preservation signal, never verification of signer identity or a clinical completion.
    if(!signed.has(String(row.id).toLowerCase())&&row.status!=='signed'&&row.status!=='finalized'&&!row.finalized_html)return unsupported('unsigned_or_mixed');
  }
  return{state:'append_only_prepared',reason:'complete_append_only',affectedCount:affected.length};
}

/** SELECT-only private preparation before begin/Core mutation. Six delivered pools are not an atomic snapshot,
 * revision history, a publication permission or a whole-save shield. No mutation method is implemented.
 * A future complete orchestrator must check the exact receipt+whole form before begin, bind its same attempt,
 * verify the own Core patched-care_level ACK, and recheck all native originals before append-only dispatch. */
export class ClientCareDocumentPreflightReader {
  private alive=false;private lifetime=0;private serial=0;
  private receipts=new WeakMap<ClientCareDocumentPreflight,Entry>();
  private readonly controller:ClientRecordEditController;private readonly lease:ClientEditReadLease;
  private readonly delivered:ClientEditOriginalRead;private readonly currentPermission:(key:CareDocumentPermission)=>boolean;
  constructor(controller:ClientRecordEditController,lease:ClientEditReadLease,delivered:ClientEditOriginalRead,currentPermission:(key:CareDocumentPermission)=>boolean){
    this.controller=controller;this.lease=lease;this.delivered=delivered;this.currentPermission=currentPermission;
  }
  mount():void{if(!this.alive){this.alive=true;this.lifetime++;}}
  dispose():void{this.alive=false;this.lifetime++;}
  private gate(entry:Entry):void {
    if(!entry.valid)throw denied();
    try{
      if(!this.alive||entry.lifetime!==this.lifetime||entry.serial!==this.serial||generations.get(this.controller)!==entry.generation||!(this.controller instanceof ClientRecordEditController)
        ||typeof this.currentPermission!=='function'||!isOwnClientEditOriginalRead(this.lease,this.delivered))throw denied();
      this.controller.assertRead(this.lease);
      const status=this.controller.status();if(status.pending||status.uncertainOwners)throw denied();
      if(this.lease.original.scope.canSensitive!==true)throw denied();
      for(const key of [...readKeys,...draftKeys])strictGrant(this.currentPermission,key);
      this.controller.assertRead(this.lease);
      // Final native identity check follows every authority callback and the then accessor.
      if(getServiceMode()!=='supabase'||getSupabaseClient()!==entry.db)throw denied();
    }catch(error){entry.valid=false;throw error;}
  }
  async prepare(input:ClientIntakeFormData,options:Readonly<{portalVisible:boolean}>={portalVisible:false}):Promise<ServiceResult<ClientCareDocumentPreflight>> {
    let entry:Entry|null=null;
    try{
      // New generations supersede an earlier receipt synchronously, including before the first await.
      const serial=++this.serial,generation=Object.freeze({});generations.set(this.controller,generation);
      this.controller.assertRead(this.lease);
      if(!this.alive||!isOwnClientEditOriginalRead(this.lease,this.delivered))throw denied();
      const db=getSupabaseClient();if(!db)throw denied();
      entry={serial,lifetime:this.lifetime,generation,valid:true,db,form:null,originals:null};this.gate(entry);
      const form=freezeClientNativeOriginal(cloneClientNativeOriginal(input));
      const opt=cloneClientNativeOriginal(options);
      if(!object(opt)||typeof opt.portalVisible!=='boolean'||Object.keys(opt).length!==1||typeof form.careLevel!=='string'
        ||Object.keys(form).length!==Object.keys(this.delivered.form).length||Object.keys(this.delivered.form).some(key=>!Object.hasOwn(form,key)))throw denied();
      entry.form=form;
      this.gate(entry);
      const original=this.lease.original,scope=original.scope;
      const raw=original.fullNative.parts.client;
      const previous=raw.care_level;
      const normalized=normalizeIntakeCareLevelForDb(form.careLevel);
      const known=Object.hasOwn(raw,'care_level')&&(previous===null||member(nativeLevels,previous))
        &&(form.careLevel.trim()===''||nativeLevels.has(form.careLevel.trim()));
      // A projected field is not an explicit edit. Core patches this column only for an actual form change.
      const changed=!sameClientNativeOriginal(form.careLevel,this.delivered.form.careLevel)&&previous!==normalized;
      const dispatch=async(build:()=>PromiseLike<unknown>):Promise<unknown>=>{
        this.gate(entry!);const query=build();
        const rawResult=await withServiceQueryTimeout(new Promise<unknown>((resolve,reject)=>{
          try{const then=query?.then;const sameThen=query?.then;
            if(typeof then!=='function'||sameThen!==then)throw denied();
            this.gate(entry!);Reflect.apply(then,query,[resolve,reject]);}catch(error){reject(error);}
        }));
        this.gate(entry!);
        const response=cloneClientNativeOriginal(rawResult);this.gate(entry!);
        if(!object(response)||!Object.hasOwn(response,'error')||response.error!==null||!Object.hasOwn(response,'data'))throw denied();
        return response.data;
      };
      const pools={} as Pools;
      for(const[name,table]of Object.entries(tables)as[keyof Pools,string][]){
        const rows:ClientNativeRow[]=[];let cursor:string|null=null;
        for(;;){
          const data=await dispatch(()=>{
            let q=fromUnknownTable(db,table).select('*');
            if(name!=='systems')q=q.eq('tenant_id',scope.tenantId);
            if(name!=='systems'&&name!=='tenants')q=q.eq('client_id',scope.clientId);
            q=q.order('id',{ascending:true}).limit(200);if(cursor!==null)q=q.gt('id',cursor);return q;
          });
          const page: ClientNativeRow[]=name==='systems'||name==='tenants'?templatePage(data,name==='systems'?null:scope.tenantId,cursor):captureClientNativePage(data,scope,cursor);
          this.gate(entry);if(!page.length)break;rows.push(...page);cursor=String(page[page.length-1].id).toLowerCase();
        }
        pools[name]=rows;
      }
      const originals=freezeClientNativeOriginal({pools,form,previousCareLevel:previous,nextCareLevel:normalized,
        selectors:Object.fromEntries(Object.values(tables).map(table=>[table,'*']))});
      this.gate(entry);
      const assessed=known?assess(pools,changed,opt.portalVisible):{state:'unsupported' as const,reason:'unresolved_original' as const,affectedCount:pools.documents.filter(row=>member(careTypes,row.document_type)).length};
      this.gate(entry);entry.originals=originals;
      const receipt=Object.freeze({...assessed,mutation:'unsupported' as const});this.receipts.set(receipt,entry);return{ok:true,data:receipt};
    }catch(error){if(entry)entry.valid=false;return{ok:false,error:error instanceof Error?error.message:'Die native Dokumentvorprüfung ist ungeklärt.'};}
  }
  /** Exact current preparation only; does not start or authorize a write. Fake/copy receipts and changed forms fail. */
  current(receipt:ClientCareDocumentPreflight,input:ClientIntakeFormData):boolean {
    const entry=this.receipts.get(receipt);if(!entry)return false;
    try{this.gate(entry);const form=cloneClientNativeOriginal(input);this.gate(entry);return receipt.state!=='unsupported'&&sameClientNativeOriginal(form,entry.form);}catch{return false;}
  }
  /** Private internal originals only. No display DTO, HTML/signature props, AI or UI binding is added. */
  currentOriginals(receipt:ClientCareDocumentPreflight):ClientCareDocumentPrivateOriginals|null {
    const entry=this.receipts.get(receipt);if(!entry)return null;
    try{this.gate(entry);return entry.originals;}catch{return null;}
  }
}
