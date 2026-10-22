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
import { createEccKimMessage } from '../../services/kim/client-message.mjs';
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
  assert.equal(result.directoryAcquisition.signingMatches, true); assert.equal(result.directoryAcquisition.authenticationMatches, true);
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
    assert.equal(result.directoryAcquisition.matchedBy, 'signing'); assert.equal(result.directoryAcquisition.authenticationMatches, false);
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
