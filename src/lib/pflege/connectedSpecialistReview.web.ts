/**
 * Cross-domain specialist review contract for the ambulatory Web/Desktop flows.
 *
 * A review is deliberately stored as a separate fact.  A plan, observation,
 * delivery, care action, visit, contract or invoice never implies acceptance.
 */
export type ConnectedReviewDomain=
 |'medication'|'treatment_care'|'wound_care'|'vital_care'
 |'respiratory_intensive_care'|'mental_health_care'|'palliative_special_care'
 |'counseling_coordination'|'supply_care'|'personnel_care'
 |'tour_planning'|'visit_execution'|'financing_contract';

export type ConnectedReviewSource=Readonly<{
 id:string;revision:number;recordedAt:string;fingerprint:string;
 actorIds:readonly string[];snapshot:unknown;
}>;
export type ConnectedReviewCollection=Readonly<{
 kind:string;fingerprint:string;items:readonly ConnectedReviewSource[];
}>;
export type ConnectedReviewSubject=Readonly<{
 domain:ConnectedReviewDomain;tenantId:string;clientId:string;rootId:string;headId:string;
 revision:number;kind:string;state:'open'|'completed'|'released'|'voided';recordedAt:string;
 recordedBy:string;contentFingerprint:string;historyActorIds:readonly string[];
 collections:readonly ConnectedReviewCollection[];
}>;
export type ConnectedReviewQualification=Readonly<{
 id:string;employeeId:string;profileId:string;employeeStatus:'aktiv';employmentStatus:'active';
 qualificationId:string;qualificationType:string;qualificationTitle:string;
 qualificationStatus:'valid'|'expires_soon';issuedAt:string|null;validUntil:string|null;
 verifiedAt:string;updatedAt:string;documentId:string;documentFingerprint:string;
 employeeFingerprint:string;employmentFingerprint:string;qualificationFingerprint:string;
 scopeId:string;scope:string;scopeFingerprint:string;permission:'pflege.documentation.sign';
}>;
export type ConnectedReviewEvent=Readonly<{
 id:string;revision:number;previousId:string|null;requestId:string;
 action:'request'|'return'|'accept';recordedAt:string;actorId:string;actorName:string;
 reason:string;requiredChange:string;rationale:string;subjectHeadId:string;
 subjectFingerprint:string;qualification:ConnectedReviewQualification|null;fingerprint:string;
}>;
export type ConnectedReviewOriginal=Readonly<{
 id:string;tenantId:string;clientId:string;rootId:string;headId:string;revision:number;
 domain:ConnectedReviewDomain;subjectRootId:string;subjectHeadId:string;subjectKind:string;
 subjectFingerprint:string;status:'requested'|'returned'|'accepted';
 history:readonly ConnectedReviewEvent[];
}>;
export type ConnectedReviewPacket=Readonly<{
 schemaVersion:'1';action:'request'|'return'|'accept';requestId:string;tenantId:string;
 clientId:string;actorId:string;expectedHeadId:string|null;expectedRevision:number;
 subject:ConnectedReviewSubject;reviewOriginal:ConnectedReviewOriginal|null;
 reason:string;requiredChange:string;rationale:string;
}>;

type Descriptor=Readonly<{scope:string;eligible:readonly ConnectedReviewSubject['state'][];collections:readonly string[]}>;
export const connectedReviewDescriptors:Readonly<Record<ConnectedReviewDomain,Descriptor>>={
 medication:{scope:'medication_care_review',eligible:['completed'],collections:['medication','order','allergies','administrations','stock','witnesses','documents']},
 treatment_care:{scope:'treatment_care_review',eligible:['completed'],collections:['order','approval','material','execution','observation','control','follow_up']},
 wound_care:{scope:'wound_care_review',eligible:['completed'],collections:['wound','assessment','images','consent','plan','dressing','care','response']},
 vital_care:{scope:'vital_care_review',eligible:['completed'],collections:['measurements','limits','devices','calibrations','reactions','controls','course']},
 respiratory_intensive_care:{scope:'respiratory_intensive_care_review',eligible:['completed'],collections:['measurements','orders','devices','calibrations','executions','qualifications','handover','course']},
 mental_health_care:{scope:'mental_health_care_review',eligible:['released'],collections:['assessment','people','orders','qualifications','cost_carriers']},
 palliative_special_care:{scope:'palliative_special_care_review',eligible:['released'],collections:['assessment','directives','people','orders','medical_determinations','care','contracts','qualifications','releases']},
 counseling_coordination:{scope:'counseling_coordination_review',eligible:['released'],collections:['appointments','counseling','documents','contacts','people','orders','supplies','delivery','services','follow_up','communication','consents']},
 supply_care:{scope:'supply_care_review',eligible:['completed'],collections:['case','quality','documents','people','hygiene','infections','consumption','batches','devices','cleaning_disposal','housekeeping','access','orders_delivery','inventory']},
 personnel_care:{scope:'personnel_care_review',eligible:['completed'],collections:['person','employment','qualifications','delegations','instructions','double_staffing','training_deadlines','standby','safety','time_pay','absence_return','exit','corrections']},
 tour_planning:{scope:'tour_planning_review',eligible:['completed'],collections:['plan','sources','people','course']},
 visit_execution:{scope:'visit_execution_review',eligible:['completed'],collections:['tour_stop','sources','people','events']},
 financing_contract:{scope:'financing_contract_review',eligible:['completed'],collections:['case','contract','documents','funding','approvals','tariffs','budgets','offers','combination_rules','services','proofs']},
};

const domains=new Set(Object.keys(connectedReviewDescriptors));
const uuid=(v:unknown):v is string=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
const sha=(v:unknown):v is string=>typeof v==='string'&&/^sha256:[0-9a-f]{64}$/.test(v);
const text=(v:unknown,min=1,max=8000):v is string=>typeof v==='string'&&v.trim().length>=min&&v.length<=max;
const date=(v:unknown):v is string=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&instantMicros(`${v}T00:00:00Z`)!==null;
export const connectedReviewStable=(v:unknown):string=>JSON.stringify(v,(_k,item:unknown)=>item&&typeof item==='object'&&!Array.isArray(item)?Object.fromEntries(Object.keys(item).sort().map(key=>[key,(item as Record<string,unknown>)[key]])):item);
export function instantMicros(v:unknown):bigint|null{
 if(typeof v!=='string')return null;
 const m=/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,6}))?(Z|[+-]\d{2}:?\d{2})$/.exec(v);
 if(!m||Number(m[1])<1000||Number(m[4])>23||Number(m[5])>59||Number(m[6])>59)return null;
 const day=`${m[1]}-${m[2]}-${m[3]}`,parsed=Date.parse(`${day}T00:00:00Z`);
 if(!Number.isFinite(parsed)||new Date(parsed).toISOString().slice(0,10)!==day)return null;
 if(m[8]!=='Z'){const z=m[8].replace(':','');if(Number(z.slice(1,3))>14||Number(z.slice(3))>59||Number(z.slice(1,3))===14&&Number(z.slice(3))!==0)return null;}
 const whole=Date.parse(`${day}T${m[4]}:${m[5]}:${m[6]}${m[8]}`);
 return Number.isFinite(whole)?BigInt(whole)*1000n+BigInt((m[7]??'').padEnd(6,'0')):null;
}
const berlinDay=(at:string)=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Berlin',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(at));
const distinctUuids=(v:unknown):v is readonly string[]=>Array.isArray(v)&&v.every(uuid)&&new Set(v).size===v.length;

export function connectedReviewSubjectIssue(v:unknown,context?:{tenantId:string;clientId:string}):string|null{
 const s=v as ConnectedReviewSubject;
 if(!s||!domains.has(s.domain)||![s.tenantId,s.clientId,s.rootId,s.headId,s.recordedBy].every(uuid)||context&&(s.tenantId!==context.tenantId||s.clientId!==context.clientId)||!Number.isSafeInteger(s.revision)||s.revision<1||!text(s.kind,1,200)||!['open','completed','released','voided'].includes(s.state)||instantMicros(s.recordedAt)===null||!sha(s.contentFingerprint)||!distinctUuids(s.historyActorIds)||!Array.isArray(s.collections))return 'Vollständiger unveränderter Fachoriginalkopf fehlt.';
 const descriptor=connectedReviewDescriptors[s.domain],kinds=new Set<string>();
 if(!descriptor.eligible.includes(s.state))return 'Offene, aufgehobene oder nur geplante Fassungen sind nicht fachlich annehmbar.';
 for(const collection of s.collections){
  if(!collection||!text(collection.kind,1,100)||kinds.has(collection.kind)||!sha(collection.fingerprint)||!Array.isArray(collection.items)||collection.items.length>2000)return 'Quellbestände sind abgeschnitten, doppelt oder nicht gebunden.';
  kinds.add(collection.kind);const ids=new Set<string>();
  for(const source of collection.items){
   if(!source||!uuid(source.id)||ids.has(source.id)||!Number.isSafeInteger(source.revision)||source.revision<1||instantMicros(source.recordedAt)===null||!sha(source.fingerprint)||!distinctUuids(source.actorIds)||source.snapshot===null||source.snapshot===undefined||typeof source.snapshot!=='object')return 'Ein vollständiges aktuelles Quelloriginal fehlt.';
   ids.add(source.id);
  }
 }
 return descriptor.collections.some(kind=>!kinds.has(kind))?'Ein erforderlicher vollständiger Quellbestand fehlt.':null;
}

function qualificationIssue(q:ConnectedReviewQualification|null,actor:string,domain:ConnectedReviewDomain,at:string):string|null{
 const scope=connectedReviewDescriptors[domain].scope;
 if(!q||![q.id,q.employeeId,q.profileId,q.qualificationId,q.documentId,q.scopeId].every(uuid)||q.profileId!==actor||q.employeeStatus!=='aktiv'||q.employmentStatus!=='active'||q.permission!=='pflege.documentation.sign'||q.scope!==scope||!text(q.qualificationType,1,200)||!text(q.qualificationTitle,1,500)||!['valid','expires_soon'].includes(q.qualificationStatus)||![q.documentFingerprint,q.employeeFingerprint,q.employmentFingerprint,q.qualificationFingerprint,q.scopeFingerprint].every(sha)||q.issuedAt!==null&&!date(q.issuedAt)||q.validUntil!==null&&!date(q.validUntil))return 'Aktuelle Beschäftigungs-, Qualifikations-, Dokument-, Rechte- und Prüfbereichsoriginale fehlen.';
 const verified=instantMicros(q.verifiedAt),updated=instantMicros(q.updatedAt),recorded=instantMicros(at);
 if(verified===null||updated===null||recorded===null||verified>recorded||updated>recorded)return 'Prüfberechtigung war zum Entscheidungszeitpunkt nicht aktuell bestätigt.';
 const day=berlinDay(at);return q.issuedAt!==null&&q.issuedAt>day||q.validUntil!==null&&q.validUntil<day?'Qualifikation gilt am bezeichneten Prüftag nicht.':null;
}

export function connectedReviewOriginalIssue(v:unknown,c:{tenantId:string;clientId:string}):string|null{
 const o=v as ConnectedReviewOriginal;
 if(!o||!domains.has(o.domain)||![o.id,o.rootId,o.headId,o.subjectRootId,o.subjectHeadId].every(uuid)||o.tenantId!==c.tenantId||o.clientId!==c.clientId||!text(o.subjectKind,1,200)||!sha(o.subjectFingerprint)||![1,2].includes(o.revision)||!Array.isArray(o.history)||o.history.length!==o.revision)return 'Vollständiges Fachprüforiginal fehlt.';
 const ids=new Set<string>(),requests=new Set<string>();
 for(let n=0;n<o.history.length;n++){
  const e=o.history[n],prior=n?o.history[n-1]:null;
  if(!e||![e.id,e.requestId,e.actorId,e.subjectHeadId].every(uuid)||ids.has(e.id)||requests.has(e.requestId)||e.revision!==n+1||e.previousId!==(prior?.id??null)||e.subjectHeadId!==o.subjectHeadId||e.subjectFingerprint!==o.subjectFingerprint||instantMicros(e.recordedAt)===null||!text(e.actorName,1,500)||!sha(e.fingerprint))return 'Fachprüfhistorie ist abgeschnitten, doppelt oder an eine andere Fassung gebunden.';
  if(!n){if(e.action!=='request'||!text(e.reason,10,2000)||e.requiredChange!==''||e.rationale!==''||e.qualification!==null)return 'Prüfanfrage enthält eine vorweggenommene Entscheidung.';}
  else{
   if(prior!.action!=='request'||e.actorId===prior!.actorId||instantMicros(e.recordedAt)!<instantMicros(prior!.recordedAt)!)return 'Prüfentscheidung benötigt eine zeitlich nachfolgende getrennte Person.';
   const issue=qualificationIssue(e.qualification,e.actorId,o.domain,e.recordedAt);if(issue)return issue;
   if(e.action==='return'){if(!text(e.reason,10,2000)||!text(e.requiredChange,10,4000)||e.rationale!=='')return 'Begründete Rückgabe ist unvollständig.';}
   else if(e.action!=='accept'||e.reason!==''||e.requiredChange!==''||!text(e.rationale,10,4000))return 'Qualifizierte Annahme ist unvollständig.';
  }
  ids.add(e.id);requests.add(e.requestId);
 }
 const first=o.history[0],last=o.history.at(-1)!;
 return first.id!==o.rootId||o.id!==o.headId||last.id!==o.headId||o.status!==({request:'requested',return:'returned',accept:'accepted'} as const)[last.action]?'Fachprüfkopf stimmt nicht mit der vollständigen Historie überein.':null;
}

export function connectedReviewPacketIssue(v:unknown):string|null{
 const p=v as ConnectedReviewPacket;
 if(!p||p.schemaVersion!=='1'||!['request','return','accept'].includes(p.action)||![p.requestId,p.tenantId,p.clientId,p.actorId].every(uuid)||!Number.isSafeInteger(p.expectedRevision)||p.expectedRevision<0)return 'Fachprüfanfrage ist nicht vollständig gebunden.';
 const subjectIssue=connectedReviewSubjectIssue(p.subject,{tenantId:p.tenantId,clientId:p.clientId});if(subjectIssue)return subjectIssue;
 if(p.action==='request')return p.expectedHeadId!==null||p.expectedRevision!==0||p.reviewOriginal!==null||!text(p.reason,10,2000)||p.requiredChange!==''||p.rationale!==''?'Prüfanfrage darf keine Entscheidung vorwegnehmen.':null;
 const r=p.reviewOriginal,s=p.subject;
 if(!r||connectedReviewOriginalIssue(r,p)||r.domain!==s.domain||r.subjectRootId!==s.rootId||r.subjectHeadId!==s.headId||r.subjectKind!==s.kind||r.subjectFingerprint!==s.contentFingerprint||r.status!=='requested'||p.expectedHeadId!==r.headId||p.expectedRevision!==r.revision)return 'Aktuelle unveränderte Prüfanfrage und Fachfassung stimmen nicht überein.';
 const involved=new Set([s.recordedBy,...s.historyActorIds,...s.collections.flatMap(collection=>collection.items.flatMap(item=>item.actorIds))]);
 if(p.actorId===r.history[0].actorId||involved.has(p.actorId))return 'Anfragende oder in gebundenen Originalen handelnde Personen dürfen dieselbe Fassung nicht selbst entscheiden.';
 if(p.action==='return')return !text(p.reason,10,2000)||!text(p.requiredChange,10,4000)||p.rationale!==''?'Rückgabe benötigt Grund und konkrete Änderung.':null;
 return p.reason!==''||p.requiredChange!==''||!text(p.rationale,10,4000)?'Annahme benötigt eine eigene fachliche Begründung.':null;
}

export function makeConnectedReviewPacket(input:Omit<ConnectedReviewPacket,'schemaVersion'>):ConnectedReviewPacket{
 const packet=structuredClone({schemaVersion:'1' as const,...input}),issue=connectedReviewPacketIssue(packet);if(issue)throw Error(issue);return Object.freeze(packet);
}
