import type {CareAssessment,CareAssessmentSubjectType} from '../../types/modules/careAssessment.ts';
import type {CareAssessmentDraftContext} from './careAssessmentDraftReadState.web.ts';
import {sameWoundJson,woundUuid} from '../pflege/woundCareDomain.ts';

export type CareAssessmentReadScope={tenantId:string;profileId:string;roleKey:string;assessmentId:string;subjectType:CareAssessmentSubjectType;canRead:boolean};
export type CareAssessmentReadTicket={scope:CareAssessmentReadScope;generation:number;lifetime:symbol};
export type CareAssessmentReadBoundary=CareAssessmentReadTicket&{saved:CareAssessment|null};
export type CareAssessmentPendingRead=CareAssessmentReadTicket&{saved:CareAssessment};
export type CareAssessmentReadEnvelope={assessment:CareAssessment;receipt:CareAssessmentReadTicket};
const fields=['tenantId','profileId','roleKey','assessmentId','subjectType','canRead'] as const;
function sameScope(a:CareAssessmentReadScope,b:CareAssessmentReadScope){return fields.every(field=>a[field]===b[field]);}
function frozenClone<T>(value:T):T{
 const copy=structuredClone(value);
 function freeze(item:unknown){if(item&&typeof item==='object'){Object.values(item).forEach(freeze);Object.freeze(item);}}
 freeze(copy);return copy;
}
function assertScope(scope:CareAssessmentReadScope){
 if(!woundUuid(scope.tenantId)||!woundUuid(scope.profileId)||!woundUuid(scope.assessmentId)||typeof scope.roleKey!=='string'||!scope.roleKey.trim()||!['client','resident'].includes(scope.subjectType)||typeof scope.canRead!=='boolean')throw Error('Nativer Pflegeplan-Lesekontext fehlt.');
}
function assertAssessment(assessment:CareAssessment,scope:CareAssessmentReadScope,known:CareAssessment|null){
 if(assessment.tenantId!==scope.tenantId||assessment.id!==scope.assessmentId||assessment.subjectType!==scope.subjectType||!woundUuid(assessment.subjectId)||(known&&assessment.subjectId!==known.subjectId))throw Error('Der gespeicherte Pflegeplan gehört nicht zum ursprünglichen Mandanten und Personenbezug.');
}
function ticket(boundary:CareAssessmentReadBoundary):CareAssessmentReadTicket{return Object.freeze({scope:frozenClone(boundary.scope),generation:boundary.generation,lifetime:boundary.lifetime});}
function assertTicket(boundary:CareAssessmentReadBoundary,captured:CareAssessmentReadTicket,currentScope:CareAssessmentReadScope){
 assertScope(currentScope);
 if(currentScope.canRead!==true||boundary.scope.canRead!==true||!sameScope(boundary.scope,currentScope)||!sameScope(captured.scope,currentScope)||captured.lifetime!==boundary.lifetime||captured.generation!==boundary.generation)throw Error('Dieser Leseauftrag wurde durch einen anderen Lesekontext oder eine übernommene Planfassung abgelöst. Pflegeplan bitte erneut laden.');
}
function result(boundary:CareAssessmentReadBoundary,assessment:CareAssessment){
 const next=Object.freeze({...boundary,saved:frozenClone(assessment)});
 return {boundary:next,envelope:Object.freeze({assessment:frozenClone(assessment),receipt:ticket(next)})};
}

/** Create a new caller lifetime on scope/read-access changes and remounts, even when a previous scope later returns. Consumes only trusted decoded reads. */
export function createCareAssessmentReadBoundary(scope:CareAssessmentReadScope,saved:CareAssessment|null=null):CareAssessmentReadBoundary{
 assertScope(scope);if(saved)assertAssessment(saved,scope,null);
 return Object.freeze({scope:frozenClone(scope),saved:saved?frozenClone(saved):null,generation:0,lifetime:Symbol('care-assessment-read')});
}
export function beginCareAssessmentRead(boundary:CareAssessmentReadBoundary):CareAssessmentReadTicket{
 assertTicket(boundary,ticket(boundary),boundary.scope);return ticket(boundary);
}
/** Publish the returned boundary synchronously before returning the query envelope to its asynchronous consumer. */
export function acceptCareAssessmentQueryRead(boundary:CareAssessmentReadBoundary,captured:CareAssessmentReadTicket,assessment:CareAssessment,currentScope:CareAssessmentReadScope){
 assertTicket(boundary,captured,currentScope);assertAssessment(assessment,currentScope,boundary.saved);return result(boundary,assessment);
}
/** Capture at the actual original write beginning, never at its later receipt/reload. */
export function captureCareAssessmentPendingRead(boundary:CareAssessmentReadBoundary):CareAssessmentPendingRead{
 const captured=beginCareAssessmentRead(boundary);
 if(!boundary.saved)throw Error('Der ursprüngliche gespeicherte Pflegeplan-Lesestand fehlt.');
 return Object.freeze({...captured,saved:frozenClone(boundary.saved)});
}
/** Keep the whole original saved-read provenance; no revision or event-time ordering is inferred. */
export function acceptCareAssessmentConfirmedRead(boundary:CareAssessmentReadBoundary,captured:CareAssessmentReadTicket,pending:CareAssessmentPendingRead,assessment:CareAssessment,currentContext:CareAssessmentDraftContext){
 const scope={...boundary.scope,tenantId:currentContext.tenantId,profileId:currentContext.profileId,roleKey:currentContext.roleKey,assessmentId:currentContext.assessmentId,subjectType:currentContext.subjectType};
 assertTicket(boundary,captured,scope);
 // Original write provenance survives a revoked/regranted read lifetime. Only the fresh read ticket belongs to the current generation.
 if(!sameScope(pending.scope,scope))throw Error('Der ursprüngliche Schreibkontext gehört nicht zum aktuellen Pflegeplan-Lesekontext.');
 assertAssessment(pending.saved,scope,boundary.saved);assertAssessment(assessment,scope,pending.saved);
 if(assessment.subjectId!==currentContext.subjectId||!boundary.saved||(!sameWoundJson(boundary.saved,pending.saved)&&!sameWoundJson(boundary.saved,assessment)))throw Error('Der gespeicherte Pflegeplan-Lesestand hat sich seit Beginn der ursprünglichen Schreibanfrage geändert. Bestätigten Stand gesondert laden.');
 return result({...boundary,generation:boundary.generation+1},assessment);
}
/** A shared query hook may commit an old envelope after the caller has accepted its own read. Such an envelope must never drive saved-plan display or passive form adoption. */
export function isCurrentCareAssessmentReadEnvelope(boundary:CareAssessmentReadBoundary,envelope:CareAssessmentReadEnvelope|null|undefined):envelope is CareAssessmentReadEnvelope{
 return !!envelope&&boundary.scope.canRead===true&&envelope.receipt.lifetime===boundary.lifetime&&envelope.receipt.generation===boundary.generation&&sameScope(envelope.receipt.scope,boundary.scope)&&!!boundary.saved&&sameWoundJson(envelope.assessment,boundary.saved);
}
