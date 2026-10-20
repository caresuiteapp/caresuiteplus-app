import {respiratoryCareOriginalIssue,respiratoryCareSourcesIssue,type RespiratoryCareKind,type RespiratoryCareOriginal,type RespiratoryCareSources} from './respiratoryIntensiveCarePath.web';

export type RespiratoryCareReviewQualification=Readonly<{
 id:string;employeeId:string;profileId:string;qualificationType:string;title:string;status:'valid'|'expires_soon';issuedAt:string|null;validUntil:string|null;verifiedAt:string;updatedAt:string;
 documentId:string;documentFingerprint:string;sourceFingerprint:string;employmentStart:string;employmentEnd:string|null;employeeFingerprint:string;
 scopeId:string;scopeKind:'respiratory_care_review';scopeFingerprint:string;
}>;
export type RespiratoryCareReviewEvent=Readonly<{
 id:string;revision:number;previousId:string|null;requestId:string;action:'request'|'return'|'accept';recordedAt:string;actorId:string;actorName:string;
 reason:string;requiredChange:string;rationale:string;careHeadId:string;careFingerprint:string;qualification:RespiratoryCareReviewQualification|null;fingerprint:string;
}>;
export type RespiratoryCareReviewOriginal=Readonly<{
 id:string;tenantId:string;clientId:string;measurementId:string;rootId:string;headId:string;revision:number;careRootId:string;careHeadId:string;
 careFingerprint:string;careKind:RespiratoryCareKind;status:'requested'|'returned'|'accepted';history:readonly RespiratoryCareReviewEvent[];
}>;
export type RespiratoryCareReviewPacket=Readonly<{
 schemaVersion:'1';action:'request'|'return'|'accept';requestId:string;tenantId:string;clientId:string;measurementId:string;actorId:string;
 expectedHeadId:string|null;expectedRevision:number;careOriginal:RespiratoryCareOriginal;sources:RespiratoryCareSources;reviewOriginal:RespiratoryCareReviewOriginal|null;
 reason:string;requiredChange:string;rationale:string;
}>;

const reviewableKinds=new Set<RespiratoryCareKind>(['intensive_handover','correction']);
const uuid=(v:unknown):v is string=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
const sha=(v:unknown):v is string=>typeof v==='string'&&/^sha256:[0-9a-f]{64}$/.test(v);
const text=(v:unknown,min=0,max=8000):v is string=>typeof v==='string'&&v.trim().length>=min&&v.length<=max;
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v)&&[Object.prototype,null].includes(Object.getPrototypeOf(v));
const clone=<T>(v:T):T=>structuredClone(v);
const deepFreeze=<T>(v:T):T=>{if(v&&typeof v==='object'&&!Object.isFrozen(v)){Object.freeze(v);for(const child of Object.values(v as Record<string,unknown>))deepFreeze(child);}return v;};
export const respiratoryCareReviewStable=(v:unknown):string=>JSON.stringify(v,(_key,item:unknown)=>object(item)?Object.fromEntries(Object.keys(item).sort().map(key=>[key,item[key]])):item);
export function respiratoryCareReviewInstantMicros(v:unknown):bigint|null{
 if(typeof v!=='string')return null;const m=/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,6}))?(Z|[+-]\d{2}:?\d{2})$/.exec(v);
 if(!m||Number(m[1])<1000||Number(m[4])>23||Number(m[5])>59||Number(m[6])>59)return null;const day=`${m[1]}-${m[2]}-${m[3]}`,parsed=Date.parse(`${day}T00:00:00Z`);
 if(!Number.isFinite(parsed)||new Date(parsed).toISOString().slice(0,10)!==day)return null;if(m[8]!=='Z'){const zone=m[8].replace(':','');if(Number(zone.slice(1,3))>14||Number(zone.slice(3))>59||Number(zone.slice(1,3))===14&&Number(zone.slice(3))!==0)return null;}
 const whole=Date.parse(`${day}T${m[4]}:${m[5]}:${m[6]}${m[8]}`);return Number.isFinite(whole)?BigInt(whole)*1000n+BigInt((m[7]??'').padEnd(6,'0')):null;
}
const calendarDate=(v:unknown):v is string=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&respiratoryCareReviewInstantMicros(`${v}T00:00:00Z`)!==null;
const berlinDay=(at:string)=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Berlin',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(at));
function qualificationIssue(q:RespiratoryCareReviewQualification|null,actor:string,at:string):string|null{
 if(!q||![q.id,q.employeeId,q.profileId,q.documentId,q.scopeId].every(uuid)||q.profileId!==actor||q.scopeKind!=='respiratory_care_review'||!text(q.qualificationType,1,200)||!text(q.title,1,500)||!['valid','expires_soon'].includes(q.status)||![q.documentFingerprint,q.sourceFingerprint,q.employeeFingerprint,q.scopeFingerprint].every(sha)||!calendarDate(q.employmentStart)||q.employmentEnd!==null&&!calendarDate(q.employmentEnd)||q.issuedAt!==null&&!calendarDate(q.issuedAt)||q.validUntil!==null&&!calendarDate(q.validUntil))return 'Vollständige Beschäftigungs-, Qualifikations-, Dokument- und Atemprüfbereichsoriginale fehlen.';
 const verified=respiratoryCareReviewInstantMicros(q.verifiedAt),updated=respiratoryCareReviewInstantMicros(q.updatedAt),recorded=respiratoryCareReviewInstantMicros(at);if(verified===null||updated===null||recorded===null||verified>recorded||updated>recorded)return 'Qualifikation war zum Prüfzeitpunkt nicht verifiziert.';
 const day=berlinDay(at);return q.employmentStart>day||q.employmentEnd!==null&&q.employmentEnd<day||q.issuedAt!==null&&q.issuedAt>day||q.validUntil!==null&&q.validUntil<day?'Beschäftigung oder Qualifikation gilt am Prüftag nicht.':null;
}
export function respiratoryCareReviewOriginalIssue(v:unknown,c:{tenantId:string;clientId:string;measurementId:string}):string|null{
 const o=v as RespiratoryCareReviewOriginal;if(!o||![o.id,o.rootId,o.headId,o.careRootId,o.careHeadId].every(uuid)||o.tenantId!==c.tenantId||o.clientId!==c.clientId||o.measurementId!==c.measurementId||!reviewableKinds.has(o.careKind)||!sha(o.careFingerprint)||![1,2].includes(o.revision)||!Array.isArray(o.history)||o.history.length!==o.revision)return 'Vollständiges Atemfachprüforiginal fehlt.';
 const ids=new Set<string>(),requests=new Set<string>();for(let i=0;i<o.history.length;i++){const e=o.history[i],prior=i?o.history[i-1]:null;if(!e||![e.id,e.requestId,e.actorId,e.careHeadId].every(uuid)||ids.has(e.id)||requests.has(e.requestId)||e.revision!==i+1||e.previousId!==(prior?.id??null)||e.careHeadId!==o.careHeadId||e.careFingerprint!==o.careFingerprint||respiratoryCareReviewInstantMicros(e.recordedAt)===null||!text(e.actorName,1,500)||!sha(e.fingerprint))return 'Atemfachprüfhistorie ist abgeschnitten, doppelt oder an eine andere Fassung gebunden.';
  if(!i){if(e.action!=='request'||!text(e.reason,10,2000)||e.requiredChange!==''||e.rationale!==''||e.qualification!==null)return 'Atemfachprüfanfrage enthält eine unzulässige Entscheidung.';}else{if(prior!.action!=='request'||e.actorId===prior!.actorId||respiratoryCareReviewInstantMicros(e.recordedAt)!<respiratoryCareReviewInstantMicros(prior!.recordedAt)!)return 'Prüfentscheidung benötigt eine zeitlich nachfolgende getrennte Person.';const issue=qualificationIssue(e.qualification,e.actorId,e.recordedAt);if(issue)return issue;if(e.action==='return'){if(!text(e.reason,10,2000)||!text(e.requiredChange,10,4000)||e.rationale!=='')return 'Begründete Rückgabe ist unvollständig.';}else if(e.action!=='accept'||e.reason!==''||e.requiredChange!==''||!text(e.rationale,10,4000))return 'Qualifizierte Annahme ist unvollständig.';}
  ids.add(e.id);requests.add(e.requestId);
 }
 const first=o.history[0],last=o.history.at(-1)!;return first.id!==o.rootId||o.id!==o.headId||last.id!==o.headId||o.status!==(last.action==='request'?'requested':last.action==='return'?'returned':last.action==='accept'?'accepted':null)?'Prüfkopf stimmt nicht mit der vollständigen Atemfachprüfhistorie überein.':null;
}
function sourceIssue(p:RespiratoryCareReviewPacket):string|null{
 const issue=respiratoryCareSourcesIssue(p.sources);if(issue)return issue;const head=p.sources.paths.find(x=>x.id===p.careOriginal.headId&&x.tenantId===p.tenantId&&x.clientId===p.clientId&&x.measurementId===p.measurementId);if(!head||head.payload.kind!==p.careOriginal.kind||head.fingerprint!==p.careOriginal.contentFingerprint)return 'Aktuelle Atem-/Intensivpflegefassung fehlt im vollständig gelesenen Originalbestand.';
 const e=p.careOriginal.payload,own=(list:RespiratoryCareSources[keyof RespiratoryCareSources],id:string|null)=>id===null?null:list.find(x=>x.id===id&&x.tenantId===p.tenantId&&x.clientId===p.clientId&&x.measurementId===p.measurementId);
 if(!own(p.sources.measurements,p.measurementId))return 'Aktuelles Messungsoriginal fehlt.';if(e.source.medicalOrderId&&!own(p.sources.medicalOrders,e.source.medicalOrderId))return 'Ausgewähltes Verordnungsoriginal fehlt.';
 if(e.source.deviceId&&!own(p.sources.devices,e.source.deviceId)||e.source.calibrationId&&!own(p.sources.calibrations,e.source.calibrationId))return 'Ausgewähltes Geräte- oder Kalibrierungsoriginal fehlt.';if(e.kind==='correction'&&!own(p.sources.paths,e.correction.targetId))return 'Berichtigtes Atem-/Intensivpflegeoriginal fehlt.';return null;
}
export function respiratoryCareReviewPacketIssue(v:unknown):string|null{
 const p=v as RespiratoryCareReviewPacket;if(!p||p.schemaVersion!=='1'||!['request','return','accept'].includes(p.action)||![p.requestId,p.tenantId,p.clientId,p.measurementId,p.actorId].every(uuid)||!Number.isSafeInteger(p.expectedRevision)||p.expectedRevision<0)return 'Atemfachprüfanfrage ist nicht vollständig gebunden.';
 const issue=respiratoryCareOriginalIssue(p.careOriginal,p)||sourceIssue(p);if(issue)return issue;const e=p.careOriginal.payload;
 const approvedHandover=e.kind==='intensive_handover'&&e.handover.specialistApproval==='approved'&&uuid(e.handover.handedOverBy)&&uuid(e.handover.approvedBy)&&e.handover.handedOverBy!==e.handover.approvedBy&&respiratoryCareReviewInstantMicros(e.handover.handedOverAt)!==null&&respiratoryCareReviewInstantMicros(e.handover.approvedAt)!==null;
 const correctedHandover=e.kind==='correction'&&uuid(e.correction.targetId)&&p.careOriginal.history.some(h=>h.id===e.correction.targetId&&h.payload.kind==='intensive_handover'&&h.payload.handover.specialistApproval==='approved')&&uuid(e.correction.approvedBy)&&respiratoryCareReviewInstantMicros(e.correction.approvedAt)!==null;
 if(!reviewableKinds.has(p.careOriginal.kind)||!approvedHandover&&!correctedHandover)return 'Nur eine tatsächlich übergebene, getrennt spezialisierte und vollständig abgeschlossene Intensivpflegefassung oder ihre gebundene append-only Berichtigung ist fachlich prüfbar.';
 if(p.action==='request')return p.expectedHeadId!==null||p.expectedRevision!==0||p.reviewOriginal!==null||!text(p.reason,10,2000)||p.requiredChange!==''||p.rationale!==''?'Prüfanfrage darf keine Entscheidung vorwegnehmen.':null;
 const review=p.reviewOriginal;if(!review||respiratoryCareReviewOriginalIssue(review,p)||review.careRootId!==p.careOriginal.rootId||review.careHeadId!==p.careOriginal.headId||review.careFingerprint!==p.careOriginal.contentFingerprint||review.careKind!==p.careOriginal.kind||review.status!=='requested'||p.expectedHeadId!==review.headId||p.expectedRevision!==review.revision)return 'Aktuelle unveränderte Prüfanfrage und Atem-/Intensivpflegefassung stimmen nicht überein.';
 const involved=new Set<string>();for(const h of p.careOriginal.history){involved.add(h.recordedBy);for(const actor of [h.payload.oxygen.performedBy,h.payload.tracheostomy.performedBy,h.payload.suction.performedBy,h.payload.ventilation.reviewedBy,h.payload.alarm.responsibleBy,h.payload.equipment.responsibleBy,h.payload.qualification.reviewedBy,h.payload.handover.handedOverBy,h.payload.handover.approvedBy,h.payload.correction.approvedBy])if(actor)involved.add(actor);}
 for(const ref of [...p.sources.measurements,...p.sources.medicalOrders,...p.sources.devices,...p.sources.calibrations,...p.sources.treatmentExecutions,...p.sources.qualifications,...p.sources.handovers])for(const key of ['recorded_by','approved_by','performed_by','reviewed_by','responsible_by','handed_over_by']){const actor=ref.payload[key];if(typeof actor==='string')involved.add(actor);}
 if(p.actorId===review.history[0].actorId||involved.has(p.actorId))return 'Anfragende, messende, dokumentierende, ausführende, übergebende oder bereits freigebende Personen dürfen dieselbe Fassung nicht selbst entscheiden.';
 if(p.action==='return')return !text(p.reason,10,2000)||!text(p.requiredChange,10,4000)||p.rationale!==''?'Rückgabe benötigt Grund und konkrete Änderung.':null;
 return p.reason!==''||p.requiredChange!==''||!text(p.rationale,10,4000)?'Annahme benötigt die unveränderten Originale und eine eigene fachliche Begründung.':null;
}
export function makeRespiratoryCareReviewPacket(input:Omit<RespiratoryCareReviewPacket,'schemaVersion'>):RespiratoryCareReviewPacket{const p=clone({schemaVersion:'1' as const,...input});const issue=respiratoryCareReviewPacketIssue(p);if(issue)throw Error(issue);return deepFreeze(p);}
