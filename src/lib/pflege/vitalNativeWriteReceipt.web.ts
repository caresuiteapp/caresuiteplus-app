import {cloneClientNativeOriginal,sameClientNativeOriginal} from '../clients/clientRecordNativeOriginal.web.ts';
import {getVitalDefinition} from './vitalCatalog.ts';
import {assessVitalLimits,validateVitalMeasurement,type VitalMeasurementPayload,type VitalFollowUpPayload} from './vitalMeasurementDomain.ts';
import type {VitalInvalidationPayload} from './vitalHistoryDomain.ts';
import {woundInstant,woundUuid} from './woundCareDomain.ts';

type Row=Record<string,unknown>;
export type VitalNativeReceiptScopeWeb={tenantId:string;actorId:string;clientId:string;measurementId?:string;measurement?:Readonly<Row>};
const object=(value:unknown):Row|null=>!!value&&typeof value==='object'&&!Array.isArray(value)?value as Row:null;
const instant=(value:unknown)=>typeof value==='string'?woundInstant(value.replace(' ','T')):null;
const trim=(value:string)=>value.replace(/^ +| +$/g,'');
const text=(value:unknown):value is string=>typeof value==='string'&&!!value.trim();
function base(value:unknown,scope:VitalNativeReceiptScopeWeb,nativeId:string,requestId:string,payload:unknown,measurement:boolean):Row{
 const row=object(cloneClientNativeOriginal(value));if(!row||![nativeId,requestId,scope.tenantId,scope.clientId,scope.actorId].every(woundUuid)||row.id!==nativeId||row.tenant_id!==scope.tenantId||row.client_id!==scope.clientId||row.recorded_by!==scope.actorId||row[measurement?'creation_request_id':'request_id']!==requestId||!sameClientNativeOriginal(row.creation_payload,payload)||instant(row.created_at)===null||!text(row.recorded_by_name))throw Error('Vollständiges eigenes unverändertes Vitaloriginal fehlt.');
 return row;
}
function approvedLimits(configuration:Row,at:bigint,values:Row){
 if(configuration.active!==true||!['physician_order','care_plan','individual_configuration'].includes(String(configuration.source_kind))||!woundUuid(configuration.approved_by)||instant(configuration.valid_from)===null||instant(configuration.valid_from)!>at||configuration.valid_to!==null&&(instant(configuration.valid_to)===null||instant(configuration.valid_to)!<at))return {};
 const limits=object(configuration.limits);if(!limits)return {};
 for(const key of Object.keys(values)){const value=limits[key];if(value===undefined)continue;const bound=object(value);if(!bound||Object.keys(bound).some(key=>!['min','max'].includes(key))||Object.values(bound).some(v=>typeof v!=='number'||!Number.isFinite(v)||Math.abs(v)>1_000_000_000))return {};}
 return limits;
}
function displayMatches(row:Row,values:Row){
 if(typeof row.display_value!=='string')return false;const numeric=(s:string,v:unknown)=>/^[+-]?\d+(?:\.\d+)?$/.test(s)&&typeof v==='number'&&Number(s)===v;
 if(['blood_pressure','arterial_pressure'].includes(String(row.vital_key))){const parts=row.display_value.split('/');return parts.length===2&&numeric(parts[0],values.systolic)&&numeric(parts[1],values.diastolic);}
 if(row.vital_key==='gcs'){const parts=/^GCS ([^ ]+) \(E([^ ]+) V([^ ]+) M([^ ]+)\)$/.exec(row.display_value);return !!parts&&numeric(parts[1],values.total)&&numeric(parts[2],values.eyes)&&numeric(parts[3],values.verbal)&&numeric(parts[4],values.motor);}
 if(row.vital_key==='pupils'){const parts=/^L ([^ ]+) \/ R ([^ ]+)$/.exec(row.display_value);return !!parts&&numeric(parts[1],values.leftSize)&&numeric(parts[2],values.rightSize);}
 return numeric(row.display_value,row.vital_key==='fluid_balance'?values.balance:values.value);
}
export function assertVitalMeasurementWriteReceiptWeb(value:unknown,scope:VitalNativeReceiptScopeWeb,nativeId:string,requestId:string,payload:VitalMeasurementPayload):Readonly<Row>{
 const row=base(value,scope,nativeId,requestId,payload,true),catalog=object(row.catalog_snapshot),definition=getVitalDefinition(payload.type),occurred=instant(payload.occurredAt),created=instant(row.created_at)!;
 if(payload.clientId!==scope.clientId||!catalog||!definition||row.vital_key!==payload.type||row.source!=='manual'||instant(row.occurred_at)!==occurred||occurred===null||occurred>created||validateVitalMeasurement(payload,definition,Number(created/1000n))||row.note!==(trim(payload.note)||null)||catalog.key!==payload.type||catalog.category!==definition.category||catalog.is_active!==true||typeof catalog.default_enabled!=='boolean'||instant(catalog.updated_at)!==instant(payload.catalogVersion)||instant(payload.catalogVersion)===null||!sameClientNativeOriginal(catalog.components,definition.components.map(c=>c.key)))throw Error('Das bestätigte Messoriginal widerspricht Messzeit, Katalog oder eigenem Auftrag.');
 const units=new Set(definition.components.map(c=>c.unit)),unit=payload.type==='gcs'?definition.components.find(c=>c.key==='total')?.unit:units.size===1?definition.components[0].unit:null;
 if(unit===null||catalog.default_unit!==unit||row.unit!==unit)throw Error('Die gespeicherte Einheit gehört nicht zur vollständigen ausdrücklichen Messart.');
 const values=JSON.parse(payload.valuesJson) as Row,context=JSON.parse(payload.contextJson);if(!sameClientNativeOriginal(row.values,values)||!sameClientNativeOriginal(row.context,context)||!displayMatches(row,values))throw Error('Die bestätigten tatsächlichen Messwerte oder die Messsituation wurden verändert.');
 const configuration=object(row.configuration_snapshot);let limits:unknown={};
 if(payload.configurationVersion==='none'){if(!sameClientNativeOriginal(configuration,{enabled:catalog.default_enabled,limits:{},version:'none'})||catalog.default_enabled!==true)throw Error('Ein nicht vorhandener individueller Konfigurationsstand wurde erfunden.');}
 else{if(!configuration||!woundUuid(configuration.id)||configuration.tenant_id!==scope.tenantId||configuration.client_id!==scope.clientId||configuration.vital_key!==payload.type||configuration.enabled!==true||instant(configuration.updated_at)!==instant(payload.configurationVersion)||instant(payload.configurationVersion)===null||!object(configuration.limits)||!object(configuration.schedule)||!['source_kind','approved_by','valid_from','valid_to','active','revision'].every(key=>Object.hasOwn(configuration,key))||!Number.isSafeInteger(configuration.revision)||Number(configuration.revision)<1)throw Error('Der eigene ursprüngliche individuelle Konfigurationsstand fehlt.');limits=approvedLimits(configuration,occurred,values);}
 if(row.flag_status!==assessVitalLimits(values as Record<string,number>,limits))throw Error('Die gespeicherte Grenzbewertung ist nicht durch die tatsächlichen Werte und ausdrückliche Konfiguration belegt.');
 return structuredClone(row);
}
export function assertVitalDetailWriteReceiptWeb(value:unknown,scope:VitalNativeReceiptScopeWeb,nativeId:string,requestId:string,kind:'follow_up'|'invalidation',payload:VitalFollowUpPayload|VitalInvalidationPayload):Readonly<Row>{
 const row=base(value,scope,nativeId,requestId,payload,false);if(!woundUuid(scope.measurementId)||payload.measurementId!==scope.measurementId||row.measurement_id!==scope.measurementId)throw Error('Der eigene ursprüngliche Messungsbezug wurde ausgetauscht.');
 if(kind==='invalidation'){if(row.reason!==trim((payload as VitalInvalidationPayload).reason))throw Error('Der tatsächliche Ungültigkeitsgrund wurde verändert.');}
 else{const p=payload as VitalFollowUpPayload,observed=instant(p.observedAt),original=instant(scope.measurement?.occurred_at);if(observed===null||original===null||observed<original||observed>instant(row.created_at)!||instant(row.observed_at)!==observed||row.observation!==trim(p.observation)||row.action!==trim(p.action)||row.responsible_person!==trim(p.responsiblePerson)||row.outcome!==p.outcome||(p.outcome==='resolved'?row.next_review_at!==null||p.nextReviewAt!=='':p.outcome!=='ongoing'||instant(p.nextReviewAt)===null||instant(p.nextReviewAt)!<=observed||instant(row.next_review_at)!==instant(p.nextReviewAt)))throw Error('Die tatsächliche eigene Folgekontrolle wurde nicht vollständig und unverändert bestätigt.');}
 return structuredClone(row);
}
