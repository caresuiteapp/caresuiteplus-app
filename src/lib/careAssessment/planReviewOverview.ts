import {decodeCurrentPlanReview} from './currentPlanReviewDomain';
import {decodeEvaluationRecords,planEvaluationVersion,type EvaluationPlan,type EvaluationRecord,type EvaluationMeasure} from './planEvaluationDomain.ts';
import type {EvaluationMeasureReview} from './planEvaluationMeasures.ts';
import {sameWoundJson,woundInstant} from '../pflege/woundCareDomain.ts';
export type PlanReviewEvidence={rootId:string;headId:string;evaluatedAt:string;recordedAt:string;planVersion:number;draftRevision:number;review:EvaluationMeasureReview};
export type PlanReviewRow={measure:EvaluationMeasure;dueState:'overdue'|'due'|'scheduled'|'unscheduled'|'inactive';evidenceState:'matched'|'ambiguous'|'historical'|'withdrawn'|'aggregate_only'|'none';matchingEvidence:PlanReviewEvidence[];latestEvidence:PlanReviewEvidence|null;historicalCount:number;withdrawnCount:number;aggregateOnlyCount:number};
/** Current plan dates and historical findings remain separate; no task completion is inferred. */
export function planReviewOverview(value:EvaluationPlan,records:EvaluationRecord[],tenant:string,assessment:string,client:string,now=Date.now(),referenceAt?:string){
 const plan=decodeCurrentPlanReview(value,now);
 if(plan.tenantId!==tenant||plan.assessmentId!==assessment||plan.clientId!==client)throw Error('Aktueller Maßnahmenplan gehört nicht zur ausgewählten Pflegeakte.');
 const all=decodeEvaluationRecords({version:planEvaluationVersion,tenantId:tenant,assessmentId:assessment,count:records.length,records},tenant,assessment,client,now),end=referenceAt===undefined?BigInt(now)*1000n:woundInstant(referenceAt);
 if(end===null||end>BigInt(now)*1000n||woundInstant(plan.updatedAt)!>end||all.some(r=>woundInstant(r.events.at(-1)!.recordedAt)!>end))throw Error('Vergleichszeitpunkt liegt vor dem vollständigen Plan-/Befundbestand oder ist ungültig.');
 if(all.some(r=>r.root.snapshot.version>plan.version||r.root.snapshot.draftRevision>plan.draftRevision||woundInstant(r.root.snapshot.updatedAt)!>woundInstant(plan.updatedAt)!))throw Error('Geladener aktueller Plan liegt vor einem dokumentierten Evaluationsplan. Gespeicherten Plan neu laden.');
 const rows:PlanReviewRow[]=plan.measures.map(measure=>{
  const active=['planned','active'].includes(measure.status!),at=measure.nextEvaluationAt===null?null:woundInstant(measure.nextEvaluationAt)!;
  const dueState:PlanReviewRow['dueState']=!active?'inactive':at===null?'unscheduled':at<end?'overdue':at===end?'due':'scheduled';
  let historicalCount=0,withdrawnCount=0,aggregateOnlyCount=0;const matchingEvidence:PlanReviewEvidence[]=[];
  for(const r of all){const original=r.root.snapshot.measures.find(m=>m.id===measure.id);if(!original)continue;const event=r.events.at(-1)!,entry=event.draft.entry;
   if(!entry){withdrawnCount++;continue;}const review=entry.measureReviews?.find(x=>x.measureId===measure.id);
   if(!review){aggregateOnlyCount++;continue;}
   if(r.root.snapshot.version!==plan.version||!sameWoundJson(original,measure)){historicalCount++;continue;}
   matchingEvidence.push({rootId:r.root.id,headId:r.headId,evaluatedAt:entry.evaluatedAt,recordedAt:event.recordedAt,planVersion:r.root.snapshot.version,draftRevision:r.root.snapshot.draftRevision,review});
  }
  matchingEvidence.sort((a,b)=>{const at=woundInstant(a.evaluatedAt)!,bt=woundInstant(b.evaluatedAt)!;return at===bt?a.rootId.localeCompare(b.rootId):at>bt?-1:1;});
  const ambiguous=matchingEvidence.length>1&&woundInstant(matchingEvidence[0].evaluatedAt)===woundInstant(matchingEvidence[1].evaluatedAt);
  const evidenceState:PlanReviewRow['evidenceState']=ambiguous?'ambiguous':matchingEvidence.length?'matched':historicalCount?'historical':withdrawnCount?'withdrawn':aggregateOnlyCount?'aggregate_only':'none';
  return {measure,dueState,evidenceState,matchingEvidence,latestEvidence:ambiguous?null:matchingEvidence[0]??null,historicalCount,withdrawnCount,aggregateOnlyCount};
 });
 return {plan,rows,total:rows.length,reached:rows.filter(r=>['overdue','due'].includes(r.dueState)).length,unscheduled:rows.filter(r=>r.dueState==='unscheduled').length,withoutMatchingEvidence:rows.filter(r=>r.evidenceState!=='matched').length,checkedAt:referenceAt??new Date(now).toISOString()};
}
export const planReviewDueLabels:Record<PlanReviewRow['dueState'],string>={overdue:'Plantermin überschritten',due:'Plantermin erreicht',scheduled:'Plantermin zukünftig',unscheduled:'Kein individueller Plantermin',inactive:'Maßnahme derzeit nicht aktiv/geplant'};
export const planReviewEvidenceLabels:Record<PlanReviewRow['evidenceState'],string>={matched:'Einzelbefund für denselben Maßnahmeninhalt und dieselbe Planversion',ambiguous:'Mehrere Einzelbefunde mit gleichem Bewertungszeitpunkt, Abgleich erforderlich',historical:'Einzelbefunde beziehen sich auf frühere Maßnahmeninhalte oder Planversionen',withdrawn:'Zurückgenommene Quellen vorhanden, kein passender aktueller Einzelbefund',aggregate_only:'Gesamtbefunde ohne passende Einzelbewertung',none:'Kein passender Einzelbefund im geladenen Bestand'};
