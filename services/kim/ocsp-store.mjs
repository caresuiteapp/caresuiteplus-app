import { createHash, randomUUID, X509Certificate } from 'node:crypto';
import { openStore, transaction, Vault, isUuid } from '../gkv/storage.mjs';
import { PinnedOcspVerifier, OcspError } from './ocsp.mjs';
import { OcspHttpTransport } from './ocsp-http.mjs';

const hash = b => createHash('sha256').update(b).digest('hex');
const fail = code => { throw new OcspError(code); };
const rowIdentity = r => `ocsp-v1:${r.scope}:${r.certificate_sha}:${r.produced_at}:${r.valid_until}:${r.octets}`;
const copyProof = r => Object.freeze({ ...r, request: Buffer.from(r.request), response: Buffer.from(r.response) });
function leafBytes(input) {
  try {
    if (typeof input === 'string') {
      if (input.length > 20_000 || !/^\s*-----BEGIN CERTIFICATE-----[A-Za-z0-9+/=\r\n]+-----END CERTIFICATE-----\s*$/.test(input)) throw new Error();
    } else if (!(input instanceof Uint8Array) || !input.length || input.length > 12_000) throw new Error();
    const c = new X509Certificate(input);
    if (c.raw.length > 12_000 || (typeof input !== 'string' && !c.raw.equals(Buffer.from(input)))) throw new Error();
    return c.raw;
  } catch { fail('KIM_OCSP_CERTIFICATE'); }
}
function decode(value, max) {
  if (typeof value !== 'string' || !value.length || value.length > Math.ceil(max / 3) * 4) fail('KIM_OCSP_STORE_INTEGRITY');
  const b = Buffer.from(value, 'base64');
  if (!b.length || b.length > max || b.toString('base64') !== value) fail('KIM_OCSP_STORE_INTEGRITY');
  return b;
}

/** Local durable status evidence, not a TI trust authority. The server supplies a namespace,
 * pinned verifier, fixed HTTP transport and an external storage key. Never use Vercel /tmp
 * or independent replica volumes as the production database. No patient/mailbox data enters SQL.
 */
export class DurableOcspStatusCache {
  #db; #vault; #scope; #verifier; #transport; #clock; #limit; #bytes; #timeout;
  #running = new Map(); #timer; #closed = false;
  constructor({ path, key, scopeId, verifier, transport, clock = Date.now, maxEntries = 256,
    maxBytes = 67_108_864, timeoutMs = 10_000 }) {
    try {
      if (!isUuid(scopeId) || !(verifier instanceof PinnedOcspVerifier) || !(transport instanceof OcspHttpTransport)
        || typeof clock !== 'function' || !Number.isInteger(maxEntries) || maxEntries < 1 || maxEntries > 4096
        || !Number.isSafeInteger(maxBytes) || maxBytes < 1 || maxBytes > 1_073_741_824
        || !Number.isInteger(timeoutMs) || timeoutMs < 50 || timeoutMs > 30_000) fail('KIM_OCSP_STORE_CONFIGURATION');
      this.#scope = scopeId; this.#verifier = verifier; this.#transport = transport; this.#clock = clock;
      this.#limit = maxEntries; this.#bytes = maxBytes; this.#timeout = timeoutMs;
      this.#vault = new Vault(key); this.#db = openStore(path);
      this.#db.exec(`
        CREATE TABLE IF NOT EXISTS ocsp_scopes (scope TEXT PRIMARY KEY, configuration BLOB NOT NULL) STRICT;
        CREATE TABLE IF NOT EXISTS ocsp_evidence (
          scope TEXT NOT NULL REFERENCES ocsp_scopes(scope), certificate_sha TEXT NOT NULL,
          produced_at INTEGER NOT NULL, valid_until INTEGER NOT NULL, octets INTEGER NOT NULL,
          content BLOB NOT NULL, PRIMARY KEY(scope,certificate_sha)
        ) STRICT;
        CREATE INDEX IF NOT EXISTS ocsp_expiry ON ocsp_evidence(scope,valid_until);
        CREATE TABLE IF NOT EXISTS ocsp_leases (
          scope TEXT NOT NULL REFERENCES ocsp_scopes(scope), certificate_sha TEXT NOT NULL,
          owner TEXT NOT NULL, valid_until INTEGER NOT NULL, PRIMARY KEY(scope,certificate_sha)
        ) STRICT;
        CREATE TABLE IF NOT EXISTS ocsp_backoff (
          scope TEXT NOT NULL REFERENCES ocsp_scopes(scope), certificate_sha TEXT NOT NULL,
          valid_until INTEGER NOT NULL, PRIMARY KEY(scope,certificate_sha)
        ) STRICT;
      `);
      const configuration = Buffer.from(JSON.stringify({ version: 1, routeSha256: transport.routeSha256, maxEntries, maxBytes }));
      transaction(this.#db, () => {
        const old = this.#db.prepare('SELECT configuration FROM ocsp_scopes WHERE scope=?').get(scopeId);
        if (old) {
          if (!this.#vault.open(old.configuration, `ocsp-scope-v1:${scopeId}`).equals(configuration)) fail('KIM_OCSP_STORE_CONFIGURATION');
        } else this.#db.prepare('INSERT INTO ocsp_scopes VALUES(?,?)').run(scopeId, this.#vault.seal(configuration, `ocsp-scope-v1:${scopeId}`));
      });
      this.prune();
      this.#timer = setInterval(() => { try { this.prune(); } catch { /* A failing store never authorizes evidence. */ } }, 60_000);
      this.#timer.unref();
    } catch (e) {
      try { this.#db?.close(); } catch { /* Preserve the bounded configuration error. */ }
      finally { this.#vault?.close(); }
      if (e instanceof OcspError) throw e; fail('KIM_OCSP_STORE_CONFIGURATION');
    }
  }
  get verifier() { return this.#verifier; }
  #now() {
    let now; try { now = this.#clock(); } catch { fail('KIM_OCSP_CLOCK'); }
    if (!Number.isSafeInteger(now) || now < 0) fail('KIM_OCSP_CLOCK');
    return now;
  }
  #open() { if (this.#closed) fail('KIM_OCSP_CACHE_CLOSED'); }
  #prune(now) {
    this.#db.prepare('DELETE FROM ocsp_evidence WHERE scope=? AND valid_until<=?').run(this.#scope, now);
    this.#db.prepare('DELETE FROM ocsp_leases WHERE scope=? AND valid_until<=?').run(this.#scope, now);
    this.#db.prepare('DELETE FROM ocsp_backoff WHERE scope=? AND valid_until<=?').run(this.#scope, now);
  }
  prune() {
    this.#open();
    try { transaction(this.#db, () => this.#prune(this.#now())); }
    catch (e) { if (e instanceof OcspError) throw e; fail('KIM_OCSP_STORE_FAILURE'); }
  }
  #read(row, certificate) {
    let clear;
    try {
      if (row.content.length > 360_000 || row.octets < 1 || row.octets > 266_240) fail('KIM_OCSP_STORE_INTEGRITY');
      clear = this.#vault.open(row.content, rowIdentity(row));
      const object = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(clear));
      if (!object || Object.keys(object).sort().join(',') !== 'request,response') fail('KIM_OCSP_STORE_INTEGRITY');
      const request = decode(object.request, 4096), response = decode(object.response, 262_144);
      if (request.length + response.length !== row.octets || hash(certificate) !== row.certificate_sha) fail('KIM_OCSP_STORE_INTEGRITY');
      const evidence = this.#verifier.verify({ certificate, request, response });
      if (evidence.producedAt !== row.produced_at || row.valid_until !== evidence.producedAt + 3_600_001
        || evidence.validUntil <= this.#now()) fail('KIM_OCSP_STORE_INTEGRITY');
      // A renewed snapshot may shorten or extend the same evidence's usable lifetime.
      // The persisted expiry is only a cleanup hint; signature and current pins are always rechecked.
      return { ...evidence, source: 'persistent-cache', request, response };
    } catch (e) { if (e instanceof OcspError) throw e; fail('KIM_OCSP_STORE_INTEGRITY'); }
    finally { clear?.fill(0); }
  }
  #claim(certificate, owner) {
    return transaction(this.#db, () => {
      const now = this.#now(), sha = hash(certificate); this.#prune(now);
      const row = this.#db.prepare('SELECT * FROM ocsp_evidence WHERE scope=? AND certificate_sha=?').get(this.#scope, sha);
      if (row) return { proof: this.#read(row, certificate) };
      if (this.#db.prepare('SELECT 1 FROM ocsp_backoff WHERE scope=? AND certificate_sha=?').get(this.#scope, sha)) fail('KIM_OCSP_BACKOFF');
      const active = this.#db.prepare('SELECT valid_until FROM ocsp_leases WHERE scope=? AND certificate_sha=?').get(this.#scope, sha);
      if (active) return { wait: true };
      const used = this.#db.prepare(`SELECT
        (SELECT count(*) FROM ocsp_evidence WHERE scope=?) +
        (SELECT count(*) FROM ocsp_leases WHERE scope=?) +
        (SELECT count(*) FROM ocsp_backoff WHERE scope=?) AS n`).get(this.#scope, this.#scope, this.#scope).n;
      if (used >= this.#limit) fail('KIM_OCSP_CACHE_CAPACITY');
      this.#db.prepare('INSERT INTO ocsp_leases VALUES(?,?,?,?)').run(this.#scope, sha, owner, now + this.#timeout + 1000);
      return { claimed: true };
    });
  }
  #owns(sha, owner, now) {
    const row = this.#db.prepare('SELECT owner,valid_until FROM ocsp_leases WHERE scope=? AND certificate_sha=?').get(this.#scope, sha);
    if (!row || row.owner !== owner || row.valid_until <= now) fail('KIM_OCSP_LEASE_LOST');
  }
  #save(certificate, owner, request, response, evidence) {
    transaction(this.#db, () => {
      const now = this.#now(), sha = hash(certificate); this.#owns(sha, owner, now);
      if (now >= evidence.validUntil) fail('KIM_OCSP_STALE');
      const octets = request.length + response.length;
      const used = this.#db.prepare('SELECT coalesce(sum(octets),0) AS n FROM ocsp_evidence WHERE scope=?').get(this.#scope).n;
      if (used + octets > this.#bytes) fail('KIM_OCSP_CACHE_CAPACITY');
      const row = { scope: this.#scope, certificate_sha: sha, produced_at: evidence.producedAt, valid_until: evidence.producedAt + 3_600_001, octets };
      const clear = Buffer.from(JSON.stringify({ request: request.toString('base64'), response: response.toString('base64') }));
      try {
        this.#db.prepare('INSERT INTO ocsp_evidence VALUES(?,?,?,?,?,?)').run(this.#scope, sha, row.produced_at, row.valid_until, octets, this.#vault.seal(clear, rowIdentity(row)));
        this.#db.prepare('DELETE FROM ocsp_leases WHERE scope=? AND certificate_sha=? AND owner=?').run(this.#scope, sha, owner);
      } finally { clear.fill(0); }
    });
  }
  async #run(certificate, request, owner, signal) {
    const sha = hash(certificate), stopped = () => { this.#open(); if (signal.aborted) throw signal.reason; };
    try {
      while (true) {
        stopped(); const state = this.#claim(certificate, owner);
        if (state.proof) return state.proof;
        if (state.claimed) break;
        await new Promise((resolve, reject) => {
          const done = () => { signal.removeEventListener('abort', abort); resolve(); };
          const timer = setTimeout(done, 50);
          const abort = () => { clearTimeout(timer); signal.removeEventListener('abort', abort); reject(signal.reason); };
          signal.addEventListener('abort', abort, { once: true });
        });
      }
      // Only OCSP protocol-status errors are retried here: one request and three repetitions.
      // HTTP/crypto/format failures are never converted to a cached good status.
      for (let attempt = 0; attempt < 4; attempt++) {
        stopped(); const response = await this.#transport.obtain(request, signal); stopped();
        let evidence;
        try { evidence = this.#verifier.verify({ certificate, request, response }); }
        catch (e) {
          if (!(e instanceof OcspError) || e.code !== 'KIM_OCSP_RESPONDER_ERROR') throw e;
          if (attempt < 3) continue;
          transaction(this.#db, () => {
            const now = this.#now(); this.#owns(sha, owner, now);
            this.#db.prepare('INSERT INTO ocsp_backoff VALUES(?,?,?)').run(this.#scope, sha, now + 300_000);
          });
          throw e;
        }
        stopped(); this.#save(certificate, owner, request, response, evidence);
        return { ...evidence, source: 'response', request, response };
      }
    } catch (e) {
      if (signal.aborted) throw signal.reason;
      if (e instanceof OcspError) throw e; fail('KIM_OCSP_STORE_FAILURE');
    } finally {
      if (!this.#closed) {
        try { this.#db.prepare('DELETE FROM ocsp_leases WHERE scope=? AND certificate_sha=? AND owner=?').run(this.#scope, sha, owner); }
        catch { /* A lost cleanup is bounded by the persisted lease expiry; never broad-delete owners. */ }
      }
    }
  }
  async check({ certificate: input }) {
    this.#open();
    const certificate = leafBytes(input), sha = hash(certificate);
    if (this.#running.has(sha)) return copyProof(await this.#running.get(sha).promise);
    if (this.#running.size >= this.#limit) fail('KIM_OCSP_CACHE_CAPACITY');
    const request = this.#verifier.createRequest(certificate), owner = randomUUID(), controller = new AbortController();
    const timer = setTimeout(() => controller.abort(new OcspError('KIM_OCSP_TIMEOUT')), this.#timeout);
    const promise = Promise.resolve().then(() => this.#run(certificate, request, owner, controller.signal))
      .finally(() => { clearTimeout(timer); this.#running.delete(sha); });
    this.#running.set(sha, { owner, controller, promise });
    return copyProof(await promise);
  }
  close() {
    if (this.#closed) return;
    this.#closed = true; clearInterval(this.#timer);
    for (const task of this.#running.values()) task.controller.abort(new OcspError('KIM_OCSP_CACHE_CLOSED'));
    let failed = false;
    try {
      transaction(this.#db, () => {
        for (const task of this.#running.values()) this.#db.prepare('DELETE FROM ocsp_leases WHERE scope=? AND owner=?').run(this.#scope, task.owner);
      });
    } catch { failed = true; }
    try { this.#db.close(); } catch { failed = true; }
    finally { this.#vault.close(); }
    if (failed) fail('KIM_OCSP_STORE_FAILURE');
  }
}
