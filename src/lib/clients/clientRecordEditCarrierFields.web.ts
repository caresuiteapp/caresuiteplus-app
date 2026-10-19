import type { ClientIntakeFormData } from '@/types/forms/clientIntakeForm';
import { UI_TO_DB_CARRIER_TYPE } from '@/features/costCarriers/costCarrierTypes';
import { cloneClientNativeOriginal, freezeClientNativeOriginal, sameClientNativeOriginal, assertClientNativeScope, captureClientNativePage, captureClientNativeRoot, type ClientNativeScope, type ClientNativeRow } from './clientRecordNativeOriginal.web';
import { captureClientEditCarrierOriginals, type ClientEditCarrierOriginals } from './clientRecordEditCarrierOriginal.web';

// This is the unchanged controller's selected field contract, not a new write
// adapter. Other template selectors and address fields remain private metadata.
const fields = ['fundingSources','billingType','billingTypes','costBearerType','costBearerTypes','careFundName','careFundStreet','careFundZip','careFundCity','healthInsurance','healthInsuranceStreet','healthInsuranceZip','healthInsuranceCity','healthInsuranceIk','privatversicherungName','sozialamtName','beihilfeName','selbstzahlerName','berufsgenossenschaftName','unfallversicherungName','sonstigerName','costBearerIk','insuranceNumber','selfPay'] as const;
const mapping: Record<string, readonly [keyof typeof UI_TO_DB_CARRIER_TYPE, string]> = {
  careFundName:['pflegekasse','name_snapshot'],careFundStreet:['pflegekasse','address_snapshot.street'],careFundZip:['pflegekasse','address_snapshot.postalCode'],careFundCity:['pflegekasse','address_snapshot.city'],
  healthInsurance:['krankenkasse','name_snapshot'],healthInsuranceStreet:['krankenkasse','address_snapshot.street'],healthInsuranceZip:['krankenkasse','address_snapshot.postalCode'],healthInsuranceCity:['krankenkasse','address_snapshot.city'],healthInsuranceIk:['krankenkasse','ik_number_snapshot'],
  privatversicherungName:['privatversicherung','name_snapshot'],sozialamtName:['sozialamt','name_snapshot'],berufsgenossenschaftName:['berufsgenossenschaft','name_snapshot'],unfallversicherungName:['unfallversicherung','name_snapshot'],
};
type Candidate = Readonly<{ assignmentId:string; carrierType:string; column:string; supplied:boolean; value:unknown; formMatches:boolean; archivedAt:unknown; primary:unknown }>;
type Field = Readonly<{ status:'not_requested'|'unresolved'; mutation:'unsupported'; baseline:unknown; sources:readonly string[]; candidates:readonly Candidate[]; reason:string }>;
export type ClientEditCarrierFields = Readonly<{
  requested:boolean; assignments:'not_requested'|'unknown'|'empty'|'delivered';
  fields:Readonly<Record<string,Field>>;
  /** Complete ID membership in delivered order, not payer priority or active selection. */
  membership:readonly Readonly<{assignmentId:string;carrierType:string;archivedAt:unknown;primary:unknown}>[];
  /** Original sources remain distinct even when their text happens to match. */
  compound:unknown;
}>;
const fail=()=>Error('Die nativen Kostenträger-Feldquellen sind ungeklärt.');
/** Pure neutral source metadata. No receipt, permission, target plan or write grant is minted. */
export function captureClientEditCarrierFields(input:ClientEditCarrierOriginals|null,scopeInput:ClientNativeScope,form:ClientIntakeFormData,compoundInput:{core:ClientNativeRow;insurance:ClientNativeRow[];careLevels:ClientNativeRow[];billing:ClientNativeRow[]},unavailable=false):ClientEditCarrierFields {
  const scope=cloneClientNativeOriginal(scopeInput);assertClientNativeScope(scope);
  const captured=cloneClientNativeOriginal(input);
  const baseline=cloneClientNativeOriginal(form);
  if(fields.some(key=>!Object.hasOwn(baseline,key)))throw fail();
  if(captured===null)return freezeClientNativeOriginal({requested:unavailable,assignments:unavailable?'unknown' as const:'not_requested' as const,fields:Object.fromEntries(fields.map(key=>[key,{status:unavailable?'unresolved' as const:'not_requested' as const,mutation:'unsupported' as const,baseline:baseline[key],sources:[],candidates:[],reason:unavailable?'unavailable_current_preparation':'not_requested'}])),membership:[],compound:null});
  if(!sameClientNativeOriginal(captured.scope,scope))throw fail();
  const original=captureClientEditCarrierOriginals(captured.pools,scope);
  if(!sameClientNativeOriginal(captured,original))throw fail();
  const raw=cloneClientNativeOriginal(compoundInput);
  const compound={core:captureClientNativeRoot(raw.core,scope),insurance:captureClientNativePage(raw.insurance,scope,null),careLevels:captureClientNativePage(raw.careLevels,scope,null),billing:captureClientNativePage(raw.billing,scope,null)};
  const report:Record<string,Field>={};
  for(const key of fields){
    const map=mapping[key],rows=map?original.pools.assignments.filter(row=>row.carrier_type===UI_TO_DB_CARRIER_TYPE[map[0]]):key==='insuranceNumber'?original.pools.assignments:[];
    const column=map?.[1]??'insurance_number';
    const candidates=rows.map(row=>{
      const [head,part]=column.split('.'),address=row[head];
      const supplied=part===undefined?Object.hasOwn(row,head):!!address&&typeof address==='object'&&!Array.isArray(address)&&Object.hasOwn(address,part)&&typeof (address as ClientNativeRow)[part]==='string';
      const value=supplied?(part===undefined?row[head]:(address as ClientNativeRow)[part]):undefined;
      return {assignmentId:String(row.id),carrierType:String(row.carrier_type),column,supplied,value,formMatches:supplied&&sameClientNativeOriginal(baseline[key],value),archivedAt:row.archived_at,primary:row.is_primary};
    });
    const reason=!map&&key!=='insuranceNumber'?'no_bijective_assignment_target':rows.length!==1?'assignment_missing_or_ambiguous':rows[0].archived_at!==null?'historical_assignment':column.includes('.')?'json_mutation_unsupported':!candidates[0].supplied||!candidates[0].formMatches?'original_baseline_conflict':'compound_target_plan_unconfirmed';
    report[key]={status:'unresolved',mutation:'unsupported',baseline:baseline[key],sources:map||key==='insuranceNumber'?['client_cost_carrier_assignments.'+column]:[],candidates,reason};
  }
  return freezeClientNativeOriginal({requested:true,assignments:original.pools.assignments.length?'delivered' as const:'empty' as const,fields:report,membership:original.pools.assignments.map(row=>({assignmentId:String(row.id),carrierType:String(row.carrier_type),archivedAt:row.archived_at,primary:row.is_primary})),compound});
}
