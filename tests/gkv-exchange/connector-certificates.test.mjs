import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { testPki } from './pki-fixture.mjs';
import { KonnektorCertificateClient, assertConnectorCertificate } from '../../services/kim/connector-certificates.mjs';
import { inspectConnectorXml } from '../../services/kim/connector-xml.mjs';
import { connectorFixture, verificationResponse, certificatesResponse, faultResponse, remoteError, envelope, role, hash, raw, SOAP } from './connector-fixture.mjs';

let pki, aut, enc, osig;
before(async () => { pki = await testPki(); aut = await pki.issueAut(); enc = await pki.issueKim({ name: 'connector-enc' }); osig = await pki.issueKim({ name: 'connector-osig', role: 'osig' }); });
after(async () => { await pki?.close(); });
const code = expected => e => e?.code === expected;
async function fixture(run, handler, changes) { const f = await connectorFixture(pki, handler, changes); try { await run(f); } finally { await f.close(); } }
const verify = (client, changes = {}) => client.verifyCertificate({ certificate: raw(aut.certificate), requiredRoles: [role], ...changes });
const reply = (response, text, status = 200, headers = {}) => { response.writeHead(status, { 'Content-Type': 'text/xml; charset=utf-8', ...headers }); response.end(text); };
const certificateHandler = ({ response, bytes }) => reply(response, bytes.includes('ReadCardCertificate')
  ? certificatesResponse([['C.SIG', osig.certificate], ['C.ENC', enc.certificate], ['C.AUT', aut.certificate]]) : verificationResponse());

test('Konnektor: actual mTLS request uses the official operation, context, DER and SOAPAction', async () => fixture(async ({ open, requests }) => {
  const client = open({ context: { mandantId: 'Köln & <tenant>', clientSystemId: 'CareSuite', workplaceId: 'office', userId: 'user"one' } });
  const r = await verify(client), q = requests[0];
  assert.equal(q.authorized, true); assert.equal(q.clientSha256, hash(raw(pki.sender.certificate)));
  assert.equal(q.url, '/CertificateService'); assert.equal(q.headers.soapaction, '"http://ws.gematik.de/conn/CertificateService/v6.0#VerifyCertificate"');
  assert.equal(Number(q.headers['content-length']), q.bytes.length); assert.match(q.bytes.toString(), /Köln &amp; &lt;tenant&gt;/);
  assert.match(q.bytes.toString(), /user&quot;one/); assert.equal(q.bytes.includes(raw(aut.certificate).toString('base64')), true);
  assert.equal(q.bytes.includes('VerificationTime'), false); assert.equal(r.verificationResult, 'VALID'); assert.deepEqual(r.roles, [role]);
  assert.equal(r.identityStatus, 'unverified'); assert.equal(r.certificateSha256, hash(raw(aut.certificate)));
  assert.equal(assertConnectorCertificate(r, client, { certificate: raw(aut.certificate), requiredRoles: [role] }), r);
  assert.doesNotMatch(JSON.stringify(r), /tenant|PRIVATE|BEGIN CERTIFICATE|UNTRUSTED DISPLAY/);
}));

for (const status of ['INVALID', 'INCONCLUSIVE']) test('Konnektor: HTTP 200 and execution OK do not promote ' + status, async () => fixture(async ({ open }) => {
  const client = open(), r = await verify(client);
  assert.equal(r.execution, 'OK'); assert.equal(r.verificationResult, status); assert.deepEqual(r.remoteCodes, [4151]);
  assert.throws(() => assertConnectorCertificate(r, client, { certificate: raw(aut.certificate) }), code('KIM_CONNECTOR_CERTIFICATE_REJECTED'));
  assert.doesNotMatch(JSON.stringify(r), /PRIVATE/);
}, ({ response }) => reply(response, verificationResponse(status))));

test('Konnektor: a valid certificate with a foreign role fails the required role gate', async () => fixture(async ({ open }) => {
  const client = open(), r = await verify(client, { requiredRoles: ['1.2.276.0.76.4.171'] });
  assert.equal(r.verificationResult, 'VALID'); assert.equal(r.roleMatches, false);
  assert.throws(() => assertConnectorCertificate(r, client, { certificate: raw(aut.certificate), requiredRoles: ['1.2.276.0.76.4.171'] }), code('KIM_CONNECTOR_ROLE'));
}));

test('Konnektor: actual proof is bound to its certificate, client, context and original object', async () => fixture(async ({ open }) => {
  const a = open(), b = open({ context: { mandantId: 'tenant-2', clientSystemId: 'CareSuite', workplaceId: 'office' } }), r = await verify(a);
  for (const [proof, client, cert] of [[{ ...r }, a, raw(aut.certificate)], [r, b, raw(aut.certificate)], [r, a, raw(osig.certificate)], [{ verificationResult: 'VALID' }, a, raw(aut.certificate)]]) {
    assert.throws(() => assertConnectorCertificate(proof, client, { certificate: cert }), code('KIM_CONNECTOR_EVIDENCE_BINDING'));
  }
  a.close(); assert.throws(() => assertConnectorCertificate(r, a, { certificate: raw(aut.certificate) }), code('KIM_CONNECTOR_CLOSED'));
}));

for (const delta of [-1, 30000]) test('Konnektor: ' + (delta < 0 ? 'clock rollback' : 'proof expiry') + ' invalidates consumption', async () => fixture(async ({ open }) => {
  let now = Date.now(); const client = open({ clock: () => now }), r = await verify(client); now += delta;
  assert.throws(() => assertConnectorCertificate(r, client, { certificate: raw(aut.certificate) }), code('KIM_CONNECTOR_EVIDENCE_EXPIRED'));
}));

test('Konnektor: read and verify all requested card certificates with explicit ECC and exact references', async () => fixture(async ({ open, requests }) => {
  const result = await open().readAndVerifyCardCertificates({ cardHandle: 'SMC<&"B', requiredRoles: [role] });
  assert.equal(requests.length, 4); assert.equal(requests[0].bytes.includes('<c:Crypt>ECC</c:Crypt>'), true);
  assert.match(requests[0].bytes.toString(), /SMC&lt;&amp;&quot;B/);
  assert.deepEqual(result.certificates.map(x => x.certRef), ['C.AUT', 'C.ENC', 'C.SIG']);
  assert.deepEqual(result.certificates.map(x => x.certificate), [aut, enc, osig].map(c => raw(c.certificate)));
  assert.equal(result.deliveryStatus, 'held-for-trust-validation'); result.revalidate();
  result.certificates[0].certificate.fill(0);
  assert.throws(result.revalidate, /KIM_CONNECTOR_(?:CERTIFICATE|EVIDENCE_BINDING)/);
  assert.doesNotMatch(JSON.stringify(result), /UNTRUSTED DISPLAY|SMC&lt;/);
}, certificateHandler));

test('Konnektor: missing card reference remains explicit and prevents every verification request', async () => fixture(async ({ open, requests }) => {
  const client = open(), r = await client.readCardCertificates({ cardHandle: 'local' });
  assert.equal(r.certificates[1].state, 'missing'); assert.equal(r.certificates[1].certificate, undefined);
  await assert.rejects(client.readAndVerifyCardCertificates({ cardHandle: 'local' }), code('KIM_CONNECTOR_CERTIFICATE_MISSING'));
  assert.equal(requests.length, 2); assert.ok(requests.every(r => r.bytes.includes('ReadCardCertificate')));
}, ({ response }) => reply(response, certificatesResponse([['C.AUT', aut.certificate], ['C.ENC', null], ['C.SIG', osig.certificate]]))));

for (const change of ['missing', 'extra', 'duplicate', 'wrong algorithm', 'bad DER']) test('Konnektor: ' + change + ' card response fails exact reference/algorithm binding', async () => fixture(async ({ open }) => {
  await assert.rejects(open().readCardCertificates({ cardHandle: 'local', certRefs: ['C.AUT'], crypt: 'ECC' }), e => /^KIM_CONNECTOR_(?:XML|RESULT|CERTIFICATE)/.test(e.code));
}, ({ response }) => {
  let entries = [['C.AUT', aut.certificate]];
  if (change === 'missing') entries = [['C.ENC', enc.certificate]];
  if (change === 'extra') entries.push(['C.ENC', enc.certificate]);
  if (change === 'duplicate') entries.push(entries[0]);
  if (change === 'wrong algorithm') entries = [['C.AUT', pki.sender.certificate]];
  let text = certificatesResponse(entries);
  if (change === 'bad DER') text = text.replace(raw(aut.certificate).toString('base64'), Buffer.from('invalid').toString('base64'));
  reply(response, text);
}));

test('Konnektor: explicitly requested RSA certificates can be read without implying KIM RSA support', async () => fixture(async ({ open, requests }) => {
  const r = await open().readCardCertificates({ cardHandle: 'local', certRefs: ['C.AUT'], crypt: 'RSA' });
  assert.deepEqual(r.certificates[0].certificate, raw(pki.sender.certificate)); assert.equal(requests[0].bytes.includes('<c:Crypt>RSA</c:Crypt>'), true);
}, ({ response }) => reply(response, certificatesResponse([['C.AUT', pki.sender.certificate]]))));

for (const status of [200, 500]) test('Konnektor: SOAP Fault with HTTP ' + status + ' emits bounded codes without remote text', async () => fixture(async ({ open }) => {
  await assert.rejects(verify(open()), e => { assert.equal(e.code, 'KIM_CONNECTOR_SOAP_FAULT'); assert.deepEqual(e.remoteCodes, [4149]); assert.doesNotMatch(e.stack + JSON.stringify(e), /PRIVATE/); return true; });
}, ({ response }) => reply(response, faultResponse(), status)));

const xmlAttacks = [
  ['wrong operation', x => x.replaceAll('VerifyCertificateResponse', 'ReadCardCertificateResponse')],
  ['wrong namespace', x => x.replace('CertificateService/v6.0', 'CertificateService/v9.0')],
  ['SOAP 1.2', x => x.replace(SOAP, 'http://www.w3.org/2003/05/soap-envelope')],
  ['duplicate body', x => x.replace('</s:Envelope>', '<s:Body/></s:Envelope>')],
  ['duplicate result', x => x.replace('</c:VerificationResult>', '</c:VerificationResult><c:VerificationResult>INVALID</c:VerificationResult>')],
  ['nested wrapper', x => x.replace('<c:VerifyCertificateResponse>', '<c:VerifyCertificateResponse><wrapper>').replace('</c:VerifyCertificateResponse>', '</wrapper></c:VerifyCertificateResponse>')],
  ['unknown element', x => x.replace('</c:RoleList>', '</c:RoleList><c:extra/>')],
  ['nonempty SOAP header', x => x.replace('<s:Body>', '<s:Header><evil/></s:Header><s:Body>')],
  ['encodingStyle', x => x.replace('<s:Body>', `<s:Body s:encodingStyle="${SOAP}">`)],
  ['duplicate role', () => verificationResponse('VALID', [role, role])],
  ['noncanonical role', () => verificationResponse('VALID', ['1.02.3'])],
  ['unknown result', () => verificationResponse('SUCCESS')],
  ['VALID warning', () => verificationResponse('VALID', [role], 'Warning')],
  ['VALID error detail', x => x.replace('</c:VerificationStatus>', remoteError() + '</c:VerificationStatus>')],
  ['INVALID without reason', () => verificationResponse('INVALID').replace(remoteError(4151), '')],
  ['DTD and external entity', x => x.replace('<s:Envelope', '<!DOCTYPE x [<!ENTITY stolen SYSTEM "file:///etc/passwd">]><s:Envelope')],
  ['processing instruction', x => x.replace('<s:Body>', '<?fetch href="https://untrusted.invalid"?><s:Body>')],
  ['UTF-16 declaration', x => x.replace('UTF-8', 'UTF-16')],
  ['oversized role list', () => verificationResponse('VALID', Array.from({ length: 33 }, (_, i) => '1.2.3.' + i))],
];
for (const [label, alter] of xmlAttacks) test('Konnektor XML rejects ' + label, async () => {
  await assert.rejects(inspectConnectorXml(Buffer.from(alter(verificationResponse())), { operation: 'VerifyCertificate', mode: 'response' }), e => /^KIM_CONNECTOR_(?:XML_|RESULT)/.test(e.code));
});

test('Konnektor XML accepts namespace aliases, legal whitespace and an empty SOAP header', async () => {
  const xml = verificationResponse().replace(/<(\/?)s:/g, '<$1env:').replace('xmlns:s=', 'xmlns:env=').replace('<env:Body>', '<env:Header/>\n<env:Body>');
  const result = await inspectConnectorXml(Buffer.from(xml), { operation: 'VerifyCertificate', mode: 'response' });
  assert.equal(result.verificationResult, 'VALID');
});

for (const responseCase of ['redirect', 'HTTP error', '500 success', 'wrong media', 'gzip', 'oversize', 'truncated']) test('Konnektor transport rejects ' + responseCase, async () => fixture(async ({ open, requests }) => {
  await assert.rejects(verify(open()), e => /^KIM_CONNECTOR_(?:HTTP_|RESPONSE_SIZE)/.test(e.code)); assert.equal(requests.length, 1);
}, ({ response }) => {
  if (responseCase === 'redirect') return reply(response, verificationResponse(), 302, { Location: 'https://unconfigured.invalid' });
  if (responseCase === 'HTTP error') return reply(response, verificationResponse(), 503);
  if (responseCase === '500 success') return reply(response, verificationResponse(), 500);
  if (responseCase === 'wrong media') return reply(response, verificationResponse(), 200, { 'Content-Type': 'application/json' });
  if (responseCase === 'gzip') return reply(response, verificationResponse(), 200, { 'Content-Encoding': 'gzip' });
  if (responseCase === 'oversize') return reply(response, Buffer.alloc(262145, 65));
  response.writeHead(200, { 'Content-Type': 'text/xml', 'Content-Length': 100000 }); response.write(verificationResponse()); response.destroy();
}));

for (const mismatch of ['pin', 'hostname', 'CA', 'client key']) test('Konnektor mTLS: wrong ' + mismatch + ' cannot transmit SOAP data', async () => fixture(async ({ open, options, requests }) => {
  const config = mismatch === 'pin' ? { serverSha256: '0'.repeat(64) }
    : mismatch === 'hostname' ? { url: options.url.replace('localhost.test', 'wrong.test') }
      : mismatch === 'CA' ? { ca: pki.sender.certificate } : { clientCertificate: pki.recipient.certificate };
  await assert.rejects(async () => verify(open(config)), e => ['KIM_CONNECTOR_HTTP_CONNECTION', 'KIM_CONNECTOR_CONFIGURATION'].includes(e.code));
  assert.equal(requests.length, 0);
}));

test('Konnektor: invalid requests and absent XML runtime fail before any HTTPS request', async () => fixture(async ({ open, requests }) => {
  const client = open();
  for (const changes of [{ certificate: Buffer.from('bad') }, { certificate: Buffer.concat([raw(aut.certificate), Buffer.from([0])]) }, { requiredRoles: ['bad'] }, { requiredRoles: [role, role] }, { requiredRoles: Array(1) }]) {
    await assert.rejects(verify(client, changes), e => ['KIM_CONNECTOR_CERTIFICATE', 'KIM_CONNECTOR_INPUT'].includes(e.code));
  }
  for (const changes of [{ certRefs: [] }, { certRefs: ['C.AUT', 'C.AUT'] }, { cardHandle: 'x\n' }, { crypt: 'AUTO' }]) {
    await assert.rejects(client.readCardCertificates({ cardHandle: 'local', ...changes }), code('KIM_CONNECTOR_INPUT'));
  }
  await assert.rejects(verify(open({ python: '/missing/local/python' })), code('KIM_CONNECTOR_XML_UNAVAILABLE'));
  assert.equal(requests.length, 0);
}));

test('Konnektor: caller mutation cannot change captured DER, roles or context during HTTPS', async () => {
  const waiting = Promise.withResolvers();
  await fixture(async ({ open }) => {
    const context = { mandantId: 'before', clientSystemId: 'CareSuite', workplaceId: 'office' }, client = open({ context });
    const cert = raw(aut.certificate), expected = [role], pending = verify(client, { certificate: cert, requiredRoles: expected });
    const release = await waiting.promise; cert.fill(0); expected[0] = '1.2.3'; context.mandantId = 'after'; release();
    const r = await pending; assert.equal(r.certificateSha256, hash(raw(aut.certificate))); assert.equal(r.roleMatches, true);
  }, ({ response }) => { waiting.resolve(() => reply(response, verificationResponse())); return true; });
});

for (const action of ['abort', 'close', 'timeout']) test('Konnektor: ' + action + ' during HTTPS cannot produce later evidence', async () => {
  const waiting = Promise.withResolvers();
  await fixture(async ({ open }) => {
    const client = open({ timeoutMs: action === 'timeout' ? 400 : 10000 }), controller = new AbortController();
    const outcome = verify(client, { signal: controller.signal }).then(value => ({ value }), error => ({ error }));
    const release = await waiting.promise;
    if (action === 'abort') controller.abort(); if (action === 'close') client.close();
    const result = await outcome;
    assert.equal(result.value, undefined); assert.equal(result.error.code, 'KIM_CONNECTOR_' + (action === 'abort' ? 'ABORTED' : action === 'close' ? 'CLOSED' : 'TIMEOUT'));
    release();
  }, ({ response }) => { waiting.resolve(() => reply(response, verificationResponse())); return true; });
});

test('Konnektor: aggregate rechecks earlier proofs after the last asynchronous verification', async () => {
  let now = Date.now(), checks = 0;
  await fixture(async ({ open }) => {
    await assert.rejects(open({ clock: () => now, timeoutMs: 30000 }).readAndVerifyCardCertificates({ cardHandle: 'local' }), code('KIM_CONNECTOR_EVIDENCE_EXPIRED'));
  }, ({ response, bytes }) => {
    if (bytes.includes('ReadCardCertificate')) return reply(response, certificatesResponse([['C.AUT', aut.certificate], ['C.ENC', enc.certificate], ['C.SIG', osig.certificate]]));
    if (++checks >= 2) now += 20000;
    return reply(response, verificationResponse());
  });
});

test('Konnektor: parallel request limit prevents more SOAP work and closing settles every pending request', async () => {
  const waiting = Promise.withResolvers();
  await fixture(async ({ open, requests }) => {
    const client = open(), outcomes = Array.from({ length: 8 }, () => verify(client).then(value => ({ value }), error => ({ error })));
    await assert.rejects(verify(client), code('KIM_CONNECTOR_BUSY'));
    await waiting.promise; assert.equal(requests.length, 8);
    client.close();
    for (const result of await Promise.all(outcomes)) {
      assert.equal(result.value, undefined); assert.equal(result.error.code, 'KIM_CONNECTOR_CLOSED');
    }
    await assert.rejects(verify(client), code('KIM_CONNECTOR_CLOSED'));
    assert.equal(requests.length, 8);
  }, ({ requests }) => { if (requests.length === 8) waiting.resolve(); });
});
