import { cardsResponse, eventUrl, cardsReply } from './connector-card-fixture.mjs';
import { cardUrl, pinResponse, isPinStatus } from './connector-pin-fixture.mjs';
import { cmsUrls, cmsOperation } from './connector-cms-fixture.mjs';
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createPrivateKey } from 'node:crypto';
import { testPki } from './pki-fixture.mjs';
import { certificateRequest, inspectConnectorXml } from '../../services/kim/connector-xml.mjs';
import { prepareEccKimRecipients, sealEccKimPayload } from '../../services/kim/ecc-cms.mjs';
import { cmsResponse, makeCmsReply } from './connector-cms-fixture.mjs';
import { faultResponse, connectorFixture, verificationResponse, raw } from './connector-fixture.mjs';
const ctx = { mandantId: 'm', clientSystemId: 'CareSuite', workplaceId: 'w' };
let pki, signer, enc, input, reply, signingKey, sealed;
before(async () => {
  pki = await testPki(); signer = await pki.issueKim({ name: 'cms-sig', role: 'osig' }); enc = await pki.issueKim({ name: 'cms-enc' });
  const sender = 'cms@local.kim.telematik-test', recipients = [{ address: sender, certificate: enc.certificate }];
  const p = prepareEccKimRecipients(sender, recipients, Date.now());
  input = { cardHandle: 'SMCB-1', jobNumber: 'ABC-123', requestId: 'request-1', data: Buffer.from('synthetic'), recipientEmails: p.emails, certificates: p.entries.map(e => e.cert.raw) };
  signingKey = createPrivateKey({ key: await readFile(signer.privateKeyPath), passphrase: pki.password });
  sealed = sealEccKimPayload({ message: Buffer.from('synthetic message'), sender, recipients, signingCertificate: signer.certificate, signingKey });
  reply = makeCmsReply({ signingCertificate: signer.certificate, signingKey, encryptionKey: createPrivateKey({ key: await readFile(enc.privateKeyPath), passphrase: pki.password }) });
});
after(async () => pki?.close());
const inspect = (xml, operation, mode = 'response') => inspectConnectorXml(Buffer.from(xml), { operation, mode });
for (const op of ['GetJobNumber','SignDocument','EncryptDocument','DecryptDocument']) {
  test('CMS SOAP: official schema accepts the bounded ' + op + ' request', async () => {
    const r = await inspectConnectorXml(certificateRequest(op, ctx, input), { operation: op, mode: 'request' });
    assert.equal(r.operation, op);
  });
}
test('CMS SOAP: signed request and binary response preserve correlation', async () => {
  const xml = certificateRequest('SignDocument', ctx, input), response = await inspect(reply(xml), 'SignDocument');
  assert.equal(response.requestId, input.requestId); assert.ok(Buffer.from(response.data, 'base64').length > 100);
});
for (const [label, change] of [
  ['second response', s => s.replace('</c:SignDocumentResponse>', s.match(/<c:SignResponse[\s\S]*<\/c:SignResponse>/)[0] + '</c:SignDocumentResponse>')],
  ['warning', s => s.replace('<n:Result>OK</n:Result>', '<n:Result>Warning</n:Result>')],
  ['signature type', s => s.replace('urn:ietf:rfc:5652', 'urn:ietf:rfc:5751')],
  ['optional extension', s => s.replace('<dss:SignatureObject>', '<c:OptionalOutputs/><dss:SignatureObject>')],
  ['invalid base64', s => s.replace(/(<dss:Base64Signature[^>]*>)[^<]+/, '$1@@@')],
  ['DTD', s => s.replace('?><s:Envelope', '?><!DOCTYPE x [<!ENTITY secret "secret">]><s:Envelope')],
  ['comment', s => s.replace('<n:Status>', '<!--hidden--><n:Status>')],
  ['foreign namespace', s => s.replaceAll('SignatureService/v7.5', 'SignatureService/v7.4')],
]) test('CMS SOAP: rejects ' + label, async () => {
  await assert.rejects(inspect(change(reply(certificateRequest('SignDocument', ctx, input))), 'SignDocument'), /KIM_CONNECTOR_/);
});
test('CMS SOAP: faults expose numeric codes only', async () => {
  const r = await inspect(faultResponse(), 'DecryptDocument'); assert.equal(r.kind, 'fault'); assert.deepEqual(r.remoteCodes, [4149]);
  assert.equal(JSON.stringify(r).includes('PRIVATE'), false);
});
test('CMS SOAP: rejects noncanonical job IDs and external document references', async () => {
  await assert.rejects(inspect(cmsResponse('GetJobNumber').replace('ABC-123', 'abc-123'), 'GetJobNumber'), /KIM_CONNECTOR_/);
  const xml = certificateRequest('DecryptDocument', ctx, input).toString().replace('<n:Document>', '<n:Document ID="remote">');
  await assert.rejects(inspect(xml, 'DecryptDocument', 'request'), /KIM_CONNECTOR_/);
});
test('CMS SOAP: full 15 MB content is supported without relaxing certificate-service bounds', async () => {
  const data = Buffer.alloc(15000000, 65), xml = certificateRequest('SignDocument', ctx, { ...input, data });
  assert.equal((await inspectConnectorXml(xml, { operation: 'SignDocument', mode: 'request' })).operation, 'SignDocument');
  assert.throws(() => inspectConnectorXml(xml, { operation: 'VerifyCertificate', mode: 'request' }), /KIM_CONNECTOR_INPUT/);
  await assert.rejects(inspectConnectorXml(certificateRequest('SignDocument', ctx, { ...input, data: Buffer.alloc(15000001, 65) }), { operation: 'SignDocument', mode: 'request' }), /KIM_CONNECTOR_/);
});

async function clientFixture(run, handler) {
  const f = await connectorFixture(pki, event => handler?.(event) ?? cardsReply(event.response,
    cmsOperation(event.bytes) ? reply(event.bytes) : event.bytes.includes('<c:GetCards') ? cardsResponse() : isPinStatus(event.bytes) ? pinResponse() : verificationResponse()));
  try { await run({ client: f.open({ eventServiceUrl: eventUrl(f.options), cardServiceUrl: cardUrl(f.options), ...cmsUrls(f.options) }), requests: f.requests }); }
  finally { await f.close(); }
}
async function keyInput(client, signing = false) {
  const selection = client.selectSmcb(await client.getCards({ cardType: 'SMC-B' })), status = await client.getSmcbPinStatus({ selection });
  const certificate = raw(signing ? signer.certificate : enc.certificate), verification = await client.verifyCertificate({ certificate });
  return signing ? { status, certificate, verification, data: Buffer.from('synthetic'), sender: 'cms@local.kim.telematik-test', recipients: [{ address: 'cms@local.kim.telematik-test', certificate: enc.certificate }] }
    : { status, certificate, verification, data: sealed, address: 'cms@local.kim.telematik-test', expectedSignerCertificate: raw(signer.certificate) };
}
test('CMS card operations: valid decrypt validates inner signature and consumes the original PIN evidence', async () => clientFixture(async ({ client, requests }) => {
  const input = await keyInput(client), r = await client.decryptSmcbDocument(input);
  assert.equal(r.profile, 'ecc-cms-diagnostic'); assert.equal(r.deliveryStatus, 'held-for-trust-validation');
  await assert.rejects(client.decryptSmcbDocument(input), /KIM_CONNECTOR_PIN_STATUS_STALE/);
  assert.equal(requests.filter(q => cmsOperation(q.bytes) === 'DecryptDocument').length, 1);
}));
for (const [label, change, code] of [
  ['wrong fetch address', a => ({ ...a, address: 'other@local.kim.telematik-test' }), 'CMS_INPUT'],
  ['copied PIN evidence', a => ({ ...a, status: { ...a.status } }), 'EVIDENCE_BINDING'],
  ['copied certificate evidence', a => ({ ...a, verification: { ...a.verification } }), 'EVIDENCE_BINDING'],
  ['OSIG key for decryption', a => ({ ...a, certificate: raw(signer.certificate) }), 'CMS_INPUT'],
  ['software key option', a => ({ ...a, privateKey: 'forbidden' }), 'INPUT'],
  ['unsigned plaintext', a => ({ ...a, data: Buffer.from('plain') }), 'CMS_INPUT'],
]) test('CMS card operations: ' + label + ' fails before card use', async () => clientFixture(async ({ client, requests }) => {
  await assert.rejects(client.decryptSmcbDocument(change(await keyInput(client))), new RegExp('KIM_CONNECTOR_' + code));
  assert.equal(requests.some(q => cmsOperation(q.bytes)), false);
}));
test('CMS card operations: caller data mutation cannot change the signed bytes', async () => clientFixture(async ({ client }) => {
  const input = await keyInput(client, true), original = Buffer.from(input.data), promise = client.signSmcbDocument(input); input.data.fill(0);
  const r = await promise; assert.equal(r.dataSha256, (await import('node:crypto')).createHash('sha256').update(original).digest('hex'));
}));
test('CMS card operations: aborted input never reaches a document service', async () => clientFixture(async ({ client, requests }) => {
  const a = await keyInput(client), c = new AbortController(); c.abort();
  await assert.rejects(client.decryptSmcbDocument({ ...a, signal: c.signal }), /KIM_CONNECTOR_ABORTED/);
  assert.equal(requests.some(q => cmsOperation(q.bytes)), false);
}));
