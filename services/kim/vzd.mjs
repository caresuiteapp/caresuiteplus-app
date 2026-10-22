import tls from 'node:tls';
import { isIP } from 'node:net';
import { createHash, X509Certificate } from 'node:crypto';
import { kimAddress, hostName } from './address.mjs';
import { TslOcspStatusClient } from './tsl-ocsp.mjs';
import { VzdError, vzdFail, MAX_VZD_RESPONSE, vzdBindRequest, vzdSearchRequest,
  vzdFrameSize, readVzdResponse, readVzdEntry } from './vzd-ldap.mjs';

const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const validations = new WeakMap();
const curves = new Set(['prime256v1', 'secp256r1', 'P-256', 'secp384r1', 'P-384', 'brainpoolP256r1', 'brainpoolP384r1']);
const ciphers = ['TLS_AES_128_GCM_SHA256', 'TLS_AES_256_GCM_SHA384', 'ECDHE-ECDSA-AES128-GCM-SHA256',
  'ECDHE-ECDSA-AES256-GCM-SHA384', 'ECDHE-RSA-AES128-GCM-SHA256', 'ECDHE-RSA-AES256-GCM-SHA384'];
const errorCode = e => /^KIM_(?:TSL|OCSP|VZD)_[A-Z_]{1,64}$/.test(e?.code ?? '') ? e.code : 'KIM_VZD_SERVER_VALIDATION';

/** Fixed LDAPS peer with explicit CA, hostname verification and certificate pin.
 * Higher-level sender/recipient paths always supply a serverStatusClient. The
 * low-level pin-only lookup remains an explicitly unverified protocol operation.
 * No public-root fallback, discovery, referrals, TOFU or LDAP before validation.
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
        ca, rejectUnauthorized: true, minVersion: 'TLSv1.2', maxVersion: 'TLSv1.3', ciphers: ciphers.join(':'),
        ecdhCurve: 'prime256v1:secp384r1:brainpoolP256r1:brainpoolP384r1' };
      this.#pin = serverSha256; this.#environment = environment; this.#timeout = timeoutMs; this.#clock = clock;
      this.#route = hash(Buffer.from(JSON.stringify({ url: `ldaps://${u.hostname}:${this.#options.port}`,
        connectAddress: connectAddress ?? null, caSha256: hash(Buffer.from(ca)), serverSha256, environment })));
    } catch { vzdFail('CONFIGURATION'); }
    Object.freeze(this);
  }
  get environment() { return this.#environment; }
  get routeSha256() { return this.#route; }
  async lookup(address, { signal, serverStatusClient } = {}) {
    try { address = kimAddress(address); } catch { vzdFail('ADDRESS'); }
    if ((this.#environment === 'production') === address.endsWith('.telematik-test')) vzdFail('ENVIRONMENT');
    if (signal !== undefined && !(signal instanceof AbortSignal)) vzdFail('CONFIGURATION');
    if (serverStatusClient !== undefined && (!(serverStatusClient instanceof TslOcspStatusClient)
      || serverStatusClient.environment !== this.#environment)) vzdFail('CONFIGURATION');
    if (signal?.aborted) vzdFail('ABORTED');
    if (this.#inflight >= 8) vzdFail('BUSY');
    this.#inflight++;
    try { return await this.#search(address, signal, serverStatusClient); } finally { this.#inflight--; }
  }
  #search(address, signal, serverStatusClient) {
    return new Promise((resolve, reject) => {
      let socket, done = false, ready = false, bound = false, used = 0, consumed = 0, entry, revalidate, serverEvidence;
      const stop = new AbortController();
      const buffer = Buffer.alloc(MAX_VZD_RESPONSE);
      const finish = (code, result) => {
        if (done) return; done = true; clearTimeout(timer); signal?.removeEventListener('abort', abort);
        stop.abort(); socket?.destroy(); buffer.fill(0);
        if (code) reject(new VzdError(code)); else resolve(result);
      };
      const abort = () => finish('KIM_VZD_ABORTED');
      const timer = setTimeout(() => finish('KIM_VZD_TIMEOUT'), this.#timeout);
      signal?.addEventListener('abort', abort, { once: true });
      try {
        socket = tls.connect(this.#options, async () => {
          try {
            if (done) return;
            const peer = socket.getPeerCertificate(), group = socket.getEphemeralKeyInfo();
            if (!socket.authorized || !peer.raw || hash(peer.raw) !== this.#pin) return finish('KIM_VZD_TLS_PEER');
            if (!curves.has(group?.name) || group?.type !== 'ECDH' || !ciphers.includes(socket.getCipher()?.name)) return finish('KIM_VZD_TLS_PARAMETERS');
            if (serverStatusClient !== undefined) {
              const certificate = Buffer.from(peer.raw);
              const proof = await TslOcspStatusClient.prototype.check.call(serverStatusClient,
                { certificate, purpose: 'directory-server', signal: stop.signal });
              if (done) return;
              if (proof.certificateSha256 !== this.#pin || proof.certificateTypeOid !== '1.2.276.0.76.4.157'
                || proof.admission.professionOid !== '1.2.276.0.76.4.171' || proof.status !== 'good') vzdFail('SERVER_STATUS');
              revalidate = () => {
                if (proof.verifier.verify({ certificate, request: proof.request, response: proof.response }).status !== 'good') vzdFail('SERVER_STATUS');
              };
              revalidate();
              serverEvidence = Object.freeze({ state: 'checked', certificateSha256: proof.certificateSha256,
                certificateTypeOid: proof.certificateTypeOid, admission: proof.admission, serverProfile: proof.serverProfile,
                status: proof.status, source: proof.source, checkedAt: proof.checkedAt, validUntil: proof.validUntil,
                tsl: proof.tsl, trustSource: proof.trustSource });
            }
            ready = true; socket.write(vzdBindRequest());
          } catch (e) { finish(errorCode(e)); }
        });
        socket.disableRenegotiation();
        socket.on('error', () => finish('KIM_VZD_CONNECTION'));
        socket.on('close', () => finish('KIM_VZD_INCOMPLETE'));
        socket.on('data', chunk => {
          if (done) return;
          try {
            if (!ready) vzdFail('LDAP_BEFORE_VALIDATION');
            if (used + chunk.length > buffer.length) vzdFail('RESPONSE_SIZE');
            chunk.copy(buffer, used); used += chunk.length;
            while (consumed < used) {
              const bytes = buffer.subarray(consumed, used), size = vzdFrameSize(bytes);
              if (size === undefined) return;
              const response = readVzdResponse(bytes.subarray(0, size), bound ? 2 : 1); consumed += size;
              if (!bound) {
                if (response.kind !== 'bound' || consumed !== used) vzdFail('LDAP_MESSAGE');
                revalidate?.();
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
                revalidate?.();
                const result = Object.freeze({ ...entry, environment: this.#environment, checkedAt: now,
                  routeSha256: this.#route, serverSha256: this.#pin, trustSource: 'configured-ldaps-peer', identityStatus: 'unverified',
                  serverEvidence: serverEvidence ?? Object.freeze({ state: 'not-checked' }) });
                if (revalidate) validations.set(result, revalidate);
                finish(undefined, result);
              } else vzdFail('LDAP_MESSAGE');
            }
          } catch (e) { finish(e instanceof VzdError ? e.code : errorCode(e)); }
        });
      } catch { finish('KIM_VZD_CONNECTION'); }
    });
  }
}

// Calling the prototype method requires the class's private slots and prevents
// an object/subclass lookup override from supplying a fabricated trusted record.
export const lookupVzd = (directory, address, signal, serverStatusClient) => VzdLdapsDirectory.prototype.lookup.call(directory, address, { signal, serverStatusClient });
export function revalidateVzdRecord(record) {
  const verify = validations.get(record);
  if (!verify) vzdFail('SERVER_VALIDATION_REQUIRED');
  verify();
}
