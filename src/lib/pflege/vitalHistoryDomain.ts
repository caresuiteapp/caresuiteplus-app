import {compareMedicationHistory,medicationHistoryCursor} from './medicationHistoryPagination.ts';

export type VitalInvalidationPayload={measurementId:string;reason:string};
export type VitalInvalidation={id:string;measurementId:string;reason:string;recordedAt:string;recordedByName:string};
type Row=Record<string,unknown>;
const uuid=(v:unknown):v is string=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
export function validateVitalInvalidation(payload:unknown):string|null{
  if(!payload||typeof payload!=='object'||Array.isArray(payload))return 'Ungültiger Korrekturvermerk.';
  const p=payload as Row;
  if(Object.keys(p).some(k=>!['measurementId','reason'].includes(k))||!uuid(p.measurementId))return 'Messungsbezug ist ungültig.';
  if(typeof p.reason!=='string'||!p.reason.trim()||p.reason.length>2000)return 'Tatsächlichen Korrekturgrund angeben (höchstens 2.000 Zeichen).';
  return null;
}
/** Reject incomplete scope and contradictory records instead of hiding them. */
export function vitalInvalidationIndex(rows:Row[],tenantId:string,clientId:string):Map<string,VitalInvalidation>{
  const result=new Map<string,VitalInvalidation>();
  for(const row of rows){
    if(row.tenant_id!==tenantId||row.client_id!==clientId||!uuid(row.id)||!uuid(row.measurement_id)||typeof row.reason!=='string'||!row.reason.trim()||row.reason.length>2000||typeof row.recorded_by_name!=='string'||!row.recorded_by_name.trim())throw Error('Korrekturverlauf ist unvollständig oder einer anderen Akte zugeordnet.');
    medicationHistoryCursor(row);
    if(result.has(row.measurement_id))throw Error('Widersprüchliche Korrekturvermerke. Verlauf erneut laden.');
    result.set(row.measurement_id,{id:row.id,measurementId:row.measurement_id,reason:row.reason,recordedAt:String(row.created_at),recordedByName:row.recorded_by_name});
  }
  return result;
}
export type VitalHistoryEntry={id:string;type:string;occurredAt:string|null;recordedAt:string;invalidation:VitalInvalidation|null};
/** Known actual times first. Historical capture times remain a separate group. */
export function orderVitalHistory<T extends VitalHistoryEntry>(entries:T[]):T[]{
  const seen=new Set<string>();
  for(const e of entries){
    if(seen.has(e.id.toLowerCase()))throw Error('Doppelte Messung im Verlauf.');seen.add(e.id.toLowerCase());
    medicationHistoryCursor({id:e.id,created_at:e.recordedAt});
    if(e.occurredAt!==null)medicationHistoryCursor({id:e.id,created_at:e.occurredAt});
    if(e.invalidation&&e.invalidation.measurementId!==e.id)throw Error('Korrekturvermerk gehört zu einer anderen Messung.');
  }
  return [...entries].sort((a,b)=>{
    if(a.occurredAt===null&&b.occurredAt!==null)return 1;
    if(a.occurredAt!==null&&b.occurredAt===null)return -1;
    return -compareMedicationHistory(medicationHistoryCursor({id:a.id,created_at:a.occurredAt??a.recordedAt}),medicationHistoryCursor({id:b.id,created_at:b.occurredAt??b.recordedAt}));
  });
}
/** A technical series only; invalid/undated readings never enter a trend. */
export function vitalSeries<T extends VitalHistoryEntry & {unit:string;values:Row}>(entries:T[],type:string,component:string,unit:string){
  return orderVitalHistory(entries).filter(e=>e.type===type&&e.unit===unit&&e.occurredAt!==null&&e.invalidation===null&&typeof e.values[component]==='number'&&Number.isFinite(e.values[component])).reverse().map(e=>({id:e.id,occurredAt:e.occurredAt!,value:e.values[component] as number}));
}

/** UTF-8 CSV retains originals and corrections; spreadsheet formula input is escaped. */
export function vitalHistoryCsv(entries:(VitalHistoryEntry & {clientId:string;clientName:string;unit:string;value:string;values:Row;context:Row;note:string;recordedByName:string;flagStatus:string})[]):string{
  const cell=(v:unknown)=>{
    const raw=String(v??'');
    const protectedValue=/^[\s\uFEFF]*[=+\-@]/u.test(raw)||/^[\t\r\n]/.test(raw)?"'"+raw:raw;
    return '"'+protectedValue.replaceAll('"','""')+'"';
  };
  const rows:unknown[][]=[['Messungs-ID','Klienten-ID','Klient:in','Messart','Originalwert','Einheit','Einzelwerte (JSON)','Messkontext (JSON)','Messzeit (ISO, leer = nicht bestätigt)','Erfasst (ISO)','Dokumentierende Person','Gespeicherter Grenzvergleich','Status','Korrekturgrund','Korrektur erfasst (ISO)','Korrektur dokumentierende Person','Originalnotiz']];
  for(const e of orderVitalHistory(entries))rows.push([e.id,e.clientId,e.clientName,e.type,e.value,e.unit,JSON.stringify(e.values),JSON.stringify(e.context),e.occurredAt??'',e.recordedAt,e.recordedByName,e.flagStatus,e.invalidation?'ungültig gekennzeichnet':'kein Ungültigkeitsvermerk geladen',e.invalidation?.reason??'',e.invalidation?.recordedAt??'',e.invalidation?.recordedByName??'',e.note]);
  return '\uFEFF'+rows.map(row=>row.map(cell).join(';')).join('\r\n')+'\r\n';
}
