import {decodeSupplyContext,supplyId,supplyJson,supplyVersion,type SupplyContext,type SupplyHistory,type SupplyRow} from './supplyWorkspaceDomain.web';

export type SupplyReviewSource=Readonly<{version:typeof supplyVersion;tenantId:string;clientId:string;client:SupplyRow;sources:SupplyContext['sources'];people:SupplyContext['people'];history:SupplyHistory}>;
export type SupplyReviewQualification=Readonly<{
 id:string;employeeId:string;profileId:string;qualificationType:string;title:string;status:'valid'|'expires_soon';issuedAt:string|null;validUntil:string|null;verifiedAt:string;updatedAt:string;
 documentId:string;documentFingerprint:string;sourceFingerprint:string;employmentStart:string;employmentEnd:string|null;employeeFingerprint:string;scopeId:string;scopeKind:'supply_care_review';scopeFingerprint:string;
}>;
export type SupplyReviewEvent=Readonly<{
 id:string;revision:number;previousId:string|null;requestId:string;action:'request'|'return'|'accept';recordedAt:string;actorId:string;actorName:string;reason:string;requiredChange:string;rationale:string;
 supplyHeadId:string;supplyFingerprint:string;qualification:SupplyReviewQualification|null;fingerprint:string;
}>;
export type SupplyReviewOriginal=Readonly<{
 id:string;tenantId:string;clientId:string;rootId:string;headId:string;revision:number;supplyHeadId:string;supplyFingerprint:string;status:'requested'|'returned'|'accepted';history:readonly SupplyReviewEvent[];
}>;
export type SupplyReviewPacket=Readonly<{
 schemaVersion:'1';action:'request'|'return'|'accept';requestId:string;tenantId:string;clientId:string;actorId:string;expectedHeadId:string|null;expectedRevision:number;
 supplyOriginal:SupplyReviewSource;reviewOriginal:SupplyReviewOriginal|null;reason:string;requiredChange:string;rationale:string;
}>;

const uuid=(v:unknown):v is string=>supplyId(v);
const sha=(v:unknown):v is string=>typeof v==='string'&&/^sha256:[0-9a-f]{64}$/.test(v);
const text=(v:unknown,min=0,max=8000):v is string=>typeof v==='string'&&v.trim().length>=min&&v.length<=max;
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const clone=<T>(v:T):T=>structuredClone(v);
const freeze=<T>(v:T):T=>{if(v&&typeof v==='object'&&!Object.isFrozen(v)){Object.freeze(v);for(const child of Object.values(v as Record<string,unknown>))freeze(child);}return v;};
export const supplyReviewStable=(v:unknown):string=>JSON.stringify(v,(_key,item:unknown)=>object(item)?Object.fromEntries(Object.keys(item).sort().map(key=>[key,item[key]])):item);
export function supplyReviewInstantMicros(v:unknown):bigint|null{
 if(typeof v!=='string')return null;const m=/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,6}))?(Z|[+-]\d{2}:?\d{2})$/.exec(v);
 if(!m||Number(m[1])<1000||Number(m[4])>23||Number(m[5])>59||Number(m[6])>59)return null;const day=`${m[1]}-${m[2]}-${m[3]}`,parsed=Date.parse(`${day}T00:00:00Z`);
 if(!Number.isFinite(parsed)||new Date(parsed).toISOString().slice(0,10)!==day)return null;if(m[8]!=='Z'){const z=m[8].replace(':','');if(Number(z.slice(1,3))>14||Number(z.slice(3))>59||Number(z.slice(1,3))===14&&Number(z.slice(3))!==0)return null;}
 const whole=Date.parse(`${day}T${m[4]}:${m[5]}:${m[6]}${m[8]}`);return Number.isFinite(whole)?BigInt(whole)*1000n+BigInt((m[7]??'').padEnd(6,'0')):null;
}
const calendarDate=(v:unknown):v is string=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&supplyReviewInstantMicros(`${v}T00:00:00Z`)!==null;
const berlinDay=(at:string)=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Berlin',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(at));
function qualificationIssue(q:SupplyReviewQualification|null,actor:string,at:string):string|null{
 if(!q||![q.id,q.employeeId,q.profileId,q.documentId,q.scopeId].every(uuid)||q.profileId!==actor||q.scopeKind!=='supply_care_review'||!text(q.qualificationType,1,200)||!text(q.title,1,500)||!['valid','expires_soon'].includes(q.status)||![q.documentFingerprint,q.sourceFingerprint,q.employeeFingerprint,q.scopeFingerprint].every(sha)||!calendarDate(q.employmentStart)||q.employmentEnd!==null&&!calendarDate(q.employmentEnd)||q.issuedAt!==null&&!calendarDate(q.issuedAt)||q.validUntil!==null&&!calendarDate(q.validUntil))return 'Vollständige Beschäftigungs-, Qualifikations-, Dokument- und Hygiene-/Materialprüfbereichsoriginale fehlen.';
 const verified=supplyReviewInstantMicros(q.verifiedAt),updated=supplyReviewInstantMicros(q.updatedAt),recorded=supplyReviewInstantMicros(at);if(verified===null||updated===null||recorded===null||verified>recorded||updated>recorded)return 'Qualifikation war zum Prüfzeitpunkt nicht verifiziert.';
 const day=berlinDay(at);return q.employmentStart>day||q.employmentEnd!==null&&q.employmentEnd<day||q.issuedAt!==null&&q.issuedAt>day||q.validUntil!==null&&q.validUntil<day?'Beschäftigung oder Qualifikation gilt am Prüftag nicht.':null;
}
export function makeSupplyReviewSource(context:SupplyContext):SupplyReviewSource{
 decodeSupplyContext(context,{tenantId:context.tenantId,clientId:context.clientId,actorId:context.actorId});
 return clone({version:context.version,tenantId:context.tenantId,clientId:context.clientId,client:context.client,sources:context.sources,people:context.people,history:context.history});
}
function sourceIssue(v:unknown,actorId:string):string|null{
 try{
  const s=v as SupplyReviewSource;if(!s||s.version!==supplyVersion||!uuid(s.tenantId)||!uuid(s.clientId)||!s.history?.events?.length||!uuid(s.history.headId))return 'Ein vollständiger aktueller Hygiene- und Materialbestand mit Kopf fehlt.';
  const loadedAt=s.history.events.at(-1)!.recordedAt;decodeSupplyContext({...clone(s),actorId,loadedAt},{tenantId:s.tenantId,clientId:s.clientId,actorId},Number(supplyReviewInstantMicros(loadedAt)!/1000n)+1);supplyJson(s,16_000_000);return null;
 }catch(cause){return cause instanceof Error?cause.message:'Der vollständige Hygiene- und Materialbestand ist widersprüchlich.';}
}
export function supplyReviewOriginalIssue(v:unknown,c:{tenantId:string;clientId:string}):string|null{
 const o=v as SupplyReviewOriginal;if(!o||![o.id,o.rootId,o.headId,o.supplyHeadId].every(uuid)||o.tenantId!==c.tenantId||o.clientId!==c.clientId||!sha(o.supplyFingerprint)||![1,2].includes(o.revision)||!Array.isArray(o.history)||o.history.length!==o.revision)return 'Vollständiges Hygiene-/Materialprüforiginal fehlt.';
 const ids=new Set<string>(),requests=new Set<string>();for(let i=0;i<o.history.length;i++){const e=o.history[i],prior=i?o.history[i-1]:null;if(!e||![e.id,e.requestId,e.actorId,e.supplyHeadId].every(uuid)||ids.has(e.id)||requests.has(e.requestId)||e.revision!==i+1||e.previousId!==(prior?.id??null)||e.supplyHeadId!==o.supplyHeadId||e.supplyFingerprint!==o.supplyFingerprint||supplyReviewInstantMicros(e.recordedAt)===null||!text(e.actorName,1,500)||!sha(e.fingerprint))return 'Hygiene-/Materialprüfhistorie ist abgeschnitten, doppelt oder an eine andere Fassung gebunden.';
  if(!i){if(e.action!=='request'||!text(e.reason,10,2000)||e.requiredChange!==''||e.rationale!==''||e.qualification!==null)return 'Prüfanfrage enthält eine unzulässige Entscheidung.';}else{if(prior!.action!=='request'||e.actorId===prior!.actorId||supplyReviewInstantMicros(e.recordedAt)!<supplyReviewInstantMicros(prior!.recordedAt)!)return 'Prüfentscheidung benötigt eine zeitlich nachfolgende getrennte Person.';const issue=qualificationIssue(e.qualification,e.actorId,e.recordedAt);if(issue)return issue;if(e.action==='return'){if(!text(e.reason,10,2000)||!text(e.requiredChange,10,4000)||e.rationale!=='')return 'Begründete Rückgabe ist unvollständig.';}else if(e.action!=='accept'||e.reason!==''||e.requiredChange!==''||!text(e.rationale,10,4000))return 'Qualifizierte Annahme ist unvollständig.';}
  ids.add(e.id);requests.add(e.requestId);
 }
 const first=o.history[0],last=o.history.at(-1)!;return first.id!==o.rootId||o.id!==o.headId||last.id!==o.headId||o.status!==({request:'requested',return:'returned',accept:'accepted'} as const)[last.action]?'Prüfkopf stimmt nicht mit der vollständigen Hygiene-/Materialprüfhistorie überein.':null;
}
export function supplyReviewPacketIssue(v:unknown):string|null{
 const p=v as SupplyReviewPacket;if(!p||p.schemaVersion!=='1'||!['request','return','accept'].includes(p.action)||![p.requestId,p.tenantId,p.clientId,p.actorId].every(uuid)||!Number.isSafeInteger(p.expectedRevision)||p.expectedRevision<0)return 'Hygiene-/Materialprüfanfrage ist nicht vollständig gebunden.';
 const issue=sourceIssue(p.supplyOriginal,p.actorId);if(issue||p.supplyOriginal.tenantId!==p.tenantId||p.supplyOriginal.clientId!==p.clientId)return issue??'Prüfquelle gehört nicht zu diesem Pflegefall.';
 if(p.action==='request')return p.expectedHeadId!==null||p.expectedRevision!==0||p.reviewOriginal!==null||!text(p.reason,10,2000)||p.requiredChange!==''||p.rationale!==''?'Prüfanfrage darf keine Entscheidung vorwegnehmen.':null;
 const review=p.reviewOriginal;if(!review||supplyReviewOriginalIssue(review,p)||review.supplyHeadId!==p.supplyOriginal.history.headId||review.status!=='requested'||p.expectedHeadId!==review.headId||p.expectedRevision!==review.revision)return 'Aktuelle unveränderte Prüfanfrage und Hygiene-/Materialfassung stimmen nicht überein.';
 const involved=new Set<string>([review.history[0].actorId,...p.supplyOriginal.history.events.map(e=>e.actorId)]);if(involved.has(p.actorId))return 'Anfragende oder an Hygiene-, Material-, Geräte-, Hauswirtschafts- oder Zugangsvorgängen beteiligte Personen dürfen dieselbe Fassung nicht selbst entscheiden.';
 if(p.action==='return')return !text(p.reason,10,2000)||!text(p.requiredChange,10,4000)||p.rationale!==''?'Rückgabe benötigt Grund und konkrete Änderung.':null;
 return p.reason!==''||p.requiredChange!==''||!text(p.rationale,10,4000)?'Annahme benötigt unveränderte vollständige Originale und eine eigene fachliche Begründung.':null;
}
export function makeSupplyReviewPacket(input:Omit<SupplyReviewPacket,'schemaVersion'>):SupplyReviewPacket{const p=clone({schemaVersion:'1' as const,...input});const issue=supplyReviewPacketIssue(p);if(issue)throw Error(issue);return freeze(p);}
