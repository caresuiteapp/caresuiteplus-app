import {planReviewControls} from './planReviewControls.ts';
import {selectPlanReviewControls,type PlanReviewControlsFilter} from './planReviewControlsFilter.ts';
import type {EvaluationPlan,EvaluationRecord} from './planEvaluationDomain.ts';
import type {ControlRecord} from '../pflege/clinicalControlGateway.ts';
import type {ControlSource} from '../pflege/clinicalControlDomain.ts';
import {clinicalControlSourceComparison} from '../pflege/clinicalControlSourceComparison.ts';

export type PlanReviewControlSourceFilter='all'|'identical'|'changed'|'unavailable'|'needs_comparison';
export type PlanReviewControlSourceComparison=ReturnType<typeof clinicalControlSourceComparison>['rows'][number];

/** Validate the full own-client inputs before selecting native assessment roots, including removed measures. */
export function planReviewControlSources(plan:EvaluationPlan,evaluations:EvaluationRecord[],controls:ControlRecord[],sources:ControlSource[],tenant:string,assessment:string,client:string,now=Date.now(),referenceAt=new Date(now).toISOString()){
 const overview=planReviewControls(plan,evaluations,controls,tenant,assessment,client,now,referenceAt);
 const full=clinicalControlSourceComparison(controls,sources,tenant,client,now,overview.checkedAt);
 const associated=new Set(overview.links.map(link=>link.record.task.id));
 // The complete clinical pool and outgoing targets do not extend these primary root counters.
 const comparisons=full.rows.filter(row=>associated.has(row.record.task.id));
 // Each native root is counted once across all historical results. Changed and unavailable may overlap; none is not a missing source.
 const counts={taskCount:comparisons.length,identicalTaskCount:comparisons.filter(row=>!row.needsSourceComparison).length,changedSourceTaskCount:comparisons.filter(row=>row.hasChangedSource).length,unavailableSourceTaskCount:comparisons.filter(row=>row.hasUnavailableSource).length,needsSourceComparisonTaskCount:comparisons.filter(row=>row.needsSourceComparison).length};
 return {overview,comparisons,counts,checkedAt:full.checkedAt};
}
export type PlanReviewControlSources=ReturnType<typeof planReviewControlSources>;
function matches(row:PlanReviewControlSourceComparison,filter:PlanReviewControlSourceFilter):boolean{
 return filter==='all'||(filter==='identical'?!row.needsSourceComparison:filter==='changed'?row.hasChangedSource:filter==='unavailable'?row.hasUnavailableSource:row.needsSourceComparison);
}

/** Select visible measures only after full validation; originals, links and global native task counts remain complete. */
export function selectPlanReviewControlSources(projection:PlanReviewControlSources,originalFilter:PlanReviewControlsFilter,sourceFilter:PlanReviewControlSourceFilter){
 if(!['all','identical','changed','unavailable','needs_comparison'].includes(sourceFilter))throw Error('Filter des aktuellen Kontrollquellenvergleichs ungültig.');
 const selected=selectPlanReviewControls(projection.overview,originalFilter);
 const byId=new Map(projection.comparisons.map(row=>[row.record.task.id,row]));
 const matchesTask=(id:string)=>{const row=byId.get(id);return !!row&&matches(row,sourceFilter);};
 // Apply both predicates to the same native task. Returned rows still carry their complete original controls.
 const sourceSelected=sourceFilter==='all'?selected:selectPlanReviewControls({...projection.overview,
  rows:projection.overview.rows.map(row=>({...row,controls:row.controls.filter(link=>matchesTask(link.record.task.id))})),
  unlinkedControls:projection.overview.unlinkedControls.filter(link=>matchesTask(link.record.task.id)),
 },originalFilter);
 const visibleIds=new Set(sourceSelected.visible.filter(row=>sourceFilter==='all'||row.controls.length>0).map(row=>row.measure.id));
 const visible=selected.visible.filter(row=>visibleIds.has(row.measure.id));
 const visibleUnlinkedControls=sourceSelected.visibleUnlinkedControls;
 return {...selected,visible,matching:visible.length,visibleUnlinkedControls,sourceComparisons:projection.comparisons,sourceCounts:projection.counts,sourceCheckedAt:projection.checkedAt};
}
