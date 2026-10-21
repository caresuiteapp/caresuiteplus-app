import {decodePlanAmendmentHistory,planAmendmentHistoryVersion,type PlanAmendmentHistoryRecord} from './planAmendmentHistoryDomain.ts';
import {decodeEvaluationRecords,planEvaluationVersion,type EvaluationRecord} from './planEvaluationDomain.ts';
import {sameWoundJson} from '../pflege/woundCareDomain.ts';
export type AmendmentSourceState={amendmentId:string;state:'unchanged'|'corrected'|'withdrawn'|'unavailable';originalHeadId:string;currentHeadId:string|null;originalEventCount:number;currentEventCount:number|null};
/** Later decisions inform readers; they never invalidate or replace an accepted original. */
export function amendmentSourceStates(amendments:PlanAmendmentHistoryRecord[],evaluations:EvaluationRecord[],tenant:string,assessment:string,client:string,now=Date.now()):AmendmentSourceState[]{
 const history=decodePlanAmendmentHistory({version:planAmendmentHistoryVersion,tenantId:tenant,assessmentId:assessment,count:amendments.length,records:amendments},tenant,assessment,client,now);
 const sources=decodeEvaluationRecords({version:planEvaluationVersion,tenantId:tenant,assessmentId:assessment,count:evaluations.length,records:evaluations},tenant,assessment,client,now),byRoot=new Map(sources.map(r=>[r.root.id,r]));
 return history.map<AmendmentSourceState>(r=>{const original=r.payload.source,current=byRoot.get(original.root.id),base={amendmentId:r.id,originalHeadId:original.headId,originalEventCount:original.eventCount};
  if(!current)return {...base,state:'unavailable',currentHeadId:null,currentEventCount:null};
  if(current.eventCount<original.eventCount||!sameWoundJson(current.root,original.root)||!sameWoundJson(current.events.slice(0,original.eventCount),original.events))throw Error('Gespeicherte Evaluationsquelle wurde ausgetauscht oder der ursprüngliche Verlauf ist unvollständig.');
  return {...base,state:current.headId===original.headId?'unchanged':current.events.at(-1)!.draft.entry===null?'withdrawn':'corrected',currentHeadId:current.headId,currentEventCount:current.eventCount};
 });
}
export const amendmentSourceStateLabels:Record<AmendmentSourceState['state'],string>={unchanged:'Evaluationsquelle weiterhin unverändert',corrected:'Evaluationsquelle später berichtigt',withdrawn:'Evaluationsquelle später zurückgenommen',unavailable:'Evaluationsquelle im aktuellen Bestand nicht verfügbar'};
