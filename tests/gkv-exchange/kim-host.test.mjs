import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createKimHostHandler } from '../../api/_lib/kim-host-handler.mjs';
import { callKimHost } from '../../api/_lib/kim-host-transport.mjs';
import { readKimHostStatus } from '../../src/lib/gkvExchange/kimHostContract.ts';
import { testPki } from './pki-fixture.mjs';
import { connectorFixture, hash, raw } from './connector-fixture.mjs';
const tenantId = randomUUID(), userId = randomUUID();
const ready = () => ({ version: 1, tenantId, configured: true, environment: 'test', state: 'ready', canStart: true,
  requestId: null, startedAt: null, completedAt: null, report: null, errorCode: null });
const env = { EXPO_PUBLIC_SUPABASE_URL: 'https://auth.test', EXPO_PUBLIC_SUPABASE_ANON_KEY: 'public-key' };
const res = () => ({ statusCode: 200, headers: {}, setHeader(k, v) { this.headers[k] = v; }, status(n) { this.statusCode = n; return this; }, json(v) { this.body = v; } });
const req = (body = { tenantId, action: 'status' }) => ({ method: 'POST', headers: { authorization: 'Bearer PRIVATE_USER_TOKEN' }, body });
const user = () => new Response(JSON.stringify({ id: userId }));
let pki;
before(async () => { pki = await testPki(); }); after(async () => pki?.close());
test('KIM gateway: verifies user and current tenant permission before exposing configuration', async () => {
  const calls = [], handler = createKimHostHandler({ env, fetch: async (url, options) => { calls.push({ url, options }); return url.endsWith('/user') ? user() : new Response('true'); } });
  const response = res(); await handler(req(), response);
  assert.equal(response.statusCode, 200); assert.equal(readKimHostStatus(response.body, tenantId).state, 'unconfigured');
  assert.equal(calls.length, 2); assert.equal(JSON.parse(calls[1].options.body).p_tenant_id, tenantId);
  assert.equal(response.headers['Cache-Control'], 'private, no-store');
});
for (const [label, response, expected] of [['revoked session', () => new Response('{}', { status: 401 }), 401], ['missing subject', () => new Response('{}'), 401]]) {
  test('KIM gateway: ' + label + ' never calls permission or host', async () => {
    let calls = 0; const handler = createKimHostHandler({ env, fetch: async () => { calls++; return response(); } }), r = res();
    await handler(req({ tenantId, action: 'start', requestId: randomUUID() }), r); assert.equal(r.statusCode, expected); assert.equal(calls, 1);
  });
}
for (const body of ['false', '"true"', '{}']) test('KIM gateway: permission response ' + body + ' cannot authorize the host', async () => {
  const handler = createKimHostHandler({ env, fetch: async url => url.endsWith('/user') ? user() : new Response(body) }), r = res();
  await handler(req(), r); assert.equal(r.statusCode, 403);
});
for (const body of [{ tenantId, action: 'start' }, { tenantId, action: 'status', url: 'https://other.test' }, { tenantId, action: 'start', requestId: randomUUID(), pin: '123456' }, { tenantId, action: 'status', report: { state: 'passed' } }, { tenantId: randomUUID().toUpperCase(), action: 'status' }, '{bad', 'x'.repeat(3000)]) {
  test('KIM gateway: rejects unsupported input ' + JSON.stringify(body).slice(0, 85), async () => {
    const handler = createKimHostHandler({ env, fetch: async () => { throw new Error('Must not fetch'); } }), r = res();
    await handler(req(body), r); assert.ok([400, 413].includes(r.statusCode));
  });
}
test('KIM gateway: GET and unauthenticated requests do not fetch', async () => {
  const handler = createKimHostHandler({ env, fetch: async () => { throw new Error('Must not fetch'); } });
  const a = res(), b = res(); await handler({ ...req(), method: 'GET' }, a); await handler({ ...req(), headers: {} }, b);
  assert.equal(a.statusCode, 405); assert.equal(b.statusCode, 401);
});
async function transport(run, handler) {
  const f = await connectorFixture(pki, handler ?? (event => { event.response.writeHead(200, { 'Content-Type': 'application/json' }); event.response.end(JSON.stringify(ready())); }));
  const config = { KIM_DIAGNOSTIC_HOST_URL: f.options.url.replace('/CertificateService', '/v1/diagnostics'),
    KIM_DIAGNOSTIC_HOST_CONNECT_ADDRESS: '127.0.0.1', KIM_DIAGNOSTIC_HOST_CA: pki.roots, KIM_DIAGNOSTIC_HOST_SHA256: hash(raw(pki.tls.cert)),
    KIM_DIAGNOSTIC_CLIENT_CERT: pki.sender.certificate, KIM_DIAGNOSTIC_CLIENT_KEY: await readFile(pki.sender.privateKeyPath), KIM_DIAGNOSTIC_CLIENT_PASSPHRASE: pki.password.toString() };
  try { await run(config, f); } finally { await f.close(); }
}
test('KIM host transport: pinned mTLS carries only the bounded diagnostic command', async () => transport(async (config, f) => {
  const input = { tenantId, action: 'status' }, response = await callKimHost(config, input);
  assert.equal(response.state, 'ready'); assert.equal(f.requests[0].authorized, true);
  assert.equal(f.requests[0].headers.authorization, undefined); assert.deepEqual(JSON.parse(f.requests[0].bytes), input);
}));
test('KIM host transport: mismatched peer pin sends no diagnostic body', async () => transport(async (config, f) => {
  await assert.rejects(callKimHost({ ...config, KIM_DIAGNOSTIC_HOST_SHA256: '0'.repeat(64) }, { tenantId, action: 'status' }), /KIM_HOST_UNAVAILABLE/);
  assert.equal(f.requests.length, 0);
}));
test('KIM host transport: redirects, compressed and oversized replies are not followed or trusted', async () => {
  for (const kind of ['redirect','compressed','oversized']) await transport(async config => {
    await assert.rejects(callKimHost(config, { tenantId, action: 'status' }), /KIM_HOST_/);
  }, event => { event.response.writeHead(kind === 'redirect' ? 302 : 200, { 'Content-Type': 'application/json', ...(kind === 'redirect' ? { Location: 'https://other.test' } : kind === 'compressed' ? { 'Content-Encoding': 'gzip' } : {}) }); event.response.end(kind === 'oversized' ? 'x'.repeat(40000) : '{}'); });
});
test('KIM gateway: rejects foreign tenant response across actual host mTLS', async () => transport(async config => {
  const handler = createKimHostHandler({ env: { ...env, ...config }, fetch: async url => url.endsWith('/user') ? user() : new Response('true') }), r = res();
  await handler(req({ tenantId: randomUUID(), action: 'status' }), r); assert.equal(r.statusCode, 503);
}));
test('KIM contract: caller cannot turn a status into a hardware certificate', () => {
  assert.throws(() => readKimHostStatus({ ...ready(), hardwareEvidence: 'verified' }, tenantId), /KIM_HOST_RESPONSE/);
  assert.throws(() => readKimHostStatus({ ...ready(), state: 'passed', report: { hardwareEvidence: 'verified' } }, tenantId), /KIM_HOST_RESPONSE/);
  assert.throws(() => readKimHostStatus({ ...ready(), tenantId: randomUUID() }, tenantId), /KIM_HOST_RESPONSE/);
  assert.throws(() => readKimHostStatus({ ...ready(), state: 'running' }, tenantId), /KIM_HOST_RESPONSE/);
});
const completed = version => {
  const startedAt = Date.now() - 3000, completedAt = startedAt + 2000, h = 'a'.repeat(64);
  return { ...ready(), state: 'passed', requestId: randomUUID(), startedAt, completedAt, report: {
    version, runId: randomUUID(), startedAt, completedAt, environment: 'test', state: 'passed', profile: 'ecc-cms-diagnostic', source: 'configured-konnektor',
    challengeSha256: h, contentSha256: h, envelopeSha256: h, transcriptSha256: h,
    certificateSha256: ['C.AUT','C.ENC','C.SIG'].map(ref => ({ ref, sha256: h })),
    transcript: ['GetJobNumber','SignDocument','EncryptDocument','DecryptDocument', ...(version === 2 ? ['VerifyDocument'] : [])].map(operation => ({ operation, requestSha256: h, responseSha256: h, routeSha256: h, contextSha256: h, checkedAt: completedAt })),
    ...(version === 2 ? { documentVerification: { result: 'VALID', checkedAt: completedAt, timestampType: 'SYSTEM_TIMESTAMP', reportSha256: h, signatureSha256: h, signerSha256: h, cmsSha256: h, reportBinding: 'signature-and-certificate' } } : {}),
    hardwareEvidence: 'not-attested', tiEvidence: 'not-attested', deliveryStatus: 'held-for-trust-validation',
  } };
};
test('KIM contract: version 1 stays readable without silently adding VerifyDocument', () => {
  const result = readKimHostStatus(completed(1), tenantId);
  assert.equal(result.report.version, 1); assert.equal(result.report.documentVerification, undefined); assert.equal(result.report.transcript.length, 4);
});
test('KIM contract: version 2 carries the additional verification and supports scoped cooldown', () => {
  const value = { ...completed(2), canStart: false, nextStartAt: Date.now() + 20000 };
  const result = readKimHostStatus(value, tenantId);
  assert.equal(result.report.documentVerification.result, 'VALID'); assert.equal(result.nextStartAt, value.nextStartAt);
  value.report.documentVerification.result = 'INVALID'; assert.equal(result.report.documentVerification.result, 'VALID');
});
for (const [label, change] of [
  ['missing confirmation', s => { delete s.report.documentVerification; }],
  ['old report promoted', s => { s.report.version = 1; }],
  ['string version', s => { s.report.version = '2'; }],
  ['wrong signer', s => { s.report.documentVerification.signerSha256 = 'b'.repeat(64); }],
  ['claimed physical hardware', s => { s.report.hardwareEvidence = 'verified'; }],
  ['invalid signature result', s => { s.report.documentVerification.result = 'INVALID'; }],
  ['old result timestamp', s => { s.report.documentVerification.checkedAt -= 60000; }],
  ['missing operation', s => { s.report.transcript.pop(); }],
  ['foreign report field', s => { s.report.documentVerification.privateData = 'forbidden'; }],
  ['start during cooldown', s => { s.nextStartAt = Date.now() + 1000; }],
]) test('KIM contract: rejects ' + label, () => {
  const status = completed(2); change(status); assert.throws(() => readKimHostStatus(status, tenantId), /KIM_HOST_RESPONSE/);
});
