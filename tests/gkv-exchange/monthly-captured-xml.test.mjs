/** Host tests: actual Python/XSD parsing, immutable capture and encrypted originals. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {writeFile} from 'node:fs/promises';
import {getDocument} from 'pdfjs-dist/legacy/build/pdf.mjs';
import {signingPng} from './monthly-host-fixture.mjs';
import {readMonthlyProof} from '../../src/lib/gkvExchange/monthlyProof.ts';
import {monthlyDifferences} from '../../src/lib/gkvExchange/monthlyWorkspace.ts';
import {generateCapturedMonthlyXml} from '../../services/gkv/monthly-captured-xml.mjs';
import {paperScanFixture} from './monthly-paper-fixture.mjs';
import {monthlyFactsFixture,lines} from './monthly-facts-fixture.mjs';
test('monthly captured XML: actual Python/XSD worker, originals and confirmation',async t=>{
 const fixture=await monthlyFactsFixture();
 const {f,store,worker,setup,freeze,refresh,prepare,confirm}=fixture;let ink=20;
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
 }finally{await fixture.close();}
});
