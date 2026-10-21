import type { ClientIntakeFormData } from '@/types/forms/clientIntakeForm';
import type { IntakeDocumentTemplate } from '@/features/intakeDocuments/intakeDocumentTypes';
import { buildIntakePlaceholderContext } from '@/features/intakeDocuments/buildIntakeDocumentContext';
import { renderIntakeDocumentHtml } from '@/features/intakeDocuments/renderIntakeDocumentPreview';
import { getSupabaseClient } from '@/lib/supabase/client';
import { getServiceMode } from '@/lib/services/mode';
import { cloneClientNativeOriginal, freezeClientNativeOriginal, sameClientNativeOriginal, captureClientNativePage, type ClientNativeRow } from './clientRecordNativeOriginal.web';
import { ClientRecordEditController, type ClientEditReadLease, type ClientEditAttempt } from './clientRecordEditController.web';
import { isOwnClientEditOriginalRead, type ClientEditOriginalRead } from './clientRecordEditRead.web';
import { ClientCareDocumentPreflightReader, type ClientCareDocumentPreflight, type ClientCareDocumentPrivateOriginals, type CareDocumentPermission } from './clientRecordEditCareDocuments.web';
import { mayContinueClientEditCoreWriteWeb, type ClientEditCoreIntent, type ClientEditCoreOutcome } from './clientRecordEditCoreWrite.web';
import { woundUuid } from '../pflege/woundCareDomain';

const keys: readonly CareDocumentPermission[] = ['office.documents.view','office.documents.signatures.view','office.templates.view','office.clients.view_sensitive','documents.create','documents.edit_draft'];
const denied=()=>Error('Der eigene vorab geprüfte private Dokumentnachfolger ist nicht aktuell oder nicht unterstützt.');
const object=(v:unknown):v is ClientNativeRow=>!!v&&typeof v==='object'&&!Array.isArray(v);
const nonempty=(v:unknown):v is string=>typeof v==='string'&&v.trim().length>0;
function date(v:unknown):v is string {
  if(typeof v!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(v)||Number(v.slice(0,4))<1)return false;
  const n=new Date(v+'T00:00:00Z');return Number.isFinite(n.getTime())&&n.toISOString().slice(0,10)===v;
}
export type ClientCareDocumentAppendPlan = Readonly<{phase:'care_document_append';count:number}>;
export type ClientCareDocumentAppendCapability = Readonly<{phase:'care_document_append_attempt'}>;
export type ClientCareDocumentPlannedRow = Readonly<{originalId:string;intake:ClientNativeRow;canonical:ClientNativeRow;event:ClientNativeRow}>;
export type ClientCareDocumentAppendPrivateBinding = Readonly<{
  controller:ClientRecordEditController;lease:ClientEditReadLease;sdk:NonNullable<ReturnType<typeof getSupabaseClient>>;
  originals:ClientCareDocumentPrivateOriginals;rows:readonly ClientCareDocumentPlannedRow[];core:ClientEditCoreIntent;
}>;
type Entry={binding:ClientCareDocumentAppendPrivateBinding;form:ClientIntakeFormData;valid:boolean;used:boolean;
  generation:object;owner:ClientCareDocumentAppendPlanner;reader:ClientCareDocumentPreflightReader;receipt:ClientCareDocumentPreflight;gate:()=>void;attempt:ClientEditAttempt|null;outcome:ClientEditCoreOutcome|null};
const plans=new WeakMap<ClientCareDocumentAppendPlan,Entry>();
const capabilities=new WeakMap<ClientCareDocumentAppendCapability,Entry>();
const generations=new WeakMap<ClientRecordEditController,object>();
const attempts=new WeakSet<ClientEditAttempt>();

function template(original:ClientNativeRow,p:ClientCareDocumentPrivateOriginals['pools']):IntakeDocumentTemplate {
  const tenant=p.tenants.find(r=>r.template_key===original.template_key&&r.is_active===true);
  const base=tenant? p.systems.find(r=>tenant.system_template_id===null?r.template_key===tenant.template_key:r.id===tenant.system_template_id)
    :p.systems.find(r=>r.template_key===original.template_key);
  if(!base||base.is_active!==true||base.document_type!==original.document_type||tenant&&tenant.document_type!==base.document_type
    ||!Number.isInteger(base.version)||Number(base.version)<1||Number(base.version)>2147483647)throw denied();
  if(tenant&&(tenant.template_key!==base.template_key||tenant.system_template_id!==null&&tenant.system_template_id!==base.id))throw denied();
  const schema=base.placeholder_schema,slots=base.signature_slots;
  if(!object(schema)||!Array.isArray(slots))throw denied();
  for(const [key,meta]of Object.entries(schema))if(!/^[a-z0-9_.]+$/.test(key)||!object(meta)||typeof meta.label!=='string'
    ||Object.hasOwn(meta,'required')&&typeof meta.required!=='boolean'||Object.keys(meta).some(k=>!['label','required'].includes(k)))throw denied();
  if(slots.some(s=>!object(s)||!['client','employee','legal_representative'].includes(String(s.role))
    ||typeof s.required!=='boolean'||!nonempty(s.placeholder)||Object.keys(s).some(k=>!['role','required','placeholder'].includes(k))))throw denied();
  const html=tenant?.html_content===null||tenant?.html_content===undefined?base.html_content:tenant.html_content;
  const title=tenant?.title===null||tenant?.title===undefined?base.title:tenant.title;
  if(typeof html!=='string'||!nonempty(title)||typeof base.plain_text_content!=='string')throw denied();
  return {id:String(tenant?.id??base.id),templateKey:String(base.template_key),title,documentType:base.document_type as IntakeDocumentTemplate['documentType'],
    serviceType:base.service_type as string|null,version:Number(base.version),isSystemTemplate:!tenant,isRequired:base.is_required as boolean,isActive:true,
    requiresClientSignature:base.requires_client_signature as boolean,requiresEmployeeSignature:base.requires_employee_signature as boolean,
    requiresRepresentativeSignature:base.requires_representative_signature as boolean,allowsCustomTemplate:base.allows_custom_template as boolean,
    htmlContent:html,plainTextContent:base.plain_text_content,placeholderSchema:schema as IntakeDocumentTemplate['placeholderSchema'],
    signatureSlots:slots as IntakeDocumentTemplate['signatureSlots'],source:tenant?'tenant':'system',tenantTemplateId:tenant?String(tenant.id):null};
}
function contextFor(t:IntakeDocumentTemplate,form:ClientIntakeFormData,read:ClientEditOriginalRead):Record<string,string> {
  const used=new Set([...t.htmlContent.matchAll(/\{\{([a-z0-9_.]+)\}\}/gi)].map(m=>m[1].toLowerCase()));
  if(/\{\{|\}\}/.test(t.htmlContent.replace(/\{\{([a-z0-9_.]+)\}\}/gi,'')))throw denied();
  for(const[key,meta]of Object.entries(t.placeholderSchema))if(meta.required)used.add(key);
  const sources:Record<string,readonly string[]>={
    'care.level':['careLevel'],'client.first_name':['firstName'],'client.last_name':['lastName'],
    'client.full_name':['firstName','lastName'],'client.salutation':['salutation'],'client.date_of_birth':['dateOfBirth'],
    'contract.service_start':['serviceStart','admissionDate'],'intake.date':['serviceStart','admissionDate'],
  };
  const root=read.original.fullNative.parts.client;
  for(const key of used){
    if(['signature.client','signature.employee','signature.legal_representative'].includes(key))continue;
    const fields=sources[key];if(!fields||fields.some(f=>!['native','derived','absent'].includes(read.fields[f]?.status??'unresolved')))throw denied();
    if(key==='contract.service_start'||key==='intake.date'){
      const service=form.serviceStart,admission=form.admissionDate;
      if(!sameClientNativeOriginal(service,read.form.serviceStart)||!sameClientNativeOriginal(admission,read.form.admissionDate)
        ||service!==''&&(!date(service)||root.service_start!==service)||service===''&&(!date(admission)||root.admission_date!==admission))throw denied();
    }
    if(key==='client.date_of_birth'&&(!date(form.dateOfBirth)||root.date_of_birth!==form.dateOfBirth))throw denied();
  }
  // The actual Shared mapper is used only for proven keys. Unavailable tenant,
  // today's document.date, synthetic agreement and every unsupported mapping fail above.
  const context=buildIntakePlaceholderContext(form);
  for(const key of used)if(!key.startsWith('signature.')&&(typeof context[key]!=='string'||!context[key].trim()||context[key].startsWith('[')))throw denied();
  return context;
}

/** Query-free compilation BEFORE begin/Core. No whole-save phase orchestration or UI binding. */
export class ClientCareDocumentAppendPlanner {
  private alive=false;private lifetime=0;
  private readonly controller:ClientRecordEditController;private readonly lease:ClientEditReadLease;
  private readonly read:ClientEditOriginalRead;private readonly reader:ClientCareDocumentPreflightReader;
  private readonly permission:(key:CareDocumentPermission)=>boolean;
  constructor(controller:ClientRecordEditController,lease:ClientEditReadLease,
    read:ClientEditOriginalRead,reader:ClientCareDocumentPreflightReader,permission:(key:CareDocumentPermission)=>boolean){
    this.controller=controller;this.lease=lease;this.read=read;this.reader=reader;this.permission=permission;
  }
  mount():void{if(!this.alive){this.alive=true;this.lifetime++;}}
  dispose():void{this.alive=false;this.lifetime++;}
  capture(receipt:ClientCareDocumentPreflight,input:ClientIntakeFormData,core:ClientEditCoreIntent):ClientCareDocumentAppendPlan|null {
    let entry:Entry|null=null;
    try{
      const generation=Object.freeze({});generations.set(this.controller,generation);
      if(!(this.controller instanceof ClientRecordEditController)||!(this.reader instanceof ClientCareDocumentPreflightReader)
        ||typeof this.permission!=='function'||!isOwnClientEditOriginalRead(this.lease,this.read)||this.read.original!==this.lease.original)throw denied();
      const sdk=getSupabaseClient(),life=this.lifetime;if(!sdk)throw denied();
      const gate=()=>{
        try{
          if(!this.alive||life!==this.lifetime||generations.get(this.controller)!==generation||(entry !== null && !entry.valid))throw denied();
          this.controller.assertRead(this.lease);
          // Recheck earlier grants after all callbacks, then owner and native SDK.
          for(let pass=0;pass<2;pass++)for(const key of keys){const grant:unknown=this.permission(key);if(grant!==true){if(grant instanceof Promise)void grant.catch(()=>{});throw denied();}}
          this.controller.assertRead(this.lease);
          if(!this.alive||life!==this.lifetime||generations.get(this.controller)!==generation||(entry !== null && !entry.valid)
            ||getServiceMode()!=='supabase'||getSupabaseClient()!==sdk||getServiceMode()!=='supabase')throw denied();
        }catch(error){if(entry)entry.valid=false;throw error;}
      };
      gate();if(this.controller.status().pending||this.controller.status().uncertainOwners||!this.reader.current(receipt,input)
        ||receipt.state!=='append_only_prepared')throw denied();
      const supplied=this.reader.currentOriginals(receipt);if(!supplied)throw denied();
      const originals=freezeClientNativeOriginal(cloneClientNativeOriginal(supplied));
      const scope=this.lease.original.scope;
      if(!sameClientNativeOriginal(originals.previousCareLevel,this.read.original.fullNative.parts.client.care_level)
        ||!sameClientNativeOriginal(originals.form,input)||!object(originals.pools)
        ||Object.keys(originals.pools).length!==6)throw denied();
      for(const key of ['documents','canonicals','signatures','events']as const)captureClientNativePage(originals.pools[key],scope,null);
      for(const key of ['systems','tenants']as const){let previous:string|null=null;
        if(!Array.isArray(originals.pools[key]))throw denied();
        for(const r of originals.pools[key]){if(!object(r)||!woundUuid(r.id)||key==='tenants'&&r.tenant_id!==scope.tenantId
          ||key==='systems'&&Object.hasOwn(r,'tenant_id'))throw denied();
          const id=String(r.id).toLowerCase();if(previous!==null&&id<=previous)throw denied();previous=id;}
      }
      gate();
      const form=freezeClientNativeOriginal(cloneClientNativeOriginal(input));gate();
      const corePublic=cloneClientNativeOriginal(core);gate();
      if(!object(corePublic)||!sameClientNativeOriginal(form,corePublic.form)||!Array.isArray(corePublic.sections)||!corePublic.sections.includes('versorgung')
        ||!sameClientNativeOriginal(form,originals.form)||originals.nextCareLevel===originals.previousCareLevel)throw denied();
      const preparedAt=new Date().toISOString(),suffix=preparedAt.replace(/\D/g,'');
      const rows:ClientCareDocumentPlannedRow[]=[],seen=new Set(originals.pools.documents.map(r=>r.template_key));
      for(const row of originals.pools.documents.filter(r=>['client_contract','assignment_declaration'].includes(String(r.document_type)))){
        if(!Number.isInteger(row.version)||Number(row.version)<1||Number(row.version)>2147483646||!woundUuid(row.id))throw denied();
        const t=template(row,originals.pools),context=contextFor(t,form,this.read),rendered=renderIntakeDocumentHtml(t,context,{});
        const preview=cloneClientNativeOriginal(rendered);if(typeof preview.html!=='string'||!Array.isArray(preview.missingPlaceholders)||!Array.isArray(preview.unresolvedKeys)
          ||preview.missingPlaceholders.some(v=>typeof v!=='string')||preview.unresolvedKeys.some(v=>typeof v!=='string'||!v.startsWith('signature.')))throw denied();
        const key=`${String(row.template_key)}__pflegegrad_${suffix}_${String(row.id).replace(/-/g,'')}`;if(seen.has(key))throw denied();seen.add(key);
        const scope=this.lease.original.scope,title=`${String(row.title)} – aktualisierter Pflegegrad`;
        rows.push({originalId:String(row.id),intake:{tenant_id:scope.tenantId,client_id:scope.clientId,template_key:key,document_type:row.document_type,title,
          status:'pending_signature',is_required:true,version:Number(row.version)+1,source:t.source,tenant_template_id:t.tenantTemplateId??null,
          preview_html:preview.html,missing_placeholders:preview.missingPlaceholders,preview_opened_at:preparedAt,updated_by:scope.actorId},
          canonical:{tenant_id:scope.tenantId,client_id:scope.clientId,title,file_name:`${key}.html`,mime_type:'text/html',category:'vertrag',status:'in_bearbeitung',sensitivity:'care',source:'intake',portal_visible:false,uploaded_by:scope.actorId},
          event:{tenant_id:scope.tenantId,client_id:scope.clientId,event_type:'care_level_successor_generated',
            summary:`Pflegegrad von ${originals.previousCareLevel??'ohne Angabe'} auf ${originals.nextCareLevel??'ohne Angabe'} geändert; private Dokumentversion erzeugt.`,
            metadata_json:{previousCareLevel:originals.previousCareLevel,nextCareLevel:originals.nextCareLevel,replacedDocumentId:row.id},actor_profile_id:scope.actorId}});
      }
      if(rows.length!==receipt.affectedCount||rows.length===0)throw denied();
      gate();if(!this.reader.current(receipt,form))throw denied();gate();
      const binding=Object.freeze({controller:this.controller,lease:this.lease,sdk,originals:freezeClientNativeOriginal(cloneClientNativeOriginal(originals)),rows:freezeClientNativeOriginal(rows),core});
      entry={binding,form,valid:true,used:false,generation,owner:this,reader:this.reader,receipt,gate,attempt:null,outcome:null};
      const plan=Object.freeze({phase:'care_document_append' as const,count:rows.length});plans.set(plan,entry);return plan;
    }catch{if(entry)entry.valid=false;return null;}
  }
  /** Last pre-begin check. Matching regrant cannot revive an observed closed plan. */
  current(plan:ClientCareDocumentAppendPlan,input:ClientIntakeFormData,core:ClientEditCoreIntent):boolean {
    const e=plans.get(plan);if(!e)return false;
    try{e.gate();if(e.used||e.owner!==this||e.binding.controller!==this.controller||e.binding.core!==core||this.controller.status().pending
      ||!sameClientNativeOriginal(cloneClientNativeOriginal(input),e.form)||!e.reader.current(e.receipt,input))throw denied();e.gate();return true;}catch{e.valid=false;return false;}
  }
}

/** Private executor capability: fake/copied plans/Core outcomes never authorize dispatch. */
export function claimClientCareDocumentAppendWeb(plan:ClientCareDocumentAppendPlan,attempt:ClientEditAttempt,outcome:ClientEditCoreOutcome):ClientCareDocumentAppendCapability|null {
  const e=plans.get(plan);if(!e||e.used||attempts.has(attempt))return null;e.used=true;
  try{
    e.gate();const b=e.binding;b.controller.assertCurrentAttempt(attempt);
    if(!sameClientNativeOriginal(attempt.form,e.form)||!sameClientNativeOriginal(attempt.sections,b.core.sections)
      ||!mayContinueClientEditCoreWriteWeb(b.core,attempt,outcome)||outcome.status!=='acknowledged'||!outcome.patchedColumns.includes('care_level'))throw denied();
    const native=cloneClientNativeOriginal(outcome.nativeResult);
    if(!object(native)||!object(native.data)||native.data.tenant_id!==b.lease.original.scope.tenantId||native.data.id!==b.lease.original.scope.clientId
      ||native.data.updated_by!==b.lease.original.scope.actorId||native.data.care_level!==b.originals.nextCareLevel
      ||sameClientNativeOriginal(native.data.care_level,b.originals.previousCareLevel))throw denied();
    e.attempt=attempt;e.outcome=outcome;attempts.add(attempt);e.gate();
    const cap=Object.freeze({phase:'care_document_append_attempt' as const});capabilities.set(cap,e);return cap;
  }catch{e.valid=false;return null;}
}
/** Internal native executor binding; returns no capability from a DTO or callback. */
export function clientCareDocumentAppendPrivateBindingWeb(cap:ClientCareDocumentAppendCapability):ClientCareDocumentAppendPrivateBinding {
  assertClientCareDocumentAppendWeb(cap);return capabilities.get(cap)!.binding;
}
export function assertClientCareDocumentAppendWeb(cap:ClientCareDocumentAppendCapability):void {
  const e=capabilities.get(cap);if(!e||!e.attempt||!e.outcome||!e.valid)throw denied();
  try{e.gate();e.binding.controller.assertCurrentAttempt(e.attempt);
    if(!mayContinueClientEditCoreWriteWeb(e.binding.core,e.attempt,e.outcome))throw denied();e.gate();
  }catch(error){e.valid=false;throw error;}
}
