import tls from 'node:tls';
import { once } from 'node:events';

const fail = code => { throw new Error(code); };
class Lines {
  #iterator; #buffer = Buffer.alloc(0);
  constructor(socket) { this.#iterator = socket[Symbol.asyncIterator](); }
  async next() {
    for (;;) {
      const end = this.#buffer.indexOf('\r\n');
      if (end >= 0) {
        if (end > 16_384) fail('POP3_LINE_LIMIT');
        const line = this.#buffer.subarray(0, end).toString('latin1'); this.#buffer = this.#buffer.subarray(end + 2);
        if (/[\r\n\x00]/.test(line)) fail('POP3_LINE_FORMAT'); return line;
      }
      if (this.#buffer.length > 16_384) fail('POP3_LINE_LIMIT');
      const { done, value } = await this.#iterator.next();
      if (done) fail('POP3_CLOSED');
      this.#buffer = Buffer.concat([this.#buffer, value]);
    }
  }
  async ok() {
    const line = await this.next();
    if (line.length > 510 || !/^\+OK(?:[ \t][\x20-\x7e]*)?$/.test(line)) fail(line.startsWith('-ERR') ? 'POP3_REJECTED' : 'POP3_STATUS');
  }
  async multi({ maxBytes, maxLines }) {
    const chunks = []; let size = 0;
    for (;;) {
      let line = await this.next(); if (line === '.') break;
      if (line.startsWith('.')) {
        if (!line.startsWith('..')) fail('POP3_DOT_TRANSPARENCY'); line = line.slice(1);
      }
      size += line.length + 2;
      if (size > maxBytes || chunks.length >= maxLines) fail('POP3_RESPONSE_LIMIT');
      chunks.push(Buffer.from(`${line}\r\n`, 'latin1'));
    }
    return Buffer.concat(chunks, size);
  }
}
function listing(bytes, uid) {
  const result = new Map(), seen = new Set();
  if (!bytes.length) return result;
  for (const line of bytes.toString('latin1').slice(0, -2).split('\r\n')) {
    const match = (uid ? /^([1-9]\d{0,8}) ([\x21-\x7e]{1,70})$/ : /^([1-9]\d{0,8}) (\d{1,10})$/).exec(line);
    if (!match || result.has(match[1]) || (uid && seen.has(match[2]))) fail('POP3_LIST_AMBIGUOUS');
    result.set(match[1], uid ? match[2] : Number(match[2])); seen.add(match[2]);
  }
  return result;
}

/** Implicit TLS only. The original is committed before DELE, and DELE only commits at QUIT.
 * A failed/unknown QUIT is safe to repeat: each UID is fetched and byte-compared again.
 * config is a server-owned account, never an HTTP/browser supplied URL or credential set.
 */
export async function pollMailbox({ inbox, tenantId, mailboxId, config, onStored, limit = 20 }) {
  const timeout = config.timeoutMs ?? 30_000, maxBytes = config.maxMessageBytes ?? 22_020_096;
  if (!Number.isSafeInteger(timeout) || timeout < 100 || timeout > 120_000 || !Number.isSafeInteger(limit) || limit < 1 || limit > 100
    || !Number.isSafeInteger(maxBytes) || maxBytes < 1 || maxBytes > 32_000_000 || typeof config.password !== 'function'
    || typeof config.servername !== 'string' || !/^(?:[A-Za-z0-9-]+\.)+[A-Za-z0-9-]+$/.test(config.servername)) fail('POP3_CONFIGURATION');
  inbox.bindMailbox({ ...config, tenantId, mailboxId });
  const socket = tls.connect({ host: config.host, port: config.port, servername: config.servername, rejectUnauthorized: true, minVersion: 'TLSv1.2',
    ...(config.ca ? { ca: config.ca } : {}), ...(config.cert && config.key ? { cert: config.cert, key: config.key, passphrase: config.passphrase } : {}) });
  socket.on('error', () => {});
  let timedOut = false, expire;
  const expiration = new Promise((_, reject) => { expire = reject; });
  // Socket destruction bounds reads/handshakes; the same deadline bounds host callbacks too.
  expiration.catch(() => {});
  const bounded = promise => Promise.race([promise, expiration]);
  const timer = setTimeout(() => { timedOut = true; const error = new Error('POP3_TIMEOUT'); socket.destroy(error); expire(error); }, timeout);
  const records = [], result = { stored: 0, duplicates: 0, skippedTooLarge: 0, deleted: 0 };
  try {
    await once(socket, 'secureConnect'); if (!socket.authorized) fail('POP3_TLS_UNTRUSTED');
    const lines = new Lines(socket), command = async line => {
      if (Buffer.byteLength(line) > 510 || /[^\x20-\x7e]/.test(line)) fail('POP3_COMMAND');
      socket.write(`${line}\r\n`); await lines.ok();
    };
    await lines.ok();
    // Obtain the secret only after the peer's certificate and hostname have been verified.
    const supplied = await bounded(config.password());
    if (!(supplied instanceof Uint8Array) || !supplied.length || supplied.length > 256) fail('POP3_CREDENTIALS');
    const password = Buffer.from(supplied);
    try {
      if (/[^\x20-\x7e]/.test(password.toString('latin1'))) fail('POP3_CREDENTIALS');
      await command(`USER ${config.username}`); await command(`PASS ${password.toString('latin1')}`);
    } finally { password.fill(0); }
    await command('UIDL'); const uids = listing(await lines.multi({ maxBytes: 1_000_000, maxLines: 10_000 }), true);
    await command('LIST'); const sizes = listing(await lines.multi({ maxBytes: 300_000, maxLines: 10_000 }), false);
    if (uids.size !== sizes.size || [...uids.keys()].some(n => !sizes.has(n))) fail('POP3_LIST_MISMATCH');
    for (const [number, uid] of uids) {
      if (records.length >= limit) break;
      const size = sizes.get(number);
      if (!size || size > maxBytes) { result.skippedTooLarge++; continue; }
      await command(`RETR ${number}`);
      const bytes = await lines.multi({ maxBytes, maxLines: Math.min(400_000, Math.floor(maxBytes / 2)) });
      if (bytes.length !== size) fail('POP3_SIZE_MISMATCH');
      const record = inbox.record({ tenantId, mailboxId, uid, bytes });
      records.push(record); result[record.inserted ? 'stored' : 'duplicates']++;
      if (onStored) await bounded(onStored(record.id));
      await command(`DELE ${number}`);
    }
    await command('QUIT');
    inbox.confirmDeletion(tenantId, mailboxId, records); result.deleted = records.length;
    return result;
  } catch (error) {
    if (timedOut) fail('POP3_TIMEOUT');
    // Keep only our fixed codes; TLS/network errors must not leak credentials or mail content.
    if (/^(?:POP3|INBOX|STORE|RECEIPT)_[A-Z_]+$/.test(error?.message ?? '')) throw error;
    fail('POP3_CONNECTION');
  } finally { clearTimeout(timer); socket.destroy(); }
}
