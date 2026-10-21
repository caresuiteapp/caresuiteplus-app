import http from 'node:http';
import https from 'node:https';
import { isIP } from 'node:net';
import { createHash } from 'node:crypto';
import { TslError } from './tsl.mjs';

const hash = b => createHash('sha256').update(b).digest('hex');
const fail = code => { throw new TslError(code); };
const limits = { xml: 8 * 1024 * 1024, signature: 16000, hash: 66 };
const accept = { xml: 'application/vnd.etsi.tsl+xml, application/xml, text/xml', signature: 'application/octet-stream', hash: 'text/plain, application/octet-stream' };

function route(input, kind, allowHttp) {
  const { url, ca, connectAddress } = input;
  if (typeof url !== 'string' || url.length > 2048 || /[^\x21-\x7e]/.test(url)) fail('KIM_TSL_HTTP_CONFIGURATION');
  const u = new URL(url), hostname = u.hostname.replace(/^\[|\]$/g, '');
  if (!['https:', 'http:'].includes(u.protocol) || (u.protocol === 'http:' && (kind !== 'signature' || !allowHttp))
    || u.username || u.password || u.hash || u.search || !hostname || hostname.length > 253
    || (connectAddress !== undefined && !isIP(connectAddress))
    || (connectAddress !== undefined && isIP(hostname) && connectAddress !== hostname)
    || (ca !== undefined && (u.protocol !== 'https:' || typeof ca !== 'string' || !ca.length || ca.length > 262144))) fail('KIM_TSL_HTTP_CONFIGURATION');
  const options = { agent: false, method: 'GET', maxHeaderSize: 16384, insecureHTTPParser: false,
    ...(u.protocol === 'https:' ? { rejectUnauthorized: true, minVersion: 'TLSv1.2', ...(ca ? { ca } : {}) } : {}) };
  if (connectAddress) options.lookup = (_hostname, request, callback) => {
    const entry = { address: connectAddress, family: isIP(connectAddress) };
    callback(null, request.all ? [entry] : entry.address, ...(request.all ? [] : [entry.family]));
  };
  return { url: u.href, options, binding: { url: u.href, caSha256: ca ? hash(ca) : null, connectAddress: connectAddress ?? null } };
}
function mediaType(value, kind) {
  if (typeof value !== 'string') return false;
  if (kind === 'signature') return /^application\/octet-stream[ \t]*$/i.test(value);
  if (kind === 'hash') return /^(?:application\/octet-stream|text\/plain(?:\s*;\s*charset=(?:(?:utf-8|us-ascii)|"(?:utf-8|us-ascii)"))?)[ \t]*$/i.test(value);
  return /^(?:application\/vnd\.etsi\.tsl\+xml|application\/xml|text\/xml)(?:\s*;\s*charset=(?:utf-8|"utf-8"))?[ \t]*$/i.test(value);
}
function download(selected, kind, timeout, signal) {
  if (signal !== undefined && !(signal instanceof AbortSignal)) fail('KIM_TSL_HTTP_CONFIGURATION');
  if (signal?.aborted) fail('KIM_TSL_ABORTED');
  return new Promise((resolve, reject) => {
    let request, response, done = false, size = 0, expected;
    const chunks = [];
    const finish = (code, bytes) => {
      if (done) return; done = true; clearTimeout(timer); signal?.removeEventListener('abort', aborted);
      response?.destroy(); request?.destroy();
      if (code) reject(new TslError(code)); else resolve(bytes);
    };
    const aborted = () => finish('KIM_TSL_ABORTED');
    const timer = setTimeout(() => finish('KIM_TSL_HTTP_TIMEOUT'), timeout);
    signal?.addEventListener('abort', aborted, { once: true });
    try {
      const client = selected.url.startsWith('https:') ? https : http;
      request = client.request(selected.url, { ...selected.options, headers: {
        Accept: accept[kind], 'Accept-Encoding': 'identity', 'Cache-Control': 'no-cache',
      } }, incoming => {
        response = incoming;
        incoming.on('error', () => finish('KIM_TSL_HTTP_CONNECTION'));
        incoming.on('aborted', () => finish('KIM_TSL_HTTP_INCOMPLETE'));
        if (done) { incoming.destroy(); return; }
        if (incoming.statusCode !== 200) return finish('KIM_TSL_HTTP_STATUS');
        const counts = new Map();
        for (let i = 0; i < incoming.rawHeaders.length; i += 2) {
          const key = incoming.rawHeaders[i].toLowerCase(); counts.set(key, (counts.get(key) ?? 0) + 1);
        }
        if (['content-type', 'content-length', 'content-encoding', 'transfer-encoding'].some(k => (counts.get(k) ?? 0) > 1)
          || !mediaType(incoming.headers['content-type'], kind)
          || (incoming.headers['content-encoding'] !== undefined && incoming.headers['content-encoding'].toLowerCase() !== 'identity')
          || (incoming.headers['transfer-encoding'] !== undefined && incoming.headers['transfer-encoding'].toLowerCase() !== 'chunked')) return finish('KIM_TSL_HTTP_FORMAT');
        const length = incoming.headers['content-length'];
        if (length !== undefined) {
          if (!/^[1-9][0-9]*$/.test(length)) return finish('KIM_TSL_HTTP_FORMAT');
          expected = Number(length);
          if (!Number.isSafeInteger(expected) || expected > limits[kind]) return finish('KIM_TSL_HTTP_SIZE');
        }
        incoming.on('data', chunk => {
          size += chunk.length;
          if (size > limits[kind]) return finish('KIM_TSL_HTTP_SIZE');
          chunks.push(chunk);
        });
        incoming.on('end', () => {
          if (!incoming.complete || !size || (expected !== undefined && expected !== size)) return finish('KIM_TSL_HTTP_INCOMPLETE');
          finish(undefined, Buffer.concat(chunks, size));
        });
        incoming.on('close', () => { if (!done) finish('KIM_TSL_HTTP_INCOMPLETE'); });
      });
      request.on('error', () => finish('KIM_TSL_HTTP_CONNECTION'));
      request.on('upgrade', (_response, socket) => { socket.destroy(); finish('KIM_TSL_HTTP_FORMAT'); });
      request.end();
    } catch { finish('KIM_TSL_HTTP_CONNECTION'); }
  });
}

/** Fixed Internet routes only. TLS authenticates xml/hash transport; downloaded
 * material never supplies roots, redirects, backup hosts or arbitrary URLs.
 * A hash is a change hint, not a replacement for TslVerifier authentication.
 */
export class TslHttpSource {
  #routes; #timeout; #environment; #profile; #binding;
  constructor({ environment, profile = 'ecc-rsa', routes, allowHttpSignature = false, timeoutMs = 10000 }) {
    try {
      if (!['production', 'reference', 'test'].includes(environment) || !['ecc-rsa', 'rsa'].includes(profile)
        || typeof allowHttpSignature !== 'boolean' || !Number.isInteger(timeoutMs) || timeoutMs < 50 || timeoutMs > 30000
        || !routes || Object.keys(routes).sort().join(',') !== 'hash,signature,xml') fail('KIM_TSL_HTTP_CONFIGURATION');
      this.#routes = Object.fromEntries(['xml', 'signature', 'hash'].map(k => [k, route(routes[k], k, allowHttpSignature)]));
      this.#environment = environment; this.#profile = profile; this.#timeout = timeoutMs;
      this.#binding = hash(JSON.stringify({ version: 1, environment, profile,
        routes: Object.fromEntries(['xml', 'signature', 'hash'].map(k => [k, this.#routes[k].binding])) }));
    } catch { fail('KIM_TSL_HTTP_CONFIGURATION'); }
    Object.freeze(this);
  }
  get environment() { return this.#environment; }
  get profile() { return this.#profile; }
  get bindingSha256() { return this.#binding; }
  async readHash(signal) {
    const bytes = await download(this.#routes.hash, 'hash', this.#timeout, signal);
    if (bytes.length === 32) return bytes.toString('hex');
    if (bytes.some(b => b > 127) || !/^[a-fA-F0-9]{64}(?:\r?\n)?$/.test(bytes.toString('ascii'))) fail('KIM_TSL_HASH_FORMAT');
    return bytes.toString('ascii').trim().toLowerCase();
  }
  async readBundle(expectedSha256, signal) {
    if (typeof expectedSha256 !== 'string' || !/^[a-f0-9]{64}$/.test(expectedSha256) || (signal !== undefined && !(signal instanceof AbortSignal))) fail('KIM_TSL_HTTP_CONFIGURATION');
    const controller = new AbortController(), combined = signal ? AbortSignal.any([signal, controller.signal]) : controller.signal;
    try {
      const [xml, detachedSignature] = await Promise.all(['xml', 'signature'].map(k => download(this.#routes[k], k, this.#timeout, combined)));
      if (hash(xml) !== expectedSha256) fail('KIM_TSL_HASH_MISMATCH');
      return { xml, detachedSignature };
    } catch (error) { controller.abort(); throw error; }
  }
}

/** Explicit catalog selection makes no connection and provisions no trust.
 * XML/hash: gemSpec_PKI 2.28.0 §8.2.6; detached signature: gemSpec_TSL A_21182.
 * HTTP signatures need a separate opt-in; every byte is cryptographically checked.
 */
export function officialTslInternetRoutes({ environment, profile = 'ecc-rsa' }) {
  if (!['production', 'reference', 'test'].includes(environment) || !['ecc-rsa', 'rsa'].includes(profile)) fail('KIM_TSL_HTTP_CONFIGURATION');
  const suffix = environment === 'production' ? '' : environment === 'reference' ? '-ref' : '-test';
  const file = profile === 'ecc-rsa' ? `ECC-RSA_TSL${suffix}` : `TSL${suffix}`;
  const host = `https://download${suffix}.tsl.ti-dienste.de`, directory = profile === 'ecc-rsa' ? '/ECC' : '';
  const signatureHost = environment === 'production' ? 'download.crl.ti-dienste.de' : 'download-testref.crl.ti-dienste.de';
  const signatureDirectory = `TSL-${profile === 'ecc-rsa' ? 'ECC' : 'RSA'}${suffix}`;
  return Object.freeze({ environment, profile, routes: Object.freeze({
    xml: Object.freeze({ url: `${host}${directory}/${file}.xml` }),
    hash: Object.freeze({ url: `${host}${directory}/${file}.sha2` }),
    signature: Object.freeze({ url: `http://${signatureHost}/${signatureDirectory}/${file}.sig` }),
  }) });
}
