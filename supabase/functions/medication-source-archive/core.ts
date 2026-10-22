export type ArchivePreparation = {
  sourceId:string;tenantId:string;clientId:string;medicationId:string;documentId:string;actorId:string;
  documentVersion:string;sourceFingerprint:string;orderFingerprint:string;documentFingerprint:string;originalPath:string;sha256:string;sizeBytes:number;archiveId:string|null;
};
export type ArchiveRegistration = ArchivePreparation & {requestId:string;archivePath:string};
export type ArchiveGateway = {
  prepare(sourceId:string):Promise<ArchivePreparation>;
  downloadOriginal(path:string):Promise<Blob>;
  storeArchive(path:string,blob:Blob):Promise<void>;
  downloadArchive(path:string):Promise<Blob>;
  registerArchive(record:ArchiveRegistration):Promise<string>;
};
const uuid=(v:unknown):v is string=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
export async function archiveDigest(blob:Blob):Promise<string>{
  if(!(blob instanceof Blob)||blob.size<=0||blob.size>52_428_800)throw Error('Quelldatei muss Daten enthalten und darf höchstens 50 MiB groß sein.');
  const hash=await crypto.subtle.digest('SHA-256',await blob.arrayBuffer());
  return Array.from(new Uint8Array(hash),b=>b.toString(16).padStart(2,'0')).join('');
}
function validate(p:ArchivePreparation,sourceId:string){
  if(!p||p.sourceId!==sourceId||![p.sourceId,p.tenantId,p.clientId,p.medicationId,p.documentId,p.actorId].every(uuid)||!Number.isFinite(Date.parse(p.documentVersion))||!/^[0-9a-f]{64}$/.test(p.sha256)||!Number.isSafeInteger(p.sizeBytes)||p.sizeBytes<=0||p.sizeBytes>52_428_800||p.archiveId!==null&&!uuid(p.archiveId))throw Error('Archivvorbereitung unvollständig oder ungültig.');
  const prefix=`tenant/${p.tenantId}/clients/${p.clientId}/documents/`;
  if(![p.sourceFingerprint,p.orderFingerprint,p.documentFingerprint].every(v=>typeof v==='string'&&/^sha256:[0-9a-f]{64}$/.test(v)))throw Error('Originalfassungen der Archivvorbereitung fehlen.');
  if(typeof p.originalPath!=='string'||!p.originalPath.startsWith(prefix)||!p.originalPath.slice(prefix.length)||p.originalPath.includes('..')||/[\\%?#\u0000-\u001f]/.test(p.originalPath))throw Error('Quelldatei gehört nicht zum freigegebenen Dokumentpfad.');
}
async function assertBytes(blob:Blob,p:ArchivePreparation){if(blob.size!==p.sizeBytes||await archiveDigest(blob)!==p.sha256)throw Error('Dateiinhalt stimmt nicht mit dem gespeicherten Quellenfingerabdruck überein.');}
function assertSamePreparation(prepared:ArchivePreparation,latest:ArchivePreparation){
  for(const key of ['sourceId','tenantId','clientId','medicationId','documentId','actorId','documentVersion','originalPath','sha256','sizeBytes','sourceFingerprint','orderFingerprint','documentFingerprint'] as const)if(latest[key]!==prepared[key])throw Error('Quellenbezug oder Berechtigung wurde während der Archivierung geändert.');
}
export async function archiveMedicationSource(sourceId:string,requestId:string,gateway:ArchiveGateway):Promise<{id:string;reused:boolean}>{
  if(!uuid(sourceId)||!uuid(requestId))throw Error('Quelle und Anfrage benötigen gültige IDs.');
  const prepared={...await gateway.prepare(sourceId)};validate(prepared,sourceId);
  const path=`tenant/${prepared.tenantId}/clients/${prepared.clientId}/medication-sources/${sourceId}/${prepared.sha256}.bin`;
  if(prepared.archiveId){
    await assertBytes(await gateway.downloadArchive(path),prepared);
  }else{
    const blob=await gateway.downloadOriginal(prepared.originalPath);await assertBytes(blob,prepared);
    // Lost upload responses are resolved by byte readback, never overwrite or deletion.
    try{await gateway.storeArchive(path,blob);}catch{/* Exact readback below is mandatory. */}
    await assertBytes(await gateway.downloadArchive(path),prepared);
  }
  const latest={...await gateway.prepare(sourceId)};validate(latest,sourceId);
  assertSamePreparation(prepared,latest);
  if(prepared.archiveId&&latest.archiveId!==prepared.archiveId)throw Error('Archivzuordnung wurde während der Prüfung geändert.');
  // Every verified read, including ready reuse, passes the worker-only atomic receipt commit.
  const id=await gateway.registerArchive({...prepared,requestId,archivePath:path});
  if(!uuid(id)||latest.archiveId&&id!==latest.archiveId)throw Error('Archivbestätigung fehlt oder widerspricht der Zuordnung. Dieselbe Anfrage erneut prüfen.');
  const confirmed={...await gateway.prepare(sourceId)};validate(confirmed,sourceId);
  assertSamePreparation(prepared,confirmed);
  if(confirmed.archiveId!==id)throw Error('Gespeicherter Archivabschluss nicht bestätigt. Dieselbe Anfrage erneut prüfen.');
  return {id,reused:latest.archiveId!==null};
}
