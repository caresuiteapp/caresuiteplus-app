import type {MedicationSafetyEntry} from './medicationSafetyPacket.web';
import {assertMedicationSourceArchive} from './medicationSourceFile.ts';
import {sameWoundJson,woundInstant,woundUuid} from './woundCareDomain.ts';

export type MedicationOrderRevisionOrder=MedicationSafetyEntry['order'];
export type MedicationOrderRevisionScope={tenantId:string;clientId:string;medicationId:string};
export type MedicationOrderRevisionPacket=MedicationOrderRevisionScope&{schemaVersion:1;requestId:string;actorId:string;expectedUpdatedAt:string;sourceId:string;reason:string;order:MedicationOrderRevisionOrder};
export type MedicationOrderRevisionApplication=Record<string,unknown>&{id:string;revision_id:string;tenant_id:string;client_id:string;medication_id:string;source_id:string;request_id:string;recorded_by:string;recorded_at:string;before_snapshot:Record<string,unknown>;after_snapshot:Record<string,unknown>;reason:string;authorization_id:string};
export type MedicationOrderRevision=Record<string,unknown>&{id:string;tenant_id:string;client_id:string;medication_id:string;source_id:string;request_id:string;recorded_by:string;recorded_by_name:string;recorded_at:string;expected_updated_at:string;before_snapshot:Record<string,unknown>;proposed_order:MedicationOrderRevisionOrder;reason:string;source_snapshot:Record<string,unknown>;archive_snapshot:Record<string,unknown>;state:'proposed'|'transcribed';application:MedicationOrderRevisionApplication|null};
export type MedicationOrderRevisionSource={source:Record<string,unknown>;archive:Record<string,unknown>};
export type MedicationOrderRevisionCursor={at:string;id:string};
export const medicationOrderRevisionFieldMap={medicationName:'name',activeIngredient:'active_ingredient',strength:'strength',form:'form',dose:'prescribed_dose',unit:'dose_unit',route:'route',prescriber:'prescribed_by',validFrom:'start_date',validUntil:'end_date',indication:'indication',isPrn:'is_prn',minimumIntervalMinutes:'minimum_interval_minutes',maximumDose:'maximum_dose',maximumDoseUnit:'maximum_dose_unit',maximumPeriodHours:'maximum_period_hours'} as const;
const fields=Object.keys(medicationOrderRevisionFieldMap) as Array<keyof MedicationOrderRevisionOrder>;
const object=(v:unknown):Record<string,unknown>|null=>!!v&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:null;
const exact=(v:Record<string,unknown>,keys:readonly string[])=>Object.keys(v).length===keys.length&&keys.every(key=>Object.hasOwn(v,key));
const text=(v:unknown,min=1,max=8000):v is string=>typeof v==='string'&&v.trim().length>=min&&v.length<=max;
const date=(v:unknown):v is string=>typeof v==='string'&&/^[1-9]\d{3}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v+'T12:00:00Z'))&&new Date(v+'T12:00:00Z').toISOString().slice(0,10)===v;
export const medicationOrderRevisionInstant=(v:unknown)=>typeof v==='string'?woundInstant(v.replace(' ','T')):null;
const sameInstant=(a:unknown,b:unknown)=>medicationOrderRevisionInstant(a)!==null&&medicationOrderRevisionInstant(a)===medicationOrderRevisionInstant(b);
const positive=(v:unknown):v is string=>typeof v==='string'&&/^(0|[1-9][0-9]{0,7})(\.[0-9]{1,3})?$/.test(v)&&BigInt(v.replace('.',''))>0n;

/** A raw editor projection. Unknown boolean/date/dose facts remain unselected or blank. */
export function nativeMedicationOrderRevisionDraft(native:Record<string,unknown>):Record<keyof MedicationOrderRevisionOrder,string>{
 const draft={} as Record<keyof MedicationOrderRevisionOrder,string>;
 for(const key of fields){const raw=native[medicationOrderRevisionFieldMap[key]];draft[key]=key==='isPrn'?(raw===true?'true':raw===false?'false':''):typeof raw==='string'?raw:'';}
 return draft;
}
export function medicationOrderRevisionOrderIssue(value:unknown):string|null{
 const o=object(value);if(!o||!exact(o,fields))return 'Alle 16 strukturierten Verordnungsangaben sind ausdrücklich erforderlich.';
 if(['medicationName','activeIngredient','strength','form','unit','route','prescriber','indication'].some(key=>!text(o[key]))||!positive(o.dose)||!date(o.validFrom)||o.validUntil!==null&&(!date(o.validUntil)||String(o.validUntil)<String(o.validFrom)))return 'Präparat, Wirkstoff, Stärke, Form, positive Dosis, Einheit, Weg, verordnende Person, Indikation und Gültigkeit vollständig prüfen.';
 if(typeof o.isPrn!=='boolean')return 'Regel- oder Bedarfsverordnung ausdrücklich auswählen.';
 if(o.isPrn){if(!positive(o.minimumIntervalMinutes)||!positive(o.maximumDose)||!positive(o.maximumPeriodHours)||o.maximumDoseUnit!==o.unit)return 'Bedarfsverordnung benötigt positive ärztliche Abstände und Höchstmengen in derselben Dosiseinheit.';}
 else if(o.minimumIntervalMinutes!==null||o.maximumDose!==null||o.maximumPeriodHours!==null||o.maximumDoseUnit!=='')return 'Bei Regelverordnungen müssen Bedarfsgrenzen ausdrücklich leer bleiben.';
 return null;
}
export function medicationOrderRevisionPacketIssue(value:unknown):string|null{
 const p=object(value);if(!p||!exact(p,['schemaVersion','requestId','tenantId','clientId','medicationId','actorId','expectedUpdatedAt','sourceId','reason','order'])||p.schemaVersion!==1||![p.requestId,p.tenantId,p.clientId,p.medicationId,p.actorId,p.sourceId].every(woundUuid)||medicationOrderRevisionInstant(p.expectedUpdatedAt)===null||!text(p.reason,10,2000))return 'Eigene Zuordnung, ursprünglicher Verordnungsstand, archivierte Quelle und Begründung ab zehn Zeichen sind erforderlich.';
 return medicationOrderRevisionOrderIssue(p.order);
}
function freeze<T>(v:T):T{if(v&&typeof v==='object'){Object.freeze(v);Object.values(v).forEach(freeze);}return v;}
export function makeMedicationOrderRevisionPacket(input:Omit<MedicationOrderRevisionPacket,'schemaVersion'>):MedicationOrderRevisionPacket{const p=structuredClone({...input,schemaVersion:1 as const});const issue=medicationOrderRevisionPacketIssue(p);if(issue)throw Error(issue);return freeze(p);}
export function assertMedicationOrderRevisionSource(value:unknown,scope:MedicationOrderRevisionScope):MedicationOrderRevisionSource{
 if(![scope.tenantId,scope.clientId,scope.medicationId].every(woundUuid))throw Error('Eigene Verordnungszuordnung fehlt.');
 const pair=object(value),source=object(pair?.source),archive=object(pair?.archive),doc=object(source?.document_snapshot),order=object(source?.order_snapshot),payload=object(source?.payload);
 if(!source||!archive||!doc||!order||!payload||![source.id,source.request_id,source.recorded_by].every(woundUuid)||!text(source.recorded_by_name)||medicationOrderRevisionInstant(source.created_at)===null||!text(source.reason)||!sameInstant(payload.expectedUpdatedAt,order.updated_at)||payload.documentId!==doc.id||!sameInstant(payload.documentUpdatedAt,doc.updated_at)||payload.contentSha256!==doc.content_sha256||payload.contentSize!==doc.content_size||!text(payload.reason)||source.reason!==String(payload.reason).trim()||!woundUuid(source.id)||source.tenant_id!==scope.tenantId||source.client_id!==scope.clientId||source.medication_id!==scope.medicationId||source.document_id!==doc.id||order.id!==scope.medicationId||order.tenant_id!==scope.tenantId||order.client_id!==scope.clientId||medicationOrderRevisionInstant(order.updated_at)===null)throw Error('Archivierte Quelle gehört nicht vollständig zur eigenen Verordnung.');
 assertMedicationSourceArchive({tenantId:scope.tenantId,clientId:scope.clientId,medicationId:scope.medicationId,linkId:source.id},archive,doc);
 return structuredClone({source,archive});
}
function assertNativeScope(value:unknown,scope:MedicationOrderRevisionScope):Record<string,unknown>{const native=object(value);if(!native||native.id!==scope.medicationId||native.tenant_id!==scope.tenantId||native.client_id!==scope.clientId||medicationOrderRevisionInstant(native.updated_at)===null)throw Error('Unveränderter nativer Verordnungsstand fehlt.');return native;}
export function assertMedicationOrderRevision(value:unknown,scope:MedicationOrderRevisionScope,own?:MedicationOrderRevisionPacket):MedicationOrderRevision{
 const r=object(value);if(![scope.tenantId,scope.clientId,scope.medicationId].every(woundUuid)||!r||![r.id,r.request_id,r.recorded_by,r.source_id].every(woundUuid)||r.tenant_id!==scope.tenantId||r.client_id!==scope.clientId||r.medication_id!==scope.medicationId||!text(r.recorded_by_name)||medicationOrderRevisionInstant(r.recorded_at)===null||medicationOrderRevisionInstant(r.expected_updated_at)===null||!text(r.reason,10,2000)||medicationOrderRevisionOrderIssue(r.proposed_order))throw Error('Vollständiger ursprünglicher Verordnungsentwurf fehlt.');
 const before=assertNativeScope(r.before_snapshot,scope);if(!sameInstant(before.updated_at,r.expected_updated_at))throw Error('Nativer Ausgangsstand und Entwurfsversion widersprechen sich.');
 const pair=assertMedicationOrderRevisionSource({source:r.source_snapshot,archive:r.archive_snapshot},scope);if(pair.source.id!==r.source_id)throw Error('Die archivierte Entwurfsquelle wurde ausgetauscht.');
 if(own&&(medicationOrderRevisionPacketIssue(own)||r.request_id!==own.requestId||r.recorded_by!==own.actorId||r.source_id!==own.sourceId||r.reason!==own.reason.trim()||!sameInstant(r.expected_updated_at,own.expectedUpdatedAt)||!sameWoundJson(r.proposed_order,own.order)))throw Error('Gespeicherter Entwurf bestätigt den eigenen ursprünglichen Auftrag nicht.');
 if(r.state==='proposed'){if(r.application!==null)throw Error('Entwurfsstatus widerspricht einer übernommenen Fassung.');}
 else if(r.state==='transcribed'){
  const a=object(r.application);if(!a||![a.id,a.request_id,a.recorded_by,a.authorization_id].every(woundUuid)||a.revision_id!==r.id||a.recorded_by!==r.recorded_by||a.tenant_id!==scope.tenantId||a.client_id!==scope.clientId||a.medication_id!==scope.medicationId||a.source_id!==r.source_id||medicationOrderRevisionInstant(a.recorded_at)===null||!text(a.reason,10,2000))throw Error('Technischer Übernahmebeleg fehlt oder widerspricht dem Entwurf.');
  const appliedBefore=assertNativeScope(a.before_snapshot,scope),after=assertNativeScope(a.after_snapshot,scope);if(!sameWoundJson(appliedBefore,before))throw Error('Technische Übernahme gehört nicht zum vollständigen nativen Ausgangsstand.');
  const candidate=r.proposed_order as MedicationOrderRevisionOrder;
  for(const key of fields){const actual=after[medicationOrderRevisionFieldMap[key]];if(key==='maximumDoseUnit'&&!candidate.isPrn&&(actual===null||actual===''))continue;if(actual!==candidate[key])throw Error('Technischer Nachstand entspricht nicht dem vollständigen strukturierten Entwurf.');}
  if(after.dosage!==candidate.dose+' '+candidate.unit||medicationOrderRevisionInstant(after.updated_at)!<medicationOrderRevisionInstant(before.updated_at)!)throw Error('Technischer Dosierungstext oder zeitliche Fortschreibung widerspricht dem Entwurf.');
  const unchanged=(native:Record<string,unknown>)=>Object.fromEntries(Object.entries(native).filter(([key])=>![...Object.values(medicationOrderRevisionFieldMap),'dosage','updated_at','updated_by'].includes(key)));
  if(!sameWoundJson(unchanged(before),unchanged(after)))throw Error('Die technische Übernahme hat weitere native Tatsachen verändert.');
 }else throw Error('Unbekannter Entwurfsstatus.');
 return structuredClone(r) as MedicationOrderRevision;
}
export function medicationOrderRevisionCursor(value:unknown):MedicationOrderRevisionCursor{const c=object(value);if(!c||!exact(c,['at','id'])||!woundUuid(c.id)||medicationOrderRevisionInstant(c.at)===null)throw Error('Verlaufscursor ungültig.');return {at:c.at as string,id:c.id};}
export function compareMedicationOrderRevisionCursors(a:MedicationOrderRevisionCursor,b:MedicationOrderRevisionCursor){const at=medicationOrderRevisionInstant(a.at)!,bt=medicationOrderRevisionInstant(b.at)!;return at===bt?a.id.toLowerCase()===b.id.toLowerCase()?0:a.id.toLowerCase()<b.id.toLowerCase()?-1:1:at<bt?-1:1;}
export function assertMedicationOrderRevisionContext(value:unknown,scope:MedicationOrderRevisionScope):{order:Record<string,unknown>;sources:MedicationOrderRevisionSource[]}{const c=object(value);if(!c||!exact(c,['order','sources'])||!Array.isArray(c.sources))throw Error('Vollständiger Verordnungsarbeitsbereich fehlt.');const order=assertNativeScope(c.order,scope),sources=c.sources.map(s=>assertMedicationOrderRevisionSource(s,scope));if(new Set(sources.map(s=>s.source.id)).size!==sources.length)throw Error('Archivierte Quellen sind doppelt enthalten.');return structuredClone({order,sources});}
