import {clinicalControlVersion,controlExact,controlHistory,validateControlDraft,validateControlTask,type ControlTask,type ControlDraft,type ControlEvent} from './clinicalControlDomain.ts';
import {woundUuid} from './woundCareDomain.ts';
export type ControlRequest={task:Omit<ControlTask,'tenantId'>;expectedHeadId:string;draft:ControlDraft};
export type ControlRecord={task:ControlTask;headId:string;eventCount:number;events:ControlEvent[];actorNames:Record<string,string>};
function freeze<T>(v:T):T{if(v&&typeof v==='object'){Object.freeze(v);for(const x of Object.values(v))freeze(x);}return v;}
export function snapshotControlRequest(tenant:string,v:unknown,now=Date.now()):ControlRequest{
 if(!woundUuid(tenant)||!controlExact(v,['task','expectedHeadId','draft'])||!controlExact(v.task,['id','clientId','version'])||typeof v.expectedHeadId!=='string'||(v.expectedHeadId!==''&&(!woundUuid(v.expectedHeadId)||v.expectedHeadId!==v.expectedHeadId.toLowerCase())))throw Error('Kontrollanfrage oder Revision ungültig.');
 const task={...v.task,tenantId:tenant};validateControlTask(task);validateControlDraft(v.draft,task,now);if(v.expectedHeadId===''&&v.draft.kind!=='create')throw Error('Neuer Auftrag benötigt ein echtes erstes Auftragsereignis.');return freeze(structuredClone(v as ControlRequest));
}
export function decodeControlSnapshot(v:unknown,tenant:string,client:string|null,now=Date.now()):ControlRecord[]{
 if(!woundUuid(tenant)||(client!==null&&!woundUuid(client))||!controlExact(v,['version','tenantId','clientId','count','tasks'])||v.version!==clinicalControlVersion||v.tenantId!==tenant||v.clientId!==client||!Array.isArray(v.tasks)||!Number.isSafeInteger(v.count)||v.count!==v.tasks.length)throw Error('Kontrollbestand fehlt, ist fremd oder unvollständig.');
 const tasks=new Set<string>(),events=new Set<string>(),requests=new Set<string>();
 return v.tasks.map(r=>{
  if(!controlExact(r,['task','headId','eventCount','events','actorNames'])||!Array.isArray(r.events)||!Number.isSafeInteger(r.eventCount)||r.eventCount!==r.events.length||(r.eventCount as number)<1)throw Error('Kontrollverlauf abgeschnitten.');validateControlTask(r.task);const task=r.task;if(task.tenantId!==tenant||(client!==null&&task.clientId!==client)||tasks.has(task.id))throw Error('Fremder oder doppelter Kontrollauftrag.');tasks.add(task.id);
  const state=controlHistory(task,r.events as ControlEvent[],now);if(state.headId!==r.headId||state.sequence!==r.eventCount||!controlExact(r.actorNames,r.events.map(e=>e.id)))throw Error('Verlaufskopf oder Personenbelege widersprechen den Originalen.');
  for(const e of r.events as ControlEvent[]){if(events.has(e.id)||requests.has(e.requestId))throw Error('Mandantenweit doppelte Ereignis-/Anfragekennung.');events.add(e.id);requests.add(e.requestId);const name=r.actorNames[e.id];if(typeof name!=='string'||!name.trim()||name.length>2000)throw Error('Gesicherter historischer Personenname fehlt.');}
  return structuredClone({task,headId:r.headId as string,eventCount:r.eventCount as number,events:r.events as ControlEvent[],actorNames:r.actorNames as Record<string,string>});
 });
}
export function decodeControlConfirmation(v:unknown,tenant:string,requestId:string,p:ControlRequest):{id:string}{
 if(!controlExact(v,['id','tenantId','taskId','requestId','previousId','sequence'])||!woundUuid(v.id)||v.tenantId!==tenant||v.taskId!==p.task.id||v.requestId!==requestId||v.previousId!==p.expectedHeadId||!Number.isSafeInteger(v.sequence)||(p.expectedHeadId===''?v.sequence!==1:(v.sequence as number)<2))throw Error('Passende Speicherbestätigung fehlt. Dieselbe unveränderte Kontrollanfrage erneut prüfen.');return {id:v.id};
}
