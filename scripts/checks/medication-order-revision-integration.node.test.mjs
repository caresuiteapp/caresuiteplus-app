import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {stripTypeScriptTypes} from 'node:module';
import {submitMedicationSourceCapture,assertMedicationSourceCaptureReceipt} from '../../src/lib/pflege/medicationSourceCaptureReceipt.web.ts';
import {archiveMedicationSource} from '../../supabase/functions/medication-source-archive/core.ts';
import {createMedicationArchiveGateway} from '../../supabase/functions/medication-source-archive/gateway.ts';
import {loadMedicationSourceWithArchive} from '../../src/lib/pflege/medicationSourceFile.ts';
import {assessMedicationOrder} from '../../src/lib/pflege/medicationOrderIntegrity.ts';
import {blankMedicationSafetyEntry,medicationSafetyEntryIssue} from '../../src/lib/pflege/medicationSafetyPacket.web.ts';
import * as revisionDomain from '../../src/lib/pflege/medicationOrderRevisionDomain.web.ts';
import {sameWoundJson,woundUuid} from '../../src/lib/pflege/woundCareDomain.ts';
import {isDefiniteMedicationRejection} from '../../src/lib/pflege/medicationRequestState.ts';

const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const tenant=id(1),client=id(2),medication=id(3),actor=id(4),authUser=id(5),session=id(6),document=id(7),source=id(8),captureRequest=id(9),archiveRequest=id(10),proposalRequest=id(11);
const at='2026-10-22T10:00:00.123456Z',recordedAt='2026-10-22T10:01:00.654321Z';
const sha=value=>'sha256:'+createHash('sha256').update(JSON.stringify(value)).digest('hex');
const fileHash=createHash('sha256').update('abc').digest('hex');
const native={id:medication,tenant_id:tenant,client_id:client,name:'Unvollständiges Altmedikament',updated_at:at,created_at:at,status:null,is_prn:null,is_high_alert:null,is_controlled_substance:null,active_ingredient:null,strength:null,form:null,prescribed_dose:null,dose_unit:null,route:null,prescribed_by:null,start_date:null,end_date:null,indication:null,minimum_interval_minutes:null,maximum_dose:null,maximum_dose_unit:null,maximum_period_hours:null,retained_original:{zero:0,legacy:['uninterpreted']}};
const documentRow={id:document,tenant_id:tenant,client_id:client,title:'Gespeichertes Verordnungsoriginal',file_name:'original.pdf',mime_type:'application/pdf',storage_path:`tenant/${tenant}/clients/${client}/documents/original.pdf`,updated_at:at,status:'aktiv',size_bytes:3};
const documentView={id:document,tenantId:tenant,clientId:client,title:documentRow.title,fileName:documentRow.file_name,mimeType:documentRow.mime_type,updatedAt:at,storagePath:documentRow.storage_path,status:'aktiv'};
const payload={documentId:document,documentUpdatedAt:at,expectedUpdatedAt:at,reason:'Originaldatei für getrennte technische Erfassung',contentSha256:fileHash,contentSize:3};
const candidate={medicationName:'Dokumentiertes Medikament',activeIngredient:'Dokumentierter Wirkstoff',strength:'500 mg',form:'Tablette',dose:'1',unit:'Tablette',route:'oral',prescriber:'Dokumentierte verordnende Person',validFrom:'2026-10-01',validUntil:null,indication:'Dokumentierte Indikation',isPrn:false,minimumIntervalMinutes:null,maximumDose:null,maximumDoseUnit:'',maximumPeriodHours:null};
const scope={tenantId:tenant,clientId:client,medicationId:medication};
const caller={sub:authUser,role:'authenticated',session_id:session,exp:2_000_000_000};
const authorization=`Bearer header.${Buffer.from(JSON.stringify(caller)).toString('base64url')}.signature`;
const attempt={order:{id:medication,tenantId:tenant,clientId:client,updatedAt:at},document:documentView,actorId:actor,requestId:captureRequest,payload};

// In-memory transports below execute the real capture confirmation, production archive
// adapter/core and proposal domain/service. They do not emulate Postgres clinical approval.
async function archivedIncompleteOriginal(changes={}){
 const before=structuredClone(native),sourceRow={id:source,tenant_id:tenant,client_id:client,medication_id:medication,document_id:document,request_id:captureRequest,payload:structuredClone(payload),document_snapshot:{...structuredClone(documentRow),content_sha256:fileHash,content_size:3,content_fingerprint_origin:'client_observed'},order_snapshot:structuredClone(before),reason:payload.reason.trim(),recorded_by:actor,recorded_by_name:'Dokumentierende Person',created_at:recordedAt};
 const captured=await submitMedicationSourceCapture(attempt,{isCurrent:()=>true,write:async()=>({ok:true,data:{id:source}}),readReturned:async()=>sourceRow});assert.deepEqual(captured,{ok:true,data:{id:source}});assert.deepEqual(assertMedicationSourceCaptureReceipt(sourceRow,source,attempt).order_snapshot,before);
 let stored=null,archiveRow=null,workerReceipt=null;const calls=[];
 const preparation=()=>({sourceId:source,tenantId:tenant,clientId:client,medicationId:medication,documentId:document,actorId:actor,documentVersion:at,originalPath:documentRow.storage_path,sha256:fileHash,sizeBytes:3,sourceFingerprint:sha(sourceRow),orderFingerprint:sha(before),documentFingerprint:sha(documentRow),archiveId:archiveRow?.id??null});
 const factory=(_url,key,options)=>{const role=key==='anon'?'user':'service';return {
  auth:{getUser:async()=>{assert.equal(role,'user');assert.equal(options.global.headers.Authorization,authorization);return {data:{user:{id:authUser}},error:null};}},
  rpc:async(name,args)=>{calls.push([role,name]);
   if(name==='recover_ambulatory_medication_source_proof'){assert.equal(role,'user');return {data:null,error:null};}
   if(name==='prepare_ambulatory_medication_source_proof'){assert.equal(role,'user');return {data:preparation(),error:null};}
   assert.equal(role,'service');assert.equal(name,'commit_ambulatory_medication_source_proof');workerReceipt=structuredClone(args.packet);
   archiveRow={id:archiveRequest,tenant_id:tenant,client_id:client,medication_id:medication,source_id:source,document_id:document,document_version:at,original_path:documentRow.storage_path,archive_path:args.packet.record.archivePath,content_sha256:fileHash,content_size:3,recorded_by:actor,status:'ready',finalized_by:actor,finalized_at:recordedAt,created_at:at};
   return {data:archiveRow.id,error:null};
  },
  storage:{from:bucket=>({download:async()=>{if(bucket==='office-documents'){assert.equal(role,'user');return {data:new Blob(['abc']),error:null};}assert.equal(role,'service');return {data:changes.corruptArchive?new Blob(['abd']):stored,error:null};},upload:async(_path,blob,opts)=>{assert.equal(role,'service');assert.equal(opts.upsert,false);stored=blob;return {error:null};}})},
 };};
 const gateway=await createMedicationArchiveGateway({url:'https://example.invalid',anonKey:'anon',serviceKey:'service'},authorization,factory);
 await archiveMedicationSource(source,archiveRequest,gateway);
 return {before,sourceRow,archiveRow,workerReceipt,calls,download:()=>stored};
}
function packetInput(order=candidate){return {requestId:proposalRequest,...scope,actorId:actor,expectedUpdatedAt:at,sourceId:source,reason:'Strukturierte Abschrift zur gesonderten fachlichen Prüfung',order:structuredClone(order)};}
function proposedRow(f,packet){return {id:id(12),tenant_id:tenant,client_id:client,medication_id:medication,source_id:source,request_id:packet.requestId,recorded_by:actor,recorded_by_name:'Dokumentierende Person',recorded_at:recordedAt,expected_updated_at:at,before_snapshot:structuredClone(f.before),proposed_order:structuredClone(packet.order),reason:packet.reason.trim(),source_snapshot:structuredClone(f.sourceRow),archive_snapshot:structuredClone(f.archiveRow),state:'proposed',application:null};}

test('Unvollständiges natives Original lässt sich technisch erfassen und archivieren, ohne fehlende klinische Fakten zu ergänzen',async()=>{const f=await archivedIncompleteOriginal();assert.deepEqual(f.before,native);assert.deepEqual(f.sourceRow.order_snapshot,native);assert.equal(f.workerReceipt.record.orderFingerprint,sha(native));assert.equal(f.workerReceipt.verifiedSha256,fileHash);assert.equal(f.archiveRow.status,'ready');const integrity=assessMedicationOrder(f.before,{id:medication,...{tenantId:tenant,clientId:client},updatedAt:at});assert.equal(integrity.canRecord,false);assert.ok(integrity.errors.length);assert.ok(integrity.missing.includes('Applikationsweg'));assert.equal(f.before.prescribed_dose,null);assert.equal(f.before.is_prn,null);});

test('Das technisch archivierte Original bleibt unabhängig von einer späteren strukturierten Abschrift herunterladbar',async()=>{const f=await archivedIncompleteOriginal();const result=await loadMedicationSourceWithArchive({tenantId:tenant,clientId:client,medicationId:medication,linkId:source},{isCurrent:()=>true,readArchive:async()=>f.archiveRow,readLink:async()=>f.sourceRow,downloadArchive:async()=>f.download(),readDocument:async()=>{throw Error('No current document fallback');},download:async()=>{throw Error('No original fallback');}});assert.equal(await result.blob.text(),'abc');assert.equal(result.fingerprintVerified,true);assert.equal(result.origin,'archive');assert.deepEqual(f.sourceRow.order_snapshot,native);});

test('Manipulierte Archivbytes verhindern einen Beleg für den technischen Quellenvorgang',async()=>{await assert.rejects(archivedIncompleteOriginal({corruptArchive:true}),/Dateiinhalt stimmt nicht/);assert.equal(native.prescribed_dose,null);});

test('Vollständiger Abschriftsentwurf ersetzt die unvollständige native Verordnung und den archivierten Rohstand nicht',async()=>{const f=await archivedIncompleteOriginal();const rawBefore=structuredClone(f.before),rawSource=structuredClone(f.sourceRow),rawArchive=structuredClone(f.archiveRow);const draft=revisionDomain.nativeMedicationOrderRevisionDraft(f.before);assert.equal(draft.isPrn,'');const packet=revisionDomain.makeMedicationOrderRevisionPacket(packetInput());assert.equal(Object.isFrozen(packet),true);const proposed=revisionDomain.assertMedicationOrderRevision(proposedRow(f,packet),scope,packet);assert.equal(proposed.state,'proposed');assert.equal(proposed.application,null);assert.deepEqual(proposed.before_snapshot,native);assert.deepEqual(proposed.proposed_order,candidate);assert.deepEqual(f.before,rawBefore);assert.deepEqual(f.sourceRow,rawSource);assert.deepEqual(f.archiveRow,rawArchive);assert.equal(assessMedicationOrder(f.before,{id:medication,tenantId:tenant,clientId:client,updatedAt:at}).canRecord,false);});

const serviceText=fs.readFileSync(new URL('../../src/lib/pflege/medicationOrderRevisionService.web.ts',import.meta.url),'utf8');
const serviceCode=stripTypeScriptTypes(serviceText,{mode:'strip'}).replace(/^import[^\n]+;[\r]?$/gm,'').replace(/^export /gm,'');
function actualRevisionService(rpc,changes={}){
 const deps={enforcePermission:()=>null,guardServiceTenant:()=>null,getServiceMode:()=>'supabase',withServiceQueryTimeout:task=>task,getSupabaseClient:()=>({rpc}),toGermanSupabaseError:error=>error?.message??error?.code??'backend failed',isDefiniteMedicationRejection,sameWoundJson,woundUuid,...revisionDomain,...changes};
 return new Function(...Object.keys(deps),serviceCode+'\nreturn {proposeMedicationOrderRevision,readMedicationOrderRevisionHistory,readMedicationOrderRevisionWorkspace};')(...Object.values(deps));
}
function revisionTransport(f,{loseFirstWrite=false,mutateConfirmation=false}={}){
 const calls=[],retained=new Map();let lost=false;
 const rpc=async(name,args)=>{
  calls.push([name,structuredClone(args)]);
  if(name==='propose_ambulatory_medication_order_revision'){
   let row=retained.get(args.packet.requestId);
   if(!row){row=proposedRow(f,args.packet);retained.set(args.packet.requestId,row);}
   if(loseFirstWrite&&!lost){lost=true;throw Error('write response lost');}
   return {data:structuredClone(row),error:null};
  }
  if(name==='confirm_ambulatory_medication_order_revision'){
   const row=retained.get(args.request_id);assert.equal(row?.id,args.revision_id);
   return {data:mutateConfirmation?{...structuredClone(row),reason:'Changed original explanation'}:structuredClone(row),error:null};
  }
  if(name==='read_ambulatory_medication_order_revisions')return {data:{items:[...retained.values()].map(value=>structuredClone(value)),nextCursor:null},error:null};
  if(name==='read_ambulatory_medication_order_revision_context')return {data:{order:structuredClone(f.before),sources:[{source:structuredClone(f.sourceRow),archive:structuredClone(f.archiveRow)}]},error:null};
  throw Error('Unexpected native-write or authorization RPC: '+name);
 };
 return {rpc,calls,retained};
}

test('Erfasste unvollständige Rohdaten gelangen durch echte Vorschlags-, Bestätigungs- und Verlaufsservices ohne native Übernahme',async()=>{
 const f=await archivedIncompleteOriginal(),packet=revisionDomain.makeMedicationOrderRevisionPacket(packetInput()),backend=revisionTransport(f),service=actualRevisionService(backend.rpc);
 const result=await service.proposeMedicationOrderRevision(packet,'pfleger',()=>true);assert.equal(result.ok,true);assert.equal(result.data.state,'proposed');assert.equal(result.data.application,null);
 const history=await service.readMedicationOrderRevisionHistory(scope,'pfleger',()=>true);assert.equal(history.ok,true);assert.equal(history.data.items.length,1);assert.deepEqual(history.data.items[0],result.data);
 const workspace=await service.readMedicationOrderRevisionWorkspace(scope,'pfleger',()=>true);assert.equal(workspace.ok,true);assert.deepEqual(workspace.data.order,native);assert.deepEqual(workspace.data.sources[0].source.order_snapshot,native);assert.deepEqual(workspace.data.items[0].proposed_order,candidate);
 assert.deepEqual(backend.calls.slice(0,2).map(c=>c[0]),['propose_ambulatory_medication_order_revision','confirm_ambulatory_medication_order_revision']);assert.ok(backend.calls.slice(2).every(c=>['read_ambulatory_medication_order_revisions','read_ambulatory_medication_order_revision_context'].includes(c[0])));assert.ok(backend.calls.some(c=>c[0]==='read_ambulatory_medication_order_revision_context'));
 assert.deepEqual(f.before,native);assert.deepEqual(f.sourceRow.order_snapshot,native);assert.equal(assessMedicationOrder(f.before,{id:medication,tenantId:tenant,clientId:client,updatedAt:at}).canRecord,false);
});

test('Verlorene Vorschlagsantwort behält dieselbe Anfrage und erzeugt bei Wiederaufnahme keinen zweiten Vorschlag',async()=>{
 const f=await archivedIncompleteOriginal(),packet=revisionDomain.makeMedicationOrderRevisionPacket(packetInput()),backend=revisionTransport(f,{loseFirstWrite:true}),service=actualRevisionService(backend.rpc);
 const first=await service.proposeMedicationOrderRevision(packet,'pfleger',()=>true);assert.equal(first.ok,false);assert.equal(first.uncertain,true);assert.equal(backend.retained.size,1);
 const recovered=await service.proposeMedicationOrderRevision(packet,'pfleger',()=>true);assert.equal(recovered.ok,true);assert.equal(recovered.data.request_id,proposalRequest);assert.equal(backend.retained.size,1);assert.deepEqual(backend.calls.filter(c=>c[0]==='propose_ambulatory_medication_order_revision').map(c=>c[1].packet),[packet,packet]);assert.deepEqual(f.before,native);
});

test('Abweichendes bestätigtes Entwurfsoriginal liefert trotz erfolgtem Schreiben keinen falschen Erfolg',async()=>{
 const f=await archivedIncompleteOriginal(),packet=revisionDomain.makeMedicationOrderRevisionPacket(packetInput()),backend=revisionTransport(f,{mutateConfirmation:true}),service=actualRevisionService(backend.rpc);
 const result=await service.proposeMedicationOrderRevision(packet,'pfleger',()=>true);assert.equal(result.ok,false);assert.equal(result.uncertain,true);assert.equal(backend.retained.size,1);assert.deepEqual(f.before,native);
});

test('Archivierte Herkunft ersetzt keine fehlenden strukturierten Fakten im klinischen Validator',async()=>{
 const f=await archivedIncompleteOriginal(),entry=blankMedicationSafetyEntry('order_capture',medication,client,at,recordedAt);entry.title='Abschrift bleibt vom klinischen Abschluss getrennt';Object.assign(entry.sourceReview,{planFingerprint:f.workerReceipt.record.orderFingerprint,documentIds:[source],decision:'confirmed'});
 const rawOrder={};for(const [key,column] of Object.entries(revisionDomain.medicationOrderRevisionFieldMap))rawOrder[key]=f.before[column];entry.order=rawOrder;assert.notEqual(medicationSafetyEntryIssue(entry),null);
 const packet=revisionDomain.makeMedicationOrderRevisionPacket(packetInput());assert.equal(revisionDomain.medicationOrderRevisionPacketIssue(packet),null);assert.notEqual(medicationSafetyEntryIssue(entry),null);assert.equal(f.before.prescribed_dose,null);
});

test('Historische Originalquelle und aktueller Rohstand bleiben im Vorschlag getrennt erkennbar',async()=>{
 const f=await archivedIncompleteOriginal(),packet=revisionDomain.makeMedicationOrderRevisionPacket(packetInput()),raw=proposedRow(f,packet);raw.before_snapshot={...raw.before_snapshot,name:'Geänderter aktueller Name',updated_at:'2026-10-22T11:00:00.123456Z'};raw.expected_updated_at=raw.before_snapshot.updated_at;
 const own={...packet,expectedUpdatedAt:raw.expected_updated_at};const retained=revisionDomain.assertMedicationOrderRevision(raw,scope,own);assert.notEqual(retained.before_snapshot.name,retained.source_snapshot.order_snapshot.name);assert.deepEqual(retained.source_snapshot.order_snapshot,native);assert.equal(retained.state,'proposed');assert.equal(retained.application,null);
});

for(const change of [{source_snapshot:null},{archive_snapshot:{status:'pending'}},{tenant_id:id(99)},{before_snapshot:{...native,client_id:id(99)}}])test('Vollständiger Verlauf akzeptiert kein fremdes oder unbelegtes Quellenoriginal '+JSON.stringify(change),async()=>{
 const f=await archivedIncompleteOriginal(),packet=revisionDomain.makeMedicationOrderRevisionPacket(packetInput()),row={...proposedRow(f,packet),...change};const service=actualRevisionService(async()=>({data:{items:[row],nextCursor:null},error:null}));const result=await service.readMedicationOrderRevisionHistory(scope,'pfleger',()=>true);assert.equal(result.ok,false);assert.deepEqual(f.before,native);
});

test('Entzug der aktiven Akte nach dem Vorschlag verhindert die Übernahme in den eigenen sichtbaren Verlauf',async()=>{
 const f=await archivedIncompleteOriginal(),packet=revisionDomain.makeMedicationOrderRevisionPacket(packetInput());let current=true;const backend=revisionTransport(f),service=actualRevisionService(async(name,args)=>{const response=await backend.rpc(name,args);if(name==='propose_ambulatory_medication_order_revision')current=false;return response;});const result=await service.proposeMedicationOrderRevision(packet,'pfleger',()=>current);assert.equal(result.ok,false);assert.equal(result.uncertain,true);assert.equal(backend.calls.some(c=>c[0]==='confirm_ambulatory_medication_order_revision'),false);assert.deepEqual(f.before,native);
});

function transcribedResponse(f,packet){
 const revision=proposedRow(f,packet),after=structuredClone(f.before);for(const [key,column] of Object.entries(revisionDomain.medicationOrderRevisionFieldMap))after[column]=structuredClone(packet.order[key]);
 after.dosage=packet.order.dose+' '+packet.order.unit;after.updated_at='2026-10-22T10:03:00.000001Z';after.updated_by=actor;
 return {...revision,state:'transcribed',application:{id:id(20),revision_id:revision.id,tenant_id:tenant,client_id:client,medication_id:medication,source_id:source,request_id:id(21),recorded_by:actor,recorded_at:after.updated_at,before_snapshot:structuredClone(f.before),after_snapshot:after,reason:'Extern bestätigte technische Abschrift in eigener Prüfumgebung',authorization_id:id(22)}};
}

test('Serverbeleg einer gesondert autorisierten technischen Übertragung bewahrt unbekannte Status- und Risikofakten unverändert',async()=>{
 const f=await archivedIncompleteOriginal(),packet=revisionDomain.makeMedicationOrderRevisionPacket(packetInput()),response=transcribedResponse(f,packet),retained=revisionDomain.assertMedicationOrderRevision(response,scope,packet);
 assert.equal(retained.state,'transcribed');assert.deepEqual(retained.before_snapshot,native);assert.deepEqual(retained.source_snapshot.order_snapshot,native);assert.equal(retained.application.after_snapshot.prescribed_dose,'1');assert.equal(retained.application.after_snapshot.status,null);assert.equal(retained.application.after_snapshot.is_high_alert,null);assert.equal(retained.application.after_snapshot.is_controlled_substance,null);
 assert.equal(assessMedicationOrder(retained.application.after_snapshot,{id:medication,tenantId:tenant,clientId:client,updatedAt:retained.application.after_snapshot.updated_at}).canRecord,false);assert.deepEqual(f.before,native);
});
for(const change of [{status:'active'},{is_high_alert:false},{is_controlled_substance:false},{retained_original:{zero:1,legacy:['changed']}}])test('Technischer Übernahmebeleg darf andere native Fakten nicht still verändern '+JSON.stringify(change),async()=>{
 const f=await archivedIncompleteOriginal(),packet=revisionDomain.makeMedicationOrderRevisionPacket(packetInput()),response=transcribedResponse(f,packet);Object.assign(response.application.after_snapshot,change);assert.throws(()=>revisionDomain.assertMedicationOrderRevision(response,scope,packet));assert.deepEqual(f.before,native);
});
