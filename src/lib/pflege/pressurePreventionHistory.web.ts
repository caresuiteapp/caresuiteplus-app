import {PressurePreventionOriginalReader,type PressurePreventionReceipt,type PressurePreventionRawOriginals} from './pressurePreventionOriginals.web';
import {freezeClientNativeOriginal,type ClientNativeRow} from '@/lib/clients/clientRecordNativeOriginal.web';
import {treatmentRecordedTimeDisplay} from './treatmentTimeDisplay.web';
import {woundInstant,woundUuid} from './woundCareDomain';

export type PressureHistoryField=Readonly<{state:'missing'|'null'|'empty'|'value'|'unresolved';value?:string|number|boolean|null}>;
export type PressureHistoryTime=Readonly<{purpose:'assessment'|'recorded'|'updated'|'review_agreement';state:'valid'|'missing'|'null'|'empty'|'unresolved';raw:string|null;display:string}>;
export type PressureHistoryAssessment=Readonly<{id:string;classification:PressureHistoryField;presentOnAdmission:PressureHistoryField;assessor:PressureHistoryField;measurements:Readonly<Record<string,PressureHistoryField>>;tissue:Readonly<Record<string,PressureHistoryField>>;pressureReliefPlan:Readonly<Record<string,PressureHistoryField>>;treatmentPlan:Readonly<Record<string,PressureHistoryField>>;escalationFlags:Readonly<{state:PressureHistoryField['state'];values:readonly string[]}>;assessedAt:PressureHistoryTime;recordedAt:PressureHistoryTime;updatedAt:PressureHistoryTime;reviewAgreement:PressureHistoryTime}>;
export type PressureHistoryEvent=Readonly<{id:string;eventType:PressureHistoryField;note:PressureHistoryField;author:PressureHistoryField;recordedAt:PressureHistoryTime;assessmentReference:Readonly<{state:'supplied_reference'|'not_supplied'|'unresolved';assessmentId:string|null}>}>;
export type PressurePreventionHistory=Readonly<{kind:'pressure_prevention_history';markerId:string;assessments:readonly PressureHistoryAssessment[];history:readonly PressureHistoryEvent[]}>;
type Binding={reader:PressurePreventionOriginalReader;receipt:PressurePreventionReceipt;originals:PressurePreventionRawOriginals};
const views=new WeakMap<PressurePreventionHistory,Binding>();
const plain=(v:unknown):v is ClientNativeRow=>!!v&&typeof v==='object'&&!Array.isArray(v)&&[Object.prototype,null].includes(Object.getPrototypeOf(v));
function field(row:ClientNativeRow,key:string,kind:'text'|'number'|'boolean'|'uuid'='text'):PressureHistoryField{
 if(!Object.hasOwn(row,key))return{state:'missing'};const value=row[key];if(value===null)return{state:'null',value:null};if(value===undefined)return{state:'unresolved'};
 if(typeof value==='string'&&!value.trim())return{state:'empty',value};
 if(kind==='text'&&typeof value==='string'||kind==='number'&&typeof value==='number'&&Number.isFinite(value)||kind==='boolean'&&typeof value==='boolean'||kind==='uuid'&&woundUuid(value))return{state:'value',value:value as string|number|boolean};
 return{state:'unresolved'};
}
function nested(row:ClientNativeRow,key:string,keys:readonly string[],kind:'text'|'number'):Readonly<Record<string,PressureHistoryField>>{
 const object=row[key];if(plain(object))return Object.fromEntries(keys.map(k=>[k,field(object,k,kind)]));
 const state:PressureHistoryField['state']=!Object.hasOwn(row,key)?'missing':object===null?'null':object===''?'empty':'unresolved';
 return Object.fromEntries(keys.map(k=>[k,{state}]));
}
function time(row:ClientNativeRow,key:string,purpose:PressureHistoryTime['purpose']):PressureHistoryTime{
 if(!Object.hasOwn(row,key))return{purpose,state:'missing',raw:null,display:'Originalzeit fehlt'};
 const raw=row[key];const state=raw===null?'null':raw===''?'empty':raw===undefined?'unresolved':null;
 if(state)return{purpose,state,raw:typeof raw==='string'?raw:null,display:'Originalzeit nicht bestätigt'};
 const shown=treatmentRecordedTimeDisplay(raw);return{purpose,state:shown.state==='valid'?'valid':'unresolved',raw:shown.raw,display:shown.display};
}
function flags(row:ClientNativeRow):PressureHistoryAssessment['escalationFlags']{
 const v=row.escalation_flags;if(!Object.hasOwn(row,'escalation_flags'))return{state:'missing',values:[]};if(v===null)return{state:'null',values:[]};if(v==='')return{state:'empty',values:[]};
 return Array.isArray(v)&&v.every(x=>typeof x==='string')?{state:v.length?'value':'empty',values:[...v]}:{state:'unresolved',values:[]};
}
function eventReference(row:ClientNativeRow,ids:Set<string>):PressureHistoryEvent['assessmentReference']{
 if(!plain(row.snapshot)||!Object.hasOwn(row.snapshot,'assessmentId'))return{state:'not_supplied',assessmentId:null};const id=row.snapshot.assessmentId;
 if(!woundUuid(id))return{state:'unresolved',assessmentId:null};return{state:ids.has(id.toLowerCase())?'supplied_reference':'unresolved',assessmentId:id};
}
function compareTime(a:PressureHistoryTime,b:PressureHistoryTime):number{
 const left=a.state==='valid'&&a.raw!==null?woundInstant(a.raw.replace(' ','T')):null,right=b.state==='valid'&&b.raw!==null?woundInstant(b.raw.replace(' ','T')):null;
 return left===null?(right===null?0:1):right===null?-1:left>right?-1:left<right?1:0;
}
/** Safe current metadata projection of complete private originals. A supplied mutable assessment row is not
 * its historical as-of plan. A referenced history snapshot is not a complete assessment revision or a new review. */
export function capturePressurePreventionHistory(reader:PressurePreventionOriginalReader,receipt:PressurePreventionReceipt):PressurePreventionHistory|null{
 if(!(reader instanceof PressurePreventionOriginalReader))return null;const originals=reader.currentOriginals(receipt);if(!originals)return null;
 const assessments=originals.assessments.map(row=>({id:String(row.id),classification:field(row,'classification'),presentOnAdmission:field(row,'present_on_admission','boolean'),assessor:field(row,'assessed_by','uuid'),
  measurements:Object.fromEntries(['length_cm','width_cm','depth_cm','area_cm2','undermining_clock_from','undermining_clock_to','undermining_max_depth_cm'].map(k=>[k,field(row,k,'number')])),
  tissue:nested(row,'tissue_percentages',['granulation','fibrin','nekrose'],'number'),pressureReliefPlan:nested(row,'pressure_relief_plan',['positioning','interval','aids','mobility'],'text'),treatmentPlan:nested(row,'treatment_plan',['cleansing','dressing','interval'],'text'),escalationFlags:flags(row),
  assessedAt:time(row,'assessed_at','assessment'),recordedAt:time(row,'created_at','recorded'),updatedAt:time(row,'updated_at','updated'),reviewAgreement:time(row,'next_review_at','review_agreement')}));
 const ids=new Set(assessments.map(row=>row.id.toLowerCase()));const history=originals.history.map(row=>({id:String(row.id),eventType:field(row,'event_type'),note:field(row,'note'),author:field(row,'created_by','uuid'),recordedAt:time(row,'created_at','recorded'),assessmentReference:eventReference(row,ids)}));
 // Sort only new projection arrays. UUID page order and source arrays remain unchanged; equal instants keep input order.
 assessments.sort((a,b)=>compareTime(a.assessedAt,b.assessedAt));history.sort((a,b)=>compareTime(a.recordedAt,b.recordedAt));
 if(!reader.current(receipt))return null;const view=freezeClientNativeOriginal({kind:'pressure_prevention_history' as const,markerId:String(originals.marker.id),assessments,history});
 if(!reader.current(receipt))return null;views.set(view,{reader,receipt,originals});return view;
}
/** Retained selection/expand handlers must call this at invocation, before consuming metadata. */
export function currentPressurePreventionHistory(view:PressurePreventionHistory,reader:PressurePreventionOriginalReader):boolean{
 const own=views.get(view);return!!own&&own.reader===reader&&reader.currentOriginals(own.receipt)===own.originals;
}
export function currentPressurePreventionAssessment(view:PressurePreventionHistory,reader:PressurePreventionOriginalReader,id:string):PressureHistoryAssessment|null{
 if(!currentPressurePreventionHistory(view,reader)||!woundUuid(id))return null;return view.assessments.find(row=>row.id===id)??null;
}
export function currentPressurePreventionEvent(view:PressurePreventionHistory,reader:PressurePreventionOriginalReader,id:string):PressureHistoryEvent|null{
 if(!currentPressurePreventionHistory(view,reader)||!woundUuid(id))return null;return view.history.find(row=>row.id===id)??null;
}
