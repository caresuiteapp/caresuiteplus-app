import {controlExact} from '../pflege/clinicalControlShape.ts';
import {sameWoundJson,woundInstant,woundUuid} from '../pflege/woundCareDomain.ts';
import {captureEvaluationPlan,decodeEvaluationPlan,decodeEvaluationRecords,evaluationMeasureFields,planEvaluationVersion,type EvaluationMeasure,type EvaluationPlan,type EvaluationRecord} from './planEvaluationDomain.ts';
import type {CareAssessment} from '@/types/modules/careAssessment';
export const planAmendmentVersion='2026-10-10.1';
export type PlanAmendmentRequest={version:typeof planAmendmentVersion;source:EvaluationRecord;target:EvaluationPlan;measureId:string;preparedAt:string;proposed:EvaluationMeasure;reason:string;personDecision:string};
export type PlanAmendmentDifference={field:typeof evaluationMeasureFields[number];before:string|null;after:string|null};
const topics=['cognition_communication','mobility','disease_demands','self_care','social_relationships','living_environment'];
const freeze=(v:object):void=>{Object.freeze(v);for(const child of Object.values(v))if(child&&typeof child==='object')freeze(child);};
/** A proposal changes only a draft. It cannot approve a plan or imply a performed intervention. */
export function snapshotPlanAmendment(value:unknown,now=Date.now()):PlanAmendmentRequest{
 if(!controlExact(value,['version','source','target','measureId','preparedAt','proposed','reason','personDecision'])||value.version!==planAmendmentVersion||!woundUuid(value.measureId))throw Error('Änderungsauftrag oder Originalmaßnahme ungültig.');
 const target=decodeEvaluationPlan(value.target,now);
 if(!['draft','in_progress'].includes(target.status)||target.measures.length!==1||target.measures[0].id!==value.measureId)throw Error('Genau eine gespeicherte Maßnahme in einem bearbeitbaren Entwurf auswählen.');
 const [source]=decodeEvaluationRecords({version:planEvaluationVersion,tenantId:target.tenantId,assessmentId:target.assessmentId,count:1,records:[value.source]},target.tenantId,target.assessmentId,target.clientId,now);
 const entry=source.events.at(-1)!.draft.entry,review=entry?.measureReviews?.find(r=>r.measureId===value.measureId),original=source.root.snapshot.measures.find(m=>m.id===value.measureId);
 if(!entry||!review||review.nextAction!=='adjust'||!original)throw Error('Aktuelle Einzelbewertung mit ausdrücklicher Anpassungsentscheidung erforderlich.');
 if(!sameWoundJson(original,target.measures[0]))throw Error('Die Originalmaßnahme wurde seit der Evaluation geändert. Zuerst erneut abgleichen und bewerten.');
 if(source.root.snapshot.version>target.version||woundInstant(source.root.snapshot.updatedAt)!>woundInstant(target.updatedAt)!)throw Error('Zielplan liegt vor dem bewerteten Originalstand.');
 const prepared=woundInstant(value.preparedAt);if(prepared===null||prepared>BigInt(now)*1000n||prepared<woundInstant(source.events.at(-1)!.recordedAt)!||prepared<woundInstant(target.updatedAt)!)throw Error('Tatsächlichen Änderungsauftragszeitpunkt prüfen.');
 const proposed=decodeEvaluationPlan({...target,measures:[value.proposed]},now).measures[0];
 if(proposed.id!==value.measureId||sameWoundJson(proposed,original))throw Error('Native Maßnahmenkennung erhalten und tatsächliche Änderung erfassen.');
 if(proposed.relatedTopicKey!==null&&!topics.includes(proposed.relatedTopicKey))throw Error('Themenfeld der Maßnahme ungültig.');
 if(proposed.relatedRiskKey!==null&&!proposed.relatedRiskKey.trim())throw Error('Risikobezug ausdrücklich wählen oder entfernen.');
 if(['planned','active'].includes(proposed.status!)&&(proposed.nextEvaluationAt===null||woundInstant(proposed.nextEvaluationAt)!<=prepared))throw Error('Geplante oder aktive Änderung benötigt einen zukünftigen individuellen Prüftermin.');
 for(const key of ['reason','personDecision'])if(typeof value[key]!=='string'||!value[key].trim()||value[key].length>4000)throw Error('Änderungsbegründung und tatsächliche Personenentscheidung erfassen.');
 const request={version:planAmendmentVersion,source,target,measureId:value.measureId,preparedAt:value.preparedAt as string,proposed,reason:value.reason,personDecision:value.personDecision} as PlanAmendmentRequest;
 if(new TextEncoder().encode(JSON.stringify(request)).length>262144)throw Error('Änderungsauftrag ist zu umfangreich.');freeze(request);return request;
}
export function planAmendmentDifferences(request:PlanAmendmentRequest,now=Date.now()):PlanAmendmentDifference[]{
 const p=snapshotPlanAmendment(request,now),before=p.target.measures[0];return evaluationMeasureFields.filter(field=>before[field]!==p.proposed[field]).map(field=>({field,before:before[field],after:p.proposed[field]}));
}
/** Preflight helps the editor; the database must repeat these checks in the write transaction. */
export function assertPlanAmendmentContext(request:PlanAmendmentRequest,records:EvaluationRecord[],assessment:CareAssessment,now=Date.now()):void{
 const p=snapshotPlanAmendment(request,now);
 const all=decodeEvaluationRecords({version:planEvaluationVersion,tenantId:p.target.tenantId,assessmentId:p.target.assessmentId,count:records.length,records},p.target.tenantId,p.target.assessmentId,p.target.clientId,now);
 const latest=all.find(r=>r.root.id===p.source.root.id);
 if(!latest||!sameWoundJson(latest,p.source))throw Error('Evaluationsquelle wurde inzwischen geändert oder zurückgenommen.');
 if(!sameWoundJson(captureEvaluationPlan(assessment,[p.measureId],now),p.target))throw Error('Gespeicherter Planstand wurde inzwischen geändert.');
 if(p.proposed.relatedRiskKey!==null&&!assessment.risks.some(r=>r.riskKey===p.proposed.relatedRiskKey))throw Error('Risikobezug ist in diesem Assessment nicht vorhanden.');
 if(p.proposed.relatedTopicKey!==null&&!assessment.topics.some(t=>t.topicKey===p.proposed.relatedTopicKey))throw Error('Themenfeld ist in diesem Assessment nicht vorhanden.');
}
