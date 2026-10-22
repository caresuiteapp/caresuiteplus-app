import tls from 'node:tls';
import { isIP } from 'node:net';
import { createHash, X509Certificate } from 'node:crypto';
import { kimAddress, hostName } from './address.mjs';
import { VzdError, vzdFail, MAX_VZD_RESPONSE, vzdBindRequest, vzdSearchRequest,
  vzdFrameSize, readVzdResponse, readVzdEntry } from './vzd-ldap.mjs';

const hash = bytes => createHash('sha256').update(bytes).digest('hex');

/** Fixed LDAPS peer with explicit CA, hostname verification and certificate pin.
 * This authenticates the configured directory, not a TI VZD service role or its
 * TUC_PKI_018 status. No public-root fallback, discovery, referrals or TOFU.
 */
export class VzdLdapsDirectory {
  #options; #pin; #route; #environment; #timeout; #clock; #inflight = 0;
  constructor({ url, ca, serverSha256, environment, connectAddress, timeoutMs = 10000, clock = Date.now }) {
    try {
      if (typeof url !== 'string' || url.length > 1024 || /[^\x21-\x7e]/.test(url)
        || !['test', 'reference', 'production'].includes(environment) || typeof clock !== 'function'
        || !Number.isInteger(timeoutMs) || timeoutMs < 50 || timeoutMs > 30000
        || typeof ca !== 'string' || !ca.length || ca.length > 262144 || !/^[a-f0-9]{64}$/.test(serverSha256)
        || (connectAddress !== undefined && !isIP(connectAddress))) vzdFail('CONFIGURATION');
      const u = new URL(url);
      if (u.protocol !== 'ldaps:' || !hostName(u.hostname) || u.username || u.password
        || (u.pathname && u.pathname !== '/') || u.search || u.hash || (u.port && (+u.port < 1 || +u.port > 65535))) vzdFail('CONFIGURATION');
      // Reject malformed explicit trust material before DNS or socket creation.
      const roots = ca.match(/-----BEGIN CERTIFICATE-----[A-Za-z0-9+/=\r\n]+-----END CERTIFICATE-----/g);
      if (!roots?.length || ca.replace(/-----BEGIN CERTIFICATE-----[A-Za-z0-9+/=\r\n]+-----END CERTIFICATE-----/g, '').trim()
        || roots.some(c => !new X509Certificate(c).ca)) vzdFail('CONFIGURATION');
      this.#options = { host: connectAddress ?? u.hostname, port: +(u.port || 636), servername: u.hostname,
        ca, rejectUnauthorized: true, minVersion: 'TLSv1.2' };
      this.#pin = serverSha256; this.#environment = environment; this.#timeout = timeoutMs; this.#clock = clock;
      this.#route = hash(Buffer.from(JSON.stringify({ url: `ldaps://${u.hostname}:${this.#options.port}`,
        connectAddress: connectAddress ?? null, caSha256: hash(Buffer.from(ca)), serverSha256, environment })));
    } catch { vzdFail('CONFIGURATION'); }
    Object.freeze(this);
  }
  get environment() { return this.#environment; }
  get routeSha256() { return this.#route; }
  async lookup(address, { signal } = {}) {
    try { address = kimAddress(address); } catch { vzdFail('ADDRESS'); }
    if ((this.#environment === 'production') === address.endsWith('.telematik-test')) vzdFail('ENVIRONMENT');
    if (signal !== undefined && !(signal instanceof AbortSignal)) vzdFail('CONFIGURATION');
    if (signal?.aborted) vzdFail('ABORTED');
    if (this.#inflight >= 8) vzdFail('BUSY');
    this.#inflight++;
    try { return await this.#search(address, signal); } finally { this.#inflight--; }
  }
  #search(address, signal) {
    return new Promise((resolve, reject) => {
      let socket, done = false, bound = false, used = 0, consumed = 0, entry;
      const buffer = Buffer.alloc(MAX_VZD_RESPONSE);
      const finish = (code, result) => {
        if (done) return; done = true; clearTimeout(timer); signal?.removeEventListener('abort', abort);
        socket?.destroy(); buffer.fill(0);
        if (code) reject(new VzdError(code)); else resolve(result);
      };
      const abort = () => finish('KIM_VZD_ABORTED');
      const timer = setTimeout(() => finish('KIM_VZD_TIMEOUT'), this.#timeout);
      signal?.addEventListener('abort', abort, { once: true });
      try {
        socket = tls.connect(this.#options, () => {
          if (done) return;
          const peer = socket.getPeerCertificate();
          if (!socket.authorized || !peer.raw || hash(peer.raw) !== this.#pin) return finish('KIM_VZD_TLS_PEER');
          socket.write(vzdBindRequest());
        });
        socket.on('error', () => finish('KIM_VZD_CONNECTION'));
        socket.on('close', () => finish('KIM_VZD_INCOMPLETE'));
        socket.on('data', chunk => {
          if (done) return;
          try {
            if (used + chunk.length > buffer.length) vzdFail('RESPONSE_SIZE');
            chunk.copy(buffer, used); used += chunk.length;
            while (consumed < used) {
              const bytes = buffer.subarray(consumed, used), size = vzdFrameSize(bytes);
              if (size === undefined) return;
              const response = readVzdResponse(bytes.subarray(0, size), bound ? 2 : 1); consumed += size;
              if (!bound) {
                if (response.kind !== 'bound' || consumed !== used) vzdFail('LDAP_MESSAGE');
                bound = true; socket.write(vzdSearchRequest(address, Math.ceil(this.#timeout / 1000))); continue;
              }
              if (response.kind === 'entry') {
                if (entry) vzdFail('AMBIGUOUS');
                // Copy the parsed record out of the stream buffer before zeroing.
                entry = readVzdEntry(response.attributes, address);
              } else if (response.kind === 'done') {
                if (consumed !== used) vzdFail('LDAP_MESSAGE');
                if (!entry) vzdFail('NOT_FOUND');
                const now = this.#clock();
                if (!Number.isSafeInteger(now) || now < 0) vzdFail('CONFIGURATION');
                finish(undefined, Object.freeze({ ...entry, environment: this.#environment, checkedAt: now,
                  routeSha256: this.#route, serverSha256: this.#pin, trustSource: 'configured-ldaps-peer', identityStatus: 'unverified' }));
              } else vzdFail('LDAP_MESSAGE');
            }
          } catch (e) { finish(e instanceof VzdError ? e.code : 'KIM_VZD_LDAP_FORMAT'); }
        });
      } catch { finish('KIM_VZD_CONNECTION'); }
    });
  }
}

// Calling the prototype method requires the class's private slots and prevents
// an object/subclass lookup override from supplying a fabricated trusted record.
export const lookupVzd = (directory, address, signal) => VzdLdapsDirectory.prototype.lookup.call(directory, address, { signal });
