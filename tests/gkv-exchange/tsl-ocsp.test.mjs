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
import { readMessage } from '../../services/kim/message.mjs';
import { createEccKimAuth } from '../../services/kim/message-auth.mjs';
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

const hash = b => createHash('sha256').update(b).digest('hex');
const raw = c => new X509Certificate(c).raw;
const code = expected => error => error?.code === expected;
const statusError = e => /^KIM_(?:TSL|OCSP)_/.test(e?.code);
const report = { cmVersion: 'TEST_0.1.0', ptVersion: '1.5.5' };
let f, server, origin, signer, signing, authentication, wire, state, defaults, extraResponder, originalHash, rootKey;
let encryption, rollover, signingKey, authKey;
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
  authentication = await f.pki.issueAut({ name: 'route-aut', startDate });
  const a = await f.pki.issueKim({ name: 'route-enc-a', startDate }), b = await f.pki.issueKim({ name: 'route-enc-b', startDate });
  encryption = [a, b]; rollover = await f.pki.issueKim({ name: 'route-enc-rollover', startDate });
  const key = async c => createPrivateKey({ key: await readFile(c.privateKeyPath), passphrase: f.pki.password });
  rootKey = await key({ privateKeyPath: join(f.pki.dir, 'root.key') });
  signingKey = await key(signing); authKey = await key(authentication);
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
function directoryAutWire({ innerAuth = [directoryToken()], outerAuth = innerAuth, signingCertificate = signing.certificate } = {}) {
  const opened = openEccKimMessage(wire), inner = replaceDirectoryAuth(opened.message, innerAuth);
  try {
    const cms = sealEccKimPayload({ message: inner, sender: senderAddress,
      recipients: [{ address: senderAddress, certificate: encryption[0].certificate }, { address: receiverAddress, certificate: encryption[1].certificate }],
      signingCertificate, signingKey, now: f.now });
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
