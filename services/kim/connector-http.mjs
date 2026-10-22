import https from 'node:https';
import { createSecureContext, checkServerIdentity } from 'node:tls';
import { isIP } from 'node:net';
import { createHash, X509Certificate } from 'node:crypto';
import { CERTIFICATE_SERVICE, EVENT_SERVICE, CARD_SERVICE, PIN_OPERATIONS, connectorService } from './connector-xml.mjs';
import { KonnektorError, connectorFail, connectorSignal } from './connector-error.mjs';

const hash = b => createHash('sha256').update(b).digest('hex');
/** Fixed, provisioned HTTPS/mTLS route. Peer verification precedes SOAP data.
 * No discovery, redirect, proxy environment, system-root fallback or Basic auth.
 */
export class KonnektorHttpsTransport {
  #url; #options; #binding; #namespace; #closed = false; #pending = new Set();
  constructor({ url, ca, serverSha256, clientCertificate, clientKey, clientPassphrase, connectAddress, service = 'certificate' }) {
    let key;
    try {
      if (!['certificate', 'event', 'card'].includes(service) || typeof url !== 'string' || url.length > 2048 || /[^\x21-\x7e]/.test(url)
        || typeof ca !== 'string' || !ca.length || ca.length > 262144 || !/^[a-f0-9]{64}$/.test(serverSha256 ?? '')
        || !(typeof clientCertificate === 'string' || clientCertificate instanceof Uint8Array)
        || !(typeof clientKey === 'string' || clientKey instanceof Uint8Array)) connectorFail('CONFIGURATION');
      const u = new URL(url), host = u.hostname.replace(/^\[|\]$/g, '');
      if (u.protocol !== 'https:' || u.username || u.password || u.hash || u.search || !host || host.length > 253
        || (connectAddress !== undefined && !isIP(connectAddress)) || (connectAddress && isIP(host) && connectAddress !== host)) connectorFail('CONFIGURATION');
      const cert = Buffer.from(clientCertificate); key = Buffer.from(clientKey);
      if (!cert.length || cert.length > 20000 || !key.length || key.length > 32000
        || (clientPassphrase !== undefined && (typeof clientPassphrase !== 'string' || clientPassphrase.length > 1024))) connectorFail('CONFIGURATION');
      const client = new X509Certificate(cert);
      if (client.ca) connectorFail('CONFIGURATION');
      const secureContext = createSecureContext({ ca, cert, key, passphrase: clientPassphrase, minVersion: 'TLSv1.2' });
      this.#url = u.href;
      this.#namespace = service === 'event' ? EVENT_SERVICE : service === 'card' ? CARD_SERVICE : CERTIFICATE_SERVICE;
      this.#options = { method: 'POST', agent: false, maxHeaderSize: 16384, insecureHTTPParser: false,
        rejectUnauthorized: true, minVersion: 'TLSv1.2', secureContext,
        checkServerIdentity: (hostname, peer) => {
          const error = checkServerIdentity(hostname, peer);
          if (error || !peer.raw || hash(peer.raw) !== serverSha256) return new KonnektorError('KIM_CONNECTOR_TLS_PEER');
        } };
      if (connectAddress) this.#options.lookup = (_hostname, options, callback) => {
        const entry = { address: connectAddress, family: isIP(connectAddress) };
        callback(null, options.all ? [entry] : entry.address, ...(options.all ? [] : [entry.family]));
      };
      this.#binding = hash(Buffer.from(JSON.stringify({ url: u.href, ca: hash(Buffer.from(ca)), serverSha256,
        clientSha256: hash(client.raw), connectAddress: connectAddress ?? null, service, profile: 'https-mtls-min-1.2' })));
    } catch { connectorFail('CONFIGURATION'); }
    finally { key?.fill(0); }
    Object.freeze(this);
  }
  get routeSha256() { return this.#binding; }
  async request(operation, input, { signal, timeoutMs = 10000 } = {}) {
    connectorSignal(signal);
    if (this.#closed) connectorFail('CLOSED');
    if (connectorService(operation) !== this.#namespace || !(input instanceof Uint8Array)
      || !input.length || input.length > 65536 || !Number.isInteger(timeoutMs) || timeoutMs < 50
      || timeoutMs > (PIN_OPERATIONS.includes(operation) ? 180000 : 30000)) connectorFail('INPUT');
    if (this.#pending.size >= 16) connectorFail('BUSY');
    const bytes = Buffer.from(input);
    return new Promise((resolve, reject) => {
      let request, response, done = false, size = 0, expected; const chunks = [];
      const finish = (code, result) => {
        if (done) return; done = true; clearTimeout(timer); signal?.removeEventListener('abort', aborted); this.#pending.delete(closed);
        response?.destroy(); request?.destroy(); bytes.fill(0);
        if (code) reject(new KonnektorError(code)); else resolve(result);
      };
      const aborted = () => finish('KIM_CONNECTOR_ABORTED'), closed = () => finish('KIM_CONNECTOR_CLOSED');
      const timer = setTimeout(() => finish('KIM_CONNECTOR_TIMEOUT'), timeoutMs);
      signal?.addEventListener('abort', aborted, { once: true }); this.#pending.add(closed);
      try {
        request = https.request(this.#url, { ...this.#options, headers: {
          'Content-Type': 'text/xml; charset=utf-8', SOAPAction: `"${this.#namespace}#${operation}"`,
          'Content-Length': bytes.length, Accept: 'text/xml', 'Accept-Encoding': 'identity',
        } }, incoming => {
          response = incoming;
          incoming.on('error', () => finish('KIM_CONNECTOR_HTTP_CONNECTION'));
          incoming.on('aborted', () => finish('KIM_CONNECTOR_HTTP_INCOMPLETE'));
          if (done) { incoming.destroy(); return; }
          if (![200, 500].includes(incoming.statusCode)) return finish('KIM_CONNECTOR_HTTP_STATUS');
          const counts = new Map();
          for (let i = 0; i < incoming.rawHeaders.length; i += 2) {
            const name = incoming.rawHeaders[i].toLowerCase(); counts.set(name, (counts.get(name) ?? 0) + 1);
          }
          if (['content-type', 'content-length', 'content-encoding', 'transfer-encoding'].some(name => (counts.get(name) ?? 0) > 1)
            || !/^text\/xml(?:[ \t]*;[ \t]*charset[ \t]*=[ \t]*(?:utf-8|"utf-8"))?[ \t]*$/i.test(incoming.headers['content-type'] ?? '')
            || (incoming.headers['content-encoding'] !== undefined && incoming.headers['content-encoding'].toLowerCase() !== 'identity')) return finish('KIM_CONNECTOR_HTTP_FORMAT');
          const length = incoming.headers['content-length'];
          if (length !== undefined) {
            if (!/^[1-9][0-9]*$/.test(length)) return finish('KIM_CONNECTOR_HTTP_FORMAT');
            expected = Number(length);
            if (!Number.isSafeInteger(expected) || expected > 262144) return finish('KIM_CONNECTOR_RESPONSE_SIZE');
          }
          incoming.on('data', chunk => { size += chunk.length; if (size > 262144) return finish('KIM_CONNECTOR_RESPONSE_SIZE'); chunks.push(chunk); });
          incoming.on('end', () => {
            if (!incoming.complete || !size || (expected !== undefined && expected !== size)) return finish('KIM_CONNECTOR_HTTP_INCOMPLETE');
            finish(undefined, { statusCode: incoming.statusCode, bytes: Buffer.concat(chunks, size) });
          });
          incoming.on('close', () => { if (!done) finish('KIM_CONNECTOR_HTTP_INCOMPLETE'); });
        });
        request.on('error', () => finish('KIM_CONNECTOR_HTTP_CONNECTION'));
        request.on('upgrade', (_reply, socket) => { socket.destroy(); finish('KIM_CONNECTOR_HTTP_FORMAT'); });
        request.end(bytes);
      } catch { finish('KIM_CONNECTOR_HTTP_CONNECTION'); }
    });
  }
  close() { this.#closed = true; for (const stop of this.#pending) stop(); this.#options = undefined; }
}
