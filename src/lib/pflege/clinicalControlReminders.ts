import {clinicalControlVersion,controlExact,controlReadModel,type ControlTask} from './clinicalControlDomain.ts';
import {decodeControlSnapshot,type ControlRecord} from './clinicalControlGateway.ts';
import {woundInstant,woundUuid,sameWoundJson} from './woundCareDomain.ts';

export const controlReminderVersion='2026-10-09.1';
export type ControlReminder={version:string;key:string;tenantId:string;clientId:string;taskId:string;policyEventId:string;recipientId:string;kind:'control_due'|'contact_due'|'response_requested';basisEventId:string;dueAt:string};
export type ReminderQueueEntry={reminder:ControlReminder;phase:'queued'|'leased'|'delivered'|'failed'|'uncertain'|'cancelled';attempt:number;usedTokens:string[];availableAt:string;leaseToken:string;leaseUntil:string;receiptId:string;lastError:string;updatedAt:string};
export type ReminderReceipt={key:string;leaseToken:string;recipientId:string;receiptId:string};
export type ReminderAbsenceProof=ReminderReceipt&{status:'not_delivered'};
const uuid=(v:unknown):v is string=>woundUuid(v)&&v===v.toLowerCase();
function instant(v:unknown,label:string):bigint{const at=woundInstant(v);if(at===null)throw Error(label+' mit Zeitzone fehlt.');return at;}
function clock(now:number):bigint{if(!Number.isSafeInteger(now)||now<0||now>8640000000000000)throw Error('Verlässliche Verarbeitungszeit fehlt.');return BigInt(now)*1000n;}
const stamp=(now:number)=>{clock(now);return new Date(now).toISOString();};
const identity=(r:Omit<ControlReminder,'key'>)=>[r.version,r.tenantId,r.clientId,r.taskId,r.policyEventId,r.kind,r.basisEventId,r.recipientId].join(':');
export function validateControlReminder(v:unknown):asserts v is ControlReminder{
 if(!controlExact(v,['version','key','tenantId','clientId','taskId','policyEventId','recipientId','kind','basisEventId','dueAt'])||v.version!==controlReminderVersion||![v.tenantId,v.clientId,v.taskId,v.policyEventId,v.recipientId,v.basisEventId].every(uuid)||!['control_due','contact_due','response_requested'].includes(String(v.kind)))throw Error('Erinnerung oder Empfängerbezug ungültig.');
 instant(v.dueAt,'Vereinbarter Erinnerungsbezug');if(v.key!==identity(v as ControlReminder))throw Error('Erinnerungskennung widerspricht ihrer Originalfassung.');
 if(v.kind==='control_due'&&v.basisEventId!==v.policyEventId)throw Error('Kontrollfrist gehört nicht zur aktuellen Auftragsfassung.');
}
/** Only already-authorized full histories enter this projection. actor is the signed-in profile,
 * not an authorization grant to read another recipient's inbox. No clinical text leaves this model. */
export function controlReminders(records:ControlRecord[],tenant:string,client:string|null,actor:string,now=Date.now()):ControlReminder[]{
 clock(now);if(!uuid(tenant)||(client!==null&&!uuid(client))||!uuid(actor))throw Error('Eigener Erinnerungs- und Aktenkontext fehlt.');
 const complete=decodeControlSnapshot({version:clinicalControlVersion,tenantId:tenant,clientId:client,count:records.length,tasks:records},tenant,client,now),rows:ControlReminder[]=[];
 const add=(task:ControlTask,policyEventId:string,kind:ControlReminder['kind'],basisEventId:string,dueAt:string)=>{
  const r={version:controlReminderVersion,tenantId:tenant,clientId:task.clientId,taskId:task.id,policyEventId,recipientId:actor,kind,basisEventId,dueAt};const full={...r,key:identity(r)};validateControlReminder(full);rows.push(full);
 };
 for(const r of complete){const s=controlReadModel(r.task,r.events,now);if(s.status!=='open')continue;
  const responsible=actor===s.policy.assigneeId||actor===s.policy.backupId;
  if(responsible&&s.overdue)add(r.task,s.policyEventId,'control_due',s.policyEventId,s.policy.dueAt);
  if(responsible&&(['due','failed_due'].includes(s.escalationState)||s.failedEscalationPending)){
   const last=s.escalations.filter(e=>e.draft.kind==='escalate'&&e.draft.policyEventId===s.policyEventId).at(-1);
   // A later failed real contact has a new reminder identity. A notification never creates this event.
   add(r.task,s.policyEventId,'contact_due',last?.draft.kind==='escalate'&&last.draft.delivery==='failed'?last.id:s.policyEventId,last?.draft.kind==='escalate'&&last.draft.delivery==='failed'?last.draft.occurredAt:s.policy.escalationAt);
  }
  const acked=new Set(s.acknowledgements.flatMap(e=>e.draft.kind==='acknowledge'?[e.draft.escalationEventId]:[]));
  for(const e of s.escalations)if(e.draft.kind==='escalate'&&e.draft.policyEventId===s.policyEventId&&e.draft.delivery==='sent'&&e.draft.recipientId===actor&&!acked.has(e.id))add(r.task,s.policyEventId,'response_requested',e.id,e.draft.occurredAt);
 }
 const rank={contact_due:0,control_due:1,response_requested:2};return rows.sort((a,b)=>{const x=instant(a.dueAt,'Frist'),y=instant(b.dueAt,'Frist');return x<y?-1:x>y?1:rank[a.kind]-rank[b.kind]||a.key.localeCompare(b.key);});
}
/** Retrying is a technical policy, never a clinical care interval. Unknown delivery needs reconciliation. */
export type ReminderDeliveryPolicy={leaseMs:number;retryMs:number;maxAttempts:number};
export function validateReminderDeliveryPolicy(v:unknown):asserts v is ReminderDeliveryPolicy{
 if(!controlExact(v,['leaseMs','retryMs','maxAttempts'])||![v.leaseMs,v.retryMs,v.maxAttempts].every(Number.isSafeInteger)||(v.leaseMs as number)<1000||(v.leaseMs as number)>600000||(v.retryMs as number)<1000||(v.retryMs as number)>86400000||(v.maxAttempts as number)<1||(v.maxAttempts as number)>20)throw Error('Explizite technische Zustellgrenzen fehlen.');
}
export function validateReminderEntry(v:unknown):asserts v is ReminderQueueEntry{
 if(!controlExact(v,['reminder','phase','attempt','usedTokens','availableAt','leaseToken','leaseUntil','receiptId','lastError','updatedAt']))throw Error('Vollständiger Zustellungsstand fehlt.');validateControlReminder(v.reminder);
 if(!['queued','leased','delivered','failed','uncertain','cancelled'].includes(String(v.phase))||!Number.isSafeInteger(v.attempt)||(v.attempt as number)<0||(v.attempt as number)>20||typeof v.lastError!=='string'||v.lastError.length>1000||typeof v.receiptId!=='string'||v.receiptId.length>1000)throw Error('Zustellungsstand ungültig.');
 instant(v.availableAt,'Verarbeitungsfrist');instant(v.updatedAt,'Letzte Verarbeitung');
 const used=v.usedTokens;
 if(!Array.isArray(used)||used.length!==v.attempt||Array.from({length:used.length},(_,i)=>i).some(i=>!Object.hasOwn(used,i)||!uuid(used[i]))||new Set(used).size!==used.length||instant(v.reminder.dueAt,'Frist')>instant(v.updatedAt,'Verarbeitung'))throw Error('Reservierungshistorie oder Fälligkeit widersprüchlich.');
 const leased=v.phase==='leased'||v.phase==='uncertain';
 if(leased?(!uuid(v.leaseToken)||instant(v.leaseUntil,'Reservierungsfrist')<=instant(v.updatedAt,'Verarbeitung')&&v.phase==='leased'):v.phase==='delivered'?(!uuid(v.leaseToken)||v.leaseUntil!==''):v.leaseToken!==''||v.leaseUntil!=='')throw Error('Reservierungsstand widersprüchlich.');
 if((leased||v.phase==='delivered')&&v.leaseToken!==v.usedTokens.at(-1))throw Error('Reservierung gehört nicht zum letzten tatsächlichen Versuch.');
 if(v.phase==='queued'?v.attempt!==0:v.phase==='cancelled'?false:(v.attempt as number)<1)throw Error('Versuchsanzahl widersprüchlich.');
 if(v.phase==='delivered'?!v.receiptId.trim():v.receiptId!=='')throw Error('Nur bestätigte Zustellung besitzt einen Versandbeleg.');
 if(['failed','uncertain','cancelled'].includes(String(v.phase))&&!v.lastError.trim())throw Error('Tatsächlicher technischer Grund fehlt.');
 if(['queued','leased','delivered'].includes(String(v.phase))&&v.lastError!=='')throw Error('Fehlergrund gehört zu keinem aktuellen Fehlerstand.');
}
const copy=(entry:ReminderQueueEntry,now:number)=>{validateReminderEntry(entry);if(clock(now)<instant(entry.updatedAt,'Verarbeitung'))throw Error('Verarbeitungszeit liegt vor dem gespeicherten Stand.');return structuredClone(entry);};
function note(reason:string){if(typeof reason!=='string'||!reason.trim()||reason.length>1000)throw Error('Konkreter technischer Grund fehlt.');}
function clearLease(e:ReminderQueueEntry){e.leaseToken='';e.leaseUntil='';}
function token(e:ReminderQueueEntry,leaseToken:string){if(e.phase!=='leased'||!uuid(leaseToken)||leaseToken!==e.leaseToken)throw Error('Eigene aktuelle Reservierung fehlt.');}
export function queueControlReminder(reminder:ControlReminder,now=Date.now()):ReminderQueueEntry{
 validateControlReminder(reminder);if(instant(reminder.dueAt,'Frist')>clock(now))throw Error('Erinnerung ist noch nicht fällig.');const at=stamp(now);return {reminder:structuredClone(reminder),phase:'queued',attempt:0,usedTokens:[],availableAt:at,leaseToken:'',leaseUntil:'',receiptId:'',lastError:'',updatedAt:at};
}
export function claimControlReminder(entry:ReminderQueueEntry,leaseToken:string,policy:ReminderDeliveryPolicy,now=Date.now()):ReminderQueueEntry{
 const e=copy(entry,now);validateReminderDeliveryPolicy(policy);if(!uuid(leaseToken)||e.usedTokens.includes(leaseToken)||!['queued','failed'].includes(e.phase)||e.attempt>=policy.maxAttempts||instant(e.availableAt,'Wiederholungsfrist')>clock(now))throw Error('Erinnerung ist nicht erneut reservierbar.');
 e.phase='leased';e.attempt++;e.usedTokens.push(leaseToken);e.leaseToken=leaseToken;e.leaseUntil=stamp(now+policy.leaseMs);e.updatedAt=stamp(now);e.lastError='';return e;
}
/** Must be called inside an authoritative transaction immediately before exposing a send payload.
 * current must be freshly read with the actual recipient's complete current rights. */
export function prepareControlReminder(entry:ReminderQueueEntry,leaseToken:string,current:ControlReminder[],now=Date.now()):{entry:ReminderQueueEntry;payload:ControlReminder|null}{
 const e=copy(entry,now);token(e,leaseToken);if(instant(e.leaseUntil,'Reservierungsfrist')<=clock(now))throw Error('Reservierung vor dem Versand abgelaufen.');
 if(!Array.isArray(current))throw Error('Aktuelle eigene Erinnerungen fehlen.');const seen=new Set<string>();
 for(const r of current){validateControlReminder(r);if(r.tenantId!==e.reminder.tenantId||r.recipientId!==e.reminder.recipientId||seen.has(r.key))throw Error('Aktueller Erinnerungsbestand ist fremd oder doppelt.');seen.add(r.key);}
 const active=current.find(r=>r.key===e.reminder.key);if(active&&!sameWoundJson(active,e.reminder))throw Error('Erinnerungsfassung unter derselben Kennung geändert.');
 if(!active){e.phase='cancelled';e.lastError='Nicht mehr Bestandteil der aktuell zugänglichen eigenen Aufgaben.';e.updatedAt=stamp(now);clearLease(e);return {entry:e,payload:null};}
 return {entry:e,payload:structuredClone(e.reminder)};
}
export function failControlReminder(entry:ReminderQueueEntry,leaseToken:string,reason:string,definitelyNotDelivered:boolean,policy:ReminderDeliveryPolicy,now=Date.now()):ReminderQueueEntry{
 const e=copy(entry,now);token(e,leaseToken);note(reason);validateReminderDeliveryPolicy(policy);if(typeof definitelyNotDelivered!=='boolean')throw Error('Sicherer Nichtversand oder ungewisser Versand muss feststehen.');
 // Expiry cannot prove absence of delivery. Keep the original token for reconciliation.
 const certain=definitelyNotDelivered&&instant(e.leaseUntil,'Reservierungsfrist')>clock(now);
 e.phase=certain?'failed':'uncertain';e.lastError=reason;e.updatedAt=stamp(now);e.availableAt=stamp(now+policy.retryMs);if(certain)clearLease(e);return e;
}
export function expireControlReminder(entry:ReminderQueueEntry,now=Date.now()):ReminderQueueEntry{
 const e=copy(entry,now);if(e.phase!=='leased'||instant(e.leaseUntil,'Reservierungsfrist')>clock(now))throw Error('Keine abgelaufene Reservierung.');e.phase='uncertain';e.lastError='Reservierung abgelaufen; tatsächlichen Versand mit ursprünglicher Kennung prüfen.';e.updatedAt=stamp(now);return e;
}
function receipt(e:ReminderQueueEntry,v:unknown):asserts v is ReminderReceipt{
 if(!controlExact(v,['key','leaseToken','recipientId','receiptId'])||v.key!==e.reminder.key||v.recipientId!==e.reminder.recipientId||v.leaseToken!==e.leaseToken||!uuid(v.leaseToken)||typeof v.receiptId!=='string'||!v.receiptId.trim()||v.receiptId.length>1000)throw Error('Passende originale Zustellbestätigung fehlt.');
}
export function confirmControlReminder(entry:ReminderQueueEntry,confirmation:ReminderReceipt,now=Date.now()):ReminderQueueEntry{
 const e=copy(entry,now);if(!['leased','uncertain','delivered'].includes(e.phase))throw Error('Keine ursprüngliche Zustellung zur Bestätigung.');receipt(e,confirmation);
 if(e.phase==='delivered'){if(e.receiptId!==confirmation.receiptId)throw Error('Bestätigter Versandbeleg darf nicht ersetzt werden.');return e;}
 e.phase='delivered';e.receiptId=confirmation.receiptId;e.updatedAt=stamp(now);e.lastError='';e.leaseUntil='';return e;
}
/** Only authoritative provider reconciliation may establish non-delivery. A timeout never suffices. */
export function reconcileControlReminder(entry:ReminderQueueEntry,proof:ReminderAbsenceProof,reason:string,policy:ReminderDeliveryPolicy,now=Date.now()):ReminderQueueEntry{
 const e=copy(entry,now);validateReminderDeliveryPolicy(policy);if(e.phase!=='uncertain')throw Error('Ursprüngliche ungewisse Zustellung fehlt.');
 if(!controlExact(proof,['key','leaseToken','recipientId','receiptId','status'])||proof.status!=='not_delivered')throw Error('Autoritativer Nichtzustellungsbeleg fehlt.');
 const {status:_,...original}=proof;receipt(e,original);note(reason);e.phase='failed';e.lastError=reason+' · Nichtzustellungsbeleg: '+proof.receiptId;if(e.lastError.length>1000)throw Error('Technischer Prüfbeleg überschreitet den zulässigen Umfang.');e.availableAt=stamp(now+policy.retryMs);e.updatedAt=stamp(now);clearLease(e);return e;
}
