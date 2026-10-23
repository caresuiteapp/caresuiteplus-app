import { createHash } from 'node:crypto';
import { DurableOcspStatusCache } from './ocsp-store.mjs';
import { TslError } from './tsl.mjs';

const fail = code => { throw new TslError(code); };
/** Operator-provisioned routes only. The refresh manager supplies AIA extracted
 * AFTER original-byte signature and signer-chain authentication. No discovery.
 */
export class TslSignerStatusSource {
  #caches; #binding;
  constructor({ caches }) {
    if (!Array.isArray(caches) || !caches.length || caches.length > 8 || caches.some(c => !(c instanceof DurableOcspStatusCache))) fail('KIM_TSL_STATUS_CONFIGURATION');
    const routes = caches.map(c => c.routeSha256).sort();
    if (new Set(routes).size !== routes.length) fail('KIM_TSL_STATUS_CONFIGURATION');
    this.#caches = [...caches];
    this.#binding = createHash('sha256').update(JSON.stringify(['tsl-signer-status-v1', routes])).digest('hex');
    Object.freeze(this);
  }
  get bindingSha256() { return this.#binding; }
  async obtain(prepared, signal) {
    if (signal !== undefined && !(signal instanceof AbortSignal)) fail('KIM_TSL_STATUS_CONFIGURATION');
    if (signal?.aborted) fail('KIM_TSL_ABORTED');
    if (!Array.isArray(prepared?.ocspUrls) || prepared.ocspUrls.length !== 1) fail('KIM_TSL_SIGNER_AIA');
    const matches = this.#caches.filter(c => c.matchesEndpoint(prepared.ocspUrls[0]));
    if (matches.length !== 1) fail('KIM_TSL_SIGNER_ROUTE');
    // Cancellation stops this refresh, not a cache owned/shared by the host.
    // The cache retains its own bounded transport, claims and retry deadlines.
    return new Promise((resolve, reject) => {
      const aborted = () => reject(new TslError('KIM_TSL_ABORTED'));
      signal?.addEventListener('abort', aborted, { once: true });
      matches[0].check({ certificate: prepared.certificate }).then(resolve, reject)
        .finally(() => signal?.removeEventListener('abort', aborted));
    });
  }
}
