import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createHash, createPrivateKey, sign, verify } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { testPki } from './pki-fixture.mjs';
import { KonnektorHttpsTransport } from '../../services/kim/connector-http.mjs';
import { AUTH_SERVICE, ECDSA_TYPE, certificateRequest, inspectConnectorXml } from '../../services/kim/connector-xml.mjs';
import { verifySmcbAuthenticationSignature } from '../../services/kim/connector-auth-signature.mjs';
import { assertSmcbPinVerified } from '../../services/kim/connector-certificates.mjs';
import { connectorFixture, verificationResponse, faultResponse, raw } from './connector-fixture.mjs';
import { cardsResponse, eventUrl, cardsReply } from './connector-card-fixture.mjs';
import { cardUrl, pinResponse, isPinStatus } from './connector-pin-fixture.mjs';
import { authUrl, isAuthenticate, authResponse, signAuthRequest } from './connector-auth-fixture.mjs';
import { X509Certificate } from 'node:crypto';

let pki, aut, other, hba, nist, key;
before(async () => {
  pki = await testPki(); aut = await pki.issueAut(); other = await pki.issueAut({ name: 'different-aut' });
  hba = await pki.issueAut({ name: 'hba-aut', policy: '1.2.276.0.76.4.75' });
  nist = await pki.issueAut({ name: 'nist-aut', curve: 'prime256v1' });
  key = createPrivateKey({ key: await readFile(aut.privateKeyPath), passphrase: pki.password });
});
after(async () => { await pki?.close(); });
const code = name => e => e?.code === 'KIM_CONNECTOR_' + name;
const data = Buffer.from('bounded authentication signing input, not a document');
const reply = async event => cardsReply(event.response, isAuthenticate(event.bytes) ? authResponse(await signAuthRequest(event.bytes, aut, pki))
  : event.bytes.includes('<c:GetCards') ? cardsResponse() : isPinStatus(event.bytes) ? pinResponse() : verificationResponse());
async function fixture(run, handler = reply) {
  const f = await connectorFixture(pki, handler);
  try { await run({ ...f, open: changes => f.open({ eventServiceUrl: eventUrl(f.options), cardServiceUrl: cardUrl(f.options), authSignatureServiceUrl: authUrl(f.options), ...changes }) }); }
  finally { await f.close(); }
}
async function ready(client, signal) {
  const selection = client.selectSmcb(await client.getCards({ cardType: 'SMC-B' }));
  const status = await client.getSmcbPinStatus({ selection, signal });
  const certificate = raw(aut.certificate), verification = await client.verifyCertificate({ certificate });
  return { status, certificate, verification, data };
}

test('SMC-B authentication: actual mTLS sends exactly one SHA-256 and verifies a prehashed card signature', async () => fixture(async ({ open, requests }) => {
  const client = open(), input = await ready(client), result = await client.externalAuthenticateSmcb(input);
  assert.equal(result.signatureType, ECDSA_TYPE); assert.equal(result.identityStatus, 'unverified');
  assert.equal(result.deliveryStatus, 'held-for-trust-validation');
  assert.equal(result.dataSha256, createHash('sha256').update(data).digest('hex'));
  const q = requests.at(-1); assert.equal(q.authorized, true); assert.equal(q.url, '/AuthSignatureService');
  assert.equal(q.headers.soapaction, `"${AUTH_SERVICE}#ExternalAuthenticate"`);
  assert.match(q.bytes.toString(), /<n:CardHandle>SMCB-1<\/n:CardHandle><ctx:Context>/);
  assert.match(q.bytes.toString(), /<n:MandantId>tenant-1<\/n:MandantId>/);
  assert.equal(q.bytes.includes(data), false);
  assert.equal(Buffer.from(result.signatureJose, 'base64url').length, 64);
  assert.equal(verify('sha256', data, { key: new X509Certificate(aut.certificate).publicKey, dsaEncoding: 'ieee-p1363' }, Buffer.from(result.signatureJose, 'base64url')), true);
  assert.throws(() => assertSmcbPinVerified(input.status, client, input.status.selection), code('PIN_STATUS_STALE'));
  await assert.rejects(client.externalAuthenticateSmcb(input), code('PIN_STATUS_STALE'));
  assert.equal(requests.filter(q => isAuthenticate(q.bytes)).length, 1);
}));

test('SMC-B authentication: copied proofs and foreign clients never invoke the key', async () => fixture(async ({ open, requests }) => {
  const client = open(), otherClient = open(), input = await ready(client);
  for (const invalid of [{ ...input, status: { ...input.status } }, { ...input, verification: { ...input.verification } }, { ...input, certificate: raw(other.certificate) }]) {
    await assert.rejects(client.externalAuthenticateSmcb(invalid), code('EVIDENCE_BINDING'));
  }
  await assert.rejects(otherClient.externalAuthenticateSmcb(input), code('EVIDENCE_BINDING'));
  assert.equal(requests.filter(q => isAuthenticate(q.bytes)).length, 0);
}));

test('SMC-B authentication: a valid Konnektor certificate report does not permit HBA or a different curve', async () => fixture(async ({ open, requests }) => {
  const client = open(), input = await ready(client);
  for (const identity of [hba, nist]) {
    const certificate = raw(identity.certificate), verification = await client.verifyCertificate({ certificate });
    await assert.rejects(client.externalAuthenticateSmcb({ ...input, certificate, verification }), code('AUTH_CERTIFICATE'));
  }
  assert.equal(requests.filter(q => isAuthenticate(q.bytes)).length, 0);
}));

for (const [value, tries] of [['VERIFIABLE', 3], ['BLOCKED', 0], ['TRANSPORT_PIN', null], ['EMPTY_PIN', null]]) {
  test('SMC-B authentication: ' + value + ' never starts an implicit PIN prompt', async () => fixture(async ({ open, requests }) => {
    const client = open(), input = await ready(client);
    await assert.rejects(client.externalAuthenticateSmcb(input), code('PIN_NOT_VERIFIED'));
    assert.equal(requests.filter(q => isAuthenticate(q.bytes)).length, 0);
  }, event => isPinStatus(event.bytes) ? cardsReply(event.response, pinResponse('GetPinStatus', value, tries)) : reply(event)));
}

test('SMC-B authentication: strict input and missing/different-origin routes fail before use', async () => fixture(async ({ open, requests, options }) => {
  const client = open(), input = await ready(client);
  for (const change of [{ data: Buffer.alloc(0) }, { data: Buffer.alloc(16385) }, { data: 'text' }, { digest: Buffer.alloc(32) }, { pin: 'secret' }, { privateKey: key }]) {
    await assert.rejects(client.externalAuthenticateSmcb({ ...input, ...change }), code('INPUT'));
  }
  assert.throws(() => open({ authSignatureServiceUrl: 'https://different.invalid/auth' }), code('CONFIGURATION'));
  const absent = open({ authSignatureServiceUrl: undefined });
  await assert.rejects(absent.externalAuthenticateSmcb(await ready(absent)), code('AUTH_UNCONFIGURED'));
  const transport = new KonnektorHttpsTransport({ ...options, service: 'certificate' });
  try { await assert.rejects(transport.request('ExternalAuthenticate', Buffer.from('x')), code('INPUT')); } finally { transport.close(); }
  assert.equal(requests.filter(q => isAuthenticate(q.bytes)).length, 0);
}));

for (const failure of ['other-key', 'wrong-data', 'double-hash', 'rsa-type', 'warning', 'fault', 'invalid-der']) {
  test('SMC-B authentication: ' + failure + ' returns no signature and latches the outcome without retry', async () => fixture(async ({ open, requests }) => {
    const client = open(), input = await ready(client);
    await assert.rejects(client.externalAuthenticateSmcb(input), e => /^KIM_CONNECTOR_(?:AUTH_|SOAP_|XML_)/.test(e?.code));
    await assert.rejects(client.externalAuthenticateSmcb(input), code('AUTH_OUTCOME_UNKNOWN'));
    await assert.rejects(client.getSmcbPinStatus({ selection: input.status.selection }), code('AUTH_OUTCOME_UNKNOWN'));
    assert.equal(requests.filter(q => isAuthenticate(q.bytes)).length, 1);
  }, async event => {
    if (!isAuthenticate(event.bytes)) return reply(event);
    if (failure === 'fault') return cardsReply(event.response, faultResponse());
    const signature = failure === 'other-key' ? await signAuthRequest(event.bytes, other, pki)
      : failure === 'wrong-data' ? sign('sha256', Buffer.from('wrong'), key)
      : failure === 'double-hash' ? sign('sha256', createHash('sha256').update(data).digest(), key)
      : failure === 'invalid-der' ? Buffer.from('3006020100020101', 'hex') : await signAuthRequest(event.bytes, aut, pki);
    cardsReply(event.response, authResponse(signature, { ...(failure === 'rsa-type' ? { type: 'urn:ietf:rfc:3447' } : {}), ...(failure === 'warning' ? { execution: 'Warning' } : {}) }));
  }));
}

for (const action of ['abort', 'prior-abort', 'close', 'timeout']) {
  test('SMC-B authentication: ' + action + ' stops a pending key request without reuse', async () => {
    const entered = Promise.withResolvers(), controller = new AbortController();
    await fixture(async ({ open, requests }) => {
      const client = open(action === 'timeout' ? { timeoutMs: 1200 } : {});
      const input = await ready(client, action === 'prior-abort' ? controller.signal : undefined);
      const attempt = client.externalAuthenticateSmcb({ ...input, ...(action === 'abort' ? { signal: controller.signal } : {}) });
      const rejected = assert.rejects(attempt, code(action === 'close' ? 'CLOSED' : action === 'timeout' ? 'TIMEOUT' : 'ABORTED'));
      await entered.promise;
      if (action.includes('abort')) controller.abort(); if (action === 'close') client.close();
      await rejected;
      await assert.rejects(client.externalAuthenticateSmcb(input), code(action === 'close' ? 'CLOSED' : 'AUTH_OUTCOME_UNKNOWN'));
      assert.equal(requests.filter(q => isAuthenticate(q.bytes)).length, 1);
    }, event => isAuthenticate(event.bytes) ? entered.resolve() : reply(event));
  });
}

test('SMC-B authentication: an in-flight operation blocks PIN work and card refresh discards its result', async () => {
  const entered = Promise.withResolvers();
  await fixture(async ({ open }) => {
    const client = open(), input = await ready(client), attempt = client.externalAuthenticateSmcb(input);
    const rejected = assert.rejects(attempt, code('CARD_SNAPSHOT_STALE'));
    const release = await entered.promise;
    await assert.rejects(client.externalAuthenticateSmcb(input), code('AUTH_BUSY'));
    await assert.rejects(client.changeSmcbPin({ status: input.status, mode: 'change' }), code('AUTH_BUSY'));
    await assert.rejects(client.getSmcbPinStatus({ selection: input.status.selection }), code('AUTH_BUSY'));
    await client.getCards(); await release(); await rejected;
  }, event => isAuthenticate(event.bytes) ? entered.resolve(() => reply(event)) : reply(event));
});

test('SMC-B authentication: data is copied before asynchronous XML and transport work', async () => fixture(async ({ open }) => {
  const client = open(), input = await ready(client), mutable = Buffer.from(data);
  const pending = client.externalAuthenticateSmcb({ ...input, data: mutable }); mutable.fill(0);
  assert.equal((await pending).dataSha256, createHash('sha256').update(data).digest('hex'));
}));

test('SMC-B authentication: expiration during request validation prevents sending any key request', async () => fixture(async ({ open, requests }) => {
  let now = Date.now(); const client = open({ clock: () => now }), input = await ready(client);
  const attempt = client.externalAuthenticateSmcb(input); now += 30000;
  await assert.rejects(attempt, code('EVIDENCE_EXPIRED'));
  assert.equal(requests.filter(q => isAuthenticate(q.bytes)).length, 0);
}));

for (const state of ['expired', 'rollback', 'refresh']) {
  test('SMC-B authentication: ' + state + ' preflight evidence cannot sign', async () => fixture(async ({ open, requests }) => {
    let now = Date.now(); const client = open({ clock: () => now }), input = await ready(client);
    if (state === 'expired') now += 30000; else if (state === 'rollback') now--; else await client.getCards();
    await assert.rejects(client.externalAuthenticateSmcb(input), code(state === 'refresh' ? 'CARD_SNAPSHOT_STALE' : 'EVIDENCE_EXPIRED'));
    assert.equal(requests.filter(q => isAuthenticate(q.bytes)).length, 0);
  }));
}

const invalidDer = ['3006020100020101', '3006020180020101', '300702020001020101', '300702010102020001',
  '308106020101020101', '300602010102010100', '3009020101020101020101', '3006020101020100',
  '3026022100a9fb57dba1eea9bc3e660a909d838d718c397aa3b561a6f7901e0e82974856a7020101'];
for (const [i, hex] of invalidDer.entries()) test('SMC-B authentication DER: malformed scalar/encoding ' + i, () => {
  assert.throws(() => verifySmcbAuthenticationSignature(Buffer.from(hex, 'hex'), data, new X509Certificate(aut.certificate)), code('AUTH_SIGNATURE'));
});

const responseMutations = {
  missing: s => s.replace(/<dss:SignatureObject>[\s\S]*?<\/dss:SignatureObject>/, ''),
  duplicate: s => s.replace('</dss:SignatureObject>', '<dss:Base64Signature Type="urn:bsi:tr:03111:ecdsa">AQ==</dss:Base64Signature></dss:SignatureObject>'),
  attributes: s => s.replace('<dss:SignatureObject>', '<dss:SignatureObject SchemaRefs="https://attacker.invalid">'),
  type: s => s.replace(' Type="urn:bsi:tr:03111:ecdsa"', ''),
  size: s => s.replace(/>[^<>]+<\/dss:Base64Signature>/, '>' + Buffer.alloc(73).toString('base64') + '</dss:Base64Signature>'),
  encoding: s => s.replace(/>[^<>]+<\/dss:Base64Signature>/, '>%%%%</dss:Base64Signature>'),
  namespace: s => s.replace(AUTH_SERVICE, 'http://invalid.test/signature'),
  dtd: s => s.replace('?><s:', '?><!DOCTYPE s:Envelope [<!ENTITY x SYSTEM "file:///etc/passwd">]><s:'),
};
for (const [name, mutate] of Object.entries(responseMutations)) test('SMC-B authentication XML: rejects ' + name, async () => {
  const response = authResponse(sign('sha256', data, key));
  await assert.rejects(inspectConnectorXml(Buffer.from(mutate(response)), { operation: 'ExternalAuthenticate', mode: 'response' }), e => /^KIM_CONNECTOR_XML_|^KIM_CONNECTOR_AUTH_/.test(e?.code));
});

const requestMutations = {
  digest: s => s.replace(/>[^<>]+<\/dss:Base64Data>/, '>AQ==</dss:Base64Data>'),
  mime: s => s.replace('application/octet-stream', 'text/plain'),
  type: s => s.replace(ECDSA_TYPE, 'urn:ietf:rfc:3447'),
  schemes: s => s.replace('</c:OptionalInputs>', '<c:SignatureSchemes>RSASSA-PSS</c:SignatureSchemes></c:OptionalInputs>'),
  defaults: s => s.replace(/<c:OptionalInputs>[\s\S]*?<\/c:OptionalInputs>/, ''),
};
for (const [name, mutate] of Object.entries(requestMutations)) test('SMC-B authentication XML request: rejects ' + name, async () => {
  const request = certificateRequest('ExternalAuthenticate', { mandantId: 'm', clientSystemId: 'c', workplaceId: 'w' }, { cardHandle: 'h', digest: Buffer.alloc(32, 7) });
  await assert.rejects(inspectConnectorXml(Buffer.from(mutate(request.toString())), { operation: 'ExternalAuthenticate', mode: 'request' }), e => /^KIM_CONNECTOR_XML_|^KIM_CONNECTOR_AUTH_/.test(e?.code));
});
