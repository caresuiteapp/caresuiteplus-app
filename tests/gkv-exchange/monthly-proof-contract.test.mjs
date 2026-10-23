import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readMonthlyProof,executeMonthlyProofCommand} from '../../src/lib/gkvExchange/monthlyProof.ts';
const tenant=randomUUID(),client=randomUUID(),employee=randomUUID(),user=randomUUID();
function fixture(){return {id:randomUUID(),tenant_id:tenant,series_id:randomUUID(),version:1,revision:1,status:'open',predecessor_id:null,
 payload:{schema:'gkv-monthly-source-v1',tenantId:tenant,clientId:client,clientName:'Test Patient',month:'2026-10',serviceType:'01',records:[{
 recordId:randomUUID(),updatedAt:'2026-10-03T12:00:00Z',serviceDate:'2026-10-03',employeeId:employee,employeeName:'Test Pflegekraft',actualMinutes:30,
 description:'Bestätigte Unterstützung',tasks:[{id:randomUUID(),title:'Körperpflege',status:'done',completionNote:null}],
 sourceReceipt:{tenant_id:tenant,client_id:client,employee_id:employee}}]},content_sha256:'a'.repeat(64),confirmation:null,finalized_at:null,invalidated_at:null,
 created_by:user,created_at:'2026-10-03T12:00:00Z',updated_at:'2026-10-03T12:00:00Z'};}
test('monthly contract retains canonical record identity and open state',()=>{
 const p=fixture();assert.deepEqual(readMonthlyProof(p,tenant),p);
});
test('foreign scope, invalid dates, duplicate records and changed caregiver are rejected',()=>{
 for(const mutate of [p=>{p.tenant_id=randomUUID();},p=>{p.payload.clientId='';},p=>{p.payload.tenantId=randomUUID();},
  p=>{p.payload.records.push(p.payload.records[0]);},p=>{p.payload.records[0].serviceDate='2026-10-32';},
  p=>{p.payload.records[0].serviceDate='2026-09-30';},p=>{p.payload.records[0].employeeId=randomUUID();},
  p=>{p.payload.records[0].actualMinutes=NaN;},p=>{p.payload.records[0].description='';},p=>{p.version=2;},p=>{p.revision=0;}]){
  const p=fixture();mutate(p);assert.throws(()=>readMonthlyProof(p,tenant));
 }
});
test('status-only final, deferred portal signature and mismatched confirmation cannot appear confirmed',()=>{
 for(const mutate of [p=>{p.status='final';},p=>{p.confirmation={kind:'pending_client_signature'};},
  p=>{p.status='final';p.finalized_at=p.updated_at;p.confirmation={kind:'missing_signature',contentSha256:'b'.repeat(64),recordedBy:user,reason:'Keine Unterschrift'};}]){
  const p=fixture();mutate(p);assert.throws(()=>readMonthlyProof(p,tenant));
 }
 const p=fixture();p.status='final';p.finalized_at=p.updated_at;
 p.confirmation={kind:'missing_signature',contentSha256:p.content_sha256,recordedBy:user,reason:'Begründeter Ausnahmefall'};
 assert.equal(readMonthlyProof(p,tenant).confirmation.kind,'missing_signature');
});
test('signature needs bound immutable original, hash, capture and representative authority',()=>{
 const p=fixture(),capture=randomUUID();p.status='final';p.finalized_at=p.updated_at;
 p.confirmation={kind:'signature',contentSha256:p.content_sha256,receiptId:randomUUID(),captureId:capture,
 signerRole:'representative',signerName:'Test Vertretung',authorityReference:'Vollmacht V1',
 originalPath:`tenant/${tenant}/gkv/monthly/${p.id}/captures/${capture}/original.pdf`,originalVersion:'v1',originalSha256:'b'.repeat(64),
 signaturePath:`tenant/${tenant}/gkv/monthly/${p.id}/captures/${capture}/signature.png`,signatureVersion:'v1',signatureSha256:'c'.repeat(64),
 capturedAt:p.updated_at,verifiedAt:p.updated_at};
 assert.equal(readMonthlyProof(p,tenant).confirmation.signerRole,'representative');
 for(const change of [{signaturePath:'copied.png'},{originalPath:p.confirmation.originalPath.replace(p.id,randomUUID())},{authorityReference:null},
  {originalVersion:''},{signatureSha256:'test'},{verifiedAt:'2026-10-01T00:00:00Z'}]){
  const bad=structuredClone(p);Object.assign(bad.confirmation,change);assert.throws(()=>readMonthlyProof(bad,tenant));
 }
});
test('invalidated originals stay invalidated when an idempotent request is replayed',async()=>{
 const p=fixture();p.status='invalidated';p.finalized_at=p.updated_at;p.invalidated_at=p.updated_at;p.replayed=true;
 p.confirmation={kind:'missing_signature',contentSha256:p.content_sha256,recordedBy:user,reason:'Begründeter Ausnahmefall'};
 const command={action:'finalize_missing',input:{id:p.id,revision:1,content_sha256:p.content_sha256,reason:'Begründeter Ausnahmefall'}};
 const request=randomUUID();let calls=0;
 const r=await executeMonthlyProofCommand(async(name,args)=>{calls++;assert.equal(name,'gkv_monthly_proof_command');assert.equal(args.p_request_id,request);return{data:p,error:null};},tenant,command,request);
 assert.equal(r.status,'invalidated');assert.equal(calls,1);
});
test('missing migration, lost delegation and conflicts return useful failures without automatic replay',async()=>{
 const p=fixture(),command={action:'correct',input:{id:p.id,revision:1,new_id:randomUUID(),reason:'Korrektur'}};
 for(const[code,message]of [['PGRST202',/nicht aktiviert/],['42501',/Beauftragung/],['40001',/geändert/],['23505',/nicht bestätigt/]]){
  let calls=0;await assert.rejects(executeMonthlyProofCommand(async()=>{calls++;return{data:null,error:{code}};},tenant,command,randomUUID()),message);assert.equal(calls,1);
 }
});
test('wrong returned proof cannot be mistaken for the requested correction',async()=>{
 const p=fixture();await assert.rejects(executeMonthlyProofCommand(async()=>({data:p,error:null}),tenant,{action:'correct',input:{id:p.id,revision:1,new_id:randomUUID(),reason:'Korrektur'}},randomUUID()));
});

test('create and correction responses must preserve requested patient, period and predecessor',async()=>{
 const p=fixture();const base={new_id:p.id,client_id:client,month:'2026-10',service_type:'01',source_ids:[p.payload.records[0].recordId]};
 for(const change of [{client_id:randomUUID()},{month:'2026-09'},{service_type:'02'}])await assert.rejects(executeMonthlyProofCommand(async()=>({data:p,error:null}),tenant,{action:'create',input:{...base,...change}},randomUUID()));
 const changed=structuredClone(p);changed.version=2;changed.predecessor_id=randomUUID();
 await assert.rejects(executeMonthlyProofCommand(async()=>({data:changed,error:null}),tenant,{action:'correct',input:{id:randomUUID(),revision:1,new_id:p.id,reason:'Korrektur'}},randomUUID()));
});
