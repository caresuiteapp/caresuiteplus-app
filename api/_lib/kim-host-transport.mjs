import { isIP } from 'node:net';
import https from 'node:https';
import { checkServerIdentity, createSecureContext } from 'node:tls';
import { createHash } from 'node:crypto';

/** Only provisioned service credentials travel to the on-site host; never the
 * user's Supabase bearer token. URL, roots and leaf pin are server configuration. */
export function callKimHost(env, input) {
  let url, secureContext;
  try {
    url = new URL(env.KIM_DIAGNOSTIC_HOST_URL);
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || url.pathname !== '/v1/diagnostics'
      || !/^[a-f0-9]{64}$/.test(env.KIM_DIAGNOSTIC_HOST_SHA256 ?? '')
      || (env.KIM_DIAGNOSTIC_HOST_CONNECT_ADDRESS && !isIP(env.KIM_DIAGNOSTIC_HOST_CONNECT_ADDRESS))
      || !env.KIM_DIAGNOSTIC_HOST_CA || !env.KIM_DIAGNOSTIC_CLIENT_CERT || !env.KIM_DIAGNOSTIC_CLIENT_KEY) throw new Error();
    secureContext = createSecureContext({ ca: env.KIM_DIAGNOSTIC_HOST_CA, cert: env.KIM_DIAGNOSTIC_CLIENT_CERT,
      key: env.KIM_DIAGNOSTIC_CLIENT_KEY, passphrase: env.KIM_DIAGNOSTIC_CLIENT_PASSPHRASE, minVersion: 'TLSv1.2' });
  } catch { return Promise.reject(new Error('KIM_HOST_CONFIGURATION')); }
  return new Promise((resolve, reject) => {
    const data = Buffer.from(JSON.stringify(input));
    let request, response, done = false, size = 0; const chunks = [];
    const finish = (error, value) => {
      if (done) return; done = true; clearTimeout(timer); request?.destroy(); response?.destroy(); data.fill(0);
      if (error) reject(new Error(error)); else resolve(value);
    };
    const timer = setTimeout(() => finish('KIM_HOST_UNAVAILABLE'), 10000);
    try {
      request = https.request(url, { method: 'POST', agent: false, secureContext, rejectUnauthorized: true, maxHeaderSize: 8192,
        ...(env.KIM_DIAGNOSTIC_HOST_CONNECT_ADDRESS ? { lookup: (_host, options, callback) => { const address = env.KIM_DIAGNOSTIC_HOST_CONNECT_ADDRESS, family = isIP(address); callback(null, options.all ? [{ address, family }] : address, ...(options.all ? [] : [family])); } } : {}),
        checkServerIdentity: (hostname, peer) => checkServerIdentity(hostname, peer)
          || (!peer.raw || createHash('sha256').update(peer.raw).digest('hex') !== env.KIM_DIAGNOSTIC_HOST_SHA256 ? new Error('KIM_HOST_TLS') : undefined),
        headers: { 'Content-Type': 'application/json', 'Content-Length': data.length, Accept: 'application/json', 'Accept-Encoding': 'identity' },
      }, incoming => {
        response = incoming; incoming.on('error', () => finish('KIM_HOST_UNAVAILABLE'));
        if (incoming.statusCode !== 200 || !/^application\/json(?:;\s*charset=utf-8)?$/i.test(incoming.headers['content-type'] ?? '')
          || incoming.headers['content-encoding'] !== undefined) return finish('KIM_HOST_UNAVAILABLE');
        incoming.on('data', chunk => { size += chunk.length; if (size > 32768) finish('KIM_HOST_RESPONSE'); else chunks.push(chunk); });
        incoming.on('end', () => { try { if (!incoming.complete) throw new Error(); finish(null, JSON.parse(Buffer.concat(chunks).toString('utf8'))); } catch { finish('KIM_HOST_RESPONSE'); } });
        incoming.on('close', () => { if (!done) finish('KIM_HOST_UNAVAILABLE'); });
      });
      request.on('error', () => finish('KIM_HOST_UNAVAILABLE')); request.end(data);
    } catch { finish('KIM_HOST_UNAVAILABLE'); }
  });
}
