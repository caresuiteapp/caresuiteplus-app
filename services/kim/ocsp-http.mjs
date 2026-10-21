import http from 'node:http';
import https from 'node:https';
import { isIP } from 'node:net';
import { createHash } from 'node:crypto';
import { OcspError } from './ocsp.mjs';

const MAX_RESPONSE = 262_144;
const fail = code => { throw new OcspError(code); };
const hash = b => createHash('sha256').update(b).digest('hex');

/** One fixed, server-configured endpoint. No AIA lookup, redirects, credentials, cookies,
 * client certificates, proxy environment or HTTP-cache trust. HTTPS authenticates the
 * transport; only PinnedOcspVerifier can validate the returned OCSP evidence.
 */
export class OcspHttpTransport {
  #url; #options; #timeout; #binding;
  constructor({ url, allowHttp = false, connectAddress, ca, timeoutMs = 10_000 }) {
    try {
      if (typeof url !== 'string' || url.length > 2048 || /[^\x21-\x7e]/.test(url) || typeof allowHttp !== 'boolean'
        || !Number.isInteger(timeoutMs) || timeoutMs < 50 || timeoutMs > 30_000) fail('KIM_OCSP_HTTP_CONFIGURATION');
      const u = new URL(url), hostname = u.hostname.replace(/^\[|\]$/g, '');
      if (!['https:', 'http:'].includes(u.protocol) || (u.protocol === 'http:' && !allowHttp) || u.username || u.password
        || u.hash || !hostname || hostname.length > 253 || (connectAddress !== undefined && !isIP(connectAddress))
        || (connectAddress !== undefined && isIP(hostname) && connectAddress !== hostname)
        || (ca !== undefined && (u.protocol !== 'https:' || typeof ca !== 'string' || !ca.length || ca.length > 262_144))) fail('KIM_OCSP_HTTP_CONFIGURATION');
      this.#url = u.href; this.#timeout = timeoutMs;
      this.#options = { agent: false, method: 'POST', maxHeaderSize: 16_384, insecureHTTPParser: false,
        ...(u.protocol === 'https:' ? { rejectUnauthorized: true, minVersion: 'TLSv1.2', ...(ca ? { ca } : {}) } : {}) };
      if (connectAddress) this.#options.lookup = (_hostname, options, callback) => {
        const entry = { address: connectAddress, family: isIP(connectAddress) };
        callback(null, options.all ? [entry] : entry.address, ...(options.all ? [] : [entry.family]));
      };
      // Bind persistent namespaces to the route, including explicit address/TLS trust. No URL is logged.
      this.#binding = hash(Buffer.from(JSON.stringify({ url: u.href, connectAddress: connectAddress ?? null,
        caSha256: ca ? hash(Buffer.from(ca)) : null, tls: u.protocol === 'https:' ? 'verified-min-1.2' : 'explicit-http' })));
    } catch { fail('KIM_OCSP_HTTP_CONFIGURATION'); }
  }
  get routeSha256() { return this.#binding; }
  async obtain(input, signal) {
    if (!(input instanceof Uint8Array) || !input.length || input.length > 4096) fail('KIM_OCSP_REQUEST_SIZE');
    if (signal !== undefined && !(signal instanceof AbortSignal)) fail('KIM_OCSP_HTTP_CONFIGURATION');
    if (signal?.aborted) fail('KIM_OCSP_ABORTED');
    const bytes = Buffer.from(input);
    return new Promise((resolve, reject) => {
      let request, response, done = false, size = 0, expected;
      const chunks = [];
      const finish = (code, result) => {
        if (done) return; done = true; clearTimeout(timer); signal?.removeEventListener('abort', aborted);
        response?.destroy(); request?.destroy();
        if (code) reject(new OcspError(code)); else resolve(result);
      };
      const aborted = () => finish('KIM_OCSP_ABORTED');
      const timer = setTimeout(() => finish('KIM_OCSP_HTTP_TIMEOUT'), this.#timeout);
      signal?.addEventListener('abort', aborted, { once: true });
      try {
        const client = this.#url.startsWith('https:') ? https : http;
        request = client.request(this.#url, { ...this.#options, headers: {
          'Content-Type': 'application/ocsp-request', Accept: 'application/ocsp-response',
          'Accept-Encoding': 'identity', 'Content-Length': bytes.length,
        } }, incoming => {
          response = incoming;
          incoming.on('error', () => finish('KIM_OCSP_HTTP_CONNECTION'));
          incoming.on('aborted', () => finish('KIM_OCSP_HTTP_INCOMPLETE'));
          if (done) { incoming.destroy(); return; }
          if (incoming.statusCode !== 200) return finish('KIM_OCSP_HTTP_STATUS');
          const counts = new Map();
          for (let i = 0; i < incoming.rawHeaders.length; i += 2) {
            const k = incoming.rawHeaders[i].toLowerCase(); counts.set(k, (counts.get(k) ?? 0) + 1);
          }
          if (['content-type', 'content-length', 'content-encoding', 'transfer-encoding'].some(k => (counts.get(k) ?? 0) > 1)
            || !/^application\/ocsp-response[ \t]*$/i.test(incoming.headers['content-type'] ?? '')
            || (incoming.headers['content-encoding'] !== undefined && incoming.headers['content-encoding'].toLowerCase() !== 'identity')) return finish('KIM_OCSP_HTTP_FORMAT');
          const length = incoming.headers['content-length'];
          if (length !== undefined) {
            if (!/^[1-9][0-9]*$/.test(length)) return finish('KIM_OCSP_HTTP_FORMAT');
            expected = Number(length);
            if (!Number.isSafeInteger(expected) || expected > MAX_RESPONSE) return finish('KIM_OCSP_RESPONSE_SIZE');
          }
          incoming.on('data', chunk => {
            size += chunk.length;
            if (size > MAX_RESPONSE) return finish('KIM_OCSP_RESPONSE_SIZE');
            chunks.push(chunk);
          });
          incoming.on('end', () => {
            if (!incoming.complete || !size || (expected !== undefined && size !== expected)) return finish('KIM_OCSP_HTTP_INCOMPLETE');
            finish(undefined, Buffer.concat(chunks, size));
          });
          incoming.on('close', () => { if (!done) finish('KIM_OCSP_HTTP_INCOMPLETE'); });
        });
        request.on('error', () => finish('KIM_OCSP_HTTP_CONNECTION'));
        request.on('upgrade', (_reply, socket) => { socket.destroy(); finish('KIM_OCSP_HTTP_FORMAT'); });
        request.end(bytes);
      } catch { finish('KIM_OCSP_HTTP_CONNECTION'); }
    });
  }
}
