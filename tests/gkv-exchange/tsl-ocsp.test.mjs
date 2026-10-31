import { KimDiagnosticHost, createKimHostServer } from '../../services/kim/host.mjs';
import { createKimHostHandler } from '../../api/_lib/kim-host-handler.mjs';
import { readKimHostStatus } from '../../src/lib/gkvExchange/kimHostContract.ts';
import { readKimReceiveStatus, readKimReceiveList } from '../../src/lib/gkvExchange/kimReceiveContract.ts';
import { ReceiptInbox } from '../../services/gkv/inbox.mjs';
import { dirname } from 'node:path';
import { probeSmcbCms } from '../../services/kim/connector-cms-probe.mjs';
import { makeCmsReply, cmsUrls, cmsOperation, cmsVerificationReply } from './connector-cms-fixture.mjs';
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import https from 'node:https';
import { once } from 'node:events';
import { createHash, createPrivateKey, X509Certificate, randomBytes, randomUUID, sign, constants } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { Vault } from '../../services/gkv/storage.mjs';
import { TslOcspStatusClient } from '../../services/kim/tsl-ocsp.mjs';
import { receiveEccKimMessageWithTsl } from '../../services/kim/receive-tsl.mjs';
import { createEccKimMessage, inspectEccKimMessageForDirectory, authenticateInspectedKimMessage } from '../../services/kim/client-message.mjs';
import { readMessage, parseContentType, decodedBase64 } from '../../services/kim/message.mjs';
import { createEccKimAuth, verifyReceivedEccKimAuth } from '../../services/kim/message-auth.mjs';
import { sealEccKimPayload } from '../../services/kim/ecc-cms.mjs';
import { TslRefreshManager } from '../../services/kim/tsl-refresh.mjs';
import { TslHttpSource } from '../../services/kim/tsl-http.mjs';
import { TslSignerStatusSource } from '../../services/kim/tsl-signer-status.mjs';
import { TslTrustStore } from '../../services/kim/tsl-store.mjs';
import { DurableOcspStatusCache } from '../../services/kim/ocsp-store.mjs';
import { OcspHttpTransport } from '../../services/kim/ocsp-http.mjs';
import { certificateParts, der, fields } from '../../services/gkv/der.mjs';
import { tlv, sequence as seq } from '../../services/kim/cms-codec.mjs';
import { tslFixture, CA, OCSP, REVOKED } from './tsl-fixture.mjs';
import { withAdmission, admissionDer } from './admission-fixture.mjs';
import { vzdFixture, record, entryReply, searchDone, bindReply } from './vzd-fixture.mjs';
import { resolveVzdRecipients, matchVzdSender } from '../../services/kim/vzd-bindings.mjs';
import { openEccKimMessage } from '../../services/kim/client-message.mjs';
import { VzdLdapsDirectory, revalidateVzdRecord } from '../../services/kim/vzd.mjs';
import { connectorFixture, verificationResponse, faultResponse, certificatesResponse } from './connector-fixture.mjs';
import { cardData, cardsResponse, cardsReply, eventUrl } from './connector-card-fixture.mjs';
import { readAndVerifySmcb } from '../../services/kim/connector-smcb.mjs';
import { prepareSmcbPin, assertPreparedSmcbPin, maintainSmcbPin, assertMaintainedSmcbPin } from '../../services/kim/connector-pin.mjs';
import { cardUrl, pinResponse, isPinStatus, isVerifyPin, isChangePin, isUnblockPin } from './connector-pin-fixture.mjs';
import { authUrl, isAuthenticate, authResponse, signAuthRequest } from './connector-auth-fixture.mjs';
import { signSmcbAuthentication, assertSmcbAuthentication, createSmcbKimAuth, assertSmcbKimAuth } from '../../services/kim/connector-auth.mjs';
import {MonthlyComponentSigner} from '../../services/gkv/monthly-component-signer.mjs';
import {MonthlyOriginalStore} from '../../services/gkv/monthly-original-store.mjs';
import {MonthlyOriginalVerifier} from '../../services/gkv/monthly-original-verifier.mjs';
import {MonthlyOriginalHost,createMonthlyHostServer} from '../../services/gkv/monthly-host.mjs';
import {callMonthlyHost} from '../../api/_lib/monthly-host-transport.mjs';
import {monthlyFactsFixture} from './monthly-facts-fixture.mjs';
import {signingPng} from './monthly-host-fixture.mjs';
import {generateCapturedMonthlyXml} from '../../services/gkv/monthly-captured-xml.mjs';
import {openssl} from '../../services/gkv/openssl.mjs';

const hash = b => createHash('sha256').update(b).digest('hex');
const raw = c => new X509Certificate(c).raw;
const code = expected => error => error?.code === expected;
const statusError = e => /^KIM_(?:TSL|OCSP)_/.test(e?.code);
const report = { cmVersion: 'TEST_0.1.0', ptVersion: '1.5.5' };
let f, server, origin, signer, signing, authentication, wire, state, defaults, extraResponder, originalHash, rootKey;
let encryption, rollover, signingKey, authKey, remoteSigning, remoteSigningKey;
let vzdServer, vzdTls;
const senderAddress = 'sender@local.kim.telematik-test', receiverAddress = 'receiver@local.kim.telematik-test';
const endpoints = () => ({ url: origin + '/leaf-ocsp', ca: f.pki.roots, connectAddress: '127.0.0.1' });
const route = path => ({ ...endpoints(), url: origin + path });
const leafCount = () => state.calls.filter(c => c.path.startsWith('/leaf-')).length;
before(async () => {
  f = await tslFixture();
  server = https.createServer(f.pki.tls, (req, res) => {
    const chunks = []; req.on('data', c => chunks.push(c)); req.on('end', () => {
      const bytes = Buffer.concat(chunks), path = req.url;
      const identity = [...(state.certificates ?? []), signer, signing, authentication, ...(encryption ?? []), rollover, vzdServer].filter(Boolean).find(c => f.proof(c.certificate).request.equals(bytes));
      const purpose = identity === signing ? 'signing' : identity === authentication ? 'authentication' : identity === signer ? 'signer' : identity === vzdServer ? 'directory' : 'encryption';
      state.calls.push({ path, bytes, purpose });
      if (state.handler?.(req, res, bytes, purpose)) return;
      if (path === '/hash') { res.writeHead(200, { 'Content-Type': 'text/plain' }); res.end(hash(state.bundle.xml)); }
      else if (path === '/xml') { res.writeHead(200, { 'Content-Type': 'application/xml' }); res.end(state.bundle.xml); }
      else if (path === '/signature') { res.writeHead(200, { 'Content-Type': 'application/octet-stream' }); res.end(state.bundle.detachedSignature); }
      else if (path === '/signer-ocsp' || path.startsWith('/leaf-')) {
        if (!identity) { res.writeHead(400); res.end(); return; }
        const isLeaf = path.startsWith('/leaf-');
        const proof = f.proof(identity.certificate, { state: isLeaf ? state[purpose] ?? 'good' : 'good', producedAt: state.now,
          responder: isLeaf ? state.responder ?? f.responder : f.responder });
        res.writeHead(200, { 'Content-Type': 'application/ocsp-response' }); res.end(proof.response);
      } else { res.writeHead(404); res.end(); }
    });
  });
  server.listen(0, '127.0.0.1'); await once(server, 'listening'); origin = `https://localhost.test:${server.address().port}`;
  signer = await f.issueSigner({ name: 'route-tsl', aia: `OCSP;URI:${origin}/signer-ocsp` });
  const startDate = new Date(f.now - 86400000).toISOString().replace(/[-:T]/g, '').slice(0, 14) + 'Z';
  signing = await f.pki.issueKim({ name: 'route-osig', role: 'osig', startDate, aia: `OCSP;URI:${origin}/leaf-aia` });
  remoteSigning = await f.pki.issueKim({ name: 'route-remote-osig', role: 'osig', startDate,
    admission: admissionDer({ telematikId: '10-SEPARATE-SIGNER' }) });
  authentication = await f.pki.issueAut({ name: 'route-aut', startDate });
  const a = await f.pki.issueKim({ name: 'route-enc-a', startDate }), b = await f.pki.issueKim({ name: 'route-enc-b', startDate });
  encryption = [a, b]; rollover = await f.pki.issueKim({ name: 'route-enc-rollover', startDate });
  const key = async c => createPrivateKey({ key: await readFile(c.privateKeyPath), passphrase: f.pki.password });
  rootKey = await key({ privateKeyPath: join(f.pki.dir, 'root.key') });
  signingKey = await key(signing); authKey = await key(authentication);
  remoteSigningKey = await key(remoteSigning);
  vzdServer = await f.pki.issueVzd({ startDate });
  vzdTls = { key: await readFile(vzdServer.privateKeyPath), passphrase: f.pki.password.toString(), cert: vzdServer.certificate };
  const sender = 'sender@local.kim.telematik-test', receiver = 'receiver@local.kim.telematik-test';
  const message = createEccKimMessage({ message: Buffer.from(`From: ${sender}\r\nTo: ${receiver}\r\nSubject: Local TSL status test\r\nMIME-Version: 1.0\r\nContent-Type: text/plain\r\n\r\nPRIVATE LOCAL STATUS TEST\r\n`),
    sender, envelopeRecipients: [receiver], recipients: [{ address: sender, certificate: a.certificate }, { address: receiver, certificate: b.certificate }],
    signingCertificate: signing.certificate, signingKey: await key(signing), authCertificate: authentication.certificate, authKey: await key(authentication), ...report, now: f.now });
  wire = { bytes: message.bytes, address: receiver, recipientCertificate: b.certificate, privateKey: await key(b),
    expectedSignerCertificate: signing.certificate, expectedAuthCertificate: authentication.certificate, now: f.now };
  originalHash = hash(wire.bytes);
  defaults = f.services.map(s => ({ ...s, supplyPoints: [origin + (s.type === CA ? '/leaf-ocsp' : '/not-the-ca-route')] }));
  defaults = defaults.map(s => s.type === CA ? { ...s, extensionOids: [...s.extensionOids, '1.2.276.0.76.4.157'] } : s);
  extraResponder = await f.issueResponder({ name: 'route-next-responder' });
});
after(async () => { server?.closeAllConnections(); if (server) await new Promise(r => server.close(r)); await f?.close(); });
async function fixture(run, { services = defaults, ready = true, clientChanges } = {}) {
  state = { now: f.now, calls: [], bundle: await f.bundle({ signer, services }) };
  const dir = await mkdtemp(join(tmpdir(), 'cs-tsl-ocsp-')), key = randomBytes(32), path = join(dir, 'status.db'), clock = () => state.now;
  const store = new TslTrustStore({ path: join(dir, 'tsl.db'), key, scopeId: randomUUID(), verifier: f.verifier({ clock }) });
  const signerCache = new DurableOcspStatusCache({ path: join(dir, 'signer.db'), key, scopeId: randomUUID(), clock,
    verifier: f.statusVerifier(clock), transport: new OcspHttpTransport(route('/signer-ocsp')) });
  const manager = new TslRefreshManager({ store, clock, signerStatusSource: new TslSignerStatusSource({ caches: [signerCache] }),
    source: new TslHttpSource({ environment: 'test', routes: { xml: route('/xml'), signature: route('/signature'), hash: route('/hash') } }) });
  const clients = [], options = { manager, environment: 'test', path, key, scopeId: randomUUID(), clock,
    routes: [{ transport: new OcspHttpTransport(endpoints()), scopeId: randomUUID() }], ...clientChanges };
  const open = changes => { const c = new TslOcspStatusClient({ ...options, ...changes }); clients.push(c); return c; };
  const update = async changes => { state.bundle = await f.bundle({ signer, services, id: 'TSL_10002', sequence: 10002, ...changes }); await manager.refresh(); };
  const inspect = fn => { const db = new DatabaseSync(path); try { return fn(db); } finally { db.close(); } };
  try { if (ready) await manager.refresh(); await run({ manager, store, open, update, options, path, inspect, key, clock }); }
  finally { for (const c of clients) c.close(); manager.close(); signerCache.close(); store.close(); server.closeAllConnections(); await rm(dir, { recursive: true, force: true }); }
}
const check = client => client.check({ certificate: signing.certificate, purpose: 'signing' });
const receive = (client, options = wire, reportOptions = report, signal) => receiveEccKimMessageWithTsl(options, reportOptions, { statusClient: client, signal });

test('TSL OCSP: CA ServiceSupplyPoint selects the fixed route; leaf AIA and responder-service URL do not', async () => fixture(async ({ open }) => {
  const result = await check(open());
  assert.equal(result.status, 'good'); assert.equal(result.trustSource, 'configured-tsl-anchors'); assert.equal(result.identityStatus, 'unverified');
  assert.equal(result.tsl.sequence, 10001); assert.equal(result.certificateSha256, hash(raw(signing.certificate)));
  assert.equal(result.certificateTypeOid, '1.2.276.0.76.4.78');
  assert.equal(result.admission.telematikId, '10-LOCAL-TEST');
  assert.deepEqual(result.admission.professionOids, ['1.2.276.0.76.4.245']);
  assert.equal(leafCount(), 1); assert.equal(state.calls.at(-1).path, '/leaf-ocsp');
  assert.deepEqual(state.calls.at(-1).bytes, f.proof(signing.certificate).request);
  assert.equal(result.verifier.verify({ certificate: signing.certificate, request: result.request, response: result.response }).status, 'good');
}));

test('TSL OCSP: unchanged evidence survives client restart and remains byte exact after caller mutation', async () => fixture(async ({ open, path }) => {
  const a = open(), first = await check(a); first.response.fill(0); a.close();
  const b = open(), second = await check(b); assert.equal(second.source, 'persistent-cache'); assert.equal(leafCount(), 1);
  assert.equal(second.status, 'good'); b.close();
  assert.equal((await readFile(path)).includes(raw(signing.certificate)), false);
}));

test('TSL OCSP: an unchanged-list refresh renews guards while reusing durable evidence', async () => fixture(async ({ open, manager }) => {
  const client = open(), old = await check(client); await manager.refresh();
  assert.throws(() => old.verifier.createRequest(signing.certificate), statusError);
  const fresh = await check(client); assert.equal(fresh.status, 'good'); assert.equal(fresh.source, 'persistent-cache'); assert.equal(leafCount(), 1);
}));

test('TSL OCSP: removed responders block old cached success before any leaf request', async () => fixture(async ({ open, update }) => {
  const c = open(), old = await check(c); await update({ services: defaults.filter(s => s.type !== OCSP) });
  await assert.rejects(check(c), code('KIM_TSL_RESPONDER')); assert.equal(leafCount(), 1);
  assert.throws(() => old.verifier.createRequest(signing.certificate), statusError);
}));

test('TSL OCSP: responder rotation replaces incompatible authenticated evidence with a new signed response', async () => fixture(async ({ open, update }) => {
  const c = open(), old = await check(c);
  await update({ services: defaults.map(s => s.type === OCSP ? { ...s, certificate: raw(extraResponder.certificate).toString('base64') } : s) });
  state.responder = extraResponder;
  const fresh = await check(c); assert.equal(leafCount(), 2); assert.notEqual(fresh.responderSha256, old.responderSha256);
  assert.equal(fresh.responderSha256, hash(raw(extraResponder.certificate))); assert.equal(fresh.source, 'response');
}));

test('TSL OCSP: a new CA status route cannot reuse evidence obtained from the old endpoint', async () => fixture(async ({ open, update, options }) => {
  const routes = [...options.routes, { transport: new OcspHttpTransport(route('/leaf-alt')), scopeId: randomUUID() }];
  const c = open({ routes }); await check(c);
  await update({ services: defaults.map(s => s.type === CA ? { ...s, supplyPoints: [origin + '/leaf-alt'] } : s) });
  const fresh = await check(c); assert.equal(fresh.source, 'response'); assert.equal(state.calls.at(-1).path, '/leaf-alt'); assert.equal(leafCount(), 2);
}));

test('TSL OCSP: missing active manager cannot trigger a request or trust a caller good flag', async () => fixture(async ({ open }) => {
  await assert.rejects(open().check({ certificate: signing.certificate, status: 'good' }), code('KIM_TSL_UNAVAILABLE'));
  assert.equal(state.calls.length, 0);
}, { ready: false }));

for (const [label, points, expected] of [
  ['missing', [], 'KIM_TSL_STATUS_ADDRESS'],
  ['unconfigured', ['https://unconfigured.invalid/status'], 'KIM_TSL_STATUS_ROUTE'],
  ['credentials', ['https://secret:password@unconfigured.invalid/status'], 'KIM_TSL_STATUS_ADDRESS'],
  ['fragment', ['https://unconfigured.invalid/status#fragment'], 'KIM_TSL_STATUS_ADDRESS'],
  ['unsupported scheme', ['ldap://unconfigured.invalid/status'], 'KIM_TSL_STATUS_ADDRESS'],
  ['duplicate', ['https://unconfigured.invalid/status', 'https://unconfigured.invalid/status'], 'KIM_TSL_STATUS_ADDRESS'],
]) test('TSL OCSP: ' + label + ' CA endpoint fails without using the certificate AIA', async () => fixture(async ({ open }) => {
  await assert.rejects(check(open()), code(expected)); assert.equal(leafCount(), 0);
}, { services: defaults.map(s => s.type === CA ? { ...s, supplyPoints: points } : s) }));

test('TSL OCSP: two configured matches are ambiguous; one configured match may select from the signed list', async () => {
  const services = defaults.map(s => s.type === CA ? { ...s, supplyPoints: [origin + '/leaf-ocsp', origin + '/leaf-alt'] } : s);
  await fixture(async ({ open }) => { assert.equal((await check(open())).status, 'good'); }, { services });
  await fixture(async ({ open, options }) => {
    const c = open({ routes: [...options.routes, { transport: new OcspHttpTransport(route('/leaf-alt')), scopeId: randomUUID() }] });
    await assert.rejects(check(c), code('KIM_TSL_STATUS_ROUTE')); assert.equal(leafCount(), 0);
  }, { services });
});

test('TSL OCSP: CA inputs, altered certificates and missing authority key identifiers fail before network', async () => fixture(async ({ open, manager }) => {
  const c = open(); await assert.rejects(c.check({ certificate: f.pki.roots, purpose: 'signing' }), code('KIM_TSL_SERVICE_CERTIFICATE'));
  const parts = certificateParts(raw(signing.certificate)), rootKey = createPrivateKey({ key: await readFile(join(f.pki.dir, 'root.key')), passphrase: f.pki.password });
  const tbs = seq(...parts.tbs.map(n => n.tag === 163 ? tlv(163, seq(...fields(fields(n, 163, 1)[0], 48)
    .filter(e => fields(e, 48)[0].value.toString('hex') !== '551d23').map(e => e.raw))) : n.raw));
  const signature = sign('sha256', tbs, { key: rootKey, padding: constants.RSA_PKCS1_PSS_PADDING, saltLength: 32 });
  const certificate = seq(tbs, parts.signatureAlgorithm.raw, tlv(3, Buffer.concat([Buffer.from([0]), signature])));
  assert.equal(new X509Certificate(certificate).verify(new X509Certificate(f.pki.roots).publicKey), true);
  await assert.rejects(c.check({ certificate, purpose: 'signing' }), code('KIM_TSL_ISSUER_KEY_ID')); assert.equal(leafCount(), 0);
  const malformed = Buffer.from(raw(signing.certificate)); malformed[malformed.length - 1] ^= 1;
  assert.throws(() => manager.current().ocspPlanFor(malformed), code('KIM_TSL_ISSUER'));
}));

test('TSL OCSP: CA compromise mode is explicit and still tied to issuance before the signed cutoff', async () => {
  const services = defaults.map(s => s.type === CA ? { ...s, status: REVOKED, started: f.now - 1000 } : s);
  await fixture(async ({ open }) => { await assert.rejects(check(open()), code('KIM_TSL_ISSUER')); assert.equal(leafCount(), 0); }, { services });
  await fixture(async ({ open }) => { assert.equal((await check(open({ model: 'nonqes-compromise' }))).status, 'good'); }, { services });
  await fixture(async ({ open }) => { await assert.rejects(check(open({ model: 'nonqes-compromise' })), code('KIM_TSL_ISSUER')); },
    { services: services.map(s => s.type === CA ? { ...s, started: f.now - 2 * 86400000 } : s) });
});

for (const condition of ['revoked', 'unknown']) test('TSL OCSP: ' + condition + ' status is retained as a negative result, never refetched as success', async () => fixture(async ({ open }) => {
  state.signing = condition; const c = open(), first = await check(c); state.signing = 'good';
  const cached = await check(c); assert.equal(first.status, condition); assert.equal(cached.status, condition); assert.equal(leafCount(), 1);
}));

test('TSL OCSP: ciphertext manipulation is not treated as responder rotation', async () => fixture(async ({ open, inspect }) => {
  const c = open(); await check(c); inspect(db => db.exec("UPDATE ocsp_evidence SET content=zeroblob(length(content))"));
  await assert.rejects(check(c), code('KIM_OCSP_STORE_INTEGRITY')); assert.equal(leafCount(), 1);
}));

test('TSL OCSP: environment, route, model, quota and namespace changes cannot silently reuse one cache', async () => fixture(async ({ open, options }) => {
  const c = open(); await check(c); c.close(); const before = leafCount();
  assert.throws(() => open({ environment: 'production' }), code('KIM_TSL_STATUS_CONFIGURATION'));
  for (const changes of [{ model: 'nonqes-compromise' }, { maxEntriesPerRoute: 1 }, { routes: [{ ...options.routes[0], transport: new OcspHttpTransport(route('/leaf-alt')) }] }]) {
    assert.throws(() => open(changes), code('KIM_TSL_STATUS_BINDING'));
  }
  assert.throws(() => open({ scopeId: randomUUID() }), code('KIM_TSL_STATUS_BINDING'));
  assert.equal(leafCount(), before);
}));

test('TSL OCSP: configuration copies and row authentication prevent silent runtime changes', async () => fixture(async ({ open, options, inspect }) => {
  const routes = [...options.routes], c = open({ routes }); routes[0] = { transport: new OcspHttpTransport(route('/leaf-alt')), scopeId: randomUUID() };
  assert.equal((await check(c)).status, 'good');
  inspect(db => db.exec('UPDATE kim_tsl_ocsp_scopes_v1 SET configuration=zeroblob(length(configuration))'));
  await assert.rejects(check(c), code('KIM_TSL_STATUS_BINDING')); assert.equal(leafCount(), 1);
}));

test('TSL OCSP: concurrent callers and separate clients share the actual HTTP request', async () => fixture(async ({ open }) => {
  const a = open(), b = open(); const results = await Promise.all([check(a), check(a), check(b)]);
  assert.equal(results.every(r => r.status === 'good'), true); assert.equal(leafCount(), 1);
}));

test('TSL OCSP: update during a pending query prevents stale activation and new-generation waiters recheck', async () => fixture(async ({ open, update }) => {
  let release, arrive; const arrived = new Promise(r => { arrive = r; });
  state.handler = (req, res, _bytes, purpose) => {
    if (!req.url.startsWith('/leaf-')) return false;
    release = () => { res.writeHead(200, { 'Content-Type': 'application/ocsp-response' }); res.end(f.proof(purpose === 'signing' ? signing.certificate : authentication.certificate).response); }; arrive(); return true;
  };
  const c = open(), old = check(c), rejectedOld = assert.rejects(old, statusError); await arrived;
  await update({}); const waiting = assert.rejects(check(c), statusError); release(); await Promise.all([rejectedOld, waiting]);
  state.handler = undefined; const fresh = await check(c); assert.equal(fresh.tsl.sequence, 10002); assert.equal(leafCount(), 2);
}));

test('TSL OCSP: waiter cancellation does not poison a shared cache; client close stops owned work', async () => fixture(async ({ open }) => {
  let release, arrive; const arrived = new Promise(r => { arrive = r; });
  state.handler = (req, res) => {
    if (!req.url.startsWith('/leaf-')) return false;
    release = () => { res.writeHead(200, { 'Content-Type': 'application/ocsp-response' }); res.end(f.proof(signing.certificate).response); }; arrive(); return true;
  };
  const c = open(), controller = new AbortController(), pending = c.check({ certificate: signing.certificate, purpose: 'signing', signal: controller.signal }); await arrived;
  controller.abort(); await assert.rejects(pending, code('KIM_TSL_ABORTED'));
  const shared = check(c); release(); assert.equal((await shared).status, 'good'); assert.equal(leafCount(), 1);
  c.close(); await assert.rejects(check(c), code('KIM_TSL_STATUS_CLOSED'));
}));

test('TSL OCSP: protocol errors retain four-attempt backoff through client replacement', async () => fixture(async ({ open }) => {
  state.handler = (req, res) => { if (!req.url.startsWith('/leaf-')) return false; res.writeHead(200, { 'Content-Type': 'application/ocsp-response' }); res.end(Buffer.from([48, 3, 10, 1, 3])); return true; };
  const a = open(); await assert.rejects(check(a), code('KIM_OCSP_RESPONDER_ERROR')); a.close();
  await assert.rejects(check(open()), code('KIM_OCSP_BACKOFF')); assert.equal(leafCount(), 4);
}));

test('KIM TSL receive: both raw status proofs reach the encrypted-message diagnostic without normal delivery', async () => fixture(async ({ open }) => {
  const result = await receive(open());
  assert.equal(result.kind, 'diagnostic'); assert.equal(result.diagnostic.integrityResult, '07');
  assert.equal(result.statusAcquisition.state, 'checked'); assert.equal(result.statusAcquisition.tsl.sequence, 10001);
  assert.deepEqual(result.statusAcquisition.certificateTypes, { signing: '1.2.276.0.76.4.78', authentication: '1.2.276.0.76.4.77' });
  assert.equal(result.statusAcquisition.certificateAdmissions.signing.telematikId, '10-LOCAL-TEST');
  assert.equal(result.statusAcquisition.certificateAdmissions.authentication.telematikId, '10-LOCAL-TEST');
  assert.throws(() => { result.statusAcquisition.certificateAdmissions.authentication.telematikId = '10-FORGED'; }, TypeError);
  assert.equal(result.diagnostic.originalSha256, originalHash); assert.equal(result.diagnostic.decryptedOriginalAttached, false);
  assert.deepEqual(result.diagnostic.certificateStatus.map(s => [s.purpose, s.status]), [['signing', 'good'], ['authentication', 'good']]);
  assert.equal(result.diagnostic.deliveryStatus, 'diagnostic-only'); assert.equal(leafCount(), 2);
  assert.equal(result.bytes.includes(Buffer.from('PRIVATE LOCAL STATUS TEST')), false); assert.equal(hash(wire.bytes), originalHash);
}));

for (const condition of ['revoked', 'unknown']) test('KIM TSL receive: ' + condition + ' OSIG is recorded without plaintext release', async () => fixture(async ({ open }) => {
  state.signing = condition; const result = await receive(open());
  assert.equal(result.diagnostic.errorCode, 'XCS_CERT_STATUS'); assert.equal(result.diagnostic.certificateStatus[0].status, condition);
  assert.equal(result.diagnostic.certificateStatus[1].status, 'good'); assert.equal(result.diagnostic.decryptedOriginalAttached, false);
}));

test('KIM TSL receive: one HTTP failure keeps the other role proof and reports unavailability', async () => fixture(async ({ open }) => {
  state.handler = (req, res, _bytes, purpose) => { if (!req.url.startsWith('/leaf-') || purpose !== 'authentication') return false; res.writeHead(503); res.end(); return true; };
  const result = await receive(open()); assert.equal(result.statusAcquisition.state, 'incomplete');
  assert.equal(result.statusAcquisition.failures[0].code, 'KIM_OCSP_HTTP_STATUS');
  assert.deepEqual(result.diagnostic.certificateStatus.map(s => s.status), ['good', 'unavailable']);
}));

test('KIM TSL receive: malformed message, missing key and invalid report options cause no status requests', async () => fixture(async ({ open }) => {
  const c = open();
  const bad = { ...wire, bytes: Buffer.from(wire.bytes.toString().replace('Subject: KOM-LE-Nachricht', 'Subject: broken')) };
  assert.equal((await receive(c, bad)).kind, 'diagnostic'); assert.equal((await receive(c, { ...wire, privateKey: undefined })).diagnostic.errorCode, '4009');
  await assert.rejects(receive(c, wire, { ...report, cmVersion: 'invalid' })); assert.equal(leafCount(), 0);
}));

test('KIM TSL receive: missing TSL produces unavailable evidence, not a good status supplied by the caller', async () => fixture(async ({ open }) => {
  const result = await receive(open(), { ...wire, ocsp: { signing: { status: 'good' }, authentication: { status: 'good' } } });
  assert.equal(result.statusAcquisition.state, 'unavailable'); assert.equal(result.statusAcquisition.code, 'KIM_TSL_UNAVAILABLE');
  assert.equal(result.diagnostic.certificateStatus.every(s => s.status === 'unavailable'), true); assert.equal(leafCount(), 0);
}, { ready: false }));

test('KIM TSL receive: original bytes, certificates and report flags are copied before asynchronous lookup', async () => fixture(async ({ open }) => {
  const releases = []; let arrive; const arrived = new Promise(r => { arrive = r; });
  state.handler = (req, res, _bytes, purpose) => {
    if (!req.url.startsWith('/leaf-')) return false;
    releases.push(() => { res.writeHead(200, { 'Content-Type': 'application/ocsp-response' }); res.end(f.proof(purpose === 'signing' ? signing.certificate : authentication.certificate).response); });
    if (releases.length === 2) arrive(); return true;
  };
  const mutable = { ...wire, bytes: Buffer.from(wire.bytes), expectedSignerCertificate: raw(signing.certificate), expectedAuthCertificate: raw(authentication.certificate) };
  const flags = { ...report, includeDecryptedOriginal: false }, pending = receive(open(), mutable, flags); await arrived;
  mutable.bytes.fill(0); mutable.expectedSignerCertificate.fill(0); mutable.expectedAuthCertificate.fill(0); flags.includeDecryptedOriginal = true;
  for (const release of releases) release(); const result = await pending;
  assert.equal(result.diagnostic.originalSha256, originalHash); assert.equal(result.diagnostic.decryptedOriginalAttached, false);
  assert.equal(result.diagnostic.certificateStatus.every(s => s.status === 'good'), true);
}));

test('KIM TSL receive: unprotected messages pass byte-exactly without status requests; abort is explicit', async () => fixture(async ({ open }) => {
  const bytes = Buffer.from('From: a@example.invalid\r\nTo: b@example.invalid\r\nSubject: Plain\r\n\r\nUnprotected\r\n'), c = open();
  const result = await receive(c, { ...wire, bytes }); assert.equal(result.kind, 'unprotected'); assert.deepEqual(result.bytes, bytes);
  await assert.rejects(receive(c, wire, report, AbortSignal.abort()), code('KIM_TSL_ABORTED')); assert.equal(leafCount(), 0);
}));

test('TSL OCSP: overlapping responder names are resolved by the signature of an already listed key', async () => {
  const services = [...defaults, { ...defaults.find(s => s.type === OCSP), certificate: raw(extraResponder.certificate).toString('base64') }];
  await fixture(async ({ open }) => {
    state.responder = extraResponder; const result = await check(open());
    assert.equal(result.responderSha256, hash(raw(extraResponder.certificate))); assert.equal(result.status, 'good');
  }, { services });
});

test('TSL OCSP: responder rollover never accepts a freshly fetched signature made by the removed key', async () => fixture(async ({ open, update, inspect }) => {
  const c = open(); await check(c);
  await update({ services: defaults.map(s => s.type === OCSP ? { ...s, certificate: raw(extraResponder.certificate).toString('base64') } : s) });
  // The endpoint still signs with the old key. Eviction permits a new fetch,
  // never an old-signature fallback or a success based only on a matching DN.
  await assert.rejects(check(c), code('KIM_OCSP_SIGNATURE')); assert.equal(leafCount(), 2);
  assert.equal(inspect(db => db.prepare('SELECT count(*) n FROM ocsp_evidence').get().n), 0);
}));

test('TSL OCSP: quotas apply across certificate roles sharing a route', async () => fixture(async ({ open }) => {
  const c = open({ maxEntriesPerRoute: 1 });
  const evidence = await c.messageEvidence({ signingCertificate: signing.certificate, authenticationCertificate: authentication.certificate });
  assert.equal(evidence.failures.length, 1); assert.equal(evidence.failures[0].code, 'KIM_OCSP_CACHE_CAPACITY'); assert.equal(leafCount(), 1);
}));

test('TSL OCSP: deadlines and client close prevent saving an unfinished query', async () => fixture(async ({ open, inspect }) => {
  let arrive = () => {};
  state.handler = req => { if (!req.url.startsWith('/leaf-')) return false; arrive(); return true; };
  const c = open({ timeoutMs: 1000 });
  await assert.rejects(check(c), code('KIM_OCSP_TIMEOUT'));
  const arrived = new Promise(r => { arrive = r; });
  const pending = check(c), rejected = assert.rejects(pending, statusError);
  await arrived; c.close(); await rejected; assert.equal(leafCount(), 2);
  assert.equal(inspect(db => db.prepare('SELECT count(*) n FROM ocsp_evidence').get().n), 0);
}));

test('TSL OCSP: legacy encrypted proof remains readable; same-name key replacement fails closed without its signer metadata', async () => fixture(async ({ open, inspect, key, update }) => {
  const first = open(); await check(first); first.close();
  // Reproduce the previous release's authenticated {request,response} payload.
  inspect(db => {
    const row = db.prepare('SELECT * FROM ocsp_evidence').get();
    const aad = `ocsp-v1:${row.scope}:${row.certificate_sha}:${row.produced_at}:${row.valid_until}:${row.octets}`;
    const vault = new Vault(key), clear = vault.open(row.content, aad);
    try {
      const { request, response } = JSON.parse(clear.toString());
      const legacy = Buffer.from(JSON.stringify({ request, response }));
      try { db.prepare('UPDATE ocsp_evidence SET content=? WHERE scope=? AND certificate_sha=?').run(vault.seal(legacy, aad), row.scope, row.certificate_sha); }
      finally { legacy.fill(0); }
    } finally { clear.fill(0); vault.close(); }
  });
  const c = open(); assert.equal((await check(c)).source, 'persistent-cache'); assert.equal(leafCount(), 1);
  await update({ services: defaults.map(s => s.type === OCSP ? { ...s, certificate: raw(extraResponder.certificate).toString('base64') } : s) });
  state.responder = extraResponder;
  await assert.rejects(check(c), code('KIM_OCSP_SIGNATURE')); assert.equal(leafCount(), 1);
  assert.equal(inspect(db => db.prepare('SELECT count(*) n FROM ocsp_evidence').get().n), 1);
}));

test('TSL OCSP: purpose is explicit and a signed certificate cannot be reused for another type', async () => fixture(async ({ open }) => {
  const c = open();
  for (const purpose of [undefined, 'toString', 'unknown']) {
    await assert.rejects(c.check({ certificate: signing.certificate, purpose }), code('KIM_TSL_CERT_TYPE_CONFIGURATION'));
  }
  await assert.rejects(c.check({ certificate: signing.certificate, purpose: 'authentication' }), code('KIM_TSL_CERT_TYPE_MISMATCH'));
  assert.equal(leafCount(), 0);
}));

test('TSL OCSP: removing CA type permission blocks cached proof; explicit restored permission permits revalidation', async () => fixture(async ({ open, update, manager }) => {
  const c = open(); await check(c); const handle = manager.current();
  await update({ services: defaults.map(s => s.type === CA ? { ...s, extensionOids: s.extensionOids.filter(o => o !== '1.2.276.0.76.4.78') } : s) });
  await assert.rejects(check(c), code('KIM_TSL_CERT_TYPE_CA_NOT_AUTHORIZED')); assert.equal(leafCount(), 1);
  assert.throws(() => handle.certificateTypeFor(signing.certificate, { policyList: ['1.2.276.0.76.4.78'] }), statusError);
  await update({ id: 'TSL_10003', sequence: 10003, services: defaults });
  assert.equal((await check(c)).source, 'persistent-cache'); assert.equal(leafCount(), 1);
}));

test('KIM TSL receive: missing AUT CA permission blocks both requests before network I/O', async () => fixture(async ({ open }) => {
  const result = await receive(open());
  assert.equal(result.kind, 'diagnostic'); assert.equal(result.statusAcquisition.state, 'unavailable');
  assert.equal(result.statusAcquisition.code, 'KIM_TSL_CERT_TYPE_CA_NOT_AUTHORIZED');
  assert.equal(result.diagnostic.certificateStatus.every(s => s.status === 'unavailable'), true);
  assert.equal(result.diagnostic.decryptedOriginalAttached, false); assert.equal(leafCount(), 0);
}, { services: defaults.map(s => s.type === CA ? { ...s, extensionOids: ['1.2.276.0.76.4.78'] } : s) }));

test('TSL OCSP: revoked type permission during an actual HTTP request leaves no cached success', async () => fixture(async ({ open, update, inspect }) => {
  let release, arrive; const arrived = new Promise(r => { arrive = r; });
  state.handler = (req, res) => {
    if (!req.url.startsWith('/leaf-')) return false;
    release = () => { res.writeHead(200, { 'Content-Type': 'application/ocsp-response' }); res.end(f.proof(signing.certificate).response); };
    arrive(); return true;
  };
  const c = open(), pending = assert.rejects(check(c), statusError); await arrived;
  await update({ services: defaults.map(s => s.type === CA ? { ...s, extensionOids: [] } : s) });
  release(); await pending;
  assert.equal(inspect(db => db.prepare('SELECT count(*) n FROM ocsp_evidence').get().n), 0);
  await assert.rejects(check(c), code('KIM_TSL_CERT_TYPE_CA_NOT_AUTHORIZED')); assert.equal(leafCount(), 1);
}));

test('TSL Admission: missing or wrong-family AUT attributes block both status requests', async () => fixture(async ({ open }) => {
  const c = open();
  for (const [encoded, expected] of [[undefined, 'MISSING'], [admissionDer({ telematikId: null }), 'TELEMATIK_ID'],
    [admissionDer({ professionOid: '1.2.276.0.76.4.234' }), 'ROLE_TYPE_MISMATCH']]) {
    const cert = withAdmission(authentication.certificate, encoded, rootKey);
    await assert.rejects(c.messageEvidence({ signingCertificate: signing.certificate, authenticationCertificate: cert }), code('KIM_TSL_ADMISSION_' + expected));
    assert.equal(leafCount(), 0);
  }
}));

test('TSL Admission: an older persisted good proof cannot bypass the new mandatory Admission gate', async () => fixture(async ({ open, options, path, key, clock, manager, inspect }) => {
  const c = open(), bad = withAdmission(signing.certificate, undefined, rootKey);
  const verifier = manager.current().ocspVerifierFor(bad);
  const cache = new DurableOcspStatusCache({ path, key, scopeId: options.routes[0].scopeId, verifier,
    transport: options.routes[0].transport, clock });
  state.handler = (req, res) => {
    if (!req.url.startsWith('/leaf-')) return false;
    res.writeHead(200, { 'Content-Type': 'application/ocsp-response' }); res.end(f.proof(bad).response); return true;
  };
  try { assert.equal((await cache.check({ certificate: bad })).status, 'good'); }
  finally { cache.close(); }
  assert.equal(leafCount(), 1); state.handler = undefined;
  assert.equal(inspect(db => db.prepare('SELECT count(*) n FROM ocsp_evidence').get().n), 1);
  await assert.rejects(c.check({ certificate: bad, purpose: 'signing' }), code('KIM_TSL_ADMISSION_MISSING'));
  assert.equal(leafCount(), 1);
}));

test('TSL Admission: refreshed manager invalidates old attribute readers as well as status verifiers', async () => fixture(async ({ manager, update }) => {
  const old = manager.current(), policyList = ['1.2.276.0.76.4.78'];
  assert.equal(old.certificateAdmissionFor(signing.certificate, { policyList }).admission.telematikId, '10-LOCAL-TEST');
  await update({});
  assert.throws(() => old.certificateAdmissionFor(signing.certificate, { policyList }), statusError);
  assert.equal(manager.current().certificateAdmissionFor(signing.certificate, { policyList }).identityStatus, 'unverified');
}));

test('TSL Admission: separate OSIG and AUT identities are exposed separately and never promoted to TI trust', async () => fixture(async ({ open }) => {
  const cert = withAdmission(authentication.certificate, admissionDer({ telematikId: '10-AUTH-OTHER' }), rootKey);
  state.handler = (req, res, _bytes, purpose) => {
    if (!req.url.startsWith('/leaf-') || purpose !== 'authentication') return false;
    res.writeHead(200, { 'Content-Type': 'application/ocsp-response' }); res.end(f.proof(cert).response); return true;
  };
  const result = await open().messageEvidence({ signingCertificate: signing.certificate, authenticationCertificate: cert });
  assert.equal(result.failures.length, 0); assert.equal(leafCount(), 2);
  assert.equal(result.certificateAdmissions.signing.telematikId, '10-LOCAL-TEST');
  assert.equal(result.certificateAdmissions.authentication.telematikId, '10-AUTH-OTHER');
  assert.equal(result.authentication.identityStatus, 'unverified'); assert.equal(result.signing.identityStatus, 'unverified');
}));

async function withDirectory(run, handler, changes = {}) {
  const d = await vzdFixture(f.pki, handler ?? (({ socket, address }) => {
    const cert = address === senderAddress ? encryption[0] : encryption[1];
    socket.write(Buffer.concat([entryReply(record(address, [cert.certificate])), searchDone()]));
  }), { tls: vzdTls, ...changes });
  try { await run(d); } finally { await d.close(); }
}
const resolveDirectory = (directory, client, changes = {}) => resolveVzdRecipients({ addresses: [senderAddress, receiverAddress], directory, statusClient: client, ...changes });
const receiveDirectory = (directory, client, changes = {}) => receiveEccKimMessageWithTsl({ ...wire, ...changes }, report, { directory, statusClient: client });
function directoryWire({ signingCertificate = signing.certificate, authCertificate = authentication.certificate, recipients } = {}) {
  return createEccKimMessage({ message: Buffer.from(`From: ${senderAddress}\r\nTo: ${receiverAddress}\r\nSubject: Local directory test\r\nMIME-Version: 1.0\r\nContent-Type: text/plain\r\n\r\nPRIVATE DIRECTORY TEST\r\n`),
    sender: senderAddress, envelopeRecipients: [receiverAddress],
    recipients: recipients ?? [{ address: senderAddress, certificate: encryption[0].certificate }, { address: receiverAddress, certificate: encryption[1].certificate }],
    signingCertificate, signingKey, authCertificate, authKey, ...report, now: f.now });
}

test('VZD + TSL: actual directory certificates and OCSP proofs feed a decryptable ECC message including key rollover', async () => fixture(async ({ open }) => withDirectory(async ({ directory }) => {
  const selection = await resolveDirectory(directory, open());
  assert.equal(selection.recipients.length, 3); assert.equal(selection.directoryEvidence.length, 2); assert.equal(selection.identityStatus, 'unverified');
  assert.equal(leafCount(), 4); selection.revalidate();
  const built = directoryWire({ recipients: selection.recipients });
  for (const c of [encryption[1], rollover]) {
    const opened = openEccKimMessage({ ...wire, bytes: built.bytes, recipientCertificate: c.certificate,
      privateKey: createPrivateKey({ key: await readFile(c.privateKeyPath), passphrase: f.pki.password }) });
    assert.match(opened.message.toString(), /PRIVATE DIRECTORY TEST/); assert.equal(opened.identityStatus, 'unverified'); opened.message.fill(0);
  }
}, ({ socket, address }) => socket.write(Buffer.concat([entryReply(record(address,
  (address === senderAddress ? [encryption[0]] : [encryption[1], rollover]).map(c => c.certificate))), searchDone()])))));

test('VZD + TSL: directory ID must exactly match each checked ENC certificate', async () => fixture(async ({ open }) => withDirectory(async ({ directory }) => {
  await assert.rejects(resolveDirectory(directory, open()), code('KIM_VZD_CERTIFICATE_IDENTITY'));
}, ({ socket, address }) => socket.write(Buffer.concat([entryReply(record(address, [encryption[0].certificate], { telematikId: '10-local-test' })), searchDone()])))));

test('VZD + TSL: a conflicting second ENC identity cannot hide behind a valid first certificate', async () => fixture(async ({ open }) => {
  const bad = withAdmission(rollover.certificate, admissionDer({ telematikId: '10-OTHER' }), rootKey);
  state.certificates = [{ certificate: bad }];
  await withDirectory(async ({ directory }) => assert.rejects(resolveDirectory(directory, open()), code('KIM_VZD_CERTIFICATE_IDENTITY')),
    ({ socket, address }) => socket.write(Buffer.concat([entryReply(record(address, [encryption[0].certificate, bad])), searchDone()])));
}));

for (const status of ['revoked', 'unknown']) test('VZD + TSL: ' + status + ' ENC certificate cannot become a message recipient', async () => fixture(async ({ open }) => {
  state.encryption = status;
  await withDirectory(async ({ directory }) => assert.rejects(resolveDirectory(directory, open()), code('KIM_VZD_CERTIFICATE_STATUS')));
}));

test('VZD + TSL: unsupported certificate type and non-DER directory bytes fail closed', async () => fixture(async ({ open }) => {
  await withDirectory(async ({ directory }) => assert.rejects(resolveDirectory(directory, open()), code('KIM_TSL_CERT_TYPE_MISMATCH')),
    ({ socket, address }) => socket.write(Buffer.concat([entryReply(record(address, [signing.certificate])), searchDone()])));
  assert.equal(leafCount(), 1);
  await withDirectory(async ({ directory }) => assert.rejects(resolveDirectory(directory, open()), code('KIM_VZD_CERTIFICATES')),
    ({ socket, address }) => {
      const a = record(address, [encryption[0].certificate]); a.at(-1)[1] = [Buffer.from(encryption[0].certificate)];
      socket.write(Buffer.concat([entryReply(a), searchDone()]));
    });
  assert.equal(leafCount(), 1); // The same validated server proof is reused across both sockets.
}));

test('VZD + TSL: a TSL refresh during later directory I/O invalidates earlier good ENC proofs', async () => fixture(async ({ open, manager }) => {
  await withDirectory(async ({ directory }) => assert.rejects(resolveDirectory(directory, open()), statusError),
    async ({ socket, address }) => {
      if (address === receiverAddress) await manager.refresh();
      socket.write(Buffer.concat([entryReply(record(address, [encryption[address === senderAddress ? 0 : 1].certificate])), searchDone()]));
    });
}));

test('VZD + TSL: returned selection cannot survive mutation or a later TSL change', async () => fixture(async ({ open, manager }) => withDirectory(async ({ directory }) => {
  const c = open(), a = await resolveDirectory(directory, c); a.recipients[0].certificate.fill(0);
  assert.throws(a.revalidate, code('KIM_VZD_CERTIFICATES'));
  const b = await resolveDirectory(directory, c); await manager.refresh(); assert.throws(b.revalidate, statusError);
})));

test('VZD + TSL: mismatched environment or invalid address set cannot trigger network traffic', async () => fixture(async ({ open }) => withDirectory(async ({ directory, options, requests }) => {
  const client = open();
  await assert.rejects(resolveDirectory(new VzdLdapsDirectory({ ...options, environment: 'production' }), client), code('KIM_VZD_CONFIGURATION'));
  for (const addresses of [[senderAddress, senderAddress.toUpperCase()], [senderAddress, receiverAddress.replace('-test', '')]]) {
    await assert.rejects(resolveDirectory(directory, client, { addresses }), e => ['KIM_VZD_ADDRESS', 'KIM_VZD_ENVIRONMENT'].includes(e?.code));
  }
  assert.equal(requests.length, 0); assert.equal(leafCount(), 0);
})));

test('KIM VZD receive: a matching signer/From binding remains diagnostic-only', async () => fixture(async ({ open }) => withDirectory(async ({ directory, requests }) => {
  const result = await receiveDirectory(directory, open());
  assert.equal(result.directoryAcquisition.state, 'matched'); assert.equal(result.directoryAcquisition.matchedBy, 'signing');
  assert.equal(result.directoryAcquisition.signingMatches, true); assert.equal(result.directoryAcquisition.authenticationMatches, undefined);
  assert.equal(result.authenticationAssessment.state, 'not-required');
  assert.deepEqual(state.calls.filter(c => c.path.startsWith('/leaf-')).map(c => c.purpose), ['signing', 'directory']);
  assert.equal(result.diagnostic.integrityResult, '07'); assert.equal(result.identityStatus, 'unverified'); assert.equal(result.deliveryStatus, 'diagnostic-only');
  assert.equal(result.diagnostic.decryptedOriginalAttached, false); assert.equal(requests.length, 2);
})));

test('KIM VZD receive: valid AUT can bind From independently of the OSIG identity', async () => fixture(async ({ open }) => {
  const changed = withAdmission(signing.certificate, admissionDer({ telematikId: '10-SEPARATE-SIGNER' }), rootKey);
  state.handler = (req, res, _bytes, purpose) => {
    if (!req.url.startsWith('/leaf-') || purpose !== 'signing') return false;
    res.writeHead(200, { 'Content-Type': 'application/ocsp-response' }); res.end(f.proof(changed).response); return true;
  };
  const message = directoryWire({ signingCertificate: changed });
  await withDirectory(async ({ directory }) => {
    const result = await receiveDirectory(directory, open(), { bytes: message.bytes, expectedSignerCertificate: changed });
    assert.equal(result.directoryAcquisition.state, 'matched'); assert.equal(result.directoryAcquisition.matchedBy, 'authentication');
    assert.equal(result.directoryAcquisition.signingMatches, false); assert.equal(result.diagnostic.integrityResult, '07');
  });
}));

test('KIM VZD receive: OSIG binding does not require identical AUT and OSIG Telematik IDs', async () => fixture(async ({ open }) => {
  const changed = withAdmission(authentication.certificate, admissionDer({ telematikId: '10-SEPARATE-AUT' }), rootKey);
  state.handler = (req, res, _bytes, purpose) => {
    if (!req.url.startsWith('/leaf-') || purpose !== 'authentication') return false;
    res.writeHead(200, { 'Content-Type': 'application/ocsp-response' }); res.end(f.proof(changed).response); return true;
  };
  const message = directoryWire({ authCertificate: changed });
  await withDirectory(async ({ directory }) => {
    const result = await receiveDirectory(directory, open(), { bytes: message.bytes, expectedAuthCertificate: changed });
    assert.equal(result.directoryAcquisition.matchedBy, 'signing'); assert.equal(result.directoryAcquisition.authenticationMatches, undefined);
    assert.equal(result.authenticationAssessment.state, 'not-required');
    assert.equal(state.calls.some(c => c.purpose === 'authentication'), false);
    assert.equal(result.diagnostic.integrityResult, '07');
  });
}));

test('KIM VZD receive: foreign or ambiguous directory binding yields a distinct bounded diagnostic', async () => fixture(async ({ open }) => {
  for (const ambiguous of [false, true]) await withDirectory(async ({ directory }) => {
    const result = await receiveDirectory(directory, open());
    assert.equal(result.directoryAcquisition.state, ambiguous ? 'unavailable' : 'mismatch');
    assert.equal(result.diagnostic.integrityResult, 'XCS_DIRECTORY'); assert.equal(result.identityStatus, 'unverified');
    assert.equal(result.diagnostic.decryptedOriginalAttached, false); assert.equal(result.bytes.includes('PRIVATE LOCAL STATUS TEST'), false);
  }, ({ socket, address }) => {
    const e = entryReply(record(address, [encryption[0].certificate], { telematikId: '10-OTHER' }));
    socket.write(Buffer.concat([e, ...(ambiguous ? [e] : []), searchDone()]));
  });
}));

test('KIM VZD receive: bad message cryptography or negative status prevents directory lookup', async () => fixture(async ({ open }) => withDirectory(async ({ directory, requests }) => {
  const client = open();
  const bad = await receiveDirectory(directory, client, { expectedSignerCertificate: authentication.certificate });
  assert.equal(bad.kind, 'diagnostic'); assert.equal(bad.directoryAcquisition, undefined); assert.equal(leafCount(), 0);
  state.signing = 'revoked'; const rejected = await receiveDirectory(directory, client);
  assert.equal(rejected.directoryAcquisition.state, 'not-checked'); assert.equal(rejected.diagnostic.integrityResult, 'XCS_CERT_STATUS');
  assert.equal(requests.length, 0);
})));

test('KIM VZD receive: a TSL change during directory lookup defeats previously good sender status', async () => fixture(async ({ open, manager }) => withDirectory(async ({ directory }) => {
  const result = await receiveDirectory(directory, open());
  assert.equal(result.diagnostic.integrityResult, 'XCS_CERT_STATUS');
  assert.ok(result.diagnostic.certificateStatus.every(s => s.status === 'unavailable')); assert.equal(result.deliveryStatus, 'diagnostic-only');
}, async ({ socket, address }) => {
  await manager.refresh(); socket.write(Buffer.concat([entryReply(record(address, [encryption[0].certificate])), searchDone()]));
})));

const lookupServer = (directory, client, signal) => directory.lookup(senderAddress, { serverStatusClient: client, signal });

const isCards = bytes => bytes.includes('<c:GetCards');
const isReadCards = bytes => bytes.includes('<c:ReadCardCertificate');
const smcbCertificates = () => [['C.AUT', authentication.certificate], ['C.ENC', encryption[0].certificate], ['C.SIG', signing.certificate]];
const smcbReply = ({ response, bytes }) => cardsReply(response, isCards(bytes) ? cardsResponse()
  : isReadCards(bytes) ? certificatesResponse(smcbCertificates()) : verificationResponse());
async function withSmcb(run, handler = smcbReply, changes = {}) {
  await withConnector(async ({ open, options, requests }) => run({ connector: open({ eventServiceUrl: eventUrl(options), ...changes }), requests }), handler);
}
const readSmcb = (connector, statusClient, changes = {}) => readAndVerifySmcb({ connector, statusClient,
  expectedTelematikId: '10-LOCAL-TEST', requiredRoles: ['1.2.276.0.76.4.245'], ...changes });

const attemptedPin = event => event.requests.some(q => isVerifyPin(q.bytes));
const pinSmcbReply = event => isPinStatus(event.bytes) ? cardsReply(event.response, attemptedPin(event)
  ? pinResponse() : pinResponse('GetPinStatus', 'VERIFIABLE', 3))
  : isVerifyPin(event.bytes) ? cardsReply(event.response, pinResponse('VerifyPin', 'OK')) : smcbReply(event);
async function withSmcbPin(run, handler = pinSmcbReply, changes = {}) {
  await withConnector(async ({ open, options, requests }) => run({ connector: open({ eventServiceUrl: eventUrl(options),
    cardServiceUrl: cardUrl(options), clock: () => state.now, ...changes }), requests }), handler);
}
const preparePin = (connector, statusClient, changes = {}) => prepareSmcbPin({ connector, statusClient,
  expectedTelematikId: '10-LOCAL-TEST', requiredRoles: ['1.2.276.0.76.4.245'], ...changes });

const authInput = Buffer.from('institution authentication challenge, synthetic local test');
const authenticated = event => event.requests.some(q => isAuthenticate(q.bytes));
const authSmcbReply = async event => isAuthenticate(event.bytes)
  ? cardsReply(event.response, authResponse(await signAuthRequest(event.bytes, authentication, f.pki)))
  : isPinStatus(event.bytes) ? cardsReply(event.response, pinResponse()) : smcbReply(event);
async function withSmcbAuth(run, handler = authSmcbReply) {
  await withConnector(async ({ open, options, requests }) => run({ connector: open({ eventServiceUrl: eventUrl(options),
    cardServiceUrl: cardUrl(options), authSignatureServiceUrl: authUrl(options), clock: () => state.now }), requests }), handler);
}
const authenticate = (connector, statusClient, prepared, changes = {}) => signSmcbAuthentication({ connector, statusClient, prepared, data: authInput, ...changes });

async function withCms(run, transform, changeReply) {
  const encryptionKey = createPrivateKey({ key: await readFile(encryption[0].privateKeyPath), passphrase: f.pki.password });
  const reply = makeCmsReply({ signingCertificate: signing.certificate, signingKey, encryptionKey, now: Date.now, transform });
  await withConnector(async ({ open, options, requests }) => run({ connector: open({ eventServiceUrl: eventUrl(options),
    cardServiceUrl: cardUrl(options), ...cmsUrls(options), clock: Date.now }), requests }), event => {
      const result = reply(event.bytes);
      if (changeReply?.(event, result)) return;
      return result ? cardsReply(event.response, result) : authSmcbReply(event);
    });
}
const cmsProbe = (connector, statusClient, changes = {}) => probeSmcbCms({ connector, statusClient,
  expectedTelematikId: '10-LOCAL-TEST', requiredRoles: ['1.2.276.0.76.4.245'], address: senderAddress, ...changes });

const cardReceiveInput = changes => ({ bytes: wire.bytes, address: senderAddress, expectedSignerCertificate: signing.certificate,
  expectedAuthCertificate: authentication.certificate, now: f.now, ...changes });
const receiveCard = (connector, statusClient, directory, changes = {}, reportChanges = {}, configChanges = {}) => receiveEccKimMessageWithTsl(cardReceiveInput(changes),
  { ...report, ...reportChanges }, { connector, statusClient, directory,
    card: { expectedTelematikId: '10-LOCAL-TEST', requiredRoles: ['1.2.276.0.76.4.245'] }, ...configChanges });

test('KIM card receive: original wire traverses real mTLS decryption, VerifyDocument, directory and fresh card recheck', async () => fixture(async ({ open }) => withCms(async ({ connector, requests }) => withDirectory(async ({ directory }) => {
  const result = await receiveCard(connector, open(), directory);
  assert.equal(result.cardAcquisition.state, 'checked', JSON.stringify(result.cardAcquisition));
  assert.equal(result.diagnostic.integrityResult, '07'); assert.equal(result.diagnostic.decryptionResult, '00');
  assert.equal(result.directoryAcquisition.state, 'matched'); assert.equal(result.authenticationAssessment.state, 'not-required');
  assert.equal(result.cardAcquisition.documentVerification.verificationResult, 'VALID');
  assert.equal(result.originalSha256, originalHash); assert.equal(result.deliveryStatus, 'diagnostic-only');
  assert.equal(result.cardAcquisition.hardwareEvidence, 'not-attested'); assert.equal(result.cardAcquisition.tiEvidence, 'not-attested');
  assert.deepEqual(requests.map(q => cmsOperation(q.bytes)).filter(Boolean), ['DecryptDocument', 'VerifyDocument']);
  assert.equal(requests.filter(q => isCards(q.bytes)).length, 4); assert.equal(requests.filter(q => isPinStatus(q.bytes)).length, 2);
  assert.equal(requests.some(q => isVerifyPin(q.bytes) || isAuthenticate(q.bytes)), false);
  assert.equal(result.bytes.includes('PRIVATE LOCAL STATUS TEST'), false);
  assert.equal(JSON.stringify(result.cardAcquisition).includes('SMCB-1'), false);
}))));

function cardReportParts(bytes) {
  const message = readMessage(bytes), boundary = parseContentType(message.one('content-type')).params.get('boundary');
  return message.body.toString('latin1').split('--' + boundary + '\r\n').slice(1).map(s => {
    const part = readMessage(Buffer.from(s.slice(0, s.indexOf('\r\n--') < 0 ? -2 : s.indexOf('\r\n--')), 'latin1'));
    return { type: parseContentType(part.one('content-type')).type, bytes: part.one('content-transfer-encoding') === 'base64' ? decodedBase64(part.body) : part.body };
  });
}
for (const result of ['INVALID', 'INCONCLUSIVE', 'INCONSISTENT']) test('KIM card receive: ' + result + ' attaches the actual bound XML without delivery or directory lookup', async () => fixture(async ({ open }) => withCms(async ({ connector, requests }) => withDirectory(async ({ directory, requests: ldap }) => {
  const r = await receiveCard(connector, open(), directory);
  assert.equal(r.diagnostic.integrityResult, 'XCS_DOCUMENT'); assert.equal(r.cardAcquisition.state, 'rejected');
  assert.equal(r.cardAcquisition.code, 'KIM_CONNECTOR_CMS_VERIFY_' + result); assert.equal(ldap.length, 0);
  assert.equal(r.diagnostic.externalReportSha256, undefined); assert.equal(r.diagnostic.decryptedOriginalAttached, false);
  const parts = cardReportParts(r.bytes), xml = parts.filter(p => p.type === 'application/xml');
  assert.equal(xml.length, 1); assert.equal(hash(xml[0].bytes), r.diagnostic.connectorReportSha256);
  assert.equal(r.diagnostic.connectorVerification.reportSha256, r.diagnostic.connectorReportSha256);
  assert.equal(r.diagnostic.connectorVerification.operation, 'VerifyDocument');
  assert.equal(xml[0].bytes.includes('PRIVATE SUBJECT'), true); assert.equal(xml[0].bytes.includes('Envelope'), false);
  assert.equal(r.bytes.includes('PRIVATE LOCAL STATUS TEST'), false); assert.equal(r.deliveryStatus, 'diagnostic-only');
  assert.equal(requests.filter(q => cmsOperation(q.bytes) === 'VerifyDocument').length, 1);
}), undefined, (event, xml) => {
  if (cmsOperation(event.bytes) !== 'VerifyDocument') return false;
  cardsReply(event.response, result === 'INCONSISTENT' ? xml.replace('detail:valid', 'detail:invalid')
    : xml.replace('<c:HighLevelResult>VALID', '<c:HighLevelResult>' + result)); return true;
})));
for (const [label, changed] of [
  ['foreign signature', bytes => cmsVerificationReply(bytes, { high: 'INVALID', signature: Buffer.alloc(70, 1) })],
  ['foreign certificate', bytes => cmsVerificationReply(bytes, { high: 'INVALID', certificate: raw(encryption[0].certificate) })],
  ['stale time', bytes => cmsVerificationReply(bytes, { high: 'INVALID', now: Date.now() - 60000 })],
  ['missing report', bytes => cmsVerificationReply(bytes, { high: 'INVALID' }).replace(/<c:OptionalOutputs>[\s\S]*<\/c:OptionalOutputs>/, '')],
]) test('KIM card receive: ' + label + ' cannot attach a report or fall back to local signature success', async () => fixture(async ({ open }) => withCms(async ({ connector }) => withDirectory(async ({ directory, requests }) => {
  const r = await receiveCard(connector, open(), directory);
  assert.equal(r.diagnostic.integrityResult, 'XCS_DOCUMENT'); assert.equal(r.cardAcquisition.state, 'rejected');
  assert.equal(r.diagnostic.connectorReportSha256, undefined); assert.equal(requests.length, 0);
  assert.equal(cardReportParts(r.bytes).some(p => p.type === 'application/xml'), false);
}), undefined, event => {
  if (cmsOperation(event.bytes) !== 'VerifyDocument') return false;
  cardsReply(event.response, changed(event.bytes)); return true;
})));
test('KIM card receive: explicit original attachment is byte-exact and only this diagnostic owns it', async () => fixture(async ({ open }) => withCms(async ({ connector }) => withDirectory(async ({ directory }) => {
  const original = openEccKimMessage(wire).message;
  try {
    const r = await receiveCard(connector, open(), directory, {}, { includeDecryptedOriginal: true });
    const attached = cardReportParts(r.bytes).filter(p => p.type === 'message/rfc822');
    assert.equal(attached.length, 1); assert.deepEqual(attached[0].bytes, original);
    assert.equal(r.diagnostic.decryptedOriginalAttached, true); assert.equal(r.deliveryStatus, 'diagnostic-only');
  } finally { original.fill(0); }
}))));
for (const address of [receiverAddress, 'other@local.kim.telematik-test']) test('KIM card receive: ' + address + ' cannot use another mailbox card key', async () => fixture(async ({ open }) => withCms(async ({ connector, requests }) => withDirectory(async ({ directory, requests: ldap }) => {
  const r = await receiveCard(connector, open(), directory, { address });
  assert.equal(r.cardAcquisition.state, 'rejected'); assert.equal(r.diagnostic.decryptedOriginalAttached, false);
  assert.equal(requests.some(q => cmsOperation(q.bytes)), false); assert.equal(ldap.length, 0);
  assert.equal(cardReportParts(r.bytes).find(p => p.type === 'message/rfc822').bytes.equals(wire.bytes), true);
}))));
for (const [label, changes, reportChanges, configChanges] of [
  ['software key', () => ({ privateKey: wire.privateKey }), {}, {}],
  ['caller card result', () => ({ cardAcquisition: { state: 'checked' } }), {}, {}],
  ['external XML report', () => ({}), { verificationReport: { bytes: Buffer.from('<report/>'), sourceSha256: '0'.repeat(64) } }, {}],
  ['implicit PIN prompt', () => ({}), {}, { card: { allowPrompt: true } }],
  ['missing directory', () => ({}), {}, { directory: undefined }],
]) test('KIM card receive: rejects ' + label + ' before any connector I/O', async () => fixture(async ({ open }) => withCms(async ({ connector, requests }) => withDirectory(async ({ directory }) => {
  await assert.rejects(receiveCard(connector, open(), directory, changes(), reportChanges, configChanges), /KIM_(CONNECTOR|TSL)_/);
  assert.equal(requests.length, 0); assert.equal(leafCount(), 0);
}))));
test('KIM card receive: non-KIM original passes unchanged without card access', async () => fixture(async ({ open }) => withCms(async ({ connector, requests }) => withDirectory(async ({ directory }) => {
  const bytes = Buffer.from('From: ordinary@example.test\r\nSubject: Plain original\r\n\r\nunchanged\r\n');
  const r = await receiveCard(connector, open(), directory, { bytes });
  assert.equal(r.kind, 'unprotected'); assert.deepEqual(r.bytes, bytes); assert.equal(requests.length, 0);
}))));
test('KIM card receive: protected header mismatch stops before document and directory checks', async () => fixture(async ({ open }) => withCms(async ({ connector, requests }) => withDirectory(async ({ directory, requests: ldap }) => {
  const bytes = Buffer.from(wire.bytes.toString().replace('From: ' + senderAddress, 'From: ' + receiverAddress));
  const r = await receiveCard(connector, open(), directory, { bytes }, { includeDecryptedOriginal: true });
  assert.equal(r.diagnostic.integrityResult, 'XCS_HEADER'); assert.equal(r.diagnostic.decryptedOriginalAttached, false);
  assert.deepEqual(requests.map(q => cmsOperation(q.bytes)).filter(Boolean), ['DecryptDocument']); assert.equal(ldap.length, 0);
}))));
for (const high of ['VALID', 'INVALID']) test('KIM card receive: ' + high + ' report overflow fails explicitly instead of dropping requested evidence', async () => fixture(async ({ open }) => withCms(async ({ connector }) => withDirectory(async ({ directory }) => {
  const source = openEccKimMessage(wire).message, parsed = readMessage(replaceDirectoryAuth(source, []));
  const headers = parsed.headers.map(h => h.raw), count = headers.join('\r\n').split('\r\n').length;
  const inner = Buffer.concat([Buffer.from([...headers, ...Array.from({ length: 500 - count }, (_, i) => `X-Local-${i}: preserved`)].join('\r\n') + '\r\n\r\n'), parsed.body]);
  try {
    readMessage(inner);
    const cms = sealEccKimPayload({ message: inner, sender: senderAddress,
      recipients: [{ address: senderAddress, certificate: encryption[0].certificate }, { address: receiverAddress, certificate: encryption[1].certificate }],
      signingCertificate: signing.certificate, signingKey, now: f.now });
    const outer = readMessage(replaceDirectoryAuth(wire.bytes, []));
    const bytes = Buffer.concat([Buffer.from(outer.headers.map(h => h.raw).join('\r\n') + '\r\n\r\n'),
      Buffer.from(cms.toString('base64').match(/.{1,76}/g).join('\r\n') + '\r\n')]);
    await assert.rejects(receiveCard(connector, open(), directory, { bytes }, { includeDecryptedOriginal: true }), /KIM_RECEIVE_REPORT_LIMIT/);
  } finally { inner.fill(0); source.fill(0); parsed.body.fill(0); }
}), undefined, (event, xml) => {
  if (cmsOperation(event.bytes) !== 'VerifyDocument' || high === 'VALID') return false;
  cardsReply(event.response, xml.replace('<c:HighLevelResult>VALID', '<c:HighLevelResult>INVALID')); return true;
})));
test('KIM card receive: PIN-required state never silently prompts or decrypts', async () => fixture(async ({ open }) => withCms(async ({ connector, requests }) => withDirectory(async ({ directory }) => {
  const r = await receiveCard(connector, open(), directory);
  assert.equal(r.cardAcquisition.code, 'KIM_CONNECTOR_PIN_NOT_VERIFIED');
  assert.equal(requests.some(q => cmsOperation(q.bytes) || isVerifyPin(q.bytes)), false);
}), undefined, event => { if (!isPinStatus(event.bytes)) return false;
  cardsReply(event.response, pinResponse('GetPinStatus', 'VERIFIABLE', 3)); return true;
})));
test('KIM card receive: altered decryption is held without a software-key fallback or automatic retry', async () => fixture(async ({ open }) => withCms(async ({ connector, requests }) => withDirectory(async ({ directory }) => {
  const r = await receiveCard(connector, open(), directory, {}, { includeDecryptedOriginal: true });
  assert.equal(r.cardAcquisition.state, 'rejected'); assert.equal(r.diagnostic.decryptedOriginalAttached, false);
  const again = await receiveCard(connector, open(), directory);
  assert.equal(again.cardAcquisition.code, 'KIM_CONNECTOR_CMS_OUTCOME_UNKNOWN');
  assert.deepEqual(requests.map(q => cmsOperation(q.bytes)).filter(Boolean), ['DecryptDocument']);
}), (bytes, operation) => { if (operation !== 'DecryptDocument') return bytes; const copy = Buffer.from(bytes); copy[copy.length - 1] ^= 1; return copy; })));
test('KIM card receive: card removal after VerifyDocument invalidates final status', async () => fixture(async ({ open }) => withCms(async ({ connector, requests }) => withDirectory(async ({ directory }) => {
  const r = await receiveCard(connector, open(), directory);
  assert.equal(r.cardAcquisition.state, 'rejected'); assert.equal(r.cardAcquisition.stage, 'card-recheck');
  assert.equal(r.diagnostic.integrityResult, 'XCS_CARD_STATUS'); assert.equal(r.deliveryStatus, 'diagnostic-only');
  assert.equal(requests.filter(q => cmsOperation(q.bytes) === 'DecryptDocument').length, 1);
}), undefined, event => { if (!isCards(event.bytes) || !event.requests.some(q => cmsOperation(q.bytes) === 'VerifyDocument')) return false;
  cardsReply(event.response, cardsResponse([])); return true;
})));
test('KIM card receive: caller mutation cannot change the original or card selector after the first await', async () => fixture(async ({ open }) => withCms(async ({ connector }) => withDirectory(async ({ directory }) => {
  const input = cardReceiveInput({ bytes: Buffer.from(wire.bytes), expectedSignerCertificate: Buffer.from(raw(signing.certificate)) });
  const card = { expectedTelematikId: '10-LOCAL-TEST', requiredRoles: ['1.2.276.0.76.4.245'] };
  const work = receiveEccKimMessageWithTsl(input, report, { connector, statusClient: open(), directory, card });
  input.bytes.fill(0); input.expectedSignerCertificate.fill(0); input.address = receiverAddress; card.requiredRoles[0] = '1.2.3';
  const r = await work; assert.equal(r.originalSha256, originalHash); assert.equal(r.cardAcquisition.state, 'checked', JSON.stringify(r.cardAcquisition));
}))));
test('KIM card receive: concurrent calls and pre-aborted signals cannot duplicate a decryption', async () => fixture(async ({ open }) => withCms(async ({ connector, requests }) => withDirectory(async ({ directory }) => {
  await assert.rejects(receiveCard(connector, open(), directory, {}, {}, { signal: AbortSignal.abort() }), /ABORTED/);
  assert.equal(requests.length, 0);
  const work = receiveCard(connector, open(), directory);
  await assert.rejects(receiveCard(connector, open(), directory), /CMS_BUSY/);
  assert.equal((await work).cardAcquisition.state, 'checked');
  assert.equal(requests.filter(q => cmsOperation(q.bytes) === 'DecryptDocument').length, 1);
}))));

test('KIM card receive: the actual AUT leaf can bind a different signing identity', async () => fixture(async ({ open }) => {
  state.certificates = [remoteSigning];
  const changed = remoteSigning.certificate, bytes = directoryAutWire({ signingCertificate: changed, key: remoteSigningKey });
  await withCms(async ({ connector }) => withDirectory(async ({ directory }) => {
    const r = await receiveCard(connector, open(), directory, { bytes, expectedSignerCertificate: changed, expectedAuthCertificate: undefined });
    assert.equal(r.cardAcquisition.state, 'checked', JSON.stringify(r.cardAcquisition)); assert.equal(r.diagnostic.integrityResult, '07');
    assert.equal(r.directoryAcquisition.matchedBy, 'authentication'); assert.equal(r.authenticationAssessment.state, 'checked');
  }));
}));
test('KIM card receive: missing required AUT never becomes a successful identity binding', async () => fixture(async ({ open }) => {
  state.certificates = [remoteSigning];
  const changed = remoteSigning.certificate, bytes = directoryAutWire({ signingCertificate: changed, key: remoteSigningKey, innerAuth: [] });
  await withCms(async ({ connector }) => withDirectory(async ({ directory }) => {
    const r = await receiveCard(connector, open(), directory, { bytes, expectedSignerCertificate: changed, expectedAuthCertificate: undefined });
    assert.equal(r.diagnostic.integrityResult, '10', JSON.stringify(r.cardAcquisition)); assert.equal(r.authenticationAssessment.state, 'rejected');
    assert.equal(r.directoryAcquisition.state, 'mismatch'); assert.equal(r.deliveryStatus, 'diagnostic-only');
  }));
}));
test('KIM card receive: matching signing identity does not require an AUT token', async () => fixture(async ({ open }) => withCms(async ({ connector }) => withDirectory(async ({ directory }) => {
  const r = await receiveCard(connector, open(), directory, { bytes: directoryAutWire({ innerAuth: [] }), expectedAuthCertificate: undefined });
  assert.equal(r.cardAcquisition.state, 'checked'); assert.equal(r.authenticationAssessment.state, 'not-required');
  assert.equal(r.diagnostic.integrityResult, '07');
}))));
test('KIM card receive: revoked remote signer stops document verification and LDAP despite a healthy recipient card', async () => fixture(async ({ open }) => {
  state.certificates = [remoteSigning];
  const bytes = directoryAutWire({ signingCertificate: remoteSigning.certificate, key: remoteSigningKey });
  state.handler = (req, res, request) => {
    if (!request.equals(f.proof(remoteSigning.certificate).request)) return false;
    res.writeHead(200, { 'Content-Type': 'application/ocsp-response' }); res.end(f.proof(remoteSigning.certificate, { state: 'revoked' }).response); return true;
  };
  await withCms(async ({ connector, requests }) => withDirectory(async ({ directory, requests: ldap }) => {
    const r = await receiveCard(connector, open(), directory, { bytes, expectedSignerCertificate: remoteSigning.certificate });
    assert.equal(r.diagnostic.integrityResult, 'XCS_CERT_STATUS'); assert.equal(r.cardAcquisition.state, 'rejected');
    assert.deepEqual(requests.map(q => cmsOperation(q.bytes)).filter(Boolean), ['DecryptDocument']); assert.equal(ldap.length, 0);
  }));
}));
test('KIM card receive: cancellation during decryption exposes no result or XML and never retries', async () => fixture(async ({ open }) => {
  const controller = new AbortController();
  await withCms(async ({ connector, requests }) => withDirectory(async ({ directory }) => {
    await assert.rejects(receiveCard(connector, open(), directory, {}, {}, { signal: controller.signal }), /ABORTED/);
    assert.deepEqual(requests.map(q => cmsOperation(q.bytes)).filter(Boolean), ['DecryptDocument']);
  }), undefined, event => { if (cmsOperation(event.bytes) === 'DecryptDocument') controller.abort(); return false; });
}));
test('KIM card receive: cancellation during LDAP prevents a final report or another card operation', async () => fixture(async ({ open }) => {
  const controller = new AbortController();
  await withCms(async ({ connector, requests }) => withDirectory(async ({ directory }) => {
    await assert.rejects(receiveCard(connector, open(), directory, {}, {}, { signal: controller.signal }), /ABORTED/);
    assert.equal(requests.filter(q => isCards(q.bytes)).length, 2);
  }, ({ socket, address }) => { controller.abort(); socket.write(Buffer.concat([entryReply(record(address, [encryption[0].certificate])), searchDone()])); }));
}));
test('KIM card receive: TSL change during LDAP invalidates previously acquired status proofs', async () => fixture(async ({ open, manager }) => withCms(async ({ connector }) => withDirectory(async ({ directory }) => {
  const r = await receiveCard(connector, open(), directory);
  assert.equal(r.cardAcquisition.state, 'rejected'); assert.notEqual(r.diagnostic.integrityResult, '07');
  assert.equal(r.deliveryStatus, 'diagnostic-only');
}, async ({ socket, address }) => { await manager.refresh(); socket.write(Buffer.concat([entryReply(record(address, [encryption[0].certificate])), searchDone()])); }))));
test('KIM card receive: changing the card handle after document verification cannot reuse its prior result', async () => fixture(async ({ open }) => withCms(async ({ connector }) => withDirectory(async ({ directory }) => {
  const r = await receiveCard(connector, open(), directory);
  assert.equal(r.cardAcquisition.state, 'rejected'); assert.equal(r.cardAcquisition.code, 'KIM_CONNECTOR_CARD_CHANGED');
  assert.equal(r.diagnostic.integrityResult, 'XCS_CARD_STATUS');
}), undefined, event => {
  if (!isCards(event.bytes) || !event.requests.some(q => cmsOperation(q.bytes) === 'VerifyDocument')) return false;
  cardsReply(event.response, cardsResponse([cardData({ cardHandle: 'SMCB-OTHER' })])); return true;
})));

test('SMC-B CMS workflow: complete mTLS sign/encrypt/card decrypt roundtrip with five fresh preflights', async () => fixture(async ({ open }) => withCms(async ({ connector, requests }) => {
  const result = await cmsProbe(connector, open());
  assert.equal(result.state, 'passed'); assert.equal(result.hardwareEvidence, 'not-attested'); assert.equal(result.tiEvidence, 'not-attested');
  assert.equal(result.deliveryStatus, 'held-for-trust-validation');
  assert.deepEqual(result.transcript.map(t => t.operation), ['GetJobNumber', 'SignDocument', 'EncryptDocument', 'DecryptDocument', 'VerifyDocument']);
  assert.equal(requests.filter(q => isCards(q.bytes)).length, 10);
  assert.equal(requests.filter(q => isPinStatus(q.bytes)).length, 5);
  assert.equal(requests.some(q => isVerifyPin(q.bytes)), false);
  const decrypt = requests.find(q => cmsOperation(q.bytes) === 'DecryptDocument');
  assert.equal(decrypt.headers.soapaction, '"http://ws.gematik.de/conn/crypt/EncryptionService/v6.1#DecryptDocument"');
  assert.equal(decrypt.bytes.includes('<c:Crypt>'), false);
  const json = JSON.stringify(result);
  for (const secret of ['PRIVATE', 'SMCB-1', '80276000000000000001', senderAddress, 'BEGIN CERTIFICATE']) assert.equal(json.includes(secret), false);
})));
for (const operation of ['SignDocument', 'EncryptDocument', 'DecryptDocument']) {
  test('SMC-B CMS workflow: altered ' + operation + ' is held and latches uncertain key outcome', async () => fixture(async ({ open }) => withCms(async ({ connector, requests }) => {
    await assert.rejects(cmsProbe(connector, open()), /KIM_CONNECTOR_CMS_/);
    assert.equal(requests.filter(q => cmsOperation(q.bytes) === operation).length, 1);
    await assert.rejects(cmsProbe(connector, open()), /KIM_CONNECTOR_CMS_OUTCOME_UNKNOWN/);
  }, (bytes, op) => { if (op !== operation) return bytes; const changed = Buffer.from(bytes); changed[changed.length - 1] ^= 1; return changed; })));
}
test('SMC-B CMS workflow: forged prepared results are not accepted and no PIN is silently prompted', async () => fixture(async ({ open }) => withCms(async ({ connector, requests }) => {
  await assert.rejects(cmsProbe(connector, open(), { prepared: {} }), /KIM_CONNECTOR_INPUT/);
  await assert.rejects(cmsProbe(connector, open()), /KIM_CONNECTOR_PIN_NOT_VERIFIED/);
  assert.equal(requests.some(q => cmsOperation(q.bytes) || isVerifyPin(q.bytes)), false);
}, undefined, event => { if (!isPinStatus(event.bytes)) return false; cardsReply(event.response, pinResponse('GetPinStatus', 'VERIFIABLE', 3)); return true; })));
test('SMC-B CMS workflow: card removal after signature blocks encryption', async () => fixture(async ({ open }) => withCms(async ({ connector, requests }) => {
  await assert.rejects(cmsProbe(connector, open()), /KIM_CONNECTOR_CARD_/);
  assert.equal(requests.some(q => cmsOperation(q.bytes) === 'EncryptDocument'), false);
}, undefined, event => { if (isCards(event.bytes) && event.requests.some(q => cmsOperation(q.bytes) === 'SignDocument')) {
  cardsReply(event.response, cardsResponse([])); return true;
} return false; })));
test('SMC-B CMS workflow: wrong SOAP request correlation cannot release a valid signature', async () => fixture(async ({ open }) => withCms(async ({ connector, requests }) => {
  await assert.rejects(cmsProbe(connector, open()), /KIM_CONNECTOR_CMS_BINDING/);
  assert.equal(requests.some(q => cmsOperation(q.bytes) === 'EncryptDocument'), false);
}, undefined, (event, result) => { if (cmsOperation(event.bytes) !== 'SignDocument') return false;
  cardsReply(event.response, result.replace(/RequestID="[^"]+"/, 'RequestID="another-request"')); return true;
})));

test('SMC-B CMS workflow: inconclusive document verification prevents a passed report without automatic retry', async () => fixture(async ({ open }) => withCms(async ({ connector, requests }) => {
  await assert.rejects(cmsProbe(connector, open()), /KIM_CONNECTOR_CMS_VERIFY_INCONCLUSIVE/);
  assert.equal(requests.filter(q => cmsOperation(q.bytes) === 'VerifyDocument').length, 1);
}, undefined, (event, result) => {
  if (cmsOperation(event.bytes) !== 'VerifyDocument') return false;
  cardsReply(event.response, result.replace('<c:HighLevelResult>VALID', '<c:HighLevelResult>INCONCLUSIVE')); return true;
})));
test('SMC-B CMS workflow: final card removal invalidates an otherwise valid document report', async () => fixture(async ({ open }) => withCms(async ({ connector, requests }) => {
  await assert.rejects(cmsProbe(connector, open()), /KIM_CONNECTOR_CARD_/);
  assert.equal(requests.filter(q => cmsOperation(q.bytes) === 'VerifyDocument').length, 1);
}, undefined, event => {
  if (!isCards(event.bytes) || !event.requests.some(q => cmsOperation(q.bytes) === 'VerifyDocument')) return false;
  cardsReply(event.response, cardsResponse([])); return true;
})));

async function withReceiveHost(run, changes = {}) {
  await fixture(async ({ open, path }) => withCms(async ({ connector, requests }) => withDirectory(async ({ directory }) => {
    const tenantId = randomUUID(), mailboxId = randomUUID(), key = randomBytes(32), inboxPath = join(dirname(path), 'receive-inbox.db');
    const inbox = new ReceiptInbox({ path: inboxPath, key: randomBytes(32) }), hosts = [];
    inbox.bindMailbox({ tenantId, mailboxId, host: 'localhost.test', port: 995, servername: 'localhost.test', username: senderAddress });
    const original = inbox.record({ tenantId, mailboxId, uid: 'persisted-wire', bytes: changes.bytes ?? wire.bytes });
    const storePath = join(dirname(path), 'receive-host.db'), config = { tenantId, storePath,
      probe: { connector, statusClient: open(), expectedTelematikId: '10-LOCAL-TEST', requiredRoles: ['1.2.276.0.76.4.245'], address: senderAddress },
      receive: { inbox, key, mailboxId, address: senderAddress, directory, ...report, ...changes.limits } };
    const create = options => { const host = new KimDiagnosticHost({ ...config, ...options }); hosts.push(host); return host; };
    const input = { requestId: randomUUID(), messageId: original.id, originalSha256: original.sha256, expectedSignerCertificate: Buffer.from(raw(signing.certificate)),
      expectedAuthCertificate: Buffer.from(raw(authentication.certificate)) };
    try { await run({ host: create(), create, config, input, inbox, inboxPath, original, tenantId, mailboxId, requests, connector }); }
    finally { for (const h of hosts) await h.close(); inbox.close(); key.fill(0); }
  }), changes.transform, changes.changeReply));
}
async function waitReceive(host, tenant, requestId) {
  const deadline = Date.now() + 30000;
  let status;
  do { await new Promise(r => setTimeout(r, 50)); status = host.receiveStatus(tenant, requestId); }
  while (status.state === 'running' && Date.now() < deadline);
  assert.notEqual(status.state, 'running', 'receive job must settle');
  return readKimReceiveStatus(status, tenant, requestId);
}
function ageReceive(storePath) {
  const db = new DatabaseSync(storePath);
  try { db.exec('UPDATE kim_receive_jobs SET created=created-31000,started=started-31000'); }
  finally { db.close(); }
}

test('KIM receive host: gateway mTLS, persisted original, bound result, encrypted artifact and restart idempotency', async () => withReceiveHost(async ({ host, create, config, input, tenantId, requests, inbox, original }) => {
  const prepared = host.prepareReceive(tenantId, input);
  assert.equal(readKimReceiveStatus(prepared, tenantId, input.requestId).state, 'prepared');
  assert.equal(requests.length, 0);
  const peer = createKimHostServer({ host, tls: { ...f.pki.tls, ca: f.pki.roots }, clientSha256: hash(raw(f.pki.sender.certificate)) });
  const seen = []; peer.on('request', req => seen.push(req.headers)); peer.listen(0, '127.0.0.1'); await once(peer, 'listening');
  const env = { EXPO_PUBLIC_SUPABASE_URL: 'https://auth.test', EXPO_PUBLIC_SUPABASE_ANON_KEY: 'public-anon',
    KIM_DIAGNOSTIC_HOST_URL: `https://localhost.test:${peer.address().port}/v1/diagnostics`, KIM_DIAGNOSTIC_HOST_CONNECT_ADDRESS: '127.0.0.1',
    KIM_DIAGNOSTIC_HOST_CA: f.pki.roots, KIM_DIAGNOSTIC_HOST_SHA256: hash(raw(f.pki.tls.cert)),
    KIM_DIAGNOSTIC_CLIENT_CERT: f.pki.sender.certificate, KIM_DIAGNOSTIC_CLIENT_KEY: await readFile(f.pki.sender.privateKeyPath), KIM_DIAGNOSTIC_CLIENT_PASSPHRASE: f.pki.password.toString() };
  const handler = createKimHostHandler({ env, fetch: async url => new Response(JSON.stringify(url.endsWith('/user') ? { id: randomUUID() } : true)) });
  const call = async action => {
    const response = { statusCode: 200, setHeader() {}, status(n) { this.statusCode = n; return this; }, json(body) { this.body = body; } };
    await handler({ method: 'POST', headers: { authorization: 'Bearer PRIVATE_USER_TOKEN' }, body: { tenantId, action, ...(action === 'receive-list' ? {} : { requestId: input.requestId }) } }, response);
    assert.equal(response.statusCode, 200, JSON.stringify(response.body)); return response.body;
  };
  try {
    const page = readKimReceiveList(await call('receive-list'), tenantId);
    assert.equal(page.items[0].requestId, input.requestId); assert.equal(page.items[0].canStart, true); assert.equal(page.canStart, true);
    assert.equal((await call('receive-status')).state, 'prepared');
    assert.equal((await call('receive-start')).state, 'running');
    assert.equal((await call('receive-start')).requestId, input.requestId);
    assert.equal(readKimHostStatus(host.status(tenantId), tenantId).receiveBlock, 'active');
    assert.throws(() => host.start(tenantId, randomUUID()), /KIM_HOST_RECOVERY_REQUIRED/);
    const done = await waitReceive(host, tenantId, input.requestId), fromApi = await call('receive-status');
    assert.equal(done.state, 'completed'); assert.equal(done.reviewRequired, false); assert.deepEqual(fromApi, done);
    assert.equal(done.result.cardState, 'checked'); assert.equal(done.result.documentResult, 'VALID'); assert.equal(done.result.diagnosisCode, 'XCS_TRUST');
    assert.equal(done.result.hardwareEvidence, 'not-attested'); assert.equal(done.result.deliveryStatus, 'diagnostic-only');
    const completedPage = readKimReceiveList(await call('receive-list'), tenantId);
    assert.deepEqual(completedPage.items[0], done); assert.equal(completedPage.blockReason, 'cooldown');
    const artifact = host.receiveArtifact(tenantId, input.requestId);
    assert.equal(hash(artifact.bytes), done.result.sha256); assert.equal(artifact.metadata.originalSha256, original.sha256);
    assert.equal(artifact.metadata.diagnostic.decryptedOriginalAttached, false); assert.equal(artifact.bytes.includes('PRIVATE LOCAL STATUS TEST'), false);
    const captured = Buffer.from(artifact.bytes); artifact.bytes.fill(0);
    const db = new DatabaseSync(config.storePath), row = db.prepare('SELECT * FROM kim_receive_jobs').get(); db.close();
    assert.equal(Buffer.from(row.result).includes('Content-Type'), false); assert.equal(Buffer.from(row.metadata).includes(senderAddress), false);
    assert.equal(Buffer.from(row.parameters).includes(input.expectedSignerCertificate.toString('base64')), false);
    assert.equal(JSON.stringify(done).includes(senderAddress), false); assert.equal(JSON.stringify(done).includes('SMCB-1'), false);
    assert.equal(JSON.stringify(done).includes('bytes'), false); assert.equal(seen.some(h => h.authorization), false);
    const stored = inbox.get(tenantId, original.id); assert.equal(stored.state, 'received'); assert.equal(stored.deletionConfirmed, false); stored.bytes.fill(0);
    assert.equal(readKimHostStatus(host.status(tenantId), tenantId).receiveBlock, 'cooldown');
    await host.close(); const restored = create();
    assert.deepEqual(restored.receiveStatus(tenantId, input.requestId), done);
    assert.equal(restored.startReceive(tenantId, input.requestId).state, 'completed');
    const reopened = restored.receiveArtifact(tenantId, input.requestId); assert.deepEqual(reopened.bytes, captured); reopened.bytes.fill(0); captured.fill(0);
    assert.equal(requests.filter(q => cmsOperation(q.bytes) === 'DecryptDocument').length, 1);
  } finally { peer.closeAllConnections(); await new Promise(r => peer.close(r)); }
}));

test('KIM receive host: keyset pages preserve equal-time order and do not skip existing jobs after new preparation', async () => withReceiveHost(async ({ host, config, input, inbox, tenantId, mailboxId, requests }) => {
  const ids = [];
  for (let i = 0; i < 23; i++) {
    const message = inbox.record({ tenantId, mailboxId, uid: `page-${i}`, bytes: Buffer.from('unprotected-' + i) });
    const job = host.prepareReceive(tenantId, { ...input, requestId: randomUUID(), messageId: message.id, originalSha256: message.sha256 }); ids.push(job.requestId);
  }
  const db = new DatabaseSync(config.storePath); db.prepare('UPDATE kim_receive_jobs SET created=?').run(Date.now() - 1000); db.close();
  const first = readKimReceiveList(host.receiveList(tenantId), tenantId); assert.equal(first.items.length, 10);
  assert.equal(first.canStart, true); assert.equal(first.blockReason, null); assert.ok(first.nextCursor);
  // A newly prepared job belongs before the existing anchor and is discovered
  // by an explicit refresh of the first page, without moving the older pages.
  const fresh = host.prepareReceive(tenantId, input);
  const second = readKimReceiveList(host.receiveList(tenantId, first.nextCursor), tenantId, first.nextCursor);
  const third = readKimReceiveList(host.receiveList(tenantId, second.nextCursor), tenantId, second.nextCursor);
  const seen = [...first.items, ...second.items, ...third.items].map(j => j.requestId);
  assert.deepEqual(seen, ids.sort().reverse()); assert.equal(third.items.length, 3); assert.equal(third.nextCursor, null);
  assert.equal(host.receiveList(tenantId).items[0].requestId, fresh.requestId);
  assert.equal(new Set(seen).size, 23); assert.equal(requests.length, 0);
  assert.ok(Buffer.byteLength(JSON.stringify(first)) < 32768);
  assert.equal(JSON.stringify(first).includes('unprotected-'), false); assert.equal(JSON.stringify(first).includes(senderAddress), false);
  assert.equal(JSON.stringify(first).includes(input.expectedSignerCertificate.toString('base64')), false);
}));

test('KIM receive host: empty, unconfigured, foreign and malformed list requests never access the card', async () => withReceiveHost(async ({ host, create, tenantId, requests }) => {
  const empty = readKimReceiveList(host.receiveList(tenantId), tenantId); assert.equal(empty.configured, true); assert.deepEqual(empty.items, []);
  const unconfigured = create({ receive: undefined });
  assert.equal(readKimReceiveList(unconfigured.receiveList(tenantId), tenantId).configured, false);
  assert.throws(() => host.receiveList(randomUUID()), /KIM_HOST_SCOPE/);
  assert.throws(() => host.receiveList(tenantId, { createdAt: '1', requestId: randomUUID() }), /KIM_HOST_INPUT/);
  assert.throws(() => host.receiveList(tenantId, { createdAt: 1, requestId: randomUUID(), mailboxId: randomUUID() }), /KIM_HOST_INPUT/);
  assert.equal(requests.length, 0);
}));

test('KIM receive host: every prepared row observes the same shared probe reservation', async () => withReceiveHost(async ({ host, input, tenantId }) => {
  host.prepareReceive(tenantId, input); host.start(tenantId, randomUUID());
  const page = readKimReceiveList(host.receiveList(tenantId), tenantId);
  assert.equal(page.blockReason, 'active'); assert.equal(page.canStart, false); assert.equal(page.items[0].canStart, false);
}));

test('KIM receive host: off-page interrupted work still blocks starts and damaged rows never yield a partial page', async () => withReceiveHost(async ({ host, input, config, tenantId, inbox, mailboxId, requests }) => {
  const first = host.prepareReceive(tenantId, input);
  for (let i = 0; i < 10; i++) {
    const message = inbox.record({ tenantId, mailboxId, uid: `blocked-page-${i}`, bytes: Buffer.from('mail-' + i) });
    host.prepareReceive(tenantId, { ...input, requestId: randomUUID(), messageId: message.id, originalSha256: message.sha256 });
  }
  const db = new DatabaseSync(config.storePath);
  try {
    db.prepare("UPDATE kim_receive_jobs SET state='running',created=?,started=?,requires_review=1 WHERE request_id=?").run(Date.now() - 5000, Date.now() - 4000, first.requestId);
    const page = readKimReceiveList(host.receiveList(tenantId), tenantId); assert.equal(page.blockReason, 'review');
    assert.equal(page.items.some(j => j.requestId === first.requestId), false); assert.ok(page.items.every(j => !j.canStart));
    const older = readKimReceiveList(host.receiveList(tenantId, page.nextCursor), tenantId, page.nextCursor);
    assert.equal(older.items[0].state, 'interrupted'); assert.equal(older.items[0].reviewRequired, true);
    db.prepare('UPDATE kim_receive_jobs SET parameters=? WHERE request_id=?').run(Buffer.from('corrupted'), page.items[0].requestId);
    assert.throws(() => host.receiveList(tenantId)); assert.equal(requests.length, 0);
  } finally { db.close(); }
}));

test('KIM receive host: negative original XML is encrypted, stays diagnostic and requires explicit bound recovery', async () => withReceiveHost(async ({ host, create, config, input, tenantId, requests }) => {
  host.prepareReceive(tenantId, input); host.startReceive(tenantId, input.requestId);
  const done = await waitReceive(host, tenantId, input.requestId);
  assert.equal(done.state, 'completed'); assert.equal(done.result.documentResult, 'INVALID'); assert.equal(done.result.diagnosisCode, 'XCS_DOCUMENT');
  assert.equal(done.reviewRequired, true); assert.equal(host.status(tenantId).receiveBlock, 'review');
  const artifact = host.receiveArtifact(tenantId, input.requestId), xml = cardReportParts(artifact.bytes).find(p => p.type === 'application/xml');
  assert.ok(xml); assert.equal(hash(xml.bytes), done.result.verificationReportSha256); artifact.bytes.fill(0); xml.bytes.fill(0);
  await host.close(); const stopped = create(); assert.throws(() => stopped.start(tenantId, randomUUID()), /KIM_HOST_RECOVERY_REQUIRED/); await stopped.close();
  assert.throws(() => create({ recoveryReviewedRequestId: randomUUID() }), /KIM_HOST_RECOVERY_BINDING/);
  const reviewed = create({ recoveryReviewedRequestId: input.requestId });
  assert.equal(reviewed.receiveStatus(tenantId, input.requestId).reviewRequired, false);
  assert.equal(reviewed.startReceive(tenantId, input.requestId).state, 'completed');
  ageReceive(config.storePath); assert.equal(reviewed.status(tenantId).canStart, true);
  assert.equal(requests.filter(q => cmsOperation(q.bytes) === 'DecryptDocument').length, 1);
}, { changeReply: (event, result) => {
  if (cmsOperation(event.bytes) !== 'VerifyDocument') return false;
  cardsReply(event.response, result.replace('<c:HighLevelResult>VALID', '<c:HighLevelResult>INVALID')); return true;
} }));

test('KIM receive host: scope, source hash, mailbox and exact request binding fail before key access', async () => withReceiveHost(async ({ host, input, tenantId, inbox, requests }) => {
  assert.throws(() => host.prepareReceive(randomUUID(), input), /KIM_HOST_SCOPE/);
  assert.throws(() => host.prepareReceive(tenantId, { ...input, messageId: randomUUID() }), /MESSAGE_NOT_FOUND/);
  assert.throws(() => host.prepareReceive(tenantId, { ...input, originalSha256: 'a'.repeat(64) }), /ORIGINAL_BINDING/);
  const foreign = randomUUID(); inbox.bindMailbox({ tenantId, mailboxId: foreign, host: 'localhost.test', port: 995, servername: 'localhost.test', username: receiverAddress });
  const record = inbox.record({ tenantId, mailboxId: foreign, uid: 'foreign', bytes: wire.bytes });
  assert.throws(() => host.prepareReceive(tenantId, { ...input, messageId: record.id }), /ORIGINAL_BINDING/);
  const done = host.prepareReceive(tenantId, input); assert.deepEqual(host.prepareReceive(tenantId, input), done);
  assert.throws(() => host.prepareReceive(tenantId, { ...input, expectedSignerCertificate: authentication.certificate }), /REQUEST_CONFLICT/);
  assert.throws(() => host.prepareReceive(tenantId, { ...input, requestId: randomUUID() }), /MESSAGE_RESERVED/);
  assert.throws(() => host.start(tenantId, input.requestId), /REQUEST_CONFLICT/);
  assert.throws(() => host.receiveStatus(randomUUID(), input.requestId), /KIM_HOST_SCOPE/);
  assert.throws(() => host.receiveArtifact(randomUUID(), input.requestId), /KIM_HOST_SCOPE/);
  assert.throws(() => host.receiveStatus(tenantId, randomUUID()), /NOT_FOUND/);
  assert.throws(() => host.receiveArtifact(tenantId, input.requestId), /RESULT_UNAVAILABLE/);
  assert.equal(requests.length, 0);
}));

test('KIM receive host: credentials, cleartext opt-in, address override and external reports cannot be staged', async () => withReceiveHost(async ({ host, input, tenantId, requests }) => {
  for (const extra of [{ privateKey: 'forbidden' }, { includeDecryptedOriginal: true }, { address: receiverAddress }, { verificationReport: {} }, { signal: {} }, { now: 1 }]) {
    assert.throws(() => host.prepareReceive(tenantId, { ...input, ...extra }), /KIM_HOST_RECEIVE_INPUT/);
  }
  assert.throws(() => host.prepareReceive(tenantId, { ...input, expectedSignerCertificate: 'malformed' }), /CERTIFICATE/);
  assert.equal(requests.length, 0);
}));

test('KIM receive host: copied preparation and changed caller certificate cannot alter a persisted job', async () => withReceiveHost(async ({ host, input, tenantId }) => {
  host.prepareReceive(tenantId, input); input.expectedSignerCertificate.fill(0); input.expectedAuthCertificate.fill(0);
  host.startReceive(tenantId, input.requestId); const status = await waitReceive(host, tenantId, input.requestId);
  assert.equal(status.result.cardState, 'checked'); assert.equal(status.result.documentResult, 'VALID');
}));

test('KIM receive host: separate host objects share durable reservations with probe and receive operations', async () => withReceiveHost(async ({ host, create, input, tenantId, requests }) => {
  host.prepareReceive(tenantId, input); const other = create();
  host.startReceive(tenantId, input.requestId);
  assert.equal(other.startReceive(tenantId, input.requestId).state, 'interrupted');
  assert.throws(() => other.start(tenantId, randomUUID()), /KIM_HOST_RECOVERY_REQUIRED/);
  await other.close(); const result = await waitReceive(host, tenantId, input.requestId);
  assert.equal(result.state, 'completed'); assert.equal(requests.filter(q => cmsOperation(q.bytes) === 'DecryptDocument').length, 1);
}));

test('KIM receive host: restart never resumes an interrupted reservation, even after administrative review', async () => withReceiveHost(async ({ host, create, config, input, tenantId, requests }) => {
  host.prepareReceive(tenantId, input); await host.close();
  const db = new DatabaseSync(config.storePath); db.prepare("UPDATE kim_receive_jobs SET state='running',started=?,requires_review=1").run(Date.now()); db.close();
  const reopened = create(); assert.equal(reopened.receiveStatus(tenantId, input.requestId).state, 'interrupted');
  assert.equal(reopened.startReceive(tenantId, input.requestId).state, 'interrupted');
  assert.throws(() => reopened.start(tenantId, randomUUID()), /KIM_HOST_RECOVERY_REQUIRED/); await reopened.close();
  const reviewed = create({ recoveryReviewedRequestId: input.requestId });
  assert.equal(readKimReceiveStatus(reviewed.receiveStatus(tenantId, input.requestId), tenantId, input.requestId).reviewRequired, false);
  assert.equal(reviewed.startReceive(tenantId, input.requestId).state, 'interrupted');
  assert.throws(() => reviewed.prepareReceive(tenantId, { ...input, requestId: randomUUID() }), /MESSAGE_RESERVED/);
  assert.equal(requests.length, 0);
}));

test('KIM receive host: aborting close records failure and reopening does not touch the card', async () => withReceiveHost(async ({ host, create, input, tenantId, requests }) => {
  host.prepareReceive(tenantId, input); host.startReceive(tenantId, input.requestId); await host.close();
  const reopened = create(), result = readKimReceiveStatus(reopened.startReceive(tenantId, input.requestId), tenantId, input.requestId);
  assert.equal(result.state, 'failed'); assert.equal(result.reviewRequired, true); assert.equal(result.result, null);
  assert.equal(requests.length, 0);
}));

test('KIM receive host: changed encryption key or mailbox provisioning cannot reopen the journal', async () => withReceiveHost(async ({ host, create, config, input, tenantId, requests }) => {
  host.prepareReceive(tenantId, input); await host.close();
  assert.throws(() => create({ receive: undefined }), /CONFIGURATION_REQUIRED/);
  assert.throws(() => create({ receive: { ...config.receive, key: randomBytes(32) } }), /STORE_AUTHENTICATION/);
  assert.throws(() => create({ receive: { ...config.receive, cmVersion: 'TEST_0.2.0' } }), /CONFIGURATION_CHANGED/);
  assert.throws(() => create({ receive: { ...config.receive, address: receiverAddress } }), /CONFIGURATION/);
  assert.throws(() => create({ tenantId: randomUUID() }), /KIM_HOST_SCOPE/);
  assert.equal(requests.length, 0);
}));

test('KIM receive host: changed original or sealed preparation fails before reservation and card I/O', async () => withReceiveHost(async ({ host, config, input, tenantId, requests, inboxPath }) => {
  host.prepareReceive(tenantId, input);
  const source = new DatabaseSync(inboxPath), row = source.prepare('SELECT content FROM receipt_messages').get();
  const broken = Buffer.from(row.content); broken[broken.length - 1] ^= 1;
  source.prepare('UPDATE receipt_messages SET content=?').run(broken);
  assert.throws(() => host.startReceive(tenantId, input.requestId), /STORE_AUTHENTICATION/);
  source.prepare('UPDATE receipt_messages SET content=?').run(row.content); source.close();
  const db = new DatabaseSync(config.storePath), saved = db.prepare('SELECT parameters FROM kim_receive_jobs').get(), bad = Buffer.from(saved.parameters); bad[bad.length - 1] ^= 1;
  db.prepare('UPDATE kim_receive_jobs SET parameters=?').run(bad);
  assert.throws(() => host.startReceive(tenantId, input.requestId), /STORE_AUTHENTICATION/);
  assert.equal(db.prepare('SELECT state FROM kim_receive_jobs').get().state, 'prepared'); db.close(); assert.equal(requests.length, 0);
}));

test('KIM receive host: failed result commit remains reserved and never reruns the key operation', async () => withReceiveHost(async ({ host, create, config, input, tenantId, requests }) => {
  host.prepareReceive(tenantId, input);
  const db = new DatabaseSync(config.storePath); db.exec("CREATE TRIGGER refuse_result BEFORE UPDATE ON kim_receive_jobs WHEN NEW.state='completed' BEGIN SELECT RAISE(ABORT,'PRIVATE_STORAGE_DETAIL'); END"); db.close();
  host.startReceive(tenantId, input.requestId); const result = await waitReceive(host, tenantId, input.requestId);
  assert.equal(result.state, 'failed'); assert.equal(result.errorCode, 'KIM_HOST_RECEIVE_UNAVAILABLE'); assert.equal(result.result, null);
  assert.equal(JSON.stringify(result).includes('PRIVATE_STORAGE_DETAIL'), false);
  await host.close(); const reopened = create(); assert.equal(reopened.startReceive(tenantId, input.requestId).state, 'failed');
  assert.equal(requests.filter(q => cmsOperation(q.bytes) === 'DecryptDocument').length, 1);
}));

test('KIM receive host: result ciphertext cannot be replaced without failing authenticated artifact retrieval', async () => withReceiveHost(async ({ host, config, input, tenantId }) => {
  host.prepareReceive(tenantId, input); host.startReceive(tenantId, input.requestId); await waitReceive(host, tenantId, input.requestId);
  const db = new DatabaseSync(config.storePath), row = db.prepare('SELECT result FROM kim_receive_jobs').get(), bytes = Buffer.from(row.result); bytes[30] ^= 1;
  db.prepare('UPDATE kim_receive_jobs SET result=?').run(bytes); db.close();
  assert.throws(() => host.receiveArtifact(tenantId, input.requestId), /STORE_AUTHENTICATION/);
}, { bytes: Buffer.from('From: sender@local.kim.telematik-test\r\nTo: sender@local.kim.telematik-test\r\n\r\nPRIVATE ORIGINAL\r\n') }));

test('KIM receive host: unprotected original is stored byte-exact, encrypted and never invokes the card', async () => {
  const bytes = Buffer.from('From: sender@local.kim.telematik-test\r\nTo: sender@local.kim.telematik-test\r\n\r\nPRIVATE ORIGINAL\r\n');
  await withReceiveHost(async ({ host, input, tenantId, requests }) => {
    host.prepareReceive(tenantId, input); host.startReceive(tenantId, input.requestId); const result = await waitReceive(host, tenantId, input.requestId);
    assert.equal(result.result.kind, 'unprotected'); assert.equal(result.result.cardState, null); assert.equal(result.reviewRequired, false);
    const artifact = host.receiveArtifact(tenantId, input.requestId); assert.deepEqual(artifact.bytes, bytes); artifact.bytes.fill(0); assert.equal(requests.length, 0);
  }, { bytes });
});

test('KIM receive host: bounded job count and result quota never truncate an artifact or release a failed job', async () => withReceiveHost(async ({ host, input, tenantId, inbox, mailboxId, requests }) => {
  host.prepareReceive(tenantId, input);
  const second = inbox.record({ tenantId, mailboxId, uid: 'second', bytes: wire.bytes });
  assert.throws(() => host.prepareReceive(tenantId, { ...input, requestId: randomUUID(), messageId: second.id, originalSha256: second.sha256 }), /KIM_HOST_RECEIVE_QUOTA/);
  host.startReceive(tenantId, input.requestId); const result = await waitReceive(host, tenantId, input.requestId);
  assert.equal(result.state, 'failed'); assert.equal(result.errorCode, 'KIM_HOST_RECEIVE_QUOTA'); assert.equal(result.reviewRequired, true);
  assert.throws(() => host.receiveArtifact(tenantId, input.requestId), /RESULT_UNAVAILABLE/); assert.equal(requests.length, 0);
}, { limits: { maxJobs: 1, maxResultBytes: 1 }, bytes: Buffer.from('From: sender@local.kim.telematik-test\r\n\r\nprivate\r\n') }));

test('KIM receive host: probe reservation blocks receive start and cannot share its request identifier', async () => withReceiveHost(async ({ host, input, tenantId, requests }) => {
  const probeId = randomUUID(); host.start(tenantId, probeId);
  assert.throws(() => host.prepareReceive(tenantId, { ...input, requestId: probeId }), /REQUEST_CONFLICT/);
  host.prepareReceive(tenantId, input);
  assert.equal(host.receiveStatus(tenantId, input.requestId).canStart, false);
  assert.throws(() => host.startReceive(tenantId, input.requestId), /KIM_HOST_RECOVERY_REQUIRED/);
  await host.close(); assert.equal(requests.length, 0);
}));

test('KIM receive host: artifacts and metadata cannot be transplanted between two completed request identities', async () => withReceiveHost(async ({ host, config, input, tenantId, inbox, mailboxId, requests }) => {
  host.prepareReceive(tenantId, input); host.startReceive(tenantId, input.requestId); await waitReceive(host, tenantId, input.requestId);
  const second = inbox.record({ tenantId, mailboxId, uid: 'second-original', bytes: Buffer.from('From: sender@local.kim.telematik-test\r\n\r\nsecond private original\r\n') });
  const next = { ...input, requestId: randomUUID(), messageId: second.id, originalSha256: second.sha256 };
  host.prepareReceive(tenantId, next);
  assert.equal(host.receiveStatus(tenantId, next.requestId).canStart, false);
  assert.ok(host.receiveStatus(tenantId, next.requestId).nextStartAt);
  assert.throws(() => host.startReceive(tenantId, next.requestId), /KIM_HOST_RATE_LIMIT/);
  ageReceive(config.storePath); host.startReceive(tenantId, next.requestId); await waitReceive(host, tenantId, next.requestId);
  const db = new DatabaseSync(config.storePath), rows = db.prepare('SELECT * FROM kim_receive_jobs ORDER BY created').all();
  db.prepare('UPDATE kim_receive_jobs SET result=? WHERE request_id=?').run(rows[1].result, rows[0].request_id);
  assert.throws(() => host.receiveArtifact(tenantId, rows[0].request_id), /STORE_AUTHENTICATION/);
  db.prepare('UPDATE kim_receive_jobs SET metadata=? WHERE request_id=?').run(rows[1].metadata, rows[0].request_id);
  assert.throws(() => host.receiveStatus(tenantId, rows[0].request_id), /STORE_AUTHENTICATION/);
  db.close(); assert.equal(requests.length, 0);
}, { bytes: Buffer.from('From: sender@local.kim.telematik-test\r\n\r\nfirst private original\r\n') }));

test('KIM host: authenticated gateway, real mTLS, durable reservation and complete synthetic card workflow', async () => fixture(async ({ open, path }) => withCms(async ({ connector, requests }) => {
  const tenantId = randomUUID(), requestId = randomUUID(), storePath = join(dirname(path), 'kim-host.db');
  const probe = { connector, statusClient: open(), expectedTelematikId: '10-LOCAL-TEST', requiredRoles: ['1.2.276.0.76.4.245'], address: senderAddress };
  const host = new KimDiagnosticHost({ tenantId, storePath, probe });
  const peer = createKimHostServer({ host, tls: { ...f.pki.tls, ca: f.pki.roots }, clientSha256: hash(raw(f.pki.sender.certificate)) });
  const seen = []; peer.on('request', req => seen.push(req.headers)); peer.listen(0, '127.0.0.1'); await once(peer, 'listening');
  const env = { EXPO_PUBLIC_SUPABASE_URL: 'https://auth.test', EXPO_PUBLIC_SUPABASE_ANON_KEY: 'public-anon',
    KIM_DIAGNOSTIC_HOST_URL: `https://localhost.test:${peer.address().port}/v1/diagnostics`, KIM_DIAGNOSTIC_HOST_CONNECT_ADDRESS: '127.0.0.1',
    KIM_DIAGNOSTIC_HOST_CA: f.pki.roots, KIM_DIAGNOSTIC_HOST_SHA256: hash(raw(f.pki.tls.cert)),
    KIM_DIAGNOSTIC_CLIENT_CERT: f.pki.sender.certificate, KIM_DIAGNOSTIC_CLIENT_KEY: await readFile(f.pki.sender.privateKeyPath), KIM_DIAGNOSTIC_CLIENT_PASSPHRASE: f.pki.password.toString() };
  const handler = createKimHostHandler({ env, fetch: async url => new Response(JSON.stringify(url.endsWith('/user') ? { id: randomUUID() } : true)) });
  const call = async (action, id, tenant = tenantId) => {
    const response = { statusCode: 200, headers: {}, setHeader(k, v) { this.headers[k] = v; }, status(n) { this.statusCode = n; return this; }, json(body) { this.body = body; } };
    await handler({ method: 'POST', headers: { authorization: 'Bearer PRIVATE_USER_TOKEN' }, body: { tenantId: tenant, action, ...(id ? { requestId: id } : {}) } }, response);
    return response;
  };
  try {
    assert.equal((await call('status')).body.state, 'ready');
    assert.throws(() => host.start(randomUUID(), requestId), /KIM_HOST_SCOPE/);
    assert.equal((await call('start', requestId)).body.state, 'running');
    assert.equal((await call('start', requestId)).body.requestId, requestId);
    const start = Date.now(); let status;
    do { await new Promise(r => setTimeout(r, 100)); status = host.status(tenantId); } while (status.state === 'running' && Date.now() - start < 25000);
    assert.equal(status.state, 'passed');
    const response = await call('status'); assert.equal(response.statusCode, 200);
    readKimHostStatus(response.body, tenantId);
    assert.equal(response.body.report.hardwareEvidence, 'not-attested');
    assert.equal(response.body.report.version, 2); assert.equal(response.body.report.documentVerification.result, 'VALID');
    assert.equal(response.body.canStart, false); assert.ok(response.body.nextStartAt > Date.now());
    assert.throws(() => host.start(tenantId, randomUUID()), /KIM_HOST_RATE_LIMIT/);
    const refused = await call('start', randomUUID());
    assert.equal(refused.statusCode, 200); assert.equal(refused.body.canStart, false); assert.equal(refused.body.requestId, requestId);
    assert.equal(seen.some(h => h.authorization), false);
    assert.equal(requests.filter(q => cmsOperation(q.bytes) === 'SignDocument').length, 1);
    await host.close();
    const reopened = new KimDiagnosticHost({ tenantId, storePath, probe });
    try { assert.equal(reopened.status(tenantId).requestId, requestId); assert.equal(reopened.start(tenantId, requestId).state, 'passed'); }
    finally { await reopened.close(); }
  } finally { await host.close(); peer.closeAllConnections(); await new Promise(r => peer.close(r)); }
})));

test('KIM host: failed card preflight survives restart and requires explicit reviewed recovery', async () => fixture(async ({ open, path }) => withCms(async ({ connector }) => {
  const tenantId = randomUUID(), requestId = randomUUID(), storePath = join(dirname(path), 'kim-host-fail.db');
  const probe = { connector, statusClient: open(), expectedTelematikId: '10-LOCAL-TEST', requiredRoles: ['1.2.276.0.76.4.245'], address: senderAddress };
  let host = new KimDiagnosticHost({ tenantId, storePath, probe });
  host.start(tenantId, requestId); await host.close();
  host = new KimDiagnosticHost({ tenantId, storePath, probe });
  assert.equal(host.status(tenantId).state, 'failed');
  assert.throws(() => host.start(tenantId, randomUUID()), /KIM_HOST_RECOVERY_REQUIRED/); await host.close();
  host = new KimDiagnosticHost({ tenantId, storePath, probe, recoveryReviewedRequestId: requestId });
  try {
    assert.equal(host.status(tenantId).canStart, false); assert.ok(host.status(tenantId).nextStartAt > Date.now());
    assert.throws(() => host.start(tenantId, randomUUID()), /KIM_HOST_RATE_LIMIT/);
    const db = new DatabaseSync(storePath); db.prepare('UPDATE kim_diagnostic_jobs SET started=started-30000').run(); db.close();
    assert.equal(host.status(tenantId).canStart, true); readKimHostStatus(host.status(tenantId), tenantId);
  }
  finally { await host.close(); }
})));

test('SMC-B authentication workflow: verified private evidence, one key operation and a full fresh postcheck', async () => fixture(async ({ open }) => withSmcbAuth(async ({ connector, requests }) => {
  const statusClient = open(), prepared = await preparePin(connector, statusClient);
  const result = await authenticate(connector, statusClient, prepared);
  assert.equal(result.state, 'authentication-signed'); assert.equal(result.identityStatus, 'unverified');
  assert.equal(result.deliveryStatus, 'held-for-trust-validation');
  assert.equal(assertSmcbAuthentication(result, connector, statusClient, authInput), result);
  assert.equal(requests.filter(q => isAuthenticate(q.bytes)).length, 1);
  assert.equal(requests.filter(q => isReadCards(q.bytes)).length, 2);
  assert.equal(requests.filter(q => isPinStatus(q.bytes)).length, 2);
  assert.equal(requests.filter(q => isVerifyPin(q.bytes)).length, 0);
  await assert.rejects(authenticate(connector, statusClient, prepared), code('KIM_CONNECTOR_CARD_SNAPSHOT_STALE'));
})));

test('SMC-B authentication workflow: X-KIM-Auth from the local key-operation peer passes the existing receiving check', async () => fixture(async ({ open }) => withSmcbAuth(async ({ connector, requests }) => {
  const statusClient = open(), prepared = await preparePin(connector, statusClient);
  const result = await createSmcbKimAuth({ connector, statusClient, prepared, sender: senderAddress, cmVersion: report.cmVersion });
  const verified = verifyReceivedEccKimAuth({ header: result.header, sender: senderAddress,
    expectedCertificate: authentication.certificate, cmVersion: report.cmVersion, now: state.now });
  assert.equal(verified.tokenId, result.tokenId); assert.equal(verified.certificateSha256, result.certificateSha256);
  assert.equal(result.senderBinding, 'unverified'); assert.equal(result.identityStatus, 'unverified');
  assert.equal(result.deliveryStatus, 'held-for-trust-validation'); assert.equal(assertSmcbKimAuth(result, connector, statusClient), result);
  assert.throws(() => assertSmcbKimAuth({ ...result }, connector, statusClient), code('KIM_CONNECTOR_EVIDENCE_BINDING'));
  const parts = result.header.slice(7).split('.'), jwt = JSON.parse(Buffer.from(parts[0], 'base64url'));
  assert.deepEqual(Object.keys(jwt), ['alg', 'typ', 'x5c']); assert.equal(jwt.alg, 'BP256R1');
  const payload = JSON.parse(Buffer.from(parts[1], 'base64url'));
  assert.equal(payload.aud, 'I_Message_Service'); assert.equal(payload.nbf, Math.floor(prepared.status.checkedAt / 1000));
  assert.equal(requests.filter(q => isAuthenticate(q.bytes)).length, 1);
  await connector.getCards(); assert.throws(result.revalidate, code('KIM_CONNECTOR_CARD_SNAPSHOT_STALE'));
})));

for (const variant of ['copied', 'foreign-status-client', 'pin-not-ready', 'maintenance']) {
  test('SMC-B authentication workflow: ' + variant + ' cannot authorize a key operation', async () => fixture(async ({ open }) => withSmcbAuth(async ({ connector, requests }) => {
    const statusClient = open(); let prepared = await preparePin(connector, statusClient);
    if (variant === 'copied') prepared = { ...prepared };
    if (variant === 'pin-not-ready') prepared = { state: 'pin-required' };
    if (variant === 'maintenance') prepared = { state: 'pin-maintained', ...prepared, requiresVerification: false };
    await assert.rejects(authenticate(connector, variant === 'foreign-status-client' ? open() : statusClient, prepared), code('KIM_CONNECTOR_EVIDENCE_BINDING'));
    assert.equal(requests.filter(q => isAuthenticate(q.bytes)).length, 0);
  })));
}

for (const [label, changes, expected] of [['data', { data: 'wrong' }, 'INPUT'], ['secret', { pin: 'secret' }, 'INPUT']]) {
  test('SMC-B authentication workflow: rejects ' + label + ' before key use', async () => fixture(async ({ open }) => withSmcbAuth(async ({ connector, requests }) => {
    const statusClient = open(), prepared = await preparePin(connector, statusClient);
    await assert.rejects(authenticate(connector, statusClient, prepared, changes), code('KIM_CONNECTOR_' + expected));
    assert.equal(requests.filter(q => isAuthenticate(q.bytes)).length, 0);
  })));
}

test('SMC-B authentication workflow: invalid JWT sender/version and software-key options never reach the card', async () => fixture(async ({ open }) => withSmcbAuth(async ({ connector, requests }) => {
  const statusClient = open(), prepared = await preparePin(connector, statusClient);
  for (const change of [{ sender: 'a\r\nb@x.test' }, { cmVersion: 'invented approved product' }, { privateKey: authKey }, { certificate: authentication.certificate }]) {
    await assert.rejects(createSmcbKimAuth({ connector, statusClient, prepared, sender: senderAddress, cmVersion: report.cmVersion, ...change }),
      e => ['KIM_CONNECTOR_AUTH_INPUT', 'KIM_CONNECTOR_INPUT'].includes(e?.code));
  }
  assert.equal(requests.filter(q => isAuthenticate(q.bytes)).length, 0);
})));

for (const [label, cards, expected] of [['removed', [], 'CARD_NOT_FOUND'], ['new handle', [cardData({ cardHandle: 'REINSERTED' })], 'CARD_CHANGED'],
  ['different ICCSN', [cardData({ iccsn: '80276000000000000002' })], 'CARD_NOT_FOUND']]) {
  test('SMC-B authentication workflow: ' + label + ' after signing cannot release a signature', async () => fixture(async ({ open }) => withSmcbAuth(async ({ connector, requests }) => {
    const statusClient = open(), prepared = await preparePin(connector, statusClient);
    await assert.rejects(authenticate(connector, statusClient, prepared), code('KIM_CONNECTOR_' + expected));
    assert.equal(requests.filter(q => isAuthenticate(q.bytes)).length, 1);
  }, event => authenticated(event) && isCards(event.bytes) ? cardsReply(event.response, cardsResponse(cards)) : authSmcbReply(event))));
}

test('SMC-B authentication workflow: a different otherwise valid ENC certificate fails the complete card binding', async () => fixture(async ({ open }) => withSmcbAuth(async ({ connector }) => {
  const statusClient = open(), prepared = await preparePin(connector, statusClient);
  await assert.rejects(authenticate(connector, statusClient, prepared), code('KIM_CONNECTOR_CERTIFICATE_BINDING'));
}, event => authenticated(event) && isReadCards(event.bytes) ? cardsReply(event.response, certificatesResponse([
  ['C.AUT', authentication.certificate], ['C.ENC', encryption[1].certificate], ['C.SIG', signing.certificate],
])) : authSmcbReply(event))));

for (const value of ['VERIFIABLE', 'BLOCKED', 'TRANSPORT_PIN']) test('SMC-B authentication workflow: post-signature PIN ' + value + ' is held without VerifyPin', async () => fixture(async ({ open }) => withSmcbAuth(async ({ connector, requests }) => {
  const statusClient = open(), prepared = await preparePin(connector, statusClient);
  await assert.rejects(authenticate(connector, statusClient, prepared), code('KIM_CONNECTOR_AUTH_POSTCONDITION'));
  assert.equal(requests.filter(q => isVerifyPin(q.bytes)).length, 0);
}, event => authenticated(event) && isPinStatus(event.bytes)
  ? cardsReply(event.response, pinResponse('GetPinStatus', value, value === 'VERIFIABLE' ? 3 : value === 'BLOCKED' ? 0 : null)) : authSmcbReply(event))));

test('SMC-B authentication workflow: post-signature certificate rejection cannot reuse the preflight', async () => fixture(async ({ open }) => withSmcbAuth(async ({ connector }) => {
  const statusClient = open(), prepared = await preparePin(connector, statusClient);
  await assert.rejects(authenticate(connector, statusClient, prepared), code('KIM_CONNECTOR_CERTIFICATE_REJECTED'));
}, event => authenticated(event) && event.bytes.includes('<c:VerifyCertificate>')
  ? cardsReply(event.response, verificationResponse('INVALID')) : authSmcbReply(event))));

test('SMC-B authentication workflow: TSL refresh during the final PIN response invalidates the result', async () => fixture(async ({ open, manager }) => withSmcbAuth(async ({ connector }) => {
  const statusClient = open(), prepared = await preparePin(connector, statusClient);
  await assert.rejects(authenticate(connector, statusClient, prepared), code('KIM_CONNECTOR_SMCB_STATUS'));
}, async event => { if (authenticated(event) && isPinStatus(event.bytes)) await manager.refresh(); return authSmcbReply(event); })));

for (const source of ['operation', 'preflight']) test('SMC-B authentication workflow: ' + source + ' cancellation during postcheck never yields a signature', async () => fixture(async ({ open }) => {
  const controller = new AbortController();
  await withSmcbAuth(async ({ connector }) => {
    const statusClient = open(), prepared = await preparePin(connector, statusClient, source === 'preflight' ? { signal: controller.signal } : {});
    await assert.rejects(authenticate(connector, statusClient, prepared, source === 'operation' ? { signal: controller.signal } : {}), code('KIM_CONNECTOR_ABORTED'));
  }, event => { if (authenticated(event) && isReadCards(event.bytes)) controller.abort(); return authSmcbReply(event); });
}));

test('SMC-B authentication workflow: authentic result is bound to bytes, clients, TSL and fresh PIN evidence', async () => fixture(async ({ open, manager }) => withSmcbAuth(async ({ connector }) => {
  const statusClient = open(), prepared = await preparePin(connector, statusClient), result = await authenticate(connector, statusClient, prepared);
  assert.throws(() => assertSmcbAuthentication({ ...result }, connector, statusClient, authInput), code('KIM_CONNECTOR_EVIDENCE_BINDING'));
  assert.throws(() => assertSmcbAuthentication(result, connector, open(), authInput), code('KIM_CONNECTOR_EVIDENCE_BINDING'));
  assert.throws(() => assertSmcbAuthentication(result, connector, statusClient, Buffer.from('altered')), code('KIM_CONNECTOR_EVIDENCE_BINDING'));
  await manager.refresh(); assert.throws(result.revalidate, code('KIM_CONNECTOR_SMCB_STATUS'));
})));

test('SMC-B authentication workflow: input bytes and expected institution cannot be changed during signing', async () => fixture(async ({ open }) => withSmcbAuth(async ({ connector }) => {
  const statusClient = open(), prepared = await preparePin(connector, statusClient), mutable = Buffer.from(authInput);
  const args = { connector, statusClient, prepared, data: mutable }, result = signSmcbAuthentication(args);
  mutable.fill(0); args.prepared = {}; args.statusClient = {};
  assert.equal((await result).dataSha256, hash(authInput));
})));

test('SMC-B authentication workflow: a parallel signature cannot borrow an in-flight PIN observation', async () => fixture(async ({ open }) => {
  const entered = Promise.withResolvers();
  await withSmcbAuth(async ({ connector, requests }) => {
    const statusClient = open(), prepared = await preparePin(connector, statusClient), first = authenticate(connector, statusClient, prepared);
    const release = await entered.promise;
    await assert.rejects(authenticate(connector, statusClient, prepared), code('KIM_CONNECTOR_AUTH_BUSY'));
    await release(); await first;
    assert.equal(requests.filter(q => isAuthenticate(q.bytes)).length, 1);
  }, event => isAuthenticate(event.bytes) ? entered.resolve(() => authSmcbReply(event)) : authSmcbReply(event));
}));

const isMaintenance = bytes => isChangePin(bytes) || isUnblockPin(bytes);
const maintenanceStarted = event => event.requests.some(q => isMaintenance(q.bytes));
const maintenanceReply = (before = 'VERIFIABLE', after = 'VERIFIABLE') => event => {
  if (isPinStatus(event.bytes)) {
    const value = maintenanceStarted(event) ? after : before;
    return cardsReply(event.response, pinResponse('GetPinStatus', value, value === 'VERIFIABLE' ? 3 : value === 'BLOCKED' ? 0 : null));
  }
  if (isMaintenance(event.bytes)) return cardsReply(event.response, pinResponse(isChangePin(event.bytes) ? 'ChangePin' : 'UnblockPin', 'OK'));
  smcbReply(event);
};
const maintainPin = (connector, statusClient, changes = {}) => maintainSmcbPin({ connector, statusClient,
  expectedTelematikId: '10-LOCAL-TEST', requiredRoles: ['1.2.276.0.76.4.245'], action: 'change', allowPrompt: true, ...changes });
const unconfirmed = (cause, operation = 'ChangePin') => e => code('KIM_CONNECTOR_PIN_MAINTENANCE_UNCONFIRMED')(e)
  && e.reportedPinResult === 'OK' && e.operation === operation && e.causeCode === 'KIM_CONNECTOR_' + cause;

for (const [action, before, setNewPin, after] of [['initialize', 'TRANSPORT_PIN', undefined, 'VERIFIABLE'],
  ['initialize', 'EMPTY_PIN', undefined, 'VERIFIABLE'], ['change', 'VERIFIED', undefined, 'VERIFIABLE'],
  ['unblock', 'BLOCKED', false, 'VERIFIABLE'], ['unblock', 'BLOCKED', true, 'VERIFIED']]) {
  test('SMC-B PIN maintenance: ' + action + '/' + before + '/' + setNewPin + ' verifies the postcondition without automatic VerifyPin', async () => fixture(async ({ open }) => withSmcbPin(async ({ connector, requests }) => {
    const statusClient = open(), r = await maintainPin(connector, statusClient, { action, ...(action === 'unblock' ? { setNewPin } : {}) });
    assert.equal(assertMaintainedSmcbPin(r, connector, statusClient), r); r.revalidate();
    assert.equal(r.state, 'pin-maintained'); assert.equal(r.status.pinStatus, after); assert.equal(r.requiresVerification, after !== 'VERIFIED');
    assert.equal(r.action, action); assert.equal(r.setNewPin, setNewPin); assert.equal(requests.length, 15);
    assert.equal(requests.filter(q => isMaintenance(q.bytes)).length, 1); assert.equal(requests.some(q => isVerifyPin(q.bytes)), false);
    assert.equal(r.deliveryStatus, 'held-for-trust-validation'); assert.equal(r.identityStatus, 'unverified');
    assert.throws(() => assertPreparedSmcbPin(r, connector, statusClient), code('KIM_CONNECTOR_EVIDENCE_BINDING'));
  }, maintenanceReply(before, after))));
}

for (const [action, before] of [['initialize', 'TRANSPORT_PIN'], ['change', 'VERIFIABLE'], ['unblock', 'BLOCKED']]) {
  test('SMC-B PIN maintenance: ' + action + ' can be inspected without starting a terminal prompt', async () => fixture(async ({ open }) => withSmcbPin(async ({ connector, requests }) => {
    const statusClient = open(), r = await maintainPin(connector, statusClient, { action, allowPrompt: undefined, ...(action === 'unblock' ? { setNewPin: true } : {}) });
    assert.equal(r.state, 'pin-maintenance-required'); assert.equal(r.pinStatus, before);
    assert.equal(r.pinLeftTries, before === 'BLOCKED' ? 0 : before === 'VERIFIABLE' ? 3 : null);
    assert.equal(r.card.iccsn, '80276000000000000001'); assert.equal(requests.length, 7); assert.equal(requests.some(q => isMaintenance(q.bytes)), false);
    assert.throws(() => assertMaintainedSmcbPin(r, connector, statusClient), code('KIM_CONNECTOR_EVIDENCE_BINDING'));
  }, maintenanceReply(before))));
}

for (const [action, before] of [['initialize', 'VERIFIED'], ['change', 'BLOCKED'], ['unblock', 'VERIFIABLE']]) {
  test('SMC-B PIN maintenance: ' + action + ' cannot switch to another action when its fresh state is ' + before, async () => fixture(async ({ open }) => withSmcbPin(async ({ connector, requests }) => {
    await assert.rejects(maintainPin(connector, open(), { action, ...(action === 'unblock' ? { setNewPin: false } : {}) }), code('KIM_CONNECTOR_PIN_MAINTENANCE_STATE'));
    assert.equal(requests.length, 7); assert.equal(requests.some(q => isMaintenance(q.bytes) || isVerifyPin(q.bytes)), false);
  }, maintenanceReply(before))));
}

for (const [action, result, tries, expected] of [['change', 'REJECTED', 1, 'pin-rejected'], ['change', 'NOWBLOCKED', 0, 'pin-blocked'],
  ['unblock', 'REJECTED', 9, 'puk-rejected'], ['unblock', 'WASBLOCKED', null, 'puk-blocked'], ['unblock', 'NOWBLOCKED', 0, 'puk-blocked']]) {
  test('SMC-B PIN maintenance: ' + action + '/' + result + ' preserves PIN versus PUK retry semantics', async () => fixture(async ({ open }) => withSmcbPin(async ({ connector, requests }) => {
    const r = await maintainPin(connector, open(), { action, ...(action === 'unblock' ? { setNewPin: true } : {}) });
    assert.equal(r.state, expected); assert.equal(r.leftTries, tries); assert.equal(r.retryCounter, action === 'unblock' ? 'puk' : 'pin');
    assert.equal(requests.length, 8); assert.equal(requests.some(q => isVerifyPin(q.bytes)), false);
  }, event => isMaintenance(event.bytes) ? cardsReply(event.response, pinResponse(action === 'unblock' ? 'UnblockPin' : 'ChangePin', result, tries))
    : maintenanceReply(action === 'unblock' ? 'BLOCKED' : 'VERIFIABLE')(event))));
}

test('SMC-B PIN maintenance: a known blocked PUK is retained across fresh workflows without another prompt', async () => fixture(async ({ open }) => withSmcbPin(async ({ connector, requests }) => {
  const statusClient = open(), config = { action: 'unblock', setNewPin: false };
  assert.equal((await maintainPin(connector, statusClient, config)).state, 'puk-blocked');
  const again = await maintainPin(connector, statusClient, config); assert.equal(again.state, 'puk-blocked'); assert.equal(again.leftTries, null);
  assert.equal(requests.filter(q => isUnblockPin(q.bytes)).length, 1);
}, event => isUnblockPin(event.bytes) ? cardsReply(event.response, pinResponse('UnblockPin', 'WASBLOCKED')) : maintenanceReply('BLOCKED', 'BLOCKED')(event))));

for (const after of ['BLOCKED', 'TRANSPORT_PIN', 'EMPTY_PIN']) test('SMC-B PIN maintenance: peer OK with post-state ' + after + ' is unconfirmed, not an unchanged PIN', async () => fixture(async ({ open }) => withSmcbPin(async ({ connector, requests }) => {
  await assert.rejects(maintainPin(connector, open()), unconfirmed('PIN_POSTCONDITION'));
  assert.equal(requests.filter(q => isChangePin(q.bytes)).length, 1); assert.equal(requests.length, 15);
}, maintenanceReply('VERIFIABLE', after))));

for (const [label, cards, cause] of [['removed', [], 'CARD_NOT_FOUND'], ['new handle', [cardData({ cardHandle: 'SMCB-CHANGED' })], 'CARD_CHANGED']]) {
  test('SMC-B PIN maintenance: card ' + label + ' after terminal OK reports an unconfirmed mutation', async () => fixture(async ({ open }) => withSmcbPin(async ({ connector }) => {
    await assert.rejects(maintainPin(connector, open()), unconfirmed(cause));
  }, event => isCards(event.bytes) && maintenanceStarted(event) ? cardsReply(event.response, cardsResponse(cards)) : maintenanceReply()(event))));
}

test('SMC-B PIN maintenance: changed valid ENC after UnblockPin OK cannot confirm the former identity', async () => fixture(async ({ open }) => withSmcbPin(async ({ connector }) => {
  await assert.rejects(maintainPin(connector, open(), { action: 'unblock', setNewPin: true }), unconfirmed('CERTIFICATE_BINDING', 'UnblockPin'));
}, event => isReadCards(event.bytes) && maintenanceStarted(event) ? cardsReply(event.response, certificatesResponse([
  ['C.AUT', authentication.certificate], ['C.ENC', encryption[1].certificate], ['C.SIG', signing.certificate],
])) : maintenanceReply('BLOCKED')(event))));

test('SMC-B PIN maintenance: TSL refresh in final status response prevents confirmation after terminal success', async () => fixture(async ({ open, manager }) => withSmcbPin(async ({ connector }) => {
  await assert.rejects(maintainPin(connector, open()), unconfirmed('SMCB_STATUS'));
}, async event => { if (isPinStatus(event.bytes) && maintenanceStarted(event)) await manager.refresh(); maintenanceReply()(event); })));

test('SMC-B PIN maintenance: abort during postchecks retains the peer-reported completed operation', async () => fixture(async ({ open }) => {
  const controller = new AbortController();
  await withSmcbPin(async ({ connector }) => {
    await assert.rejects(maintainPin(connector, open(), { signal: controller.signal }), unconfirmed('ABORTED'));
  }, event => { if (isPinStatus(event.bytes) && maintenanceStarted(event)) controller.abort(); maintenanceReply()(event); });
}));

test('SMC-B PIN maintenance: only original management evidence can be consumed and later status updates invalidate it', async () => fixture(async ({ open }) => withSmcbPin(async ({ connector }) => {
  const statusClient = open(), r = await maintainPin(connector, statusClient);
  assert.throws(() => assertMaintainedSmcbPin({ ...r }, connector, statusClient), code('KIM_CONNECTOR_EVIDENCE_BINDING'));
  assert.throws(() => assertMaintainedSmcbPin(r, {}, statusClient), code('KIM_CONNECTOR_EVIDENCE_BINDING'));
  assert.throws(() => assertMaintainedSmcbPin(r, connector, open()), code('KIM_CONNECTOR_EVIDENCE_BINDING'));
  await connector.getSmcbPinStatus({ selection: r.bundle.selection });
  assert.throws(() => assertMaintainedSmcbPin(r, connector, statusClient), code('KIM_CONNECTOR_PIN_STATUS_STALE'));
}, maintenanceReply())));

test('SMC-B PIN maintenance: PIN verification and management share one workflow exclusion', async () => fixture(async ({ open }) => {
  const entered = Promise.withResolvers();
  await withSmcbPin(async ({ connector, requests }) => {
    const statusClient = open(), ongoing = maintainPin(connector, statusClient), release = await entered.promise;
    await assert.rejects(preparePin(connector, statusClient, { allowPrompt: true }), code('KIM_CONNECTOR_PIN_BUSY'));
    await assert.rejects(maintainPin(connector, statusClient), code('KIM_CONNECTOR_PIN_BUSY'));
    release(); (await ongoing).revalidate(); assert.equal(requests.filter(q => isMaintenance(q.bytes)).length, 1);
  }, event => isMaintenance(event.bytes) ? entered.resolve(() => maintenanceReply()(event)) : maintenanceReply()(event));
}));

test('SMC-B PIN maintenance: input guards and captured action/options prevent secrets or caller mutation from changing the operation', async () => fixture(async ({ open }) => withSmcbPin(async ({ connector, requests }) => {
  const statusClient = open();
  for (const changes of [{ action: undefined }, { action: ['change'] }, { action: '__proto__' }, { action: 'unblock' },
    { setNewPin: false }, { action: 'unblock', setNewPin: 'true' }, { pin: '123456' }, { puk: '12345678' }, { allowPrompt: 'true' }]) {
    await assert.rejects(maintainPin(connector, statusClient, changes), code('KIM_CONNECTOR_INPUT'));
  }
  assert.equal(requests.length, 0);
  const config = { connector, statusClient, expectedTelematikId: '10-LOCAL-TEST', requiredRoles: ['1.2.276.0.76.4.245'],
    action: 'unblock', setNewPin: false, allowPrompt: true };
  const ongoing = maintainSmcbPin(config); config.requiredRoles[0] = '1.2.3'; config.setNewPin = true; config.action = 'change';
  const r = await ongoing; r.revalidate(); assert.equal(r.action, 'unblock'); assert.equal(r.setNewPin, false);
  assert.equal(requests.find(q => isUnblockPin(q.bytes)).bytes.includes('<c:SetNewPin>false</c:SetNewPin>'), true);
}, maintenanceReply('BLOCKED'))));

for (const action of ['change', 'unblock']) test('SMC-B PIN maintenance: longer ' + action + ' obtains fresh evidence after a 45s logical wait', async () => fixture(async ({ open }) => withSmcbPin(async ({ connector }) => {
  const r = await maintainPin(connector, open(), { action, ...(action === 'unblock' ? { setNewPin: false } : {}) }); r.revalidate();
  assert.equal(r.attempt.checkedAt - r.attempt.startedAt, 45000);
  assert.ok(r.bundle.certificates.every(c => c.verification.checkedAt >= r.attempt.checkedAt));
}, event => { if (isMaintenance(event.bytes)) state.now += 45000; maintenanceReply(action === 'unblock' ? 'BLOCKED' : 'VERIFIABLE')(event); })));

test('SMC-B PIN maintenance: a negative fresh certificate status after the mutation remains unconfirmed', async () => fixture(async ({ open }) => withSmcbPin(async ({ connector }) => {
  await assert.rejects(maintainPin(connector, open()), unconfirmed('CERTIFICATE_REJECTED'));
}, event => event.bytes.includes('<c:VerifyCertificate') && maintenanceStarted(event)
  ? cardsReply(event.response, verificationResponse('INVALID')) : maintenanceReply()(event))));

test('SMC-B PIN maintenance: a foreign configured institution cannot start PIN management', async () => fixture(async ({ open }) => withSmcbPin(async ({ connector, requests }) => {
  await assert.rejects(maintainPin(connector, open(), { expectedTelematikId: '10-OTHER' }), code('KIM_CONNECTOR_SMCB_IDENTITY'));
  assert.equal(requests.length, 2); assert.equal(requests.some(q => isMaintenance(q.bytes)), false);
}, maintenanceReply())));

test('SMC-B PIN preflight: an already VERIFIED card needs no terminal prompt and remains held', async () => fixture(async ({ open }) => withSmcbPin(async ({ connector, requests }) => {
  const statusClient = open(), r = await preparePin(connector, statusClient); r.revalidate();
  assert.equal(assertPreparedSmcbPin(r, connector, statusClient), r);
  assert.equal(r.state, 'pin-verified'); assert.equal(r.identityStatus, 'unverified'); assert.equal(r.deliveryStatus, 'held-for-trust-validation');
  assert.equal(r.attempt, undefined); assert.equal(requests.length, 7); assert.equal(requests.some(q => isVerifyPin(q.bytes)), false);
  assert.equal(r.bundle.certificates.length, 3); assert.equal(r.status.selection, r.bundle.selection);
}, event => isPinStatus(event.bytes) ? cardsReply(event.response, pinResponse()) : smcbReply(event))));

test('SMC-B PIN preflight: one explicit prompt is followed by fresh card, three certificate and PIN checks', async () => fixture(async ({ open }) => withSmcbPin(async ({ connector, requests }) => {
  const statusClient = open(), r = await preparePin(connector, statusClient, { allowPrompt: true }); r.revalidate();
  assertPreparedSmcbPin(r, connector, statusClient); assert.equal(r.attempt.pinResult, 'OK'); assert.equal(requests.length, 15);
  assert.deepEqual(requests.map(q => q.bytes.toString().match(/<c:(GetCards|ReadCardCertificate|VerifyCertificate|GetPinStatus|VerifyPin)[ >]/)[1]),
    ['GetCards', 'ReadCardCertificate', 'VerifyCertificate', 'VerifyCertificate', 'VerifyCertificate', 'GetCards', 'GetPinStatus', 'VerifyPin',
      'GetCards', 'ReadCardCertificate', 'VerifyCertificate', 'VerifyCertificate', 'VerifyCertificate', 'GetCards', 'GetPinStatus']);
})));

test('SMC-B PIN preflight: a 45s logical terminal wait reacquires evidence instead of extending expired proofs', async () => fixture(async ({ open }) => withSmcbPin(async ({ connector, requests }) => {
  const r = await preparePin(connector, open(), { allowPrompt: true }); r.revalidate();
  assert.equal(r.attempt.checkedAt - r.attempt.startedAt, 45000); assert.equal(requests.length, 15);
  assert.ok(r.bundle.certificates.every(c => c.verification.checkedAt >= r.attempt.checkedAt));
  assert.ok(r.status.checkedAt >= r.attempt.checkedAt);
}, event => { if (isVerifyPin(event.bytes)) state.now += 45000; pinSmcbReply(event); })));

for (const [value, tries, expected] of [['VERIFIABLE', 1, 'pin-required'], ['BLOCKED', 0, 'pin-blocked'],
  ['TRANSPORT_PIN', null, 'pin-initialization-required'], ['EMPTY_PIN', null, 'pin-initialization-required']]) {
  test('SMC-B PIN preflight: ' + value + ' returns a bounded held state without an implicit prompt', async () => fixture(async ({ open }) => withSmcbPin(async ({ connector, requests }) => {
    const r = await preparePin(connector, open(), { allowPrompt: value !== 'VERIFIABLE' });
    assert.equal(r.state, expected); assert.equal(r.leftTries, tries); assert.equal(r.deliveryStatus, 'held-for-trust-validation');
    assert.equal(requests.length, 7); assert.equal(requests.some(q => isVerifyPin(q.bytes)), false);
  }, event => isPinStatus(event.bytes) ? cardsReply(event.response, pinResponse('GetPinStatus', value, tries)) : smcbReply(event))));
}

for (const [value, tries, expected] of [['REJECTED', 1, 'pin-rejected'], ['WASBLOCKED', null, 'pin-blocked'],
  ['NOWBLOCKED', 0, 'pin-blocked'], ['TRANSPORT_PIN', null, 'pin-initialization-required']]) {
  test('SMC-B PIN preflight: ' + value + ' stops after one terminal response', async () => fixture(async ({ open }) => withSmcbPin(async ({ connector, requests }) => {
    const statusClient = open(), r = await preparePin(connector, statusClient, { allowPrompt: true });
    assert.equal(r.state, expected); assert.equal(r.leftTries, tries); assert.equal(requests.length, 8);
    assert.throws(() => assertPreparedSmcbPin(r, connector, statusClient), code('KIM_CONNECTOR_EVIDENCE_BINDING'));
  }, event => isVerifyPin(event.bytes) ? cardsReply(event.response, pinResponse('VerifyPin', value, tries)) : pinSmcbReply(event))));
}

for (const [label, cards, expected] of [['removal', [], 'CARD_NOT_FOUND'],
  ['new handle', [cardData({ cardHandle: 'SMCB-NEW' })], 'CARD_CHANGED'],
  ['new insertion', [cardData({ insertTime: '2026-10-22T00:00:00.000001Z' })], 'CARD_CHANGED']]) {
  test('SMC-B PIN preflight: ' + label + ' during terminal entry cannot retain its old identity', async () => fixture(async ({ open }) => withSmcbPin(async ({ connector }) => {
    await assert.rejects(preparePin(connector, open(), { allowPrompt: true }), code('KIM_CONNECTOR_' + expected));
  }, event => isCards(event.bytes) && attemptedPin(event) ? cardsReply(event.response, cardsResponse(cards)) : pinSmcbReply(event))));
}

test('SMC-B PIN preflight: changing an otherwise valid ENC certificate after the prompt fails its exact binding', async () => fixture(async ({ open }) => withSmcbPin(async ({ connector }) => {
  await assert.rejects(preparePin(connector, open(), { allowPrompt: true }), code('KIM_CONNECTOR_CERTIFICATE_BINDING'));
}, event => isReadCards(event.bytes) && attemptedPin(event) ? cardsReply(event.response, certificatesResponse([
  ['C.AUT', authentication.certificate], ['C.ENC', encryption[1].certificate], ['C.SIG', signing.certificate],
])) : pinSmcbReply(event))));

test('SMC-B PIN preflight: an INVALID certificate after terminal success cannot borrow pre-prompt evidence', async () => fixture(async ({ open }) => withSmcbPin(async ({ connector }) => {
  await assert.rejects(preparePin(connector, open(), { allowPrompt: true }), code('KIM_CONNECTOR_CERTIFICATE_REJECTED'));
}, event => event.bytes.includes('<c:VerifyCertificate') && attemptedPin(event)
  ? cardsReply(event.response, verificationResponse('INVALID')) : pinSmcbReply(event))));

test('SMC-B PIN preflight: revoked post-prompt AUT is checked against signed OCSP before accepting the card', async () => fixture(async ({ open }) => {
  const startDate = new Date(f.now - 86400000).toISOString().replace(/[-:T]/g, '').slice(0, 14) + 'Z';
  const issued = await f.pki.issueAut({ name: 'pin-post-aut', startDate }), changed = issued.certificate;
  state.certificates = [{ certificate: changed }];
  state.handler = (req, res, bytes) => {
    if (!req.url.startsWith('/leaf-') || !bytes.equals(f.proof(changed).request)) return false;
    res.writeHead(200, { 'Content-Type': 'application/ocsp-response' }); res.end(f.proof(changed, { state: 'revoked', producedAt: state.now }).response); return true;
  };
  await withSmcbPin(async ({ connector, requests }) => {
    await assert.rejects(preparePin(connector, open(), { allowPrompt: true }), code('KIM_CONNECTOR_SMCB_STATUS'));
    assert.equal(requests.filter(q => isVerifyPin(q.bytes)).length, 1);
    assert.equal(requests.filter(q => isReadCards(q.bytes)).length, 2);
  }, event => isReadCards(event.bytes) && attemptedPin(event)
    ? cardsReply(event.response, certificatesResponse([['C.AUT', changed], ...smcbCertificates().slice(1)])) : pinSmcbReply(event));
}));

test('SMC-B PIN preflight: terminal OK without a fresh VERIFIED status yields no prepared result', async () => fixture(async ({ open }) => withSmcbPin(async ({ connector }) => {
  await assert.rejects(preparePin(connector, open(), { allowPrompt: true }), code('KIM_CONNECTOR_PIN_NOT_VERIFIED'));
}, event => isPinStatus(event.bytes) ? cardsReply(event.response, pinResponse('GetPinStatus', 'VERIFIABLE', 3)) : pinSmcbReply(event))));

test('SMC-B PIN preflight: a TSL refresh during final PIN status invalidates freshly collected certificate evidence', async () => fixture(async ({ open, manager }) => withSmcbPin(async ({ connector }) => {
  await assert.rejects(preparePin(connector, open(), { allowPrompt: true }), code('KIM_CONNECTOR_SMCB_STATUS'));
}, async event => {
  if (isPinStatus(event.bytes) && attemptedPin(event)) await manager.refresh();
  pinSmcbReply(event);
})));

test('SMC-B PIN preflight: abort after terminal success cannot return a prepared result', async () => fixture(async ({ open }) => {
  const controller = new AbortController();
  await withSmcbPin(async ({ connector }) => {
    await assert.rejects(preparePin(connector, open(), { allowPrompt: true, signal: controller.signal }), code('KIM_CONNECTOR_ABORTED'));
  }, event => { if (isPinStatus(event.bytes) && attemptedPin(event)) controller.abort(); pinSmcbReply(event); });
}));

test('SMC-B PIN preflight: copied results, foreign clients and later PIN acquisition cannot reuse prepared evidence', async () => fixture(async ({ open }) => withSmcbPin(async ({ connector }) => {
  const statusClient = open(), r = await preparePin(connector, statusClient, { allowPrompt: true });
  assert.throws(() => assertPreparedSmcbPin({ ...r }, connector, statusClient), code('KIM_CONNECTOR_EVIDENCE_BINDING'));
  assert.throws(() => assertPreparedSmcbPin(r, connector, open()), code('KIM_CONNECTOR_EVIDENCE_BINDING'));
  assert.throws(() => assertPreparedSmcbPin(r, {}, statusClient), code('KIM_CONNECTOR_EVIDENCE_BINDING'));
  await connector.getSmcbPinStatus({ selection: r.bundle.selection });
  assert.throws(() => assertPreparedSmcbPin(r, connector, statusClient), code('KIM_CONNECTOR_PIN_STATUS_STALE'));
})));

test('SMC-B PIN preflight: simultaneous preparations cannot duplicate the terminal workflow', async () => fixture(async ({ open }) => {
  const entered = Promise.withResolvers();
  await withSmcbPin(async ({ connector, requests }) => {
    const statusClient = open(), first = preparePin(connector, statusClient, { allowPrompt: true });
    const release = await entered.promise;
    await assert.rejects(preparePin(connector, statusClient, { allowPrompt: true }), code('KIM_CONNECTOR_PIN_BUSY'));
    release(); (await first).revalidate(); assert.equal(requests.filter(q => isVerifyPin(q.bytes)).length, 1);
  }, event => isVerifyPin(event.bytes) ? entered.resolve(() => pinSmcbReply(event)) : pinSmcbReply(event));
}));

test('SMC-B PIN preflight: configured roles are snapshotted and PIN input/implicit prompt flags are rejected', async () => fixture(async ({ open }) => withSmcbPin(async ({ connector, requests }) => {
  const requiredRoles = ['1.2.276.0.76.4.245'], statusClient = open();
  for (const changes of [{ pin: '123456' }, { puk: '12345678' }, { allowPrompt: 'true' }]) {
    await assert.rejects(preparePin(connector, statusClient, changes), code('KIM_CONNECTOR_INPUT'));
  }
  assert.equal(requests.length, 0);
  const promise = preparePin(connector, statusClient, { requiredRoles, allowPrompt: true }); requiredRoles[0] = '1.2.3';
  const r = await promise; assert.deepEqual(r.bundle.professionOids, ['1.2.276.0.76.4.245']); r.revalidate();
})));

test('SMC-B: fresh GetCards, actual DER, local status, VerifyCertificate and final GetCards compose a held result', async () => fixture(async ({ open }) => withSmcb(async ({ connector, requests }) => {
  const r = await readSmcb(connector, open()); r.revalidate();
  assert.equal(requests.length, 6); assert.equal(isCards(requests[0].bytes), true); assert.equal(isReadCards(requests[1].bytes), true);
  assert.equal(isCards(requests.at(-1).bytes), true); assert.ok(requests[1].bytes.includes('<n:CardHandle>SMCB-1</n:CardHandle>'));
  assert.deepEqual(r.certificates.map(c => c.certificate), smcbCertificates().map(([, c]) => raw(c)));
  assert.deepEqual(leafPurposes(), ['authentication', 'encryption', 'signing']);
  assert.deepEqual(r.certificates.map(c => c.certificateTypeOid), ['1.2.276.0.76.4.77', '1.2.276.0.76.4.76', '1.2.276.0.76.4.78']);
  assert.equal(r.identityStatus, 'unverified'); assert.equal(r.deliveryStatus, 'held-for-trust-validation');
  assert.doesNotMatch(JSON.stringify(r), /PRIVATE CARDHOLDER|K123456789|PRIVATE SECRET/);
  r.certificates[0].certificate.fill(0); assert.throws(r.revalidate, code('KIM_CONNECTOR_SMCB_STATUS'));
})));

for (const count of [0, 2]) test('SMC-B: ' + count + ' possible cards cannot trigger certificate or status calls', async () => fixture(async ({ open }) => withSmcb(async ({ connector, requests }) => {
  await assert.rejects(readSmcb(connector, open()), code(count === 0 ? 'KIM_CONNECTOR_CARD_NOT_FOUND' : 'KIM_CONNECTOR_CARD_AMBIGUOUS'));
  assert.equal(requests.length, 1); assert.equal(leafCount(), 0);
}, ({ response }) => cardsReply(response, cardsResponse(count === 0 ? [] : [cardData(), cardData({ cardHandle: 'SMCB-2', slotId: 2, iccsn: '80276000000000000002' })])))));

test('SMC-B: explicit serial chooses the requested card among two without trusting the display name', async () => fixture(async ({ open }) => withSmcb(async ({ connector, requests }) => {
  const r = await readSmcb(connector, open(), { iccsn: '80276000000000000002' });
  assert.equal(r.selection.card.cardHandle, 'SMCB-2'); assert.equal(requests[1].bytes.includes('<n:CardHandle>SMCB-2</n:CardHandle>'), true); r.revalidate();
}, event => isCards(event.bytes) ? cardsReply(event.response, cardsResponse([cardData(), cardData({ cardHandle: 'SMCB-2', slotId: 2, iccsn: '80276000000000000002' })])) : smcbReply(event))));

for (const outcome of ['revoked', 'unknown']) test('SMC-B: locally ' + outcome + ' AUT cannot reach VerifyCertificate or later roles', async () => fixture(async ({ open }) => {
  state.authentication = outcome;
  await withSmcb(async ({ connector, requests }) => {
    await assert.rejects(readSmcb(connector, open()), code('KIM_CONNECTOR_SMCB_STATUS'));
    assert.equal(requests.length, 2); assert.deepEqual(leafPurposes(), ['authentication']);
  });
}));

for (const condition of ['foreign configured identity', 'foreign AUT identity', 'foreign AUT role', 'wrong reference', 'missing certificate']) test('SMC-B: ' + condition + ' cannot become a matching institution', async () => fixture(async ({ open }) => {
  let cert = authentication.certificate;
  if (condition === 'foreign AUT identity' || condition === 'foreign AUT role') {
    cert = withAdmission(cert, admissionDer(condition === 'foreign AUT identity' ? { telematikId: '10-OTHER' } : { professionOid: '1.2.276.0.76.4.242' }), rootKey);
    state.certificates = [{ certificate: cert }];
  }
  const expected = condition === 'missing certificate' ? 'CERTIFICATE_MISSING' : condition === 'wrong reference' ? 'SMCB_STATUS' : 'SMCB_IDENTITY';
  await withSmcb(async ({ connector, requests }) => {
    await assert.rejects(readSmcb(connector, open(), condition === 'foreign configured identity' ? { expectedTelematikId: '10-NOT-THIS-INSTITUTION' } : {}), code('KIM_CONNECTOR_' + expected));
    assert.equal(requests.length, 2);
  }, event => isReadCards(event.bytes) ? cardsReply(event.response, certificatesResponse([
    ['C.AUT', condition === 'missing certificate' ? null : condition === 'wrong reference' ? signing.certificate : cert], ...smcbCertificates().slice(1),
  ])) : smcbReply(event));
}));

test('SMC-B: an otherwise valid professional HBA AUT is not an institutional AUT', async () => fixture(async ({ open }) => {
  const startDate = new Date(f.now - 86400000).toISOString().replace(/[-:T]/g, '').slice(0, 14) + 'Z';
  const leaf = await f.pki.issueAut({ name: 'smcb-hba', policy: '1.2.276.0.76.4.75', startDate }); state.certificates = [leaf];
  const statusClient = open(), valid = await statusClient.check({ certificate: leaf.certificate, purpose: 'authentication' });
  assert.equal(valid.status, 'good'); assert.equal(valid.certificateTypeOid, '1.2.276.0.76.4.75');
  await withSmcb(async ({ connector }) => {
    await assert.rejects(readSmcb(connector, statusClient, { requiredRoles: valid.admission.professionOids }), code('KIM_CONNECTOR_SMCB_IDENTITY'));
  }, event => isReadCards(event.bytes) ? cardsReply(event.response, certificatesResponse([['C.AUT', leaf.certificate], ...smcbCertificates().slice(1)])) : smcbReply(event));
}));

for (const status of ['INVALID', 'INCONCLUSIVE']) test('SMC-B: Konnektor ' + status + ' cannot reuse good local status', async () => fixture(async ({ open }) => withSmcb(async ({ connector, requests }) => {
  await assert.rejects(readSmcb(connector, open()), code('KIM_CONNECTOR_CERTIFICATE_REJECTED'));
  assert.equal(requests.length, 3); assert.deepEqual(leafPurposes(), ['authentication']);
}, event => isCards(event.bytes) || isReadCards(event.bytes) ? smcbReply(event) : cardsReply(event.response, verificationResponse(status)))));

const cardChanges = [
  ['removed', () => [], 'CARD_NOT_FOUND'],
  ['reinserted handle', () => [cardData({ cardHandle: 'SMCB-NEW' })], 'CARD_CHANGED'],
  ['insertion time', () => [cardData({ insertTime: '2026-10-22T00:00:01Z' })], 'CARD_CHANGED'],
  ['submillisecond insertion time', () => [cardData({ insertTime: '2026-10-22T00:00:00.000001Z' })], 'CARD_CHANGED'],
  ['card serial', () => [cardData({ iccsn: '80276000000000000002' })], 'CARD_NOT_FOUND'],
  ['terminal', () => [cardData({ ctId: 'OTHER' })], 'CARD_NOT_FOUND'],
  ['card version', () => [cardData({ cardVersion: { COSVersion: [4, 5, 1], ObjectSystemVersion: [4, 5, 0] } })], 'CARD_CHANGED'],
];
for (const [name, change, expected] of cardChanges) test('SMC-B: ' + name + ' during verification cannot preserve the old card binding', async () => fixture(async ({ open }) => withSmcb(async ({ connector, requests }) => {
  await assert.rejects(readSmcb(connector, open()), code('KIM_CONNECTOR_' + expected)); assert.equal(requests.length, 6);
}, event => isCards(event.bytes) && event.requests.filter(q => isCards(q.bytes)).length === 2
  ? cardsReply(event.response, cardsResponse(change())) : smcbReply(event))));

test('SMC-B: a TSL refresh during final GetCards invalidates all earlier local status proofs', async () => fixture(async ({ open, manager }) => withSmcb(async ({ connector }) => {
  await assert.rejects(readSmcb(connector, open()), code('KIM_CONNECTOR_SMCB_STATUS'));
}, async event => {
  if (isCards(event.bytes) && event.requests.filter(q => isCards(q.bytes)).length === 2) await manager.refresh();
  smcbReply(event);
})));

test('SMC-B: abort during final GetCards cannot return a previous positive result', async () => fixture(async ({ open }) => {
  const controller = new AbortController();
  await withSmcb(async ({ connector }) => {
    await assert.rejects(readSmcb(connector, open(), { signal: controller.signal }), code('KIM_CONNECTOR_ABORTED'));
  }, event => {
    if (isCards(event.bytes) && event.requests.filter(q => isCards(q.bytes)).length === 2) controller.abort();
    smcbReply(event);
  });
}));

test('SMC-B: later card refresh invalidates the complete returned bundle and caller role mutation changes no request', async () => fixture(async ({ open }) => {
  const requiredRoles = ['1.2.276.0.76.4.245'];
  await withSmcb(async ({ connector }) => {
    const r = await readSmcb(connector, open(), { requiredRoles });
    assert.deepEqual(r.professionOids, ['1.2.276.0.76.4.245']); r.revalidate();
    await connector.getCards(); assert.throws(r.revalidate, code('KIM_CONNECTOR_CARD_SNAPSHOT_STALE'));
  }, event => { requiredRoles[0] = '1.2.3'; smcbReply(event); });
}));

test('SMC-B: missing identity, roles, real clients or matching environment fail before network', async () => fixture(async ({ open }) => withSmcb(async ({ connector, requests }) => {
  const statusClient = open();
  for (const change of [{ expectedTelematikId: undefined }, { expectedTelematikId: 'bad' }, { requiredRoles: [] },
    { requiredRoles: ['bad'] }, { requiredRoles: Array(1) }, { connector: {} }, { statusClient: {} },
    { connector: Object.create(Object.getPrototypeOf(connector)) }, { statusClient: Object.create(Object.getPrototypeOf(statusClient)) }]) {
    await assert.rejects(readSmcb(connector, statusClient, change), code('KIM_CONNECTOR_CONFIGURATION'));
  }
  assert.equal(requests.length, 0); assert.equal(leafCount(), 0);
  await withSmcb(async ({ connector: foreign, requests: otherRequests }) => {
    await assert.rejects(readSmcb(foreign, statusClient), code('KIM_CONNECTOR_CONFIGURATION')); assert.equal(otherRequests.length, 0);
  }, undefined, { environment: 'production' });
})));

async function withConnector(run, handler, changes) {
  const connector = await connectorFixture(f.pki, handler, changes);
  try { await run(connector); } finally { await connector.close(); }
}
const connectorReply = (response, value) => { response.writeHead(200, { 'Content-Type': 'text/xml; charset=utf-8' }); response.end(value); };

test('KIM Konnektor: real VerifyCertificate checks OSIG and preserves the no-AUT branch as diagnosis only', async () => fixture(async ({ open }) => withConnector(async ({ open: openConnector, requests: soapRequests }) => withDirectory(async ({ directory }) => {
  const r = await receiveEccKimMessageWithTsl(wire, report, { statusClient: open(), directory, connector: openConnector() });
  assert.equal(r.diagnostic.integrityResult, '07'); assert.equal(r.authenticationAssessment.state, 'not-required');
  assert.equal(soapRequests.length, 1); assert.equal(soapRequests[0].bytes.includes(raw(signing.certificate).toString('base64')), true);
  assert.equal(r.connectorAcquisition.certificates.signing.verificationResult, 'VALID');
  assert.equal(r.connectorAcquisition.certificates.authentication, undefined); assert.equal(r.deliveryStatus, 'diagnostic-only');
  assert.equal(r.diagnostic.decryptedOriginalAttached, false);
}))));

for (const condition of ['INVALID', 'INCONCLUSIVE', 'role', 'fault', 'malformed']) test('KIM Konnektor: ' + condition + ' cannot fall back to good local OCSP or start LDAP', async () => fixture(async ({ open }) => withConnector(async ({ open: openConnector, requests: soapRequests }) => withDirectory(async ({ directory, requests }) => {
  const r = await receiveEccKimMessageWithTsl({ ...wire, connectorAcquisition: { state: 'VALID' } }, report, { statusClient: open(), directory, connector: openConnector() });
  assert.equal(r.diagnostic.integrityResult, 'XCS_CERT_STATUS'); assert.equal(r.diagnostic.certificateStatus[0].status, 'unavailable');
  assert.equal(r.authenticationAssessment.state, 'not-checked'); assert.equal(requests.length, 0); assert.equal(soapRequests.length, 1);
  assert.equal(r.deliveryStatus, 'diagnostic-only'); assert.deepEqual(leafPurposes(), ['signing']);
  const expected = { INVALID: 'CERTIFICATE_REJECTED', INCONCLUSIVE: 'CERTIFICATE_REJECTED', role: 'ROLE', fault: 'SOAP_FAULT', malformed: 'XML_PROFILE' };
  assert.equal(r.diagnostic.certificateStatus[0].code, 'KIM_CONNECTOR_' + expected[condition]);
  if (condition === 'INVALID' || condition === 'INCONCLUSIVE') assert.equal(r.connectorAcquisition.certificates.signing.verificationResult, condition);
}, undefined), ({ response }) => connectorReply(response, condition === 'role' ? verificationResponse('VALID', ['1.2.276.0.76.4.171'])
  : condition === 'fault' ? faultResponse() : condition === 'malformed' ? '<invalid/>' : verificationResponse(condition)))));

test('KIM Konnektor: required AUT uses the actual x5c leaf and INVALID prevents sender binding', async () => fixture(async ({ open }) => {
  const changed = separateSigningIdentity(), bytes = directoryAutWire({ signingCertificate: changed });
  await withConnector(async ({ open: openConnector, requests: soapRequests }) => withDirectory(async ({ directory }) => {
    const r = await receiveEccKimMessageWithTsl({ ...wire, bytes, expectedSignerCertificate: changed, expectedAuthCertificate: undefined }, report,
      { statusClient: open(), directory, connector: openConnector() });
    assert.equal(r.diagnostic.integrityResult, 'XCS_CERT_STATUS'); assert.equal(r.authenticationAssessment.state, 'rejected');
    assert.equal(soapRequests.length, 2); assert.equal(soapRequests[1].bytes.includes(raw(authentication.certificate).toString('base64')), true);
    assert.equal(r.connectorAcquisition.certificates.authentication.verificationResult, 'INVALID');
    assert.equal(r.directoryAcquisition.state, 'mismatch'); assert.equal(r.deliveryStatus, 'diagnostic-only');
  }), ({ response, bytes }) => connectorReply(response, verificationResponse(bytes.includes(raw(authentication.certificate).toString('base64')) ? 'INVALID' : 'VALID')));
}));

test('KIM Konnektor: closing the connector during LDAP invalidates its earlier VALID result', async () => fixture(async ({ open }) => withConnector(async ({ open: openConnector }) => {
  const connector = openConnector();
  await withDirectory(async ({ directory }) => {
    const r = await receiveEccKimMessageWithTsl(wire, report, { statusClient: open(), directory, connector });
    assert.equal(r.diagnostic.integrityResult, 'XCS_CERT_STATUS'); assert.equal(r.diagnostic.certificateStatus[0].code, 'KIM_CONNECTOR_CLOSED');
    assert.equal(r.authenticationAssessment.state, 'not-checked');
  }, ({ socket, address }) => { connector.close(); socket.write(Buffer.concat([entryReply(record(address, [encryption[0].certificate])), searchDone()])); });
})));

test('KIM Konnektor: different OSIG identity requires positive OSIG and AUT operations for the same directory record', async () => fixture(async ({ open }) => {
  const changed = separateSigningIdentity(), bytes = directoryAutWire({ signingCertificate: changed });
  await withConnector(async ({ open: openConnector, requests: soapRequests }) => withDirectory(async ({ directory }) => {
    const r = await receiveEccKimMessageWithTsl({ ...wire, bytes, expectedSignerCertificate: changed, expectedAuthCertificate: undefined }, report,
      { statusClient: open(), directory, connector: openConnector() });
    assert.equal(r.diagnostic.integrityResult, '07'); assert.equal(r.authenticationAssessment.state, 'checked');
    assert.equal(r.directoryAcquisition.matchedBy, 'authentication'); assert.equal(soapRequests.length, 2);
    assert.equal(soapRequests[0].bytes.includes(raw(changed).toString('base64')), true);
    assert.equal(soapRequests[1].bytes.includes(raw(authentication.certificate).toString('base64')), true);
    assert.equal(r.connectorAcquisition.certificates.authentication.verificationResult, 'VALID');
    assert.equal(r.deliveryStatus, 'diagnostic-only'); assert.equal(r.identityStatus, 'unverified');
  }));
}));

test('KIM Konnektor: environment mismatch, missing directory and fabricated client fail before network', async () => fixture(async ({ open }) => withConnector(async ({ open: openConnector, requests: soapRequests }) => withDirectory(async ({ directory, requests }) => {
  const statusClient = open();
  for (const config of [{ connector: {} }, { connector: openConnector({ environment: 'production' }) }, { connector: openConnector(), directory: undefined }]) {
    await assert.rejects(receiveEccKimMessageWithTsl(wire, report, { statusClient, directory, ...config }), code('KIM_TSL_STATUS_CONFIGURATION'));
  }
  assert.equal(soapRequests.length, 0); assert.equal(requests.length, 0); assert.equal(leafCount(), 0);
}))));

// Real signed/encrypted messages with controlled AUT inputs. Changing a token
// here always re-signs the inner message, so failures cannot be hidden by a
// broken CMS signature or merely simulated status flags.
function directoryToken({ claims = {}, headers = {}, rawClaims, key = authKey } = {}) {
  const token = createEccKimAuth({ sender: senderAddress, certificate: authentication.certificate,
    privateKey: authKey, ...report, now: f.now }).slice(7).split('.');
  const h = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(token[0], 'base64url')), ...headers })).toString('base64url');
  const p = Buffer.from(rawClaims ?? JSON.stringify({ ...JSON.parse(Buffer.from(token[1], 'base64url')), ...claims })).toString('base64url');
  return `Bearer ${h}.${p}.${sign('sha256', Buffer.from(`${h}.${p}`), { key, dsaEncoding: 'ieee-p1363' }).toString('base64url')}`;
}
function replaceDirectoryAuth(message, tokens) {
  const parsed = readMessage(message), headers = parsed.headers.filter(h => h.name !== 'x-kim-auth').map(h => h.raw);
  for (const token of tokens) headers.push(`X-KIM-Auth: ${token.match(/.{1,76}/g).join('\r\n ')}`);
  return Buffer.concat([Buffer.from(headers.join('\r\n') + '\r\n\r\n'), parsed.body]);
}
function directoryAutWire({ innerAuth = [directoryToken()], outerAuth = innerAuth, signingCertificate = signing.certificate, key = signingKey } = {}) {
  const opened = openEccKimMessage(wire), inner = replaceDirectoryAuth(opened.message, innerAuth);
  try {
    const cms = sealEccKimPayload({ message: inner, sender: senderAddress,
      recipients: [{ address: senderAddress, certificate: encryption[0].certificate }, { address: receiverAddress, certificate: encryption[1].certificate }],
      signingCertificate, signingKey: key, now: f.now });
    const outer = readMessage(replaceDirectoryAuth(wire.bytes, outerAuth));
    return Buffer.concat([Buffer.from(outer.headers.map(h => h.raw).join('\r\n') + '\r\n\r\n'),
      Buffer.from(cms.toString('base64').match(/.{1,76}/g).join('\r\n') + '\r\n')]);
  } finally { inner.fill(0); opened.message.fill(0); }
}
function separateSigningIdentity() {
  const changed = withAdmission(signing.certificate, admissionDer({ telematikId: '10-SEPARATE-SIGNER' }), rootKey);
  state.handler = (req, res, _bytes, purpose) => {
    if (!req.url.startsWith('/leaf-') || purpose !== 'signing') return false;
    res.writeHead(200, { 'Content-Type': 'application/ocsp-response' }); res.end(f.proof(changed).response); return true;
  };
  return changed;
}
const leafPurposes = () => state.calls.filter(c => c.path.startsWith('/leaf-')).map(c => c.purpose);
const autVariants = [
  ['absent', () => ({ innerAuth: [] })],
  ['inner only', () => ({ outerAuth: [] })],
  ['outer only', () => ({ innerAuth: [], outerAuth: [directoryToken()] })],
  ['duplicate inner', () => { const t = directoryToken(); return { innerAuth: [t, t], outerAuth: [t] }; }],
  ['duplicate outer', () => { const t = directoryToken(); return { innerAuth: [t], outerAuth: [t, t] }; }],
  ['unequal tokens', () => ({ innerAuth: [directoryToken()], outerAuth: [directoryToken()] })],
  ['malformed', () => ({ innerAuth: ['Bearer INVALID.PRIVATE.TOKEN'] })],
  ['bad signature', () => ({ innerAuth: [directoryToken({ key: signingKey })] })],
  ['wrong audience', () => ({ innerAuth: [directoryToken({ claims: { aud: 'other' } })] })],
  ['wrong sender', () => ({ innerAuth: [directoryToken({ claims: { sub: receiverAddress } })] })],
  ['future nbf', () => ({ innerAuth: [directoryToken({ claims: { nbf: Math.floor(f.now / 1000) + 1 } })] })],
  ['wrong issuer', () => ({ innerAuth: [directoryToken({ claims: { iss: 'TEST_9.0.0' } })] })],
  ['wrong algorithm', () => ({ innerAuth: [directoryToken({ headers: { alg: 'ES256' } })] })],
  ['duplicate claims', () => ({ innerAuth: [directoryToken({ rawClaims: '{"sub":"ignored","s\\u0075b":"other"}' })] })],
];
for (const [label, input] of autVariants) {
  test('Conditional AUT: matching OSIG skips ' + label + ' AUT without asserting it good', async () => fixture(async ({ open }) => {
    const bytes = directoryAutWire(input()); state.authentication = 'revoked';
    await withDirectory(async ({ directory }) => {
      const r = await receiveDirectory(directory, open(), { bytes, expectedAuthCertificate: Buffer.from('invalid unused pin') });
      assert.equal(r.diagnostic.integrityResult, '07'); assert.equal(r.directoryAcquisition.matchedBy, 'signing');
      assert.deepEqual(r.authenticationAssessment, { state: 'not-required', reason: 'signing-address-match' });
      assert.equal(r.directoryAcquisition.authenticationMatches, undefined);
      assert.deepEqual(r.diagnostic.certificateStatus.map(s => [s.purpose, s.status]), [['signing', 'good']]);
      assert.equal(r.statusAcquisition.certificateAdmissions.authentication, undefined);
      assert.deepEqual(leafPurposes(), ['signing', 'directory']);
      assert.equal(r.deliveryStatus, 'diagnostic-only'); assert.equal(r.diagnostic.decryptedOriginalAttached, false);
    });
  }));
  test('Conditional AUT: different OSIG rejects ' + label + ' AUT before its OCSP request', async () => fixture(async ({ open }) => {
    const changed = separateSigningIdentity(), bytes = directoryAutWire({ ...input(), signingCertificate: changed });
    await withDirectory(async ({ directory, requests }) => {
      const r = await receiveDirectory(directory, open(), { bytes, expectedSignerCertificate: changed, expectedAuthCertificate: undefined });
      assert.equal(r.diagnostic.integrityResult, '10'); assert.equal(r.authenticationAssessment.state, 'rejected');
      assert.equal(r.authenticationAssessment.reason, 'token'); assert.equal(r.directoryAcquisition.state, 'mismatch');
      assert.deepEqual(leafPurposes(), ['signing', 'directory']); assert.equal(requests.length, 2);
      assert.equal(r.diagnostic.decryptedOriginalAttached, false); assert.equal(r.bytes.includes('PRIVATE LOCAL STATUS TEST'), false);
      assert.doesNotMatch(JSON.stringify(r.diagnostic), /Bearer|INVALID.PRIVATE.TOKEN|PRIVATE LOCAL STATUS TEST/);
    });
  }));
}

test('Conditional AUT: the actual embedded leaf binds From without an AUT pin or FD submission TTL', async () => fixture(async ({ open }) => {
  const changed = separateSigningIdentity(), bytes = directoryAutWire({ signingCertificate: changed,
    innerAuth: [directoryToken({ claims: { nbf: Math.floor(f.now / 1000) - 3 * 86400 } })] });
  await withDirectory(async ({ directory, requests }) => {
    const r = await receiveDirectory(directory, open(), { bytes, expectedSignerCertificate: changed, expectedAuthCertificate: undefined });
    assert.equal(r.directoryAcquisition.matchedBy, 'authentication'); assert.equal(r.directoryAcquisition.authenticationMatches, true);
    assert.equal(r.authenticationAssessment.state, 'checked'); assert.equal(r.authenticationAssessment.certificateSha256, hash(raw(authentication.certificate)));
    assert.deepEqual(leafPurposes(), ['signing', 'directory', 'authentication']); assert.equal(requests.length, 2);
    assert.equal(r.statusAcquisition.certificateAdmissions.authentication.telematikId, '10-LOCAL-TEST');
    assert.deepEqual(r.diagnostic.certificateStatus.map(s => [s.purpose, s.status]), [['signing', 'good'], ['authentication', 'good']]);
    assert.equal(r.diagnostic.integrityResult, '07'); assert.equal(r.identityStatus, 'unverified'); assert.equal(r.deliveryStatus, 'diagnostic-only');
  });
}));

test('Conditional AUT: an optional AUT pin still has to match the embedded leaf', async () => fixture(async ({ open }) => {
  const changed = separateSigningIdentity(), bytes = directoryAutWire({ signingCertificate: changed });
  await withDirectory(async ({ directory }) => {
    const r = await receiveDirectory(directory, open(), { bytes, expectedSignerCertificate: changed, expectedAuthCertificate: signing.certificate });
    assert.equal(r.diagnostic.integrityResult, '10'); assert.deepEqual(leafPurposes(), ['signing', 'directory']);
  });
}));

for (const negative of ['revoked', 'unknown', 'unavailable']) test('Conditional AUT: ' + negative + ' required AUT status cannot bind the sender', async () => fixture(async ({ open }) => {
  const changed = separateSigningIdentity(), bytes = directoryAutWire({ signingCertificate: changed }), handler = state.handler;
  state.authentication = negative;
  if (negative === 'unavailable') state.handler = (req, res, body, purpose) => {
    if (purpose === 'authentication') { res.writeHead(503); res.end(); return true; }
    return handler(req, res, body, purpose);
  };
  await withDirectory(async ({ directory }) => {
    const r = await receiveDirectory(directory, open(), { bytes, expectedSignerCertificate: changed, expectedAuthCertificate: undefined });
    assert.equal(r.diagnostic.integrityResult, 'XCS_CERT_STATUS'); assert.equal(r.authenticationAssessment.reason, 'certificate-status');
    assert.equal(r.diagnostic.certificateStatus[1].status, negative); assert.equal(r.directoryAcquisition.state, 'mismatch');
    assert.equal(r.directoryAcquisition.authenticationMatches, undefined); assert.equal(r.statusAcquisition.state, 'incomplete');
  });
}));

test('Conditional AUT: a mathematical AUT with an untrusted issuer signature does not establish trust', async () => fixture(async ({ open }) => {
  const changed = separateSigningIdentity(), bad = Buffer.from(raw(authentication.certificate)); bad[bad.length - 1] ^= 1;
  const bytes = directoryAutWire({ signingCertificate: changed, innerAuth: [directoryToken({ headers: { x5c: [bad.toString('base64')] } })] });
  await withDirectory(async ({ directory }) => {
    const r = await receiveDirectory(directory, open(), { bytes, expectedSignerCertificate: changed, expectedAuthCertificate: undefined });
    assert.equal(r.diagnostic.integrityResult, 'XCS_CERT_STATUS'); assert.equal(r.diagnostic.certificateStatus[1].status, 'unavailable');
    assert.deepEqual(leafPurposes(), ['signing', 'directory']);
  });
}));

test('Conditional AUT: unsupported certificate role or missing Admission is rejected before AUT status I/O', async () => fixture(async ({ open }) => {
  const changed = separateSigningIdentity();
  for (const certificate of [raw(signing.certificate), withAdmission(authentication.certificate, undefined, rootKey)]) {
    const bytes = directoryAutWire({ signingCertificate: changed, innerAuth: [directoryToken({ headers: { x5c: [certificate.toString('base64')] } })] });
    await withDirectory(async ({ directory }) => {
      const r = await receiveDirectory(directory, open(), { bytes, expectedSignerCertificate: changed, expectedAuthCertificate: undefined });
      assert.equal(r.diagnostic.integrityResult, '10'); assert.equal(state.calls.some(c => c.purpose === 'authentication'), false);
    });
  }
}));

test('Conditional AUT: caller flags and overridden status methods cannot bypass a negative OSIG status', async () => fixture(async ({ options }) => withDirectory(async ({ directory, requests }) => {
  class UntrustedOverrides extends TslOcspStatusClient {
    async check() { throw new Error('override must not be used'); }
    async messageEvidence() { throw new Error('override must not be used'); }
  }
  state.signing = 'unknown'; const client = new UntrustedOverrides(options);
  try {
    const r = await receiveDirectory(directory, client, { skipAuth: true, directoryRejected: false,
      authenticationAssessment: { state: 'not-required' }, ocsp: { status: 'good' }, bytes: directoryAutWire({ innerAuth: [] }) });
    assert.equal(r.diagnostic.integrityResult, 'XCS_CERT_STATUS'); assert.equal(r.diagnostic.certificateStatus[0].status, 'unknown');
    assert.equal(r.authenticationAssessment.state, 'not-checked'); assert.equal(requests.length, 0); assert.deepEqual(leafPurposes(), ['signing']);
  } finally { client.close(); }
})));

test('Conditional AUT: an ambiguous directory cannot select the AUT branch', async () => fixture(async ({ open }) => withDirectory(async ({ directory }) => {
  const r = await receiveDirectory(directory, open());
  assert.equal(r.diagnostic.integrityResult, 'XCS_DIRECTORY'); assert.equal(r.authenticationAssessment.state, 'not-checked');
  assert.deepEqual(leafPurposes(), ['signing', 'directory']);
}, ({ socket, address }) => { const e = entryReply(record(address, [encryption[0].certificate])); socket.write(Buffer.concat([e, e, searchDone()])); })));

test('Conditional AUT: other protected headers remain mandatory before any network work', async () => fixture(async ({ open }) => withDirectory(async ({ directory, requests }) => {
  const bytes = Buffer.from(directoryAutWire({ innerAuth: [] }).toString().replace(`From: ${senderAddress}`, `From: ${receiverAddress}`));
  const r = await receiveDirectory(directory, open(), { bytes });
  assert.equal(r.diagnostic.integrityResult, 'XCS_HEADER'); assert.equal(r.authenticationAssessment, undefined);
  assert.equal(leafCount(), 0); assert.equal(requests.length, 0);
})));

test('Conditional AUT: inspection exposes no plaintext or token and cannot be cloned into authentication evidence', () => {
  const inspection = inspectEccKimMessageForDirectory(wire);
  assert.deepEqual(Object.keys(inspection).sort(), ['identityStatus', 'messageId', 'originalSha256', 'sender', 'signerSha256']);
  assert.doesNotMatch(JSON.stringify(inspection), /Bearer|PRIVATE LOCAL STATUS TEST/);
  assert.equal(authenticateInspectedKimMessage(inspection).certificateSha256, hash(raw(authentication.certificate)));
  assert.throws(() => authenticateInspectedKimMessage({ ...inspection }), code('KIM_MESSAGE_AUTH_REJECTED'));
  const bytes = directoryAutWire({ innerAuth: [] });
  assert.throws(() => openEccKimMessage({ ...wire, bytes, skipAuth: true, deferAuthentication: true }), /KIM_MESSAGE_AUTH_REJECTED/);
});

for (const action of ['refresh', 'abort', 'mutate', 'peer-expiry']) test('Conditional AUT: ' + action + ' while AUT status is pending is handled against captured evidence', async () => fixture(async ({ open, manager, update }) => {
  if (action === 'peer-expiry') await update({ services: [...defaults,
    { ...defaults.find(s => s.type === OCSP), certificate: raw(extraResponder.certificate).toString('base64') }] });
  const changed = separateSigningIdentity(), handler = state.handler, waiting = Promise.withResolvers();
  state.handler = (req, res, body, purpose) => {
    if (action === 'peer-expiry' && purpose === 'directory') {
      res.writeHead(200, { 'Content-Type': 'application/ocsp-response' });
      res.end(f.proof(vzdServer.certificate, { producedAt: f.now - 3599000, responder: extraResponder }).response); return true;
    }
    if (purpose !== 'authentication') return handler(req, res, body, purpose);
    waiting.resolve(() => { res.writeHead(200, { 'Content-Type': 'application/ocsp-response' }); res.end(f.proof(authentication.certificate).response); });
    return true;
  };
  await withDirectory(async ({ directory, requests }) => {
    const input = { ...wire, bytes: directoryAutWire({ signingCertificate: changed }), expectedSignerCertificate: Buffer.from(changed), expectedAuthCertificate: undefined };
    const original = hash(input.bytes), controller = new AbortController(), reportInput = { ...report };
    const pending = receiveEccKimMessageWithTsl(input, reportInput, { directory, statusClient: open(), signal: controller.signal });
    const outcome = pending.then(value => ({ value }), error => ({ error }));
    const release = await Promise.race([waiting.promise, outcome.then(r => { throw new Error('Receive ended before AUT status: ' + (r.error?.code ?? r.value?.diagnostic?.integrityResult)); })]);
    if (action === 'refresh') await manager.refresh();
    else if (action === 'abort') controller.abort();
    else if (action === 'peer-expiry') state.now += 2000;
    else { input.bytes.fill(0); input.expectedSignerCertificate.fill(0); input.expectedAuthCertificate = signing.certificate; reportInput.includeDecryptedOriginal = true; }
    release(); const { value: r, error } = await outcome;
    if (action === 'abort') assert.equal(error?.code, 'KIM_TSL_ABORTED');
    else {
      assert.equal(error, undefined); assert.equal(r.diagnostic.originalSha256, original);
      assert.equal(r.diagnostic.integrityResult, action === 'refresh' ? 'XCS_CERT_STATUS' : action === 'peer-expiry' ? 'XCS_DIRECTORY' : '07');
      assert.equal(r.deliveryStatus, 'diagnostic-only'); assert.equal(r.diagnostic.decryptedOriginalAttached, false);
      if (action === 'refresh') assert.ok(r.diagnostic.certificateStatus.every(s => s.status === 'unavailable'));
      if (action === 'peer-expiry') {
        assert.equal(r.directoryAcquisition.state, 'unavailable'); assert.ok(r.diagnostic.certificateStatus.every(s => s.status === 'good'));
      }
    }
    assert.equal(requests.length, 2); assert.deepEqual(leafPurposes(), ['signing', 'directory', 'authentication']);
  });
}));

test('Conditional AUT: abort after LDAP Bind prevents Search and AUT status work', async () => fixture(async ({ open }) => {
  const controller = new AbortController();
  await withDirectory(async ({ directory, requests }) => {
    await assert.rejects(receiveEccKimMessageWithTsl(wire, report, { directory, statusClient: open(), signal: controller.signal }), code('KIM_TSL_ABORTED'));
    assert.deepEqual(requests.map(r => r.op), [0x60]); assert.deepEqual(leafPurposes(), ['signing', 'directory']);
  }, undefined, { onBind: () => controller.abort() });
}));

test('Conditional AUT: explicit diagnostic attachment contains the original protected bytes even without AUT', async () => fixture(async ({ open }) => withDirectory(async ({ directory }) => {
  const bytes = directoryAutWire({ innerAuth: [] }), opened = openEccKimMessage(wire), expected = replaceDirectoryAuth(opened.message, []);
  opened.message.fill(0);
  try {
    const r = await receiveEccKimMessageWithTsl({ ...wire, bytes, expectedAuthCertificate: undefined }, { ...report, includeDecryptedOriginal: true }, { directory, statusClient: open() });
    assert.equal(r.diagnostic.integrityResult, '07'); assert.equal(r.diagnostic.decryptedOriginalAttached, true);
    assert.equal(r.bytes.includes(expected), true); assert.equal(r.deliveryStatus, 'diagnostic-only');
    assert.equal(r.authenticationAssessment.state, 'not-required');
  } finally { expected.fill(0); }
})));
const serverRole = { professionOid: '1.2.276.0.76.4.171', professionItem: 'Verzeichnisdienst-TI', telematikId: null };
function holdDirectoryStatus() {
  const waiting = Promise.withResolvers();
  state.handler = (req, res, _bytes, purpose) => {
    if (!req.url.startsWith('/leaf-') || purpose !== 'directory') return false;
    waiting.resolve(() => { res.writeHead(200, { 'Content-Type': 'application/ocsp-response' }); res.end(f.proof(vzdServer.certificate).response); });
    return true;
  };
  return waiting.promise;
}

test('VZD TLS: actual peer certificate, technical role and reusable OCSP proof are bound before LDAP', async () => fixture(async ({ open, manager }) => {
  const waiting = holdDirectoryStatus();
  await withDirectory(async ({ directory, requests }) => {
    const client = open(), pending = lookupServer(directory, client), release = await waiting;
    assert.equal(requests.length, 0); release();
    const first = await pending; revalidateVzdRecord(first);
    assert.equal(first.serverEvidence.state, 'checked'); assert.equal(first.serverEvidence.source, 'response');
    assert.equal(first.serverEvidence.certificateSha256, hash(raw(vzdServer.certificate)));
    assert.equal(first.serverEvidence.certificateTypeOid, '1.2.276.0.76.4.157');
    assert.equal(first.serverEvidence.admission.professionOid, serverRole.professionOid);
    assert.equal('telematikId' in first.serverEvidence.admission, false);
    assert.equal(first.identityStatus, 'unverified'); assert.equal(requests.length, 2);
    state.handler = undefined;
    const second = await lookupServer(directory, client);
    assert.equal(second.serverEvidence.source, 'persistent-cache'); assert.equal(leafCount(), 1); assert.equal(requests.length, 4);
    assert.throws(() => revalidateVzdRecord({ ...second }), code('KIM_VZD_SERVER_VALIDATION_REQUIRED'));
    const old = manager.current(); await manager.refresh();
    assert.throws(() => revalidateVzdRecord(second), statusError);
    assert.throws(() => old.directoryServerFor(vzdServer.certificate), statusError);
    assert.throws(() => old.directoryServerOcspPlanFor(vzdServer.certificate), statusError);
  });
}));

for (const status of ['revoked', 'unknown']) test('VZD TLS: ' + status + ' server never receives Bind or Search, including cached retry', async () => fixture(async ({ open }) => {
  state.directory = status;
  await withDirectory(async ({ directory, requests }) => {
    const c = open();
    await assert.rejects(lookupServer(directory, c), code('KIM_VZD_SERVER_STATUS'));
    await assert.rejects(resolveDirectory(directory, c), code('KIM_VZD_SERVER_STATUS'));
    assert.equal(requests.length, 0); assert.equal(leafCount(), 1);
  });
}));

test('VZD TLS: wrong role is rejected before status I/O even with an older persisted good OCSP proof', async () => fixture(async ({ open, manager, options }) => {
  const c = withAdmission(vzdServer.certificate, admissionDer({ ...serverRole, professionOid: '1.2.276.0.76.4.172' }), rootKey);
  state.certificates = [{ certificate: c }];
  const oldCache = new DurableOcspStatusCache({ path: options.path, key: options.key, scopeId: options.routes[0].scopeId,
    clock: options.clock, verifier: manager.current().ocspVerifierFor(c), transport: options.routes[0].transport });
  try { assert.equal((await oldCache.check({ certificate: c })).status, 'good'); } finally { oldCache.close(); }
  const prior = leafCount();
  await withDirectory(async ({ directory, requests }) => {
    await assert.rejects(resolveDirectory(directory, open()), code('KIM_TSL_SERVER_ADMISSION_SERVICE_ROLE'));
    assert.equal(requests.length, 0); assert.equal(leafCount(), prior);
  }, undefined, { tls: { ...vzdTls, cert: new X509Certificate(c).toString() } });
}));

test('VZD TLS: a CA-valid pinned general TLS certificate cannot replace C.ZD.TLS-S', async () => fixture(async ({ open }) => {
  await withDirectory(async ({ directory, requests }) => {
    const c = open();
    await assert.rejects(resolveDirectory(directory, c), code('KIM_TSL_CERT_TYPE_MISSING'));
    const diagnostic = await receiveDirectory(directory, c);
    assert.equal(diagnostic.directoryAcquisition.state, 'unavailable'); assert.equal(diagnostic.diagnostic.integrityResult, 'XCS_DIRECTORY');
    assert.equal(diagnostic.diagnostic.decryptedOriginalAttached, false); assert.equal(requests.length, 0);
  }, undefined, { tls: f.pki.tls });
}));

test('VZD TLS: missing CA permission invalidates a cached server proof before another LDAP request', async () => fixture(async ({ open, update }) => {
  await withDirectory(async ({ directory, requests }) => {
    const c = open(); await lookupServer(directory, c); assert.equal(requests.length, 2);
    await update({ services: defaults.map(s => s.type === CA ? { ...s, extensionOids: s.extensionOids.filter(id => id !== '1.2.276.0.76.4.157') } : s) });
    await assert.rejects(lookupServer(directory, c), code('KIM_TSL_CERT_TYPE_CA_NOT_AUTHORIZED'));
    assert.equal(requests.length, 2); assert.equal(leafCount(), 1);
  });
}));

test('VZD TLS: compromised-CA compatibility mode never permits a revoked directory CA', async () => fixture(async ({ open }) => {
  await withDirectory(async ({ directory, requests }) => {
    await assert.rejects(lookupServer(directory, open({ model: 'nonqes-compromise' })), code('KIM_TSL_ISSUER'));
    assert.equal(requests.length, 0); assert.equal(leafCount(), 0);
  });
}, { services: defaults.map(s => s.type === CA ? { ...s, status: REVOKED } : s) }));

test('VZD TLS: HTTP outage and a replayed proof for another certificate cannot trigger LDAP', async () => fixture(async ({ open }) => {
  await withDirectory(async ({ directory, requests }) => {
    for (const replay of [false, true]) {
      state.handler = (req, res, _bytes, purpose) => {
        if (!req.url.startsWith('/leaf-') || purpose !== 'directory') return false;
        res.writeHead(replay ? 200 : 503, { 'Content-Type': 'application/ocsp-response' });
        res.end(replay ? f.proof(signing.certificate).response : undefined); return true;
      };
      // Separate cache scope prevents the HTTP failure backoff from masking replay verification.
      const c = open({ scopeId: randomUUID(), routes: [{ transport: new OcspHttpTransport(endpoints()), scopeId: randomUUID() }] });
      await assert.rejects(lookupServer(directory, c), statusError); assert.equal(requests.length, 0);
    }
  });
}));

test('VZD TLS: TSL change while server OCSP is pending prevents Bind', async () => fixture(async ({ open, manager }) => {
  const waiting = holdDirectoryStatus();
  await withDirectory(async ({ directory, requests }) => {
    const pending = assert.rejects(lookupServer(directory, open()), statusError), release = await waiting;
    await manager.refresh(); release(); await pending; assert.equal(requests.length, 0);
  });
}));

test('VZD TLS: TSL change after Bind prevents Search', async () => fixture(async ({ open, manager }) => {
  await withDirectory(async ({ directory, requests }) => {
    await assert.rejects(lookupServer(directory, open()), statusError);
    assert.equal(requests.length, 1); assert.equal(requests[0].op, 0x60);
  }, undefined, { onBind: async socket => { await manager.refresh(); socket.write(bindReply); } });
}));

test('VZD TLS: expiry during Search prevents a directory record from escaping', async () => fixture(async ({ open }) => {
  await withDirectory(async ({ directory, requests }) => {
    await assert.rejects(lookupServer(directory, open()), statusError); assert.equal(requests.length, 2);
  }, ({ socket, address }) => {
    state.now += 3601000; // A_23225 producedAt window, not the older ten-minute TUC default.
    socket.write(Buffer.concat([entryReply(record(address, [encryption[0].certificate])), searchDone()]));
  });
}));

for (const mode of ['abort', 'deadline']) test('VZD TLS: ' + mode + ' while OCSP is pending cannot later send LDAP', async () => fixture(async ({ open }) => {
  const waiting = holdDirectoryStatus(), control = new AbortController();
  await withDirectory(async ({ directory, requests }) => {
    const pending = assert.rejects(lookupServer(directory, open(), control.signal), code(mode === 'abort' ? 'KIM_VZD_ABORTED' : 'KIM_VZD_TIMEOUT'));
    const release = await waiting;
    if (mode === 'abort') control.abort();
    await pending; release(); await new Promise(r => setImmediate(r));
    assert.equal(requests.length, 0);
  }, undefined, { client: { timeoutMs: 250 } });
}));

test('VZD TLS: unsolicited LDAP data during server validation is rejected', async () => fixture(async ({ open }) => {
  holdDirectoryStatus();
  await withDirectory(async ({ directory, requests }) => {
    await assert.rejects(lookupServer(directory, open()), code('KIM_VZD_LDAP_BEFORE_VALIDATION'));
    assert.equal(requests.length, 0);
  }, undefined, { onSecure: socket => socket.write(bindReply) });
}));

test('VZD TLS: low-level pin-only protocol results cannot masquerade as server validation', async () => fixture(async () => {
  await withDirectory(async ({ directory }) => {
    const result = await directory.lookup(senderAddress);
    assert.equal(result.serverEvidence.state, 'not-checked'); assert.equal(result.identityStatus, 'unverified');
    assert.throws(() => revalidateVzdRecord(result), code('KIM_VZD_SERVER_VALIDATION_REQUIRED'));
    assert.throws(() => revalidateVzdRecord({ ...result, serverEvidence: { state: 'checked', status: 'good' } }), code('KIM_VZD_SERVER_VALIDATION_REQUIRED'));
    assert.equal(leafCount(), 0);
  });
}));

test('VZD TLS: sender binding retains a private peer-proof guard for the final receive continuation', async () => fixture(async ({ open, manager }) => {
  await withDirectory(async ({ directory }) => {
    const client = open(), evidence = await client.messageEvidence({ signingCertificate: signing.certificate, authenticationCertificate: authentication.certificate });
    const result = await matchVzdSender(directory, senderAddress, evidence, undefined, client);
    result.revalidate(); assert.equal(result.binding.state, 'matched');
    assert.equal(result.binding.serverEvidence.state, 'checked');
    assert.equal('response' in result.binding.serverEvidence, false);
    await manager.refresh(); assert.throws(result.revalidate, statusError);
  });
}));

for (const version of ['TLSv1.2', 'TLSv1.3']) test('VZD TLS: ' + version + ' negotiates the bounded AES-GCM profile', async () => fixture(async ({ open }) => {
  let negotiated;
  await withDirectory(async ({ directory }) => {
    await lookupServer(directory, open()); assert.equal(negotiated.protocol, version); assert.match(negotiated.cipher, /AES.*GCM/);
  }, undefined, { tls: { ...vzdTls, minVersion: version, maxVersion: version, ecdhCurve: 'prime256v1' },
    onSecure: socket => { negotiated = { protocol: socket.getProtocol(), cipher: socket.getCipher().name }; } });
}));

test('VZD TLS: an unoffered ECDH group cannot reach certificate status or LDAP', async () => fixture(async ({ open }) => {
  await withDirectory(async ({ directory, requests }) => {
    await assert.rejects(lookupServer(directory, open()), code('KIM_VZD_CONNECTION'));
    assert.equal(requests.length, 0); assert.equal(leafCount(), 0);
  }, undefined, { tls: { ...vzdTls, minVersion: 'TLSv1.3', ecdhCurve: 'X25519' } });
}));

// The complete monthly path uses the existing synthetic mTLS + TSL/OCSP peer,
// PostgreSQL review drafts and encrypted SQLite. It is not hardware/TI evidence.
async function withMonthlyComponent(run, {transform,changeReply}={}) {
  await fixture(async({open})=>withCms(async({connector,requests})=>{
    const monthly=await monthlyFactsFixture(),statusClient=open();
    const config={tenantId:monthly.f.tenant,store:monthly.store,connector,statusClient,
      expectedTelematikId:'10-LOCAL-TEST',requiredRoles:['1.2.276.0.76.4.245']};
    const signer=new MonthlyComponentSigner(config),worker=monthly.setComponentSigner(signer);
    const v=await monthly.setup();await monthly.freeze(v);await monthly.prepare(v);
    const png=Buffer.from(signingPng(1),'base64');
    try{await run({...monthly,config,signer,worker,v,png,requests,connector,statusClient});}
    finally{await monthly.close();}
  },transform,changeReply));
}
test('monthly component: verified XML, real SOAP CMS and report are archived before receipt; retry and restart never sign twice',async()=>withMonthlyComponent(async m=>{
  const guard=new DatabaseSync(m.storeOptions.path);
  try{guard.exec("CREATE TRIGGER no_standalone_image BEFORE UPDATE ON monthly_originals WHEN NEW.signature IS NOT NULL BEGIN SELECT RAISE(ABORT,'standalone image forbidden'); END;");}finally{guard.close();}
  const originalIssue=m.database.issue;let issueCount=0;
  m.database.issue=async receipt=>{const result=await originalIssue(receipt);if(++issueCount===1)throw Error('synthetic lost database response');return result;};
  await assert.rejects(m.worker.verify(m.v.input,m.png),/lost database/);
  const archive=m.store.getComponent(m.f.tenant,m.v.input.captureId);
  assert.equal(archive.record.state,'complete');assert.equal(archive.record.dispatchReady,false);
  assert.equal(archive.record.hardwareEvidence,'not-attested');assert.equal(archive.record.tiEvidence,'not-attested');
  assert.deepEqual(await openssl(['cms','-verify','-inform','DER','-binary','-noverify'],{input:archive.cms}),archive.xml);
  assert.equal(hash(archive.report),archive.record.documentVerification.reportSha256);
  assert.ok(archive.xml.includes(m.png.toString('base64')));
  const recovered=await m.worker.status(m.v.input);assert.equal(recovered.state,'verified');
  const reopened=new MonthlyOriginalStore(m.storeOptions);
  try{
    const components=new MonthlyComponentSigner({...m.config,store:reopened});
    const resumed=new MonthlyOriginalVerifier({database:m.database,store:reopened,componentSigner:components,requireComponents:true});
    assert.equal(reopened.get(m.f.tenant,m.v.input.captureId).signature,null);
    const receipt=await resumed.resumeVerification(m.v.input);
    assert.equal(receipt.receiptId,recovered.receipt.receiptId);
    assert.deepEqual(reopened.getComponent(m.f.tenant,m.v.input.captureId).cms,archive.cms);
    const final=await m.f.command('confirm',{id:m.v.p.id,revision:m.v.p.revision,content_sha256:m.v.p.content_sha256,receipt_id:receipt.receiptId});
    assert.equal(final.status,'final');
    assert.deepEqual((await resumed.readArchivedOriginal({tenantId:m.f.tenant,proofId:final.id,captureId:m.v.input.captureId})).bytes,m.v.original.bytes);
    const archived=await resumed.readArchivedComponent({tenantId:m.f.tenant,proofId:final.id,captureId:m.v.input.captureId});
    assert.equal(archived.status,'final');assert.deepEqual(archived.cms,archive.cms);
    await m.f.command('correct',{id:final.id,revision:final.revision,new_id:randomUUID(),reason:'Synthetische Korrektur'});
    const invalidated=await resumed.readArchivedComponent({tenantId:m.f.tenant,proofId:final.id,captureId:m.v.input.captureId});
    assert.equal(invalidated.status,'invalidated');assert.deepEqual(invalidated.cms,archive.cms);
  }finally{reopened.close();}
  assert.deepEqual(m.requests.map(q=>cmsOperation(q.bytes)).filter(Boolean),['GetJobNumber','SignDocument','VerifyDocument']);
  assert.equal(m.requests.some(q=>isVerifyPin(q.bytes)),false);
  for(const part of [archive.xml,archive.cms,archive.report,archive.certificate])assert.equal((await readFile(m.storeOptions.path)).includes(part),false);
}));
test('monthly component: response lost after card use stays held across restart and blocks a different capture',async()=>withMonthlyComponent(async m=>{
  await assert.rejects(m.worker.verify(m.v.input,m.png),/MONTHLY_COMPONENT_HELD/);
  const archive=m.store.getComponent(m.f.tenant,m.v.input.captureId);assert.equal(archive.record.state,'held');assert.equal(archive.cms,null);
  await assert.rejects(m.worker.status(m.v.input),/MONTHLY_COMPONENT_HELD/);
  const reopened=new MonthlyOriginalStore(m.storeOptions);
  try{
    const worker=new MonthlyOriginalVerifier({database:m.database,store:reopened,componentSigner:new MonthlyComponentSigner({...m.config,store:reopened}),requireComponents:true});
    await assert.rejects(worker.verify(m.v.input,m.png),/MONTHLY_COMPONENT_HELD/);
    const second=await m.setup();await m.freeze(second);
    await assert.rejects(worker.prepare(second.input),/MONTHLY_COMPONENT_HELD/);
  }finally{reopened.close();}
  assert.equal(m.requests.filter(q=>cmsOperation(q.bytes)==='SignDocument').length,1);
  assert.equal((await m.f.db.query('SELECT count(*)::int n FROM care_security.gkv_monthly_confirmation_receipts')).rows[0].n,0);
},{changeReply(event){if(cmsOperation(event.bytes)!=='SignDocument')return false;event.response.destroy();return true;}}));
test('monthly component: altered signature cannot issue receipt or overwrite captured XML',async()=>withMonthlyComponent(async m=>{
  await assert.rejects(m.worker.verify(m.v.input,m.png),/MONTHLY_COMPONENT_HELD/);
  const a=m.store.getComponent(m.f.tenant,m.v.input.captureId);assert.equal(a.record.state,'held');assert.equal(a.cms,null);
  await assert.rejects(m.worker.verify(m.v.input,m.png),/MONTHLY_COMPONENT_HELD/);
  assert.equal(m.requests.filter(q=>cmsOperation(q.bytes)==='SignDocument').length,1);
},{transform(bytes,operation){const copy=Buffer.from(bytes);if(operation==='SignDocument')copy[copy.length-1]^=1;return copy;}}));
test('monthly component: inconclusive report retains CMS but blocks receipt and key retry',async()=>withMonthlyComponent(async m=>{
  await assert.rejects(m.worker.verify(m.v.input,m.png),/MONTHLY_COMPONENT_HELD/);
  const a=m.store.getComponent(m.f.tenant,m.v.input.captureId);assert.equal(a.record.state,'held');assert.ok(a.cms);assert.equal(a.report,null);
  await assert.rejects(m.worker.verify(m.v.input,m.png),/MONTHLY_COMPONENT_HELD/);
  assert.equal(m.requests.filter(q=>cmsOperation(q.bytes)==='SignDocument').length,1);
},{changeReply(event,result){if(cmsOperation(event.bytes)!=='VerifyDocument')return false;
  cardsReply(event.response,result.replace('<c:HighLevelResult>VALID','<c:HighLevelResult>INCONCLUSIVE'));return true;}}));
test('monthly component: source drift during SignDocument holds the saved CMS and never issues receipt',async()=>{
  let monthly;
  await withMonthlyComponent(async m=>{monthly=m;
    await assert.rejects(m.worker.verify(m.v.input,m.png),/MONTHLY_COMPONENT_HELD/);
    assert.equal(m.store.getComponent(m.f.tenant,m.v.input.captureId).record.state,'held');
    assert.equal(m.requests.filter(q=>cmsOperation(q.bytes)==='SignDocument').length,1);
    assert.equal(m.requests.filter(q=>cmsOperation(q.bytes)==='VerifyDocument').length,0);
  },{changeReply(event,result){if(cmsOperation(event.bytes)!=='SignDocument')return false;
    monthly.f.db.query("UPDATE clients SET insurance_number='B987654321' WHERE id=$1",[monthly.v.p.payload.clientId])
      .then(()=>cardsReply(event.response,result),()=>event.response.destroy());return true;}});
});
test('monthly component: final card removal holds independently valid signature and report',async()=>withMonthlyComponent(async m=>{
  await assert.rejects(m.worker.verify(m.v.input,m.png),/MONTHLY_COMPONENT_HELD/);
  assert.equal(m.store.getComponent(m.f.tenant,m.v.input.captureId).record.state,'held');
  assert.equal(m.requests.filter(q=>cmsOperation(q.bytes)==='VerifyDocument').length,1);
},{changeReply(event){if(!isCards(event.bytes)||!event.requests.some(q=>cmsOperation(q.bytes)==='VerifyDocument'))return false;
  cardsReply(event.response,cardsResponse([]));return true;}}));
test('monthly component: missing PIN never prompts or reserves a key operation',async()=>withMonthlyComponent(async m=>{
  await assert.rejects(m.worker.verify(m.v.input,m.png),/MONTHLY_COMPONENT_PIN_REQUIRED/);
  assert.equal(m.store.getComponent(m.f.tenant,m.v.input.captureId).record.state,'prepared');
  assert.equal(m.requests.some(q=>cmsOperation(q.bytes)||isVerifyPin(q.bytes)),false);
},{changeReply(event){if(!isPinStatus(event.bytes))return false;cardsReply(event.response,pinResponse('GetPinStatus','VERIFIABLE',3));return true;}}));
test('monthly component: a durable in-flight reservation cannot be replayed even without a connector latch',async()=>withMonthlyComponent(async m=>{
  // Emulate a process dying immediately after its durable reservation.
  const unsigned=new MonthlyOriginalVerifier({database:m.database,store:m.store,requireComponents:false});
  await unsigned.verify(m.v.input,m.png);
  const candidate=await generateCapturedMonthlyXml({...m.store.get(m.f.tenant,m.v.input.captureId),signature:m.png});
  m.store.reserveComponent(m.f.tenant,m.v.input.captureId,candidate);m.store.beginComponent(m.f.tenant,m.v.input.captureId);
  const reopened=new MonthlyOriginalStore(m.storeOptions);
  try{
    const signer=new MonthlyComponentSigner({...m.config,store:reopened});
    await assert.rejects(signer.signCaptured({tenantId:m.f.tenant,captureId:m.v.input.captureId,candidate,assertCurrent:async()=>{}}),/MONTHLY_COMPONENT_HELD/);
    assert.equal(m.requests.length,0);
  }finally{reopened.close();}
}));
test('monthly component: host refuses frozen facts without signing configuration before patient capture',async()=>{
 const m=await monthlyFactsFixture();
 const host=new MonthlyOriginalHost({tenantId:m.f.tenant,store:m.store,supabase:m.f.config,workerKeyId:m.f.workerKeyId,workerKey:m.f.workerKey,http:m.f.http});
 try{const v=await m.setup();await m.freeze(v);
  await assert.rejects(host.execute({...v.input,action:'prepare'},'Bearer '+m.f.token()),/MONTHLY_UNCONFIGURED/);
  assert.equal(m.store.get(m.f.tenant,v.input.captureId),null);
 }finally{await m.close();}
});
test('monthly component: saved CMS resumes only read-only verification after a process interruption',async()=>withMonthlyComponent(async m=>{
  const unsigned=new MonthlyOriginalVerifier({database:m.database,store:m.store,requireComponents:false});await unsigned.verify(m.v.input,m.png);
  const candidate=await generateCapturedMonthlyXml({...m.store.get(m.f.tenant,m.v.input.captureId),signature:m.png});
  m.store.reserveComponent(m.f.tenant,m.v.input.captureId,candidate);const reserved=m.store.beginComponent(m.f.tenant,m.v.input.captureId);
  const prepared=await preparePin(m.connector,m.statusClient),c=prepared.bundle.certificates.find(c=>c.certRef==='C.SIG');
  const signed=await m.connector.signSmcbComponent({status:prepared.status,certificate:c.certificate,verification:c.verification,data:candidate.bytes});
  m.store.saveComponentSignature(m.f.tenant,m.v.input.captureId,reserved.record.attemptId,signed,c.certificate);
  const reopened=new MonthlyOriginalStore(m.storeOptions);
  try{
    const worker=new MonthlyOriginalVerifier({database:m.database,store:reopened,componentSigner:new MonthlyComponentSigner({...m.config,store:reopened}),requireComponents:true});
    await worker.resumeVerification(m.v.input);
    assert.equal(reopened.getComponent(m.f.tenant,m.v.input.captureId).record.state,'complete');
  }finally{reopened.close();}
  assert.deepEqual(m.requests.map(q=>cmsOperation(q.bytes)).filter(Boolean),['GetJobNumber','SignDocument','VerifyDocument']);
}));
test('monthly component: authenticated-state corruption prevents key use',async()=>withMonthlyComponent(async m=>{
  const unsigned=new MonthlyOriginalVerifier({database:m.database,store:m.store,requireComponents:false});await unsigned.verify(m.v.input,m.png);
  const candidate=await generateCapturedMonthlyXml({...m.store.get(m.f.tenant,m.v.input.captureId),signature:m.png});
  m.store.reserveComponent(m.f.tenant,m.v.input.captureId,candidate);m.store.beginComponent(m.f.tenant,m.v.input.captureId);
  const db=new DatabaseSync(m.storeOptions.path);try{db.prepare("UPDATE monthly_components SET state='prepared'").run();}finally{db.close();}
  await assert.rejects(m.worker.verify(m.v.input,m.png),/MONTHLY_(STORE|COMPONENT)_INTEGRITY/);
  assert.equal(m.requests.length,0);
}));
test('monthly component: authenticated mTLS host carries frozen capture through CMS and private receipt without exposing archive bytes',async()=>withMonthlyComponent(async m=>{
 const host=new MonthlyOriginalHost({tenantId:m.f.tenant,store:m.store,supabase:m.f.config,
  workerKeyId:m.f.workerKeyId,workerKey:m.f.workerKey,http:m.f.http,componentSigner:m.signer});
 const listener=createMonthlyHostServer({host,tls:{...f.pki.tls,ca:f.pki.roots},clientSha256:hash(raw(f.pki.sender.certificate))});
 listener.listen(0,'127.0.0.1');await once(listener,'listening');
 const env={GKV_MONTHLY_HOST_URL:`https://localhost.test:${listener.address().port}/v1/monthly-originals`,GKV_MONTHLY_HOST_CONNECT_ADDRESS:'127.0.0.1',
  GKV_MONTHLY_HOST_SHA256:hash(raw(f.pki.tls.cert)),GKV_MONTHLY_HOST_CA:f.pki.roots,GKV_MONTHLY_CLIENT_CERT:f.pki.sender.certificate,
  GKV_MONTHLY_CLIENT_KEY:await readFile(f.pki.sender.privateKeyPath),GKV_MONTHLY_CLIENT_PASSPHRASE:f.pki.password.toString()};
 try{
  const result=await callMonthlyHost(env,{...m.v.input,action:'verify',pngBase64:m.png.toString('base64')},'Bearer '+m.f.token());
  assert.equal(result.kind,'receipt');assert.equal(m.store.getComponent(m.f.tenant,m.v.input.captureId).record.state,'complete');
  assert.equal(Object.hasOwn(result,'cms'),false);assert.equal(JSON.stringify(result).includes(m.png.toString('base64')),false);
  const resumed=await callMonthlyHost(env,{...m.v.input,action:'resume-verification'},'Bearer '+m.f.token());
  assert.deepEqual(resumed,result);assert.equal(m.store.get(m.f.tenant,m.v.input.captureId).signature,null);
  assert.equal(m.requests.filter(q=>cmsOperation(q.bytes)==='SignDocument').length,1);
  const final=await m.f.command('confirm',{id:m.v.p.id,revision:m.v.p.revision,content_sha256:m.v.p.content_sha256,receipt_id:result.receipt.receiptId});assert.equal(final.status,'final');
 }finally{listener.closeAllConnections();await new Promise(r=>listener.close(r));host.close();}
}));
