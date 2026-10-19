import type { ClientIntakeFormData } from '@/types/forms/clientIntakeForm';
import type { IntakeSectionKey } from './clientIntakeFieldRules';
import { woundUuid } from '@/lib/pflege/woundCareDomain';
import { getServiceMode } from '@/lib/services/mode';
import { getSupabaseClient } from '@/lib/supabase/client';
import { sameClientRecordActionOriginal } from './clientRecordActions.web';
import { ClientRecordEditController, type ClientEditCurrent, type ClientEditReadLease } from './clientRecordEditController.web';
import { fetchClientEditOriginalReadWeb, type ClientEditOriginalRead } from './clientRecordEditRead.web';
import { captureClientMasterDataSaveWeb, executeClientMasterDataSaveWeb, mayFollowupClientMasterDataSaveWeb,
  type ClientMasterDataSavePlan, type ClientMasterDataSaveReceipt } from './clientRecordMasterDataSave.web';
import { cloneClientNativeOriginal, freezeClientNativeOriginal, sameClientNativeOriginal } from './clientRecordNativeOriginal.web';
import { validateIntakeStep } from './clientIntakeService';

export const CLIENT_IDENTITY_EDIT_FIELDS = Object.freeze(['status','salutation','firstName','lastName','dateOfBirth','gender','housingForm','admissionDate','serviceStart','specialNotes'] as const);
export type ClientIdentityEditField = typeof CLIENT_IDENTITY_EDIT_FIELDS[number];
export type ClientIdentityEditAttachment = Readonly<object>;
export type ClientIdentityEditToken = Readonly<object>;
export type ClientIdentityEditOwner = Readonly<{ userId:string;profileId:string;tenantId:string;clientId:string;role:string }>;
export type ClientIdentityEditCurrent = { userId:string;profileId:string;edit:ClientEditCurrent;canChangeStatus:()=>boolean };
export type ClientIdentityEditView = Readonly<{
  stage:'choose'|'loading'|'ready'|'saving'|'saved'|'unchanged'|'uncertain'|'blocked';
  dirty:boolean;busy:boolean;unknown:boolean;canSave:boolean;
  fields:Readonly<Partial<Record<ClientIdentityEditField,Readonly<{value:string;editable:boolean;state:string;error?:string}>>>>;
}>;
type Attachment = { owner:Owner; alive:boolean; current:()=>ClientIdentityEditCurrent|null;
  changed:()=>void;closed:()=>void;saved:()=>void;generation:Generation|null };
type Generation = {
  attachment:Attachment; expected:ClientIdentityEditCurrent; sdk:NonNullable<ReturnType<typeof getSupabaseClient>>;
  valid:boolean;closed:boolean;statusClosed:boolean;stage:ClientIdentityEditView['stage'];revision:number;closeSerial:number;
  lease:ClientEditReadLease|null;read:ClientEditOriginalRead|null;draft:ClientIntakeFormData|null;
  plan:ClientMasterDataSavePlan|null;receipt:ClientMasterDataSaveReceipt|null;
  errors:Partial<Record<ClientIdentityEditField,string>>;listeners:Set<()=>void>;
};
type Owner = { identity:ClientIdentityEditOwner; attachment:Attachment|null; generation:Generation|null;
  controller:ClientRecordEditController;pending:boolean;history:Generation[] };
// Private in-process ownership deliberately outlives the Parent. No raw state,
// Auth identity or journal is a property of a public attachment/child token.
const owners=new Map<string,Owner>();
const attachments=new WeakMap<ClientIdentityEditAttachment,Attachment>();
const generations=new WeakMap<ClientIdentityEditToken,Generation>();
const roles=new Set(['business_admin','business_manager','billing','dispatch','nurse','caregiver','counselor','akademie_admin']);
const denied=()=>Error('Die aktuelle eigene Stammdaten-Bearbeitung ist nicht bestätigt.');
function key(identity:ClientIdentityEditOwner):string {
  if(!identity||!woundUuid(identity.userId)||identity.userId!==identity.profileId||!woundUuid(identity.tenantId)
    ||!woundUuid(identity.clientId)||!roles.has(identity.role))throw denied();
  return JSON.stringify([identity.userId,identity.profileId,identity.tenantId,identity.clientId,identity.role]);
}
function identityCurrent(owner:Owner,current:ClientIdentityEditCurrent|null):current is ClientIdentityEditCurrent {
  const scope=current?.edit.original.scope;
  return !!current&&current.userId===owner.identity.userId&&current.profileId===owner.identity.profileId
    &&scope?.actorId===owner.identity.profileId&&scope.tenantId===owner.identity.tenantId&&scope.clientId===owner.identity.clientId&&scope.role===owner.identity.role;
}
function sameCurrent(a:ClientIdentityEditCurrent,b:ClientIdentityEditCurrent):boolean {
  return a.userId===b.userId&&a.profileId===b.profileId&&a.edit.editor===b.edit.editor&&a.edit.actions===b.edit.actions&&a.edit.ticket===b.edit.ticket
    &&sameClientRecordActionOriginal(a.edit.original,b.edit.original)&&a.edit.original.recordNative===b.edit.original.recordNative
    &&a.edit.original.fullNative===b.edit.original.fullNative&&a.edit.original.scope.canSensitive===b.edit.original.scope.canSensitive;
}
function assertGeneration(g:Generation):void {
  try {
    const a=g.attachment,o=a.owner;
    if(!g.valid||g.closed||!a.alive||o.attachment!==a||a.generation!==g||o.generation!==g
      ||getServiceMode()!=='supabase'||getSupabaseClient()!==g.sdk||getServiceMode()!=='supabase'
      ||!g.valid||g.closed||!a.alive||o.attachment!==a||a.generation!==g||o.generation!==g)throw denied();
    const current=a.current();
    if(!identityCurrent(o,current)||!sameCurrent(g.expected,current)||!current.edit.actions.current(current.edit.ticket)
      ||current.edit.canRead()!==true||current.edit.canEdit()!==true||current.edit.canSensitive()!==g.expected.edit.original.scope.canSensitive)throw denied();
    if(g.lease)o.controller.assertRead(g.lease);
    // Recheck original identity after all supplied permission/original accessors.
    const after=a.current();
    if(!identityCurrent(o,after)||!sameCurrent(g.expected,after)||!g.valid||g.closed||!a.alive||o.attachment!==a||o.generation!==g
      ||getServiceMode()!=='supabase'||getSupabaseClient()!==g.sdk||getServiceMode()!=='supabase'
      ||!g.valid||g.closed||!a.alive||o.attachment!==a||a.generation!==g||o.generation!==g)throw denied();
  }catch(error){g.valid=false;throw error;}
}
function current(g:Generation):boolean {try{assertGeneration(g);return true;}catch{return false;}}
function statusCurrent(g:Generation):boolean {
  if(g.statusClosed)return false;
  try {
    assertGeneration(g);const value:unknown=g.expected.canChangeStatus();
    if(value instanceof Promise)void value.catch(()=>{});
    if(value!==true)throw denied();assertGeneration(g);return true;
  }catch{g.statusClosed=true;return false;}
}
function changed(g:Generation):boolean {
  return !!g.read&&!!g.draft&&CLIENT_IDENTITY_EDIT_FIELDS.some(field=>!sameClientNativeOriginal(g.read!.form[field],g.draft![field]));
}
function unknown(owner:Owner):boolean {return owner.controller.status().uncertainOwners>0;}
function notify(g:Generation):void {
  if(!current(g))return;
  for(const listener of [...g.listeners]){if(!current(g))return;listener();}
  if(current(g))g.attachment.changed();
}

/** Parent-only attach. The stable native Auth key is only ownership, never rights.
 * Reattaching closes every old callback, while its pending/unknown work stays
 * private in this owner controller. A new child gets a new empty token. */
export function attachClientIdentityEditWeb(
  identity:ClientIdentityEditOwner,currentRead:()=>ClientIdentityEditCurrent|null,
  callbacks:{changed:()=>void;closed:()=>void;saved:()=>void},
):ClientIdentityEditAttachment|null {
  try {
    const ownerKey=key(identity);
    if(typeof currentRead!=='function'||Object.values(callbacks).some(value=>typeof value!=='function'))throw denied();
    let owner=owners.get(ownerKey);
    if(!owner) {
      const captured=Object.freeze({...identity});
      const controller=new ClientRecordEditController(()=>{
        const g=owner?.generation;
        if(!g||!g.valid||g.closed||!g.attachment.alive||owner?.attachment!==g.attachment)return null;
        const c=g.attachment.current();return identityCurrent(owner,c)&&sameCurrent(g.expected,c)?c.edit:null;
      });
      owner={identity:captured,attachment:null,generation:null,controller,pending:false,history:[]};owners.set(ownerKey,owner);
    }
    if(owner.attachment) {
      owner.attachment.alive=false;
      if(owner.attachment.generation)owner.attachment.generation.valid=false;
      owner.controller.dispose();
    }
    const a:Attachment={owner,alive:true,current:currentRead,...callbacks,generation:null};owner.attachment=a;
    const token=Object.freeze({});attachments.set(token,a);return token;
  }catch{return null;}
}
export function detachClientIdentityEditWeb(token:ClientIdentityEditAttachment):void {
  const a=attachments.get(token);if(!a)return;a.alive=false;
  if(a.generation){a.generation.valid=false;a.generation.listeners.clear();}
  if(a.owner.attachment===a){a.owner.attachment=null;a.owner.controller.dispose();}
}

/** Opens a broad area choice. The ten-field route requires its own explicit
 * choose('stammdaten'); no missing/ALL signal is narrowed here. */
export function openClientIdentityEditWeb(token:ClientIdentityEditAttachment):ClientIdentityEditToken|null {
  const a=attachments.get(token);if(!a||!a.alive||a.owner.attachment!==a)return null;
  try {
    const prior=a.generation;
    if(prior&&prior.valid&&!prior.closed&&(changed(prior)||prior.stage==='loading'||a.owner.pending||unknown(a.owner)))throw denied();
    const expected=a.current(),sdk=getSupabaseClient();
    if(!identityCurrent(a.owner,expected)||!sdk||getServiceMode()!=='supabase')throw denied();
    if(a.generation)a.generation.valid=false;
    const g:Generation={attachment:a,expected,sdk,valid:true,closed:false,statusClosed:false,
      stage:a.owner.pending?'saving':unknown(a.owner)?'uncertain':'choose',revision:0,closeSerial:0,lease:null,read:null,draft:null,plan:null,receipt:null,errors:{},listeners:new Set()};
    a.generation=g;a.owner.generation=g;a.owner.history.push(g);a.owner.controller.mount();assertGeneration(g);
    const child=Object.freeze({});generations.set(child,g);return child;
  }catch{return null;}
}
export function subscribeClientIdentityEditWeb(token:ClientIdentityEditToken,listener:()=>void):()=>void {
  const g=generations.get(token);if(!g||!current(g)||typeof listener!=='function')return()=>{};
  g.listeners.add(listener);return()=>{g.listeners.delete(listener);};
}
export function viewClientIdentityEditWeb(token:ClientIdentityEditToken):ClientIdentityEditView|null {
  const g=generations.get(token);if(!g||!current(g))return null;
  const o=g.attachment.owner,busy=o.pending||g.stage==='loading',uncertain=unknown(o),dirty=changed(g);
  const fields:Partial<Record<ClientIdentityEditField,{value:string;editable:boolean;state:string;error?:string}>>={};
  if(g.read&&g.draft&&!uncertain&&g.stage!=='saving')for(const field of CLIENT_IDENTITY_EDIT_FIELDS){
    const meta=g.read.fields[field],resolved=['native','derived','absent'].includes(meta?.status??'unresolved');
    const value=g.draft[field];
    fields[field]={value:typeof value==='string'?value:'',state:meta?.status??'unresolved',
      editable:g.stage==='ready'&&resolved&&!busy&&!g.receipt&&(field!=='status'||statusCurrent(g)),error:g.errors[field]};
  }
  if(!current(g))return null;
  return freezeClientNativeOriginal({stage:uncertain?'uncertain':o.pending?'saving':g.stage,dirty,busy,unknown:uncertain,
    canSave:g.stage==='ready'&&!!g.read&&!!g.draft&&!busy&&!uncertain&&!g.receipt&&dirty&&CLIENT_IDENTITY_EDIT_FIELDS.every(field=>['native','derived','absent'].includes(g.read!.fields[field]?.status??'unresolved')),fields});
}
export async function chooseClientIdentityEditWeb(token:ClientIdentityEditToken,section:IntakeSectionKey):Promise<void> {
  const g=generations.get(token);if(!g||section!=='stammdaten'||!current(g)||g.stage!=='choose')return;
  const o=g.attachment.owner;if(o.pending||unknown(o))return;
  const lease=o.controller.captureRead();if(!lease){g.stage='blocked';notify(g);return;}
  g.lease=lease;g.stage='loading';notify(g);
  try {
    assertGeneration(g);
    const result=await fetchClientEditOriginalReadWeb(o.controller,lease);assertGeneration(g);
    if(!result.ok)throw denied();
    g.read=result.data;g.draft=freezeClientNativeOriginal(cloneClientNativeOriginal(result.data.form));g.stage='ready';notify(g);
  }catch{g.stage='blocked';notify(g);}
}
export function updateClientIdentityEditWeb(token:ClientIdentityEditToken,field:ClientIdentityEditField,value:string):boolean {
  const g=generations.get(token);if(!g||!CLIENT_IDENTITY_EDIT_FIELDS.includes(field)||typeof value!=='string'||!current(g))return false;
  const o=g.attachment.owner;
  if(!g.read||!g.draft||g.stage!=='ready'||g.receipt||o.pending||unknown(o)||!['native','derived','absent'].includes(g.read.fields[field]?.status??'unresolved')
    ||field==='status'&&!statusCurrent(g))return false;
  if(!current(g))return false;
  g.draft=freezeClientNativeOriginal({...cloneClientNativeOriginal(g.draft),[field]:value});g.errors={};g.revision++;notify(g);return true;
}
export async function saveClientIdentityEditWeb(token:ClientIdentityEditToken):Promise<void> {
  const g=generations.get(token);if(!g||!current(g))return;
  const o=g.attachment.owner;if(!g.read||!g.draft||!g.lease||g.stage!=='ready'||g.receipt||o.pending||unknown(o))return;
  const errors=validateIntakeStep('stammdaten',g.draft);
  g.errors=Object.fromEntries(CLIENT_IDENTITY_EDIT_FIELDS.filter(field=>errors[field]).map(field=>[field,errors[field]]));
  const plan=captureClientMasterDataSaveWeb(o.controller,g.lease,g.read,g.draft,['stammdaten'],()=>statusCurrent(g));
  if(!plan){if(Object.keys(g.errors).length===0)g.stage='blocked';notify(g);return;}
  g.plan=plan;o.pending=true;g.stage='saving';notify(g);
  try {
    const value=await executeClientMasterDataSaveWeb(plan);g.receipt=value;
    g.stage=value.status==='saved'||value.status==='unchanged'?value.status:value.status==='uncertain'?'uncertain':'blocked';
    // Record native facts privately even while detached. Emit/close/refresh never
    // follow from that fact without its fresh own live follow-up gates.
    if(current(g)&&mayFollowupClientMasterDataSaveWeb(plan,value)&&current(g))g.attachment.saved();
  }finally{
    o.pending=false;notify(g);
    // A new attachment never adopts this old draft or receives its saved fact.
    // It can only show its own fresh generic blocked/uncertain owner state.
    const newer=o.generation;
    if(newer&&newer!==g&&newer.stage==='saving'){newer.stage=unknown(o)?'uncertain':'blocked';notify(newer);}
  }
}

/** One current close request. Confirmation does not authorize later busy/unknown
 * work or a revised draft. Route callbacks run only within the fresh exact gate;
 * outer unmount is handled by detach retention, not by a fictitious host veto. */
export async function closeClientIdentityEditWeb(
  token:ClientIdentityEditToken,confirmDiscard:()=>Promise<boolean>,onAllowed?:()=>void,
):Promise<boolean> {
  const g=generations.get(token);if(!g||!current(g))return false;
  const o=g.attachment.owner;
  if(o.pending||unknown(o)||g.stage==='loading')return false;
  const serial=++g.closeSerial,revision=g.revision;
  if(changed(g)&&!g.receipt) {
    try {if(await confirmDiscard()!==true)return false;}catch{return false;}
  }
  if(!current(g)||serial!==g.closeSerial||revision!==g.revision||o.pending||unknown(o)||g.stage==='loading')return false;
  g.closed=true;g.valid=false;g.listeners.clear();
  // Local discard is explicit; pending/unknown entries never reach this branch.
  g.draft=null;g.read=null;g.lease=null;
  if(onAllowed)onAllowed();
  // This callback is a UI close only, no native mutation or refresh grant.
  const after=g.attachment.current();
  if(g.attachment.alive&&o.attachment===g.attachment&&identityCurrent(o,after)&&sameCurrent(g.expected,after)
    &&after.edit.canRead()===true&&after.edit.canEdit()===true&&getServiceMode()==='supabase'&&getSupabaseClient()===g.sdk&&getServiceMode()==='supabase'
    &&g.attachment.alive&&o.attachment===g.attachment&&g.attachment.generation===g&&o.generation===g)g.attachment.closed();
  return true;
}

/** Parent-only non-clinical exclusive-work state. The empty attachment can veto
 * another local action; a false result never grants any action or clears work. */
export function clientIdentityEditWorkBlockedWeb(token:ClientIdentityEditAttachment|null):boolean {
  const a=token?attachments.get(token):null;
  if(!a||!a.alive||a.owner.attachment!==a)return true;
  return a.owner.pending||unknown(a.owner);
}
