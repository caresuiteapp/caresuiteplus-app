import type { ClientIntakeFormData } from '@/types/forms/clientIntakeForm';
import type { ServiceResult } from '@/types';
import { getSupabaseClient } from '@/lib/supabase/client';
import { getServiceMode } from '@/lib/services/mode';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { withServiceQueryTimeout } from '@/lib/services/queryTimeout';
import { toGermanSupabaseError } from '@/lib/supabase/errors';
import { mapClientEditRawFields, mapClientToEditForm } from './clientEditFormMappers';
import { parseHomeAccessStoredValue } from './clientIntakeHomeAccess';
import { captureClientIntakeEditOriginalForm } from './clientIntakeEditOriginalForm.web';
import { cloneClientNativeOriginal, freezeClientNativeOriginal, captureClientNativePage, captureClientNativeRoot, sameClientNativeOriginal, type ClientNativeRow } from './clientRecordNativeOriginal.web';
import { isPortalModuleKey } from '@/lib/portal/engine/portalModuleKeys';
import { normalizeClientFundingSources } from '@/types/clients/clientFundingSource';
import type { ClientRecordEditController, ClientEditReadLease, ClientEditOriginal } from './clientRecordEditController.web';

import { fetchClientEditCarrierReadWeb, recognizesClientEditCarrierRuntime, type ClientEditCarrierRead } from './clientRecordEditCarrierRead.web';
import { captureClientEditCarrierFields, type ClientEditCarrierFields } from './clientRecordEditCarrierFields.web';

// Source/projection provenance only. Even a typed native source is not a
// lossless broad-patch promise: the later adapter must preserve unchanged raw
// values separately, including null/empty and non-bijective status projections.
type Field = Readonly<{ status: 'native'|'derived'|'absent'|'not_requested'|'unresolved'; sources: readonly string[] }>;
export type ClientEditOriginalRead = Readonly<{
  original: ClientEditOriginal; form: ClientIntakeFormData; fields: Readonly<Record<string,Field>>;
  /** Private full supplied input and native rows, never a UI form spread. Not an atomic snapshot. */
  originals: Readonly<{ parent: Pick<ClientEditOriginal,'record'|'full'|'recordNative'|'fullNative'|'scope'>; client: ClientNativeRow; pools: Record<string,ClientNativeRow[]>; input: unknown; selectors: Record<string,string>; carriers: ClientEditCarrierRead | null; carrierFields: ClientEditCarrierFields }>;
}>;
type NativeReadReceipt = { lease: ClientEditReadLease; assertRuntime: () => void; controller: ClientRecordEditController; carriers: ClientEditCarrierRead | null };
const minted = new WeakMap<ClientEditOriginalRead,NativeReadReceipt>();
/** Own provenance also remains bound to the actual SDK/runtime captured by this read.
 * No controller callback here: its assertRead can safely consult this recognizer. */
export function isOwnClientEditOriginalRead(lease:ClientEditReadLease,result:ClientEditOriginalRead):boolean {
  const receipt=minted.get(result);if(!receipt || receipt.lease!==lease)return false;
  try{receipt.assertRuntime();return receipt.carriers===null || recognizesClientEditCarrierRuntime(receipt.controller,lease,receipt.carriers);}catch{return false;}
}
// Verified client columns only. The legacy edit SELECT also names mobile,
// house_number/access/floor/bell/diagnoses columns absent from local client DDL.
// Those may be retained if already supplied by the actual Parent '*' original;
// a missing value is unresolved, not a confirmed blank or a new schema contract.
const rawCore = ['id','tenant_id','apartment_number','mobility_notes','visible_notes_for_employee','emergency_notes','key_management_notes'];
const ambulatory = ['id','tenant_id','client_id','home_access','key_status','key_number','bell_name','floor','elevator_available','parking_notes','access_notes','hazard_notes','pets','smoker_household','aids_on_site','hygiene_notes','infection_notes','family_doctor','created_at','updated_at'];
const insurance = ['id','tenant_id','client_id','care_level','care_level_status','care_level_valid_from','care_level_applied','decision_available','care_fund_name','health_insurance','cost_bearer_ik','billing_type','self_pay','relief_budget_prepared','substitution_prepared','prevention_prepared','is_primary','created_at','updated_at'];
const extraPools = ['client_support_preferences','client_ambulatory_details','client_stationary_details','client_insurance_profiles','client_module_assignments','client_funding_selections'] as const;
const object=(value:unknown):value is Record<string,unknown>=>!!value&&typeof value==='object'&&!Array.isArray(value);
const denied=()=>Error('Die private Formulargrundlage ist nicht vollständig in der aktuellen eigenen Akte bestätigt.');
function homeAccessSourceKnown(value:unknown):boolean {
  if(value===null)return true;
  if(typeof value!=='string')return false;
  if(!value.trim().startsWith('['))return true;
  try { const parsed:unknown=JSON.parse(value.trim());return Array.isArray(parsed)&&parsed.every(entry=>typeof entry==='string'); }
  catch { return false; }
}

/** SELECT-only preparation. Existing legacy FullDetail, entitlement sync, promotion and RPC are never delegated. */
export async function fetchClientEditOriginalReadWeb(controller:ClientRecordEditController,lease:ClientEditReadLease):Promise<ServiceResult<ClientEditOriginalRead>> {
  let closed=false, runtimeValid=true;
  let carriers:ClientEditCarrierRead|null=null;
  let capturedDb:ReturnType<typeof getSupabaseClient>|null=null;
  // A finished operation and an invalid receipt are different. Successful
  // delivery closes this operation while its private current-runtime latch lives.
  const assertRuntime=()=>{
    try{
      if(!runtimeValid || getServiceMode()!=='supabase'
        || capturedDb!==null && getSupabaseClient()!==capturedDb
        || getServiceMode()!=='supabase'
        || carriers!==null && !recognizesClientEditCarrierRuntime(controller,lease,carriers))throw denied();
    }catch(error){runtimeValid=false;throw error;}
  };
  const gate=()=>{if(closed)throw denied();controller.assertRead(lease);assertRuntime();};
  try {
    gate();if(getServiceMode()!=='supabase')throw denied();
    const db=getSupabaseClient();if(!db)throw denied();capturedDb=db;gate();
    const original=lease.original,scope=original.scope,sensitive=scope.canSensitive;
    const pools:Record<string,ClientNativeRow[]>={},selectors:Record<string,string>={};
    const dispatch=async(work:()=>PromiseLike<unknown>)=>{
      gate();const query=work();
      const pending=new Promise<unknown>((resolve,reject)=>{try{const then=query?.then;gate();if(typeof then!=='function')throw denied();then.call(query,resolve,reject);}catch(error){reject(error);}});
      const result=cloneClientNativeOriginal(await withServiceQueryTimeout(pending));
      if(!object(result)||!Object.hasOwn(result,'error')||result.error!==null)throw Error(object(result)?toGermanSupabaseError(result.error as never):'Die native Antwort ist ungeklärt.');
      gate();return result.data;
    };
    const readPool=async(table:string,columns:string,filters:readonly [string,unknown][]=[]):Promise<ClientNativeRow[]>=>{
      selectors[table]=columns;let cursor:string|null=null;const rows:ClientNativeRow[]=[];
      for(;;){
        const data=await dispatch(()=>{let q=fromUnknownTable(db,table).select(columns).eq('tenant_id',scope.tenantId).eq('client_id',scope.clientId);for(const[k,v]of filters)q=v===null?q.is(k,null):q.eq(k,v);q=q.order('id',{ascending:true}).limit(200);if(cursor)q=q.gt('id',cursor);return q;});
        const page=captureClientNativePage(data,scope,cursor);gate();
        if(page.some(row=>filters.some(([key,value])=>!Object.hasOwn(row,key)||!sameClientNativeOriginal(row[key],value))))throw denied();
        if(page.length===0)break;
        for(const row of page){if(cursor&&String(row.id).toLowerCase()<=cursor.toLowerCase())throw denied();cursor=String(row.id);rows.push(row);}
      }
      pools[table]=rows;return rows;
    };
    const ownRoot=original.fullNative.parts.client;
    if(!sameClientNativeOriginal(ownRoot,original.recordNative.parts.client))throw denied();
    const coreSelect=original.fullNative.selectors.clients;
    if(typeof coreSelect!=='string'||!coreSelect||!sensitive&&coreSelect==='*')throw denied();
    const readRoot=async(columns:string)=>captureClientNativeRoot(await dispatch(()=>db.from('clients').select(columns).eq('tenant_id',scope.tenantId).eq('id',scope.clientId).single()),scope);
    const rawSelect=rawCore.join(',');
    selectors.client_edit_raw=rawSelect;
    const raw=await readRoot(rawSelect);
    if(!sensitive&&Object.keys(raw).some(key=>!rawCore.includes(key)))throw denied();
    for(const table of extraPools){
      const columns=table==='client_ambulatory_details'?(sensitive?'*':ambulatory.join(',')):table==='client_insurance_profiles'?(sensitive?'*':insurance.join(',')):'*';
      await readPool(table,columns,table==='client_insurance_profiles'?[['is_primary',true]]:table==='client_funding_selections'?[['replaced_at',null]]:[]);
      if(!sensitive&&(table==='client_ambulatory_details'||table==='client_insurance_profiles')){
        const allowed=table==='client_ambulatory_details'?ambulatory:insurance;
        if(pools[table].some(row=>Object.keys(row).some(key=>!allowed.includes(key))))throw denied();
      }
    }
    for(const table of ['client_support_preferences','client_ambulatory_details','client_stationary_details','client_insurance_profiles','client_funding_selections'])if(pools[table].length>1)throw denied();
    let fundingSources:ClientIntakeFormData['fundingSources'];
    const funding=pools.client_funding_selections[0];
    if(funding){if(!Array.isArray(funding.sources)||funding.sources.some(value=>!['entlastungsleistung','umwandlung','verhinderungspflege','selbstzahler'].includes(String(value))))throw denied();fundingSources=normalizeClientFundingSources(funding.sources);}
    else{
      await readPool('client_care_entitlement','id,tenant_id,client_id,valid_from,valid_until,conversion_enabled',[['valid_until',null]]);
      await readPool('client_service_entitlements','id,tenant_id,client_id,service_type_key,billing_mode,is_active',[['is_active',true]]);
      const sources:string[]=[],cover=pools.client_insurance_profiles[0];
      if(pools.client_care_entitlement.length||typeof cover?.care_level==='string'&&cover.care_level.trim())sources.push('entlastungsleistung');
      const latest=[...pools.client_care_entitlement].sort((a,b)=>String(b.valid_from??'').localeCompare(String(a.valid_from??'')))[0];
      if(latest?.conversion_enabled===true)sources.push('umwandlung');
      if(pools.client_service_entitlements.some(row=>String(row.service_type_key??'').includes('verhinderung')))sources.push('verhinderungspflege');
      if(cover?.self_pay===true||pools.client_service_entitlements.some(row=>row.billing_mode==='self_payer'||row.billing_mode==='mixed'))sources.push('selbstzahler');
      fundingSources=normalizeClientFundingSources(sources);
    }
    const text=(row:ClientNativeRow|undefined,key:string)=>typeof row?.[key]==='string'?row[key] as string:'';
    const strings=(row:ClientNativeRow|undefined,key:string)=>Array.isArray(row?.[key])?(row[key] as unknown[]).filter((v):v is string=>typeof v==='string'):[];
    const support=pools.client_support_preferences[0],amb=pools.client_ambulatory_details[0],station=pools.client_stationary_details[0],cover=pools.client_insurance_profiles[0];
    const intakeSnapshot:Partial<ClientIntakeFormData>={};
    for(const [field,key]of Object.entries({admissionDate:'admission_date',serviceStart:'service_start',birthPlace:'birth_place',nationality:'nationality',language:'language',maritalStatus:'marital_status',housingForm:'housing_form',specialNotes:'special_notes',preferredContact:'preferred_contact'})) (intakeSnapshot as Record<string,unknown>)[field]=text(ownRoot,key);
    for(const[field,key]of Object.entries({mobility:'mobility',orientation:'orientation',communication:'communication'}))(intakeSnapshot as Record<string,unknown>)[field]=text(support,key);
    intakeSnapshot.supportWishes=strings(support,'support_wishes');intakeSnapshot.preferredTimes=strings(support,'preferred_times');intakeSnapshot.excludedTimes=strings(support,'excluded_times');
    for(const[field,key]of Object.entries({keyStatus:'key_status',keyNumber:'key_number',keySafeCode:'key_safe_code',doorCode:'door_code',bellName:'bell_name',floor:'floor',parkingNotes:'parking_notes',accessNotes:'access_notes',hazardNotes:'hazard_notes',pets:'pets',aidsOnSite:'aids_on_site',hygieneNotes:'hygiene_notes',infectionNotes:'infection_notes',familyDoctor:'family_doctor'}))(intakeSnapshot as Record<string,unknown>)[field]=text(amb,key);
    intakeSnapshot.homeAccess=parseHomeAccessStoredValue(text(amb,'home_access'));intakeSnapshot.elevatorAvailable=amb?.elevator_available===true;intakeSnapshot.smokerHousehold=amb?.smoker_household===true;
    for(const[field,key]of Object.entries({facilityName:'facility_name',facilityLocation:'facility_location',careArea:'care_area',roomNumber:'room_number',bedPosition:'bed_position',admissionDateStationary:'admission_date',residentStatus:'resident_status',roomStatus:'room_status',primaryNurse:'primary_nurse',areaManager:'area_manager',costForm:'cost_form',mealNotes:'meal_notes',dailyStructure:'daily_structure'}))(intakeSnapshot as Record<string,unknown>)[field]=text(station,key);
    for(const[field,key]of Object.entries({careLevel:'care_level',careLevelStatus:'care_level_status',careLevelValidFrom:'care_level_valid_from',careFundName:'care_fund_name',healthInsurance:'health_insurance',costBearerIk:'cost_bearer_ik',insuranceNumber:'insurance_number'}))(intakeSnapshot as Record<string,unknown>)[field]=text(cover,key);
    intakeSnapshot.selfPay=cover?.self_pay===true;intakeSnapshot.fundingSources=fundingSources;
    const input={detail:original.record.detail,fullClient:original.full,careContexts:original.record.careContexts,form:mapClientToEditForm(original.record.detail,original.full,original.record.careContexts,mapClientEditRawFields({...ownRoot,...raw})),ambulatoryHomeAccess:text(amb,'home_access'),intakeSnapshot};
    input.form.portalModules=pools.client_module_assignments.filter(row=>isPortalModuleKey(String(row.module_key))&&(row.is_active===undefined?row.status!=='inactive'&&row.status!=='deactivated':row.is_active!==false)).map(row=>String(row.module_key)) as typeof input.form.portalModules;
    const captured=captureClientIntakeEditOriginalForm(input,ownRoot,scope);gate();
    const form=captured.form,fields:Record<string,Field>=Object.fromEntries(Object.keys(form).map(field=>[field,{status:'unresolved',sources:[]}]));
    const mark=(field:string,status:Field['status'],sources:string[])=>{fields[field]={status,sources};};
    const nativeField=(field:string,row:ClientNativeRow|undefined,key:string,source:string)=>{
      const projected=(form as unknown as Record<string,unknown>)[field],value=row?.[key];
      const valid=Array.isArray(projected)?Array.isArray(value)&&value.every(entry=>typeof entry==='string')
        :typeof projected==='boolean'?typeof value==='boolean':value===null||typeof value==='string';
      mark(field,!row?'absent':Object.hasOwn(row,key)&&valid?'native':'unresolved',[source+'.'+key]);
    };
    const derivedText=(field:string,sources:string[],target:ClientNativeRow|undefined,key:string)=>{
      const value=target?.[key],projected=(form as unknown as Record<string,unknown>)[field];
      // If the actual shared mapper chose another source, this visible value
      // cannot establish an unchanged target value for a later broad patch.
      const conflict=!!target&&(!Object.hasOwn(target,key)||value!==null&&typeof value!=='string'||projected!==(value??''));
      mark(field,conflict?'unresolved':'derived',sources);
    };
    for(const[field,key]of Object.entries({status:'status',salutation:'salutation',firstName:'first_name',lastName:'last_name',dateOfBirth:'date_of_birth',gender:'gender',housingForm:'housing_form',admissionDate:'admission_date',serviceStart:'service_start',specialNotes:'special_notes',street:'street',zip:'postal_code',city:'city',phone:'phone',email:'email',preferredContact:'preferred_contact'}))nativeField(field,ownRoot,key,'clients');
    // The real bridge maps deceased/deleted to workflow labels whose reverse
    // mapping differs. Never present that label as a native round-trip status.
    mark('status',typeof ownRoot.status==='string'&&['lead','active','paused','inactive','archived','deceased','blocked','deleted'].includes(ownRoot.status)?'derived':'unresolved',['clients.status','clientStatusBridge.remoteStatusToWorkflow']);
    for(const field of ['street','zip','city'])mark(field,'derived',['parent.full.addresses','parent.record.detail','parent.full.core']);
    mark('phone','derived',['parent.record.detail.phone','parent.record.detail.primaryContactPhone','clients.phone','clients.mobile','clients.primary_contact_phone']);
    mark('specialNotes','derived',['parent.record.detail.notes','clients.internal_notes','clients.visible_notes_for_employee']);
    mark('houseNumber','derived',['parent.full.addresses','clients.street','clients.house_number']);nativeField('mobile',ownRoot,'mobile','clients');
    for(const field of ['emergencyContactName','emergencyContactPhone'])mark(field,'derived',['parent.full.contacts']);
    mark('careContexts',original.record.careContexts.length?'derived':'unresolved',['parent.record.careContexts']);
    for(const[field,key]of Object.entries({careLevelStatus:'care_level_status',healthInsurance:'health_insurance',costBearerIk:'cost_bearer_ik',selfPay:'self_pay'}))nativeField(field,cover,key,'client_insurance_profiles');
    for(const field of ['careLevelValidFrom','careFundName','insuranceNumber'])mark(field,'derived',['parent.full.careLevels','parent.record.detail','client_insurance_profiles']);
    mark('careLevel','derived',['clients.care_level','parent.full.careLevels','client_insurance_profiles.care_level']);
    for(const field of ['billingType','billingTypes','costBearerType','costBearerTypes'])mark(field,'derived',['parent.full.billingProfile','parent.record.detail.costCarrier']);
    mark('fundingSources','derived',['client_funding_selections','client_insurance_profiles','client_care_entitlement','client_service_entitlements']);
    for(const[field,key]of Object.entries({supportWishes:'support_wishes',preferredTimes:'preferred_times',excludedTimes:'excluded_times',mobility:'mobility',orientation:'orientation',communication:'communication'}))nativeField(field,support,key,'client_support_preferences');
    derivedText('mobility',['parent.full.preferences.mobilityNotes','clients.mobility_notes','client_support_preferences.mobility'],support,'mobility');
    derivedText('communication',['clients.key_management_notes','client_support_preferences.communication'],support,'communication');
    for(const[field,key]of Object.entries({homeAccess:'home_access',keyStatus:'key_status',keyNumber:'key_number',keySafeCode:'key_safe_code',doorCode:'door_code',bellName:'bell_name',floor:'floor',elevatorAvailable:'elevator_available',parkingNotes:'parking_notes',accessNotes:'access_notes',hazardNotes:'hazard_notes',pets:'pets',smokerHousehold:'smoker_household',aidsOnSite:'aids_on_site',hygieneNotes:'hygiene_notes',infectionNotes:'infection_notes',familyDoctor:'family_doctor'}))nativeField(field,amb,key,'client_ambulatory_details');
    mark('homeAccess',!amb?'absent':Object.hasOwn(amb,'home_access')&&homeAccessSourceKnown(amb.home_access)?'derived':'unresolved',['client_ambulatory_details.home_access','clientIntakeHomeAccess.parseHomeAccessStoredValue']);
    for(const[field,key,parents]of [
      ['familyDoctor','family_doctor',['parent.full.contacts','input.form.familyDoctorName']],
      ['floor','floor',['parent.full.addresses','clients.floor']],
      ['accessNotes','access_notes',['parent.full.addresses','clients.access_notes']],
      ['doorCode','door_code',['parent.full.addresses','input.form.accessCode']],
      ['bellName','bell_name',['clients.doorbell_name','parent.full.addresses.doorCode']],
    ] as const)derivedText(field,[...parents,'client_ambulatory_details.'+key],amb,key);
    for(const[field,key]of Object.entries({facilityName:'facility_name',careArea:'care_area',roomNumber:'room_number'}))nativeField(field,station,key,'client_stationary_details');
    if(!sensitive)for(const field of ['insuranceNumber','keySafeCode','doorCode']){(form as unknown as Record<string,unknown>)[field]='';mark(field,'not_requested',[]);}
    // The complete carrier history has its own private minted generation. A
    // denied/unknown pool never becomes a delivered empty target or field grant.
    let carrierUnavailable=false;
    if(sensitive){
      gate();const status=controller.status();gate();
      // Inspection after a pending/unknown journal remains available. Its
      // preparation-only carrier pool is explicitly unknown, never known-empty.
      carrierUnavailable=status.pending || status.uncertainOwners!==0;
    }
    if(sensitive&&!carrierUnavailable){
      gate();const read=await fetchClientEditCarrierReadWeb(controller,lease);gate();
      if(!read.ok)throw denied();carriers=read.data;gate();
    }
    const carrierFields=captureClientEditCarrierFields(carriers?.originals??null,{tenantId:scope.tenantId,clientId:scope.clientId},form,{core:ownRoot,insurance:pools.client_insurance_profiles,careLevels:original.fullNative.parts.careLevels,billing:original.fullNative.parts.billingProfiles},carrierUnavailable);gate();
    // No carrier mutation phase is implemented. Even congruent snapshot
    // metadata cannot authorize a compound/JSON/creation/history write chain.
    for(const field of Object.keys(carrierFields.fields))mark(field,!sensitive?'not_requested':'unresolved',[...fields[field]?.sources??[],...carrierFields.fields[field].sources]);
    // The exact current root must still equal the captured Parent source after all extra reads/mapper work.
    selectors.client_verify=coreSelect;
    if(!sameClientNativeOriginal(await readRoot(coreSelect),ownRoot))throw denied();gate();
    // Runtime owner/ticket references stay opaque and mutable in their Parent; freeze only captured DTO evidence.
    const parent={record:original.record,full:original.full,recordNative:original.recordNative,fullNative:original.fullNative,scope:original.scope};
    const result=Object.freeze({original,form:freezeClientNativeOriginal(form),fields:freezeClientNativeOriginal(fields),originals:freezeClientNativeOriginal({parent,client:raw,pools,input:captured.originals.input,selectors,carriers,carrierFields})});
    minted.set(result,{lease,assertRuntime,controller,carriers});controller.deliver(lease,result);gate();closed=true;
    return{ok:true,data:result};
  }catch(error){closed=true;runtimeValid=false;return{ok:false,error:error instanceof Error?error.message:'Die private native Formulargrundlage ist ungeklärt.'};}
}
