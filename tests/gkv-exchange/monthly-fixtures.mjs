/** Synthetic contract data only. No production identifiers or signature bytes. */
import {randomUUID} from 'node:crypto';
export const tenant=randomUUID(), client=randomUUID(), employee=randomUUID(), user=randomUUID();
export const month='2026-10';
export const orderedId=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
export function fixture(){return {id:randomUUID(),tenant_id:tenant,series_id:randomUUID(),version:1,revision:1,status:'open',predecessor_id:null,
 payload:{schema:'gkv-monthly-source-v1',tenantId:tenant,clientId:client,clientName:'Test Patient',month,serviceType:'01',records:[{
 recordId:randomUUID(),updatedAt:'2026-10-03T12:00:00Z',serviceDate:'2026-10-03',employeeId:employee,employeeName:'Test Pflegekraft',actualMinutes:30,
 description:'Bestätigte Unterstützung bei der Körperpflege',tasks:[{id:randomUUID(),title:'Körperpflege',status:'done',completionNote:'Durchgeführt'}],
 sourceReceipt:{tenant_id:tenant,client_id:client,employee_id:employee}}]},content_sha256:'a'.repeat(64),confirmation:null,finalized_at:null,invalidated_at:null,
 created_by:user,created_at:'2026-10-03T12:00:00Z',updated_at:'2026-10-03T12:00:00Z'};}
export function finalProof(p=fixture()) {return {...p,status:'final',revision:p.revision+1,finalized_at:p.updated_at,
 confirmation:{kind:'missing_signature',contentSha256:p.content_sha256,recordedBy:user,reason:'Dokumentierter Ausnahmefall'}};}
export function signedProof(p=fixture(),receiptId=randomUUID()) {
 const captureId=randomUUID(),path=`tenant/${p.tenant_id}/gkv/monthly/${p.id}/captures/${captureId}`;
 return {...finalProof(p),confirmation:{kind:'signature',contentSha256:p.content_sha256,receiptId,captureId,
  signerRole:'patient',signerName:'Test Patient',authorityReference:null,
  originalPath:path+'/original.pdf',originalVersion:'v1',originalSha256:'b'.repeat(64),
  signaturePath:path+'/signature.png',signatureVersion:'v1',signatureSha256:'c'.repeat(64),capturedAt:p.updated_at,verifiedAt:p.updated_at}};
}
export const workspace=p=>({tenantId:tenant,clientId:client,clientName:'Test Patient',month,canWrite:true,proofs:p?[{
 id:p.id,seriesId:p.series_id,serviceType:p.payload.serviceType,version:p.version,revision:p.revision,status:p.status,recordCount:p.payload.records.length,
 updatedAt:p.updated_at,confirmationKind:p.confirmation?.kind||null}]:[]});
export const sources=p=>p.payload.records.map(r=>({id:r.recordId,updatedAt:r.updatedAt,serviceDate:r.serviceDate,employeeId:r.employeeId,
 employeeName:r.employeeName,actualMinutes:r.actualMinutes,description:r.description,assignedSeriesId:null})).sort((a,b)=>a.id.localeCompare(b.id));
export const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
