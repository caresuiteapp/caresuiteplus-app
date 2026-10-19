import {vitalCareOriginalIssue,vitalCareSourcesIssue,type VitalCareKind,type VitalCareOriginal,type VitalCareSources} from './vitalCarePathPacket.web';

export type VitalCareReviewQualification=Readonly<{
 id:string;employeeId:string;profileId:string;qualificationType:string;title:string;status:'valid'|'expires_soon';issuedAt:string|null;validUntil:string|null;verifiedAt:string;updatedAt:string;
 documentId:string;documentFingerprint:string;sourceFingerprint:string;employmentStart:string;employmentEnd:string|null;employeeFingerprint:string;
 scopeId:string;scopeKind:'vital_care_review';scopeFingerprint:string;
}>;
export type VitalCareReviewEvent=Readonly<{
 id:string;revision:number;previousId:string|null;requestId:string;action:'request'|'return'|'accept';recordedAt:string;actorId:string;actorName:string;
 reason:string;requiredChange:string;rationale:string;careHeadId:string;careFingerprint:string;qualification:VitalCareReviewQualification|null;fingerprint:string;
}>;
export type VitalCareReviewOriginal=Readonly<{
 id:string;tenantId:string;clientId:string;measurementId:string;rootId:string;headId:string;revision:number;careRootId:string;careHeadId:string;
 careFingerprint:string;careKind:VitalCareKind;status:'requested'|'returned'|'accepted';history:readonly VitalCareReviewEvent[];
}>;
export type VitalCareReviewPacket=Readonly<{
 schemaVersion:'1';action:'request'|'return'|'accept';requestId:string;tenantId:string;clientId:string;measurementId:string;actorId:string;
 expectedHeadId:string|null;expectedRevision:number;careOriginal:VitalCareOriginal;sources:VitalCareSources;reviewOriginal:VitalCareReviewOriginal|null;
 reason:string;requiredChange:string;rationale:string;
}>;

const reviewableKinds=new Set<VitalCareKind>(['case_resolution','correction']);
const uuid=(v:unknown):v is string=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
const sha=(v:unknown):v is string=>typeof v==='string'&&/^sha256:[0-9a-f]{64}$/.test(v);
const text=(v:unknown,min=0,max=8000):v is string=>typeof v==='string'&&v.trim().length>=min&&v.length<=max;
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v)&&[Object.prototype,null].includes(Object.getPrototypeOf(v));
const clone=<T>(v:T):T=>structuredClone(v);
const deepFreeze=<T>(v:T):T=>{if(v&&typeof v==='object'&&!Object.isFrozen(v)){Object.freeze(v);for(const child of Object.values(v as Record<string,unknown>))deepFreeze(child);}return v;};
export const vitalCareReviewStable=(v:unknown):string=>JSON.stringify(v,(_key,item:unknown)=>object(item)?Object.fromEntries(Object.keys(item).sort().map(key=>[key,item[key]])):item);
export function vitalCareReviewInstantMicros(v:unknown):bigint|null{
 if(typeof v!=='string')return null;const m=/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,6}))?(Z|[+-]\d{2}:?\d{2})$/.exec(v);
 if(!m||Number(m[1])<1000||Number(m[4])>23||Number(m[5])>59||Number(m[6])>59)return null;const day=`${m[1]}-${m[2]}-${m[3]}`,parsed=Date.parse(`${day}T00:00:00Z`);
 if(!Number.isFinite(parsed)||new Date(parsed).toISOString().slice(0,10)!==day)return null;if(m[8]!=='Z'){const zone=m[8].replace(':','');if(Number(zone.slice(1,3))>14||Number(zone.slice(3))>59||Number(zone.slice(1,3))===14&&Number(zone.slice(3))!==0)return null;}
 const whole=Date.parse(`${day}T${m[4]}:${m[5]}:${m[6]}${m[8]}`);return Number.isFinite(whole)?BigInt(whole)*1000n+BigInt((m[7]??'').padEnd(6,'0')):null;
}
const calendarDate=(v:unknown):v is string=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&vitalCareReviewInstantMicros(`${v}T00:00:00Z`)!==null;
const berlinDay=(at:string)=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Berlin',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(at));
function qualificationIssue(q:VitalCareReviewQualification|null,actor:string,at:string):string|null{
 if(!q||![q.id,q.employeeId,q.profileId,q.documentId,q.scopeId].every(uuid)||q.profileId!==actor||q.scopeKind!=='vital_care_review'||!text(q.qualificationType,1,200)||!text(q.title,1,500)||!['valid','expires_soon'].includes(q.status)||![q.documentFingerprint,q.sourceFingerprint,q.employeeFingerprint,q.scopeFingerprint].every(sha)||!calendarDate(q.employmentStart)||q.employmentEnd!==null&&!calendarDate(q.employmentEnd)||q.issuedAt!==null&&!calendarDate(q.issuedAt)||q.validUntil!==null&&!calendarDate(q.validUntil))return 'Vollständige Beschäftigungs-, Qualifikations-, Dokument- und Vitalprüfbereichsoriginale fehlen.';
 const verified=vitalCareReviewInstantMicros(q.verifiedAt),updated=vitalCareReviewInstantMicros(q.updatedAt),recorded=vitalCareReviewInstantMicros(at);if(verified===null||updated===null||recorded===null||verified>recorded||updated>recorded)return 'Qualifikation war zum Prüfzeitpunkt nicht verifiziert.';
 const day=berlinDay(at);return q.employmentStart>day||q.employmentEnd!==null&&q.employmentEnd<day||q.issuedAt!==null&&q.issuedAt>day||q.validUntil!==null&&q.validUntil<day?'Beschäftigung oder Qualifikation gilt am Prüftag nicht.':null;
}
export function vitalCareReviewOriginalIssue(v:unknown,c:{tenantId:string;clientId:string;measurementId:string}):string|null{
 const o=v as VitalCareReviewOriginal;if(!o||![o.id,o.rootId,o.headId,o.careRootId,o.careHeadId].every(uuid)||o.tenantId!==c.tenantId||o.clientId!==c.clientId||o.measurementId!==c.measurementId||!reviewableKinds.has(o.careKind)||!sha(o.careFingerprint)||![1,2].includes(o.revision)||!Array.isArray(o.history)||o.history.length!==o.revision)return 'Vollständiges Vitalfachprüforiginal fehlt.';
 const ids=new Set<string>(),requests=new Set<string>();for(let i=0;i<o.history.length;i++){const e=o.history[i],prior=i?o.history[i-1]:null;if(!e||![e.id,e.requestId,e.actorId,e.careHeadId].every(uuid)||ids.has(e.id)||requests.has(e.requestId)||e.revision!==i+1||e.previousId!==(prior?.id??null)||e.careHeadId!==o.careHeadId||e.careFingerprint!==o.careFingerprint||vitalCareReviewInstantMicros(e.recordedAt)===null||!text(e.actorName,1,500)||!sha(e.fingerprint))return 'Vitalfachprüfhistorie ist abgeschnitten, doppelt oder an eine andere Fassung gebunden.';
  if(!i){if(e.action!=='request'||!text(e.reason,10,2000)||e.requiredChange!==''||e.rationale!==''||e.qualification!==null)return 'Vitalfachprüfanfrage enthält eine unzulässige Entscheidung.';}else{if(prior!.action!=='request'||e.actorId===prior!.actorId||vitalCareReviewInstantMicros(e.recordedAt)!<vitalCareReviewInstantMicros(prior!.recordedAt)!)return 'Prüfentscheidung benötigt eine zeitlich nachfolgende getrennte Person.';const issue=qualificationIssue(e.qualification,e.actorId,e.recordedAt);if(issue)return issue;if(e.action==='return'){if(!text(e.reason,10,2000)||!text(e.requiredChange,10,4000)||e.rationale!=='')return 'Begründete Rückgabe ist unvollständig.';}else if(e.action!=='accept'||e.reason!==''||e.requiredChange!==''||!text(e.rationale,10,4000))return 'Qualifizierte Annahme ist unvollständig.';}
  ids.add(e.id);requests.add(e.requestId);
 }
 const first=o.history[0],last=o.history.at(-1)!;return first.id!==o.rootId||o.id!==o.headId||last.id!==o.headId||o.status!==({request:'requested',return:'returned',accept:'accepted'} as const)[last.action]?'Prüfkopf stimmt nicht mit der vollständigen Vitalfachprüfhistorie überein.':null;
}
function sourceIssue(p:VitalCareReviewPacket):string|null{
 const issue=vitalCareSourcesIssue(p.sources);if(issue)return issue;const head=p.sources.paths.find(x=>x.id===p.careOriginal.headId&&x.tenantId===p.tenantId&&x.clientId===p.clientId&&x.measurementId===p.measurementId);if(!head||head.payload.kind!==p.careOriginal.kind||head.fingerprint!==p.careOriginal.contentFingerprint)return 'Aktuelle Vitalpfadfassung fehlt im vollständig gelesenen Originalbestand.';
 const e=p.careOriginal.payload,own=(list:VitalCareSources[keyof VitalCareSources],id:string|null)=>id===null?null:list.find(x=>x.id===id&&x.tenantId===p.tenantId&&x.clientId===p.clientId&&x.measurementId===p.measurementId);
 if(!own(p.sources.measurements,p.measurementId))return 'Aktuelles Messungsoriginal fehlt.';if(e.interpretation.configuredLimitId&&!own(p.sources.settings,e.interpretation.configuredLimitId))return 'Ausgewähltes Grenzoriginal fehlt.';
 if(e.device.deviceId&&!own(p.sources.devices,e.device.deviceId)||e.device.calibrationId&&!own(p.sources.calibrations,e.device.calibrationId))return 'Ausgewähltes Geräte- oder Kalibrierungsoriginal fehlt.';return null;
}
export function vitalCareReviewPacketIssue(v:unknown):string|null{
 const p=v as VitalCareReviewPacket;if(!p||p.schemaVersion!=='1'||!['request','return','accept'].includes(p.action)||![p.requestId,p.tenantId,p.clientId,p.measurementId,p.actorId].every(uuid)||!Number.isSafeInteger(p.expectedRevision)||p.expectedRevision<0)return 'Vitalfachprüfanfrage ist nicht vollständig gebunden.';
 const issue=vitalCareOriginalIssue(p.careOriginal,p)||sourceIssue(p);if(issue)return issue;const e=p.careOriginal.payload;
 if(!reviewableKinds.has(p.careOriginal.kind)||e.control.state!=='resolved'||!['performed','not_required'].includes(e.response.state)||e.interpretation.state==='unrated'||!['confirmed','limited','not_applicable'].includes(e.device.suitability)||e.device.deviceId!==null&&e.device.calibrationId===null)return 'Nur ein vollständig abgeschlossener Vitalpfad mit ausdrücklicher Bewertung, tatsächlicher Reaktion oder begründeter Nicht-Erforderlichkeit, Kontrolle und Gerätebezug ist fachlich prüfbar.';
 if(p.action==='request')return p.expectedHeadId!==null||p.expectedRevision!==0||p.reviewOriginal!==null||!text(p.reason,10,2000)||p.requiredChange!==''||p.rationale!==''?'Prüfanfrage darf keine Entscheidung vorwegnehmen.':null;
 const review=p.reviewOriginal;if(!review||vitalCareReviewOriginalIssue(review,p)||review.careRootId!==p.careOriginal.rootId||review.careHeadId!==p.careOriginal.headId||review.careFingerprint!==p.careOriginal.contentFingerprint||review.careKind!==p.careOriginal.kind||review.status!=='requested'||p.expectedHeadId!==review.headId||p.expectedRevision!==review.revision)return 'Aktuelle unveränderte Prüfanfrage und Vitalpfadfassung stimmen nicht überein.';
 const involved=new Set<string>(p.careOriginal.history.flatMap(h=>[h.recordedBy,h.payload.response.responsibleBy,h.payload.control.responsibleBy,h.payload.correction.approvedBy]).filter((x):x is string=>!!x));
 for(const ref of [...p.sources.measurements,...p.sources.settings,...p.sources.devices,...p.sources.calibrations])for(const key of ['recorded_by','approved_by']){const actor=ref.payload[key];if(typeof actor==='string')involved.add(actor);}
 if(p.actorId===review.history[0].actorId||involved.has(p.actorId))return 'Anfragende, messende, dokumentierende, reagierende, kontrollierende oder bereits freigebende Personen dürfen dieselbe Fassung nicht selbst entscheiden.';
 if(p.action==='return')return !text(p.reason,10,2000)||!text(p.requiredChange,10,4000)||p.rationale!==''?'Rückgabe benötigt Grund und konkrete Änderung.':null;
 return p.reason!==''||p.requiredChange!==''||!text(p.rationale,10,4000)?'Annahme benötigt die unveränderten Originale und eine eigene fachliche Begründung.':null;
}
export function makeVitalCareReviewPacket(input:Omit<VitalCareReviewPacket,'schemaVersion'>):VitalCareReviewPacket{const p=clone({schemaVersion:'1' as const,...input});const issue=vitalCareReviewPacketIssue(p);if(issue)throw Error(issue);return deepFreeze(p);}
