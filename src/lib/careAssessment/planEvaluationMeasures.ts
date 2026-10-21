import {controlExact} from '../pflege/clinicalControlShape.ts';
import {woundInstant,woundUuid} from '../pflege/woundCareDomain.ts';
import {evaluationLabels} from './planEvaluationLabels.ts';
import type {EvaluationEntry,EvaluationPlan} from './planEvaluationDomain.ts';
export const measureReviewFields=['measureId','periodStartAt','periodEndAt','source','reportedBy','outcome','observedEffect','feedbackState','personFeedback','professionalConclusion','nextAction','nextActionReason','reviewState','reviewAt','reviewReason'] as const;
export type EvaluationMeasureReview=Record<typeof measureReviewFields[number],string>;
/** Only native IDs are seeded. No observation, effect, decision, date or person is inferred. */
export function seedMeasureReviews(plan:EvaluationPlan,existing?:EvaluationMeasureReview[]):EvaluationMeasureReview[]{
 if(existing&&(existing.length!==plan.measures.length||new Set(existing.map(r=>r.measureId)).size!==existing.length||existing.some(r=>!plan.measures.some(m=>m.id===r.measureId))))throw Error('Vorhandene Einzelbewertungen passen nicht zum unveränderten Originalplan.');
 return plan.measures.map(m=>{const old=existing?.find(r=>r.measureId===m.id);return old?structuredClone(old):Object.fromEntries(measureReviewFields.map(k=>[k,k==='measureId'?m.id:''])) as EvaluationMeasureReview;});
}
const at=(v:unknown)=>{const n=woundInstant(v);if(n===null)throw Error('Maßnahmenbeobachtung mit tatsächlicher Zeitzone erfassen.');return n;};
export function validateMeasureReview(value:unknown,entry:EvaluationEntry,plan:EvaluationPlan):asserts value is EvaluationMeasureReview{
 if(!controlExact(value,[...measureReviewFields])||!woundUuid(value.measureId)||!plan.measures.some(m=>m.id===value.measureId))throw Error('Einzelbewertung gehört nicht zu einer ausgewählten Originalmaßnahme.');
 for(const k of measureReviewFields){const v=value[k];if(typeof v!=='string'||v.length>4000||(!['reportedBy','reviewAt'].includes(k)&&!v.trim()))throw Error(`Angabe „${evaluationLabels[k]??({measureId:'Originalmaßnahme',source:'Herkunft',outcome:'Wirkung',feedbackState:'Personenrückmeldung',nextAction:'Folgeentscheidung',reviewState:'Weitere Prüfung'} as Record<string,string>)[k]??k}“ fehlt oder ist ungültig.`);}
 const from=at(value.periodStartAt),to=at(value.periodEndAt);if(from<at(entry.periodStartAt)||from>to||to>at(entry.periodEndAt))throw Error('Maßnahmenbeobachtung liegt außerhalb des dokumentierten Evaluationszeitraums.');
 if(!['observed','reported'].includes(value.source as string)||(value.source==='observed'&&value.reportedBy!=='')||(value.source==='reported'&&!(value.reportedBy as string).trim()))throw Error('Herkunft der einzelnen Maßnahmenbeobachtung ausdrücklich angeben.');
 if(!['effective','partly_effective','not_effective','deteriorated','not_assessable'].includes(value.outcome as string)||!['given','declined','not_possible'].includes(value.feedbackState as string)||!['continue','adjust','reassess','clarify'].includes(value.nextAction as string)||!['scheduled','pending','not_required'].includes(value.reviewState as string))throw Error('Wirkung, Personenrückmeldung und weitere Entscheidung je Maßnahme wählen.');
 if(value.reviewState==='scheduled'){if(at(value.reviewAt)<at(entry.evaluatedAt))throw Error('Weitere Maßnahmenprüfung liegt vor der tatsächlichen Evaluation.');}else if(value.reviewAt!=='')throw Error('Unvereinbarten Maßnahmenprüftermin entfernen.');
}
export function validateMeasureReviews(value:unknown,entry:EvaluationEntry,plan:EvaluationPlan):asserts value is EvaluationMeasureReview[]{
 if(!Array.isArray(value)||value.length!==plan.measures.length)throw Error('Jede ausgewählte Originalmaßnahme benötigt genau eine Einzelbewertung.');
 const seen=new Set<string>();for(const [index,row] of value.entries()){try{validateMeasureReview(row,entry,plan);if(seen.has(row.measureId))throw Error('Originalmaßnahme wurde doppelt bewertet.');seen.add(row.measureId);}catch(error){const title=plan.measures.find(m=>m.id===row?.measureId)?.title??String(index+1);throw Error(`Maßnahme „${title}“: ${error instanceof Error?error.message:'Einzelbewertung prüfen.'}`);}}
}
/** Fresh writes require details; historical entries and accepted retries remain unchanged. */
export function requireMeasureReviews(entry:EvaluationEntry|null,plan:EvaluationPlan):void{
 if(entry===null)return;if(!Object.hasOwn(entry,'measureReviews'))throw Error('Für diese neue Fassung jede Originalmaßnahme einzeln bewerten.');validateMeasureReviews(entry.measureReviews,entry,plan);
}
export function updateMeasureReview(entry:EvaluationEntry,measureId:string,key:Exclude<keyof EvaluationMeasureReview,'measureId'>,value:string):EvaluationEntry{
 if((key as string)==='measureId'||typeof value!=='string'||!measureReviewFields.includes(key)||!entry.measureReviews||entry.measureReviews.filter(r=>r.measureId===measureId).length!==1)throw Error('Eindeutige Einzelbewertung fehlt.');
 return {...entry,measureReviews:entry.measureReviews.map(r=>r.measureId===measureId?{...r,[key]:value,...(key==='source'?{reportedBy:''}:key==='reviewState'?{reviewAt:''}:{})}:{...r})};
}

export function measureReviewProgress(entry:EvaluationEntry,plan:EvaluationPlan):{complete:number;total:number;firstIncomplete:number}{
 let complete=0,firstIncomplete=-1;for(const [index,m] of plan.measures.entries()){try{const rows=entry.measureReviews?.filter(r=>r.measureId===m.id);if(rows?.length!==1)throw Error();validateMeasureReview(rows[0],entry,plan);complete++;}catch{if(firstIncomplete===-1)firstIncomplete=index;}}return {complete,total:plan.measures.length,firstIncomplete};
}
