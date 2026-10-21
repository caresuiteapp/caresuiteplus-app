import {validateMeasureReviews,type EvaluationMeasureReview} from './planEvaluationMeasures.ts';
import {controlExact} from '../pflege/clinicalControlShape.ts';
import {woundUuid,woundInstant,sameWoundJson} from '../pflege/woundCareDomain.ts';
import type {CareAssessment} from '@/types/modules/careAssessment';
export const planEvaluationVersion='2026-10-09.1';
export const evaluationMeasureFields=['id','title','relatedTopicKey','relatedRiskKey','personalGoal','intervention','timing','frequency','responsibleRole','personContribution','relativesContribution','warningSigns','escalationPath','evaluationCriteria','nextEvaluationAt','status'] as const;
export type EvaluationMeasure=Record<typeof evaluationMeasureFields[number],string|null>;
export type EvaluationPlan={assessmentId:string;tenantId:string;clientId:string;version:number;draftRevision:number;updatedAt:string;status:string;measures:EvaluationMeasure[]};
export const evaluationEntryFields=['evaluatedAt','periodStartAt','periodEndAt','source','reportedBy','outcome','observedEffect','feedbackState','personFeedback','professionalConclusion','nextAction','nextActionReason','reviewState','reviewAt','reviewReason'] as const;
export type EvaluationEntryField=typeof evaluationEntryFields[number];
export type EvaluationEntry=Record<EvaluationEntryField,string>&{measureReviews?:EvaluationMeasureReview[]};
export const emptyEvaluationEntry=():EvaluationEntry=>({evaluatedAt:'',periodStartAt:'',periodEndAt:'',source:'',reportedBy:'',outcome:'',observedEffect:'',feedbackState:'',personFeedback:'',professionalConclusion:'',nextAction:'',nextActionReason:'',reviewState:'',reviewAt:'',reviewReason:''});
export type EvaluationDraft={action:'record'|'replace'|'void';entry:EvaluationEntry|null;reason:string};
export type EvaluationRequest={version:typeof planEvaluationVersion;assessmentId:string;rootId:string;expectedHeadId:string;expectedSequence:number;snapshot:EvaluationPlan;draft:EvaluationDraft};
export type EvaluationEvent={id:string;rootId:string;sequence:number;previousId:string;requestId:string;recordedAt:string;actorId:string;actorName:string;draft:EvaluationDraft};
export type EvaluationRecord={root:{id:string;tenantId:string;assessmentId:string;snapshot:EvaluationPlan;createdAt:string};events:EvaluationEvent[];headId:string;eventCount:number};
const texts=(v:Record<string,unknown>,keys:readonly string[])=>{for(const k of keys)if(typeof v[k]!=='string'||(v[k] as string).length>4000)throw Error(`Evaluationsangabe ${k} ungültig.`);};
const needed=(v:Record<string,unknown>,keys:readonly string[])=>{texts(v,keys);for(const k of keys)if(!(v[k] as string).trim())throw Error(`Evaluationsangabe ${k} fehlt.`);};
const instant=(v:unknown)=>{const t=woundInstant(v);if(t===null)throw Error('Tatsächlichen Zeitpunkt mit Zeitzone erfassen.');return t;};
const validNow=(now:number)=>{if(!Number.isSafeInteger(now))throw Error('Prüfzeit ungültig.');return BigInt(now)*1000n;};
/** Shared native measure validation; the historical plan decoder separately requires at least one measure. */
export function validateEvaluationPlanMeasures(measures:unknown):asserts measures is EvaluationMeasure[]{
 if(!Array.isArray(measures)||measures.length>200)throw Error('Bewertete Maßnahmenliste fehlt oder ist ungültig.');
 const ids=new Set<string>();for(const m of measures){if(!controlExact(m,[...evaluationMeasureFields])||!woundUuid(m.id)||ids.has(m.id)||!['planned','active','paused','completed','cancelled'].includes(m.status as string))throw Error('Bewertete Maßnahme fehlt, ist doppelt oder ungültig.');ids.add(m.id);for(const k of evaluationMeasureFields){if(['relatedTopicKey','relatedRiskKey','nextEvaluationAt'].includes(k)&&m[k]===null)continue;texts(m,[k]);}needed(m,['title','personalGoal','intervention','timing','frequency','responsibleRole','evaluationCriteria']);if(m.nextEvaluationAt!==null)instant(m.nextEvaluationAt);}
}
export function decodeEvaluationPlan(value:unknown,now=Date.now()):EvaluationPlan{
 const end=validNow(now);if(!controlExact(value,['assessmentId','tenantId','clientId','version','draftRevision','updatedAt','status','measures'])||![value.assessmentId,value.tenantId,value.clientId].every(woundUuid)||!Number.isSafeInteger(value.version)||(value.version as number)<1||(value.version as number)>2147483647||!Number.isSafeInteger(value.draftRevision)||(value.draftRevision as number)<0||(value.draftRevision as number)>2147483647||!['draft','in_progress','approved'].includes(value.status as string)||instant(value.updatedAt)>end||!Array.isArray(value.measures)||!value.measures.length||value.measures.length>200)throw Error('Bewerteter eigener Planstand fehlt oder ist unvollständig.');
 validateEvaluationPlanMeasures(value.measures);
 return structuredClone(value) as EvaluationPlan;
}
export function captureEvaluationPlan(a:CareAssessment,selected:string[],now=Date.now()):EvaluationPlan{
 if(a.subjectType!=='client'||new Set(selected).size!==selected.length||!selected.length||selected.some(id=>a.measures.filter(m=>m.id===id).length!==1))throw Error('Tatsächliche gespeicherte Maßnahmen ausdrücklich auswählen.');
 return decodeEvaluationPlan({assessmentId:a.id,tenantId:a.tenantId,clientId:a.subjectId,version:a.version,draftRevision:a.draftRevision,updatedAt:a.updatedAt,status:a.status,measures:selected.map(id=>{const m=a.measures.find(x=>x.id===id)!;return Object.fromEntries(evaluationMeasureFields.map(k=>[k,m[k]]));})},now);
}
export function decodeEvaluationDraft(v:unknown,plan:EvaluationPlan,now=Date.now()):EvaluationDraft{
 if(!controlExact(v,['action','entry','reason'])||!['record','replace','void'].includes(v.action as string))throw Error('Evaluationshandlung ungültig.');texts(v,['reason']);if(v.action==='record'){if(v.reason!=='')throw Error('Ersteintrag trägt keinen Berichtigungsgrund.');}else needed(v,['reason']);
 if(v.action==='void'){if(v.entry!==null)throw Error('Rücknahme darf keine neue Wirkung behaupten.');return structuredClone(v) as EvaluationDraft;}
 const e=v.entry;const detailed=!!e&&typeof e==='object'&&Object.hasOwn(e,'measureReviews');if(!controlExact(e,[...evaluationEntryFields,...(detailed?['measureReviews']:[])]))throw Error('Evaluationsfelder fehlen oder sind fremd.');texts(e,evaluationEntryFields);needed(e,evaluationEntryFields.filter(k=>!['reportedBy','reviewAt'].includes(k)));
 const at=instant(e.evaluatedAt),from=instant(e.periodStartAt),to=instant(e.periodEndAt);if(from<instant(plan.updatedAt)||from>to||to>at||at>validNow(now))throw Error('Beobachtungszeitraum muss zum festgehaltenen Planstand passen und vor der tatsächlichen Evaluation liegen.');
 if(!['observed','reported'].includes(e.source as string)||(e.source==='observed'&&e.reportedBy!==''))throw Error('Eigene Wirkung und übermittelte Angaben trennen.');if(e.source==='reported')needed(e,['reportedBy']);
 if(!['effective','partly_effective','not_effective','deteriorated','not_assessable'].includes(e.outcome as string)||!['given','declined','not_possible'].includes(e.feedbackState as string)||!['continue','adjust','reassess','clarify'].includes(e.nextAction as string)||!['scheduled','pending','not_required'].includes(e.reviewState as string))throw Error('Ergebnis, Personenrückmeldung und nächste Entscheidung ausdrücklich wählen.');
 if(e.reviewState==='scheduled'){if(instant(e.reviewAt)<at)throw Error('Vereinbarter Prüftermin liegt vor der Evaluation.');}else if(e.reviewAt!=='')throw Error('Unvereinbarten Prüftermin entfernen.');
 if(detailed)validateMeasureReviews(e.measureReviews,e as EvaluationEntry,plan);
 return structuredClone(v) as EvaluationDraft;
}
const freeze=(v:object):void=>{Object.freeze(v);for(const x of Object.values(v))if(x&&typeof x==='object')freeze(x);};
export function snapshotEvaluationRequest(v:unknown,now=Date.now()):EvaluationRequest{
 if(!controlExact(v,['version','assessmentId','rootId','expectedHeadId','expectedSequence','snapshot','draft'])||v.version!==planEvaluationVersion||![v.assessmentId,v.rootId].every(woundUuid)||!Number.isSafeInteger(v.expectedSequence)||(v.expectedSequence as number)<0||(v.expectedSequence as number)>2147483646||(v.expectedHeadId!==''&&!woundUuid(v.expectedHeadId)))throw Error('Evaluationsauftrag oder Originalkennung ungültig.');
 const p=decodeEvaluationPlan(v.snapshot,now),d=decodeEvaluationDraft(v.draft,p,now);if(p.assessmentId!==v.assessmentId||(d.action==='record'?(v.expectedHeadId!==''||v.expectedSequence!==0):(v.expectedHeadId===''||v.expectedSequence===0)))throw Error('Evaluationsauftrag passt nicht zum ursprünglichen Planbezug.');
 const r=structuredClone({...v,snapshot:p,draft:d}) as EvaluationRequest;if(new TextEncoder().encode(JSON.stringify(r)).length>262144)throw Error('Evaluationsauftrag ist zu umfangreich.');freeze(r);return r;
}
export function decodeEvaluationRecords(value:unknown,tenant:string,assessment:string,client:string,now=Date.now()):EvaluationRecord[]{
 if(!woundUuid(tenant)||!woundUuid(assessment)||!woundUuid(client)||!controlExact(value,['version','tenantId','assessmentId','count','records'])||value.version!==planEvaluationVersion||value.tenantId!==tenant||value.assessmentId!==assessment||!Array.isArray(value.records)||value.count!==value.records.length)throw Error('Eigener Evaluationsbestand fehlt oder ist unvollständig.');
 const roots=new Set<string>(),events=new Set<string>(),requests=new Set<string>();
 for(const r of value.records){
  if(!controlExact(r,['root','events','headId','eventCount'])||!controlExact(r.root,['id','tenantId','assessmentId','snapshot','createdAt'])||!woundUuid(r.root.id)||roots.has(r.root.id)||r.root.tenantId!==tenant||r.root.assessmentId!==assessment||!Array.isArray(r.events)||!r.events.length||r.eventCount!==r.events.length)throw Error('Evaluationsoriginal fehlt, ist fremd oder doppelt.');roots.add(r.root.id);
  const rootAt=instant(r.root.createdAt);if(rootAt>validNow(now))throw Error('Originalzeit liegt in der Zukunft.');const p=decodeEvaluationPlan(r.root.snapshot,now);if(p.assessmentId!==assessment||p.tenantId!==tenant||p.clientId!==client||instant(p.updatedAt)>rootAt)throw Error('Historischer Planbezug widersprüchlich.');
  let head='',last=rootAt,current:EvaluationEntry|null=null;
  for(let i=0;i<r.events.length;i++){
   const e=r.events[i];if(!controlExact(e,['id','rootId','sequence','previousId','requestId','recordedAt','actorId','actorName','draft'])||(!woundUuid(e.id)||!woundUuid(e.requestId)||!woundUuid(e.actorId))||events.has(e.id)||requests.has(e.requestId)||e.rootId!==r.root.id||e.sequence!==i+1||e.previousId!==head)throw Error('Vollständiger Evaluationsverlauf fehlt oder ist doppelt.');events.add(e.id);requests.add(e.requestId);needed(e,['actorName']);const at=instant(e.recordedAt);if(at<last||at>validNow(now)||(i===0&&at!==rootAt))throw Error('Evaluations-Erfassungsfolge widersprüchlich.');
   const d=decodeEvaluationDraft(e.draft,p,Number(at/1000n)+1); // Exact event boundary is checked below, including microseconds.
   if(d.entry&&instant(d.entry.evaluatedAt)>at)throw Error('Evaluation vor tatsächlicher Beobachtung erfasst.');
   if(i===0?d.action!=='record':d.action==='record'||current===null)throw Error('Originalfolge oder zurückgenommene Evaluation widersprüchlich.');if(d.action==='replace'&&sameWoundJson(d.entry,current))throw Error('Unveränderte Evaluation ist keine Berichtigung.');current=d.entry;head=e.id;last=at;
  }
  if(head!==r.headId)throw Error('Aktueller Evaluationskopf fehlt.');
 }
 return structuredClone(value.records) as EvaluationRecord[];
}
export function assertEvaluationRevision(p:EvaluationRequest,record:EvaluationRecord|null,tenant:string,now=Date.now(),captured:EvaluationRecord|null=null){
 snapshotEvaluationRequest(p,now);if(p.snapshot.tenantId!==tenant)throw Error('Fremder Evaluationsplan.');if(p.draft.action==='record'){if(record)throw Error('Original bereits vorhanden.');return;}
 if(!record)throw Error('Original nicht mehr zugänglich.');decodeEvaluationRecords({version:planEvaluationVersion,tenantId:tenant,assessmentId:p.assessmentId,count:1,records:[record]},tenant,p.assessmentId,p.snapshot.clientId,now);if(captured&&!sameWoundJson(captured,record))throw Error('Originalverlauf oder Personenbelege inzwischen geändert.');const head=record.events.at(-1)!;if(record.root.id!==p.rootId||record.headId!==p.expectedHeadId||head.sequence!==p.expectedSequence||!head.draft.entry||!sameWoundJson(record.root.snapshot,p.snapshot))throw Error('Historischer Planstand oder aktueller Evaluationskopf geändert.');if(p.draft.action==='replace'&&sameWoundJson(p.draft.entry,head.draft.entry))throw Error('Keine tatsächliche Berichtigung.');
}
