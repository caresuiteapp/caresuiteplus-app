import { openStore, transaction, Vault, isUuid } from '../gkv/storage.mjs';
import { TslRefreshManager } from './tsl-refresh.mjs';
import { TslError } from './tsl.mjs';
import { OcspError } from './ocsp.mjs';
import { OcspHttpTransport } from './ocsp-http.mjs';
import { DurableOcspStatusCache } from './ocsp-store.mjs';
import { KIM_CERTIFICATE_TYPES } from './certificate-policy.mjs';

const fail = code => { throw new TslError(code); };
const normalize = e => (e instanceof TslError || e instanceof OcspError) && /^KIM_(?:TSL|OCSP)_[A-Z_]{1,48}$/.test(e.code)
  ? new TslError(e.code) : new TslError('KIM_TSL_STATUS_FAILED');
function checkSignal(signal) {
  if (signal !== undefined && !(signal instanceof AbortSignal)) fail('KIM_TSL_STATUS_CONFIGURATION');
  if (signal?.aborted) fail('KIM_TSL_ABORTED');
}
function waitFor(promise, signal) {
  checkSignal(signal);
  if (!signal) return promise;
  return new Promise((resolve, reject) => {
    const abort = () => reject(new TslError('KIM_TSL_ABORTED'));
    signal.addEventListener('abort', abort, { once: true });
    promise.then(resolve, reject).finally(() => signal.removeEventListener('abort', abort));
  });
}
const listVersion = m => Object.freeze({ id: m.id, sequence: m.sequence, xmlSha256: m.xmlSha256,
  signerSha256: m.signerSha256, environment: m.environment, profile: m.profile, checkedAt: m.checkedAt, validUntil: m.validUntil });

/** TI nonQES status path for a running TSL manager. Only a selected CA's signed
 * ServiceSupplyPoint can select among preconfigured routes. No leaf AIA fallback,
 * automatic endpoint creation, TLS trust discovery, mail release or TI bootstrap.
 */
export class TslOcspStatusClient {
  #manager; #db; #vault; #key; #path; #scope; #configuration; #routes; #clock; #limits; #model;
  #caches = new Map(); #closed = false;
  constructor({ manager, environment, path, key, scopeId, routes, model = 'current', clock = Date.now,
    maxEntriesPerRoute = 256, maxBytesPerRoute = 67108864, timeoutMs = 10000 }) {
    try {
      if (!(manager instanceof TslRefreshManager) || environment !== manager.environment || !isUuid(scopeId)
        || !['current', 'nonqes-compromise'].includes(model) || typeof clock !== 'function'
        || !Array.isArray(routes) || !routes.length || routes.length > 16
        || routes.some(r => !(r?.transport instanceof OcspHttpTransport) || !isUuid(r.scopeId) || r.scopeId === scopeId)
        || new Set(routes.map(r => r.scopeId)).size !== routes.length
        || new Set(routes.map(r => r.transport.routeSha256)).size !== routes.length
        || !Number.isInteger(maxEntriesPerRoute) || maxEntriesPerRoute < 1 || maxEntriesPerRoute > 4096
        || !Number.isSafeInteger(maxBytesPerRoute) || maxBytesPerRoute < 1 || maxBytesPerRoute > 67108864
        || !Number.isInteger(timeoutMs) || timeoutMs < 50 || timeoutMs > 30000) fail('KIM_TSL_STATUS_CONFIGURATION');
      this.#manager = manager; this.#path = path; this.#scope = scopeId; this.#clock = clock; this.#model = model;
      this.#routes = routes.map(r => Object.freeze({ transport: r.transport, scopeId: r.scopeId }));
      this.#limits = { maxEntries: maxEntriesPerRoute, maxBytes: maxBytesPerRoute, timeoutMs };
      this.#configuration = Buffer.from(JSON.stringify({ version: 1, environment, profile: manager.profile, model,
        trustBindingSha256: manager.trustBindingSha256, ...this.#limits,
        routes: this.#routes.map(r => ({ scopeId: r.scopeId, routeSha256: r.transport.routeSha256 })).sort((a, b) => a.scopeId.localeCompare(b.scopeId)) }));
      this.#vault = new Vault(key); this.#key = Buffer.from(key); this.#db = openStore(path);
      this.#db.exec(`CREATE TABLE IF NOT EXISTS kim_tsl_ocsp_scopes_v1 (scope TEXT PRIMARY KEY, configuration BLOB NOT NULL) STRICT;
        CREATE TABLE IF NOT EXISTS kim_tsl_ocsp_routes_v1 (cache_scope TEXT PRIMARY KEY, owner_scope TEXT NOT NULL REFERENCES kim_tsl_ocsp_scopes_v1(scope)) STRICT;`);
      transaction(this.#db, () => {
        const row = this.#db.prepare('SELECT configuration FROM kim_tsl_ocsp_scopes_v1 WHERE scope=?').get(scopeId);
        if (row) {
          if (row.configuration.length > 8192 || !this.#vault.open(row.configuration, this.#aad()).equals(this.#configuration)) fail('KIM_TSL_STATUS_BINDING');
        } else this.#db.prepare('INSERT INTO kim_tsl_ocsp_scopes_v1 VALUES(?,?)').run(scopeId, this.#vault.seal(this.#configuration, this.#aad()));
        for (const route of this.#routes) {
          const owner = this.#db.prepare('SELECT owner_scope FROM kim_tsl_ocsp_routes_v1 WHERE cache_scope=?').get(route.scopeId);
          if (owner && owner.owner_scope !== scopeId) fail('KIM_TSL_STATUS_BINDING');
          if (!owner) this.#db.prepare('INSERT INTO kim_tsl_ocsp_routes_v1 VALUES(?,?)').run(route.scopeId, scopeId);
        }
      });
    } catch (e) {
      try { this.#db?.close(); } catch { /* Fixed diagnostic only. */ } finally { this.#vault?.close(); this.#key?.fill(0); }
      if (e instanceof TslError) throw e; fail('KIM_TSL_STATUS_CONFIGURATION');
    }
    Object.freeze(this);
  }
  #aad() { return `tsl-ocsp-scope-v1:${this.#scope}`; }
  get environment() { return this.#manager.environment; }
  #open() {
    if (this.#closed) fail('KIM_TSL_STATUS_CLOSED');
    try {
      const row = this.#db.prepare('SELECT configuration FROM kim_tsl_ocsp_scopes_v1 WHERE scope=?').get(this.#scope);
      if (!row || row.configuration.length > 8192 || !this.#vault.open(row.configuration, this.#aad()).equals(this.#configuration)) fail('KIM_TSL_STATUS_BINDING');
      for (const route of this.#routes) {
        const owner = this.#db.prepare('SELECT owner_scope FROM kim_tsl_ocsp_routes_v1 WHERE cache_scope=?').get(route.scopeId);
        if (owner?.owner_scope !== this.#scope) fail('KIM_TSL_STATUS_BINDING');
      }
    } catch (e) { if (e instanceof TslError) throw e; fail('KIM_TSL_STATUS_BINDING'); }
  }
  #plan(snapshot, certificate, purpose) {
    if (typeof purpose !== 'string' || !Object.hasOwn(KIM_CERTIFICATE_TYPES, purpose)) fail('KIM_TSL_CERT_TYPE_CONFIGURATION');
    const plan = snapshot.ocspPlanFor(certificate, { model: this.#model, policyList: KIM_CERTIFICATE_TYPES[purpose] });
    const matches = this.#routes.filter(r => plan.supplyPoints.some(url => r.transport.matchesEndpoint(url)));
    if (matches.length !== 1) fail('KIM_TSL_STATUS_ROUTE');
    return { plan, route: matches[0] };
  }
  #cache(route, verifier) {
    let cache = this.#caches.get(route.scopeId);
    if (!cache) {
      cache = new DurableOcspStatusCache({ path: this.#path, key: this.#key, scopeId: route.scopeId, verifier,
        transport: route.transport, clock: this.#clock, ...this.#limits });
      this.#caches.set(route.scopeId, cache);
    }
    return cache;
  }
  async #obtain(snapshot, { plan, route }, signal) {
    this.#open(); checkSignal(signal); snapshot.metadata;
    const proof = await waitFor(this.#cache(route, plan.verifier).check({ certificate: plan.certificate,
      verifier: plan.verifier, refreshUntrustedResponder: true }), signal);
    this.#open(); checkSignal(signal);
    const tsl = listVersion(snapshot.metadata), evidence = plan.verifier.verify({ certificate: plan.certificate, request: proof.request, response: proof.response });
    return Object.freeze({ ...evidence, certificateTypeOid: plan.certificateTypeOid, admission: plan.admission,
      trustSource: 'configured-tsl-anchors', source: proof.source, tsl,
      routeSha256: route.transport.routeSha256, request: Buffer.from(proof.request), response: Buffer.from(proof.response), verifier: plan.verifier });
  }
  async check({ certificate, purpose, signal }) {
    try {
      this.#open(); checkSignal(signal);
      const snapshot = this.#manager.current(), selected = this.#plan(snapshot, certificate, purpose);
      return await this.#obtain(snapshot, selected, signal);
    } catch (e) { throw normalize(e); }
  }
  /** Both roles use the same guarded snapshot. Network failures remain unavailable
   * per role; no caller-provided good flags are consumed by the receive verifier.
   */
  async messageEvidence({ signingCertificate, authenticationCertificate, signal }) {
    try {
      this.#open(); checkSignal(signal);
      const snapshot = this.#manager.current(), inputs = [signingCertificate, authenticationCertificate];
      const selected = inputs.map((c, i) => this.#plan(snapshot, c, i === 0 ? 'signing' : 'authentication')); // Both types/Admissions/routes resolve before I/O.
      const verifier = snapshot.ocspVerifierFor(selected.map(s => s.plan.certificate), { model: this.#model });
      const results = await Promise.allSettled(selected.map(s => this.#obtain(snapshot, s, signal)));
      this.#open(); checkSignal(signal); const tsl = listVersion(snapshot.metadata), failures = [];
      const proofs = results.map((r, i) => {
        if (r.status === 'rejected') { failures.push(Object.freeze({ purpose: i === 0 ? 'signing' : 'authentication', code: normalize(r.reason).code })); return undefined; }
        verifier.verify({ certificate: selected[i].plan.certificate, request: r.value.request, response: r.value.response });
        return r.value;
      });
      const certificateTypes = Object.freeze({ signing: selected[0].plan.certificateTypeOid, authentication: selected[1].plan.certificateTypeOid });
      const certificateAdmissions = Object.freeze({ signing: selected[0].plan.admission, authentication: selected[1].plan.admission });
      return Object.freeze({ verifier, signing: proofs[0], authentication: proofs[1], certificateTypes, certificateAdmissions, failures: Object.freeze(failures), tsl });
    } catch (e) { throw normalize(e); }
  }
  close() {
    if (this.#closed) return;
    this.#closed = true; let failed = false;
    for (const cache of this.#caches.values()) { try { cache.close(); } catch { failed = true; } }
    this.#caches.clear();
    try { this.#db.close(); } catch { failed = true; } finally { this.#vault.close(); this.#key.fill(0); }
    if (failed) fail('KIM_TSL_STATUS_FAILED');
  }
}
