import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture, invoiceId, batchId } from './fixtures.mjs';
import { buildClassicPayload, buildTestInterchange, decodeLatin1 } from '../../src/lib/gkvExchange/edifact.ts';
import { prepareClassicDelivery, prepareKimDelivery, buildKimMessage, dispatchOnce as dispatch, verifyPreparedDelivery, sha256 } from '../../api/_lib/gkv-transport.ts';

const now=new Date('2026-10-19T10:15:30Z');
const dispatchOnce=(...args)=>dispatch(...args,now);
function linked(){const d=fixture();d.mode='production';d.cases[0].sourceInvoiceId=invoiceId;return d;}
function evidence(hash){return {payloadSha256:hash,validatedSha256:hash,routingVerified:true,recipientRegistered:true,transportConfigured:true,certificateValidUntil:'2026-12-31',virusScanSha256:hash,e2eAccepted:true,sourceRevisionsCurrent:true,kimSignaturesVerified:true,kimSchemaValidated:true,softwareApproval:{prodModId:'123456789012',from:'2026-01-01',until:'2026-12-31'},proofCreationDates:['2026-10-18']};}
/** Crypto and XSD are explicitly injected test doubles. These tests do not establish an actual TI/ITSG signature. */
function security(overrides={}){return {encryptAndSign:async bytes=>Buffer.concat([Buffer.from('cipher-fixture:'),Buffer.from(bytes)]),verify:async(bytes,expected)=>({valid:true,format:'PKCS#7',ciphertextSha256:sha256(bytes),...expected,...overrides})};}
async function classic(){const d=linked();return prepareClassicDelivery(d,evidence(sha256(buildClassicPayload(d).bytes)),security(),now);}
test('classic release binds actual ciphertext size, AUF flags and unchanged source content',async()=>{
  const d=linked(),plain=buildClassicPayload(d);assert.equal(plain.name,'EPFL0001');assert.throws(()=>buildTestInterchange(d));
  const delivery=await classic(),order=decodeLatin1(delivery.files[1].bytes);
  assert.equal(order.length,348);assert.equal(order.slice(19,27),'EPFL0001');
  assert.equal(Number(order.slice(178,190)),plain.bytes.length);assert.equal(Number(order.slice(190,202)),delivery.files[0].bytes.length);
  assert.equal(order.slice(202,210),'I1000202');assert.equal(delivery.payloadSha256,sha256(plain.bytes));verifyPreparedDelivery(delivery);
});
test('wrong crypto identity, failed signature, changed container or plaintext fail before packaging',async()=>{
  for(const overrides of [{valid:false},{format:'PEM'},{receiverIk:'108888888'},{senderIk:'199999999'},{plaintextSha256:'f'.repeat(64)},{ciphertextSha256:'f'.repeat(64)}]){
    const d=linked();await assert.rejects(prepareClassicDelivery(d,evidence(sha256(buildClassicPayload(d).bytes)),security(overrides),now));
  }
  const d=linked();await assert.rejects(prepareClassicDelivery(d,evidence(sha256(buildClassicPayload(d).bytes)),{...security(),encryptAndSign:async b=>b},now));
});
test('stale dates, absent registration, source conflicts and manual cases prevent crypto calls',async()=>{
  for(const change of [(d,e)=>e.recipientRegistered=false,(d,e)=>e.sourceRevisionsCurrent=false,(d,e)=>e.virusScanSha256='f'.repeat(64),(d)=>delete d.cases[0].sourceInvoiceId,(d)=>d.createdAt='2026-10-18T12:00:00Z']){
    const d=linked(),e=evidence(sha256(buildClassicPayload(d).bytes));change(d,e);let calls=0;
    await assert.rejects(prepareClassicDelivery(d,e,{...security(),encryptAndSign:async()=>{calls++;return new Uint8Array();}},now));assert.equal(calls,0);
  }
});
function kimData(){const d=linked();d.channel='kim';d.serviceType='01';d.profile.billingCode='36';d.profile.ambulatoryProvider=true;Object.assign(d.cases[0].lines[0],{remuneration:'99',code:'99'});return d;}
const xml=Buffer.from('<?xml version="1.0" encoding="UTF-8"?><fixture/>');
const verifier=(overrides={})=>({verify:async bytes=>({valid:true,sha256:sha256(bytes),allComponentSignaturesValid:true,schemaValid:true,relationsValid:true,...overrides})});
async function kim(){return prepareKimDelivery(kimData(),xml,evidence(sha256(xml)),verifier(),now);}
test('KIM MIME preserves exact XML bytes, one attachment, logical version and DSN envelope request',async()=>{
  const delivery=await kim();assert.equal(delivery.files[0].name,'EPFL0_ABR_123456789_01_102026_01.xml');
  const message=buildKimMessage(delivery,{from:'sender@kim.test',to:'receiver@kim.test',messageId:'<job-1@kim.test>',serviceType:'01',date:now});
  const mime=Buffer.from(message.mime).toString();assert.ok(mime.includes('Subject: EPFL0_ABR_123456789_01_102026_01\r\n'));
  assert.ok(mime.includes('X-KIM-Dienstkennung: PFL;ABR-01;1.2.0\r\n'));assert.equal(mime.match(/Content-Disposition: attachment/g).length,1);
  assert.ok(mime.includes('Content-Description: PFL\r\n\r\n'+xml.toString('base64')));
  assert.deepEqual(message.dsn,{notify:['SUCCESS','FAILURE','DELAY'],return:'HDRS'});
});
test('KIM requires real verifier success for every component, schema and relation; rejects wrong hash',async()=>{
  for(const failure of [{valid:false},{allComponentSignaturesValid:false},{schemaValid:false},{relationsValid:false},{sha256:'f'.repeat(64)}])await assert.rejects(prepareKimDelivery(kimData(),xml,evidence(sha256(xml)),verifier(failure),now));
});
test('KIM rejects wrong service/profile, oversized input, BOM and invalid UTF-8',async()=>{
  const d=kimData();d.serviceType='09';await assert.rejects(prepareKimDelivery(d,xml,evidence(sha256(xml)),verifier(),now));
  for(const bytes of [Buffer.alloc(15_000_001),Buffer.from([0xef,0xbb,0xbf,60,47,62]),Buffer.from([0xc0,0xaf])])await assert.rejects(prepareKimDelivery(kimData(),bytes,evidence(sha256(bytes)),verifier(),now));
});
test('header injection and changes after preparation cannot reach message generation or dispatch',async()=>{
  const delivery=await kim();const input={from:'sender@kim.test',to:'receiver@kim.test',messageId:'<job-1@kim.test>',serviceType:'01',date:now};
  for(const change of [{to:'receiver@kim.test\r\nBcc: other@kim.test'},{messageId:'x\r\nBcc: x@y.test'},{serviceType:'07'}])assert.throws(()=>buildKimMessage(delivery,{...input,...change}));
  delivery.files[0].bytes[0]++;assert.throws(()=>verifyPreparedDelivery(delivery));
  let claims=0;await assert.rejects(dispatchOnce(batchId,delivery,{claim:async()=>{claims++;return true;},finish:async()=>{}},{send:async()=>({reference:'1'})}));assert.equal(claims,0);
});
function journal(){const claimed=new Set(),states=[];return {states,claim:async id=>{if(claimed.has(id))return false;claimed.add(id);return true;},finish:async(id,status,ref)=>states.push({id,status,ref})};}
test('concurrent dispatch claims once, keeps stable idempotency key and records only transmission',async()=>{
  const d=await classic(),j=journal();let sends=0;const p={send:async(_,ctx)=>{sends++;assert.equal(ctx.idempotencyKey,batchId);return {reference:'provider-job-1'};}};
  const results=await Promise.all([dispatchOnce(batchId,d,j,p),dispatchOnce(batchId,d,j,p)]);assert.equal(sends,1);assert.deepEqual(results.sort(),['already_claimed','sent']);assert.equal(j.states[0].status,'sent');
});
test('unknown outcome, empty acknowledgement and finish failure never lead to blind resend',async()=>{
  for(const send of [async()=>{throw new Error('Provider timeout, outcome unknown');},async()=>({reference:''})]){
    const d=await classic(),j=journal();let calls=0;const p={send:async(...a)=>{calls++;return send(...a);}};
    assert.equal(await dispatchOnce(batchId,d,j,p),'delivery_unknown');assert.equal(await dispatchOnce(batchId,d,j,p),'already_claimed');assert.equal(calls,1);
  }
  const d=await classic(),j=journal();j.finish=async()=>{throw new Error('Database unavailable');};let calls=0;const p={send:async()=>{calls++;return {reference:'sent'};}};
  await assert.rejects(dispatchOnce(batchId,d,j,p));assert.equal(await dispatchOnce(batchId,d,j,p),'already_claimed');assert.equal(calls,1);
});
test('an unconfigured provider never claims a job or changes its state',async()=>{
  const d=await classic(),j=journal();await assert.rejects(dispatchOnce(batchId,d,j,undefined),/Versandadapter/);assert.equal(j.states.length,0);assert.equal(await j.claim(batchId),true);
});

test('stale prepared data and altered recipient bindings cannot claim a send',async()=>{
  const d=await classic(),j=journal();let sends=0;const p={send:async()=>{sends++;return {reference:'1'};}};
  for(const date of ['2026-10-20T08:00:00Z','2027-02-01T08:00:00Z'])await assert.rejects(dispatch(batchId,d,j,p,new Date(date)),/aktuelle/);
  for(const change of [{receiverIk:'108888888'},{channel:'other'},{payloadSha256:'f'.repeat(64)},{preparedDay:'2026-10-20'},{serviceType:'08'}])await assert.rejects(dispatchOnce(batchId,{...d,...change},j,p));
  assert.equal(sends,0);assert.equal(await j.claim(batchId),true);
});
