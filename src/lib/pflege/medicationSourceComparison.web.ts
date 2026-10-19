import { woundInstant, woundUuid } from './woundCareDomain.ts';
import { sameMedicationListOriginal } from './medicationListOriginal.web.ts';

type Row = Record<string, unknown>;
export type MedicationComparisonScope = { tenantId: string; clientId: string; medicationId: string };
export type MedicationComparisonOriginals = { currentOrder: Row; sources: Row[] };
export const medicationComparisonFields = [
  ['name','Präparat'],['active_ingredient','Wirkstoff'],['strength','Stärke'],['form','Form'],
  ['dosage','Dosierung'],['route','Applikationsweg'],['schedule','Gabeplan'],
  ['morning_dose','Morgens'],['noon_dose','Mittags'],['evening_dose','Abends'],['night_dose','Nachts'],
  ['is_prn','Bedarfsmedikation'],['prn_reason','Bedarfsindikation'],['prescribed_by','Verordnende Person'],
  ['start_date','Verordnungsbeginn'],['end_date','Verordnungsende'],['indication','Indikation'],
  ['notes','Hinweise'],['interaction_notes','Wechselwirkungshinweise'],['side_effect_notes','Nebenwirkungs-/Überwachungshinweise'],['storage_notes','Lagerungshinweise'],['is_high_alert','Hochrisiko'],
  ['is_controlled_substance','BtM'],['intensive_care_relevant','Intensivpflege'],
  ['pump_required','Pumpengabe'],['infusion_rate','Infusionsrate'],['dilution','Verdünnung'],['status','Gespeicherter Status'],
] as const;
const flags = new Set(['is_prn','is_high_alert','is_controlled_substance','intensive_care_relevant','pump_required']);
const object=(v:unknown):v is Row=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.getPrototypeOf(v)===Object.prototype;
const nativeInstant=(v:unknown)=>typeof v==='string'?woundInstant(v.replace(' ','T')):null;
const instant=(v:unknown)=>nativeInstant(v)!==null;
function json(value: unknown, seen=new Set<object>()): boolean {
 if(value===null||typeof value==='string'||typeof value==='boolean')return true;
 if(typeof value==='number')return Number.isFinite(value);
 if(typeof value!=='object'||!value||seen.has(value))return false;
 seen.add(value);
 const valid=Array.isArray(value)?Object.keys(value).length===value.length&&Array.from({length:value.length},(_,i)=>Object.hasOwn(value,i)&&json(value[i],seen)).every(Boolean):object(value)&&Object.values(value).every(v=>json(v,seen));
 seen.delete(value);return valid;
}
function order(value:unknown,scope:MedicationComparisonScope):asserts value is Row {
 if(!object(value)||!json(value)||value.id!==scope.medicationId||value.tenant_id!==scope.tenantId||value.client_id!==scope.clientId||!instant(value.updated_at))throw Error('Der vollständige native Verordnungsstand gehört nicht eindeutig zu dieser Akte.');
 for(const [key]of medicationComparisonFields){if(!Object.hasOwn(value,key))continue;const v=value[key];if(flags.has(key)?typeof v!=='boolean':!(v===null||typeof v==='string'))throw Error('Ein gespeicherter Verordnungsinhalt ist strukturell ungültig.');}
 if(Object.hasOwn(value,'created_at')&&!instant(value.created_at))throw Error('Die originale Verordnungserfassungszeit ist ungültig.');
 for(const key of ['created_by','updated_by'])if(Object.hasOwn(value,key)&&value[key]!==null&&!woundUuid(value[key]))throw Error('Die originale Verordnungsautorenkennung ist ungültig.');
}
/** All supplied originals are checked before native source selection. No clinical approval or completeness is inferred. */
export function captureMedicationComparisonOriginals(currentOrder:unknown,sources:unknown,scope:MedicationComparisonScope):MedicationComparisonOriginals {
 if(![scope.tenantId,scope.clientId,scope.medicationId].every(woundUuid)||!Array.isArray(sources))throw Error('Der vollständige Quellenbestand ist nicht bestätigt.');
 order(currentOrder,scope);const ids=new Set<string>(),requests=new Set<string>();
 for(let i=0;i<sources.length;i++){
  const s=sources[i];if(!object(s)||!json(s)||!woundUuid(s.id)||ids.has(s.id.toLowerCase())||s.tenant_id!==scope.tenantId||s.client_id!==scope.clientId||s.medication_id!==scope.medicationId||!woundUuid(s.document_id)||!woundUuid(s.request_id)||requests.has(s.request_id.toLowerCase())||!woundUuid(s.recorded_by)||typeof s.recorded_by_name!=='string'||typeof s.reason!=='string'||!instant(s.created_at)||!object(s.payload)||!object(s.document_snapshot))throw Error('Der ganze originale Quellenbestand enthält fremde, beschädigte oder doppelte native Angaben.');
  const d=s.document_snapshot;
  if(d.id!==s.document_id||!instant(d.updated_at)||['title','file_name','mime_type'].some(key=>typeof d[key]!=='string')||!(d.storage_path===null||typeof d.storage_path==='string'))throw Error('Der originale Dokumentenbeleg ist nicht eindeutig.');
  order(s.order_snapshot,scope);
  const p=s.payload;if(p.documentId!==s.document_id||!instant(p.documentUpdatedAt)||!instant(p.expectedUpdatedAt)||nativeInstant(p.documentUpdatedAt)!==nativeInstant(d.updated_at)||nativeInstant(p.expectedUpdatedAt)!==nativeInstant(s.order_snapshot.updated_at))throw Error('Originalanfrage und gespeicherte native Quellenfassungen widersprechen sich.');
  ids.add(s.id.toLowerCase());requests.add(s.request_id.toLowerCase());
 }
 return structuredClone({currentOrder,sources}) as MedicationComparisonOriginals;
}
export function compareMedicationSourceOriginal(originals:MedicationComparisonOriginals,sourceId:string,scope:MedicationComparisonScope){
 const full=captureMedicationComparisonOriginals(originals.currentOrder,originals.sources,scope);
 if(!woundUuid(sourceId))throw Error('Eine native Quellenzuordnung ausdrücklich auswählen.');
 const selected=full.sources.find(s=>s.id===sourceId);if(!selected)throw Error('Diese Quellenzuordnung ist nicht im aktuellen vollständigen Lesebestand enthalten.');
 const historical=selected.order_snapshot as Row;
 const fields=medicationComparisonFields.map(([key,label])=>{
  const present=Object.hasOwn(full.currentOrder,key)&&Object.hasOwn(historical,key);
  const current=full.currentOrder[key],previous=historical[key],same=sameMedicationListOriginal(current,previous);
  const confirmedValue=current!==null&&!(typeof current==='string'&&!current.trim());
  return {key,label,current,historical:previous,state:!present?'unknown':!same?'different':confirmedValue?'same':'unknown'};
 });
 return {currentOrder:full.currentOrder,selected,fields,changedFields:fields.filter(f=>f.state==='different').map(f=>f.key),unknownFields:fields.filter(f=>f.state==='unknown').map(f=>f.key),sameRawVersion:full.currentOrder.updated_at===historical.updated_at,wholeOrderSame:sameMedicationListOriginal(full.currentOrder,historical),clinicalReconciliation:'not_documented' as const,historicalAllergyVersion:'unknown' as const};
}
