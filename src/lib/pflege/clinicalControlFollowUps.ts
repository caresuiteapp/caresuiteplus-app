import {clinicalControlVersion,controlReadModel,type ControlPolicy,type ControlState} from './clinicalControlDomain.ts';
import {decodeControlSnapshot,type ControlRecord} from './clinicalControlGateway.ts';
import {woundInstant,woundUuid} from './woundCareDomain.ts';

export type ControlFollowUpComparison='open_at_recording'|'not_open_at_recording'|'created_after_recording'|'simultaneous_recording'|'unavailable';
export type ControlFollowUpRelation={
 originTaskId:string;eventId:string;targetTaskId:string;outcome:'performed'|'omitted'|'refused'|'failed';occurredAt:string;recordedAt:string;currentCycle:boolean;
 comparison:ControlFollowUpComparison;target:ControlRecord|null;targetState:ReturnType<typeof controlReadModel>|null;
 recordedPrefix:{headId:string;sequence:number;status:ControlState['status'];policy:ControlPolicy}|null;sameTimeEventIds:string[];
};
export const controlFollowUpComparisonLabels:Record<ControlFollowUpComparison,string>={
 open_at_recording:'Folgeauftrag im dokumentierten Erfassungsverlauf damals offen',
 not_open_at_recording:'Folgeauftrag im dokumentierten Erfassungsverlauf damals geschlossen; Bezug klären',
 created_after_recording:'Folgeauftrag erst nach dieser Erfassung dokumentiert; damalige Verfügbarkeit nicht belegt',
 simultaneous_recording:'Zeitgleiche Erfassungen in getrennten Aufträgen; damalige Reihenfolge nicht eindeutig',
 unavailable:'Ausdrücklich benannter Folgeauftrag im aktuellen Bestand nicht verfügbar',
};

/** Read-only comparison of recorded histories, not a cross-stream transaction-order guarantee. */
export function controlFollowUps(records:ControlRecord[],tenant:string,client:string,now=Date.now(),referenceAt=new Date(now).toISOString()){
 const checkedAt=woundInstant(referenceAt);if(checkedAt===null||!Number.isSafeInteger(now)||checkedAt>BigInt(now)*1000n)throw Error('Vergleichszeitpunkt der Folgeaufträge prüfen.');
 const originals=decodeControlSnapshot({version:clinicalControlVersion,tenantId:tenant,clientId:client,count:records.length,tasks:records},tenant,client,now);
 if(originals.some(r=>woundInstant(r.events.at(-1)!.recordedAt)!>checkedAt))throw Error('Vergleichszeitpunkt liegt vor dem vollständigen Folgeauftragsbestand.');
 const states=new Map(originals.map(r=>{const s=controlReadModel(r.task,r.events,now);s.overdue=s.status==='open'&&woundInstant(s.policy.dueAt)!<=checkedAt;if(s.status==='open'&&['due','scheduled'].includes(s.escalationState))s.escalationState=woundInstant(s.policy.escalationAt)!<=checkedAt?'due':'scheduled';return [r.task.id,s];}));
 const byId=new Map(originals.map(r=>[r.task.id,r]));
 const relations:ControlFollowUpRelation[]=originals.flatMap(origin=>{
  const cycle=origin.events.findIndex(e=>e.id===states.get(origin.task.id)!.policyEventId);
  return origin.events.flatMap((e,index)=>{
   const d=e.draft;if(d.kind!=='resolve'||!d.followUpTaskId)return [];
   const target=byId.get(d.followUpTaskId)??null,at=woundInstant(e.recordedAt)!;
   const prefix=target?.events.filter(event=>woundInstant(event.recordedAt)!<=at)??[];
   const sameTimeEventIds=target?.events.filter(event=>woundInstant(event.recordedAt)===at).map(event=>event.id)??[];
   const prefixState=target&&prefix.length?controlReadModel(target.task,prefix,now):null;
   const comparison:ControlFollowUpComparison=!target?'unavailable':!prefix.length?'created_after_recording':sameTimeEventIds.length?'simultaneous_recording':prefixState!.status==='open'?'open_at_recording':'not_open_at_recording';
   return [{originTaskId:origin.task.id,eventId:e.id,targetTaskId:d.followUpTaskId,outcome:d.outcome,occurredAt:d.occurredAt,recordedAt:e.recordedAt,currentCycle:index>=cycle,comparison,target,targetState:states.get(d.followUpTaskId)??null,recordedPrefix:prefixState?{headId:prefixState.headId,sequence:prefixState.sequence,status:prefixState.status,policy:prefixState.policy}:null,sameTimeEventIds}];
  });
 });
 return {checkedAt:referenceAt,originals,relations};
}

/** Follow only explicit outgoing references. Native IDs bound cycles and shared targets. */
export function controlFollowUpGraph(records:ControlRecord[],tenant:string,client:string,rootTaskIds:string[],now=Date.now(),referenceAt=new Date(now).toISOString()){
 const full=controlFollowUps(records,tenant,client,now,referenceAt),byId=new Map(full.originals.map(r=>[r.task.id,r]));
 if(!Array.isArray(rootTaskIds)||rootTaskIds.some(id=>!woundUuid(id)||id!==id.toLowerCase()||!byId.has(id))||new Set(rootTaskIds).size!==rootTaskIds.length)throw Error('Native Ausgangsaufträge für den Folgeauszug prüfen.');
 const byOrigin=new Map<string,ControlFollowUpRelation[]>();for(const relation of full.relations){const group=byOrigin.get(relation.originTaskId)??[];group.push(relation);byOrigin.set(relation.originTaskId,group);}
 const queue=[...rootTaskIds],visited=new Set<string>(),originals:ControlRecord[]=[],relations:ControlFollowUpRelation[]=[],missingTargetIds:string[]=[];
 for(let index=0;index<queue.length;index++){const id=queue[index];if(visited.has(id))continue;visited.add(id);const original=byId.get(id);if(!original){missingTargetIds.push(id);continue;}originals.push(original);const outgoing=byOrigin.get(id)??[];relations.push(...outgoing);for(const relation of outgoing)if(!visited.has(relation.targetTaskId))queue.push(relation.targetTaskId);}
 return {checkedAt:referenceAt,rootTaskIds:[...rootTaskIds],originals,relations,missingTargetIds};
}

/** Native selection after whole-client validation; an incoming reference is not proof of causation. */
export function controlFollowUpReferences(records:ControlRecord[],tenant:string,client:string,taskId:string,now=Date.now(),referenceAt=new Date(now).toISOString()){
 const full=controlFollowUps(records,tenant,client,now,referenceAt),byId=new Map(full.originals.map(r=>[r.task.id,r]));
 if(!woundUuid(taskId)||taskId!==taskId.toLowerCase()||!byId.has(taskId))throw Error('Vollständig geladenes natives Folgeoriginal auswählen.');
 const incoming=full.relations.filter(relation=>relation.targetTaskId===taskId).map(relation=>{
  const origin=byId.get(relation.originTaskId)!,event=origin.events.find(e=>e.id===relation.eventId)!,originState=controlReadModel(origin.task,origin.events,now),end=woundInstant(full.checkedAt)!;
  originState.overdue=originState.status==='open'&&woundInstant(originState.policy.dueAt)!<=end;
  if(originState.status==='open'&&['due','scheduled'].includes(originState.escalationState))originState.escalationState=woundInstant(originState.policy.escalationAt)!<=end?'due':'scheduled';
  return {relation,origin,event,originState};
 });
 return {checkedAt:full.checkedAt,task:byId.get(taskId)!,outgoing:full.relations.filter(relation=>relation.originTaskId===taskId),incoming};
}
