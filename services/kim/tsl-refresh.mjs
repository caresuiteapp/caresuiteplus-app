import { createHash } from 'node:crypto';
import { TslError } from './tsl.mjs';
import { TslTrustStore } from './tsl-store.mjs';
import { TslHttpSource } from './tsl-http.mjs';
import { TslSignerStatusSource } from './tsl-signer-status.mjs';
import { OcspError } from './ocsp.mjs';

const fail = code => { throw new TslError(code); };
const normalize = error => (error instanceof TslError || error instanceof OcspError) && /^KIM_(?:TSL|OCSP)_[A-Z_]{1,48}$/.test(error.code)
  ? new TslError(error.code) : new TslError('KIM_TSL_REFRESH_FAILED');
const same = (v, m) => v?.id === m.id && v?.sequence === m.sequence && v?.xmlSha256 === m.xmlSha256 && v?.signerSha256 === m.signerSha256;

/** Explicitly started, host-owned refresh loop. No server is opened, no trust is
 * provisioned and no KIM mail is released by constructing this manager.
 * A failed refresh invalidates its handles while retaining the durable high-water
 * mark. Shared-volume version checks also invalidate handles in other managers.
 */
export class TslRefreshManager {
  #source; #statusSource; #store; #clock; #interval; #retry; #timeout; #lastNow = -1;
  #pending; #controller; #timer; #started = false; #closed = false; #generation = 0; #active;
  #state = 'idle'; #lastSuccessAt; #lastError; #nextAttemptAt;
  constructor({ source, signerStatusSource, store, clock = Date.now, intervalMs = 900000, retryMs = 300000, timeoutMs = 30000 }) {
    if (!(source instanceof TslHttpSource) || !(signerStatusSource instanceof TslSignerStatusSource) || !(store instanceof TslTrustStore)
      || typeof clock !== 'function' || !Number.isInteger(intervalMs) || intervalMs < 60000 || intervalMs > 86400000
      || !Number.isInteger(retryMs) || retryMs < 60000 || retryMs > intervalMs
      || !Number.isInteger(timeoutMs) || timeoutMs < 50 || timeoutMs > 60000
      || source.environment !== store.verifier.environment || source.profile !== store.verifier.profile) fail('KIM_TSL_REFRESH_CONFIGURATION');
    this.#source = source; this.#statusSource = signerStatusSource; this.#store = store; this.#clock = clock;
    this.#interval = intervalMs; this.#retry = retryMs; this.#timeout = timeoutMs;
    this.#now();
    store.bindSource(createHash('sha256').update(JSON.stringify(['tsl-refresh-v1', source.bindingSha256, signerStatusSource.bindingSha256])).digest('hex'));
    Object.freeze(this);
  }
  get environment() { return this.#source.environment; }
  get profile() { return this.#source.profile; }
  get trustBindingSha256() { return this.#store.verifier.bindingSha256; }
  #now() {
    let now; try { now = this.#clock(); } catch { fail('KIM_TSL_CLOCK'); }
    if (!Number.isSafeInteger(now) || now < 0 || now < this.#lastNow) fail('KIM_TSL_CLOCK');
    this.#lastNow = now; return now;
  }
  #invalidate(code) {
    this.#generation++; this.#active = undefined; this.#lastError = code;
    if (!this.#closed) this.#state = 'unavailable';
  }
  #assertCurrent(generation, metadata) {
    if (this.#closed) fail('KIM_TSL_REFRESH_CLOSED');
    if (generation !== this.#generation || !this.#active) fail('KIM_TSL_SUPERSEDED');
    try {
      const now = this.#now();
      if (now < metadata.checkedAt || now >= metadata.validUntil) fail('KIM_TSL_SNAPSHOT_EXPIRED');
      if (!same(this.#store.currentVersion(), metadata)) fail('KIM_TSL_SUPERSEDED');
    } catch (error) { const e = normalize(error); this.#invalidate(e.code); throw e; }
  }
  #handle(snapshot) {
    const generation = ++this.#generation, metadata = snapshot.metadata;
    const assert = () => this.#assertCurrent(generation, metadata);
    const isCurrent = () => { try { assert(); return true; } catch { return false; } };
    // Never return the raw snapshot: an already issued verifier must check the
    // same manager generation AND current authenticated durable version on use.
    return Object.freeze({
      get metadata() { assert(); return metadata; },
      get services() { assert(); return snapshot.services; },
      ocspVerifierFor: (input, { model = 'current' } = {}) => {
        assert(); return snapshot.ocspVerifierFor(input, { model, isCurrent });
      },
      ocspPlanFor: (input, { model = 'current' } = {}) => {
        assert(); return snapshot.ocspPlanFor(input, { model, isCurrent });
      },
    });
  }
  get status() {
    if (this.#active) { try { this.current(); } catch { /* Report unavailability below. */ } }
    return Object.freeze({ state: this.#state, lastSuccessAt: this.#lastSuccessAt, lastError: this.#lastError,
      nextAttemptAt: this.#nextAttemptAt, updating: Boolean(this.#pending), started: this.#started });
  }
  current() {
    if (this.#closed) fail('KIM_TSL_REFRESH_CLOSED');
    if (!this.#active) fail('KIM_TSL_UNAVAILABLE');
    // Getter performs expiry, generation and checkpoint authentication.
    this.#active.metadata;
    return this.#active;
  }
  async #update(signal) {
    this.#now();
    const candidate = this.#store.candidate();
    const expected = await this.#source.readHash(signal);
    // A_30044: a hash failure NEVER falls back to XML; same hash NEVER triggers
    // a re-download, even when the cached list or its status proof has expired.
    const originals = candidate?.xmlSha256 === expected ? candidate : await this.#source.readBundle(expected, signal);
    if (signal.aborted) fail('KIM_TSL_ABORTED');
    const prepared = this.#store.verifier.prepareSignerStatus(originals);
    const signerStatus = await this.#statusSource.obtain(prepared, signal);
    if (signal.aborted) fail('KIM_TSL_ABORTED');
    const { snapshot, changed } = await this.#store.activate({ ...originals, signerStatus }, { signal });
    if (signal.aborted) fail('KIM_TSL_ABORTED');
    const now = this.#now();
    if (now < snapshot.metadata.checkedAt || now >= snapshot.metadata.validUntil) fail('KIM_TSL_SNAPSHOT_EXPIRED');
    if (!same(this.#store.currentVersion(), snapshot.metadata)) fail('KIM_TSL_SUPERSEDED');
    this.#active = this.#handle(snapshot); this.#lastSuccessAt = now; this.#lastError = undefined; this.#state = 'ready';
    return Object.freeze({ snapshot: this.#active, changed, downloaded: candidate?.xmlSha256 !== expected });
  }
  refresh() {
    if (this.#closed) return Promise.reject(new TslError('KIM_TSL_REFRESH_CLOSED'));
    if (this.#pending) return this.#pending;
    clearTimeout(this.#timer); this.#nextAttemptAt = undefined; this.#state = 'refreshing';
    const controller = new AbortController(); this.#controller = controller;
    let expired = false;
    const deadline = setTimeout(() => { expired = true; controller.abort(); }, this.#timeout);
    this.#pending = this.#update(controller.signal).catch(error => {
      const e = expired ? new TslError('KIM_TSL_REFRESH_TIMEOUT') : normalize(error);
      this.#invalidate(e.code); throw e;
    }).finally(() => {
      clearTimeout(deadline); this.#pending = undefined; this.#controller = undefined;
      this.#schedule();
    });
    return this.#pending;
  }
  #schedule() {
    if (!this.#started || this.#closed) return;
    try {
      const now = this.#now(), until = this.#active?.metadata.validUntil;
      const delay = until === undefined ? this.#retry : Math.max(1, Math.min(this.#interval, until - now));
      this.#nextAttemptAt = now + delay;
      this.#timer = setTimeout(() => { this.refresh().catch(() => {}); }, delay); this.#timer.unref();
    } catch (error) {
      this.#invalidate(normalize(error).code);
      this.#nextAttemptAt = undefined;
      this.#timer = setTimeout(() => { this.refresh().catch(() => {}); }, this.#retry); this.#timer.unref();
    }
  }
  start() {
    if (this.#closed) return Promise.reject(new TslError('KIM_TSL_REFRESH_CLOSED'));
    this.#started = true; const result = this.refresh();
    // Hosts may await the first attempt; background failures remain observable
    // through status and never create unhandled rejection events.
    result.catch(() => {}); return result;
  }
  close() {
    if (this.#closed) return;
    this.#closed = true; this.#started = false; clearTimeout(this.#timer); this.#nextAttemptAt = undefined;
    this.#invalidate('KIM_TSL_REFRESH_CLOSED'); this.#state = 'closed'; this.#controller?.abort();
  }
}
