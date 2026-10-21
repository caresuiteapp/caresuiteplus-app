import {planReviewOverview} from './planReviewOverview.ts';
import {evaluationControlSources,type EvaluationControlSnapshot} from './planEvaluationControl.ts';
import {decodeEvaluationRecords,planEvaluationVersion,type EvaluationPlan,type EvaluationRecord} from './planEvaluationDomain.ts';
import {controlReadModel,type ControlSource} from '../pflege/clinicalControlDomain.ts';
import type {ControlRecord} from '../pflege/clinicalControlGateway.ts';
import {controlFollowUps,type ControlFollowUpRelation} from '../pflege/clinicalControlFollowUps.ts';
import {sameWoundJson,woundInstant} from '../pflege/woundCareDomain.ts';

export type ReviewControlSourceState={state:'unchanged'|'corrected'|'withdrawn'|'unavailable';originalHeadId:string;currentHeadId:string|null};
export type ReviewControlLink={record:ControlRecord;state:ReturnType<typeof controlReadModel>;scope:'measure'|'selected_plan';scopePlanRelation:'current'|'historical';measureIds:string[];removedMeasureIds:string[];sourceState:ReviewControlSourceState;followUps:ControlFollowUpRelation[];results:{event:ControlRecord['events'][number];sourceState:ReviewControlSourceState|null;currentCycle:boolean;followUp:ControlFollowUpRelation|null}[]};
export type ReviewMeasureControl=ReviewControlLink&{planRelation:'current'|'historical';needsComparison:boolean};
export const reviewControlSourceLabels:Record<ReviewControlSourceState['state'],string>={unchanged:'Beleg im aktuellen Verlauf unverändert',corrected:'Beleg später berichtigt',withdrawn:'Beleg später zurückgenommen',unavailable:'Beleg im aktuellen Bestand nicht verfügbar'};
export function reviewControlNeedsComparison(link:ReviewControlLink):boolean{return link.scopePlanRelation==='historical'||link.sourceState.state!=='unchanged'||link.results.some(r=>r.sourceState&&r.sourceState.state!=='unchanged')||link.followUps.some(r=>r.comparison!=='open_at_recording'||r.targetState?.status==='not_fulfilled'||r.targetState?.status==='cancelled');}

/** Compare immutable task evidence to its exact historical evaluation event, then its current head. */
function sourceState(source:ControlSource,records:Map<string,EvaluationRecord>,tenant:string,assessment:string,client:string,now:number):ReviewControlSourceState{
 const s=source.snapshot as EvaluationControlSnapshot,current=records.get(s.root_id),base={originalHeadId:source.id};
 if(!current)return {...base,state:'unavailable',currentHeadId:null};
 if(current.eventCount<s.sequence)throw Error('Kontrollbeleg liegt vor einem unvollständigen aktuellen Evaluationsverlauf.');
 const prefix={...current,events:current.events.slice(0,s.sequence),headId:s.id,eventCount:s.sequence};
 const original=evaluationControlSources([prefix],tenant,assessment,client,now)[0];
 if(!original||!sameWoundJson(original,source))throw Error('Gesicherter Kontrollbeleg und ursprüngliche Evaluationsfassung widersprechen sich.');
 return {...base,state:current.headId===source.id?'unchanged':current.events.at(-1)!.draft.entry===null?'withdrawn':'corrected',currentHeadId:current.headId};
}

/** Whole client task histories are checked before association. No evaluation closes an order here. */
export function planReviewControls(plan:EvaluationPlan,evaluations:EvaluationRecord[],controls:ControlRecord[],tenant:string,assessment:string,client:string,now=Date.now(),referenceAt?:string){
 const overview=planReviewOverview(plan,evaluations,tenant,assessment,client,now,referenceAt);
 const sources=decodeEvaluationRecords({version:planEvaluationVersion,tenantId:tenant,assessmentId:assessment,count:evaluations.length,records:evaluations},tenant,assessment,client,now),byRoot=new Map(sources.map(r=>[r.root.id,r]));
 const followUpOverview=controlFollowUps(controls,tenant,client,now,overview.checkedAt),originals=followUpOverview.originals,end=woundInstant(overview.checkedAt)!;
 const followUpsByOrigin=new Map<string,ControlFollowUpRelation[]>();for(const relation of followUpOverview.relations){const group=followUpsByOrigin.get(relation.originTaskId)??[];group.push(relation);followUpsByOrigin.set(relation.originTaskId,group);}
 const currentIds=new Set(overview.rows.map(r=>r.measure.id!));
 const links:ReviewControlLink[]=originals.flatMap(record=>{
  const state=controlReadModel(record.task,record.events,now);
  if(state.source.kind!=='plan_evaluation'||state.source.snapshot.assessment_id!==assessment)return [];
  state.overdue=state.status==='open'&&woundInstant(state.policy.dueAt)!<=end;
  if(state.status==='open'&&['due','scheduled'].includes(state.escalationState))state.escalationState=woundInstant(state.policy.escalationAt)!<=end?'due':'scheduled';
  const original=state.source.snapshot as EvaluationControlSnapshot;
  if(woundInstant(original.recorded_at)!>woundInstant(record.events[0].recordedAt)!)throw Error('Gesicherte Auftragsquelle wurde erst nach der ursprünglichen Auftragserfassung dokumentiert. Originalzeiten prüfen.');
  if(original.plan.version>overview.plan.version||original.plan.draftRevision>overview.plan.draftRevision||woundInstant(original.plan.updatedAt)!>woundInstant(overview.plan.updatedAt)!)throw Error('Gespeicherten Plan neu laden: Kontrollauftrag bezieht sich auf einen neueren Planstand.');
  const measureIds=state.evaluationMeasureId?[state.evaluationMeasureId]:original.plan.measures.map(m=>m.id!);
  const scopePlanRelation=original.plan.version===overview.plan.version&&measureIds.every(id=>sameWoundJson(original.plan.measures.find(m=>m.id===id),overview.plan.measures.find(m=>m.id===id)))?'current' as const:'historical' as const;
  const cycle=record.events.findIndex(e=>e.id===state.policyEventId);
  const followUps=followUpsByOrigin.get(record.task.id)??[],followUpByEvent=new Map(followUps.map(r=>[r.eventId,r]));
  const results=record.events.flatMap((event,index)=>event.draft.kind==='attempt'||event.draft.kind==='resolve'?[{event,sourceState:event.draft.evidence?sourceState(event.draft.evidence,byRoot,tenant,assessment,client,now):null,currentCycle:index>=cycle,followUp:followUpByEvent.get(event.id)??null}]:[]);
  for(const result of results){const d=result.event.draft;if((d.kind==='attempt'||d.kind==='resolve')&&d.evidence){const p=(d.evidence.snapshot as EvaluationControlSnapshot).plan;if(p.version>overview.plan.version||p.draftRevision>overview.plan.draftRevision||woundInstant(p.updatedAt)!>woundInstant(overview.plan.updatedAt)!)throw Error('Gespeicherten Plan neu laden: Kontrollergebnis bezieht sich auf einen neueren Planstand.');}}
  return [{record,state,scope:state.evaluationMeasureId?'measure' as const:'selected_plan' as const,scopePlanRelation,measureIds,removedMeasureIds:measureIds.filter(id=>!currentIds.has(id)),sourceState:sourceState(state.source,byRoot,tenant,assessment,client,now),followUps,results}];
 });
 const rows=overview.rows.map(row=>({...row,controls:links.filter(l=>l.measureIds.includes(row.measure.id!)).map<ReviewMeasureControl>(l=>{
  const s=l.state.source.snapshot as EvaluationControlSnapshot,original=s.plan.measures.find(m=>m.id===row.measure.id)!;
  const planRelation=s.plan.version===overview.plan.version&&sameWoundJson(original,row.measure)?'current':'historical';
  return {...l,planRelation,needsComparison:planRelation==='historical'||reviewControlNeedsComparison(l)};
 })}));
 const unlinkedControls=links.filter(l=>!l.measureIds.some(id=>currentIds.has(id)));
 const followUps=links.flatMap(l=>l.followUps),uniqueFollowUps=new Map(followUps.map(r=>[r.targetTaskId,r]));
 // Global task counters count native task IDs once, including removed original measures.
 return {...overview,rows,links,unlinkedControls,controlOriginals:originals,followUpTotal:uniqueFollowUps.size,followUpAvailable:[...uniqueFollowUps.values()].filter(r=>r.target).length,followUpOpen:[...uniqueFollowUps.values()].filter(r=>r.targetState?.status==='open').length,followUpUnavailable:[...uniqueFollowUps.values()].filter(r=>!r.target).length,controlTotal:links.length,controlOpen:links.filter(l=>l.state.status==='open').length,controlCompleted:links.filter(l=>l.state.status==='completed').length,controlUnfulfilled:links.filter(l=>l.state.status==='not_fulfilled').length,controlCancelled:links.filter(l=>l.state.status==='cancelled').length};
}
