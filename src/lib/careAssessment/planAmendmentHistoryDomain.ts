import {controlExact} from '../pflege/clinicalControlShape.ts';
import {woundInstant,woundUuid} from '../pflege/woundCareDomain.ts';
import {snapshotPlanAmendment,type PlanAmendmentRequest} from './planAmendmentDomain.ts';
import {assertPlanAmendmentReceipt} from './planAmendmentRuntime.ts';
export const planAmendmentHistoryVersion='2026-10-11.1';
export type PlanAmendmentHistoryRecord={id:string;requestId:string;actorId:string;actorName:string;recordedAt:string;payload:PlanAmendmentRequest;result:Record<string,unknown>};
/** Validate stored originals, never against today's mutable evaluation or plan. */
export function decodePlanAmendmentHistory(value:unknown,tenant:string,assessment:string,client:string,now=Date.now()):PlanAmendmentHistoryRecord[]{
 if(!Number.isSafeInteger(now)||now<0)throw Error('Tatsächlichen Lesezeitpunkt prüfen.');
 if(![tenant,assessment,client].every(woundUuid)||!controlExact(value,['version','tenantId','assessmentId','count','records'])||value.version!==planAmendmentHistoryVersion||value.tenantId!==tenant||value.assessmentId!==assessment||!Array.isArray(value.records)||value.records.length>2000||value.count!==value.records.length||new TextEncoder().encode(JSON.stringify(value)).length>33554432)throw Error('Änderungshistorie fehlt, ist unvollständig oder gehört zu einer anderen Pflegeakte.');
 const ids=new Set<string>(),requests=new Set<string>(),revisions=new Set<number>();
 const records=value.records.map((r:unknown)=>{
  if(!controlExact(r,['id','requestId','actorId','actorName','recordedAt','payload','result'])||![r.id,r.requestId,r.actorId].every(woundUuid)||typeof r.actorName!=='string'||!r.actorName.trim()||r.actorName.length>4000)throw Error('Originalbeleg und tatsächliche Fachperson der Änderung fehlen.');
  const at=woundInstant(r.recordedAt);if(at===null||at>BigInt(now)*1000n)throw Error('Tatsächlichen Speicherzeitpunkt der Änderung prüfen.');
  // Historical review dates may have passed; validity is anchored to preparation.
  const p=snapshotPlanAmendment(r.payload,now);
  if(p.target.tenantId!==tenant||p.target.assessmentId!==assessment||p.target.clientId!==client||at<woundInstant(p.preparedAt)!)throw Error('Historischer Pflegefall oder zeitlicher Änderungsbezug widersprüchlich.');
  if(['active','planned'].includes(p.proposed.status!)&&woundInstant(p.proposed.nextEvaluationAt)!<=at)throw Error('Der vereinbarte Prüftermin lag bei der bestätigten Änderung nicht in der Zukunft.');
  const receipt=assertPlanAmendmentReceipt(r.result,p,r.requestId as string);
  const result=r.result as Record<string,unknown>;
  if(receipt.id!==r.id||ids.has((r.id as string).toLowerCase())||requests.has((r.requestId as string).toLowerCase())||revisions.has(result.draftRevision as number))throw Error('Doppelter oder widersprüchlicher Änderungsbeleg.');
  ids.add((r.id as string).toLowerCase());requests.add((r.requestId as string).toLowerCase());revisions.add(result.draftRevision as number);
  const record=structuredClone({...r,payload:p}) as PlanAmendmentHistoryRecord;
  const freeze=(o:object):void=>{Object.freeze(o);for(const v of Object.values(o))if(v&&typeof v==='object')freeze(v);};freeze(record);return record;
 });
 // Revision gaps are valid: general draft saves are outside this history.
 const sequence=[...records].sort((a,b)=>(a.result.draftRevision as number)-(b.result.draftRevision as number));
 for(let i=1;i<sequence.length;i++){
  const previous=sequence[i-1],current=sequence[i];
  if(current.payload.target.draftRevision<(previous.result.draftRevision as number)||woundInstant(current.payload.target.updatedAt)!<woundInstant(previous.recordedAt)!)throw Error('Historische Änderungsfolge enthält überlappende Revisionen oder einen veralteten Zielstand.');
 }
 return sequence.reverse();
}
