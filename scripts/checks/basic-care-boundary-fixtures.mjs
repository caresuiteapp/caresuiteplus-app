// Entirely synthetic complete Web originals; these are no actual SQL/clinical evidence.
import {blankBasicCareEntry} from '../../src/lib/pflege/basicCarePacket.web.ts';
export const id=n=>`abcdefab-1234-4123-8123-${Number(n).toString(16).padStart(12,'0')}`;
export const sha=(letter='a')=>'sha256:'+letter.repeat(64);
export const at='2026-10-22T12:13:14.123456Z';
export const scope={tenantId:id(1),clientId:id(2),actorId:id(3)};
export function careEntry(kind='body_care'){
 const e=blankBasicCareEntry(kind,at);
 Object.assign(e,{title:'Synthetische individuelle Grundpflege',planVersionId:id(10),measureId:id(11),visitId:id(12),planSnapshotSha256:sha(),occurredAt:at,lifecycle:'completed'});
 Object.assign(e.consent,{state:'consented',recordedAt:at});
 Object.assign(e.assistance,{level:'partial_assist',helpers:[id(3)],aids:['Synthetische Unterstützung'],technique:'Synthetische ausdrücklich erfasste Teilhilfe'});
 Object.assign(e.observation,{baseline:'Synthetische Ausgangslage',skin:'Synthetische Hautbeobachtung',mobility:'Synthetische Beweglichkeit',oral:'Synthetische Mundbeobachtung',tolerance:'Synthetische Reaktion'});
 Object.assign(e.execution,{outcome:'performed',performedBy:[id(3)],interventions:['Synthetische individuelle Bewegung angeleitet'],result:'Synthetisches tatsächliches Ergebnis'});
 if(['pressure_prevention','fall_prevention','individual_prevention'].includes(kind))Object.assign(e.prevention,{risk:'Synthetisches individuelles Risiko',professionalBasis:'Synthetische ausdrücklich vorliegende fachliche Grundlage',individualMeasure:'Synthetische individuelle vorbeugende Maßnahme'});
 return e;
}
export function careOriginal(revision=2,rootNumber=50){
 const history=[];
 for(let i=0;i<revision;i++){
  const payload=careEntry();if(i)payload.execution.result='Synthetische eigenständige Fortschreibung '+i;
  history.push({id:id(rootNumber+i),revision:i+1,previousId:i?id(rootNumber+i-1):null,recordedAt:`2026-10-22T12:13:14.${String(123456+i).padStart(6,'0')}Z`,recordedBy:scope.actorId,recordedByName:'Synthetische dokumentierende Person',reason:i?'Synthetischer konkreter Änderungsgrund':'',payload,contentFingerprint:sha(i?'b':'a')});
 }
 const h=history.at(-1);return {id:h.id,tenantId:scope.tenantId,clientId:scope.clientId,rootId:history[0].id,headId:h.id,revision,kind:h.payload.kind,recordedAt:h.recordedAt,recordedBy:h.recordedBy,recordedByName:h.recordedByName,payload:structuredClone(h.payload),contentFingerprint:h.contentFingerprint,history,voided:false};
}
export function carePacket(action='create'){
 const original=action==='revise'?careOriginal():null,entry=original?structuredClone(original.payload):careEntry();
 if(original)entry.observation.skin='Synthetische neu erfasste Beobachtung';
 return {schemaVersion:'1',action,requestId:id(40),...scope,expectedHeadId:original?.headId??null,expectedRevision:original?.revision??0,entry,reason:original?'Synthetische konkrete fachliche Fortschreibung':'',original,pressureOriginals:null,fallOriginals:null};
}
export function careReceipt(p=carePacket()){
 const prior=p.original,history=prior?structuredClone(prior.history):[],last={id:id(99),revision:p.expectedRevision+1,previousId:p.expectedHeadId,recordedAt:'2026-10-22T12:13:14.123460Z',recordedBy:p.actorId,recordedByName:'Synthetische dokumentierende Person',reason:p.reason,payload:structuredClone(p.entry),contentFingerprint:sha('f')};history.push(last);
 return {requestId:p.requestId,packet:structuredClone(p),original:{id:last.id,tenantId:p.tenantId,clientId:p.clientId,rootId:prior?.rootId??last.id,headId:last.id,revision:last.revision,kind:last.payload.kind,recordedAt:last.recordedAt,recordedBy:last.recordedBy,recordedByName:last.recordedByName,payload:structuredClone(last.payload),contentFingerprint:last.contentFingerprint,history,voided:false}};
}
export function reviewQualification(actor=id(5)){
 return {id:id(80),employeeId:id(81),profileId:actor,qualificationType:'synthetic_basic_care_review',title:'Synthetische ausdrücklich verifizierte Qualifikation',status:'valid',validUntil:'2027-12-31',verifiedAt:at,updatedAt:at,sourceFingerprint:sha('c'),documentId:id(82),documentFingerprint:sha('d'),scopeId:id(83),scopeKind:'basic_care_review',scopeFingerprint:sha('e'),employeeFingerprint:sha('f')};
}
export function reviewOriginal(action='request',care=careOriginal()){
 if(action!=='request')return reviewReceipt(reviewPacket(action,undefined,care)).original;
 const item={id:id(70),revision:1,previousId:null,requestId:id(160),kind:'review_request',recordedAt:'2026-10-22T12:13:14.123458Z',actorId:id(4),actorName:'Synthetische anfragende Person',reason:'Synthetische Prüfung der unveränderten Grundpflegefassung',requiredChange:'',rationale:'',careHeadId:care.headId,careContentFingerprint:care.contentFingerprint,qualificationOriginal:null,contentFingerprint:sha('c')};
 return {id:item.id,tenantId:scope.tenantId,clientId:scope.clientId,rootId:item.id,headId:item.id,revision:1,careRootId:care.rootId,careHeadId:care.headId,careContentFingerprint:care.contentFingerprint,status:'requested',history:[item]};
}
export function reviewPacket(action='request',actor,care=careOriginal()){
 const request=action==='request';return {schemaVersion:'1',action,requestId:id(request?160:action==='accept'?161:162),tenantId:scope.tenantId,clientId:scope.clientId,actorId:actor??id(request?4:5),occurredAt:`2026-10-22T12:13:14.${request?'123458':'123459'}Z`,expectedReviewHeadId:request?null:id(70),expectedReviewRevision:request?0:1,careOriginal:structuredClone(care),reviewOriginal:request?null:reviewOriginal('request',care),reason:action==='request'?'Synthetische Prüfung der unveränderten Grundpflegefassung':action==='return'?'Synthetischer konkreter Rückgabegrund':'',requiredChange:action==='return'?'Synthetische konkrete erforderliche Änderung':'',rationale:action==='accept'?'Synthetische fachliche Annahmebegründung':''};
}
export function reviewReceipt(p=reviewPacket()){
 const prior=p.reviewOriginal,last={id:id(91),revision:p.expectedReviewRevision+1,previousId:p.expectedReviewHeadId,requestId:p.requestId,kind:p.action==='request'?'review_request':p.action==='return'?'review_return':'review_acceptance',recordedAt:'2026-10-22T12:13:14.123460Z',actorId:p.actorId,actorName:'Synthetische prüfende Person',reason:p.reason,requiredChange:p.requiredChange,rationale:p.rationale,careHeadId:p.careOriginal.headId,careContentFingerprint:p.careOriginal.contentFingerprint,qualificationOriginal:p.action==='request'?null:reviewQualification(p.actorId),contentFingerprint:sha('e')};
 return {requestId:p.requestId,packet:structuredClone(p),original:{id:last.id,tenantId:p.tenantId,clientId:p.clientId,rootId:prior?.rootId??last.id,headId:last.id,revision:last.revision,careRootId:p.careOriginal.rootId,careHeadId:p.careOriginal.headId,careContentFingerprint:p.careOriginal.contentFingerprint,status:p.action==='request'?'requested':p.action==='return'?'returned':'accepted',history:[...(prior?structuredClone(prior.history):[]),last]}};
}
