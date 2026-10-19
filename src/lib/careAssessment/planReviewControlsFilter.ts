import {planReviewControls,reviewControlNeedsComparison,type ReviewControlLink,type ReviewMeasureControl} from './planReviewControls.ts';
import {selectPlanReviewRows,emptyPlanReviewFilter,type PlanReviewFilter} from './planReviewFilter.ts';
import {controlExact} from '../pflege/clinicalControlShape.ts';
import type {ControlRecord} from '../pflege/clinicalControlGateway.ts';
import type {EvaluationPlan,EvaluationRecord} from './planEvaluationDomain.ts';
export type PlanReviewControlsFilter=PlanReviewFilter&{control:'all'|'open'|'due'|'completed'|'needs_comparison'|'none'|'follow_up_open'|'follow_up_unavailable'};
export const emptyPlanReviewControlsFilter=():PlanReviewControlsFilter=>({...emptyPlanReviewFilter(),control:'all'});
function matches(links:(ReviewControlLink|ReviewMeasureControl)[],filter:PlanReviewControlsFilter['control']):boolean{
 if(filter==='all')return true;if(filter==='none')return !links.length;
 return links.some(l=>filter==='open'?l.state.status==='open':filter==='due'?l.state.overdue:filter==='completed'?l.state.status==='completed':filter==='follow_up_open'?l.followUps.some(r=>r.targetState?.status==='open'):filter==='follow_up_unavailable'?l.followUps.some(r=>r.comparison==='unavailable'):reviewControlNeedsComparison(l));
}
/** Full original tasks and evaluations are validated before any hiding/search/pagination. */
export function filterPlanReviewControls(plan:EvaluationPlan,evaluations:EvaluationRecord[],controls:ControlRecord[],tenant:string,assessment:string,client:string,filter:PlanReviewControlsFilter,now=Date.now()){
 const full=planReviewControls(plan,evaluations,controls,tenant,assessment,client,now);
 return selectPlanReviewControls(full,filter);
}
/** Internal selector for a complete projection already validated at the current data/time boundary. */
export function selectPlanReviewControls(full:ReturnType<typeof planReviewControls>,filter:PlanReviewControlsFilter){
 if(!controlExact(filter,['query','due','evidence','measureId','control'])||!['all','open','due','completed','needs_comparison','none','follow_up_open','follow_up_unavailable'].includes(filter.control))throw Error('Filter der zugeordneten Prüfaufträge ungültig.');
 const {control,...base}=filter;
 const visible=selectPlanReviewRows(full.rows,base).filter(r=>matches(r.controls,control));
 // Removed measures remain separately reachable; only task status filters affect this section.
 const visibleUnlinkedControls=full.unlinkedControls.filter(l=>matches([l],control));
 return {...full,visible,matching:visible.length,visibleUnlinkedControls};
}
