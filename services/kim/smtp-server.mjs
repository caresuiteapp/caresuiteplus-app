import tls from 'node:tls';
import { kimAddress, hostName } from './address.mjs';
import { decodeXtext } from './dsn.mjs';
import { PinnedAutVerifier } from './message-auth.mjs';
import { MAX_KIM_MESSAGE, verifySubmission } from './message.mjs';

function parameters(text, allowed) {
  const result = {};
  if (!text) return result;
  for (const p of text.trim().split(/ +/)) {
    const m = /^([A-Za-z]+)=(\S+)$/.exec(p), key = m?.[1].toUpperCase();
    if (!m || !allowed.includes(key) || Object.hasOwn(result, key)) throw new Error('SMTP_PARAMETERS');
    result[key] = m[2];
  }
  return result;
}
function authText(value) {
  if (!value || value.length > 1600 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)) throw new Error('SMTP_AUTH');
  const bytes = Buffer.from(value, 'base64');
  if (bytes.toString('base64') !== value) throw new Error('SMTP_AUTH');
  try { return new TextDecoder('utf-8', { fatal: true }).decode(bytes); } finally { bytes.fill(0); }
}

/** Closed LOCAL submission listener, never an Internet/TI relay. No bind/listen happens here.
 * Ordinary CA validation and the explicit host authorization callback are NOT yet the TI TLS edge.
 * The host must supply a current, verified/provisioned AUT trust snapshot; no permissive defaults.
 */
export function createSmtpTlsServer({ store, tls: options, authorizeClient, authVerifier, serverName, localDomains,
  clock = Date.now, timeoutMs = 30_000, maxConnections = 16 }) {
  if (!options?.key || !options.cert || !options.ca || typeof authorizeClient !== 'function' || !(authVerifier instanceof PinnedAutVerifier)
    || !hostName(serverName) || !Array.isArray(localDomains) || !localDomains.length || localDomains.length > 100
    || localDomains.some(d => !hostName(d) || !/\.kim\.telematik(?:-test)?$/.test(d)) || new Set(localDomains).size !== localDomains.length
    || !Number.isInteger(timeoutMs) || timeoutMs < 100 || timeoutMs > 120_000 || !Number.isInteger(maxConnections) || maxConnections < 1 || maxConnections > 32) throw new Error('KIM_SMTP_CONFIGURATION');
  const domains = new Set(localDomains);
  const server = tls.createServer({ key: options.key, cert: options.cert, ca: options.ca, passphrase: options.passphrase,
    requestCert: true, rejectUnauthorized: true, minVersion: 'TLSv1.2', handshakeTimeout: timeoutMs }, socket => {
    let closed = false, session, greeted = false, extended = false, authStep, loginUser, attempts = 0, commands = 0;
    let envelope, data = false, chunks = [], octets = 0, dataLines = 0, buffer = '';
    const reset = () => { envelope = undefined; data = false; chunks = []; octets = 0; dataLines = 0; };
    const timer = setTimeout(() => socket.destroy(), timeoutMs);
    socket.on('error', () => {});
    socket.on('close', () => { closed = true; clearTimeout(timer); reset(); buffer = ''; loginUser = undefined; session = undefined; });
    const reply = line => new Promise((resolve, reject) => {
      if (closed || socket.destroyed) return reject(new Error('SMTP_CLOSED'));
      socket.write(line + '\r\n', e => e ? reject(e) : resolve());
    });
    const finish = line => { if (!closed) socket.end(line + '\r\n'); closed = true; reset(); };
    async function authenticate(line) {
      if (line === '*') { authStep = undefined; loginUser = undefined; await reply('501 5.7.0 Authentication cancelled'); return; }
      try {
        if (authStep === 'login-user') { loginUser = kimAddress(authText(line)); authStep = 'login-password'; await reply('334 UGFzc3dvcmQ6'); return; }
        let username, password;
        if (authStep === 'plain') {
          const fields = authText(line).split('\0');
          if (fields.length !== 3 || (fields[0] && kimAddress(fields[0]) !== kimAddress(fields[1]))) throw new Error('SMTP_AUTH');
          username = kimAddress(fields[1]); password = fields[2];
        } else { username = loginUser; password = authText(line); }
        authStep = undefined; loginUser = undefined;
        if (!username || !domains.has(username.split('@')[1])) throw new Error('SMTP_AUTH');
        const candidate = await store.authenticateSubmission(username, password); password = undefined;
        if (closed) return;
        if (!candidate) throw new Error('SMTP_AUTH');
        session = candidate; await reply('235 2.7.0 Authentication successful');
      } catch {
        authStep = undefined; loginUser = undefined;
        if (++attempts >= 3) finish('421 4.7.0 Authentication unavailable');
        else await reply('535 5.7.8 Authentication failed');
      }
    }
    async function acceptData() {
      const submitted = envelope, bytes = Buffer.concat(chunks, octets); reset();
      try {
        store.assertSubmissionSession(session);
        const checked = verifySubmission(bytes, { sender: submitted.from, recipients: submitted.recipients, authVerifier, now: clock() });
        // Parsing, verification and SQLite commit are synchronous: there is no async gap between the
        // last identity check and the durable acceptance. A lost 250 is recovered by the journal.
        if (closed) return;
        const result = store.commitLocalSubmission({ session, bytes, recipients: submitted.recipients, envelopeId: submitted.envelopeId,
          returnContent: submitted.returnContent, serverName, ...checked });
        await reply(`250 2.0.0 Accepted ${result.receiptId}`);
      } catch (e) {
        const code = e.message;
        if (['KIM_AUTH_TRUST_UNAVAILABLE', 'KIM_ENVELOPE_UNSUPPORTED'].includes(code)) await reply('451 4.7.0 Required verification unavailable');
        else if (['KIM_ORIGINATOR', 'KIM_ACCOUNT', 'KIM_CREDENTIALS_CHANGED'].includes(code)) await reply('550 5.7.1 Submission identity rejected');
        else if (code === 'KIM_SUBMISSION_CONFLICT') await reply('554 5.6.0 Conflicting message identity');
        else if (['KIM_MESSAGE_FORMAT', 'KIM_MESSAGE_EXPIRED'].includes(code)) await reply('554 5.6.0 Invalid message');
        else await reply('452 4.3.1 Submission temporarily unavailable');
      }
    }
    async function command(line) {
      if (++commands > 10_000) { finish('421 4.5.3 Command limit'); return; }
      if (authStep) { await authenticate(line); return; }
      const parsed = /^([A-Za-z]+)(?: +(.*))?$/.exec(line);
      if (!parsed) { await reply('500 5.5.2 Invalid command'); return; }
      const name = parsed[1].toUpperCase(), arg = parsed[2];
      if (name === 'QUIT' && arg === undefined) { finish('221 2.0.0 Bye'); return; }
      if (name === 'NOOP' && arg === undefined) { await reply('250 2.0.0 OK'); return; }
      if (name === 'RSET' && arg === undefined) { reset(); await reply('250 2.0.0 Reset'); return; }
      if (['EHLO', 'HELO'].includes(name)) {
        if (!arg || arg.length > 255 || !/^[A-Za-z0-9.\[\]:-]+$/.test(arg)) { await reply('501 5.5.2 Invalid greeting'); return; }
        reset(); greeted = true; extended = name === 'EHLO';
        await reply(extended ? `250-${serverName}\r\n250-SIZE ${MAX_KIM_MESSAGE}\r\n250-AUTH LOGIN PLAIN\r\n250-8BITMIME\r\n250-ENHANCEDSTATUSCODES\r\n250 DSN` : '250 2.0.0 OK'); return;
      }
      if (!greeted) { await reply('503 5.5.1 Greeting required'); return; }
      if (name === 'AUTH') {
        if (!extended || session || envelope) { await reply('503 5.5.1 Authentication out of sequence'); return; }
        const a = /^(PLAIN|LOGIN)(?: +([A-Za-z0-9+/=]+))?$/i.exec(arg ?? '');
        if (!a) { await reply('504 5.5.4 Unsupported authentication'); return; }
        authStep = a[1].toUpperCase() === 'PLAIN' ? 'plain' : 'login-user';
        if (a[2]) await authenticate(a[2]); else await reply(authStep === 'plain' ? '334 ' : '334 VXNlcm5hbWU6'); return;
      }
      if (!session) { await reply('530 5.7.0 Authentication required'); return; }
      try { store.assertSubmissionSession(session); } catch { finish('421 4.7.0 Authentication expired'); return; }
      if (name === 'MAIL') {
        if (envelope) { await reply('503 5.5.1 Transaction already active'); return; }
        const m = /^FROM:<([^<>]+)>(?: +(.*))?$/i.exec(arg ?? '');
        try {
          if (!m) throw new Error(); const from = kimAddress(m[1]), p = parameters(m[2], extended ? ['SIZE', 'BODY', 'RET', 'ENVID'] : []);
          if (from !== kimAddress(session.address)) { await reply('553 5.7.1 Sender does not match authentication'); return; }
          if ((p.SIZE && !/^\d{1,10}$/.test(p.SIZE)) || (p.BODY && !['7BIT', '8BITMIME'].includes(p.BODY.toUpperCase())) || (p.RET && !['FULL', 'HDRS'].includes(p.RET.toUpperCase()))) throw new Error();
          if (p.SIZE && Number(p.SIZE) > MAX_KIM_MESSAGE) { await reply('552 5.3.4 Message too large'); return; }
          envelope = { from, size: p.SIZE === undefined ? undefined : Number(p.SIZE), body: p.BODY?.toUpperCase() ?? '7BIT',
            envelopeId: p.ENVID ? decodeXtext(p.ENVID) : undefined, returnContent: p.RET?.toUpperCase() ?? 'HDRS', recipients: [] };
          await reply('250 2.1.0 Sender accepted');
        } catch { await reply('501 5.5.4 Invalid sender parameters'); } return;
      }
      if (name === 'RCPT') {
        if (!envelope) { await reply('503 5.5.1 MAIL required'); return; }
        if (envelope.recipients.length >= 100) { await reply('452 4.5.3 Too many recipients'); return; }
        const m = /^TO:<([^<>]+)>(?: +(.*))?$/i.exec(arg ?? '');
        try {
          if (!m) throw new Error(); const address = kimAddress(m[1]), p = parameters(m[2], extended ? ['NOTIFY', 'ORCPT'] : []);
          if (!domains.has(address.split('@')[1])) { await reply('550 5.7.1 Relay unavailable'); return; }
          const notify = p.NOTIFY?.toUpperCase().split(',') ?? ['FAILURE', 'DELAY'];
          if (!notify.length || new Set(notify).size !== notify.length || notify.some(n => !['SUCCESS', 'FAILURE', 'DELAY', 'NEVER'].includes(n)) || (notify.includes('NEVER') && notify.length !== 1)) throw new Error();
          let originalRecipient;
          if (p.ORCPT) { if (!/^rfc822;/i.test(p.ORCPT)) throw new Error(); originalRecipient = kimAddress(decodeXtext(p.ORCPT.slice(7), 254)); }
          const recipient = { address, notify: notify.sort(), ...(originalRecipient ? { originalRecipient } : {}) }, previous = envelope.recipients.find(r => r.address === address);
          if (previous && JSON.stringify(previous) !== JSON.stringify(recipient)) throw new Error();
          if (!previous) envelope.recipients.push(recipient);
          await reply('250 2.1.5 Recipient accepted');
        } catch { await reply('501 5.5.4 Invalid recipient parameters'); } return;
      }
      if (name === 'DATA' && arg === undefined) {
        if (!envelope?.recipients.length) { await reply('503 5.5.1 Recipient required'); return; }
        data = true; await reply('354 End with CRLF.CRLF'); return;
      }
      await reply('502 5.5.1 Unsupported command');
    }
    async function serve() {
      const peer = socket.getPeerCertificate(true);
      if (!socket.authorized || !peer.raw || !await authorizeClient(peer) || closed) { socket.destroy(); return; }
      await reply(`220 ${serverName} ESMTP CareSuite local submission`);
      for await (const bytes of socket.iterator({ destroyOnReturn: false })) {
        buffer += bytes.toString('latin1');
        if (buffer.length > 131_072) { finish('421 4.5.3 Input limit'); return; }
        let end;
        while (!closed && (end = buffer.indexOf('\r\n')) >= 0) {
          let line = buffer.slice(0, end); buffer = buffer.slice(end + 2);
          if (data) {
            if (line === '.') { await acceptData(); continue; }
            if (line.startsWith('.')) line = line.slice(1);
            if (line.length > 998 || /[\x00\r\n]/.test(line) || (envelope.body === '7BIT' && /[\x80-\xff]/.test(line)) || ++dataLines > 400_000) { finish('554 5.6.0 Invalid data framing'); return; }
            octets += line.length + 2;
            if (octets > MAX_KIM_MESSAGE || (envelope.size !== undefined && octets > envelope.size)) { finish('552 5.3.4 Message too large'); return; }
            chunks.push(Buffer.from(line + '\r\n', 'latin1'));
          } else {
            if (line.length > 2048 || /[^\x20-\x7e]/.test(line)) { finish('500 5.5.2 Invalid command framing'); return; }
            await command(line);
          }
        }
        if (closed) return;
        if (buffer.length > (data ? 999 : 2048) || /[\n]|\r(?!$)/.test(buffer)) { finish('500 5.5.2 Invalid framing'); return; }
      }
    }
    serve().catch(() => socket.destroy());
  });
  server.maxConnections = maxConnections;
  server.on('tlsClientError', () => {});
  return server;
}
