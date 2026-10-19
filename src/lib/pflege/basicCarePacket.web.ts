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
 id:string;employeeId:string;qualificationType:string;title:string;status:'valid'|'expires_soon';validUntil:string|null;
 verifiedAt:string;updatedAt:string;sourceFingerprint:string;
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
const uuid=(value:unknown):value is string=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
const instant=(value:unknown):value is string=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:?\d{2})$/.test(value)&&Number.isFinite(Date.parse(value));
const text=(value:unknown,min=0,max=8000):value is string=>typeof value==='string'&&value.trim().length>=min&&value.length<=max;
const sha=(value:unknown):value is string=>typeof value==='string'&&/^sha256:[0-9a-f]{64}$/.test(value);
const uniqueUuids=(values:unknown):values is readonly string[]=>Array.isArray(values)&&values.every(uuid)&&new Set(values).size===values.length;
const uniqueText=(values:unknown):values is readonly string[]=>Array.isArray(values)&&values.length<=50&&values.every(value=>text(value,1,1000))&&new Set(values).size===values.length;
const clone=<T>(value:T):T=>structuredClone(value);

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
 const entry=value as BasicCareEntry;
 if(!entry||typeof entry!=='object'||!kinds.has(entry.kind)||!text(entry.title,3,300)||!instant(entry.plannedAt)||!uuid(entry.planVersionId)||!uuid(entry.measureId)||!uuid(entry.visitId)||!sha(entry.planSnapshotSha256))return 'Planfassung, Maßnahme, Einsatz, Zeitpunkt und unveränderter Plansnapshot fehlen.';
 const actual=!['planned'].includes(entry.execution?.outcome);
 if(!entry.execution||!['planned','offered','performed','partial','refused','not_performed'].includes(entry.execution.outcome)||!entry.consent||!entry.assistance||!entry.observation||!entry.prevention||!entry.followUp)return 'Grundpflegepaket ist unvollständig.';
 if(actual?!instant(entry.occurredAt):entry.occurredAt!==null)return 'Planzeit und tatsächliches Ereignis müssen getrennt bleiben.';
 if(!['not_asked','consented','refused','withdrawn'].includes(entry.consent.state)||entry.consent.recordedAt!==null&&!instant(entry.consent.recordedAt))return 'Einwilligungsstand und Zeitpunkt sind ungültig.';
 if(['performed','partial'].includes(entry.execution.outcome)){
  if(entry.consent.state!=='consented'||!uniqueUuids(entry.execution.performedBy)||entry.execution.performedBy.length<1||!uniqueText(entry.execution.interventions)||entry.execution.interventions.length<1||!text(entry.execution.result,1))return 'Tatsächliche Durchführung benötigt aktuelle Einwilligung, ausführende Personen, konkrete Maßnahmen und Ergebnis.';
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
}

export function basicCareOriginalIssue(value:unknown,context:{tenantId:string;clientId:string}):string|null{
 const original=value as BasicCareOriginal;
 if(!original||![original.id,original.rootId,original.headId,original.recordedBy].every(uuid)||original.tenantId!==context.tenantId||original.clientId!==context.clientId||!Number.isSafeInteger(original.revision)||original.revision<1||!kinds.has(original.kind)||!instant(original.recordedAt)||!text(original.recordedByName,1,500)||!sha(original.contentFingerprint)||!Array.isArray(original.history)||original.history.length!==original.revision||typeof original.voided!=='boolean'||basicCareEntryIssue(original.payload))return 'Vollständiges Grundpflegeoriginal fehlt.';
 const ids=new Set<string>();for(let index=0;index<original.history.length;index++){const item=original.history[index];if(!item||!uuid(item.id)||ids.has(item.id)||item.revision!==index+1||(index?item.previousId!==original.history[index-1].id:item.previousId!==null)||!instant(item.recordedAt)||!uuid(item.recordedBy)||!text(item.recordedByName,1)||!text(item.reason,index?10:0,2000)||!sha(item.contentFingerprint)||basicCareEntryIssue(item.payload))return 'Grundpflegehistorie ist abgeschnitten oder widersprüchlich.';ids.add(item.id);}
 if(original.kind!==original.payload.kind||original.history[0].id!==original.rootId||original.history.at(-1)?.id!==original.headId||original.id!==original.headId||original.history.at(-1)?.contentFingerprint!==original.contentFingerprint)return 'Grundpflegekopf stimmt nicht mit der vollständigen Historie überein.';
 return null;
}

function referenceIssue(packet:BasicCarePacket):string|null{
 if(packet.entry.kind==='pressure_prevention')return !packet.pressureOriginals||!uuid(packet.pressureOriginals.markerId)||!uniqueUuids(packet.pressureOriginals.assessmentIds)||!uniqueUuids(packet.pressureOriginals.historyIds)?'Dekubitusprävention benötigt die vollständig gelesenen nativen Originalreferenzen.':null;
 if(packet.pressureOriginals!==null)return 'Dekubitusoriginale gehören nur zur Dekubitusprävention.';
 if(packet.entry.kind==='fall_prevention')return !packet.fallOriginals||!uniqueUuids(packet.fallOriginals.reviewIds)||!uniqueUuids(packet.fallOriginals.eventIds)||!uniqueUuids(packet.fallOriginals.measureIds)?'Sturzprävention benötigt die vollständig gelesenen nativen Originalreferenzen.':null;
 return packet.fallOriginals!==null?'Sturzoriginale gehören nur zur Sturzprävention.':null;
}

export function basicCarePacketIssue(value:unknown):string|null{
 const packet=value as BasicCarePacket;
 if(!packet||packet.schemaVersion!=='1'||!['create','revise'].includes(packet.action)||![packet.requestId,packet.tenantId,packet.clientId,packet.actorId].every(uuid)||!Number.isSafeInteger(packet.expectedRevision)||packet.expectedRevision<0||basicCareEntryIssue(packet.entry))return 'Grundpflegeanfrage ist nicht vollständig gebunden.';
 const refs=referenceIssue(packet);if(refs)return refs;
 if(packet.action==='create')return packet.expectedHeadId!==null||packet.expectedRevision!==0||packet.original!==null||packet.reason?'Neue Grundpflege darf kein erfundenes Original enthalten.':null;
 if(!packet.original||basicCareOriginalIssue(packet.original,{tenantId:packet.tenantId,clientId:packet.clientId})||packet.expectedHeadId!==packet.original.headId||packet.expectedRevision!==packet.original.revision||packet.entry.kind!==packet.original.kind||!text(packet.reason,10,2000)||JSON.stringify(packet.entry)===JSON.stringify(packet.original.payload))return 'Fortschreibung benötigt vollständiges aktuelles Original, konkreten Grund und eine wirkliche Änderung.';
 return null;
}

export function makeBasicCarePacket(input:Omit<BasicCarePacket,'schemaVersion'>):BasicCarePacket{
 const packet=clone({schemaVersion:'1' as const,...input});const issue=basicCarePacketIssue(packet);if(issue)throw Error(issue);return Object.freeze(packet);
}

const date=(value:unknown):value is string=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(`${value}T00:00:00Z`));
function qualificationIssue(value:unknown,recordedAt:string):string|null{
 const q=value as BasicCareReviewQualificationOriginal;
 if(!q||![q.id,q.employeeId].every(uuid)||!text(q.qualificationType,1,200)||!text(q.title,1,500)||!['valid','expires_soon'].includes(q.status)||!(q.validUntil===null||date(q.validUntil))||!instant(q.verifiedAt)||!instant(q.updatedAt)||!sha(q.sourceFingerprint))return 'Aktuelles verifiziertes Qualifikationsoriginal fehlt.';
 return q.validUntil!==null&&q.validUntil<recordedAt.slice(0,10)?'Qualifikationsoriginal ist am Prüfzeitpunkt abgelaufen.':null;
}
function reviewItemIssue(item:BasicCareReviewHistoryItem,index:number,previous:BasicCareReviewHistoryItem|null,careHeadId:string,careFingerprint:string):string|null{
 if(!item||![item.id,item.requestId,item.actorId,item.careHeadId].every(uuid)||item.revision!==index+1||item.previousId!==(previous?.id??null)||item.careHeadId!==careHeadId||item.careContentFingerprint!==careFingerprint||!instant(item.recordedAt)||!text(item.actorName,1,500)||!sha(item.contentFingerprint))return 'Prüfhistorie ist abgeschnitten oder nicht an dieselbe Grundpflegefassung gebunden.';
 if(item.kind==='review_request')return index!==0||!text(item.reason,10,2000)||item.requiredChange!==''||item.rationale!==''||item.qualificationOriginal!==null?'Prüfanfrage ist unvollständig.':null;
 if(index!==1||previous?.kind!=='review_request'||item.actorId===previous.actorId)return 'Rückgabe oder Annahme benötigt genau eine vorangehende Anfrage und eine getrennte Person.';
 const q=qualificationIssue(item.qualificationOriginal,item.recordedAt);if(q)return q;
 if(item.kind==='review_return')return !text(item.reason,10,2000)||!text(item.requiredChange,10,4000)||item.rationale!==''?'Begründete Rückgabe ist unvollständig.':null;
 if(item.kind==='review_acceptance')return item.reason!==''||item.requiredChange!==''||!text(item.rationale,10,4000)?'Qualifizierte Annahme ist unvollständig.':null;
 return 'Unbekannte Prüfhandlung.';
}
export function basicCareReviewOriginalIssue(value:unknown,context:{tenantId:string;clientId:string;careRootId?:string;careHeadId?:string;careContentFingerprint?:string}):string|null{
 const original=value as BasicCareReviewOriginal;
 if(!original||![original.id,original.rootId,original.headId,original.careRootId,original.careHeadId].every(uuid)||original.tenantId!==context.tenantId||original.clientId!==context.clientId||context.careRootId&&original.careRootId!==context.careRootId||context.careHeadId&&original.careHeadId!==context.careHeadId||context.careContentFingerprint&&original.careContentFingerprint!==context.careContentFingerprint||!sha(original.careContentFingerprint)||!Number.isSafeInteger(original.revision)||original.revision<1||original.revision>2||!Array.isArray(original.history)||original.history.length!==original.revision)return 'Vollständiges Prüfungsoriginal fehlt.';
 let prior:BasicCareReviewHistoryItem|null=null;for(let index=0;index<original.history.length;index++){const issue=reviewItemIssue(original.history[index],index,prior,original.careHeadId,original.careContentFingerprint);if(issue)return issue;prior=original.history[index];}
 const last=original.history.at(-1);if(!last||original.id!==original.headId||last.id!==original.headId||original.status!==(last.kind==='review_request'?'requested':last.kind==='review_return'?'returned':'accepted'))return 'Prüfkopf und vollständige Historie widersprechen sich.';
 return null;
}
export function basicCareReviewPacketIssue(value:unknown):string|null{
 const packet=value as BasicCareReviewPacket;
 if(!packet||packet.schemaVersion!=='1'||!['request','return','accept'].includes(packet.action)||![packet.requestId,packet.tenantId,packet.clientId,packet.actorId].every(uuid)||!instant(packet.occurredAt)||!Number.isSafeInteger(packet.expectedReviewRevision)||packet.expectedReviewRevision<0)return 'Prüfanfrage ist nicht vollständig gebunden.';
 const careIssue=basicCareOriginalIssue(packet.careOriginal,{tenantId:packet.tenantId,clientId:packet.clientId});if(careIssue)return careIssue;
 const performers=new Set(packet.careOriginal.history.flatMap(item=>item.payload.execution.performedBy));
 if(packet.action==='request')return packet.expectedReviewHeadId!==null||packet.expectedReviewRevision!==0||packet.reviewOriginal!==null||!text(packet.reason,10,2000)||packet.requiredChange!==''||packet.rationale!==''?'Neue Prüfanfrage darf keine Entscheidung oder erfundene Prüfhistorie enthalten.':null;
 if(!packet.reviewOriginal||basicCareReviewOriginalIssue(packet.reviewOriginal,{tenantId:packet.tenantId,clientId:packet.clientId,careRootId:packet.careOriginal.rootId,careHeadId:packet.careOriginal.headId,careContentFingerprint:packet.careOriginal.contentFingerprint})||packet.expectedReviewHeadId!==packet.reviewOriginal.headId||packet.expectedReviewRevision!==packet.reviewOriginal.revision||packet.reviewOriginal.status!=='requested')return 'Rückgabe oder Annahme benötigt die aktuelle unveränderte Prüfanfrage.';
 const requester=packet.reviewOriginal.history[0].actorId;if(packet.actorId===requester||performers.has(packet.actorId))return 'Anfragende oder tatsächlich ausführende Personen dürfen dieselbe Fassung nicht selbst prüfen.';
 if(packet.action==='return')return !text(packet.reason,10,2000)||!text(packet.requiredChange,10,4000)||packet.rationale!==''?'Begründete Rückgabe benötigt Grund und konkrete Änderung.':null;
 return packet.reason!==''||packet.requiredChange!==''||!text(packet.rationale,10,4000)?'Qualifizierte Annahme benötigt eine konkrete Begründung.':null;
}
export function makeBasicCareReviewPacket(input:Omit<BasicCareReviewPacket,'schemaVersion'>):BasicCareReviewPacket{
 const packet=clone({schemaVersion:'1' as const,...input});const issue=basicCareReviewPacketIssue(packet);if(issue)throw Error(issue);return Object.freeze(packet);
}
