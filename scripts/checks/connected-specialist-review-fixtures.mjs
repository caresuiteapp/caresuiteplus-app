import {connectedReviewDescriptors} from '../../src/lib/pflege/connectedSpecialistReview.web.ts';
export const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
export const sha=n=>`sha256:${String(n).repeat(64).slice(0,64)}`;
export const at=n=>`2026-10-17T08:${String(n).padStart(2,'0')}:00.000001Z`;
export function subject(domain='medication'){
 const descriptor=connectedReviewDescriptors[domain];
 return {domain,tenantId:id(1),clientId:id(2),rootId:id(10),headId:id(11),revision:1,kind:`${domain}_completed`,state:descriptor.eligible[0],recordedAt:at(1),recordedBy:id(3),contentFingerprint:sha('a'),historyActorIds:[id(4)],collections:descriptor.collections.map((kind,index)=>({kind,fingerprint:sha(String((index%9)+1)),items:[{id:id(100+index),revision:1,recordedAt:at(2),fingerprint:sha(String(((index+1)%9)+1)),actorIds:[id(20+index)],snapshot:{kind,original:true,index}}]}))};
}
export function qualification(domain='medication',actor=id(90)){
 return {id:id(200),employeeId:id(201),profileId:actor,employeeStatus:'aktiv',employmentStatus:'active',qualificationId:id(202),qualificationType:'Pflegefachkraft',qualificationTitle:'Aktueller Fachnachweis',qualificationStatus:'valid',issuedAt:'2025-01-01',validUntil:'2027-12-31',verifiedAt:at(4),updatedAt:at(4),documentId:id(203),documentFingerprint:sha('d'),employeeFingerprint:sha('e'),employmentFingerprint:sha('f'),qualificationFingerprint:sha('7'),scopeId:id(204),scope:connectedReviewDescriptors[domain].scope,scopeFingerprint:sha('8'),permission:'pflege.documentation.sign'};
}
export function requested(domain='medication',s=subject(domain)){
 const e={id:id(70),revision:1,previousId:null,requestId:id(60),action:'request',recordedAt:at(3),actorId:id(80),actorName:'Anfragende Fachperson',reason:'Benannte Fassung fachlich und getrennt prüfen',requiredChange:'',rationale:'',subjectHeadId:s.headId,subjectFingerprint:s.contentFingerprint,qualification:null,fingerprint:sha('b')};
 return {id:e.id,tenantId:s.tenantId,clientId:s.clientId,rootId:e.id,headId:e.id,revision:1,domain,subjectRootId:s.rootId,subjectHeadId:s.headId,subjectKind:s.kind,subjectFingerprint:s.contentFingerprint,status:'requested',history:[e]};
}
export function packet(action='request',domain='medication',s=subject(domain),review=action==='request'?null:requested(domain,s)){
 return {schemaVersion:'1',action,requestId:id(action==='request'?60:61),tenantId:s.tenantId,clientId:s.clientId,actorId:id(action==='request'?80:90),expectedHeadId:review?.headId??null,expectedRevision:review?.revision??0,subject:s,reviewOriginal:review,reason:action==='accept'?'':'Benannte Fassung fachlich und getrennt prüfen',requiredChange:action==='return'?'Konkretes fehlendes Original fachlich ergänzen':'',rationale:action==='accept'?'Vollständige Originale und Ergebnis eigenständig geprüft':''};
}
export function decision(action='accept',domain='medication',s=subject(domain),p=packet(action,domain,s)){
 const before=p.reviewOriginal??requested(domain,s),e={id:id(71),revision:2,previousId:before.headId,requestId:p.requestId,action,recordedAt:at(5),actorId:p.actorId,actorName:'Getrennte prüfende Fachperson',reason:p.reason,requiredChange:p.requiredChange,rationale:p.rationale,subjectHeadId:s.headId,subjectFingerprint:s.contentFingerprint,qualification:qualification(domain,p.actorId),fingerprint:sha('c')};
 return {...before,id:e.id,headId:e.id,revision:2,status:action==='accept'?'accepted':'returned',history:[...before.history,e]};
}
