import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import https from 'node:https';
import net from 'node:net';
import { randomUUID, randomBytes, createHash, X509Certificate } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { mkdtemp, readFile, rm, chmod } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { once } from 'node:events';
import { spawn } from 'node:child_process';
import { onlineFixture } from './ocsp-online-fixture.mjs';
import { OcspHttpTransport } from '../../services/kim/ocsp-http.mjs';
import { DurableOcspStatusCache } from '../../services/kim/ocsp-store.mjs';
import { receiveEccKimMessage } from '../../services/kim/client-message.mjs';

let fixture;
before(async () => { fixture = await onlineFixture(); });
after(async () => { await fixture?.close(); });
const sha = b => createHash('sha256').update(b).digest('hex');
const leaf = () => fixture.signing.certificate;
async function endpoint({ secure = false, handler } = {}) {
  const requests = [], sockets = new Set();
  const listener = (req, res) => {
    const parts = []; req.on('data', b => parts.push(b));
    req.on('end', () => {
      const bytes = Buffer.concat(parts); requests.push({ bytes, method: req.method, url: req.url, headers: req.headers });
      if (state.handler) return state.handler(req, res, bytes);
      res.writeHead(200, { 'Content-Type': 'application/ocsp-response' }); res.end(fixture.response(bytes));
    });
  };
  const server = secure ? https.createServer(fixture.pki.tls, listener) : http.createServer(listener);
  server.on('connection', socket => { sockets.add(socket); socket.on('close', () => sockets.delete(socket)); });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const port = server.address().port, url = `${secure ? 'https://localhost.test' : 'http://127.0.0.1'}:${port}/ocsp`;
  const config = { url, ...(secure ? { ca: fixture.pki.roots, connectAddress: '127.0.0.1' } : { allowHttp: true }) };
  const state = { server, requests, config, handler, transport: new OcspHttpTransport(config),
    close: async () => { for (const s of sockets) s.destroy(); await new Promise(resolve => server.close(resolve)); } };
  return state;
}
async function setup(options = {}) {
  const dir = await mkdtemp(join(tmpdir(), 'cs-ocsp-durable-')), e = await endpoint(options);
  const base = { path: join(dir, 'ocsp.sqlite'), key: randomBytes(32), scopeId: randomUUID(),
    verifier: fixture.verifier(), transport: e.transport, clock: () => fixture.now };
  const stores = [], open = changes => { const c = new DurableOcspStatusCache({ ...base, ...changes }); stores.push(c); return c; };
  return { dir, e, base, open, inspect: fn => { const db = new DatabaseSync(base.path); try { return fn(db); } finally { db.close(); } },
    close: async () => { for (const c of stores) c.close(); await e.close(); await rm(dir, { recursive: true, force: true }); } };
}
const check = cache => cache.check({ certificate: leaf() });
const code = message => ({ message });
async function waitFor(condition) {
  const deadline = Date.now() + 5000;
  while (!condition()) {
    assert(Date.now() < deadline, 'Local test peer did not reach the expected state');
    await new Promise(resolve => setTimeout(resolve, 5));
  }
}

test('HTTP POST sends the exact DER and OCSP media types without requester credentials; response bytes remain opaque', async () => {
  const e = await endpoint();
  try {
    const request = fixture.verifier().createRequest(leaf()), response = await e.transport.obtain(request);
    assert.equal(fixture.verifier().verify({ certificate: leaf(), request, response }).status, 'good');
    const seen = e.requests[0]; assert.equal(seen.method, 'POST'); assert.equal(seen.url, '/ocsp'); assert.deepEqual(seen.bytes, request);
    assert.equal(seen.headers['content-type'], 'application/ocsp-request'); assert.equal(seen.headers.accept, 'application/ocsp-response');
    assert.equal(seen.headers.authorization, undefined); assert.equal(seen.headers.cookie, undefined);
  } finally { await e.close(); }
});
test('HTTPS validates CA and hostname even when the connection uses an explicitly configured IP', async () => {
  const e = await endpoint({ secure: true }), request = fixture.verifier().createRequest(leaf());
  try {
    assert((await e.transport.obtain(request)).length > 0);
    await assert.rejects(new OcspHttpTransport({ ...e.config, ca: undefined }).obtain(request), code('KIM_OCSP_HTTP_CONNECTION'));
    await assert.rejects(new OcspHttpTransport({ ...e.config, url: e.config.url.replace('localhost.test', 'wrong.test') }).obtain(request), code('KIM_OCSP_HTTP_CONNECTION'));
    assert.equal(e.requests.length, 1);
  } finally { await e.close(); }
});
test('routes require explicit HTTP opt-in and reject credentials, fragments, unsafe protocols and inconsistent IP overrides', () => {
  for (const config of [{ url: 'http://127.0.0.1/ocsp' }, { url: 'file:///etc/passwd' }, { url: 'https://user:secret@host.test/' },
    { url: 'https://host.test/#fragment' }, { url: 'https://host.test/\n' }, { url: 'https://host.test/', connectAddress: 'attacker.test' },
    { url: 'https://127.0.0.1/', connectAddress: '127.0.0.2' }, { url: 'https://host.test/', timeoutMs: 0 }]) {
    assert.throws(() => new OcspHttpTransport(config), code('KIM_OCSP_HTTP_CONFIGURATION'));
  }
});
test('redirects and non-200 responses never trigger a second destination or a transport fallback', async () => {
  const other = await endpoint(), e = await endpoint({ handler: (_, res) => { res.writeHead(302, { Location: other.config.url }); res.end(); } });
  try {
    const request = fixture.verifier().createRequest(leaf());
    await assert.rejects(e.transport.obtain(request), code('KIM_OCSP_HTTP_STATUS')); assert.equal(other.requests.length, 0);
    for (const status of [204, 401, 404, 429, 500]) {
      e.handler = (_, res) => { res.writeHead(status); res.end('secret diagnostic'); };
      await assert.rejects(e.transport.obtain(request), code('KIM_OCSP_HTTP_STATUS'));
    }
  } finally { await e.close(); await other.close(); }
});
test('wrong or duplicate media types and compressed responses are rejected before OCSP parsing', async () => {
  const e = await endpoint(), request = fixture.verifier().createRequest(leaf());
  try {
    for (const headers of [{ 'Content-Type': 'text/html' }, { 'Content-Type': 'application/ocsp-response; charset=utf-8' },
      { 'Content-Type': 'application/ocsp-response', 'Content-Encoding': 'gzip' },
      ['Content-Type', 'application/ocsp-response', 'Content-Type', 'application/ocsp-response']]) {
      e.handler = (_, res) => { res.writeHead(200, headers); res.end('not an OCSP response'); };
      await assert.rejects(e.transport.obtain(request), code('KIM_OCSP_HTTP_FORMAT'));
    }
  } finally { await e.close(); }
});
test('response limits apply to declared and streamed sizes; empty and truncated bodies cannot pass', async () => {
  const e = await endpoint(), request = fixture.verifier().createRequest(leaf());
  try {
    for (const declare of [false, true]) {
      e.handler = (_, res) => { res.writeHead(200, { 'Content-Type': 'application/ocsp-response', ...(declare ? { 'Content-Length': 262145 } : {}) }); res.end(Buffer.alloc(262145)); };
      await assert.rejects(e.transport.obtain(request), code('KIM_OCSP_RESPONSE_SIZE'));
    }
    e.handler = (_, res) => { res.writeHead(200, { 'Content-Type': 'application/ocsp-response', 'Content-Length': 50 }); res.end('short'); };
    await assert.rejects(e.transport.obtain(request), code('KIM_OCSP_HTTP_INCOMPLETE'));
    e.handler = (_, res) => { res.writeHead(200, { 'Content-Type': 'application/ocsp-response' }); res.end(); };
    await assert.rejects(e.transport.obtain(request), e => ['KIM_OCSP_HTTP_INCOMPLETE', 'KIM_OCSP_HTTP_FORMAT'].includes(e.code));
  } finally { await e.close(); }
});
test('absolute HTTP deadline stops a trickling body; pre-aborted requests make no connection', async () => {
  const e = await endpoint({ handler: (_, res) => {
    res.writeHead(200, { 'Content-Type': 'application/ocsp-response' });
    const timer = setInterval(() => res.write('x'), 10); res.on('close', () => clearInterval(timer));
  } });
  try {
    const request = fixture.verifier().createRequest(leaf()), c = new AbortController(); c.abort();
    await assert.rejects(e.transport.obtain(request, c.signal), code('KIM_OCSP_ABORTED')); assert.equal(e.requests.length, 0);
    await assert.rejects(new OcspHttpTransport({ ...e.config, timeoutMs: 60 }).obtain(request), code('KIM_OCSP_HTTP_TIMEOUT'));
    assert.equal(e.requests.length, 1);
  } finally { await e.close(); }
});
test('malformed HTTP framing and oversized headers fail with bounded codes rather than exposing raw diagnostics', async () => {
  const server = net.createServer(socket => socket.once('data', () => socket.end('HTTP/1.1 200 OK\r\nContent-Type: application/ocsp-response\r\nX-Test: ' + 'a'.repeat(17000) + '\r\n\r\nx')));
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  try {
    const t = new OcspHttpTransport({ url: `http://127.0.0.1:${server.address().port}/`, allowHttp: true });
    await assert.rejects(t.obtain(fixture.verifier().createRequest(leaf())), code('KIM_OCSP_HTTP_CONNECTION'));
    await assert.rejects(t.obtain(Buffer.alloc(4097)), code('KIM_OCSP_REQUEST_SIZE'));
  } finally { await new Promise(resolve => server.close(resolve)); }
});
test('verified evidence survives close/reopen byte-exactly and is not fetched again while current', async () => {
  const s = await setup();
  try {
    const a = s.open(), first = await check(a); assert.equal(first.source, 'response'); a.close();
    const b = s.open(), second = await check(b);
    assert.equal(second.source, 'persistent-cache'); assert.deepEqual(second.request, first.request); assert.deepEqual(second.response, first.response);
    assert.equal(second.identityStatus, 'unverified'); assert.equal(s.e.requests.length, 1);
    first.response.fill(0); second.request.fill(0); assert.equal((await check(b)).status, 'good');
  } finally { await s.close(); }
});
test('stored response, certificate and subject bytes are encrypted; record movement and expiry edits fail authentication', async () => {
  const s = await setup();
  try {
    const c = s.open(), proof = await check(c);
    const stored = s.inspect(db => db.prepare('SELECT * FROM ocsp_evidence').get());
    assert(!Buffer.from(stored.content).includes(proof.response));
    for (const name of ['ocsp.sqlite', 'ocsp.sqlite-wal']) {
      const bytes = await readFile(join(s.dir, name));
      assert(!bytes.includes(new X509Certificate(leaf()).raw)); assert(!bytes.includes(Buffer.from('Not a TI identity')));
    }
    s.inspect(db => db.prepare('UPDATE ocsp_evidence SET valid_until=valid_until+1000').run());
    await assert.rejects(check(c), code('KIM_OCSP_STORE_INTEGRITY')); assert.equal(s.e.requests.length, 1);
    s.inspect(db => db.prepare('UPDATE ocsp_evidence SET valid_until=?, certificate_sha=?').run(stored.valid_until, sha(new X509Certificate(fixture.authentication.certificate).raw)));
    await assert.rejects(c.check({ certificate: fixture.authentication.certificate }), code('KIM_OCSP_STORE_INTEGRITY'));
    assert.equal(s.e.requests.length, 1);
  } finally { await s.close(); }
});
test('same-process and separate-instance concurrency share one durable lease and one response', async () => {
  let release;
  const s = await setup({ handler: (_, res, bytes) => { release = () => { res.writeHead(200, { 'Content-Type': 'application/ocsp-response' }); res.end(fixture.response(bytes)); }; } });
  try {
    const a = s.open(), b = s.open(), first = check(a), same = check(a), second = check(b);
    await waitFor(() => release);
    release(); const [x, y, z] = await Promise.all([first, same, second]);
    assert.equal(s.e.requests.length, 1); assert.equal(z.source, 'persistent-cache'); assert.deepEqual(x.response, y.response);
    x.response.fill(0); assert.notDeepEqual(x.response, y.response);
    assert.equal(s.inspect(db => db.prepare('SELECT count(*) n FROM ocsp_leases').get().n), 0);
  } finally { await s.close(); }
});
test('revoked and unknown responses are durably reused without turning them into good', async () => {
  for (const state of ['revoked', 'unknown']) {
    const s = await setup({ handler: (_, res, bytes) => { res.writeHead(200, { 'Content-Type': 'application/ocsp-response' }); res.end(fixture.response(bytes, { state })); } });
    try { const a = s.open(); assert.equal((await check(a)).status, state); a.close(); assert.equal((await check(s.open())).status, state); assert.equal(s.e.requests.length, 1); }
    finally { await s.close(); }
  }
});
test('signature failures are not persisted and HTTP failures do not cause blind retries', async () => {
  const s = await setup({ handler: (_, res, bytes) => { res.writeHead(200, { 'Content-Type': 'application/ocsp-response' }); res.end(fixture.response(bytes, { badSignature: true })); } });
  try {
    const c = s.open(); await assert.rejects(check(c), code('KIM_OCSP_SIGNATURE'));
    assert.equal(s.inspect(db => db.prepare('SELECT count(*) n FROM ocsp_evidence').get().n), 0);
    s.e.handler = (_, res) => { res.writeHead(503); res.end(); };
    await assert.rejects(check(c), code('KIM_OCSP_HTTP_STATUS')); assert.equal(s.e.requests.length, 2);
    s.e.handler = undefined; assert.equal((await check(c)).status, 'good');
  } finally { await s.close(); }
});
test('four OCSP protocol-status errors cause a persistent five-minute backoff, including after restart', async () => {
  let clock = fixture.now;
  const s = await setup({ handler: (_, res) => { res.writeHead(200, { 'Content-Type': 'application/ocsp-response' }); res.end(Buffer.from('30030a0103', 'hex')); } });
  try {
    const options = { clock: () => clock, verifier: fixture.verifier(() => clock) }, a = s.open(options);
    await assert.rejects(check(a), code('KIM_OCSP_RESPONDER_ERROR')); assert.equal(s.e.requests.length, 4); a.close();
    const b = s.open(options); await assert.rejects(check(b), code('KIM_OCSP_BACKOFF')); assert.equal(s.e.requests.length, 4);
    clock += 300_000; s.e.handler = undefined; assert.equal((await check(b)).status, 'good'); assert.equal(s.e.requests.length, 5);
  } finally { await s.close(); }
});
test('a transient OCSP status error can recover within the three repetitions and creates no backoff', async () => {
  let attempts = 0;
  const s = await setup({ handler: (_, res, bytes) => { res.writeHead(200, { 'Content-Type': 'application/ocsp-response' }); res.end(++attempts < 3 ? Buffer.from('30030a0103', 'hex') : fixture.response(bytes)); } });
  try { assert.equal((await check(s.open())).status, 'good'); assert.equal(attempts, 3); assert.equal(s.inspect(db => db.prepare('SELECT count(*) n FROM ocsp_backoff').get().n), 0); }
  finally { await s.close(); }
});
test('freshness expires at the precise boundary and newer pin snapshots recheck existing bytes without a needless query', async () => {
  let clock = fixture.now;
  const s = await setup({ handler: (_, res, bytes) => { res.writeHead(200, { 'Content-Type': 'application/ocsp-response' }); res.end(fixture.response(bytes, { producedAt: clock })); } });
  try {
    const a = s.open({ clock: () => clock, verifier: fixture.verifier(() => clock, { validUntil: clock + 1000 }) });
    await check(a); a.close(); clock += 1000;
    const b = s.open({ clock: () => clock, verifier: fixture.verifier(() => clock) });
    assert.equal((await check(b)).source, 'persistent-cache'); assert.equal(s.e.requests.length, 1);
    clock = fixture.now + 3600_000; assert.equal((await check(b)).source, 'persistent-cache');
    clock++; assert.equal((await check(b)).source, 'response'); assert.equal(s.e.requests.length, 2);
  } finally { await s.close(); }
});
test('an expired trust snapshot cannot make a stored response authoritative', async () => {
  let clock = fixture.now;
  const s = await setup();
  try {
    const c = s.open({ clock: () => clock, verifier: fixture.verifier(() => clock, { validUntil: clock + 1000 }) });
    await check(c); clock += 1000;
    await assert.rejects(check(c), code('KIM_OCSP_TRUST_UNAVAILABLE')); assert.equal(s.e.requests.length, 1);
  } finally { await s.close(); }
});
test('clock rollback rechecks the signed producedAt instead of trusting the stored expiration', async () => {
  let clock = fixture.now + 600_000;
  const s = await setup({ handler: (_, res, bytes) => { res.writeHead(200, { 'Content-Type': 'application/ocsp-response' }); res.end(fixture.response(bytes, { producedAt: clock })); } });
  try {
    const c = s.open({ clock: () => clock, verifier: fixture.verifier(() => clock) });
    await check(c); clock = fixture.now;
    await assert.rejects(check(c), code('KIM_OCSP_STALE')); assert.equal(s.e.requests.length, 1);
  } finally { await s.close(); }
});
test('scope, route, quota and encryption-key mismatches cannot silently reuse another configuration', async () => {
  const s = await setup();
  try {
    const c = s.open(); await check(c);
    for (const changes of [{ key: randomBytes(32) }, { maxEntries: 1 },
      { transport: new OcspHttpTransport({ ...s.e.config, url: s.e.config.url + '/different' }) }]) {
      assert.throws(() => s.open(changes), code('KIM_OCSP_STORE_CONFIGURATION'));
    }
    const other = s.open({ scopeId: randomUUID() }); assert.equal((await check(other)).source, 'response'); assert.equal(s.e.requests.length, 2);
  } finally { await s.close(); }
});
test('entry and byte quotas fail explicitly without discarding fresh evidence or leaving a permanent lease', async () => {
  for (const options of [{ maxEntries: 1 }, { maxBytes: 1 }]) {
    const s = await setup();
    try {
      const c = s.open(options);
      if (options.maxEntries) {
        await check(c); await assert.rejects(c.check({ certificate: fixture.authentication.certificate }), code('KIM_OCSP_CACHE_CAPACITY'));
        assert.equal((await check(c)).source, 'persistent-cache');
      } else await assert.rejects(check(c), code('KIM_OCSP_CACHE_CAPACITY'));
      assert.equal(s.inspect(db => db.prepare('SELECT count(*) n FROM ocsp_leases').get().n), 0);
    } finally { await s.close(); }
  }
});
test('timeout and close abort active I/O, release only their own leases and accept no late response', async () => {
  let release;
  const s = await setup({ handler: (_, res, bytes) => { release = () => res.end(fixture.response(bytes)); } });
  try {
    const c = s.open({ timeoutMs: 60 }); await assert.rejects(check(c), code('KIM_OCSP_TIMEOUT')); release();
    assert.equal(s.inspect(db => db.prepare('SELECT count(*) n FROM ocsp_evidence').get().n), 0);
    const a = s.open(), pending = check(a); a.close(); await assert.rejects(pending, code('KIM_OCSP_CACHE_CLOSED'));
    assert.equal(s.e.requests.length, 1); assert.equal(s.inspect(db => db.prepare('SELECT count(*) n FROM ocsp_leases').get().n), 0);
    const broken = s.open(), interrupted = assert.rejects(check(broken), code('KIM_OCSP_CACHE_CLOSED'));
    await waitFor(() => s.e.requests.length === 2);
    s.inspect(db => db.exec('DROP TABLE ocsp_leases'));
    assert.throws(() => broken.close(), code('KIM_OCSP_STORE_FAILURE')); await interrupted;
  } finally { await s.close(); }
});
test('persistent OSIG/AUT proofs feed the actual KIM receiver and still cannot grant normal delivery', async () => {
  const s = await setup({ secure: true });
  try {
    const c = s.open(), signing = await check(c), authentication = await c.check({ certificate: fixture.authentication.certificate });
    c.close();
    const reopened = s.open(), storedSigning = await check(reopened), storedAuth = await reopened.check({ certificate: fixture.authentication.certificate });
    const result = receiveEccKimMessage({ ...fixture.message, ocsp: { verifier: reopened.verifier, signing: storedSigning, authentication: storedAuth } }, { cmVersion: 'TEST_0.1.0', ptVersion: '1.5.5' });
    assert.equal(s.e.requests.length, 2); assert.equal(result.originalSha256, sha(fixture.message.bytes));
    assert.equal(result.diagnostic.integrityResult, '07'); assert.equal(result.deliveryStatus, 'diagnostic-only');
    assert.deepEqual(result.diagnostic.certificateStatus.map(s => s.responseSha256), [signing.responseSha256, authentication.responseSha256]);
    assert.equal(result.diagnostic.decryptedOriginalAttached, false);
  } finally { await s.close(); }
});
test('a replaced lease cannot be deleted by its former owner or overwritten by a late response', async () => {
  for (const closeFormerOwner of [false, true]) {
    let clock = fixture.now;
    const replies = [], s = await setup({ handler: (_, res, bytes) => {
      const response = fixture.response(bytes, { producedAt: clock });
      replies.push(() => { res.writeHead(200, { 'Content-Type': 'application/ocsp-response' }); res.end(response); });
    } });
    try {
      const options = { clock: () => clock, verifier: fixture.verifier(() => clock) }, a = s.open(options);
      const old = assert.rejects(check(a), code(closeFormerOwner ? 'KIM_OCSP_CACHE_CLOSED' : 'KIM_OCSP_LEASE_LOST'));
      await waitFor(() => replies.length === 1); clock += 11_001;
      const b = s.open(options), pending = check(b); await waitFor(() => replies.length === 2);
      if (closeFormerOwner) {
        a.close(); await old;
        assert.equal(s.inspect(db => db.prepare('SELECT count(*) n FROM ocsp_leases').get().n), 1);
      }
      replies[1](); const fresh = await pending;
      replies[0](); await old;
      const reused = await check(b);
      assert.equal(reused.responseSha256, fresh.responseSha256); assert.equal(reused.source, 'persistent-cache');
      assert.equal(s.inspect(db => db.prepare('SELECT count(*) n FROM ocsp_leases').get().n), 0);
    } finally { await s.close(); }
  }
});

async function childCache(s, timeoutMs = 10_000) {
  const script = `import {readFileSync} from 'node:fs';
    import {PinnedOcspVerifier} from ${JSON.stringify(new URL('../../services/kim/ocsp.mjs', import.meta.url).href)};
    import {OcspHttpTransport} from ${JSON.stringify(new URL('../../services/kim/ocsp-http.mjs', import.meta.url).href)};
    import {DurableOcspStatusCache} from ${JSON.stringify(new URL('../../services/kim/ocsp-store.mjs', import.meta.url).href)};
    const o=JSON.parse(readFileSync(0,'utf8')); const clock=()=>o.now;
    const verifier=new PinnedOcspVerifier({authorities:o.authorities,validFrom:o.now-1000,validUntil:o.now+7200000,clock});
    const cache=new DurableOcspStatusCache({path:o.path,key:Buffer.from(o.key,'hex'),scopeId:o.scopeId,verifier,transport:new OcspHttpTransport(o.route),clock,timeoutMs:o.timeoutMs});
    process.stdout.write('READY\\n');
    try {const r=await cache.check({certificate:o.certificate});process.stdout.write(JSON.stringify({status:r.status,source:r.source})+'\\n');}
    finally {cache.close();}`;
  const child = spawn(process.execPath, ['--input-type=module', '-e', script], { stdio: ['pipe', 'pipe', 'pipe'] });
  let output = ''; child.stdout.on('data', b => { output += b.toString(); }); child.stderr.resume();
  child.stdin.end(JSON.stringify({ now: fixture.now, authorities: fixture.authorities, path: s.base.path, key: s.base.key.toString('hex'),
    scopeId: s.base.scopeId, route: s.e.config, timeoutMs, certificate: leaf() }));
  const ended = once(child, 'close');
  return { child, ended, output: () => output };
}
test('another process reads the committed result instead of issuing a competing HTTP request', async () => {
  let release;
  const s = await setup({ handler: (_, res, bytes) => { release = () => { res.writeHead(200, { 'Content-Type': 'application/ocsp-response' }); res.end(fixture.response(bytes)); }; } });
  let worker;
  try {
    const pending = check(s.open()); await waitFor(() => release);
    worker = await childCache(s); await waitFor(() => worker.output().includes('READY'));
    release(); await pending; const [exit] = await worker.ended;
    assert.equal(exit, 0); assert.match(worker.output(), /"source":"persistent-cache"/); assert.equal(s.e.requests.length, 1);
  } finally { if (worker?.child.exitCode === null && worker?.child.signalCode === null) worker.child.kill('SIGKILL'); if (worker) await worker.ended; await s.close(); }
});
test('SIGKILL during an HTTP query leaves a bounded lease; a later process safely reacquires it without stored success', async () => {
  const s = await setup({ handler: () => {} }); let worker;
  try {
    // Create the namespace before launching another process against the same protected volume.
    s.open().close(); worker = await childCache(s);
    await waitFor(() => s.e.requests.length);
    worker.child.kill('SIGKILL'); await worker.ended;
    assert.equal(s.inspect(db => db.prepare('SELECT count(*) n FROM ocsp_evidence').get().n), 0);
    assert.equal(s.inspect(db => db.prepare('SELECT count(*) n FROM ocsp_leases').get().n), 1);
    const later = fixture.now + 11_001;
    s.e.handler = (_, res, bytes) => { res.writeHead(200, { 'Content-Type': 'application/ocsp-response' }); res.end(fixture.response(bytes, { producedAt: later })); };
    const recovery = s.open({ clock: () => later, verifier: fixture.verifier(() => later) });
    assert.equal((await check(recovery)).status, 'good'); assert.equal(s.e.requests.length, 2);
  } finally { if (worker?.child.exitCode === null && worker?.child.signalCode === null) worker.child.kill('SIGKILL'); if (worker) await worker.ended; await s.close(); }
});
test('unprotected directory permissions are rejected before storing any certificate evidence', async () => {
  const s = await setup();
  try { await chmod(s.dir, 0o755); assert.throws(() => s.open(), code('KIM_OCSP_STORE_CONFIGURATION')); }
  finally { await chmod(s.dir, 0o700); await s.close(); }
});
