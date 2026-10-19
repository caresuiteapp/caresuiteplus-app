import {woundPathOriginalIssue,woundPathSourcesIssue,type WoundPathKind,type WoundPathOriginal,type WoundPathSources} from './woundPathPacket.web';

export type WoundPathReviewQualification=Readonly<{
 id:string;employeeId:string;profileId:string;qualificationType:string;title:string;
 status:'valid'|'expires_soon';issuedAt:string|null;validUntil:string|null;verifiedAt:string;updatedAt:string;
 documentId:string;documentFingerprint:string;sourceFingerprint:string;
 employmentStart:string;employmentEnd:string|null;employeeFingerprint:string;
 scopeId:string;scopeKind:'wound_care_review';scopeFingerprint:string;
}>;
export type WoundPathReviewEvent=Readonly<{
 id:string;revision:number;previousId:string|null;requestId:string;action:'request'|'return'|'accept';
 recordedAt:string;actorId:string;actorName:string;reason:string;requiredChange:string;rationale:string;
 woundHeadId:string;woundFingerprint:string;qualification:WoundPathReviewQualification|null;fingerprint:string;
}>;
export type WoundPathReviewOriginal=Readonly<{
 id:string;tenantId:string;clientId:string;woundId:string;rootId:string;headId:string;revision:number;
 woundRootId:string;woundHeadId:string;woundFingerprint:string;woundKind:WoundPathKind;
 status:'requested'|'returned'|'accepted';history:readonly WoundPathReviewEvent[];
}>;
export type WoundPathReviewPacket=Readonly<{
 schemaVersion:'1';action:'request'|'return'|'accept';requestId:string;tenantId:string;clientId:string;woundId:string;actorId:string;
 expectedHeadId:string|null;expectedRevision:number;woundOriginal:WoundPathOriginal;sources:WoundPathSources;
 reviewOriginal:WoundPathReviewOriginal|null;reason:string;requiredChange:string;rationale:string;
}>;

const reviewableKinds=new Set<WoundPathKind>(['escalation_resolution','correction']);
const actualOutcomes=new Set(['performed','partial','omitted','refused','failed']);
const uuid=(v:unknown):v is string=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
const sha=(v:unknown):v is string=>typeof v==='string'&&/^sha256:[0-9a-f]{64}$/.test(v);
const text=(v:unknown,min=0,max=8000):v is string=>typeof v==='string'&&v.trim().length>=min&&v.length<=max;
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const clone=<T>(v:T):T=>structuredClone(v);
const deepFreeze=<T>(v:T):T=>{if(v&&typeof v==='object'&&!Object.isFrozen(v)){Object.freeze(v);for(const child of Object.values(v as Record<string,unknown>))deepFreeze(child);}return v;};
export const woundPathReviewStable=(v:unknown):string=>JSON.stringify(v,(_key,item:unknown)=>object(item)?Object.fromEntries(Object.keys(item).sort().map(key=>[key,item[key]])):item);
export function woundPathReviewInstantMicros(v:unknown):bigint|null{
 if(typeof v!=='string')return null;
 const m=/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,6}))?(Z|[+-]\d{2}:?\d{2})$/.exec(v);
 if(!m||Number(m[1])<1000||Number(m[4])>23||Number(m[5])>59||Number(m[6])>59)return null;
 const day=`${m[1]}-${m[2]}-${m[3]}`,parsedDay=Date.parse(`${day}T00:00:00Z`);
 if(!Number.isFinite(parsedDay)||new Date(parsedDay).toISOString().slice(0,10)!==day)return null;
 if(m[8]!=='Z'){const zone=m[8].replace(':','');if(Number(zone.slice(1,3))>14||Number(zone.slice(3))>59||Number(zone.slice(1,3))===14&&Number(zone.slice(3))!==0)return null;}
 const whole=Date.parse(`${day}T${m[4]}:${m[5]}:${m[6]}${m[8]}`);
 return Number.isFinite(whole)?BigInt(whole)*1000n+BigInt((m[7]??'').padEnd(6,'0')):null;
}
const calendarDate=(v:unknown):v is string=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&woundPathReviewInstantMicros(`${v}T00:00:00Z`)!==null;
const berlinDay=(at:string)=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Berlin',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(at));
function qualificationIssue(q:WoundPathReviewQualification|null,actor:string,at:string):string|null{
 if(!q||![q.id,q.employeeId,q.profileId,q.documentId,q.scopeId].every(uuid)||q.profileId!==actor||q.scopeKind!=='wound_care_review'||!text(q.qualificationType,1,200)||!text(q.title,1,500)||!['valid','expires_soon'].includes(q.status)||![q.documentFingerprint,q.sourceFingerprint,q.employeeFingerprint,q.scopeFingerprint].every(sha)||!calendarDate(q.employmentStart)||q.employmentEnd!==null&&!calendarDate(q.employmentEnd)||q.issuedAt!==null&&!calendarDate(q.issuedAt)||q.validUntil!==null&&!calendarDate(q.validUntil))return 'Vollständige Beschäftigungs-, Qualifikations-, Dokument- und Wundprüfbereichsoriginale fehlen.';
 const verified=woundPathReviewInstantMicros(q.verifiedAt),updated=woundPathReviewInstantMicros(q.updatedAt),recorded=woundPathReviewInstantMicros(at);
 if(verified===null||updated===null||recorded===null||verified>recorded||updated>recorded)return 'Qualifikation war zum Prüfzeitpunkt nicht verifiziert.';
 const day=berlinDay(at);return q.employmentStart>day||q.employmentEnd!==null&&q.employmentEnd<day||q.issuedAt!==null&&q.issuedAt>day||q.validUntil!==null&&q.validUntil<day?'Beschäftigung oder Qualifikation gilt am Prüftag nicht.':null;
}
export function woundPathReviewOriginalIssue(v:unknown,c:{tenantId:string;clientId:string;woundId:string}):string|null{
 const o=v as WoundPathReviewOriginal;
 if(!o||![o.id,o.rootId,o.headId,o.woundRootId,o.woundHeadId].every(uuid)||o.tenantId!==c.tenantId||o.clientId!==c.clientId||o.woundId!==c.woundId||!reviewableKinds.has(o.woundKind)||!sha(o.woundFingerprint)||![1,2].includes(o.revision)||!Array.isArray(o.history)||o.history.length!==o.revision)return 'Vollständiges Wundfachprüforiginal fehlt.';
 const ids=new Set<string>(),requests=new Set<string>();
 for(let i=0;i<o.history.length;i++){
  const e=o.history[i],prior=i?o.history[i-1]:null;
  if(!e||![e.id,e.requestId,e.actorId,e.woundHeadId].every(uuid)||ids.has(e.id)||requests.has(e.requestId)||e.revision!==i+1||e.previousId!==(prior?.id??null)||e.woundHeadId!==o.woundHeadId||e.woundFingerprint!==o.woundFingerprint||woundPathReviewInstantMicros(e.recordedAt)===null||!text(e.actorName,1,500)||!sha(e.fingerprint))return 'Wundfachprüfhistorie ist abgeschnitten, doppelt oder an eine andere Fassung gebunden.';
  if(!i){if(e.action!=='request'||!text(e.reason,10,2000)||e.requiredChange!==''||e.rationale!==''||e.qualification!==null)return 'Wundfachprüfanfrage enthält eine unzulässige Entscheidung.';}
  else{if(prior!.action!=='request'||e.actorId===prior!.actorId||woundPathReviewInstantMicros(e.recordedAt)!<woundPathReviewInstantMicros(prior!.recordedAt)!)return 'Prüfentscheidung benötigt eine zeitlich nachfolgende getrennte Person.';const issue=qualificationIssue(e.qualification,e.actorId,e.recordedAt);if(issue)return issue;if(e.action==='return'){if(!text(e.reason,10,2000)||!text(e.requiredChange,10,4000)||e.rationale!=='')return 'Begründete Rückgabe ist unvollständig.';}else if(e.action!=='accept'||e.reason!==''||e.requiredChange!==''||!text(e.rationale,10,4000))return 'Qualifizierte Annahme ist unvollständig.';}
  ids.add(e.id);requests.add(e.requestId);
 }
 const first=o.history[0],last=o.history.at(-1)!;return first.id!==o.rootId||o.id!==o.headId||last.id!==o.headId||o.status!==({request:'requested',return:'returned',accept:'accepted'} as const)[last.action]?'Prüfkopf stimmt nicht mit der vollständigen Wundfachprüfhistorie überein.':null;
}
function sourceIssue(p:WoundPathReviewPacket):string|null{
 const sources=woundPathSourcesIssue(p.sources);if(sources)return sources;
 const care=p.woundOriginal.payload,head=p.sources.escalations.find(x=>x.id===p.woundOriginal.headId);
 if(!head||head.fingerprint!==p.woundOriginal.contentFingerprint)return 'Aktuelle Wundpfadfassung fehlt im vollständig gelesenen Originalbestand.';
 const own=(list:WoundPathSources[keyof WoundPathSources],id:string|null)=>id===null?null:list.find(x=>x.id===id&&x.clientId===p.clientId&&x.woundId===p.woundId);
 if(!own(p.sources.wounds,p.woundId))return 'Aktuelles Wundfalloriginal fehlt.';
 if(care.observation.assessmentId&&!own(p.sources.assessments,care.observation.assessmentId))return 'Ausgewähltes Assessmentoriginal fehlt.';
 if(care.observation.photoId&&(!own(p.sources.photos,care.observation.photoId)||!own(p.sources.photoConsents,care.observation.photoConsentId)))return 'Bild- oder Einwilligungsoriginal fehlt.';
 if(!own(p.sources.plans,care.care.planId)||!own(p.sources.dressings,care.care.dressingId))return 'Aktuelle Plan- oder Versorgungsoriginale fehlen.';
 return null;
}
export function woundPathReviewPacketIssue(v:unknown):string|null{
 const p=v as WoundPathReviewPacket;if(!p||p.schemaVersion!=='1'||!['request','return','accept'].includes(p.action)||![p.requestId,p.tenantId,p.clientId,p.woundId,p.actorId].every(uuid)||!Number.isSafeInteger(p.expectedRevision)||p.expectedRevision<0)return 'Wundfachprüfanfrage ist nicht vollständig gebunden.';
 const issue=woundPathOriginalIssue(p.woundOriginal,p)||sourceIssue(p);if(issue)return issue;const care=p.woundOriginal,entry=care.payload;
 if(!reviewableKinds.has(care.kind)||entry.resolution.state!=='resolved'||entry.contact.state!=='responded'||!actualOutcomes.has(entry.care.outcome)||!entry.care.planId||!entry.care.dressingId)return 'Nur ein vollständig abgeschlossener Wundpfad mit tatsächlicher Versorgung oder Nichtversorgung, Rückmeldung und Ergebnis ist fachlich prüfbar.';
 if(p.action==='request')return p.expectedHeadId!==null||p.expectedRevision!==0||p.reviewOriginal!==null||!text(p.reason,10,2000)||p.requiredChange!==''||p.rationale!==''?'Prüfanfrage darf keine Entscheidung vorwegnehmen.':null;
 const review=p.reviewOriginal;if(!review||woundPathReviewOriginalIssue(review,p)||review.woundRootId!==care.rootId||review.woundHeadId!==care.headId||review.woundFingerprint!==care.contentFingerprint||review.woundKind!==care.kind||review.status!=='requested'||p.expectedHeadId!==review.headId||p.expectedRevision!==review.revision)return 'Aktuelle unveränderte Prüfanfrage und Wundpfadfassung stimmen nicht überein.';
 const linked=[entry.contact.responsibleBy,entry.resolution.responsibleBy,entry.correction.approvedBy];
 for(const list of [p.sources.assessments,p.sources.photos,p.sources.plans,p.sources.dressings])for(const ref of list)if([entry.observation.assessmentId,entry.observation.photoId,entry.care.planId,entry.care.dressingId].includes(ref.id)){const recorded=ref.payload.recorded_by;if(typeof recorded==='string')linked.push(recorded);}
 const involved=new Set(care.history.flatMap(item=>[item.recordedBy,item.payload.contact.responsibleBy,item.payload.resolution.responsibleBy,item.payload.correction.approvedBy]).concat(linked).filter((x):x is string=>!!x));
 if(p.actorId===review.history[0].actorId||involved.has(p.actorId))return 'Anfragende, dokumentierende, ausführende, kontrollierende oder bereits freigebende Personen dürfen dieselbe Fassung nicht selbst entscheiden.';
 if(p.action==='return')return !text(p.reason,10,2000)||!text(p.requiredChange,10,4000)||p.rationale!==''?'Rückgabe benötigt Grund und konkrete Änderung.':null;
 return p.reason!==''||p.requiredChange!==''||!text(p.rationale,10,4000)?'Annahme benötigt die unveränderten Originale und eine eigene fachliche Begründung.':null;
}
export function makeWoundPathReviewPacket(input:Omit<WoundPathReviewPacket,'schemaVersion'>):WoundPathReviewPacket{const p=clone({schemaVersion:'1' as const,...input});const issue=woundPathReviewPacketIssue(p);if(issue)throw Error(issue);return deepFreeze(p);}
