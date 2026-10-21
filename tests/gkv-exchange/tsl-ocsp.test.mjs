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

const hash = b => createHash('sha256').update(b).digest('hex');
const raw = c => new X509Certificate(c).raw;
const code = expected => error => error?.code === expected;
const statusError = e => /^KIM_(?:TSL|OCSP)_/.test(e?.code);
const report = { cmVersion: 'TEST_0.1.0', ptVersion: '1.5.5' };
let f, server, origin, signer, signing, authentication, wire, state, defaults, extraResponder, originalHash;
const endpoints = () => ({ url: origin + '/leaf-ocsp', ca: f.pki.roots, connectAddress: '127.0.0.1' });
const route = path => ({ ...endpoints(), url: origin + path });
const leafCount = () => state.calls.filter(c => c.path.startsWith('/leaf-')).length;
before(async () => {
  f = await tslFixture();
  server = https.createServer(f.pki.tls, (req, res) => {
    const chunks = []; req.on('data', c => chunks.push(c)); req.on('end', () => {
      const bytes = Buffer.concat(chunks), path = req.url;
      const identity = [signer, signing, authentication].find(c => f.proof(c.certificate).request.equals(bytes));
      const purpose = identity === signing ? 'signing' : identity === authentication ? 'authentication' : 'signer';
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
  const key = async c => createPrivateKey({ key: await readFile(c.privateKeyPath), passphrase: f.pki.password });
  const sender = 'sender@local.kim.telematik-test', receiver = 'receiver@local.kim.telematik-test';
  const message = createEccKimMessage({ message: Buffer.from(`From: ${sender}\r\nTo: ${receiver}\r\nSubject: Local TSL status test\r\nMIME-Version: 1.0\r\nContent-Type: text/plain\r\n\r\nPRIVATE LOCAL STATUS TEST\r\n`),
    sender, envelopeRecipients: [receiver], recipients: [{ address: sender, certificate: a.certificate }, { address: receiver, certificate: b.certificate }],
    signingCertificate: signing.certificate, signingKey: await key(signing), authCertificate: authentication.certificate, authKey: await key(authentication), ...report, now: f.now });
  wire = { bytes: message.bytes, address: receiver, recipientCertificate: b.certificate, privateKey: await key(b),
    expectedSignerCertificate: signing.certificate, expectedAuthCertificate: authentication.certificate, now: f.now };
  originalHash = hash(wire.bytes);
  defaults = f.services.map(s => ({ ...s, supplyPoints: [origin + (s.type === CA ? '/leaf-ocsp' : '/not-the-ca-route')] }));
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
