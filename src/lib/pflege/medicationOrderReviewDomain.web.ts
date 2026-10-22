import {assertMedicationOrderRevision,medicationOrderRevisionInstant,type MedicationOrderRevision,type MedicationOrderRevisionScope} from './medicationOrderRevisionDomain.web.ts';
import {sameWoundJson,woundUuid} from './woundCareDomain.ts';

export type MedicationOrderReviewAction='request'|'authorize'|'reject'|'revoke';
type ReviewBase=MedicationOrderRevisionScope&{schemaVersion:1;requestId:string;actorId:string;action:MedicationOrderReviewAction};
export type MedicationOrderReviewPacket=(ReviewBase&{action:'request';revisionId:string;reason:string})|(ReviewBase&{action:'authorize'|'reject'|'revoke';reviewRequestId:string;reviewReference:string});
export type MedicationOrderReviewRequest=MedicationOrderRevisionScope&{id:string;revisionId:string;creatorId:string;createdAt:string;expiresAt:string;reason:string;revision:MedicationOrderRevision};
export type MedicationOrderReviewDecision={action:'authorize'|'reject'|'revoke';actorId:string;recordedAt:string;reviewReference:string};
export type MedicationOrderReviewAuthorization={id:string;tenantId:string;revisionId:string;actorId:string;reviewedBy:string;reviewReference:string;issuedAt:string;expiresAt:string;revokedAt:string|null;proposalFingerprint:string;nativeBeforeFingerprint:string;sourceFingerprint:string;archiveFingerprint:string};
export type MedicationOrderReviewItem={request:MedicationOrderReviewRequest;decision:MedicationOrderReviewDecision|null;authorization:MedicationOrderReviewAuthorization|null;revocation:MedicationOrderReviewDecision|null};
export type MedicationOrderReviewReceipt={requestId:string;action:MedicationOrderReviewAction;actorId:string;recordedAt:string;item:MedicationOrderReviewItem};
export type MedicationOrderApplyPacket={requestId:string;revisionId:string;authorizationId:string;reason:string};
const obj=(v:unknown):Record<string,unknown>|null=>!!v&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:null;
const exact=(v:Record<string,unknown>,keys:string[])=>Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
const text=(v:unknown,min=10,max=2000):v is string=>typeof v==='string'&&v.trim().length>=min&&v.length<=max;
const instant=(v:unknown)=>medicationOrderRevisionInstant(v);
const fp=(v:unknown)=>typeof v==='string'&&/^sha256:[0-9a-f]{64}$/.test(v);
const sameScope=(r:Record<string,unknown>,s:MedicationOrderRevisionScope)=>r.tenantId===s.tenantId&&r.clientId===s.clientId&&r.medicationId===s.medicationId;
function freeze<T>(v:T):T{if(v&&typeof v==='object'){Object.freeze(v);Object.values(v).forEach(freeze);}return v;}
export function medicationOrderReviewPacketIssue(value:unknown):string|null{
 const p=obj(value);if(!p||!['request','authorize','reject','revoke'].includes(String(p.action))||!exact(p,p.action==='request'?['schemaVersion','requestId','tenantId','clientId','medicationId','actorId','action','revisionId','reason']:['schemaVersion','requestId','tenantId','clientId','medicationId','actorId','action','reviewRequestId','reviewReference'])||p.schemaVersion!==1||![p.requestId,p.tenantId,p.clientId,p.medicationId,p.actorId,p.action==='request'?p.revisionId:p.reviewRequestId].every(woundUuid)||!text(p.action==='request'?p.reason:p.reviewReference))return 'Eigener Prüfauftrag, unveränderte Fassung und eine Begründung ab zehn Zeichen sind erforderlich.';
 return null;
}
export function makeMedicationOrderReviewPacket(value:MedicationOrderReviewPacket):MedicationOrderReviewPacket{const p=structuredClone(value);if(p.action==='request'&&typeof p.reason==='string')p.reason=p.reason.trim();else if(p.action!=='request'&&typeof p.reviewReference==='string')p.reviewReference=p.reviewReference.trim();const issue=medicationOrderReviewPacketIssue(p);if(issue)throw Error(issue);return freeze(p);}
function decision(value:unknown,allowed:string[]):MedicationOrderReviewDecision{const d=obj(value);if(!d||!exact(d,['action','actorId','recordedAt','reviewReference'])||!allowed.includes(String(d.action))||!woundUuid(d.actorId)||instant(d.recordedAt)===null||!text(d.reviewReference))throw Error('Unveränderter technischer Prüfentscheid fehlt.');return d as MedicationOrderReviewDecision;}
export function assertMedicationOrderReviewItem(value:unknown,scope:MedicationOrderRevisionScope):MedicationOrderReviewItem{
 const i=obj(value),r=obj(i?.request);if(![scope.tenantId,scope.clientId,scope.medicationId].every(woundUuid)||!i||!exact(i,['request','decision','authorization','revocation'])||!r||!exact(r,['id','tenantId','clientId','medicationId','revisionId','creatorId','createdAt','expiresAt','reason','revision'])||!sameScope(r,scope)||![r.id,r.revisionId,r.creatorId].every(woundUuid)||!text(r.reason)||instant(r.createdAt)===null||instant(r.expiresAt)===null||instant(r.expiresAt)!<=instant(r.createdAt)!)throw Error('Vollständiger eigener technischer Prüfantrag fehlt.');
 const revision=assertMedicationOrderRevision(r.revision,scope);if(instant(r.createdAt)!<instant(revision.recorded_at)!||instant(r.expiresAt)!>instant(r.createdAt)!+30n*60n*1_000_000n||revision.id!==r.revisionId||revision.recorded_by!==r.creatorId||revision.state!=='proposed')throw Error('Prüfantrag gehört nicht zum ursprünglichen Entwurf.');
 const d=i.decision===null?null:decision(i.decision,['authorize','reject']),rev=i.revocation===null?null:decision(i.revocation,['revoke']);
 if(d&&(d.actorId===r.creatorId||instant(d.recordedAt)!<instant(r.createdAt)!||instant(d.recordedAt)!>=instant(r.expiresAt)!))throw Error('Unabhängiger technischer Prüfentscheid widersprüchlich.');
 if(d?.action==='authorize'){
  const a=obj(i.authorization);if(!a||!exact(a,['id','tenantId','revisionId','actorId','reviewedBy','reviewReference','issuedAt','expiresAt','revokedAt','proposalFingerprint','nativeBeforeFingerprint','sourceFingerprint','archiveFingerprint'])||!woundUuid(a.id)||a.tenantId!==scope.tenantId||a.revisionId!==r.revisionId||a.actorId!==r.creatorId||a.reviewedBy!==d.actorId||a.reviewReference!==d.reviewReference||instant(a.issuedAt)!==instant(d.recordedAt)||instant(a.expiresAt)===null||instant(a.expiresAt)!<=instant(a.issuedAt)!||instant(a.expiresAt)!>instant(r.expiresAt)!||instant(a.expiresAt)!>instant(a.issuedAt)!+15n*60n*1_000_000n||![a.proposalFingerprint,a.nativeBeforeFingerprint,a.sourceFingerprint,a.archiveFingerprint].every(fp))throw Error('Zeitlich und fachlich gebundene technische Übertragungsberechtigung fehlt.');
  if(a.revokedAt!==null){if(!rev||instant(a.revokedAt)!==instant(rev.recordedAt)||instant(a.revokedAt)!<instant(a.issuedAt)!||![r.creatorId,d.actorId].includes(rev.actorId))throw Error('Widerruf ist nicht vollständig gebunden.');}
  else if(rev)throw Error('Widerruf widerspricht der Berechtigung.');
 }else if(i.authorization!==null||rev)throw Error('Nicht erteilter technischer Prüfentscheid besitzt eine Berechtigung.');
 return structuredClone(value) as MedicationOrderReviewItem;
}
export function assertMedicationOrderReviewReceipt(value:unknown,packet:MedicationOrderReviewPacket):MedicationOrderReviewReceipt{
 const r=obj(value);if(medicationOrderReviewPacketIssue(packet)||!r||!exact(r,['requestId','action','actorId','recordedAt','item'])||r.requestId!==packet.requestId||r.action!==packet.action||r.actorId!==packet.actorId||instant(r.recordedAt)===null)throw Error('Eigener technischer Prüfauftrag ist nicht bestätigt.');
 const item=assertMedicationOrderReviewItem(r.item,packet),request=item.request;
 if(packet.action==='request'){if(request.revisionId!==packet.revisionId||request.creatorId!==packet.actorId||request.reason!==packet.reason.trim()||instant(request.createdAt)!==instant(r.recordedAt)||item.decision!==null)throw Error('Prüfantrag bestätigt den eigenen Originalauftrag nicht.');}
 else {const d=packet.action==='revoke'?item.revocation:item.decision;if(request.id!==packet.reviewRequestId||!d||d.action!==packet.action||d.actorId!==packet.actorId||d.reviewReference!==packet.reviewReference.trim()||instant(d.recordedAt)!==instant(r.recordedAt))throw Error('Prüfentscheid bestätigt den eigenen Originalauftrag nicht.');}
 return structuredClone(value) as MedicationOrderReviewReceipt;
}
export function medicationOrderApplyPacketIssue(value:unknown):string|null{const p=obj(value);return !p||!exact(p,['requestId','revisionId','authorizationId','reason'])||![p.requestId,p.revisionId,p.authorizationId].every(woundUuid)||!text(p.reason)?'Unveränderte Fassung, gesonderte Übertragungsberechtigung und Begründung fehlen.':null;}
export function assertMedicationOrderApplyConfirmation(item:MedicationOrderReviewItem,packet:MedicationOrderApplyPacket,application:unknown):MedicationOrderRevision{
 if(medicationOrderApplyPacketIssue(packet)||item.decision?.action!=='authorize'||!item.authorization||item.request.revisionId!==packet.revisionId||item.authorization.id!==packet.authorizationId)throw Error('Gesonderter technischer Übertragungsbezug fehlt.');
 const revision=assertMedicationOrderRevision({...item.request.revision,state:'transcribed',application},item.request),a=revision.application!;
 if(a.request_id!==packet.requestId||a.authorization_id!==packet.authorizationId||a.reason!==packet.reason.trim())throw Error('Übertragung bestätigt den ursprünglichen Auftrag nicht.');return revision;
}
export function assertMedicationOrderApply(item:MedicationOrderReviewItem,packet:MedicationOrderApplyPacket,application:unknown):MedicationOrderRevision{if(item.authorization?.revokedAt!==null)throw Error('Technische Übertragungsberechtigung ist nicht aktuell.');return assertMedicationOrderApplyConfirmation(item,packet,application);}
/** For display only. The database decides current access, session validity and full-original equality. */
export function medicationOrderReviewState(item:MedicationOrderReviewItem,now=Date.now()):'pending'|'expired'|'authorized'|'rejected'|'revoked'{if(item.revocation)return 'revoked';if(item.decision?.action==='reject')return 'rejected';const expires=item.authorization?.expiresAt??item.request.expiresAt;if(Number(instant(expires)!/1000n)<=now)return 'expired';return item.authorization?'authorized':'pending';}
export function sameMedicationOrderReviewReceipt(a:MedicationOrderReviewReceipt,b:MedicationOrderReviewReceipt){return sameWoundJson(a,b);}
export function medicationOrderReviewActionAllowed(item:MedicationOrderReviewItem,action:'authorize'|'reject'|'revoke'|'apply',actorId:string,canReview:boolean,native:Record<string,unknown>,currentRevision:MedicationOrderRevision|undefined,now=Date.now()):boolean{
 if(!woundUuid(actorId)||currentRevision?.id!==item.request.revisionId||currentRevision.state!=='proposed')return false;
 const state=medicationOrderReviewState(item,now);
 if(action==='revoke')return state==='authorized'&&(actorId===item.request.creatorId||actorId===item.authorization?.reviewedBy&&canReview);
 if(!sameWoundJson(native,item.request.revision.before_snapshot))return false;
 if(action==='apply')return state==='authorized'&&actorId===item.request.creatorId&&['frequency','schedule','morning_dose','noon_dose','evening_dose','night_dose'].every(key=>native[key]===null||native[key]===undefined||typeof native[key]==='string'&&!String(native[key]).trim());
 return state==='pending'&&actorId!==item.request.creatorId&&canReview;
}
