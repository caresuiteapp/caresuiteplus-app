import {MentalHealthOriginalReader,currentMentalHealthOriginalsWeb,type MentalHealthReceipt} from '@/lib/careAssessment/mentalHealthOriginals.web';
import {captureMentalHealthNarrativeHistory,type MentalHistoryField,type MentalHistoryTime,type MentalHistoryRisk,type MentalHistoryTopic,type MentalHistoryMeasure,type MentalHistoryEvent,type MentalHistoryEvaluation,type MentalHistoryVersion} from '@/lib/careAssessment/mentalHealthNarrativeHistory.web';
import {freezeClientNativeOriginal,type ClientNativeRow} from '@/lib/clients/clientRecordNativeOriginal.web';
import {FallRiskReviewOriginalReader,currentFallRiskReviewOriginalsWeb,isCurrentFallRiskReviewSisBindingWeb,type FallRiskReviewReceipt,type FallRiskReviewRawOriginals} from './fallRiskReviewOriginals.web';
import {treatmentRecordedTimeDisplay} from './treatmentTimeDisplay.web';
import {woundUuid,woundInstant} from './woundCareDomain';

export type FallReviewReference='exact_current_fall_snapshot'|'historical_saved_fall_snapshot'|'other_assessment_snapshot'|'other_risk_snapshot'|'unresolved';
export type FallReviewSnapshot=Readonly<{state:'missing'|'null'|'empty'|'supplied_native'|'unprojected_unknown';reference:FallReviewReference;riskId:MentalHistoryField;assessmentId:MentalHistoryField;riskKey:MentalHistoryField;risk:MentalHistoryRisk|null}>;
export type FallReviewAudit=Readonly<{id:string;entityId:MentalHistoryField;action:MentalHistoryField;summary:MentalHistoryField;author:MentalHistoryField;authorName:MentalHistoryField;recordedAt:MentalHistoryTime;before:FallReviewSnapshot;after:FallReviewSnapshot}>;
export type FallMeasure=Readonly<{savedAssociation:Readonly<{kind:'saved_risk_category';riskKey:'fall';assessmentId:string}>;measure:MentalHistoryMeasure}>;
export type FallPreventionHistory=Readonly<{
 kind:'fall_prevention_history';assessmentId:string;clientId:string;
 assessor:Readonly<{id:MentalHistoryField;name:MentalHistoryField}>;
 topics:readonly MentalHistoryTopic[];risks:readonly MentalHistoryRisk[];measures:readonly FallMeasure[];
 auditReviews:readonly FallReviewAudit[];
 events:readonly MentalHistoryEvent[];evaluations:readonly MentalHistoryEvaluation[];
 storedLinks:readonly Readonly<{id:string;fields:Readonly<Record<string,MentalHistoryField>>;author:MentalHistoryField;recordedAt:MentalHistoryTime}>[];
 savedVersions:readonly MentalHistoryVersion[];
}>;
type Binding={reader:FallRiskReviewOriginalReader;receipt:FallRiskReviewReceipt;sisReader:MentalHealthOriginalReader;sisReceipt:MentalHealthReceipt;originals:FallRiskReviewRawOriginals};
const views=new WeakMap<FallPreventionHistory,Binding>();
const plain=(value:unknown):value is ClientNativeRow=>!!value&&typeof value==='object'&&!Array.isArray(value)&&[Object.prototype,null].includes(Object.getPrototypeOf(value));
function field(row:ClientNativeRow,key:string,kind:'text'|'uuid'|'boolean'='text'):MentalHistoryField{
 if(!Object.hasOwn(row,key))return{state:'missing'};const value=row[key];if(value===null)return{state:'null',value:null};if(value===undefined)return{state:'unresolved'};
 if(typeof value==='string'&&!value.trim())return{state:'empty',value};
 if(kind==='text'&&typeof value==='string'||kind==='uuid'&&woundUuid(value)||kind==='boolean'&&typeof value==='boolean')return{state:'value',value:value as string|boolean};return{state:'unresolved'};
}
function time(row:ClientNativeRow,key:string,purpose:MentalHistoryTime['purpose']):MentalHistoryTime{
 if(!Object.hasOwn(row,key))return{purpose,state:'missing',raw:null,display:'Originalzeit fehlt'};const raw=row[key],state=raw===null?'null':raw===''?'empty':raw===undefined?'unresolved':null;
 if(state)return{purpose,state,raw:typeof raw==='string'?raw:null,display:'Originalzeit nicht bestätigt'};const result=treatmentRecordedTimeDisplay(raw);return{purpose,state:result.state==='valid'?'valid':'unresolved',raw:result.raw,display:result.display};
}
function risk(row:ClientNativeRow):MentalHistoryRisk{
 const result=Object.hasOwn(row,'focused_assessment_result')?row.focused_assessment_result:undefined;
 return{id:String(row.id),fields:Object.fromEntries(['risk_key','risk_state','urgency','evidence','protective_factors','professional_rationale','counseling_provided','person_decision','focused_assessment_key'].map(key=>[key,field(row,key)])),storedRefusal:field(row,'refusal_documented','boolean'),focusedResultState:!Object.hasOwn(row,'focused_assessment_result')?'missing':result===null?'null':result===''||plain(result)&&Object.keys(result).length===0?'empty':'unprojected_unknown',recordedAt:time(row,'created_at','recorded'),updatedAt:time(row,'updated_at','updated'),reviewAgreement:time(row,'next_review_at','review_agreement')};
}
function snapshot(row:ClientNativeRow,key:'before_data'|'after_data',originals:FallRiskReviewRawOriginals,currentFallIds:ReadonlySet<string>):FallReviewSnapshot{
 const emptyField={state:'missing' as const},unknown=(state:FallReviewSnapshot['state']):FallReviewSnapshot=>({state,reference:'unresolved',riskId:emptyField,assessmentId:emptyField,riskKey:emptyField,risk:null});
 if(!Object.hasOwn(row,key))return unknown('missing');const source=row[key];if(source===null)return unknown('null');if(source===''||plain(source)&&Object.keys(source).length===0)return unknown('empty');
 if(!plain(source)||!['id','tenant_id','assessment_id','risk_key'].every(name=>Object.hasOwn(source,name))||!woundUuid(source.id)||source.tenant_id!==originals.sis.assessment.tenant_id||!woundUuid(source.assessment_id)||typeof source.risk_key!=='string')return unknown('unprojected_unknown');
 const entity=Object.hasOwn(row,'entity_id')?row.entity_id:undefined;
 const reference:FallReviewReference=!woundUuid(entity)||entity!==source.id?'unresolved':source.assessment_id!==originals.sis.assessment.id?'other_assessment_snapshot':source.risk_key!=='fall'?'other_risk_snapshot':currentFallIds.has(String(source.id))?'exact_current_fall_snapshot':'historical_saved_fall_snapshot';
 return{state:'supplied_native',reference,riskId:field(source,'id','uuid'),assessmentId:field(source,'assessment_id','uuid'),riskKey:field(source,'risk_key'),risk:source.assessment_id===originals.sis.assessment.id&&source.risk_key==='fall'?risk(source):null};
}
function audit(row:ClientNativeRow,originals:FallRiskReviewRawOriginals,ids:ReadonlySet<string>):FallReviewAudit{return{id:String(row.id),entityId:field(row,'entity_id','uuid'),action:field(row,'action'),summary:field(row,'summary'),author:field(row,'actor_id','uuid'),authorName:field(row,'actor_name'),recordedAt:time(row,'created_at','recorded'),before:snapshot(row,'before_data',originals,ids),after:snapshot(row,'after_data',originals,ids)};}
function compareRecorded(a:FallReviewAudit,b:FallReviewAudit):number{
 const left=a.recordedAt.state==='valid'&&a.recordedAt.raw!==null?woundInstant(a.recordedAt.raw.replace(' ','T')):null,right=b.recordedAt.state==='valid'&&b.recordedAt.raw!==null?woundInstant(b.recordedAt.raw.replace(' ','T')):null;
 return left===null?(right===null?0:1):right===null?-1:left>right?-1:left<right?1:0;
}
/** Fixed original metadata. Events/evaluations/links remain generic stored records, never inferred
 * fall causality, a native FK, risk reassessment completion, intervention performance or as-of history. */
export function captureFallPreventionHistory(reader:FallRiskReviewOriginalReader,receipt:FallRiskReviewReceipt,sisReader:MentalHealthOriginalReader,sisReceipt:MentalHealthReceipt):FallPreventionHistory|null{
 if(!(reader instanceof FallRiskReviewOriginalReader)||!(sisReader instanceof MentalHealthOriginalReader)||!isCurrentFallRiskReviewSisBindingWeb(reader,receipt,sisReader,sisReceipt))return null;
 const originals=currentFallRiskReviewOriginalsWeb(reader,receipt);if(!originals||currentMentalHealthOriginalsWeb(sisReader,sisReceipt)!==originals.sis)return null;
 const source=captureMentalHealthNarrativeHistory(sisReader,sisReceipt);if(!source)return null;const fallIds=new Set(originals.sis.pools.risks.filter(row=>Object.hasOwn(row,'risk_key')&&row.risk_key==='fall').map(row=>String(row.id)));
 const audits=originals.audits.map(row=>audit(row,originals,fallIds));audits.sort(compareRecorded);
 const view=freezeClientNativeOriginal({kind:'fall_prevention_history' as const,assessmentId:source.assessmentId,clientId:source.clientId,assessor:{id:field(originals.sis.assessment,'assessor_profile_id','uuid'),name:field(originals.sis.assessment,'assessor_name_snapshot')},topics:source.topics.filter(row=>row.fields.topic_key.state==='value'&&['mobility','living_environment'].includes(String(row.fields.topic_key.value))),risks:source.risks.filter(row=>fallIds.has(row.id)),measures:source.measures.filter(row=>row.fields.related_risk_key.state==='value'&&row.fields.related_risk_key.value==='fall').map(measure=>({savedAssociation:{kind:'saved_risk_category' as const,riskKey:'fall' as const,assessmentId:source.assessmentId},measure})),auditReviews:audits,events:source.events,evaluations:source.evaluations,storedLinks:source.links,savedVersions:source.versions});
 if(currentFallRiskReviewOriginalsWeb(reader,receipt)!==originals||!isCurrentFallRiskReviewSisBindingWeb(reader,receipt,sisReader,sisReceipt)||currentMentalHealthOriginalsWeb(sisReader,sisReceipt)!==originals.sis)return null;views.set(view,{reader,receipt,sisReader,sisReceipt,originals});return view;
}
export function currentFallPreventionHistory(view:FallPreventionHistory,reader:FallRiskReviewOriginalReader):boolean{
 const own=views.get(view);return!!own&&own.reader===reader&&currentFallRiskReviewOriginalsWeb(reader,own.receipt)===own.originals&&isCurrentFallRiskReviewSisBindingWeb(reader,own.receipt,own.sisReader,own.sisReceipt)&&currentMentalHealthOriginalsWeb(own.sisReader,own.sisReceipt)===own.originals.sis;
}
/** Retained consumers must repeat this exact minted view/id gate after any awaited operation. */
export function currentFallPreventionAudit(view:FallPreventionHistory,reader:FallRiskReviewOriginalReader,id:string):FallReviewAudit|null{if(!currentFallPreventionHistory(view,reader)||!woundUuid(id))return null;return view.auditReviews.find(row=>row.id===id)??null;}
export function currentFallPreventionEvent(view:FallPreventionHistory,reader:FallRiskReviewOriginalReader,id:string):MentalHistoryEvent|null{if(!currentFallPreventionHistory(view,reader)||!woundUuid(id))return null;return view.events.find(row=>row.id===id)??null;}
export function currentFallPreventionMeasure(view:FallPreventionHistory,reader:FallRiskReviewOriginalReader,id:string):FallMeasure|null{if(!currentFallPreventionHistory(view,reader)||!woundUuid(id))return null;return view.measures.find(row=>row.measure.id===id)??null;}
