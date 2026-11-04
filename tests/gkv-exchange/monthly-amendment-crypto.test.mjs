// Portable layer of the integration check. This uses the existing unsigned-XML
// fixture, actual official XSD and real CMS bytes. It deliberately cannot mark a
// host attempt signed/complete, verify TI trust, or replace the private-host test.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createPrivateKey,randomUUID,X509Certificate} from 'node:crypto';
import {XmlDocument,ParseOption} from 'libxml2-wasm';
import {assistDeferredFixture} from './monthly-assist-deferred-fixture.mjs';
import {makeCmsReply} from './connector-cms-fixture.mjs';
import {testPki} from './pki-fixture.mjs';
import {certificateRequest} from '../../services/kim/connector-xml.mjs';
import {verifyEccComponentSignedContent} from '../../services/kim/ecc-cms.mjs';
import {openssl} from '../../services/gkv/openssl.mjs';

test('Amended month: verify exact XML content in two independent CMS signatures without claiming TI trust',async()=>{
 const x=await assistDeferredFixture(),{f}=x;let pki;
 try{
  await f.db.exec(await readFile(new URL('../../docs/gkv/sql/monthly-assist-amendments-draft.sql',import.meta.url),'utf8'));
  await x.approve(await x.submit());const v=await x.prepareDeferred();await x.releaseDeferred(v);await x.closeVisit(v);await x.signDeferred(v);
  const o=(await x.seal(v,(await x.context(v)).draft)).original;assert.equal((await x.complete(v)).status,200);
  pki=await testPki();const signing=await pki.issueKim({name:'synthetic-monthly-amendment',role:'osig'});
  const cert=new X509Certificate(signing.certificate).raw;
  const key=createPrivateKey({key:await readFile(signing.privateKeyPath),passphrase:pki.password});
  const peer=makeCmsReply({signingCertificate:cert,signingKey:key});
  const verify=async(m)=>{
   await x.freeze(m);await x.prepare(m);const final=await x.confirm(m);
   const archive=x.store.getComponent(f.tenant,m.input.captureId);
   assert.equal(archive.record.state,'prepared');assert.equal(archive.record.hardwareEvidence,'not-attested');assert.equal(archive.record.dispatchReady,false);
   assert.equal(archive.record.verification.schemaValid,true);assert.equal(archive.record.verification.expectedContentMatches,true);
   if(process.env.GKV_MONTHLY_XML_ENGINE==='libxml2-wasm')assert.equal(archive.record.verification.validationEngine,'libxml2-wasm/0.7.2');
   const request=certificateRequest('SignDocument',{mandantId:'synthetic',clientSystemId:'caresuite',workplaceId:'test'},
    {cardHandle:'software-fixture',jobNumber:'synthetic-job',requestId:randomUUID(),data:archive.xml});
   const doc=XmlDocument.fromBuffer(Buffer.from(peer(request)),{option:ParseOption.XML_PARSE_NO_XXE|ParseOption.XML_PARSE_NONET|ParseOption.XML_PARSE_NO_SYS_CATALOG});
   let cms;try{const values=doc.find('//d:Base64Signature',{d:'urn:oasis:names:tc:dss:1.0:core:schema'});assert.equal(values.length,1);
    cms=Buffer.from(values[0].content,'base64');}finally{doc.dispose();}
   const checked=verifyEccComponentSignedContent({bytes:cms,expectedSignerCertificate:cert});assert.deepEqual(checked.content,archive.xml);
   assert.equal(checked.identityStatus,'unverified');assert.deepEqual(await openssl(['cms','-verify','-inform','DER','-binary','-noverify'],{input:cms}),archive.xml);
   const corrupt=Buffer.from(cms),offset=corrupt.indexOf(archive.xml);assert.ok(offset>=0);corrupt[offset+2]^=1;
   assert.throws(()=>verifyEccComponentSignedContent({bytes:corrupt,expectedSignerCertificate:cert}),/CMS_SIGNATURE_REJECTED/);
   return {final,cms,xml:archive.xml};
  };
  const first=await x.monthly(v),old=await verify(first);
  const input={proofId:o.proofId,proofHash:o.payloadHash,revision:0,previousId:null,description:'Synthetische berichtigte Leistungsbeschreibung.',
    reason:'Fehler im unterschriebenen Freitext.'};
  await f.as(x.personal(),'SELECT public.gkv_assist_amend_description($1,$2,$3,$4::jsonb)',[f.tenant,v.assignment,randomUUID(),JSON.stringify(input)]);
  const archived=await x.worker.readArchivedOriginal({tenantId:f.tenant,proofId:old.final.id,captureId:first.input.captureId});
  assert.equal(archived.status,'invalidated');assert.deepEqual(archived.bytes,first.original.bytes);
  const p=(await f.db.query("SELECT to_jsonb(p) v FROM public.gkv_monthly_proofs p WHERE predecessor_id=$1 AND status='open'",[old.final.id])).rows[0].v;
  assert.equal(p.confirmation,null);assert.equal(p.payload.xmlFacts,undefined);
  const next={p,input:{tenantId:f.tenant,proofId:p.id,revision:p.revision,captureId:randomUUID()}},fresh=await verify(next);
  assert.notDeepEqual(fresh.cms,old.cms);assert.notDeepEqual(fresh.xml,old.xml);assert.notDeepEqual(next.original.bytes,first.original.bytes);
  assert.notEqual(fresh.final.confirmation.receiptId,old.final.confirmation.receiptId);
  assert.notEqual(fresh.final.confirmation.signatureSha256,old.final.confirmation.signatureSha256);
  assert.equal(fresh.final.payload.records[0].amendment.description,input.description);
 }finally{try{await pki?.close();}finally{await x.close();}}
});
