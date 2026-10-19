import {counselingCoordinationOriginalIssue,counselingCoordinationSourcesIssue,type CounselingCoordinationOriginal,type CounselingCoordinationSources} from './counselingCoordinationPath.web';

export type CounselingCoordinationReviewQualification=Readonly<{
 id:string;employeeId:string;profileId:string;qualificationType:string;title:string;status:'valid'|'expires_soon';issuedAt:string|null;validUntil:string|null;verifiedAt:string;updatedAt:string;
 documentId:string;documentFingerprint:string;sourceFingerprint:string;employmentStart:string;employmentEnd:string|null;employeeFingerprint:string;
 scopeId:string;scopeKind:'counseling_coordination_review';scopeFingerprint:string;
}>;
export type CounselingCoordinationReviewEvent=Readonly<{
 id:string;revision:number;previousId:string|null;requestId:string;action:'request'|'return'|'accept';recordedAt:string;actorId:string;actorName:string;
 reason:string;requiredChange:string;rationale:string;careHeadId:string;careFingerprint:string;qualification:CounselingCoordinationReviewQualification|null;fingerprint:string;
}>;
export type CounselingCoordinationReviewOriginal=Readonly<{
 id:string;tenantId:string;clientId:string;assessmentId:string;rootId:string;headId:string;revision:number;careRootId:string;careHeadId:string;
 careFingerprint:string;careStatus:'released'|'corrected';status:'requested'|'returned'|'accepted';history:readonly CounselingCoordinationReviewEvent[];
}>;
export type CounselingCoordinationReviewPacket=Readonly<{
 schemaVersion:'1';action:'request'|'return'|'accept';requestId:string;tenantId:string;clientId:string;assessmentId:string;actorId:string;
 expectedHeadId:string|null;expectedRevision:number;careOriginal:CounselingCoordinationOriginal;sources:CounselingCoordinationSources;reviewOriginal:CounselingCoordinationReviewOriginal|null;
 reason:string;requiredChange:string;rationale:string;
}>;

const uuid=(v:unknown):v is string=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
const sha=(v:unknown):v is string=>typeof v==='string'&&/^sha256:[0-9a-f]{64}$/.test(v);
const text=(v:unknown,min=0,max=8000):v is string=>typeof v==='string'&&v.trim().length>=min&&v.length<=max;
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v)&&[Object.prototype,null].includes(Object.getPrototypeOf(v));
const clone=<T>(v:T):T=>structuredClone(v);
const freeze=<T>(v:T):T=>{if(v&&typeof v==='object'&&!Object.isFrozen(v)){Object.freeze(v);for(const child of Object.values(v as Record<string,unknown>))freeze(child);}return v;};
export const counselingCoordinationReviewStable=(v:unknown):string=>JSON.stringify(v,(_key,item:unknown)=>object(item)?Object.fromEntries(Object.keys(item).sort().map(key=>[key,item[key]])):item);
export function counselingCoordinationReviewInstantMicros(v:unknown):bigint|null{
 if(typeof v!=='string')return null;const m=/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,6}))?(Z|[+-]\d{2}:?\d{2})$/.exec(v);
 if(!m||Number(m[1])<1000||Number(m[4])>23||Number(m[5])>59||Number(m[6])>59)return null;const day=`${m[1]}-${m[2]}-${m[3]}`,parsed=Date.parse(`${day}T00:00:00Z`);
 if(!Number.isFinite(parsed)||new Date(parsed).toISOString().slice(0,10)!==day)return null;if(m[8]!=='Z'){const z=m[8].replace(':','');if(Number(z.slice(1,3))>14||Number(z.slice(3))>59||Number(z.slice(1,3))===14&&Number(z.slice(3))!==0)return null;}
 const whole=Date.parse(`${day}T${m[4]}:${m[5]}:${m[6]}${m[8]}`);return Number.isFinite(whole)?BigInt(whole)*1000n+BigInt((m[7]??'').padEnd(6,'0')):null;
}
const calendarDate=(v:unknown):v is string=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&counselingCoordinationReviewInstantMicros(`${v}T00:00:00Z`)!==null;
const berlinDay=(at:string)=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Berlin',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(at));
function qualificationIssue(q:CounselingCoordinationReviewQualification|null,actor:string,at:string):string|null{
 if(!q||![q.id,q.employeeId,q.profileId,q.documentId,q.scopeId].every(uuid)||q.profileId!==actor||q.scopeKind!=='counseling_coordination_review'||!text(q.qualificationType,1,200)||!text(q.title,1,500)||!['valid','expires_soon'].includes(q.status)||![q.documentFingerprint,q.sourceFingerprint,q.employeeFingerprint,q.scopeFingerprint].every(sha)||!calendarDate(q.employmentStart)||q.employmentEnd!==null&&!calendarDate(q.employmentEnd)||q.issuedAt!==null&&!calendarDate(q.issuedAt)||q.validUntil!==null&&!calendarDate(q.validUntil))return 'Vollständige Beschäftigungs-, Qualifikations-, Dokument- und Beratungsprüfbereichsoriginale fehlen.';
 const verified=counselingCoordinationReviewInstantMicros(q.verifiedAt),updated=counselingCoordinationReviewInstantMicros(q.updatedAt),recorded=counselingCoordinationReviewInstantMicros(at);if(verified===null||updated===null||recorded===null||verified>recorded||updated>recorded)return 'Qualifikation war zum Prüfzeitpunkt nicht verifiziert.';
 const day=berlinDay(at);return q.employmentStart>day||q.employmentEnd!==null&&q.employmentEnd<day||q.issuedAt!==null&&q.issuedAt>day||q.validUntil!==null&&q.validUntil<day?'Beschäftigung oder Qualifikation gilt am Prüftag nicht.':null;
}
const careFingerprint=(o:CounselingCoordinationOriginal)=>o.history.at(-1)?.fingerprint??'';
export function counselingCoordinationReviewOriginalIssue(v:unknown,c:{tenantId:string;clientId:string;assessmentId:string}):string|null{
 const o=v as CounselingCoordinationReviewOriginal;if(!o||![o.id,o.rootId,o.headId,o.careRootId,o.careHeadId].every(uuid)||o.tenantId!==c.tenantId||o.clientId!==c.clientId||o.assessmentId!==c.assessmentId||!['released','corrected'].includes(o.careStatus)||!sha(o.careFingerprint)||![1,2].includes(o.revision)||!Array.isArray(o.history)||o.history.length!==o.revision)return 'Vollständiges Beratungsfachprüforiginal fehlt.';
 const ids=new Set<string>(),requests=new Set<string>();for(let i=0;i<o.history.length;i++){const e=o.history[i],prior=i?o.history[i-1]:null;if(!e||![e.id,e.requestId,e.actorId,e.careHeadId].every(uuid)||ids.has(e.id)||requests.has(e.requestId)||e.revision!==i+1||e.previousId!==(prior?.id??null)||e.careHeadId!==o.careHeadId||e.careFingerprint!==o.careFingerprint||counselingCoordinationReviewInstantMicros(e.recordedAt)===null||!text(e.actorName,1,500)||!sha(e.fingerprint))return 'Beratungsfachprüfhistorie ist abgeschnitten, doppelt oder an eine andere Fassung gebunden.';
  if(!i){if(e.action!=='request'||!text(e.reason,10,2000)||e.requiredChange!==''||e.rationale!==''||e.qualification!==null)return 'Beratungsfachprüfanfrage enthält eine unzulässige Entscheidung.';}else{if(prior!.action!=='request'||e.actorId===prior!.actorId||counselingCoordinationReviewInstantMicros(e.recordedAt)!<counselingCoordinationReviewInstantMicros(prior!.recordedAt)!)return 'Prüfentscheidung benötigt eine zeitlich nachfolgende getrennte Person.';const issue=qualificationIssue(e.qualification,e.actorId,e.recordedAt);if(issue)return issue;if(e.action==='return'){if(!text(e.reason,10,2000)||!text(e.requiredChange,10,4000)||e.rationale!=='')return 'Begründete Rückgabe ist unvollständig.';}else if(e.action!=='accept'||e.reason!==''||e.requiredChange!==''||!text(e.rationale,10,4000))return 'Qualifizierte Annahme ist unvollständig.';}
  ids.add(e.id);requests.add(e.requestId);
 }
 const first=o.history[0],last=o.history.at(-1)!;return first.id!==o.rootId||o.id!==o.headId||last.id!==o.headId||o.status!==({request:'requested',return:'returned',accept:'accepted'} as const)[last.action]?'Prüfkopf stimmt nicht mit der vollständigen Beratungsfachprüfhistorie überein.':null;
}
function sourceIssue(p:CounselingCoordinationReviewPacket):string|null{
 const issue=counselingCoordinationSourcesIssue(p.sources);if(issue)return issue;const head=p.sources.paths.find(x=>x.id===p.careOriginal.headId&&x.tenantId===p.tenantId&&x.clientId===p.clientId&&x.assessmentId===p.assessmentId);
 if(!head||head.payload.status!==p.careOriginal.status)return 'Aktuelle Beratungs- und Koordinationsfassung fehlt im vollständig gelesenen Originalbestand.';
 const own=(name:keyof CounselingCoordinationSources,id:string|null)=>id===null?null:p.sources[name].find(x=>x.id===id&&x.tenantId===p.tenantId&&x.clientId===p.clientId&&x.assessmentId===p.assessmentId);
 const e=p.careOriginal.entry;
 if(!own('appointments',e.consultation.appointmentId)||!own('appointments',e.therapy.appointmentId)||!own('consultations',e.mandatoryVisit.sessionId)||!own('consultations',e.benefitChange.counselingSessionId))return 'Vollständige aktuelle Termin- oder Beratungsoriginale fehlen.';
 if(!own('documents',e.mandatoryVisit.documentId)||!own('documents',e.discharge.transferDocumentId)||!own('documents',e.benefitChange.decisionDocumentId)||!own('documents',e.doctorCommunication.confirmationDocumentId))return 'Vollständige aktuelle Formular-, Überleitungs-, Bescheid- oder Bestätigungsoriginale fehlen.';
 if(!own('contacts',e.relativeInstruction.contactId)||!own('contacts',e.aidSupply.supplierContactId)||!own('contacts',e.therapy.providerContactId)||!own('people',e.consultation.performedBy)||!own('people',e.mandatoryVisit.confirmationBy)||!own('people',e.aidSupply.instructedBy))return 'Vollständige aktuelle Kontakt- oder Personenoriginale fehlen.';
 if(!own('prescriptions',e.aidSupply.prescriptionId)||!own('prescriptions',e.therapy.prescriptionId)||!own('orders',e.aidSupply.orderId)||!own('orders',e.doctorCommunication.medicalOrderId)||!own('serviceRecords',e.discharge.firstCareRecordId))return 'Vollständige aktuelle Verordnungs-, Auftrags- oder Versorgungsoriginale fehlen.';
 if(!own('careLevels',e.benefitChange.careLevelId)||!own('tasks',e.benefitChange.followUpTaskId)||!own('communications',e.therapy.communicationId)||!own('communications',e.doctorCommunication.communicationId))return 'Vollständige aktuelle Leistungs-, Folge- oder Kommunikationsoriginale fehlen.';
 const consent=own('consents',e.therapy.consentId);if(!consent||consent.payload.granted!==true)return 'Aktuelles ausdrücklich erteiltes Einwilligungsoriginal für die Therapiedatenfreigabe fehlt.';
 return null;
}
export function counselingCoordinationReviewPacketIssue(v:unknown):string|null{
 const p=v as CounselingCoordinationReviewPacket;if(!p||p.schemaVersion!=='1'||!['request','return','accept'].includes(p.action)||![p.requestId,p.tenantId,p.clientId,p.assessmentId,p.actorId].every(uuid)||!Number.isSafeInteger(p.expectedRevision)||p.expectedRevision<0)return 'Beratungsfachprüfanfrage ist nicht vollständig gebunden.';
 const careIssue=counselingCoordinationOriginalIssue(p.careOriginal,p)||sourceIssue(p);if(careIssue)return careIssue;const e=p.careOriginal.entry,fingerprint=careFingerprint(p.careOriginal);
 const released=e.status==='released'&&uuid(e.review.requestedBy)&&uuid(e.review.releasedBy)&&e.review.requestedBy!==e.review.releasedBy&&counselingCoordinationReviewInstantMicros(e.review.requestedAt)!==null&&counselingCoordinationReviewInstantMicros(e.review.releasedAt)!==null;
 const corrected=e.status==='corrected'&&uuid(e.review.correctionTargetId)&&text(e.review.correctionReason,10)&&p.careOriginal.history.some(h=>h.id===e.review.correctionTargetId&&h.entry.status==='released');
 if(!released&&!corrected)return 'Nur eine tatsächlich getrennt freigegebene vollständige Beratungs- und Koordinationsfassung oder ihre gebundene append-only Berichtigung ist fachlich prüfbar.';
 if(!sha(fingerprint))return 'Kopf-Fingerabdruck der Beratungs- und Koordinationsfassung fehlt.';
 if(p.action==='request')return p.expectedHeadId!==null||p.expectedRevision!==0||p.reviewOriginal!==null||!text(p.reason,10,2000)||p.requiredChange!==''||p.rationale!==''?'Prüfanfrage darf keine Entscheidung vorwegnehmen.':null;
 const review=p.reviewOriginal;if(!review||counselingCoordinationReviewOriginalIssue(review,p)||review.careRootId!==p.careOriginal.rootId||review.careHeadId!==p.careOriginal.headId||review.careFingerprint!==fingerprint||review.careStatus!==p.careOriginal.status||review.status!=='requested'||p.expectedHeadId!==review.headId||p.expectedRevision!==review.revision)return 'Aktuelle unveränderte Prüfanfrage und Beratungs- und Koordinationsfassung stimmen nicht überein.';
 const involved=new Set<string>([review.history[0].actorId]);for(const h of p.careOriginal.history){involved.add(h.recordedBy);for(const actor of [h.entry.consultation.performedBy,h.entry.mandatoryVisit.confirmationBy,h.entry.aidSupply.instructedBy,h.entry.review.requestedBy,h.entry.review.releasedBy,h.entry.review.returnedBy])if(actor)involved.add(actor);}
 for(const family of Object.values(p.sources))for(const ref of family)for(const key of ['recorded_by','approved_by','assessed_by','performed_by','reviewed_by','released_by','confirmed_by','instructed_by']){const actor=ref.payload[key];if(typeof actor==='string')involved.add(actor);}
 if(involved.has(p.actorId))return 'Anfragende, dokumentierende, beratende, ausführende, bestätigende, einweisende oder bereits freigebende Personen dürfen dieselbe Fassung nicht selbst entscheiden.';
 if(p.action==='return')return !text(p.reason,10,2000)||!text(p.requiredChange,10,4000)||p.rationale!==''?'Rückgabe benötigt Grund und konkrete Änderung.':null;
 return p.reason!==''||p.requiredChange!==''||!text(p.rationale,10,4000)?'Annahme benötigt unveränderte Originale und eine eigene fachliche Begründung.':null;
}
export function makeCounselingCoordinationReviewPacket(input:Omit<CounselingCoordinationReviewPacket,'schemaVersion'>):CounselingCoordinationReviewPacket{const p=clone({schemaVersion:'1' as const,...input});const issue=counselingCoordinationReviewPacketIssue(p);if(issue)throw Error(issue);return freeze(p);}

