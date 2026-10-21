import {requireMeasureReviews} from './planEvaluationMeasures.ts';
import {decodeEvaluationPlan,decodeEvaluationDraft,decodeEvaluationRecords,planEvaluationVersion,type EvaluationPlan,type EvaluationDraft,type EvaluationRecord} from './planEvaluationDomain.ts';
import {woundInstant,woundUuid} from '../pflege/woundCareDomain.ts';
import type {ControlSource} from '../pflege/clinicalControlDomain.ts';
export type EvaluationControlSnapshot={id:string;tenant_id:string;client_id:string;root_id:string;assessment_id:string;evaluation_version:string;sequence:number;previous_id:string;actor_id:string;actor_name:string;request_id:string;recorded_at:string;occurred_at:string;root_created_at:string;title:string;plan:EvaluationPlan;draft:EvaluationDraft};
const fields=['id','tenant_id','client_id','root_id','assessment_id','evaluation_version','sequence','previous_id','actor_id','actor_name','request_id','recorded_at','occurred_at','root_created_at','title','plan','draft'];
export const evaluationControlTitle='Pflegeplan-Evaluation';
/** A self-contained historical source; contextual reassessment evidence, never a treatment proof. */
export function validateEvaluationControlSnapshot(value:unknown,tenant:string,client:string,now=Date.now()):asserts value is EvaluationControlSnapshot{
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).length!==fields.length||!fields.every(k=>Object.hasOwn(value,k)))throw Error('Vollständiger nativer Evaluationsbeleg fehlt.');
 const s=value as EvaluationControlSnapshot;
 if(!Number.isSafeInteger(now)||![s.id,s.tenant_id,s.client_id,s.root_id,s.assessment_id,s.actor_id,s.request_id,tenant,client].every(woundUuid)||s.tenant_id!==tenant||s.client_id!==client||s.evaluation_version!==planEvaluationVersion||!Number.isSafeInteger(s.sequence)||s.sequence<1||s.sequence>2147483647||!(s.previous_id===''||woundUuid(s.previous_id))||(s.sequence===1)!==(s.previous_id==='')||typeof s.actor_name!=='string'||!s.actor_name.trim()||s.actor_name.length>4000||s.title!==evaluationControlTitle)throw Error('Evaluationsherkunft, Person oder Fassungsbezug widersprüchlich.');
 const plan=decodeEvaluationPlan(s.plan,now),draft=decodeEvaluationDraft(s.draft,plan,now);
 if(plan.tenantId!==tenant||plan.clientId!==client||plan.assessmentId!==s.assessment_id||!draft.entry||(s.sequence===1)!==(draft.action==='record')||s.occurred_at!==draft.entry.evaluatedAt)throw Error('Zurückgenommene oder fremde Evaluation ist keine auswählbare Kontrollquelle.');
 const at=woundInstant(s.occurred_at),recorded=woundInstant(s.recorded_at),created=woundInstant(s.root_created_at);
 if(at===null||recorded===null||created===null||recorded<at||recorded<created||created<woundInstant(plan.updatedAt)!||recorded>BigInt(now)*1000n||(s.sequence===1&&recorded!==created))throw Error('Evaluations- und Originalzeiten widersprüchlich.');
}
/** Validate every root/history before exposing current, non-withdrawn sources. */
export function evaluationControlSources(records:EvaluationRecord[],tenant:string,assessment:string,client:string,now=Date.now()):ControlSource[]{
 const full=decodeEvaluationRecords({version:planEvaluationVersion,tenantId:tenant,assessmentId:assessment,count:records.length,records},tenant,assessment,client,now);
 return full.flatMap(r=>{const e=r.events.at(-1)!;if(!e.draft.entry)return [];
 const snapshot:EvaluationControlSnapshot={id:e.id,tenant_id:tenant,client_id:client,root_id:r.root.id,assessment_id:assessment,evaluation_version:planEvaluationVersion,sequence:e.sequence,previous_id:e.previousId,actor_id:e.actorId,actor_name:e.actorName,request_id:e.requestId,recorded_at:e.recordedAt,occurred_at:e.draft.entry.evaluatedAt,root_created_at:r.root.createdAt,title:evaluationControlTitle,plan:structuredClone(r.root.snapshot),draft:structuredClone(e.draft)};
 validateEvaluationControlSnapshot(snapshot,tenant,client,now);return [{kind:'plan_evaluation',id:e.id,snapshot}];});
}

/** Actual evaluation evidence proves reassessment, never administration or treatment. */
export function assertEvaluationControlEvidence(value:unknown,tenant:string,client:string,now=Date.now()):asserts value is EvaluationControlSnapshot{
 validateEvaluationControlSnapshot(value,tenant,client,now);
 if(value.draft.entry!.source!=='observed')throw Error('Übermittelte Evaluation ist kein eigener tatsächlich durchgeführter Prüfbeleg.');
}
export type EvaluationControlResultContext={tenantId:string;clientId:string;actorId:string;cycleAt:string;resultAt:string;recordedAt:string;complete:boolean;requireDetailed?:boolean;measureId?:string};
/** Every contextual check is repeated during historical folding, not just in the picker. */
export function assertEvaluationControlResult(evidence:ControlSource,original:ControlSource,c:EvaluationControlResultContext,now=Date.now()):void{
 if(evidence.kind!=='plan_evaluation'||original.kind!=='plan_evaluation')throw Error('Folgeevaluation gehört ausschließlich zu einem Evaluations-Prüfauftrag.');
 assertEvaluationControlEvidence(evidence.snapshot,c.tenantId,c.clientId,now);validateEvaluationControlSnapshot(original.snapshot,c.tenantId,c.clientId,now);
 const s=evidence.snapshot,o=original.snapshot,e=s.draft.entry!,cycle=woundInstant(c.cycleAt),at=woundInstant(c.resultAt),recorded=woundInstant(c.recordedAt);
 if(!woundUuid(c.actorId)||s.actor_id!==c.actorId||cycle===null||at===null||recorded===null||typeof c.complete!=='boolean')throw Error('Eigene durchführende Evaluationsperson und Auftragszeit bestätigen.');
 if(s.id!==evidence.id||o.id!==original.id||s.root_id===o.root_id||s.assessment_id!==o.assessment_id)throw Error('Ein eigenständiger neuer Evaluationsbeleg zum selben Assessment ist erforderlich.');
 if(woundInstant(s.root_created_at)!<cycle||woundInstant(e.periodStartAt)!<cycle||woundInstant(e.evaluatedAt)!>at||woundInstant(s.recorded_at)!>recorded)throw Error('Folgebeobachtung und verfügbarer Ergebnisbeleg müssen zur aktuellen Auftragsfassung passen.');
 const measureId=c.measureId??'';if(measureId)validateEvaluationMeasureScope(original,measureId,c.tenantId,c.clientId,now);
 if(!measureId&&c.complete&&e.outcome==='not_assessable')throw Error('Nicht beurteilbare Wirkung bleibt eine dokumentierte Teilprüfung, keine abgeschlossene Evaluation.');
 if(c.requireDetailed)requireMeasureReviews(e,s.plan);
 const reviews=measureId?e.measureReviews?.filter(r=>r.measureId===measureId):e.measureReviews;
 if(measureId&&reviews?.length!==1)throw Error('Tatsächliche Einzelbewertung der beauftragten Maßnahme fehlt.');
 if(reviews){if(!reviews.some(r=>r.source==='observed'))throw Error('Reine Fremdangaben belegen keine eigene Folgeprüfung.');if(c.complete&&reviews.some(r=>r.source!=='observed'||r.outcome==='not_assessable'))throw Error('Jede Maßnahme muss für den vollständigen Abschluss selbst beurteilt sein. Teilprüfung bleibt offen.');}
 const byId=new Map(s.plan.measures.map(m=>[m.id,m]));
 for(const m of o.plan.measures.filter(m=>!measureId||m.id===measureId)){const next=byId.get(m.id);if(!next||!sameEvaluationMeasure(m,next))throw Error('Alle beauftragten Originalmaßnahmen, Ziele und Kriterien müssen unverändert erneut bewertet sein.');}
}
function sameEvaluationMeasure(a:EvaluationPlan['measures'][number],b:EvaluationPlan['measures'][number]):boolean{
 return Object.keys(a).every(k=>a[k as keyof typeof a]===b[k as keyof typeof b]);
}

/** The immutable whole source remains evidence; this ID only narrows the explicit order. */
export function validateEvaluationMeasureScope(source:ControlSource,measureId:unknown,tenant:string,client:string,now=Date.now()):void{
 if(source.kind!=='plan_evaluation'||!woundUuid(measureId)||measureId!==measureId.toLowerCase())throw Error('Einzelauftrag benötigt eine native Originalmaßnahme.');
 validateEvaluationControlSnapshot(source.snapshot,tenant,client,now);
 requireMeasureReviews(source.snapshot.draft.entry,source.snapshot.plan);
 if(!source.snapshot.plan.measures.some(m=>m.id===measureId))throw Error('Auftragsmaßnahme gehört nicht zum Originalbeleg.');
}
