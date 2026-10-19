import {clinicalControlVersion,controlReadModel,type ControlSource} from './clinicalControlDomain.ts';
import type {ControlRecord} from './clinicalControlGateway.ts';
import {decodeControlSources} from './clinicalControlRuntime.ts';
import {controlFollowUps} from './clinicalControlFollowUps.ts';
import {validateEvaluationControlSnapshot} from '../careAssessment/planEvaluationControl.ts';
import {validateProtocolControlSnapshot} from './dailyProtocolControl.ts';
import {sameWoundJson,woundInstant} from './woundCareDomain.ts';

export type ControlSourceComparisonState='identical'|'changed'|'unavailable'|'none';
export type ControlSourceComparison={state:ControlSourceComparisonState;original:ControlSource|null;current:ControlSource|null};
export const controlSourceComparisonLabels:Record<ControlSourceComparisonState,string>={
 identical:'Gesicherter Originalbeleg entspricht der aktuell verfügbaren Fassung',
 changed:'Unter derselben nativen Kennung liegt eine abweichende aktuelle Befundfassung vor',
 unavailable:'Gesicherter Originalbeleg im aktuell verfügbaren Quellenbestand nicht enthalten',
 none:'Für dieses Ergebnisereignis wurde kein Ergebnisbeleg gespeichert',
};

/** Native kind + ID only. This read projection changes neither task states nor clinical conclusions. */
export function clinicalControlSourceComparison(records:ControlRecord[],sources:ControlSource[],tenant:string,client:string,now=Date.now(),referenceAt=new Date(now).toISOString()){
 const full=controlFollowUps(records,tenant,client,now,referenceAt);
 const currentSources=decodeControlSources({version:clinicalControlVersion,tenantId:tenant,clientId:client,count:sources.length,sources},tenant,client);
 const end=woundInstant(full.checkedAt)!;
 // Structured native sources must already have been recorded at this exact comparison boundary, including unconnected sources.
 for(const source of currentSources){
  if(source.kind==='plan_evaluation')validateEvaluationControlSnapshot(source.snapshot,tenant,client,now);
  else if(source.kind==='protocol_event')validateProtocolControlSnapshot(source.snapshot,tenant,client,now);
  else continue; // Arbitrary JSON timestamp field names keep their existing contract.
  if(woundInstant(source.snapshot.recorded_at)!>end)throw Error('Aktueller nativer Quellenbestand wurde erst nach dem exakten Vergleichszeitpunkt erfasst.');
 }
 const byKey=new Map(currentSources.map(source=>[source.kind+':'+source.id,source]));
 function compare(original:ControlSource|null):ControlSourceComparison{
  if(!original)return {state:'none',original:null,current:null};
  const current=byKey.get(original.kind+':'+original.id)??null;
  return {state:!current?'unavailable':sameWoundJson(original.snapshot,current.snapshot)?'identical':'changed',original:structuredClone(original),current:current?structuredClone(current):null};
 }
 const rows=full.originals.map(record=>{
  const state=controlReadModel(record.task,record.events,now);
  state.overdue=state.status==='open'&&woundInstant(state.policy.dueAt)!<=end;
  if(state.status==='open'&&['due','scheduled'].includes(state.escalationState))state.escalationState=woundInstant(state.policy.escalationAt)!<=end?'due':'scheduled';
  const cycle=record.events.findIndex(event=>event.id===state.policyEventId);
  const originComparison=compare(state.source);
  const results=record.events.flatMap((event,index)=>event.draft.kind==='attempt'||event.draft.kind==='resolve'?[{event,currentCycle:index>=cycle,sourceComparison:compare(event.draft.evidence)}]:[]);
  const comparisons=[originComparison,...results.map(result=>result.sourceComparison)];
  const hasChangedSource=comparisons.some(comparison=>comparison.state==='changed'),hasUnavailableSource=comparisons.some(comparison=>comparison.state==='unavailable');
  return {record,state,originComparison,results,hasChangedSource,hasUnavailableSource,needsSourceComparison:hasChangedSource||hasUnavailableSource};
 });
 const resultEvents=rows.flatMap(row=>row.results);
 const counts={taskCount:rows.length,originIdenticalTaskCount:rows.filter(row=>row.originComparison.state==='identical').length,originChangedTaskCount:rows.filter(row=>row.originComparison.state==='changed').length,originUnavailableTaskCount:rows.filter(row=>row.originComparison.state==='unavailable').length,resultEventCount:resultEvents.length,resultIdenticalEventCount:resultEvents.filter(result=>result.sourceComparison.state==='identical').length,resultChangedEventCount:resultEvents.filter(result=>result.sourceComparison.state==='changed').length,resultUnavailableEventCount:resultEvents.filter(result=>result.sourceComparison.state==='unavailable').length,resultWithoutEvidenceEventCount:resultEvents.filter(result=>result.sourceComparison.state==='none').length,changedSourceTaskCount:rows.filter(row=>row.hasChangedSource).length,unavailableSourceTaskCount:rows.filter(row=>row.hasUnavailableSource).length,needsSourceComparisonTaskCount:rows.filter(row=>row.needsSourceComparison).length};
 return {checkedAt:full.checkedAt,originals:full.originals,sources:currentSources,rows,counts};
}
