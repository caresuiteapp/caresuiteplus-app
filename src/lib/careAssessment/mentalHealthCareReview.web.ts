import {mentalHealthCareOriginalIssue,mentalHealthPathSourcesIssue,type MentalHealthCareOriginal,type MentalHealthPathSources} from './mentalHealthCarePath.web';

export type MentalHealthCareReviewQualification=Readonly<{
 id:string;employeeId:string;profileId:string;qualificationType:string;title:string;status:'valid'|'expires_soon';issuedAt:string|null;validUntil:string|null;verifiedAt:string;updatedAt:string;
 documentId:string;documentFingerprint:string;sourceFingerprint:string;employmentStart:string;employmentEnd:string|null;employeeFingerprint:string;
 scopeId:string;scopeKind:'mental_health_care_review';scopeFingerprint:string;
}>;
export type MentalHealthCareReviewEvent=Readonly<{
 id:string;revision:number;previousId:string|null;requestId:string;action:'request'|'return'|'accept';recordedAt:string;actorId:string;actorName:string;
 reason:string;requiredChange:string;rationale:string;careHeadId:string;careFingerprint:string;qualification:MentalHealthCareReviewQualification|null;fingerprint:string;
}>;
export type MentalHealthCareReviewOriginal=Readonly<{
 id:string;tenantId:string;clientId:string;assessmentId:string;rootId:string;headId:string;revision:number;careRootId:string;careHeadId:string;
 careFingerprint:string;careStatus:'released'|'corrected';status:'requested'|'returned'|'accepted';history:readonly MentalHealthCareReviewEvent[];
}>;
export type MentalHealthCareReviewPacket=Readonly<{
 schemaVersion:'1';action:'request'|'return'|'accept';requestId:string;tenantId:string;clientId:string;assessmentId:string;actorId:string;
 expectedHeadId:string|null;expectedRevision:number;careOriginal:MentalHealthCareOriginal;sources:MentalHealthPathSources;reviewOriginal:MentalHealthCareReviewOriginal|null;
 reason:string;requiredChange:string;rationale:string;
}>;

const uuid=(v:unknown):v is string=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
const sha=(v:unknown):v is string=>typeof v==='string'&&/^sha256:[0-9a-f]{64}$/.test(v);
const text=(v:unknown,min=0,max=8000):v is string=>typeof v==='string'&&v.trim().length>=min&&v.length<=max;
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v)&&[Object.prototype,null].includes(Object.getPrototypeOf(v));
const clone=<T>(v:T):T=>structuredClone(v);
const freeze=<T>(v:T):T=>{if(v&&typeof v==='object'&&!Object.isFrozen(v)){Object.freeze(v);for(const child of Object.values(v as Record<string,unknown>))freeze(child);}return v;};
export const mentalHealthCareReviewStable=(v:unknown):string=>JSON.stringify(v,(_key,item:unknown)=>object(item)?Object.fromEntries(Object.keys(item).sort().map(key=>[key,item[key]])):item);
export function mentalHealthCareReviewInstantMicros(v:unknown):bigint|null{
 if(typeof v!=='string')return null;const m=/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,6}))?(Z|[+-]\d{2}:?\d{2})$/.exec(v);
 if(!m||Number(m[1])<1000||Number(m[4])>23||Number(m[5])>59||Number(m[6])>59)return null;const day=`${m[1]}-${m[2]}-${m[3]}`,parsed=Date.parse(`${day}T00:00:00Z`);
 if(!Number.isFinite(parsed)||new Date(parsed).toISOString().slice(0,10)!==day)return null;if(m[8]!=='Z'){const z=m[8].replace(':','');if(Number(z.slice(1,3))>14||Number(z.slice(3))>59||Number(z.slice(1,3))===14&&Number(z.slice(3))!==0)return null;}
 const whole=Date.parse(`${day}T${m[4]}:${m[5]}:${m[6]}${m[8]}`);return Number.isFinite(whole)?BigInt(whole)*1000n+BigInt((m[7]??'').padEnd(6,'0')):null;
}
const calendarDate=(v:unknown):v is string=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&mentalHealthCareReviewInstantMicros(`${v}T00:00:00Z`)!==null;
const berlinDay=(at:string)=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Berlin',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(at));
function qualificationIssue(q:MentalHealthCareReviewQualification|null,actor:string,at:string):string|null{
 if(!q||![q.id,q.employeeId,q.profileId,q.documentId,q.scopeId].every(uuid)||q.profileId!==actor||q.scopeKind!=='mental_health_care_review'||!text(q.qualificationType,1,200)||!text(q.title,1,500)||!['valid','expires_soon'].includes(q.status)||![q.documentFingerprint,q.sourceFingerprint,q.employeeFingerprint,q.scopeFingerprint].every(sha)||!calendarDate(q.employmentStart)||q.employmentEnd!==null&&!calendarDate(q.employmentEnd)||q.issuedAt!==null&&!calendarDate(q.issuedAt)||q.validUntil!==null&&!calendarDate(q.validUntil))return 'Vollständige Beschäftigungs-, Qualifikations-, Dokument- und Psychiatrieprüfbereichsoriginale fehlen.';
 const verified=mentalHealthCareReviewInstantMicros(q.verifiedAt),updated=mentalHealthCareReviewInstantMicros(q.updatedAt),recorded=mentalHealthCareReviewInstantMicros(at);if(verified===null||updated===null||recorded===null||verified>recorded||updated>recorded)return 'Qualifikation war zum Prüfzeitpunkt nicht verifiziert.';
 const day=berlinDay(at);return q.employmentStart>day||q.employmentEnd!==null&&q.employmentEnd<day||q.issuedAt!==null&&q.issuedAt>day||q.validUntil!==null&&q.validUntil<day?'Beschäftigung oder Qualifikation gilt am Prüftag nicht.':null;
}
const careFingerprint=(o:MentalHealthCareOriginal)=>o.history.at(-1)?.fingerprint??'';
export function mentalHealthCareReviewOriginalIssue(v:unknown,c:{tenantId:string;clientId:string;assessmentId:string}):string|null{
 const o=v as MentalHealthCareReviewOriginal;if(!o||![o.id,o.rootId,o.headId,o.careRootId,o.careHeadId].every(uuid)||o.tenantId!==c.tenantId||o.clientId!==c.clientId||o.assessmentId!==c.assessmentId||!['released','corrected'].includes(o.careStatus)||!sha(o.careFingerprint)||![1,2].includes(o.revision)||!Array.isArray(o.history)||o.history.length!==o.revision)return 'Vollständiges Psychiatriefachprüforiginal fehlt.';
 const ids=new Set<string>(),requests=new Set<string>();for(let i=0;i<o.history.length;i++){const e=o.history[i],prior=i?o.history[i-1]:null;if(!e||![e.id,e.requestId,e.actorId,e.careHeadId].every(uuid)||ids.has(e.id)||requests.has(e.requestId)||e.revision!==i+1||e.previousId!==(prior?.id??null)||e.careHeadId!==o.careHeadId||e.careFingerprint!==o.careFingerprint||mentalHealthCareReviewInstantMicros(e.recordedAt)===null||!text(e.actorName,1,500)||!sha(e.fingerprint))return 'Psychiatriefachprüfhistorie ist abgeschnitten, doppelt oder an eine andere Fassung gebunden.';
  if(!i){if(e.action!=='request'||!text(e.reason,10,2000)||e.requiredChange!==''||e.rationale!==''||e.qualification!==null)return 'Psychiatriefachprüfanfrage enthält eine unzulässige Entscheidung.';}else{if(prior!.action!=='request'||e.actorId===prior!.actorId||mentalHealthCareReviewInstantMicros(e.recordedAt)!<mentalHealthCareReviewInstantMicros(prior!.recordedAt)!)return 'Prüfentscheidung benötigt eine zeitlich nachfolgende getrennte Person.';const issue=qualificationIssue(e.qualification,e.actorId,e.recordedAt);if(issue)return issue;if(e.action==='return'){if(!text(e.reason,10,2000)||!text(e.requiredChange,10,4000)||e.rationale!=='')return 'Begründete Rückgabe ist unvollständig.';}else if(e.action!=='accept'||e.reason!==''||e.requiredChange!==''||!text(e.rationale,10,4000))return 'Qualifizierte Annahme ist unvollständig.';}
  ids.add(e.id);requests.add(e.requestId);
 }
 const first=o.history[0],last=o.history.at(-1)!;return first.id!==o.rootId||o.id!==o.headId||last.id!==o.headId||o.status!==(last.action==='request'?'requested':last.action==='return'?'returned':last.action==='accept'?'accepted':null)?'Prüfkopf stimmt nicht mit der vollständigen Psychiatriefachprüfhistorie überein.':null;
}
function sourceIssue(p:MentalHealthCareReviewPacket):string|null{
 const issue=mentalHealthPathSourcesIssue(p.sources);if(issue)return issue;const head=p.sources.paths.find(x=>x.id===p.careOriginal.headId&&x.tenantId===p.tenantId&&x.clientId===p.clientId&&x.assessmentId===p.assessmentId);
 if(!head||head.payload.status!==p.careOriginal.status)return 'Aktuelle psychosoziale Fassung fehlt im vollständig gelesenen Originalbestand.';
 const own=(name:keyof MentalHealthPathSources,id:string|null)=>id===null?null:p.sources[name].find(x=>x.id===id&&x.tenantId===p.tenantId&&x.clientId===p.clientId&&x.assessmentId===p.assessmentId);
 const e=p.careOriginal.entry;if(!own('people',e.behaviour.observedBy)||!own('people',e.protectedRisk.assessedBy)||!own('prescriptions',e.psychiatricHkp.prescriptionId)||!own('qualifications',e.psychiatricHkp.qualificationId)||!own('approvals',e.psychiatricHkp.approvalId))return 'Vollständige aktuelle Personen-, Verordnungs-, Qualifikations- oder Kostenträgeroriginale fehlen.';
 return null;
}
export function mentalHealthCareReviewPacketIssue(v:unknown):string|null{
 const p=v as MentalHealthCareReviewPacket;if(!p||p.schemaVersion!=='1'||!['request','return','accept'].includes(p.action)||![p.requestId,p.tenantId,p.clientId,p.assessmentId,p.actorId].every(uuid)||!Number.isSafeInteger(p.expectedRevision)||p.expectedRevision<0)return 'Psychiatriefachprüfanfrage ist nicht vollständig gebunden.';
 const careIssue=mentalHealthCareOriginalIssue(p.careOriginal,p)||sourceIssue(p);if(careIssue)return careIssue;const e=p.careOriginal.entry,fingerprint=careFingerprint(p.careOriginal);
 const released=e.status==='released'&&uuid(e.review.requestedBy)&&uuid(e.review.releasedBy)&&e.review.requestedBy!==e.review.releasedBy&&mentalHealthCareReviewInstantMicros(e.review.requestedAt)!==null&&mentalHealthCareReviewInstantMicros(e.review.releasedAt)!==null;
 const corrected=e.status==='corrected'&&uuid(e.review.correctionTargetId)&&text(e.review.correctionReason,10)&&p.careOriginal.history.some(h=>h.id===e.review.correctionTargetId&&h.entry.status==='released');
 if(!released&&!corrected)return 'Nur eine tatsächlich getrennt freigegebene vollständige psychosoziale Fassung oder ihre gebundene append-only Berichtigung ist fachlich prüfbar.';
 if(!sha(fingerprint))return 'Kopf-Fingerabdruck der psychosozialen Fassung fehlt.';
 if(p.action==='request')return p.expectedHeadId!==null||p.expectedRevision!==0||p.reviewOriginal!==null||!text(p.reason,10,2000)||p.requiredChange!==''||p.rationale!==''?'Prüfanfrage darf keine Entscheidung vorwegnehmen.':null;
 const review=p.reviewOriginal;if(!review||mentalHealthCareReviewOriginalIssue(review,p)||review.careRootId!==p.careOriginal.rootId||review.careHeadId!==p.careOriginal.headId||review.careFingerprint!==fingerprint||review.careStatus!==p.careOriginal.status||review.status!=='requested'||p.expectedHeadId!==review.headId||p.expectedRevision!==review.revision)return 'Aktuelle unveränderte Prüfanfrage und psychosoziale Fassung stimmen nicht überein.';
 const involved=new Set<string>([review.history[0].actorId]);for(const h of p.careOriginal.history){involved.add(h.recordedBy);for(const actor of [h.entry.behaviour.observedBy,h.entry.protectedRisk.assessedBy,h.entry.review.requestedBy,h.entry.review.releasedBy,h.entry.review.returnedBy])if(actor)involved.add(actor);}
 for(const family of Object.values(p.sources))for(const ref of family)for(const key of ['recorded_by','approved_by','assessed_by','performed_by','reviewed_by','released_by']){const actor=ref.payload[key];if(typeof actor==='string')involved.add(actor);}
 if(involved.has(p.actorId))return 'Anfragende, dokumentierende, beobachtende, einschätzende, ausführende oder bereits freigebende Personen dürfen dieselbe Fassung nicht selbst entscheiden.';
 if(p.action==='return')return !text(p.reason,10,2000)||!text(p.requiredChange,10,4000)||p.rationale!==''?'Rückgabe benötigt Grund und konkrete Änderung.':null;
 return p.reason!==''||p.requiredChange!==''||!text(p.rationale,10,4000)?'Annahme benötigt unveränderte Originale und eine eigene fachliche Begründung.':null;
}
export function makeMentalHealthCareReviewPacket(input:Omit<MentalHealthCareReviewPacket,'schemaVersion'>):MentalHealthCareReviewPacket{const p=clone({schemaVersion:'1' as const,...input});const issue=mentalHealthCareReviewPacketIssue(p);if(issue)throw Error(issue);return freeze(p);}
