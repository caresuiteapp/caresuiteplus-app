import tls from 'node:tls';
import { Pop3Session } from './pop3.mjs';

/** TLS socket adapter for the internal mailstore. This is NOT a gematik TI admission gateway:
 * authorizeClient must be provided by the server operator; ordinary CA validation alone is insufficient.
 * The eventual TI edge still needs the specified ECC certificate, TSL/revocation and client identity checks.
 */
export function createPop3TlsServer({ store, tls: options, authorizeClient, timeoutMs = 30_000, maxConnections = 32 }) {
  if (!options?.key || !options.cert || !options.ca || typeof authorizeClient !== 'function' || !Number.isSafeInteger(timeoutMs) || timeoutMs < 100 || timeoutMs > 120_000
    || !Number.isSafeInteger(maxConnections) || maxConnections < 1 || maxConnections > 1000) throw new Error('POP3_SERVER_CONFIGURATION');
  const server = tls.createServer({ key: options.key, cert: options.cert, ca: options.ca, passphrase: options.passphrase,
    requestCert: true, rejectUnauthorized: true, minVersion: 'TLSv1.2', handshakeTimeout: timeoutMs }, socket => {
    let session, closed = false;
    const timer = setTimeout(() => socket.destroy(), timeoutMs);
    socket.on('error', () => {});
    socket.on('close', () => { closed = true; clearTimeout(timer); session?.disconnect(); });
    const serve = async () => {
      const peer = socket.getPeerCertificate(true);
      if (!socket.authorized || !peer.raw || !await authorizeClient(peer) || closed) { socket.destroy(); return; }
      session = new Pop3Session(store, { tlsVerified: true }); socket.write(session.greeting());
      let buffer = '', commands = 0;
      for await (const bytes of socket.iterator({ destroyOnReturn: false })) {
        buffer += bytes.toString('latin1');
        if (buffer.length > 4096) throw new Error('POP3_COMMAND_LIMIT');
        let end;
        while ((end = buffer.indexOf('\r\n')) >= 0) {
          const line = buffer.slice(0, end); buffer = buffer.slice(end + 2);
          if (line.length > 510 || /[^\x20-\x7e]/.test(line) || ++commands > 10_000) throw new Error('POP3_COMMAND_LIMIT');
          const reply = await session.command(line);
          if (closed) return;
          if (line.toUpperCase() === 'QUIT' && reply.subarray(0, 3).toString() === '+OK') { socket.end(reply); return; }
          await new Promise((resolve, reject) => socket.write(reply, error => error ? reject(error) : resolve()));
        }
        if (buffer.length > 510) throw new Error('POP3_COMMAND_LIMIT');
      }
    };
    serve().catch(() => socket.destroy());
  });
  server.maxConnections = maxConnections;
  // No peer diagnostics are emitted to logs. Callers can count this event without logging certificates.
  server.on('tlsClientError', () => {});
  return server;
}
