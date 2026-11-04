import {canonicalJson, hashBytes, requireSignaturePath} from './proofBytes.ts';
import type {ProofSource} from './visitProofPdf.ts';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const isId=(v:unknown):v is string=>typeof v==='string'&&uuid.test(v);
const record=(v:unknown):v is Record<string,unknown>=>v!==null&&typeof v==='object'&&!Array.isArray(v);
function fail():never {throw new Error('Die Leistungsdaten stimmen nicht mit der unterschriebenen Nachweisfassung überein.');}
const digest=(v:unknown)=>hashBytes(new TextEncoder().encode(canonicalJson(v)));
// Postgres can retain microseconds whereas JS Date stops at milliseconds.
function instant(v:unknown):number {
 if(typeof v!=='string') return fail();
 const parts=/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.(\d{1,6}))?(?:Z|[+-]\d\d:\d\d)$/.exec(v);
 const ms=Date.parse(v);if(!parts||!Number.isFinite(ms))return fail();
 const us=ms*1000+Number((parts[1]??'').padEnd(6,'0').slice(3));
 if(!Number.isSafeInteger(us))return fail();
 return us;
}
// The caller-scoped RPC is the authority; this independent check prevents an
// inconsistent RPC response from being rendered or privileged bytes being read.
export async function checkProofSource(raw:unknown,tenant:string,assignment:string):Promise<ProofSource>{
 if(!record(raw)||!record(raw.receipt)||!record(raw.snapshot))return fail();
 const r=raw.receipt,s=raw.snapshot;
 if(r.version!=='workflow-assignment-record-v1'||r.tenant_id!==tenant||r.assignment_id!==assignment||
   !isId(r.proof_id)||!isId(r.visit_id)||s.visitId!==r.visit_id||!isId(r.client_id)||s.clientId!==r.client_id||
   !(r.employee_id===null||isId(r.employee_id))||s.employeeId!==r.employee_id||!isId(r.signature_id)||raw.signature_id!==r.signature_id||
   typeof raw.signature_hash!=='string'||!/^sha256:[a-f0-9]{64}$/.test(raw.signature_hash)||
   typeof raw.attested_pdf!=='boolean'||!record(s.visitTimes)||!record(s.signature)||typeof s.signature.signerName!=='string'||
   !s.signature.signerName.trim()||typeof s.signature.signerRole!=='string'||!s.signature.signerRole.trim()||
   typeof raw.tenant_name!=='string'||typeof raw.client_name!=='string'||typeof raw.employee_name!=='string')return fail();
 const canonical=canonicalJson(s);const body=new TextEncoder().encode(canonical);
 if(body.length>256000||await hashBytes(body)!==r.proof_payload_hash)return fail();
 requireSignaturePath(raw.signature_storage_path,tenant,r.visit_id,r.signature_id);
 const begin=instant(s.visitTimes.serviceStartedAt),end=instant(s.visitTimes.serviceEndedAt),seconds=s.visitTimes.serviceSeconds;
 if(begin!==instant(r.service_started_at)||end!==instant(r.service_ended_at)||begin>end||typeof seconds!=='number'||
   !Number.isSafeInteger(seconds)||seconds<0||seconds>Math.round((end-begin)/1e6)||Math.round(seconds/60)!==r.actual_minutes)return fail();
 instant(s.plannedStartAt);instant(s.plannedEndAt);instant(s.signature.signedAt);
 if(!Array.isArray(s.tasks))return fail();
 const taskStatuses=s.tasks.map(x=>{if(!record(x)||typeof x.id!=='string'||!x.id||typeof x.status!=='string'||!x.status)return fail();return {taskId:x.id,status:x.status};});
 const note=s.documentationNote??s.documentation;
 if(typeof note!=='string'||!note.trim()||await digest({visitId:r.visit_id,clientId:r.client_id,employeeId:r.employee_id,
   plannedStartAt:s.plannedStartAt,plannedEndAt:s.plannedEndAt,taskStatuses,documentationNote:note.trim()})!==r.signature_payload_hash)return fail();
 return raw as unknown as ProofSource;
}
export function sameProofForCommit(first:ProofSource,latest:ProofSource,pdfPath:string,pdfHash:string):boolean {
 // The full snapshot is checked against its digest on both reads. Rendered
 // names and every field of the embedded receipt are bound separately.
 return canonicalJson(first.receipt)===canonicalJson(latest.receipt)&&first.signature_id===latest.signature_id&&
   first.signature_hash===latest.signature_hash&&first.signature_storage_path===latest.signature_storage_path&&
   first.tenant_name===latest.tenant_name&&first.client_name===latest.client_name&&first.employee_name===latest.employee_name&&
   (!first.attested_pdf||latest.attested_pdf===true)&&(!latest.attested_pdf||(latest.pdf_storage_path===pdfPath&&latest.pdf_hash===pdfHash));
}
