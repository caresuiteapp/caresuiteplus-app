/** Actual XML worker + encrypted SQLite; synthetic SQL/auth/ink, no hardware. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {randomUUID} from 'node:crypto';
import {MonthlyOriginalStore} from '../../services/gkv/monthly-original-store.mjs';
import {MonthlyOriginalVerifier} from '../../services/gkv/monthly-original-verifier.mjs';
import {inspectMonthlySignature} from '../../services/gkv/monthly-signature-png.mjs';
import {generateCapturedMonthlyXml} from '../../services/gkv/monthly-captured-xml.mjs';
import {monthlyFactsFixture} from './monthly-facts-fixture.mjs';
import {signingPng} from './monthly-host-fixture.mjs';

test('monthly embedded signature: atomic XML storage and identity-only continuation',async t=>{
 const m=await monthlyFactsFixture();let ink=50;
 const ready=async()=>{const v=await m.setup();await m.freeze(v);await m.prepare(v);v.png=Buffer.from(signingPng(++ink),'base64');return v;};
 const raw=fn=>{const db=new DatabaseSync(m.storeOptions.path);try{return fn(db);}finally{db.close();}};
 const row=v=>raw(db=>db.prepare('SELECT signature,signature_binding,receipt,signature_ink_digest FROM monthly_originals WHERE capture=?').get(v.input.captureId));
 const pause=async v=>{
  let pending;const save=m.store.reserveEmbeddedSignature;
  m.store.reserveEmbeddedSignature=(tenant,capture,value,candidate)=>{pending={tenant,capture,value:structuredClone(value),candidate};throw Error('synthetic pause before commit');};
  try{await assert.rejects(m.worker.verify(v.input,v.png),/synthetic pause/);}finally{m.store.reserveEmbeddedSignature=save;}
  assert.ok(pending);return pending;
 };
 const commit=(pending,store=m.store)=>store.reserveEmbeddedSignature(pending.tenant,pending.capture,pending.value,pending.candidate);
 try{
  await t.test('no standalone image is written at any SQLite insert/update, even before an issuer response',async()=>{
   raw(db=>db.exec(`CREATE TRIGGER reject_separate_insert BEFORE INSERT ON monthly_originals WHEN NEW.signature IS NOT NULL BEGIN SELECT RAISE(ABORT,'standalone image forbidden'); END;
     CREATE TRIGGER reject_separate_update BEFORE UPDATE ON monthly_originals WHEN NEW.signature IS NOT NULL BEGIN SELECT RAISE(ABORT,'standalone image forbidden'); END;`));
   const v=await ready(),issue=m.database.issue;let count=0;
   m.database.issue=async receipt=>{const result=await issue(receipt);if(++count===1)throw Error('synthetic lost receipt response');return result;};
   try{
    await assert.rejects(m.worker.verify(v.input,v.png),/lost receipt/);
    const stored=m.store.get(m.f.tenant,v.input.captureId),component=m.store.getComponent(m.f.tenant,v.input.captureId);
    assert.equal(stored.signature,null);assert.equal(stored.signatureStorage,'embedded-only');assert.equal(row(v).signature,null);
    assert.ok(row(v).signature_binding);assert.ok(component.xml.includes(v.png.toString('base64')));
    assert.equal(component.record.state,'prepared');assert.equal(component.record.dispatchReady,false);
    const opened=new MonthlyOriginalStore(m.storeOptions);
    try{
     const worker=new MonthlyOriginalVerifier({database:m.database,store:opened,requireComponents:false});
     const result=await worker.resumeVerification(v.input);assert.equal(result.receiptId,stored.receipt.id);
     assert.deepEqual(opened.getComponent(m.f.tenant,v.input.captureId).xml,component.xml);
    }finally{opened.close();}
    await assert.rejects(m.worker.verify(v.input,Buffer.from(signingPng(++ink),'base64')),/MONTHLY_CAPTURE_CONFLICT/);
    await assert.rejects(m.worker.acknowledge(v.input,v.original.originalSha256),/ACKNOWLEDGMENT/);
   }finally{m.database.issue=issue;raw(db=>db.exec('DROP TRIGGER reject_separate_insert; DROP TRIGGER reject_separate_update;'));}
  });
  await t.test('rollback between receipt metadata and XML leaves neither partial receipt nor image',async()=>{
   const v=await ready(),pending=await pause(v);
   raw(db=>db.exec("CREATE TRIGGER reject_component BEFORE INSERT ON monthly_components BEGIN SELECT RAISE(ABORT,'synthetic write interruption'); END;"));
   try{assert.throws(()=>commit(pending),/synthetic write interruption/);}finally{raw(db=>db.exec('DROP TRIGGER reject_component;'));}
   assert.equal(row(v).receipt,null);assert.equal(row(v).signature,null);assert.equal(row(v).signature_binding,null);
   assert.equal(m.store.getComponent(m.f.tenant,v.input.captureId),null);
   await assert.rejects(m.worker.resumeVerification(v.input),/MONTHLY_SIGNATURE_NOT_STORED/);
   commit(pending);assert.equal((await m.worker.resumeVerification(v.input)).receiptId,pending.value.receipt.id);
  });
  await t.test('quota failure rolls back both objects and permits a later exact atomic commit',async()=>{
   const v=await ready(),pending=await pause(v),small=new MonthlyOriginalStore({...m.storeOptions,maxTenantBytes:1024});
   try{assert.throws(()=>commit(pending,small),/MONTHLY_STORE_QUOTA/);}finally{small.close();}
   assert.equal(row(v).receipt,null);assert.equal(row(v).signature,null);assert.equal(m.store.getComponent(m.f.tenant,v.input.captureId),null);
   commit(pending);assert.equal((await m.worker.resumeVerification(v.input)).receiptId,pending.value.receipt.id);
  });
  await t.test('copied success flags, altered XML and another receipt cannot authorize an embedded write',async()=>{
   const v=await ready(),p=await pause(v);
   assert.throws(()=>commit({...p,candidate:structuredClone(p.candidate)}),/MONTHLY_XML_CAPTURE_BINDING/);
   assert.throws(()=>commit({...p,value:{...p.value,receipt:{...p.value.receipt,id:randomUUID()}}}),/MONTHLY_XML_CAPTURE_BINDING/);
   p.candidate.bytes[30]^=1;assert.throws(()=>commit(p),/MONTHLY_XML_CAPTURE_BINDING/);p.candidate.bytes[30]^=1;
   const verification=p.candidate.verification;p.candidate.verification={...verification,schemaValid:false};
   assert.throws(()=>commit(p),/MONTHLY_XML_CAPTURE_BINDING/);p.candidate.verification=verification;
   assert.equal(row(v).receipt,null);commit(p);assert.equal(m.store.get(m.f.tenant,v.input.captureId).signature,null);
  });
  await t.test('a committed ink fingerprint still prevents reuse in another capture after the PNG is gone',async()=>{
   const first=await ready();await m.worker.verify(first.input,first.png);
   const second=await ready();await assert.rejects(m.worker.verify(second.input,first.png),/MONTHLY_SIGNATURE_REUSED/);
   assert.equal(row(second).receipt,null);assert.equal(m.store.getComponent(m.f.tenant,second.input.captureId),null);
  });
  await t.test('foreign login and changed source cannot resume a stored XML capture',async()=>{
   const v=await ready(),pending=await pause(v);commit(pending);
   const context=m.database.context;
   m.database.context=async input=>({...await context(input),sessionId:randomUUID()});
   try{await assert.rejects(m.worker.resumeVerification(v.input),/MONTHLY_CAPTURE_CONTEXT_CHANGED/);}finally{m.database.context=context;}
   await m.f.db.query("UPDATE clients SET insurance_number='B987654321' WHERE id=$1",[v.p.payload.clientId]);
   await assert.rejects(m.worker.resumeVerification(v.input));
   assert.equal((await m.f.db.query('SELECT count(*)::int n FROM care_security.gkv_monthly_confirmation_receipts WHERE proof_id=$1',[v.p.id])).rows[0].n,0);
  });
  await t.test('swapped binding, missing XML and modified XML fail closed rather than reconstructing a PNG',async()=>{
   const a=await ready(),b=await ready();commit(await pause(a));commit(await pause(b));
   const binding=row(a).signature_binding;
   raw(db=>db.prepare('UPDATE monthly_originals SET signature_binding=? WHERE capture=?').run(row(b).signature_binding,a.input.captureId));
   assert.throws(()=>m.store.get(m.f.tenant,a.input.captureId),/STORE_AUTHENTICATION/);
   raw(db=>db.prepare('UPDATE monthly_originals SET signature_binding=? WHERE capture=?').run(binding,a.input.captureId));
   const xml=raw(db=>db.prepare('SELECT xml FROM monthly_components WHERE capture=?').get(a.input.captureId).xml);
   const changed=Buffer.from(xml);changed[changed.length-1]^=1;
   raw(db=>db.prepare('UPDATE monthly_components SET xml=? WHERE capture=?').run(changed,a.input.captureId));
   await assert.rejects(m.worker.resumeVerification(a.input),/STORE_AUTHENTICATION/);
   raw(db=>db.prepare('UPDATE monthly_components SET xml=? WHERE capture=?').run(xml,a.input.captureId));
   raw(db=>db.prepare('DELETE FROM monthly_components WHERE capture=?').run(b.input.captureId));
   await assert.rejects(m.worker.resumeVerification(b.input),/MONTHLY_STORE_INTEGRITY/);
  });
  await t.test('an older standalone capture is converted only with the exact independently checked XML',async()=>{
   const v=await ready(),p=await pause(v);
   const legacy=m.store.reserveSignature(m.f.tenant,v.input.captureId,inspectMonthlySignature(v.png),(_original,version)=>({...p.value.receipt,signature_version:version}));
   assert.ok(legacy.signature);assert.equal(legacy.signatureStorage,'separate');
   const migrated={...p,value:legacy,candidate:await generateCapturedMonthlyXml(legacy)};
   m.store.reserveComponent(m.f.tenant,v.input.captureId,migrated.candidate);
   const saved=m.store.getComponent(m.f.tenant,v.input.captureId).xml;
   commit(migrated);assert.equal(row(v).signature,null);assert.equal(m.store.get(m.f.tenant,v.input.captureId).signatureStorage,'embedded-only');
   assert.deepEqual(m.store.getComponent(m.f.tenant,v.input.captureId).xml,saved);
   assert.equal((await m.worker.resumeVerification(v.input)).receiptId,legacy.receipt.id);
  });
  await t.test('opening the previous SQLite schema adds the binding column without deleting older images',async()=>{
   const v=await ready(),p=await pause(v),options={...m.storeOptions,path:m.storeOptions.path+'.old'};
   const old=new MonthlyOriginalStore(options),original=old.create(p.value.snapshot,p.value.original);
   old.acknowledge(m.f.tenant,v.input.captureId,original.originalSha256,p.value.acknowledgedAt);
   old.reserveSignature(m.f.tenant,v.input.captureId,inspectMonthlySignature(v.png),(o,version)=>({...p.value.receipt,original_version:o.originalVersion,signature_version:version}));
   old.close();
   const db=new DatabaseSync(options.path);try{db.exec('ALTER TABLE monthly_originals DROP COLUMN signature_binding');}finally{db.close();}
   const upgraded=new MonthlyOriginalStore(options);
   try{const stored=upgraded.get(m.f.tenant,v.input.captureId);assert.equal(stored.signatureStorage,'separate');assert.deepEqual(stored.signature,v.png);}
   finally{upgraded.close();}
  });
 }finally{await m.close();}
});
