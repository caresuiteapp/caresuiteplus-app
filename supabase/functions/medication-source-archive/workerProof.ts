import type {ArchiveRegistration} from './core.ts';
export type VerifiedCaller={sub:string;role:'authenticated';session_id:string;exp:number};
const uuid=(v:unknown):v is string=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
// Call ONLY after Auth.getUser has validated this exact token. Decoding is not authentication.
export function callerFromValidatedToken(authorization:string,verifiedUserId:string,nowSeconds=Date.now()/1000):VerifiedCaller{
 const token=/^Bearer\s+(\S+)$/i.exec(authorization)?.[1];
 if(!token||token.split('.').length!==3)throw Error('Ungültige bestätigte Sitzung.');
 const encoded=token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/');
 let c:Record<string,unknown>;
 try{c=JSON.parse(atob(encoded));}catch{throw Error('Ungültige bestätigte Sitzung.');}
 if(!c||c.sub!==verifiedUserId||!uuid(c.sub)||!uuid(c.session_id)||c.role!=='authenticated'||c.is_anonymous===true||!Number.isSafeInteger(c.exp)||Number(c.exp)<=nowSeconds)throw Error('Aktuelle bestätigte Sitzung fehlt.');
 return {sub:c.sub,role:'authenticated',session_id:c.session_id,exp:c.exp as number};
}
export function workerProofPacket(p:ArchiveRegistration,caller:VerifiedCaller){
 // Allowlist prevents extra preparation or token fields from leaking into retained receipts.
 const record={sourceId:p.sourceId,tenantId:p.tenantId,clientId:p.clientId,medicationId:p.medicationId,documentId:p.documentId,actorId:p.actorId,documentVersion:p.documentVersion,originalPath:p.originalPath,sha256:p.sha256,sizeBytes:p.sizeBytes,sourceFingerprint:p.sourceFingerprint,orderFingerprint:p.orderFingerprint,documentFingerprint:p.documentFingerprint,archivePath:p.archivePath};
 return {schemaVersion:1,requestId:p.requestId,record,caller,verifiedSha256:p.sha256,verifiedSize:p.sizeBytes};
}
