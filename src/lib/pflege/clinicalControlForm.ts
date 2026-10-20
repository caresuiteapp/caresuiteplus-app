import {type ControlDraft,type ControlPolicy,type ControlSource,type ControlTask} from './clinicalControlDomain.ts';
import {snapshotControlRequest,type ControlRequest} from './clinicalControlGateway.ts';
export const controlActionLabels:Record<string,string>={create:'Kontrollauftrag anlegen',assign:'Zuständigkeit ändern',reschedule:'Fristen ändern',attempt:'Tatsächliche Teilkontrolle',resolve:'Tatsächliches Ergebnis / Nichterfüllung',cancel:'Auftrag begründet stornieren',reopen:'Auftrag begründet wiedereröffnen',escalate:'Tatsächlichen Eskalationsversuch dokumentieren',acknowledge:'Eigene Eskalationsrückmeldung dokumentieren'};
export const controlStatusLabels:Record<string,string>={open:'Offen',completed:'Tatsächlich durchgeführt',not_fulfilled:'Begründet nicht erfüllt',cancelled:'Storniert',scheduled:'Eskalation terminiert',due:'Eskalation fällig',failed_due:'Kontakt gescheitert – Eskalation fällig',awaiting_response:'Rückmeldung ausstehend',acknowledged:'Rückmeldung dokumentiert',closed:'Auftrag geschlossen',routine:'Regulär',important:'Wichtig',urgent:'Dringend',performed:'Durchgeführt',partial:'Teilweise',omitted:'Ausgeblieben',refused:'Abgelehnt',failed:'Fehlgeschlagen',sent:'Tatsächlich übermittelt',phone:'Telefon',in_person:'Persönlicher Kontakt',secure_message:'Sichere Nachricht'};
export const controlSourceLabels:Record<string,string>={infusion_event:'Infusionsereignis',treatment_execution:'Behandlungspflegenachweis',wound_assessment:'Wundassessment',medication_administration:'Medikamentengabe',vital_measurement:'Vitalmessung',care_plan:'Pflegeplan',pflege_report:'Pflegebericht',protocol_event:'Tagesprotokollfassung',plan_evaluation:'Historische Pflegeplan-Evaluation'};
export const emptyControlForm=()=>({kind:'',evaluationMeasureId:'',occurredAt:'',title:'',reason:'',instruction:'',sourceKey:'',evidenceKey:'',assigneeId:'',backupId:'',dueAt:'',priority:'',escalationAt:'',escalationRecipientId:'',outcome:'',result:'',communication:'',personDecision:'',qualificationBasis:'',overrideReason:'',followUpTaskId:'',noFollowUpReason:'',channel:'',delivery:'',message:'',response:'',nextStep:'',escalationEventId:''});
export type ControlForm=ReturnType<typeof emptyControlForm>;
export function buildControlRequest(task:ControlTask,head:string,f:ControlForm,sources:ControlSource[],policyEventId:string,now=Date.now()):ControlRequest{
 const source=(key:string)=>{const s=sources.find(x=>x.kind+':'+x.id===key);if(!s)throw Error('Ausgewählter vollständiger Originalbeleg fehlt.');return structuredClone(s);};
 const policy=():ControlPolicy=>({assigneeId:f.assigneeId,backupId:f.backupId,dueAt:f.dueAt,priority:f.priority as ControlPolicy['priority'],escalationAt:f.escalationAt,escalationRecipientId:f.escalationRecipientId});
 const common={occurredAt:f.occurredAt};let draft:ControlDraft;
 switch(f.kind){
 case 'create':draft={...common,kind:'create',title:f.title,reason:f.reason,instruction:f.instruction,source:source(f.sourceKey),policy:policy(),...(f.evaluationMeasureId?{evaluationMeasureId:f.evaluationMeasureId}:{})};break;
 case 'assign':draft={...common,kind:'assign',reason:f.reason,assigneeId:f.assigneeId,backupId:f.backupId,escalationRecipientId:f.escalationRecipientId};break;
 case 'reschedule':draft={...common,kind:'reschedule',reason:f.reason,dueAt:f.dueAt,escalationAt:f.escalationAt};break;
 case 'attempt':draft={...common,kind:'attempt',outcome:'partial',result:f.result,reason:f.reason,communication:f.communication,personDecision:f.personDecision,qualificationBasis:f.qualificationBasis,evidence:source(f.evidenceKey),overrideReason:f.overrideReason};break;
 case 'resolve':draft={...common,kind:'resolve',outcome:f.outcome as Extract<ControlDraft,{kind:'resolve'}>['outcome'],result:f.result,reason:f.reason,communication:f.communication,personDecision:f.personDecision,qualificationBasis:f.qualificationBasis,evidence:f.evidenceKey?source(f.evidenceKey):null,overrideReason:f.overrideReason,followUpTaskId:f.followUpTaskId,noFollowUpReason:f.noFollowUpReason};break;
 case 'cancel':draft={...common,kind:'cancel',reason:f.reason,communication:f.communication};break;
 case 'reopen':draft={...common,kind:'reopen',reason:f.reason,policy:policy()};break;
 case 'escalate':draft={...common,kind:'escalate',policyEventId,recipientId:f.escalationRecipientId,channel:f.channel as Extract<ControlDraft,{kind:'escalate'}>['channel'],delivery:f.delivery as Extract<ControlDraft,{kind:'escalate'}>['delivery'],message:f.message,response:f.response};break;
 case 'acknowledge':draft={...common,kind:'acknowledge',escalationEventId:f.escalationEventId,response:f.response,nextStep:f.nextStep};break;
 default:throw Error('Tatsächliche Kontrollhandlung ausdrücklich auswählen.');}
 const {tenantId,...metadata}=task;return snapshotControlRequest(tenantId,{task:metadata,expectedHeadId:head,draft},now);
}

/** Completed reassessment makes no claim that nursing treatment was performed or effective. */
export function controlTaskStatusLabel(sourceKind:string,key:string):string{
 if(sourceKind==='plan_evaluation'){const own:Record<string,string>={completed:'Folgeevaluation tatsächlich durchgeführt',performed:'Folgeevaluation tatsächlich durchgeführt',partial:'Teilprüfung dokumentiert – Evaluationsauftrag bleibt offen'};if(own[key])return own[key];}
 return controlStatusLabels[key]??key;
}
