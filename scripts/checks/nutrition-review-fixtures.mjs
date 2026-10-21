// Synthetic in-memory fixtures only. Never sent to a service or persisted as clinical data.
import {blankNutritionEliminationEntry} from '../../src/lib/pflege/nutritionEliminationPacket.web.ts';
export const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
export const at='2026-10-17T08:00:00.000001Z',sha='sha256:'+'a'.repeat(64),finger=n=>'sha256:'+String(n).repeat(64);
export function entry(kind='drink_protocol',overrides={}){
 const e=blankNutritionEliminationEntry(kind,at);
 Object.assign(e,{title:'Tatsächlich dokumentierter Ernährungsvorgang',planVersionId:id(1),measureId:id(2),visitId:id(3),assessmentId:id(10),planSnapshotSha256:sha,occurredAt:at,lifecycle:'completed'});
 Object.assign(e.decision,{state:'consented',recordedAt:at});Object.assign(e.execution,{outcome:'performed',performedBy:[id(4)],result:'Individuelle Unterstützung und Ergebnis beobachtet'});
 if(['meal_support','drink_protocol'].includes(kind))Object.assign(e.intake,{item:'Tatsächlich angebotene Portion',offered:'250',actual:'180',unit:kind==='drink_protocol'?'ml':'g'});
 if(kind==='fluid_balance')Object.assign(e.elimination,{input:'180',output:'120',unit:'ml',complete:false,observation:'Ausdrücklich unvollständiger dokumentierter Ausschnitt'});
 return Object.assign(e,overrides);
}
export function sources(){return {assessment:{id:id(10),revision:1,recordedAt:at,fingerprint:sha,modelVersion:'fixture-v1',instrumentVersion:null},protocols:[],weights:[],devices:[],tasks:[]};}
export function original(root=50,kind='drink_protocol',e=entry(kind)){
 const history=[{id:id(root),revision:1,previousId:null,recordedAt:at,recordedBy:id(4),recordedByName:'Erfassende Person',reason:'',payload:structuredClone(e),contentFingerprint:sha}];
 return {id:id(root),tenantId:id(6),clientId:id(7),rootId:id(root),headId:id(root),revision:1,kind,recordedAt:at,recordedBy:id(4),recordedByName:'Erfassende Person',payload:structuredClone(e),contentFingerprint:sha,history,voided:false};
}
export function carePacket(){return {schemaVersion:'1',action:'create',requestId:id(60),tenantId:id(6),clientId:id(7),actorId:id(4),expectedHeadId:null,expectedRevision:0,entry:entry(),reason:'',original:null,sources:sources()};}
export function requested(care=original()){
 const event={id:id(70),revision:1,previousId:null,requestId:id(61),action:'request',recordedAt:at,actorId:id(8),actorName:'Anfragende Person',reason:'Fachliche Prüfung des dokumentierten Verlaufs',requiredChange:'',rationale:'',careHeadId:care.headId,careFingerprint:care.contentFingerprint,qualification:null,fingerprint:finger('b')};
 return {id:id(70),tenantId:id(6),clientId:id(7),rootId:id(70),headId:id(70),revision:1,careRootId:care.rootId,careHeadId:care.headId,careFingerprint:care.contentFingerprint,careKind:care.kind,status:'requested',history:[event]};
}
export function qualification(kind='drink_protocol',actor=id(9)){
 return {id:id(80),employeeId:id(81),profileId:actor,qualificationType:'Belegte individuelle Qualifikation',title:'Qualifikation für diesen Prüfbereich',status:'valid',issuedAt:'2025-01-01',validUntil:'2027-12-31',verifiedAt:'2026-10-16T12:00:00Z',updatedAt:'2026-10-16T12:00:00Z',documentId:id(82),documentFingerprint:finger('c'),sourceFingerprint:finger('d'),employmentStart:'2025-01-01',employmentEnd:null,employeeFingerprint:finger('e'),scopeId:id(83),scopeKind:kind,scopeFingerprint:finger('f')};
}
export function reviewPacket(action='request',care=original(),review=action==='request'?null:requested(care)){
 return {schemaVersion:'1',action,requestId:id(action==='request'?61:62),tenantId:id(6),clientId:id(7),actorId:id(action==='request'?8:9),expectedHeadId:review?.headId??null,expectedRevision:review?.revision??0,careOriginal:care,reviewOriginal:review,reason:action==='accept'?'':'Fachliche Prüfung des dokumentierten Verlaufs',requiredChange:action==='return'?'Konkrete Beobachtung und Reaktion ergänzen':'',rationale:action==='accept'?'Vollständige Quellen und tatsächliches Ergebnis fachlich beurteilt':''};
}
export function decision(action='accept',care=original(),p=reviewPacket(action,care)){
 const before=p.reviewOriginal??requested(care),last={id:id(71),revision:2,previousId:before.headId,requestId:p.requestId,action,recordedAt:'2026-10-17T08:01:00.000001Z',actorId:p.actorId,actorName:'Getrennte prüfende Person',reason:p.reason,requiredChange:p.requiredChange,rationale:p.rationale,careHeadId:care.headId,careFingerprint:care.contentFingerprint,qualification:qualification(care.kind,p.actorId),fingerprint:finger('e')};
 return {...before,id:id(71),headId:id(71),revision:2,status:action==='accept'?'accepted':'returned',history:[...before.history,last]};
}
