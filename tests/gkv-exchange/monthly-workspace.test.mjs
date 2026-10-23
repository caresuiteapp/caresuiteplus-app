import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {MonthlyProofWriteError,executeMonthlyProofCommand} from '../../src/lib/gkvExchange/monthlyProof.ts';
import {readMonthlyClients,readMonthlyWorkspace,readMonthlySources,readMonthlyRequestStatus,monthlyDifferences} from '../../src/lib/gkvExchange/monthlyWorkspace.ts';
import {MonthlyProofWriter} from '../../src/lib/gkvExchange/monthlyWriter.ts';
import {tenant,client,month,fixture,finalProof,signedProof,workspace,sources,orderedId,deferred} from './monthly-fixtures.mjs';

test('client pagination binds tenant, month, exact search and UUID cursor',()=>{
 const base={contract:'gkv-monthly-clients-v1',tenantId:tenant,month,search:'Test',after:null,nextCursor:orderedId(50),
  clients:Array.from({length:50},(_,i)=>({id:orderedId(i+1),name:'Test '+i}))};
 assert.equal(readMonthlyClients(base,tenant,month,'Test',null).items.length,50);
 const second={...base,after:orderedId(50),nextCursor:null,clients:[{id:orderedId(51),name:'Test 51'}]};
 assert.equal(readMonthlyClients(second,tenant,month,'Test',orderedId(50)).nextCursor,null);
 for(const delta of [{tenantId:randomUUID()},{month:'2026-09'},{search:'Te%'},{after:orderedId(2)},
  {clients:base.clients.slice(1)},{nextCursor:orderedId(49)},{clients:[base.clients[0],base.clients[0]],nextCursor:null},
  {clients:[{id:orderedId(1),name:''}],nextCursor:null},{clients:base.clients.toReversed()}])
  assert.throws(()=>readMonthlyClients({...base,...delta},tenant,month,'Test',null));
 assert.throws(()=>readMonthlyClients({...second,clients:[base.clients[1]]},tenant,month,'Test',second.after));
});
test('workspace has one current proof per type and keeps write delegation distinct from reading',()=>{
 const p=fixture(),base={contract:'gkv-monthly-workspace-v1',...workspace(p)};
 assert.equal(readMonthlyWorkspace({...base,canWrite:false},tenant,client,month).canWrite,false);
 for(const delta of [{clientId:randomUUID()},{canWrite:'true'},{proofs:[base.proofs[0],base.proofs[0]]},
  {proofs:[{...base.proofs[0],status:'invalidated'}]},{proofs:[{...base.proofs[0],status:'final'}]},
  {proofs:[{...base.proofs[0],recordCount:501}]},{proofs:[{...base.proofs[0],serviceType:'99'}]}])
  assert.throws(()=>readMonthlyWorkspace({...base,...delta},tenant,client,month));
 const final={contract:base.contract,...workspace(finalProof(p))};
 assert.equal(readMonthlyWorkspace(final,tenant,client,month).proofs[0].confirmationKind,'missing_signature');
});
test('source selection rejects foreign context, invalid dates, caregiver identities and unsafe pagination',()=>{
 const p=fixture(),base={contract:'gkv-monthly-sources-v1',tenantId:tenant,clientId:client,month,after:null,nextCursor:null,sources:sources(p)};
 assert.equal(readMonthlySources(base,tenant,client,month,null).items[0].description,p.payload.records[0].description);
 for(const delta of [{serviceDate:'2026-10-32'},{serviceDate:'2026-09-30'},{employeeId:''},{actualMinutes:0},{assignedSeriesId:'bad'},{updatedAt:'bad'}])
  assert.throws(()=>readMonthlySources({...base,sources:[{...base.sources[0],...delta}]},tenant,client,month,null));
 assert.throws(()=>readMonthlySources({...base,clientId:randomUUID()},tenant,client,month,null));
});
test('request status accepts current invalidated original and rejects wrong request or partial proof',()=>{
 const p=finalProof(),id=randomUUID(),base={contract:'gkv-monthly-request-v1',tenantId:tenant,requestId:id,state:'not_found',proof:null};
 assert.equal(readMonthlyRequestStatus(base,tenant,id).state,'not_found');
 const current={...base,state:'applied',proof:{...p,status:'invalidated',invalidated_at:p.updated_at}};
 assert.equal(readMonthlyRequestStatus(current,tenant,id).proof.status,'invalidated');
 for(const delta of [{requestId:randomUUID()},{tenantId:randomUUID()},{state:'applied'},{proof:p}])assert.throws(()=>readMonthlyRequestStatus({...base,...delta},tenant,id));
});
test('comparison identifies source, task and caregiver changes without inventing a confirmation',()=>{
 const a=fixture(),b=structuredClone(a);b.revision++;b.content_sha256='b'.repeat(64);
 assert.deepEqual(monthlyDifferences(a,b),[]);
 b.payload.records[0].description='Neue Beschreibung';b.payload.records[0].actualMinutes=45;
 b.payload.records[0].tasks[0].completionNote='Korrigiert';b.payload.records[0].employeeId=randomUUID();
 b.payload.records[0].sourceReceipt.proof_id=randomUUID();
 const diffs=monthlyDifferences(a,b);assert.equal(diffs.length,5);assert.ok(diffs.every(d=>d.before!==d.after));
 assert.match(diffs.find(d=>d.key.endsWith(':receipt')).after,/Originalbeleg geändert/);
 for(const change of [p=>p.tenant_id=randomUUID(),p=>p.series_id=randomUUID(),p=>p.payload.month='2026-09',p=>p.payload.serviceType='02',p=>p.payload.clientId=randomUUID()]){
  const other=structuredClone(b);change(other);assert.throws(()=>monthlyDifferences(a,other));
 }
 const removed=structuredClone(a);removed.payload.records=[];assert.equal(monthlyDifferences(a,removed)[0].after,'Entfernt');
 assert.equal(monthlyDifferences(removed,a)[0].before,'Nicht enthalten');
});

const create=p=>({action:'create',input:{new_id:p.id,client_id:client,month,service_type:'01',source_ids:p.payload.records.map(r=>r.recordId)}});
test('writer permits one in-flight command, clones input and makes no automatic retries',async()=>{
 const p=fixture(),d=deferred(),sent=[],c=create(p),id=randomUUID();
 const writer=new MonthlyProofWriter({execute:async(...args)=>{sent.push(structuredClone(args));return d.promise;},status:async()=>{throw Error('unexpected');}},()=>id);
 const result=writer.submit(c);c.input.source_ids=[];
 await assert.rejects(writer.submit(c),/laufenden Speicherung/);assert.equal(sent.length,1);assert.equal(sent[0][0].input.source_ids.length,1);
 assert.equal(sent[0][1],id);d.resolve(p);assert.equal((await result).id,p.id);assert.equal(writer.pending,null);assert.equal(writer.busy,false);
});
test('lost response is resolved through a read-only check, including subsequently invalidated originals',async()=>{
 const p=finalProof(),id=randomUUID();let writes=0,reads=0;
 const writer=new MonthlyProofWriter({execute:async()=>{writes++;throw Error('network');},status:async request=>{reads++;assert.equal(request,id);return {state:'applied',proof:{...p,status:'invalidated',invalidated_at:p.updated_at}};}},()=>id);
 await assert.rejects(writer.submit(create(p)),/network/);assert.ok(writer.pending);await assert.rejects(writer.retry(),/zuerst/);
 assert.equal((await writer.check()).proof.status,'invalidated');assert.equal(writer.pending,null);assert.equal(writes,1);assert.equal(reads,1);
});
test('not-found recovery retries exactly the same command and identifier, never a new correction',async()=>{
 const p=fixture(),sent=[],id=randomUUID(),command=create(p);let n=0;
 const writer=new MonthlyProofWriter({execute:async(...args)=>{sent.push(structuredClone(args));if(++n===1)throw Error('timeout');return p;},status:async()=>({state:'not_found',proof:null})},()=>id);
 await assert.rejects(writer.submit(command));await writer.check();assert.equal(writer.checkedNotFound,true);
 await writer.retry();assert.deepEqual(sent[0],sent[1]);assert.equal(writer.pending,null);
});
test('failed or misbound status checks retain the pending command and revoke retry readiness',async()=>{
 const p=fixture();let status={state:'not_found',proof:null};
 const writer=new MonthlyProofWriter({execute:async()=>{throw Error('timeout');},status:async()=>{if(status instanceof Error)throw status;return status;}},randomUUID);
 await assert.rejects(writer.submit(create(p)));await writer.check();assert.equal(writer.checkedNotFound,true);
 status=Error('revoked');await assert.rejects(writer.check());assert.equal(writer.checkedNotFound,false);assert.ok(writer.pending);
 status={state:'applied',proof:fixture()};await assert.rejects(writer.check(),/Auftragsantwort/);assert.ok(writer.pending);
});
test('definite database rejections release editing; unknown server results retain their request',async()=>{
 const p=fixture(),command=create(p);
 for(const [code,uncertain]of [['42501',false],['40001',false],['PGRST202',false],['23505',false],['P0001',false],['XX000',true],['57014',true]]){
  const writer=new MonthlyProofWriter({execute:(c,id)=>executeMonthlyProofCommand(async()=>({data:null,error:{code}}),tenant,c,id),status:async()=>({state:'not_found',proof:null})},randomUUID);
  await assert.rejects(writer.submit(command),error=>error instanceof MonthlyProofWriteError&&error.uncertain===uncertain);
  assert.equal(!!writer.pending,uncertain);
 }
});

test('recovery retains the original request when the same ID carries a different patient, month or service type',async()=>{
 for(const change of [p=>p.payload.clientId=randomUUID(),p=>p.payload.month='2026-09',p=>p.payload.serviceType='02',p=>p.version=2]){
  const p=fixture(),other=structuredClone(p);change(other);
  const writer=new MonthlyProofWriter({execute:async()=>{throw Error('timeout');},status:async()=>({state:'applied',proof:other})},randomUUID);
  await assert.rejects(writer.submit(create(p)));const pending=structuredClone(writer.pending);
  await assert.rejects(writer.check());assert.deepEqual(writer.pending,pending);assert.equal(writer.checkedNotFound,false);
 }
});

test('correction recovery requires the requested predecessor and keeps later revisions valid',async()=>{
 const p=fixture(),command={action:'correct',input:{id:randomUUID(),revision:4,new_id:p.id,reason:'Korrektur'}};
 let current={...p,version:2,predecessor_id:randomUUID()};
 const writer=new MonthlyProofWriter({execute:async()=>{throw Error('timeout');},status:async()=>({state:'applied',proof:current})},randomUUID);
 await assert.rejects(writer.submit(command));await assert.rejects(writer.check());assert.ok(writer.pending);
 current={...finalProof(current),predecessor_id:command.input.id,revision:3,status:'invalidated',invalidated_at:p.updated_at};
 assert.equal((await writer.check()).proof.status,'invalidated');assert.equal(writer.pending,null);
});

test('confirmation recovery requires the exact receipt and immutable content, even after correction',async()=>{
 const p=fixture(),receipt=randomUUID(),command={action:'confirm',input:{id:p.id,revision:2,content_sha256:p.content_sha256,receipt_id:receipt}};
 const valid={...signedProof({...p,revision:2},receipt),status:'invalidated',invalidated_at:p.updated_at};
 for(const change of [p=>p.content_sha256='b'.repeat(64),p=>p.confirmation.receiptId=randomUUID(),p=>p.confirmation.kind='missing_signature',p=>p.revision=2,p=>p.status='open']){
  let current=structuredClone(valid);change(current);
  const writer=new MonthlyProofWriter({execute:async()=>{throw Error('timeout');},status:async()=>({state:'applied',proof:current})},randomUUID);
  await assert.rejects(writer.submit(command));await assert.rejects(writer.check());assert.ok(writer.pending);
  current=valid;assert.equal((await writer.check()).proof.id,p.id);assert.equal(writer.pending,null);
 }
});

test('an invalid immediate transport result leaves the same request available for read-only recovery',async()=>{
 const p=fixture(),invalid=structuredClone(p);invalid.payload.clientId=randomUUID();let writes=0;
 const writer=new MonthlyProofWriter({execute:async()=>{writes++;return invalid;},status:async()=>({state:'applied',proof:p})},randomUUID);
 await assert.rejects(writer.submit(create(p)));const request=writer.pending.requestId;
 assert.equal((await writer.check()).proof.id,p.id);assert.equal(writer.pending,null);assert.equal(writes,1);assert.ok(request);
});
