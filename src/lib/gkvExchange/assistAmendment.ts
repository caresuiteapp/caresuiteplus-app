import { UUID } from './sources';
import type { AssistOriginalRpc } from './assistOriginal';

export type AssistAmendment = {
  id:string; proofId:string; proofHash:string; revision:number; previousId:string|null;
  actorId:string; employeeId:string; recordedAt:string; description:string; reason:string;
};
export type AmendmentScope = {tenantId:string; assignmentId:string; actorId:string; employeeId:string; proofId:string; proofHash:string};
export type AmendmentInput = Pick<AssistAmendment,'proofId'|'proofHash'|'revision'|'previousId'|'description'|'reason'>;
export type AmendmentState = AmendmentScope & {
  contract:'gkv-assist-amendments-v1'; originalText:string; revision:number; before:number|null;
  nextBefore:number|null; entries:AssistAmendment[]; lookup:AssistAmendment|null;
};
type Row = Record<string,unknown>;
const row=(v:unknown):v is Row=>!!v&&typeof v==='object'&&!Array.isArray(v);
const uuid=(v:unknown):v is string=>typeof v==='string'&&UUID.test(v);
const hash=(v:unknown):v is string=>typeof v==='string'&&/^sha256:[0-9a-f]{64}$/.test(v);
const integer=(v:unknown):v is number=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=0;
const exact=(v:Row,keys:string[])=>Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
const clean=(v:unknown,min:number,max:number):v is string=>typeof v==='string'&&v===v.trim()&&Array.from(v).length>=min&&Array.from(v).length<=max&&!/[\u0000-\u0009\u000b-\u001f\u007f-\u009f\u061c\u200b-\u200f\u2028-\u202e\u2060-\u206f\ufeff]/u.test(v);
const invalid=():never=>{throw Error('Die gespeicherte Berichtigung passt nicht zur angezeigten Originalfassung.');};
export function readAssistAmendment(v:unknown,proof:unknown,sourceHash:unknown,employee:unknown,actor?:string):AssistAmendment{
  if(!row(v)||!exact(v,['id','proofId','proofHash','revision','previousId','actorId','employeeId','recordedAt','description','reason'])
    ||!uuid(v.id)||!uuid(v.proofId)||v.proofId!==proof||!hash(v.proofHash)||v.proofHash!==sourceHash||!uuid(v.employeeId)||v.employeeId!==employee
    ||!uuid(v.actorId)||(actor!==undefined&&actor!==v.actorId)||!integer(v.revision)||v.revision<1
    ||(v.revision===1?v.previousId!==null:!uuid(v.previousId)||v.previousId===v.id)
    ||typeof v.recordedAt!=='string'||!/^\d{4}-\d\d-\d\dT/.test(v.recordedAt)||!Number.isFinite(Date.parse(v.recordedAt))
    ||!clean(v.reason,5,400)||!clean(v.description,3,1500))return invalid();
  return v as AssistAmendment;
}
export function amendmentHeading(a:AssistAmendment):string{
  return 'Berichtigung '+a.revision+' vom '+new Date(a.recordedAt).toLocaleString('de-DE',{timeZone:'Europe/Berlin',dateStyle:'short',timeStyle:'short'})+' Uhr';
}
export function readAmendmentState(v:unknown,s:AmendmentScope,before:number|null,lookup:string|null):AmendmentState{
  if(!row(v)||!exact(v,['contract','tenantId','assignmentId','actorId','employeeId','proofId','proofHash','originalText','revision','before','nextBefore','entries','lookup'])
    ||v.contract!=='gkv-assist-amendments-v1'||!uuid(s.tenantId)||!uuid(s.assignmentId)||!uuid(s.actorId)||!uuid(s.employeeId)||!uuid(s.proofId)||!hash(s.proofHash)
    ||v.tenantId!==s.tenantId||v.assignmentId!==s.assignmentId||v.actorId!==s.actorId||v.employeeId!==s.employeeId||v.proofId!==s.proofId||v.proofHash!==s.proofHash
    ||!integer(v.revision)||v.before!==before||(before!==null&&(!integer(before)||before<2||before>v.revision))
    ||(lookup!==null&&!uuid(lookup))||typeof v.originalText!=='string'||!v.originalText.trim()||!Array.isArray(v.entries))return invalid();
  const top=before===null?v.revision:before-1;
  if(v.entries.length!==Math.min(top,10))return invalid();
  const list=v.entries.map(a=>readAssistAmendment(a,s.proofId,s.proofHash,s.employeeId,s.actorId));
  if(new Set(list.map(a=>a.id)).size!==list.length||list.some((a,i)=>a.revision!==top-i||i>0&&(list[i-1].previousId!==a.id||Date.parse(list[i-1].recordedAt)<Date.parse(a.recordedAt))))return invalid();
  if(v.nextBefore!==(top>10?top-9:null))return invalid();
  if(v.lookup!==null){const a=readAssistAmendment(v.lookup,s.proofId,s.proofHash,s.employeeId,s.actorId);if(a.id!==lookup||a.revision>v.revision)return invalid();}
  return v as unknown as AmendmentState;
}
export class AmendmentRpcError extends Error{
  readonly uncertain:boolean;
  constructor(message:string,uncertain:boolean){super(message);this.uncertain=uncertain;}
}
function failure(e:unknown){
  const code=row(e)?String(e.code):'';
  if(code==='42501')return new AmendmentRpcError('Die Berichtigung benötigt den aktiven Zugang der ursprünglich eingesetzten Pflegekraft.',false);
  if((code==='40001'||code==='PT409')||code==='23505')return new AmendmentRpcError('Der Nachweisstand hat sich geändert. Bitte den Verlauf neu laden und die Angaben prüfen.',false);
  if(/^22/.test(code))return new AmendmentRpcError('Bitte eine geänderte Beschreibung und eine nachvollziehbare Begründung eintragen.',false);
  return new AmendmentRpcError('Die Speicherung konnte nicht eindeutig bestätigt werden.',true);
}
export async function loadAmendments(rpc:AssistOriginalRpc,s:AmendmentScope,before:number|null=null,lookup:string|null=null){
  const r=await rpc('gkv_assist_amendment_state',{t:s.tenantId,a_id:s.assignmentId,p_before:before,p_lookup:lookup});
  if(r.error){if(before===null&&lookup===null&&row(r.error)&&r.error.code==='PGRST202'&&String(r.error.message).includes('gkv_assist_amendment_state'))return null;throw failure(r.error);}
  return readAmendmentState(r.data,s,before,lookup);
}
export function assertAmendmentResult(v:unknown,s:AmendmentScope,id:string,input:AmendmentInput){
  const a=readAssistAmendment(v,s.proofId,s.proofHash,s.employeeId,s.actorId);
  if(!uuid(id)||a.id!==id||a.revision!==input.revision+1||a.previousId!==input.previousId||a.description!==input.description||a.reason!==input.reason||a.proofId!==input.proofId||a.proofHash!==input.proofHash)return invalid();
  return a;
}
export async function saveAmendment(rpc:AssistOriginalRpc,s:AmendmentScope,id:string,input:AmendmentInput){
  if(!uuid(id)||input.proofId!==s.proofId||input.proofHash!==s.proofHash||!integer(input.revision)
    ||(input.revision===0?input.previousId!==null:!uuid(input.previousId))||!clean(input.description,3,1500)||!clean(input.reason,5,400))
    throw new AmendmentRpcError('Bitte die Beschreibung und die Begründung prüfen.',false);
  const r=await rpc('gkv_assist_amend_description',{t:s.tenantId,a_id:s.assignmentId,p_request:id,p_input:input});
  if(r.error)throw failure(r.error);
  return assertAmendmentResult(r.data,s,id,input);
}
