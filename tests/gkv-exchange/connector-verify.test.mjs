import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createPrivateKey } from 'node:crypto';
import { testPki } from './pki-fixture.mjs';
import { certificateRequest, inspectConnectorXml } from '../../services/kim/connector-xml.mjs';
import { prepareEccKimRecipients } from '../../services/kim/ecc-cms.mjs';
import { makeCmsReply, cmsVerificationReply, cmsUrls, cmsOperation } from './connector-cms-fixture.mjs';
import { connectorFixture, verificationResponse, raw, hash } from './connector-fixture.mjs';
import { cardsReply } from './connector-card-fixture.mjs';
import { takeConnectorDocumentFailure } from '../../services/kim/connector-certificates.mjs';
const context = { mandantId: 'm', clientSystemId: 'CareSuite', workplaceId: 'w' };
let pki, signer, enc, signed, emails;
before(async () => {
  pki = await testPki(); signer = await pki.issueKim({ name: 'verify-osig', role: 'osig' }); enc = await pki.issueKim({ name: 'verify-enc' });
  const address = 'verify@local.kim.telematik-test';
  emails = prepareEccKimRecipients(address, [{ address, certificate: enc.certificate }], Date.now()).emails;
  const reply = makeCmsReply({ signingCertificate: signer.certificate, signingKey: createPrivateKey({ key: await readFile(signer.privateKeyPath), passphrase: pki.password }) });
  const xml = reply(certificateRequest('SignDocument', context, { data: Buffer.from('synthetic challenge'), cardHandle: 'SMCB-1', jobNumber: 'ABC-123', requestId: 'synthetic', recipientEmails: emails }));
  signed = Buffer.from((await inspectConnectorXml(Buffer.from(xml), { operation: 'SignDocument', mode: 'response' })).data, 'base64');
});
after(async () => pki?.close());
const request = () => certificateRequest('VerifyDocument', context, { data: signed });
const inspect = (xml, mode = 'response') => inspectConnectorXml(Buffer.from(xml), { operation: 'VerifyDocument', mode });
test('VerifyDocument: pinned schema accepts enveloping CMS SignatureObject and current-time comprehensive report request', async () => {
  assert.equal((await inspect(request(), 'request')).operation, 'VerifyDocument');
  assert.equal(request().includes('<c:Document>'), false); assert.equal(request().includes('CardHandle'), false);
});
test('VerifyDocument: report hash, leaf and signature binding are returned without remote subject or prose', async () => {
  const xml = cmsVerificationReply(request()).replace('</dss:Result>', '<dss:ResultMessage xml:lang="de">PRIVATE REMOTE TEXT</dss:ResultMessage></dss:Result>');
  const result = await inspect(xml); assert.equal(result.resultConsistent, true); assert.equal(result.certificateSha256[0], hash(raw(signer.certificate)));
  assert.match(result.reportSha256, /^[a-f0-9]{64}$/); assert.equal(JSON.stringify(result).includes('PRIVATE'), false);
});
for (const [label, change] of [
  ['missing report', x => x.replace(/<c:OptionalOutputs>[\s\S]*<\/c:OptionalOutputs>/, '')],
  ['duplicate signer', x => x.replace('</vr:VerificationReport>', x.match(/<vr:IndividualReport>[\s\S]*<\/vr:IndividualReport>/)[0] + '</vr:VerificationReport>')],
  ['foreign extension', x => x.replace('</vr:Details>', '<evil:Info xmlns:evil="urn:unknown"/></vr:Details>')],
  ['unsupported report identity', x => x.replace('<vr:SignedObjectIdentifier>', '<vr:SignedObjectIdentifier XPath="//anything">')],
  ['missing signature binding', x => x.replace(/<ds:SignatureValue>[\s\S]*?<\/ds:SignatureValue>/, '')],
  ['missing certificate value', x => x.replace(/<vr:CertificateValue>[\s\S]*?<\/vr:CertificateValue>/, '')],
  ['warning execution', x => x.replace('<n:Result>OK</n:Result>', '<n:Result>Warning</n:Result>')],
  ['timezone absent', x => x.replace(/\.\d{3}Z/g, '')],
  ['oversized report', x => x.replace('PRIVATE SUBJECT', 'x'.repeat(270000))],
  ['external entity', x => x.replace('<s:Envelope', '<!DOCTYPE x [<!ENTITY x SYSTEM "file:///etc/passwd">]><s:Envelope')],
]) test('VerifyDocument: rejects ' + label, async () => {
  await assert.rejects(inspect(change(cmsVerificationReply(request()))), /KIM_CONNECTOR_/);
});
for (const [label, change] of [
  ['historic time', x => x.replace('<dss:CurrentTime/>', '<dss:SpecificTime>2020-01-01T00:00:00Z</dss:SpecificTime>')],
  ['signature mutation', x => x.replace('<c:IncludeRevocationInfo>false', '<c:IncludeRevocationInfo>true')],
  ['short report', x => x.replace('<vr:IncludeCertificateValues>true', '<vr:IncludeCertificateValues>false')],
]) test('VerifyDocument: refuses request ' + label, async () => {
  await assert.rejects(inspect(change(request().toString()), 'request'), /KIM_CONNECTOR_/);
});
async function client(run, mutate = x => x, options = {}) {
  const f = await connectorFixture(pki, event => cardsReply(event.response, cmsOperation(event.bytes) === 'VerifyDocument'
    ? mutate(cmsVerificationReply(event.bytes), event.bytes) : verificationResponse()));
  try {
    const c = f.open({ ...cmsUrls(f.options), ...options }), certificate = raw(signer.certificate);
    await run(c, { certificate, verification: await c.verifyCertificate({ certificate }), data: Buffer.from(signed), recipientEmails: Buffer.from(emails) }, f.requests);
  } finally { await f.close(); }
}
test('VerifyDocument: actual pinned mTLS uses signature route and returns held confirmation without PIN operation', async () => client(async (c, input, requests) => {
  const result = await c.verifySmcbDocument(input); assert.equal(result.verificationResult, 'VALID');
  assert.equal(result.deliveryStatus, 'held-for-trust-validation'); assert.equal(result.dataSha256, hash(signed));
  assert.equal(requests.length, 2); assert.match(requests[1].headers.soapaction, /SignatureService\/v7.5#VerifyDocument/);
}));
for (const [label, change, expected] of [
  ['invalid aggregate', x => x.replace('<c:HighLevelResult>VALID', '<c:HighLevelResult>INVALID'), 'INVALID'],
  ['inconclusive aggregate', x => x.replace('<c:HighLevelResult>VALID', '<c:HighLevelResult>INCONCLUSIVE'), 'INCONCLUSIVE'],
  ['false detail', x => x.replace('detail:valid', 'detail:invalid'), 'INCONSISTENT'],
  ['unknown certificate status', x => x.replace('<vr:CertStatusOK><vr:ResultMajor>urn:oasis:names:tc:dss:1.0:detail:valid', '<vr:CertStatusOK><vr:ResultMajor>urn:oasis:names:tc:dss:1.0:detail:indetermined'), 'INCONSISTENT'],
  ['conflicting individual result', x => x.replace('valid:signature:OnAllDocuments', 'invalid:IncorrectSignature'), 'INCONSISTENT'],
  ['foreign signature', (x, bytes) => cmsVerificationReply(bytes, { signature: Buffer.alloc(70, 1) }), 'BINDING'],
  ['foreign certificate', (x, bytes) => cmsVerificationReply(bytes, { certificate: raw(enc.certificate) }), 'BINDING'],
  ['stale verification', (x, bytes) => cmsVerificationReply(bytes, { now: Date.now() - 60000 }), 'TIME'],
  ['future verification', (x, bytes) => cmsVerificationReply(bytes, { now: Date.now() + 60000 }), 'TIME'],
  ['embedded time', (x, bytes) => cmsVerificationReply(bytes, { timestampType: 'SIGNATURE_EMBEDDED_TIMESTAMP' }), 'TIME'],
]) test('VerifyDocument: ' + label + ' cannot confirm the probe', async () => client(async (c, input, requests) => {
  await assert.rejects(c.verifySmcbDocument(input), new RegExp('KIM_CONNECTOR_CMS_VERIFY_' + expected));
  assert.equal(requests.filter(q => cmsOperation(q.bytes) === 'VerifyDocument').length, 1);
}, change));
test('VerifyDocument: copied evidence, invalid CMS and abort fail before SOAP', async () => client(async (c, input, requests) => {
  await assert.rejects(c.verifySmcbDocument({ ...input, verification: { ...input.verification } }), /EVIDENCE_BINDING/);
  await assert.rejects(c.verifySmcbDocument({ ...input, data: Buffer.from('not CMS') }), /CMS_VERIFY_INPUT/);
  await assert.rejects(c.verifySmcbDocument({ ...input, signal: AbortSignal.abort() }), /ABORTED/);
  assert.equal(requests.length, 1);
}));
test('VerifyDocument: snapshots mutable input and serializes concurrent document operations', async () => client(async (c, input) => {
  const promise = c.verifySmcbDocument(input); input.data.fill(0); input.recipientEmails.fill(0);
  await assert.rejects(c.verifySmcbDocument(input), /CMS_BUSY/);
  assert.equal((await promise).dataSha256, hash(signed));
}));

for (const result of ['INVALID', 'INCONCLUSIVE']) test('VerifyDocument: ' + result + ' original report is a one-shot client/CMS-bound attachment', async () => client(async (c, input) => {
  let failure;
  try { await c.verifySmcbDocument(input); } catch (e) { failure = e; }
  assert.match(failure?.code, new RegExp(result + '$'));
  assert.equal(takeConnectorDocumentFailure({ ...failure }, c, hash(signed)), undefined);
  assert.equal(takeConnectorDocumentFailure(failure, {}, hash(signed)), undefined);
  assert.equal(takeConnectorDocumentFailure(failure, c, '0'.repeat(64)), undefined);
  assert.equal(JSON.stringify(failure).includes('PRIVATE'), false);
  assert.equal(Object.keys(failure).includes('report'), false);
  const report = takeConnectorDocumentFailure(failure, c, hash(signed));
  assert.equal(hash(report.bytes), report.metadata.reportSha256);
  assert.equal(report.metadata.dataSha256, hash(signed)); assert.equal(report.metadata.verificationResult, result);
  assert.match(report.bytes.toString(), /VerificationReport/);
  assert.equal(report.bytes.includes('Envelope'), false);
  assert.equal(takeConnectorDocumentFailure(failure, c, hash(signed)), undefined);
  report.bytes.fill(0);
}, xml => xml.replace('<c:HighLevelResult>VALID', '<c:HighLevelResult>' + result)));
for (const [label, change] of [
  ['wrong signature', (xml, bytes) => cmsVerificationReply(bytes, { signature: Buffer.alloc(70, 1) })],
  ['wrong leaf', (xml, bytes) => cmsVerificationReply(bytes, { certificate: raw(enc.certificate) })],
  ['stale time', (xml, bytes) => cmsVerificationReply(bytes, { now: Date.now() - 60000 })],
  ['foreign XML', xml => xml.replace('</vr:Details>', '<bad:Data xmlns:bad="urn:foreign"/></vr:Details>')],
]) test('VerifyDocument: negative ' + label + ' never exposes an original-report attachment', async () => client(async (c, input) => {
  let failure; try { await c.verifySmcbDocument(input); } catch (e) { failure = e; }
  assert.ok(failure); assert.equal(takeConnectorDocumentFailure(failure, c, hash(signed)), undefined);
}, (xml, bytes) => change(xml, bytes).replace('<c:HighLevelResult>VALID', '<c:HighLevelResult>INVALID')));
