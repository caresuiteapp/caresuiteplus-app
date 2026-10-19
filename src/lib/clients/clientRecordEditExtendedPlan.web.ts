import type { ClientIntakeFormData } from '@/types/forms/clientIntakeForm';
import type { IntakeSectionKey } from './clientIntakeFieldRules';
import type { ClientEditOriginalRead } from './clientRecordEditRead.web';
import { CLIENT_MASTER_DATA_SECTION_KEYS } from './clientMasterDataSections';
import { cloneClientNativeOriginal, freezeClientNativeOriginal, sameClientNativeOriginal, captureClientNativePage, type ClientNativeRow } from './clientRecordNativeOriginal.web';
import { woundInstant, woundUuid } from '../pflege/woundCareDomain.ts';
import { parseHomeAccessStoredValue, serializeHomeAccessValues } from './clientIntakeHomeAccess';
import { resolveIntakeBillingProfileType } from './clientIntakeBilling';
import { resolvePrimaryCostBearerName, resolvePrimaryCostBearerReference } from './clientIntakeCostBearerConfig';

export type ClientEditExtendedStep = Readonly<{
  table: string; mode: 'update' | 'insert'; original: ClientNativeRow | null;
  payload: Readonly<Record<string, unknown>>; predicates: Readonly<Record<string,unknown>>; createdColumns: readonly string[];
}>;
export type ClientEditExtendedPlan = Readonly<{
  form: ClientIntakeFormData; sections: readonly IntakeSectionKey[]; changes: readonly string[];
  steps: readonly ClientEditExtendedStep[]; coreRequired: boolean; requiredOtherPhases: readonly string[];
}>;
const fields: Partial<Record<IntakeSectionKey, readonly string[]>> = {
  leistungsart: ['careContexts'],
  stammdaten: ['status','salutation','firstName','lastName','dateOfBirth','gender','housingForm','admissionDate','serviceStart','specialNotes'],
  adresse_kontakt: ['street','houseNumber','zip','city','phone','mobile','email','preferredContact'],
  versorgung: ['careLevel','careLevelStatus','careLevelValidFrom','familyDoctor','supportWishes','preferredTimes','excludedTimes','mobility','orientation','communication'],
  kostentraeger: ['fundingSources','billingType','billingTypes','costBearerType','costBearerTypes','careFundName','careFundStreet','careFundZip','careFundCity','healthInsurance','healthInsuranceStreet','healthInsuranceZip','healthInsuranceCity','healthInsuranceIk','privatversicherungName','sozialamtName','beihilfeName','selbstzahlerName','berufsgenossenschaftName','unfallversicherungName','sonstigerName','costBearerIk','insuranceNumber','selfPay'],
  angehoerige: ['emergencyContactName','emergencyContactPhone'],
  notfall_zugang: ['homeAccess','keyStatus','keyNumber','keySafeCode','doorCode','bellName','floor','elevatorAvailable','parkingNotes','accessNotes','hazardNotes','facilityName','careArea','roomNumber','pets','smokerHousehold','aidsOnSite','hygieneNotes','infectionNotes'],
};
const contextKeys = new Set(['daily_assistance','support_care','companionship','ambulatory_care','stationary_care','consulting','academy_prepared']);
const deny = (): never => { throw Error('Die ganze private Änderung benötigt eindeutig belegte native Extended-Ziele und vollständige ausgewählte Feldketten.'); };
const own = (row: ClientNativeRow, key: string): unknown => Object.hasOwn(row,key) ? row[key] : deny();
const text = (value: unknown): string => typeof value === 'string' ? value : deny();
const time = (value: unknown): string => typeof value === 'string' && woundInstant(value.replace(' ','T')) !== null ? value : deny();
const date = (value: unknown): string | null => {
  const raw=text(value);if(raw==='')return null;
  if(!/^\d{4}-\d{2}-\d{2}$/.test(raw)||Number(raw.slice(0,4))<1||woundInstant(raw+'T00:00:00Z')===null)deny();return raw;
};
const strings = (value: unknown): string[] => Array.isArray(value) && value.every(entry=>typeof entry==='string') ? value : deny();

/** Pure query-free plan only. Own reader/lease/attempt provenance is established by the Writer.
 * Every required native target is resolved before the caller's first Core mutation.
 * It never delegates legacy broad sync, clinical completion, derived account writes or promotion. */
export function planClientEditExtendedWeb(read: ClientEditOriginalRead, input: ClientIntakeFormData, selected?: readonly IntakeSectionKey[]): ClientEditExtendedPlan {
  const form=freezeClientNativeOriginal(cloneClientNativeOriginal(input));
  const sections=freezeClientNativeOriginal(cloneClientNativeOriginal(selected?.length ? selected : CLIENT_MASTER_DATA_SECTION_KEYS));
  if(new Set(sections).size!==sections.length||sections.some(section=>!fields[section]))deny();
  if(sections.some(section=>fields[section]!.some(field=>!['native','derived','absent'].includes(read.fields[field]?.status??'unresolved'))))deny();
  if(Object.keys(read.form).some(field=>!Object.hasOwn(form,field)))deny();
  const changes=Object.keys(form).filter(field=>!Object.hasOwn(read.form,field)||!sameClientNativeOriginal(form[field as keyof ClientIntakeFormData],read.form[field as keyof ClientIntakeFormData]));
  if(changes.some(field=>!sections.some(section=>fields[section]!.includes(field))))deny();
  // Every changed field has an explicit native chain. Merely naming a future
  // phase is no whole preflight for unsupported contact/core/carrier chains.
  const coreTargets=new Set([...fields.stammdaten!, 'careLevel','insuranceNumber',
    'costBearerTypes','careFundName','healthInsurance','privatversicherungName','sozialamtName',
    'beihilfeName','selbstzahlerName','berufsgenossenschaftName','unfallversicherungName','sonstigerName']);
  const implemented=new Set([...fields.stammdaten!, 'street','houseNumber','zip','city',
    ...fields.versorgung!, 'careFundName','healthInsurance','costBearerIk','insuranceNumber','billingTypes','selfPay',
    ...fields.angehoerige!, ...fields.notfall_zugang!, 'careContexts']);
  if(changes.some(field=>!implemented.has(field)))deny();
  const coreRequired=changes.some(field=>coreTargets.has(field));
  const changed=(field:string)=>changes.includes(field), chosen=(section:IntakeSectionKey)=>sections.includes(section);
  const scope=read.original.scope, steps:ClientEditExtendedStep[]=[], requiredOtherPhases=new Set<string>();
  const parent=read.originals.parent;
  const parentPool=(key: keyof typeof parent.fullNative.parts): ClientNativeRow[] => {
    if(key==='client')return deny();
    const full=parent.fullNative.parts[key], record=parent.recordNative.parts[key];
    if(!sameClientNativeOriginal(full,record))deny();
    return captureClientNativePage(full,scope,null);
  };
  const extraPool=(table:string):ClientNativeRow[]=>{
    if(!Object.hasOwn(read.originals.pools,table)||read.originals.selectors[table]!=='*')deny();
    return captureClientNativePage(read.originals.pools[table],scope,null);
  };
  const single=(rows:ClientNativeRow[]):ClientNativeRow=>rows.length===1?rows[0]:deny();
  const target=(rows:ClientNativeRow[],id:unknown):ClientNativeRow=>{
    if(!woundUuid(id))deny();const found=rows.filter(row=>row.id===id);return found.length===1?found[0]:deny();
  };
  const push=(table:string,original:ClientNativeRow,payload:Record<string,unknown>)=>{
    if(!Object.keys(payload).length)return;
    time(own(original,'created_at'));time(own(original,'updated_at'));
    if(Object.keys(payload).some(key=>!Object.hasOwn(original,key)))deny();
    // Several verified native tables have no updated_at trigger. A raw version
    // alone cannot protect their changed targets. Only exact native scalar/null
    // predicates have a verified private operator contract; arrays/JSON deny.
    if(Object.keys(payload).some(key=>{const value=own(original,key);return value!==null
      &&!['string','number','boolean'].includes(typeof value)||typeof value==='number'&&!Number.isFinite(value);}))deny();
    // Native roles determine which original record was explicitly selected.
    // An unchanged version must not let a concurrent role/primary change turn
    // an address/doctor/historical-care target into a different native target.
    const roleColumns:Record<string,readonly string[]>={client_contacts:['contact_type'],
      client_addresses:['is_primary','address_type'],client_insurance_profiles:['is_primary'],
      client_care_levels:['grade','valid_from','valid_until']};
    const predicates:Record<string,unknown>={};
    for(const key of [...Object.keys(payload),...(roleColumns[table]??[])]){
      const value=own(original,key);
      if(value!==null&&!['string','number','boolean'].includes(typeof value)||typeof value==='number'&&!Number.isFinite(value))deny();
      predicates[key]=value;
    }
    steps.push(freezeClientNativeOriginal({table,mode:'update',original:cloneClientNativeOriginal(original),payload:cloneClientNativeOriginal(payload),predicates,createdColumns:[]}));
  };
  const projection=(field:string,row:ClientNativeRow,key:string,project:(value:unknown)=>unknown=(value)=>value===null?'':text(value))=>{
    if(!sameClientNativeOriginal(project(own(row,key)),read.form[field as keyof ClientIntakeFormData]))deny();
  };
  const map=(row:ClientNativeRow,mapping:Record<string,string>):Record<string,unknown>=>{
    const patch:Record<string,unknown>={};
    for(const[field,key]of Object.entries(mapping))if(changed(field)){
      const next=form[field as keyof ClientIntakeFormData];
      if(Array.isArray(next)){projection(field,row,key,strings);patch[key]=cloneClientNativeOriginal(strings(next));}
      else if(typeof next==='boolean'){projection(field,row,key,value=>typeof value==='boolean'?value:deny());patch[key]=next;}
      else {projection(field,row,key);patch[key]=text(next).trim()||null;}
    }
    return patch;
  };
  if(chosen('leistungsart')&&changed('careContexts')){
    const raw=parent.recordNative.careContexts;
    if(!raw||parent.fullNative.careContexts!==null&&!sameClientNativeOriginal(raw,parent.fullNative.careContexts))deny();
    const rows=captureClientNativePage(raw,scope,null), old=strings(read.form.careContexts), next=strings(form.careContexts);
    if(rows.length!==old.length||new Set(old).size!==old.length||new Set(next).size!==next.length
      ||rows.some(row=>!contextKeys.has(String(row.context_key))||typeof row.is_primary!=='boolean')
      ||old.some(key=>rows.filter(row=>row.context_key===key).length!==1)||rows.filter(row=>row.is_primary===true).length!==1
      ||next.length<old.length||old.some((key,index)=>next[index]!==key)||next.some(key=>!contextKeys.has(key)))deny();
    // No verified ended/inactive contract and no updated_at on this table:
    // removals, reordering and Primary switches are unsupported before ANY write.
    for(const key of next.slice(old.length))steps.push(freezeClientNativeOriginal({table:'client_care_contexts',mode:'insert',original:null,
      payload:{tenant_id:scope.tenantId,client_id:scope.clientId,context_key:key,is_primary:false},predicates:{},
      createdColumns:['id','tenant_id','client_id','context_key','is_primary','created_at']}));
  }
  if((chosen('leistungsart')||chosen('versorgung'))&&['supportWishes','preferredTimes','excludedTimes','mobility','orientation','communication'].some(changed)){
    const row=single(extraPool('client_support_preferences'));
    push('client_support_preferences',row,map(row,{supportWishes:'support_wishes',preferredTimes:'preferred_times',excludedTimes:'excluded_times',mobility:'mobility',orientation:'orientation',communication:'communication'}));
  }
  if(chosen('adresse_kontakt')&&['street','houseNumber','zip','city'].some(changed)){
    const raw=parentPool('addresses'), primary=raw.filter(row=>row.is_primary===true);
    if(primary.length!==1)deny();const row=primary[0], input=read.originals.input as {form?:{primaryAddressId?:unknown}};
    if(input.form?.primaryAddressId!==row.id)deny();
    const patch=map(row,{zip:'zip',city:'city'});
    if(changed('street')||changed('houseNumber')){
      const old=[text(read.form.street).trim(),text(read.form.houseNumber).trim()].filter(Boolean).join(' ');
      if(own(row,'street')!==old)deny();patch.street=[text(form.street).trim(),text(form.houseNumber).trim()].filter(Boolean).join(' ');
    }
    if(Object.entries(patch).some(([key,value])=>['street','zip','city'].includes(key)&&(typeof value!=='string'||!value)))deny();
    push('client_addresses',row,patch);
  }
  if((chosen('versorgung')||chosen('kostentraeger'))&&['careLevel','careLevelValidFrom','careFundName','insuranceNumber','careLevelStatus'].some(changed)){
    const dto=parent.full.careLevels[0], row=target(parentPool('careLevels'),dto?.id),patch:Record<string,unknown>={};
    for(const[field,key]of Object.entries({careLevel:'grade',careLevelValidFrom:'valid_from',careFundName:'care_fund_name',insuranceNumber:'care_fund_member_id',careLevelStatus:'notes'}))if(changed(field)){
      projection(field,row,key);patch[key]=field==='careLevelValidFrom'?date(form[field]):text(form[field as keyof ClientIntakeFormData]).trim()||null;
    }
    if(Object.hasOwn(patch,'grade')&&!['kein','pg1','pg2','pg3','pg4','pg5','hospiz'].includes(String(patch.grade)))deny();
    if(Object.hasOwn(patch,'valid_from')&&patch.valid_from===null||Object.hasOwn(patch,'care_fund_name')&&(typeof patch.care_fund_name!=='string'||!patch.care_fund_name))deny();
    push('client_care_levels',row,patch);
  }
  const payerNameInputs=['costBearerTypes','careFundName','healthInsurance','privatversicherungName','sozialamtName','beihilfeName','selbstzahlerName','berufsgenossenschaftName','unfallversicherungName','sonstigerName'];
  const payerReferenceInputs=['costBearerTypes','careFundStreet','careFundZip','careFundCity','healthInsuranceStreet','healthInsuranceZip','healthInsuranceCity','healthInsuranceIk','costBearerIk'];
  if((chosen('kostentraeger')||chosen('leistungsart')||chosen('versorgung'))&&['billingTypes','careContexts',...payerNameInputs,...payerReferenceInputs].some(changed)){
    const dto=parent.full.billingProfile,row=target(parentPool('billingProfiles'),dto?.id),patch:Record<string,unknown>={};
    const derived=(column:string,old:unknown,next:unknown)=>{if(!sameClientNativeOriginal(own(row,column),old))deny();if(!sameClientNativeOriginal(old,next))patch[column]=next;};
    if(changed('billingTypes')){const old=resolveIntakeBillingProfileType(read.form.billingTypes),next=resolveIntakeBillingProfileType(form.billingTypes);if(!['selbstzahler','pflegekasse','beihilfe','kombi','sonstige'].includes(next))deny();derived('billing_type',old,next);derived('notes',read.form.billingTypes.join(', ')||null,form.billingTypes.join(', ')||null);}
    if(changed('careContexts')){const service=(values:string[])=>values.includes('ambulatory_care')?'sachleistung':values.some(v=>['support_care','daily_assistance'].includes(v))?'betreuung':values.includes('stationary_care')?'haushalt':'betreuung';derived('service_type',service(read.form.careContexts),service(form.careContexts));}
    if(payerNameInputs.some(changed))derived('cost_bearer_name',resolvePrimaryCostBearerName(read.form),resolvePrimaryCostBearerName(form));
    if(payerReferenceInputs.some(changed))derived('cost_bearer_reference',resolvePrimaryCostBearerReference(read.form),resolvePrimaryCostBearerReference(form));
    if(changed('selbstzahlerName')){projection('selbstzahlerName',row,'invoice_recipient');patch.invoice_recipient=text(form.selbstzahlerName).trim()||null;}
    push('client_billing_profiles',row,patch);
  }
  if(chosen('kostentraeger')&&['careLevel','careLevelStatus','careLevelValidFrom','careFundName','healthInsurance','costBearerIk','insuranceNumber','billingTypes','selfPay'].some(changed)){
    const rows=extraPool('client_insurance_profiles'),row=single(rows);if(row.is_primary!==true)deny();
    const patch=map(row,{careLevel:'care_level',careLevelStatus:'care_level_status',careFundName:'care_fund_name',healthInsurance:'health_insurance',costBearerIk:'cost_bearer_ik',insuranceNumber:'insurance_number',selfPay:'self_pay'});
    if(changed('careLevelValidFrom')){projection('careLevelValidFrom',row,'care_level_valid_from');patch.care_level_valid_from=date(form.careLevelValidFrom);}
    if(changed('billingTypes')){const old=resolveIntakeBillingProfileType(read.form.billingTypes);if(own(row,'billing_type')!==old)deny();patch.billing_type=resolveIntakeBillingProfileType(form.billingTypes);}
    push('client_insurance_profiles',row,patch);
  }
  const contactPlan=(kind:'emergency_contact'|'doctor',nameField:'emergencyContactName'|'familyDoctor',phoneField?:'emergencyContactPhone')=>{
    const relevant=[nameField,...phoneField?[phoneField]:[]];if(!relevant.some(changed))return;
    const input=read.originals.input as {form?:{emergencyContactId?:unknown;familyDoctorId?:unknown}},id=kind==='doctor'?input.form?.familyDoctorId:input.form?.emergencyContactId;
    const row=target(parentPool('contacts'),id);if(own(row,'contact_type')!==kind)deny();
    const patch:Record<string,unknown>={};
    if(changed(nameField)){
      const old=[own(row,'first_name'),own(row,'last_name')].filter(value=>value!==null&&value!=='').map(text).join(' ').trim();
      if(read.form[nameField]!==old)deny();const next=text(form[nameField]).trim();if(!next)deny();const parts=next.split(/\s+/);patch.first_name=parts[0];patch.last_name=parts.slice(1).join(' ');
    }
    if(phoneField&&changed(phoneField)){projection(phoneField,row,'phone');patch.phone=text(form[phoneField]).trim()||null;}
    // A blank contact is not an implicitly authorized deletion.
    if(kind==='emergency_contact'&&!text(form.emergencyContactName).trim()&&!text(form.emergencyContactPhone).trim())deny();
    push('client_contacts',row,patch);
  };
  if(chosen('angehoerige')||chosen('notfall_zugang'))contactPlan('emergency_contact','emergencyContactName','emergencyContactPhone');
  if(chosen('notfall_zugang')||chosen('versorgung'))contactPlan('doctor','familyDoctor');
  const ambFields={keyStatus:'key_status',keyNumber:'key_number',keySafeCode:'key_safe_code',doorCode:'door_code',bellName:'bell_name',floor:'floor',elevatorAvailable:'elevator_available',parkingNotes:'parking_notes',accessNotes:'access_notes',hazardNotes:'hazard_notes',pets:'pets',smokerHousehold:'smoker_household',aidsOnSite:'aids_on_site',hygieneNotes:'hygiene_notes',infectionNotes:'infection_notes',familyDoctor:'family_doctor'};
  if((chosen('notfall_zugang')||chosen('versorgung'))&&['homeAccess',...Object.keys(ambFields)].some(changed)){
    const row=single(extraPool('client_ambulatory_details')),patch=map(row,ambFields);
    if(changed('homeAccess')){
      projection('homeAccess',row,'home_access',value=>parseHomeAccessStoredValue(value===null?null:text(value)));
      const next=strings(form.homeAccess);if(next.some(value=>!value||value.trim()!==value||value.includes(',')))deny();patch.home_access=serializeHomeAccessValues(next);
    }
    push('client_ambulatory_details',row,patch);
  }
  if((chosen('notfall_zugang')||chosen('versorgung'))&&['facilityName','careArea','roomNumber'].some(changed)){
    const row=single(extraPool('client_stationary_details'));push('client_stationary_details',row,map(row,{facilityName:'facility_name',careArea:'care_area',roomNumber:'room_number'}));
  }
  if(chosen('kostentraeger')&&changes.some(field=>fields.kostentraeger!.includes(field)))requiredOtherPhases.add('cost_carriers');
  if(changed('fundingSources'))requiredOtherPhases.add('funding_selections');
  if(['careLevel','careLevelStatus','careLevelValidFrom'].some(changed))requiredOtherPhases.add('care_documents');
  if(changed('careContexts'))requiredOtherPhases.add('client_core_context');
  const targeted=new Set(steps.flatMap(step=>Object.keys(step.payload)));
  if(targeted.has('status')||steps.some(step=>['clients','client_timeline_events','client_documents'].includes(step.table)))deny();
  return freezeClientNativeOriginal({form,sections,changes,steps,coreRequired,requiredOtherPhases:[...requiredOtherPhases]});
}
