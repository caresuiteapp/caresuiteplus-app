import {controlExact} from './clinicalControlShape.ts';
import {validateEvaluationMeasureScope,validateEvaluationControlSnapshot,assertEvaluationControlEvidence,assertEvaluationControlResult} from '../careAssessment/planEvaluationControl.ts';
import {validateProtocolControlSnapshot,assertProtocolControlEvidence} from './dailyProtocolControl.ts';
import {sameWoundJson,woundInstant,woundUuid} from './woundCareDomain.ts';
import {validateTreatmentSource} from './treatmentCorrectionDomain.ts';

export const clinicalControlVersion='2026-10-09.1';
type Row=Record<string,unknown>;
export type ControlSource={kind:string;id:string;snapshot:Row};
export type ControlPolicy={assigneeId:string;backupId:string;dueAt:string;priority:'routine'|'important'|'urgent';escalationAt:string;escalationRecipientId:string};
export type ControlDraft=
 | {kind:'create';occurredAt:string;title:string;reason:string;instruction:string;source:ControlSource;policy:ControlPolicy;evaluationMeasureId?:string}
 | {kind:'assign';occurredAt:string;assigneeId:string;backupId:string;escalationRecipientId:string;reason:string}
 | {kind:'reschedule';occurredAt:string;dueAt:string;escalationAt:string;reason:string}
 | {kind:'attempt';occurredAt:string;outcome:'partial';result:string;reason:string;communication:string;personDecision:string;qualificationBasis:string;evidence:ControlSource;overrideReason:string}
 | {kind:'resolve';occurredAt:string;outcome:'performed'|'omitted'|'refused'|'failed';result:string;reason:string;communication:string;personDecision:string;qualificationBasis:string;evidence:ControlSource|null;overrideReason:string;followUpTaskId:string;noFollowUpReason:string}
 | {kind:'cancel';occurredAt:string;reason:string;communication:string}
 | {kind:'reopen';occurredAt:string;reason:string;policy:ControlPolicy}
 | {kind:'escalate';occurredAt:string;policyEventId:string;recipientId:string;channel:'phone'|'in_person'|'secure_message';delivery:'sent'|'failed';message:string;response:string}
 | {kind:'acknowledge';occurredAt:string;escalationEventId:string;response:string;nextStep:string};
export type ControlTask={id:string;tenantId:string;clientId:string;version:string};
export type ControlEvent={id:string;taskId:string;tenantId:string;clientId:string;sequence:number;previousId:string;actorId:string;requestId:string;recordedAt:string;draft:ControlDraft};
export type ControlState={evaluationMeasureId:string;headId:string;sequence:number;title:string;reason:string;instruction:string;source:ControlSource;policy:ControlPolicy;policyEventId:string;status:'open'|'completed'|'not_fulfilled'|'cancelled';lastOutcome:string;lastOccurredAt:string;attempts:number;escalations:ControlEvent[];acknowledgements:ControlEvent[]};
const kinds=['infusion_event','treatment_execution','wound_assessment','medication_administration','vital_measurement','care_plan','pflege_report','protocol_event','plan_evaluation'];
export {controlExact} from './clinicalControlShape.ts';
const uuid=(v:unknown)=>woundUuid(v)&&v===v.toLowerCase();
function text(v:unknown,label:string,required=true,max=4000):asserts v is string{if(typeof v!=='string'||v.length>max||(required&&!v.trim()))throw Error(label+' fehlt oder ist ungültig.');}
function time(v:unknown,label:string,now:number,past=true):bigint{const t=woundInstant(v);if(t===null||!Number.isSafeInteger(now)||(past&&t>BigInt(now)*1000n))throw Error(label+' mit tatsächlicher Zeitzone prüfen.');return t;}
export function validateControlTask(v:unknown):asserts v is ControlTask{if(!controlExact(v,['id','tenantId','clientId','version'])||![v.id,v.tenantId,v.clientId].every(uuid)||v.version!==clinicalControlVersion)throw Error('Kontrollauftrag oder Aktenkontext ungültig.');}
export function validateControlSource(v:unknown,task:ControlTask):asserts v is ControlSource{
 if(!controlExact(v,['kind','id','snapshot'])||!kinds.includes(String(v.kind))||!uuid(v.id)||!v.snapshot||typeof v.snapshot!=='object'||Array.isArray(v.snapshot))throw Error('Originalbeleg ausdrücklich auswählen.');
 const s=v.snapshot as Row;if(s.id!==v.id||s.tenant_id!==task.tenantId||s.client_id!==task.clientId)throw Error('Originalbeleg gehört nicht zu dieser Akte.');
 if(v.kind==='protocol_event')validateProtocolControlSnapshot(s,task.tenantId,task.clientId);
 if(v.kind==='plan_evaluation')validateEvaluationControlSnapshot(s,task.tenantId,task.clientId);
 // JSON-only, bounded and independent of a mutable editor/cache object.
 try{assertJson(s);const json=JSON.stringify(s);if(json.length>120000||!sameWoundJson(JSON.parse(json),s))throw Error();}catch{throw Error('Originalbeleg ist nicht vollständig als JSON gesichert.');}
}
function assertJson(v:unknown,depth=0):void{
 if(depth>30)throw Error();
 if(v===null||typeof v==='string'||typeof v==='boolean'||(typeof v==='number'&&Number.isFinite(v)))return;
 if(Array.isArray(v)){for(let i=0;i<v.length;i++){if(!Object.hasOwn(v,i))throw Error();assertJson(v[i],depth+1);}return;}
 if(v&&typeof v==='object'&&Object.getPrototypeOf(v)===Object.prototype){for(const [k,x] of Object.entries(v)){if(['__proto__','constructor','prototype'].includes(k))throw Error();assertJson(x,depth+1);}return;}throw Error();
}
function controlEvidenceAt(source:ControlSource):unknown{return source.snapshot[source.kind==='treatment_execution'?'performed_at':'occurred_at'];}
function actualEvidence(source:ControlSource,task:ControlTask,at:string,now:number):void{
 validateControlSource(source,task);const s=source.snapshot as Record<string,unknown>;
 if(!['treatment_execution','medication_administration','vital_measurement','protocol_event','plan_evaluation'].includes(source.kind))throw Error('Diese Belegart ist noch nicht als tatsächlicher Ergebnisbeleg angebunden.');
 if(source.kind==='plan_evaluation')assertEvaluationControlEvidence(s,task.tenantId,task.clientId,now);
 if(source.kind==='protocol_event')assertProtocolControlEvidence(s,task.tenantId,task.clientId,now);
 if(source.kind==='treatment_execution')validateTreatmentSource(s);
 const occurred=time(controlEvidenceAt(source),'Original-Ergebniszeitpunkt',now);if(occurred>time(at,'Kontrollergebnis',now))throw Error('Ergebnisbeleg liegt nach der dokumentierten Kontrolle.');
 if(source.kind==='treatment_execution'&&!['performed','partial'].includes(String(s.outcome)))throw Error('Ausgebliebene Behandlung ist kein tatsächlicher Durchführungsbeleg.');
 if(source.kind==='medication_administration'&&!['administered','late'].includes(String(s.status)))throw Error('Ausgebliebene Gabe ist kein tatsächlicher Durchführungsbeleg.');
 if(source.kind==='vital_measurement'){text(s.display_value,'Tatsächlicher Messwert');text(s.unit,'Messeinheit');if(!s.values||typeof s.values!=='object'||Array.isArray(s.values)||!Object.keys(s.values).length)throw Error('Strukturierte Messwerte fehlen.');}
}
function policy(v:unknown,at:string,now:number):asserts v is ControlPolicy{
 if(!controlExact(v,['assigneeId','backupId','dueAt','priority','escalationAt','escalationRecipientId'])||!uuid(v.assigneeId)||!(v.backupId===''||uuid(v.backupId))||v.backupId===v.assigneeId||!uuid(v.escalationRecipientId)||!['routine','important','urgent'].includes(String(v.priority)))throw Error('Zuständigkeit, Vertretung, Priorität und Eskalationsperson ausdrücklich festlegen.');
 const due=time(v.dueAt,'Kontrollfrist',now,false),escalation=time(v.escalationAt,'Eskalationsfrist',now,false);if(due<time(at,'Auftragszeitpunkt',now)||escalation<due)throw Error('Kontrollfrist vor Auftrag oder Eskalation vor Fälligkeit.');
}
const keys:Record<string,string[]>={
 create:['title','reason','instruction','source','policy'],assign:['assigneeId','backupId','escalationRecipientId','reason'],reschedule:['dueAt','escalationAt','reason'],
 attempt:['outcome','result','reason','communication','personDecision','qualificationBasis','evidence','overrideReason'],
 resolve:['outcome','result','reason','communication','personDecision','qualificationBasis','evidence','overrideReason','followUpTaskId','noFollowUpReason'],cancel:['reason','communication'],reopen:['reason','policy'],
 escalate:['policyEventId','recipientId','channel','delivery','message','response'],acknowledge:['escalationEventId','response','nextStep']};
export function validateControlDraft(v:unknown,task:ControlTask,now=Date.now()):asserts v is ControlDraft{
 validateControlTask(task);if(!v||typeof v!=='object'||Array.isArray(v))throw Error('Kontrollereignis fehlt.');const d=v as Row,kind=String(d.kind);
 if(!Object.hasOwn(keys,kind)||!controlExact(d,['kind','occurredAt',...keys[kind],...(kind==='create'&&Object.hasOwn(d,'evaluationMeasureId')?['evaluationMeasureId']:[])]))throw Error('Kontrollereignis hat fehlende oder fremde Felder.');time(d.occurredAt,'Tatsächlicher Ereigniszeitpunkt',now);
 if(kind==='create'){for(const k of ['title','reason','instruction'])text(d[k],k);validateControlSource(d.source,task);if(Object.hasOwn(d,'evaluationMeasureId'))validateEvaluationMeasureScope(d.source,d.evaluationMeasureId,task.tenantId,task.clientId,now);if(['protocol_event','plan_evaluation'].includes(d.source.kind)&&time(d.source.snapshot.occurred_at,'Originalbeobachtung',now)>time(d.occurredAt,'Auftragszeitpunkt',now))throw Error('Originalbeobachtung liegt nach dem dokumentierten Auftrag.');policy(d.policy,String(d.occurredAt),now);}
 if(kind==='assign'){if(!uuid(d.assigneeId)||!(d.backupId===''||uuid(d.backupId))||d.assigneeId===d.backupId||!uuid(d.escalationRecipientId))throw Error('Zuständige Person und getrennte Vertretung prüfen.');text(d.reason,'Änderungsgrund');}
 if(kind==='reschedule'){text(d.reason,'Friständerungsgrund');const due=time(d.dueAt,'Neue Kontrollfrist',now,false),es=time(d.escalationAt,'Neue Eskalationsfrist',now,false);if(due<time(d.occurredAt,'Änderungszeitpunkt',now)||es<due)throw Error('Neue Fristen widersprechen der tatsächlichen Änderung.');}
 if(kind==='reopen'){text(d.reason,'Wiedereröffnungsgrund');policy(d.policy,String(d.occurredAt),now);}
 if(kind==='cancel'){text(d.reason,'Stornierungsgrund');text(d.communication,'Tatsächliche Abstimmung');}
 if(kind==='attempt'||kind==='resolve'){
  for(const k of ['result','communication','personDecision','qualificationBasis'])text(d[k],k);text(d.overrideReason,'Abweichende Zuständigkeit',false);text(d.reason,'Durchführungsabweichung',kind==='attempt'||d.outcome!=='performed');
  if(kind==='attempt'){if(d.outcome!=='partial')throw Error('Teilversuch ist keine vollständige Erledigung.');actualEvidence(d.evidence as ControlSource,task,String(d.occurredAt),now);}
  else{if(!['performed','omitted','refused','failed'].includes(String(d.outcome)))throw Error('Tatsächliches Ergebnis ausdrücklich wählen.');if(d.outcome==='performed')actualEvidence(d.evidence as ControlSource,task,String(d.occurredAt),now);else if(d.evidence!==null)actualEvidence(d.evidence as ControlSource,task,String(d.occurredAt),now);
   text(d.followUpTaskId,'Folgeauftrag',false);text(d.noFollowUpReason,'Begründung ohne Folgeauftrag',false);if(d.followUpTaskId!==''&&!uuid(d.followUpTaskId))throw Error('Folgeauftrag ungültig.');if(d.followUpTaskId===task.id)throw Error('Auftrag darf nicht sein eigener Folgeauftrag sein.');
   if(Boolean(d.followUpTaskId)===Boolean(String(d.noFollowUpReason).trim()))throw Error('Genau einen bestehenden Folgeauftrag oder begründeten Abschluss ohne Folgeauftrag festhalten.');
  }
 }
 if(kind==='escalate'){if(!uuid(d.policyEventId)||!uuid(d.recipientId)||!['phone','in_person','secure_message'].includes(String(d.channel))||!['sent','failed'].includes(String(d.delivery)))throw Error('Tatsächlichen Eskalationsversuch ausdrücklich festhalten.');text(d.message,'Tatsächliche Mitteilung');text(d.response,'Tatsächliche Reaktion oder Versandfehler');}
 if(kind==='acknowledge'){if(!uuid(d.escalationEventId))throw Error('Bestätigten Eskalationsbeleg auswählen.');text(d.response,'Tatsächliche Rückmeldung');text(d.nextStep,'Verbindlichen nächsten Schritt');}
}
function transition(s:ControlState|null,e:ControlEvent,all:Map<string,ControlEvent>,now:number):ControlState{
 const d=e.draft;
 if(!s){if(d.kind!=='create')throw Error('Kontrollauftrag benötigt ein erstes Auftragsereignis.');return {evaluationMeasureId:d.evaluationMeasureId??'',headId:e.id,sequence:1,title:d.title,reason:d.reason,instruction:d.instruction,source:structuredClone(d.source),policy:structuredClone(d.policy),policyEventId:e.id,status:'open',lastOutcome:'',lastOccurredAt:d.occurredAt,attempts:0,escalations:[],acknowledgements:[]};}
 if(d.kind==='create')throw Error('Kontrollauftrag bereits angelegt.');
 if(d.kind==='reopen'){if(s.status==='open')throw Error('Offener Auftrag kann nicht erneut eröffnet werden.');s.status='open';s.policy=structuredClone(d.policy);s.policyEventId=e.id;s.lastOutcome='';}
 else{if(s.status!=='open')throw Error('Abgeschlossener Auftrag benötigt begründete Wiedereröffnung.');
  if(d.kind==='assign'){if(d.assigneeId===s.policy.assigneeId&&d.backupId===s.policy.backupId&&d.escalationRecipientId===s.policy.escalationRecipientId)throw Error('Keine tatsächliche Zuständigkeitsänderung.');Object.assign(s.policy,{assigneeId:d.assigneeId,backupId:d.backupId,escalationRecipientId:d.escalationRecipientId});s.policyEventId=e.id;}
  if(d.kind==='reschedule'){if(d.dueAt===s.policy.dueAt&&d.escalationAt===s.policy.escalationAt)throw Error('Keine tatsächliche Friständerung.');s.policy.dueAt=d.dueAt;s.policy.escalationAt=d.escalationAt;s.policyEventId=e.id;}
  if(d.kind==='attempt'||d.kind==='resolve'){const responsible=e.actorId===s.policy.assigneeId||e.actorId===s.policy.backupId;if(responsible?!!d.overrideReason.trim():!d.overrideReason.trim())throw Error('Abweichende Durchführungsperson ausdrücklich begründen.');if(d.evidence){const cycle=all.get(s.policyEventId)!;if(d.evidence.kind==='plan_evaluation'||s.source.kind==='plan_evaluation')assertEvaluationControlResult(d.evidence,s.source,{tenantId:e.tenantId,clientId:e.clientId,actorId:e.actorId,cycleAt:cycle.draft.occurredAt,resultAt:d.occurredAt,recordedAt:e.recordedAt,measureId:s.evaluationMeasureId,complete:d.kind==='resolve'&&d.outcome==='performed'},now);if(woundInstant(controlEvidenceAt(d.evidence))!<woundInstant(cycle.draft.occurredAt)!)throw Error('Ergebnisbeleg gehört zu einer älteren Auftragsfassung.');}s.attempts++;s.lastOutcome=d.outcome;if(d.kind==='resolve')s.status=d.outcome==='performed'?'completed':'not_fulfilled';}
  if(d.kind==='cancel')s.status='cancelled';
  if(d.kind==='escalate'){if(d.policyEventId!==s.policyEventId||d.recipientId!==s.policy.escalationRecipientId||time(d.occurredAt,'Eskalation',Number.MAX_SAFE_INTEGER)<woundInstant(s.policy.escalationAt)!)throw Error('Eskalation gehört nicht zur aktuellen fälligen Regel.');s.escalations.push(structuredClone(e));}
  if(d.kind==='acknowledge'){const original=all.get(d.escalationEventId);if(!original||original.draft.kind!=='escalate'||original.draft.delivery!=='sent'||original.draft.policyEventId!==s.policyEventId||original.draft.recipientId!==e.actorId||s.acknowledgements.some(x=>x.draft.kind==='acknowledge'&&x.draft.escalationEventId===original.id))throw Error('Rückmeldung muss die tatsächliche adressierte Person für einen unbestätigten aktuellen Versand dokumentieren.');s.acknowledgements.push(structuredClone(e));}
 }
 s.headId=e.id;s.sequence=e.sequence;s.lastOccurredAt=d.occurredAt;return s;
}
export function controlHistory(task:ControlTask,events:ControlEvent[],now=Date.now()):ControlState{
 validateControlTask(task);if(!Array.isArray(events)||!events.length)throw Error('Vollständiger Kontrollverlauf fehlt.');let state:ControlState|null=null,previous='',recorded:bigint|null=null,occurred:bigint|null=null;const ids=new Set<string>(),requests=new Set<string>(),prior=new Map<string,ControlEvent>();
 for(let i=0;i<events.length;i++){const e=events[i];if(!controlExact(e,['id','taskId','tenantId','clientId','sequence','previousId','actorId','requestId','recordedAt','draft'])||![e.id,e.actorId,e.requestId].every(uuid)||e.taskId!==task.id||e.tenantId!==task.tenantId||e.clientId!==task.clientId||e.sequence!==i+1||e.previousId!==previous||ids.has(e.id)||requests.has(e.requestId))throw Error('Kontrollverlauf abgeschnitten, doppelt oder einer fremden Akte zugeordnet.');
  validateControlDraft(e.draft,task,now);const r=time(e.recordedAt,'Erfassung',now),o=time(e.draft.occurredAt,'Ereignis',now);if(r<o||(recorded!==null&&r<recorded)||(occurred!==null&&o<occurred))throw Error('Tatsächliche Ereignis-/Erfassungsreihenfolge widersprüchlich.');
  state=transition(state,e,prior,now);previous=e.id;recorded=r;occurred=o;ids.add(e.id);requests.add(e.requestId);prior.set(e.id,e);
 }
 return structuredClone(state!);
}
export type ControlContext={tenantId:string;clientId:string;actorId:string;requestId:string;eventId:string;recordedAt:string;expectedHeadId:string;canRead:boolean;canManage:boolean;canRecord:boolean;activeProfileIds:string[];currentSources:ControlSource[];followUpTasks:ControlTask[]};
/** Executable reference contract. Authentication, RLS, locks and transaction persistence remain server obligations. */
export function appendControlEvent(task:ControlTask,events:ControlEvent[],draft:ControlDraft,c:ControlContext,now=Date.now()):ControlEvent{
 validateControlTask(task);if(c.tenantId!==task.tenantId||c.clientId!==task.clientId||!uuid(c.actorId)||!c.canRead||!Array.isArray(c.activeProfileIds)||!c.activeProfileIds.includes(c.actorId))throw Error('Aktiver eigener Aktenzugang fehlt.');
 if(!uuid(c.requestId)||!uuid(c.eventId)||!(c.expectedHeadId===''||uuid(c.expectedHeadId)))throw Error('Anfrage-/Revisionsbeleg ungültig.');
 const state=events.length?controlHistory(task,events,now):null;
 const old=events.find(e=>e.requestId===c.requestId);if(old){if(old.actorId!==c.actorId||old.previousId!==c.expectedHeadId||!sameWoundJson(old.draft,draft))throw Error('Anfragekennung bereits mit anderen Originalangaben belegt.');return structuredClone(old);}
 const manage=['create','assign','reschedule','cancel','reopen'].includes(draft.kind);if(manage?!c.canManage:!c.canRecord)throw Error('Erforderliches Auftrags-/Dokumentationsrecht fehlt.');
 validateControlDraft(draft,task,now);if((state?.headId??'')!==c.expectedHeadId)throw Error('Kontrollverlauf geändert. Original neu laden.');if(events.some(e=>e.id===c.eventId))throw Error('Ereigniskennung bereits vorhanden.');
 const p=draft.kind==='create'||draft.kind==='reopen'?draft.policy:draft.kind==='assign'?draft:null;if(p){for(const id of [p.assigneeId,p.backupId,p.escalationRecipientId].filter(Boolean))if(!c.activeProfileIds.includes(id))throw Error('Ausgewählte zuständige Person nicht aktiv zugänglich.');}
 const source=draft.kind==='create'?draft.source:draft.kind==='attempt'||draft.kind==='resolve'?draft.evidence:null;
 if(source&&!c.currentSources.some(s=>s.kind===source.kind&&s.id===source.id&&sameWoundJson(s.snapshot,source.snapshot)))throw Error('Originalbeleg geändert oder nicht mehr zugänglich.');
 if(source&&state?.source.kind==='plan_evaluation'&&!c.currentSources.some(s=>s.kind===state.source.kind&&s.id===state.source.id&&sameWoundJson(s.snapshot,state.source.snapshot)))throw Error('Beauftragte Evaluation inzwischen berichtigt oder zurückgenommen. Auftrag ausdrücklich neu klären.');
 if(source?.kind==='plan_evaluation'&&state&&(draft.kind==='attempt'||draft.kind==='resolve')){const cycle=events.find(e=>e.id===state.policyEventId)!;assertEvaluationControlResult(source,state.source,{tenantId:c.tenantId,clientId:c.clientId,actorId:c.actorId,cycleAt:cycle.draft.occurredAt,resultAt:draft.occurredAt,recordedAt:c.recordedAt,complete:draft.kind==='resolve'&&draft.outcome==='performed',requireDetailed:true,measureId:state.evaluationMeasureId},now);}
 if(draft.kind==='resolve'&&draft.followUpTaskId){const linked=c.followUpTasks.find(t=>t.id===draft.followUpTaskId);if(!linked)throw Error('Bestehender Folgeauftrag fehlt.');validateControlTask(linked);if(linked.tenantId!==task.tenantId||linked.clientId!==task.clientId)throw Error('Folgeauftrag gehört nicht zur selben Akte.');}
 const e:ControlEvent={id:c.eventId,taskId:task.id,tenantId:task.tenantId,clientId:task.clientId,sequence:events.length+1,previousId:c.expectedHeadId,actorId:c.actorId,requestId:c.requestId,recordedAt:c.recordedAt,draft:structuredClone(draft)};controlHistory(task,[...events,e],now);return e;
}
export function controlReadModel(task:ControlTask,events:ControlEvent[],now=Date.now()){
 const s=controlHistory(task,events,now),at=BigInt(now)*1000n,active=s.status==='open';const current=s.escalations.filter(e=>e.draft.kind==='escalate'&&e.draft.policyEventId===s.policyEventId),sent=current.filter(e=>e.draft.kind==='escalate'&&e.draft.delivery==='sent');
 const acknowledgedIds=new Set(s.acknowledgements.flatMap(a=>a.draft.kind==='acknowledge'?[a.draft.escalationEventId]:[]));
 const pending=sent.filter(e=>!acknowledgedIds.has(e.id));const last=current.at(-1),lastFailed=last?.draft.kind==='escalate'&&last.draft.delivery==='failed';
 const escalationState: 'closed'|'awaiting_response'|'failed_due'|'acknowledged'|'due'|'scheduled' = !active?'closed':pending.length?'awaiting_response':lastFailed?'failed_due':sent.length?'acknowledged':woundInstant(s.policy.escalationAt)!<=at?'due':'scheduled';
 return {...s,overdue:active&&woundInstant(s.policy.dueAt)!<=at,escalationState,pendingResponseCount:active?pending.length:0,failedEscalationPending:active&&lastFailed,events:structuredClone(events)};
}
/** Grouping retains every task ID; no deduplication by title/source/patient or summary checkbox. */
export function controlQueue(records:{task:ControlTask;events:ControlEvent[]}[],now=Date.now()){
 const ids=new Set<string>(),tenants=new Set<string>();const rows=records.map(r=>{if(ids.has(r.task.id))throw Error('Auftrag doppelt im Bestand.');ids.add(r.task.id);tenants.add(r.task.tenantId);return {task:structuredClone(r.task),...controlReadModel(r.task,r.events,now)};});if(tenants.size>1)throw Error('Mandantenübergreifende Aufgabenliste verweigert.');
 const priority={urgent:0,important:1,routine:2};rows.sort((a,b)=>{const dueA=woundInstant(a.policy.dueAt)!,dueB=woundInstant(b.policy.dueAt)!;return Number(a.status!=='open')-Number(b.status!=='open')||(dueA<dueB?-1:dueA>dueB?1:0)||priority[a.policy.priority]-priority[b.policy.priority]||a.task.id.localeCompare(b.task.id);});
 return {count:rows.length,open:rows.filter(r=>r.status==='open'),closed:rows.filter(r=>r.status!=='open')};
}
