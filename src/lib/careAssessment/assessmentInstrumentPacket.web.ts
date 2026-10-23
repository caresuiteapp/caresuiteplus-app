import {cloneClientNativeOriginal,freezeClientNativeOriginal,sameClientNativeOriginal} from '../clients/clientRecordNativeOriginal.web.ts';
export type AssessmentInstrumentOwnership='caresuite'|'licensed_external'|'external_reference';
export type AssessmentInstrumentAvailability='active'|'unavailable'|'retired';
export type AssessmentInstrumentDefinition={
 id:string;key:string;title:string;version:string;ownership:AssessmentInstrumentOwnership;
 availability:AssessmentInstrumentAvailability;licenseState:'owned'|'licensed'|'unverified'|'expired';
 riskKeys:string[];sourceRevision:string;
};
export type AssessmentModelDefinition={key:string;title:string;version:string;claim:'product_model'|'external_standard';status:'active'|'unavailable'|'retired'};
export type AssessmentInstrumentSelection={revision:number;modelKey:string;modelVersion:string;selectedInstrumentIds:string[];rationale:string;updatedAt:string|null};
export type AssessmentInstrumentSnapshot={
 tenantId:string;assessmentId:string;subjectId:string;actorId:string;catalogRevision:string;readAt:string;stateFingerprint:string;
 model:AssessmentModelDefinition;instruments:AssessmentInstrumentDefinition[];selection:AssessmentInstrumentSelection;
};
export type AssessmentInstrumentPacket={
 schemaVersion:'1';tenantId:string;assessmentId:string;subjectId:string;actorId:string;catalogRevision:string;readAt:string;
 model:{key:string;version:string;claim:'product_model'|'external_standard'};
 selectionRevision:number;selectionUpdatedAt:string|null;selectedInstrumentIds:string[];rationale:string;
 selectedOriginals:AssessmentInstrumentDefinition[];
};
const uuid=(v:unknown)=>typeof v==='string'&&v.length===36&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
export function assessmentPacketInstantMicros(v:unknown):bigint|null{if(typeof v!=='string')return null;const m=/^([1-9][0-9]{3}-[0-9]{2}-[0-9]{2})T([01][0-9]|2[0-3]):([0-5][0-9]):([0-5][0-9])(?:\.([0-9]{1,6}))?(Z|[+-](?:[01][0-9]|2[0-3]):?[0-5][0-9])$/.exec(v);if(!m||m[0]!==v)return null;if(m[6]!=='Z'){const hour=Number(m[6].slice(1,3)),minute=Number(m[6].replace(':','').slice(3));if(hour>14||hour===14&&minute!==0)return null;}const day=new Date(m[1]+'T12:00:00Z');if(!Number.isFinite(day.getTime())||day.toISOString().slice(0,10)!==m[1])return null;const ms=Date.parse(`${m[1]}T${m[2]}:${m[3]}:${m[4]}${m[6]}`);return Number.isFinite(ms)?BigInt(ms)*1000n+BigInt((m[5]??'').padEnd(6,'0')):null;}
const iso=(v:unknown)=>assessmentPacketInstantMicros(v)!==null;
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const exact=(v:unknown,keys:string)=>object(v)&&Object.keys(v).sort().join(',')===keys.split(',').sort().join(',');
const proof=(v:unknown)=>typeof v==='string'&&v.length===71&&/^sha256:[0-9a-f]{64}$/.test(v);
function capture<T>(input:T):T{const v=cloneClientNativeOriginal(input);const check=(x:unknown):void=>{if(x===undefined)throw Error('Ungeklärtes Instrumentenoriginal.');if(x&&typeof x==='object')for(const item of Object.values(x))check(item);};check(v);return v;}
function instrumentIssue(v:AssessmentInstrumentDefinition){return !exact(v,'id,key,title,version,ownership,availability,licenseState,riskKeys,sourceRevision')||!uuid(v.id)||!text(v.key,120)||!v.key||!text(v.title,240)||!v.title||!text(v.version,80)||!v.version||!['caresuite','licensed_external','external_reference'].includes(v.ownership)||!['active','unavailable','retired'].includes(v.availability)||!['owned','licensed','unverified','expired'].includes(v.licenseState)||!Array.isArray(v.riskKeys)||v.riskKeys.length>80||v.riskKeys.some(k=>!text(k,120)||!k)||new Set(v.riskKeys).size!==v.riskKeys.length||!text(v.sourceRevision,120)||!v.sourceRevision;}

const text=(v:unknown,max=500)=>typeof v==='string'&&v.length<=max;
const sortedUnique=(values:string[])=>[...new Set(values)].sort();

function validateAssessmentInstrumentSnapshotRaw(value:unknown,context:{tenantId:string;assessmentId:string;subjectId:string;actorId:string}):string|null{
 const s=value as AssessmentInstrumentSnapshot;
 if(!exact(s,'tenantId,assessmentId,subjectId,actorId,catalogRevision,readAt,stateFingerprint,model,instruments,selection')||!proof(s.stateFingerprint)||s.tenantId!==context.tenantId||s.assessmentId!==context.assessmentId||s.subjectId!==context.subjectId||s.actorId!==context.actorId)return 'Instrumentenbestand gehört nicht zum aktuellen Benutzer-, Mandanten- oder Pflegefallbezug.';
 if(![s.tenantId,s.assessmentId,s.subjectId,s.actorId].every(uuid)||!text(s.catalogRevision,120)||!s.catalogRevision||!iso(s.readAt))return 'Instrumentenbestand ist unvollständig.';
 if(!exact(s.model,'key,title,version,claim,status')||!text(s.model.key,120)||!text(s.model.title,240)||!text(s.model.version,80)||!['product_model','external_standard'].includes(s.model.claim)||!['active','unavailable','retired'].includes(s.model.status))return 'Assessmentmodell ist unvollständig.';
 if(!Array.isArray(s.instruments)||s.instruments.length>200||!exact(s.selection,'revision,modelKey,modelVersion,selectedInstrumentIds,rationale,updatedAt')||!Number.isSafeInteger(s.selection.revision)||s.selection.revision<0||!text(s.selection.rationale,4000)||!Array.isArray(s.selection.selectedInstrumentIds)||s.selection.selectedInstrumentIds.length>200)return 'Instrumentenauswahl ist unvollständig.';
 const ids=new Set<string>(),keys=new Set<string>();
 for(const item of s.instruments){
  if(instrumentIssue(item)||ids.has(item.id.toLowerCase())||!text(item.key,120)||!item.key||keys.has(item.key)||!text(item.title,240)||!item.title||!text(item.version,80)||!item.version||!['caresuite','licensed_external','external_reference'].includes(item.ownership)||!['active','unavailable','retired'].includes(item.availability)||!['owned','licensed','unverified','expired'].includes(item.licenseState)||!Array.isArray(item.riskKeys)||item.riskKeys.length>80||item.riskKeys.some(k=>!text(k,120)||!k)||!text(item.sourceRevision,120)||!item.sourceRevision)return 'Instrumentenoriginal ist ungültig.';
  ids.add(item.id.toLowerCase());keys.add(item.key);
 }
 if(new Set(s.selection.selectedInstrumentIds.map(id=>typeof id==='string'?id.toLowerCase():id)).size!==s.selection.selectedInstrumentIds.length||s.selection.selectedInstrumentIds.some(id=>typeof id!=='string'||!ids.has(id.toLowerCase())))return 'Gespeicherte Instrumentenauswahl verweist auf einen fremden oder fehlenden Datensatz.';
 if(s.selection.modelKey!==s.model.key||s.selection.modelVersion!==s.model.version)return 'Gespeicherte Modellauswahl stimmt nicht mit dem gelesenen Modell überein.';
 if(s.selection.updatedAt!==null&&(!iso(s.selection.updatedAt)||assessmentPacketInstantMicros(s.selection.updatedAt)!>assessmentPacketInstantMicros(s.readAt)!)||s.selection.revision>0&&s.selection.updatedAt===null)return 'Gespeicherter Instrumentenzeitpunkt ist ungültig.';
 return null;
}

function makeAssessmentInstrumentPacketRaw(snapshot:AssessmentInstrumentSnapshot,selectedIds:string[],rationale:string,riskKeys:string[]):AssessmentInstrumentPacket{
 const issue=validateAssessmentInstrumentSnapshot(snapshot,{tenantId:snapshot.tenantId,assessmentId:snapshot.assessmentId,subjectId:snapshot.subjectId,actorId:snapshot.actorId});if(issue)throw Error(issue);
 if(snapshot.model.status!=='active')throw Error('Das ursprüngliche Assessmentmodell ist nicht aktiv.');
 const selected=sortedUnique(selectedIds),riskSet=new Set(riskKeys);
 if(selected.length!==selectedIds.length)throw Error('Instrumente dürfen nur einmal ausgewählt werden.');
 const originals=selected.map(id=>snapshot.instruments.find(item=>item.id===id));
 if(originals.some(item=>!item))throw Error('Instrumentenauswahl verweist auf einen fehlenden Originaldatensatz.');
 for(const item of originals as AssessmentInstrumentDefinition[]){
  if(item.availability!=='active'||!['owned','licensed'].includes(item.licenseState))throw Error('Nicht verfügbare oder ungeklärt lizenzierte Instrumente dürfen nicht ausgewählt werden.');
  if(item.riskKeys.length&&!item.riskKeys.some(key=>riskSet.has(key)))throw Error(`${item.title} benötigt einen passenden dokumentierten Risikobezug.`);
 }
 const packet:AssessmentInstrumentPacket={schemaVersion:'1',tenantId:snapshot.tenantId,assessmentId:snapshot.assessmentId,subjectId:snapshot.subjectId,actorId:snapshot.actorId,catalogRevision:snapshot.catalogRevision,readAt:snapshot.readAt,model:{key:snapshot.model.key,version:snapshot.model.version,claim:snapshot.model.claim},selectionRevision:snapshot.selection.revision,selectionUpdatedAt:snapshot.selection.updatedAt,selectedInstrumentIds:selected,rationale:rationale.trim(),selectedOriginals:structuredClone(originals as AssessmentInstrumentDefinition[])};
 const packetIssue=validateAssessmentInstrumentPacket(packet);if(packetIssue)throw Error(packetIssue);return packet;
}

function validateAssessmentInstrumentPacketRaw(value:unknown):string|null{
 const p=value as AssessmentInstrumentPacket;
 if(!exact(p,'schemaVersion,tenantId,assessmentId,subjectId,actorId,catalogRevision,readAt,model,selectionRevision,selectionUpdatedAt,selectedInstrumentIds,rationale,selectedOriginals')||p.schemaVersion!=='1'||![p.tenantId,p.assessmentId,p.subjectId,p.actorId].every(uuid)||!text(p.catalogRevision,120)||!p.catalogRevision||!iso(p.readAt))return 'Instrumentenpaket ist unvollständig.';
 if(!exact(p.model,'key,version,claim')||!text(p.model.key,120)||!p.model.key||!text(p.model.version,80)||!p.model.version||!['product_model','external_standard'].includes(p.model.claim))return 'Assessmentmodell im Instrumentenpaket ist ungültig.';
 if(!Number.isSafeInteger(p.selectionRevision)||p.selectionRevision<0||(p.selectionUpdatedAt!==null&&(!iso(p.selectionUpdatedAt)||assessmentPacketInstantMicros(p.selectionUpdatedAt)!>assessmentPacketInstantMicros(p.readAt)!))||p.selectionRevision>0&&p.selectionUpdatedAt===null||!Array.isArray(p.selectedInstrumentIds)||p.selectedInstrumentIds.length>200||new Set(p.selectedInstrumentIds.map(id=>typeof id==='string'?id.toLowerCase():id)).size!==p.selectedInstrumentIds.length||!text(p.rationale,4000)||!Array.isArray(p.selectedOriginals)||p.selectedOriginals.length!==p.selectedInstrumentIds.length)return 'Instrumentenauswahl im Paket ist ungültig.';
 for(let i=0;i<p.selectedOriginals.length;i++){const item=p.selectedOriginals[i];if(instrumentIssue(item)||item.id!==p.selectedInstrumentIds[i]||!uuid(item.id)||item.availability!=='active'||!['owned','licensed'].includes(item.licenseState)||!text(item.sourceRevision,120)||!item.sourceRevision)return 'Ausgewähltes Instrument ist nicht als verfügbares Original belegt.';}
 return null;
}

export function sameAssessmentInstrumentPacket(a:AssessmentInstrumentPacket|null,b:AssessmentInstrumentPacket|null){try{return sameClientNativeOriginal(capture(a),capture(b));}catch{return false;}}
function assessmentInstrumentPacketIssueRaw(packet:AssessmentInstrumentPacket|null,riskKeys:string[],review=false):string|null{
 if(!packet)return 'Instrumenten- und Modellbestand vollständig laden.';
 const issue=validateAssessmentInstrumentPacket(packet);if(issue)return issue;
 const risks=new Set(riskKeys);
 for(const item of packet.selectedOriginals)if(item.riskKeys.length&&!item.riskKeys.some(key=>risks.has(key)))return `${item.title} hat keinen aktuellen Risikobezug mehr.`;
 if(review&&packet.model.claim!=='product_model')return 'Externes Standardmodell ist ohne qualifizierte Freigabe nicht als Prüfgrundlage verfügbar.';
 if(review&&!packet.rationale.trim())return 'Begründung der Instrumenten- und Modellauswahl ergänzen.';
 return null;
}

export function validateAssessmentInstrumentSnapshot(value:unknown,context:{tenantId:string;assessmentId:string;subjectId:string;actorId:string}):string|null{try{return validateAssessmentInstrumentSnapshotRaw(capture(value),capture(context));}catch{return 'Instrumentenbestand ist unvollständig oder nicht verlustfrei lesbar.';}}
export function validateAssessmentInstrumentPacket(value:unknown):string|null{try{return validateAssessmentInstrumentPacketRaw(capture(value));}catch{return 'Instrumentenpaket ist unvollständig oder nicht verlustfrei lesbar.';}}
export function makeAssessmentInstrumentPacket(snapshot:AssessmentInstrumentSnapshot,selectedIds:string[],rationale:string,riskKeys:string[]):AssessmentInstrumentPacket{const s=capture(snapshot),ids=capture(selectedIds),risks=capture(riskKeys);if(!Array.isArray(ids)||ids.some(v=>!uuid(v))||!Array.isArray(risks)||risks.some(v=>typeof v!=='string')||typeof rationale!=='string')throw Error('Ausdrückliche Instrumentenauswahl fehlt.');return freezeClientNativeOriginal(makeAssessmentInstrumentPacketRaw(s,ids,rationale,risks));}
export function assessmentInstrumentPacketIssue(packet:AssessmentInstrumentPacket|null,riskKeys:string[],review=false):string|null{try{return assessmentInstrumentPacketIssueRaw(capture(packet),capture(riskKeys),review);}catch{return 'Instrumentenpaket ist unvollständig oder nicht verlustfrei lesbar.';}}
