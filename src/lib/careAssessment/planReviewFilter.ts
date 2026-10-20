import {controlExact} from '../pflege/clinicalControlShape.ts';
import {planReviewOverview,type PlanReviewRow} from './planReviewOverview.ts';
import type {EvaluationPlan,EvaluationRecord} from './planEvaluationDomain.ts';
export type PlanReviewFilter={query:string;due:'all'|'reached'|'unscheduled'|'scheduled'|'inactive';evidence:'all'|'matched'|'needs_comparison';measureId:string};
export const emptyPlanReviewFilter=():PlanReviewFilter=>({query:'',due:'all',evidence:'all',measureId:''});
export function filterPlanReviews(plan:EvaluationPlan,records:EvaluationRecord[],tenant:string,assessment:string,client:string,filter:PlanReviewFilter,now=Date.now()){
 const full=planReviewOverview(plan,records,tenant,assessment,client,now);
 const visible=selectPlanReviewRows(full.rows,filter);
 return {...full,visible,matching:visible.length};
}
/** Select only from an already validated complete projection. */
export function selectPlanReviewRows<T extends PlanReviewRow>(rows:T[],filter:PlanReviewFilter):T[]{
 if(!controlExact(filter,['query','due','evidence','measureId'])||Object.values(filter).some(v=>typeof v!=='string'||v.length>4000)||!['all','reached','unscheduled','scheduled','inactive'].includes(filter.due)||!['all','matched','needs_comparison'].includes(filter.evidence))throw Error('Filter der individuellen Planprüfungen ungültig.');
 if(filter.measureId&&!rows.some(r=>r.measure.id===filter.measureId))throw Error('Ausgewählte Maßnahme ist im aktuellen gespeicherten Plan nicht enthalten.');
 const query=filter.query.trim().toLocaleLowerCase('de');
 return rows.filter(r=>{
  if(filter.measureId&&r.measure.id!==filter.measureId)return false;
  if(filter.due!=='all'&&(filter.due==='reached'?!['overdue','due'].includes(r.dueState):r.dueState!==filter.due))return false;
  if(filter.evidence==='matched'&&r.evidenceState!=='matched'||filter.evidence==='needs_comparison'&&r.evidenceState==='matched')return false;
  return !query||JSON.stringify({measure:r.measure,evidence:r.matchingEvidence}).toLocaleLowerCase('de').includes(query);
 });
}
