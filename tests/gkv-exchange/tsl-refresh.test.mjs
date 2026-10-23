import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import https from 'node:https';
import { once } from 'node:events';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { Vault } from '../../services/gkv/storage.mjs';
import { TslHttpSource, officialTslInternetRoutes } from '../../services/kim/tsl-http.mjs';
import { TslSignerStatusSource } from '../../services/kim/tsl-signer-status.mjs';
import { TslRefreshManager } from '../../services/kim/tsl-refresh.mjs';
import { TslTrustStore } from '../../services/kim/tsl-store.mjs';
import { OcspHttpTransport } from '../../services/kim/ocsp-http.mjs';
import { DurableOcspStatusCache } from '../../services/kim/ocsp-store.mjs';
import { tslFixture, OCSP } from './tsl-fixture.mjs';

const hash = b => createHash('sha256').update(b).digest('hex');
const rejected = code => e => e?.code === code;
const ocspRejected = e => /^KIM_OCSP_/.test(e?.code);
let f, server, origin, base, signer, state;
before(async () => {
  f = await tslFixture();
  server = https.createServer(f.pki.tls, (req, res) => {
    const path = req.url; state.calls.push({ path, method: req.method, headers: req.headers });
    if (state.override?.(req, res)) return;
    if (path === '/hash') { res.writeHead(state.hashStatus ?? 200, { 'Content-Type': 'text/plain', ...state.hashHeaders }); res.end(state.hashBody ?? hash(state.bundle.xml) + '\n'); }
    else if (path === '/xml') { res.writeHead(200, { 'Content-Type': 'application/vnd.etsi.tsl+xml', ...state.xmlHeaders }); res.end(state.xmlBody ?? state.bundle.xml); }
    else if (path === '/signature') { res.writeHead(200, { 'Content-Type': 'application/octet-stream' }); res.end(state.signatureBody ?? state.bundle.detachedSignature); }
    else if (path === '/ocsp') {
      const chunks = []; req.on('data', c => chunks.push(c)); req.on('end', () => {
        const proof = state.proof ?? f.proof(signer.certificate, { state: state.ocspState ?? 'good', producedAt: state.now });
        state.ocspRequests.push(Buffer.concat(chunks));
        res.writeHead(200, { 'Content-Type': 'application/ocsp-response' }); res.end(state.protocolError ?? proof.response);
      });
    } else { res.writeHead(404); res.end(); }
  });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  origin = `https://localhost.test:${server.address().port}`;
  signer = await f.issueSigner({ name: 'tsl-refresh', aia: `OCSP;URI:${origin}/ocsp` });
  base = await f.bundle({ signer });
});
after(async () => { server?.closeAllConnections(); if (server) await new Promise(r => server.close(r)); await f?.close(); });
const route = path => ({ url: origin + path, ca: f.pki.roots, connectAddress: '127.0.0.1' });
const sourceOptions = () => ({ environment: 'test', routes: { xml: route('/xml'), signature: route('/signature'), hash: route('/hash') } });
const count = path => state.calls.filter(c => c.path === path).length;
async function fixture(run, { bundle, sourceChanges, managerChanges, verifierChanges } = {}) {
  state = { bundle: bundle ?? base, now: f.now, calls: [], ocspRequests: [] };
  const dir = await mkdtemp(join(tmpdir(), 'cs-tsl-refresh-')), key = randomBytes(32), scopeId = randomUUID(), path = join(dir, 'trust.db');
  const clock = () => state.now, verifier = f.verifier({ clock, ...verifierChanges });
  const stores = [], caches = [], managers = [];
  const open = changes => { const s = new TslTrustStore({ path, key, scopeId, verifier, ...changes }); stores.push(s); return s; };
  const cache = new DurableOcspStatusCache({ path: join(dir, 'status.db'), key, scopeId: randomUUID(), clock,
    verifier: f.statusVerifier(clock), transport: new OcspHttpTransport(route('/ocsp')) }); caches.push(cache);
  const statusSource = new TslSignerStatusSource({ caches: [cache] });
  const source = new TslHttpSource({ ...sourceOptions(), ...sourceChanges }), store = open();
  const manager = changes => { const m = new TslRefreshManager({ source, signerStatusSource: statusSource, store, clock, ...managerChanges, ...changes }); managers.push(m); return m; };
  try { await run({ source, statusSource, store, manager, open, cache, dir, key, scopeId, path, clock }); }
  finally { for (const m of managers) m.close(); for (const c of caches) c.close(); for (const s of stores) s.close(); server.closeAllConnections(); await rm(dir, { recursive: true, force: true }); }
}

test('TSL refresh: HTTPS fetch, authenticated AIA, both signatures and XSD produce a guarded snapshot', async () => fixture(async ({ manager, store }) => {
  const m = manager(), result = await m.refresh(), snapshot = result.snapshot;
  assert.equal(result.changed, true); assert.equal(result.downloaded, true); assert.equal(m.status.state, 'ready');
  assert.equal(snapshot.metadata.identityStatus, 'unverified'); assert.equal(snapshot.services.length, 2);
  assert.equal(store.currentVersion().sequence, 10001);
  assert.deepEqual(state.ocspRequests, [base.signerStatus.request]);
  assert.deepEqual(state.calls.map(c => c.path).sort(), ['/hash', '/ocsp', '/signature', '/xml']);
  assert.equal(state.calls.find(c => c.path === '/hash').headers['accept-encoding'], 'identity');
  const v = snapshot.ocspVerifierFor(signer.certificate);
  assert.equal(v.verify({ certificate: signer.certificate, ...base.signerStatus }).status, 'good');
  assert.equal(snapshot.exportBundle, undefined);
}));

test('TSL refresh: same hash reuses encrypted originals and cache proof without downloading XML/signature', async () => fixture(async ({ manager, store }) => {
  const m = manager(), old = (await m.refresh()).snapshot;
  const bytes = store.candidate(); bytes.xml.fill(0);
  const next = await m.refresh();
  assert.equal(next.changed, false); assert.equal(next.downloaded, false);
  assert.equal(count('/hash'), 2); assert.equal(count('/xml'), 1); assert.equal(count('/signature'), 1); assert.equal(count('/ocsp'), 1);
  assert.throws(() => old.metadata, rejected('KIM_TSL_SUPERSEDED'));
  assert.equal(next.snapshot.metadata.sequence, 10001);
}));

test('TSL refresh: same hash still renews expired signer proof and retains original bytes', async () => fixture(async ({ manager }) => {
  const m = manager(), first = await m.refresh(); state.now += 3601000;
  const second = await m.refresh();
  assert.equal(count('/xml'), 1); assert.equal(count('/ocsp'), 2); assert.equal(second.downloaded, false);
  assert.equal(second.snapshot.metadata.signerStatus.producedAt, state.now);
  assert.throws(() => first.snapshot.metadata, rejected('KIM_TSL_SUPERSEDED'));
}));

test('TSL refresh: restart checks hash and revalidates retained bytes instead of treating storage as trust', async () => fixture(async ({ manager, store, open, path }) => {
  const a = manager(); await a.refresh(); a.close(); store.close();
  const reopened = open(), b = manager({ store: reopened });
  assert.throws(() => b.current(), rejected('KIM_TSL_UNAVAILABLE'));
  assert.equal((await b.refresh()).downloaded, false); assert.equal(count('/xml'), 1);
  b.close(); reopened.close(); assert.equal((await readFile(path)).includes(Buffer.from('TrustServiceStatusList')), false);
}));

test('TSL refresh: a new list invalidates issued OCSP verifiers and removes former services', async () => fixture(async ({ manager }) => {
  const m = manager(), first = (await m.refresh()).snapshot, v = first.ocspVerifierFor(signer.certificate);
  state.bundle = await f.bundle({ signer, id: 'TSL_10002', sequence: 10002, services: f.services.filter(s => s.type !== OCSP) });
  const next = await m.refresh(); assert.equal(next.changed, true);
  assert.throws(() => v.createRequest(signer.certificate), ocspRejected);
  assert.throws(() => v.verify({ certificate: signer.certificate, ...base.signerStatus }), ocspRejected);
  assert.throws(() => first.ocspVerifierFor(signer.certificate), rejected('KIM_TSL_SUPERSEDED'));
  assert.throws(() => next.snapshot.ocspVerifierFor(signer.certificate), rejected('KIM_TSL_RESPONDER'));
}));

test('TSL refresh: another store activation invalidates already issued verifiers through the authenticated checkpoint', async () => fixture(async ({ manager, open }) => {
  const m = manager(), v = (await m.refresh()).snapshot.ocspVerifierFor(signer.certificate);
  await open().activate(await f.bundle({ signer, id: 'TSL_10003', sequence: 10003 }));
  assert.throws(() => v.createRequest(signer.certificate), ocspRejected);
  assert.equal(m.status.state, 'unavailable'); assert.equal(m.status.lastError, 'KIM_TSL_SUPERSEDED');
  await assert.rejects(m.refresh(), rejected('KIM_TSL_ROLLBACK'));
}));

test('TSL refresh: hash errors invalidate handles without erasing originals or triggering XML fallback', async () => fixture(async ({ manager, store }) => {
  const m = manager(), v = (await m.refresh()).snapshot.ocspVerifierFor(signer.certificate), before = store.currentVersion();
  state.hashStatus = 503; await assert.rejects(m.refresh(), rejected('KIM_TSL_HTTP_STATUS'));
  assert.equal(count('/xml'), 1); assert.deepEqual(store.currentVersion(), before);
  assert.throws(() => v.createRequest(signer.certificate), ocspRejected);
  assert.throws(() => m.current(), rejected('KIM_TSL_UNAVAILABLE'));
  state.hashStatus = 200; assert.equal((await m.refresh()).downloaded, false);
}));

test('TSL refresh: expired unchanged list is rejected without download and high-water mark survives', async () => {
  const bundle = await f.bundle({ signer, nextUpdate: f.now + 1000 });
  await fixture(async ({ manager, store }) => {
    const m = manager(); await m.refresh(); state.now += 2000;
    await assert.rejects(m.refresh(), rejected('KIM_TSL_TIME'));
    assert.equal(count('/xml'), 1); assert.equal(store.currentVersion().sequence, 10001);
    assert.equal(store.candidate().xmlSha256, hash(bundle.xml));
  }, { bundle });
});

for (const stateName of ['revoked', 'unknown']) test('TSL refresh: ' + stateName + ' signer cannot activate a list', async () => fixture(async ({ manager, store }) => {
  state.ocspState = stateName;
  await assert.rejects(manager().refresh(), rejected('KIM_TSL_SIGNER_STATUS'));
  assert.equal(store.currentVersion(), null);
}));

test('TSL refresh: four OCSP protocol errors establish durable backoff across another manager', async () => fixture(async ({ manager, store }) => {
  state.protocolError = Buffer.from([48, 3, 10, 1, 3]);
  await assert.rejects(manager().refresh(), rejected('KIM_OCSP_RESPONDER_ERROR'));
  assert.equal(count('/ocsp'), 4);
  await assert.rejects(manager().refresh(), rejected('KIM_OCSP_BACKOFF'));
  assert.equal(count('/ocsp'), 4); assert.equal(store.currentVersion(), null);
}));

for (const [label, aia, error] of [
  ['missing', undefined, 'KIM_TSL_SIGNER_AIA'],
  ['unconfigured', 'OCSP;URI:https://unconfigured.invalid/status', 'KIM_TSL_SIGNER_ROUTE'],
  ['duplicate', 'OCSP;URI:https://unconfigured.invalid/status,OCSP;URI:https://unconfigured.invalid/status', 'KIM_TSL_SIGNER_AIA'],
  ['ambiguous', 'OCSP;URI:https://unconfigured.invalid/one,OCSP;URI:https://unconfigured.invalid/two', 'KIM_TSL_SIGNER_AIA'],
  ['credentials', 'OCSP;URI:https://secret:password@unconfigured.invalid/status', 'KIM_TSL_SIGNER_AIA'],
  ['unsupported scheme', 'OCSP;URI:ldap://unconfigured.invalid/status', 'KIM_TSL_SIGNER_AIA'],
]) test('TSL refresh: ' + label + ' signer AIA causes no OCSP request', async () => {
  const other = await f.issueSigner({ name: 'tsl-aia-' + label.replaceAll(' ', '-'), aia });
  const bundle = await f.bundle({ signer: other });
  await fixture(async ({ manager, store }) => {
    await assert.rejects(manager().refresh(), rejected(error));
    assert.equal(count('/ocsp'), 0); assert.equal(store.currentVersion(), null);
  }, { bundle });
});

test('TSL refresh: signature tampering cannot cause even an allowlisted AIA request', async () => fixture(async ({ manager, store }) => {
  state.signatureBody = Buffer.from(base.detachedSignature); state.signatureBody[25] ^= 1;
  await assert.rejects(manager().refresh(), e => /^KIM_TSL_/.test(e.code));
  assert.equal(count('/ocsp'), 0); assert.equal(store.currentVersion(), null);
}));

test('TSL refresh: hash and signature mirror mismatch leaves the previous checkpoint intact', async () => fixture(async ({ manager, store }) => {
  const m = manager(); await m.refresh(); const before = store.currentVersion();
  state.bundle = await f.bundle({ signer, id: 'TSL_10002', sequence: 10002 }); state.signatureBody = base.detachedSignature;
  await assert.rejects(m.refresh(), rejected('KIM_TSL_DETACHED_SIGNATURE'));
  assert.deepEqual(store.currentVersion(), before);
  state.signatureBody = undefined; state.xmlBody = base.xml;
  await assert.rejects(m.refresh(), rejected('KIM_TSL_HASH_MISMATCH')); assert.deepEqual(store.currentVersion(), before);
}));

test('TSL refresh: concurrent callers share one complete update', async () => fixture(async ({ manager }) => {
  const m = manager(), a = m.refresh(), b = m.refresh(); assert.equal(a, b);
  assert.equal((await a).snapshot, (await b).snapshot); assert.equal(count('/hash'), 1); assert.equal(count('/xml'), 1);
}));

test('TSL refresh: close aborts a pending download and prevents activation', async () => fixture(async ({ manager, store }) => {
  let arrive; const arrived = new Promise(r => { arrive = r; });
  state.override = (req, _res) => { if (req.url !== '/hash') return false; arrive(); return true; };
  const m = manager(), pending = m.refresh(); await arrived; m.close();
  await assert.rejects(pending, rejected('KIM_TSL_ABORTED')); assert.equal(store.currentVersion(), null);
  assert.equal(m.status.state, 'closed'); await assert.rejects(m.refresh(), rejected('KIM_TSL_REFRESH_CLOSED'));
}));

test('TSL refresh: total deadline during signer status wait cannot activate later', async () => fixture(async ({ manager, store, cache }) => {
  let release; state.override = (req, res) => {
    if (req.url !== '/ocsp') return false;
    release = () => { res.writeHead(200, { 'Content-Type': 'application/ocsp-response' }); res.end(base.signerStatus.response); }; req.resume(); return true;
  };
  const m = manager({ timeoutMs: 1000 });
  await assert.rejects(m.refresh(), rejected('KIM_TSL_REFRESH_TIMEOUT'));
  assert.equal(typeof release, 'function'); release();
  await cache.check({ certificate: signer.certificate });
  assert.equal(store.currentVersion(), null); assert.equal(m.status.state, 'unavailable');
}));

test('TSL refresh: XML worker cancellation prevents a late store transaction', async () => fixture(async ({ store }) => {
  const controller = new AbortController(), pending = store.activate(base, { signal: controller.signal }); controller.abort();
  await assert.rejects(pending, rejected('KIM_TSL_ABORTED')); assert.equal(store.currentVersion(), null);
  const closed = AbortSignal.abort(); await assert.rejects(store.load({ signal: closed }), rejected('KIM_TSL_ABORTED'));
}));

test('TSL refresh: explicit start runs periodically, reports retry time, and close stops future work', async t => fixture(async ({ manager }) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const m = manager({ intervalMs: 60000, retryMs: 60000 });
  await m.start(); assert.equal(m.status.nextAttemptAt, state.now + 60000);
  state.now += 60000; t.mock.timers.tick(60000); await m.refresh(); assert.equal(count('/hash'), 2);
  state.hashStatus = 503; state.now += 60000; t.mock.timers.tick(60000);
  await assert.rejects(m.refresh(), rejected('KIM_TSL_HTTP_STATUS'));
  assert.equal(m.status.nextAttemptAt, state.now + 60000); assert.equal(m.status.state, 'unavailable');
  const before = count('/hash'); m.close(); state.now += 60000; t.mock.timers.tick(60000);
  assert.equal(count('/hash'), before); assert.equal(m.status.nextAttemptAt, undefined);
}));

test('TSL refresh: clock rollback invalidates existing handles', async () => fixture(async ({ manager }) => {
  const m = manager(), v = (await m.refresh()).snapshot.ocspVerifierFor(signer.certificate);
  state.now -= 1; assert.throws(() => v.createRequest(signer.certificate), ocspRejected);
  assert.equal(m.status.lastError, 'KIM_TSL_CLOCK');
}));

test('TSL refresh: environment and source changes fail before network and remain bound on reopen', async () => fixture(async ({ manager, store, open }) => {
  const m = manager(); await m.refresh(); m.close(); store.close();
  const again = open(), before = state.calls.length;
  assert.throws(() => manager({ store: again, source: new TslHttpSource({ ...sourceOptions(), environment: 'reference' }) }), rejected('KIM_TSL_REFRESH_CONFIGURATION'));
  const options = sourceOptions(); options.routes.hash.url += '-changed';
  assert.throws(() => manager({ store: again, source: new TslHttpSource(options) }), rejected('KIM_TSL_STORE_SOURCE'));
  assert.equal(state.calls.length, before); assert.equal((await manager({ store: again }).refresh()).downloaded, false);
}));

test('TSL refresh: checkpoint metadata tampering invalidates handles without decrypting/retrusting XML', async () => fixture(async ({ manager, path }) => {
  const m = manager(), v = (await m.refresh()).snapshot.ocspVerifierFor(signer.certificate);
  const db = new DatabaseSync(path); db.exec('UPDATE kim_tsl_trust_v1 SET sequence=10002'); db.close();
  assert.throws(() => v.createRequest(signer.certificate), ocspRejected); assert.equal(m.status.lastError, 'KIM_TSL_STORE_INTEGRITY');
}));

test('TSL refresh: source binding tampering is detected on each active handle use', async () => fixture(async ({ manager, path }) => {
  const m = manager(); await m.refresh(); const db = new DatabaseSync(path);
  db.prepare('UPDATE kim_tsl_download_binding_v1 SET source_sha=?').run('a'.repeat(64)); db.close();
  assert.throws(() => m.current(), rejected('KIM_TSL_STORE_SOURCE'));
}));

test('TSL download: raw, lowercase/uppercase and newline hashes produce the same digest', async () => fixture(async ({ source }) => {
  const h = hash(base.xml);
  for (const bytes of [Buffer.from(h, 'hex'), h, h.toUpperCase(), h + '\n', h + '\r\n']) {
    state.hashBody = bytes; assert.equal(await source.readHash(), h);
  }
  assert.equal(count('/xml'), 0);
}));

for (const [label, body] of [['malformed', 'x'.repeat(64)], ['too short', 'a'.repeat(63)], ['oversize', 'a'.repeat(67)], ['extra whitespace', 'a'.repeat(64) + ' ']]) {
  test('TSL download: ' + label + ' hash never triggers XML fallback', async () => fixture(async ({ manager, store }) => {
    state.hashBody = body; await assert.rejects(manager().refresh(), rejected(label === 'oversize' ? 'KIM_TSL_HTTP_SIZE' : 'KIM_TSL_HASH_FORMAT'));
    assert.equal(count('/xml'), 0); assert.equal(store.currentVersion(), null);
  }));
}

for (const [label, headers, code] of [
  ['redirect', { Location: '/xml' }, 'KIM_TSL_HTTP_STATUS'],
  ['wrong media type', { 'Content-Type': 'text/html' }, 'KIM_TSL_HTTP_FORMAT'],
  ['compression', { 'Content-Encoding': 'gzip' }, 'KIM_TSL_HTTP_FORMAT'],
  ['duplicate media type', { 'Content-Type': ['text/plain', 'text/plain'] }, 'KIM_TSL_HTTP_FORMAT'],
  ['bad charset quoting', { 'Content-Type': 'text/plain;charset="utf-8' }, 'KIM_TSL_HTTP_FORMAT'],
  ['announced oversize', { 'Content-Length': '1000' }, 'KIM_TSL_HTTP_SIZE'],
]) test('TSL download: ' + label + ' is rejected', async () => fixture(async ({ source }) => {
  state.hashHeaders = headers; if (label === 'redirect') state.hashStatus = 302;
  await assert.rejects(source.readHash(), rejected(code)); assert.equal(count('/xml'), 0);
}));

test('TSL download: partial bodies, stalled responses and cancellation fail closed', async () => fixture(async ({ source }) => {
  state.override = (req, res) => { if (req.url !== '/hash') return false; res.writeHead(200, { 'Content-Type': 'text/plain', 'Content-Length': '64' }); res.write('abc'); res.flushHeaders(); setImmediate(() => res.destroy()); return true; };
  await assert.rejects(source.readHash(), e => ['KIM_TSL_HTTP_CONNECTION', 'KIM_TSL_HTTP_INCOMPLETE'].includes(e.code));
  state.override = () => true;
  const short = new TslHttpSource({ ...sourceOptions(), timeoutMs: 50 });
  await assert.rejects(short.readHash(), rejected('KIM_TSL_HTTP_TIMEOUT'));
  const controller = new AbortController(), pending = source.readHash(controller.signal); controller.abort();
  await assert.rejects(pending, rejected('KIM_TSL_ABORTED'));
}));

test('TSL download: certificate and hostname validation remain active under fixed IP routing', async () => fixture(async () => {
  const unknownCa = sourceOptions(); delete unknownCa.routes.hash.ca;
  await assert.rejects(new TslHttpSource(unknownCa).readHash(), rejected('KIM_TSL_HTTP_CONNECTION'));
  const wrongHost = sourceOptions(); wrongHost.routes.hash.url = wrongHost.routes.hash.url.replace('localhost.test', 'wrong.test');
  await assert.rejects(new TslHttpSource(wrongHost).readHash(), rejected('KIM_TSL_HTTP_CONNECTION'));
  assert.equal(state.calls.length, 0);
}));

test('TSL download: transport copies configuration and validates fixed routes and HTTP signature opt-in', async () => fixture(async () => {
  const options = sourceOptions(), copied = new TslHttpSource(options); options.routes.hash.url = 'https://changed.invalid/hash';
  assert.equal(await copied.readHash(), hash(base.xml));
  for (const bad of ['http://example.invalid/hash', 'https://a:b@example.invalid/hash', 'https://example.invalid/hash#x', 'https://example.invalid/hash?q=x', 'file:///etc/hosts']) {
    const input = sourceOptions(); input.routes.hash.url = bad;
    assert.throws(() => new TslHttpSource(input), rejected('KIM_TSL_HTTP_CONFIGURATION'));
  }
  const input = sourceOptions(); input.routes.signature = { url: 'http://fixed.invalid/signature' };
  assert.throws(() => new TslHttpSource(input), rejected('KIM_TSL_HTTP_CONFIGURATION'));
  assert.ok(new TslHttpSource({ ...input, allowHttpSignature: true }));
}));

test('TSL download: official environment/profile catalog keeps XML/hash and detached mirrors explicit', () => {
  for (const environment of ['production', 'reference', 'test']) for (const profile of ['ecc-rsa', 'rsa']) {
    const c = officialTslInternetRoutes({ environment, profile }), suffix = environment === 'production' ? '' : environment === 'reference' ? '-ref' : '-test';
    assert.equal(new URL(c.routes.xml.url).hostname, `download${suffix}.tsl.ti-dienste.de`);
    assert.equal(c.routes.hash.url, c.routes.xml.url.replace('.xml', '.sha2'));
    assert.equal(c.routes.signature.url.startsWith('http://download' + (suffix ? '-testref' : '') + '.crl.ti-dienste.de/TSL-' + (profile === 'ecc-rsa' ? 'ECC' : 'RSA') + suffix + '/'), true);
    assert.ok(new TslHttpSource({ ...c, allowHttpSignature: true }));
  }
  assert.throws(() => officialTslInternetRoutes({ environment: 'custom' }), rejected('KIM_TSL_HTTP_CONFIGURATION'));
});

test('TSL refresh: signer revocation on a later unchanged-list check revokes existing handles', async () => fixture(async ({ manager, store }) => {
  const m = manager(), v = (await m.refresh()).snapshot.ocspVerifierFor(signer.certificate);
  state.now += 3601000; state.ocspState = 'revoked';
  await assert.rejects(m.refresh(), rejected('KIM_TSL_SIGNER_STATUS'));
  assert.throws(() => v.createRequest(signer.certificate), ocspRejected);
  assert.equal(count('/xml'), 1); assert.equal(count('/ocsp'), 2); assert.equal(store.currentVersion().sequence, 10001);
}));

test('TSL refresh: authenticated download with a broken inner signature never enters the store', async () => fixture(async ({ manager, store }) => {
  const xml = Buffer.from(base.xml.toString().replace('Teststadt', 'Anderstadt'));
  state.bundle = { ...base, xml, detachedSignature: await f.detach(xml, signer) };
  await assert.rejects(manager().refresh(), rejected('KIM_TSL_XML_DIGEST'));
  assert.equal(count('/ocsp'), 1); assert.equal(store.currentVersion(), null);
}));

for (const table of ['kim_tsl_checkpoint_v1', 'kim_tsl_download_binding_v1']) test('TSL refresh: deleting ' + table + ' cannot silently reset binding on restart', async () => fixture(async ({ manager, store, open, path }) => {
  const m = manager(); await m.refresh(); m.close(); store.close();
  const db = new DatabaseSync(path); db.exec(`DELETE FROM ${table}`); db.close();
  assert.throws(() => open(), e => /^KIM_TSL_STORE_/.test(e?.code));
}));

test('TSL store: original v1 encrypted bundle upgrades only after authentication and preserves its sequence', async () => fixture(async ({ store, open, path, key, scopeId, manager }) => {
  await store.activate(base); store.close();
  // Reconstitute the previous release's on-disk format. The encrypted original
  // bundle and its version metadata are byte-for-byte the existing v1 format.
  const db = new DatabaseSync(path), vault = new Vault(key);
  const row = db.prepare('SELECT binding_sha FROM kim_tsl_trust_v1 WHERE scope_id=?').get(scopeId);
  db.exec('DROP TABLE kim_tsl_download_binding_v1; DROP TABLE kim_tsl_checkpoint_v1;');
  db.prepare('UPDATE kim_tsl_trust_v1 SET key_check=? WHERE scope_id=?')
    .run(vault.seal(Buffer.from('kim-tsl-key-v1'), JSON.stringify(['tsl-key', scopeId, row.binding_sha])), scopeId);
  db.close(); vault.close();
  const upgraded = open(); assert.equal(upgraded.currentVersion().sequence, 10001);
  assert.deepEqual(upgraded.candidate().xml, base.xml);
  assert.equal((await manager({ store: upgraded }).refresh()).downloaded, false); assert.equal(count('/xml'), 0);
}));
