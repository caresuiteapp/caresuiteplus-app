import net from 'node:net';
import tls from 'node:tls';
import { once } from 'node:events';

export const mailbox = value => typeof value === 'string' && value.length <= 254 && /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9.-]*[A-Za-z0-9])?$/.test(value);
const domain = v => typeof v === 'string' && v.length <= 253 && /^(?:[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?\.)+[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?$/.test(v);

class Replies {
  constructor(socket) {
    this.socket = socket; this.buffer = ''; this.lines = []; this.queue = []; this.waiter = undefined; this.failure = undefined;
    this.data = chunk => {
      this.buffer += chunk.toString('utf8');
      if (this.buffer.length > 65_536) return this.fail('SMTP_REPLY_LIMIT');
      let end;
      while ((end = this.buffer.indexOf('\r\n')) !== -1) {
        const line = this.buffer.slice(0, end); this.buffer = this.buffer.slice(end + 2);
        if (!/^[2-5][0-9]{2}[- ][\x20-\x7e]*$/.test(line) || line.length > 1000 || this.lines.length >= 100 || (this.lines.length && this.lines[0].slice(0, 3) !== line.slice(0, 3))) return this.fail('SMTP_REPLY_FORMAT');
        this.lines.push(line);
        if (line[3] === ' ') {
          const reply = { code: Number(line.slice(0, 3)), lines: this.lines.map(v => v.slice(4)) }; this.lines = [];
          if (this.waiter) { const w = this.waiter; this.waiter = undefined; w.resolve(reply); }
          else { this.queue.push(reply); if (this.queue.length > 2) return this.fail('SMTP_UNEXPECTED_REPLY'); }
        }
      }
    };
    this.error = () => this.fail('SMTP_CONNECTION'); this.close = () => this.fail('SMTP_CLOSED');
    socket.on('data', this.data); socket.on('error', this.error); socket.on('close', this.close);
  }
  fail(code) { if (this.failure) return; this.failure = new Error(code); if (this.waiter) { this.waiter.reject(this.failure); this.waiter = undefined; } this.socket.destroy(this.failure); }
  async next(expected) {
    if (this.failure) throw this.failure;
    const reply = this.queue.shift() ?? await new Promise((resolve, reject) => { this.waiter = { resolve, reject }; });
    if (!expected.includes(reply.code)) throw new Error(`SMTP_REJECTED_${reply.code}`);
    return reply;
  }
  detach() {
    if (this.buffer || this.lines.length || this.queue.length || this.waiter) throw new Error('SMTP_UPGRADE_BUFFER');
    this.socket.off('data', this.data); this.socket.off('error', this.error); this.socket.off('close', this.close);
  }
}

/** One SMTP transaction, one recipient. No automatic retries, including lost acknowledgement after DATA. */
export async function sendSmtp(message, config) {
  if (!mailbox(message.from) || !mailbox(message.to) || !domain(config.ehlo) || !domain(config.servername) || !config.host || !Number.isInteger(config.port) || config.port < 1 || config.port > 65535 || !['tls', 'starttls'].includes(config.mode)) throw new Error('SMTP_CONFIGURATION');
  const bytes = Buffer.from(message.mime), wire = bytes.toString('latin1');
  if (message.dsn?.envelopeId !== undefined && !/^[A-Za-z0-9._-]{1,100}$/.test(message.dsn.envelopeId)) throw new Error('SMTP_ENVELOPE_ID');
  if (!bytes.length || bytes.length > 32_000_000 || /[^\x09\x0d\x0a\x20-\x7e]/.test(wire) || /(?<!\r)\n|\r(?!\n)/.test(wire) || !wire.endsWith('\r\n') || wire.split('\r\n').some(l => l.length > 998)) throw new Error('SMTP_MIME');
  const timeout = config.timeoutMs ?? 30_000;
  if (!Number.isSafeInteger(timeout) || timeout < 100 || timeout > 120_000) throw new Error('SMTP_TIMEOUT_CONFIGURATION');
  const tlsOptions = { servername: config.servername, rejectUnauthorized: true, minVersion: 'TLSv1.2', ...(config.ca ? { ca: config.ca } : {}), ...(config.cert && config.key ? { cert: config.cert, key: config.key, passphrase: config.passphrase } : {}) };
  let socket = config.mode === 'tls' ? tls.connect({ host: config.host, port: config.port, ...tlsOptions }) : net.connect({ host: config.host, port: config.port });
  let replies = new Replies(socket);
  const timer = setTimeout(() => replies.fail('SMTP_TIMEOUT'), timeout);
  const command = async (line, expected) => {
    if (line.length > 12_000 || /[\r\n]/.test(line)) throw new Error('SMTP_COMMAND');
    socket.write(`${line}\r\n`); return replies.next(expected);
  };
  try {
    await once(socket, config.mode === 'tls' ? 'secureConnect' : 'connect');
    await replies.next([220]);
    let hello = await command(`EHLO ${config.ehlo}`, [250]);
    if (config.mode === 'starttls') {
      if (!hello.lines.some(v => /^STARTTLS$/i.test(v))) throw new Error('SMTP_TLS_REQUIRED');
      await command('STARTTLS', [220]); replies.detach();
      socket = tls.connect({ socket, ...tlsOptions }); replies = new Replies(socket);
      await once(socket, 'secureConnect'); hello = await command(`EHLO ${config.ehlo}`, [250]);
    }
    if (!socket.authorized) throw new Error('SMTP_TLS_UNTRUSTED');
    const size = hello.lines.find(v => /^SIZE(?: |$)/i.test(v));
    if (size && /^SIZE \d+$/i.test(size) && Number(size.slice(5)) > 0 && bytes.length > Number(size.slice(5))) throw new Error('SMTP_SERVER_SIZE');
    if (message.dsn && !hello.lines.some(v => /^DSN$/i.test(v))) throw new Error('SMTP_DSN_REQUIRED');
    if (config.credentials) {
      if (!hello.lines.some(v => /^AUTH(?: |=).*\bPLAIN\b/i.test(v))) throw new Error('SMTP_AUTH_PLAIN_REQUIRED');
      const { username, password } = await config.credentials();
      if (typeof username !== 'string' || !username.length || username.length > 254 || /[\x00-\x1f\x7f]/.test(username) || !password?.length || password.length > 1024 || Buffer.from(password).includes(0)) throw new Error('SMTP_CREDENTIALS');
      const auth = Buffer.concat([Buffer.from(`\0${username}\0`), Buffer.from(password)]);
      try { await command(`AUTH PLAIN ${auth.toString('base64')}`, [235]); } finally { auth.fill(0); }
    }
    const dsn = message.dsn ? ` RET=HDRS${message.dsn.envelopeId ? ` ENVID=${message.dsn.envelopeId}` : ''}` : '';
    await command(`MAIL FROM:<${message.from}>${size ? ` SIZE=${bytes.length}` : ''}${dsn}`, [250]);
    await command(`RCPT TO:<${message.to}>${message.dsn ? ' NOTIFY=SUCCESS,FAILURE,DELAY' : ''}`, [250, 251]);
    await command('DATA', [354]);
    // MIME is already CRLF-canonical; only dot transparency is added on the wire.
    socket.write(wire.replace(/(^|\r\n)\./g, '$1..') + '.\r\n', 'latin1');
    await replies.next([250]);
    // Acceptance is durable at the remote SMTP server now. A broken QUIT cannot undo that result.
    socket.end('QUIT\r\n');
    return { reference: message.messageId };
  } finally { clearTimeout(timer); socket.destroy(); }
}
