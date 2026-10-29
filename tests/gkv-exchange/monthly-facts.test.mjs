/** Synthetic source mappings, actual PostgreSQL drafts, original PDF/PNG and
 * encrypted SQLite. No real upstream GKV-number capture or approval evidence. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID,randomBytes} from 'node:crypto';
import {readFile,mkdtemp,rm,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {getDocument} from 'pdfjs-dist/legacy/build/pdf.mjs';
import {monthlyHostFixture,signingPng} from './monthly-host-fixture.mjs';
import {MonthlyOriginalVerifier} from '../../services/gkv/monthly-original-verifier.mjs';
import {MonthlyOriginalStore} from '../../services/gkv/monthly-original-store.mjs';
import {monthlyRestDatabase} from '../../services/gkv/monthly-rest-database.mjs';
import {readMonthlyProof} from '../../src/lib/gkvExchange/monthlyProof.ts';
import {monthlyDifferences} from '../../src/lib/gkvExchange/monthlyWorkspace.ts';
import {generateCapturedMonthlyXml} from '../../services/gkv/monthly-captured-xml.mjs';
import {paperScanFixture} from './monthly-paper-fixture.mjs';

const lines=[{code:'0101101',description:'Unterstützung bei der Körperpflege',quantity:'1.00'},
 {code:'0102102',description:'Zeitabhängige Unterstützung',minutes:15}];
test('monthly full facts are frozen before the displayed original and personal confirmation',async t=>{
 const f=await monthlyHostFixture(),dir=await mkdtemp(join(tmpdir(),'monthly-facts-'));
 const store=new MonthlyOriginalStore({path:join(dir,'originals.sqlite'),key:randomBytes(32)});
 const database=monthlyRestDatabase({config:f.config,tenantId:f.tenant,principal:{actorId:f.actorId,sessionId:f.sessionId},authorization:'Bearer '+f.token(),workerKeyId:f.workerKeyId,workerKey:f.workerKey,http:f.http});
 const worker=new MonthlyOriginalVerifier({database,store});let ink=0;
 await f.db.exec('ALTER TABLE clients ADD COLUMN insurance_number text');
 await f.db.exec(await readFile(new URL('../../docs/gkv/sql/monthly-facts-draft.sql',import.meta.url),'utf8'));
 await f.db.query("INSERT INTO care_security.gkv_monthly_fact_profiles VALUES($1,$2,'123456789','999888777','SYNTHETISCHE IK-Zuordnung','SYNTHETISCHE Verantwortlichenprüfung',now()+interval '1 day',NULL)",[f.tenant,f.actorId]);
 const refresh=async v=>{v.p=await f.command('replace_sources',{id:v.p.id,revision:v.p.revision,source_ids:v.p.payload.records.map(r=>r.recordId),reason:'Originalquelle erneut abgleichen'});v.input.revision=v.p.revision;};
 const freeze=async(v,id=randomUUID())=>{v.p=await f.command('freeze_facts',{id:v.p.id,revision:v.p.revision},id);v.input.revision=v.p.revision;return v.p;};
 const setup=async({mapped=true}={})=>{
  const v=await f.proof(),r=v.p.payload.records[0];
  await f.db.query("UPDATE clients SET insurance_number='A123456789' WHERE id=$1",[v.p.payload.clientId]);
  await f.db.query("UPDATE service_records SET source_receipt=source_receipt||$2::jsonb WHERE id=$1",[r.recordId,JSON.stringify({service_started_at:'2026-10-03T08:00:00Z',service_ended_at:'2026-10-03T08:45:00Z'})]);
  await refresh(v);
  if(mapped)await f.db.query("INSERT INTO care_security.gkv_monthly_fact_sources SELECT tenant_id,id,updated_at,encode(sha256(convert_to(source_receipt::text,'UTF8')),'hex'),'123123123',$2::jsonb,'SYNTHETISCHE Leistungszuordnung' FROM service_records WHERE id=$1",[r.recordId,JSON.stringify(lines)]);
  return v;
 };
 const prepare=async v=>{v.original=await worker.prepare(v.input);await worker.acknowledge(v.input,v.original.originalSha256);};
 const confirm=async v=>{v.receipt=await worker.verify(v.input,Buffer.from(signingPng(++ink),'base64'));v.p=await f.command('confirm',{id:v.p.id,revision:v.p.revision,content_sha256:v.p.content_sha256,receipt_id:v.receipt.receiptId});return v.p;};
 try{
  await t.test('private source mappings create complete immutable fields and actual displayed PDF before capture',async()=>{
   const v=await setup(),before=structuredClone(v.p);await freeze(v);readMonthlyProof(v.p,f.tenant);
   const facts=v.p.payload.xmlFacts;assert.equal(v.p.revision,before.revision+1);assert.notEqual(v.p.content_sha256,before.content_sha256);
   assert.equal(facts.captureProvenance,'not-attested');assert.equal(facts.content.responsibleEmployeeNumber,'999888777');
   assert.equal(facts.sources[0].employeeId,before.payload.records[0].employeeId);assert.equal(facts.content.days[0].visits[0].startTime,'1000');
   assert.deepEqual(facts.content.days[0].visits[0].lines,lines.map(l=>({...l,employeeNumbers:['123123123']})));
   assert.ok(monthlyDifferences(before,v.p).some(d=>d.key==='xmlFacts'&&d.after.includes('999888777')));
   await prepare(v);
   const task=getDocument({data:new Uint8Array(v.original.bytes),isEvalSupported:false,verbosity:0});
   try{let text='';const pdf=await task.promise;for(let n=1;n<=pdf.numPages;n++)text+=(await (await pdf.getPage(n)).getTextContent()).items.map(i=>i.str).join(' ');
    for(const field of ['123456789','A123456789','Fiktive','Person','999888777','10:00','0101101','0102102','1.00','15','123123123'])assert.ok(text.includes(field),field);
   }finally{await task.destroy();}
   if(process.env.MONTHLY_FACTS_REVIEW_PDF)await writeFile(process.env.MONTHLY_FACTS_REVIEW_PDF,v.original.bytes);
   await confirm(v);assert.equal(v.p.status,'final');assert.deepEqual(v.p.payload.xmlFacts,facts);
   const captured=store.get(f.tenant,v.input.captureId),xml=await generateCapturedMonthlyXml(captured);
   assert.equal(xml.verification.schemaValid,true);assert.equal(xml.captureBinding.displayedContentMatches,true);
   assert.equal(xml.captureBinding.upstreamEmployeeCaptureVerified,false);assert.equal(xml.verification.dispatchReady,false);
   assert.ok(xml.bytes.includes(Buffer.from('<Beschaeftigtennummer>123123123</Beschaeftigtennummer>')));
   assert.equal(xml.verification.embeddedFileSha256,v.p.confirmation.signatureSha256);
   assert.deepEqual((await generateCapturedMonthlyXml(captured)).bytes,xml.bytes);
   for(const mutate of [s=>s.snapshot.proof.payload.xmlFacts.content.insuranceNumber='B987654321',
    s=>s.original[40]^=1,s=>s.signature[40]^=1,s=>s.receipt.actor_id=randomUUID(),s=>s.receipt.proof_revision++,
    s=>delete s.snapshot.proof.payload.xmlFacts]){
    const changed=structuredClone(captured);mutate(changed);await assert.rejects(generateCapturedMonthlyXml(changed));
   }
   await assert.rejects(generateCapturedMonthlyXml(captured,undefined,{python:'/nonexistent/monthly-python'}));
   const archived=await worker.readArchivedOriginal({tenantId:f.tenant,proofId:v.p.id,captureId:v.input.captureId});assert.deepEqual(archived.bytes,v.original.bytes);
  });
  await t.test('representative paper XML embeds the exact complete reviewed scan and rejects paper patient profile',async()=>{
   const v=await setup();await freeze(v);
   const authorityId=randomUUID();await f.authority(v.p.id,'register',{id:authorityId,signerName:'Fiktive Vertretung',basis:'vollmacht',
    evidenceReference:'SYNTHETISCHE Vollmacht',reviewNote:'Synthetische Identitäts- und Befugnisprüfung.',
    validFrom:new Date(Date.now()-60000).toISOString(),validUntil:new Date(Date.now()+3600000).toISOString(),reviewed:true});
   v.input={...v.input,method:'paper',authorityId};await prepare(v);
   const scanBytes=await paperScanFixture({pdfBase64:v.original.bytes.toString('base64'),original:v.original},100);
   const meta=await worker.uploadScan(v.input,scanBytes);
   v.receipt=await worker.verifyPaper(v.input,{scanSha256:meta.scanSha256,reviewedPages:meta.pages.map(p=>p.sha256),signatureBox:v.original.paper.signatureBox,
    signedAt:new Date().toISOString(),reviewConfirmed:true});
   const captured=store.get(f.tenant,v.input.captureId),scan=store.getScan(f.tenant,v.input.captureId),xml=await generateCapturedMonthlyXml(captured,scan);
   assert.equal(xml.verification.embeddedFileSha256,meta.scanSha256);assert.ok(xml.bytes.includes(Buffer.from('<Art_der_Unterschrift>3</Art_der_Unterschrift>')));
   assert.ok(xml.bytes.includes(Buffer.from(scanBytes.toString('base64'))));
   await assert.rejects(generateCapturedMonthlyXml(captured));
   const changed=structuredClone(scan);changed.bytes[40]^=1;await assert.rejects(generateCapturedMonthlyXml(captured,changed));
   const patient=structuredClone(captured);delete patient.snapshot.authority;patient.receipt.signer_role='patient';patient.receipt.authority_reference=null;patient.receipt.signer_name=v.p.payload.clientName;
   await assert.rejects(generateCapturedMonthlyXml(patient,scan));
   const final=await f.command('confirm',{id:v.p.id,revision:v.p.revision,content_sha256:v.p.content_sha256,receipt_id:v.receipt.receiptId});assert.equal(final.status,'final');
  });
  await t.test('browser cannot submit replacements, write private mappings or call private helpers',async()=>{
   const v=await setup();await assert.rejects(f.command('freeze_facts',{id:v.p.id,revision:v.p.revision,employeeNumber:'666666666'}));
   for(const table of ['gkv_monthly_fact_profiles','gkv_monthly_fact_sources','gkv_monthly_fact_employee_locks']){
    await assert.rejects(f.as(f.claims(),`SELECT * FROM care_security.${table}`),e=>e.code==='42501');
    await assert.rejects(f.as(f.claims(),`DELETE FROM care_security.${table}`),e=>e.code==='42501');
   }
   const grants=(await f.db.query("SELECT has_function_privilege('authenticated','care_security.gkv_monthly_freeze_facts(public.gkv_monthly_proofs)','EXECUTE') a, has_function_privilege('service_role','care_security.gkv_monthly_build_facts(public.gkv_monthly_proofs,uuid,timestamptz)','EXECUTE') b")).rows[0];assert.deepEqual(grants,{a:false,b:false});
   await assert.rejects(f.command('freeze_facts',{id:v.p.id,revision:v.p.revision},randomUUID(),f.claims({sub:f.otherActor,session_id:f.otherSession})),e=>e.code==='42501');
  });
  await t.test('distinct actual visits keep chronological numbers in PDF/XML and duplicate source visits fail closed',async()=>{
   const v=await setup(),r=v.p.payload.records[0],record='00000000-0000-4000-8000-000000000001',visit=randomUUID();
   const receipt={...r.sourceReceipt,proof_id:visit,visit_id:visit,service_started_at:'2026-10-03T11:00:00Z',service_ended_at:'2026-10-03T11:45:00Z'};
   await f.db.query('INSERT INTO assist_visit_proofs SELECT $1,tenant_id,$1,payload_hash,payload_snapshot FROM assist_visit_proofs WHERE id=$2',[visit,r.sourceReceipt.proof_id]);
   await f.db.query('INSERT INTO service_records SELECT $1,tenant_id,client_id,employee_id,updated_at,service_date,status,actual_minutes,$3,true FROM service_records WHERE id=$2',[record,r.recordId,receipt]);
   await f.db.query("INSERT INTO care_security.gkv_monthly_fact_sources SELECT tenant_id,id,updated_at,encode(sha256(convert_to(source_receipt::text,'UTF8')),'hex'),'123123123',$2,'SYNTHETISCHER zweiter Einsatz' FROM service_records WHERE id=$1",[record,JSON.stringify(lines)]);
   v.p=await f.command('replace_sources',{id:v.p.id,revision:v.p.revision,source_ids:[record,r.recordId],reason:'Zweiter getrennter Einsatz'});await freeze(v);
   assert.deepEqual(v.p.payload.xmlFacts.content.days[0].visits.map(v=>[v.sequence,v.startTime]),[[1,'1000'],[2,'1300']]);
   await prepare(v);const task=getDocument({data:new Uint8Array(v.original.bytes),isEvalSupported:false,verbosity:0});
   try{let text='';const pdf=await task.promise;for(let n=1;n<=pdf.numPages;n++)text+=(await (await pdf.getPage(n)).getTextContent()).items.map(i=>i.str).join(' ');
    assert.ok(text.indexOf('Einsatz 1')<text.indexOf('Einsatz 2'));assert.ok(text.includes('13:00'));
   }finally{await task.destroy();}
   await f.db.query('UPDATE service_records SET source_receipt=$2 WHERE id=$1',[record,r.sourceReceipt]);await refresh(v);
   await f.db.query("UPDATE care_security.gkv_monthly_fact_sources SET source_receipt_sha256=(SELECT encode(sha256(convert_to(source_receipt::text,'UTF8')),'hex') FROM service_records WHERE id=$1) WHERE record_id=$1",[record]);
   await assert.rejects(freeze(v),e=>e.code==='22023');
  });
  await t.test('missing mapping does not consume request, alter version or make up employee numbers',async()=>{
   const v=await setup({mapped:false}),before=structuredClone(v.p),id=randomUUID();
   await assert.rejects(f.command('freeze_facts',{id:v.p.id,revision:v.p.revision},id),e=>e.code==='22023');
   const actual=(await f.db.query('SELECT * FROM gkv_monthly_proofs WHERE id=$1',[v.p.id])).rows[0];assert.equal(actual.revision,before.revision);assert.equal(actual.content_sha256,before.content_sha256);
   assert.equal((await f.db.query('SELECT count(*)::int n FROM care_security.gkv_monthly_requests WHERE request_id=$1',[id])).rows[0].n,0);
  });
  await t.test('response loss reuses one request, one revision and one event; conflicting retry fails',async()=>{
   const v=await setup(),input={id:v.p.id,revision:v.p.revision},id=randomUUID();await freeze(v,id);
   const replay=await f.command('freeze_facts',input,id);assert.equal(replay.replayed,true);assert.equal(replay.revision,v.p.revision);
   assert.equal((await f.db.query("SELECT count(*)::int n FROM gkv_monthly_proof_events WHERE proof_id=$1 AND action='freeze_facts'",[v.p.id])).rows[0].n,1);
   await assert.rejects(f.command('freeze_facts',{...input,revision:input.revision+1},id));
  });
  await t.test('changed mappings block the pending signature; renewed facts require a new capture',async()=>{
   const v=await setup();await freeze(v);await prepare(v);const oldInput=structuredClone(v.input);
   await f.db.query("UPDATE care_security.gkv_monthly_fact_sources SET lines=$2 WHERE record_id=$1",[v.p.payload.records[0].recordId,JSON.stringify([{...lines[0],quantity:'2.00'},lines[1]])]);
   await assert.rejects(worker.verify(v.input,Buffer.from(signingPng(++ink),'base64')));
   await freeze(v);await assert.rejects(worker.readOriginal(oldInput));await assert.rejects(worker.prepare(v.input),/CHANGED/);
   v.input.captureId=randomUUID();await prepare(v);await confirm(v);assert.equal(v.p.payload.xmlFacts.content.days[0].visits[0].lines[0].quantity,'2.00');
  });
  await t.test('client insurance edits block confirmation while archived originals remain unchanged',async()=>{
   const v=await setup();await freeze(v);await prepare(v);
   await f.db.query("UPDATE clients SET insurance_number='B987654321' WHERE id=$1",[v.p.payload.clientId]);
   await assert.rejects(worker.verify(v.input,Buffer.from(signingPng(++ink),'base64')));
   await freeze(v);v.input.captureId=randomUUID();await prepare(v);await confirm(v);
   await f.db.query("UPDATE clients SET insurance_number='C123456789' WHERE id=$1",[v.p.payload.clientId]);
   assert.deepEqual((await worker.readArchivedOriginal({tenantId:f.tenant,proofId:v.p.id,captureId:v.input.captureId})).bytes,v.original.bytes);
  });
  await t.test('original employee number survives correction and source replacement without the old signature',async()=>{
   const v=await setup();await freeze(v);await prepare(v);await confirm(v);const prior=structuredClone(v.p);
   v.p=await f.command('correct',{id:v.p.id,revision:v.p.revision,new_id:randomUUID(),reason:'Fachliche Korrektur'});v.input.proofId=v.p.id;v.input.revision=v.p.revision;
   assert.equal(v.p.confirmation,null);assert.deepEqual(v.p.payload.xmlFacts,prior.payload.xmlFacts);
   await refresh(v);assert.equal(v.p.payload.xmlFacts,undefined);
   await f.db.query("UPDATE care_security.gkv_monthly_fact_sources SET employee_number='666666666' WHERE record_id=$1",[v.p.payload.records[0].recordId]);
   await assert.rejects(freeze(v),e=>e.code==='40001');
   await f.db.query("UPDATE care_security.gkv_monthly_fact_sources SET employee_number='123123123' WHERE record_id=$1",[v.p.payload.records[0].recordId]);await freeze(v);
   assert.equal(v.p.payload.xmlFacts.sources[0].employeeNumber,'123123123');
  });
  await t.test('a source receipt change is detected even with an unchanged source timestamp',async()=>{
   const v=await setup();await freeze(v);await f.db.query("UPDATE service_records SET source_receipt=source_receipt||'{\"service_started_at\":\"2026-10-03T08:05:00Z\"}'::jsonb WHERE id=$1",[v.p.payload.records[0].recordId]);
   await assert.rejects(freeze(v),e=>e.code==='40001');await refresh(v);await assert.rejects(freeze(v),e=>e.code==='22023');
  });
  await t.test('contract rejects unbound visits, source dates, original employees and extra fields',async()=>{
   const v=await setup();await freeze(v);
   for(const mutate of [p=>p.payload.xmlFacts.sources[0].employeeId=randomUUID(),p=>p.payload.xmlFacts.content.days[0].visits[0].startTime='1100',
    p=>p.payload.xmlFacts.content.days[0].visits[0].lines[0].employeeNumbers=['555555555'],p=>p.payload.xmlFacts.content.insuranceNumber='',
    p=>p.payload.xmlFacts.content.days[0].visits[0].lines[1].minutes=46,p=>p.payload.xmlFacts.extra=true,
    p=>p.payload.xmlFacts.content.firstName='Fremde',p=>p.payload.xmlFacts.captureProvenance='verified']){
    const changed=structuredClone(v.p);mutate(changed);assert.throws(()=>readMonthlyProof(changed,f.tenant));
   }
  });
  await t.test('SQL prevents wrong profile, amount/minute mismatch, manual employee override and source-time omission',async()=>{
   const v=await setup(),id=v.p.payload.records[0].recordId;
   for(const invalid of [[{...lines[0],employeeNumbers:['555555555']}],[{...lines[0],code:'0701101'}],[{...lines[0],quantity:'0.00'}],[{...lines[1],minutes:46}],[{...lines[1],quantity:'1.00'}]]){
    await f.db.query('UPDATE care_security.gkv_monthly_fact_sources SET lines=$2 WHERE record_id=$1',[id,JSON.stringify(invalid)]);await assert.rejects(freeze(v),e=>e.code==='22023');
   }
   await f.db.query('UPDATE care_security.gkv_monthly_fact_sources SET lines=$2 WHERE record_id=$1',[id,JSON.stringify(lines)]);
   await f.db.query("UPDATE service_records SET source_receipt=source_receipt-'service_started_at' WHERE id=$1",[id]);await refresh(v);
   await f.db.query("UPDATE care_security.gkv_monthly_fact_sources SET source_receipt_sha256=(SELECT encode(sha256(convert_to(source_receipt::text,'UTF8')),'hex') FROM service_records WHERE id=$1) WHERE record_id=$1",[id]);
   await assert.rejects(freeze(v),e=>e.code==='22023');
  });
 }finally{database.close();store.close();await f.close();await rm(dir,{recursive:true,force:true});}
});
