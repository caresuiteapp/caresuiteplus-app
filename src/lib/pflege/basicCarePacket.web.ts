import {cloneClientNativeOriginal,freezeClientNativeOriginal,sameClientNativeOriginal} from '../clients/clientRecordNativeOriginal.web.ts';

export type BasicCareKind=
 |'body_care'|'oral_care'|'dressing'|'transfer_positioning'
 |'pressure_prevention'|'fall_prevention'|'contracture_prevention'|'individual_prevention';
export type BasicCareOutcome='planned'|'offered'|'performed'|'partial'|'refused'|'not_performed';
export type BasicCareEntry=Readonly<{
 kind:BasicCareKind;title:string;plannedAt:string;occurredAt:string|null;
 planVersionId:string;measureId:string;visitId:string;planSnapshotSha256:string;
 consent:Readonly<{state:'not_asked'|'consented'|'refused'|'withdrawn';recordedAt:string|null;statedReason:string;consultation:string}>;
 assistance:Readonly<{level:'independent'|'prompting'|'partial_assist'|'full_assist'|'two_person_assist';secondPersonRequired:boolean;helpers:readonly string[];aids:readonly string[];technique:string}>;
 observation:Readonly<{baseline:string;skin:string;mobility:string;oral:string;tolerance:string;oralAbnormality:boolean;skinChange:boolean}>;
 execution:Readonly<{outcome:BasicCareOutcome;bodyScope:'not_applicable'|'partial'|'full';performedBy:readonly string[];interventions:readonly string[];result:string;deviation:string}>;
 prevention:Readonly<{risk:string;professionalBasis:string;individualMeasure:string;reviewAt:string|null;fallOccurred:boolean;incidentId:string|null;reassessmentId:string|null}>;
 followUp:Readonly<{required:boolean;reason:string;responsibleProfileId:string|null;dueAt:string|null;taskId:string|null;state:'not_required'|'open'|'closed';closureEvidence:string}>;
 lifecycle:'open'|'completed';
}>;
export type BasicCareHistoryItem=Readonly<{id:string;revision:number;previousId:string|null;recordedAt:string;recordedBy:string;recordedByName:string;reason:string;payload:BasicCareEntry;contentFingerprint:string}>;
export type BasicCareOriginal=Readonly<{
 id:string;tenantId:string;clientId:string;rootId:string;headId:string;revision:number;kind:BasicCareKind;
 recordedAt:string;recordedBy:string;recordedByName:string;payload:BasicCareEntry;contentFingerprint:string;
 history:readonly BasicCareHistoryItem[];voided:boolean;
}>;
export type BasicCarePacket=Readonly<{
 schemaVersion:'1';action:'create'|'revise';requestId:string;tenantId:string;clientId:string;actorId:string;
 expectedHeadId:string|null;expectedRevision:number;entry:BasicCareEntry;reason:string;original:BasicCareOriginal|null;
 pressureOriginals:Readonly<{markerId:string;assessmentIds:readonly string[];historyIds:readonly string[]}>|null;
 fallOriginals:Readonly<{reviewIds:readonly string[];eventIds:readonly string[];measureIds:readonly string[]}>|null;
}>;
export type BasicCareReviewAction='request'|'return'|'accept';
export type BasicCareReviewQualificationOriginal=Readonly<{
 id:string;employeeId:string;profileId:string;qualificationType:string;title:string;status:'valid'|'expires_soon';validUntil:string|null;
 verifiedAt:string;updatedAt:string;sourceFingerprint:string;documentId:string;documentFingerprint:string;
 scopeId:string;scopeKind:'basic_care_review';scopeFingerprint:string;employeeFingerprint:string;
}>;
export type BasicCareReviewHistoryItem=Readonly<{
 id:string;revision:number;previousId:string|null;requestId:string;kind:'review_request'|'review_return'|'review_acceptance';recordedAt:string;
 actorId:string;actorName:string;reason:string;requiredChange:string;rationale:string;
 careHeadId:string;careContentFingerprint:string;qualificationOriginal:BasicCareReviewQualificationOriginal|null;contentFingerprint:string;
}>;
export type BasicCareReviewOriginal=Readonly<{
 id:string;tenantId:string;clientId:string;rootId:string;headId:string;revision:number;careRootId:string;careHeadId:string;
 careContentFingerprint:string;status:'requested'|'returned'|'accepted';history:readonly BasicCareReviewHistoryItem[];
}>;
export type BasicCareReviewPacket=Readonly<{
 schemaVersion:'1';action:BasicCareReviewAction;requestId:string;tenantId:string;clientId:string;actorId:string;occurredAt:string;
 expectedReviewHeadId:string|null;expectedReviewRevision:number;careOriginal:BasicCareOriginal;reviewOriginal:BasicCareReviewOriginal|null;
 reason:string;requiredChange:string;rationale:string;
}>;

const kinds=new Set<BasicCareKind>(['body_care','oral_care','dressing','transfer_positioning','pressure_prevention','fall_prevention','contracture_prevention','individual_prevention']);
const uuid=(value:unknown):value is string=>typeof value==='string'&&value.length===36&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
const instant=(value:unknown):value is string=>basicCareInstantMicros(value)!==null;
const text=(value:unknown,min=0,max=8000):value is string=>typeof value==='string'&&value.trim().length>=min&&value.length<=max;
const sha=(value:unknown):value is string=>typeof value==='string'&&value.length===71&&/^sha256:[0-9a-f]{64}$/.test(value);
const uniqueUuids=(values:unknown):values is readonly string[]=>Array.isArray(values)&&values.length<=50&&values.every(uuid)&&new Set(values.map(value=>value.toLowerCase())).size===values.length;
const uniqueText=(values:unknown):values is readonly string[]=>Array.isArray(values)&&values.length<=50&&values.every(value=>text(value,1,1000))&&new Set(values).size===values.length;
const clone=<T>(value:T):T=>cloneClientNativeOriginal(value);
const exact=(value:unknown,keys:readonly string[]):boolean=>!!value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).length===keys.length&&keys.every(key=>Object.hasOwn(value,key));
const entryKeys=['kind','title','plannedAt','occurredAt','planVersionId','measureId','visitId','planSnapshotSha256','consent','assistance','observation','execution','prevention','followUp','lifecycle'] as const;
const originalKeys=['id','tenantId','clientId','rootId','headId','revision','kind','recordedAt','recordedBy','recordedByName','payload','contentFingerprint','history','voided'] as const;
const historyKeys=['id','revision','previousId','recordedAt','recordedBy','recordedByName','reason','payload','contentFingerprint'] as const;
const packetKeys=['schemaVersion','action','requestId','tenantId','clientId','actorId','expectedHeadId','expectedRevision','entry','reason','original','pressureOriginals','fallOriginals'] as const;
const reviewOriginalKeys=['id','tenantId','clientId','rootId','headId','revision','careRootId','careHeadId','careContentFingerprint','status','history'] as const;
const reviewHistoryKeys=['id','revision','previousId','requestId','kind','recordedAt','actorId','actorName','reason','requiredChange','rationale','careHeadId','careContentFingerprint','qualificationOriginal','contentFingerprint'] as const;
const reviewPacketKeys=['schemaVersion','action','requestId','tenantId','clientId','actorId','occurredAt','expectedReviewHeadId','expectedReviewRevision','careOriginal','reviewOriginal','reason','requiredChange','rationale'] as const;
const qualificationKeys=['id','employeeId','profileId','qualificationType','title','status','validUntil','verifiedAt','updatedAt','sourceFingerprint','documentId','documentFingerprint','scopeId','scopeKind','scopeFingerprint','employeeFingerprint'] as const;
const bindingKeys=['kind','title','plannedAt','planVersionId','measureId','visitId','planSnapshotSha256'] as const;
const sameBinding=(left:BasicCareEntry,right:BasicCareEntry)=>bindingKeys.every(key=>left[key]===right[key])&&left.assistance.secondPersonRequired===right.assistance.secondPersonRequired;
function scopeIssue(value:unknown):boolean{
 if(!value||typeof value!=='object')return true;
 return ['tenantId','clientId'].some(key=>{const d=Object.getOwnPropertyDescriptor(value,key);return !d||!('value'in d)||!uuid(d.value);});
}
function contextField(value:object,key:string):unknown{const d=Object.getOwnPropertyDescriptor(value,key);if(!d)return undefined;if(!('value'in d))throw Error('Ungeklärter Pflegekontext.');return d.value;}

/** Preserve real PostgreSQL microseconds instead of rounding through Date milliseconds. */
export function basicCareInstantMicros(value:unknown):bigint|null{
 if(typeof value!=='string')return null;
 const m=/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,6}))?(Z|[+-]\d{2}:?\d{2})$/.exec(value);
 if(!m||m[0]!==value||Number(m[1])<1000||Number(m[4])>23||Number(m[5])>59||Number(m[6])>59)return null;
 const day=`${m[1]}-${m[2]}-${m[3]}`,date=Date.parse(`${day}T00:00:00Z`);
 if(!Number.isFinite(date)||new Date(date).toISOString().slice(0,10)!==day)return null;
 if(m[8]!=='Z'){const offset=m[8].replace(':',''),h=Number(offset.slice(1,3)),minute=Number(offset.slice(3));if(h>14||minute>59||h===14&&minute!==0)return null;}
 const whole=Date.parse(`${day}T${m[4]}:${m[5]}:${m[6]}${m[8]}`);
 return Number.isFinite(whole)?BigInt(whole)*1000n+BigInt((m[7]??'').padEnd(6,'0')):null;
}

export function blankBasicCareEntry(kind:BasicCareKind,now=new Date().toISOString()):BasicCareEntry{
 return {kind,title:'',plannedAt:now,occurredAt:null,planVersionId:'',measureId:'',visitId:'',planSnapshotSha256:'',
  consent:{state:'not_asked',recordedAt:null,statedReason:'',consultation:''},
  assistance:{level:'independent',secondPersonRequired:false,helpers:[],aids:[],technique:''},
  observation:{baseline:'',skin:'',mobility:'',oral:'',tolerance:'',oralAbnormality:false,skinChange:false},
  execution:{outcome:'planned',bodyScope:kind==='body_care'?'partial':'not_applicable',performedBy:[],interventions:[],result:'',deviation:''},
  prevention:{risk:'',professionalBasis:'',individualMeasure:'',reviewAt:null,fallOccurred:false,incidentId:null,reassessmentId:null},
  followUp:{required:false,reason:'',responsibleProfileId:null,dueAt:null,taskId:null,state:'not_required',closureEvidence:''},lifecycle:'open'};
}

export function basicCareEntryIssue(value:unknown):string|null{
 try{
 const entry=clone(value) as BasicCareEntry;
 if(!exact(entry,entryKeys)||!kinds.has(entry.kind)||!text(entry.title,3,300)||!instant(entry.plannedAt)||!uuid(entry.planVersionId)||!uuid(entry.measureId)||!uuid(entry.visitId)||!sha(entry.planSnapshotSha256))return 'Planfassung, Maßnahme, Einsatz, Zeitpunkt und unveränderter Plansnapshot fehlen.';
 if(!exact(entry.consent,['state','recordedAt','statedReason','consultation'])||!exact(entry.assistance,['level','secondPersonRequired','helpers','aids','technique'])||!exact(entry.observation,['baseline','skin','mobility','oral','tolerance','oralAbnormality','skinChange'])||!exact(entry.execution,['outcome','bodyScope','performedBy','interventions','result','deviation'])||!exact(entry.prevention,['risk','professionalBasis','individualMeasure','reviewAt','fallOccurred','incidentId','reassessmentId'])||!exact(entry.followUp,['required','reason','responsibleProfileId','dueAt','taskId','state','closureEvidence']))return 'Grundpflegepaket enthält ungeklärte oder fehlende Originalfelder.';
 const actual=!['planned'].includes(entry.execution?.outcome);
 if(!entry.execution||!['planned','offered','performed','partial','refused','not_performed'].includes(entry.execution.outcome)||!entry.consent||!entry.assistance||!entry.observation||!entry.prevention||!entry.followUp)return 'Grundpflegepaket ist unvollständig.';
 if([entry.assistance.secondPersonRequired,entry.observation.oralAbnormality,entry.observation.skinChange,entry.prevention.fallOccurred,entry.followUp.required].some(value=>typeof value!=='boolean')||!['not_required','open','closed'].includes(entry.followUp.state))return 'Ausdrückliche Beobachtungs-, Hilfe- und Folgezustände fehlen.';
 if(!text(entry.consent.statedReason,0,2000)||!text(entry.consent.consultation,0,4000)||!text(entry.execution.result,0,8000)||!text(entry.execution.deviation,0,4000)||!text(entry.followUp.reason)||!text(entry.followUp.closureEvidence)||!['baseline','skin','mobility','oral','tolerance'].every(key=>text(entry.observation[key as keyof BasicCareEntry['observation']],0,4000))||!['risk','professionalBasis','individualMeasure'].every(key=>text(entry.prevention[key as keyof BasicCareEntry['prevention']])))return 'Vollständige unveränderte Pflegebeobachtung und Erzählung fehlen.';
 if(entry.prevention.reviewAt!==null&&!instant(entry.prevention.reviewAt)||entry.prevention.incidentId!==null&&!uuid(entry.prevention.incidentId)||entry.prevention.reassessmentId!==null&&!uuid(entry.prevention.reassessmentId))return 'Präventionszeitpunkt oder Originalverweise sind ungültig.';
 if(actual?!instant(entry.occurredAt):entry.occurredAt!==null)return 'Planzeit und tatsächliches Ereignis müssen getrennt bleiben.';
 if(!['not_asked','consented','refused','withdrawn'].includes(entry.consent.state)||entry.consent.recordedAt!==null&&!instant(entry.consent.recordedAt))return 'Einwilligungsstand und Zeitpunkt sind ungültig.';
 if(['performed','partial'].includes(entry.execution.outcome)){
  if(entry.consent.state!=='consented'||!instant(entry.consent.recordedAt)||basicCareInstantMicros(entry.consent.recordedAt)!>basicCareInstantMicros(entry.occurredAt)!||!uniqueUuids(entry.execution.performedBy)||entry.execution.performedBy.length<1||!uniqueText(entry.execution.interventions)||entry.execution.interventions.length<1||!text(entry.execution.result,1))return 'Tatsächliche Durchführung benötigt aktuelle Einwilligung, ausführende Personen, konkrete Maßnahmen und Ergebnis.';
 }else if(entry.execution.performedBy.length||entry.execution.interventions.length||text(entry.execution.result,1))return 'Planung, Angebot, Ablehnung oder Nichtdurchführung dürfen keine tatsächliche Durchführung enthalten.';
 if(entry.execution.outcome==='refused'){
  if(entry.consent.state!=='refused'||!text(entry.consent.statedReason,1,2000)||!text(entry.consent.consultation,3,4000)||!entry.followUp.required)return 'Ablehnung benötigt geäußerten Grund, Beratung und ein offenes weiteres Vorgehen.';
 }else if(entry.consent.state==='refused')return 'Ablehnung und Leistungsstatus widersprechen sich.';
 if(['partial','not_performed'].includes(entry.execution.outcome)&&!text(entry.execution.deviation,3,4000))return 'Teil- oder Nichtdurchführung benötigt eine konkrete Abweichung.';
 if(!['independent','prompting','partial_assist','full_assist','two_person_assist'].includes(entry.assistance.level)||!uniqueUuids(entry.assistance.helpers)||!uniqueText(entry.assistance.aids)||!text(entry.assistance.technique,entry.assistance.level==='independent'?0:3,4000))return 'Hilfebedarf, Hilfsmittel und Technik sind nicht vollständig.';
 if(entry.assistance.secondPersonRequired!== (entry.assistance.level==='two_person_assist'))return 'Erforderliche zweite Person und Hilfeumfang widersprechen sich.';
 if(entry.assistance.secondPersonRequired&&(['planned','offered'].includes(entry.execution.outcome)?entry.assistance.helpers.length<2:entry.execution.performedBy.length<2))return 'Die erforderliche zweite Person muss vor Planung und bei Durchführung mit zwei verschiedenen Personen belegt sein.';
 if(entry.kind==='body_care'&&!['partial','full'].includes(entry.execution.bodyScope))return 'Körperpflege muss Teil- und Ganzkörperpflege unterscheiden.';
 if(entry.kind!=='body_care'&&entry.execution.bodyScope!=='not_applicable')return 'Körperumfang gehört nur zur Körperpflege.';
 if(entry.kind==='oral_care'&&(!text(entry.observation.oral,1,4000)||entry.observation.oralAbnormality&&(!entry.followUp.required||!text(entry.followUp.reason,3))))return 'Mund-/Zahnpflege benötigt Befund; Auffälligkeiten benötigen Reaktion und Weitergabe.';
 if(entry.kind==='pressure_prevention'&&(!text(entry.prevention.risk,1)||!text(entry.prevention.professionalBasis,3)||!text(entry.prevention.individualMeasure,3)||entry.observation.skinChange&&(!entry.followUp.required||!entry.prevention.reviewAt)))return 'Dekubitusprävention benötigt individuelles Risiko, Grundlage, Maßnahme und bei Hautveränderung eine Überprüfung.';
 if(entry.kind==='fall_prevention'&&(!text(entry.prevention.risk,1)||!text(entry.prevention.professionalBasis,3)||!text(entry.prevention.individualMeasure,3)||entry.prevention.fallOccurred&&(!uuid(entry.prevention.incidentId)||!uuid(entry.prevention.reassessmentId)||!entry.followUp.required||!uuid(entry.followUp.taskId))))return 'Sturzereignis muss mit Plan, tatsächlicher Neubewertung und Folgeauftrag verknüpft sein.';
 if(entry.kind==='contracture_prevention'&&(['performed','partial'].includes(entry.execution.outcome)&&(!text(entry.observation.mobility,1)||!text(entry.observation.tolerance,1)||!entry.execution.interventions.some(item=>/anleit|beweg|aktiv/i.test(item)))))return 'Kontrakturprävention muss tatsächliche Anleitung/Unterstützung und Verträglichkeit zeigen.';
 if(entry.kind==='individual_prevention'&&(!text(entry.prevention.risk,3)||!text(entry.prevention.professionalBasis,10)||!text(entry.prevention.individualMeasure,10)))return 'Individuelle Prophylaxe benötigt Risikolage, konkrete fachliche Grundlage und individuelle Maßnahme.';
 if(entry.followUp.required){if(entry.followUp.state==='not_required'||!text(entry.followUp.reason,3)||!uuid(entry.followUp.responsibleProfileId)||!instant(entry.followUp.dueAt)||entry.followUp.state==='closed'&&(!uuid(entry.followUp.taskId)||!text(entry.followUp.closureEvidence,3)))return 'Folgeauftrag benötigt Anlass, Verantwortung, Frist und bei Abschluss den unveränderten Beleg.';}
 else if(entry.followUp.state!=='not_required'||entry.followUp.reason||entry.followUp.responsibleProfileId||entry.followUp.dueAt||entry.followUp.taskId||entry.followUp.closureEvidence)return 'Ohne Folgeauftrag dürfen keine erfundenen Folgebelege gespeichert werden.';
 if(entry.lifecycle==='completed'&&(['planned','offered'].includes(entry.execution.outcome)||entry.followUp.required&&entry.followUp.state!=='closed'))return 'Abschluss ist erst nach tatsächlichem Ergebnis und abgeschlossenen Folgeaufträgen möglich.';
 return ['open','completed'].includes(entry.lifecycle)?null:'Lebenszyklusstatus ist ungültig.';
 }catch{return 'Ungeklärtes Grundpflegeoriginal oder nicht verlustfrei prüfbares Datenformat.';}
}

export function basicCareOriginalIssue(value:unknown,context:{tenantId:string;clientId:string}):string|null{
 try{
 const original=clone(value) as BasicCareOriginal;
 if(scopeIssue(context)||!exact(original,originalKeys)||![original.id,original.rootId,original.headId,original.recordedBy].every(uuid)||original.tenantId!==contextField(context,'tenantId')||original.clientId!==contextField(context,'clientId')||!Number.isSafeInteger(original.revision)||original.revision<1||original.revision>2000||!kinds.has(original.kind)||!instant(original.recordedAt)||!text(original.recordedByName,1,500)||!sha(original.contentFingerprint)||!Array.isArray(original.history)||original.history.length!==original.revision||typeof original.voided!=='boolean'||basicCareEntryIssue(original.payload))return 'Vollständiges Grundpflegeoriginal fehlt.';
 const ids=new Set<string>();let previous:bigint|null=null;
 for(let index=0;index<original.history.length;index++){
  const item=original.history[index],at=basicCareInstantMicros(item?.recordedAt);
  if(!exact(item,historyKeys)||!uuid(item.id)||ids.has(item.id.toLowerCase())||item.revision!==index+1||(index?item.previousId!==original.history[index-1].id:item.previousId!==null)||at===null||previous!==null&&at<previous||!uuid(item.recordedBy)||!text(item.recordedByName,1,500)||!text(item.reason,index?10:0,2000)||!sha(item.contentFingerprint)||basicCareEntryIssue(item.payload)||item.payload.kind!==original.kind||!sameBinding(item.payload,original.history[0].payload))return 'Grundpflegehistorie ist abgeschnitten oder widersprüchlich.';
  if(item.payload.occurredAt!==null&&basicCareInstantMicros(item.payload.occurredAt)!>at||item.payload.consent.recordedAt!==null&&basicCareInstantMicros(item.payload.consent.recordedAt)!>at)return 'Original wurde vor seinem tatsächlichen Ereignis oder Einwilligungsbeleg erfasst.';
  ids.add(item.id.toLowerCase());previous=at;
 }
 const head=original.history.at(-1)!;
 if(original.kind!==original.payload.kind||original.history[0].id!==original.rootId||head.id!==original.headId||original.id!==original.headId||head.revision!==original.revision||head.recordedAt!==original.recordedAt||head.recordedBy!==original.recordedBy||head.recordedByName!==original.recordedByName||head.contentFingerprint!==original.contentFingerprint||!sameClientNativeOriginal(head.payload,original.payload))return 'Grundpflegekopf stimmt nicht mit der vollständigen Historie überein.';
 return null;
 }catch{return 'Ungeklärtes Grundpflegeoriginal oder nicht verlustfrei prüfbares Datenformat.';}
}

function referenceIssue(packet:BasicCarePacket):string|null{
 if(packet.entry.kind==='pressure_prevention')return !exact(packet.pressureOriginals,['markerId','assessmentIds','historyIds'])||!uuid(packet.pressureOriginals!.markerId)||!uniqueUuids(packet.pressureOriginals!.assessmentIds)||!uniqueUuids(packet.pressureOriginals!.historyIds)||packet.fallOriginals!==null?'Dekubitusprävention benötigt die vollständig gelesenen nativen Originalreferenzen.':null;
 if(packet.pressureOriginals!==null)return 'Dekubitusoriginale gehören nur zur Dekubitusprävention.';
 if(packet.entry.kind==='fall_prevention')return !exact(packet.fallOriginals,['reviewIds','eventIds','measureIds'])||!uniqueUuids(packet.fallOriginals!.reviewIds)||!uniqueUuids(packet.fallOriginals!.eventIds)||!uniqueUuids(packet.fallOriginals!.measureIds)?'Sturzprävention benötigt die vollständig gelesenen nativen Originalreferenzen.':null;
 return packet.fallOriginals!==null?'Sturzoriginale gehören nur zur Sturzprävention.':null;
}

export function basicCarePacketIssue(value:unknown):string|null{
 try{
 const packet=clone(value) as BasicCarePacket;
 if(!exact(packet,packetKeys)||packet.schemaVersion!=='1'||!['create','revise'].includes(packet.action)||![packet.requestId,packet.tenantId,packet.clientId,packet.actorId].every(uuid)||!Number.isSafeInteger(packet.expectedRevision)||packet.expectedRevision<0||packet.expectedRevision>=2000||!text(packet.reason,0,2000)||basicCareEntryIssue(packet.entry))return 'Grundpflegeanfrage ist nicht vollständig gebunden.';
 const refs=referenceIssue(packet);if(refs)return refs;
 if(packet.action==='create')return packet.expectedHeadId!==null||packet.expectedRevision!==0||packet.original!==null||packet.reason?'Neue Grundpflege darf kein erfundenes Original enthalten.':null;
 if(!packet.original||basicCareOriginalIssue(packet.original,{tenantId:packet.tenantId,clientId:packet.clientId})||packet.expectedHeadId!==packet.original.headId||packet.expectedRevision!==packet.original.revision||packet.original.voided||!sameBinding(packet.entry,packet.original.payload)||!text(packet.reason,10,2000)||sameClientNativeOriginal(packet.entry,packet.original.payload))return 'Fortschreibung benötigt vollständiges aktuelles Original, konkreten Grund und eine wirkliche Änderung.';
 return null;
 }catch{return 'Ungeklärtes Grundpflegeoriginal oder nicht verlustfrei prüfbares Datenformat.';}
}

export function makeBasicCarePacket(input:Omit<BasicCarePacket,'schemaVersion'>):BasicCarePacket{
 const captured=clone(input),packet={schemaVersion:'1' as const,...captured};const issue=basicCarePacketIssue(packet);if(issue)throw Error(issue);return freezeClientNativeOriginal(packet);
}

const date=(value:unknown):value is string=>typeof value==='string'&&value.length===10&&basicCareInstantMicros(`${value}T00:00:00Z`)!==null;
const berlinDate=(at:string)=>{const micros=basicCareInstantMicros(at)!;return new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Berlin',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(Number(micros>=0n?micros/1000n:(micros-999n)/1000n)));};
function qualificationIssue(value:unknown,actorId:string,recordedAt:string):string|null{
 const q=value as BasicCareReviewQualificationOriginal;
 if(!exact(q,qualificationKeys)||![q.id,q.employeeId,q.profileId,q.documentId,q.scopeId].every(uuid)||q.profileId!==actorId||q.scopeKind!=='basic_care_review'||!text(q.qualificationType,1,200)||!text(q.title,1,500)||!['valid','expires_soon'].includes(q.status)||!(q.validUntil===null||date(q.validUntil))||!instant(q.verifiedAt)||!instant(q.updatedAt)||![q.sourceFingerprint,q.documentFingerprint,q.scopeFingerprint,q.employeeFingerprint].every(sha))return 'Aktuelles verifiziertes Qualifikations-, Beschäftigungs-, Dokument- und Prüfbereichsoriginal fehlt.';
 const at=basicCareInstantMicros(recordedAt)!;
 if(basicCareInstantMicros(q.verifiedAt)!>at||basicCareInstantMicros(q.updatedAt)!>at)return 'Qualifikationsoriginal war zum tatsächlichen Prüfzeitpunkt nicht bestätigt.';
 return q.validUntil!==null&&q.validUntil<berlinDate(recordedAt)?'Qualifikationsoriginal ist am Prüfzeitpunkt abgelaufen.':null;
}
function reviewItemIssue(item:BasicCareReviewHistoryItem,index:number,previous:BasicCareReviewHistoryItem|null,careHeadId:string,careFingerprint:string):string|null{
 if(!exact(item,reviewHistoryKeys)||![item.id,item.requestId,item.actorId,item.careHeadId].every(uuid)||item.revision!==index+1||item.previousId!==(previous?.id??null)||item.careHeadId!==careHeadId||item.careContentFingerprint!==careFingerprint||!instant(item.recordedAt)||previous!==null&&basicCareInstantMicros(item.recordedAt)!<basicCareInstantMicros(previous.recordedAt)!||!text(item.actorName,1,500)||!sha(item.contentFingerprint))return 'Prüfhistorie ist abgeschnitten oder nicht an dieselbe Grundpflegefassung gebunden.';
 if(item.kind==='review_request')return index!==0||!text(item.reason,10,2000)||item.requiredChange!==''||item.rationale!==''||item.qualificationOriginal!==null?'Prüfanfrage ist unvollständig.':null;
 if(index!==1||previous?.kind!=='review_request'||item.actorId.toLowerCase()===previous.actorId.toLowerCase())return 'Rückgabe oder Annahme benötigt genau eine vorangehende Anfrage und eine getrennte Person.';
 const q=qualificationIssue(item.qualificationOriginal,item.actorId,item.recordedAt);if(q)return q;
 if(item.kind==='review_return')return !text(item.reason,10,2000)||!text(item.requiredChange,10,4000)||item.rationale!==''?'Begründete Rückgabe ist unvollständig.':null;
 if(item.kind==='review_acceptance')return item.reason!==''||item.requiredChange!==''||!text(item.rationale,10,4000)?'Qualifizierte Annahme ist unvollständig.':null;
 return 'Unbekannte Prüfhandlung.';
}
export function basicCareReviewOriginalIssue(value:unknown,context:{tenantId:string;clientId:string;careRootId?:string;careHeadId?:string;careContentFingerprint?:string}):string|null{
 try{
 const original=clone(value) as BasicCareReviewOriginal;
 if(scopeIssue(context)||!exact(original,reviewOriginalKeys)||![original.id,original.rootId,original.headId,original.careRootId,original.careHeadId].every(uuid)||original.tenantId!==contextField(context,'tenantId')||original.clientId!==contextField(context,'clientId')||contextField(context,'careRootId')!==undefined&&original.careRootId!==contextField(context,'careRootId')||contextField(context,'careHeadId')!==undefined&&original.careHeadId!==contextField(context,'careHeadId')||contextField(context,'careContentFingerprint')!==undefined&&original.careContentFingerprint!==contextField(context,'careContentFingerprint')||!sha(original.careContentFingerprint)||!Number.isSafeInteger(original.revision)||original.revision<1||original.revision>2||!Array.isArray(original.history)||original.history.length!==original.revision)return 'Vollständiges Prüfungsoriginal fehlt.';
 let prior:BasicCareReviewHistoryItem|null=null;const ids=new Set<string>(),requests=new Set<string>();
 for(let index=0;index<original.history.length;index++){
  const item=original.history[index],issue=reviewItemIssue(item,index,prior,original.careHeadId,original.careContentFingerprint);if(issue)return issue;
  if(ids.has(item.id.toLowerCase())||requests.has(item.requestId.toLowerCase()))return 'Prüfhistorie enthält doppelte Ereignis- oder Anfragekennungen.';
  ids.add(item.id.toLowerCase());requests.add(item.requestId.toLowerCase());prior=item;
 }
 const last=original.history.at(-1);
 if(!last||original.history[0].id!==original.rootId||original.id!==original.headId||last.id!==original.headId||original.status!==(last.kind==='review_request'?'requested':last.kind==='review_return'?'returned':'accepted'))return 'Prüfkopf und vollständige Historie widersprechen sich.';
 return null;
 }catch{return 'Ungeklärtes Grundpflegeoriginal oder nicht verlustfrei prüfbares Datenformat.';}
}
export function basicCareReviewPacketIssue(value:unknown):string|null{
 try{
 const packet=clone(value) as BasicCareReviewPacket;
 if(!exact(packet,reviewPacketKeys)||packet.schemaVersion!=='1'||!['request','return','accept'].includes(packet.action)||![packet.requestId,packet.tenantId,packet.clientId,packet.actorId].every(uuid)||!instant(packet.occurredAt)||!Number.isSafeInteger(packet.expectedReviewRevision)||packet.expectedReviewRevision<0||packet.expectedReviewRevision>1)return 'Prüfanfrage ist nicht vollständig gebunden.';
 const careIssue=basicCareOriginalIssue(packet.careOriginal,{tenantId:packet.tenantId,clientId:packet.clientId});if(careIssue)return careIssue;
 const care=packet.careOriginal;
 if(care.voided||care.payload.lifecycle!=='completed'||['planned','offered'].includes(care.payload.execution.outcome))return 'Eine Planung, offene oder aufgehobene Pflegefassung belegt keine abgeschlossene tatsächliche Versorgung.';
 const careAt=basicCareInstantMicros(care.recordedAt)!,occurredAt=basicCareInstantMicros(packet.occurredAt)!;
 if(occurredAt<careAt)return 'Prüfzeit muss nach der unveränderten Pflegefassung liegen.';
 const participants=new Set(care.history.flatMap(item=>[item.recordedBy,...item.payload.assistance.helpers,...item.payload.execution.performedBy,...(item.payload.followUp.responsibleProfileId?[item.payload.followUp.responsibleProfileId]:[]) ]).map(person=>person.toLowerCase()));
 if(packet.action==='request')return packet.expectedReviewHeadId!==null||packet.expectedReviewRevision!==0||packet.reviewOriginal!==null||!text(packet.reason,10,2000)||packet.requiredChange!==''||packet.rationale!==''?'Neue Prüfanfrage darf keine Entscheidung oder erfundene Prüfhistorie enthalten.':null;
 if(!packet.reviewOriginal||basicCareReviewOriginalIssue(packet.reviewOriginal,{tenantId:packet.tenantId,clientId:packet.clientId,careRootId:packet.careOriginal.rootId,careHeadId:packet.careOriginal.headId,careContentFingerprint:packet.careOriginal.contentFingerprint})||packet.expectedReviewHeadId!==packet.reviewOriginal.headId||packet.expectedReviewRevision!==packet.reviewOriginal.revision||packet.reviewOriginal.status!=='requested')return 'Rückgabe oder Annahme benötigt die aktuelle unveränderte Prüfanfrage.';
 const requester=packet.reviewOriginal.history[0].actorId;if(packet.actorId.toLowerCase()===requester.toLowerCase()||participants.has(packet.actorId.toLowerCase()))return 'Anfragende oder an der Pflegefassung beteiligte Personen dürfen dieselbe Fassung nicht selbst prüfen.';
 if(occurredAt<basicCareInstantMicros(packet.reviewOriginal.history.at(-1)!.recordedAt)!)return 'Prüfzeit liegt vor der unveränderten Prüfanfrage.';
 if(packet.action==='return')return !text(packet.reason,10,2000)||!text(packet.requiredChange,10,4000)||packet.rationale!==''?'Begründete Rückgabe benötigt Grund und konkrete Änderung.':null;
 return packet.reason!==''||packet.requiredChange!==''||!text(packet.rationale,10,4000)?'Qualifizierte Annahme benötigt eine konkrete Begründung.':null;
 }catch{return 'Ungeklärtes Grundpflegeoriginal oder nicht verlustfrei prüfbares Datenformat.';}
}
export function makeBasicCareReviewPacket(input:Omit<BasicCareReviewPacket,'schemaVersion'>):BasicCareReviewPacket{
 const captured=clone(input),packet={schemaVersion:'1' as const,...captured};const issue=basicCareReviewPacketIssue(packet);if(issue)throw Error(issue);return freezeClientNativeOriginal(packet);
}

/** Confirm only this exact immutable request, including the complete previous history. */
export function basicCareReceiptIssue(value:unknown,packet:BasicCarePacket):string|null{
 const mismatch='Grundpflegequittung bestätigt nicht die eigene unveränderte Anfrage.';
 try{
  const p=clone(packet),v=clone(value) as Record<string,unknown>;
  if(basicCarePacketIssue(p)||!v||typeof v!=='object'||Array.isArray(v)||Object.keys(v).sort().join(',')!=='original,packet,requestId'||v.requestId!==p.requestId||!sameClientNativeOriginal(v.packet,p)||basicCareOriginalIssue(v.original,p))return mismatch;
  const o=v.original as BasicCareOriginal,last=o.history.at(-1)!;
  if(o.voided||o.revision!==p.expectedRevision+1||last.previousId!==p.expectedHeadId||last.recordedBy!==p.actorId||last.reason!==p.reason||!sameClientNativeOriginal(last.payload,p.entry))return mismatch;
  if(p.original){if(o.rootId!==p.original.rootId||!sameClientNativeOriginal(o.history.slice(0,-1),p.original.history))return mismatch;}else if(o.history.length!==1)return mismatch;
  return null;
 }catch{return mismatch;}
}
export function basicCareReviewReceiptIssue(value:unknown,packet:BasicCareReviewPacket):string|null{
 const mismatch='Grundpflegeprüfquittung bestätigt nicht die eigene unveränderte Anfrage.';
 try{
  const p=clone(packet),v=clone(value) as Record<string,unknown>;
  if(basicCareReviewPacketIssue(p)||!v||typeof v!=='object'||Array.isArray(v)||Object.keys(v).sort().join(',')!=='original,packet,requestId'||v.requestId!==p.requestId||!sameClientNativeOriginal(v.packet,p)||basicCareReviewOriginalIssue(v.original,{...p,careRootId:p.careOriginal.rootId,careHeadId:p.careOriginal.headId,careContentFingerprint:p.careOriginal.contentFingerprint}))return mismatch;
  const o=v.original as BasicCareReviewOriginal,last=o.history.at(-1)!,kind=p.action==='request'?'review_request':p.action==='return'?'review_return':'review_acceptance';
  if(o.revision!==p.expectedReviewRevision+1||last.previousId!==p.expectedReviewHeadId||last.requestId!==p.requestId||last.actorId!==p.actorId||last.kind!==kind||last.reason!==p.reason||last.requiredChange!==p.requiredChange||last.rationale!==p.rationale||basicCareInstantMicros(last.recordedAt)!<basicCareInstantMicros(p.occurredAt)!)return mismatch;
  if(p.reviewOriginal){if(o.rootId!==p.reviewOriginal.rootId||!sameClientNativeOriginal(o.history.slice(0,-1),p.reviewOriginal.history))return mismatch;}else if(o.history.length!==1)return mismatch;
  return null;
 }catch{return mismatch;}
}
